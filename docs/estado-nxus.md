# Estado de NXUS (para retomar en un chat nuevo)

Última actualización: 31 de octubre de 2026.

## Cómo trabajar con Eduardo
- Contestar en español, con pasos clic por clic, nombres de botones en inglés tal como salen en pantalla, y **todos los links y comandos dentro de cada paso y repetidos al final**.
- Nunca decir "el mensaje anterior": repetir lo necesario.
- Cada vez que haya que actualizar nexy, dar **completo en ese paso**: el link del zip y el comando para actualizar (el de abajo), nunca "con tu comando de siempre".
- Nunca pedir ni pegar llaves o contraseñas en el chat: van en Netlify, Supabase, Contraseñas de la Mac o prompts ocultos.
- Preguntar antes de instalar algo en todo el sistema. No abrir PR si no lo pide.
- Mostrar fotos (muestra) antes de que él suba algo.
- Rama: `claude/jarvis-project-setup-gs6uu2` del repo `nxusai/AI-JARVIS`. En su Mac vive en `~/Desktop/nexy`. Actualiza bajando el zip de la rama (https://github.com/nxusai/AI-JARVIS/archive/refs/heads/claude/jarvis-project-setup-gs6uu2.zip) y pegando en la Terminal este comando, que lo descomprime, copia lo nuevo encima de `nexy` sin tocar lo que solo vive en su Mac (`.env`, `node_modules`, memoria de NEX) y borra el zip; si la copia falla, no borra nada:
  ```bash
  S=""; D=~/Downloads; Z=$(ls -t "$D" | grep -E '^AI-JARVIS-claude-jarvis-project-setup-gs6uu2.*\.zip$' | head -1); F=$(ls -t "$D" | grep -E '^AI-JARVIS-claude-jarvis-project-setup-gs6uu2' | grep -v '\.zip$' | head -1); T=$(mktemp -d); if [ -n "$Z" ]; then unzip -q "$D/$Z" -d "$T" && S=$(ls -d "$T"/*/ | head -1); elif [ -n "$F" ]; then S="$D/$F/"; fi; if [ -z "$S" ]; then echo "No encontré el zip en Descargas"; elif cp -R "$S". ~/Desktop/nexy/; then echo "Listo: nexy actualizado"; grep -q "public.leads (" ~/Desktop/nexy/hq/supabase/esquema.sql && echo "✓ Ya trae Leads y Cartera" || echo "✗ Sigue el archivo viejo"; [ -n "$Z" ] && rm "${D:?}/${Z:?}"; [ -n "$F" ] && rm -rf "${D:?}/${F:?}"; else echo "No se pudo copiar: no borré nada"; fi; rm -rf "${T:?}"
  ```
- Netlify publica HQ y el portal desde `claude/jarvis-project-setup-gs6uu2`: si el trabajo se hace en otra rama, hay que pasarlo a esa (con su permiso) para que se vea.

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
2. ✅ **ManyChat → HQ**: `hq/netlify/functions/manychat.mjs` (clave `MANYCHAT_CLAVE` en Netlify y en el encabezado `x-manychat-clave` de ManyChat) y la guía clic por clic con los mensajes en español e inglés, el permiso de llamada y los disparadores: `docs/guia-manychat.md`. Falta que Eduardo ponga la clave en Netlify y arme el flujo en ManyChat.
3. La llamada de NEX desde la nube (ElevenLabs + número nuevo), con resumen, puntos y grabación en HQ.
4. Google Calendar y Meet (también sirve al portal), recordatorios 24 h y 1 h antes, y propuestas en borrador antes del meeting.
5. Medir en Dinero: gasto en anuncios contra clientes cerrados.
6. Contenido y anuncios: Claude hace el contenido cada semana, Eduardo lo aprueba en HQ, NEX publica y aprende (con las señales de leads y clientes de vuelta a Meta).
