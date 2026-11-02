// Render de lecciones (1920×1080), en partes para que sea rápido sin tarjeta de video:
// las partes con 3D (intro y entrada de cada bloque) necesitan WebGL por software (swangle),
// que obliga a todas las pestañas a compartir un solo proceso lento; el resto va con 'egl',
// unas cuatro veces más rápido. Al final se unen las partes y se pone el audio completo.
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { spawnSync } from 'node:child_process'
import { cpus } from 'node:os'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { preparar, opciones } from '../fabrica/render.mjs'

const TITULO = 42 // igual que en src/curso/Leccion.tsx

/** Tramos [desde, hasta] con 3D: toda la intro y la entrada de cada bloque. */
function tramos3D(props) {
  const t = []
  for (const e of props.escenas) {
    if (e.tipo === 'intro') t.push([e.inicio, e.inicio + e.dur - 1])
    else if (e.bloque) t.push([e.inicio, e.inicio + TITULO - 1])
  }
  return t
}

/** Todo el video partido en tramos, cada uno con el motor que le toca. */
function partes(props) {
  const con3D = tramos3D(props).sort((a, b) => a[0] - b[0])
  const lista = []
  let cursor = 0
  for (const [a, b] of con3D) {
    if (a > cursor) lista.push({ desde: cursor, hasta: a - 1, gl: 'egl' })
    lista.push({ desde: Math.max(a, cursor), hasta: b, gl: 'swangle' })
    cursor = b + 1
  }
  if (cursor < props.total) lista.push({ desde: cursor, hasta: props.total - 1, gl: 'egl' })
  return lista
}

export async function renderVideo(props, salida) {
  const serveUrl = await preparar()
  const base = { serveUrl, inputProps: props, browserExecutable: opciones.browserExecutable }
  const tmp = join(dirname(salida), 'partes')
  // Las partes ya hechas se reusan: si algo falla, se retoma donde se quedó.
  mkdirSync(tmp, { recursive: true })
  const lista = partes(props)
  const hechos = []
  let listos = 0
  for (const [i, p] of lista.entries()) {
    const archivo = join(tmp, `${p.desde}-${p.hasta}.mp4`)
    if (!existsSync(archivo)) {
      const intento = async (gl) => {
        const chromiumOptions = { gl }
        const composition = await selectComposition({ ...base, id: 'Leccion', chromiumOptions })
        await renderMedia({ ...base, composition, chromiumOptions, codec: 'h264', crf: 18, muted: true, frameRange: [p.desde, p.hasta], outputLocation: `${archivo}.tmp.mp4`, concurrency: gl === 'swangle' ? 2 : cpus().length })
      }
      try {
        await intento(p.gl)
      } catch (err) {
        // Si una parte rápida se topa con algo en 3D, se repite con el motor que sí lo dibuja.
        if (p.gl === 'swangle') throw err
        console.log(`… la parte ${p.desde}-${p.hasta} necesita 3D, la repito con swangle`)
        await intento('swangle')
      }
      spawnSync('mv', [`${archivo}.tmp.mp4`, archivo])
    }
    hechos.push(archivo)
    listos += p.hasta - p.desde + 1
    console.log(`… ${Math.round((listos / props.total) * 100)}% (${p.gl})`)
  }
  const audio = join(tmp, 'audio.wav')
  mezclarAudio(props, audio)
  const listaTxt = join(tmp, 'lista.txt')
  writeFileSync(listaTxt, hechos.map((h) => `file '${h}'`).join('\n'))
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listaTxt, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', salida], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`No pude unir las partes: ${r.stderr}`)
  rmSync(tmp, { recursive: true, force: true })
  return salida
}

/**
 * El audio completo con ffmpeg (en Remotion habría que recorrer todos los cuadros otra vez):
 * cada voz en su lugar, whoosh al entrar cada pantalla, golpe en cada bloque y la música
 * con el mismo volumen que en src/curso/Leccion.tsx (alta sin voz, baja debajo de la voz).
 */
function mezclarAudio(props, salida) {
  const PUB = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
  const FPS = 30
  const entradas = []
  const capas = []
  const etiquetas = []
  const poner = (archivo, segundo, volumen) => {
    const k = entradas.length / 2 // cada entrada son dos argumentos: -i y el archivo
    entradas.push('-i', join(PUB, archivo))
    etiquetas.push(`[a${k}]`)
    const ms = Math.max(0, Math.round(segundo * 1000))
    capas.push(`[${k}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${volumen},adelay=${ms}|${ms}[a${k}]`)
  }
  for (const e of props.escenas) {
    poner(e.voz, (e.inicio + e.vozDesde) / FPS, 1)
    for (const s of e.pantallas ?? []) poner('sonidos/whoosh.wav', (e.inicio + Math.max(0, s.inicio - 4)) / FPS, 0.4)
    if (e.bloque || e.tipo !== 'pantallas') poner('sonidos/impacto.wav', e.inicio / FPS, 0.6)
  }
  const total = props.total / FPS
  const k = entradas.length / 2
  entradas.push('-i', join(PUB, props.musica))
  etiquetas.push('[m]')
  // Volumen de la música por tramos (mismos puntos que Leccion.tsx).
  const v = `if(lt(t,0.83),0.32*t/0.83,if(lt(t,1.5),0.32-(0.19*(t-0.83)/0.67),if(lt(t,${(total - 3.67).toFixed(2)}),0.13,if(lt(t,${(total - 2.33).toFixed(2)}),0.13+0.17*(t-${(total - 3.67).toFixed(2)})/1.33,0.3*(${total.toFixed(2)}-t)/2.33))))`
  capas.push(`[${k}:a]aresample=48000,aformat=channel_layouts=stereo,volume='${v}':eval=frame[m]`)
  const todas = etiquetas.join('')
  const filtro = `${capas.join(';')};${todas}amix=inputs=${capas.length}:normalize=0:duration=longest,atrim=0:${total.toFixed(3)},alimiter=limit=0.95[out]`
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...entradas, '-filter_complex', filtro, '-map', '[out]', '-ar', '48000', salida], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`No pude mezclar el audio: ${r.stderr}`)
}

export async function cuadroDe(props, cuadro, salida) {
  const serveUrl = await preparar()
  const composition = await selectComposition({ serveUrl, id: 'Leccion', inputProps: props, ...opciones })
  await renderStill({ serveUrl, composition, inputProps: props, frame: cuadro, output: salida, scale: 0.5, ...opciones })
  return salida
}
