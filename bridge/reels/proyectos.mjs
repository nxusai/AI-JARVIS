import { EventEmitter } from 'node:events'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DONE, VIDEO_DIR, resolveSource, transcribeWords } from '../video.mjs'
import {
  DEFAULT_STYLE,
  FORMATS,
  REELS_DATA,
  assignZooms,
  buildAss,
  detectSilences,
  ffmpeg,
  mergeStyle,
  phrases,
  planCuts,
  probe,
  remapWords,
  renderArgs,
  settle,
  timeline,
  transcribe,
  waveform,
} from './motor.mjs'

/**
 * The Reels studio's state, shared by everyone who edits: Nexy through her
 * tools (reels.mjs) and the owner in the studio console (estudio.mjs).
 *
 * A project is the owner's recordings plus one edit — what is cut, what is
 * kept, the style and its tweaks, the hook title, the text on screen, the
 * zooms by hand, the music — and the versions rendered from it. Nexy and the
 * console change the same edit, and every change is announced on
 * `reelsEvents`, so the console redraws the moment Nexy touches it and Nexy
 * reads what the owner did by hand.
 *
 *   ~/.nexy/reels/proyectos/<id>.json   the project (transcript, silences, edit, versions)
 *   ~/.nexy/reels/estilos/<name>.json   styles
 *   ~/.nexy/reels/gustos.json           the owner's taste
 *   ~/Movies/Nexy/reels/<id>/           downloaded sources, captions, waveforms
 *   ~/Movies/Nexy/listos/               rendered reels
 */

export const STYLES = join(REELS_DATA, 'estilos')
export const PROJECTS = join(REELS_DATA, 'proyectos')
const TASTE_FILE = join(REELS_DATA, 'gustos.json')
export const PROJECT_MEDIA = join(VIDEO_DIR, 'reels')
const MAX_SOURCES = 12
const MAX_SECONDS = 15 * 60

/** 'proyecto' (id), 'render' ({ id, estado, progreso, salida, error }), 'estilos', 'gustos'. */
export const reelsEvents = new EventEmitter()
reelsEvents.setMaxListeners(50)

/** A name as a file name: lowercase words and dashes. */
export const slug = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}
/** Written whole or not at all, so a reader never sees half a file. */
const writeJson = (file, data) => {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2))
  renameSync(`${file}.tmp`, file)
}

export function ensureFolders() {
  for (const d of [STYLES, PROJECTS, PROJECT_MEDIA, DONE]) {
    try {
      mkdirSync(d, { recursive: true })
    } catch {
      // Reported when used.
    }
  }
}

// -- the owner's taste ------------------------------------------------------

/** The interview: what the studio asks once, a question or two at a time. */
export const INTERVIEW = {
  tema: '¿De qué trata tu contenido y a quién le hablas?',
  tono: '¿Qué tono quieres que se sienta: energético, calmado, educativo, divertido, elegante…?',
  ritmo: '¿Cortes muy rápidos, sin respirar (estilo Hormozi), o un ritmo más relajado?',
  subtitulos: '¿Cómo te gustan los subtítulos: palabra por palabra con la palabra resaltada, frases que aparecen, o simples? ¿En mayúsculas?',
  marca: '¿Cuáles son los colores de tu marca (si los tienes en hex, mejor) y alguna tipografía?',
  zooms: '¿Zooms en los cortes: muchos, pocos o ninguno?',
  musica: '¿Música de fondo? ¿De qué estilo?',
  gancho: '¿Quieres un título gancho escrito arriba en los primeros segundos?',
  duracion: '¿Cuánto quieres que duren tus reels normalmente?',
  odia: '¿Qué odias ver en un reel?',
  referentes: '¿Qué creadores tienen una edición que te encanta? (si me mandas un video suyo, lo estudio)',
}

export const readTaste = () => ({ respuestas: {}, leGusta: [], noLeGusta: [], comentarios: [], estiloPorDefecto: null, ...readJson(TASTE_FILE, {}) })

/** Add to the owner's taste; returns it. */
export function updateTaste({ answers, likes, dislikes, feedback, project, defaultStyle } = {}) {
  const t = readTaste()
  if (answers) Object.assign(t.respuestas, Object.fromEntries(Object.entries(answers).map(([k, v]) => [slug(k).replace(/-/g, '_') || k, String(v).slice(0, 600)])))
  if (likes?.length) t.leGusta = [...new Set([...t.leGusta, ...likes.map((s) => String(s).slice(0, 200))])].slice(-60)
  if (dislikes?.length) t.noLeGusta = [...new Set([...t.noLeGusta, ...dislikes.map((s) => String(s).slice(0, 200))])].slice(-60)
  if (feedback) t.comentarios = [...t.comentarios, { fecha: new Date().toISOString(), proyecto: project ?? null, texto: String(feedback).slice(0, 800) }].slice(-200)
  if (defaultStyle !== undefined) t.estiloPorDefecto = defaultStyle
  writeJson(TASTE_FILE, t)
  reelsEvents.emit('gustos')
  return t
}

export function tasteText(t = readTaste()) {
  const answered = Object.entries(t.respuestas).map(([k, v]) => `- ${k}: ${v}`)
  const pending = Object.keys(INTERVIEW).filter((k) => !t.respuestas[k])
  return [
    answered.length ? `What the owner said:\n${answered.join('\n')}` : 'The interview has not started.',
    t.leGusta.length ? `Likes: ${t.leGusta.join('; ')}` : '',
    t.noLeGusta.length ? `Dislikes: ${t.noLeGusta.join('; ')}` : '',
    t.comentarios.length ? `Latest feedback:\n${t.comentarios.slice(-8).map((c) => `- ${c.fecha.slice(0, 10)}${c.proyecto ? ` (${c.proyecto})` : ''}: ${c.texto}`).join('\n')}` : '',
    `Default style: ${t.estiloPorDefecto ?? 'none yet'}`,
    pending.length ? `Interview questions still to ask (one or two at a time, in your own words):\n${pending.map((k) => `- ${k}: ${INTERVIEW[k]}`).join('\n')}` : 'Interview complete.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

// -- styles -----------------------------------------------------------------

const styleFile = (name) => join(STYLES, `${slug(name)}.json`)

export function listStyles() {
  try {
    return readdirSync(STYLES)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJson(join(STYLES, f), null))
      .filter(Boolean)
  } catch {
    return []
  }
}

/** A saved style by name, or null. */
export const readStyle = (name) => (name && slug(name) ? readJson(styleFile(name), null) : null)

/** Only what differs from the base, so later changes to the base still reach the style. */
const diff = (base, s) =>
  Object.fromEntries(
    Object.entries(s)
      .map(([k, v]) => [k, v && typeof v === 'object' ? diff(base[k], v) : v === base[k] ? undefined : v])
      .filter(([, v]) => v !== undefined && !(v && typeof v === 'object' && !Object.keys(v).length)),
  )

/** Save or update a style with settings laid onto what it had; returns it. */
export function saveStyle({ name, description = '', settings = {}, references = [], makeDefault = false, replace = false }) {
  if (!slug(name)) throw new Error('Give the style a name.')
  const before = readStyle(name)
  const full = settle(mergeStyle(mergeStyle(DEFAULT_STYLE, replace ? {} : before?.ajustes), settings))
  const style = {
    nombre: before?.nombre ?? String(name).trim(),
    descripcion: description || before?.descripcion || '',
    ajustes: diff(DEFAULT_STYLE, full),
    referencias: [...new Set([...(before?.referencias ?? []), ...references])],
    creado: before?.creado ?? new Date().toISOString(),
    actualizado: new Date().toISOString(),
  }
  writeJson(styleFile(name), style)
  if (makeDefault) updateTaste({ defaultStyle: style.nombre })
  reelsEvents.emit('estilos')
  return { style, updated: !!before }
}

export function deleteStyle(name) {
  rmSync(styleFile(name), { force: true })
  reelsEvents.emit('estilos')
}

/** The style an edit runs with: the named one (or the default), with the edit's tweaks on top. */
export function resolveStyle(name, tweaks) {
  const saved = readStyle(name) ?? readStyle(readTaste().estiloPorDefecto)
  return { style: settle(mergeStyle(mergeStyle(DEFAULT_STYLE, saved?.ajustes), tweaks)), name: saved?.nombre ?? 'base' }
}

// -- projects ---------------------------------------------------------------

const projectFile = (id) => join(PROJECTS, `${slug(id)}.json`)
export const readProject = (id) => (id && slug(id) ? readJson(projectFile(id), null) : null)

export function saveProject(p) {
  p.actualizado = new Date().toISOString()
  writeJson(projectFile(p.id), p)
  reelsEvents.emit('proyecto', p.id)
  return p
}

/** Every project, newest first, in a line each. */
export function listProjects() {
  let files = []
  try {
    files = readdirSync(PROJECTS).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  return files
    .map((f) => readJson(join(PROJECTS, f), null))
    .filter(Boolean)
    .map((p) => ({
      id: p.id,
      nombre: p.nombre ?? p.id,
      creado: p.creado,
      actualizado: p.actualizado ?? p.creado,
      duracion: Math.round(p.fuentes.reduce((s, f) => s + f.duration, 0)),
      fuentes: p.fuentes.length,
      versiones: p.versiones.length,
      ultima: p.versiones.at(-1)?.salida ?? null,
      portada: p.fuentes[0]?.file ?? null,
    }))
    .sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)))
}

export function deleteProject(id) {
  const p = readProject(id)
  if (!p) return false
  rmSync(projectFile(p.id), { force: true })
  rmSync(join(PROJECT_MEDIA, p.id), { recursive: true, force: true })
  reelsEvents.emit('proyecto', p.id)
  return true
}

const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`

/** The transcript as lines the model can point at: "[f1 0:03.2–0:05.9] text". */
export function transcriptLines(sources) {
  const out = []
  sources.forEach((s, k) => {
    let cur = []
    const flush = () => {
      if (cur.length) out.push(`[f${k + 1} ${clock(cur[0].start)}–${clock(cur[cur.length - 1].end)}] ${cur.map((w) => w.text).join(' ')}`)
      cur = []
    }
    for (const w of s.words) {
      if (cur.length && (w.start - cur[cur.length - 1].end > 0.7 || cur.length >= 18)) flush()
      cur.push(w)
      if (/[.!?…]$/.test(w.text)) flush()
    }
    flush()
    if (!s.words.length) out.push(`[f${k + 1}] (no words: ${s.engine ? 'nothing was said' : 'no transcription engine on this Mac'})`)
  })
  return out
}

/** Silences of a source at a threshold, measured once and kept in the project. */
async function silencesAt(bin, src, db) {
  src.silencios ??= {}
  const key = String(db)
  src.silencios[key] ??= await detectSilences(bin, src.file, db, 0.15)
  return src.silencios[key].map((r) => ({ start: r.start, end: r.end ?? Infinity }))
}

/**
 * A new project: the sources found, probed, transcribed and their silences
 * measured. `onStep(text)` hears how it is going, for the console.
 */
export async function prepareProject(bin, elevenKey, sources, name, onStep = () => {}) {
  const id = `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${slug(name) || 'reel'}`
  const media = join(PROJECT_MEDIA, id)
  mkdirSync(media, { recursive: true })
  const list = []
  try {
    for (const [i, s] of sources.slice(0, MAX_SOURCES).entries()) {
      onStep(`Revisando la grabación ${i + 1} de ${Math.min(sources.length, MAX_SOURCES)}`)
      const file = await resolveSource(s, media, i)
      const info = await probe(bin, file)
      if (!info.video) throw new Error(`${s} is not a video`)
      if (info.duration > MAX_SECONDS) throw new Error(`${s} is over ${MAX_SECONDS / 60} minutes; cut it in parts first`)
      onStep(`Transcribiendo la grabación ${i + 1}`)
      const heard = info.audio ? await transcribe(bin, file, { elevenKey, elevenTranscribe: transcribeWords }) : { words: [], engine: null }
      list.push({ fuente: s, file, ...info, words: heard.words, engine: heard.engine })
    }
  } catch (err) {
    rmSync(media, { recursive: true, force: true })
    throw err
  }
  onStep('Midiendo las pausas')
  const project = { id, nombre: String(name || 'Reel').slice(0, 80), creado: new Date().toISOString(), fuentes: list, edicion: blankEdit(), versiones: [] }
  for (const src of project.fuentes) if (src.audio) await silencesAt(bin, src, DEFAULT_STYLE.cortes.silencioDb)
  return saveProject(project)
}

// -- the edit ---------------------------------------------------------------

const blankEdit = () => ({ estilo: null, ajustes: null, quitar: [], solo: [], forzar: [], titulo: '', musica: null, textos: [], zooms: [] })

const range = (r) => ({ fuente: Math.max(1, Math.round(Number(r.fuente) || 1)), inicio: Math.max(0, Number(r.inicio) || 0), fin: Math.max(0, Number(r.fin) || 0) })
const okRange = (r) => r.fin > r.inicio

/** The project's edit, whatever version of the studio wrote it. */
export function editOf(p) {
  // Projects from before the console kept their edit in the last version only.
  const e = { ...blankEdit(), ...(p.edicion ?? (() => {
    const v = p.versiones.at(-1)
    return v ? { estilo: v.estilo === 'base' ? null : v.estilo, ajustes: v.ajustes, quitar: v.quitar, solo: v.solo, titulo: v.titulo, musica: v.musica } : {}
  })()) }
  e.quitar = (e.quitar ?? []).map(range).filter(okRange)
  e.solo = (e.solo ?? []).map(range).filter(okRange)
  e.forzar = (e.forzar ?? []).map(range).filter(okRange)
  e.textos = (e.textos ?? []).filter((t) => t && String(t.texto ?? '').trim())
  e.zooms = (e.zooms ?? []).filter((z) => z && Number.isFinite(Number(z.t)))
  return e
}

/**
 * Change the edit: every key given replaces the one there. `words` fixes the
 * transcript ({ fuente, indice, texto }), `replace` swaps a misheard word
 * everywhere ({ de, a }).
 */
export function updateEdit(id, patch = {}, { words = [], replace = [] } = {}) {
  const p = readProject(id)
  if (!p) throw new Error(`No project ${id}.`)
  const e = editOf(p)
  for (const k of Object.keys(blankEdit())) if (k in patch && patch[k] !== undefined) e[k] = patch[k]
  if (typeof patch.nombre === 'string' && patch.nombre.trim()) p.nombre = patch.nombre.trim().slice(0, 80)
  for (const w of words) {
    const src = p.fuentes[(Number(w.fuente) || 1) - 1]
    const word = src?.words?.[Number(w.indice)]
    if (word && String(w.texto ?? '').trim()) word.text = String(w.texto).trim().slice(0, 60)
  }
  for (const r of replace) {
    const from = String(r.de ?? '').trim().toLowerCase()
    if (!from) continue
    for (const src of p.fuentes) for (const w of src.words) if (w.text.toLowerCase().replace(/[.,!?¿¡…:;]/g, '') === from) w.text = w.text.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), String(r.a ?? ''))
  }
  p.edicion = e
  p.edicion = editOf(p)
  return saveProject(p)
}

const byRecording = (ranges, k) => ranges.filter((r) => r.fuente - 1 === k).map((r) => ({ start: r.inicio, end: r.fin }))

/**
 * What the edit makes of the recordings, without rendering: the style, every
 * piece on the reel's clock (with its zoom), the captioned words and phrases,
 * and how long it runs. The console draws its live preview from this, and the
 * render uses the very same plan, so what the owner sees is what comes out.
 */
export async function planOf(bin, p) {
  const e = editOf(p)
  const { style, name } = resolveStyle(e.estilo, e.ajustes)
  const plans = []
  for (const [k, src] of p.fuentes.entries()) {
    const silences = src.audio ? await silencesAt(bin, src, style.cortes.silencioDb) : []
    const only = byRecording(e.solo, k)
    plans.push(planCuts({ duration: src.duration, silences, words: src.words, cuts: style.cortes, drop: byRecording(e.quitar, k), only: only.length ? only : null, force: byRecording(e.forzar, k) }))
  }
  const pieces = assignZooms(timeline(plans), style.zoom, e.zooms.map((z) => ({ fuente: (Number(z.fuente) || 1) - 1, t: Number(z.t), escala: Number(z.escala) })))
  const words = remapWords(p.fuentes.map((f) => f.words), pieces)
  const last = pieces.at(-1)
  const length = last ? last.at + last.end - last.start : 0
  return {
    edit: e,
    style,
    styleName: name,
    size: FORMATS[style.formato],
    pieces,
    words,
    phrases: phrases(words, style.subtitulos.palabras).map((g) => ({ start: g[0].start, end: g.at(-1).end + 0.1, words: g })),
    length,
    total: p.fuentes.reduce((s, f) => s + f.duration, 0),
  }
}

const rendering = new Map()
/** Projects being rendered right now, with how far along. */
export const renders = () => Object.fromEntries(rendering)

/** Render the project's edit to ~/Movies/Nexy/listos as a new version. */
export async function renderProject(bin, id, { preview = false } = {}) {
  const p = readProject(id)
  if (!p) throw new Error(`No project ${id}.`)
  if (rendering.has(p.id)) throw new Error('That reel is already rendering; wait for it to finish.')
  for (const src of p.fuentes) if (!existsSync(src.file)) throw new Error(`The recording ${src.fuente} is no longer at ${src.file}.`)
  const plan = await planOf(bin, p)
  if (!plan.pieces.length) throw new Error('Nothing is left after the cuts: check what was removed, or raise cortes.pausaMax.')
  const { style, pieces, words, edit } = plan
  const media = join(PROJECT_MEDIA, p.id)
  mkdirSync(media, { recursive: true })
  let musicFile = null
  if (edit.musica) musicFile = await resolveSource(edit.musica, media, 'musica')
  const hook = edit.titulo ?? ''
  const hasCaptions = (style.subtitulos.activo && words.length > 0) || (style.titulo.activo && !!hook) || edit.textos.length > 0
  const n = p.versiones.length + 1
  const out = join(DONE, `${p.id}-v${n}${preview ? '-vista' : ''}.mp4`)
  const { args, length, size } = renderArgs({ sources: p.fuentes, pieces, style, music: musicFile, subs: hasCaptions ? 'subs.ass' : null, out, preview })
  if (hasCaptions) writeFileSync(join(media, 'subs.ass'), buildAss(words, style, size, { title: hook, length, texts: edit.textos }))

  const started = Date.now()
  const tell = (o) => reelsEvents.emit('render', { id: p.id, ...o })
  rendering.set(p.id, 0)
  tell({ estado: 'renderizando', progreso: 0, vistaPrevia: preview })
  try {
    await ffmpeg(bin, args, {
      cwd: media,
      onTime: (t) => {
        const pct = Math.min(99, Math.round((t / length) * 100))
        if (pct !== rendering.get(p.id)) {
          rendering.set(p.id, pct)
          tell({ estado: 'renderizando', progreso: pct, vistaPrevia: preview })
        }
      },
    })
  } catch (err) {
    tell({ estado: 'error', error: err.message })
    throw err
  } finally {
    rendering.delete(p.id)
  }
  const fresh = readProject(p.id) ?? p
  fresh.versiones.push({ fecha: new Date().toISOString(), salida: out, estilo: plan.styleName, ajustes: edit.ajustes, titulo: hook, vistaPrevia: !!preview, duracion: Number(length.toFixed(2)) })
  saveProject(fresh)
  const secs = Math.round((Date.now() - started) / 1000)
  tell({ estado: 'listo', progreso: 100, salida: out, vistaPrevia: preview })
  return { out, secs, plan, version: n, mb: statSync(out).size / 1048576 }
}

/** A recording's waveform, measured once and kept beside the project. */
export async function waveformOf(bin, p, k) {
  const src = p.fuentes[k]
  if (!src) throw new Error('No such recording.')
  const file = join(PROJECT_MEDIA, p.id, `onda-${k}.json`)
  const cached = readJson(file, null)
  if (cached) return cached
  const peaks = src.audio ? await waveform(bin, src.file) : []
  mkdirSync(join(PROJECT_MEDIA, p.id), { recursive: true })
  writeFileSync(file, JSON.stringify(peaks))
  return peaks
}
