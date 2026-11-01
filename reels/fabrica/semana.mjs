// Arma la semana: 35 reels (5 al día), cada uno con su toma, su texto, sus efectos y su post.
// Un clip largo (hasta 3 min o más) se parte en varias tomas de 10 s: cada toma es un reel distinto.
//
//   node fabrica/semana.mjs 2026-11-02            solo el plan (salida/<semana>/plan.json), para revisarlo
//   node fabrica/semana.mjs 2026-11-02 --render   el plan y los videos
//
// Lee:
//   crudos/          los clips de Drive (1-Crudos), con número: 1.mp4, 2.mov, 3.jpg…
//   seleccion.json   los tramos de cada clip que sí sirven (los marca Claude al revisar, ver revisar.mjs)
//   textos/<semana>.json   los ganchos, frases y narraciones de la semana (los escribe Claude)
//   public/voces/    las narraciones ya generadas (Higgsfield), con el nombre que diga el texto
//   registro.json    qué toma salió en cada reel anterior (para la rotación)
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { repartirTomas } from './rotacion.mjs'
import { leerSeleccion } from './revisar.mjs'
import { tomasDe } from './segmentos.mjs'
import { tiemposDePalabras } from './tiempos.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const CRUDOS = join(RAIZ, 'crudos')
const PUBLICO = join(RAIZ, 'public')
const REGISTRO = join(RAIZ, 'registro.json')

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const HORAS = ['09:00', '12:00', '15:00', '18:00', '21:00']
/** Qué tipo de reel va en cada hora; los narrados alternan con ganchos para no cansar. */
const tipoDe = (dia, hora) => [['gancho'], ['frase'], [dia % 2 ? 'narrado' : 'gancho'], ['frase'], [dia % 2 ? 'cta' : 'narrado']][hora][0]

const CAMARAS = ['empuje', 'seguir', 'paneo', 'orbita']
const PIEZAS = ['cristal', 'ninguna', 'anillo', 'ninguna']
const IMAGEN = /\.(jpe?g|png|webp)$/i
const VIDEO = /\.(mp4|mov|m4v|webm)$/i
/** Lo más lento que se pone una toma corta para llenar el reel (cámara lenta). */
const LENTO = 0.6
const leer = (archivo, siNo) => (existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : siNo)

export function planDeSemana(semana) {
  const textos = leer(join(RAIZ, 'textos', `${semana}.json`), null)
  if (!textos) throw new Error(`Faltan los textos de la semana: textos/${semana}.json`)
  const clips = existsSync(CRUDOS) ? readdirSync(CRUDOS).filter((f) => /^\d+\./.test(f) && !f.includes('.original.') && (IMAGEN.test(f) || VIDEO.test(f))).sort((a, b) => Number.parseInt(a) - Number.parseInt(b)) : []
  const registro = leer(REGISTRO, [])
  const seleccion = leerSeleccion()
  const sinRevisar = clips.filter((c) => !(c in seleccion))
  const tomas = clips.flatMap((c) => tomasDe(CRUDOS, c, seleccion[c]))
  // Los reels viejos (antes de partir en tomas) cuentan como la toma del segundo 0.
  const { orden, aviso } = repartirTomas(tomas, registro.map((r) => r.toma ?? `${r.clip}@0`), DIAS.length * HORAS.length)
  if (!tomas.length) throw new Error(sinRevisar.length ? `Ningún clip revisado todavía (${sinRevisar.join(', ')}): corre node fabrica/revisar.mjs y marca los tramos buenos en seleccion.json.` : 'No hay tomas que sirvan: sube más clips a 1-Crudos.')
  const cola = { gancho: [...textos.ganchos], frase: [...textos.frases], narrado: [...textos.narrados], cta: [...textos.ctas] }
  const firma = textos.firma || '@nextlevelbylalo'

  const reels = []
  for (let d = 0; d < DIAS.length; d++) {
    for (let h = 0; h < HORAS.length; h++) {
      const n = reels.length
      const tipo = tipoDe(d, h)
      const texto = cola[tipo].shift() ?? cola.gancho.shift() ?? cola.frase.shift()
      if (!texto) throw new Error(`Se acabaron los textos en el reel ${n + 1}: hacen falta 35 en total (${tipo}).`)
      const toma = orden[n]
      const clip = toma.clip
      const esImagen = IMAGEN.test(clip)
      const meta = tipo === 'narrado' ? 10 : tipo === 'frase' ? 9 : 8
      // Si la toma es más corta que el reel, va en cámara lenta; si ni así alcanza, el reel se acorta.
      const velocidad = esImagen ? 1 : Math.max(LENTO, Math.min(1, toma.largo / meta))
      const duracion = esImagen ? meta : +Math.min(meta, toma.largo / velocidad).toFixed(2)
      reels.push({
        n: n + 1, dia: DIAS[d], hora: HORAS[h], tipo, clip, toma: toma.id,
        post: texto.post ?? '',
        props: {
          tipo: tipo === 'cta' ? 'gancho' : tipo,
          clip: `crudos/${clip}`, esImagen, desdeSegundo: toma.desde, velocidad, duracion, encuadre: toma.encuadre, textoArriba: toma.textoArriba,
          texto: texto.texto, resaltar: texto.resaltar ?? [], remate: tipo === 'cta' ? texto.remate ?? 'Comenta JARVIS' : texto.remate,
          firma, camara: CAMARAS[n % CAMARAS.length], letras: n % 3 === 1 ? 'cinetico' : 'estirar',
          formas: tipo !== 'narrado' || n % 2 === 0, pieza3D: tipo === 'frase' ? 'ninguna' : PIEZAS[n % PIEZAS.length], cine: tipo === 'frase',
          sonidos: { whoosh: 'sonidos/whoosh.wav', impacto: 'sonidos/impacto.wav' }, semilla: n,
          ...(tipo === 'narrado' && texto.voz ? { voz: `voces/${texto.voz}`, guion: texto.guion } : {}),
        },
      })
    }
  }
  return { semana, aviso, sinRevisar, clips: clips.length, tomas: tomas.length, reels }
}

async function main() {
  const [semana, bandera] = process.argv.slice(2)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana ?? '')) {
    console.log('Uso: node fabrica/semana.mjs AAAA-MM-DD [--render]   (el lunes de la semana)')
    process.exit(1)
  }
  const plan = planDeSemana(semana)
  const carpeta = join(RAIZ, 'salida', `Semana ${semana}`)
  mkdirSync(carpeta, { recursive: true })
  writeFileSync(join(carpeta, 'plan.json'), JSON.stringify(plan, null, 2))
  if (plan.aviso) console.log(`⚠️  ${plan.aviso}`)
  if (plan.sinRevisar.length) console.log(`⚠️  Sin revisar (no se usan): ${plan.sinRevisar.join(', ')}. Corre node fabrica/revisar.mjs`)
  console.log(`Plan: ${plan.reels.length} reels con ${plan.tomas} tomas de ${plan.clips} clips → ${join(carpeta, 'plan.json')}`)
  if (bandera !== '--render') return

  // Los clips tienen que estar en public/ para que Remotion los vea.
  rmSync(join(PUBLICO, 'crudos'), { recursive: true, force: true })
  mkdirSync(join(PUBLICO, 'crudos'), { recursive: true })
  for (const c of new Set(plan.reels.map((r) => r.clip))) copyFileSync(join(CRUDOS, c), join(PUBLICO, 'crudos', c))

  const { renderReel } = await import('./render.mjs')
  const registro = leer(REGISTRO, [])
  for (const r of plan.reels) {
    const dir = join(carpeta, r.dia)
    mkdirSync(dir, { recursive: true })
    const base = `${String(r.n).padStart(2, '0')}-${r.hora.replace(':', '')}`
    const props = { ...r.props }
    if (props.voz) props.palabras = tiemposDePalabras(join(PUBLICO, props.voz), props.guion ?? props.texto, 0.35)
    const t = Date.now()
    await renderReel(props, join(dir, `${base}.mp4`))
    writeFileSync(join(dir, `${base}.txt`), `${r.dia} ${r.hora} · ${r.tipo}\n\n${r.post}\n`)
    registro.push({ toma: r.toma, clip: r.clip, semana, reel: r.n, tipo: r.tipo })
    writeFileSync(REGISTRO, JSON.stringify(registro, null, 2))
    console.log(`✅ ${r.dia} ${r.hora} ${r.tipo} (toma ${r.toma}, ${Math.round((Date.now() - t) / 1000)} s)`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
