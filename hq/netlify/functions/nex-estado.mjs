// Cómo va la llamada de NEX a un lead, en vivo (HQ lo pregunta cada pocos
// segundos mientras dice "NEX llamando"): marcando, en llamada (con el tiempo),
// terminó o no salió. Lo pregunta a ElevenLabs. Quien puede ver el lead.
import { json, quien, sb } from '../lib/sb.mjs'

const TEXTO = {
  initiated: 'Marcando…',
  'in-progress': 'En llamada',
  processing: 'Terminó: NEX está escribiendo el resumen…',
  done: 'Terminó: guardando el resumen…',
  failed: 'La llamada no salió',
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  const { id } = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) return json({ ok: false, error: 'falta el lead' }, 400)
  // Con la sesión de la persona: si no le toca verlo, no existe.
  const [l] = await sb(`/rest/v1/leads?id=eq.${id}&select=id,estado,llamada_id,llamada_inicio,llamada_error`, { token: yo.token })
  if (!l) return json({ ok: false, error: 'Ese lead no existe' }, 404)
  if (l.estado !== 'llamando') return json({ ok: true, estado: l.estado, terminado: true })
  if (!l.llamada_id) return json({ ok: true, estado: 'llamando', llamada: 'initiated', texto: 'Marcando…' })
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(l.llamada_id)}`, {
      headers: { 'xi-api-key': (process.env.ELEVENLABS_API_KEY || '').trim() },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return json({ ok: true, estado: 'llamando', llamada: 'initiated', texto: 'Marcando…' })
    const c = await res.json()
    const seg = Math.round(Number(c.metadata?.call_duration_secs) || 0)
    const razon = c.metadata?.termination_reason || c.metadata?.error?.message || ''
    return json({ ok: true, estado: 'llamando', llamada: c.status, seg, texto: `${TEXTO[c.status] ?? c.status}${c.status === 'failed' && razon ? ` (${String(razon).slice(0, 120)})` : ''}` })
  } catch {
    return json({ ok: true, estado: 'llamando', llamada: 'initiated', texto: 'Marcando…' })
  }
}
