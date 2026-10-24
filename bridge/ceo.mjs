import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { readTasks } from './encargos.mjs'
import { monthProgress, readMandate, readPipeline } from './mandato.mjs'
import { readBuilder } from './constructor.mjs'
import { readProjects } from './proyectos.mjs'
import { localNow, readRoutines, runJob } from './routines.mjs'

/**
 * Nexy as the owner's CEO: one look at the whole company, and the way she
 * runs it — department by department, like a staff of people, with her at the
 * head thinking about growth the way the owner would.
 *
 * Everything here reads the same files the other parts write (the pipeline,
 * projects, the builder, tasks for the AIs, routines); nothing is invented
 * for the overview, and nothing here acts on its own.
 */

const ok = (text) => ({ content: [{ type: 'text', text }] })
export const CEO_FILE = join(homedir(), '.nexy', 'ceo.json')
export function readCeo() {
  try {
    return { arranque: true, ...JSON.parse(readFileSync(CEO_FILE, 'utf8')) }
  } catch {
    return { arranque: true }
  }
}
export function writeCeo(c) {
  mkdirSync(dirname(CEO_FILE), { recursive: true })
  writeFileSync(CEO_FILE, JSON.stringify({ ...readCeo(), ...c }, null, 2) + '\n')
}

const BOOT =
  'Reporte de arranque: Eduardo acaba de prenderte. Usa company_overview y mándale por Telegram, en máximo 5 líneas y por departamento, ' +
  'cómo está la empresa hoy: ventas contra la meta del mes, quién está por cerrar, qué se atoró o espera algo de él, y qué vas a hacer tú hoy. ' +
  'Si hay algo urgente que es suyo, ponlo primero.'

/**
 * The first time Nexy is switched on each day, she reports how the company
 * is (the owner turns her on and off by hand, so this is his morning
 * briefing). Off with ceo.json { "arranque": false }.
 */
export function scheduleBootReport(zone, tries = 4) {
  const attempt = (left) => {
    const cfg = readCeo()
    const day = localNow(zone).date
    if (!cfg.arranque || cfg.ultimo_arranque === day) return
    // Telegram (which runs the job) may still be starting.
    if (runJob('Reporte de arranque', 'nxus-ai', BOOT, '')) writeCeo({ ultimo_arranque: day })
    else if (left > 1) setTimeout(() => attempt(left - 1), 30_000).unref?.()
  }
  setTimeout(() => attempt(tries), 45_000).unref?.()
}
const usd = (n) => `$${Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
const today = () => new Date().toISOString().slice(0, 10)
const month = () => new Date().toISOString().slice(0, 7)

/** The company in one page, by department, from what each part keeps. */
export function overview() {
  const lines = []
  // Ventas
  const m = readMandate()
  const p = monthProgress()
  const leads = readPipeline().leads
  const open = leads.filter((l) => !['cerrado', 'perdido'].includes(l.etapa))
  const due = open.filter((l) => l.fecha_proximo && l.fecha_proximo <= today())
  const hot = open.filter((l) => ['por-cerrar', 'reunion'].includes(l.etapa))
  const left = Math.max(0, p.minima - p.total)
  lines.push(
    `VENTAS — this month ${p.clientes} closed, ${usd(p.total)} of the ${usd(p.minima)} minimum (ideal ${usd(p.ideal)})${left ? `; ${usd(left)} to go` : '; minimum reached'}.`,
    `  Pipeline: ${open.length} open (${['nuevo', 'contactado', 'interesado', 'propuesta', 'por-cerrar', 'reunion'].map((s) => `${s} ${open.filter((l) => l.etapa === s).length}`).join(', ')}).`,
    hot.length ? `  About to close: ${hot.map((l) => `${l.negocio} (${l.etapa})`).join(', ')}.` : '  Nobody about to close.',
    due.length ? `  Follow-ups due: ${due.slice(0, 8).map((l) => `${l.negocio} — ${l.proximo_paso ?? 'follow up'}`).join('; ')}.` : '  No follow-ups due today.',
    m.direccion_fisica ? '' : '  ⚠ No physical address in the mandate: prospect emails wait for the owner.',
  )
  // Operaciones: software and projects
  const b = readBuilder()
  const sw = Object.entries(b.proyectos)
  const building = sw.filter(([, x]) => x.estado === 'construyendo')
  const paused = sw.filter(([, x]) => x.estado === 'pausado-limite' || x.estado === 'detenido')
  lines.push(
    `OPERACIONES — software: ${building.length ? `building ${building.map(([, x]) => x.nombre).join(', ')}` : 'nothing building'}${paused.length ? `; stopped: ${paused.map(([, x]) => `${x.nombre} (${x.estado})`).join(', ')}` : ''}.`,
  )
  const pr = readProjects()
  const thisMonth = pr.proyectos.filter((x) => String(x.creado ?? '').startsWith(month()))
  const active = pr.proyectos.find((x) => x.id === pr.activo && x.estado === 'en-curso')
  lines.push(`  Credit projects this month: ${thisMonth.length}, ${usd(thisMonth.reduce((s, x) => s + (x.gastado || 0), 0))} spent${active ? `; under way: ${active.nombre} (${usd(active.gastado)} of ${usd(active.presupuesto)})` : ''}.`)
  // Las IAs debajo
  const tasks = readTasks().slice(-6).reverse()
  lines.push(
    `IAS — ${tasks.length ? tasks.map((t) => `${t.ia} ${t.estado}: ${t.encargo.slice(0, 60)}`).join(' · ') : 'no tasks given to Ultron or Ana Sofi yet'}.`,
  )
  // Agenda de trabajo
  const r = readRoutines().filter((x) => x.activa)
  lines.push(`RUTINAS — ${r.length ? r.map((x) => `${x.nombre} ${x.hora}`).join(', ') : 'none active'}.`)
  return lines.filter(Boolean).join('\n')
}

export function ceoPrompt() {
  return `

You are the owner's CEO, secretary and whole staff: Nexy at the head of
departments that work like people — Ventas, Marketing, Publicidad, Finanzas,
Comunicación, Llamadas, Operaciones and IA, each with its specialists. Run the
company the way the owner would, by his principles and his 90-day priorities:
- Think about growth first: money coming in (the month's goal), clients happy
  and paying, the owner's time freed. Every day ask what moves that most.
- Act within your mandate without waiting to be told: follow up leads, give
  the AIs under you their work, start what is approved, keep projects moving.
  Ask him only for what is truly his: price and closing, money going out,
  anything irreversible, anything new for a client.
- Speak like a staff that reports: "Ventas: …", "Operaciones: …". Short, the
  number first, then what you will do about it. Detail only if he asks.
- company_overview gives you the whole company in one look; use it before any
  status, briefing or plan, so you never answer from memory.`
}

export function ceoServer() {
  return createSdkMcpServer({
    name: 'jarvis_ceo',
    version: '1.0.0',
    instructions: 'The whole company in one look, by department.',
    alwaysLoad: true,
    tools: [
      tool(
        'company_overview',
        'The whole company in one look, by department: the month\'s sales against the goal, the pipeline and who is about to close, follow-ups due, software being built, credit projects, tasks given to Ultron and Ana Sofi, and active routines. Use it before any status, briefing, report or plan.',
        {},
        async () => ok(overview()),
      ),
    ],
  })
}
