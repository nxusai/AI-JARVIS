# Video "El jefe que no llega a cenar" (NXUS, 18 nov 2026)

28.5 s, 9:16. Eduardo pidió algo distinto: menos color NXUS, una historia con un jefe estresado en su oficina y su agenda saturada, escenas y transiciones diferentes.

## Qué tiene de distinto
- **Escenas dibujadas con código, cada una con su paleta:** oficina de día (crema y madera), viñetas de cómic (mostaza, rojo, verde), oficina de noche (azul marino con lámpara), golpe rojo, tarjetas claras sobre fondo casi blanco, oficina al atardecer (durazno), casa de noche (morado cálido) y cierre oscuro con tarjeta blanca. El degradado de NXUS solo aparece en el logo, los iconos y una palabra por escena.
- **Una transición distinta en cada cambio** (lista `ESC`): la cámara se mete a la pizarra y entran viñetas deslizándose, barrido de manecilla de reloj, corte seco con destello, iris de luz, persianas, diagonal, empuje hacia arriba e iris de regreso al inicio.
- **El personaje actúa:** `jefe()` le pone temblor, gotas de sudor y marca de enojo; grita alternando las dos caras; de noche sale inclinado y apagado; luego camina y festeja.
- `oficina(t, modo)` dibuja la misma oficina en 'dia', 'noche' o 'tarde' (ventana, pizarra con la agenda, reloj de pared con la hora, escritorio, papeles que se apilan). `agenda(w, h, 'lleno' | 'orden')` es el calendario saturado o acomodado.
- **Música en dos ánimos** (`musica.py`): tensa con tic-tac hasta "ahora imagina esto", luminosa después.
- Subtítulos con la palabra clave en amarillo durante el problema y en azul claro en la solución.

## Cómo se rehace
Igual que `ads/pos-come-todo/LEEME.md` (versión 2). La voz es Mark de Higgsfield (`text2speech_v2`, `elevenlabs`). **Ojo con el nombre:** al final de una frase ("Eso hacemos en Nexus ey ay.") no quedó claro, así que el cierre se regrabó con el nombre a media frase ("En Nexus ey ay lo hacemos realidad.") y se pegó. `voz2.py` lee `junta.wav` (la voz ya pegada).
