import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, sep } from 'node:path'
import { DONE, INBOX, MUSIC, VIDEO_DIR } from './video.mjs'
import { hub, spendsMoney } from './console.mjs'
import { RECEIVED_DIR, readBrands } from './brands.mjs'
import { INVOICES_DIR } from './invoice-pdf.mjs'
import { readTelegram, writeTelegram } from './telegram-config.mjs'
import { isVideo, postPreview } from './post-preview.mjs'
import { clearSession, loadSession, saveSession } from './session-store.mjs'
import { country, toE164 } from './contact-book.mjs'
import { setRoutineRunner } from './routines.mjs'
import { setSalesNotifier } from './ventas.mjs'
import { zohoAction, zohoLines } from './zoho-preview.mjs'
import { smoothBoss } from './speech.mjs'

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
/** The model reads images up to about this size; a bigger file is refused kindly. */
const MAX_IMAGE = 5 * 1024 * 1024
/** At most this many images in one request. */
const MAX_IMAGES = 8
/** Photos sent together arrive one by one; wait this long to take them as one. */
const ALBUM_WAIT_MS = 1500
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

/**
 * A turn with no sign of life for this long is stopped: a tool that never
 * answers would otherwise leave her "typing" for ever. Time spent waiting for
 * the owner's approval doesn't count.
 */
const STUCK_MS = Number(process.env.NEXY_STUCK_MS) || 5 * 60_000
/**
 * Slow by nature, so they get longer: renders and edits, AI images and videos
 * (Higgsfield takes minutes per clip), music, cloning the owner's voice, and
 * an agent working through a long job.
 */
const SLOW_STEP = /wait|video|render|taller|editor|crudo|higgsfield|generat|music|voice|clone|speak|elevenlabs|agent|task/i
/** After this long on one request, she tells the owner she is still on it. */
const SLOW_NOTICE_MS = Number(process.env.NEXY_SLOW_NOTICE_MS) || 90_000
/** How long "Aprobar todo en Notion" lasts. */
const NOTION_TRUST_MS = 60 * 60_000

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
  '/estado — qué estoy haciendo ahora\n' +
  '/cancelar — detener lo que estoy haciendo\n' +
  'Si me escribes mientras trabajo, dejo lo anterior y atiendo tu mensaje nuevo. Para ver cómo voy sin interrumpirme: /estado\n' +
  'También puedes mandarme fotos, videos, música, o un contacto de tu agenda para que lo guarde.\n' +
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
  return smoothBoss(text)
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
  'notion__API-create-a-data-source': 'Crear una tabla (base de datos) en Notion',
  'notion__API-update-a-data-source': 'Agregar columnas a una tabla de Notion',
  'notion__API-create-a-database': 'Crear una tabla (base de datos) en Notion',
  'notion__API-update-a-database': 'Agregar columnas a una tabla de Notion',
  metricool__post_Schedule_Post: 'Programar publicación',
  metricool__update_Schedule_Post: 'Cambiar una publicación programada',
  jarvis_contacts__save_contact: 'Guardar contacto (Nexy podrá llamarle)',
  jarvis_contacts__remove_contact: 'Borrar contacto',
  jarvis_brands__link_brand_account: 'Conectar una cuenta a la marca',
  jarvis_brands__unlink_brand_account: 'Desconectar una cuenta de la marca',
  'google-calendar__create-event': 'Agendar en tu calendario (con invitados, les llega invitación)',
  'google-calendar__update-event': 'Cambiar un evento (a los invitados les llega el cambio)',
  jarvis_crudo__link_raw_folder: 'Conectar carpeta de crudo (memoria) a la marca',
  jarvis_video__clone_owner_voice: 'Clonar tu voz en ElevenLabs (con tus grabaciones)',
  jarvis_rutinas__create_routine: 'Programar una rutina (Nexy la hará sola)',
  jarvis_rutinas__update_routine: 'Cambiar una rutina',
  jarvis_rutinas__remove_routine: 'Borrar una rutina',
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
  phone: 'Teléfono',
  account_id: 'Cuenta (id)',
  account_name: 'Cuenta',
  service: 'Servicio',
  country: 'País',
  markdown: 'Contenido',
  instructions: 'Qué hará',
  time: 'Hora',
  days: 'Días',
  routine: 'Rutina',
  folder: 'Carpeta',
  summary: 'Título',
  start: 'Inicio',
  end: 'Fin',
  attendees: 'Invitados',
  active: 'Activa',
  brand: 'Marca',
}
const SKIP = new Set(['parent', 'subagent_type', 'run_in_background', 'model', 'conferenceData', 'calendarId', 'timeZone', 'sendUpdates'])

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

/** Meta's ad tools in plain Spanish: "ads_create_adset" → "Meta Ads: crear conjunto de anuncios". */
function adsLabel(view) {
  if (view.server !== 'meta-ads') return null
  const t = view.tool.toLowerCase()
  const verb = /create/.test(t) ? 'crear' : /duplicate|copy/.test(t) ? 'duplicar' : /pause/.test(t) ? 'pausar' : /activate|resume/.test(t) ? 'activar' : /budget/.test(t) ? 'cambiar presupuesto de' : /update|edit|set/.test(t) ? 'cambiar' : /upload/.test(t) ? 'subir' : t.replace(/^ads_/, '').replace(/_/g, ' ')
  const what = /adset|ad_set/.test(t) ? 'conjunto de anuncios' : /campaign/.test(t) ? 'campaña' : /creative/.test(t) ? 'creativo' : /image|video|media/.test(t) ? 'imagen o video' : /audience/.test(t) ? 'público' : /\bad\b|_ad$|_ads?_/.test(t) ? 'anuncio' : ''
  const phrase = verb === 'cambiar presupuesto de' && !what ? 'cambiar presupuesto' : `${verb}${what ? ` ${what}` : ''}`
  return `Meta Ads: ${phrase}`
}

/** An approval as the owner reads it on the phone. */
export function describeApproval(view) {
  const key = `${view.server}__${view.tool}`
  const brand = readBrands().marcas.find((b) => b.id === view.brand)
  const lines = ['⏸️ ¿Apruebas?']
  if (brand) lines.push(`🏷️ Marca: ${brand.nombre}`)
  if (view.account) lines.push(`📍 Cuenta: ${view.account}`)
  if (spendsMoney(view.server, view.tool, view.input)) lines.push('💸 OJO: esto puede empezar a gastar dinero de la cuenta publicitaria.')
  else if (view.server === 'meta-ads' && /create|duplicate|copy/i.test(view.tool)) lines.push('⏸️ Se crea en PAUSA: no gasta hasta que la actives.')
  // Invoices read as invoices: what it does, then each field in Spanish.
  if (view.server === 'zoho') {
    lines.push(`🧾 ${zohoAction(view.tool)}`, '', ...zohoLines(view.input), '', 'Revisa cliente, montos y forma de pago antes de aprobar.')
    return lines.join('\n').slice(0, MAX_MESSAGE)
  }
  const mailbox = /^gmail-/.test(view.server) ? TOOL_LABEL[`gmail__${view.tool}`] : null
  lines.push(`➡️ ${TOOL_LABEL[key] ?? (mailbox ? `${mailbox} (correo de la empresa)` : null) ?? adsLabel(view) ?? `${view.server} · ${view.tool.replace(/[_-]+/g, ' ')}`}`, '')
  const input = view.input && typeof view.input === 'object' ? view.input : {}
  // A post reads as a post: when, where, and the caption exactly as it will go out.
  const post = postPreview(input)
  if (post) {
    if (post.draft) lines.push('📝 Se guarda como BORRADOR (no se publica)')
    if (post.when) lines.push(`🗓️ ${post.draft ? 'Fecha' : 'Se publica'}: ${post.when}`)
    if (post.networks.length) lines.push(`📱 Redes: ${post.networks.join(', ')}`)
    if (post.media.length) lines.push(`🖼️ ${post.media.length} ${post.media.length === 1 ? 'imagen o video (arriba)' : 'imágenes o videos (arriba)'}`)
    lines.push('', '✍️ Caption:', post.caption || '(sin caption)')
    if (post.firstComment) lines.push('', `💬 Primer comentario: ${post.firstComment}`)
    return lines.join('\n').slice(0, MAX_MESSAGE)
  }
  for (const [k, v] of Object.entries(input)) {
    if (SKIP.has(k) || v === undefined || v === null || v === '') continue
    if (k === 'properties' && typeof v === 'object') {
      for (const [pk, pv] of Object.entries(v)) lines.push(`${pk}: ${notionValue(pv)}`)
      continue
    }
    const value = typeof v === 'string' ? v : Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' ? (x.email ?? x.name ?? JSON.stringify(x)) : String(x))).join(', ') : JSON.stringify(v)
    lines.push(`${FIELD[k] ?? k}: ${value.length > 900 ? `${value.slice(0, 900)}…` : value}`)
  }
  return lines.join('\n').slice(0, MAX_MESSAGE)
}

export async function transcribe(key, bytes, name) {
  const form = new FormData()
  form.append('model_id', 'scribe_v1')
  form.append('tag_audio_events', 'false')
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

/** A tool's name as the owner would say it. */
const stepName = (name) => {
  const [, server = '', tool = name] = String(name).match(/^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/) ?? []
  if (!server && /^(Agent|Task)$/.test(name)) return 'trabajando con su equipo de agentes'
  const who = {
    higgsfield: 'Higgsfield',
    metricool: 'Metricool',
    gmail: 'Gmail',
    notion: 'Notion',
    'google-calendar': 'el calendario',
    canva: 'Canva',
    zoho: 'Zoho',
    'meta-ads': 'Meta Ads',
    jarvis_taller: 'editando el video',
    jarvis_video: 'el editor de video',
    jarvis_crudo: 'revisando tu memoria',
    jarvis_brands: 'revisando la marca',
  }[server]
  if (!who && /^gmail-/.test(server)) return 'el correo de la empresa'
  return who ?? (server ? server : tool)
}

/** Several messages as one: text joined, images kept. */
function mergeContent(list) {
  if (list.every((c) => typeof c === 'string')) return list.join('\n\n')
  return list.flatMap((c) => (typeof c === 'string' ? [{ type: 'text', text: c }] : c))
}

/** Put a note in front of a message, whatever its shape. */
const withNote = (note, content) => (typeof content === 'string' ? `${note}\n\n${content}` : [{ type: 'text', text: note }, ...content])

const SUPERSEDED =
  '[The owner wrote this while you were still on the previous request, so that work was stopped where it was. ' +
  'If this corrects or replaces it, do it the new way; do not repeat steps that already ran or anything they rejected.]'

/**
 * One running conversation with the agent, one request at a time.
 *
 * A message that arrives while she works does not wait in a queue: the owner
 * is usually correcting her ("no, el due by es el 8"), so the current work
 * stops (with any approval it was waiting on) and the new message is taken
 * up at once, with the old one still in context. Several messages sent
 * quickly become one request. Each request gets its answer from the result
 * that closes its turn.
 */
export function conversation({ agentOptions, onAnswer, onSlow = () => {}, runQuery, local, channel = 'telegram' }) {
  let current = null
  const held = []
  let deliver = null
  let closed = false

  async function* prompts() {
    while (!closed) {
      const content = await new Promise((r) => (deliver = r))
      if (closed || content == null) return
      yield { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null }
    }
  }

  const begin = (content, job) => {
    job.started = Date.now()
    current = job
    lastSign = Date.now()
    const send = () => {
      if (!deliver) return setTimeout(send, 50)
      const r = deliver
      deliver = null
      r(content)
    }
    send()
  }

  /** The held messages, as one request: the earlier ones end as part of it. */
  const next = () => {
    if (!held.length || closed) return
    // The owner's own messages go first, together; a routine runs on its own after.
    const mine = held.filter((b) => !b.job.solo)
    const batch = mine.length ? mine : [held[0]]
    for (const b of batch) held.splice(held.indexOf(b), 1)
    const job = batch.at(-1).job
    for (const b of batch.slice(0, -1)) hub.endTask(b.job.taskId, 'interrupted', 'Se juntó con el mensaje siguiente.')
    if (batch.length > 1) job.what = batch.map((b) => b.job.what).filter(Boolean).join(' · ')
    const content = mergeContent(batch.map((b) => b.content))
    begin(batch.some((b) => b.superseded) ? withNote(SUPERSEDED, content) : content, job)
  }

  // Pick up where the last conversation left off, across restarts.
  const resume = loadSession(channel)
  if (resume) console.log(`[jarvis] ${channel}: continuing the previous conversation`)
  const session = runQuery({
    prompt: prompts(),
    options: {
      ...agentOptions({ local, channelPrompt: CHANNEL_PROMPT, currentTask: () => current?.taskId ?? null }),
      ...(resume ? { resume } : {}),
    },
  })

  // The watchdog. Every message from the agent is a sign of life; a turn that
  // goes quiet for STUCK_MS, and isn't waiting on the owner, is interrupted and
  // the owner is told which step it was stuck on.
  let lastSign = Date.now()
  const watchdog = setInterval(() => {
    const job = current
    if (!job || job.stopped) return
    if (hub.waitingOnOwner(job.taskId)) {
      lastSign = Date.now()
      return
    }
    const step = hub.runningStepName(job.taskId)
    // A long job says so once, so the owner never wonders whether she stopped.
    if (!job.toldSlow && Date.now() - (job.started ?? Date.now()) > SLOW_NOTICE_MS) {
      job.toldSlow = true
      onSlow(job, step)
    }
    if (Date.now() - lastSign < (step && SLOW_STEP.test(step) ? STUCK_MS * 3 : STUCK_MS)) return
    console.log(`[jarvis] telegram: turn stuck${step ? ` on ${step}` : ''}; stopping it`)
    halt(`Me quedé atorada${step ? ` esperando a ${stepName(step)}` : ''} y lo detuve. ¿Lo intento otra vez?`)
  }, 15_000)

  /** Stop the current turn; it ends with `reason` as its answer, or silently. */
  function halt(reason, silent = false) {
    const job = current
    if (!job || job.stopped !== undefined) return false
    job.stopped = reason
    job.silent = silent
    // Pending approvals first: the SDK finishes the turn only once they settle.
    hub.cancelApprovals(job.taskId)
    Promise.resolve(session.interrupt?.()).catch(() => {})
    return true
  }

  const done = (async () => {
    try {
      for await (const msg of session) {
        lastSign = Date.now()
        if (msg.session_id && (msg.type === 'result' || (msg.type === 'system' && msg.subtype === 'init'))) {
          saveSession(channel, msg.session_id)
        }
        // Which connectors are up, for the console, as the voice session does.
        if (msg.type === 'system' && msg.subtype === 'init' && Array.isArray(msg.mcp_servers)) {
          hub.setServers(msg.mcp_servers.map((s) => ({ name: s.name, status: s.status })))
        }
        if (msg.type === 'assistant') {
          for (const block of msg.message?.content ?? []) {
            if (block.type === 'tool_use') {
              hub.startStep(current?.taskId, block.id, block.name, block.input, msg.parent_tool_use_id ?? null)
            }
          }
        } else if (msg.type === 'user' && Array.isArray(msg.message?.content)) {
          for (const block of msg.message.content) {
            if (block?.type === 'tool_result') hub.endStep(block.tool_use_id, block.is_error === true, block.content)
          }
        } else if (msg.type === 'result') {
          const job = current
          current = null
          const stopped = job?.stopped !== undefined
          const ok = msg.subtype === 'success' && !stopped
          const text = stopped ? job.stopped : ok ? String(msg.result ?? '').trim() : 'No pude terminar eso. Inténtalo otra vez, por favor.'
          if (!ok && !stopped) console.error(`[jarvis] telegram turn failed: ${msg.subtype}`)
          if (job) {
            hub.endTask(job.taskId, stopped ? 'interrupted' : ok ? 'done' : 'error', text)
            if (!job.silent) onAnswer(job, text || 'Listo.')
          }
          lastSign = Date.now()
          next()
        }
      }
    } catch (err) {
      console.error('[jarvis] telegram session error:', err?.message ?? err)
      // A conversation that cannot be picked up again is dropped, so the next
      // message starts a fresh one instead of failing the same way.
      clearSession(channel)
      for (const job of [current, ...held.splice(0).map((b) => b.job)].filter(Boolean)) {
        hub.endTask(job.taskId, 'error', '')
        onAnswer(job, 'Tuve un problema y reinicié la conversación. ¿Me lo repites?')
      }
      current = null
    } finally {
      closed = true
      clearInterval(watchdog)
    }
  })()

  return {
    get closed() {
      return closed
    },
    get busy() {
      return Boolean(current) || held.length > 0
    },
    /** What she is on right now, for a status line while the owner waits. */
    status() {
      const job = current
      if (!job) return null
      return { what: job.what ?? '', started: job.started ?? Date.now(), step: hub.runningStepName(job.taskId), waiting: held.length }
    },
    /**
     * `content` is the owner's words, or a list of image and text blocks.
     * `wait`: files, contacts and routines wait their turn instead of
     * stopping the work in progress. Returns true when it took over.
     */
    ask(content, job, { wait = false } = {}) {
      if (!current) {
        begin(content, job)
        return false
      }
      // Stopping a routine for the owner is fine; a routine never stops the owner's work.
      const takeOver = !wait && !job.solo
      held.push({ content, job, superseded: takeOver })
      if (takeOver) halt('', true)
      return takeOver
    },
    /** /cancelar: stop now, and drop anything sent meanwhile. */
    stop(reason) {
      for (const b of held.splice(0)) hub.endTask(b.job.taskId, 'interrupted', '')
      return halt(reason)
    },
    close() {
      closed = true
      deliver?.(null)
      session.close?.()
      for (const job of [current, ...held.splice(0).map((b) => b.job)].filter(Boolean)) hub.endTask(job.taskId, 'interrupted', '')
      current = null
      return done
    },
  }
}

/** "Sigo con X (4 min, ahora: editando el video)". */
function busyLine(st, queued) {
  if (!st) return 'Estoy libre. ¿Qué hacemos?'
  const mins = Math.max(1, Math.round((Date.now() - st.started) / 60_000))
  const now = st.step ? stepName(st.step) : null
  const what = st.what ? `«${String(st.what).slice(0, 80)}${String(st.what).length > 80 ? '…' : ''}»` : 'lo que me pediste'
  return (
    `⏳ Sigo trabajando en ${what} (${mins} min${now ? `, ahora: ${now}` : ''}).` +
    (queued ? ' Tu mensaje queda en fila y lo atiendo en cuanto termine.' : st.waiting ? ` Tengo ${st.waiting} mensaje${st.waiting === 1 ? '' : 's'} en fila.` : '') +
    ' Para parar lo actual: /cancelar'
  )
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

  /** The image in a message, if any: a photo, or a picture sent as a file. */
  const imageOf = (m) => {
    if (Array.isArray(m.photo) && m.photo.length) {
      const p = m.photo[m.photo.length - 1]
      return { fileId: p.file_id, size: p.file_size ?? 0, mime: 'image/jpeg' }
    }
    const d = m.document
    if (d && IMAGE_TYPES[d.mime_type]) return { fileId: d.file_id, size: d.file_size ?? 0, mime: d.mime_type }
    return null
  }

  // Photos sent together (an album) come as separate messages sharing a
  // media_group_id; they are gathered for a moment and handled as one request.
  const albums = new Map()
  const collectImage = (m, image, chatId) => {
    const key = m.media_group_id ? `g:${m.media_group_id}` : `m:${m.message_id}`
    const entry = albums.get(key) ?? { chatId, date: m.date, caption: '', images: [], timer: null }
    entry.images.push(image)
    if (m.caption) entry.caption = m.caption.trim()
    clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      albums.delete(key)
      handleImages(entry).catch((err) => console.log(`[jarvis] telegram images failed: ${err?.message ?? err}`))
    }, ALBUM_WAIT_MS)
    albums.set(key, entry)
  }

  async function handleImages({ chatId, date, caption, images }) {
    if (Date.now() - date * 1000 > STALE_MS) {
      return say(chatId, 'Me llegaron unas imágenes mientras estaba apagada. ¿Me las mandas otra vez con lo que quieres que haga?')
    }
    if (images.some((i) => i.size > MAX_IMAGE)) {
      return say(chatId, 'Una de esas imágenes es muy pesada. Mándala como foto (no como archivo) y la reviso.')
    }
    const blocks = []
    const paths = []
    mkdirSync(RECEIVED_DIR, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    for (const [i, img] of images.slice(0, MAX_IMAGES).entries()) {
      try {
        const file = await api(token, 'getFile', { file_id: img.fileId })
        const res = await fetch(`${API}/file/bot${token}/${file.file_path}`)
        if (!res.ok) throw new Error(`download ${res.status}`)
        const bytes = Buffer.from(await res.arrayBuffer())
        const path = join(RECEIVED_DIR, `${stamp}-${i + 1}.${IMAGE_TYPES[img.mime]}`)
        writeFileSync(path, bytes)
        paths.push(path)
        blocks.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data: bytes.toString('base64') } })
      } catch (err) {
        console.log(`[jarvis] telegram image download failed: ${err.message}`)
      }
    }
    if (!blocks.length) return say(chatId, 'No pude abrir esas imágenes. ¿Me las mandas otra vez?')
    const n = blocks.length
    const ask =
      (caption || (n === 1 ? 'Te mando esta imagen. ¿Qué ves?' : `Te mando estas ${n} imágenes. ¿Qué ves?`)) +
      `\n\n[${n === 1 ? 'Image' : `${n} images`} sent by the owner on Telegram, saved on this Mac at: ${paths.join(', ')}]`
    blocks.push({ type: 'text', text: ask })
    const taskId = hub.startTask(`📷 ${n === 1 ? 'Imagen' : `${n} imágenes`}${caption ? `: ${caption}` : ''}`, undefined, 'telegram')
    const voice = readTelegram()?.voice === 'siempre'
    talk().ask(blocks, { taskId, chatId, voice }, { wait: true })
    keepTyping(chatId, voice)
  }

  // Sending the owner a finished video or image, in this chat and nowhere else.
  const BOT_UPLOAD_LIMIT = 50 * 1024 * 1024
  const filesToOwner = () =>
    createSdkMcpServer({
      name: 'jarvis_telegram',
      version: '1.0.0',
      instructions: "Sends files to the owner's own Telegram chat.",
      alwaysLoad: true,
      tools: [
        tool(
          'send_file',
          'Send the owner a finished video, an image or an invoice PDF in this chat, so they can see it before it is ' +
            'published or created. Only files from the Nexy video folders, images they sent, or PDFs from invoice_pdf.',
          {
            path: z.string().describe('The file path, as edit_video or list_videos gave it.'),
            caption: z.string().optional().describe('A short line to go with it.'),
          },
          async ({ path, caption }) => {
            const owner = readTelegram()?.owner
            if (!owner) return { isError: true, content: [{ type: 'text', text: 'Telegram is not paired.' }] }
            let real
            try {
              real = realpathSync(String(path))
            } catch {
              return { isError: true, content: [{ type: 'text', text: 'That file does not exist.' }] }
            }
            const roots = [VIDEO_DIR, RECEIVED_DIR, INVOICES_DIR].map((d) => {
              try {
                return realpathSync(d) + sep
              } catch {
                return null
              }
            })
            if (!roots.some((r) => r && real.startsWith(r))) {
              return { isError: true, content: [{ type: 'text', text: 'Only finished videos, images and invoice PDFs from the Nexy folders can be sent.' }] }
            }
            const size = statSync(real).size
            if (size > BOT_UPLOAD_LIMIT) {
              return { isError: true, content: [{ type: 'text', text: `It is ${(size / 1048576).toFixed(0)} MB, over Telegram's 50 MB limit for bots. Tell the owner it is in ${DONE} on the Mac.` }] }
            }
            const ext = extname(real).toLowerCase()
            const kind = /\.(mp4|mov|m4v)$/.test(ext) ? 'video' : /\.(jpe?g|png|webp)$/.test(ext) ? 'photo' : 'document'
            const form = new FormData()
            form.append('chat_id', String(owner.id))
            form.append(kind, new Blob([readFileSync(real)]), basename(real))
            if (caption) form.append('caption', String(caption).slice(0, 1000))
            if (kind === 'video') form.append('supports_streaming', 'true')
            const method = { video: 'sendVideo', photo: 'sendPhoto', document: 'sendDocument' }[kind]
            try {
              const res = await fetch(`${API}/bot${token}/${method}`, { method: 'POST', body: form })
              const data = await res.json().catch(() => ({}))
              if (!data.ok) throw new Error(data.description ?? `HTTP ${res.status}`)
            } catch (err) {
              console.log(`[jarvis] telegram send_file failed: ${err.message}`)
              return { isError: true, content: [{ type: 'text', text: 'Telegram did not accept the file.' }] }
            }
            return { content: [{ type: 'text', text: 'Sent to the owner on Telegram.' }] }
          },
        ),
      ],
    })

  /**
   * Save a video or music file the owner sent, where the editor can use it.
   * Telegram lets bots download files up to 20 MB; bigger ones go by AirDrop.
   */
  async function receiveFile(m, chatId, file, dir, what) {
    if ((file.file_size ?? 0) > MAX_DOWNLOAD) {
      return say(chatId, `Ese ${what} pesa más de 20 MB y Telegram no me deja bajarlo. Pásalo por AirDrop a la carpeta Películas → Nexy → ${dir === MUSIC ? 'musica' : 'entrada'} de tu Mac y dime cuando esté.`)
    }
    try {
      const info = await api(token, 'getFile', { file_id: file.file_id })
      const res = await fetch(`${API}/file/bot${token}/${info.file_path}`)
      if (!res.ok) throw new Error(`download ${res.status}`)
      const original = (file.file_name ?? '').replace(/[^\w.-]+/g, '-').slice(-60)
      const ext = extname(original) || extname(info.file_path) || (dir === MUSIC ? '.mp3' : '.mp4')
      const name = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${basename(original || 'archivo', extname(original)) || 'archivo'}${ext}`
      mkdirSync(dir, { recursive: true })
      const path = join(dir, name)
      writeFileSync(path, Buffer.from(await res.arrayBuffer()))
      const caption = (m.caption ?? '').trim()
      const request =
        (caption || (dir === MUSIC ? 'Te mando esta música para los videos.' : 'Te mando este video.')) +
        `\n\n[${dir === MUSIC ? 'Music file' : 'Video'} sent by the owner on Telegram, saved at: ${path}]`
      const taskId = hub.startTask(`${dir === MUSIC ? '🎵' : '🎬'} ${caption || (dir === MUSIC ? 'Música' : 'Video')}`, undefined, 'telegram')
      talk().ask(request, { taskId, chatId, voice: readTelegram()?.voice === 'siempre' }, { wait: true })
      keepTyping(chatId, false)
    } catch (err) {
      console.log(`[jarvis] telegram file download failed: ${err.message}`)
      return say(chatId, `No pude bajar ese ${what}. ¿Me lo mandas otra vez?`)
    }
  }

  /**
   * A contact card from the owner's phone book. Sending it is the owner
   * saying "save this person"; Nexy still shows the exact number on an
   * approval card before it goes on the list she may call.
   */
  function shareContact(c, chatId) {
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Sin nombre'
    const raw = String(c.phone_number ?? '').trim()
    const phone = toE164(raw.startsWith('+') ? raw : `+${raw.replace(/\D/g, '')}`) ?? toE164(raw)
    // Ten digits with no country code: Mexico or the US, and only the owner knows which.
    if (!phone && raw.replace(/\D/g, '').length === 10) {
      const request =
        `Guarda este contacto: ${name}, ${raw}.\n\n` +
        `[The owner shared this contact card from their own phone book on Telegram: they want it saved. The number has no country code: ` +
        `ask them in one short line whether it is Mexico or the US, then call save_contact with name "${name}", phone "${raw}" and that country.]`
      const taskId = hub.startTask(`👤 Guardar contacto: ${name}`, undefined, 'telegram')
      talk().ask(request, { taskId, chatId, voice: readTelegram()?.voice === 'siempre' }, { wait: true })
      keepTyping(chatId, false)
      return
    }
    if (!phone) {
      return say(
        chatId,
        `Recibí a ${name} (${raw || 'sin número'}), pero solo puedo guardar números de México (+52) o Estados Unidos (+1) con 10 dígitos. ` +
          '¿Me dices su número con lada, por ejemplo +52 55 1234 5678?',
      )
    }
    const request =
      `Guarda este contacto: ${name}, ${phone} (${country(phone)}).\n\n` +
      `[The owner shared this contact card from their own phone book on Telegram: they want it saved. Call save_contact with name "${name}" and phone "${phone}". ` +
      'Then say in one line that it is ready and that they can ask you to call them with a message.]'
    const taskId = hub.startTask(`👤 Guardar contacto: ${name}`, undefined, 'telegram')
    talk().ask(request, { taskId, chatId, voice: readTelegram()?.voice === 'siempre' }, { wait: true })
    keepTyping(chatId, false)
  }

  let convo = null
  const talk = () => {
    if (!convo || convo.closed) {
      convo = conversation({
        agentOptions,
        onAnswer: answer,
        onSlow: (job, step) => {
          const what = /taller|video|editor/i.test(step ?? '')
            ? 'editando el video'
            : /crudo|memoria/i.test(step ?? '')
              ? 'revisando tu memoria'
              : /higgsfield/i.test(step ?? '')
                ? 'generando en Higgsfield'
                : 'en eso'
          void say(job.chatId, `⏳ Sigo trabajando, ${what}. Te aviso en cuanto termine. Si me escribes, dejo esto y atiendo lo nuevo.`)
        },
        runQuery,
        local: { jarvis_telegram: filesToOwner() },
      })
    }
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

  // Routines run here, in the same conversation, as if the owner had just
  // asked; the report comes back to this chat.
  setRoutineRunner((routine, prompt) => {
    const owner = readTelegram()?.owner
    if (!owner) throw new Error('Telegram is not paired')
    // A silent job (the sales line's routine work) shows in the console only.
    // An empty notice means "no heads-up, just the report when it is done".
    if (!routine.silent && routine.aviso !== '') void say(owner.id, routine.aviso ?? `⏰ Empiezo tu rutina «${routine.nombre}». Te aviso cuando termine.`)
    const taskId = hub.startTask(routine.aviso !== undefined || routine.silent ? routine.nombre : `⏰ Rutina: ${routine.nombre}`, routine.marca ?? undefined, 'rutina')
    talk().ask(prompt, { taskId, chatId: owner.id, voice: readTelegram()?.voice === 'siempre', solo: true, silent: routine.silent })
    if (!routine.silent) keepTyping(owner.id, false)
  })

  // The sales line's plain news (a call that went nowhere, a lead outside the
  // US) comes straight here, without a turn of Nexy's.
  setSalesNotifier((text) => {
    const owner = readTelegram()?.owner
    if (owner) void say(owner.id, text)
  })

  async function answer(job, text) {
    if (job.silent) return
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
    // Only once paired: before that there is nobody to send the card to.
    available: () => Boolean(readTelegram()?.owner),
    async requested(view) {
      const owner = readTelegram()?.owner
      if (!owner) return
      const text = describeApproval(view)
      // What will be posted, shown before the question about posting it.
      for (const url of postPreview(view.input)?.media.slice(0, 4) ?? []) {
        await api(token, isVideo(url) ? 'sendVideo' : 'sendPhoto', { chat_id: owner.id, [isVideo(url) ? 'video' : 'photo']: url }, 60_000).catch(
          (err) => console.log(`[jarvis] telegram preview failed: ${err.message}`),
        )
      }
      api(token, 'sendMessage', {
        chat_id: owner.id,
        text,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Aprobar', callback_data: `ap:${view.id}` },
              { text: '❌ Rechazar', callback_data: `rj:${view.id}` },
            ],
            // Building a table in Notion is a dozen small writes; one tap covers the hour.
            ...(view.server === 'notion' ? [[{ text: '✅ Aprobar todo en Notion por 1 hora', callback_data: `at:${view.id}` }]] : []),
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
      if (kind === 'at' && id) {
        hub.answer(id, true, '')
        hub.trust('notion', NOTION_TRUST_MS)
        await api(token, 'answerCallbackQuery', { callback_query_id: q.id, text: 'Aprobado: Notion sin preguntar por 1 hora' }).catch(() => {})
        await say(owner.id, '✅ Listo: por 1 hora no te pido aprobación para Notion (crear o editar páginas, tablas y filas). Borrar sigue bloqueado. Para volver a preguntar antes: /preguntar')
        return
      }
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
    if (text === '/preguntar') {
      hub.untrust('notion')
      return say(chatId, 'Listo: vuelvo a pedirte aprobación para todo en Notion.')
    }
    if (text === '/estado') {
      return say(chatId, convo?.busy ? busyLine(convo.status(), false) : 'Estoy libre. ¿Qué hacemos?')
    }
    if (text === '/cancelar' || text === '/parar') {
      if (!convo?.stop('Listo, lo detuve.')) return say(chatId, 'No estoy haciendo nada en este momento.')
      return
    }
    if (text === '/nuevo') {
      await convo?.close()
      convo = null
      clearSession('telegram')
      return say(chatId, 'Conversación nueva. ¿En qué te ayudo?')
    }

    const image = imageOf(m)
    if (image) return collectImage(m, image, chatId)
    if (m.contact) return shareContact(m.contact, chatId)
    const video = m.video ?? m.video_note ?? (m.document && /^video\//.test(m.document.mime_type ?? '') ? m.document : null)
    if (video) return receiveFile(m, chatId, video, INBOX, 'video')
    const song = m.audio ?? (m.document && /^audio\//.test(m.document.mime_type ?? '') ? m.document : null)
    if (song) return receiveFile(m, chatId, song, MUSIC, 'audio')

    let request = text
    const audio = m.voice
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
      return say(chatId, 'Por ahora entiendo mensajes, notas de voz, fotos, videos, música y contactos.')
    }

    // Written while this Mac was off or Nexy was closed: ask, don't act.
    if (Date.now() - m.date * 1000 > STALE_MS) {
      return say(chatId, `Me llegó esto mientras estaba apagada:\n«${request.slice(0, 500)}»\n\n¿Todavía lo quieres? Mándamelo de nuevo y lo hago.`)
    }

    const voice = cfg.voice === 'siempre' || (cfg.voice !== 'nunca' && Boolean(audio))
    // Busy: the new message takes over (see conversation), and she says so.
    const taskId = hub.startTask(request, undefined, 'telegram')
    if (talk().ask(request, { taskId, chatId, voice, what: request })) await say(chatId, '👌 Dejo lo anterior y voy con esto.')
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
