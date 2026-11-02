// Render de lecciones (1920×1080) con el mismo navegador y ajustes que los reels.
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { cpus } from 'node:os'
import { preparar, opciones } from '../fabrica/render.mjs'

export async function renderVideo(props, salida) {
  const serveUrl = await preparar()
  const composition = await selectComposition({ serveUrl, id: 'Leccion', inputProps: props, ...opciones })
  let ultimo = -1
  await renderMedia({ serveUrl, composition, inputProps: props, codec: 'h264', crf: 18, outputLocation: salida, concurrency: Math.max(2, cpus().length), ...opciones,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 20)
      if (p !== ultimo) { ultimo = p; console.log(`… ${p * 5}%`) }
    } })
  return salida
}

export async function cuadroDe(props, cuadro, salida) {
  const serveUrl = await preparar()
  const composition = await selectComposition({ serveUrl, id: 'Leccion', inputProps: props, ...opciones })
  await renderStill({ serveUrl, composition, inputProps: props, frame: cuadro, output: salida, scale: 0.5, ...opciones })
  return salida
}
