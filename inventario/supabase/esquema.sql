-- Inventario Mi Semago: lo que llega, lo que se pide y lo que sale.
--
-- Se pega una sola vez en Supabase → SQL Editor → Run. Crea las tablas, los
-- candados (quién ve y toca qué) y el lugar de las fotos. Se puede volver a
-- correr completo sin perder nada (así se aplican mejoras).
--
-- La regla de oro: lo que se cierra ya no se cambia. Si alguien se equivocó,
-- hace una CORRECCIÓN: un registro nuevo que apunta al anterior y dice por
-- qué. Los dos quedan a la vista y vale el último. Las horas las pone el
-- reloj del servidor, nunca la persona.
--
--   admin    Eduardo (NXUS). Ve y toca todo; el único que borra, reabre y
--            da de alta personas.
--   dueno    el dueño de Mi Semago. Ve todo, hace lo que hace cualquiera.
--   compras  la secretaria: marca "Orden comprada". También recibe y pide.
--   almacen  los empleados: reciben mercancía, piden lo que falta y anotan
--            lo que sale.
--
-- Las reglas viven aquí, en la base de datos, no en la página: aunque alguien
-- se brincara la página, la base de datos no le deja.


-- ---------------------------------------------------------------------------
-- Personas
-- ---------------------------------------------------------------------------

create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  correo text not null default '',
  rol text not null default 'almacen' check (rol in ('admin', 'dueno', 'compras', 'almacen')),
  activo boolean not null default false,
  cargo text not null default '',
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

create or replace function public.compra() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(yo_rol() in ('admin', 'dueno', 'compras'), false)
$$;

-- Lo hace el sistema (un trigger o una función de aquí), no una persona a mano.
create or replace function public.es_sistema() returns boolean
language sql stable as $$
  select auth.uid() is null or coalesce(current_setting('inv.sistema', true), '') = '1'
$$;

-- Cada usuario nuevo nace con su perfil. El primero de todos es el admin; los
-- demás los crea el admin desde la página.
create or replace function public.nuevo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare primero boolean := not exists (select 1 from perfiles where rol = 'admin');
begin
  insert into perfiles (id, nombre, correo, rol, activo, cargo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.email, ''),
    case when primero then 'admin' else 'almacen' end,
    primero or coalesce((new.raw_user_meta_data ->> 'activo')::boolean, false),
    coalesce(new.raw_user_meta_data ->> 'cargo', case when primero then 'NXUS AI' else '' end)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists inv_nuevo_usuario on auth.users;
create trigger inv_nuevo_usuario after insert on auth.users
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

drop trigger if exists inv_cuidar_perfil on public.perfiles;
create trigger inv_cuidar_perfil before update on public.perfiles
  for each row execute function public.cuidar_perfil();

-- ---------------------------------------------------------------------------
-- Proveedores y productos (el catálogo; la IA los usa para reconocer)
-- ---------------------------------------------------------------------------

create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 120),
  contacto text not null default '',
  telefono text not null default '',
  correo text not null default '',
  notas text not null default '' check (char_length(notas) <= 2000),
  activo boolean not null default true,
  creado timestamptz not null default now()
);
create unique index if not exists proveedores_nombre on public.proveedores (lower(nombre));

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 120),
  unidad text not null default '' check (char_length(unidad) <= 30), -- costal, lb, caja, galón…
  proveedor_id uuid references public.proveedores (id) on delete set null,
  minimo numeric(12, 2) not null default 0 check (minimo >= 0), -- avisa cuando quede menos
  notas text not null default '' check (char_length(notas) <= 2000),
  activo boolean not null default true,
  creado timestamptz not null default now()
);
create unique index if not exists productos_nombre on public.productos (lower(nombre));

-- ---------------------------------------------------------------------------
-- Pedidos: lo que los empleados necesitan y la secretaria compra
-- ---------------------------------------------------------------------------

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  folio bigint generated always as identity,
  estado text not null default 'pedido' check (estado in ('pedido', 'comprado', 'recibido')),
  proveedor_texto text not null default '' check (char_length(proveedor_texto) <= 120), -- si quien pide lo sabe
  urgente boolean not null default false,
  nota text not null default '' check (char_length(nota) <= 2000),
  pedido_por uuid references public.perfiles (id) on delete set null,
  pedido_en timestamptz not null default now(),
  -- La compra (la secretaria)
  comprado_por uuid references public.perfiles (id) on delete set null,
  comprado_en timestamptz,
  proveedor_id uuid references public.proveedores (id) on delete set null,
  orden_compra text not null default '' check (char_length(orden_compra) <= 60),
  llega date,
  nota_compra text not null default '' check (char_length(nota_compra) <= 2000),
  recibido_en timestamptz,
  -- Corrección: este pedido reemplaza a otro
  corrige_id uuid unique references public.pedidos (id) on delete set null,
  motivo text not null default '' check (char_length(motivo) <= 1000),
  cancela boolean not null default false -- la corrección solo anula el anterior
);
create index if not exists pedidos_en on public.pedidos (pedido_en desc);

create table if not exists public.pedido_lineas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  orden int not null default 0,
  producto_id uuid references public.productos (id) on delete set null,
  producto text not null check (char_length(producto) between 1 and 160),
  cantidad numeric(12, 2) not null check (cantidad > 0),
  unidad text not null default '' check (char_length(unidad) <= 30),
  nota text not null default '' check (char_length(nota) <= 500)
);
create index if not exists pedido_lineas_pedido on public.pedido_lineas (pedido_id);

-- ---------------------------------------------------------------------------
-- Recepciones: lo que llega del proveedor
-- ---------------------------------------------------------------------------

create table if not exists public.recepciones (
  id uuid primary key default gen_random_uuid(),
  folio bigint generated always as identity,
  estado text not null default 'borrador' check (estado in ('borrador', 'cerrada')),
  proveedor_id uuid references public.proveedores (id) on delete set null,
  proveedor_nombre text not null default '' check (char_length(proveedor_nombre) <= 120),
  packing_numero text not null default '' check (char_length(packing_numero) <= 60),
  packing_fecha date,
  sin_packing boolean not null default false, -- el proveedor no trajo la hoja
  pedido_id uuid references public.pedidos (id) on delete set null,
  temperatura text not null default '' check (char_length(temperatura) <= 30),
  transporte_ok boolean, -- camión limpio y en buen estado
  resultado text not null default '' check (resultado in ('', 'completa', 'incompleta', 'con-problemas', 'rechazada')),
  resumen text not null default '' check (char_length(resumen) <= 4000),
  notas text not null default '' check (char_length(notas) <= 4000), -- lo que anotó quien recibió
  incidencias jsonb not null default '[]', -- [{tipo, producto, detalle, cantidad}] que ordenó la IA
  -- Las horas (las pone el servidor)
  creado_por uuid references public.perfiles (id) on delete set null,
  creado timestamptz not null default now(), -- cuándo se hizo este registro
  llegada timestamptz not null default now(), -- cuándo llegó el proveedor (en una corrección, la de la original)
  ia_leido_en timestamptz,
  inspeccion_en timestamptz,
  ia_revisado_en timestamptz,
  cerrada_en timestamptz,
  cerrada_por uuid references public.perfiles (id) on delete set null,
  -- Corrección: esta recepción reemplaza a otra
  corrige_id uuid unique references public.recepciones (id) on delete set null,
  motivo text not null default '' check (char_length(motivo) <= 1000),
  actualizado timestamptz not null default now()
);
create index if not exists recepciones_llegada on public.recepciones (llegada desc);

create table if not exists public.recepcion_lineas (
  id uuid primary key default gen_random_uuid(),
  recepcion_id uuid not null references public.recepciones (id) on delete cascade,
  orden int not null default 0,
  producto_id uuid references public.productos (id) on delete set null,
  producto text not null default '' check (char_length(producto) <= 160),
  unidad text not null default '' check (char_length(unidad) <= 30),
  cantidad_esperada numeric(12, 2) check (cantidad_esperada >= 0), -- lo que dice el packing slip
  cantidad_recibida numeric(12, 2) check (cantidad_recibida >= 0), -- lo que de verdad llegó
  danados numeric(12, 2) not null default 0 check (danados >= 0), -- de lo que llegó, cuántos rotos o malos
  lote text not null default '' check (char_length(lote) <= 60),
  caducidad date,
  calidad text not null default '' check (calidad in ('', 'buena', 'regular', 'mala')),
  problema text not null default 'ninguno' check (problema in ('ninguno', 'faltante', 'sobrante', 'danado', 'caducado', 'calidad', 'equivocado', 'otro')),
  precio numeric(12, 2) check (precio >= 0), -- precio unitario, si viene en la hoja
  nota text not null default '' check (char_length(nota) <= 1000)
);
create index if not exists recepcion_lineas_rec on public.recepcion_lineas (recepcion_id);

create table if not exists public.recepcion_archivos (
  id uuid primary key default gen_random_uuid(),
  recepcion_id uuid not null references public.recepciones (id) on delete cascade,
  linea_id uuid references public.recepcion_lineas (id) on delete set null,
  tipo text not null check (tipo in ('packing', 'mercancia', 'dano', 'otro')),
  ruta text not null, -- en el almacenamiento "recepciones"
  nota text not null default '' check (char_length(nota) <= 1000),
  subido_por uuid references public.perfiles (id) on delete set null,
  subido timestamptz not null default now()
);
create index if not exists recepcion_archivos_rec on public.recepcion_archivos (recepcion_id);

-- ---------------------------------------------------------------------------
-- Salidas: lo que se usa en producción, se tira o se regresa
-- ---------------------------------------------------------------------------

create table if not exists public.salidas (
  id uuid primary key default gen_random_uuid(),
  folio bigint generated always as identity,
  producto_id uuid references public.productos (id) on delete set null,
  producto text not null check (char_length(producto) between 1 and 160),
  lote text not null default '' check (char_length(lote) <= 60),
  unidad text not null default '' check (char_length(unidad) <= 30),
  cantidad numeric(12, 2) not null check (cantidad >= 0),
  tipo text not null default 'produccion' check (tipo in ('produccion', 'merma', 'devolucion', 'otro')),
  nota text not null default '' check (char_length(nota) <= 1000),
  hecha_por uuid references public.perfiles (id) on delete set null,
  hecha_en timestamptz not null default now(),
  corrige_id uuid unique references public.salidas (id) on delete set null,
  motivo text not null default '' check (char_length(motivo) <= 1000),
  anula boolean not null default false
);
create index if not exists salidas_en on public.salidas (hecha_en desc);

-- ---------------------------------------------------------------------------
-- Los candados de "ya no se cambia"
-- ---------------------------------------------------------------------------

create or replace function public.antes_recepcion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if es_sistema() then
    new.actualizado := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.creado_por := auth.uid();
    new.creado := now();
    new.llegada := now();
    new.estado := 'borrador';
    new.ia_leido_en := null; new.ia_revisado_en := null; new.inspeccion_en := null;
    new.cerrada_en := null; new.cerrada_por := null;
    if new.corrige_id is not null then
      raise exception 'Las correcciones se hacen con el botón "Hacer corrección"';
    end if;
    new.motivo := '';
  elsif not es_admin() then
    if old.estado = 'cerrada' then
      raise exception 'Esta recepción ya se cerró y no se puede cambiar. Si algo está mal, haz una corrección.';
    end if;
    -- Lo que nadie cambia a mano.
    new.folio := old.folio; new.creado_por := old.creado_por; new.creado := old.creado; new.llegada := old.llegada;
    new.corrige_id := old.corrige_id; new.motivo := old.motivo;
    new.inspeccion_en := old.inspeccion_en; new.cerrada_en := old.cerrada_en; new.cerrada_por := old.cerrada_por;
    -- La IA leyó o revisó: la hora la pone el servidor.
    new.ia_leido_en := case when new.ia_leido_en is distinct from old.ia_leido_en then now() else old.ia_leido_en end;
    new.ia_revisado_en := case when new.ia_revisado_en is distinct from old.ia_revisado_en then now() else old.ia_revisado_en end;
  end if;
  if tg_op = 'UPDATE' and new.estado = 'cerrada' and old.estado = 'borrador' then
    if coalesce(new.proveedor_id::text, nullif(trim(new.proveedor_nombre), '')) is null then
      raise exception 'Falta el proveedor';
    end if;
    if not exists (select 1 from recepcion_lineas where recepcion_id = new.id) then
      raise exception 'Falta lo que llegó: agrega al menos un producto';
    end if;
    if not new.sin_packing and not exists (select 1 from recepcion_archivos where recepcion_id = new.id and tipo = 'packing') then
      raise exception 'Falta la foto del packing slip (o marca que no lo trajo)';
    end if;
    if not exists (select 1 from recepcion_archivos where recepcion_id = new.id and tipo in ('mercancia', 'dano')) then
      raise exception 'Falta al menos una foto de la mercancía';
    end if;
    new.cerrada_en := now();
    new.cerrada_por := auth.uid();
    new.inspeccion_en := coalesce(old.inspeccion_en, now());
  end if;
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists inv_antes_recepcion on public.recepciones;
create trigger inv_antes_recepcion before insert or update on public.recepciones
  for each row execute function public.antes_recepcion();

-- Al cerrarse una recepción ligada a un pedido, el pedido queda como recibido.
create or replace function public.despues_recepcion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'cerrada' and old.estado = 'borrador' and new.pedido_id is not null then
    perform set_config('inv.sistema', '1', true);
    update pedidos set estado = 'recibido', recibido_en = now() where id = new.pedido_id and estado in ('pedido', 'comprado');
    perform set_config('inv.sistema', '', true);
  end if;
  return null;
end $$;

drop trigger if exists inv_despues_recepcion on public.recepciones;
create trigger inv_despues_recepcion after update on public.recepciones
  for each row execute function public.despues_recepcion();

-- Lo de adentro de una recepción (productos y fotos) solo se toca mientras
-- está abierta. El admin siempre.
create or replace function public.recepcion_abierta() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid uuid := case when tg_op = 'DELETE' then old.recepcion_id else new.recepcion_id end;
begin
  if es_sistema() or es_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' and new.recepcion_id <> old.recepcion_id then raise exception 'No se puede mover'; end if;
  if (select estado from recepciones where id = rid) is distinct from 'borrador' then
    raise exception 'Esta recepción ya se cerró y no se puede cambiar. Si algo está mal, haz una corrección.';
  end if;
  if tg_table_name = 'recepcion_archivos' then
    if tg_op = 'DELETE' then return old; end if;
    if tg_op = 'UPDATE' then
      new.subido := old.subido; new.subido_por := old.subido_por; new.ruta := old.ruta;
    else
      new.subido := now(); new.subido_por := auth.uid();
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists inv_linea_abierta on public.recepcion_lineas;
create trigger inv_linea_abierta before insert or update or delete on public.recepcion_lineas
  for each row execute function public.recepcion_abierta();
drop trigger if exists inv_archivo_abierto on public.recepcion_archivos;
create trigger inv_archivo_abierto before insert or update or delete on public.recepcion_archivos
  for each row execute function public.recepcion_abierta();

-- La primera foto de la mercancía es la hora de la inspección.
create or replace function public.al_subir_foto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo in ('mercancia', 'dano') then
    perform set_config('inv.sistema', '1', true);
    update recepciones set inspeccion_en = now() where id = new.recepcion_id and inspeccion_en is null;
    perform set_config('inv.sistema', '', true);
  end if;
  return null;
end $$;

drop trigger if exists inv_al_subir_foto on public.recepcion_archivos;
create trigger inv_al_subir_foto after insert on public.recepcion_archivos
  for each row execute function public.al_subir_foto();

-- Pedidos: se hacen y se compran con las funciones de abajo; directo solo el admin.
create or replace function public.antes_pedido() returns trigger
language plpgsql as $$
begin
  if es_sistema() or es_admin() then return new; end if;
  raise exception 'Los pedidos no se cambian. Si algo está mal, haz una corrección.';
end $$;

drop trigger if exists inv_antes_pedido on public.pedidos;
create trigger inv_antes_pedido before update on public.pedidos
  for each row execute function public.antes_pedido();

-- Salidas: se anotan una vez; para cambiar, una corrección.
create or replace function public.antes_salida() returns trigger
language plpgsql security definer set search_path = public as $$
declare orig salidas;
begin
  if es_sistema() then return new; end if;
  if tg_op = 'UPDATE' then
    if es_admin() then return new; end if;
    raise exception 'Las salidas no se cambian. Si algo está mal, haz una corrección.';
  end if;
  new.hecha_por := auth.uid();
  new.hecha_en := now();
  if new.corrige_id is not null then
    select * into orig from salidas where id = new.corrige_id;
    if orig.id is null then raise exception 'No existe la salida que quieres corregir'; end if;
    if char_length(trim(new.motivo)) < 3 then raise exception 'Escribe por qué es la corrección'; end if;
  else
    new.motivo := '';
    new.anula := false;
  end if;
  return new;
end $$;

drop trigger if exists inv_antes_salida on public.salidas;
create trigger inv_antes_salida before insert or update on public.salidas
  for each row execute function public.antes_salida();

-- ---------------------------------------------------------------------------
-- Las acciones con botón
-- ---------------------------------------------------------------------------

-- "Realizar pedido" (y "Corregir pedido"): el pedido y sus productos de un jalón.
create or replace function public.hacer_pedido(datos jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nuevo uuid;
  orig pedidos;
  l jsonb;
  i int := 0;
  cancela boolean := coalesce((datos ->> 'cancela')::boolean, false);
begin
  if not es_alguien() then raise exception 'No tienes permiso para hacer eso'; end if;
  if datos ->> 'corrige_id' is not null then
    select * into orig from pedidos where id = (datos ->> 'corrige_id')::uuid;
    if orig.id is null then raise exception 'No existe el pedido que quieres corregir'; end if;
    if exists (select 1 from pedidos where corrige_id = orig.id) then raise exception 'Ese pedido ya tiene una corrección; corrige la más nueva'; end if;
    if char_length(trim(coalesce(datos ->> 'motivo', ''))) < 3 then raise exception 'Escribe por qué es la corrección'; end if;
  else
    cancela := false;
  end if;
  if jsonb_typeof(datos -> 'lineas') is distinct from 'array' then datos := datos || '{"lineas": []}'; end if;
  if not cancela and jsonb_array_length(datos -> 'lineas') = 0 then
    raise exception 'Agrega al menos un producto';
  end if;
  insert into pedidos (proveedor_texto, urgente, nota, pedido_por, pedido_en, corrige_id, motivo, cancela)
  values (
    left(trim(coalesce(datos ->> 'proveedor_texto', '')), 120),
    coalesce((datos ->> 'urgente')::boolean, false),
    left(trim(coalesce(datos ->> 'nota', '')), 2000),
    auth.uid(), now(), orig.id,
    case when orig.id is null then '' else left(trim(datos ->> 'motivo'), 1000) end,
    cancela
  ) returning id into nuevo;
  if not cancela then
    for l in select * from jsonb_array_elements(datos -> 'lineas') loop
      i := i + 1;
      insert into pedido_lineas (pedido_id, orden, producto_id, producto, cantidad, unidad, nota)
      values (
        nuevo, i,
        (select id from productos where id = nullif(l ->> 'producto_id', '')::uuid),
        left(trim(l ->> 'producto'), 160),
        (l ->> 'cantidad')::numeric,
        left(trim(coalesce(l ->> 'unidad', '')), 30),
        left(trim(coalesce(l ->> 'nota', '')), 500)
      );
    end loop;
  end if;
  return nuevo;
end $$;

-- "Orden comprada": solo la secretaria, el dueño o el admin.
create or replace function public.marcar_comprado(pid uuid, datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  p pedidos;
  c pedidos;
begin
  if not compra() then raise exception 'Solo quien compra puede marcar una orden como comprada'; end if;
  select * into p from pedidos where id = pid;
  if p.id is null then raise exception 'No existe ese pedido'; end if;
  if p.cancela then raise exception 'Este es una cancelación; no hay nada que comprar'; end if;
  select * into c from pedidos where corrige_id = pid;
  if c.id is not null then raise exception 'Este pedido se corrigió; compra el folio P-%', lpad(c.folio::text, 4, '0'); end if;
  if p.estado <> 'pedido' then raise exception 'Este pedido ya está marcado como %', p.estado; end if;
  perform set_config('inv.sistema', '1', true);
  update pedidos set
    estado = 'comprado',
    comprado_por = auth.uid(),
    comprado_en = now(),
    proveedor_id = (select id from proveedores where id = nullif(datos ->> 'proveedor_id', '')::uuid),
    orden_compra = left(trim(coalesce(datos ->> 'orden_compra', '')), 60),
    llega = nullif(datos ->> 'llega', '')::date,
    nota_compra = left(trim(coalesce(datos ->> 'nota', '')), 2000)
  where id = pid;
  perform set_config('inv.sistema', '', true);
end $$;

-- "Hacer corrección" de una recepción cerrada: una copia abierta que apunta a
-- la original, con todo lo que tenía (fotos incluidas) para corregir solo lo
-- que estuvo mal.
create or replace function public.corregir_recepcion(rid uuid, motivo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  o recepciones;
  nuevo uuid;
  m jsonb := '{}';
  l recepcion_lineas;
  nl uuid;
begin
  if not es_alguien() then raise exception 'No tienes permiso para hacer eso'; end if;
  select * into o from recepciones where id = rid;
  if o.id is null then raise exception 'No existe esa recepción'; end if;
  if o.estado <> 'cerrada' then raise exception 'Esa recepción sigue abierta: corrígela ahí mismo'; end if;
  if exists (select 1 from recepciones where corrige_id = rid) then raise exception 'Esa recepción ya tiene una corrección; corrige la más nueva'; end if;
  if char_length(trim(coalesce(motivo, ''))) < 3 then raise exception 'Escribe por qué es la corrección'; end if;
  perform set_config('inv.sistema', '1', true);
  insert into recepciones (estado, proveedor_id, proveedor_nombre, packing_numero, packing_fecha, sin_packing, pedido_id, temperatura,
    transporte_ok, resultado, resumen, notas, incidencias, creado_por, llegada, ia_leido_en, inspeccion_en, corrige_id, motivo)
  values ('borrador', o.proveedor_id, o.proveedor_nombre, o.packing_numero, o.packing_fecha, o.sin_packing, o.pedido_id, o.temperatura,
    o.transporte_ok, o.resultado, o.resumen, o.notas, o.incidencias, auth.uid(), o.llegada, o.ia_leido_en, o.inspeccion_en, o.id, left(trim(motivo), 1000))
  returning id into nuevo;
  for l in select * from recepcion_lineas where recepcion_id = rid order by orden loop
    insert into recepcion_lineas (recepcion_id, orden, producto_id, producto, unidad, cantidad_esperada, cantidad_recibida, danados, lote, caducidad, calidad, problema, precio, nota)
    values (nuevo, l.orden, l.producto_id, l.producto, l.unidad, l.cantidad_esperada, l.cantidad_recibida, l.danados, l.lote, l.caducidad, l.calidad, l.problema, l.precio, l.nota)
    returning id into nl;
    m := m || jsonb_build_object(l.id::text, nl);
  end loop;
  insert into recepcion_archivos (recepcion_id, linea_id, tipo, ruta, nota, subido_por, subido)
  select nuevo, (m ->> a.linea_id::text)::uuid, a.tipo, a.ruta, a.nota, a.subido_por, a.subido from recepcion_archivos a where a.recepcion_id = rid;
  perform set_config('inv.sistema', '', true);
  return nuevo;
end $$;

revoke all on function public.hacer_pedido(jsonb) from public;
revoke all on function public.marcar_comprado(uuid, jsonb) from public;
revoke all on function public.corregir_recepcion(uuid, text) from public;
grant execute on function public.hacer_pedido(jsonb) to authenticated;
grant execute on function public.marcar_comprado(uuid, jsonb) to authenticated;
grant execute on function public.corregir_recepcion(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Bitácora: quién hizo qué y cuándo (la escriben los triggers)
-- ---------------------------------------------------------------------------

create table if not exists public.bitacora (
  id bigserial primary key,
  quien uuid,
  accion text not null,
  tabla text not null,
  fila text,
  detalle jsonb,
  cuando timestamptz not null default now()
);
create index if not exists bitacora_cuando on public.bitacora (cuando desc);

create or replace function public.anotar_cambio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  fila jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  antes jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  cambio jsonb := '{}';
  k text;
begin
  -- En un cambio, solo lo que cambió; en un borrado, todo lo que se borró.
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(fila) loop
      if k not in ('actualizado') and fila -> k is distinct from antes -> k then
        cambio := cambio || jsonb_build_object(k, jsonb_build_array(antes -> k, fila -> k));
      end if;
    end loop;
    if cambio = '{}' then return null; end if;
  elsif tg_op = 'DELETE' then
    cambio := fila;
  end if;
  insert into bitacora (quien, accion, tabla, fila, detalle)
  values (auth.uid(), lower(tg_op), tg_table_name, coalesce(fila ->> 'id', fila ->> 'recepcion_id'), nullif(cambio, '{}'));
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['perfiles', 'proveedores', 'productos', 'pedidos', 'pedido_lineas', 'recepciones', 'recepcion_lineas', 'recepcion_archivos', 'salidas'] loop
    execute format('drop trigger if exists inv_bitacora on public.%I', t);
    execute format('create trigger inv_bitacora after insert or update or delete on public.%I for each row execute function public.anotar_cambio()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Candados
-- ---------------------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.proveedores enable row level security;
alter table public.productos enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_lineas enable row level security;
alter table public.recepciones enable row level security;
alter table public.recepcion_lineas enable row level security;
alter table public.recepcion_archivos enable row level security;
alter table public.salidas enable row level security;
alter table public.bitacora enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('perfiles', 'proveedores', 'productos', 'pedidos', 'pedido_lineas', 'recepciones', 'recepcion_lineas', 'recepcion_archivos', 'salidas', 'bitacora')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Personas: todos ven quién es quién; solo el admin cambia.
create policy perfiles_ver on public.perfiles for select to authenticated using (id = auth.uid() or es_alguien());
create policy perfiles_admin on public.perfiles for update to authenticated using (es_admin()) with check (es_admin());
create policy perfiles_borrar on public.perfiles for delete to authenticated using (es_admin() and id <> auth.uid());

-- Catálogo: todos ven y agregan; cambian quien compra; borra el admin.
create policy proveedores_ver on public.proveedores for select to authenticated using (es_alguien());
create policy proveedores_crear on public.proveedores for insert to authenticated with check (es_alguien());
create policy proveedores_cambiar on public.proveedores for update to authenticated using (compra()) with check (compra());
create policy proveedores_borrar on public.proveedores for delete to authenticated using (es_admin());
create policy productos_ver on public.productos for select to authenticated using (es_alguien());
create policy productos_crear on public.productos for insert to authenticated with check (es_alguien());
create policy productos_cambiar on public.productos for update to authenticated using (compra()) with check (compra());
create policy productos_borrar on public.productos for delete to authenticated using (es_admin());

-- Pedidos: todos ven; se hacen y se compran con hacer_pedido y marcar_comprado.
create policy pedidos_ver on public.pedidos for select to authenticated using (es_alguien());
create policy pedidos_admin on public.pedidos for update to authenticated using (es_admin()) with check (es_admin());
create policy pedidos_borrar on public.pedidos for delete to authenticated using (es_admin());
create policy pedido_lineas_ver on public.pedido_lineas for select to authenticated using (es_alguien());
create policy pedido_lineas_admin on public.pedido_lineas for all to authenticated using (es_admin()) with check (es_admin());

-- Recepciones: todos ven y reciben; los triggers cuidan que lo cerrado no cambie.
create policy recepciones_ver on public.recepciones for select to authenticated using (es_alguien());
create policy recepciones_crear on public.recepciones for insert to authenticated with check (es_alguien());
create policy recepciones_cambiar on public.recepciones for update to authenticated using (es_alguien()) with check (es_alguien());
create policy recepciones_borrar on public.recepciones for delete to authenticated using (es_admin());
create policy rec_lineas_ver on public.recepcion_lineas for select to authenticated using (es_alguien());
create policy rec_lineas_crear on public.recepcion_lineas for insert to authenticated with check (es_alguien());
create policy rec_lineas_cambiar on public.recepcion_lineas for update to authenticated using (es_alguien()) with check (es_alguien());
create policy rec_lineas_borrar on public.recepcion_lineas for delete to authenticated using (es_alguien());
create policy rec_archivos_ver on public.recepcion_archivos for select to authenticated using (es_alguien());
create policy rec_archivos_crear on public.recepcion_archivos for insert to authenticated with check (es_alguien());
create policy rec_archivos_cambiar on public.recepcion_archivos for update to authenticated using (es_alguien()) with check (es_alguien());
create policy rec_archivos_borrar on public.recepcion_archivos for delete to authenticated using (es_alguien());

-- Salidas: todos ven y anotan; cambia y borra el admin.
create policy salidas_ver on public.salidas for select to authenticated using (es_alguien());
create policy salidas_crear on public.salidas for insert to authenticated with check (es_alguien());
create policy salidas_admin on public.salidas for update to authenticated using (es_admin()) with check (es_admin());
create policy salidas_borrar on public.salidas for delete to authenticated using (es_admin());

-- Bitácora: solo el admin.
create policy bitacora_ver on public.bitacora for select to authenticated using (es_admin());

-- ---------------------------------------------------------------------------
-- Fotos de las recepciones
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recepciones', 'recepciones', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists inv_fotos_ver on storage.objects;
create policy inv_fotos_ver on storage.objects for select to authenticated using (bucket_id = 'recepciones' and es_alguien());
drop policy if exists inv_fotos_subir on storage.objects;
create policy inv_fotos_subir on storage.objects for insert to authenticated with check (bucket_id = 'recepciones' and es_alguien());
drop policy if exists inv_fotos_borrar on storage.objects;
create policy inv_fotos_borrar on storage.objects for delete to authenticated using (bucket_id = 'recepciones' and es_admin());
