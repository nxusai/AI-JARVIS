// Tiempos de cada palabra de una narración, para los subtítulos.
// Se buscan los tramos con voz (entre silencios) y las palabras se reparten en ellos según su largo.
import { spawnSync } from 'node:child_process'

const duracion = (archivo) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo], { encoding: 'utf8' }).stdout.trim())

/** Tramos con voz: [[inicio, fin], …] en segundos. */
export function tramosConVoz(archivo) {
  const total = duracion(archivo)
  const log = spawnSync('ffmpeg', ['-i', archivo, '-af', 'silencedetect=n=-35dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
  const tramos = []
  let desde = 0
  for (const m of log.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    const t = Number(m[2])
    if (m[1] === 'start') { if (t - desde > 0.05) tramos.push([desde, t]) } else desde = t
  }
  if (total - desde > 0.05 && !tramos.some(([, f]) => f >= total - 0.05)) tramos.push([desde, total])
  return tramos
}

/** [{ texto, inicio, fin }] para cada palabra del guion; `retraso` es cuándo empieza la voz en el reel. */
export function tiemposDePalabras(archivo, guion, retraso = 0) {
  const tramos = tramosConVoz(archivo)
  const palabras = guion.split(/\s+/).filter(Boolean)
  const peso = (w) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1
  const totalPeso = palabras.reduce((s, w) => s + peso(w), 0)
  const totalVoz = tramos.reduce((s, [a, b]) => s + (b - a), 0)
  // Recorre el tiempo con voz, saltando los silencios.
  const aReal = (x) => {
    for (const [a, b] of tramos) {
      if (x <= b - a) return a + x
      x -= b - a
    }
    return tramos.at(-1)?.[1] ?? x
  }
  let acumulado = 0
  return palabras.map((texto) => {
    const inicio = aReal((acumulado / totalPeso) * totalVoz)
    acumulado += peso(texto)
    const fin = aReal((acumulado / totalPeso) * totalVoz - 0.001)
    return { texto, inicio: +(inicio + retraso).toFixed(3), fin: +(fin + retraso).toFixed(3) }
  })
}
