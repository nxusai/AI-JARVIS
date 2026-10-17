import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The Reels studio's engine: everything that turns a raw talking-head
 * recording into a finished reel, with no model in the loop.
 *
 *   transcribe   words with times (whisper.cpp on this Mac, or ElevenLabs Scribe)
 *   silences     FFmpeg's silencedetect
 *   plan         which parts of each recording stay: speech, minus long
 *                pauses, filler sounds ("eh", "mmm") and whatever the editor
 *                asked to drop (a retake, a bad start)
 *   captions     an ASS file: word by word with the spoken word highlighted,
 *                a pop-in per phrase, or plain phrases; plus a hook title
 *   render       one FFmpeg run: cuts, 9:16 framing, punch-in zooms, colour,
 *                captions, voice levelled to Instagram's loudness, music
 *                ducked under the voice
 *
 * A style is plain data (see DEFAULT_STYLE), so the same recording can be
 * re-rendered with a tweak ("bigger captions", "fewer zooms") in seconds,
 * without transcribing again. FFmpeg always runs with argument lists built
 * here, never a shell.
 */

export const FPS = 30
export const FORMATS = { '9:16': [1080, 1920], '4:5': [1080, 1350], '1:1': [1080, 1080], '16:9': [1920, 1080] }

/** What every style starts from; a saved style only says what it changes. */
export const DEFAULT_STYLE = {
  formato: '9:16',
  // cover: fill the frame (talking head); blur: the whole picture over a blurred copy of itself (screen recordings, tutorials).
  encuadre: { modo: 'cover', x: 0.5, y: 0.4 },
  cortes: {
    activo: true,
    // Quieter than this is silence.
    silencioDb: -34,
    // Pauses longer than this are cut (seconds).
    pausaMax: 0.35,
    // Air kept either side of each cut, so words are not clipped.
    margen: 0.08,
    quitarMuletillas: true,
    // Pieces shorter than this are dropped.
    minimo: 0.3,
  },
  zoom: {
    activo: true,
    // golpe: an instant punch-in on the cut; suave: a slow push through the piece.
    tipo: 'golpe',
    escala: 1.12,
    // Every how many pieces the punch-in comes back (2 = every other piece).
    cada: 2,
  },
  subtitulos: {
    activo: true,
    // palabra: the phrase on screen with the spoken word highlighted; pop: each phrase pops in; frase: plain phrases.
    animacion: 'palabra',
    fuente: 'Arial Black',
    // Size as a share of the frame's width.
    tamano: 0.075,
    color: '#FFFFFF',
    resaltado: '#FFD400',
    contorno: '#000000',
    grosor: 0.12,
    sombra: true,
    // Where the captions sit, from the top (0) to the bottom (1).
    altura: 0.68,
    palabras: 3,
    mayusculas: true,
  },
  titulo: {
    activo: true,
    segundos: 3,
    fuente: 'Arial Black',
    tamano: 0.07,
    color: '#FFFFFF',
    fondo: '#000000',
    altura: 0.14,
    mayusculas: true,
  },
  color: { contraste: 1.05, saturacion: 1.1, brillo: 0 },
  audio: { lufs: -14, limpiar: true },
  musica: { volumen: 0.12, ducking: true },
}

// -- styles -----------------------------------------------------------------

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

/** `over` laid onto `base`, key by key, keeping only keys `base` knows and values of the same kind. */
export function mergeStyle(base, over) {
  if (!isObj(over)) return structuredClone(base)
  const out = structuredClone(base)
  for (const [k, v] of Object.entries(over)) {
    if (!(k in base)) continue
    if (isObj(base[k])) out[k] = mergeStyle(base[k], v)
    else if (typeof v === typeof base[k]) out[k] = v
    else if (typeof base[k] === 'number' && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) out[k] = Number(v)
  }
  return out
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo))
const HEX = /^#[0-9a-f]{6}$/i

/** A style with every number in a range that renders, and every colour a colour. */
export function settle(style) {
  const s = mergeStyle(DEFAULT_STYLE, style)
  if (!FORMATS[s.formato]) s.formato = '9:16'
  if (!['cover', 'blur'].includes(s.encuadre.modo)) s.encuadre.modo = 'cover'
  s.encuadre.x = clamp(s.encuadre.x, 0, 1)
  s.encuadre.y = clamp(s.encuadre.y, 0, 1)
  s.cortes.silencioDb = clamp(s.cortes.silencioDb, -60, -15)
  s.cortes.pausaMax = clamp(s.cortes.pausaMax, 0.15, 3)
  s.cortes.margen = clamp(s.cortes.margen, 0, 0.4)
  s.cortes.minimo = clamp(s.cortes.minimo, 0.1, 2)
  if (!['golpe', 'suave'].includes(s.zoom.tipo)) s.zoom.tipo = 'golpe'
  s.zoom.escala = clamp(s.zoom.escala, 1, 1.6)
  s.zoom.cada = Math.round(clamp(s.zoom.cada, 1, 10))
  if (!['palabra', 'pop', 'frase'].includes(s.subtitulos.animacion)) s.subtitulos.animacion = 'palabra'
  s.subtitulos.tamano = clamp(s.subtitulos.tamano, 0.03, 0.15)
  s.subtitulos.grosor = clamp(s.subtitulos.grosor, 0, 0.4)
  s.subtitulos.altura = clamp(s.subtitulos.altura, 0.1, 0.92)
  s.subtitulos.palabras = Math.round(clamp(s.subtitulos.palabras, 1, 8))
  s.titulo.segundos = clamp(s.titulo.segundos, 0.5, 10)
  s.titulo.tamano = clamp(s.titulo.tamano, 0.03, 0.15)
  s.titulo.altura = clamp(s.titulo.altura, 0.05, 0.9)
  for (const [o, k] of [
    [s.subtitulos, 'color'],
    [s.subtitulos, 'resaltado'],
    [s.subtitulos, 'contorno'],
    [s.titulo, 'color'],
    [s.titulo, 'fondo'],
  ]) {
    if (!HEX.test(o[k])) o[k] = DEFAULT_STYLE[o === s.titulo ? 'titulo' : 'subtitulos'][k]
  }
  s.color.contraste = clamp(s.color.contraste, 0.5, 1.6)
  s.color.saturacion = clamp(s.color.saturacion, 0, 2)
  s.color.brillo = clamp(s.color.brillo, -0.3, 0.3)
  s.audio.lufs = clamp(s.audio.lufs, -24, -9)
  s.musica.volumen = clamp(s.musica.volumen, 0, 1)
  for (const k of ['fuente']) {
    s.subtitulos[k] = String(s.subtitulos[k]).replace(/[^\p{L}\p{N} .-]/gu, '').slice(0, 60) || 'Arial Black'
    s.titulo[k] = String(s.titulo[k]).replace(/[^\p{L}\p{N} .-]/gu, '').slice(0, 60) || 'Arial Black'
  }
  return s
}

// -- FFmpeg -----------------------------------------------------------------

/** FFmpeg with an argument list (no shell); resolves with what it printed. */
export function ffmpeg(bin, args, { ms = 30 * 60_000, anyExit = false, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'pipe', 'pipe'], cwd })
    let log = ''
    const take = (d) => (log = (log + d).slice(-400_000))
    child.stdout.on('data', take)
    child.stderr.on('data', take)
    const timer = setTimeout(() => child.kill('SIGKILL'), ms)
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 || anyExit) resolve(log)
      else reject(new Error(log.split('\n').filter(Boolean).slice(-4).join(' | ') || `ffmpeg exited ${code}`))
    })
  })
}

/** Duration, size, rotation and whether there is sound, from FFmpeg's own report. */
export async function probe(bin, file) {
  const log = await ffmpeg(bin, ['-i', file], { ms: 30_000, anyExit: true }).catch(() => '')
  const d = log.match(/Duration: (\d+):(\d+):([\d.]+)/)
  const v = log.match(/Video: .*?, (\d{2,5})x(\d{2,5})/)
  const rot = Number(log.match(/rotation of (-?[\d.]+)/)?.[1] ?? log.match(/rotate\s*:\s*(-?\d+)/)?.[1] ?? 0)
  let [width, height] = v ? [Number(v[1]), Number(v[2])] : [0, 0]
  // Phones store portrait video as landscape plus a rotation; FFmpeg turns it upright when decoding.
  if (Math.abs(rot) % 180 === 90) [width, height] = [height, width]
  return { duration: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0, width, height, audio: /Audio: /.test(log), video: !!v }
}

/** Silent stretches of a recording: [{ start, end }] in seconds. */
export async function detectSilences(bin, file, db = -34, min = 0.25) {
  const log = await ffmpeg(bin, ['-i', file, '-vn', '-af', `silencedetect=noise=${db}dB:d=${min}`, '-f', 'null', '-'], { ms: 10 * 60_000 })
  return parseSilences(log)
}

export function parseSilences(log) {
  const out = []
  let start = null
  for (const m of log.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    if (m[1] === 'start') start = Math.max(0, Number(m[2]))
    else if (start !== null) {
      out.push({ start, end: Number(m[2]) })
      start = null
    }
  }
  // Silence running to the end of the file has no end line.
  if (start !== null) out.push({ start, end: Infinity })
  return out
}

// -- transcription ----------------------------------------------------------

/** The studio's own data: styles, the owner's taste, projects and the whisper models. */
export const REELS_DATA = join(homedir(), '.nexy', 'reels')
export const MODELS = join(REELS_DATA, 'modelos')

/** whisper.cpp's command line (Homebrew's whisper-cpp), or null. */
export function findWhisper() {
  const env = process.env.NEXY_WHISPER
  return [env, '/opt/homebrew/bin/whisper-cli', '/usr/local/bin/whisper-cli', '/opt/homebrew/bin/whisper-cpp', '/usr/local/bin/whisper-cpp'].find((p) => p && existsSync(p)) ?? null
}

/** The whisper model to use: NEXY_WHISPER_MODEL, else the best ggml file in ~/.nexy/reels/modelos. */
export function findWhisperModel() {
  const env = process.env.NEXY_WHISPER_MODEL
  if (env && existsSync(env)) return env
  let files = []
  try {
    files = readdirSync(MODELS).filter((f) => /^ggml-.*\.bin$/.test(f))
  } catch {
    return null
  }
  const rank = (f) => ['large-v3-turbo', 'large-v3', 'large', 'medium', 'small', 'base', 'tiny'].findIndex((k) => f.includes(k))
  files.sort((a, b) => (rank(a) < 0 ? 99 : rank(a)) - (rank(b) < 0 ? 99 : rank(b)))
  return files[0] ? join(MODELS, files[0]) : null
}

/** whisper.cpp's JSON (one word per segment, from -ml 1 -sow) as [{ text, start, end }]. */
export function parseWhisperJson(json) {
  const words = []
  for (const seg of json?.transcription ?? []) {
    const text = String(seg.text ?? '').trim()
    if (!text || /^\[.*\]$/.test(text) || /^[\p{P}\s]+$/u.test(text)) {
      // Punctuation on its own belongs to the word before it.
      if (text && words.length && /^[\p{P}]+$/u.test(text)) words[words.length - 1].text += text
      continue
    }
    const start = Number(seg.offsets?.from) / 1000
    const end = Number(seg.offsets?.to) / 1000
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) words.push({ text, start, end })
  }
  return words
}

function runWhisper(bin, args, ms) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let err = ''
    child.stdout.on('data', () => {})
    child.stderr.on('data', (d) => (err = (err + d).slice(-8000)))
    const timer = setTimeout(() => child.kill('SIGKILL'), ms)
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(err.split('\n').filter(Boolean).slice(-2).join(' | ') || `whisper exited ${code}`))
    })
  })
}

/**
 * The words of a recording with their times, and which engine heard them.
 * whisper.cpp first (free, private, fast on Apple silicon), ElevenLabs Scribe
 * when there is a key and no local model, nothing (cuts without captions)
 * when there is neither.
 */
export async function transcribe(bin, file, { elevenKey = null, elevenTranscribe = null, language = process.env.NEXY_REELS_IDIOMA || 'es' } = {}) {
  const whisper = findWhisper()
  const model = findWhisperModel()
  const work = mkdtempSync(join(tmpdir(), 'nexy-reels-'))
  try {
    if (whisper && model) {
      const wav = join(work, 'voz.wav')
      await ffmpeg(bin, ['-y', '-i', file, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav], { ms: 10 * 60_000 })
      const base = join(work, 'voz')
      await runWhisper(whisper, ['-m', model, '-f', wav, '-l', language, '-ml', '1', '-sow', '-oj', '-of', base, '-np'], 30 * 60_000)
      return { words: parseWhisperJson(JSON.parse(readFileSync(`${base}.json`, 'utf8'))), engine: 'whisper' }
    }
    if (elevenKey && elevenTranscribe) {
      const mp3 = join(work, 'voz.mp3')
      await ffmpeg(bin, ['-y', '-i', file, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '96k', mp3], { ms: 10 * 60_000 })
      const words = (await elevenTranscribe(elevenKey, mp3)).map((w) => ({ text: String(w.text).trim(), start: w.start, end: w.end }))
      return { words, engine: 'elevenlabs' }
    }
    return { words: [], engine: null }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

// -- the cut plan -----------------------------------------------------------

/** Sounds that are only hesitation, in Spanish and English. */
const FILLER = /^(e+h*|e+m+|e+h+m+|m+|m+h*m+|u+h*m*|a+h+|ah+m+|uh+|hmm+|mju)$/i
const bare = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}]/gu, '')
export const isFiller = (text) => {
  const b = bare(text)
  return b.length > 0 && FILLER.test(b)
}

/** Ranges sorted and joined where they touch. */
export function joinRanges(ranges, gap = 0) {
  const sorted = ranges.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start)
  const out = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r.start <= last.end + gap) last.end = Math.max(last.end, r.end)
    else out.push({ start: r.start, end: r.end })
  }
  return out
}

/** `keep` with every range in `cut` taken out. */
export function subtractRanges(keep, cut) {
  let out = joinRanges(keep)
  for (const c of joinRanges(cut)) {
    const next = []
    for (const k of out) {
      if (c.end <= k.start || c.start >= k.end) next.push(k)
      else {
        if (c.start > k.start) next.push({ start: k.start, end: c.start })
        if (c.end < k.end) next.push({ start: c.end, end: k.end })
      }
    }
    out = next
  }
  return out
}

/** `a` limited to the parts inside `b`. */
export function intersectRanges(a, b) {
  const out = []
  for (const x of joinRanges(a)) for (const y of joinRanges(b)) {
    const start = Math.max(x.start, y.start)
    const end = Math.min(x.end, y.end)
    if (end > start) out.push({ start, end })
  }
  return joinRanges(out)
}

const snap = (t) => Math.round(t * FPS) / FPS

/**
 * Which parts of one recording stay, in its own seconds, snapped to frames so
 * picture and sound cut at exactly the same instant.
 *
 *   duration  the recording's length
 *   silences  from detectSilences
 *   words     from transcribe (may be empty)
 *   cuts      the style's cortes
 *   drop      ranges the editor asked to remove (retakes, a false start)
 *   only      when given, nothing outside these ranges stays
 */
export function planCuts({ duration, silences = [], words = [], cuts = DEFAULT_STYLE.cortes, drop = [], only = null }) {
  let keep = [{ start: 0, end: duration }]
  if (cuts.activo) {
    const pauses = silences
      .map((s) => ({ start: s.start, end: Math.min(s.end, duration) }))
      .filter((s) => s.end - s.start > cuts.pausaMax)
      // Keep a little air either side, so a word's tail or breath isn't clipped.
      .map((s) => ({ start: s.start + cuts.margen, end: s.end - cuts.margen }))
    keep = subtractRanges(keep, pauses)
    if (cuts.quitarMuletillas) keep = subtractRanges(keep, words.filter((w) => isFiller(w.text)).map((w) => ({ start: w.start - 0.02, end: w.end + 0.02 })))
  }
  if (only?.length) keep = intersectRanges(keep, only)
  if (drop?.length) keep = subtractRanges(keep, drop)
  return joinRanges(
    keep
      .map((r) => ({ start: snap(Math.max(0, r.start)), end: snap(Math.min(duration, r.end)) }))
      .filter((r) => r.end - r.start >= cuts.minimo),
  )
}

/**
 * The finished reel's timeline: every kept piece of every recording in order,
 * with where it lands. [{ source, start, end, at }] (at = seconds into the reel).
 */
export function timeline(plans) {
  const out = []
  let at = 0
  plans.forEach((ranges, source) => {
    for (const r of ranges) {
      out.push({ source, start: r.start, end: r.end, at })
      at = snap(at + (r.end - r.start))
    }
  })
  return out
}

/** The words that survived the cuts, moved to the reel's clock. */
export function remapWords(wordsBySource, pieces) {
  const out = []
  for (const p of pieces) {
    for (const w of wordsBySource[p.source] ?? []) {
      if (isFiller(w.text)) continue
      const mid = (w.start + w.end) / 2
      if (mid < p.start || mid >= p.end) continue
      out.push({ text: w.text, start: Math.max(p.at, p.at + w.start - p.start), end: Math.min(p.at + (p.end - p.start), p.at + w.end - p.start) })
    }
  }
  return out
}

// -- captions ---------------------------------------------------------------

/** Phrases for the screen: up to `max` words, broken at pauses and the end of sentences. */
export function phrases(words, max = 3, maxSecs = 2.4) {
  const out = []
  let cur = []
  for (const w of words) {
    const last = cur[cur.length - 1]
    if (cur.length && (cur.length >= max || w.end - cur[0].start > maxSecs || w.start - last.end > 0.5)) {
      out.push(cur)
      cur = []
    }
    cur.push(w)
    if (/[.!?…]$/.test(w.text)) {
      out.push(cur)
      cur = []
    }
  }
  if (cur.length) out.push(cur)
  return out
}

const assTime = (t) => {
  const cs = Math.max(0, Math.round(t * 100))
  const h = Math.floor(cs / 360000)
  const m = Math.floor((cs % 360000) / 6000)
  const s = Math.floor((cs % 6000) / 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`
}

/** "#7C3AED" → ASS "&H00ED3A7C&"; alpha 0 (opaque) to 255 (clear). */
export const assColour = (hex, alpha = 0) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '') ?? [null, 'FF', 'FF', 'FF']
  return `&H${alpha.toString(16).padStart(2, '0')}${m[3]}${m[2]}${m[1]}`.toUpperCase()
}

const assText = (t, upper) => (upper ? t.toLocaleUpperCase('es') : t).replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim()

/** The captions and the hook title of a reel, as an ASS file sized to the frame. */
export function buildAss(words, style, [width, height], { title = '', length = 0 } = {}) {
  const sub = style.subtitulos
  const tit = style.titulo
  const size = Math.round(width * sub.tamano)
  const tSize = Math.round(width * tit.tamano)
  const marginX = Math.round(width * 0.07)
  const lines = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    // Alignment 5 (middle centre) with an explicit \pos on every line, so `altura` is exact.
    `Style: Sub,${sub.fuente},${size},${assColour(sub.color)},${assColour(sub.resaltado)},${assColour(sub.contorno)},${assColour('#000000', 0x60)},-1,0,0,0,100,100,0,0,1,${Math.round(size * sub.grosor)},${sub.sombra ? Math.max(1, Math.round(size * 0.05)) : 0},5,${marginX},${marginX},0,1`,
    // A box behind the title (BorderStyle 3), its colour the title's background.
    `Style: Titulo,${tit.fuente},${tSize},${assColour(tit.color)},${assColour(tit.color)},${assColour(tit.fondo, 0x30)},${assColour(tit.fondo, 0x30)},-1,0,0,0,100,100,0,0,3,${Math.round(tSize * 0.35)},0,5,${marginX},${marginX},0,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ]
  const x = Math.round(width / 2)
  const y = Math.round(height * sub.altura)
  if (sub.activo) {
    const hi = assColour(sub.resaltado)
    for (const group of phrases(words, sub.palabras)) {
      const texts = group.map((w) => assText(w.text, sub.mayusculas))
      const start = group[0].start
      const end = group[group.length - 1].end + 0.1
      if (sub.animacion === 'palabra') {
        // One line per word: the phrase stays put, the word being said lights up and grows a little.
        group.forEach((w, i) => {
          const from = i === 0 ? start : w.start
          const to = i === group.length - 1 ? end : group[i + 1].start
          const text = texts.map((t, j) => (j === i ? `{\\c${hi}\\fscx112\\fscy112}${t}{\\r}` : t)).join(' ')
          lines.push(`Dialogue: 0,${assTime(from)},${assTime(to)},Sub,,0,0,0,,{\\pos(${x},${y})}${text}`)
        })
      } else if (sub.animacion === 'pop') {
        lines.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Sub,,0,0,0,,{\\pos(${x},${y})\\fscx70\\fscy70\\t(0,90,\\fscx108\\fscy108)\\t(90,160,\\fscx100\\fscy100)}${texts.join(' ')}`)
      } else {
        lines.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Sub,,0,0,0,,{\\pos(${x},${y})}${texts.join(' ')}`)
      }
    }
  }
  const hook = assText(String(title ?? ''), tit.mayusculas)
  if (tit.activo && hook) {
    const to = Math.min(tit.segundos, length || tit.segundos)
    lines.push(`Dialogue: 1,${assTime(0)},${assTime(to)},Titulo,,0,0,0,,{\\pos(${x},${Math.round(height * tit.altura)})\\fad(120,200)}${hook}`)
  }
  return lines.join('\n') + '\n'
}

// -- the render -------------------------------------------------------------

const num = (n) => Number(n.toFixed(3)).toString()

/** FFmpeg's expression for "the frame's time is inside one of these ranges". */
export function inRanges(ranges, v = 't') {
  // A hair under each end, so the frame that starts exactly at the cut belongs to the next piece only.
  return ranges.map((r) => `between(${v},${num(r.start - 0.0005)},${num(r.end - 0.0015)})`).join('+') || '0'
}

/** The zoom per output frame, as a zoompan expression over `on` (the output frame number). */
export function zoomExpr(pieces, zoom) {
  if (!zoom.activo || zoom.escala <= 1.001) return '1'
  const parts = []
  pieces.forEach((p, i) => {
    if (i % zoom.cada !== zoom.cada - 1) return
    const a = Math.round(p.at * FPS)
    const b = Math.round((p.at + p.end - p.start) * FPS) - 1
    if (b <= a) return
    const value = zoom.tipo === 'suave' ? `1+${num(zoom.escala - 1)}*(on-${a})/${b - a}` : num(zoom.escala)
    parts.push([a, b, value])
  })
  // A chain of ifs, innermost last: if(between(on,a,b),z,if(…,1)).
  return parts.reduceRight((rest, [a, b, v]) => `if(between(on,${a},${b}),${v},${rest})`, '1')
}

/**
 * FFmpeg's arguments for the whole reel. `sources` are { file, width, height,
 * audio }; `pieces` from timeline(); `music` an optional file; `subs` the ASS
 * file's name in `cwd` (relative, so no path ever has to be escaped inside the
 * filter graph). Preview renders at half size, fast.
 */
export function renderArgs({ sources, pieces, style, music = null, subs = null, out, preview = false }) {
  const [W0, H0] = FORMATS[style.formato]
  const [W, H] = preview ? [W0 / 2, H0 / 2] : [W0, H0]
  const length = pieces.length ? snap(pieces[pieces.length - 1].at + pieces[pieces.length - 1].end - pieces[pieces.length - 1].start) : 0
  const args = ['-y']
  const used = [...new Set(pieces.map((p) => p.source))]
  for (const k of used) args.push('-i', sources[k].file)
  const silentAt = {}
  for (const k of used) {
    if (!sources[k].audio) {
      silentAt[k] = args.filter((a) => a === '-i').length
      args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=mono:sample_rate=48000')
    }
  }
  let musicAt = null
  if (music) {
    musicAt = args.filter((a) => a === '-i').length
    args.push('-stream_loop', '-1', '-i', music)
  }
  const { x, y, modo } = style.encuadre
  const g = []
  used.forEach((k, n) => {
    const ranges = pieces.filter((p) => p.source === k)
    const sel = inRanges(ranges)
    const frame =
      modo === 'blur'
        ? `split[f${n}a][f${n}b];[f${n}a]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=30:2,eq=brightness=-0.08[bg${n}];[f${n}b]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg${n}];[bg${n}][fg${n}]overlay=(W-w)/2:(H-h)/2`
        : `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-${W})*${num(x)}:(ih-${H})*${num(y)}`
    g.push(`[${n}:v]fps=${FPS},select='${sel}',setpts=N/${FPS}/TB,${frame},setsar=1,format=yuv420p[v${n}]`)
    const a = k in silentAt ? `[${silentAt[k]}:a]atrim=0:${num(sources[k].duration || length)},` : `[${n}:a]`
    g.push(`${a}aformat=sample_rates=48000:channel_layouts=mono,aselect='${sel}',asetpts=N/SR/TB[a${n}]`)
  })
  g.push(`${used.map((_, n) => `[v${n}][a${n}]`).join('')}concat=n=${used.length}:v=1:a=1[vc][ac]`)

  const zoom = zoomExpr(pieces, style.zoom)
  const c = style.color
  let video = '[vc]'
  const steps = []
  if (zoom !== '1') steps.push(`zoompan=z='${zoom}':x='(iw-iw/zoom)*${num(x)}':y='(ih-ih/zoom)*${num(y)}':d=1:s=${W}x${H}:fps=${FPS}`)
  if (c.contraste !== 1 || c.saturacion !== 1 || c.brillo !== 0) steps.push(`eq=contrast=${num(c.contraste)}:saturation=${num(c.saturacion)}:brightness=${num(c.brillo)}`)
  if (subs) steps.push(`ass=${subs}`)
  if (steps.length) {
    g.push(`${video}${steps.join(',')}[vout]`)
    video = '[vout]'
  }

  const clean = style.audio.limpiar ? 'highpass=f=80,afftdn=nf=-25,' : ''
  g.push(`[ac]${clean}loudnorm=I=${style.audio.lufs}:TP=-1.5:LRA=11,aresample=48000[voz]`)
  let audio = '[voz]'
  if (musicAt !== null && style.musica.volumen > 0) {
    g.push(`[${musicAt}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${num(style.musica.volumen)},atrim=0:${num(length)}[mus]`)
    if (style.musica.ducking) {
      g.push('[voz]asplit[voz1][voz2]')
      g.push('[mus][voz2]sidechaincompress=threshold=0.04:ratio=8:attack=15:release=350[musd]')
      g.push('[voz1][musd]amix=inputs=2:duration=first:normalize=0[aout]')
    } else {
      g.push('[voz][mus]amix=inputs=2:duration=first:normalize=0[aout]')
    }
    audio = '[aout]'
  }

  args.push('-filter_complex', g.join(';'), '-map', video, '-map', audio, '-t', num(length))
  args.push('-c:v', 'libx264', '-preset', preview ? 'ultrafast' : 'medium', '-crf', preview ? '28' : '18', '-pix_fmt', 'yuv420p', '-r', String(FPS))
  args.push('-c:a', 'aac', '-b:a', preview ? '128k' : '192k', '-ar', '48000', '-movflags', '+faststart', out)
  return { args, length, size: [W, H] }
}

/** A picture of a whole video: `n` frames spread across it, in a grid. */
export async function contactSheet(bin, file, duration, out, { cols = 4, rows = 3, width = 270 } = {}) {
  const n = cols * rows
  const rate = Math.max(0.01, n / Math.max(1, duration))
  await ffmpeg(bin, ['-y', '-i', file, '-vf', `fps=${rate.toFixed(4)},scale=${width}:-2,tile=${cols}x${rows}:padding=4:margin=4`, '-frames:v', '1', '-q:v', '4', out], { ms: 5 * 60_000 })
  return readFileSync(out)
}

/** One frame, `width` wide, as a JPEG. */
export async function still(bin, file, second, out, width = 540) {
  await ffmpeg(bin, ['-y', '-ss', num(Math.max(0, second)), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:-2`, '-q:v', '3', out], { ms: 60_000 })
  return readFileSync(out)
}

// -- studying a reference ---------------------------------------------------

/** Times of the picture's hard cuts, from FFmpeg's scene score. */
export async function detectCuts(bin, file, threshold = 0.3) {
  const log = await ffmpeg(bin, ['-i', file, '-an', '-vf', `scale=240:-2,select='gt(scene,${threshold})',showinfo`, '-f', 'null', '-'], { ms: 10 * 60_000 })
  return [...log.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]))
}

/** Integrated loudness (LUFS), or null. */
export async function loudness(bin, file) {
  const log = await ffmpeg(bin, ['-i', file, '-vn', '-af', 'ebur128', '-f', 'null', '-'], { ms: 10 * 60_000 }).catch(() => '')
  const m = log.match(/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/)
  return m ? Number(m[1]) : null
}

/**
 * What can be measured about a reference's editing: its pace (cuts and shot
 * lengths), how much silence is left in, and how loud it is. What can only be
 * seen — captions, framing, colour, text on screen — the model reads from the
 * contact sheet and frames returned alongside.
 */
export function describePace(duration, cuts, silences) {
  const shots = [0, ...cuts, duration].map((t, i, a) => (i ? t - a[i - 1] : null)).filter((d) => d !== null && d > 0.05)
  const sorted = [...shots].sort((a, b) => a - b)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : duration
  const silent = silences.reduce((s, r) => s + (Math.min(r.end, duration) - r.start), 0)
  const longPauses = silences.filter((r) => Math.min(r.end, duration) - r.start > 0.5).length
  return {
    duracion: Number(duration.toFixed(1)),
    cortes: cuts.length,
    cortesPorMinuto: duration ? Number(((cuts.length / duration) * 60).toFixed(1)) : 0,
    tomaMediana: Number(median.toFixed(2)),
    tomaMasLarga: Number((sorted[sorted.length - 1] ?? duration).toFixed(2)),
    silencioPorCiento: duration ? Math.round((silent / duration) * 100) : 0,
    pausasLargas: longPauses,
  }
}

/** Style settings that the measurements suggest, for the model to start from. */
export function suggestFromPace(pace) {
  const fast = pace.tomaMediana < 2
  return {
    cortes: { pausaMax: pace.silencioPorCiento < 5 ? 0.25 : pace.silencioPorCiento < 12 ? 0.35 : 0.6 },
    zoom: { activo: pace.cortesPorMinuto > 6, cada: fast ? 1 : 2, tipo: pace.tomaMediana > 4 ? 'suave' : 'golpe' },
  }
}
