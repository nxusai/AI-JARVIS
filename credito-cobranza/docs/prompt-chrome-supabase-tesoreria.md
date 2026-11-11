Trabaja SOLO en Supabase, organización "Credito y Cobranza", proyecto "credito-cobranza". No abras ni toques ningún otro proyecto u organización. No copies, muestres ni escribas contraseñas ni claves secretas (service_role / secret) en ningún lado.

Objetivo: correr 3 archivos SQL, en este orden y uno por uno, en el SQL Editor del proyecto.

1. 01_esquema.sql
2. 03_tesoreria_y_altas.sql
3. 02_datos_demo.sql

Para cada archivo:
a) Abre en otra pestaña: https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/NOMBRE_DEL_ARCHIVO
b) Da clic en "Raw", selecciona todo el texto (Ctrl+A) y cópialo (Ctrl+C). Copia el archivo COMPLETO, sin cambiar nada.
c) En Supabase → SQL Editor → "New query", pega el texto y da clic en "Run".
d) Si aparece un aviso de "destructive operation" o "Run and enable RLS", elige la opción que corre la consulta y habilita RLS ("Run and enable RLS" / "Run this query"). Es esperado: los archivos borran y vuelven a crear SÓLO datos de ejemplo.
e) Espera a que diga "Success". Si sale un error, DETENTE, no intentes arreglarlo y cópiame el mensaje de error exacto y el número de archivo.

Al terminar, en una nueva consulta corre sólo esto (es lectura, no cambia nada) y dame el resultado:

select (select count(*) from public.rutas) rutas,
       (select count(*) from public.creditos) creditos,
       (select count(*) from public.movimientos_tesoreria) movimientos,
       (select count(*) from public.cuentas_bancarias) cuentas;

No modifiques ninguna otra configuración del proyecto (Auth, Storage, API, Billing, etc.).
