// Las herramientas de NEX durante la llamada ("server tools" en ElevenLabs):
//   { accion: "horarios", lead_id }          tus próximos horarios libres, en la hora del lead
//   { accion: "agendar", lead_id, inicio }   agenda el Google Meet de 30 minutos contigo y pasa el lead a Prospectos
// Tu calendario lo maneja el mismo programa de Google del portal
// (portal/google/agenda.gs): AGENDA_URL y AGENDA_CLAVE, también en este Netlify.
// Solo entra quien trae NEX_HERRAMIENTAS_CLAVE en el encabezado x-nex-clave.
import { timingSafeEqual } from 'node:crypto'
import { zona } from '../lib/nex.mjs'
import { json, sb } from '../lib/sb.mjs'

const env = (k) => (process.env[k] || '').trim()

function autorizado(req) {
  const want = Buffer.from(env('NEX_HERRAMIENTAS_CLAVE'))
  const got = Buffer.from((req.headers.get('x-nex-clave') || '').trim())
  return want.length >= 24 && want.length === got.length && timingSafeEqual(want, got)
}

/** Una llamada a la agenda de Google (portal/google/agenda.gs). */
async function agenda(body) {
  if (!env('AGENDA_URL')) throw new Error('la agenda no está conectada todavía (falta AGENDA_URL)')
  const res = await fetch(env('AGENDA_URL'), {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, clave: env('AGENDA_CLAVE') }),
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => null)
  if (!data?.ok) throw new Error(data?.error ?? `la agenda respondió ${res.status}`)
  return data
}

/** "martes 4 de noviembre, 10:30 a. m." en la hora y el idioma del lead. */
export function enPalabras(iso, l) {
  const en = l.idioma === 'en'
  const z = zona(l)
  const txt = new Date(iso).toLocaleString(en ? 'en-US' : 'es-MX', { timeZone: z, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
  const donde = z === 'America/Mexico_City' ? (en ? 'Mexico City time' : 'hora del centro de México') : en ? 'New York time' : 'hora de Nueva York'
  return `${txt} (${donde})`
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  if (!autorizado(req)) return json({ ok: false, error: 'sin permiso' }, 401)
  const b = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(b.lead_id ?? ''))) return json({ ok: false, error: 'falta lead_id' }, 400)

  try {
    const [l] = await sb(`/rest/v1/leads?id=eq.${b.lead_id}&select=*`, { servicio: true })
    if (!l) return json({ ok: false, error: 'lead no encontrado' }, 404)

    if (b.accion === 'horarios') {
      const { horarios } = await agenda({ accion: 'horarios' })
      const opciones = (horarios ?? []).slice(0, 8).map((inicio) => ({ inicio, texto: enPalabras(inicio, l) }))
      if (!opciones.length) return json({ ok: true, horarios: [], mensaje: l.idioma === 'en' ? 'No free slots this week; tell them an NXUS AI specialist will contact them to find a time.' : 'No hay horarios libres esta semana; dile que un especialista de NXUS AI le escribirá para buscar un horario.' })
      return json({ ok: true, horarios: opciones, instrucciones: 'Offer two or three of these options using the "texto". When the person picks one, call agendar with its exact "inicio".' })
    }

    if (b.accion === 'agendar') {
      if (l.prospecto_id) return json({ ok: true, mensaje: l.idioma === 'en' ? 'The meeting was already booked.' : 'La reunión ya estaba agendada.' })
      const inicio = String(b.inicio ?? '')
      if (Number.isNaN(Date.parse(inicio))) return json({ ok: false, error: 'inicio inválido: usa el "inicio" exacto de horarios' }, 400)
      if (!l.correo) return json({ ok: false, error: 'el lead no tiene correo: pídeselo y usa guardar_correo' }, 400)
      // Se aparta el lead antes de agendar: si NEX pide "agendar" dos veces seguidas, la segunda no crea otra cita.
      const [apartado] = await sb(`/rest/v1/leads?id=eq.${l.id}&prospecto_id=is.null&estado=neq.agendado`, { servicio: true, method: 'PATCH', prefer: 'return=representation', body: { estado: 'agendado' } })
      if (!apartado) return json({ ok: true, mensaje: l.idioma === 'en' ? 'The meeting is already being booked.' : 'La reunión ya se está agendando.' })
      const notas = [
        'Lead de los anuncios (Instagram) · agendado por NEX en la llamada',
        `${l.nombre} · ${l.empresa} · ${l.telefono}`,
        [l.ciudad, { mexico: 'México', usa: 'USA' }[l.pais]].filter(Boolean).join(', '),
        l.servicio ? `Le interesa: ${l.servicio}` : '',
      ].filter(Boolean).join('\n')
      let r
      try {
        r = await agenda({ accion: 'agendar', id: l.id, inicio: new Date(inicio).toISOString(), tipo: 'llamada', idioma: l.idioma, zona: zona(l), nombre: l.nombre, empresa: l.empresa, correo: l.correo, notas })
      } catch (err) {
        // La agenda a veces crea la cita en Google y aun así contesta con error o tarda de más (pasó el 9 de nov:
        // la cita quedó en el calendario y el lead se fue a la Cartera). Si ese horario ya no está libre, la cita sí se creó.
        const iso = new Date(inicio).toISOString()
        const creada = await agenda({ accion: 'horarios' }).then((h) => !(h.horarios ?? []).includes(iso)).catch(() => false)
        if (!creada) {
          await sb(`/rest/v1/leads?id=eq.${l.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: { estado: l.estado } }) // no se agendó: como estaba
          throw err
        }
        r = { inicio: iso, meet: '' }
        await sb(`/rest/v1/leads?id=eq.${l.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: { llamada_error: `La agenda contestó con error (${String(err.message).slice(0, 120)}), pero la cita sí quedó en el calendario. Revisa el link de Meet en Google Calendar.` } }).catch(() => null)
      }
      // A Prospectos, con la cita y el Meet: queda a nombre del admin (o de quien lo trabaja), en "Cita agendada".
      const [admin] = await sb('/rest/v1/perfiles?rol=eq.admin&activo=is.true&select=id&order=creado.asc&limit=1', { servicio: true })
      const [p] = await sb('/rest/v1/prospectos', {
        servicio: true,
        method: 'POST',
        prefer: 'return=representation',
        body: {
          origen: 'anuncio',
          nombre: l.nombre,
          empresa: l.empresa,
          direccion: l.direccion,
          whatsapp: l.telefono,
          correo: l.correo,
          lineas: l.servicio ? [`Pidió en el chat: ${l.servicio}`.slice(0, 80)] : [],
          diagnostico: Object.fromEntries(
            Object.entries({ pais: { mexico: 'México', usa: 'USA' }[l.pais], ciudad: l.ciudad, idioma: l.idioma === 'en' ? 'Inglés' : 'Español', quiere: l.servicio }).filter(([, v]) => v),
          ),
          etapa: 'cita',
          cita: r.inicio,
          meet: String(r.meet || '').slice(0, 300),
          asignado: l.asignado ?? admin?.id ?? null,
          siguiente: 'Preparar 2 o 3 propuestas con presupuesto para la reunión',
          siguiente_fecha: new Date(r.inicio).toISOString().slice(0, 10),
        },
      })
      await sb(`/rest/v1/leads?id=eq.${l.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: { estado: 'agendado', prospecto_id: p.id } })
      return json({
        ok: true,
        mensaje:
          l.idioma === 'en'
            ? `Booked: ${enPalabras(r.inicio, l)}, 30 minutes on Google Meet with an NXUS AI specialist. The invitation with the link goes to ${l.correo}.`
            : `Agendado: ${enPalabras(r.inicio, l)}, 30 minutos por Google Meet con un especialista de NXUS AI. La invitación con el link le llega a ${l.correo}.`,
      })
    }

    if (b.accion === 'guardar_correo') {
      const correo = String(b.correo ?? '').trim().toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return json({ ok: false, error: 'ese correo no es válido; pídeselo letra por letra' }, 400)
      await sb(`/rest/v1/leads?id=eq.${l.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: { correo } })
      return json({ ok: true, mensaje: 'Correo guardado' })
    }

    return json({ ok: false, error: 'acción desconocida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, 502)
  }
}
