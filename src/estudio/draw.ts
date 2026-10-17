import type { Edit, Phrase, Piece, Style } from './types'

/**
 * One frame of the live preview, drawn the way the bridge's renderer
 * (bridge/reels/motor.mjs) will make it: the same framing, zoom, colour,
 * captions, hook title and text on screen, from the same plan. Close enough
 * to judge an edit by; the export is the exact one.
 */

const hexA = (hex: string, alpha: number) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex) ?? [null, 'ff', 'ff', 'ff']
  return `rgba(${parseInt(m[1]!, 16)},${parseInt(m[2]!, 16)},${parseInt(m[3]!, 16)},${alpha})`
}

const font = (size: number, family: string) => `900 ${Math.round(size)}px "${family}", "Arial Black", "Helvetica Neue", sans-serif`

/** The picture: cover-cropped (or over a blurred copy), zoomed, coloured. */
export function drawPicture(ctx: CanvasRenderingContext2D, video: HTMLVideoElement | null, style: Style, piece: Piece | null, t: number) {
  const { width: W, height: H } = ctx.canvas
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)
  if (!video || !video.videoWidth || !piece) return
  const vw = video.videoWidth
  const vh = video.videoHeight
  const len = piece.end - piece.start
  const z = piece.zoom > 1.001 ? (style.zoom.tipo === 'suave' ? 1 + (piece.zoom - 1) * Math.min(1, Math.max(0, (t - piece.at) / len)) : piece.zoom) : 1
  const { x, y, modo } = style.encuadre
  const c = style.color
  const grade = `contrast(${c.contraste}) saturate(${c.saturacion}) brightness(${1 + c.brillo})`
  if (modo === 'blur') {
    const s = Math.max(W / vw, H / vh)
    ctx.filter = `blur(${Math.round(W / 30)}px) brightness(0.85) ${grade}`
    ctx.drawImage(video, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s)
    const f = Math.min(W / vw, H / vh) * z
    ctx.filter = grade
    ctx.drawImage(video, (W - vw * f) * x, (H - vh * f) / 2, vw * f, vh * f)
  } else {
    const s = Math.max(W / vw, H / vh) * z
    ctx.filter = grade
    ctx.drawImage(video, (W - vw * s) * x, (H - vh * s) * y, vw * s, vh * s)
  }
  ctx.filter = 'none'
}

/** Words broken into lines that fit `max` pixels. */
function lines(ctx: CanvasRenderingContext2D, words: string[], max: number) {
  const out: number[][] = [[]]
  let width = 0
  const space = ctx.measureText(' ').width
  words.forEach((w, i) => {
    const ww = ctx.measureText(w).width
    if (out.at(-1)!.length && width + space + ww > max) {
      out.push([])
      width = 0
    }
    width += (out.at(-1)!.length ? space : 0) + ww
    out.at(-1)!.push(i)
  })
  return out
}

function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, outline: string, stroke: number, shadow: boolean) {
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowOffsetX = ctx.shadowOffsetY = Math.max(1, stroke / 2)
  }
  if (stroke > 0) {
    ctx.lineWidth = stroke * 2
    ctx.strokeStyle = outline
    ctx.lineJoin = 'round'
    ctx.strokeText(text, x, y)
  }
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

/** The captions, the hook title and the text on screen at `t`. */
export function drawOverlays(ctx: CanvasRenderingContext2D, style: Style, edit: Edit, phrases: Phrase[], t: number, length: number) {
  const { width: W, height: H } = ctx.canvas
  const sub = style.subtitulos
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (sub.activo) {
    const ph = phrases.find((p) => t >= p.start && t < p.end)
    if (ph) {
      const size = W * sub.tamano
      const pop = sub.animacion === 'pop' ? Math.min(1, (t - ph.start) / 0.16) : 1
      const scale = sub.animacion === 'pop' ? (pop < 0.56 ? 0.7 + 0.38 * (pop / 0.56) : 1.08 - 0.08 * ((pop - 0.56) / 0.44)) : 1
      ctx.font = font(size * scale, sub.fuente)
      const texts = ph.words.map((w) => (sub.mayusculas ? w.text.toLocaleUpperCase('es') : w.text))
      let current = -1
      if (sub.animacion === 'palabra') ph.words.forEach((w, i) => t >= (i === 0 ? ph.start : w.start) && (current = i))
      const rows = lines(ctx, texts, W * 0.86)
      const lh = size * scale * 1.15
      const top = H * sub.altura - ((rows.length - 1) * lh) / 2
      const stroke = size * sub.grosor * scale
      rows.forEach((row, r) => {
        const widths = row.map((i) => ctx.measureText(texts[i]!).width * (i === current ? 1.12 : 1))
        const space = ctx.measureText(' ').width
        let cx = W / 2 - (widths.reduce((a, b) => a + b, 0) + space * (row.length - 1)) / 2
        row.forEach((i, k) => {
          const w = widths[k]!
          ctx.save()
          ctx.translate(cx + w / 2, top + r * lh)
          if (i === current) ctx.scale(1.12, 1.12)
          outlined(ctx, texts[i]!, 0, 0, i === current ? sub.resaltado : sub.color, sub.contorno, stroke, sub.sombra)
          ctx.restore()
          cx += w + space
        })
      })
    }
  }

  const tit = style.titulo
  if (tit.activo && edit.titulo && t < Math.min(tit.segundos, length || tit.segundos)) {
    const size = W * tit.tamano
    ctx.font = font(size, tit.fuente)
    const text = tit.mayusculas ? edit.titulo.toLocaleUpperCase('es') : edit.titulo
    const rows = lines(ctx, text.split(/\s+/), W * 0.86)
    const words = text.split(/\s+/)
    const lh = size * 1.25
    const top = H * tit.altura - ((rows.length - 1) * lh) / 2
    ctx.globalAlpha = Math.max(0, Math.min(1, 0.4 + t / 0.12, (Math.min(tit.segundos, length || tit.segundos) - t) / 0.2))
    rows.forEach((row, r) => {
      const s = row.map((i) => words[i]).join(' ')
      const w = ctx.measureText(s).width
      const pad = size * 0.35
      ctx.fillStyle = hexA(tit.fondo, 0.81)
      ctx.fillRect(W / 2 - w / 2 - pad, top + r * lh - lh / 2, w + pad * 2, lh)
      ctx.fillStyle = tit.color
      ctx.fillText(s, W / 2, top + r * lh)
    })
    ctx.globalAlpha = 1
  }

  for (const tx of edit.textos) {
    if (t < tx.inicio || t >= tx.fin) continue
    const size = W * (tx.tamano || sub.tamano)
    ctx.font = font(size, sub.fuente)
    ctx.globalAlpha = Math.min(1, (t - tx.inicio) / 0.1, (tx.fin - t) / 0.15)
    const rows = lines(ctx, tx.texto.split(/\s+/), W * 0.86)
    const words = tx.texto.split(/\s+/)
    rows.forEach((row, r) => outlined(ctx, row.map((i) => words[i]).join(' '), W / 2, H * (tx.altura ?? 0.3) + r * size * 1.15, tx.color || '#FFFFFF', '#000000', size * 0.1, false))
    ctx.globalAlpha = 1
  }
}
