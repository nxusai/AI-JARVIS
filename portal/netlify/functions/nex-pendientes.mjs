import { encargos, json, nexAutorizado } from '../lib/comun.mjs'

/**
 * Para NEX en tu Mac: GET da los encargos de llamada pendientes; POST {id}
 * marca uno como tomado. Solo con la llave de las llamadas.
 */
export default async (req) => {
  if (!nexAutorizado(req)) return json({ error: 'sin permiso' }, 401)
  const store = encargos()
  if (req.method === 'POST') {
    const { id } = await req.json().catch(() => ({}))
    const e = id ? await store.get(String(id), { type: 'json' }) : null
    if (!e) return json({ error: 'no existe' }, 404)
    await store.setJSON(e.id, { ...e, estado: 'tomado', tomado: new Date().toISOString() })
    return json({ ok: true })
  }
  const { blobs } = await store.list()
  const all = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })))
  return json({ encargos: all.filter((e) => e?.estado === 'pendiente').sort((a, b) => a.creado.localeCompare(b.creado)) })
}
