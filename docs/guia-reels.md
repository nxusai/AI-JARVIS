# Estudio de Reels — guía

Tú grabas, Nexy edita. El estudio convierte tus grabaciones crudas (hablando a
cámara, videos con subtítulos, tutoriales, mini vlogs) en Reels listos para
Instagram, y aprende cómo te gustan.

## Instalación (una sola vez, en tu Mac)

```bash
brew install ffmpeg whisper-cpp
npm run reels:setup        # descarga el modelo de transcripción (~1.6 GB)
```

Luego reinicia Nexy (`Ctrl + C` y `npm start`). Con `npm run reels:setup -- estado`
ves qué está instalado.

La transcripción corre **en tu Mac** con whisper.cpp: gratis, privada y rápida
en Apple silicon. Si no la instalas pero tienes una llave de ElevenLabs, usa
ElevenLabs Scribe. Sin ninguna de las dos, igual corta pausas, pero sin subtítulos.

## Cómo se usa (por voz o por Telegram)

1. **Mándale tu video** por Telegram (o por AirDrop a `Películas → Nexy → entrada`).
2. Dile algo como *"edítame este reel"*. Nexy:
   - transcribe y detecta pausas, muletillas ("eh", "mmm") y tomas repetidas;
   - elige un título gancho con tu mejor frase;
   - te manda una vista previa rápida.
3. **Dile qué te gusta y qué no**: *"subtítulos más grandes"*, *"menos zooms"*,
   *"quita la parte donde me trabé"*. Lo vuelve a renderizar en segundos, sin
   transcribir otra vez, y **lo guarda en tu estilo** para que el siguiente reel ya
   salga así.

## Cómo aprende tu estilo

- **Entrevista:** al principio te hace preguntas poco a poco (tema, tono, ritmo,
  subtítulos, colores de marca, zooms, música, duración, qué odias ver).
- **Videos de referencia:** mándale un link (Instagram, TikTok, YouTube) o el video
  de un reel cuya edición te guste. Mide su ritmo (cortes por minuto, duración de
  tomas, silencios, volumen) y mira sus fotogramas para leer los subtítulos,
  colores, encuadre y títulos. Con eso crea un **estilo** con nombre
  (*"estilo hormozi"*, *"mi estilo"*).
- **Tus comentarios:** cada opinión sobre una edición queda anotada y ajusta el estilo.

Todo se guarda en tu Mac: estilos en `~/.nexy/reels/estilos`, tus gustos en
`~/.nexy/reels/gustos.json` y cada proyecto en `~/.nexy/reels/proyectos`. Los
videos terminados quedan en `Películas → Nexy → listos`.

## Qué hace cada edición

| Paso | Qué hace |
|---|---|
| Cortes | Quita pausas largas, muletillas y las partes que tú o Nexy marquen (tomas repetidas) |
| Encuadre | 9:16 recortando al centro de tu cara, o con fondo difuminado para grabaciones de pantalla y tutoriales |
| Zooms | Punch-in en los cortes (golpe) o empuje lento (suave), cada cuántos cortes tú decidas |
| Subtítulos | Palabra por palabra con la palabra resaltada, frases que aparecen (pop) o simples; fuente, tamaño, colores y altura a tu gusto |
| Título gancho | Texto arriba en los primeros segundos |
| Audio | Voz limpia y nivelada al volumen de Instagram (-14 LUFS); música de fondo que baja sola cuando hablas |
| Color | Contraste, saturación y brillo |

Para títulos 3D, motion graphics y efectos más elaborados, Nexy termina el reel
aquí y luego lo pasa al taller de efectos.
