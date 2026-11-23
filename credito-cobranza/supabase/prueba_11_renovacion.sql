-- PRUEBA (no guarda nada): comprueba que una renovación toma sola la foto, la INE
-- y el comprobante del crédito anterior. Todo se deshace al final: el resultado sale
-- como un mensaje que empieza con «RESULTADO». Ese mensaje es esperado, no es un error real.
do $$
declare
  v_cred integer; v_cli integer; v_ruta smallint; v_user uuid; v_sol integer; r text; o text;
begin
  select c.id, c.cliente_id, k.ruta_id into v_cred, v_cli, v_ruta
    from public.creditos c join public.clientes k on k.id = c.cliente_id
   where c.saldo > 0 order by c.id limit 1;
  select id into v_user from auth.users order by created_at limit 1;

  insert into public.documentos (tipo, entidad_id, categoria, nombre, path, mime, subido_por, creado) values
    ('cliente', v_cli, 'Foto del cliente',         'prueba.jpg', 'cliente/' || v_cli || '/prueba-foto.jpg',  'image/jpeg', v_user, now()),
    ('cliente', v_cli, 'INE (frente)',             'prueba.jpg', 'cliente/' || v_cli || '/prueba-ine-f.jpg', 'image/jpeg', v_user, now()),
    ('cliente', v_cli, 'INE (reverso)',            'prueba.jpg', 'cliente/' || v_cli || '/prueba-ine-r.jpg', 'image/jpeg', v_user, now()),
    ('cliente', v_cli, 'Comprobante de domicilio', 'prueba.jpg', 'cliente/' || v_cli || '/prueba-comp.jpg',  'image/jpeg', v_user, now() - interval '120 days'),
    ('cliente', v_cli, 'Negocio (frente)',         'prueba.jpg', 'cliente/' || v_cli || '/prueba-neg.jpg',   'image/jpeg', v_user, now());

  insert into public.solicitudes (cliente_nombre, ruta_id, monto, estado, tipo, frecuencia, credito_anterior_id, cliente_id)
  values ('PRUEBA renovación (se deshace)', v_ruta, 5000, 'borrador', 'renovacion', 'semanal', v_cred, v_cli)
  returning id into v_sol;

  select string_agg(categoria, ', ' order by categoria) into r
    from public.documentos where tipo = 'solicitud' and entidad_id = v_sol and origen_id is not null;
  select string_agg(categoria, ', ' order by categoria) into o
    from public.documentos d where d.tipo = 'cliente' and d.entidad_id = v_cli and d.path like '%/prueba-%'
     and not exists (select 1 from public.documentos y where y.tipo = 'solicitud' and y.entidad_id = v_sol and y.categoria = d.categoria);

  raise exception 'RESULTADO (se deshizo todo) · tomados: % · no tomados: %', coalesce(r, 'ninguno'), coalesce(o, 'ninguno');
end $$;
