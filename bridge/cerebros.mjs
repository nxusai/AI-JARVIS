import { spawn, execFileSync } from 'node:child_process'
import { createPrivateKey, sign } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { readAnaSofi } from './anasofi.mjs'
import { listClients, readLabelConfig, saveClient } from './etiquetas.mjs'
import { readTelegram } from './telegram-config.mjs'

/**
 * Nexy's side of the clients' brains (docs/cerebro-cliente.md): which brains
 * there are, and the door into each. Nexy goes to the brain, never the other
 * way: over SSH, with a key of Nexy's that the brain lets run only its door
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

/** Whether Ana Sofi answers from a brain now (then Nexy's own copy of her stays off). */
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
 * Once Ana Sofi answers from that brain, the sets changed there become Nexy's
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

/** What Nexy sends a brain as data: signed with the same key as the packages. */
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
