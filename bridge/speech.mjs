import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

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
