// Cada 2 minutos: NEX le llama a los leads que están "Por llamar" y ya les
// toca (los que llegaron de noche se llaman a las 9 de la mañana, hora del
// lead). Y si una llamada se quedó "en curso" sin que ElevenLabs avisara cómo
// terminó, el lead pasa a la Cartera como "No contestó".
import { horarioDeLlamada, llamar, nexListo } from '../lib/nex.mjs'
import { sb } from '../lib/sb.mjs'

export const config = { schedule: '*/2 * * * *' }

export default async () => {
  if (!process.env.SUPABASE_SERVICE_KEY || !nexListo()) return new Response('NEX sin conectar')
  const hace = (min) => new Date(Date.now() - min * 60e3).toISOString()
  await sb(`/rest/v1/leads?estado=eq.llamando&llamada_inicio=lt.${hace(45)}`, {
    servicio: true,
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { estado: 'cartera', motivo: 'no_contesto' },
  })
  const porLlamar = await sb('/rest/v1/leads?estado=eq.nuevo&permiso_llamada=is.true&select=*&order=creado.asc&limit=20', { servicio: true })
  let hechas = 0
  for (const l of porLlamar) {
    if (hechas >= 5) break // pocas a la vez: NEX no se satura y nadie espera de más
    if (!horarioDeLlamada(l)) continue
    const r = await llamar(l)
    if (r.ok) hechas++
  }
  return new Response(`llamadas: ${hechas}`)
}
