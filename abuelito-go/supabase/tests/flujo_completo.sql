-- Prueba de punta a punta: despachador arma la ruta, el chofer entrega y cobra, el despachador cierra.
-- Corre después de simulacion_supabase.sql, la migración y seed.sql (ver scripts/probar-db.sh).
\set ON_ERROR_STOP on
insert into auth.users values
 ('10000000-0000-0000-0000-000000000001','admin@x'),('10000000-0000-0000-0000-000000000002','desp@x'),
 ('10000000-0000-0000-0000-000000000003','chofer1@x'),('10000000-0000-0000-0000-000000000004','chofer2@x');
insert into perfiles (id, empresa_id, nombre, rol) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Admin','admin'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Desp','despachador'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Chofer 1','chofer'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Chofer 2','chofer');

-- Despachador arma la ruta
set role authenticated;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
insert into ordenes (id, empresa_id, cliente_id, fecha_entrega)
select ('20000000-0000-0000-0000-00000000000' || row_number() over (order by codigo))::uuid, empresa_id, id, current_date
from clientes where codigo in ('C001','C002','C003');
insert into orden_lineas (empresa_id, orden_id, producto_id, cantidad, precio_unitario)
select o.empresa_id, o.id, p.id, 10, p.precio from ordenes o, productos p where p.sku in ('QSO-001','CRM-001');
insert into rutas (id, empresa_id, fecha, nombre, chofer_id, camioneta_id)
select '30000000-0000-0000-0000-000000000001', empresa_id, current_date, 'Ruta Norte', '10000000-0000-0000-0000-000000000003', id
from camionetas where nombre = 'Camioneta 1';
insert into paradas (id, empresa_id, ruta_id, orden_id, secuencia)
select ('40000000-0000-0000-0000-00000000000' || row_number() over (order by o.id))::uuid, o.empresa_id, '30000000-0000-0000-0000-000000000001', o.id, row_number() over (order by o.id)
from ordenes o;
select 'ordenes en_ruta', count(*) from ordenes where estado = 'en_ruta';

-- Chofer 1 no ve la ruta mientras sea borrador
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select 'chofer ve rutas en borrador (esperado 0)', count(*) from rutas;
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
update rutas set estado = 'publicada';

set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000003';
select 'chofer1 rutas (1)', count(*) from rutas;
select 'chofer1 paradas (3)', count(*) from paradas;
select 'chofer1 clientes (3 de 5)', count(*) from clientes;
select 'chofer1 perfiles (solo el suyo: 1)', count(*) from perfiles;
select iniciar_ruta('30000000-0000-0000-0000-000000000001', 2.5);

-- Parada 1: entregada completa, paga 1000 efectivo de 1550
select registrar_entrega('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','entregada',
  '[]', '[{"metodo":"efectivo","monto":1000}]', 3.0);
-- Reintento idéntico (sin señal): no debe duplicar
select registrar_entrega('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','entregada',
  '[]', '[{"metodo":"efectivo","monto":1000}]', 3.0);
-- Parada 2: parcial, 5 quesos y 0 cremas, transferencia 475
select registrar_entrega('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','parcial',
  (select jsonb_agg(jsonb_build_object('linea_id', l.id, 'cantidad_entregada', case when p.sku = 'QSO-001' then 5 else 0 end))
   from orden_lineas l join productos p on p.id = l.producto_id where l.orden_id = (select orden_id from paradas where id = '40000000-0000-0000-0000-000000000002')),
  '[{"metodo":"transferencia","monto":475,"referencia":"SPEI 123"}]');
-- Parada 3: no entregada
select registrar_entrega('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003','no_entregada',
  '[]', '[]', null, 'Cliente cerrado');
select terminar_ruta('30000000-0000-0000-0000-000000000001', 4.0);

-- Chofer 2 no ve nada de la ruta
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000004';
select 'chofer2 rutas (0)', count(*) from rutas;
select 'chofer2 clientes (0)', count(*) from clientes;

-- Cierre
set request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
select paradas_total, paradas_completadas, paradas_fallidas, efectivo_esperado, transferencias from resumen_rutas;
select cerrar_ruta('30000000-0000-0000-0000-000000000001', 1000, 'Cuadra');
select estado, efectivo_recibido from rutas;
select c.codigo, c.condicion_pago, c.saldo, o.estado from clientes c join ordenes o on o.cliente_id = c.id order by c.codigo;
select momento, valor_c from lecturas_temperatura order by creado_en;
select count(*) as pagos from pagos;
