import { useEffect, useMemo, useState } from 'react'
import { usePlayhead } from './api'
import { dropRange, keepRange, reelTime, sourceAt } from './edits'
import { player } from './player'
import type { Edit, ProjectView } from './types'

/**
 * Editing by text: every word of the recordings, the ones the reel keeps in
 * full and the ones it cuts struck through. Select words and remove them (or
 * bring them back), click one to jump there, double-click to fix how it is
 * written in the captions.
 */

type Sel = { k: number; a: number; b: number } | null

const FILLER = /^(e+h*|e+m+|e+h+m+|m+|m+h*m+|u+h*m*|a+h+|ah+m+|uh+|hmm+|mju)$/i
const bare = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}]/gu, '')

export function Transcript({
  view,
  onEdit,
  onFixWord,
  onUse,
}: {
  view: ProjectView
  onEdit: (c: Partial<Edit>) => void
  onFixWord: (fuente: number, indice: number, texto: string) => void
  onUse: (what: 'titulo' | 'texto' | 'zoom', text: string, k: number, start: number, end: number) => void
}) {
  const { plan, proyecto } = view
  const [sel, setSel] = useState<Sel>(null)
  const [dragging, setDragging] = useState(false)
  const [editing, setEditing] = useState<{ k: number; i: number; text: string } | null>(null)

  const current = usePlayhead((s) => {
    const at = sourceAt(plan.pieces, s.t)
    if (!at) return ''
    const words = proyecto.fuentes[at.piece.source]?.words ?? []
    const i = words.findIndex((w) => at.time >= w.start && at.time < w.end + 0.05)
    return i < 0 ? '' : `${at.piece.source}:${i}`
  })

  const kept = useMemo(() => proyecto.fuentes.map((src, k) => src.words.map((w) => reelTime(plan.pieces, k, (w.start + w.end) / 2) !== null)), [plan, proyecto])

  const range = sel ? { k: sel.k, a: Math.min(sel.a, sel.b), b: Math.max(sel.a, sel.b) } : null
  const selWords = range ? proyecto.fuentes[range.k]!.words.slice(range.a, range.b + 1) : []
  const selText = selWords.map((w) => w.text).join(' ')
  const selKept = range ? kept[range.k]!.slice(range.a, range.b + 1).some(Boolean) : false
  const selSpan = selWords.length ? { inicio: Math.max(0, selWords[0]!.start - 0.03), fin: selWords.at(-1)!.end + 0.03 } : null

  const remove = () => {
    if (!range || !selSpan) return
    onEdit(dropRange(plan.edit, { fuente: range.k + 1, ...selSpan }))
    setSel(null)
  }
  const restore = () => {
    if (!range || !selSpan) return
    onEdit(keepRange(plan.edit, { fuente: range.k + 1, ...selSpan }))
    setSel(null)
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!range || (e.target as HTMLElement)?.closest('input, textarea, select')) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
        if (selKept) remove()
        else restore()
      }
      if (e.key === 'Escape') setSel(null)
    }
    window.addEventListener('keydown', key, true)
    const up = () => setDragging(false)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('mouseup', up)
    }
  })

  const noWords = proyecto.fuentes.every((s) => !s.words.length)

  return (
    <div className="transcript">
      <div className="panel-head">
        <span className="label">Transcripción</span>
        <span className="muted small">selecciona palabras y bórralas para cortarlas</span>
      </div>
      {range && (
        <div className="sel-bar">
          <span className="sel-text">“{selText.length > 60 ? `${selText.slice(0, 60)}…` : selText}”</span>
          {selKept ? (
            <button className="btn danger" onClick={remove} title="Supr / Retroceso">
              ✂ Quitar
            </button>
          ) : (
            <button className="btn" onClick={restore} title="Supr / Retroceso">
              ↺ Recuperar
            </button>
          )}
          <button className="btn" onClick={() => (onUse('titulo', selText, range.k, selWords[0]!.start, selWords.at(-1)!.end), setSel(null))}>
            Usar de título
          </button>
          <button className="btn" onClick={() => (onUse('texto', selText, range.k, selWords[0]!.start, selWords.at(-1)!.end), setSel(null))}>
            Texto en pantalla
          </button>
          <button className="btn" onClick={() => (onUse('zoom', selText, range.k, selWords[0]!.start, selWords.at(-1)!.end), setSel(null))}>
            🔍 Zoom aquí
          </button>
        </div>
      )}
      <div className="words" onMouseLeave={() => setDragging(false)}>
        {noWords && <p className="muted">Sin transcripción: instala la transcripción local (npm run reels:setup) para editar por texto y tener subtítulos.</p>}
        {proyecto.fuentes.map((src, k) => (
          <div key={src.file} className="words-source">
            {proyecto.fuentes.length > 1 && <div className="words-source-name">Grabación {k + 1}</div>}
            {src.words.map((w, i) => {
              const inSel = range && range.k === k && i >= range.a && i <= range.b
              const cls = ['w', kept[k]![i] ? '' : 'cut', FILLER.test(bare(w.text)) ? 'filler' : '', inSel ? 'sel' : '', current === `${k}:${i}` ? 'now' : ''].join(' ')
              if (editing && editing.k === k && editing.i === i) {
                return (
                  <input
                    key={i}
                    className="w-edit"
                    autoFocus
                    value={editing.text}
                    size={Math.max(3, editing.text.length)}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onBlur={() => setEditing(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editing.text.trim() && editing.text !== w.text) onFixWord(k + 1, i, editing.text.trim())
                        setEditing(null)
                      }
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                )
              }
              const gap = i > 0 && w.start - src.words[i - 1]!.end > 0.8
              return (
                <span key={i}>
                  {gap && <span className="pause" title={`Pausa de ${(w.start - src.words[i - 1]!.end).toFixed(1)} s`}>⏸</span>}
                  <span
                    className={cls}
                    onMouseDown={(e) => {
                      if (e.detail > 1) return
                      e.preventDefault()
                      if (e.shiftKey && sel && sel.k === k) setSel({ ...sel, b: i })
                      else setSel({ k, a: i, b: i })
                      setDragging(true)
                      const at = reelTime(plan.pieces, k, w.start + 0.01)
                      if (at !== null) player.seek(at)
                    }}
                    onMouseEnter={() => dragging && sel && sel.k === k && setSel({ ...sel, b: i })}
                    onDoubleClick={() => setEditing({ k, i, text: w.text })}
                    title="Doble clic para corregir la palabra"
                  >
                    {w.text}
                  </span>{' '}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
