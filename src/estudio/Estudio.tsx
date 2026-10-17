import { useCallback, useEffect, useRef, useState } from 'react'
import { api, connect, mediaUrl, usePlayhead } from './api'
import { Chat } from './Chat'
import { dropPiece, dropRange, reelTime, setPath, setTweak, sourceAt } from './edits'
import { Inspector } from './Inspector'
import { Library } from './Library'
import { player } from './player'
import { Preview } from './Preview'
import { Timeline } from './Timeline'
import { Transcript } from './Transcript'
import type { ChatMessage, Edit, ProjectView, RenderState, Status } from './types'

/**
 * The Reels studio: a video editor for the owner's reels that Nexy drives.
 *
 * The library on the left, the live player and the transcript in the middle,
 * the inspector and Nexy's chat on the right, the timeline along the bottom.
 * Every change — by hand here or by Nexy from the chat, Telegram or the voice
 * interface — is one shared edit on the bridge, so this page always shows the
 * reel as it stands, and exporting renders exactly that.
 */

const LAST = 'estudio:proyecto'
const remembered = () => {
  try {
    return localStorage.getItem(LAST)
  } catch {
    return null
  }
}
const remember = (id: string | null) => {
  try {
    if (id) localStorage.setItem(LAST, id)
    else localStorage.removeItem(LAST)
  } catch {
    // Private window: nothing to keep.
  }
}

const EDIT_KEYS: (keyof Edit)[] = ['estilo', 'ajustes', 'quitar', 'solo', 'forzar', 'titulo', 'musica', 'textos', 'zooms']
const whole = (e: Edit): Partial<Edit> => Object.fromEntries(EDIT_KEYS.map((k) => [k, e[k]]))

export default function Estudio() {
  const [status, setStatus] = useState<Status | null>(null)
  const [id, setId] = useState<string | null>(remembered())
  const [view, setView] = useState<ProjectView | null>(null)
  const [waves, setWaves] = useState<Record<number, number[]>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [renders, setRenders] = useState<Record<string, RenderState>>({})
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [online, setOnline] = useState(false)
  const [preparing, setPreparing] = useState<{ trabajo: string; paso: string } | null>(null)
  const [error, setError] = useState('')
  const [watching, setWatching] = useState<string | null>(null)
  const undo = useRef<Partial<Edit>[]>([])
  const redo = useRef<Partial<Edit>[]>([])
  const viewRef = useRef(view)
  viewRef.current = view
  const idRef = useRef(id)
  idRef.current = id
  const seq = useRef(0)
  const socket = useRef<ReturnType<typeof connect> | null>(null)

  const loadStatus = useCallback(() => {
    api.status().then(setStatus, (e) => setError(`No encuentro a Nexy (${e.message}). ¿Está corriendo npm start?`))
  }, [])

  const load = useCallback((pid: string) => {
    const n = ++seq.current
    api.project(pid).then(
      (v) => n === seq.current && idRef.current === pid && setView(v),
      () => {
        if (idRef.current === pid) {
          setId(null)
          remember(null)
          setView(null)
        }
      },
    )
  }, [])

  useEffect(loadStatus, [])

  useEffect(() => {
    setView(null)
    setWaves({})
    setSelected(null)
    undo.current = []
    redo.current = []
    usePlayhead.getState().set(0)
    remember(id)
    if (!id) return
    load(id)
  }, [id])

  // Waveforms, once per project.
  useEffect(() => {
    if (!view || !id) return
    view.proyecto.fuentes.forEach((_, k) => {
      if (waves[k]) return
      api.waveform(id, k).then((w) => setWaves((x) => ({ ...x, [k]: w.picos })), () => {})
    })
  }, [view?.proyecto.id])

  // The socket: Nexy's chat, and every change to redraw on.
  useEffect(() => {
    let reload: ReturnType<typeof setTimeout> | undefined
    socket.current = connect((m) => {
      switch (m.type) {
        case 'historial':
          setMessages(m.mensajes)
          setBusy(!!m.ocupada)
          break
        case 'chat':
          setMessages((x) => [...x, m])
          if (m.de === 'nexy') setStep('')
          break
        case 'ocupada':
          setBusy(m.ocupada)
          if (!m.ocupada) setStep('')
          break
        case 'paso':
          setBusy(true)
          setStep(m.texto)
          break
        case 'proyecto':
          if (m.id === idRef.current) {
            clearTimeout(reload)
            reload = setTimeout(() => idRef.current && load(idRef.current), 120)
          }
          loadStatus()
          break
        case 'render':
          setRenders((x) => ({ ...x, [m.id]: m }))
          break
        case 'estilos':
        case 'gustos':
          loadStatus()
          break
        case 'preparando':
          setPreparing({ trabajo: m.trabajo, paso: m.paso })
          break
        case 'preparado':
          setPreparing(null)
          if (m.error) setError(m.error)
          else {
            loadStatus()
            setId(m.id)
          }
          break
      }
    }, setOnline)
    return () => socket.current?.close()
  }, [])

  /** Change the edit; remembered for undo. */
  const edit = useCallback(
    (cambios: Partial<Edit>, { history = true }: { history?: boolean } = {}) => {
      const v = viewRef.current
      if (!v) return
      if (history) {
        undo.current.push(whole(v.plan.edit))
        if (undo.current.length > 100) undo.current.shift()
        redo.current = []
      }
      const n = ++seq.current
      // Drawn at once where it can be (text, title), then the bridge's plan.
      setView({ ...v, plan: { ...v.plan, edit: { ...v.plan.edit, ...cambios } } })
      api.edit(v.proyecto.id, cambios).then(
        (nv) => n === seq.current && setView(nv),
        (e) => setError(e.message),
      )
    },
    [],
  )

  const fixWord = (fuente: number, indice: number, texto: string) => {
    const v = viewRef.current
    if (!v) return
    api.edit(v.proyecto.id, {}, { palabras: [{ fuente, indice, texto }] }).then(setView, (e) => setError(e.message))
  }

  // Style settings: drawn at once, sent once the slider rests.
  const tweakTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const tweakStart = useRef<Partial<Edit> | null>(null)
  const tweak = useCallback((path: string, value: unknown) => {
    const v = viewRef.current
    if (!v) return
    tweakStart.current ??= whole(v.plan.edit)
    const ajustes = setTweak(v.plan.edit.ajustes, path, value)
    const nv = { ...v, plan: { ...v.plan, style: setPath(v.plan.style, path, value), edit: { ...v.plan.edit, ajustes } } }
    viewRef.current = nv
    setView(nv)
    clearTimeout(tweakTimer.current)
    tweakTimer.current = setTimeout(() => {
      if (tweakStart.current) {
        undo.current.push(tweakStart.current)
        redo.current = []
      }
      tweakStart.current = null
      edit({ ajustes: viewRef.current?.plan.edit.ajustes ?? null }, { history: false })
    }, 280)
  }, [])

  const doUndo = () => {
    const v = viewRef.current
    const prev = undo.current.pop()
    if (!v || !prev) return
    redo.current.push(whole(v.plan.edit))
    edit(prev, { history: false })
  }
  const doRedo = () => {
    const v = viewRef.current
    const next = redo.current.pop()
    if (!v || !next) return
    undo.current.push(whole(v.plan.edit))
    edit(next, { history: false })
  }

  const onRender = (preview: boolean) => {
    if (!id) return
    setRenders((x) => ({ ...x, [id]: { estado: 'renderizando', progreso: 0, vistaPrevia: preview } }))
    api.render(id, preview).catch((e) => setError(e.message))
  }

  const onSaveStyle = async (mode: 'actualizar' | 'nuevo') => {
    const v = viewRef.current
    if (!v) return
    try {
      if (mode === 'actualizar') {
        await api.saveStyle(v.plan.styleName, v.plan.edit.ajustes ?? {})
        edit({ ajustes: null })
      } else {
        const name = prompt('¿Cómo se llama este estilo?', v.plan.styleName === 'base' ? 'Mi estilo' : `${v.plan.styleName} 2`)
        if (!name?.trim()) return
        const porDefecto = confirm('¿Lo uso para todos tus reels de ahora en adelante?')
        await api.saveStyle(name.trim(), v.plan.style, { reemplazar: true, descripcion: 'Creado en el estudio', porDefecto })
        edit({ estilo: name.trim(), ajustes: null })
      }
      loadStatus()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const onUse = (what: 'titulo' | 'texto' | 'zoom', text: string, k: number, start: number, end: number) => {
    const v = viewRef.current
    if (!v) return
    if (what === 'titulo') return edit({ titulo: text })
    if (what === 'zoom') return edit({ zooms: [...v.plan.edit.zooms, { fuente: k + 1, t: Number(start.toFixed(3)), escala: 1.25 }] })
    const a = reelTime(v.plan.pieces, k, start + 0.01)
    const b = reelTime(v.plan.pieces, k, end - 0.01)
    if (a === null) return setError('Esas palabras están cortadas: recupéralas primero.')
    edit({ textos: [...v.plan.edit.textos, { texto: text.toLocaleUpperCase('es'), inicio: Number(a.toFixed(2)), fin: Number(((b ?? a) + 0.6).toFixed(2)), altura: 0.3 }] })
  }

  // The keyboard, like any editor.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
      const v = viewRef.current
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        return e.shiftKey ? doRedo() : doUndo()
      }
      if (!v || mod) return
      const t = usePlayhead.getState().t
      const at = sourceAt(v.plan.pieces, t)
      if (e.code === 'Space') {
        e.preventDefault()
        player.toggle()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        player.seek(t + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 1 / 30))
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null && v.plan.pieces[selected]) {
        e.preventDefault()
        edit(dropPiece(v.plan.edit, v.plan.pieces[selected]!))
        setSelected(null)
      } else if (at && e.key.toLowerCase() === 'q') {
        edit(dropRange(v.plan.edit, { fuente: at.piece.source + 1, inicio: at.piece.start, fin: at.time }))
      } else if (at && e.key.toLowerCase() === 'w') {
        edit(dropRange(v.plan.edit, { fuente: at.piece.source + 1, inicio: at.time, fin: at.piece.end }))
      } else if (at && e.key.toLowerCase() === 'z') {
        const p = at.piece
        const mine = (z: { fuente?: number; t: number }) => (z.fuente ?? 1) === p.source + 1 && z.t >= p.start && z.t < p.end
        const others = v.plan.edit.zooms.filter((z) => !mine(z))
        edit({ zooms: [...others, { fuente: p.source + 1, t: Number(((p.start + p.end) / 2).toFixed(3)), escala: p.zoom > 1.001 ? 1 : v.plan.style.zoom.escala }] })
      } else if (e.key === 'Home') player.seek(0)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [selected])

  const render = id ? (renders[id] ?? (view?.renderizando !== null && view?.renderizando !== undefined ? { estado: 'renderizando' as const, progreso: view.renderizando } : null)) : null

  return (
    <div className="studio">
      <header className="studio-head">
        <div className="brand">
          <span className="logo">▶</span> Estudio de Reels <span className="muted">· Nexy</span>
        </div>
        {view && (
          <input
            className="project-name"
            defaultValue={view.proyecto.nombre}
            key={view.proyecto.id}
            onBlur={(e) => e.target.value.trim() && e.target.value !== view.proyecto.nombre && api.edit(view.proyecto.id, { nombre: e.target.value.trim() }).then(loadStatus)}
          />
        )}
        <div className="spacer" />
        {status && !status.motor.transcripcion && <span className="warn small">Sin transcripción: corre npm run reels:setup</span>}
        {view && (
          <>
            <button className="btn-icon" title="Deshacer (⌘Z)" onClick={doUndo}>
              ↶
            </button>
            <button className="btn-icon" title="Rehacer (⇧⌘Z)" onClick={doRedo}>
              ↷
            </button>
            <button className="btn primary" disabled={render?.estado === 'renderizando'} onClick={() => onRender(false)}>
              {render?.estado === 'renderizando' ? `Exportando ${render.progreso ?? 0}%` : 'Exportar'}
            </button>
          </>
        )}
        <a className="btn ghost" href="/consola.html">
          Consola
        </a>
      </header>

      {error && (
        <div className="toast" onClick={() => setError('')}>
          {error} <span className="muted">· cerrar</span>
        </div>
      )}

      <Library
        status={status}
        current={id}
        preparing={preparing}
        onOpen={setId}
        onCreate={(paths, name) => api.create(paths, name).then((r) => setPreparing({ trabajo: r.trabajo, paso: 'Empezando' }), (e) => setError(e.message))}
        onDelete={(pid) => api.deleteProject(pid).then(() => (pid === id && setId(null), loadStatus()))}
        onDeleteStyle={(n) => api.deleteStyle(n).then(loadStatus)}
        onRefresh={loadStatus}
      />

      <main className="stage">
        {view ? (
          <>
            <Preview view={view} music={view.plan.edit.musica} />
            <Transcript view={view} onEdit={edit} onFixWord={fixWord} onUse={onUse} />
          </>
        ) : (
          <div className="empty">
            <h2>Tú grabas, Nexy edita.</h2>
            <p className="muted">Elige un reel a la izquierda, arrastra tus videos, o pídeselo a Nexy en el chat.</p>
            {status?.gustos.pendientes.length ? <p className="muted small">Nexy todavía no conoce bien tu estilo: escríbele “hazme la entrevista de estilo”.</p> : null}
          </div>
        )}
      </main>

      <section className="side">
        {view && <Inspector view={view} status={status} selected={selected} render={render} onEdit={edit} onTweak={tweak} onRender={onRender} onSaveStyle={onSaveStyle} onOpenVersion={setWatching} />}
        <Chat
          messages={messages}
          busy={busy}
          step={step}
          online={online}
          hasProject={!!view}
          onSend={(texto) => socket.current?.send({ type: 'chat', texto, proyecto: id })}
          onStop={() => socket.current?.send({ type: 'parar' })}
        />
      </section>

      <footer className="bottom">{view ? <Timeline view={view} waves={waves} selected={selected} onSelect={setSelected} onEdit={edit} /> : <div className="timeline empty-timeline muted small">La línea de tiempo aparece cuando abres un reel.</div>}</footer>

      {watching && (
        <div className="modal" onClick={() => setWatching(null)}>
          <video src={mediaUrl(watching)} controls autoPlay onClick={(e) => e.stopPropagation()} />
          <span className="muted small">{watching}</span>
        </div>
      )}
    </div>
  )
}
