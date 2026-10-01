import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { closeSync, copyFileSync, mkdirSync, openSync, readSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join, sep } from 'node:path'
import { DONE, VIDEO_DIR, findFfmpeg, probe, resolveSource, run, transcribeWords } from './video.mjs'
import { onDisk, prefetch } from './raw.mjs'

/**
 * The editing workshop: any edit the owner can describe, not just a recipe.
 *
 * Each job is a project folder under ~/Movies/Nexy/taller. Clips are copied
 * in first; after that FFmpeg runs with whatever arguments the editing agent
 * writes — cuts, speed ramps, zooms, crops, colour, overlays, transitions,
 * audio clean-up — but always inside that folder:
 *
 *   - it runs with the project folder as its working directory, and every
 *     file it reads or writes is named relative to it;
 *   - arguments naming an absolute path (except the system font folders),
 *     a parent folder (..), a home folder (~) or a network or special
 *     protocol are refused before FFmpeg starts;
 *   - there is no shell: the arguments go to FFmpeg as a list.
 *
 * So the agent has the whole of FFmpeg and nothing else on this Mac. Finished
 * work is copied out to ~/Movies/Nexy/listos with export_video.
 */

export const WORKSHOP = join(VIDEO_DIR, 'taller')

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })

const PROJECT = /^[a-z0-9][a-z0-9-]{0,39}$/
const FILE = /^[\w][\w.-]{0,79}$/

/** An absolute path (not a font), a way up (..), a home path (~), or a protocol. */
const ABSOLUTE = /(^|[=:,;'"\s[(])\/(?!(System\/Library\/Fonts|Library\/Fonts)\/)/
const PROTOCOL =
  /\b(file|https?|ftp|pipe|tcp|udp|rtmp[a-z]*|rtsp|srt|concat|subfile|data|crypto|async|cache|tee|unix|fd|gopher|smb|sftp|icecast|hls|mmsh?|zmq)\s*:/i
const FORBIDDEN_OPTIONS = new Set(['-protocol_whitelist', '-protocol_blacklist', '-safe', '-dump_attachment', '-attach', '-report', '-vstats_file', '-passlogfile', '-sdp_file', '-progress'])

/** Why an FFmpeg argument list is refused, or null when it may run. */
export function vetArgs(args) {
  if (!Array.isArray(args) || !args.length) return 'give the FFmpeg arguments as a list'
  if (args.length > 400) return 'too many arguments'
  for (const raw of args) {
    const a = String(raw)
    if (a.length > 30_000) return 'an argument is too long'
    if (FORBIDDEN_OPTIONS.has(a)) return `${a} is not allowed`
    if (a.includes('..')) return 'paths may not go up a folder (..): use file names from the project'
    if (/(^|[=:,;'"\s])~/.test(a)) return 'no home paths (~): use file names from the project'
    if (ABSOLUTE.test(a)) {
      return 'no absolute paths: use file names from the project (fonts may come from /System/Library/Fonts or /Library/Fonts)'
    }
    if (PROTOCOL.test(a)) return 'no network or special protocols: add sources with add_to_project first'
  }
  // Every input is a media file from the project, a generated source (-f lavfi)
  // or a concat list (-f concat): nothing that could point FFmpeg elsewhere.
  for (let i = 0; i < args.length; i++) {
    if (String(args[i]) !== '-i') continue
    const input = String(args[i + 1] ?? '')
    const fmt = String(args[i - 1] ?? '') && String(args[i - 2]) === '-f' ? String(args[i - 1]) : null
    if (fmt === 'lavfi') continue
    if (fmt === 'concat' && /\.txt$/i.test(input)) continue
    if (!MEDIA.test(input)) return `the input "${input}" is not a media file in the project`
  }
  return null
}

const MEDIA = /^[\w][\w.-]*\.(mp4|mov|m4v|webm|mkv|avi|jpe?g|png|webp|gif|mp3|m4a|aac|wav|ogg|oga|flac)$/i

function projectDir(name, create = false) {
  const p = String(name ?? '').toLowerCase().trim()
  if (!PROJECT.test(p)) throw new Error('project names are lowercase letters, numbers and dashes')
  const dir = join(WORKSHOP, p)
  if (create) mkdirSync(dir, { recursive: true })
  const real = realpathSync(dir)
  if (!real.startsWith(realpathSync(WORKSHOP) + sep)) throw new Error('bad project')
  return real
}

/** A file inside a project, by name. */
function projectFile(dir, name) {
  const n = String(name ?? '').trim()
  if (!FILE.test(n)) throw new Error(`"${n}" is not a file name in the project`)
  return join(dir, n)
}

const listing = (dir) =>
  readdirSync(dir)
    .filter((f) => !f.startsWith('.'))
    .map((f) => `${f} (${(statSync(join(dir, f)).size / 1048576).toFixed(1)} MB)`)
    .join(', ') || '(empty)'

const tail = (log, lines = 25) =>
  log
    .split('\n')
    .filter((l) => l.trim() && !/^\s*(frame=|size=|Press \[q\])/.test(l))
    .slice(-lines)
    .join('\n')

const safeName = (s, fallback) =>
  (basename(String(s ?? '')).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || fallback)

/** Where the speech is: stretches louder than the threshold, padded, with short gaps merged. */
export function keepSegments(silences, duration, padding = 0.1, minKeep = 0.25) {
  const keep = []
  let cursor = 0
  for (const [s, e] of silences) {
    const end = Math.min(duration, s + padding)
    if (end - cursor > minKeep) keep.push([cursor, end])
    cursor = Math.max(cursor, e - padding)
  }
  if (duration - cursor > minKeep) keep.push([cursor, duration])
  return keep
}

export function workshopServer(elevenKey) {
  try {
    mkdirSync(WORKSHOP, { recursive: true })
  } catch {
    // Reported when used.
  }
  const need = () => {
    const f = findFfmpeg()
    if (!f) throw new Error('FFmpeg is not installed on this Mac yet')
    return f
  }
  const guard = (fn) => async (args) => {
    try {
      return await fn(args)
    } catch (err) {
      console.log(`[jarvis] taller: ${err?.message ?? err}`)
      return refuse(String(err?.message ?? err).slice(0, 500))
    }
  }

  return createSdkMcpServer({
    name: 'jarvis_taller',
    version: '1.0.0',
    instructions: 'The video editing workshop: projects, FFmpeg inside them, and ways to see and hear the footage.',
    alwaysLoad: true,
    tools: [
      tool(
        'add_to_project',
        'Start or extend an editing project: copy clips, images, music or logos into it (from list_videos, files the ' +
          'owner sent, brand logos, or public https links such as Higgsfield results). Returns the file names to use.',
        {
          project: z.string().describe('Short name, lowercase with dashes, e.g. "reel-nxus-octubre".'),
          sources: z.array(z.string()).describe('Paths or https links.'),
        },
        guard(async ({ project, sources }) => {
          const ffmpeg = need()
          const dir = projectDir(project, true)
          const work = mkdtempSync(join(tmpdir(), 'nexy-taller-'))
          const added = []
          const pending = []
          try {
            for (const [i, src] of (sources ?? []).slice(0, 30).entries()) {
              const file = await resolveSource(src, work, i)
              // Still in the cloud: start the download and come back, rather
              // than wait minutes on a copy that downloads it first.
              const size = statSync(file).size
              if (size > 50 * 1024 * 1024 && onDisk(file) < 0.98) {
                pending.push(`${basename(file)} (${Math.round(size / 1048576)} MB, ${Math.round(prefetch(file) * 100)}% downloaded)`)
                continue
              }
              const ext = extname(file).toLowerCase() || '.mp4'
              let name = `${safeName(file, `clip${i + 1}`)}${ext}`
              for (let n = 2; readdirSync(dir).includes(name); n++) name = `${safeName(file, 'clip')}-${n}${ext}`
              // A playlist dressed up as a video could point FFmpeg at other files.
              // Only the first bytes: raw footage can be gigabytes.
              const head = Buffer.alloc(16)
              const fd = openSync(file, 'r')
              try {
                readSync(fd, head, 0, 16, 0)
              } finally {
                closeSync(fd)
              }
              if (/^#EXT(M3U|INF)/i.test(head.toString('latin1'))) throw new Error(`${src} is a playlist, not a media file`)
              // Copied without blocking: a large file from Drive downloads as it
              // copies, and Nexy must keep answering meanwhile.
              await copyFile(file, join(dir, name))
              const info = await probe(ffmpeg, join(dir, name))
              added.push(`${name}${info.duration ? ` — ${info.duration.toFixed(1)} s` : ''}${info.width ? `, ${info.width}x${info.height}` : ''}${info.audio ? ', with sound' : ''}`)
            }
          } finally {
            rmSync(work, { recursive: true, force: true })
          }
          const wait = pending.length
            ? `\nNot added yet — still downloading from Google Drive, which takes a while for big videos: ${pending.join('; ')}. ` +
              'Tell the owner, and suggest they right-click the raw footage folder in Finder → "Make available offline" so Drive keeps it on the Mac. ' +
              'Try these files again in a few minutes, or work with the files already added.'
            : ''
          return ok(`Project ${project}:\n${added.map((a) => `- ${a}`).join('\n') || '(nothing added yet)'}${wait}\nAll files: ${listing(dir)}`)
        }),
      ),

      tool(
        'ffmpeg',
        'Run FFmpeg inside a project, with any arguments: cut, trim, concat, speed, zoom, crop, scale, colour, ' +
          'overlays, text, transitions (xfade), audio mixing and clean-up. Name files by their names in the project, ' +
          'never paths; write each result as a new file. -y is added. Re-encode video with libx264 -pix_fmt yuv420p ' +
          'and audio with aac. Fonts can be given as /System/Library/Fonts/... paths.',
        {
          project: z.string(),
          args: z.array(z.string()).describe('The arguments after "ffmpeg", e.g. ["-i","clip1.mp4","-vf","scale=1080:-2","out.mp4"].'),
        },
        guard(async ({ project, args }) => {
          const ffmpeg = need()
          const dir = projectDir(project)
          const why = vetArgs(args)
          if (why) return refuse(`Not run: ${why}.`)
          const log = await run(ffmpeg, ['-y', ...args.map(String)], 20 * 60_000, true, dir)
          const failed = /Error|Invalid|No such file|not found|Conversion failed/i.test(tail(log, 6))
          const missing = log.match(/No such filter: '([\w]+)'/)?.[1]
          const hint = missing
            ? `\nThis FFmpeg has no ${missing} filter.${missing === 'drawtext' ? ' Put text on with an .ass file (write_project_text) and the subtitles filter instead.' : ' Use another filter for it.'}`
            : ''
          return (failed ? refuse : ok)(`${failed ? 'FFmpeg reported a problem' : 'Done'}. Last lines:\n${tail(log)}${hint}\nFiles: ${listing(dir)}`)
        }),
      ),

      tool(
        'media_info',
        'Duration, size, frame rate and streams of a file in a project. Add silences:true to list its silent stretches, ' +
          'and cuts:true to find every cut (shot change) with its time and the average shot length — the rhythm of an edit.',
        {
          project: z.string(),
          file: z.string(),
          silences: z.boolean().optional(),
          threshold_db: z.number().optional().describe('Silence threshold in dB, default -35.'),
          cuts: z.boolean().optional(),
        },
        guard(async ({ project, file, silences, threshold_db, cuts }) => {
          const ffmpeg = need()
          const dir = projectDir(project)
          const path = projectFile(dir, file)
          const report = await run(ffmpeg, ['-i', basename(path)], 30_000, true, dir)
          let lines = report.split('\n').filter((l) => /Duration|Stream/.test(l)).join('\n')
          if (cuts) {
            const log = await run(ffmpeg, ['-i', basename(path), '-an', '-vf', "select='gt(scene,0.3)',showinfo", '-f', 'null', '-'], 10 * 60_000, true, dir)
            const times = [...log.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]))
            const d = log.match(/Duration: (\d+):(\d+):([\d.]+)/)
            const total = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0
            const shots = times.length + 1
            lines +=
              `\nCuts (${times.length}): ${times.map((t) => t.toFixed(2)).join(', ') || 'none — one continuous shot'}` +
              (total ? `\nAverage shot: ${(total / shots).toFixed(2)} s over ${total.toFixed(1)} s` : '')
          }
          if (!silences) return ok(lines)
          const log = await run(ffmpeg, ['-i', basename(path), '-af', `silencedetect=n=${threshold_db ?? -35}dB:d=0.35`, '-f', 'null', '-'], 10 * 60_000, true, dir)
          const found = [...log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => `${Number(m[1]).toFixed(2)}–${Number(m[2]).toFixed(2)} s`)
          return ok(`${lines}\nSilences (${found.length}): ${found.join(', ') || 'none'}`)
        }),
      ),

      tool(
        'remove_silences',
        'Cut out the pauses and dead air ("quita los silencios / los gaps"), keeping a little breath around each ' +
          'phrase. Makes a new file in the project and reports what was cut.',
        {
          project: z.string(),
          file: z.string(),
          output: z.string().optional().describe('Name for the result. Default <name>-sin-silencios.mp4.'),
          threshold_db: z.number().optional().describe('Quieter than this is silence. Default -35; use -30 for noisy rooms.'),
          min_silence: z.number().optional().describe('Only cut pauses longer than this, in seconds. Default 0.4.'),
          padding: z.number().optional().describe('Seconds kept either side of speech. Default 0.12.'),
        },
        guard(async ({ project, file, output, threshold_db, min_silence, padding }) => {
          const ffmpeg = need()
          const dir = projectDir(project)
          const src = basename(projectFile(dir, file))
          const out = output ? basename(projectFile(dir, output)) : `${safeName(src, 'video')}-sin-silencios.mp4`
          const info = await probe(ffmpeg, join(dir, src))
          if (!info.audio) return refuse('That file has no sound, so there are no silences to find.')
          const d = Math.min(5, Math.max(0.15, Number(min_silence) || 0.4))
          const log = await run(ffmpeg, ['-i', src, '-af', `silencedetect=n=${Number(threshold_db) || -35}dB:d=${d}`, '-f', 'null', '-'], 10 * 60_000, true, dir)
          const silences = []
          let open = null
          for (const line of log.split('\n')) {
            const s = line.match(/silence_start: ([\d.]+)/)
            const e = line.match(/silence_end: ([\d.]+)/)
            if (s) open = Number(s[1])
            if (e && open !== null) {
              silences.push([open, Number(e[1])])
              open = null
            }
          }
          if (open !== null) silences.push([open, info.duration])
          if (!silences.length) return ok('No pauses long enough to cut were found. Try a higher threshold_db (e.g. -30) or a shorter min_silence.')
          const keep = keepSegments(silences, info.duration, Math.min(0.5, Math.max(0, Number(padding) || 0.12)))
          if (!keep.length) return refuse('Everything sounded like silence at that threshold. Try a lower threshold_db (e.g. -45).')
          const hasVideo = info.width > 0
          const graph = keep
            .map(([a, b], i) =>
              (hasVideo ? `[0:v]trim=start=${a.toFixed(3)}:end=${b.toFixed(3)},setpts=PTS-STARTPTS[v${i}];` : '') +
              `[0:a]atrim=start=${a.toFixed(3)}:end=${b.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`,
            )
            .join(';')
          const joins = keep.map((_, i) => (hasVideo ? `[v${i}][a${i}]` : `[a${i}]`)).join('')
          const concat = `${joins}concat=n=${keep.length}:v=${hasVideo ? 1 : 0}:a=1${hasVideo ? '[v]' : ''}[a]`
          writeFileSync(join(dir, '.cortes.txt'), `${graph};${concat}`)
          await run(
            ffmpeg,
            [
              '-y', '-i', src,
              '-filter_complex_script', '.cortes.txt',
              ...(hasVideo ? ['-map', '[v]'] : []), '-map', '[a]',
              ...(hasVideo ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p'] : []),
              '-c:a', 'aac', '-b:a', '160k', out,
            ],
            20 * 60_000,
            false,
            dir,
          )
          const after = await probe(ffmpeg, join(dir, out))
          return ok(`Made ${out}: ${info.duration.toFixed(1)} s → ${after.duration.toFixed(1)} s, ${silences.length} pause${silences.length === 1 ? '' : 's'} cut.`)
        }),
      ),

      tool(
        'transcribe',
        'What is said in a file, word by word with times — to cut filler words, retakes or a given sentence, or to ' +
          'write subtitles. Returns lines of "start–end word".',
        { project: z.string(), file: z.string() },
        guard(async ({ project, file }) => {
          const ffmpeg = need()
          const key = elevenKey()
          if (!key) return refuse('The ElevenLabs key is missing, so nothing can be transcribed.')
          const dir = projectDir(project)
          const src = basename(projectFile(dir, file))
          await run(ffmpeg, ['-y', '-i', src, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', '.voz.mp3'], 10 * 60_000, false, dir)
          const words = await transcribeWords(key, join(dir, '.voz.mp3'))
          if (!words.length) return ok('No speech found.')
          const text = words.map((w) => w.text).join(' ')
          const timed = words.map((w) => `${w.start.toFixed(2)}–${w.end.toFixed(2)} ${w.text}`).join('\n')
          return ok(`Text: ${text}\n\nWords:\n${timed}`.slice(0, 60_000))
        }),
      ),

      tool(
        'look_at',
        'See frames of a video at given seconds, to check framing, what happens where, or your own edit before ' +
          'exporting. Up to six frames.',
        {
          project: z.string(),
          file: z.string(),
          seconds: z.array(z.number()).describe('Times to look at, in seconds.'),
        },
        guard(async ({ project, file, seconds }) => {
          const ffmpeg = need()
          const dir = projectDir(project)
          const src = basename(projectFile(dir, file))
          const blocks = []
          for (const [i, t] of (seconds ?? []).slice(0, 6).entries()) {
            const frame = `.cuadro${i}.jpg`
            await run(ffmpeg, ['-y', '-ss', String(Math.max(0, Number(t) || 0)), '-i', src, '-frames:v', '1', '-vf', 'scale=512:-2', '-q:v', '4', frame], 60_000, false, dir)
            blocks.push({ type: 'text', text: `At ${Number(t).toFixed(2)} s:` })
            blocks.push({ type: 'image', data: readFileSync(join(dir, frame)).toString('base64'), mimeType: 'image/jpeg' })
            rmSync(join(dir, frame), { force: true })
          }
          return blocks.length ? { content: blocks } : refuse('Say which seconds to look at.')
        }),
      ),

      tool(
        'write_project_text',
        'Write a text file into a project: subtitles (.ass, .srt, .vtt), a concat list or a filter script (.txt).',
        {
          project: z.string(),
          name: z.string().describe('e.g. subs.ass, lista.txt'),
          content: z.string(),
        },
        guard(async ({ project, name, content }) => {
          const dir = projectDir(project)
          const n = String(name ?? '')
          if (!/^[\w-]{1,60}\.(ass|srt|vtt|txt)$/.test(n)) return refuse('Text files must be .ass, .srt, .vtt or .txt with a simple name.')
          const body = String(content ?? '')
          if (body.length > 500_000) return refuse('That is too long.')
          // A concat list or script is read by FFmpeg, so it is held to the same rules as its arguments.
          const why = vetArgs(body.split('\n').filter((l) => l.trim()))
          if (why && n.endsWith('.txt')) return refuse(`Not written: ${why}.`)
          writeFileSync(join(dir, n), body)
          return ok(`Wrote ${n}.`)
        }),
      ),

      tool(
        'export_video',
        'Copy a finished file out of the project to the owner’s finished folder, ready to send or publish.',
        { project: z.string(), file: z.string(), name: z.string().optional() },
        guard(async ({ project, file, name }) => {
          const ffmpeg = need()
          const dir = projectDir(project)
          const src = projectFile(dir, file)
          const ext = extname(src).toLowerCase() || '.mp4'
          const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
          mkdirSync(DONE, { recursive: true })
          const out = join(DONE, `${stamp}-${safeName(name || project, 'video')}${ext}`)
          copyFileSync(src, out)
          const info = await probe(ffmpeg, out)
          console.log(`[jarvis] taller: exported ${basename(out)}`)
          return ok(`Exported: ${out}\n${info.duration.toFixed(1)} s, ${info.width}x${info.height}, ${(statSync(out).size / 1048576).toFixed(1)} MB.`)
        }),
      ),
    ],
  })
}
