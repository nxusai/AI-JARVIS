// La puerta de ManyChat a HQ: el flujo de Instagram y Facebook manda aquí al
// lead dos veces, con una "External Request": al empezar (completo: false,
// queda como "No calificado") y al terminar el filtro (completo: true). Solo
// entra quien trae la clave (MANYCHAT_CLAVE en Netlify y en el encabezado de
// ManyChat). Ver docs/guia-manychat.md.
import { timingSafeEqual } from 'node:crypto'
import { json, sb } from '../lib/sb.mjs'

// Lo que acepta en el chat, tal cual se le enseña (lo que queda como registro).
export const PERMISO = {
  es: 'Sí, autorizo a NXUS AI a llamarme a este número con un asistente de inteligencia artificial (voz artificial) para hablar de mi solicitud. Sé que la llamada se puede grabar, que no es condición para contratar y que puedo pedir en cualquier momento que no me llamen.',
  en: 'Yes, I authorize NXUS AI to call me at this number using an artificial intelligence assistant (artificial voice) about my request. I understand the call may be recorded, that consent is not a condition of purchase, and that I can ask not to be called at any time.',
}

// Lo que ManyChat manda vacío llega como '', 'null' o con las llaves sin llenar.
const texto = (v, max) => {
  const t = String(v ?? '').trim()
  return /^(null|undefined|none)$/i.test(t) || /^\{\{.*\}\}$/.test(t) ? '' : t.slice(0, max)
}
const si = (v) => v === true || /^(s[ií]|yes|true|1|acepto|i agree|autorizo)/i.test(texto(v, 40))

function autorizado(req) {
  // Sin espacios ni saltos de línea: al pegarla a veces se cuela uno.
  const want = Buffer.from((process.env.MANYCHAT_CLAVE || '').trim())
  const got = Buffer.from((req.headers.get('x-manychat-clave') || '').trim())
  return want.length >= 24 && want.length === got.length && timingSafeEqual(want, got)
}

export function pais(v) {
  const t = texto(v, 40).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!t) return ''
  if (/^(mx|mex|mexico)/.test(t)) return 'mexico'
  if (/^(us|usa|eu|eua|ee\.? ?uu|estados unidos|united states|u\.s)/.test(t)) return 'usa'
  return 'otro'
}
export const idioma = (v) => (/^(en|english|ingl)/i.test(texto(v, 20)) ? 'en' : 'es')
export function canal(v) {
  const t = texto(v, 40).toLowerCase()
  return t.includes('insta') ? 'instagram' : t.includes('face') || t.includes('messenger') ? 'facebook' : ''
}

/** El teléfono con su lada: 10 dígitos de USA → +1, de México → +52. */
export function telefono(v, p) {
  const t = texto(v, 40)
  const d = t.replace(/\D/g, '')
  if (!d) return ''
  if (t.startsWith('+')) return `+${d}`.slice(0, 30)
  if (d.length === 10) return `${p === 'mexico' ? '+52' : p === 'usa' ? '+1' : ''}${d}` || d
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  if (d.length === 12 && d.startsWith('52')) return `+${d}`
  return d.slice(0, 30)
}

const correo = (v) => {
  const t = texto(v, 120).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : ''
}

/** Lo que trae ManyChat, como fila de leads (solo lo que viene lleno). */
export function fila(b) {
  const p = pais(b.pais)
  const f = {
    manychat_id: texto(b.manychat_id, 60),
    canal: canal(b.canal),
    fuente: texto(b.fuente, 200),
    anuncio_id: texto(b.anuncio_id, 60),
    nombre: texto(b.nombre, 80),
    empresa: texto(b.empresa, 120),
    direccion: texto(b.direccion, 200),
    telefono: telefono(b.telefono, p),
    correo: correo(b.correo),
    ciudad: texto(b.ciudad, 80),
    pais: p,
    servicio: texto(b.servicio, 200),
  }
  // El idioma solo si viene: un aviso sin él no regresa a español a quien habla inglés.
  if (texto(b.idioma, 20)) f.idioma = idioma(b.idioma)
  for (const k of Object.keys(f)) if (f[k] === '') delete f[k]
  return f
}

// Lo mínimo para que NEX pueda llamar y Eduardo mandar el Meet.
const FALTA = { nombre: 'nombre', empresa: 'empresa', telefono: 'teléfono', correo: 'correo', servicio: 'servicio' }

// Lo que ya trabajó NEX o el equipo no se toca; solo se completa un lead que
// no terminó o que terminó sin dar permiso de llamada.
export const abierto = (viejo) => !viejo || ['incompleto', 'nuevo'].includes(viejo.estado) || (viejo.estado === 'cartera' && viejo.motivo === 'sin_permiso')

/** En qué queda: solo avanza. */
export function estado(viejo, f, completo, permiso) {
  if (!abierto(viejo)) return { estado: viejo.estado }
  const faltan = Object.keys(FALTA).filter((k) => !(f[k] ?? viejo?.[k]))
  if (!completo || faltan.length) return viejo && viejo.estado !== 'incompleto' ? { estado: viejo.estado, motivo: viejo.motivo } : { estado: 'incompleto', faltan: faltan.map((k) => FALTA[k]) }
  return permiso || viejo?.permiso_llamada ? { estado: 'nuevo' } : { estado: 'cartera', motivo: 'sin_permiso' }
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  if (!autorizado(req)) return json({ ok: false, error: 'sin permiso' }, 401)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const b = await req.json().catch(() => null)
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'El cuerpo no es JSON' }, 400)
  const f = fila(b)
  if (!/^\d{1,60}$/.test(f.manychat_id ?? '')) return json({ ok: false, error: 'falta manychat_id (el Contact Id de ManyChat)' }, 400)

  try {
    const buscar = async () =>
      (await sb(`/rest/v1/leads?manychat_id=eq.${f.manychat_id}&select=id,estado,motivo,idioma,permiso_llamada,nombre,empresa,telefono,correo,servicio`, { servicio: true }))[0]
    let viejo = await buscar()
    if (!abierto(viejo)) return json({ ok: true, id: viejo.id, estado: viejo.estado, faltan: '' })
    const completo = si(b.completo)
    const permiso = completo && si(b.permiso)
    const e = estado(viejo, f, completo, permiso)
    const cambio = { ...f, estado: e.estado, ...(e.motivo ? { motivo: e.motivo } : {}) }
    if (permiso && !viejo?.permiso_llamada) Object.assign(cambio, { permiso_llamada: true, permiso_texto: PERMISO[f.idioma ?? viejo?.idioma ?? 'es'] })
    const parchar = (id) => sb(`/rest/v1/leads?id=eq.${id}`, { servicio: true, method: 'PATCH', prefer: 'return=representation', body: cambio })
    let l
    if (viejo) [l] = await parchar(viejo.id)
    else {
      try {
        ;[l] = await sb('/rest/v1/leads', { servicio: true, method: 'POST', prefer: 'return=representation', body: cambio })
      } catch (err) {
        // Dos avisos de ManyChat casi juntos: el otro ya lo creó.
        if (err.status !== 409 || !(viejo = await buscar())) throw err
        ;[l] = await parchar(viejo.id)
      }
    }
    // ManyChat guarda la respuesta en un campo (hq_estado) para decidir el último mensaje.
    return json({ ok: true, id: l?.id, estado: l?.estado ?? e.estado, faltan: (e.faltan ?? []).join(', ') })
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
