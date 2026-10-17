import { useEffect, useMemo, useRef, useState } from 'react'
import { clock, usePlayhead } from './api'
import { dropRange, keepRange, reelTime } from './edits'
import { player } from './player'
import type { Edit, Piece, ProjectView } from './types'

/**
 * The timeline: the reel as tracks (picture with its sound, captions, title
 * and text, music) on the reel's clock, and above it each original recording
 * with what the edit keeps lit and what it cuts dimmed.
 *
 * Drag a piece's edge to trim it or bring back what was cut beside it, click
 * a piece to select it, drag a text to move it, click a dimmed stretch of the
 * original to put it back.
 */

const COLOURS = ['#7c5cff', '#16b5a8', '#e7883c', '#d64c8c', '#4f8ef7', '#9bc53d']

type Drag = { kind: 'trim'; index: number; side: 'l' | 'r'; x0: number; delta: number } | { kind: 'text'; index: number; x0: number; delta: number } | { kind: 'scrub' }

function Wave({ peaks, from, to, perSecond, width, height }: { peaks: number[]; from: number; to: number; perSecond: number; width: number; height: number }) {
  const path = useMemo(() => {
    if (!peaks.length || width < 2) return ''
    const a = Math.floor(from * perSecond)
    const b = Math.max(a + 1, Math.ceil(to * perSecond))
    const n = Math.min(b - a, Math.max(2, Math.floor(width / 2)))
    let d = ''
    for (let i = 0; i < n; i++) {
      const s = peaks.slice(a + Math.floor(((b - a) * i) / n), a + Math.floor(((b - a) * (i + 1)) / n) + 1)
      const v = s.length ? Math.max(...s) : 0
      const x = (i / (n - 1)) * width
      const h = Math.max(1, v * height * 0.9)
      d += `M${x.toFixed(1)} ${((height - h) / 2).toFixed(1)}v${h.toFixed(1)}`
    }
    return d
  }, [peaks, from, to, perSecond, width, height])
  return (
    <svg className="wave" width={width} height={height}>
      <path d={path} />
    </svg>
  )
}

function Playhead({ pps }: { pps: number }) {
  const t = usePlayhead((s) => s.t)
  return <div className="playhead" style={{ left: t * pps }} />
}

export function Timeline({ view, waves, selected, onSelect, onEdit }: { view: ProjectView; waves: Record<number, number[]>; selected: number | null; onSelect: (i: number | null) => void; onEdit: (c: Partial<Edit>) => void }) {
  const { plan, proyecto } = view
  const box = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(800)
  const [zoom, setZoom] = useState(1)
  const [drag, setDrag] = useState<Drag | null>(null)
  const pps = Math.max(8, ((fit - 16) / Math.max(1, plan.length)) * zoom)
  const width = Math.max(fit - 4, plan.length * pps + 12)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setFit(el.clientWidth - 24))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Follow the playhead while playing.
  useEffect(
    () =>
      usePlayhead.subscribe((s) => {
        const el = box.current
        if (!el || !s.playing) return
        const x = s.t * pps
        if (x > el.scrollLeft + el.clientWidth - 60 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 60)
      }),
    [pps],
  )

  const timeAt = (clientX: number) => {
    const el = box.current!
    return Math.max(0, (clientX - el.getBoundingClientRect().left + el.scrollLeft - 12) / pps)
  }

  useEffect(() => {
    if (!drag) return
    const move = (e: MouseEvent) => {
      if (drag.kind === 'scrub') return player.seek(timeAt(e.clientX))
      setDrag({ ...drag, delta: (e.clientX - drag.x0) / pps })
    }
    const up = () => {
      if (drag.kind === 'trim' && Math.abs(drag.delta) > 0.03) {
        const p = plan.pieces[drag.index]!
        const src = proyecto.fuentes[p.source]!
        const f = p.source + 1
        const d = drag.delta
        if (drag.side === 'l') onEdit(d > 0 ? dropRange(plan.edit, { fuente: f, inicio: p.start, fin: Math.min(p.end, p.start + d) }) : keepRange(plan.edit, { fuente: f, inicio: Math.max(0, p.start + d), fin: p.start }))
        else onEdit(d < 0 ? dropRange(plan.edit, { fuente: f, inicio: Math.max(p.start, p.end + d), fin: p.end }) : keepRange(plan.edit, { fuente: f, inicio: p.end, fin: Math.min(src.duration, p.end + d) }))
      }
      if (drag.kind === 'text' && Math.abs(drag.delta) > 0.02) {
        const textos = plan.edit.textos.map((tx, i) => {
          if (i !== drag.index) return tx
          const len = tx.fin - tx.inicio
          const inicio = Math.max(0, Math.min(plan.length - len, tx.inicio + drag.delta))
          return { ...tx, inicio: Number(inicio.toFixed(2)), fin: Number((inicio + len).toFixed(2)) }
        })
        onEdit({ textos })
      }
      setDrag(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [drag, pps, plan])

  const step = pps > 120 ? 0.5 : pps > 40 ? 1 : pps > 15 ? 5 : 10
  const ticks = Array.from({ length: Math.floor(plan.length / step) + 1 }, (_, i) => i * step)
  const pieceStyle = (p: Piece, i: number) => {
    let left = p.at * pps
    let w = (p.end - p.start) * pps
    if (drag?.kind === 'trim' && drag.index === i) {
      if (drag.side === 'l') {
        left += drag.delta * pps
        w -= drag.delta * pps
      } else w += drag.delta * pps
    }
    return { left, width: Math.max(2, w), '--c': COLOURS[p.source % COLOURS.length] } as React.CSSProperties
  }

  const tit = plan.style.titulo

  return (
    <div className="timeline">
      <div className="timeline-bar">
        <span className="label">Línea de tiempo</span>
        <span className="muted small">
          {plan.pieces.length} cortes · {clock(plan.length)} de {clock(plan.total)} grabados
        </span>
        <div className="spacer" />
        <span className="muted small">Zoom</span>
        <input type="range" min={1} max={12} step={0.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
      </div>

      <div className="originals">
        {proyecto.fuentes.map((src, k) => {
          const mine = plan.pieces.filter((p) => p.source === k)
          const W = fit
          const sx = W / Math.max(1, src.duration)
          return (
            <div
              key={src.file}
              className="original"
              title="Original: lo encendido queda en el reel; haz clic en lo apagado para recuperarlo"
              onClick={(e) => {
                const x = (e.clientX - e.currentTarget.getBoundingClientRect().left) / sx
                const at = reelTime(plan.pieces, k, x)
                if (at !== null) return player.seek(at)
                const before = [...mine].reverse().find((p) => p.end <= x)
                const after = mine.find((p) => p.start > x)
                onEdit(keepRange(plan.edit, { fuente: k + 1, inicio: before?.end ?? 0, fin: after?.start ?? src.duration }))
              }}
            >
              <span className="original-label">Original {proyecto.fuentes.length > 1 ? k + 1 : ''}</span>
              <Wave peaks={waves[k] ?? []} from={0} to={src.duration} perSecond={25} width={W} height={34} />
              {mine.map((p, i) => (
                <div key={i} className="original-kept" style={{ left: p.start * sx, width: Math.max(1, (p.end - p.start) * sx), background: COLOURS[k % COLOURS.length] }} />
              ))}
            </div>
          )
        })}
      </div>

      <div className="tracks-scroll" ref={box}>
        <div className="tracks" style={{ width }}>
          <div
            className="ruler"
            onMouseDown={(e) => {
              player.pause()
              player.seek(timeAt(e.clientX))
              setDrag({ kind: 'scrub' })
            }}
          >
            {ticks.map((t) => (
              <span key={t} className="tick" style={{ left: t * pps }}>
                {Number.isInteger(t) ? clock(t).replace(/\.0$/, '') : ''}
              </span>
            ))}
          </div>

          <div className="track track-video" onMouseDown={(e) => e.target === e.currentTarget && (onSelect(null), player.seek(timeAt(e.clientX)))}>
            <span className="track-name">🎬 Video</span>
            {plan.pieces.map((p, i) => (
              <div
                key={`${p.source}-${p.start}`}
                className={`clip ${selected === i ? 'selected' : ''}`}
                style={pieceStyle(p, i)}
                onMouseDown={(e) => {
                  onSelect(i)
                  player.seek(timeAt(e.clientX))
                }}
                title={`Corte ${i + 1}: ${clock(p.start)}–${clock(p.end)} del original${p.zoom > 1.001 ? ` · zoom ${p.zoom.toFixed(2)}×` : ''}`}
              >
                <Wave peaks={waves[p.source] ?? []} from={p.start} to={p.end} perSecond={25} width={Math.max(2, (p.end - p.start) * pps)} height={44} />
                {p.zoom > 1.001 && <span className="clip-zoom">🔍</span>}
                <span
                  className="handle l"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    onSelect(i)
                    setDrag({ kind: 'trim', index: i, side: 'l', x0: e.clientX, delta: 0 })
                  }}
                />
                <span
                  className="handle r"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    onSelect(i)
                    setDrag({ kind: 'trim', index: i, side: 'r', x0: e.clientX, delta: 0 })
                  }}
                />
              </div>
            ))}
          </div>

          <div className="track track-captions" onMouseDown={(e) => player.seek(timeAt(e.clientX))}>
            <span className="track-name">💬 Subtítulos</span>
            {plan.style.subtitulos.activo &&
              plan.phrases.map((ph, i) => (
                <div key={i} className="caption" style={{ left: ph.start * pps, width: Math.max(2, (ph.end - ph.start) * pps) }}>
                  {ph.words.map((w) => w.text).join(' ')}
                </div>
              ))}
          </div>

          <div className="track track-title">
            {tit.activo && plan.edit.titulo && (
              <div className="text-block hook" style={{ left: 0, width: Math.min(tit.segundos, plan.length) * pps }} title="Título gancho">
                {plan.edit.titulo}
              </div>
            )}
          </div>

          <div className="track track-text">
            <span className="track-name">🔤 Texto</span>
            {plan.edit.textos.map((tx, i) => {
              const off = drag?.kind === 'text' && drag.index === i ? drag.delta : 0
              return (
                <div
                  key={i}
                  className="text-block"
                  style={{ left: (tx.inicio + off) * pps, width: Math.max(4, (tx.fin - tx.inicio) * pps) }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setDrag({ kind: 'text', index: i, x0: e.clientX, delta: 0 })
                  }}
                  title="Arrastra para moverlo"
                >
                  {tx.texto}
                </div>
              )
            })}
          </div>

          <div className="track track-music">
            <span className="track-name">🎵 Música</span>
            {plan.edit.musica && (
              <div className="music-block" style={{ left: 0, width: plan.length * pps }}>
                {plan.edit.musica.split('/').pop()} · {Math.round(plan.style.musica.volumen * 100)}%{plan.style.musica.ducking ? ' · baja cuando hablas' : ''}
              </div>
            )}
          </div>

          <Playhead pps={pps} />
        </div>
      </div>
    </div>
  )
}
