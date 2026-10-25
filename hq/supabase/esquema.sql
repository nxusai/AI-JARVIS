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
