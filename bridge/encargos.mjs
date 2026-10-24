import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { encargoUltron } from './nucleo/ultron.mjs'
import { encargoAnaSofi } from './nucleo/anasofi.mjs'

/**
 * Tasks Nexy hands to the AIs under her, with a report back. Ultron (the
 * client's direction AI) and Ana Sofi (Mi Semago) do the work right then with
 * their own tools and answer; the report comes back to Nexy and to the owner
 * on Telegram, and stays in ~/.nexy/encargos.json.
 *
 * Doing and reporting is Nexy's own business. Reaching a client's person — a
 * message from Ultron in a director's console, or Ana Sofi acting in the
 * employees' group — waits for the owner's tap (deliver_task), like any send.
 * The AIs never learn where a task came from.
 *
 * Standing rules ("from now on…") are still orders (see ultron.mjs); these are
 * one-off jobs.
 */

export const TASKS_FILE = join(homedir(), '.nexy', 'encargos.json')
const KEEP = 200

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })
const NAMES = { ultron: 'Ultron', 'ana-sofi': 'Ana Sofi' }

export function readTasks() {
  try {
    const list = JSON.parse(readFileSync(TASKS_FILE, 'utf8'))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
function saveTask(t) {
  const list = readTasks().filter((x) => x.id !== t.id)
  list.push(t)
  mkdirSync(dirname(TASKS_FILE), { recursive: true })
  writeFileSync(TASKS_FILE, JSON.stringify(list.slice(-KEEP), null, 2) + '\n', { mode: 0o600 })
}

let notify = () => {}
/** Where reports go (the owner's Telegram; see telegram.mjs). */
export function setTasksNotifier(fn) {
  notify = fn
}

/** Run a task in the background; its report is saved and sent to the owner. */
export function runTask({ ia, encargo, para = null, entregar = false }, deps) {
  const t = { id: `e${Date.now().toString(36)}`, ia, encargo: encargo.slice(0, 2000), para, entregar, estado: 'trabajando', creado: new Date().toISOString() }
  saveTask(t)
  const work =
    ia === 'ultron'
      ? encargoUltron({ texto: encargo, para, entregar, ...deps }).then((r) => ({ reporte: r.reporte, nota: r.entregado ? `Se lo dejé a ${r.persona} en su consola.` : '' }))
      : encargoAnaSofi(entregar ? encargo : `${encargo}\n(No publiques nada en el grupo: solo revisa y reporta.)`).then((r) => ({ reporte: String(r ?? '').trim() || 'Listo.', nota: '' }))
  work
    .then(({ reporte, nota }) => {
      saveTask({ ...t, estado: 'listo', reporte: reporte.slice(0, 4000), nota, terminado: new Date().toISOString() })
      notify(`📋 ${NAMES[ia]} terminó: ${encargo.slice(0, 120)}\n\n${reporte.slice(0, 3000)}${nota ? `\n\n${nota}` : ''}`)
    })
    .catch((err) => {
      const motivo = String(err?.message ?? err).slice(0, 400)
      saveTask({ ...t, estado: 'error', reporte: motivo, terminado: new Date().toISOString() })
      notify(`⚠️ ${NAMES[ia]} no pudo con: ${encargo.slice(0, 120)}\nMotivo: ${motivo}`)
    })
  return t
}

const IA = z.enum(['ultron', 'ana-sofi'])

export function tasksServer(deps) {
  return createSdkMcpServer({
    name: 'jarvis_encargos',
    version: '1.0.0',
    instructions: 'One-off tasks for the AIs under you (Ultron, Ana Sofi), with a report back.',
    alwaysLoad: true,
    tools: [
      tool(
        'assign_task',
        'Give a one-off task to one of the AIs under you, done right now with its own tools, with a report back to you and the owner (on Telegram). ' +
          'Ultron: the client\'s direction AI — the work centre (tasks, overdue items, files, catalogs, per company) and what Ana Sofi did; para = a director\'s name to see it as that person sees it. ' +
          'Ana Sofi: Mi Semago\'s labels (Zebra) and her group. Nothing reaches a client\'s person with this; to deliver, use deliver_task. ' +
          'Write the task complete and self-contained. Tell the owner it is on its way; the report arrives by itself.',
        {
          ia: IA,
          encargo: z.string().min(5).describe('The task, complete.'),
          para: z.string().optional().describe('For Ultron: the director whose view to use (Senen, Gerardo…).'),
        },
        async ({ ia, encargo, para }) => {
          try {
            const t = runTask({ ia, encargo, para: ia === 'ultron' ? para ?? null : null, entregar: false }, deps)
            return ok(`${NAMES[ia]} is on it (task ${t.id}). The report will come to you and the owner when it is done.`)
          } catch (err) {
            return refuse(String(err?.message ?? err))
          }
        },
      ),
      tool(
        'deliver_task',
        'Give a task whose result reaches a client\'s person: Ultron leaves a message, in his own voice, in a director\'s console (para = the director); ' +
          'Ana Sofi acts in her group (posts, prints, sends the label program). Held for the owner\'s tap, like any send. The report comes back as with assign_task.',
        {
          ia: IA,
          encargo: z.string().min(5).describe('The task, complete: what to do and what the person should get.'),
          para: z.string().optional().describe('For Ultron: the director who receives the message.'),
        },
        async ({ ia, encargo, para }) => {
          if (ia === 'ultron' && !para) return refuse('Say which director receives it (para).')
          try {
            const t = runTask({ ia, encargo, para: para ?? null, entregar: true }, deps)
            return ok(`${NAMES[ia]} is on it (task ${t.id}); the result goes to ${ia === 'ultron' ? para : 'her group'}. The report comes to you and the owner.`)
          } catch (err) {
            return refuse(String(err?.message ?? err))
          }
        },
      ),
      tool(
        'list_tasks',
        'The latest tasks given to the AIs under you, with their state and reports: to answer "what did Ultron say", or before giving the same task twice.',
        { ia: IA.optional() },
        async ({ ia }) => {
          const rows = readTasks()
            .filter((t) => !ia || t.ia === ia)
            .reverse()
            .slice(0, 15)
          if (!rows.length) return ok('No tasks yet.')
          return ok(rows.map((t) => `${t.id} · ${t.creado.slice(0, 16)} · ${NAMES[t.ia]}${t.para ? ` (${t.para})` : ''} · ${t.estado}\n  ${t.encargo.slice(0, 160)}${t.reporte ? `\n  → ${t.reporte.slice(0, 600)}` : ''}`).join('\n'))
        },
      ),
    ],
  })
}
