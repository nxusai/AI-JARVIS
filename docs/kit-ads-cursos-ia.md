# Kit para el chat nuevo: anuncios de CURSOS DE IA PRESENCIALES (NXUS AI)

Este archivo junta todo lo aprendido en el chat de anuncios de NXUS (nov 2026) para arrancar el proyecto de cursos sin repetir errores. Léelo completo antes de proponer nada. Archivos de apoyo en este repo (rama `claude/jarvis-project-setup-gs6uu2`):
- `docs/lecciones-anuncios-mensajes.md`: reglas antibots de Meta + ManyChat + extensión (OBLIGATORIAS).
- `docs/aprendizajes-anuncios.md`: memoria de lo que funcionó y lo que no (con fechas).
- `docs/estado-ads-nxus.md`: historial completo de la campaña de NXUS (consulta, no copiar tal cual).
- `ads/prompt-chrome-*.txt`: ejemplos de prompts para Claude in Chrome (análisis, ManyChat, campaña MX, campaña NY, token, reporte semanal).
- `ads/nxus-video/`: cómo se armaron los videos verticales (subtítulos en zona segura, gancho en 3 s, música, versiones).

## 1. Quién es Eduardo y cómo trabajar con él
- Eduardo, fundador de NXUS AI. Escribe en español, quiere respuestas **breves, claras, paso a paso**, con los nombres de los botones **en inglés** tal como salen en la pantalla.
- Al final de cada respuesta repetir los **links** que va a usar. Nunca decir "como en el mensaje anterior": repetir lo que haga falta.
- Cuando manda captura de la extensión y pregunta "¿qué pongo?": decir qué opción elegir y por qué en 1–2 líneas, y darle el texto exacto para pegar.
- Acuerdo de trabajo: **yo (Claude) armo los anuncios desde cero** (estrategia, público, textos, configuración, guiones de video) y entrego **prompts para Claude in Chrome**. Eduardo sube fotos/videos y aprueba. **Presupuesto solo con su autorización.** Las zonas las da él.
- Antes de crear: primero escucharlo y hacerle las preguntas que falten.
- Mostrar vista previa antes de publicar. Revisar los videos terminados completos (que el audio dure todo el video).
- Si Eduardo dice que algo no le gusta, se cambia sin defenderlo (ej.: rechazó videos solo con texto).
- No inventar estadísticas ni testimonios.

## 2. Seguridad (no negociable)
- Nunca pedir ni pegar en el chat llaves, tokens, contraseñas, códigos ni tarjetas. Si un paso pide contraseña/código, la extensión se detiene y lo hace Eduardo.
- La extensión **nunca publica** campañas ni cambia pagos o límites de la cuenta, ni toca campañas existentes; se detiene antes de **Publish**. Para publicar en ManyChat necesita permiso explícito: "Sí, te autorizo de forma clara a publicar X y Y".
- No meter en el repo datos personales de leads (nombres, teléfonos) ni datos bancarios.
- Nada de identificadores de modelo en commits.

## 3. La lección principal: los bots
Gastamos $210 USD en anuncios de mensajes y llegaron **0 personas reales**: solo respuestas automáticas de otros negocios. Causa: objetivo de conversaciones + público abierto (Advantage+, 18+, radios grandes) + saludo de Meta sin botones + ManyChat con "contains INFO". Meta cobra la respuesta automática de un negocio como "conversación" y aprende a buscar más.

**Lo que lo arregló (ya probado con leads reales):**
1. Campaña manual: Engagement → **Messaging apps**, destino **solo Messenger** (el anuncio igual se ve en Instagram). Maximize conversations, Highest volume.
2. Presupuesto en el conjunto (no en la campaña), desmarcar "Share up to 20%", **Campaign spending limit** como tope.
3. Público: **"Switch to original audience options"**, edad mínima real con **"Use as a suggestion" desmarcado**, zonas chicas (pines 1 milla / códigos postales), **sin intereses**.
4. Placements manuales: solo Facebook + Instagram Feed, Stories y Reels.
5. **Todas** las mejoras de Advantage+ creative apagadas, Multi-advertiser off, Related media 0. Se re-prenden al duplicar: revisar cada vez. En la cuenta, salir de "testing new creative features".
6. Saludo = plantilla de **ManyChat (Partner app)**, una automatización por anuncio.
7. ManyChat: el primer mensaje tiene **botones** que una persona toca y un robot no (pregunta de filtro). Palabras clave con **"Message is"** (exacta), nunca "contains"; intent trigger apagado. Cada botón marca la fuente ("Anuncio · Video A") y etiqueta.
8. Default Reply en ManyChat (1 vez cada 24 h, ignorar respuestas a historias en IG) para quien escribe texto libre en vez de tocar botón; etiqueta `robot-autorespuesta` para lo que parezca bot.
9. Teléfono: botón de lada (🇲🇽 +52 · 🇺🇸 +1 · Otro) y respuesta tipo **Text**; el número se respeta tal cual.
10. Juzgar por **costo por cita / por inscrito**, no por costo por mensaje. **7 días sin tocar nada** (aprendizaje).

## 4. Videos que funcionaron
- Vertical 9:16, **gancho en los primeros 3 s que nombra al cliente ideal** como pregunta (el lead real llegó con "¿Tienes un restaurante con varias sucursales?").
- Subtítulos grandes dentro de la zona segura (franja ~290–1250 px de 1920), música suave, CTA al final.
- 3 variantes por campaña (Video A/B/C) con el mismo público para ver qué gancho gana.
- Ojo: el gancho atrae gente "parecida" (el de varias sucursales trajo un técnico dental con 2 sucursales). Ser específico.
- No usar frases sobre atributos personales de quien ve ("¿Tienes más de 50 años?", "¿Te cuesta la tecnología?"): Meta las rechaza. Mejor nombrar el negocio o la situación del negocio.

## 5. Qué cambia para CURSOS DE IA PRESENCIALES (puntos de partida, a confirmar con Eduardo)
- **Cliente ideal:** dueños de negocio de ~40–65+ que quieren promocionar su negocio con IA. Edad en el público, no en el texto del anuncio.
- **Presencial = zona chica:** radio corto alrededor de la sede del curso (lo que la gente maneja para ir). Preguntar ciudad, dirección, fecha, horario, cupo, precio, si hay anticipo.
- **Embudo propuesto:** anuncio → Messenger (ManyChat con botones) → filtro (¿tiene negocio? · giro · ¿qué fecha le queda?) → teléfono → apartar lugar (anticipo o confirmación) → recordatorios → asistencia. Medir: costo por inscrito y costo por asistente.
- **Público mayor:** botones grandes y pocos, textos cortos, trato de "usted", opción "Prefiero que me llamen". Es más probable que escriban texto libre: el Default Reply debe guiarlos amable sin perderlos.
- **Gancho ejemplo (a probar):** "¿Tiene un negocio y no sabe cómo anunciarlo en internet?" / "Aprenda a usar la IA para su negocio, en persona y paso a paso". Mostrar el salón, gente aprendiendo, la cara de Eduardo (hipótesis pendiente: video de Eduardo a cámara vs voz de IA).
- **Pendiente decidir con Eduardo:** ¿los inscritos entran a HQ (tabla de leads/prospectos) o a otro lugar? ¿NEX llama para confirmar o no? ¿Cuenta de anuncios y página: las mismas de NXUS o otras? ¿Campañas con nombre "NXUS | CURSOS | …" para que el panel de HQ las lea? (el panel filtra por "NXUS |").
- Categoría especial: cursos no lo son normalmente, pero si Meta lo marca, seguir lo que pida.

## 6. Prompts para la extensión: la forma que funciona
1. Primero **solo revisar y reportar** lo que existe (no crear). Si se cerró la pestaña, igual: revisar para no duplicar.
2. Pasos numerados con nombres de botones en inglés, valores exactos.
3. Reglas arriba: no publicar, no pagos, no tocar campañas existentes, detenerse ante contraseña/código, no leer tokens.
4. Verificar que el video correcto quedó en cada anuncio y que las mejoras automáticas quedaron apagadas.
5. Informe final con ✅ / ⚠️ / ❌ antes de publicar.

## 7. Mensaje para abrir el chat nuevo
(ver la respuesta del chat de NXUS; el texto también está aquí)

> Eres mi experto en Meta Ads. Proyecto nuevo: anuncios para vender CURSOS DE IA PRESENCIALES a dueños de negocio de 40 años en adelante, para que aprendan a promocionar su negocio con IA. Antes de todo lee en el repo nxusai/AI-JARVIS, rama claude/jarvis-project-setup-gs6uu2: docs/kit-ads-cursos-ia.md (completo), docs/lecciones-anuncios-mensajes.md, docs/aprendizajes-anuncios.md y los ejemplos ads/prompt-chrome-*.txt. Aplica todas esas reglas (sobre todo las de bots). Trabaja en una rama nueva para este proyecto. Primero escúchame y hazme las preguntas que falten (ciudad y sede, fechas, cupo, precio, anticipo, a dónde van los inscritos). Tú armas los anuncios, los textos, los guiones de video y los prompts para Claude in Chrome; yo subo fotos y videos y autorizo el presupuesto.
