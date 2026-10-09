import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Which Claude account pays for what.
 *
 * The owner's own subscription (the Claude login on this Mac) is for him: his
 * Nexy and building with Claude Code. The groups — client service, NXUS
 * México, Ana Sofi — run on API credits instead, with a key from the Claude
 * Console, so their use never spends his subscription and shows up apart in
 * the Console. One key for all the groups ("grupos"), or one for a space of
 * its own (atencion, mexico, anasofi) when a client should be billed apart.
 * Set with `node scripts/api.mjs`; without a key a space runs as before.
 *
 *   ~/.nexy/api.json   { grupos: "sk-ant-…", atencion?: …, mexico?: …, anasofi?: … }  (this Mac's user only)
 */

export const API_FILE = join(homedir(), '.nexy', 'api.json')
export const SPACES = ['grupos', 'atencion', 'mexico', 'anasofi']
export const KEY_SHAPE = /^sk-ant-[\w-]{20,}$/

export function readApiKeys() {
  try {
    const data = JSON.parse(readFileSync(API_FILE, 'utf8'))
    return Object.fromEntries(Object.entries(data ?? {}).filter(([k, v]) => SPACES.includes(k) && typeof v === 'string' && KEY_SHAPE.test(v)))
  } catch {
    return {}
  }
}

export function writeApiKeys(keys) {
  mkdirSync(join(homedir(), '.nexy'), { recursive: true })
  writeFileSync(API_FILE, `${JSON.stringify(keys, null, 2)}\n`, { mode: 0o600 })
  chmodSync(API_FILE, 0o600)
}

/** The key a space runs on: its own, else the groups', else none (the subscription). */
export const keyFor = (space) => {
  const keys = readApiKeys()
  return keys[space] ?? keys.grupos ?? null
}

/**
 * The environment for an agent of that space: with an API key it is billed to
 * the API credits; without one, undefined (the SDK's own, the subscription).
 * Read each time a conversation starts, so a new key applies on the next one.
 */
export function envFor(space) {
  const key = keyFor(space)
  if (!key) return undefined
  const env = { ...process.env, ANTHROPIC_API_KEY: key }
  // A key from the environment would win over the login anyway; an OAuth token would not.
  delete env.ANTHROPIC_AUTH_TOKEN
  delete env.CLAUDE_CODE_OAUTH_TOKEN
  return env
}

/** Check a key with Anthropic: resolves true, or the reason it does not work. */
export async function checkKey(key, fetchImpl = fetch) {
  try {
    const res = await fetchImpl('https://api.anthropic.com/v1/models?limit=1', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    })
    if (res.ok) return true
    const data = await res.json().catch(() => ({}))
    return data?.error?.message ?? `Anthropic answered ${res.status}`
  } catch (err) {
    return err.message
  }
}
