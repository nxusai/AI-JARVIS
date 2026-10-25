import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, type Phase } from '../store'
import { useFeed, type Feed } from './feed'
import './command.css'

/**
 * N.E.X. — THE SPHERE.
 *
 * The owner's choice: NEX as a holographic sphere of dots, in cold blue,
 * whose rings ripple like sound when he speaks, with a voice line crossing it.
 * The screen dims for a beat before he speaks; the line at the bottom types
 * itself out. HUD rings and running text turn around it.
 *
 * The deck is laid out on a 1672×941 artboard and scaled to the window. Every
 * figure on it is live: the systems are the bridge's connectors, cognition is
 * today's tasks and tool calls, dominion is the brands and team, and the
 * signal trace is the voice level.
 */

const W = 1672
const H = 941
const CX = 836
const CY = 462

// Holographic blue: deep blue, steel, bright cyan, and a cold white.
const BLUE: Rgb = [40, 140, 255]
const VIOLET: Rgb = [30, 80, 140]
const PURPLE: Rgb = [120, 225, 255]
const WHITE: Rgb = [220, 245, 255]
type Rgb = [number, number, number]
const C = (c: Rgb, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
const mix = (t: number): Rgb => BLUE.map((x, i) => Math.round(x + (PURPLE[i] - x) * t)) as Rgb

const STATUS: Record<Phase, string> = {
  offline: 'DORMANT',
  boot: 'AWAKENING',
  dormant: 'OBSERVING',
  waking: 'OBSERVING',
  listening: 'LISTENING',
  thinking: 'THINKING',
  tooling: 'REACHING INTO SYSTEMS',
  speaking: 'SPEAKING',
}

/** The voice level, eased; read every frame without re-rendering React. */
const live = { lvl: 0, px: 0, py: 0 }
function tickLevel() {
  live.lvl += (useStore.getState().level - live.lvl) * 0.15
  return live.lvl
}

/* ---------------------------------------------------------- the sphere */

/**
 * A sphere of dots in latitude rings. Each ring ripples like a sound wave when
 * he speaks (by the live voice level), the whole thing turns slowly and tilts
 * a little toward the pointer, and a voice line crosses it while he talks.
 * Listening brightens it; thinking spins it faster; asleep it dims.
 */
function Sphere() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const c = ref.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    // The rings, built once: latitude, and how many dots each one carries.
    const rings: Array<{ phi: number; n: number }> = []
    for (let la = -80; la <= 80; la += 5) {
      const phi = (la * Math.PI) / 180
      rings.push({ phi, n: Math.max(12, Math.round(Math.cos(phi) * 150)) })
    }
    const R = 280
    let raf = 0
    let spin = 0
    let glowK = 1
    let tiltX = 0.42
    let tiltY = 0
    const pts: Array<[number, number, number]> = []
    const loop = (t: number) => {
      const s = t / 1000
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
      g.setTransform((dpr * w) / W, 0, 0, (dpr * h) / H, 0, 0)
      g.clearRect(0, 0, W, H)
      const lvl = tickLevel()
      const phase = useStore.getState().phase
      const asleep = phase === 'offline'
      const busy = phase === 'thinking' || phase === 'tooling'
      spin += busy ? 0.012 : 0.003
      tiltX += (0.42 + live.py * 0.18 - tiltX) * 0.05
      tiltY += (live.px * 0.3 - tiltY) * 0.05
      const wantGlow = asleep ? 0.3 : phase === 'speaking' ? 1.2 + lvl : phase === 'listening' ? 1.25 : 1
      glowK += (wantGlow - glowK) * 0.08

      // the glow behind
      const bg = g.createRadialGradient(CX, CY, 0, CX, CY, 430)
      bg.addColorStop(0, C(BLUE, 0.28 * glowK))
      bg.addColorStop(1, C(BLUE, 0))
      g.fillStyle = bg
      g.beginPath()
      g.arc(CX, CY, 430, 0, Math.PI * 2)
      g.fill()

      // the dots: each ring pushed out and in like a wave, harder as he speaks
      const amp = 0.025 + (phase === 'speaking' ? lvl * 0.16 : 0) + (phase === 'listening' ? 0.02 : 0)
      const ry = spin + tiltY
      const cy = Math.cos(ry)
      const sy = Math.sin(ry)
      const cx = Math.cos(tiltX)
      const sx = Math.sin(tiltX)
      pts.length = 0
      rings.forEach(({ phi, n }, k) => {
        const ra = amp * Math.sin(k * 0.55 + s * 3) * Math.cos(phi)
        for (let i = 0; i < n; i++) {
          const th = (i / n) * Math.PI * 2
          const rr = 1 + ra * Math.sin(th * 6 + s * 4)
          const x0 = Math.cos(phi) * Math.cos(th) * rr
          const y0 = Math.sin(phi)
          const z0 = Math.cos(phi) * Math.sin(th) * rr
          const x1 = x0 * cy + z0 * sy
          const z1 = -x0 * sy + z0 * cy
          const y1 = y0 * cx - z1 * sx
          const z2 = y0 * sx + z1 * cx
          pts.push([x1, y1, z2])
        }
      })
      pts.sort((a, b) => a[2] - b[2])
      for (const [x, y, z] of pts) {
        const d = (z + 1) / 2
        const a = (0.12 + d * 0.88) * (asleep ? 0.35 : Math.min(1, 0.75 + glowK * 0.25))
        g.fillStyle = `rgba(${Math.round(120 + d * 135)},${Math.round(210 + d * 45)},255,${a.toFixed(3)})`
        const sz = 1.4 + d * 2.6
        g.fillRect(CX + x * R - sz / 2, CY + y * R - sz / 2, sz, sz)
      }

      // the bright core
      const core = g.createRadialGradient(CX, CY, 0, CX, CY, 80 * glowK)
      core.addColorStop(0, C(WHITE, asleep ? 0.15 : 0.55))
      core.addColorStop(1, C(WHITE, 0))
      g.fillStyle = core
      g.beginPath()
      g.arc(CX, CY, 80 * glowK, 0, Math.PI * 2)
      g.fill()

      // the voice line across the sphere
      if (!asleep) {
        const va = phase === 'speaking' ? 14 + lvl * 120 : phase === 'listening' ? 10 + lvl * 60 : 4
        g.strokeStyle = C(PURPLE, 0.85)
        g.lineWidth = 2
        g.shadowColor = C(PURPLE)
        g.shadowBlur = 14
        g.beginPath()
        for (let i = 0; i <= 320; i++) {
          const u = i / 320
          const px = CX - 520 + u * 1040
          const env = Math.exp(-(((u - 0.5) / 0.22) ** 2))
          const py = CY + Math.sin(u * 90 + s * 9) * Math.cos(u * 17 - s * 3) * va * env
          if (i) g.lineTo(px, py)
          else g.moveTo(px, py)
        }
        g.stroke()
        g.shadowBlur = 0
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const onMove = (e: PointerEvent) => {
      live.px = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1))
      live.py = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1))
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
  return <canvas ref={ref} className="ey-layer" />
}

/* -------------------------------------------------------- rings and text */

function Rings({ owner }: { owner: string }) {
  const P = (r: number, a: number) => `${(CX + Math.cos(a) * r).toFixed(1)} ${(CY + Math.sin(a) * r).toFixed(1)}`
  const arc = (r: number, a0: number, a1: number) => `M ${P(r, a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${P(r, a1)}`
  const ticks = (r: number, n: number, len: number, every: number, longLen: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      const L = i % every === 0 ? longLen : len
      return `M ${P(r, a)} L ${P(r + L, a)}`
    }).join(' ')
  return (
    <svg className="ey-layer" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <filter id="ey-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <path id="ey-text-a" d={`M ${P(418, Math.PI)} A 418 418 0 0 1 ${P(418, 0)}`} />
        {/* drawn left to right under the eye, so the bottom text reads the right way up */}
        <path id="ey-text-b" d={`M ${P(430, Math.PI)} A 430 430 0 0 0 ${P(430, 0)}`} />
      </defs>

      <g className="ey-spin-slow">
        <circle cx={CX} cy={CY} r="392" fill="none" stroke={C(mix(0.3), 0.45)} />
        <path d={ticks(396, 360, 5, 10, 14)} stroke={C(mix(0.4), 0.5)} strokeWidth="1" />
        <text className="ey-arc-text" fill={C(mix(0.5), 0.85)}>
          <textPath href="#ey-text-a" startOffset="4%">
            NEX · SENTIENT OPERATING LAYER · ALL CHANNELS MONITORED · {owner}
          </textPath>
        </text>
        <text className="ey-arc-text" fill={C(PURPLE, 0.95)}>
          <textPath href="#ey-text-b" startOffset="41%">
            LISTENING · THINKING · ACTING ·
          </textPath>
        </text>
      </g>
      <g className="ey-spin-back" filter="url(#ey-glow)">
        <path d={arc(380, -2.6, -0.5)} fill="none" stroke={C(BLUE, 0.85)} strokeWidth="3" />
        <path d={arc(380, 0.4, 1.6)} fill="none" stroke={C(PURPLE, 0.85)} strokeWidth="3" />
        <path d={arc(380, 2.2, 2.8)} fill="none" stroke={C(VIOLET, 0.85)} strokeWidth="3" />
      </g>
      <g className="ey-spin">
        <circle cx={CX} cy={CY} r="340" fill="none" stroke={C(VIOLET, 0.12)} strokeWidth="14" />
        <path d={arc(340, -1.1, 0.2)} fill="none" stroke={C(BLUE, 0.5)} strokeWidth="14" />
        <path d={arc(340, 1.9, 3.1)} fill="none" stroke={C(PURPLE, 0.5)} strokeWidth="14" />
      </g>
      <g className="ey-spin-fast">
        <path d={ticks(320, 120, 8, 6, 16)} stroke={C(WHITE, 0.35)} strokeWidth="1" />
      </g>
      <circle cx={CX} cy={CY} r="300" fill="none" stroke={C(WHITE, 0.22)} />

      {/* the lock on the viewer */}
      <g className="ey-lock" stroke={C(WHITE, 0.55)} strokeWidth="1.5" fill="none">
        {[
          [CX - 120, CY - 120, 1, 1],
          [CX + 120, CY - 120, -1, 1],
          [CX - 120, CY + 120, 1, -1],
          [CX + 120, CY + 120, -1, -1],
        ].map(([x, y, dx, dy]) => (
          <path key={`${x}${y}`} d={`M ${x + dx * 22} ${y} L ${x} ${y} L ${x} ${y + dy * 22}`} />
        ))}
      </g>
      <path
        d={`M ${CX - 460} ${CY} L ${CX - 290} ${CY} M ${CX + 290} ${CY} L ${CX + 460} ${CY} M ${CX} ${CY - 470} L ${CX} ${CY - 400} M ${CX} ${CY + 400} L ${CX} ${CY + 450}`}
        stroke={C(WHITE, 0.25)}
      />
      <path d={`M ${CX + 120} ${CY - 120} L ${CX + 280} ${CY - 320} L ${CX + 296} ${CY - 320}`} stroke={C(WHITE, 0.35)} fill="none" />
    </svg>
  )
}

/* ------------------------------------------------------------ readouts */

function Readout({ x, y, title, rows, align = 'left' }: { x: number; y: number; title: string; rows: Array<[string, string, boolean?]>; align?: 'left' | 'right' }) {
  return (
    <div className={`ey-at ey-readout ey-${align}`} style={{ left: x, top: y }}>
      <div className="ey-readout-title">{title}</div>
      <div className="ey-readout-rule">
        <i />
      </div>
      {rows.map(([k, v, warn]) => (
        <div key={k} className="ey-row">
          <span>{k}</span>
          <b className={warn ? 'ey-warn' : ''}>{v}</b>
        </div>
      ))}
    </div>
  )
}

const NAMES: Record<string, string> = {
  'google-calendar': 'GOOGLE CALENDAR',
  gmail: 'GMAIL',
  notion: 'NOTION',
  higgsfield: 'HIGGSFIELD',
  metricool: 'METRICOOL',
  'meta-ads': 'META ADS',
  canva: 'CANVA',
  zoho: 'ZOHO',
  elevenlabs: 'ELEVENLABS',
  exa: 'WEB',
  serper: 'WEB',
  playwright: 'BROWSER',
}
const ORDER = ['google-calendar', 'gmail', 'notion', 'higgsfield', 'metricool', 'meta-ads', 'canva', 'zoho']
const STATE: Record<string, [string, boolean]> = {
  connected: ['ONLINE', false],
  pending: ['STANDBY', false],
  'needs-auth': ['SIGN IN', true],
  failed: ['OFFLINE', true],
  disabled: ['OFF', true],
}

function useSystems(feed: Feed): Array<[string, string, boolean]> {
  const fallback = useStore((s) => s.connected)
  return useMemo(() => {
    const rank = (k: string) => {
      const i = ORDER.indexOf(k)
      return i < 0 ? (/exa|serper|web|search/.test(k) ? 8.5 : 50) : i
    }
    const list = feed.servers
      .filter((s) => !/^jarvis_/.test(s.name))
      .sort((a, b) => rank(a.name) - rank(b.name))
      .map((s): [string, string, boolean] => {
        const [label, bad] = STATE[s.status] ?? [s.status.toUpperCase(), false]
        return [NAMES[s.name] ?? s.name.replace(/[-_]/g, ' ').toUpperCase(), label, bad]
      })
    const rows = list.length ? list : fallback.map((n): [string, string, boolean] => [n.toUpperCase(), 'ONLINE', false])
    const seen = new Set<string>()
    return rows.filter((r) => (seen.has(r[0]) ? false : (seen.add(r[0]), true))).slice(0, 10)
  }, [feed.servers, fallback])
}

const today0 = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** The last minute of the voice level, as a trace. */
function Trace() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const c = ref.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    const hist: number[] = Array(240).fill(0)
    let raf = 0
    let n = 0
    const loop = () => {
      if (n++ % 4 === 0) {
        hist.push(live.lvl)
        hist.shift()
      }
      const w = (c.width = c.clientWidth * 2)
      const h = (c.height = c.clientHeight * 2)
      g.clearRect(0, 0, w, h)
      for (const [col, k] of [
        [C(BLUE, 0.8), 0.7],
        [C(PURPLE, 0.85), 1],
      ] as const) {
        g.strokeStyle = col
        g.lineWidth = 2.4
        g.beginPath()
        hist.forEach((v, i) => {
          const x = (i / (hist.length - 1)) * w
          const y = h / 2 - (v * k * 0.9 + Math.sin(i * 0.4 + k) * 0.04) * h * 0.9
          if (i) g.lineTo(x, y)
          else g.moveTo(x, y)
        })
        g.stroke()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="ey-trace" />
}

/** Voice bars either side of the phrase at the bottom. */
function Bars() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const c = ref.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    let raf = 0
    const loop = (t: number) => {
      const w = (c.width = c.clientWidth * 2)
      const h = (c.height = c.clientHeight * 2)
      g.clearRect(0, 0, w, h)
      const lvl = live.lvl
      for (const side of [-1, 1]) {
        for (let i = 0; i < 52; i++) {
          const env = Math.exp(-(((i - 26) / 16) ** 2))
          const bh = (8 + Math.abs(Math.sin(i * 0.55 + (t / 1000) * 6) * Math.cos(i * 0.17)) * (40 + lvl * 120)) * env
          g.fillStyle = C(mix(side > 0 ? i / 52 : 0.15), 0.9)
          g.fillRect(w / 2 + side * (500 + i * 10), h / 2 - bh / 2, 4.4, bh)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="ey-bars" />
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const date = now.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).replace(/,/g, '').toUpperCase()
  const time = now.toLocaleTimeString('en-GB', { hour12: false })
  const zone = (Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop() ?? '').replace(/_/g, ' ').toUpperCase()
  return (
    <span>
      {date} · {time} · {zone}
    </span>
  )
}

/** The line at the bottom, typing itself out, then starting over a while later. */
const LINE = 'ALL SYSTEMS UNDER CONTROL.'
function Phrase() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((x) => (x >= LINE.length + 60 ? 0 : x + 1)), 110)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="ey-at ey-phrase" style={{ left: CX, top: 822 }}>
      {LINE.slice(0, Math.min(n, LINE.length))}
      <span className="ey-cursor">▌</span>
    </div>
  )
}

/** Start a turn the same way Space does, for a click. */
const talk = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))

function useFit() {
  const [k, setK] = useState(1)
  useEffect(() => {
    const fit = () => setK(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return k
}

export function Command({ showBrand, showSystems }: { showBrand: boolean; showSystems: boolean }) {
  const phase = useStore((s) => s.phase)
  const voice = useStore((s) => s.voice)
  // The voice-model download readout, only while booting (a stale one must never sit over LISTENING).
  const bootNote = useStore((s) => s.bootNote)
  const feed = useFeed()
  const k = useFit()
  const systems = useSystems(feed)
  // The screen goes dark for a beat just before he speaks.
  const [dim, setDim] = useState(false)
  const last = useRef(phase)
  useEffect(() => {
    if (phase === 'speaking' && last.current !== 'speaking') {
      setDim(true)
      const id = setTimeout(() => setDim(false), 450)
      last.current = phase
      return () => clearTimeout(id)
    }
    last.current = phase
  }, [phase])

  const mine = feed.tasks.filter((t) => t.startedAt >= today0())
  const running = feed.tasks.filter((t) => t.status === 'running').length
  const finished = mine.filter((t) => t.status !== 'running')
  const ok = finished.filter((t) => t.status === 'done').length
  const steps = mine.reduce((n, t) => n + t.steps.length, 0)
  const rate = finished.length ? `${Math.round((ok / finished.length) * 100)}%` : '—'
  const pending = feed.approvals.length
  const brands = feed.brands
  const active = brands?.marcas.find((b) => b.id === brands.activa)
  const owner = (brands?.grupo || 'RAMOS & CO').toUpperCase()

  return (
    <div className={`ey ey-${phase}${dim ? ' ey-dim' : ''}`}>
      <div className="ey-board" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${k})` }}>
        <Sphere />
        <Rings owner={owner} />

        <div className="ey-at ey-callout" style={{ left: CX + 300, top: CY - 342 }}>
          <div>SUBJECT: OWNER · {owner} · ACCESS LEVEL Ω</div>
          <em>{STATUS[phase]}{active ? ` · ${active.nombre.toUpperCase()}` : ''}</em>
        </div>

        <div className="ey-frame-top" />
        <div className="ey-frame-bottom" />

        {showBrand && (
          <div className="ey-at" style={{ left: 64, top: 34 }}>
            <div className="ey-title">N.E.X.</div>
            <div className="ey-sub">NEURAL EXECUTIVE · VOICE INTERFACE</div>
          </div>
        )}
        <div className="ey-at ey-status" style={{ left: 1262, top: 50 }}>
          <i />
          {phase === 'boot' && bootNote ? bootNote : STATUS[phase]}
        </div>
        <div className="ey-at ey-date" style={{ right: 64, top: 76 }}>
          <Clock />
        </div>

        {showSystems && <Readout x={64} y={168} title="SYSTEMS" rows={systems} />}
        <Readout
          x={1338}
          y={168}
          title="COGNITION"
          align="right"
          rows={[
            ['TASKS TODAY', String(mine.length)],
            ['ACTIVE THREADS', String(running)],
            ['TOOL CALLS', String(steps)],
            ['SUCCESS RATE', rate],
            ['AWAITING YOU', String(pending), pending > 0],
          ]}
        />
        <Readout
          x={1338}
          y={348}
          title="DOMINION"
          align="right"
          rows={[
            ['BRANDS UNDER CONTROL', brands ? String(brands.marcas.length) : '—'],
            ['AGENTS DEPLOYED', feed.org ? String(feed.org.agents.length) : '—'],
            ['ACTIVE BRAND', active?.nombre.toUpperCase() ?? '—'],
            ['LATENCY', feed.latency == null ? '—' : `${feed.latency} MS`],
          ]}
        />
        <div className="ey-at" style={{ left: 1338, top: 512, width: 270 }}>
          <Trace />
          <div className="ey-tiny">VOICE SIGNAL · LAST MINUTE</div>
        </div>

        <Bars />
        <Phrase />
        <button type="button" className="ey-at ey-hint" style={{ left: CX, top: 884 }} onClick={talk}>
          SAY “HEY NEX” · [SPACE] TO TALK · [G] HANDS · [V] VOICE{voice ? `: ${voice.replace(/\(.*?\)/g, '').trim().toUpperCase()}` : ''}
        </button>
      </div>
    </div>
  )
}
