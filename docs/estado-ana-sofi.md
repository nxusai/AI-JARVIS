# Estado: Ana Sofi y la línea de ventas de Mi Semago

Última actualización: 8 de noviembre de 2026. Para retomar en un chat nuevo dedicado a este tema.
Lee también `docs/estado-nxus.md` (cómo trabajar con Eduardo y el panorama general) y **`docs/estado-crm.md`** (el Centro de trabajo Mi Semago · Abuelito, el CRM del cliente: este chat también lo modifica, y ahí llegarán eventualmente los leads de Mi Semago).

## Cómo trabajar con Eduardo (resumen)
- Español, pasos clic por clic con los nombres de botones en inglés como salen en pantalla, **links y comandos dentro de cada paso y repetidos al final**.
- Nunca pedir ni pegar llaves en el chat. Preguntar antes de instalar algo en todo el sistema. Sin PR si no lo pide.
- Rama `claude/jarvis-project-setup-gs6uu2` de `nxusai/AI-JARVIS`; en su Mac vive en `~/Desktop/nexy`, se actualiza con el zip de la rama.
- NEX se prende y apaga a mano (`cd ~/Desktop/nexy && npm start`); nunca sugerir que corra solo.
- No tocar el agente de Ana Sofi sin que él lo pida.

## Cómo funciona hoy
1. **ManyChat** atiende en WhatsApp con IA, califica al lead (caliente / medio / frío) y le pregunta a qué hora quiere que le llamen.
2. ManyChat escribe el lead en el Google Sheet **"Leads Mi Semago"**.
3. **NEX** (en la Mac de Eduardo) vigila el Sheet a través de un Apps Script con llave larga pegado en el propio Sheet. Puede leer las filas y escribir solo sus 6 columnas: Fecha, Estado, Llamada programada, Resultado, Reunión y Notas.
4. NEX programa la llamada a la hora que pidió el lead, en su zona horaria (lo que requiere criterio se lo pasa a NEX como encargo).
5. **Ana Sofi** (agente de voz de ElevenLabs, voz de mujer) llama, da precios y resuelve dudas con el catálogo de Mi Semago.
6. Después de la llamada NEX escribe el resultado; si no contestó, reintenta **una vez**; si aceptó el precio, agenda una **videollamada de 1 hora con Eduardo** (busca hueco en su calendario y deja la invitación para que él la confirme con un toque) y le avisa por Telegram.
7. Si el lead devuelve la llamada al número de Ana Sofi, contesta su "gemela" de entrada.

## Reglas de seguridad (no relajarlas sin que Eduardo lo pida)
- Solo llama a números que el lead dejó en el Sheet, de leads **caliente o medio** que **pidieron por escrito** que los llamaran.
- Solo números de **EE.UU.**; los de otro país no se llaman y se le avisa a Eduardo.
- La IA nunca pone un número: solo escoge horarios.
- Corre solo mientras NEX esté prendido.

## Dónde está el código
- `bridge/ventas.mjs` — la línea de ventas: leer el Sheet, programar y leer llamadas, reintentos, escribir resultados, avisos, la videollamada, herramientas de NEX.
- `bridge/anasofi.mjs` y `bridge/nucleo/anasofi.mjs` — Ana Sofi como asistente (Telegram, voz); también corre en el "cerebro" del cliente.
- `scripts/ana-sofi.mjs` — conectar y revisar desde la Terminal de la Mac:
  - `node scripts/ana-sofi.mjs` (configurar: script del Sheet, link, Agent ID, Phone number ID)
  - `node scripts/ana-sofi.mjs script` · `estado` · `revisar` · `entrantes` · `avisos meetings|todo`
- Configuración en la Mac: `~/.nexy/ventas.json` (sheetUrl, token, agentId, phoneId) y `~/.nexy/ventas-estado.json`.
- Llamadas en general: `docs/guia-llamadas.md`; `scripts/voz-llamadas.mjs`.

## Relacionado (otro chat)
El ecosistema autónomo de leads de **NXUS** (ManyChat → NXUS HQ → llamada → Cartera de prospectos) se diseña en otro chat con `docs/estado-nxus.md`. Este modelo de Ana Sofi es la referencia.

## En marcha: los leads pasan al Centro de trabajo (luz verde del 8 de noviembre de 2026)
Decisiones de Eduardo:
- Los leads llegan al **Centro de trabajo** (`docs/estado-crm.md`, sección **Leads**), no al Sheet. **Ana Sofi sigue corriendo en una computadora** (hoy la Mac con NEX; después una computadora de la empresa de Senen, siempre prendida). **No en la nube.** Solo la puerta que recibe el lead de ManyChat vive en Netlify (la página del Centro de trabajo ya está ahí).
- **ManyChat corto**, 3 preguntas: nombre; negocio y ciudad; ¿te podemos llamar para darte precios? ¿a qué hora? (el número llega solo por WhatsApp). Sin calificar en el chat: la gente se aburre de tantas preguntas.
- **Ana Sofi saca todo en la llamada**: nombre, correo, confirma teléfono, tipo de negocio, quesos, libras, cada cuánto, marca propia; **califica** (caliente / medio / frío); **da precios** con el catálogo (solo para que los conozca, no tiene que aceptarlos); y **si el lead quiere, agenda el Google Meet** con Eduardo.
- **Regla nueva:** se llama a **todos los que den permiso por escrito** (ya no solo caliente/medio). Siguen: solo EE.UU., la IA nunca pone un número, reintento una vez.
- **Meet:** con Eduardo, en **su** calendario de Google (el que ya está conectado), 1 hora, 10 am–4 pm hora del Este, cualquier día, al menos 3 h después de la llamada y dentro de 5 días. La invitación al lead sale sola.
- **Avisos a Eduardo: por llamada de NEX, no por Telegram.** Los días con meeting, **llamada en la mañana** con el reporte del día, y **llamada una hora antes de cada meeting**. Además el evento queda en su calendario.
- **En el Centro de trabajo** ven Leads Eduardo y quien tenga el permiso "Ve Leads" (Senen): ven todo, el link para unirse al Meet y agregan notas; solo Eduardo (administrador principal) cambia la etapa o borra.

Fases:
1. ✅ **Sección Leads** en el Centro de trabajo: tablas `leads` y `leads_notas` (`crm/supabase/esquema.sql`), tablero por etapas, ficha con datos, lo que contó en la llamada, resumen, llamadas, permiso por escrito, Meet con botón **Unirse al meeting**, notas; permiso **Ve Leads** en Usuarios. Falta correr el esquema en Supabase.
2. Entrada: función de ManyChat en el Centro de trabajo (clave en Netlify y en ManyChat) y pasar una vez los leads del Sheet.
3. NEX (`bridge/ventas.mjs`) lee y escribe los leads en el Centro de trabajo (llave de servicio guardada en la Mac) en vez del Sheet; regla nueva de a quién llamar.
4. ManyChat corto (guía o prompt para Claude in Chrome) y las instrucciones nuevas de Ana Sofi en ElevenLabs (pasos clic por clic).
5. Avisos por llamada (mañana de días con meeting y una hora antes).
6. Prueba con el número de Eduardo; el mismo día se apaga la vigilancia del Sheet (para que nadie reciba dos llamadas).
Después: la gemela de entrada y lo de WhatsApp de NEX, y mover todo a la computadora de la empresa.
