// El oído de Ultron en su consola: una frase de audio → texto, con ElevenLabs
// Scribe. Solo para quien habla con Ultron. La llave de
// ElevenLabs vive aquí, en Netlify; el navegador nunca la ve.
import { json, quien } from '../lib/sb.mjs'

const limpio = (t) =>
  String(t ?? '')
    .replace(/[([][^)\]]{0,40}[)\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (!(yo.perfil.ultron || yo.perfil.rol === 'admin')) return json({ ok: false, error: 'Ultron solo atiende a la dirección' }, 403)
  const llave = process.env.ELEVENLABS_API_KEY
  if (!llave) return json({ ok: false, error: 'Falta ELEVENLABS_API_KEY en Netlify' }, 503)

  const tipo = req.headers.get('content-type') || 'audio/webm'
  const audio = await req.arrayBuffer()
  // Un clic o silencio: nada que transcribir.
  if (audio.byteLength < 1200) return json({ ok: true, texto: '' })
  if (audio.byteLength > 5.5 * 1024 * 1024) return json({ ok: false, error: 'La frase es muy larga' }, 413)
  const ext = tipo.includes('ogg') ? 'ogg' : tipo.includes('mp4') || tipo.includes('mpeg') ? 'mp4' : tipo.includes('wav') ? 'wav' : 'webm'

  const form = new FormData()
  form.append('model_id', 'scribe_v1')
  // Frases cortas confunden la detección de idioma: es español (escribe igual el inglés que se mezcle).
  form.append('language_code', process.env.ULTRON_IDIOMA || 'es')
  form.append('tag_audio_events', 'false')
  form.append('file', new Blob([audio], { type: tipo }), `frase.${ext}`)
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': llave },
      body: form,
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return json({ ok: false, error: `Scribe ${res.status}` }, 502)
    const data = await res.json()
    return json({ ok: true, texto: limpio(data.text) })
  } catch (err) {
    return json({ ok: false, error: String(err?.message ?? err) }, 502)
  }
}
