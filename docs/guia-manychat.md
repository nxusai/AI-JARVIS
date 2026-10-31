# Guía: ManyChat → NXUS HQ (fase 2 del ecosistema de leads)

ManyChat platica con quien comenta **INFO** en un post o le da clic al botón de un anuncio, le pide sus datos y el permiso de llamada, y manda todo a **HQ → Leads**. De ahí, NEX le llama (fase 3).

- Canales: **Instagram** y **Facebook**. Idiomas: **español** e **inglés**.
- Solo es **calificado** quien termina todo: nombre, empresa, dirección, ciudad, país, teléfono, correo y servicio. Quien se queda a la mitad entra a HQ como **No calificado**.
- Quien no da el permiso de llamada entra a la **Cartera** con el motivo "Sin permiso de llamada". NEX no le llama.
- ManyChat avisa a HQ **dos veces**: al empezar (para que no se pierda quien se queda a la mitad) y al terminar.

> Los nombres de los botones son los de ManyChat en inglés. Si alguno cambió un poco, busca el más parecido.

## 1. La clave que comparten ManyChat y HQ (una sola vez)
Es como la del portal: solo quien la trae puede meter leads a HQ. Nunca la pegues en un chat.
1. En la Terminal de tu Mac, crea la clave y cópiala:
   ```bash
   openssl rand -hex 24 | tr -d '\n' | pbcopy
   ```
2. Guárdala en **Contraseñas** de tu Mac con el nombre `ManyChat → HQ`.
3. https://app.netlify.com → proyecto **nxus-hq** → **Project configuration** → **Environment variables** → **Add a variable**:
   - Key: `MANYCHAT_CLAVE`
   - Value: la clave (pégala con **Cmd + V**). Marca **Contains secret values**.
   - **Create variable**.
4. **Deploys** → **Trigger deploy** → **Deploy project**.

## 2. Los campos (una sola vez)
https://app.manychat.com → tu cuenta de NXUS AI → **Settings** → **Fields** → **+ New User Field**. Crea estos, todos de tipo **Text**:

| Campo | Para qué |
|---|---|
| `nombre` | Nombre completo |
| `empresa` | Nombre de la empresa |
| `direccion` | Dirección de la empresa |
| `ciudad` | Ciudad |
| `pais` | México, USA u Otro |
| `telefono` | Teléfono con lada |
| `correo` | Correo |
| `servicio` | Lo que le interesa |
| `idioma` | Español o English |
| `permiso` | Sí o No (permiso de llamada) |
| `canal` | instagram o facebook |
| `fuente` | De dónde llegó: "Comentó INFO", "Anuncio ..." |
| `hq_estado` | Lo que contesta HQ (no lo llenas tú) |
| `hq_faltan` | Lo que le faltó, según HQ (no lo llenas tú) |

## 3. El flujo "Filtro NXUS"
**Automation** → **+ New Automation** → ponle de nombre `Filtro NXUS`. Arma los bloques en este orden. En cada pregunta usa un bloque **User Input**: así la respuesta se guarda sola en su campo (**Save response to a custom field**).

### 3.1 Idioma
- Mensaje: `¡Hola! 👋 / Hi there! 👋` y debajo `¿En qué idioma prefieres? / Which language do you prefer?`
- **User Input** con **Quick Replies** `Español` y `English` → guarda en `idioma`.
- **Condition**: `idioma` **is** `English` → rama en inglés. Si no, rama en español. Las dos ramas son iguales; solo cambia el texto (abajo van los dos).

### 3.2 Las preguntas (en cada rama)

| # | Español | English | Tipo de respuesta | Campo |
|---|---|---|---|---|
| 1 | Soy el asistente de NXUS AI. Para preparar tu asesoría te hago unas preguntas rápidas. ¿Cuál es tu nombre completo? | I'm the NXUS AI assistant. To prepare your consultation, I'll ask you a few quick questions. What's your full name? | Text | `nombre` |
| — | **Aviso 1 a HQ** (paso 3.3, `"completo": false`) | | | |
| 2 | Gracias, {{nombre}}. ¿Cómo se llama tu empresa? | Thanks, {{nombre}}. What's your company's name? | Text | `empresa` |
| 3 | ¿Cuál es la dirección de tu empresa? | What's your company's address? | Text | `direccion` |
| 4 | ¿En qué ciudad está? | Which city is it in? | Text | `ciudad` |
| 5 | ¿En qué país? | Which country? | Quick Replies: `México` · `USA` · `Otro` / `Mexico` · `USA` · `Other` | `pais` |
| 6 | ¿A qué número te podemos llamar? Escríbelo con lada, por ejemplo +1 973 555 0100 o +52 55 1234 5678 | What number can we call you at? Include the country code, e.g. +1 973 555 0100 | **Phone** | `telefono` |
| 7 | ¿Cuál es tu correo? Ahí te llega la invitación a la reunión. | What's your email? Your meeting invitation will go there. | **Email** | `correo` |
| 8 | ¿Qué te interesa? | What are you interested in? | Quick Replies (y deja que escriba otra cosa): `NXUS Neural` · `Software a medida` · `Ventas con IA` · `Marketing` · `Web y datos` · `Quiero asesoría` / `NXUS Neural` · `Custom software` · `AI sales & support` · `Marketing` · `Web & data` · `Need advice` | `servicio` |

En **Phone** y **Email**, ManyChat revisa que el formato sea válido. Pon como mensaje de error: `Revisa que esté bien escrito 🙏` / `Please check it's written correctly 🙏`.

### 3.3 Avisar a HQ (External Request)
Va dos veces: después de la pregunta 1 (`"completo": false`) y después del permiso (`"completo": true`).
1. **+ Action** → **External Request** (en **Dev Tools**).
2. **Request type:** `POST`
3. **Request URL:** `https://nxus-hq.netlify.app/.netlify/functions/manychat`
4. **Headers** → **+ Add header**:
   - Key: `x-manychat-clave`
   - Value: la clave del paso 1 (cópiala de **Contraseñas** de tu Mac).
5. **Body** → pega esto. Para cada `{{…}}` borra el texto y mete el campo con **+ Add Variable** (o el botón `{ }`), para que ManyChat ponga el valor de verdad. `manychat_id` es el campo del sistema **Contact Id** (en algunas cuentas sale como **User Id**):
   ```json
   {
     "manychat_id": "{{Contact Id}}",
     "canal": "{{canal}}",
     "fuente": "{{fuente}}",
     "idioma": "{{idioma}}",
     "nombre": "{{nombre}}",
     "empresa": "{{empresa}}",
     "direccion": "{{direccion}}",
     "ciudad": "{{ciudad}}",
     "pais": "{{pais}}",
     "telefono": "{{telefono}}",
     "correo": "{{correo}}",
     "servicio": "{{servicio}}",
     "permiso": "{{permiso}}",
     "completo": true
   }
   ```
   En el **aviso 1** cambia la última línea a `"completo": false`.
6. **Response mapping** (solo en el aviso 2):
   - `$.estado` → `hq_estado`
   - `$.faltan` → `hq_faltan`
7. **Test Request** debe contestar `"ok": true`. Ojo: en la prueba ManyChat **no** llena los campos del Response mapping. Eso solo pasa con una persona de verdad.

### 3.4 El permiso de llamada (en cada rama)
Este texto es el que queda como registro en HQ. Cópialo **tal cual**, sin cambiarle nada:

- **Español:**
  > Para avanzar, un asistente de inteligencia artificial de NXUS AI te llamará para conocer tu empresa y agendar tu reunión.
  >
  > Sí, autorizo a NXUS AI a llamarme a este número con un asistente de inteligencia artificial (voz artificial) para hablar de mi solicitud. Sé que la llamada se puede grabar, que no es condición para contratar y que puedo pedir en cualquier momento que no me llamen.

  Botones: `Sí, autorizo` → **Set Field** `permiso` = `Sí` · `No, gracias` → **Set Field** `permiso` = `No`
- **English:**
  > To move forward, an NXUS AI artificial intelligence assistant will call you to learn about your business and schedule your meeting.
  >
  > Yes, I authorize NXUS AI to call me at this number using an artificial intelligence assistant (artificial voice) about my request. I understand the call may be recorded, that consent is not a condition of purchase, and that I can ask not to be called at any time.

  Botones: `Yes, I agree` → **Set Field** `permiso` = `Yes` · `No, thanks` → **Set Field** `permiso` = `No`

Los dos botones van al **aviso 2 a HQ** (paso 3.3).

### 3.5 El último mensaje (según lo que contestó HQ)
**Condition** sobre `hq_estado`:

| `hq_estado` | Español | English |
|---|---|---|
| `nuevo` | ¡Listo, {{nombre}}! ✅ En unos minutos te llama el asistente de IA de NXUS AI. Ten a la mano tu teléfono y revisa que no tengas bloqueadas las llamadas de números desconocidos, para que te entre. Si es de noche, te llama a primera hora de la mañana. | You're all set, {{nombre}}! ✅ The NXUS AI assistant will call you in a few minutes. Keep your phone nearby and make sure calls from unknown numbers aren't blocked so it gets through. If it's late, you'll get the call first thing in the morning. |
| `cartera` | Gracias, {{nombre}}. Sin problema: un asesor de NXUS AI te escribirá por aquí. | Thanks, {{nombre}}. No problem: an NXUS AI advisor will message you here. |
| `incompleto` | Nos faltó: {{hq_faltan}}. Escribe INFO para empezar de nuevo. | We're missing: {{hq_faltan}}. Type INFO to start over. |
| cualquier otro | Ya tenemos tus datos, {{nombre}}. Te contactamos pronto. | We already have your details, {{nombre}}. We'll be in touch soon. |

Cuando tengamos el número nuevo de NXUS (fase 3), en el mensaje `nuevo` agregamos: "Te va a llamar el +1 …; guárdalo como NXUS AI".

### 3.6 Facebook
Cuando el flujo funcione en Instagram, **duplícalo** para Facebook (los tres puntos → **Duplicate**) y cambia los mensajes al canal **Messenger**. HQ recibe los dos igual.

## 4. Los disparadores (cómo llega la gente al flujo)
Cada disparador, antes de mandar al flujo, llena dos campos con **Set Field**: `canal` y `fuente`.

1. **Comentarios en Instagram:** **+ New Trigger** → **Instagram** → **User comments on your Post or Reel**.
   - Posts: **Any post or reel** (o los que quieras).
   - Keywords: `INFO` (no importan mayúsculas o minúsculas).
   - Respuesta pública al comentario: `¡Te mandé un mensaje! 📩` / `Check your DMs! 📩`
   - Set Field: `canal` = `instagram`, `fuente` = `Comentó INFO`. Luego → **Filtro NXUS**.
   - Ojo: Instagram solo dispara el flujo con el **primer** comentario de cada persona en ese post.
2. **Comentarios en Facebook:** lo mismo con **Facebook** → **Comments**. `canal` = `facebook`.
3. **Anuncios:** en cada anuncio que mande al chat (fase 6), el disparador de ManyChat para ese anuncio con `fuente` = `Anuncio · <nombre del anuncio>`.
4. **Mensaje directo con INFO:** **Keywords** → `INFO` → mismo flujo, con `fuente` = `Escribió INFO`.

En cada post y anuncio, el texto debe decir qué hacer, por ejemplo: **"Comenta INFO y te mandamos cómo lo haríamos en tu negocio."**

## 5. Probarlo
1. Desde **otra** cuenta de Instagram (no la de NXUS), comenta `INFO` en un post.
2. Contesta todo y acepta el permiso.
3. Abre https://nxus-hq.netlify.app → **Leads**. Debes salir **Hoy**, con tu hora, **Instagram** y **Por llamar**.
4. Prueba también quedarte a la mitad (sale en **No calificados**) y decir **No, gracias** al permiso (sale en la **Cartera** como "Sin permiso de llamada").
5. Para borrar las pruebas: entra a la ficha del lead → **Borrar**.

Si algo no llega, en ManyChat: **Settings** → **Logs** te dice qué contestó HQ.

## Lo que contesta HQ (para quien lo programe)
`POST /.netlify/functions/manychat` con el encabezado `x-manychat-clave`.
- `{ "ok": true, "id": "…", "estado": "nuevo" | "incompleto" | "cartera" | …, "faltan": "correo, teléfono" }`
- `401` si la clave no coincide, `400` si falta `manychat_id`.
- Busca al lead por `manychat_id` y solo avanza: un lead que NEX o el equipo ya trabajaron no se toca. Un lead que estaba "Sin permiso" y luego lo da regresa a "Por llamar".
- El teléfono se guarda con lada: 10 dígitos con país USA → `+1`, con México → `+52`.
