// Renderiza reels con Remotion, sin abrir nada: se le pasan los datos de cada reel y deja el MP4.
import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

// En la nube usamos el navegador que ya trae la máquina; en la Mac, Remotion baja el suyo.
const NAVEGADOR = process.env.REELS_NAVEGADOR || ['/opt/pw-browsers/chromium_headless_shell-1243/chrome-linux/headless_shell', '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell'].find(existsSync) || null
const opciones = { browserExecutable: NAVEGADOR, chromiumOptions: { gl: process.env.REELS_GL || (NAVEGADOR ? 'swangle' : 'angle') } }

let paquete = null
/** Empaqueta el proyecto una vez por corrida. */
export async function preparar() {
  paquete ??= await bundle({ entryPoint: join(RAIZ, 'src', 'index.ts'), publicDir: join(RAIZ, 'public') })
  return paquete
}

/** Un reel a MP4. */
export async function renderReel(props, salida) {
  const serveUrl = await preparar()
  const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps: props, ...opciones })
  await renderMedia({ serveUrl, composition, inputProps: props, codec: 'h264', crf: 18, outputLocation: salida, concurrency: 2, ...opciones })
  return salida
}

/** Un cuadro a PNG, para revisar antes de renderizar todo. */
export async function cuadro(props, segundo, salida) {
  const serveUrl = await preparar()
  const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps: props, ...opciones })
  await renderStill({ serveUrl, composition, inputProps: props, frame: Math.round(segundo * composition.fps), output: salida, scale: 0.5, ...opciones })
  return salida
}
