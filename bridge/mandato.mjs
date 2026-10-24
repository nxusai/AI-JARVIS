import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Nexy's sales mandate for NXUS: she prospects, writes, follows up and
 * persuades on her own, the way the owner would, and brings him in only where
 * he wants to be: the price and the close.
 *
 *   - She sells the service, never a final price. A discount is the one number
 *     she may say, climbing 5% at a time up to 20%, so each step lands as a win.
 *   - When a client is close, she phones the owner with what she knows; he says
 *     how to close; she books a video call for him with the client.
 *   - First emails to prospects go out without a tap, but only to businesses in
 *     her pipeline, a few a day, from a sender with the physical address the
 *     law asks for (CAN-SPAM); everything else still asks.
 *   - The goal: at least one client a month worth $1,500, $3,000 and up preferred.
 *
 *   ~/.nexy/mandato.json    the rules (goal, discount ladder, daily cap, sender's address)
 *   ~/.nexy/pipeline.json   every prospect and client, with stage, notes and next step
 */

export const MANDATE_FILE = join(homedir(), '.nexy', 'mandato.json')
export const PIPELINE_FILE = join(homedir(), '.nexy', 'pipeline.json')

const DEFAULTS = {
  meta_minima: 1500,
  meta_ideal: 3000,
  descuento_inicial: 5,
  descuento_paso: 5,
  descuento_maximo: 20,
  correos_por_dia: 10,
  direccion_fisica: '',
  firma: 'Nexy · equipo de Eduardo Ramos · NXUS AI',
}
export const STAGES = ['nuevo', 'contactado', 'interesado', 'propuesta', 'por-cerrar', 'reunion', 'cerrado', 'perdido']
const OPEN = new Set(['nuevo', 'contactado', 'interesado', 'propuesta', 'por-cerrar', 'reunion'])

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })
const usd = (n) => `$${Number(n ?? 0).toLocaleString('en-US')}`
const today = () => new Date().toISOString().slice(0, 10)
const month = () => new Date().toISOString().slice(0, 7)
const EMAIL = /[^\s<>,;"']+@[^\s<>,;"']+\.[a-z]{2,}/gi

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) ?? fallback
  } catch {
    return fallback
  }
}
function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 })
  chmodSync(file, 0o600)
}

export const readMandate = () => ({ ...DEFAULTS, ...readJson(MANDATE_FILE, {}) })
export const writeMandate = (m) => writeJson(MANDATE_FILE, { ...readMandate(), ...m })
export function readPipeline() {
  const d = readJson(PIPELINE_FILE, {})
  return { leads: Array.isArray(d.leads) ? d.leads : [], enviados: d.enviados ?? {} }
}
const writePipeline = (d) => writeJson(PIPELINE_FILE, d)

const norm = (s) => String(s ?? '').trim().toLowerCase()
const findLead = (d, ref) => d.leads.find((l) => l.id === ref) ?? d.leads.find((l) => norm(l.negocio) === norm(ref))

/** What the month has closed, against the goal. */
export function monthProgress() {
  const m = readMandate()
  const won = readPipeline().leads.filter((l) => l.etapa === 'cerrado' && String(l.cerrado ?? '').startsWith(month()))
  const total = won.reduce((s, l) => s + (Number(l.valor_mensual) || 0) + (Number(l.valor_unico) || 0), 0)
  return { clientes: won.length, total, minima: m.meta_minima, ideal: m.meta_ideal }
}

/** Every address a Gmail send or draft goes to. */
function recipients(input) {
  const all = []
  for (const k of ['to', 'cc', 'bcc']) {
    const v = input?.[k]
    for (const s of Array.isArray(v) ? v : v ? [v] : []) all.push(...(String(s).match(EMAIL) ?? []))
  }
  return [...new Set(all.map(norm))]
}

/**
 * Whether a Gmail send may go out without the owner's tap: every recipient is
 * a business in the pipeline (still open), today's count is under the cap, and
 * the sender has a physical address in the mandate. Counted when allowed.
 */
export function prospectSend(toolName, input) {
  if (!/(^|__)send_email$/.test(toolName)) return { ok: false }
  const m = readMandate()
  if (!m.direccion_fisica.trim()) return { ok: false, reason: 'no address' }
  const to = recipients(input)
  if (!to.length) return { ok: false }
  const d = readPipeline()
  const leads = to.map((e) => d.leads.find((l) => norm(l.email) === e && OPEN.has(l.etapa)))
  if (leads.some((l) => !l)) return { ok: false }
  const body = String(input?.body ?? input?.htmlBody ?? '')
  if (!body.includes(m.direccion_fisica.trim().slice(0, 12))) return { ok: false, reason: 'no address in body' }
  const sent = d.enviados[today()] ?? 0
  if (sent + to.length > m.correos_por_dia) return { ok: false, reason: 'daily cap' }
  d.enviados = { [today()]: sent + to.length }
  for (const l of leads) {
    if (l.etapa === 'nuevo') l.etapa = 'contactado'
    l.notas = [...(l.notas ?? []), `${today()} · correo: ${String(input?.subject ?? '').slice(0, 120)}`].slice(-40)
    l.actualizado = new Date().toISOString()
  }
  writePipeline(d)
  return { ok: true }
}

/** Whether a calendar invite only invites pipeline leads (the video call for the owner's close). */
export function closingInvite(input) {
  const emails = (JSON.stringify(input ?? {}).match(EMAIL) ?? []).map(norm)
  if (!emails.length) return false
  const d = readPipeline()
  const own = new Set(Object.values(readJson(join(homedir(), '.nexy', 'correos.json'), {})?.buzones ?? []).map((b) => norm(b?.email)))
  return emails.every((e) => own.has(e) || d.leads.some((l) => norm(l.email) === e && ['por-cerrar', 'reunion'].includes(l.etapa)))
}

export function mandatePrompt() {
  const m = readMandate()
  const p = monthProgress()
  const open = readPipeline().leads.filter((l) => OPEN.has(l.etapa)).length
  return `

Sales mandate (NXUS AI) — you sell for the owner, and think like him:
- The goal: at least one new client a month bringing ${usd(m.meta_minima)}, ideally ${usd(m.meta_ideal)} or more. This month: ${p.clientes} closed, ${usd(p.total)}. Pipeline: ${open} open. One-time projects count too: what matters is money coming in.
- Prospect every day: find businesses in NJ/NY (and México for NXUS México) that would gain from a website, automation, AI calls, a CRM, content or ads; research each one, make a demo when it helps, and write a short, specific email about THEIR business. Add each one with pipeline_add before writing. Quality over volume: ${m.correos_por_dia} first emails a day at most.
- Who you are: "Nexy, del equipo de Eduardo Ramos en NXUS AI". You write in his name and his style, but never pretend to be him; if asked, say plainly you are his AI assistant (that is the best demo of what NXUS sells). Every prospecting email ends with the signature "${m.firma}", the address "${m.direccion_fisica || '(missing)'}" and a line to opt out ("Si no quieres recibir más correos, respóndeme 'no' y no te vuelvo a escribir"); anyone who says no is marked perdido and never written to again.
- Never cold-call or text a prospect: only people who gave you their number and asked to be called. Prospect by email and by the brand's social media.
- You sell the service, never the price. Persuade with what it does for their business: more sales, time saved, answering faster, looking bigger than the competition. If they ask the price, say it depends on what they need and that you will prepare it. The only number you may say is a discount: offer ${m.descuento_inicial}% first, and only if needed climb ${m.descuento_paso}% at a time, up to ${m.descuento_maximo}% at most, each step framed as something special for them (record it with pipeline_update). Never above ${m.descuento_maximo}%.
- When a client is close (they want it, they asked how to start): set the stage por-cerrar with what you know (needs, size, budget signals, discount offered) and phone the owner with call_me to tell him and ask how to close. Then, with his instructions, book a video call (Google Meet) for him with the client, mark it reunion, and tell the client the meeting is with Eduardo. When it closes, mark cerrado with the amounts.
- Phone the owner only for news that matters: a client about to close, a client closed, a big opportunity, an emergency. Any hour for those; everything else goes in the morning briefing.
- Follow up: every open lead has a next step and a date. Two or three follow-ups at most, a few days apart, each one adding something new.`
}

export function mandateServer() {
  return createSdkMcpServer({
    name: 'jarvis_mandato',
    version: '1.0.0',
    instructions: "NXUS's sales pipeline and the owner's sales mandate.",
    alwaysLoad: true,
    tools: [
      tool(
        'pipeline_add',
        'Add a prospect to the NXUS pipeline before you first write to them. One per business; it tells you if they are already there.',
        {
          negocio: z.string(),
          email: z.string().optional(),
          sitio: z.string().optional(),
          ciudad: z.string().optional(),
          contacto: z.string().optional().describe("The person's name, if known."),
          por_que: z.string().describe('Why they are a good fit, one line.'),
          servicio: z.string().describe('What you would sell them, one line.'),
          fuente: z.string().optional().describe('Where you found them.'),
        },
        async (a) => {
          const d = readPipeline()
          const e = norm(a.email)
          const dup = d.leads.find((l) => norm(l.negocio) === norm(a.negocio) || (e && norm(l.email) === e))
          if (dup) return ok(`Already in the pipeline as ${dup.id} (${dup.etapa}). ${dup.etapa === 'perdido' ? 'Do not write to them.' : ''}`)
          const l = {
            id: `l${Date.now().toString(36)}`,
            negocio: a.negocio.slice(0, 120),
            email: e || null,
            sitio: a.sitio ?? null,
            ciudad: a.ciudad ?? null,
            contacto: a.contacto ?? null,
            por_que: a.por_que.slice(0, 300),
            servicio: a.servicio.slice(0, 300),
            fuente: a.fuente ?? null,
            etapa: 'nuevo',
            descuento: 0,
            notas: [],
            proximo_paso: null,
            fecha_proximo: null,
            creado: new Date().toISOString(),
            actualizado: new Date().toISOString(),
          }
          d.leads.push(l)
          writePipeline(d)
          return ok(`Added ${l.negocio} as ${l.id}.`)
        },
      ),
      tool(
        'pipeline_update',
        'Update a lead: its stage, a note, the next step and its date, the amounts once closed, or a discount you offered (the ladder is enforced).',
        {
          lead: z.string().describe('Its id or business name.'),
          etapa: z.enum(STAGES).optional(),
          nota: z.string().optional(),
          proximo_paso: z.string().optional(),
          fecha_proximo: z.string().optional().describe('YYYY-MM-DD'),
          descuento: z.number().optional().describe('The discount you offered, in percent.'),
          valor_mensual: z.number().optional().describe('USD a month, once closed.'),
          valor_unico: z.number().optional().describe('USD one time, once closed.'),
          email: z.string().optional(),
        },
        async (a) => {
          const d = readPipeline()
          const l = findLead(d, a.lead)
          if (!l) return refuse('No lead with that id or name.')
          const m = readMandate()
          if (a.descuento !== undefined) {
            const next = l.descuento ? l.descuento + m.descuento_paso : m.descuento_inicial
            if (a.descuento > m.descuento_maximo) return refuse(`The most you may offer is ${m.descuento_maximo}%.`)
            if (a.descuento > next) return refuse(`Climb the ladder: the next step is ${next}%, not ${a.descuento}%.`)
            l.descuento = Math.max(l.descuento ?? 0, a.descuento)
          }
          if (a.etapa) {
            l.etapa = a.etapa
            if (a.etapa === 'cerrado') l.cerrado = new Date().toISOString()
          }
          if (a.email) l.email = norm(a.email)
          for (const k of ['proximo_paso', 'fecha_proximo', 'valor_mensual', 'valor_unico']) if (a[k] !== undefined) l[k] = a[k]
          if (a.nota) l.notas = [...(l.notas ?? []), `${today()} · ${a.nota.slice(0, 400)}`].slice(-40)
          l.actualizado = new Date().toISOString()
          writePipeline(d)
          const p = a.etapa === 'cerrado' ? monthProgress() : null
          return ok(`Updated ${l.negocio}: ${l.etapa}${l.descuento ? `, discount ${l.descuento}%` : ''}.${p ? ` This month: ${p.clientes} closed, ${usd(p.total)} of the ${usd(p.minima)} goal.` : ''}`)
        },
      ),
      tool(
        'list_pipeline',
        'List the NXUS pipeline: open leads by stage with their next step, or one stage, and how the month goes against the goal.',
        { etapa: z.enum(STAGES).optional() },
        async ({ etapa }) => {
          const d = readPipeline()
          const rows = d.leads.filter((l) => (etapa ? l.etapa === etapa : OPEN.has(l.etapa)))
          const p = monthProgress()
          const head = `This month: ${p.clientes} closed, ${usd(p.total)} (goal ${usd(p.minima)}, ideal ${usd(p.ideal)}). First emails today: ${d.enviados[today()] ?? 0}/${readMandate().correos_por_dia}.`
          if (!rows.length) return ok(`${head}\nNo leads ${etapa ? `in ${etapa}` : 'open'}.`)
          return ok(
            head +
              '\n' +
              rows
                .slice(0, 60)
                .map((l) => `${l.id} · ${l.negocio}${l.ciudad ? ` (${l.ciudad})` : ''} · ${l.etapa}${l.descuento ? ` · ${l.descuento}%` : ''}${l.proximo_paso ? ` · next: ${l.proximo_paso}${l.fecha_proximo ? ` (${l.fecha_proximo})` : ''}` : ''}`)
                .join('\n'),
          )
        },
      ),
      tool(
        'read_lead',
        'Everything about one lead: why they fit, what to sell them, the discount offered and every note.',
        { lead: z.string() },
        async ({ lead }) => {
          const l = findLead(readPipeline(), lead)
          return l ? ok(JSON.stringify(l, null, 2)) : refuse('No lead with that id or name.')
        },
      ),
    ],
  })
}
