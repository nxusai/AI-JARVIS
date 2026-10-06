import { brandOf, clock, isAgentStep, stepLook } from './activity'
import { BrandPill } from './parts'
import { deptOf, homeOf, serviceOf } from './services'
import type { Approval, Brands, Org, Server, Step, Task } from './types'

/**
 * The company by departments: for the brand picked above (or all of them),
 * each "Departamento de …" with what it does, its specialists, its
 * connections, what it is doing now and what waits for the owner. Marketing
 * also shows the editing molds, which every brand shares.
 */

/** The department a step belongs to: its agent's, or its service's. */
function stepDept(s: Step, org: Org | null): string | undefined {
  if (isAgentStep(s)) return org?.agents.find((a) => a.id === s.agent)?.dept
  if (s.by) return org?.agents.find((a) => a.id === s.by)?.dept
  const home = homeOf(s.server, s.tool)
  return serviceOf(home).hidden ? undefined : deptOf(home)
}

const STATUS: Record<string, [string, string]> = {
  connected: ['ok', 'Conectado'],
  failed: ['bad', 'Falló'],
  'needs-auth': ['warn', 'Falta iniciar sesión'],
  pending: ['warn', 'Conectando'],
}

export function Departments({
  brands,
  brandFilter,
  tasks,
  approvals,
  servers,
  org,
  openApprovals,
}: {
  brands: Brands | null
  brandFilter: string | null
  tasks: Task[]
  approvals: Approval[]
  servers: Server[]
  org: Org | null
  openApprovals: () => void
}) {
  const brand = brandOf(brands, brandFilter)
  const inBrand = (id?: string | null) => !brandFilter || (id ?? brands?.activa) === brandFilter
  const steps = tasks
    .filter((t) => inBrand(t.brand))
    .flatMap((t) => t.steps.map((s) => ({ t, s, d: stepDept(s, org) })))
    .sort((a, b) => b.s.startedAt - a.s.startedAt)
  const waiting = approvals.filter((a) => inBrand(a.brand))
  const status = new Map(servers.map((s) => [s.name, s.status]))
  const agents = org?.agents ?? []
  const molds = (org?.molds ?? []).filter((m) => !m.marca || !brandFilter || m.marca === brandFilter)

  return (
    <main className="depts">
      <h1 className="depts-title">
        {brand ? (
          <>
            <BrandPill brand={brand} big /> Departamentos
          </>
        ) : (
          <>Departamentos · todas las empresas</>
        )}
      </h1>
      <p className="muted depts-sub">
        Cada empresa tiene los mismos departamentos. Escoge arriba una empresa para ver solo lo suyo.
      </p>

      <div className="dept-grid">
        {(org?.departments ?? []).map((d) => {
          const mine = steps.filter((x) => x.d === d.id)
          const busy = mine.some((x) => x.s.status === 'running' || x.s.status === 'waiting')
          const held = waiting.filter((a) => deptOf(homeOf(a.server, a.tool)) === d.id)
          const team = agents.filter((a) => a.dept === d.id)
          const svcs = [...new Set([...servers.map((s) => s.name), 'web'])].filter((k) => !serviceOf(k).hidden && deptOf(k) === d.id)
          return (
            <section key={d.id} className={`dept-card${busy ? ' busy' : ''}`}>
              <header>
                <span className="dept-icon">{d.icon}</span>
                <h2>{d.label}</h2>
                {busy ? <span className="dept-live">● Trabajando</span> : null}
              </header>
              {d.hace ? <p className="dept-does">{d.hace}</p> : null}

              {held.length ? (
                <button className="dept-held" onClick={openApprovals}>
                  ⚠️ {held.length === 1 ? '1 acción espera' : `${held.length} acciones esperan`} tu aprobación
                </button>
              ) : null}

              <h3>Equipo</h3>
              <ul className="dept-list">
                <li>
                  <b>🧠 Nexy</b>
                  <span>{team.length ? 'Coordina y decide qué especialista usar.' : 'Hace este trabajo directamente.'}</span>
                </li>
                {team.map((a) => {
                  const on = mine.some((x) => x.s.status === 'running' && (x.s.agent === a.id || x.s.by === a.id))
                  return (
                    <li key={a.id} className={on ? 'on' : undefined}>
                      <b>
                        {a.icon} {a.label}
                        {on ? <i className="dot" /> : null}
                      </b>
                      <span>{a.description}</span>
                    </li>
                  )
                })}
              </ul>

              {svcs.length ? (
                <>
                  <h3>Conexiones</h3>
                  <ul className="dept-svcs">
                    {svcs.map((k) => {
                      const st = k === 'web' ? 'connected' : status.get(k) ?? 'pending'
                      const [cls, text] = STATUS[st] ?? ['warn', st]
                      return (
                        <li key={k} title={text}>
                          <i className={`st ${cls}`} />
                          {serviceOf(k).icon} {serviceOf(k).label}
                        </li>
                      )
                    })}
                  </ul>
                </>
              ) : null}

              {d.id === 'marketing' ? (
                <>
                  <h3>Moldes de edición · {molds.length}</h3>
                  {molds.length ? (
                    <>
                      <p className="muted small">
                        Para todas las empresas. En cada edición Nexy escoge el molde que mejor queda, o mezcla varios.
                      </p>
                      <ul className="dept-molds">
                        {molds.map((m) => (
                          <li key={`${m.marca ?? ''}:${m.nombre}`}>
                            <b>
                              🎬 {m.nombre}
                              {m.marca ? <em> · solo {brandOf(brands, m.marca)?.nombre ?? m.marca}</em> : null}
                            </b>
                            <span>{m.resumen}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="muted small">Todavía no hay moldes. Mándale a Nexy un video de referencia y lo guarda como molde.</p>
                  )}
                </>
              ) : null}

              <h3>Actividad reciente</h3>
              {mine.length ? (
                <ul className="recent">
                  {mine.slice(0, 4).map(({ t, s }) => (
                    <li key={s.id}>
                      <span className="when">{clock(s.startedAt)}</span>
                      {brandFilter ? null : <BrandPill brand={brandOf(brands, t.brand)} />}
                      {stepLook(s, agents).label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Sin actividad todavía.</p>
              )}
            </section>
          )
        })}
      </div>
    </main>
  )
}
