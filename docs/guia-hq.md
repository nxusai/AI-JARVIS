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
- **Tareas:** tablero Pendiente / En curso / Hecha. Cada quien mueve el estado de lo suyo.
- **Equipo:** tarjeta de cada persona con su foto, su cargo y si es NXUS USA o NXUS MÉXICO.
- **Mi reloj:** marcar entrada y salida. La hora la pone el sistema y nadie la cambia a mano.
- **Nómina (solo tú):** por quincena (1–15 y 16–fin):
  - **Sueldo fijo** (Luis).
  - **Medio tiempo** (Ángeles): su base más cada **día completo**. Cuenta como día completo el que tú marques o cualquier día con 7 horas o más registradas.
  - **Comisión** (socias de México): el % de lo cobrado en los contratos que consigan.
  - **Ajustes:** bonos o descuentos.
- **Dinero (solo tú):** lo que paga cada cliente, ingreso del mes menos la nómina, y el avance a tu meta.
- **Personas (solo tú):** dar de alta, cargo, sede, foto, apagar el acceso y cambiar contraseñas.
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

## La muestra
Para verla sin instalar nada: `node scripts/hq-muestra.mjs` arma `hq-muestra.html`. Ábrelo y entra como cualquier persona.
