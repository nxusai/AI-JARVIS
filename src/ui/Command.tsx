import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, type Phase } from '../store'
import { useFeed, type Feed } from './feed'
import './command.css'

/**
 * N.E.X.Y. — THE EYE.
 *
 * The owner's choice: Nexy as an eye that watches. A fibrous iris in the NXUS
 * colours (navy, blue, violet, purple, white) with a reptile's slit pupil
 * that opens when she listens, narrows while she thinks, flares when she
 * speaks and follows the pointer; HUD rings and running text turn around it.
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

const BLUE: Rgb = [47, 134, 214]
const VIOLET: Rgb = [83, 91, 167]
const PURPLE: Rgb = [138, 79, 208]
const WHITE: Rgb = [235, 240, 255]
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

function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

/** The voice level, eased; read every frame without re-rendering React. */
const live = { lvl: 0, px: 0, py: 0 }
function tickLevel() {
  live.lvl += (useStore.getState().level - live.lvl) * 0.15
  return live.lvl
}

/* ------------------------------------------------------------- the eye */

/** The iris is costly to draw, so it is painted once off screen and reused. */
function paintIris(size: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const m = size / 2
  const R = m * 0.98
  const r = seeded(17)
  const base = g.createRadialGradient(m, m, R * 0.26, m, m, R)
  base.addColorStop(0, C(PURPLE, 0.95))
  base.addColorStop(0.45, C(VIOLET, 0.85))
  base.addColorStop(0.8, C(BLUE, 0.6))
  base.addColorStop(1, '#05062a')
  g.fillStyle = base
  g.beginPath()
  g.arc(m, m, R, 0, Math.PI * 2)
  g.fill()
  for (let i = 0; i < 1400; i++) {
    const a = r() * Math.PI * 2
    const r0 = R * (0.3 + r() * 0.1)
    const r1 = r0 + R * (0.22 + r() * 0.6)
    g.strokeStyle = r() < 0.5 ? C(WHITE, 0.05 + r() * 0.12) : C(mix(r()), 0.2 + r() * 0.35)
    g.lineWidth = (0.6 + r() * 0.9) * (size / 540)
    g.beginPath()
    g.moveTo(m + Math.cos(a) * r0, m + Math.sin(a) * r0)
    g.quadraticCurveTo(m + Math.cos(a + 0.06) * (r0 + r1) / 2, m + Math.sin(a + 0.06) * (r0 + r1) / 2, m + Math.cos(a + 0.02) * r1, m + Math.sin(a + 0.02) * r1)
    g.stroke()
  }
  // crypts: dark notches in the iris
  for (let i = 0; i < 30; i++) {
    const a = r() * Math.PI * 2
    const d = R * (0.48 + r() * 0.34)
    g.fillStyle = 'rgba(4,4,30,.45)'
    g.beginPath()
    g.ellipse(m + Math.cos(a) * d, m + Math.sin(a) * d, R * (0.02 + r() * 0.035), R * (0.008 + r() * 0.012), a, 0, Math.PI * 2)
    g.fill()
  }
  const rim = g.createRadialGradient(m, m, R * 0.75, m, m, R)
  rim.addColorStop(0, 'rgba(3,3,20,0)')
  rim.addColorStop(1, 'rgba(3,3,20,.94)')
  g.fillStyle = rim
  g.beginPath()
  g.arc(m, m, R, 0, Math.PI * 2)
  g.fill()
  return c
}

function Eye() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const c = ref.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    const iris = paintIris(1080)
    let raf = 0
    let slit = 13
    let glowK = 1
    let lookX = 0
    let lookY = 0
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

      // What the pupil does in each state: wide to listen, thin to think, flaring to speak.
      const want =
        phase === 'offline' ? 4 : phase === 'listening' ? 30 + lvl * 26 : phase === 'thinking' || phase === 'tooling' ? 7 + Math.abs(Math.sin(s * 5)) * 4 : phase === 'speaking' ? 18 + lvl * 40 : 13
      slit += (want - slit) * 0.12
      const wantGlow = phase === 'offline' ? 0.25 : phase === 'speaking' ? 1.3 + lvl : phase === 'listening' ? 1.15 : 1
      glowK += (wantGlow - glowK) * 0.08
      // It looks toward the pointer, a little.
      lookX += (live.px * 26 - lookX) * 0.08
      lookY += (live.py * 18 - lookY) * 0.08

      const R = 268
      // iris, turning very slowly
      g.save()
      g.translate(CX + lookX * 0.35, CY + lookY * 0.35)
      g.rotate(s * 0.03)
      g.globalAlpha = phase === 'offline' ? 0.45 : 1
      g.drawImage(iris, -R, -R, R * 2, R * 2)
      g.restore()
      g.globalAlpha = 1

      // the light round the pupil
      const px = CX + lookX
      const py = CY + lookY
      const pg = g.createRadialGradient(px, py, 0, px, py, 110 * glowK)
      pg.addColorStop(0, C(WHITE, Math.min(1, 0.95 * glowK)))
      pg.addColorStop(0.25, C([190, 170, 255], 0.85 * Math.min(1, glowK)))
      pg.addColorStop(0.6, C(PURPLE, 0.55))
      pg.addColorStop(1, C(PURPLE, 0))
      g.shadowColor = C(PURPLE)
      g.shadowBlur = 70 * glowK
      g.fillStyle = pg
      g.beginPath()
      g.arc(px, py, 110 * glowK, 0, Math.PI * 2)
      g.fill()
      g.shadowBlur = 0

      // the slit
      g.fillStyle = '#02020c'
      g.beginPath()
      g.ellipse(px, py, slit, 78 + slit * 0.25, 0, 0, Math.PI * 2)
      g.fill()
      g.shadowColor = C(WHITE)
      g.shadowBlur = 20
      g.strokeStyle = C(WHITE, 0.9)
      g.lineWidth = 1.5
      g.stroke()
      g.shadowBlur = 0

      // a blink now and then, the lid a dark band closing over the eye
      const cycle = s % 9
      if (cycle < 0.22 && phase !== 'offline') {
        const k = Math.sin((cycle / 0.22) * Math.PI)
        g.fillStyle = '#03041a'
        g.fillRect(CX - R - 10, CY - R - 10, R * 2 + 20, (R + 10) * k)
        g.fillRect(CX - R - 10, CY + R + 10 - (R + 10) * k, R * 2 + 20, (R + 10) * k)
      }

      // glints on the cornea
      g.fillStyle = 'rgba(255,255,255,.5)'
      g.beginPath()
      g.ellipse(CX - 110, CY - 120, 34, 12, -0.6, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = 'rgba(255,255,255,.22)'
      g.beginPath()
      g.ellipse(CX + 120, CY + 110, 16, 6, -0.6, 0, Math.PI * 2)
      g.fill()
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
            NEXY · SENTIENT OPERATING LAYER · ALL CHANNELS MONITORED · {owner}
          </textPath>
        </text>
        <text className="ey-arc-text" fill={C(PURPLE, 0.95)}>
          <textPath href="#ey-text-b" startOffset="41%">
            LISTENING · LEARNING · WATCHING ·
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
    <div className={`ey ey-${phase}`}>
      <div className="ey-board" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${k})` }}>
        <Eye />
        <Rings owner={owner} />

        <div className="ey-at ey-callout" style={{ left: CX + 300, top: CY - 342 }}>
          <div>SUBJECT: OWNER · {owner} · ACCESS LEVEL Ω</div>
          <em>{STATUS[phase]}{active ? ` · ${active.nombre.toUpperCase()}` : ''}</em>
        </div>

        <div className="ey-frame-top" />
        <div className="ey-frame-bottom" />

        {showBrand && (
          <div className="ey-at" style={{ left: 64, top: 34 }}>
            <div className="ey-title">N.E.X.Y.</div>
            <div className="ey-sub">NEURAL EXECUTIVE · OBSERVING ALL SYSTEMS</div>
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
        <div className="ey-at ey-phrase" style={{ left: CX, top: 822 }}>
          “I SEE EVERYTHING YOU BUILD.”
        </div>
        <button type="button" className="ey-at ey-hint" style={{ left: CX, top: 884 }} onClick={talk}>
          SAY “HEY NEXY” · [SPACE] TO TALK · [G] HANDS · [V] VOICE{voice ? `: ${voice.replace(/\(.*?\)/g, '').trim().toUpperCase()}` : ''}
        </button>
      </div>
    </div>
  )
}
