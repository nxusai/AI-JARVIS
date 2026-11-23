-- Sistema de crédito y cobranza · renovaciones sin volver a subir todo (NXUS AI)
--
-- Se corre DESPUÉS de 10_roles_y_captura.sql. Se puede volver a correr sin perder nada.
--
-- Cuando un cliente renueva o hace recompra, la nueva solicitud toma sola del
-- crédito anterior lo que no cambia:
--   Foto del cliente, INE (frente), INE (reverso) y el Comprobante de domicilio
--   (este último sólo si tiene menos de 90 días; el plazo se cambia en Parámetros).
-- Lo que sí cambia se vuelve a pedir: solicitud firmada, carta de ingresos, 3 fotos
-- del domicilio, 3 del negocio y el video de la mercancía.
--
-- No se copia el archivo: la nueva ficha apunta al mismo archivo privado y guarda de
-- qué documento viene (origen_id) para que mesa vea «del crédito anterior» y su fecha.

-- ---------------------------------------------------------------------------
-- 1. Documentos reutilizados
-- ---------------------------------------------------------------------------
alter table public.documentos add column if not exists origen_id bigint references public.documentos (id) on delete cascade;

-- El mismo archivo puede estar en varias solicitudes del mismo cliente (sólo si es reutilizado)
alter table public.documentos drop constraint if exists documentos_path_key;
alter table public.documentos drop constraint if exists documentos_check;
alter table public.documentos drop constraint if exists documentos_ruta_check;
alter table public.documentos add constraint documentos_ruta_check
  check (origen_id is not null or path ~ ('^' || tipo || '/' || entidad_id || '/[^/]+$'));
create unique index if not exists documentos_unico_idx on public.documentos (tipo, entidad_id, path);
create unique index if not exists documentos_path_original_idx on public.documentos (path) where origen_id is null;

-- Nadie puede crear a mano una ficha «reutilizada»: sólo lo hace el sistema
drop policy if exists subir on public.documentos;
create policy subir on public.documentos for insert to authenticated
  with check (subido_por = auth.uid() and origen_id is null and public.puede_subir(tipo, entidad_id));

insert into public.parametros (clave, valor, descripcion) values
  ('comprobante_vigencia_dias', 90, 'Renovaciones: días que sigue sirviendo el comprobante de domicilio anterior')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Al capturar una renovación o recompra, se ligan los documentos que no cambian
-- ---------------------------------------------------------------------------
create or replace function public.reusar_documentos_solicitud() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cliente integer;
  v_dias integer := coalesce(public.param('comprobante_vigencia_dias'), 90)::int;
begin
  if new.credito_anterior_id is null then return new; end if;
  select cliente_id into v_cliente from public.creditos where id = new.credito_anterior_id;
  v_cliente := coalesce(v_cliente, new.cliente_id);
  if v_cliente is null then return new; end if;

  insert into public.documentos (tipo, entidad_id, categoria, nombre, path, mime, tamano, subido_por, creado, es_demo, origen_id)
  select distinct on (d.categoria)
         'solicitud', new.id, d.categoria, d.nombre, d.path, d.mime, d.tamano, d.subido_por, d.creado, new.es_demo, coalesce(d.origen_id, d.id)
    from public.documentos d
   where d.categoria in ('Foto del cliente', 'INE (frente)', 'INE (reverso)', 'Comprobante de domicilio')
     and (d.categoria <> 'Comprobante de domicilio' or d.creado >= now() - make_interval(days => v_dias))
     and (d.mime like 'image/%' or d.mime = 'application/pdf')
     and ((d.tipo = 'cliente' and d.entidad_id = v_cliente)
       or (d.tipo = 'credito' and d.entidad_id in (select id from public.creditos where cliente_id = v_cliente))
       or (d.tipo = 'solicitud' and d.entidad_id <> new.id and d.entidad_id in (
             select x.id from public.solicitudes x
              where x.cliente_id = v_cliente
                 or x.id in (select solicitud_id from public.creditos where cliente_id = v_cliente and solicitud_id is not null)
                 or x.credito_anterior_id in (select id from public.creditos where cliente_id = v_cliente))))
     and not exists (select 1 from public.documentos y where y.tipo = 'solicitud' and y.entidad_id = new.id and y.categoria = d.categoria)
   order by d.categoria, d.creado desc
  on conflict do nothing;
  return new;
end $$;
revoke all on function public.reusar_documentos_solicitud() from public, anon, authenticated;

drop trigger if exists reusar_documentos on public.solicitudes;
create trigger reusar_documentos after insert on public.solicitudes
  for each row execute function public.reusar_documentos_solicitud();

-- Verificación: debe dar 1 · 1 · 90
select (select count(*) from information_schema.columns where table_name = 'documentos' and column_name = 'origen_id') as columna_origen,
       (select count(*) from pg_trigger where tgname = 'reusar_documentos') as regla_renovacion,
       (select valor from public.parametros where clave = 'comprobante_vigencia_dias') as dias_comprobante;
