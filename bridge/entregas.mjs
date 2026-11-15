import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { api, chunks } from './nucleo/telegram.mjs'

/**
 * Finished content for the team, by Telegram, with the owner's yes first.
 *
 * The content chat (in the cloud, without the bot's token) leaves a finished
 * video or image in the Google Drive folder "Videos listos NXUS", with a .txt
 * of the same name holding what the team needs to publish it (copy, hashtags,
 * network, time). Google Drive for desktop brings that folder to this Mac.
 *
 * While NEX is on she looks at the folder every half minute. Two ways to work,
 * chosen by the owner (scripts/entregas.mjs modo):
 *
 *   directo (the default)  each file goes straight to the team's group at 9:00
 *                          in the morning, New York time: on the day its name
 *                          starts with (2026-11-16-tema.mp4), or at the next
 *                          9:00 when the name has no date. With NEX off at 9:00
 *                          it goes as soon as she is on. The owner gets a line
 *                          saying what was sent.
 *   aprobar                each file goes to the owner's own chat first, with
 *                          two buttons, "Mandar al equipo" / "No"; only his tap
 *                          on the first sends it.
 *
 * Nothing else ever reaches the group. The group is the one where the owner
 * himself wrote /grupovideos; nobody in it is listened to.
 *
 * State lives in ~/.nexy/entregas.json:
 *   { carpeta?, modo?, grupo: { id, titulo } | null, entregas: { [id]: { nombre, texto, estado, … } } }
 * and what was sent or refused moves to "Enviados" / "No enviados" inside the
 * folder, so the folder itself shows what is still waiting.
 */

export const DELIVERIES_FILE = join(homedir(), '.nexy', 'entregas.json')
export const FOLDER_NAME = 'Videos listos NXUS'
const SENT_DIR = 'Enviados'
const REFUSED_DIR = 'No enviados'

const SCAN_MS = 30_000
/** Telegram's limit for a file a bot uploads. */
const UPLOAD_LIMIT = 50 * 1024 * 1024
/** A video with no .txt yet waits this long for it, then is offered without text. */
const TEXT_WAIT_MS = 2 * 60_000
const CAPTION_MAX = 1000
const MAX_TRIES = 3
const KEEP = 200

const VIDEO = /\.(mp4|mov|m4v)$/i
const IMAGE = /\.(jpe?g|png|webp)$/i

export function readDeliveries(file = DELIVERIES_FILE) {
  try {
    const s = JSON.parse(readFileSync(file, 'utf8'))
    return { carpeta: s.carpeta, modo: s.modo === 'aprobar' ? 'aprobar' : 'directo', grupo: s.grupo ?? null, entregas: s.entregas ?? {} }
  } catch {
    return { modo: 'directo', grupo: null, entregas: {} }
  }
}

export function writeDeliveries(state, file = DELIVERIES_FILE) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 })
}

/** Every "Videos listos NXUS" that Google Drive for desktop has on this Mac. */
export function driveFolders() {
  const cloud = join(homedir(), 'Library', 'CloudStorage')
  if (!existsSync(cloud)) return []
  return readdirSync(cloud)
    .filter((d) => d.startsWith('GoogleDrive-'))
    .flatMap((d) => ['My Drive', 'Mi unidad'].map((n) => join(cloud, d, n, FOLDER_NAME)))
    .filter((p) => existsSync(p))
}

/** The folder to watch: the one set with scripts/entregas.mjs, or the only one there is. */
export function findFolder(state = readDeliveries()) {
  if (state.carpeta) return existsSync(state.carpeta) ? state.carpeta : null
  return driveFolders()[0] ?? null
}

/** The team gets its content at this hour, on this clock. */
const SEND_HOUR = 9
const SEND_ZONE = 'America/New_York'
const clock = new Intl.DateTimeFormat('en-CA', { timeZone: SEND_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
const nyParts = (t) => {
  const p = Object.fromEntries(clock.formatToParts(new Date(t)).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }
}
const shiftDay = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)

/**
 * Whether a file's 9:00 has come: the 9:00 of the date its name starts with,
 * or, with no date in the name, the first 9:00 after it was last changed.
 */
export function isDue(name, mtimeMs, now) {
  const n = nyParts(now)
  const lastSend = n.hour >= SEND_HOUR ? n.date : shiftDay(n.date, -1)
  const named = name.match(/^(\d{4}-\d{2}-\d{2})\b/)?.[1]
  if (named) return named <= lastSend
  const m = nyParts(mtimeMs)
  return (m.hour < SEND_HOUR ? m.date : shiftDay(m.date, 1)) <= lastSend
}

const idOf = (name, size) => createHash('sha1').update(`${name}|${size}`).digest('hex').slice(0, 12)

/** The Telegram calls this needs, on one bot. */
const bot = (token) => ({
  call: (method, params, ms) => api(token, method, params, ms),
  async upload(chatId, campo, bytes, name, caption) {
    const form = new FormData()
    form.append('chat_id', String(chatId))
    form.append(campo, new Blob([bytes]), name)
    if (campo === 'video') form.append('supports_streaming', 'true')
    if (caption) form.append('caption', caption)
    const res = await fetch(`https://api.telegram.org/bot${token}/send${campo[0].toUpperCase()}${campo.slice(1)}`, { method: 'POST', body: form, signal: AbortSignal.timeout(5 * 60_000) })
    const data = await res.json().catch(() => ({}))
    if (!data.ok) throw new Error(data.description ?? `HTTP ${res.status}`)
    return data.result
  },
})

/**
 * @param {object} o
 * @param {string} [o.token] the bot's token (or pass `tg` in tests)
 * @param {() => ({ id: number, name?: string } | null | undefined)} o.owner the paired owner, read fresh
 */
export function deliveries({ token, owner, tg = bot(token), file = DELIVERIES_FILE, folder = findFolder, now = Date.now }) {
  const load = () => readDeliveries(file)
  const save = (s) => {
    // Old, settled deliveries are forgotten; what waits for an answer never is.
    const ids = Object.keys(s.entregas)
    for (const id of ids.filter((i) => s.entregas[i].estado !== 'pendiente').slice(0, Math.max(0, ids.length - KEEP))) delete s.entregas[id]
    writeDeliveries(s, file)
  }
  const patch = (id, fields) => {
    const s = load()
    if (s.entregas[id]) s.entregas[id] = { ...s.entregas[id], ...fields }
    save(s)
  }
  const say = async (chatId, text) => {
    for (const part of chunks(text)) await tg.call('sendMessage', { chat_id: chatId, text: part })
  }
  const kindOf = (name) => (VIDEO.test(name) ? 'video' : 'imagen')
  const groupHelp = (botName) =>
    'Todavía no sé cuál es el grupo del equipo. En Telegram: crea el grupo, agrégame' +
    (botName ? ` (@${botName})` : '') +
    ' y escribe ahí /grupovideos. Luego toca otra vez ✅ Mandar al equipo.'

  /** Seen once: { first }. Seen twice with the same size: ready to offer. */
  const seen = new Map()
  const tries = new Map()
  const sending = new Set()
  let scanning = false

  /** Out of the way once settled; never fatal (the state file is what counts). */
  function putAway(dir, name, sub) {
    try {
      mkdirSync(join(dir, sub), { recursive: true })
      for (const n of [name, `${basename(name, extname(name))}.txt`]) {
        if (!existsSync(join(dir, n))) continue
        const dest = join(dir, sub, n)
        renameSync(join(dir, n), existsSync(dest) ? join(dir, sub, `${new Date(now()).toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${n}`) : dest)
      }
    } catch (err) {
      console.log(`[jarvis] entregas: could not move ${name} to ${sub}: ${err.message}`)
    }
  }

  const textOf = (dir, name) => {
    try {
      return readFileSync(join(dir, `${basename(name, extname(name))}.txt`), 'utf8').trim()
    } catch {
      return ''
    }
  }
  const failed = async (id, name, o, err, record) => {
    const n = (tries.get(id) ?? 0) + 1
    tries.set(id, n)
    console.log(`[jarvis] entregas: could not send ${name} (try ${n}): ${err.message}`)
    if (n < MAX_TRIES) return
    record({ estado: 'error' })
    await say(o.id, `⚠️ No pude mandar «${name}» (${err.message}). Sigue en la carpeta ${FOLDER_NAME} de Drive.`).catch(() => {})
  }
  let askedForGroup = false

  /** Direct mode: straight to the team's group, and a line to the owner. */
  async function sendNow(dir, name, size, id, o, grupo) {
    const texto = textOf(dir, name)
    const record = (fields) => {
      const s = load()
      s.entregas[id] = { nombre: name, texto, visto: new Date(now()).toISOString(), ...fields }
      save(s)
    }
    if (size > UPLOAD_LIMIT) {
      record({ estado: 'pesado' })
      return say(o.id, `📦 «${name}» pesa ${(size / 1048576).toFixed(0)} MB y Telegram solo me deja mandar hasta 50 MB. No se mandó al equipo; sigue en la carpeta ${FOLDER_NAME} de Drive.`)
    }
    if (!grupo) {
      if (!askedForGroup) {
        askedForGroup = true
        const me = await tg.call('getMe').catch(() => null)
        await say(o.id, `Ya hay contenido listo para el equipo («${name}»), pero todavía no sé cuál es el grupo. Agrégame${me?.username ? ` (@${me.username})` : ''} al grupo de tu equipo y escribe ahí /grupovideos. En cuanto lo hagas, lo mando.`).catch(() => {})
      }
      return
    }
    try {
      const asCaption = texto && texto.length <= CAPTION_MAX
      await tg.upload(grupo.id, VIDEO.test(name) ? 'video' : 'photo', await readFile(join(dir, name)), name, asCaption ? texto : undefined)
      // From here it is with the team: a failure below must never send it twice.
      record({ estado: 'enviado', resuelto: new Date(now()).toISOString(), grupo: grupo.titulo })
      if (texto && !asCaption) await say(grupo.id, texto).catch((err) => console.log(`[jarvis] entregas: the text of ${name} did not go: ${err.message}`))
      putAway(dir, name, SENT_DIR)
      console.log(`[jarvis] entregas: sent ${name} to the team`)
      await say(o.id, `📤 Mandado al grupo «${grupo.titulo}»: ${name}`).catch(() => {})
    } catch (err) {
      await failed(id, name, o, err, record)
    }
  }

  async function offer(dir, name, size, id, o) {
    const texto = textOf(dir, name)
    const base = { nombre: name, texto, visto: new Date(now()).toISOString() }
    const record = (fields) => {
      const s = load()
      s.entregas[id] = { ...base, ...fields }
      save(s)
    }
    if (size > UPLOAD_LIMIT) {
      record({ estado: 'pesado' })
      return say(o.id, `📦 «${name}» pesa ${(size / 1048576).toFixed(0)} MB y Telegram solo me deja mandar hasta 50 MB. Sigue en la carpeta ${FOLDER_NAME} de Drive; pide una versión más ligera y la mando.`)
    }
    let campo = VIDEO.test(name) ? 'video' : 'photo'
    try {
      const bytes = await readFile(join(dir, name))
      const m = await tg.upload(o.id, campo, bytes, name)
      const fileId = m.video?.file_id ?? m.photo?.at(-1)?.file_id ?? m.document?.file_id ?? m.animation?.file_id
      if (!fileId) throw new Error('Telegram returned no file id')
      if (!m.video && !m.photo) campo = m.animation ? 'animation' : 'document'
      const grupo = load().grupo
      const card = await tg.call('sendMessage', {
        chat_id: o.id,
        text:
          `${kindOf(name) === 'video' ? '🎬 Video listo' : '🖼️ Imagen lista'}: ${name}\n\n` +
          (texto ? `Texto para el equipo:\n${texto.slice(0, 3200)}${texto.length > 3200 ? '…' : ''}` : '(Sin texto para publicar: se mandaría solo el archivo.)') +
          `\n\n¿Lo mando ${grupo ? `al grupo «${grupo.titulo}»` : 'al equipo'}?`,
        reply_markup: { inline_keyboard: [[{ text: '✅ Mandar al equipo', callback_data: `ev:${id}` }, { text: '❌ No', callback_data: `en:${id}` }]] },
      })
      record({ estado: 'pendiente', campo, fileId, tarjeta: card.message_id })
      console.log(`[jarvis] entregas: offered ${name} to the owner`)
    } catch (err) {
      await failed(id, name, o, err, record)
    }
  }

  /** One look at the folder. Offers the owner whatever is new and complete. */
  async function scan() {
    const o = owner()
    if (!o || scanning) return
    scanning = true
    try {
      const state = load()
      const dir = folder(state)
      if (!dir) return
      const here = new Set()
      for (const name of readdirSync(dir).sort()) {
        if (name.startsWith('.') || !(VIDEO.test(name) || IMAGE.test(name))) continue
        let st
        try {
          st = statSync(join(dir, name))
        } catch {
          continue
        }
        if (!st.isFile() || !st.size) continue
        const id = idOf(name, st.size)
        here.add(id)
        if (state.entregas[id]) continue
        const s = seen.get(id)
        if (!s) {
          seen.set(id, { first: now() })
          continue
        }
        const hasText = existsSync(join(dir, `${basename(name, extname(name))}.txt`))
        if (!hasText && now() - s.first < TEXT_WAIT_MS) continue
        if (state.modo === 'aprobar') await offer(dir, name, st.size, id, o)
        else if (isDue(name, st.mtimeMs, now())) await sendNow(dir, name, st.size, id, o, load().grupo)
      }
      for (const id of seen.keys()) if (!here.has(id)) seen.delete(id)
    } catch (err) {
      console.log(`[jarvis] entregas: scan failed: ${err.message}`)
    } finally {
      scanning = false
    }
  }

  const closeCard = (o, e, verdict) =>
    tg
      .call('editMessageText', { chat_id: o.id, message_id: e.tarjeta, text: `${kindOf(e.nombre) === 'video' ? '🎬' : '🖼️'} ${e.nombre}\n\n${verdict}` })
      .catch(() => {})

  /** The owner's tap on a card. Returns the short line shown on the button. */
  async function decide(id, yes) {
    const o = owner()
    const state = load()
    const e = state.entregas[id]
    if (!o || !e || e.estado !== 'pendiente' || sending.has(id)) return 'Eso ya estaba resuelto'
    const dir = folder(state)
    if (!yes) {
      patch(id, { estado: 'descartado', resuelto: new Date(now()).toISOString() })
      if (dir) putAway(dir, e.nombre, REFUSED_DIR)
      await closeCard(o, e, '❌ No se mandó al equipo.')
      return 'No se mandó'
    }
    if (!state.grupo) {
      const me = await tg.call('getMe').catch(() => null)
      await say(o.id, groupHelp(me?.username)).catch(() => {})
      return 'Falta el grupo del equipo'
    }
    sending.add(id)
    try {
      const asCaption = e.texto && e.texto.length <= CAPTION_MAX
      const method = `send${e.campo[0].toUpperCase()}${e.campo.slice(1)}`
      await tg.call(method, { chat_id: state.grupo.id, [e.campo]: e.fileId, ...(asCaption ? { caption: e.texto } : {}) }, 60_000)
      if (e.texto && !asCaption) await say(state.grupo.id, e.texto)
      patch(id, { estado: 'enviado', resuelto: new Date(now()).toISOString(), grupo: state.grupo.titulo })
      if (dir) putAway(dir, e.nombre, SENT_DIR)
      await closeCard(o, e, `✅ Mandado al grupo «${state.grupo.titulo}».`)
      console.log(`[jarvis] entregas: sent ${e.nombre} to the team`)
      return 'Mandado al equipo'
    } catch (err) {
      console.log(`[jarvis] entregas: could not send ${e.nombre} to the team: ${err.message}`)
      await say(o.id, `⚠️ No pude mandar «${e.nombre}» al grupo «${state.grupo.titulo}» (${err.message}). Revisa que yo siga en el grupo y toca otra vez ✅ Mandar al equipo.`).catch(() => {})
      return 'No se pudo mandar'
    } finally {
      sending.delete(id)
    }
  }

  /**
   * A message in a group. Only two things matter: the owner naming the group
   * (/grupovideos, or "este es el grupo de videos"), and Telegram moving the
   * group to a new id. Everyone else, and everything else, is ignored.
   */
  async function fromGroup(m) {
    const state = load()
    if (m.migrate_to_chat_id && state.grupo?.id === m.chat.id) {
      save({ ...state, grupo: { ...state.grupo, id: m.migrate_to_chat_id } })
      return
    }
    const o = owner()
    if (!o || m.from?.id !== o.id) return
    const text = typeof m.text === 'string' ? m.text.trim() : ''
    if (!/^\/grupo_?videos(@\w+)?$/i.test(text) && !/este es el grupo de (los )?videos/i.test(text)) return
    const grupo = { id: m.chat.id, titulo: m.chat.title ?? 'Equipo' }
    save({ ...state, grupo })
    console.log('[jarvis] entregas: the team group was set')
    await say(m.chat.id, `Listo. En este grupo voy a mandar los videos e imágenes listos para publicar, con su texto. Solo recibo instrucciones de ${o.name || 'mi dueño'}.`)
    const waiting = Object.values(state.entregas).filter((e) => e.estado === 'pendiente').length
    askedForGroup = false
    await say(
      o.id,
      state.modo === 'aprobar'
        ? `✅ Grupo del equipo: «${grupo.titulo}». Nada llega ahí sin tu ✅.${waiting ? ` Tienes ${waiting} por aprobar más arriba en este chat.` : ''}`
        : `✅ Grupo del equipo: «${grupo.titulo}». Ahí mando el video y la imagen de cada día a las 9:00 am (hora de Nueva York), sin preguntarte; te aviso aquí cada vez.`,
    )
  }

  /** For /entregas in the owner's chat. */
  function status() {
    const state = load()
    const dir = folder(state)
    const all = Object.values(state.entregas)
    const waiting = all.filter((e) => e.estado === 'pendiente')
    const sent = all.filter((e) => e.estado === 'enviado').length
    const queued = () => {
      try {
        return readdirSync(dir).filter((n) => !n.startsWith('.') && (VIDEO.test(n) || IMAGE.test(n)) && !state.entregas[idOf(n, statSync(join(dir, n)).size)])
      } catch {
        return []
      }
    }
    if (state.modo !== 'aprobar') {
      const q = dir ? queued() : []
      return [
        dir ? `📁 Carpeta: ${FOLDER_NAME} (la veo en esta Mac)` : `📁 No encuentro la carpeta ${FOLDER_NAME}. Abre la app Google Drive en la Mac y revisa: node scripts/entregas.mjs estado`,
        state.grupo ? `👥 Grupo del equipo: «${state.grupo.titulo}»` : '👥 Falta el grupo: agrégame al grupo del equipo y escribe ahí /grupovideos',
        '🕘 Se manda directo al equipo a las 9:00 am, hora de Nueva York',
        q.length ? `⏳ En espera de su hora: ${q.join(', ')}` : '⏳ Nada en espera',
        `✅ Mandados al equipo: ${sent}`,
      ].join('\n')
    }
    return [
      dir ? `📁 Carpeta: ${FOLDER_NAME} (la veo en esta Mac)` : `📁 No encuentro la carpeta ${FOLDER_NAME}. Abre la app Google Drive en la Mac y revisa: node scripts/entregas.mjs estado`,
      state.grupo ? `👥 Grupo del equipo: «${state.grupo.titulo}»` : '👥 Falta el grupo: agrégame al grupo del equipo y escribe ahí /grupovideos',
      waiting.length ? `⏸️ Esperan tu ✅: ${waiting.map((e) => e.nombre).join(', ')}` : '⏸️ Nada esperando tu aprobación',
      `✅ Mandados al equipo: ${sent}`,
    ].join('\n')
  }

  let timer = null
  return {
    scan,
    decide,
    fromGroup,
    status,
    start() {
      if (timer) return
      void scan()
      timer = setInterval(() => void scan(), SCAN_MS)
      timer.unref?.()
    },
    stop() {
      clearInterval(timer)
      timer = null
    },
  }
}
