import { useEffect, useMemo, useRef, useState } from 'react'
import { BRIDGE_WS_URL } from '../config'
import { describeInput, homeOf, serviceOf, stepLabel } from './services'

/**
 * The Nexy console: a second page that shows what she is doing and where she
 * is asking for approval. It only watches and answers approvals — everything
 * it shows comes from bridge/console.mjs, and it never talks to the agent.
 */

type StepStatus = 'running' | 'waiting' | 'done' | 'error' | 'blocked' | 'rejected' | 'interrupted'
type Step = {
  id: string
  name: string
  server: string
  tool: string
  input: Record<string, unknown>
  status: StepStatus
  startedAt: number
  endedAt: number | null
  result: string
}
type Task = {
  id: string
  text: string
  status: 'running' | 'done' | 'error' | 'interrupted'
  startedAt: number
  endedAt: number | null
  reply: string
  steps: Step[]
}
type Approval = {
  id: string
  taskId: string
  name: string
  server: string
  tool: string
  input: Record<string, unknown>
  createdAt: number
  expiresAt: number
}
type Server = { name: string; status: string }

const STEP_ICON: Record<StepStatus, string> = {
  running: '🔄',
  waiting: '⏸️',
  done: '✅',
  error: '❌',
  blocked: '🚫',
  rejected: '✋',
  interrupted: '⏹️',
}
const STEP_WORD: Record<StepStatus, string> = {
  running: 'Trabajando',
  waiting: 'Esperando tu aprobación',
  done: 'Listo',
  error: 'Error',
  blocked: 'Bloqueado por seguridad',
  rejected: 'Rechazado por ti',
  interrupted: 'Interrumpido',
}
const TASK_WORD: Record<Task['status'], string> = {
  running: 'En curso',
  done: 'Terminada',
  error: 'Con error',
  interrupted: 'Interrumpida',
}

/** How long a node keeps glowing after a step on it finishes. */
const AFTERGLOW_MS = 4000

const secs = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)
const clock = (t: number) =>
  new Date(t).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })

function useBridge() {
  const [connected, setConnected] = useState(false)
  const [servers, setServers] = useState<Server[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const socket = useRef<WebSocket | null>(null)

  useEffect(() => {
    let stop = false
    let retry: ReturnType<typeof setTimeout> | null = null
    const open = () => {
      const ws = new WebSocket(`${BRIDGE_WS_URL.replace(/\/+$/, '')}/console`)
      socket.current = ws
      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        if (!stop) retry = setTimeout(open, 2000)
      }
      ws.onmessage = (ev) => {
        let msg: { type?: string; [k: string]: unknown }
        try {
          msg = JSON.parse(String(ev.data))
        } catch {
          return
        }
        if (msg.type === 'snapshot') {
          setServers((msg.servers as Server[]) ?? [])
          setTasks((msg.tasks as Task[]) ?? [])
          setApprovals((msg.approvals as Approval[]) ?? [])
        } else if (msg.type === 'servers') {
          setServers((msg.servers as Server[]) ?? [])
        } else if (msg.type === 'approvals') {
          setApprovals((msg.approvals as Approval[]) ?? [])
        } else if (msg.type === 'task') {
          const task = msg.task as Task
          setTasks((prev) => {
            const rest = prev.filter((t) => t.id !== task.id)
            return [task, ...rest].sort((a, b) => b.startedAt - a.startedAt).slice(0, 30)
          })
        }
      }
    }
    open()
    return () => {
      stop = true
      if (retry) clearTimeout(retry)
      socket.current?.close()
    }
  }, [])

  const answer = (id: string, approve: boolean, note: string) =>
    socket.current?.send(JSON.stringify({ type: approve ? 'approve' : 'reject', id, note }))

  return { connected, servers, tasks, approvals, answer }
}

/** Re-render every second, for timers and the map's afterglow. */
function useTick() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function Fields({ input, full }: { input: Record<string, unknown>; full?: boolean }) {
  const rows = describeInput(input)
  if (!rows.length) return null
  return (
    <dl className={full ? 'fields full' : 'fields'}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function MapView({ servers, tasks, now }: { servers: Server[]; tasks: Task[]; now: number }) {
  const nodes = useMemo(() => {
    const keys = new Set<string>()
    for (const s of servers) keys.add(s.name)
    for (const t of tasks) for (const st of t.steps) keys.add(homeOf(st.server, st.tool))
    keys.add('web')
    return [...keys].filter((k) => !serviceOf(k).hidden).sort()
  }, [servers, tasks])

  const state = (key: string) => {
    const server = servers.find((s) => s.name === key)
    if (server && (server.status === 'failed' || server.status === 'needs-auth')) return 'down'
    for (const t of tasks) {
      for (const st of t.steps) {
        if (homeOf(st.server, st.tool) !== key) continue
        if (st.status === 'waiting') return 'waiting'
        if (st.status === 'running') return 'active'
        if (st.endedAt && now - st.endedAt < AFTERGLOW_MS) return 'active'
      }
    }
    return 'idle'
  }

  const W = 560
  const H = 380
  const cx = W / 2
  const cy = H / 2
  const r = Math.min(W, H) / 2 - 52
  return (
    <svg className="map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Mapa de conexiones de Nexy">
      {nodes.map((key, i) => {
        const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r * 0.82
        const s = state(key)
        const svc = serviceOf(key)
        return (
          <g key={key} className={`node ${s}`}>
            <line x1={cx} y1={cy} x2={x} y2={y} className="edge" />
            <circle cx={x} cy={y} r={26} className="dot" />
            <text x={x} y={y + 7} textAnchor="middle" className="icon">
              {svc.icon}
            </text>
            {/* Above the node in the top half, so the line in from the centre never crosses it. */}
            <text x={x} y={Math.sin(a) < -0.2 ? y - 34 : y + 44} textAnchor="middle" className="label">
              {svc.label}
            </text>
          </g>
        )
      })}
      <g className="core">
        <circle cx={cx} cy={cy} r={38} />
        <text x={cx} y={cy + 6} textAnchor="middle">
          NEXY
        </text>
      </g>
    </svg>
  )
}

function ApprovalCard({ a, now, answer }: { a: Approval; now: number; answer: (id: string, ok: boolean, note: string) => void }) {
  const [note, setNote] = useState('')
  const left = Math.max(0, a.expiresAt - now)
  const svc = serviceOf(homeOf(a.server, a.tool))
  return (
    <article className="approval">
      <header>
        <span className="svc">{svc.icon}</span>
        <h3>¿Apruebas? · {stepLabel(a.server, a.tool)}</h3>
        <span className="expires">
          expira en {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}
        </span>
      </header>
      <Fields input={a.input} full />
      <textarea
        placeholder="¿Qué cambiarías? (opcional, si rechazas)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />
      <div className="actions">
        <button className="approve" onClick={() => answer(a.id, true, '')}>
          Aprobar
        </button>
        <button className="reject" onClick={() => answer(a.id, false, note)}>
          Rechazar
        </button>
      </div>
    </article>
  )
}

function TaskView({ task, now, open }: { task: Task; now: number; open?: boolean }) {
  const steps = task.steps.filter((s) => !serviceOf(homeOf(s.server, s.tool)).hidden)
  const took = (task.endedAt ?? now) - task.startedAt
  return (
    <details className={`task ${task.status}`} open={open}>
      <summary>
        <span className="when">{clock(task.startedAt)}</span>
        <span className="ask">“{task.text}”</span>
        <span className={`badge ${task.status}`}>{TASK_WORD[task.status]}</span>
        <span className="took">{secs(took)}</span>
      </summary>
      {steps.length ? (
        <ol className="steps">
          {steps.map((s, i) => {
            const svc = serviceOf(homeOf(s.server, s.tool))
            return (
              <li key={s.id} className={`step ${s.status}`}>
                <div className="line">
                  <span className="n">{i + 1}.</span>
                  <span className={`st ${s.status}`}>{STEP_ICON[s.status]}</span>
                  <span className="svc">{svc.icon}</span>
                  <span className="what">{stepLabel(s.server, s.tool)}</span>
                  <span className="word">{STEP_WORD[s.status]}</span>
                  <span className="took">{secs((s.endedAt ?? now) - s.startedAt)}</span>
                </div>
                <Fields input={s.input} />
                {s.result ? (
                  <details className="result">
                    <summary>Ver resultado</summary>
                    <pre>{s.result}</pre>
                  </details>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="empty">{task.status === 'running' ? 'Pensando…' : 'Respondió sin usar herramientas.'}</p>
      )}
      {task.reply ? <p className="reply">🗣️ {task.reply}</p> : null}
    </details>
  )
}

export default function Console() {
  const { connected, servers, tasks, approvals, answer } = useBridge()
  const now = useTick()
  const [current, ...history] = tasks
  const visible = servers.filter((s) => !serviceOf(s.name).hidden)

  return (
    <div className="console">
      <header className="top">
        <h1>Consola Nexy</h1>
        <span className={connected ? 'conn on' : 'conn off'}>
          {connected ? '● Conectada' : '● Sin conexión con Nexy — ¿está encendida?'}
        </span>
      </header>

      <main>
        <section className="left">
          <h2>Mapa</h2>
          <MapView servers={servers} tasks={tasks} now={now} />
          <h2>Conexiones</h2>
          <ul className="servers">
            {visible.length ? (
              visible.map((s) => {
                const down = s.status === 'failed' || s.status === 'needs-auth'
                return (
                  <li key={s.name} className={down ? 'down' : 'up'}>
                    {down ? '⚠️' : '✅'} {serviceOf(s.name).icon} {serviceOf(s.name).label}
                    {down ? <em> — {s.status === 'needs-auth' ? 'pide iniciar sesión' : 'no conecta'}</em> : null}
                  </li>
                )
              })
            ) : (
              <li className="muted">Aparecen cuando le hables a Nexy por primera vez.</li>
            )}
          </ul>
        </section>

        <section className="right">
          {approvals.length ? (
            <>
              <h2 className="attention">Esperando tu aprobación ({approvals.length})</h2>
              {approvals.map((a) => (
                <ApprovalCard key={a.id} a={a} now={now} answer={answer} />
              ))}
            </>
          ) : null}

          <h2>Tarea actual</h2>
          {current ? (
            <TaskView task={current} now={now} open />
          ) : (
            <p className="muted">Nada todavía. Pídele algo a Nexy y aquí verás cada paso.</p>
          )}

          {history.length ? (
            <>
              <h2>Historial</h2>
              {history.map((t) => (
                <TaskView key={t.id} task={t} now={now} />
              ))}
            </>
          ) : null}
        </section>
      </main>
    </div>
  )
}
