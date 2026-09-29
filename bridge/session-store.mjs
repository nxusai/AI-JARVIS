import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Where each conversation with Nexy left off, so a restart doesn't wipe it.
 *
 * The agent keeps every conversation on disk under ~/.claude/projects; all
 * Nexy needs is the id of the last one per channel (voice, Telegram) to pick
 * it up again. Without this, updating or restarting Nexy made her forget
 * what she was in the middle of — "try again" had nothing to try.
 *
 * A conversation left alone for a few days starts fresh instead: old context
 * only gets in the way, and what should last belongs in memory or the brand
 * manuals, not in a chat log.
 */

const DIR = join(homedir(), '.nexy', 'sesiones')
const MAX_AGE_MS = 3 * 24 * 60 * 60_000
const ID = /^[0-9a-f-]{8,64}$/i

const file = (channel) => join(DIR, `${channel}.json`)

export function loadSession(channel) {
  try {
    const { id, updated } = JSON.parse(readFileSync(file(channel), 'utf8'))
    if (typeof id !== 'string' || !ID.test(id)) return null
    if (!updated || Date.now() - updated > MAX_AGE_MS) return null
    return id
  } catch {
    return null
  }
}

export function saveSession(channel, id) {
  if (typeof id !== 'string' || !ID.test(id)) return
  try {
    mkdirSync(DIR, { recursive: true })
    writeFileSync(file(channel), JSON.stringify({ id, updated: Date.now() }) + '\n')
  } catch (err) {
    console.log(`[jarvis] could not save the ${channel} conversation: ${err?.message ?? err}`)
  }
}

export function clearSession(channel) {
  rmSync(file(channel), { force: true })
}
