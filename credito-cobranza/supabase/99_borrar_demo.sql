-- Borra TODOS los datos de ejemplo (es_demo = true) antes de importar la
-- información real. No toca usuarios ni datos reales.
begin;
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
commit;
