-- NXUS HQ (app.nxusai.org): la empresa en un solo lugar.
--
-- Se pega una sola vez en Supabase → SQL Editor → Run. Crea las tablas, los
-- candados (quién ve y toca qué) y el lugar de las fotos. Se puede volver a
-- correr completo sin perder nada (así se aplican mejoras).
--
-- Las reglas viven aquí, en la base de datos, no en la página: aunque alguien
-- se brincara la página, la base de datos no le deja.
--
--   admin   Eduardo. Ve y toca todo: clientes y lo que pagan, nómina,
--           comisiones, personas, bitácora. Es el único que borra.
--   equipo  todos los demás, también los socios de NXUS México. Ven los
--           clientes (sin dinero), el equipo, sus propias tareas y su propia
--           entrada y salida. Nada de dinero, nada de nómina.
--
-- Cada persona entra con su correo y su contraseña. Nadie se registra solo:
-- el admin las da de alta desde la página.


-- ---------------------------------------------------------------------------
-- Personas
-- ---------------------------------------------------------------------------

create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  correo text not null default '',
  rol text not null default 'equipo' check (rol in ('admin', 'equipo')),
  activo boolean not null default false,
  cargo text not null default '',
  sede text not null default 'usa' check (sede in ('usa', 'mexico')),
  foto text, -- ruta en el almacenamiento "fotos"
  reporta_a uuid references public.perfiles (id) on delete set null,
  creado timestamptz not null default now()
);

create or replace function public.yo_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(yo_rol() = 'admin', false)
$$;

create or replace function public.es_alguien() returns boolean
language sql stable security definer set search_path = public as $$
  select yo_rol() is not null
$$;

-- Lo hace el sistema (triggers), no una persona a mano.
create or replace function public.es_sistema() returns boolean
language sql stable as $$
  select auth.uid() is null
$$;

-- Cada usuario nuevo nace con su perfil. El primero de todos es el admin; los
-- demás los crea el admin desde la página (nacen activos con lo que él puso).
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare primero boolean := not exists (select 1 from perfiles where rol = 'admin');
begin
  insert into perfiles (id, nombre, correo, rol, activo, cargo, sede)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.email, ''),
    case when primero then 'admin' else 'equipo' end,
    primero or coalesce((new.raw_user_meta_data ->> 'activo')::boolean, false),
    coalesce(new.raw_user_meta_data ->> 'cargo', case when primero then 'Fundador y CEO' else '' end),
    case when new.raw_user_meta_data ->> 'sede' = 'mexico' then 'mexico' else 'usa' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists hq_nuevo_usuario on auth.users;
create trigger hq_nuevo_usuario after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- El admin no se puede quitar su propio acceso (para no quedarse fuera).
create or replace function public.cuidar_perfil() returns trigger
language plpgsql as $$
begin
  if es_sistema() then return new; end if;
  if new.id <> old.id then raise exception 'No se puede cambiar el id'; end if;
  if old.id = auth.uid() and (new.rol <> old.rol or not new.activo) then
    raise exception 'No te puedes quitar tu propio acceso de admin';
  end if;
  return new;
end $$;

drop trigger if exists hq_cuidar_perfil on public.perfiles;
create trigger hq_cuidar_perfil before update on public.perfiles
  for each row execute function public.cuidar_perfil();

-- ---------------------------------------------------------------------------
-- Clientes (lo que todos ven) y su dinero (solo el admin)
-- ---------------------------------------------------------------------------

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 120),
  grupo text, -- holding o grupo (Abuelito INC, Keko Foods…)
  estado text not null default 'activo' check (estado in ('prospecto', 'activo', 'pausado', 'terminado')),
  equipo text not null default 'usa' check (equipo in ('usa', 'mexico')), -- quién lo atiende
  servicios text[] not null default '{}',
  descripcion text not null default '' check (char_length(descripcion) <= 5000),
  contacto_nombre text not null default '',
  contacto_correo text not null default '',
  contacto_tel text not null default '',
  sistema_nombre text not null default '',
  sistema_url text not null default '' check (sistema_url = '' or sistema_url ~ '^https://'),
  inicio date,
  responsable uuid references public.perfiles (id) on delete set null,
  traido_por uuid references public.perfiles (id) on delete set null,
  propio boolean not null default false, -- empresa del dueño (Aurelius)
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists public.clientes_dinero (
  cliente_id uuid primary key references public.clientes (id) on delete cascade,
  mensualidad numeric(12, 2) not null default 0 check (mensualidad >= 0),
  pago_unico numeric(12, 2) not null default 0 check (pago_unico >= 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'MXN')),
  dia_cobro int check (dia_cobro between 1 and 31),
  notas text not null default ''
);

-- ---------------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------------

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes (id) on delete set null,
  titulo text not null check (char_length(titulo) between 1 and 200),
  detalle text not null default '' check (char_length(detalle) <= 5000),
  asignado uuid references public.perfiles (id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en-curso', 'hecha')),
  vence date,
  creada_por uuid references public.perfiles (id) on delete set null,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);
create index if not exists tareas_asignado on public.tareas (asignado, estado);

create or replace function public.antes_tarea() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creada := now();
    if not es_sistema() then new.creada_por := auth.uid(); end if;
  else
    new.creada := old.creada;
    new.creada_por := old.creada_por;
    -- El equipo mueve el estado de lo suyo; lo demás lo cambia quien la creó o el admin.
    if not es_sistema() and not es_admin() and old.creada_por is distinct from auth.uid() then
      if new.titulo <> old.titulo or new.detalle <> old.detalle or new.asignado is distinct from old.asignado
         or new.cliente_id is distinct from old.cliente_id or new.vence is distinct from old.vence then
        raise exception 'Solo quien creó la tarea (o el admin) cambia eso; tú mueves su estado';
      end if;
    end if;
  end if;
  new.actualizada := now();
  return new;
end $$;

drop trigger if exists hq_antes_tarea on public.tareas;
create trigger hq_antes_tarea before insert or update on public.tareas
  for each row execute function public.antes_tarea();

-- ---------------------------------------------------------------------------
-- Entrada y salida
-- ---------------------------------------------------------------------------

create table if not exists public.jornadas (
  id uuid primary key default gen_random_uuid(),
  persona uuid not null references public.perfiles (id) on delete cascade,
  entrada timestamptz not null default now(),
  salida timestamptz,
  dia_completo boolean not null default false, -- el admin le pidió quedarse el día completo
  nota text not null default '' check (char_length(nota) <= 500),
  check (salida is null or salida > entrada)
);
create index if not exists jornadas_persona on public.jornadas (persona, entrada desc);
-- Una jornada abierta a la vez por persona.
create unique index if not exists jornadas_una_abierta on public.jornadas (persona) where salida is null;

-- La hora la pone el reloj del servidor, no la persona.
create or replace function public.antes_jornada() returns trigger
language plpgsql as $$
begin
  if es_sistema() or es_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.persona := auth.uid();
    new.entrada := now();
    new.salida := null;
    new.dia_completo := false;
  else
    if old.salida is not null then raise exception 'Esa jornada ya está cerrada'; end if;
    new.persona := old.persona;
    new.entrada := old.entrada;
    new.dia_completo := old.dia_completo;
    new.salida := case when new.salida is null then null else now() end;
  end if;
  return new;
end $$;

drop trigger if exists hq_antes_jornada on public.jornadas;
create trigger hq_antes_jornada before insert or update on public.jornadas
  for each row execute function public.antes_jornada();

-- ---------------------------------------------------------------------------
-- Nómina y comisiones (solo el admin)
-- ---------------------------------------------------------------------------

create table if not exists public.nomina (
  persona uuid primary key references public.perfiles (id) on delete cascade,
  esquema text not null default 'fijo' check (esquema in ('fijo', 'medio-tiempo', 'comision')),
  monto_quincena numeric(12, 2) not null default 0 check (monto_quincena >= 0),
  moneda text not null default 'MXN' check (moneda in ('USD', 'MXN')),
  horas_semana numeric(5, 2) not null default 40 check (horas_semana > 0),
  pago_dia_completo numeric(12, 2) not null default 0 check (pago_dia_completo >= 0), -- extra por día completo; 0 = lo calcula la página
  porcentaje numeric(5, 2) not null default 0 check (porcentaje between 0 and 100), -- comisión de socios
  notas text not null default ''
);

create table if not exists public.nomina_ajustes (
  id uuid primary key default gen_random_uuid(),
  persona uuid not null references public.perfiles (id) on delete cascade,
  fecha date not null default current_date,
  concepto text not null check (char_length(concepto) between 1 and 200),
  monto numeric(12, 2) not null -- negativo para descuentos
);

create table if not exists public.comisiones (
  id uuid primary key default gen_random_uuid(),
  persona uuid not null references public.perfiles (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  concepto text not null default '',
  fecha date not null default current_date,
  monto_cobrado numeric(12, 2) not null check (monto_cobrado >= 0),
  porcentaje numeric(5, 2) not null default 50 check (porcentaje between 0 and 100),
  moneda text not null default 'MXN' check (moneda in ('USD', 'MXN')),
  pagada boolean not null default false
);

-- El equipo cobra en pesos (para quien ya corrió una versión anterior).
alter table public.nomina alter column moneda set default 'MXN';
alter table public.comisiones alter column moneda set default 'MXN';

-- ---------------------------------------------------------------------------
-- Bitácora: quién hizo qué, también NEX
-- ---------------------------------------------------------------------------

create table if not exists public.bitacora (
  id bigserial primary key,
  quien uuid,
  accion text not null,
  tabla text not null,
  fila text,
  cuando timestamptz not null default now()
);
create index if not exists bitacora_cuando on public.bitacora (cuando desc);

create or replace function public.anotar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into bitacora (quien, accion, tabla, fila)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(
      to_jsonb(case when tg_op = 'DELETE' then old else new end) ->> 'id',
      to_jsonb(case when tg_op = 'DELETE' then old else new end) ->> 'persona',
      to_jsonb(case when tg_op = 'DELETE' then old else new end) ->> 'cliente_id'
    )
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['perfiles', 'clientes', 'clientes_dinero', 'tareas', 'jornadas', 'nomina', 'nomina_ajustes', 'comisiones'] loop
    execute format('drop trigger if exists hq_bitacora on public.%I', t);
    execute format('create trigger hq_bitacora after insert or update or delete on public.%I for each row execute function public.anotar_cambio()', t);
  end loop;
end $$;

create or replace function public.al_cambiar_cliente() returns trigger
language plpgsql as $$
begin
  new.actualizado := now();
  if tg_op = 'UPDATE' then new.creado := old.creado; end if;
  return new;
end $$;

drop trigger if exists hq_cliente_fecha on public.clientes;
create trigger hq_cliente_fecha before insert or update on public.clientes
  for each row execute function public.al_cambiar_cliente();

-- ---------------------------------------------------------------------------
-- Candados
-- ---------------------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.clientes enable row level security;
alter table public.clientes_dinero enable row level security;
alter table public.tareas enable row level security;
alter table public.jornadas enable row level security;
alter table public.nomina enable row level security;
alter table public.nomina_ajustes enable row level security;
alter table public.comisiones enable row level security;
alter table public.bitacora enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('perfiles', 'clientes', 'clientes_dinero', 'tareas', 'jornadas', 'nomina', 'nomina_ajustes', 'comisiones', 'bitacora')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Personas: todo el equipo se ve (las tarjetas); solo el admin cambia.
create policy perfiles_ver on public.perfiles for select to authenticated using (id = auth.uid() or es_alguien());
create policy perfiles_admin on public.perfiles for update to authenticated using (es_admin()) with check (es_admin());
create policy perfiles_borrar on public.perfiles for delete to authenticated using (es_admin() and id <> auth.uid());

-- Clientes: todos los ven; el admin los crea, cambia y borra.
create policy clientes_ver on public.clientes for select to authenticated using (es_alguien());
create policy clientes_crear on public.clientes for insert to authenticated with check (es_admin());
create policy clientes_cambiar on public.clientes for update to authenticated using (es_admin()) with check (es_admin());
create policy clientes_borrar on public.clientes for delete to authenticated using (es_admin());

-- El dinero de cada cliente: solo el admin, para todo.
create policy dinero_admin on public.clientes_dinero for all to authenticated using (es_admin()) with check (es_admin());

-- Tareas: cada quien ve las suyas (asignadas o creadas por él); el admin todas.
create policy tareas_ver on public.tareas for select to authenticated
  using (es_admin() or asignado = auth.uid() or creada_por = auth.uid());
create policy tareas_crear on public.tareas for insert to authenticated with check (es_alguien());
create policy tareas_cambiar on public.tareas for update to authenticated
  using (es_admin() or asignado = auth.uid() or creada_por = auth.uid())
  with check (es_admin() or asignado = auth.uid() or creada_por = auth.uid());
create policy tareas_borrar on public.tareas for delete to authenticated using (es_admin());

-- Entrada y salida: cada quien la suya; el admin todas (y las corrige).
create policy jornadas_ver on public.jornadas for select to authenticated using (es_admin() or persona = auth.uid());
create policy jornadas_entrar on public.jornadas for insert to authenticated with check (es_alguien());
create policy jornadas_salir on public.jornadas for update to authenticated
  using (es_admin() or (persona = auth.uid() and salida is null))
  with check (es_admin() or persona = auth.uid());
create policy jornadas_borrar on public.jornadas for delete to authenticated using (es_admin());

-- Nómina, ajustes y comisiones: solo el admin.
create policy nomina_admin on public.nomina for all to authenticated using (es_admin()) with check (es_admin());
create policy ajustes_admin on public.nomina_ajustes for all to authenticated using (es_admin()) with check (es_admin());
create policy comisiones_admin on public.comisiones for all to authenticated using (es_admin()) with check (es_admin());

-- Bitácora: la escriben los triggers; solo el admin la lee.
create policy bitacora_ver on public.bitacora for select to authenticated using (es_admin());

-- ---------------------------------------------------------------------------
-- Fotos del equipo
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hq_fotos_ver on storage.objects;
create policy hq_fotos_ver on storage.objects for select to authenticated using (bucket_id = 'fotos' and es_alguien());
drop policy if exists hq_fotos_subir on storage.objects;
create policy hq_fotos_subir on storage.objects for insert to authenticated with check (bucket_id = 'fotos' and es_admin());
drop policy if exists hq_fotos_borrar on storage.objects;
create policy hq_fotos_borrar on storage.objects for delete to authenticated using (bucket_id = 'fotos' and es_admin());

-- ---------------------------------------------------------------------------
-- Los clientes que NXUS ya tiene (sin montos: esos los pone Eduardo)
-- ---------------------------------------------------------------------------

insert into public.clientes (nombre, grupo, estado, equipo, servicios, descripcion, sistema_nombre, sistema_url, propio)
select * from (values
  ('Aurelius', 'Ramos & Co.', 'activo', 'mexico',
   array['Marketing y redes', 'Sitio web', 'Sistema de entrada y salida'],
   'El restaurante de Eduardo. El equipo NXUS México lleva su marketing. Tiene su sistema de entrada y salida del personal.',
   'Entrada y salida', '', true),
  ('Abuelito INC', 'Abuelito INC', 'activo', 'usa',
   array['Centro de trabajo (CRM) con Ultron', 'Anuncios en Meta', 'Contenido'],
   'Holding de Abuelito Cheese, Abuelito Meat y Abuelito Corn. Usa el Centro de trabajo con Ultron para su dirección.',
   'Centro de trabajo', 'https://centro-misemago-abuelito.netlify.app', false),
  ('Mi Semago', null, 'activo', 'usa',
   array['Centro de trabajo (CRM) con Ultron', 'Ana Sofi: ventas por teléfono', 'Etiquetas de trazabilidad', 'Anuncios en Meta'],
   'Comparte el Centro de trabajo con Abuelito INC. Ana Sofi llama a sus prospectos e imprime sus etiquetas.',
   'Centro de trabajo', 'https://centro-misemago-abuelito.netlify.app', false),
  ('VAYRO', 'Keko Foods', 'prospecto', 'usa',
   array['Administración por Ramos & Co.', 'IA Vivian (en preparación)'],
   'De los mismos dueños de Abuelito, empresa independiente. Primero la administra Ramos & Co.',
   '', '', false)
) as v(nombre, grupo, estado, equipo, servicios, descripcion, sistema_nombre, sistema_url, propio)
where not exists (select 1 from public.clientes c where c.nombre = v.nombre);

insert into public.clientes_dinero (cliente_id)
select id from public.clientes c where not exists (select 1 from public.clientes_dinero d where d.cliente_id = c.id);

-- ---------------------------------------------------------------------------
-- Prospectos: los que llegan por el portal (empezar.nxusai.org) o se apuntan
-- a mano. Eduardo decide, persona por persona, quién los ve y qué puede hacer
-- con ellos; él siempre ve y hace todo, y es el único que asigna y borra.
-- ---------------------------------------------------------------------------

-- Lo que cada persona puede hacer con los prospectos (lo cambia solo el admin,
-- porque solo él cambia perfiles).
alter table public.perfiles add column if not exists codigo text; -- su link: empezar.nxusai.org/juan-perez?de=codigo
alter table public.perfiles add column if not exists pros_ver text not null default 'nada';
alter table public.perfiles add column if not exists pros_trabajar boolean not null default false;
alter table public.perfiles add column if not exists pros_etapas boolean not null default false;
alter table public.perfiles add column if not exists pros_convertir boolean not null default false;
alter table public.perfiles add column if not exists pros_pagos boolean not null default false;
alter table public.perfiles drop constraint if exists perfiles_pros_ver_check;
alter table public.perfiles add constraint perfiles_pros_ver_check check (pros_ver in ('nada', 'suyos', 'todos'));
alter table public.perfiles drop constraint if exists perfiles_codigo_check;
alter table public.perfiles add constraint perfiles_codigo_check check (codigo is null or codigo ~ '^[a-z0-9-]{2,30}$');
create unique index if not exists perfiles_codigo on public.perfiles (codigo) where codigo is not null;

create table if not exists public.prospectos (
  id uuid primary key default gen_random_uuid(),
  portal_id text unique, -- su registro en el portal; null si se apuntó a mano
  origen text not null default 'portal' check (origen in ('portal', 'manual')),
  link text not null default '', -- juan-perez
  nombre text not null default '' check (char_length(nombre) <= 80),
  empresa text not null default '' check (char_length(empresa) <= 120),
  direccion text not null default '' check (char_length(direccion) <= 200),
  whatsapp text not null default '' check (char_length(whatsapp) <= 30),
  correo text not null default '' check (char_length(correo) <= 120),
  lineas text[] not null default '{}', -- lo que marcó del catálogo
  diagnostico jsonb not null default '{}', -- giro, tamaño, país, urgencia, lo que quiere
  camino text not null default '' check (camino in ('', 'consulta', 'propuesta')),
  acepta_novedades boolean not null default false, -- quiere recibir casos y novedades
  etapa text not null default 'abrio' check (etapa in ('abrio', 'datos', 'pagado', 'cita', 'reunion', 'propuesta', 'cliente', 'perdido')),
  cita timestamptz,
  meet text not null default '',
  siguiente text not null default '' check (char_length(siguiente) <= 300), -- el siguiente paso
  siguiente_fecha date,
  motivo_perdido text not null default '' check (char_length(motivo_perdido) <= 300),
  traido_por uuid references public.perfiles (id) on delete set null, -- de quién era el link
  asignado uuid references public.perfiles (id) on delete set null, -- quién lo atiende
  cliente_id uuid references public.clientes (id) on delete set null, -- en qué cliente se convirtió
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists prospectos_etapa on public.prospectos (etapa, actualizado desc);
-- 'anuncio': llegó por los anuncios (ManyChat → Leads) y agendó.
alter table public.prospectos drop constraint if exists prospectos_origen_check;
alter table public.prospectos add constraint prospectos_origen_check check (origen in ('portal', 'manual', 'anuncio'));

create table if not exists public.prospectos_notas (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid not null references public.prospectos (id) on delete cascade,
  autor uuid references public.perfiles (id) on delete set null,
  texto text not null check (char_length(texto) between 1 and 2000),
  creada timestamptz not null default now()
);
create index if not exists prospectos_notas_de on public.prospectos_notas (prospecto_id, creada);

-- Lo que pagó (la consultoría por Stripe). Solo el admin, o quien tenga permiso.
create table if not exists public.prospectos_pagos (
  id uuid primary key default gen_random_uuid(),
  prospecto_id uuid not null references public.prospectos (id) on delete cascade,
  concepto text not null default 'Consultoría',
  monto numeric(12, 2) not null check (monto >= 0),
  moneda text not null default 'MXN' check (moneda in ('USD', 'MXN')),
  sesion text unique, -- la sesión de Stripe (para no contarlo dos veces)
  fecha timestamptz not null default now()
);

-- Qué puede hacer quien pide, con los prospectos.
create or replace function public.pros_puede(que text) returns boolean
language sql stable security definer set search_path = public as $$
  select es_admin() or exists (
    select 1 from perfiles p where p.id = auth.uid() and p.activo and case que
      when 'trabajar' then p.pros_trabajar
      when 'etapas' then p.pros_etapas
      when 'convertir' then p.pros_convertir
      when 'pagos' then p.pros_pagos
      else false end)
$$;

-- Si ve un prospecto: el admin todos; los demás, según lo que Eduardo les dio
-- ("suyos" = los de su link o los que él les asignó).
create or replace function public.pros_ve(asignado uuid, traido uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select es_admin() or exists (
    select 1 from perfiles p where p.id = auth.uid() and p.activo
      and (p.pros_ver = 'todos' or (p.pros_ver = 'suyos' and auth.uid() in (asignado, traido))))
$$;

create or replace function public.orden_etapa(e text) returns int
language sql immutable as $$
  select array_position(array['abrio', 'datos', 'pagado', 'cita', 'reunion', 'propuesta', 'cliente', 'perdido'], e)
$$;

create or replace function public.antes_prospecto() returns trigger
language plpgsql as $$
declare
  convirtiendo boolean := coalesce(current_setting('hq.convirtiendo', true), '') = 'si';
  desde_lead boolean := coalesce(current_setting('hq.desde_lead', true), '') = 'si';
begin
  if tg_op = 'INSERT' then
    new.creado := now();
    if desde_lead then
      -- Lo pasa lead_a_prospecto: un lead de los anuncios que agendó.
      new.origen := 'anuncio';
      new.portal_id := null;
      new.cliente_id := null;
    elsif not es_sistema() then
      -- A mano: nace de quien lo apunta (el admin puede ponerlo a nombre de alguien).
      new.origen := 'manual';
      new.portal_id := null;
      new.cliente_id := null;
      if new.etapa in ('cliente', 'perdido') then new.etapa := 'datos'; end if;
      if not es_admin() then
        new.traido_por := auth.uid();
        new.asignado := auth.uid();
      end if;
    end if;
    new.asignado := coalesce(new.asignado, new.traido_por);
  else
    new.id := old.id;
    new.portal_id := old.portal_id;
    new.origen := old.origen;
    new.creado := old.creado;
    if es_sistema() then
      -- El portal solo avanza: nunca regresa una etapa ni cambia a quién es.
      new.traido_por := coalesce(old.traido_por, new.traido_por);
      new.asignado := coalesce(old.asignado, new.asignado, new.traido_por);
      new.cliente_id := old.cliente_id;
      if old.etapa in ('reunion', 'propuesta', 'cliente', 'perdido') or orden_etapa(new.etapa) < orden_etapa(old.etapa) then
        new.etapa := old.etapa;
      end if;
    elsif not es_admin() then
      -- Lo que llenó el prospecto en el portal no se toca.
      new.link := old.link;
      new.lineas := old.lineas;
      new.diagnostico := old.diagnostico;
      new.camino := old.camino;
      new.acepta_novedades := old.acepta_novedades;
      new.cita := old.cita;
      new.meet := old.meet;
      if new.traido_por is distinct from old.traido_por or new.asignado is distinct from old.asignado then
        raise exception 'Solo Eduardo asigna prospectos';
      end if;
      if new.cliente_id is distinct from old.cliente_id and not convirtiendo then
        raise exception 'Para hacerlo cliente usa "Convertir en cliente"';
      end if;
      if new.etapa is distinct from old.etapa then
        if new.etapa = 'cliente' or old.etapa = 'cliente' then
          if not convirtiendo then raise exception 'Para hacerlo cliente usa "Convertir en cliente"'; end if;
        elsif not pros_puede('etapas') then
          raise exception 'No tienes permiso para mover la etapa';
        end if;
      end if;
      if (new.nombre, new.empresa, new.direccion, new.whatsapp, new.correo, new.siguiente, new.siguiente_fecha, new.motivo_perdido)
         is distinct from (old.nombre, old.empresa, old.direccion, old.whatsapp, old.correo, old.siguiente, old.siguiente_fecha, old.motivo_perdido)
         and not pros_puede('trabajar') then
        raise exception 'No tienes permiso para trabajar este prospecto';
      end if;
    end if;
  end if;
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists hq_antes_prospecto on public.prospectos;
create trigger hq_antes_prospecto before insert or update on public.prospectos
  for each row execute function public.antes_prospecto();

-- Las notas no se cambian: se agregan, con su autor y su hora.
create or replace function public.antes_nota_prospecto() returns trigger
language plpgsql as $$
begin
  if not es_sistema() then new.autor := auth.uid(); end if;
  new.creada := now();
  return new;
end $$;

drop trigger if exists hq_antes_nota_prospecto on public.prospectos_notas;
create trigger hq_antes_nota_prospecto before insert on public.prospectos_notas
  for each row execute function public.antes_nota_prospecto();

-- Si el prospecto llegó por el link de alguien que cobra comisión, lo que
-- pagó le genera su comisión sola (Eduardo la puede quitar en Nómina).
create or replace function public.comision_por_pago() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select p.traido_por, p.empresa, p.nombre, n.porcentaje into r
  from prospectos p join nomina n on n.persona = p.traido_por
  where p.id = new.prospecto_id and n.esquema = 'comision' and n.porcentaje > 0;
  if found then
    insert into comisiones (persona, concepto, fecha, monto_cobrado, porcentaje, moneda)
    values (r.traido_por, left(new.concepto || ' · ' || coalesce(nullif(r.empresa, ''), nullif(r.nombre, ''), 'prospecto'), 200),
            (new.fecha at time zone 'America/Mexico_City')::date, new.monto, r.porcentaje, new.moneda);
  end if;
  return null;
end $$;

drop trigger if exists hq_comision_por_pago on public.prospectos_pagos;
create trigger hq_comision_por_pago after insert on public.prospectos_pagos
  for each row execute function public.comision_por_pago();

-- Convertir en cliente: crea su ficha en Clientes con lo que contestó y lo
-- marca como cliente. Lo hace el admin o quien tenga ese permiso.
create or replace function public.convertir_prospecto(pid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare p prospectos; nuevo uuid; d jsonb;
begin
  select * into p from prospectos where id = pid;
  if not found or not pros_ve(p.asignado, p.traido_por) then raise exception 'Ese prospecto no existe'; end if;
  if not pros_puede('convertir') then raise exception 'No tienes permiso para convertir prospectos en clientes'; end if;
  if p.cliente_id is not null then return p.cliente_id; end if;
  d := p.diagnostico;
  insert into clientes (nombre, estado, equipo, servicios, descripcion, contacto_nombre, contacto_correo, contacto_tel, inicio, responsable, traido_por)
  values (
    left(coalesce(nullif(p.empresa, ''), nullif(p.nombre, ''), 'Cliente nuevo'), 120),
    'activo',
    case when d ->> 'pais' = 'USA' then 'usa' else 'mexico' end,
    p.lineas,
    left(concat_ws(E'\n',
      case p.origen when 'portal' then 'Llegó por el portal.' when 'anuncio' then 'Llegó por los anuncios y agendó con NEX.' end,
      nullif(concat_ws(' · ', d ->> 'giro', nullif(d ->> 'tamano', '') || ' personas', d ->> 'pais'), ''),
      case when coalesce(d ->> 'quiere', '') <> '' then 'Quiere: ' || (d ->> 'quiere') end,
      case when p.direccion <> '' then 'Dirección: ' || p.direccion end), 5000),
    p.nombre, p.correo, p.whatsapp, current_date, p.asignado, p.traido_por)
  returning id into nuevo;
  insert into clientes_dinero (cliente_id) values (nuevo) on conflict do nothing;
  perform set_config('hq.convirtiendo', 'si', true);
  update prospectos set etapa = 'cliente', cliente_id = nuevo where id = pid;
  perform set_config('hq.convirtiendo', '', true);
  return nuevo;
end $$;

revoke all on function public.convertir_prospecto(uuid) from public;
grant execute on function public.convertir_prospecto(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['prospectos', 'prospectos_notas', 'prospectos_pagos'] loop
    execute format('drop trigger if exists hq_bitacora on public.%I', t);
    execute format('create trigger hq_bitacora after insert or update or delete on public.%I for each row execute function public.anotar_cambio()', t);
  end loop;
end $$;

alter table public.prospectos enable row level security;
alter table public.prospectos_notas enable row level security;
alter table public.prospectos_pagos enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('prospectos', 'prospectos_notas', 'prospectos_pagos')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy prospectos_ver on public.prospectos for select to authenticated using (pros_ve(asignado, traido_por));
create policy prospectos_crear on public.prospectos for insert to authenticated with check (pros_puede('trabajar'));
create policy prospectos_cambiar on public.prospectos for update to authenticated
  using (pros_ve(asignado, traido_por) and (pros_puede('trabajar') or pros_puede('etapas')))
  with check (pros_ve(asignado, traido_por));
create policy prospectos_borrar on public.prospectos for delete to authenticated using (es_admin());

create policy pros_notas_ver on public.prospectos_notas for select to authenticated
  using (exists (select 1 from prospectos p where p.id = prospecto_id));
create policy pros_notas_crear on public.prospectos_notas for insert to authenticated
  with check (pros_puede('trabajar') and exists (select 1 from prospectos p where p.id = prospecto_id));
create policy pros_notas_borrar on public.prospectos_notas for delete to authenticated using (es_admin());

create policy pros_pagos_ver on public.prospectos_pagos for select to authenticated
  using (pros_puede('pagos') and exists (select 1 from prospectos p where p.id = prospecto_id));
create policy pros_pagos_admin on public.prospectos_pagos for all to authenticated using (es_admin()) with check (es_admin());


-- ---------------------------------------------------------------------------
-- Leads: los que llegan de los anuncios y las redes por ManyChat. Solo los que
-- terminan el filtro son "calificados" (estado nuevo) y NEX les llama una vez.
-- Si agendan, pasan a Prospectos; si no, a la Cartera de prospectos, donde se
-- quedan para el call center. Los que no terminan el filtro quedan como "no
-- calificados" (incompleto). Los ve quien ve todos los prospectos.
-- ---------------------------------------------------------------------------

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  manychat_id text unique, -- su contacto en ManyChat; null si se apuntó a mano
  origen text not null default 'manychat' check (origen in ('manychat', 'manual')),
  canal text not null default '' check (canal in ('', 'instagram', 'facebook')),
  fuente text not null default '' check (char_length(fuente) <= 200), -- la palabra (INFO), el post o el anuncio
  anuncio_id text not null default '' check (char_length(anuncio_id) <= 60),
  nombre text not null default '' check (char_length(nombre) <= 80),
  empresa text not null default '' check (char_length(empresa) <= 120),
  direccion text not null default '' check (char_length(direccion) <= 200),
  telefono text not null default '' check (char_length(telefono) <= 30),
  correo text not null default '' check (char_length(correo) <= 120),
  ciudad text not null default '' check (char_length(ciudad) <= 80),
  pais text not null default '' check (pais in ('', 'mexico', 'usa', 'otro')),
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  servicio text not null default '' check (char_length(servicio) <= 200),
  -- El permiso por escrito para que una IA le llame (en USA es ley). Es un
  -- registro: una vez guardado, nadie lo cambia.
  permiso_llamada boolean not null default false,
  permiso_fecha timestamptz,
  permiso_texto text not null default '' check (char_length(permiso_texto) <= 500),
  estado text not null default 'nuevo' check (estado in ('incompleto', 'nuevo', 'llamando', 'agendado', 'cartera', 'no_llamar')),
  motivo text not null default '' check (motivo in ('', 'no_contesto', 'no_interesa', 'colgo', 'ahora_no', 'numero_malo', 'sin_permiso')),
  -- La llamada de NEX.
  llamada_id text not null default '' check (char_length(llamada_id) <= 120),
  llamada_inicio timestamptz,
  llamada_seg int check (llamada_seg is null or llamada_seg >= 0),
  grabacion text not null default '' check (char_length(grabacion) <= 500),
  resumen text not null default '' check (char_length(resumen) <= 4000),
  puntos jsonb not null default '{}', -- lo que NEX anotó: necesidad, quién decide, urgencia…
  transcripcion text not null default '' check (char_length(transcripcion) <= 60000),
  prospecto_id uuid references public.prospectos (id) on delete set null, -- en qué prospecto se convirtió
  asignado uuid references public.perfiles (id) on delete set null, -- quién del call center lo trabaja
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists leads_estado on public.leads (estado, creado desc);

create table if not exists public.leads_notas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  autor uuid references public.perfiles (id) on delete set null,
  texto text not null check (char_length(texto) between 1 and 2000),
  creada timestamptz not null default now()
);
create index if not exists leads_notas_de on public.leads_notas (lead_id, creada);

create or replace function public.antes_lead() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creado := now();
    if not es_sistema() then
      new.origen := 'manual';
      new.manychat_id := null;
      new.prospecto_id := null;
    end if;
    if new.permiso_llamada then new.permiso_fecha := coalesce(new.permiso_fecha, now()); else new.permiso_fecha := null; end if;
  else
    new.id := old.id;
    new.manychat_id := old.manychat_id;
    new.origen := old.origen;
    new.creado := old.creado;
    -- El permiso queda como se dio: nadie lo cambia después.
    if old.permiso_llamada then
      new.permiso_llamada := old.permiso_llamada;
      new.permiso_fecha := old.permiso_fecha;
      new.permiso_texto := old.permiso_texto;
    elsif new.permiso_llamada then
      new.permiso_fecha := now();
    end if;
    -- Quien pidió no ser llamado no regresa a la fila de llamadas (solo Eduardo puede).
    if old.estado = 'no_llamar' and new.estado <> 'no_llamar' and not es_admin() then
      raise exception 'Pidió no ser llamado: solo Eduardo lo puede cambiar';
    end if;
    if not es_sistema() and not es_admin() and coalesce(current_setting('hq.desde_lead', true), '') <> 'si' then
      new.asignado := old.asignado;
      new.prospecto_id := old.prospecto_id;
    end if;
  end if;
  if new.estado <> 'cartera' then new.motivo := ''; end if;
  new.correo := lower(new.correo);
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists hq_antes_lead on public.leads;
create trigger hq_antes_lead before insert or update on public.leads
  for each row execute function public.antes_lead();

create or replace function public.antes_nota_lead() returns trigger
language plpgsql as $$
begin
  if not es_sistema() then new.autor := auth.uid(); end if;
  new.creada := now();
  return new;
end $$;

drop trigger if exists hq_antes_nota_lead on public.leads_notas;
create trigger hq_antes_nota_lead before insert on public.leads_notas
  for each row execute function public.antes_nota_lead();

-- Agendó: el lead pasa a Prospectos con todo lo que se sabe de él (y su cita,
-- si ya la tiene). Lo hace NEX (sistema), el admin o quien trabaja prospectos.
create or replace function public.lead_a_prospecto(lid uuid, cita timestamptz default null, meet text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare l leads; nuevo uuid;
begin
  select * into l from leads where id = lid;
  if not found or not (es_sistema() or pros_ve(l.asignado, null)) then raise exception 'Ese lead no existe'; end if;
  if not (es_sistema() or pros_puede('trabajar')) then raise exception 'No tienes permiso para trabajar leads'; end if;
  if l.prospecto_id is not null then return l.prospecto_id; end if;
  perform set_config('hq.desde_lead', 'si', true);
  insert into prospectos (nombre, empresa, direccion, whatsapp, correo, lineas, diagnostico, etapa, cita, meet, asignado)
  values (
    l.nombre, l.empresa, l.direccion, l.telefono, l.correo,
    case when l.servicio <> '' then array[left('Pidió en el chat: ' || l.servicio, 80)] else '{}' end,
    jsonb_strip_nulls(jsonb_build_object(
      'pais', case l.pais when 'mexico' then 'México' when 'usa' then 'USA' end,
      'ciudad', nullif(l.ciudad, ''),
      'idioma', case l.idioma when 'en' then 'Inglés' else 'Español' end,
      'quiere', nullif(l.resumen, ''))),
    case when cita is null then 'datos' else 'cita' end,
    -- Las reuniones son con Eduardo: si nadie más lo trabaja, queda a su nombre.
    cita, left(coalesce(meet, ''), 300), coalesce(l.asignado, (select id from perfiles where rol = 'admin' and activo order by creado limit 1)))
  returning id into nuevo;
  update leads set estado = 'agendado', prospecto_id = nuevo where id = lid;
  perform set_config('hq.desde_lead', '', true);
  return nuevo;
end $$;

-- Supabase deja usar las funciones nuevas a cualquiera sin sesión (anon), y
-- sin sesión es_sistema() da verdadero: solo con sesión o con la llave de servicio.
revoke all on function public.lead_a_prospecto(uuid, timestamptz, text) from public, anon;
grant execute on function public.lead_a_prospecto(uuid, timestamptz, text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['leads', 'leads_notas'] loop
    execute format('drop trigger if exists hq_bitacora on public.%I', t);
    execute format('create trigger hq_bitacora after insert or update or delete on public.%I for each row execute function public.anotar_cambio()', t);
  end loop;
end $$;

alter table public.leads enable row level security;
alter table public.leads_notas enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('leads', 'leads_notas')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy leads_ver on public.leads for select to authenticated using (pros_ve(asignado, null));
create policy leads_crear on public.leads for insert to authenticated with check (pros_puede('trabajar'));
create policy leads_cambiar on public.leads for update to authenticated
  using (pros_ve(asignado, null) and pros_puede('trabajar')) with check (pros_ve(asignado, null));
create policy leads_borrar on public.leads for delete to authenticated using (es_admin());

create policy leads_notas_ver on public.leads_notas for select to authenticated
  using (exists (select 1 from leads l where l.id = lead_id));
create policy leads_notas_crear on public.leads_notas for insert to authenticated
  with check (pros_puede('trabajar') and exists (select 1 from leads l where l.id = lead_id));
create policy leads_notas_borrar on public.leads_notas for delete to authenticated using (es_admin());
