# Estilo "La máquina": video sin cámara con avatar y app animada

Analizado el 13 nov 2026. Es un reel de un creador que cuenta cómo su IA le hace los videos de Instagram. Dura 58 s, en vertical 9:16, y viene de una grabación de pantalla.
Se usa de dos maneras:
1. **Formato de edición:** hacer videos con este estilo para NXUS o para clientes.
2. **Sistema de trabajo:** la "máquina de contenido" que explica, aplicada a NXUS y a sus clientes.

## 1. Cómo está editado (medido)
- **Sin cámara:** nadie graba. Todo es animación más una voz narrada (la del creador, clonada).
- **Escena base:** un cuarto de noche en 3D oscuro, con luna en la ventana, escritorio y un celular que marca **03:55**. El creador sale como **avatar pixel/voxel**: festeja, camina y se sienta. Hace de "presentador" de fondo.
- **App animada:** encima de la escena salen paneles de una app inventada ("content-os"), con un **cursor naranja** que da clic en cada paso. Cada frase de la voz tiene su pantalla:
  - la tabla de creadores con números que suben (3.754);
  - la transcripción que se escribe sola;
  - el guion con cursor de máquina de escribir;
  - la línea de tiempo con la onda de la voz;
  - el calendario de publicación;
  - el botón "Aprobar".
- **Ritmo:** solo hay unos 16 cortes duros en 58 s. El movimiento lo dan las animaciones **dentro** de la app: paneles que entran, números que cuentan y el cursor. Hay algo nuevo en pantalla cada 1 a 3 s.
- **Subtítulos palabra a palabra:** de 1 a 3 palabras, en mayúsculas gruesas, sobre una pastilla oscura semitransparente, a 3/4 de la altura. La palabra clave va en **naranja**. Cambian con cada palabra.
- **Stickers:** etiquetas naranjas inclinadas con sombra que "golpean" al entrar: VIRALES, +120 REGLAS, LO MÁS LOCO, PALABRA A PALABRA, 100% AUTOMÁTICO.
- **Títulos grandes** en blanco con una palabra en cursiva naranja ("VÍDEOS *cada día*").
- **Paleta:** negro y gris carbón, blanco y un solo color de acento (naranja). En otro video se cambia el acento por el color de la marca.
- **Gancho (0 a 3 s):** una frase imposible ("se despierta todas las madrugadas y trabaja mientras yo duermo") con imagen nocturna.
- **Prueba en el video:** "este que estás viendo lo hizo él".
- **Cierre en loop:** termina en la misma escena del inicio con el reloj en 03:54, un minuto antes del arranque. Así, al repetirse, parece continuo y sube la retención.
- **Llamada a la acción:** "comenta MÁQUINA". Abre el teclado escribiendo la palabra y responde con un mensaje automático (por ejemplo, ManyChat).

## 2. Cómo hacerlo desde el chat (qué se necesita)
| Pieza | Cómo | ¿Gasta créditos? |
|---|---|---|
| App animada, cursor, números, stickers, subtítulos | HTML y Playwright (igual que `edicion/capa.html`) | No |
| Escena de fondo (cuarto, escritorio, oficina) | Una imagen generada **una vez** y luego movimiento suave en código (paralaje, luz) | Poco: 1 imagen |
| Avatar del cliente o de la marca | Generarlo **una vez** con IA desde una foto (Higgsfield o Nano Banana) y reusarlo. Gestos sencillos (rebotar, saludar) en código o con unos clips cortos | Poco al inicio |
| Voz | Clonada en ElevenLabs con permiso del dueño de la voz, o una voz de catálogo | Sí, por minuto |
| Música | Sintetizada (numpy) o ElevenLabs Music | No / poco |
| Armado final | ffmpeg (mezcla aparte, revisión con whisper) | No |

## 3. La máquina que explica (el sistema)
1. **Buscar:** revisa cada noche miles de reels del nicho (más de 3,700).
2. **Filtrar:** se queda con los que **reventaron por encima de lo normal de su propio creador** (vistas ÷ promedio del creador), no con los que tienen más vistas.
3. **Desarmar:** los baja, los transcribe y anota el gancho, la estructura y cada plano.
4. **Reescribir:** escribe un guion nuevo con un manual de reglas de gancho (él dice tener más de 120).
5. **Producir:** narra con la voz clonada, anima las escenas y pone los subtítulos.
6. **Publicar:** programa y publica en Instagram.
7. **Aprender:** cuando uno revienta, hace variaciones (otro gancho, otro color, otro encuadre) como **reels de prueba** que solo ve gente que todavía no lo sigue.
8. **El humano solo aprueba:** un botón "Aprobar" al final.
