// "✉️ A mi correo": le manda a la persona, a SU correo, un archivo que ella
// puede ver. El archivo se busca con su propia sesión, así que los candados de
// la base de datos deciden; el correo sale desde la cuenta de Google de la
// empresa (google/correo.gs).
import { json, quien, sb, URL_SB } from '../lib/sb.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  const { archivo } = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(archivo || ''))) return json({ ok: false, error: 'Falta el archivo' }, 400)
  if (!process.env.CORREO_URL || !process.env.CORREO_CLAVE) return json({ ok: false, error: 'El envío por correo todavía no está conectado. Descárgalo por ahora.' }, 503)
  if (!yo.perfil.correo) return json({ ok: false, error: 'Tu usuario no tiene correo' }, 400)

  try {
    const [a] = await sb(`/rest/v1/archivos?id=eq.${archivo}&select=id,nombre,ruta,empresa_id,tamano`, { token: yo.token })
    if (!a) return json({ ok: false, error: 'Ese archivo no existe o no lo puedes ver' }, 404)
    const [emp] = await sb(`/rest/v1/empresas?id=eq.${encodeURIComponent(a.empresa_id)}&select=nombre,grupo`, { token: yo.token })
    const firmado = await sb(`/storage/v1/object/sign/archivos/${a.ruta.split('/').map(encodeURIComponent).join('/')}`, {
      token: yo.token,
      method: 'POST',
      body: { expiresIn: 7 * 24 * 3600 },
    })
    const enlace = `${URL_SB()}/storage/v1${firmado.signedURL}`
    const res = await fetch(process.env.CORREO_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clave: process.env.CORREO_CLAVE,
        para: yo.perfil.correo,
        nombre: yo.perfil.nombre,
        archivo: a.nombre,
        tamano: a.tamano,
        enlace,
        empresa: emp ? emp.nombre : '',
      }),
      redirect: 'follow',
    })
    const r = await res.json().catch(() => ({}))
    if (!r.ok) return json({ ok: false, error: r.error || 'El correo no salió. Intenta otra vez o descárgalo.' }, 502)
    await sb('/rest/v1/rpc/anotar', { token: yo.token, method: 'POST', body: { p_accion: 'envió por correo', p_archivo: a.id } }).catch(() => {})
    return json({ ok: true, para: yo.perfil.correo })
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
