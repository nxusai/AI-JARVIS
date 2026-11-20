-- Datos de EJEMPLO para mostrar el avance al cliente (NXUS AI).
-- Todos los nombres, montos y deudas son inventados. Se marcan es_demo = true y
-- se borran con 99_borrar_demo.sql antes de importar la información real.
--
-- Fórmula tomada del sistema actual (deducida, por confirmar con el dueño):
-- interés plano de 50 %, 10 cuotas de 15 % del monto, casi todos semanales.
-- Se corre DESPUÉS de 01, 03, 04 y 05.
--
-- Se puede volver a correr: primero borra el ejemplo anterior.

begin;

-- Los pagos de ejemplo ya vienen con el saldo calculado: no se aplican los automáticos
alter table public.pagos disable trigger pago_antes;
alter table public.pagos disable trigger pago_despues;

delete from public.proyecciones where es_demo;
delete from public.personal where es_demo;
delete from public.movimientos_tesoreria where es_demo;
delete from public.cuentas_bancarias where es_demo;
delete from public.pagos where es_demo;
delete from public.solicitudes where es_demo;
delete from public.creditos where es_demo;
delete from public.clientes where es_demo;
delete from public.rutas where es_demo;
delete from public.oficinas where es_demo;
delete from public.gerencias where es_demo;
delete from public.zonas where es_demo;
delete from public.regiones where es_demo;

insert into public.regiones (id, nombre, responsable, es_demo) values
  (1, 'Región Valle de México', 'Ricardo Solís (ejemplo)', true);

insert into public.zonas (id, region_id, nombre, responsable, es_demo) values
  (1, 1, 'Zona Ecatepec', 'Adriana Ponce (ejemplo)', true),
  (2, 1, 'Zona Tecámac', 'Héctor Lugo (ejemplo)', true);

insert into public.gerencias (id, zona_id, nombre, responsable, es_demo) values
  (1, 1, 'Gerencia Ecatepec', 'Laura Mendoza (ejemplo)', true),
  (2, 1, 'Gerencia Coacalco', 'Jorge Ibarra (ejemplo)', true),
  (3, 2, 'Gerencia Tecámac', 'Patricia Rosas (ejemplo)', true),
  (4, 2, 'Gerencia Tultitlán', 'Miguel Ángel Cruz (ejemplo)', true);

insert into public.oficinas (id, gerencia_id, nombre, es_demo) values
  (1, 1, 'Ecatepec Centro', true),
  (2, 1, 'Sur Ecatepec', true),
  (3, 2, 'Coacalco', true),
  (4, 3, 'Tecámac', true),
  (5, 3, 'Tecámac Sur', true),
  (6, 4, 'Tultitlán', true);

insert into public.rutas (id, oficina_id, nombre, responsable, es_demo) values
  (1, 1, 'Ecatepec Centro 1', 'Diana Flores', true),
  (2, 1, 'Ecatepec Centro 2', 'Óscar Medina', true),
  (3, 2, 'Sur Ecatepec 1', 'Karla Núñez', true),
  (4, 2, 'Sur Ecatepec 2', 'Raúl Herrera', true),
  (5, 3, 'Coacalco 1', 'Brenda Ortiz', true),
  (6, 3, 'Coacalco 2', 'Iván Castillo', true),
  (7, 4, 'Tecámac 1', 'Mónica Vega', true),
  (8, 4, 'Tecámac 2', 'Alberto Ríos', true),
  (9, 5, 'Tecámac Sur 1', 'Sandra Paredes', true),
  (10, 6, 'Tultitlán 1', 'Fernando Rubio', true),
  (11, 6, 'Tultitlán 2', 'Gabriela Soto', true),
  (12, 6, 'Tultitlán 3', 'Ernesto Valdez', true);

create or replace function pg_temp.curp_fake(fn date, sexo text) returns text language sql volatile as $$
  select string_agg(chr(65 + floor(random() * 26)::int), '') || to_char(fn, 'YYMMDD') || sexo || 'MC'
         || chr(66 + floor(random() * 20)::int) || chr(66 + floor(random() * 20)::int) || chr(66 + floor(random() * 20)::int)
         || lpad(floor(random() * 100)::int::text, 2, '0')
  from generate_series(1, 4);
$$;

do $$
declare
  nombres text[] := array['María','José','Guadalupe','Juan','Rosa','Luis','Ana','Carlos','Verónica','Miguel',
    'Leticia','Jesús','Martha','Pedro','Elena','Francisco','Alejandra','Antonio','Silvia','Roberto',
    'Claudia','Javier','Norma','Daniel','Teresa','Arturo','Lucía','Sergio','Patricia','Ramón',
    'Gloria','Manuel','Yolanda','Eduardo','Irma','Alfredo','Adriana','Enrique','Beatriz','Rafael'];
  mujeres int[] := array[1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,39];
  apellidos text[] := array['Hernández','García','Martínez','López','González','Pérez','Rodríguez','Sánchez',
    'Ramírez','Cruz','Flores','Gómez','Morales','Vázquez','Reyes','Jiménez','Torres','Díaz','Gutiérrez','Ruiz',
    'Mendoza','Aguilar','Ortiz','Moreno','Castillo','Romero','Álvarez','Chávez','Rivera','Juárez'];
  colonias text[] := array['Jardines de Morelos','Ciudad Azteca','San Cristóbal','Las Américas','Villa de las Flores',
    'Héroes Tecámac','Ojo de Agua','Los Héroes','Real del Sol','Buenavista','San Pablo','Lomas de Cartagena'];
  calles text[] := array['Av. Central','Calle Pino','Calle Hidalgo','Av. Morelos','Calle Fresno','Calle Juárez','Calle Olivo','Av. Insurgentes'];
  hoy date := current_date;
  r int; i int; cid int := 0; kid int := 0; n int; ni int;
  monto numeric; total numeric; cuota numeric; frec text; dias_periodo int;
  inicio date; vencidas int; pagadas int; perdidas int; atraso int; f date;
  modo text; ant_id int; ant_monto numeric; ant_inicio date; ant_total numeric; desc_ren numeric; fnac date;
begin
  perform setseed(0.42);
  for r in 1..12 loop
    n := 14 + floor(random() * 9)::int;            -- 14 a 22 clientes por ruta
    for i in 1..n loop
      cid := cid + 1;
      ni := 1 + floor(random() * array_length(nombres, 1))::int;
      fnac := date '1965-01-01' + floor(random() * 12000)::int;
      insert into public.clientes (id, codigo, nombre, ruta_id, colonia, telefono, creado, curp, fecha_nacimiento, direccion, es_demo)
      values (cid, 'C-' || lpad(cid::text, 5, '0'),
              nombres[ni] || ' ' ||
              apellidos[1 + floor(random() * array_length(apellidos, 1))::int] || ' ' ||
              apellidos[1 + floor(random() * array_length(apellidos, 1))::int],
              r, colonias[1 + floor(random() * array_length(colonias, 1))::int],
              '55 0000 ' || lpad((cid % 10000)::text, 4, '0'), hoy - 400,
              pg_temp.curp_fake(fnac, case when ni = any(mujeres) then 'M' else 'H' end), fnac,
              calles[1 + floor(random() * array_length(calles, 1))::int] || ' ' || (1 + floor(random() * 300))::int || ' (ejemplo)', true);

      monto := (6 + floor(random() * 35)) * 500;      -- $3,000 a $20,000
      total := round(monto * 1.50, 2);                  -- 50 % plano
      frec := case when random() < 0.85 then 'semanal' when random() < 0.67 then 'quincenal' else 'mensual' end;
      dias_periodo := case frec when 'semanal' then 7 when 'quincenal' then 15 else 30 end;
      cuota := round(monto * 0.15, 2);
      inicio := hoy - floor(random() * least(160, dias_periodo * 11))::int;
      -- Renovaciones y recompras sólo en semanales y quincenales (el expediente cabe en el último año)
      modo := case when frec = 'mensual' then 'nuevo' when random() < 0.18 then 'renovacion' when random() < 0.08 then 'recompra' else 'nuevo' end;
      ant_id := null; desc_ren := 0;

      -- Expediente anterior: renovado al 80 % (8 de 10 pagos) o liquidado y vuelto a pedir
      if modo <> 'nuevo' then
        kid := kid + 1; ant_id := kid;
        ant_monto := greatest(3000, round(monto * (0.6 + random() * 0.4) / 500) * 500);
        ant_total := round(ant_monto * 1.5, 2);
        ant_inicio := case when modo = 'renovacion' then inicio - 8 * dias_periodo
                           else inicio - 10 * dias_periodo - (30 + floor(random() * 30))::int end;
        insert into public.creditos (id, cliente_id, monto, total_pagar, cuota, frecuencia, num_cuotas, fecha_inicio, cuotas_pagadas,
          saldo, dias_atraso, ultimo_pago, tipo, entregado, seguro, es_demo)
        values (kid, cid, ant_monto, ant_total, round(ant_monto * 0.15, 2), frec, 10, ant_inicio, 10, 0, 0,
          case when modo = 'renovacion' then inicio else ant_inicio + 10 * dias_periodo end, 'nuevo', ant_monto, 150, true);
        for f in select (ant_inicio + s * dias_periodo)::date from generate_series(1, case when modo = 'renovacion' then 8 else 10 end) s loop
          insert into public.pagos (credito_id, fecha, monto, tipo, es_demo) values (kid, f, round(ant_monto * 0.15, 2), 'cuota', true);
        end loop;
        if modo = 'renovacion' then
          desc_ren := round(ant_total - 8 * round(ant_monto * 0.15, 2), 2);
          insert into public.pagos (credito_id, fecha, monto, tipo, es_demo) values (kid, inicio, desc_ren, 'liquidacion_renovacion', true);
        end if;
      end if;

      vencidas := least(10, floor((hoy - inicio) / dias_periodo)::int);
      perdidas := case when random() < 0.68 then 0 when random() < 0.55 then 1 when random() < 0.60 then 2
                       else 3 + floor(random() * 4)::int end;
      pagadas := greatest(0, vencidas - perdidas);
      atraso := case when pagadas >= vencidas then 0 else greatest(1, (hoy - (inicio + (pagadas + 1) * dias_periodo))) end;
      kid := kid + 1;
      insert into public.creditos (id, cliente_id, monto, total_pagar, cuota, frecuencia, num_cuotas,
        fecha_inicio, cuotas_pagadas, saldo, dias_atraso, ultimo_pago, tipo, credito_anterior_id, descuento_renovacion, entregado, seguro, es_demo)
      values (kid, cid, monto, total, cuota, frec, 10, inicio, pagadas,
        greatest(0, round(total - pagadas * cuota, 2)), atraso,
        case when pagadas > 0 then least(hoy, inicio + pagadas * dias_periodo) end,
        modo, ant_id, desc_ren, monto - desc_ren, 150, true);
      for f in select (inicio + s * dias_periodo)::date from generate_series(1, pagadas) s loop
        insert into public.pagos (credito_id, fecha, monto, tipo, es_demo)
        values (kid, least(hoy, f + floor(random() * 2)::int), cuota, 'cuota', true);
      end loop;
    end loop;
  end loop;

  -- Pagos de hoy para que el tablero del día tenga movimiento
  insert into public.pagos (credito_id, fecha, monto, tipo, es_demo)
  select c.id, hoy, c.cuota, 'cuota', true
  from public.creditos c
  where c.es_demo and c.saldo > 0 and c.frecuencia = 'semanal'
    and extract(dow from c.fecha_inicio) = extract(dow from hoy) and c.dias_atraso = 0;

  -- Solicitudes en distintos estados (mesa de control); también las que no se concretaron
  insert into public.solicitudes (id, cliente_nombre, ruta_id, monto, estado, creada, tipo, curp, telefono, colonia, direccion, fecha_nacimiento, motivo, es_demo) values
    (1, 'Solicitante A (ejemplo)', 1, 8000, 'borrador', hoy, 'nuevo', pg_temp.curp_fake(date '1988-04-12', 'M'), '55 1111 0001', 'Ciudad Azteca', 'Calle Pino 12 (ejemplo)', date '1988-04-12', null, true),
    (2, 'Solicitante B (ejemplo)', 4, 5000, 'borrador', hoy, 'nuevo', pg_temp.curp_fake(date '1979-09-30', 'H'), '55 1111 0002', 'San Cristóbal', 'Av. Central 40 (ejemplo)', date '1979-09-30', null, true),
    (3, 'Solicitante C (ejemplo)', 7, 12000, 'revision', hoy - 1, 'nuevo', pg_temp.curp_fake(date '1990-01-22', 'H'), '55 1111 0003', 'Ojo de Agua', 'Calle Olivo 7 (ejemplo)', date '1990-01-22', null, true),
    (4, 'Solicitante D (ejemplo)', 2, 6500, 'revision', hoy, 'nuevo', pg_temp.curp_fake(date '1985-06-03', 'M'), '55 1111 0004', 'Las Américas', 'Calle Juárez 88 (ejemplo)', date '1985-06-03', null, true),
    (5, 'Solicitante E (ejemplo)', 10, 9000, 'revision', hoy, 'nuevo', pg_temp.curp_fake(date '1993-11-15', 'M'), '55 1111 0005', 'Buenavista', 'Calle Fresno 3 (ejemplo)', date '1993-11-15', null, true),
    (6, 'Solicitante F (ejemplo)', 5, 4000, 'observada', hoy - 2, 'nuevo', pg_temp.curp_fake(date '1982-02-08', 'H'), '55 1111 0006', 'Villa de las Flores', 'Av. Morelos 101 (ejemplo)', date '1982-02-08', 'Falta comprobante de domicilio', true),
    (7, 'Solicitante G (ejemplo)', 9, 15000, 'aprobada', hoy - 1, 'nuevo', pg_temp.curp_fake(date '1977-07-19', 'M'), '55 1111 0007', 'Real del Sol', 'Calle Hidalgo 15 (ejemplo)', date '1977-07-19', null, true),
    (8, 'Solicitante H (ejemplo)', 3, 7000, 'aprobada', hoy, 'nuevo', pg_temp.curp_fake(date '1995-03-27', 'H'), '55 1111 0008', 'Jardines de Morelos', 'Calle Pino 60 (ejemplo)', date '1995-03-27', null, true),
    (9, 'Solicitante I (ejemplo)', 11, 20000, 'rechazada', hoy - 3, 'nuevo', pg_temp.curp_fake(date '1980-12-01', 'H'), '55 1111 0009', 'San Pablo', 'Av. Insurgentes 9 (ejemplo)', date '1980-12-01', 'Ingresos insuficientes', true),
    (10, 'Solicitante J (ejemplo)', 6, 6000, 'cancelada', hoy - 5, 'nuevo', pg_temp.curp_fake(date '1987-05-05', 'M'), '55 1111 0010', 'Los Héroes', 'Calle Olivo 31 (ejemplo)', date '1987-05-05', 'El cliente ya no quiso el crédito', true);

  -- Expediente del personal (incluye dos bajas que se conservan 6 años)
  insert into public.personal (nombre, puesto, ambito, curp, fecha_nacimiento, direccion, telefono, correo, fecha_ingreso, es_demo)
  select r.responsable || ' (ejemplo)', 'Asesor de crédito', 'ruta:' || r.id, pg_temp.curp_fake(date '1985-01-01' + (r.id * 397) % 4000, 'M'),
         date '1985-01-01' + (r.id * 397) % 4000, 'Calle Pino ' || r.id * 7 || ' (ejemplo)', '55 2222 ' || lpad(r.id::text, 4, '0'),
         'asesor' || r.id || '@ejemplo.mx', hoy - 300 - r.id * 11, true
  from public.rutas r where r.es_demo;
  insert into public.personal (nombre, puesto, ambito, curp, fecha_nacimiento, direccion, telefono, correo, fecha_ingreso, es_demo)
  select g.responsable, 'Gerente', 'gerencia:' || g.id, pg_temp.curp_fake(date '1978-01-01' + (g.id * 523) % 4000, 'H'),
         date '1978-01-01' + (g.id * 523) % 4000, 'Av. Central ' || g.id * 13 || ' (ejemplo)', '55 3333 ' || lpad(g.id::text, 4, '0'),
         'gerente' || g.id || '@ejemplo.mx', hoy - 600 - g.id * 17, true
  from public.gerencias g where g.es_demo;
  insert into public.personal (nombre, puesto, ambito, curp, fecha_nacimiento, direccion, telefono, correo, fecha_ingreso, fecha_baja, motivo_baja, es_demo) values
    ('Rogelio Bautista (ejemplo)', 'Asesor de crédito', 'ruta:3', pg_temp.curp_fake(date '1991-08-14', 'H'), date '1991-08-14', 'Calle Juárez 14 (ejemplo)', '55 4444 0001', 'rogelio@ejemplo.mx', hoy - 700, hoy - 120, 'Renuncia voluntaria', true),
    ('Diana Salgado (ejemplo)', 'Asesor de crédito', 'ruta:8', pg_temp.curp_fake(date '1994-02-02', 'M'), date '1994-02-02', 'Av. Morelos 55 (ejemplo)', '55 4444 0002', 'diana.s@ejemplo.mx', hoy - 500, hoy - 40, 'Cambio de ciudad', true);
end $$;

-- ---------------------------------------------------------------------------
-- Tesorería de ejemplo: cuadra de punta a punta
--   fondeo de socios → banco → fondo fijo de cada gerente
--   asesor cobra → cierre 18:00 a su gerente → gerente redistribuye para prestar y gastos
--   cada sábado el gerente deposita al banco lo que sobró (o retira lo que faltó)
--   del banco salen nóminas y rentas
-- ---------------------------------------------------------------------------
do $$
declare
  hoy date := current_date;
  ini date;
  s date;
  g record;
  neto numeric;
begin
  perform setseed(0.77);
  select min(fecha_inicio) - 7 into ini from public.creditos where es_demo;

  insert into public.cuentas_bancarias (id, banco, alias, terminacion, es_demo) overriding system value values
    (1, 'BBVA', 'Cuenta operativa (ejemplo)', '4821', true),
    (2, 'Banorte', 'Cuenta de reserva (ejemplo)', '0937', true)
  on conflict (id) do nothing;
  perform setval(pg_get_serial_sequence('public.cuentas_bancarias', 'id'), 2);

  insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo) values
    (ini, 'fondeo', 'externo', 'banco:1', 'Fondeo', 'Aportación de capital de socios', 3800000, true),
    (ini, 'traslado', 'banco:1', 'banco:2', 'Reserva', 'Reserva de liquidez', 250000, true);

  insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo)
  select ini, 'retiro', 'banco:1', 'gerencia:' || id, 'Fondo fijo', 'Fondo fijo de gerencia', 90000, true
  from public.gerencias where es_demo;

  -- Gastos administrativos: entran a la caja del asesor el día del crédito
  insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo)
  select c.fecha_inicio, 'ingreso', 'externo', 'ruta:' || cl.ruta_id, 'Gastos administrativos', 'Gastos administrativos · crédito #' || c.id, c.seguro, true
  from public.creditos c join public.clientes cl on cl.id = c.cliente_id where c.es_demo and c.seguro > 0 and c.fecha_inicio >= ini;

  -- Gasolina diaria por ruta (lunes a sábado)
  create temporary table _gas on commit drop as
  select d::date as fecha, r.id as ruta_id, (80 + floor(random() * 80))::numeric as monto
  from generate_series(ini, hoy, interval '1 day') d cross join public.rutas r
  where r.es_demo and extract(dow from d) between 1 and 6;

  insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo)
  select fecha, 'egreso', 'ruta:' || ruta_id, 'externo', 'Gastos de ruta', 'Gasolina', monto, true from _gas;

  -- Redistribución de la mañana: el gerente da a cada ruta lo que va a prestar y gastar
  insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo)
  select x.fecha, 'traslado', 'gerencia:' || o.gerencia_id, 'ruta:' || x.ruta_id, 'Redistribución', 'Efectivo para colocar y gastos', sum(x.monto), true
  from (
    select c.fecha_inicio as fecha, cl.ruta_id, coalesce(c.entregado, c.monto) as monto from public.creditos c join public.clientes cl on cl.id = c.cliente_id where c.es_demo and c.fecha_inicio >= ini
    union all select fecha, ruta_id, monto from _gas
  ) x join public.rutas r on r.id = x.ruta_id join public.oficinas o on o.id = r.oficina_id
  group by x.fecha, x.ruta_id, o.gerencia_id;

  -- Cierre de las 18:00: la cobranza y los gastos administrativos del día pasan de la ruta a su gerente (hoy aún no cierra)
  insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo)
  select x.fecha, 'traslado', 'ruta:' || x.ruta_id, 'gerencia:' || o.gerencia_id, 'Cierre 18:00', 'Cobranza y gastos administrativos del día', sum(x.monto), true
  from (
    select p.fecha, cl.ruta_id, p.monto from public.pagos p join public.creditos c on c.id = p.credito_id join public.clientes cl on cl.id = c.cliente_id
    where p.es_demo and p.tipo = 'cuota' and p.fecha < hoy and p.fecha >= ini
    union all
    select m.fecha, split_part(m.caja_destino, ':', 2)::int, m.monto from public.movimientos_tesoreria m
    where m.es_demo and m.categoria in ('Gastos administrativos', 'Seguro') and m.fecha < hoy
  ) x join public.rutas r on r.id = x.ruta_id join public.oficinas o on o.id = r.oficina_id
  group by x.fecha, x.ruta_id, o.gerencia_id;

  -- Corte semanal (sábado): el gerente deposita al banco lo que sobró o retira lo que faltó
  for s in select d::date from generate_series(ini + 6, hoy - 1, interval '1 day') d where extract(dow from d) = 6 loop
    for g in select id from public.gerencias where es_demo loop
      select coalesce(sum(case when caja_destino = 'gerencia:' || g.id then monto else 0 end), 0)
           - coalesce(sum(case when caja_origen = 'gerencia:' || g.id then monto else 0 end), 0)
      into neto
      from public.movimientos_tesoreria
      where es_demo and fecha between s - 6 and s and categoria in ('Cierre 18:00', 'Redistribución');
      if neto > 0 then
        insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo)
        values (s, 'deposito', 'gerencia:' || g.id, 'banco:1', 'Depósito semanal', 'Excedente de la semana', round(neto, 2), true);
      elsif neto < 0 then
        insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo)
        values (s, 'retiro', 'banco:1', 'gerencia:' || g.id, 'Reposición semanal', 'Reposición para colocar', round(-neto, 2), true);
      end if;
    end loop;
  end loop;

  -- Nómina semanal de asesores, quincenal de gerentes y renta mensual de oficinas
  insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo)
  select d::date, 'egreso', 'banco:1', 'externo', 'Nómina', 'Nómina semanal de asesores', 1800 * (select count(*) from public.rutas where es_demo), true
  from generate_series(ini, hoy - 1, interval '1 day') d where extract(dow from d) = 6;
  insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo)
  select d::date, 'egreso', 'banco:1', 'externo', 'Nómina', 'Nómina quincenal de gerentes', 9000 * (select count(*) from public.gerencias where es_demo), true
  from generate_series(ini, hoy - 1, interval '1 day') d where extract(day from d) in (1, 16);
  insert into public.movimientos_tesoreria (fecha, tipo, caja_origen, caja_destino, categoria, concepto, monto, es_demo)
  select d::date, 'egreso', 'banco:1', 'externo', 'Renta', 'Renta de oficinas', 7500 * (select count(*) from public.oficinas where es_demo), true
  from generate_series(ini, hoy - 1, interval '1 day') d where extract(day from d) = 1;
end $$;

-- Proyecciones: meta de la mañana y logro de la tarde por oficina (últimos 30 días)
insert into public.proyecciones (fecha, oficina_id, meta_cobro, meta_colocacion, logro_cobro, logro_colocacion, es_demo)
select d::date, o.id,
       round(coalesce(cob.m, 0) * (0.92 + random() * 0.25) / 100) * 100,
       round(coalesce(col.m, 0) * (0.85 + random() * 0.4) / 500) * 500,
       case when d::date < current_date then coalesce(cob.m, 0) end,
       case when d::date < current_date then coalesce(col.m, 0) end, true
from generate_series(current_date - 30, current_date, interval '1 day') d
cross join public.oficinas o
left join lateral (select sum(p.monto) m from public.pagos p join public.creditos c on c.id = p.credito_id join public.clientes cl on cl.id = c.cliente_id
                   join public.rutas r on r.id = cl.ruta_id where p.fecha = d::date and p.tipo = 'cuota' and r.oficina_id = o.id) cob on true
left join lateral (select sum(c.entregado) m from public.creditos c join public.clientes cl on cl.id = c.cliente_id
                   join public.rutas r on r.id = cl.ruta_id where c.fecha_inicio = d::date and r.oficina_id = o.id) col on true
where o.es_demo and extract(dow from d) between 1 and 6;

alter table public.pagos enable trigger pago_antes;
alter table public.pagos enable trigger pago_despues;

-- Los identificadores automáticos siguen después de los de ejemplo
select setval('public.regiones_id_seq', greatest((select max(id) from public.regiones), 1));
select setval('public.zonas_id_seq', greatest((select max(id) from public.zonas), 1));
select setval('public.gerencias_id_seq', greatest((select max(id) from public.gerencias), 1));
select setval('public.oficinas_id_seq', greatest((select max(id) from public.oficinas), 1));
select setval('public.rutas_id_seq', greatest((select max(id) from public.rutas), 1));
select setval('public.clientes_id_seq', greatest((select max(id) from public.clientes), 1));
select setval('public.creditos_id_seq', greatest((select max(id) from public.creditos), 1));
select setval('public.solicitudes_id_seq', greatest((select max(id) from public.solicitudes), 1));

commit;
