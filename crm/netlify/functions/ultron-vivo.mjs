// Ultron en vivo: abre una conversación con su agente de ElevenLabs (voz en tiempo
// real, como Ana Sofi). La llave de ElevenLabs vive aquí; el navegador solo recibe
// un permiso de un solo uso. Solo para quien tiene a Ultron (la dirección) y el admin.
// El agente se llama "Ultron · Centro de trabajo" (lo crea scripts/ultron-voz.mjs en la Mac).
import { json, quien } from '../lib/sb.mjs'

const NOMBRE = 'Ultron · Centro de trabajo'
const API = 'https://api.elevenlabs.io/v1/convai'
let agenteCache = null

async function el(path, llave) {
  const res = await fetch(`${API}${path}`, { headers: { 'xi-api-key': llave }, signal: AbortSignal.timeout(10_000) })
  const r = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(r?.detail?.message || r?.detail || `ElevenLabs ${res.status}`), { status: 502 })
  return r
}

async function agente(llave) {
  if (process.env.ULTRON_AGENT_ID) return process.env.ULTRON_AGENT_ID
  if (agenteCache) return agenteCache
  const r = await el(`/agents?search=${encodeURIComponent(NOMBRE)}&page_size=10`, llave)
  const a = (r.agents ?? []).find((x) => x.name === NOMBRE)
  if (!a) return null
  agenteCache = a.agent_id
  return agenteCache
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (!(yo.perfil.ultron || yo.perfil.rol === 'admin')) return json({ ok: false, error: 'Ultron solo atiende a la dirección' }, 403)
  const llave = process.env.ELEVENLABS_API_KEY
  if (!llave) return json({ ok: false, error: 'Falta ELEVENLABS_API_KEY en Netlify' }, 503)
  try {
    const id = await agente(llave)
    if (!id) return json({ ok: false, error: 'Ultron en vivo todavía no está preparado (node scripts/ultron-voz.mjs en la Mac).', falta: true }, 503)
    const [token, firmada] = await Promise.allSettled([el(`/conversation/token?agent_id=${id}`, llave), el(`/conversation/get-signed-url?agent_id=${id}`, llave)])
    const conversationToken = token.status === 'fulfilled' ? token.value.token : null
    const signedUrl = firmada.status === 'fulfilled' ? firmada.value.signed_url : null
    if (!conversationToken && !signedUrl) throw firmada.reason || token.reason
    return json({ ok: true, conversationToken, signedUrl })
  } catch (err) {
    agenteCache = null
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
