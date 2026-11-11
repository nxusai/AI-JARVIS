# Prompt para Claude in Chrome · crear la base de datos del sistema de crédito y cobranza

Abre https://supabase.com/dashboard en Chrome (con tu cuenta de Supabase iniciada) y también
https://github.com (con tu cuenta de GitHub iniciada). Abre el panel de Claude y pega esto:

---

Vas a crear la base de datos de un sistema de crédito y cobranza en mi cuenta de Supabase, en mi
propio Chrome. Yo estoy mirando. Avísame en español al terminar cada paso.

REGLAS
- No escribas, copies ni muestres contraseñas. Cuando un paso pida una contraseña, detente y dime
  que la escriba yo.
- No borres ni modifiques ningún otro proyecto de Supabase que ya exista. Sólo trabajas en el
  proyecto nuevo "credito-cobranza".
- Si algo no coincide con lo que describo (botones con otro nombre, un límite del plan, un error),
  detente y pregúntame antes de seguir.

PASO 1 · Crear el proyecto
1. En Supabase: New project.
2. Organization: la mía (si hay varias, pregúntame cuál).
3. Project name: credito-cobranza
4. Database password: usa "Generate a password". NO la copies ni la muestres; dime que la guarde
   yo en mi gestor de contraseñas antes de continuar, y espera mi "listo".
5. Region: East US (North Virginia).
6. Create new project. Espera a que termine de prepararse (puede tardar 1–2 minutos).
   Si Supabase dice que llegué al límite de proyectos gratuitos, detente y avísame.

PASO 2 · Esquema y candados
1. En otra pestaña abre:
   https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/01_esquema.sql
2. Usa el botón "Copy raw file" (ícono de copiar arriba a la derecha del archivo).
3. En el proyecto credito-cobranza de Supabase: SQL Editor → New query → pega todo → Run.
4. Supabase puede avisar que la consulta tiene "destructive operations" (por los drop/delete que
   permiten volver a correr el archivo). En este proyecto nuevo está bien: elige "Run this query".
5. Debe terminar con "Success. No rows returned". Si sale un error, cópiame el mensaje exacto y detente.

PASO 3 · Acceso
1. Authentication → Sign In / Providers (o "Providers"): deja Email activado.
   Desactiva "Allow new users to sign up" (nadie se puede registrar solo) y guarda.
2. Authentication → URL Configuration:
   - Site URL: https://credito-cobranza-demo.netlify.app
   - Redirect URLs → Add URL: https://credito-cobranza-demo.netlify.app/**
   Guarda.
3. Authentication → Users → Add user → Create new user.
   - Email: pregúntame cuál usar y escríbelo tú cuando te lo diga.
   - Password: detente y dime que la escriba yo (mínimo 10 caracteres).
   - Marca "Auto Confirm User".
   - Create user.
   Este primer usuario queda automáticamente como dueño activo del sistema.
4. SQL Editor → New query → pregúntame mi nombre como quiero que aparezca en el sistema y corre:
   update public.perfiles set nombre = 'MI NOMBRE' where rol = 'dueno';
   (cambia MI NOMBRE por lo que te diga). Debe decir "Success. 1 row affected".

PASO 4 · Datos de ejemplo
1. Abre en GitHub:
   https://github.com/nxusai/AI-JARVIS/blob/claude/sleepy-feynman-w5hcqi/credito-cobranza/supabase/02_datos_demo.sql
2. "Copy raw file", pégalo en SQL Editor → New query → Run (si avisa de "destructive operations",
   elige "Run this query"). Debe decir "Success".
3. Comprueba con una consulta nueva:
   select count(*) from public.clientes;
   Debe dar un número cercano a 200. Dímelo.

PASO 5 · Datos para conectar el portal
1. Project Settings → API (o "Data API" / "API Keys").
2. Dime en el chat:
   - Project URL (algo como https://xxxxx.supabase.co)
   - La llave pública "anon" (o "publishable"). Es pública por diseño.
3. NO me muestres la llave "service_role" ni "secret" ni la contraseña de la base de datos.

Al terminar, dame un resumen: proyecto creado, SQL ejecutados, usuario creado, registros de
clientes, Project URL y la llave anon/publishable.

---

Después: copia la **Project URL** y la **llave anon/publishable** y pásaselas a Claude Code en
el chat del proyecto. Con eso conecta el portal de Netlify y te avisa cuando puedas entrar.
