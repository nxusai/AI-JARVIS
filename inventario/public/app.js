// Inventario Mi Semago: lo que llega, lo que se pide y lo que sale.
//
// Una sola página, sin dependencias. La página solo enseña y pide: quién
// puede ver y tocar qué —y que lo cerrado ya no se cambie— lo decide la base
// de datos (supabase/esquema.sql). `D` es datos-supabase.js (el real) o
// datos-muestra.js (la muestra, sin internet). Las cuentas están en
// calculos.js, las mismas que usa Ana Sofi para contestar por Telegram.

import {
  ESTADO_PEDIDO,
  INCIDENCIA,
  PROBLEMA,
  RESULTADO,
  SALIDA,
  diasPara,
  estadoPedido,
  existencias,
  folio,
  incidenciasDe,
  plegar,
  porCaducar,
  recepcionesVigentes,
  resultadoDe,
  salidasVigentes,
} from './calculos.js'

const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const h = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const LOGO = '/img/logo.png'
const ICONO = '/img/icono.png'

const ROL = { admin: 'Administrador · NXUS', dueno: 'Dueño', compras: 'Compras', almacen: 'Almacén' }
const FOTO = { packing: 'Packing slip', mercancia: 'Mercancía', dano: 'Dañado', otro: 'Otra' }
const CALIDAD = { buena: 'Buena', regular: 'Regular', mala: 'Mala' }
const CADUCA_PRONTO = 30

// Iconos de línea (24×24), para no depender de nada.
const I = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  recibir: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  pedidos: 'M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2M10 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  inventario: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  problemas: 'M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  historial: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  catalogo: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 3.5h7m-3.5-3.5v7',
  personas: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.9m-3-12a4 4 0 0 1 0 7.8',
  bitacora: 'M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01',
  camara: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  imprimir: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  ia: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  salida: 'M12 21V9m0 0l-4 4m4-4l4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2',
  candado: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  mas: 'M12 5v14M5 12h14',
  menu: 'M3 6h18M3 12h18M3 18h18',
}
const icono = (k, clase = '') => `<svg class="ic ${clase}" viewBox="0 0 24 24" aria-hidden="true"><path d="${I[k]}"/></svg>`

// ---------------------------------------------------------------- formatos

const aDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hoy = () => aDia(new Date())
const diaDe = (iso) => (iso ? aDia(new Date(iso)) : '')
const deDia = (s) => new Date(`${s}T00:00`)
const fechaCorta = (s) => (s ? new Date(s.length === 10 ? `${s}T12:00` : s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: s.slice(0, 4) === String(new Date().getFullYear()) ? undefined : 'numeric' }) : '')
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)
const fechaLarga = (s) => (s ? mayuscula(new Date(s.length === 10 ? `${s}T12:00` : s).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : '')
const hora = (s) => (s ? new Date(s).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : '')
const fechaHora = (s) => (s ? `${fechaCorta(s)}, ${hora(s)}` : '')
const cant = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }))
const dinero = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const minutos = (a, b) => {
  if (!a || !b) return ''
  const m = Math.round((new Date(b) - new Date(a)) / 60000)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}
const iniciales = (n) =>
  String(n || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
const saludo = (nombre) => {
  const hr = new Date().getHours()
  const n = String(nombre || '').split(/\s+/)[0]
  return `${hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches'}${n ? `, ${n}` : ''}`
}

/** Una foto, más chica, en JPEG: para guardarla y para mandársela a Ana Sofi. */
async function reducir(fuente, max = 1600, calidad = 0.82) {
  const url = typeof fuente === 'string' ? fuente : URL.createObjectURL(fuente)
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error('No se pudo abrir esa foto. Intenta con otra (JPG o PNG).'))
      i.src = url
    })
    const k = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max))
    const c = document.createElement('canvas')
    c.width = Math.round((img.naturalWidth || max) * k)
    c.height = Math.round((img.naturalHeight || max) * k)
    const g = c.getContext('2d')
    g.fillStyle = '#fff'
    g.fillRect(0, 0, c.width, c.height)
    g.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', calidad))
  } finally {
    if (typeof fuente !== 'string') URL.revokeObjectURL(url)
  }
}
const base64 = (blob) =>
  new Promise((ok) => {
    const fr = new FileReader()
    fr.onload = () => ok(String(fr.result).split(',')[1])
    fr.readAsDataURL(blob)
  })

export function iniciar(D, { muestra = false } = {}) {
  const app = $('#app')
  const modal = $('#modal')
  let yo = null
  let personas = []
  let proveedores = []
  let productos = []
  let recs = []
  let pedidos = []
  let salidas = []

  // ------------------------------------------------------------ utilidades

  const aviso = (texto, tipo = 'ok') => {
    const el = document.createElement('div')
    el.className = `aviso ${tipo}`
    el.textContent = texto
    $('#avisos').append(el)
    setTimeout(() => el.remove(), 4600)
  }
  const intenta = async (fn, bien) => {
    try {
      const r = await fn()
      if (bien) aviso(bien)
      return r ?? true // lo que no devuelve nada también salió bien
    } catch (err) {
      aviso(err.message || String(err), 'mal')
      return undefined
    }
  }
  const esAdmin = () => yo?.rol === 'admin'
  const compra = () => ['admin', 'dueno', 'compras'].includes(yo?.rol)
  const nombreDe = (pid) => personas.find((p) => p.id === pid)?.nombre ?? '—'
  const provDe = (x) => proveedores.find((p) => p.id === x.proveedor_id)?.nombre || x.proveedor_nombre || x.proveedor_texto || ''
  const recDe = (rid) => recs.find((r) => r.id === rid)
  const pedDe = (pid) => pedidos.find((p) => p.id === pid)
  const corrigeA = (lista, x) => lista.find((y) => y.corrige_id === x.id)

  async function cargar(...que) {
    const todo = !que.length
    const tareas = []
    if (todo || que.includes('catalogo')) tareas.push(Promise.all([D.proveedores(), D.productos()]).then(([a, b]) => ((proveedores = a), (productos = b))))
    if (todo || que.includes('recs')) tareas.push(D.recepciones().then((x) => (recs = x)))
    if (todo || que.includes('pedidos')) tareas.push(D.pedidos().then((x) => (pedidos = x)))
    if (todo || que.includes('salidas')) tareas.push(D.salidas().then((x) => (salidas = x)))
    await Promise.all(tareas)
  }

  function abrirModal(html, alMontar, clase = '') {
    modal.innerHTML = `<div class="fondo"></div><div class="caja vidrio ${clase}" role="dialog" aria-modal="true">${html}</div>`
    modal.hidden = false
    $('.fondo', modal).onclick = cerrarModal
    $$('[data-cerrar]', modal).forEach((b) => (b.onclick = cerrarModal))
    alMontar?.($('.caja', modal))
    $('input:not([type=checkbox]):not([type=file]), textarea, select', modal)?.focus()
  }
  function cerrarModal() {
    modal.hidden = true
    modal.innerHTML = ''
  }
  addEventListener('keydown', (e) => e.key === 'Escape' && !modal.hidden && cerrarModal())

  /** "¿Seguro?" con la advertencia de que ya no se puede cambiar. */
  const confirmar = (titulo, texto, boton = 'Sí, confirmar', peligro = false) =>
    new Promise((ok) => {
      abrirModal(
        `<h2>${h(titulo)}</h2><p>${texto}</p>
         <div class="pie"><button class="btn" data-cerrar>Cancelar</button><button class="btn ${peligro ? 'peligro' : 'primario'}" id="si">${h(boton)}</button></div>`,
        (c) => {
          $('#si', c).onclick = () => {
            cerrarModal()
            ok(true)
          }
          $$('[data-cerrar]', c).forEach((b) => b.addEventListener('click', () => ok(false)))
          $('.fondo', modal).addEventListener('click', () => ok(false))
        },
      )
    })

  const chip = (texto, clase = '') => `<span class="chip ${clase}">${h(texto)}</span>`
  const chipEstadoPedido = (p) => {
    const e = estadoPedido(p, pedidos)
    return chip(ESTADO_PEDIDO[e], `p-${e}`)
  }
  const chipResultado = (r) => {
    if (r.estado === 'borrador') return chip('Abierta', 'abierta')
    if (corrigeA(recs, r)?.estado === 'cerrada') return chip('Corregida', 'corregido')
    const res = resultadoDe(r)
    return chip(RESULTADO[res], `r-${res}`)
  }
  const sello = '<span class="sello" title="Cerrado: ya no se cambia">' + icono('candado') + '</span>'

  // ------------------------------------------------------------- entrada

  function pantallaEntrada(error = '') {
    app.innerHTML = `
      <div class="entrada">
        <div class="entrada-caja vidrio">
          <img class="logo-grande" src="${LOGO}" alt="Mi Semago">
          <p class="sub">Inventario · recepción, pedidos y almacén</p>
          ${
            muestra
              ? `<p class="nota">Muestra con datos de ejemplo: entra como cualquier persona para ver lo que cada quien ve.</p>
                 <div class="como">${D.usuariosMuestra()
                   .map((u) => `<button class="btn" data-como="${h(u.id)}"><span class="avatar">${h(iniciales(u.nombre))}</span><span><b>${h(u.nombre)}</b><small>${h(ROL[u.rol])} · ${h(u.cargo)}</small></span></button>`)
                   .join('')}</div>`
              : `<form id="f-entrar">
                  <label>Correo<input name="correo" type="email" autocomplete="username" required></label>
                  <label>Contraseña<input name="clave" type="password" autocomplete="current-password" required></label>
                  ${error ? `<p class="error">${h(error)}</p>` : ''}
                  <button class="btn primario grande">Entrar</button>
                  <button type="button" class="enlace" id="olvide">¿Olvidaste tu contraseña?</button>
                </form>`
          }
          <p class="hecho">Hecho por NXUS AI · con Ana Sofi</p>
        </div>
      </div>`
    $$('[data-como]').forEach((b) => (b.onclick = async () => arrancar(await D.entrarComo(b.dataset.como))))
    const f = $('#f-entrar')
    if (f) {
      f.onsubmit = async (e) => {
        e.preventDefault()
        const d = Object.fromEntries(new FormData(f))
        try {
          arrancar(await D.entrar(d.correo, d.clave))
        } catch (err) {
          pantallaEntrada(err.message)
        }
      }
      $('#olvide').onclick = () => {
        const correo = $('[name=correo]', f).value
        if (!correo) return aviso('Escribe tu correo arriba primero', 'mal')
        intenta(() => D.olvide(correo), 'Te mandamos un correo para cambiar tu contraseña')
      }
    }
  }

  // ---------------------------------------------------------- el marco

  const SECCIONES = [
    ['inicio', 'Inicio'],
    ['recibir', 'Recibir'],
    ['pedidos', 'Pedidos'],
    ['inventario', 'Inventario'],
    ['problemas', 'Problemas'],
    ['historial', 'Historial'],
    ['catalogo', 'Catálogo'],
  ]
  const SECCIONES_ADMIN = [
    ['personas', 'Personas'],
    ['bitacora', 'Bitácora'],
  ]

  async function arrancar(perfil) {
    yo = perfil
    if (!yo) return pantallaEntrada()
    personas = await D.personas()
    await cargar('catalogo')
    app.innerHTML = `
      <div class="marco">
        <aside class="nav vidrio">
          <img class="logo" src="${LOGO}" alt="Mi Semago">
          <div class="ana"><img src="${ICONO}" alt=""><div><b>Ana Sofi</b><span>${muestra ? 'Muestra' : 'Lista para ayudar'}</span></div><i class="punto"></i></div>
          <nav>
            ${SECCIONES.map(([id, t]) => `<a href="#${id}" data-ir="${id}">${icono(id)}<span>${t}</span></a>`).join('')}
            ${esAdmin() ? `<div class="sep">Solo administrador</div>${SECCIONES_ADMIN.map(([id, t]) => `<a href="#${id}" data-ir="${id}">${icono(id)}<span>${t}</span></a>`).join('')}` : ''}
          </nav>
          <div class="yo"><span class="avatar">${h(iniciales(yo.nombre))}</span><div><b>${h(yo.nombre)}</b><span>${h(ROL[yo.rol])}</span></div><button class="enlace" id="salir">Salir</button></div>
        </aside>
        <main>
          <header class="top vidrio">
            <button class="menu" id="menu" aria-label="Menú">${icono('menu')}</button>
            <h1 id="titulo"></h1>
            <div class="rapidos">
              <a class="btn primario" href="#recibir/nueva">${icono('recibir')}<span>Llegó un proveedor</span></a>
              <button class="btn" id="r-pedir">${icono('pedidos')}<span>Pedir algo</span></button>
            </div>
          </header>
          <section id="vista"></section>
        </main>
        <nav class="tabbar vidrio">
          ${['inicio', 'recibir', 'pedidos', 'inventario', 'historial'].map((id) => `<a href="#${id}" data-ir="${id}">${icono(id)}<span>${SECCIONES.find((s) => s[0] === id)[1]}</span></a>`).join('')}
        </nav>
      </div>`
    $('#menu').onclick = () => $('.nav').classList.toggle('abierta')
    $('#r-pedir').onclick = () => formPedido()
    $('#salir').onclick = async () => {
      await D.salir()
      yo = null
      onhashchange = null
      location.hash = ''
      pantallaEntrada()
    }
    onhashchange = () => mostrar()
    mostrar()
  }

  async function mostrar() {
    if (!yo || !$('#vista')) return
    $('.nav')?.classList.remove('abierta')
    const [ruta, arg] = (location.hash.slice(1) || 'inicio').split('/')
    const todas = [...SECCIONES, ...(esAdmin() ? SECCIONES_ADMIN : [])]
    const sec = todas.find(([id]) => id === ruta) ? ruta : ruta === 'recepcion' ? 'recibir' : 'inicio'
    $$('[data-ir]').forEach((a) => a.classList.toggle('activa', a.dataset.ir === sec))
    const vista = $('#vista')
    vista.innerHTML = '<div class="cargando">Cargando…</div>'
    const VISTAS = { inicio, recibir: vistaRecibir, pedidos: vistaPedidos, inventario: vistaInventario, problemas: vistaProblemas, historial: vistaHistorial, catalogo: vistaCatalogo, personas: vistaPersonas, bitacora: vistaBitacora }
    try {
      if (ruta === 'recibir' && arg === 'nueva') return await nuevaRecepcion()
      if (ruta === 'recepcion' && arg) await vistaRecepcion(vista, arg)
      else await VISTAS[sec](vista, arg)
    } catch (err) {
      vista.innerHTML = `<div class="tarjeta vidrio"><p class="error">${h(err.message)}</p></div>`
    }
  }
  const titulo = (t) => ($('#titulo').textContent = t)

  // ------------------------------------------------------------- inicio

  async function inicio(v) {
    titulo(saludo(yo.nombre))
    await cargar('recs', 'pedidos', 'salidas')
    const abiertas = recs.filter((r) => r.estado === 'borrador')
    const deHoy = recs.filter((r) => diaDe(r.llegada) === hoy() && r.estado === 'cerrada')
    const porComprar = pedidos.filter((p) => estadoPedido(p, pedidos) === 'pedido')
    const enCamino = pedidos.filter((p) => estadoPedido(p, pedidos) === 'comprado')
    const ex = existencias(recs, salidas, productos)
    const caducan = porCaducar(ex, CADUCA_PRONTO)
    const bajos = ex.filter((p) => p.bajo)
    const semana = new Date(Date.now() - 7 * 86400000)
    const conProblema = recepcionesVigentes(recs).filter((r) => new Date(r.llegada) >= semana && incidenciasDe(r).length)

    const tarjetaRec = (r) =>
      `<a class="fila-lista" href="#recepcion/${r.id}"><b>${folio('R', r.folio)} · ${h(provDe(r) || 'Sin proveedor todavía')}</b><small>${r.estado === 'borrador' ? `Abierta desde las ${hora(r.creado)} · ${h(nombreDe(r.creado_por))}` : `${fechaHora(r.llegada)} · ${incidenciasDe(r).map((i) => INCIDENCIA[i.tipo]).filter((x, i, a) => a.indexOf(x) === i).join(', ')}`}</small></a>`
    const tarjetaPed = (p) =>
      `<a class="fila-lista" href="#pedidos/${p.id}"><b>${folio('P', p.folio)} · ${h(p.lineas.map((l) => `${cant(l.cantidad)} ${l.unidad} ${l.producto}`).join(', '))}</b><small>${p.urgente ? '<span class="rojo">Urgente</span> · ' : ''}${h(nombreDe(p.pedido_por))} · ${fechaHora(p.pedido_en)}${p.llega ? ` · llega ${fechaCorta(p.llega)}` : ''}</small></a>`

    v.innerHTML = `
      ${muestra ? `<div class="tarjeta vidrio aviso-muestra">${icono('ia')}<p><b>Estás en la muestra.</b> Todo es de ejemplo y se borra al recargar. Prueba recibir mercancía: toma o sube cualquier foto y Ana Sofi "leerá" un packing slip de ejemplo.</p></div>` : ''}
      <div class="kpis">
        <a class="kpi vidrio" href="#recibir"><span>Recibido hoy</span><b>${deHoy.length}</b><small>${abiertas.length ? `${abiertas.length} abierta${abiertas.length > 1 ? 's' : ''} ahora` : 'entregas cerradas'}</small></a>
        <a class="kpi vidrio" href="#pedidos"><span>Por comprar</span><b>${porComprar.length}</b><small class="${porComprar.some((p) => p.urgente) ? 'rojo' : ''}">${porComprar.filter((p) => p.urgente).length} urgentes · ${enCamino.length} en camino</small></a>
        <a class="kpi vidrio" href="#problemas"><span>Problemas (7 días)</span><b>${conProblema.length}</b><small>entregas con algo mal</small></a>
        <a class="kpi vidrio" href="#inventario"><span>Caducan pronto</span><b>${caducan.length}</b><small class="${caducan.some((c) => c.dias < 0) ? 'rojo' : ''}">${caducan.filter((c) => c.dias < 0).length} ya caducados · ${bajos.length} bajos</small></a>
      </div>
      <div class="dos">
        <div class="tarjeta vidrio"><h3>Recepciones abiertas</h3>${abiertas.length ? `<div class="lista">${abiertas.map(tarjetaRec).join('')}</div>` : '<p class="vacio">Ninguna. Cuando llegue un proveedor, toca <b>Llegó un proveedor</b>.</p>'}</div>
        <div class="tarjeta vidrio"><h3>Por comprar</h3>${porComprar.length ? `<div class="lista">${porComprar.slice(0, 8).map(tarjetaPed).join('')}</div>` : '<p class="vacio">Nada pendiente.</p>'}</div>
        <div class="tarjeta vidrio"><h3>Caducan en ${CADUCA_PRONTO} días o menos</h3>${
          caducan.length
            ? `<div class="lista">${caducan.slice(0, 8).map((c) => `<a class="fila-lista" href="#inventario"><b>${h(c.producto)}${c.lote ? ` · lote ${h(c.lote)}` : ''}</b><small class="${c.dias < 0 ? 'rojo' : c.dias <= 7 ? 'ambar' : ''}">${c.dias < 0 ? `Caducó hace ${-c.dias} días` : c.dias === 0 ? 'Caduca hoy' : `Caduca en ${c.dias} días`} · quedan ${cant(c.queda)} ${h(c.unidad)}</small></a>`).join('')}</div>`
            : '<p class="vacio">Nada por caducar.</p>'
        }</div>
        <div class="tarjeta vidrio"><h3>Problemas de la semana</h3>${conProblema.length ? `<div class="lista">${conProblema.slice(0, 8).map(tarjetaRec).join('')}</div>` : '<p class="vacio">Ninguna entrega con problemas.</p>'}</div>
      </div>
      ${bajos.length ? `<div class="tarjeta vidrio"><h3>Por debajo del mínimo</h3><div class="chips">${bajos.map((p) => chip(`${p.producto}: ${cant(p.queda)} de ${cant(p.minimo)} ${p.unidad}`, 'ambar')).join('')}</div></div>` : ''}`
  }

  // ------------------------------------------------------------ recibir

  async function nuevaRecepcion() {
    const r = await intenta(() => D.nuevaRecepcion())
    if (r) location.replace(`#recepcion/${r.id}`)
    else location.hash = 'recibir'
  }

  async function vistaRecibir(v) {
    titulo('Recibir mercancía')
    await cargar('recs')
    const abiertas = recs.filter((r) => r.estado === 'borrador')
    const cerradas = recs.filter((r) => r.estado === 'cerrada')
    const fila = (r) => {
      const corr = corrigeA(recs, r)
      return `<a class="rec-fila vidrio" href="#recepcion/${r.id}">
        <div><b>${folio('R', r.folio)}</b>${r.corrige_id ? chip('Corrección', 'corregido') : ''}</div>
        <div><b>${h(provDe(r) || 'Sin proveedor todavía')}</b><small>${fechaHora(r.llegada)} · recibió ${h(nombreDe(r.creado_por))}</small></div>
        <div class="der">${chipResultado(r)}${corr ? `<small>vale ${folio('R', corr.folio)}</small>` : ''}</div>
      </a>`
    }
    v.innerHTML = `
      <div class="acciones"><a class="btn primario grande" href="#recibir/nueva">${icono('camara')} Llegó un proveedor</a></div>
      ${abiertas.length ? `<h2 class="grupo">Abiertas <small>las están llenando</small></h2><div class="recs">${abiertas.map(fila).join('')}</div>` : ''}
      <h2 class="grupo">Últimas recepciones <small>${cerradas.length}</small></h2>
      <div class="recs">${cerradas.slice(0, 60).map(fila).join('') || '<p class="vacio">Todavía no hay.</p>'}</div>
      ${cerradas.length > 60 ? '<p class="nota">Las anteriores están en <a href="#historial">Historial</a>.</p>' : ''}`
  }

  /** Lo que Ana Sofi dijo en esta recepción (no se guarda: solo se enseña mientras se llena). */
  const notasIA = new Map()

  async function vistaRecepcion(v, rid) {
    await cargar('recs', 'pedidos')
    let r = await D.recepcion(rid)
    titulo(`Recepción ${folio('R', r.folio)}`)
    const editable = () => r.estado === 'borrador'

    const guardarR = async (cambios) => {
      const x = await intenta(() => D.guardarRecepcion({ id: r.id, ...cambios }))
      if (x) r = x
      return x
    }

    async function pintar() {
      r.lineas.sort((a, b) => a.orden - b.orden)
      const orig = r.corrige_id ? recDe(r.corrige_id) : null
      const corr = corrigeA(recs, r)
      const fotos = await Promise.all(r.archivos.map(async (a) => ({ ...a, url: await D.fotoUrl(a.ruta) })))
      const deTipo = (t) => fotos.filter((f) => f.tipo === t).sort((a, b) => a.subido.localeCompare(b.subido))
      const galeria = (lista) =>
        lista.length
          ? `<div class="fotos">${lista.map((f) => `<button class="foto" data-foto="${f.id}"><img src="${h(f.url)}" alt="${h(FOTO[f.tipo])}" loading="lazy"><span>${hora(f.subido)}</span></button>`).join('')}</div>`
          : ''
      const pasos = [
        ['Llegó', r.llegada],
        ['Packing leído', r.ia_leido_en],
        ['Inspección', r.inspeccion_en],
        ['Revisión IA', r.ia_revisado_en],
        ['Cerrada', r.cerrada_en],
      ]
      const linea = r.estado === 'cerrada' ? null : notasIA.get(r.id)
      const pedidosAbiertos = pedidos.filter((p) => ['pedido', 'comprado'].includes(estadoPedido(p, pedidos)) || p.id === r.pedido_id)

      v.innerHTML = `
        ${orig ? `<div class="banda corr vidrio"><b>Corrección de <a href="#recepcion/${orig.id}">${folio('R', orig.folio)}</a></b><span>Por qué: ${h(r.motivo)}</span><small>Hecha por ${h(nombreDe(r.creado_por))} el ${fechaHora(r.creado)}</small></div>` : ''}
        ${corr ? `<div class="banda alerta vidrio"><b>Esta recepción se corrigió${corr.estado === 'borrador' ? ' (la corrección se está llenando)' : ''}.</b><span>Vale <a href="#recepcion/${corr.id}">${folio('R', corr.folio)}</a>: ${h(corr.motivo)}</span></div>` : ''}
        <div class="cabeza">
          <div><h2>${folio('R', r.folio)} ${r.estado === 'cerrada' ? sello : ''}</h2><p>${h(provDe(r) || 'Proveedor por identificar')} · recibió ${h(nombreDe(r.creado_por))}</p></div>
          <div class="der">${chipResultado(r)}</div>
        </div>
        <ol class="pasos vidrio">${pasos.map(([t, c]) => `<li class="${c ? 'hecho' : ''}"><i></i><b>${t}</b><small>${c ? fechaHora(c) : '—'}</small></li>`).join('')}</ol>

        <div class="tarjeta vidrio">
          <div class="tit"><h3><span class="num">1</span> Packing slip</h3>${editable() ? `<label class="btn chico primario">${icono('camara')} Foto del packing slip<input type="file" accept="image/*" capture="environment" hidden data-subir="packing"></label>` : ''}</div>
          ${galeria(deTipo('packing'))}
          ${editable() && deTipo('packing').length ? `<button class="btn chico" id="leer">${icono('ia')} Que Ana Sofi lo lea otra vez</button>` : ''}
          ${editable() ? `<label class="check"><input type="checkbox" data-campo="sin_packing" ${r.sin_packing ? 'checked' : ''}><span>El proveedor <b>no trajo</b> el packing slip</span></label>` : r.sin_packing ? `<p>${chip('Sin packing slip', 'r-con-problemas')}</p>` : ''}
          ${linea ? `<div class="ia-dice">${icono('ia')}<div><b>Ana Sofi:</b> ${linea.map(h).join('<br>')}</div></div>` : ''}
          <div class="campos">
            <label>Proveedor<input list="dl-prov" data-campo="proveedor_nombre" value="${h(provDe(r))}" ${editable() ? '' : 'disabled'} placeholder="¿Quién lo manda?"></label>
            <label>Número de packing slip / orden<input data-campo="packing_numero" value="${h(r.packing_numero)}" ${editable() ? '' : 'disabled'}></label>
            <label>Fecha de la hoja<input type="date" data-campo="packing_fecha" value="${h(r.packing_fecha ?? '')}" ${editable() ? '' : 'disabled'}></label>
            <label>¿Es de un pedido?<select data-campo="pedido_id" ${editable() ? '' : 'disabled'}><option value="">No sé / no</option>${pedidosAbiertos.map((p) => `<option value="${p.id}" ${p.id === r.pedido_id ? 'selected' : ''}>${folio('P', p.folio)} · ${h(p.lineas.map((l) => l.producto).join(', ').slice(0, 60))}</option>`).join('')}</select></label>
          </div>
        </div>

        <div class="tarjeta vidrio">
          <div class="tit"><h3><span class="num">2</span> Lo que llegó</h3>${editable() && r.lineas.some((l) => l.cantidad_esperada !== null) ? '<button class="btn chico" id="igual">Llegó igual que la hoja</button>' : ''}</div>
          <p class="nota">${editable() ? 'Cuenta lo que de verdad llegó. Si algo viene roto o mojado, ponlo en <b>dañados</b> y tómale foto abajo.' : ''}</p>
          <div class="lineas">${r.lineas.map((l, i) => lineaHtml(l, i)).join('') || '<p class="vacio">Sin productos todavía. Toma la foto del packing slip y Ana Sofi los llena, o agrégalos a mano.</p>'}</div>
          ${editable() ? `<button class="btn chico" id="mas-linea">${icono('mas')} Agregar producto</button>` : ''}
        </div>

        <div class="tarjeta vidrio">
          <div class="tit"><h3><span class="num">3</span> Inspección</h3></div>
          ${editable() ? `<div class="botones"><label class="btn chico primario">${icono('camara')} Foto de la mercancía<input type="file" accept="image/*" capture="environment" hidden data-subir="mercancia"></label><label class="btn chico peligro-suave">${icono('camara')} Foto de algo roto<input type="file" accept="image/*" capture="environment" hidden data-subir="dano"></label><label class="enlace">o subir de la galería<input type="file" accept="image/*" multiple hidden data-subir="mercancia"></label></div>` : ''}
          ${deTipo('mercancia').length ? `<h4>Mercancía</h4>${galeria(deTipo('mercancia'))}` : ''}
          ${deTipo('dano').length ? `<h4 class="rojo">Lo dañado</h4>${galeria(deTipo('dano'))}` : ''}
          ${deTipo('otro').length ? `<h4>Otras</h4>${galeria(deTipo('otro'))}` : ''}
          <div class="campos">
            <label>Temperatura al llegar <small>(refrigerados)</small><input data-campo="temperatura" value="${h(r.temperatura)}" placeholder="ej. 38 °F" ${editable() ? '' : 'disabled'}></label>
            <label>Camión limpio y en buen estado<select data-campo="transporte_ok" ${editable() ? '' : 'disabled'}><option value="" ${r.transporte_ok === null ? 'selected' : ''}>Sin revisar</option><option value="si" ${r.transporte_ok === true ? 'selected' : ''}>Sí</option><option value="no" ${r.transporte_ok === false ? 'selected' : ''}>No</option></select></label>
          </div>
          <label>¿Algo está mal? Anótalo con tus palabras<textarea data-campo="notas" rows="3" ${editable() ? '' : 'disabled'} placeholder="ej. 2 costales rotos, faltó una caja, el chofer dice que llega mañana…">${h(r.notas)}</textarea></label>
        </div>

        <div class="tarjeta vidrio">
          <div class="tit"><h3><span class="num">4</span> Revisión de Ana Sofi</h3>${editable() ? `<button class="btn chico ia" id="revisar">${icono('ia')} Revisar con Ana Sofi</button>` : ''}</div>
          ${
            r.resumen || r.incidencias?.length
              ? `<p class="resumen">${h(r.resumen)}</p>${incidenciasHtml(r)}`
              : `<p class="vacio">${editable() ? 'Cuando termines de contar y tomar fotos, Ana Sofi revisa todo y ordena los problemas.' : 'No se revisó con Ana Sofi.'}</p>${r.estado === 'cerrada' ? incidenciasHtml(r) : ''}`
          }
        </div>

        <div class="pie-rec">
          ${
            editable()
              ? `<button class="btn primario grande" id="cerrar">${icono('candado')} Cerrar y enviar recepción</button>
                 <p class="nota">Al cerrar, ya no se puede cambiar. Si después algo está mal, se hace una corrección y las dos quedan a la vista.</p>
                 ${esAdmin() ? '<button class="btn peligro chico" id="borrar">Borrar (admin)</button>' : ''}`
              : `<button class="btn" id="imp-rec">${icono('imprimir')} Imprimir reporte</button>
                 ${!corr ? '<button class="btn" id="corregir">Hacer corrección</button>' : ''}
                 ${esAdmin() ? '<button class="btn chico" id="reabrir">Reabrir (admin)</button><button class="btn peligro chico" id="borrar">Borrar (admin)</button>' : ''}`
          }
        </div>
        <datalist id="dl-prov">${proveedores.map((p) => `<option value="${h(p.nombre)}">`).join('')}</datalist>
        <datalist id="dl-prod">${productos.map((p) => `<option value="${h(p.nombre)}">`).join('')}</datalist>`

      // Ver una foto en grande.
      $$('[data-foto]', v).forEach((b) => (b.onclick = () => verFoto(fotos.find((f) => f.id === b.dataset.foto))))
      $('#imp-rec', v)?.addEventListener('click', () => imprimirRecepcion(r))
      $('#corregir', v)?.addEventListener('click', corregir)
      $('#reabrir', v)?.addEventListener('click', async () => {
        if (!(await confirmar('Reabrir recepción', 'Como administrador puedes reabrirla para cambiarla. Queda anotado en la bitácora.', 'Reabrir'))) return
        const x = await intenta(() => D.reabrirRecepcion(r.id), 'Reabierta')
        if (x) {
          r = x
          pintar()
        }
      })
      $('#borrar', v)?.addEventListener('click', async () => {
        if (!(await confirmar('Borrar recepción', `Se borra ${folio('R', r.folio)} con sus productos y fotos. Queda anotado en la bitácora.`, 'Borrar', true))) return
        if ((await intenta(() => D.borrarRecepcion(r.id), 'Borrada')) !== undefined) location.hash = 'recibir'
      })
      if (!editable()) return

      // Los campos de la recepción: se guardan solos al cambiar.
      $$('[data-campo]', v).forEach((el) =>
        el.addEventListener('change', async () => {
          const k = el.dataset.campo
          let val = el.type === 'checkbox' ? el.checked : el.value
          const cambios = {}
          if (k === 'proveedor_nombre') {
            const p = proveedores.find((x) => plegar(x.nombre) === plegar(val))
            cambios.proveedor_id = p?.id ?? null
            val = p?.nombre ?? val.trim()
          }
          if (k === 'transporte_ok') val = val === 'si' ? true : val === 'no' ? false : null
          if (k === 'packing_fecha' || k === 'pedido_id') val = val || null
          cambios[k] = val
          if ((await guardarR(cambios)) && (k === 'sin_packing' || k === 'pedido_id')) pintar()
        }),
      )
      $$('[data-subir]', v).forEach((inp) => inp.addEventListener('change', () => subirFotos(inp.dataset.subir, [...inp.files])))
      $('#leer', v)?.addEventListener('click', leer)
      $('#revisar', v)?.addEventListener('click', revisar)
      $('#mas-linea', v)?.addEventListener('click', async () => {
        const l = await intenta(() => D.guardarLinea({ recepcion_id: r.id, orden: r.lineas.length + 1 }))
        if (l) {
          r.lineas.push(l)
          await pintar()
          $(`[data-linea="${l.id}"] input`, v)?.focus()
        }
      })
      $('#igual', v)?.addEventListener('click', async () => {
        for (const l of r.lineas) {
          if (l.cantidad_esperada === null || (l.cantidad_recibida !== null && l.cantidad_recibida !== '')) continue
          const x = await intenta(() => D.guardarLinea({ id: l.id, cantidad_recibida: l.cantidad_esperada }))
          if (x) Object.assign(l, x)
        }
        pintar()
      })
      // Cada producto se guarda solo al cambiar.
      $$('[data-linea]', v).forEach((fila) => {
        const l = r.lineas.find((x) => x.id === fila.dataset.linea)
        $$('[data-l]', fila).forEach((el) =>
          el.addEventListener('change', async () => {
            const k = el.dataset.l
            let val = el.value
            const cambios = {}
            if (['cantidad_esperada', 'cantidad_recibida', 'danados', 'precio'].includes(k)) val = val === '' ? (k === 'danados' ? 0 : null) : Number(val)
            if (k === 'caducidad') val = val || null
            if (k === 'producto') {
              const p = productos.find((x) => plegar(x.nombre) === plegar(val))
              cambios.producto_id = p?.id ?? null
              if (p) {
                val = p.nombre
                if (!l.unidad) cambios.unidad = p.unidad
              }
            }
            cambios[k] = val
            const x = await intenta(() => D.guardarLinea({ id: l.id, ...cambios }))
            if (x) {
              Object.assign(l, x)
              if (k === 'producto' || ['cantidad_esperada', 'cantidad_recibida', 'danados'].includes(k)) {
                const aviso = $('.falta', fila)
                if (aviso) aviso.outerHTML = faltaHtml(l)
                if (cambios.unidad) $('[data-l=unidad]', fila).value = cambios.unidad
              }
            }
          }),
        )
        $('[data-quitar]', fila)?.addEventListener('click', async () => {
          if ((await intenta(() => D.borrarLinea(l.id))) === undefined) return
          r.lineas = r.lineas.filter((x) => x.id !== l.id)
          pintar()
        })
      })
      $('#cerrar', v)?.addEventListener('click', cerrar)
    }

    const faltaHtml = (l) => {
      const e = l.cantidad_esperada
      const g = l.cantidad_recibida
      if (e === null || g === null || g === '' || e === '') return '<span class="falta"></span>'
      if (Number(g) < Number(e)) return `<span class="falta rojo">Faltan ${cant(e - g)}</span>`
      if (Number(g) > Number(e)) return `<span class="falta ambar">Sobran ${cant(g - e)}</span>`
      return `<span class="falta verde">Completo</span>`
    }

    function lineaHtml(l, i) {
      const dis = editable() ? '' : 'disabled'
      const d = diasPara(l.caducidad)
      return `<div class="linea" data-linea="${l.id}">
        <div class="l-cab"><span class="num">${i + 1}</span><input class="l-prod" data-l="producto" list="dl-prod" value="${h(l.producto)}" placeholder="Producto" ${dis}>${editable() ? '<button class="quitar" data-quitar title="Quitar">×</button>' : ''}</div>
        <div class="l-campos">
          <label>Unidad<input data-l="unidad" value="${h(l.unidad)}" placeholder="costal, lb…" ${dis}></label>
          <label>Según la hoja<input type="number" inputmode="decimal" min="0" step="any" data-l="cantidad_esperada" value="${h(l.cantidad_esperada ?? '')}" ${dis}></label>
          <label>Llegó<input type="number" inputmode="decimal" min="0" step="any" data-l="cantidad_recibida" value="${h(l.cantidad_recibida ?? '')}" class="fuerte" ${dis}></label>
          <label>Dañados<input type="number" inputmode="decimal" min="0" step="any" data-l="danados" value="${h(l.danados || '')}" placeholder="0" ${dis}></label>
          <label>Lote<input data-l="lote" value="${h(l.lote)}" ${dis}></label>
          <label>Caducidad<input type="date" data-l="caducidad" value="${h(l.caducidad ?? '')}" ${dis}>${d !== null && d <= CADUCA_PRONTO ? `<small class="${d < 0 ? 'rojo' : 'ambar'}">${d < 0 ? 'Ya caducó' : `en ${d} días`}</small>` : ''}</label>
          <label>Calidad<select data-l="calidad" ${dis}><option value="">—</option>${Object.entries(CALIDAD).map(([k, t]) => `<option value="${k}" ${l.calidad === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label>Problema<select data-l="problema" ${dis}>${Object.entries(PROBLEMA).map(([k, t]) => `<option value="${k}" ${l.problema === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="ancho">Nota<input data-l="nota" value="${h(l.nota)}" ${dis}></label>
        </div>
        ${faltaHtml(l)}
      </div>`
    }

    async function subirFotos(tipo, archivos) {
      if (!archivos.length) return
      aviso(archivos.length > 1 ? `Subiendo ${archivos.length} fotos…` : 'Subiendo foto…')
      let subidas = 0
      for (const f of archivos.slice(0, 12)) {
        const blob = await intenta(() => reducir(f))
        if (!blob) continue
        const a = await intenta(() => D.subirFoto(r.id, tipo, blob))
        if (a) {
          r.archivos.push(a)
          subidas += 1
        }
      }
      if (!subidas) return
      r = (await intenta(() => D.recepcion(r.id))) ?? r
      await pintar()
      if (tipo === 'packing') leer()
    }

    /** Las fotos de un tipo, listas para Ana Sofi. */
    async function fotosParaIA(tipos, max) {
      if (D.muestra) return []
      const lista = r.archivos.filter((a) => tipos.includes(a.tipo)).sort((a, b) => a.subido.localeCompare(b.subido)).slice(-max)
      const out = []
      for (const a of lista) {
        const blob = await reducir(await D.fotoUrl(a.ruta), 1400, 0.78).catch(() => null)
        if (blob) out.push({ tipo: 'image/jpeg', uso: a.tipo, nota: a.nota, data: await base64(blob) })
      }
      return out
    }

    async function trabajando(boton, texto, fn) {
      const b = $(boton, v)
      const antes = b?.innerHTML
      if (b) {
        b.disabled = true
        b.innerHTML = `<span class="giro"></span> ${texto}`
      }
      try {
        return await fn()
      } finally {
        if (b && b.isConnected) {
          b.disabled = false
          b.innerHTML = antes
        }
      }
    }

    async function leer() {
      const imgs = await fotosParaIA(['packing'], 4)
      if (!D.muestra && !imgs.length) return aviso('Primero toma la foto del packing slip', 'mal')
      if (!$('#leer', v)) aviso('Ana Sofi está leyendo el packing slip…')
      const ficha = await trabajando('#leer', 'Ana Sofi está leyendo…', () => intenta(() => D.leerPacking(imgs)))
      if (!ficha) return
      if (!ficha.es_packing) {
        notasIA.set(r.id, ['Esa foto no parece un packing slip. Tómala otra vez, derecha y con luz.'])
        return pintar()
      }
      const cambios = { ia_leido_en: new Date().toISOString() }
      if (!r.proveedor_id && !r.proveedor_nombre) {
        cambios.proveedor_id = ficha.proveedor_id || null
        cambios.proveedor_nombre = proveedores.find((p) => p.id === ficha.proveedor_id)?.nombre || ficha.proveedor_nombre
      }
      if (!r.packing_numero && ficha.packing_numero) cambios.packing_numero = ficha.packing_numero
      if (!r.packing_fecha && ficha.packing_fecha) cambios.packing_fecha = ficha.packing_fecha
      if (r.sin_packing) cambios.sin_packing = false
      await guardarR(cambios)
      // Los productos: los nuevos se agregan; a los que ya estaban se les completa lote y caducidad.
      let n = r.lineas.length
      for (const f of ficha.lineas) {
        const ya = r.lineas.find((l) => (f.producto_id && l.producto_id === f.producto_id) || plegar(l.producto) === plegar(f.producto))
        if (ya) {
          const c = {}
          if (!ya.lote && f.lote) c.lote = f.lote
          if (!ya.caducidad && f.caducidad) c.caducidad = f.caducidad
          if (ya.cantidad_esperada === null && f.cantidad) c.cantidad_esperada = f.cantidad
          if (ya.precio === null && f.precio) c.precio = f.precio
          if (Object.keys(c).length) await intenta(() => D.guardarLinea({ id: ya.id, ...c }))
          continue
        }
        const cat = productos.find((p) => p.id === f.producto_id)
        await intenta(() =>
          D.guardarLinea({
            recepcion_id: r.id,
            orden: ++n,
            producto_id: cat?.id ?? null,
            producto: cat?.nombre ?? f.producto,
            unidad: f.unidad || cat?.unidad || '',
            cantidad_esperada: f.cantidad || null,
            lote: f.lote,
            caducidad: f.caducidad || null,
            precio: f.precio || null,
          }),
        )
      }
      const dice = [`Leí el packing slip de ${cambios.proveedor_nombre || provDe(r) || 'el proveedor'}${ficha.packing_numero ? ` (${ficha.packing_numero})` : ''} con ${ficha.lineas.length} producto${ficha.lineas.length === 1 ? '' : 's'}. Ahora cuenta lo que llegó.`]
      if (ficha.notas) dice.push(ficha.notas)
      for (const x of ficha.dudas ?? []) dice.push(`Revisa: ${x}`)
      notasIA.set(r.id, dice)
      r = (await D.recepcion(r.id)) ?? r
      pintar()
    }

    async function revisar() {
      if (!r.lineas.length) return aviso('Agrega primero lo que llegó', 'mal')
      const imgs = await fotosParaIA(['mercancia', 'dano'], 6)
      const datos = { ...r, proveedor: provDe(r), lineas: r.lineas, archivos: undefined }
      const rev = await trabajando('#revisar', 'Ana Sofi está revisando…', () => intenta(() => D.revisar(datos, imgs)))
      if (!rev) return
      for (const x of rev.lineas) {
        const l = r.lineas.find((y) => y.id === x.id)
        if (!l) continue
        await intenta(() => D.guardarLinea({ id: l.id, problema: x.problema, calidad: x.calidad, ...(l.nota ? {} : { nota: x.nota }) }))
      }
      await guardarR({ resultado: rev.resultado, resumen: rev.resumen, incidencias: rev.incidencias, ia_revisado_en: new Date().toISOString() })
      notasIA.set(r.id, rev.dudas?.length ? rev.dudas.map((d) => `Revisa: ${d}`) : ['Listo. Si todo está bien, cierra la recepción.'])
      r = (await D.recepcion(r.id)) ?? r
      pintar()
    }

    /** Antes de cerrar: proveedor y productos nuevos quedan en el catálogo. */
    async function alCatalogo() {
      try {
        if (!r.proveedor_id && r.proveedor_nombre.trim()) {
          let p = proveedores.find((x) => plegar(x.nombre) === plegar(r.proveedor_nombre))
          if (!p) p = await D.guardarProveedor({ nombre: r.proveedor_nombre.trim() })
          proveedores.push(p)
          await D.guardarRecepcion({ id: r.id, proveedor_id: p.id })
        }
        for (const l of r.lineas) {
          if (l.producto_id || !l.producto.trim()) continue
          let p = productos.find((x) => plegar(x.nombre) === plegar(l.producto))
          if (!p) {
            p = await D.guardarProducto({ nombre: l.producto.trim(), unidad: l.unidad, proveedor_id: r.proveedor_id || proveedores.find((x) => plegar(x.nombre) === plegar(r.proveedor_nombre))?.id || null })
            productos.push(p)
          }
          await D.guardarLinea({ id: l.id, producto_id: p.id })
        }
      } catch {
        // El catálogo es una ayuda: si no se pudo, la recepción se cierra igual.
      }
    }

    async function cerrar() {
      r = (await D.recepcion(r.id)) ?? r
      const faltan = []
      if (!r.proveedor_id && !r.proveedor_nombre.trim()) faltan.push('el proveedor')
      if (!r.lineas.length) faltan.push('lo que llegó')
      if (r.lineas.some((l) => !l.producto.trim())) faltan.push('el nombre de cada producto')
      if (r.lineas.some((l) => l.cantidad_recibida === null || l.cantidad_recibida === '')) faltan.push('cuánto llegó de cada producto')
      if (!r.sin_packing && !r.archivos.some((a) => a.tipo === 'packing')) faltan.push('la foto del packing slip (o marcar que no lo trajo)')
      if (!r.archivos.some((a) => ['mercancia', 'dano'].includes(a.tipo))) faltan.push('al menos una foto de la mercancía')
      if (faltan.length) return aviso(`Falta: ${faltan.join(', ')}.`, 'mal')
      const inc = incidenciasDe(r)
      const ok = await confirmar(
        'Cerrar y enviar recepción',
        `${inc.length ? `<b>${inc.length} problema${inc.length > 1 ? 's' : ''}</b> anotado${inc.length > 1 ? 's' : ''}. ` : 'Todo llegó bien. '}Al cerrar, la recepción <b>ya no se puede cambiar</b>: queda con la hora del servidor y tu nombre. Si después algo está mal, se hace una corrección.`,
        'Cerrar y enviar',
      )
      if (!ok) return
      await alCatalogo()
      const x = await intenta(() => D.cerrarRecepcion(r.id), 'Recepción cerrada y enviada')
      if (x) {
        r = x
        notasIA.delete(r.id)
        await cargar('recs', 'pedidos', 'catalogo')
        pintar()
      }
    }

    function corregir() {
      abrirModal(
        `<h2>Hacer corrección de ${folio('R', r.folio)}</h2>
         <p>Se crea una copia abierta con todo lo que tenía (fotos incluidas) para corregir lo que estuvo mal. La original <b>no se borra</b>: las dos quedan a la vista y vale la corrección.</p>
         <form id="f-corr"><label>¿Qué estuvo mal?<textarea name="motivo" rows="3" required minlength="3" placeholder="ej. Conté 25 costales pero eran 24"></textarea></label>
         <div class="pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Hacer corrección</button></div></form>`,
        (c) => {
          $('#f-corr', c).onsubmit = async (e) => {
            e.preventDefault()
            const nid = await intenta(() => D.corregirRecepcion(r.id, e.target.motivo.value), 'Corrección creada: corrige lo que haga falta y ciérrala')
            if (nid) {
              cerrarModal()
              location.hash = `recepcion/${nid}`
            }
          }
        },
      )
    }

    function verFoto(f) {
      const l = r.lineas.find((x) => x.id === f.linea_id)
      abrirModal(
        `<img class="grande" src="${h(f.url)}" alt="">
         <p><b>${FOTO[f.tipo]}</b>${l ? ` · ${h(l.producto)}` : ''} · ${fechaHora(f.subido)} · ${h(nombreDe(f.subido_por))}</p>
         ${f.nota ? `<p>${h(f.nota)}</p>` : ''}
         <div class="pie">${r.estado === 'borrador' || esAdmin() ? '<button class="btn peligro chico" id="quitar-foto">Quitar foto</button>' : ''}<button class="btn" data-cerrar>Cerrar</button></div>`,
        (c) =>
          $('#quitar-foto', c)?.addEventListener('click', async () => {
            if ((await intenta(() => D.borrarFoto(f.id))) === undefined) return
            cerrarModal()
            r = (await D.recepcion(r.id)) ?? r
            pintar()
          }),
        'foto-caja',
      )
    }

    await pintar()
  }

  function incidenciasHtml(r) {
    const lista = incidenciasDe(r)
    if (!lista.length) return r.estado === 'cerrada' ? `<p>${chip('Sin problemas', 'r-completa')}</p>` : ''
    const total = lista.reduce((s, i) => s + (i.valor || 0), 0)
    return `<ul class="incidencias">${lista
      .map((i) => `<li class="inc-${h(i.tipo)}"><b>${h(INCIDENCIA[i.tipo] ?? i.tipo)}${i.producto ? ` · ${h(i.producto)}` : ''}${i.cantidad ? ` · ${cant(i.cantidad)}` : ''}</b><small>${h(i.detalle)}${i.valor ? ` · ${dinero(i.valor)}` : ''}</small></li>`)
      .join('')}</ul>${total ? `<p class="nota">Valor afectado según los precios de la hoja: <b>${dinero(total)}</b></p>` : ''}`
  }

  // ------------------------------------------------------------ imprimir

  /** Lo que hay en #imprimir sale en hoja carta; lo demás de la página se esconde. */
  function imprimir(html) {
    const el = $('#imprimir')
    el.innerHTML = `<div class="hoja"><header><img src="${LOGO}" alt="Mi Semago"><div><b>Inventario Mi Semago</b><span>Impreso ${fechaHora(new Date().toISOString())} por ${h(yo.nombre)}</span></div></header>${html}<footer>Registro del sistema de inventario. Las horas las pone el servidor y lo cerrado no se modifica; los cambios se hacen con correcciones que quedan a la vista.</footer></div>`
    const imgs = $$('img', el)
    Promise.all(imgs.map((i) => (i.complete ? null : new Promise((ok) => ((i.onload = ok), (i.onerror = ok)))))).then(() => {
      print()
    })
  }

  async function imprimirRecepcion(r) {
    const fotos = await Promise.all(r.archivos.map(async (a) => ({ ...a, url: await D.fotoUrl(a.ruta) })))
    const orig = r.corrige_id ? recDe(r.corrige_id) : null
    const corr = corrigeA(recs, r)
    imprimir(`
      <h1>Reporte de recepción ${folio('R', r.folio)}</h1>
      ${orig ? `<p class="caja-imp">Corrección de ${folio('R', orig.folio)}. Motivo: ${h(r.motivo)}</p>` : ''}
      ${corr ? `<p class="caja-imp">Esta recepción fue corregida por ${folio('R', corr.folio)}: ${h(corr.motivo)}</p>` : ''}
      <table class="datos">
        <tr><th>Proveedor</th><td>${h(provDe(r))}</td><th>Resultado</th><td><b>${RESULTADO[resultadoDe(r)]}</b></td></tr>
        <tr><th>Packing slip</th><td>${r.sin_packing ? '<b>NO lo trajo</b>' : `${h(r.packing_numero || 'Sí')}${r.packing_fecha ? ` · ${fechaCorta(r.packing_fecha)}` : ''}`}</td><th>Pedido</th><td>${r.pedido_id ? folio('P', pedDe(r.pedido_id)?.folio) : '—'}</td></tr>
        <tr><th>Llegó</th><td>${fechaHora(r.llegada)}</td><th>Recibió</th><td>${h(nombreDe(r.creado_por))}</td></tr>
        <tr><th>Inspección</th><td>${fechaHora(r.inspeccion_en) || '—'}</td><th>Cerrada</th><td>${fechaHora(r.cerrada_en) || 'Abierta'}${r.cerrada_en ? ` · ${h(nombreDe(r.cerrada_por))} (${minutos(r.llegada, r.cerrada_en)})` : ''}</td></tr>
        <tr><th>Temperatura</th><td>${h(r.temperatura || '—')}</td><th>Transporte</th><td>${r.transporte_ok === true ? 'Limpio y en buen estado' : r.transporte_ok === false ? '<b>Sucio o en mal estado</b>' : '—'}</td></tr>
      </table>
      <h2>Productos</h2>
      <table class="tabla"><thead><tr><th>Producto</th><th>Hoja</th><th>Llegó</th><th>Dañados</th><th>Lote</th><th>Caducidad</th><th>Calidad</th><th>Problema</th></tr></thead><tbody>
        ${r.lineas.map((l) => `<tr><td>${h(l.producto)}<small>${h(l.nota)}</small></td><td>${cant(l.cantidad_esperada)} ${h(l.unidad)}</td><td><b>${cant(l.cantidad_recibida)}</b></td><td>${Number(l.danados) ? `<b>${cant(l.danados)}</b>` : '0'}</td><td>${h(l.lote || '—')}</td><td>${l.caducidad ? fechaCorta(l.caducidad) : '—'}</td><td>${CALIDAD[l.calidad] ?? '—'}</td><td>${l.problema === 'ninguno' ? '—' : PROBLEMA[l.problema]}</td></tr>`).join('')}
      </tbody></table>
      <h2>Problemas</h2>${incidenciasHtml(r) || '<p>Ninguno.</p>'}
      ${r.resumen ? `<h2>Resumen</h2><p>${h(r.resumen)}</p>` : ''}
      ${r.notas ? `<h2>Notas de quien recibió</h2><p>${h(r.notas)}</p>` : ''}
      ${fotos.length ? `<h2>Fotos</h2><div class="fotos-imp">${fotos.map((f) => `<figure><img src="${h(f.url)}" alt=""><figcaption>${FOTO[f.tipo]} · ${fechaHora(f.subido)}</figcaption></figure>`).join('')}</div>` : ''}
      <div class="firmas"><div>Recibió</div><div>Revisó</div><div>Chofer / proveedor</div></div>`)
  }

  // ------------------------------------------------------------ pedidos

  async function vistaPedidos(v, abrir) {
    titulo('Pedidos')
    await cargar('pedidos', 'recs')
    const filtros = { comprar: 'Por comprar', camino: 'Comprados, en camino', recibidos: 'Recibidos', todos: 'Todos' }
    let filtro = sessionStorage.getItem('inv-filtro-pedidos') || (compra() ? 'comprar' : 'todos')
    const pasa = (p) => {
      const e = estadoPedido(p, pedidos)
      return filtro === 'todos' || (filtro === 'comprar' && e === 'pedido') || (filtro === 'camino' && e === 'comprado') || (filtro === 'recibidos' && e === 'recibido')
    }
    const tarjeta = (p) => {
      const e = estadoPedido(p, pedidos)
      const orig = p.corrige_id ? pedDe(p.corrige_id) : null
      const corr = corrigeA(pedidos, p)
      const rec = recs.find((r) => r.pedido_id === p.id && r.estado === 'cerrada')
      return `<div class="pedido vidrio ${e}" id="p-${p.id}">
        <div class="fila"><b>${folio('P', p.folio)}</b>${chipEstadoPedido(p)}${p.urgente ? chip('Urgente', 'urgente') : ''}${sello}</div>
        ${orig ? `<p class="corr-nota">Corrección de ${folio('P', orig.folio)}: ${h(p.motivo)}</p>` : ''}
        ${p.cancela ? '<p class="corr-nota">Cancela el pedido anterior: ya no se necesita.</p>' : `<ul class="items">${p.lineas.map((l) => `<li><b>${cant(l.cantidad)} ${h(l.unidad)}</b> ${h(l.producto)}${l.nota ? `<small>${h(l.nota)}</small>` : ''}</li>`).join('')}</ul>`}
        ${p.nota ? `<p class="nota">${h(p.nota)}</p>` : ''}
        <small class="quien">Pidió ${h(nombreDe(p.pedido_por))} · ${fechaHora(p.pedido_en)}${p.proveedor_texto ? ` · sugiere ${h(p.proveedor_texto)}` : ''}</small>
        ${p.comprado_en ? `<small class="quien">Compró ${h(nombreDe(p.comprado_por))} · ${fechaHora(p.comprado_en)}${provDe({ proveedor_id: p.proveedor_id }) ? ` · ${h(provDe({ proveedor_id: p.proveedor_id }))}` : ''}${p.orden_compra ? ` · orden ${h(p.orden_compra)}` : ''}${p.llega ? ` · llega ${fechaCorta(p.llega)}` : ''}${p.nota_compra ? ` · ${h(p.nota_compra)}` : ''}</small>` : ''}
        ${rec ? `<small class="quien">Llegó en <a href="#recepcion/${rec.id}">${folio('R', rec.folio)}</a> · ${fechaHora(rec.llegada)}</small>` : ''}
        ${corr ? `<p class="corr-nota alerta">${corr.cancela ? 'Cancelado' : 'Corregido'} por ${folio('P', corr.folio)}: ${h(corr.motivo)}</p>` : ''}
        <div class="botones">
          ${e === 'pedido' && compra() ? `<button class="btn primario chico" data-comprar="${p.id}">✓ Orden comprada</button>` : ''}
          ${!corr && !p.cancela && e !== 'recibido' ? `<button class="btn chico" data-corregir="${p.id}">Hacer corrección</button>` : ''}
          ${esAdmin() ? `<button class="btn peligro chico" data-borrar="${p.id}">Borrar (admin)</button>` : ''}
        </div>
      </div>`
    }
    const pintar = () => {
      const lista = pedidos.filter(pasa)
      v.innerHTML = `
        <div class="acciones"><button class="btn primario grande" id="nuevo">${icono('pedidos')} Pedir algo</button></div>
        <div class="tabs vidrio">${Object.entries(filtros).map(([k, t]) => `<button class="${k === filtro ? 'activa' : ''}" data-f="${k}">${t} <small>${pedidos.filter((p) => { const e = estadoPedido(p, pedidos); return k === 'todos' || (k === 'comprar' && e === 'pedido') || (k === 'camino' && e === 'comprado') || (k === 'recibidos' && e === 'recibido') }).length}</small></button>`).join('')}</div>
        <div class="pedidos">${lista.map(tarjeta).join('') || '<p class="vacio">Nada aquí.</p>'}</div>`
      $('#nuevo', v).onclick = () => formPedido()
      $$('[data-f]', v).forEach((b) => (b.onclick = () => {
        filtro = b.dataset.f
        sessionStorage.setItem('inv-filtro-pedidos', filtro)
        pintar()
      }))
      $$('[data-comprar]', v).forEach((b) => (b.onclick = () => formComprado(pedDe(b.dataset.comprar))))
      $$('[data-corregir]', v).forEach((b) => (b.onclick = () => formPedido(pedDe(b.dataset.corregir))))
      $$('[data-borrar]', v).forEach((b) => (b.onclick = async () => {
        const p = pedDe(b.dataset.borrar)
        if (!(await confirmar('Borrar pedido', `Se borra ${folio('P', p.folio)}. Queda anotado en la bitácora.`, 'Borrar', true))) return
        if ((await intenta(() => D.borrarPedido(p.id), 'Borrado')) !== undefined) mostrar()
      }))
    }
    pintar()
    if (abrir) {
      const p = pedDe(abrir)
      if (p && !pasa(p)) {
        filtro = 'todos'
        pintar()
      }
      $(`#p-${abrir}`, v)?.scrollIntoView({ block: 'center' })
      $(`#p-${abrir}`, v)?.classList.add('brilla')
    }
  }

  /** "Pedir algo" o, con `orig`, la corrección de un pedido. */
  function formPedido(orig = null) {
    const filaHtml = (l = {}) => `<div class="p-linea">
      <input name="producto" list="dl-prod-p" placeholder="¿Qué se necesita?" value="${h(l.producto ?? '')}" required>
      <input name="cantidad" type="number" inputmode="decimal" min="0.01" step="any" placeholder="Cuánto" value="${h(l.cantidad ?? '')}" required>
      <input name="unidad" placeholder="costal, lb…" value="${h(l.unidad ?? '')}">
      <input name="nota" placeholder="Nota (opcional)" value="${h(l.nota ?? '')}">
      <button type="button" class="quitar" title="Quitar">×</button></div>`
    abrirModal(
      `<h2>${orig ? `Corregir ${folio('P', orig.folio)}` : 'Pedir algo'}</h2>
       <p class="nota">${orig ? 'El pedido original no se borra: este lo reemplaza y los dos quedan a la vista.' : 'Anota lo que se necesita. Compras lo verá y lo marcará cuando lo compre.'}</p>
       <form id="f-ped">
         ${orig ? `<label>¿Qué estuvo mal?<textarea name="motivo" rows="2" required minlength="3"></textarea></label><label class="check"><input type="checkbox" name="cancela"><span>Ya no se necesita: <b>cancelar</b> el pedido</span></label>` : ''}
         <div id="p-lineas">${(orig?.lineas.length ? orig.lineas : [{}]).map(filaHtml).join('')}</div>
         <button type="button" class="btn chico" id="p-mas">${icono('mas')} Otro producto</button>
         <div class="campos">
           <label>Proveedor <small>(si lo sabes)</small><input name="proveedor_texto" list="dl-prov-p" value="${h(orig?.proveedor_texto ?? '')}"></label>
           <label class="check"><input type="checkbox" name="urgente" ${orig?.urgente ? 'checked' : ''}> Es urgente</label>
         </div>
         <label>Nota<textarea name="nota" rows="2">${h(orig?.nota ?? '')}</textarea></label>
         <div class="pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">${orig ? 'Enviar corrección' : 'Realizar pedido'}</button></div>
       </form>
       <datalist id="dl-prod-p">${productos.map((p) => `<option value="${h(p.nombre)}">`).join('')}</datalist>
       <datalist id="dl-prov-p">${proveedores.map((p) => `<option value="${h(p.nombre)}">`).join('')}</datalist>`,
      (c) => {
        const cont = $('#p-lineas', c)
        const enlazar = () =>
          $$('.p-linea', cont).forEach((f) => {
            $('.quitar', f).onclick = () => cont.children.length > 1 && f.remove()
            $('[name=producto]', f).onchange = (e) => {
              const p = productos.find((x) => plegar(x.nombre) === plegar(e.target.value))
              if (p && !$('[name=unidad]', f).value) $('[name=unidad]', f).value = p.unidad
            }
          })
        enlazar()
        $('#p-mas', c).onclick = () => {
          cont.insertAdjacentHTML('beforeend', filaHtml())
          enlazar()
          $('.p-linea:last-child input', cont).focus()
        }
        const cancela = $('[name=cancela]', c)
        if (cancela) cancela.onchange = () => $$('.p-linea input, #p-mas', c).forEach((x) => (x.disabled = cancela.checked))
        $('#f-ped', c).onsubmit = async (e) => {
          e.preventDefault()
          const f = e.target
          const lineas = $$('.p-linea', cont)
            .map((x) => {
              const nombre = $('[name=producto]', x).value.trim()
              const p = productos.find((y) => plegar(y.nombre) === plegar(nombre))
              return { producto: p?.nombre ?? nombre, producto_id: p?.id ?? '', cantidad: Number($('[name=cantidad]', x).value), unidad: $('[name=unidad]', x).value.trim(), nota: $('[name=nota]', x).value.trim() }
            })
            .filter((l) => l.producto && l.cantidad > 0)
          const datos = { lineas, proveedor_texto: f.proveedor_texto.value, urgente: f.urgente.checked, nota: f.nota.value }
          if (orig) Object.assign(datos, { corrige_id: orig.id, motivo: f.motivo.value, cancela: f.cancela.checked })
          const ok = await confirmar(
            orig ? 'Enviar corrección' : 'Realizar pedido',
            `${datos.cancela ? `Se cancela ${folio('P', orig.folio)}.` : lineas.map((l) => `<b>${cant(l.cantidad)} ${h(l.unidad)}</b> ${h(l.producto)}`).join('<br>')}<br><br>Una vez enviado <b>ya no se puede cambiar</b>. Si te equivocas, haz una corrección.`,
            orig ? 'Enviar corrección' : 'Realizar pedido',
          )
          if (!ok) return formPedido(orig)
          const id = await intenta(() => D.hacerPedido(datos), orig ? 'Corrección enviada' : 'Pedido realizado: compras ya lo ve')
          if (id) location.hash = `pedidos/${id}`
        }
      },
      'ancha',
    )
  }

  function formComprado(p) {
    abrirModal(
      `<h2>Orden comprada · ${folio('P', p.folio)}</h2>
       <ul class="items">${p.lineas.map((l) => `<li><b>${cant(l.cantidad)} ${h(l.unidad)}</b> ${h(l.producto)}</li>`).join('')}</ul>
       <form id="f-comp">
         <div class="campos">
           <label>Proveedor<input name="proveedor" list="dl-prov-c" value="${h(p.proveedor_texto)}" required></label>
           <label>Número de orden / confirmación<input name="orden_compra"></label>
           <label>¿Cuándo llega?<input name="llega" type="date"></label>
         </div>
         <label>Nota<textarea name="nota" rows="2" placeholder="ej. pagado con tarjeta, llega en 2 entregas…"></textarea></label>
         <div class="pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Marcar como comprada</button></div>
       </form>
       <datalist id="dl-prov-c">${proveedores.map((x) => `<option value="${h(x.nombre)}">`).join('')}</datalist>`,
      (c) => {
        $('#f-comp', c).onsubmit = async (e) => {
          e.preventDefault()
          const f = e.target
          const nombre = f.proveedor.value.trim()
          let prov = proveedores.find((x) => plegar(x.nombre) === plegar(nombre))
          if (!prov && nombre) prov = await intenta(() => D.guardarProveedor({ nombre }))
          if (!prov) return
          if (!proveedores.includes(prov)) proveedores.push(prov)
          const ok = await confirmar('Marcar como comprada', `${folio('P', p.folio)} quedará como <b>comprada</b> a ${h(prov.nombre)}, con tu nombre y la hora de ahora. Ya no se puede cambiar.`, 'Sí, está comprada')
          if (!ok) return formComprado(p)
          const r = await intenta(() => D.marcarComprado(p.id, { proveedor_id: prov.id, orden_compra: f.orden_compra.value, llega: f.llega.value, nota: f.nota.value }), 'Orden comprada: los empleados ya lo ven')
          if (r !== undefined) mostrar()
        }
      },
    )
  }

  // --------------------------------------------------------- inventario

  async function vistaInventario(v) {
    titulo('Inventario')
    await cargar('recs', 'salidas')
    const ex = existencias(recs, salidas, productos)
    let busca = ''
    const corrS = (s) => corrigeA(salidas, s)
    const vigentes = new Set(salidasVigentes(salidas).map((s) => s.id))
    const pintar = () => {
      const t = plegar(busca)
      const lista = ex.filter((p) => !t || plegar(p.producto).includes(t) || p.lotes.some((l) => plegar(l.lote).includes(t)))
      v.innerHTML = `
        <div class="acciones"><button class="btn primario grande" id="salida">${icono('salida')} Registrar salida</button><input class="buscar vidrio" id="buscar" placeholder="Buscar producto o lote…" value="${h(busca)}"></div>
        <p class="nota">Lo que hay = lo bueno que llegó (sin dañados) menos lo que ha salido. Por lote, el que caduca primero va primero.</p>
        <div class="existencias">${lista
          .map((p) => {
            const cad = p.lotes.map((l) => diasPara(l.caducidad)).filter((d) => d !== null)
            const peor = cad.length ? Math.min(...cad) : null
            return `<details class="exist vidrio ${p.queda < 0 ? 'negativo' : ''}">
              <summary>
                <div><b>${h(p.producto)}</b><small>${p.lotes.length} lote${p.lotes.length === 1 ? '' : 's'} · entró ${cant(p.recibido)} · salió ${cant(p.salido)}</small></div>
                <div class="der"><b class="grande">${cant(p.queda)}</b><small>${h(p.unidad)}</small>
                  ${p.bajo ? chip(`Bajo mínimo (${cant(p.minimo)})`, 'ambar') : ''}${peor !== null && peor < 0 ? chip('Hay caducado', 'rojo') : peor !== null && peor <= CADUCA_PRONTO ? chip(`Caduca en ${peor} d`, 'ambar') : ''}${p.queda < 0 ? chip('Salió más de lo que entró', 'rojo') : ''}</div>
              </summary>
              ${p.lotes.length ? `<table class="tabla"><thead><tr><th>Lote</th><th>Caducidad</th><th>Llegó</th><th>Proveedor</th><th>Queda</th></tr></thead><tbody>${p.lotes
                .map((l) => {
                  const d = diasPara(l.caducidad)
                  return `<tr><td>${h(l.lote || 'sin lote')}</td><td class="${d !== null && d < 0 ? 'rojo' : d !== null && d <= CADUCA_PRONTO ? 'ambar' : ''}">${l.caducidad ? `${fechaCorta(l.caducidad)}${d !== null && d <= CADUCA_PRONTO ? ` (${d < 0 ? 'caducó' : `${d} d`})` : ''}` : '—'}</td><td>${l.llego ? fechaCorta(l.llego) : '—'}</td><td>${h(l.proveedor || '—')}</td><td><b>${cant(l.queda)}</b></td></tr>`
                })
                .join('')}</tbody></table>` : '<p class="vacio">Sin existencias.</p>'}
            </details>`
          })
          .join('') || '<p class="vacio">Nada todavía. Lo que se recibe aparece aquí solo.</p>'}</div>
        <h2 class="grupo">Salidas recientes</h2>
        <div class="tabla-caja vidrio"><table class="tabla"><thead><tr><th>Folio</th><th>Cuándo</th><th>Quién</th><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Tipo</th><th></th></tr></thead><tbody>
          ${salidas
            .slice(0, 80)
            .map((s) => {
              const c = corrS(s)
              const o = s.corrige_id ? salidas.find((x) => x.id === s.corrige_id) : null
              return `<tr class="${vigentes.has(s.id) ? '' : 'tachado'}"><td>${folio('S', s.folio)}${sello}</td><td>${fechaHora(s.hecha_en)}</td><td>${h(nombreDe(s.hecha_por))}</td><td>${h(s.producto)}${s.nota ? `<small>${h(s.nota)}</small>` : ''}${o ? `<small>Corrige ${folio('S', o.folio)}: ${h(s.motivo)}</small>` : ''}${c ? `<small>${c.anula ? 'Anulada' : 'Corregida'} por ${folio('S', c.folio)}</small>` : ''}</td><td>${h(s.lote || '—')}</td><td>${s.anula ? 'anula' : `${cant(s.cantidad)} ${h(s.unidad)}`}</td><td>${SALIDA[s.tipo]}</td><td>${!c && !s.anula ? `<button class="btn chico" data-corr-s="${s.id}">Corregir</button>` : ''}${esAdmin() ? `<button class="btn peligro chico" data-borrar-s="${s.id}">Borrar</button>` : ''}</td></tr>`
            })
            .join('') || '<tr><td colspan="8" class="vacio">Todavía no hay salidas.</td></tr>'}
        </tbody></table></div>`
      $('#salida', v).onclick = () => formSalida(ex)
      $('#buscar', v).oninput = (e) => {
        busca = e.target.value
        const pos = e.target.selectionStart
        pintar()
        const b = $('#buscar', v)
        b.focus()
        b.setSelectionRange(pos, pos)
      }
      $$('[data-corr-s]', v).forEach((b) => (b.onclick = () => formSalida(ex, salidas.find((s) => s.id === b.dataset.corrS))))
      $$('[data-borrar-s]', v).forEach((b) => (b.onclick = async () => {
        const s = salidas.find((x) => x.id === b.dataset.borrarS)
        if (!(await confirmar('Borrar salida', `Se borra ${folio('S', s.folio)}. Queda anotado en la bitácora.`, 'Borrar', true))) return
        if ((await intenta(() => D.borrarSalida(s.id), 'Borrada')) !== undefined) mostrar()
      }))
    }
    pintar()
  }

  /** Registrar una salida o, con `orig`, corregirla. */
  function formSalida(ex, orig = null) {
    const opciones = ex.filter((p) => p.queda > 0 || p.producto === orig?.producto)
    abrirModal(
      `<h2>${orig ? `Corregir ${folio('S', orig.folio)}` : 'Registrar salida'}</h2>
       ${orig ? `<p class="nota">Era: ${cant(orig.cantidad)} ${h(orig.unidad)} de ${h(orig.producto)}${orig.lote ? `, lote ${h(orig.lote)}` : ''}. La original no se borra.</p>` : ''}
       <form id="f-sal">
         ${orig ? '<label>¿Qué estuvo mal?<textarea name="motivo" rows="2" required minlength="3"></textarea></label><label class="check"><input type="checkbox" name="anula"><span>No salió nada: <b>anular</b> la salida</span></label>' : ''}
         <div class="campos">
           <label>Producto<select name="producto" required>${opciones.map((p) => `<option value="${h(p.llave)}" ${p.producto === orig?.producto ? 'selected' : ''}>${h(p.producto)} (hay ${cant(p.queda)} ${h(p.unidad)})</option>`).join('')}</select></label>
           <label>Lote<select name="lote"></select></label>
           <label>Cantidad<input name="cantidad" type="number" inputmode="decimal" min="0.01" step="any" value="${h(orig?.cantidad ?? '')}" required></label>
           <label>Para qué<select name="tipo">${Object.entries(SALIDA).map(([k, t]) => `<option value="${k}" ${orig?.tipo === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
         </div>
         <label>Nota<input name="nota" value="${h(orig?.nota ?? '')}" placeholder="ej. producción de quesillo del martes"></label>
         <div class="pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">${orig ? 'Enviar corrección' : 'Registrar salida'}</button></div>
       </form>`,
      (c) => {
        const f = $('#f-sal', c)
        const lotes = () => {
          const p = opciones.find((x) => x.llave === f.producto.value)
          f.lote.innerHTML = `<option value="">El que caduca primero</option>${(p?.lotes ?? []).filter((l) => l.queda > 0).map((l) => `<option value="${h(l.lote)}" ${l.lote === orig?.lote ? 'selected' : ''}>${h(l.lote || 'sin lote')} · quedan ${cant(l.queda)}${l.caducidad ? ` · cad. ${fechaCorta(l.caducidad)}` : ''}</option>`).join('')}`
        }
        f.producto.onchange = lotes
        lotes()
        if (f.anula) f.anula.onchange = () => (f.cantidad.disabled = f.anula.checked)
        f.onsubmit = async (e) => {
          e.preventDefault()
          const p = opciones.find((x) => x.llave === f.producto.value)
          if (!p) return aviso('Elige un producto', 'mal')
          const anula = !!f.anula?.checked
          const s = { producto_id: p.producto_id, producto: p.producto, unidad: p.unidad, lote: f.lote.value || (p.lotes.find((l) => l.queda > 0)?.lote ?? ''), cantidad: anula ? 0 : Number(f.cantidad.value), tipo: f.tipo.value, nota: f.nota.value.trim() }
          if (orig) Object.assign(s, { corrige_id: orig.id, motivo: f.motivo.value.trim(), anula })
          if (!anula && s.cantidad > p.queda && !(await confirmar('Sale más de lo que hay', `El sistema dice que hay ${cant(p.queda)} ${h(p.unidad)} y vas a sacar ${cant(s.cantidad)}. ¿Seguro? (Quedará a la vista.)`, 'Sí, registrar'))) return
          const ok = await confirmar(orig ? 'Enviar corrección' : 'Registrar salida', `${anula ? `Se anula ${folio('S', orig.folio)}.` : `<b>${cant(s.cantidad)} ${h(s.unidad)}</b> de ${h(s.producto)}${s.lote ? `, lote ${h(s.lote)}` : ''} · ${SALIDA[s.tipo]}`}<br><br>Ya no se puede cambiar; si te equivocas, haz una corrección.`, 'Confirmar')
          if (!ok) return
          if (await intenta(() => D.registrarSalida(s), orig ? 'Corrección registrada' : 'Salida registrada')) mostrar()
        }
      },
    )
  }

  // ------------------------------------------------------------ problemas

  async function vistaProblemas(v) {
    titulo('Problemas con proveedores')
    await cargar('recs')
    const d = new Date()
    let desde = sessionStorage.getItem('inv-prob-desde') || aDia(new Date(d.getFullYear(), d.getMonth(), 1))
    let hasta = sessionStorage.getItem('inv-prob-hasta') || hoy()
    const pintar = () => {
      const enRango = recepcionesVigentes(recs).filter((r) => diaDe(r.llegada) >= desde && diaDe(r.llegada) <= hasta)
      const porProv = new Map()
      for (const r of enRango) {
        const k = provDe(r) || '—'
        const x = porProv.get(k) ?? { nombre: k, entregas: 0, conProblema: 0, valor: 0, tipos: {}, lista: [] }
        x.entregas += 1
        const inc = incidenciasDe(r)
        if (inc.length) x.conProblema += 1
        for (const i of inc) {
          x.valor += i.valor || 0
          x.tipos[i.tipo] = (x.tipos[i.tipo] ?? 0) + 1
          x.lista.push({ r, i })
        }
        porProv.set(k, x)
      }
      const provs = [...porProv.values()].sort((a, b) => b.conProblema - a.conProblema || b.entregas - a.entregas)
      const tot = provs.reduce((s, p) => ({ e: s.e + p.entregas, c: s.c + p.conProblema, v: s.v + p.valor }), { e: 0, c: 0, v: 0 })
      const html = `
        <div class="kpis">
          <div class="kpi vidrio"><span>Entregas</span><b>${tot.e}</b><small>${fechaCorta(desde)} – ${fechaCorta(hasta)}</small></div>
          <div class="kpi vidrio"><span>Con problemas</span><b>${tot.c}</b><small>${tot.e ? Math.round((tot.c / tot.e) * 100) : 0}% de las entregas</small></div>
          <div class="kpi vidrio"><span>Valor afectado</span><b>${dinero(tot.v)}</b><small>según precios de las hojas</small></div>
        </div>
        <div class="tabla-caja vidrio"><table class="tabla"><thead><tr><th>Proveedor</th><th>Entregas</th><th>Con problema</th><th>Qué pasó</th><th>Valor</th></tr></thead><tbody>
          ${provs.map((p) => `<tr><td><b>${h(p.nombre)}</b></td><td>${p.entregas}</td><td class="${p.conProblema ? 'rojo' : ''}">${p.conProblema} (${Math.round((p.conProblema / p.entregas) * 100)}%)</td><td>${Object.entries(p.tipos).map(([t, n]) => `${INCIDENCIA[t] ?? t} ×${n}`).join(', ') || '—'}</td><td>${p.valor ? dinero(p.valor) : '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="vacio">Sin entregas en estas fechas.</td></tr>'}
        </tbody></table></div>
        <h2 class="grupo">El detalle</h2>
        <div class="tabla-caja vidrio"><table class="tabla"><thead><tr><th>Recepción</th><th>Día</th><th>Proveedor</th><th>Problema</th><th>Producto</th><th>Cant.</th><th>Detalle</th></tr></thead><tbody>
          ${provs.flatMap((p) => p.lista).sort((a, b) => b.r.llegada.localeCompare(a.r.llegada)).map(({ r, i }) => `<tr><td><a href="#recepcion/${r.id}">${folio('R', r.folio)}</a></td><td>${fechaCorta(r.llegada)}</td><td>${h(provDe(r))}</td><td><b>${h(INCIDENCIA[i.tipo] ?? i.tipo)}</b></td><td>${h(i.producto || '—')}</td><td>${i.cantidad ? cant(i.cantidad) : '—'}</td><td>${h(i.detalle)}${i.valor ? ` · ${dinero(i.valor)}` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="vacio">Ningún problema. 🎉</td></tr>'}
        </tbody></table></div>`
      v.innerHTML = `
        <div class="acciones">
          <label class="fecha vidrio">Desde<input type="date" id="desde" value="${desde}"></label>
          <label class="fecha vidrio">Hasta<input type="date" id="hasta" value="${hasta}"></label>
          <button class="btn" id="imp">${icono('imprimir')} Imprimir</button>
        </div>${html}`
      $('#desde', v).onchange = (e) => {
        desde = e.target.value || desde
        sessionStorage.setItem('inv-prob-desde', desde)
        pintar()
      }
      $('#hasta', v).onchange = (e) => {
        hasta = e.target.value || hasta
        sessionStorage.setItem('inv-prob-hasta', hasta)
        pintar()
      }
      $('#imp', v).onclick = () => imprimir(`<h1>Problemas con proveedores</h1><p>${fechaLarga(desde)} a ${fechaLarga(hasta)}</p>${html.replace(/<a [^>]*>|<\/a>/g, '')}`)
    }
    pintar()
  }

  // ------------------------------------------------------------ historial

  /** Todo lo que pasó, como una lista de momentos con su hora. */
  function eventos() {
    const ev = []
    const add = (cuando, tipo, texto, link = '', quien = '') => cuando && ev.push({ cuando, tipo, texto, link, quien })
    for (const r of recs) {
      const f = folio('R', r.folio)
      const link = `#recepcion/${r.id}`
      const p = provDe(r) || 'proveedor sin nombre'
      if (r.corrige_id) add(r.creado, 'correccion', `Corrección ${f} de ${folio('R', recDe(r.corrige_id)?.folio)}: ${r.motivo}`, link, r.creado_por)
      else add(r.llegada, 'llegada', `Llegó ${p} · ${f}`, link, r.creado_por)
      if (!r.corrige_id) {
        add(r.ia_leido_en, 'ia', `Ana Sofi leyó el packing slip de ${f}`, link)
        add(r.inspeccion_en, 'inspeccion', `Inspección de ${f} (primeras fotos de la mercancía)`, link)
      }
      for (const a of r.archivos ?? []) if (!r.corrige_id || a.subido >= r.creado) add(a.subido, 'foto', `Foto de ${FOTO[a.tipo].toLowerCase()} en ${f}`, link, a.subido_por)
      add(r.ia_revisado_en, 'ia', `Ana Sofi revisó ${f}`, link)
      if (r.cerrada_en) {
        const inc = incidenciasDe(r)
        add(r.cerrada_en, inc.length ? 'problema' : 'cerrada', `Se cerró ${f} (${p}): ${RESULTADO[resultadoDe(r)]}${inc.length ? ` · ${inc.map((i) => `${INCIDENCIA[i.tipo]}${i.producto ? ` ${i.producto}` : ''}`).join(', ')}` : ''}`, link, r.cerrada_por)
      }
    }
    for (const p of pedidos) {
      const f = folio('P', p.folio)
      const link = `#pedidos/${p.id}`
      const que = p.lineas.map((l) => `${cant(l.cantidad)} ${l.unidad} ${l.producto}`.replace(/\s+/g, ' ')).join(', ')
      if (p.corrige_id) add(p.pedido_en, 'correccion', `${p.cancela ? 'Cancelación' : 'Corrección'} ${f} de ${folio('P', pedDe(p.corrige_id)?.folio)}: ${p.motivo}${que ? ` · ${que}` : ''}`, link, p.pedido_por)
      else add(p.pedido_en, 'pedido', `Pedido ${f}${p.urgente ? ' (urgente)' : ''}: ${que}`, link, p.pedido_por)
      add(p.comprado_en, 'compra', `Compra realizada ${f}${p.proveedor_id ? ` a ${provDe({ proveedor_id: p.proveedor_id })}` : ''}${p.llega ? `, llega ${fechaCorta(p.llega)}` : ''}`, link, p.comprado_por)
      add(p.recibido_en, 'cerrada', `Pedido ${f} recibido`, link)
    }
    for (const s of salidas) add(s.hecha_en, s.corrige_id ? 'correccion' : 'salida', `${s.corrige_id ? `Corrección ${folio('S', s.folio)} de ${folio('S', salidas.find((x) => x.id === s.corrige_id)?.folio)}: ${s.motivo} · ` : `Salida ${folio('S', s.folio)}: `}${s.anula ? 'anulada' : `${cant(s.cantidad)} ${s.unidad} ${s.producto}${s.lote ? ` (lote ${s.lote})` : ''} · ${SALIDA[s.tipo]}`}`, '#inventario', s.hecha_por)
    return ev.sort((a, b) => a.cuando.localeCompare(b.cuando))
  }

  async function vistaHistorial(v) {
    titulo('Historial')
    await cargar('recs', 'pedidos', 'salidas')
    const ev = eventos()
    const porDia = new Map()
    for (const e of ev) {
      const d = diaDe(e.cuando)
      porDia.set(d, (porDia.get(d) ?? 0) + 1)
    }
    let mes = deDia(sessionStorage.getItem('inv-hist-desde') || hoy())
    mes = new Date(mes.getFullYear(), mes.getMonth(), 1)
    let desde = sessionStorage.getItem('inv-hist-desde') || hoy()
    let hasta = sessionStorage.getItem('inv-hist-hasta') || desde
    let varios = false
    let primerClic = null // con "varios días": el primero que se tocó
    const TIPO = { llegada: 'Llegada', ia: 'Ana Sofi', inspeccion: 'Inspección', foto: 'Foto', cerrada: 'Cerrado', problema: 'Problema', pedido: 'Pedido', compra: 'Compra', salida: 'Salida', correccion: 'Corrección' }

    const pintar = () => {
      const y = mes.getFullYear()
      const m = mes.getMonth()
      const primero = (new Date(y, m, 1).getDay() + 6) % 7 // la semana empieza en lunes
      const dias = new Date(y, m + 1, 0).getDate()
      const celdas = []
      for (let i = 0; i < primero; i++) celdas.push('<span></span>')
      for (let d = 1; d <= dias; d++) {
        const dia = aDia(new Date(y, m, d))
        const n = porDia.get(dia) ?? 0
        const sel = dia >= desde && dia <= hasta
        celdas.push(`<button class="${sel ? 'sel' : ''} ${dia === hoy() ? 'hoy' : ''} ${n ? 'con' : ''}" data-dia="${dia}" ${dia > hoy() ? 'disabled' : ''}><b>${d}</b>${n ? `<i>${n}</i>` : ''}</button>`)
      }
      const lista = ev.filter((e) => diaDe(e.cuando) >= desde && diaDe(e.cuando) <= hasta)
      const grupos = new Map()
      for (const e of lista) {
        const d = diaDe(e.cuando)
        if (!grupos.has(d)) grupos.set(d, [])
        grupos.get(d).push(e)
      }
      const cuerpo = [...grupos.entries()]
        .map(
          ([d, es]) =>
            `<h3 class="dia">${fechaLarga(d)}</h3><ol class="linea-tiempo">${es
              .map((e) => `<li class="ev-${e.tipo}"><time>${hora(e.cuando)}</time><span class="chip t-${e.tipo}">${TIPO[e.tipo]}</span><span class="texto">${e.link ? `<a href="${e.link}">${h(e.texto)}</a>` : h(e.texto)}${e.quien ? `<small> · ${h(nombreDe(e.quien))}</small>` : ''}</span></li>`)
              .join('')}</ol>`,
        )
        .join('')
      const resumen = (() => {
        const rs = recs.filter((r) => !r.corrige_id && diaDe(r.llegada) >= desde && diaDe(r.llegada) <= hasta)
        const ps = pedidos.filter((p) => diaDe(p.pedido_en) >= desde && diaDe(p.pedido_en) <= hasta)
        const cs = pedidos.filter((p) => p.comprado_en && diaDe(p.comprado_en) >= desde && diaDe(p.comprado_en) <= hasta)
        const ss = salidas.filter((s) => diaDe(s.hecha_en) >= desde && diaDe(s.hecha_en) <= hasta)
        const co = lista.filter((e) => e.tipo === 'correccion').length
        return `${rs.length} recepciones (${rs.filter((r) => incidenciasDe(r).length).length} con problemas) · ${ps.length} pedidos · ${cs.length} compras · ${ss.length} salidas · ${co} correcciones`
      })()
      v.innerHTML = `
        <div class="historial">
          <div class="cal vidrio">
            <div class="cal-cab"><button class="btn chico" id="ant">‹</button><b>${mayuscula(mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }))}</b><button class="btn chico" id="sig">›</button></div>
            <div class="cal-sem">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span>${d}</span>`).join('')}</div>
            <div class="cal-dias">${celdas.join('')}</div>
            <label class="check"><input type="checkbox" id="varios" ${varios ? 'checked' : ''}> Elegir varios días (toca el primero y el último)</label>
            <div class="campos"><label>Desde<input type="date" id="h-desde" value="${desde}" max="${hoy()}"></label><label>Hasta<input type="date" id="h-hasta" value="${hasta}" max="${hoy()}"></label></div>
            <button class="btn" id="hoy">Hoy</button>
          </div>
          <div class="hist-lista">
            <div class="tarjeta vidrio"><div class="tit"><div><h3>${desde === hasta ? fechaLarga(desde) : `${fechaLarga(desde)} – ${fechaLarga(hasta)}`}</h3><p class="nota">${resumen}</p></div><button class="btn chico" id="imp">${icono('imprimir')} Imprimir</button></div></div>
            ${cuerpo || '<div class="tarjeta vidrio"><p class="vacio">No pasó nada en estas fechas.</p></div>'}
          </div>
        </div>`
      const fijar = (a, b) => {
        ;[desde, hasta] = a <= b ? [a, b] : [b, a]
        sessionStorage.setItem('inv-hist-desde', desde)
        sessionStorage.setItem('inv-hist-hasta', hasta)
        pintar()
      }
      $$('[data-dia]', v).forEach(
        (b) =>
          (b.onclick = () => {
            const d = b.dataset.dia
            if (varios && primerClic) {
              const a = primerClic
              primerClic = null
              return fijar(a, d)
            }
            if (varios) primerClic = d
            fijar(d, d)
          }),
      )
      $('#varios', v).onchange = (e) => {
        varios = e.target.checked
        primerClic = null
      }
      $('#ant', v).onclick = () => ((mes = new Date(y, m - 1, 1)), pintar())
      $('#sig', v).onclick = () => ((mes = new Date(y, m + 1, 1)), pintar())
      $('#hoy', v).onclick = () => ((mes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)), fijar(hoy(), hoy()))
      $('#h-desde', v).onchange = (e) => e.target.value && fijar(e.target.value, hasta)
      $('#h-hasta', v).onchange = (e) => e.target.value && fijar(desde, e.target.value)
      $('#imp', v).onclick = () =>
        imprimir(`<h1>Historial del inventario</h1><p>${desde === hasta ? fechaLarga(desde) : `${fechaLarga(desde)} a ${fechaLarga(hasta)}`}</p><p class="caja-imp">${resumen}</p>${
          [...grupos.entries()].map(([d, es]) => `<h2>${fechaLarga(d)}</h2><table class="tabla"><tbody>${es.map((e) => `<tr><td>${hora(e.cuando)}</td><td><b>${TIPO[e.tipo]}</b></td><td>${h(e.texto)}</td><td>${e.quien ? h(nombreDe(e.quien)) : ''}</td></tr>`).join('')}</tbody></table>`).join('') || '<p>No pasó nada en estas fechas.</p>'
        }`)
    }
    pintar()
  }

  // ------------------------------------------------------------ catálogo

  async function vistaCatalogo(v) {
    titulo('Catálogo')
    await cargar('catalogo', 'recs')
    let tab = sessionStorage.getItem('inv-cat') || 'proveedores'
    const vig = recepcionesVigentes(recs)
    const pintar = () => {
      const filasProv = proveedores
        .map((p) => {
          const es = vig.filter((r) => r.proveedor_id === p.id)
          const mal = es.filter((r) => incidenciasDe(r).length).length
          return `<tr class="${p.activo ? '' : 'tachado'}"><td><b>${h(p.nombre)}</b>${p.notas ? `<small>${h(p.notas)}</small>` : ''}</td><td>${h(p.contacto || '—')}</td><td>${p.telefono ? `<a href="tel:${h(p.telefono)}">${h(p.telefono)}</a>` : '—'}</td><td>${p.correo ? `<a href="mailto:${h(p.correo)}">${h(p.correo)}</a>` : '—'}</td><td>${es.length}</td><td class="${mal ? 'rojo' : ''}">${es.length ? `${mal} (${Math.round((mal / es.length) * 100)}%)` : '—'}</td><td>${compra() ? `<button class="btn chico" data-ed-prov="${p.id}">Editar</button>` : ''}</td></tr>`
        })
        .join('')
      const filasProd = productos
        .map((p) => `<tr class="${p.activo ? '' : 'tachado'}"><td><b>${h(p.nombre)}</b>${p.notas ? `<small>${h(p.notas)}</small>` : ''}</td><td>${h(p.unidad || '—')}</td><td>${h(proveedores.find((x) => x.id === p.proveedor_id)?.nombre ?? '—')}</td><td>${Number(p.minimo) ? cant(p.minimo) : '—'}</td><td>${compra() ? `<button class="btn chico" data-ed-prod="${p.id}">Editar</button>` : ''}</td></tr>`)
        .join('')
      v.innerHTML = `
        <div class="tabs vidrio"><button class="${tab === 'proveedores' ? 'activa' : ''}" data-t="proveedores">Proveedores <small>${proveedores.length}</small></button><button class="${tab === 'productos' ? 'activa' : ''}" data-t="productos">Productos <small>${productos.length}</small></button></div>
        <p class="nota">Se llena solo: cuando se cierra una recepción con un proveedor o producto nuevo, queda aquí. ${compra() ? 'Pon el <b>mínimo</b> de cada producto para que el sistema avise cuando quede poco.' : ''}</p>
        ${compra() ? `<div class="acciones"><button class="btn primario" id="nuevo">${icono('mas')} ${tab === 'proveedores' ? 'Nuevo proveedor' : 'Nuevo producto'}</button></div>` : ''}
        <div class="tabla-caja vidrio">${
          tab === 'proveedores'
            ? `<table class="tabla"><thead><tr><th>Proveedor</th><th>Contacto</th><th>Teléfono</th><th>Correo</th><th>Entregas</th><th>Con problema</th><th></th></tr></thead><tbody>${filasProv || '<tr><td colspan="7" class="vacio">Sin proveedores.</td></tr>'}</tbody></table>`
            : `<table class="tabla"><thead><tr><th>Producto</th><th>Unidad</th><th>Proveedor</th><th>Mínimo</th><th></th></tr></thead><tbody>${filasProd || '<tr><td colspan="5" class="vacio">Sin productos.</td></tr>'}</tbody></table>`
        }</div>`
      $$('[data-t]', v).forEach((b) => (b.onclick = () => ((tab = b.dataset.t), sessionStorage.setItem('inv-cat', tab), pintar())))
      $('#nuevo', v)?.addEventListener('click', () => (tab === 'proveedores' ? formProveedor() : formProducto()))
      $$('[data-ed-prov]', v).forEach((b) => (b.onclick = () => formProveedor(proveedores.find((p) => p.id === b.dataset.edProv))))
      $$('[data-ed-prod]', v).forEach((b) => (b.onclick = () => formProducto(productos.find((p) => p.id === b.dataset.edProd))))
    }
    const formProveedor = (p = {}) =>
      abrirModal(
        `<h2>${p.id ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
         <form id="f-prov"><div class="campos">
           <label>Nombre<input name="nombre" value="${h(p.nombre ?? '')}" required></label>
           <label>Contacto<input name="contacto" value="${h(p.contacto ?? '')}"></label>
           <label>Teléfono<input name="telefono" type="tel" value="${h(p.telefono ?? '')}"></label>
           <label>Correo<input name="correo" type="email" value="${h(p.correo ?? '')}"></label>
         </div>
         <label>Notas<textarea name="notas" rows="2">${h(p.notas ?? '')}</textarea></label>
         ${p.id ? `<label class="check"><input type="checkbox" name="activo" ${p.activo ? 'checked' : ''}> Activo</label>` : ''}
         <div class="pie">${p.id && esAdmin() ? '<button type="button" class="btn peligro chico" id="borrar">Borrar</button>' : ''}<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Guardar</button></div></form>`,
        (c) => {
          $('#f-prov', c).onsubmit = async (e) => {
            e.preventDefault()
            const f = e.target
            const d = { nombre: f.nombre.value.trim(), contacto: f.contacto.value.trim(), telefono: f.telefono.value.trim(), correo: f.correo.value.trim(), notas: f.notas.value.trim(), ...(p.id ? { id: p.id, activo: f.activo.checked } : {}) }
            if (await intenta(() => D.guardarProveedor(d), 'Guardado')) {
              cerrarModal()
              vistaCatalogo(v)
            }
          }
          $('#borrar', c)?.addEventListener('click', async () => {
            if (!(await confirmar('Borrar proveedor', `Se borra ${h(p.nombre)} del catálogo. Las recepciones conservan su nombre.`, 'Borrar', true))) return
            if ((await intenta(() => D.borrarProveedor(p.id), 'Borrado')) !== undefined) vistaCatalogo(v)
          })
        },
      )
    const formProducto = (p = {}) =>
      abrirModal(
        `<h2>${p.id ? 'Editar producto' : 'Nuevo producto'}</h2>
         <form id="f-prod"><div class="campos">
           <label>Nombre<input name="nombre" value="${h(p.nombre ?? '')}" required></label>
           <label>Unidad<input name="unidad" value="${h(p.unidad ?? '')}" placeholder="costal, lb, caja…"></label>
           <label>Proveedor<select name="proveedor_id"><option value="">—</option>${proveedores.map((x) => `<option value="${x.id}" ${x.id === p.proveedor_id ? 'selected' : ''}>${h(x.nombre)}</option>`).join('')}</select></label>
           <label>Mínimo <small>(avisa si queda menos)</small><input name="minimo" type="number" min="0" step="any" value="${h(p.minimo ?? 0)}"></label>
         </div>
         <label>Notas<textarea name="notas" rows="2">${h(p.notas ?? '')}</textarea></label>
         ${p.id ? `<label class="check"><input type="checkbox" name="activo" ${p.activo ? 'checked' : ''}> Activo</label>` : ''}
         <div class="pie">${p.id && esAdmin() ? '<button type="button" class="btn peligro chico" id="borrar">Borrar</button>' : ''}<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Guardar</button></div></form>`,
        (c) => {
          $('#f-prod', c).onsubmit = async (e) => {
            e.preventDefault()
            const f = e.target
            const d = { nombre: f.nombre.value.trim(), unidad: f.unidad.value.trim(), proveedor_id: f.proveedor_id.value || null, minimo: Number(f.minimo.value || 0), notas: f.notas.value.trim(), ...(p.id ? { id: p.id, activo: f.activo.checked } : {}) }
            if (await intenta(() => D.guardarProducto(d), 'Guardado')) {
              cerrarModal()
              vistaCatalogo(v)
            }
          }
          $('#borrar', c)?.addEventListener('click', async () => {
            if (!(await confirmar('Borrar producto', `Se borra ${h(p.nombre)} del catálogo. Las recepciones conservan su nombre.`, 'Borrar', true))) return
            if ((await intenta(() => D.borrarProducto(p.id), 'Borrado')) !== undefined) vistaCatalogo(v)
          })
        },
      )
    pintar()
  }

  // ------------------------------------------------------------ personas

  async function vistaPersonas(v) {
    titulo('Personas')
    personas = await D.personas()
    v.innerHTML = `
      <div class="acciones"><button class="btn primario" id="alta">${icono('mas')} Dar de alta</button></div>
      <p class="nota">Solo tú (administrador) ves esto. Cada quien entra con su correo y contraseña.</p>
      <div class="tabla-caja vidrio"><table class="tabla"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Cargo</th><th>Acceso</th><th></th></tr></thead><tbody>
        ${personas.map((p) => `<tr class="${p.activo ? '' : 'tachado'}"><td><b>${h(p.nombre || '(sin nombre)')}</b></td><td>${h(p.correo)}</td><td>${ROL[p.rol]}</td><td>${h(p.cargo)}</td><td>${p.activo ? chip('Activo', 'r-completa') : chip('Apagado', 'corregido')}</td><td><button class="btn chico" data-ed="${p.id}">Editar</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="tarjeta vidrio"><h3>Qué puede hacer cada quien</h3><ul class="permisos">
        <li><b>Almacén:</b> recibe mercancía, pide lo que falta, registra salidas y hace correcciones. Ve todo el inventario e historial.</li>
        <li><b>Compras:</b> lo mismo, y marca <b>Orden comprada</b>. Edita el catálogo.</li>
        <li><b>Dueño:</b> todo lo anterior. No borra.</li>
        <li><b>Administrador (tú):</b> todo, y es el único que borra, reabre recepciones cerradas, da de alta personas y ve la bitácora.</li>
      </ul></div>`
    const roles = (sel) => Object.entries(ROL).filter(([k]) => k !== 'admin').map(([k, t]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${t}</option>`).join('')
    $('#alta', v).onclick = () =>
      abrirModal(
        `<h2>Dar de alta</h2><form id="f-alta"><div class="campos">
          <label>Nombre<input name="nombre" required></label><label>Correo<input name="correo" type="email" required></label>
          <label>Rol<select name="rol">${roles('almacen')}</select></label><label>Cargo<input name="cargo" placeholder="ej. Almacén turno mañana"></label>
          <label>Contraseña <small>(8 o más)</small><input name="clave" type="text" minlength="8" required autocomplete="off"></label></div>
          <div class="pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Dar de alta</button></div></form>`,
        (c) =>
          ($('#f-alta', c).onsubmit = async (e) => {
            e.preventDefault()
            const d = Object.fromEntries(new FormData(e.target))
            if (await intenta(() => D.crearPersona(d), `${d.nombre} ya puede entrar`)) {
              cerrarModal()
              vistaPersonas(v)
            }
          }),
      )
    $$('[data-ed]', v).forEach(
      (b) =>
        (b.onclick = () => {
          const p = personas.find((x) => x.id === b.dataset.ed)
          const yoMismo = p.id === yo.id
          abrirModal(
            `<h2>${h(p.nombre || p.correo)}</h2><form id="f-ed"><div class="campos">
              <label>Nombre<input name="nombre" value="${h(p.nombre)}" required></label><label>Cargo<input name="cargo" value="${h(p.cargo)}"></label>
              ${yoMismo ? '' : `<label>Rol<select name="rol">${roles(p.rol)}</select></label>`}</div>
              ${yoMismo ? '' : `<label class="check"><input type="checkbox" name="activo" ${p.activo ? 'checked' : ''}> Puede entrar</label>`}
              <div class="pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Guardar</button></div></form>
              ${yoMismo ? '' : `<form id="f-clave" class="separado"><label>Nueva contraseña<input name="clave" type="text" minlength="8" required autocomplete="off"></label><button class="btn">Cambiar contraseña</button></form>`}`,
            (c) => {
              $('#f-ed', c).onsubmit = async (e) => {
                e.preventDefault()
                const f = e.target
                const d = { id: p.id, nombre: f.nombre.value.trim(), cargo: f.cargo.value.trim(), ...(yoMismo ? {} : { rol: f.rol.value, activo: f.activo.checked }) }
                if (await intenta(() => D.guardarPersona(d), 'Guardado')) {
              cerrarModal()
              vistaPersonas(v)
            }
              }
              $('#f-clave', c)?.addEventListener('submit', async (e) => {
                e.preventDefault()
                if (await intenta(() => D.claveDe(p.id, e.target.clave.value), 'Contraseña cambiada')) cerrarModal()
              })
            },
          )
        }),
    )
  }

  // ------------------------------------------------------------ bitácora

  async function vistaBitacora(v) {
    titulo('Bitácora')
    const b = await D.bitacora()
    const TABLA = { perfiles: 'Persona', proveedores: 'Proveedor', productos: 'Producto', pedidos: 'Pedido', pedido_lineas: 'Producto de pedido', recepciones: 'Recepción', recepcion_lineas: 'Producto de recepción', recepcion_archivos: 'Foto', salidas: 'Salida' }
    const ACC = { insert: 'creó', update: 'cambió', delete: 'borró' }
    const det = (d) => {
      if (!d) return ''
      const s = Object.entries(d)
        .slice(0, 6)
        .map(([k, v]) => (Array.isArray(v) && v.length === 2 ? `${k}: ${JSON.stringify(v[0])} → ${JSON.stringify(v[1])}` : `${k}: ${JSON.stringify(v)}`))
        .join(' · ')
      return s.length > 300 ? `${s.slice(0, 300)}…` : s
    }
    v.innerHTML = `<p class="nota">Cada cambio en la base de datos, con quién y cuándo. Solo tú la ves. Lo borrado queda copiado aquí.</p>
      <div class="tabla-caja vidrio"><table class="tabla"><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Detalle</th></tr></thead><tbody>
      ${b.map((x) => `<tr><td>${fechaHora(x.cuando)}</td><td>${h(x.quien ? nombreDe(x.quien) : 'Sistema')}</td><td>${ACC[x.accion] ?? x.accion} ${TABLA[x.tabla] ?? x.tabla}</td><td><small>${h(det(x.detalle))}</small></td></tr>`).join('') || '<tr><td colspan="4" class="vacio">Nada todavía.</td></tr>'}
      </tbody></table></div>`
  }

  // ------------------------------------------------------------ arranque

  D.alCambiarSesion?.((evento) => {
    if (evento === 'PASSWORD_RECOVERY') {
      abrirModal(
        `<h2>Nueva contraseña</h2><form id="f-nueva"><label>Contraseña nueva<input name="clave" type="password" minlength="8" required></label><div class="pie"><button class="btn primario">Guardar</button></div></form>`,
        (c) =>
          ($('#f-nueva', c).onsubmit = async (e) => {
            e.preventDefault()
            if ((await intenta(() => D.nuevaClave(e.target.clave.value), 'Contraseña cambiada')) !== undefined) cerrarModal()
          }),
      )
    }
  })
  D.sesion()
    .then((p) => (p ? arrancar(p) : pantallaEntrada()))
    .catch((err) => pantallaEntrada(err.message))
}
