import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readAnaSofi, startAnaSofi } from '../nucleo/anasofi.mjs'
import { setRemoteFolder } from '../nucleo/etiquetas.mjs'
import { ASSETS, DATA, SEAL_KEY, TAG } from '../nucleo/lugar.mjs'
import { transcribe } from '../nucleo/voz.mjs'
import { applyData } from './datos.mjs'
import { driveWriter } from './drive.mjs'
import { checkSeal } from './firma.mjs'

/**
 * A client's brain: the program that runs on their Mac mini (see
 * docs/cerebro-cliente.md). It starts their AIs — for now Ana Sofi and the
 * labels — and nothing else: no console, no voice page, no owner's tools.
 *
 * Built into one file by scripts/cerebro.mjs, with cerebro/lugar.mjs in place
 * of the core's, so all it reads and writes is in the brain's own folder.
 * Before anything starts, it checks its own seal (firma.mjs): if a file was
 * touched, it starts no AI and says so in its state.
 *
 *   node cerebro.mjs                                start the brain
 *   node cerebro.mjs verificar <carpeta> <llave>   check a package's seal (the installer does)
 *   node cerebro.mjs datos <archivo> <llave>       apply signed data from the owner (canal.sh does)
 *
 *   <data>/cerebro.json   { dueno: Telegram id of the owner, modelo?, esfuerzo? }
 *   <data>/llaves.json    { claude, elevenlabs, drive_url?, drive_clave? }  (set with llaves.mjs; the service user only)
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

  // The seal, on the package as installed (a build for tests has none).
  if (VERSION !== 'desarrollo') {
    let key = null
    try {
      key = readFileSync(SEAL_KEY, 'utf8')
    } catch {
      // checkSeal says there is none.
    }
    const seal = checkSeal(ASSETS, key)
    state.sello = seal.ok ? 'bien' : seal.why
    if (!seal.ok) return warn(`El sello del programa no cuadra (${seal.why}): no arranca ninguna IA. Reinstala el paquete firmado.`)
  }

  const cfg = readConfig()
  const keys = readKeys()
  if (!keys.claude) warn('Falta la llave de Claude: corre llaves.mjs. Ninguna IA arranca sin ella.')
  if (!/^\d{4,15}$/.test(String(cfg.dueno ?? ''))) warn('Falta el dueño (id de Telegram) en cerebro.json.')
  if (!keys.claude) return

  // The printer's computer gets the label program and the queue through Drive, over the internet.
  if (keys.drive_url && keys.drive_clave) setRemoteFolder(driveWriter({ url: keys.drive_url, clave: keys.drive_clave }))
  else warn('Falta la conexión con Drive (llaves.mjs): las etiquetas imprimen por la línea directa, pero el programa de la Zebra no se actualiza solo.')

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
if (process.argv[1] && /cerebro\.mjs$/.test(process.argv[1])) {
  if (process.argv[2] === 'verificar') {
    let key = null
    try {
      key = readFileSync(process.argv[4], 'utf8')
    } catch {
      // checkSeal says there is none.
    }
    const r = checkSeal(process.argv[3], key)
    console.log(r.ok ? ` ✅ Sello correcto (versión ${r.version}).` : ` ❌ Sello incorrecto: ${r.why}.`)
    process.exit(r.ok ? 0 : 1)
  }
  if (process.argv[2] === 'datos') {
    let key = null
    try {
      key = readFileSync(process.argv[4], 'utf8')
    } catch {
      // applyData says there is none.
    }
    try {
      console.log(` ✅ Datos aplicados: ${applyData(process.argv[3], key).join(', ') || 'nada que cambiar'}.`)
      process.exit(0)
    } catch (err) {
      console.log(` ❌ No se aplicaron los datos: ${err.message}.`)
      process.exit(1)
    }
  }
  void main()
}
