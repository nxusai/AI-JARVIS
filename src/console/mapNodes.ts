import { useMemo } from 'react'
import { deptOf, homeOf, serviceOf } from './services'
import { isAgentStep } from './activity'
import type { Org, Server, Task } from './types'

/** Where everything sits on the team map (drawn by MapView). */

export type MapNode = {
  key: string
  kind: 'dept' | 'agent' | 'svc'
  label: string
  icon: string
  dept: string
  x: number
  y: number
  down?: boolean
}

export const W = 1000
export const H = 700
export const CX = W / 2
export const CY = H / 2
export const R1 = 165
export const R2 = 278
export const SQUASH = 0.86

export function useMapNodes(org: Org | null, servers: Server[], tasks: Task[]): MapNode[] {
  return useMemo(() => {
    const departments = org?.departments ?? []
    const agents = org?.agents ?? []
    const services = new Set<string>(['web'])
    for (const s of servers) services.add(s.name)
    for (const t of tasks) for (const st of t.steps) if (!isAgentStep(st)) services.add(homeOf(st.server, st.tool))
    const svcList = [...services].filter((k) => !serviceOf(k).hidden).sort()

    const nodes: MapNode[] = []
    const n = Math.max(departments.length, 1)
    const mk = Math.max(0, departments.findIndex((d) => d.id === 'marketing'))
    departments.forEach((d, i) => {
      // Marketing, the busiest department, sits on the right, where its
      // agents stack top to bottom and their labels read outwards.
      const a = ((i - mk) / n) * Math.PI * 2
      nodes.push({ key: `dept:${d.id}`, kind: 'dept', label: d.label, icon: d.icon, dept: d.id, x: CX + Math.cos(a) * R1, y: CY + Math.sin(a) * R1 * SQUASH })
      const children: Array<Omit<MapNode, 'x' | 'y'>> = [
        ...agents.filter((ag) => ag.dept === d.id).map((ag) => ({ key: `agent:${ag.id}`, kind: 'agent' as const, label: ag.label, icon: ag.icon, dept: d.id })),
        ...svcList
          .filter((k) => deptOf(k) === d.id)
          .map((k) => {
            const server = servers.find((s) => s.name === k)
            return {
              key: `svc:${k}`,
              kind: 'svc' as const,
              label: serviceOf(k).label,
              icon: serviceOf(k).icon,
              dept: d.id,
              down: server?.status === 'failed' || server?.status === 'needs-auth',
            }
          }),
      ]
      const sector = (Math.PI * 2) / n
      const k = children.length
      const step = Math.min((sector * 0.86) / Math.max(k - 1, 1), 0.3)
      children.forEach((c, j) => {
        const ca = a + (j - (k - 1) / 2) * step
        // Crowded departments stagger in two rows so labels don't collide.
        const r = k > 3 && j % 2 ? R2 + 50 : R2
        nodes.push({ ...c, x: CX + Math.cos(ca) * r, y: CY + Math.sin(ca) * r * SQUASH })
      })
    })
    return nodes
  }, [org, servers, tasks])
}
