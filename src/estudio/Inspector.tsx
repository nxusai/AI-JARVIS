import { useState } from 'react'
import { clock, mediaUrl, usePlayhead } from './api'
import { dropPiece, dropRange } from './edits'
import type { Edit, ProjectView, RenderState, Status, Style } from './types'

/**
 * The inspector: every setting of the reel, by hand. Style (format, framing,
 * cuts, zoom, captions, title, colour, sound), text, the selected cut, music
 * and export. Everything here is also something Nexy can do when asked.
 */

type Tab = 'estilo' | 'texto' | 'corte' | 'musica' | 'exportar'

const FONTS = ['Arial Black', 'Helvetica Neue', 'Futura', 'Impact', 'Avenir Next', 'Montserrat', 'Bebas Neue', 'Gill Sans', 'Georgia', 'Menlo']

function Section({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="section" open={open}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  )
}

function Slider({ label, value, min, max, step, fmt = (v) => String(v), onChange }: { label: string; value: number; min: number; max: number; step: number; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <label className="ctl">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <em>{fmt(value)}</em>
    </label>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ctl ctl-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

function Colour({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="ctl ctl-colour">
      <span>{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      <em>{value}</em>
    </label>
  )
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <label className="ctl">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export function Inspector({
  view,
  status,
  selected,
  render,
  onEdit,
  onTweak,
  onRender,
  onSaveStyle,
  onOpenVersion,
}: {
  view: ProjectView
  status: Status | null
  selected: number | null
  render: RenderState | null
  onEdit: (c: Partial<Edit>) => void
  onTweak: (path: string, value: unknown) => void
  onRender: (preview: boolean) => void
  onSaveStyle: (mode: 'actualizar' | 'nuevo') => void
  onOpenVersion: (path: string) => void
}) {
  const [tab, setTab] = useState<Tab>('estilo')
  const { plan, proyecto } = view
  const s: Style = plan.style
  const e = plan.edit
  const t = usePlayhead((st) => st.t)
  const piece = selected !== null ? plan.pieces[selected] : null
  const tweaks = e.ajustes && Object.keys(e.ajustes).length > 0
  const busy = render?.estado === 'renderizando'

  return (
    <div className="inspector">
      <div className="tabs">
        {(
          [
            ['estilo', 'Estilo'],
            ['texto', 'Texto'],
            ['corte', 'Corte'],
            ['musica', 'Música'],
            ['exportar', 'Exportar'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {l}
            {k === 'exportar' && busy ? ` ${render?.progreso ?? 0}%` : ''}
          </button>
        ))}
      </div>

      <div className="inspector-body">
        {tab === 'estilo' && (
          <>
            <div className="style-pick">
              <select value={e.estilo ?? ''} onChange={(ev) => onEdit({ estilo: ev.target.value || null, ajustes: null })}>
                <option value="">{status?.gustos.estiloPorDefecto ? `Por defecto (${status.gustos.estiloPorDefecto})` : 'Estilo base'}</option>
                {status?.estilos.map((st) => (
                  <option key={st.nombre} value={st.nombre}>
                    {st.nombre}
                  </option>
                ))}
              </select>
              {tweaks && <span className="badge">con cambios</span>}
            </div>
            <div className="row-btns">
              {plan.styleName !== 'base' && (
                <button className="btn" disabled={!tweaks} onClick={() => onSaveStyle('actualizar')} title="Guarda estos cambios en el estilo para los próximos reels">
                  Guardar en «{plan.styleName}»
                </button>
              )}
              <button className="btn" onClick={() => onSaveStyle('nuevo')}>
                Guardar como estilo nuevo
              </button>
              {tweaks && (
                <button className="btn ghost" onClick={() => onEdit({ ajustes: null })}>
                  Deshacer cambios
                </button>
              )}
            </div>

            <Section title="Formato y encuadre" open>
              <Choice label="Formato" value={s.formato} options={[['9:16', '9:16 Reels'], ['4:5', '4:5 Feed'], ['1:1', '1:1 Cuadrado'], ['16:9', '16:9 Horizontal']]} onChange={(v) => onTweak('formato', v)} />
              <Choice label="Encuadre" value={s.encuadre.modo} options={[['cover', 'Llenar (hablando a cámara)'], ['blur', 'Completo con fondo difuminado (pantalla)']]} onChange={(v) => onTweak('encuadre.modo', v)} />
              <Slider label="Horizontal" value={s.encuadre.x} min={0} max={1} step={0.01} fmt={pct} onChange={(v) => onTweak('encuadre.x', v)} />
              <Slider label="Vertical" value={s.encuadre.y} min={0} max={1} step={0.01} fmt={pct} onChange={(v) => onTweak('encuadre.y', v)} />
            </Section>

            <Section title="Cortes automáticos" open>
              <Toggle label="Cortar pausas" value={s.cortes.activo} onChange={(v) => onTweak('cortes.activo', v)} />
              <Slider label="Pausa máxima" value={s.cortes.pausaMax} min={0.15} max={2} step={0.05} fmt={(v) => `${v.toFixed(2)} s`} onChange={(v) => onTweak('cortes.pausaMax', v)} />
              <Slider label="Aire en cada corte" value={s.cortes.margen} min={0} max={0.3} step={0.01} fmt={(v) => `${v.toFixed(2)} s`} onChange={(v) => onTweak('cortes.margen', v)} />
              <Slider label="Sensibilidad al silencio" value={s.cortes.silencioDb} min={-50} max={-20} step={1} fmt={(v) => `${v} dB`} onChange={(v) => onTweak('cortes.silencioDb', v)} />
              <Toggle label="Quitar muletillas (eh, mmm)" value={s.cortes.quitarMuletillas} onChange={(v) => onTweak('cortes.quitarMuletillas', v)} />
            </Section>

            <Section title="Zooms">
              <Toggle label="Zooms automáticos" value={s.zoom.activo} onChange={(v) => onTweak('zoom.activo', v)} />
              <Choice label="Tipo" value={s.zoom.tipo} options={[['golpe', 'Golpe (punch-in)'], ['suave', 'Suave (empuje lento)']]} onChange={(v) => onTweak('zoom.tipo', v)} />
              <Slider label="Intensidad" value={s.zoom.escala} min={1.02} max={1.5} step={0.01} fmt={(v) => `${v.toFixed(2)}×`} onChange={(v) => onTweak('zoom.escala', v)} />
              <Slider label="Cada cuántos cortes" value={s.zoom.cada} min={1} max={6} step={1} onChange={(v) => onTweak('zoom.cada', v)} />
            </Section>

            <Section title="Subtítulos" open>
              <Toggle label="Mostrar subtítulos" value={s.subtitulos.activo} onChange={(v) => onTweak('subtitulos.activo', v)} />
              <Choice label="Animación" value={s.subtitulos.animacion} options={[['palabra', 'Palabra resaltada'], ['pop', 'Frase que aparece'], ['frase', 'Simple']]} onChange={(v) => onTweak('subtitulos.animacion', v)} />
              <Choice label="Tipografía" value={s.subtitulos.fuente} options={[...new Set([s.subtitulos.fuente, ...FONTS])].map((f) => [f, f] as [string, string])} onChange={(v) => onTweak('subtitulos.fuente', v)} />
              <Slider label="Tamaño" value={s.subtitulos.tamano} min={0.03} max={0.15} step={0.002} fmt={pct} onChange={(v) => onTweak('subtitulos.tamano', v)} />
              <Slider label="Altura" value={s.subtitulos.altura} min={0.1} max={0.92} step={0.01} fmt={pct} onChange={(v) => onTweak('subtitulos.altura', v)} />
              <Slider label="Palabras por frase" value={s.subtitulos.palabras} min={1} max={8} step={1} onChange={(v) => onTweak('subtitulos.palabras', v)} />
              <Colour label="Color" value={s.subtitulos.color} onChange={(v) => onTweak('subtitulos.color', v)} />
              <Colour label="Palabra resaltada" value={s.subtitulos.resaltado} onChange={(v) => onTweak('subtitulos.resaltado', v)} />
              <Colour label="Contorno" value={s.subtitulos.contorno} onChange={(v) => onTweak('subtitulos.contorno', v)} />
              <Slider label="Grosor del contorno" value={s.subtitulos.grosor} min={0} max={0.3} step={0.01} fmt={pct} onChange={(v) => onTweak('subtitulos.grosor', v)} />
              <Toggle label="Mayúsculas" value={s.subtitulos.mayusculas} onChange={(v) => onTweak('subtitulos.mayusculas', v)} />
              <Toggle label="Sombra" value={s.subtitulos.sombra} onChange={(v) => onTweak('subtitulos.sombra', v)} />
            </Section>

            <Section title="Título gancho">
              <Toggle label="Mostrar título" value={s.titulo.activo} onChange={(v) => onTweak('titulo.activo', v)} />
              <Slider label="Duración" value={s.titulo.segundos} min={0.5} max={10} step={0.1} fmt={(v) => `${v.toFixed(1)} s`} onChange={(v) => onTweak('titulo.segundos', v)} />
              <Slider label="Tamaño" value={s.titulo.tamano} min={0.03} max={0.15} step={0.002} fmt={pct} onChange={(v) => onTweak('titulo.tamano', v)} />
              <Slider label="Altura" value={s.titulo.altura} min={0.05} max={0.9} step={0.01} fmt={pct} onChange={(v) => onTweak('titulo.altura', v)} />
              <Colour label="Texto" value={s.titulo.color} onChange={(v) => onTweak('titulo.color', v)} />
              <Colour label="Fondo" value={s.titulo.fondo} onChange={(v) => onTweak('titulo.fondo', v)} />
              <Choice label="Tipografía" value={s.titulo.fuente} options={[...new Set([s.titulo.fuente, ...FONTS])].map((f) => [f, f] as [string, string])} onChange={(v) => onTweak('titulo.fuente', v)} />
            </Section>

            <Section title="Color">
              <Slider label="Contraste" value={s.color.contraste} min={0.5} max={1.6} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => onTweak('color.contraste', v)} />
              <Slider label="Saturación" value={s.color.saturacion} min={0} max={2} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => onTweak('color.saturacion', v)} />
              <Slider label="Brillo" value={s.color.brillo} min={-0.3} max={0.3} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => onTweak('color.brillo', v)} />
            </Section>

            <Section title="Sonido">
              <Slider label="Volumen final" value={s.audio.lufs} min={-24} max={-9} step={1} fmt={(v) => `${v} LUFS`} onChange={(v) => onTweak('audio.lufs', v)} />
              <Toggle label="Limpiar ruido de fondo" value={s.audio.limpiar} onChange={(v) => onTweak('audio.limpiar', v)} />
            </Section>
          </>
        )}

        {tab === 'texto' && (
          <>
            <label className="ctl ctl-block">
              <span>Título gancho (primeros segundos)</span>
              <input type="text" value={e.titulo} placeholder="Ej. El error que te cuesta clientes" onChange={(ev) => onEdit({ titulo: ev.target.value })} />
            </label>
            <div className="panel-head">
              <span className="label">Textos en pantalla</span>
              <button className="btn" onClick={() => onEdit({ textos: [...e.textos, { texto: 'TEXTO', inicio: Number(t.toFixed(2)), fin: Number(Math.min(plan.length, t + 2).toFixed(2)), altura: 0.3 }] })}>
                + Agregar en {clock(t)}
              </button>
            </div>
            {!e.textos.length && <p className="muted small">Agrega una palabra clave, un número o un llamado a la acción. También puedes seleccionar palabras en la transcripción.</p>}
            {e.textos.map((tx, i) => {
              const set = (patch: Partial<typeof tx>) => onEdit({ textos: e.textos.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
              return (
                <div key={i} className="text-item">
                  <input type="text" value={tx.texto} onChange={(ev) => set({ texto: ev.target.value })} />
                  <div className="text-item-row">
                    <label>
                      De <input type="number" step={0.1} min={0} value={tx.inicio} onChange={(ev) => set({ inicio: Number(ev.target.value) })} />
                    </label>
                    <label>
                      a <input type="number" step={0.1} min={0} value={tx.fin} onChange={(ev) => set({ fin: Number(ev.target.value) })} />
                    </label>
                    <input type="color" value={tx.color ?? '#FFFFFF'} onChange={(ev) => set({ color: ev.target.value.toUpperCase() })} />
                    <button className="btn-icon" title="Quitar" onClick={() => onEdit({ textos: e.textos.filter((_, j) => j !== i) })}>
                      🗑
                    </button>
                  </div>
                  <Slider label="Altura" value={tx.altura ?? 0.3} min={0.05} max={0.95} step={0.01} fmt={pct} onChange={(v) => set({ altura: v })} />
                  <Slider label="Tamaño" value={tx.tamano ?? s.subtitulos.tamano} min={0.03} max={0.15} step={0.002} fmt={pct} onChange={(v) => set({ tamano: v })} />
                </div>
              )
            })}
          </>
        )}

        {tab === 'corte' && (
          <>
            {!piece && <p className="muted">Haz clic en un corte de la línea de tiempo para verlo aquí. También puedes arrastrar sus orillas para recortarlo o extenderlo.</p>}
            {piece && selected !== null && (
              <>
                <div className="kv">
                  <span>Corte</span>
                  <b>
                    {selected + 1} de {plan.pieces.length}
                  </b>
                  <span>Del original</span>
                  <b>
                    {proyecto.fuentes.length > 1 ? `grabación ${piece.source + 1}, ` : ''}
                    {clock(piece.start)} – {clock(piece.end)}
                  </b>
                  <span>Dura</span>
                  <b>{(piece.end - piece.start).toFixed(2)} s</b>
                  <span>En el reel</span>
                  <b>{clock(piece.at)}</b>
                </div>
                <div className="row-btns">
                  <button className="btn danger" onClick={() => onEdit(dropPiece(e, piece))}>
                    ✂ Quitar este corte
                  </button>
                  <button
                    className="btn"
                    disabled={t <= piece.at || t >= piece.at + piece.end - piece.start}
                    onClick={() => onEdit(dropRange(e, { fuente: piece.source + 1, inicio: piece.start, fin: piece.start + (t - piece.at) }))}
                    title="Q"
                  >
                    Recortar inicio hasta el cabezal
                  </button>
                  <button
                    className="btn"
                    disabled={t <= piece.at || t >= piece.at + piece.end - piece.start}
                    onClick={() => onEdit(dropRange(e, { fuente: piece.source + 1, inicio: piece.start + (t - piece.at), fin: piece.end }))}
                    title="W"
                  >
                    Recortar final desde el cabezal
                  </button>
                </div>
                <Section title="Zoom en este corte" open>
                  <Slider
                    label="Zoom"
                    value={piece.zoom}
                    min={1}
                    max={1.6}
                    step={0.01}
                    fmt={(v) => (v <= 1.001 ? 'sin zoom' : `${v.toFixed(2)}×`)}
                    onChange={(v) => {
                      const mid = (piece.start + piece.end) / 2
                      const others = e.zooms.filter((z) => !((z.fuente ?? 1) === piece.source + 1 && z.t >= piece.start && z.t < piece.end))
                      onEdit({ zooms: [...others, { fuente: piece.source + 1, t: Number(mid.toFixed(3)), escala: v }] })
                    }}
                  />
                  <button className="btn ghost" onClick={() => onEdit({ zooms: e.zooms.filter((z) => !((z.fuente ?? 1) === piece.source + 1 && z.t >= piece.start && z.t < piece.end)) })}>
                    Volver al ritmo del estilo
                  </button>
                </Section>
              </>
            )}
            <Section title="Lo que quitaste y recuperaste a mano">
              <p className="muted small">
                {e.quitar.length} partes quitadas · {e.forzar.length} recuperadas
              </p>
              {(e.quitar.length > 0 || e.forzar.length > 0) && (
                <button className="btn ghost" onClick={() => onEdit({ quitar: [], forzar: [] })}>
                  Volver a los cortes automáticos
                </button>
              )}
            </Section>
          </>
        )}

        {tab === 'musica' && (
          <>
            <label className="ctl ctl-block">
              <span>Canción</span>
              <select value={e.musica ?? ''} onChange={(ev) => onEdit({ musica: ev.target.value || null })}>
                <option value="">Sin música</option>
                {e.musica && !status?.musica.some((m) => m.ruta === e.musica) && <option value={e.musica}>{e.musica.split('/').pop()}</option>}
                {status?.musica.map((m) => (
                  <option key={m.ruta} value={m.ruta}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
            {!status?.musica.length && <p className="muted small">Pon canciones en Películas → Nexy → musica, o pídele a Nexy que haga una.</p>}
            <Slider label="Volumen" value={s.musica.volumen} min={0} max={1} step={0.01} fmt={pct} onChange={(v) => onTweak('musica.volumen', v)} />
            <Toggle label="Bajar la música cuando hablas" value={s.musica.ducking} onChange={(v) => onTweak('musica.ducking', v)} />
          </>
        )}

        {tab === 'exportar' && (
          <>
            <div className="row-btns">
              <button className="btn" disabled={busy || !plan.pieces.length} onClick={() => onRender(true)}>
                Vista previa rápida
              </button>
              <button className="btn primary" disabled={busy || !plan.pieces.length} onClick={() => onRender(false)}>
                Exportar en alta calidad
              </button>
            </div>
            {render && (
              <div className={`render-state ${render.estado}`}>
                {render.estado === 'renderizando' && (
                  <>
                    <div className="progress">
                      <div style={{ width: `${render.progreso ?? 0}%` }} />
                    </div>
                    <span className="small">
                      Renderizando {render.vistaPrevia ? 'vista previa' : 'versión final'}… {render.progreso ?? 0}%
                    </span>
                  </>
                )}
                {render.estado === 'listo' && <span className="small">✅ Listo: {render.salida?.split('/').pop()}</span>}
                {render.estado === 'error' && <span className="small">❌ {render.error}</span>}
              </div>
            )}
            <p className="muted small">
              {clock(plan.length)} · 1080×1920 · H.264 · voz a {s.audio.lufs} LUFS. Los videos quedan en Películas → Nexy → listos.
            </p>
            <div className="panel-head">
              <span className="label">Versiones</span>
            </div>
            {!proyecto.versiones.length && <p className="muted small">Todavía no exportas este reel.</p>}
            {[...proyecto.versiones].reverse().map((v, i) => (
              <div key={v.salida} className="version">
                <button className="btn-link" onClick={() => onOpenVersion(v.salida)}>
                  ▶ v{proyecto.versiones.length - i}
                  {v.vistaPrevia ? ' (vista previa)' : ''}
                </button>
                <span className="muted small">
                  {new Date(v.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })} · {v.estilo}
                </span>
                <a className="btn-link" href={mediaUrl(v.salida)} target="_blank" rel="noreferrer">
                  abrir
                </a>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
