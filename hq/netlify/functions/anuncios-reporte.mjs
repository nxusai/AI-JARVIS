// Acceso de SOLO LECTURA a los números de los anuncios para el reporte automático
// de los lunes (una tarea programada de Claude en la nube). No usa sesión de HQ:
// pide el encabezado X-Reporte-Key igual a REPORTE_CLAVE en Netlify.
// GET  → las semanas guardadas + cómo va todo desde el inicio (Meta, solo lectura).
// POST → toma la foto de la última semana completa (o de ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD) y devuelve lo mismo.
// GET ?desde=&hasta= → además calcula ese rango sin guardarlo (campo "rango").
// Nunca cambia nada en Meta ni en los leads; no devuelve datos personales.
import { timingSafeEqual } from 'node:crypto'
import { json } from '../lib/sb.mjs'
import { graph, fila, metaListo, cuentaMeta, FILTRO, CAMPOS } from '../lib/meta.mjs'
import { tomarFoto, semanasGuardadas, calcular, rango } from '../lib/semana.mjs'

const clave = () => (process.env.REPORTE_CLAVE || '').trim()
function autorizado(req) {
  const a = Buffer.from(req.headers.get('x-reporte-key') || '')
  const b = Buffer.from(clave())
  return b.length >= 24 && a.length === b.length && timingSafeEqual(a, b)
}

export default async (req) => {
  if (!clave()) return json({ ok: false, error: 'Falta REPORTE_CLAVE en Netlify' }, 503)
  if (!autorizado(req)) return json({ ok: false, error: 'sin permiso' }, 401)
  if (!['GET', 'POST'].includes(req.method)) return json({ ok: false, error: 'GET o POST' }, 405)
  try {
    const q = new URL(req.url).searchParams
    const r = q.get('desde') || q.get('hasta') ? rango(q.get('desde'), q.get('hasta') || new Date().toISOString().slice(0, 10)) : null
    const foto = req.method === 'POST' ? await tomarFoto(new Date(), r) : null
    const enRango = req.method === 'GET' && r ? { ...r, ...(await calcular(r)) } : null
    let total = []
    let motivo = ''
    if (metaListo()) {
      try {
        const r = await graph(`${cuentaMeta()}/insights?level=ad&date_preset=maximum&fields=${CAMPOS}&filtering=${FILTRO}&limit=200`)
        total = (r.data || []).map(fila)
      } catch (err) {
        motivo = `Meta: ${err.message}`.slice(0, 300)
      }
    } else motivo = 'Meta sin conectar'
    return json({ ok: true, foto, rango: enRango, semanas: await semanasGuardadas(), total, motivo, al: new Date().toISOString() })
  } catch (err) {
    return json({ ok: false, error: err.message.slice(0, 300) }, 500)
  }
}
