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
  -- El admin también marca su propia entrada: si no dice de quién es, es suya.
  if tg_op = 'INSERT' and new.persona is null then new.persona := auth.uid(); end if;
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

-- Los pagos (montos) solo los ve el admin (3 de noviembre de 2026: nadie más ve dinero).
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
-- El resumen y lo que anotó NEX, en español y en inglés: { es: { resumen, puntos }, en: { … } }.
alter table public.leads add column if not exists traduccion jsonb not null default '{}';

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

-- ---------------------------------------------------------------------------
-- Documentos en PDF: las propuestas de cada prospecto (las sube quien lo
-- trabaja y las ve quien ve ese prospecto) y el contrato de cada cliente (lo
-- sube y lo ve solo el admin, como el dinero). Los archivos viven en el
-- almacenamiento privado "documentos"; solo se abren con un link temporal.
-- ---------------------------------------------------------------------------

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('propuesta', 'contrato')),
  prospecto_id uuid references public.prospectos (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 200),
  ruta text not null unique, -- en el almacenamiento "documentos"
  tamano int not null default 0 check (tamano >= 0),
  subido_por uuid references public.perfiles (id) on delete set null,
  creado timestamptz not null default now(),
  check ((tipo = 'propuesta' and prospecto_id is not null) or (tipo = 'contrato' and cliente_id is not null))
);
create index if not exists documentos_prospecto on public.documentos (prospecto_id, creado desc);
create index if not exists documentos_cliente on public.documentos (cliente_id, creado desc);

create or replace function public.antes_documento() returns trigger
language plpgsql as $$
begin
  if not es_sistema() then new.subido_por := auth.uid(); end if;
  new.creado := now();
  return new;
end $$;

drop trigger if exists hq_antes_documento on public.documentos;
create trigger hq_antes_documento before insert on public.documentos
  for each row execute function public.antes_documento();

drop trigger if exists hq_bitacora on public.documentos;
create trigger hq_bitacora after insert or update or delete on public.documentos
  for each row execute function public.anotar_cambio();

alter table public.documentos enable row level security;

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'documentos' loop
    execute format('drop policy if exists %I on public.documentos', r.policyname);
  end loop;
end $$;

-- Propuestas y contratos llevan precios: solo el admin (3 de noviembre de 2026: nadie más ve dinero).
create policy documentos_ver on public.documentos for select to authenticated using (es_admin());
create policy documentos_subir on public.documentos for insert to authenticated with check (es_admin());
create policy documentos_borrar on public.documentos for delete to authenticated using (es_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 20971520, array['application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hq_documentos_ver on storage.objects;
create policy hq_documentos_ver on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and es_admin());
drop policy if exists hq_documentos_subir on storage.objects;
create policy hq_documentos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and es_admin());
drop policy if exists hq_documentos_borrar on storage.objects;
create policy hq_documentos_borrar on storage.objects for delete to authenticated using (bucket_id = 'documentos' and es_admin());

-- ---------------------------------------------------------------------------
-- Contenido y anuncios (solo el admin). Claude crea cada semana las fotos del
-- feed y los videos de los anuncios; caen aquí "por aprobar"; Eduardo los
-- aprueba; se publican solos. NEX lleva los anuncios de Meta: siempre 3
-- activos por mercado dentro del tope del mes, sube presupuesto a lo que
-- funciona y tumba lo que no, y deja aquí su reporte de cada semana.
-- ---------------------------------------------------------------------------

create table if not exists public.anuncios_topes (
  mercado text primary key check (mercado in ('usa', 'mexico')),
  tope_mensual numeric(10, 2) not null default 300 check (tope_mensual >= 0), -- en USD
  zonas text not null default '' check (char_length(zonas) <= 1000), -- dónde se anuncia
  actualizado timestamptz not null default now()
);
insert into public.anuncios_topes (mercado, tope_mensual) values ('usa', 300), ('mexico', 300) on conflict do nothing;

create table if not exists public.anuncios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 200),
  mercado text not null check (mercado in ('usa', 'mexico')),
  meta_ad_id text unique, -- el anuncio en Meta (también llega en leads.anuncio_id)
  estado text not null default 'borrador' check (estado in ('borrador', 'activo', 'pausado', 'terminado')),
  presupuesto_dia numeric(10, 2) not null default 0 check (presupuesto_dia >= 0),
  impresiones int not null default 0,
  clics int not null default 0,
  inicio date,
  fin date,
  motivo text not null default '' check (char_length(motivo) <= 1000), -- por qué se subió, se bajó o se tumbó
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

-- Lo gastado por día de cada anuncio (de Meta), para saber lo del mes.
create table if not exists public.anuncios_gasto (
  anuncio_id uuid not null references public.anuncios (id) on delete cascade,
  dia date not null,
  gasto numeric(10, 2) not null default 0 check (gasto >= 0),
  primary key (anuncio_id, dia)
);

create table if not exists public.contenido (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('foto', 'video')),
  uso text not null check (uso in ('feed', 'anuncio')), -- los videos de anuncio también salen al feed
  mercado text not null default 'ambos' check (mercado in ('usa', 'mexico', 'ambos')),
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  titulo text not null default '' check (char_length(titulo) <= 200),
  texto text not null default '' check (char_length(texto) <= 2200), -- el texto de la publicación
  idea text not null default '' check (char_length(idea) <= 2000), -- por qué se hizo así (lo aprendido)
  archivo text not null default '', -- ruta en el almacenamiento "contenido"
  publicar_en timestamptz,
  estado text not null default 'por_aprobar' check (estado in ('por_aprobar', 'aprobado', 'publicado', 'rechazado')),
  comentario text not null default '' check (char_length(comentario) <= 2000), -- el cambio que pidió Eduardo
  publicado_ig text not null default '',
  publicado_fb text not null default '',
  anuncio_id uuid references public.anuncios (id) on delete set null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists contenido_estado on public.contenido (estado, publicar_en);

-- El reporte de cada semana: lo que funcionó, lo que no y qué se decidió.
create table if not exists public.anuncios_reportes (
  id uuid primary key default gen_random_uuid(),
  semana date not null,
  mercado text not null default 'ambos' check (mercado in ('usa', 'mexico', 'ambos')),
  resumen text not null default '' check (char_length(resumen) <= 4000),
  funciono text not null default '' check (char_length(funciono) <= 4000),
  no_funciono text not null default '' check (char_length(no_funciono) <= 4000),
  decisiones text not null default '' check (char_length(decisiones) <= 4000),
  siguiente text not null default '' check (char_length(siguiente) <= 4000), -- qué se va a crear después
  creado timestamptz not null default now()
);

create or replace function public.al_cambiar_fila() returns trigger
language plpgsql as $$
begin
  new.actualizado := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['anuncios_topes', 'anuncios', 'contenido'] loop
    execute format('drop trigger if exists hq_actualizado on public.%I', t);
    execute format('create trigger hq_actualizado before update on public.%I for each row execute function public.al_cambiar_fila()', t);
  end loop;
  foreach t in array array['anuncios_topes', 'anuncios', 'contenido', 'anuncios_reportes'] loop
    execute format('drop trigger if exists hq_bitacora on public.%I', t);
    execute format('create trigger hq_bitacora after insert or update or delete on public.%I for each row execute function public.anotar_cambio()', t);
  end loop;
  foreach t in array array['anuncios_topes', 'anuncios', 'anuncios_gasto', 'contenido', 'anuncios_reportes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists solo_admin on public.%I', t);
    execute format('create policy solo_admin on public.%I for all to authenticated using (es_admin()) with check (es_admin())', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contenido', 'contenido', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hq_contenido_admin on storage.objects;
create policy hq_contenido_admin on storage.objects for all to authenticated
  using (bucket_id = 'contenido' and es_admin()) with check (bucket_id = 'contenido' and es_admin());

-- Lo que Eduardo quiere lograr con una foto o video que sube él (la IA escribe el texto con esto).
alter table public.contenido add column if not exists objetivo text not null default '' check (char_length(objetivo) <= 1000);

-- El publicador: si algo falla al publicar, aquí queda el porqué (y no se reintenta hasta que Eduardo da "Reintentar").
alter table public.contenido add column if not exists error text not null default '' check (char_length(error) <= 1000);
-- El video de Instagram se prepara en Meta antes de publicarse: aquí queda su "contenedor" mientras tanto.
alter table public.contenido add column if not exists ig_contenedor text not null default '';
-- A qué negocios les hablan los anuncios de cada mercado (lo escribe Eduardo).
alter table public.anuncios_topes add column if not exists negocios text not null default '' check (char_length(negocios) <= 2000);

-- El administrador de anuncios: la campaña y el conjunto de cada mercado en Meta,
-- y el código corto de cada anuncio (viaja en el mensaje del chat para saber qué anuncio trajo a cada lead).
alter table public.anuncios_topes add column if not exists campana_id text not null default '';
alter table public.anuncios_topes add column if not exists conjunto_id text not null default '';
alter table public.anuncios_topes add column if not exists pausado_por_tope boolean not null default false;
alter table public.anuncios add column if not exists codigo text;
create unique index if not exists anuncios_codigo on public.anuncios (codigo) where codigo is not null;
alter table public.anuncios add column if not exists meta_video_id text not null default '';
alter table public.anuncios add column if not exists meta_creative_id text not null default '';
-- Lo último que pasó con los anuncios de cada mercado (o el error), para verlo en HQ → Anuncios.
alter table public.anuncios_topes add column if not exists aviso text not null default '' check (char_length(aviso) <= 1000);

-- Pedidos de video a Claude (botón "✦ Nuevo anuncio" → "Genéralo tú", y los de cada semana).
-- La tarea programada de Claude los toma, genera el video y lo deja en Contenido por aprobar.
create table if not exists public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  uso text not null default 'anuncio' check (uso in ('feed', 'anuncio')),
  mercado text not null default 'usa' check (mercado in ('usa', 'mexico', 'ambos')),
  objetivo text not null default '' check (char_length(objetivo) <= 1000),
  reemplaza uuid references public.anuncios (id) on delete set null, -- el anuncio que se cambia al aprobar el nuevo
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_proceso', 'listo', 'error')),
  nota text not null default '' check (char_length(nota) <= 1000),
  contenido_id uuid references public.contenido (id) on delete set null,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
drop trigger if exists hq_actualizado on public.solicitudes;
create trigger hq_actualizado before update on public.solicitudes for each row execute function public.al_cambiar_fila();
alter table public.solicitudes enable row level security;
drop policy if exists solo_admin on public.solicitudes;
create policy solo_admin on public.solicitudes for all to authenticated using (es_admin()) with check (es_admin());

-- El anuncio que se cambia por esta pieza cuando se aprueba (y Seguir/Cambiar en cada anuncio).
alter table public.contenido add column if not exists reemplaza uuid references public.anuncios (id) on delete set null;
alter table public.anuncios add column if not exists recomendacion text not null default '' check (recomendacion in ('', 'seguir', 'cambiar', 'esperar'));

-- El motor de publicación (1 de noviembre de 2026): una sola cosa a la vez publica en el feed y pone
-- anuncios en Meta, así nada se duplica aunque Eduardo apruebe mientras corre la revisión automática.
-- Cada anuncio sale de una pieza de Contenido y de un mercado: nunca dos anuncios de la misma pieza en el mismo mercado.
alter table public.anuncios add column if not exists contenido_id uuid references public.contenido (id) on delete set null;
update public.anuncios a set contenido_id = c.id from public.contenido c where c.anuncio_id = a.id and a.contenido_id is null;
create unique index if not exists anuncios_pieza_mercado on public.anuncios (contenido_id, mercado) where contenido_id is not null;
-- Pausado a mano por Eduardo (⏸): nada sale al aire en ese mercado hasta que le dé ▶ Reanudar.
alter table public.anuncios_topes add column if not exists pausado_manual boolean not null default false;
-- El día (hora de Nueva York) de la última revisión de los lunes, para no repetirla.
alter table public.anuncios_topes add column if not exists ultima_revision date;
-- Cuándo se intentó publicar en Facebook / Instagram: si la llamada se cortó, antes de reintentar se busca la publicación en Meta.
alter table public.contenido add column if not exists fb_intento timestamptz;
alter table public.contenido add column if not exists ig_intento timestamptz;

create table if not exists public.candados (
  nombre text primary key,
  hasta timestamptz not null default now(),
  pedido timestamptz
);
alter table public.candados enable row level security; -- sin políticas: solo el sistema (Netlify) lo usa

-- Toma el candado si está libre (o si quien lo tenía se quedó colgado más de "segundos").
create or replace function public.tomar_candado(n text, segundos int) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into candados (nombre, hasta) values (n, now() + make_interval(secs => segundos))
  on conflict (nombre) do update set hasta = excluded.hasta where candados.hasta < now();
  return found;
end $$;
create or replace function public.soltar_candado(n text) returns void
language sql security definer set search_path = public as $$
  update candados set hasta = now() - interval '1 second' where nombre = n;
$$;
-- "Hay algo nuevo": si el motor está corriendo, da otra vuelta al terminar.
create or replace function public.pedir_candado(n text) returns void
language sql security definer set search_path = public as $$
  insert into candados (nombre, hasta, pedido) values (n, now() - interval '1 second', now())
  on conflict (nombre) do update set pedido = now();
$$;
revoke all on function public.tomar_candado(text, int) from public, anon, authenticated;
revoke all on function public.soltar_candado(text) from public, anon, authenticated;
revoke all on function public.pedir_candado(text) from public, anon, authenticated;
grant execute on function public.tomar_candado(text, int) to service_role;
grant execute on function public.soltar_candado(text) to service_role;
grant execute on function public.pedir_candado(text) to service_role;

-- La IA ve cada foto o video antes de escribir su texto (1 de noviembre de 2026): qué muestra y
-- dice la pieza, y la palabra que pide escribir ("AUTOMATIZACIÓN", "OPERACIONES"…), para que el texto coincida.
alter table public.contenido add column if not exists analisis text not null default '' check (char_length(analisis) <= 4000);
alter table public.contenido add column if not exists palabra text not null default '' check (char_length(palabra) <= 40);

-- NEX llama en cuanto el lead acepta (2 de noviembre de 2026). Si la llamada no sale, el porqué
-- queda a la vista en HQ y se reintenta hasta 3 veces; después, a la Cartera.
alter table public.leads add column if not exists llamada_error text not null default '' check (char_length(llamada_error) <= 500);
alter table public.leads add column if not exists intentos int not null default 0 check (intentos >= 0);

-- El equipo (3 de noviembre de 2026): cada quien entra con su USUARIO (no su correo) y la contraseña que
-- le puso Eduardo; al entrar se le ofrece cambiarla (y después, en "Mi cuenta"). El correo real es para
-- mandarle su acceso. Por dentro, Supabase usa <usuario>@equipo.nxusai.org.
alter table public.perfiles add column if not exists usuario text;
create unique index if not exists perfiles_usuario on public.perfiles (lower(usuario)) where usuario is not null;
alter table public.perfiles add column if not exists cambiar_clave boolean not null default false;
create or replace function public.ya_cambie_mi_clave() returns void
language sql security definer set search_path = public as $$
  update perfiles set cambiar_clave = false where id = auth.uid();
$$;
revoke all on function public.ya_cambie_mi_clave() from public, anon;
grant execute on function public.ya_cambie_mi_clave() to authenticated;
-- Nadie más que el admin ve dinero: el permiso "ver lo que pagaron" se apaga para todos.
update public.perfiles set pros_pagos = false where rol <> 'admin' and pros_pagos;

-- Mis pendientes, metas y hábitos (12 de noviembre de 2026): lo personal de Eduardo. SOLO el admin lo ve
-- (ni el equipo ni los socios). NEX (en su Mac, por Telegram) los apunta y los consulta con la llave
-- PENDIENTES_CLAVE a través de functions/pendientes.mjs.
create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  area text not null default 'negocios' check (area in ('negocios', 'patrimonio', 'salud', 'familia', 'crecimiento', 'disfrute')),
  titulo text not null check (char_length(titulo) between 1 and 200),
  porque text not null default '' check (char_length(porque) <= 1000), -- para qué la quiere (NEX se lo recuerda)
  periodo text not null default 'año' check (periodo in ('año', 'mes')),
  fecha_limite date,
  progreso int not null default 0 check (progreso between 0 and 100), -- a mano, si no tiene pendientes ligados
  estado text not null default 'activa' check (estado in ('activa', 'lograda', 'pausada')),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create table if not exists public.pendientes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 300),
  notas text not null default '' check (char_length(notas) <= 4000),
  area text not null default 'negocios' check (area in ('negocios', 'patrimonio', 'salud', 'familia', 'crecimiento', 'disfrute')),
  empresa text not null default '' check (char_length(empresa) <= 60), -- NXUS AI, Mi Semago, Abuelito…
  fecha date, -- sin fecha = "Algún día"
  hora time,
  prioridad text not null default 'normal' check (prioridad in ('alta', 'media', 'normal')),
  estrella boolean not null default false, -- de "las tres de hoy", elegida a mano
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecho')),
  hecho_en timestamptz,
  meta_id uuid references public.metas (id) on delete set null,
  origen text not null default 'hq' check (origen in ('hq', 'nex')),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists pendientes_estado on public.pendientes (estado, fecha);
create table if not exists public.habitos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 120),
  area text not null default 'salud' check (area in ('negocios', 'patrimonio', 'salud', 'familia', 'crecimiento', 'disfrute')),
  activo boolean not null default true,
  creado timestamptz not null default now()
);
create table if not exists public.habitos_dias (
  habito_id uuid not null references public.habitos (id) on delete cascade,
  dia date not null,
  primary key (habito_id, dia)
);
drop trigger if exists hq_actualizado on public.metas;
create trigger hq_actualizado before update on public.metas for each row execute function public.al_cambiar_fila();
drop trigger if exists hq_actualizado on public.pendientes;
create trigger hq_actualizado before update on public.pendientes for each row execute function public.al_cambiar_fila();
do $$
declare t text;
begin
  foreach t in array array['metas', 'pendientes', 'habitos', 'habitos_dias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists solo_admin on public.%I', t);
    execute format('create policy solo_admin on public.%I for all to authenticated using (es_admin()) with check (es_admin())', t);
  end loop;
end $$;

-- ===========================================================================
-- Permisos, Finanzas y ahorro para metas (12 de noviembre de 2026)
-- ===========================================================================
-- Permisos: Eduardo (admin) decide, persona por persona, qué puede ver y hacer.
-- Cada permiso es una palabra en perfiles.permisos; la base de datos los hace
-- cumplir (no solo la pantalla). Lo personal de Eduardo (pendientes, metas,
-- hábitos, gastos personales y el ahorro para sus metas) NUNCA se comparte.
--   clientes_editar · clientes_borrar · clientes_dinero
--   tareas_todas · tareas_borrar
--   asistencia_ver · asistencia_corregir
--   nomina_ver · nomina_editar
--   finanzas_ver · finanzas_editar
--   anuncios_gasto · documentos_ver · bitacora_ver · personas_gestionar
alter table public.perfiles add column if not exists permisos text[] not null default '{}';
alter table public.perfiles add column if not exists acceso_hasta timestamptz; -- acceso temporal (ej. el contador en temporada de impuestos)
alter table public.perfiles add column if not exists plantilla text not null default '';

-- Con acceso vencido, la persona deja de existir para HQ (como si estuviera apagada).
create or replace function public.yo_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo and (rol = 'admin' or acceso_hasta is null or acceso_hasta > now())
$$;

create or replace function public.puede(que text) returns boolean
language sql stable security definer set search_path = public as $$
  select es_admin() or (es_alguien() and exists (select 1 from perfiles p where p.id = auth.uid() and que = any (p.permisos)))
$$;
revoke all on function public.puede(text) from public, anon;
grant execute on function public.puede(text) to authenticated;

create or replace function public.pros_puede(que text) returns boolean
language sql stable security definer set search_path = public as $$
  select es_admin() or (es_alguien() and exists (
    select 1 from perfiles p where p.id = auth.uid() and case que
      when 'trabajar' then p.pros_trabajar
      when 'etapas' then p.pros_etapas
      when 'convertir' then p.pros_convertir
      when 'pagos' then p.pros_pagos
      else false end))
$$;
create or replace function public.pros_ve(asignado uuid, traido uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select es_admin() or (es_alguien() and exists (
    select 1 from perfiles p where p.id = auth.uid()
      and (p.pros_ver = 'todos' or (p.pros_ver = 'suyos' and auth.uid() in (asignado, traido)))))
$$;

-- Nadie se da permisos a sí mismo: los permisos, el rol y el acceso solo los cambia el admin.
create or replace function public.cuidar_perfil() returns trigger
language plpgsql as $$
begin
  if es_sistema() then return new; end if;
  if new.id <> old.id then raise exception 'No se puede cambiar el id'; end if;
  if old.id = auth.uid() and (new.rol <> old.rol or not new.activo or new.acceso_hasta is not null) then
    raise exception 'No te puedes quitar tu propio acceso de admin';
  end if;
  if new.rol = 'admin' then new.permisos := '{}'; new.acceso_hasta := null; end if;
  return new;
end $$;

-- La bitácora ahora guarda QUÉ cambió (antes y después), para que un contador o auditor lo revise.
alter table public.bitacora add column if not exists antes jsonb;
alter table public.bitacora add column if not exists despues jsonb;
create or replace function public.anotar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare a jsonb; d jsonb; k text;
begin
  if tg_op <> 'INSERT' then a := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then d := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(d) loop
      if a -> k = d -> k then a := a - k; d := d - k; end if;
    end loop;
    a := a - 'actualizado' - 'actualizada'; d := d - 'actualizado' - 'actualizada';
    if d = '{}'::jsonb then return null; end if;
  end if;
  -- En gastos siempre va si es del negocio o personal (lo personal solo lo ve el admin).
  if tg_table_name = 'gastos' then
    d := coalesce(d, '{}'::jsonb) || jsonb_build_object('tipo', (case when tg_op = 'DELETE' then old else new end).tipo);
  end if;
  insert into bitacora (quien, accion, tabla, fila, antes, despues)
  values (
    auth.uid(), lower(tg_op), tg_table_name,
    coalesce(to_jsonb(case when tg_op = 'DELETE' then old else new end) ->> 'id',
             to_jsonb(case when tg_op = 'DELETE' then old else new end) ->> 'persona',
             to_jsonb(case when tg_op = 'DELETE' then old else new end) ->> 'cliente_id'),
    a, d);
  return null;
end $$;

-- Clientes
drop policy if exists clientes_crear on public.clientes;
drop policy if exists clientes_cambiar on public.clientes;
drop policy if exists clientes_borrar on public.clientes;
create policy clientes_crear on public.clientes for insert to authenticated with check (puede('clientes_editar'));
create policy clientes_cambiar on public.clientes for update to authenticated using (puede('clientes_editar')) with check (puede('clientes_editar'));
create policy clientes_borrar on public.clientes for delete to authenticated using (puede('clientes_borrar'));

-- Lo que paga cada cliente: el admin y a quien le dé permiso.
-- Cómo cobra: mensual (día fijo), quincenal (dos días del mes), catorcenal (cada dos semanas, ej. "cada dos viernes"),
-- semanal, bimestral, trimestral, semestral, anual, pago único o "sin fecha fija" (se registra cada cobro al llegar).
alter table public.clientes_dinero add column if not exists frecuencia text not null default 'mensual';
alter table public.clientes_dinero add column if not exists monto_cobro numeric(12, 2) not null default 0; -- lo de CADA cobro
alter table public.clientes_dinero add column if not exists cobro_ancla date; -- un día en que sí pagó o pagará (para "cada dos viernes")
alter table public.clientes_dinero add column if not exists cobro_dias int[] not null default '{}'; -- días del mes (mensual / quincenal)
alter table public.clientes_dinero drop constraint if exists clientes_dinero_frecuencia_check;
alter table public.clientes_dinero add constraint clientes_dinero_frecuencia_check
  check (frecuencia in ('mensual', 'quincenal', 'catorcenal', 'semanal', 'bimestral', 'trimestral', 'semestral', 'anual', 'unico', 'irregular'));
update public.clientes_dinero set monto_cobro = mensualidad where monto_cobro = 0 and mensualidad > 0 and frecuencia = 'mensual';
drop policy if exists dinero_admin on public.clientes_dinero;
drop policy if exists dinero_ver on public.clientes_dinero;
drop policy if exists dinero_escribir on public.clientes_dinero;
drop policy if exists dinero_cambiar on public.clientes_dinero;
drop policy if exists dinero_borrar on public.clientes_dinero;
create policy dinero_ver on public.clientes_dinero for select to authenticated using (puede('clientes_dinero') or puede('finanzas_ver'));
create policy dinero_escribir on public.clientes_dinero for insert to authenticated with check (puede('finanzas_editar'));
create policy dinero_cambiar on public.clientes_dinero for update to authenticated using (puede('finanzas_editar')) with check (puede('finanzas_editar'));
create policy dinero_borrar on public.clientes_dinero for delete to authenticated using (puede('finanzas_editar'));

-- Consultorías cobradas (Stripe): verlas con permiso de finanzas.
drop policy if exists pros_pagos_admin on public.prospectos_pagos;
drop policy if exists pros_pagos_ver on public.prospectos_pagos;
drop policy if exists pros_pagos_escribir on public.prospectos_pagos;
create policy pros_pagos_ver on public.prospectos_pagos for select to authenticated using (puede('finanzas_ver'));
create policy pros_pagos_escribir on public.prospectos_pagos for all to authenticated using (es_admin()) with check (es_admin());

-- Tareas
drop policy if exists tareas_ver on public.tareas;
drop policy if exists tareas_cambiar on public.tareas;
drop policy if exists tareas_borrar on public.tareas;
create policy tareas_ver on public.tareas for select to authenticated
  using (puede('tareas_todas') or asignado = auth.uid() or creada_por = auth.uid());
create policy tareas_cambiar on public.tareas for update to authenticated
  using (puede('tareas_todas') or asignado = auth.uid() or creada_por = auth.uid())
  with check (puede('tareas_todas') or asignado = auth.uid() or creada_por = auth.uid());
create policy tareas_borrar on public.tareas for delete to authenticated using (puede('tareas_borrar'));
create or replace function public.antes_tarea() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creada := now();
    if not es_sistema() then new.creada_por := auth.uid(); end if;
  else
    new.creada := old.creada;
    new.creada_por := old.creada_por;
    if not es_sistema() and not puede('tareas_todas') and old.creada_por is distinct from auth.uid() then
      if new.titulo <> old.titulo or new.detalle <> old.detalle or new.asignado is distinct from old.asignado
         or new.cliente_id is distinct from old.cliente_id or new.vence is distinct from old.vence then
        raise exception 'Solo quien creó la tarea (o el admin) cambia eso; tú mueves su estado';
      end if;
    end if;
  end if;
  new.actualizada := now();
  return new;
end $$;

-- Asistencia (entradas y salidas)
drop policy if exists jornadas_ver on public.jornadas;
drop policy if exists jornadas_entrar on public.jornadas;
drop policy if exists jornadas_salir on public.jornadas;
create policy jornadas_ver on public.jornadas for select to authenticated using (puede('asistencia_ver') or persona = auth.uid());
create policy jornadas_entrar on public.jornadas for insert to authenticated with check (es_alguien());
create policy jornadas_salir on public.jornadas for update to authenticated
  using (puede('asistencia_corregir') or (persona = auth.uid() and salida is null))
  with check (puede('asistencia_corregir') or persona = auth.uid());
create or replace function public.antes_jornada() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.persona is null then new.persona := auth.uid(); end if;
  if es_sistema() or puede('asistencia_corregir') then return new; end if;
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
    new.nota := old.nota;
    new.salida := case when new.salida is null then null else now() end;
  end if;
  return new;
end $$;

-- Nómina, ajustes y comisiones: ver y cambiar, por separado.
do $$
declare t text;
begin
  foreach t in array array['nomina', 'nomina_ajustes', 'comisiones'] loop
    execute format('drop policy if exists nomina_admin on public.%I', t);
    execute format('drop policy if exists ajustes_admin on public.%I', t);
    execute format('drop policy if exists comisiones_admin on public.%I', t);
    execute format('drop policy if exists permiso_ver on public.%I', t);
    execute format('drop policy if exists permiso_crear on public.%I', t);
    execute format('drop policy if exists permiso_cambiar on public.%I', t);
    execute format('drop policy if exists permiso_borrar on public.%I', t);
    execute format('create policy permiso_ver on public.%I for select to authenticated using (puede(''nomina_ver''))', t);
    execute format('create policy permiso_crear on public.%I for insert to authenticated with check (puede(''nomina_editar''))', t);
    execute format('create policy permiso_cambiar on public.%I for update to authenticated using (puede(''nomina_editar'')) with check (puede(''nomina_editar''))', t);
    execute format('create policy permiso_borrar on public.%I for delete to authenticated using (puede(''nomina_editar''))', t);
  end loop;
end $$;

-- Bitácora y documentos (propuestas y contratos)
-- La bitácora guarda montos (antes → después): quien la ve, solo ve lo que ya podría ver.
drop policy if exists bitacora_ver on public.bitacora;
create policy bitacora_ver on public.bitacora for select to authenticated using (
  es_admin() or (
    puede('bitacora_ver')
    and tabla not in ('metas_aportes', 'metas', 'pendientes', 'habitos', 'habitos_dias')
    and (tabla not in ('clientes_dinero', 'cobros', 'cobros_omitidos', 'finanzas_config', 'prospectos_pagos', 'gastos') or puede('finanzas_ver') or (tabla = 'clientes_dinero' and puede('clientes_dinero')))
    and (tabla <> 'gastos' or coalesce(despues ->> 'tipo', antes ->> 'tipo') = 'negocio')
    and (tabla not in ('nomina', 'nomina_ajustes', 'comisiones') or puede('nomina_ver'))
  ));
drop policy if exists documentos_ver on public.documentos;
create policy documentos_ver on public.documentos for select to authenticated using (puede('documentos_ver'));
drop policy if exists hq_documentos_ver on storage.objects;
create policy hq_documentos_ver on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and puede('documentos_ver'));

-- Cobros: cada pago que de verdad llegó (de un cliente o cualquier otro ingreso).
create table if not exists public.cobros (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes (id) on delete set null,
  concepto text not null default '' check (char_length(concepto) <= 200),
  monto numeric(12, 2) not null check (monto > 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'MXN')),
  fecha date not null default current_date,
  para_fecha date, -- el cobro programado que cubre (para saber quién ya pagó)
  metodo text not null default '' check (char_length(metodo) <= 60),
  nota text not null default '' check (char_length(nota) <= 500),
  creado_por uuid default auth.uid() references public.perfiles (id) on delete set null,
  creado timestamptz not null default now()
);
create index if not exists cobros_fecha on public.cobros (fecha desc);
-- "Este no pagó" (o "se recorrió"): se marca para que no salga como pendiente.
create table if not exists public.cobros_omitidos (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  fecha date not null,
  motivo text not null default '' check (char_length(motivo) <= 200),
  primary key (cliente_id, fecha)
);

-- Gastos: lo que sale, con cada cuándo y en qué días.
create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  concepto text not null check (char_length(concepto) between 1 and 200),
  categoria text not null default 'otros',
  tipo text not null default 'negocio' check (tipo in ('negocio', 'personal')),
  empresa text not null default 'NXUS AI' check (char_length(empresa) <= 60),
  monto numeric(12, 2) not null check (monto >= 0),
  moneda text not null default 'USD' check (moneda in ('USD', 'MXN')),
  frecuencia text not null default 'mensual'
    check (frecuencia in ('mensual', 'quincenal', 'catorcenal', 'semanal', 'bimestral', 'trimestral', 'semestral', 'anual', 'unico')),
  ancla date, -- desde cuándo (o la fecha del pago único / de un pago de "cada dos semanas")
  dias int[] not null default '{}', -- días del mes en que se paga (mensual / quincenal)
  hasta date, -- se termina (ej. un préstamo)
  activo boolean not null default true,
  notas text not null default '' check (char_length(notas) <= 1000),
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

-- Ajustes de finanzas: tipo de cambio, saldo en el banco y la meta de lo que quiere que le sobre.
create table if not exists public.finanzas_config (
  id int primary key default 1 check (id = 1),
  tipo_cambio numeric(10, 4) not null default 18.5 check (tipo_cambio > 0), -- pesos por dólar
  moneda_base text not null default 'USD' check (moneda_base in ('USD', 'MXN')),
  saldo numeric(14, 2) not null default 0,
  saldo_moneda text not null default 'USD' check (saldo_moneda in ('USD', 'MXN')),
  saldo_fecha timestamptz,
  meta_libre numeric(12, 2) not null default 10000, -- lo que quiere que le quede libre al mes (en la moneda base)
  actualizado timestamptz not null default now()
);
-- Desde cuándo HQ lleva las cuentas: lo de antes no sale como "cobro sin confirmar" ni como gasto.
alter table public.finanzas_config add column if not exists desde date not null default current_date;
insert into public.finanzas_config (id) values (1) on conflict (id) do nothing;

-- Metas con dinero: cuánto cuesta, cuánto lleva apartado y cuánto piensa apartar.
alter table public.metas add column if not exists monto_objetivo numeric(14, 2) not null default 0;
alter table public.metas add column if not exists moneda text not null default 'USD';
alter table public.metas add column if not exists aporte_monto numeric(12, 2) not null default 0;
alter table public.metas add column if not exists aporte_frecuencia text not null default '';
alter table public.metas drop constraint if exists metas_aporte_frecuencia_check;
alter table public.metas add constraint metas_aporte_frecuencia_check check (aporte_frecuencia in ('', 'semanal', 'catorcenal', 'quincenal', 'mensual'));
create table if not exists public.metas_aportes (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references public.metas (id) on delete cascade,
  monto numeric(12, 2) not null check (monto <> 0), -- negativo = lo saqué
  moneda text not null default 'USD' check (moneda in ('USD', 'MXN')),
  fecha date not null default current_date,
  nota text not null default '' check (char_length(nota) <= 300),
  creado timestamptz not null default now()
);

drop trigger if exists hq_actualizado on public.gastos;
create trigger hq_actualizado before update on public.gastos for each row execute function public.al_cambiar_fila();
drop trigger if exists hq_actualizado on public.finanzas_config;
create trigger hq_actualizado before update on public.finanzas_config for each row execute function public.al_cambiar_fila();
do $$
declare t text;
begin
  foreach t in array array['cobros', 'cobros_omitidos', 'gastos', 'finanzas_config', 'metas_aportes', 'clientes_dinero', 'perfiles'] loop
    execute format('drop trigger if exists hq_bitacora on public.%I', t);
    execute format('create trigger hq_bitacora after insert or update or delete on public.%I for each row execute function public.anotar_cambio()', t);
  end loop;
  foreach t in array array['cobros', 'cobros_omitidos', 'gastos', 'finanzas_config', 'metas_aportes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists solo_admin on public.%I', t);
    execute format('drop policy if exists permiso_ver on public.%I', t);
    execute format('drop policy if exists permiso_crear on public.%I', t);
    execute format('drop policy if exists permiso_cambiar on public.%I', t);
    execute format('drop policy if exists permiso_borrar on public.%I', t);
  end loop;
end $$;
-- Cobros: ver con finanzas_ver; registrar y corregir con finanzas_editar.
create policy permiso_ver on public.cobros for select to authenticated using (puede('finanzas_ver'));
create policy permiso_crear on public.cobros for insert to authenticated with check (puede('finanzas_editar'));
create policy permiso_cambiar on public.cobros for update to authenticated using (puede('finanzas_editar')) with check (puede('finanzas_editar'));
create policy permiso_borrar on public.cobros for delete to authenticated using (puede('finanzas_editar'));
create policy permiso_ver on public.cobros_omitidos for select to authenticated using (puede('finanzas_ver'));
create policy permiso_crear on public.cobros_omitidos for insert to authenticated with check (puede('finanzas_editar'));
create policy permiso_borrar on public.cobros_omitidos for delete to authenticated using (puede('finanzas_editar'));
-- Gastos: los del negocio con permiso; los personales SOLO el admin.
create policy permiso_ver on public.gastos for select to authenticated using (es_admin() or (tipo = 'negocio' and puede('finanzas_ver')));
create policy permiso_crear on public.gastos for insert to authenticated with check (es_admin() or (tipo = 'negocio' and puede('finanzas_editar')));
create policy permiso_cambiar on public.gastos for update to authenticated
  using (es_admin() or (tipo = 'negocio' and puede('finanzas_editar'))) with check (es_admin() or (tipo = 'negocio' and puede('finanzas_editar')));
create policy permiso_borrar on public.gastos for delete to authenticated using (es_admin() or (tipo = 'negocio' and puede('finanzas_editar')));
-- Ajustes: los ve quien ve finanzas; solo el admin los cambia.
create policy permiso_ver on public.finanzas_config for select to authenticated using (puede('finanzas_ver'));
create policy permiso_cambiar on public.finanzas_config for update to authenticated using (es_admin()) with check (es_admin());
-- El ahorro para sus metas: SOLO el admin.
create policy solo_admin on public.metas_aportes for all to authenticated using (es_admin()) with check (es_admin());

-- ===========================================================================
-- Cuentas, dos monedas y traspasos (12 de noviembre de 2026)
-- ===========================================================================
-- Eduardo cobra en dólares y en pesos, y paga en las dos (la nómina en pesos). El dinero cae
-- a una cuenta americana principal y de ahí reparte a la cuenta de México y a otra americana;
-- un contrato de México le paga directo a la cuenta de México. Cada cobro y cada gasto sabe
-- de qué cuenta entra o sale; los traspasos (con cambio de moneda) mueven entre cuentas.
create table if not exists public.cuentas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 80),
  banco text not null default '' check (char_length(banco) <= 80),
  moneda text not null default 'USD' check (moneda in ('USD', 'MXN')),
  saldo numeric(14, 2) not null default 0,
  saldo_fecha timestamptz,
  principal boolean not null default false, -- donde cae el dinero (de aquí se reparte)
  activa boolean not null default true,
  orden int not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create table if not exists public.traspasos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date, -- en el futuro = programado
  de_cuenta uuid not null references public.cuentas (id) on delete cascade,
  a_cuenta uuid not null references public.cuentas (id) on delete cascade,
  sale numeric(14, 2) not null check (sale > 0), -- en la moneda de la cuenta de origen
  entra numeric(14, 2) not null check (entra > 0), -- en la moneda de la cuenta destino (con el cambio)
  nota text not null default '' check (char_length(nota) <= 300),
  creado timestamptz not null default now(),
  check (de_cuenta <> a_cuenta)
);
alter table public.cobros add column if not exists cuenta_id uuid references public.cuentas (id) on delete set null;
alter table public.gastos add column if not exists cuenta_id uuid references public.cuentas (id) on delete set null;
alter table public.clientes_dinero add column if not exists cuenta_id uuid references public.cuentas (id) on delete set null;
alter table public.finanzas_config add column if not exists nomina_cuenta uuid references public.cuentas (id) on delete set null;
alter table public.finanzas_config add column if not exists cambio_auto boolean not null default true; -- tipo de cambio del día, solo
alter table public.metas add column if not exists cuenta_id uuid references public.cuentas (id) on delete set null; -- de dónde sale lo que aparta

-- Las cuentas de arranque (se pueden renombrar, poner banco y saldo en Finanzas → Cuentas).
insert into public.cuentas (nombre, moneda, principal, orden)
select * from (values ('Cuenta USA principal', 'USD', true, 1), ('Cuenta USA 2', 'USD', false, 2), ('Cuenta México', 'MXN', false, 3)) v(nombre, moneda, principal, orden)
where not exists (select 1 from public.cuentas);
update public.finanzas_config set nomina_cuenta = (select id from public.cuentas where moneda = 'MXN' order by orden limit 1) where nomina_cuenta is null;

drop trigger if exists hq_actualizado on public.cuentas;
create trigger hq_actualizado before update on public.cuentas for each row execute function public.al_cambiar_fila();
do $$
declare t text;
begin
  foreach t in array array['cuentas', 'traspasos'] loop
    execute format('drop trigger if exists hq_bitacora on public.%I', t);
    execute format('create trigger hq_bitacora after insert or update or delete on public.%I for each row execute function public.anotar_cambio()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists permiso_ver on public.%I', t);
    execute format('drop policy if exists permiso_crear on public.%I', t);
    execute format('drop policy if exists permiso_cambiar on public.%I', t);
    execute format('drop policy if exists permiso_borrar on public.%I', t);
    execute format('create policy permiso_ver on public.%I for select to authenticated using (puede(''finanzas_ver''))', t);
    execute format('create policy permiso_crear on public.%I for insert to authenticated with check (puede(''finanzas_editar''))', t);
    execute format('create policy permiso_cambiar on public.%I for update to authenticated using (puede(''finanzas_editar'')) with check (puede(''finanzas_editar''))', t);
    execute format('create policy permiso_borrar on public.%I for delete to authenticated using (es_admin())', t);
  end loop;
end $$;
-- La bitácora de cuentas y traspasos: con permiso de finanzas.
drop policy if exists bitacora_ver on public.bitacora;
create policy bitacora_ver on public.bitacora for select to authenticated using (
  es_admin() or (
    puede('bitacora_ver')
    and tabla not in ('metas_aportes', 'metas', 'pendientes', 'habitos', 'habitos_dias')
    and (tabla not in ('clientes_dinero', 'cobros', 'cobros_omitidos', 'finanzas_config', 'prospectos_pagos', 'gastos', 'cuentas', 'traspasos') or puede('finanzas_ver') or (tabla = 'clientes_dinero' and puede('clientes_dinero')))
    and (tabla <> 'gastos' or coalesce(despues ->> 'tipo', antes ->> 'tipo') = 'negocio')
    and (tabla not in ('nomina', 'nomina_ajustes', 'comisiones') or puede('nomina_ver'))
  ));
