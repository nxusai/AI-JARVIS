-- Sistema de crédito y cobranza · peticiones del dueño (27 nov) (NXUS AI)
--
-- Se corre DESPUÉS de 12_bitacora.sql. Se puede volver a correr sin perder nada.
--
--  1. Meta de normalidad 95 %.
--  2. Gastos: sólo tesorería los registra (y el dueño) y siempre salen de la caja de un gerente.
--  3. Gestiones de cobranza y promesas de pago.
--  4. Cancelar un pago (por error) y revertir un desembolso (el cliente ya no quiso), con su motivo.
--  5. Contrato firmado obligatorio junto con el video al desembolsar.
--  6. Captura: ingresos y gastos del cliente, 4 referencias (2 obligatorias) y documentos
--     obligatorios antes de enviar a mesa de control.
--  7. Comisiones: por cobranza (% de lo cobrado) y distintas por oficina si el dueño quiere.

-- ---------------------------------------------------------------------------
-- 1. Meta de normalidad
-- ---------------------------------------------------------------------------
update public.parametros set valor = 95 where clave = 'meta_normalidad' and valor = 90;

-- ---------------------------------------------------------------------------
-- 2. Gastos: los hace tesorería, desde la caja del gerente
-- ---------------------------------------------------------------------------
update public.permisos set permitido = false where rol in ('asesor', 'gerente', 'direccion') and permiso = 'registrar_gastos' and actualizado_por is null;
update public.permisos set permitido = true where rol = 'tesoreria' and permiso = 'registrar_gastos' and actualizado_por is null;
insert into public.permisos (rol, permiso, permitido) values ('tesoreria', 'registrar_gastos', true) on conflict do nothing;
drop policy if exists alta_gastos_ruta on public.movimientos_tesoreria;
create policy alta_gastos_ruta on public.movimientos_tesoreria for insert to authenticated
  with check (public.tiene_permiso('registrar_gastos') and tipo = 'egreso' and caja_destino = 'externo'
    and caja_origen like 'gerencia:%' and caja_origen in (select public.mis_cajas()));

-- Permisos nuevos (por omisión sólo los tiene el dueño; él decide a quién más dárselos)
insert into public.permisos (rol, permiso, permitido)
select r, p, false from unnest(array['direccion','regional','zonal','gerente','asesor','mesa','tesoreria','consulta']) r,
       unnest(array['cancelar_pagos','revertir_desembolsos']) p
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Gestiones de cobranza y promesas de pago
-- ---------------------------------------------------------------------------
create table if not exists public.gestiones (
  id bigint generated always as identity primary key,
  credito_id integer not null references public.creditos (id) on delete cascade,
  tipo text not null check (tipo in ('no_estaba', 'no_tiene', 'promesa', 'otro')),
  nota text check (nota is null or length(nota) <= 1000),
  promesa_fecha date,
  promesa_hora time,
  promesa_monto numeric(12, 2) check (promesa_monto is null or promesa_monto > 0),
  creado_por uuid not null default auth.uid() references auth.users (id),
  creado timestamptz not null default now(),
  es_demo boolean not null default false,
  check (tipo <> 'promesa' or promesa_fecha is not null)
);
create index if not exists gestiones_credito_idx on public.gestiones (credito_id, creado desc);
create index if not exists gestiones_promesa_idx on public.gestiones (promesa_fecha) where tipo = 'promesa';
alter table public.gestiones enable row level security;
drop policy if exists leer on public.gestiones;
create policy leer on public.gestiones for select to authenticated
  using (public.usuario_activo() and exists (select 1 from public.creditos c join public.clientes k on k.id = c.cliente_id
                                             where c.id = credito_id and k.ruta_id in (select public.mis_rutas())));
drop policy if exists registrar on public.gestiones;
create policy registrar on public.gestiones for insert to authenticated
  with check (public.usuario_activo() and creado_por = auth.uid() and public.tiene_permiso('registrar_pagos')
              and exists (select 1 from public.creditos c join public.clientes k on k.id = c.cliente_id
                          where c.id = credito_id and k.ruta_id in (select public.mis_rutas())));
grant select, insert on public.gestiones to authenticated;
revoke all on public.gestiones from anon;

-- ---------------------------------------------------------------------------
-- 4. Cancelar un pago y revertir un desembolso (quedan guardados con su motivo)
-- ---------------------------------------------------------------------------
create table if not exists public.reversos (
  id bigint generated always as identity primary key,
  cuando timestamptz not null default now(),
  usuario uuid default auth.uid(),
  tipo text not null check (tipo in ('pago', 'desembolso')),
  motivo text not null,
  datos jsonb not null
);
alter table public.reversos enable row level security;
drop policy if exists leer on public.reversos;
create policy leer on public.reversos for select to authenticated using (public.mi_rol() in ('dueno', 'direccion', 'soporte'));
grant select on public.reversos to authenticated;
revoke all on public.reversos from anon;

-- Devuelve al saldo de un crédito el monto de un pago que se quitó (lo contrario de registrar el pago)
create or replace function public.devolver_pago(p_credito integer, p_monto numeric) returns void
language sql security definer set search_path = public as $$
  update public.creditos c
     set saldo = least(c.total_pagar, round(c.saldo + p_monto, 2)),
         cuotas_pagadas = greatest(0, floor((c.total_pagar - least(c.total_pagar, c.saldo + p_monto)) / c.cuota + 0.0001))::smallint,
         ultimo_pago = (select max(p.fecha) from public.pagos p where p.credito_id = c.id)
   where c.id = p_credito;
$$;
revoke all on function public.devolver_pago(integer, numeric) from public, anon, authenticated;

create or replace function public.cancelar_pago(p_pago bigint, p_motivo text) returns integer
language plpgsql security definer set search_path = public as $$
declare g public.pagos; r smallint;
begin
  if not public.tiene_permiso('cancelar_pagos') then raise exception 'Tu cargo no puede cancelar pagos.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe el motivo.'; end if;
  select * into g from public.pagos where id = p_pago for update;
  if g.id is null then raise exception 'El pago no existe.'; end if;
  if g.tipo = 'liquidacion_renovacion' then raise exception 'Ese movimiento es la liquidación de una renovación: se quita revirtiendo el desembolso.'; end if;
  select k.ruta_id into r from public.creditos c join public.clientes k on k.id = c.cliente_id where c.id = g.credito_id;
  if r not in (select public.mis_rutas()) then raise exception 'Ese pago no es de tu ámbito.'; end if;
  insert into public.reversos (tipo, motivo, datos) values ('pago', trim(p_motivo), to_jsonb(g));
  delete from public.pagos where id = p_pago;
  perform public.devolver_pago(g.credito_id, g.monto);
  -- En la bitácora queda una sola línea, con el motivo
  delete from public.bitacora where tabla = 'pagos' and registro = g.id::text and accion = 'Pago borrado' and cuando >= now();
  insert into public.bitacora (usuario, accion, tabla, registro, detalle)
  values (auth.uid(), 'Pago cancelado', 'pagos', g.id::text, to_char(g.monto, 'FM$999,999,990.00') || ' del crédito #' || g.credito_id || ' · ' || trim(p_motivo));
  return g.credito_id;
end $$;
revoke all on function public.cancelar_pago(bigint, text) from public, anon;
grant execute on function public.cancelar_pago(bigint, text) to authenticated;

create or replace function public.revertir_desembolso(p_credito integer, p_motivo text) returns integer
language plpgsql security definer set search_path = public as $$
declare c public.creditos; r smallint; s integer;
begin
  if not public.tiene_permiso('revertir_desembolsos') then raise exception 'Tu cargo no puede revertir desembolsos.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe el motivo.'; end if;
  select * into c from public.creditos where id = p_credito for update;
  if c.id is null then raise exception 'El crédito no existe.'; end if;
  select ruta_id into r from public.clientes where id = c.cliente_id;
  if r not in (select public.mis_rutas()) then raise exception 'Ese crédito no es de tu ámbito.'; end if;
  if exists (select 1 from public.pagos where credito_id = c.id) then
    raise exception 'Ese crédito ya tiene pagos: primero cancela sus pagos.';
  end if;
  if exists (select 1 from public.creditos where credito_anterior_id = c.id) then
    raise exception 'Ese crédito ya se renovó: primero revierte la renovación.';
  end if;
  insert into public.reversos (tipo, motivo, datos) values ('desembolso', trim(p_motivo), to_jsonb(c));
  -- Renovación: se quita la liquidación del crédito anterior (vuelve a deber lo que debía)
  if c.credito_anterior_id is not null and coalesce(c.descuento_renovacion, 0) > 0 then
    delete from public.pagos where id = (select id from public.pagos where credito_id = c.credito_anterior_id and tipo = 'liquidacion_renovacion'
                                          and monto = c.descuento_renovacion order by id desc limit 1);
    perform public.devolver_pago(c.credito_anterior_id, c.descuento_renovacion);
    delete from public.bitacora where tabla = 'pagos' and accion = 'Pago borrado' and cuando >= now();
  end if;
  -- Se quitan los gastos administrativos que entraron a la caja por ese crédito
  delete from public.movimientos_tesoreria where categoria in ('Gastos administrativos', 'Seguro') and concepto like '%crédito #' || c.id;
  s := c.solicitud_id;
  update public.solicitudes set estado = 'cancelada', credito_id = null, motivo = 'Desembolso revertido: ' || trim(p_motivo) where id = s;
  delete from public.gestiones where credito_id = c.id;
  delete from public.creditos where id = c.id;
  insert into public.bitacora (usuario, accion, tabla, registro, detalle)
  values (auth.uid(), 'Desembolso revertido', 'creditos', c.id::text, 'Crédito #' || c.id || ' · ' || to_char(c.monto, 'FM$999,999,990') || ' · ' || trim(p_motivo));
  return c.id;
end $$;
revoke all on function public.revertir_desembolso(integer, text) from public, anon;
grant execute on function public.revertir_desembolso(integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5 y 6. Captura completa antes de mesa, y contrato al desembolsar
-- ---------------------------------------------------------------------------
alter table public.solicitudes add column if not exists ingresos jsonb;
alter table public.clientes add column if not exists ingresos jsonb;
grant update (cliente_nombre, ruta_id, monto, estado, tipo, curp, fecha_nacimiento, direccion, colonia, telefono, frecuencia,
              celular, observaciones, lat, lng, direccion_negocio, lat_negocio, lng_negocio, sexo, correo, telefono2, referencias, ingresos)
  on public.solicitudes to authenticated;

-- Documentos que se deben subir antes de mandar a mesa (los mismos que pide la pantalla)
create or replace function public.documentos_obligatorios() returns text[]
language sql immutable as $$
  select array['INE (frente)', 'INE (reverso)', 'Domicilio (frente)', 'Domicilio (lado derecho)', 'Domicilio (lado izquierdo)',
               'Negocio (frente)', 'Negocio (lado derecho)', 'Negocio (lado izquierdo)', 'Negocio interior 1', 'Negocio interior 2',
               'Video del negocio (15 s)', 'Solicitud firmada'];
$$;

create or replace function public.validar_envio_mesa() returns trigger
language plpgsql security definer set search_path = public as $$
declare falta text[]; ref jsonb;
begin
  if new.estado <> 'revision' or (tg_op = 'UPDATE' and old.estado not in ('borrador', 'observada')) then return new; end if;
  -- Referencias 1 y 2 completas
  for i in 0..1 loop
    ref := coalesce(new.referencias, '[]'::jsonb) -> i;
    if ref is null or length(trim(coalesce(ref->>'nombre', ''))) < 3 or length(trim(coalesce(ref->>'parentesco', ''))) < 2
       or length(regexp_replace(coalesce(ref->>'telefono', ''), '\D', '', 'g')) < 10 then
      raise exception 'Faltan datos de la referencia %: nombre completo, parentesco y teléfono a 10 dígitos.', i + 1;
    end if;
  end loop;
  -- Ingresos y gastos del cliente
  if new.ingresos is null or coalesce((new.ingresos->>'ventas')::numeric, 0) <= 0 then
    raise exception 'Falta capturar los ingresos y gastos del cliente.';
  end if;
  -- Documentos obligatorios
  if tg_op = 'INSERT' then raise exception 'Primero guarda la solicitud y sube los documentos; después envíala a mesa de control.'; end if;
  select array_agg(c) into falta from unnest(public.documentos_obligatorios()) c
   where not exists (select 1 from public.documentos d where d.tipo = 'solicitud' and d.entidad_id = new.id and d.categoria = c);
  if falta is not null then raise exception 'Faltan documentos: %.', array_to_string(falta, ', '); end if;
  return new;
end $$;
drop trigger if exists validar_envio_mesa on public.solicitudes;
create trigger validar_envio_mesa before insert or update of estado on public.solicitudes
  for each row execute function public.validar_envio_mesa();

-- El desembolso pide el contrato firmado además del video
do $$
declare d text;
begin
  select pg_get_functiondef('public.desembolsar_solicitud(integer, text)'::regprocedure) into d;
  if position('Contrato firmado' in d) = 0 then
    d := replace(d, $q$    raise exception 'Primero graba y sube el video de entrega del cliente.';
  end if;$q$, $q$    raise exception 'Primero graba y sube el video de entrega del cliente.';
  end if;
  if not exists (select 1 from public.documentos d where d.tipo = 'solicitud' and d.entidad_id = p_id and d.categoria = 'Contrato firmado') then
    raise exception 'Sube también el contrato firmado.';
  end if;$q$);
    if position('Contrato firmado' in d) = 0 then raise exception 'No se encontró dónde agregar la regla del contrato.'; end if;
    execute d;
  end if;
end $$;

-- Los ingresos y gastos pasan al expediente del cliente cuando se desembolsa
create or replace function public.ingresos_a_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ingresos is not null and new.cliente_id is not null then
    update public.clientes set ingresos = new.ingresos where id = new.cliente_id;
  end if;
  return null;
end $$;
drop trigger if exists ingresos_a_cliente on public.solicitudes;
create trigger ingresos_a_cliente after update of estado on public.solicitudes
  for each row when (new.estado = 'desembolsada' and old.estado is distinct from 'desembolsada') execute function public.ingresos_a_cliente();

-- ---------------------------------------------------------------------------
-- 7. Comisiones: por cobranza y por oficina
-- ---------------------------------------------------------------------------
insert into public.parametros (clave, valor, descripcion) values
  ('comision_cobranza_pct', null, 'Comisión por cobranza (% de lo cobrado en el periodo)')
on conflict (clave) do nothing;
create table if not exists public.comisiones_oficina (
  oficina_id smallint primary key references public.oficinas (id) on delete cascade,
  nuevo numeric(12, 2) check (nuevo is null or nuevo >= 0),
  renovacion_pct numeric(6, 2) check (renovacion_pct is null or renovacion_pct between 0 and 100),
  cobranza_pct numeric(6, 2) check (cobranza_pct is null or cobranza_pct between 0 and 100),
  actualizado timestamptz not null default now(),
  actualizado_por uuid default auth.uid()
);
alter table public.comisiones_oficina enable row level security;
drop policy if exists leer on public.comisiones_oficina;
create policy leer on public.comisiones_oficina for select to authenticated using (public.usuario_activo());
drop policy if exists editar on public.comisiones_oficina;
create policy editar on public.comisiones_oficina for all to authenticated using (public.es_administrador()) with check (public.es_administrador());
grant select, insert, update, delete on public.comisiones_oficina to authenticated;
revoke all on public.comisiones_oficina from anon;

-- Verificación: debe dar 95 · 1 · 2 · 1 · 1
select (select valor from public.parametros where clave = 'meta_normalidad') as meta_normalidad,
       (select count(*) from information_schema.tables where table_name = 'gestiones') as tabla_gestiones,
       (select count(*) from pg_proc where proname in ('cancelar_pago', 'revertir_desembolso')) as funciones_reverso,
       (select count(*) from pg_trigger where tgname = 'validar_envio_mesa') as regla_envio_mesa,
       (select count(*) from pg_proc where proname = 'desembolsar_solicitud' and prosrc like '%Contrato firmado%') as contrato_obligatorio;
