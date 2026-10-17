import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchReference, referenceHost } from './nucleo/referencias.mjs'
import {
  DEFAULT_STYLE,
  REELS_DATA,
  buildAss,
  contactSheet,
  describePace,
  detectCuts,
  detectSilences,
  ffmpeg,
  findWhisper,
  findWhisperModel,
  loudness,
  mergeStyle,
  planCuts,
  probe,
  remapWords,
  renderArgs,
  settle,
  still,
  suggestFromPace,
  timeline,
  transcribe,
} from './reels/motor.mjs'
import { DONE, VIDEO_DIR, findFfmpeg, resolveSource, transcribeWords } from './video.mjs'

/**
 * The Reels studio: the owner records, Nexy edits.
 *
 * Built for one person's personal brand on Instagram — talking to camera,
 * videos carried by captions, tutorials and short vlogs. The owner sends raw
 * recordings (Telegram, AirDrop into ~/Movies/Nexy/entrada) and the studio
 * cuts the pauses and "eh"s, frames it 9:16, adds punch-in zooms, captions
 * word by word, a hook title, levelled voice and ducked music.
 *
 * It learns how the owner likes things in two ways, both kept on this Mac:
 *
 *   styles  (~/.nexy/reels/estilos)  how a reel looks, as data the engine
 *           applies: studied from reference videos the owner likes, or
 *           written from what they say, and tweaked by their feedback
 *   taste   (~/.nexy/reels/gustos.json)  who they are and what they like
 *           and hate, from a short interview and every comment on an edit
 *
 * Every edit is a project (~/.nexy/reels/proyectos) holding the transcript
 * and the silences, so "bigger captions" or "drop the second take" re-renders
 * without hearing the recording again. The engine is reels/motor.mjs; it only
 * reads from the Nexy folders and writes to ~/Movies/Nexy.
 */

const STYLES = join(REELS_DATA, 'estilos')
const PROJECTS = join(REELS_DATA, 'proyectos')
const TASTE_FILE = join(REELS_DATA, 'gustos.json')
const PROJECT_MEDIA = join(VIDEO_DIR, 'reels')
const MAX_SOURCES = 12
const MAX_SECONDS = 15 * 60

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })
const jpeg = (buf) => ({ type: 'image', data: buf.toString('base64'), mimeType: 'image/jpeg' })

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
const writeJson = (file, data) => {
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
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

function tasteText(t) {
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

/** The style an edit runs with: the named one (or the default), with this edit's tweaks on top. */
function resolveStyle(name, tweaks) {
  const taste = readTaste()
  const saved = readStyle(name) ?? readStyle(taste.estiloPorDefecto)
  return { style: settle(mergeStyle(mergeStyle(DEFAULT_STYLE, saved?.ajustes), tweaks)), name: saved?.nombre ?? 'base' }
}

// -- projects ---------------------------------------------------------------

const projectFile = (id) => join(PROJECTS, `${slug(id)}.json`)
const readProject = (id) => (id && slug(id) ? readJson(projectFile(id), null) : null)

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

/** A new project: the sources found, probed, transcribed and their silences measured. */
async function prepare(bin, elevenKey, sources, name) {
  const id = `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${slug(name) || 'reel'}`
  const media = join(PROJECT_MEDIA, id)
  mkdirSync(media, { recursive: true })
  const list = []
  try {
    for (const [i, s] of sources.slice(0, MAX_SOURCES).entries()) {
      const file = await resolveSource(s, media, i)
      const info = await probe(bin, file)
      if (!info.video) throw new Error(`${s} is not a video`)
      if (info.duration > MAX_SECONDS) throw new Error(`${s} is over ${MAX_SECONDS / 60} minutes; cut it in parts first`)
      const heard = info.audio ? await transcribe(bin, file, { elevenKey, elevenTranscribe: transcribeWords }) : { words: [], engine: null }
      list.push({ fuente: s, file, ...info, words: heard.words, engine: heard.engine })
    }
  } catch (err) {
    rmSync(media, { recursive: true, force: true })
    throw err
  }
  const project = { id, creado: new Date().toISOString(), fuentes: list, versiones: [] }
  for (const src of project.fuentes) if (src.audio) await silencesAt(bin, src, DEFAULT_STYLE.cortes.silencioDb)
  writeJson(projectFile(id), project)
  return project
}

const rangeSchema = z.object({
  fuente: z.number().int().min(1).optional().describe('Which recording (f1, f2… in the transcript). Default 1.'),
  inicio: z.number().min(0).describe('Seconds into that recording.'),
  fin: z.number().min(0),
})
const byRecording = (ranges, k) => (ranges ?? []).filter((r) => (r.fuente ?? 1) - 1 === k && r.fin > r.inicio).map((r) => ({ start: r.inicio, end: r.fin }))

// -- the server -------------------------------------------------------------

export function reelsServer(elevenKey) {
  for (const d of [STYLES, PROJECTS, PROJECT_MEDIA, DONE]) {
    try {
      mkdirSync(d, { recursive: true })
    } catch {
      // Reported when used.
    }
  }
  const guard = (fn) => async (args) => {
    const bin = findFfmpeg()
    if (!bin) return refuse('FFmpeg is not on this Mac: the owner runs `brew install ffmpeg` (or npm install in the Nexy folder).')
    try {
      return await fn(bin, args)
    } catch (err) {
      return refuse(err.message)
    }
  }

  return createSdkMcpServer({
    name: 'jarvis_reels',
    version: '1.0.0',
    instructions: "The owner's Reels studio: edits raw recordings into Instagram reels in the owner's style, and learns that style.",
    tools: [
      tool('reels_status', 'What the Reels studio has: transcription engine, saved styles, the owner\'s taste and the interview questions still to ask, and recent projects. Read it before the first edit of a conversation.', {}, async () => {
        const whisper = findWhisper()
        const model = findWhisperModel()
        const engine = whisper && model ? `whisper.cpp (${model.split('/').pop()}), local` : elevenKey ? 'ElevenLabs Scribe (no local whisper yet: npm run reels:setup makes it free and private)' : 'NONE: edits cut pauses but carry no captions until the owner runs npm run reels:setup'
        const styles = listStyles()
        let projects = []
        try {
          projects = readdirSync(PROJECTS).filter((f) => f.endsWith('.json')).sort().slice(-6).map((f) => f.slice(0, -5))
        } catch {
          // None yet.
        }
        return ok(
          [
            `FFmpeg: ${findFfmpeg() ? 'yes' : 'NO'}. Transcription: ${engine}.`,
            styles.length ? `Styles:\n${styles.map((s) => `- ${s.nombre}: ${s.descripcion || ''}`).join('\n')}` : 'Styles: none saved yet (the base style applies).',
            tasteText(readTaste()),
            projects.length ? `Recent projects: ${projects.join(', ')}` : 'No projects yet.',
          ].join('\n\n'),
        )
      }),

      tool(
        'study_reference',
        'Study the editing of a reel the owner likes: a link (Instagram, TikTok, YouTube…) or a video they sent. Measures its pace (cuts per minute, shot lengths, ' +
          'silence left in, loudness) and returns a contact sheet and two frames to read what can only be seen: caption font, size, colours, position, words per line, ' +
          'capitals, animation, title on top, framing, colour, b-roll, emojis. Then save it with save_reel_style.',
        { source: z.string().describe('The link or the file path exactly as the owner sent it.') },
        guard(async (bin, { source }) => {
          const work = mkdtempSync(join(tmpdir(), 'nexy-reels-ref-'))
          try {
            let file
            let about = ''
            if (referenceHost(source)) {
              const ref = await fetchReference(source, { ffmpeg: bin })
              file = ref.path
              about = `"${ref.title}"${ref.uploader ? ` by ${ref.uploader}` : ''}, kept at ${ref.path}`
            } else {
              file = await resolveSource(source, work, 0)
              about = file
            }
            const info = await probe(bin, file)
            if (!info.video) return refuse('That is not a video.')
            const [cuts, silences, lufs] = await Promise.all([detectCuts(bin, file), info.audio ? detectSilences(bin, file, -34, 0.2) : [], info.audio ? loudness(bin, file) : null])
            const pace = describePace(info.duration, cuts, silences)
            const sheet = await contactSheet(bin, file, info.duration, join(work, 'hoja.jpg'))
            const a = await still(bin, file, info.duration * 0.3, join(work, 'a.jpg'))
            const b = await still(bin, file, info.duration * 0.65, join(work, 'b.jpg'))
            return {
              content: [
                jpeg(sheet),
                jpeg(a),
                jpeg(b),
                {
                  type: 'text',
                  text:
                    `Reference: ${about}\nSize ${info.width}×${info.height}, ${pace.duracion} s.\n` +
                    `Pace: ${pace.cortes} hard cuts (${pace.cortesPorMinuto}/min), median shot ${pace.tomaMediana} s, longest ${pace.tomaMasLarga} s; ` +
                    `${pace.silencioPorCiento}% silence, ${pace.pausasLargas} pauses over 0.5 s${lufs !== null ? `; loudness ${lufs} LUFS` : ''}.\n` +
                    `The measurements suggest: ${JSON.stringify(suggestFromPace(pace))}\n\n` +
                    'Above: a contact sheet of the whole video, and frames at 30% and 65%. Read the captions (font weight, colour of text and highlighted word, ' +
                    'outline, position as a share of the height, words per line, capitals, animation), any title, the framing, the colour, and b-roll or ' +
                    'graphics. Tell the owner in two or three lines what makes this edit work, then save_reel_style with the settings that reproduce it. ' +
                    `The settings a style can carry:\n${JSON.stringify(DEFAULT_STYLE)}`,
                },
              ],
            }
          } finally {
            rmSync(work, { recursive: true, force: true })
          }
        }),
      ),

      tool(
        'save_reel_style',
        'Save or update an editing style for reels: only the settings that differ from the base (see read_reel_styles for every setting). Use it after study_reference, ' +
          'after the owner says how they want things, and after feedback on an edit ("bigger captions", "fewer zooms") so the next reel already comes out that way.',
        {
          name: z.string().describe('A short name, e.g. "mi estilo" or "estilo hormozi".'),
          description: z.string().describe('One line on what the style is and when to use it.'),
          settings: z.record(z.string(), z.any()).describe('Partial settings laid onto the style, e.g. {"subtitulos":{"tamano":0.09,"resaltado":"#00E5FF"},"zoom":{"cada":3}}.'),
          references: z.array(z.string()).optional().describe('Links or files this style was studied from.'),
          make_default: z.boolean().optional().describe('Use it for every reel unless another is named.'),
        },
        async ({ name, description, settings, references, make_default }) => {
          if (!slug(name)) return refuse('Give the style a name.')
          const before = readStyle(name)
          const ajustes = mergeStyle(mergeStyle(DEFAULT_STYLE, before?.ajustes), settings)
          // Keep only what differs from the base, so later changes to the base still reach it.
          const diff = (base, s) =>
            Object.fromEntries(
              Object.entries(s)
                .map(([k, v]) => [k, v && typeof v === 'object' ? diff(base[k], v) : v === base[k] ? undefined : v])
                .filter(([, v]) => v !== undefined && !(v && typeof v === 'object' && !Object.keys(v).length)),
            )
          const style = {
            nombre: before?.nombre ?? name.trim(),
            descripcion: description || before?.descripcion || '',
            ajustes: diff(DEFAULT_STYLE, settle(ajustes)),
            referencias: [...new Set([...(before?.referencias ?? []), ...(references ?? [])])],
            creado: before?.creado ?? new Date().toISOString(),
            actualizado: new Date().toISOString(),
          }
          writeJson(styleFile(name), style)
          if (make_default) writeJson(TASTE_FILE, { ...readTaste(), estiloPorDefecto: style.nombre })
          return ok(`${before ? 'Updated' : 'Saved'} the style "${style.nombre}"${make_default ? ' (now the default)' : ''}: ${JSON.stringify(style.ajustes)}`)
        },
      ),

      tool(
        'read_reel_styles',
        'The saved reel styles in full (or one by name), with every setting a style can carry and what the base style uses.',
        { name: z.string().optional() },
        async ({ name }) => {
          const all = name ? [readStyle(name)].filter(Boolean) : listStyles()
          if (name && !all.length) return refuse(`No style "${name}". Styles: ${listStyles().map((s) => s.nombre).join(', ') || 'none yet'}.`)
          return ok(
            [
              ...all.map((s) => `## ${s.nombre}\n${s.descripcion}\nChanges from base: ${JSON.stringify(s.ajustes)}\nStudied from: ${s.referencias?.join(', ') || '—'}`),
              `## base (every setting)\n${JSON.stringify(DEFAULT_STYLE, null, 1)}\n` +
                'Notes: tamano and altura are shares of the frame; encuadre.modo "blur" puts the whole picture over a blurred copy (for screen recordings); ' +
                'zoom.cada=2 punches in every other piece; subtitulos.animacion is "palabra", "pop" or "frase"; cortes.pausaMax is the longest pause kept (s).',
            ].join('\n\n'),
          )
        },
      ),

      tool(
        'reel_taste',
        "Read or add to what the studio knows about the owner's taste: answers to the interview, likes, dislikes, and feedback on an edit. Call it with " +
          'nothing to read it (it lists the interview questions still to ask). Save every answer and every comment about an edit here, then also change the style it touches.',
        {
          answers: z.record(z.string(), z.string()).optional().describe('Interview answers by key (tema, tono, ritmo, subtitulos, marca, zooms, musica, gancho, duracion, odia, referentes).'),
          likes: z.array(z.string()).optional(),
          dislikes: z.array(z.string()).optional(),
          feedback: z.string().optional().describe('What the owner said about an edit, in their words.'),
          project: z.string().optional().describe('The project the feedback is about.'),
        },
        async ({ answers, likes, dislikes, feedback, project }) => {
          const t = readTaste()
          const changed = answers || likes?.length || dislikes?.length || feedback
          if (answers) Object.assign(t.respuestas, Object.fromEntries(Object.entries(answers).map(([k, v]) => [slug(k).replace(/-/g, '_') || k, String(v).slice(0, 600)])))
          if (likes?.length) t.leGusta = [...new Set([...t.leGusta, ...likes.map((s) => s.slice(0, 200))])].slice(-60)
          if (dislikes?.length) t.noLeGusta = [...new Set([...t.noLeGusta, ...dislikes.map((s) => s.slice(0, 200))])].slice(-60)
          if (feedback) t.comentarios = [...t.comentarios, { fecha: new Date().toISOString(), proyecto: project ?? null, texto: feedback.slice(0, 800) }].slice(-200)
          if (changed) writeJson(TASTE_FILE, t)
          return ok((changed ? 'Saved.\n\n' : '') + tasteText(t))
        },
      ),

      tool(
        'prepare_reel',
        'Start a reel from the owner\'s raw recordings (paths from list_videos or their message; several are joined in order): transcribes them and measures the ' +
          'pauses. Returns the project and the transcript with times, to spot retakes, false starts and the best hook before edit_reel. Takes about a minute per few minutes of video.',
        {
          sources: z.array(z.string()).min(1).describe('The recordings, in order.'),
          name: z.string().optional().describe('A short name, e.g. "tip-productividad".'),
        },
        guard(async (bin, { sources, name }) => {
          const p = await prepare(bin, elevenKey, sources, name)
          const total = p.fuentes.reduce((s, f) => s + f.duration, 0)
          return ok(
            `Project ${p.id}: ${p.fuentes.length} recording(s), ${Math.round(total)} s, heard by ${p.fuentes.find((f) => f.engine)?.engine ?? 'nothing (no captions)'}.\n\n` +
              `${transcriptLines(p.fuentes).join('\n')}\n\n` +
              'If a sentence is said twice, the last take is usually the good one: drop the earlier ones with `drop` in edit_reel. Pick a hook title from the strongest line.',
          )
        }),
      ),

      tool(
        'edit_reel',
        'Edit a reel and render it to ~/Movies/Nexy/listos: cuts the pauses and filler sounds, drops what you say, frames it, zooms, captions word by word, adds the hook title, ' +
          'levels the voice and ducks the music, all in the chosen style. Pass project (from prepare_reel) to re-edit without transcribing again — that is how feedback is applied: ' +
          'change the style or pass tweaks and render again. Returns the file and a contact sheet to check it; then send_file it to the owner and ask what they think.',
        {
          project: z.string().optional().describe('The project from prepare_reel (or an earlier edit_reel).'),
          sources: z.array(z.string()).optional().describe('Recordings, when there is no project yet (prepares one first).'),
          style: z.string().optional().describe('A saved style; the default style when left out.'),
          tweaks: z.record(z.string(), z.any()).optional().describe('Settings for this edit only, laid on the style, e.g. {"zoom":{"activo":false}}.'),
          drop: z.array(rangeSchema).optional().describe('Parts to remove: retakes, false starts, anything the owner did not like.'),
          only: z.array(rangeSchema).optional().describe('When given, only these parts are used (e.g. to make a short clip from a long recording).'),
          title: z.string().optional().describe('The hook title for the first seconds; empty for none.'),
          music: z.string().optional().describe('A track from the music folder (list_videos) or a link the owner gave; "none" to remove it.'),
          preview: z.boolean().optional().describe('Half size and fast, to show a first cut quickly. Default false.'),
        },
        guard(async (bin, { project, sources, style, tweaks, drop, only, title, music, preview }) => {
          let p = readProject(project)
          if (project && !p) return refuse(`No project ${project}.`)
          if (!p) {
            if (!sources?.length) return refuse('Give the recordings (sources) or a project.')
            p = await prepare(bin, elevenKey, sources, title || 'reel')
          }
          const last = p.versiones[p.versiones.length - 1] ?? {}
          const { style: st, name: styleName } = resolveStyle(style ?? last.estilo, tweaks ?? (style ? undefined : last.ajustes))
          const dropped = drop ?? last.quitar ?? []
          const onlyRanges = only ?? last.solo ?? []
          const hook = title ?? last.titulo ?? ''
          let track = music === 'none' ? null : (music ?? last.musica ?? null)

          for (const src of p.fuentes) if (!existsSync(src.file)) return refuse(`The recording ${src.fuente} is no longer at ${src.file}.`)
          const plans = []
          for (const [k, src] of p.fuentes.entries()) {
            const silences = src.audio ? await silencesAt(bin, src, st.cortes.silencioDb) : []
            plans.push(planCuts({ duration: src.duration, silences, words: src.words, cuts: st.cortes, drop: byRecording(dropped, k), only: byRecording(onlyRanges, k).length ? byRecording(onlyRanges, k) : null }))
          }
          const pieces = timeline(plans)
          if (!pieces.length) return refuse('Nothing is left after the cuts: check drop/only, or raise cortes.pausaMax.')

          const media = join(PROJECT_MEDIA, p.id)
          mkdirSync(media, { recursive: true })
          let musicFile = null
          if (track) {
            musicFile = await resolveSource(track, media, 'musica')
            if (/^https:/i.test(track)) track = musicFile
          }
          const words = remapWords(p.fuentes.map((f) => f.words), pieces)
          const hasCaptions = (st.subtitulos.activo && words.length > 0) || (st.titulo.activo && !!hook)
          const n = p.versiones.length + 1
          const out = join(DONE, `${p.id}-v${n}${preview ? '-vista' : ''}.mp4`)
          const { args, length, size } = renderArgs({ sources: p.fuentes, pieces, style: st, music: musicFile, subs: hasCaptions ? 'subs.ass' : null, out, preview })
          if (hasCaptions) writeFileSync(join(media, 'subs.ass'), buildAss(words, st, size, { title: hook, length }))
          const started = Date.now()
          await ffmpeg(bin, args, { cwd: media })
          const secs = Math.round((Date.now() - started) / 1000)

          p.versiones.push({ fecha: new Date().toISOString(), salida: out, estilo: styleName, ajustes: tweaks ?? null, quitar: dropped, solo: onlyRanges, titulo: hook, musica: track, vistaPrevia: !!preview })
          writeJson(projectFile(p.id), p)

          const total = p.fuentes.reduce((s, f) => s + f.duration, 0)
          const zooms = st.zoom.activo ? Math.floor(pieces.length / st.zoom.cada) : 0
          const work = mkdtempSync(join(tmpdir(), 'nexy-reels-'))
          try {
            const sheet = await contactSheet(bin, out, length, join(work, 'hoja.jpg'))
            return {
              content: [
                jpeg(sheet),
                {
                  type: 'text',
                  text:
                    `Rendered in ${secs} s: ${out} (${(statSync(out).size / 1048576).toFixed(1)} MB${preview ? ', preview at half size' : ''}).\n` +
                    `Style "${styleName}"${tweaks ? ` + ${JSON.stringify(tweaks)}` : ''}. ${Math.round(total)} s of recording → ${length.toFixed(1)} s reel ` +
                    `(${Math.round(total - length)} s of pauses, fillers and drops cut), ${pieces.length} pieces, ${zooms} zooms, ` +
                    `${st.subtitulos.activo && words.length ? `${words.length} captioned words` : 'no captions'}${hook ? `, title "${hook}"` : ''}${musicFile ? ', music ducked under the voice' : ''}.\n` +
                    `Project ${p.id}, version ${n}. Check the contact sheet (captions readable, nothing covering the face, framing right), then send it to the owner and ask what they ` +
                    'like and what not; save their answer with reel_taste and the change in their style with save_reel_style before rendering again.',
                },
              ],
            }
          } finally {
            rmSync(work, { recursive: true, force: true })
          }
        }),
      ),
    ],
  })
}

/** For Nexy's prompt. */
export const REELS_PROMPT = `

# Reels studio (the owner's personal brand on Instagram)
The owner records, you edit: talking to camera, caption-driven videos, tutorials and short vlogs, for Reels. Use jarvis_reels for these — it is built for exactly this and learns the owner's taste. reels_status first in a conversation about reels.
- Learning: when the interview has questions left, ask one or two naturally (never a list) and save each answer with reel_taste. When the owner sends a reel they like, study_reference it, say in two lines what makes it work, and save_reel_style (ask whether it becomes their default).
- Editing: prepare_reel with the recordings, read the transcript, drop retakes and false starts, choose a hook title from the strongest line, then edit_reel (a preview first when they're waiting, the full render once they like it). Tutorials and screen recordings: tweaks {"encuadre":{"modo":"blur"}}.
- Feedback: every comment on an edit goes to reel_taste, and the change goes into their style with save_reel_style, then edit_reel on the same project (no new transcription). Never ask them to edit anything themselves.
For 3D titles, motion graphics or anything beyond this, finish the reel here and then take it to the effects workshop. Rendering takes a minute or two: say so.`
