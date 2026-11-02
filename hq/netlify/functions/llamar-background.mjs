// NEX le llama al lead EN CUANTO acepta la llamada en el chat de ManyChat
// (manychat.mjs lo despierta). En segundo plano: ManyChat no espera.
import { timingSafeEqual } from 'node:crypto'
import { claveInterna, llamar } from '../lib/nex.mjs'
import { sb } from '../lib/sb.mjs'

const igual = (a, b) => {
  const x = Buffer.from(String(a ?? ''))
  const y = Buffer.from(String(b ?? ''))
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

export default async (req) => {
  if (req.method !== 'POST' || !process.env.SUPABASE_SERVICE_KEY || !igual(req.headers.get('x-llamar'), claveInterna())) return
  const { id } = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) return
  const [l] = await sb(`/rest/v1/leads?id=eq.${id}&select=*`, { servicio: true })
  if (l?.estado === 'nuevo') await llamar(l).catch((err) => console.log('llamar:', err.message))
}
