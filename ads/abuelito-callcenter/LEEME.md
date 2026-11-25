# Video: renovación del call center de El Abuelito (YouTube 16:9, 77.7 s)
- `escena.html`: todas las escenas con `window.render(t)` (1920×1080). Subtítulos en la constante `SUB` (tiempos de la voz; el video arranca 0.5 s antes).
- `tomar.cjs`: `node tomar.cjs fotos 10 20` saca fotos de prueba; `node tomar.cjs video 0 77.7` saca los cuadros a 30 fps.
- Archivos que necesita junto a `escena.html` (no van en el repo): F1–F3.jpg (fotos originales con pantallas y papeles difuminados), k_A.jpg, p6–p12.png (catálogo), logo.png (`crm/public/fiesta/abuelito.png`) y las carpetas `fr/*` con los cuadros de las tomas de Kling 3.0.
- Voz: Higgsfield seed_audio, voz "Regina". Música: ElevenLabs Music v2.5 instrumental. Mezcla: voz con loudnorm −15 antes de mezclar, música 0.22 con sidechain, resultado −13.9 LUFS.
- Reglas del brief: "Estado actual" en fotos reales, "Concepto de diseño" en renders, montos con "Estimación sujeta a cotización", sin cifras de productividad inventadas.
