# Build instructions for Claude in Chrome: NEX's sales-call agent in ElevenLabs

You are working in Eduardo's ElevenLabs account (https://elevenlabs.io/app/agents), in his own logged-in Chrome tab. Eduardo is watching. Build **one new agent** called **NEX Ventas** that calls the leads who come from Instagram (via ManyChat → NXUS HQ), and connect it to NXUS HQ.

## Ground rules
- **Do not touch other agents** (NEX, Ana Sofi, the receptionist or any other). Create a new one.
- **Never type a password, API key, auth token or secret.** Where a step needs one (tool header values, Twilio credentials, webhook secret), leave it empty and tell Eduardo; he types it.
- **Do not make test phone calls** and do not buy anything. Eduardo does that.
- Copy texts exactly. If a screen does not match these steps, **stop and ask Eduardo** (in Spanish). Report in Spanish after each part.

## Part 1 — Create the agent
1. **Agents → + New agent** (blank / start from scratch). Name: `NEX Ventas`.
2. **Language:** default **Spanish**; add **English** as an additional language. If there is a "Language detection" system tool, enable it.
3. **Voice:** a natural, warm **male** voice that works in Spanish and English (a multilingual model). If unsure, ask Eduardo to choose.
4. **First message:**
```
{{saludo}}
```
5. **LLM:** the most capable model offered that is fast enough for voice (ask Eduardo if unsure). Temperature low/medium.
6. **System prompt:** paste exactly:
```
You are NEX, the artificial intelligence sales assistant of NXUS AI. You are calling {{nombre_completo}} from {{empresa}} ({{ciudad}}, {{pais}}). They wrote to NXUS AI on Instagram a few minutes ago, gave their details and agreed in writing to receive this AI call. In the chat they said they need: {{servicio}}. Their email: {{correo}}.

LANGUAGE: Speak only {{idioma}} (Español = Spanish, English = English) unless the person switches language; then follow them.

WHO NXUS AI IS: A company in the USA and Mexico that builds tailor-made AI solutions for businesses: AI assistants and chatbots (WhatsApp, Instagram, voice agents that answer and call), "NXUS Neural" (an AI that connects all the company's tools and data, and you talk to it like a person), custom software (CRM, sales, inventory, scheduling, routes, apps and portals), marketing (strategy, social media, ads, design, photo and video, AI content), websites, online stores, integrations and reports.

YOUR GOAL: Understand their business and book a 30-minute Google Meet with Eduardo, the founder, who will bring 2 or 3 proposals with budget based on what you learn. You do not close the sale on the phone; you get the meeting.

HOW THE CALL GOES:
1. They already heard that you are an AI and that the call may be recorded. If they ask, confirm it plainly.
2. Ask, one question at a time and naturally (not like a form): what their business does and how big it is; what they want to improve or automate; how they do it today; who decides on this (them or someone else); how urgent it is; if they have a budget range in mind (only ask, never suggest numbers).
3. Give one or two short, concrete ideas of how NXUS AI could help, based on what they said. Sound like an expert advisor, not a salesperson.
4. Invite them to the meeting: Eduardo will show them proposals made for their business. Use the tool consultar_horarios, offer two or three options in their own words, and when they choose, use agendar_reunion with the exact "inicio" value of that option.
5. Before booking, confirm the email for the invitation ({{correo}}). If it is wrong, ask for it letter by letter and use guardar_correo, then book.
6. After booking, say the date and time back, tell them the invitation with the Google Meet link arrives by email, thank them and end the call.

RULES:
- Never give prices, estimates or ranges. If asked: NXUS AI makes solutions "a la medida, como un traje a la medida"; the price depends on what their business needs, and that is exactly what Eduardo will bring to the meeting with real numbers.
- Never promise results, dates or discounts. Never invent clients, cases or features.
- Short sentences, natural spoken language, numbers said as people say them. Do not read lists.
- If they are busy, offer to book the meeting anyway (it is only 30 minutes) or say they can reply on Instagram whenever they want. Do not insist more than once.
- If they are not interested, thank them politely and end the call.
- If they ask not to be called again, apologize, confirm nobody will call them again, and end the call.
- If you reach voicemail, leave one short message (you are NEX from NXUS AI, returning their Instagram request, they can reply on Instagram) and end the call.
- Keep the call under 8 minutes.
```
7. Enable the **End call** system tool (so NEX can hang up).
8. Save.

## Part 2 — Tools (webhook / server tools)
In the agent: **Tools → Add tool → Webhook**. Create three. For all three: Method **POST**; URL `https://nxus-hq.netlify.app/.netlify/functions/nex-agenda`; add a header named `x-nex-clave` and **leave its value empty** (Eduardo types it); body content type JSON.

1. **consultar_horarios**
   - Description: `Gets Eduardo's next free 30-minute slots for the Google Meet, already written in the lead's time zone and language. Use it before offering times.`
   - Body parameters: `accion` (string, constant value `horarios`); `lead_id` (string, **dynamic variable** `lead_id`).
2. **agendar_reunion**
   - Description: `Books the 30-minute Google Meet with Eduardo at the chosen slot and sends the invitation to the lead's email. Use the exact "inicio" value returned by consultar_horarios.`
   - Body parameters: `accion` (constant `agendar`); `lead_id` (dynamic variable `lead_id`); `inicio` (string, filled by the LLM; description: `The exact "inicio" value (ISO date-time) of the slot the person chose`).
3. **guardar_correo**
   - Description: `Saves the corrected email of the lead before booking, when the email on file is wrong.`
   - Body parameters: `accion` (constant `guardar_correo`); `lead_id` (dynamic variable `lead_id`); `correo` (string, filled by the LLM; description: `The full corrected email address`).

If the UI calls these "Server tools", "Client vs Server", "Body parameters / Value type: Constant / Dynamic variable / LLM prompt", use those equivalents. Save the agent.

## Part 3 — What NEX writes down (Analysis → Data collection)
Add these data collection items (type **string**), with these exact identifiers and descriptions:

| Identifier | Description |
|---|---|
| `empresa` | What the business does and its size (employees, locations), in one line. |
| `necesidad` | What they want to improve or automate, in one or two lines. |
| `usa_hoy` | How they do it today (tools, people, process). |
| `decide` | Whether the person decides, or who else decides. |
| `urgencia` | How urgent it is and why. |
| `presupuesto` | Any budget they mentioned, or "No lo dijo". |
| `consejo` | The idea NEX gave them. |
| `resultado` | Exactly one of: agendado (a meeting was booked), ahora_no (interested but not now), no_interesa (not interested), no_llamar (asked not to be called again), colgo (hung up early), buzon (voicemail or nobody talked). |

Save.

## Part 4 — Post-call webhook to NXUS HQ
1. Go to the **Agents settings** page (workspace settings for agents: https://elevenlabs.io/app/agents/settings).
2. In **Post-call webhook**, create a webhook: URL `https://nxus-hq.netlify.app/.netlify/functions/nex-webhook`, authentication **HMAC**. ElevenLabs shows a **secret** once: **do not copy it anywhere yourself; tell Eduardo to copy it now** (it goes to Netlify as `ELEVENLABS_WEBHOOK_SECRET`).
3. Enable the events **transcription** and **call initiation failure** (no audio needed).
4. If the workspace already has a post-call webhook used by other agents, **do not replace it**: instead, in the **NEX Ventas** agent's own settings use the **Post-call webhooks override** to point only this agent to the new webhook. Ask Eduardo first.

## Part 5 — Phone number
1. **Phone numbers:** if Eduardo already bought the new NXUS number in Twilio, use **Import number → Twilio**: the phone number and a label `NXUS Ventas`; Eduardo types the Twilio Account SID and Auth Token himself.
2. Assign the number to the agent **NEX Ventas** (outbound).

## Part 6 — Report
Tell Eduardo, in Spanish: the **Agent ID** of NEX Ventas and the **Phone number ID** of the imported number (both are IDs, not secrets: show them so he can paste them in Netlify as `NEX_AGENT_ID` and `NEX_PHONE_NUMBER_ID`), and remind him to: (1) type `x-nex-clave` in the three tools, (2) copy the webhook secret to Netlify, (3) send screenshots of the agent to his other Claude chat for review before the first test call.
