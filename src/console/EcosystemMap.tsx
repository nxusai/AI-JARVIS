import { useEffect, useMemo, useRef, useState } from 'react'
import type { EcoLive, EcoNode } from './ecosystem'

/**
 * The ecosystem as one zoomable sheet. Scroll or pinch to zoom around the
 * pointer, drag to move, click a brand to fly to it. Far out it is dots and
 * lines; names and icons appear as you get closer. Only what is working
 * moves — and only in the galaxy of the brand it is working for.
 */

type Cam = { x: number; y: number; k: number }

/** Screen size in pixels at which each kind starts showing its name. */
const LABEL_FROM: Record<EcoNode['kind'], number> = {
  core: 0,
  brand: 0,
  sat: 18,
  dept: 11,
  agent: 11,
  svc: 10,
  know: 5,
  dot: 5,
}
const FONT: Record<EcoNode['kind'], number> = { core: 17, brand: 16, sat: 12, dept: 11, agent: 12, svc: 11, know: 11, dot: 11 }
const MIN_K = 0.08
const MAX_K = 6

export function EcosystemMap({
  nodes,
  live,
  selected,
  onSelect,
  focus,
}: {
  nodes: EcoNode[]
  live: EcoLive
  selected: string | null
  onSelect: (id: string | null) => void
  /** A brand id to fly to, or 'all' to see everything. */
  focus: string | null
}) {
  const wrap = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 900, h: 640 })
  const [cam, setCam] = useState<Cam>({ x: 450, y: 320, k: 0.25 })
  const [big, setBig] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ cam: Cam; x: number; y: number; dist: number; moved: boolean } | null>(null)
  const anim = useRef<number | null>(null)

  const extent = useMemo(() => {
    let m = 400
    for (const n of nodes) m = Math.max(m, Math.hypot(n.x, n.y) + n.r + 60)
    return m
  }, [nodes])

  const fitCam = (w: number, h: number): Cam => {
    const k = Math.max(MIN_K, Math.min(w, h) / (2 * extent))
    return { x: w / 2, y: h / 2, k }
  }

  // Keep the drawing the size of its box. Until the owner moves the map
  // themselves, it keeps everything in view as brands and nodes arrive.
  const touched = useRef(false)
  useEffect(() => {
    const el = wrap.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 900, h: el.clientHeight || 640 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [big])
  useEffect(() => {
    if (!touched.current) setCam(fitCam(size.w, size.h))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extent, size.w, size.h])

  // The wheel zooms the map, not the page: that needs a listener that may
  // cancel the scroll, which React's own onWheel cannot.
  const zoomRef = useRef<(e: WheelEvent) => void>(() => {})
  zoomRef.current = (e: WheelEvent) => {
    e.preventDefault()
    touched.current = true
    const p = local(e)
    setCam((c) => zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015), c))
  }
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const onWheel = (e: WheelEvent) => zoomRef.current(e)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const flyTo = (target: Cam) => {
    touched.current = true
    if (anim.current) cancelAnimationFrame(anim.current)
    const from = { ...cam }
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 650)
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
      setCam({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k: from.k + (target.k - from.k) * e })
      if (p < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }
  const flyToWorld = (wx: number, wy: number, k: number) => flyTo({ x: size.w / 2 - wx * k, y: size.h / 2 - wy * k, k })

  // Picking a brand elsewhere on the console flies there.
  useEffect(() => {
    if (!focus) return
    if (focus === 'all') return flyTo(fitCam(size.w, size.h))
    const b = nodes.find((n) => n.id === `${focus}:brand`)
    if (b) flyToWorld(b.x, b.y, Math.min(size.w, size.h) / 1250)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  const zoomAt = (sx: number, sy: number, factor: number, base = cam) => {
    const k = Math.min(MAX_K, Math.max(MIN_K, base.k * factor))
    const wx = (sx - base.x) / base.k
    const wy = (sy - base.y) / base.k
    return { x: sx - wx * k, y: sy - wy * k, k }
  }

  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrap.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const working = new Set([...live.keys()].map((id) => byId.get(id)?.eco).filter(Boolean))
  const anyWork = working.size > 0
  const focusIds = useMemo(() => {
    const id = hover ?? selected
    if (!id) return null
    const set = new Set([id])
    for (const n of nodes) if (n.parent === id) set.add(n.id)
    let cur = byId.get(id)
    while (cur?.parent) {
      set.add(cur.parent)
      cur = byId.get(cur.parent)
    }
    return set
  }, [hover, selected, nodes, byId])

  const px = (r: number) => r * cam.k
  const showLabel = (n: EcoNode) =>
    px(n.r) >= LABEL_FROM[n.kind] ||
    // Working or picked nodes are named as soon as they are big enough to tell apart.
    ((live.has(n.id) || focusIds?.has(n.id) || selected === n.id) && px(n.r) >= 5)

  /**
   * Where a node's name goes: away from its parent for leaves, so a fan of
   * agents reads outwards; towards the parent for departments, whose own
   * agents fan out on the other side.
   */
  const labelAt = (n: EcoNode, fs: number) => {
    const p = n.parent ? byId.get(n.parent) : null
    if (!p || n.kind === 'brand' || n.kind === 'core') return { x: n.x, y: n.y + n.r + fs * 1.15, anchor: 'middle' as const }
    let dx = n.x - p.x
    let dy = n.y - p.y
    const d = Math.hypot(dx, dy) || 1
    dx /= d
    dy /= d
    if (n.kind === 'dept') {
      dx = -dx
      dy = -dy
    }
    const gap = n.r + fs * 0.6
    const anchor = dx > 0.45 ? ('start' as const) : dx < -0.45 ? ('end' as const) : ('middle' as const)
    return { x: n.x + dx * gap, y: n.y + dy * gap + fs * (anchor === 'middle' ? (dy > 0 ? 0.9 : -0.1) : 0.35), anchor }
  }

  return (
    <div
      ref={wrap}
      className={big ? 'eco big' : 'eco'}
      onPointerDown={(e) => {
        touched.current = true
        ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
        pointers.current.set(e.pointerId, local(e))
        const pts = [...pointers.current.values()]
        const mid = pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0]
        gesture.current = {
          cam,
          x: mid.x,
          y: mid.y,
          dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
          moved: false,
        }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId) || !gesture.current) return
        pointers.current.set(e.pointerId, local(e))
        const g = gesture.current
        const pts = [...pointers.current.values()]
        if (pts.length === 2 && g.dist) {
          const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
          const z = zoomAt(g.x, g.y, dist / g.dist, g.cam)
          setCam({ ...z, x: z.x + mid.x - g.x, y: z.y + mid.y - g.y })
          g.moved = true
        } else if (pts.length === 1) {
          const dx = pts[0].x - g.x
          const dy = pts[0].y - g.y
          if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true
          setCam({ ...g.cam, x: g.cam.x + dx, y: g.cam.y + dy })
        }
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId)
        const g = gesture.current
        if (pointers.current.size === 0) {
          if (g && !g.moved) {
            const target = (e.target as Element).closest?.('[data-node]')?.getAttribute('data-node') ?? null
            onSelect(target)
            const n = target ? byId.get(target) : null
            if (n?.kind === 'brand') flyToWorld(n.x, n.y, Math.min(size.w, size.h) / 1250)
          }
          gesture.current = null
        } else if (pointers.current.size === 1) {
          const [p] = [...pointers.current.values()]
          gesture.current = { cam, x: p.x, y: p.y, dist: 0, moved: true }
        }
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId)
        gesture.current = null
      }}
    >
      <svg width={size.w} height={size.h} className="eco-svg" role="img" aria-label="Ecosistema de Nexy">
        <defs>
          <pattern id="eco-dots" width={40} height={40} patternUnits="userSpaceOnUse" patternTransform={`translate(${cam.x} ${cam.y}) scale(${cam.k})`}>
            <circle cx={1} cy={1} r={1.4 / Math.max(cam.k, 0.3)} className="grid-dot" />
          </pattern>
          <radialGradient id="eco-glow">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={size.w} height={size.h} fill="url(#eco-dots)" />
        <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.k})`}>
          {nodes.map((n) => {
            const p = n.parent ? byId.get(n.parent) : null
            if (!p) return null
            const on = live.get(n.id)
            const dim = (anyWork && !working.has(n.eco) && n.eco !== 'core') || (focusIds && !focusIds.has(n.id))
            return (
              <line
                key={`l-${n.id}`}
                x1={p.x}
                y1={p.y}
                x2={n.x}
                y2={n.y}
                className={`eco-line${on ? ` ${on}` : ''}${dim ? ' dim' : ''}`}
                style={{
                  stroke: on ? n.color : undefined,
                  strokeWidth: (on ? 3 : 1.3) / cam.k,
                  strokeDasharray: on ? `${8 / cam.k} ${8 / cam.k}` : undefined,
                  ['--dash' as string]: `${16 / cam.k}`,
                }}
              />
            )
          })}
          <circle cx={0} cy={0} r={260} fill="url(#eco-glow)" className="eco-halo" />
          {nodes.map((n) => {
            const on = live.get(n.id)
            const dim = (anyWork && !working.has(n.eco) && n.eco !== 'core') || (focusIds && !focusIds.has(n.id))
            const iconShown = px(n.r) >= 11 && n.icon && n.kind !== 'know' && n.kind !== 'dot'
            const solid = n.kind === 'core' || n.kind === 'brand' || n.kind === 'dept' || n.kind === 'agent' || n.kind === 'sat'
            const fs = FONT[n.kind] / cam.k
            return (
              <g
                key={n.id}
                data-node={n.id}
                className={`eco-node ${n.kind}${on ? ` ${on}` : ''}${dim ? ' dim' : ''}${selected === n.id ? ' picked' : ''}${n.faded ? ' faded' : ''}`}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
              >
                {on ? <circle cx={n.x} cy={n.y} r={n.r + 10 / cam.k} className="eco-pulse" style={{ stroke: on === 'waiting' ? 'var(--warn)' : n.color, strokeWidth: 3 / cam.k }} /> : null}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  className="eco-dot"
                  style={{
                    fill: n.kind === 'brand' ? n.color : solid ? 'var(--node)' : n.kind === 'svc' ? '#1d1a52' : n.color,
                    stroke: n.kind === 'svc' ? n.color : n.kind === 'brand' ? '#fff' : on ? n.color : 'transparent',
                    strokeWidth: (n.kind === 'brand' ? 3 : 2) / cam.k,
                  }}
                />
                {n.kind === 'core' ? (
                  <text x={0} y={6} textAnchor="middle" className="eco-core" style={{ fontSize: 28 }}>
                    NEXY
                  </text>
                ) : null}
                {iconShown ? (
                  <text x={n.x} y={n.y + n.r * 0.36} textAnchor="middle" style={{ fontSize: n.r * 0.95 }}>
                    {n.icon}
                  </text>
                ) : null}
                {n.kind !== 'core' && showLabel(n)
                  ? (() => {
                      const l = labelAt(n, fs)
                      return (
                        <text x={l.x} y={l.y} textAnchor={l.anchor} className="eco-label" style={{ fontSize: fs, strokeWidth: 3 / cam.k }}>
                          {n.label.length > 42 ? `${n.label.slice(0, 41)}…` : n.label}
                        </text>
                      )
                    })()
                  : null}
              </g>
            )
          })}
        </g>
      </svg>

      <div className="eco-tools" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={() => setCam((c) => zoomAt(size.w / 2, size.h / 2, 1.5, c))} aria-label="Acercar">
          +
        </button>
        <button onClick={() => setCam((c) => zoomAt(size.w / 2, size.h / 2, 1 / 1.5, c))} aria-label="Alejar">
          −
        </button>
        <button onClick={() => flyTo(fitCam(size.w, size.h))} aria-label="Ver todo" title="Ver todo">
          ⌂
        </button>
        <button onClick={() => setBig((b) => !b)} aria-label="Pantalla completa" title="Pantalla completa">
          {big ? '✕' : '⛶'}
        </button>
      </div>
      <div className="eco-help">Rueda o pellizca para acercar · arrastra para moverte · toca una marca para ir a ella</div>
    </div>
  )
}
