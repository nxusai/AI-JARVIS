# Aprendizajes de los anuncios de NXUS AI (memoria del asesor de anuncios)

Este archivo es la memoria de lo que funciona y lo que no en los anuncios de NXUS. Se lee ANTES de proponer un anuncio, un video, un gancho o un cambio de campaña, y se actualiza DESPUÉS de cada revisión semanal (reporte del lunes + panel "📈 Anuncios" de HQ). Cada aprendizaje lleva fecha y de dónde salió. Lo que se prueba y falla también se anota, para no repetirlo.

## Reglas confirmadas (con datos propios)
- **6 nov 2026 · Diagnóstico de los anuncios viejos:** público Advantage+ abierto desde 18 años + radios de 10 millas + saludo de Meta en inglés sin botones = 0 personas reales en $210 USD; solo respuestas automáticas de otros negocios. → Público con límites fijos (zonas chicas, 30+), saludo de ManyChat con botones, cero mejoras automáticas.
- **6 nov 2026 · ManyChat:** la regla "contiene INFO" disparaba el bot con "información" de robots. → Siempre "Message is" (palabra exacta) y botones.
- **9 nov 2026 · Primer lead real:** llegó por Messenger desde **Anuncio MX · Video C** ("¿Tienes un restaurante con varias sucursales?"). Fue un técnico dental con 2 sucursales (no restaurantero): el gancho de "varias sucursales" atrae negocios multi-sucursal de otros giros. Agendó Meet en la llamada de NEX a las 3 a.m.
- **9 nov 2026 · Llamada de NEX:** el guion largo (6 preguntas, presupuesto, tuteo) sonaba a formulario. → Máx. 3 preguntas, sin presupuesto, "usted", saludo corto.

## Hipótesis por probar (pendiente de datos)
- ¿Video A (11:48, celular de noche) tiene mejor gancho que B y C? Ver "Gancho (3 s)" en el panel a los 7 y 14 días.
- ¿Instagram trae más personas reales que Facebook, aunque el chat abra en Messenger? Ver el desglose por ubicación del reporte semanal.
- ¿NY (zonas hispanas, idioma español) cuesta más por cita que MX? Comparar en el panel con el filtro de campaña.
- ¿Un video de Eduardo a cámara baja el costo por cita frente a los videos con voz de IA?

## Ronda 2 · corte del 17 nov 2026 (campañas v2 desde el 8 nov, datos de HQ + Meta)
Fuente: `anuncios-reporte` (Meta del 1 al 17 nov + embudo de HQ). Foto de la semana 9–15 nov guardada en `anuncios_semanas`.

| Anuncio | Gastado | Impresiones | CPM aprox. | Gancho 3 s | Lo terminan* | Chats | Leads HQ | Reales | Citas | Meet |
|---|---|---|---|---|---|---|---|---|---|---|
| MX A · 11:48 | $65.11 | 7,957 | $8 | 15.2% | 14.4% | 4 | 0 | 0 | 0 | 0 |
| MX B · Empleado | $82.56 | 6,592 | $13 | 17.9% | 19.8% | 1 | 0 | 0 | 0 | 0 |
| MX C · Sucursales | $51.75 | 4,097 | $13 | 14.3% | 15.1% | 2 | 1 | 1 | 1 | 1 |
| NY A · 11:48 | $60.74 | 766 | $79 | 23.0% | 33.0% | 2 | 1 | 0 | 0 | 0 |
| NY B · Empleado | $87.02 | 978 | $89 | 26.9% | 27.8% | 3 | 0 | 0 | 0 | 0 |
| NY C · Sucursales | $68.96 | 1,081 | $64 | 17.8% | 25.5% | 1 | 0 | 0 | 0 | 0 |
*Lo terminan = thruplays / vistas de 3 s.

- **MX: $199.42 → 1 cita que llegó al Meet (propuesta enviada).** Única cita de la ronda; vino de MX C (Sucursales) con el menor gasto de MX. MX B gastó más ($82.56) con 1 chat: el peor.
- **NY: $216.72 → 0 personas reales.** El gancho de NY es el mejor (23–27 %) pero cada mil impresiones cuesta $64–89 (MX: $8–13). El público de NY (códigos postales + idioma español) es tan chico que Meta casi no encuentra a quién mostrarlo. **Lección: en NY el problema es el público, no el video.**
- **De chat a HQ se pierde casi todo:** 13 chats en Meta → 2 leads en HQ. 11 conversaciones no tocaron el primer botón (robots o personas que no siguen). Revisar en ManyChat cuántos tienen la etiqueta robot-autorespuesta antes de cambiar el saludo.
- Hipótesis "Video A tiene mejor gancho": ❌ en MX fue el más bajo (15.2 %); en NY fue el 2.º.
- Tope de $300 por campaña: MX va en ~$199 y NY en ~$217 → se detienen solas alrededor del 21–23 nov.
- RECOMENDACIÓN para la ronda 3: (1) concentrar el dinero en MX; (2) NY no repetir igual: público más amplio (área metro NY/NJ completa, sin códigos postales sueltos) o pausar NY hasta tener ganador en MX; (3) mantener la idea "Sucursales" y probar "Pruébelo en vivo" y "Todo en uno"; (4) revisar el primer mensaje de ManyChat (11 de 13 chats no avanzaron).

## Anuncio de octubre que trajo al primer cliente de México (analizado el 17 nov 2026)
"¿Sabes dónde está tu repartidor AHORA?" · cuenta Eduardo's · campaña "[12/10/2026] Promoción de…" · 12–16 oct · lo hizo una socia de NXUS México.
- Video vertical de 10 s, animación collage (morado/azul, sin personas), pregunta grande en pantalla desde el segundo 0; texto sobre rastrear repartidores y entregas; botón Send message a Messenger.
- $120.55 · 67,997 impresiones · CPM $1.77 · 27 conversaciones a $4.46 · gancho 34 % · 16 % lo ve completo · 78 % hombres (35–44 el grupo mayor).
- Resultado: 2–3 personas reales y 1 cliente: Nexus Capital MX (financiera con asesores de ruta). Contexto del cliente: `docs/cliente-nexus-capital-ads.md`.
- Lecciones: (1) los clientes grandes llegan por problemas de OPERACIÓN (equipo en la calle, rutas, sucursales, control), no por "chatbot"; (2) video corto con la pregunta grande desde el segundo 0 (34 % de gancho vs 14–27 % en la ronda 1); (3) FB Reels el más barato ($1.45 por conversación), reel in-stream el más caro ($9.16, 38 % del gasto) → ubicaciones manuales sin in-stream; (4) hipótesis: con el filtro de botones se puede abrir el público a CDMX + Edomex completos para bajar el costo.
- Ojo: ese anuncio tiene "Unpublished edits" (un borrador ligado al flujo "Anuncio NY · Video C · FB"). No publicarlo.

## Ronda 1 · cierre (pausada el 18 nov 2026; datos 8–17 nov, foto en HQ)
- Total $428.41 · 21,519 impresiones · 13 chats · 2 leads · 1 real · 1 cita (llegó al Meet) · 0 clientes por ahora.
- MX $205.46: A (11:48) $68.74, 4 chats, 0 reales · B (Empleado) $84.15, 1 chat, 0 reales · C (Sucursales) $52.57, 2 chats, 1 real, 1 cita.
- NY $222.95: A $61.97 · B $88.16 · C $72.82 · 6 chats · 0 reales (público demasiado chico, CPM $64–89).
- Ronda 2 (18 nov): `NXUS | MX | R2 | Mensajes`, solo México, CDMX + Edomex 30+, FB Feed/Stories/Reels + IG Stories/Reels (sin IG Feed: los videos 9:16 no entran), 6 anuncios A–F, $20/día, tope $300.

## Cómo se actualiza
0. Antes de proponer anuncios leer también `docs/estrategia-ads-nxus-v3.md` (reglas de Meta para prometer, competencia, plan vigente). Cada ronda: volver a investigar cambios de Meta (algoritmo y políticas) y a la competencia (`ads/prompt-chrome-competencia.txt`) y anotar aquí lo nuevo con fecha.
1. Cada lunes: reporte de la extensión (`ads/prompt-chrome-reporte-semanal.txt`) + foto del panel.
2. El asesor compara contra este archivo, decide (apagar, subir presupuesto, cambiar gancho) y anota aquí el resultado con fecha.
3. Cuando un video se apaga, queda en "Historial" del panel con sus números; aquí se anota por qué se apagó y qué se aprendió.

## Corte 9 nov 2026 (campañas v2 con ~2 días al aire)
- $117.78 · 7,787 impresiones · gancho 16.9% · 5 chats ($23.56) · 1 real · 1 cita ($117.78). La cita (MX Video C, "varias sucursales") es el lead que pasó a propuesta de precios y contrato: si firma, la campaña ya se pagó varias veces.
- NY: más gancho (Video B 26% / 32% lo termina) pero 3 chats y 0 reales → revisar en ManyChat si son robots o personas que no tocan el botón antes de cambiar nada.
- Cuello de botella: de vista a chat (0.06%). Hipótesis a probar después del día 7: CTA más directo en el texto y al final del video.
- Regla: no juzgar un video con menos de ~$40–60 gastados ni antes de 7 días.
