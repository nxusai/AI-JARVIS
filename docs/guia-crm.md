# Guía: el Centro de trabajo Mi Semago · Abuelito (CRM)

El CRM está en `crm/`:
- `public/` es la página;
- `supabase/esquema.sql` es la base de datos con sus candados (quién ve y toca qué);
- `netlify/functions` mandan correos y crean usuarios;
- `google/correo.gs` es el que manda los correos desde la cuenta de Google de la empresa.

Sin conectar nada, la página enseña una **muestra** con datos de ejemplo:

```
node scripts/crm-muestra.mjs ~/Desktop/crm-muestra.html
```

## Qué cuesta

**Nada, por ahora.** Todo va en planes gratis:

| Pieza | Plan gratis | Límite |
|---|---|---|
| Supabase (datos, archivos y accesos) | Free | 1 GB de archivos, 50 MB por archivo. Si nadie entra en 7 días se "duerme" y se despierta desde el panel. |
| Netlify (la página) | Free | De sobra |
| Google (correos) | Gratis | 100 correos al día con Gmail; 1,500 con Google Workspace |

Cuando se llene o lo quieran sin pausas, Supabase Pro cuesta $25 USD al mes (100 GB). Es un clic, sin mover nada.

## 1. Supabase (10 min)

1. Entra a https://supabase.com y clic en **Start your project**. Crea la cuenta con tu correo.
2. Clic en **New project**:
   - Name: `centro-de-trabajo`
   - Database Password: clic en **Generate a password**. Guárdala en Passwords como "Supabase centro de trabajo".
   - Region: **East US (North Virginia)**, la más cerca de New Jersey.
   - Clic en **Create new project** y espera 1 a 2 minutos.
3. **La base de datos y los candados:**
   - En tu Mac copia el archivo: `pbcopy < ~/Desktop/nexy/crm/supabase/esquema.sql`
   - En Supabase, menú izquierdo → **SQL Editor** → **New query**. Pega con Cmd + V y clic en **Run**.
   - Debe decir **Success. No rows returned**.
4. **Tu usuario de admin.** El primero que se crea es el admin.
   - Menú izquierdo → **Authentication** → **Users** → **Add user** → **Create new user**.
   - Pon tu correo y una contraseña, marca **Auto Confirm User** y clic en **Create user**.
5. **Que nadie se registre solo:**
   - **Authentication** → **Sign In / Providers**;
   - apaga **Allow new users to sign up** y clic en **Save**.
6. **Las llaves**, en **Project Settings** (engrane abajo a la izquierda):
   - **Data API** (o el botón **Connect** arriba) → **Project URL**. Va como `SUPABASE_URL`.
   - **API Keys** → **Publishable key**. Va como `SUPABASE_ANON_KEY`.
   - **API Keys** → **Secret key**: clic en **Reveal**. Va como `SUPABASE_SERVICE_KEY`. **Es secreta:** solo va en Netlify.

   Si tu proyecto muestra **Legacy API keys**, también sirven: `anon` va como `SUPABASE_ANON_KEY` y `service_role` como `SUPABASE_SERVICE_KEY`.

## 2. Correo (Google de la empresa, 5 min)

Usa la cuenta de Google **de la empresa**, la del Drive "Etiquetas Mi Semago". Nunca la tuya de NXUS: los correos tienen que salir a nombre de ellos.

1. En incógnito entra a https://script.google.com con esa cuenta → **New project**.
2. Copia el código: `pbcopy < ~/Desktop/nexy/crm/google/correo.gs`
   - en el editor: Cmd + A, borrar, Cmd + V;
   - nombre del proyecto: `Correo Centro de trabajo`;
   - guarda con Cmd + S.
3. Elige **preparar** → **▷ Run** y acepta los permisos:
   - **Review permissions**;
   - **Advanced**;
   - **Go to … (unsafe)**;
   - **Allow**.
4. En el **Execution log** sale la **clave**. Va como `CORREO_CLAVE`.
5. **Deploy** → **New deployment** → engrane → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Clic en **Deploy**. La URL que termina en `/exec` va como `CORREO_URL`.

## 3. Netlify (10 min)

1. https://app.netlify.com → **Add new site** → **Import an existing project** → **GitHub** → `nxusai/AI-JARVIS`.
2. Configura:
   - Branch to deploy: `claude/jarvis-project-setup-gs6uu2`
   - Base directory: `crm`
3. **Environment variables**:

   | Nombre | Valor |
   |---|---|
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_ANON_KEY` | Publishable key (o anon) |
   | `SUPABASE_SERVICE_KEY` | Secret key (o service_role) |
   | `CORREO_URL` | la URL `/exec` del paso 2 |
   | `CORREO_CLAVE` | la clave del paso 2 |

4. Clic en **Deploy**.
5. Ponle nombre de marca: **Site configuration** → **Change site name**, por ejemplo `centro-misemago-abuelito`. Queda en `https://centro-misemago-abuelito.netlify.app`. Nada que diga NXUS.

## 4. Primer uso

1. Entra a la dirección con tu correo y contraseña del paso 1.4.
2. **Usuarios** → **+ Nuevo usuario**, para cada persona:
   - Diseñador 1 y Diseñador 2 → rol **Equipo**.
   - Senen → **Cliente**, todas las empresas, las tres secciones.
   - Gerardo → **Cliente**, todas las empresas, las tres secciones.

   La contraseña sale sola; mándasela a cada uno por WhatsApp.
3. **Biblioteca** → en cada empresa, clic en **Crear carpetas** (Labels, Logotipos, Diseños, Estructuras de label, Documentos). Tu equipo sube arrastrando los archivos.
4. **Catálogos** → **Subir catálogo** en cada empresa.

## Quién ve y toca qué (lo cuida la base de datos)

| | Cliente (Senen, Gerardo) | Equipo | Admin (tú) |
|---|---|---|---|
| Pedir tarea / corrección | ✅ las suyas | registra a nombre de un cliente | igual que el equipo |
| Ver tareas | solo las suyas | todas | todas |
| Cambiar lo que escribió el cliente | ❌ | ❌ | ❌ |
| Estatus y fecha compromiso | 👁️ | ✅ | ✅ |
| Subir PDFs (la fecha se pone sola) | ❌ | ✅ | ✅ |
| Aprobado | ✅ solo quien la pidió | ❌ | ❌ |
| Biblioteca y catálogos | ver, descargar, a su correo | subir, carpetas, versiones | igual que el equipo |
| Borrar | ❌ | carpetas vacías | ✅ |
| Usuarios, empresas, bitácora | ❌ | ❌ | ✅ |

Nada se reemplaza. Cada PDF nuevo (entrega, corrección o versión) se guarda junto a los anteriores.
