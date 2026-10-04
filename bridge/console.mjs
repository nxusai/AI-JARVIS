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
 *   bridge → console  { type: 'snapshot', servers, tasks, approvals, brands, org, brain }
 *                     { type: 'servers', servers }
 *                     { type: 'task', task }
 *                     { type: 'approvals', approvals }
 *                     { type: 'brands', brands }   which brand is active, and all of them
 *                     { type: 'brain', brain }     the knowledge graph (see brain.mjs)
 *   console → bridge  { type: 'approve' | 'reject', id, note? }
 *                     { type: 'use-brand', id }          switch the active brand
 *                     { type: 'brand-manual', id, text } save a brand's manual
 *
 * Approvals can also be answered from Telegram: see addApprover below.
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

/** The call tools confirm out loud already; asking twice would be noise. A
 *  Notion search is a read that happens to be an HTTP POST. */
const NO_APPROVAL = new Set([
  'jarvis_phone__call_me',
  'jarvis_contacts__call_contact',
  'notion__API-post-search',
  // The owner's own brand images going to Higgsfield: nothing public happens.
  'jarvis_files__upload_to_url',
])

/** Changes other people will see that the name rule above cannot tell apart. */
const ALWAYS_APPROVAL = new Set([
  'notion__API-post-page',
  'notion__API-patch-page',
  'notion__API-create-a-comment',
  'notion__API-patch-block-children',
  'notion__API-update-a-block',
  'notion__API-update-page-markdown',
  // Who Nexy may phone in the owner's name.
  'jarvis_contacts__save_contact',
  'jarvis_contacts__remove_contact',
  // Which account each brand publishes to.
  'jarvis_brands__link_brand_account',
  'jarvis_brands__unlink_brand_account',
  // Work left scheduled to run on its own.
  'jarvis_rutinas__create_routine',
  'jarvis_rutinas__update_routine',
  'jarvis_rutinas__remove_routine',
  // Which memory folder is which brand's raw footage.
  'jarvis_crudo__link_raw_folder',
])

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

/**
 * Publishing services: anything that is not a plain read waits for the owner,
 * because it can put something in front of the brand's followers. Videos wait
 * too — each one spends real Higgsfield credits — while images do not.
 */
export const PUBLISHERS = new Set(['metricool', 'ayrshare', 'buffer', 'zernio', 'meta-ads'])
export const PLAIN_READ = /^(get|list|read|search|find|fetch|query|check|show|view|describe)/i

/**
 * Meta's ad tools are all named ads_…, so the verb is in the middle: reports
 * and lookups are reads, anything that creates, changes or switches something
 * on is not.
 */
const ADS_READ = /(insight|report|get|list|search|benchmark|score|diagnos|context|preview|estimate|reach|status|fetch|recommend)/i
const ADS_WRITE = /(create|update|edit|set|activate|pause|resume|delete|remove|duplicate|copy|upload|publish|launch|budget|bid|archive)/i

/** Whether a publishing service's tool only reads. */
export function isReadCall(server, tool) {
  if (server === 'meta-ads') return ADS_READ.test(tool) && !ADS_WRITE.test(tool)
  return PLAIN_READ.test(tool)
}

/** A Meta ads call that can start spending money. */
export function spendsMoney(server, tool, input) {
  if (server !== 'meta-ads') return false
  return /activate|resume|launch|budget|bid/i.test(tool) || /"(status|effective_status)"\s*:\s*"ACTIVE"/i.test(JSON.stringify(input ?? {}))
}

export function needsApproval(name) {
  const { server, tool } = splitTool(name)
  if (ALWAYS_APPROVAL.has(`${server}__${tool}`)) return true
  if (PUBLISHERS.has(server)) return !isReadCall(server, tool)
  // Invoices: anything but a read goes to the owner first.
  if (server === 'zoho') return !/(^|[_-])(list|get|search|fetch|retrieve|view|read|report|find)/i.test(tool)
  // Designs stay in the owner's own Canva; only sharing them with others is held.
  if (server === 'canva') return /share|publish|invite|collaborat/i.test(tool)
  if (server === 'higgsfield') return /video|animate|motion/i.test(tool) && !PLAIN_READ.test(tool)
  if (NO_APPROVAL.has(`${server}__${tool}`)) return false
  return server !== 'builtin' && NEEDS_APPROVAL.test(tool)
}

/** The SDK's subagent tool, under its old and new names. */
const AGENT_TOOLS = new Set(['Agent', 'Task'])

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
  let brands = null
  let org = null
  let brain = null
  let onCommand = () => {}
  /** Other places the owner can answer an approval from (Telegram). */
  const approvers = new Set()
  const tellApprovers = (event, payload) => {
    for (const a of approvers) {
      try {
        a[event]?.(payload)
      } catch (err) {
        console.log(`[jarvis] approver failed: ${err?.message ?? err}`)
      }
    }
  }
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
    tellApprovers('settled', { id, approved, note })
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
          brands,
          org,
          brain,
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
        } else if ((msg.type === 'use-brand' || msg.type === 'brand-manual') && typeof msg.id === 'string') {
          try {
            onCommand(msg)
          } catch (err) {
            console.log(`[jarvis] console command failed: ${err?.message ?? err}`)
          }
        }
      })
      socket.on('close', () => consoles.delete(socket))
    },

    hasConsole: () => [...consoles].some((s) => s.readyState === s.OPEN),

    /** Whether anyone can answer an approval right now: a console, or Telegram. */
    hasApprover() {
      return this.hasConsole() || [...approvers].some((a) => a.available?.() ?? true)
    },

    /**
     * Another place approvals can be answered. `approver.requested(view)` is
     * called for each new one and `approver.settled({ id, approved })` when it
     * is answered, wherever that happened. Returns a function that removes it.
     */
    addApprover(approver) {
      approvers.add(approver)
      return () => approvers.delete(approver)
    },

    /** Whether a task is waiting on the owner to approve something. */
    waitingOnOwner(taskId) {
      return [...approvals.values()].some((a) => a.view.taskId === taskId)
    },

    /** The tool a task is running right now, if any. */
    runningStepName(taskId) {
      const task = tasks.find((t) => t.id === taskId)
      return task?.steps.findLast((s) => s.status === 'running')?.name ?? null
    },

    /** Answer an approval from outside the console. */
    answer(id, approved, note) {
      settle(id, approved === true, note)
    },

    /**
     * What each session reports about its connectors, merged by name: the
     * voice and Telegram sessions each see some of their own, and a server
     * one of them has not loaded is still Nexy's.
     */
    setServers(list) {
      const byName = new Map(servers.map((s) => [s.name, s]))
      for (const s of list) {
        const next = typeof s === 'string' ? { name: s, status: 'connected' } : s
        if (next?.name) byName.set(next.name, next)
      }
      servers = [...byName.values()]
      broadcast({ type: 'servers', servers })
    },

    /** Brand switches and manual edits made in the console. */
    onCommand(fn) {
      onCommand = fn
    },

    /**
     * The brands changed. The task being worked on moves with the switch: "in
     * VAYRO, write three hooks" starts in whatever brand was active and the
     * work belongs to VAYRO.
     */
    setBrands(state) {
      brands = { activa: state.activa, marcas: state.marcas }
      broadcast({ type: 'brands', brands })
      // Only the newest: it is the one being worked on, and an older task
      // still winding down keeps the brand it was done for.
      const t = tasks.find((x) => x.status === 'running')
      if (t && t.brand !== state.activa) {
        t.brand = state.activa
        pushTask(t)
      }
      for (const a of approvals.values()) {
        const t = tasks.find((x) => x.id === a.view.taskId)
        if (t) a.view.brand = t.brand
      }
      pushApprovals()
    },

    setOrg(value) {
      org = value
      broadcast({ type: 'org', org })
    },

    setBrain(value) {
      brain = value
      broadcast({ type: 'brain', brain })
    },

    /** The owner asked for something. Returns the task id. */
    startTask(text, brand = brands?.activa ?? null, via = 'voz') {
      const task = {
        id: nextId('t'),
        brand,
        via,
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

    /**
     * A tool call, as soon as its input is known. Idempotent per tool-use id.
     * `parentId` is set for a call made by one of Nexy's agents: it is the id
     * of the Agent call that started that agent, so the console can draw the
     * work inside the agent that did it.
     */
    startStep(taskId, toolUseId, name, input, parentId = null) {
      const task = tasks.find((t) => t.id === taskId)
      if (!task || !toolUseId || task.steps.some((s) => s.id === toolUseId)) return
      const { server, tool } = splitTool(name)
      const agent = AGENT_TOOLS.has(name) && typeof input?.subagent_type === 'string' ? input.subagent_type : null
      const by = parentId ? (task.steps.find((s) => s.id === parentId)?.agent ?? null) : null
      task.steps.push({
        id: toolUseId,
        name,
        server,
        tool,
        agent,
        by,
        parent: parentId,
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
    requestApproval(taskId, name, input, extra = {}) {
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
            brand: extra.brand ?? task?.brand ?? null,
            stepId: step?.id ?? null,
            name,
            server,
            tool,
            input: clip(input ?? {}),
            // The exact account this will go out on, when it goes to one.
            account: typeof extra.account === 'string' ? extra.account : null,
            createdAt: Date.now(),
            expiresAt: Date.now() + APPROVAL_TIMEOUT_MS,
          },
        })
        pushApprovals()
        tellApprovers('requested', approvals.get(id).view)
      })
    },
  }
}

export const hub = createHub()
