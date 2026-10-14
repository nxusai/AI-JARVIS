import { agenda, json } from '../lib/comun.mjs'

/** Tus horarios libres, de tu Google Calendar. */
export default async () => {
  try {
    const { horarios } = await agenda({ accion: 'horarios' })
    return json({ horarios })
  } catch (err) {
    return json({ error: err.message, horarios: [] }, 503)
  }
}
