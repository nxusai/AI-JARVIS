-- Sistema de crédito y cobranza · lo acordado en la reunión del 16 de noviembre (NXUS AI)
--
-- Se corre DESPUÉS de 01, 03 y 04. Se puede volver a correr sin perder nada.
--
--   · Créditos nuevos, renovaciones (al 80 % de pagos) y recompras, con expediente
--     histórico: crédito anterior, descuento de renovación y dinero entregado.
--   · Seguro de gastos administrativos ($150) en todos los créditos: no cambia la
--     deuda del cliente; entra a la caja del asesor.
--   · Registro de pagos desde la ruta; después de las 18:00 cuenta para el día siguiente.
--   · Solicitudes con datos del cliente (CURP), detección de duplicados en toda la
--     empresa y resolución de mesa de control.
--   · Cargo de Tesorería: sólo puede pasar dinero de la caja de un gerente al banco.
--     Retiros del banco (utilidades, aguinaldos) sólo el dueño.
--   · Parámetros editables, proyecciones (metas y logros por oficina), expediente del
--     personal (también de quien se da de baja) y peticiones de mejora.

-- ---------------------------------------------------------------------------
-- Cargo de Tesorería
-- ---------------------------------------------------------------------------
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.perfiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%rol%';
  if c is not null then execute format('alter table public.perfiles drop constraint %I', c); end if;
end $$;
alter table public.perfiles add constraint perfiles_rol_check check (rol in
  ('dueno', 'direccion', 'regional', 'zonal', 'gerente', 'asesor', 'mesa', 'tesoreria', 'consulta', 'soporte'));

-- ---------------------------------------------------------------------------
-- Parámetros del negocio (los cambia el administrador)
-- ---------------------------------------------------------------------------
create table if not exists public.parametros (
  clave text primary key,
  valor numeric,
  descripcion text not null
);
insert into public.parametros (clave, valor, descripcion) values
  ('seguro_monto', 150, 'Seguro de gastos administrativos por crédito (pesos)'),
  ('renovacion_pct', 80, 'Porcentaje de pagos para poder renovar'),
  ('interes_pct', 50, 'Interés plano del crédito (%)'),
  ('num_cuotas', 10, 'Número de pagos del crédito'),
  ('comision_nuevo', null, 'Comisión fija por cliente nuevo (pesos)'),
  ('comision_renovacion_pct', null, 'Comisión por renovación (% del dinero entregado)'),
  ('atraso_dias', 1, 'Días de atraso a partir de los que un crédito cuenta como atrasado'),
  ('meta_normalidad', 90, 'Meta de normalidad (%)')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- Clientes y créditos: datos para el expediente
-- ---------------------------------------------------------------------------
alter table public.clientes add column if not exists curp text;
alter table public.clientes add column if not exists fecha_nacimiento date;
alter table public.clientes add column if not exists direccion text;
create unique index if not exists clientes_curp_uk on public.clientes (upper(curp)) where curp is not null;

alter table public.creditos add column if not exists tipo text not null default 'nuevo';
alter table public.creditos add column if not exists credito_anterior_id integer references public.creditos (id);
alter table public.creditos add column if not exists descuento_renovacion numeric(12,2) not null default 0;
alter table public.creditos add column if not exists entregado numeric(12,2);
alter table public.creditos add column if not exists seguro numeric(12,2) not null default 0;
alter table public.creditos add column if not exists solicitud_id integer;
alter table public.creditos add column if not exists creado_por uuid references auth.users (id);
do $$ begin
  alter table public.creditos add constraint creditos_tipo_check check (tipo in ('nuevo', 'renovacion', 'recompra'));
exception when duplicate_object then null; end $$;

alter table public.pagos add column if not exists tipo text not null default 'cuota';
alter table public.pagos add column if not exists registrado_por uuid references auth.users (id);
alter table public.pagos add column if not exists creado timestamptz not null default now();
do $$ begin
  alter table public.pagos add constraint pagos_tipo_check check (tipo in ('cuota', 'liquidacion_renovacion'));
exception when duplicate_object then null; end $$;

-- Identificadores automáticos
do $$
declare t text;
begin
  foreach t in array array['clientes', 'creditos', 'solicitudes'] loop
    execute format('create sequence if not exists public.%I_id_seq as integer owned by public.%I.id', t, t);
    execute format('alter table public.%I alter column id set default nextval(%L)', t, 'public.' || t || '_id_seq');
    execute format('select setval(%L, greatest(coalesce((select max(id) from public.%I), 0), 1))', 'public.' || t || '_id_seq', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Solicitudes completas (se guardan también las que no se concretaron)
-- ---------------------------------------------------------------------------
alter table public.solicitudes add column if not exists tipo text not null default 'nuevo';
alter table public.solicitudes add column if not exists curp text;
alter table public.solicitudes add column if not exists fecha_nacimiento date;
alter table public.solicitudes add column if not exists direccion text;
alter table public.solicitudes add column if not exists colonia text;
alter table public.solicitudes add column if not exists telefono text;
alter table public.solicitudes add column if not exists frecuencia text not null default 'semanal';
alter table public.solicitudes add column if not exists cliente_id integer references public.clientes (id);
alter table public.solicitudes add column if not exists credito_anterior_id integer references public.creditos (id);
alter table public.solicitudes add column if not exists credito_id integer references public.creditos (id);
alter table public.solicitudes add column if not exists motivo text;
alter table public.solicitudes add column if not exists creado_por uuid references auth.users (id);
alter table public.solicitudes add column if not exists revisado_por uuid references auth.users (id);
alter table public.solicitudes add column if not exists revisado timestamptz;
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.solicitudes'::regclass and contype = 'c'
             and (pg_get_constraintdef(oid) like '%estado%' or pg_get_constraintdef(oid) like '%tipo%') loop
    execute format('alter table public.solicitudes drop constraint %I', c);
  end loop;
end $$;
alter table public.solicitudes add constraint solicitudes_estado_check
  check (estado in ('borrador', 'revision', 'observada', 'aprobada', 'rechazada', 'cancelada'));
alter table public.solicitudes add constraint solicitudes_tipo_check check (tipo in ('nuevo', 'renovacion', 'recompra'));

-- ---------------------------------------------------------------------------
-- Proyecciones, personal y peticiones
-- ---------------------------------------------------------------------------
create table if not exists public.proyecciones (
  id bigint generated always as identity primary key,
  fecha date not null,
  oficina_id smallint not null references public.oficinas (id),
  meta_cobro numeric(14,2),
  meta_colocacion numeric(14,2),
  logro_cobro numeric(14,2),
  logro_colocacion numeric(14,2),
  capturado_por uuid references auth.users (id),
  actualizado timestamptz not null default now(),
  es_demo boolean not null default false,
  unique (fecha, oficina_id)
);

create table if not exists public.personal (
  id integer generated by default as identity primary key,
  nombre text not null,
  puesto text not null,
  ambito text,
  curp text,
  fecha_nacimiento date,
  direccion text,
  telefono text,
  correo text,
  foto_path text,
  fecha_ingreso date,
  fecha_baja date,
  motivo_baja text,
  perfil_id uuid references auth.users (id),
  es_demo boolean not null default false
);

create table if not exists public.peticiones (
  id bigint generated always as identity primary key,
  creado_por uuid not null default auth.uid() references auth.users (id),
  nombre text,
  seccion text,
  texto text not null check (length(texto) between 3 and 4000),
  estado text not null default 'nueva' check (estado in ('nueva', 'en_proceso', 'lista', 'descartada')),
  creado timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Vistas: el atraso se calcula al día de hoy (no se queda congelado)
-- ---------------------------------------------------------------------------
drop view if exists public.v_cartera;
create view public.v_cartera with (security_invoker = true) as
with b as (
  select c.*,
         case c.frecuencia when 'semanal' then 7 when 'quincenal' then 15 else 30 end as per,
         least(c.num_cuotas, floor((c.total_pagar - c.saldo) / c.cuota + 0.0001))::int as pagadas_calc
  from public.creditos c
), d as (
  select b.*,
         least(b.num_cuotas, greatest(0, floor((current_date - b.fecha_inicio) / b.per::numeric)))::int as esperadas,
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
       vr.*
from d
join public.clientes cl on cl.id = d.cliente_id
join public.v_rutas vr on vr.ruta_id = cl.ruta_id;

-- Cobranza en efectivo (la liquidación por renovación no es dinero que entre a la caja)
create or replace view public.v_recaudo_diario with (security_invoker = true) as
select p.fecha, cl.ruta_id, sum(p.monto)::numeric(14,2) as monto, count(*) as pagos
from public.pagos p
join public.creditos c on c.id = p.credito_id
join public.clientes cl on cl.id = c.cliente_id
where p.fecha >= current_date - 400 and p.tipo = 'cuota'
group by p.fecha, cl.ruta_id;

-- Pagos por crédito para la historia de normalidad (comparar año contra año) y el expediente
create or replace view public.v_pagos with (security_invoker = true) as
select p.id, p.credito_id, p.fecha, p.monto, p.tipo
from public.pagos p
where p.fecha >= current_date - 800;

grant select on public.v_cartera, public.v_recaudo_diario, public.v_pagos to authenticated;
revoke all on public.v_cartera, public.v_recaudo_diario, public.v_pagos from anon;

-- ---------------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------------
create or replace function public.param(k text) returns numeric
language sql stable security definer set search_path = public as $$
  select valor from public.parametros where clave = k;
$$;

-- Fecha operativa: después de las 18:00 (hora del centro de México) cuenta para mañana
create or replace function public.fecha_operativa() returns date
language sql stable as $$
  select case when (now() at time zone 'America/Mexico_City')::time >= time '18:00'
              then (now() at time zone 'America/Mexico_City')::date + 1
              else (now() at time zone 'America/Mexico_City')::date end;
$$;

-- Pago registrado: la fecha la pone el sistema y el saldo del crédito se actualiza solo
create or replace function public.antes_de_pago() returns trigger
language plpgsql security definer set search_path = public as $$
declare s numeric;
begin
  if auth.uid() is not null then
    new.registrado_por := auth.uid();
    if not public.es_administrador() or new.fecha is null then new.fecha := public.fecha_operativa(); end if;
  end if;
  if new.fecha is null then new.fecha := public.fecha_operativa(); end if;
  select saldo into s from public.creditos where id = new.credito_id for update;
  if s is null then raise exception 'El crédito no existe.'; end if;
  if new.monto > s + 0.01 then raise exception 'El pago (%) es mayor que el saldo del crédito (%).', new.monto, s; end if;
  return new;
end $$;

create or replace function public.despues_de_pago() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.creditos c
     set saldo = greatest(0, round(c.saldo - new.monto, 2)),
         cuotas_pagadas = least(c.num_cuotas, floor((c.total_pagar - greatest(0, c.saldo - new.monto)) / c.cuota + 0.0001))::smallint,
         ultimo_pago = greatest(coalesce(c.ultimo_pago, new.fecha), new.fecha)
   where c.id = new.credito_id;
  return new;
end $$;

drop trigger if exists pago_antes on public.pagos;
drop trigger if exists pago_despues on public.pagos;
create trigger pago_antes before insert on public.pagos for each row execute function public.antes_de_pago();
create trigger pago_despues after insert on public.pagos for each row execute function public.despues_de_pago();

create or replace function public.unaccent_simple(t text) returns text
language sql immutable as $$
  select translate(coalesce(t, ''), 'áéíóúüÁÉÍÓÚÜñÑ', 'aeiouuAEIOUUnN');
$$;

-- Duplicados en toda la empresa (sin mostrar datos de otras rutas: sólo dónde está)
create or replace function public.buscar_duplicado(p_curp text, p_nombre text)
returns table (origen text, nombre text, ruta text, estado text, saldo numeric)
language sql stable security definer set search_path = public as $$
  select 'cliente', cl.nombre, r.nombre,
         case when exists (select 1 from public.creditos c where c.cliente_id = cl.id and c.saldo > 0) then 'con crédito activo' else 'sin crédito activo' end,
         (select coalesce(sum(c.saldo), 0) from public.creditos c where c.cliente_id = cl.id)
  from public.clientes cl join public.rutas r on r.id = cl.ruta_id
  where public.usuario_activo()
    and ((nullif(trim(p_curp), '') is not null and upper(cl.curp) = upper(trim(p_curp)))
      or (nullif(trim(p_nombre), '') is not null and lower(unaccent_simple(cl.nombre)) = lower(unaccent_simple(trim(p_nombre)))))
  union all
  select 'solicitud', s.cliente_nombre, r.nombre, s.estado, null
  from public.solicitudes s join public.rutas r on r.id = s.ruta_id
  where public.usuario_activo() and s.estado in ('borrador', 'revision', 'observada', 'rechazada', 'cancelada')
    and ((nullif(trim(p_curp), '') is not null and upper(s.curp) = upper(trim(p_curp)))
      or (nullif(trim(p_nombre), '') is not null and lower(unaccent_simple(s.cliente_nombre)) = lower(unaccent_simple(trim(p_nombre)))))
  limit 10;
$$;


-- Mesa de control: aprobar, observar, rechazar o cancelar. Al aprobar se crea el
-- crédito con la fórmula vigente, el seguro y, si es renovación, se liquida el anterior.
create or replace function public.resolver_solicitud(p_id integer, p_estado text, p_motivo text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  s public.solicitudes;
  ant public.creditos;
  v_cliente integer;
  v_credito integer;
  v_desc numeric := 0;
  v_int numeric := coalesce(public.param('interes_pct'), 50);
  v_n integer := coalesce(public.param('num_cuotas'), 10)::int;
  v_seg numeric := coalesce(public.param('seguro_monto'), 150);
  v_fecha date := public.fecha_operativa();
begin
  if coalesce(public.mi_rol(), '') not in ('mesa', 'dueno', 'direccion', 'soporte') then
    raise exception 'Sólo mesa de control o dirección pueden resolver solicitudes.';
  end if;
  if p_estado not in ('revision', 'observada', 'aprobada', 'rechazada', 'cancelada') then raise exception 'Estado no válido.'; end if;
  select * into s from public.solicitudes where id = p_id for update;
  if s.id is null then raise exception 'La solicitud no existe.'; end if;
  if s.estado in ('aprobada', 'rechazada', 'cancelada') then raise exception 'La solicitud ya fue resuelta.'; end if;
  if p_estado in ('observada', 'rechazada', 'cancelada') and nullif(trim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Escribe el motivo.';
  end if;

  if p_estado = 'aprobada' then
    if s.credito_anterior_id is not null then
      select * into ant from public.creditos where id = s.credito_anterior_id for update;
      v_cliente := (select cliente_id from public.creditos where id = s.credito_anterior_id);
      if s.tipo = 'renovacion' then
        if ant.saldo > 0 and (ant.total_pagar - ant.saldo) < ant.total_pagar * coalesce(public.param('renovacion_pct'), 80) / 100 - 0.01 then
          raise exception 'El crédito anterior todavía no llega al % por ciento de sus pagos.', coalesce(public.param('renovacion_pct'), 80);
        end if;
        v_desc := ant.saldo;
      end if;
    elsif s.cliente_id is not null then
      v_cliente := s.cliente_id;
    else
      insert into public.clientes (codigo, nombre, ruta_id, colonia, telefono, curp, fecha_nacimiento, direccion)
      values ('C-' || lpad(nextval('public.clientes_id_seq')::text, 5, '0'), s.cliente_nombre, s.ruta_id, s.colonia, s.telefono,
              nullif(upper(trim(coalesce(s.curp, ''))), ''), s.fecha_nacimiento, s.direccion)
      returning id into v_cliente;
    end if;
    if v_desc >= s.monto then raise exception 'El saldo anterior (%) es mayor que el nuevo crédito.', v_desc; end if;

    insert into public.creditos (cliente_id, monto, total_pagar, cuota, frecuencia, num_cuotas, fecha_inicio, saldo,
                                 tipo, credito_anterior_id, descuento_renovacion, entregado, seguro, solicitud_id, creado_por)
    values (v_cliente, s.monto, round(s.monto * (1 + v_int / 100), 2), round(s.monto * (1 + v_int / 100) / v_n, 2), s.frecuencia, v_n, v_fecha,
            round(s.monto * (1 + v_int / 100), 2), s.tipo, s.credito_anterior_id, v_desc, s.monto - v_desc, v_seg, s.id, auth.uid())
    returning id into v_credito;

    if v_desc > 0 then
      insert into public.pagos (credito_id, fecha, monto, tipo) values (s.credito_anterior_id, v_fecha, v_desc, 'liquidacion_renovacion');
    end if;
    if v_seg > 0 then
      insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, creado_por)
      values (v_fecha, 'ingreso', 'externo', 'ruta:' || s.ruta_id, 'Seguro', 'Seguro de gastos administrativos · crédito #' || v_credito, v_seg, auth.uid());
    end if;
  end if;

  update public.solicitudes
     set estado = p_estado, motivo = coalesce(nullif(trim(coalesce(p_motivo, '')), ''), motivo),
         revisado_por = auth.uid(), revisado = now(), credito_id = coalesce(v_credito, credito_id)
   where id = p_id;
  return v_credito;
end $$;

revoke all on function public.resolver_solicitud(integer, text, text), public.buscar_duplicado(text, text) from public, anon;
grant execute on function public.resolver_solicitud(integer, text, text), public.buscar_duplicado(text, text), public.param(text), public.fecha_operativa() to authenticated;

-- ---------------------------------------------------------------------------
-- Candados
-- ---------------------------------------------------------------------------
alter table public.parametros enable row level security;
alter table public.proyecciones enable row level security;
alter table public.personal enable row level security;
alter table public.peticiones enable row level security;

drop policy if exists leer on public.parametros;
create policy leer on public.parametros for select to authenticated using (public.usuario_activo());
drop policy if exists editar_admin on public.parametros;
create policy editar_admin on public.parametros for update to authenticated using (public.es_administrador()) with check (public.es_administrador());

-- Pagos: el asesor (y sus jefes) registran en las rutas de su ámbito
drop policy if exists registrar_pago on public.pagos;
create policy registrar_pago on public.pagos for insert to authenticated
  with check (tipo = 'cuota'
    and coalesce(public.mi_rol(), '') in ('asesor', 'gerente', 'zonal', 'regional', 'dueno', 'direccion', 'soporte')
    and credito_id in (select c.id from public.creditos c join public.clientes cl on cl.id = c.cliente_id
                       where cl.ruta_id in (select public.mis_rutas())));

-- Solicitudes: el asesor y sus jefes capturan en su ámbito; las resuelve mesa de control
drop policy if exists capturar_solicitud on public.solicitudes;
create policy capturar_solicitud on public.solicitudes for insert to authenticated
  with check (estado in ('borrador', 'revision')
    and coalesce(public.mi_rol(), '') in ('asesor', 'gerente', 'zonal', 'regional', 'dueno', 'direccion', 'soporte')
    and ruta_id in (select public.mis_rutas()));
drop policy if exists corregir_solicitud on public.solicitudes;
create policy corregir_solicitud on public.solicitudes for update to authenticated
  using (estado in ('borrador', 'observada') and ruta_id in (select public.mis_rutas())
         and coalesce(public.mi_rol(), '') in ('asesor', 'gerente', 'zonal', 'regional', 'dueno', 'direccion', 'soporte'))
  with check (estado in ('borrador', 'revision') and ruta_id in (select public.mis_rutas()));
-- Mesa de control ve todas las solicitudes (para revisarlas) aunque su ámbito sea otro
drop policy if exists leer_mesa on public.solicitudes;
create policy leer_mesa on public.solicitudes for select to authenticated using (public.mi_rol() = 'mesa');

-- Tesorería: altas de movimientos
drop policy if exists alta_admin on public.movimientos_tesoreria;
create policy alta_admin on public.movimientos_tesoreria for insert to authenticated
  with check (public.es_administrador()
    and (not (caja_origen like 'banco:%' and caja_destino = 'externo') or public.mi_rol() in ('dueno', 'soporte')));
drop policy if exists alta_tesoreria on public.movimientos_tesoreria;
create policy alta_tesoreria on public.movimientos_tesoreria for insert to authenticated
  with check (public.mi_rol() = 'tesoreria' and tipo = 'deposito' and caja_origen like 'gerencia:%' and caja_destino like 'banco:%');
drop policy if exists alta_gastos_ruta on public.movimientos_tesoreria;
create policy alta_gastos_ruta on public.movimientos_tesoreria for insert to authenticated
  with check (coalesce(public.mi_rol(), '') in ('asesor', 'gerente') and tipo = 'egreso' and caja_destino = 'externo'
    and caja_origen in (select public.mis_cajas()));

-- Proyecciones: las captura el gerente de esa oficina (o sus jefes y la dirección)
drop policy if exists leer_ambito on public.proyecciones;
create policy leer_ambito on public.proyecciones for select to authenticated
  using (oficina_id in (select n.id from public.mis_nodos() n where n.nivel = 'oficina'));
drop policy if exists capturar on public.proyecciones;
create policy capturar on public.proyecciones for insert to authenticated
  with check (coalesce(public.mi_rol(), '') in ('gerente', 'zonal', 'regional', 'dueno', 'direccion', 'soporte')
    and oficina_id in (select n.id from public.mis_nodos() n where n.nivel = 'oficina'));
drop policy if exists actualizar on public.proyecciones;
create policy actualizar on public.proyecciones for update to authenticated
  using (coalesce(public.mi_rol(), '') in ('gerente', 'zonal', 'regional', 'dueno', 'direccion', 'soporte')
    and oficina_id in (select n.id from public.mis_nodos() n where n.nivel = 'oficina'))
  with check (oficina_id in (select n.id from public.mis_nodos() n where n.nivel = 'oficina'));

-- Personal: datos personales, sólo administradores. Nadie los borra (auditorías de 6 años).
drop policy if exists admin_leer on public.personal;
create policy admin_leer on public.personal for select to authenticated using (public.es_administrador());
drop policy if exists admin_alta on public.personal;
create policy admin_alta on public.personal for insert to authenticated with check (public.es_administrador());
drop policy if exists admin_editar on public.personal;
create policy admin_editar on public.personal for update to authenticated using (public.es_administrador()) with check (public.es_administrador());

-- Usuarios: sólo soporte o el dueño pueden dar el cargo de dueño
drop policy if exists editar_perfiles on public.perfiles;
create policy editar_perfiles on public.perfiles for update to authenticated
  using (public.es_administrador() and id <> auth.uid() and (rol <> 'soporte' or public.mi_rol() = 'soporte')
         and (rol <> 'dueno' or public.mi_rol() in ('dueno', 'soporte')))
  with check (public.es_administrador() and rol <> 'soporte' and (rol <> 'dueno' or public.mi_rol() in ('dueno', 'soporte')));

-- Peticiones de mejora: cualquiera manda; las ve quien las mandó, el dueño y soporte
drop policy if exists mandar on public.peticiones;
create policy mandar on public.peticiones for insert to authenticated
  with check (public.usuario_activo() and creado_por = auth.uid());
drop policy if exists leer on public.peticiones;
create policy leer on public.peticiones for select to authenticated
  using (creado_por = auth.uid() or public.mi_rol() in ('dueno', 'soporte'));
drop policy if exists atender on public.peticiones;
create policy atender on public.peticiones for update to authenticated
  using (public.mi_rol() = 'soporte') with check (public.mi_rol() = 'soporte');

-- La dirección ve los créditos con mayor detalle para auditoría (sin cambios de lectura)
grant select, insert, update on public.parametros, public.proyecciones, public.personal, public.peticiones to authenticated;
revoke all on public.parametros, public.proyecciones, public.personal, public.peticiones from anon;
grant usage on sequence public.solicitudes_id_seq to authenticated;
