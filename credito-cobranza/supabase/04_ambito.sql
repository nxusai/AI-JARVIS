-- Sistema de crédito y cobranza · candados por ámbito (NXUS AI)
--
-- Se corre DESPUÉS de 01_esquema.sql y 03_tesoreria_y_altas.sql. Se puede volver
-- a correr sin perder nada.
--
-- Cada usuario ve sólo su parte de la empresa (su "ámbito"): el punto del árbol
-- región → zona → gerencia → oficina → ruta que le asignó el administrador, y todo
-- lo que cuelga de él. La regla vive aquí, en la base de datos: aunque alguien se
-- brinque la página, el servidor no le entrega información de otras rutas.
--
--   Dueño, dirección y soporte ......... siempre toda la empresa
--   Cuentas bancarias .................. sólo usuarios con ámbito "toda la empresa"
--   Movimientos de tesorería ........... sólo los que tocan una caja de su ámbito
--   Usuario con ámbito que no existe ... no ve nada

-- ---------------------------------------------------------------------------
-- Funciones de apoyo (se ejecutan con permisos del sistema para poder leer el
-- árbol completo sin volver a pasar por los candados)
-- ---------------------------------------------------------------------------
create or replace function public.mi_ambito() returns text
language sql stable security definer set search_path = public as $$
  select case when rol in ('dueno', 'direccion', 'soporte') then 'empresa' else ambito end
  from public.perfiles where id = auth.uid() and activo;
$$;

create or replace function public.ve_empresa() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_ambito() = 'empresa', false);
$$;

-- Todos los puntos del árbol que el usuario puede ver: su ámbito, lo que cuelga
-- de él y los niveles de arriba (sólo para mostrar los nombres de su camino).
create or replace function public.mis_nodos() returns table (nivel text, id smallint)
language sql stable security definer set search_path = public as $$
  with a as (select public.mi_ambito() as amb),
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

-- Sólo las rutas que cuelgan del ámbito (sin los niveles de arriba).
create or replace function public.mis_rutas() returns setof smallint
language sql stable security definer set search_path = public as $$
  select id from public.mis_nodos() where nivel = 'ruta';
$$;

-- Cajas de tesorería del ámbito: rutas, gerencias y oficinas que cuelgan de él.
-- Los niveles de arriba no cuentan: un gerente no ve la caja de su zona.
create or replace function public.mis_cajas() returns setof text
language sql stable security definer set search_path = public as $$
  with a as (select public.mi_ambito() as amb)
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

revoke all on function public.mi_ambito(), public.ve_empresa(), public.mis_nodos(), public.mis_rutas(), public.mis_cajas() from public, anon;
grant execute on function public.mi_ambito(), public.ve_empresa(), public.mis_nodos(), public.mis_rutas(), public.mis_cajas() to authenticated;

-- ---------------------------------------------------------------------------
-- Candados de lectura (reemplazan "leer_activos", que dejaba ver todo)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['regiones','zonas','gerencias','oficinas','rutas','clientes','creditos','pagos','solicitudes','cuentas_bancarias','movimientos_tesoreria'] loop
    execute format('drop policy if exists leer_activos on public.%I', t);
    execute format('drop policy if exists leer_ambito on public.%I', t);
  end loop;
end $$;

create policy leer_ambito on public.regiones for select to authenticated
  using (id in (select n.id from public.mis_nodos() n where n.nivel = 'region'));
create policy leer_ambito on public.zonas for select to authenticated
  using (id in (select n.id from public.mis_nodos() n where n.nivel = 'zona'));
create policy leer_ambito on public.gerencias for select to authenticated
  using (id in (select n.id from public.mis_nodos() n where n.nivel = 'gerencia'));
create policy leer_ambito on public.oficinas for select to authenticated
  using (id in (select n.id from public.mis_nodos() n where n.nivel = 'oficina'));
create policy leer_ambito on public.rutas for select to authenticated
  using (id in (select public.mis_rutas()));

create policy leer_ambito on public.clientes for select to authenticated
  using (ruta_id in (select public.mis_rutas()));
create policy leer_ambito on public.solicitudes for select to authenticated
  using (ruta_id in (select public.mis_rutas()));
create policy leer_ambito on public.creditos for select to authenticated
  using (cliente_id in (select cl.id from public.clientes cl where cl.ruta_id in (select public.mis_rutas())));
create policy leer_ambito on public.pagos for select to authenticated
  using (credito_id in (select c.id from public.creditos c join public.clientes cl on cl.id = c.cliente_id
                        where cl.ruta_id in (select public.mis_rutas())));

create policy leer_ambito on public.cuentas_bancarias for select to authenticated
  using ((select public.ve_empresa()));
create policy leer_ambito on public.movimientos_tesoreria for select to authenticated
  using ((select public.ve_empresa())
         or caja_origen in (select public.mis_cajas())
         or caja_destino in (select public.mis_cajas()));
