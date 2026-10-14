import { avisar, clean, json, quien, readLead, saveLead } from '../lib/comun.mjs'

/**
 * El prospecto mientras avanza.
 *   { accion: 'abrio', de }      abrió su link: se crea y te avisa
 *   { accion: 'guardar', id, … } catálogo, diagnóstico, camino y sus datos
 */
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'usa POST' }, 405)
  const b = await req.json().catch(() => ({}))
  if (b.accion === 'abrio') {
    const lead = { id: crypto.randomUUID(), creado: new Date().toISOString(), de: clean(b.de, 60), etapa: 'abrio' }
    await saveLead(lead)
    await avisar(`🆕 Abrió su link: ${lead.de || '(link general)'}`)
    return json({ id: lead.id })
  }
  if (b.accion === 'guardar') {
    const lead = await readLead(b.id)
    if (!lead) return json({ error: 'no encontré tu registro; recarga la página' }, 404)
    const first = !lead.contacto
    lead.lineas = (Array.isArray(b.lineas) ? b.lineas : []).slice(0, 40).map((x) => clean(x, 80))
    lead.diagnostico = Object.fromEntries(Object.entries(b.diagnostico ?? {}).slice(0, 12).map(([k, v]) => [clean(k, 30), clean(v, 1500)]))
    lead.camino = b.camino === 'consulta' ? 'consulta' : 'propuesta'
    const c = b.contacto ?? {}
    lead.contacto = { nombre: clean(c.nombre, 80), empresa: clean(c.empresa, 120), direccion: clean(c.direccion, 200), whatsapp: clean(c.whatsapp, 30), correo: clean(c.correo, 120).toLowerCase() }
    if (!lead.contacto.nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.contacto.correo)) return json({ error: 'falta tu nombre o tu correo' }, 400)
    lead.etapa = 'datos'
    await saveLead(lead)
    if (first) {
      const d = lead.diagnostico
      await avisar(
        `📋 Datos completos: ${quien(lead)}\n` +
          `Quiere: ${lead.camino === 'consulta' ? 'Consultoría (pagada)' : 'Su propuesta (reunión)'}\n` +
          `Le interesa: ${lead.lineas.join(', ') || '—'}\n` +
          `${d.giro || ''}${d.tamano ? ` · ${d.tamano} personas` : ''}${d.urgencia ? ` · ${d.urgencia}` : ''}\n` +
          `${d.quiere ? `"${d.quiere.slice(0, 300)}"\n` : ''}` +
          `📱 ${lead.contacto.whatsapp} · ✉️ ${lead.contacto.correo}\n📍 ${lead.contacto.direccion || '—'}`,
      )
    }
    return json({ ok: true })
  }
  return json({ error: 'acción desconocida' }, 400)
}
