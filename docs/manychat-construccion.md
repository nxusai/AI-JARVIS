# Build instructions for Claude in Chrome: finish the "Filtro NXUS" automation in ManyChat

You are working in Eduardo's ManyChat account **NXUS AI** (https://app.manychat.com), in his own logged-in Chrome tab. Eduardo is watching. These are the exact steps to finish the Instagram automation **Filtro NXUS** (currently a **DRAFT**) and to create a second automation, **INFO comentarios**.

## Ground rules (read first)
- **Never click Set Live or Update / Publish.** Leave everything as a draft. Eduardo publishes after review.
- **Do not touch other automations, contacts, settings, billing, or anything outside these two automations.** Do not delete or rename User Fields.
- **Never type a password, API key or secret.** In the External Request header value, leave it empty: Eduardo types it himself.
- Customer-facing texts are below in Spanish and English. **Copy them exactly**, accents and emojis included. Do not rewrite, shorten or translate them.
- ManyChat's UI may differ slightly from these names. If a step does not match what you see, **stop and ask Eduardo** instead of guessing. Never delete a step you did not create in this session without asking.
- After each part, tell Eduardo in one or two lines (in Spanish) what you did.
- Button and menu names below come from ManyChat's Help Center (October 2026): actions are added with **+ Action** (or double-click the canvas / the blue **+** at the top right); **Set User Field** is under **Contact data**; **Make External Request** is under **Automation**; conditions with **+ Condition**; **AI Step** and **Start Automation** from the same step menu; **Data Collection** is a content block inside an Instagram **Send Message** step (configure it in **Edit Data Collection**: Reply Type, Save Response to a Custom Field, Retry message, "Data Collection expires in").

## What already exists in Filtro NXUS
- Triggers: two **Instagram → User sends a message**: (1) keyword `INFO`, (2) **Recognize intention of a message** ("Person wants info, prices, a quote or a meeting about NXUS AI services for their business").
- **Actions** step: Set User Field `canal` = `instagram`; Set User Field `fuente` = `Instagram DM`.
- An Instagram **Send Message** with the text "¡Hola! 👋 ¿En qué idioma prefieres? / Hi! 👋 Which language do you prefer?" and a **Data Collection** (Multiple Choice) that still has **no options** (ManyChat shows "Please enter one or more replies for multiple choice user input").
- An **AI Step** with 2 tasks (answer questions; save a summary of their business and needs to `servicio`) and a Context written by Eduardo.
- User Fields (all Text): `nombre`, `empresa`, `direccion`, `ciudad`, `pais`, `telefono`, `correo`, `servicio`, `idioma`, `permiso`, `canal`, `fuente`, `hq_estado`, `hq_faltan`.

## Final shape of Filtro NXUS
```
Triggers → Actions (canal, fuente) → Language message (Español | English → idioma) → AI Step (servicio)
  → Actions "Aviso 1 a HQ" (External Request, completo: false)
  → Condition: idioma is English?
       no  → Spanish questions → Spanish consent ─┐
       yes → English questions → English consent ─┤
                                                  → Actions "Aviso 2 a HQ" (External Request, completo: true, maps hq_estado, hq_faltan)
  → Condition: idioma is English? → in each language: Condition hq_estado is nuevo → "call" message;
                                     else Condition hq_estado is cartera → "advisor" message; else → "thanks" message
```

## Part 1 — Language message
1. Open the language **Send Message** step. In its **Data Collection**: Reply Type **Multiple Choice**; **Also allow free text input** unchecked; **Save Response to a Custom Field** = `idioma`; Retry message: `Elige una opción / Please choose an option 👇`; set **Data Collection expires in** to the longest value under 24 hours (e.g. 23 hours).
2. Add the options with the **+ Quick Reply** that belongs to the Data Collection (right under the "Skip" button, not "+ Add Quick Reply"): `Español` and `English`.
3. If the **"Skip" button** can be removed, remove it. If not, set its text to `Español`.
4. Wiring: **Actions → Next Step** goes to this language message; the language message's **Next Step** goes to the **AI Step**. Remove any direct link from Actions to the AI Step.

## Part 2 — AI Step Context
Open the AI Step and edit **Context** (pencil icon). Do not change Goal or tasks.
1. Replace the whole line that starts with `- Never give prices or estimates.` with:
```
- Never give prices or estimates. If they ask about price, say (in their language): "En NXUS AI hacemos soluciones a la medida, como un traje a la medida: el precio depende de lo que necesita tu negocio. Por eso un asistente te va a llamar para entenderlo bien y después te reúnes con nuestro equipo, que te presenta propuestas con presupuesto." / "At NXUS AI we build tailor-made solutions, like a custom suit: the price depends on what your business needs. That's why an assistant will call you to understand it well, and then you'll meet our team, who will present proposals with a budget." Then ask about their business.
```
2. Make sure this line exists (add it if missing):
```
- Do NOT ask for their name, company, address, city, country, phone or email: those are asked right after you. When you understand what they need, thank them and say you will now ask a few quick details.
```
3. Add a last line `- The person chose this language: ` then insert the variable **idioma** with the **{·}** button, then type `. Write ALL your messages in that language, including the first one.`
4. Save. Make sure the AI Step's tasks are still exactly two, and the second one saves to `servicio`.

## Part 3 — Aviso 1 a HQ (lead started)
1. From the AI Step's **Next Step**, add an **Actions** step, rename it `Aviso 1 a HQ`.
2. **+ Action → Automation → Make External Request** → **Add your request**:
   - Request type: **POST**
   - Request URL: `https://nxus-hq.netlify.app/.netlify/functions/manychat`
   - Headers: add key `x-manychat-clave` and **leave the value empty** (Eduardo fills it).
   - Body (JSON). For every `{{…}}`, insert the real variable with ManyChat's variable picker so it is not plain text. `manychat_id` is the contact's ID system field (**Contact Id** / **User Id**):
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
  "completo": false
}
```
   - No response mapping in this one. Save.
3. From `Aviso 1 a HQ` **Next Step**: **+ Condition** → User Field `idioma` **is** `English`. Green (matches) = English branch; the other output = Spanish branch.

## Part 4 — The questions (one Instagram Send Message per question, each with one Data Collection)
For every question: Data Collection with the Reply Type and field below, **Data Collection expires in** ~23 hours, and connect each message's **Next Step** to the next question, in order. Retry message — Spanish: `Revisa que esté bien escrito 🙏`; English: `Please check it's written correctly 🙏`.

**Spanish branch** (from the Condition's non-matching output):

| # | Text | Reply Type | Save to |
|---|---|---|---|
| 1 | `Para preparar tu reunión, ¿cuál es tu nombre completo?` | Text | `nombre` |
| 2 | `Gracias, {{nombre}}. ¿Cómo se llama tu empresa?` (insert `nombre` as a variable) | Text | `empresa` |
| 3 | `¿Cuál es la dirección de tu empresa?` | Text | `direccion` |
| 4 | `¿En qué ciudad está?` | Text | `ciudad` |
| 5 | `¿En qué país?` options `México`, `USA`, `Otro` | Multiple Choice | `pais` |
| 6 | `¿A qué número te podemos llamar? Escríbelo con lada, por ejemplo +1 973 555 0100 o +52 55 1234 5678` | Phone (save to the User Field `telefono`; do NOT enable SMS or WhatsApp opt-in) | `telefono` |
| 7 | `¿Cuál es tu correo? Ahí te llega la invitación a la reunión.` | Email (save to the User Field `correo`; do NOT enable email opt-in) | `correo` |

**English branch** (from the Condition's matching output), same settings:

| # | Text | Reply Type | Save to |
|---|---|---|---|
| 1 | `To prepare your meeting, what's your full name?` | Text | `nombre` |
| 2 | `Thanks, {{nombre}}. What's your company's name?` | Text | `empresa` |
| 3 | `What's your company's address?` | Text | `direccion` |
| 4 | `Which city is it in?` | Text | `ciudad` |
| 5 | `Which country?` options `Mexico`, `USA`, `Other` | Multiple Choice | `pais` |
| 6 | `What number can we call you at? Include the country code, e.g. +1 973 555 0100` | Phone (User Field `telefono`, no opt-ins) | `telefono` |
| 7 | `What's your email? Your meeting invitation will go there.` | Email (User Field `correo`, no opt-ins) | `correo` |

## Part 5 — Consent (legal record: copy word for word)
After question 7 in each branch, one more Send Message whose Data Collection is **Multiple Choice**, **no free text**, saves to `permiso`.

Spanish text:
```
Para avanzar, un asistente de inteligencia artificial de NXUS AI te llamará para conocer tu empresa y agendar tu reunión.

Sí, autorizo a NXUS AI a llamarme a este número con un asistente de inteligencia artificial (voz artificial) para hablar de mi solicitud. Sé que la llamada se puede grabar, que no es condición para contratar y que puedo pedir en cualquier momento que no me llamen.
```
Options: `Sí, autorizo` and `No, gracias`.

English text:
```
To move forward, an NXUS AI artificial intelligence assistant will call you to learn about your business and schedule your meeting.

Yes, I authorize NXUS AI to call me at this number using an artificial intelligence assistant (artificial voice) about my request. I understand the call may be recorded, that consent is not a condition of purchase, and that I can ask not to be called at any time.
```
Options: `Yes, I agree` and `No, thanks`.

Both consent messages' **Next Step** go to the same new step (Part 6).

## Part 6 — Aviso 2 a HQ (lead finished)
1. New **Actions** step named `Aviso 2 a HQ` with **Make External Request** identical to Part 3 except the last line of the body is `"completo": true`.
2. In its **Response mapping**: `$.estado` → `hq_estado`, `$.faltan` → `hq_faltan`. (ManyChat's Test Request does not fill mapped fields; that only happens with a real contact.)
3. Connect both consent messages to it.

## Part 7 — Final messages
From `Aviso 2 a HQ` **Next Step**: **+ Condition** `idioma` is `English`.
In each language: Condition `hq_estado` is `nuevo` → message A; otherwise Condition `hq_estado` is `cartera` → message B; otherwise → message C. (Insert `nombre` as a variable.)

| | Spanish | English |
|---|---|---|
| A (`nuevo`) | `¡Listo, {{nombre}}! ✅ En unos minutos te llama el asistente de IA de NXUS AI. Ten a la mano tu teléfono y revisa que no tengas bloqueadas las llamadas de números desconocidos, para que te entre. Si es de noche, te llama a primera hora de la mañana.` | `You're all set, {{nombre}}! ✅ The NXUS AI assistant will call you in a few minutes. Keep your phone nearby and make sure calls from unknown numbers aren't blocked so it gets through. If it's late, you'll get the call first thing in the morning.` |
| B (`cartera`) | `Gracias, {{nombre}}. Sin problema: un asesor de NXUS AI te escribirá por aquí.` | `Thanks, {{nombre}}. No problem: an NXUS AI advisor will message you here.` |
| C (other) | `Gracias, {{nombre}}. Ya tenemos tus datos y te contactamos pronto.` | `Thanks, {{nombre}}. We have your details and will be in touch soon.` |

## Part 8 — Second automation "INFO comentarios" (comments on posts)
Instagram requires that a comment trigger's first step is a **Private Reply** with a single content block and a button; the conversation continues only when the person taps it.
1. **Automation → + New Automation → + Start From Scratch → Start from a blank canvas.** Name it `INFO comentarios`.
2. **+ New Trigger → Instagram → User comments on your Post or Reel** → **All post or reels** → keyword `INFO` → public replies (add both variations): `¡Te mandé un mensaje! 📩 / Check your DMs! 📩` and `¡Revisa tus mensajes! 📩 / Sent you a DM! 📩` → **Save**.
3. First step: Instagram **Send Message** with **Send as a Private Reply** enabled. One Text block: `¡Hola! 👋 Gracias por tu interés en NXUS AI. Toca el botón para empezar. / Thanks for your interest in NXUS AI. Tap below to start.` with one Quick Reply button `Empezar / Start`. No other blocks in this step.
4. The button leads to an **Actions** step: Set User Field `canal` = `instagram`; Set User Field `fuente` = `Instagram comentario`.
5. Then a **Start Automation** step → pick **Filtro NXUS**.
6. Leave it as a draft.

Because Filtro NXUS sets `fuente` = `Instagram DM` at its start, change Filtro NXUS's first Actions step so it only sets `fuente` when it is empty: put a **Condition** right after the triggers — `fuente` has no value (use the "is empty / is unknown / has no value" operator ManyChat offers) → yes: the Actions step (canal + fuente) → language message; no: go straight to the language message. If ManyChat has no such operator, skip this paragraph and tell Eduardo.

## Part 9 — Report
Tell Eduardo (in Spanish): what you built, anything you could not do or that looked different, and remind him to (1) type the HQ key in the `x-manychat-clave` header of **Aviso 1 a HQ** and **Aviso 2 a HQ** himself, and (2) send a screenshot of both automations to his other Claude chat for review before **Set Live**.
