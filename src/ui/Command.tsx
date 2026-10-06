import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { useStore, type Phase } from '../store'
import { useFeed, type Feed } from './feed'
import './command.css'

/**
 * N.E.X.Y. V2 — the command deck around the reactor.
 *
 * Everything on it is live: the systems are the bridge's real connectors and
 * their state, the activity matrix counts the tasks and tool calls Nexy has
 * actually run today, the signal is the microphone and a measured round trip
 * to the bridge, and the brand matrix is the brands and team she works with.
 * No number on this screen is painted on for looks.
 */

const PHASE_LABEL: Record<Phase, string> = {
  offline: 'SYSTEM OFFLINE',
  boot: 'INITIALISING',
  dormant: 'SYSTEM ONLINE',
  waking: 'ONLINE',
  listening: 'LISTENING',
  thinking: 'PROCESSING',
  tooling: 'ACCESSING SYSTEMS',
  speaking: 'RESPONDING',
}

/* -------------------------------------------------------------- systems */

const NAMES: Record<string, string> = {
  'google-calendar': 'Google Calendar',
  gmail: 'Gmail',
  notion: 'Notion',
  higgsfield: 'Higgsfield',
  metricool: 'Metricool',
  'meta-ads': 'Meta Ads',
  canva: 'Canva',
  zoho: 'Zoho',
  elevenlabs: 'ElevenLabs',
  exa: 'Web Search',
  serper: 'Web Search',
  playwright: 'Browser',
  android: 'Android',
}

const ICON: Record<string, ReactElement> = {
  'google-calendar': (
    <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4M8 13h3v3H8z" /></svg>
  ),
  gmail: (
    <svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="M3.5 6.5 12 13l8.5-6.5" /></svg>
  ),
  notion: (
    <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 16V8l6 8V8" /></svg>
  ),
  higgsfield: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3" /><circle cx="6.5" cy="16" r="3" /><circle cx="17.5" cy="16" r="3" /></svg>
  ),
  metricool: (
    <svg viewBox="0 0 24 24"><path d="M5 19v-5M10 19V9M15 19v-8M20 19V5" /></svg>
  ),
  'meta-ads': (
    <svg viewBox="0 0 24 24"><path d="M3 15c0-4 2-7 4.5-7 3.5 0 5.5 8 9 8 2.2 0 3.5-1.6 3.5-4 0-3-1.6-5-3.6-5-3.2 0-5.4 8-8.9 8C5.3 15 3 15.6 3 15Z" /></svg>
  ),
  canva: (
    <svg viewBox="0 0 24 24"><path d="M17 8.5A6 6 0 1 0 17 15.5" /></svg>
  ),
  zoho: (
    <svg viewBox="0 0 24 24"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" /></svg>
  ),
  elevenlabs: (
    <svg viewBox="0 0 24 24"><path d="M9 4v16M15 4v16" /></svg>
  ),
  web: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" /></svg>
  ),
}

const iconFor = (name: string) => ICON[name] ?? (/exa|serper|web|search|playwright/.test(name) ? ICON.web : <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /></svg>)

const STATE: Record<string, { label: string; tone: 'on' | 'idle' | 'off' }> = {
  connected: { label: 'ONLINE', tone: 'on' },
  pending: { label: 'STANDBY', tone: 'idle' },
  'needs-auth': { label: 'SIGN IN', tone: 'off' },
  failed: { label: 'OFFLINE', tone: 'off' },
  disabled: { label: 'OFF', tone: 'off' },
}

function SystemsPanel({ feed }: { feed: Feed }) {
  const fallback = useStore((s) => s.connected)
  const rows = useMemo(() => {
    const own = /^jarvis_/
    const list = feed.servers
      .filter((s) => !own.test(s.name))
      .map((s) => ({ key: s.name, name: NAMES[s.name] ?? s.name.replace(/[-_]/g, ' '), state: STATE[s.status] ?? { label: s.status.toUpperCase(), tone: 'idle' as const } }))
    // Before the feed arrives: the names the voice session already reported.
    if (!list.length) return fallback.map((n) => ({ key: n.toLowerCase(), name: n, state: STATE.connected }))
    const seen = new Set<string>()
    return list.filter((r) => (seen.has(r.name) ? false : (seen.add(r.name), true))).slice(0, 10)
  }, [feed.servers, fallback])
  const online = rows.filter((r) => r.state.tone === 'on').length

  return (
    <section className="cx-panel cx-systems">
      <header className="cx-head">
        <span className="cx-flag" />
        SYSTEMS
        <span className="cx-live">
          {online}/{rows.length} ONLINE <i />
        </span>
      </header>
      <div className="cx-sys-list">
        {rows.map((r) => (
          <div key={r.key} className={`cx-sys cx-${r.state.tone}`}>
            <span className="cx-sys-icon">{iconFor(r.key)}</span>
            <span className="cx-sys-text">
              <b>{r.name}</b>
              <em>{r.state.label}</em>
            </span>
            <span className="cx-sys-dot" />
          </div>
        ))}
        {!rows.length && <div className="cx-empty">WAITING FOR THE BRIDGE…</div>}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ canvases */

/** A canvas that redraws every frame, sized for the screen's pixel density. */
function useCanvas(draw: (g: CanvasRenderingContext2D, w: number, h: number, t: number) => void) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef(draw)
  useEffect(() => {
    drawRef.current = draw
  })
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const g = c.getContext('2d')
    if (!g) return
    let raf = 0
    const loop = (t: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      drawRef.current(g, w, h, t / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return ref
}

/** Seeded points, so the shapes hold still between renders. */
function seeded(n: number, seed: number) {
  let s = seed
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
  return Array.from({ length: n }, () => [r(), r(), r()])
}

const CYAN = '0,229,255'
const RED = '255,59,74'

function Brain({ heat }: { heat: number }) {
  const nodes = useMemo(
    () =>
      seeded(110, 11).map(([a, b, c]) => {
        // Two lobes, wider than tall, like a brain seen from the side.
        const th = a * Math.PI * 2
        const r = Math.sqrt(b)
        let x = Math.cos(th) * r * 0.95
        let y = Math.sin(th) * r * 0.62
        if (y > 0.35 && Math.abs(x) < 0.25) y = 0.35 // the stem stays short
        x += (c - 0.5) * 0.08
        return { x, y, hot: c > 0.9 }
      }),
    [],
  )
  const ref = useCanvas((g, w, h, t) => {
    const cx = w / 2
    const cy = h / 2
    const sx = w * 0.46
    const sy = h * 0.66
    const pts = nodes.map((n, i) => ({ X: cx + n.x * sx + Math.sin(t * 0.8 + i) * 1.2, Y: cy + n.y * sy + Math.cos(t * 0.7 + i) * 1.2, hot: n.hot }))
    g.lineWidth = 0.6
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].X - pts[j].X, pts[i].Y - pts[j].Y)
        if (d < 26) {
          g.strokeStyle = `rgba(${CYAN},${(1 - d / 26) * 0.45})`
          g.beginPath()
          g.moveTo(pts[i].X, pts[i].Y)
          g.lineTo(pts[j].X, pts[j].Y)
          g.stroke()
        }
      }
    pts.forEach((p, i) => {
      const firing = p.hot && Math.sin(t * (2 + heat * 4) + i) > 0.2 - heat * 0.6
      g.fillStyle = firing ? `rgba(${RED},0.95)` : `rgba(180,250,255,0.85)`
      g.shadowColor = firing ? `rgb(${RED})` : `rgb(${CYAN})`
      g.shadowBlur = firing ? 10 : 5
      g.beginPath()
      g.arc(p.X, p.Y, firing ? 2.2 : 1.3, 0, Math.PI * 2)
      g.fill()
    })
    g.shadowBlur = 0
  })
  return <canvas ref={ref} className="cx-canvas" />
}

function Wave() {
  const hist = useRef<number[]>(Array(160).fill(0))
  const ref = useCanvas((g, w, h, t) => {
    const lvl = useStore.getState().level
    hist.current.push(lvl)
    hist.current.shift()
    const mid = h / 2
    const line = (amp: number, freq: number, phase: number, color: string, width: number) => {
      g.strokeStyle = color
      g.lineWidth = width
      g.beginPath()
      hist.current.forEach((v, i) => {
        const x = (i / (hist.current.length - 1)) * w
        const env = Math.sin((i / hist.current.length) * Math.PI)
        const y = mid + Math.sin(i * freq + t * 3 + phase) * (4 + v * amp) * env
        if (i) g.lineTo(x, y)
        else g.moveTo(x, y)
      })
      g.stroke()
    }
    g.shadowColor = `rgb(${CYAN})`
    g.shadowBlur = 8
    line(h * 0.42, 0.11, 0, `rgba(${CYAN},0.95)`, 1.4)
    line(h * 0.3, 0.07, 2, 'rgba(80,140,255,0.7)', 1)
    g.shadowColor = `rgb(${RED})`
    line(h * 0.36, 0.17, 4, `rgba(${RED},0.65)`, 0.9)
    g.shadowBlur = 0
  })
  return <canvas ref={ref} className="cx-canvas" />
}

function Globe({ dots }: { dots: Array<{ color: string; active: boolean }> }) {
  const marks = useMemo(() => seeded(Math.max(dots.length, 1), 29), [dots.length])
  const ref = useCanvas((g, w, h, t) => {
    const cx = w / 2
    const cy = h / 2
    const R = Math.min(w, h) * 0.42
    const rot = t * 0.25
    g.lineWidth = 0.7
    // meridians
    for (let k = 0; k < 12; k++) {
      const a = rot + (k / 12) * Math.PI
      g.strokeStyle = `rgba(${CYAN},${0.14 + 0.25 * Math.abs(Math.cos(a))})`
      g.beginPath()
      g.ellipse(cx, cy, Math.abs(Math.cos(a)) * R, R, 0, 0, Math.PI * 2)
      g.stroke()
    }
    // parallels
    for (let k = -3; k <= 3; k++) {
      const y = (k / 4) * R
      g.strokeStyle = `rgba(${CYAN},0.22)`
      g.beginPath()
      g.ellipse(cx, cy + y, Math.sqrt(R * R - y * y), Math.sqrt(R * R - y * y) * 0.12, 0, 0, Math.PI * 2)
      g.stroke()
    }
    // orbit
    g.strokeStyle = `rgba(${CYAN},0.5)`
    g.beginPath()
    g.ellipse(cx, cy, R * 1.45, R * 0.32, -0.25, 0, Math.PI * 2)
    g.stroke()
    // one light per brand, the active one brightest
    dots.forEach((d, i) => {
      const [u, v] = marks[i] ?? [0.5, 0.5]
      const lon = u * Math.PI * 2 + rot
      const lat = (v - 0.5) * 2.2
      const z = Math.cos(lat) * Math.cos(lon)
      if (z < -0.1) return
      const x = cx + Math.cos(lat) * Math.sin(lon) * R
      const y = cy + Math.sin(lat) * R * 0.9
      g.fillStyle = d.active ? `rgb(${RED})` : d.color
      g.shadowColor = d.active ? `rgb(${RED})` : d.color
      g.shadowBlur = d.active ? 16 : 8
      g.beginPath()
      g.arc(x, y, d.active ? 3.4 : 2.2, 0, Math.PI * 2)
      g.fill()
    })
    g.shadowBlur = 0
  })
  return <canvas ref={ref} className="cx-canvas" />
}

/* --------------------------------------------------------------- panels */

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function Bar({ label, value, shown, max }: { label: string; value: number; shown: string; max: number }) {
  return (
    <div className="cx-bar">
      <span>{label}</span>
      <b>{shown}</b>
      <i>
        <u style={{ width: `${Math.max(2, Math.min(100, (value / Math.max(max, 1)) * 100))}%` }} />
      </i>
    </div>
  )
}

function ActivityPanel({ feed }: { feed: Feed }) {
  const phase = useStore((s) => s.phase)
  const today = startOfToday()
  const mine = feed.tasks.filter((t) => t.startedAt >= today)
  const running = feed.tasks.filter((t) => t.status === 'running').length
  const finished = mine.filter((t) => t.status !== 'running')
  const ok = finished.filter((t) => t.status === 'done').length
  const steps = mine.reduce((n, t) => n + t.steps.length, 0)
  const rate = finished.length ? Math.round((ok / finished.length) * 100) : 100
  const heat = running ? 1 : phase === 'thinking' || phase === 'tooling' ? 0.8 : phase === 'speaking' ? 0.5 : 0.15

  return (
    <section className="cx-panel cx-activity">
      <header className="cx-head">
        <span className="cx-flag" />
        ACTIVITY MATRIX
        <span className="cx-live">
          LIVE <i />
        </span>
      </header>
      <div className="cx-split">
        <div className="cx-viz">
          <Brain heat={heat} />
        </div>
        <div className="cx-bars">
          <Bar label="TASKS TODAY" value={mine.length} shown={String(mine.length)} max={Math.max(12, mine.length)} />
          <Bar label="RUNNING" value={running} shown={String(running)} max={3} />
          <Bar label="TOOL CALLS" value={steps} shown={String(steps)} max={Math.max(60, steps)} />
          <Bar label="SUCCESS" value={rate} shown={`${rate}%`} max={100} />
          <Bar label="APPROVALS" value={feed.approvals.length} shown={String(feed.approvals.length)} max={5} />
        </div>
      </div>
    </section>
  )
}

const two = (n: number) => String(n).padStart(2, '0')

function SignalPanel({ feed, since }: { feed: Feed; since: number }) {
  const level = useStore((s) => s.level)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const up = Math.floor((now - since) / 1000)
  const ext = feed.servers.filter((s) => !/^jarvis_/.test(s.name))
  const on = ext.filter((s) => s.status === 'connected').length

  return (
    <section className="cx-panel cx-signal">
      <header className="cx-head">
        <span className="cx-flag" />
        SIGNAL INTELLIGENCE
        <span className="cx-live">
          {feed.live ? 'LIVE' : 'LINKING'} <i />
        </span>
      </header>
      <div className="cx-split">
        <div className="cx-viz">
          <Wave />
        </div>
        <dl className="cx-stats">
          <dt>INPUT</dt>
          <dd>{Math.round(level * 100)}%</dd>
          <dt>LATENCY</dt>
          <dd>{feed.latency == null ? '—' : `${feed.latency} ms`}</dd>
          <dt>NODES</dt>
          <dd>
            {on}/{ext.length}
          </dd>
          <dt>UPTIME</dt>
          <dd>
            {two(Math.floor(up / 3600))}:{two(Math.floor(up / 60) % 60)}:{two(up % 60)}
          </dd>
        </dl>
      </div>
    </section>
  )
}

function BrandPanel({ feed }: { feed: Feed }) {
  const brands = feed.brands
  const active = brands?.marcas.find((b) => b.id === brands.activa)
  const dots = (brands?.marcas ?? []).map((b) => ({ color: b.color || '#00e5ff', active: b.id === brands?.activa }))
  const zone = (Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop() ?? '').replace(/_/g, ' ')
  const pending = feed.approvals.length

  return (
    <section className="cx-panel cx-world">
      <header className="cx-head">
        <span className="cx-flag" />
        BRAND MATRIX
        <span className="cx-live">
          {brands ? 'SYNCED' : 'LINKING'} <i />
        </span>
      </header>
      <div className="cx-split">
        <div className="cx-viz">
          <Globe dots={dots.length ? dots : [{ color: '#00e5ff', active: false }]} />
        </div>
        <dl className="cx-stats cx-stats-loud">
          <dt>ACTIVE</dt>
          <dd className="cx-hi">{active?.nombre ?? '—'}</dd>
          <dt>BRANDS</dt>
          <dd>{brands?.marcas.length ?? '—'}</dd>
          <dt>AGENTS</dt>
          <dd>{feed.org?.agents.length ?? '—'}</dd>
          <dt>TIME ZONE</dt>
          <dd>{zone.toUpperCase()}</dd>
          <dt>APPROVALS</dt>
          <dd className={pending ? 'cx-alert' : 'cx-hi'}>{pending ? `${pending} PEND.` : 'CLEAR'}</dd>
        </dl>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------- centrepiece */

/**
 * The armoured frame around the reactor: four struts in an X, plated rings
 * turning at their own speeds, a tick dial and the energy beam across the
 * screen. The 3D core shows through the clear centre. It swells a little
 * with the voice — written straight to the element each frame, so the frame
 * breathing never re-renders React.
 */
function CoreFrame() {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    let raf = 0
    let eased = 0
    const loop = () => {
      const lvl = useStore.getState().level
      eased += (lvl - eased) * 0.18
      ref.current?.style.setProperty('--lvl', eased.toFixed(3))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const plates = Array.from({ length: 16 }, (_, i) => i)
  const ticks = Array.from({ length: 120 }, (_, i) => i)
  return (
    <div className="cx-core" ref={ref}>
      <svg viewBox="0 0 1000 1000" className="cx-core-svg">
        <defs>
          <linearGradient id="cx-metal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3a4048" />
            <stop offset="0.45" stopColor="#9aa6b2" />
            <stop offset="0.55" stopColor="#4a525c" />
            <stop offset="1" stopColor="#14181d" />
          </linearGradient>
          <radialGradient id="cx-lens" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="0.8" stopColor="#02080d" stopOpacity="0.85" />
            <stop offset="1" stopColor="#05141c" stopOpacity="1" />
          </radialGradient>
          <filter id="cx-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The four struts of the X, behind the rings */}
        {[45, 135, 225, 315].map((a) => (
          <g key={a} transform={`rotate(${a} 500 500)`}>
            <polygon points="478,-150 522,-150 552,262 448,262" fill="url(#cx-metal)" opacity="0.9" />
            <polygon points="490,-120 510,-120 532,246 468,246" fill="none" stroke="var(--cx-c)" strokeWidth="2.2" filter="url(#cx-glow)" opacity="0.9" />
            <line x1="500" y1="-100" x2="500" y2="240" stroke="var(--cx-c)" strokeWidth="1.2" opacity="0.7" />
            <rect x="493" y="40" width="14" height="36" fill="#ff3b4a" opacity="0.85" filter="url(#cx-glow)" />
          </g>
        ))}

        {/* Outer armour plates */}
        <g className="cx-spin-slow">
          {plates.map((i) => {
            const a0 = (i / 16) * Math.PI * 2 + 0.03
            const a1 = ((i + 1) / 16) * Math.PI * 2 - 0.03
            const p = (r: number, a: number) => `${500 + Math.cos(a) * r},${500 + Math.sin(a) * r}`
            return (
              <path
                key={i}
                d={`M${p(400, a0)} A400 400 0 0 1 ${p(400, a1)} L${p(366, a1)} A366 366 0 0 0 ${p(366, a0)} Z`}
                fill="url(#cx-metal)"
                opacity={i % 4 === 0 ? 0.75 : 0.32}
                stroke="rgba(0,229,255,.35)"
                strokeWidth="1"
              />
            )
          })}
        </g>

        {/* Glowing rings */}
        <circle cx="500" cy="500" r="352" fill="none" stroke="var(--cx-c)" strokeWidth="3" filter="url(#cx-glow)" className="cx-breathe" />
        <g className="cx-spin-rev">
          <circle cx="500" cy="500" r="330" fill="none" stroke="var(--cx-c)" strokeWidth="1.5" strokeDasharray="60 14 6 14" opacity="0.8" />
        </g>
        <g className="cx-spin">
          <circle cx="500" cy="500" r="300" fill="none" stroke="var(--cx-c)" strokeWidth="10" strokeDasharray="2 10" opacity="0.35" />
          <path d="M 500 210 A 290 290 0 0 1 760 370" fill="none" stroke="#ff3b4a" strokeWidth="3" opacity="0.8" filter="url(#cx-glow)" />
          <path d="M 240 630 A 290 290 0 0 1 220 470" fill="none" stroke="#ff3b4a" strokeWidth="3" opacity="0.6" />
        </g>
        <g>
          {ticks.map((i) => {
            const a = (i / 120) * Math.PI * 2
            const long = i % 10 === 0
            const r0 = 262
            const r1 = long ? 284 : 272
            return (
              <line
                key={i}
                x1={500 + Math.cos(a) * r0}
                y1={500 + Math.sin(a) * r0}
                x2={500 + Math.cos(a) * r1}
                y2={500 + Math.sin(a) * r1}
                stroke="var(--cx-c)"
                strokeWidth={long ? 2 : 1}
                opacity={long ? 0.9 : 0.45}
              />
            )
          })}
        </g>
        <g className="cx-spin-fast">
          <circle cx="500" cy="500" r="232" fill="none" stroke="var(--cx-c)" strokeWidth="2" strokeDasharray="120 40" opacity="0.7" filter="url(#cx-glow)" />
        </g>
        <circle cx="500" cy="500" r="200" fill="none" stroke="var(--cx-c)" strokeWidth="4" filter="url(#cx-glow)" className="cx-breathe" />

        {/* Dark glass lens: clear in the middle so the reactor shows through */}
        <circle cx="500" cy="500" r="196" fill="url(#cx-lens)" />
        <circle cx="500" cy="500" r="196" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
        <path d="M 380 380 A 170 170 0 0 1 560 330" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/** The horizontal energy beam through the reactor, alive with the voice. */
function Beam() {
  const ref = useCanvas((g, w, h, t) => {
    const lvl = useStore.getState().level
    const mid = h / 2
    const grad = g.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, `rgba(${CYAN},0)`)
    grad.addColorStop(0.3, `rgba(${CYAN},0.85)`)
    grad.addColorStop(0.5, `rgba(${CYAN},0)`)
    grad.addColorStop(0.7, `rgba(${CYAN},0.85)`)
    grad.addColorStop(1, `rgba(${CYAN},0)`)
    g.strokeStyle = grad
    g.shadowColor = `rgb(${CYAN})`
    g.shadowBlur = 10
    for (const [amp, f, ph, lw] of [
      [1, 0.045, 0, 1.6],
      [0.6, 0.08, 2, 0.8],
    ] as const) {
      g.lineWidth = lw
      g.beginPath()
      for (let x = 0; x <= w; x += 3) {
        const fromCentre = Math.abs(x - w / 2) / (w / 2)
        const env = Math.sin(fromCentre * Math.PI) * (fromCentre > 0.18 ? 1 : 0)
        const y = mid + Math.sin(x * f + t * 6 + ph) * (2 + lvl * h * 0.4 * amp) * env
        if (x) g.lineTo(x, y)
        else g.moveTo(x, y)
      }
      g.stroke()
    }
    g.shadowBlur = 0
  })
  return <canvas ref={ref} className="cx-beam" />
}

/* --------------------------------------------------------------- bottom */

function Meter({ side }: { side: 'l' | 'r' }) {
  const ref = useCanvas((g, w, h, t) => {
    const lvl = useStore.getState().level
    const n = 42
    for (let i = 0; i < n; i++) {
      const k = side === 'l' ? i : n - 1 - i
      const nearMic = k / n
      const v = (0.12 + lvl * 0.88) * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + t * 9))) * (0.3 + nearMic * 0.7)
      const bh = Math.max(2, v * h)
      g.fillStyle = `rgba(${CYAN},${0.35 + nearMic * 0.6})`
      g.fillRect((i / n) * w, (h - bh) / 2, Math.max(1.5, w / n - 3), bh)
    }
  })
  return <canvas ref={ref} className={`cx-meter cx-meter-${side}`} />
}

function NxMark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 40" width={size * 1.6} height={size} className="cx-nx">
      <path d="M4 36V4h5l18 22V4h6v32h-5L10 14v22z" fill="currentColor" />
      <path d="M36 4h7l7 10 7-10h7L53.5 19 64 36h-7l-7-11-7 11h-7l10.5-17z" fill="currentColor" opacity="0.92" />
    </svg>
  )
}

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(/,/g, '').toUpperCase()
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase()
  return (
    <>
      <span className="cx-sep" />
      <span>{date}</span>
      <span className="cx-sep" />
      <span>{time}</span>
    </>
  )
}

/** Start a turn the same way Space does, for a click on the mic. */
const talk = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))

export function Command({ showBrand, showSystems }: { showBrand: boolean; showSystems: boolean }) {
  const phase = useStore((s) => s.phase)
  const voice = useStore((s) => s.voice)
  // The voice-model download readout, only while booting (a stale one must never sit over LISTENING).
  const bootNote = useStore((s) => s.bootNote)
  const feed = useFeed()
  const since = useRef(Date.now()).current
  const hot = phase === 'listening' || phase === 'speaking'

  return (
    <div className={`cx ${hot ? 'cx-hot' : ''}`}>
      <div className="cx-frame" />
      <Beam />
      <CoreFrame />

      <header className="cx-top">
        {showBrand && (
          <div className="cx-brand">
            <div className="cx-title">
              N<span>.</span>E<span>.</span>X<span>.</span>Y<span>.</span> <small>V2</small>
            </div>
            <div className="cx-sub">JUST A RATHER VERY INTELLIGENT SYSTEM</div>
          </div>
        )}
        <div className="cx-logo">
          <NxMark size={34} />
        </div>
        <div className="cx-clock">
          <span className={`cx-state cx-state-${phase}`} />
          <span>{phase === 'boot' && bootNote ? bootNote : PHASE_LABEL[phase]}</span>
          <Clock />
        </div>
      </header>

      {showSystems && <SystemsPanel feed={feed} />}

      <div className="cx-right">
        <ActivityPanel feed={feed} />
        <SignalPanel feed={feed} since={since} />
        <BrandPanel feed={feed} />
      </div>

      <div className="cx-dock">
        <div className="cx-say">SAY “HEY NEXY”</div>
        <div className="cx-dock-row">
          <Meter side="l" />
          <button type="button" className="cx-mic" onClick={talk} aria-label="Hablar con Nexy">
            <svg viewBox="0 0 24 24">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
            </svg>
          </button>
          <Meter side="r" />
        </div>
        <div className="cx-keys">
          <kbd>SPACE</kbd> TO TALK <span className="cx-dim">· G HANDS{voice ? ` · V VOICE: ${voice.replace(/\(.*?\)/g, '').trim().toUpperCase()}` : ''}</span>
        </div>
      </div>

      <footer className="cx-foot cx-foot-l">
        <div className="cx-powered">
          <small>POWERED BY</small>
          <b>NXUS</b>
        </div>
        <span className="cx-vsep" />
        <p>
          INTELLIGENCE
          <br />
          ARCHITECTURE
          <br />
          FOR A BRIGHTER TOMORROW
        </p>
      </footer>
      <footer className="cx-foot cx-foot-r">
        <NxMark size={26} />
        <span className="cx-vsep" />
        <p>
          BUILT BY NXUS
          <br />
          FOR A MORE INTELLIGENT WORLD
        </p>
      </footer>
    </div>
  )
}
