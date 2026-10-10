-- =====================================================================
--  AURELIUS · Checador de asistencia y nómina
--  Esquema de base de datos para Supabase.
--
--  Cómo usarlo: en tu proyecto de Supabase abre "SQL Editor", pega TODO
--  este archivo y presiona "Run". Al final cambia el correo en la última
--  sección por el tuyo (es el único que podrá entrar a la consola).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
--  Tablas
-- ---------------------------------------------------------------------

-- Correos que pueden entrar a la consola de administración.
create table if not exists public.admins (
  email text primary key
);

-- Ajustes generales (una sola fila).
create table if not exists public.config (
  id             int primary key default 1 check (id = 1),
  tolerancia_min int     not null default 10 check (tolerancia_min between 0 and 120),
  horas_jornada  numeric not null default 8  check (horas_jornada > 0 and horas_jornada <= 24)
);
insert into public.config (id) values (1) on conflict do nothing;

create table if not exists public.empleados (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (length(trim(nombre)) > 0),
  puesto           text,
  sueldo_quincenal numeric(10,2) not null default 0 check (sueldo_quincenal >= 0),
  pin_hash         text,
  activo           boolean not null default true,
  fecha_ingreso    date not null default (now() at time zone 'America/Mexico_City')::date,
  fecha_baja       date,
  creado           timestamptz not null default now()
);

-- Horario semanal normal. Si un día no tiene fila, ese día descansa.
-- dia: 0 = domingo, 1 = lunes ... 6 = sábado.
-- Si la salida es menor o igual a la entrada, el turno termina al día siguiente.
create table if not exists public.horarios (
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  dia         smallint not null check (dia between 0 and 6),
  entrada     time not null,
  salida      time not null,
  primary key (empleado_id, dia)
);

-- Cambios de un día específico (tienen prioridad sobre el horario semanal).
--   turno    = ese día trabaja con otro horario
--   descanso = ese día no le toca trabajar
--   permiso  = no trabaja pero se le paga (vacaciones, permiso con goce)
create table if not exists public.cambios_dia (
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fecha       date not null,
  tipo        text not null check (tipo in ('turno', 'descanso', 'permiso')),
  entrada     time,
  salida      time,
  nota        text,
  primary key (empleado_id, fecha),
  check (tipo <> 'turno' or (entrada is not null and salida is not null))
);

-- Computadoras autorizadas para checar.
create table if not exists public.dispositivos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  token_hash text not null unique,
  activo     boolean not null default true,
  creado     timestamptz not null default now(),
  ultimo_uso timestamptz
);

-- Códigos de un solo uso para autorizar una computadora.
create table if not exists public.codigos_activacion (
  codigo text primary key,
  nombre text not null,
  expira timestamptz not null,
  usado  boolean not null default false
);

-- Cada vez que alguien checa.
create table if not exists public.registros (
  id             bigint generated always as identity primary key,
  empleado_id    uuid not null references public.empleados(id) on delete restrict,
  tipo           text not null check (tipo in ('entrada', 'salida')),
  ts             timestamptz not null default now(),
  foto           text,
  dispositivo_id uuid references public.dispositivos(id) on delete set null,
  origen         text not null default 'checador' check (origen in ('checador', 'admin')),
  nota           text,
  editado        timestamptz
);
create index if not exists registros_empleado_ts on public.registros (empleado_id, ts);
create index if not exists registros_ts on public.registros (ts);

-- Horas extra que tú autorizaste (minutos = 0 significa "no se pagan").
create table if not exists public.extras_aprobadas (
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fecha       date not null,
  minutos     int not null check (minutos >= 0),
  nota        text,
  aprobado    timestamptz not null default now(),
  primary key (empleado_id, fecha)
);

-- Copia de la nómina cuando cierras una quincena.
create table if not exists public.nominas_cerradas (
  inicio      date primary key,
  fin         date not null,
  datos       jsonb not null,
  total       numeric(12,2) not null,
  cerrada     timestamptz not null default now(),
  cerrada_por text
);

-- Historial de cambios hechos desde la consola.
create table if not exists public.bitacora (
  id      bigint generated always as identity primary key,
  ts      timestamptz not null default now(),
  usuario text,
  tabla   text not null,
  accion  text not null,
  antes   jsonb,
  despues jsonb
);

-- Intentos de código equivocado (para bloquear adivinanzas).
create table if not exists public.intentos_fallidos (
  dispositivo_id uuid not null references public.dispositivos(id) on delete cascade,
  ts             timestamptz not null default now()
);
create index if not exists intentos_fallidos_disp_ts on public.intentos_fallidos (dispositivo_id, ts);

-- ---------------------------------------------------------------------
--  Seguridad: sólo los correos en "admins" pueden leer o cambiar datos.
--  El checador no lee tablas; sólo llama a las funciones de abajo.
-- ---------------------------------------------------------------------

create or replace function public.es_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

do $$
declare t text;
begin
  foreach t in array array['admins','config','empleados','horarios','cambios_dia','dispositivos',
                           'codigos_activacion','registros','extras_aprobadas','nominas_cerradas',
                           'bitacora','intentos_fallidos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_todo on public.%I', t);
    execute format('create policy admin_todo on public.%I for all to authenticated
                    using (public.es_admin()) with check (public.es_admin())', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- La bitácora sólo se escribe con el trigger; desde la consola sólo se lee.
drop policy if exists admin_todo on public.bitacora;
drop policy if exists admin_leer on public.bitacora;
create policy admin_leer on public.bitacora for select to authenticated using (public.es_admin());

-- ---------------------------------------------------------------------
--  Bitácora automática de cambios hechos por el administrador
-- ---------------------------------------------------------------------

create or replace function public.registrar_bitacora()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_usuario text := auth.jwt() ->> 'email';
begin
  -- Lo que hace el checador ya queda en "registros"; aquí sólo cambios del administrador.
  if v_usuario is null then
    return coalesce(new, old);
  end if;
  insert into public.bitacora (usuario, tabla, accion, antes, despues)
  values (
    v_usuario, tg_table_name, lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) - 'foto' - 'pin_hash' end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) - 'foto' - 'pin_hash' end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['empleados','horarios','cambios_dia','registros','extras_aprobadas',
                           'config','dispositivos','nominas_cerradas']
  loop
    execute format('drop trigger if exists bitacora on public.%I', t);
    execute format('create trigger bitacora after insert or update or delete on public.%I
                    for each row execute function public.registrar_bitacora()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
--  Funciones del checador (las puede usar la computadora del restaurante)
-- ---------------------------------------------------------------------

create or replace function public.hora_servidor()
returns timestamptz
language sql stable
as $$ select now(); $$;

create or replace function public.dispositivo_por_token(p_token text)
returns public.dispositivos
language sql stable security definer
set search_path = public, extensions
as $$
  select d.* from public.dispositivos d
  where d.activo
    and d.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;
revoke execute on function public.dispositivo_por_token(text) from public, anon, authenticated;

create or replace function public.estado_dispositivo(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare v public.dispositivos;
begin
  v := public.dispositivo_por_token(p_token);
  if v.id is null then
    return jsonb_build_object('autorizado', false);
  end if;
  return jsonb_build_object('autorizado', true, 'nombre', v.nombre);
end;
$$;

create or replace function public.activar_dispositivo(p_codigo text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_cod   public.codigos_activacion;
  v_token text;
begin
  select * into v_cod from public.codigos_activacion
  where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'))
    and not usado and expira > now()
  for update;

  if v_cod.codigo is null then
    return jsonb_build_object('ok', false, 'error', 'CODIGO_INVALIDO');
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.dispositivos (nombre, token_hash)
  values (v_cod.nombre, encode(extensions.digest(v_token, 'sha256'), 'hex'));
  update public.codigos_activacion set usado = true where codigo = v_cod.codigo;

  return jsonb_build_object('ok', true, 'token', v_token, 'nombre', v_cod.nombre);
end;
$$;

-- Registra una entrada o salida. Devuelve {ok, nombre, tipo, ts, aviso} o {ok:false, error}.
create or replace function public.checar(p_token text, p_pin text, p_tipo text, p_foto text default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_disp  public.dispositivos;
  v_emp   public.empleados;
  v_ult   public.registros;
  v_nuevo public.registros;
  v_aviso text;
  v_fallos int;
begin
  v_disp := public.dispositivo_por_token(p_token);
  if v_disp.id is null then
    return jsonb_build_object('ok', false, 'error', 'DISPOSITIVO_NO_AUTORIZADO');
  end if;

  if p_tipo not in ('entrada', 'salida') then
    return jsonb_build_object('ok', false, 'error', 'TIPO_INVALIDO');
  end if;

  select count(*) into v_fallos from public.intentos_fallidos
  where dispositivo_id = v_disp.id and ts > now() - interval '5 minutes';
  if v_fallos >= 5 then
    return jsonb_build_object('ok', false, 'error', 'BLOQUEADO');
  end if;

  if coalesce(p_pin, '') !~ '^[0-9]{4,6}$' then
    insert into public.intentos_fallidos (dispositivo_id) values (v_disp.id);
    return jsonb_build_object('ok', false, 'error', 'PIN_INCORRECTO');
  end if;

  select * into v_emp from public.empleados
  where activo and pin_hash is not null and pin_hash = extensions.crypt(p_pin, pin_hash)
  limit 1;

  if v_emp.id is null then
    insert into public.intentos_fallidos (dispositivo_id) values (v_disp.id);
    return jsonb_build_object('ok', false, 'error', 'PIN_INCORRECTO');
  end if;

  delete from public.intentos_fallidos where dispositivo_id = v_disp.id;

  select * into v_ult from public.registros
  where empleado_id = v_emp.id
  order by ts desc limit 1;

  -- Doble toque: mismo tipo en los últimos 3 minutos, no se duplica.
  if v_ult.id is not null and v_ult.tipo = p_tipo and v_ult.ts > now() - interval '3 minutes' then
    return jsonb_build_object('ok', true, 'nombre', v_emp.nombre, 'tipo', p_tipo,
                              'ts', v_ult.ts, 'duplicado', true);
  end if;

  if p_tipo = 'entrada' and v_ult.tipo = 'entrada' and v_ult.ts > now() - interval '20 hours' then
    v_aviso := 'Tenías una entrada sin salida. Avísale al encargado para corregirla.';
  elsif p_tipo = 'salida' and (v_ult.id is null or v_ult.tipo = 'salida'
                               or v_ult.ts <= now() - interval '20 hours') then
    v_aviso := 'No encontramos tu entrada de hoy. Avísale al encargado.';
  end if;

  -- Foto: sólo imágenes JPEG/PNG en base64 y de tamaño razonable.
  if p_foto is not null and (length(p_foto) > 300000 or p_foto !~ '^data:image/(jpeg|png);base64,') then
    p_foto := null;
  end if;

  insert into public.registros (empleado_id, tipo, foto, dispositivo_id, origen)
  values (v_emp.id, p_tipo, p_foto, v_disp.id, 'checador')
  returning * into v_nuevo;

  update public.dispositivos set ultimo_uso = now() where id = v_disp.id;

  return jsonb_build_object('ok', true, 'nombre', v_emp.nombre, 'tipo', p_tipo,
                            'ts', v_nuevo.ts, 'aviso', v_aviso);
end;
$$;

-- ---------------------------------------------------------------------
--  Funciones de la consola (sólo administrador)
-- ---------------------------------------------------------------------

create or replace function public.fijar_pin(p_empleado uuid, p_pin text)
returns void
language plpgsql security definer
set search_path = public, extensions
as $$
begin
  if not public.es_admin() then
    raise exception 'Sin permiso';
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4,6}$' then
    raise exception 'El código debe tener de 4 a 6 números';
  end if;
  if exists (select 1 from public.empleados
             where id <> p_empleado and activo and pin_hash is not null
               and pin_hash = extensions.crypt(p_pin, pin_hash)) then
    raise exception 'Ese código ya lo usa otro empleado. Elige otro.';
  end if;
  update public.empleados set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  where id = p_empleado;
  if not found then
    raise exception 'Empleado no encontrado';
  end if;
end;
$$;

create or replace function public.crear_codigo_activacion(p_nombre text)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes  bytea := extensions.gen_random_bytes(8);
  v_codigo text := '';
  i int;
begin
  if not public.es_admin() then
    raise exception 'Sin permiso';
  end if;
  for i in 0..7 loop
    v_codigo := v_codigo || substr(v_letras, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  insert into public.codigos_activacion (codigo, nombre, expira)
  values (v_codigo, coalesce(nullif(trim(p_nombre), ''), 'Checador'), now() + interval '24 hours');
  return v_codigo;
end;
$$;

-- Funciones que el checador NO debe poder usar.
revoke execute on function public.fijar_pin(uuid, text) from public, anon;
revoke execute on function public.crear_codigo_activacion(text) from public, anon;
revoke execute on function public.registrar_bitacora() from public, anon, authenticated;

grant execute on function public.hora_servidor() to anon, authenticated;
grant execute on function public.estado_dispositivo(text) to anon, authenticated;
grant execute on function public.activar_dispositivo(text) to anon, authenticated;
grant execute on function public.checar(text, text, text, text) to anon, authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.fijar_pin(uuid, text) to authenticated;
grant execute on function public.crear_codigo_activacion(text) to authenticated;

-- =====================================================================
--  ÚLTIMO PASO: escribe aquí TU correo (el mismo con el que vas a entrar).
-- =====================================================================
insert into public.admins (email) values ('TU-CORREO@ejemplo.com') on conflict do nothing;
