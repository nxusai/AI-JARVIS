import { useState } from 'react'
import { upload } from './api'
import type { Status } from './types'

/**
 * Reels to copy the editing of: a link (Instagram, TikTok, YouTube…) or a
 * video dropped here. Nexy studies it — pace, cuts, captions, colour, framing
 * — saves it as a style and, when a reel is open, edits that reel the same way.
 */
export function References({
  status,
  project,
  onStudy,
  onApplyStyle,
  onRefresh,
}: {
  status: Status | null
  project: string | null
  onStudy: (source: string, name: string, apply: boolean) => void
  onApplyStyle: (style: string) => void
  onRefresh: () => void
}) {
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const [apply, setApply] = useState(true)
  const [up, setUp] = useState<number | null>(null)
  const [over, setOver] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState('')

  const styleOf = (path: string) => status?.estilos.find((s) => s.referencias?.some((r) => r === path || path.includes(r) || r.includes(path.split('/').pop() ?? '\0')))

  const study = (source: string) => {
    const n = name.trim() || 'Estilo de referencia'
    onStudy(source, n, !!project && apply)
    setSent(`Nexy está estudiando el reel: mira el chat →`)
    setLink('')
    setName('')
    setTimeout(() => setSent(''), 12000)
  }

  const drop = async (files: FileList | File[]) => {
    setErr('')
    const f = [...files][0]
    if (!f) return
    if (!/\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)) return setErr(`${f.name} no es un video`)
    setUp(0)
    try {
      const path = await upload(f, setUp, 'referencias')
      onRefresh()
      study(path)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setUp(null)
    }
  }

  const okLink = /^https:\/\/(www\.)?(instagram\.com|tiktok\.com|vm\.tiktok\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|x\.com|twitter\.com|vimeo\.com|threads\.net)\//i.test(link.trim())

  return (
    <div className="refs">
      <div className="refs-title">🎯 Copiar la edición de un reel</div>
      <p className="muted small">Pega el link de un reel que te guste (o arrastra el video) y Nexy edita el tuyo igual.</p>
      <input type="text" placeholder="https://www.instagram.com/reel/…" value={link} onChange={(e) => setLink(e.target.value)} />
      <div
        className={`refs-drop ${over ? 'over' : ''}`}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void drop(e.dataTransfer.files)
        }}
      >
        <label>
          <input type="file" accept="video/*" hidden onChange={(e) => e.target.files && void drop(e.target.files)} />
          {up !== null ? `Subiendo… ${Math.round(up * 100)}%` : 'o arrastra aquí el video de referencia'}
        </label>
      </div>
      <input type="text" placeholder="Nombre del estilo (ej. estilo Hormozi)" value={name} onChange={(e) => setName(e.target.value)} />
      {project && (
        <label className="refs-apply">
          <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} /> Aplicarlo al reel que tengo abierto
        </label>
      )}
      <button className="btn primary" disabled={!okLink} onClick={() => study(link.trim())}>
        Estudiar con Nexy
      </button>
      {link.trim() && !okLink && <div className="error small">Pega un link de Instagram, TikTok, YouTube, Facebook, X, Threads o Vimeo.</div>}
      {err && <div className="error small">{err}</div>}
      {sent && <div className="refs-sent small">{sent}</div>}

      {!!status?.referencias.length && (
        <div className="refs-list">
          <div className="muted small">Referencias guardadas</div>
          {status.referencias.slice(0, 8).map((r) => {
            const st = styleOf(r.ruta)
            return (
              <div key={r.ruta} className="refs-item" title={r.ruta}>
                <span className="item-name">{r.nombre.replace(/^\d{4}(-\d{2}){5}-/, '')}</span>
                {st ? (
                  <button className="btn-link small" disabled={!project} onClick={() => onApplyStyle(st.nombre)} title={project ? `Aplicar el estilo «${st.nombre}»` : 'Abre un reel para aplicarlo'}>
                    usar «{st.nombre}»
                  </button>
                ) : (
                  <button className="btn-link small" onClick={() => study(r.ruta)}>
                    estudiar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
