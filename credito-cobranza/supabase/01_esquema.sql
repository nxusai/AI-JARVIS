-- Sistema de crédito y cobranza · esquema base (NXUS AI)
--
-- Se pega en Supabase → SQL Editor → Run. Se puede volver a correr completo sin
-- perder nada (así se aplican mejoras).
--
-- Las reglas de acceso viven aquí, en la base de datos, no en la página:
-- aunque alguien se brincara la página, la base de datos no le entrega nada si
-- no inició sesión con un usuario activo.
--
-- Estructura: Región → Zona → Gerencia → Oficina → Ruta → Clientes → Créditos.
-- Los registros con es_demo = true son datos de ejemplo y se borran con
-- 99_borrar_demo.sql antes de importar la información real.

-- ---------------------------------------------------------------------------
-- Estructura organizativa
-- ---------------------------------------------------------------------------
create table if not exists public.regiones (
  id smallint primary key,
  nombre text not null,
  responsable text,
  es_demo boolean not null default false
);

create table if not exists public.zonas (
  id smallint primary key,
  region_id smallint not null references public.regiones (id),
  nombre text not null,
  responsable text,            -- zonal
  es_demo boolean not null default false
);

create table if not exists public.gerencias (
  id smallint primary key,
  zona_id smallint not null references public.zonas (id),
  nombre text not null,
  responsable text,            -- gerente
  es_demo boolean not null default false
);

create table if not exists public.oficinas (
  id smallint primary key,
  gerencia_id smallint not null references public.gerencias (id),
  nombre text not null,
  es_demo boolean not null default false
);

create table if not exists public.rutas (
  id smallint primary key,
  oficina_id smallint not null references public.oficinas (id),
  nombre text not null,
  responsable text,            -- asesor / cobrador
  es_demo boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Clientes, créditos, pagos y solicitudes
-- ---------------------------------------------------------------------------
create table if not exists public.clientes (
  id integer primary key,
  codigo text not null unique,
  nombre text not null,
  ruta_id smallint not null references public.rutas (id),
  colonia text,
  telefono text,
  creado date not null default current_date,
  es_demo boolean not null default false
);

create table if not exists public.creditos (
  id integer primary key,
  cliente_id integer not null references public.clientes (id),
  monto numeric(12,2) not null check (monto > 0),
  total_pagar numeric(12,2) not null check (total_pagar >= monto),
  cuota numeric(12,2) not null check (cuota > 0),
  frecuencia text not null check (frecuencia in ('semanal', 'quincenal', 'mensual')),
  num_cuotas smallint not null check (num_cuotas > 0),
  fecha_inicio date not null,
  cuotas_pagadas smallint not null default 0,
  saldo numeric(12,2) not null check (saldo >= 0),
  dias_atraso smallint not null default 0 check (dias_atraso >= 0),
  ultimo_pago date,
  es_demo boolean not null default false
);
create index if not exists creditos_cliente_idx on public.creditos (cliente_id);

create table if not exists public.pagos (
  id bigint generated always as identity primary key,
  credito_id integer not null references public.creditos (id) on delete cascade,
  fecha date not null,
  monto numeric(12,2) not null check (monto > 0),
  es_demo boolean not null default false
);
create index if not exists pagos_fecha_idx on public.pagos (fecha);
create index if not exists pagos_credito_idx on public.pagos (credito_id);

create table if not exists public.solicitudes (
  id integer primary key,
  cliente_nombre text not null,
  ruta_id smallint not null references public.rutas (id),
  monto numeric(12,2) not null,
  estado text not null check (estado in ('borrador', 'revision', 'observada', 'aprobada', 'rechazada')),
  creada date not null default current_date,
  es_demo boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Usuarios del sistema
-- ---------------------------------------------------------------------------
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  rol text not null default 'consulta' check (rol in
    ('dueno', 'direccion', 'regional', 'zonal', 'gerente', 'asesor', 'mesa', 'consulta', 'soporte')),
  activo boolean not null default false,
  -- Cuenta de soporte del proveedor: no se lista a los empleados, pero el dueño la ve
  -- y la puede desactivar; sus acciones quedan en la bitácora como las de todos.
  visible_empleados boolean not null default true,
  creado timestamptz not null default now()
);

-- El primer usuario que se registra queda como dueño activo; los siguientes
-- entran inactivos hasta que el dueño los active.
create or replace function public.nuevo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, nombre, rol, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.perfiles) then 'consulta' else 'dueno' end,
    not exists (select 1 from public.perfiles)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.nuevo_perfil();

-- Usuarios creados antes de correr este archivo.
insert into public.perfiles (id, nombre, rol, activo)
select u.id, split_part(u.email, '@', 1),
       case when row_number() over (order by u.created_at) = 1 and not exists (select 1 from public.perfiles) then 'dueno' else 'consulta' end,
       row_number() over (order by u.created_at) = 1 and not exists (select 1 from public.perfiles)
from auth.users u
on conflict (id) do nothing;

create or replace function public.usuario_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo);
$$;

-- ---------------------------------------------------------------------------
-- Candados (Row Level Security): sólo usuarios con sesión y perfil activo leen.
-- Por ahora nadie escribe desde la página; las altas llegarán con sus reglas.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['regiones','zonas','gerencias','oficinas','rutas','clientes','creditos','pagos','solicitudes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists leer_activos on public.%I', t);
    execute format('create policy leer_activos on public.%I for select to authenticated using (public.usuario_activo())', t);
  end loop;
end $$;

create or replace function public.es_administrador() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and activo and rol in ('dueno', 'soporte'));
$$;

alter table public.perfiles enable row level security;
drop policy if exists ver_mi_perfil on public.perfiles;
create policy ver_mi_perfil on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_administrador());

-- ---------------------------------------------------------------------------
-- Vistas para la página (respetan los candados de las tablas)
-- ---------------------------------------------------------------------------
create or replace view public.v_rutas with (security_invoker = true) as
select r.id as ruta_id, r.nombre as ruta, r.responsable as asesor,
       o.id as oficina_id, o.nombre as oficina,
       g.id as gerencia_id, g.nombre as gerencia, g.responsable as gerente,
       z.id as zona_id, z.nombre as zona, z.responsable as zonal,
       rg.id as region_id, rg.nombre as region, rg.responsable as regional
from public.rutas r
join public.oficinas o on o.id = r.oficina_id
join public.gerencias g on g.id = o.gerencia_id
join public.zonas z on z.id = g.zona_id
join public.regiones rg on rg.id = z.region_id;

-- Estados de cartera (criterio provisional, por confirmar con el cliente):
-- al día 0 días · atrasado 1–7 · alto riesgo 8–30 · vencido +30 · liquidado saldo 0
drop view if exists public.v_cartera;
create view public.v_cartera with (security_invoker = true) as
select c.id as credito_id, c.monto, c.total_pagar, c.cuota, c.frecuencia, c.num_cuotas,
       c.fecha_inicio, c.cuotas_pagadas, c.saldo, c.dias_atraso, c.ultimo_pago,
       case when c.saldo = 0 then 'liquidado'
            when c.dias_atraso = 0 then 'al_dia'
            when c.dias_atraso <= 7 then 'atrasado'
            when c.dias_atraso <= 30 then 'alto_riesgo'
            else 'vencido' end as estado,
       c.es_demo,
       cl.id as cliente_id, cl.codigo, cl.nombre as cliente, cl.colonia,
       vr.*
from public.creditos c
join public.clientes cl on cl.id = c.cliente_id
join public.v_rutas vr on vr.ruta_id = cl.ruta_id;

create or replace view public.v_recaudo_diario with (security_invoker = true) as
select p.fecha, cl.ruta_id, sum(p.monto)::numeric(14,2) as monto, count(*) as pagos
from public.pagos p
join public.creditos c on c.id = p.credito_id
join public.clientes cl on cl.id = c.cliente_id
where p.fecha >= current_date - 400
group by p.fecha, cl.ruta_id;

grant select on public.v_rutas, public.v_cartera, public.v_recaudo_diario to authenticated;
revoke all on public.v_rutas, public.v_cartera, public.v_recaudo_diario from anon;
