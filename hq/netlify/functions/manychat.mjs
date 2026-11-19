// La puerta de ManyChat a HQ: el flujo de Instagram y Facebook manda aquí al
// lead dos veces, con una "External Request": al empezar (completo: false,
// queda como "No calificado") y al terminar el filtro (completo: true). Solo
// entra quien trae la clave (MANYCHAT_CLAVE en Netlify y en el encabezado de
// ManyChat). Ver docs/guia-manychat.md.
import { timingSafeEqual } from 'node:crypto'
import { llamarYa } from '../lib/nex.mjs'
import { json, sb } from '../lib/sb.mjs'
import { ladaDe, normalizar, preguntarIA } from '../lib/telefono.mjs'

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
// Sí al permiso: tolera emojis, espacios o signos antes ("✅ Sí, autorizo", "👍 si"), y "autorizo"/"acepto" en cualquier
// parte; pero nunca cuenta como sí algo que empieza con "no".
const si = (v) => {
  if (v === true) return true
  const t = texto(v, 60).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^[^a-z0-9]+/, '')
  if (!t || /^no\b/.test(t)) return false
  return /^(si|yes|true|1|ok)\b/.test(t) || /(autorizo|acepto|i agree|de acuerdo)/.test(t)
}

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

/**
 * El teléfono con su lada (+52 / +1). Si la escribió, se respeta tal cual. Si no: el botón
 * "¿Tu número es de México o de USA?" (lada), si no el país que dijo, si no su ciudad o
 * dirección. Si así no se sabe, se guarda como lo escribió y al llamar decide la IA
 * (lib/telefono.mjs).
 */
export function telefono(v, p, lada, ...lugar) {
  const t = texto(v, 40)
  if (!t) return ''
  const n = normalizar(t, p, lada, ...lugar)
  // En duda (flujo viejo: +1 pero dijo México): se guarda como lo dio y la IA decide al recibirlo.
  return (n.duda ? n.original : n.telefono) || (t.startsWith('+') ? `+${t.replace(/\D/g, '')}` : t.replace(/[^\d]/g, '')).slice(0, 30)
}

// Correo: se limpia y se corrigen SOLO los errores de dedo de los dominios más comunes (gmial.com, hotmail.con…).
// Si aun así no es un correo válido, se deja vacío y HQ responde faltan: correo para que ManyChat lo vuelva a pedir.
const DOMINIOS = {
  gmail: ['gmial', 'gamil', 'gmai', 'gmal', 'gnail', 'gmaill', 'gmil', 'gimail', 'gmaul'],
  hotmail: ['hotmial', 'hotmal', 'hotmai', 'hotmil', 'homail', 'hotamil', 'hotmaill', 'jotmail'],
  outlook: ['outlok', 'outllok', 'otlook', 'outloo', 'outlook'],
  yahoo: ['yaho', 'yahooo', 'yhoo', 'yahho'],
  icloud: ['iclod', 'icloud', 'iclould'],
  live: ['liv'],
}
const FIN = { con: 'com', cmo: 'com', ocm: 'com', vom: 'com', xom: 'com', comm: 'com', co: 'com', 'com.mxx': 'com.mx', 'com.m': 'com.mx' }
export const correo = (v) => {
  let t = texto(v, 120).toLowerCase().normalize('NFKC').replace(/\s+/g, '').replace(/^mailto:/, '').replace(/[.,;]+$/, '')
  t = t.replace(/\(arroba\)|\[arroba\]|arroba/g, '@').replace(/@+/g, '@')
  const m = /^([^@]+)@([^@]+)$/.exec(t)
  if (!m) return ''
  let [, usuario, dom] = m
  const partes = dom.split('.')
  const base = partes[0]
  for (const [bien, malos] of Object.entries(DOMINIOS)) if (malos.includes(base)) partes[0] = bien
  // .con → .com solo en los dominios conocidos (en otros puede ser real)
  if (Object.keys(DOMINIOS).includes(partes[0])) {
    const fin = partes.slice(1).join('.')
    if (FIN[fin]) partes.splice(1, partes.length - 1, ...FIN[fin].split('.'))
    if (partes.length === 1) partes.push('com')
  }
  dom = partes.join('.')
  t = `${usuario}@${dom}`
  // Terminaciones que no existen (".con", ".cmo"…) en un dominio desconocido: mejor volver a pedirlo que adivinar.
  if (FIN[dom.split('.').pop()] && dom.split('.').pop() !== 'co') return ''
  return /^[^\s@]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(t) ? t : ''
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
    telefono: telefono(b.telefono, p, ladaDe(texto(b.lada, 40)), texto(b.ciudad, 80), texto(b.direccion, 200)),
    correo: correo(b.correo),
    ciudad: texto(b.ciudad, 80),
    pais: p,
    // Cuántas sucursales dijo en el botón de ManyChat: va al inicio de lo que necesita.
    servicio: [texto(b.sucursales, 20) && `Sucursales: ${texto(b.sucursales, 20)}`, texto(b.servicio, 200)].filter(Boolean).join(' · ').slice(0, 200),
  }
  // Si no dijo el país (u "Otro"), se deduce del número y de su ciudad o dirección.
  if ((!f.pais || f.pais === 'otro') && f.telefono) {
    const n = normalizar(texto(b.telefono, 40), p, ladaDe(texto(b.lada, 40)), f.ciudad, f.direccion)
    if (n.pais === 'mexico' || n.pais === 'usa') f.pais = n.pais
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


// ManyChat pega el texto de la persona tal cual dentro del JSON del aviso: una comilla doble (") o un salto de línea
// lo rompe y ManyChat ni lo envía (19 nov 2026, "Invalid payload json"). Por eso el aviso puede mandar SOLO
// { manychat_id, completo } y HQ trae los datos directo de la API de ManyChat (MANYCHAT_API_KEY en Netlify).
// Lo que venga en el cuerpo manda sobre lo de la API; lo que falte se completa con la API.
const sinAcento = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
const CAMPOS_MC = ['canal', 'fuente', 'idioma', 'nombre', 'empresa', 'direccion', 'ciudad', 'pais', 'telefono', 'correo', 'servicio', 'permiso', 'sucursales', 'lada']
export async function deManyChat(id) {
  const llave = (process.env.MANYCHAT_API_KEY || '').trim()
  if (!llave || !/^\d{1,60}$/.test(String(id ?? ''))) return null
  const res = await fetch(`https://api.manychat.com/fb/subscriber/getInfo?subscriber_id=${id}`, {
    headers: { authorization: `Bearer ${llave}`, accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok || out.status !== 'success' || !out.data) throw new Error(out.message || `ManyChat respondió ${res.status}`)
  const d = out.data
  const r = {}
  for (const c of d.custom_fields || []) {
    const k = sinAcento(c.name).replace(/\s+/g, '_')
    if (CAMPOS_MC.includes(k) && c.value !== null && c.value !== undefined && String(c.value).trim() !== '') r[k] = String(c.value)
  }
  if (!r.nombre && d.name) r.nombre = d.name
  if (!r.telefono && d.phone) r.telefono = d.phone
  if (!r.correo && d.email) r.correo = d.email
  return r
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  if (!autorizado(req)) return json({ ok: false, error: 'sin permiso' }, 401)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  let b = await req.json().catch(() => null)
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'El cuerpo no es JSON' }, 400)
  // Completa con lo que tiene ManyChat (lo del cuerpo manda). Si la API falla, sigue con lo que trajo el cuerpo.
  const mc = await deManyChat(b.manychat_id).catch((err) => (console.log('ManyChat API:', err.message), null))
  if (mc) b = { ...mc, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== '' && v !== null && v !== undefined)) }
  const f = fila(b)
  // Flujo viejo (sin botón de lada): +1 y dijo México puede ser el +1 que ponía ManyChat. Decide la IA ahora.
  if (f.telefono && !ladaDe(texto(b.lada, 40)) && normalizar(texto(b.telefono, 40), f.pais, '', f.ciudad, f.direccion).duda) {
    const ia = await preguntarIA({ ...f, telefono: f.telefono }).catch(() => null)
    if (ia?.telefono) f.telefono = ia.telefono
  }
  if (!/^\d{1,60}$/.test(f.manychat_id ?? '')) return json({ ok: false, error: 'falta manychat_id (el Contact Id de ManyChat)' }, 400)

  try {
    const buscar = async () =>
      (await sb(`/rest/v1/leads?manychat_id=eq.${f.manychat_id}&select=id,estado,motivo,idioma,anuncio_id,permiso_llamada,nombre,empresa,telefono,correo,servicio`, { servicio: true }))[0]
    let viejo = await buscar()
    if (!abierto(viejo)) return json({ ok: true, id: viejo.id, estado: viejo.estado, faltan: '' })
    const completo = si(b.completo)
    const permiso = completo && si(b.permiso)
    const e = estado(viejo, f, completo, permiso)
    const cambio = { ...f, estado: e.estado, ...(e.motivo ? { motivo: e.motivo } : {}) }
    // Qué anuncio lo trajo: el botón del anuncio dice "Quiero información (U3)" y ManyChat lo manda en fuente.
    const codigo = /\(([UM]\d{1,4})\)/.exec(f.fuente ?? '')?.[1]
    if (codigo && !viejo?.anuncio_id) {
      const [ad] = await sb(`/rest/v1/anuncios?codigo=eq.${codigo}&select=meta_ad_id,nombre`, { servicio: true }).catch(() => [])
      if (ad?.meta_ad_id) Object.assign(cambio, { anuncio_id: ad.meta_ad_id, fuente: `Anuncio · ${ad.nombre}`.slice(0, 200) })
    }
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
    // Aceptó la llamada: NEX le llama YA (en segundo plano; si no arranca, la revisión de cada 2 minutos lo hace).
    if (l?.estado === 'nuevo' && l.permiso_llamada && viejo?.estado !== 'nuevo') await llamarYa(l.id).catch((err) => console.log('llamarYa:', err.message))
    // ManyChat guarda la respuesta en un campo (hq_estado) para decidir el último mensaje.
    return json({ ok: true, id: l?.id, estado: l?.estado ?? e.estado, faltan: (e.faltan ?? []).join(', ') })
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
