import { useState } from 'react'
import { describeInput, homeOf, postPreview, serviceOf, stepLabel } from './services'
import { BRIDGE_HTTP_URL } from '../config'
import { brandOf, clock, isAgentStep, secs, stepLook } from './activity'
import type { Agent, Approval, Brand, Brands, Step, StepStatus, Task } from './types'

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

export function BrandPill({ brand, big }: { brand?: Brand; big?: boolean }) {
  if (!brand) return null
  return (
    <span className={big ? 'brand-pill big' : 'brand-pill'} style={{ ['--brand' as string]: brand.color }}>
      <i />
      {brand.nombre}
    </span>
  )
}

/** The images of a post, through the bridge's image proxy; videos as links. */
function Media({ input }: { input: Record<string, unknown> }) {
  const media = postPreview(input)?.media ?? []
  if (!media.length) return null
  return (
    <div className="post-media">
      {media.slice(0, 4).map((url) =>
        /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url) ? (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            🎬 Ver video
          </a>
        ) : (
          <img key={url} src={`${BRIDGE_HTTP_URL}/img?url=${encodeURIComponent(url)}`} alt="Imagen del post" />
        ),
      )}
    </div>
  )
}

export function Fields({ input, full }: { input: Record<string, unknown>; full?: boolean }) {
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

export function ApprovalCard({
  a,
  now,
  brands,
  answer,
}: {
  a: Approval
  now: number
  brands: Brands | null
  answer: (id: string, ok: boolean, note: string) => void
}) {
  const [note, setNote] = useState('')
  const left = Math.max(0, a.expiresAt - now)
  const svc = serviceOf(homeOf(a.server, a.tool))
  const brand = brandOf(brands, a.brand)
  return (
    <article className="approval" style={{ ['--brand' as string]: brand?.color ?? 'var(--warn)' }}>
      {brand ? (
        <div className="approval-brand">
          En la marca <strong>{brand.nombre}</strong>
          {a.account ? <div className="approval-account">📍 Se publica en: {a.account}</div> : null}
        </div>
      ) : null}
      <header>
        <span className="svc">{svc.icon}</span>
        <h3>¿Apruebas? · {stepLabel(a.server, a.tool)}</h3>
        <span className="expires">
          expira en {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}
        </span>
      </header>
      <Media input={a.input} />
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

function StepRow({ s, i, now, agents, inner }: { s: Step; i: number; now: number; agents: Agent[]; inner?: boolean }) {
  const look = stepLook(s, agents)
  const agentWork = isAgentStep(s)
  return (
    <li className={`step ${s.status}${inner ? ' inner' : ''}${agentWork ? ' agent' : ''}`}>
      <div className="line">
        <span className="n">{inner ? '↳' : `${i}.`}</span>
        <span className={`st ${s.status}`}>{STEP_ICON[s.status]}</span>
        <span className="svc">{look.icon}</span>
        <span className="what">{look.label}</span>
        <span className="word">{STEP_WORD[s.status]}</span>
        <span className="took">{secs((s.endedAt ?? now) - s.startedAt)}</span>
      </div>
      <Fields input={s.input} />
      {s.result ? (
        // An agent's result is the work itself — shown open, not tucked away.
        <details className="result" open={agentWork}>
          <summary>{agentWork ? 'Ver trabajo' : 'Ver resultado'}</summary>
          <pre>{s.result}</pre>
        </details>
      ) : null}
    </li>
  )
}

export function TaskView({
  task,
  now,
  open,
  brands,
  agents,
}: {
  task: Task
  now: number
  open?: boolean
  brands: Brands | null
  agents: Agent[]
}) {
  const visible = task.steps.filter((s) => isAgentStep(s) || !serviceOf(homeOf(s.server, s.tool)).hidden)
  // The steps an agent took sit under the step that handed it the work.
  const top = visible.filter((s) => !s.parent)
  const inside = (s: Step) => visible.filter((x) => x.parent === s.id)
  const took = (task.endedAt ?? now) - task.startedAt
  return (
    <details className={`task ${task.status}`} open={open}>
      <summary>
        <span className="when">{clock(task.startedAt)}</span>
        <BrandPill brand={brandOf(brands, task.brand)} />
        {task.via === 'telegram' ? (
          <span className="via" title="Pedido por Telegram">
            📱 Telegram
          </span>
        ) : null}
        <span className="ask">“{task.text}”</span>
        <span className={`badge ${task.status}`}>{TASK_WORD[task.status]}</span>
        <span className="took">{secs(took)}</span>
      </summary>
      {visible.length ? (
        <ol className="steps">
          {top.map((s, i) => (
            <li key={s.id} className="step-group">
              <ol>
                <StepRow s={s} i={i + 1} now={now} agents={agents} />
                {inside(s).map((x) => (
                  <StepRow key={x.id} s={x} i={0} now={now} agents={agents} inner />
                ))}
              </ol>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">{task.status === 'running' ? 'Pensando…' : 'Respondió sin usar herramientas.'}</p>
      )}
      {task.reply ? <p className="reply">🗣️ {task.reply}</p> : null}
    </details>
  )
}
