// El botón "📞 Llamar ahora" de la ficha del lead: NEX le llama en ese momento,
// aunque esté fuera de horario o ya esté en la Cartera (nunca a quien pidió no
// ser llamado ni a quien no dio permiso). Solo quien puede trabajar prospectos.
import { llamar } from '../lib/nex.mjs'
import { json, quien, sb } from '../lib/sb.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  const p = yo.perfil
  if (!(p.rol === 'admin' || p.pros_trabajar)) return json({ ok: false, error: 'No tienes permiso para trabajar leads' }, 403)
  const { id } = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) return json({ ok: false, error: 'falta el lead' }, 400)
  try {
    // Se lee con la sesión de la persona: si no le toca verlo, no existe.
    const [l] = await sb(`/rest/v1/leads?id=eq.${id}&select=*`, { token: yo.token })
    if (!l) return json({ ok: false, error: 'Ese lead no existe' }, 404)
    if (l.estado === 'no_llamar') return json({ ok: false, error: 'Pidió no ser llamado' }, 409)
    const r = await llamar(l, { forzar: true })
    return r.ok ? json({ ok: true }) : json({ ok: false, error: r.motivo }, 409)
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
