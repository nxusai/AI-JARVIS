import { useEffect, useMemo, useRef, useState } from 'react'
import type { Live } from './activity'
import type { Brain as BrainData, BrainNode } from './types'

/**
 * The brain as a living field: each part of what Nexy knows — a brand, a
 * department, a compartment of the owner's profile, their contacts, their
 * memory — is a cloud of light in its own colour, every point of it a thing
 * she knows, all wired to Nexy in the middle. It turns slowly; drag to turn
 * it, scroll to come closer, touch a cloud to read what is in it.
 *
 * Same data as the constellation (bridge/brain.mjs): nothing is invented for
 * the picture, and private compartments arrive with no topics in them.
 */

type Cluster = {
  id: string
  label: string
  icon?: string
  color: [number, number, number]
  items: BrainNode[]
  center: [number, number, number]
  radius: number
  active: boolean
}
type Dot = { c: number; x: number; y: number; z: number; s: number; star: boolean; tw: number }

const PALETTE: Array<[number, number, number]> = [
  [0, 229, 255], [31, 116, 255], [162, 28, 255], [255, 77, 196], [255, 176, 59],
  [64, 230, 140], [255, 99, 99], [120, 140, 255], [0, 200, 170], [230, 210, 90],
]

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967296
}
function rand(seed: number) {
  let s = Math.floor(seed * 4294967296) >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
function rgb(hex?: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Groups the graph into clouds: each child of Nexy (and each profile compartment) with everything under it. */
function clusters(data: BrainData): Cluster[] {
  const parent = new Map<string, string>()
  for (const l of data.links) if (!parent.has(l.target)) parent.set(l.target, l.source)
  const byId = new Map(data.nodes.map((n) => [n.id, n]))
  const rootOf = (id: string) => {
    let cur = id
    for (let i = 0; i < 12; i++) {
      const p = parent.get(cur)
      if (!p || p === 'nexy' || p === 'profile') return cur
      cur = p
    }
    return cur
  }
  const groups = new Map<string, BrainNode[]>()
  for (const n of data.nodes) {
    if (n.id === 'nexy' || n.id === 'profile') continue
    const r = rootOf(n.id)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)!.push(n)
  }
  // One cloud per name: a brand and the profile compartment of the same
  // business are the same thing to the owner. And the departments with their
  // agents are one team.
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const merged = new Map<string, { head: BrainNode; items: BrainNode[] }>()
  for (const id of groups.keys()) {
    const head = byId.get(id)
    if (!head) continue
    const team = id.startsWith('dept:')
    const key = team ? 'team' : fold(head.label)
    const into = merged.get(key)
    if (into) {
      into.items.push(...groups.get(id)!)
      if (!into.head.color && head.color) into.head = { ...into.head, color: head.color }
    } else merged.set(key, { head: team ? { id: 'team', label: 'Equipo de IA', icon: '🤖', kind: 'dept' } : head, items: [...groups.get(id)!] })
  }
  const list = [...merged.values()]
  return list.map(({ head, items }, i) => {
    // Spread over a sphere (golden angle), so no two clouds sit on each other.
    const yy = 1 - ((i + 0.5) / list.length) * 2
    const rr = Math.sqrt(1 - yy * yy)
    const a = i * 2.399963 + 0.4
    const ring = 470
    const radius = 105 + Math.min(130, Math.sqrt(items.length) * 22)
    return {
      id: head.id,
      label: head.label,
      icon: head.icon,
      color: rgb(head.color) ?? PALETTE[i % PALETTE.length],
      items,
      center: [Math.cos(a) * rr * ring, yy * ring * 0.62, Math.sin(a) * rr * ring] as [number, number, number],
      radius,
      active: items.some((n) => n.active),
    }
  })
}

function dots(cs: Cluster[]): Dot[] {
  const out: Dot[] = []
  cs.forEach((c, ci) => {
    const r = rand(hash(c.id))
    const n = Math.min(2600, 1100 + c.items.length * 90)
    for (let i = 0; i < n; i++) {
      const k = c.radius * (0.3 + 0.7 * r() * r())
      out.push({ c: ci, x: c.center[0] + gauss(r) * k * 0.6, y: c.center[1] + gauss(r) * k * 0.6, z: c.center[2] + gauss(r) * k * 0.6, s: 0.8 + r() * 1.9, star: false, tw: r() * 6.28 })
    }
    // One bright star per thing she knows.
    for (let i = 0; i < c.items.length; i++) {
      const k = c.radius * 0.6
      out.push({ c: ci, x: c.center[0] + gauss(r) * k * 0.4, y: c.center[1] + gauss(r) * k * 0.4, z: c.center[2] + gauss(r) * k * 0.4, s: 2.6 + r() * 1.4, star: true, tw: r() * 6.28 })
    }
  })
  return out
}

export function Nebula({ data, live }: { data: BrainData | null; live: Map<string, Live> }) {
  const cs = useMemo(() => (data ? clusters(data) : []), [data])
  const ds = useMemo(() => dots(cs), [cs])
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const view = useRef({ yaw: 0, pitch: -0.32, zoom: 1, drag: null as null | { x: number; y: number; yaw: number; pitch: number }, moved: false })
  const proj = useRef<Array<{ x: number; y: number; r: number }>>([])
  const [hover, setHover] = useState<number | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const liveIds = useMemo(() => new Set([...live.keys()]), [live])
  const state = useRef({ hover, picked, liveIds })
  state.current = { hover, picked, liveIds }

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    let raf = 0
    const t0 = performance.now()
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = el.clientWidth
      const H = el.clientHeight
      if (el.width !== Math.round(W * dpr) || el.height !== Math.round(H * dpr)) {
        el.width = Math.round(W * dpr)
        el.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const t = (performance.now() - t0) / 1000
      const v = view.current
      if (!v.drag) v.yaw += 0.0012
      const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch)
      const scale = (Math.min(W, H) / 1050) * v.zoom
      const focal = 900
      const P = (x: number, y: number, z: number) => {
        const X = x * cy - z * sy
        let Z = x * sy + z * cy
        const Y = y * cp - Z * sp
        Z = y * sp + Z * cp
        const f = focal / (focal + Z)
        return { x: W / 2 + X * f * scale, y: H / 2 + Y * f * scale, f, z: Z }
      }
      const { hover: hv, picked: pk, liveIds: lv } = state.current
      const focus = pk ?? hv

      ctx.globalCompositeOperation = 'source-over'
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7)
      bg.addColorStop(0, '#0d0b26')
      bg.addColorStop(1, '#030308')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'

      // Wires from Nexy to every cloud, with pulses running out along them.
      const core = P(0, 0, 0)
      proj.current = cs.map((c, i) => {
        const p = P(...c.center)
        const [r, g, b] = c.color
        const busy = c.active || c.items.some((n) => lv.has(n.id))
        const dim = focus !== null && focus !== i ? 0.25 : 1
        const grad = ctx.createLinearGradient(core.x, core.y, p.x, p.y)
        grad.addColorStop(0, `rgba(255,255,255,${0.22 * dim})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},${0.38 * dim})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = busy ? 1.8 : 1
        ctx.beginPath()
        ctx.moveTo(core.x, core.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        for (let k = 0; k < (busy ? 3 : 1); k++) {
          const q = (t * (busy ? 0.5 : 0.18) + k / 3 + hash(c.id)) % 1
          ctx.fillStyle = `rgba(${r},${g},${b},${0.9 * dim})`
          ctx.beginPath()
          ctx.arc(core.x + (p.x - core.x) * q, core.y + (p.y - core.y) * q, busy ? 2.6 : 1.8, 0, 7)
          ctx.fill()
        }
        return { x: p.x, y: p.y, r: c.radius * p.f * scale }
      })

      // A soft glow under each cloud, and rays from Nexy into it.
      cs.forEach((c, i) => {
        const p = proj.current[i]
        const [r, g, b] = c.color
        const dim = focus !== null && focus !== i ? 0.3 : 1
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.25 + 10)
        halo.addColorStop(0, `rgba(${r},${g},${b},${0.32 * dim})`)
        halo.addColorStop(0.5, `rgba(${r},${g},${b},${0.1 * dim})`)
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`)
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 1.25 + 10, 0, 7)
        ctx.fill()
      })
      ctx.lineWidth = 0.6
      for (let k = 0; k < ds.length; k += 97) {
        const d = ds[k]
        const p = P(d.x, d.y, d.z)
        const [r, g, b] = cs[d.c].color
        const dim = focus !== null && focus !== d.c ? 0.15 : 1
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.16 * dim})`
        ctx.beginPath()
        ctx.moveTo(core.x, core.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }

      // The clouds.
      for (const d of ds) {
        const p = P(d.x, d.y, d.z)
        if (p.f <= 0) continue
        const [r, g, b] = cs[d.c].color
        const dim = focus !== null && focus !== d.c ? 0.22 : 1
        const tw = 0.65 + 0.35 * Math.sin(t * 2 + d.tw)
        const a = (d.star ? 1 : 0.42) * tw * dim * Math.min(1, p.f * 1.1)
        const s = d.s * p.f * Math.sqrt(scale) * (d.star ? 1 : 0.9)
        ctx.fillStyle = d.star ? `rgba(${Math.min(255, r + 120)},${Math.min(255, g + 120)},${Math.min(255, b + 120)},${a})` : `rgba(${r},${g},${b},${a})`
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
      }

      // Nexy at the centre.
      const glow = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 70 * scale + 30)
      glow.addColorStop(0, 'rgba(255,255,255,0.95)')
      glow.addColorStop(0.15, 'rgba(120,180,255,0.6)')
      glow.addColorStop(1, 'rgba(60,40,200,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(core.x, core.y, 70 * scale + 30, 0, 7)
      ctx.fill()

      // Names.
      ctx.globalCompositeOperation = 'source-over'
      ctx.textAlign = 'center'
      ctx.font = `700 ${Math.round(12 + 2 * Math.min(1.5, v.zoom))}px ui-monospace, Menlo, monospace`
      // Biggest clouds first; a name that would land on another waits for a hover.
      const taken: Array<[number, number, number, number]> = []
      const order = cs.map((_, i) => i).sort((a, b) => (a === focus ? -1 : b === focus ? 1 : cs[b].items.length - cs[a].items.length))
      order.forEach((i) => {
        const c = cs[i]
        const p = proj.current[i]
        const dim = focus !== null && focus !== i ? 0.35 : 1
        const [r, g, b] = c.color
        const y = p.y - p.r * 0.75 - 8
        const label = `${c.icon ? `${c.icon} ` : ''}${c.label.toUpperCase()}`
        const w = ctx.measureText(label).width + 18
        const box: [number, number, number, number] = [p.x - w / 2, y - 13, w, 22]
        if (taken.some((o) => box[0] < o[0] + o[2] && o[0] < box[0] + box[2] && box[1] < o[1] + o[3] && o[1] < box[1] + box[3])) return
        taken.push(box)
        ctx.fillStyle = `rgba(8,10,28,${0.72 * dim})`
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.7 * dim})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(p.x - w / 2, y - 13, w, 22, 6)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = `rgba(236,240,255,${dim})`
        ctx.fillText(label, p.x, y + 3)
      })
      ctx.fillStyle = '#ffffff'
      ctx.font = '800 14px ui-monospace, Menlo, monospace'
      ctx.fillText('NEXY', core.x, core.y + 70 * scale + 46)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [cs, ds])

  if (!data?.nodes.length) return <p className="muted">El cerebro aparece en cuanto Nexy arranca.</p>

  const total = cs.reduce((a, c) => a + c.items.length, 0)
  const at = (e: React.PointerEvent) => {
    const box = canvas.current!.getBoundingClientRect()
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    let best: number | null = null
    let dist = Infinity
    proj.current.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y)
      if (d < Math.max(30, p.r) && d < dist) {
        best = i
        dist = d
      }
    })
    return best
  }
  const shown = picked !== null ? cs[picked] : null

  return (
    <div className="nebula-wrap">
      <canvas
        ref={canvas}
        className="nebula"
        onWheel={(e) => {
          const v = view.current
          v.zoom = Math.min(3, Math.max(0.55, v.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
        }}
        onPointerDown={(e) => {
          const v = view.current
          v.drag = { x: e.clientX, y: e.clientY, yaw: v.yaw, pitch: v.pitch }
          v.moved = false
          e.currentTarget.setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => {
          const v = view.current
          if (v.drag) {
            const dx = e.clientX - v.drag.x
            const dy = e.clientY - v.drag.y
            if (Math.abs(dx) + Math.abs(dy) > 4) v.moved = true
            v.yaw = v.drag.yaw + dx * 0.005
            v.pitch = Math.max(-1.2, Math.min(1.2, v.drag.pitch + dy * 0.004))
          } else setHover(at(e))
        }}
        onPointerUp={(e) => {
          const v = view.current
          const click = v.drag && !v.moved
          v.drag = null
          if (click) {
            const i = at(e)
            setPicked(i === picked ? null : i)
          }
        }}
        onPointerLeave={() => setHover(null)}
      />
      <div className="nebula-title">
        <small>MAPA DEL CEREBRO</small>
        <h2>Segundo cerebro</h2>
        <p>
          <b>{total}</b> cosas que Nexy sabe · <b>{cs.length}</b> áreas
        </p>
      </div>
      <ul className="nebula-list">
        {cs.map((c, i) => (
          <li key={c.id}>
            <button className={picked === i ? 'on' : ''} onClick={() => setPicked(picked === i ? null : i)} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <span className="dot" style={{ background: `rgb(${c.color.join(',')})` }} />
              {c.icon ? `${c.icon} ` : ''}
              {c.label}
              <em>{c.items.length}</em>
            </button>
          </li>
        ))}
      </ul>
      <div className="brain-help">Arrastra para girar · rueda para acercar · toca una nube para ver qué hay dentro</div>
      {shown ? (
        <aside className="brain-card">
          <button className="close" onClick={() => setPicked(null)} aria-label="Cerrar">
            ×
          </button>
          <small>{shown.items.length === 1 ? '1 cosa' : `${shown.items.length} cosas`}</small>
          <h3>
            {shown.icon ? `${shown.icon} ` : ''}
            {shown.label}
          </h3>
          {shown.items.length > 1 ? (
            <ul className="nebula-items">
              {shown.items
                .filter((n) => n.id !== shown.id && n.label !== shown.label)
                .slice(0, 40)
                .map((n) => (
                  <li key={n.id} title={n.detail}>
                    {n.icon ? `${n.icon} ` : ''}
                    {n.label}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="muted">{shown.items[0]?.detail ?? 'Todavía sin notas.'}</p>
          )}
        </aside>
      ) : null}
    </div>
  )
}
