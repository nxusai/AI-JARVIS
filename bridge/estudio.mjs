import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { hub } from './console.mjs'
import { conversation } from './nucleo/conversacion.mjs'
import { REFS } from './nucleo/referencias.mjs'
import { findWhisper, findWhisperModel } from './reels/motor.mjs'
import {
  INTERVIEW,
  deleteProject,
  deleteStyle,
  ensureFolders,
  listProjects,
  listStyles,
  planOf,
  prepareProject,
  readProject,
  readTaste,
  reelsEvents,
  renderProject,
  renders,
  saveStyle,
  updateEdit,
  waveformOf,
} from './reels/proyectos.mjs'
import { DONE, INBOX, MUSIC, findFfmpeg, resolveSource } from './video.mjs'

/**
 * The studio console's side of the bridge: a video editor in the browser
 * (estudio.html) that Nexy drives and the owner can touch.
 *
 *   GET  /estudio/api/estado              engine, projects, styles, taste, the inbox and music
 *   GET  /estudio/api/proyecto?id=        a project and its plan (pieces, captions, style)
 *   POST /estudio/api/proyecto            { fuentes, nombre } → prepared in the background
 *   POST /estudio/api/edicion             { id, cambios, reemplazos } → the new plan
 *   POST /estudio/api/render              { id, vistaPrevia } → rendered in the background
 *   POST /estudio/api/estilo              { nombre, descripcion, ajustes, porDefecto, reemplazar }
 *   POST /estudio/api/estilo/borrar       { nombre }
 *   POST /estudio/api/proyecto/borrar     { id }
 *   GET  /estudio/api/onda?id=&fuente=    a recording's waveform
 *   POST /estudio/api/subir?nombre=       a video, as the request body, into ~/Movies/Nexy/entrada
 *                                         (&destino=referencias: into the references folder, a reel to copy)
 *   GET  /estudio/media?path=             a video or song from the Nexy folders, with byte ranges
 *
 * And a socket at ws://localhost:<port>/estudio: the owner's chat with Nexy
 * (a conversation of its own, with every tool she has), and the news the
 * editor redraws on — a project changed, a render's progress, a step she is on.
 *
 * Like the rest of the bridge it answers this Mac only, and only the pages it
 * already trusts; files are served only from the folders the video editor
 * may read (see resolveSource in video.mjs).
 */

const MAX_JSON = 2 * 1024 * 1024
const MAX_UPLOAD = 8 * 1024 * 1024 * 1024
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)$/i
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|flac)$/i
const TYPES = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.flac': 'audio/flac', '.jpg': 'image/jpeg', '.png': 'image/png' }

const sockets = new Set()
const broadcast = (msg) => {
  const raw = JSON.stringify(msg)
  for (const s of sockets) if (s.readyState === s.OPEN) s.send(raw)
}
reelsEvents.on('proyecto', (id) => broadcast({ type: 'proyecto', id }))
reelsEvents.on('render', (r) => broadcast({ type: 'render', ...r }))
reelsEvents.on('estilos', () => broadcast({ type: 'estilos' }))
reelsEvents.on('gustos', () => broadcast({ type: 'gustos' }))

const files = (dir, pattern) => {
  try {
    return readdirSync(dir)
      .filter((f) => pattern.test(f))
      .map((f) => {
        const st = statSync(join(dir, f))
        return { nombre: f, ruta: join(dir, f), mb: Number((st.size / 1048576).toFixed(1)), fecha: st.mtime.toISOString() }
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 60)
  } catch {
    return []
  }
}

/** A project for the page: everything but the measurements it never draws. */
async function projectView(bin, p) {
  const plan = await planOf(bin, p)
  return {
    proyecto: {
      id: p.id,
      nombre: p.nombre ?? p.id,
      creado: p.creado,
      fuentes: p.fuentes.map((f) => ({ fuente: f.fuente, file: f.file, duration: f.duration, width: f.width, height: f.height, audio: f.audio, engine: f.engine, words: f.words })),
      versiones: p.versiones,
    },
    plan,
    renderizando: renders()[p.id] ?? null,
  }
}

function readBody(req, limit = MAX_JSON) {
  return new Promise((resolve, reject) => {
    let size = 0
    const parts = []
    req.on('data', (d) => {
      size += d.length
      if (size > limit) {
        reject(new Error('too large'))
        req.destroy()
      } else parts.push(d)
    })
    req.on('end', () => {
      try {
        resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {})
      } catch {
        reject(new Error('not JSON'))
      }
    })
    req.on('error', reject)
  })
}

/** A file from the Nexy folders, streamed with byte ranges so the player can seek. */
async function serveMedia(req, res, cors, asked) {
  if (/^https?:/i.test(asked)) {
    res.writeHead(400, cors)
    return res.end()
  }
  let file
  try {
    file = await resolveSource(asked, null, 0)
  } catch {
    res.writeHead(403, cors)
    return res.end()
  }
  const type = TYPES[extname(file).toLowerCase()]
  if (!type || !existsSync(file)) {
    res.writeHead(404, cors)
    return res.end()
  }
  const size = statSync(file).size
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (m) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2])
    let end = m[1] && m[2] ? Number(m[2]) : size - 1
    start = Math.max(0, start)
    end = Math.min(size - 1, end)
    if (start > end) {
      res.writeHead(416, { ...cors, 'content-range': `bytes */${size}` })
      return res.end()
    }
    res.writeHead(206, { ...cors, 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' })
    return createReadStream(file, { start, end }).pipe(res)
  }
  res.writeHead(200, { ...cors, 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' })
  createReadStream(file).pipe(res)
}

let jobs = 0

/** Answers the studio's requests; false when the request is not the studio's. */
export async function handleStudioRequest(req, res, cors, elevenKey) {
  const url = new URL(req.url ?? '/', 'http://x')
  if (!url.pathname.startsWith('/estudio/')) return false
  const json = (status, data) => {
    res.writeHead(status, { ...cors, 'content-type': 'application/json' })
    res.end(JSON.stringify(data))
  }
  const route = `${req.method} ${url.pathname}`
  if (route === 'GET /estudio/media') {
    await serveMedia(req, res, cors, url.searchParams.get('path') ?? '')
    return true
  }
  ensureFolders()
  const bin = findFfmpeg()
  try {
    switch (route) {
      case 'GET /estudio/api/estado': {
        const taste = readTaste()
        json(200, {
          motor: { ffmpeg: !!bin, transcripcion: findWhisper() && findWhisperModel() ? 'whisper' : elevenKey() ? 'elevenlabs' : null },
          proyectos: listProjects(),
          estilos: listStyles(),
          gustos: { ...taste, pendientes: Object.keys(INTERVIEW).filter((k) => !taste.respuestas[k]).map((k) => ({ clave: k, pregunta: INTERVIEW[k] })) },
          entrada: files(INBOX, VIDEO_EXT),
          referencias: files(REFS, VIDEO_EXT),
          musica: files(MUSIC, AUDIO_EXT),
          listos: files(DONE, VIDEO_EXT),
          renders: renders(),
        })
        return true
      }
      case 'GET /estudio/api/proyecto': {
        const p = readProject(url.searchParams.get('id'))
        if (!p) return json(404, { error: 'No existe ese proyecto.' }), true
        json(200, await projectView(bin, p))
        return true
      }
      case 'POST /estudio/api/proyecto': {
        const { fuentes, nombre } = await readBody(req)
        if (!Array.isArray(fuentes) || !fuentes.length) return json(400, { error: 'Elige al menos un video.' }), true
        if (!bin) return json(500, { error: 'Falta FFmpeg en esta Mac.' }), true
        const job = `t${++jobs}`
        json(202, { trabajo: job })
        prepareProject(bin, elevenKey(), fuentes.map(String), nombre, (paso) => broadcast({ type: 'preparando', trabajo: job, paso }))
          .then((p) => broadcast({ type: 'preparado', trabajo: job, id: p.id }))
          .catch((err) => broadcast({ type: 'preparado', trabajo: job, error: err.message }))
        return true
      }
      case 'POST /estudio/api/edicion': {
        const { id, cambios, reemplazos, palabras } = await readBody(req)
        const p = updateEdit(id, cambios ?? {}, { replace: reemplazos ?? [], words: palabras ?? [] })
        json(200, await projectView(bin, p))
        return true
      }
      case 'POST /estudio/api/render': {
        const { id, vistaPrevia } = await readBody(req)
        if (!readProject(id)) return json(404, { error: 'No existe ese proyecto.' }), true
        json(202, { ok: true })
        renderProject(bin, id, { preview: !!vistaPrevia }).catch(() => {
          // Reported on the socket by renderProject itself.
        })
        return true
      }
      case 'POST /estudio/api/estilo': {
        const { nombre, descripcion, ajustes, porDefecto, reemplazar } = await readBody(req)
        const { style } = saveStyle({ name: nombre, description: descripcion ?? '', settings: ajustes ?? {}, makeDefault: !!porDefecto, replace: !!reemplazar })
        json(200, { estilo: style })
        return true
      }
      case 'POST /estudio/api/estilo/borrar': {
        const { nombre } = await readBody(req)
        deleteStyle(nombre)
        json(200, { ok: true })
        return true
      }
      case 'POST /estudio/api/proyecto/borrar': {
        const { id } = await readBody(req)
        json(200, { ok: deleteProject(id) })
        return true
      }
      case 'GET /estudio/api/onda': {
        const p = readProject(url.searchParams.get('id'))
        if (!p) return json(404, { error: 'No existe ese proyecto.' }), true
        json(200, { picos: await waveformOf(bin, p, Number(url.searchParams.get('fuente')) || 0), porSegundo: 25 })
        return true
      }
      case 'POST /estudio/api/subir': {
        // Into the inbox (to edit), or the references folder (a reel whose editing to copy).
        const dir = url.searchParams.get('destino') === 'referencias' ? REFS : INBOX
        const raw = String(url.searchParams.get('nombre') ?? 'video.mp4')
        const ext = VIDEO_EXT.test(raw) ? extname(raw).toLowerCase() : '.mp4'
        const base = raw.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '-').slice(0, 60) || 'video'
        mkdirSync(dir, { recursive: true })
        let name = `${base}${ext}`
        for (let n = 2; existsSync(join(dir, name)); n++) name = `${base}-${n}${ext}`
        const out = join(dir, name)
        if (Number(req.headers['content-length'] ?? 0) > MAX_UPLOAD) return json(413, { error: 'Ese video pesa demasiado.' }), true
        try {
          await pipeline(req, createWriteStream(out))
        } catch (err) {
          rmSync(out, { force: true })
          throw err
        }
        json(200, { ruta: out })
        return true
      }
      default:
        json(404, { error: 'No existe.' })
        return true
    }
  } catch (err) {
    if (!res.headersSent) json(400, { error: err.message })
    return true
  }
}

// -- the chat with Nexy -----------------------------------------------------

const CHANNEL_PROMPT = `

THIS CONVERSATION IS IN THE STUDIO CONSOLE. The owner is at their Mac in the
Reels studio, a video editor in the browser, typing to you in a chat beside the
player and the timeline. Speak Spanish unless they write in another language.
They see every project live: whatever you change with update_reel or edit_reel
redraws in front of them at once, so do not describe the edit back to them and
do not send files; say in one or two short lines what you did or ask the one
thing you need. Prefer update_reel for changes (instant, no render) and
edit_reel only when they ask to export or see the finished file. Each message
says which project they have open: work on that one unless they say otherwise,
and read_reel first, because they may have cut or changed things by hand.
Plain text, no markdown, no headings.`

/** What the console shows for a step Nexy is on. */
const STEP_NAMES = {
  reels_status: 'revisando el estudio',
  study_reference: 'estudiando la referencia',
  save_reel_style: 'guardando el estilo',
  read_reel_styles: 'leyendo los estilos',
  reel_taste: 'anotando tus gustos',
  prepare_reel: 'transcribiendo',
  read_reel: 'revisando el proyecto',
  update_reel: 'ajustando la edición',
  edit_reel: 'renderizando',
}
const stepLabel = (name) => {
  const tool = String(name).replace(/^mcp__[^_]+(?:_[^_]+)*?__/, '')
  return STEP_NAMES[tool] ?? (/^(Agent|Task)$/.test(name) ? 'consultando a su equipo' : 'trabajando')
}

const history = []
const remember = (m) => {
  history.push({ ...m, fecha: new Date().toISOString() })
  if (history.length > 120) history.shift()
  broadcast({ type: 'chat', ...history.at(-1) })
}

let studio = null
let convo = null

/** Called once by the bridge, with how it runs Nexy. */
export function startStudio({ agentOptions, runQuery }) {
  studio = { agentOptions, runQuery }
}

// Nexy's steps, told to the console as she takes them; everything else is the shared hub's.
const studioHub = Object.create(hub)
studioHub.startStep = (taskId, toolUseId, name, input, parentId) => {
  broadcast({ type: 'paso', texto: stepLabel(name) })
  return hub.startStep(taskId, toolUseId, name, input, parentId)
}

function talk() {
  if (!studio) throw new Error('studio not started')
  if (!convo || convo.closed) {
    convo = conversation({
      agentOptions: studio.agentOptions,
      runQuery: studio.runQuery,
      channel: 'estudio',
      hub: studioHub,
      channelPrompt: CHANNEL_PROMPT,
      stepName: stepLabel,
      onBegin: () => broadcast({ type: 'ocupada', ocupada: true }),
      onSlow: () => broadcast({ type: 'paso', texto: 'sigo en eso…' }),
      onAnswer: (_job, text) => {
        remember({ de: 'nexy', texto: text })
        if (!convo?.busy) broadcast({ type: 'ocupada', ocupada: false })
      },
    })
  }
  return convo
}

/** A console page that connected to /estudio. */
export function studioSocket(socket) {
  sockets.add(socket)
  socket.send(JSON.stringify({ type: 'historial', mensajes: history, ocupada: !!convo?.busy }))
  socket.on('close', () => sockets.delete(socket))
  socket.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(String(raw))
    } catch {
      return
    }
    if (msg?.type === 'chat' && typeof msg.texto === 'string' && msg.texto.trim()) {
      const text = msg.texto.trim().slice(0, 4000)
      remember({ de: 'yo', texto: text })
      const open = readProject(msg.proyecto)
      const note = open ? `[In the studio console, project ${open.id} "${open.nombre ?? ''}" is open.]` : '[In the studio console, no project is open.]'
      try {
        const taskId = hub.startTask(`🎬 ${text.slice(0, 80)}`, undefined, 'estudio')
        talk().ask(`${note}\n\n${text}`, { taskId, what: text.slice(0, 80) })
      } catch (err) {
        remember({ de: 'nexy', texto: `No pude atenderte: ${err.message}` })
      }
    } else if (msg?.type === 'parar') {
      convo?.stop('Listo, lo detuve.')
    }
  })
}
