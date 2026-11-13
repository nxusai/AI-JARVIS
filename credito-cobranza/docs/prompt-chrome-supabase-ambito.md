Trabaja SOLO en Supabase, organización "Credito y Cobranza", proyecto "credito-cobranza". No abras ni toques ningún otro proyecto u organización. No copies, muestres ni escribas contraseñas ni claves secretas en ningún lado. No cambies ninguna otra configuración (Auth, Storage, API, Billing, etc.).

Objetivo: correr UN archivo SQL en el SQL Editor del proyecto: 04_ambito.sql

1. Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/04_ambito.sql
2. Da clic en "Raw" y pon el archivo COMPLETO, sin cambiar nada, en una consulta nueva del SQL Editor ("New query"). Antes de correrlo, comprueba que el texto del editor sea igual al archivo.
3. Da clic en "Run". Si aparece "destructive operation" o "Run and enable RLS", elige la opción que corre la consulta (es esperado: sólo reemplaza reglas de lectura).
4. Espera "Success". Si sale un error, DETENTE, no lo arregles y dame el mensaje exacto.

Al terminar, en una consulta nueva corre sólo esto (es lectura, no cambia nada) y dame el resultado:

select tablename, string_agg(policyname, ', ' order by policyname) as reglas
from pg_policies
where schemaname = 'public' and cmd = 'SELECT'
group by tablename order by tablename;

Debe salir "leer_ambito" en todas las tablas (y "ver_mi_perfil" en perfiles), y NINGUNA debe decir "leer_activos".
