-- Abuelito Go — esquema inicial
-- Multiempresa desde el inicio: cada fila pertenece a una empresa y las políticas
-- RLS impiden ver datos de otra empresa. Los choferes solo ven sus rutas.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type rol_usuario as enum ('admin', 'despachador', 'chofer');
create type condicion_pago as enum ('contado', 'credito');
create type estado_orden as enum ('pendiente', 'en_ruta', 'entregada', 'parcial', 'no_entregada', 'cancelada');
create type estado_ruta as enum ('borrador', 'publicada', 'en_curso', 'terminada', 'cerrada');
create type estado_parada as enum ('pendiente', 'entregada', 'parcial', 'no_entregada');
create type metodo_pago as enum ('efectivo', 'transferencia');
create type momento_temperatura as enum ('carga', 'entrega', 'regreso', 'sensor');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- Bodega: punto de salida y regreso de las rutas, usado por el optimizador.
  base_direccion text,
  base_lat double precision,
  base_lng double precision,
  creado_en timestamptz not null default now()
);

create table perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid not null references empresas (id),
  nombre text not null,
  rol rol_usuario not null,
  telefono text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table camionetas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  nombre text not null,
  placas text,
  capacidad_kg numeric,
  -- Identificador del sensor de temperatura instalado (fase 2).
  sensor_id text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  codigo text,
  nombre text not null,
  contacto text,
  telefono text,
  direccion text not null,
  lat double precision,
  lng double precision,
  horario_desde time,
  horario_hasta time,
  notas text,
  condicion_pago condicion_pago not null default 'contado',
  limite_credito numeric(12, 2) not null default 0,
  -- Positivo = el cliente nos debe.
  saldo numeric(12, 2) not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  sku text,
  nombre text not null,
  unidad text not null default 'pza',
  precio numeric(12, 2) not null default 0,
  temp_min numeric(5, 1),
  temp_max numeric(5, 1),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (empresa_id, sku)
);

create table ordenes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  folio bigint generated always as identity,
  cliente_id uuid not null references clientes (id),
  fecha_entrega date not null,
  estado estado_orden not null default 'pendiente',
  notas text,
  creado_por uuid references perfiles (id),
  creado_en timestamptz not null default now()
);
create index on ordenes (empresa_id, fecha_entrega);

create table orden_lineas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  orden_id uuid not null references ordenes (id) on delete cascade,
  producto_id uuid not null references productos (id),
  cantidad numeric(12, 3) not null check (cantidad > 0),
  precio_unitario numeric(12, 2) not null,
  cantidad_entregada numeric(12, 3)
);
create index on orden_lineas (orden_id);

create table rutas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  fecha date not null,
  nombre text not null,
  chofer_id uuid references perfiles (id),
  camioneta_id uuid references camionetas (id),
  estado estado_ruta not null default 'borrador',
  iniciada_en timestamptz,
  terminada_en timestamptz,
  efectivo_recibido numeric(12, 2),
  notas_cierre text,
  cerrada_por uuid references perfiles (id),
  cerrada_en timestamptz,
  creado_en timestamptz not null default now()
);
create index on rutas (empresa_id, fecha);
create index on rutas (chofer_id, fecha);

create table paradas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  ruta_id uuid not null references rutas (id) on delete cascade,
  orden_id uuid not null unique references ordenes (id),
  secuencia int not null,
  estado estado_parada not null default 'pendiente',
  motivo text,
  recibio_nombre text,
  foto_path text,
  firma_path text,
  lat double precision,
  lng double precision,
  completada_en timestamptz,
  -- Id de la operación que la cerró desde la app: hace idempotentes los reintentos sin señal.
  op_id uuid unique
);
create index on paradas (ruta_id, secuencia);

create table pagos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  parada_id uuid references paradas (id),
  cliente_id uuid not null references clientes (id),
  metodo metodo_pago not null,
  monto numeric(12, 2) not null check (monto > 0),
  referencia text,
  registrado_por uuid references perfiles (id),
  creado_en timestamptz not null default now()
);
create index on pagos (parada_id);

create table lecturas_temperatura (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id),
  ruta_id uuid references rutas (id) on delete cascade,
  camioneta_id uuid references camionetas (id),
  parada_id uuid references paradas (id) on delete cascade,
  momento momento_temperatura not null,
  valor_c numeric(5, 1) not null,
  registrado_por uuid references perfiles (id),
  creado_en timestamptz not null default now()
);
create index on lecturas_temperatura (ruta_id);

create table ubicaciones (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references empresas (id),
  ruta_id uuid not null references rutas (id) on delete cascade,
  chofer_id uuid not null references perfiles (id),
  lat double precision not null,
  lng double precision not null,
  velocidad double precision,
  registrado_en timestamptz not null default now()
);
create index on ubicaciones (ruta_id, registrado_en desc);

-- ---------------------------------------------------------------------------
-- Funciones de sesión (security definer para no recursar en las políticas)
-- ---------------------------------------------------------------------------
create function mi_empresa() returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from perfiles where id = auth.uid() and activo
$$;

create function mi_rol() returns rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from perfiles where id = auth.uid() and activo
$$;

create function es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(mi_rol() in ('admin', 'despachador'), false)
$$;

-- Rutas visibles para el chofer: las suyas, ya publicadas.
create function mis_rutas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from rutas
  where chofer_id = auth.uid() and estado <> 'borrador'
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table empresas enable row level security;
alter table perfiles enable row level security;
alter table camionetas enable row level security;
alter table clientes enable row level security;
alter table productos enable row level security;
alter table ordenes enable row level security;
alter table orden_lineas enable row level security;
alter table rutas enable row level security;
alter table paradas enable row level security;
alter table pagos enable row level security;
alter table lecturas_temperatura enable row level security;
alter table ubicaciones enable row level security;

-- Empresa: todos leen la suya; solo admin la edita.
create policy empresa_lectura on empresas for select using (id = mi_empresa());
create policy empresa_admin on empresas for update using (id = mi_empresa() and mi_rol() = 'admin');

-- Perfiles: cada quien lee el suyo; staff lee los de su empresa; admin edita.
-- El alta de usuarios pasa por la función crear-usuario (service role).
create policy perfil_propio on perfiles for select using (id = auth.uid());
create policy perfil_staff on perfiles for select using (empresa_id = mi_empresa() and es_staff());
create policy perfil_admin on perfiles for update using (empresa_id = mi_empresa() and mi_rol() = 'admin');

-- Catálogos y operación: staff con acceso total dentro de su empresa.
create policy staff_todo on camionetas for all
  using (empresa_id = mi_empresa() and es_staff()) with check (empresa_id = mi_empresa() and es_staff());
create policy staff_todo on clientes for all
  using (empresa_id = mi_empresa() and es_staff()) with check (empresa_id = mi_empresa() and es_staff());
create policy staff_todo on productos for all
  using (empresa_id = mi_empresa() and es_staff()) with check (empresa_id = mi_empresa() and es_staff());
create policy staff_todo on ordenes for all
  using (empresa_id = mi_empresa() and es_staff()) with check (empresa_id = mi_empresa() and es_staff());
create policy staff_todo on orden_lineas for all
  using (empresa_id = mi_empresa() and es_staff()) with check (empresa_id = mi_empresa() and es_staff());
create policy staff_todo on rutas for all
  using (empresa_id = mi_empresa() and es_staff()) with check (empresa_id = mi_empresa() and es_staff());
create policy staff_todo on paradas for all
  using (empresa_id = mi_empresa() and es_staff()) with check (empresa_id = mi_empresa() and es_staff());
create policy staff_todo on pagos for all
  using (empresa_id = mi_empresa() and es_staff()) with check (empresa_id = mi_empresa() and es_staff());
create policy staff_todo on lecturas_temperatura for all
  using (empresa_id = mi_empresa() and es_staff()) with check (empresa_id = mi_empresa() and es_staff());
create policy staff_lectura on ubicaciones for select using (empresa_id = mi_empresa() and es_staff());

-- Chofer: solo lectura de lo que toca sus rutas. Sus escrituras pasan por las
-- funciones registrar_entrega / iniciar_ruta / terminar_ruta, que validan todo.
create policy chofer_rutas on rutas for select using (id in (select mis_rutas()));
create policy chofer_paradas on paradas for select using (ruta_id in (select mis_rutas()));
create policy chofer_ordenes on ordenes for select
  using (id in (select orden_id from paradas where ruta_id in (select mis_rutas())));
create policy chofer_lineas on orden_lineas for select
  using (orden_id in (select orden_id from paradas where ruta_id in (select mis_rutas())));
create policy chofer_clientes on clientes for select
  using (id in (select o.cliente_id from ordenes o join paradas p on p.orden_id = o.id
                where p.ruta_id in (select mis_rutas())));
create policy chofer_productos on productos for select using (empresa_id = mi_empresa());
create policy chofer_camionetas on camionetas for select
  using (id in (select camioneta_id from rutas where id in (select mis_rutas())));
create policy chofer_pagos on pagos for select using (parada_id in (select id from paradas where ruta_id in (select mis_rutas())));
create policy chofer_temperaturas on lecturas_temperatura for select using (ruta_id in (select mis_rutas()));
create policy chofer_ubicacion on ubicaciones for insert
  with check (chofer_id = auth.uid() and empresa_id = mi_empresa() and ruta_id in (select mis_rutas()));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- Una orden en una parada queda "en_ruta"; si se quita de la ruta vuelve a "pendiente".
create function sincronizar_estado_orden() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update ordenes set estado = 'en_ruta' where id = new.orden_id and estado = 'pendiente';
    return new;
  elsif tg_op = 'DELETE' then
    update ordenes set estado = 'pendiente' where id = old.orden_id and estado = 'en_ruta';
    return old;
  end if;
  return null;
end $$;

create trigger paradas_estado_orden
after insert or delete on paradas
for each row execute function sincronizar_estado_orden();

-- ---------------------------------------------------------------------------
-- Operaciones del chofer
-- ---------------------------------------------------------------------------
create function iniciar_ruta(p_ruta_id uuid, p_temperatura numeric)
returns void language plpgsql security definer set search_path = public as $$
declare r rutas;
begin
  select * into r from rutas where id = p_ruta_id for update;
  if r.id is null or r.chofer_id <> auth.uid() then
    raise exception 'Ruta no asignada a este chofer';
  end if;
  if r.estado = 'publicada' then
    update rutas set estado = 'en_curso', iniciada_en = now() where id = p_ruta_id;
    insert into lecturas_temperatura (empresa_id, ruta_id, camioneta_id, momento, valor_c, registrado_por)
    values (r.empresa_id, r.id, r.camioneta_id, 'carga', p_temperatura, auth.uid());
  elsif r.estado <> 'en_curso' then
    raise exception 'La ruta no se puede iniciar en estado %', r.estado;
  end if;
end $$;

create function terminar_ruta(p_ruta_id uuid, p_temperatura numeric)
returns void language plpgsql security definer set search_path = public as $$
declare r rutas;
begin
  select * into r from rutas where id = p_ruta_id for update;
  if r.id is null or r.chofer_id <> auth.uid() then
    raise exception 'Ruta no asignada a este chofer';
  end if;
  if r.estado = 'en_curso' then
    update rutas set estado = 'terminada', terminada_en = now() where id = p_ruta_id;
    if p_temperatura is not null then
      insert into lecturas_temperatura (empresa_id, ruta_id, camioneta_id, momento, valor_c, registrado_por)
      values (r.empresa_id, r.id, r.camioneta_id, 'regreso', p_temperatura, auth.uid());
    end if;
  elsif r.estado <> 'terminada' then
    raise exception 'La ruta no se puede terminar en estado %', r.estado;
  end if;
end $$;

-- Registra en una sola transacción: resultado de la parada, cantidades entregadas,
-- pagos, temperatura y saldo del cliente. Idempotente por p_op_id para la cola sin señal.
--
-- p_lineas: [{"linea_id": uuid, "cantidad_entregada": number}]
-- p_pagos:  [{"metodo": "efectivo"|"transferencia", "monto": number, "referencia": text}]
create function registrar_entrega(
  p_op_id uuid,
  p_parada_id uuid,
  p_estado estado_parada,
  p_lineas jsonb default '[]',
  p_pagos jsonb default '[]',
  p_temperatura numeric default null,
  p_motivo text default null,
  p_recibio_nombre text default null,
  p_foto_path text default null,
  p_firma_path text default null,
  p_lat double precision default null,
  p_lng double precision default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  pa paradas;
  r rutas;
  o ordenes;
  v_importe numeric(12, 2);
  v_pagado numeric(12, 2);
  l jsonb;
begin
  if exists (select 1 from paradas where op_id = p_op_id) then
    return; -- reintento de una operación ya aplicada
  end if;

  select * into pa from paradas where id = p_parada_id for update;
  select * into r from rutas where id = pa.ruta_id;
  if pa.id is null or r.chofer_id <> auth.uid() then
    raise exception 'Parada no asignada a este chofer';
  end if;
  if r.estado <> 'en_curso' then
    raise exception 'La ruta no está en curso';
  end if;
  if pa.estado <> 'pendiente' then
    raise exception 'La parada ya fue registrada';
  end if;
  if p_estado = 'pendiente' then
    raise exception 'Estado inválido';
  end if;
  if p_estado = 'no_entregada' and coalesce(p_motivo, '') = '' then
    raise exception 'Falta el motivo de no entrega';
  end if;

  select * into o from ordenes where id = pa.orden_id;

  -- Cantidades entregadas: total = todo; no entregada = cero; parcial = lo capturado.
  if p_estado = 'entregada' then
    update orden_lineas set cantidad_entregada = cantidad where orden_id = o.id;
  elsif p_estado = 'no_entregada' then
    update orden_lineas set cantidad_entregada = 0 where orden_id = o.id;
  else
    for l in select * from jsonb_array_elements(p_lineas) loop
      update orden_lineas
      set cantidad_entregada = least(greatest((l ->> 'cantidad_entregada')::numeric, 0), cantidad)
      where id = (l ->> 'linea_id')::uuid and orden_id = o.id;
    end loop;
    update orden_lineas set cantidad_entregada = 0 where orden_id = o.id and cantidad_entregada is null;
  end if;

  for l in select * from jsonb_array_elements(p_pagos) loop
    if (l ->> 'monto')::numeric > 0 then
      insert into pagos (empresa_id, parada_id, cliente_id, metodo, monto, referencia, registrado_por)
      values (pa.empresa_id, pa.id, o.cliente_id, (l ->> 'metodo')::metodo_pago,
              (l ->> 'monto')::numeric, l ->> 'referencia', auth.uid());
    end if;
  end loop;

  -- Saldo: se carga lo entregado y se abona lo cobrado (puede abonar saldo anterior).
  select coalesce(sum(cantidad_entregada * precio_unitario), 0) into v_importe
  from orden_lineas where orden_id = o.id;
  select coalesce(sum(monto), 0) into v_pagado from pagos where parada_id = pa.id;
  update clientes set saldo = saldo + v_importe - v_pagado where id = o.cliente_id;

  if p_temperatura is not null then
    insert into lecturas_temperatura (empresa_id, ruta_id, camioneta_id, parada_id, momento, valor_c, registrado_por)
    values (pa.empresa_id, r.id, r.camioneta_id, pa.id, 'entrega', p_temperatura, auth.uid());
  end if;

  update paradas set
    estado = p_estado,
    motivo = p_motivo,
    recibio_nombre = p_recibio_nombre,
    foto_path = p_foto_path,
    firma_path = p_firma_path,
    lat = p_lat,
    lng = p_lng,
    completada_en = now(),
    op_id = p_op_id
  where id = pa.id;

  update ordenes set estado = p_estado::text::estado_orden where id = o.id;
end $$;

-- ---------------------------------------------------------------------------
-- Cierre de ruta (staff)
-- ---------------------------------------------------------------------------
create view resumen_rutas with (security_invoker = true) as
select
  r.id as ruta_id,
  r.empresa_id,
  r.fecha,
  r.nombre,
  r.estado,
  r.chofer_id,
  r.camioneta_id,
  r.efectivo_recibido,
  count(p.id) as paradas_total,
  count(p.id) filter (where p.estado <> 'pendiente') as paradas_completadas,
  count(p.id) filter (where p.estado = 'no_entregada') as paradas_fallidas,
  coalesce((select sum(pg.monto) from pagos pg join paradas p2 on p2.id = pg.parada_id
            where p2.ruta_id = r.id and pg.metodo = 'efectivo'), 0) as efectivo_esperado,
  coalesce((select sum(pg.monto) from pagos pg join paradas p2 on p2.id = pg.parada_id
            where p2.ruta_id = r.id and pg.metodo = 'transferencia'), 0) as transferencias
from rutas r
left join paradas p on p.ruta_id = r.id
group by r.id;

create function cerrar_ruta(p_ruta_id uuid, p_efectivo_recibido numeric, p_notas text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r rutas;
begin
  select * into r from rutas where id = p_ruta_id for update;
  if r.id is null or r.empresa_id <> mi_empresa() or not es_staff() then
    raise exception 'Sin permiso para cerrar esta ruta';
  end if;
  if r.estado <> 'terminada' then
    raise exception 'Solo se cierran rutas terminadas (estado actual: %)', r.estado;
  end if;
  update rutas set
    estado = 'cerrada',
    efectivo_recibido = p_efectivo_recibido,
    notas_cierre = p_notas,
    cerrada_por = auth.uid(),
    cerrada_en = now()
  where id = p_ruta_id;
end $$;

-- Solo usuarios con sesión pueden llamar a las funciones de negocio.
revoke execute on function iniciar_ruta, terminar_ruta, registrar_entrega, cerrar_ruta from public, anon;
grant execute on function iniciar_ruta, terminar_ruta, registrar_entrega, cerrar_ruta to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: fotos y firmas de entrega, organizadas por empresa/ruta/parada
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('entregas', 'entregas', false)
on conflict (id) do nothing;

create policy entregas_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'entregas' and (storage.foldername(name))[1] = mi_empresa()::text);
create policy entregas_leer on storage.objects for select to authenticated
  using (bucket_id = 'entregas' and (storage.foldername(name))[1] = mi_empresa()::text);

-- Tiempo real: el panel escucha cambios de paradas, rutas y ubicaciones.
alter publication supabase_realtime add table paradas, rutas, ubicaciones;
