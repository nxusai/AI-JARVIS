// "✦ Rehacer texto" y los cambios de texto: la IA reescribe la publicación con
// lo que ya sabe de la pieza (su análisis: qué muestra el video y qué palabra
// pide). Si la pieza todavía no se ha visto, HQ manda primero a verla
// (analizar-background.mjs). Solo el admin.
import { escribir } from '../lib/textos.mjs'
import { json, quien, sb } from '../lib/sb.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo el administrador' }, 403)
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'Falta ANTHROPIC_API_KEY en Netlify' }, 503)
  const { id } = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) return json({ ok: false, error: 'falta la pieza' }, 400)
  try {
    const [c] = await sb(`/rest/v1/contenido?id=eq.${id}&select=*`, { token: yo.token })
    if (!c) return json({ ok: false, error: 'Esa pieza no existe' }, 404)
    const out = await escribir(c)
    const cambio = { texto: String(out.texto).slice(0, 2200), idea: String(out.idea).slice(0, 2000), comentario: '', ...(c.estado === 'rechazado' ? { estado: 'aprobado' } : {}) }
    await sb(`/rest/v1/contenido?id=eq.${c.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: cambio })
    return json({ ok: true, ...cambio })
  } catch (err) {
    console.log('redactar:', err?.status ?? '', err?.message ?? err)
    return json({ ok: false, error: 'La IA no respondió a tiempo. Intenta otra vez con "✦ Rehacer texto".' }, 502)
  }
}
