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

## Anuncios de Mi Semago (9 de nov de 2026)
Campaña "Mi Semago · Distribuidores Oeste · WhatsApp · Prueba 7 días": `docs/ads/mi-semago-distribuidores-oeste/` (imágenes y prompts para Claude in Chrome, v2). Se arma con `docs/lecciones-anuncios-mensajes.md`: campaña manual, presupuesto en el conjunto ($25/día, tope $175), 30–65 sin intereses, códigos postales de zonas de bodegas y mayoreo del oeste + Chicago, ubicaciones manuales, mejoras de IA apagadas, un mensaje prellenado distinto por anuncio y ManyChat con disparadores de frase EXACTA que guardan "MS Fuente" → `leads.fuente` (en la ficha: "De qué anuncio"). WhatsApp de los anuncios: +1 484-969-8507 (el de ManyChat; estaba ligado por error a la página de El Abuelito).
- **Publicada el 9 de nov de 2026** con los 4 anuncios (Capacidad 500k lb, Tu marca, Logística 40°F, Carrusel planta real; el carrusel solo como Carousel). $25/día hasta el **16 de nov 11:59 PM EST**, tope $175. No tocar nada hasta el 16 aunque diga "Learning limited". El 17 se revisan gasto, conversaciones y leads por anuncio (Leads → "De qué anuncio"), juzgando por leads buenos y Meets, no por costo por mensaje.
- ManyChat: las automatizaciones "MS Ads · …" tienen la frase con y sin punto/acentos ("Message is"); "MS Orgánico · INFO" para los posts. La automatización vieja con "contains" queda apagada.
- Ana Sofi corre en la **Mac de Eduardo con NEX prendido** mientras corren los ads (decisión del 9 de nov); después pasa a una computadora de Mi Semago. La Mac no debe dormirse.
- Voz de Ana Sofi (9 de nov): `node scripts/ana-sofi.mjs diagnostico` (tiempos de la última llamada, para pegar en el chat) y `voz [arreglar|regresar]`. El diagnóstico mostró modo expresivo prendido, turnos "patient", sin filtro de fondo (en speaker oye el eco) e idioma base inglés (~4 s cambiando a español en cada lead); `voz arreglar` lo corrige con respaldo. Pendiente: confirmar con una llamada en speaker.
- Claude in Chrome: usar el **perfil de Chrome "Mi Semago"** (solo con la extensión de Claude); en el perfil normal chocaba con otra extensión y no podía tocar las páginas.

## Decisión del 8 de noviembre de 2026: solo el Centro de trabajo
Eduardo: "enfócate en que funcione en el CRM, ya no en Google Sheet". Todo trabajo nuevo de Ana Sofi y de los leads de Mi Semago es para el Centro de trabajo (fuente "centro"). El modo Sheet de `bridge/ventas.mjs` no se mejora ni se usa para probar; se queda sin tocar solo como regreso de emergencia (`node scripts/ana-sofi.mjs sheet`) hasta que Eduardo archive el Sheet (recomendado tras una semana estable, con copia en Excel); entonces se quita el modo Sheet del código.

## En marcha: los leads pasan al Centro de trabajo (luz verde del 8 de noviembre de 2026)
Decisiones de Eduardo:
- Los leads llegan al **Centro de trabajo** (`docs/estado-crm.md`, sección **Leads**), no al Sheet. **Ana Sofi sigue corriendo en una computadora** (hoy la Mac con NEX; después una computadora de la empresa de Senen, siempre prendida). **No en la nube.** Solo la puerta que recibe el lead de ManyChat vive en Netlify (la página del Centro de trabajo ya está ahí).
- **ManyChat corto** (cambio del 8 de nov: **sin preguntar hora**): idioma; nombre; negocio y ciudad; ¿te podemos llamar para darte precios? (el número llega solo por WhatsApp). Ana Sofi llama **en ese mismo momento, a cualquier hora** (decisión de Eduardo del 8 de nov: si están escribiendo es porque quieren info): `schedule_sales_call` con `ahora: true`, solo para un lead nuevo del Centro de trabajo que pidió la llamada en la última hora (WhatsApp o misemago.com). El segundo intento (si no contestó) sí respeta 9 am–8 pm de su hora. **Llamada instantánea** (9 de nov): NEX revisa los leads nuevos cada 15 s (`newLeadsTick`) y, si no dieron hora, marca directo (`callNow`, endpoint outbound-call de ElevenLabs según el proveedor del número, sin la cola de batch ni el encargo a NEX); los 3 horarios del Meet salen de `autoSlots` (10 am, 1 pm, 3 pm hora del Este, días distintos, ≥3 h); al agendar, si ese horario está ocupado en el calendario de Eduardo se usa el libre más cercano ese día o el siguiente. Si la llamada directa no sale, cae al camino de antes (NEX la programa) y queda nota en la ficha. NEX revisa los leads cada minuto con el Centro de trabajo. Sin calificar en el chat: la gente se aburre de tantas preguntas.
- **Ana Sofi saca todo en la llamada**: nombre, correo, confirma teléfono, tipo de negocio, quesos, libras, cada cuánto, marca propia; **califica** (caliente / medio / frío); **da precios** con el catálogo (solo para que los conozca, no tiene que aceptarlos); y **si el lead quiere, agenda el Google Meet** con Eduardo.
- **Regla nueva:** se llama a **todos los que den permiso por escrito** (ya no solo caliente/medio). Siguen: solo EE.UU., la IA nunca pone un número, reintento una vez.
- **Meet:** con Eduardo, en **su** calendario de Google (el que ya está conectado), 1 hora, 10 am–4 pm hora del Este, cualquier día, al menos 3 h después de la llamada y dentro de 5 días. La invitación al lead sale sola.
- **Avisos a Eduardo: por llamada de NEX, no por Telegram.** Los días con meeting, **llamada en la mañana** con el reporte del día, y **llamada una hora antes de cada meeting**. Además el evento queda en su calendario.
- **En el Centro de trabajo** ven Leads Eduardo y quien tenga el permiso "Ve Leads" (Senen): ven todo, el link para unirse al Meet y agregan notas; solo Eduardo (administrador principal) cambia la etapa o borra.

Fases:
1. ✅ **Sección Leads** en el Centro de trabajo: tablas `leads` y `leads_notas` (`crm/supabase/esquema.sql`), tablero por etapas, ficha con datos, lo que contó en la llamada, resumen, llamadas, permiso por escrito, Meet con botón **Unirse al meeting**, notas; permiso **Ve Leads** en Usuarios. Falta correr el esquema en Supabase.
2. ✅ (código) **Entrada**: `crm/netlify/functions/manychat.mjs` (POST con encabezado `x-manychat-clave` = `MANYCHAT_CLAVE` en Netlify, proyecto centro-misemago-abuelito). Recibe `contacto_id, nombre, negocio_ciudad` (o `negocio` y `ciudad`), `telefono, hora, permiso, idioma`. Lead nuevo con permiso → etapa Nuevo; sin permiso → No llamar; si vuelve a escribir y pide llamada después de terminar → Nuevo otra vez (con Meet o llamada en curso no se reinicia). Pasar los leads del Sheet: lo hace `node scripts/ana-sofi.mjs centro` (una vez; no duplica; conserva las llamadas en marcha).
3. ✅ (código) **NEX con el Centro de trabajo**: `bridge/ventas.mjs` con `fuente: 'centro'` en `~/.nexy/ventas.json` (más `centroUrl` y `centroKey`, la Secret key del Supabase del Centro de trabajo, que `node scripts/ana-sofi.mjs centro` lee del portapapeles). Lee la tabla `leads`; llama a quien dio permiso por escrito (solo EE.UU.); escribe etapa, llamadas, calificación, correo, quesos, libras, cada cuánto, marca propia, precios, resumen y conversación, y notas firmadas "Ana Sofi". El Meet (`log_sales_meeting` con `inicio`) pone etapa Meet con link. Avisos por llamada de NEX (sin Telegram): cuando se agenda un Meet, la llamada de la mañana los días con meeting (la de las 8 que ya existía, modo "meetings") y **una hora antes** de cada meeting (`meetingReminders`, `~/.nexy/ventas-recordatorios.json`). `node scripts/ana-sofi.mjs sheet` regresa al Sheet. Lo de WhatsApp (Solicitud / Nuevo horario) solo funciona con el Sheet por ahora.
4. **ManyChat corto**: prompt para Claude in Chrome en `docs/manychat-misemago-construccion.md` (arma el flujo nuevo sin publicarlo; se publica en la Fase 3 del prompt). Fases 1 y 2 del prompt hechas el 8 de nov (flujo "Mi Semago · Chat corto (Centro de trabajo)" en borrador, con pregunta de idioma, catálogo y mínimo neutral, número de Ana Sofi +19737504108; el viejo "MS - Embudo Mi Semago" sigue LIVE con su disparador de palabras clave). ✅ (código) **Instrucciones nuevas de Ana Sofi**: `SALIDA_PROMPT` y `SALIDA_DATA` en `bridge/ventas.mjs`; se ponen con `node scripts/ana-sofi.mjs instrucciones` (guarda respaldo en `~/.nexy/ana-sofi-respaldos.json`; `instrucciones regresar` vuelve). Pide nombre, correo (deletreado), datos del negocio; califica; da precios de lista; ofrece la videollamada sin que acepte el precio. Resultado nuevo `sin_videollamada`. `node scripts/ana-sofi.mjs ver` copia las instrucciones que tiene hoy.
5. Avisos por llamada: ✅ en el código (ver 3).
6. Prueba con el número de Eduardo; el mismo día: Fase 3 del prompt de ManyChat + `node scripts/ana-sofi.mjs centro` + reiniciar NEX.
Después: la gemela de entrada y lo de WhatsApp de NEX, y mover todo a la computadora de la empresa.

## Leads del sitio web (misemago.com) → Ana Sofi

Pedido de Eduardo (8 de noviembre de 2026): los leads del formulario «Cotizar / Get a quote» de misemago.com también los llama Ana Sofi **de inmediato**, saltándose lo que ya contestaron en el formulario, y agenda la videollamada.

- **Permiso por escrito:** el formulario tiene la casilla «Quiero que me llamen ahora…» con el aviso legal (incluye que puede llamar un asistente de voz con IA). Solo a quien la marca se le llama, y entonces el teléfono es obligatorio (10 dígitos de EE. UU.). El texto exacto que aceptó, con fecha, se guarda en `permiso_texto`.
- **Cómo entra:** `crm/netlify/functions/leads.mjs` guarda la solicitud en `website_leads` (pestaña WEBSITE LEADS) y, si marcó la casilla, crea un lead en `leads` con `origen = 'web'`, etapa Nuevo y lo que ya sabemos: nombre, negocio, correo, teléfono, idioma, tipo de negocio, quesos, libras (las que calculó en el Estudio de Marca), marca propia, y en el resumen su mensaje y su diseño del Estudio. `website_leads.lead_id` apunta a ese lead (botón «Ver llamada de Ana Sofi»). En Leads sale con la etiqueta 🌐 Web.
- **NEX** (`bridge/ventas.mjs`) lo trata como cualquier lead con permiso, con tres diferencias para `origen = 'web'`: el saludo dice que pidió una cotización en misemago.com (no WhatsApp); la llamada va **en dos minutos** si es de 9 am a 8 pm en su zona (si no, 10 am del día siguiente); la zona sale del código de área de su teléfono (la «ciudad» es a dónde enviaría, no donde vive). Sigue todo lo demás: solo EE. UU., la IA nunca pone el número, un reintento, Meet en el calendario y avisos por llamada.
- **Nunca el nombre de Eduardo** en nada que oiga o reciba el lead: Ana Sofi dice «una videollamada con nuestro encargado de ventas»; el título y la descripción del evento tampoco lo nombran. Las notas internas del CRM tampoco.
- **«Instantáneo» depende de NEX:** revisa cada 3 minutos, así que la llamada suele salir entre 3 y 6 minutos después de enviar el formulario, solo mientras NEX esté prendido.

### Lo que hay que agregar a las instrucciones de Ana Sofi en ElevenLabs

Agent → Ana Sofi → **Agent** → **System prompt**, al final, y **Save**. (Los datos ya le llegan como variables; esto le dice que no los vuelva a preguntar.)

```
DATOS QUE YA TIENES
Antes de preguntar algo, revisa lo que ya sabes del cliente: negocio {{empresa}}, tipo de negocio {{tipo_negocio}}, quesos {{quesos}}, libras {{libras}}, marca propia {{marca_propia}}, correo {{correo}}.
- Si un dato NO es "-", no lo vuelvas a preguntar: confírmalo en una sola frase y sigue. Ejemplo: "Vi que te interesa el Oaxaca, unas 1,080 libras por semana con tu marca Don Chuy. ¿Es correcto?"
- Pregunta solo lo que falte (por ejemplo, cada cuánto compraría), califica, da los precios y ofrece la videollamada.
- Los clientes que llegan por la página misemago.com ya llenaron un formulario: ve directo a confirmar, precios y videollamada.

LA VIDEOLLAMADA
- Siempre di "una videollamada con nuestro encargado de ventas" ("a video call with our head of sales" en inglés). Nunca digas el nombre de nadie, ni "director", ni "dueño".
```
