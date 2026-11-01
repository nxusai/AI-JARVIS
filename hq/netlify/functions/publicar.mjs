// Cada 5 minutos despierta al motor (lib/motor.mjs, en segundo plano): publica
// en el feed lo aprobado que ya le toca, pone al aire los anuncios aprobados y,
// cada 15 minutos, trae lo gastado y cuida el tope del mes. Si HQ ya lo
// despertó (Eduardo aprobó algo), esta vuelta solo confirma que no falte nada.
import { despertarMotor } from '../lib/motor.mjs'

export const config = { schedule: '*/5 * * * *' }

export default async () => {
  if (!process.env.SUPABASE_SERVICE_KEY) return new Response('sin Supabase')
  const estado = await despertarMotor().catch((err) => err.message)
  return new Response(`motor: ${estado}`)
}
