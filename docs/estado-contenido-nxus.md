# Estado: contenido de NXUS (videos e imágenes) — para un chat dedicado

Última actualización: 15 nov 2026. Lee también `CLAUDE.md` (cómo trabajar con Eduardo).

## Qué es este chat
Hacer el contenido orgánico de NXUS AI: **videos** estilo "La máquina" con el personaje de Eduardo, **imágenes** para redes, y **mandarlo por Telegram** para que su equipo lo publique.

## El plan diario (decidido por Eduardo el 15 nov 2026)
- **Todos los días: un video y una imagen** de NXUS AI. Los temas los elige el chat, día con día (qué hace NXUS: `docs/estado-nxus.md`). Cómo deben ser las imágenes está **pendiente de definir con Eduardo**.
- Se suben a Drive "Videos listos NXUS" con la fecha al inicio del nombre (`2026-11-16-tema.mp4`, `.png`, y su `.txt`), y NEX los manda **directo** al grupo de su equipo a las **9:00 am, hora de Nueva York**. Sin aprobación previa: por eso la revisión del video terminado (abajo) es obligatoria antes de subir.
- **Créditos: máximo 250 al mes** (Higgsfield y Bloom juntos). La mayoría del trabajo se hace con código, que no gasta. Llevar la cuenta en `docs/creditos-contenido-nxus.md` y **avisarle a Eduardo si se van a acabar antes de los 30 días**. Dentro de ese tope ya no hay que pedir el "sí" cada vez.
- **Aprender**: cada vez que Eduardo mande contenido, ejemplos o pida revisar algo, anotar lo aprendido en `docs/aprendizajes-contenido-nxus.md` y aplicarlo. Leer ese archivo antes de hacer contenido.
- Pendiente: que el video y la imagen se generen solos cada día (tarea programada en la nube). Primero hay que definir las imágenes y hacer a mano el primer día completo para comprobar el camino.

## Reglas del contenido
- Enseñar fotos o vista previa antes de entregar o subir algo.
- Créditos (Higgsfield, Bloom): hay un tope de 250 al mes ya autorizado (ver "El plan diario"); anotar cada gasto. Lo que se hace con código (ffmpeg, HTML, Python) no gasta.
- No inventar estadísticas, clientes ni resultados. Los datos de ejemplo en pantallas de la app se presentan como ejemplo.
- No mencionar ciudades, colonias ni países en videos o imágenes (las zonas van en la segmentación de Meta).
- Llamada a la acción: "Agenda tu diagnóstico gratis de 30 minutos" (tarjeta "DIAGNÓSTICO GRATIS · 30 minutos · Cupos limitados este mes").
- **El nombre se dice "nexus ey ay"**: NXUS = "nexus" y AI deletreado en inglés ("ey ay"), todo junto. Nunca "nexus a-i" ni "nexus ái". En el texto para la voz se escribe **"Nexus ey ay"**; en pantalla va "NXUS AI". Eduardo lo corrigió el 16 nov: comprobarlo siempre antes de entregar (recortar el nombre y transcribirlo con whisper en inglés: debe oír "A.I.").
- Revisar el video TERMINADO antes de entregar: audio y video del mismo largo, transcribir el audio final con whisper, fotogramas de todo el video, volumen −16 a −14 LUFS.

## Marca NXUS
- Fondo negro/azul muy oscuro (#05070d, #0b0f1c), texto blanco.
- Degradado de marca: cian #00e5ff → azul #0a6cff → morado #a01cff. Palabra clave en cian.
- Letras: Sora (títulos), Inter (texto).
- Logo: el SVG "NX" de `ads/nxus-video/capa.html` (constante `LOGO`).
- Voz de los videos: Higgsfield `text2speech_v2` · variante `elevenlabs` · voz "Mark" `27c04473-84a9-4b60-a41f-c8e8458bd4f1` (2.1 créditos por 43 s), con signos de exclamación y pregunta en el texto para que tenga emoción. La voz hecha en el chat (Kokoro) no gasta, pero a Eduardo le sonó robótica (16 nov): no usarla para narrar.

## El personaje de Eduardo
- Pixel/voxel 3D, sudadera negra con detalles del degradado, fondo gris liso. Prompt para crear más poses: `ads/prompt-chatgpt-personaje-v1.txt` (ChatGPT + Higgsfield).
- De la imagen base de frente se hicieron con código: ojos cerrados (dormido y feliz), brazos sueltos que giran en el hombro y parpadeo. Ver `ads/maquina-video/LEEME.md`.
- Poses que mandó Eduardo el 15 nov, en `ads/personaje/` (1498×1998, fondo gris liso): `brazos-arriba` (festejo o estirarse), `caminando`, `acostado`, `cara-boca-cerrada` y `cara-boca-abierta` (acercamiento, para hablar alternándolas).
- Falta: sentado en la laptop. Pedírsela a Eduardo cuando haga falta.

## Videos
- Formato y análisis del ejemplo: `docs/estilo-maquina.md`.
- Primer video hecho y aprobado: **"El cliente de las 3 de la mañana"** (31 s, 9:16). Código para rehacer o hacer otros: `ads/maquina-video/` (`escena.html` con `window.render(t)`, `tomar.cjs` para cuadros a 30 fps, `musica.py` para la música original, y en `LEEME.md` cómo se mezcla).
- Habilidades generales de edición: `docs/habilidad-editor-video.md` y `docs/receta-edicion.md` (la receta de Eduardo).
- Segundo video (16 nov, pendiente de que Eduardo lo apruebe): **"Punto de venta para come todo"** (43.6 s, 9:16, 2.1 créditos). Código en `ads/pos-come-todo/`.
- Tercer video (18 nov, pendiente de que Eduardo lo apruebe): **"Mi mejor empleado no duerme"** (32.3 s, cámara que sigue a la IA, 1.65 créditos). Código en `ads/empleado-no-duerme/`.
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
1. El chat sube a la carpeta de Drive **"Videos listos NXUS"** (cuenta de NXUS, id `11gk8HOTJQm627CBWCIpRKunsrrvt_3rb`) **primero** el texto y **después** el video o imagen, con el mismo nombre y la fecha de envío al inicio: `2026-11-16-tema.txt` y `2026-11-16-tema.mp4`. El `.txt` lleva lo que el equipo necesita (copy, hashtags, red y hora) y se sube con `disableConversionToGoogleType: true` (si se convierte en Google Doc, NEX no lo puede leer). Un archivo por entrega: mp4, mov, m4v, jpg, png o webp.
2. NEX, mientras está prendida, revisa esa carpeta cada 30 segundos (la ve por la app Google Drive de la Mac). A las **9:00 am de Nueva York** del día que dice el nombre manda el archivo con su texto al grupo del equipo, y le avisa a Eduardo en su chat ("📤 Mandado al grupo…"). Si a las 9:00 NEX estaba apagada, lo manda en cuanto la prenda. Un archivo sin fecha en el nombre sale a las siguientes 9:00.
3. Lo mandado pasa a la subcarpeta `Enviados`.
4. El grupo es el chat del equipo donde Eduardo escribió `/grupovideos@nexy_nxus_bot`. El bot no obedece a nadie más en el grupo.
- Si Eduardo quiere volver a aprobar antes: `node scripts/entregas.mjs modo aprobar` (le llega primero a él con ✅ Mandar al equipo / ❌ No). Regresar: `modo directo`.
- Revisar: en Telegram `/entregas`; en la Mac `cd ~/Desktop/nexy && node scripts/entregas.mjs estado`. Si hay varias cuentas de Google Drive en la Mac: `node scripts/entregas.mjs carpeta correo`.
- Límites: solo con NEX prendida; videos de hasta 50 MB; si llega un video sin `.txt`, a los 2 minutos se toma sin texto.
