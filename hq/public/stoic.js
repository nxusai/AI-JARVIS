// STOIC (solo Eduardo): su cuaderno de lo que aprende. Escribe (o dicta) lo que aprendió; la IA
// lo resume en bullets, lecciones y una frase, y le arma tarjetas para estudiar. Su IA (STOIC)
// solo conoce este cuaderno: le aconseja y le recuerda lo que escribió y cuándo.

const TIPOS = { libro: '📖 Libro', podcast: '🎧 Podcast', video: '▶ Video', curso: '🎓 Curso', conversacion: '💬 Conversación', vida: '🌱 Vida', idea: '💡 Idea', otro: '✦ Otro' }
const PESTANAS = { escribir: 'Escribir', biblioteca: 'Mi biblioteca', estudiar: 'Estudiar', stoic: 'Pregúntale a STOIC' }
const hoyIso = () => new Date().toLocaleDateString('en-CA')
const larga = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

export async function vistaStoic(v, ctx) {
  const { D, h, $, $$, titulo, intenta, mostrar, aviso } = ctx
  titulo('STOIC')
  let tab = sessionStorage.getItem('hq-stoic-tab')
  if (!PESTANAS[tab]) tab = 'escribir'
  const [notas, tarjetas] = await Promise.all([D.stoicNotas(), D.stoicTarjetas()])
  const hoy = hoyIso()
  const porRepasar = tarjetas.filter((t) => t.proximo <= hoy)
  // La de hoy: una lección de su cuaderno (cambia cada día).
  const todas = notas.flatMap((n) => [...(n.resumen?.lecciones ?? []), ...(n.resumen?.frase ? [n.resumen.frase] : [])].map((t) => ({ t, n })))
  const semilla = Number(hoy.replace(/-/g, '')) % Math.max(1, todas.length)
  const deHoy = todas[semilla]

  const cabeza = `
    <div class="stoic-cabeza tarjeta">
      <div><span class="eyebrow">STOIC · tu cuaderno de sabiduría</span>
        ${deHoy ? `<blockquote>“${h(deHoy.t)}”</blockquote><small>De lo que escribiste el ${larga(deHoy.n.fecha)}${deHoy.n.titulo ? ` · ${h(deHoy.n.titulo)}` : ''}</small>` : '<blockquote>“No es que tengamos poco tiempo, es que perdemos mucho.”</blockquote><small>Séneca · escribe tu primera nota y aquí verás cada día algo tuyo para tenerlo presente.</small>'}
      </div>
      <div class="stoic-cifras"><span><b>${notas.length}</b> notas</span><span><b>${porRepasar.length}</b> para repasar hoy</span></div>
    </div>
    <div class="acciones"><div class="segmento stoic-tabs">${Object.entries(PESTANAS).map(([k, t]) => `<button data-st="${k}" class="${tab === k ? 'on' : ''}">${t}${k === 'estudiar' && porRepasar.length ? ` <small>${porRepasar.length}</small>` : ''}</button>`).join('')}</div></div>`

  const tarjetaNota = (n, abierta = false) => {
    const r = n.resumen || {}
    return `<article class="tarjeta stoic-nota" data-nota="${n.id}">
      <div class="fila"><div><span class="chip">${TIPOS[n.tipo] || n.tipo}</span> <b>${h(n.titulo || r.titulo || 'Sin título')}</b>${n.autor ? ` <small>· ${h(n.autor)}</small>` : ''}</div><small>${larga(n.fecha)}</small></div>
      ${r.bullets?.length ? `<ul class="stoic-bullets">${r.bullets.map((b) => `<li>${h(b)}</li>`).join('')}</ul>` : ''}
      ${r.lecciones?.length ? `<div class="stoic-lecciones">${r.lecciones.map((l) => `<p>✦ ${h(l)}</p>`).join('')}</div>` : ''}
      ${r.frase ? `<blockquote class="stoic-frase">“${h(r.frase)}”</blockquote>` : ''}
      ${r.etiquetas?.length ? `<div class="stoic-etq">${r.etiquetas.map((e) => `<span>#${h(e)}</span>`).join('')}</div>` : ''}
      <details ${abierta ? 'open' : ''}><summary>Lo que escribí</summary><p class="stoic-texto">${h(n.texto).replace(/\n/g, '<br>')}</p></details>
      <div class="acciones"><button class="enlace" data-editar-nota="${n.id}">editar</button><button class="enlace" data-borrar-nota="${n.id}">borrar</button></div>
    </article>`
  }

  // ------------------------------------------------- Escribir
  function escribir() {
    const ultima = notas[0]
    return `<form class="tarjeta stoic-form" id="st-form">
        <div class="stoic-tipos">${Object.entries(TIPOS).map(([k, t], i) => `<label class="chip-btn"><input type="radio" name="tipo" value="${k}" ${i === 0 ? 'checked' : ''}> ${t}</label>`).join('')}</div>
        <div class="campos">
          <label>Título <small>el libro, el podcast, el tema…</small><input name="titulo" maxlength="200" placeholder="Meditaciones"></label>
          <label>De quién <small>opcional</small><input name="autor" maxlength="120" placeholder="Marco Aurelio"></label>
          <label>Fecha<input name="fecha" type="date" value="${hoy}" max="${hoy}"></label>
          <label class="ancho">Lo que aprendí <small>escríbelo como te salga; STOIC lo ordena</small><textarea name="texto" rows="9" required placeholder="Hoy entendí que…"></textarea></label>
        </div>
        <div class="acciones"><button class="btn primario">Guardar y resumir</button><button type="button" class="btn" id="st-dictar">🎙 Dictar</button></div>
      </form>
      ${ultima ? `<h2 class="grupo">Lo último que escribiste</h2>${tarjetaNota(ultima)}` : ''}`
  }

  // ------------------------------------------------- Biblioteca
  function biblioteca() {
    const q = sessionStorage.getItem('hq-stoic-q') || ''
    const t = sessionStorage.getItem('hq-stoic-t') || ''
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const lista = notas.filter((n) => (!t || n.tipo === t) && (!q || norm(`${n.titulo} ${n.autor} ${n.texto} ${JSON.stringify(n.resumen)}`).includes(norm(q))))
    return `<div class="tarjeta filtros-asis"><label>Buscar<input id="st-q" value="${h(q)}" placeholder="disciplina, dinero, Marco Aurelio…"></label><label>Tipo<select id="st-t"><option value="">Todo</option>${Object.entries(TIPOS).map(([k, x]) => `<option value="${k}" ${k === t ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
      ${lista.length ? lista.map((n) => tarjetaNota(n)).join('') : `<p class="vacio">${notas.length ? 'Nada con eso.' : 'Tu biblioteca está vacía. Empieza en “Escribir”.'}</p>`}`
  }

  // ------------------------------------------------- Estudiar (tarjetas con repaso espaciado)
  function estudiar() {
    const azar = sessionStorage.getItem('hq-stoic-azar') === '1'
    const mazo = azar ? [...tarjetas].sort(() => Math.random() - 0.5).slice(0, 10) : porRepasar
    const t = mazo[0]
    if (!t)
      return `<div class="tarjeta stoic-vacio"><h3>Nada que repasar hoy ✓</h3><p class="nota">${tarjetas.length ? 'Ya repasaste lo de hoy. Si quieres, repasa unas al azar.' : 'Cuando escribas notas, STOIC te arma tarjetas para estudiar aquí.'}</p>${tarjetas.length ? '<button class="btn" id="st-azar">Repasar al azar</button>' : ''}</div>`
    const n = notas.find((x) => x.id === t.nota_id)
    return `<div class="tarjeta stoic-carta" id="st-carta">
        <small>${mazo.length} por repasar${azar ? ' (al azar)' : ''}</small>
        <h2>${h(t.frente)}</h2>
        <div class="stoic-reverso" hidden><p>${h(t.reverso)}</p>${n ? `<small>De lo que escribiste el ${larga(n.fecha)}${n.titulo ? ` · ${h(n.titulo)}` : ''}</small>` : ''}</div>
        <div class="acciones" id="st-ver"><button class="btn primario" id="st-mostrar">Ver la respuesta</button></div>
        <div class="acciones" id="st-calif" hidden><button class="btn" data-calif="0" data-id="${t.id}">Otra vez <small>mañana</small></button><button class="btn primario" data-calif="1" data-id="${t.id}">Bien</button><button class="btn" data-calif="2" data-id="${t.id}">Fácil</button></div>
      </div>
      ${azar ? '<button class="enlace" id="st-salir-azar">Volver a las de hoy</button>' : ''}`
  }

  // ------------------------------------------------- Pregúntale a STOIC (su IA, aparte de NEX)
  let chat = []
  try {
    chat = JSON.parse(sessionStorage.getItem('hq-stoic-chat') || '[]').slice(-30)
  } catch {}
  function conversar() {
    const sugerencias = ['Dame un consejo para hoy con lo que he aprendido', '¿Qué he aprendido sobre la disciplina?', 'Recuérdame algo que escribí hace tiempo', 'Tengo una situación con una mujer y necesito consejo', '¿Qué errores o patrones me he dicho que no quiero repetir?']
    return `<div class="tarjeta stoic-chat">
        <div class="stoic-msgs" id="st-msgs">${
          chat.length
            ? chat.map((m) => `<div class="stoic-m ${m.role === 'user' ? 'yo' : 'el'}">${h(m.content).replace(/\n/g, '<br>')}</div>`).join('')
            : `<div class="stoic-m el">Soy STOIC. Solo conozco lo que has escrito aquí, y con eso te aconsejo y te recuerdo lo que aprendiste. ¿En qué piensas?</div>`
        }</div>
        <div class="stoic-sug">${sugerencias.map((s) => `<button type="button" class="chip-btn" data-sug="${h(s)}">${h(s)}</button>`).join('')}</div>
        <form class="nex-form" id="st-chat"><textarea id="st-preg" rows="1" placeholder="Pregúntale a STOIC…"></textarea><button type="button" id="st-mic" title="Dictar">🎙</button><button type="submit" title="Mandar">➤</button></form>
        ${chat.length ? '<button class="enlace" id="st-limpiar">Empezar una conversación nueva</button>' : ''}
      </div>
      <p class="nota">STOIC es un NEX aparte, solo para esta hoja: no ve nada más de HQ y el NEX de HQ no ve lo que escribes aquí.</p>`
  }

  const cuerpo = { escribir, biblioteca, estudiar, stoic: conversar }[tab]
  v.innerHTML = cabeza + cuerpo()

  // ------------------------------------------------- acciones
  $$('[data-st]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-stoic-tab', b.dataset.st), mostrar())))
  const dictarEn = async (boton, caja) => {
    // Dictado: graba hasta que toques otra vez y escribe lo que dijiste.
    if (boton._grab) return boton._grab.stop()
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      return aviso('Dale permiso al micrófono para dictar', 'mal')
    }
    const partes = []
    const g = new MediaRecorder(stream)
    boton._grab = g
    g.ondataavailable = (e) => e.data?.size && partes.push(e.data)
    g.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      boton._grab = null
      boton.classList.remove('grabando')
      try {
        const t = await D.nexOido(new Blob(partes, { type: g.mimeType || 'audio/webm' }))
        if (t) caja.value = (caja.value ? `${caja.value} ` : '') + t
      } catch (err) {
        aviso(err.message || 'No te entendí', 'mal')
      }
    }
    g.start()
    boton.classList.add('grabando')
  }
  $$('[data-borrar-nota]', v).forEach((b) => (b.onclick = async () => confirm('¿Borrar esta nota y sus tarjetas?') && (await intenta(() => D.stoicBorrar(b.dataset.borrarNota), 'Borrada')) && mostrar()))
  $$('[data-editar-nota]', v).forEach((b) => (b.onclick = () => editarNota(notas.find((n) => n.id === b.dataset.editarNota))))

  if (tab === 'escribir') {
    const f = $('#st-form', v)
    $('#st-dictar', v).onclick = (e) => dictarEn(e.currentTarget, f.texto)
    f.onsubmit = async (e) => {
      e.preventDefault()
      const x = Object.fromEntries(new FormData(f))
      const boton = f.querySelector('.primario')
      boton.disabled = true
      boton.textContent = 'STOIC lo está resumiendo…'
      const ok = await guardarNota({ tipo: x.tipo, titulo: x.titulo.trim(), autor: x.autor.trim(), fecha: x.fecha || hoy, texto: x.texto.trim() })
      boton.disabled = false
      boton.textContent = 'Guardar y resumir'
      if (ok) mostrar()
    }
  }
  if (tab === 'biblioteca') {
    let t
    $('#st-q', v).oninput = (e) => {
      clearTimeout(t)
      t = setTimeout(() => (sessionStorage.setItem('hq-stoic-q', e.target.value), mostrar()), 400)
    }
    $('#st-t', v).onchange = (e) => (sessionStorage.setItem('hq-stoic-t', e.target.value), mostrar())
  }
  if (tab === 'estudiar') {
    $('#st-azar', v)?.addEventListener('click', () => (sessionStorage.setItem('hq-stoic-azar', '1'), mostrar()))
    $('#st-salir-azar', v)?.addEventListener('click', () => (sessionStorage.removeItem('hq-stoic-azar'), mostrar()))
    $('#st-mostrar', v)?.addEventListener('click', () => {
      $('.stoic-reverso', v).hidden = false
      $('#st-ver', v).hidden = true
      $('#st-calif', v).hidden = false
    })
    $$('[data-calif]', v).forEach(
      (b) =>
        (b.onclick = async () => {
          const t = tarjetas.find((x) => x.id === b.dataset.id)
          const c = Number(b.dataset.calif)
          // Repaso espaciado sencillo: otra vez = mañana; bien = el doble (mín. 3 días); fácil = más del triple.
          const intervalo = c === 0 ? 1 : c === 1 ? Math.max(3, Math.round((t.intervalo || 1) * 2.2)) : Math.max(7, Math.round((t.intervalo || 2) * 3.5))
          const proximo = new Date(Date.now() + intervalo * 864e5).toLocaleDateString('en-CA')
          if (await intenta(() => D.stoicRepasar(t.id, { intervalo, proximo, repasos: (t.repasos || 0) + 1 }))) mostrar()
        }),
    )
  }
  if (tab === 'stoic') {
    const msgs = $('#st-msgs', v)
    msgs.scrollTop = msgs.scrollHeight
    const caja = $('#st-preg', v)
    const enviar = async (texto) => {
      if (!texto.trim()) return
      chat.push({ role: 'user', content: texto.trim() })
      msgs.insertAdjacentHTML('beforeend', `<div class="stoic-m yo">${h(texto)}</div><div class="stoic-m el pensando"><span class="nex-puntos"><i></i><i></i><i></i></span></div>`)
      msgs.scrollTop = msgs.scrollHeight
      try {
        const r = await D.stoicPreguntar(chat)
        chat.push({ role: 'assistant', content: r })
      } catch (err) {
        chat.push({ role: 'assistant', content: `⚠ ${err.message || 'No pude contestar'}` })
      }
      try {
        sessionStorage.setItem('hq-stoic-chat', JSON.stringify(chat.slice(-30)))
      } catch {}
      mostrar()
    }
    $('#st-chat', v).onsubmit = (e) => {
      e.preventDefault()
      const t = caja.value
      caja.value = ''
      enviar(t)
    }
    caja.addEventListener('keydown', (e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), $('#st-chat', v).requestSubmit()))
    $('#st-mic', v).onclick = (e) => dictarEn(e.currentTarget, caja)
    $$('[data-sug]', v).forEach((b) => (b.onclick = () => enviar(b.dataset.sug)))
    $('#st-limpiar', v)?.addEventListener('click', () => (sessionStorage.removeItem('hq-stoic-chat'), mostrar()))
  }

  /** Guarda (o cambia) una nota: STOIC la resume y arma sus tarjetas. */
  async function guardarNota(n, viejo = null) {
    const r = await intenta(() => D.stoicResumir(n))
    if (!r) return false
    const { tarjetas: cartas = [], titulo: tituloIA, ...resumen } = r
    const nota = await intenta(() => D.stoicGuardar({ ...(viejo ? { id: viejo.id } : {}), ...n, titulo: n.titulo || tituloIA || '', resumen }), viejo ? 'Nota actualizada' : 'Guardado en tu cuaderno ✦')
    if (!nota) return false
    if (viejo) await D.stoicBorrarTarjetasDe(viejo.id).catch(() => null)
    await D.stoicGuardarTarjetas(cartas.filter((c) => c.frente && c.reverso).map((c) => ({ nota_id: nota.id, frente: c.frente.slice(0, 500), reverso: c.reverso.slice(0, 1500), proximo: hoy }))).catch(() => null)
    return true
  }
  function editarNota(n) {
    ctx.abrirModal(
      `<form id="f-nota"><h2>Editar nota</h2><div class="campos">
        <label>Título<input name="titulo" maxlength="200" value="${h(n.titulo)}"></label><label>De quién<input name="autor" maxlength="120" value="${h(n.autor)}"></label>
        <label>Fecha<input name="fecha" type="date" value="${h(n.fecha)}" max="${hoy}"></label><label>Tipo<select name="tipo">${Object.entries(TIPOS).map(([k, x]) => `<option value="${k}" ${k === n.tipo ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="ancho">Lo que aprendí<textarea name="texto" rows="10" required>${h(n.texto)}</textarea></label></div>
        <p class="nota">Al guardar, STOIC lo vuelve a resumir y rehace sus tarjetas.</p>
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-nota', caja).onsubmit = async (e) => {
          e.preventDefault()
          const x = Object.fromEntries(new FormData(e.target))
          if (await guardarNota({ tipo: x.tipo, titulo: x.titulo.trim(), autor: x.autor.trim(), fecha: x.fecha, texto: x.texto.trim() }, n)) (ctx.cerrarModal(), mostrar())
        }
      },
    )
  }
}
