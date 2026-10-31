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

## Lo que sigue: el ecosistema autónomo de leads
Objetivo: que los leads de los anuncios se procesen solos y a Eduardo le lleguen casi cerrados, listos para una reunión de contrato. **Primero el ecosistema, los anuncios al final.**

Lo platicado hasta ahora (Eduardo va a explicar su versión y hay que opinar, recomendar y esperar su luz verde):
1. ManyChat contesta con IA y califica.
2. El lead calificado entra **directo a HQ** (no Google Sheets).
3. NEX le llama con el agente de voz (como Ana Sofi).
4. La IA acomoda el resultado: interesado → portal y cita; no contestó o "ahora no" → **Cartera de prospectos** (sección nueva en HQ) con reintentos automáticos y un call center que la trabaja hasta cerrar o descartar.
5. NEX conectado a HQ: antes de la cita, resumen del prospecto y propuesta en borrador.
6. Medir en Dinero: gasto en anuncios contra clientes cerrados.
7. Al final, anuncios: Claude hace el contenido cada semana (3 imágenes con Bloom y videos), Eduardo aprueba al principio, NEX publica en Meta dentro de un tope, y cada semana se analiza y se anota lo aprendido.

Cuidados: para llamar con voz de IA en USA hace falta permiso previo por escrito (pedirlo en ManyChat y guardarlo en HQ); respetar a quien pida no ser llamado.

Preguntas abiertas: canales de ManyChat (plan Pro para mandar datos a HQ); qué es un lead calificado; call center de personas, NEX o ambos; reglas de reintento; tope de gasto en anuncios; México, USA o ambos y qué servicios; si ya hay cuenta de anuncios de NXUS en Meta.
