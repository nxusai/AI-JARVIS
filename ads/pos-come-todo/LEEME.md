# Video "Punto de venta para come todo" (NXUS, 16 nov 2026)

43.6 s, 9:16, 2.1 créditos (solo la voz); lo demás se hizo en el chat con código. Mismo formato que `ads/maquina-video/` (una página con `window.render(t)` y cuadros a 30 fps).

Cómo se rehace, en una carpeta de trabajo con estos archivos:
1. Taller: `python3 -m venv venv && venv/bin/pip install faster-whisper soundfile numpy scipy pillow kokoro-onnx`, y en `modelos/` los archivos `kokoro-v1.0.onnx` y `voices-v1.0.bin` de `https://huggingface.co/fastrtc/kokoro-onnx/resolve/main/`.
2. `venv/bin/python recorte.py` → quita el fondo gris de las poses de `ads/personaje/` (`pj_*.png`).
3. `venv/bin/python voz.py` → **la voz se hace aquí** (Kokoro, voz `em_alex`, velocidad 1.06), una frase a la vez con 0.16 s entre frases para que no haya huecos. Deja `voz.wav`, `frases.json` y `palabras.json` (tiempo por palabra con whisper). "Nexus AI" se escribe así para que lo pronuncie bien.
4. `node tomar.cjs fotos 3 12 20 …` para fotos de prueba; `node tomar.cjs video 0 40.7` para los cuadros (acepta un tramo: `video 16.2 21.3`).
5. `venv/bin/python musica.py` → música original; los golpes caen en los cambios de escena (lee `frases.json`).
6. Mezcla aparte (voz con `loudnorm` a −15, música a 0.2 con `sidechaincompress`) y luego se une con los cuadros. Quedó en −14.3 LUFS.
7. `oir.py archivo` transcribe para revisar (pasa el audio a whisper como arreglo, porque en este contenedor falla al abrir archivos).

Qué tiene: tu cara que habla (alterna `cara-boca-cerrada` y `cara-boca-abierta` con cada palabra), 10 escenas que entran mientras la anterior sale (sin cortes a negro), barrido de luz en cada cambio, subtítulos palabra a palabra y final que regresa a la primera imagen para el loop.

Los montos ($349, $1,396, $812, +$584, −$63) son de ejemplo y en pantalla dice "ejemplo". No se nombra a ningún competidor (ver `docs/investigacion-pos-come-todo.md`).

## Versión 2 (16 nov): voz con emoción y el nombre bien dicho
- Eduardo pidió corregir el nombre (**"nexus ey ay"**) y una voz con expresión. La voz ahora es Mark de Higgsfield (`text2speech_v2`, `elevenlabs`), con el texto del guion de `voz2.py` pero escribiendo "Nexus ey ay" y con exclamaciones. El paso 3 de arriba (Kokoro) ya no se usa para narrar.
- `voz2.py` toma ese audio (`mark.mp3`), recorta los silencios de más de 0.2 s, y alinea cada palabra del guion con lo que oye whisper (`frases.json`, `palabras.json`).
- El largo cambia con la voz: poner el mismo `T` en `tomar.cjs` (`T_FIN`) y en `musica.py`.
