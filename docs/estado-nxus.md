# Estado de NXUS (para retomar en un chat nuevo)

Última actualización: 31 de octubre de 2026.

## Cómo trabajar con Eduardo
- Contestar en español, con pasos clic por clic, nombres de botones en inglés tal como salen en pantalla, y **todos los links y comandos dentro de cada paso y repetidos al final**.
- Nunca decir "el mensaje anterior": repetir lo necesario.
- Nunca pedir ni pegar llaves o contraseñas en el chat: van en Netlify, Supabase, Contraseñas de la Mac o prompts ocultos.
- Preguntar antes de instalar algo en todo el sistema. No abrir PR si no lo pide.
- Mostrar fotos (muestra) antes de que él suba algo.
- Rama: `claude/jarvis-project-setup-gs6uu2` del repo `nxusai/AI-JARVIS`. En su Mac vive en `~/Desktop/nexy`. Actualiza bajando el zip de la rama.

## Lo que ya existe
- **NXUS HQ** (`hq/`, guía `docs/guia-hq.md`): https://nxus-hq.netlify.app (app.nxusai.org todavía sin conectar). Supabase `zntjhkauoiodmmpxfucw`.
  - Clientes, Prospectos (tablero por etapas, ficha, notas, siguiente paso, convertir en cliente, link por vendedor `?de=codigo` con comisión automática), Tareas, Equipo, Mi reloj, Nómina, Dinero, Personas (permisos de prospectos por persona), Bitácora.
  - Diseño de cristal en colores NXUS, saludo diario y frase del día (dueño vs. equipo, `hq/public/frases.js`).
  - Falta: poner su nombre en Personas → Editar (su perfil no tiene nombre).
- **Portal de prospectos** (`portal/`, guía `docs/guia-portal.md`): https://nxus-portal.netlify.app. Catálogo, diagnóstico, consultoría o propuesta, datos, aviso de privacidad, permiso de novedades. Manda cada prospecto a HQ (`HQ_URL` = https://nxus-hq.netlify.app, `PORTAL_CLAVE` en los dos proyectos). Probado y funcionando.
  - Falta: razón social y domicilio en `portal/public/privacidad.html`; agenda de Google; bot de Telegram "NXUS Portal"; dominio empezar.nxusai.org. Stripe después.
- **NEX** (bridge en su Mac): voz, Telegram, llamadas con ElevenLabs, Meta Ads (solo cuenta de Mi Semago), modo socio con topes. Se prende y apaga a mano. Todavía **no** está conectado a HQ.
- **Centro de trabajo Mi Semago · Abuelito** (`crm/`): con Ultron, Parrilla de contenidos, diseño de cristal y frase del día solo para clientes. Video para Senen hecho (inglés).
- **Ana Sofi**: llama a los leads de Mi Semago desde Google Sheets (no tocar).
- Conectores en Claude: **Bloom** (marca NXUS AI lista, ~10 créditos por imagen) y **Higgsfield**.

## El ecosistema autónomo de leads (luz verde el 31 de octubre de 2026)
Objetivo: que los leads de los anuncios se procesen solos y a Eduardo le lleguen casi cerrados, listos para un meeting de contrato. **Primero el ecosistema, los anuncios al final.** Esquema de Eduardo: AI (Claude) → videos y contenido con Bloom → NEX → redes y Meta Ads → ManyChat AI → leads filtrados → NXUS HQ → llamada de NEX → videollamada con Eduardo, o Cartera de leads → call center.

Lo decidido:
- **México y USA**, todo en **español e inglés**.
- **ManyChat (plan Pro, ya lo tiene)** en **Facebook e Instagram**. En los posts, comentar una palabra (INFO) abre el chat; en los anuncios, botón al chat.
- Filtro: nombre, empresa, dirección de la empresa, teléfono, correo, ciudad/país, servicio y **permiso por escrito** de que una IA le llame. Solo los que terminan son calificados. Al final se le avisa que un asistente de IA le llamará pronto, desde qué número, y que no tenga bloqueadas las llamadas.
- La parte urgente (recibir el lead y llamar) corre **en la nube** (HQ en Netlify + Supabase), no en la Mac. Las llamadas salen de un **número nuevo solo para NXUS**.
- NEX llama **una sola vez**, en cuanto llega el lead (fuera de horario, a la mañana siguiente). Dice que es IA y que se graba. No da precios: NXUS AI "hace trajes a la medida". Pregunta por la empresa, lo que necesita, quién decide y la urgencia; aconseja y agenda un **Google Meet de 30 minutos** con Eduardo, **lunes a sábado de 9 am a 4 pm hora de NJ**. Anota todo en HQ.
- No contestó, no le interesa, colgó o "ahora no" → **Cartera de prospectos**. **NEX no vuelve a llamar** a los de la Cartera; ahí esperan al call center (personas, todavía no existe). Quien pide no ser llamado queda bloqueado para siempre.
- La cuenta de anuncios de NXUS en Meta **ya existe**. El tope de gasto se define antes de la fase 6.

Fases:
1. ✅ **HQ: secciones Leads y Cartera** (`leads`, `leads_notas`, `lead_a_prospecto` en `hq/supabase/esquema.sql`; pantallas en `hq/public/app.js`). Falta que Eduardo corra el esquema en Supabase (guía HQ, paso 6).
2. ManyChat → HQ: la puerta para que entren solos (función en Netlify con clave, como la del portal) y el flujo de ManyChat en los dos idiomas.
3. La llamada de NEX desde la nube (ElevenLabs + número nuevo), con resumen, puntos y grabación en HQ.
4. Google Calendar y Meet (también sirve al portal), recordatorios 24 h y 1 h antes, y propuestas en borrador antes del meeting.
5. Medir en Dinero: gasto en anuncios contra clientes cerrados.
6. Contenido y anuncios: Claude hace el contenido cada semana, Eduardo lo aprueba en HQ, NEX publica y aprende (con las señales de leads y clientes de vuelta a Meta).
