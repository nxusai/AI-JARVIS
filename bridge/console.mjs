/**
 * The console hub: what Nexy is doing, told to whoever is watching.
 *
 * The voice interface shows one thing at a time and forgets it. The console is
 * a second page that shows the whole picture — every request as a task, every
 * tool it used as a step with what went in and what came out, which services
 * are connected — and it is where outward-facing actions wait for the owner's
 * approval before they happen.
 *
 * It knows nothing about any particular service. Tools arrive as names, inputs
 * and results; a new MCP server shows up on the map the moment the agent
 * reports it, and anything whose name says it publishes or posts is held for
 * approval without a line of code here changing. That is what keeps it
 * adaptable: connecting Notion or Instagram needs no change to this file.
 *
 * The protocol, over ws://localhost:<port>/console:
 *   bridge → console  { type: 'snapshot', servers, tasks, approvals }
 *                     { type: 'servers', servers }
 *                     { type: 'task', task }
 *                     { type: 'approvals', approvals }
 *   console → bridge  { type: 'approve' | 'reject', id, note? }
 */

/** Tasks kept for the history list. */
const KEEP_TASKS = 30
/** How long an approval waits before it counts as a no. */
const APPROVAL_TIMEOUT_MS = 10 * 60_000
/** Longest text kept from a tool's input field or result. */
const MAX_TEXT = 4000

/**
 * Actions that change something outside this Mac, held until the owner
 * approves them in the console. Matched against the tool half of the name, so
 * a newly connected server's `publish_post` or `create_post` is covered the
 * moment it appears. Reading, searching and the calendar are not held: they
 * are either harmless or already confirmed out loud.
 */
const NEEDS_APPROVAL = /(^|[_-])(send|publish|post|tweet|share|reply)([_-]|$)|send_email|create_post|upload/i

/** The call tools confirm out loud already; asking twice would be noise. */
const NO_APPROVAL = new Set(['jarvis_phone__call_me', 'jarvis_contacts__call_contact'])

const clip = (v) => {
  if (typeof v === 'string') return v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}…` : v
  if (Array.isArray(v)) return v.slice(0, 50).map(clip)
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).slice(0, 40).map(([k, x]) => [k, clip(x)]))
  }
  return v
}

/** `mcp__gmail__send_email` → { server: 'gmail', tool: 'send_email' }. */
export function splitTool(name) {
  if (typeof name === 'string' && name.startsWith('mcp__')) {
    const [, server, ...rest] = name.split('__')
    return { server, tool: rest.join('__') }
  }
  return { server: 'builtin', tool: String(name ?? '') }
}

export function needsApproval(name) {
  const { server, tool } = splitTool(name)
  if (NO_APPROVAL.has(`${server}__${tool}`)) return false
  return server !== 'builtin' && NEEDS_APPROVAL.test(tool)
}

/** A tool result's text, however the SDK shaped it. */
function resultText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => (c?.type === 'text' ? c.text : c?.type === 'image' ? '[imagen]' : ''))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

function createHub() {
  const consoles = new Set()
  let servers = []
  const tasks = []
  const approvals = new Map()
  let seq = 0
  const nextId = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`

  const broadcast = (msg) => {
    const raw = JSON.stringify(msg)
    for (const s of consoles) if (s.readyState === s.OPEN) s.send(raw)
  }
  const pushTask = (task) => broadcast({ type: 'task', task })
  const pushApprovals = () => broadcast({ type: 'approvals', approvals: [...approvals.values()].map((a) => a.view) })

  const findStep = (toolUseId) => {
    for (const t of tasks) {
      const s = t.steps.find((x) => x.id === toolUseId)
      if (s) return { task: t, step: s }
    }
    return null
  }

  const settle = (id, approved, note) => {
    const a = approvals.get(id)
    if (!a) return
    approvals.delete(id)
    clearTimeout(a.timer)
    const found = a.view.stepId ? findStep(a.view.stepId) : null
    if (found && found.step.status === 'waiting') {
      found.step.status = approved ? 'running' : 'rejected'
      if (!approved && note) found.step.result = `Rechazado: ${note}`
      pushTask(found.task)
    }
    pushApprovals()
    a.resolve({ approved, note: typeof note === 'string' ? note.slice(0, 500) : '' })
  }

  return {
    /** A console page connected. Give it everything, then listen for its answers. */
    addConsole(socket) {
      consoles.add(socket)
      socket.send(
        JSON.stringify({
          type: 'snapshot',
          servers,
          tasks,
          approvals: [...approvals.values()].map((a) => a.view),
        }),
      )
      socket.on('message', (raw) => {
        let msg
        try {
          msg = JSON.parse(raw.toString())
        } catch {
          return
        }
        if ((msg.type === 'approve' || msg.type === 'reject') && typeof msg.id === 'string') {
          settle(msg.id, msg.type === 'approve', msg.note)
        }
      })
      socket.on('close', () => consoles.delete(socket))
    },

    hasConsole: () => [...consoles].some((s) => s.readyState === s.OPEN),

    setServers(list) {
      servers = list.map((s) => (typeof s === 'string' ? { name: s, status: 'connected' } : s))
      broadcast({ type: 'servers', servers })
    },

    /** The owner asked for something. Returns the task id. */
    startTask(text) {
      const task = {
        id: nextId('t'),
        text: clip(String(text ?? '')),
        status: 'running',
        startedAt: Date.now(),
        endedAt: null,
        reply: '',
        steps: [],
      }
      tasks.unshift(task)
      tasks.length = Math.min(tasks.length, KEEP_TASKS)
      pushTask(task)
      return task.id
    },

    /** A tool call, as soon as its input is known. Idempotent per tool-use id. */
    startStep(taskId, toolUseId, name, input) {
      const task = tasks.find((t) => t.id === taskId)
      if (!task || !toolUseId || task.steps.some((s) => s.id === toolUseId)) return
      const { server, tool } = splitTool(name)
      task.steps.push({
        id: toolUseId,
        name,
        server,
        tool,
        input: clip(input ?? {}),
        status: 'running',
        startedAt: Date.now(),
        endedAt: null,
        result: '',
      })
      pushTask(task)
    },

    /** The tool's result came back. Refusals arrive as errors saying so. */
    endStep(toolUseId, isError, content) {
      const found = findStep(toolUseId)
      if (!found) return
      const { task, step } = found
      const text = clip(resultText(content))
      step.endedAt = Date.now()
      if (step.status !== 'rejected') {
        step.status = !isError ? 'done' : /^Blocked:|read-only/i.test(text) ? 'blocked' : 'error'
        step.result = text
      }
      pushTask(task)
    },

    endTask(taskId, status, reply) {
      const task = tasks.find((t) => t.id === taskId)
      if (!task || task.status !== 'running') return
      task.status = status
      task.endedAt = Date.now()
      task.reply = clip(String(reply ?? ''))
      for (const s of task.steps) {
        if (s.status === 'running' || s.status === 'waiting') {
          s.status = status === 'done' ? 'done' : 'interrupted'
          s.endedAt = task.endedAt
        }
      }
      pushTask(task)
    },

    /**
     * Hold an action for the owner. Resolves { approved, note } when they
     * answer in the console, or as a refusal after ten minutes.
     */
    requestApproval(taskId, name, input) {
      const id = nextId('a')
      const task = tasks.find((t) => t.id === taskId)
      const step = task?.steps.findLast((s) => s.name === name && s.status === 'running')
      if (step) {
        step.status = 'waiting'
        pushTask(task)
      }
      const { server, tool } = splitTool(name)
      return new Promise((resolve) => {
        const timer = setTimeout(() => settle(id, false, 'Sin respuesta en 10 minutos.'), APPROVAL_TIMEOUT_MS)
        approvals.set(id, {
          resolve,
          timer,
          view: {
            id,
            taskId,
            stepId: step?.id ?? null,
            name,
            server,
            tool,
            input: clip(input ?? {}),
            createdAt: Date.now(),
            expiresAt: Date.now() + APPROVAL_TIMEOUT_MS,
          },
        })
        pushApprovals()
      })
    },
  }
}

export const hub = createHub()
