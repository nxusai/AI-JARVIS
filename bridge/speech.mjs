import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { findFfmpeg } from './nucleo/medios.mjs'

/**
 * Text about to be spoken. A comma either side of "Boss" makes every voice
 * engine pause on it ("Listo, Boss." — beat — "Boss"), which the owner finds
 * ugly; said straight through it sounds natural. Used on everything NEX says
 * out loud: the face's voice, Telegram voice notes and phone calls.
 */
export function smoothBoss(text) {
  return String(text ?? '')
    // Her name is written NEX but said as a word ("Nex"), never spelled out.
    .replace(/\bNEX\b/g, 'Nex')
    .replace(/\s*,\s*(boss)\b/gi, ' $1')
    .replace(/\b(boss)\s*,\s*/gi, '$1 ')
}

/**
 * Her voice: the ElevenLabs voice id the owner chose with
 * `node scripts/voz.mjs <id>` (~/.nexy/voz.json), else JARVIS_VOICE_ID, else
 * the default. Used for the face, Telegram voice notes and the iPhone.
 */
export const VOICE_FILE = join(homedir(), '.nexy', 'voz.json')
export function ownVoiceId(fallback = 'JBFqnCBsd6RMkjVDRZzb') {
  try {
    const id = String(JSON.parse(readFileSync(VOICE_FILE, 'utf8')).voice_id ?? '').trim()
    if (/^\w{10,40}$/.test(id)) return id
  } catch {}
  return process.env.JARVIS_VOICE_ID?.trim() || fallback
}

/**
 * The same loudness whatever the voice. ElevenLabs voices come out as loud as
 * the sample they were made from, so a new voice can be much quieter than the
 * old one; on the iPhone and in Telegram voice notes that means straining to
 * hear him even at full volume — and a deep voice loses most of itself on a
 * phone's small speaker. Shaped for that speaker and brought to -9 LUFS. Without FFmpeg, or if it fails, the audio
 * goes out as it came.
 */
export function louder(mp3) {
  const ffmpeg = findFfmpeg()
  if (!ffmpeg) console.log('[jarvis] voice: no FFmpeg, so the volume is not raised — cd ~/Desktop/nexy && npm install ffmpeg-static')
  if (!ffmpeg || !mp3?.length) return Promise.resolve(mp3)
  return new Promise((resolve) => {
    const chunks = []
    // Shaped for a phone's speaker, which cannot play the low end: a deep
    // voice keeps most of its energy below 250 Hz, so it measures loud and
    // sounds faint. The lows are cut, the presence band (where words are
    // understood) is lifted, everything is compressed so soft syllables come
    // up, and the result is brought to -9 LUFS with a limiter so it never
    // clips.
    const filter = [
      // A breath of silence first: the iPhone is still switching from the
      // microphone to the speaker when the sound starts, and would swallow or
      // duck the first syllables.
      'adelay=450:all=1',
      'highpass=f=170:poles=2',
      'equalizer=f=250:t=q:w=1:g=-4',
      'equalizer=f=2800:t=q:w=1.2:g=6',
      'equalizer=f=5000:t=q:w=1:g=3',
      'acompressor=threshold=-26dB:ratio=5:attack=4:release=60:makeup=8dB',
      'loudnorm=I=-9:TP=-0.8:LRA=5',
      'alimiter=limit=0.95',
    ].join(',')
    const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-af', filter, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', '-f', 'mp3', 'pipe:1'], { stdio: ['pipe', 'pipe', 'ignore'] })
    const t = setTimeout(() => p.kill('SIGKILL'), 20_000)
    p.stdout.on('data', (c) => chunks.push(c))
    p.on('error', () => resolve(mp3))
    p.on('close', (code) => {
      clearTimeout(t)
      const out = Buffer.concat(chunks)
      const ok = code === 0 && out.length > 1000
      if (!ok) console.log(`[jarvis] voice: could not raise the volume (FFmpeg ${code})`)
      resolve(ok ? out : mp3)
    })
    p.stdin.on('error', () => {})
    p.stdin.end(mp3)
  })
}
