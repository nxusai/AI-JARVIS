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

import { abrirOido } from './ultron/voz.js'

const h = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const SUGERENCIAS = ['Resumen de hoy', '¿Qué tengo para revisar?', '¿Qué está atrasado?', 'Mándame el catálogo de Mi Semago', 'Crea una tarea']

let estado = null
let sonando = null

/** Pone (o quita) el orbe según quién entró. */
export function montarUltron({ yo, preguntar, accion, avisar, consola, transcribir, vivo, herramientas, contexto, muestra = false }) {
  desmontarUltron()
  if (!yo) return
  estado = { yo, preguntar, accion, avisar, consola, transcribir, vivo, herramientas, contexto, muestra, mensajes: [], despierto: false, porVoz: false, sinVivo: !vivo }
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
    .replace(/\n/g, '<br>')}</div>${acciones ? `<div class="u-acciones">${acciones}</div>` : ''}<button class="u-voz" data-u-voz="${m.id}" aria-label="Escuchar"${m.esperandoVoz ? ' disabled' : ''}>${m.esperandoVoz ? '… preparando su voz' : '▶ Escuchar'}</button></div>`
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

// Un solo reproductor para su voz: el iPhone solo deja sonar audio que la persona
// "desbloqueó" con un toque, así que se reusa el mismo (desbloqueado al prender la llamada).
let reproductor = null
/** Con un toque de la persona, el iPhone deja sonar audio después: se desbloquea el reproductor. */
async function desbloquearAudio() {
  reproductor = reproductor || new Audio()
  try {
    reproductor.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
    await reproductor.play()
  } catch {}
}
/**
 * En el iPhone, mientras el micrófono está abierto, el sonido sale por la bocina
 * del oído (como en una llamada) y el micrófono oye la voz de Ultron. Por eso es
 * por turnos, como un radio: mientras Ultron habla, el micrófono se cierra (su voz
 * sale por la bocina grande y no se interrumpe sola) y al terminar se vuelve a abrir.
 */
function modoAudio(tipo) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = tipo
  } catch {}
}

function tocar(url) {
  try {
    sonando?.pause()
  } catch {}
  // Cierra el oído de la llamada antes de hablar (bocina grande, sin oírse a sí mismo).
  if (llamada?.oido) {
    llamada.oido.parar()
    llamada.oido = null
  }
  modoAudio('playback')
  sonando = reproductor || new Audio()
  let termino = false
  const alTerminar = () => {
    if (termino) return
    termino = true
    modoAudio('auto')
    if (llamada) abrirEscucha()
  }
  sonando.onplaying = () => pintarLlamada('hablando')
  sonando.onended = alTerminar
  sonando.onpause = () => {
    // Pausa de verdad (no el cambio de audio): "Que se calle".
    if (sonando && !sonando.ended && sonando.currentTime > 0) alTerminar()
  }
  sonando.src = url
  sonando.play().catch(() => {
    estado.avisar('Tu iPhone no dejó reproducir el audio. Revisa que no esté en silencio.')
    alTerminar()
  })
}

// ---- Llamada con Ultron: manos libres, como en la consola ----
// Hablas, se transcribe solo, Ultron contesta con su voz y vuelve a escucharte.
// "Que se calle" lo detiene; "Terminar" cuelga.
let llamada = null
const sinSignos = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const ALTO = /^(?:ultr[oó]n[,\s]*)?(?:para|párale|alto|silencio|cállate|callate|basta|espera|stop)[.!]*$/i
const FASES = { conectando: 'Conectando…', escuchando: 'Te escucho', oyendo: 'Te escucho…', entendiendo: 'Entendiendo…', pensando: 'Pensando…', hablando: 'Hablando' }

function pintarLlamada(fase) {
  if (!llamada) return
  if (fase) llamada.fase = fase
  const caja = document.querySelector('.u-llamada')
  if (!caja) return
  caja.dataset.fase = llamada.fase
  caja.querySelector('[data-u-fase]').textContent = FASES[llamada.fase] || ''
  const ultimo = [...estado.mensajes].reverse().find((m) => m.de === 'ultron')
  caja.querySelector('[data-u-dijo]').textContent = llamada.fase === 'pensando' || llamada.fase === 'entendiendo' ? llamada.yoDije || '' : ultimo?.texto?.replace(/\*\*/g, '').slice(0, 280) || ''
}

async function empezarLlamada() {
  if (llamada) return
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return estado.avisar('Este navegador no puede hablar con Ultron. Escríbele.')
  await desbloquearAudio()
  grabando?.parar()
  const panel = document.querySelector('.ultron-panel')
  const caja = document.createElement('div')
  caja.className = 'u-llamada'
  caja.innerHTML = `
    <div class="u-llamada-orbe"><span></span></div>
    <b data-u-fase></b>
    <p data-u-dijo></p>
    <div class="u-llamada-botones">
      <button type="button" class="btn" data-u-silencio>Que se calle</button>
      <button type="button" class="btn u-colgar" data-u-colgar>Terminar</button>
    </div>`
  panel?.append(caja)
  caja.querySelector('[data-u-colgar]').addEventListener('click', terminarLlamada)
  caja.querySelector('[data-u-silencio]').addEventListener('click', () => {
    try {
      sonando?.pause()
    } catch {}
  })
  llamada = { fase: 'conectando', oido: null, yoDije: '' }
  pintarLlamada()
  await abrirEscucha()
}

/** Abre el micrófono para el siguiente turno de la persona. */
async function abrirEscucha() {
  if (!llamada || llamada.oido || llamada.abriendo) return
  llamada.abriendo = true
  modoAudio('play-and-record')
  const oido = await abrirOido({
    empieza() {
      pintarLlamada('oyendo')
    },
    nivel(v) {
      document.querySelector('.u-llamada-orbe')?.style.setProperty('--nivel', v.toFixed(2))
    },
    async termina(blob, ms) {
      if (!llamada) return
      if (ms < 350) return pintarLlamada('escuchando')
      pintarLlamada('entendiendo')
      let dicho = ''
      try {
        dicho = (await estado.transcribir(blob)).trim()
      } catch (err) {
        pintarLlamada('escuchando')
        return estado.avisar(err.message || 'No te pude oír')
      }
      if (!llamada) return
      if (!dicho || ALTO.test(dicho)) return pintarLlamada('escuchando')
      const ultimo = [...estado.mensajes].reverse().find((m) => m.de === 'ultron')
      if (dicho.length > 8 && sinSignos(ultimo?.texto).includes(sinSignos(dicho))) return pintarLlamada('escuchando')
      llamada.yoDije = dicho
      pintarLlamada('pensando')
      estado.porVoz = true
      await enviar(dicho)
      const ult = estado.mensajes[estado.mensajes.length - 1]
      // Sin voz (o no llegó): de vuelta a escuchar.
      if (llamada && !ult?.esperandoVoz && !ult?.voz && llamada.fase === 'pensando') pintarLlamada('escuchando')
    },
    error(msg) {
      estado.avisar(`${msg} Puedes escribirle.`)
      terminarLlamada()
    },
  })
  if (!llamada) return oido.parar()
  llamada.abriendo = false
  // Mientras Ultron habla no se escucha (por turnos).
  if (sonando && !sonando.paused && !sonando.ended) return oido.parar()
  llamada.oido = oido
  if (!oido.vivo()) return terminarLlamada()
  try {
    await oido.despertar?.()
  } catch {}
  pintarLlamada('escuchando')
}

function terminarLlamada() {
  const l = llamada
  llamada = null
  if (l?.vivo) void cerrarVivo()
  l?.oido?.parar()
  try {
    sonando?.pause()
  } catch {}
  modoAudio('auto')
  document.querySelector('.u-llamada')?.remove()
}

// Hablarle a Ultron: toca el micrófono, habla, y vuelve a tocarlo (o calla 2 segundos).
// La frase se escribe sola (ElevenLabs Scribe, en Netlify) y se manda; si le hablaste,
// Ultron te contesta también con su voz.
let grabando = null
async function microfono(boton) {
  if (grabando) return grabando.parar()
  void desbloquearAudio()
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
  // Ultron en vivo (ElevenLabs): contesta al instante y no depende de la Mac.
  if (!estado.sinVivo && !estado.porVoz) {
    estado.mensajes.push({ id: ++nMsg, de: 'yo', texto })
    repintarChats()
    const ses = await sesionVivo(false)
    if (ses) {
      estado.pensando = true
      repintarChats()
      try {
        ses.sendUserMessage(texto)
      } catch {
        estado.pensando = false
      }
    }
    return
  }
  estado.mensajes.push({ id: ++nMsg, de: 'yo', texto })
  estado.pensando = true
  document.querySelectorAll('.orbe-mini').forEach((o) => o.classList.add('piensa'))
  repintarChats()
  try {
    const conVoz = estado.porVoz
    const msg = { id: ++nMsg, de: 'ultron', texto: '', acciones: [], voz: null }
    const r = await estado.preguntar(texto, {
      // Su voz llega unos segundos después del texto.
      onVoz: (url) => {
        msg.esperandoVoz = false
        if (url) msg.voz = url
        repintarChats()
        if (url && conVoz) tocar(url)
        else if (!url && llamada?.fase === 'pensando') pintarLlamada('escuchando')
      },
    })
    Object.assign(msg, { texto: r.texto, acciones: r.acciones, voz: r.voz, esperandoVoz: Boolean(r.vozLuego) })
    estado.mensajes.push(msg)
    // Si le hablaste, te contesta hablando.
    if (conVoz && r.voz) tocar(r.voz)
  } catch (err) {
    estado.mensajes.push({ id: ++nMsg, de: 'ultron', texto: `No pude responder ahora: ${err.message}` })
  } finally {
    estado.porVoz = false
    estado.pensando = false
    document.querySelectorAll('.orbe-mini').forEach((o) => o.classList.remove('piensa'))
    repintarChats()
  }
}

// ---- Ultron en vivo: su agente de ElevenLabs (voz en tiempo real, como Ana Sofi) ----
// La página le pide a Netlify un permiso de un solo uso (ultron-vivo) y habla directo
// con ElevenLabs. Lo que Ultron consulta (tareas, archivos) lo resuelven las
// "herramientas" de la página, con la sesión de quien habla. Si no está preparado,
// queda el Ultron de antes (el que corre en la Mac).
const SDK = 'https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.32.0/+esm'
let sdk = null
const cargarSdk = () => (sdk ||= import(/* @vite-ignore */ SDK).catch((err) => ((sdk = null), Promise.reject(err))))
let vivo = null // { ses, voz, nivel }

async function sesionVivo(voz) {
  if (vivo && vivo.voz === voz) return vivo.ses
  await cerrarVivo()
  let cred
  try {
    ;[cred] = await Promise.all([estado.vivo(), cargarSdk()])
  } catch (err) {
    // Nada de regresar en silencio al Ultron viejo: se dice qué pasó.
    fallaVivo(err.message || String(err))
    return null
  }
  const { Conversation } = await cargarSdk()
  const hora = new Date().getHours()
  const nombre = primerNombreU() || 'Director'
  const saludo = voz ? `${hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'}${primerNombreU() ? `, ${primerNombreU()}` : ''}. ¿En qué te ayudo?` : ''
  const historia = estado.mensajes.filter((m) => m.texto && !m.inicial).slice(-6).map((m) => `${m.de === 'yo' ? nombre : 'Ultron'}: ${m.texto}`).join('\n')
  const base = {
    clientTools: estado.herramientas || {},
    dynamicVariables: { ...(estado.contexto?.() || {}), nombre, saludo },
    overrides: voz ? {} : { conversation: { textOnly: true }, agent: { firstMessage: '' } },
    onMessage: ({ source, message }) => {
      if (!message) return
      if (source === 'ai') {
        estado.pensando = false
        estado.mensajes.push({ id: ++nMsg, de: 'ultron', texto: message, vivo: true })
      } else if (voz) estado.mensajes.push({ id: ++nMsg, de: 'yo', texto: message })
      else return
      repintarChats()
      pintarLlamada()
    },
    onModeChange: ({ mode }) => pintarLlamada(mode === 'speaking' ? 'hablando' : 'escuchando'),
    onDisconnect: () => {
      if (vivo?.voz && llamada) terminarLlamada()
      vivo = null
      estado.pensando = false
      repintarChats()
    },
    onError: (m) => estado.avisar(`Ultron: ${m}`),
  }
  let ses
  try {
    ses = await Conversation.startSession(
      cred.conversationToken && voz ? { ...base, conversationToken: cred.conversationToken, connectionType: 'webrtc', textOnly: false } : { ...base, signedUrl: cred.signedUrl, connectionType: 'websocket', textOnly: !voz },
    )
  } catch (err) {
    if (voz && cred.signedUrl) {
      try {
        ses = await Conversation.startSession({ ...base, signedUrl: cred.signedUrl, connectionType: 'websocket', textOnly: false })
      } catch (err2) {
        fallaVivo(err2.message || String(err2))
        return null
      }
    } else {
      fallaVivo(err.message || String(err))
      return null
    }
  }
  vivo = { ses, voz }
  if (historia) {
    try {
      ses.sendContextualUpdate(`Lo que ya hablaron en este chat:\n${historia}`)
    } catch {}
  }
  return ses
}

function fallaVivo(motivo) {
  estado.pensando = false
  estado.mensajes.push({ id: ++nMsg, de: 'ultron', inicial: true, texto: `No pude conectarme en vivo: ${motivo}` })
  repintarChats()
}

async function cerrarVivo() {
  const v = vivo
  vivo = null
  clearInterval(v?.nivel)
  try {
    await v?.ses?.endSession()
  } catch {}
}

async function llamadaVivo() {
  const caja = cajaLlamada()
  llamada = { fase: 'conectando', vivo: true, yoDije: '' }
  pintarLlamada()
  caja.querySelector('[data-u-silencio]').textContent = 'Silenciar mi micrófono'
  const ses = await sesionVivo(true)
  if (!ses) {
    llamada = null
    caja.remove()
    return false
  }
  if (!llamada) {
    await cerrarVivo()
    return true
  }
  pintarLlamada('escuchando')
  vivo.nivel = setInterval(() => {
    let n = 0
    try {
      n = llamada?.fase === 'hablando' ? ses.getOutputVolume() : ses.getInputVolume()
    } catch {}
    document.querySelector('.u-llamada-orbe')?.style.setProperty('--nivel', Math.min(1, n * 2.2).toFixed(2))
  }, 80)
  return true
}

function cajaLlamada() {
  document.querySelector('.u-llamada')?.remove()
  const caja = document.createElement('div')
  caja.className = 'u-llamada'
  caja.innerHTML = `
    <div class="u-llamada-orbe"><span></span></div>
    <b data-u-fase></b>
    <p data-u-dijo></p>
    <div class="u-llamada-botones">
      <button type="button" class="btn" data-u-silencio>Que se calle</button>
      <button type="button" class="btn u-colgar" data-u-colgar>Terminar</button>
    </div>`
  document.querySelector('.ultron-panel')?.append(caja)
  caja.querySelector('[data-u-colgar]').addEventListener('click', terminarLlamada)
  caja.querySelector('[data-u-silencio]').addEventListener('click', (e) => {
    if (llamada?.vivo && vivo?.ses) {
      llamada.mudo = !llamada.mudo
      try {
        vivo.ses.setMicMuted(llamada.mudo)
      } catch {}
      e.currentTarget.textContent = llamada.mudo ? 'Activar mi micrófono' : 'Silenciar mi micrófono'
      return
    }
    try {
      sonando?.pause()
    } catch {}
  })
  return caja
}

/** Su primer nombre (o el de su usuario, si no tiene nombre guardado). */
const primerNombreU = () => {
  const n = String(estado.yo.nombre || estado.yo.usuario || '').trim().split(/\s+/)[0] || ''
  return n ? n[0].toUpperCase() + n.slice(1) : ''
}

function despertar() {
  if (estado.despierto) return
  estado.despierto = true
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  estado.mensajes.push({
    id: ++nMsg,
    de: 'ultron',
    inicial: true,
    texto: `${saludo}${primerNombreU() ? `, ${primerNombreU()}` : ''}. Te ayudo con el Centro de trabajo: tareas, archivos y catálogos. Escríbeme o toca 📞 Hablar.`,
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
      ${estado.transcribir || estado.vivo ? '<button class="btn chico u-hablar" data-u-llamar title="Platica con Ultron por voz, manos libres">📞 Hablar</button>' : ''}
      <button class="btn chico" data-u-consola title="Abre la consola de Ultron en otra pestaña">Consola ↗</button>
      <button class="cerrar" data-u-cerrar aria-label="Dormir a Ultron">×</button>
    </header>
    ${chatHtml()}`
  document.body.append(p)
  conectarChat(p)
  p.querySelector('[data-u-cerrar]').addEventListener('click', cerrarPanel)
  p.querySelector('[data-u-consola]').addEventListener('click', () => estado.consola?.())
  p.querySelector('[data-u-llamar]')?.addEventListener('click', hablar)
  // Que todo esté listo antes de tocar "Hablar".
  if (!estado.sinVivo) cargarSdk().catch(() => {})
  if (!matchMedia('(max-width: 760px)').matches) setTimeout(() => p.querySelector('input')?.focus(), 350)
}

/** Un solo toque: en vivo si está preparado; si no, la llamada de antes. */
async function hablar() {
  if (llamada) return
  // Con Ultron en vivo disponible, solo él (sin regresar al de la Mac).
  if (!estado.sinVivo) return void llamadaVivo()
  if (estado.transcribir) empezarLlamada()
}

function cerrarPanel() {
  terminarLlamada()
  void cerrarVivo()
  // Al volver a abrirlo, un chat nuevo.
  estado.mensajes = []
  estado.despierto = false
  estado.pensando = false
  grabando?.parar()
  try {
    sonando?.pause()
  } catch {}
  document.querySelector('.ultron-panel')?.remove()
  document.querySelector('.orbe')?.classList.remove('oculto')
}
