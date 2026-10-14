import { agenda, avisar, clean, json, quien, readLead, saveLead } from '../lib/comun.mjs'

/** Agenda la reunión en tu Google Calendar (con Meet); la consultoría, solo ya pagada. */
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'usa POST' }, 405)
  const { id, inicio } = await req.json().catch(() => ({}))
  const lead = await readLead(id)
  if (!lead?.contacto) return json({ error: 'primero tus datos' }, 400)
  if (lead.cita) return json({ ok: true, cita: lead.cita })
  if (lead.camino === 'consulta' && lead.pago?.estado !== 'pagado') return json({ error: 'primero el pago de la consultoría' }, 402)
  const d = lead.diagnostico ?? {}
  const notas = [
    `${lead.camino === 'consulta' ? 'Consultoría pagada' : 'Reunión para su propuesta'}`,
    `Le interesa: ${(lead.lineas ?? []).join(', ')}`,
    `${d.giro ?? ''} · ${d.tamano ?? ''} · ${d.urgencia ?? ''}`,
    d.quiere ? `Quiere: ${d.quiere}` : '',
    `WhatsApp: ${lead.contacto.whatsapp} · Dirección: ${lead.contacto.direccion}`,
  ].filter(Boolean).join('\n')
  try {
    const r = await agenda({ accion: 'agendar', id: lead.id, inicio: clean(inicio, 40), tipo: lead.camino, nombre: lead.contacto.nombre, empresa: lead.contacto.empresa, correo: lead.contacto.correo, notas })
    lead.cita = { inicio: r.inicio, meet: r.meet }
    lead.etapa = 'cita'
    await saveLead(lead)
    const cuando = new Date(r.inicio).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    await avisar(`📅 Cita agendada: ${quien(lead)}\n${lead.camino === 'consulta' ? 'Consultoría' : 'Reunión para su propuesta'} · ${cuando}\n${r.meet || ''}`)
    return json({ ok: true, cita: lead.cita })
  } catch (err) {
    return json({ error: err.message }, 409)
  }
}
