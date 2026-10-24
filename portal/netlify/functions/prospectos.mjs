import { env, json, store } from '../lib/comun.mjs'

/** Para NEX (y tu panel): todos los prospectos, solo con su llave. */
export default async (req) => {
  const key = env('NEXY_CLAVE')
  if (!key || req.headers.get('authorization') !== `Bearer ${key}`) return json({ error: 'sin permiso' }, 401)
  const s = store()
  const { blobs } = await s.list()
  const all = await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })))
  return json({ prospectos: all.filter(Boolean).sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado))) })
}
