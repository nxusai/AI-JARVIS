import type { Edit, Piece, Range } from './types'

/**
 * Small changes to an edit, worked out here and sent to the bridge whole.
 * Removing and keeping by hand are opposites: removing a part takes it out of
 * what was kept by hand, and keeping a part takes it out of what was removed,
 * so the last thing the owner did always wins.
 */

const minus = (list: Range[], cut: Range): Range[] =>
  list.flatMap((r) => {
    if (r.fuente !== cut.fuente || cut.fin <= r.inicio || cut.inicio >= r.fin) return [r]
    const out: Range[] = []
    if (cut.inicio > r.inicio) out.push({ ...r, fin: cut.inicio })
    if (cut.fin < r.fin) out.push({ ...r, inicio: cut.fin })
    return out.filter((x) => x.fin - x.inicio > 0.01)
  })

const round = (r: Range): Range => ({ fuente: r.fuente, inicio: Math.round(r.inicio * 1000) / 1000, fin: Math.round(r.fin * 1000) / 1000 })

/** Remove a part of a recording (fuente counts from 1). */
export const dropRange = (e: Edit, r: Range): Partial<Edit> => ({ quitar: [...e.quitar, round(r)], forzar: minus(e.forzar, r) })

/** Keep a part of a recording even if it is a pause. */
export const keepRange = (e: Edit, r: Range): Partial<Edit> => ({ forzar: [...e.forzar, round(r)], quitar: minus(e.quitar, r) })

/** Remove a whole piece of the reel. */
export const dropPiece = (e: Edit, p: Piece) => dropRange(e, { fuente: p.source + 1, inicio: p.start, fin: p.end })

/** Where a moment of the reel comes from, or null in a gap. */
export function sourceAt(pieces: Piece[], t: number) {
  const i = pieces.findIndex((p) => t >= p.at && t < p.at + (p.end - p.start))
  if (i < 0) return null
  const p = pieces[i]!
  return { index: i, piece: p, time: p.start + (t - p.at) }
}

/** The moment of the reel a moment of a recording lands on, or null when it is cut. */
export function reelTime(pieces: Piece[], source: number, time: number) {
  const p = pieces.find((x) => x.source === source && time >= x.start && time < x.end)
  return p ? p.at + (time - p.start) : null
}

/** Set a value deep inside the style tweaks: ("subtitulos.tamano", 0.09). */
export function setTweak(tweaks: Record<string, any> | null, path: string, value: unknown) {
  const out = structuredClone(tweaks ?? {})
  const keys = path.split('.')
  let o = out
  for (const k of keys.slice(0, -1)) o = o[k] = typeof o[k] === 'object' && o[k] ? o[k] : {}
  o[keys.at(-1)!] = value
  return out
}

/** The same, on a full style, for drawing the change before the bridge answers. */
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const out = structuredClone(obj) as any
  const keys = path.split('.')
  let o = out
  for (const k of keys.slice(0, -1)) o = o[k]
  o[keys.at(-1)!] = value
  return out
}
