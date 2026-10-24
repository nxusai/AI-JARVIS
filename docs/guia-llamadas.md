# Guía: NEX con internet en tus llamadas

Cuando NEX te llama, puedes preguntarle cualquier cosa y él la investiga en internet al momento. Si le pides algo que hay que hacer (un correo, agendar, preparar algo, darle trabajo a Ultron), lo anota y lo hace en tu Mac en cuanto está prendido. Te avisa por Telegram al terminar.

Solo la agente que **te llama a ti** tiene esto. La mensajera y la recepcionista, que hablan con otras personas, no.

## Cómo funciona
- **investigar**: la llamada le pregunta al portal (Netlify), el portal busca en internet con Claude y la llamada te lee la respuesta.
- **encargar_a_nex**: la llamada deja la tarea en el portal y NEX la toma desde tu Mac cada 30 segundos mientras está prendido.
- Todo va con una llave que solo tienen tu Mac, Netlify y tu agente de ElevenLabs.

## Si "node scripts/llamada.mjs agente" no pudo crear las herramientas
Agrégalas a mano en ElevenLabs (https://elevenlabs.io/app/agents), en tu agente de llamadas:
1. Pestaña **Agent** → sección **Tools** → **Add tool** → **Webhook**.
2. Herramienta 1:
   - **Name:** `investigar`
   - **Description:** Investiga en internet cualquier pregunta de Eduardo y devuelve la respuesta lista para decirla en voz alta.
   - **Method:** POST · **URL:** `https://TU-PORTAL/.netlify/functions/nex-investigar`
   - **Headers:** `x-nex-clave` = la llave (cópiala con `node scripts/llamada.mjs llave`)
   - **Body parameters:** `pregunta` (string, requerido): la pregunta completa.
   - **Response timeout:** 45 segundos.
3. Herramienta 2, igual pero:
   - **Name:** `encargar_a_nex` · **URL:** `…/nex-encargo` · **Body:** `tarea` (string, requerido) · **Timeout:** 15.
4. **Save**.
