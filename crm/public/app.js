// Centro de trabajo Mi Semago · Abuelito: la página.
//
// La página solo enseña y pide. Quién puede ver y tocar qué lo decide la base
// de datos (supabase/esquema.sql); aquí nada más se esconden los botones que a
// cada quien no le tocan. `datos` es datos-supabase.js (el real) o
// datos-muestra.js (la muestra, sin internet).

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const ESTATUS = {
  recibida: 'Recibida',
  'en-proceso': 'En proceso',
  entregada: 'Entregada',
  'en-correccion': 'En corrección',
  aprobada: 'Aprobada',
}
const ESTATUS_CORR = { pedida: 'Pedida', 'en-proceso': 'En proceso', entregada: 'Entregada' }
const COLORES = {
  'abuelito-cheese': '#ffc23d',
  'abuelito-meat': '#ff5c5c',
  'abuelito-corn': '#9be15d',
  'mi-semago': '#4f9bff',
  vayro: '#c08cff',
}
// Para el cliente, "entregada" quiere decir que le toca revisar.
const ESTATUS_CLIENTE = { ...ESTATUS, entregada: 'Lista para revisar', 'en-correccion': 'Corrigiendo' }
const AVANCE = ['Pedida', 'En proceso', 'Para revisar', 'Aprobada']
const pasoDe = (estatus) => ({ recibida: 0, 'en-proceso': 1, 'en-correccion': 1, entregada: 2, aprobada: 3 })[estatus] ?? 0

let nLogo = 0
/** El logo NXUS (N y X con el degradado cian → azul → violeta). */
function logo(clase = 'logo') {
  const id = `nx${++nLogo}`
  return `<svg class="${clase}" viewBox="160 310 950 620" role="img" aria-label="NXUS AI"><defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="177" y1="0" x2="1090" y2="0"><stop offset="0" stop-color="#00e5ff"/><stop offset=".5" stop-color="#0a6cff"/><stop offset="1" stop-color="#a01cff"/></linearGradient></defs><g fill="url(#${id})"><polygon points="177,326 305,326 645,717 558,816 294,497 294,916 177,916"/><polygon points="496,394 663,394 1080,916 928,916"/><polygon points="943,394 1090,394 642,916 484,916"/></g></svg>`
}
const ICONOS = {
  tareas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
  biblioteca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  catalogos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  parrilla: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
  usuarios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/></svg>',
  bitacora: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
}
const CARPETAS_SUGERIDAS = ['Labels', 'Logotipos', 'Diseños', 'Estructuras de label', 'Documentos']

import { desmontarUltron, montarUltron } from './ultron.js'

let D // los datos
let MUESTRA = false
const S = {
  yo: null,
  empresas: [],
  clientes: [],
  tareas: [],
  carpetas: [],
  biblioteca: [],
  catalogos: [],
  contenidos: [],
  usuarios: [],
  parrillaMes: (() => {
    const x = new Date()
    return new Date(x.getFullYear(), x.getMonth(), 1)
  })(),
  parrillaEmpresa: '',
  vista: 'tareas',
  mes: 'pendientes',
  anio: new Date().getFullYear(),
  filtroCliente: '',
  filtroEmpresa: '',
  busca: '',
  bibEmpresa: null,
  bibCarpeta: null,
  bibBusca: '',
  abierta: null,
  contenidoAbierto: null,
  abiertosAnteriores: new Set(),
}

// -- utilidades --------------------------------------------------------------

const $ = (s, r = document) => r.querySelector(s)
const h = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const coincide = (texto, q) => {
  const t = sinAcentos(texto)
  return sinAcentos(q).split(/\s+/).filter(Boolean).every((p) => t.includes(p))
}
const aFecha = (v) => (!v ? null : /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v))
function fecha(v, conHora = false) {
  const d = aFecha(v)
  if (!d) return '—'
  const hoy = new Date()
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {}),
    ...(conHora ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}
function peso(b) {
  if (!b) return ''
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}
const empresa = (id) => S.empresas.find((e) => e.id === id) ?? { id, nombre: id }
const color = (id) => COLORES[id] ?? '#8a8178'
const esEquipo = () => S.yo && (S.yo.rol === 'equipo' || S.yo.rol === 'admin')
const esAdmin = () => S.yo?.rol === 'admin'
const esCliente = () => S.yo?.rol === 'cliente'
const nombreCliente = (id) => S.clientes.find((c) => c.id === id)?.nombre ?? (id === S.yo?.id ? S.yo.nombre : 'Cliente')
const primerNombre = (s) => String(s || '').split(' ')[0]

function avisar(texto, mal = false) {
  const el = document.createElement('div')
  el.className = `aviso${mal ? ' mal' : ''}`
  el.textContent = texto
  $('#avisos').append(el)
  setTimeout(() => el.remove(), mal ? 7000 : 4000)
}
const falla = (err) => avisar(err?.message || String(err), true)

/** Las empresas que veo en una sección, activas y en orden. */
function misEmpresas(seccion) {
  const yo = S.yo
  return S.empresas
    .filter((e) => e.activa)
    .filter((e) => esEquipo() || ((!yo.empresas || yo.empresas.includes(e.id)) && yo[`ve_${seccion}`] !== false))
    .sort((a, b) => a.orden - b.orden)
}
/** [{grupo, empresas}] respetando el orden. */
function agrupar(lista) {
  const out = []
  for (const e of lista) {
    const g = e.grupo || null
    const ultimo = out[out.length - 1]
    if (g && ultimo?.grupo === g) ultimo.empresas.push(e)
    else out.push({ grupo: g, empresas: [e] })
  }
  return out
}
const opcionesEmpresa = (lista, sel = '') =>
  agrupar(lista)
    .map((g) =>
      g.grupo
        ? `<optgroup label="${h(g.grupo)}">${g.empresas.map((e) => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${h(e.nombre)}</option>`).join('')}</optgroup>`
        : g.empresas.map((e) => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${h(e.nombre)}</option>`).join(''),
    )
    .join('')

function elegirArchivos({ multiple = false, accept = '' } = {}) {
  return new Promise((resolve) => {
    const i = document.createElement('input')
    i.type = 'file'
    i.multiple = multiple
    if (accept) i.accept = accept
    i.addEventListener('change', () => resolve([...i.files]))
    i.click()
  })
}

async function ocupado(boton, trabajo) {
  const antes = boton?.innerHTML
  if (boton) {
    boton.disabled = true
    boton.innerHTML = `<span class="giro"></span> ${boton.dataset.ocupado || 'Un momento…'}`
  }
  try {
    return await trabajo()
  } finally {
    if (boton?.isConnected) {
      boton.disabled = false
      boton.innerHTML = antes
    }
  }
}

// -- cargar ------------------------------------------------------------------

async function cargarTodo() {
  const [empresas, tareas, carpetas, biblioteca, catalogos, clientes, contenidos] = await Promise.all([
    D.empresas(),
    S.yo.ve_tareas !== false || esEquipo() ? D.tareas() : [],
    D.carpetas(),
    D.biblioteca(),
    D.catalogos(),
    esEquipo() ? D.clientes() : [],
    D.contenidos ? D.contenidos() : [],
  ])
  Object.assign(S, { empresas, tareas, carpetas, biblioteca, catalogos, clientes, contenidos })
  if (esAdmin()) S.usuarios = await D.usuarios()
}

async function recargar() {
  try {
    await cargarTodo()
    pintar()
    if (S.abierta) abrirTarea(S.abierta)
    else if (S.contenidoAbierto) abrirContenido(S.contenidoAbierto)
  } catch (err) {
    falla(err)
  }
}

// -- entrada -----------------------------------------------------------------

function pintarEntrada(error = '') {
  const app = $('#app')
  if (MUESTRA) {
    app.innerHTML = `
      <div class="entrada"><div class="entrada-caja">
        ${marcaEntrada()}
        <p class="ayuda" style="text-align:center;margin-top:-8px">Esto es una <b>muestra</b> con datos de ejemplo. Elige con quién entrar para ver lo que ve cada quien:</p>
        <div class="muestra-quien">
          ${D.personas()
            .map(
              (p) => `<button class="btn" data-entrar-muestra="${p.id}">${h(p.nombre)}<small>${h(p.explica)}</small></button>`,
            )
            .join('')}
        </div>
        ${firma()}
      </div></div>`
    return
  }
  app.innerHTML = `
    <div class="entrada"><form class="entrada-caja" id="form-entrar">
      ${marcaEntrada()}
      ${error ? `<p class="error">${h(error)}</p>` : ''}
      <div class="campo"><label for="correo">Correo</label><input id="correo" type="email" autocomplete="username" required></div>
      <div class="campo"><label for="clave">Contraseña</label><input id="clave" type="password" autocomplete="current-password" required></div>
      <button class="btn principal grande" style="width:100%" data-ocupado="Entrando…">Entrar</button>
      <p class="ayuda" style="text-align:center;margin-bottom:0">¿Olvidaste tu contraseña? Pídele una nueva a tu administrador.</p>
      ${firma()}
    </form></div>`
  $('#form-entrar').addEventListener('submit', async (e) => {
    e.preventDefault()
    const b = e.submitter
    await ocupado(b, async () => {
      try {
        S.yo = await D.entrar($('#correo').value.trim(), $('#clave').value)
        await empezar()
      } catch (err) {
        pintarEntrada(err.message || 'No se pudo entrar')
      }
    })
  })
}
const marcaEntrada = () => `
  <div class="entrada-marca">${logo()}<b>MI SEMAGO · ABUELITO</b><span>Centro de trabajo</span></div>`
const firma = () => `<div class="firma">${logo()}<span>Hecho por NXUS AI</span></div>`

async function empezar() {
  $('#app').innerHTML = '<div class="cargando">Cargando…</div>'
  await cargarTodo()
  const vistas = vistasPermitidas()
  if (!vistas.includes(S.vista)) S.vista = vistas[0] ?? 'tareas'
  pintar()
  // Ultron, solo para la dirección (y el admin), cuando el sistema lo tiene.
  if (D.ultron && (S.yo.ultron || esAdmin())) {
    montarUltron({
      yo: S.yo,
      preguntar: (t) => D.ultron(t, 'crm'),
      avisar,
      muestra: MUESTRA,
      consola: () => (MUESTRA ? avisar('En el sistema real, la consola de Ultron se abre en otra pestaña.') : window.open('/ultron', '_blank')),
      // Lo que Ultron propone solo pasa si la persona toca el botón, y con sus
      // mismos permisos (nada que ella no pudiera hacer sola).
      accion: async (a) => {
        if (a.archivo) {
          const arch = todosLosArchivos().find((x) => x.id === a.archivo)
          if (!arch) return 'Ese archivo ya no está.'
          if (a.ver) {
            verArchivo(arch.id, false)
            return ''
          }
          const r = await D.correo(arch)
          return `Listo, te lo envié a ${r.para}.`
        }
        if (a.crear) {
          const t = await D.pedir({ cliente_id: S.yo.id, empresa_id: a.crear.empresa_id, titulo: a.crear.titulo, descripcion: `${a.crear.detalles || a.crear.titulo}\n\n(Pedida con Ultron)`, urgente: Boolean(a.crear.urgente), archivos: [] })
          await recargar()
          return `Registrada: tarea **#${t.folio}**. Ya la ve tu equipo; si quieres agrégale detalles o archivos desde la tarea.`
        }
        if (a.nota) {
          const t = S.tareas.find((x) => x.id === a.nota.tarea_id)
          await D.agregarNota(t, a.nota.texto, [])
          await recargar()
          return `Agregado a la #${t.folio}, con fecha.`
        }
        return ''
      },
    })
  } else desmontarUltron()
}

function vistasPermitidas() {
  const v = []
  if (esEquipo() || S.yo.ve_tareas !== false) v.push('tareas')
  // La parrilla la ven todos; solo el equipo la cambia.
  v.push('parrilla')
  if (esEquipo() || S.yo.ve_biblioteca !== false) v.push('biblioteca')
  if (esEquipo() || S.yo.ve_catalogos !== false) v.push('catalogos')
  if (esAdmin()) v.push('usuarios', 'bitacora')
  return v
}

// -- marco -------------------------------------------------------------------

const NOMBRES_VISTA = { tareas: 'Tareas', parrilla: 'Parrilla', biblioteca: 'Biblioteca', catalogos: 'Catálogos', usuarios: 'Usuarios', bitacora: 'Bitácora' }
const ROLES = { admin: 'Administrador', equipo: 'Equipo', cliente: 'Cliente' }

function pintar() {
  const app = $('#app')
  app.innerHTML = `
    <header class="cabeza">
      ${MUESTRA ? `<div class="franja-muestra">Muestra con datos de ejemplo · nada se guarda de verdad <button class="btn chico" data-accion="cambiar-muestra">Cambiar de persona</button></div>` : ''}
      <div class="cabeza-fila">
        <div class="marca">${logo()}<div><b>MI SEMAGO · ABUELITO</b><span>Centro de trabajo · NXUS AI</span></div></div>
        <div class="quien"><b>${h(S.yo.nombre)}</b><span>${ROLES[S.yo.rol]}</span></div>
        <button class="btn chico" data-accion="salir">Salir</button>
      </div>
      <nav class="pestanas">
        ${vistasPermitidas()
          .map((v) => `<button class="pestana ${S.vista === v ? 'activa' : ''}" data-vista="${v}">${ICONOS[v]}${NOMBRES_VISTA[v]}</button>`)
          .join('')}
      </nav>
    </header>
    <main id="vista"></main>`
  pintarVista()
}

function pintarVista() {
  const el = $('#vista')
  if (!el) return
  const v = {
    tareas: vistaTareas,
    parrilla: vistaParrilla,
    biblioteca: vistaBiblioteca,
    catalogos: vistaCatalogos,
    usuarios: vistaUsuarios,
    bitacora: vistaBitacora,
  }[S.vista]
  el.innerHTML = v ? v() : ''
  if (S.vista === 'bitacora') cargarBitacora()
}

// -- tareas ------------------------------------------------------------------

function textoTarea(t) {
  return [
    `#${t.folio}`,
    t.titulo,
    t.descripcion,
    empresa(t.empresa_id).nombre,
    ESTATUS[t.estatus],
    nombreCliente(t.cliente_id),
    ...t.correcciones.map((c) => c.instrucciones),
    ...t.archivos.map((a) => a.nombre),
    ...(t.notas ?? []).map((n) => n.texto),
  ].join(' ')
}

function tareasFiltradas() {
  let l = S.tareas
  if (S.filtroCliente) l = l.filter((t) => t.cliente_id === S.filtroCliente)
  if (S.filtroEmpresa) l = l.filter((t) => t.empresa_id === S.filtroEmpresa)
  return l
}

function vistaTareas() {
  const base = tareasFiltradas()
  const busca = S.busca.trim()
  let lista
  let titulo
  if (busca) {
    lista = base.filter((t) => coincide(textoTarea(t), busca)).sort((a, b) => aFecha(b.pedida) - aFecha(a.pedida))
    titulo = `Resultados de “${h(busca)}” en todos los meses`
  } else if (S.mes === 'pendientes') {
    lista = base.filter((t) => t.estatus !== 'aprobada').sort((a, b) => Number(b.urgente) - Number(a.urgente) || aFecha(a.pedida) - aFecha(b.pedida))
    titulo = 'Todo lo que no se ha aprobado, de cualquier mes'
  } else {
    lista = base
      .filter((t) => {
        const d = aFecha(t.pedida)
        return d.getFullYear() === S.anio && d.getMonth() === S.mes
      })
      .sort((a, b) => aFecha(b.pedida) - aFecha(a.pedida))
    titulo = `Pedidas en ${MESES_LARGOS[S.mes]} ${S.anio}`
  }
  const pendientes = base.filter((t) => t.estatus !== 'aprobada').length
  const anios = [...new Set([new Date().getFullYear(), ...S.tareas.map((t) => aFecha(t.pedida).getFullYear())])].sort((a, b) => b - a)
  const porMes = MESES.map((_, m) => base.filter((t) => { const d = aFecha(t.pedida); return d.getFullYear() === S.anio && d.getMonth() === m }).length)
  const empresasTareas = misEmpresas('tareas')
  return `
    ${saludo(base)}
    <div class="barra">
      ${esCliente() ? `<button class="btn principal" data-accion="nueva-tarea">+ Nueva tarea</button>` : `<button class="btn principal" data-accion="nueva-tarea">+ Registrar tarea de un cliente</button>`}
      <input class="crece" type="search" placeholder="Buscar tarea, producto, folio…" value="${h(S.busca)}" data-filtro="busca" aria-label="Buscar">
      ${esEquipo() ? `<select data-filtro="filtroCliente" aria-label="Cliente"><option value="">Todos los clientes</option>${S.clientes.map((c) => `<option value="${c.id}" ${S.filtroCliente === c.id ? 'selected' : ''}>${h(c.nombre)}</option>`).join('')}</select>` : ''}
      ${empresasTareas.length > 1 ? `<select data-filtro="filtroEmpresa" aria-label="Empresa"><option value="">Todas las empresas</option>${opcionesEmpresa(empresasTareas, S.filtroEmpresa)}</select>` : ''}
    </div>
    <div class="meses" role="tablist">
      <button class="mes pend ${S.mes === 'pendientes' && !busca ? 'activo' : ''}" data-mes="pendientes">Pendientes<small>${pendientes}</small></button>
      <select data-filtro="anio" aria-label="Año" style="width:auto;border-radius:999px;min-height:34px;padding:4px 10px">${anios.map((a) => `<option ${a === S.anio ? 'selected' : ''}>${a}</option>`).join('')}</select>
      ${MESES.map((m, i) => `<button class="mes ${S.mes === i && !busca ? 'activo' : ''} ${porMes[i] ? '' : 'vacio'}" data-mes="${i}">${m}${porMes[i] ? `<small>${porMes[i]}</small>` : ''}</button>`).join('')}
    </div>
    <p class="ayuda" style="margin:0 0 10px">${titulo}</p>
    <div class="lista">
      ${lista.length ? lista.map(tarjetaTarea).join('') : `<div class="vacio-msg">${busca ? '<b>Nada por aquí 🔎</b>Prueba con otra palabra: el producto, la empresa o el número de folio.' : S.mes === 'pendientes' ? '<b>¡Todo al día! 🎉</b>No hay tareas pendientes.' : '<b>Mes tranquilo</b>No hay tareas pedidas en este mes.'}</div>`}
    </div>`
}

const textoEstatus = (s) => (esCliente() ? ESTATUS_CLIENTE : ESTATUS)[s]

function saludo(base) {
  const hoy = new Date()
  const revisar = base.filter((t) => t.estatus === 'entregada').length
  const proceso = base.filter((t) => ['recibida', 'en-proceso', 'en-correccion'].includes(t.estatus)).length
  const pend = base.filter((t) => t.estatus !== 'aprobada').length
  const aprobadasMes = base.filter((t) => t.aprobada && aFecha(t.aprobada).getMonth() === hoy.getMonth() && aFecha(t.aprobada).getFullYear() === hoy.getFullYear()).length
  const hora = hoy.getHours()
  const hola = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const frase = esCliente()
    ? revisar
      ? `Tienes ${revisar} ${revisar === 1 ? 'trabajo listo' : 'trabajos listos'} para revisar ✨`
      : pend
        ? 'Tu equipo está trabajando en lo tuyo.'
        : 'Todo al día. Pide lo que necesites con “+ Nueva tarea”.'
    : proceso
      ? `Hay ${proceso} ${proceso === 1 ? 'tarea' : 'tareas'} por trabajar.`
      : 'No hay nada pendiente. ¡Bien hecho!'
  let mostrarPasos = esCliente()
  try {
    if (localStorage.getItem('ct-pasos') === 'no') mostrarPasos = false
  } catch {}
  return `
    <div class="hola"><div><h1>${hola}, <span class="grad">${h(primerNombre(S.yo.nombre))}</span></h1><p>${frase}</p></div></div>
    <div class="resumen">
      <button class="dato d-pend" data-mes="pendientes"><b>${pend}</b><span>Pendientes</span></button>
      <button class="dato d-proceso" data-mes="pendientes"><b>${proceso}</b><span>${esCliente() ? 'En manos del equipo' : 'Por trabajar'}</span></button>
      <button class="dato d-revisar ${revisar && esCliente() ? 'llama' : ''}" data-mes="pendientes"><b>${revisar}</b><span>${esCliente() ? 'Listas para revisar' : 'Esperando al cliente'}</span></button>
      <button class="dato d-ok" data-mes="${hoy.getMonth()}"><b>${aprobadasMes}</b><span>Aprobadas este mes</span></button>
    </div>
    ${
      mostrarPasos
        ? `<div class="pasos">
            <button class="btn chico fantasma pasos-cerrar" data-accion="cerrar-pasos" aria-label="Ocultar">×</button>
            <div class="paso"><i>1</i><b>Pides</b><span>Con “+ Nueva tarea”</span></div>
            <div class="paso"><i>2</i><b>Trabajamos</b><span>Ves el avance aquí</span></div>
            <div class="paso"><i>3</i><b>Revisas</b><span>Descargas o pides corrección</span></div>
            <div class="paso"><i>4</i><b>Apruebas</b><span>Y queda guardado</span></div>
          </div>`
        : ''
    }`
}

function avance(estatus) {
  const p = pasoDe(estatus)
  return `<div class="avance ${estatus === 'aprobada' ? 'fin' : ''}" aria-label="Avance: ${AVANCE[p]}">${AVANCE.map((n, i) => `<div class="${i < p ? 'hecho' : i === p ? 'aqui' : ''}"><i></i>${n}</div>`).join('')}</div>`
}

function tarjetaTarea(t) {
  const e = empresa(t.empresa_id)
  const nCorr = t.correcciones.length
  return `
    <button class="tarjeta ${esCliente() && t.estatus === 'entregada' ? 'revisar' : ''}" style="--color-emp:${color(t.empresa_id)}" data-tarea="${t.id}">
      <div class="tarjeta-fila"><div>
      <div class="tarjeta-titulo"><span class="folio">#${t.folio}</span>${h(t.titulo)}</div>
      <div class="chips">
        <span class="chip emp">${h(e.nombre)}</span>
        <span class="chip est-${t.estatus}">${textoEstatus(t.estatus)}</span>
        ${t.urgente ? '<span class="chip urgente">Urgente</span>' : ''}
        ${(t.notas ?? []).length ? `<span class="chip nuevo">${t.notas.length} ${t.notas.length === 1 ? 'actualización' : 'actualizaciones'}</span>` : ''}
        ${esEquipo() ? `<span class="chip">${h(nombreCliente(t.cliente_id))}</span>` : ''}
      </div></div>${avance(t.estatus)}</div>
      <div class="tarjeta-meta">
        <span>Pedida ${fecha(t.pedida)}</span>
        ${t.compromiso && !t.entregada ? `<span>Compromiso ${fecha(t.compromiso)}</span>` : ''}
        ${t.entregada ? `<span>Última entrega ${fecha(t.entregada)}</span>` : ''}
        ${nCorr ? `<span>${nCorr} ${nCorr === 1 ? 'corrección' : 'correcciones'}</span>` : ''}
        ${t.aprobada ? `<span>Aprobada ${fecha(t.aprobada)}</span>` : ''}
      </div>
    </button>`
}

function formNuevaTarea() {
  const emps = misEmpresas('tareas')
  abrirVentana(
    esCliente() ? 'Nueva tarea' : 'Registrar tarea de un cliente',
    `<form id="form-tarea">
      ${esEquipo() ? `<div class="campo"><label for="t-cliente">¿De quién es?</label><select id="t-cliente" required>${S.clientes.map((c) => `<option value="${c.id}">${h(c.nombre)}</option>`).join('')}</select><span class="ayuda">Solo esa persona la verá (y el equipo).</span></div>` : ''}
      <div class="campo"><label for="t-empresa">¿Para qué empresa?</label><select id="t-empresa" required><option value="">Elige…</option>${opcionesEmpresa(emps)}</select></div>
      <div class="campo"><label for="t-titulo">¿Qué necesitas? (en pocas palabras)</label><input id="t-titulo" type="text" maxlength="200" required placeholder="Ej. Label de pupusas de frijol 12 oz"></div>
      <div class="campo"><label for="t-desc">Detalles</label><textarea id="t-desc" maxlength="5000" placeholder="Medidas, colores, textos, para cuándo lo necesitas…"></textarea></div>
      <label class="casilla"><input id="t-urgente" type="checkbox"> Es urgente</label>
      <div class="campo"><span class="etiqueta">Archivos de referencia (opcional)</span>
        <button type="button" class="btn" data-accion="elegir-refs">📎 Adjuntar fotos o archivos</button>
        <div id="refs-elegidas" class="ayuda"></div>
      </div>
      <p class="ayuda">La fecha en que la pides se guarda sola. ${esCliente() ? 'Lo que escribas aquí nadie lo puede cambiar.' : ''}</p>
      <button class="btn principal grande" style="width:100%" data-ocupado="Enviando…">${esCliente() ? 'Pedir tarea' : 'Registrar'}</button>
    </form>`,
    { chica: true },
  )
  let refs = []
  $('[data-accion="elegir-refs"]').addEventListener('click', async () => {
    refs = [...refs, ...(await elegirArchivos({ multiple: true }))]
    $('#refs-elegidas').textContent = refs.map((f) => f.name).join(', ')
  })
  $('#form-tarea').addEventListener('submit', async (e) => {
    e.preventDefault()
    await ocupado(e.submitter, async () => {
      try {
        const t = await D.pedir({
          cliente_id: esEquipo() ? $('#t-cliente').value : S.yo.id,
          empresa_id: $('#t-empresa').value,
          titulo: $('#t-titulo').value.trim(),
          descripcion: $('#t-desc').value.trim(),
          urgente: $('#t-urgente').checked,
          archivos: refs,
        })
        cerrarVentana()
        avisar(`Listo: tarea #${t.folio} registrada`)
        S.mes = 'pendientes'
        S.busca = ''
        await recargar()
      } catch (err) {
        falla(err)
      }
    })
  })
}

// -- detalle de una tarea -----------------------------------------------------

function filaArchivo(a, { borrar = false, guardarBib = false, anteriores = null } = {}) {
  const ext = (a.nombre.split('.').pop() || '').toLowerCase()
  const tipo = ext === 'pdf' ? '' : /^(png|jpe?g|gif|webp|svg|heic)$/.test(ext) ? 'img' : 'otro'
  const n = anteriores ? anteriores.length + 1 : 0
  return `
    <div class="archivo">
      <div class="archivo-icono ${tipo}">${h(ext.slice(0, 4).toUpperCase() || 'ARCH')}</div>
      <div class="archivo-nombre"><b>${h(a.nombre)}${n > 1 ? `<span class="version">v${n}</span>` : ''}</b><span>Subido ${fecha(a.subido, true)}${a.tamano ? ` · ${peso(a.tamano)}` : ''}${a.notas ? ` · ${h(a.notas)}` : ''}</span></div>
      <div class="archivo-acciones">
        <button class="btn chico" data-ver="${a.id}">Ver</button>
        <button class="btn chico" data-bajar="${a.id}">⬇️ Descargar</button>
        <button class="btn chico" data-correo="${a.id}">✉️ A mi correo</button>
        ${guardarBib ? `<button class="btn chico" data-a-biblioteca="${a.id}">📚 A Biblioteca</button>` : ''}
        ${borrar && esAdmin() ? `<button class="btn chico peligro" data-borrar-archivo="${a.id}" title="Borrar">🗑</button>` : ''}
      </div>
    </div>`
}

function abrirTarea(id) {
  const t = S.tareas.find((x) => x.id === id)
  if (!t) {
    cerrarVentana()
    return
  }
  S.abierta = id
  const e = empresa(t.empresa_id)
  const mia = t.cliente_id === S.yo.id
  const quien = esEquipo() ? nombreCliente(t.cliente_id) : 'ti'
  const refs = t.archivos.filter((a) => a.tipo === 'referencia' && !a.nota_id)
  const notas = [...(t.notas ?? [])].sort((a, b) => aFecha(a.creada) - aFecha(b.creada))
  const puedeAgregar = t.estatus !== 'aprobada' && ((esCliente() && mia) || esEquipo())
  const autor = (id) => (id === t.cliente_id ? (esCliente() ? 'Tú' : primerNombre(nombreCliente(id))) : id === S.yo.id ? 'Tú' : 'Equipo')
  const entregas = t.archivos.filter((a) => a.tipo === 'entrega' && !a.correccion_id)
  const correcciones = [...t.correcciones].sort((a, b) => a.n - b.n)
  const abierta = t.estatus !== 'aprobada'
  const entregado = Boolean(t.entregada)
  const ultimo = [...t.archivos.filter((a) => a.tipo === 'entrega')].sort((a, b) => aFecha(b.subido) - aFecha(a.subido))[0]

  const cuerpo = `
    <div class="chips" style="margin:0 0 12px">
      <span class="chip emp" style="--color-emp:${color(t.empresa_id)}">${h(e.grupo ? `${e.grupo} · ` : '')}${h(e.nombre)}</span>
      <span class="chip est-${t.estatus}">${textoEstatus(t.estatus)}</span>
      ${t.urgente ? '<span class="chip urgente">Urgente</span>' : ''}
      ${esEquipo() ? `<span class="chip">Cliente: ${h(nombreCliente(t.cliente_id))}</span>` : ''}
    </div>
    <div class="seccion" style="padding:16px 10px 12px">${avance(t.estatus)}</div>
    <div class="fechas" style="margin-bottom:12px">
      <div class="fecha-caja auto"><span>Pedida</span><b>${fecha(t.pedida, true)}</b></div>
      <div class="fecha-caja"><span>Compromiso</span><b>${fecha(t.compromiso)}</b></div>
      <div class="fecha-caja auto"><span>Última entrega</span><b>${fecha(t.entregada, true)}</b></div>
      <div class="fecha-caja auto"><span>Aprobada</span><b>${fecha(t.aprobada, true)}</b></div>
    </div>
    <p class="ayuda" style="margin:-4px 0 12px">⚙︎ = la fecha se pone sola.</p>

    <div class="seccion">
      <h3>${esEquipo() ? `Lo que pidió ${h(primerNombre(quien))}` : 'Tu pedido'} <span class="candado">🔒 Escrito por ${esEquipo() ? h(primerNombre(quien)) : 'ti'}. Nadie lo puede cambiar; los cambios se agregan abajo.</span></h3>
      <div class="texto-cliente">${h(t.descripcion || t.titulo)}</div>
      ${refs.length ? `<div class="etiqueta" style="margin:10px 0 6px">Archivos de referencia</div><div class="archivos">${refs.map((a) => filaArchivo(a, { borrar: true })).join('')}</div>` : ''}
      ${notas
        .map(
          (n, i) => `<div class="nota">
            <div class="nota-cabeza"><span><b>Actualización ${i + 1}</b> · ${fecha(n.creada, true)} · ${h(autor(n.autor))}</span>${esAdmin() ? `<button class="btn chico peligro" data-borrar-nota="${n.id}" title="Borrar actualización">🗑</button>` : ''}</div>
            ${n.texto ? `<div style="white-space:pre-wrap">${h(n.texto)}</div>` : ''}
            ${t.archivos.some((a) => a.nota_id === n.id) ? `<div class="archivos" style="margin-top:8px">${t.archivos.filter((a) => a.nota_id === n.id).map((a) => filaArchivo(a, { borrar: true })).join('')}</div>` : ''}
          </div>`,
        )
        .join('')}
      ${
        puedeAgregar
          ? `<button class="btn" style="margin-top:12px" data-accion="abrir-nota">+ ${esCliente() ? 'Agregar instrucciones o archivos' : 'Registrar instrucción del cliente'}</button>
            <form id="form-nota" hidden style="margin-top:12px">
              <div class="campo"><label for="n-texto">${esCliente() ? '¿Qué cambió? Lo de arriba no se borra: esto se agrega con fecha.' : 'Lo que pidió el cliente por otro lado (WhatsApp, llamada…)'}</label><textarea id="n-texto" maxlength="5000" placeholder="Ej. Mejor en color rojo y con el logo más grande"></textarea></div>
              <div class="barra"><button type="button" class="btn" data-accion="elegir-nota-archivos">📎 Adjuntar PDF o fotos</button><span id="nota-archivos" class="ayuda"></span></div>
              <button class="btn principal" data-ocupado="Guardando…">Agregar</button>
            </form>`
          : ''
      }
    </div>

    <div class="seccion">
      <h3>Trabajo del equipo ${esCliente() ? '<span class="candado">🔒 Lo actualiza el equipo</span>' : ''}</h3>
      ${
        esEquipo() && abierta
          ? `<div class="dos">
              <div class="campo"><label for="d-estatus">Estatus</label><select id="d-estatus" data-cambiar-tarea="estatus">${['recibida', 'en-proceso', 'entregada', 'en-correccion'].map((s) => `<option value="${s}" ${t.estatus === s ? 'selected' : ''}>${ESTATUS[s]}</option>`).join('')}</select></div>
              <div class="campo"><label for="d-compromiso">Fecha compromiso</label><input id="d-compromiso" type="date" value="${h(t.compromiso || '')}" data-cambiar-tarea="compromiso"></div>
            </div>
            <p class="ayuda" style="margin-top:0">La fecha de entrega se pone sola al subir el PDF final.</p>`
          : ''
      }
      <div class="etiqueta" style="margin:4px 0 6px">Entrega</div>
      <div class="archivos">${entregas.length ? entregas.map((a) => filaArchivo(a, { borrar: true, guardarBib: esEquipo() })).join('') : '<p class="ayuda" style="margin:0">Todavía no se sube el trabajo.</p>'}</div>
      ${esEquipo() && abierta ? `<button class="btn principal" style="margin-top:10px" data-subir-entrega="" data-ocupado="Subiendo…">⬆️ Subir PDF final</button>` : ''}
    </div>

    ${correcciones
      .map((c) => {
        const archivos = t.archivos.filter((a) => a.correccion_id === c.id)
        return `
        <div class="seccion correccion ${c.estatus === 'entregada' ? 'lista-c' : ''}">
          <h3>Corrección ${c.n} ${esAdmin() ? `<button class="btn chico peligro" style="margin-left:auto" data-borrar-correccion="${c.id}" title="Borrar corrección">🗑</button>` : ''}<span class="chip est-${c.estatus === 'entregada' ? 'entregada' : c.estatus === 'en-proceso' ? 'en-proceso' : 'pedida'}">${ESTATUS_CORR[c.estatus]}</span></h3>
          <div class="fechas" style="grid-template-columns:1fr 1fr;margin-bottom:10px">
            <div class="fecha-caja auto"><span>Pedida</span><b>${fecha(c.pedida, true)}</b></div>
            <div class="fecha-caja auto"><span>PDF subido</span><b>${fecha(c.entregada, true)}</b></div>
          </div>
          <div class="etiqueta" style="margin-bottom:4px">Instrucciones <span class="candado">🔒 nadie las puede cambiar</span></div>
          <div class="texto-cliente">${h(c.instrucciones)}</div>
          ${esEquipo() && abierta ? `<div class="campo" style="margin-top:10px;max-width:260px"><label>Estatus de la corrección</label><select data-cambiar-correccion="${c.id}">${Object.entries(ESTATUS_CORR).map(([k, v]) => `<option value="${k}" ${c.estatus === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>` : ''}
          <div class="archivos" style="margin-top:10px">${archivos.map((a) => filaArchivo(a, { borrar: true, guardarBib: esEquipo() })).join('')}</div>
          ${esEquipo() && abierta ? `<button class="btn principal" style="margin-top:10px" data-subir-entrega="${c.id}" data-ocupado="Subiendo…">⬆️ Subir PDF corregido</button>` : ''}
        </div>`
      })
      .join('')}

    ${
      esCliente() && mia && abierta && entregado
        ? `<div class="seccion" id="caja-correccion">
            <h3>¿Algo no te gustó?</h3>
            <button class="btn" data-accion="abrir-correccion">+ Agregar corrección</button>
            <form id="form-correccion" hidden>
              <div class="campo" style="margin-top:10px"><label for="c-texto">Instrucciones de la corrección ${correcciones.length + 1}</label><textarea id="c-texto" maxlength="5000" required placeholder="Qué hay que cambiar…"></textarea></div>
              <button class="btn principal" data-ocupado="Enviando…">Enviar corrección</button>
            </form>
          </div>
          <div class="seccion aprobar-caja">
            <p>Si ya quedó como lo querías, apruébala. La tarea se cierra y queda guardada.</p>
            <button class="btn ok grande" data-accion="aprobar" data-ocupado="Aprobando…">✅ Aprobado</button>
          </div>`
        : ''
    }
    ${esCliente() && abierta && !entregado ? `<p class="ayuda" style="text-align:center">Cuando el equipo suba el trabajo, aquí podrás descargarlo, pedir correcciones o aprobarlo.</p>` : ''}
    ${esAdmin() ? `<div class="seccion solo-admin"><h3>Solo tú (admin)</h3><p class="ayuda" style="margin-top:0">Borrar quita la tarea con todas sus entregas, correcciones y actualizaciones. No se puede deshacer.</p><button class="btn peligro" data-accion="borrar-tarea">🗑 Borrar esta tarea</button></div>` : ''}
    ${t.estatus === 'aprobada' ? `<div class="seccion aprobada-caja">✅ Aprobada el ${fecha(t.aprobada, true)}. Tarea concluida.${ultimo && esEquipo() ? `<div style="margin-top:10px"><button class="btn chico" data-a-biblioteca="${ultimo.id}">📚 Guardar el PDF final en la Biblioteca</button></div>` : ''}</div>` : ''}
  `
  abrirVentana(`<span class="folio">#${t.folio}</span> ${h(t.titulo)}`, cuerpo, { html: true, alCerrar: () => (S.abierta = null) })

  let notaArchivos = []
  $('[data-accion="elegir-nota-archivos"]')?.addEventListener('click', async () => {
    notaArchivos = [...notaArchivos, ...(await elegirArchivos({ multiple: true, accept: 'application/pdf,image/*' }))]
    $('#nota-archivos').textContent = notaArchivos.map((f) => f.name).join(', ')
  })
  $('#form-nota')?.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    await ocupado(ev.submitter, async () => {
      try {
        await D.agregarNota(t, $('#n-texto').value.trim(), notaArchivos)
        avisar('Agregado. Queda guardado con fecha.')
        await recargar()
      } catch (err) {
        falla(err)
      }
    })
  })
  $('#form-correccion')?.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    await ocupado(ev.submitter, async () => {
      try {
        await D.corregir(t.id, $('#c-texto').value.trim())
        avisar('Corrección enviada al equipo')
        await recargar()
      } catch (err) {
        falla(err)
      }
    })
  })
}

// -- biblioteca ---------------------------------------------------------------

/** Los archivos vigentes y, para cada uno, sus versiones anteriores (de la más nueva a la más vieja). */
function conVersiones(lista) {
  const porId = new Map(lista.map((a) => [a.id, a]))
  return lista
    .filter((a) => a.vigente)
    .map((a) => {
      const anteriores = []
      let p = a.anterior_id && porId.get(a.anterior_id)
      while (p && anteriores.length < 50) {
        anteriores.push(p)
        p = p.anterior_id && porId.get(p.anterior_id)
      }
      return { a, anteriores }
    })
}

function rutaCarpeta(id) {
  const out = []
  let c = S.carpetas.find((x) => x.id === id)
  while (c && out.length < 20) {
    out.unshift(c)
    c = S.carpetas.find((x) => x.id === c.padre_id)
  }
  return out
}

function bloqueArchivo({ a, anteriores }, opciones = {}) {
  const abierto = S.abiertosAnteriores.has(a.id)
  return `
    <div>
      ${filaArchivo(a, { borrar: true, anteriores, ...opciones })}
      ${esEquipo() ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 0 46px">
          <button class="btn chico fantasma" data-nueva-version="${a.id}" data-ocupado="Subiendo…">⬆️ Nueva versión</button>
          ${a.tipo === 'biblioteca' ? `<button class="btn chico fantasma" data-editar-archivo="${a.id}">✏️ Renombrar / mover</button>` : ''}
        </div>` : ''}
      ${anteriores.length ? `<button class="btn chico fantasma" style="margin-left:46px" data-anteriores="${a.id}">${abierto ? '▾' : '▸'} Versiones anteriores (${anteriores.length})</button>` : ''}
      ${anteriores.length && abierto ? `<div class="anteriores">${anteriores.map((v, i) => filaArchivo(v, { borrar: true }).replace('</b>', `<span class="version" style="background:var(--gris-fondo);color:var(--suave)">v${anteriores.length - i}</span></b>`)).join('')}</div>` : ''}
    </div>`
}

function vistaBiblioteca() {
  const emps = misEmpresas('biblioteca')
  if (!emps.length) return '<div class="vacio-msg">No tienes empresas en la biblioteca.</div>'
  if (!S.bibEmpresa || !emps.some((e) => e.id === S.bibEmpresa)) S.bibEmpresa = emps[0].id
  const emp = empresa(S.bibEmpresa)
  const arbol = agrupar(emps)
    .map(
      (g) =>
        (g.grupo ? `<div class="arbol-grupo">${h(g.grupo)}</div>` : '') +
        g.empresas
          .map(
            (e) =>
              `<button class="arbol-emp ${g.grupo ? 'sub' : ''} ${e.id === S.bibEmpresa ? 'activa' : ''}" style="--color-emp:${color(e.id)}" data-bib-empresa="${e.id}"><span class="punto"></span>${h(g.grupo ? e.nombre.replace(/^Abuelito\s+/, '') : e.nombre)}</button>`,
          )
          .join(''),
    )
    .join('')

  const busca = S.bibBusca.trim()
  let contenido
  if (busca) {
    const visibles = new Set(emps.map((e) => e.id))
    const hallados = conVersiones(S.biblioteca.filter((a) => visibles.has(a.empresa_id))).filter(({ a }) =>
      coincide(`${a.nombre} ${a.notas} ${empresa(a.empresa_id).nombre} ${empresa(a.empresa_id).grupo ?? ''} ${rutaCarpeta(a.carpeta_id).map((c) => c.nombre).join(' ')}`, busca),
    )
    const carpetasHalladas = S.carpetas.filter((c) => visibles.has(c.empresa_id) && coincide(c.nombre, busca))
    contenido = `
      <p class="ayuda">Resultados de “${h(busca)}” en todas las empresas</p>
      ${carpetasHalladas.length ? `<div class="carpetas">${carpetasHalladas.map((c) => tarjetaCarpeta(c, true)).join('')}</div>` : ''}
      <div class="archivos">${hallados.length ? hallados.map((x) => `<div><div class="ayuda" style="margin:6px 0 2px">${h(empresa(x.a.empresa_id).nombre)} / ${rutaCarpeta(x.a.carpeta_id).map((c) => h(c.nombre)).join(' / ') || 'Inicio'}</div>${bloqueArchivo(x)}</div>`).join('') : carpetasHalladas.length ? '' : '<div class="vacio-msg">No encontré nada con ese nombre. Prueba con otra palabra (por ejemplo, el producto o la empresa).</div>'}</div>`
  } else {
    const hijos = S.carpetas.filter((c) => c.empresa_id === S.bibEmpresa && (c.padre_id ?? null) === (S.bibCarpeta ?? null)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    const archivos = conVersiones(S.biblioteca.filter((a) => a.empresa_id === S.bibEmpresa && (a.carpeta_id ?? null) === (S.bibCarpeta ?? null))).sort((x, y) => x.a.nombre.localeCompare(y.a.nombre, 'es'))
    const ruta = rutaCarpeta(S.bibCarpeta)
    contenido = `
      <div class="ruta">
        <button data-bib-carpeta="">${h(emp.nombre)}</button>
        ${ruta.map((c, i) => `<span>/</span>${i === ruta.length - 1 ? `<b>${h(c.nombre)}</b>` : `<button data-bib-carpeta="${c.id}">${h(c.nombre)}</button>`}`).join('')}
      </div>
      ${esEquipo() ? `<div class="barra">
          <button class="btn principal" data-accion="subir-biblioteca" data-ocupado="Subiendo…">⬆️ Subir archivos</button>
          <button class="btn" data-accion="nueva-carpeta">+ Carpeta</button>
          ${S.bibCarpeta ? `<button class="btn" data-accion="renombrar-carpeta">✏️ Renombrar carpeta</button>${esAdmin() ? '<button class="btn peligro" data-accion="borrar-carpeta">Borrar carpeta</button>' : ''}` : ''}
        </div>
        <div class="soltar" id="soltar">Arrastra aquí los archivos para subirlos a <b>${h(ruta.at(-1)?.nombre ?? emp.nombre)}</b></div>` : ''}
      ${hijos.length ? `<div class="carpetas">${hijos.map((c) => tarjetaCarpeta(c)).join('')}</div>` : ''}
      <div class="archivos">${archivos.map((x) => bloqueArchivo(x)).join('')}</div>
      ${!hijos.length && !archivos.length ? `<div class="vacio-msg">Esta carpeta está vacía.${esEquipo() && !S.bibCarpeta ? `<div style="margin-top:12px"><button class="btn" data-accion="carpetas-sugeridas">Crear carpetas: ${CARPETAS_SUGERIDAS.join(', ')}</button></div>` : ''}</div>` : ''}`
  }
  return `
    <div class="bib">
      <aside class="arbol">${arbol}</aside>
      <section>
        <select class="selector-emp" data-filtro="bibEmpresa" aria-label="Empresa">${opcionesEmpresa(emps, S.bibEmpresa)}</select>
        <div class="barra"><input class="crece" type="search" placeholder="Buscar en toda la biblioteca: label, logo, producto…" value="${h(S.bibBusca)}" data-filtro="bibBusca" aria-label="Buscar en la biblioteca"></div>
        ${contenido}
      </section>
    </div>`
}

function tarjetaCarpeta(c, conEmpresa = false) {
  const n = S.biblioteca.filter((a) => a.carpeta_id === c.id && a.vigente).length + S.carpetas.filter((x) => x.padre_id === c.id).length
  return `<button class="carpeta" data-abrir-carpeta="${c.id}"><span class="ico">📁</span><span><b>${h(c.nombre)}</b><span>${conEmpresa ? `${h(empresa(c.empresa_id).nombre)} · ` : ''}${n} ${n === 1 ? 'elemento' : 'elementos'}</span></span></button>`
}

async function subirABiblioteca(files, boton) {
  if (!files.length) return
  await ocupado(boton, async () => {
    try {
      for (const f of files) await D.subirBiblioteca({ empresa_id: S.bibEmpresa, carpeta_id: S.bibCarpeta, file: f })
      avisar(files.length === 1 ? 'Archivo subido' : `${files.length} archivos subidos`)
      await recargar()
    } catch (err) {
      falla(err)
    }
  })
}

function formEditarArchivo(id) {
  const a = S.biblioteca.find((x) => x.id === id)
  if (!a) return
  const opciones = [`<option value="">${h(empresa(a.empresa_id).nombre)} (inicio)</option>`]
  const recorrer = (padre, nivel) => {
    for (const c of S.carpetas.filter((x) => x.empresa_id === a.empresa_id && (x.padre_id ?? null) === padre).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))) {
      opciones.push(`<option value="${c.id}" ${c.id === a.carpeta_id ? 'selected' : ''}>${'— '.repeat(nivel)}${h(c.nombre)}</option>`)
      recorrer(c.id, nivel + 1)
    }
  }
  recorrer(null, 1)
  abrirVentana(
    'Renombrar o mover',
    `<form id="form-archivo">
      <div class="campo"><label for="a-nombre">Nombre</label><input id="a-nombre" type="text" value="${h(a.nombre)}" maxlength="200" required></div>
      <div class="campo"><label for="a-carpeta">Carpeta</label><select id="a-carpeta">${opciones.join('')}</select></div>
      <div class="campo"><label for="a-notas">Notas (ayudan a encontrarlo)</label><input id="a-notas" type="text" value="${h(a.notas)}" maxlength="300" placeholder="Ej. pupusas, frijol, 12 oz, label frontal"></div>
      <button class="btn principal" data-ocupado="Guardando…">Guardar</button>
    </form>`,
    { chica: true },
  )
  $('#form-archivo').addEventListener('submit', async (e) => {
    e.preventDefault()
    await ocupado(e.submitter, async () => {
      try {
        await D.cambiarArchivo(a.id, { nombre: $('#a-nombre').value.trim(), carpeta_id: $('#a-carpeta').value || null, notas: $('#a-notas').value.trim() })
        cerrarVentana()
        avisar('Guardado')
        await recargar()
      } catch (err) {
        falla(err)
      }
    })
  })
}

function formABiblioteca(archivoId) {
  const t = S.tareas.find((x) => x.archivos.some((a) => a.id === archivoId))
  const a = t?.archivos.find((x) => x.id === archivoId)
  if (!a) return
  const opciones = [`<option value="">${h(empresa(t.empresa_id).nombre)} (inicio)</option>`]
  const recorrer = (padre, nivel) => {
    for (const c of S.carpetas.filter((x) => x.empresa_id === t.empresa_id && (x.padre_id ?? null) === padre).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))) {
      opciones.push(`<option value="${c.id}" ${/label/i.test(c.nombre) && nivel === 1 ? 'selected' : ''}>${'— '.repeat(nivel)}${h(c.nombre)}</option>`)
      recorrer(c.id, nivel + 1)
    }
  }
  recorrer(null, 1)
  abrirVentana(
    'Guardar en la Biblioteca',
    `<form id="form-a-bib">
      <p class="ayuda" style="margin-top:0">Se guarda una copia en la Biblioteca de <b>${h(empresa(t.empresa_id).nombre)}</b>. Ahí la ven todos los que tienen acceso a esa empresa (no solo ${h(nombreCliente(t.cliente_id))}).</p>
      <div class="campo"><label for="b-nombre">Nombre</label><input id="b-nombre" type="text" value="${h(a.nombre)}" maxlength="200" required></div>
      <div class="campo"><label for="b-carpeta">Carpeta</label><select id="b-carpeta">${opciones.join('')}</select></div>
      <button class="btn principal" data-ocupado="Guardando…">Guardar en la Biblioteca</button>
    </form>`,
    { chica: true, alCerrar: () => setTimeout(() => S.abierta && abrirTarea(S.abierta)) },
  )
  $('#form-a-bib').addEventListener('submit', async (e) => {
    e.preventDefault()
    await ocupado(e.submitter, async () => {
      try {
        await D.guardarEnBiblioteca(a, { carpeta_id: $('#b-carpeta').value || null, nombre: $('#b-nombre').value.trim(), empresa_id: t.empresa_id })
        avisar('Guardado en la Biblioteca')
        cerrarVentana()
        await recargar()
      } catch (err) {
        falla(err)
      }
    })
  })
}

// -- parrilla de contenidos ----------------------------------------------------

const CANALES = { whatsapp: 'WhatsApp', estado: 'Estado de WhatsApp', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', otro: 'Otro' }
const ESTADO_CONTENIDO = { borrador: 'Borrador', listo: 'Listo', enviado: 'Enviado' }
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const horaCorta = (t) => (t ? new Date(`2000-01-01T${t}`).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : '')

function contenidosDelMes() {
  const m = S.parrillaMes
  const prefijo = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
  return S.contenidos
    .filter((c) => c.fecha.startsWith(prefijo) && (!S.parrillaEmpresa || c.empresa_id === S.parrillaEmpresa))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.hora ?? '').localeCompare(String(b.hora ?? '')))
}

function chipContenido(c) {
  const n = c.archivos?.length ?? 0
  return `<button class="contenido c-${c.estado}" style="--color-emp:${color(c.empresa_id)}" data-contenido="${c.id}" title="${h(empresa(c.empresa_id).nombre)} · ${h(CANALES[c.canal])}">
    <span>${c.hora ? `${horaCorta(c.hora)} · ` : ''}${h(CANALES[c.canal])}${n ? ` · 📎${n}` : ''}</span><b>${h(c.titulo)}</b></button>`
}

function vistaParrilla() {
  const m = S.parrillaMes
  const mes = contenidosDelMes()
  const hoy = isoDia(new Date())
  // La cuadrícula del mes, de lunes a domingo.
  const primero = new Date(m.getFullYear(), m.getMonth(), 1)
  const inicio = new Date(primero)
  inicio.setDate(1 - ((primero.getDay() + 6) % 7))
  const celdas = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio)
    d.setDate(inicio.getDate() + i)
    if (i >= 35 && d.getMonth() !== m.getMonth()) break
    const iso = isoDia(d)
    const delDia = mes.filter((c) => c.fecha === iso)
    celdas.push(`<div class="dia ${d.getMonth() !== m.getMonth() ? 'fuera' : ''} ${iso === hoy ? 'hoy' : ''}">
      <div class="dia-num">${d.getDate()}${esEquipo() && d.getMonth() === m.getMonth() ? `<button class="mas" data-nuevo-contenido="${iso}" aria-label="Agregar contenido el ${d.getDate()}">+</button>` : ''}</div>
      ${delDia.map(chipContenido).join('')}
    </div>`)
  }
  const emps = S.empresas.filter((e) => e.activa && (esEquipo() || !S.yo.empresas || S.yo.empresas.includes(e.id)))
  const titulo = m.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return `
    <p class="ayuda" style="margin-top:0">Lo que las vendedoras publican y mandan cada día. ${esEquipo() ? 'Tú y tu equipo la llenan; todos la ven.' : 'La prepara el equipo de NXUS.'}</p>
    <div class="barra parrilla-barra">
      <div class="mes-nav"><button class="btn chico" data-parrilla-mes="-1" aria-label="Mes anterior">←</button><b>${h(titulo[0].toUpperCase() + titulo.slice(1))}</b><button class="btn chico" data-parrilla-mes="1" aria-label="Mes siguiente">→</button><button class="btn chico" data-parrilla-mes="0">Hoy</button></div>
      <select data-filtro="parrillaEmpresa"><option value="">Todas las empresas</option>${opcionesEmpresa(emps, S.parrillaEmpresa)}</select>
      ${esEquipo() ? `<button class="btn principal" data-nuevo-contenido="">+ Contenido</button>` : ''}
    </div>
    <div class="calendario">
      ${DIAS_SEMANA.map((d) => `<div class="dia-nombre">${d}</div>`).join('')}
      ${celdas.join('')}
    </div>
    <div class="parrilla-lista">
      ${mes.length ? mes.map((c) => `<div class="fila-contenido"><div class="fecha-contenido">${h(fecha(c.fecha))}</div>${chipContenido(c)}</div>`).join('') : '<div class="vacio-msg">No hay contenidos este mes.</div>'}
    </div>`
}

/** El material de un contenido: una vista previa grande de cada imagen o video, con Ver y Descargar. */
function bloqueMaterial(c) {
  const lista = c?.archivos ?? []
  if (!lista.length) return ''
  return `<div class="material">${lista
    .map(
      (a) => `<div class="material-uno">
        <div class="previa" data-previa="${a.id}" data-mime="${h(a.tipo_mime)}"><span class="ayuda">Cargando…</span></div>
        ${filaArchivo(a, { borrar: true })}
      </div>`,
    )
    .join('')}</div>`
}
/** Pone las vistas previas cuando ya están las direcciones firmadas. */
async function cargarPrevias() {
  for (const el of document.querySelectorAll('[data-previa]')) {
    const a = todosLosArchivos().find((x) => x.id === el.dataset.previa)
    if (!a) continue
    try {
      const url = await D.url(a)
      const video = /^video\//.test(a.tipo_mime) || /\.(mp4|mov|m4v|webm)$/i.test(a.nombre)
      const img = /^image\//.test(a.tipo_mime) || /\.(png|jpe?g|gif|webp|heic)$/i.test(a.nombre)
      el.innerHTML = video ? `<video src="${h(url)}" controls playsinline preload="metadata"></video>` : img ? `<img src="${h(url)}" alt="${h(a.nombre)}">` : `<span class="ayuda">${h(a.nombre)}</span>`
    } catch {
      el.innerHTML = '<span class="ayuda">No se pudo cargar la vista previa.</span>'
    }
  }
}

function abrirContenido(id, fechaNueva = '') {
  const c = id ? S.contenidos.find((x) => x.id === id) : null
  if (id && !c) return
  S.contenidoAbierto = c?.id ?? null
  const alCerrar = () => (S.contenidoAbierto = null)
  if (!esEquipo()) {
    abrirVentana(
      h(c.titulo),
      `<div class="barra" style="margin-top:0"><span class="chip emp" style="--color-emp:${color(c.empresa_id)}">${h(empresa(c.empresa_id).nombre)}</span><span class="chip">${h(CANALES[c.canal])}</span><span class="chip">${h(fecha(c.fecha))}${c.hora ? ` · ${horaCorta(c.hora)}` : ''}</span></div>
      ${c.texto ? `<div class="texto-contenido">${h(c.texto)}</div><button class="btn" data-copiar="${c.id}">Copiar texto</button>` : ''}
      ${c.enlace ? ` <a class="btn" href="${h(c.enlace)}" target="_blank" rel="noopener">Abrir link ↗</a>` : ''}
      ${bloqueMaterial(c) || (c.enlace ? '' : '<p class="ayuda">Este contenido todavía no tiene imagen ni video.</p>')}`,
      { alCerrar },
    )
    cargarPrevias()
    return
  }
  const emps = S.empresas.filter((e) => e.activa)
  const v = c ?? { empresa_id: S.parrillaEmpresa || emps[0]?.id, fecha: fechaNueva || isoDia(new Date()), hora: '', canal: 'whatsapp', titulo: '', texto: '', enlace: '', estado: 'borrador' }
  abrirVentana(
    c ? 'Editar contenido' : 'Nuevo contenido',
    `<form id="form-contenido">
      <div class="dos-campos">
        <div class="campo"><label for="ct-emp">Empresa</label><select id="ct-emp" required>${opcionesEmpresa(emps, v.empresa_id)}</select></div>
        <div class="campo"><label for="ct-canal">Dónde</label><select id="ct-canal">${Object.entries(CANALES).map(([k, t]) => `<option value="${k}" ${k === v.canal ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="campo"><label for="ct-fecha">Día</label><input id="ct-fecha" type="date" required value="${h(v.fecha)}"></div>
        <div class="campo"><label for="ct-hora">Hora (opcional)</label><input id="ct-hora" type="time" value="${h(String(v.hora ?? '').slice(0, 5))}"></div>
      </div>
      <div class="campo"><label for="ct-titulo">Título</label><input id="ct-titulo" maxlength="200" required value="${h(v.titulo)}" placeholder="Promo de quesos frescos"></div>
      <div class="campo"><label for="ct-texto">Texto para las vendedoras</label><textarea id="ct-texto" rows="5" maxlength="4000" placeholder="Lo que van a publicar o mandar, tal cual">${h(v.texto)}</textarea></div>
      <div class="campo"><label for="ct-material">Imágenes o videos</label><input id="ct-material" type="file" multiple accept="image/*,video/*"><span class="ayuda">Hasta 50 MB cada uno. No se ven en el calendario: se abren al dar clic en el contenido.</span></div>
      ${c ? bloqueMaterial(c) : ''}
      <div class="campo"><label for="ct-enlace">Link (opcional: Drive, Canva…)</label><input id="ct-enlace" type="url" pattern="https://.*" value="${h(v.enlace)}" placeholder="https://…"></div>
      <div class="campo"><label for="ct-estado">Estado</label><select id="ct-estado">${Object.entries(ESTADO_CONTENIDO).map(([k, t]) => `<option value="${k}" ${k === v.estado ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="barra" style="justify-content:flex-end">
        ${c && esAdmin() ? '<button type="button" class="btn peligro" data-borrar-contenido="' + c.id + '" style="margin-right:auto">Borrar</button>' : ''}
        <button type="button" class="btn" data-accion="cerrar">Cancelar</button>
        <button class="btn principal" data-ocupado="Guardando…">Guardar</button>
      </div>
    </form>`,
    { alCerrar },
  )
  cargarPrevias()
  $('#form-contenido').addEventListener('submit', async (e) => {
    e.preventDefault()
    await ocupado(e.submitter, async () => {
      try {
        const archivos = [...$('#ct-material').files]
        const grandes = archivos.filter((f) => f.size > 50 * 1024 * 1024)
        if (grandes.length) throw new Error(`Pesa más de 50 MB: ${grandes.map((f) => f.name).join(', ')}`)
        const guardado = await D.guardarContenido({
          ...(c ? { id: c.id } : {}),
          empresa_id: $('#ct-emp').value,
          canal: $('#ct-canal').value,
          fecha: $('#ct-fecha').value,
          hora: $('#ct-hora').value || null,
          titulo: $('#ct-titulo').value.trim(),
          texto: $('#ct-texto').value.trim(),
          enlace: $('#ct-enlace').value.trim(),
          estado: $('#ct-estado').value,
        })
        for (const file of archivos) await D.subirMaterial(guardado, file)
        const f = aFecha($('#ct-fecha').value)
        S.parrillaMes = new Date(f.getFullYear(), f.getMonth(), 1)
        cerrarVentana()
        avisar(archivos.length ? `Guardado con ${archivos.length} archivo${archivos.length === 1 ? '' : 's'}` : 'Guardado en la parrilla')
        await recargar()
      } catch (err) {
        falla(err)
      }
    })
  })
}

// -- catálogos ----------------------------------------------------------------

function vistaCatalogos() {
  const emps = misEmpresas('catalogos')
  if (!emps.length) return '<div class="vacio-msg">No tienes catálogos disponibles.</div>'
  return `
    <p class="ayuda" style="margin-top:0">El catálogo vigente de cada empresa. Los anteriores se quedan guardados.</p>
    <div class="cats">
      ${emps
        .map((e) => {
          const lista = conVersiones(S.catalogos.filter((a) => a.empresa_id === e.id)).sort((x, y) => aFecha(y.a.subido) - aFecha(x.a.subido))
          return `
          <div class="cat" style="--color-emp:${color(e.id)}">
            <h3>${h(e.grupo ? `${e.grupo} · ` : '')}${h(e.nombre)}</h3>
            <div class="archivos">${lista.length ? lista.map((x) => bloqueArchivo(x)).join('') : '<p class="ayuda" style="margin:0">Todavía no hay catálogo.</p>'}</div>
            ${esEquipo() ? `<button class="btn" style="margin-top:10px" data-subir-catalogo="${e.id}" data-ocupado="Subiendo…">⬆️ Subir catálogo</button>` : ''}
          </div>`
        })
        .join('')}
    </div>`
}

// -- usuarios (admin) ---------------------------------------------------------

function vistaUsuarios() {
  const orden = { admin: 0, equipo: 1, cliente: 2 }
  const lista = [...S.usuarios].sort((a, b) => orden[a.rol] - orden[b.rol] || a.nombre.localeCompare(b.nombre, 'es'))
  const nombresEmp = (u) => (u.rol !== 'cliente' || !u.empresas ? 'Todas' : u.empresas.map((id) => empresa(id).nombre).join(', ') || 'Ninguna')
  const ve = (u) => (u.rol !== 'cliente' ? 'Todo' : [u.ve_tareas && 'Sus tareas', u.ve_biblioteca && 'Biblioteca', u.ve_catalogos && 'Catálogos', u.ultron && 'Ultron'].filter(Boolean).join(', ') || 'Nada')
  return `
    <div class="barra"><button class="btn principal" data-accion="nuevo-usuario">+ Nuevo usuario</button></div>
    <div class="tabla-envoltura"><table class="tabla">
      <thead><tr><th>Nombre</th><th>Rol</th><th>Empresas</th><th>Puede ver</th><th></th></tr></thead>
      <tbody>${lista
        .map(
          (u) => `<tr class="${u.activo ? '' : 'apagado'}">
            <td><b>${h(u.nombre || '(sin nombre)')}</b><br><span class="ayuda">${h(u.correo)}</span>${u.activo ? '' : '<br><span class="chip urgente">Apagado</span>'}</td>
            <td>${ROLES[u.rol]}</td><td>${h(nombresEmp(u))}</td><td>${h(ve(u))}</td>
            <td style="white-space:nowrap">${u.id === S.yo.id ? '<span class="ayuda">Tú</span>' : `<button class="btn chico" data-editar-usuario="${u.id}">Editar</button> <button class="btn chico" data-clave-usuario="${u.id}">Contraseña</button>`}</td>
          </tr>`,
        )
        .join('')}</tbody>
    </table></div>
    <div class="seccion" style="margin-top:16px">
      <h3>Empresas</h3>
      <p class="ayuda" style="margin-top:0">Apaga o prende una empresa para todos (por ejemplo, VAYRO cuando entre).</p>
      ${[...S.empresas].sort((a, b) => a.orden - b.orden).map((e) => `<label class="casilla"><input type="checkbox" data-empresa-activa="${e.id}" ${e.activa ? 'checked' : ''}> <span class="punto" style="--color-emp:${color(e.id)}"></span> ${h(e.grupo ? `${e.grupo} · ` : '')}${h(e.nombre)}</label>`).join('')}
    </div>`
}

function claveAlAzar() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const r = new Uint32Array(12)
  crypto.getRandomValues(r)
  return [...r].map((n) => letras[n % letras.length]).join('')
}

function formUsuario(id) {
  const u = id ? S.usuarios.find((x) => x.id === id) : null
  const emps = [...S.empresas].sort((a, b) => a.orden - b.orden)
  const todas = !u || !u.empresas
  abrirVentana(
    u ? `Editar a ${h(u.nombre)}` : 'Nuevo usuario',
    `<form id="form-usuario">
      <div class="campo"><label for="u-nombre">Nombre</label><input id="u-nombre" type="text" value="${h(u?.nombre ?? '')}" required></div>
      ${u ? '' : `<div class="campo"><label for="u-correo">Correo (con este entra)</label><input id="u-correo" type="email" required></div>
      <div class="campo"><label for="u-clave">Contraseña</label><div style="display:flex;gap:6px"><input id="u-clave" type="text" value="${claveAlAzar()}" minlength="8" required><button type="button" class="btn" data-accion="otra-clave">↻</button></div><span class="ayuda">Mándasela por WhatsApp; la puede cambiar después contigo.</span></div>`}
      <div class="campo"><label for="u-rol">Rol</label><select id="u-rol">
        <option value="cliente" ${u?.rol === 'cliente' || !u ? 'selected' : ''}>Cliente (pide tareas, ve y descarga)</option>
        <option value="equipo" ${u?.rol === 'equipo' ? 'selected' : ''}>Equipo (trabaja las tareas, sube y organiza)</option>
      </select></div>
      <div id="u-permisos">
        <div class="etiqueta">Empresas que ve</div>
        <label class="casilla"><input type="checkbox" id="u-todas" ${todas ? 'checked' : ''}> Todas</label>
        <div id="u-lista" ${todas ? 'hidden' : ''} style="padding-left:18px">${emps.map((e) => `<label class="casilla"><input type="checkbox" data-u-emp="${e.id}" ${u?.empresas?.includes(e.id) ? 'checked' : ''}> ${h(e.nombre)}</label>`).join('')}</div>
        <div class="etiqueta" style="margin-top:8px">Secciones</div>
        <label class="casilla"><input type="checkbox" id="u-tareas" ${u?.ve_tareas !== false ? 'checked' : ''}> Sus tareas (pedir, corregir, aprobar)</label>
        <label class="casilla"><input type="checkbox" id="u-bib" ${u?.ve_biblioteca !== false ? 'checked' : ''}> Biblioteca</label>
        <label class="casilla"><input type="checkbox" id="u-cat" ${u?.ve_catalogos !== false ? 'checked' : ''}> Catálogos</label>
        <div class="etiqueta" style="margin-top:8px">Dirección</div>
        <label class="casilla"><input type="checkbox" id="u-ultron" ${u?.ultron ? 'checked' : ''}> Habla con Ultron (dueños y gerentes)</label>
      </div>
      ${u ? `<label class="casilla" style="margin-top:8px"><input type="checkbox" id="u-activo" ${u.activo ? 'checked' : ''}> Puede entrar (desmárcalo para quitarle el acceso)</label>` : ''}
      <button class="btn principal" style="margin-top:12px" data-ocupado="Guardando…">${u ? 'Guardar' : 'Crear usuario'}</button>
    </form>`,
    { chica: true },
  )
  const permisos = () => ($('#u-permisos').hidden = $('#u-rol').value !== 'cliente')
  permisos()
  $('#u-rol').addEventListener('change', permisos)
  $('#u-todas').addEventListener('change', () => ($('#u-lista').hidden = $('#u-todas').checked))
  $('[data-accion="otra-clave"]')?.addEventListener('click', () => ($('#u-clave').value = claveAlAzar()))
  $('#form-usuario').addEventListener('submit', async (e) => {
    e.preventDefault()
    const datos = {
      nombre: $('#u-nombre').value.trim(),
      rol: $('#u-rol').value,
      empresas: $('#u-todas').checked ? null : [...document.querySelectorAll('[data-u-emp]:checked')].map((x) => x.dataset.uEmp),
      ve_tareas: $('#u-tareas').checked,
      ve_biblioteca: $('#u-bib').checked,
      ve_catalogos: $('#u-cat').checked,
      ultron: $('#u-rol').value === 'cliente' && $('#u-ultron').checked,
    }
    await ocupado(e.submitter, async () => {
      try {
        if (u) {
          await D.cambiarUsuario(u.id, { ...datos, activo: $('#u-activo').checked })
          avisar('Guardado')
        } else {
          const correo = $('#u-correo').value.trim()
          const clave = $('#u-clave').value
          await D.crearUsuario({ ...datos, correo, clave })
          avisar(`Listo. ${datos.nombre} entra con ${correo} y la contraseña que pusiste.`)
        }
        cerrarVentana()
        await recargar()
      } catch (err) {
        falla(err)
      }
    })
  })
}

function formClave(id) {
  const u = S.usuarios.find((x) => x.id === id)
  abrirVentana(
    `Contraseña de ${h(u.nombre)}`,
    `<form id="form-clave">
      <div class="campo"><label for="k-clave">Contraseña nueva</label><div style="display:flex;gap:6px"><input id="k-clave" type="text" value="${claveAlAzar()}" minlength="8" required><button type="button" class="btn" data-accion="otra-clave-k">↻</button></div></div>
      <button class="btn principal" data-ocupado="Guardando…">Cambiar contraseña</button>
    </form>`,
    { chica: true },
  )
  $('[data-accion="otra-clave-k"]').addEventListener('click', () => ($('#k-clave').value = claveAlAzar()))
  $('#form-clave').addEventListener('submit', async (e) => {
    e.preventDefault()
    await ocupado(e.submitter, async () => {
      try {
        await D.cambiarClave(u.id, $('#k-clave').value)
        cerrarVentana()
        avisar(`Listo. Mándale a ${u.nombre} su contraseña nueva.`)
      } catch (err) {
        falla(err)
      }
    })
  })
}

// -- bitácora (admin) ----------------------------------------------------------

function vistaBitacora() {
  return `<p class="ayuda" style="margin-top:0">Quién hizo qué y cuándo (lo último primero). Nadie la puede borrar ni cambiar.</p><div id="bitacora"><div class="cargando">Cargando…</div></div>`
}

const NOMBRE_TABLA = { tareas: 'tarea', correcciones: 'corrección', notas: 'actualización', archivos: 'archivo', carpetas: 'carpeta', perfiles: 'usuario', empresas: 'empresa' }
async function cargarBitacora() {
  try {
    const filas = await D.bitacora()
    const nombres = new Map(S.usuarios.map((u) => [u.id, u.nombre]))
    const archivos = new Map([...S.biblioteca, ...S.catalogos, ...S.tareas.flatMap((t) => t.archivos)].map((a) => [a.id, a.nombre]))
    const tareas = new Map(S.tareas.map((t) => [t.id, `#${t.folio} ${t.titulo}`]))
    const que = (f) => {
      const d = f.detalle || {}
      if (f.tabla === 'archivos') return d.nombre?.[1] ?? d.nombre ?? archivos.get(f.fila) ?? ''
      if (f.tabla === 'tareas') return tareas.get(f.fila) ?? d.titulo ?? ''
      if (f.tabla === 'correcciones') return d.n ? `corrección ${d.n}` : ''
      return d.nombre?.[1] ?? d.nombre ?? ''
    }
    const cambios = (f) =>
      f.accion === 'cambió'
        ? Object.entries(f.detalle || {})
            .map(([k, [a, b]]) => `${k}: ${a ?? '—'} → ${b ?? '—'}`)
            .join(' · ')
        : ''
    const el = $('#bitacora')
    if (!el) return
    el.innerHTML = filas.length
      ? `<div class="tabla-envoltura"><table class="tabla"><thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th></tr></thead><tbody>${filas
          .map(
            (f) =>
              `<tr><td style="white-space:nowrap">${fecha(f.cuando, true)}</td><td>${h(nombres.get(f.quien) ?? (f.quien ? 'Alguien' : 'Sistema'))}</td><td><b>${h(f.accion)}</b> ${h(NOMBRE_TABLA[f.tabla] ?? f.tabla)} ${h(que(f))}<br><span class="ayuda">${h(cambios(f))}</span></td></tr>`,
          )
          .join('')}</tbody></table></div>`
      : '<div class="vacio-msg">Todavía no hay movimientos.</div>'
  } catch (err) {
    falla(err)
  }
}

// -- ventana -----------------------------------------------------------------

let alCerrarVentana = null
function abrirVentana(titulo, cuerpo, { chica = false, html = false, alCerrar = null } = {}) {
  const m = $('#modal')
  const scroll = m.hidden ? 0 : m.scrollTop
  m.innerHTML = `<div class="ventana ${chica ? 'chica' : ''}" role="dialog" aria-modal="true"><div class="ventana-cabeza"><h2>${html ? titulo : titulo}</h2><button class="cerrar" data-accion="cerrar" aria-label="Cerrar">×</button></div><div class="ventana-cuerpo">${cuerpo}</div></div>`
  m.hidden = false
  m.scrollTop = scroll
  document.body.style.overflow = 'hidden'
  alCerrarVentana = alCerrar
}
function cerrarVentana() {
  const m = $('#modal')
  m.hidden = true
  m.innerHTML = ''
  document.body.style.overflow = ''
  const f = alCerrarVentana
  alCerrarVentana = null
  f?.()
}

// Preguntas cortas encima de todo (el navegador de algunos lugares no deja
// usar confirm/prompt).
function dialogo(titulo, cuerpo) {
  return new Promise((resolve) => {
    const capa = document.createElement('div')
    capa.className = 'capa-dialogo'
    capa.innerHTML = `<form class="ventana chica" role="alertdialog" aria-modal="true"><div class="ventana-cabeza"><h2>${h(titulo)}</h2></div><div class="ventana-cuerpo">${cuerpo}</div></form>`
    document.body.append(capa)
    const form = capa.querySelector('form')
    const fin = (v) => {
      capa.remove()
      resolve(v)
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const campo = form.querySelector('input')
      fin(campo ? campo.value : true)
    })
    form.querySelector('[data-no]').addEventListener('click', () => fin(null))
    capa.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        fin(null)
      }
    })
    ;(form.querySelector('input') || form.querySelector('button[type=submit]')).focus()
  })
}
const preguntar = async (titulo, texto, { boton = 'Sí', peligro = false } = {}) =>
  Boolean(
    await dialogo(
      titulo,
      `<p style="margin-top:0">${h(texto)}</p><div class="barra" style="justify-content:flex-end;margin:0"><button type="button" class="btn" data-no>Cancelar</button><button type="submit" class="btn ${peligro ? 'peligro' : 'principal'}">${h(boton)}</button></div>`,
    ),
  )
const pedirTexto = (titulo, etiqueta, valor = '') =>
  dialogo(
    titulo,
    `<div class="campo"><label for="dlg-texto">${h(etiqueta)}</label><input id="dlg-texto" type="text" value="${h(valor)}" maxlength="120" required></div><div class="barra" style="justify-content:flex-end;margin:0"><button type="button" class="btn" data-no>Cancelar</button><button type="submit" class="btn principal">Guardar</button></div>`,
  )

// -- archivos: ver, bajar, enviar ------------------------------------------------

function todosLosArchivos() {
  return [...S.biblioteca, ...S.catalogos, ...S.tareas.flatMap((t) => t.archivos), ...S.contenidos.flatMap((c) => c.archivos ?? [])]
}
async function verArchivo(id, descargar) {
  const a = todosLosArchivos().find((x) => x.id === id)
  if (!a) return
  if (MUESTRA) {
    avisar(descargar ? `En el sistema real aquí se descarga “${a.nombre}”.` : `En el sistema real aquí se abre “${a.nombre}”.`)
    D.anotar(descargar ? 'descargó' : 'vio', a.id)
    return
  }
  // La pestaña se abre antes de esperar (si no, el celular la bloquea).
  const ventana = descargar ? null : window.open('', '_blank')
  try {
    const url = await D.url(a, { descargar })
    if (descargar) {
      const link = document.createElement('a')
      link.href = url
      link.download = a.nombre
      document.body.append(link)
      link.click()
      link.remove()
    } else if (ventana) ventana.location.href = url
    else window.location.href = url
    D.anotar(descargar ? 'descargó' : 'vio', a.id)
  } catch (err) {
    ventana?.close()
    falla(err)
  }
}

function confeti() {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  } catch {}
  const capa = document.createElement('div')
  capa.className = 'confeti'
  const colores = ['#00e5ff', '#1f74ff', '#a21cff', '#2ee59d', '#ffc23d']
  capa.innerHTML = Array.from({ length: 90 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colores[i % colores.length]};--dx:${(Math.random() - 0.5) * 240}px;--rot:${Math.random() * 900}deg;animation-delay:${Math.random() * 0.35}s"></i>`).join('')
  document.body.append(capa)
  setTimeout(() => capa.remove(), 2400)
}

// -- clics ---------------------------------------------------------------------

async function alClic(e) {
  const b = e.target.closest('button, [data-tarea]')
  if (!b) {
    if (e.target.id === 'modal') cerrarVentana()
    return
  }
  const d = b.dataset
  try {
    if (d.entrarMuestra) {
      S.yo = await D.entrar(d.entrarMuestra)
      S.vista = 'tareas'
      S.mes = 'pendientes'
      Object.assign(S, { filtroCliente: '', filtroEmpresa: '', busca: '', bibBusca: '', bibCarpeta: null })
      await empezar()
      return
    }
    if (d.vista) {
      S.vista = d.vista
      pintar()
      return
    }
    if (d.parrillaMes !== undefined) {
      const paso = Number(d.parrillaMes)
      const m = paso === 0 ? new Date() : new Date(S.parrillaMes.getFullYear(), S.parrillaMes.getMonth() + paso, 1)
      S.parrillaMes = new Date(m.getFullYear(), m.getMonth(), 1)
      pintarVista()
      return
    }
    if (d.contenido) return abrirContenido(d.contenido)
    if (d.nuevoContenido !== undefined) return abrirContenido(null, d.nuevoContenido)
    if (d.copiar) {
      const c = S.contenidos.find((x) => x.id === d.copiar)
      await navigator.clipboard.writeText(c?.texto ?? '')
      avisar('Texto copiado')
      return
    }
    if (d.borrarContenido) {
      if (!(await preguntar('Borrar contenido', 'Se quita de la parrilla. ¿Seguro?', { boton: 'Borrar', peligro: true }))) return
      await D.borrarContenido(d.borrarContenido)
      cerrarVentana()
      avisar('Borrado')
      await recargar()
      return
    }
    if (d.mes !== undefined) {
      S.mes = d.mes === 'pendientes' ? 'pendientes' : Number(d.mes)
      S.busca = ''
      pintarVista()
      return
    }
    if (d.tarea) return abrirTarea(d.tarea)
    if (d.ver) return verArchivo(d.ver, false)
    if (d.bajar) return verArchivo(d.bajar, true)
    if (d.correo) {
      const a = todosLosArchivos().find((x) => x.id === d.correo)
      await ocupado(b, async () => {
        const r = await D.correo(a)
        avisar(`Te lo envié a ${r.para}. Revisa tu correo en un minuto.`)
      })
      return
    }
    if (d.aBiblioteca) return formABiblioteca(d.aBiblioteca)
    if (d.borrarNota) {
      const t = S.tareas.find((x) => x.id === S.abierta)
      const n = t.notas.find((x) => x.id === d.borrarNota)
      if (!(await preguntar('Borrar actualización', '¿Borrar esta actualización y sus archivos? No se puede deshacer.', { boton: 'Borrar', peligro: true }))) return
      await D.borrarNota(n, t.archivos.filter((a) => a.nota_id === n.id))
      avisar('Actualización borrada')
      await recargar()
      return
    }
    if (d.borrarCorreccion) {
      const t = S.tareas.find((x) => x.id === S.abierta)
      const c = t.correcciones.find((x) => x.id === d.borrarCorreccion)
      if (!(await preguntar('Borrar corrección', `¿Borrar la corrección ${c.n} y sus PDFs? No se puede deshacer.`, { boton: 'Borrar', peligro: true }))) return
      await D.borrarCorreccion(c, t.archivos.filter((a) => a.correccion_id === c.id))
      avisar('Corrección borrada')
      await recargar()
      return
    }
    if (d.borrarArchivo) {
      const a = todosLosArchivos().find((x) => x.id === d.borrarArchivo)
      if (!(await preguntar('Borrar archivo', `¿Borrar “${a.nombre}” para siempre? Esto no se puede deshacer.`, { boton: 'Borrar', peligro: true }))) return
      await D.borrarArchivo(a)
      avisar('Borrado')
      await recargar()
      return
    }
    if (d.subirEntrega !== undefined) {
      const t = S.tareas.find((x) => x.id === S.abierta)
      const files = await elegirArchivos({ accept: 'application/pdf,image/*' })
      if (!files.length) return
      await ocupado(b, async () => {
        for (const f of files) await D.subirEntrega(t, d.subirEntrega || null, f)
      })
      avisar(d.subirEntrega ? 'PDF corregido subido. La fecha se puso sola.' : 'PDF final subido. La fecha de entrega se puso sola.')
      await recargar()
      return
    }
    if (d.anteriores) {
      if (S.abiertosAnteriores.has(d.anteriores)) S.abiertosAnteriores.delete(d.anteriores)
      else S.abiertosAnteriores.add(d.anteriores)
      pintarVista()
      return
    }
    if (d.nuevaVersion) {
      const a = [...S.biblioteca, ...S.catalogos].find((x) => x.id === d.nuevaVersion)
      const files = await elegirArchivos()
      if (!files.length) return
      await ocupado(b, async () => {
        if (a.tipo === 'catalogo') await D.subirCatalogo({ empresa_id: a.empresa_id, file: files[0], anterior_id: a.id })
        else await D.subirBiblioteca({ empresa_id: a.empresa_id, carpeta_id: a.carpeta_id, file: files[0], anterior_id: a.id })
      })
      avisar('Versión nueva subida. La anterior quedó guardada.')
      await recargar()
      return
    }
    if (d.editarArchivo) return formEditarArchivo(d.editarArchivo)
    if (d.bibEmpresa) {
      S.bibEmpresa = d.bibEmpresa
      S.bibCarpeta = null
      S.bibBusca = ''
      pintarVista()
      return
    }
    if (d.bibCarpeta !== undefined) {
      S.bibCarpeta = d.bibCarpeta || null
      pintarVista()
      return
    }
    if (d.abrirCarpeta) {
      const c = S.carpetas.find((x) => x.id === d.abrirCarpeta)
      S.bibEmpresa = c.empresa_id
      S.bibCarpeta = c.id
      S.bibBusca = ''
      pintarVista()
      return
    }
    if (d.subirCatalogo) {
      const files = await elegirArchivos()
      if (!files.length) return
      await ocupado(b, () => D.subirCatalogo({ empresa_id: d.subirCatalogo, file: files[0] }))
      avisar('Catálogo subido')
      await recargar()
      return
    }
    if (d.editarUsuario) return formUsuario(d.editarUsuario)
    if (d.claveUsuario) return formClave(d.claveUsuario)
    if (d.empresaActiva) return

    switch (d.accion) {
      case 'cerrar':
        return cerrarVentana()
      case 'salir':
        desmontarUltron()
        await D.salir()
        S.yo = null
        return pintarEntrada()
      case 'cambiar-muestra':
        desmontarUltron()
        S.yo = null
        return pintarEntrada()
      case 'nueva-tarea':
        return formNuevaTarea()
      case 'abrir-nota':
        $('#form-nota').hidden = false
        b.hidden = true
        $('#n-texto').focus()
        return
      case 'cerrar-pasos':
        try {
          localStorage.setItem('ct-pasos', 'no')
        } catch {}
        pintarVista()
        return
      case 'borrar-tarea': {
        const t = S.tareas.find((x) => x.id === S.abierta)
        if (!(await preguntar('Borrar tarea', `¿Borrar la tarea #${t.folio} “${t.titulo}” con todo lo que tiene? No se puede deshacer.`, { boton: 'Borrar para siempre', peligro: true }))) return
        await D.borrarTarea(t)
        cerrarVentana()
        avisar('Tarea borrada')
        await recargar()
        return
      }
      case 'abrir-correccion':
        $('#form-correccion').hidden = false
        b.hidden = true
        $('#c-texto').focus()
        return
      case 'aprobar': {
        if (!(await preguntar('Aprobar tarea', '¿Te gustó y la damos por terminada? La tarea se cierra y queda guardada.', { boton: '✅ Sí, aprobar' }))) return
        await ocupado(b, () => D.aprobar(S.abierta))
        confeti()
        avisar('¡Aprobada! Quedó guardada. Gracias 🎉')
        await recargar()
        return
      }
      case 'subir-biblioteca':
        return subirABiblioteca(await elegirArchivos({ multiple: true }), b)
      case 'nueva-carpeta': {
        const nombre = (await pedirTexto('Carpeta nueva', 'Nombre de la carpeta'))?.trim()
        if (!nombre) return
        await D.crearCarpeta({ empresa_id: S.bibEmpresa, padre_id: S.bibCarpeta, nombre })
        await recargar()
        return
      }
      case 'carpetas-sugeridas':
        await ocupado(b, async () => {
          for (const nombre of CARPETAS_SUGERIDAS) await D.crearCarpeta({ empresa_id: S.bibEmpresa, padre_id: null, nombre })
        })
        await recargar()
        return
      case 'renombrar-carpeta': {
        const c = S.carpetas.find((x) => x.id === S.bibCarpeta)
        const nombre = (await pedirTexto('Renombrar carpeta', 'Nombre nuevo', c.nombre))?.trim()
        if (!nombre || nombre === c.nombre) return
        await D.renombrarCarpeta(c.id, nombre)
        await recargar()
        return
      }
      case 'borrar-carpeta': {
        const c = S.carpetas.find((x) => x.id === S.bibCarpeta)
        const llena = S.biblioteca.some((a) => a.carpeta_id === c.id) || S.carpetas.some((x) => x.padre_id === c.id)
        if (llena) {
          avisar('Primero mueve o borra lo que tiene adentro. Solo se borran carpetas vacías.', true)
          return
        }
        if (!(await preguntar('Borrar carpeta', `¿Borrar la carpeta “${c.nombre}”? Está vacía.`, { boton: 'Borrar', peligro: true }))) return
        await D.borrarCarpeta(c.id)
        S.bibCarpeta = c.padre_id ?? null
        await recargar()
        return
      }
      case 'nuevo-usuario':
        return formUsuario(null)
    }
  } catch (err) {
    falla(err)
  }
}

async function alCambiar(e) {
  const el = e.target
  const d = el.dataset
  try {
    if (d.filtro) {
      if (d.filtro === 'anio') {
        S.anio = Number(el.value)
        if (S.mes === 'pendientes') S.mes = 0
      } else S[d.filtro] = el.value
      if (d.filtro === 'bibEmpresa') S.bibCarpeta = null
      if (e.type === 'change' || d.filtro === 'busca' || d.filtro === 'bibBusca') {
        const foco = document.activeElement === el
        const pos = el.selectionStart
        pintarVista()
        if (foco && el.type === 'search') {
          const nuevo = document.querySelector(`[data-filtro="${d.filtro}"]`)
          nuevo?.focus()
          nuevo?.setSelectionRange?.(pos, pos)
        }
      }
      return
    }
    if (e.type !== 'change') return
    if (d.cambiarTarea) {
      await D.cambiarTarea(S.abierta, { [d.cambiarTarea]: el.value || null })
      avisar('Guardado')
      await recargar()
      return
    }
    if (d.cambiarCorreccion) {
      await D.cambiarCorreccion(d.cambiarCorreccion, { estatus: el.value })
      avisar('Guardado')
      await recargar()
      return
    }
    if (d.empresaActiva) {
      await D.cambiarEmpresa(d.empresaActiva, { activa: el.checked })
      avisar(el.checked ? 'Empresa prendida' : 'Empresa apagada')
      await recargar()
    }
  } catch (err) {
    falla(err)
    await recargar()
  }
}

function arrastrar() {
  let encima = 0
  document.addEventListener('dragenter', (e) => {
    if (S.vista !== 'biblioteca' || !esEquipo() || !e.dataTransfer?.types?.includes('Files')) return
    encima++
    $('#soltar')?.classList.add('encima')
  })
  document.addEventListener('dragleave', () => {
    encima = Math.max(0, encima - 1)
  })
  document.addEventListener('dragover', (e) => {
    if (S.vista === 'biblioteca' && esEquipo()) e.preventDefault()
  })
  document.addEventListener('drop', (e) => {
    if (S.vista !== 'biblioteca' || !esEquipo()) return
    e.preventDefault()
    encima = 0
    const files = [...(e.dataTransfer?.files ?? [])]
    if (files.length) subirABiblioteca(files, $('[data-accion="subir-biblioteca"]'))
  })
}

// -- arranque ------------------------------------------------------------------

export async function iniciar(datos, { muestra = false } = {}) {
  D = datos
  MUESTRA = muestra
  document.addEventListener('click', alClic)
  document.addEventListener('change', alCambiar)
  document.addEventListener('input', (e) => {
    if (e.target.dataset.filtro === 'busca' || e.target.dataset.filtro === 'bibBusca') alCambiar(e)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#modal').hidden && !$('.capa-dialogo')) cerrarVentana()
  })
  arrastrar()
  try {
    S.yo = await D.sesion()
  } catch (err) {
    S.yo = null
    pintarEntrada(err.message)
    return
  }
  if (!S.yo) return pintarEntrada()
  try {
    await empezar()
  } catch (err) {
    S.yo = null
    pintarEntrada(err.message)
  }
}
