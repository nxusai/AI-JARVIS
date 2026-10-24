import { useEffect, useMemo, useRef, useState } from 'react'
import type { EcoLive } from './ecosystem'
import { gauss, hash, rand, type Cloud } from './clouds'

/**
 * The whole ecosystem and everything Nexy knows, as a living field. Each
 * company is a cloud of light in its colour: its departments, their agents
 * and connections, what Nexy knows about it, and the owner's profile
 * compartment of the same name. Nexy's own core (memory, contacts, shared
 * services) is one more cloud, and the profile's own compartments (personal,
 * principles, the holding) are the rest — all wired to Nexy in the middle.
 *
 * What is working lights up: its star pulses and pulses run out along the wire
 * to its cloud. Drag to turn it, scroll to come closer, touch a cloud to see
 * its team and what it knows, and touch any of those to see what it did.
 */

type Placed = Cloud & { center: [number, number, number]; radius: number }
type Dot = { c: number; x: number; y: number; z: number; s: number; item: number; tw: number }

function place(cs: Cloud[]): Placed[] {
  return cs.map((c, i) => {
    // Over a sphere (golden angle), so no two clouds sit on each other.
    const yy = 1 - ((i + 0.5) / cs.length) * 2
    const rr = Math.sqrt(1 - yy * yy)
    const a = i * 2.399963 + 0.4
    const ring = 470
    return { ...c, center: [Math.cos(a) * rr * ring, yy * ring * 0.62, Math.sin(a) * rr * ring], radius: 105 + Math.min(130, Math.sqrt(c.items.length) * 20) }
  })
}

function dots(cs: Placed[]): Dot[] {
  const out: Dot[] = []
  cs.forEach((c, ci) => {
    const r = rand(hash(c.id))
    const n = Math.min(2600, 1100 + c.items.length * 80)
    for (let i = 0; i < n; i++) {
      const k = c.radius * (0.3 + 0.7 * r() * r())
      out.push({ c: ci, x: c.center[0] + gauss(r) * k * 0.6, y: c.center[1] + gauss(r) * k * 0.6, z: c.center[2] + gauss(r) * k * 0.6, s: 0.8 + r() * 1.9, item: -1, tw: r() * 6.28 })
    }
    // One bright star per thing in the cloud.
    c.items.forEach((_, i) => {
      const k = c.radius * 0.6
      out.push({ c: ci, x: c.center[0] + gauss(r) * k * 0.4, y: c.center[1] + gauss(r) * k * 0.4, z: c.center[2] + gauss(r) * k * 0.4, s: 2.6 + r() * 1.4, item: i, tw: r() * 6.28 })
    })
  })
  return out
}

export function Nebula({
  clouds,
  live,
  selected,
  onSelect,
  focus,
}: {
  clouds: Cloud[]
  live: EcoLive
  /** The picked thing: a cloud's id or one of its items' ids. */
  selected: string | null
  onSelect: (id: string | null) => void
  /** A company picked in the chips above: its cloud opens. 'all' closes it. */
  focus: string | null
}) {
  const cs = useMemo(() => place(clouds), [clouds])
  const ds = useMemo(() => dots(cs), [cs])
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const view = useRef({ yaw: 0, pitch: -0.32, zoom: 1, drag: null as null | { x: number; y: number; yaw: number; pitch: number }, moved: false })
  const proj = useRef<Array<{ x: number; y: number; r: number }>>([])
  const [hover, setHover] = useState<number | null>(null)
  const pickedIdx = selected === null ? -1 : cs.findIndex((c) => c.id === selected || c.items.some((it) => it.id === selected))
  const picked = pickedIdx >= 0 ? pickedIdx : null
  const state = useRef({ hover, picked, live, selected })
  state.current = { hover, picked, live, selected }

  useEffect(() => {
    if (!focus) return
    if (focus === 'all') onSelect(null)
    else {
      const c = cs.find((x) => x.eco === focus)
      if (c) onSelect(c.id)
    }
    // Only when a chip is picked, not when the clouds change under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

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
        return { x: W / 2 + X * f * scale, y: H / 2 + Y * f * scale, f }
      }
      const { hover: hv, picked: pk, live: lv, selected: sel } = state.current
      const focusIdx = pk ?? hv
      const busy = cs.map((c) => lv.has(c.id) || c.items.some((it) => lv.has(it.id)))

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
        const dim = focusIdx !== null && focusIdx !== i ? 0.25 : 1
        const grad = ctx.createLinearGradient(core.x, core.y, p.x, p.y)
        grad.addColorStop(0, `rgba(255,255,255,${0.22 * dim})`)
        grad.addColorStop(1, `rgba(${r},${g},${b},${0.38 * dim})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = busy[i] ? 2 : 1
        ctx.beginPath()
        ctx.moveTo(core.x, core.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        for (let k = 0; k < (busy[i] ? 4 : 1); k++) {
          const q = (t * (busy[i] ? 0.6 : 0.18) + k / 4 + hash(c.id)) % 1
          ctx.fillStyle = `rgba(${r},${g},${b},${0.9 * dim})`
          ctx.beginPath()
          ctx.arc(core.x + (p.x - core.x) * q, core.y + (p.y - core.y) * q, busy[i] ? 3 : 1.8, 0, 7)
          ctx.fill()
        }
        return { x: p.x, y: p.y, r: c.radius * p.f * scale }
      })

      // A soft glow under each cloud — brighter while it works — and rays from Nexy into it.
      cs.forEach((c, i) => {
        const p = proj.current[i]
        const [r, g, b] = c.color
        const dim = focusIdx !== null && focusIdx !== i ? 0.3 : 1
        const lift = busy[i] ? 1.5 + 0.5 * Math.sin(t * 4) : 1
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 1.25 + 10)
        halo.addColorStop(0, `rgba(${r},${g},${b},${0.32 * dim * lift})`)
        halo.addColorStop(0.5, `rgba(${r},${g},${b},${0.1 * dim * lift})`)
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
        const dim = focusIdx !== null && focusIdx !== d.c ? 0.15 : 1
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.16 * dim})`
        ctx.beginPath()
        ctx.moveTo(core.x, core.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }

      // The clouds, and a star for each thing in them.
      for (const d of ds) {
        const p = P(d.x, d.y, d.z)
        if (p.f <= 0) continue
        const c = cs[d.c]
        const [r, g, b] = c.color
        const dim = focusIdx !== null && focusIdx !== d.c ? 0.22 : 1
        const tw = 0.65 + 0.35 * Math.sin(t * 2 + d.tw)
        const it = d.item >= 0 ? c.items[d.item] : null
        const on = it ? lv.has(it.id) : false
        const chosen = it !== null && it.id === sel
        const a = (it ? 1 : 0.42) * tw * dim * Math.min(1, p.f * 1.1)
        const s = d.s * p.f * Math.sqrt(scale) * (on || chosen ? 2 + Math.sin(t * 6) : 1)
        ctx.fillStyle = it ? `rgba(${Math.min(255, r + 120)},${Math.min(255, g + 120)},${Math.min(255, b + 120)},${a})` : `rgba(${r},${g},${b},${a})`
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
        if (on || chosen) {
          ctx.strokeStyle = `rgba(255,255,255,${0.7 * dim})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(p.x, p.y, s + 5 + 3 * Math.sin(t * 5), 0, 7)
          ctx.stroke()
        }
      }

      // Nexy at the centre, pulsing while she works.
      const nexyOn = lv.has('core')
      const R = (70 * scale + 30) * (nexyOn ? 1.15 + 0.1 * Math.sin(t * 5) : 1)
      const glow = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, R)
      glow.addColorStop(0, 'rgba(255,255,255,0.95)')
      glow.addColorStop(0.15, 'rgba(120,180,255,0.6)')
      glow.addColorStop(1, 'rgba(60,40,200,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(core.x, core.y, R, 0, 7)
      ctx.fill()

      // Names: biggest clouds first; a name that would land on another waits for a hover.
      ctx.globalCompositeOperation = 'source-over'
      ctx.textAlign = 'center'
      ctx.font = `700 ${Math.round(12 + 2 * Math.min(1.5, v.zoom))}px ui-monospace, Menlo, monospace`
      const taken: Array<[number, number, number, number]> = []
      const order = cs.map((_, i) => i).sort((a, b) => (a === focusIdx ? -1 : b === focusIdx ? 1 : cs[b].items.length - cs[a].items.length))
      order.forEach((i) => {
        const c = cs[i]
        const p = proj.current[i]
        const dim = focusIdx !== null && focusIdx !== i ? 0.35 : 1
        const [r, g, b] = c.color
        const y = p.y - p.r * 0.75 - 8
        const label = `${busy[i] ? '● ' : ''}${c.icon ? `${c.icon} ` : ''}${c.label.toUpperCase()}`
        const w = ctx.measureText(label).width + 18
        const box: [number, number, number, number] = [p.x - w / 2, y - 13, w, 22]
        if (taken.some((o) => box[0] < o[0] + o[2] && o[0] < box[0] + box[2] && box[1] < o[1] + o[3] && o[1] < box[1] + box[3])) return
        taken.push(box)
        ctx.fillStyle = `rgba(8,10,28,${0.72 * dim})`
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.7 * dim})`
        ctx.lineWidth = busy[i] ? 2 : 1
        ctx.beginPath()
        ctx.roundRect(box[0], box[1], box[2], box[3], 6)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = `rgba(236,240,255,${dim})`
        ctx.fillText(label, p.x, y + 3)
      })
      ctx.fillStyle = '#ffffff'
      ctx.font = '800 14px ui-monospace, Menlo, monospace'
      ctx.fillText('NEXY', core.x, core.y + R + 16)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [cs, ds])

  if (!clouds.length) return <p className="muted">El cerebro aparece en cuanto Nexy arranca.</p>

  const total = cs.reduce((a, c) => a + c.items.length, 0)
  const working = cs.filter((c) => live.has(c.id) || c.items.some((it) => live.has(it.id))).length
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
  const groups = shown ? [...new Set(shown.items.map((it) => it.group))] : []

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
            onSelect(i === null || i === picked ? null : cs[i].id)
          }
        }}
        onPointerLeave={() => setHover(null)}
      />
      <div className="nebula-title">
        <small>ECOSISTEMA Y SEGUNDO CEREBRO</small>
        <h2>Nexy</h2>
        <p>
          <b>{total}</b> piezas · <b>{cs.length}</b> áreas · {working ? <b className="live-txt">{working} trabajando ahora</b> : 'en reposo'}
        </p>
      </div>
      <ul className="nebula-list">
        {cs.map((c, i) => {
          const on = live.has(c.id) || c.items.some((it) => live.has(it.id))
          return (
            <li key={c.id}>
              <button className={picked === i ? 'on' : ''} onClick={() => onSelect(picked === i ? null : c.id)} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                <span className={on ? 'dot live' : 'dot'} style={{ background: `rgb(${c.color.join(',')})` }} />
                {c.icon ? `${c.icon} ` : ''}
                {c.label}
                <em>{c.items.length}</em>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="brain-help">Arrastra para girar · rueda para acercar · toca una nube para ver su equipo y lo que sabe</div>
      {shown ? (
        <aside className="brain-card nebula-card">
          <button className="close" onClick={() => onSelect(null)} aria-label="Cerrar">
            ×
          </button>
          <small>{shown.items.length === 1 ? '1 pieza' : `${shown.items.length} piezas`}</small>
          <h3>
            <button className="linkish" onClick={() => onSelect(shown.id)}>
              {shown.icon ? `${shown.icon} ` : ''}
              {shown.label}
            </button>
          </h3>
          {groups.map((g) => (
            <div key={g}>
              <h4>{g}</h4>
              <ul className="nebula-items">
                {shown.items
                  .filter((it) => it.group === g)
                  .map((it) => (
                    <li key={it.id} style={{ paddingLeft: it.depth * 14 }}>
                      <button className={`linkish${it.id === selected ? ' on' : ''}`} title={it.detail} onClick={() => onSelect(it.id === selected ? shown.id : it.id)}>
                        {live.has(it.id) ? <span className="pulse" /> : null}
                        {it.depth ? '↳ ' : ''}
                        {it.icon ? `${it.icon} ` : ''}
                        {it.label}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </aside>
      ) : null}
    </div>
  )
}
