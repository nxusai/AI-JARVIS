# Guía: NXUS HQ (app.nxusai.org)

La empresa en un solo lugar: clientes, tareas, equipo, entrada y salida, nómina y dinero. Cada quien entra con su correo y su contraseña.

| Quién | Qué ve |
|---|---|
| **Eduardo (admin)** | Todo: clientes y lo que pagan, nómina, comisiones, personas y bitácora. Es el único que borra. |
| **Equipo** (Luis, Ángeles, las socias de NXUS México) | Los clientes (sin dinero), el equipo, sus tareas y su propio reloj. Nada de dinero ni nómina. |

Las reglas viven en la base de datos: aunque alguien se brinque la página, no puede ver ni cambiar lo que no le toca.

## Lo que tiene
- **Inicio:** a ti te muestra clientes activos, ingreso del mes, la nómina de la quincena, tareas atrasadas, quién está trabajando ahora y tu meta de $20,000. Al equipo, su reloj y sus pendientes.
- **Clientes:** una ficha por cliente con el botón **"Entrar a su sistema"**. **✦ Nuevo cliente con IA:** escribes el cliente con tus palabras y la IA arma la ficha, lo que paga y las primeras tareas; tú revisas y guardas.
- **Prospectos:** todo lo que llega por el portal (empezar.nxusai.org), en un tablero por etapas:
  - Abrió su link → Dejó sus datos → Pagó consultoría → Cita agendada → Reunión hecha → Propuesta enviada → **Cliente** o **Perdido**.
  - El portal mueve solo las primeras cuatro; las demás las mueve quien tenga permiso.
  - Cada prospecto tiene su ficha: contacto, lo que le interesa, su diagnóstico, su cita con Meet, lo que pagó, el **siguiente paso** con fecha (si se pasa, sale en rojo) y **notas** que no se borran.
  - **✓ Convertir en cliente** crea su ficha en Clientes con todo lo que contestó.
  - **🔗 Link para un prospecto:** escribes su nombre y te da el link y un mensaje listo para WhatsApp. El link lleva el código de quien lo manda (`?de=barbara`): el prospecto queda a su nombre.
  - **+ Apuntar a mano:** para alguien que conociste por otro lado.
- **Tareas:** tablero Pendiente / En curso / Hecha. Cada quien mueve el estado de lo suyo.
- **Equipo:** tarjeta de cada persona con su foto, su cargo y si es NXUS USA o NXUS MÉXICO.
- **Mi reloj:** marcar entrada y salida. La hora la pone el sistema y nadie la cambia a mano.
- **Nómina (solo tú):** por quincena (1–15 y 16–fin):
  - **Sueldo fijo** (Luis).
  - **Medio tiempo** (Ángeles): su base más cada **día completo**. Cuenta como día completo el que tú marques o cualquier día con 7 horas o más registradas.
  - **Comisión** (socias de México): el % de lo cobrado en los contratos que consigan.
  - **Ajustes:** bonos o descuentos.
- **Dinero (solo tú):** lo que paga cada cliente, ingreso del mes menos la nómina, y el avance a tu meta.
- **Personas (solo tú):** dar de alta, cargo, sede, foto, apagar el acceso y cambiar contraseñas. En **Editar**, la parte **Prospectos**:

  | Permiso | Qué deja hacer |
  |---|---|
  | Qué prospectos ve | Nada · Solo los suyos (de su link o que tú le asignes) · Todos |
  | Trabajarlos | Notas, siguiente paso, datos de contacto y apuntar prospectos nuevos |
  | Mover etapas | Reunión hecha, propuesta enviada, perdido… |
  | Convertirlos en clientes | El botón **✓ Convertir en cliente** |
  | Ver lo que pagaron | Los pagos de consultoría |
  | Código de su link | Lo que va en `?de=` (por ejemplo `barbara`) |

  Asignar y borrar prospectos es solo tuyo.
- **Comisiones solas:** si un prospecto llegó por el link de alguien que cobra comisión y paga su consultoría, su comisión aparece sola en Nómina. Cuando se vuelve cliente, en Nómina sale en "Clientes que trajo" con el botón **Registrar cobro**.
- **Dinero:** el ingreso del mes suma las mensualidades y las consultorías cobradas por el portal.
- **Bitácora (solo tú):** quién hizo qué y cuándo.

## Instalarlo (una sola vez)

### 1. Base de datos (Supabase)
Un proyecto **nuevo y aparte** del Centro de trabajo, para que nada de NXUS se mezcle con lo de un cliente.
1. Entra a https://supabase.com/dashboard → **New project**.
   - Nombre: `nxus-hq`.
   - Guarda la contraseña de la base en **Contraseñas** de tu Mac.
   - Región: **East US**.
2. Cuando termine: **SQL Editor** → **New query**. Pega todo `hq/supabase/esquema.sql` (en tu Mac: `pbcopy < ~/Desktop/nexy/hq/supabase/esquema.sql`) → **Run**. Debe decir **Success**.
3. **Authentication** → **Users** → **Add user** → **Create new user**:
   - Tu correo y una contraseña.
   - **Auto Confirm User** encendido.

   El primer usuario queda como **admin**: ese eres tú.
4. **Authentication** → **URL Configuration** → **Site URL**: `https://app.nxusai.org` → **Save**.
5. **Project Settings** → **API**: ahí están el **Project URL**, la llave **anon** y la llave **service_role**. No las pegues en ningún chat.

### 2. La página (Netlify)
1. https://app.netlify.com → **Add new project** → **Import an existing project** → **GitHub** → `nxusai/AI-JARVIS`.
2. Configúralo así:
   - **Project name:** `nxus-hq`
   - **Branch:** `claude/jarvis-project-setup-gs6uu2`
   - **Base directory:** `hq`
3. En **Environment variables**, agrega:
   - `SUPABASE_URL`: el Project URL.
   - `SUPABASE_ANON_KEY`: la llave anon.
   - `SUPABASE_SERVICE_KEY`: la llave service_role. Solo la usa el servidor para dar de alta personas.
   - `ANTHROPIC_API_KEY`: para "Nuevo cliente con IA".
4. **Deploy**.

### 3. La dirección app.nxusai.org
1. En el proyecto de Netlify: **Domain management** → **Add a domain** → `app.nxusai.org`.
2. Si te lo pide, en **Squarespace** → **Dominios** → **DNS** agrega un registro **CNAME**:
   - Host: `app`
   - Apunta a: `nxus-hq.netlify.app`

### 4. Empezar
1. Entra a https://app.nxusai.org con tu correo.
2. **Personas** → **+ Dar de alta**: Luis, Ángeles y las socias, cada quien con su correo y una contraseña que tú les das. Luego **Editar** para subir su foto.
3. **Nómina** → **Su pago** en cada persona.
4. **Dinero** → **Cambiar** en cada cliente: lo que paga.

### 5. Conectar el portal (Prospectos)
Es una sola clave que comparten los dos sitios de Netlify, para que solo el portal pueda mandar prospectos a HQ.
1. Inventa una clave larga (40 letras y números o más; en tu Mac: `openssl rand -hex 24`). Guárdala en **Contraseñas** de tu Mac.
2. En Netlify, proyecto **nxus-hq** → **Project configuration** → **Environment variables** → `PORTAL_CLAVE` = esa clave (marca **Contains secret values**).
3. En Netlify, el proyecto del portal → **Environment variables**:
   - `PORTAL_CLAVE` = la misma clave (secreta).
   - `HQ_URL` = `https://app.nxusai.org`
4. **Trigger deploy** en los dos proyectos.

## La muestra
Para verla sin instalar nada: `node scripts/hq-muestra.mjs` arma `hq-muestra.html`. Ábrelo y entra como cualquier persona.
