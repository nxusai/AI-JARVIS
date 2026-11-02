// Arma una lección: toma el guion (cursos/leccion-N.json), las grabaciones y las voces, y calcula
// cada tiempo para que no haya huecos: cada escena dura lo que su voz, y cada pantalla entra
// justo cuando la voz dice su palabra clave.
//
//   node cursos/leccion.mjs cursos/leccion-1.json            props en salida/curso/<id>/props.json
//   node cursos/leccion.mjs cursos/leccion-1.json --render   y el video
//   node cursos/leccion.mjs cursos/leccion-1.json --cuadros  solo algunos cuadros para revisar
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tiemposDePalabras } from '../fabrica/tiempos.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const FPS = 30
const guion = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const bandera = process.argv[3]
const PUB = join(RAIZ, 'public')
const base = `curso/${guion.id}`
const tomas = JSON.parse(readFileSync(join(PUB, base, 'tomas.json'), 'utf8'))
const duracion = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim()) || 0
/** Primer segundo (desde `minimo`) en que la grabación ya tiene contenido: la página terminó de cargar. */
function arranque(archivo, minimo) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', archivo, '-an', '-vf', 'fps=4,scale=320:-2,signalstats,metadata=print', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const luz = []
  let t = null
  for (const l of r.stderr.split('\n')) {
    const a = l.match(/pts_time:([\d.]+)/)
    if (a) t = Number(a[1])
    const y = l.match(/YAVG=([\d.]+)/)
    if (y && t != null) luz.push([t, Number(y[1])])
  }
  // El primer cuadro en blanco (antes de cargar) no cuenta.
  const max = Math.max(...luz.filter(([s]) => s >= minimo).map(([, y]) => y))
  return luz.find(([s, y]) => s >= minimo && y >= max * 0.6)?.[0] ?? minimo
}
const limpia = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

const INTRO_ANTES = 1.2 // la intro respira antes de la voz
const BLOQUE_ANTES = 0.9 // el título del bloque se ve antes de que hable
const DESPUES = 0.45 // aire al final de cada escena
const CIERRE = 3.5 // la marca al final

/** Segundo (dentro de la voz) en que se dice `clave`, buscando desde la palabra `desde`. */
function cuando(palabras, clave, desde = 0) {
  const k = palabras.findIndex((p, i) => i >= desde && limpia(p.texto) === limpia(clave))
  if (k < 0) throw new Error(`No encontré "${clave}" en la narración`)
  return { t: palabras[k].inicio, i: k }
}

let cursor = 0
const escenas = guion.escenas.map((e) => {
  const voz = join(PUB, base, e.voz)
  const largoVoz = duracion(voz)
  const antes = e.tipo === 'intro' ? INTRO_ANTES : e.bloque ? BLOQUE_ANTES : 0.15
  const palabras = tiemposDePalabras(voz, e.guion, antes)
  // Un ejemplo de audio (el resultado de la herramienta) suena después de la narración.
  const sonido = e.sonido ? { src: `${base}/${e.sonido}`, largo: duracion(join(PUB, base, e.sonido)) } : null
  const dur = Math.round((antes + largoVoz + DESPUES + (sonido ? sonido.largo + 0.6 : 0) + (e.tipo === 'final' ? CIERRE : 0)) * FPS)
  const escena = { tipo: e.tipo, inicio: cursor, dur, voz: `${base}/${e.voz}`, vozDesde: Math.round(antes * FPS), palabras }
  if (e.bloque) escena.bloque = { numero: e.bloque, nombre: guion.bloques[e.bloque - 1] }
  if (sonido) escena.sonido = { src: sonido.src, desde: Math.round((antes + largoVoz + 0.3) * FPS) }

  if (e.pantallas) {
    // Cortes: la primera entra al empezar; las demás un poco antes de que se nombren.
    let desde = 0
    const cortes = e.pantallas.map((p, i) => {
      if (i === 0 || !p.clave) return 0
      const c = cuando(palabras, p.clave, desde)
      desde = c.i
      return Math.round((c.t - 0.35) * FPS)
    })
    const fin0 = (i) => (i < cortes.length - 1 ? cortes[i + 1] + 9 : dur)
    escena.pantallas = e.pantallas.map((p, i) => {
      // Resultado real de la herramienta (imagen, video o audio generados), sin navegador alrededor.
      if (p.resultado) return { resultado: p.resultado, src: p.archivo ? `${base}/${p.archivo}` : '', esImagen: p.resultado === 'imagen', desde: 0, inicio: cortes[i], dur: fin0(i) - cortes[i], etiqueta: p.etiqueta, descripcion: p.descripcion, texto: p.texto }
      const toma = tomas.find((t) => t.nombre === p.toma)
      const esImagen = !toma && existsSync(join(PUB, base, `${p.toma}.png`))
      const inicio = cortes[i]
      const fin = fin0(i) // se enciman 9 cuadros para el giro
      // Si la grabación es más corta que su turno, va un poco más lenta para no congelarse.
      // El guion puede fijar desde qué segundo se usa la grabación (si la página salta después).
      const desde = esImagen ? 0 : p.desde ?? arranque(join(PUB, base, `${p.toma}.webm`), toma.lista + 0.3)
      const hastaMax = p.hasta
      const disponible = esImagen ? 99 : (hastaMax ?? duracion(join(PUB, base, `${p.toma}.webm`)) - 0.3) - desde
      const velocidad = Math.min(1, Math.max(0.35, disponible / ((fin0(i) - inicio) / FPS)))
      // La copia .mp4 (h264) se lee mucho más rápido que la grabación .webm.
      const pantalla = { src: `${base}/${p.toma}.${esImagen ? 'png' : existsSync(join(PUB, base, `${p.toma}.mp4`)) ? 'mp4' : 'webm'}`, esImagen, desde, velocidad, inicio, dur: fin - inicio, etiqueta: p.etiqueta, descripcion: p.descripcion, url: p.url }
      if (p.zoom) {
        const za = cuando(palabras, p.zoom.palabra)
        const a = za.t
        // "hasta" se busca después de la palabra donde empieza el acercamiento.
        const b = p.zoom.hasta ? cuando(palabras, p.zoom.hasta, za.i).t : a + 2
        pantalla.zoom = { x: p.zoom.x, y: p.zoom.y, escala: p.zoom.escala, desde: Math.round(a * FPS) - inicio, hasta: Math.round(b * FPS) - inicio }
      }
      return pantalla
    })
  }
  if (e.marcas) {
    let desde = 0
    escena.marcas = e.marcas.map((m) => {
      const c = cuando(palabras, m, desde)
      desde = c.i
      return Math.round(c.t * FPS)
    })
  }
  if (e.miniaturas) {
    // Un cuadro fijo de cada grabación para las tarjetas del cierre.
    escena.miniaturas = e.miniaturas.map((n) => {
      const png = join(PUB, base, `${n}.png`)
      if (existsSync(png)) return `${base}/${n}.png`
      const toma = tomas.find((t) => t.nombre === n)
      const mini = join(PUB, base, `mini-${n}.jpg`)
      if (!existsSync(mini)) spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(toma.lista + 2), '-i', join(PUB, base, `${n}.webm`), '-frames:v', '1', '-vf', 'scale=600:-1', mini])
      return `${base}/mini-${n}.jpg`
    })
  }
  cursor += dur
  return escena
})

const props = { curso: guion.curso, numero: guion.numero, titulo: guion.tituloCorto, tituloIntro: guion.tituloIntro ?? 'HIGGSFIELD', bloques: guion.bloques, musica: `${base}/musica.wav`, total: cursor, escenas }
const SALIDA = join(RAIZ, 'salida', 'curso', guion.id)
mkdirSync(SALIDA, { recursive: true })
writeFileSync(join(SALIDA, 'props.json'), JSON.stringify(props, null, 2))
console.log(`Lección ${guion.numero}: ${(cursor / FPS).toFixed(1)} s, ${escenas.length} escenas`)

// La música se compone a la medida.
const musica = join(PUB, base, 'musica.wav')
if (!existsSync(musica) || Math.abs(duracion(musica) - cursor / FPS) > 0.5) {
  spawnSync('python3', [join(RAIZ, 'cursos', 'musica.py'), String(cursor / FPS), musica, String(escenas[1].inicio / FPS)], { stdio: 'inherit' })
}

if (bandera === '--cuadros' || bandera === '--render') {
  const { renderVideo, cuadroDe } = await import('./render-leccion.mjs')
  if (bandera === '--cuadros') {
    const momentos = (process.argv[4] ?? '').split(',').filter(Boolean).map(Number)
    const lista = momentos.length ? momentos : escenas.flatMap((e) => [e.inicio + 20, e.inicio + Math.round(e.dur * 0.5)])
    for (const c of lista) await cuadroDe(props, c, join(SALIDA, `cuadro-${c}.png`))
    console.log(`Cuadros en ${SALIDA}`)
  } else {
    const t = Date.now()
    await renderVideo(props, join(SALIDA, `leccion-${guion.numero}.mp4`))
    console.log(`✅ ${join(SALIDA, `leccion-${guion.numero}.mp4`)} en ${Math.round((Date.now() - t) / 60000)} min`)
  }
}
