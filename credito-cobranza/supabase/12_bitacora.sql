-- Sistema de crédito y cobranza · bitácora de acciones (NXUS AI)
--
-- Se corre DESPUÉS de 11_renovacion_documentos.sql. Se puede volver a correr sin perder nada.
--
-- Cada acción importante queda registrada sola, con quién la hizo y cuándo:
--   pagos registrados o borrados · solicitudes nuevas y cada cambio de estado ·
--   créditos que nacen (desembolso) · movimientos de tesorería y gastos ·
--   usuarios (alta, cargo, ámbito, activo) · permisos por cargo y por persona ·
--   parámetros del negocio · modalidades y porcentajes · clientes que cambian de ruta.
-- Nadie la puede editar ni borrar desde el portal. La ven el dueño, dirección y soporte.

create table if not exists public.bitacora (
  id bigint generated always as identity primary key,
  cuando timestamptz not null default now(),
  usuario uuid,
  accion text not null,
  tabla text not null,
  registro text,
  detalle text
);
create index if not exists bitacora_cuando_idx on public.bitacora (cuando desc);

create or replace function public.registrar_bitacora() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  r jsonb := coalesce(n, o);
  acc text; det text; reg text := coalesce(r->>'id', r->>'clave');
  peso text;
begin
  case tg_table_name
  when 'pagos' then
    peso := to_char((r->>'monto')::numeric, 'FM$999,999,990.00');
    if tg_op = 'INSERT' then acc := 'Pago registrado'; det := peso || ' al crédito #' || (r->>'credito_id') || coalesce(' · ' || nullif(r->>'observacion', ''), '');
    elsif tg_op = 'DELETE' then acc := 'Pago borrado'; det := peso || ' del crédito #' || (r->>'credito_id');
    else return null; end if;
  when 'solicitudes' then
    if tg_op = 'INSERT' then acc := 'Solicitud capturada'; det := (r->>'cliente_nombre') || ' · ' || to_char((r->>'monto')::numeric, 'FM$999,999,990') || ' · ' || coalesce(r->>'tipo', 'nuevo');
    elsif tg_op = 'UPDATE' and (o->>'estado') is distinct from (n->>'estado') then
      acc := 'Solicitud: ' || (n->>'estado'); det := (n->>'cliente_nombre') || ' · ' || (o->>'estado') || ' → ' || (n->>'estado') || coalesce(' · ' || nullif(n->>'motivo', ''), '');
    else return null; end if;
  when 'creditos' then
    if tg_op <> 'INSERT' then return null; end if;
    acc := 'Crédito desembolsado'; det := 'Crédito #' || (r->>'id') || ' · ' || to_char((r->>'monto')::numeric, 'FM$999,999,990') || ' · ' || coalesce(r->>'tipo', 'nuevo');
  when 'movimientos_tesoreria' then
    if tg_op <> 'INSERT' then return null; end if;
    acc := 'Movimiento de tesorería: ' || (r->>'tipo'); det := coalesce(r->>'concepto', r->>'categoria', '') || ' · ' || to_char((r->>'monto')::numeric, 'FM$999,999,990.00') || ' · ' || (r->>'caja_origen') || ' → ' || (r->>'caja_destino');
  when 'perfiles' then
    if tg_op = 'INSERT' then acc := 'Usuario dado de alta'; det := coalesce(r->>'nombre', '') || ' · ' || coalesce(r->>'rol', '') || ' · ' || coalesce(r->>'ambito', '');
    elsif tg_op = 'UPDATE' and ((o->>'rol') is distinct from (n->>'rol') or (o->>'ambito') is distinct from (n->>'ambito') or (o->>'activo') is distinct from (n->>'activo') or (o->>'nombre') is distinct from (n->>'nombre')) then
      acc := 'Usuario modificado'; det := coalesce(n->>'nombre', '') || ' · cargo ' || coalesce(n->>'rol', '') || ' · ámbito ' || coalesce(n->>'ambito', '') || case when (n->>'activo')::boolean then '' else ' · INACTIVO' end;
    else return null; end if;
  when 'permisos' then
    if tg_op <> 'UPDATE' or (o->>'permitido') is not distinct from (n->>'permitido') then return null; end if;
    acc := 'Permiso de cargo'; reg := (n->>'rol') || '|' || (n->>'permiso'); det := (n->>'rol') || ': ' || (n->>'permiso') || ' → ' || case when (n->>'permitido')::boolean then 'sí' else 'no' end;
  when 'permisos_usuario' then
    acc := 'Permiso de una persona'; reg := r->>'usuario';
    det := coalesce((select nombre from public.perfiles where id = (r->>'usuario')::uuid), '') || ': ' || (r->>'permiso') || ' → '
      || case when tg_op = 'DELETE' then 'igual que su cargo' when (r->>'permitido')::boolean then 'sí' else 'no' end;
  when 'parametros' then
    if tg_op <> 'UPDATE' or (o->>'valor') is not distinct from (n->>'valor') then return null; end if;
    acc := 'Parámetro cambiado'; det := coalesce(n->>'descripcion', n->>'clave') || ': ' || coalesce(o->>'valor', '—') || ' → ' || coalesce(n->>'valor', '—');
  when 'condiciones' then
    if tg_op = 'UPDATE' and (o->>'interes_pct', o->>'num_cuotas', o->>'activo') is not distinct from (n->>'interes_pct', n->>'num_cuotas', n->>'activo') then return null; end if;
    acc := 'Modalidad y porcentaje'; det := coalesce((select nombre from public.gerencias where id = (r->>'gerencia_id')::int), 'Toda la empresa') || ' · ' || (r->>'frecuencia')
      || case when tg_op = 'DELETE' then ' · usa la regla general' else ' · ' || (r->>'interes_pct') || ' % en ' || (r->>'num_cuotas') || ' pagos' || case when (r->>'activo')::boolean then '' else ' (apagada)' end end;
  when 'clientes' then
    if tg_op <> 'UPDATE' or (o->>'ruta_id') is not distinct from (n->>'ruta_id') then return null; end if;
    acc := 'Cliente cambió de ruta'; det := (n->>'nombre') || ' · ' || coalesce((select nombre from public.rutas where id = (o->>'ruta_id')::int), o->>'ruta_id') || ' → ' || coalesce((select nombre from public.rutas where id = (n->>'ruta_id')::int), n->>'ruta_id');
  else return null;
  end case;
  insert into public.bitacora (usuario, accion, tabla, registro, detalle) values (auth.uid(), acc, tg_table_name, reg, left(det, 500));
  return null;
end $$;
revoke all on function public.registrar_bitacora() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['pagos','solicitudes','creditos','movimientos_tesoreria','perfiles','permisos','permisos_usuario','parametros','condiciones','clientes'] loop
    execute format('drop trigger if exists bitacora on public.%I', t);
    execute format('create trigger bitacora after insert or update or delete on public.%I for each row execute function public.registrar_bitacora()', t);
  end loop;
end $$;

-- Sólo lectura, y sólo para dueño, dirección y soporte. Lo que hace soporte, sólo lo ve soporte.
alter table public.bitacora enable row level security;
drop policy if exists leer on public.bitacora;
create policy leer on public.bitacora for select to authenticated
  using (public.usuario_activo() and (public.mi_rol() = 'soporte'
    or (public.mi_rol() in ('dueno', 'direccion')
        and not exists (select 1 from public.perfiles p where p.rol = 'soporte' and (p.id = bitacora.usuario or p.id::text = bitacora.registro)))));
revoke all on public.bitacora from anon, authenticated;
grant select on public.bitacora to authenticated;

-- Verificación: debe dar 1 · 10
select (select count(*) from information_schema.tables where table_name = 'bitacora') as tabla_bitacora,
       (select count(*) from pg_trigger where tgname = 'bitacora') as tablas_vigiladas;
