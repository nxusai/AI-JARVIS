// Ultron en el Centro de trabajo: un orbe animado en la esquina (solo para
// las cabezas de las empresas). Al tocarlo, Ultron despierta: un chat con él
// y, aparte, su consola, con las IAs que tiene debajo.
//
// La página no piensa: le pasa la pregunta a `preguntar` y enseña lo que
// regresa. En la muestra contesta datos-muestra.js; en el sistema real, el
// Ultron que corre en el cerebro (vía el buzón en Supabase).

const h = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const SUGERENCIAS = ['Resumen de hoy', '¿Qué está atrasado?', '¿Qué hizo Ana Sofi?', 'Mándame el catálogo de Mi Semago']

let estado = null

/** Pone (o quita) el orbe según quién entró. */
export function montarUltron({ yo, preguntar, equipo, accion, avisar }) {
  desmontarUltron()
  if (!yo) return
  estado = { yo, preguntar, equipo, accion, avisar, mensajes: [], despierto: false }
  const orbe = document.createElement('button')
  orbe.className = 'orbe'
  orbe.setAttribute('aria-label', 'Despertar a Ultron')
  orbe.innerHTML = '<span class="orbe-giro"></span><span class="orbe-nucleo"></span><span class="orbe-nombre">Ultron</span>'
  orbe.addEventListener('click', abrirPanel)
  document.body.append(orbe)
}

export function desmontarUltron() {
  document.querySelectorAll('.orbe, .ultron-panel, .consola-u').forEach((el) => el.remove())
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
      if (a?.archivo) estado.accion?.(a)
      else if (a?.pregunta) enviar(a.pregunta)
    }
  })
}

function repintarChats() {
  document.querySelectorAll('[data-u-mensajes]').forEach(pintarMensajes)
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
    texto: `${saludo}, ${estado.yo.nombre.split(' ')[0]}. Estoy despierto y al tanto de todo. ¿Qué necesitas?`,
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
      <div><b>ULTRON</b><span>En línea · te escucha</span></div>
      <button class="btn chico" data-u-consola>Consola ↗</button>
      <button class="cerrar" data-u-cerrar aria-label="Dormir a Ultron">×</button>
    </header>
    ${chatHtml()}`
  document.body.append(p)
  conectarChat(p)
  p.querySelector('[data-u-cerrar]').addEventListener('click', cerrarPanel)
  p.querySelector('[data-u-consola]').addEventListener('click', abrirConsola)
  setTimeout(() => p.querySelector('input')?.focus(), 350)
}

function cerrarPanel() {
  document.querySelector('.ultron-panel')?.remove()
  document.querySelector('.orbe')?.classList.remove('oculto')
}

// -- la consola, aparte -------------------------------------------------------

async function abrirConsola() {
  cerrarPanel()
  despertar()
  document.querySelector('.orbe')?.classList.add('oculto')
  const eq = await estado.equipo()
  const c = document.createElement('section')
  c.className = 'consola-u'
  c.innerHTML = `
    <header class="cu-barra">
      ${orbeChico('despierta')}
      <div><b>ULTRON</b><span>Consola</span></div>
      <span class="cu-quien">${h(estado.yo.nombre)}</span>
      <button class="btn chico" data-cu-cerrar>← Volver al Centro de trabajo</button>
    </header>
    <div class="cu-cuerpo">
      <div class="cu-izq">
        <section class="cu-arbol" aria-label="Lo que controla Ultron">
          <div class="cu-nodo cu-raiz">${orbeChico()}<div><b>Ultron</b><span>Dirección · ${eq.cabezas.map(h).join(', ')}</span></div></div>
          <div class="cu-ramas">
            ${eq.ias
              .map(
                (ia) => `
              <article class="cu-nodo ${ia.activa ? '' : 'pronto'}" style="--color-emp:${ia.color}">
                <div class="cu-avatar">${h(ia.nombre.slice(0, 1))}</div>
                <div class="cu-info">
                  <b>${h(ia.nombre)}</b><span>${h(ia.empresa)}</span>
                  <em class="${ia.activa ? 'on' : ''}">${ia.activa ? '● Activa' : 'Próximamente'}</em>
                </div>
              </article>`,
              )
              .join('')}
          </div>
        </section>
        <section class="cu-hoy">
          <h2>Hoy, en corto</h2>
          ${eq.resumen
            .map(
              (r, i) => `
            <div class="cu-linea">
              <div><b>${h(r.quien)}</b> ${h(r.corto)}</div>
              <button class="btn chico fantasma" data-cu-mas="${i}">Explicación completa</button>
              <p class="cu-largo" hidden>${h(r.largo)}</p>
            </div>`,
            )
            .join('')}
        </section>
        <section class="cu-alertas">
          <h2>Para atender</h2>
          ${eq.alertas.length ? eq.alertas.map((a) => `<div class="cu-alerta">${h(a)}</div>`).join('') : '<p class="ayuda">Nada urgente.</p>'}
        </section>
      </div>
      <section class="cu-chat" aria-label="Hablar con Ultron">
        <h2>Habla con Ultron</h2>
        ${chatHtml()}
      </section>
    </div>`
  document.body.append(c)
  document.body.style.overflow = 'hidden'
  conectarChat(c.querySelector('.cu-chat'))
  c.querySelector('[data-cu-cerrar]').addEventListener('click', () => {
    c.remove()
    document.body.style.overflow = ''
    document.querySelector('.orbe')?.classList.remove('oculto')
  })
  c.querySelectorAll('[data-cu-mas]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = b.nextElementSibling
      p.hidden = !p.hidden
      b.textContent = p.hidden ? 'Explicación completa' : 'Ocultar'
    }),
  )
}
