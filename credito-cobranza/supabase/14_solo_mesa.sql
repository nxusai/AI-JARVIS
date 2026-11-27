-- Sistema de crédito y cobranza · sólo mesa de control autoriza o rechaza créditos (NXUS AI)
--
-- Se corre DESPUÉS de 13_peticiones_dueno.sql. Se puede volver a correr sin perder nada.
-- Petición del dueño: «nadie puede autorizar ni rechazar créditos más que mesa de control».
--  · Las renovaciones de más del 20 % ya no pasan al gerente zonal: las decide mesa de control.
--  · Dirección, regional y zonal dejan de tener por omisión los permisos de autorizar.
--  (El dueño puede volver a darlos a quien quiera en Administración → Permisos.)

update public.permisos set permitido = (rol = 'mesa'), actualizado = now()
 where permiso = 'autorizar_excepciones' and actualizado_por is null;
insert into public.permisos (rol, permiso, permitido) values ('mesa', 'autorizar_excepciones', true) on conflict do nothing;
update public.permisos set permitido = (rol = 'mesa'), actualizado = now()
 where permiso = 'resolver_solicitudes' and actualizado_por is null;

-- Mesa de control decide también las renovaciones de más del 20 % (mesa revisa todas las rutas)
do $$
declare d text;
begin
  select pg_get_functiondef('public.resolver_solicitud(integer, text, text, numeric)'::regprocedure) into d;
  if position('or public.tiene_permiso(''resolver_solicitudes''))' in d) = 0 then
    d := replace(d, $q$v_zonal := public.tiene_permiso('autorizar_excepciones') and s.ruta_id in (select public.mis_rutas());$q$,
                    $q$v_zonal := public.tiene_permiso('autorizar_excepciones') and (s.ruta_id in (select public.mis_rutas()) or public.tiene_permiso('resolver_solicitudes'));$q$);
    if position('or public.tiene_permiso(''resolver_solicitudes''))' in d) = 0 then raise exception 'No se encontró la regla de excepción para ajustarla.'; end if;
    execute d;
  end if;
end $$;

update public.parametros set descripcion = 'Renovación con excepción: aumento sobre el crédito anterior que se marca como excepción para mesa de control (%)'
 where clave = 'excepcion_pct';

-- Verificación: debe dar mesa_autoriza 2 · otros_autorizan 0 · mesa_decide_excepciones 1
select (select count(*) from public.permisos where rol = 'mesa' and permiso in ('resolver_solicitudes', 'autorizar_excepciones') and permitido) as mesa_autoriza,
       (select count(*) from public.permisos where rol <> 'mesa' and permiso in ('resolver_solicitudes', 'autorizar_excepciones') and permitido and actualizado_por is null) as otros_autorizan,
       (select count(*) from pg_proc where proname = 'resolver_solicitud' and prosrc like '%or public.tiene_permiso(''resolver_solicitudes''))%') as mesa_decide_excepciones;
