# Receta de edición de Eduardo (videos hablando a cámara)

Última actualización: 11 de noviembre de 2026. Cualquier chat o NEX que edite un video de Eduardo sigue esta receta. Cada corrección que él pida se agrega aquí.

## De dónde salió
**Referencia 1:** anuncio de una agente de bienes raíces (inglés, 44 s, 9:16). Está en la carpeta de Drive "Videos para editar" de contacto@nxusai.org: https://drive.google.com/drive/folders/1026SDveh_-ceHYlzRaWD5x0uDo9nOgTx. Los archivos se bajan con `curl -L "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t"` cuando la carpeta está abierta con link; los ID se sacan con la búsqueda de Drive `parentId = '<carpeta>'`.

## Preferencias de Eduardo (mandan sobre lo de abajo)
- **Desenfoque ligero**, no extremo: gaussiano de unos 4.5 px a 1080 de ancho (sube poquito con el acercamiento). Que el fondo se vea suave, no borrado.
- **Subtítulos solo en las frases clave** (el gancho y la idea principal), no en todo lo que dice. Lo demás lo cuentan el texto gigante detrás y los acercamientos.
- **Sin marca NXUS** en sus videos personales salvo que la pida (ni logo ni tarjeta final).
- **Sus gestos mandan los acercamientos:** mano que agarra y jala hacia él = la cámara se acerca; palma que empuja hacia la cámara = la cámara se aleja; brazos abiertos = plano abierto con destello.
- **Cortes:** fuera la entrada (cuando llega y se sienta), la salida (cuando se levanta) y las pausas entre frases.
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
