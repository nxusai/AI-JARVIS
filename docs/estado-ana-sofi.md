# Estado: Ana Sofi y la línea de ventas de Mi Semago

Última actualización: 2 de noviembre de 2026. Para retomar en un chat nuevo dedicado a este tema.
Lee también `docs/estado-nxus.md` (cómo trabajar con Eduardo y el panorama general).

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

## Pendiente
Eduardo va a explicar qué quiere cambiar, mejorar o agregar. Escuchar primero, opinar y recomendar, y esperar su luz verde antes de construir.
