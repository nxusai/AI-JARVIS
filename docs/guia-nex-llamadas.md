# Guía: NEX llama a los leads y agenda tu Meet (fases 3 y 4)

Cuando un lead termina el filtro de ManyChat y da permiso, **NEX le llama solo** desde la nube (aunque tu Mac esté apagada):
- En los **2 minutos** siguientes, de **lunes a sábado de 9 de la mañana a 8 de la noche, hora del lead** (USA → hora de Nueva York, México → hora del centro). Los que llegan de noche, a las 9 de la mañana.
- **Una sola vez.** Si no contesta, cuelga o dice "ahora no", se va a la **Cartera** con su motivo. Si pide no ser llamado, queda bloqueado.
- NEX platica, entiende su negocio, **no da precios** ("traje a la medida") y **agenda un Google Meet de 30 minutos contigo** (lunes a sábado, 9 a 4 hora de NJ) en tu calendario. Al lead le llega la invitación con el Meet, y recordatorios 24 h y 1 h antes.
- En **HQ → Leads** queda todo: resumen, lo que anotó (empresa, necesidad, cómo lo hace hoy, quién decide, urgencia, presupuesto, lo que le aconsejó) y la conversación. Si agendó, pasa solo a **Prospectos → Cita agendada**, a tu nombre, con el Meet.
- En la ficha del lead está el botón **📞 Llamar ahora** para llamarle en ese momento (para pruebas o para alguien de la Cartera).

## Lo que necesitas (una sola vez)

### 1. El número nuevo de NXUS (Twilio)
1. https://console.twilio.com → crea cuenta o entra.
2. **Phone Numbers → Manage → Buy a number**: país **United States**, con **Voice**; de preferencia lada de NJ (973, 201 o 862) → **Buy**.
3. Para poder llamar a México: **Voice → Settings → Geo permissions** → marca **Mexico** → **Save**.
4. Ten a la mano el **Account SID** y el **Auth Token** (en la página principal de la consola). No los pegues en ningún chat.

### 2. La agenda de Google (si no la has instalado)
Es el programa `portal/google/agenda.gs`. Corre en la cuenta de Google de tu calendario.
1. https://script.google.com → **New project** → borra lo que haya y pega todo `portal/google/agenda.gs` (en tu Mac: `pbcopy < ~/Desktop/nexy/portal/google/agenda.gs`).
2. A la izquierda, **Services (+)** → **Google Calendar API** → **Add**.
3. Arriba, elige la función **preparar** → **Run** → acepta los permisos. En **Execution log** sale la **clave**: cópiala (es `AGENDA_CLAVE`).
4. **Deploy → New deployment** → tipo **Web app** → Execute as: **Me** · Who has access: **Anyone** → **Deploy** → copia la **Web app URL** (es `AGENDA_URL`).

Si ya la tenías instalada, solo pega el `agenda.gs` nuevo encima, **Save**, y **Deploy → Manage deployments → editar (lápiz) → Version: New version → Deploy** (la URL no cambia).

### 3. El agente NEX Ventas en ElevenLabs (con Claude in Chrome)
1. Abre https://elevenlabs.io/app/agents en Chrome y el panel de **Claude**.
2. Pégale:
   ```
   Lee las instrucciones de este archivo y síguelas al pie de la letra en mi pestaña de ElevenLabs. No escribas ninguna clave ni hagas llamadas; si algo no coincide, detente y pregúntame. Avísame en español al terminar cada parte.
   https://github.com/nxusai/AI-JARVIS/blob/claude/jarvis-project-setup-gs6uu2/docs/nex-elevenlabs-construccion.md
   ```
3. Cuando te lo pida: escribe tú el **Account SID / Auth Token** de Twilio, copia el **secreto del webhook** y escribe la clave `x-nex-clave` en las 3 herramientas.
4. Al final te da el **Agent ID** y el **Phone number ID**.

### 4. Las claves en Netlify (proyecto nxus-hq)
https://app.netlify.com → **nxus-hq** → **Project configuration** → **Environment variables** → **Add a variable** (marca **Contains secret values** en las que son secretas):

| Key | Qué es |
|---|---|
| `ELEVENLABS_API_KEY` | Tu llave de ElevenLabs (ElevenLabs → **Developers / API keys** → crea una nueva llamada "NXUS HQ"). Secreta. |
| `NEX_AGENT_ID` | El Agent ID de **NEX Ventas**. |
| `NEX_PHONE_NUMBER_ID` | El Phone number ID del número de NXUS en ElevenLabs. |
| `ELEVENLABS_WEBHOOK_SECRET` | El secreto del webhook que te mostró ElevenLabs. Secreta. |
| `NEX_HERRAMIENTAS_CLAVE` | Inventa una (en tu Mac: `openssl rand -hex 24 \| tr -d '\n' \| pbcopy`) y pon la misma en las 3 herramientas del agente (`x-nex-clave`). Secreta. |
| `AGENDA_URL` | La Web app URL de la agenda de Google. |
| `AGENDA_CLAVE` | La clave que dio "preparar" en la agenda. Secreta. |

Luego **Deploys → Trigger deploy → Deploy project**. (Pon también `AGENDA_URL` y `AGENDA_CLAVE` en el Netlify del portal para que el portal agende igual.)

## Probar
1. En **HQ → Leads** abre tu lead de prueba (el de ManyChat, con **tu** teléfono y correo) → **📞 Llamar ahora**.
2. Contesta: platica como cliente, pregunta el precio, acepta un horario.
3. Al colgar, en 1 o 2 minutos: la ficha del lead muestra la llamada, y en **Prospectos → Cita agendada** aparece con su Meet; te llega la invitación al correo y la ves en tu Google Calendar.
4. Prueba también no contestar (debe irse a la **Cartera → No contestó**).
