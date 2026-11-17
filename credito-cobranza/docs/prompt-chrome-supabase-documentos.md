Trabaja SOLO en Supabase, organización "Credito y Cobranza", proyecto "credito-cobranza". No abras ni toques ningún otro proyecto u organización. No copies, muestres ni escribas contraseñas ni claves secretas en ningún lado. No cambies ninguna otra configuración (Auth, API, Billing, etc.) y no subas ni borres archivos.

Objetivo: correr UN archivo SQL en el SQL Editor del proyecto: 06_documentos.sql

1. Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/06_documentos.sql
2. Da clic en "Raw" y pon el archivo COMPLETO, sin cambiar nada, en una consulta nueva del SQL Editor ("New query"). Antes de correrlo, comprueba que el texto del editor sea igual al archivo.
3. Da clic en "Run". Si aparece "destructive operation" o "Run and enable RLS", elige la opción que corre la consulta (es esperado: crea un espacio privado de archivos y sus reglas).
4. Espera "Success". Si sale un error, DETENTE, no lo arregles y dame el mensaje exacto.

Al terminar:
a) Ve a Storage (menú de la izquierda) y dime si aparece un bucket llamado "expedientes" y si dice que es privado (no "Public"). NO lo hagas público ni cambies nada.
b) En una consulta nueva corre sólo esto (es lectura) y dame el resultado:

select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'expedientes';
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'expedientes%';
