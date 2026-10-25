import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { overview } from './ceo.mjs'
import { runJob } from './routines.mjs'

/**
 * What you ask NEX for during a phone call that cannot be settled by talking
 * (send, book, prepare, hand to Ultron) waits in the portal on Netlify
 * (portal/netlify/functions/nex-encargo.mjs). While NEX is on, he picks each
 * one up here, does it as an ordinary job with all his tools and the same
 * locks as anything else, and reports on Telegram.
 *
 *   ~/.nexy/llamada.json   { "url": "https://…", "clave": "…", "negocio": true }   (scripts/llamada.mjs)
 */

export const CALL_FILE = join(homedir(), '.nexy', 'llamada.json')
const EVERY_MS = 30_000

/** Everything in llamada.json, as saved. */
export function readCallFile() {
  try {
    const c = JSON.parse(readFileSync(CALL_FILE, 'utf8'))
    return c && typeof c === 'object' ? c : {}
  } catch {
    return {}
  }
}

export function writeCallFile(patch) {
  mkdirSync(dirname(CALL_FILE), { recursive: true })
  writeFileSync(CALL_FILE, JSON.stringify({ ...readCallFile(), ...patch }, null, 2) + '\n')
  chmodSync(CALL_FILE, 0o600)
}

/** The portal the call tasks wait in, once connected. */
export function readCall() {
  const c = readCallFile()
  return c.url && c.clave ? { url: String(c.url).replace(/\/+$/, ''), clave: String(c.clave) } : null
}

/**
 * The company as it is right now, for the agent that calls the owner: it
 * travels with each call as the variable nex_negocio, so he can answer
 * questions about the business on the phone. Only once the agent's
 * instructions know the variable (scripts/llamada.mjs agente) — ElevenLabs
 * refuses a call whose variables do not match.
 */
export function businessForCall() {
  if (readCallFile().negocio !== true) return null
  try {
    const at = new Date().toLocaleString('es-MX', { timeZone: process.env.NEXY_TIMEZONE?.trim() || undefined, dateStyle: 'medium', timeStyle: 'short' })
    return `Al ${at}:\n${overview()}`.slice(0, 4000)
  } catch (err) {
    console.log(`[jarvis] call: no business summary (${err?.message ?? err})`)
    return 'No pude preparar el resumen del negocio para esta llamada.'
  }
}

const PROMPT = (tarea, creado) =>
  `Encargo que Eduardo te dio por teléfono (${creado.slice(0, 16).replace('T', ' ')} UTC): "${tarea}". ` +
  'Hazlo completo con tus herramientas, dentro de tus reglas de siempre (lo que necesita su toque, lo espera). ' +
  'Al terminar mándale por Telegram, en dos o tres líneas, qué hiciste o qué falta y por qué.'

const TAKEN_FILE = join(homedir(), '.nexy', 'llamada-tomados.json')
function taken() {
  try {
    const list = JSON.parse(readFileSync(TAKEN_FILE, 'utf8'))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
function remember(id) {
  mkdirSync(dirname(TAKEN_FILE), { recursive: true })
  writeFileSync(TAKEN_FILE, JSON.stringify([...taken(), id].slice(-500)) + '\n')
}
async function markTaken(api, headers, id) {
  const res = await fetch(api, { method: 'POST', headers, body: JSON.stringify({ id }) }).catch(() => null)
  if (!res?.ok) console.log(`[jarvis] call tasks: the portal did not record a task as taken (${res?.status ?? 'no answer'}); it will not run twice`)
}

export function startCallTasks() {
  const cfg = readCall()
  if (!cfg) {
    console.log('[jarvis] call tasks off — set them up with: node scripts/llamada.mjs')
    return
  }
  const headers = { 'x-nex-clave': cfg.clave, 'content-type': 'application/json' }
  const api = `${cfg.url}/.netlify/functions/nex-pendientes`
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      const res = await fetch(api, { headers })
      if (!res.ok) throw new Error(`portal ${res.status}`)
      const { encargos = [] } = await res.json()
      for (const e of encargos) {
        // Each task runs once, even if the portal never hears it was taken:
        // otherwise a failed "taken" would hand NEX the same job every 30 s
        // until he is too busy to answer anyone.
        if (taken().includes(e.id)) {
          await markTaken(api, headers, e.id)
          continue
        }
        // Telegram (which runs the job) may still be starting; try again next tick.
        if (!runJob('📞 Encargo por llamada', 'nxus-ai', PROMPT(e.tarea, e.creado), '')) break
        remember(e.id)
        console.log('[jarvis] call task picked up')
        await markTaken(api, headers, e.id)
      }
    } catch (err) {
      console.log(`[jarvis] call tasks: ${err?.message ?? err}`)
    } finally {
      busy = false
    }
  }
  setTimeout(tick, 20_000).unref?.()
  setInterval(tick, EVERY_MS).unref?.()
  console.log('[jarvis] call tasks on (from your phone calls)')
}
