// NEX dentro de HQ (solo Eduardo): un botón flotante en todas las pantallas.
//   ✍  Escribirle.
//   🎙 Dictar: hablas y lo escribe en la caja (lo revisas y lo mandas).
//   🎧 Conversación: hablas normal mientras trabajas; te contesta con su voz y lo puedes interrumpir.
//   🔊 Que también lea en voz alta lo que te escribe.
// Te lleva a la pantalla que pides, ilumina el botón que no encuentras, busca en todo HQ y
// te propone acciones que solo se hacen si tocas "Sí, hazlo". ⌘J (o Ctrl+J) lo abre.
import { abrirOido } from './nex/oido.js'

export function iniciarNex(ctx) {
  const { D, h, mostrar, aviso, yo, marcarEntrada, marcarSalida, paydays } = ctx
  if (document.getElementById('nex-orbe')) return
  const $ = (s, el = document) => el.querySelector(s)

  // ---------------------------------------------------------- estado
  let historial = []
  try {
    historial = JSON.parse(sessionStorage.getItem('hq-nex') || '[]').slice(-30)
  } catch {}
  let leerVoz = localStorage.getItem('hq-nex-voz') === '1'
  let oido = null // conversación en vivo
  let audio = null // lo que NEX está diciendo
  let pensando = false
  let grabadora = null // dictado
  const guardar = () => {
    try {
      sessionStorage.setItem('hq-nex', JSON.stringify(historial.slice(-30)))
    } catch {}
  }

  // ---------------------------------------------------------- la interfaz
  const orbe = Object.assign(document.createElement('button'), { id: 'nex-orbe', className: 'nex-orbe', title: 'NEX (⌘J)' })
  orbe.setAttribute('aria-label', 'Abrir NEX')
  orbe.innerHTML = '<span class="nex-anillo"></span><b>NEX</b>'
  const panel = Object.assign(document.createElement('section'), { id: 'nex-panel', className: 'nex-panel' })
  panel.hidden = true
  panel.setAttribute('aria-label', 'NEX')
  panel.innerHTML = `
    <header class="nex-cab">
      <div class="nex-yo"><span class="nex-punto"></span><div><b>NEX</b><small id="nex-estado">Tu asistente en HQ</small></div></div>
      <div class="nex-botones">
        <button type="button" id="nex-voz" title="Que lea en voz alta lo que te contesta">🔊</button>
        <button type="button" id="nex-conv" title="Conversación: hablas y te contesta con su voz">🎧</button>
        <button type="button" id="nex-limpiar" title="Empezar de nuevo">↺</button>
        <button type="button" id="nex-cerrar" title="Cerrar (Esc)">✕</button>
      </div>
    </header>
    <div class="nex-msgs" id="nex-msgs" aria-live="polite"></div>
    <form class="nex-form" id="nex-form">
      <textarea id="nex-texto" rows="1" placeholder="Escríbele a NEX… “llévame a Finanzas”, “no encuentro dónde pongo un gasto”"></textarea>
      <button type="button" id="nex-mic" title="Dictar: toca, habla y toca otra vez">🎙</button>
      <button type="submit" id="nex-enviar" title="Mandar">➤</button>
    </form>`
  document.body.append(orbe, panel)
  const msgs = $('#nex-msgs', panel)
  const caja = $('#nex-texto', panel)
  const estado = (t) => ($('#nex-estado', panel).textContent = t)
  const pintarBotones = () => {
    $('#nex-voz', panel).classList.toggle('on', leerVoz)
    $('#nex-conv', panel).classList.toggle('on', !!oido)
    orbe.classList.toggle('escucha', !!oido)
  }

  function burbuja(rol, html, clase = '') {
    const d = document.createElement('div')
    d.className = `nex-msg ${rol} ${clase}`
    d.innerHTML = html
    msgs.append(d)
    msgs.scrollTop = msgs.scrollHeight
    return d
  }
  const formato = (t) => h(t).replace(/\n/g, '<br>')
  function pintarHistorial() {
    msgs.innerHTML = ''
    if (!historial.length)
      burbuja(
        'nex',
        `Hola${yo?.nombre ? `, ${h(yo.nombre.split(' ')[0])}` : ''}. Pídeme lo que quieras mientras trabajas: <i>“llévame a las entradas”</i>, <i>“¿dónde pongo cómo me paga un cliente?”</i>, <i>“¿cuánto me sobra esta quincena?”</i>, <i>“ya llegó el pago de Abuelito”</i>. Toca 🎧 para hablar conmigo.`,
      )
    for (const m of historial) burbuja(m.role === 'user' ? 'yo' : 'nex', formato(m.content))
  }

  function abrir() {
    panel.hidden = false
    orbe.classList.add('abierto')
    if (!msgs.children.length) pintarHistorial()
    setTimeout(() => caja.focus(), 50)
  }
  function cerrar() {
    panel.hidden = true
    orbe.classList.remove('abierto')
  }
  orbe.onclick = () => (panel.hidden ? abrir() : cerrar())
  $('#nex-cerrar', panel).onclick = cerrar
  $('#nex-limpiar', panel).onclick = () => {
    historial = []
    guardar()
    pintarHistorial()
  }
  $('#nex-voz', panel).onclick = () => {
    leerVoz = !leerVoz
    try {
      localStorage.setItem('hq-nex-voz', leerVoz ? '1' : '0')
    } catch {}
    if (!leerVoz) callar()
    pintarBotones()
  }
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
      e.preventDefault()
      panel.hidden ? abrir() : cerrar()
    } else if (e.key === 'Escape' && !panel.hidden && document.getElementById('modal')?.hidden !== false) cerrar()
  })
  caja.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      $('#nex-form', panel).requestSubmit()
    }
  })
  caja.addEventListener('input', () => {
    caja.style.height = 'auto'
    caja.style.height = `${Math.min(140, caja.scrollHeight)}px`
  })
  $('#nex-form', panel).onsubmit = (e) => {
    e.preventDefault()
    const t = caja.value.trim()
    if (!t) return
    caja.value = ''
    caja.style.height = 'auto'
    preguntar(t, { voz: leerVoz })
  }

  // ---------------------------------------------------------- la pantalla que está viendo
  async function pantalla() {
    const vista = document.getElementById('vista')
    const botones = [...new Set([...(vista?.querySelectorAll('button, a.btn, a.enlace, .segmento button') ?? [])].map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter((t) => t && t.length <= 40))]
    let pd = []
    try {
      pd = ((await paydays()) ?? []).map((p) => ({ cliente_id: p.cliente.id, cliente: p.cliente.nombre, fecha: p.fecha, monto: p.monto, moneda: p.moneda }))
    } catch {}
    return {
      ruta: location.hash.slice(1) || 'inicio',
      titulo: document.getElementById('titulo')?.textContent || '',
      texto: (vista?.innerText || '').replace(/\n{3,}/g, '\n\n').slice(0, 7000),
      botones,
      paydays: pd,
      mesFinanzas: sessionStorage.getItem('hq-fin-mes') || '0',
    }
  }

  // ---------------------------------------------------------- hablar con NEX
  async function preguntar(texto, { voz = false } = {}) {
    if (pensando) return
    if (panel.hidden) abrir()
    callar()
    historial.push({ role: 'user', content: texto })
    guardar()
    burbuja('yo', formato(texto))
    const espera = burbuja('nex', '<span class="nex-puntos"><i></i><i></i><i></i></span>', 'pensando')
    pensando = true
    estado('Pensando…')
    try {
      const r = await D.nex(historial, await pantalla())
      espera.remove()
      historial.push({ role: 'assistant', content: r.texto })
      guardar()
      burbuja('nex', formato(r.texto))
      if (voz || leerVoz) decir(r.texto)
      for (const a of r.acciones ?? []) await hacer(a)
    } catch (err) {
      espera.remove()
      burbuja('nex', `⚠ ${h(err.message || 'No pude contestar')}`, 'error')
    } finally {
      pensando = false
      estado(oido ? 'Te escucho…' : 'Tu asistente en HQ')
    }
  }

  // ---------------------------------------------------------- lo que NEX hace en la pantalla
  const PANTALLAS = {
    finanzas: { hash: 'finanzas', ss: { 'hq-fin2': 'gastos', 'hq-fin-tipo': 'negocio' } },
    'finanzas/personal': { hash: 'finanzas', ss: { 'hq-fin2': 'gastos', 'hq-fin-tipo': 'personal' } },
    'finanzas/entradas': { hash: 'finanzas', ss: { 'hq-fin2': 'entradas' } },
    metas: { hash: 'metas', ss: { 'hq-metas': 'metas' } },
    'metas/habitos': { hash: 'metas', ss: { 'hq-metas': 'habitos' } },
    'metas/ahorro': { hash: 'metas', ss: { 'hq-metas': 'ahorro' } },
    nomina: { hash: 'nomina', ss: { 'hq-nomina': 'pagos' } },
    'nomina/asistencia': { hash: 'nomina', ss: { 'hq-nomina': 'asistencia' } },
    usuarios: { hash: 'personas' },
  }
  const listo = async () => {
    // Espera a que la pantalla nueva termine de cargar (y el momento Nueva York).
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 120))
      const v = document.getElementById('vista')
      if (!document.body.classList.contains('vista-ny') && v && !v.querySelector('.cargando') && !v.classList.contains('actualizando')) return
    }
  }
  async function irA(ruta) {
    const r = String(ruta || 'inicio').replace(/^#/, '')
    const p = PANTALLAS[r] ?? { hash: r }
    for (const [k, v] of Object.entries(p.ss ?? {})) sessionStorage.setItem(k, v)
    if (r.startsWith('finanzas')) sessionStorage.setItem('hq-fin-mes', '0')
    if (location.hash === `#${p.hash}`) mostrar()
    else location.hash = `#${p.hash}`
    await listo()
  }
  const normal = (t) =>
    String(t ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N} ]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  function senalar(objetivo) {
    const meta = normal(objetivo)
    if (!meta) return false
    const candidatos = [...document.querySelectorAll('#vista button, #vista a, #vista label, #vista h2, #vista h3, #vista th, #vista summary, .nav a, .reloj-top button')].filter((el) => el.offsetParent !== null)
    let mejor = null
    let puntos = 0
    for (const el of candidatos) {
      const t = normal(el.textContent)
      if (!t) continue
      const p = t === meta ? 100 : t.startsWith(meta) ? 80 - (t.length - meta.length) / 10 : t.includes(meta) ? 60 - (t.length - meta.length) / 20 : meta.includes(t) && t.length > 3 ? 40 : meta.split(' ').filter((w) => w.length > 2 && t.includes(w)).length * 10
      if (p > puntos) {
        puntos = p
        mejor = el
      }
    }
    if (!mejor || puntos < 10) return false
    document.querySelectorAll('.nex-foco').forEach((x) => x.classList.remove('nex-foco'))
    mejor.scrollIntoView({ block: 'center', behavior: 'smooth' })
    // Si el panel de NEX tapa lo que señala, el panel se hace a un lado.
    setTimeout(() => {
      const a = mejor.getBoundingClientRect()
      const b = panel.getBoundingClientRect()
      const tapa = !panel.hidden && a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
      if (tapa) panel.classList.add('izq')
    }, 450)
    mejor.classList.add('nex-foco')
    const r = mejor.getBoundingClientRect()
    const etiqueta = Object.assign(document.createElement('div'), { className: 'nex-aqui', textContent: 'Aquí está ✦' })
    document.body.append(etiqueta)
    const pon = () => {
      const q = mejor.getBoundingClientRect()
      etiqueta.style.left = `${Math.max(8, q.left + q.width / 2 - 55)}px`
      etiqueta.style.top = `${Math.max(8, q.top - 38)}px`
    }
    pon()
    const t = setInterval(pon, 100)
    void r
    setTimeout(() => {
      clearInterval(t)
      etiqueta.remove()
      mejor.classList.remove('nex-foco')
    }, 6000)
    return true
  }

  const hoyISO = () => new Date().toLocaleDateString('en-CA')
  const EJECUTAR = {
    pago_llego: (d) => D.guardarCobro({ cliente_id: d.cliente_id, concepto: '', monto: Number(d.monto), moneda: d.moneda || 'USD', fecha: hoyISO() < d.fecha ? d.fecha : hoyISO(), para_fecha: d.fecha, metodo: '', nota: 'Confirmado con NEX' }),
    pago_no_llego: (d) => D.omitirCobro({ cliente_id: d.cliente_id, fecha: d.fecha, motivo: 'No llegó (con NEX)' }),
    gasto_estado: (d) => {
      const n = new Date()
      return D.marcarGasto(d.gasto_id, `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${Number(d.mitad) === 2 ? 2 : 1}`, d.estado)
    },
    apuntar_pendiente: (d) => D.entenderPendientes(String(d.texto || '')),
    registrar_entrada: (d) => D.guardarCobro({ cliente_id: d.cliente_id || null, concepto: d.cliente_id ? '' : String(d.concepto || 'Entrada'), monto: Number(d.monto), moneda: d.moneda || 'USD', fecha: hoyISO(), para_fecha: null, metodo: '', nota: 'Con NEX' }),
    nueva_tarea: (d) => D.guardarTarea({ titulo: String(d.titulo || '').slice(0, 200), detalle: String(d.detalle || ''), vence: /^\d{4}-\d{2}-\d{2}$/.test(d.vence || '') ? d.vence : null, asignado: yo.id, estado: 'pendiente', cliente_id: null }),
    marcar_entrada: () => marcarEntrada(),
    marcar_salida: () => marcarSalida(),
  }
  function proponer(a) {
    if (!EJECUTAR[a.accion]) return
    const card = burbuja('nex', `<div class="nex-propuesta"><b>¿Lo hago?</b><span>${h(a.resumen)}</span><div class="nex-si-no"><button type="button" class="btn chico primario" data-si>Sí, hazlo</button><button type="button" class="btn chico" data-no>No</button></div></div>`, 'propuesta')
    $('[data-si]', card).onclick = async () => {
      card.querySelectorAll('button').forEach((b) => (b.disabled = true))
      try {
        await EJECUTAR[a.accion](a.datos ?? {})
        card.querySelector('.nex-si-no').innerHTML = '<span class="verde">✓ Hecho</span>'
        historial.push({ role: 'assistant', content: `(Hecho: ${a.resumen})` })
        guardar()
        aviso(`✓ ${a.resumen}`)
        mostrar()
        if (leerVoz || oido) decir('Listo.')
      } catch (err) {
        card.querySelector('.nex-si-no').innerHTML = `<span class="rojo">No se pudo: ${h(err.message || '')}</span>`
      }
    }
    $('[data-no]', card).onclick = () => {
      card.querySelector('.nex-si-no').innerHTML = '<small>Ok, no lo hice.</small>'
      historial.push({ role: 'assistant', content: `(No se hizo: ${a.resumen})` })
      guardar()
    }
  }
  async function hacer(a) {
    if (a.tipo === 'ir') await irA(a.ruta)
    else if (a.tipo === 'senalar') {
      if (!senalar(a.objetivo)) {
        await new Promise((r) => setTimeout(r, 600))
        senalar(a.objetivo)
      }
    } else if (a.tipo === 'proponer') proponer(a)
  }

  // ---------------------------------------------------------- su voz
  function callar() {
    if (audio) {
      try {
        audio.pause()
      } catch {}
      audio = null
    }
    window.speechSynthesis?.cancel()
    oido?.guardia(false)
    orbe.classList.remove('habla')
  }
  async function decir(texto) {
    callar()
    const t = String(texto || '').trim()
    if (!t) return
    orbe.classList.add('habla')
    estado('Hablando…')
    oido?.guardia(true)
    const fin = () => {
      orbe.classList.remove('habla')
      oido?.guardia(false)
      estado(oido ? 'Te escucho…' : 'Tu asistente en HQ')
    }
    try {
      const blob = await D.nexVoz(t)
      if (!blob) throw new Error('sin voz')
      const a = new Audio(URL.createObjectURL(blob))
      audio = a
      a.onended = () => audio === a && ((audio = null), fin())
      await a.play()
    } catch {
      // Sin la voz de NEX (muestra o sin conexión): la voz del navegador.
      const u = new SpeechSynthesisUtterance(t)
      u.lang = 'es-MX'
      u.onend = fin
      window.speechSynthesis?.speak(u)
    }
  }

  // ---------------------------------------------------------- dictar (🎙)
  const mic = $('#nex-mic', panel)
  mic.onclick = async () => {
    if (grabadora) {
      grabadora.stop()
      return
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      aviso('Dale permiso al micrófono para dictar', 'mal')
      return
    }
    const partes = []
    grabadora = new MediaRecorder(stream)
    grabadora.ondataavailable = (e) => e.data?.size && partes.push(e.data)
    grabadora.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      const tipo = grabadora.mimeType || 'audio/webm'
      grabadora = null
      mic.classList.remove('grabando')
      estado('Escribiendo lo que dijiste…')
      try {
        const texto = await D.nexOido(new Blob(partes, { type: tipo }))
        if (texto) {
          caja.value = (caja.value ? `${caja.value} ` : '') + texto
          caja.dispatchEvent(new Event('input'))
          caja.focus()
        }
      } catch (err) {
        aviso(err.message || 'No te entendí', 'mal')
      }
      estado('Tu asistente en HQ')
    }
    grabadora.start()
    mic.classList.add('grabando')
    estado('Te escucho… toca 🎙 para terminar')
  }

  // ---------------------------------------------------------- conversación (🎧)
  $('#nex-conv', panel).onclick = async () => {
    if (oido) {
      oido.parar()
      oido = null
      callar()
      estado('Tu asistente en HQ')
      pintarBotones()
      return
    }
    oido = await abrirOido({
      empieza() {
        // Si NEX está hablando y tú empiezas, se calla (lo puedes interrumpir).
        if (audio || window.speechSynthesis?.speaking) callar()
        estado('Te escucho…')
        orbe.classList.add('oyendo')
      },
      async termina(blob) {
        orbe.classList.remove('oyendo')
        if (pensando) return
        try {
          const texto = await D.nexOido(blob)
          if (texto && texto.replace(/[^\p{L}]/gu, '').length >= 2) preguntar(texto, { voz: true })
        } catch (err) {
          estado(err.message || 'No te entendí')
        }
      },
      nivel(n) {
        orbe.style.setProperty('--nivel', String(n))
      },
      error(m) {
        aviso(m, 'mal')
        oido = null
        pintarBotones()
      },
    })
    if (oido && !oido.vivo()) oido = null
    if (oido?.dormido()) await oido.despertar()
    estado(oido ? 'Te escucho… habla cuando quieras' : 'Tu asistente en HQ')
    pintarBotones()
    if (oido) abrir()
  }

  pintarBotones()
}
