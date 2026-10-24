import { spawn, execFileSync } from 'node:child_process'
import { createPrivateKey, sign } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { readAnaSofi } from './anasofi.mjs'
import { listClients, readLabelConfig, saveClient } from './etiquetas.mjs'
import { readTelegram } from './telegram-config.mjs'

/**
 * NEX's side of the clients' brains (docs/cerebro-cliente.md): which brains
 * there are, and the door into each. NEX goes to the brain, never the other
 * way: over SSH, with a key of NEX's that the brain lets run only its door
 * (bridge/cerebro/canal.sh) — read its state, take a copy of its labels,
 * install a signed package, apply signed data, restart, stop, or wipe its keys.
 *
 *   ~/.nexy/cerebros.json               { <nombre>: { host, usuario, anasofi?: 'cerebro' } }
 *   ~/.nexy/cerebro/canal_ed25519       the door's key (this Mac's user only); .pub goes in every package
 *   ~/.nexy/cerebro/known_hosts         the brains' own SSH identities, learned the first time
 *   ~/.nexy/cerebros/<nombre>/espejo/   the last copy taken of a brain
 */

const DIR = join(homedir(), '.nexy', 'cerebro')
export const BRAINS_FILE = join(homedir(), '.nexy', 'cerebros.json')
export const DOOR_KEY = join(DIR, 'canal_ed25519')
const KNOWN_HOSTS = join(DIR, 'known_hosts')
export const MIRRORS = join(homedir(), '.nexy', 'cerebros')
export const SIGNING_KEY = join(DIR, 'firma-privada.pem')
const NAME = /^[a-z0-9-]{2,40}$/
const HOST = /^[A-Za-z0-9.:-]{1,253}$/
const USER = /^[a-z_][a-z0-9_.-]{0,31}$/
export const ORDERS = ['estado', 'espejo', 'registro', 'paquete', 'datos', 'reiniciar', 'apagar', 'prender', 'borrar-llaves']

export function readBrains() {
  try {
    const all = JSON.parse(readFileSync(BRAINS_FILE, 'utf8')) ?? {}
    return Object.fromEntries(Object.entries(all).filter(([n, b]) => NAME.test(n) && HOST.test(b?.host ?? '') && USER.test(b?.usuario ?? '')))
  } catch {
    return {}
  }
}
export function saveBrain(name, value) {
  if (!NAME.test(name)) throw new Error('el nombre va en minúsculas, sin espacios (ej. mi-semago)')
  if (value && (!HOST.test(value.host ?? '') || !USER.test(value.usuario ?? ''))) throw new Error('la dirección o el usuario no tienen la forma correcta')
  const all = readBrains()
  if (value) all[name] = value
  else delete all[name]
  mkdirSync(dirname(BRAINS_FILE), { recursive: true })
  writeFileSync(BRAINS_FILE, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 })
  chmodSync(BRAINS_FILE, 0o600)
}

/** Whether Ana Sofi answers from a brain now (then NEX's own copy of her stays off). */
export const anaSofiMoved = () => Object.values(readBrains()).some((b) => b.anasofi === 'cerebro')

/** The door's key: made the first time with ssh-keygen. Resolves its public line. */
export function doorKey() {
  if (!existsSync(DOOR_KEY)) {
    mkdirSync(DIR, { recursive: true, mode: 0o700 })
    execFileSync(process.env.CEREBRO_SSH_KEYGEN || 'ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'cerebro-canal', '-f', DOOR_KEY], { stdio: 'ignore' })
  }
  return readFileSync(`${DOOR_KEY}.pub`, 'utf8').trim()
}

/**
 * One order through a brain's door. `input` is sent to it (a package, data).
 * Resolves { code, out: Buffer, err: string }.
 */
export function order(name, what, input = null, { timeoutMs = 10 * 60_000 } = {}) {
  const b = readBrains()[name]
  if (!b) return Promise.reject(new Error(`no hay un cerebro llamado ${name} (node scripts/cerebro.mjs conectar)`))
  if (!ORDERS.includes(what)) return Promise.reject(new Error(`orden desconocida: ${what}`))
  doorKey()
  const args = [
    '-i', DOOR_KEY,
    '-o', 'IdentitiesOnly=yes',
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=15',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', `UserKnownHostsFile=${KNOWN_HOSTS}`,
    `${b.usuario}@${b.host}`,
    what,
  ]
  return new Promise((resolve, reject) => {
    const p = spawn(process.env.CEREBRO_SSH || 'ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    const out = []
    let err = ''
    p.stdout.on('data', (d) => out.push(d))
    p.stderr.on('data', (d) => (err = (err + d).slice(-4000)))
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs)
    p.on('error', (e) => {
      clearTimeout(t)
      reject(e)
    })
    p.on('close', (code) => {
      clearTimeout(t)
      resolve({ code, out: Buffer.concat(out), err: err.trim() })
    })
    p.stdin.on('error', () => {})
    p.stdin.end(input ?? undefined)
  })
}

/** A brain's state, as it reports it. */
export async function brainState(name) {
  const r = await order(name, 'estado', null, { timeoutMs: 30_000 })
  if (r.code !== 0) throw new Error(r.err || r.out.toString().trim() || `respondió ${r.code}`)
  return JSON.parse(r.out.toString())
}

/** The same JSON whatever the order of its keys. */
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}` : JSON.stringify(v))
/** A set as readClient gives it. */
const asSet = (c) => ({ ...c, tipo: c.tipo === 'traza' ? 'traza' : 'gs1' })

/**
 * Takes a copy of a brain's labels and state into ~/.nexy/cerebros/<nombre>/espejo.
 * Once Ana Sofi answers from that brain, the sets changed there become NEX's
 * original too (with their history here). Resolves the sets the brain has
 * that are not as they are here.
 */
export async function mirror(name) {
  const r = await order(name, 'espejo', null, { timeoutMs: 120_000 })
  if (r.code !== 0) throw new Error(r.err || `respondió ${r.code}`)
  const dir = join(MIRRORS, name, 'espejo')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  execFileSync('tar', ['-xzf', '-', '-C', dir], { input: r.out })
  const theirs = new Map()
  const setsDir = join(dir, 'etiquetas')
  if (existsSync(setsDir)) {
    for (const f of readdirSync(setsDir).filter((f) => /^[a-z0-9-]+\.json$/.test(f))) {
      try {
        const c = JSON.parse(readFileSync(join(setsDir, f), 'utf8'))
        if (Array.isArray(c?.productos)) theirs.set(c.id, asSet(c))
      } catch {
        // not a set
      }
    }
  }
  const ours = new Map(listClients().map((c) => [c.id, c]))
  // What the brain has that is not as here: changed there (or made there).
  const differ = [...theirs.keys()].filter((id) => !ours.has(id) || stable(theirs.get(id)) !== stable(ours.get(id)))
  const adopted = []
  if (readBrains()[name]?.anasofi === 'cerebro') {
    for (const id of differ) {
      saveClient(theirs.get(id), { quien: `cerebro ${name}`, que: 'cambio hecho en el cerebro' })
      adopted.push(id)
    }
  }
  return { dir, differ, adopted }
}

/** What NEX sends a brain as data: signed with the same key as the packages. */
export function buildData({ labels = false } = {}) {
  const ana = readAnaSofi() ?? {}
  const data = {
    tipo: 'datos',
    fecha: new Date().toISOString(),
    anasofi: { grupo: ana.grupo ?? null, voz: ana.voz ?? null, voz_es: ana.voz_es ?? null, voz_en: ana.voz_en ?? null },
    ...(readTelegram()?.owner?.id ? { cerebro: { dueno: readTelegram().owner.id } } : {}),
    ...(readLabelConfig().canal ? { canal: readLabelConfig().canal } : {}),
    ...(labels ? { etiquetas: Object.fromEntries(listClients().map((c) => [c.id, c])) } : {}),
  }
  const body = JSON.stringify(data)
  const key = createPrivateKey(readFileSync(SIGNING_KEY, 'utf8'))
  return `${sign(null, Buffer.from(body), key).toString('base64')}\n${body}`
}

// -- the watch -------------------------------------------------------------------

const WATCH_FILE = join(MIRRORS, 'vigilancia.json')
const EVERY_MS = 5 * 60_000
/** Three looks in a row with no answer (15 minutes) before saying it does not answer. */
const MISSES = 3
/** A heartbeat older than this means the brain is stuck, though its service is up. */
const STALE_MS = 6 * 60_000

const hhmm = (ms) => new Date(ms).toLocaleTimeString('es-MX', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })

/**
 * One look at every brain. Compares with what was seen before and returns
 * the messages for the owner: each problem once when it starts and once when
 * it is over, never every five minutes. The first look at a brain only
 * learns its records, so old ones are not reported as new.
 */
export async function checkBrains({ now = Date.now(), getState = brainState, memoryFile = WATCH_FILE } = {}) {
  let memory = {}
  try {
    memory = JSON.parse(readFileSync(memoryFile, 'utf8')) ?? {}
  } catch {
    memory = {}
  }
  const messages = []
  for (const name of Object.keys(readBrains())) {
    const m = (memory[name] ??= { misses: 0, open: {}, seen: [], lastNotice: '' })
    const first = !m.looked
    m.looked = true
    // Each problem has a key: told when it appears, and "resolved" when it goes away.
    const problems = {}
    let s = null
    try {
      s = await getState(name)
      m.misses = 0
      m.answered = now
    } catch (err) {
      m.misses += 1
      if (m.misses >= MISSES) problems.mudo = `🚨 El cerebro ${name} no contesta desde las ${hhmm(m.answered ?? now - MISSES * EVERY_MS)} (${err.message}). Puede ser el internet del cliente, un apagón o que alguien lo desconectó.`
    }
    if (s) {
      const e = s.estado ?? {}
      if (!s.servicio) problems.apagado = `🚨 El cerebro ${name} está apagado: sus IA's no contestan. Si no lo apagaste tú: node scripts/cerebro.mjs prender ${name}`
      else if (!e.latido || now - Date.parse(e.latido) > STALE_MS) problems.trabado = `🚨 El cerebro ${name} está prendido pero no da señales desde ${e.latido ? `las ${hhmm(Date.parse(e.latido))}` : 'que arrancó'}. Prueba: node scripts/cerebro.mjs reiniciar ${name}`
      if (e.sello && e.sello !== 'bien') problems[`sello:${e.sello}`] = `🚨 El sello del cerebro ${name} no cuadra (${e.sello}): alguien tocó su programa y no prendió ninguna IA. Reinstálalo con: node scripts/cerebro.mjs enviar ${name}`
      for (const [ia, st] of Object.entries(e.ias ?? {})) if (st !== 'prendida') problems[`ia:${ia}:${st}`] = `⚠️ En el cerebro ${name}, ${ia === 'anasofi' ? 'Ana Sofi' : ia} está ${st}.`
      // The brain's own notices, and the Mac's records: each told once.
      const notices = (e.avisos ?? []).filter((a) => a.at > m.lastNotice)
      if (notices.length) m.lastNotice = notices.at(-1).at
      const seen = new Set(m.seen)
      const fresh = [...(s.seguridad?.fallidos ?? []).map((l) => ['falla', l]), ...(s.seguridad?.entradas ?? []).map((l) => ['entrada', l])].filter(([, l]) => !seen.has(l))
      m.seen = [...m.seen, ...fresh.map(([, l]) => l)].slice(-200)
      if (!first) {
        for (const a of notices.slice(-3)) messages.push(`⚠️ Cerebro ${name}: ${a.text}`)
        const fails = fresh.filter(([k]) => k === 'falla')
        if (fails.length) messages.push(`🚨 En el cerebro ${name} alguien escribió mal la contraseña de administrador (${fails.length} ${fails.length === 1 ? 'vez' : 'veces'}):\n${fails.slice(-3).map(([, l]) => `• ${l.slice(0, 160)}`).join('\n')}\nSi no fuiste tú, alguien está intentando entrar.`)
        for (const [, l] of fresh.filter(([k]) => k === 'entrada').slice(-3)) messages.push(`🔐 Alguien entró al Mac mini del cerebro ${name} con la cuenta de administrador: ${l.slice(0, 160)}. Si no fuiste tú, avísame.`)
      }
    }
    // Problems that start, and problems that are over.
    for (const [key, text] of Object.entries(problems)) if (!m.open[key]) messages.push(text)
    for (const key of Object.keys(m.open)) if (!problems[key]) messages.push(`✅ Cerebro ${name}: ${{ mudo: 'volvió a contestar', apagado: 'está prendido otra vez', trabado: 'volvió a dar señales' }[key.split(':')[0]] ?? (key.startsWith('sello') ? 'el sello ya cuadra' : 'se resolvió el aviso')}.`)
    m.open = Object.fromEntries(Object.keys(problems).map((k) => [k, true]))
  }
  mkdirSync(dirname(memoryFile), { recursive: true })
  writeFileSync(memoryFile, `${JSON.stringify(memory, null, 1)}\n`)
  return messages
}

/** To the owner's own Telegram (NEX's bot), like the ads' alerts. */
async function tellOwner(text) {
  const tg = readTelegram()
  if (!tg?.token || !tg.owner?.id) return false
  try {
    await fetch(`https://api.telegram.org/bot${tg.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: tg.owner.id, text: text.slice(0, 4000) }),
    })
    return true
  } catch {
    return false
  }
}

/** Every five minutes while NEX is on, when there are brains. */
export function startBrainWatch() {
  if (!Object.keys(readBrains()).length) return
  let busy = false
  const run = async () => {
    if (busy) return
    busy = true
    try {
      for (const m of await checkBrains()) await tellOwner(m)
    } catch (err) {
      console.log(`[jarvis] brain watch: ${err.message}`)
    } finally {
      busy = false
    }
  }
  setTimeout(run, 30_000).unref?.()
  setInterval(run, EVERY_MS).unref?.()
  console.log(`[jarvis] brain watch on (${Object.keys(readBrains()).join(', ')})`)
}
