// La ficha del lead pide el resumen de la llamada en español o inglés y aún no
// está traducido (llamadas de antes, o si la traducción falló al colgar): se
// traduce ahora y se guarda. Quien no puede ver el lead, no lo encuentra.
import { json, quien, sb } from '../lib/sb.mjs'
import { traducir } from '../lib/traducir.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  const { id } = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) return json({ ok: false, error: 'falta el lead' }, 400)
  try {
    const [l] = await sb(`/rest/v1/leads?id=eq.${id}&select=id,resumen,puntos,traduccion`, { token: yo.token })
    if (!l) return json({ ok: false, error: 'Ese lead no existe' }, 404)
    if (l.traduccion?.es && l.traduccion?.en) return json({ ok: true, traduccion: l.traduccion })
    const t = await traducir(l.resumen, l.puntos)
    if (!t) return json({ ok: false, error: 'No hay nada que traducir o falta ANTHROPIC_API_KEY' }, 409)
    await sb(`/rest/v1/leads?id=eq.${l.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: { traduccion: t } })
    return json({ ok: true, traduccion: t })
  } catch (err) {
    return json({ ok: false, error: 'No se pudo traducir ahora. Intenta otra vez.' }, 502)
  }
}
