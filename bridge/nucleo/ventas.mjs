import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATA, TAG } from './lugar.mjs'

/**
 * Ana Sofi's sales line, on its own: the version that runs in the client's
 * brain (docs/cerebro-cliente.md, step 6). Leads come only from the work
 * center (the "leads" table of the Centro de trabajo); there is no Sheet here.
 *
 *   1. A new lead with written permission and a US number is called at once,
 *      at any hour, with three video-call slots to offer (10 am, 1 pm, 3 pm
 *      Eastern, on different days, at least three hours ahead). The lead is
 *      taken in the work center first (etapa nuevo → programada), so a lead is
 *      never dialled twice, whoever else is watching.
 *   2. How the call went is read from ElevenLabs and written to the lead's card.
 *   3. Not answered: one more try, two hours later (or 11:00 the next day, their time).
 *   4. Chose a video call: the chosen slot is matched to the offered ones and
 *      booked in the sales calendar (calendario-google.gs: a free hour, a
 *      Google Meet, the lead invited). The card gets etapa "meet", the start
 *      and the link; the owner's own system phones him about it.
 *   5. Asked to be called later: the time they said is turned into a date
 *      (with Claude), and the call is booked for then, between 9 and 20 h their time.
 *
 * Nothing here decides who gets called: only a lead who gave the written
 * permission, with a US number, is ever dialled; the model never supplies a number.
 *
 *   <data>/ventas.json          { prendido, agentId, phoneId, avisos? } (sent signed by the owner)
 *   <data>/ventas-estado.json   what happened to each lead so far
 */

export const VENTAS_FILE = join(DATA, 'ventas.json')
const STATE_FILE = join(DATA, 'ventas-estado.json')
const API = 'https://api.elevenlabs.io/v1/convai'
export const ZONA_MEET = 'America/New_York'
const NUEVOS_MS = 15_000
const RELOJ_MS = 60_000
const PRIMERA_HORA = 9
const ULTIMA_HORA = 20
const MAX_INTENTOS = 2
const REINTENTO_MS = 2 * 60 * 60_000
const HORAS_MEET = [10, 13, 15]
const NOMBRE = 'Ana Sofi: '

const leer = (f, d) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8')) ?? d
  } catch {
    return d
  }
}
function guardar(f, v) {
  mkdirSync(DATA, { recursive: true })
  const tmp = `${f}.tmp`
  writeFileSync(tmp, JSON.stringify(v, null, 2), { mode: 0o600 })
  renameSync(tmp, f)
  try {
    chmodSync(f, 0o600)
  } catch {}
}

export function leerVentas() {
  const c = leer(VENTAS_FILE, {})
  return {
    prendido: c.prendido === true,
    agentId: /^agent_\w+$/.test(c.agentId ?? '') ? c.agentId : '',
    phoneId: /^phnum_\w+$/.test(c.phoneId ?? '') ? c.phoneId : '',
    avisos: c.avisos === 'todo' ? 'todo' : 'meetings',
  }
}
const leerEstado = () => leer(STATE_FILE, {})
const guardarEstado = (s) => guardar(STATE_FILE, s)

const doblar = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

// ── el Centro de trabajo ─────────────────────────────────────────────────

/** Asks the work center (Supabase) with its service key. */
export async function centro({ url, key }, path, { method = 'GET', body, prefer, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(/^eyJ/.test(key) ? { authorization: `Bearer ${key}` } : {}),
      'content-type': 'application/json',
      ...(prefer ? { prefer } : method === 'POST' || method === 'PATCH' ? { prefer: 'return=representation' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) throw new Error(`el Centro de trabajo no aceptó (${res.status}): ${String(data?.message ?? text).slice(0, 200)}`)
  return data
}

/** One "leads" row, with the names this file uses. */
export function leadDe(r) {
  return {
    id: r.id,
    origen: r.origen ?? 'manychat',
    nombre: r.nombre ?? '',
    empresa: r.negocio ?? '',
    telefono: r.telefono ?? '',
    correo: r.correo ?? '',
    idioma: r.idioma === 'en' ? 'en' : 'es',
    tipo: r.tipo_negocio ?? '',
    ciudad: r.ciudad ?? '',
    quesos: r.quesos ?? '',
    libras: r.libras ?? '',
    frecuencia: r.frecuencia ?? '',
    marca: r.marca_propia ?? '',
    permiso: r.permiso_llamada === true,
    etapa: r.etapa,
    llamadaId: r.llamada_id ?? '',
    precios: r.precios ?? '',
    resumen: r.resumen ?? '',
  }
}

async function escribir(c, lead, patch, fetchImpl) {
  const { nota, ...campos } = patch
  if (Object.keys(campos).length) await centro(c, `/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}`, { method: 'PATCH', body: campos, prefer: 'return=minimal', fetchImpl })
  if (nota) await centro(c, '/rest/v1/leads_notas', { method: 'POST', body: { lead_id: lead.id, texto: String(nota).slice(0, 2000), autor_nombre: 'Ana Sofi' }, prefer: 'return=minimal', fetchImpl })
}

/** Takes a new lead for this line: only one taker ever gets it back. */
async function tomar(c, lead, ahora, fetchImpl) {
  const filas = await centro(c, `/rest/v1/leads?id=eq.${encodeURIComponent(lead.id)}&etapa=eq.nuevo`, {
    method: 'PATCH',
    body: { etapa: 'programada', llamada_programada: new Date(ahora).toISOString(), llamada_estado: 'marcando' },
    fetchImpl,
  })
  return Array.isArray(filas) && filas.length === 1
}

// ── el tiempo ────────────────────────────────────────────────────────────

export function partes(ms, zona) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(new Date(ms))
  const g = (t) => p.find((x) => x.type === t)?.value
  return { y: Number(g('year')), mo: Number(g('month')), d: Number(g('day')), h: Number(g('hour')), mi: Number(g('minute')), wd: g('weekday') }
}

/** UTC time of a wall-clock hour in a zone. */
export function horaEn(y, mo, d, h, zona, mi = 0) {
  const quiero = Date.UTC(y, mo - 1, d, h, mi)
  let t = quiero
  for (let i = 0; i < 3; i++) {
    const p = partes(t, zona)
    t -= Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - quiero
  }
  return t
}

export const usPhone = (raw) => {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 10 && /^[2-9]/.test(d)) return `+1${d}`
  if (d.length === 11 && /^1[2-9]/.test(d)) return `+${d}`
  return null
}

/** The lead's time zone from the area code (good enough for call hours); Eastern otherwise. */
export function zonaDe(telefono) {
  const area = String(usPhone(telefono) ?? '').slice(2, 5)
  const Z = {
    'America/Chicago': '205 217 218 219 224 225 228 251 254 256 262 309 312 314 316 318 319 320 331 334 337 361 409 414 417 430 432 469 479 501 504 507 512 515 563 573 601 608 612 615 618 620 630 636 641 651 660 662 682 708 712 713 715 731 737 763 769 773 779 785 806 815 816 830 832 847 870 872 901 903 913 918 920 931 936 940 952 956 972 979',
    'America/Denver': '303 307 385 406 435 505 575 719 720 801 915 970',
    'America/Phoenix': '480 520 602 623 928',
    'America/Los_Angeles': '206 209 213 253 279 310 323 341 360 408 415 424 425 442 503 509 510 530 541 559 562 619 626 628 650 657 661 669 702 707 714 725 747 760 775 805 818 820 831 858 909 916 925 949 951 971',
  }
  for (const [z, codes] of Object.entries(Z)) if (codes.split(' ').includes(area)) return z
  return ZONA_MEET
}

const enHorario = (ms, zona) => {
  const { h } = partes(ms, zona)
  return h >= PRIMERA_HORA && h < ULTIMA_HORA
}

/** Three video-call slots (epoch ms): 10, 13 and 15 h Eastern, different days, at least three hours ahead. */
export function horariosMeet(ahora = Date.now()) {
  const out = []
  for (let d = 0; d < 8 && out.length < 3; d++) {
    const { y, mo, d: dia } = partes(ahora + d * 86_400_000, ZONA_MEET)
    const orden = HORAS_MEET.map((_, i) => HORAS_MEET[(out.length + i) % HORAS_MEET.length])
    const t = orden.map((h) => horaEn(y, mo, dia, h, ZONA_MEET)).find((x) => x >= ahora + 3 * 3_600_000)
    if (t && !out.some((x) => partes(x, ZONA_MEET).d === dia)) out.push(t)
  }
  return out
}

const DIAS_ES = { Mon: 'lunes', Tue: 'martes', Wed: 'miércoles', Thu: 'jueves', Fri: 'viernes', Sat: 'sábado', Sun: 'domingo' }
const DIAS_EN = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }

/** The slots as Ana Sofi reads them out. */
export function horariosTexto(lista, idioma = 'es') {
  const en = idioma === 'en'
  const uno = (ms) => {
    const p = partes(ms, ZONA_MEET)
    const mes = new Intl.DateTimeFormat(en ? 'en-US' : 'es-MX', { timeZone: ZONA_MEET, month: 'long' }).format(new Date(ms))
    const h12 = p.h % 12 || 12
    const ap = p.h < 12 ? 'am' : 'pm'
    return en ? `${DIAS_EN[p.wd]}, ${mes} ${p.d} at ${h12} ${ap.toUpperCase()}` : `${DIAS_ES[p.wd]} ${p.d} de ${mes} a la${h12 === 1 ? '' : 's'} ${h12} ${ap}`
  }
  const l = lista.map(uno)
  const junto = l.length > 1 ? `${l.slice(0, -1).join(', ')} ${en ? 'or' : 'o'} ${l.at(-1)}` : l.join('')
  return `${junto}, ${en ? 'Eastern time' : 'hora del Este'}`
}

/**
 * Which offered slot the lead chose, from what was said on the call ("el
 * jueves a la 1", "Thursday at 1 pm"): the slot whose weekday, day number
 * or hour the words name, when exactly one fits. Null when it is unclear.
 */
export function horarioElegido(texto, ofrecidos) {
  const t = doblar(texto)
  if (!t || !ofrecidos?.length) return null
  const puntos = ofrecidos.map((ms) => {
    const p = partes(ms, ZONA_MEET)
    const h12 = p.h % 12 || 12
    let n = 0
    if (t.includes(doblar(DIAS_ES[p.wd])) || t.includes(doblar(DIAS_EN[p.wd]))) n += 2
    if (new RegExp(`(^|\\D)${p.d}(\\D|$)`).test(t)) n += 2
    if (new RegExp(`(^|\\D)${h12}(\\s*(:00)?\\s*(am|pm|a\\.?m|p\\.?m|de la|en punto|hrs?|h\\b)|\\s*$|\\D)`).test(t)) n += 1
    return n
  })
  const mejor = Math.max(...puntos)
  if (mejor < 2) return null
  const ganadores = ofrecidos.filter((_, i) => puntos[i] === mejor)
  return ganadores.length === 1 ? ganadores[0] : null
}

// ── Claude, para lo que no es exacto ─────────────────────────────────────

/** One short question to Claude that must come back as a date-time in a zone (or null). */
export async function fechaDeTexto({ claveClaude, texto, zona, ahora = Date.now(), ofrecidos = [], fetchImpl = fetch, modelo = 'claude-haiku-5-5' }) {
  if (!claveClaude || !texto) return null
  const hoy = new Intl.DateTimeFormat('es-MX', { timeZone: zona, dateStyle: 'full', timeStyle: 'short' }).format(new Date(ahora))
  const pedido =
    `Hoy es ${hoy} (zona ${zona}). Un cliente dijo, en una llamada de ventas, cuándo quiere algo: "${String(texto).slice(0, 300)}".\n` +
    (ofrecidos.length ? `Se le ofrecieron estas opciones (hora del Este): ${ofrecidos.map((ms) => new Date(ms).toISOString()).join(', ')}.\n` : '') +
    `Responde SOLO con la fecha y hora que dijo, en formato YYYY-MM-DDTHH:MM en la zona ${zona}, o NADA si no se entiende. Sin otra palabra.`
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': claveClaude, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: modelo, max_tokens: 30, messages: [{ role: 'user', content: pedido }] }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json()
    const m = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(data?.content?.[0]?.text ?? '')
    if (!m) return null
    const ms = horaEn(+m[1], +m[2], +m[3], +m[4], zona, +m[5])
    return Number.isFinite(ms) ? ms : null
  } catch {
    return null
  }
}

// ── la llamada ───────────────────────────────────────────────────────────

export function saludo(lead, intento = 1) {
  const n = (lead.nombre || '').split(/\s+/)[0]
  const en = lead.idioma === 'en'
  if (lead.origen === 'web') {
    if (en) return intento > 1 ? `Hi${n ? `, is this ${n}` : ''}? This is Ana Sofi from Mi Semago, calling back about the quote you requested on misemago.com. Do you have a few minutes?` : `Hi${n ? `, is this ${n}` : ''}? This is Ana Sofi from Mi Semago. I'm calling because you just requested a quote on our website, misemago.com, and asked us to call you. Do you have a few minutes?`
    return intento > 1 ? `Hola${n ? `, ¿hablo con ${n}` : ''}? Soy Ana Sofi, de Mi Semago. Te vuelvo a llamar por la cotización que pediste en misemago.com. ¿Tienes unos minutos?` : `Hola${n ? `, ¿hablo con ${n}` : ''}? Soy Ana Sofi, de Mi Semago. Te llamo porque acabas de pedir una cotización en nuestra página, misemago.com, y nos pediste que te llamáramos. ¿Tienes unos minutos?`
  }
  if (en) return intento > 1 ? `Hi${n ? `, is this ${n}` : ''}? This is Ana Sofi from Mi Semago, calling back about the prices you asked for on WhatsApp. Do you have a couple of minutes?` : `Hi${n ? `, is this ${n}` : ''}? This is Ana Sofi from Mi Semago. You asked us for prices on WhatsApp a moment ago. Do you have a couple of minutes?`
  return intento > 1 ? `Hola${n ? `, ¿hablo con ${n}` : ''}? Soy Ana Sofi, de Mi Semago. Te vuelvo a llamar por los precios que nos pediste por WhatsApp. ¿Tienes un par de minutos?` : `Hola${n ? `, ¿hablo con ${n}` : ''}? Soy Ana Sofi, de Mi Semago. Hace un momento nos pediste precios por WhatsApp. ¿Tienes un par de minutos?`
}

/** Every variable Ana Sofi's prompt names (ElevenLabs refuses a call missing one). */
export function variables(lead, horarios, intento = 1) {
  const v = (s) => String(s ?? '').trim().slice(0, 300) || '-'
  return {
    saludo: saludo(lead, intento),
    contact_name: v(lead.nombre),
    empresa: v(lead.empresa),
    tipo_negocio: v(lead.tipo),
    ciudad: v(lead.ciudad),
    quesos: v(lead.quesos),
    libras: v(lead.libras),
    frecuencia: v(lead.frecuencia),
    marca_propia: v(lead.marca),
    correo: v(lead.correo),
    idioma: lead.idioma === 'en' ? 'en' : 'es',
    horarios_videollamada: v(horarios),
  }
}

async function eleven(key, path, init = {}, fetchImpl = fetch) {
  const res = await fetchImpl(`${API}${path}`, { ...init, headers: { 'xi-api-key': key, 'content-type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(20_000) })
  const body = await res.text()
  if (!res.ok) {
    console.log(`${TAG} ventas ${path}: ${res.status} ${body.slice(0, 200)}`)
    return { error: res.status }
  }
  try {
    return { data: JSON.parse(body || '{}') }
  } catch {
    return { data: {} }
  }
}

let proveedor = null
async function llamarAhora({ key, cfg, lead, phone, horarios, fetchImpl }) {
  if (!proveedor) {
    const p = await eleven(key, `/phone-numbers/${cfg.phoneId}`, {}, fetchImpl)
    proveedor = doblar(p.data?.provider ?? 'twilio').includes('sip') ? 'sip-trunk' : 'twilio'
  }
  const r = await eleven(key, `/${proveedor}/outbound-call`, {
    method: 'POST',
    body: JSON.stringify({ agent_id: cfg.agentId, agent_phone_number_id: cfg.phoneId, to_number: phone, conversation_initiation_client_data: { user_id: lead.id, dynamic_variables: variables(lead, horarios, 1) } }),
  }, fetchImpl)
  if (r.error) return { error: r.error }
  if (r.data?.success === false) return { error: r.data.message || 'no salió' }
  return r.data?.conversation_id ? { convId: r.data.conversation_id } : { error: 'sin conversación' }
}

async function programarLlamada({ key, cfg, lead, phone, at, zona, horarios, intento, fetchImpl }) {
  const r = await eleven(key, '/batch-calling/submit', {
    method: 'POST',
    body: JSON.stringify({
      call_name: `${NOMBRE}${lead.empresa || lead.nombre || lead.id}`.slice(0, 120),
      agent_id: cfg.agentId,
      agent_phone_number_id: cfg.phoneId,
      scheduled_time_unix: Math.floor(at / 1000),
      timezone: zona,
      recipients: [{ phone_number: phone, conversation_initiation_client_data: { user_id: lead.id, dynamic_variables: variables(lead, horarios, intento) } }],
    }),
  }, fetchImpl)
  if (r.error) return { error: r.error }
  const id = r.data.id ?? r.data.batch_id
  return id ? { id } : { error: 'sin id' }
}

const RESULTADOS = {
  videollamada_agendada: 'Videollamada agendada',
  precio_no_aceptado: 'No aceptó el precio',
  sin_videollamada: 'Habló; no quiso videollamada (todavía)',
  llamar_despues: 'Pidió que le llamemos después',
  no_interesado: 'No le interesa',
  buzon: 'Buzón / no contestó',
  no_contesto: 'No contestó',
  otro: 'Otro',
}
const valor = (dc, k) => {
  const v = dc?.[k]
  return v && typeof v === 'object' && 'value' in v ? v.value : v
}

/** How a finished call went (null while it has not happened or is being analysed). */
export async function comoFue(key, e, fetchImpl = fetch) {
  const b = e.batchId ? await eleven(key, `/batch-calling/${e.batchId}`, {}, fetchImpl) : { data: { recipients: [{ conversation_id: e.convId }] } }
  if (b.error) return b.error === 404 ? { resultado: 'otro', notas: 'La llamada ya no aparece en ElevenLabs.' } : null
  const rec = (b.data.recipients ?? [])[0] ?? {}
  const estado = doblar(rec.status ?? b.data.status)
  const convId = rec.conversation_id ?? rec.conversationId
  if (convId) {
    const c = await eleven(key, `/conversations/${convId}`, {}, fetchImpl)
    if (c.error === 404 && !e.batchId && Date.now() - (e.at ?? 0) > 15 * 60_000) return { resultado: 'no_contesto' }
    if (c.error) return null
    const cs = doblar(c.data.status)
    if (cs !== 'done' && cs !== 'failed') return null
    const dc = c.data.analysis?.data_collection_results ?? {}
    const secs = Number(c.data.metadata?.call_duration_secs ?? 0)
    let resultado = doblar(valor(dc, 'resultado')).replace(/\s+/g, '_')
    if (!RESULTADOS[resultado]) resultado = secs < 20 ? 'no_contesto' : 'otro'
    const get = (k) => String(valor(dc, k) ?? '').trim()
    const turnos = Array.isArray(c.data.transcript) ? c.data.transcript : []
    const acepto = valor(dc, 'precio_aceptado')
    return {
      resultado,
      nombre: get('nombre'),
      correo: get('correo'),
      tipoNegocio: get('tipo_negocio'),
      quesos: get('quesos'),
      frecuencia: get('frecuencia'),
      marcaPropia: get('marca_propia'),
      calificacion: /caliente|medio|frio/.exec(doblar(get('calificacion')))?.[0] ?? '',
      resumen: String(c.data.analysis?.transcript_summary ?? '').trim(),
      transcripcion: turnos.map((t) => `${t.role === 'agent' ? 'Ana Sofi' : 'Cliente'}: ${String(t.message ?? '').trim()}`).filter((l) => !/:\s*$/.test(l)).join('\n'),
      videollamada: get('videollamada'),
      llamarDespues: get('llamar_despues'),
      precioAceptado: acepto === true || doblar(acepto) === 'true',
      precioOfrecido: get('precio_ofrecido'),
      interes: get('interes'),
      volumen: get('volumen_confirmado'),
      notas: String(valor(dc, 'notas') ?? c.data.analysis?.transcript_summary ?? '').trim(),
    }
  }
  if (/fail|cancel|voicemail|no.?answer|busy|reject/.test(estado)) return { resultado: 'no_contesto' }
  if (e.at && Date.now() - e.at > 3 * 3_600_000 && /complet/.test(doblar(b.data.status))) return { resultado: 'no_contesto' }
  return null
}

// ── el calendario de ventas ──────────────────────────────────────────────

/** Books the meeting through the sales calendar's script; resolves { inicio, link, ajustado } or { error }. */
export async function agendarMeet({ url, clave }, { lead, inicio, resultado, fetchImpl = fetch }) {
  if (!url || !clave) return { error: 'falta la conexión con el calendario de ventas (llaves.mjs)' }
  const quien = (lead.empresa || lead.nombre || 'cliente').replace(/"/g, '')
  const descripcion = [
    'Videollamada con el encargado de ventas de Mi Semago / A video call with Mi Semago\'s head of sales.',
    '',
    `Cliente: ${lead.nombre || '-'} · ${lead.empresa || '-'}`,
    `Teléfono: ${lead.telefono || '-'}`,
    lead.tipo && `Negocio: ${lead.tipo}`,
    lead.ciudad && `Ciudad: ${lead.ciudad}`,
    (resultado?.quesos || lead.quesos) && `Quesos: ${resultado?.quesos || lead.quesos}`,
    (resultado?.volumen || lead.libras) && `Libras: ${resultado?.volumen || lead.libras}`,
    resultado?.precioOfrecido && `Precios hablados: ${resultado.precioOfrecido}`,
    resultado?.notas && `Notas de la llamada: ${resultado.notas}`,
  ].filter(Boolean).join('\n')
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ clave, accion: 'agendar', inicio: new Date(inicio).toISOString(), titulo: `Mi Semago · ${quien} · videollamada`, descripcion, invitado: lead.correo, lead: lead.id }),
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000),
    })
    const d = await res.json().catch(() => null)
    if (!d?.ok) return { error: d?.error ?? `el calendario respondió ${res.status}` }
    return { inicio: Date.parse(d.inicio), link: d.link ?? '', ajustado: Boolean(d.ajustado) }
  } catch (err) {
    return { error: err.message }
  }
}

/** Whether the sales calendar's script answers with this key. */
export async function calendarioFunciona(url, clave, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ clave, prueba: true }), redirect: 'follow', signal: AbortSignal.timeout(60_000) })
    const d = await res.json().catch(() => null)
    return d?.ok ? true : d?.error ?? `respondió ${res.status}`
  } catch (err) {
    return err.message
  }
}

// ── un lead, un paso ─────────────────────────────────────────────────────

const iso = (ms) => (ms ? new Date(ms).toISOString() : null)
const esCorreo = (v) => /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(String(v ?? '').trim())
const cuando = (ms, zona, idioma = 'es') => `${new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-MX', { timeZone: zona, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(ms))} (hora de ${zona.split('/').pop().replace(/_/g, ' ')})`

/**
 * One lead, one tick. `o` holds what the line needs:
 *   { c (work center), key (ElevenLabs), cfg (ventas.json), cal (sales calendar), claude (key), avisar(text, {meeting}), ahora, fetchImpl }
 */
export async function paso(lead, estado, o) {
  const { c, key, cfg, ahora } = o
  const s = estado[lead.id]

  // Nuevo, con permiso por escrito: se llama en ese momento.
  if (lead.etapa === 'nuevo' && lead.permiso && (!s || ['cerrado', 'fuera'].includes(s.stage))) {
    const phone = usPhone(lead.telefono)
    if (!phone) {
      if (!(await tomar(c, lead, ahora, o.fetchImpl))) return
      estado[lead.id] = { stage: 'fuera' }
      await escribir(c, lead, { etapa: 'no_califica', llamada_programada: null, llamada_estado: null, nota: `Su número (${lead.telefono || 'vacío'}) no es de EE.UU.: Ana Sofi no lo llama. Hay que llamarle a mano.` }, o.fetchImpl)
      o.avisar?.(`📋 Lead de Mi Semago con número fuera de EE.UU.: ${lead.nombre || '-'} (${lead.empresa || '-'}), ${lead.telefono || 'sin número'}. Ana Sofi no lo llama.`)
      return
    }
    if (!(await tomar(c, lead, ahora, o.fetchImpl))) return // otro ya lo tomó
    const ofrecidos = horariosMeet(ahora)
    const horarios = horariosTexto(ofrecidos, lead.idioma)
    estado[lead.id] = { stage: 'programada', at: ahora, zona: zonaDe(lead.telefono), attempts: 1, ofrecidos, horarios }
    guardarEstado(estado)
    const r = await llamarAhora({ key, cfg, lead, phone, horarios, fetchImpl: o.fetchImpl })
    if (r.convId) {
      estado[lead.id].convId = r.convId
      await escribir(c, lead, { llamada_id: r.convId.slice(0, 120) }, o.fetchImpl)
      console.log(`${TAG} ventas: Ana Sofi ya está llamando a ${lead.nombre || lead.empresa || 'un lead nuevo'}`)
      return
    }
    // No salió al momento: en dos minutos, por la fila de ElevenLabs.
    const at = ahora + 2 * 60_000
    const b = await programarLlamada({ key, cfg, lead, phone, at, zona: estado[lead.id].zona, horarios, intento: 1, fetchImpl: o.fetchImpl })
    if (b.id) {
      Object.assign(estado[lead.id], { batchId: b.id, at })
      await escribir(c, lead, { llamada_programada: iso(at), llamada_estado: 'programada', nota: `La llamada inmediata no salió (${r.error}); va en dos minutos.` }, o.fetchImpl)
      return
    }
    estado[lead.id].stage = 'atorado'
    await escribir(c, lead, { llamada_estado: 'no salió', nota: `No pude llamarle (${r.error} / ${b.error}). Hay que revisarlo.` }, o.fetchImpl)
    o.avisar?.(`⚠️ Ana Sofi no pudo llamar a ${lead.empresa || lead.nombre || 'un lead'} de Mi Semago (${r.error}). Quedó en el Centro de trabajo para revisarlo.`)
    return
  }
  if (!s) {
    // Una llamada que ya iba en marcha cuando la línea se mudó aquí: se sigue desde su conversación.
    if (lead.etapa !== 'programada' || !/^conv_\w+$/.test(lead.llamadaId)) return
    estado[lead.id] = { stage: 'programada', convId: lead.llamadaId, at: ahora - 60_000, zona: zonaDe(lead.telefono), attempts: 1, ofrecidos: [], horarios: '' }
    return
  }
  if (s.stage === 'programada' && (s.batchId || s.convId) && ahora > (s.at ?? 0)) {
    const r = await comoFue(key, s, o.fetchImpl)
    if (r) await despues(lead, s, r, o)
  }
}

async function despues(lead, s, r, o) {
  const { c, key, cfg, ahora } = o
  const quien = lead.empresa || lead.nombre || 'un lead'
  const etiqueta = RESULTADOS[r.resultado] ?? 'Otro'

  if (r.resultado === 'no_contesto' || r.resultado === 'buzon') {
    if ((s.attempts ?? 1) < MAX_INTENTOS) {
      let at = ahora + REINTENTO_MS
      if (!enHorario(at, s.zona)) {
        const p = partes(ahora + 86_400_000, s.zona)
        at = horaEn(p.y, p.mo, p.d, 11, s.zona)
      }
      const phone = usPhone(lead.telefono)
      const b = phone && (await programarLlamada({ key, cfg, lead, phone, at, zona: s.zona, horarios: s.horarios, intento: (s.attempts ?? 1) + 1, fetchImpl: o.fetchImpl }))
      if (b?.id) {
        const antes = s.at
        Object.assign(s, { batchId: b.id, convId: undefined, at, attempts: (s.attempts ?? 1) + 1 })
        await escribir(c, lead, { etapa: 'no_contesto', intentos: s.attempts - 1, ultima_llamada: iso(antes), llamada_programada: iso(at), llamada_estado: 'termino' }, o.fetchImpl)
        return
      }
    }
    s.stage = 'cerrado'
    await escribir(c, lead, { etapa: 'no_contesto', intentos: s.attempts ?? 1, ultima_llamada: iso(s.at), llamada_programada: null, llamada_estado: 'termino', nota: `No contestó después de ${s.attempts ?? 1} llamada(s). Ana Sofi ya no le vuelve a llamar.` }, o.fetchImpl)
    o.avisar?.(`📞 Ana Sofi no localizó a ${quien} (Mi Semago) después de ${s.attempts ?? 1} intento(s).`)
    return
  }

  const datos = {
    intentos: s.attempts ?? 1,
    ultima_llamada: iso(s.at),
    llamada_programada: null,
    llamada_estado: 'termino',
    resumen: [r.notas, r.resumen && r.resumen !== r.notas ? r.resumen : ''].filter(Boolean).join('\n\n').slice(0, 4000),
    ...(r.transcripcion ? { transcripcion: r.transcripcion.slice(0, 60000) } : {}),
    ...(r.precioOfrecido ? { precios: r.precioOfrecido.slice(0, 500) } : {}),
    ...(r.volumen ? { libras: r.volumen.slice(0, 120) } : {}),
    ...(r.calificacion ? { calificacion: r.calificacion } : {}),
    ...(r.tipoNegocio ? { tipo_negocio: r.tipoNegocio.slice(0, 200) } : {}),
    ...(r.quesos ? { quesos: r.quesos.slice(0, 300) } : {}),
    ...(r.frecuencia ? { frecuencia: r.frecuencia.slice(0, 120) } : {}),
    ...(r.marcaPropia ? { marca_propia: r.marcaPropia.slice(0, 200) } : {}),
    ...(esCorreo(r.correo) ? { correo: r.correo.toLowerCase() } : {}),
    ...(r.nombre && !lead.nombre ? { nombre: r.nombre.slice(0, 80) } : {}),
  }
  if (esCorreo(r.correo)) lead.correo = r.correo.toLowerCase()
  if (r.nombre && !lead.nombre) lead.nombre = r.nombre
  const etapa = r.resultado === 'no_interesado' || r.calificacion === 'frio' ? 'no_califica' : r.resultado === 'llamar_despues' ? 'programada' : 'hablo'
  await escribir(c, lead, { ...datos, etapa }, o.fetchImpl)

  if (r.resultado === 'videollamada_agendada' && r.videollamada) {
    s.stage = 'reunion'
    let inicio = horarioElegido(r.videollamada, s.ofrecidos)
    if (!inicio) inicio = await fechaDeTexto({ claveClaude: o.claude, texto: r.videollamada, zona: ZONA_MEET, ahora, ofrecidos: s.ofrecidos ?? [], fetchImpl: o.fetchImpl })
    if (!inicio || !esCorreo(lead.correo)) {
      const falta = !inicio ? `no entendí la hora que eligió ("${r.videollamada}")` : 'falta su correo para invitarlo'
      await escribir(c, lead, { nota: `Quiere videollamada con el encargado de ventas: ${r.videollamada}. No la agendé: ${falta}. Agéndala a mano.` }, o.fetchImpl)
      o.avisar?.(`🎉 ${quien} quiere videollamada (${r.videollamada}), pero ${falta}. Agéndala tú; está en el Centro de trabajo.`, { meeting: true })
      return
    }
    const m = await agendarMeet(o.cal, { lead, inicio, resultado: r, fetchImpl: o.fetchImpl })
    if (m.error) {
      await escribir(c, lead, { nota: `Quiere videollamada: ${r.videollamada}. No se pudo agendar (${m.error}). Agéndala a mano.` }, o.fetchImpl)
      o.avisar?.(`🎉 ${quien} quiere videollamada (${r.videollamada}), pero no se pudo agendar: ${m.error}. Agéndala tú.`, { meeting: true })
      return
    }
    s.stage = 'meet'
    await escribir(c, lead, { etapa: 'meet', meet_inicio: iso(m.inicio), meet_link: m.link || null, nota: `Videollamada agendada: ${cuando(m.inicio, ZONA_MEET)}${m.ajustado ? ' (se ajustó a la hora libre más cercana)' : ''}. La invitación le llegó a ${lead.correo}.` }, o.fetchImpl)
    o.avisar?.(`🎉 Ana Sofi agendó videollamada con ${quien}: ${cuando(m.inicio, ZONA_MEET)}.`, { meeting: true })
    return
  }

  if (r.resultado === 'llamar_despues' && r.llamarDespues) {
    const at = await fechaDeTexto({ claveClaude: o.claude, texto: r.llamarDespues, zona: s.zona, ahora, fetchImpl: o.fetchImpl })
    const phone = usPhone(lead.telefono)
    const valida = at && at > ahora + 5 * 60_000 && at < ahora + 14 * 86_400_000 && enHorario(at, s.zona)
    const b = valida && phone && (await programarLlamada({ key, cfg, lead, phone, at, zona: s.zona, horarios: horariosTexto((s.ofrecidos = horariosMeet(at)), lead.idioma), intento: 2, fetchImpl: o.fetchImpl }))
    if (b?.id) {
      Object.assign(s, { stage: 'programada', batchId: b.id, convId: undefined, at, attempts: 1, horarios: horariosTexto(s.ofrecidos, lead.idioma) })
      await escribir(c, lead, { etapa: 'programada', llamada_programada: iso(at), llamada_estado: 'programada', nota: `Pidió que le llamen otra vez (${r.llamarDespues}). Ana Sofi le llama el ${cuando(at, s.zona)}.` }, o.fetchImpl)
      return
    }
    s.stage = 'cerrado'
    await escribir(c, lead, { nota: `Pidió que le llamen otra vez (${r.llamarDespues}), pero no pude ponerle fecha. Llámale a mano.` }, o.fetchImpl)
    o.avisar?.(`📞 ${quien} pidió que le llamen otra vez (${r.llamarDespues}) y no pude ponerle fecha. Está en el Centro de trabajo.`)
    return
  }

  s.stage = 'cerrado'
  o.avisar?.(`📞 Llamada de Ana Sofi con ${quien} (Mi Semago): ${etiqueta}.${r.notas ? `\n${r.notas.slice(0, 600)}` : ''}`)
}

// ── el reloj ─────────────────────────────────────────────────────────────

/**
 * Starts the line. `o` gives the keys each time they are needed:
 *   { centro: () => ({ url, key }) | null, eleven: () => key, calendario: () => ({ url, clave }), claude: () => key, avisar }
 * Resolves a stop function.
 */
export function iniciarVentas(o) {
  const cfg = leerVentas()
  const falta = []
  if (!cfg.agentId) falta.push('el Agent ID de Ana Sofi')
  if (!cfg.phoneId) falta.push('el número de Ana Sofi')
  if (!o.centro()) falta.push('la conexión con el Centro de trabajo')
  if (!o.eleven()) falta.push('la llave de ElevenLabs')
  if (falta.length) throw new Error(`falta ${falta.join(', ')}`)
  const avisar = (texto, { meeting = false } = {}) => {
    if (leerVentas().avisos !== 'todo' && !meeting && !/^⚠️|fuera de EE/.test(texto)) return console.log(`${TAG} ventas (sin aviso): ${texto.split('\n')[0].slice(0, 160)}`)
    try {
      o.avisar?.(texto)
    } catch {}
  }
  let ocupado = false
  const vuelta = async (soloNuevos) => {
    if (ocupado) return
    ocupado = true
    try {
      const c = o.centro()
      const key = o.eleven()
      if (!c || !key) return
      const filtro = soloNuevos ? 'etapa=eq.nuevo&permiso_llamada=is.true' : 'etapa=in.(nuevo,programada,no_contesto,hablo)'
      const filas = await centro(c, `/rest/v1/leads?select=*&${filtro}&order=creado.asc&limit=200`)
      const estado = leerEstado()
      const ahora = Date.now()
      for (const lead of (filas ?? []).map(leadDe)) {
        try {
          await paso(lead, estado, { c, key, cfg: leerVentas(), cal: o.calendario() ?? {}, claude: o.claude(), avisar, ahora })
        } catch (err) {
          console.log(`${TAG} ventas: ${lead.nombre || lead.id}: ${err?.message ?? err}`)
        }
        guardarEstado(estado)
      }
    } catch (err) {
      console.log(`${TAG} ventas: ${err?.message ?? err}`)
    } finally {
      ocupado = false
    }
  }
  const a = setInterval(() => vuelta(true), NUEVOS_MS)
  const b = setInterval(() => vuelta(false), RELOJ_MS)
  setTimeout(() => vuelta(false), 5_000).unref?.()
  console.log(`${TAG} ventas: Ana Sofi llama a los leads del Centro de trabajo`)
  return () => {
    clearInterval(a)
    clearInterval(b)
  }
}
