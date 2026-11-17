Trabaja SOLO en Supabase, organización "Credito y Cobranza", proyecto "credito-cobranza". No abras ni toques ningún otro proyecto u organización. No copies, muestres ni escribas contraseñas ni claves secretas en ningún lado. No cambies ninguna otra configuración.

Objetivo: correr UN archivo SQL en el SQL Editor del proyecto: 07_permisos.sql

1. Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/07_permisos.sql
2. Da clic en "Raw" y pon el archivo COMPLETO, sin cambiar nada, en una consulta nueva del SQL Editor ("New query"). Comprueba que el texto del editor sea igual al archivo.
3. Da clic en "Run". Si aparece "destructive operation" o "Run and enable RLS", elige la opción que corre la consulta (es esperado: crea la tabla de permisos y cambia reglas).
4. Espera "Success". Si sale un error, DETENTE, no lo arregles y dame el mensaje exacto.

Al terminar, en una consulta nueva corre sólo esto (es lectura) y dame el resultado:

select count(*) as permisos, count(*) filter (where permitido) as activos from public.permisos;
