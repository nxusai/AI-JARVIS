-- Sistema de crédito y cobranza · documentos y fotos del expediente (NXUS AI)
--
-- Se corre DESPUÉS de 05_reunion_16nov.sql. Se puede volver a correr sin perder nada.
--
-- Los archivos (INE, comprobante de domicilio, fotos, contratos…) se guardan en un
-- espacio PRIVADO de Supabase Storage llamado "expedientes". Nadie los ve sin
-- iniciar sesión y cada quien sólo ve los de su ámbito. Nadie los borra desde la
-- página: se conservan para las auditorías de 6 años.
--
-- Carpeta de cada archivo:  <tipo>/<id>/<archivo>
--   cliente/<id>     expediente del cliente
--   solicitud/<id>   documentos de la solicitud (los revisa mesa de control)
--   credito/<id>     contrato, pagaré y lo propio de cada crédito
--   personal/<id>    foto y documentos del personal (sólo administradores)

-- ---------------------------------------------------------------------------
-- Espacio privado de archivos (10 MB por archivo; imágenes y PDF)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expedientes', 'expedientes', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Ficha de cada archivo
-- ---------------------------------------------------------------------------
create table if not exists public.documentos (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('cliente', 'solicitud', 'credito', 'personal')),
  entidad_id integer not null,
  categoria text not null,
  nombre text not null,
  path text not null unique,
  mime text,
  tamano integer,
  subido_por uuid not null default auth.uid() references auth.users (id),
  creado timestamptz not null default now(),
  es_demo boolean not null default false,
  check (path ~ ('^' || tipo || '/' || entidad_id || '/[^/]+$'))
);
create index if not exists documentos_entidad_idx on public.documentos (tipo, entidad_id);

-- ¿Puede esta persona ver / subir archivos de ese expediente? Se evalúa con los
-- candados de quien pregunta: si no ve al cliente, tampoco ve sus documentos.
create or replace function public.ve_expediente(p_tipo text, p_id integer) returns boolean
language sql stable set search_path = public as $$
  select case p_tipo
    when 'personal' then public.es_administrador()
    when 'cliente' then exists (select 1 from public.clientes where id = p_id)
    when 'solicitud' then exists (select 1 from public.solicitudes where id = p_id)
    when 'credito' then exists (select 1 from public.creditos where id = p_id)
    else false end;
$$;
create or replace function public.puede_subir(p_tipo text, p_id integer) returns boolean
language sql stable set search_path = public as $$
  select public.ve_expediente(p_tipo, p_id)
     and (p_tipo = 'personal' or coalesce(public.mi_rol(), '') in
          ('asesor', 'gerente', 'zonal', 'regional', 'mesa', 'dueno', 'direccion', 'soporte'));
$$;
-- Para los archivos: primero valida el nombre de la carpeta y luego los permisos
create or replace function public.puede_subir_archivo(p_name text) returns boolean
language sql stable set search_path = public as $$
  select case when p_name ~ '^(cliente|solicitud|credito|personal)/[0-9]{1,9}/[^/]+$'
              then public.puede_subir(split_part(p_name, '/', 1), split_part(p_name, '/', 2)::integer)
              else false end;
$$;
revoke all on function public.ve_expediente(text, integer), public.puede_subir(text, integer), public.puede_subir_archivo(text) from public, anon;
grant execute on function public.ve_expediente(text, integer), public.puede_subir(text, integer), public.puede_subir_archivo(text) to authenticated;

alter table public.documentos enable row level security;
drop policy if exists leer on public.documentos;
create policy leer on public.documentos for select to authenticated
  using (public.usuario_activo() and public.ve_expediente(tipo, entidad_id));
drop policy if exists subir on public.documentos;
create policy subir on public.documentos for insert to authenticated
  with check (subido_por = auth.uid() and public.puede_subir(tipo, entidad_id));
grant select, insert on public.documentos to authenticated;
revoke all on public.documentos from anon;

-- ---------------------------------------------------------------------------
-- Candados de los archivos (sin borrar ni reemplazar)
-- ---------------------------------------------------------------------------
drop policy if exists expedientes_subir on storage.objects;
create policy expedientes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'expedientes' and public.puede_subir_archivo(name));

drop policy if exists expedientes_leer on storage.objects;
create policy expedientes_leer on storage.objects for select to authenticated
  using (bucket_id = 'expedientes'
    and (exists (select 1 from public.documentos d where d.path = storage.objects.name)
         -- quien lo acaba de subir lo puede leer (Supabase lo lee de vuelta al guardarlo)
         or (owner_id = auth.uid()::text and public.puede_subir_archivo(name))));
