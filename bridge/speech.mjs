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
 * hear him even at full volume. Compressed and brought up to -10 LUFS, with a
 * ceiling so it never clips. Without FFmpeg, or if it fails, the audio
 * goes out as it came.
 */
export function louder(mp3) {
  const ffmpeg = findFfmpeg()
  if (!ffmpeg) console.log('[jarvis] voice: no FFmpeg, so the volume is not raised — cd ~/Desktop/nexy && npm install ffmpeg-static')
  if (!ffmpeg || !mp3?.length) return Promise.resolve(mp3)
  return new Promise((resolve) => {
    const chunks = []
    // A compressor first, so the quiet syllables come up with the loud ones,
    // then loud (-10 LUFS, near a phone's own ringtone) with a ceiling that
    // keeps it from clipping on the iPhone's speaker.
    const filter = 'highpass=f=80,acompressor=threshold=-24dB:ratio=4:attack=5:release=80:makeup=6dB,loudnorm=I=-10:TP=-0.5:LRA=7'
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
