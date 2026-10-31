// Las 3 muestras de estilo: gancho, frase y narrado. Deja los MP4 en salida/muestras.
//   node fabrica/muestras.mjs          las tres
//   node fabrica/muestras.mjs frase    solo una
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderReel } from './render.mjs'
import { tiemposDePalabras } from './tiempos.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const SALIDA = join(RAIZ, 'salida', 'muestras')
mkdirSync(SALIDA, { recursive: true })

const sonidos = { whoosh: 'sonidos/whoosh.wav', impacto: 'sonidos/impacto.wav' }
const firma = process.env.REELS_FIRMA || '@nxusai'
const guion = 'Tu competencia ya está usando inteligencia artificial. La pregunta es: ¿quién se la va a vender a tus clientes?'

const muestras = [
  ['1-gancho', {
    tipo: 'gancho', clip: 'muestras/fondo-1.png', esImagen: true, duracion: 8,
    texto: 'Esta empresa me paga cada mes por algo que hice en una tarde', resaltar: ['cada', 'mes'],
    remate: 'Comenta JARVIS', firma, camara: 'empuje', letras: 'estirar', formas: true, pieza3D: 'cristal', sonidos, semilla: 0,
  }],
  ['2-frase', {
    tipo: 'frase', clip: 'muestras/fondo-2.png', esImagen: true, duracion: 9,
    texto: 'Nadie te va a dar permiso. Empieza.', resaltar: ['empieza'],
    firma, camara: 'paneo', letras: 'cinetico', formas: true, pieza3D: 'ninguna', cine: true, sonidos: { whoosh: sonidos.whoosh }, semilla: 1,
  }],
  ['3-narrado', {
    tipo: 'narrado', clip: 'muestras/fondo-3.png', esImagen: true, duracion: 10,
    texto: '¿Quién se la va a vender?', resaltar: ['vender'],
    voz: 'muestras/voz.wav', palabras: tiemposDePalabras(join(RAIZ, 'public', 'muestras', 'voz.wav'), guion, 0.35),
    firma, camara: 'seguir', letras: 'estirar', formas: false, pieza3D: 'anillo', sonidos, semilla: 2,
  }],
]

const solo = process.argv[2]
for (const [nombre, props] of muestras.filter(([n]) => !solo || n.includes(solo))) {
  const t = Date.now()
  await renderReel(props, join(SALIDA, `${nombre}.mp4`))
  console.log(`✅ ${nombre}.mp4 (${Math.round((Date.now() - t) / 1000)} s)`)
}
