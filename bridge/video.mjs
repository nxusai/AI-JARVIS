import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { basename, extname, join, sep } from 'node:path'
import { activeBrand, findBrand, readLogo, readManual } from './brands.mjs'
import { vetTarget } from './net.mjs'

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
 *
 * FFmpeg is the Homebrew one when installed, otherwise the copy npm put in
 * node_modules (ffmpeg-static), or NEXY_FFMPEG.
 */

export const VIDEO_DIR = join(homedir(), 'Movies', 'Nexy')
export const INBOX = join(VIDEO_DIR, 'entrada')
export const MUSIC = join(VIDEO_DIR, 'musica')
export const DONE = join(VIDEO_DIR, 'listos')
const NEXY_DIR = join(homedir(), '.nexy')

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
  return out
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
  'Higgsfield results). Use music only from the owner’s music folder or links they gave. Returns the finished ' +
  'file; show it to the owner before publishing it.'

export function videoServer(elevenKey, voiceId) {
  for (const d of [INBOX, MUSIC, DONE]) {
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
        ]
        return ok(parts.join('\n'))
      }),

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
              if (!key) notes.push('No voice-over: the ElevenLabs key is missing.')
              else {
                const vo = join(work, 'voice.mp3')
                await speak(key, voiceId, args.voiceover.trim().slice(0, 3000), vo)
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
            graph.push(...mix, `${mixIn.join('')}amix=inputs=${mixIn.length}:duration=first:dropout_transition=0:normalize=0[aout]`)

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
