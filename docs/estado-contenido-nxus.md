# Estado: contenido de NXUS (videos e imágenes) — para un chat dedicado

Última actualización: 15 nov 2026. Lee también `CLAUDE.md` (cómo trabajar con Eduardo).

## Qué es este chat
Hacer el contenido orgánico de NXUS AI: **videos** estilo "La máquina" con el personaje de Eduardo, **imágenes** para redes, y **mandarlo por Telegram** para que su equipo lo publique.

## Reglas del contenido
- Enseñar fotos o vista previa antes de entregar o subir algo.
- Antes de gastar créditos (Higgsfield, Bloom), decir cuánto cuesta y esperar el "sí". Lo que se hace con código (ffmpeg, HTML, Python) no gasta.
- No inventar estadísticas, clientes ni resultados. Los datos de ejemplo en pantallas de la app se presentan como ejemplo.
- No mencionar ciudades, colonias ni países en videos o imágenes (las zonas van en la segmentación de Meta).
- Llamada a la acción: "Agenda tu diagnóstico gratis de 30 minutos" (tarjeta "DIAGNÓSTICO GRATIS · 30 minutos · Cupos limitados este mes").
- Al hablar: escribir "Nexus AI" para que la voz lo pronuncie bien; en pantalla va "NXUS AI".
- Revisar el video TERMINADO antes de entregar: audio y video del mismo largo, transcribir el audio final con whisper, fotogramas de todo el video, volumen −16 a −14 LUFS.

## Marca NXUS
- Fondo negro/azul muy oscuro (#05070d, #0b0f1c), texto blanco.
- Degradado de marca: cian #00e5ff → azul #0a6cff → morado #a01cff. Palabra clave en cian.
- Letras: Sora (títulos), Inter (texto).
- Logo: el SVG "NX" de `ads/nxus-video/capa.html` (constante `LOGO`).
- Voz de los videos: Higgsfield `text2speech_v2` · variante ElevenLabs · voz "Mark" `27c04473-84a9-4b60-a41f-c8e8458bd4f1` (unos 1.5 créditos por 30 s).

## El personaje de Eduardo
- Pixel/voxel 3D, sudadera negra con detalles del degradado, fondo gris liso. Prompt para crear más poses: `ads/prompt-chatgpt-personaje-v1.txt` (ChatGPT + Higgsfield).
- Hoy solo existe la imagen base de frente. Con código se le hicieron: ojos cerrados (dormido y feliz), brazos sueltos que giran en el hombro y parpadeo. Ver `ads/maquina-video/LEEME.md`.
- Faltan poses (acostado, estirándose, sentado en laptop, caminando, boca abierta y cerrada para hablar). Pedírselas a Eduardo cuando haga falta.

## Videos
- Formato y análisis del ejemplo: `docs/estilo-maquina.md`.
- Primer video hecho y aprobado: **"El cliente de las 3 de la mañana"** (31 s, 9:16). Código para rehacer o hacer otros: `ads/maquina-video/` (`escena.html` con `window.render(t)`, `tomar.cjs` para cuadros a 30 fps, `musica.py` para la música original, y en `LEEME.md` cómo se mezcla).
- Habilidades generales de edición: `docs/habilidad-editor-video.md` y `docs/receta-edicion.md` (la receta de Eduardo).
- Ideas pendientes:
  2. "Cuánto dinero pierdes por no contestar".
  3. "Mi empleado que no duerme" (un día corrido con el reloj).
  4. Caso real de un distribuidor de comida (solo con permiso del cliente).

## Imágenes
- Conectores: **Higgsfield** (`generate_image`, varios modelos; también videos, voz, música, TikTok) y **Bloom / Rainbrand** (guarda la marca: logo, colores, letras y guía, y genera imágenes y videos con ella).
- Primer paso sugerido: revisar si NXUS ya está como marca en Bloom (`list_brands`); si no, darla de alta con los valores de arriba para que todas las imágenes salgan con la marca.

## Publicar
- Hoy Eduardo publica y programa en **Meta Business Suite** (Instagram y Facebook), con ayuda de Claude in Chrome. HQ ya no publica (se quitó el 1 nov).
- **TikTok:** Higgsfield puede publicar directo cuando Eduardo conecte su cuenta (`tiktok_connect`).

## Mandar los videos e imágenes por Telegram al equipo (construido el 15 nov 2026; falta probarlo en la Mac de Eduardo)
Código: `bridge/entregas.mjs` (lo conecta `bridge/telegram.mjs`) y `scripts/entregas.mjs`. Es solo NEX: no toca el cerebro del cliente.

Cómo funciona:
1. El chat sube a la carpeta de Drive **"Videos listos NXUS"** (cuenta de NXUS, id `11gk8HOTJQm627CBWCIpRKunsrrvt_3rb`) **primero** el texto y **después** el video o imagen, con el mismo nombre: `cliente-3am.txt` y `cliente-3am.mp4`. El `.txt` lleva lo que el equipo necesita (copy, hashtags, red y hora) y se sube con `disableConversionToGoogleType: true` (si se convierte en Google Doc, NEX no lo puede leer). Un archivo por entrega: mp4, mov, m4v, jpg, png o webp.
2. NEX, mientras está prendida, revisa esa carpeta cada 30 segundos (la ve por la app Google Drive de la Mac) y le manda a Eduardo, en su chat con @nexy_nxus_bot, el archivo y el texto con dos botones: **✅ Mandar al equipo** / **❌ No**.
3. Solo con su ✅ se manda al grupo del equipo. Con ❌ no sale nada. Lo mandado pasa a la subcarpeta `Enviados` y lo rechazado a `No enviados`.
4. El grupo es donde Eduardo escribió `/grupovideos@nexy_nxus_bot`. El bot no obedece a nadie más en el grupo.
- Para corregir un video rechazado: subir la versión nueva (otro nombre o el mismo); llega como entrega nueva.
- Revisar: en Telegram `/entregas`; en la Mac `cd ~/Desktop/nexy && node scripts/entregas.mjs estado`. Si hay varias cuentas de Google Drive en la Mac: `node scripts/entregas.mjs carpeta correo`.
- Límites: solo con NEX prendida (si no, espera en Drive); videos de hasta 50 MB; si llega un video sin `.txt`, a los 2 minutos se ofrece sin texto.
