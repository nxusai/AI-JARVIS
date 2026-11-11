-- Datos de EJEMPLO para mostrar el avance al cliente (NXUS AI).
-- Todos los nombres, montos y deudas son inventados. Se marcan es_demo = true y
-- se borran con 99_borrar_demo.sql antes de importar la información real.
--
-- Las reglas de interés todavía no están definidas: aquí se usa un 40 % fijo y
-- 10 cuotas sólo para que las cifras se vean realistas.
--
-- Se puede volver a correr: primero borra el ejemplo anterior.

begin;

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

do $$
declare
  nombres text[] := array['María','José','Guadalupe','Juan','Rosa','Luis','Ana','Carlos','Verónica','Miguel',
    'Leticia','Jesús','Martha','Pedro','Elena','Francisco','Alejandra','Antonio','Silvia','Roberto',
    'Claudia','Javier','Norma','Daniel','Teresa','Arturo','Lucía','Sergio','Patricia','Ramón',
    'Gloria','Manuel','Yolanda','Eduardo','Irma','Alfredo','Adriana','Enrique','Beatriz','Rafael'];
  apellidos text[] := array['Hernández','García','Martínez','López','González','Pérez','Rodríguez','Sánchez',
    'Ramírez','Cruz','Flores','Gómez','Morales','Vázquez','Reyes','Jiménez','Torres','Díaz','Gutiérrez','Ruiz',
    'Mendoza','Aguilar','Ortiz','Moreno','Castillo','Romero','Álvarez','Chávez','Rivera','Juárez'];
  colonias text[] := array['Jardines de Morelos','Ciudad Azteca','San Cristóbal','Las Américas','Villa de las Flores',
    'Héroes Tecámac','Ojo de Agua','Los Héroes','Real del Sol','Buenavista','San Pablo','Lomas de Cartagena'];
  hoy date := current_date;
  r int; i int; cid int := 0; kid int := 0; n int;
  monto numeric; total numeric; cuota numeric; frec text; dias_periodo int;
  inicio date; vencidas int; pagadas int; perdidas int; atraso int; f date; k int;
begin
  perform setseed(0.42);
  for r in 1..12 loop
    n := 14 + floor(random() * 9)::int;            -- 14 a 22 clientes por ruta
    for i in 1..n loop
      cid := cid + 1;
      insert into public.clientes (id, codigo, nombre, ruta_id, colonia, telefono, creado, es_demo)
      values (cid, 'C-' || lpad(cid::text, 5, '0'),
              nombres[1 + floor(random() * array_length(nombres, 1))::int] || ' ' ||
              apellidos[1 + floor(random() * array_length(apellidos, 1))::int] || ' ' ||
              apellidos[1 + floor(random() * array_length(apellidos, 1))::int],
              r, colonias[1 + floor(random() * array_length(colonias, 1))::int],
              '55 0000 ' || lpad((cid % 10000)::text, 4, '0'), hoy - 200, true);

      -- 1 crédito por cliente (algunos con un segundo crédito ya liquidado)
      for k in 1..(case when random() < 0.12 then 2 else 1 end) loop
        kid := kid + 1;
        monto := (6 + floor(random() * 35)) * 500;      -- $3,000 a $20,000
        total := round(monto * 1.40, 2);                  -- 40 % provisional
        frec := case when random() < 0.70 then 'semanal' when random() < 0.85 then 'quincenal' else 'mensual' end;
        dias_periodo := case frec when 'semanal' then 7 when 'quincenal' then 15 else 30 end;
        cuota := round(total / 10, 2);
        if k = 2 then
          inicio := hoy - (200 + floor(random() * 80))::int;  -- crédito anterior, ya pagado
        else
          inicio := hoy - floor(random() * least(160, dias_periodo * 11))::int;
        end if;
        vencidas := least(10, floor((hoy - inicio) / dias_periodo)::int);
        -- comportamiento: la mayoría al día, algunos con 1 a 6 cuotas sin pagar
        perdidas := case when k = 2 then 0
                         when random() < 0.68 then 0
                         when random() < 0.55 then 1
                         when random() < 0.60 then 2
                         else 3 + floor(random() * 4)::int end;
        pagadas := greatest(0, vencidas - perdidas);
        if k = 2 then pagadas := 10; end if;
        atraso := case when pagadas >= vencidas then 0
                       else greatest(1, (hoy - (inicio + (pagadas + 1) * dias_periodo))) end;

        insert into public.creditos (id, cliente_id, monto, total_pagar, cuota, frecuencia, num_cuotas,
          fecha_inicio, cuotas_pagadas, saldo, dias_atraso, ultimo_pago, es_demo)
        values (kid, cid, monto, total, cuota, frec, 10, inicio, pagadas,
          greatest(0, round(total - pagadas * cuota, 2)), atraso,
          case when pagadas > 0 then least(hoy, inicio + pagadas * dias_periodo) end, true);

        for f in select (inicio + s * dias_periodo)::date from generate_series(1, pagadas) s loop
          insert into public.pagos (credito_id, fecha, monto, es_demo)
          values (kid, least(hoy, f + floor(random() * 2)::int), cuota, true);
        end loop;
      end loop;
    end loop;
  end loop;

  -- Pagos de hoy para que el tablero del día tenga movimiento
  insert into public.pagos (credito_id, fecha, monto, es_demo)
  select c.id, hoy, c.cuota, true
  from public.creditos c
  where c.es_demo and c.saldo > 0 and c.frecuencia = 'semanal'
    and extract(dow from c.fecha_inicio) = extract(dow from hoy) and c.dias_atraso = 0;

  -- Solicitudes en distintos estados (mesa de control)
  insert into public.solicitudes (id, cliente_nombre, ruta_id, monto, estado, creada, es_demo) values
    (1, 'Solicitante A (ejemplo)', 1, 8000, 'borrador', hoy, true),
    (2, 'Solicitante B (ejemplo)', 4, 5000, 'borrador', hoy, true),
    (3, 'Solicitante C (ejemplo)', 7, 12000, 'revision', hoy - 1, true),
    (4, 'Solicitante D (ejemplo)', 2, 6500, 'revision', hoy, true),
    (5, 'Solicitante E (ejemplo)', 10, 9000, 'revision', hoy, true),
    (6, 'Solicitante F (ejemplo)', 5, 4000, 'observada', hoy - 2, true),
    (7, 'Solicitante G (ejemplo)', 9, 15000, 'aprobada', hoy - 1, true),
    (8, 'Solicitante H (ejemplo)', 3, 7000, 'aprobada', hoy, true),
    (9, 'Solicitante I (ejemplo)', 11, 20000, 'rechazada', hoy - 3, true);
end $$;

commit;
