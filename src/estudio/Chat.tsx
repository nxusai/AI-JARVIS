import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from './types'

/** Nexy beside the editor: say what you want, she does it and the editor redraws. */

const IDEAS_WITH_PROJECT = ['Edítalo con mi estilo', 'Quita las tomas repetidas', 'Ponle un título gancho', 'Hazlo más dinámico', 'Agrega textos en las ideas clave', 'Exporta la versión final']
const IDEAS_WITHOUT = ['¿Qué videos tengo sin editar?', 'Hazme la entrevista de estilo', 'Estudia este reel: ']

export function Chat({ messages, busy, step, online, hasProject, onSend, onStop }: { messages: ChatMessage[]; busy: boolean; step: string; online: boolean; hasProject: boolean; onSend: (t: string) => void; onStop: () => void }) {
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const send = (t = text) => {
    if (!t.trim()) return
    onSend(t.trim())
    setText('')
  }

  return (
    <div className="chat">
      <div className="panel-head">
        <span className="label">
          <span className={`dot ${online ? 'ok' : 'bad'}`} /> Nexy
        </span>
        <span className="muted small">{online ? 'dirige la edición' : 'sin conexión con Nexy'}</span>
      </div>
      <div className="chat-list" ref={list}>
        {!messages.length && <p className="muted small">Pídele lo que quieras como se lo pedirías a tu editor: “corta más rápido”, “subtítulos amarillos”, “quita donde me trabé”. Ves los cambios al instante.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.de}`}>
            {m.texto}
          </div>
        ))}
        {busy && (
          <div className="msg nexy typing">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>{' '}
            {step || 'pensando'}
            <button className="btn-link small" onClick={onStop}>
              detener
            </button>
          </div>
        )}
      </div>
      <div className="ideas">
        {(hasProject ? IDEAS_WITH_PROJECT : IDEAS_WITHOUT).map((t) => (
          <button key={t} className="chip" onClick={() => (t.endsWith(': ') ? setText(t) : send(t))}>
            {t}
          </button>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
          value={text}
          placeholder="Escríbele a Nexy…"
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button className="btn primary" disabled={!text.trim() || !online}>
          Enviar
        </button>
      </form>
    </div>
  )
}
