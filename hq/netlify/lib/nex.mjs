// NEX llama a los leads de los anuncios: desde la nube (ElevenLabs + el número
// de NXUS en Twilio), una sola vez, en horario decente para el lead. Lo usan
// la revisión de cada 2 minutos (llamadas.mjs) y el botón "Llamar ahora" de HQ.
//
//   ELEVENLABS_API_KEY     la llave de ElevenLabs
//   NEX_AGENT_ID           el agente que llama a los leads (ventas)
//   NEX_PHONE_NUMBER_ID    el número de NXUS importado en ElevenLabs
import { sb } from './sb.mjs'

const env = (k) => (process.env[k] || '').trim()

/** La zona horaria del lead: por su país, o por la lada de su teléfono. */
export function zona(l) {
  if (l.pais === 'mexico' || (!l.pais && String(l.telefono).startsWith('+52'))) return 'America/Mexico_City'
  return 'America/New_York'
}

/** Día (0 = domingo) y hora del lead en este momento. */
function ahoraEn(z, fecha = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: z, weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(fecha).map((x) => [x.type, x.value]))
  return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), hora: Number(p.hour) % 24 }
}

/** Se le llama de lunes a sábado, de 9 de la mañana a 8 de la noche, hora del lead. */
export function horarioDeLlamada(l, fecha = new Date()) {
  const { dia, hora } = ahoraEn(zona(l), fecha)
  return dia >= 1 && dia <= 6 && hora >= 9 && hora < 20
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
    saludo: en
      ? `Hi${nombre ? ` ${nombre}` : ''}, this is NEX, the artificial intelligence assistant from NXUS AI. You left your details in our Instagram chat a moment ago and gave us permission to call. This call may be recorded. Do you have a couple of minutes?`
      : `Hola${nombre ? ` ${nombre}` : ''}, habla NEX, el asistente de inteligencia artificial de NXUS AI. Dejaste tus datos hace un momento en nuestro chat de Instagram y nos diste permiso de llamarte. Esta llamada se puede grabar. ¿Tienes un par de minutos?`,
  }
}

/**
 * Le llama al lead una sola vez. Primero lo aparta (de "Por llamar" a "NEX
 * llamando") para que dos revisiones al mismo tiempo no le marquen dos veces.
 * Devuelve { ok, motivo }.
 */
export async function llamar(l, { forzar = false } = {}) {
  if (!nexListo()) return { ok: false, motivo: 'NEX todavía no está conectado (faltan ELEVENLABS_API_KEY, NEX_AGENT_ID o NEX_PHONE_NUMBER_ID en Netlify)' }
  if (!l.permiso_llamada) return { ok: false, motivo: 'No dio permiso de que una IA le llame' }
  if (!/^\+\d{10,15}$/.test(String(l.telefono || '').replace(/[\s()-]/g, ''))) return { ok: false, motivo: 'El teléfono no tiene lada o está incompleto' }
  if (!forzar && !horarioDeLlamada(l)) return { ok: false, motivo: 'Fuera de horario: se le llama de lunes a sábado de 9 a 8, hora del lead' }
  const desde = forzar ? 'estado=in.(nuevo,cartera)' : 'estado=eq.nuevo'
  const [apartado] = await sb(`/rest/v1/leads?id=eq.${l.id}&${desde}&permiso_llamada=is.true`, {
    servicio: true,
    method: 'PATCH',
    prefer: 'return=representation',
    body: { estado: 'llamando', llamada_inicio: new Date().toISOString(), llamada_seg: null },
  })
  if (!apartado) return { ok: false, motivo: 'Ya se le está llamando o ya no está por llamar' }
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: { 'xi-api-key': env('ELEVENLABS_API_KEY'), 'content-type': 'application/json' },
      body: JSON.stringify({
        agent_id: env('NEX_AGENT_ID'),
        agent_phone_number_id: env('NEX_PHONE_NUMBER_ID'),
        to_number: String(apartado.telefono).replace(/[\s()-]/g, ''),
        conversation_initiation_client_data: { user_id: apartado.id, dynamic_variables: variables(apartado) },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const out = await res.json().catch(() => ({}))
    if (!res.ok || out.success === false) throw Object.assign(new Error(out.message || out.detail?.[0]?.msg || out.detail?.message || `ElevenLabs respondió ${res.status}`), { status: res.status })
    await sb(`/rest/v1/leads?id=eq.${apartado.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: { llamada_id: String(out.conversation_id || '').slice(0, 120) } })
    return { ok: true, conversacion: out.conversation_id }
  } catch (err) {
    // Si el número no sirve, a la Cartera; si falló otra cosa, de vuelta a "Por llamar" para el siguiente intento.
    const malo = err.status === 422 || /number|phone|número/i.test(err.message)
    await sb(`/rest/v1/leads?id=eq.${apartado.id}`, {
      servicio: true,
      method: 'PATCH',
      prefer: 'return=minimal',
      body: malo ? { estado: 'cartera', motivo: 'numero_malo', resumen: `No se pudo marcar: ${err.message}`.slice(0, 4000) } : { estado: 'nuevo', llamada_inicio: null },
    })
    return { ok: false, motivo: err.message }
  }
}
