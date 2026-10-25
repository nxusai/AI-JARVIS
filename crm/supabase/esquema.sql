-- Centro de trabajo Mi Semago · Abuelito
--
-- Se pega una sola vez en Supabase → SQL Editor → Run. Crea las tablas, los
-- candados (quién puede ver y tocar qué) y el lugar de los archivos.
--
-- Las reglas viven aquí, en la base de datos, no en la página: aunque alguien
-- se brincara la página, la base de datos no le deja.
--
--   cliente  pide tareas y correcciones, aprueba, ve y descarga.
--            Solo ve SUS tareas (Senen no ve las de Gerardo, ni al revés).
--            Lo que escribe no lo puede cambiar nadie.
--   equipo   mueve estatus y fecha compromiso, sube los PDFs, organiza la
--            biblioteca y los catálogos. No puede cambiar lo que escribió el
--            cliente ni aprobar por él.
--   admin    lo mismo que el equipo, más usuarios, bitácora y borrar.
--
-- Nada se reemplaza: cada PDF nuevo (entrega, corrección, versión) se guarda
-- junto a los anteriores. Lo que pidió el cliente no se cambia: si cambia de
-- idea, agrega una actualización (texto y/o archivos) dentro de la misma tarea.
-- Borrar solo lo puede el admin.
--
-- Se puede volver a correr completo sin perder nada (así se aplican mejoras).

-- ---------------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------------

create table if not exists public.empresas (
  id text primary key,
  nombre text not null,
  grupo text,
  orden int not null default 0,
  activa boolean not null default true
);

insert into public.empresas (id, nombre, grupo, orden, activa) values
  ('abuelito-cheese', 'Abuelito Cheese', 'Abuelito INC', 1, true),
  ('abuelito-meat', 'Abuelito Meat', 'Abuelito INC', 2, true),
  ('abuelito-corn', 'Abuelito Corn', 'Abuelito INC', 3, true),
  ('mi-semago', 'Mi Semago', null, 4, true),
  ('vayro', 'VAYRO', null, 5, false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Personas
-- ---------------------------------------------------------------------------

create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  correo text not null default '',
  rol text not null default 'cliente' check (rol in ('admin', 'equipo', 'cliente')),
  activo boolean not null default false,
  empresas text[], -- null = todas
  ve_tareas boolean not null default true,
  ve_biblioteca boolean not null default true,
  ve_catalogos boolean not null default true,
  telegram text,
  creado timestamptz not null default now()
);

-- Quién habla con Ultron (la dirección). Lo prende el admin en Usuarios.
alter table public.perfiles add column if not exists ultron boolean not null default false;

-- Quién soy, según la sesión. "security definer" para que las reglas de
-- perfiles no se muerdan la cola.
create or replace function public.yo_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

create or replace function public.es_equipo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(yo_rol() in ('admin', 'equipo'), false)
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(yo_rol() = 'admin', false)
$$;

-- Si puedo ver una empresa en una sección ('tareas', 'biblioteca', 'catalogos').
create or replace function public.veo(seccion text, empresa text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles p
    where p.id = auth.uid() and p.activo
      and (
        p.rol in ('admin', 'equipo')
        or (
          (p.empresas is null or empresa = any (p.empresas))
          and case seccion
            when 'tareas' then p.ve_tareas
            when 'biblioteca' then p.ve_biblioteca
            when 'catalogos' then p.ve_catalogos
            else false
          end
        )
      )
  )
$$;

-- Lo hace el sistema (aprobar, fechas automáticas), no una persona a mano.
create or replace function public.es_sistema() returns boolean
language sql stable as $$
  select auth.uid() is null or coalesce(current_setting('crm.sistema', true), '') = '1'
$$;

-- Cada usuario nuevo nace con su perfil. El primero de todos es el admin; los
-- demás nacen apagados hasta que el admin los acomoda (los crea el admin desde
-- la página, nadie se puede registrar solo).
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, correo, rol, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.email, ''),
    case when exists (select 1 from perfiles where rol = 'admin') then 'cliente' else 'admin' end,
    not exists (select 1 from perfiles where rol = 'admin')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists crm_nuevo_usuario on auth.users;
create trigger crm_nuevo_usuario after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- El admin no se puede quitar a sí mismo lo de admin (para no quedarse fuera).
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

drop trigger if exists crm_cuidar_perfil on public.perfiles;
create trigger crm_cuidar_perfil before update on public.perfiles
  for each row execute function public.cuidar_perfil();

-- ---------------------------------------------------------------------------
-- Tareas y correcciones
-- ---------------------------------------------------------------------------

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  folio serial unique,
  -- Del cliente (nadie más lo cambia)
  cliente_id uuid not null references public.perfiles (id),
  empresa_id text not null references public.empresas (id),
  titulo text not null check (char_length(titulo) between 1 and 200),
  descripcion text not null default '' check (char_length(descripcion) <= 5000),
  urgente boolean not null default false,
  pedida timestamptz not null default now(),
  creada_por uuid references public.perfiles (id),
  -- Del equipo
  estatus text not null default 'recibida'
    check (estatus in ('recibida', 'en-proceso', 'entregada', 'en-correccion', 'aprobada')),
  compromiso date,
  -- Del sistema
  entregada timestamptz,
  aprobada timestamptz,
  actualizada timestamptz not null default now()
);

create index if not exists tareas_cliente on public.tareas (cliente_id, pedida desc);
create index if not exists tareas_pedida on public.tareas (pedida desc);

create table if not exists public.correcciones (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas (id) on delete cascade,
  n int not null,
  -- Del cliente
  instrucciones text not null check (char_length(instrucciones) between 1 and 5000),
  pedida timestamptz not null default now(),
  pedida_por uuid references public.perfiles (id),
  -- Del equipo
  estatus text not null default 'pedida' check (estatus in ('pedida', 'en-proceso', 'entregada')),
  -- Del sistema
  entregada timestamptz,
  unique (tarea_id, n)
);

create or replace function public.antes_tarea() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.pedida := now();
    new.creada_por := auth.uid();
    new.entregada := null;
    new.aprobada := null;
    new.actualizada := now();
    if not es_equipo() then
      -- El cliente pide; lo demás lo pone el equipo.
      new.estatus := 'recibida';
      new.compromiso := null;
    elsif new.estatus not in ('recibida', 'en-proceso') then
      new.estatus := 'recibida';
    end if;
    return new;
  end if;

  if es_sistema() then
    new.actualizada := now();
    return new;
  end if;
  if not es_equipo() then
    raise exception 'Solo el equipo puede cambiar una tarea';
  end if;
  -- Lo del cliente no se toca.
  if new.cliente_id is distinct from old.cliente_id
    or new.empresa_id is distinct from old.empresa_id
    or new.titulo is distinct from old.titulo
    or new.descripcion is distinct from old.descripcion
    or new.urgente is distinct from old.urgente
    or new.pedida is distinct from old.pedida
    or new.creada_por is distinct from old.creada_por then
    raise exception 'Lo que escribió el cliente no se puede cambiar';
  end if;
  -- Las fechas automáticas y la aprobación no se ponen a mano.
  if new.entregada is distinct from old.entregada or new.aprobada is distinct from old.aprobada then
    raise exception 'Esa fecha se pone sola';
  end if;
  if old.estatus = 'aprobada' and new.estatus is distinct from old.estatus then
    raise exception 'La tarea ya está aprobada';
  end if;
  if new.estatus = 'aprobada' and old.estatus <> 'aprobada' then
    raise exception 'Solo el cliente aprueba';
  end if;
  new.actualizada := now();
  return new;
end $$;

drop trigger if exists crm_antes_tarea on public.tareas;
create trigger crm_antes_tarea before insert or update on public.tareas
  for each row execute function public.antes_tarea();

create or replace function public.antes_correccion() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    perform 1 from tareas where id = new.tarea_id for update;
    select coalesce(max(n), 0) + 1 into new.n from correcciones where tarea_id = new.tarea_id;
    new.pedida := now();
    new.pedida_por := auth.uid();
    new.estatus := 'pedida';
    new.entregada := null;
    return new;
  end if;

  if es_sistema() then return new; end if;
  if not es_equipo() then
    raise exception 'Solo el equipo puede cambiar una corrección';
  end if;
  if new.tarea_id is distinct from old.tarea_id
    or new.n is distinct from old.n
    or new.instrucciones is distinct from old.instrucciones
    or new.pedida is distinct from old.pedida
    or new.pedida_por is distinct from old.pedida_por then
    raise exception 'Lo que escribió el cliente no se puede cambiar';
  end if;
  if new.entregada is distinct from old.entregada then
    raise exception 'Esa fecha se pone sola';
  end if;
  return new;
end $$;

drop trigger if exists crm_antes_correccion on public.correcciones;
create trigger crm_antes_correccion before insert or update on public.correcciones
  for each row execute function public.antes_correccion();

-- Al pedir una corrección, la tarea pasa a "en corrección".
create or replace function public.despues_correccion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('crm.sistema', '1', true);
  update tareas set estatus = 'en-correccion' where id = new.tarea_id and estatus <> 'aprobada';
  perform set_config('crm.sistema', '', true);
  return new;
end $$;

drop trigger if exists crm_despues_correccion on public.correcciones;
create trigger crm_despues_correccion after insert on public.correcciones
  for each row execute function public.despues_correccion();

-- El botón "Aprobado": solo el cliente dueño de la tarea, y solo si ya hay
-- algo entregado.
create or replace function public.aprobar(p_tarea uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t tareas;
begin
  select * into t from tareas where id = p_tarea for update;
  if not found or t.cliente_id <> auth.uid() or yo_rol() <> 'cliente' then
    raise exception 'Solo quien pidió la tarea la puede aprobar';
  end if;
  if t.estatus = 'aprobada' then return; end if;
  if t.entregada is null then
    raise exception 'Todavía no hay nada entregado para aprobar';
  end if;
  perform set_config('crm.sistema', '1', true);
  update tareas set estatus = 'aprobada', aprobada = now() where id = p_tarea;
  perform set_config('crm.sistema', '', true);
end $$;

-- Actualizaciones: el cliente no cambia lo que pidió; si cambió de idea, agrega
-- instrucciones nuevas (y archivos) a la misma tarea. Quedan todas, con fecha.
create table if not exists public.notas (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas (id) on delete cascade,
  texto text not null default '' check (char_length(texto) <= 5000),
  creada timestamptz not null default now(),
  autor uuid references public.perfiles (id)
);

create index if not exists notas_tarea on public.notas (tarea_id, creada);

create or replace function public.antes_nota() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creada := now();
    new.autor := auth.uid();
    return new;
  end if;
  if es_sistema() then return new; end if;
  raise exception 'Las actualizaciones no se cambian; se agrega una nueva';
end $$;

drop trigger if exists crm_antes_nota on public.notas;
create trigger crm_antes_nota before insert or update on public.notas
  for each row execute function public.antes_nota();

-- ---------------------------------------------------------------------------
-- Biblioteca y archivos
-- ---------------------------------------------------------------------------

create table if not exists public.carpetas (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas (id),
  padre_id uuid references public.carpetas (id) on delete restrict,
  nombre text not null check (char_length(nombre) between 1 and 120),
  creada timestamptz not null default now(),
  unique nulls not distinct (empresa_id, padre_id, nombre)
);

create table if not exists public.archivos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('referencia', 'entrega', 'biblioteca', 'catalogo', 'contenido')),
  empresa_id text not null references public.empresas (id),
  tarea_id uuid references public.tareas (id) on delete cascade,
  correccion_id uuid references public.correcciones (id) on delete cascade,
  carpeta_id uuid references public.carpetas (id) on delete restrict,
  nombre text not null check (char_length(nombre) between 1 and 200),
  ruta text not null,
  tamano bigint not null default 0,
  tipo_mime text not null default '',
  subido timestamptz not null default now(),
  subido_por uuid references public.perfiles (id),
  anterior_id uuid references public.archivos (id) on delete set null,
  vigente boolean not null default true,
  notas text not null default ''
);

create index if not exists archivos_tarea on public.archivos (tarea_id);
create index if not exists archivos_carpeta on public.archivos (carpeta_id);

-- Los archivos de una actualización van pegados a ella.
alter table public.archivos add column if not exists nota_id uuid references public.notas (id) on delete cascade;

create or replace function public.antes_archivo() returns trigger
language plpgsql as $$
declare t tareas; prev archivos;
begin
  if tg_op = 'INSERT' then
    new.subido := now();
    new.subido_por := auth.uid();
    new.vigente := true;
    if new.tipo in ('referencia', 'entrega') then
      select * into t from tareas where id = new.tarea_id;
      if not found then raise exception 'Falta la tarea'; end if;
      new.empresa_id := t.empresa_id;
      new.carpeta_id := null;
      if new.correccion_id is not null
        and not exists (select 1 from correcciones where id = new.correccion_id and tarea_id = new.tarea_id) then
        raise exception 'Esa corrección no es de esta tarea';
      end if;
      if new.tipo = 'referencia' then
        new.correccion_id := null;
        if new.nota_id is not null
          and not exists (select 1 from notas where id = new.nota_id and tarea_id = new.tarea_id) then
          raise exception 'Esa actualización no es de esta tarea';
        end if;
      else
        new.nota_id := null;
      end if;
    else
      new.tarea_id := null;
      new.correccion_id := null;
      new.nota_id := null;
      if new.tipo = 'biblioteca' and new.carpeta_id is not null then
        select empresa_id into new.empresa_id from carpetas where id = new.carpeta_id;
      end if;
      if new.tipo = 'catalogo' then new.carpeta_id := null; end if;
      -- El material de la parrilla va pegado a su contenido y es de su empresa.
      if new.tipo = 'contenido' then
        new.carpeta_id := null;
        select empresa_id into new.empresa_id from contenidos where id = new.contenido_id;
        if not found then raise exception 'Falta el contenido'; end if;
      else
        new.contenido_id := null;
      end if;
    end if;
    -- Una versión nueva: hereda el lugar de la anterior.
    if new.anterior_id is not null then
      select * into prev from archivos where id = new.anterior_id;
      if not found or prev.tipo <> new.tipo or prev.tipo not in ('biblioteca', 'catalogo') then
        raise exception 'Solo la biblioteca y los catálogos tienen versiones';
      end if;
      new.empresa_id := prev.empresa_id;
      new.carpeta_id := prev.carpeta_id;
    end if;
    return new;
  end if;

  if es_sistema() then return new; end if;
  if not es_equipo() then raise exception 'Solo el equipo puede cambiar archivos'; end if;
  if new.tipo is distinct from old.tipo
    or new.tarea_id is distinct from old.tarea_id
    or new.correccion_id is distinct from old.correccion_id
    or new.ruta is distinct from old.ruta
    or new.subido is distinct from old.subido
    or new.subido_por is distinct from old.subido_por
    or new.anterior_id is distinct from old.anterior_id
    or new.vigente is distinct from old.vigente
    or new.nota_id is distinct from old.nota_id
    or new.contenido_id is distinct from old.contenido_id then
    raise exception 'De un archivo solo se cambia el nombre, la carpeta y las notas';
  end if;
  if old.tipo in ('referencia', 'entrega') and (new.nombre is distinct from old.nombre or new.carpeta_id is distinct from old.carpeta_id) then
    raise exception 'Los archivos de una tarea se quedan como se subieron';
  end if;
  if new.carpeta_id is distinct from old.carpeta_id and new.carpeta_id is not null then
    select empresa_id into new.empresa_id from carpetas where id = new.carpeta_id;
  elsif new.empresa_id is distinct from old.empresa_id and new.carpeta_id is not null then
    raise exception 'El archivo está dentro de una carpeta de otra empresa';
  end if;
  return new;
end $$;

drop trigger if exists crm_antes_archivo on public.archivos;
create trigger crm_antes_archivo before insert or update on public.archivos
  for each row execute function public.antes_archivo();

-- Al subir una entrega: la fecha de entrega se pone sola y el estatus cambia.
-- Al subir una versión: la anterior deja de ser la vigente (no se borra).
create or replace function public.despues_archivo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('crm.sistema', '1', true);
  if new.tipo = 'entrega' then
    if new.correccion_id is not null then
      update correcciones set estatus = 'entregada', entregada = new.subido where id = new.correccion_id;
    end if;
    update tareas t set
      entregada = new.subido,
      estatus = case
        when t.estatus = 'aprobada' then t.estatus
        when exists (select 1 from correcciones c where c.tarea_id = t.id and c.estatus <> 'entregada') then 'en-correccion'
        else 'entregada'
      end
    where t.id = new.tarea_id;
  end if;
  if new.anterior_id is not null then
    update archivos set vigente = false where id = new.anterior_id;
  end if;
  perform set_config('crm.sistema', '', true);
  return new;
end $$;

drop trigger if exists crm_despues_archivo on public.archivos;
create trigger crm_despues_archivo after insert on public.archivos
  for each row execute function public.despues_archivo();

-- ---------------------------------------------------------------------------
-- Bitácora: quién hizo qué y cuándo (solo la ve el admin)
-- ---------------------------------------------------------------------------

create table if not exists public.bitacora (
  id bigserial primary key,
  cuando timestamptz not null default now(),
  quien uuid,
  accion text not null,
  tabla text not null default '',
  fila text,
  detalle jsonb not null default '{}'::jsonb
);

create index if not exists bitacora_cuando on public.bitacora (cuando desc);

create or replace function public.anotar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare viejo jsonb; nuevo jsonb; cambios jsonb := '{}'::jsonb; k text;
begin
  if tg_op = 'DELETE' then
    insert into bitacora (quien, accion, tabla, fila, detalle)
    values (auth.uid(), 'borró', tg_table_name, (to_jsonb(old) ->> 'id'), to_jsonb(old));
    return old;
  end if;
  nuevo := to_jsonb(new);
  if tg_op = 'INSERT' then
    insert into bitacora (quien, accion, tabla, fila, detalle)
    values (auth.uid(), 'creó', tg_table_name, nuevo ->> 'id', nuevo - 'descripcion' - 'instrucciones');
    return new;
  end if;
  viejo := to_jsonb(old);
  for k in select jsonb_object_keys(nuevo) loop
    if k <> 'actualizada' and nuevo -> k is distinct from viejo -> k then
      cambios := cambios || jsonb_build_object(k, jsonb_build_array(viejo -> k, nuevo -> k));
    end if;
  end loop;
  if cambios <> '{}'::jsonb then
    insert into bitacora (quien, accion, tabla, fila, detalle)
    values (auth.uid(), 'cambió', tg_table_name, nuevo ->> 'id', cambios);
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tareas', 'correcciones', 'notas', 'archivos', 'carpetas', 'perfiles', 'empresas'] loop
    execute format('drop trigger if exists crm_bitacora on public.%I', t);
    execute format('create trigger crm_bitacora after insert or update or delete on public.%I for each row execute function public.anotar_cambio()', t);
  end loop;
end $$;

-- Descargas y envíos por correo, que no cambian nada pero conviene saber.
-- Corre como quien la llama: solo anota archivos que esa persona puede ver.
create or replace function public.anotar(p_accion text, p_archivo uuid) returns void
language sql security invoker set search_path = public as $$
  insert into bitacora (quien, accion, tabla, fila) values (auth.uid(), p_accion, 'archivos', p_archivo::text)
$$;

grant execute on function public.anotar(text, uuid) to authenticated;
grant execute on function public.aprobar(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Candados (Row Level Security)
-- ---------------------------------------------------------------------------

alter table public.empresas enable row level security;
alter table public.perfiles enable row level security;
alter table public.tareas enable row level security;
alter table public.correcciones enable row level security;
alter table public.notas enable row level security;
alter table public.carpetas enable row level security;
alter table public.archivos enable row level security;
alter table public.bitacora enable row level security;

-- Empresas: todos los que entran las ven; el admin las prende o apaga.
drop policy if exists empresas_ver on public.empresas;
create policy empresas_ver on public.empresas for select to authenticated using (yo_rol() is not null);
drop policy if exists empresas_admin on public.empresas;
create policy empresas_admin on public.empresas for update to authenticated using (es_admin()) with check (es_admin());

-- Perfiles: cada quien ve el suyo; el equipo ve a todos; solo el admin cambia.
drop policy if exists perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select to authenticated using (id = auth.uid() or es_equipo());
drop policy if exists perfiles_admin on public.perfiles;
create policy perfiles_admin on public.perfiles for update to authenticated using (es_admin()) with check (es_admin());

-- Tareas: el cliente solo las suyas; el equipo todas.
drop policy if exists tareas_ver on public.tareas;
create policy tareas_ver on public.tareas for select to authenticated
  using (es_equipo() or (cliente_id = auth.uid() and veo('tareas', empresa_id)));
drop policy if exists tareas_pedir on public.tareas;
create policy tareas_pedir on public.tareas for insert to authenticated
  with check (
    (cliente_id = auth.uid() and yo_rol() = 'cliente' and veo('tareas', empresa_id))
    or (es_equipo() and exists (select 1 from perfiles p where p.id = cliente_id and p.rol = 'cliente'))
  );
drop policy if exists tareas_equipo on public.tareas;
create policy tareas_equipo on public.tareas for update to authenticated using (es_equipo()) with check (es_equipo());
drop policy if exists tareas_borrar on public.tareas;
create policy tareas_borrar on public.tareas for delete to authenticated using (es_admin());

-- Correcciones: se ven si se ve la tarea; las pide el cliente dueño de una
-- tarea ya entregada y no aprobada.
drop policy if exists correcciones_ver on public.correcciones;
create policy correcciones_ver on public.correcciones for select to authenticated
  using (exists (select 1 from tareas t where t.id = tarea_id));
drop policy if exists correcciones_pedir on public.correcciones;
create policy correcciones_pedir on public.correcciones for insert to authenticated
  with check (
    yo_rol() = 'cliente'
    and exists (
      select 1 from tareas t
      where t.id = tarea_id and t.cliente_id = auth.uid() and t.entregada is not null and t.estatus <> 'aprobada'
    )
  );
drop policy if exists correcciones_equipo on public.correcciones;
create policy correcciones_equipo on public.correcciones for update to authenticated using (es_equipo()) with check (es_equipo());
drop policy if exists correcciones_borrar on public.correcciones;
create policy correcciones_borrar on public.correcciones for delete to authenticated using (es_admin());

-- Actualizaciones: se ven si se ve la tarea; las agrega el cliente dueño (o el
-- equipo, a nombre de lo que el cliente pidió por otro lado) mientras la tarea
-- no esté aprobada. Nadie las cambia; solo el admin borra.
drop policy if exists notas_ver on public.notas;
create policy notas_ver on public.notas for select to authenticated
  using (exists (select 1 from tareas t where t.id = tarea_id));
drop policy if exists notas_agregar on public.notas;
create policy notas_agregar on public.notas for insert to authenticated
  with check (
    exists (
      select 1 from tareas t
      where t.id = tarea_id and t.estatus <> 'aprobada'
        and ((t.cliente_id = auth.uid() and yo_rol() = 'cliente') or es_equipo())
    )
  );
drop policy if exists notas_borrar on public.notas;
create policy notas_borrar on public.notas for delete to authenticated using (es_admin());

-- Carpetas: el cliente ve las de sus empresas; el equipo las arma; solo el
-- admin borra.
drop policy if exists carpetas_ver on public.carpetas;
create policy carpetas_ver on public.carpetas for select to authenticated using (veo('biblioteca', empresa_id));
drop policy if exists carpetas_crear on public.carpetas;
create policy carpetas_crear on public.carpetas for insert to authenticated with check (es_equipo());
drop policy if exists carpetas_cambiar on public.carpetas;
create policy carpetas_cambiar on public.carpetas for update to authenticated using (es_equipo()) with check (es_equipo());
drop policy if exists carpetas_borrar on public.carpetas;
create policy carpetas_borrar on public.carpetas for delete to authenticated using (es_admin());

-- Archivos: los de una tarea se ven si se ve la tarea; los de la biblioteca y
-- los catálogos según los permisos de cada quien.
drop policy if exists archivos_ver on public.archivos;
create policy archivos_ver on public.archivos for select to authenticated using (
  case tipo
    when 'biblioteca' then veo('biblioteca', empresa_id)
    when 'catalogo' then veo('catalogos', empresa_id)
    else exists (select 1 from tareas t where t.id = tarea_id)
  end
);
drop policy if exists archivos_subir on public.archivos;
create policy archivos_subir on public.archivos for insert to authenticated with check (
  case tipo
    when 'referencia' then
      exists (select 1 from tareas t where t.id = tarea_id and (t.cliente_id = auth.uid() or es_equipo()))
      and (es_equipo() or ruta like 'ref/' || auth.uid()::text || '/%')
    else es_equipo()
  end
);
drop policy if exists archivos_cambiar on public.archivos;
create policy archivos_cambiar on public.archivos for update to authenticated using (es_equipo()) with check (es_equipo());
drop policy if exists archivos_borrar on public.archivos;
create policy archivos_borrar on public.archivos for delete to authenticated using (es_admin());

-- Bitácora: solo el admin la lee; los cambios los anota la base de datos sola,
-- y cada quien solo puede anotar que vio, bajó o se envió un archivo suyo.
drop policy if exists bitacora_ver on public.bitacora;
create policy bitacora_ver on public.bitacora for select to authenticated using (es_admin());
drop policy if exists bitacora_lecturas on public.bitacora;
create policy bitacora_lecturas on public.bitacora for insert to authenticated with check (
  quien = auth.uid()
  and accion in ('descargó', 'envió por correo', 'vio')
  and tabla = 'archivos'
  and exists (select 1 from archivos a where a.id::text = fila)
);

-- ---------------------------------------------------------------------------
-- Ultron: el buzón con la dirección
-- ---------------------------------------------------------------------------
--
-- La página deja aquí la pregunta; Ultron (que corre en el cerebro, con la
-- llave de servicio) la toma, contesta y deja su respuesta y su voz. Cada
-- quien ve solo su conversación; nadie la cambia a mano.

create or replace function public.hablo_con_ultron() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo and (ultron or rol = 'admin'))
$$;

create table if not exists public.ultron_mensajes (
  id bigserial primary key,
  persona uuid not null references public.perfiles (id) on delete cascade,
  canal text not null check (canal in ('crm', 'consola')),
  pregunta text not null check (char_length(pregunta) between 1 and 2000),
  respuesta text,
  acciones jsonb not null default '[]'::jsonb,
  voz text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pensando', 'listo', 'error')),
  creado timestamptz not null default now(),
  respondido timestamptz
);

create index if not exists ultron_mensajes_pendientes on public.ultron_mensajes (estado, creado);
create index if not exists ultron_mensajes_persona on public.ultron_mensajes (persona, creado desc);

create or replace function public.antes_ultron() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' and not es_sistema() then
    new.persona := auth.uid();
    new.estado := 'pendiente';
    new.respuesta := null;
    new.acciones := '[]'::jsonb;
    new.voz := null;
    new.creado := now();
    new.respondido := null;
    if (select count(*) from ultron_mensajes where persona = auth.uid() and creado > now() - interval '1 minute') >= 15 then
      raise exception 'Demasiados mensajes seguidos; espera un minuto';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and not es_sistema() then
    raise exception 'Solo Ultron contesta';
  end if;
  return new;
end $$;

drop trigger if exists crm_antes_ultron on public.ultron_mensajes;
create trigger crm_antes_ultron before insert or update on public.ultron_mensajes
  for each row execute function public.antes_ultron();

-- Lo que Ultron recuerda: instrucciones vigentes para él y sus IAs. Las de
-- mayor rango (oculta) no las ve la dirección.
create table if not exists public.ultron_memoria (
  id bigserial primary key,
  texto text not null check (char_length(texto) between 1 and 2000),
  para text not null default 'ultron',
  oculta boolean not null default false,
  activa boolean not null default true,
  autor uuid references public.perfiles (id) on delete set null,
  creada timestamptz not null default now()
);

-- El tablero de la consola (IAs, empresas, departamentos, hoy en corto),
-- que Ultron mantiene al día.
create table if not exists public.ultron_tablero (
  id text primary key,
  datos jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

alter table public.ultron_mensajes enable row level security;
alter table public.ultron_memoria enable row level security;
alter table public.ultron_tablero enable row level security;

drop policy if exists ultron_ver on public.ultron_mensajes;
create policy ultron_ver on public.ultron_mensajes for select to authenticated using (persona = auth.uid() or es_admin());
drop policy if exists ultron_preguntar on public.ultron_mensajes;
create policy ultron_preguntar on public.ultron_mensajes for insert to authenticated with check (hablo_con_ultron());
drop policy if exists ultron_borrar on public.ultron_mensajes;
create policy ultron_borrar on public.ultron_mensajes for delete to authenticated using (es_admin());

drop policy if exists memoria_ver on public.ultron_memoria;
create policy memoria_ver on public.ultron_memoria for select to authenticated using ((hablo_con_ultron() and not oculta) or es_admin());
drop policy if exists memoria_admin on public.ultron_memoria;
create policy memoria_admin on public.ultron_memoria for update to authenticated using (es_admin()) with check (es_admin());

drop policy if exists tablero_ver on public.ultron_tablero;
create policy tablero_ver on public.ultron_tablero for select to authenticated using (hablo_con_ultron());

-- Sin sesión no se ve nada.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Dónde viven los archivos (Supabase Storage)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('archivos', 'archivos', false, 52428800)
on conflict (id) do nothing;

-- Un archivo se puede bajar si su ficha se puede ver (mismas reglas de arriba).
drop policy if exists crm_bajar on storage.objects;
create policy crm_bajar on storage.objects for select to authenticated using (
  bucket_id = 'archivos' and exists (select 1 from public.archivos a where a.ruta = objects.name)
);
-- El equipo sube a cualquier lado; el cliente solo sus referencias.
drop policy if exists crm_subir on storage.objects;
create policy crm_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'archivos'
  and (
    public.es_equipo()
    or ((storage.foldername(name))[1] = 'ref' and (storage.foldername(name))[2] = auth.uid()::text)
  )
);
drop policy if exists crm_borrar on storage.objects;
create policy crm_borrar on storage.objects for delete to authenticated using (bucket_id = 'archivos' and public.es_admin());

-- La voz de Ultron: cada quien oye solo sus respuestas (carpeta = su id).
insert into storage.buckets (id, name, public, file_size_limit)
values ('ultron', 'ultron', false, 10485760)
on conflict (id) do nothing;
drop policy if exists ultron_oir on storage.objects;
create policy ultron_oir on storage.objects for select to authenticated using (
  bucket_id = 'ultron' and (storage.foldername(name))[1] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- Parrilla de contenidos para las vendedoras
-- ---------------------------------------------------------------------------
-- Lo que las vendedoras publican o mandan cada día, por empresa. Todos los que
-- entran la ven (de sus empresas); solo el admin y el equipo la llenan y la
-- cambian; solo el admin borra. Después la IA se los manda por Telegram
-- (enviado = cuándo se mandó).

create table if not exists public.contenidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null references public.empresas (id),
  fecha date not null,
  hora time,
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'estado', 'instagram', 'facebook', 'tiktok', 'otro')),
  titulo text not null check (char_length(titulo) between 1 and 200),
  texto text not null default '' check (char_length(texto) <= 4000),
  enlace text not null default '' check (enlace = '' or enlace ~ '^https://'),
  estado text not null default 'borrador' check (estado in ('borrador', 'listo', 'enviado')),
  enviado timestamptz,
  creado_por uuid references public.perfiles (id) on delete set null,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);
create index if not exists contenidos_fecha on public.contenidos (fecha, empresa_id);

create or replace function public.antes_contenido() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creada := now();
    new.creado_por := auth.uid();
  else
    new.creada := old.creada;
    new.creado_por := old.creado_por;
  end if;
  new.actualizada := now();
  return new;
end $$;

drop trigger if exists crm_antes_contenido on public.contenidos;
create trigger crm_antes_contenido before insert or update on public.contenidos
  for each row execute function public.antes_contenido();

drop trigger if exists crm_bitacora on public.contenidos;
create trigger crm_bitacora after insert or update or delete on public.contenidos
  for each row execute function public.anotar_cambio();

alter table public.contenidos enable row level security;

-- Los ve todo el que entra, de las empresas que le tocan.
drop policy if exists contenidos_ver on public.contenidos;
create policy contenidos_ver on public.contenidos for select to authenticated using (
  es_equipo() or exists (
    select 1 from public.perfiles p
    where p.id = auth.uid() and p.activo and (p.empresas is null or contenidos.empresa_id = any (p.empresas))
  )
);
-- Solo el admin y el equipo los ponen y los cambian.
drop policy if exists contenidos_crear on public.contenidos;
create policy contenidos_crear on public.contenidos for insert to authenticated with check (es_equipo());
drop policy if exists contenidos_cambiar on public.contenidos;
create policy contenidos_cambiar on public.contenidos for update to authenticated using (es_equipo()) with check (es_equipo());
-- Borrar, solo el admin.
drop policy if exists contenidos_borrar on public.contenidos;
create policy contenidos_borrar on public.contenidos for delete to authenticated using (es_admin());

-- El material de cada contenido (imágenes y videos): va en "archivos", pegado
-- al contenido. Lo ve quien ve el contenido, lo sube el equipo y lo borra el
-- admin (las reglas de archivos ya lo dicen así).
alter table public.archivos add column if not exists contenido_id uuid references public.contenidos (id) on delete cascade;
create index if not exists archivos_contenido on public.archivos (contenido_id);
alter table public.archivos drop constraint if exists archivos_tipo_check;
alter table public.archivos add constraint archivos_tipo_check check (tipo in ('referencia', 'entrega', 'biblioteca', 'catalogo', 'contenido'));

drop policy if exists archivos_ver on public.archivos;
create policy archivos_ver on public.archivos for select to authenticated using (
  case tipo
    when 'biblioteca' then veo('biblioteca', empresa_id)
    when 'catalogo' then veo('catalogos', empresa_id)
    when 'contenido' then exists (select 1 from contenidos c where c.id = contenido_id)
    else exists (select 1 from tareas t where t.id = tarea_id)
  end
);
