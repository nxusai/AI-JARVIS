import { useState } from 'react'
import { upload } from './api'
import type { Status } from './types'

/**
 * The library: the owner's raw videos waiting to be edited (from Telegram,
 * AirDrop or dropped here), their reels, and their styles.
 */
export function Library({
  status,
  current,
  preparing,
  onOpen,
  onCreate,
  onDelete,
  onDeleteStyle,
  onRefresh,
  references,
}: {
  status: Status | null
  current: string | null
  preparing: { paso: string } | null
  onOpen: (id: string) => void
  onCreate: (paths: string[], name: string) => void
  onDelete: (id: string) => void
  onDeleteStyle: (name: string) => void
  onRefresh: () => void
  references: React.ReactNode
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [name, setName] = useState('')
  const [up, setUp] = useState<{ name: string; p: number } | null>(null)
  const [over, setOver] = useState(false)
  const [err, setErr] = useState('')

  const send = async (files: FileList | File[]) => {
    setErr('')
    for (const f of [...files]) {
      if (!/\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)) {
        setErr(`${f.name} no es un video`)
        continue
      }
      setUp({ name: f.name, p: 0 })
      try {
        const path = await upload(f, (p) => setUp({ name: f.name, p }))
        setPicked((x) => [...x, path])
      } catch (e) {
        setErr((e as Error).message)
      }
    }
    setUp(null)
    onRefresh()
  }

  return (
    <aside className="library">
      <div
        className={`drop ${over ? 'over' : ''}`}
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void send(e.dataTransfer.files)
        }}
      >
        <label className="drop-inner">
          <input type="file" accept="video/*" multiple hidden onChange={(e) => e.target.files && void send(e.target.files)} />
          <b>Arrastra tus videos aquí</b>
          <span className="muted small">o haz clic para elegirlos</span>
        </label>
        {up && (
          <div className="progress small-progress">
            <div style={{ width: `${Math.round(up.p * 100)}%` }} />
          </div>
        )}
        {err && <div className="error small">{err}</div>}
      </div>

      {references}

      <div className="panel-head">
        <span className="label">Videos sin editar</span>
        <button className="btn-icon" title="Actualizar" onClick={onRefresh}>
          ↻
        </button>
      </div>
      <div className="list">
        {!status?.entrada.length && <p className="muted small">Mándale videos a Nexy por Telegram o arrástralos arriba.</p>}
        {status?.entrada.map((f) => (
          <label key={f.ruta} className={`item check ${picked.includes(f.ruta) ? 'on' : ''}`}>
            <input type="checkbox" checked={picked.includes(f.ruta)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, f.ruta] : x.filter((p) => p !== f.ruta)))} />
            <span className="item-name">{f.nombre}</span>
            <span className="muted small">{f.mb} MB</span>
          </label>
        ))}
      </div>
      {picked.length > 0 && (
        <div className="create">
          <input type="text" placeholder="Nombre del reel" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="btn primary"
            disabled={!!preparing}
            onClick={() => {
              onCreate(picked, name || 'Reel')
              setPicked([])
              setName('')
            }}
          >
            Crear reel con {picked.length} video{picked.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
      {preparing && <div className="preparing small">⏳ {preparing.paso}…</div>}

      <div className="panel-head">
        <span className="label">Mis reels</span>
      </div>
      <div className="list grow">
        {!status?.proyectos.length && <p className="muted small">Todavía no hay reels.</p>}
        {status?.proyectos.map((p) => (
          <div key={p.id} className={`item project ${current === p.id ? 'on' : ''}`} onClick={() => onOpen(p.id)}>
            <span className="item-name">{p.nombre}</span>
            <span className="muted small">
              {new Date(p.actualizado).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · {p.duracion} s · {p.versiones} versión{p.versiones === 1 ? '' : 'es'}
            </span>
            <button
              className="btn-icon item-del"
              title="Borrar proyecto (no borra tus videos originales)"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`¿Borrar el proyecto «${p.nombre}»? Tus videos originales y los exportados se quedan.`)) onDelete(p.id)
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>

      <div className="panel-head">
        <span className="label">Mis estilos</span>
      </div>
      <div className="list">
        {!status?.estilos.length && <p className="muted small">Mándale a Nexy un reel que te guste y lo convierte en estilo.</p>}
        {status?.estilos.map((st) => (
          <div key={st.nombre} className="item" title={st.descripcion}>
            <span className="item-name">
              {st.nombre}
              {status.gustos.estiloPorDefecto === st.nombre ? ' ★' : ''}
            </span>
            <button className="btn-icon item-del" title="Borrar estilo" onClick={() => confirm(`¿Borrar el estilo «${st.nombre}»?`) && onDeleteStyle(st.nombre)}>
              🗑
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
