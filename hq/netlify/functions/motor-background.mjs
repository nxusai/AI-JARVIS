// El motor en segundo plano (lib/motor.mjs): publica en el feed y pone los
// anuncios al aire, una cosa a la vez. Lo despiertan HQ (el admin, al aprobar,
// subir o cambiar algo, o con los botones ⏸ Pausar / ▶ Reanudar / 🗑 Borrar de
// Anuncios) y la revisión programada de cada 5 minutos (publicar.mjs).
import { timingSafeEqual } from 'node:crypto'
import { accionManual, claveMotor, conCandado, correrMotor } from '../lib/motor.mjs'
import { quien, sb } from '../lib/sb.mjs'

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
    // Que se vea en HQ → Anuncios (p. ej. si falta correr el SQL nuevo en Supabase).
    const falta = /tomar_candado|pedir_candado|candados|does not exist|Could not find/i.test(err.message)
    await sb('/rest/v1/anuncios_topes?mercado=in.(usa,mexico)', {
      servicio: true,
      method: 'PATCH',
      prefer: 'return=minimal',
      body: { aviso: (falta ? '⚠ No se puede publicar: falta correr el SQL nuevo en Supabase (esquema.sql).' : `⚠ ${err.message}`).slice(0, 1000) },
    }).catch(() => null)
  }
}
