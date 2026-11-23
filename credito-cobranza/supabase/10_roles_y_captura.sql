-- Sistema de crédito y cobranza · cada quien con sus funciones bien definidas (NXUS AI)
--
-- Se corre DESPUÉS de 09_ubicacion_en_ruta.sql. Se puede volver a correr sin perder nada.
--
-- Lo que agrega (audios y videos de Emmanuel, 23 nov):
--   · Mesa de control es una empresa externa: sólo ve las solicitudes que revisa y el
--     historial del cliente de cada solicitud. No ve la cartera, ni clientes, ni cajas.
--   · Una persona puede tener varias rutas, oficinas o gerencias a la vez (como en Listo:
--     «consultar y agregar rutas»). Quitarle una ruta y darle otra cambia lo que ve al instante.
--   · Permisos por persona, además de los del cargo: el dueño prende o apaga lo que quiera a
--     alguien en específico sin afectar a los demás de su cargo.
--   · Más datos al registrar al cliente: sexo, correo, teléfono adicional y referencias.
--   · Modalidad diaria preparada: 30 pagos, 50 % (apagada hasta que el dueño la active).

-- ---------------------------------------------------------------------------
-- 1. Varias zonas, gerencias, oficinas o rutas por persona («ruta:3,ruta:5»)
-- ---------------------------------------------------------------------------
alter table public.perfiles drop constraint if exists perfiles_ambito_check;
alter table public.perfiles add constraint perfiles_ambito_check
  check (ambito ~ '^empresa$|^(region|zona|gerencia|oficina|ruta):[0-9]+(,(region|zona|gerencia|oficina|ruta):[0-9]+)*$');

-- Mesa de control (empresa externa) no tiene ámbito de cartera: sólo ve solicitudes
create or replace function public.mi_ambito() returns text
language sql stable security definer set search_path = public as $$
  select case when rol in ('dueno', 'direccion', 'soporte') then 'empresa'
              when rol = 'mesa' then 'ninguno'
              else ambito end
  from public.perfiles where id = auth.uid() and activo;
$$;

create or replace function public.mis_nodos() returns table (nivel text, id smallint)
language sql stable security definer set search_path = public as $$
  with a as (select unnest(string_to_array(public.mi_ambito(), ',')) as amb),
  t as (
    select rg.id as rg, z.id as z, g.id as g, o.id as o, r.id as r
    from public.regiones rg
    left join public.zonas z on z.region_id = rg.id
    left join public.gerencias g on g.zona_id = z.id
    left join public.oficinas o on o.gerencia_id = g.id
    left join public.rutas r on r.oficina_id = o.id
  ),
  m as (
    select t.* from t, a
    where a.amb = 'empresa' or a.amb = 'region:' || t.rg or a.amb = 'zona:' || t.z
       or a.amb = 'gerencia:' || t.g or a.amb = 'oficina:' || t.o or a.amb = 'ruta:' || t.r
  )
  select 'region', rg from m
  union select 'zona', z from m where z is not null
  union select 'gerencia', g from m where g is not null
  union select 'oficina', o from m where o is not null
  union select 'ruta', r from m where r is not null;
$$;

create or replace function public.mis_cajas() returns setof text
language sql stable security definer set search_path = public as $$
  with a as (select unnest(string_to_array(public.mi_ambito(), ',')) as amb)
  select 'ruta:' || r.id from public.rutas r
    join public.oficinas o on o.id = r.oficina_id join public.gerencias g on g.id = o.gerencia_id join public.zonas z on z.id = g.zona_id, a
    where a.amb in ('empresa', 'region:' || z.region_id, 'zona:' || z.id, 'gerencia:' || g.id, 'oficina:' || o.id, 'ruta:' || r.id)
  union
  select 'oficina:' || o.id from public.oficinas o
    join public.gerencias g on g.id = o.gerencia_id join public.zonas z on z.id = g.zona_id, a
    where a.amb in ('empresa', 'region:' || z.region_id, 'zona:' || z.id, 'gerencia:' || g.id, 'oficina:' || o.id)
  union
  select 'gerencia:' || g.id from public.gerencias g join public.zonas z on z.id = g.zona_id, a
    where a.amb in ('empresa', 'region:' || z.region_id, 'zona:' || z.id, 'gerencia:' || g.id)
  union
  select 'banco:' || b.id from public.cuentas_bancarias b, a where a.amb = 'empresa';
$$;

-- ---------------------------------------------------------------------------
-- 2. Historial del cliente de una solicitud (para mesa, sin abrirle la cartera)
-- ---------------------------------------------------------------------------
create or replace function public.historial_solicitud(p_id integer) returns json
language plpgsql stable security definer set search_path = public as $$
declare s public.solicitudes; v_cli integer;
begin
  select * into s from public.solicitudes where id = p_id;
  if s.id is null then raise exception 'La solicitud no existe.'; end if;
  if not (public.tiene_permiso('resolver_solicitudes') or public.tiene_permiso('autorizar_excepciones')
          or s.ruta_id in (select public.mis_rutas())) then
    raise exception 'No tienes acceso a esta solicitud.';
  end if;
  v_cli := coalesce(s.cliente_id, (select cliente_id from public.creditos where id = s.credito_anterior_id),
                    (select id from public.clientes where curp is not null and curp = upper(trim(coalesce(s.curp, ''))) limit 1));
  if v_cli is null then return json_build_object('creditos', '[]'::json, 'pagos', '[]'::json); end if;
  return json_build_object(
    'creditos', coalesce((select json_agg(c order by c.fecha_inicio desc) from (
        select credito_id, monto, total_pagar, cuota, frecuencia, num_cuotas, fecha_inicio, cuotas_pagadas, saldo, dias_atraso,
               estado, tipo, credito_anterior_id, descuento_renovacion, entregado, seguro, cliente_id, cliente, ruta, asesor
        from public.v_cartera where cliente_id = v_cli) c), '[]'::json),
    'pagos', coalesce((select json_agg(p order by p.fecha) from (
        select p.id, p.credito_id, p.fecha, p.monto, p.tipo from public.pagos p
        join public.creditos c on c.id = p.credito_id where c.cliente_id = v_cli) p), '[]'::json));
end $$;
revoke all on function public.historial_solicitud(integer) from public, anon;
grant execute on function public.historial_solicitud(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Permisos por persona (excepciones a los de su cargo)
-- ---------------------------------------------------------------------------
create table if not exists public.permisos_usuario (
  usuario uuid not null references auth.users (id) on delete cascade,
  permiso text not null,
  permitido boolean not null,
  actualizado timestamptz not null default now(),
  actualizado_por uuid references auth.users (id),
  primary key (usuario, permiso)
);
alter table public.permisos_usuario enable row level security;
drop policy if exists leer on public.permisos_usuario;
create policy leer on public.permisos_usuario for select to authenticated
  using (usuario = auth.uid() or public.mi_rol() in ('dueno', 'soporte'));
drop policy if exists decidir on public.permisos_usuario;
create policy decidir on public.permisos_usuario for all to authenticated
  using (public.mi_rol() in ('dueno', 'soporte')
         and (select rol from public.perfiles where id = usuario) not in ('dueno', 'soporte'))
  with check (public.mi_rol() in ('dueno', 'soporte')
         and (select rol from public.perfiles where id = usuario) not in ('dueno', 'soporte'));
grant select, insert, update, delete on public.permisos_usuario to authenticated;
revoke all on public.permisos_usuario from anon;

create or replace function public.tiene_permiso(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when public.mi_rol() in ('dueno', 'soporte') then true
              when public.mi_rol() is null then false
              else coalesce((select permitido from public.permisos_usuario where usuario = auth.uid() and permiso = p),
                            (select permitido from public.permisos where rol = public.mi_rol() and permiso = p), false) end;
$$;

-- Cada cargo con sus funciones (sólo donde el dueño todavía no cambió nada a mano)
update public.permisos set permitido = (permiso in ('ver_solicitudes', 'resolver_solicitudes')), actualizado = now()
 where rol = 'mesa' and actualizado_por is null;
update public.permisos set permitido = false, actualizado = now()
 where rol = 'asesor' and permiso in ('ver_solicitudes', 'resolver_solicitudes', 'autorizar_excepciones', 'reasignar_cartera') and actualizado_por is null;

-- ---------------------------------------------------------------------------
-- 4. Más datos del cliente: sexo, correo, teléfono adicional y referencias
-- ---------------------------------------------------------------------------
alter table public.solicitudes add column if not exists sexo text check (sexo in ('H', 'M', 'X'));
alter table public.solicitudes add column if not exists correo text;
alter table public.solicitudes add column if not exists telefono2 text;
alter table public.solicitudes add column if not exists referencias jsonb;
alter table public.clientes add column if not exists sexo text check (sexo in ('H', 'M', 'X'));
alter table public.clientes add column if not exists correo text;
alter table public.clientes add column if not exists telefono2 text;
alter table public.clientes add column if not exists referencias jsonb;
grant update (cliente_nombre, ruta_id, monto, estado, tipo, curp, fecha_nacimiento, direccion, colonia, telefono, frecuencia,
              celular, observaciones, lat, lng, direccion_negocio, lat_negocio, lng_negocio, sexo, correo, telefono2, referencias)
  on public.solicitudes to authenticated;

-- Al desembolsar, los datos nuevos pasan al expediente del cliente
do $$
declare src text;
begin
  select pg_get_functiondef('public.desembolsar_solicitud(integer, text)'::regprocedure) into src;
  if position('s.referencias' in src) = 0 then
    src := replace(src, 'lat_negocio = coalesce(s.lat_negocio, lat_negocio), lng_negocio = coalesce(s.lng_negocio, lng_negocio)',
      'lat_negocio = coalesce(s.lat_negocio, lat_negocio), lng_negocio = coalesce(s.lng_negocio, lng_negocio), sexo = coalesce(s.sexo, sexo), correo = coalesce(s.correo, correo), telefono2 = coalesce(s.telefono2, telefono2), referencias = coalesce(s.referencias, referencias)');
    src := replace(src, 'celular, observaciones, lat, lng, direccion_negocio, lat_negocio, lng_negocio)
    values',
      'celular, observaciones, lat, lng, direccion_negocio, lat_negocio, lng_negocio, sexo, correo, telefono2, referencias)
    values');
    src := replace(src, 's.celular, s.observaciones, s.lat, s.lng, s.direccion_negocio, s.lat_negocio, s.lng_negocio)',
      's.celular, s.observaciones, s.lat, s.lng, s.direccion_negocio, s.lat_negocio, s.lng_negocio, s.sexo, s.correo, s.telefono2, s.referencias)');
    if position('s.referencias)' in src) = 0 or position('referencias = coalesce' in src) = 0 then
      raise exception 'No se pudo actualizar desembolsar_solicitud: avisa a soporte.';
    end if;
    execute src;
  end if;
end $$;

-- v_cartera con los datos nuevos del cliente
drop view if exists public.v_cartera;
create view public.v_cartera with (security_invoker = true) as
with b as (
  select c.*,
         case c.frecuencia when 'diario' then 1 when 'semanal' then 7 when 'quincenal' then 15 else 30 end as per,
         least(c.num_cuotas, floor((c.total_pagar - c.saldo) / c.cuota + 0.0001))::int as pagadas_calc
  from public.creditos c
), d as (
  select b.*,
         case when b.saldo = 0 then 0
              when b.pagadas_calc >= least(b.num_cuotas, greatest(0, floor((current_date - b.fecha_inicio) / b.per::numeric))) then 0
              else greatest(1, current_date - (b.fecha_inicio + (b.pagadas_calc + 1) * b.per)) end as atraso
  from b
)
select d.id as credito_id, d.monto, d.total_pagar, d.cuota, d.frecuencia, d.num_cuotas,
       d.fecha_inicio, d.pagadas_calc as cuotas_pagadas, d.saldo, d.atraso as dias_atraso, d.ultimo_pago,
       case when d.saldo = 0 then 'liquidado'
            when d.atraso = 0 then 'al_dia'
            when d.atraso <= 7 then 'atrasado'
            when d.atraso <= 30 then 'alto_riesgo'
            else 'vencido' end as estado,
       d.es_demo, d.tipo, d.credito_anterior_id, d.descuento_renovacion,
       coalesce(d.entregado, d.monto - d.descuento_renovacion) as entregado, d.seguro,
       cl.id as cliente_id, cl.codigo, cl.nombre as cliente, cl.colonia, cl.curp, cl.telefono, cl.direccion, cl.fecha_nacimiento,
       cl.celular, cl.observaciones, cl.lat, cl.lng, cl.direccion_negocio, cl.lat_negocio, cl.lng_negocio, cl.orden_ruta,
       cl.sexo, cl.correo, cl.telefono2, cl.referencias,
       vr.*
from d
join public.clientes cl on cl.id = d.cliente_id
join public.v_rutas vr on vr.ruta_id = cl.ruta_id;
grant select on public.v_cartera to authenticated;
revoke all on public.v_cartera from anon;

-- ---------------------------------------------------------------------------
-- 5. Modalidad diaria preparada (30 pagos, 50 %); el dueño la activa cuando quiera
-- ---------------------------------------------------------------------------
update public.condiciones set num_cuotas = 30, interes_pct = 50
 where gerencia_id is null and frecuencia = 'diario' and actualizado_por is null;
