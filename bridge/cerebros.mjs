import { spawn, execFileSync } from 'node:child_process'
import { createPrivateKey, sign } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { readAnaSofi } from './anasofi.mjs'
import { listClients, readLabelConfig, saveClient } from './etiquetas.mjs'
import { readTelegram } from './telegram-config.mjs'
import { readUltron } from './nucleo/ultron.mjs'

/**
 * NEX's side of the clients' brains (docs/cerebro-cliente.md): which brains
 * there are, and the door into each. NEX goes to the brain, never the other
 * way: over SSH, with a key of NEX's that the brain lets run only its door
 * (bridge/cerebro/canal.sh) — read its state, take a copy of its labels,
 * install a signed package, apply signed data, restart, stop, or wipe its keys.
 *
 *   ~/.nexy/cerebros.json               { <nombre>: { host, usuario, anasofi?: 'cerebro', ultron?: 'cerebro', ventas?: 'cerebro', apagado?: true } }
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
/** Ultron answers from a brain: NEX no longer starts her own (she keeps her tools over him). */
export const ultronMoved = () => Object.values(readBrains()).some((b) => b.ultron === 'cerebro')
/** Ana Sofi's sales line calls from a brain: NEX only keeps the owner's calls (the morning one, an hour before, a new meeting). */
export const salesMoved = () => Object.values(readBrains()).some((b) => b.ventas === 'cerebro')

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
/** Ultron's voice: the one chosen for his live agent (scripts/ultron-voz.mjs), so he sounds the same everywhere. */
function vozDeUltron() {
  try {
    const v = JSON.parse(readFileSync(join(homedir(), '.nexy', 'ultron-voz.json'), 'utf8'))?.voiceId
    if (/^[A-Za-z0-9]{20}$/.test(v ?? '')) return v
  } catch {}
  return readUltron()?.voz ?? null
}

export function buildData({ labels = false, ultron, apagado, ventas } = {}) {
  let sales = {}
  try {
    sales = JSON.parse(readFileSync(join(homedir(), '.nexy', 'ventas.json'), 'utf8')) ?? {}
  } catch {}
  const ana = readAnaSofi() ?? {}
  const data = {
    tipo: 'datos',
    fecha: new Date().toISOString(),
    anasofi: { grupo: ana.grupo ?? null, voz: ana.voz ?? null, voz_es: ana.voz_es ?? null, voz_en: ana.voz_en ?? null },
    ...(readTelegram()?.owner?.id ? { cerebro: { dueno: readTelegram().owner.id } } : {}),
    ...(readLabelConfig().canal ? { canal: readLabelConfig().canal } : {}),
    ...(labels ? { etiquetas: Object.fromEntries(listClients().map((c) => [c.id, c])) } : {}),
    // Whether Ultron answers from the brain (moving day or calling it off), with his voice.
    ...(typeof ultron === 'boolean' || typeof apagado === 'boolean' || vozDeUltron()
      ? { ultron: { ...(typeof ultron === 'boolean' ? { prendido: ultron } : {}), ...(typeof apagado === 'boolean' ? { apagado } : {}), ...(vozDeUltron() ? { voz: vozDeUltron() } : {}) } }
      : {}),
    // Ana Sofi's sales line: whether it calls from the brain, with her agent and number (no keys).
    ...(typeof ventas === 'boolean' ? { ventas: { prendido: ventas, agentId: sales.agentId, phoneId: sales.phoneId, avisos: sales.avisos === 'todo' ? 'todo' : 'meetings' } } : {}),
  }
  const body = JSON.stringify(data)
  const key = createPrivateKey(readFileSync(SIGNING_KEY, 'utf8'))
  return `${sign(null, Buffer.from(body), key).toString('base64')}\n${body}`
}

// -- the watch -------------------------------------------------------------------

const WATCH_FILE = join(MIRRORS, 'vigilancia.json')
const EVERY_MS = 60_000
/** Fifteen looks in a row with no answer (15 minutes) before saying it does not answer. */
const MISSES = 15
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
        const stop = `Si no fuiste tú, toca 🛑 Cortar todo (o escríbeme "corta todo"): apago el cerebro y borro sus llaves. Desde tu Mac también: node scripts/cerebro.mjs borrar-llaves ${name}. Luego cambia las llaves en Anthropic, ElevenLabs, BotFather y Supabase.`
        if (fails.length) {
          m.lastFail = now
          messages.push(`🚨 En el cerebro ${name} alguien escribió mal la contraseña de administrador (${fails.length} ${fails.length === 1 ? 'vez' : 'veces'}):\n${fails.slice(-3).map(([, l]) => `• ${l.slice(0, 160)}`).join('\n')}\nAlguien está intentando entrar. ${stop}`)
        }
        // A login right after wrong passwords is someone getting in; a login alone is almost always the owner.
        const suspicious = m.lastFail && now - m.lastFail < 30 * 60_000
        for (const [, l] of fresh.filter(([k]) => k === 'entrada').slice(-3))
          messages.push(
            suspicious
              ? `🚨 Alguien entró al Mac mini del cerebro ${name} con la cuenta de administrador después de intentos fallidos: ${l.slice(0, 160)}. ${stop}`
              : `🔐 Alguien entró al Mac mini del cerebro ${name} con la cuenta de administrador: ${l.slice(0, 160)}. Si no fuiste tú, avísame.`,
          )
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

/** The emergency stop: the brain goes off and its keys are wiped (canal.sh borrar-llaves). */
export async function cutBrain(name) {
  if (!readBrains()[name]) return `No conozco el cerebro "${name}".`
  try {
    const r = await order(name, 'borrar-llaves', null, { timeoutMs: 60_000 })
    const out = r.out.toString().trim()
    return r.code === 0 ? `🛑 Cerebro ${name}: ${out || 'llaves borradas y cerebro apagado'}.` : `❌ No pude cortar el cerebro ${name}: ${out || r.err || `respondió ${r.code}`}`
  } catch (err) {
    return `❌ No pude hablar con el cerebro ${name}: ${err.message}. Si no contesta, desconéctalo de la luz o del internet en la oficina.`
  }
}

/** The button under an alarm: asks once more before cutting. */
export const cutButton = (name) => ({ inline_keyboard: [[{ text: '🛑 Cortar todo', callback_data: `corte:${name}` }]] })

/** To the owner's own Telegram (NEX's bot), like the ads' alerts. Alarms carry the cut button. */
async function tellOwner(text) {
  const tg = readTelegram()
  if (!tg?.token || !tg.owner?.id) return false
  const brain = URGENT.test(text) ? /cerebro (\S+?)[\s:]/.exec(text)?.[1] : null
  try {
    await fetch(`https://api.telegram.org/bot${tg.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: tg.owner.id, text: text.slice(0, 4000), ...(brain && readBrains()[brain] ? { reply_markup: cutButton(brain) } : {}) }),
    })
    return true
  } catch {
    return false
  }
}

/** What is worth a phone call, not only a message: someone trying the password, or the program touched. */
export const URGENT = /escribió mal la contraseña de administrador|administrador después de intentos fallidos|El sello del cerebro .* no cuadra/

/** The call's words: short, to be heard. */
export function spokenAlarm(text) {
  const brain = /cerebro (\S+)/.exec(text)?.[1] ?? ''
  const where = brain ? ` del cerebro de ${brain.replace(/-/g, ' ')}` : ''
  if (/después de intentos fallidos/.test(text)) {
    return `Boss, urgente: alguien logró entrar al Mac mini${where} con la cuenta de administrador, después de equivocarse con la contraseña. Si no fuiste tú, corta todo ya: en Telegram toca el botón rojo, Cortar todo.`
  }
  if (/contraseña/.test(text)) {
    const times = /\((\d+) ve/.exec(text)?.[1]
    return `Boss, alguien está intentando entrar al Mac mini${where}. Escribieron mal la contraseña de administrador${times ? ` ${times} ${times === '1' ? 'vez' : 'veces'}` : ''}. Todavía no entran. Los detalles y qué hacer están en Telegram.`
  }
  return `Boss, alguien le movió al programa${where}: el sello no cuadra y no prendió ninguna inteligencia artificial. Los detalles y qué hacer están en Telegram.`
}

/** Every minute while NEX is on, when there are brains. Security alarms also ring the owner. */
export function startBrainWatch({ callOwner = null } = {}) {
  if (!Object.keys(readBrains()).length) return
  let busy = false
  let lastCall = 0
  const run = async () => {
    if (busy) return
    busy = true
    try {
      for (const m of await checkBrains()) {
        await tellOwner(m)
        // One call every 10 minutes at most (the rest of a burst goes to Telegram), except someone getting in.
        if (callOwner && URGENT.test(m) && (Date.now() - lastCall > 10 * 60_000 || /después de intentos fallidos/.test(m))) {
          lastCall = Date.now()
          const failed = await callOwner(spokenAlarm(m))
          if (failed) {
            lastCall = 0
            await tellOwner(`☎️ No pude llamarte por esta alerta: ${failed}.`)
          }
        }
      }
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
