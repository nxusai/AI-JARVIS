// Para revisar cada clip antes de usarlo: no todo lo que se graba sirve.
//
//   node fabrica/revisar.mjs          los clips de crudos/ que todavía no están en seleccion.json
//   node fabrica/revisar.mjs 7.mp4    uno en particular
//
// Por cada clip deja en salida/revision/:
//   7-1.jpg, 7-2.jpg…   hojas de contacto: un cuadro por segundo con su tiempo, 30 por hoja
//   7.txt               por segundo: luz y nitidez, marcando lo oscuro, borroso o movido
// Claude mira las hojas y anota en seleccion.json solo los tramos que sirven:
//   { "7.mp4": [{ "desde": 12, "hasta": 21, "nota": "mira a cámara y señala a la derecha", "encuadre": 30, "textoArriba": true }], "8.mp4": [] }
// encuadre: dónde está lo importante (0 izquierda – 100 derecha); textoArriba: si el centro no se debe tapar.
// Un clip con [] queda descartado; uno que no está en seleccion.json no se usa hasta revisarlo.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const CRUDOS = join(RAIZ, 'crudos')
const SALIDA = join(RAIZ, 'salida', 'revision')
export const SELECCION = join(RAIZ, 'seleccion.json')
const POR_HOJA = 30
const LETRA = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

const correr = (args) => spawnSync('ffmpeg', ['-hide_banner', ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
const duracion = (archivo) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo], { encoding: 'utf8' }).stdout.trim()) || 0

export const leerSeleccion = () => (existsSync(SELECCION) ? JSON.parse(readFileSync(SELECCION, 'utf8')) : {})

/** Luz (0–255) y borrosidad por segundo. */
function medir(archivo) {
  const r = correr(['-i', archivo, '-an', '-vf', 'fps=1,scale=360:-2,signalstats,blurdetect,metadata=print', '-f', 'null', '-'])
  const filas = []
  let actual = null
  for (const linea of r.stderr.split('\n')) {
    const t = linea.match(/pts_time:([\d.]+)/)
    if (t) filas.push((actual = { t: Math.round(Number(t[1])) }))
    const y = linea.match(/lavfi\.signalstats\.YAVG=([\d.]+)/)
    if (y && actual) actual.luz = Math.round(Number(y[1]))
    const b = linea.match(/lavfi\.blur=([\d.]+)/)
    if (b && actual) actual.borroso = +Number(b[1]).toFixed(1)
  }
  return filas
}

/**
 * Copia de trabajo: derecha (aplica el giro que trae la cámara), lado corto a 1080, 30 fps y sin audio.
 * El original queda como clip.original.ext; todo lo demás usa la copia. Así no importa con qué
 * cámara se grabó, y el render es más rápido.
 */
export function normalizar(clip) {
  const archivo = join(CRUDOS, clip)
  const original = archivo.replace(/(\.[^.]+)$/, '.original$1')
  if (existsSync(original)) return
  renameSync(archivo, original)
  const r = correr(['-i', original, '-an', '-vf', "scale='if(gt(iw,ih),-2,1080)':'if(gt(iw,ih),1080,-2)',fps=30,format=yuv420p", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-movflags', '+faststart', '-y', archivo])
  if (r.status !== 0) {
    renameSync(original, archivo)
    throw new Error(`No pude preparar ${clip}: ${r.stderr.split('\n').slice(-3).join(' ')}`)
  }
}

export function revisar(clip) {
  normalizar(clip)
  const archivo = join(CRUDOS, clip)
  const nombre = basename(clip).replace(/\.[^.]+$/, '')
  const total = duracion(archivo)
  mkdirSync(SALIDA, { recursive: true })
  for (const f of readdirSync(SALIDA)) if (f.startsWith(`${nombre}-`) || f === `${nombre}.txt`) rmSync(join(SALIDA, f))

  const hojas = Math.max(1, Math.ceil(total / POR_HOJA))
  // Clips horizontales: cuadros acostados, para ver dónde está el sujeto y decidir el recorte a vertical.
  const [ancho, alto] = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', archivo], { encoding: 'utf8' }).stdout.trim().split(',').map(Number)
  const acostado = ancho > alto
  const [cw, ch, rejilla] = acostado ? [320, 180, '5x6'] : [180, 320, '6x5']
  for (let h = 0; h < hojas; h++) {
    const salida = join(SALIDA, `${nombre}-${h + 1}.jpg`)
    correr(['-ss', String(h * POR_HOJA), '-t', String(POR_HOJA), '-i', archivo, '-an', '-vf',
      `fps=1,scale=${cw}:${ch}:force_original_aspect_ratio=decrease,pad=${cw}:${ch}:(ow-iw)/2:(oh-ih)/2,${acostado ? `drawgrid=w=iw/10:h=ih:t=1:c=white@0.25,` : ''}drawtext=fontfile=${LETRA}:text='%{eif\\:t+${h * POR_HOJA}\\:d}s':x=6:y=6:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=${rejilla}:padding=4:color=black`,
      '-frames:v', '1', '-y', salida])
  }

  const filas = medir(archivo)
  const marca = (f) => [f.luz != null && f.luz < 35 ? 'OSCURO' : '', f.borroso != null && f.borroso > 8 ? 'BORROSO' : ''].filter(Boolean).join(' ')
  const texto = [`${clip} · ${total.toFixed(1)} s · ${hojas} hoja(s)`, 'seg  luz  borroso', ...filas.map((f) => `${String(f.t).padStart(3)}  ${String(f.luz ?? '-').padStart(3)}  ${String(f.borroso ?? '-').padStart(6)}  ${marca(f)}`)].join('\n')
  writeFileSync(join(SALIDA, `${nombre}.txt`), texto + '\n')
  return { clip, total, hojas, acostado }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pedido = process.argv[2]
  const ya = leerSeleccion()
  const clips = pedido ? [pedido] : readdirSync(CRUDOS).filter((f) => /^\d+\.(mp4|mov|m4v|webm)$/i.test(f) && !(f in ya)).sort((a, b) => Number.parseInt(a) - Number.parseInt(b))
  if (!clips.length) console.log('No hay clips nuevos por revisar.')
  for (const c of clips) {
    const r = revisar(c)
    console.log(`👀 ${c}: ${r.total.toFixed(1)} s${r.acostado ? ' (horizontal: rejilla cada 10 % para el recorte)' : ''} → ${r.hojas} hoja(s) en salida/revision/`)
  }
}
