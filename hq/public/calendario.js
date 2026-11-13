// El calendario de Eduardo (solo él). Lo de su Google Calendar (cuenta de NXUS) va y viene:
// lo que anota aquí se escribe en Google y lo de Google sale aquí (meetings, cumpleaños,
// fechas importantes). Encima, en colores, lo de HQ que NO va a Google: paydays de clientes,
// días de preparar cada corte, vencimiento de tareas, sus pendientes con fecha y citas con prospectos.
import { eventosFinanzas } from './finanzas.js'

const CAPAS = {
  importante: ['Fechas importantes', '#f0b6d6'],
  meeting: ['Meetings', '#7fb2ff'],
  google: ['Google', '#e3c896'],
  payday: ['Payday', '#7ee2a8'],
  corte: ['Cortes', '#ffb48a'],
  pendiente: ['Mis pendientes', '#c9a6ff'],
  tarea: ['Tareas', '#b9c2d0'],
}
const TIPOS = { evento: 'Evento', recordatorio: 'Recordatorio', importante: 'Fecha importante', cumple: 'Cumpleaños' }
const REPETIR = { '': 'No se repite', anual: 'Cada año', mensual: 'Cada mes', semanal: 'Cada semana' }
const AVISOS = { 0: 'Sin aviso', 10: '10 min antes', 60: '1 hora antes', 1440: '1 día antes', 10080: '1 semana antes' }
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deIso = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00`)
const hoyIso = () => iso(new Date())
const hora = (s) => new Date(s).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
const bonita = (s, largo = false) => {
  const t = deIso(s).toLocaleDateString('es-MX', largo ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Un evento de Google → un evento del calendario de HQ (en la fecha local). */
function deGoogle(e) {
  const fecha = e.todo_el_dia ? e.inicio : iso(new Date(e.inicio))
  const capa = ['cumple', 'importante'].includes(e.tipo) || (e.todo_el_dia && e.recurrente) ? 'importante' : e.portal || e.meet || e.invitados > 0 ? 'meeting' : 'google'
  return { ...e, fecha, capa, hora: e.todo_el_dia ? '' : hora(e.inicio), fuente: 'google' }
}

export async function vistaCalendario(v, ctx) {
  const { D, h, $, $$, titulo, intenta, mostrar, abrirModal, cerrarModal, aviso } = ctx
  titulo('Calendario')
  const salto = Number(sessionStorage.getItem('hq-cal-mes') || 0)
  let ocultas = []
  try {
    ocultas = JSON.parse(localStorage.getItem('hq-cal-ocultas') || '[]')
  } catch {}
  const hoy = new Date()
  const ref = new Date(hoy.getFullYear(), hoy.getMonth() + salto, 1)
  const Y = ref.getFullYear()
  const Mo = ref.getMonth()
  const ini = new Date(Y, Mo, 1)
  ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7)) // lunes
  const fin = new Date(Y, Mo + 1, 0)
  fin.setDate(fin.getDate() + (7 - ((fin.getDay() + 6) % 7)) % 7 + 1) // después del domingo
  const desde = iso(ini)
  const hasta = iso(fin)
  const anioDesde = hoyIso()
  const anioHasta = iso(new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate()))

  // Google: el mes que se ve y, para "Fechas importantes", el año que viene.
  let errorGoogle = ''
  const [mesG, anioG, fin_, tareas, pendientes, prospectos] = await Promise.all([
    D.calListar(new Date(`${desde}T00:00:00`), new Date(`${hasta}T00:00:00`)).catch((e) => ((errorGoogle = e.message), [])),
    D.calListar(new Date(`${anioDesde}T00:00:00`), new Date(`${anioHasta}T00:00:00`)).catch(() => []),
    eventosFinanzas(D, ctx, desde, hasta).catch(() => []),
    D.tareas().catch(() => []),
    D.pendientes ? D.pendientes().catch(() => []) : [],
    D.prospectos().catch(() => []),
  ])
  const google = mesG.map(deGoogle)
  const citasGoogle = new Set(google.filter((e) => !e.todo_el_dia).map((e) => new Date(e.inicio).getTime()))
  const hq = [
    ...fin_.map((x) => ({ ...x, capa: x.tipo, fuente: 'hq' })),
    ...tareas.filter((t) => t.vence && t.estado !== 'hecha' && t.vence >= desde && t.vence < hasta).map((t) => ({ fecha: t.vence, capa: 'tarea', titulo: `☐ ${t.titulo}`, detalle: 'Vence esta tarea', ruta: 'tareas', fuente: 'hq' })),
    ...pendientes.filter((p) => p.fecha && p.estado !== 'hecho' && p.fecha >= desde && p.fecha < hasta).map((p) => ({ fecha: p.fecha, capa: 'pendiente', titulo: `✓ ${p.titulo}`, hora: p.hora ? String(p.hora).slice(0, 5) : '', detalle: 'Mis pendientes', ruta: 'pendientes', fuente: 'hq' })),
    // Citas con prospectos que no estén ya en Google (las del portal ya están).
    ...prospectos
      .filter((x) => x.cita && !citasGoogle.has(new Date(x.cita).getTime()))
      .map((x) => ({ fecha: iso(new Date(x.cita)), capa: 'meeting', titulo: `📞 ${x.empresa || x.nombre}`, hora: hora(x.cita), detalle: 'Cita con prospecto', ruta: `prospecto/${x.id}`, fuente: 'hq' }))
      .filter((x) => x.fecha >= desde && x.fecha < hasta),
  ]
  const todos = [...google, ...hq].filter((e) => !ocultas.includes(e.capa)).sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.hora || '').localeCompare(String(b.hora || '')))
  const delDia = (f) => todos.filter((e) => e.fecha === f)

  const importantes = anioG
    .map(deGoogle)
    .filter((e) => e.capa === 'importante')
    .reduce((acc, e) => (acc.some((x) => x.titulo === e.titulo && x.fecha === e.fecha) ? acc : [...acc, e]), [])
    .slice(0, 40)
  const proximos = todos.filter((e) => e.fecha >= hoyIso() && e.fecha <= iso(new Date(Date.now() + 14 * 864e5))).slice(0, 25)

  const chip = (e) => `<button class="cal-chip c-${e.capa}" data-ev="${encodeURIComponent(JSON.stringify({ id: e.id || '', fecha: e.fecha, fuente: e.fuente, ruta: e.ruta || '' }))}" title="${h(e.titulo)}${e.detalle ? ` · ${h(e.detalle)}` : ''}">${e.hora ? `<b>${h(e.hora)}</b> ` : ''}${h(e.titulo)}</button>`
  const celdas = []
  for (let d = new Date(ini); iso(d) < hasta; d.setDate(d.getDate() + 1)) {
    const f = iso(d)
    const evs = delDia(f)
    celdas.push(`<div class="cal-dia ${d.getMonth() !== Mo ? 'fuera' : ''} ${f === hoyIso() ? 'hoy' : ''}" data-dia="${f}"><span class="num">${d.getDate()}</span>${evs.slice(0, 3).map(chip).join('')}${evs.length > 3 ? `<button class="cal-mas" data-dia-mas="${f}">+${evs.length - 3} más</button>` : ''}</div>`)
  }
  const mesTxt = (() => {
    const t = ref.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return t.charAt(0).toUpperCase() + t.slice(1)
  })()
  const lista = (xs, vacio) => (xs.length ? `<ul class="cal-lista">${xs.map((e) => `<li class="c-${e.capa}"><span class="punto-c"></span><div><b>${h(e.titulo)}</b><small>${bonita(e.fecha)}${e.hora ? ` · ${h(e.hora)}` : ''}${e.detalle ? ` · ${h(e.detalle)}` : ''}</small></div></li>`).join('')}</ul>` : `<p class="vacio">${vacio}</p>`)

  v.innerHTML = `
    <div class="acciones cal-nav"><div class="segmento"><button data-cm="-1" aria-label="Mes anterior">←</button><button class="on">${h(mesTxt)}</button><button data-cm="1" aria-label="Mes siguiente">→</button></div>${salto ? '<button class="btn chico" data-cm="0">Hoy</button>' : ''}<button class="btn primario" id="cal-nuevo">+ Evento</button></div>
    ${errorGoogle ? `<div class="tarjeta semaforo amarillo"><span class="luz"></span><div><b>Tu Google Calendar no está conectado todavía</b><small>${h(errorGoogle)} Mientras, aquí ves lo de HQ.</small></div></div>` : ''}
    <div class="cal-capas">${Object.entries(CAPAS).map(([k, [t, c]]) => `<button class="cal-capa ${ocultas.includes(k) ? 'off' : ''}" data-capa="${k}" style="--c:${c}"><i></i>${t}</button>`).join('')}</div>
    <div class="cal-cuerpo">
      <div class="tarjeta cal-mes"><div class="cal-sem">${DIAS.map((d) => `<span>${d}</span>`).join('')}</div><div class="cal-grid">${celdas.join('')}</div></div>
      <aside class="cal-lado">
        <div class="tarjeta"><h3>Lo que viene <small>14 días</small></h3>${lista(proximos, 'Nada en los próximos 14 días.')}</div>
        <div class="tarjeta"><h3>Fechas importantes <small>el año que viene</small></h3>${lista(importantes, 'Agrega cumpleaños y fechas importantes con “+ Evento” (se repiten cada año y quedan en tu Google Calendar).')}</div>
      </aside>
    </div>
    <p class="nota">Lo que agregas aquí se guarda en tu Google Calendar (cuenta de NXUS) y lo de Google sale aquí. Paydays, cortes, tareas, tus pendientes y citas con prospectos solo se ven en HQ. Solo tú ves este calendario.</p>`

  // ---- acciones
  $$('[data-cm]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-cal-mes', b.dataset.cm === '0' ? '0' : String(salto + Number(b.dataset.cm))), mostrar())))
  $$('[data-capa]', v).forEach(
    (b) =>
      (b.onclick = () => {
        const k = b.dataset.capa
        ocultas = ocultas.includes(k) ? ocultas.filter((x) => x !== k) : [...ocultas, k]
        try {
          localStorage.setItem('hq-cal-ocultas', JSON.stringify(ocultas))
        } catch {}
        mostrar()
      }),
  )
  $('#cal-nuevo', v).onclick = () => formEvento(null, hoyIso())
  const abrirDia = (f) => {
    const evs = delDia(f)
    abrirModal(
      `<h2>${bonita(f, true)}</h2>${evs.length ? `<ul class="cal-lista">${evs.map((e) => `<li class="c-${e.capa}"><span class="punto-c"></span><div><b>${h(e.titulo)}</b><small>${e.hora ? `${h(e.hora)} · ` : ''}${h(e.detalle || CAPAS[e.capa]?.[0] || '')}${e.meet ? ` · <a href="${h(e.meet)}" target="_blank" rel="noopener">Abrir Meet ↗</a>` : ''}</small></div>${e.fuente === 'google' ? `<button class="enlace" data-editar="${h(e.id)}">editar</button>` : e.ruta ? `<a class="enlace" href="#${h(e.ruta)}" data-cerrar>ver</a>` : ''}</li>`).join('')}</ul>` : '<p class="vacio">Nada este día.</p>'}
       <div class="acciones"><button class="btn primario" id="dia-nuevo">+ Evento este día</button><button class="btn" data-cerrar>Cerrar</button></div>`,
      (caja) => {
        $('#dia-nuevo', caja).onclick = () => formEvento(null, f)
        $$('[data-editar]', caja).forEach((b) => (b.onclick = () => formEvento(google.find((e) => e.id === b.dataset.editar), f)))
      },
    )
  }
  $$('[data-dia]', v).forEach((c) => (c.onclick = (e) => !e.target.closest('.cal-chip') && abrirDia(c.dataset.dia)))
  $$('[data-dia-mas]', v).forEach((b) => (b.onclick = (e) => (e.stopPropagation(), abrirDia(b.dataset.diaMas))))
  $$('.cal-chip', v).forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation()
        const x = JSON.parse(decodeURIComponent(b.dataset.ev))
        if (x.fuente === 'google') formEvento(google.find((g) => g.id === x.id), x.fecha)
        else if (x.ruta) location.hash = `#${x.ruta}`
      }),
  )

  // ---- el formulario de un evento (nuevo o de Google)
  function formEvento(ev, fecha) {
    const nuevo = !ev
    const t = ev?.tipo || (ev?.capa === 'importante' ? 'importante' : 'evento')
    const hIni = ev && !ev.todo_el_dia ? new Date(ev.inicio).toTimeString().slice(0, 5) : '09:00'
    const hFin = ev && !ev.todo_el_dia ? new Date(ev.fin).toTimeString().slice(0, 5) : '10:00'
    abrirModal(
      `<form id="f-ev"><h2>${nuevo ? 'Nuevo evento' : 'Evento de tu calendario'}</h2>
        <div class="campos">
          <label class="ancho">Qué<input name="titulo" required maxlength="200" value="${h(ev?.titulo || '')}" placeholder="Cumpleaños de mamá, aniversario, cita con el doctor…"></label>
          <label>Tipo<select name="tipo">${Object.entries(TIPOS).map(([k, x]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          <label>Fecha<input name="fecha" type="date" required value="${h(ev?.fecha || fecha)}"></label>
          <label class="check ancho"><input type="checkbox" name="todo_el_dia" ${ev ? (ev.todo_el_dia ? 'checked' : '') : ['cumple', 'importante'].includes(t) ? 'checked' : ''}> Todo el día</label>
          <label data-horas>Empieza<input name="hora_inicio" type="time" value="${hIni}"></label>
          <label data-horas>Termina<input name="hora_fin" type="time" value="${hFin}"></label>
          <label>Se repite<select name="repetir" ${ev && !nuevo && !ev.recurrente ? '' : ''}>${Object.entries(REPETIR).map(([k, x]) => `<option value="${k}" ${k === (ev ? (ev.recurrente ? 'anual' : '') : '') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
          ${nuevo ? `<label>Aviso<select name="aviso_min">${Object.entries(AVISOS).map(([k, x]) => `<option value="${k}" ${k === '1440' ? 'selected' : ''}>${x}</option>`).join('')}</select></label>` : ''}
          <label class="ancho">Notas<textarea name="descripcion" rows="2">${h(ev?.descripcion || '')}</textarea></label>
        </div>
        ${ev?.portal ? '<p class="nota">Es una cita del portal (con su Meet). Si la cambias aquí, el prospecto no se entera: mejor muévela desde su ficha.</p>' : ''}
        ${!nuevo && ev?.recurrente ? '<p class="nota">Se repite: los cambios aplican a todas las fechas.</p>' : ''}
        <div class="acciones"><button class="btn primario">${nuevo ? 'Guardar en mi calendario' : 'Guardar cambios'}</button>${nuevo ? '' : '<button type="button" class="btn peligro" id="ev-borrar">Borrar</button>'}<button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        const f = $('#f-ev', caja)
        const pintar = () => caja.querySelectorAll('[data-horas]').forEach((el) => (el.hidden = f.todo_el_dia.checked))
        f.tipo.onchange = () => {
          if (nuevo && ['cumple', 'importante'].includes(f.tipo.value)) {
            f.todo_el_dia.checked = true
            f.repetir.value = 'anual'
          }
          pintar()
        }
        f.todo_el_dia.onchange = pintar
        pintar()
        f.onsubmit = async (e) => {
          e.preventDefault()
          const x = Object.fromEntries(new FormData(f))
          const datos = { titulo: x.titulo.trim(), tipo: x.tipo, fecha: x.fecha, todo_el_dia: !!x.todo_el_dia, hora_inicio: x.hora_inicio, hora_fin: x.hora_fin, repetir: x.repetir, descripcion: x.descripcion.trim(), ...(nuevo ? { aviso_min: Number(x.aviso_min) || 0 } : {}) }
          const r = await intenta(() => (nuevo ? D.calCrear(datos) : D.calEditar(ev.id, datos)), nuevo ? 'Guardado en tu Google Calendar' : 'Cambios guardados')
          if (r) (cerrarModal(), mostrar())
        }
        $('#ev-borrar', caja)?.addEventListener('click', async () => {
          if (!confirm(ev.recurrente ? `¿Borrar "${ev.titulo}" de todas las fechas en las que se repite?` : `¿Borrar "${ev.titulo}" de tu calendario?`)) return
          if (await intenta(() => D.calBorrar(ev.id), 'Borrado')) (cerrarModal(), mostrar())
        })
      },
    )
  }
  void aviso
}
