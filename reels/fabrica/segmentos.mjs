// Las tomas de cada clip: solo los tramos que Claude marcó como buenos en seleccion.json
// (ver revisar.mjs). Un tramo largo se parte en tomas de hasta 10 s, cortando donde cambia
// la escena para que una toma no brinque a mitad del reel. Lo que dura menos de 4 s no se usa.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

export const LARGO = 10
const MINIMO = 4
const IMAGEN = /\.(jpe?g|png|webp)$/i

const duracion = (archivo) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo], { encoding: 'utf8' }).stdout.trim()) || 0

/** Segundos donde cambia la escena. */
function cortes(archivo) {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-i', archivo, '-an', '-vf', "scale=160:-2,select='gt(scene,0.35)',showinfo", '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stderr
  return [...log.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]))
}

/**
 * Las tomas de un clip: [{ id: "7.mp4@20", clip: "7.mp4", desde, largo, nota }].
 * `tramos` son los de seleccion.json; sin tramos (clip sin revisar) no hay tomas.
 */
export function tomasDe(carpeta, clip, tramos) {
  if (!tramos) return []
  if (IMAGEN.test(clip)) return tramos.length ? [{ id: `${clip}@0`, clip, desde: 0, largo: LARGO, nota: tramos[0].nota }] : []
  const total = duracion(join(carpeta, clip))
  const escenas = tramos.length ? cortes(join(carpeta, clip)) : []
  const tomas = []
  for (const tramo of tramos) {
    const inicio = Math.max(0, tramo.desde)
    const fin = Math.min(total, tramo.hasta)
    const bordes = [inicio, ...escenas.filter((t) => t > inicio + 0.5 && t < fin - 0.5), fin]
    for (let i = 0; i < bordes.length - 1; i++) {
      let desde = bordes[i]
      const hasta = bordes[i + 1]
      while (hasta - desde >= MINIMO) {
        // Si sobra un pedazo chico al final, se reparte para que ninguna toma quede corta.
        const resto = hasta - desde
        const largo = resto > LARGO && resto < LARGO + MINIMO ? resto / 2 : Math.min(LARGO, resto)
        tomas.push({ id: `${clip}@${Math.round(desde)}`, clip, desde: +desde.toFixed(2), largo: +largo.toFixed(2), nota: tramo.nota })
        desde += largo
      }
    }
  }
  return tomas
}
