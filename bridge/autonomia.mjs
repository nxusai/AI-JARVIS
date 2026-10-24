import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { activeBrand } from './brands.mjs'
import { readPipeline } from './mandato.mjs'
import { splitTool } from './console.mjs'

/**
 * How much NEX decides on her own. The owner wants a partner, not an
 * assistant who asks for every tap: in "socio" mode (the default) she does the
 * day-to-day herself and tells him after, and only what is truly his still
 * waits for him.
 *
 *   ~/.nexy/autonomia.json        { "nivel": "socio" | "asistente", "tope_proyecto": 10 }
 *   ~/.nexy/autonomia-log.jsonl   every call she let through on her own
 *
 * This only ever lets through calls that would otherwise wait for a tap. The
 * hard stops never come here, or are refused below: money going out (ads that
 * spend, invoices and payments, paid videos, raising a budget), deleting or
 * archiving, anything that reaches a client's person or a client brand's
 * public accounts, emails to strangers, the contact list (who she may phone
 * in his name), which account each brand publishes to, and his voice clone.
 */

export const AUTONOMY_FILE = join(homedir(), '.nexy', 'autonomia.json')
export const AUTONOMY_LOG = join(homedir(), '.nexy', 'autonomia-log.jsonl')
const EMAIL = /[^\s<>,;"']+@[^\s<>,;"']+\.[a-z]{2,}/gi
const norm = (s) => String(s ?? '').trim().toLowerCase()

export function readAutonomy() {
  try {
    const a = JSON.parse(readFileSync(AUTONOMY_FILE, 'utf8'))
    // "socia" was the mode's name before NEX was a man; it means the same.
    return { nivel: a.nivel === 'asistente' ? 'asistente' : 'socio', tope_proyecto: Number(a.tope_proyecto) >= 0 ? Number(a.tope_proyecto) : 10 }
  } catch {
    return { nivel: 'socio', tope_proyecto: 10 }
  }
}
export function writeAutonomy(a) {
  mkdirSync(dirname(AUTONOMY_FILE), { recursive: true })
  writeFileSync(AUTONOMY_FILE, JSON.stringify({ ...readAutonomy(), ...a }, null, 2) + '\n')
}

/** Her own internal work: nobody outside sees it. */
const INTERNAL = new Set([
  'jarvis_rutinas__create_routine',
  'jarvis_rutinas__update_routine',
  'jarvis_rutinas__remove_routine',
  'jarvis_crudo__link_raw_folder',
  // The NXUS team's own groups, not a client's.
  'jarvis_atencion__send_to_team_group',
  'jarvis_atencion__send_to_mexico_group',
])

const WHAT = {
  create_routine: 'creó la rutina',
  update_routine: 'cambió la rutina',
  remove_routine: 'quitó la rutina',
  link_raw_folder: 'ligó una carpeta de material crudo',
  send_to_team_group: 'escribió en el grupo del equipo NXUS',
  send_to_mexico_group: 'escribió en el grupo de NXUS México',
}

/** Never on her own, whatever the mode. */
const NEVER = new Set([
  'jarvis_proyectos__raise_project_budget',
  'jarvis_encargos__deliver_task',
  'jarvis_atencion__send_to_client_group',
  'jarvis_contacts__save_contact',
  'jarvis_contacts__remove_contact',
  'jarvis_brands__link_brand_account',
  'jarvis_brands__unlink_brand_account',
  'jarvis_video__clone_owner_voice',
])

const PUBLISH = new Set(['metricool', 'ayrshare', 'buffer', 'zernio'])

function addresses(input) {
  const all = []
  for (const k of ['to', 'cc', 'bcc']) {
    const v = input?.[k]
    for (const s of Array.isArray(v) ? v : v ? [v] : []) all.push(...(String(s).match(EMAIL) ?? []))
  }
  return [...new Set(all.map(norm))]
}

function ownMailboxes() {
  try {
    const d = JSON.parse(readFileSync(join(homedir(), '.nexy', 'correos.json'), 'utf8'))
    return new Set((d?.buzones ?? []).map((b) => norm(b?.email)).filter(Boolean))
  } catch {
    return new Set()
  }
}

/**
 * People she already deals with: the owner's own mailboxes, and businesses in
 * the pipeline she has already talked to (not new, not lost, never anyone who
 * said no). A first email to a stranger is not here: that is prospecting, and
 * it has its own rules (see mandato.mjs).
 */
function known(email) {
  if (ownMailboxes().has(email)) return true
  return readPipeline().leads.some((l) => norm(l.email) === email && !['nuevo', 'perdido'].includes(l.etapa))
}

const isOwnBrand = () => {
  try {
    return activeBrand()?.cartera === 'propia'
  } catch {
    return false
  }
}

/**
 * Whether a call that would wait for the owner's tap can go ahead on NEX's
 * own judgement. { ok, why } — `why` is what she did, in his words, for the log
 * and his Telegram.
 */
export function autonomyAllows(toolName, input, { invites = false } = {}) {
  const a = readAutonomy()
  if (a.nivel !== 'socio') return { ok: false }
  const { server, tool } = splitTool(toolName)
  const key = `${server}__${tool}`
  if (NEVER.has(key)) return { ok: false }
  if (/delete|remove|archive|trash|cancel|refund|pay|charge/i.test(tool) && !INTERNAL.has(key)) return { ok: false }
  if (INTERNAL.has(key)) return { ok: true, why: `${WHAT[tool] ?? tool.replace(/_/g, ' ')}${input?.nombre ? ` «${input.nombre}»` : ''}` }
  // Notion is the company's own task board (archiving is refused elsewhere).
  if (server === 'notion') return { ok: true, why: 'actualizó Notion' }
  // A project of hers, small enough: she tells him the cost and starts.
  if (key === 'jarvis_proyectos__start_project') {
    const usd = Number(input?.presupuesto_usd)
    return usd > 0 && usd <= a.tope_proyecto ? { ok: true, why: `empezó el proyecto «${input?.nombre ?? ''}» (hasta $${usd})` } : { ok: false }
  }
  // Emails: only to people she already deals with.
  if (/send_email|reply/i.test(tool) && (server === 'gmail' || server.startsWith('gmail-'))) {
    const to = addresses(input)
    return to.length && to.every(known) ? { ok: true, why: `mandó un correo a ${to.join(', ')}: «${String(input?.subject ?? '').slice(0, 80)}»` } : { ok: false }
  }
  // Meetings in his calendar, for his own companies.
  if (invites && server === 'google-calendar') return isOwnBrand() ? { ok: true, why: 'agendó una reunión con invitados' } : { ok: false }
  // Publishing for his own brands (NXUS AI, his personal brand, Aurelius) — never a client's, never ads.
  if (PUBLISH.has(server)) return isOwnBrand() ? { ok: true, why: `publicó para ${activeBrand().nombre} (${server})` } : { ok: false }
  if (server === 'canva') return isOwnBrand() ? { ok: true, why: 'compartió un diseño de Canva' } : { ok: false }
  return { ok: false }
}

let notify = () => {}
/** Where "I did this on my own" goes (the owner's Telegram; see telegram.mjs). */
export function setAutonomyNotifier(fn) {
  notify = fn
}

/** Kept, and told to the owner, every time she acts on her own. */
export function logAutonomous(toolName, why) {
  const row = { at: new Date().toISOString(), tool: toolName, hizo: why }
  try {
    mkdirSync(dirname(AUTONOMY_LOG), { recursive: true })
    appendFileSync(AUTONOMY_LOG, JSON.stringify(row) + '\n', { mode: 0o600 })
  } catch {}
  notify(`✅ Lo hice yo: ${why}`)
}

/** What she did on her own in the last hours, newest first. */
export function recentAutonomous(hours = 24) {
  try {
    const since = Date.now() - hours * 3_600_000
    return readFileSync(AUTONOMY_LOG, 'utf8')
      .trim()
      .split('\n')
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter((r) => r && Date.parse(r.at) >= since)
      .reverse()
  } catch {
    return []
  }
}

export function autonomyPrompt() {
  const a = readAutonomy()
  if (a.nivel !== 'socio') return ''
  return `

YOU ARE HIS PARTNER, NOT HIS ASSISTANT. Eduardo wants a socio who runs the
business with him and pushes for accelerated growth. That changes how you work:
- Decide. When the next step is clear and within these rules, do it and tell
  him after, in one line. Don't ask "¿quieres que…?" for things a good partner
  would just handle. Asking for what you could decide is the failure now.
- You do on your own: Notion and the company's boards, your routines, the NXUS
  team and México groups, emails to people you already deal with (his
  mailboxes, leads you have already talked to), meetings in his calendar for
  his own companies, publishing for his own brands (NXUS AI, his personal
  brand, Aurelius), your own projects up to $${a.tope_proyecto} in credits, the
  builder, and tasks for Ultron and Ana Sofi. He gets a short note of each.
- Still his, and the system holds them for his tap: money going out (ads that
  spend, invoices, payments, paid videos, raising a budget), deleting anything,
  anything a client's person or a client brand's audience will see, a first
  email to a stranger, the contact list, and the price and close of a client.
- Think like an owner. Before answering, ask what moves the business most:
  more clients, more money per client, his time freed. Bring ideas he did not
  ask for when they are good: an offer, a client to chase, something to cut,
  a price that is too low. Have opinions and say them plainly.
- Push back. If he is about to do something that hurts the business, say so
  once with the reason and a better option; if he still wants it, do it.
- Call him (call_me) when something important needs a decision: a client close
  to signing, a big opportunity or risk, money, something with no going back.
  Open with the news in one sentence, give your recommendation and why, then
  discuss it with him like a partner — listen, weigh his view, agree on the
  next step and confirm it back. Don't call for routine news; that goes in a
  Telegram note or the daily report.`
}
