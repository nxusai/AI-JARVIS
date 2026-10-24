import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readAnaSofi, writeAnaSofi } from '../nucleo/anasofi.mjs'
import { DATA } from '../nucleo/lugar.mjs'
import { api } from '../nucleo/telegram.mjs'
import { DRIVE_KEY, DRIVE_URL, driveWorks } from './drive.mjs'

/**
 * The brain's keys screen. The owner runs it on the client's Mac mini, as
 * the administrator, the day it is installed (and whenever a key changes):
 *
 *   sudo node "/Library/Application Support/Cerebro/programa/llaves.mjs"          asks for every key
 *   sudo node "/Library/Application Support/Cerebro/programa/llaves.mjs" estado   which keys are set (never their values)
 *
 * Keys are typed where nothing shows them, checked with their service, and
 * kept in the brain's data folder, readable only by the brain's own user.
 * Enter on an empty line keeps a key as it is.
 */

const SERVICE_USER = process.env.CEREBRO_USER || '_cerebro'
const LABEL = 'org.cerebro.ia'
const KEYS_FILE = join(DATA, 'llaves.json')
const CONFIG_FILE = join(DATA, 'cerebro.json')
const CLAUDE_KEY = /^sk-ant-[\w-]{20,}$/
const ELEVEN_KEY = /^[\w-]{20,}$/
const BOT_TOKEN = /^\d{6,12}:[A-Za-z0-9_-]{30,50}$/

const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8')) ?? {}
  } catch {
    return {}
  }
}
function writePrivate(file, value) {
  mkdirSync(DATA, { recursive: true, mode: 0o700 })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}

/** Read a line without showing it; from a pipe when there is no terminal. */
let piped = null
function hidden(question, show = false) {
  const stdin = process.stdin
  if (!stdin.isTTY) {
    piped ??= new Promise((resolve) => {
      let data = ''
      stdin.setEncoding('utf8')
      stdin.on('data', (c) => (data += c))
      stdin.on('end', () => resolve(data.split('\n')))
    })
    return piped.then((lines) => String(lines.shift() ?? '').trim())
  }
  return new Promise((resolve) => {
    process.stdout.write(question)
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          return resolve(value.trim())
        }
        if (ch === '\u0003') {
          process.stdout.write('\n')
          process.exit(1)
        }
        if (ch === '\u007f' || ch === '\b') {
          if (show && value) process.stdout.write('\b \b')
          value = value.slice(0, -1)
        } else {
          value += ch
          if (show) process.stdout.write(ch)
        }
      }
    }
    stdin.on('data', onData)
  })
}

async function claudeWorks(key) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } })
    if (res.ok) return true
    const data = await res.json().catch(() => ({}))
    return data?.error?.message ?? `respondió ${res.status}`
  } catch (err) {
    return err.message
  }
}

/** Ask for one key until it is good, or keep the one there is (Enter). */
async function ask(label, { has, shape, check, show = false, optional = false }) {
  for (let tries = 0; tries < 3; tries++) {
    const value = (await hidden(` ${label}${has ? ' (Enter = dejar la que ya está)' : optional ? ' (Enter = después)' : ''}: `, show)).replace(/\s+/g, '')
    if (!value) {
      if (has || optional) return null
      console.log(' Hace falta. Inténtalo otra vez.')
      continue
    }
    if (!shape.test(value)) {
      console.log(' Eso no tiene la forma de esa llave. Revísala e inténtalo otra vez.')
      continue
    }
    const ok = check ? await check(value) : true
    if (ok === true) return value
    console.log(` No funcionó: ${ok}. Inténtalo otra vez.`)
  }
  console.log(' Tres intentos. No se cambió nada de esta llave.')
  return null
}

/** The files belong to the brain's user, and the brain restarts with the new keys. */
function handOver() {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return
  try {
    execFileSync('/usr/sbin/chown', ['-R', `${SERVICE_USER}:${SERVICE_USER}`, DATA])
    execFileSync('/bin/chmod', ['700', DATA])
  } catch (err) {
    console.log(` ⚠️ No pude darle los archivos al usuario del cerebro (${err.message}).`)
  }
  try {
    execFileSync('/bin/launchctl', ['kickstart', '-k', `system/${LABEL}`], { stdio: 'ignore' })
    console.log(' 🔄 El cerebro se reinició con las llaves nuevas.')
  } catch {
    console.log(' (El cerebro todavía no está instalado como servicio; arrancará con estas llaves cuando lo esté.)')
  }
}

const cmd = process.argv[2]
const keys = readJson(KEYS_FILE)
const config = readJson(CONFIG_FILE)
const bot = readAnaSofi()

if (cmd === 'estado') {
  const mark = (v) => (v ? '✅ puesta' : '❌ falta')
  console.log(` Claude (Cerebro):     ${mark(keys.claude)}`)
  console.log(` ElevenLabs (Cerebro): ${mark(keys.elevenlabs)}`)
  console.log(` Bot de Ana Sofi:      ${bot ? `✅ @${bot.bot ?? '?'}` : '❌ falta'}`)
  console.log(` Dueño (Telegram):     ${config.dueno ? '✅ puesto' : '❌ falta'}`)
  console.log(` Drive (etiquetas):    ${keys.drive_url && keys.drive_clave ? '✅ conectado' : '❌ falta'}`)
  process.exit(0)
} else if (cmd) {
  console.log(' Uso: llaves.mjs [estado]')
  process.exit(1)
}

console.log('\n Llaves del cerebro. Nada de lo que pegues se verá en la pantalla.\n')
const claude = await ask('Llave de Claude ("Cerebro Mi Semago")', { has: Boolean(keys.claude), shape: CLAUDE_KEY, check: claudeWorks })
const eleven = await ask('Llave de ElevenLabs ("Cerebro Mi Semago")', { has: Boolean(keys.elevenlabs), shape: ELEVEN_KEY })
let me = null
// Ana Sofi's bot goes last on moving day, once NEX no longer answers with it (Enter = después).
const token = await ask('Llave (token) del bot de Ana Sofi', {
  has: Boolean(bot),
  optional: true,
  shape: BOT_TOKEN,
  check: async (t) => {
    try {
      me = await api(t, 'getMe')
      return true
    } catch (err) {
      return `Telegram no la aceptó (${err.message})`
    }
  },
})
// The owner also comes with the data from the owner's system (Enter = después).
const dueno = await ask('Tu número de cuenta de Telegram (el dueño)', { has: Boolean(config.dueno), shape: /^\d{4,15}$/, show: true, optional: true })
const driveUrl = await ask('Dirección de Drive (la de la aplicación web, termina en /exec)', { has: Boolean(keys.drive_url), shape: DRIVE_URL, optional: true })
let driveKey = null
if (driveUrl || keys.drive_url) {
  const url = driveUrl ?? keys.drive_url
  driveKey = await ask('Clave de Drive (la que dio preparar)', { has: Boolean(keys.drive_clave) && !driveUrl, shape: DRIVE_KEY, check: (k) => driveWorks(url, k) })
}

writePrivate(KEYS_FILE, { ...keys, ...(claude ? { claude } : {}), ...(eleven ? { elevenlabs: eleven } : {}), ...(driveUrl && driveKey ? { drive_url: driveUrl } : {}), ...(driveKey ? { drive_clave: driveKey } : {}) })
// The group and voices may already be there, sent before the bot (datos): kept.
const before = readJson(join(DATA, 'anasofi.json'))
if (token) writeAnaSofi({ ...before, token, bot: me?.username ?? before.bot ?? null, grupo: before.grupo ?? null })
if (dueno) writePrivate(CONFIG_FILE, { ...config, dueno: Number(dueno) })
handOver()
console.log('\n ✅ Listo. Para revisar sin ver las llaves: llaves.mjs estado\n')
process.exit(0)
