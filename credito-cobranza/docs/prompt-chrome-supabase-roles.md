Trabaja SOLO en Supabase, organización "Credito y Cobranza", proyecto "credito-cobranza". No abras ni toques ningún otro proyecto u organización. No copies, muestres ni escribas contraseñas ni claves secretas en ningún lado. No cambies ninguna otra configuración.

Objetivo: correr UN archivo SQL en el SQL Editor del proyecto: 10_roles_y_captura.sql

1. Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/10_roles_y_captura.sql
2. Da clic en "Raw" y pon el archivo COMPLETO, sin cambiar nada, en una consulta nueva del SQL Editor ("New query"). Comprueba que el texto del editor sea igual al archivo (empieza con "-- Sistema de crédito y cobranza · cada quien con sus funciones" y termina con "and actualizado_por is null;").
3. Da clic en "Run". Si aparece "destructive operation", "UPDATE sin WHERE" o "Run and enable RLS", elige la opción que corre la consulta (es esperado: cambia funciones, una vista y reglas).
4. Espera "Success". Si sale un error, DETENTE, no lo arregles y dame el mensaje exacto.

Al terminar, en una consulta nueva corre sólo esto (es lectura) y dame el resultado completo:

select
  (select count(*) from pg_proc where proname in ('historial_solicitud')) as funcion_historial,
  (select count(*) from information_schema.tables where table_name = 'permisos_usuario') as tabla_permisos_persona,
  (select string_agg(permiso, ', ' order by permiso) from public.permisos where rol = 'mesa' and permitido) as mesa_puede,
  (select permitido from public.permisos where rol = 'asesor' and permiso = 'ver_solicitudes') as asesor_ve_bandejas_mesa,
  (select interes_pct || '% · ' || num_cuotas || ' pagos · activo=' || activo from public.condiciones where gerencia_id is null and frecuencia = 'diario') as modalidad_diaria,
  (select count(*) from information_schema.columns where table_name = 'solicitudes' and column_name in ('sexo','correo','telefono2','referencias')) as columnas_nuevas;
