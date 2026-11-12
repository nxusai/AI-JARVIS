// La voz de NEX en HQ: texto → audio con la MISMA voz que usa NEX en sus llamadas
// (se toma del agente de ElevenLabs NEX_AGENT_ID). Solo el admin.
import { json, quien } from '../lib/sb.mjs'

let vozCache = null

async function vozDeNex(llave) {
  if (process.env.NEX_VOZ_ID) return process.env.NEX_VOZ_ID
  if (vozCache) return vozCache
  const agente = process.env.NEX_AGENT_ID
  if (!agente) return null
  const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agente)}`, { headers: { 'xi-api-key': llave }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null
  const a = await res.json()
  vozCache = a?.conversation_config?.tts?.voice_id || null
  return vozCache
}

/** Lo que se va a decir: sin markdown, sin emojis ni ligas. */
const paraDecir = (t) =>
  String(t ?? '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>|]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700)

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo Eduardo' }, 403)
  const llave = process.env.ELEVENLABS_API_KEY
  if (!llave) return json({ ok: false, error: 'Falta ELEVENLABS_API_KEY en Netlify' }, 503)
  const b = await req.json().catch(() => ({}))
  const texto = paraDecir(b.texto)
  if (!texto) return json({ ok: false, error: 'Nada que decir' }, 400)
  const voz = await vozDeNex(llave).catch(() => null)
  if (!voz) return json({ ok: false, error: 'No encontré la voz de NEX (revisa NEX_AGENT_ID o pon NEX_VOZ_ID en Netlify)' }, 503)
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': llave, 'content-type': 'application/json' },
      body: JSON.stringify({ text: texto, model_id: 'eleven_turbo_v2_5', language_code: 'es', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return json({ ok: false, error: `Voz ${res.status}` }, 502)
    return new Response(await res.arrayBuffer(), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } })
  } catch (err) {
    return json({ ok: false, error: String(err?.message ?? err).slice(0, 200) }, 502)
  }
}
