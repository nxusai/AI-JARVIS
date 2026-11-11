# Receta de edición de Eduardo (videos hablando a cámara)

Última actualización: 11 de noviembre de 2026. Cualquier chat o NEX que edite un video de Eduardo sigue esta receta. Cada corrección que él pida se agrega aquí.

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
| 11 nov 2026 | `1O9ErBtKWsaDkQiOyBW3IiLWeLL6Mizfk` | US NEVER THEM #fitness #explorepage✨ #gym #couplegoals❤️ #fitnessaddict.mp4 | Pareja entrenando (29 s, 16:9, rap ~89 BPM): estilo B, montaje cinematográfico con música |
| 11 nov 2026 | `1aO9UHMWjl3Wcfj0f_uPTI6IGV1OSydLD` | A promise isn’t made when it’s easy. It’s kept when things get hard.Built through adversity. Dri.mp4 | Promo de marca de ropa de gym (25 s, 16:9, ~144 BPM): estilo B, cierra con logo animado y fecha |

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
   - Se recorta a la persona cuadro por cuadro (rembg `u2net_human_seg`, máscara suavizada 2 px) y se desenfoca el fondo (gaussiano de unos 12 a 16 px a 1080 de ancho).
   - Si el fondo ya viene desenfocado de la cámara, se usa menos.
   - Lo que toca a la persona (el sofá donde está sentada) se desenfoca menos, para que se vea natural; ideal con mapa de profundidad.
   - Un poco de nitidez solo sobre la persona.
2. **Texto gigante detrás de la persona** en las frases clave ("LET ME", "TOP 1%", "INVESTMENT"): va en la capa de fondo y la persona (su máscara) va encima, tapando parte de las letras. Se usa unas 3 o 4 veces por video, no en todo.
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

## Estilo B: montaje cinematográfico con música (sin hablar)
Sale de los ejemplos del gym (11 nov 2026). Es para videos de marca, motivación o ambiente: no hay alguien hablando a cámara, la música manda.
1. **Color oscuro y de cine:** casi sin saturación (medida: 3.3, contra 13 del estilo hablado), negros profundos, tono frío verde azulado, mucho contraste. Las luces del lugar se ven como líneas brillantes.
2. **Muchas tomas cortas:** de 1 a 1.5 s cada una, cortando **al ritmo de la música** (cada 2 tiempos en un beat lento de ~90 BPM; cada 3 en uno rápido de ~144).
3. **Variedad de ángulos:**
   - desde abajo (contrapicado);
   - muy cerca de la cara y los ojos;
   - detalles: manos, cadena, logo de la playera, pesas;
   - cámara en mano y fondo desenfocado.
4. **Cámara lenta** en los momentos de esfuerzo (caras apretando, el último jalón).
5. **Transiciones:** casi todo corte seco. Cada tanto, un destello de luz roja o naranja con barrido de movimiento, o un parpadeo a negro.
6. **Sin subtítulos.** Casi sin texto; al final, logo animado sobre negro y fecha o frase, con fundido.
7. **Historia por emoción:** esfuerzo, compañía, disciplina. La canción dice el tono.
8. **Qué necesita de grabación** (con una sola toma no sale este estilo):
   - de 20 a 40 clips cortos del mismo momento, desde muchos ángulos y distancias;
   - en 4K y, si se puede, a 60 o 120 cuadros por segundo para la cámara lenta;
   - poca luz ambiente con luces fuertes de fondo, como un gym;
   - la canción elegida antes, para cortar al ritmo.
