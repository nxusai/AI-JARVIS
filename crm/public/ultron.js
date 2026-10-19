// Ultron en el Centro de trabajo: un orbe animado en la esquina (solo para
// las cabezas de las empresas). Al tocarlo, Ultron despierta: un chat con él.
//
// Aquí Ultron solo atiende el Centro de trabajo: resume, busca, manda archivos
// al correo y hace lo que la persona misma podría hacer (pedir una tarea,
// agregar instrucciones), siempre con su confirmación. Nunca borra ni cambia
// nada. Lo demás (las otras IAs, comunicaciones) es por Telegram o su consola,
// que es otra página (/ultron).
//
// La página no piensa: le pasa la pregunta a `preguntar` y enseña lo que
// regresa. En la muestra contesta datos-muestra.js; en el sistema real, el
// Ultron que corre en el cerebro (vía el buzón en Supabase).

const h = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const SUGERENCIAS = ['Resumen de hoy', '¿Qué tengo para revisar?', '¿Qué está atrasado?', 'Mándame el catálogo de Mi Semago', 'Crea una tarea']

let estado = null

/** Pone (o quita) el orbe según quién entró. */
export function montarUltron({ yo, preguntar, accion, avisar, consola }) {
  desmontarUltron()
  if (!yo) return
  estado = { yo, preguntar, accion, avisar, consola, mensajes: [], despierto: false }
  const orbe = document.createElement('button')
  orbe.className = 'orbe'
  orbe.setAttribute('aria-label', 'Despertar a Ultron')
  orbe.innerHTML = '<span class="orbe-giro"></span><span class="orbe-nucleo"></span><span class="orbe-nombre">Ultron</span>'
  orbe.addEventListener('click', abrirPanel)
  document.body.append(orbe)
}

export function desmontarUltron() {
  document.querySelectorAll('.orbe, .ultron-panel').forEach((el) => el.remove())
  estado = null
}

function orbeChico(clase = '') {
  return `<span class="orbe-mini ${clase}"><span class="orbe-giro"></span><span class="orbe-nucleo"></span></span>`
}

function burbuja(m) {
  if (m.de === 'yo') return `<div class="u-msg yo">${h(m.texto)}</div>`
  const acciones = (m.acciones ?? [])
    .map((a, i) => `<button class="btn chico" data-u-accion="${i}" data-u-msg="${m.id}">${h(a.etiqueta)}</button>`)
    .join('')
  return `<div class="u-msg ultron"><div class="u-texto">${h(m.texto)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>')}</div>${acciones ? `<div class="u-acciones">${acciones}</div>` : ''}<button class="u-voz" data-u-voz="${m.id}" aria-label="Escuchar">▶ Escuchar</button></div>`
}

function pintarMensajes(cont) {
  if (!cont) return
  cont.innerHTML = estado.mensajes.map(burbuja).join('') + (estado.pensando ? '<div class="u-msg ultron pensando"><i></i><i></i><i></i></div>' : '')
  cont.scrollTop = cont.scrollHeight
}

function chatHtml() {
  return `
    <div class="u-mensajes" data-u-mensajes></div>
    <div class="u-sugerencias">${SUGERENCIAS.map((s) => `<button class="u-sug" data-u-sug="${h(s)}">${h(s)}</button>`).join('')}</div>
    <form class="u-escribir" data-u-form>
      <input type="text" id="u-texto-${Math.random().toString(36).slice(2, 7)}" placeholder="Pregúntale a Ultron…" autocomplete="off" maxlength="1000" aria-label="Mensaje para Ultron">
      <button class="btn principal" aria-label="Enviar">➤</button>
    </form>`
}

function conectarChat(raiz) {
  const cont = raiz.querySelector('[data-u-mensajes]')
  pintarMensajes(cont)
  raiz.querySelector('[data-u-form]').addEventListener('submit', (e) => {
    e.preventDefault()
    const input = e.currentTarget.querySelector('input')
    enviar(input.value)
    input.value = ''
  })
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    if (b.dataset.uSug) enviar(b.dataset.uSug)
    if (b.dataset.uVoz) estado.avisar('Aquí Ultron lo dice con su voz de ElevenLabs (en la muestra no suena).')
    if (b.dataset.uAccion !== undefined) {
      const m = estado.mensajes.find((x) => String(x.id) === b.dataset.uMsg)
      const a = m?.acciones?.[Number(b.dataset.uAccion)]
      if (a?.pregunta) enviar(a.pregunta)
      else if (a) hacer(a, b)
    }
  })
}

function repintarChats() {
  document.querySelectorAll('[data-u-mensajes]').forEach(pintarMensajes)
}

/** Una acción que Ultron propuso y la persona confirmó con el botón. */
async function hacer(a, boton) {
  boton.disabled = true
  try {
    const r = await estado.accion(a)
    if (r) {
      estado.mensajes.push({ id: ++nMsg, de: 'ultron', texto: r })
      repintarChats()
    }
  } catch (err) {
    estado.mensajes.push({ id: ++nMsg, de: 'ultron', texto: `No se pudo: ${err.message}` })
    repintarChats()
  }
}

let nMsg = 0
async function enviar(texto) {
  texto = String(texto || '').trim()
  if (!texto || estado.pensando) return
  estado.mensajes.push({ id: ++nMsg, de: 'yo', texto })
  estado.pensando = true
  document.querySelectorAll('.orbe-mini').forEach((o) => o.classList.add('piensa'))
  repintarChats()
  try {
    const r = await estado.preguntar(texto)
    estado.mensajes.push({ id: ++nMsg, de: 'ultron', texto: r.texto, acciones: r.acciones })
  } catch (err) {
    estado.mensajes.push({ id: ++nMsg, de: 'ultron', texto: `No pude responder ahora: ${err.message}` })
  } finally {
    estado.pensando = false
    document.querySelectorAll('.orbe-mini').forEach((o) => o.classList.remove('piensa'))
    repintarChats()
  }
}

function despertar() {
  if (estado.despierto) return
  estado.despierto = true
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  estado.mensajes.push({
    id: ++nMsg,
    de: 'ultron',
    texto: `${saludo}, ${estado.yo.nombre.split(' ')[0]}. Aquí me encargo del Centro de trabajo: te resumo, te busco archivos y te ayudo a pedir tareas. ¿Qué necesitas?`,
  })
}

function abrirPanel() {
  if (document.querySelector('.ultron-panel')) return
  despertar()
  document.querySelector('.orbe')?.classList.add('oculto')
  const p = document.createElement('section')
  p.className = 'ultron-panel'
  p.setAttribute('role', 'dialog')
  p.setAttribute('aria-label', 'Ultron')
  p.innerHTML = `
    <header class="u-cabeza">
      ${orbeChico('despierta')}
      <div><b>ULTRON</b><span>En línea · Centro de trabajo</span></div>
      <button class="btn chico" data-u-consola title="Abre la consola de Ultron en otra pestaña">Consola ↗</button>
      <button class="cerrar" data-u-cerrar aria-label="Dormir a Ultron">×</button>
    </header>
    ${chatHtml()}`
  document.body.append(p)
  conectarChat(p)
  p.querySelector('[data-u-cerrar]').addEventListener('click', cerrarPanel)
  p.querySelector('[data-u-consola]').addEventListener('click', () => estado.consola?.())
  setTimeout(() => p.querySelector('input')?.focus(), 350)
}

function cerrarPanel() {
  document.querySelector('.ultron-panel')?.remove()
  document.querySelector('.orbe')?.classList.remove('oculto')
}
