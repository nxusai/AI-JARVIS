/**
 * Telegram's Bot API, the small part every bot here uses: calls, long
 * messages, the file in a message, and uploads.
 */

const API = 'https://api.telegram.org'
const MAX_MESSAGE = 3900

/** One call, JSON in and out. Never logs the URL: it holds the token. */
export async function api(token, method, params = {}, timeoutMs = 20_000) {
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

export async function say(token, chatId, text) {
  for (const part of chunks(text)) await api(token, 'sendMessage', { chat_id: chatId, text: part })
}

/** Send a file again by its Telegram id: no download, no size limit. */
export async function sendFile(token, chatId, f, caption) {
  const method = { foto: 'sendPhoto', video: 'sendVideo', animacion: 'sendAnimation', audio: 'sendAudio', nota: 'sendVoice' }[f.tipo] ?? 'sendDocument'
  const field = { sendPhoto: 'photo', sendVideo: 'video', sendAnimation: 'animation', sendAudio: 'audio', sendVoice: 'voice', sendDocument: 'document' }[method]
  await api(token, method, { chat_id: chatId, [field]: f.file_id, ...(caption ? { caption: String(caption).slice(0, 1000) } : {}) }, 60_000)
}

/** A file to a chat, uploaded from this computer. */
export async function upload(token, chat, method, field, bytes, name, caption) {
  const form = new FormData()
  form.append('chat_id', String(chat))
  form.append(field, new Blob([bytes]), name)
  if (caption) form.append('caption', String(caption).slice(0, 1000))
  const res = await fetch(`${API}/bot${token}/${method}`, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!data.ok) throw new Error(data.description ?? `HTTP ${res.status}`)
}

/** The bytes of a file someone sent, by its Telegram id. */
export async function download(token, fileId) {
  const info = await api(token, 'getFile', { file_id: fileId })
  const res = await fetch(`${API}/file/bot${token}/${info.file_path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/** The one file in a message, if any, as { file_id, tipo, nombre, size }. */
export function fileOf(m) {
  if (m.photo?.length) {
    const p = m.photo[m.photo.length - 1]
    return { file_id: p.file_id, tipo: 'foto', nombre: `foto-${m.message_id}.jpg`, size: p.file_size ?? 0 }
  }
  if (m.video) return { file_id: m.video.file_id, tipo: 'video', nombre: m.video.file_name ?? `video-${m.message_id}.mp4`, size: m.video.file_size ?? 0 }
  if (m.animation) return { file_id: m.animation.file_id, tipo: 'animacion', nombre: m.animation.file_name ?? `gif-${m.message_id}.mp4`, size: m.animation.file_size ?? 0 }
  if (m.document) return { file_id: m.document.file_id, tipo: 'documento', nombre: m.document.file_name ?? `archivo-${m.message_id}`, size: m.document.file_size ?? 0 }
  if (m.audio) return { file_id: m.audio.file_id, tipo: 'audio', nombre: m.audio.file_name ?? `audio-${m.message_id}.mp3`, size: m.audio.file_size ?? 0 }
  return null
}

export const safeName = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'archivo'
