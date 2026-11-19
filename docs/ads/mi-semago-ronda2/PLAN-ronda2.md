# Mi Semago · Ronda 2 (plan y creativos, 19 nov 2026) — PENDIENTE DE APROBAR

Sale de: cierre de la ronda 1, diagnóstico de ManyChat, informe de competencia y revisión de Meta (`docs/aprendizajes-anuncios-mi-semago.md`). Nada está publicado.

## Por qué estas tres ideas
1. **Planta y capacidad** — en la ronda 1 los dos distribuidores de verdad llegaron por los anuncios que enseñan la planta. Nadie en la competencia habla de planta registrada ante la FDA ni de volumen.
2. **Tu marca, para distribuidores** — "Tu marca" trajo muchos chats pero el único con el que se habló era una tienda de 50 lb. Ahora nombra al distribuidor, explica los pasos y dice el mínimo.
3. **Muestra gratis para distribuidores que califiquen** — la oferta más fuerte que se vio en la competencia. Gratis con envío incluido, a todo EE. UU., solo después de que Ana Sofi lo calificó (decisión de Eduardo, 18 nov).

Cada idea va en video (12 s, 4:5, con texto en pantalla, sin audio) e imagen (4:5). Material real: los videos `planta.mp4` e `hilado.mp4` y las fotos de misemago.com. Formato 4:5 (1080×1350) para que entre en Feed, Stories y Reels sin el problema del 9:16 en Instagram Feed.

## Estructura
- Campaña: `MI SEMAGO | OESTE | R2 | WhatsApp` · manual · Engagement → WhatsApp (+1 484-969-8507).
- 1 conjunto: `OESTE | 30-65 | Códigos postales` · mismo público de la ronda 1 (38 códigos postales, 30–65 fijo, sin intereses, solo Facebook e Instagram en Feed, Stories y Reels).
- Presupuesto: **$20 al día, 15 días, tope de la campaña $300** (decisión de Eduardo: $300 al mes).
- Para que Meta sí pruebe todos: usar la prueba de creativos de Ads Manager si la cuenta la tiene; si no, lanzar 4 anuncios (A, B, C, E) y dejar D y F de reserva.
- Todas las mejoras de Advantage+ creative apagadas, una por una.

## Los 6 anuncios
| Letra | Nombre en Meta | Archivo | Mensaje prellenado (único) | MS Fuente en ManyChat |
|---|---|---|---|---|
| A | `OESTE \| A \| Planta · video` | OESTE-R2-A-planta-video.mp4 | Hola, vi su planta y quiero precios de queso. | Anuncio OESTE R2 · Video A |
| B | `OESTE \| B \| Planta · imagen` | OESTE-R2-B-planta-imagen.jpg | Hola, quiero precios de queso por volumen. | Anuncio OESTE R2 · Imagen B |
| C | `OESTE \| C \| Tu marca · video` | OESTE-R2-C-tu-marca-video.mp4 | Hola, quiero hacer mi propia marca de queso. | Anuncio OESTE R2 · Video C |
| D | `OESTE \| D \| Tu marca · imagen` | OESTE-R2-D-tu-marca-imagen.jpg | Hola, quiero precios para mi marca de queso. | Anuncio OESTE R2 · Imagen D |
| E | `OESTE \| E \| Muestra · video` | OESTE-R2-E-muestra-video.mp4 | Hola, quiero pedir una muestra de queso. | Anuncio OESTE R2 · Video E |
| F | `OESTE \| F \| Muestra · imagen` | OESTE-R2-F-muestra-imagen.jpg | Hola, me interesa la muestra para distribuidores. | Anuncio OESTE R2 · Imagen F |

En ManyChat cada entrada usa la regla **"message begins with"** con su frase SIN el punto final (así arranca aunque la persona le agregue su ciudad) y manda al flujo **"Mi Semago · Chat corto v2 (ronda 2)"**.

## Textos
**Planta (A y B)**
- Texto: ¿Distribuyes queso hispano a tiendas, supermercados o restaurantes? Producimos 500,000 libras por semana en nuestra planta registrada ante la FDA en Paterson, NJ: Oaxaca, fresco, panela, canastón y más de 16 presentaciones, con tu marca o con la nuestra. Envío refrigerado hasta tu almacén en todo Estados Unidos. Pedido mínimo: 1,500 libras. Escríbenos por WhatsApp y te mandamos el catálogo.
- Título: 500,000 lb de queso por semana
- Descripción: Planta registrada ante la FDA

**Tu marca (C y D)**
- Texto: ¿Tu distribuidora quiere vender queso con su propia marca? Nosotros lo producimos: receta, etiqueta, empaque y envío refrigerado hasta tu almacén. Oaxaca, fresco, panela, canastón y más, desde nuestra planta registrada ante la FDA en Paterson, NJ. Pedido mínimo: 1,500 libras. Escríbenos por WhatsApp y te mandamos el catálogo.
- Título: Tu marca. Nuestro queso.
- Descripción: Desde 1,500 lb por pedido

**Muestra (E y F)**
- Texto: ¿Distribuyes queso hispano? Pruébalo antes de comprar. Mandamos una muestra gratis, con envío incluido a todo Estados Unidos, a distribuidores que califiquen. Escríbenos por WhatsApp, cuéntanos de tu negocio y te decimos si aplica. Oaxaca, fresco, panela y más, hechos en nuestra planta registrada ante la FDA en Paterson, NJ.
- Título: Muestra gratis para distribuidores
- Descripción: Para distribuidores que califiquen

Reglas de Meta que cumplen: preguntan por el negocio (no afirman nada de la persona), prometen lo que se entrega (no resultados), sin urgencia, y la muestra lleva su condición real.

## Antes de publicar (pendiente)
1. Eduardo aprueba creativos y textos.
2. Terminar la prueba del chat v2 (falta "Ahora no" → LLAMADA y ver el lead en el Centro de trabajo).
3. Si se lanzan E y F: Ana Sofi debe saber la regla de la muestra (gratis, envío incluido, todo EE. UU., solo a quien ella calificó bien). Es cambio en el cerebro.
4. ManyChat: crear las 6 entradas "MS Ads R2 · …" (prompt para la extensión).
5. Meta: armar la campaña en borrador (prompt para la extensión), revisar con `anuncios-reporte?estados=1` y publicar solo con la autorización clara de Eduardo.

## Cómo se rehacen los creativos
`taller/plantilla.cjs` dibuja los paneles con la tipografía y colores del sitio (Fraunces + Manrope, azul #061a38, dorado #c19a32) a partir de `taller/piezas.json`; los videos se arman con ffmpeg (recorte 960×720 del video del sitio → 1080×810 arriba, panel abajo, 4 escenas de 3 s). Los videos finales no se guardan en el repo por su peso: están en el chat de anuncios y en Drive ("Mi Semago · Contenido para anuncios / Ronda 2 · anuncios listos").
