// PORTAFOLIO inteligente de NXUS (Eduardo y quien tenga el permiso "portafolio").
// Subes un trabajo (imágenes, PDF, video o link) → la IA escribe una ficha breve sin datos del cliente y
// marca lo confidencial → tú revisas el borroso → se guarda SOLO la versión borrosa (el original nunca se sube).
// Luego le pides un portafolio ("puros sitios web", "todo el historial") y te lo arma en PDF, y te prepara el
// paquete para hacer el video con Claude.

const CATEGORIAS = { web: 'Sitios web', app: 'Apps', automatizacion: 'Automatizaciones', ia: 'Agentes de IA', marketing: 'Marketing y anuncios', diseno: 'Diseño y marca', video: 'Video', contenido: 'Contenido', otro: 'Otro' }
const PESTANAS = { trabajos: 'Trabajos', agregar: '+ Agregar trabajo', pedir: 'Pedir portafolio', generados: 'Generados' }
const MAX_IMAGENES = 8
const CDN = {
  pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
}

// Lo que estás trabajando sigue aquí aunque la pantalla se vuelva a dibujar.
let entrada = { archivos: [], link: '', notas: '' }
let revision = null // { ficha, items: [{ img, zonas, todo }], link, notas }
let pedido = null // { id?, solicitud, idioma, para, resultado }

// ------------------------------------------------------------------ utilidades de imagen
const cargarScript = (src, global) =>
  window[global]
    ? Promise.resolve(window[global])
    : new Promise((ok, mal) => {
        const s = Object.assign(document.createElement('script'), { src, async: true })
        s.onload = () => ok(window[global])
        s.onerror = () => mal(new Error('No pude cargar una herramienta (revisa tu internet)'))
        document.head.append(s)
      })
const imagen = (src) =>
  new Promise((ok, mal) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => ok(i)
    i.onerror = () => mal(new Error('No pude abrir una imagen'))
    i.src = src
  })
function lienzo(fuente, max) {
  const W0 = fuente.naturalWidth || fuente.videoWidth || fuente.width
  const H0 = fuente.naturalHeight || fuente.videoHeight || fuente.height
  const k = Math.min(1, max / Math.max(W0, H0))
  const c = Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(W0 * k)), height: Math.max(1, Math.round(H0 * k)) })
  const g = c.getContext('2d')
  g.fillStyle = '#fff'
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(fuente, 0, 0, c.width, c.height)
  return c
}
const aJpeg = (c, q = 0.85) => c.toDataURL('image/jpeg', q)
const leer = (f) => new Promise((ok) => Object.assign(new FileReader(), { onload: (e) => ok(e.target.result) }).readAsDataURL(f))

/** Pone borroso un rectángulo (x,y,w,h de 0 a 1) del lienzo: lo encoge mucho y lo vuelve a estirar. */
function tapar(g, z) {
  const W = g.canvas.width
  const H = g.canvas.height
  const p = 0.008
  const x = Math.max(0, (z.x - p) * W)
  const y = Math.max(0, (z.y - p) * H)
  const w = Math.min(W - x, (z.w + 2 * p) * W)
  const h = Math.min(H - y, (z.h + 2 * p) * H)
  if (w < 1 || h < 1) return
  const celda = Math.max(22, Math.max(w, h) / 12)
  const t = Object.assign(document.createElement('canvas'), { width: Math.max(2, Math.round(w / celda)), height: Math.max(2, Math.round(h / celda)) })
  t.getContext('2d').drawImage(g.canvas, x, y, w, h, 0, 0, t.width, t.height)
  g.save()
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(t, 0, 0, t.width, t.height, x, y, w, h)
  g.restore()
}
/** La imagen ya borrosa (lo único que se guarda). */
function horneada(it, max = 1600) {
  const c = lienzo(it.img, max)
  const g = c.getContext('2d')
  for (const z of it.todo ? [{ x: 0, y: 0, w: 1, h: 1 }] : it.zonas) tapar(g, z)
  return c
}

/** Saca imágenes (y texto) de lo que subiste: imagen, PDF (hasta 6 páginas) o video (3 cuadros). */
async function deArchivo(f) {
  if (f.type.startsWith('image/')) return { imagenes: [aJpeg(lienzo(await imagen(await leer(f)), 1600))], texto: '' }
  if (f.type === 'application/pdf') {
    const pdfjs = await cargarScript(CDN.pdfjs, 'pdfjsLib')
    pdfjs.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise
    const imagenes = []
    let texto = ''
    for (let n = 1; n <= Math.min(doc.numPages, 15); n++) {
      const pag = await doc.getPage(n)
      texto += (await pag.getTextContent()).items.map((i) => i.str).join(' ') + '\n'
      if (n <= 6) {
        const vp0 = pag.getViewport({ scale: 1 })
        const vp = pag.getViewport({ scale: Math.min(2.5, 1500 / Math.max(vp0.width, vp0.height)) })
        const c = Object.assign(document.createElement('canvas'), { width: Math.round(vp.width), height: Math.round(vp.height) })
        await pag.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
        imagenes.push(aJpeg(c))
      }
    }
    return { imagenes, texto: texto.slice(0, 20000) }
  }
  if (f.type.startsWith('video/')) {
    const v = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', src: URL.createObjectURL(f) })
    await new Promise((ok, mal) => ((v.onloadeddata = ok), (v.onerror = () => mal(new Error('No pude abrir el video')))))
    const imagenes = []
    for (const p of [0.15, 0.5, 0.85]) {
      v.currentTime = v.duration * p
      await new Promise((ok) => (v.onseeked = ok))
      imagenes.push(aJpeg(lienzo(v, 1600)))
    }
    URL.revokeObjectURL(v.src)
    return { imagenes, texto: '' }
  }
  if (f.type.startsWith('text/')) return { imagenes: [], texto: (await f.text()).slice(0, 20000) }
  throw new Error(`"${f.name}": sube imágenes, PDF, video o un link`)
}

const limpiaPdf = (s) =>
  String(s ?? '')
    .normalize('NFC')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E -ÿ–—•…\n]/g, '')
const slug = (s) =>
  String(s || 'portafolio')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .toLowerCase()

// ------------------------------------------------------------------ la vista
export async function vistaPortafolio(v, ctx) {
  const { D, h, $, $$, titulo, intenta, mostrar, aviso, esAdmin } = ctx
  titulo('Portafolio')
  let tab = sessionStorage.getItem('hq-port-tab')
  if (!PESTANAS[tab]) tab = 'trabajos'
  const ir = (t) => (sessionStorage.setItem('hq-port-tab', t), mostrar())
  const trabajos = await D.portTrabajos()
  const aprobados = trabajos.filter((t) => t.estado === 'aprobado')
  const borradores = trabajos.filter((t) => t.estado === 'borrador')

  const cabeza = `<div class="acciones"><div class="segmento stoic-tabs">${Object.entries(PESTANAS)
    .map(([k, t]) => `<button data-pt="${k}" class="${tab === k ? 'on' : ''}">${t}${k === 'trabajos' && borradores.length && esAdmin() ? ` <small>${borradores.length}</small>` : ''}</button>`)
    .join('')}</div></div>`

  // ---------------------------------------------------- Trabajos
  async function vistaTrabajos() {
    const cat = sessionStorage.getItem('hq-port-cat') || ''
    const lista = trabajos.filter((t) => !cat || t.categoria === cat)
    const portadas = await Promise.all(lista.map((t) => (t.imagenes?.[0] ? D.portUrl(t.imagenes[0]).catch(() => '') : '')))
    const usadas = [...new Set(trabajos.map((t) => t.categoria))]
    return `<p class="nota">${aprobados.length} trabajos en el portafolio${borradores.length ? ` · ${borradores.length} esperando ${esAdmin() ? 'tu aprobación' : 'que Eduardo los apruebe'}` : ''}. Solo se guarda la versión borrosa: los originales nunca se suben.</p>
      ${usadas.length > 1 ? `<div class="stoic-sug port-filtro"><button class="chip-btn ${!cat ? 'on' : ''}" data-cat="">Todo</button>${usadas.map((c) => `<button class="chip-btn ${cat === c ? 'on' : ''}" data-cat="${c}">${CATEGORIAS[c]}</button>`).join('')}</div>` : ''}
      ${
        lista.length
          ? `<div class="port-grid">${lista
              .map(
                (t, i) => `<article class="tarjeta port-card" data-trabajo="${t.id}">
          <div class="port-foto">${portadas[i] ? `<img src="${h(portadas[i])}" alt="" loading="lazy">` : '<span>❖</span>'}${t.estado === 'borrador' ? '<span class="chip pendiente">Por aprobar</span>' : ''}</div>
          <div class="port-info"><small>${h(CATEGORIAS[t.categoria] || t.categoria)}${t.industria ? ` · ${h(t.industria)}` : ''}</small><b>${h(t.titulo)}</b><p>${h(t.ficha?.descripcion || '')}</p></div>
        </article>`,
              )
              .join('')}</div>`
          : `<div class="tarjeta stoic-vacio"><h3>Todavía no hay trabajos</h3><p class="nota">Sube el primero: un link, capturas, un PDF o un video.</p><button class="btn primario" data-pt="agregar">+ Agregar trabajo</button></div>`
      }`
  }

  // ---------------------------------------------------- Agregar
  function vistaAgregar() {
    if (revision) return vistaRevision()
    return `<form class="tarjeta port-form" id="pt-form">
      <p class="nota">Sube lo que NXUS hizo. La IA escribe la ficha <b>sin datos del cliente</b> y marca en borroso nombres, logos, teléfonos, precios y todo lo confidencial. Tú lo revisas antes de guardar.</p>
      <div class="campos">
        <label class="ancho">Link del trabajo <small>sitio web, landing, app…</small><input name="link" type="url" placeholder="https://…" value="${h(entrada.link)}"></label>
        <div class="ancho port-drop" id="pt-drop" tabindex="0" role="button">
          <input type="file" id="pt-archivos" multiple accept="image/*,application/pdf,video/*,text/plain" hidden>
          <b>Arrastra aquí tus archivos</b><small>o toca para elegirlos · imágenes, capturas, PDF, video · hasta ${MAX_IMAGENES} imágenes</small>
          ${entrada.archivos.length ? `<ul>${entrada.archivos.map((f, i) => `<li>${h(f.name)} <button type="button" class="enlace" data-quitar-archivo="${i}">quitar</button></li>`).join('')}</ul>` : ''}
        </div>
        <label class="ancho">Notas <small>opcional: qué hicimos, para qué tipo de negocio, resultados</small><textarea name="notas" rows="3" placeholder="Rehicimos su sitio y le conectamos un agente que agenda citas; subieron 40% las citas.">${h(entrada.notas)}</textarea></label>
      </div>
      <div class="acciones"><button class="btn primario" id="pt-analizar">✦ Analizar con IA</button></div>
    </form>`
  }

  function vistaRevision() {
    const f = revision.ficha
    const campo = (k, t, filas = 2) => `<label class="ancho">${t}<textarea name="${k}" rows="${filas}">${h(f[k] || '')}</textarea></label>`
    const listaCampo = (k, t) => `<label class="ancho">${t} <small>uno por renglón</small><textarea name="${k}" rows="3">${h((f[k] || []).join('\n'))}</textarea></label>`
    return `<div class="tarjeta port-rev">
      <div class="fila"><h2>Revisa antes de guardar</h2><button class="enlace" id="pt-descartar">Descartar</button></div>
      ${f.quitado?.length ? `<div class="tarjeta semaforo verde"><span class="luz"></span><div><b>La IA protegió esto</b><small>${f.quitado.map(h).join(' · ')}</small></div></div>` : ''}
      <h3 class="grupo">Imágenes <small>— así se van a ver. Arrastra sobre la imagen para tapar algo más; toca un recuadro para quitarlo.</small></h3>
      <div class="port-editores">${revision.items
        .map(
          (it, i) => `<div class="port-editor" data-ed="${i}">
          <canvas></canvas>
          <div class="acciones"><label class="check"><input type="checkbox" data-todo="${i}" ${it.todo ? 'checked' : ''}> Toda borrosa</label><button type="button" class="enlace" data-sin-zonas="${i}">Quitar recuadros</button><button type="button" class="enlace" data-quitar-img="${i}">No usar esta imagen</button></div>
        </div>`,
        )
        .join('')}</div>
      <form id="pt-ficha" class="campos">
        <label class="ancho">Título <small>sin el nombre del cliente</small><input name="titulo" maxlength="160" required value="${h(f.titulo)}"></label>
        <label>Categoría<select name="categoria">${Object.entries(CATEGORIAS).map(([k, t]) => `<option value="${k}" ${k === f.categoria ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Industria<input name="industria" maxlength="120" value="${h(f.industria)}"></label>
        <label>Fecha del trabajo<input name="fecha" type="date" value="${new Date().toLocaleDateString('en-CA')}"></label>
        ${campo('descripcion', 'Qué hicimos', 3)}${campo('reto', 'El reto')}${campo('solucion', 'La solución')}
        ${listaCampo('resultados', 'Resultados')}${listaCampo('servicios', 'Servicios')}${listaCampo('tecnologias', 'Tecnologías')}
        <div class="acciones ancho"><button class="btn primario">${esAdmin() ? 'Guardar en el portafolio' : 'Mandar a Eduardo para aprobar'}</button></div>
      </form>
    </div>`
  }

  // ---------------------------------------------------- Pedir
  async function vistaPedir() {
    const sug = ['Puros sitios web', 'Todo el historial de NXUS', 'Automatizaciones y agentes de IA', 'Para un restaurante', 'Marketing y anuncios', 'Lo mejor de lo mejor (5 trabajos)']
    let res = ''
    if (pedido?.resultado) {
      const r = pedido.resultado
      const fotos = await Promise.all(r.trabajos.map((t) => {
        const tr = trabajos.find((x) => x.id === t.id)
        return tr?.imagenes?.[0] ? D.portUrl(tr.imagenes[0]).catch(() => '') : ''
      }))
      res = `<div class="tarjeta port-pedido">
        <div class="port-portada"><span class="eyebrow">NXUS AI · ${pedido.idioma === 'en' ? 'Portfolio' : 'Portafolio'}</span><h2>${h(r.titulo)}</h2><p class="sub">${h(r.subtitulo)}</p><p>${h(r.introduccion)}</p></div>
        ${r.trabajos
          .map(
            (t, i) => `<div class="port-item">
          <div class="port-foto">${fotos[i] ? `<img src="${h(fotos[i])}" alt="">` : '<span>❖</span>'}</div>
          <div><b>${t.destacado ? '★ ' : ''}${h(t.titulo)}</b><p>${h(t.texto)}</p>${t.puntos?.length ? `<ul>${t.puntos.map((p) => `<li>${h(p)}</li>`).join('')}</ul>` : ''}</div>
          <div class="port-mover"><button class="btn chico" data-mover="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button class="btn chico" data-mover="${i}" data-dir="1" ${i === r.trabajos.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button><button class="btn chico" data-sacar="${i}" aria-label="Quitar">✕</button></div>
        </div>`,
          )
          .join('')}
        <p class="port-cierre">${h(r.cierre)}</p>
        <div class="acciones"><button class="btn primario" id="pt-pdf">⬇ Descargar PDF</button><button class="btn" id="pt-video">🎬 Paquete para video</button></div>
      </div>
      ${r.nota_para_ti ? `<div class="tarjeta semaforo amarillo"><span class="luz"></span><div><b>Para ti (no sale en el portafolio)</b><small>${h(r.nota_para_ti)}</small></div></div>` : ''}`
    }
    return `<form class="tarjeta port-form" id="pt-pedir">
        <label class="ancho">¿Qué portafolio necesitas?<textarea name="solicitud" rows="2" required placeholder="Necesito un portafolio de puros sitios web para una clínica dental">${h(pedido?.solicitud || '')}</textarea></label>
        <div class="stoic-sug">${sug.map((s) => `<button type="button" class="chip-btn" data-sug="${h(s)}">${h(s)}</button>`).join('')}</div>
        <div class="campos"><label>Para quién <small>opcional</small><input name="para" maxlength="160" placeholder="Clínica dental en Houston" value="${h(pedido?.para || '')}"></label>
        <label>Idioma<select name="idioma"><option value="es">Español</option><option value="en" ${pedido?.idioma === 'en' ? 'selected' : ''}>English</option></select></label></div>
        <div class="acciones"><button class="btn primario">✦ Armar portafolio</button><small class="nota">${aprobados.length} trabajos aprobados para escoger</small></div>
      </form>${res}`
  }

  // ---------------------------------------------------- Generados
  async function vistaGenerados() {
    const ps = await D.portPedidos()
    return ps.length
      ? `<div class="tarjeta"><ul class="cal-lista">${ps
          .map((p) => `<li><span class="punto-c" style="--c:#e3c896"></span><div><b>${h(p.resultado?.titulo || p.solicitud)}</b><small>${new Date(p.creado).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · “${h(p.solicitud)}”${p.para ? ` · para ${h(p.para)}` : ''} · ${p.resultado?.trabajos?.length ?? 0} trabajos · ${p.idioma === 'en' ? 'English' : 'Español'}</small></div><button class="enlace" data-abrir-ped="${p.id}">abrir</button><button class="enlace" data-borrar-ped="${p.id}">borrar</button></li>`)
          .join('')}</ul></div>`
      : '<p class="vacio">Aquí quedan los portafolios que generes, para volver a descargarlos.</p>'
  }

  const cuerpo = { trabajos: vistaTrabajos, agregar: vistaAgregar, pedir: vistaPedir, generados: vistaGenerados }[tab]
  v.innerHTML = cabeza + (await cuerpo())
  $$('[data-pt]', v).forEach((b) => (b.onclick = () => ir(b.dataset.pt)))

  // ---------------------------------------------------- acciones: Trabajos
  if (tab === 'trabajos') {
    $$('[data-cat]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-port-cat', b.dataset.cat), mostrar())))
    $$('[data-trabajo]', v).forEach((c) => (c.onclick = () => verTrabajo(trabajos.find((t) => t.id === c.dataset.trabajo))))
  }

  async function verTrabajo(t) {
    const urls = await Promise.all((t.imagenes ?? []).map((r) => D.portUrl(r).catch(() => '')))
    const f = t.ficha ?? {}
    const lst = (xs, tt) => (xs?.length ? `<h4>${tt}</h4><ul>${xs.map((x) => `<li>${h(x)}</li>`).join('')}</ul>` : '')
    ctx.abrirModal(
      `<div class="port-detalle"><small>${h(CATEGORIAS[t.categoria])}${t.industria ? ` · ${h(t.industria)}` : ''} · ${h(t.fecha)}${t.estado === 'borrador' ? ' · <b>Por aprobar</b>' : ''}</small>
        <h2>${h(t.titulo)}</h2>
        <div class="port-galeria">${urls.filter(Boolean).map((u) => `<img src="${h(u)}" alt="">`).join('')}</div>
        <p>${h(f.descripcion)}</p>${f.reto ? `<h4>El reto</h4><p>${h(f.reto)}</p>` : ''}${f.solucion ? `<h4>La solución</h4><p>${h(f.solucion)}</p>` : ''}
        ${lst(f.resultados, 'Resultados')}${lst(f.servicios, 'Servicios')}${lst(f.tecnologias, 'Tecnologías')}
        ${t.privado?.link || t.privado?.quitado?.length ? `<p class="nota">Solo en HQ: ${t.privado.link ? `link original ${h(t.privado.link)}` : ''}${t.privado.quitado?.length ? ` · se protegió: ${t.privado.quitado.map(h).join(', ')}` : ''}</p>` : ''}
        <div class="acciones">${esAdmin() && t.estado === 'borrador' ? '<button class="btn primario" id="pt-aprobar">✓ Aprobar</button>' : ''}${esAdmin() || t.estado === 'borrador' ? '<button class="btn" id="pt-editar">Editar texto</button><button class="btn peligro" id="pt-borrar">Borrar</button>' : ''}<button class="btn" data-cerrar>Cerrar</button></div></div>`,
      (caja) => {
        $('#pt-aprobar', caja)?.addEventListener('click', async () => (await intenta(() => D.portGuardar({ id: t.id, estado: 'aprobado' }), 'Aprobado ✓')) && (ctx.cerrarModal(), mostrar()))
        $('#pt-borrar', caja)?.addEventListener('click', async () => confirm('¿Borrar este trabajo del portafolio?') && (await intenta(() => D.portBorrar(t), 'Borrado')) && (ctx.cerrarModal(), mostrar()))
        $('#pt-editar', caja)?.addEventListener('click', () => editarTexto(t))
      },
    )
  }
  function editarTexto(t) {
    const f = t.ficha ?? {}
    const ta = (k, tt, val, filas = 2) => `<label class="ancho">${tt}<textarea name="${k}" rows="${filas}">${h(val ?? '')}</textarea></label>`
    ctx.abrirModal(
      `<form id="pt-ed"><h2>Editar trabajo</h2><div class="campos">
        <label class="ancho">Título<input name="titulo" maxlength="160" required value="${h(t.titulo)}"></label>
        <label>Categoría<select name="categoria">${Object.entries(CATEGORIAS).map(([k, x]) => `<option value="${k}" ${k === t.categoria ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label>Industria<input name="industria" maxlength="120" value="${h(t.industria)}"></label>
        ${ta('descripcion', 'Qué hicimos', f.descripcion, 3)}${ta('reto', 'El reto', f.reto)}${ta('solucion', 'La solución', f.solucion)}
        ${ta('resultados', 'Resultados (uno por renglón)', (f.resultados ?? []).join('\n'), 3)}${ta('servicios', 'Servicios (uno por renglón)', (f.servicios ?? []).join('\n'), 2)}${ta('tecnologias', 'Tecnologías (uno por renglón)', (f.tecnologias ?? []).join('\n'), 2)}
      </div><div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#pt-ed', caja).onsubmit = async (e) => {
          e.preventDefault()
          const x = Object.fromEntries(new FormData(e.target))
          const ren = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean)
          const ficha = { ...f, descripcion: x.descripcion.trim(), reto: x.reto.trim(), solucion: x.solucion.trim(), resultados: ren(x.resultados), servicios: ren(x.servicios), tecnologias: ren(x.tecnologias) }
          if (await intenta(() => D.portGuardar({ id: t.id, titulo: x.titulo.trim(), categoria: x.categoria, industria: x.industria.trim(), ficha }), 'Guardado')) (ctx.cerrarModal(), mostrar())
        }
      },
    )
  }

  // ---------------------------------------------------- acciones: Agregar
  if (tab === 'agregar' && !revision) {
    const form = $('#pt-form', v)
    const drop = $('#pt-drop', v)
    const input = $('#pt-archivos', v)
    const guardarEntrada = () => ((entrada.link = form.link.value.trim()), (entrada.notas = form.notas.value))
    const agregar = (files) => {
      guardarEntrada()
      entrada.archivos.push(...[...files])
      mostrar()
    }
    drop.onclick = (e) => !e.target.closest('[data-quitar-archivo]') && input.click()
    drop.onkeydown = (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click())
    input.onchange = () => input.files.length && agregar(input.files)
    drop.ondragover = (e) => (e.preventDefault(), drop.classList.add('encima'))
    drop.ondragleave = () => drop.classList.remove('encima')
    drop.ondrop = (e) => (e.preventDefault(), agregar(e.dataTransfer.files))
    $$('[data-quitar-archivo]', v).forEach((b) => (b.onclick = () => (guardarEntrada(), entrada.archivos.splice(Number(b.dataset.quitarArchivo), 1), mostrar())))
    form.onsubmit = async (e) => {
      e.preventDefault()
      guardarEntrada()
      if (!entrada.link && !entrada.archivos.length && !entrada.notas.trim()) return aviso('Pega un link o sube archivos', 'mal')
      const boton = $('#pt-analizar', v)
      boton.disabled = true
      const paso = (t) => (boton.textContent = t)
      try {
        const imagenes = []
        let texto = ''
        for (const f of entrada.archivos) {
          paso(`Leyendo ${f.name}…`)
          const r = await deArchivo(f)
          imagenes.push(...r.imagenes)
          if (r.texto) texto += `\n--- ${f.name} ---\n${r.texto}`
        }
        if (entrada.link) {
          paso('Abriendo la página…')
          const c = await D.portCaptura(entrada.link)
          if (c.imagen) imagenes.unshift(c.imagen)
          if (c.texto) texto = `--- Página ---\n${c.texto}\n${texto}`
        }
        const usadas = imagenes.slice(0, MAX_IMAGENES)
        if (imagenes.length > MAX_IMAGENES) aviso(`Usé las primeras ${MAX_IMAGENES} imágenes`)
        const imgs = await Promise.all(usadas.map(imagen))
        paso('La IA está revisando y protegiendo los datos…')
        const ficha = await D.portAnalizar({ link: entrada.link, notas: entrada.notas, texto: texto.slice(0, 20000), imagenes: imgs.map((i) => aJpeg(lienzo(i, 1100), 0.8)) })
        revision = { ficha, link: entrada.link, notas: entrada.notas, items: imgs.map((img, i) => ({ img, zonas: ficha.zonas.filter((z) => z.imagen === i), todo: false })) }
        mostrar()
      } catch (err) {
        aviso(err.message || 'No se pudo', 'mal')
        boton.disabled = false
        boton.textContent = '✦ Analizar con IA'
      }
    }
  }

  if (tab === 'agregar' && revision) {
    const dibujar = (i) => {
      const it = revision.items[i]
      const c = $(`[data-ed="${i}"] canvas`, v)
      const base = horneada(it, 1400)
      c.width = base.width
      c.height = base.height
      const g = c.getContext('2d')
      g.drawImage(base, 0, 0)
      if (!it.todo) {
        g.save()
        g.lineWidth = Math.max(2, c.width / 400)
        g.setLineDash([g.lineWidth * 4, g.lineWidth * 3])
        g.strokeStyle = '#e3c896'
        for (const z of it.zonas) g.strokeRect(z.x * c.width, z.y * c.height, z.w * c.width, z.h * c.height)
        g.restore()
      }
    }
    revision.items.forEach((it, i) => {
      dibujar(i)
      const c = $(`[data-ed="${i}"] canvas`, v)
      let ini = null
      const punto = (e) => {
        const r = c.getBoundingClientRect()
        return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
      }
      c.onpointerdown = (e) => {
        if (it.todo) return
        ini = punto(e)
        c.setPointerCapture(e.pointerId)
      }
      c.onpointermove = (e) => {
        if (!ini) return
        const p = punto(e)
        dibujar(i)
        const g = c.getContext('2d')
        g.fillStyle = 'rgba(227,200,150,.25)'
        g.fillRect(Math.min(ini.x, p.x) * c.width, Math.min(ini.y, p.y) * c.height, Math.abs(p.x - ini.x) * c.width, Math.abs(p.y - ini.y) * c.height)
      }
      c.onpointerup = (e) => {
        if (!ini) return
        const p = punto(e)
        const z = { x: Math.min(ini.x, p.x), y: Math.min(ini.y, p.y), w: Math.abs(p.x - ini.x), h: Math.abs(p.y - ini.y), que: 'a mano' }
        ini = null
        if (z.w < 0.012 && z.h < 0.012) {
          // Un toque: quita el recuadro que tocaste.
          const k = it.zonas.findLastIndex((q) => p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.h)
          if (k >= 0) it.zonas.splice(k, 1)
        } else it.zonas.push(z)
        dibujar(i)
      }
    })
    $$('[data-todo]', v).forEach((b) => (b.onchange = () => ((revision.items[b.dataset.todo].todo = b.checked), dibujar(Number(b.dataset.todo)))))
    $$('[data-sin-zonas]', v).forEach((b) => (b.onclick = () => ((revision.items[b.dataset.sinZonas].zonas = []), dibujar(Number(b.dataset.sinZonas)))))
    $$('[data-quitar-img]', v).forEach((b) => (b.onclick = () => (revision.items.splice(Number(b.dataset.quitarImg), 1), mostrar())))
    $('#pt-descartar', v).onclick = () => confirm('¿Descartar este trabajo?') && ((revision = null), mostrar())
    $('#pt-ficha', v).onsubmit = async (e) => {
      e.preventDefault()
      const x = Object.fromEntries(new FormData(e.target))
      const ren = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean)
      const boton = e.target.querySelector('.primario')
      boton.disabled = true
      boton.textContent = 'Guardando…'
      const id = crypto.randomUUID()
      const ok = await intenta(async () => {
        const rutas = []
        for (const [n, it] of revision.items.entries()) {
          const blob = await new Promise((r) => horneada(it).toBlob(r, 'image/jpeg', 0.85))
          rutas.push(await D.portSubirImagen(id, n, blob))
        }
        return D.portCrear({
          id,
          titulo: x.titulo.trim(),
          categoria: x.categoria,
          industria: x.industria.trim(),
          fecha: x.fecha || new Date().toLocaleDateString('en-CA'),
          ficha: { descripcion: x.descripcion.trim(), reto: x.reto.trim(), solucion: x.solucion.trim(), resultados: ren(x.resultados), servicios: ren(x.servicios), tecnologias: ren(x.tecnologias) },
          imagenes: rutas,
          privado: { link: revision.link || '', notas: revision.notas || '', quitado: revision.ficha.quitado ?? [] },
          estado: esAdmin() ? 'aprobado' : 'borrador',
        })
      }, esAdmin() ? 'Agregado al portafolio ❖' : 'Mandado a Eduardo para aprobar')
      if (!ok) {
        boton.disabled = false
        boton.textContent = esAdmin() ? 'Guardar en el portafolio' : 'Mandar a Eduardo para aprobar'
        return
      }
      revision = null
      entrada = { archivos: [], link: '', notas: '' }
      ir('trabajos')
    }
  }

  // ---------------------------------------------------- acciones: Pedir
  if (tab === 'pedir') {
    const f = $('#pt-pedir', v)
    $$('[data-sug]', v).forEach((b) => (b.onclick = () => ((f.solicitud.value = b.dataset.sug), f.solicitud.focus())))
    f.onsubmit = async (e) => {
      e.preventDefault()
      const x = Object.fromEntries(new FormData(f))
      const boton = f.querySelector('.primario')
      boton.disabled = true
      boton.textContent = 'La IA está escogiendo los trabajos…'
      const r = await intenta(() => D.portPedir({ solicitud: x.solicitud.trim(), idioma: x.idioma, para: x.para.trim() }))
      boton.disabled = false
      boton.textContent = '✦ Armar portafolio'
      if (!r) return
      pedido = { solicitud: x.solicitud.trim(), idioma: x.idioma, para: x.para.trim(), resultado: r }
      const g = await D.portGuardarPedido({ solicitud: pedido.solicitud, idioma: pedido.idioma, para: pedido.para, resultado: r }).catch(() => null)
      if (g) pedido.id = g.id
      mostrar()
    }
    if (pedido?.resultado) {
      const r = pedido.resultado
      $$('[data-mover]', v).forEach((b) => (b.onclick = () => {
        const i = Number(b.dataset.mover)
        const j = i + Number(b.dataset.dir)
        ;[r.trabajos[i], r.trabajos[j]] = [r.trabajos[j], r.trabajos[i]]
        mostrar()
      }))
      $$('[data-sacar]', v).forEach((b) => (b.onclick = () => (r.trabajos.splice(Number(b.dataset.sacar), 1), mostrar())))
      $('#pt-pdf', v).onclick = (e) => conBoton(e.currentTarget, 'Armando el PDF…', () => descargarPdf())
      $('#pt-video', v).onclick = (e) => conBoton(e.currentTarget, 'Preparando el guion…', () => paqueteVideo())
    }
  }

  // ---------------------------------------------------- acciones: Generados
  if (tab === 'generados') {
    const ps = await D.portPedidos()
    $$('[data-abrir-ped]', v).forEach((b) => (b.onclick = () => {
      const p = ps.find((x) => x.id === b.dataset.abrirPed)
      pedido = { id: p.id, solicitud: p.solicitud, idioma: p.idioma, para: p.para, resultado: p.resultado }
      ir('pedir')
    }))
    $$('[data-borrar-ped]', v).forEach((b) => (b.onclick = async () => confirm('¿Borrar este portafolio generado?') && (await intenta(() => D.portBorrarPedido(b.dataset.borrarPed), 'Borrado')) && mostrar()))
  }

  async function conBoton(boton, texto, fn) {
    const antes = boton.textContent
    boton.disabled = true
    boton.textContent = texto
    try {
      await fn()
    } catch (err) {
      aviso(err.message || 'No se pudo', 'mal')
    }
    boton.disabled = false
    boton.textContent = antes
  }

  /** Las imágenes (ya borrosas) de los trabajos elegidos, como dataURL. */
  async function imagenesDe(t, max = 3) {
    const tr = trabajos.find((x) => x.id === t.id)
    const out = []
    for (const r of (tr?.imagenes ?? []).slice(0, max)) {
      try {
        const u = await D.portUrl(r)
        const blob = u.startsWith('data:') ? null : await (await fetch(u)).blob()
        const src = blob ? await leer(blob) : u
        const i = await imagen(src)
        out.push({ src, w: i.naturalWidth, h: i.naturalHeight })
      } catch {}
    }
    return out
  }

  // ---------------------------------------------------- PDF (horizontal, colores NXUS)
  async function descargarPdf() {
    const r = pedido.resultado
    if (!r.trabajos.length) throw new Error('El portafolio no tiene trabajos')
    const { jsPDF } = await cargarScript(CDN.jspdf, 'jspdf')
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const W = 297
    const H = 210
    const en = pedido.idioma === 'en'
    const fondo = () => {
      doc.setFillColor(8, 13, 32)
      doc.rect(0, 0, W, H, 'F')
      doc.setFillColor(227, 200, 150)
      doc.rect(0, 0, W, 1.2, 'F')
    }
    const pie = (n) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(142, 163, 204)
      doc.text('NXUS AI  ·  nxusai.org', 14, H - 8)
      doc.text(String(n), W - 14, H - 8, { align: 'right' })
    }
    const texto = (s, x, y, ancho, tam, color = [230, 238, 255], estilo = 'normal', interlineado = 1.35) => {
      doc.setFont('helvetica', estilo)
      doc.setFontSize(tam)
      doc.setTextColor(...color)
      const lineas = doc.splitTextToSize(limpiaPdf(s), ancho)
      doc.text(lineas, x, y, { lineHeightFactor: interlineado })
      return y + lineas.length * tam * 0.3528 * interlineado
    }
    const encaja = (im, x, y, w, h) => {
      const k = Math.min(w / im.w, h / im.h)
      const iw = im.w * k
      const ih = im.h * k
      doc.setFillColor(16, 24, 52)
      doc.roundedRect(x, y, w, h, 3, 3, 'F')
      doc.addImage(im.src, 'JPEG', x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, undefined, 'FAST')
    }
    // Portada
    fondo()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(227, 200, 150)
    doc.text(limpiaPdf(`N X U S   A I   ·   ${en ? 'P O R T F O L I O' : 'P O R T A F O L I O'}`), 24, 40)
    let y = texto(r.titulo, 24, 66, 230, 34, [255, 255, 255], 'bold', 1.15)
    y = texto(r.subtitulo, 24, y + 4, 230, 15, [227, 200, 150])
    y = texto(r.introduccion, 24, y + 8, 200, 12, [200, 212, 235], 'normal', 1.5)
    const fecha = new Date().toLocaleDateString(en ? 'en-US' : 'es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    texto(`${pedido.para ? `${en ? 'Prepared for' : 'Preparado para'}: ${pedido.para}   ·   ` : ''}${fecha}`, 24, H - 26, 240, 10, [142, 163, 204])
    // Un trabajo por página
    for (const [n, t] of r.trabajos.entries()) {
      doc.addPage()
      fondo()
      const ims = await imagenesDe(t)
      if (ims.length > 1) {
        encaja(ims[0], 14, 14, 166, 128)
        ims.slice(1, 3).forEach((im, k) => encaja(im, 14 + k * 84, 146, 82, 48))
      } else if (ims.length) encaja(ims[0], 14, 14, 166, 180)
      const tr = trabajos.find((x) => x.id === t.id)
      let yy = texto(`${(CATEGORIAS[tr?.categoria] || '').toUpperCase()}${tr?.industria ? `  ·  ${tr.industria.toUpperCase()}` : ''}`, 190, 26, 93, 8, [227, 200, 150], 'bold')
      yy = texto(t.titulo, 190, yy + 4, 93, 18, [255, 255, 255], 'bold', 1.15)
      yy = texto(t.texto, 190, yy + 5, 93, 10.5, [210, 220, 240], 'normal', 1.5)
      yy += 3
      for (const p of t.puntos ?? []) {
        doc.setFillColor(227, 200, 150)
        doc.circle(191.2, yy + 2.4, 0.9, 'F')
        yy = texto(p, 195, yy + 3.6, 88, 10, [230, 238, 255], 'normal', 1.4) + 1.5
      }
      const serv = tr?.ficha?.servicios ?? []
      if (serv.length) texto(serv.join('  ·  '), 190, H - 22, 93, 8.5, [142, 163, 204])
      pie(n + 2)
    }
    // Cierre
    doc.addPage()
    fondo()
    texto(r.cierre, 24, 80, 240, 24, [255, 255, 255], 'bold', 1.25)
    texto('nxusai.org', 24, 150, 200, 14, [227, 200, 150], 'bold')
    doc.save(`NXUS-${en ? 'Portfolio' : 'Portafolio'}-${slug(pedido.para || r.titulo)}.pdf`)
    aviso('PDF descargado ⬇')
  }

  // ---------------------------------------------------- Paquete para el video (para hacerlo con Claude)
  async function paqueteVideo() {
    const r = pedido.resultado
    const archivos = []
    for (const [n, t] of r.trabajos.entries()) {
      const ims = await imagenesDe(t, 4)
      ims.forEach((im, k) => archivos.push({ archivo: `${String(n + 1).padStart(2, '0')}-${slug(t.titulo)}-${k + 1}.jpg`, trabajo: t.titulo, src: im.src }))
    }
    const vd = await D.portVideo(r, archivos.map(({ archivo, trabajo }) => ({ archivo, trabajo })))
    const guion = [
      `Claude, hazme el video de este portafolio de NXUS AI. Te adjunto el zip "${slug(r.titulo)}-video.zip" con las imágenes: ya vienen con lo confidencial borroso, déjalo así.`,
      '',
      `Título: ${vd.titulo}`,
      `Duración: ${vd.duracion_seg} segundos · Formato: ${vd.formato}`,
      `Estilo: ${vd.estilo}`,
      `Música: ${vd.musica}`,
      '',
      'Escenas:',
      ...vd.escenas.map((e, i) => `${i + 1}. (${e.segundos} s) ${e.imagen ? `Imagen ${e.imagen}` : 'Escena de texto'}\n   Texto en pantalla: ${e.texto_pantalla}\n   Voz: ${e.voz}\n   Movimiento: ${e.movimiento}`),
      '',
      `Cierre: ${vd.cierre}`,
    ].join('\n')
    ctx.abrirModal(
      `<h2>🎬 Paquete para el video</h2>
      <ol class="port-pasos"><li>Toca <b>Descargar paquete</b> (zip con las imágenes y el guion).</li><li>Toca <b>Copiar guion</b>.</li><li>En tu chat con Claude adjunta el zip y pega el guion. Claude te hace el video.</li></ol>
      <textarea class="port-guion" rows="12" readonly>${h(guion)}</textarea>
      <div class="acciones"><button class="btn primario" id="pt-zip">⬇ Descargar paquete (.zip)</button><button class="btn" id="pt-copiar">Copiar guion</button><button class="btn" data-cerrar>Cerrar</button></div>`,
      (caja) => {
        $('#pt-copiar', caja).onclick = async () => {
          try {
            await navigator.clipboard.writeText(guion)
            aviso('Guion copiado ✓')
          } catch {
            $('.port-guion', caja).select()
            aviso('Selecciónalo y cópialo con Cmd + C')
          }
        }
        $('#pt-zip', caja).onclick = (e) =>
          conBoton(e.currentTarget, 'Armando el zip…', async () => {
            const JSZip = await cargarScript(CDN.jszip, 'JSZip')
            const zip = new JSZip()
            for (const a of archivos) zip.file(`imagenes/${a.archivo}`, a.src.split(',')[1], { base64: true })
            zip.file('GUION.txt', guion)
            const blob = await zip.generateAsync({ type: 'blob' })
            const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${slug(r.titulo)}-video.zip` })
            document.body.append(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(a.href), 5000)
          })
      },
    )
  }
}
