// Para revisar cada clip antes de usarlo: no todo lo que se graba sirve.
//
//   node fabrica/revisar.mjs          los clips de crudos/ que todavía no están en seleccion.json
//   node fabrica/revisar.mjs 7.mp4    uno en particular
//
// Por cada clip deja en salida/revision/:
//   7-1.jpg, 7-2.jpg…   hojas de contacto: un cuadro por segundo con su tiempo, 30 por hoja
//   7.txt               por segundo: luz y nitidez, marcando lo oscuro, borroso o movido
// Claude mira las hojas y anota en seleccion.json solo los tramos que sirven:
//   { "7.mp4": [{ "desde": 12, "hasta": 21, "nota": "mira a cámara y señala a la derecha" }], "8.mp4": [] }
// Un clip con [] queda descartado; uno que no está en seleccion.json no se usa hasta revisarlo.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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

export function revisar(clip) {
  const archivo = join(CRUDOS, clip)
  const nombre = basename(clip).replace(/\.[^.]+$/, '')
  const total = duracion(archivo)
  mkdirSync(SALIDA, { recursive: true })
  for (const f of readdirSync(SALIDA)) if (f.startsWith(`${nombre}-`) || f === `${nombre}.txt`) rmSync(join(SALIDA, f))

  const hojas = Math.max(1, Math.ceil(total / POR_HOJA))
  for (let h = 0; h < hojas; h++) {
    const salida = join(SALIDA, `${nombre}-${h + 1}.jpg`)
    correr(['-ss', String(h * POR_HOJA), '-t', String(POR_HOJA), '-i', archivo, '-an', '-vf',
      `fps=1,scale=180:320:force_original_aspect_ratio=decrease,pad=180:320:(ow-iw)/2:(oh-ih)/2,drawtext=fontfile=${LETRA}:text='%{eif\\:t+${h * POR_HOJA}\\:d}s':x=6:y=6:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.6,tile=6x5:padding=4:color=black`,
      '-frames:v', '1', '-y', salida])
  }

  const filas = medir(archivo)
  const marca = (f) => [f.luz != null && f.luz < 35 ? 'OSCURO' : '', f.borroso != null && f.borroso > 8 ? 'BORROSO' : ''].filter(Boolean).join(' ')
  const texto = [`${clip} · ${total.toFixed(1)} s · ${hojas} hoja(s)`, 'seg  luz  borroso', ...filas.map((f) => `${String(f.t).padStart(3)}  ${String(f.luz ?? '-').padStart(3)}  ${String(f.borroso ?? '-').padStart(6)}  ${marca(f)}`)].join('\n')
  writeFileSync(join(SALIDA, `${nombre}.txt`), texto + '\n')
  return { clip, total, hojas }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pedido = process.argv[2]
  const ya = leerSeleccion()
  const clips = pedido ? [pedido] : readdirSync(CRUDOS).filter((f) => /^\d+\.(mp4|mov|m4v|webm)$/i.test(f) && !(f in ya)).sort((a, b) => Number.parseInt(a) - Number.parseInt(b))
  if (!clips.length) console.log('No hay clips nuevos por revisar.')
  for (const c of clips) {
    const r = revisar(c)
    console.log(`👀 ${c}: ${r.total.toFixed(1)} s → ${r.hojas} hoja(s) en salida/revision/`)
  }
}
