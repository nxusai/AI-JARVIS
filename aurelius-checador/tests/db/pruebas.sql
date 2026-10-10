-- Pruebas del esquema. Cada bloque falla con "ERROR" si algo no cuadra.
\set QUIET on
update public.admins set email = 'duena@aurelius.mx';

-- Como administrador: crear empleado, PIN y código de activación.
set request.jwt.claims = '{"email":"duena@aurelius.mx","role":"authenticated"}';
set role authenticated;
insert into public.empleados (id, nombre, sueldo_quincenal)
values ('00000000-0000-0000-0000-000000000001', 'Juan', 4500),
       ('00000000-0000-0000-0000-000000000002', 'Ana', 5000);
select public.fijar_pin('00000000-0000-0000-0000-000000000001', '1234');
select public.fijar_pin('00000000-0000-0000-0000-000000000002', '5678');
do $$ begin
  begin
    perform public.fijar_pin('00000000-0000-0000-0000-000000000002', '1234');
    raise exception 'FALLO: se permitió un PIN repetido';
  exception when others then
    if sqlerrm not like '%ya lo usa otro%' then raise; end if;
  end;
  begin
    perform public.fijar_pin('00000000-0000-0000-0000-000000000002', '12');
    raise exception 'FALLO: se permitió un PIN corto';
  exception when others then
    if sqlerrm not like '%4 a 6%' then raise; end if;
  end;
end $$;
select public.crear_codigo_activacion('Caja') as codigo \gset
reset role;
reset request.jwt.claims;

-- La bitácora registró los cambios del administrador, sin el pin_hash.
do $$ begin
  if (select count(*) from public.bitacora where tabla = 'empleados') < 2 then
    raise exception 'FALLO: bitácora vacía';
  end if;
  if exists (select 1 from public.bitacora where despues ? 'pin_hash') then
    raise exception 'FALLO: la bitácora guardó el pin_hash';
  end if;
end $$;

-- Otro usuario con sesión pero que no es admin no ve nada.
set request.jwt.claims = '{"email":"intruso@x.com","role":"authenticated"}';
set role authenticated;
do $$ begin
  if (select count(*) from public.empleados) <> 0 then
    raise exception 'FALLO: un no-admin puede ver empleados';
  end if;
  begin
    perform public.crear_codigo_activacion('x');
    raise exception 'FALLO: un no-admin creó un código';
  exception when others then
    if sqlerrm not like '%Sin permiso%' then raise; end if;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- Como el checador (anon): no puede leer tablas ni usar funciones de admin.
set role anon;
do $$ begin
  begin
    perform 1 from public.empleados;
    raise exception 'FALLO: anon puede leer empleados';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.fijar_pin('00000000-0000-0000-0000-000000000001', '9999');
    raise exception 'FALLO: anon puede cambiar PIN';
  exception when insufficient_privilege then null;
  end;
  if (public.checar('token-falso', '1234', 'entrada') ->> 'error') <> 'DISPOSITIVO_NO_AUTORIZADO' then
    raise exception 'FALLO: aceptó un dispositivo falso';
  end if;
  if (public.activar_dispositivo('NOEXISTE') ->> 'ok')::boolean then
    raise exception 'FALLO: activó con código falso';
  end if;
end $$;

select public.activar_dispositivo(:'codigo') ->> 'token' as token \gset
select (public.activar_dispositivo(:'codigo') ->> 'ok')::boolean as reuso \gset
\if :reuso
  \echo 'FALLO: el código de activación se pudo usar dos veces'
  select 1/0;
\endif

select set_config('prueba.token', :'token', false);
do $$
declare
  t text := current_setting('prueba.token');
  r jsonb;
begin
  if not (public.estado_dispositivo(t) ->> 'autorizado')::boolean then
    raise exception 'FALLO: dispositivo no quedó autorizado';
  end if;

  r := public.checar(t, '1234', 'entrada', 'data:image/jpeg;base64,AAAA');
  if r ->> 'nombre' <> 'Juan' or not (r ->> 'ok')::boolean then
    raise exception 'FALLO: entrada de Juan: %', r;
  end if;

  r := public.checar(t, '1234', 'entrada');
  if not coalesce((r ->> 'duplicado')::boolean, false) then
    raise exception 'FALLO: el doble toque duplicó la entrada: %', r;
  end if;

  r := public.checar(t, '5678', 'salida');
  if r ->> 'aviso' is null then
    raise exception 'FALLO: salida sin entrada no avisó: %', r;
  end if;

  r := public.checar(t, '5678', 'comida');
  if r ->> 'error' <> 'TIPO_INVALIDO' then
    raise exception 'FALLO: tipo inválido aceptado';
  end if;

  -- 5 códigos equivocados bloquean el checador unos minutos.
  for i in 1..5 loop
    r := public.checar(t, '0000', 'entrada');
    if r ->> 'error' <> 'PIN_INCORRECTO' then
      raise exception 'FALLO: PIN incorrecto aceptado: %', r;
    end if;
  end loop;
  r := public.checar(t, '1234', 'salida');
  if r ->> 'error' <> 'BLOQUEADO' then
    raise exception 'FALLO: no se bloqueó tras 5 intentos: %', r;
  end if;
end $$;
reset role;

do $$ begin
  if (select count(*) from public.registros) <> 2 then
    raise exception 'FALLO: se esperaban 2 registros, hay %', (select count(*) from public.registros);
  end if;
  if (select foto from public.registros where tipo = 'entrada') is null then
    raise exception 'FALLO: no se guardó la foto';
  end if;
  -- Lo que hace el checador no ensucia la bitácora.
  if exists (select 1 from public.bitacora where tabla = 'registros') then
    raise exception 'FALLO: la bitácora registró checadas del checador';
  end if;
end $$;

-- El administrador corrige un registro y queda en la bitácora.
set request.jwt.claims = '{"email":"duena@aurelius.mx","role":"authenticated"}';
set role authenticated;
update public.registros set ts = ts - interval '1 hour', editado = now() where tipo = 'salida';
reset role;
do $$ begin
  if not exists (select 1 from public.bitacora where tabla = 'registros' and accion = 'update'
                 and not (antes ? 'foto')) then
    raise exception 'FALLO: la corrección no quedó en la bitácora';
  end if;
end $$;
