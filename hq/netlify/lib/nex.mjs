// NEX llama a los leads de los anuncios: desde la nube (ElevenLabs + el número
// de NXUS en Twilio). Les llama EN CUANTO aceptan la llamada en el chat, a
// cualquier hora (decisión de Eduardo, 2 de noviembre de 2026: si aceptó es
// porque puede). Lo usan ManyChat (al aceptar), la revisión de cada 2 minutos
// (llamadas.mjs, por si algo falló) y el botón "Llamar ahora" de HQ.
//
//   ELEVENLABS_API_KEY     la llave de ElevenLabs
//   NEX_AGENT_ID           el agente que llama a los leads (ventas)
//   NEX_PHONE_NUMBER_ID    el número de NXUS importado en ElevenLabs
import { createHash } from 'node:crypto'
import { sb } from './sb.mjs'
import { telefonoParaLlamar } from './telefono.mjs'

const env = (k) => (process.env[k] || '').trim()

/** La zona horaria del lead: por su país, o por la lada de su teléfono. */
export function zona(l) {
  if (l.pais === 'mexico' || (!l.pais && String(l.telefono).startsWith('+52'))) return 'America/Mexico_City'
  return 'America/New_York'
}

/** Cuántas veces se intenta marcar (si la llamada no sale) antes de dejarlo en la Cartera. */
export const MAX_INTENTOS = 3

/** La clave con la que ManyChat (manychat.mjs) despierta la llamada en segundo plano. Sale de la llave de servicio. */
export const claveInterna = () => createHash('sha256').update(`nxus-llamar:${process.env.SUPABASE_SERVICE_KEY || ''}`).digest('hex')

/** Que NEX le llame ya (functions/llamar-background.mjs). No espera la llamada: solo que arranque. */
export async function llamarYa(id) {
  const base = (process.env.URL || 'https://nxus-hq.netlify.app').replace(/\/$/, '')
  const res = await fetch(`${base}/.netlify/functions/llamar-background`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-llamar': claveInterna() },
    body: JSON.stringify({ id }),
    signal: AbortSignal.timeout(4000),
  })
  return res.status
}

export const nexListo = () => !!(env('ELEVENLABS_API_KEY') && env('NEX_AGENT_ID') && env('NEX_PHONE_NUMBER_ID'))

const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || ''

/** Lo que NEX sabe del lead al marcar (sus "dynamic variables" en ElevenLabs). */
export function variables(l) {
  const en = l.idioma === 'en'
  const nombre = primerNombre(l.nombre)
  return {
    lead_id: l.id,
    nombre: nombre || (en ? 'there' : ''),
    nombre_completo: l.nombre || '',
    empresa: l.empresa || '',
    ciudad: l.ciudad || '',
    pais: { mexico: 'México', usa: 'USA', otro: '' }[l.pais] ?? '',
    servicio: l.servicio || '',
    correo: l.correo || '',
    idioma: en ? 'English' : 'Español',
    // Por dónde escribió (el anuncio abre Messenger aunque lo vea en Instagram).
    canal: l.canal === 'facebook' ? 'Messenger' : 'Instagram',
    // Primer mensaje corto, como una llamada normal: primero que conteste; la presentación (IA y grabación) va en su segundo turno.
    saludo: en ? `Hello${nombre ? `, is this ${nombre}` : ''}?` : `¿Hola${nombre ? `? ¿Hablo con ${nombre}` : ''}?`,
  }
}

/** Lo que pasó al intentar marcar, para que se vea en HQ (y el botón "Llamar ahora" siga ahí). */
const anotar = (id, cambio) => sb(`/rest/v1/leads?id=eq.${id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: cambio })

/**
 * Le llama al lead. Primero lo aparta (de "Por llamar" a "NEX llamando") para
 * que dos llamadas al mismo tiempo no le marquen dos veces. Si la llamada no
 * sale, el porqué queda en llamada_error y regresa a donde estaba (con el
 * botón "Llamar ahora"); tras 3 intentos fallidos, a la Cartera.
 * Devuelve { ok, motivo, conversacion }.
 */
export async function llamar(l, { forzar = false } = {}) {
  if (!nexListo()) return { ok: false, motivo: 'NEX todavía no está conectado (faltan ELEVENLABS_API_KEY, NEX_AGENT_ID o NEX_PHONE_NUMBER_ID en Netlify)' }
  if (!l.permiso_llamada) return { ok: false, motivo: 'No dio permiso de que una IA le llame' }
  if (!forzar && (l.intentos ?? 0) >= MAX_INTENTOS) return { ok: false, motivo: 'Ya se intentó 3 veces' }
  // El número listo para marcar (+52 / +1): si no traía lada, se decide por el país, la ciudad o la IA.
  const n = await telefonoParaLlamar(l)
  if (!n?.telefono) {
    const motivo = `No sé de qué país es el número "${l.telefono || '(vacío)'}" (no trae lada y no dijo el país). Corrígelo con "Editar datos" y dale "Llamar ahora".`
    await anotar(l.id, { llamada_error: motivo.slice(0, 500) }).catch(() => null)
    return { ok: false, motivo }
  }
  if (n.telefono !== l.telefono || (n.pais && n.pais !== l.pais)) await anotar(l.id, { telefono: n.telefono, ...(n.pais && n.pais !== l.pais ? { pais: n.pais } : {}) })
  const antes = l.estado
  const desde = forzar ? 'estado=in.(nuevo,cartera)' : 'estado=eq.nuevo'
  const [apartado] = await sb(`/rest/v1/leads?id=eq.${l.id}&${desde}&permiso_llamada=is.true`, {
    servicio: true,
    method: 'PATCH',
    prefer: 'return=representation',
    body: { estado: 'llamando', llamada_inicio: new Date().toISOString(), llamada_seg: null, llamada_id: '', llamada_error: '', intentos: (l.intentos ?? 0) + 1 },
  })
  if (!apartado) return { ok: false, motivo: 'Ya se le está llamando o ya no está por llamar' }
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: { 'xi-api-key': env('ELEVENLABS_API_KEY'), 'content-type': 'application/json' },
      body: JSON.stringify({
        agent_id: env('NEX_AGENT_ID'),
        agent_phone_number_id: env('NEX_PHONE_NUMBER_ID'),
        to_number: apartado.telefono,
        conversation_initiation_client_data: { user_id: apartado.id, dynamic_variables: variables(apartado) },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const out = await res.json().catch(() => ({}))
    if (!res.ok || out.success === false) throw Object.assign(new Error(out.message || out.detail?.[0]?.msg || out.detail?.message || `ElevenLabs respondió ${res.status}`), { status: res.status })
    await anotar(apartado.id, { llamada_id: String(out.conversation_id || out.callSid || '').slice(0, 120) })
    return { ok: true, conversacion: out.conversation_id }
  } catch (err) {
    // No salió: el porqué queda a la vista y regresa a donde estaba, con el botón "Llamar ahora".
    const malo = err.status === 422 || /invalid.*(number|phone)|n[uú]mero/i.test(err.message)
    const agotado = apartado.intentos >= MAX_INTENTOS
    await anotar(apartado.id, {
      llamada_error: `La llamada no salió: ${err.message}`.slice(0, 500),
      llamada_inicio: null,
      ...(malo || agotado ? { estado: 'cartera', motivo: 'numero_malo' } : { estado: antes === 'cartera' ? 'cartera' : 'nuevo' }),
    })
    return { ok: false, motivo: `La llamada no salió: ${err.message}` }
  }
}
