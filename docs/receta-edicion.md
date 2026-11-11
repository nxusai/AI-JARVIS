# Receta de edición de Eduardo (su marca personal y sus videos)

Última actualización: 11 de noviembre de 2026. **Cualquier chat o NEX que edite un video de Eduardo lee esto completo primero y lo sigue.** Cada corrección que él pida se agrega aquí, en "Preferencias", y cada video nuevo se anota en el "Registro".

## Cómo trabajar con Eduardo
- **Comunicación:**
  - Español, directo y breve.
  - Pasos clic por clic, con los nombres de los botones en inglés como salen en pantalla.
  - Links dentro de cada paso y repetidos al final.
- **Editar aquí y no en NEX:** se edita en el chat de Claude Code, que va con su suscripción. En NEX se cobra a su llave de API. Generar tomas, voz o música con Higgsfield sí gasta créditos, y hoy están casi en cero.
- **"En vivo":** no hay vista en vivo. Mandar fotos de cada avance (cortes, efectos, final) mientras se edita, y avisar cuando el video esté listo.
- **Entrega:**
  - Nunca entregar sin revisar el video **terminado**: audio igual de largo que el video, transcripción del audio final (que su voz se entienda sobre la música) y fotogramas a lo largo del video.
  - Luego el archivo con SendUserFile y una explicación corta de qué se hizo.
- **Archivos:** sus videos y ejemplos están en su Google Drive (contacto@nxusai.org), en las carpetas del Registro. Él abre la carpeta con "Anyone with the link" cuando sube videos; si un archivo no baja, pedirle que la abra.

## De dónde salió
**Referencia 1:** anuncio de una agente de bienes raíces (inglés, 44 s, 9:16). Está en la carpeta de Drive "Videos para editar" de contacto@nxusai.org: https://drive.google.com/drive/folders/1026SDveh_-ceHYlzRaWD5x0uDo9nOgTx. Los archivos se bajan con `curl -L "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t"` cuando la carpeta está abierta con link; los ID se sacan con la búsqueda de Drive `parentId = '<carpeta>'`.

## Registro: qué ya se analizó y qué ya se editó
**Cuando Eduardo diga "ya subí videos":**
1. Lista las dos carpetas con la búsqueda de Drive (`parentId = '<id>'`).
2. Compara contra estas tablas **por ID** de archivo (el nombre se puede repetir).
3. Lo que no esté en las tablas es nuevo: analízalo o edítalo, y **agrégalo aquí al terminar**.

**Carpetas** (dentro de "Videos para editar", `1026SDveh_-ceHYlzRaWD5x0uDo9nOgTx`):
- **Ejemplos de edicion** (`1EDLEcUQQpTFFwVYyHPH8zqZ_EsT1Hf3W`): videos de referencia para analizar el estilo.
- **Mis videos crudos** (`1yIkwpOgswvj9cSXJ7PupZKB8OV2FOQyh`): sus videos en bruto para editar.

### Ejemplos ya analizados
| Fecha | ID de Drive | Archivo | Qué se aprendió |
|---|---|---|---|
| 11 nov 2026 | `1_fjSPOF_xX11_toCM0Julof44j8UoUP4` | AQOrAGhtsH0cf3f1zhz226CbmdAu_KjTj8iWqspihSfqj7tGz9wBa_hcNiZDYyF 2.MP4 | Agente de bienes raíces (44 s): fondo desenfocado, texto detrás, subtítulos con dos letras, pastillas, logos, ritmo y estructura (ver "La receta") |
| 11 nov 2026 | `1O9ErBtKWsaDkQiOyBW3IiLWeLL6Mizfk` | US NEVER THEM #fitness #explorepage✨ #gym #couplegoals❤️ #fitnessaddict.mp4 | Pareja entrenando (29 s, 16:9, rap ~89 BPM): de aquí salió la caja de efectos (no copiar el estilo completo) |
| 11 nov 2026 | `1aO9UHMWjl3Wcfj0f_uPTI6IGV1OSydLD` | A promise isn’t made when it’s easy. It’s kept when things get hard.Built through adversity. Dri.mp4 | Promo de marca de ropa de gym (25 s, 16:9, ~144 BPM): caja de efectos; cierre con logo animado y fecha |

### Crudos ya editados
| Fecha | ID de Drive | Archivo | Resultado | Notas |
|---|---|---|---|---|
| 11 nov 2026 | `1_7w6qWNJkunNuaf-2Co19_VBuYbJcbdl` | IMG_2615.MOV (4K, 27 s) | Prueba-Edicion.mp4 (15 s), versión 3 aprobada | Solo era prueba; no se vuelve a editar. De aquí salieron las reglas de gestos, desenfoque ligero, subtítulos clave, retoque de cuerpo y texto en espacio libre |

## Preferencias de Eduardo (mandan sobre lo de abajo)
- **Desenfoque ligero**, no extremo: gaussiano de unos 4.5 px a 1080 de ancho (sube poquito con el acercamiento). Que el fondo se vea suave, no borrado.
- **Subtítulos solo en las frases clave** (el gancho y la idea principal), no en todo lo que dice. Lo demás lo cuentan el texto gigante detrás y los acercamientos.
- **Sin marca NXUS** en sus videos personales salvo que la pida (ni logo ni tarjeta final).
- **Sus gestos mandan los acercamientos:** mano que agarra y jala hacia él = la cámara se acerca; palma que empuja hacia la cámara = la cámara se aleja; brazos abiertos = plano abierto con destello.
- **Cortes:** fuera la entrada (cuando llega y se sienta), la salida (cuando se levanta) y las pausas entre frases.
- **Texto grande: primero el espacio libre, no detrás de él.** Si arriba de él (o a un lado) hay espacio vacío, el texto grande va ahí, completo y sin taparse. El texto detrás de la cabeza se usa solo cuando la toma está cerrada y no hay espacio libre (por ejemplo, en un acercamiento fuerte a la cara). En su prueba del 11 de noviembre había mucho espacio arriba y el texto quedó detrás: no.
- **Nada encimado** (pastillas, logos, textos) salvo que se vea bien: si dos elementos coinciden, uno termina antes de que entre el otro.
- **El acercamiento va exacto con el gesto:** medir el gesto cuadro por cuadro (10 por segundo). El acercamiento arranca cuando cierra el puño y empieza a jalar, no cuando estira la mano, y llega a la cara cuando el puño toca el pecho. El alejamiento sigue el empujón de la palma, en unos 0.35 s.
- **Retoque de cuerpo moderado** (lo pidió): abdomen un poco más delgado y brazos más anchos en el bíceps, con deformación guiada por la pose (MediaPipe 0.10.14 + OpenCV, `cuerpo.py`), sin tocar las manos. No exagerar: la pared y la silla se doblan.
- **Audio:** su voz viene muy bajita; normalizarla ANTES de mezclar y dejar la música abajo (en la primera versión la tapaba).
- **Texto gigante detrás de la cabeza** en colores que contrasten con su fondo (en pared clara: degradado cian → azul → violeta, no blanco).

## La receta
1. **Persona enfocada y fondo desenfocado (lo pidió Eduardo).**
   - Se recorta a la persona cuadro por cuadro (rembg `u2net_human_seg`, máscara suavizada 2 px) y se desenfoca el fondo **ligero**, unos 4.5 px a 1080 de ancho (ver Preferencias; en la referencia era más fuerte y a él no le gustó extremo).
   - Si el fondo ya viene desenfocado de la cámara, se usa menos.
   - Lo que toca a la persona (el sofá donde está sentada) se desenfoca menos, para que se vea natural; ideal con mapa de profundidad.
   - Un poco de nitidez solo sobre la persona.
2. **Texto gigante en las frases clave** ("LET ME", "TOP 1%", "INVESTMENT"). **Si hay espacio libre, va ahí, completo.** Detrás de la persona (la capa de fondo, con la persona encima tapando parte de las letras) solo cuando la toma está cerrada. Unas 3 o 4 veces por video, no en todo.
3. **Subtítulos de 1 a 3 palabras, con dos tipos de letra:**
   - serif elegante en cursiva para el relleno ("deserves the", "goes far beyond");
   - sans gruesa en mayúsculas para lo importante ("YOUR PROPERTY", "IS NOT").
   - La palabra clave en color: morado o azul en la referencia; para NXUS, cian o violeta.
   - Van a la altura del pecho o junto a la cabeza, nunca abajo del todo.
4. **Efectos sobre palabras clave:**
   - brillo o resplandor en cifras ("TOP 1%");
   - tachado rojo animado en negaciones ("IS NOT");
   - pastillas con contorno amarillo que aparecen alrededor de la persona para valores o listas ("Character", "Integrity");
   - logos que saltan cuando se mencionan (Zillow, Homes.com). Para NXUS: WhatsApp, Instagram, Meta y los logos de clientes.
5. **Ritmo:**
   - cambio de lugar o ángulo cada 5 a 10 s;
   - entre esos cambios, acercamientos y alejamientos suaves cada 2 a 4 s, para que nunca se vea quieto;
   - un destello blanco como transición fuerte, más o menos a la mitad del video;
   - se quitan silencios y tomas repetidas.
6. **Look:** cálido, limpio, luminoso y con contraste suave. Sin filtros exagerados.
7. **Estructura:**
   - gancho directo al beneficio;
   - por qué yo (prueba);
   - qué hago;
   - valores;
   - llamado a la acción ("link en mi bio" o "escríbeme").
8. **Antes de entregar:**
   - revisar el video terminado: fotogramas, que el audio dure igual que el video y transcripción del audio final;
   - mandar fotos a Eduardo.

## Cómo grabar (para Eduardo)
- De 3 a 4 lugares o ángulos distintos: sofá, de pie, escritorio, exterior.
- Luz de ventana de frente o de lado.
- En 4K, con el celular a la altura de los ojos.
- Lejos de la pared, para que el fondo tenga profundidad.
- Dejar espacio arriba de la cabeza para el texto gigante.
- En iPhone, el **modo Cinematográfico** ya graba con el fondo desenfocado y se puede ajustar después.
- Micrófono de solapa si lo hay.
- Si se equivoca, pausa y repite la frase.

## Caja de efectos (de los ejemplos del gym, 11 nov 2026)
**No es un estilo para copiar completo.** Eduardo no quiere que sus videos se vean como esos (ni ese color oscuro ni ese tipo de clips). Son **efectos y técnicas sueltas** que se usan **solo cuando él las pida**, sobre su propio estilo.
1. **Clips uno tras otro al ritmo de la música:** tomas de 1 a 1.5 s, cortando en el golpe (cada 2 tiempos en beat lento de ~90 BPM, cada 3 en uno rápido de ~144). Se detecta el tempo de la canción y se corta en sus golpes.
2. **Destello de luz** (luz roja o naranja que cruza la pantalla, tipo "light leak") como transición entre clips.
3. **Barrido de movimiento** (whip): desenfoque de movimiento rápido de un clip al siguiente.
4. **Parpadeo a negro** de 1 o 2 cuadros entre tomas para dar golpe.
5. **Cámara lenta con rampa:** el clip va normal y se frena en el momento fuerte (esfuerzo, gesto), luego regresa. Pide grabar a 60 o 120 cuadros por segundo.
6. **Cierre con logo animado** sobre negro con frase o fecha y fundido (solo si pide marca).
7. **Ángulos que lucen más:** desde abajo, muy cerca de la cara, detalles (manos, cadena, logo). Esto depende de cómo grabe; se le sugiere si quiere ese efecto.

## El taller: herramientas y cómo montarlas
Todo corre en el contenedor del chat (Linux). Ya vienen ffmpeg y Playwright con Chromium. Lo demás va en un **entorno de Python propio**, sin instalar nada en todo el sistema:
```
python3 -m venv venv && venv/bin/pip install faster-whisper rembg onnxruntime pillow numpy scipy soundfile opencv-python-headless "mediapipe==0.10.14"
mkdir -p modelos && curl -sS -o modelos/pose.task https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
```
- **MediaPipe tiene que ser la versión 0.10.14:** las nuevas piden una librería gráfica (libEGL) que el contenedor no tiene.
- **rembg** baja solo su modelo (`u2net_human_seg`, unos 176 MB) la primera vez.
- **faster-whisper** usa el modelo `small` en CPU para transcribir con tiempo por palabra.

## El proceso paso a paso (estilo hablado a cámara)
El código está en `edicion/` (lo del video de prueba; se adapta a cada video):
- **`plan.py`:** los tramos que se quedan, las palabras en el tiempo final, los acercamientos (`ZOOM`) y el texto grande (`ATRAS`). Se reescribe para cada video.
- **`capa.html` + `capa.js`:** dibujan con Playwright, cuadro por cuadro, la capa del texto grande (`atras`) y la de subtítulos, pastillas y destellos (`frente`).
- **`cuerpo.py`:** retoque del cuerpo guiado por la pose; protege las manos.
- **`componer.py`:** arma cada cuadro en este orden: acercamiento desde el 4K, retoque, recorte de la persona, fondo desenfocado, texto grande, la persona encima y subtítulos. `python componer.py prueba 3.0,8.0` saca fotos de prueba.
- **`musica.py`:** música original con golpes en los cortes (parámetros: salida, duración, inicio).
- **`final.sh`:** todo junto; se corre con `PY=venv/bin/python SALIDA=Nombre.mp4 bash final.sh`.

Pasos:
1. **Bajar el crudo** de Drive y hacer una copia ligera a 1080 (`scale=-2:1920,fps=30`). Los iPhone graban HEVC 4K a 60 cuadros por segundo con rotación; ffmpeg la corrige solo.
2. **Transcribir con tiempo por palabra** y medir las pausas reales con la energía del audio: los finales de palabra de whisper se alargan.
3. **Decidir los cortes:** fuera la entrada, la salida, las pausas y las tomas repetidas. Cortar del 4K a 30 cuadros por segundo, con fundidos de 20 ms en el audio para que no truene.
4. **Encontrar los gestos:** hoja de cuadros a 10 por segundo con la hora encima, en los tramos donde mueve las manos. Poner el acercamiento exacto en el movimiento.
5. **Ubicar su cuerpo** (caja y cabeza con rembg) para centrar los acercamientos en su cara y poner el texto.
6. **Fotos de prueba** de los momentos clave y mandárselas. Ajustar.
7. **Render completo** en segundo plano. Unos 15 a 20 minutos para 15 segundos de video: el recorte y la pose van cuadro por cuadro.
8. **Audio:** voz con highpass, quitar ruido, compresor y **loudnorm de la voz sola a -15 LUFS antes de mezclar**. Música a 0.16 con ducking y limitador. Mezclar el audio aparte y luego unirlo con el video: mezclarlo dentro del mismo comando del video ya cortó el audio una vez.
9. **Revisar el terminado** (duraciones, transcripción, fotogramas) y entregar.
10. **Anotar en el Registro y en Preferencias** lo nuevo.

## Errores que ya pasaron (no repetir)
- **La música tapó su voz:** él graba muy bajito, en -40 dB. Siempre normalizar la voz antes de mezclar y transcribir el audio final para comprobarlo.
- **El audio se cortó antes que el video** al mezclarlo en el mismo comando: mezclar aparte.
- **Texto blanco invisible** sobre pared clara: usar colores que contrasten.
- **Texto grande que se salía de la pantalla:** el tamaño se calcula según el largo de la palabra.
- **La pastilla de Claude encimada** con el texto grande.
- **El acercamiento adelantado:** empezó cuando estiró la mano, no cuando jaló.
- **El retoque agrandaba las manos:** se protegen las manos.
- **Desenfoque demasiado fuerte.**
- **Subtítulos en todo:** van solo en las frases clave.
- **Texto detrás de él** con espacio libre arriba.
- **Marca NXUS** en un video personal.
