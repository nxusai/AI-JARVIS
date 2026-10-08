import { brandOf, clock, companyOf, inScope, isAgentStep, stepLook } from './activity'
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
  pick,
}: {
  brands: Brands | null
  brandFilter: string | null
  tasks: Task[]
  approvals: Approval[]
  servers: Server[]
  org: Org | null
  openApprovals: () => void
  /** Show one company (or holding) instead. */
  pick: (id: string) => void
}) {
  const brand = brandOf(brands, brandFilter)
  const inBrand = (id?: string | null) => inScope(brands, brandFilter, id ?? brands?.activa)
  const steps = tasks
    .filter((t) => inBrand(t.brand))
    .flatMap((t) => t.steps.map((s) => ({ t, s, d: stepDept(s, org) })))
    .sort((a, b) => b.s.startedAt - a.s.startedAt)
  const waiting = approvals.filter((a) => inBrand(a.brand))
  const status = new Map(servers.map((s) => [s.name, s.status]))
  const agents = org?.agents ?? []
  const molds = (org?.molds ?? []).filter((m) => !m.marca || !brandFilter || m.marca === brandFilter || companyOf(brands, m.marca) === brandFilter)
  // A holding's page shows its companies; a company of a holding names it.
  const holding = brand ? brandOf(brands, companyOf(brands, brand.id)) : undefined
  const family = holding && holding.id !== brand?.id ? [] : holding ? (brands?.marcas ?? []).filter((b) => b.padre === holding.id) : []
  const isHolding = Boolean(brand && family.length)
  const depts = (org?.departments ?? []).filter((d) => !brand?.ocultos?.includes(d.id))
  // Each company shows its own mailbox (gmail-mi-semago) and the owner's Gmail
  // shows in his own companies; all of them when no company is picked.
  const mailFor = (k: string) =>
    !brand ? true : k.startsWith('gmail-') ? k === `gmail-${brand.id}` : k === 'gmail' ? brand.cartera !== 'cliente' : true

  if (brand && isHolding) {
    return (
      <main className="depts">
        <h1 className="depts-title">
          <BrandPill brand={brand} big /> Holding
        </h1>
        <p className="muted depts-sub">
          {brand.nombre} es el paraguas: no tiene departamentos propios. Todo el trabajo lo hacen sus empresas, cada una con sus departamentos.
        </p>
        {/* The holding's own mailbox (gmail-abuelito-inc): its own, never its companies'. */}
        {servers.some((x) => x.name === `gmail-${brand.id}`) ? (
          <ul className="dept-svcs">
            {servers
              .filter((x) => x.name === `gmail-${brand.id}`)
              .map((x) => {
                const [cls, text] = STATUS[x.status] ?? ['warn', x.status]
                return (
                  <li key={x.name} title={text}>
                    <i className={`st ${cls}`} />
                    {serviceOf(x.name).icon} {serviceOf(x.name).label} · solo de {brand.nombre}
                  </li>
                )
              })}
          </ul>
        ) : null}
        <div className="dept-grid">
          {family.map((c) => {
            const mine = tasks.filter((t) => t.brand === c.id)
            const busy = mine.some((t) => t.status === 'running')
            const held = approvals.filter((a) => a.brand === c.id)
            const recent = mine.flatMap((t) => t.steps).sort((a, b) => b.startedAt - a.startedAt).slice(0, 3)
            const count = (org?.departments ?? []).filter((d) => !c.ocultos?.includes(d.id)).length
            return (
              <section key={c.id} className={`dept-card${busy ? ' busy' : ''}`} style={{ ['--brand' as string]: c.color }}>
                <header>
                  <span className="dept-icon">🏢</span>
                  <h2>{c.nombre}</h2>
                  {busy ? <span className="dept-live">● Trabajando</span> : null}
                </header>
                <p className="dept-does">
                  {count} departamentos
                  {c.ocultos?.length
                    ? ` · sin ${c.ocultos.map((o) => org?.departments.find((d) => d.id === o)?.short ?? o).join(', ')} por ahora`
                    : ''}
                </p>
                {held.length ? (
                  <button className="dept-held" onClick={openApprovals}>
                    ⚠️ {held.length === 1 ? '1 acción espera' : `${held.length} acciones esperan`} tu aprobación
                  </button>
                ) : null}
                <h3>Actividad reciente</h3>
                {recent.length ? (
                  <ul className="recent">
                    {recent.map((s) => (
                      <li key={s.id}>
                        <span className="when">{clock(s.startedAt)}</span>
                        {stepLook(s, agents).label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">Sin actividad todavía.</p>
                )}
                <button className="dept-open" onClick={() => pick(c.id)}>
                  Ver departamentos de {c.nombre} →
                </button>
              </section>
            )
          })}
        </div>
      </main>
    )
  }

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
        {brand?.padre && holding
          ? `${brand.nombre} es una empresa de ${holding.nombre}, con sus propios departamentos.`
          : brand
            ? `Los departamentos de ${brand.nombre}.`
            : 'Cada empresa tiene sus propios departamentos. Escoge arriba una empresa para ver solo lo suyo.'}
        {brand?.ocultos?.length
          ? ` Sin ${brand.ocultos.map((o) => org?.departments.find((d) => d.id === o)?.short ?? o).join(', ')} por ahora.`
          : ''}
      </p>
      {brand?.padre && holding ? (
        <div className="dept-family">
          <button className="chip" onClick={() => pick(holding.id)}>
            ← {holding.nombre}
          </button>
        </div>
      ) : null}

      <div className="dept-grid">
        {depts.map((d) => {
          const mine = steps.filter((x) => x.d === d.id)
          const busy = mine.some((x) => x.s.status === 'running' || x.s.status === 'waiting')
          const held = waiting.filter((a) => deptOf(homeOf(a.server, a.tool)) === d.id)
          const team = agents.filter((a) => a.dept === d.id)
          const svcs = [...new Set([...servers.map((s) => s.name), 'web'])].filter((k) => !serviceOf(k).hidden && deptOf(k) === d.id && mailFor(k))
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
