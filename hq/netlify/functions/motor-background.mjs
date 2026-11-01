// El motor en segundo plano (lib/motor.mjs): publica en el feed y pone los
// anuncios al aire, una cosa a la vez. Lo despiertan HQ (el admin, al aprobar,
// subir o cambiar algo, o con los botones ⏸ Pausar / ▶ Reanudar / 🗑 Borrar de
// Anuncios) y la revisión programada de cada 5 minutos (publicar.mjs).
import { timingSafeEqual } from 'node:crypto'
import { accionManual, claveMotor, conCandado, correrMotor } from '../lib/motor.mjs'
import { quien } from '../lib/sb.mjs'

const igual = (a, b) => {
  const x = Buffer.from(String(a ?? ''))
  const y = Buffer.from(String(b ?? ''))
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

export default async (req) => {
  if (req.method !== 'POST' || !process.env.SUPABASE_SERVICE_KEY) return
  const interna = igual(req.headers.get('x-motor'), claveMotor())
  if (!interna) {
    const yo = await quien(req)
    if (!yo || yo.perfil.rol !== 'admin') return
  }
  const b = await req.json().catch(() => ({}))
  try {
    if (!interna && ['pausar', 'reanudar', 'borrar'].includes(b.accion)) await conCandado(() => accionManual(b), { esperar: 600 })
    await correrMotor()
  } catch (err) {
    console.log('motor:', err.message)
  }
}
