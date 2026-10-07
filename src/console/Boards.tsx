import { useEffect, useState } from 'react'
import { inScope, isAgentStep, isToday } from './activity'
import { deptOf, homeOf, serviceOf } from './services'
import type { Approval, Brain, Brand, Brands, Org, Server, Task } from './types'

/**
 * The boards: the numbers at a glance, and one card per brand with its
 * accounts, its activity and its manual — which the owner can edit here.
 */

function Account({ label, list }: { label: string; list: string[] }) {
  return (
    <div className="account">
      <span>{label}</span>
      {list.length ? <b>{list.join(', ')}</b> : <em>Por conectar</em>}
    </div>
  )
}

function BrandCard({
  brand,
  active,
  tasks,
  approvals,
  manual,
  refs,
  onUse,
  onSave,
}: {
  brand: Brand
  active: boolean
  tasks: Task[]
  approvals: Approval[]
  manual: string
  refs: number
  onUse: () => void
  onSave: (text: string) => void
}) {
  const [text, setText] = useState(manual)
  const [saved, setSaved] = useState<'idle' | 'dirty' | 'saved'>('idle')
  // A note added by voice arrives from the bridge; take it unless mid-edit.
  useEffect(() => {
    if (saved !== 'dirty') setText(manual)
  }, [manual, saved])

  const today = tasks.filter((t) => isToday(t.startedAt))
  return (
    <article className={`brand-card${active ? ' active' : ''}`} style={{ ['--brand' as string]: brand.color }}>
      <header>
        <i className="swatch" />
        <h3>{brand.nombre}</h3>
        {active ? (
          <span className="working">● Nexy trabaja aquí</span>
        ) : (
          <button className="ghost" onClick={onUse}>
            Trabajar aquí
          </button>
        )}
      </header>
      {brand.descripcion ? <p className="muted">{brand.descripcion}</p> : null}
      <div className="brand-stats">
        <div>
          <b>{today.length}</b>
          <span>tareas hoy</span>
        </div>
        <div>
          <b>{tasks.length}</b>
          <span>en historial</span>
        </div>
        <div className={approvals.length ? 'hot' : ''}>
          <b>{approvals.length}</b>
          <span>por aprobar</span>
        </div>
      </div>
      <div className="accounts">
        <Account label="Correo" list={brand.cuentas.correo} />
        <Account
          label="Redes"
          list={[
            ...(brand.conexiones ?? []).map((c) => `${c.nombre || `#${c.id}`} (${c.servicio})`),
            ...brand.cuentas.redes,
          ]}
        />
        <Account label="Notion" list={brand.cuentas.notion} />
        <div className="account">
          <span>Diseño</span>
          {refs ? <b>{refs} referencia{refs === 1 ? '' : 's'} visual{refs === 1 ? '' : 'es'}</b> : <em>Mándale fotos de tus diseños a Nexy</em>}
        </div>
      </div>
      <label className="manual">
        <span>Manual de marca — cómo suena, qué publica, qué evita. Una idea por línea.</span>
        <textarea
          rows={6}
          value={text}
          placeholder={'Ej.:\nTono cercano y directo, tuteamos.\nNada de emojis en LinkedIn.\nColores: morado y negro.'}
          onChange={(e) => {
            setText(e.target.value)
            setSaved('dirty')
          }}
        />
      </label>
      <div className="manual-actions">
        <button
          className="save"
          disabled={saved !== 'dirty'}
          onClick={() => {
            onSave(text)
            setSaved('saved')
          }}
        >
          Guardar manual
        </button>
        {saved === 'saved' ? <span className="ok">Guardado ✓</span> : null}
      </div>
    </article>
  )
}

export function Boards({
  brands,
  brandFilter,
  tasks,
  approvals,
  servers,
  org,
  brain,
  switchBrand,
  saveManual,
}: {
  brands: Brands | null
  brandFilter: string | null
  tasks: Task[]
  approvals: Approval[]
  servers: Server[]
  org: Org | null
  brain: Brain | null
  switchBrand: (id: string) => void
  saveManual: (id: string, text: string) => void
}) {
  const inBrand = (id?: string | null) => inScope(brands, brandFilter, id)
  const shown = tasks.filter((t) => inBrand(t.brand))
  const today = shown.filter((t) => isToday(t.startedAt))
  const working = new Set(
    shown.flatMap((t) => t.steps.filter((s) => isAgentStep(s) && s.status === 'running').map((s) => s.agent)),
  )
  const up = servers.filter((s) => s.status !== 'failed' && s.status !== 'needs-auth').length

  // Steps per department today, for the bar list.
  const perDept = new Map<string, number>()
  for (const t of today) {
    for (const s of t.steps) {
      if (s.by) continue // counted with the agent that made it
      const home = homeOf(s.server, s.tool)
      const d = isAgentStep(s)
        ? org?.agents.find((a) => a.id === s.agent)?.dept
        : serviceOf(home).hidden
          ? undefined
          : deptOf(home)
      if (d) perDept.set(d, (perDept.get(d) ?? 0) + 1)
    }
  }
  const maxDept = Math.max(1, ...perDept.values())
  const manualOf = (id: string) =>
    (brain?.nodes ?? [])
      .filter((n) => n.kind === 'note' && n.brand === id)
      .map((n) => n.detail ?? n.label)
      .join('\n')

  return (
    <div className="boards">
      <div className="kpis">
        <div className="kpi">
          <b>{today.length}</b>
          <span>Tareas hoy</span>
        </div>
        <div className={`kpi${approvals.length ? ' hot' : ''}`}>
          <b>{approvals.filter((a) => inBrand(a.brand)).length}</b>
          <span>Esperando tu aprobación</span>
        </div>
        <div className="kpi">
          <b>{working.size}</b>
          <span>Agentes trabajando</span>
        </div>
        <div className="kpi">
          <b>
            {up}/{servers.length || '—'}
          </b>
          <span>Conexiones activas</span>
        </div>
      </div>

      <section>
        <h2>Actividad de hoy por departamento</h2>
        {perDept.size ? (
          <ul className="bars">
            {(org?.departments ?? [])
              .filter((d) => perDept.has(d.id))
              .map((d) => (
                <li key={d.id}>
                  <span>
                    {d.icon} {d.short ?? d.label}
                  </span>
                  <i style={{ width: `${((perDept.get(d.id) ?? 0) / maxDept) * 100}%` }} />
                  <b>{perDept.get(d.id)}</b>
                </li>
              ))}
          </ul>
        ) : (
          <p className="muted">Nada todavía hoy.</p>
        )}
      </section>

      <section>
        <h2>Marcas</h2>
        <div className="brand-grid">
          {(brands?.marcas ?? [])
            .filter((b) => inBrand(b.id))
            .map((b) => (
              <BrandCard
                key={b.id}
                brand={b}
                active={brands?.activa === b.id}
                tasks={tasks.filter((t) => t.brand === b.id)}
                approvals={approvals.filter((a) => a.brand === b.id)}
                manual={manualOf(b.id)}
                refs={(brain?.nodes ?? []).filter((n) => n.kind === 'ref' && n.brand === b.id).length}
                onUse={() => switchBrand(b.id)}
                onSave={(text) => saveManual(b.id, text)}
              />
            ))}
        </div>
      </section>
    </div>
  )
}
