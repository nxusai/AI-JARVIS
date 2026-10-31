// ElevenLabs avisa aquí cómo terminó cada llamada de NEX ("post-call
// webhook"): la conversación, el resumen y lo que NEX anotó. El lead queda
// "Agendó meeting" (si NEX le agendó el Meet), en la Cartera con su motivo, o
// bloqueado si pidió no ser llamado. Solo entra lo que viene firmado con
// ELEVENLABS_WEBHOOK_SECRET (el que da ElevenLabs al crear el webhook).
import { createHmac, timingSafeEqual } from 'node:crypto'
import { json, sb } from '../lib/sb.mjs'

/** La firma de ElevenLabs: "t=<segundos>,v0=<hmac sha256 de `${t}.${cuerpo}`>", de hace menos de 30 minutos. */
export function firmaValida(cuerpo, encabezado, secreto) {
  if (!secreto || !encabezado) return false
  const partes = Object.fromEntries(String(encabezado).split(',').map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)]))
  const t = Number(partes.t)
  if (!t || !partes.v0 || Date.now() - t * 1000 > 30 * 60e3) return false
  const want = Buffer.from(createHmac('sha256', secreto).update(`${partes.t}.${cuerpo}`).digest('hex'))
  const got = Buffer.from(partes.v0)
  return want.length === got.length && timingSafeEqual(want, got)
}

// Lo que NEX anota en cada llamada ("Data collection" del agente), como lo enseña la ficha del lead.
const PUNTOS = ['empresa', 'necesidad', 'usa_hoy', 'decide', 'urgencia', 'presupuesto', 'consejo']
const RESULTADOS = { ahora_no: 'ahora_no', no_interesa: 'no_interesa', no_llamar: 'no_llamar', colgo: 'colgo', buzon: 'no_contesto', no_contesto: 'no_contesto', numero_malo: 'numero_malo' }

const valor = (r, k) => String(r?.[k]?.value ?? '').trim()

/** De la llamada ya terminada, lo que se guarda en el lead. */
export function cierre(lead, d) {
  const r = d.analysis?.data_collection_results ?? {}
  const turnos = Array.isArray(d.transcript) ? d.transcript : []
  const hablo = turnos.some((t) => t.role === 'user' && String(t.message || '').trim())
  const seg = Math.round(Number(d.metadata?.call_duration_secs) || 0)
  const puntos = {}
  for (const k of PUNTOS) if (valor(r, k)) puntos[k] = valor(r, k).slice(0, 500)
  const cambio = {
    llamada_id: String(d.conversation_id || '').slice(0, 120),
    llamada_seg: seg,
    resumen: String(d.analysis?.transcript_summary || '').slice(0, 4000),
    puntos,
    transcripcion: turnos
      .filter((t) => String(t.message || '').trim())
      .map((t) => `${t.role === 'agent' ? 'NEX' : 'Cliente'}: ${String(t.message).trim()}`)
      .join('\n')
      .slice(0, 60000),
  }
  if (d.metadata?.start_time_unix_secs) cambio.llamada_inicio = new Date(d.metadata.start_time_unix_secs * 1000).toISOString()
  // Si NEX ya le agendó el Meet (herramienta "agendar"), se queda como agendado.
  if (lead.prospecto_id || lead.estado === 'agendado') return { ...cambio, estado: 'agendado' }
  const resultado = valor(r, 'resultado').toLowerCase()
  if (resultado === 'no_llamar') return { ...cambio, estado: 'no_llamar' }
  if (!hablo) return { ...cambio, estado: 'cartera', motivo: 'no_contesto' }
  return { ...cambio, estado: 'cartera', motivo: RESULTADOS[resultado] ?? (seg < 30 ? 'colgo' : 'ahora_no') }
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const cuerpo = await req.text()
  if (!firmaValida(cuerpo, req.headers.get('elevenlabs-signature'), (process.env.ELEVENLABS_WEBHOOK_SECRET || '').trim())) return json({ ok: false, error: 'firma inválida' }, 401)
  let evento
  try {
    evento = JSON.parse(cuerpo)
  } catch {
    return json({ ok: false, error: 'no es JSON' }, 400)
  }
  const d = evento.data ?? {}
  // Solo las llamadas de NEX a los leads (otros agentes, como Ana Sofi, no tocan HQ).
  if (process.env.NEX_AGENT_ID && d.agent_id && d.agent_id !== process.env.NEX_AGENT_ID.trim()) return json({ ok: true, ignorado: 'otro agente' })
  const leadId = d.conversation_initiation_client_data?.dynamic_variables?.lead_id || d.user_id
  const filtro = /^[0-9a-f-]{36}$/i.test(String(leadId ?? '')) ? `id=eq.${leadId}` : d.conversation_id ? `llamada_id=eq.${encodeURIComponent(d.conversation_id)}` : ''
  if (!filtro) return json({ ok: true, ignorado: 'sin lead' })

  try {
    const [lead] = await sb(`/rest/v1/leads?${filtro}&select=id,estado,prospecto_id`, { servicio: true })
    // 200 aunque no exista: si no, ElevenLabs lo reintenta y termina apagando el webhook.
    if (!lead) return json({ ok: true, ignorado: 'lead no encontrado' })
    if (lead.estado === 'no_llamar') return json({ ok: true })
    let cambio
    if (evento.type === 'call_initiation_failure') {
      // No contestó, estaba ocupado o la llamada no salió.
      if (lead.estado === 'agendado') return json({ ok: true })
      cambio = { estado: 'cartera', motivo: 'no_contesto', llamada_id: String(d.conversation_id || '').slice(0, 120), llamada_seg: 0, resumen: `No contestó (${d.failure_reason || 'sin respuesta'}).` }
    } else if (evento.type === 'post_call_transcription') {
      cambio = cierre(lead, d)
    } else {
      return json({ ok: true, ignorado: evento.type })
    }
    await sb(`/rest/v1/leads?id=eq.${lead.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: cambio })
    if (lead.prospecto_id && cambio.resumen) {
      await sb('/rest/v1/prospectos_notas', { servicio: true, method: 'POST', prefer: 'return=minimal', body: { prospecto_id: lead.prospecto_id, texto: `Llamada de NEX: ${cambio.resumen}`.slice(0, 2000) } })
    }
    return json({ ok: true })
  } catch (err) {
    return json({ ok: false, error: err.message }, 500)
  }
}
