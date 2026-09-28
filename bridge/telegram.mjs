import { query } from '@anthropic-ai/claude-agent-sdk'
import { hub } from './console.mjs'
import { readBrands } from './brands.mjs'
import { readTelegram, writeTelegram } from './telegram-config.mjs'

/**
 * Nexy on Telegram: the owner's way to reach her away from the office.
 *
 * A private bot, polled from this Mac — nothing has to be opened to the
 * internet. The owner writes or sends a voice note; the note is transcribed
 * with ElevenLabs Scribe, the request goes to the same agent as the voice
 * interface (same tools, team, brands, memory and permission gate), and the
 * answer comes back as text, or as a voice note in the owner's ElevenLabs
 * voice when they spoke. Outward actions wait for a tap on Aprobar in the
 * chat, and every request shows in the console like any other.
 *
 * Only one person is ever answered: the owner, paired once with a code that
 * scripts/telegram.mjs prints on this Mac. Messages from anyone else are
 * dropped unread. The bot token lives in ~/.nexy/telegram.json (see
 * telegram-config.mjs) and is never logged.
 */

const API = 'https://api.telegram.org'
/** Telegram's own limit is 4096; a little room for safety. */
const MAX_MESSAGE = 3900
/** Voice notes are for listening, not for reading an essay aloud. */
const MAX_SPOKEN = 2500
/** Telegram bots can only download files up to 20 MB. */
const MAX_DOWNLOAD = 20 * 1024 * 1024
/** A message older than this when Nexy starts is asked about, not acted on. */
const STALE_MS = 10 * 60_000

const CHANNEL_PROMPT = `

THIS CONVERSATION IS ON TELEGRAM. The owner is away from the office and is
reading on their phone, or listening when they sent a voice note. Speak Spanish
unless they write in another language. The screen, blades, interface controls
and camera do not exist here; never try to show anything. Write plain text with
no markdown, no asterisks and no headings; short paragraphs, and a plain
numbered list when it genuinely helps. When one of your agents returns content,
include the full content in your reply: there is no console in front of them.
Outward actions are approved with buttons in this same chat, so do not tell them
to look at the console.`

const HELP =
  'Soy Nexy. Escríbeme o mándame una nota de voz con lo que necesites.\n\n' +
  '/voz — contestarte siempre con nota de voz\n' +
  '/texto — contestarte siempre por escrito\n' +
  '/auto — voz si me hablas, texto si me escribes\n' +
  '/nuevo — empezar una conversación nueva\n' +
  '/ayuda — ver esto otra vez'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Telegram's Bot API, JSON in and out. Never logs the URL: it holds the token. */
async function api(token, method, params = {}, timeoutMs = 20_000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!data.ok) {
      const err = new Error(data.description ?? `HTTP ${res.status}`)
      err.code = data.error_code ?? res.status
      throw err
    }
    return data.result
  } finally {
    clearTimeout(timer)
  }
}

/** Split a long answer at paragraph or line breaks, never mid-word if avoidable. */
export function chunks(text, max = MAX_MESSAGE) {
  const out = []
  let rest = String(text ?? '').trim()
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n\n', max)
    if (cut < max / 2) cut = rest.lastIndexOf('\n', max)
    if (cut < max / 2) cut = rest.lastIndexOf(' ', max)
    if (cut < max / 2) cut = max
    out.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) out.push(rest)
  return out
}

/** Text as it should be heard: no links, no markup, nothing read out symbol by symbol. */
export function forSpeech(text) {
  return String(text ?? '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>|~]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, MAX_SPOKEN)
}

const TOOL_LABEL = {
  gmail__send_email: 'Enviar correo',
  gmail__draft_email: 'Crear borrador de correo',
  'notion__API-post-page': 'Crear tarea o página en Notion',
  'notion__API-patch-page': 'Actualizar tarea en Notion',
  'notion__API-create-a-comment': 'Comentar en Notion',
  'notion__API-patch-block-children': 'Agregar contenido en Notion',
  'notion__API-update-a-block': 'Editar contenido en Notion',
  'notion__API-update-page-markdown': 'Reescribir página de Notion',
}

const FIELD = {
  to: 'Para',
  cc: 'Copia',
  subject: 'Asunto',
  body: 'Mensaje',
  message: 'Mensaje',
  text: 'Texto',
  caption: 'Texto',
  name: 'Nombre',
  markdown: 'Contenido',
}
const SKIP = new Set(['parent', 'subagent_type', 'run_in_background', 'model'])

const notionValue = (p) => {
  if (!p || typeof p !== 'object') return String(p ?? '')
  const plain = (v) => (Array.isArray(v) ? v.map((t) => t?.plain_text ?? t?.text?.content ?? '').join('') : '')
  if ('title' in p) return plain(p.title)
  if ('rich_text' in p) return plain(p.rich_text)
  if ('status' in p) return p.status?.name ?? ''
  if ('select' in p) return p.select?.name ?? ''
  if ('date' in p) return [p.date?.start, p.date?.end].filter(Boolean).join(' → ')
  if ('checkbox' in p) return p.checkbox ? 'Sí' : 'No'
  return JSON.stringify(p).slice(0, 200)
}

/** An approval as the owner reads it on the phone. */
export function describeApproval(view) {
  const key = `${view.server}__${view.tool}`
  const brand = readBrands().marcas.find((b) => b.id === view.brand)
  const lines = ['⏸️ ¿Apruebas?']
  if (brand) lines.push(`🏷️ Marca: ${brand.nombre}`)
  lines.push(`➡️ ${TOOL_LABEL[key] ?? `${view.server} · ${view.tool.replace(/[_-]+/g, ' ')}`}`, '')
  const input = view.input && typeof view.input === 'object' ? view.input : {}
  for (const [k, v] of Object.entries(input)) {
    if (SKIP.has(k) || v === undefined || v === null || v === '') continue
    if (k === 'properties' && typeof v === 'object') {
      for (const [pk, pv] of Object.entries(v)) lines.push(`${pk}: ${notionValue(pv)}`)
      continue
    }
    const value = typeof v === 'string' ? v : Array.isArray(v) ? v.map(String).join(', ') : JSON.stringify(v)
    lines.push(`${FIELD[k] ?? k}: ${value.length > 900 ? `${value.slice(0, 900)}…` : value}`)
  }
  return lines.join('\n').slice(0, MAX_MESSAGE)
}

async function transcribe(key, bytes, name) {
  const form = new FormData()
  form.append('model_id', 'scribe_v1')
  form.append('file', new Blob([bytes], { type: 'audio/ogg' }), name)
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  })
  if (!res.ok) throw new Error(`Scribe ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return String((await res.json()).text ?? '').trim()
}

async function speak(key, voiceId, text) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5',
      voice_settings: { stability: 0.45, similarity_boost: 0.75 },
    }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * One running conversation with the agent. Requests queue in order; each gets
 * its answer from the result that closes its turn.
 */
function conversation({ agentOptions, onAnswer, runQuery }) {
  const inbox = []
  const jobs = []
  let deliver = null
  let closed = false

  async function* prompts() {
    while (!closed) {
      const text = inbox.shift() ?? (await new Promise((r) => (deliver = r)))
      if (closed || text == null) return
      yield { type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null }
    }
  }

  const session = runQuery({
    prompt: prompts(),
    options: agentOptions({ channelPrompt: CHANNEL_PROMPT, currentTask: () => jobs[0]?.taskId ?? null }),
  })

  const done = (async () => {
    try {
      for await (const msg of session) {
        if (msg.type === 'assistant') {
          for (const block of msg.message?.content ?? []) {
            if (block.type === 'tool_use') {
              hub.startStep(jobs[0]?.taskId, block.id, block.name, block.input, msg.parent_tool_use_id ?? null)
            }
          }
        } else if (msg.type === 'user' && Array.isArray(msg.message?.content)) {
          for (const block of msg.message.content) {
            if (block?.type === 'tool_result') hub.endStep(block.tool_use_id, block.is_error === true, block.content)
          }
        } else if (msg.type === 'result') {
          const job = jobs.shift()
          const ok = msg.subtype === 'success'
          const text = ok ? String(msg.result ?? '').trim() : 'No pude terminar eso. Inténtalo otra vez, por favor.'
          if (!ok) console.error(`[jarvis] telegram turn failed: ${msg.subtype}`)
          if (job) {
            hub.endTask(job.taskId, ok ? 'done' : 'error', text)
            onAnswer(job, text || 'Listo.')
          }
        }
      }
    } catch (err) {
      console.error('[jarvis] telegram session error:', err?.message ?? err)
      for (const job of jobs.splice(0)) {
        hub.endTask(job.taskId, 'error', '')
        onAnswer(job, 'Tuve un problema y reinicié la conversación. ¿Me lo repites?')
      }
    } finally {
      closed = true
    }
  })()

  return {
    get closed() {
      return closed
    },
    get busy() {
      return jobs.length > 0
    },
    ask(text, job) {
      jobs.push(job)
      if (deliver) {
        const r = deliver
        deliver = null
        r(text)
      } else inbox.push(text)
    },
    close() {
      closed = true
      deliver?.(null)
      session.close?.()
      for (const job of jobs.splice(0)) hub.endTask(job.taskId, 'interrupted', '')
      return done
    },
  }
}

/**
 * Start the bot if it has been set up. Safe to call when it hasn't: it says
 * so once and does nothing.
 */
export async function startTelegram({ agentOptions, elevenKey, voiceId, runQuery = query }) {
  let cfg = readTelegram()
  if (!cfg) {
    console.log('[jarvis] telegram off — set it up with: node scripts/telegram.mjs')
    return
  }
  const token = cfg.token
  try {
    const me = await api(token, 'getMe')
    console.log(`[jarvis] telegram on as @${me.username}${cfg.owner ? '' : ' — waiting for the owner to send the pairing code'}`)
  } catch (err) {
    console.log(`[jarvis] telegram could not start: ${err.message}. Check the token with: node scripts/telegram.mjs estado`)
    return
  }

  const send = (params) => api(token, 'sendMessage', params).catch((err) => console.log(`[jarvis] telegram send failed: ${err.message}`))
  const say = async (chatId, text) => {
    for (const part of chunks(text)) await send({ chat_id: chatId, text: part })
  }

  let convo = null
  const talk = () => {
    if (!convo || convo.closed) convo = conversation({ agentOptions, onAnswer: answer, runQuery })
    return convo
  }

  // "Typing…" / "recording…" for as long as she is working, so a long job
  // never looks like she stopped listening.
  let typing = null
  const keepTyping = (chatId, voice) => {
    if (typing) return
    const tick = () => api(token, 'sendChatAction', { chat_id: chatId, action: voice ? 'record_voice' : 'typing' }).catch(() => {})
    tick()
    typing = setInterval(() => {
      if (!convo?.busy) {
        clearInterval(typing)
        typing = null
      } else tick()
    }, 4500)
  }

  async function answer(job, text) {
    const key = elevenKey()
    if (job.voice && key) {
      try {
        const audio = await speak(key, voiceId, forSpeech(text))
        const form = new FormData()
        form.append('chat_id', String(job.chatId))
        form.append('voice', new Blob([audio], { type: 'audio/mpeg' }), 'nexy.mp3')
        if (text.length <= 1000) form.append('caption', text)
        const res = await fetch(`${API}/bot${token}/sendVoice`, { method: 'POST', body: form })
        const data = await res.json().catch(() => ({}))
        if (!data.ok) throw new Error(data.description ?? `HTTP ${res.status}`)
        if (text.length > 1000) await say(job.chatId, text)
        return
      } catch (err) {
        console.log(`[jarvis] telegram voice reply failed, sending text: ${err.message}`)
      }
    }
    await say(job.chatId, text)
  }

  // Approvals: a message with two buttons, edited once it is answered —
  // from here or from the console, whichever came first.
  const cards = new Map()
  hub.addApprover({
    requested(view) {
      const owner = readTelegram()?.owner
      if (!owner) return
      const text = describeApproval(view)
      api(token, 'sendMessage', {
        chat_id: owner.id,
        text,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Aprobar', callback_data: `ap:${view.id}` },
              { text: '❌ Rechazar', callback_data: `rj:${view.id}` },
            ],
          ],
        },
      })
        .then((m) => cards.set(view.id, { chatId: owner.id, messageId: m.message_id, text }))
        .catch((err) => console.log(`[jarvis] telegram approval card failed: ${err.message}`))
    },
    settled({ id, approved, note }) {
      const card = cards.get(id)
      if (!card) return
      cards.delete(id)
      const verdict = approved ? '✅ Aprobado' : note && /10 minutos/.test(note) ? '⌛ Sin respuesta: no se hizo' : '❌ Rechazado: no se hizo'
      api(token, 'editMessageText', {
        chat_id: card.chatId,
        message_id: card.messageId,
        text: `${card.text.replace(/^⏸️ ¿Apruebas\?/, '')}\n\n${verdict}`.trim(),
      }).catch(() => {})
    },
  })

  async function handle(update) {
    if (update.callback_query) {
      const q = update.callback_query
      const owner = readTelegram()?.owner
      if (!owner || q.from?.id !== owner.id || q.message?.chat?.id !== owner.id) return
      const [kind, id] = String(q.data ?? '').split(':')
      if ((kind === 'ap' || kind === 'rj') && id) {
        hub.answer(id, kind === 'ap', kind === 'rj' ? 'Rechazado desde Telegram.' : '')
        await api(token, 'answerCallbackQuery', { callback_query_id: q.id, text: kind === 'ap' ? 'Aprobado' : 'Rechazado' }).catch(() => {})
      }
      return
    }

    const m = update.message
    if (!m || m.chat?.type !== 'private' || !m.from) return
    // Read fresh each time: pairing, /voz and scripts/telegram.mjs all change it.
    const fresh = readTelegram()
    if (!fresh) return
    cfg = fresh
    const text = typeof m.text === 'string' ? m.text.trim() : ''

    // Pairing: the first person to send the code printed on this Mac becomes
    // the owner. Before that, and for anyone else after, nothing is answered.
    if (!cfg.owner) {
      const code = text.replace(/^\/start\s*/, '').trim()
      if (cfg.pairCode && code === cfg.pairCode) {
        cfg = { ...cfg, owner: { id: m.from.id, name: m.from.first_name ?? '' }, pairCode: null }
        writeTelegram(cfg)
        console.log('[jarvis] telegram paired with its owner')
        await say(m.chat.id, `Listo, ${cfg.owner.name || 'ya te conozco'}. Desde ahora solo te respondo a ti.\n\n${HELP}`)
      } else {
        console.log('[jarvis] telegram: ignored a message while waiting for the pairing code')
      }
      return
    }
    if (m.from.id !== cfg.owner.id) {
      console.log('[jarvis] telegram: ignored a message from someone who is not the owner')
      return
    }

    const chatId = m.chat.id
    if (text === '/start' || text === '/ayuda' || text === '/help') return say(chatId, HELP)
    if (text === '/voz' || text === '/texto' || text === '/auto') {
      const voice = { '/voz': 'siempre', '/texto': 'nunca', '/auto': 'auto' }[text]
      cfg = { ...cfg, voice }
      writeTelegram(cfg)
      return say(chatId, { siempre: 'Te contesto siempre con nota de voz.', nunca: 'Te contesto siempre por escrito.', auto: 'Nota de voz si me hablas, texto si me escribes.' }[voice])
    }
    if (text === '/nuevo') {
      await convo?.close()
      convo = null
      return say(chatId, 'Conversación nueva. ¿En qué te ayudo?')
    }

    let request = text
    const audio = m.voice ?? m.audio
    if (audio) {
      const key = elevenKey()
      if (!key) return say(chatId, 'No puedo escuchar notas de voz: falta la llave de ElevenLabs en esta Mac. Escríbeme, por favor.')
      if ((audio.file_size ?? 0) > MAX_DOWNLOAD) return say(chatId, 'Esa nota de voz es demasiado larga. ¿Me mandas una más corta?')
      try {
        const file = await api(token, 'getFile', { file_id: audio.file_id })
        const res = await fetch(`${API}/file/bot${token}/${file.file_path}`)
        if (!res.ok) throw new Error(`download ${res.status}`)
        request = await transcribe(key, Buffer.from(await res.arrayBuffer()), 'nota.ogg')
      } catch (err) {
        console.log(`[jarvis] telegram voice note failed: ${err.message}`)
        return say(chatId, 'No pude escuchar esa nota de voz. ¿Me la mandas otra vez o me la escribes?')
      }
      if (!request) return say(chatId, 'No alcancé a escuchar nada en esa nota.')
    } else if (!text) {
      return say(chatId, 'Por ahora entiendo mensajes y notas de voz.')
    }

    // Written while this Mac was off or Nexy was closed: ask, don't act.
    if (Date.now() - m.date * 1000 > STALE_MS) {
      return say(chatId, `Me llegó esto mientras estaba apagada:\n«${request.slice(0, 500)}»\n\n¿Todavía lo quieres? Mándamelo de nuevo y lo hago.`)
    }

    const voice = cfg.voice === 'siempre' || (cfg.voice !== 'nunca' && Boolean(audio))
    const taskId = hub.startTask(request, undefined, 'telegram')
    talk().ask(request, { taskId, chatId, voice })
    keepTyping(chatId, voice)
  }

  // Long polling: one request waits up to 30 seconds for news. Nothing on this
  // Mac is opened to the internet.
  let offset = 0
  for (;;) {
    try {
      const updates = await api(token, 'getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query'] }, 45_000)
      for (const u of updates) {
        offset = u.update_id + 1
        await handle(u).catch((err) => console.log(`[jarvis] telegram message failed: ${err?.message ?? err}`))
      }
    } catch (err) {
      if (err.code === 409) console.log('[jarvis] telegram: another copy of Nexy is using this bot; close the other one')
      else if (err.code === 401) {
        console.log('[jarvis] telegram token was rejected; set it up again with: node scripts/telegram.mjs')
        return
      } else if (err.name !== 'AbortError') console.log(`[jarvis] telegram poll failed: ${err.message}`)
      await sleep(5000)
    }
  }
}
