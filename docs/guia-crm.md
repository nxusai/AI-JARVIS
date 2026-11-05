# Guía: el Centro de trabajo Mi Semago · Abuelito (CRM)

El CRM está en `crm/`:
- `public/` es la página;
- `supabase/esquema.sql` es la base de datos con sus candados (quién ve y toca qué);
- `netlify/functions` mandan correos y crean usuarios;
- `google/correo.gs` es el que manda los archivos ("✉️ A mi correo") desde la cuenta de Google de la empresa;
- `google/accesos.gs` es el que manda el acceso a cada usuario nuevo (link, usuario y contraseña) desde tu cuenta de Google de NXUS, si le pusiste correo.

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

## 2b. Correo de accesos (tu Google de NXUS, 5 min)

Este sí va con **tu cuenta de NXUS** (contacto@nxusai.org): los accesos les llegan de ti.

1. Entra a https://script.google.com con contacto@nxusai.org → **New project**.
2. Copia el código: `pbcopy < ~/Desktop/nexy/crm/google/accesos.gs`
   - en el editor: Cmd + A, borrar, Cmd + V;
   - nombre del proyecto: `Accesos Centro de trabajo`;
   - guarda con Cmd + S.
3. Elige **preparar** → **▷ Run** y acepta los permisos (**Review permissions** → **Allow**; si sale **Advanced**, **Go to … (unsafe)** → **Allow**).
4. En el **Execution log** sale la **clave**. Va como `ACCESO_CLAVE`.
5. (Opcional) Elige **probar** → **▷ Run**: te llega a ti un correo de ejemplo.
6. **Deploy** → **New deployment** → engrane → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Clic en **Deploy**. La URL que termina en `/exec` va como `ACCESO_URL`.

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
   | `ACCESO_URL` | la URL `/exec` del paso 2b |
   | `ACCESO_CLAVE` | la clave del paso 2b |

4. Clic en **Deploy**.
5. Ponle nombre de marca: **Site configuration** → **Change site name**, por ejemplo `centro-misemago-abuelito`. Queda en `https://centro-misemago-abuelito.netlify.app`. Nada que diga NXUS.

## 4. Primer uso

1. Entra a la dirección con tu correo y contraseña del paso 1.4.
2. **Usuarios** → **+ Nuevo usuario**, para cada persona:
   - Diseñador 1 y Diseñador 2 → rol **Equipo**.
   - Senen → **Cliente**, todas las empresas, las tres secciones.
   - Gerardo → **Cliente**, todas las empresas, las tres secciones.

   Cada quien entra con su **usuario** (sale solo del nombre: "Senén Ramos" → `senen`; lo puedes cambiar) y la **contraseña que tú quieras**, desde 3 caracteres (por ejemplo `123`). El **correo es opcional**: si lo pones y dejas marcado **Mandarle su acceso a ese correo**, le llega desde tu correo de NXUS el link, su usuario y su contraseña.

   Al crearlo sale una ventana con la página, el usuario y la contraseña, y el botón **📋 Copiar para WhatsApp**. Al entrar, la página le ofrece a la persona cambiar su contraseña por una suya (o **Ahora no**). Mientras no la cambie, en Usuarios sale **Contraseña temporal**.

   Tú (el dueño) sigues entrando con tu correo. Los usuarios creados antes de esto entran con su correo hasta que les pongas un usuario en **Editar** (con una contraseña nueva).

### Permisos
En **Nuevo usuario** y **Editar** está el cuadro **Permisos · a qué tiene acceso**, para clientes y para tu equipo: qué empresas ve, qué secciones (Tareas, Biblioteca, Catálogos, Parrilla), si **puede pedir extras en la Parrilla** y, para clientes, si habla con Ultron. Lo que quitas ahí ya no lo ve (lo cuida la base de datos). En la tabla de Usuarios, la columna **Puede ver** lo resume.

### Parrilla: lo que se espera cada mes
- Arriba: **Parrilla Abuelito** (Cheese, Meat y Corn juntas) o **Parrilla Mi Semago**.
- **Lo que se espera en <mes>**: cada cosa con su punto de color y cuántos van. Clic en una para ver solo esas en el calendario (**Ver todo** para regresar).
- Tu diseñador, al agregar un contenido, elige en **¿Qué es?** qué cosa cumple: en el calendario sale con ese punto y el contador sube solo.
- **⚙️ Lo fijo** (solo tú): cambia cuántos al mes, agrega o quita. Cuenta desde este mes; los meses pasados se quedan como estaban. Si quitas algo, deja de salir desde el mes siguiente.
- **+ Pedir algo extra** (quien tenga el permiso): qué, cuántos, para este mes o el siguiente. Sale con **Pidió: <nombre>** para todos. Solo tú lo puedes borrar (✕).

### Cambios a los usuarios
- **Cambiarle el usuario o corregir su correo:** Usuarios → **Editar** → **Guardar**. Si además escribes una contraseña nueva y tiene correo, se la puedes mandar.
- **Reenviar acceso (si la olvidó o no le llegó):** Usuarios → **✉️ Reenviar acceso**. Lleva una contraseña nueva (la de antes nadie la conoce; puedes poner la que quieras) → **Reenviar acceso**. Si tiene correo se la manda; si no, te enseña sus datos con **📋 Copiar para WhatsApp**.
- **Eliminar (solo tú):** Usuarios → **Eliminar** → confirma. Si nunca pidió ni subió nada, se borra por completo y su usuario queda libre. Si ya tiene tareas o archivos, esos se quedan con su nombre, pero la persona ya no puede entrar nunca y desaparece de la lista. Ni otro admin ni tus clientes ven este botón.
- **Tu contraseña o la de cualquiera, por su cuenta:** botón **🔑 Contraseña** arriba, junto a **Salir**.
3. **Biblioteca** → en cada empresa, clic en **Crear carpetas** (Labels, Logotipos, Diseños, Estructuras de label, Documentos). Tu equipo sube arrastrando los archivos.
4. **Catálogos** → **Subir catálogo** en cada empresa.

## Quién ve y toca qué (lo cuida la base de datos)

| | Cliente (Senen, Gerardo) | Equipo | Admin (tú) |
|---|---|---|---|
| Pedir tarea / corrección | ✅ las suyas | registra tareas a nombre de un cliente activo (no pide correcciones: lo que el cliente cambie por WhatsApp va como actualización) | igual que el equipo |
| Agregar instrucciones o PDFs a una tarea ya pedida (actualizaciones, con fecha) | ✅ las suyas | ✅ (lo que el cliente pidió por WhatsApp) | ✅ |
| Ver tareas | solo las suyas | todas | todas |
| Cambiar lo que escribió el cliente | ❌ | ❌ | ❌ |
| Estatus y fecha compromiso | 👁️ | ✅ | ✅ |
| Subir PDFs (la fecha se pone sola) | ❌ | ✅ | ✅ |
| Aprobado | ✅ solo quien la pidió | ❌ | ❌ |
| Biblioteca y catálogos | ver, descargar, a su correo | subir, carpetas, versiones | igual que el equipo |
| Borrar (tareas, correcciones, actualizaciones, archivos, carpetas) | ❌ | ❌ | ✅ solo tú |
| Parrilla: lo que se espera cada mes (lo fijo) | 👁️ | 👁️ | ✅ solo tú |
| Parrilla: pedir extras (este mes o el siguiente) | si le das el permiso | si le das el permiso | ✅ (y solo tú los cambias o borras) |
| Usuarios, empresas, bitácora | ❌ | ❌ | ✅ |
| Cambiar su propia contraseña | ✅ | ✅ | ✅ |

**Tu acceso es solo tuyo.** Tu perfil está marcado como **dueño**. Nadie más (ni otro admin si algún día lo hubiera, ni la llave de servicio) puede borrarte, apagarte, quitarte lo de admin, ni cambiarte el correo o la contraseña. Solo el dueño nombra administradores. La única otra puerta eres tú mismo directo en Supabase (SQL Editor), por eso cuida tu cuenta de Supabase con verificación en dos pasos.

Nada se reemplaza. Cada PDF nuevo (entrega, corrección o versión) se guarda junto a los anteriores. Lo que pidió el cliente no se edita: si cambia de idea, agrega una **actualización** con texto y/o archivos, y queda con fecha como prueba.

## Cuando haya mejoras en la base de datos

`supabase/esquema.sql` se puede volver a correr completo y no borra nada:
1. En tu Mac: `pbcopy < ~/Desktop/nexy/crm/supabase/esquema.sql`
2. Supabase → **SQL Editor** → **+ New query** → Cmd + V → **Run** (si avisa de "destructive operations", **Run this query**).
3. Debe decir **Success. No rows returned**.

La página se actualiza sola en Netlify con cada cambio en la rama.
