# Video "Mi mejor empleado no duerme" (NXUS, 18 nov 2026)

32.3 s, 9:16, 1.65 créditos (solo la voz). Tema elegido por el chat: un día completo de la IA de un negocio (3 AM contesta, 9 AM llama y agenda, mediodía atiende a varios, 10 PM todo guardado).

Lo nuevo frente a `ads/pos-come-todo/`: **la cámara sigue a la IA en una sola toma.**
- Todo vive en un "mundo" ancho con 7 estaciones (`P`). `camara(t)` da posición, acercamiento y giro: se queda en cada estación con un empuje lento y viaja a la siguiente con latigazo (`VIAJES`), alejándose a medio vuelo.
- Capas con distinta profundidad (`capa(c, p, …)`): estrellas (0.06), relojes gigantes y figuras (0.5), el mundo (1) y luces al frente (1.7). Eso da la sensación de cámara real.
- En los viajes: desenfoque según la velocidad de la cámara, líneas de velocidad y un destello al llegar.
- La IA es un núcleo de luz (`orbe`) con estela que sale antes que la cámara; en "inteligencia artificial" crece con golpe de cámara y luego se vuelve el logo.
- Reloj del día arriba y fondo que cambia de color con la hora.
- El final regresa volando a la primera imagen para el loop.

Cómo se rehace: igual que `ads/pos-come-todo/LEEME.md` (versión 2): voz Mark de Higgsfield (`text2speech_v2`, `elevenlabs`) con el guion de `voz2.py` escribiendo "Nexus ey ay"; `voz2.py` quita huecos y alinea palabras; `node tomar.cjs video 0 32.3`; `musica.py`; mezcla aparte. Necesita los recortes `pj_*.png` de las poses (`recorte.py` del otro video; al acostado se le quitó además el hueco gris entre las piernas).

Datos en pantalla: los clientes de la tabla son de ejemplo y lo dice.
