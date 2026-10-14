import { avisar, env, json, quien, readLead, saveLead } from '../lib/comun.mjs'

/**
 * El cobro de la consultoría, con los links de pago de Stripe.
 *   POST { id }                    → { url } el link de pago, ligado a este prospecto
 *   GET  ?id=…&session_id=…        → revisa con Stripe que se pagó, y lo marca
 * En Stripe, el link de pago redirige a: https://empezar.nxusai.org/?pagado={CHECKOUT_SESSION_ID}
 */
export default async (req) => {
  const u = new URL(req.url)
  if (req.method === 'POST') {
    const { id } = await req.json().catch(() => ({}))
    const lead = await readLead(id)
    if (!lead?.contacto) return json({ error: 'primero tus datos' }, 400)
    const usa = /usa/i.test(lead.diagnostico?.pais ?? '') && !/ambos/i.test(lead.diagnostico?.pais ?? '')
    const link = env(usa ? 'PAGO_US' : 'PAGO_MX') || env('PAGO_MX')
    if (!link) return json({ error: 'el pago no está conectado todavía' }, 503)
    const url = new URL(link)
    url.searchParams.set('client_reference_id', lead.id)
    url.searchParams.set('prefilled_email', lead.contacto.correo)
    return json({ url: url.toString() })
  }
  const lead = await readLead(u.searchParams.get('id'))
  const sid = u.searchParams.get('session_id') ?? ''
  if (!lead || !/^cs_[\w]+$/.test(sid)) return json({ pagado: false }, 400)
  if (lead.pago?.estado === 'pagado') return json({ pagado: true })
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, { headers: { authorization: `Bearer ${env('STRIPE_KEY')}` } })
  const s = await res.json().catch(() => ({}))
  if (!res.ok || s.client_reference_id !== lead.id || s.payment_status !== 'paid') return json({ pagado: false })
  lead.pago = { estado: 'pagado', sesion: sid, monto: s.amount_total, moneda: s.currency, fecha: new Date().toISOString() }
  lead.etapa = 'pagado'
  await saveLead(lead)
  await avisar(`💳 Consultoría pagada: ${quien(lead)}\n${(s.amount_total / 100).toLocaleString('es-MX')} ${String(s.currency).toUpperCase()} · Stripe\nAhora elige su horario.`)
  return json({ pagado: true })
}
