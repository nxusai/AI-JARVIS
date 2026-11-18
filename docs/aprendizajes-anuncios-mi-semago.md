# Aprendizajes de los anuncios de Mi Semago (memoria del asesor de anuncios)

La memoria de lo que funciona y lo que no en los anuncios de Mi Semago (quesos hispanos, marca propia y volumen para distribuidores; Click-to-WhatsApp → ManyChat → Centro de trabajo → Ana Sofi → Meet). Se lee ANTES de proponer un anuncio, un gancho o un cambio de campaña, y se actualiza DESPUÉS de cada revisión semanal. Cada aprendizaje lleva fecha y de dónde salió. Lo que falla también se anota. Sin datos personales de leads. Sin números inventados: si un dato falta, se dice.

Lo mismo se ve en el Centro de trabajo → **Anuncios** → 📚 Aprendizajes (solo el creador del sistema; tabla `anuncios_aprendizajes`). Cómo está armado el sistema: `docs/crm-para-ads-mi-semago.md` (sección 10) y `docs/sistema-aprendizaje-anuncios.md`.

## Reglas confirmadas
- **6 nov 2026 · Público con límites fijos, sin Advantage+** (lección de NXUS: $210 USD y 0 personas reales). Campaña manual, presupuesto en el conjunto con tope, edad fija 30–65, sin intereses, códigos postales, ubicaciones manuales, mejoras de Advantage+ creative apagadas.
- **6 nov 2026 · ManyChat con frase exacta, nunca "contiene"** (lección de NXUS). Un mensaje prellenado distinto por anuncio; "Message is" con variantes sin punto y sin acentos.
- **9 nov 2026 · Se juzga por leads buenos y Meets**, no por costo por mensaje. 7 días sin tocar.

## Rondas
### Ronda 1 · Distribuidores Oeste (9–16 nov 2026) — FALTAN LOS NÚMEROS
"Mi Semago · Distribuidores Oeste · WhatsApp · Prueba 7 días": $25/día, tope $175. Anuncios (así salen en el panel): **R1-A** Capacidad 500k lb · **R1-B** Tu marca · **R1-C** Logística 40°F · **R1-D** Carrusel planta real. Fuente en ManyChat: "Anuncio · Capacidad", "Anuncio · Tu marca", "Anuncio · Logística", "Anuncio · Carrusel".
Pendiente: cierre con gasto, chats, leads, leads buenos y Meets por anuncio (al conectar la llave de Meta: foto del 9 al 16 nov).

## Hipótesis por probar
Salen del informe de competencia del 18 nov 2026. Son interpretación del asesor, no datos: se confirman o se descartan con leads buenos y Meets.
- **¿Un video corto de la planta trae más leads buenos que la imagen?** La ronda 1 fue solo imágenes y carrusel; los que le venden comida a negocios usan video (10–56 s) e imagen casi por igual. Prueba: cada idea de la ronda 2 en video de 10–20 s y en imagen.
- **¿Decir "planta registrada ante la FDA" y la capacidad nos distingue?** Nadie menciona certificaciones, envío refrigerado ni capacidad. Puede ser un hueco o puede no importarle al comprador. Falta ver los números de "Capacidad" y "Logística" de la ronda 1.
- **¿Un primer paso más fácil (catálogo o muestra) sube los leads buenos?** Los anuncios más viejos bajan la barrera (muestra gratis, "desde 1 lb", catálogo por WhatsApp). Nosotros abrimos con mínimo de 1,500 lb. **Decidido el 18 nov 2026 (Eduardo): Mi Semago SÍ manda muestras a distribuidores.** Falta definir las condiciones para poder decirlo en el anuncio (si son gratis, quién paga el envío refrigerado, a qué zonas y a quién se le mandan).
- **¿Explicar la marca propia en pasos convierte mejor que solo "tu marca"?** Referencia: Botanas Blofis, "diseñamos, fabricamos, empacamos y pegamos las etiquetas", prendido desde el 14 jun.
- **¿Una versión en inglés alcanza distribuidores que hoy no vemos?** Los anuncios para distribuidores y cadenas en EE. UU. van casi todos en inglés. Como anuncio aparte, con su propia fuente.

## Competencia y Meta
### Biblioteca de Anuncios · 18 nov 2026 (informe completo: `docs/ads/mi-semago-competencia/informe-2026-11-18.md`)
- **Ninguna quesera le anuncia a negocios.** LALA USA (~70), V&V Supremo (~33), Los Altos (~33) y El Abuelito (1) le hablan solo al consumidor. Sin anuncios activos: Cacique, Tropical, La Vaquita, La Chona, Nuestro Queso, Queso Campesino, FUD USA, Karoun y otras. Ningún anuncio de marca propia o maquila de queso en EE. UU. ni en México.
- **Botón:** WhatsApp es el más usado entre los que le venden comida a negocios; luego formulario/cotización, web y Messenger. Nadie usa "Call now" ni "escribe esta palabra".
- **Formato:** video e imagen casi parejo (17 y 15); videos de 0:10 a 0:56; carrusel casi no hay.
- **Ganchos que llevan más de 30 días:** nombran al comprador y lo que vende o busca ("Si vendes carne seca esto te interesa!!!", "¿Buscas proveedor para tu negocio?", "Maicitos con tu propia marca", "Un pedido. Toda tu ruta.", "Looking for high-demand, high-margin sauces for your US distribution network or restaurant chain?").
- **Ofertas que se repiten:** envío, mínimo bajo para empezar, descuento por volumen, "un solo proveedor".
- **Lo que nadie dice:** certificaciones o planta registrada, pedido mínimo en libras, envío refrigerado, capacidad. Casi nadie publica precio.
- **Límites:** la Biblioteca no muestra gasto ni resultados; ⭐ solo indica tiempo prendido; no se reprodujeron los videos.

## Nombres desde la ronda 2
- Campaña: `MI SEMAGO | OESTE | R2 | WhatsApp`. Anuncio: `OESTE | A | Tu marca` (mercado | letra | de qué trata).
- Fuente en ManyChat (campo MS Fuente): `Anuncio OESTE R2 · Video A` (también "Imagen A" o "Carrusel A").
- Las letras se repiten cada ronda; la ronda (R#) las distingue. En la foto semanal se guarda como "R2-A".

## Cómo se actualiza
1. Cada lunes la foto semanal se guarda sola (`anuncios_semanas`) y el reporte automático escribe "Semana del…" aquí y en el panel. Solo recomienda: nunca cambia campañas.
2. Antes de cada ronda: leer este archivo y los números, investigar cambios de Meta, revisar la competencia con la extensión, y armar 3 ideas por problema × (video + imagen).
3. Al apagar un anuncio queda en Historial con sus números; aquí se anota por qué se apagó y qué se aprendió.
