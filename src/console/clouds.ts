import type { EcoNode } from './ecosystem'
import type { Brain as BrainData } from './types'

/** The nebula's clouds: one per company, Nexy's core, and each profile compartment (see Nebula.tsx). */

export type RGB = [number, number, number]
export type CloudItem = { id: string; label: string; icon?: string; detail?: string; group: string; depth: number; parent?: string | null }
export type Cloud = { id: string; eco: string; label: string; icon?: string; color: RGB; items: CloudItem[] }

export const PALETTE: RGB[] = [
  [0, 229, 255], [31, 116, 255], [162, 28, 255], [255, 77, 196], [255, 176, 59],
  [64, 230, 140], [255, 99, 99], [120, 140, 255], [0, 200, 170], [230, 210, 90],
]
const GROUP: Partial<Record<EcoNode['kind'], string>> = { dept: 'Equipo', agent: 'Equipo', svc: 'Equipo', know: 'Lo que sabe', sat: 'Núcleo', dot: 'Núcleo' }

export const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}
export function rand(seed: number) {
  let s = Math.floor(seed * 4294967296) >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}
export const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
function rgb(hex?: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * One cloud per company of the ecosystem (ecosystem.ts), Nexy's core, and each
 * profile compartment (bridge/brain.mjs) — merged into the company of the same
 * name when there is one. Item ids are the ecosystem's, so picking one is
 * picking it on the console.
 */
export function buildClouds(nodes: EcoNode[], brain: BrainData | null): Cloud[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const depth = (n: EcoNode) => {
    let d = 0
    for (let cur = n.parent ? byId.get(n.parent) : undefined; cur && cur.kind !== 'brand' && cur.kind !== 'core'; cur = cur.parent ? byId.get(cur.parent) : undefined) d++
    return d
  }
  const clouds: Cloud[] = []
  const core = nodes.filter((n) => n.eco === 'core' && n.kind !== 'core')
  if (core.length) {
    clouds.push({ id: 'core', eco: 'core', label: 'Núcleo de Nexy', icon: '✦', color: [167, 139, 250], items: core.map((n) => ({ id: n.id, label: n.label, icon: n.icon, detail: n.detail, group: 'Núcleo', depth: n.kind === 'dot' ? 1 : 0, parent: n.parent })) })
  }
  for (const b of nodes.filter((n) => n.kind === 'brand')) {
    const kids = nodes.filter((n) => n.eco === b.eco && n.kind !== 'brand')
    clouds.push({
      id: b.id,
      eco: b.eco,
      label: b.label,
      icon: b.icon,
      color: rgb(b.color) ?? PALETTE[clouds.length % PALETTE.length],
      items: kids.map((n) => ({ id: n.id, label: n.label, icon: n.icon, detail: n.detail, group: GROUP[n.kind] ?? 'Equipo', depth: depth(n), parent: n.parent })),
    })
  }
  // The owner's profile, compartment by compartment.
  const bn = brain?.nodes ?? []
  for (const head of bn.filter((n) => /^profile:[^:]+$/.test(n.id))) {
    const topics = bn
      .filter((n) => n.id.startsWith(`${head.id}:`))
      .map((n) => ({ id: n.id, label: n.label, detail: n.detail, group: 'Perfil', depth: 0 }))
    const items: CloudItem[] = [{ id: head.id, label: `Perfil: ${head.detail ?? ''}`.trim(), detail: head.detail, group: 'Perfil', depth: 0 }, ...topics]
    const same = clouds.find((c) => fold(c.label) === fold(head.label))
    if (same) same.items.push(...items)
    else clouds.push({ id: head.id, eco: head.id, label: head.label, icon: head.icon, color: PALETTE[clouds.length % PALETTE.length], items })
  }
  return clouds
}

/** A colour turned around the wheel, so a company's departments are its colour's family. */
function shade([r, g, b]: RGB, k: number): RGB {
  const mix = (v: number, t: number) => Math.round(Math.max(0, Math.min(255, v + t)))
  const turn = (k % 5) - 2
  return [mix(r, turn * 28), mix(g, -turn * 18 + (k % 2) * 30), mix(b, turn * 22)]
}

/**
 * Inside one cloud: its own universe. Each department (or each part of Nexy's
 * core) is a cloud of its own, with its agents and connections as its stars;
 * what Nexy knows and the profile are one cloud each. Ids stay the
 * ecosystem's, so picking works as on the outside.
 */
export function universeOf(c: Cloud): Cloud[] {
  const heads = c.items.filter((it) => it.depth === 0 && (it.group === 'Equipo' || it.group === 'Núcleo'))
  const out: Cloud[] = heads.map((h, i) => {
    const kids: CloudItem[] = []
    const take = (id: string) => {
      for (const it of c.items) if (it.parent === id) {
        kids.push({ ...it, depth: Math.max(0, it.depth - 1) })
        take(it.id)
      }
    }
    take(h.id)
    return { id: h.id, eco: c.eco, label: h.label, icon: h.icon, color: shade(c.color, i), items: kids.length ? kids : [{ ...h }] }
  })
  for (const g of ['Lo que sabe', 'Perfil']) {
    const items = c.items.filter((it) => it.group === g)
    if (items.length) out.push({ id: `${c.id}::${g}`, eco: c.eco, label: g, icon: g === 'Perfil' ? '🧠' : '📚', color: shade(c.color, out.length + 2), items })
  }
  return out.length ? out : [{ ...c, id: `${c.id}::todo` }]
}
