// Render de lecciones (1920×1080), en partes para que sea rápido sin tarjeta de video:
// las partes con 3D (intro y entrada de cada bloque) necesitan WebGL por software (swangle),
// que obliga a todas las pestañas a compartir un solo proceso lento; el resto va con 'egl',
// unas cuatro veces más rápido. Al final se unen las partes y se pone el audio completo.
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { spawnSync } from 'node:child_process'
import { cpus } from 'node:os'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })
  const lista = partes(props)
  const hechos = []
  let listos = 0
  for (const [i, p] of lista.entries()) {
    const chromiumOptions = { gl: p.gl }
    const composition = await selectComposition({ ...base, id: 'Leccion', chromiumOptions })
    const archivo = join(tmp, `${String(i).padStart(3, '0')}.mp4`)
    await renderMedia({ ...base, composition, chromiumOptions, codec: 'h264', crf: 18, muted: true, frameRange: [p.desde, p.hasta], outputLocation: archivo, concurrency: p.gl === 'swangle' ? 2 : cpus().length })
    hechos.push(archivo)
    listos += p.hasta - p.desde + 1
    console.log(`… ${Math.round((listos / props.total) * 100)}% (${p.gl})`)
  }
  // Audio completo (voz, música y efectos) en un solo paso: es rápido.
  const composition = await selectComposition({ ...base, id: 'Leccion' })
  const audio = join(tmp, 'audio.wav')
  await renderMedia({ ...base, composition, codec: 'wav', outputLocation: audio, chromiumOptions: { gl: 'egl' } })
  const listaTxt = join(tmp, 'lista.txt')
  writeFileSync(listaTxt, hechos.map((h) => `file '${h}'`).join('\n'))
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listaTxt, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', salida], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`No pude unir las partes: ${r.stderr}`)
  rmSync(tmp, { recursive: true, force: true })
  return salida
}

export async function cuadroDe(props, cuadro, salida) {
  const serveUrl = await preparar()
  const composition = await selectComposition({ serveUrl, id: 'Leccion', inputProps: props, ...opciones })
  await renderStill({ serveUrl, composition, inputProps: props, frame: cuadro, output: salida, scale: 0.5, ...opciones })
  return salida
}
