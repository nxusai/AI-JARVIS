import { deptOf, homeOf, serviceOf, stepLabel } from './services'
import type { Agent, Brand, Brands, Step, Task } from './types'

/** How long a node keeps glowing after a step on it finishes. */
export const AFTERGLOW_MS = 4000

export type Live = 'active' | 'waiting'

const AGENT_TOOLS = new Set(['Agent', 'Task'])
export const isAgentStep = (s: Step) => s.server === 'builtin' && AGENT_TOOLS.has(s.tool)

/**
 * What is lit up right now, keyed the way the map and the brain name their
 * nodes: `svc:gmail`, `agent:ganchos`, `dept:marketing`. A department glows
 * whenever anything inside it does.
 */
export function liveNodes(tasks: Task[], agents: Agent[], now: number): Map<string, Live> {
  const live = new Map<string, Live>()
  const mark = (key: string, state: Live) => {
    if (live.get(key) !== 'waiting') live.set(key, state)
  }
  const agentDept = (id: string) => agents.find((a) => a.id === id)?.dept
  for (const t of tasks) {
    for (const s of t.steps) {
      let state: Live | null = null
      if (s.status === 'waiting') state = 'waiting'
      else if (s.status === 'running' || (s.endedAt && now - s.endedAt < AFTERGLOW_MS)) state = 'active'
      if (!state) continue
      const agent = s.agent ?? s.by
      if (agent) {
        mark(`agent:${agent}`, state)
        const d = agentDept(agent)
        if (d) mark(`dept:${d}`, state)
      }
      if (!isAgentStep(s)) {
        const home = homeOf(s.server, s.tool)
        mark(`svc:${home}`, state)
        mark(`dept:${deptOf(home)}`, state)
      }
    }
  }
  return live
}

/** The company a brand belongs to (itself for a company). */
export const companyOf = (brands: Brands | null, id?: string | null): string | null =>
  (id && brands?.marcas.find((b) => b.id === id)?.padre) || id || null

/**
 * Whether something of brand `id` shows under the filter picked: the brand
 * itself, or a brand of the company picked. No filter shows everything.
 */
export const inScope = (brands: Brands | null, filter: string | null, id?: string | null) =>
  !filter || id === filter || companyOf(brands, id) === filter

/** Companies by portfolio, each with its brands, in the order they are listed. */
export function companies(brands: Brands | null) {
  const marcas = brands?.marcas ?? []
  const tops = marcas.filter((b) => !b.padre)
  const group = (cartera: 'propia' | 'cliente') =>
    tops.filter((b) => (b.cartera ?? 'propia') === cartera).map((c) => ({ company: c, brands: marcas.filter((b) => b.padre === c.id) }))
  return [
    { title: brands?.grupo ?? 'Ramos & Co.', items: group('propia') },
    { title: brands?.clientes ?? 'Empresas cliente', items: group('cliente') },
  ].filter((s) => s.items.length)
}

export const brandOf = (brands: Brands | null, id?: string | null): Brand | undefined =>
  brands?.marcas.find((b) => b.id === id)

export const secs = (ms: number) => (ms < 1000 ? `${ms} ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`)

export const clock = (t: number) => new Date(t).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })

export const isToday = (t: number) => new Date(t).toDateString() === new Date().toDateString()

/** A step's name and icon, with Nexy's agents named as the people they are. */
export function stepLook(s: Step, agents: Agent[]) {
  if (isAgentStep(s)) {
    const a = agents.find((x) => x.id === s.agent)
    return { icon: a?.icon ?? '🤖', label: `Agente · ${a?.label ?? s.agent ?? 'general'}` }
  }
  return { icon: serviceOf(homeOf(s.server, s.tool)).icon, label: stepLabel(s.server, s.tool) }
}
