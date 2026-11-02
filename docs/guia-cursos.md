# Videos del curso (Next Level IA)

Lecciones profesionales y breves (1920×1080), hechas completas por Claude: grabación de pantalla, voz, edición con 3D, subtítulos y música propia. Lalo aprueba el guion y recibe el video terminado.

## Dónde vive todo
- Código: `reels/cursos/` (guiones, grabación, voz, armado) y `reels/src/curso/` (la edición en Remotion).
- Grabaciones, voces y música: `reels/public/curso/<id>/` (no se suben a git).
- Video terminado: `reels/salida/curso/<id>/leccion-N.mp4`.
- Voz del curso: la de Lalo en ElevenLabs, voice ID en `reels/config.json` (`vozCurso`). La llave es un *network secret* del entorno (header `xi-api-key` para `api.elevenlabs.io`): el proxy la agrega a cada llamada y el código nunca la ve. Por eso `voz.mjs` llama con curl: `fetch` de Node no pasa por el proxy.

## Cómo se hace una lección
1. **Guion:** Claude lo escribe y Lalo lo aprueba. Va en `reels/cursos/leccion-N.json`: `tomas` (qué páginas grabar y cómo moverse) y `escenas` (texto de la voz, bloque, pantallas con la palabra que las hace entrar).
2. **Grabar:** `node cursos/grabar.mjs cursos/leccion-N.json` (retoma lo que falte; quita avisos de cookies; las páginas que se traban se cortan y se reemplazan por una captura `.png` con el mismo nombre).
3. **Voz:** `node cursos/voz.mjs cursos/leccion-N.json` (ElevenLabs, voz de Lalo).
4. **Revisar cuadros:** `node cursos/leccion.mjs cursos/leccion-N.json --cuadros`.
5. **Render:** `node cursos/leccion.mjs cursos/leccion-N.json --render` (en la nube, unos 2 minutos de video tardan entre 1 y 2 horas). La música se compone sola a la medida.
6. Subir a Drive y avisar.

## Estado
- **Lección 1 — Higgsfield: qué es y todo lo que puedes hacer.** Guion aprobado. Narración con la voz de Lalo (ElevenLabs) generada el 2 nov 2026; la versión con voz A quedó en `voz-a/`.
- Nombre del curso: *Next Level IA* (nombre de trabajo; Lalo no lo ha confirmado).
