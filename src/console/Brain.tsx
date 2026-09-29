import { useEffect, useMemo, useRef, useState } from 'react'
import type { Live } from './activity'
import type { Brain as BrainData, BrainNode } from './types'

/**
 * The brain: everything Nexy knows, as a constellation. Brands with the
 * notes of their manuals, departments with their agents, the people she may
 * call and what the owner told her. Drag to move, scroll to zoom, hover a
 * point to see what it connects to, click it to read it.
 */

type P = { x: number; y: number; vx: number; vy: number }

const SIZE: Record<BrainNode['kind'], number> = {
  core: 30,
  brand: 13,
  dept: 10,
  agent: 7,
  person: 5,
  note: 4.5,
  ref: 6,
  fact: 4.5,
}
const SPRING: Record<BrainNode['kind'], number> = {
  core: 0,
  brand: 130,
  dept: 105,
  agent: 55,
  person: 45,
  note: 55,
  ref: 60,
  fact: 55,
}

/** Stable pseudo-random start, so the picture doesn't reshuffle on every update. */
const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

function layout(data: BrainData): Map<string, P> {
  const pos = new Map<string, P>()
  const nodes = data.nodes
  nodes.forEach((n) => {
    const a = hash(n.id) * Math.PI * 2
    const r = n.kind === 'core' ? 0 : 60 + hash(`${n.id}r`) * 260
    pos.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0 })
  })
  const kindOf = new Map(nodes.map((n) => [n.id, n.kind]))
  const links = data.links.filter((l) => pos.has(l.source) && pos.has(l.target))
  const ps = nodes.map((n) => pos.get(n.id)!)
  for (let it = 0; it < 320; it++) {
    const cool = 1 - it / 320
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i]
        const b = ps[j]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) {
          dx = Math.random() - 0.5
          dy = Math.random() - 0.5
          d2 = 1
        }
        if (d2 > 250_000) continue
        const f = 900 / d2
        a.vx += dx * f
        a.vy += dy * f
        b.vx -= dx * f
        b.vy -= dy * f
      }
    }
    for (const l of links) {
      const a = pos.get(l.source)!
      const b = pos.get(l.target)!
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = ((d - SPRING[kindOf.get(l.target) ?? 'note']) / d) * 0.06
      a.vx += dx * f
      a.vy += dy * f
      b.vx -= dx * f
      b.vy -= dy * f
    }
    nodes.forEach((n, i) => {
      const p = ps[i]
      if (n.kind === 'core') {
        p.x = p.y = p.vx = p.vy = 0
        return
      }
      p.vx -= p.x * 0.004
      p.vy -= p.y * 0.004
      const v = Math.min(Math.hypot(p.vx, p.vy), 30 * cool + 2)
      const s = Math.hypot(p.vx, p.vy) || 1
      p.x += (p.vx / s) * v
      p.y += (p.vy / s) * v
      p.vx *= 0.55
      p.vy *= 0.55
    })
  }
  return pos
}

export function Brain({ data, live, brandFilter }: { data: BrainData | null; live: Map<string, Live>; brandFilter: string | null }) {
  const pos = useMemo(() => (data ? layout(data) : new Map<string, P>()), [data])
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [hover, setHover] = useState<string | null>(null)
  const [picked, setPicked] = useState<BrainNode | null>(null)
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [box, setBox] = useState({ w: 1300, h: 760 })
  useEffect(() => {
    const el = svgRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth || 1300, h: el.clientHeight || 760 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [data])

  if (!data?.nodes.length) return <p className="muted">El cerebro aparece en cuanto Nexy arranca.</p>

  const neighbours = new Map<string, Set<string>>()
  for (const l of data.links) {
    if (!neighbours.has(l.source)) neighbours.set(l.source, new Set())
    if (!neighbours.has(l.target)) neighbours.set(l.target, new Set())
    neighbours.get(l.source)!.add(l.target)
    neighbours.get(l.target)!.add(l.source)
  }
  const focus = hover ?? picked?.id ?? null
  const near = focus ? new Set([focus, ...(neighbours.get(focus) ?? [])]) : null
  const inFilter = (n: BrainNode) => !brandFilter || !n.brand || n.brand === brandFilter
  // Agents and departments share their ids with the map, so they light up together.
  const glow = (n: BrainNode) => live.get(n.id)

  const xs = [...pos.values()].map((p) => p.x)
  const ys = [...pos.values()].map((p) => p.y)
  const pad = 70
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const w = Math.max(...xs) - minX + pad
  const h = Math.max(...ys) - minY + pad

  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  // Sizes are in picture units; one unit of `u` is one screen pixel, so text
  // and dots stay the same size on screen however far the picture spreads.
  const u = Math.max(w / box.w, h / box.h)
  const FONT: Record<BrainNode['kind'], number> = { core: 17, brand: 15, dept: 13, agent: 12, person: 11, note: 10.5, ref: 11, fact: 10.5 }

  return (
    <div className="brain-wrap">
      <svg
        className="brain"
        ref={svgRef}
        viewBox={`${minX} ${minY} ${w} ${h}`}
        onWheel={(e) => {
          const k = Math.min(4, Math.max(0.5, view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
          setView({ ...view, k })
        }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          const scale = w / (e.currentTarget.clientWidth || w) / view.k
          setView({ ...view, x: d.vx + (e.clientX - d.x) * scale, y: d.vy + (e.clientY - d.y) * scale })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
      >
        <defs>
          <radialGradient id="brain-core">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) translate(${minX + w / 2} ${minY + h / 2}) scale(${view.k}) translate(${-(minX + w / 2)} ${-(minY + h / 2)})`}>
          {data.links.map((l) => {
            const a = pos.get(l.source)
            const b = pos.get(l.target)
            if (!a || !b) return null
            const t = byId.get(l.target)
            const lit = near ? near.has(l.source) && near.has(l.target) : false
            const dim = (near && !lit) || (t && !inFilter(t))
            return (
              <line
                key={`${l.source}>${l.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={`b-link${lit ? ' lit' : ''}${dim ? ' dim' : ''}`}
                style={t?.color ? { stroke: t.color } : undefined}
              />
            )
          })}
          {data.nodes.map((n) => {
            const p = pos.get(n.id)
            if (!p) return null
            const r = (SIZE[n.kind] * u) / Math.sqrt(view.k)
            const dim = (near && !near.has(n.id)) || !inFilter(n)
            const g = glow(n)
            return (
              <g
                key={n.id}
                className={`b-node ${n.kind}${dim ? ' dim' : ''}${n.active || g ? ' glow' : ''}${picked?.id === n.id ? ' picked' : ''}`}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  setPicked(picked?.id === n.id ? null : n)
                }}
              >
                {n.kind === 'core' ? <circle cx={p.x} cy={p.y} r={r * 2.4} fill="url(#brain-core)" opacity={0.7} /> : null}
                <circle cx={p.x} cy={p.y} r={r} style={n.color ? { fill: n.color } : undefined} />
                {n.kind === 'core' ? (
                  <text x={p.x} y={p.y + 6 * u} textAnchor="middle" className="core-name" style={{ fontSize: FONT.core * u }}>
                    NEXY
                  </text>
                ) : null}
                {n.kind === 'core' ? null : (
                  <text x={p.x} y={p.y - r - 5 * u} textAnchor="middle" style={{ fontSize: (FONT[n.kind] * u) / Math.sqrt(view.k) }}>
                    {n.icon ? `${n.icon} ` : ''}
                    {n.label}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      <div className="brain-help">Arrastra para moverte · rueda para acercar · toca un punto para leerlo</div>
      {picked ? (
        <aside className="brain-card">
          <button className="close" onClick={() => setPicked(null)} aria-label="Cerrar">
            ×
          </button>
          <small>{KIND[picked.kind]}</small>
          <h3>
            {picked.icon ? `${picked.icon} ` : ''}
            {picked.kind === 'note' || picked.kind === 'fact' ? '' : picked.label}
          </h3>
          {picked.detail ? <p>{picked.detail}</p> : null}
          <p className="muted">Conectado con: {[...(neighbours.get(picked.id) ?? [])].map((id) => byId.get(id)?.label).filter(Boolean).slice(0, 12).join(', ')}</p>
        </aside>
      ) : null}
    </div>
  )
}

const KIND: Record<BrainNode['kind'], string> = {
  core: 'Nexy',
  brand: 'Marca',
  note: 'Nota del manual de marca',
  ref: 'Referencia visual de la marca',
  dept: 'Área',
  agent: 'Agente',
  person: 'Contacto',
  fact: 'Recuerdo',
}
