import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readAnaSofi, startAnaSofi } from '../nucleo/anasofi.mjs'
import { DATA, TAG } from '../nucleo/lugar.mjs'
import { transcribe } from '../nucleo/voz.mjs'

/**
 * A client's brain: the program that runs on their Mac mini (see
 * docs/cerebro-cliente.md). It starts their AIs — for now Ana Sofi and the
 * labels — and nothing else: no console, no voice page, no owner's tools.
 *
 * Built into one file by scripts/cerebro.mjs, with cerebro/lugar.mjs in place
 * of the core's, so all it reads and writes is in the brain's own folder:
 *
 *   <data>/cerebro.json   { dueno: Telegram id of the owner, modelo?, esfuerzo? }
 *   <data>/llaves.json    { claude, elevenlabs }  (set with llaves.mjs; the service user only)
 *   <data>/anasofi.json   Ana Sofi's bot, group and voices
 *   <data>/estado.json    how the brain is, every minute
 */

export const CONFIG_FILE = join(DATA, 'cerebro.json')
export const KEYS_FILE = join(DATA, 'llaves.json')
export const STATE_FILE = join(DATA, 'estado.json')
const MODEL = 'claude-haiku-5-5'
const EFFORT = 'low'
// Written into the package by scripts/cerebro.mjs.
const VERSION = typeof __CEREBRO_VERSION__ === 'string' ? __CEREBRO_VERSION__ : 'desarrollo'

const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8')) ?? {}
  } catch {
    return {}
  }
}
export const readConfig = () => readJson(CONFIG_FILE)
export const readKeys = () => readJson(KEYS_FILE)

/** Ana Sofi's turns run on the brain's own Claude key, never a login. */
function claudeEnv() {
  const key = readKeys().claude
  if (!key) return undefined
  const env = { ...process.env, ANTHROPIC_API_KEY: key }
  delete env.ANTHROPIC_AUTH_TOKEN
  delete env.CLAUDE_CODE_OAUTH_TOKEN
  return env
}

const state = { version: VERSION, arranco: new Date().toISOString(), latido: null, ias: {}, avisos: [] }
function beat() {
  state.latido = new Date().toISOString()
  try {
    mkdirSync(DATA, { recursive: true })
    writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
    chmodSync(STATE_FILE, 0o600)
  } catch (err) {
    console.log(`${TAG} could not write the state: ${err.message}`)
  }
}
const warn = (text) => {
  console.log(`${TAG} ${text}`)
  state.avisos = [...state.avisos, { at: new Date().toISOString(), text }].slice(-20)
  beat()
}

export async function main() {
  console.log(`${TAG} brain ${VERSION} starting`)
  beat()
  setInterval(beat, 60_000)

  const cfg = readConfig()
  const keys = readKeys()
  if (!keys.claude) warn('Falta la llave de Claude: corre llaves.mjs. Ninguna IA arranca sin ella.')
  if (!/^\d{4,15}$/.test(String(cfg.dueno ?? ''))) warn('Falta el dueño (id de Telegram) en cerebro.json.')
  if (!keys.claude) return

  if (readAnaSofi()) {
    state.ias.anasofi = 'prendida'
    beat()
    startAnaSofi({
      model: cfg.modelo || MODEL,
      effort: cfg.esfuerzo || EFFORT,
      env: claudeEnv,
      ownerId: () => Number(readConfig().dueno) || null,
      elevenKey: () => readKeys().elevenlabs ?? null,
      transcribe: (bytes) => {
        const key = readKeys().elevenlabs
        return key ? transcribe(key, bytes, 'nota.ogg') : Promise.resolve('')
      },
    }).catch((err) => {
      state.ias.anasofi = 'detenida'
      warn(`Ana Sofi se detuvo: ${err?.message ?? err}`)
    })
  } else {
    state.ias.anasofi = 'sin bot'
    warn('Ana Sofi no tiene bot todavía: corre llaves.mjs.')
  }
}

// Started directly (the package's cerebro.mjs), not imported by a test.
if (process.argv[1] && /cerebro\.mjs$/.test(process.argv[1])) void main()
