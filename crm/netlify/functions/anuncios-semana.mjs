// Cada lunes temprano guarda la "foto" de la semana que terminó (ver lib/semana.mjs).
// 11:00 UTC = 6 am en Nueva Jersey (7 am en verano), antes del reporte automático.
import { tomarFoto } from '../lib/semana.mjs'

export const config = { schedule: '0 11 * * 1' }

export default async () => {
  try {
    const r = await tomarFoto()
    console.log('foto semanal', JSON.stringify(r))
  } catch (err) {
    console.error('foto semanal falló:', err.message)
  }
  return new Response('ok')
}
