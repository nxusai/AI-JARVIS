Trabaja SOLO en Supabase, organización "Credito y Cobranza", proyecto "credito-cobranza". No abras ni toques ningún otro proyecto u organización. No copies, muestres ni escribas contraseñas ni claves secretas en ningún lado. No cambies ninguna otra configuración.

Objetivo: correr UN archivo SQL en el SQL Editor del proyecto: 09_ubicacion_en_ruta.sql

1. Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/09_ubicacion_en_ruta.sql
2. Da clic en "Raw" y pon el archivo COMPLETO, sin cambiar nada, en una consulta nueva del SQL Editor ("New query"). Comprueba que el texto del editor sea igual al archivo (empieza con "-- Sistema de crédito y cobranza · guardar la ubicación" y termina con "to authenticated;").
3. Da clic en "Run". Si aparece "destructive operation" o "Run and enable RLS", elige la opción que corre la consulta (es esperado: crea una función).
4. Espera "Success". Si sale un error, DETENTE, no lo arregles y dame el mensaje exacto.

Al terminar, en una consulta nueva corre sólo esto (es lectura) y dame el resultado completo:

select count(*) as funcion_ubicacion from pg_proc where proname = 'guardar_ubicacion';
