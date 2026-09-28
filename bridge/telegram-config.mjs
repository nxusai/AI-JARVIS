import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Nexy's Telegram settings: the bot's token, and who its owner is.
 *
 * Kept in ~/.nexy/telegram.json, readable by this Mac's user only, because the
 * token is a password: whoever has it can read and send as the bot. It is
 * written by scripts/telegram.mjs (which takes the token from a hidden prompt)
 * and by the bridge when the owner pairs, and never printed by either.
 *
 *   { token, bot, owner: { id, name } | null, pairCode, voice: 'auto' | 'siempre' | 'nunca' }
 */

export const TELEGRAM_FILE = join(homedir(), '.nexy', 'telegram.json')

export function readTelegram() {
  try {
    const cfg = JSON.parse(readFileSync(TELEGRAM_FILE, 'utf8'))
    return cfg && typeof cfg.token === 'string' && cfg.token ? cfg : null
  } catch {
    return null
  }
}

export function writeTelegram(cfg) {
  mkdirSync(dirname(TELEGRAM_FILE), { recursive: true })
  writeFileSync(TELEGRAM_FILE, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
  chmodSync(TELEGRAM_FILE, 0o600)
}

export function removeTelegram() {
  rmSync(TELEGRAM_FILE, { force: true })
}

/** A Telegram bot token: digits, a colon, then 30-odd URL-safe characters. */
export const TOKEN_SHAPE = /^\d{6,12}:[A-Za-z0-9_-]{30,50}$/
