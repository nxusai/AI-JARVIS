import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The builder: NEX hands software work to Claude Code running on this Mac,
 * signed in with the owner's Claude subscription — not the API credits, which
 * stay for her calls and messages.
 *
 * Every project has a folder of its own, ~/Documents/Nexy/proyectos/<id>, with
 * its own git history, and a conversation the builder picks up again next
 * time, like going back to the same tab. The ones already made with NEX (the
 * Abuelito and Aurelius sites, the work centre, the portal) are copied there
 * the first time, so an update of NEX's own folder never overwrites them.
 *
 * The builder works only inside its project's folder: its file tools are
 * fenced to it, and its shell may not touch NEX's keys, push, publish to
 * production or use sudo. When the subscription's limit is reached it stops
 * and says so; it never falls back to spending API credits.
 *
 *   ~/.nexy/constructor.json   { proyectos: { <id>: { nombre, carpeta, origen?, sesion?, estado, … } } }
 */

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const BUILDER_FILE = join(homedir(), '.nexy', 'constructor.json')
export const PROJECTS_DIR = join(homedir(), 'Documents', 'Nexy', 'proyectos')
const MAX_RUNNING = 2
const MAX_HOURS = 3
const NEWS_EVERY_MS = 10 * 60_000

/** What already exists in NEX's own folder, ready to be taken over. */
const KNOWN = [
  { id: 'abuelito-web', nombre: 'Sitio web de El Abuelito', origen: 'el-abuelito-web' },
  { id: 'aurelius-web', nombre: 'Sitio web de Aurelius', origen: 'aurelius-web' },
  { id: 'centro-de-trabajo', nombre: 'Centro de trabajo (CRM) de Mi Semago y Abuelito', origen: 'crm' },
  { id: 'portal', nombre: 'Portal de clientes', origen: 'portal' },
]

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })
const slug = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

export function readBuilder() {
  let d
  try {
    d = JSON.parse(readFileSync(BUILDER_FILE, 'utf8'))
  } catch {
    d = {}
  }
  const proyectos = d?.proyectos && typeof d.proyectos === 'object' ? d.proyectos : {}
  for (const k of KNOWN) {
    if (!proyectos[k.id] && existsSync(join(APP, k.origen))) proyectos[k.id] = { nombre: k.nombre, carpeta: join(PROJECTS_DIR, k.id), origen: k.origen, estado: 'sin-empezar' }
  }
  return { proyectos }
}
function writeBuilder(d) {
  mkdirSync(dirname(BUILDER_FILE), { recursive: true })
  writeFileSync(BUILDER_FILE, JSON.stringify(d, null, 2) + '\n', { mode: 0o600 })
}

/** A project by its id or (part of) its name. */
export function findProject(d, ref) {
  const q = slug(ref)
  if (d.proyectos[q]) return [q, d.proyectos[q]]
  const all = Object.entries(d.proyectos)
  const hit = all.find(([id, p]) => id.includes(q) || slug(p.nombre).includes(q))
  if (hit) return hit
  // "el sitio de aurelius" → every meaningful word in the id or the name.
  const words = q.split('-').filter((w) => w.length > 2 && !['del', 'las', 'los', 'para', 'sitio', 'web', 'que'].includes(w))
  return (words.length && all.find(([id, p]) => words.every((w) => `${id}-${slug(p.nombre)}`.includes(w)))) || [null, null]
}

/** Inside the project's folder: the only place the builder may read or write. */
export function inside(root, p) {
  if (!p) return false
  const full = resolve(root, String(p).replace(/^~(?=\/|$)/, homedir()))
  const rel = relative(root, full)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

const SHELL_REFUSED = /(\.nexy|\.ssh|\.gmail-mcp|\.aws|keychain|\bsudo\b|git\s+push|--prod\b|netlify\s+deploy[^&|;]*--prod|vercel\s+--prod|rm\s+-rf?\s+[~/]|curl[^|;]*\|\s*(ba|z)?sh|launchctl|osascript)/i

/** The builder's permissions: its folder for files, a fenced shell, nothing else. */
export function builderGate(root) {
  return async (toolName, input) => {
    const path = input?.file_path ?? input?.notebook_path ?? input?.path
    if (['Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob', 'Grep'].includes(toolName)) {
      if (path && !inside(root, path)) return { behavior: 'deny', message: `Only files inside ${root} may be used.` }
      return { behavior: 'allow', updatedInput: input }
    }
    if (toolName === 'Bash') {
      const cmd = String(input?.command ?? '')
      if (SHELL_REFUSED.test(cmd)) return { behavior: 'deny', message: 'That command is not allowed here: no keys, no sudo, no git push, no publishing to production. Leave publishing to NEX.' }
      return { behavior: 'allow', updatedInput: input }
    }
    if (['TodoWrite', 'WebSearch', 'WebFetch', 'Task', 'Agent'].includes(toolName)) return { behavior: 'allow', updatedInput: input }
    return { behavior: 'deny', message: 'Not available to the builder.' }
  }
}

/** The owner's subscription: the login, never an API key. */
function subscriptionEnv() {
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN
  return env
}

const RULES = `
You are building software for NXUS AI, handed to you by NEX, the owner's assistant. Work only in this folder.
- Build it complete and working, in the NXUS standard: clean, fast, premium, mobile first; Spanish or English as the brief says.
- Reuse what is here before adding new things. Keep commits small: git add and commit with a clear message as you go (never push).
- Test what you build: run it, run its checks, and fix what fails. When it is a web page, take a screenshot with Playwright if it is installed.
- Never publish to production, never use secrets you were not given, never touch anything outside this folder.
- If something essential is missing (a logo, a key, an account), say exactly what, and build everything else.
- Finish with a short summary in Spanish: what you built, how to open or run it, and what is left or needs the owner.`

const running = new Map()
let notify = () => {}
/** Where the builder's news goes (the owner's Telegram; see telegram.mjs). */
export function setBuilderNotifier(fn) {
  notify = fn
}

function prepare(id, p) {
  if (!existsSync(p.carpeta)) {
    mkdirSync(p.carpeta, { recursive: true })
    if (p.origen && existsSync(join(APP, p.origen))) {
      cpSync(join(APP, p.origen), p.carpeta, { recursive: true, filter: (src) => !/[/\\](node_modules|dist|\.netlify)([/\\]|$)/.test(src) })
    }
  }
  if (!existsSync(join(p.carpeta, '.git'))) {
    try {
      execFileSync('git', ['init', '-q'], { cwd: p.carpeta })
      execFileSync('git', ['add', '-A'], { cwd: p.carpeta })
      execFileSync('git', ['-c', 'user.name=NEX', '-c', 'user.email=nexy@localhost', 'commit', '-q', '-m', `Punto de partida: ${p.nombre}`, '--allow-empty'], { cwd: p.carpeta })
    } catch (err) {
      console.log(`[jarvis] builder: git init failed in ${id}: ${err.message}`)
    }
  }
}

const LIMIT = /usage limit|limit reached|rate.?limit|resets? at|5-hour|weekly limit|out of (extra )?usage/i

async function build(id, brief, { model }) {
  const d = readBuilder()
  const p = d.proyectos[id]
  prepare(id, p)
  const abort = new AbortController()
  const job = { started: Date.now(), last: 'empezando', abort, tools: 0 }
  running.set(id, job)
  const stopAt = setTimeout(() => abort.abort(), MAX_HOURS * 3600_000)
  let lastNews = Date.now()
  p.estado = 'construyendo'
  p.encargo = brief.slice(0, 2000)
  writeBuilder(d)
  notify(`🔨 Empecé: ${p.nombre}. Te aviso cómo va.`)
  let summary = ''
  let failure = null
  try {
    const session = query({
      prompt: brief,
      options: {
        cwd: p.carpeta,
        model,
        env: subscriptionEnv(),
        abortController: abort,
        settingSources: ['project'],
        systemPrompt: { type: 'preset', preset: 'claude_code', append: RULES },
        canUseTool: builderGate(p.carpeta),
        ...(p.sesion ? { resume: p.sesion } : {}),
      },
    })
    for await (const msg of session) {
      if (msg.session_id && !p.sesion) {
        const fresh = readBuilder()
        fresh.proyectos[id].sesion = msg.session_id
        writeBuilder(fresh)
        p.sesion = msg.session_id
      }
      if (msg.type === 'assistant') {
        for (const b of msg.message?.content ?? []) {
          if (b.type === 'tool_use') {
            job.tools++
            job.last = b.name === 'Bash' ? String(b.input?.description ?? b.input?.command ?? '').slice(0, 80) : `${b.name} ${b.input?.file_path ? relative(p.carpeta, b.input.file_path) : ''}`.trim()
          } else if (b.type === 'text' && LIMIT.test(b.text)) failure = 'limite'
        }
        if (Date.now() - lastNews > NEWS_EVERY_MS) {
          lastNews = Date.now()
          notify(`⏳ ${p.nombre}: sigo (${Math.round((Date.now() - job.started) / 60000)} min, ${job.tools} pasos). Ahora: ${job.last}.`)
        }
      } else if (msg.type === 'result') {
        if (msg.subtype === 'success') summary = String(msg.result ?? '').trim()
        else failure = failure ?? (LIMIT.test(JSON.stringify(msg.errors ?? '')) ? 'limite' : msg.subtype)
      }
    }
  } catch (err) {
    failure = abort.signal.aborted ? (job.stopped ? 'detenido' : 'tiempo') : LIMIT.test(err?.message ?? '') ? 'limite' : err?.message ?? 'error'
  } finally {
    clearTimeout(stopAt)
    running.delete(id)
  }
  const after = readBuilder()
  const q = after.proyectos[id]
  q.actualizado = new Date().toISOString()
  if (failure === 'limite') {
    q.estado = 'pausado-limite'
    notify(`⏸ ${p.nombre}: llegué al límite de tu suscripción de Claude. Lo dejé guardado; cuando se renueve dime "sigue con ${p.nombre}" y continúo. No usé créditos de la API.`)
  } else if (failure) {
    q.estado = 'detenido'
    notify(`⚠️ ${p.nombre}: me detuve (${failure === 'tiempo' ? `pasaron ${MAX_HOURS} horas` : failure === 'detenido' ? 'lo detuviste' : failure}). Lo hecho quedó guardado en su carpeta.`)
  } else {
    q.estado = 'listo'
    q.resumen = summary.slice(0, 3000)
    notify(`✅ ${p.nombre}: listo.\n\n${summary.slice(0, 3500) || 'Terminé.'}`)
  }
  writeBuilder(after)
}

export function builderServer({ model }) {
  return createSdkMcpServer({
    name: 'jarvis_constructor',
    version: '1.0.0',
    instructions: "Software projects, built by Claude Code on this Mac with the owner's subscription.",
    alwaysLoad: true,
    tools: [
      tool(
        'list_software_projects',
        'The software projects the builder works on (each with its own folder and conversation), and how each one is.',
        {},
        async () => {
          const d = readBuilder()
          const rows = Object.entries(d.proyectos).map(([id, p]) => `${id} · ${p.nombre} · ${running.has(id) ? 'construyendo ahora' : p.estado}${p.actualizado ? ` · ${p.actualizado.slice(0, 10)}` : ''}`)
          return ok(rows.length ? rows.join('\n') : 'No projects yet.')
        },
      ),
      tool(
        'start_build',
        'Hand software work to the builder (Claude Code on this Mac, on the owner\'s Claude subscription, not API credits): a new app, site or tool, or a change to an existing one. ' +
          'Pick the project by id or name (list_software_projects), or give nuevo for a new one. Write the brief complete, as the owner would to a developer: ' +
          'who it is for, what it must do, look and language, and everything you know from the profile and the pipeline. It runs in the background and reports on Telegram; tell the owner it started.',
        {
          proyecto: z.string().optional().describe('An existing project id or name.'),
          nuevo: z.string().optional().describe('The name of a new project, e.g. "App de choferes Abuelito".'),
          encargo: z.string().describe('The complete brief.'),
        },
        async ({ proyecto, nuevo, encargo }) => {
          const d = readBuilder()
          let id
          if (nuevo) {
            id = slug(nuevo)
            if (!id) return refuse('Give the new project a name.')
            if (!d.proyectos[id]) d.proyectos[id] = { nombre: nuevo.slice(0, 120), carpeta: join(PROJECTS_DIR, id), estado: 'sin-empezar', creado: new Date().toISOString() }
          } else {
            ;[id] = findProject(d, proyecto ?? '')
            if (!id) return refuse('No project with that name. Use list_software_projects, or give nuevo for a new one.')
          }
          if (running.has(id)) return refuse('The builder is already on that project. Wait for it, or stop it with stop_build.')
          if (running.size >= MAX_RUNNING) return refuse(`The builder already has ${MAX_RUNNING} projects going. Wait for one to finish.`)
          writeBuilder(d)
          void build(id, String(encargo), { model })
          return ok(`Started on ${d.proyectos[id].nombre} (folder ${d.proyectos[id].carpeta}). It reports on Telegram as it goes.`)
        },
      ),
      tool(
        'build_status',
        'How a project the builder is on is going: running or not, for how long, what it is doing, and the last summary.',
        { proyecto: z.string() },
        async ({ proyecto }) => {
          const d = readBuilder()
          const [id, p] = findProject(d, proyecto)
          if (!id) return refuse('No project with that name.')
          const j = running.get(id)
          if (j) return ok(`${p.nombre}: building for ${Math.round((Date.now() - j.started) / 60000)} min, ${j.tools} steps. Now: ${j.last}.`)
          return ok(`${p.nombre}: ${p.estado}.${p.resumen ? `\nLast summary: ${p.resumen}` : ''}`)
        },
      ),
      tool(
        'stop_build',
        'Stop the builder on a project, when the owner asks. What it already did stays in the folder.',
        { proyecto: z.string() },
        async ({ proyecto }) => {
          const [id] = findProject(readBuilder(), proyecto)
          const j = id ? running.get(id) : null
          if (!j) return ok('It was not running.')
          j.stopped = true
          j.abort.abort()
          return ok('Stopped.')
        },
      ),
    ],
  })
}
