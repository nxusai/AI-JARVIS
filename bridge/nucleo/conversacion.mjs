import { TAG } from './lugar.mjs'
import { clearSession, loadSession, saveSession } from './sesiones.mjs'

/**
 * A turn with no sign of life for this long is stopped: a tool that never
 * answers would otherwise leave her "typing" for ever. Time spent waiting for
 * an approval doesn't count. Slow steps by nature (renders, AI images and
 * videos, music, voices, an agent on a long job) get three times as long.
 */
const STUCK_MS = 5 * 60_000
const SLOW_STEP = /wait|video|render|efectos|effects|taller|editor|crudo|higgsfield|generat|music|voice|clone|speak|elevenlabs|agent|task/i
/** After this long on one request, she says she is still on it. */
const SLOW_NOTICE_MS = 90_000

/** For a bot with no console: its tasks and steps go nowhere. */
export const quietHub = {
  startTask: () => null,
  endTask: () => {},
  startStep: () => {},
  endStep: () => {},
  setServers: () => {},
  waitingOnOwner: () => false,
  runningStepName: () => null,
  cancelApprovals: () => {},
}

/** Several messages as one: text joined, images kept. */
function mergeContent(list) {
  if (list.every((c) => typeof c === 'string')) return list.join('\n\n')
  return list.flatMap((c) => (typeof c === 'string' ? [{ type: 'text', text: c }] : c))
}

/** Put a note in front of a message, whatever its shape. */
const withNote = (note, content) => (typeof content === 'string' ? `${note}\n\n${content}` : [{ type: 'text', text: note }, ...content])

const SUPERSEDED =
  '[The owner wrote this while you were still on the previous request, so that work was stopped where it was. ' +
  'If this corrects or replaces it, do it the new way; do not repeat steps that already ran or anything they rejected.]'

/**
 * One running conversation with the agent, one request at a time.
 *
 * A message that arrives while she works does not wait in a queue: the owner
 * is usually correcting her ("no, el due by es el 8"), so the current work
 * stops (with any approval it was waiting on) and the new message is taken
 * up at once, with the old one still in context. Several messages sent
 * quickly become one request. Each request gets its answer from the result
 * that closes its turn.
 */
export function conversation({ agentOptions, onAnswer, onSlow = () => {}, onBegin = () => {}, runQuery, local, channel = 'telegram', hub = quietHub, channelPrompt = '', stepName = (s) => s, stuckMs = STUCK_MS, slowNoticeMs = SLOW_NOTICE_MS }) {
  let current = null
  const held = []
  let deliver = null
  let closed = false

  async function* prompts() {
    while (!closed) {
      const content = await new Promise((r) => (deliver = r))
      if (closed || content == null) return
      yield { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null }
    }
  }

  const begin = (content, job) => {
    job.started = Date.now()
    current = job
    // Who the turn is for: the job, and any held with it (job.merged).
    onBegin(job)
    lastSign = Date.now()
    const send = () => {
      if (!deliver) return setTimeout(send, 50)
      const r = deliver
      deliver = null
      r(content)
    }
    send()
  }

  /** The held messages, as one request: the earlier ones end as part of it. */
  const next = () => {
    if (!held.length || closed) return
    // The owner's own messages go first, together; a routine runs on its own after.
    const mine = held.filter((b) => !b.job.solo)
    const batch = mine.length ? mine : [held[0]]
    for (const b of batch) held.splice(held.indexOf(b), 1)
    const job = batch.at(-1).job
    job.merged = batch.map((b) => b.job)
    for (const b of batch.slice(0, -1)) hub.endTask(b.job.taskId, 'interrupted', 'Se juntó con el mensaje siguiente.')
    if (batch.length > 1) job.what = batch.map((b) => b.job.what).filter(Boolean).join(' · ')
    const content = mergeContent(batch.map((b) => b.content))
    begin(batch.some((b) => b.superseded) ? withNote(SUPERSEDED, content) : content, job)
  }

  // Pick up where the last conversation left off, across restarts.
  const resume = loadSession(channel)
  if (resume) console.log(`${TAG} ${channel}: continuing the previous conversation`)
  const session = runQuery({
    prompt: prompts(),
    options: {
      ...agentOptions({ local, channelPrompt, currentTask: () => current?.taskId ?? null }),
      ...(resume ? { resume } : {}),
    },
  })

  // The watchdog. Every message from the agent is a sign of life; a turn that
  // goes quiet for STUCK_MS, and isn't waiting on the owner, is interrupted and
  // the owner is told which step it was stuck on.
  let lastSign = Date.now()
  const watchdog = setInterval(() => {
    const job = current
    if (!job || job.stopped) return
    if (hub.waitingOnOwner(job.taskId)) {
      lastSign = Date.now()
      return
    }
    const step = hub.runningStepName(job.taskId)
    // A long job says so once, so the owner never wonders whether she stopped.
    if (!job.toldSlow && Date.now() - (job.started ?? Date.now()) > slowNoticeMs) {
      job.toldSlow = true
      onSlow(job, step)
    }
    if (Date.now() - lastSign < (step && SLOW_STEP.test(step) ? stuckMs * 3 : stuckMs)) return
    console.log(`${TAG} ${channel}: turn stuck${step ? ` on ${step}` : ''}; stopping it`)
    halt(`Me quedé atorada${step ? ` esperando a ${stepName(step)}` : ''} y lo detuve. ¿Lo intento otra vez?`)
  }, 15_000)

  /** Stop the current turn; it ends with `reason` as its answer, or silently. */
  function halt(reason, silent = false) {
    const job = current
    if (!job || job.stopped !== undefined) return false
    job.stopped = reason
    job.silent = silent
    // Pending approvals first: the SDK finishes the turn only once they settle.
    hub.cancelApprovals(job.taskId)
    Promise.resolve(session.interrupt?.()).catch(() => {})
    return true
  }

  const done = (async () => {
    try {
      for await (const msg of session) {
        lastSign = Date.now()
        if (msg.session_id && (msg.type === 'result' || (msg.type === 'system' && msg.subtype === 'init'))) {
          saveSession(channel, msg.session_id)
        }
        // Which connectors are up, for the console, as the voice session does.
        if (msg.type === 'system' && msg.subtype === 'init' && Array.isArray(msg.mcp_servers)) {
          hub.setServers(msg.mcp_servers.map((s) => ({ name: s.name, status: s.status })))
        }
        if (msg.type === 'assistant') {
          for (const block of msg.message?.content ?? []) {
            if (block.type === 'tool_use') {
              hub.startStep(current?.taskId, block.id, block.name, block.input, msg.parent_tool_use_id ?? null)
            }
          }
        } else if (msg.type === 'user' && Array.isArray(msg.message?.content)) {
          for (const block of msg.message.content) {
            if (block?.type === 'tool_result') hub.endStep(block.tool_use_id, block.is_error === true, block.content)
          }
        } else if (msg.type === 'result') {
          const job = current
          current = null
          const stopped = job?.stopped !== undefined
          const ok = msg.subtype === 'success' && !stopped
          const text = stopped ? job.stopped : ok ? String(msg.result ?? '').trim() : 'No pude terminar eso. Inténtalo otra vez, por favor.'
          if (!ok && !stopped) console.error(`${TAG} ${channel} turn failed: ${msg.subtype}`)
          if (job) {
            hub.endTask(job.taskId, stopped ? 'interrupted' : ok ? 'done' : 'error', text)
            if (!job.silent) onAnswer(job, text || 'Listo.')
          }
          lastSign = Date.now()
          next()
        }
      }
    } catch (err) {
      console.error(`${TAG} ${channel} session error:`, err?.message ?? err)
      // A conversation that cannot be picked up again is dropped, so the next
      // message starts a fresh one instead of failing the same way.
      clearSession(channel)
      for (const job of [current, ...held.splice(0).map((b) => b.job)].filter(Boolean)) {
        hub.endTask(job.taskId, 'error', '')
        onAnswer(job, 'Tuve un problema y reinicié la conversación. ¿Me lo repites?')
      }
      current = null
    } finally {
      closed = true
      clearInterval(watchdog)
    }
  })()

  return {
    get closed() {
      return closed
    },
    get busy() {
      return Boolean(current) || held.length > 0
    },
    /** What she is on right now, for a status line while the owner waits. */
    status() {
      const job = current
      if (!job) return null
      return { what: job.what ?? '', started: job.started ?? Date.now(), step: hub.runningStepName(job.taskId), waiting: held.length }
    },
    /**
     * `content` is the owner's words, or a list of image and text blocks.
     * `wait`: files, contacts and routines wait their turn instead of
     * stopping the work in progress. Returns true when it took over.
     */
    ask(content, job, { wait = false } = {}) {
      if (!current) {
        begin(content, job)
        return false
      }
      // Stopping a routine for the owner is fine; a routine never stops the owner's work.
      const takeOver = !wait && !job.solo
      held.push({ content, job, superseded: takeOver })
      if (takeOver) halt('', true)
      return takeOver
    },
    /** /cancelar: stop now, and drop anything sent meanwhile. */
    stop(reason) {
      for (const b of held.splice(0)) hub.endTask(b.job.taskId, 'interrupted', '')
      return halt(reason)
    },
    close() {
      closed = true
      deliver?.(null)
      session.close?.()
      for (const job of [current, ...held.splice(0).map((b) => b.job)].filter(Boolean)) hub.endTask(job.taskId, 'interrupted', '')
      current = null
      return done
    },
  }
}
