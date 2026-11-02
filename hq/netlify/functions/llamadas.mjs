// Cada 2 minutos, por si algo falló al aceptar en el chat: NEX le llama a los
// leads que están "Por llamar" (a cualquier hora: si aceptaron la llamada es
// porque pueden), hasta 3 intentos si la llamada no sale. Y si una llamada se
// quedó "en curso" sin que ElevenLabs avisara cómo terminó, el lead pasa a la
// Cartera como "No contestó".
import { llamar, MAX_INTENTOS, nexListo } from '../lib/nex.mjs'
import { sb } from '../lib/sb.mjs'

export const config = { schedule: '*/2 * * * *' }

export default async () => {
  if (!process.env.SUPABASE_SERVICE_KEY || !nexListo()) return new Response('NEX sin conectar')
  const hace = (min) => new Date(Date.now() - min * 60e3).toISOString()
  // Se apartó pero la llamada nunca arrancó (se cortó la función): de vuelta a "Por llamar".
  await sb(`/rest/v1/leads?estado=eq.llamando&llamada_id=eq.&llamada_inicio=lt.${hace(5)}`, {
    servicio: true,
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { estado: 'nuevo', llamada_inicio: null, llamada_error: 'La llamada no arrancó; se vuelve a intentar.' },
  })
  await sb(`/rest/v1/leads?estado=eq.llamando&llamada_inicio=lt.${hace(30)}`, {
    servicio: true,
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { estado: 'cartera', motivo: 'no_contesto' },
  })
  const porLlamar = await sb(`/rest/v1/leads?estado=eq.nuevo&permiso_llamada=is.true&intentos=lt.${MAX_INTENTOS}&select=*&order=creado.asc&limit=5`, { servicio: true })
  let hechas = 0
  for (const l of porLlamar) if ((await llamar(l)).ok) hechas++
  return new Response(`llamadas: ${hechas}`)
}
