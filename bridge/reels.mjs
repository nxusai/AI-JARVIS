import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchReference, referenceHost } from './nucleo/referencias.mjs'
import { DEFAULT_STYLE, contactSheet, describePace, detectCuts, detectSilences, findWhisper, findWhisperModel, loudness, probe, still, suggestFromPace } from './reels/motor.mjs'
import {
  editOf,
  ensureFolders,
  listProjects,
  listStyles,
  prepareProject,
  readProject,
  readStyle,
  readTaste,
  renderProject,
  saveStyle,
  tasteText,
  transcriptLines,
  updateEdit,
  updateTaste,
} from './reels/proyectos.mjs'
import { findFfmpeg, resolveSource } from './video.mjs'

/**
 * The Reels studio: the owner records, Nexy edits.
 *
 * Built for one person's personal brand on Instagram — talking to camera,
 * videos carried by captions, tutorials and short vlogs. The owner sends raw
 * recordings (Telegram, AirDrop into ~/Movies/Nexy/entrada, or the studio
 * console) and the studio cuts the pauses and "eh"s, frames it 9:16, adds
 * punch-in zooms, captions word by word, a hook title, levelled voice and
 * ducked music.
 *
 * It learns how the owner likes things: styles studied from reference reels
 * or written from what they say, and their taste from a short interview and
 * every comment on an edit. These are Nexy's tools; the state they change —
 * projects, edits, styles, taste — lives in reels/proyectos.mjs, shared with
 * the studio console (estudio.mjs), so whatever she changes appears there at
 * once and whatever the owner does there by hand, she reads here.
 */

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })
const jpeg = (buf) => ({ type: 'image', data: buf.toString('base64'), mimeType: 'image/jpeg' })

const rangeSchema = z.object({
  fuente: z.number().int().min(1).optional().describe('Which recording (f1, f2… in the transcript). Default 1.'),
  inicio: z.number().min(0).describe('Seconds into that recording.'),
  fin: z.number().min(0),
})

/** What an edit can change, shared by update_reel and edit_reel. */
const EDIT_FIELDS = {
  style: z.string().optional().describe('A saved style; "base" for none.'),
  tweaks: z.record(z.string(), z.any()).optional().describe('Settings for this reel only, laid on the style, e.g. {"zoom":{"activo":false}}. Replaces the earlier tweaks; {} clears them.'),
  drop: z.array(rangeSchema).optional().describe('Every part to remove (retakes, false starts, what the owner disliked). Replaces the list: include the earlier ones to keep them.'),
  keep: z.array(rangeSchema).optional().describe('Parts kept even if they are pauses (a beat the owner wants). Replaces the list.'),
  only: z.array(rangeSchema).optional().describe('When given, only these parts are used (a short clip from a long recording). [] for everything.'),
  title: z.string().optional().describe('The hook title for the first seconds; "" for none.'),
  music: z.string().optional().describe('A track from the music folder (list_videos) or a link the owner gave; "none" to remove it.'),
  texts: z
    .array(z.object({ texto: z.string(), inicio: z.number().describe('Seconds into the finished reel.'), fin: z.number(), altura: z.number().optional().describe('0 top to 1 bottom. Default 0.3.'), tamano: z.number().optional(), color: z.string().optional() }))
    .optional()
    .describe('Text on screen at moments of the reel (a key word, a number, a call to action). Replaces the list.'),
  zooms: z.array(z.object({ fuente: z.number().int().min(1).optional(), t: z.number().describe('A moment in that recording (seconds).'), escala: z.number().describe('1 for no zoom, 1.1–1.4 for a punch-in.') })).optional().describe('Zooms by hand on the pieces at these moments, over the style\'s rhythm. Replaces the list.'),
  fix_words: z.array(z.object({ de: z.string(), a: z.string() })).optional().describe('Words the transcription got wrong, fixed everywhere in the captions (e.g. a brand name).'),
}

/** The edit's changes from the tool arguments. */
function patchFrom(a) {
  const patch = {}
  if (a.style !== undefined) patch.estilo = a.style === 'base' ? null : a.style
  if (a.tweaks !== undefined) patch.ajustes = Object.keys(a.tweaks).length ? a.tweaks : null
  if (a.drop !== undefined) patch.quitar = a.drop
  if (a.keep !== undefined) patch.forzar = a.keep
  if (a.only !== undefined) patch.solo = a.only
  if (a.title !== undefined) patch.titulo = a.title
  if (a.music !== undefined) patch.musica = a.music === 'none' ? null : a.music
  if (a.texts !== undefined) patch.textos = a.texts
  if (a.zooms !== undefined) patch.zooms = a.zooms
  return patch
}

const editLine = (e) =>
  `Edit now: style ${e.estilo ?? 'default'}${e.ajustes ? ` + ${JSON.stringify(e.ajustes)}` : ''}; title "${e.titulo}"; ` +
  `removed ${JSON.stringify(e.quitar)}; kept by hand ${JSON.stringify(e.forzar)}${e.solo.length ? `; only ${JSON.stringify(e.solo)}` : ''}; ` +
  `music ${e.musica ?? 'none'}; ${e.textos.length} text(s) on screen; ${e.zooms.length} zoom(s) by hand.`

export function reelsServer(elevenKey) {
  ensureFolders()
  // The bridge hands over a function (the key can appear while it runs); a plain key works too.
  const key = () => (typeof elevenKey === 'function' ? elevenKey() : elevenKey) || null
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
        const engine = whisper && model ? `whisper.cpp (${model.split('/').pop()}), local` : key() ? 'ElevenLabs Scribe (no local whisper yet: npm run reels:setup makes it free and private)' : 'NONE: edits cut pauses but carry no captions until the owner runs npm run reels:setup'
        const styles = listStyles()
        const projects = listProjects().slice(0, 8)
        return ok(
          [
            `FFmpeg: ${findFfmpeg() ? 'yes' : 'NO'}. Transcription: ${engine}. Studio console: http://localhost:5173/estudio.html`,
            styles.length ? `Styles:\n${styles.map((s) => `- ${s.nombre}: ${s.descripcion || ''}`).join('\n')}` : 'Styles: none saved yet (the base style applies).',
            tasteText(readTaste()),
            projects.length ? `Recent projects:\n${projects.map((p) => `- ${p.id} "${p.nombre}" (${p.duracion} s, ${p.versiones} version(s))`).join('\n')}` : 'No projects yet.',
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
          try {
            const { style, updated } = saveStyle({ name, description, settings, references: references ?? [], makeDefault: !!make_default })
            return ok(`${updated ? 'Updated' : 'Saved'} the style "${style.nombre}"${make_default ? ' (now the default)' : ''}: ${JSON.stringify(style.ajustes)}`)
          } catch (err) {
            return refuse(err.message)
          }
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
          const changed = answers || likes?.length || dislikes?.length || feedback
          const t = changed ? updateTaste({ answers, likes, dislikes, feedback, project }) : readTaste()
          return ok((changed ? 'Saved.\n\n' : '') + tasteText(t))
        },
      ),

      tool(
        'prepare_reel',
        'Start a reel from the owner\'s raw recordings (paths from list_videos or their message; several are joined in order): transcribes them and measures the ' +
          'pauses. Returns the project and the transcript with times, to spot retakes, false starts and the best hook before editing. It also opens in the studio console. ' +
          'Takes about a minute per few minutes of video.',
        {
          sources: z.array(z.string()).min(1).describe('The recordings, in order.'),
          name: z.string().optional().describe('A short name, e.g. "tip-productividad".'),
        },
        guard(async (bin, { sources, name }) => {
          const p = await prepareProject(bin, key(), sources, name)
          const total = p.fuentes.reduce((s, f) => s + f.duration, 0)
          return ok(
            `Project ${p.id}: ${p.fuentes.length} recording(s), ${Math.round(total)} s, heard by ${p.fuentes.find((f) => f.engine)?.engine ?? 'nothing (no captions)'}.\n\n` +
              `${transcriptLines(p.fuentes).join('\n')}\n\n` +
              'If a sentence is said twice, the last take is usually the good one: drop the earlier ones. Pick a hook title from the strongest line.',
          )
        }),
      ),

      tool(
        'read_reel',
        "A project as it stands: the transcript with times, the edit (including what the owner changed by hand in the studio console) and the versions rendered.",
        { project: z.string() },
        async ({ project }) => {
          const p = readProject(project)
          if (!p) return refuse(`No project ${project}.`)
          return ok(
            `Project ${p.id} "${p.nombre ?? ''}"\n\n${transcriptLines(p.fuentes).join('\n')}\n\n${editLine(editOf(p))}\n\n` +
              `Versions: ${p.versiones.map((v, i) => `v${i + 1} ${v.salida}${v.vistaPrevia ? ' (preview)' : ''}`).join('; ') || 'none yet'}`,
          )
        },
      ),

      tool(
        'update_reel',
        'Change a reel\'s edit without rendering: what is removed or kept, the style or its tweaks, title, music, text on screen, zooms by hand, misheard words. ' +
          'The studio console shows the change live at once; render with edit_reel when the owner wants the file.',
        { project: z.string(), ...EDIT_FIELDS },
        async (args) => {
          try {
            const p = updateEdit(args.project, patchFrom(args), { replace: args.fix_words ?? [] })
            return ok(`Updated ${p.id}. ${editLine(editOf(p))}`)
          } catch (err) {
            return refuse(err.message)
          }
        },
      ),

      tool(
        'edit_reel',
        'Edit a reel and render it to ~/Movies/Nexy/listos: cuts the pauses and filler sounds, drops what you say, frames it, zooms, captions word by word, adds the hook title, ' +
          'levels the voice and ducks the music, all in the chosen style. Pass project (from prepare_reel) to re-edit without transcribing again — that is how feedback is applied. ' +
          'Fields left out keep what the edit already has. Returns the file and a contact sheet to check it; then send_file it to the owner and ask what they think.',
        {
          project: z.string().optional().describe('The project from prepare_reel.'),
          sources: z.array(z.string()).optional().describe('Recordings, when there is no project yet (prepares one first).'),
          preview: z.boolean().optional().describe('Half size and fast, to show a first cut quickly. Default false.'),
          ...EDIT_FIELDS,
        },
        guard(async (bin, args) => {
          let id = args.project
          if (id && !readProject(id)) return refuse(`No project ${id}.`)
          if (!id) {
            if (!args.sources?.length) return refuse('Give the recordings (sources) or a project.')
            id = (await prepareProject(bin, key(), args.sources, args.title || 'reel')).id
          }
          updateEdit(id, patchFrom(args), { replace: args.fix_words ?? [] })
          const { out, secs, plan, version, mb } = await renderProject(bin, id, { preview: !!args.preview })
          const { style, pieces, words, length, total, edit, styleName } = plan
          const zooms = pieces.filter((p) => p.zoom > 1.001).length
          const work = mkdtempSync(join(tmpdir(), 'nexy-reels-'))
          try {
            const sheet = await contactSheet(bin, out, length, join(work, 'hoja.jpg'))
            return {
              content: [
                jpeg(sheet),
                {
                  type: 'text',
                  text:
                    `Rendered in ${secs} s: ${out} (${mb.toFixed(1)} MB${args.preview ? ', preview at half size' : ''}).\n` +
                    `Style "${styleName}"${edit.ajustes ? ` + ${JSON.stringify(edit.ajustes)}` : ''}. ${Math.round(total)} s of recording → ${length.toFixed(1)} s reel ` +
                    `(${Math.round(total - length)} s of pauses, fillers and drops cut), ${pieces.length} pieces, ${zooms} zooms, ` +
                    `${style.subtitulos.activo && words.length ? `${words.length} captioned words` : 'no captions'}${edit.titulo ? `, title "${edit.titulo}"` : ''}${edit.musica ? ', music ducked under the voice' : ''}.\n` +
                    `Project ${id}, version ${version}. Check the contact sheet (captions readable, nothing covering the face, framing right), then send it to the owner and ask what they ` +
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
- Editing: prepare_reel with the recordings, read the transcript, drop retakes and false starts, choose a hook title from the strongest line, then edit_reel (a preview first when they're waiting, the full render once they like it). Tutorials and screen recordings: tweaks {"encuadre":{"modo":"blur"}}. Add text on screen for key numbers or words, and a zoom by hand on the punchline.
- Feedback: every comment on an edit goes to reel_taste, and the change goes into their style with save_reel_style, then edit_reel on the same project (no new transcription). Never ask them to edit anything themselves.
- The studio console (http://localhost:5173/estudio.html) shows every project live: the owner may cut or tweak there by hand too, so read_reel before changing a project they may have touched, and keep their changes.
For 3D titles, motion graphics or anything beyond this, finish the reel here and then take it to the effects workshop. Rendering takes a minute or two: say so.`
