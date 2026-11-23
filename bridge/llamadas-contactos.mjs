import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { readContacts } from './contact-book.mjs'
import { readTelegram } from './telegram-config.mjs'
import { api, say, upload } from './nucleo/telegram.mjs'

/**
 * NEX keeps the owner posted on every call the messenger makes to a contact,
 * live, on his Telegram:
 *
 *   📞 dialing → 🟢 they answered → ✅ hung up, with the summary, what the
 *   person said, the transcript and the recording — or ❌ no answer, with a
 *   🔁 button to call again with the same message.
 *
 * It watches the messenger agent's conversations in ElevenLabs while NEX is
 * on (calls placed now and calls booked for later alike). It also sends any
 * ElevenLabs conversation (transcript + audio) on request: sendConversation.
 *
 * And it keeps the messenger's instructions so that an interruption never
 * loses the message (ensureMessengerPrompt).
 */

const API = 'https://api.elevenlabs.io/v1/convai'
const SEEN_FILE = join(homedir(), '.nexy', 'llamadas-contactos.json')
const EVERY_MS = 8_000
/** Shorter than this with no words from the person: nobody really answered (voicemail, rejected, no answer). */
const MIN_ANSWER_SECS = 8
const RECALL_GAP_MS = 60_000

const agentId = () => (process.env.NEXY_MESSENGER_AGENT_ID ?? '').trim()
const fromId = () => (process.env.NEXY_MESSENGER_PHONE_ID || process.env.NEXY_CALL_PHONE_ID || '').trim()

async function el(key, path, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'xi-api-key': key, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json()
}

function readSeen() {
  try {
    return JSON.parse(readFileSync(SEEN_FILE, 'utf8')) ?? {}
  } catch {
    return {}
  }
}
function writeSeen(seen) {
  // Only the last 300 calls are remembered.
  const keep = Object.fromEntries(Object.entries(seen).sort((a, b) => (b[1].t ?? 0) - (a[1].t ?? 0)).slice(0, 300))
  mkdirSync(dirname(SEEN_FILE), { recursive: true })
  writeFileSync(SEEN_FILE, `${JSON.stringify(keep, null, 1)}\n`, { mode: 0o600 })
}

const owner = () => {
  const tg = readTelegram()
  return tg?.token && tg.owner?.id ? { token: tg.token, id: tg.owner.id } : null
}
async function tell(text, extra = {}) {
  const o = owner()
  if (!o) return
  try {
    if (extra.reply_markup) await api(o.token, 'sendMessage', { chat_id: o.id, text, ...extra })
    else await say(o.token, o.id, text)
  } catch (err) {
    console.log(`[jarvis] contact calls: telegram failed (${err.message})`)
  }
}

/** Who was called: the name it was called with, or the contact with that number. */
function whoOf(conv) {
  const vars = conv?.conversation_initiation_client_data?.dynamic_variables ?? {}
  const phone = conv?.metadata?.phone_call?.external_number ?? vars.system__called_number ?? ''
  const contact = readContacts().find((c) => phone && c.telefono.replace(/\D/g, '').endsWith(String(phone).replace(/\D/g, '').slice(-10)))
  return { name: contact?.nombre ?? vars.contact_name ?? 'el contacto', phone: contact?.telefono ?? phone, message: vars.nexy_brief ?? '' }
}

const mmss = (s) => `${Math.floor((s ?? 0) / 60)}:${String(Math.round((s ?? 0) % 60)).padStart(2, '0')}`

/** The whole conversation as text: who said what. */
export function transcriptText(conv, { nombreAgente = 'Asistente', nombrePersona = 'Persona' } = {}) {
  return (conv.transcript ?? [])
    .filter((t) => t.message)
    .map((t) => `[${mmss(t.time_in_call_secs)}] ${t.role === 'agent' ? nombreAgente : nombrePersona}: ${t.message}`)
    .join('\n')
}

/** Whether the person really answered. */
export function answered(conv) {
  const secs = conv?.metadata?.call_duration_secs ?? conv?.call_duration_secs ?? 0
  const words = (conv?.transcript ?? []).some((t) => t.role === 'user' && String(t.message ?? '').replace(/[^\p{L}]/gu, '').length > 2)
  return secs >= MIN_ANSWER_SECS && words
}

/** Transcript (as a .txt) and recording (as an .mp3) of one conversation, to the owner's Telegram. */
export async function sendConversation(key, id, { titulo = 'Conversación', nombrePersona = 'Persona', nombreAgente = 'Asistente' } = {}) {
  const o = owner()
  if (!o) throw new Error('Telegram no está conectado en esta Mac')
  const conv = await el(key, `/conversations/${id}`)
  const fecha = new Date((conv.metadata?.start_time_unix_secs ?? Date.now() / 1000) * 1000)
  const dia = fecha.toLocaleString('es-MX', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })
  const resumen = conv.analysis?.transcript_summary?.trim()
  const texto = `${titulo} · ${dia} · ${mmss(conv.metadata?.call_duration_secs)}\n${resumen ? `\nResumen: ${resumen}\n` : ''}\n${transcriptText(conv, { nombreAgente, nombrePersona }) || '(sin palabras)'}\n`
  const base = `${titulo.replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-') || 'conversacion'}-${fecha.toISOString().slice(0, 16).replace(/[:T]/g, '')}`
  await upload(o.token, o.id, 'sendDocument', 'document', Buffer.from(texto, 'utf8'), `${base}.txt`, `📝 Transcripción: ${titulo}`)
  try {
    const audio = await el(key, `/conversations/${id}/audio`, { raw: true })
    if (audio.length > 1000) await upload(o.token, o.id, 'sendAudio', 'audio', audio, `${base}.mp3`, `🎧 Grabación: ${titulo}`)
  } catch (err) {
    await tell(`(La grabación de "${titulo}" no está disponible: ${err.message.slice(0, 120)})`)
  }
  return conv
}

/** Recent conversations of an agent (newest first). */
export async function recentConversations(key, agent, days = 7, pageSize = 30) {
  const after = Math.floor(Date.now() / 1000) - days * 86_400
  const r = await el(key, `/conversations?agent_id=${encodeURIComponent(agent)}&call_start_after_unix=${after}&page_size=${Math.min(100, pageSize)}`)
  return r.conversations ?? []
}

// -- calling again (the 🔁 button) -------------------------------------------------

let lastRecall = 0
/** The same contact and message again, right now (the owner tapped 🔁 under a "no answer"). */
export async function callAgain(elevenKey, conversationId) {
  const key = elevenKey()
  const agent = agentId()
  const from = fromId()
  if (!key || !/^agent_\w+$/.test(agent) || !from) return 'Las llamadas a contactos no están configuradas en esta Mac.'
  if (Date.now() - lastRecall < RECALL_GAP_MS) return 'Acabo de llamar hace menos de un minuto; espera un momento.'
  const conv = await el(key, `/conversations/${conversationId}`)
  if (conv.agent_id !== agent) return 'Esa llamada no la hizo mi mensajera; no la repito.'
  const who = whoOf(conv)
  // Only someone on the approved list, as always.
  const contact = readContacts().find((c) => c.telefono === who.phone)
  if (!contact) return `${who.name} ya no está en tus contactos aprobados; no le llamo.`
  if (!who.message) return 'No encuentro el mensaje de esa llamada.'
  lastRecall = Date.now()
  const r = await el(key, '/twilio/outbound-call', {
    method: 'POST',
    body: {
      agent_id: agent,
      agent_phone_number_id: from,
      to_number: contact.telefono,
      conversation_initiation_client_data: { dynamic_variables: { contact_name: contact.nombre.split(' ')[0], nexy_brief: who.message } },
    },
  })
  if (r.conversation_id) watchCall(r.conversation_id, contact.nombre)
  return `🔁 Llamando otra vez a ${contact.nombre} con el mismo mensaje.`
}

// -- the watch -------------------------------------------------------------------

const live = new Map() // conversation id → { name, status }
let keyFn = null

/** Start following a call right away (call_contact gives its id). */
export function watchCall(conversationId, name) {
  if (!conversationId || live.has(conversationId)) return
  live.set(conversationId, { name, status: '' })
  void tell(`📞 Marcando a ${name}…`)
  const seen = readSeen()
  seen[conversationId] = { ...(seen[conversationId] ?? {}), t: Date.now(), dial: true }
  writeSeen(seen)
}

async function step(conversationId, info) {
  const key = keyFn?.()
  if (!key) return
  let conv
  try {
    conv = await el(key, `/conversations/${conversationId}`)
  } catch {
    return
  }
  const status = conv.status ?? ''
  const who = whoOf(conv)
  const name = info.name || who.name
  if (status === info.status) return
  info.status = status
  if (status === 'in-progress') return tell(`🟢 ${name} contestó: la mensajera le está dando tu mensaje.`)
  if (status !== 'done' && status !== 'failed') return
  live.delete(conversationId)
  const seen = readSeen()
  if (seen[conversationId]?.reported) return
  seen[conversationId] = { ...(seen[conversationId] ?? {}), t: Date.now(), reported: true }
  writeSeen(seen)
  const otra = { reply_markup: { inline_keyboard: [[{ text: `🔁 Llamar otra vez a ${name.split(' ')[0]}`, callback_data: `rellamar:${conversationId}` }]] } }
  if (status === 'failed') return tell(`⚠️ La llamada a ${name} no salió (falló la línea). ¿Le llamo otra vez?`, otra)
  if (!answered(conv)) {
    const motivo = conv.metadata?.termination_reason ? ` (${String(conv.metadata.termination_reason).slice(0, 80)})` : ''
    return tell(`❌ ${name} no contestó${motivo}. ¿Le llamo otra vez con el mismo mensaje?`, otra)
  }
  // Answered: what happened, what the person said, and the files.
  const dijo = (conv.transcript ?? []).filter((t) => t.role === 'user' && t.message).map((t) => t.message.trim()).join(' / ')
  const resumen = conv.analysis?.transcript_summary?.trim()
  await tell(
    `✅ Terminó la llamada con ${name} (${mmss(conv.metadata?.call_duration_secs)}).` +
      `${resumen ? `\n\nResumen: ${resumen.slice(0, 900)}` : ''}` +
      `${dijo ? `\n\nLo que dijo ${name.split(' ')[0]}: «${dijo.slice(0, 900)}»` : ''}`,
  )
  try {
    await sendConversation(key, conversationId, { titulo: `Llamada a ${name}`, nombrePersona: name.split(' ')[0], nombreAgente: 'Mensajera' })
  } catch (err) {
    await tell(`(No pude mandarte la transcripción y el audio: ${err.message.slice(0, 120)})`)
  }
}

/** While NEX is on: every call of the messenger (now or booked), followed to the end. */
export function startContactCallWatch(elevenKey) {
  keyFn = elevenKey
  const agent = agentId()
  if (!/^agent_\w+$/.test(agent)) return
  let busy = false
  let first = true
  const run = async () => {
    const key = elevenKey()
    if (busy || !key) return
    busy = true
    try {
      // New calls (also the booked ones, when they ring).
      const recent = await recentConversations(key, agent, 1, 20)
      const seen = readSeen()
      for (const c of recent) {
        const id = c.conversation_id
        if (!id || live.has(id)) continue
        if (first) {
          // What was there before NEX started is not news, unless it is still going.
          if (c.status === 'done' || c.status === 'failed') {
            seen[id] = { ...(seen[id] ?? {}), t: Date.now(), reported: true }
            continue
          }
        }
        if (seen[id]?.reported) continue
        live.set(id, { name: '', status: '' })
        if (!seen[id]?.dial) {
          seen[id] = { ...(seen[id] ?? {}), t: Date.now(), dial: true }
          let name = 'un contacto'
          try {
            name = whoOf(await el(key, `/conversations/${id}`)).name
          } catch {}
          live.get(id).name = name
          await tell(`📞 Llamando a ${name} (llamada programada)…`)
        }
      }
      writeSeen(seen)
      first = false
      for (const [id, info] of live) await step(id, info)
    } catch (err) {
      console.log(`[jarvis] contact calls: ${err.message}`)
    } finally {
      busy = false
    }
  }
  setTimeout(run, 10_000).unref?.()
  setInterval(run, EVERY_MS).unref?.()
  console.log('[jarvis] contact calls: live updates on')
  void ensureMessengerPrompt(elevenKey)
}

// -- the message survives interruptions ---------------------------------------------

const MARCA = 'MENSAJE DE ESTA LLAMADA:'
export const MESSAGE_BLOCK = `${MARCA} {{nexy_brief}}
- Tu trabajo en esta llamada es que la persona reciba ESE mensaje completo. No cuelgues sin haberlo dado completo.
- Si te interrumpen mientras lo das (te hablan encima, te saludan, preguntan quién eres, hay ruido), contesta en una frase corta y luego di: "Te repito el mensaje de Eduardo:" y da el mensaje COMPLETO otra vez, desde el principio.
- Si no sabes si lo escuchó completo, repítelo completo. Al final pregunta si quedó claro o si quiere dejarle una respuesta a Eduardo, y escúchala.
- Ignora ruidos, sonidos, palabras sueltas o frases sin sentido: no les respondas y nunca digas que no tienes mensaje.`

/** The messenger's instructions carry the message and the "repeat it after an interruption" rule (once per start). */
export async function ensureMessengerPrompt(elevenKey) {
  const key = elevenKey()
  const agent = agentId()
  if (!key || !/^agent_\w+$/.test(agent)) return
  try {
    const a = await el(key, `/agents/${agent}`)
    const p = a.conversation_config?.agent?.prompt
    if (!p) return
    const texto = String(p.prompt ?? '')
    const i = texto.indexOf(MARCA)
    const nuevo = `${(i >= 0 ? texto.slice(0, i) : texto).trim()}\n\n${MESSAGE_BLOCK}`
    if (nuevo === texto) return
    // ElevenLabs refuses a prompt with both `tools` and `tool_ids`.
    const { tools: _t, ...sinTools } = p
    const prompt = Array.isArray(p.tool_ids) ? sinTools : p
    await el(key, `/agents/${agent}`, { method: 'PATCH', body: { conversation_config: { agent: { prompt: { ...prompt, prompt: nuevo } } } } })
    console.log('[jarvis] contact calls: messenger instructions updated (the message survives interruptions)')
  } catch (err) {
    console.log(`[jarvis] contact calls: messenger instructions not updated (${err.message})`)
  }
}
