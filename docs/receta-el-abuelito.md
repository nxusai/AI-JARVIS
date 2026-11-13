# Receta de edición: El Abuelito

Última actualización: 12 de noviembre de 2026. **Cualquier chat que cree o edite contenido de El Abuelito lee esto completo primero.** La habilidad general de edición está en `docs/habilidad-editor-video.md` y el código de ejemplo en `edicion/` (rama `claude/jarvis-project-setup-gs6uu2`). Cada corrección que pida el cliente se agrega en "Preferencias" y cada video nuevo en el "Registro".

**No usar colores, letras ni marca de NXUS en nada de este cliente.**

## Cómo se trabaja con este cliente
1. **Se crea** el contenido con Higgsfield (imágenes, voz y video de las influencers).
2. **Se aprueba** la toma generada, sin editar.
3. **Se edita** aquí con ffmpeg, Python y Playwright (cortes, subtítulos, texto, música, color). Editar no gasta créditos; generar sí.
4. **Se revisa el video terminado** (duración de audio y video, transcripción del audio final, fotogramas, volumen) y se entrega.

## Marca
> **PENDIENTE DE CONFIRMAR.** Estos valores salieron del sitio `el-abuelito-web/` de este repositorio, no del cliente. No usarlos en un video final hasta que se confirmen.

- **Colores (hex):**
  - Verde `#0b7a3e` (por confirmar)
  - Dorado `#f2b33d` (por confirmar)
  - Rojo `#c8102e` (por confirmar)
  - Rosa `#d94f8a` (por confirmar)
  - Crema `#fff8ec` (por confirmar)
- **Letras:** Lilita One (títulos), Nunito (texto), Caveat Brush (detalles a mano). Por confirmar.
- **Logo:** pendiente (archivo, dónde va y cuándo).
- **Tono:** divertido, estilo "funny" de redes; sketches de trabajo con las dos influencers.
- **Idioma:** español de México. Renata mezcla algunas palabras en inglés.
- **Formato:** vertical 9:16.
- **Empresas del grupo:** Abuelito Cheese, Abuelito Meat, Abuelito Corn (por confirmar cuáles llevan contenido).

## Las influencers
Las fichas completas, las imágenes maestras y la guía de guiones están en Drive, carpeta "Influencers IA" (`1A6jzN-O8fIrdBr4NdZ-NCWLeKMk_z8UK`).

| | Regina | Renata |
|---|---|---|
| Edad y perfil | 30 años, mexicana, madura y segura | 23 años, mexicana nacida en Estados Unidos, se ve americana |
| Rasgos | Cabello largo ondulado castaño oscuro, ojos miel, lunar en la frente | Cabello largo lacio rubio miel con raíz oscura, ojos verdes, pecas |
| Accesorios fijos | Arracadas doradas, cadenita con dije redondo, reloj dorado | Arracadas doradas, cadenita con crucecita, pulseras doradas (sin reloj) |
| Look base | Blusa blanca cuello V, jeans azules de tiro alto, tenis blancos | Blusa negra cuello cuadrado, jeans claros de tiro alto, tenis blancos |
| Elemento en Higgsfield | `ca9856ea-b9a3-4585-95d4-eb3eee5d5b9e` (aparece como "abuelito-influencer") | `a133c1c5-fbe4-459a-8cee-92d8b7d9db29` ("Renata-El-Abuelito") |
| Voz oficial (tipo `element`) | `9d65d018-7eb0-4e43-82f6-41ab8c93c24b` | `7a8d5ac9-4c50-4dff-883c-5432bcfcd0d4` |
| Rostro para video | imagen `a1734e50-a439-4bab-9289-7b0ad805b0b3` | imagen `a764db50-07de-4427-91fb-711a8c712b5d` |
| Carpeta de Drive | `1595vAF4AhDC1pNXQmqPPpFRE4q5ifVFf` | `1UjqV9WMjBHDce0O_LbTRw212epGxOaOt` |

**Locación real:** fachada de Abuelito Cheese, 607 Main St, Paterson, NJ. Imagen de referencia en Higgsfield: `742ce232-8e4e-460b-9e80-814d56a3b583` (sale un chofer en el montacargas al fondo).

## Preferencias (mandan sobre todo lo demás)
### Cómo se ven
- **Súper reales**, como foto o video de iPhone: todo en foco, sin luz de estudio, sin look de IA.
- **Estatura normal y cuerpo delgado.** Se vieron "enormes y torotas" en una versión: van a escala con las puertas (la puerta les saca buen tramo) y con brazos y hombros delgados.
- **Poses de compañeras de trabajo:** de frente, brazo al hombro. Nada de abrazos de perfil pegadas; se vio "comprometedor".
- **Consistencia total** de rostro, cuerpo y accesorios aunque cambien de ropa o lugar: siempre generar desde el elemento o las imágenes maestras.
- **Letreros legibles:** la puerta dice "ABUELITO CHEESE INC.". El texto en pantalla y los logos se ponen en edición, no se generan.

### Cómo hablan
- **Acento fresa de Santa Fe (Ciudad de México).** Las primeras voces sonaron "nacas": prohibido "qué onda", "órale", "no manches", "chido", "mi gente".
- **Renata:** fresa completa ("tipo", "literal", "neta", "o sea", "súper").
- **Regina:** punto medio entre normal y fresa, porque es mayor ("o sea de verdad", "la verdad", "súper", "obvio"; máximo un "tipo" por video).
- **Fluido y sin huecos.** Las muletillas van pegadas a la frase, sin comas alrededor: la voz hace pausa en cada coma. "Estoy tipo súper emocionada", no "Tipo, estoy…".
- **"Tipo"** va antes de un adjetivo, comparación o cita ("son tipo los más ricos"); no suelto al inicio.
- Velocidad de voz un poco arriba de lo normal (`speech_rate` 10 a 12) y nada de puntos suspensivos.
- **Las voces oficiales no se cambian** salvo que el cliente lo pida.

### Edición
- Desenfoque: pendiente.
- Subtítulos (todos o solo frases clave): pendiente.
- Texto grande: pendiente.
- Música: pendiente.
- Cierre (logo, frase, llamado a la acción): pendiente.
- Lo que NO quiere: marca o colores de NXUS.

## Notas técnicas para editar video generado
- Los videos de Higgsfield salen en 720 × 1280. Para edición final conviene generarlos en 1080p; desde 720p los acercamientos se limitan a unas 1.2 veces.
- El modelo de video con voz (Intone) agrega unos 2.5 s al final del audio: recortar la cola en edición.
- Intone puede **repetir un pedazo de la frase**. Siempre transcribir el audio del video generado y comparar con el guion antes de aprobarlo.
- Revisar accesorios cuadro por cuadro: a Renata le apareció un reloj que no usa.
- El encuadre sale cerrado en el busto; pedir plano más abierto si el video va a pauta.

## Costos de referencia (créditos de Higgsfield, noviembre de 2026)
- Imagen: unos 4 por imagen. Pasar a 4K: unos 2.
- Voz: de 0.2 a 2 por frase.
- Video con voz sincronizada (Intone): unos 7 por segundo en 720p, unos 3.4 en 480p.
- Video sin voz (Kling 3.0 estándar): 1.75 por segundo.

## Registro
### Material generado
| Fecha | ID en Higgsfield | Archivo | Resultado |
|---|---|---|---|
| 12 nov 2026 | `92c47210-19ad-4bfd-a595-a0280365ebdd` y `d0e188ef-ba31-48f7-bc0b-587e733d26f6` | Foto de las dos frente a la fábrica, estilo iPhone | Pendiente de elegir una y pasarla a 4K |
| 12 nov 2026 | `4488c3ab-23ae-4634-9314-40c00bb759e5` | Regina, presentación v1 (18 s) | Descartado: repite una frase y tiene pausas |
| 12 nov 2026 | `72d8bd92-adb4-48de-beaa-ec6c28ce0b73` | Renata, presentación v1 (23 s) | Descartado: muchas pausas |
| 12 nov 2026 | `888b558c-dbdd-465f-abb1-1ff7f7c4729f` | Regina, presentación v2 (19 s) | Fluido, sin repetición. Pendiente de aprobación |
| 12 nov 2026 | `e17e25f1-35c5-4c93-a096-8378b1fcde1e` | Renata, presentación v2 (14 s) | Fluido. Pendiente de aprobación |

### Ejemplos ya analizados
| Fecha | ID de Drive | Archivo | Qué se aprendió |
|---|---|---|---|
| 12 nov 2026 | `13o9LTqM5piT8X0r5ibZq1HEIfdcS2uSw` | Reel de empresa de jardinería (12.5 s) | Sketch "work bestie": texto fijo arriba, una sola toma con celular, marca en el uniforme, reacción exagerada. Formato repetible "Cuando tu…" |
| Pendiente | `1lwJNd6b7ArFZwhkepPPVyIveH4NjAh3G` | Segundo ejemplo (59 MB) | No se pudo bajar: pasa de 10 MB. Subirlo comprimido o abrir la carpeta con link |

### Videos ya editados
| Fecha | Origen | Archivo final | Notas |
|---|---|---|---|
| | | | Todavía ninguno |

## Carpetas de Drive
- Ejemplos de referencia: "videos de referencia para crear con IA" (`10oLOsauvzJjmdCoNL4QtU0auYKHaUh5R`)
- Influencers, fichas, voces y guía de guiones: "Influencers IA" (`1A6jzN-O8fIrdBr4NdZ-NCWLeKMk_z8UK`)
- Videos terminados: pendiente de crear.
