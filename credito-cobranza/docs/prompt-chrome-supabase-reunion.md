Trabaja SOLO en Supabase, organización "Credito y Cobranza", proyecto "credito-cobranza". No abras ni toques ningún otro proyecto u organización. No copies, muestres ni escribas contraseñas ni claves secretas en ningún lado. No cambies ninguna otra configuración (Auth, Storage, API, Billing, etc.).

Objetivo: correr 2 archivos SQL, en este orden y uno por uno, en el SQL Editor del proyecto:
1. 05_reunion_16nov.sql
2. 02_datos_demo.sql

Para cada archivo:
a) Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/NOMBRE_DEL_ARCHIVO
b) Da clic en "Raw" y pon el archivo COMPLETO, sin cambiar nada, en una consulta nueva del SQL Editor ("New query"). Antes de correrlo, comprueba que el texto del editor sea igual al archivo.
c) Da clic en "Run". Si aparece "destructive operation" o "Run and enable RLS", elige la opción que corre la consulta (es esperado: el 05 agrega tablas y reglas; el 02 borra y vuelve a crear SÓLO los datos de ejemplo).
d) Espera "Success". Si sale un error, DETENTE, no lo arregles y dame el mensaje exacto y el número de archivo.

Al terminar, en una consulta nueva corre sólo esto (es lectura, no cambia nada) y dame el resultado:

select (select count(*) from public.creditos) creditos,
       (select count(*) from public.creditos where tipo = 'renovacion') renovaciones,
       (select count(*) from public.creditos where tipo = 'recompra') recompras,
       (select count(*) from public.movimientos_tesoreria where categoria = 'Seguro') seguros,
       (select count(*) from public.proyecciones) proyecciones,
       (select count(*) from public.personal) personal,
       (select count(*) from public.parametros) parametros;
