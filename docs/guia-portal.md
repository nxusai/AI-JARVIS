# Guía: conectar el portal de NXUS AI (empezar.nxusai.org)

El portal está en `portal/`:
- `public/index.html` es la página;
- `netlify/functions` es el "cerebrito" que guarda, cobra, agenda y avisa;
- `google/agenda.gs` es la agenda en tu Google.

Se conecta una vez, con 5 piezas. Las llaves y claves se pegan **solo** en
Netlify o en Google, nunca en un chat.

| # | Pieza | Dónde | Tiempo |
|---|---|---|---|
| 1 | Bot de Telegram "NXUS Portal" | Telegram | 3 min |
| 2 | Agenda (Google) | script.google.com con contacto@nxusai.org | 10 min |
| 3 | Cobro (Stripe) | dashboard.stripe.com | 10 min |
| 4 | El portal | app.netlify.com | 10 min |
| 5 | La dirección empezar.nxusai.org | Netlify (y Squarespace si hace falta) | 5 min |

## 1. Bot de Telegram

1. En Telegram abre **@BotFather** → `/newbot`.
2. Nombre: `NXUS Portal`. Usuario: por ejemplo `nxus_portal_bot`.
3. Te da una **llave (token)**. Guárdala en Contraseñas de tu Mac. Va en Netlify como `TELEGRAM_TOKEN`.
4. Abre tu bot nuevo y mándale `/start`. Así puede escribirte.
5. Tu número de cuenta de Telegram (va como `TELEGRAM_CHAT`). Sácalo en tu Mac con:
   `node -p "require(require('os').homedir()+'/.nexy/telegram.json').owner.id"`

## 2. Agenda en Google (con contacto@nxusai.org)

1. En una ventana de incógnito entra a https://script.google.com con **contacto@nxusai.org**.
2. Crea un **Nuevo proyecto**, borra lo que trae y pega `portal/google/agenda.gs`. En tu Mac lo copias con:
   `pbcopy < ~/Desktop/nexy/portal/google/agenda.gs`
3. Ponle de nombre `Agenda Portal` y guarda (Cmd + S).
4. A la izquierda, en **Servicios (+)**, elige **Google Calendar API** → Agregar.
5. Arriba elige **preparar** → **Ejecutar**. Acepta los permisos ("Configuración avanzada → Ir a Agenda Portal → Permitir").
6. Abajo sale **"Clave para el portal: …"**. Va en Netlify como `AGENDA_CLAVE`.
7. **Implementar → Nueva implementación** → engrane → **Aplicación web**:
   - Ejecutar como: **Yo**
   - Acceso: **Cualquier persona**

   Dale **Implementar**. La **URL** que termina en `/exec` va en Netlify como `AGENDA_URL`.

Tus horarios se cambian arriba en el mismo archivo: días, de 9 a 18, citas de 60 minutos y 15 minutos entre una y otra.

## 3. Cobro con Stripe

1. En https://dashboard.stripe.com → **Payment Links** → **Nuevo**.
2. Producto: `Consultoría NXUS AI`, con el precio en **MXN**.
3. En **Después del pago** elige **No mostrar página de confirmación**, redirige a:
   `https://empezar.nxusai.org/?pagado={CHECKOUT_SESSION_ID}`
4. Crea el link y cópialo. Va en Netlify como `PAGO_MX`.
5. Repite con el precio en **USD**. Ese link va como `PAGO_US`.
6. Haz la **llave restringida**: **Developers → API keys → Create restricted key**.
   - Nombre: `Portal`.
   - **Checkout Sessions: Read**, y todo lo demás en **None**.
   - Va en Netlify como `STRIPE_KEY`.

## 4. El portal en Netlify

1. Entra a https://app.netlify.com → **Add new site → Import an existing project → GitHub** → `nxusai/AI-JARVIS`.
2. Configura:
   - Branch: `claude/jarvis-project-setup-gs6uu2`
   - Base directory: `portal`
   - Lo demás lo toma solo de `portal/netlify.toml`.
3. En **Environment variables** agrega:
   - `TELEGRAM_TOKEN`
   - `TELEGRAM_CHAT`
   - `AGENDA_URL`
   - `AGENDA_CLAVE`
   - `PAGO_MX`
   - `PAGO_US`
   - `STRIPE_KEY`
   - `NEXY_CLAVE`: una clave larga inventada, para que NEX lea los prospectos. Guárdala en Contraseñas.
   - `HQ_URL`: `https://app.nxusai.org`, para que cada prospecto caiga en **NXUS HQ → Prospectos**.
   - `PORTAL_CLAVE`: la misma clave que pusiste en el proyecto de HQ (ver docs/guia-hq.md, "Conectar el portal").
4. Dale **Deploy**.

## 5. empezar.nxusai.org

1. En el sitio nuevo de Netlify: **Domain management → Add a domain** → `empezar.nxusai.org`.
2. Si nxusai.org ya usa los servidores de Netlify, se conecta solo.
3. Si no, Netlify te dice qué poner en **Squarespace → Dominios → DNS**: un registro **CNAME** `empezar` que apunta a tu sitio `….netlify.app`.
4. En tu página actual pon un botón "Empezar" que lleve a `https://empezar.nxusai.org`.

## Cómo se usa

- **Link para cada prospecto:** `https://empezar.nxusai.org/nombre-apellido`. El portal lo saluda por su nombre.
  - Con `?de=codigo` al final (por ejemplo `?de=barbara`), el prospecto queda a nombre de esa persona en HQ. El código se pone en HQ → Personas → Editar.
  - Lo más fácil es hacerlo desde HQ → Prospectos → **🔗 Link para un prospecto**, que también te da el mensaje para WhatsApp.
- **Aviso de privacidad:** `https://empezar.nxusai.org/privacidad`. Antes de mandar links a clientes, llena en `portal/public/privacidad.html` la **razón social** y el **domicilio** (salen marcados en naranja), y que lo revise un abogado.
- **Permiso de novedades:** en la pantalla de datos hay una casilla opcional para recibir casos de éxito y novedades. Quien la marca sale en HQ con "Acepta novedades"; solo a ellos se les puede mandar contenido después.
- **Lo que te llega a Telegram:**
  - 🆕 Abrió su link
  - 📋 Datos completos
  - 💳 Consultoría pagada
  - 📅 Cita agendada (con Meet)
- **Lo que recibe el cliente:**
  - la invitación de Google Calendar con Meet;
  - un correo de confirmación de contacto@nxusai.org;
  - recordatorios 24 horas y 1 hora antes.

## Prueba antes de mandarlo a clientes

1. Abre `https://empezar.nxusai.org/eduardo-prueba` y recorre el camino de "Quiero mi propuesta" con un correo tuyo.
2. Revisa que:
   - te llegan los avisos a Telegram;
   - la cita aparece en tu calendario con Meet;
   - el correo de confirmación llega.
3. Para probar la consultoría, Stripe tiene **modo de prueba**: haz los links en modo prueba y paga con la tarjeta `4242 4242 4242 4242`.
