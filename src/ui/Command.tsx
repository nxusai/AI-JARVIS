import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { useStore, type Phase } from '../store'
import { useFeed, type Feed } from './feed'
import './command.css'

/**
 * N.E.X.Y. V2 — the command deck, drawn to the owner's reference.
 *
 * The whole deck is laid out on one 1672×941 artboard (the reference's own
 * size) and scaled to the window, so it looks the same on a laptop and on
 * the big monitor. The reactor at its centre is drawn here — black glass lens,
 * an X of metal struts, electric rings, the energy beam and the spray of light
 * — and answers the voice and the phase.
 *
 * Every number on it is live: the systems are the bridge's connectors, the
 * matrix counts the tasks and tool calls Nexy actually ran today, the signal
 * is the microphone and a measured round trip to the bridge, and the world
 * model is the brands and team she works with.
 */

const W = 1672
const H = 941
const CX = 836
const CY = 428

const PHASE_LABEL: Record<Phase, string> = {
  offline: 'SYSTEM OFFLINE',
  boot: 'INITIALISING',
  dormant: 'SYSTEM ONLINE',
  waking: 'SYSTEM ONLINE',
  listening: 'LISTENING',
  thinking: 'PROCESSING',
  tooling: 'ACCESSING SYSTEMS',
  speaking: 'RESPONDING',
}

const CYAN = '0,240,230'
const BLUE = '40,140,255'
const RED = '255,45,60'

/* ---------------------------------------------------------------- helpers */

function seeded(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

/** A canvas redrawn every frame at the screen's pixel density. */
function useCanvas(draw: (g: CanvasRenderingContext2D, w: number, h: number, t: number) => void) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const drawRef = useRef(draw)
  useEffect(() => {
    drawRef.current = draw
  })
  useEffect(() => {
    const c = ref.current
    const g = c?.getContext('2d')
    if (!c || !g) return
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

/** The voice level, eased, read without re-rendering React. */
const eased = { v: 0 }
function level() {
  eased.v += (useStore.getState().level - eased.v) * 0.15
  return eased.v
}

/* ------------------------------------------------------------- the frame */

/** The angular chrome round the whole screen, its neon strips and red lights. */
function Chrome() {
  const blue = 'rgba(40,150,255,.95)'
  const cyan = 'rgba(0,240,230,.8)'
  const metal = 'url(#cx-plate)'
  return (
    <svg className="cx-chrome" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="cx-plate" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2229" />
          <stop offset="0.5" stopColor="#2c3640" />
          <stop offset="1" stopColor="#0c1015" />
        </linearGradient>
        <filter id="cx-neon" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* top: the notch the logo sits in, and the chevrons running down to the reactor */}
      <path d="M560 0 L640 70 L760 70 L790 100 L882 100 L912 70 L1032 70 L1112 0 Z" fill={metal} opacity="0.95" />
      <path d="M640 70 L760 70 L790 100 L882 100 L912 70 L1032 70" fill="none" stroke={cyan} strokeWidth="1.5" filter="url(#cx-neon)" opacity="0.7" />
      <path d="M598 0 L700 110 L740 190" fill="none" stroke={blue} strokeWidth="4" filter="url(#cx-neon)" />
      <path d="M1074 0 L972 110 L932 190" fill="none" stroke={blue} strokeWidth="4" filter="url(#cx-neon)" />
      <path d="M520 0 L650 150 L600 230" fill="none" stroke="#2a3540" strokeWidth="18" opacity="0.9" />
      <path d="M1152 0 L1022 150 L1072 230" fill="none" stroke="#2a3540" strokeWidth="18" opacity="0.9" />

      {/* bottom: the dock's housing and the chevrons up into the reactor */}
      <path d="M470 941 L560 790 L700 760 L972 760 L1112 790 L1202 941 Z" fill={metal} opacity="0.92" />
      <path d="M560 790 L700 760 L972 760 L1112 790" fill="none" stroke={cyan} strokeWidth="1.5" filter="url(#cx-neon)" opacity="0.8" />
      <path d="M690 740 L640 690" stroke={blue} strokeWidth="4" filter="url(#cx-neon)" />
      <path d="M982 740 L1032 690" stroke={blue} strokeWidth="4" filter="url(#cx-neon)" />
      <path d="M600 941 L660 840" stroke={blue} strokeWidth="3" filter="url(#cx-neon)" opacity="0.8" />
      <path d="M1072 941 L1012 840" stroke={blue} strokeWidth="3" filter="url(#cx-neon)" opacity="0.8" />

      {/* the < and > frames either side of the reactor */}
      <path d="M520 150 L430 428 L520 706" fill="none" stroke="#25303a" strokeWidth="22" opacity="0.95" />
      <path d="M1152 150 L1242 428 L1152 706" fill="none" stroke="#25303a" strokeWidth="22" opacity="0.95" />
      <path d="M526 160 L440 428 L526 696" fill="none" stroke={blue} strokeWidth="2" filter="url(#cx-neon)" opacity="0.8" />
      <path d="M1146 160 L1232 428 L1146 696" fill="none" stroke={blue} strokeWidth="2" filter="url(#cx-neon)" opacity="0.8" />
      <path d="M484 260 L462 330 M462 526 L484 596" stroke={blue} strokeWidth="5" filter="url(#cx-neon)" />
      <path d="M1188 260 L1210 330 M1210 526 L1188 596" stroke={blue} strokeWidth="5" filter="url(#cx-neon)" />

      {/* outer border with bevelled corners */}
      <path
        d="M30 10 H520 M1152 10 H1642 L1662 30 V911 L1642 931 H1220 M452 931 H30 L10 911 V30 Z"
        fill="none"
        stroke="rgba(0,200,230,.35)"
        strokeWidth="1.5"
      />
      <path d="M10 140 L10 30 L30 10 L200 10" fill="none" stroke={cyan} strokeWidth="2" filter="url(#cx-neon)" />
      <path d="M1662 140 L1662 30 L1642 10 L1472 10" fill="none" stroke={cyan} strokeWidth="2" filter="url(#cx-neon)" />
      <path d="M10 800 L10 911 L30 931 L200 931" fill="none" stroke={cyan} strokeWidth="2" filter="url(#cx-neon)" />
      <path d="M1662 800 L1662 911 L1642 931 L1472 931" fill="none" stroke={cyan} strokeWidth="2" filter="url(#cx-neon)" />

      {/* diagonal slashes in the lower corners, as on the reference */}
      <path d="M260 800 L360 700 M300 800 L400 700 M420 941 L520 840" stroke="rgba(0,200,230,.25)" strokeWidth="1.5" />
      <path d="M1412 800 L1312 700 M1372 800 L1272 700 M1252 941 L1152 840" stroke="rgba(0,200,230,.25)" strokeWidth="1.5" />

      {/* red edge lights */}
      <rect x="7" y="320" width="5" height="64" fill={`rgb(${RED})`} filter="url(#cx-neon)" />
      <rect x="1660" y="300" width="5" height="64" fill={`rgb(${RED})`} filter="url(#cx-neon)" />
      <rect x="560" y="840" width="4" height="26" transform="rotate(30 562 853)" fill={`rgb(${RED})`} filter="url(#cx-neon)" />
      <rect x="1108" y="840" width="4" height="26" transform="rotate(-30 1110 853)" fill={`rgb(${RED})`} filter="url(#cx-neon)" />
    </svg>
  )
}

/* ----------------------------------------------------------- the reactor */

/** Points of the light spray, fixed so the pattern holds still frame to frame. */
const SPRAY = (() => {
  const r = seeded(77)
  const out: Array<{ a: number; d: number; s: number; o: number; band: number }> = []
  // Four diagonal plumes, denser near the ring, plus a loose halo.
  for (let i = 0; i < 5200; i++) {
    const band = Math.floor(r() * 4)
    const base = Math.PI / 4 + (band * Math.PI) / 2
    // a tight core to each plume with a looser fringe
    const spread = (r() - 0.5) * (r() < 0.6 ? 0.32 : 0.9)
    out.push({ a: base + spread, d: 270 + Math.pow(r(), 0.85) * 600, s: 0.8 + r() * 2.2, o: r(), band })
  }
  for (let i = 0; i < 1400; i++) out.push({ a: r() * Math.PI * 2, d: 250 + r() * 560, s: 0.6 + r() * 1.4, o: r() * 0.7, band: -1 })
  return out
})()

const BOLTS = (() => {
  const r = seeded(5)
  // mostly along the four plumes, like the reference
  return Array.from({ length: 34 }, (_, i) => ({ a: Math.PI / 4 + ((i % 4) * Math.PI) / 2 + (r() - 0.5) * 0.7, len: 160 + r() * 380, seed: Math.floor(r() * 1e6) }))
})()

/** The off-screen layer the spray's glow is drawn into. */
const haze: { c?: HTMLCanvasElement } = {}

/** Light, electricity and the beam — everything that moves round the reactor. */
function Energy() {
  const ref = useCanvas((g, w, h, t) => {
    const k = w / W
    g.save()
    g.scale(k, h / H)
    const lvl = level()
    const phase = useStore.getState().phase
    const busy = phase === 'thinking' || phase === 'tooling' ? 1 : 0
    g.globalCompositeOperation = 'lighter'

    // soft glow behind everything
    const glow = g.createRadialGradient(CX, CY, 80, CX, CY, 520)
    glow.addColorStop(0, `rgba(${CYAN},${0.2 + lvl * 0.25})`)
    glow.addColorStop(0.5, `rgba(${CYAN},0.06)`)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = glow
    g.fillRect(0, 0, W, H)

    // the spray, drifting outward. The glow is the brighter sparks drawn into
    // a small off-screen layer and laid back over blurred, once per frame.
    const glowLayer = (haze.c ??= document.createElement('canvas'))
    if (glowLayer.width !== W / 4) {
      glowLayer.width = W / 4
      glowLayer.height = H / 4
    }
    const hg = glowLayer.getContext('2d')!
    hg.setTransform(1, 0, 0, 1, 0, 0)
    hg.clearRect(0, 0, glowLayer.width, glowLayer.height)
    hg.globalCompositeOperation = 'lighter'
    hg.scale(0.25, 0.25)
    const sprayPass = (blur: boolean) => {
    const target = blur ? hg : g
    for (const p of SPRAY) {
      if (blur && p.o < 0.5) continue
      const drift = ((t * (12 + busy * 30) + p.o * 400) % 400) / 400
      const d = p.d + drift * 60
      const x = CX + Math.cos(p.a) * d * 1.3
      const y = CY + Math.sin(p.a) * d * 0.78
      if (x < 0 || x > W || y < 0 || y > H) continue
      const fade = 1 - Math.min(1, (d - 260) / 700)
      const a = Math.min(1, (0.35 + p.o * 0.65) * fade * (0.95 + lvl))
      target.fillStyle = p.o > 0.985 ? `rgba(255,255,255,${a})` : `rgba(${CYAN},${a})`
      const sz = blur ? p.s * 4 : p.s
      target.fillRect(x - sz / 2, y - sz / 2, sz, sz)
    }
    }
    sprayPass(true)
    g.save()
    g.filter = 'blur(6px)'
    g.globalAlpha = 0.9
    g.drawImage(glowLayer, 0, 0, W, H)
    g.restore()
    sprayPass(false)

    // electric bolts leaving the ring
    g.lineWidth = 1
    for (const b of BOLTS) {
      const r = seeded(b.seed + Math.floor(t * 8))
      const flick = r()
      if (flick > 0.55 + busy * 0.3 + lvl * 0.3) continue
      g.strokeStyle = `rgba(${CYAN},${0.35 + r() * 0.55})`
      g.beginPath()
      let x = CX + Math.cos(b.a) * 255
      let y = CY + Math.sin(b.a) * 255
      g.moveTo(x, y)
      const steps = 10
      for (let s = 1; s <= steps; s++) {
        const d = 255 + (b.len * s) / steps
        x = CX + Math.cos(b.a + (r() - 0.5) * 0.08) * d * 1.1 + (r() - 0.5) * 10
        y = CY + Math.sin(b.a + (r() - 0.5) * 0.08) * d * 0.85 + (r() - 0.5) * 10
        g.lineTo(x, y)
      }
      g.stroke()
    }

    // the beam: a waveform of bars either side of the ring, alive with the voice
    for (const side of [-1, 1]) {
      for (let i = 0; i < 70; i++) {
        const x = CX + side * (262 + i * 5.6)
        const env = Math.sin((i / 70) * Math.PI) ** 0.7
        const amp = (6 + Math.abs(Math.sin(i * 0.9 + t * 7) * Math.cos(i * 0.37 - t * 3)) * (26 + lvl * 90)) * env
        g.fillStyle = `rgba(${CYAN},${0.35 + env * 0.6})`
        g.fillRect(x, CY - amp / 2, 2.4, amp)
      }
      const line = g.createLinearGradient(CX, 0, CX + side * 680, 0)
      line.addColorStop(0, `rgba(${CYAN},0.9)`)
      line.addColorStop(1, `rgba(${CYAN},0)`)
      g.fillStyle = line
      g.fillRect(side > 0 ? CX : CX - 680, CY - 1, 680, 2)
    }
    // crosshair
    g.fillStyle = `rgba(${CYAN},0.35)`
    g.fillRect(CX - 0.5, 90, 1, CY - 210)
    g.fillRect(CX - 0.5, CY + 120, 1, 220)

    // red ticks round the rings
    g.globalCompositeOperation = 'source-over'
    const rr = seeded(9)
    for (let i = 0; i < 16; i++) {
      const a = rr() * Math.PI * 2
      const d = 300 + rr() * 160
      g.fillStyle = `rgba(${RED},${0.55 + rr() * 0.4})`
      g.save()
      g.translate(CX + Math.cos(a) * d, CY + Math.sin(a) * d * 0.95)
      g.rotate(a + Math.PI / 2)
      g.fillRect(-1.5, -9, 3, 18)
      g.restore()
    }
    g.restore()
  })
  return <canvas ref={ref} className="cx-layer" />
}

/** The machined parts of the reactor: plates, rings, the X and the lens. */
function Reactor() {
  const ref = useRef<SVGGElement | null>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const l = eased.v
      ref.current?.setAttribute('transform', `translate(${CX} ${CY}) scale(${(1 + l * 0.035).toFixed(4)}) translate(${-CX} ${-CY})`)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const P = (r: number, a: number) => `${(CX + Math.cos(a) * r).toFixed(1)},${(CY + Math.sin(a) * r).toFixed(1)}`
  const plates = Array.from({ length: 12 }, (_, i) => i)
  const ticks = Array.from({ length: 144 }, (_, i) => i)

  return (
    <svg className="cx-layer" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="cx-steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3c4650" />
          <stop offset="0.35" stopColor="#8e9aa5" />
          <stop offset="0.5" stopColor="#4a545e" />
          <stop offset="1" stopColor="#151a1f" />
        </linearGradient>
        <linearGradient id="cx-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#222a31" />
          <stop offset="1" stopColor="#0a0d11" />
        </linearGradient>
        <radialGradient id="cx-glass" cx="0.42" cy="0.36" r="0.75">
          <stop offset="0" stopColor="#3a4248" />
          <stop offset="0.18" stopColor="#11161a" />
          <stop offset="0.7" stopColor="#020304" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <filter id="cx-bloom" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="cx-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="cx-zap">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3">
            <animate attributeName="seed" values="1;9;3;7;1" dur="0.6s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
      </defs>

      <g ref={ref}>
        {/* outer armour: dark plates with lit seams */}
        <g className="cx-turn-slow">
          {plates.map((i) => {
            const a0 = (i / 12) * Math.PI * 2 + 0.05
            const a1 = ((i + 1) / 12) * Math.PI * 2 - 0.05
            return (
              <path
                key={i}
                d={`M${P(330, a0)} A330 330 0 0 1 ${P(330, a1)} L${P(304, a1)} A304 304 0 0 0 ${P(304, a0)} Z`}
                fill="url(#cx-dark)"
                opacity="0.85"
                stroke="rgba(60,140,255,.55)"
                strokeWidth="1.2"
              />
            )
          })}
        </g>
        {/* blue light strips on the diagonals of the armour */}
        {[45, 135, 225, 315].map((d) => (
          <g key={d} transform={`rotate(${d} ${CX} ${CY})`}>
            <rect x={CX - 3} y={CY - 332} width="6" height="30" fill={`rgb(${BLUE})`} filter="url(#cx-soft)" />
          </g>
        ))}
        {[0, 90, 180, 270].map((d) => (
          <g key={d} transform={`rotate(${d + 22} ${CX} ${CY})`}>
            <rect x={CX - 2} y={CY - 330} width="4" height="22" fill={`rgb(${BLUE})`} opacity="0.85" filter="url(#cx-soft)" />
          </g>
        ))}

        {/* the bright electric ring */}
        <circle cx={CX} cy={CY} r="278" fill="none" stroke={`rgb(${CYAN})`} strokeWidth="5" filter="url(#cx-bloom)" className="cx-pulse" />
        <circle cx={CX} cy={CY} r="270" fill="none" stroke={`rgba(${CYAN},.85)`} strokeWidth="2.5" filter="url(#cx-zap)" />
        <circle cx={CX} cy={CY} r="262" fill="none" stroke={`rgba(${CYAN},.5)`} strokeWidth="1.2" filter="url(#cx-zap)" />

        {/* fine rings and ticks */}
        <g className="cx-turn">
          <circle cx={CX} cy={CY} r="246" fill="none" stroke={`rgba(${CYAN},.55)`} strokeWidth="1" strokeDasharray="70 10 4 10" />
        </g>
        <g className="cx-turn-back">
          <circle cx={CX} cy={CY} r="232" fill="none" stroke={`rgba(${CYAN},.4)`} strokeWidth="6" strokeDasharray="1.5 6" />
        </g>
        {ticks.map((i) => {
          const a = (i / 144) * Math.PI * 2
          const long = i % 12 === 0
          return (
            <line
              key={i}
              x1={CX + Math.cos(a) * 205}
              y1={CY + Math.sin(a) * 205}
              x2={CX + Math.cos(a) * (long ? 222 : 213)}
              y2={CY + Math.sin(a) * (long ? 222 : 213)}
              stroke={`rgba(${CYAN},${long ? 0.9 : 0.4})`}
              strokeWidth={long ? 1.8 : 1}
            />
          )
        })}
        <g className="cx-turn-fast">
          <circle cx={CX} cy={CY} r="190" fill="none" stroke={`rgba(${CYAN},.6)`} strokeWidth="1.5" strokeDasharray="140 30 20 30" filter="url(#cx-soft)" />
        </g>
        <circle cx={CX} cy={CY} r="168" fill="none" stroke={`rgba(${CYAN},.25)`} strokeWidth="1" />
        <circle cx={CX} cy={CY} r="150" fill="none" stroke={`rgba(${CYAN},.3)`} strokeWidth="1" strokeDasharray="3 5" />

        {/* the X: four machined struts from the lens out to the ring */}
        {[45, 135, 225, 315].map((d) => (
          <g key={d} transform={`rotate(${d} ${CX} ${CY})`}>
            <polygon
              points={`${CX - 30},${CY - 252} ${CX + 30},${CY - 252} ${CX + 24},${CY - 122} ${CX - 24},${CY - 122}`}
              fill="url(#cx-steel)"
              stroke={`rgb(${CYAN})`}
              strokeWidth="3"
              filter="url(#cx-bloom)"
              opacity="0.92"
            />
            <polygon points={`${CX - 22},${CY - 244} ${CX - 6},${CY - 244} ${CX - 4},${CY - 130} ${CX - 18},${CY - 130}`} fill="rgba(160,255,250,.14)" />
            <line x1={CX + 14} y1={CY - 240} x2={CX + 12} y2={CY - 134} stroke="rgba(0,0,0,.45)" strokeWidth="3" />
          </g>
        ))}

        {/* the bright ring round the lens */}
        <circle cx={CX} cy={CY} r="120" fill="none" stroke={`rgb(${CYAN})`} strokeWidth="5" filter="url(#cx-bloom)" className="cx-pulse" />
        {/* the black glass lens */}
        <circle cx={CX} cy={CY} r="112" fill="url(#cx-glass)" />
        <circle cx={CX} cy={CY} r="112" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />
        <ellipse cx={CX - 34} cy={CY - 58} rx="56" ry="24" fill="rgba(255,255,255,.13)" transform={`rotate(-28 ${CX - 34} ${CY - 58})`} />
        <path d={`M ${CX - 92} ${CY - 20} A 95 95 0 0 1 ${CX - 30} ${CY - 90}`} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3" strokeLinecap="round" />
        <path d={`M ${CX + 70} ${CY + 70} A 100 100 0 0 1 ${CX + 22} ${CY + 98}`} fill="none" stroke="rgba(120,220,255,.25)" strokeWidth="2.5" strokeLinecap="round" />
        {/* its pupil */}
        <circle cx={CX} cy={CY} r="40" fill="none" stroke={`rgb(${CYAN})`} strokeWidth="3.5" filter="url(#cx-bloom)" className="cx-pupil" />
        <circle cx={CX} cy={CY} r="30" fill="rgba(0,0,0,.6)" />
      </g>
    </svg>
  )
}

/* ---------------------------------------------------------------- panels */

/** The double frame every panel sits in: bevelled outer line, rounded inner box, lit segments. */
function Frame({ w, h, children, className = '' }: { w: number; h: number; children: ReactNode; className?: string }) {
  const b = 22
  return (
    <div className={`cx-frame ${className}`} style={{ width: w, height: h }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="cx-frame-svg">
        <path
          d={`M${b} 1 H${w - b} L${w - 1} ${b} V${h - b} L${w - b} ${h - 1} H${b} L1 ${h - b} V${b} Z`}
          fill="rgba(2,10,16,.78)"
          stroke="rgba(0,200,230,.45)"
          strokeWidth="1.4"
        />
        <rect x="14" y="14" width={w - 28} height={h - 28} rx="10" fill="none" stroke="rgba(0,220,240,.28)" strokeWidth="1" />
        <rect x={w / 2 - 34} y="0" width="68" height="3" fill={`rgb(${CYAN})`} className="cx-seg" />
        <rect x={w / 2 - 34} y={h - 3} width="68" height="3" fill={`rgb(${CYAN})`} className="cx-seg" />
        <path d={`M1 ${h - b - 60} V${h - b - 20}`} stroke={`rgb(${CYAN})`} strokeWidth="3" className="cx-seg" />
        <path d={`M${w - 1} ${b + 20} V${b + 60}`} stroke={`rgb(${CYAN})`} strokeWidth="3" className="cx-seg" />
      </svg>
      <div className="cx-frame-body">{children}</div>
    </div>
  )
}

function Head({ title, tag }: { title: string; tag: string }) {
  return (
    <div className="cx-head">
      <span className="cx-tab" />
      <span className="cx-head-title">{title}</span>
      <span className="cx-head-tag">
        {tag} <i />
      </span>
    </div>
  )
}

/* systems */

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
  exa: 'Web',
  serper: 'Web',
  playwright: 'Browser',
  android: 'Android',
}

/** The order on the reference: these first, the web last. */
const ORDER = ['google-calendar', 'gmail', 'notion', 'higgsfield', 'metricool', 'meta-ads', 'canva', 'zoho']

const ICON: Record<string, ReactElement> = {
  'google-calendar': (
    <svg viewBox="0 0 24 24" className="cx-ico-line"><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4M9 15l2 2 4-4" /></svg>
  ),
  gmail: (
    <svg viewBox="0 0 24 24" className="cx-ico-line"><rect x="2.5" y="5" width="19" height="14" rx="1.5" /><path d="M3 5.8 12 13l9-7.2M3 18.5l7-6M21 18.5l-7-6" /></svg>
  ),
  notion: (
    <svg viewBox="0 0 24 24"><path d="M4 4.5 15.5 3.5 20 6.8V20.5H6.5L4 18z" fill="#fff" /><path d="M8.5 8.5v9M8.5 8.5l6.5 9v-9" stroke="#000" strokeWidth="2.2" fill="none" strokeLinejoin="round" /></svg>
  ),
  higgsfield: (
    <svg viewBox="0 0 24 24" className="cx-ico-line cx-ico-bold"><circle cx="12" cy="6.5" r="3" /><circle cx="6" cy="16.5" r="3" /><circle cx="18" cy="16.5" r="3" /><path d="M10.5 9 7.5 14M13.5 9l3 5M9 16.5h6" /></svg>
  ),
  metricool: (
    <svg viewBox="0 0 24 24"><rect x="3" y="14" width="4.5" height="7" fill="#fff" /><rect x="9.75" y="9" width="4.5" height="12" fill="#fff" /><rect x="16.5" y="4" width="4.5" height="17" fill="#fff" /></svg>
  ),
  'meta-ads': (
    <svg viewBox="0 0 24 24"><path d="M2.5 15.5c0-4.5 2.3-8 5-8 4 0 6.2 9 9.6 9 1.9 0 3.4-1.7 3.4-4.4 0-3.3-1.7-5.6-3.9-5.6-3.6 0-5.8 9.5-9.6 9.5-2.6 0-4.5-.3-4.5-.5Z" fill="none" stroke="#1e7bff" strokeWidth="2.6" strokeLinejoin="round" /></svg>
  ),
  canva: (
    <svg viewBox="0 0 24 24"><path d="M18 7.5A7.5 7.5 0 1 0 18 16.5" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" /></svg>
  ),
  zoho: (
    <svg viewBox="0 0 24 24"><path d="M14 2 5 13.5h6.2L9.5 22l9.5-12h-6.4z" fill="#fff" /></svg>
  ),
  elevenlabs: (
    <svg viewBox="0 0 24 24"><rect x="7" y="3.5" width="3.4" height="17" fill="#fff" /><rect x="13.6" y="3.5" width="3.4" height="17" fill="#fff" /></svg>
  ),
  web: (
    <svg viewBox="0 0 24 24" className="cx-ico-line cx-ico-bold"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3.2 3.2 3.2 14.8 0 18M12 3C8.8 6.2 8.8 17.8 12 21M4.5 7.5h15M4.5 16.5h15" /></svg>
  ),
}
const iconFor = (key: string) => ICON[key] ?? (/exa|serper|web|search|playwright|browser/.test(key) ? ICON.web : ICON.web)

const STATE: Record<string, { label: string; tone: 'on' | 'idle' | 'off' }> = {
  connected: { label: 'ONLINE', tone: 'on' },
  pending: { label: 'STANDBY', tone: 'idle' },
  'needs-auth': { label: 'SIGN IN', tone: 'off' },
  failed: { label: 'OFFLINE', tone: 'off' },
  disabled: { label: 'OFF', tone: 'off' },
}

function Systems({ feed }: { feed: Feed }) {
  const fallback = useStore((s) => s.connected)
  const rows = useMemo(() => {
    const list = feed.servers
      .filter((s) => !/^jarvis_/.test(s.name))
      .map((s) => ({ key: s.name, name: NAMES[s.name] ?? s.name.replace(/[-_]/g, ' '), state: STATE[s.status] ?? { label: s.status.toUpperCase(), tone: 'idle' as const } }))
    const named = list.length ? list : fallback.map((n) => ({ key: n.toLowerCase(), name: n, state: STATE.connected }))
    const seen = new Set<string>()
    const rank = (k: string) => {
      const i = ORDER.indexOf(k)
      return i < 0 ? (/exa|serper|web|search/.test(k) ? 8.5 : 50) : i
    }
    return named
      .filter((r) => (seen.has(r.name) ? false : (seen.add(r.name), true)))
      .sort((a, b) => rank(a.key) - rank(b.key))
      .slice(0, 9)
  }, [feed.servers, fallback])
  const allOn = rows.length > 0 && rows.every((r) => r.state.tone === 'on')
  const online = rows.filter((r) => r.state.tone === 'on').length

  return (
    <div className="cx-at" style={{ left: 34, top: 126 }}>
      <Frame w={378} h={560}>
        <Head title="SYSTEMS" tag={allOn ? 'ONLINE' : `${online}/${rows.length} ONLINE`} />
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
      </Frame>
    </div>
  )
}

/* consciousness matrix */

/** Points inside a brain seen from the side: cerebrum, a fold line, cerebellum and stem. */
const BRAIN = (() => {
  const r = seeded(31)
  const pts: Array<{ x: number; y: number; hot: boolean }> = []
  const inside = (x: number, y: number) => {
    const cerebrum = ((x - 0.02) / 0.95) ** 2 + ((y + 0.08) / 0.68) ** 2 < 1 && y < 0.42
    const cerebellum = ((x - 0.42) / 0.33) ** 2 + ((y - 0.45) / 0.22) ** 2 < 1
    const stem = Math.abs(x - 0.18) < 0.09 && y > 0.3 && y < 0.95
    return cerebrum || cerebellum || stem
  }
  while (pts.length < 170) {
    const x = r() * 2 - 1
    const y = r() * 2 - 1
    if (inside(x, y)) pts.push({ x, y, hot: r() > 0.9 })
  }
  return pts
})()

function Brain({ heat }: { heat: number }) {
  const ref = useCanvas((g, w, h, t) => {
    const cx = w / 2
    const cy = h * 0.46
    const s = Math.min(w / 2.1, h / 1.9)
    const pts = BRAIN.map((p, i) => ({ X: cx + p.x * s + Math.sin(t + i) * 0.8, Y: cy + p.y * s + Math.cos(t * 0.9 + i) * 0.8, hot: p.hot, i }))
    g.globalCompositeOperation = 'lighter'
    g.lineWidth = 0.7
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].X - pts[j].X, pts[i].Y - pts[j].Y)
        if (d < s * 0.2) {
          g.strokeStyle = `rgba(${CYAN},${(1 - d / (s * 0.2)) * 0.55})`
          g.beginPath()
          g.moveTo(pts[i].X, pts[i].Y)
          g.lineTo(pts[j].X, pts[j].Y)
          g.stroke()
        }
      }
    for (const p of pts) {
      const fire = p.hot && Math.sin(t * (1.5 + heat * 5) + p.i * 1.7) > 0.4 - heat * 0.8
      g.fillStyle = fire ? `rgb(${RED})` : 'rgb(190,255,250)'
      g.shadowColor = fire ? `rgb(${RED})` : `rgb(${CYAN})`
      g.shadowBlur = fire ? 12 : 6
      g.beginPath()
      g.arc(p.X, p.Y, fire ? 2.6 : 1.5, 0, Math.PI * 2)
      g.fill()
    }
    g.shadowBlur = 0
  })
  return <canvas ref={ref} className="cx-fill" />
}

function Meter({ label, shown, pct }: { label: string; shown: string; pct: number }) {
  return (
    <div className="cx-meter-row">
      <span>{label}</span>
      <b>{shown}</b>
      <i>
        <u style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} />
      </i>
    </div>
  )
}

const today0 = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function Consciousness({ feed }: { feed: Feed }) {
  const phase = useStore((s) => s.phase)
  const mine = feed.tasks.filter((t) => t.startedAt >= today0())
  const running = feed.tasks.filter((t) => t.status === 'running').length
  const finished = mine.filter((t) => t.status !== 'running')
  const ok = finished.filter((t) => t.status === 'done').length
  const steps = mine.reduce((n, t) => n + t.steps.length, 0)
  const rate = finished.length ? Math.round((ok / finished.length) * 100) : 100
  const heat = running ? 1 : phase === 'thinking' || phase === 'tooling' ? 0.8 : phase === 'speaking' ? 0.5 : 0.15
  return (
    <div className="cx-at" style={{ left: 1232, top: 130 }}>
      <Frame w={420} h={262}>
        <Head title="CONSCIOUSNESS MATRIX" tag="LIVE" />
        <div className="cx-row">
          <div className="cx-viz" style={{ width: 200, height: 186 }}>
            <Brain heat={heat} />
          </div>
          <div className="cx-meters">
            <Meter label="TASKS TODAY" shown={String(mine.length)} pct={(mine.length / Math.max(12, mine.length)) * 100} />
            <Meter label="RUNNING" shown={String(running)} pct={(running / 3) * 100} />
            <Meter label="TOOL CALLS" shown={String(steps)} pct={(steps / Math.max(60, steps)) * 100} />
            <Meter label="SUCCESS" shown={`${rate}%`} pct={rate} />
            <Meter label="APPROVALS" shown={String(feed.approvals.length)} pct={(feed.approvals.length / 5) * 100} />
          </div>
        </div>
      </Frame>
    </div>
  )
}

/* signal intelligence */

function Wave() {
  const hist = useRef<number[]>(Array(180).fill(0))
  const ref = useCanvas((g, w, h, t) => {
    hist.current.push(eased.v)
    hist.current.shift()
    const mid = h / 2
    g.globalCompositeOperation = 'lighter'
    const strand = (amp: number, f: number, ph: number, col: string, lw: number) => {
      g.strokeStyle = col
      g.lineWidth = lw
      g.shadowColor = col
      g.shadowBlur = 8
      g.beginPath()
      hist.current.forEach((v, i) => {
        const x = (i / (hist.current.length - 1)) * w
        const env = Math.exp(-(((i / hist.current.length) - 0.48) ** 2) / 0.06)
        const y = mid + (Math.sin(i * f + t * 2.6 + ph) * (0.3 + v * 1.4) + Math.sin(i * f * 2.3 - t * 1.7 + ph) * 0.35) * amp * env
        if (i) g.lineTo(x, y)
        else g.moveTo(x, y)
      })
      g.stroke()
    }
    for (let k = 0; k < 4; k++) strand(h * 0.32, 0.07 + k * 0.012, k * 1.3, `rgba(${CYAN},${0.75 - k * 0.12})`, 1.3)
    strand(h * 0.28, 0.1, 2.2, `rgba(${BLUE},0.7)`, 1.1)
    // red spikes
    for (let k = 0; k < 7; k++) {
      const x = w * (0.3 + 0.06 * k) + Math.sin(t * 2 + k) * 3
      const hh = (0.2 + Math.abs(Math.sin(t * 3 + k * 1.9))) * h * 0.38 * (0.5 + eased.v)
      g.strokeStyle = `rgba(${RED},0.85)`
      g.shadowColor = `rgb(${RED})`
      g.lineWidth = 1.2
      g.beginPath()
      g.moveTo(x, mid - hh)
      g.lineTo(x, mid + hh * 0.4)
      g.stroke()
    }
    g.shadowBlur = 0
  })
  return <canvas ref={ref} className="cx-fill" />
}

const two = (n: number) => String(n).padStart(2, '0')

function Signal({ feed, since }: { feed: Feed; since: number }) {
  const lvl = useStore((s) => s.level)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const up = Math.floor((now - since) / 1000)
  const ext = feed.servers.filter((s) => !/^jarvis_/.test(s.name))
  const on = ext.filter((s) => s.status === 'connected').length
  return (
    <div className="cx-at" style={{ left: 1232, top: 402 }}>
      <Frame w={420} h={178}>
        <Head title="SIGNAL INTELLIGENCE" tag={feed.live ? 'LIVE' : 'LINKING'} />
        <div className="cx-row">
          <div className="cx-viz" style={{ width: 222, height: 104 }}>
            <Wave />
          </div>
          <dl className="cx-kv">
            <dt>INPUT</dt>
            <dd>{Math.round(lvl * 100)}%</dd>
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
      </Frame>
    </div>
  )
}

/* world model */

/** Very rough continents as boxes in (lon, lat) degrees — enough to read as Earth at this size. */
const LAND: Array<[number, number, number, number]> = [
  [-165, -60, 15, 70], [-125, -75, 25, 50], [-100, -80, 10, 25], [-80, -35, -55, 12], // the Americas
  [-10, 40, 36, 70], [-18, 50, -35, 36], [40, 145, 5, 75], [60, 100, 5, 30], [95, 150, -10, 20], // Europe, Africa, Asia
  [113, 154, -40, -12], [-55, -20, 60, 82], // Australia, Greenland
]
const isLand = (lon: number, lat: number) => LAND.some(([a, b, c, d]) => lon >= a && lon <= b && lat >= c && lat <= d)

function Globe({ marks }: { marks: Array<{ lon: number; lat: number; active: boolean; color: string }> }) {
  const dots = useMemo(() => {
    const out: Array<[number, number]> = []
    for (let lat = -70; lat <= 80; lat += 4) for (let lon = -180; lon < 180; lon += 4) if (isLand(lon, lat)) out.push([lon, lat])
    return out
  }, [])
  const ref = useCanvas((g, w, h, t) => {
    const cx = w / 2
    const cy = h / 2
    const R = Math.min(w, h) * 0.42
    const rot = t * 12
    const proj = (lon: number, lat: number) => {
      const L = ((lon + rot) * Math.PI) / 180
      const P = (lat * Math.PI) / 180
      return { x: cx + Math.cos(P) * Math.sin(L) * R, y: cy - Math.sin(P) * R, z: Math.cos(P) * Math.cos(L) }
    }
    const halo = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25)
    halo.addColorStop(0, `rgba(${CYAN},0.12)`)
    halo.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = halo
    g.fillRect(0, 0, w, h)
    g.strokeStyle = `rgba(${CYAN},0.35)`
    g.lineWidth = 0.8
    g.beginPath()
    g.arc(cx, cy, R, 0, Math.PI * 2)
    g.stroke()
    for (const [lon, lat] of dots) {
      const p = proj(lon, lat)
      if (p.z < 0) continue
      g.fillStyle = `rgba(${CYAN},${0.25 + p.z * 0.65})`
      g.fillRect(p.x, p.y, 1.6, 1.6)
    }
    // orbits
    g.strokeStyle = `rgba(${CYAN},0.55)`
    g.beginPath()
    g.ellipse(cx, cy, R * 1.5, R * 0.36, -0.15, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = `rgba(${CYAN},0.3)`
    g.beginPath()
    g.ellipse(cx, cy, R * 1.3, R * 0.55, 0.35, 0, Math.PI * 2)
    g.stroke()
    // a light for each brand, the active one red
    for (const m of marks) {
      const p = proj(m.lon, m.lat)
      if (p.z < 0) continue
      g.fillStyle = m.active ? `rgb(${RED})` : m.color
      g.shadowColor = g.fillStyle as string
      g.shadowBlur = 12
      g.beginPath()
      g.arc(p.x, p.y, m.active ? 3.2 : 2.2, 0, Math.PI * 2)
      g.fill()
    }
    g.shadowBlur = 0
  })
  return <canvas ref={ref} className="cx-fill" />
}

/** Where on the globe each brand's light sits: its home base. */
const HOME: Array<[number, number]> = [[-74, 40.7], [-74.2, 40.9], [-99, 19.4], [-118, 34], [-80, 25.8], [-87.6, 41.9]]

function World({ feed }: { feed: Feed }) {
  const brands = feed.brands
  const active = brands?.marcas.find((b) => b.id === brands.activa)
  const marks = (brands?.marcas ?? []).map((b, i) => ({ lon: HOME[i % HOME.length][0] + i * 6, lat: HOME[i % HOME.length][1] - i * 3, active: b.id === brands?.activa, color: b.color || '#00f0e6' }))
  const zone = (Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop() ?? '').replace(/_/g, ' ')
  const pending = feed.approvals.length
  return (
    <div className="cx-at" style={{ left: 1232, top: 588 }}>
      <Frame w={420} h={212}>
        <Head title="WORLD MODEL" tag={brands ? 'SYNCED' : 'LINKING'} />
        <div className="cx-row">
          <div className="cx-viz" style={{ width: 210, height: 142 }}>
            <Globe marks={marks} />
          </div>
          <dl className="cx-kv cx-kv-loud">
            <dt>ACTIVE BRAND</dt>
            <dd className="cx-hi">{active?.nombre.toUpperCase() ?? '—'}</dd>
            <dt>BRANDS</dt>
            <dd className="cx-hi">{brands?.marcas.length ?? '—'}</dd>
            <dt>AGENTS</dt>
            <dd className="cx-hi">{feed.org?.agents.length ?? '—'}</dd>
            <dt>TIME ZONE</dt>
            <dd className="cx-hi">{zone.toUpperCase()}</dd>
            <dt>APPROVALS</dt>
            <dd className={pending ? 'cx-alert' : 'cx-hi'}>{pending ? `${pending} WAITING` : 'CLEAR'}</dd>
          </dl>
        </div>
      </Frame>
    </div>
  )
}

/* ------------------------------------------------------------ top/bottom */

function NxMark({ h = 40 }: { h?: number }) {
  return (
    <svg viewBox="0 0 70 40" height={h} width={(h * 70) / 40} className="cx-nx">
      <path d="M3 37V3h7l16 21V3h7v34h-6.5L10 15.5V37z" fill="#2aa8ff" />
      <path d="M34 3h8.5l8 11 8-11H67L55 20l13 17h-8.5L50.5 25 42 37h-8.5l12.5-17z" fill="#e9fbff" />
    </svg>
  )
}

function Clock({ phase }: { phase: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(/,/g, '').toUpperCase()
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toUpperCase()
  return (
    <div className="cx-at cx-clock" style={{ left: 1272, top: 50 }}>
      <i className={`cx-dot ${phase === 'offline' ? 'cx-dot-off' : ''}`} />
      <span>{phase}</span>
      <s />
      <span>{date}</span>
      <s />
      <span>{time}</span>
    </div>
  )
}

function Dock() {
  const ref = useCanvas((g, w, h, t) => {
    const lvl = eased.v
    const mid = h / 2
    for (const side of [-1, 1]) {
      // dotted rule
      g.fillStyle = `rgba(${CYAN},0.5)`
      for (let x = 0; x < 230; x += 6) g.fillRect(w / 2 + side * (70 + x) - 1, mid - 1, 2, 2)
      // the bars, tallest towards the middle of each side
      for (let i = 0; i < 46; i++) {
        const x = w / 2 + side * (150 + i * 3.4)
        const env = Math.exp(-(((i - 23) / 11) ** 2))
        const a = (6 + Math.abs(Math.sin(i * 1.3 + t * 8) * Math.cos(i * 0.4 - t * 2.5)) * (18 + lvl * 50)) * env
        g.fillStyle = `rgba(${CYAN},${0.4 + env * 0.6})`
        g.fillRect(x, mid - a / 2, 1.8, a)
      }
    }
  })
  return <canvas ref={ref} className="cx-dock-canvas" />
}

/** Start a turn the same way Space does, for a click on the mic. */
const talk = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }))

/* ------------------------------------------------------------------ deck */

/** Scale of the 1672×941 artboard that fits the window. */
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
  const since = useRef(Date.now()).current
  const k = useFit()
  const hot = phase === 'listening' || phase === 'speaking'

  return (
    <div className={`cx ${hot ? 'cx-hot' : ''}`}>
      <div className="cx-board" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${k})` }}>
        <Energy />
        <Chrome />
        <Reactor />

        <div className="cx-at cx-logo" style={{ left: CX, top: 30 }}>
          <NxMark h={42} />
        </div>

        {showBrand && (
          <div className="cx-at cx-brand" style={{ left: 80, top: 38 }}>
            <div className="cx-title">
              N<em>.</em>E<em>.</em>X<em>.</em>Y<em>.</em> <strong>V2</strong>
            </div>
            <div className="cx-sub">JUST A RATHER VERY INTELLIGENT SYSTEM</div>
          </div>
        )}
        <Clock phase={phase === 'boot' && bootNote ? bootNote : PHASE_LABEL[phase]} />

        {showSystems && <Systems feed={feed} />}
        <Consciousness feed={feed} />
        <Signal feed={feed} since={since} />
        <World feed={feed} />

        <div className="cx-at cx-dock" style={{ left: CX, top: 728 }}>
          <div className="cx-say">SAY “HEY NEXY”</div>
          <Dock />
          <button type="button" className="cx-mic" onClick={talk} aria-label="Hablar con Nexy">
            <svg viewBox="0 0 24 24">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
            </svg>
          </button>
          <div className="cx-keys">
            <kbd>SPACE</kbd> TO TALK
          </div>
          {voice && <div className="cx-voice">G HANDS · V VOICE: {voice.replace(/\(.*?\)/g, '').trim().toUpperCase()}</div>}
        </div>

        <div className="cx-at cx-foot" style={{ left: 18, top: 800 }}>
          <Frame w={410} h={124} className="cx-frame-foot">
            <div className="cx-foot-in">
              <div className="cx-powered">
                <small>POWERED BY</small>
                <b>NXUS</b>
              </div>
              <s />
              <p>
                INTELLIGENCE
                <br />
                ARCHITECTURE
                <br />
                FOR A BRIGHTER TOMORROW
              </p>
            </div>
          </Frame>
        </div>
        <div className="cx-at cx-foot" style={{ left: 1300, top: 800 }}>
          <Frame w={356} h={124} className="cx-frame-foot">
            <div className="cx-foot-in">
              <NxMark h={30} />
              <s />
              <p>
                BUILT BY NXUS
                <br />
                FOR A MORE INTELLIGENT WORLD
              </p>
            </div>
          </Frame>
        </div>
      </div>
    </div>
  )
}
