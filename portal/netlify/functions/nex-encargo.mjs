import { randomUUID } from 'node:crypto'
import { avisar, clean, encargos, json, nexAutorizado } from '../lib/comun.mjs'

/**
 * Lo que le pides a NEX en una llamada y no se resuelve hablando: mandar un
 * correo, agendar, preparar algo, darle trabajo a Ultron. La agente de llamadas
 * lo deja aquí ("encargar_a_nex"); NEX lo toma en tu Mac en cuanto está
 * prendido, lo hace con todas sus herramientas (y sus mismos candados) y te
 * avisa por Telegram. Solo con la llave de las llamadas.
 */
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'usa POST' }, 405)
  if (!nexAutorizado(req)) return json({ error: 'sin permiso' }, 401)
  const body = await req.json().catch(() => ({}))
  const tarea = clean(body?.tarea, 3000)
  if (!tarea) return json({ respuesta: 'No entendí qué hay que hacer.' })
  const e = { id: randomUUID(), tarea, estado: 'pendiente', creado: new Date().toISOString() }
  await encargos().setJSON(e.id, e)
  await avisar(`📞 Encargo en llamada: ${tarea}`)
  return json({ respuesta: 'Anotado. Lo hago en cuanto esté encendido y te aviso por Telegram.' })
}
