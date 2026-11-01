// La IA VE la foto o el video antes de escribir su texto (en segundo plano: 1 a 3 minutos).
//  · Video: cuadros del video + lo que se dice en el audio (ElevenLabs lo transcribe).
//    Los cuadros los saca el servidor con ffmpeg (8 a lo largo del video y 4 del
//    final, donde va la llamada a la acción); si el navegador ya los mandó
//    (contenido/cuadros/<id>/), se usan esos.
//  · Foto: la foto misma.
// Guarda qué muestra y dice la pieza (analisis), la palabra que pide escribir
// (palabra: "AUTOMATIZACIÓN", "OPERACIONES"…) y el texto, que usa esa misma
// palabra. Después despierta al motor, que la publica.
// Lo piden el admin desde HQ o el motor (pieza sin texto). Una pieza a la vez.
// Cada paso queda en la pieza (idea: "👀 1/3…") para ver dónde va o dónde se atoró.
import { execFile } from 'node:child_process'
import { chmod, copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { timingSafeEqual } from 'node:crypto'
import { claveMotor, despertarMotor } from '../lib/motor.mjs'
import { palabraConocida, verYEscribir } from '../lib/textos.mjs'
import { quien, sb, URL_SB } from '../lib/sb.mjs'

const db = (path, opts = {}) => sb(path, { servicio: true, ...opts })
const rpc = (fn, args) => db(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args })
const guardar = (id, cambio) => db(`/rest/v1/contenido?id=eq.${id}`, { method: 'PATCH', prefer: 'return=minimal', body: cambio })
const igual = (a, b) => {
  const x = Buffer.from(String(a ?? ''))
  const y = Buffer.from(String(b ?? ''))
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

const llaves = () => {
  const sk = process.env.SUPABASE_SERVICE_KEY
  return { apikey: sk, ...(/^eyJ/.test(sk) ? { authorization: `Bearer ${sk}` } : {}) }
}
/** Un archivo del almacenamiento "contenido". */
async function bajar(ruta, ms = 90_000) {
  const res = await fetch(`${URL_SB()}/storage/v1/object/contenido/${ruta}`, { headers: llaves(), signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`no se pudo leer el archivo (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}
const borrarCuadros = (rutas) =>
  rutas.length && fetch(`${URL_SB()}/storage/v1/object/contenido`, { method: 'DELETE', headers: { ...llaves(), 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: rutas }) }).catch(() => null)

// --- ffmpeg (paquete ffmpeg-static, incluido en la función: ver netlify.toml)
const correr = (bin, args) =>
  new Promise((ok, mal) => execFile(bin, args, { timeout: 60_000, maxBuffer: 20 * 1048576 }, (err, stdout, stderr) => (err && err.code !== 1 && !String(stderr).includes('Duration') ? mal(err) : ok(String(stderr)))))
async function ffmpeg(dir) {
  const origen = createRequire(import.meta.url)('ffmpeg-static')
  if (!origen) throw new Error('ffmpeg no está disponible')
  const bin = join(dir, 'ffmpeg')
  await copyFile(origen, bin)
  await chmod(bin, 0o755)
  return bin
}
/** Cuadros JPEG (base64) del video: 8 a lo largo y 4 del final. */
async function cuadrosDelVideo(video) {
  const dir = await mkdtemp(join(tmpdir(), 'nxus-'))
  try {
    const bin = await ffmpeg(dir)
    const archivo = join(dir, 'video')
    await writeFile(archivo, video)
    const info = await correr(bin, ['-hide_banner', '-i', archivo])
    const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(info)
    const d = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0
    if (!d) throw new Error('no se pudo leer la duración del video')
    const momentos = [...new Set([...Array.from({ length: 8 }, (_, i) => (d * (i + 0.5)) / 9), ...[3, 2, 1, 0.3].map((x) => Math.max(0, d - x))].map((x) => Math.round(x * 10) / 10))].sort((a, b) => a - b)
    const out = []
    for (const [i, t] of momentos.entries()) {
      const jpg = join(dir, `c${i}.jpg`)
      await correr(bin, ['-hide_banner', '-loglevel', 'error', '-ss', String(t), '-i', archivo, '-frames:v', '1', '-vf', "scale='min(768,iw)':-2", '-q:v', '4', '-y', jpg]).catch(() => null)
      const b = await readFile(jpg).catch(() => null)
      if (b?.length) out.push(b.toString('base64'))
    }
    return out
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null)
  }
}

/** Lo que se dice en el video (vacío si no hay voz o si ElevenLabs no está conectado). */
async function transcribir(video, nombre) {
  const llave = process.env.ELEVENLABS_API_KEY
  if (!llave) return ''
  for (const modelo of ['scribe_v2', 'scribe_v1']) {
    const form = new FormData()
    form.set('model_id', modelo)
    form.set('file', new Blob([video]), nombre)
    form.set('tag_audio_events', 'false')
    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': llave }, body: form, signal: AbortSignal.timeout(180_000) })
    if (res.ok) return String((await res.json()).text ?? '').trim().slice(0, 6000)
    if (res.status !== 400 && res.status !== 422) throw new Error(`ElevenLabs respondió ${res.status}`)
  }
  return ''
}

export default async (req) => {
  if (req.method !== 'POST' || !process.env.SUPABASE_SERVICE_KEY || !process.env.ANTHROPIC_API_KEY) return
  if (!igual(req.headers.get('x-motor'), claveMotor())) {
    const yo = await quien(req)
    if (!yo || yo.perfil.rol !== 'admin') return
  }
  const { id, cuadros = [], aprobar = false } = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) return
  // Una sola vez a la vez por pieza (HQ y el motor pueden pedirla casi juntos).
  if (!(await rpc('tomar_candado', { n: `ver:${id}`, segundos: 600 }).catch(() => true))) return
  const [c] = await db(`/rest/v1/contenido?id=eq.${id}&select=*`)
  const rutas = (Array.isArray(cuadros) ? cuadros : []).map(String).filter((r) => r.startsWith(`cuadros/${id}/`) && /^[\w/.-]+\.jpg$/.test(r)).slice(0, 14)
  if (!c || c.estado === 'publicado' || !c.archivo) {
    await borrarCuadros(rutas)
    return rpc('soltar_candado', { n: `ver:${id}` }).catch(() => null)
  }
  // Mientras la IA ve la pieza, el texto viejo no se publica: el motor solo publica piezas con texto.
  const antes = { texto: c.texto, idea: c.idea }
  const paso = (txt) => guardar(c.id, { texto: '', idea: `👀 ${txt}`, error: '' })
  try {
    await paso('1/3 · Leyendo el archivo…')
    const video = c.tipo === 'video'
    const archivo = await bajar(c.archivo)
    let imagenes = (await Promise.all(rutas.map((r) => bajar(r, 20_000).then((b) => b.toString('base64')).catch(() => null)))).filter(Boolean)
    let nota = ''
    if (!imagenes.length) {
      if (video) imagenes = await cuadrosDelVideo(archivo).catch((err) => ((nota = `sin imágenes: ${err.message}`), []))
      else if (/\.(jpe?g)$/i.test(c.archivo) && archivo.length < 4.5 * 1048576) imagenes = [archivo.toString('base64')]
    }
    await paso(`2/3 · ${video ? `Escuchando el audio y viendo ${imagenes.length} imágenes del video…` : 'Viendo la foto…'}`)
    const transcripcion = video ? await transcribir(archivo, c.archivo.split('/').pop()).catch((err) => ((nota += ` sin audio: ${err.message}`), '')) : ''
    if (video && !imagenes.length && !transcripcion) throw new Error(`no pude ver ni escuchar el video (${nota.trim()})`)
    await paso('3/3 · Escribiendo el texto…')
    const out = await verYEscribir(c, { cuadros: imagenes, transcripcion })
    const palabra = String(out.palabra ?? '').trim().toUpperCase().slice(0, 40)
    await guardar(c.id, {
      analisis: String(out.analisis ?? '').slice(0, 4000),
      palabra,
      texto: String(out.texto).slice(0, 2200),
      idea: `${String(out.idea)}${nota ? ` (Nota: ${nota.trim()})` : ''}`.slice(0, 2000),
      comentario: '',
      // Si pide una palabra que ManyChat no contesta, no sale sola: Eduardo la agrega en ManyChat y aprueba.
      ...(!palabraConocida(palabra) && c.estado !== 'por_aprobar' ? { estado: 'por_aprobar' } : aprobar || c.estado === 'rechazado' ? { estado: 'aprobado' } : {}),
    })
    await despertarMotor().catch(() => null)
  } catch (err) {
    console.log('analizar:', err?.status ?? '', err?.message ?? err)
    await guardar(c.id, { ...antes, idea: `⚠ La IA no pudo ver la pieza: ${String(err?.message ?? err).slice(0, 300)}. Dale "✦ Escribir texto" para reintentar.`.slice(0, 2000) })
  } finally {
    await borrarCuadros(rutas)
    await rpc('soltar_candado', { n: `ver:${id}` }).catch(() => null)
  }
}
