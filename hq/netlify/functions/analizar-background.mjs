// La IA VE la foto o el video antes de escribir su texto (en segundo plano: tarda 1 o 2 minutos).
//  · Video: cuadros del video (los saca el navegador de Eduardo y los sube a
//    contenido/cuadros/<id>/; varios son del final, donde va la llamada a la
//    acción; se borran al terminar) + lo que se dice en el
//    audio (ElevenLabs lo transcribe).
//  · Foto: la foto misma.
// Guarda qué muestra y dice la pieza (analisis), la palabra que pide escribir
// (palabra: "AUTOMATIZACIÓN", "OPERACIONES"…) y el texto, que usa esa misma
// palabra. Después despierta al motor, que la publica. Solo el admin.
import { palabraConocida, verYEscribir } from '../lib/textos.mjs'
import { despertarMotor } from '../lib/motor.mjs'
import { quien, sb, URL_SB } from '../lib/sb.mjs'

const db = (path, opts = {}) => sb(path, { servicio: true, ...opts })
const guardar = (id, cambio) => db(`/rest/v1/contenido?id=eq.${id}`, { method: 'PATCH', prefer: 'return=minimal', body: cambio })

const llaves = () => {
  const sk = process.env.SUPABASE_SERVICE_KEY
  return { apikey: sk, ...(/^eyJ/.test(sk) ? { authorization: `Bearer ${sk}` } : {}) }
}
/** Un cuadro del almacenamiento, en base64. */
async function bajar(ruta) {
  const res = await fetch(`${URL_SB()}/storage/v1/object/contenido/${ruta}`, { headers: llaves(), signal: AbortSignal.timeout(20_000) })
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer()).toString('base64')
}
/** Ya vistos, los cuadros se borran. */
const borrarCuadros = (rutas) =>
  rutas.length && fetch(`${URL_SB()}/storage/v1/object/contenido`, { method: 'DELETE', headers: { ...llaves(), 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: rutas }) }).catch(() => null)

/** Lo que se dice en el video (vacío si no hay voz o si ElevenLabs no está conectado). */
async function transcribir(ruta) {
  const llave = process.env.ELEVENLABS_API_KEY
  if (!llave) return ''
  const archivo = await fetch(`${URL_SB()}/storage/v1/object/contenido/${ruta}`, { headers: llaves(), signal: AbortSignal.timeout(60_000) })
  if (!archivo.ok) throw new Error(`no se pudo leer el video (${archivo.status})`)
  const blob = await archivo.blob()
  for (const modelo of ['scribe_v2', 'scribe_v1']) {
    const form = new FormData()
    form.set('model_id', modelo)
    form.set('file', blob, ruta.split('/').pop())
    form.set('tag_audio_events', 'false')
    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': llave }, body: form, signal: AbortSignal.timeout(180_000) })
    if (res.ok) return String((await res.json()).text ?? '').trim().slice(0, 6000)
    if (res.status !== 400 && res.status !== 422) throw new Error(`ElevenLabs respondió ${res.status}`)
  }
  return ''
}

export default async (req) => {
  if (req.method !== 'POST' || !process.env.SUPABASE_SERVICE_KEY || !process.env.ANTHROPIC_API_KEY) return
  const yo = await quien(req)
  if (!yo || yo.perfil.rol !== 'admin') return
  const { id, cuadros = [], aprobar = false } = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) return
  const [c] = await db(`/rest/v1/contenido?id=eq.${id}&select=*`)
  if (!c || c.estado === 'publicado') return
  // Los cuadros los subió el navegador a contenido/cuadros/<id>/ (solo esos se aceptan).
  const rutas = (Array.isArray(cuadros) ? cuadros : []).map(String).filter((r) => r.startsWith(`cuadros/${c.id}/`) && /^[\w/.-]+\.jpg$/.test(r)).slice(0, 14)
  const imagenes = (await Promise.all(rutas.map((r) => bajar(r).catch(() => null)))).filter(Boolean)
  // Mientras la IA ve la pieza, el texto viejo no se publica: el motor solo publica piezas con texto.
  const antes = { texto: c.texto, idea: c.idea }
  await guardar(c.id, { texto: '', idea: '👀 Viendo la pieza para escribir su texto…', error: '' })
  try {
    let transcripcion = ''
    if (c.tipo === 'video') transcripcion = await transcribir(c.archivo).catch((err) => (console.log('transcribir:', err.message), ''))
    const out = await verYEscribir(c, { cuadros: imagenes, transcripcion })
    const palabra = String(out.palabra ?? '').trim().toUpperCase().slice(0, 40)
    await guardar(c.id, {
      analisis: String(out.analisis ?? '').slice(0, 4000),
      palabra,
      texto: String(out.texto).slice(0, 2200),
      idea: String(out.idea).slice(0, 2000),
      comentario: '',
      // Si pide una palabra que ManyChat no contesta, no sale sola: Eduardo la agrega en ManyChat y aprueba.
      ...(!palabraConocida(palabra) && c.estado !== 'por_aprobar' ? { estado: 'por_aprobar' } : aprobar || c.estado === 'rechazado' ? { estado: 'aprobado' } : {}),
    })
    await despertarMotor().catch(() => null)
  } catch (err) {
    console.log('analizar:', err?.status ?? '', err?.message ?? err)
    await guardar(c.id, { ...antes, idea: `⚠ La IA no pudo ver la pieza (${String(err?.message ?? err).slice(0, 200)}). Dale "✦ Rehacer texto".`.slice(0, 2000) })
  } finally {
    await borrarCuadros(rutas)
  }
}
