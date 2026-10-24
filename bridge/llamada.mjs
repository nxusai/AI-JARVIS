import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runJob } from './routines.mjs'

/**
 * What you ask NEX for during a phone call that cannot be settled by talking
 * (send, book, prepare, hand to Ultron) waits in the portal on Netlify
 * (portal/netlify/functions/nex-encargo.mjs). While NEX is on, he picks each
 * one up here, does it as an ordinary job with all his tools and the same
 * locks as anything else, and reports on Telegram.
 *
 *   ~/.nexy/llamada.json   { "url": "https://…", "clave": "…" }   (scripts/llamada.mjs)
 */

export const CALL_FILE = join(homedir(), '.nexy', 'llamada.json')
const EVERY_MS = 30_000

export function readCall() {
  try {
    const c = JSON.parse(readFileSync(CALL_FILE, 'utf8'))
    return c?.url && c?.clave ? { url: String(c.url).replace(/\/+$/, ''), clave: String(c.clave) } : null
  } catch {
    return null
  }
}

const PROMPT = (tarea, creado) =>
  `Encargo que Eduardo te dio por teléfono (${creado.slice(0, 16).replace('T', ' ')} UTC): "${tarea}". ` +
  'Hazlo completo con tus herramientas, dentro de tus reglas de siempre (lo que necesita su toque, lo espera). ' +
  'Al terminar mándale por Telegram, en dos o tres líneas, qué hiciste o qué falta y por qué.'

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
        // Telegram (which runs the job) may still be starting; try again next tick.
        if (!runJob('📞 Encargo por llamada', 'nxus-ai', PROMPT(e.tarea, e.creado), '')) break
        console.log('[jarvis] call task picked up')
        await fetch(api, { method: 'POST', headers, body: JSON.stringify({ id: e.id }) })
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
