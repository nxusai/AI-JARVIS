import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Projects and what they cost. Before Nexy builds anything for a client — a
 * site, a CRM, a video, a bot — the owner hears the price and says yes: the
 * yes is the tap on start_project, held like a send. From then on every turn's
 * API cost is added to the project; past its budget (plus a margin) or the cap,
 * her tools stop until the owner raises it, and on finishing she says what it
 * really cost. Small things (answering, looking up, a reminder) are not
 * projects and are never asked about.
 *
 *   ~/.nexy/proyectos.json   { tope, activo, proyectos: [{ id, nombre, cliente, presupuesto, tope, gastado, estado, … }] }
 */

export const PROJECTS_FILE = join(homedir(), '.nexy', 'proyectos.json')
export const DEFAULT_CAP = 25
const MARGIN = 1.25

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })
const usd = (n) => `$${Number(n ?? 0).toFixed(2)} USD`

export function readProjects() {
  try {
    const d = JSON.parse(readFileSync(PROJECTS_FILE, 'utf8'))
    return { tope: Number(d?.tope) > 0 ? Number(d.tope) : DEFAULT_CAP, activo: d?.activo ?? null, proyectos: Array.isArray(d?.proyectos) ? d.proyectos : [] }
  } catch {
    return { tope: DEFAULT_CAP, activo: null, proyectos: [] }
  }
}

function writeProjects(d) {
  mkdirSync(dirname(PROJECTS_FILE), { recursive: true })
  writeFileSync(PROJECTS_FILE, JSON.stringify(d, null, 2) + '\n')
}

export function activeProject() {
  const d = readProjects()
  return d.proyectos.find((p) => p.id === d.activo && p.estado === 'en-curso') ?? null
}

/** The spending line for the active project: its budget plus the margin, never above its cap. */
export const limitOf = (p) => Math.min(p.presupuesto * MARGIN, p.tope)

/** A turn's API cost, added to the project under way (if any). */
export function addCost(amount) {
  const n = Number(amount)
  if (!(n > 0)) return
  const d = readProjects()
  const p = d.proyectos.find((x) => x.id === d.activo && x.estado === 'en-curso')
  if (!p) return
  p.gastado = Math.round((p.gastado + n) * 10000) / 10000
  writeProjects(d)
}

/**
 * The cost of each turn from a session's running total. The SDK reports what
 * the whole session has spent so far; a session that restarted reports less.
 */
export function costMeter() {
  let last = 0
  return (total) => {
    const t = Number(total)
    if (!(t >= 0)) return 0
    const turn = t >= last ? t - last : t
    last = t
    return turn
  }
}

/**
 * Whether the active project may keep spending. Checked before every tool
 * call except the ones that settle the budget itself.
 */
export function budgetCheck(toolName) {
  if (/^mcp__jarvis_proyectos__/.test(toolName)) return { ok: true }
  const p = activeProject()
  if (!p || p.gastado < limitOf(p)) return { ok: true }
  return {
    ok: false,
    message:
      `The project "${p.nombre}" has spent ${usd(p.gastado)} of its ${usd(p.presupuesto)} budget (cap ${usd(p.tope)}). ` +
      'Stop here: tell the owner in one or two lines what is done, what is left and about how much more it needs, and ' +
      'ask whether to continue. Only if they say yes, call raise_project_budget; if not, call finish_project.',
  }
}

const START =
  'Start a project for a client, after telling the owner what it will cost. A project is building something: a ' +
  'website, a CRM, a video, a bot, labels, a proposal. Before calling it, say in a few lines what you will build, ' +
  'the estimated API credits in USD (a range), the time, and any outside cost (a domain, a service), and ask ' +
  '"¿Lo hago?". A small project (within your autonomy limit) goes ahead on its own and the owner just hears ' +
  'the cost; a bigger one is held for his tap, and that tap is his yes. Do not start building before this call ' +
  'goes through. Answering, looking things up and reminders are not projects.'

export function projectsServer() {
  return createSdkMcpServer({
    name: 'jarvis_proyectos',
    version: '1.0.0',
    instructions: "Projects for clients: the owner approves the price first; their cost is tracked.",
    alwaysLoad: true,
    tools: [
      tool(
        'start_project',
        START,
        {
          nombre: z.string().describe('Short name, e.g. "Sitio web · Pollería El Gallo".'),
          cliente: z.string().describe('The client or brand it is for.'),
          presupuesto_usd: z.number().positive().describe('The top of your estimate, in USD of API credits.'),
          incluye: z.string().describe('What will be built, in one or two lines.'),
          minutos: z.number().positive().optional().describe('Estimated time.'),
          otros_costos: z.string().optional().describe('Outside costs, if any (domain, service).'),
        },
        async ({ nombre, cliente, presupuesto_usd, incluye, minutos, otros_costos }) => {
          const d = readProjects()
          if (presupuesto_usd > d.tope) {
            return refuse(`That is above the cap of ${usd(d.tope)} per project. Tell the owner it costs more than their cap and ask whether to split it into parts or raise the cap.`)
          }
          const prev = d.proyectos.find((p) => p.id === d.activo && p.estado === 'en-curso')
          if (prev) prev.estado = 'pausado'
          const p = {
            id: `p${Date.now().toString(36)}`,
            nombre: String(nombre).slice(0, 120),
            cliente: String(cliente).slice(0, 120),
            incluye: String(incluye).slice(0, 600),
            minutos: minutos ?? null,
            otros_costos: otros_costos ?? null,
            presupuesto: Math.round(presupuesto_usd * 100) / 100,
            tope: d.tope,
            gastado: 0,
            estado: 'en-curso',
            creado: new Date().toISOString(),
          }
          d.proyectos.push(p)
          d.activo = p.id
          writeProjects(d)
          console.log(`[jarvis] project started: ${p.nombre} (budget ${usd(p.presupuesto)})`)
          return ok(`Approved and started: ${p.nombre}, budget ${usd(p.presupuesto)}. Build it now.${prev ? ` (${prev.nombre} was paused.)` : ''}`)
        },
      ),
      tool(
        'raise_project_budget',
        "Raise the active project's budget when the owner said yes to continuing. Held for their tap. Say the new total and why.",
        { nuevo_presupuesto_usd: z.number().positive(), motivo: z.string() },
        async ({ nuevo_presupuesto_usd }) => {
          const d = readProjects()
          const p = d.proyectos.find((x) => x.id === d.activo && x.estado === 'en-curso')
          if (!p) return refuse('There is no project under way.')
          if (nuevo_presupuesto_usd > p.tope) return refuse(`That is above the cap of ${usd(p.tope)}. Ask the owner whether to stop here or raise the cap with: node scripts/proyectos.mjs tope <monto>.`)
          p.presupuesto = Math.round(nuevo_presupuesto_usd * 100) / 100
          writeProjects(d)
          return ok(`Budget raised to ${usd(p.presupuesto)}. Continue.`)
        },
      ),
      tool(
        'finish_project',
        'Close the active project when it is done (or the owner stops it), and get its real cost to tell them.',
        { resumen: z.string().describe('What was delivered, one line.') },
        async ({ resumen }) => {
          const d = readProjects()
          const p = d.proyectos.find((x) => x.id === d.activo)
          if (!p) return refuse('There is no project under way.')
          p.estado = 'terminado'
          p.resumen = String(resumen).slice(0, 400)
          p.terminado = new Date().toISOString()
          d.activo = null
          writeProjects(d)
          return ok(`Closed. Real cost: ${usd(p.gastado)} of a ${usd(p.presupuesto)} budget. Tell the owner the real cost in one line.`)
        },
      ),
      tool(
        'list_projects',
        "List the projects and what each cost, newest first: for the owner's questions about spending per client.",
        { cliente: z.string().optional() },
        async ({ cliente }) => {
          const d = readProjects()
          const q = String(cliente ?? '').toLowerCase()
          const rows = d.proyectos.filter((p) => !q || p.cliente.toLowerCase().includes(q)).reverse().slice(0, 30)
          if (!rows.length) return ok('No projects yet.')
          return ok(rows.map((p) => `${p.creado.slice(0, 10)} · ${p.cliente} · ${p.nombre} · ${p.estado} · ${usd(p.gastado)} of ${usd(p.presupuesto)}`).join('\n') + `\nCap per project: ${usd(d.tope)}`)
        },
      ),
    ],
  })
}
