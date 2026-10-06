import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { basename, extname, join, sep } from 'node:path'
import { activeBrand, findBrand, moldSources, readLogo, readManual } from './brands.mjs'
import { vetTarget } from './net.mjs'
import { REFS, fetchReference } from './reference.mjs'
import { rawRoots } from './raw.mjs'

/**
 * Nexy's video editor: the everyday edits, done by FFmpeg on this Mac.
 *
 * One recipe per video — which clips (and which part of each), the format,
 * subtitles, music, a voice-over and the brand's logo — and one finished
 * file. It is deliberately not a general tool: FFmpeg runs with arguments
 * built here, never a command line from the model, and it only reads clips
 * from the Nexy folders or public links and only writes into the Nexy folder.
 *
 *   ~/Movies/Nexy/entrada   the owner's own videos (AirDrop them here)
 *   ~/Movies/Nexy/musica    music the owner has the right to use
 *   ~/Movies/Nexy/listos    finished videos
 *   ~/Movies/Nexy/referencias  videos the owner pointed at to show a style (see reference.mjs)
 *
 * FFmpeg is the Homebrew one when installed, otherwise the copy npm put in
 * node_modules (ffmpeg-static), or NEXY_FFMPEG.
 */

export const VIDEO_DIR = join(homedir(), 'Movies', 'Nexy')
export const INBOX = join(VIDEO_DIR, 'entrada')
export const MUSIC = join(VIDEO_DIR, 'musica')
export const DONE = join(VIDEO_DIR, 'listos')
const NEXY_DIR = join(homedir(), '.nexy')
/** Lines spoken in the owner's cloned voice, for lip-sync and voice-overs. */
export const VOICE_LINES = join(VIDEO_DIR, 'voz')
/** The owner's cloned voice on ElevenLabs: { voiceId, fecha, muestras }. */
const OWNER_VOICE_FILE = join(NEXY_DIR, 'mi-voz.json')

/** The ElevenLabs voice id of the owner's own cloned voice, or null. */
export function ownerVoice() {
  try {
    return JSON.parse(readFileSync(OWNER_VOICE_FILE, 'utf8'))?.voiceId || null
  } catch {
    return null
  }
}

const MAX_DOWNLOAD = 500 * 1024 * 1024
const MAX_CLIPS = 20
const MAX_SECONDS = 600
const FPS = 30

const FORMATS = {
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '16:9': [1920, 1080],
}
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv)$/i
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|flac)$/i

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })

/** FFmpeg on this Mac, or null. */
export function findFfmpeg() {
  const candidates = [process.env.NEXY_FFMPEG, '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg']
  try {
    candidates.push(createRequire(import.meta.url)('ffmpeg-static'))
  } catch {
    // Not installed.
  }
  return candidates.find((p) => p && existsSync(p)) ?? null
}

/**
 * Run FFmpeg with an argument list (no shell). Resolves with everything it
 * printed; with `anyExit`, also when it exits with an error (a bare `-i`
 * always does, and its report is exactly what is wanted).
 */
export function run(ffmpeg, args, timeoutMs = 15 * 60_000, anyExit = false, cwd = undefined) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'pipe', 'pipe'], cwd })
    let log = ''
    const take = (d) => {
      log = (log + d).slice(-60_000)
    }
    child.stdout.on('data', take)
    child.stderr.on('data', take)
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 || anyExit) resolve(log)
      else reject(new Error(log.split('\n').filter(Boolean).slice(-3).join(' | ') || `ffmpeg exited ${code}`))
    })
  })
}

/** Duration, size and whether there is sound, read from FFmpeg's own report. */
export async function probe(ffmpeg, file) {
  const log = await run(ffmpeg, ['-i', file], 30_000, true).catch(() => '')
  const d = log.match(/Duration: (\d+):(\d+):([\d.]+)/)
  const v = log.match(/Video: .*?, (\d{2,5})x(\d{2,5})/)
  return {
    duration: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0,
    width: v ? Number(v[1]) : 0,
    height: v ? Number(v[2]) : 0,
    audio: /Audio: /.test(log),
  }
}

let filterCache = null
async function hasSubtitles(ffmpeg) {
  if (filterCache === null) {
    try {
      filterCache = /\bsubtitles\b/.test(await run(ffmpeg, ['-filters'], 30_000))
    } catch {
      filterCache = false
    }
  }
  return filterCache
}

/** The folders clips, music and logos may come from. */
function allowedRoots() {
  const out = []
  for (const dir of [VIDEO_DIR, NEXY_DIR]) {
    try {
      out.push(realpathSync(dir) + sep)
    } catch {
      // Not created yet.
    }
  }
  // Each brand's raw footage folder on the external memory (see raw.mjs), read only.
  return [...out, ...rawRoots()]
}

/** A local source inside the Nexy folders, or a public https link downloaded to `work`. */
export async function resolveSource(source, work, n) {
  const s = String(source ?? '').trim()
  if (/^https:\/\//i.test(s)) {
    let url
    try {
      url = vetTarget(s)
    } catch {
      throw new Error(`that link is not allowed: ${s}`)
    }
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`could not download ${url.hostname} (HTTP ${res.status})`)
    const size = Number(res.headers.get('content-length') ?? 0)
    if (size > MAX_DOWNLOAD) throw new Error('that file is too large')
    const type = res.headers.get('content-type') ?? ''
    const ext =
      extname(url.pathname).toLowerCase() ||
      (type.includes('image/png') ? '.png' : type.includes('image/') ? '.jpg' : type.includes('audio/') ? '.mp3' : '.mp4')
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > MAX_DOWNLOAD) throw new Error('that file is too large')
    const file = join(work, `src${n}${ext}`)
    writeFileSync(file, bytes)
    return file
  }
  let real
  try {
    real = realpathSync(s.replace(/^~(?=\/)/, homedir()))
  } catch {
    throw new Error(`file not found: ${s}`)
  }
  if (!allowedRoots().some((r) => real.startsWith(r))) {
    throw new Error(`only files in ${VIDEO_DIR} or sent to Nexy can be used: ${s}`)
  }
  return real
}

/** Words from ElevenLabs Scribe, with times. */
export async function transcribeWords(key, audioFile) {
  const { readFileSync } = await import('node:fs')
  const form = new FormData()
  form.append('model_id', 'scribe_v1')
  form.append('timestamps_granularity', 'word')
  form.append('file', new Blob([readFileSync(audioFile)], { type: 'audio/mpeg' }), 'audio.mp3')
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  })
  if (!res.ok) throw new Error(`transcription failed (HTTP ${res.status})`)
  const data = await res.json()
  return (data.words ?? []).filter((w) => w.type === 'word' && typeof w.start === 'number')
}

/** Short caption chunks: up to four words or about two seconds, split at pauses and punctuation. */
export function chunkWords(words, maxWords = 4, maxSecs = 2.2) {
  const chunks = []
  let cur = []
  for (const w of words) {
    const first = cur[0]
    const pause = cur.length && w.start - cur[cur.length - 1].end > 0.6
    if (cur.length && (cur.length >= maxWords || w.end - first.start > maxSecs || pause)) {
      chunks.push(cur)
      cur = []
    }
    cur.push(w)
    if (/[.!?]$/.test(w.text)) {
      chunks.push(cur)
      cur = []
    }
  }
  if (cur.length) chunks.push(cur)
  return chunks.map((c) => ({ start: c[0].start, end: c[c.length - 1].end + 0.08, text: c.map((w) => w.text.trim()).join(' ') }))
}

const assTime = (t) => {
  const cs = Math.max(0, Math.round(t * 100))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`
}

/** "#7C3AED" → ASS "&H00ED3A7C". */
const assColour = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '')
  return m ? `&H00${m[3]}${m[2]}${m[1]}`.toUpperCase() : '&H00FFFFFF'
}

export function buildAss(chunks, { width, height, font = 'Arial', colour = '#FFFFFF', upper = true }) {
  const size = Math.round(Math.min(width, height) * 0.075)
  const header =
    '[Script Info]\nScriptType: v4.00+\n' +
    `PlayResX: ${width}\nPlayResY: ${height}\nWrapStyle: 0\n\n` +
    '[V4+ Styles]\n' +
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n' +
    `Style: Nexy,${font.replace(/,/g, ' ')},${size},${assColour(colour)},&H000000FF,&H00000000,&H78000000,-1,0,0,0,100,100,0,0,1,${Math.round(size / 9)},2,2,${Math.round(width * 0.08)},${Math.round(width * 0.08)},${Math.round(height * 0.22)},1\n\n` +
    '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
  const clean = (t) => (upper ? t.toUpperCase() : t).replace(/[{}\\]/g, '').replace(/\n/g, ' ')
  return header + chunks.map((c) => `Dialogue: 0,${assTime(c.start)},${assTime(c.end)},Nexy,,0,0,0,,${clean(c.text)}`).join('\n') + '\n'
}

/** A path as FFmpeg's filter syntax wants it inside a filter argument. */
const filterPath = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")

/** The first hex colour in a brand's manual notes, if any. */
const brandColour = (id) => {
  for (const n of readManual(id)) {
    const m = n.match(/#[0-9a-f]{6}\b/i)
    if (m) return m[0]
  }
  return null
}

async function speak(key, voiceId, text, out) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  })
  if (!res.ok) throw new Error(`voice-over failed (HTTP ${res.status})`)
  writeFileSync(out, Buffer.from(await res.arrayBuffer()))
}

/** A file name from free text: lowercase words and dashes. */
const safeFile = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'musica'

/**
 * The mold a downloaded reference became, if any. Files are named
 * "<date>-<site>-<video id>", and a mold keeps the link and the path it came
 * from, so either the file name or the video id inside the link matches.
 */
export function moldOf(file, molds = moldSources()) {
  const name = basename(file).replace(/\.[^.]+$/, '')
  const id = name.replace(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-[^-]+-/, '')
  return molds.find((m) => m.fuente && (m.fuente.includes(name) || (id.length >= 5 && id !== name && m.fuente.includes(id))))?.nombre ?? null
}

const list = (dir, pattern) => {
  try {
    return readdirSync(dir)
      .filter((f) => pattern.test(f))
      .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs, s: statSync(join(dir, f)).size }))
      .sort((a, b) => b.t - a.t)
      .slice(0, 30)
      .map(({ f, s }) => `- ${join(dir, f)} (${(s / 1048576).toFixed(1)} MB)`)
  } catch {
    return []
  }
}

const EDIT_DESCRIPTION =
  'Edit a video: join clips (each optionally cut to a part), set the format, burn in subtitles transcribed from ' +
  "its speech, add background music and/or a voice-over in the owner's voice, and put the brand's logo on it. " +
  'Clips can be videos or still images, from the Nexy folders (list_videos) or public https links (for example ' +
  'Higgsfield results). Use music only from the owner’s music folder (which includes tracks made with make_music) or links ' +
  'they gave. Returns the finished ' +
  'file; show it to the owner before publishing it.'

export function videoServer(elevenKey) {
  for (const d of [INBOX, MUSIC, DONE, REFS]) {
    try {
      mkdirSync(d, { recursive: true })
    } catch {
      // Reported when used.
    }
  }

  return createSdkMcpServer({
    name: 'jarvis_video',
    version: '1.0.0',
    instructions: 'Video editing: clips, cuts, subtitles, music, voice-over and the brand logo.',
    alwaysLoad: true,
    tools: [
      tool('list_videos', 'List the owner’s videos, music and finished edits in the Nexy folders.', {}, async () => {
        const parts = [
          `Owner's videos (${INBOX}):`,
          ...(list(INBOX, VIDEO_EXT).length ? list(INBOX, VIDEO_EXT) : ['(empty)']),
          `Music (${MUSIC}):`,
          ...(list(MUSIC, AUDIO_EXT).length ? list(MUSIC, AUDIO_EXT) : ['(empty)']),
          `Finished (${DONE}):`,
          ...(list(DONE, VIDEO_EXT).length ? list(DONE, VIDEO_EXT) : ['(empty)']),
          `Reference videos, never to publish (${REFS}) — each one becomes an editing mold:`,
          ...(() => {
            const refs = list(REFS, VIDEO_EXT)
            if (!refs.length) return ['(empty)']
            const molds = moldSources()
            return refs.map((line) => {
              const path = line.slice(2).replace(/ \([\d.]+ MB\)$/, '')
              const mold = moldOf(path, molds)
              return `${line} ${mold ? `— mold "${mold}"` : '— NOT A MOLD YET'}`
            })
          })(),
        ]
        return ok(parts.join('\n'))
      }),

      tool(
        'clone_owner_voice',
        "Clone the owner's own voice on ElevenLabs from recordings of the owner speaking that they sent (videos or audio in the " +
          'Nexy folders or their raw footage), so voice-overs and AI scenes can speak in it. Only ever the owner\'s voice, and only ' +
          'when the owner asks: never anyone else\'s, whoever sends the recording. 1 to 3 minutes of clear speech, one voice, no ' +
          'music, gives the best clone. Replaces the previous clone. The owner approves it with a tap.',
        {
          sources: z.array(z.string()).describe('Paths of the recordings, as list_videos or the owner\'s message gave them.'),
        },
        async ({ sources }) => {
          const key = elevenKey()
          if (!key) return refuse('The ElevenLabs key is missing, so the voice cannot be cloned.')
          const ffmpeg = findFfmpeg()
          if (!ffmpeg) return refuse('FFmpeg is not installed on this Mac yet.')
          const list = (Array.isArray(sources) ? sources : []).slice(0, 10)
          if (!list.length) return refuse('Say which recordings to use.')
          const work = mkdtempSync(join(tmpdir(), 'nexy-voz-'))
          try {
            const form = new FormData()
            form.append('name', 'Dueño (voz propia) · Nexy')
            form.append('description', "The owner's own voice, cloned at their request from their own recordings.")
            form.append('remove_background_noise', 'true')
            let seconds = 0
            for (const [i, src] of list.entries()) {
              if (/^https:\/\//i.test(String(src))) return refuse('Use recordings the owner sent (files on this Mac), not links.')
              const file = await resolveSource(src, work, i)
              const info = await probe(ffmpeg, file)
              if (!info.audio) return refuse(`${basename(file)} has no sound.`)
              // Just the voice, mono, at most three minutes from each recording.
              const out = join(work, `muestra-${i + 1}.mp3`)
              await run(ffmpeg, ['-y', '-i', file, '-vn', '-ac', '1', '-ar', '44100', '-t', '180', '-b:a', '128k', out], 5 * 60_000)
              seconds += Math.min(180, info.duration || 0)
              form.append('files', new Blob([readFileSync(out)], { type: 'audio/mpeg' }), basename(out))
            }
            if (seconds && seconds < 20) return refuse(`Only ${Math.round(seconds)} s of speech: ask the owner for at least 30 s (1 to 3 minutes is best).`)
            const res = await fetch('https://api.elevenlabs.io/v1/voices/add', { method: 'POST', headers: { 'xi-api-key': key }, body: form })
            if (!res.ok) {
              const why = (await res.text().catch(() => '')).slice(0, 400)
              return refuse(
                `ElevenLabs did not clone the voice (HTTP ${res.status}): ${why}` +
                  (res.status === 401 || res.status === 403 ? ' Voice cloning may not be included in the owner\'s ElevenLabs plan.' : ''),
              )
            }
            const { voice_id: voiceId, requires_verification: verify } = await res.json()
            if (!voiceId) return refuse('ElevenLabs answered without a voice id.')
            mkdirSync(NEXY_DIR, { recursive: true })
            writeFileSync(OWNER_VOICE_FILE, JSON.stringify({ voiceId, fecha: new Date().toISOString(), muestras: list.length, segundos: Math.round(seconds) }, null, 2) + '\n')
            return ok(
              `The owner's voice is cloned (${Math.round(seconds)} s of recordings). Voice-overs and speak_as_owner use it from now on.` +
                (verify ? ' ElevenLabs asks the owner to verify it is their voice: tell them to open ElevenLabs → Voices and follow the steps.' : ''),
            )
          } catch (err) {
            return refuse(`Could not clone the voice: ${err?.message ?? err}`)
          } finally {
            rmSync(work, { recursive: true, force: true })
          }
        },
      ),

      tool(
        'speak_as_owner',
        "Say a line in the owner's cloned voice and save it as an audio file: for an AI scene where the owner talks (give it to " +
          "Higgsfield's lip-sync together with the scene), or for the editor as a voice-over. Only words for the owner's own " +
          'content, in the brand\'s voice; never words the owner would not say.',
        {
          text: z.string().describe('Exactly what the owner says, written the way they speak.'),
          name: z.string().optional().describe('Short file name, e.g. "reel-nxus-escena-2".'),
        },
        async ({ text, name }) => {
          const key = elevenKey()
          if (!key) return refuse('The ElevenLabs key is missing.')
          const mine = ownerVoice()
          if (!mine) return refuse("The owner's voice is not cloned yet. Ask them for a 1 to 3 minute video of them talking, then clone_owner_voice.")
          const line = String(text ?? '').trim().slice(0, 3000)
          if (!line) return refuse('Say what the line is.')
          mkdirSync(VOICE_LINES, { recursive: true })
          const file = join(VOICE_LINES, `${safeFile(name || line)}-${Date.now().toString(36)}.mp3`)
          try {
            await speak(key, mine, line, file)
          } catch (err) {
            return refuse(`Could not make the line: ${err?.message ?? err}`)
          }
          const length = await probe(findFfmpeg(), file).then((i) => i.duration).catch(() => 0)
          return ok(`Line ready in the owner's voice: ${file}${length ? ` (${length.toFixed(1)} s)` : ''}.`)
        },
      ),

      tool(
        'make_music',
        'Compose an original instrumental track (ElevenLabs Music) to fit a video\'s vibe, as long as the video, and save it ' +
          'in the owner\'s music folder for edit_video or the editor. Original, so it is free of copyright claims on Instagram, ' +
          'TikTok and YouTube. Describe the music, never an artist, band or song (those are refused): genre, mood, energy, ' +
          'tempo in BPM, instruments, how it builds and ends. It uses ElevenLabs credits, so make one track per video and ' +
          'reuse it on re-edits.',
        {
          vibe: z
            .string()
            .describe(
              'What the music sounds like, in English, e.g. "upbeat Latin house, 122 BPM, warm bass, congas and bright piano stabs, ' +
                'confident and sunny, light intro, steady groove, clean ending on the beat".',
            ),
          seconds: z.number().describe('How long: the length of the finished video, in seconds (5 to 300).'),
          name: z.string().optional().describe('Short file name, e.g. "reel-mi-semago-latin-house".'),
        },
        async ({ vibe, seconds, name }) => {
          const key = elevenKey()
          if (!key) return refuse('No ElevenLabs key is set up, so music cannot be made. Use a track from the owner\'s music folder.')
          const ms = Math.round(Math.min(300, Math.max(5, Number(seconds) || 30)) * 1000)
          const res = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
            method: 'POST',
            headers: { 'xi-api-key': key, 'content-type': 'application/json' },
            body: JSON.stringify({ prompt: String(vibe ?? '').slice(0, 2000), music_length_ms: ms, force_instrumental: true }),
          }).catch((err) => ({ ok: false, status: 0, text: async () => String(err?.message ?? err) }))
          if (!res.ok) {
            const why = (await res.text().catch(() => '')).slice(0, 500)
            return refuse(
              `ElevenLabs could not make the music (HTTP ${res.status}): ${why}` +
                (res.status === 401 || res.status === 403 ? ' Music may not be included in the owner\'s ElevenLabs plan.' : '') +
                ' If it names a suggested prompt, try again with that.',
            )
          }
          const file = join(MUSIC, `${safeFile(name || vibe)}-${Date.now().toString(36)}.mp3`)
          writeFileSync(file, Buffer.from(await res.arrayBuffer()))
          return ok(`Music ready: ${file} (${ms / 1000} s, instrumental, original). Use it as edit_video's music or give it to the editor.`)
        },
      ),

      tool(
        'get_reference_video',
        'Download the video at an Instagram, TikTok, YouTube, Facebook, X, Threads or Vimeo link the owner sent, so it ' +
          'can be watched and studied (its editing style, structure, subtitles). It is a reference only: never publish ' +
          'it or reuse its footage. The first time, this fetches the downloader (yt-dlp) and takes a little longer.',
        { url: z.string().describe('The link exactly as the owner sent it.') },
        async ({ url }) => {
          try {
            const r = await fetchReference(url, { ffmpeg: findFfmpeg() })
            return ok(
              `Downloaded to ${r.path} (${r.mb} MB${r.duration ? `, ${Math.round(r.duration)} s` : ''})` +
                `${r.title ? `. Title: ${r.title}` : ''}${r.uploader ? `. By: ${r.uploader}` : ''}. ` +
                'Reference only, not for publishing. Give this path to the editor agent to study, then save it as an editing ' +
                'mold with save_edit_style (source: the link and this path).',
            )
          } catch (err) {
            return refuse(`Could not get that video: ${err?.message ?? err}`)
          }
        },
      ),

      tool(
        'edit_video',
        EDIT_DESCRIPTION,
        {
          clips: z
            .array(
              z.object({
                source: z.string().describe('A path from list_videos or the owner’s message, or an https link.'),
                start: z.number().optional().describe('Seconds into the clip to start from.'),
                end: z.number().optional().describe('Seconds into the clip to stop at.'),
                seconds: z.number().optional().describe('For a still image: how long to show it. Default 3.'),
              }),
            )
            .describe('The clips, in order.'),
          format: z.enum(['9:16', '1:1', '4:5', '16:9', 'original']).optional().describe('Default 9:16 (Reels, TikTok, Shorts).'),
          fit: z.enum(['crop', 'pad']).optional().describe('Fill the frame by cropping (default) or fit it with bars.'),
          subtitles: z.boolean().optional().describe('Burn in subtitles from the speech. Default true.'),
          subtitle_colour: z.string().optional().describe('Hex colour for subtitle text; default white, or say "brand".'),
          font: z.string().optional().describe('Font installed on this Mac, e.g. the brand font. Default Arial.'),
          music: z.string().optional().describe('A music file from list_videos or an https link.'),
          music_volume: z.number().optional().describe('0 to 1. Default 0.15 under speech, 0.6 without.'),
          voiceover: z.string().optional().describe('Text to read over the video in the owner’s voice.'),
          logo: z.boolean().optional().describe('Put the brand logo in the corner. Default true when the brand has one.'),
          brand: z.string().optional().describe('The brand; the active one when left out.'),
          name: z.string().optional().describe('A short name for the file.'),
        },
        async (args) => {
          const ffmpeg = findFfmpeg()
          if (!ffmpeg) return refuse('FFmpeg is not installed on this Mac yet. Tell the owner it needs installing before videos can be edited.')
          const brand = args.brand ? findBrand(args.brand) : activeBrand()
          if (!brand) return refuse(`There is no brand called ${args.brand}.`)
          const clips = Array.isArray(args.clips) ? args.clips.slice(0, MAX_CLIPS) : []
          if (!clips.length) return refuse('Say which clips to use.')

          const work = mkdtempSync(join(tmpdir(), 'nexy-video-'))
          const notes = []
          try {
            // 1. Every clip to the same size, frame rate and sound, so they join cleanly.
            const sources = []
            for (const [i, c] of clips.entries()) sources.push(await resolveSource(c.source, work, i))
            const firstInfo = IMAGE_EXT.test(sources[0]) ? null : await probe(ffmpeg, sources[0])
            let [W, H] =
              args.format === 'original' && firstInfo?.width
                ? [firstInfo.width, firstInfo.height]
                : (FORMATS[args.format ?? '9:16'] ?? FORMATS['9:16'])
            W -= W % 2
            H -= H % 2
            const frame =
              args.fit === 'pad'
                ? `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`
                : `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`
            const parts = []
            let total = 0
            for (const [i, src] of sources.entries()) {
              const c = clips[i]
              const out = join(work, `part${i}.mp4`)
              const image = IMAGE_EXT.test(src)
              const info = image ? { duration: 0, audio: false } : await probe(ffmpeg, src)
              const start = Math.max(0, Number(c.start) || 0)
              const end = Number(c.end) > start ? Number(c.end) : null
              const len = image ? Math.min(30, Math.max(0.5, Number(c.seconds) || 3)) : end ? end - start : null
              const input = image ? ['-loop', '1', '-t', String(len), '-i', src] : [...(start ? ['-ss', String(start)] : []), ...(len ? ['-t', String(len)] : []), '-i', src]
              const silence = !info.audio ? ['-f', 'lavfi', '-t', String(len ?? Math.max(0.1, info.duration - start)), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'] : []
              await run(ffmpeg, [
                '-y',
                ...input,
                ...silence,
                '-vf', `${frame},setsar=1,fps=${FPS},format=yuv420p`,
                '-map', '0:v:0',
                '-map', info.audio ? '0:a:0' : '1:a:0',
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
                '-c:a', 'aac', '-ar', '48000', '-ac', '2',
                '-shortest',
                out,
              ])
              parts.push(out)
              total += (await probe(ffmpeg, out)).duration
              if (total > MAX_SECONDS) throw new Error(`the video would be over ${MAX_SECONDS / 60} minutes`)
            }
            const joined = join(work, 'joined.mp4')
            if (parts.length === 1) {
              await run(ffmpeg, ['-y', '-i', parts[0], '-c', 'copy', joined])
            } else {
              writeFileSync(join(work, 'list.txt'), parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'))
              await run(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', join(work, 'list.txt'), '-c', 'copy', joined])
            }

            // 2. Subtitles from the speech, in the brand's colour when asked.
            let subtitleFilter = ''
            if (args.subtitles !== false) {
              const key = elevenKey()
              if (!key) notes.push('No subtitles: the ElevenLabs key is missing.')
              else if (!(await hasSubtitles(ffmpeg))) notes.push('No subtitles: this FFmpeg cannot draw them.')
              else {
                const audio = join(work, 'speech.mp3')
                await run(ffmpeg, ['-y', '-i', joined, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', audio])
                const words = await transcribeWords(key, audio).catch((err) => {
                  notes.push(`No subtitles: ${err.message}.`)
                  return []
                })
                if (words.length) {
                  const colour = args.subtitle_colour === 'brand' ? (brandColour(brand.id) ?? brand.color) : /^#[0-9a-f]{6}$/i.test(args.subtitle_colour ?? '') ? args.subtitle_colour : '#FFFFFF'
                  writeFileSync(join(work, 'subs.ass'), buildAss(chunkWords(words), { width: W, height: H, font: args.font || 'Arial', colour }))
                  subtitleFilter = `,subtitles='${filterPath(join(work, 'subs.ass'))}'`
                } else if (!notes.length) notes.push('No subtitles: no speech was found.')
              }
            }

            // 3. Music, voice-over and logo, in one final pass.
            const inputs = ['-i', joined]
            let next = 1
            let musicIn = null
            let voiceIn = null
            let logoIn = null
            if (args.music) {
              const m = await resolveSource(args.music, work, 'm')
              if (!AUDIO_EXT.test(m) && !VIDEO_EXT.test(m)) throw new Error('the music must be an audio file')
              inputs.push('-stream_loop', '-1', '-i', m)
              musicIn = next++
            }
            if (args.voiceover?.trim()) {
              const key = elevenKey()
              // Always the owner's own voice: never Nexy's standing in for it.
              const mine = ownerVoice()
              if (!key) notes.push('No voice-over: the ElevenLabs key is missing.')
              else if (!mine) notes.push("No voice-over: the owner's voice is not cloned yet (clone_owner_voice).")
              else {
                const vo = join(work, 'voice.mp3')
                await speak(key, mine, args.voiceover.trim().slice(0, 3000), vo)
                inputs.push('-i', vo)
                voiceIn = next++
              }
            }
            const logo = args.logo === false ? null : readLogo(brand.id)
            if (logo) {
              inputs.push('-i', logo)
              logoIn = next++
            } else if (args.logo === true) notes.push(`No logo: ${brand.nombre} has no logo saved yet.`)

            const speech = (await probe(ffmpeg, joined)).audio
            const graph = [`[0:v]null${subtitleFilter}[v1]`]
            if (logoIn !== null) {
              graph.push(`[${logoIn}:v]scale=${Math.round(W * 0.18)}:-1[lg]`, `[v1][lg]overlay=W-w-${Math.round(W * 0.04)}:${Math.round(W * 0.04)}[vout]`)
            } else graph.push('[v1]null[vout]')
            const mix = [`[0:a]volume=${voiceIn !== null ? 0.35 : 1}[a0]`]
            const mixIn = ['[a0]']
            if (musicIn !== null) {
              const vol = Math.min(1, Math.max(0, Number(args.music_volume) || (speech || voiceIn !== null ? 0.15 : 0.6)))
              mix.push(`[${musicIn}:a]volume=${vol}[am]`)
              mixIn.push('[am]')
            }
            if (voiceIn !== null) {
              mix.push(`[${voiceIn}:a]volume=1.0[av]`)
              mixIn.push('[av]')
            }
            graph.push(...mix, `${mixIn.join('')}amix=inputs=${mixIn.length}:duration=first:dropout_transition=0:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`)

            const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
            const safeName = String(args.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
            const out = join(DONE, `${brand.id}-${stamp}${safeName ? `-${safeName}` : ''}.mp4`)
            mkdirSync(DONE, { recursive: true })
            await run(ffmpeg, [
              '-y',
              ...inputs,
              '-filter_complex', graph.join(';'),
              '-map', '[vout]', '-map', '[aout]',
              '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
              '-c:a', 'aac', '-b:a', '160k',
              '-movflags', '+faststart',
              out,
            ])
            const final = await probe(ffmpeg, out)
            const size = statSync(out).size
            console.log(`[jarvis] video: made ${basename(out)} (${final.duration.toFixed(1)} s)`)
            return ok(
              `Finished: ${out}\n${final.duration.toFixed(1)} seconds, ${W}x${H}, ${(size / 1048576).toFixed(1)} MB` +
                `${subtitleFilter ? ', with subtitles' : ''}${musicIn !== null ? ', with music' : ''}${voiceIn !== null ? ', with voice-over' : ''}${logoIn !== null ? ', with logo' : ''}.` +
                (notes.length ? `\n${notes.join('\n')}` : ''),
            )
          } catch (err) {
            console.log(`[jarvis] video: edit failed: ${err?.message ?? err}`)
            return refuse(`The video could not be made: ${String(err?.message ?? err).slice(0, 300)}`)
          } finally {
            rmSync(work, { recursive: true, force: true })
          }
        },
      ),
    ],
  })
}
