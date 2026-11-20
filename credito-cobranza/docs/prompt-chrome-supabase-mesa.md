Trabaja SOLO en Supabase, organización "Credito y Cobranza", proyecto "credito-cobranza". No abras ni toques ningún otro proyecto u organización. No copies, muestres ni escribas contraseñas ni claves secretas en ningún lado. No cambies ninguna otra configuración.

Objetivo: correr UN archivo SQL en el SQL Editor del proyecto: 08_mesa_y_campo.sql

1. Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/08_mesa_y_campo.sql
2. Da clic en "Raw" y pon el archivo COMPLETO, sin cambiar nada, en una consulta nueva del SQL Editor ("New query"). Comprueba que el texto del editor sea igual al archivo (empieza con "-- Sistema de crédito y cobranza · mesa de control" y termina con "end $$;").
3. Da clic en "Run". Si aparece "destructive operation" o "Run and enable RLS", elige la opción que corre la consulta (es esperado: cambia la vista de cartera, una función y reglas).
4. Espera "Success". Si sale un error, DETENTE, no lo arregles y dame el mensaje exacto.

Al terminar, en una consulta nueva corre sólo esto (es lectura) y dame el resultado completo:

select
  (select count(*) from public.condiciones) as modalidades,
  (select count(*) from public.permisos where permiso in ('desembolsar','autorizar_excepciones','ordenar_ruta','reasignar_cartera')) as permisos_nuevos,
  (select count(*) from public.movimientos_tesoreria where categoria = 'Seguro') as quedan_seguro,
  (select count(*) from public.movimientos_tesoreria where categoria = 'Gastos administrativos') as gastos_adm,
  (select string_agg(estado || ':' || n, ', ') from (select estado, count(*) n from public.solicitudes group by 1) x) as solicitudes,
  (select file_size_limit from storage.buckets where id = 'expedientes') as limite_archivos;
