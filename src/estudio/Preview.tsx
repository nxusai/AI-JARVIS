import { useEffect, useRef } from 'react'
import { clock, mediaUrl, usePlayhead } from './api'
import { drawOverlays, drawPicture } from './draw'
import { player } from './player'
import type { ProjectView } from './types'

/**
 * The live player: plays the owner's recordings straight from disk, jumping
 * over everything the edit cuts, and draws each frame as the export will look.
 * Nothing is rendered to watch an edit — changing a cut, a caption or a zoom
 * shows at once.
 */

const pieceAt = (pieces: ProjectView['plan']['pieces'], t: number) => {
  let i = pieces.findIndex((p) => t < p.at + (p.end - p.start))
  if (i < 0) i = pieces.length - 1
  return i
}

export function Preview({ view, music }: { view: ProjectView; music: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const audio = useRef<HTMLAudioElement>(null)
  const viewRef = useRef(view)
  const idx = useRef(0)
  const raf = useRef(0)
  const playing = usePlayhead((s) => s.playing)
  const t = usePlayhead((s) => s.t)
  viewRef.current = view

  const [W, H] = view.plan.size

  const draw = (time: number) => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const { plan } = viewRef.current
    const piece = plan.pieces[idx.current] ?? null
    drawPicture(ctx, piece ? videos.current[piece.source] ?? null : null, plan.style, piece, time)
    drawOverlays(ctx, plan.style, plan.edit, plan.phrases, time, plan.length)
  }

  const seek = (time: number) => {
    const { plan } = viewRef.current
    const tt = Math.max(0, Math.min(time, Math.max(0, plan.length - 0.001)))
    usePlayhead.getState().set(tt)
    if (!plan.pieces.length) return draw(tt)
    const i = pieceAt(plan.pieces, tt)
    const p = plan.pieces[i]!
    idx.current = i
    videos.current.forEach((v, k) => k !== p.source && v && !v.paused && v.pause())
    const v = videos.current[p.source]
    if (!v) return
    v.currentTime = p.start + (tt - p.at)
    if (audio.current?.duration) audio.current.currentTime = tt % audio.current.duration
    if (v.readyState >= 2 && !usePlayhead.getState().playing) v.addEventListener('seeked', () => draw(tt), { once: true })
    draw(tt)
  }

  const stop = () => {
    usePlayhead.getState().setPlaying(false)
    cancelAnimationFrame(raf.current)
    videos.current.forEach((v) => v?.pause())
    audio.current?.pause()
  }

  const tick = () => {
    const { plan } = viewRef.current
    const p = plan.pieces[idx.current]
    if (!p) return stop()
    const v = videos.current[p.source]
    if (!v) return stop()
    let st = v.currentTime
    if (st >= p.end - 0.015 || v.ended) {
      const n = idx.current + 1
      if (n >= plan.pieces.length) {
        stop()
        return seek(0)
      }
      const q = plan.pieces[n]!
      idx.current = n
      const nv = videos.current[q.source]
      if (q.source !== p.source) {
        v.pause()
        if (nv) {
          nv.currentTime = q.start
          void nv.play().catch(() => {})
        }
      } else if (Math.abs(q.start - st) > 0.05) v.currentTime = q.start
      st = q.start
    }
    const cur = plan.pieces[idx.current]!
    const time = cur.at + Math.max(0, Math.min(st, cur.end) - cur.start)
    usePlayhead.getState().set(time)
    draw(time)
    raf.current = requestAnimationFrame(tick)
  }

  const play = () => {
    const { plan } = viewRef.current
    if (!plan.pieces.length) return
    let time = usePlayhead.getState().t
    if (time >= plan.length - 0.05) time = 0
    seek(time)
    const p = plan.pieces[idx.current]!
    const v = videos.current[p.source]
    if (!v) return
    usePlayhead.getState().setPlaying(true)
    void v.play().catch(() => stop())
    if (audio.current && music) {
      audio.current.volume = Math.min(1, plan.style.musica.volumen * 1.6)
      void audio.current.play().catch(() => {})
    }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
  }

  // The controls are this render's functions; stopping is only for leaving.
  player.seek = seek
  player.toggle = () => (usePlayhead.getState().playing ? stop() : play())
  player.pause = stop
  useEffect(() => () => stop(), [])

  // A new edit: stay at the same moment of the reel and redraw it.
  useEffect(() => {
    if (!usePlayhead.getState().playing) seek(usePlayhead.getState().t)
  }, [view])

  const sources = view.proyecto.fuentes
  return (
    <div className="preview">
      <div className="preview-stage">
        <canvas ref={canvas} width={W / 2} height={H / 2} className="preview-canvas" style={{ aspectRatio: `${W} / ${H}` }} onClick={() => player.toggle()} />
        {!view.plan.pieces.length && <div className="preview-empty">No queda nada después de los cortes</div>}
      </div>
      {sources.map((s, k) => (
        <video
          key={s.file}
          ref={(el) => {
            videos.current[k] = el
          }}
          src={mediaUrl(s.file)}
          preload="auto"
          playsInline
          className="hidden-media"
          onLoadedData={() => k === (view.plan.pieces[idx.current]?.source ?? 0) && seek(usePlayhead.getState().t)}
        />
      ))}
      {music && <audio ref={audio} src={mediaUrl(music)} preload="auto" loop className="hidden-media" />}
      <div className="transport">
        <button className="btn-icon" title="Inicio" onClick={() => seek(0)}>
          ⏮
        </button>
        <button className="btn-icon" title="Atrás 1 s (Shift + ←)" onClick={() => seek(t - 1)}>
          ⏪
        </button>
        <button className="btn-play" title="Reproducir (Espacio)" onClick={() => player.toggle()}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="btn-icon" title="Adelante 1 s (Shift + →)" onClick={() => seek(t + 1)}>
          ⏩
        </button>
        <span className="timecode">
          {clock(t)} <span className="muted">/ {clock(view.plan.length)}</span>
        </span>
      </div>
    </div>
  )
}
