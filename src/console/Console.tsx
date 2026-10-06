import { useEffect, useMemo, useRef, useState } from 'react'
import { BRIDGE_WS_URL } from '../config'
import { brandOf, clock, isAgentStep, liveNodes, stepLook } from './activity'
import { Boards } from './Boards'
import { Brain } from './Brain'
import { Departments } from './Departments'
import { EcosystemMap } from './EcosystemMap'
import { buildEcosystem, ecoLive } from './ecosystem'
import { ApprovalCard, BrandPill, TaskView } from './parts'
import { homeOf } from './services'
import type { Approval, Brain as BrainData, Brands, Org, Server, Task } from './types'

/**
 * The Ramos & Co. console: what Nexy and her team are doing, for which brand, and
 * where she is waiting for approval. It watches, answers approvals, switches
 * brands and edits brand manuals — everything else comes from
 * bridge/console.mjs, and it never talks to the agent.
 */

function useBridge() {
  const [connected, setConnected] = useState(false)
  const [servers, setServers] = useState<Server[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [brands, setBrands] = useState<Brands | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [brain, setBrain] = useState<BrainData | null>(null)
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
          setBrands((msg.brands as Brands) ?? null)
          setOrg((msg.org as Org) ?? null)
          setBrain((msg.brain as BrainData) ?? null)
        } else if (msg.type === 'servers') {
          setServers((msg.servers as Server[]) ?? [])
        } else if (msg.type === 'approvals') {
          setApprovals((msg.approvals as Approval[]) ?? [])
        } else if (msg.type === 'brands') {
          setBrands((msg.brands as Brands) ?? null)
        } else if (msg.type === 'org') {
          setOrg((msg.org as Org) ?? null)
        } else if (msg.type === 'brain') {
          setBrain((msg.brain as BrainData) ?? null)
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

  const send = (msg: object) => socket.current?.send(JSON.stringify(msg))
  const answer = (id: string, approve: boolean, note: string) => send({ type: approve ? 'approve' : 'reject', id, note })
  const switchBrand = (id: string) => send({ type: 'use-brand', id })
  const saveManual = (id: string, text: string) => send({ type: 'brand-manual', id, text })

  return { connected, servers, tasks, approvals, brands, org, brain, answer, switchBrand, saveManual }
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

/** A small preference kept in this browser only; fine to lose. */
function useSaved<T extends string | null>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const v = localStorage.getItem(key)
      return (v === null ? initial : v === '' ? null : v) as T
    } catch {
      return initial
    }
  })
  const set = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, v ?? '')
    } catch {
      // Private window or blocked storage: the choice just won't be remembered.
    }
  }
  return [value, set]
}

type Tab = 'departamentos' | 'mapa' | 'cerebro' | 'tableros' | 'aprobaciones'
const TABS: Array<[Tab, string]> = [
  ['departamentos', 'Departamentos'],
  ['mapa', 'Mapa'],
  ['cerebro', 'Cerebro'],
  ['tableros', 'Tableros'],
  ['aprobaciones', 'Aprobaciones'],
]

export default function Console() {
  const { connected, servers, tasks, approvals, brands, org, brain, answer, switchBrand, saveManual } = useBridge()
  const now = useTick()
  const [tab, setTab] = useSaved<Tab>('nexy-console-view', 'departamentos')
  const [brandFilter, setBrandFilter] = useSaved<string | null>('nexy-console-brand', null)
  const [selected, setSelected] = useState<string | null>(null)

  const agents = useMemo(() => org?.agents ?? [], [org])
  const live = useMemo(() => liveNodes(tasks, agents, now), [tasks, agents, now])
  const nodes = useMemo(() => buildEcosystem(brands, org, servers, brain), [brands, org, servers, brain])
  const eco = useMemo(() => ecoLive(tasks, nodes, org, brands?.activa ?? null, now), [tasks, nodes, org, brands, now])
  // Picking a brand chip flies the map there; "Todas" pulls back to everything.
  const [focus, setFocus] = useState<string | null>(null)
  const active = brandOf(brands, brands?.activa)
  const inBrand = (id?: string | null) => !brandFilter || id === brandFilter
  const shownTasks = tasks.filter((t) => inBrand(t.brand))
  const shownApprovals = approvals.filter((a) => inBrand(a.brand))
  const [current, ...history] = shownTasks

  // The node picked on the map, and the steps behind it, newest first.
  const node = nodes.find((n) => n.id === selected)
  const [nodeEco, nodeKind, nodeKey] = (node?.id ?? '').split(':')
  const nodeSteps = node
    ? tasks
        .filter((t) => nodeEco === 'core' || (t.brand ?? brands?.activa) === nodeEco)
        .flatMap((t) => t.steps.map((s) => ({ t, s })))
        .filter(({ s }) => {
          if (nodeKind === 'agent') return s.agent === nodeKey || s.by === nodeKey
          if (nodeKind === 'svc') return !isAgentStep(s) && homeOf(s.server, s.tool) === nodeKey
          if (nodeKind === 'brand') return true
          return false
        })
        .sort((a, b) => b.s.startedAt - a.s.startedAt)
        .slice(0, 8)
    : []

  const approvalsBlock = shownApprovals.length ? (
    <>
      <h2 className="attention">Esperando tu aprobación ({shownApprovals.length})</h2>
      {shownApprovals.map((a) => (
        <ApprovalCard key={a.id} a={a} now={now} brands={brands} answer={answer} />
      ))}
    </>
  ) : null

  return (
    <div className="console" style={active ? { ['--brand' as string]: active.color } : undefined}>
      <header className="top">
        <div className="logo">
          <span className="mark">{brands?.grupo ?? 'Ramos & Co.'}</span>
          <span className="sub">Consola de Nexy</span>
        </div>
        <label className="working-on">
          <span>Nexy trabaja en</span>
          <select value={brands?.activa ?? ''} onChange={(e) => switchBrand(e.target.value)} disabled={!brands}>
            {(brands?.marcas ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
          <i className="swatch" />
        </label>
        <span className={connected ? 'conn on' : 'conn off'}>
          {connected ? '● Conectada' : '● Sin conexión con Nexy — ¿está encendida?'}
        </span>
      </header>

      <nav className="brand-filter" aria-label="Ver marca">
        <button
          className={!brandFilter ? 'chip on' : 'chip'}
          onClick={() => {
            setBrandFilter(null)
            setFocus('all')
          }}
        >
          Todas
        </button>
        {(brands?.marcas ?? []).map((b) => (
          <button
            key={b.id}
            className={brandFilter === b.id ? 'chip on' : 'chip'}
            style={{ ['--brand' as string]: b.color }}
            onClick={() => {
              setBrandFilter(brandFilter === b.id ? null : b.id)
              setFocus(null)
              setTimeout(() => setFocus(brandFilter === b.id ? 'all' : b.id), 0)
            }}
          >
            <i />
            {b.nombre}
          </button>
        ))}
      </nav>

      <nav className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'tab on' : 'tab'} onClick={() => setTab(id)}>
            {label}
            {id === 'aprobaciones' && approvals.length ? <span className="count">{approvals.length}</span> : null}
          </button>
        ))}
      </nav>

      {tab !== 'aprobaciones' && tab !== 'mapa' && approvals.length ? (
        <button className="banner" onClick={() => setTab('aprobaciones')}>
          ⚠️ {approvals.length === 1 ? 'Hay 1 acción' : `Hay ${approvals.length} acciones`} esperando tu aprobación — ver
        </button>
      ) : null}

      {tab === 'mapa' ? (
        <main className="split">
          <section className="left">
            <EcosystemMap grupo={brands?.grupo ?? 'Ramos & Co.'} nodes={nodes} live={eco} selected={selected} onSelect={setSelected} focus={focus} />
            <div className="legend">
              <span>
                <i className="lg dept" /> Marca · departamento · agente
              </span>
              <span>
                <i className="lg svc" /> Conexión
              </span>
              <span>
                <i className="lg live" /> Trabajando ahora
              </span>
            </div>
            {node ? (
              <aside className="node-card">
                <h3>
                  {node.icon ? `${node.icon} ` : ''}
                  {node.label}
                </h3>
                {node.detail ? <p>{node.detail}</p> : null}
                {node.faded ? <p className="muted">Sin cuenta conectada para esta marca.</p> : null}
                {nodeSteps.length ? (
                  <ul className="recent">
                    {nodeSteps.map(({ t, s }) => (
                      <li key={s.id}>
                        <span className="when">{clock(s.startedAt)}</span>
                        <BrandPill brand={brandOf(brands, t.brand)} />
                        {stepLook(s, agents).label}
                      </li>
                    ))}
                  </ul>
                ) : nodeKind === 'agent' || nodeKind === 'svc' ? (
                  <p className="muted">Todavía sin actividad aquí.</p>
                ) : null}
              </aside>
            ) : null}
          </section>

          <section className="right">
            {approvalsBlock}
            <h2>Tarea actual</h2>
            {current ? (
              <TaskView task={current} now={now} open brands={brands} agents={agents} />
            ) : (
              <p className="muted">Nada todavía. Pídele algo a Nexy y aquí verás cada paso.</p>
            )}
            {history.length ? (
              <>
                <h2>Historial</h2>
                {history.map((t) => (
                  <TaskView key={t.id} task={t} now={now} brands={brands} agents={agents} />
                ))}
              </>
            ) : null}
          </section>
        </main>
      ) : null}

      {tab === 'departamentos' ? (
        <Departments
          brands={brands}
          brandFilter={brandFilter}
          tasks={tasks}
          approvals={approvals}
          servers={servers}
          org={org}
          openApprovals={() => setTab('aprobaciones')}
        />
      ) : null}

      {tab === 'cerebro' ? <Brain data={brain} live={live} brandFilter={brandFilter} /> : null}

      {tab === 'tableros' ? (
        <Boards
          brands={brands}
          brandFilter={brandFilter}
          tasks={tasks}
          approvals={approvals}
          servers={servers.filter((s) => s.name !== 'jarvis' && s.name !== 'jarvis_ui')}
          org={org}
          brain={brain}
          switchBrand={switchBrand}
          saveManual={saveManual}
        />
      ) : null}

      {tab === 'aprobaciones' ? (
        <main className="approvals-page">
          {approvalsBlock ?? <p className="muted">Nada esperando tu aprobación. Cuando Nexy vaya a enviar, publicar o cambiar algo, aparecerá aquí.</p>}
        </main>
      ) : null}
    </div>
  )
}
