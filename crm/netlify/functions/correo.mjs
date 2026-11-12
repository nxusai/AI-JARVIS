// "✉️ A mi correo": le manda a la persona, a SU correo, archivos que ella puede
// ver: uno ("archivo") o varios juntos en un solo correo ("archivos", hasta 20).
// Cada archivo se busca con su propia sesión, así que los candados de la base de
// datos deciden; el correo sale desde la cuenta de Google de la empresa
// (google/correo.gs).
import { json, quien, sb, URL_SB } from '../lib/sb.mjs'

const ID = /^[0-9a-f-]{36}$/i

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  const d = await req.json().catch(() => ({}))
  const ids = [...new Set(Array.isArray(d.archivos) ? d.archivos.map(String) : [String(d.archivo || '')])].filter((x) => ID.test(x))
  if (!ids.length) return json({ ok: false, error: 'Falta el archivo' }, 400)
  if (ids.length > 20) return json({ ok: false, error: 'Son muchos archivos para un solo correo (máximo 20)' }, 400)
  if (!process.env.CORREO_URL || !process.env.CORREO_CLAVE) return json({ ok: false, error: 'El envío por correo todavía no está conectado. Descárgalo por ahora.' }, 503)
  if (!yo.perfil.correo) return json({ ok: false, error: 'Tu usuario no tiene correo. Pídele al administrador que te lo ponga en Usuarios.' }, 400)

  try {
    const lista = await sb(`/rest/v1/archivos?id=in.(${ids.join(',')})&select=id,nombre,ruta,empresa_id,tamano`, { token: yo.token })
    if (lista.length !== ids.length) return json({ ok: false, error: 'Algún archivo ya no existe o no lo puedes ver' }, 404)
    const orden = ids.map((id) => lista.find((a) => a.id === id))
    const [emp] = await sb(`/rest/v1/empresas?id=eq.${encodeURIComponent(orden[0].empresa_id)}&select=nombre,grupo`, { token: yo.token })
    const archivos = []
    for (const a of orden) {
      const firmado = await sb(`/storage/v1/object/sign/archivos/${a.ruta.split('/').map(encodeURIComponent).join('/')}`, {
        token: yo.token,
        method: 'POST',
        body: { expiresIn: 7 * 24 * 3600 },
      })
      archivos.push({ nombre: a.nombre, tamano: a.tamano, enlace: `${URL_SB()}/storage/v1${firmado.signedURL}` })
    }
    const varios = archivos.length > 1
    const res = await fetch(process.env.CORREO_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clave: process.env.CORREO_CLAVE,
        para: yo.perfil.correo,
        nombre: yo.perfil.nombre,
        empresa: emp ? emp.nombre : '',
        // Uno: como siempre. Varios: la lista completa (y, para un programa de correo viejo, el primero).
        ...(varios ? { archivos, archivo: `${archivos.length} archivos`, tamano: 0, enlace: archivos[0].enlace } : { archivo: archivos[0].nombre, tamano: archivos[0].tamano, enlace: archivos[0].enlace }),
      }),
      redirect: 'follow',
    })
    const r = await res.json().catch(() => ({}))
    if (!r.ok) return json({ ok: false, error: r.error || 'El correo no salió. Intenta otra vez o descárgalo.' }, 502)
    for (const a of orden) await sb('/rest/v1/rpc/anotar', { token: yo.token, method: 'POST', body: { p_accion: 'envió por correo', p_archivo: a.id } }).catch(() => {})
    if (varios && !r.varios) return json({ ok: true, para: yo.perfil.correo, aviso: 'Salió el correo, pero el programa de correo es el viejo y solo manda un archivo: hay que actualizar google/correo.gs.' })
    return json({ ok: true, para: yo.perfil.correo, n: archivos.length })
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
