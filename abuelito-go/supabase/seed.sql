-- Datos de ejemplo para desarrollo local (no usar en producción).
-- Los usuarios se crean aparte con `npm run crear-admin` y desde el panel.

insert into empresas (id, nombre, base_direccion, base_lat, base_lng) values
  ('00000000-0000-0000-0000-000000000001', 'El abuelito INC', 'Bodega (dirección de ejemplo)', 20.6597, -103.3496);

insert into camionetas (empresa_id, nombre, placas, capacidad_kg) values
  ('00000000-0000-0000-0000-000000000001', 'Camioneta 1', 'ABC-123', 1500),
  ('00000000-0000-0000-0000-000000000001', 'Camioneta 2', 'DEF-456', 1500);

insert into productos (empresa_id, sku, nombre, unidad, precio, temp_min, temp_max) values
  ('00000000-0000-0000-0000-000000000001', 'QSO-001', 'Queso fresco 1 kg', 'pza', 95, 0, 4),
  ('00000000-0000-0000-0000-000000000001', 'CRM-001', 'Crema 1 L', 'pza', 60, 0, 4),
  ('00000000-0000-0000-0000-000000000001', 'JAM-001', 'Jamón de pavo 1 kg', 'pza', 140, 0, 4),
  ('00000000-0000-0000-0000-000000000001', 'HEL-001', 'Helado 4 L', 'pza', 180, -25, -18);

insert into clientes (empresa_id, codigo, nombre, contacto, telefono, direccion, lat, lng, horario_desde, horario_hasta, notas, condicion_pago, limite_credito) values
  ('00000000-0000-0000-0000-000000000001', 'C001', 'Abarrotes La Esperanza', 'Don José', '3300000001', 'Calle Ejemplo 101', 20.6720, -103.3380, '08:00', '13:00', 'Entrar por el andén trasero', 'credito', 10000),
  ('00000000-0000-0000-0000-000000000001', 'C002', 'Minisúper El Sol', 'Marta', '3300000002', 'Avenida Ejemplo 202', 20.6450, -103.3600, '07:00', '20:00', null, 'contado', 0),
  ('00000000-0000-0000-0000-000000000001', 'C003', 'Cremería Doña Lupe', 'Lupe', '3300000003', 'Calle Ejemplo 303', 20.6900, -103.3700, '09:00', '14:00', 'Tocar el timbre dos veces', 'credito', 5000),
  ('00000000-0000-0000-0000-000000000001', 'C004', 'Tienda San Miguel', 'Miguel', '3300000004', 'Calle Ejemplo 404', 20.6300, -103.3200, '08:00', '18:00', null, 'contado', 0),
  ('00000000-0000-0000-0000-000000000001', 'C005', 'Restaurante La Fonda', 'Chef Ana', '3300000005', 'Avenida Ejemplo 505', 20.6650, -103.3900, '10:00', '12:00', 'Recibe solo antes de las 12', 'credito', 20000);
