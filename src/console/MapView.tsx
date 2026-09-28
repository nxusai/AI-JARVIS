import { CX, CY, H, R1, R2, SQUASH, W, type MapNode } from './mapNodes'
import type { Live } from './activity'

/**
 * The team map: Nexy in the middle, her departments around her, and inside
 * each department its agents (solid) and the services it uses (outlined).
 * Whatever is working right now glows, and the line to it flows.
 */

export function MapView({
  nodes,
  live,
  selected,
  onSelect,
  watermark,
  accent,
}: {
  nodes: MapNode[]
  live: Map<string, Live>
  selected: string | null
  onSelect: (key: string | null) => void
  watermark?: string
  accent?: string
}) {
  const deptPos = new Map(nodes.filter((n) => n.kind === 'dept').map((n) => [n.dept, n]))
  const state = (n: MapNode) => (n.down ? 'down' : (live.get(n.key) ?? 'idle'))
  const ordered = [...nodes].sort((a, b) => (a.kind === 'dept' ? 1 : 0) - (b.kind === 'dept' ? 1 : 0))
  return (
    <svg
      className="map"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Mapa del equipo de Nexy"
      style={accent ? { ['--flow' as string]: accent } : undefined}
      onClick={() => onSelect(null)}
    >
      <defs>
        <radialGradient id="core-glow">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="grid-dot" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#dots)" />
      {[R1, R2, R2 + 50].map((r) => (
        <ellipse key={r} cx={CX} cy={CY} rx={r} ry={r * SQUASH} className="orbit" />
      ))}
      {watermark ? (
        <text x={CX} y={CY + 60} textAnchor="middle" className="watermark">
          {watermark}
        </text>
      ) : null}

      {/* Lines first, so every node sits on top of them. */}
      {nodes.map((n) => {
        const from = n.kind === 'dept' ? { x: CX, y: CY } : deptPos.get(n.dept)
        if (!from) return null
        const s = state(n)
        const mx = from.x + (n.x - from.x) * 0.55
        const my = from.y + (n.y - from.y) * 0.55
        return (
          <g key={`e-${n.key}`} className={`edge-g ${s}`}>
            <line x1={from.x} y1={from.y} x2={n.x} y2={n.y} className="edge" />
            <circle cx={mx} cy={my} r={4} className="joint" />
          </g>
        )
      })}

      <g className="core">
        <circle cx={CX} cy={CY} r={90} fill="url(#core-glow)" className="halo" />
        <circle cx={CX} cy={CY} r={46} className="disc" />
        <text x={CX} y={CY + 3} textAnchor="middle" className="name">
          NEXY
        </text>
        <text x={CX} y={CY + 20} textAnchor="middle" className="sub">
          NXUS AI
        </text>
      </g>

      {ordered.map((n) => {
        const s = state(n)
        const r = n.kind === 'dept' ? 32 : n.kind === 'agent' ? 24 : 19
        // Outer nodes label outwards, away from the lines into the middle;
        // departments label above or below.
        const ang = Math.atan2(n.y - CY, n.x - CX)
        const side = n.kind === 'dept' ? 0 : Math.cos(ang) > 0.35 ? 1 : Math.cos(ang) < -0.35 ? -1 : 0
        const lx = side ? n.x + side * (r + 7) : n.x
        const ly = side ? n.y + 4 : n.y < CY - 40 ? n.y - r - 9 : n.y + r + 17
        return (
          <g
            key={n.key}
            className={`node ${n.kind} ${s}${selected === n.key ? ' selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(selected === n.key ? null : n.key)
            }}
          >
            <title>{n.label}</title>
            {s === 'active' || s === 'waiting' ? <circle cx={n.x} cy={n.y} r={r + 9} className="pulse" /> : null}
            <circle cx={n.x} cy={n.y} r={r} className="dot" />
            <text x={n.x} y={n.y + r * 0.36} textAnchor="middle" className="icon" style={{ fontSize: r * 0.95 }}>
              {n.icon}
            </text>
            <text x={lx} y={ly} textAnchor={side > 0 ? 'start' : side < 0 ? 'end' : 'middle'} className="label">
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
