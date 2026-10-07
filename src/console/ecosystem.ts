import { deptOf, homeOf, serviceOf } from './services'
import { isAgentStep, AFTERGLOW_MS } from './activity'
import type { Brain, Brand, Brands, Org, Server, Task } from './types'

/**
 * The whole ecosystem on one sheet: Nexy in the middle with her own core
 * (memory, contacts, the shared services), and around her one galaxy per
 * brand — its departments, their agents and connections, and what Nexy knows
 * about the brand. Positions are in world units; the map pans and zooms over
 * them, so from far away it is dots and lines and up close it is the detail.
 *
 * Every brand gets the same team: the agents are one set, but they work for
 * whichever brand a task belongs to, so that is where they light up.
 */

export type Kind = 'core' | 'brand' | 'dept' | 'agent' | 'svc' | 'know' | 'sat' | 'dot'

export type EcoNode = {
  id: string
  kind: Kind
  label: string
  icon?: string
  x: number
  y: number
  r: number
  color: string
  /** The galaxy it belongs to: a brand id, or 'core'. */
  eco: string
  parent: string | null
  detail?: string
  faded?: boolean
}

const TAU = Math.PI * 2
const RB = 1150 // core → brand
const RD = 330 // brand → department
const RC = 150 // department → agent or connection
const RK = 150 // brand → what Nexy knows about it
const RS = 250 // core → core satellites

const polar = (cx: number, cy: number, r: number, a: number) => ({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })

/** Children spread in a fan pointing away from where their parent hangs. */
function fan(n: number, towards: number, spread = (140 * Math.PI) / 180) {
  if (n <= 0) return []
  if (n === 1) return [towards]
  const step = Math.min(spread / (n - 1), 0.8)
  return Array.from({ length: n }, (_, i) => towards + (i - (n - 1) / 2) * step)
}

export function buildEcosystem(brands: Brands | null, org: Org | null, servers: Server[], brain: Brain | null): EcoNode[] {
  const nodes: EcoNode[] = []
  const add = (n: EcoNode) => nodes.push(n)
  const accent = '#a78bfa'

  add({ id: 'core', kind: 'core', label: 'NEXY', x: 0, y: 0, r: 90, color: accent, eco: 'core', parent: null })

  // The core: shared services and what Nexy knows about the owner.
  const serviceKeys = [...new Set([...servers.map((s) => s.name), 'web'])].filter((k) => !serviceOf(k).hidden)
  const coreServices = serviceKeys.filter((k) => deptOf(k) === 'direccion')
  const facts = (brain?.nodes ?? []).filter((n) => n.kind === 'fact' && !n.brand)
  const people = (brain?.nodes ?? []).filter((n) => n.kind === 'person')
  // Memory is both a service and what it holds: one node, with the facts around it.
  const factKids = facts.map((f) => ({ label: f.label, detail: f.detail }))
  const sats: Array<{ id: string; label: string; icon: string; kids: Array<{ label: string; detail?: string }> }> = [
    ...coreServices.map((k) => ({
      id: `core:svc:${k}`,
      label: serviceOf(k).label,
      icon: serviceOf(k).icon,
      kids: k === 'jarvis_memory' ? factKids : [],
    })),
    ...(coreServices.includes('jarvis_memory') ? [] : [{ id: 'core:memory', label: 'Memoria', icon: '💭', kids: factKids }]),
    { id: 'core:people', label: 'Contactos', icon: '👥', kids: people.map((p) => ({ label: p.label })) },
  ]
  sats.forEach((s, i) => {
    // Around Nexy, leaving the space under her clear for the holding's name.
    const a = Math.PI / 2 + 1.1 + ((i + 0.5) / sats.length) * (TAU - 2.2)
    const p = polar(0, 0, RS, a)
    add({ id: s.id, kind: 'sat', label: s.label, icon: s.icon, ...p, r: 26, color: accent, eco: 'core', parent: 'core' })
    fan(s.kids.length, a, (200 * Math.PI) / 180).forEach((ka, j) => {
      const q = polar(p.x, p.y, 75 + (j % 2) * 22, ka)
      add({ id: `${s.id}:${j}`, kind: 'dot', label: s.kids[j].label, detail: s.kids[j].detail, ...q, r: 6, color: '#c4b5fd', eco: 'core', parent: s.id })
    })
  })

  // One galaxy per company. A holding has none of its own: it is a hub
  // between Nexy and its companies, whose galaxies sit side by side.
  const all = brands?.marcas ?? []
  const isHolding = (b: Brand) => all.some((k) => k.padre === b.id)
  const marcas = all.filter((b) => !isHolding(b))
  const allDepts = (org?.departments ?? []).filter((d) => d.id !== 'direccion')
  // Enough room around the circle for every galaxy.
  const rb = Math.max(RB, (marcas.length * 1250) / TAU)
  const angleOf = (b: Brand) => (marcas.indexOf(b) / Math.max(marcas.length, 1)) * TAU - Math.PI / 2
  for (const h of all.filter(isHolding)) {
    const kids = marcas.filter((k) => k.padre === h.id)
    const a = kids.reduce((s, k) => s + angleOf(k), 0) / kids.length
    const hp = polar(0, 0, rb * 0.55, a)
    add({ id: `${h.id}:brand`, kind: 'brand', label: h.nombre, ...hp, r: 46, color: h.color, eco: h.id, parent: 'core' })
  }
  marcas.forEach((b) => {
    const ba = angleOf(b)
    const bp = polar(0, 0, rb, ba)
    const id = `${b.id}:brand`
    add({ id, kind: 'brand', label: b.nombre, x: bp.x, y: bp.y, r: 70, color: b.color, eco: b.id, parent: b.padre ? `${b.padre}:brand` : 'core' })
    const depts = allDepts.filter((d) => !b.ocultos?.includes(d.id))

    depts.forEach((d, j) => {
      const da = ba + (j / depts.length) * TAU + Math.PI / depts.length
      const dp = polar(bp.x, bp.y, RD, da)
      const did = `${b.id}:dept:${d.id}`
      add({ id: did, kind: 'dept', label: d.short ?? d.label, icon: d.icon, ...dp, r: 34, color: b.color, eco: b.id, parent: id })
      const agents = (org?.agents ?? []).filter((a) => a.dept === d.id)
      const svcs = serviceKeys.filter((k) => deptOf(k) === d.id)
      const kids = [
        ...agents.map((a) => ({ id: `${b.id}:agent:${a.id}`, kind: 'agent' as const, label: a.label, icon: a.icon, detail: a.description, faded: false })),
        ...svcs.map((k) => {
          const link = b.conexiones?.find((c) => c.servicio === k)
          const publisher = ['metricool', 'ayrshare', 'buffer', 'zernio', 'meta-ads'].includes(k)
          return {
            id: `${b.id}:svc:${k}`,
            kind: 'svc' as const,
            label: publisher ? `${serviceOf(k).label}${link ? ` · ${link.nombre || link.id}` : ' (sin cuenta)'}` : serviceOf(k).label,
            icon: serviceOf(k).icon,
            detail: undefined,
            faded: publisher && !link,
          }
        }),
      ]
      fan(kids.length, da).forEach((ka, k) => {
        const kp = polar(dp.x, dp.y, RC + (kids.length > 4 ? (k % 2) * 45 : 0), ka)
        const kid = kids[k]
        add({ ...kid, ...kp, r: kid.kind === 'agent' ? 22 : 18, color: b.color, eco: b.id, parent: did })
      })
    })

    // What Nexy knows about the brand: manual notes, visual references, accounts.
    const know = [
      ...(brain?.nodes ?? []).filter((n) => (n.kind === 'note' || n.kind === 'ref' || n.kind === 'fact') && n.brand === b.id),
    ]
    know.forEach((n, k) => {
      const ka = ba + Math.PI + (k / Math.max(know.length, 1)) * TAU * 0.999
      const kp = polar(bp.x, bp.y, RK + (k % 3) * 18, ka)
      add({ id: `${b.id}:know:${k}`, kind: 'know', label: n.label, icon: n.icon, detail: n.detail, ...kp, r: 7, color: b.color, eco: b.id, parent: id })
    })
  })
  return nodes
}

export type EcoLive = Map<string, 'active' | 'waiting'>

/**
 * What is working, keyed by node id, in the galaxy of the task's brand.
 * A lit node lights its parents too, so the whole path back to Nexy flows.
 */
export function ecoLive(tasks: Task[], nodes: EcoNode[], org: Org | null, activa: string | null, now: number): EcoLive {
  const live: EcoLive = new Map()
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const mark = (id: string, state: 'active' | 'waiting') => {
    let cur = byId.get(id)
    while (cur) {
      if (live.get(cur.id) !== 'waiting') live.set(cur.id, state)
      cur = cur.parent ? byId.get(cur.parent) : undefined
    }
  }
  for (const t of tasks) {
    const brand = t.brand ?? activa ?? ''
    // Whatever she was asked — even a plain "hola" — Nexy herself is working
    // while she answers, in the brand the task belongs to.
    const answering = t.status === 'running' || (t.endedAt && now - t.endedAt < AFTERGLOW_MS)
    if (answering) {
      mark('core', 'active')
      if (byId.has(`${brand}:brand`) && t.steps.length) mark(`${brand}:brand`, 'active')
    }
    for (const s of t.steps) {
      const state = s.status === 'waiting' ? 'waiting' : s.status === 'running' || (s.endedAt && now - s.endedAt < AFTERGLOW_MS) ? 'active' : null
      if (!state) continue
      const agent = s.agent ?? s.by
      if (agent) {
        const dept = org?.agents.find((a) => a.id === agent)?.dept
        mark(byId.has(`${brand}:agent:${agent}`) ? `${brand}:agent:${agent}` : `${brand}:dept:${dept}`, state)
      }
      if (!isAgentStep(s)) {
        const home = homeOf(s.server, s.tool)
        if (serviceOf(home).hidden) continue
        if (deptOf(home) === 'direccion') mark(byId.has(`core:svc:${home}`) ? `core:svc:${home}` : 'core', state)
        else mark(byId.has(`${brand}:svc:${home}`) ? `${brand}:svc:${home}` : `${brand}:brand`, state)
      }
    }
  }
  return live
}
