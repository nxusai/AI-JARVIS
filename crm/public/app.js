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
// Las tareas van por hojas, una por paso: se mueven solas de hoja cuando cambia su estatus.
// "toca": a quién le toca hacer algo en esa hoja (equipo o cliente).
const HOJAS = [
  { k: 'pedidas', titulo: 'Pedidas', estatus: ['recibida'], toca: 'equipo' },
  { k: 'proceso', titulo: 'En proceso', estatus: ['en-proceso', 'en-correccion'], toca: 'equipo' },
  { k: 'revisar', titulo: 'Para revisar', estatus: ['entregada'], toca: 'cliente' },
  { k: 'aprobadas', titulo: 'Aprobadas', estatus: ['aprobada'], toca: '' },
]
const hojaDe = (estatus) => HOJAS.find((x) => x.estatus.includes(estatus)) ?? HOJAS[0]

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
ICONOS.leads = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>'
ICONOS.fiesta = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l5-14 9 9-14 5z"/><path d="M13 6c1-2 3-2 4-3M17 11c2-1 3 0 4-1M15 3l1 1M20 7l1 1M19 3l.5.5"/></svg>'
ICONOS.web = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>'
const CARPETAS_SUGERIDAS = ['Labels', 'Logotipos', 'Diseños', 'Estructuras de label', 'Documentos']

import { CLAVE_MINIMA, normalizarUsuario } from './acceso.js'
import { fraseDelDia } from './frases.js'
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
  fiesta: [],
  leads: [],
  leadsBusca: '',
  leadAbierto: null,
  fiestaBusca: '',
  web: [],
  webBusca: '',
  webEstatus: '',
  fiestaEmpresa: '',
  plan: [],
  usuarios: [],
  parrillaMes: (() => {
    const x = new Date()
    return new Date(x.getFullYear(), x.getMonth(), 1)
  })(),
  parrillaEmpresa: '',
  parrillaMarca: '',
  parrillaTipo: '',
  vista: 'tareas',
  mes: 'pendientes',
  hoja: null,
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

/** Si veo una empresa en una sección (como veo() en la base de datos): el admin todo; los demás según sus permisos. */
const veoEmpresa = (id, seccion) => esAdmin() || ((!S.yo.empresas || S.yo.empresas.includes(id)) && S.yo[`ve_${seccion}`] !== false)
/** Las empresas que veo en una sección, activas y en orden. */
function misEmpresas(seccion) {
  return S.empresas
    .filter((e) => e.activa)
    .filter((e) => veoEmpresa(e.id, seccion))
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
  const [empresas, tareas, carpetas, biblioteca, catalogos, clientes, contenidos, plan] = await Promise.all([
    D.empresas(),
    S.yo.ve_tareas !== false || esAdmin() ? D.tareas() : [],
    D.carpetas(),
    D.biblioteca(),
    D.catalogos(),
    esEquipo() ? D.clientes() : [],
    D.contenidos ? D.contenidos() : [],
    D.plan ? D.plan() : [],
  ])
  Object.assign(S, { empresas, tareas, carpetas, biblioteca, catalogos, clientes, contenidos, plan })
  S.fiesta = D.fiesta ? await D.fiesta().catch(() => null) : []
  S.web = D.webLeads && veoLeads() ? await D.webLeads().catch(() => null) : []
  S.leads = D.leads && veoLeads() ? await D.leads() : []
  if (esAdmin()) S.usuarios = await D.usuarios()
}

async function recargar() {
  try {
    await cargarTodo()
    pintar()
    if (S.leadAbierto) abrirLead(S.leadAbierto)
    else if (S.abierta) abrirTarea(S.abierta)
    else if (S.contenidoAbierto) abrirContenido(S.contenidoAbierto)
  } catch (err) {
    falla(err)
  }
}

// -- entrada -----------------------------------------------------------------

let ultimoUsuario = ''
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
      <div class="campo"><label for="usuario">Usuario</label><input id="usuario" type="text" value="${h(ultimoUsuario)}" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="por ejemplo: senen" required></div>
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
        ultimoUsuario = $('#usuario').value.trim()
        S.yo = await D.entrar(ultimoUsuario, $('#clave').value.trim())
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

/** Todo se desvanece 2 segundos para que se luzca el fondo; un clic lo regresa antes. */
let tiempoFondo
function verFondo(ms = 780) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  clearTimeout(tiempoFondo)
  document.body.classList.add('ver-fondo')
  const volver = () => {
    clearTimeout(tiempoFondo)
    document.body.classList.remove('ver-fondo')
    removeEventListener('pointerdown', volver, true)
    removeEventListener('keydown', volver, true)
  }
  setTimeout(() => {
    addEventListener('pointerdown', volver, true)
    addEventListener('keydown', volver, true)
  }, 50)
  tiempoFondo = setTimeout(volver, ms)
}

async function empezar() {
  S.hoja = null
  $('#app').innerHTML = '<div class="cargando">Cargando…</div>'
  await cargarTodo()
  const vistas = vistasPermitidas()
  if (!vistas.includes(S.vista)) S.vista = vistas[0] ?? 'tareas'
  pintar()
  ofrecerCambiarClave()
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
  if (esAdmin() || S.yo.ve_tareas !== false) v.push('tareas')
  // La parrilla: quien tenga el permiso; solo el equipo la llena.
  if (esAdmin() || S.yo.ve_parrilla !== false) v.push('parrilla')
  if (esAdmin() || S.yo.ve_biblioteca !== false) v.push('biblioteca')
  if (esAdmin() || S.yo.ve_catalogos !== false) v.push('catalogos')
  // Los leads de Mi Semago que llama Ana Sofi: el admin y quien tenga el permiso.
  if (veoLeads()) v.push('leads')
  // Website leads: las solicitudes del formulario de misemago.com. Los ve quien ve Leads.
  if (veoLeads()) v.push('web')
  // La fiesta de empleados: todos los usuarios del centro ven quién confirmó.
  v.push('fiesta')
  if (esAdmin()) v.push('usuarios', 'bitacora')
  return v
}

// -- marco -------------------------------------------------------------------

const NOMBRES_VISTA = { tareas: 'Tareas', parrilla: 'Parrilla', biblioteca: 'Biblioteca', catalogos: 'Catálogos', leads: 'Leads', web: 'WEBSITE LEADS', fiesta: 'Fiesta', usuarios: 'Usuarios', bitacora: 'Bitácora' }
const ROLES = { admin: 'Administrador', equipo: 'Equipo', cliente: 'Cliente' }

function pintar() {
  const app = $('#app')
  app.innerHTML = `
    <header class="cabeza">
      ${MUESTRA ? `<div class="franja-muestra">Muestra con datos de ejemplo · nada se guarda de verdad <button class="btn chico" data-accion="cambiar-muestra">Cambiar de persona</button></div>` : ''}
      <div class="cabeza-fila">
        <div class="marca">${logo()}<div><b>MI SEMAGO · ABUELITO</b><span>Centro de trabajo · NXUS AI</span></div></div>
        <div class="quien"><b>${h(S.yo.nombre)}</b><span>${ROLES[S.yo.rol]}</span></div>
        <button class="btn chico" data-accion="mi-clave" title="Cambiar mi contraseña" aria-label="Cambiar mi contraseña">🔑<span class="solo-ancho"> Contraseña</span></button>
        <button class="btn chico" data-accion="salir">Salir</button>
      </div>
      <nav class="pestanas">
        ${vistasPermitidas()
          .map((v) => `<button class="pestana ${S.vista === v ? 'activa' : ''}" data-vista="${v}">${ICONOS[v]}${NOMBRES_VISTA[v]}${v === 'web' && webNuevos() ? `<span class="pestana-num">${webNuevos()}</span>` : ''}</button>`)
          .join('')}
      </nav>
    </header>
    ${cabezaMovil()}
    <main id="vista"></main>
    ${esCliente() ? `<footer class="frase"><span>Frase del día</span><p>${fraseDelDia(datosFrase())}</p></footer>` : ''}
    ${barraMovil()}`
  pintarVista()
}

// -- celular ------------------------------------------------------------------
// En el celular el centro de trabajo se usa como app de iPhone: título grande
// arriba, barra de pestañas abajo (al alcance del pulgar) y lo que se usa poco
// en "Más". Lo de la computadora no cambia: estas piezas solo se ven en pantallas
// angostas (estilo.css), y unas vistas se pintan distinto si esMovil().
const MOVIL = '(max-width: 760px)'
const esMovil = () => matchMedia(MOVIL).matches
try {
  matchMedia(MOVIL).addEventListener('change', () => S.yo && pintar())
} catch {}
const ICONO_MAS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>'
const tieneUltron = () => Boolean(D.ultron && (S.yo.ultron || esAdmin()))

/** Las 3 secciones que van en la barra de abajo; las demás, en "Más". */
function pestanasMovil() {
  const v = vistasPermitidas()
  return ['tareas', 'parrilla', 'leads', 'biblioteca', 'catalogos', 'web', 'fiesta', 'usuarios'].filter((x) => v.includes(x)).slice(0, 3)
}

function cabezaMovil() {
  const titulo = S.vista === 'mas' ? 'Más' : S.vista === 'web' ? 'Website leads' : NOMBRES_VISTA[S.vista] || ''
  const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })
  return `<div class="m-cab">
    <div class="m-fila"><button class="m-menu" data-accion="menu-movil" aria-label="Menú"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><span class="m-fecha">${S.vista === 'leads' ? 'Mi Semago · WhatsApp' : h(hoy)}</span></div>
    <h1 class="m-titulo">${titulo}</h1>
    ${esCliente() && S.vista === 'tareas' ? `<p class="m-frase">${fraseDelDia(datosFrase())}</p>` : ''}
  </div>`
}

function barraMovil() {
  const tabs = pestanasMovil().map((v) => `<button class="m-tab ${S.vista === v ? 'on' : ''}" data-vista="${v}">${ICONOS[v]}<span>${v === 'web' ? 'Web' : NOMBRES_VISTA[v]}</span>${v === 'web' && webNuevos() ? `<i class="m-num">${webNuevos()}</i>` : ''}</button>`)
  if (tieneUltron()) tabs.splice(Math.min(2, tabs.length), 0, '<button class="m-tab" data-accion="ultron-movil" aria-label="Ultron"><span class="m-orbe"></span><span>Ultron</span></button>')
  const enMas = vistasPermitidas().filter((v) => !pestanasMovil().includes(v))
  const avisoMas = enMas.includes('web') && webNuevos() ? `<i class="m-num">${webNuevos()}</i>` : ''
  tabs.push(`<button class="m-tab" data-accion="menu-movil">${ICONO_MAS}<span>Más</span>${avisoMas}</button>`)
  return `<nav class="m-tabs" aria-label="Secciones">${tabs.join('')}</nav>`
}

/** "Más": lo que se usa poco, ordenado como Ajustes del iPhone. */
function vistaMas() {
  const enMas = vistasPermitidas().filter((v) => !pestanasMovil().includes(v))
  const ICO = { biblioteca: ['📁', '#e8eefc'], catalogos: ['📘', '#fbf1e0'], web: ['🌐', '#e7f4ec'], fiesta: ['🎉', '#fbe9e1'], leads: ['📞', '#e8eefc'], parrilla: ['📅', '#efe9fb'], tareas: ['✅', '#e7f4ec'], usuarios: ['👥', '#efefec'], bitacora: ['📜', '#efefec'] }
  const fila = (attrs, ico, fondo, texto, extra = '') => `<button class="m-fila-l" ${attrs}><span class="m-ic" style="background:${fondo}">${ico}</span><span class="m-txt">${texto}</span>${extra}<span class="m-flecha">›</span></button>`
  return `
    <div class="m-perfil"><span class="m-av grande">${h(primerNombre(S.yo.nombre).slice(0, 1).toUpperCase())}</span><div><b>${h(S.yo.nombre)}</b><span>${ROLES[S.yo.rol]} · Mi Semago · Abuelito</span></div></div>
    ${enMas.length ? `<div class="m-grupo">${enMas.map((v) => fila(`data-vista="${v}"`, ICO[v]?.[0] ?? '•', ICO[v]?.[1] ?? '#efefec', v === 'web' ? 'Website leads' : NOMBRES_VISTA[v], v === 'web' && webNuevos() ? `<i class="m-num fijo">${webNuevos()}</i>` : '')).join('')}</div>` : ''}
    <div class="m-grupo">
      ${fila('data-accion="mi-clave"', '🔑', '#efefec', 'Cambiar contraseña')}
      ${fila('data-accion="ver-fondo"', '🖼️', '#efefec', 'Ver el fondo')}
      ${MUESTRA ? fila('data-accion="cambiar-muestra"', '👤', '#efefec', 'Cambiar de persona (muestra)') : ''}
      <button class="m-fila-l" data-accion="salir"><span class="m-txt m-rojo">Cerrar sesión</span></button>
    </div>
    <p class="m-hecho">Hecho por NXUS AI</p>`
}

/** El menú (las tres líneas o "Más") sube como hoja; se cierra con la ✕, tocando afuera o eligiendo algo. */
function abrirMenuMovil() {
  abrirVentana('Menú', vistaMas())
}

/** Los números del cliente para la frase del día (solo lo que él ya puede ver). */
function datosFrase() {
  const ahora = new Date()
  const mes = (f) => {
    const d = new Date(f)
    return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth()
  }
  const hoyISO = ahora.toLocaleDateString('en-CA')
  const enSemana = new Date(ahora.getTime() + 7 * 864e5).toLocaleDateString('en-CA')
  return {
    entregadasMes: S.tareas.filter((t) => t.entregada && mes(t.entregada)).length,
    aprobadas: S.tareas.filter((t) => t.estatus === 'aprobada').length,
    archivos: S.biblioteca.filter((a) => a.vigente !== false).length,
    contenidosSemana: S.contenidos.filter((c) => c.estado !== 'borrador' && c.fecha >= hoyISO && c.fecha <= enSemana).length,
    porRevisar: S.tareas.filter((t) => t.estatus === 'entregada').length,
  }
}

function pintarVista() {
  const el = $('#vista')
  if (!el) return
  const v = {
    tareas: vistaTareas,
    parrilla: vistaParrilla,
    biblioteca: vistaBiblioteca,
    catalogos: vistaCatalogos,
    web: vistaWeb,
    fiesta: vistaFiesta,
    leads: vistaLeads,
    usuarios: vistaUsuarios,
    bitacora: vistaBitacora,
    mas: vistaMas,
  }[S.vista]
  el.innerHTML = v ? v() : ''
  if (S.vista === 'bitacora') cargarBitacora()
}

// -- website leads ------------------------------------------------------------
// Las solicitudes del formulario «Cotizar / Get a quote» de misemago.com (función
// de Netlify «leads»). Aparte de los Leads de WhatsApp que llama Ana Sofi.

const ESTATUS_WEB = { nuevo: 'Nuevo', contactado: 'Contactado', cotizado: 'Cotizado', ganado: 'Ganado', perdido: 'Perdido' }
const webNuevos = () => (S.web || []).filter((x) => x.estatus === 'nuevo').length

function webFiltrados() {
  const q = sinAcentos(S.webBusca)
  return (S.web || []).filter((x) => (!S.webEstatus || x.estatus === S.webEstatus) && (!q || sinAcentos([x.nombre, x.empresa, x.correo, x.telefono, x.mensaje].join(' ')).includes(q)))
}

function vistaWeb() {
  if (S.web === null) return '<div class="vacio-msg">Falta actualizar la base de datos para ver los website leads: corre el esquema en Supabase (SQL Editor → Run).</div>'
  const todos = S.web
  const lista = webFiltrados()
  return `
    <div class="fiesta-cabeza">
      <div><h2>🌐 Website leads</h2><p class="ayuda">Las solicitudes de cotización que llegan del formulario de <b>misemago.com</b>. Mueve el estatus conforme avanzas y deja notas para el equipo.</p></div>
      <div class="fiesta-botones">
        <a class="btn chico" href="https://misemago.com/#contacto" target="_blank" rel="noopener">Ver formulario ↗</a>
        <button class="btn chico" data-accion="recargar-web">↻ Actualizar</button>
        <button class="btn chico" data-accion="csv-web" ${todos.length ? '' : 'disabled'}>⬇️ Descargar lista</button>
      </div>
    </div>
    <div class="fiesta-cuentas wl-cuentas">
      <button class="fiesta-cuenta total ${S.webEstatus ? '' : 'activa'}" data-web-filtro=""><b>${todos.length}</b><span>Todos</span></button>
      ${Object.entries(ESTATUS_WEB)
        .map(([k, n]) => `<button class="fiesta-cuenta wl-${k} ${S.webEstatus === k ? 'activa' : ''}" data-web-filtro="${k}"><b>${todos.filter((x) => x.estatus === k).length}</b><span>${n}</span></button>`)
        .join('')}
    </div>
    <div class="barra">
      <input type="search" class="crece" data-filtro="webBusca" value="${h(S.webBusca)}" placeholder="Buscar por nombre, empresa, correo o mensaje" aria-label="Buscar website lead">
    </div>
    ${
      !todos.length
        ? '<div class="vacio-msg">Todavía no llega ningún website lead. Aquí aparece cada solicitud que manden desde misemago.com.</div>'
        : !lista.length
          ? '<div class="vacio-msg">Ningún lead coincide.</div>'
          : `<div class="wl-lista">${lista.map(tarjetaWeb).join('')}</div>`
    }`
}

function tarjetaWeb(x) {
  return `<article class="wl wl-${x.estatus}">
    <header class="wl-cabeza">
      <div>
        <b class="wl-nombre">${h(x.nombre)}</b>${x.empresa ? ` <span class="wl-empresa">· ${h(x.empresa)}</span>` : ''}
        <div class="ayuda">#${x.folio} · ${fecha(x.creada, true)}${x.idioma === 'en' ? ' · en inglés' : ''}${x.lead_id ? ' · <b>📞 Pidió que le llamen: Ana Sofi le llama</b>' : ''}</div>
      </div>
      <select class="wl-estatus" data-web-estatus="${x.id}" aria-label="Estatus del lead">
        ${Object.entries(ESTATUS_WEB).map(([k, n]) => `<option value="${k}" ${x.estatus === k ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
    </header>
    <div class="wl-botones">
      <a class="btn chico" href="mailto:${h(x.correo)}">✉️ ${h(x.correo)}</a>
      ${x.telefono ? `<a class="btn chico" href="tel:${h(x.telefono.replace(/[^\d+]/g, ''))}">📞 ${h(x.telefono)}</a>` : ''}
    </div>
    ${x.tipo || x.intereses?.length ? `<div class="chips">${x.tipo ? `<span class="chip">${h(x.tipo)}</span>` : ''}${(x.intereses || []).map((i) => `<span class="chip">🧀 ${h(i)}</span>`).join('')}</div>` : ''}
    ${x.mensaje ? `<p class="wl-mensaje">${h(x.mensaje)}</p>` : ''}
    ${x.propuesta ? `<details class="wl-propuesta"><summary>✦ Diseño del Estudio de Marca</summary><pre>${h(x.propuesta)}</pre></details>` : ''}
    <footer class="wl-pie">
      ${x.notas ? `<p class="wl-notas"><b>Notas:</b> ${h(x.notas)}</p>` : '<span class="ayuda">Sin notas</span>'}
      <div class="wl-botones">
        <button class="btn chico" data-notas-web="${x.id}">📝 ${x.notas ? 'Editar notas' : 'Agregar nota'}</button>
        ${x.lead_id ? `<button class="btn chico" data-lead="${x.lead_id}">📞 Ver llamada de Ana Sofi</button>` : ''}
        ${esAdmin() ? `<button class="btn chico peligro" data-borrar-web="${x.id}" title="Borrar">✕</button>` : ''}
      </div>
    </footer>
  </article>`
}

function formNotasWeb(id) {
  const x = S.web.find((l) => l.id === id)
  if (!x) return
  abrirVentana(
    `Notas · ${h(x.nombre)}`,
    `<form id="form-notas-web">
      <div class="campo"><label for="nw-notas">Lo que se habló, siguientes pasos, precios cotizados…</label><textarea id="nw-notas" rows="6" maxlength="5000">${h(x.notas)}</textarea></div>
      <button class="btn principal" data-ocupado="Guardando…">Guardar notas</button>
    </form>`,
    { chica: true },
  )
  $('#nw-notas').focus()
  $('#form-notas-web').addEventListener('submit', async (e) => {
    e.preventDefault()
    await ocupado(e.submitter, async () => {
      try {
        await D.cambiarWebLead(x.id, { notas: $('#nw-notas').value.trim() })
        cerrarVentana()
        avisar('Notas guardadas')
        await recargar()
      } catch (err) {
        falla(err)
      }
    })
  })
}

function csvWeb() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const filas = [
    ['Folio', 'Fecha', 'Estatus', 'Nombre', 'Empresa', 'Correo', 'Teléfono', 'Tipo de negocio', 'Le interesa', 'Mensaje', 'Diseño del Estudio', 'Notas'],
    ...webFiltrados().map((x) => [x.folio, fecha(x.creada, true), ESTATUS_WEB[x.estatus], x.nombre, x.empresa, x.correo, x.telefono, x.tipo, (x.intereses || []).join(', '), x.mensaje, x.propuesta, x.notas]),
  ]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['\ufeff' + filas.map((f) => f.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  a.download = 'website-leads.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// -- fiesta de empleados -------------------------------------------------------

const FIESTA_EMPRESAS = ['MI SEMAGO', 'ABUELITO CORN', 'ABUELITO MEAT', 'ABUELITO CHEESE']
const FIESTA_URL = () => `${location.origin}/fiesta/`
const telBonito = (t) => (t.length === 10 ? `(${t.slice(0, 3)}) ${t.slice(3, 6)}-${t.slice(6)}` : t)

function invitadosFiltrados() {
  const q = S.fiestaBusca.trim().toLowerCase()
  return (S.fiesta || []).filter(
    (x) => (!S.fiestaEmpresa || x.empresa === S.fiestaEmpresa) && (!q || x.nombre.toLowerCase().includes(q) || x.telefono.includes(q.replace(/\D/g, '') || '~')),
  )
}

function vistaFiesta() {
  if (S.fiesta === null) return '<div class="vacio-msg">Falta actualizar la base de datos para ver la fiesta: corre el esquema en Supabase (SQL Editor → Run).</div>'
  const todos = S.fiesta
  const lista = invitadosFiltrados()
  const porEmpresa = FIESTA_EMPRESAS.map((e) => [e, todos.filter((x) => x.empresa === e).length])
  const cerrado = Date.now() >= Date.parse('2026-11-17T05:00:00Z')
  return `
    <div class="fiesta-cabeza">
      <div><h2>🎉 Fiesta de empleados</h2><p class="ayuda">Viernes 4 de diciembre de 2026 · 7:00 PM a 1:00 AM · Milan Banquets, 32 Passaic St, Garfield, NJ 07026 · ${cerrado ? '<b>La confirmación ya cerró</b>' : 'Confirman hasta el <b>16 de noviembre</b>'}</p></div>
      <div class="fiesta-botones">
        <a class="btn chico" href="/fiesta/" target="_blank" rel="noopener">Ver invitación ↗</a>
        <button class="btn chico" data-accion="copiar-fiesta">🔗 Copiar enlace</button>
        <button class="btn chico" data-accion="csv-fiesta" ${todos.length ? '' : 'disabled'}>⬇️ Descargar lista</button>
      </div>
    </div>
    <div class="fiesta-cuentas">
      <div class="fiesta-cuenta total"><b>${todos.length}</b><span>Confirmados</span></div>
      ${porEmpresa.map(([e, n]) => `<button class="fiesta-cuenta ${S.fiestaEmpresa === e ? 'activa' : ''}" data-fiesta-empresa="${h(e)}"><b>${n}</b><span>${h(e)}</span></button>`).join('')}
    </div>
    <div class="barra">
      <input type="search" data-filtro="fiestaBusca" value="${h(S.fiestaBusca)}" placeholder="Buscar por nombre o teléfono" aria-label="Buscar invitado">
      ${S.fiestaEmpresa ? `<button class="btn chico" data-fiesta-empresa="">Ver todas las empresas</button>` : ''}
    </div>
    ${
      !todos.length
        ? '<div class="vacio-msg">Todavía nadie confirma. Comparte la invitación o pega el código QR en las empresas.</div>'
        : !lista.length
          ? '<div class="vacio-msg">Nadie coincide con esa búsqueda.</div>'
          : `<div class="tabla-envoltura"><table class="tabla">
      <thead><tr><th>#</th><th>Nombre</th><th>Teléfono</th><th>Empresa</th><th>Confirmó</th>${esAdmin() ? '<th></th>' : ''}</tr></thead>
      <tbody>${lista
        .map(
          (x, i) => `<tr><td>${lista.length - i}</td><td><b>${h(x.nombre)}</b></td><td><a href="tel:${h(x.telefono)}">${h(telBonito(x.telefono))}</a></td><td><span class="chip">${h(x.empresa)}</span></td><td>${fecha(x.actualizada || x.creada, true)}</td>${
            esAdmin() ? `<td><button class="btn chico peligro" data-borrar-invitado="${x.id}" title="Borrar">✕</button></td>` : ''
          }</tr>`,
        )
        .join('')}</tbody></table></div>`
    }`
}

function csvFiesta() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const filas = [['Nombre', 'Teléfono', 'Empresa', 'Confirmó'], ...invitadosFiltrados().map((x) => [x.nombre, telBonito(x.telefono), x.empresa, fecha(x.actualizada || x.creada, true)])]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + filas.map((f) => f.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  a.download = 'fiesta-confirmados.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
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

/** La hoja que se abre sola: al cliente, lo que le toca revisar; al equipo, lo que le toca trabajar. */
function hojaInicial(base) {
  const hay = (k) => base.some((t) => HOJAS.find((x) => x.k === k).estatus.includes(t.estatus))
  const orden = esCliente() ? ['revisar', 'proceso', 'pedidas'] : ['pedidas', 'proceso', 'revisar']
  return orden.find(hay) ?? orden[0]
}

/** Las aprobadas se ordenan por el mes en que se aprobaron. */
const fechaHoja = (t) => aFecha(t.estatus === 'aprobada' && t.aprobada ? t.aprobada : t.pedida)

function vistaTareas() {
  const base = tareasFiltradas()
  if (!S.hoja) S.hoja = hojaInicial(base)
  const hoja = HOJAS.find((x) => x.k === S.hoja) ?? HOJAS[0]
  const busca = S.busca.trim()
  if (hoja.k === 'aprobadas' && S.mes === 'pendientes') S.mes = new Date().getMonth()
  let lista
  let titulo
  if (busca) {
    lista = base.filter((t) => coincide(textoTarea(t), busca)).sort((a, b) => aFecha(b.pedida) - aFecha(a.pedida))
    titulo = `Resultados de “${h(busca)}” en todas las hojas y meses`
  } else if (hoja.k !== 'aprobadas') {
    lista = base.filter((t) => hoja.estatus.includes(t.estatus)).sort((a, b) => Number(b.urgente) - Number(a.urgente) || aFecha(a.pedida) - aFecha(b.pedida))
    const mia = (hoja.toca === 'cliente') === esCliente()
    titulo = {
      pedidas: esCliente() ? '⏳ Le toca al equipo: recibirlas y empezar.' : '👉 Te toca: abre cada una y dale “Recibir y empezar”.',
      proceso: esCliente() ? '⏳ Le toca al equipo: está trabajando en estas (y en tus correcciones).' : '👉 Te toca: termínalas y sube el PDF final.',
      revisar: esCliente() ? '👉 Te toca a ti: revisa cada una y apruébala o pide una corrección.' : '⏳ Le toca al cliente: revisarlas y aprobarlas o pedir corrección.',
    }[hoja.k]
    titulo = `<span class="${mia ? 'te-toca' : ''}">${titulo}</span>`
  } else {
    lista = base
      .filter((t) => {
        const d = fechaHoja(t)
        return t.estatus === 'aprobada' && d.getFullYear() === S.anio && d.getMonth() === S.mes
      })
      .sort((a, b) => fechaHoja(b) - fechaHoja(a))
    titulo = `Aprobadas en ${MESES_LARGOS[S.mes]} ${S.anio}`
  }
  const aprobadas = base.filter((t) => t.estatus === 'aprobada')
  const anios = [...new Set([new Date().getFullYear(), ...aprobadas.map((t) => fechaHoja(t).getFullYear())])].sort((a, b) => b - a)
  const porMes = MESES.map((_, m) => aprobadas.filter((t) => { const d = fechaHoja(t); return d.getFullYear() === S.anio && d.getMonth() === m }).length)
  const empresasTareas = misEmpresas('tareas')
  return `
    ${saludo(base)}
    <div class="barra barra-tareas ${S.filtrosMovil ? 'filtros-abiertos' : ''}">
      ${esCliente() ? `<button class="btn principal" data-accion="nueva-tarea">+ Nueva tarea</button>` : `<button class="btn principal" data-accion="nueva-tarea">+ Registrar tarea de un cliente</button>`}
      <input class="crece" type="search" placeholder="Buscar tarea, producto, folio…" value="${h(S.busca)}" data-filtro="busca" aria-label="Buscar">
      ${esEquipo() || empresasTareas.length > 1 ? `<button class="m-filtros ${S.filtrosMovil ? 'on' : ''}" data-accion="filtros-movil" aria-label="Filtros"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg></button>` : ''}
      ${esEquipo() ? `<select data-filtro="filtroCliente" aria-label="Cliente"><option value="">Todos los clientes</option>${S.clientes.map((c) => `<option value="${c.id}" ${S.filtroCliente === c.id ? 'selected' : ''}>${h(c.nombre)}</option>`).join('')}</select>` : ''}
      ${empresasTareas.length > 1 ? `<select data-filtro="filtroEmpresa" aria-label="Empresa"><option value="">Todas las empresas</option>${opcionesEmpresa(empresasTareas, S.filtroEmpresa)}</select>` : ''}
    </div>
    ${
      hoja.k === 'aprobadas' && !busca
        ? `<div class="meses" role="tablist">
      <select data-filtro="anio" aria-label="Año" style="width:auto;border-radius:999px;min-height:34px;padding:4px 10px">${anios.map((a) => `<option ${a === S.anio ? 'selected' : ''}>${a}</option>`).join('')}</select>
      ${MESES.map((m, i) => `<button class="mes ${S.mes === i ? 'activo' : ''} ${porMes[i] ? '' : 'vacio'}" data-mes="${i}">${m}${porMes[i] ? `<small>${porMes[i]}</small>` : ''}</button>`).join('')}
    </div>`
        : ''
    }
    <p class="ayuda hoja-aviso">${titulo}</p>
    ${!busca && hoja.toca ? `<span class="m-sec">${(hoja.toca === 'cliente') === esCliente() ? '👉 Te toca a ti' : esCliente() ? '⏳ Le toca al equipo' : '⏳ Le toca al cliente'}</span>` : ''}
    <div class="lista">
      ${lista.length ? lista.map(tarjetaTarea).join('') : `<div class="vacio-msg">${busca ? '<b>Nada por aquí 🔎</b>Prueba con otra palabra: el producto, la empresa o el número de folio.' : hoja.k === 'aprobadas' ? '<b>Mes tranquilo</b>No se aprobó nada en este mes.' : `<b>Nada en “${hoja.titulo}” 🎉</b>${hoja.toca && (hoja.toca === 'cliente') === esCliente() ? 'No tienes nada pendiente aquí.' : 'Aquí aparecen solas cuando les toque.'}`}</div>`}
    </div>
    <button class="m-fab" data-accion="nueva-tarea" aria-label="${esCliente() ? 'Nueva tarea' : 'Registrar tarea de un cliente'}">+</button>`
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
    ${(() => {
      const mias = base.filter((t) => (hojaDe(t.estatus).toca === 'cliente') === esCliente() && hojaDe(t.estatus).toca).length
      if (!mias) return ''
      const que = esCliente() ? (mias === 1 ? 'tarea te toca revisar' : 'tareas te toca revisar') : mias === 1 ? 'tarea por trabajar' : 'tareas por trabajar'
      return `<button class="m-toca" data-hoja="${esCliente() ? 'revisar' : base.some((t) => t.estatus === 'recibida') ? 'pedidas' : 'proceso'}"><i></i>${mias} ${que}</button>`
    })()}
    <div class="resumen hojas" role="tablist" aria-label="Hojas de tareas">
      ${HOJAS.map((x) => {
        const n = x.k === 'aprobadas' ? aprobadasMes : base.filter((t) => x.estatus.includes(t.estatus)).length
        const mia = x.toca && (x.toca === 'cliente') === esCliente()
        const sub = x.k === 'aprobadas' ? 'Este mes' : !n ? (mia ? 'Nada pendiente' : 'Nada aquí') : mia ? '👉 Te toca a ti' : esCliente() ? '⏳ Le toca al equipo' : '⏳ Le toca al cliente'
        return `<button class="dato d-${x.k} ${S.hoja === x.k && !S.busca.trim() ? 'activo' : ''} ${mia && n ? 'llama' : ''}" role="tab" aria-selected="${S.hoja === x.k}" data-hoja="${x.k}"><span class="hoja-nombre">${x.titulo}</span><b>${n}</b><span>${sub}</span></button>`
      }).join('')}
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

/** "👉 Te toca" o "⏳ Le toca al equipo / al cliente", según la hoja y quién mira. */
function tocaChip(t) {
  const toca = hojaDe(t.estatus).toca
  if (!toca) return ''
  return (toca === 'cliente') === esCliente() ? '<span class="chip te-toca">👉 Te toca</span>' : `<span class="chip le-toca">⏳ Le toca ${toca === 'cliente' ? 'al cliente' : 'al equipo'}</span>`
}

/** En el celular, el avance es un anillo (1/4 … 4/4) en lugar de las 4 bolitas. */
function anilloMovil(t) {
  const n = pasoDe(t.estatus) + 1
  const color = { 1: '#64748b', 2: '#2563eb', 3: '#8b5cf6', 4: '#16a34a' }[n]
  const largo = 2 * Math.PI * 17
  return `<span class="m-anillo" aria-hidden="true"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" stroke="rgba(0,0,0,.1)" stroke-width="4" fill="none"/><circle cx="21" cy="21" r="17" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="${((largo * n) / 4).toFixed(1)} ${largo.toFixed(1)}"/></svg><span>${n}/4</span></span>`
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
        ${tocaChip(t)}
        ${t.urgente ? '<span class="chip urgente">Urgente</span>' : ''}
        ${(t.notas ?? []).length ? `<span class="chip nuevo">${t.notas.length} ${t.notas.length === 1 ? 'actualización' : 'actualizaciones'}</span>` : ''}
        ${esEquipo() ? `<span class="chip">${h(nombreCliente(t.cliente_id))}</span>` : ''}
      </div></div>${avance(t.estatus)}${anilloMovil(t)}</div>
      <div class="t-m">${h(e.nombre)}${t.urgente ? '<i></i><b>Urgente</b>' : ''}<i></i>${t.estatus === 'entregada' && t.entregada ? `Entregada ${fecha(t.entregada)}` : t.aprobada ? `Aprobada ${fecha(t.aprobada)}` : t.compromiso ? `Compromiso ${fecha(t.compromiso)}` : `Pedida ${fecha(t.pedida)}`}</div>
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
      ${esEquipo() ? `<div class="campo"><label for="t-cliente">¿De quién es?</label><select id="t-cliente" required>${S.clientes.filter((c) => c.activo !== false).map((c) => `<option value="${c.id}">${h(c.nombre)}</option>`).join('')}</select><span class="ayuda">Solo esa persona la verá (y el equipo).</span></div>` : ''}
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
        S.hoja = 'pedidas'
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

/** El detalle en el celular: arriba lo importante y el resto en filas que se abren (como Ajustes). */
function cuerpoTareaMovil(t, x) {
  const e = empresa(t.empresa_id)
  const paso = pasoDe(t.estatus) + 1
  const toca = hojaDe(t.estatus).toca
  const mio = toca && (toca === 'cliente') === esCliente()
  const ult = x.ultimo
  const fila = (ico, fondo, titulo, valor, contenido, abierto = false) =>
    `<details class="m-det"${abierto ? ' open' : ''}><summary><span class="m-ic" style="background:${fondo}">${ico}</span><span class="m-txt">${titulo}</span><span class="m-val">${valor}</span><span class="m-flecha">›</span></summary><div class="m-det-cuerpo">${contenido}</div></details>`
  const cuando = t.aprobada ? `Aprobada ${fecha(t.aprobada)}` : t.compromiso ? `Compromiso ${fecha(t.compromiso)}` : `Pedida ${fecha(t.pedida)}`
  return `
    <div class="m-det-top">
      <span class="m-folio">${h(e.grupo ? `${e.grupo} · ` : '')}${h(e.nombre)}${esEquipo() ? ` · ${h(primerNombre(nombreCliente(t.cliente_id)))}` : ''}</span>
      <div class="chips">${mio ? `<span class="chip te-toca">👉 Te toca ${esCliente() ? 'revisar' : 'a ti'}</span>` : toca ? `<span class="chip le-toca">⏳ Le toca ${toca === 'cliente' ? 'al cliente' : 'al equipo'}</span>` : ''}${t.urgente ? '<span class="chip urgente">Urgente</span>' : ''}<span class="chip est-${t.estatus}">${textoEstatus(t.estatus)}</span></div>
    </div>
    <div class="m-paso"><div class="m-paso-r"><b>Paso ${paso} de 4 · ${AVANCE[paso - 1]}</b><span>${cuando}</span></div><div class="m-prog"><i style="width:${paso * 25}%"></i></div></div>
    ${esEquipo() && t.estatus === 'recibida' ? `<div class="recibir"><b>👉 Tarea nueva sin recibir.</b> Al recibirla pasa a “En proceso” y el cliente ve que ya la están trabajando.<button class="btn principal" data-accion="recibir-tarea" data-ocupado="Recibiendo…">📥 Recibir y empezar</button></div>` : ''}
    <div class="m-grupo m-grupo-det">
      ${fila('📄', '#e8eefc', esEquipo() ? 'Trabajo y entrega' : 'Entrega final', ult ? h(ult.nombre) : 'Todavía no', x.equipoHTML, esEquipo() && t.estatus !== 'aprobada' && t.estatus !== 'recibida')}
      ${fila('✏️', '#fbf1e0', esEquipo() ? `Lo que pidió ${h(primerNombre(x.quien))}` : 'Tu pedido', 'Ver', x.pedidoHTML)}
      ${fila('💬', '#e7f4ec', 'Actualizaciones', String(x.notas.length), x.notasHTML)}
      ${x.correcciones.length ? fila('↩︎', '#fbe9e1', 'Correcciones', String(x.correcciones.length), x.correccionesHTML, t.estatus === 'en-correccion' && esEquipo()) : ''}
    </div>
    ${
      ult || x.todasEntregas.length > 1
        ? `<div class="m-grupo">
            ${x.todasEntregas.length > 1 ? `<button class="m-fila-l" data-correo-todos="${x.todasEntregas.map((a) => a.id).join(',')}" data-ocupado="Mandando…"><span class="m-ic" style="background:#e8eefc">📦</span><span class="m-txt">Mandar los ${x.todasEntregas.length} archivos juntos a mi correo</span><span class="m-flecha">›</span></button>` : ''}
            ${ult ? `<button class="m-fila-l" data-bajar="${ult.id}"><span class="m-ic" style="background:#efefec">⬇️</span><span class="m-txt">Descargar PDF</span><span class="m-flecha">›</span></button>
            <button class="m-fila-l" data-ver="${ult.id}"><span class="m-ic" style="background:#efefec">👁️</span><span class="m-txt">Verlo aquí</span><span class="m-flecha">›</span></button>
            <button class="m-fila-l" data-correo="${ult.id}"><span class="m-ic" style="background:#efefec">✉️</span><span class="m-txt">${x.todasEntregas.length > 1 ? 'Mandar solo el último a mi correo' : 'Mandar a mi correo'}</span><span class="m-flecha">›</span></button>` : ''}
          </div>`
        : ''
    }
    ${x.finalHTML}`
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
  // "Entregada" también cuando el equipo la marcó a mano sin subir el PDF con el botón.
  const entregado = Boolean(t.entregada) || t.estatus === 'entregada'
  // Revisar (aprobar o pedir corrección): el cliente de la tarea, y el admin, que ve todo y puede hacerlo por él.
  const revisa = abierta && entregado && ((esCliente() && mia) || esAdmin())
  const porQuien = esAdmin() && !mia ? primerNombre(nombreCliente(t.cliente_id)) : ''
  const ultimo = [...t.archivos.filter((a) => a.tipo === 'entrega')].sort((a, b) => aFecha(b.subido) - aFecha(a.subido))[0]
  // Todos los archivos de la tarea (entregas del equipo primero, luego los de referencia y de las
  // actualizaciones), para mandarlos juntos en un solo correo. Cada uno conserva su ✉️ para mandarlo solo.
  const todasEntregas = [...t.archivos].sort((a, b) => Number(b.tipo === 'entrega') - Number(a.tipo === 'entrega') || aFecha(a.subido) - aFecha(b.subido)).slice(0, 20)
  const juntos = todasEntregas.length > 1 ? `<div class="mandar-todos"><span>📦 Esta tarea tiene <b>${todasEntregas.length} archivos</b>. Mándalos <b>todos juntos</b> en un solo correo, o <b>uno por uno</b> con el ✉️ de cada archivo.</span><button class="btn principal" data-correo-todos="${todasEntregas.map((a) => a.id).join(',')}" data-ocupado="Mandando…">✉️ Mandar todos a mi correo</button></div>` : ''

  const pedidoHTML = `
      <div class="texto-cliente">${h(t.descripcion || t.titulo)}</div>
      ${refs.length ? `<div class="etiqueta" style="margin:10px 0 6px">Archivos de referencia</div><div class="archivos">${refs.map((a) => filaArchivo(a, { borrar: true })).join('')}</div>` : ''}
`
  const notasHTML = `
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
      }`
  const equipoHTML = `
      ${esEquipo() && t.estatus === 'recibida' ? `<div class="recibir"><b>👉 Tarea nueva sin recibir.</b> Al recibirla pasa a “En proceso” y el cliente ve que ya la están trabajando.<button class="btn principal" data-accion="recibir-tarea" data-ocupado="Recibiendo…">📥 Recibir y empezar</button></div>` : ''}
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
      ${esEquipo() && abierta ? `<button class="btn principal" style="margin-top:10px" data-subir-entrega="" data-ocupado="Subiendo…">⬆️ Subir PDF final</button>` : ''}`
  const correccionesHTML = `
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
`
  const finalHTML = `
    ${
      revisa
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
          </div>
          <div class="m-acciones"><button class="btn" data-accion="m-correccion">Pedir corrección</button><button class="btn principal" data-accion="aprobar" data-ocupado="Aprobando…">✓ Aprobar</button></div>`
        : ''
    }
    ${esCliente() && abierta && !entregado ? `<p class="ayuda" style="text-align:center">Cuando el equipo suba el trabajo, aquí podrás descargarlo, pedir correcciones o aprobarlo.</p>` : ''}
    ${esAdmin() ? `<div class="seccion solo-admin"><h3>Solo tú (admin)</h3><p class="ayuda" style="margin-top:0">Borrar quita la tarea con todas sus entregas, correcciones y actualizaciones. No se puede deshacer.</p><button class="btn peligro" data-accion="borrar-tarea">🗑 Borrar esta tarea</button></div>` : ''}
    ${t.estatus === 'aprobada' ? `<div class="seccion aprobada-caja">✅ Aprobada el ${fecha(t.aprobada, true)}. Tarea concluida.${ultimo && esEquipo() ? `<div style="margin-top:10px"><button class="btn chico" data-a-biblioteca="${ultimo.id}">📚 Guardar el PDF final en la Biblioteca</button></div>` : ''}</div>` : ''}
  `
  const cuerpo = esMovil()
    ? cuerpoTareaMovil(t, { pedidoHTML, notasHTML, equipoHTML, correccionesHTML, finalHTML, notas, correcciones, entregas, ultimo, quien, todasEntregas })
    : `
    <div class="chips" style="margin:0 0 12px">
      <span class="chip emp" style="--color-emp:${color(t.empresa_id)}">${h(e.grupo ? `${e.grupo} · ` : '')}${h(e.nombre)}</span>
      <span class="chip est-${t.estatus}">${textoEstatus(t.estatus)}</span>
      ${t.urgente ? '<span class="chip urgente">Urgente</span>' : ''}
      ${esEquipo() ? `<span class="chip">Cliente: ${h(nombreCliente(t.cliente_id))}</span>` : ''}
    </div>
    ${revisa ? `<div class="revisar-ya"><div>${porQuien ? `<b>👉 Le toca a ${h(porQuien)} revisarla.</b> Como administrador, tú también puedes aprobarla o pedir corrección.` : '<b>👉 Te toca revisarla.</b> Si ya quedó, apruébala y se va a “Aprobadas”.'}</div><div class="revisar-botones"><button class="btn" data-accion="m-correccion">Pedir corrección</button><button class="btn ok" data-accion="aprobar" data-ocupado="Aprobando…">✅ Aprobar</button></div></div>` : ''}
    ${juntos}
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
${pedidoHTML}${notasHTML}
    </div>

    <div class="seccion">
      <h3>Trabajo del equipo ${esCliente() ? '<span class="candado">🔒 Lo actualiza el equipo</span>' : ''}</h3>
${equipoHTML}
    </div>

${correccionesHTML}
${finalHTML}
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

const MARCAS = { abuelito: 'Abuelito', 'mi-semago': 'Mi Semago' }
const marcaDe = (empresaId) => empresa(empresaId).marca ?? (String(empresaId).startsWith('abuelito') ? 'abuelito' : empresaId)
/** El primer día de un mes en 'AAAA-MM-01'. */
const mesISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
const mesDe = (fechaISO) => `${String(fechaISO).slice(0, 7)}-01`
const nombreMes = (iso) => aFecha(iso).toLocaleDateString('es-MX', { month: 'long' })
/** Las marcas cuya parrilla puedo ver. */
const marcasParrilla = () => Object.keys(MARCAS).filter((m) => S.empresas.some((e) => e.activa && e.marca === m && veoEmpresa(e.id, 'parrilla')))
function marcaActual() {
  const ms = marcasParrilla()
  if (!ms.includes(S.parrillaMarca)) S.parrillaMarca = ms[0] ?? ''
  return S.parrillaMarca
}
/** Lo que se espera de una marca en un mes: primero lo fijo (en su orden), luego los extras. */
const planDelMes = (marca, mes) =>
  S.plan
    .filter((p) => p.marca === marca && p.desde <= mes && (!p.hasta || p.hasta > mes))
    .sort((a, b) => Number(b.fijo) - Number(a.fijo) || a.orden - b.orden || String(a.creado).localeCompare(String(b.creado)))
/** La cosa del plan que cumple un contenido (la versión de su mes). */
const tipoDe = (c) => (c.plan_clave ? planDelMes(marcaDe(c.empresa_id), mesDe(c.fecha)).find((p) => p.clave === c.plan_clave) ?? S.plan.find((p) => p.clave === c.plan_clave) : null)
const nombreDe = (id) => (!id ? '' : id === S.yo.id ? S.yo.nombre : (S.usuarios.find((u) => u.id === id)?.nombre ?? S.clientes.find((u) => u.id === id)?.nombre ?? ''))
const puedoPedirExtras = () => S.yo.dueno || (S.yo.pide_extras && S.yo.ve_parrilla !== false)

function contenidosDelMes() {
  const m = S.parrillaMes
  const prefijo = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
  const marca = marcaActual()
  return S.contenidos
    .filter((c) => c.fecha.startsWith(prefijo) && marcaDe(c.empresa_id) === marca && (!S.parrillaEmpresa || c.empresa_id === S.parrillaEmpresa))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.hora ?? '').localeCompare(String(b.hora ?? '')))
}

function chipContenido(c) {
  const n = c.archivos?.length ?? 0
  const t = tipoDe(c)
  const atenuado = S.parrillaTipo && (S.parrillaTipo === 'sin' ? Boolean(t) : t?.clave !== S.parrillaTipo)
  return `<button class="contenido c-${c.estado}${atenuado ? ' atenuado' : ''}" style="--color-emp:${color(c.empresa_id)}" data-contenido="${c.id}" title="${h(t ? `${t.nombre} · ` : '')}${h(empresa(c.empresa_id).nombre)} · ${h(CANALES[c.canal])}">
    <span>${c.hora ? `${horaCorta(c.hora)} · ` : ''}${h(CANALES[c.canal])}${n ? ` · 📎${n}` : ''}</span><b><i class="punto-plan" style="background:${t ? t.color : '#adb5bd'}"></i>${h(c.titulo)}</b></button>`
}

/** Arriba del calendario: lo que se espera en el mes, con su punto y cuántos van. */
function bloquePlan(marca, mes, delMes) {
  const plan = planDelMes(marca, mes)
  const sinTipo = delMes.filter((c) => !tipoDe(c)).length
  const items = plan.map((p) => {
    const van = delMes.filter((c) => c.plan_clave === p.clave).length
    const pct = Math.min(100, Math.round((van / p.cantidad) * 100))
    const quien = p.fijo ? '' : p.pedido_nombre || nombreDe(p.pedido_por)
    return `<div class="plan-item ${van >= p.cantidad ? 'completo' : ''} ${S.parrillaTipo === p.clave ? 'activo' : ''}">
      <button class="plan-boton" data-parrilla-tipo="${p.clave}" title="Ver solo esto en el calendario">
        <i class="punto-plan grande" style="background:${p.color}"></i>
        <span class="plan-nombre"><b>${h(p.nombre)}</b>${p.detalle ? `<small>${h(p.detalle)}</small>` : ''}${p.fijo ? '' : `<small class="plan-pidio">Extra · Pidió: <b>${h(quien || 'alguien')}</b></small>`}</span>
        <span class="plan-cuenta"><b>${van}</b> de ${p.cantidad}${van >= p.cantidad ? ' ✓' : ''}<span class="barrita"><span style="width:${pct}%;background:${p.color}"></span></span></span>
      </button>
      ${!p.fijo && S.yo.dueno ? `<button class="btn chico peligro" data-borrar-extra="${p.id}" title="Borrar este extra">✕</button>` : ''}
    </div>`
  })
  if (sinTipo) items.push(`<div class="plan-item ${S.parrillaTipo === 'sin' ? 'activo' : ''}"><button class="plan-boton" data-parrilla-tipo="sin"><i class="punto-plan grande" style="background:#adb5bd"></i><span class="plan-nombre"><b>Sin tipo</b><small>Contenidos que todavía no dicen qué son</small></span><span class="plan-cuenta"><b>${sinTipo}</b></span></button></div>`)
  return `<section class="plan">
    <div class="plan-cabeza">
      <h3>Lo que se espera en ${h(nombreMes(mes))} · ${h(MARCAS[marca])}</h3>
      <div class="plan-acciones">
        ${S.parrillaTipo ? '<button class="btn chico" data-parrilla-tipo="">Ver todo</button>' : ''}
        ${puedoPedirExtras() ? '<button class="btn chico" data-accion="pedir-extra">+ Pedir algo extra</button>' : ''}
        ${S.yo.dueno ? '<button class="btn chico" data-accion="plan-fijo">⚙️ Lo fijo</button>' : ''}
      </div>
    </div>
    ${items.length ? `<div class="plan-lista">${items.join('')}</div>` : '<p class="ayuda" style="margin:0">No hay nada esperado para este mes.</p>'}
  </section>`
}

function vistaParrilla() {
  const m = S.parrillaMes
  const marca = marcaActual()
  if (!marca) return '<div class="vacio-msg">No tienes parrillas disponibles.</div>'
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
  const emps = S.empresas.filter((e) => e.activa && e.marca === marca && veoEmpresa(e.id, 'parrilla'))
  const titulo = m.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const marcas = marcasParrilla()
  return `
    ${marcas.length > 1 ? `<div class="marcas" role="tablist">${marcas.map((k) => `<button class="marca-boton ${k === marca ? 'activa' : ''}" data-marca="${k}" role="tab" aria-selected="${k === marca}">Parrilla ${h(MARCAS[k])}</button>`).join('')}</div>` : ''}
    <p class="ayuda" style="margin-top:0">Lo que las vendedoras publican y mandan cada día. ${esEquipo() ? 'Tú y tu equipo la llenan; al agregar un contenido elige en <b>¿Qué es?</b> para que salga su punto de color.' : 'La prepara el equipo de NXUS.'}</p>
    <div class="barra parrilla-barra">
      <div class="mes-nav"><button class="btn chico" data-parrilla-mes="-1" aria-label="Mes anterior">←</button><b>${h(titulo[0].toUpperCase() + titulo.slice(1))}</b><button class="btn chico" data-parrilla-mes="1" aria-label="Mes siguiente">→</button><button class="btn chico" data-parrilla-mes="0">Hoy</button></div>
      ${emps.length > 1 ? `<select data-filtro="parrillaEmpresa" aria-label="Empresa"><option value="">Todas (${h(MARCAS[marca])})</option>${opcionesEmpresa(emps, S.parrillaEmpresa)}</select>` : ''}
      ${esEquipo() ? `<button class="btn principal" data-nuevo-contenido="">+ Contenido</button>` : ''}
    </div>
    ${bloquePlan(marca, mesISO(m), mes)}
    <div class="calendario">
      ${DIAS_SEMANA.map((d) => `<div class="dia-nombre">${d}</div>`).join('')}
      ${celdas.join('')}
    </div>
    <div class="parrilla-lista">
      ${mes.length ? mes.map((c) => `<div class="fila-contenido"><div class="fecha-contenido">${h(fecha(c.fecha))}</div>${chipContenido(c)}</div>`).join('') : '<div class="vacio-msg">No hay contenidos este mes.</div>'}
    </div>`
}

/** Pedir algo extra para este mes o el siguiente (queda quién lo pidió). */
function formExtra() {
  const marcas = marcasParrilla()
  const hoy = new Date()
  const este = mesISO(hoy)
  const sig = mesISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1))
  const visto = mesISO(S.parrillaMes)
  abrirVentana(
    'Pedir algo extra',
    `<form id="form-extra">
      <p style="margin-top:0" class="ayuda">Se suma a lo que se espera de ese mes, con tu nombre para que todos vean quién lo pidió. Ya no se puede cambiar ni borrar (solo el administrador).</p>
      <div class="campo"><label for="x-nombre">¿Qué necesitas?</label><input id="x-nombre" maxlength="80" required placeholder="Ej. Promo Día de Muertos"></div>
      <div class="dos-campos">
        <div class="campo"><label for="x-cantidad">¿Cuántos?</label><input id="x-cantidad" type="number" min="1" max="100" value="1" required></div>
        <div class="campo"><label for="x-mes">¿Para qué mes?</label><select id="x-mes"><option value="${este}" ${visto !== sig ? 'selected' : ''}>${h(nombreMes(este))} (este mes)</option><option value="${sig}" ${visto === sig ? 'selected' : ''}>${h(nombreMes(sig))} (el siguiente)</option></select></div>
      </div>
      ${marcas.length > 1 ? `<div class="campo"><label for="x-marca">¿De qué marca?</label><select id="x-marca">${marcas.map((k) => `<option value="${k}" ${k === S.parrillaMarca ? 'selected' : ''}>${h(MARCAS[k])}</option>`).join('')}</select></div>` : ''}
      <div class="campo"><label for="x-detalle">Detalles (opcional)</label><textarea id="x-detalle" rows="3" maxlength="500" placeholder="Lo que deba saber el diseñador"></textarea></div>
      <button class="btn principal" data-ocupado="Pidiendo…">Pedir</button>
    </form>`,
    { chica: true },
  )
  $('#form-extra').addEventListener('submit', async (e) => {
    e.preventDefault()
    await ocupado(e.submitter, async () => {
      try {
        const marca = $('#x-marca')?.value ?? S.parrillaMarca
        const desde = $('#x-mes').value
        await D.pedirExtra({ marca, nombre: $('#x-nombre').value, cantidad: $('#x-cantidad').value, detalle: $('#x-detalle').value, desde })
        S.parrillaMarca = marca
        S.parrillaMes = aFecha(desde)
        cerrarVentana()
        avisar('Listo. Ya está en lo que se espera de ese mes.')
        await recargar()
      } catch (err) {
        falla(err)
      }
    })
  })
}

/** Lo fijo de cada marca: solo el administrador principal lo cambia (cuenta desde este mes). */
function formFijo() {
  const marca = marcaActual()
  const mes = mesISO(new Date())
  const fijos = planDelMes(marca, mes).filter((p) => p.fijo)
  abrirVentana(
    `Lo fijo de ${h(MARCAS[marca])}`,
    `<form id="form-fijo" novalidate>
      <p style="margin-top:0" class="ayuda">Lo que se espera <b>cada mes</b>. Los cambios cuentan desde ${h(nombreMes(mes))}; los meses pasados se quedan como estaban. Si quitas algo, deja de salir desde el mes siguiente.</p>
      <div class="fijos">
        ${fijos
          .map(
            (p) => `<div class="fijo-fila" data-fijo="${p.clave}">
          <i class="punto-plan grande" style="background:${p.color}"></i>
          <input data-campo="nombre" maxlength="80" value="${h(p.nombre)}" aria-label="Nombre">
          <input data-campo="cantidad" type="number" min="1" max="100" value="${p.cantidad}" aria-label="Cuántos al mes">
          <button type="button" class="btn chico" data-guardar-fijo="${p.clave}">Guardar</button>
          <button type="button" class="btn chico peligro" data-quitar-fijo="${p.clave}">Quitar</button>
        </div>`,
          )
          .join('')}
      </div>
      <div class="etiqueta" style="margin-top:12px">Agregar otro fijo</div>
      <div class="fijo-fila">
        <i class="punto-plan grande" style="background:#dee2e6"></i>
        <input id="f-nombre" maxlength="80" placeholder="Nombre">
        <input id="f-cantidad" type="number" min="1" max="100" value="1" aria-label="Cuántos al mes">
        <button type="button" class="btn chico principal" data-guardar-fijo="">Agregar</button>
      </div>
    </form>`,
    { chica: true },
  )
  $('#form-fijo').addEventListener('click', async (e) => {
    const b = e.target.closest('button')
    if (!b) return
    const guardar = b.dataset.guardarFijo
    const quitar = b.dataset.quitarFijo
    if (guardar === undefined && quitar === undefined) return
    e.stopPropagation()
    try {
      if (quitar) {
        const p = fijos.find((x) => x.clave === quitar)
        if (!(await preguntar(`Quitar "${p.nombre}"`, `Deja de esperarse desde el mes siguiente. Este mes y los pasados se quedan como están. ¿Seguro?`, { boton: 'Quitar', peligro: true }))) return
        await ocupado(b, () => D.quitarFijo(quitar))
        avisar(`"${p.nombre}" ya no se espera desde el mes siguiente.`)
      } else {
        const fila = guardar ? b.closest('[data-fijo]') : null
        const nombre = (fila ? fila.querySelector('[data-campo="nombre"]') : $('#f-nombre')).value.trim()
        const cantidad = Number((fila ? fila.querySelector('[data-campo="cantidad"]') : $('#f-cantidad')).value)
        if (!nombre || !(cantidad >= 1)) return falla(new Error('Falta el nombre o cuántos al mes'))
        await ocupado(b, () => D.guardarFijo({ clave: guardar || null, marca, nombre, cantidad }))
        avisar(guardar ? 'Guardado. Cuenta desde este mes.' : `Listo: "${nombre}" ya se espera cada mes.`)
      }
      await recargar()
      formFijo()
    } catch (err) {
      falla(err)
    }
  })
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
      `<div class="barra" style="margin-top:0">${tipoDe(c) ? `<span class="chip"><i class="punto-plan" style="background:${tipoDe(c).color}"></i>${h(tipoDe(c).nombre)}</span>` : ''}<span class="chip emp" style="--color-emp:${color(c.empresa_id)}">${h(empresa(c.empresa_id).nombre)}</span><span class="chip">${h(CANALES[c.canal])}</span><span class="chip">${h(fecha(c.fecha))}${c.hora ? ` · ${horaCorta(c.hora)}` : ''}</span></div>
      ${c.texto ? `<div class="texto-contenido">${h(c.texto)}</div><button class="btn" data-copiar="${c.id}">Copiar texto</button>` : ''}
      ${c.enlace ? ` <a class="btn" href="${h(c.enlace)}" target="_blank" rel="noopener">Abrir link ↗</a>` : ''}
      ${bloqueMaterial(c) || (c.enlace ? '' : '<p class="ayuda">Este contenido todavía no tiene imagen ni video.</p>')}`,
      { alCerrar },
    )
    cargarPrevias()
    return
  }
  const marca = c ? marcaDe(c.empresa_id) : marcaActual()
  const emps = S.empresas.filter((e) => (e.activa || e.id === c?.empresa_id) && e.marca === marca && veoEmpresa(e.id, 'parrilla'))
  const enMes = S.parrillaMes.getMonth() === new Date().getMonth() && S.parrillaMes.getFullYear() === new Date().getFullYear()
  const v = c ?? { empresa_id: S.parrillaEmpresa || emps[0]?.id, fecha: fechaNueva || (enMes ? isoDia(new Date()) : mesISO(S.parrillaMes)), hora: '', canal: 'whatsapp', titulo: '', texto: '', enlace: '', estado: 'borrador', plan_clave: S.parrillaTipo && S.parrillaTipo !== 'sin' ? S.parrillaTipo : null }
  abrirVentana(
    c ? 'Editar contenido' : 'Nuevo contenido',
    `<form id="form-contenido">
      <div class="dos-campos">
        <div class="campo"><label for="ct-emp">Empresa</label><select id="ct-emp" required>${opcionesEmpresa(emps, v.empresa_id)}</select></div>
        <div class="campo"><label for="ct-canal">Dónde</label><select id="ct-canal">${Object.entries(CANALES).map(([k, t]) => `<option value="${k}" ${k === v.canal ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="campo"><label for="ct-fecha">Día</label><input id="ct-fecha" type="date" required value="${h(v.fecha)}"></div>
        <div class="campo"><label for="ct-hora">Hora (opcional)</label><input id="ct-hora" type="time" value="${h(String(v.hora ?? '').slice(0, 5))}"></div>
      </div>
      <div class="campo"><label for="ct-tipo">¿Qué es? <span class="ayuda">(de lo que se espera ese mes; le pone su punto de color)</span></label><div class="con-punto"><i class="punto-plan grande" id="ct-punto"></i><select id="ct-tipo"></select></div></div>
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
  // "¿Qué es?": lo que se espera de esa marca en el mes del día elegido.
  const tipos = () => {
    const mes = mesDe($('#ct-fecha').value || v.fecha)
    const antes = $('#ct-tipo').value || v.plan_clave || ''
    const plan = planDelMes(marca, mes)
    const van = (p) => S.contenidos.filter((x) => x.plan_clave === p.clave && mesDe(x.fecha) === mes && x.id !== c?.id).length
    $('#ct-tipo').innerHTML = `<option value="">— Sin tipo —</option>${plan.map((p) => `<option value="${p.clave}" ${p.clave === antes ? 'selected' : ''}>${h(p.nombre)}${p.fijo ? '' : ' (extra)'} · van ${van(p)} de ${p.cantidad}</option>`).join('')}`
    const t = plan.find((p) => p.clave === $('#ct-tipo').value)
    $('#ct-punto').style.background = t ? t.color : '#adb5bd'
  }
  tipos()
  $('#ct-fecha').addEventListener('change', tipos)
  $('#ct-tipo').addEventListener('change', tipos)
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
          // Si la base de datos todavía no tiene el plan (no han corrido el esquema), no se manda.
          ...(S.plan.length ? { plan_clave: $('#ct-tipo').value || null } : {}),
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

// -- leads de Mi Semago -------------------------------------------------------

const veoLeads = () => esAdmin() || Boolean(S.yo?.ve_leads)
const ETAPAS_LEAD = {
  nuevo: { t: 'Nuevo', ayuda: 'Llegó de WhatsApp; Ana Sofi le va a programar la llamada' },
  programada: { t: 'Llamada programada', ayuda: 'Ana Sofi le llama a la hora que pidió' },
  no_contesto: { t: 'No contestó', ayuda: 'Se le vuelve a llamar una vez' },
  hablo: { t: 'Ya habló', ayuda: 'Ana Sofi ya habló con él; no agendó Meet' },
  meet: { t: 'Meet agendado', ayuda: 'Videollamada con Eduardo' },
  cerrado: { t: 'Cerrado', ayuda: 'Ya es cliente' },
  no_califica: { t: 'No califica', ayuda: 'No le conviene o no le interesa' },
  no_llamar: { t: 'No llamar', ayuda: 'Pidió que no le llamen' },
}
const COLUMNAS_LEAD = ['nuevo', 'programada', 'no_contesto', 'hablo', 'meet', 'cerrado', 'no_califica']
const CALIFICACION = { caliente: '🔥 Caliente', medio: '🙂 Medio', frio: '🧊 Frío' }
const ZONA_ESTE = 'America/New_York'

/** "jue 12 nov, 11:00 a.m." en una zona horaria. */
function horaEn(iso, zona = ZONA_ESTE, conDia = true) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-MX', { timeZone: zona || ZONA_ESTE, ...(conDia ? { weekday: 'short', day: 'numeric', month: 'short' } : {}), hour: 'numeric', minute: '2-digit' })
  } catch {
    return new Date(iso).toLocaleString('es-MX')
  }
}
/** La hora del Este y, si el lead vive en otra zona, también la suya. */
function horaLead(iso, l) {
  if (!iso) return ''
  const este = `${horaEn(iso)} (hora del Este)`
  return l.zona && l.zona !== ZONA_ESTE ? `${este} · ${horaEn(iso, l.zona, false)} en ${h(l.ciudad || 'su ciudad')}` : este
}

function tarjetaLead(l) {
  const notas = l.leads_notas?.length ?? 0
  const proximo =
    l.etapa === 'meet' && l.meet_inicio
      ? `🎥 ${horaEn(l.meet_inicio)}`
      : ['programada', 'no_contesto'].includes(l.etapa) && l.llamada_programada
        ? `📞 ${horaEn(l.llamada_programada)}`
        : ''
  return `<button class="lead-tarjeta" data-lead="${l.id}">
    <b>${h(l.negocio || l.nombre || 'Sin nombre')}</b>
    <span>${h([l.negocio ? l.nombre : '', l.ciudad].filter(Boolean).join(' · '))}</span>
    <span class="lead-chips">${l.origen === 'web' ? '<span class="chip">🌐 Web</span>' : ''}${l.calificacion ? `<span class="chip cal-${l.calificacion}">${CALIFICACION[l.calificacion]}</span>` : ''}${l.llamada_estado === 'marcando' || l.llamada_estado === 'en_llamada' ? '<span class="chip vivo">● En llamada</span>' : ''}${notas ? `<span class="chip">📝 ${notas}</span>` : ''}</span>
    ${proximo ? `<small>${proximo}</small>` : ''}
  </button>`
}

// En el celular: una lista como la de Mensajes, agrupada por día, con 4 grupos arriba.
const GRUPOS_LEAD = [
  ['nuevos', 'Nuevos', ['nuevo']],
  ['llamadas', 'Llamadas', ['programada', 'no_contesto', 'hablo']],
  ['meet', 'Meet', ['meet']],
  ['cerrados', 'Cerrados', ['cerrado', 'no_califica', 'no_llamar']],
]
const COLOR_INICIAL = ['#c2410c', '#2563eb', '#16a34a', '#a16207', '#7c3aed', '#db2777', '#0e7490']

function vistaLeadsMovil() {
  const q = sinAcentos(S.leadsBusca)
  const base = S.leads.filter((l) => !q || sinAcentos(`${l.nombre} ${l.negocio} ${l.ciudad} ${l.telefono} ${l.correo}`).includes(q))
  const enGrupo = (g) => base.filter((l) => GRUPOS_LEAD.find((x) => x[0] === g)[2].includes(l.etapa))
  if (!S.leadsGrupo) S.leadsGrupo = GRUPOS_LEAD.find((g) => enGrupo(g[0]).length)?.[0] ?? 'nuevos'
  const cuando = (l) => new Date(l.actualizado || l.creado || Date.now())
  const lista = enGrupo(S.leadsGrupo).sort((a, b) => cuando(b) - cuando(a))
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dia = (l) => {
    const d = (hoy - new Date(cuando(l)).setHours(0, 0, 0, 0)) / 864e5
    return d <= 0 ? 'Hoy' : d === 1 ? 'Ayer' : d < 7 ? 'Esta semana' : 'Antes'
  }
  const fila = (l) => {
    const nombre = l.negocio || l.nombre || 'Sin nombre'
    const ini = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
    const color = COLOR_INICIAL[[...String(l.id)].reduce((n, c) => n + c.charCodeAt(0), 0) % COLOR_INICIAL.length]
    const d = cuando(l)
    const hora = dia(l) === 'Hoy' ? d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })
    const chip =
      l.llamada_estado === 'marcando' || l.llamada_estado === 'en_llamada'
        ? '<span class="m-temp vivo">● En llamada</span>'
        : l.etapa === 'meet' && l.meet_inicio
          ? `<span class="m-temp meet">🎥 ${h(horaEn(l.meet_inicio))}</span>`
          : l.calificacion
            ? `<span class="m-temp cal-${l.calificacion}">${CALIFICACION[l.calificacion]}</span>`
            : `<span class="m-temp">${ETAPAS_LEAD[l.etapa]?.t ?? ''}</span>`
    return `<button class="m-lead" data-lead="${l.id}"><span class="m-ini" style="background:${color}">${h(ini || '?')}</span><span class="m-lead-tx"><b>${h(nombre)}</b><span>${h([l.negocio ? l.nombre : '', l.ciudad].filter(Boolean).join(' · '))}</span></span><span class="m-lead-der"><small>${h(hora)}</small>${chip}</span></button>`
  }
  let grupos = ''
  for (const g of ['Hoy', 'Ayer', 'Esta semana', 'Antes']) {
    const de = lista.filter((l) => dia(l) === g)
    if (de.length) grupos += `<span class="m-sec">${g}</span><div class="m-grupo">${de.map(fila).join('')}</div>`
  }
  const hoyEste = horaEn(new Date().toISOString(), ZONA_ESTE, true).split(',')[0]
  const meetsHoy = S.leads.filter((l) => l.etapa === 'meet' && l.meet_inicio && horaEn(l.meet_inicio).split(',')[0] === hoyEste && new Date(l.meet_inicio) > Date.now() - 3600_000)
  return `
    ${meetsHoy.length ? `<div class="aviso-meet">${meetsHoy.map((l) => `<div>🎥 <b>Hoy ${h(horaEn(l.meet_inicio, ZONA_ESTE, false))}</b> · ${h(l.negocio || l.nombre)}</div><a class="btn principal chico" href="${h(l.meet_link)}" target="_blank" rel="noopener">Unirse</a>`).join('')}</div>` : ''}
    <div class="barra"><input type="search" data-filtro="leadsBusca" value="${h(S.leadsBusca)}" placeholder="Buscar nombre, negocio, ciudad" aria-label="Buscar leads"></div>
    <div class="m-seg" role="tablist">${GRUPOS_LEAD.map(([k, t]) => `<button class="${S.leadsGrupo === k ? 'on' : ''}" role="tab" data-leads-grupo="${k}"><small>${enGrupo(k).length}</small>${t}</button>`).join('')}</div>
    ${S.leads.length ? grupos || `<div class="vacio-msg"><b>Nada aquí</b>Cuando haya leads en “${GRUPOS_LEAD.find((g) => g[0] === S.leadsGrupo)[1]}”, salen aquí.</div>` : '<div class="vacio-msg">Todavía no hay leads. Llegan solos de WhatsApp en cuanto alguien termina el chat de Mi Semago.</div>'}`
}

function vistaLeads() {
  if (esMovil()) return vistaLeadsMovil()
  const q = sinAcentos(S.leadsBusca)
  const lista = S.leads.filter((l) => !q || sinAcentos(`${l.nombre} ${l.negocio} ${l.ciudad} ${l.telefono} ${l.correo}`).includes(q))
  const cuenta = (e) => S.leads.filter((l) => l.etapa === e).length
  const hoyEste = horaEn(new Date().toISOString(), ZONA_ESTE, true).split(',')[0]
  const meetsHoy = S.leads.filter((l) => l.etapa === 'meet' && l.meet_inicio && horaEn(l.meet_inicio).split(',')[0] === hoyEste && new Date(l.meet_inicio) > Date.now() - 3600_000)
  return `
    <p class="ayuda" style="margin-top:0">Los que escriben a Mi Semago por WhatsApp. Ana Sofi les llama a la hora que pidieron, les da precios, pide sus datos y, si quieren, agenda el Google Meet con Eduardo.</p>
    ${meetsHoy.length ? `<div class="aviso-meet">${meetsHoy.map((l) => `<div>🎥 <b>Hoy ${h(horaEn(l.meet_inicio, ZONA_ESTE, false))}</b> · ${h(l.negocio || l.nombre)}</div><a class="btn principal chico" href="${h(l.meet_link)}" target="_blank" rel="noopener">Unirse al meeting</a>`).join('')}</div>` : ''}
    <div class="resumen-leads">
      ${['nuevo', 'programada', 'hablo', 'meet', 'cerrado'].map((e) => `<div><b>${cuenta(e)}</b><span>${ETAPAS_LEAD[e].t}</span></div>`).join('')}
    </div>
    <div class="barra"><input type="search" data-filtro="leadsBusca" value="${h(S.leadsBusca)}" placeholder="Buscar por nombre, negocio, ciudad, teléfono…" aria-label="Buscar leads"></div>
    ${
      S.leads.length
        ? `<div class="tablero-leads">${COLUMNAS_LEAD.map((e) => {
            const enCol = lista.filter((l) => l.etapa === e || (e === 'no_califica' && l.etapa === 'no_llamar'))
            return `<section class="col-lead"><h3 title="${h(ETAPAS_LEAD[e].ayuda)}">${ETAPAS_LEAD[e].t} <span>${enCol.length}</span></h3>${enCol.map(tarjetaLead).join('') || '<p class="ayuda vacia">—</p>'}</section>`
          }).join('')}</div>`
        : '<div class="vacio-msg">Todavía no hay leads. Llegan solos de WhatsApp en cuanto alguien termina el chat de Mi Semago.</div>'
    }`
}

function abrirLead(id) {
  const l = S.leads.find((x) => x.id === id)
  if (!l) return
  S.leadAbierto = id
  const dato = (t, v) => (v ? `<div class="dato"><span>${t}</span><b>${h(v)}</b></div>` : '')
  const notas = [...(l.leads_notas ?? [])].sort((a, b) => String(a.creada).localeCompare(String(b.creada)))
  const llamada =
    l.llamada_estado === 'marcando' ? 'Marcando…' : l.llamada_estado === 'en_llamada' ? 'En llamada ahora' : l.llamada_estado === 'no_salio' ? 'La llamada no salió' : ''
  abrirVentana(
    h(l.negocio || l.nombre || 'Lead'),
    `<div class="barra" style="margin-top:0"><span class="chip etapa-${l.etapa}">${ETAPAS_LEAD[l.etapa]?.t ?? l.etapa}</span>${l.calificacion ? `<span class="chip cal-${l.calificacion}">${CALIFICACION[l.calificacion]}</span>` : ''}${llamada ? `<span class="chip vivo">● ${llamada}</span>` : ''}</div>
    ${
      l.meet_inicio
        ? `<div class="meet-caja"><div><span>Google Meet con Eduardo</span><b>${horaLead(l.meet_inicio, l)}</b></div>${l.meet_link ? `<a class="btn principal" href="${h(l.meet_link)}" target="_blank" rel="noopener">🎥 Unirse al meeting</a>` : ''}</div>`
        : ''
    }
    <h3 class="sub">Datos</h3>
    <div class="datos">
      ${dato('Nombre', l.nombre)}${dato('Negocio', l.negocio)}${dato('Ciudad', l.ciudad)}
      ${l.telefono ? `<div class="dato"><span>Teléfono</span><b><a href="tel:${h(l.telefono.replace(/[^\d+]/g, ''))}">${h(l.telefono)}</a></b></div>` : ''}
      ${l.correo ? `<div class="dato"><span>Correo</span><b><a href="mailto:${h(l.correo)}">${h(l.correo)}</a></b></div>` : ''}
      ${dato('Idioma', l.idioma === 'en' ? 'Inglés' : 'Español')}${dato('Llegó', horaEn(l.creado))}${dato('De qué anuncio', l.fuente)}${l.origen === 'web' ? dato('Llegó por', 'misemago.com (WEBSITE LEADS)') : ''}
    </div>
    ${
      l.tipo_negocio || l.quesos || l.libras || l.frecuencia || l.marca_propia || l.precios
        ? `<h3 class="sub">Lo que contó en la llamada</h3><div class="datos">${dato('Tipo de negocio', l.tipo_negocio)}${dato('Quesos', l.quesos)}${dato('Libras', l.libras)}${dato('Cada cuánto', l.frecuencia)}${dato('Marca propia', l.marca_propia)}${dato('Precios que se le dieron', l.precios)}</div>`
        : ''
    }
    ${l.resumen ? `<h3 class="sub">Resumen de Ana Sofi</h3><div class="texto-contenido">${h(l.resumen)}</div>` : ''}
    <h3 class="sub">Llamadas</h3>
    <div class="datos">
      ${dato('Pidió que le llamaran', l.hora_pedida)}
      ${l.llamada_programada && ['nuevo', 'programada', 'no_contesto'].includes(l.etapa) ? `<div class="dato"><span>Próxima llamada</span><b>${horaLead(l.llamada_programada, l)}</b></div>` : ''}
      ${dato('Llamadas hechas', l.intentos ? String(l.intentos) : '')}
      ${l.ultima_llamada ? `<div class="dato"><span>Última llamada</span><b>${horaLead(l.ultima_llamada, l)}</b></div>` : ''}
      ${l.permiso_llamada ? `<div class="dato"><span>Permiso por escrito</span><b>“${h(l.permiso_texto || 'Sí')}” · ${h(horaEn(l.permiso_fecha))}</b></div>` : '<div class="dato"><span>Permiso por escrito</span><b>No dio permiso: no se le llama</b></div>'}
    </div>
    ${l.transcripcion ? `<details class="conversacion"><summary>Ver la conversación completa</summary><div class="texto-contenido">${h(l.transcripcion)}</div></details>` : ''}
    <h3 class="sub">Notas</h3>
    <div class="notas-lead">${notas.length ? notas.map((n) => `<div class="nota-lead"><b>${h(n.autor_nombre || 'Alguien')}</b> <span class="ayuda">${h(horaEn(n.creada))}</span><p>${h(n.texto)}</p></div>`).join('') : '<p class="ayuda">Todavía no hay notas.</p>'}</div>
    <form id="form-nota-lead" class="barra" style="align-items:flex-end">
      <textarea id="nl-texto" rows="2" maxlength="2000" required placeholder="Agregar una nota (todos los que ven Leads la verán)" style="flex:1;min-height:60px"></textarea>
      <button class="btn principal" data-ocupado="Guardando…">Agregar nota</button>
    </form>
    ${
      S.yo.dueno
        ? `<div class="barra" style="margin-top:14px;border-top:1px solid var(--linea);padding-top:12px">
        <label for="l-etapa" class="etiqueta" style="margin:0">Etapa</label>
        <select id="l-etapa" style="width:auto">${Object.entries(ETAPAS_LEAD).map(([k, v]) => `<option value="${k}" ${k === l.etapa ? 'selected' : ''}>${v.t}</option>`).join('')}</select>
        <button type="button" class="btn peligro" data-borrar-lead="${l.id}" style="margin-left:auto">Borrar lead</button>
      </div>`
        : ''
    }`,
    { alCerrar: () => (S.leadAbierto = null) },
  )
  $('#form-nota-lead').addEventListener('submit', async (e) => {
    e.preventDefault()
    await ocupado(e.submitter, async () => {
      try {
        await D.notaLead(l.id, $('#nl-texto').value)
        avisar('Nota agregada')
        await recargar()
      } catch (err) {
        falla(err)
      }
    })
  })
  $('#l-etapa')?.addEventListener('change', async (e) => {
    try {
      await D.etapaLead(l.id, e.target.value)
      avisar(`Ahora está en: ${ETAPAS_LEAD[e.target.value].t}`)
      await recargar()
    } catch (err) {
      falla(err)
      e.target.value = l.etapa
    }
  })
}

// -- usuarios (admin) ---------------------------------------------------------

function vistaUsuarios() {
  const orden = { admin: 0, equipo: 1, cliente: 2 }
  const lista = S.usuarios.filter((u) => !u.eliminado).sort((a, b) => orden[a.rol] - orden[b.rol] || a.nombre.localeCompare(b.nombre, 'es'))
  const eliminados = S.usuarios.filter((u) => u.eliminado).length
  const nombresEmp = (u) => (u.rol === 'admin' || !u.empresas ? 'Todas' : u.empresas.map((id) => empresa(id).nombre).join(', ') || 'Ninguna')
  const ve = (u) =>
    u.rol === 'admin'
      ? 'Todo'
      : [u.ve_tareas !== false && (u.rol === 'cliente' ? 'Sus tareas' : 'Tareas'), u.ve_biblioteca !== false && 'Biblioteca', u.ve_catalogos !== false && 'Catálogos', u.ve_parrilla !== false && 'Parrilla',  u.ve_parrilla !== false && u.pide_extras && 'Pide extras', u.ve_leads && 'Leads', u.rol === 'cliente' && u.ultron && 'Ultron'].filter(Boolean).join(', ') || 'Nada'
  return `
    <div class="barra"><button class="btn principal" data-accion="nuevo-usuario">+ Nuevo usuario</button></div>
    <div class="tabla-envoltura"><table class="tabla">
      <thead><tr><th>Nombre</th><th>Rol</th><th>Empresas</th><th>Puede ver</th><th></th></tr></thead>
      <tbody>${lista
        .map(
          (u) => `<tr class="${u.activo ? '' : 'apagado'}">
            <td><b>${h(u.nombre || '(sin nombre)')}</b><br><span class="ayuda">${u.usuario ? `Usuario: <b>${h(u.usuario)}</b>` : u.dueno ? h(u.correo) : 'Sin usuario: ponle uno en Editar'}</span>${u.usuario && u.correo ? `<br><span class="ayuda">${h(u.correo)}</span>` : ''}${u.activo ? '' : '<br><span class="chip urgente">Apagado</span>'}${u.activo && u.clave_temporal ? '<br><span class="chip" title="Todavía entra con la contraseña que le diste">Contraseña temporal</span>' : ''}</td>
            <td>${ROLES[u.rol]}${u.dueno ? ' principal' : ''}</td><td>${h(nombresEmp(u))}</td><td>${h(ve(u))}</td>
            <td style="white-space:nowrap">${u.id === S.yo.id ? '<span class="ayuda">Tú</span>' : u.dueno ? '<span class="ayuda">Solo él lo cambia</span>' : `<button class="btn chico" data-editar-usuario="${u.id}">Editar</button> <button class="btn chico" data-clave-usuario="${u.id}">✉️ Reenviar acceso</button>${S.yo.dueno ? ` <button class="btn chico peligro" data-eliminar-usuario="${u.id}">Eliminar</button>` : ''}`}</td>
          </tr>`,
        )
        .join('')}</tbody>
    </table></div>
    ${eliminados ? `<p class="ayuda">${eliminados} usuario${eliminados === 1 ? '' : 's'} eliminado${eliminados === 1 ? '' : 's'} con historial: ya no pueden entrar, pero sus tareas y archivos siguen diciendo de quién son.</p>` : ''}
    <div class="seccion" style="margin-top:16px">
      <h3>Empresas</h3>
      <p class="ayuda" style="margin-top:0">Apaga o prende una empresa para todos (por ejemplo, VAYRO cuando entre).</p>
      ${[...S.empresas].sort((a, b) => a.orden - b.orden).map((e) => `<label class="casilla"><input type="checkbox" data-empresa-activa="${e.id}" ${e.activa ? 'checked' : ''}> <span class="punto" style="--color-emp:${color(e.id)}"></span> ${h(e.grupo ? `${e.grupo} · ` : '')}${h(e.nombre)}</label>`).join('')}
    </div>`
}

function claveAlAzar() {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789'
  const r = new Uint32Array(6)
  crypto.getRandomValues(r)
  return [...r].map((n) => letras[n % letras.length]).join('')
}

const campoClave = (id, { valor = '', requerida = true, etiqueta = 'Contraseña' } = {}) =>
  `<div class="campo"><label for="${id}">${etiqueta}</label><div style="display:flex;gap:6px"><input id="${id}" type="text" value="${h(valor)}" minlength="${CLAVE_MINIMA}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="La que tú quieras (mínimo ${CLAVE_MINIMA})" ${requerida ? 'required' : ''}><button type="button" class="btn" data-otra-clave="${id}" title="Una al azar">↻</button></div><span class="ayuda">Al entrar le ofrecemos cambiarla por una suya.</span></div>`

function formUsuario(id) {
  const u = id ? S.usuarios.find((x) => x.id === id) : null
  const emps = [...S.empresas].sort((a, b) => a.orden - b.orden)
  const todas = !u || !u.empresas
  abrirVentana(
    u ? `Editar a ${h(u.nombre)}` : 'Nuevo usuario',
    `<form id="form-usuario">
      <div class="campo"><label for="u-nombre">Nombre</label><input id="u-nombre" type="text" value="${h(u?.nombre ?? '')}" required></div>
      <div class="campo"><label for="u-usuario">Usuario (con este entra)</label><input id="u-usuario" type="text" value="${h(u?.usuario ?? '')}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="por ejemplo: senen" required><span class="ayuda">${u && !u.usuario ? 'Todavía no tiene usuario: ponle uno y una contraseña.' : 'Sin espacios ni acentos (se acomoda solo).'}</span></div>
      ${campoClave('u-clave', { requerida: !u || !u.usuario, etiqueta: u ? (u.usuario ? 'Contraseña nueva (déjala vacía para no cambiarla)' : 'Contraseña') : 'Contraseña' })}
      <div class="campo"><label for="u-correo">Correo (opcional)</label><input id="u-correo" type="email" value="${h(u?.correo ?? '')}" autocapitalize="none" placeholder="para mandarle su acceso y archivos"></div>
      <label class="casilla" id="u-mandar-fila" style="margin-bottom:10px" hidden><input type="checkbox" id="u-mandar" checked> Mandarle su acceso a ese correo (link, usuario y contraseña)</label>
      <div class="campo"><label for="u-rol">Rol</label><select id="u-rol">
        <option value="cliente" ${u?.rol === 'cliente' || !u ? 'selected' : ''}>Cliente (pide tareas, ve y descarga)</option>
        <option value="equipo" ${u?.rol === 'equipo' ? 'selected' : ''}>Equipo (trabaja las tareas, sube y organiza)</option>
      </select></div>
      <div id="u-permisos" class="seccion" style="padding:10px 12px;margin:4px 0 8px">
        <div class="etiqueta" style="margin-top:0">Permisos · a qué tiene acceso</div>
        <div class="etiqueta">Empresas que ve</div>
        <label class="casilla"><input type="checkbox" id="u-todas" ${todas ? 'checked' : ''}> Todas</label>
        <div id="u-lista" ${todas ? 'hidden' : ''} style="padding-left:18px">${emps.map((e) => `<label class="casilla"><input type="checkbox" data-u-emp="${e.id}" ${u?.empresas?.includes(e.id) ? 'checked' : ''}> ${h(e.nombre)}</label>`).join('')}</div>
        <div class="etiqueta" style="margin-top:8px">Secciones</div>
        <label class="casilla"><input type="checkbox" id="u-tareas" ${u?.ve_tareas !== false ? 'checked' : ''}> <span id="u-tareas-txt">Tareas</span></label>
        <label class="casilla"><input type="checkbox" id="u-bib" ${u?.ve_biblioteca !== false ? 'checked' : ''}> Biblioteca</label>
        <label class="casilla"><input type="checkbox" id="u-cat" ${u?.ve_catalogos !== false ? 'checked' : ''}> Catálogos</label>
        <label class="casilla"><input type="checkbox" id="u-parrilla" ${u?.ve_parrilla !== false ? 'checked' : ''}> Parrilla de contenidos</label>
        <label class="casilla" style="padding-left:22px"><input type="checkbox" id="u-extras" ${u?.pide_extras ? 'checked' : ''}> Puede pedir extras en la Parrilla (este mes y el siguiente)</label>
        <label class="casilla"><input type="checkbox" id="u-leads" ${u?.ve_leads ? 'checked' : ''}> Leads de Mi Semago (ve todo, el link del Meet y agrega notas)</label>
        <div id="u-direccion">
          <div class="etiqueta" style="margin-top:8px">Dirección</div>
          <label class="casilla"><input type="checkbox" id="u-ultron" ${u?.ultron ? 'checked' : ''}> Habla con Ultron (dueños y gerentes)</label>
        </div>
      </div>
      ${u ? `<label class="casilla" style="margin-top:8px"><input type="checkbox" id="u-activo" ${u.activo ? 'checked' : ''}> Puede entrar (desmárcalo para quitarle el acceso)</label>` : ''}
      <button class="btn principal" style="margin-top:12px" data-ocupado="Guardando…">${u ? 'Guardar' : 'Crear usuario'}</button>
    </form>`,
    { chica: true },
  )
  // Los permisos aplican a clientes y equipo; Ultron, solo a clientes (la dirección).
  const permisos = () => {
    const cliente = $('#u-rol').value === 'cliente'
    $('#u-direccion').hidden = !cliente
    $('#u-tareas-txt').textContent = cliente ? 'Sus tareas (pedir, corregir, aprobar)' : 'Tareas (trabajarlas: estatus, PDFs, actualizaciones)'
  }
  const extras = () => {
    $('#u-extras').disabled = !$('#u-parrilla').checked
    if (!$('#u-parrilla').checked) $('#u-extras').checked = false
  }
  permisos()
  extras()
  $('#u-rol').addEventListener('change', permisos)
  $('#u-parrilla').addEventListener('change', extras)
  $('#u-todas').addEventListener('change', () => ($('#u-lista').hidden = $('#u-todas').checked))
  // El usuario sale solo del nombre ("Senén Ramos" → "senen") mientras no lo escriban a mano.
  let usuarioAMano = Boolean(u?.usuario)
  const sugerir = () => {
    if (!usuarioAMano) $('#u-usuario').value = normalizarUsuario($('#u-nombre').value.trim().split(/\s+/)[0])
  }
  if (!u?.usuario) sugerir()
  $('#u-nombre').addEventListener('input', sugerir)
  $('#u-usuario').addEventListener('input', () => (usuarioAMano = true))
  $('#u-usuario').addEventListener('blur', () => ($('#u-usuario').value = normalizarUsuario($('#u-usuario').value)))
  // Mandar el acceso solo tiene sentido con correo y contraseña.
  const mandarFila = () => ($('#u-mandar-fila').hidden = !$('#u-correo').value.trim() || !$('#u-clave').value.trim())
  mandarFila()
  $('#u-correo').addEventListener('input', mandarFila)
  $('#u-clave').addEventListener('input', mandarFila)
  $('#form-usuario').addEventListener('submit', async (e) => {
    e.preventDefault()
    const datos = {
      nombre: $('#u-nombre').value.trim(),
      rol: $('#u-rol').value,
      empresas: $('#u-todas').checked ? null : [...document.querySelectorAll('[data-u-emp]:checked')].map((x) => x.dataset.uEmp),
      ve_tareas: $('#u-tareas').checked,
      ve_biblioteca: $('#u-bib').checked,
      ve_catalogos: $('#u-cat').checked,
      ve_parrilla: $('#u-parrilla').checked,
      pide_extras: $('#u-parrilla').checked && $('#u-extras').checked,
      ve_leads: $('#u-leads').checked,
      ultron: $('#u-rol').value === 'cliente' && $('#u-ultron').checked,
    }
    const usuario = normalizarUsuario($('#u-usuario').value)
    const correo = $('#u-correo').value.trim().toLowerCase()
    const clave = $('#u-clave').value.trim()
    const mandar = !$('#u-mandar-fila').hidden && $('#u-mandar').checked
    await ocupado(e.submitter, async () => {
      try {
        let r = null
        if (u) {
          if (usuario !== (u.usuario ?? '') || correo !== (u.correo ?? '') || clave) r = await D.cambiarAcceso(u.id, { usuario, correo, clave, mandar })
          await D.cambiarUsuario(u.id, { ...datos, activo: $('#u-activo').checked })
        } else {
          r = await D.crearUsuario({ ...datos, usuario, correo, clave, mandar })
        }
        cerrarVentana()
        await recargar()
        if (r?.clave) datosDeAcceso(datos.nombre, r)
        else avisar(r ? `Guardado. Entra con el usuario ${r.usuario}.` : 'Guardado')
      } catch (err) {
        falla(err)
      }
    })
  })
}

function formClave(id) {
  const u = S.usuarios.find((x) => x.id === id)
  abrirVentana(
    `Reenviar acceso a ${h(u.nombre)}`,
    `<form id="form-clave">
      <p style="margin-top:0">${u.usuario ? `Entra con el usuario <b>${h(u.usuario)}</b>. ` : ''}Su contraseña de antes nadie la conoce (ni tú), así que le ponemos una nueva y se la mandas.</p>
      ${campoClave('k-clave', { valor: claveAlAzar(), etiqueta: 'Contraseña nueva' })}
      ${u.correo ? `<label class="casilla" style="margin-bottom:10px"><input type="checkbox" id="k-mandar" checked> Mandárselo a su correo (${h(u.correo)})</label>` : '<p class="ayuda">No tiene correo: al terminar te enseño sus datos para mandárselos por WhatsApp.</p>'}
      <button class="btn principal" data-ocupado="Enviando…">Reenviar acceso</button>
    </form>`,
    { chica: true },
  )
  $('#form-clave').addEventListener('submit', async (e) => {
    e.preventDefault()
    await ocupado(e.submitter, async () => {
      try {
        const r = await D.cambiarClave(u.id, $('#k-clave').value.trim(), Boolean($('#k-mandar')?.checked))
        cerrarVentana()
        await recargar()
        datosDeAcceso(u.nombre, r)
      } catch (err) {
        falla(err)
      }
    })
  })
}

async function eliminarUsuario(id, boton) {
  const u = S.usuarios.find((x) => x.id === id)
  const ok = await preguntar(
    `Eliminar a ${u.nombre}`,
    `Ya no podrá entrar${u.usuario ? ` y el usuario "${u.usuario}" quedará libre` : ''}. Si ya pidió o subió algo, sus tareas y archivos se quedan (no se borra nada de eso). ¿Seguro?`,
    { boton: 'Eliminar', peligro: true },
  )
  if (!ok) return
  await ocupado(boton, async () => {
    try {
      const r = await D.eliminarUsuario(id)
      await recargar()
      avisar(r.borrado ? `${u.nombre} quedó eliminado.` : `${u.nombre} quedó eliminado. Sus tareas y archivos se quedan con su nombre.`)
    } catch (err) {
      falla(err)
    }
  })
}

/** Después de crear a alguien o cambiarle la contraseña: sus datos, listos para mandárselos. */
function datosDeAcceso(nombre, r) {
  const enlace = MUESTRA ? 'https://centro-misemago-abuelito.netlify.app' : location.origin
  const texto = `Hola ${primerNombre(nombre)}, este es tu acceso al Centro de trabajo Mi Semago · Abuelito:\n${enlace}\nUsuario: ${r.usuario}\nContraseña: ${r.clave}\nAl entrar puedes cambiar la contraseña por una tuya.`
  const correo = r.enviado
    ? `<p class="ayuda">✉️ Se lo mandé a ${h(r.para)}.${MUESTRA ? ' (En la muestra no sale correo de verdad.)' : ''}</p>`
    : r.aviso
      ? `<p class="error">${h(r.aviso)}</p>`
      : '<p class="ayuda">Mándaselos por WhatsApp:</p>'
  abrirVentana(
    `Acceso de ${h(nombre)}`,
    `${correo}
    <table class="tabla" style="margin:8px 0 14px"><tbody>
      <tr><td>Página</td><td><b>${h(enlace)}</b></td></tr>
      <tr><td>Usuario</td><td><b style="font-size:17px">${h(r.usuario)}</b></td></tr>
      <tr><td>Contraseña</td><td><b style="font-size:17px">${h(r.clave)}</b></td></tr>
    </tbody></table>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button type="button" class="btn principal" data-copiar-acceso>📋 Copiar para WhatsApp</button>
      <button type="button" class="btn" data-accion="cerrar">Listo</button>
    </div>`,
    { chica: true },
  )
  $('[data-copiar-acceso]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(texto)
      avisar('Copiado. Pégalo en WhatsApp.')
    } catch {
      avisar('No se pudo copiar. Cópialo a mano.', true)
    }
  })
}

// -- mi contraseña (todos) -----------------------------------------------------

/** Si la contraseña se la puso el admin, al entrar se le ofrece cambiarla (una vez por sesión). */
function ofrecerCambiarClave() {
  if (!S.yo?.clave_temporal) return
  const llave = `crm-clave-luego-${S.yo.id}`
  try {
    if (sessionStorage.getItem(llave)) return
  } catch {}
  formMiClave({
    bienvenida: true,
    luego: () => {
      try {
        sessionStorage.setItem(llave, '1')
      } catch {}
    },
  })
}

function formMiClave({ bienvenida = false, luego } = {}) {
  abrirVentana(
    bienvenida ? `Hola, ${h(S.yo.nombre.split(' ')[0])}` : 'Mi contraseña',
    `<form id="form-mi-clave">
      ${bienvenida ? '<p style="margin-top:0">Entraste con la contraseña que te dio el administrador. Te recomendamos cambiarla por una que solo tú sepas.</p>' : ''}
      <div class="campo"><label for="m-clave">Contraseña nueva</label><input id="m-clave" type="password" autocomplete="new-password" minlength="${CLAVE_MINIMA}" required><span class="ayuda">La que tú quieras (mínimo ${CLAVE_MINIMA}). Entre más larga, más segura.</span></div>
      <div class="campo"><label for="m-clave2">Escríbela otra vez</label><input id="m-clave2" type="password" autocomplete="new-password" minlength="${CLAVE_MINIMA}" required></div>
      <label class="casilla" style="margin-bottom:10px"><input type="checkbox" id="m-ver"> Mostrar</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn principal" data-ocupado="Guardando…">Cambiar contraseña</button>
        ${bienvenida ? '<button type="button" class="btn" data-accion="clave-luego">Ahora no</button>' : ''}
      </div>
    </form>`,
    { chica: true, alCerrar: luego },
  )
  $('#m-ver').addEventListener('change', () => document.querySelectorAll('#m-clave, #m-clave2').forEach((x) => (x.type = $('#m-ver').checked ? 'text' : 'password')))
  $('[data-accion="clave-luego"]')?.addEventListener('click', () => cerrarVentana())
  $('#form-mi-clave').addEventListener('submit', async (e) => {
    e.preventDefault()
    const clave = $('#m-clave').value.trim()
    if (clave !== $('#m-clave2').value.trim()) return falla(new Error('Las dos contraseñas no son iguales'))
    await ocupado(e.submitter, async () => {
      try {
        await D.cambiarMiClave(clave)
        S.yo.clave_temporal = false
        cerrarVentana()
        avisar('Listo. Desde ahora entras con tu contraseña nueva.')
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

const NOMBRE_TABLA = { leads: 'lead', leads_notas: 'nota de lead', plan: 'plan de la parrilla', contenidos: 'contenido', tareas: 'tarea', correcciones: 'corrección', notas: 'actualización', archivos: 'archivo', carpetas: 'carpeta', perfiles: 'usuario', empresas: 'empresa' }
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
      S.hoja = null
      Object.assign(S, { filtroCliente: '', filtroEmpresa: '', busca: '', bibBusca: '', bibCarpeta: null })
      await empezar()
      return
    }
    if (d.vista) {
      if (!$('#modal').hidden) cerrarVentana()
      const otra = S.vista !== d.vista
      S.vista = d.vista
      pintar()
      if (otra) scrollTo(0, 0)
      if (otra) verFondo()
      return
    }
    if (d.parrillaMes !== undefined) {
      const paso = Number(d.parrillaMes)
      const m = paso === 0 ? new Date() : new Date(S.parrillaMes.getFullYear(), S.parrillaMes.getMonth() + paso, 1)
      S.parrillaMes = new Date(m.getFullYear(), m.getMonth(), 1)
      pintarVista()
      return
    }
    if (d.marca) {
      S.parrillaMarca = d.marca
      S.parrillaEmpresa = ''
      S.parrillaTipo = ''
      pintarVista()
      return
    }
    if (d.parrillaTipo !== undefined) {
      S.parrillaTipo = S.parrillaTipo === d.parrillaTipo ? '' : d.parrillaTipo
      pintarVista()
      return
    }
    if (d.borrarExtra) {
      const x = S.plan.find((p) => p.id === d.borrarExtra)
      if (!(await preguntar('Borrar extra', `Se quita "${x?.nombre}" de lo que se espera ese mes. Los contenidos que ya lo tenían se quedan sin tipo. ¿Seguro?`, { boton: 'Borrar', peligro: true }))) return
      await ocupado(b, () => D.borrarExtra(d.borrarExtra))
      avisar('Extra borrado')
      await recargar()
      return
    }
    if (d.lead) return abrirLead(d.lead)
    if (d.borrarLead) {
      const l = S.leads.find((x) => x.id === d.borrarLead)
      if (!(await preguntar('Borrar lead', `Se borra ${l?.negocio || l?.nombre || 'este lead'} con sus notas. No se puede deshacer. ¿Seguro?`, { boton: 'Borrar', peligro: true }))) return
      await ocupado(b, () => D.borrarLead(d.borrarLead))
      cerrarVentana()
      avisar('Lead borrado')
      await recargar()
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
    if (d.leadsGrupo) {
      S.leadsGrupo = d.leadsGrupo
      pintarVista()
      return
    }
    if (d.hoja) {
      S.hoja = d.hoja
      S.busca = ''
      pintarVista()
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
    if (d.correoTodos) {
      const ids = d.correoTodos.split(',').filter(Boolean)
      await ocupado(b, async () => {
        const r = await D.correoVarios(ids)
        avisar(r.aviso || `Te mandé los ${ids.length} archivos juntos a ${r.para}. Revisa tu correo en un minuto.`)
      })
      return
    }
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
    if (d.otraClave) {
      const campo = $(`#${d.otraClave}`)
      campo.value = claveAlAzar()
      campo.dispatchEvent(new Event('input'))
      return
    }
    if (d.webFiltro !== undefined) {
      S.webEstatus = d.webFiltro
      pintarVista()
      return
    }
    if (d.notasWeb) return formNotasWeb(d.notasWeb)
    if (d.borrarWeb) {
      const x = S.web.find((v) => v.id === d.borrarWeb)
      if (!x || !(await preguntar('Borrar website lead', `¿Borrar la solicitud de ${x.nombre}? No se puede deshacer.`, { boton: 'Borrar', peligro: true }))) return
      await D.borrarWebLead(x.id)
      avisar('Lead borrado')
      await recargar()
      return
    }
    if (d.fiestaEmpresa !== undefined) {
      S.fiestaEmpresa = d.fiestaEmpresa
      pintarVista()
      return
    }
    if (d.borrarInvitado) {
      const x = S.fiesta.find((v) => v.id === d.borrarInvitado)
      if (!x || !(await preguntar('Borrar confirmación', `¿Borrar a ${x.nombre} de la lista de la fiesta?`, { boton: 'Borrar', peligro: true }))) return
      await D.borrarInvitado(x.id)
      avisar('Borrado de la lista')
      await recargar()
      return
    }
    if (d.editarUsuario) return formUsuario(d.editarUsuario)
    if (d.claveUsuario) return formClave(d.claveUsuario)
    if (d.eliminarUsuario) return eliminarUsuario(d.eliminarUsuario, b)
    if (d.empresaActiva) return

    switch (d.accion) {
      case 'cerrar':
        return cerrarVentana()
      case 'mi-clave':
        return formMiClave()
      case 'salir':
        desmontarUltron()
        await D.salir()
        S.yo = null
        return pintarEntrada()
      case 'cambiar-muestra':
        desmontarUltron()
        S.yo = null
        return pintarEntrada()
      case 'copiar-fiesta':
        try {
          await navigator.clipboard.writeText(FIESTA_URL())
          avisar('Enlace copiado. Pégalo en WhatsApp.')
        } catch {
          avisar(`Cópialo a mano: ${FIESTA_URL()}`, true)
        }
        return
      case 'csv-web':
        return csvWeb()
      case 'recargar-web':
        await recargar()
        avisar('Website leads al día')
        return
      case 'csv-fiesta':
        return csvFiesta()
      case 'nueva-tarea':
        return formNuevaTarea()
      case 'abrir-nota':
        $('#form-nota').hidden = false
        b.hidden = true
        $('#n-texto').focus()
        return
      case 'recibir-tarea':
        await ocupado(b, () => D.cambiarTarea(S.abierta, { estatus: 'en-proceso' }))
        avisar('Recibida: pasó a “En proceso”')
        await recargar()
        return
      case 'menu-movil':
        abrirMenuMovil()
        return
      case 'ultron-movil':
        document.querySelector('.orbe')?.click()
        return
      case 'ver-fondo':
        if (!$('#modal').hidden) cerrarVentana()
        verFondo(2500)
        return
      case 'filtros-movil':
        S.filtrosMovil = !S.filtrosMovil
        pintarVista()
        return
      case 'm-correccion': {
        const caja = $('#caja-correccion')
        caja?.classList.add('abierta')
        caja?.querySelector('[data-accion="abrir-correccion"]')?.click()
        caja?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
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
      case 'pedir-extra':
        return formExtra()
      case 'plan-fijo':
        return formFijo()
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
      if (e.type === 'change' || d.filtro === 'busca' || d.filtro === 'bibBusca' || d.filtro === 'fiestaBusca' || d.filtro === 'leadsBusca' || d.filtro === 'webBusca') {
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
    if (d.webEstatus) {
      await D.cambiarWebLead(d.webEstatus, { estatus: el.value })
      avisar(`Estatus: ${ESTATUS_WEB[el.value]}`)
      await recargar()
      return
    }
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
    if (['busca', 'bibBusca', 'leadsBusca'].includes(e.target.dataset.filtro)) alCambiar(e)
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
