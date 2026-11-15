# Video estilo "La máquina": "El cliente de las 3 de la mañana" (NXUS, 15 nov 2026)

Formato en `docs/estilo-maquina.md`. Personaje: pixel/voxel de Eduardo (imagen base, fondo gris liso).

Cómo se armó (en una carpeta de trabajo, con `pj.png`, `pj_dormido.png`, `pj_feliz.png`, `logo.js`, `voz.mp3` y `palabras.json`):
1. Personaje: recorte del fondo gris (umbral + mayor componente). Ojos cerrados pintando las cajas de los ojos con el tono de la cara de su misma fila y una línea pixelada (abajo = dormido, arriba = feliz).
2. Voz: Higgsfield `text2speech_v2` · ElevenLabs · voz Mark (`27c04473-84a9-4b60-a41f-c8e8458bd4f1`), "Nexus AI" escrito así para que se pronuncie bien (en pantalla dice NXUS). 1.5 créditos.
3. Tiempos por palabra con faster-whisper → `palabras.json` ([inicio, fin, palabra]).
4. `escena.html`: todo el video es `window.render(t)` (cuarto de noche y de mañana, app de NXUS con chat, llamada, calificación + calendario y ficha del CRM, stickers, subtítulos palabra a palabra con clave en cian, cierre con logo y tarjeta, final en loop a las 3:11).
5. `node tomar.cjs video 31.5` → cuadros JPG a 30 fps; `node tomar.cjs fotos 1.5 8 …` para fotos de prueba.
6. `python musica.py` → música original; mezcla con la voz primero (loudnorm de la voz antes de mezclar, música 0.16 con sidechain) y luego se une con los cuadros.

## v2: el muñeco se mueve (15 nov)
- Capas: `pj_cuerpo.png` (sin brazos), `brazo_i.png` y `brazo_d.png` (brazos sueltos: x<200 y x>614, y de 880 a 1385 en el recorte de 817×1888; más abajo se cuela la pierna), y los cuerpos con ojos cerrados `pjd_cuerpo.png` (dormido) y `pjf_cuerpo.png` (feliz).
- `muneco(t, {x, y, h, ojos, bi, bd})` en `escena.html`: los brazos giran en el hombro (22% / 77.1% del ancho, 47.4% del alto) y parpadea solo cada ~3 s.
- Gestos: respira dormido; al despertar se estira (brazos arriba), señala el celular y festeja con los brazos arriba y confeti; en el cierre aparece abajo saludando y luego señala la tarjeta.
