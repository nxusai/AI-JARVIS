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
5. **Render:** `node cursos/leccion.mjs cursos/leccion-N.json --render`. Va por partes: lo que tiene 3D con swangle y el resto con egl (4 veces más rápido); el audio se mezcla con ffmpeg. Un video de 1 minuto tarda unos 12 minutos. La música se compone sola a la medida.
6. Subir a Drive y avisar.

## Reglas de Lalo para todas las lecciones
- Breves y directas: máximo 2 minutos (mejor menos), sin huecos.
- Si generar un ejemplo tarda mucho (videos), solo se enseña el camino; las imágenes y voces sí se generan (segundos).
- Si aparece su correo o contenido suyo, va borroso. Los avisos emergentes no importan.
- Edición con efectos, pero que el render sea rápido (nada de desenfoques en vivo).

## Estado
- **Lección 1 — Higgsfield: qué es y todo lo que puedes hacer.** Guion aprobado. Narración con la voz de Lalo (ElevenLabs) generada el 2 nov 2026; la versión con voz A quedó en `voz-a/`.
- **Lección 2 — Crear** (1:08): aprobada.
- **Lección 3 — Dirigir** (1:10): Cinema Studio, Effects y Genjutsu, solo el camino (sin generar videos).
- **Lección 4 — Vender** (1:12): Marketing Studio, Ads Studio (captura), AI Influencer y Content Factory.
- **Lección 5 — Editar** (0:46): Image Edit y plugins (Premiere, After Effects, Photoshop).
- **Lección 6 — Automatizar** (1:04): Supercomputer (captura), Canvas y MCP (grabación de la lección 1). Cierra la serie de Higgsfield.
- Módulo 2 (Claude): 2.1 Tu equipo de trabajo (claude.com en español); 2.2 Investigar a un cliente; 2.3 La propuesta en 5 minutos; 2.4 Proyectos y Skills; 2.5 Conectores en acción; 2.6 Construir con Claude Code. claude.ai bloquea al navegador de la nube, así que lo que pasa dentro de Claude se enseña con tarjetas de pasos y de chat (`resultado: "chat"`, respuestas reales escritas por Claude). Ejemplo: Cafetería Aurora (ficticia); su página está en `reels/cursos/ejemplos/aurora/`.
- Módulo 3 (Agentes que atienden, ManyChat): 3.1 Qué es un agente; 3.2 Conectar Instagram; 3.3 Comenta y recibe; 3.4 El agente con IA; 3.5 Del chat a tu sistema y cómo cobrarlo. manychat.com bloquea a navegadores automáticos (no se esquiva), así que se enseña con tarjetas de pasos, el teléfono (`resultado: "telefono"`) y el diagrama (`resultado: "flujo"`).
- Regla nueva de Lalo: cada lección enseña a usar la función (dónde dar clic y qué escribir), breve y directa. Nada de correos ni información sensible; trabajos reales de Lalo se sustituyen por ejemplos o van borrosos.
- Módulo 4 (Agentes que llaman, ElevenLabs): 4.1 Qué hace (con una llamada de ejemplo real hecha con voces de la biblioteca de ElevenLabs: Angélica como agente y Abel como cliente); 4.2 Crear el agente; 4.3 El guion; 4.4 Número y llamadas en lote; 4.5 Resultados, reglas (permiso previo, decir que es asistente virtual) y cobro. elevenlabs.io sí se puede grabar; las tomas compartidas están en `cursos/m4-tomas.json`.
- Ojo con el disco: cada render empaqueta todo public/ (casi 1 GB); `fabrica/render.mjs` ya borra ese paquete al terminar.
- Estructura del curso: 0 Bienvenida (la graba Lalo), 1 Higgsfield ✅, 2 Claude, 3 Agentes que atienden (ManyChat), 4 Agentes que llaman (ElevenLabs), 5 Webs, portales y sistemas, 6 Servicios y precios, 7 Conseguir clientes, 8 Cerrar el contrato, 9 Entregar y retener, Bonus.
- Nombre del curso: *Next Level IA* (nombre de trabajo; Lalo no lo ha confirmado).
