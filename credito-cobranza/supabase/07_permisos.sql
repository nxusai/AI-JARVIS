-- Sistema de crédito y cobranza · permisos editables por cargo (NXUS AI)
--
-- Se corre DESPUÉS de 06_documentos.sql. Se puede volver a correr sin perder lo que
-- el dueño ya haya decidido (sólo agrega permisos nuevos que falten).
--
-- El dueño decide qué puede ver y hacer cada cargo desde Administración → Usuarios.
-- Las acciones se validan aquí, en la base de datos: si un cargo no tiene el
-- permiso, el servidor rechaza la acción aunque alguien se brinque la página.
-- El dueño y soporte siempre tienen todo. Lo que cada quien ve sigue limitado por
-- su ámbito (su región, zona, gerencia, oficina o ruta).

create table if not exists public.permisos (
  rol text not null,
  permiso text not null,
  permitido boolean not null default false,
  actualizado timestamptz not null default now(),
  actualizado_por uuid references auth.users (id),
  primary key (rol, permiso)
);

-- Valores iniciales = como funciona hoy
insert into public.permisos (rol, permiso, permitido)
select r.rol, p.permiso, p.permiso = any (r.si)
from (values
  ('direccion', array['ver_tablero','ver_clientes','ver_originacion','ver_solicitudes','ver_creditos','ver_cobranza','ver_normalidad','ver_proyecciones','ver_cajas','ver_tesoreria','ver_reportes',
                      'registrar_pagos','crear_solicitudes','resolver_solicitudes','registrar_gastos','tesoreria_excedente','capturar_proyecciones','subir_documentos','descargar_excel']),
  ('regional',  array['ver_tablero','ver_clientes','ver_originacion','ver_solicitudes','ver_creditos','ver_cobranza','ver_normalidad','ver_proyecciones','ver_cajas','ver_tesoreria','ver_reportes',
                      'registrar_pagos','crear_solicitudes','capturar_proyecciones','subir_documentos','descargar_excel']),
  ('zonal',     array['ver_tablero','ver_clientes','ver_originacion','ver_solicitudes','ver_creditos','ver_cobranza','ver_normalidad','ver_proyecciones','ver_cajas','ver_tesoreria','ver_reportes',
                      'registrar_pagos','crear_solicitudes','capturar_proyecciones','subir_documentos','descargar_excel']),
  ('gerente',   array['ver_tablero','ver_clientes','ver_originacion','ver_solicitudes','ver_creditos','ver_cobranza','ver_normalidad','ver_proyecciones','ver_cajas','ver_tesoreria','ver_reportes',
                      'registrar_pagos','crear_solicitudes','registrar_gastos','capturar_proyecciones','subir_documentos','descargar_excel']),
  ('asesor',    array['ver_tablero','ver_clientes','ver_originacion','ver_solicitudes','ver_creditos','ver_cobranza','ver_normalidad','ver_cajas','ver_reportes',
                      'registrar_pagos','crear_solicitudes','registrar_gastos','subir_documentos','descargar_excel']),
  ('mesa',      array['ver_tablero','ver_clientes','ver_solicitudes','ver_creditos','ver_cobranza','ver_normalidad','ver_reportes',
                      'resolver_solicitudes','subir_documentos','descargar_excel']),
  ('tesoreria', array['ver_tablero','ver_clientes','ver_solicitudes','ver_creditos','ver_cobranza','ver_normalidad','ver_proyecciones','ver_cajas','ver_tesoreria','ver_reportes',
                      'tesoreria_excedente','descargar_excel']),
  ('consulta',  array['ver_tablero','ver_clientes','ver_solicitudes','ver_creditos','ver_cobranza','ver_normalidad','ver_proyecciones','ver_cajas','ver_tesoreria','ver_reportes','descargar_excel'])
) as r(rol, si)
cross join (values ('ver_tablero'), ('ver_clientes'), ('ver_originacion'), ('ver_solicitudes'), ('ver_creditos'), ('ver_cobranza'), ('ver_normalidad'),
                   ('ver_proyecciones'), ('ver_cajas'), ('ver_tesoreria'), ('ver_reportes'),
                   ('registrar_pagos'), ('crear_solicitudes'), ('resolver_solicitudes'), ('registrar_gastos'), ('tesoreria_excedente'),
                   ('capturar_proyecciones'), ('subir_documentos'), ('descargar_excel')) as p(permiso)
on conflict (rol, permiso) do nothing;

create or replace function public.tiene_permiso(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when public.mi_rol() in ('dueno', 'soporte') then true
              when public.mi_rol() is null then false
              else coalesce((select permitido from public.permisos where rol = public.mi_rol() and permiso = p), false) end;
$$;
revoke all on function public.tiene_permiso(text) from public, anon;
grant execute on function public.tiene_permiso(text) to authenticated;

alter table public.permisos enable row level security;
drop policy if exists leer on public.permisos;
create policy leer on public.permisos for select to authenticated using (public.usuario_activo());
-- Sólo el dueño (y soporte) decide los permisos; dirección no puede darse más.
drop policy if exists decidir on public.permisos;
create policy decidir on public.permisos for update to authenticated
  using (public.mi_rol() in ('dueno', 'soporte'))
  with check (public.mi_rol() in ('dueno', 'soporte') and rol not in ('dueno', 'soporte'));
grant select, update on public.permisos to authenticated;
revoke all on public.permisos from anon;

-- ---------------------------------------------------------------------------
-- Las reglas de cada acción ahora preguntan por el permiso del cargo
-- ---------------------------------------------------------------------------
drop policy if exists registrar_pago on public.pagos;
create policy registrar_pago on public.pagos for insert to authenticated
  with check (tipo = 'cuota' and public.tiene_permiso('registrar_pagos')
    and credito_id in (select c.id from public.creditos c join public.clientes cl on cl.id = c.cliente_id
                       where cl.ruta_id in (select public.mis_rutas())));

drop policy if exists capturar_solicitud on public.solicitudes;
create policy capturar_solicitud on public.solicitudes for insert to authenticated
  with check (estado in ('borrador', 'revision') and public.tiene_permiso('crear_solicitudes')
    and ruta_id in (select public.mis_rutas()));
drop policy if exists corregir_solicitud on public.solicitudes;
create policy corregir_solicitud on public.solicitudes for update to authenticated
  using (estado in ('borrador', 'observada') and ruta_id in (select public.mis_rutas()) and public.tiene_permiso('crear_solicitudes'))
  with check (estado in ('borrador', 'revision') and ruta_id in (select public.mis_rutas()));
drop policy if exists leer_mesa on public.solicitudes;
create policy leer_mesa on public.solicitudes for select to authenticated using (public.tiene_permiso('resolver_solicitudes'));

drop policy if exists alta_tesoreria on public.movimientos_tesoreria;
create policy alta_tesoreria on public.movimientos_tesoreria for insert to authenticated
  with check (public.tiene_permiso('tesoreria_excedente') and tipo = 'deposito' and caja_origen like 'gerencia:%' and caja_destino like 'banco:%');
drop policy if exists alta_gastos_ruta on public.movimientos_tesoreria;
create policy alta_gastos_ruta on public.movimientos_tesoreria for insert to authenticated
  with check (public.tiene_permiso('registrar_gastos') and tipo = 'egreso' and caja_destino = 'externo'
    and caja_origen in (select public.mis_cajas()));

drop policy if exists capturar on public.proyecciones;
create policy capturar on public.proyecciones for insert to authenticated
  with check (public.tiene_permiso('capturar_proyecciones') and oficina_id in (select n.id from public.mis_nodos() n where n.nivel = 'oficina'));
drop policy if exists actualizar on public.proyecciones;
create policy actualizar on public.proyecciones for update to authenticated
  using (public.tiene_permiso('capturar_proyecciones') and oficina_id in (select n.id from public.mis_nodos() n where n.nivel = 'oficina'))
  with check (oficina_id in (select n.id from public.mis_nodos() n where n.nivel = 'oficina'));

create or replace function public.puede_subir(p_tipo text, p_id integer) returns boolean
language sql stable set search_path = public as $$
  select public.ve_expediente(p_tipo, p_id) and (p_tipo = 'personal' or public.tiene_permiso('subir_documentos'));
$$;

-- Mesa de control: resolver solicitudes depende del permiso
do $$
declare src text;
begin
  -- (desde 08_mesa_y_campo.sql la función es otra; entonces no hay nada que corregir aquí)
  if to_regprocedure('public.resolver_solicitud(integer, text, text)') is null then return; end if;
  select pg_get_functiondef('public.resolver_solicitud(integer, text, text)'::regprocedure) into src;
  if position('tiene_permiso(''resolver_solicitudes'')' in src) = 0 then
    src := replace(src, 'if coalesce(public.mi_rol(), '''') not in (''mesa'', ''dueno'', ''direccion'', ''soporte'') then',
                        'if not public.tiene_permiso(''resolver_solicitudes'') then');
    src := replace(src, 'Sólo mesa de control o dirección pueden resolver solicitudes.', 'Tu cargo no tiene permiso para resolver solicitudes.');
    execute src;
  end if;
end $$;
