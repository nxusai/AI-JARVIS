# Habilidad: editor de video con IA (genérica, para cualquier cliente)

Este documento enseña a un chat de Claude Code a **editar videos de forma profesional**: herramientas, proceso, efectos, revisión y errores ya aprendidos. **No trae estilo de marca:** los colores, letras, tono y preferencias de cada cliente van en su propia receta (plantilla al final). El código de ejemplo está en `edicion/` de este repositorio (nxusai/AI-JARVIS, rama `claude/jarvis-project-setup-gs6uu2`).

## 1. Cómo trabajar con quien pide la edición
- **Idioma y estilo:** español, directo y breve. Pasos clic por clic, con los nombres de los botones en inglés como salen en pantalla. Los links van dentro de cada paso y repetidos al final.
- **No hay vista en vivo:** mandar **fotos de cada avance** (cortes, efectos, versión final) mientras se edita, y avisar cuando el video esté listo.
- **Nunca entregar sin revisar el video TERMINADO** (ver sección 7).
- **Videos grandes:** no se suben al chat. Que los suba a una carpeta de **Google Drive** abierta con "Anyone with the link" (Viewer). Se bajan con:
  `curl -sSL -o crudo.mov "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t"`
  Los ID salen con la búsqueda de Drive `parentId = '<id de la carpeta>'`. Si no baja, pedirle que abra la carpeta con link. Al terminar puede regresarla a "Restricted".
- **Registro:** llevar una tabla (en la receta del cliente) con cada **ejemplo ya analizado** y cada **crudo ya editado**, por **ID de Drive**, para saber cuáles son nuevos cuando diga "ya subí videos".
- **Créditos:** editar con ffmpeg y Python no gasta créditos. Generar tomas, voces o música con IA (Higgsfield, ElevenLabs) sí: preguntar antes y revisar el saldo.

## 2. El taller (montarlo en el contenedor del chat)
Ya vienen **ffmpeg** y **Playwright con Chromium**. Lo demás va en un entorno de Python propio, sin instalar nada en todo el sistema:
```
python3 -m venv venv && venv/bin/pip install faster-whisper rembg onnxruntime pillow numpy scipy soundfile opencv-python-headless "mediapipe==0.10.14"
mkdir -p modelos && curl -sS -o modelos/pose.task https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
```
- **MediaPipe tiene que ser la versión 0.10.14:** las nuevas piden libEGL y el contenedor no la tiene.
- **rembg** baja solo su modelo de recorte de personas (`u2net_human_seg`, unos 176 MB).
- **faster-whisper:** modelo `small` en CPU, para transcribir con tiempo por palabra.
- **Playwright** dibuja los gráficos: una página HTML con `window.render(t)`, un PNG transparente por cuadro (`omitBackground: true`).
- **Disco:** el contenedor tiene un límite; borrar carpetas de cuadros viejos al terminar.

## 3. Analizar un video de referencia (aprender un estilo)
1. **Hoja de cuadros:** `ffmpeg -i ref.mp4 -vf "fps=1,scale=180:-1,tile=11x4" -frames:v 1 hoja.jpg`, y cuadros grandes de los momentos clave.
2. **Cortes:** `select='gt(scene,0.12)',showinfo` da los tiempos; con eso se saca la duración promedio de cada toma.
3. **Audio:** transcripción con whisper (si hay voz) y el tempo de la música (autocorrelación de la energía) para saber si cortan al ritmo.
4. **Color:** saturación promedio con `signalstats` (sirve para comparar: un estilo oscuro de cine ronda 3, uno cálido y limpio 13).
5. **Anotar con medidas**, no "más o menos": cada cuánto cortan, cuántas palabras por subtítulo, dónde va el texto, qué efectos usan y en qué momentos, cómo enganchan en los primeros 3 segundos y cómo cierran.
6. **Preguntar qué copiar:** a veces quieren el estilo completo y a veces solo ciertos efectos. Guardar en la receta qué se copia y qué no.

## 4. El proceso de edición (alguien hablando a cámara)
1. **Bajar el crudo y hacer una copia ligera** (`scale=-2:1920,fps=30`) para analizar. Los iPhone graban HEVC 4K a 60 cuadros por segundo con rotación; ffmpeg la corrige solo.
2. **Transcribir con tiempo por palabra.** Los finales de palabra de whisper salen alargados: las **pausas reales** se miden con la energía del audio (RMS cada 20 ms, umbral por percentil).
3. **Decidir los cortes:** fuera la entrada (cuando llega y se acomoda), la salida, las pausas, las muletillas y las tomas repetidas (si se equivoca, se queda la última). Cortar **del 4K** a 30 cuadros por segundo, con **fundidos de 20 ms** en el audio para que no truene.
4. **Leer los gestos:** hoja de cuadros a **10 por segundo con la hora encima** (`drawtext=text='%{pts\:flt}'`) en los tramos donde mueve las manos. Si la persona "jala" la cámara (cierra el puño y lo trae a su pecho), es un acercamiento; si "empuja" con la palma, es un alejamiento. **El efecto va exacto con el movimiento:** empieza cuando arranca el jalón o el empujón, no cuando estira la mano.
5. **Ubicar a la persona** (caja y cabeza con rembg en unos cuadros) para centrar los acercamientos en su cara y saber dónde hay espacio libre para texto.
6. **Plan de edición (`plan.py`):** tramos que se quedan, palabras en el tiempo final, curva de acercamientos (saltos en los cortes, transiciones suaves en los gestos) y textos grandes con su tiempo.
7. **Capas de gráficos (`capa.html` + `capa.js`):** una capa de **atrás** (texto grande que la persona tapa) y una de **frente** (subtítulos, pastillas, logos, destellos).
8. **Componer cada cuadro (`componer.py`), en este orden:**
   1. acercamiento recortando el 4K;
   2. retoque de cuerpo, si lo piden;
   3. recorte de la persona (máscara suavizada y estable entre cuadros);
   4. fondo desenfocado;
   5. capa de atrás;
   6. la persona encima;
   7. capa de frente.

   Antes de todo, `python componer.py prueba 3.0,8.0,…` saca fotos de prueba: mandarlas y ajustar antes del render completo.
9. **Render completo en segundo plano:** unos 15 a 20 minutos por cada 15 segundos de video, porque el recorte y la pose van cuadro por cuadro.
10. **Audio, mezclado APARTE:**
    1. voz con highpass de 80 Hz, quitar ruido (`afftdn`), compresor y `loudnorm` de la **voz sola a -15 LUFS antes de mezclar**;
    2. música baja (cerca de 0.16), que se agacha cuando hablan (`sidechaincompress`), y limitador;
    3. se mezcla en un archivo de audio y **luego** se une con el video.
11. **Color final** (contraste, saturación y balance según la receta del cliente) y exportar en H.264, CRF 17, AAC a 256k, con `+faststart`.

## 5. Caja de herramientas (efectos que ya funcionan)
- **Fondo desenfocado con la persona nítida:** máscara de rembg y desenfoque gaussiano. **Ligero** por defecto (unos 4.5 px a 1080 de ancho, un poco más al acercar); fuerte se ve falso.
- **Texto grande detrás de la persona:** la capa de atrás y la persona encima tapando parte de las letras. **Solo en tomas cerradas;** si hay espacio libre, el texto va en el espacio libre, completo. El tamaño se calcula según el largo de la palabra para que no se salga, y el color debe contrastar con el fondo (blanco sobre pared clara no se ve).
- **Subtítulos de 1 a 3 palabras:** letra elegante para el relleno y gruesa en mayúsculas para la palabra clave, en color. Van a la altura del pecho, no abajo del todo. **Solo en las frases clave** si el cliente no pide todo.
- **Acercamientos y alejamientos:** curva con saltos en los cortes y transiciones suaves (`smoothstep`) en los gestos; desde 4K no pierde calidad hasta unas 2 veces.
- **Pastillas y logos** que saltan cuando se mencionan, **sin encimarse** con otro elemento (si coinciden, uno termina antes de que entre el otro).
- **Destello blanco** en un corte fuerte.
- **Retoque de cuerpo moderado** (solo si lo piden): abdomen más delgado y brazos más anchos con deformación guiada por la pose (MediaPipe y `cv2.remap`), **protegiendo las manos**. Si se exagera, se doblan la pared y los muebles.
- **Clips al ritmo de la música:** se detecta el tempo y se corta en los golpes (cada 2 tiempos en un beat lento de unos 90 BPM, cada 3 en uno rápido de unos 144). Tomas de 1 a 1.5 s.
- **Transiciones:** destello de luz roja o naranja tipo "light leak", barrido de movimiento (whip) y parpadeo a negro de 1 o 2 cuadros.
- **Cámara lenta con rampa:** el clip va normal, se frena en el momento fuerte y regresa. Pide grabar a 60 o 120 cuadros por segundo.
- **Cierre con logo animado** sobre negro, con frase o fecha y fundido (solo si piden marca).
- **Música original** sintetizada con numpy (golpes en los cortes, riser antes del cierre), sin problemas de derechos.

## 6. Cómo pedirle a la persona que grabe
- De 3 a 4 lugares o ángulos distintos.
- Luz de ventana de frente o de lado, nunca a la espalda.
- En 4K, con el celular a la altura de los ojos, lejos de la pared.
- Espacio arriba de la cabeza para el texto.
- Micrófono de solapa si lo hay.
- Si se equivoca, pausa y repite la frase.
- En iPhone, el **modo Cinematográfico** ya graba con el fondo desenfocado.
- Para cámara lenta, grabar a 60 o 120 cuadros por segundo.
- Para montajes con música, de 20 a 40 clips cortos desde muchos ángulos, y la canción elegida antes.
- Para verse mejor: ropa ajustada u oscura, celular un poco arriba de los ojos, postura derecha y brazos un poco separados del cuerpo.

## 7. Revisión antes de entregar (siempre)
1. **Duraciones:** `ffprobe` del video **y** del audio; tienen que durar lo mismo.
2. **Transcribir el audio del video terminado** con whisper: la voz se tiene que entender completa sobre la música.
3. **Fotogramas** a lo largo de todo el video: texto que se salga, cosas encimadas, cortes mal puestos, deformaciones.
4. **Volumen:** `ebur128`, cerca de -16 a -14 LUFS para redes.
5. Luego se manda el archivo y una explicación corta de qué se hizo.

## 8. Errores que ya pasaron (no repetir)
- **La música tapó la voz** porque la persona grabó muy bajito (-40 dB). Normalizar la voz antes de mezclar y transcribir el audio final.
- **El audio se cortó antes que el video** por mezclarlo en el mismo comando del video. Mezclar aparte.
- **Texto blanco invisible** sobre pared clara.
- **Texto grande que se salía de la pantalla.**
- **Elementos encimados.**
- **Acercamiento adelantado** al gesto.
- **El retoque agrandaba las manos.**
- **Desenfoque demasiado fuerte.**
- **Subtítulos en todo** cuando solo se querían en lo clave.
- **Texto detrás de la persona** habiendo espacio libre.
- **Poner la marca de la agencia** en un video que no la lleva.
- **Revisar solo fotogramas** sin escuchar el resultado.

## 9. Plantilla: receta de un cliente
Crear `docs/receta-<cliente>.md` y llenarla con el cliente. Cada corrección que pida se agrega en "Preferencias".

```
# Receta de edición: <cliente>
## Marca
- Colores (hex): …        - Letras: …        - Logo: … (dónde va, cuándo)
- Tono: …                 - Idioma: …        - Formato: vertical 9:16 / horizontal 16:9
## Preferencias (mandan sobre todo lo demás)
- Desenfoque: …  - Subtítulos: todos / solo frases clave  - Texto grande: …
- Música: …      - Cierre: …                               - Lo que NO quiere: …
## Registro
| Fecha | ID de Drive | Archivo | Qué se aprendió / resultado |
## Carpetas de Drive
- Ejemplos: <id>   - Crudos: <id>
```
