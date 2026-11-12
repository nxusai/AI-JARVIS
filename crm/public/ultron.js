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
let sonando = null

/** Pone (o quita) el orbe según quién entró. */
export function montarUltron({ yo, preguntar, accion, avisar, consola, transcribir, muestra = false }) {
  desmontarUltron()
  if (!yo) return
  estado = { yo, preguntar, accion, avisar, consola, transcribir, muestra, mensajes: [], despierto: false, porVoz: false }
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
      ${estado?.transcribir ? '<button type="button" class="u-mic" data-u-mic aria-label="Hablarle a Ultron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>' : ''}
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
    if (b.dataset.uMic !== undefined) microfono(b)
    if (b.dataset.uVoz) {
      const m = estado.mensajes.find((x) => String(x.id) === b.dataset.uVoz)
      if (!m?.voz) return estado.avisar(m?.de === 'ultron' && estado.muestra ? 'Aquí Ultron lo dice con su voz (en la muestra no suena).' : 'Esta respuesta no trae voz.')
      try {
        sonando?.pause()
      } catch {}
      tocar(m.voz)
    }
    if (b.dataset.uAccion !== undefined) {
      const m = estado.mensajes.find((x) => String(x.id) === b.dataset.uMsg)
      const a = m?.acciones?.[Number(b.dataset.uAccion)]
      if (a?.pregunta) enviar(a.pregunta)
      else if (a) hacer(a, b)
    }
  })
}

function tocar(url) {
  try {
    sonando?.pause()
  } catch {}
  sonando = new Audio(url)
  sonando.play().catch(() => estado.avisar('Tu navegador no dejó reproducir el audio.'))
}

// Hablarle a Ultron: toca el micrófono, habla, y vuelve a tocarlo (o calla 2 segundos).
// La frase se escribe sola (ElevenLabs Scribe, en Netlify) y se manda; si le hablaste,
// Ultron te contesta también con su voz.
let grabando = null
async function microfono(boton) {
  if (grabando) return grabando.parar()
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return estado.avisar('Este navegador no puede grabar tu voz. Escríbele.')
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  } catch {
    return estado.avisar('Necesito permiso para usar el micrófono (en Ajustes del navegador).')
  }
  try {
    sonando?.pause()
  } catch {}
  const tipo = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
  const rec = tipo ? new MediaRecorder(stream, { mimeType: tipo }) : new MediaRecorder(stream)
  const partes = []
  rec.ondataavailable = (e) => e.data?.size && partes.push(e.data)
  // Silencio: si dejas de hablar 2 segundos, se manda solo.
  let ctx, reloj
  try {
    ctx = new AudioContext()
    const an = ctx.createAnalyser()
    an.fftSize = 1024
    ctx.createMediaStreamSource(stream).connect(an)
    const buf = new Float32Array(an.fftSize)
    let ultimaVoz = performance.now()
    let hablo = false
    reloj = setInterval(() => {
      an.getFloatTimeDomainData(buf)
      let e = 0
      for (const v of buf) e += v * v
      e = Math.sqrt(e / buf.length)
      boton.style.setProperty('--nivel', Math.min(1, e * 14).toFixed(2))
      if (e > 0.02) {
        ultimaVoz = performance.now()
        hablo = true
      }
      if (hablo && performance.now() - ultimaVoz > 2000) grabando?.parar()
    }, 80)
  } catch {}
  const limite = setTimeout(() => grabando?.parar(), 30000)
  boton.classList.add('grabando')
  boton.closest('form')?.querySelector('input')?.setAttribute('placeholder', 'Te escucho… toca el micrófono para mandar')
  grabando = {
    parar() {
      if (!grabando) return
      grabando = null
      clearTimeout(limite)
      clearInterval(reloj)
      try {
        ctx?.close()
      } catch {}
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        boton.classList.remove('grabando')
        boton.closest('form')?.querySelector('input')?.setAttribute('placeholder', 'Pregúntale a Ultron…')
        const blob = new Blob(partes, { type: rec.mimeType || tipo || 'audio/webm' })
        if (blob.size < 1500) return
        boton.classList.add('oyendo')
        try {
          const texto = await estado.transcribir(blob)
          if (!texto) return estado.avisar('No te alcancé a oír. Intenta otra vez.')
          estado.porVoz = true
          await enviar(texto)
        } catch (err) {
          estado.avisar(err.message || 'No te pude oír')
        } finally {
          boton.classList.remove('oyendo')
        }
      }
      try {
        rec.stop()
      } catch {
        rec.onstop()
      }
    },
  }
  rec.start()
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
    estado.mensajes.push({ id: ++nMsg, de: 'ultron', texto: r.texto, acciones: r.acciones, voz: r.voz })
    // Si le hablaste, te contesta hablando.
    if (estado.porVoz && r.voz) tocar(r.voz)
  } catch (err) {
    estado.mensajes.push({ id: ++nMsg, de: 'ultron', texto: `No pude responder ahora: ${err.message}` })
  } finally {
    estado.porVoz = false
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
  grabando?.parar()
  try {
    sonando?.pause()
  } catch {}
  document.querySelector('.ultron-panel')?.remove()
  document.querySelector('.orbe')?.classList.remove('oculto')
}
