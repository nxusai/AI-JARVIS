// NXUS HQ: la empresa en un solo lugar.
//
// Una sola página, sin dependencias. Las pantallas se arman con la persona que
// entró: Eduardo (admin) ve todo; el equipo ve los clientes sin dinero, el
// equipo, sus tareas y su propio reloj. Las reglas de verdad están en la base
// de datos (supabase/esquema.sql); aquí solo se esconde lo que no le toca.

import { fraseDelDia, saludo } from './frases.js'
import { vistaAnuncios } from './anuncios.js'
import { vistaFinanzas, editarPlanCliente, describirPlan, planCliente } from './finanzas.js'
import { editarPermisos, matrizPermisos, alternar, plantillaDe, estadoAcceso, NOMBRE as NOMBRE_PERMISO, CORTO as CORTO_PERMISO } from './permisos.js'

const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const h = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const LOGO = `<svg viewBox="160 310 950 620" aria-hidden="true"><defs><linearGradient id="lg" gradientUnits="userSpaceOnUse" x1="177" y1="0" x2="1090" y2="0"><stop offset="0" stop-color="#00e5ff"/><stop offset=".5" stop-color="#0a6cff"/><stop offset="1" stop-color="#a01cff"/></linearGradient></defs><g fill="url(#lg)"><polygon points="177,326 305,326 645,717 558,816 294,497 294,916 177,916"/><polygon points="496,394 663,394 1080,916 928,916"/><polygon points="943,394 1090,394 642,916 484,916"/></g></svg>`

const ESTADOS = { prospecto: 'Prospecto', activo: 'Activo', pausado: 'Pausado', terminado: 'Terminado' }
const TAREA = { pendiente: 'Pendiente', 'en-curso': 'En curso', hecha: 'Hecha' }
const SEDE = { usa: 'NXUS USA', mexico: 'NXUS MÉXICO' }
const ESQUEMA = { fijo: 'Sueldo fijo', 'medio-tiempo': 'Medio tiempo', comision: 'Comisión' }
const ETAPAS = {
  abrio: 'Abrió su link',
  datos: 'Dejó sus datos',
  pagado: 'Pagó consultoría',
  cita: 'Cita agendada',
  reunion: 'Reunión hecha',
  propuesta: 'Propuesta enviada',
  cliente: 'Cliente',
  perdido: 'Perdido',
}
// Leads de los anuncios (ManyChat → HQ → llamada de NEX).
const LEAD = { incompleto: 'No calificado', nuevo: 'Por llamar', llamando: 'NEX llamando', agendado: 'Agendó meeting', cartera: 'En cartera', no_llamar: 'No llamar' }
const MOTIVO = { no_contesto: 'No contestó', no_interesa: 'Ya no le interesa', colgo: 'Colgó', ahora_no: 'Ahora no', numero_malo: 'Número equivocado', sin_permiso: 'Sin permiso de llamada' }
const CANAL = { instagram: 'Instagram', facebook: 'Facebook' }
const PAIS = { mexico: 'México', usa: 'USA', otro: 'Otro país' }
// Lo que NEX anota en la llamada (lead.puntos), en el orden en que se lee.
const PUNTOS = { empresa: 'Su empresa', necesidad: 'Lo que necesita', usa_hoy: 'Cómo lo hace hoy', decide: '¿Decide?', urgencia: 'Urgencia', presupuesto: 'Presupuesto', consejo: 'Lo que NEX le aconsejó', otro: 'Otro' }
const EN_CURSO = ['abrio', 'datos', 'pagado', 'cita', 'reunion', 'propuesta']
const VER_PROS = { nada: 'No ve prospectos', suyos: 'Solo los suyos (de su link o que tú le asignes)', todos: 'Todos' }
const PORTAL = 'https://empezar.nxusai.org'
const META_USD = 20000
const DIA_COMPLETO_HORAS = 7
const JORNADA_COMPLETA = 8

/**
 * Lo que vale un día completo de medio tiempo, si Eduardo no puso un monto:
 * su pago por hora (lo de la quincena entre las horas de una quincena, 15/7
 * de semana) por las horas que trabaja de más ese día (8 menos las de un día
 * normal). Ángeles: 2,500 / (20 × 15/7) = 58.33 la hora; 4 horas más = 233.33.
 */
function valorDiaCompleto(n) {
  if (Number(n.pago_dia_completo) > 0) return Number(n.pago_dia_completo)
  const horasDia = Number(n.horas_semana || 40) / 5
  const porHora = Number(n.monto_quincena || 0) / (Number(n.horas_semana || 40) * (15 / 7))
  return Math.round(Math.max(0, JORNADA_COMPLETA - horasDia) * porHora * 100) / 100
}

const dinero = (n, moneda = 'USD') =>
  `${moneda === 'MXN' ? 'MX$' : '$'}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const fechaCorta = (s) => (s ? new Date(s.length === 10 ? `${s}T12:00` : s).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '')
const hora = (s) => (s ? new Date(s).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : '')
const horas = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000))
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}
const duracion = (j) => (j.salida ? new Date(j.salida) - new Date(j.entrada) : Date.now() - new Date(j.entrada))
const iniciales = (n) =>
  String(n || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
const hoyISO = () => new Date().toISOString().slice(0, 10)
const fechaHora = (s) => (s ? new Date(s).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')
/** "Juan Pérez" → "juan-perez", para el link del portal. */
const slug = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
/** Lo cobrado por consultorías en el mes de una fecha, por moneda. */
function cobradoMes(pagos, ref = new Date()) {
  const r = { USD: 0, MXN: 0 }
  for (const g of pagos) {
    const d = new Date(g.fecha)
    if (d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()) r[g.moneda] += Number(g.monto || 0)
  }
  return r
}

/** La quincena que contiene una fecha: del 1 al 15, o del 16 al último día. */
function quincena(ref = new Date(), salto = 0) {
  let y = ref.getFullYear()
  let m = ref.getMonth()
  let primera = ref.getDate() <= 15
  for (let i = 0; i < Math.abs(salto); i++) {
    if (salto < 0) {
      if (primera) {
        m -= 1
        primera = false
      } else primera = true
    } else if (primera) primera = false
    else {
      m += 1
      primera = true
    }
  }
  const desde = new Date(y, m, primera ? 1 : 16)
  const hasta = primera ? new Date(y, m, 16) : new Date(y, m + 1, 1)
  const nombre = `${primera ? '1–15' : `16–${new Date(y, m + 1, 0).getDate()}`} de ${desde.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}`
  return { desde, hasta, nombre }
}

/** Los días completos de una persona en un periodo: marcados por Eduardo o de 7 horas o más. */
function diasCompletos(jornadas, persona) {
  const dias = new Set()
  for (const j of jornadas) if (j.persona === persona && (j.dia_completo || (j.salida && duracion(j) >= DIA_COMPLETO_HORAS * 3600000))) dias.add(j.entrada.slice(0, 10))
  return dias.size
}

/** Lo que se le paga a alguien en un periodo, con su desglose. */
function calcularPago(n, { jornadas, ajustes, comisiones, desde, hasta }) {
  const enRango = (f) => {
    const d = new Date(f.length === 10 ? `${f}T12:00` : f)
    return d >= desde && d < hasta
  }
  const trabajado = jornadas.filter((j) => j.persona === n.persona).reduce((s, j) => s + duracion(j), 0)
  const completos = n.esquema === 'medio-tiempo' ? diasCompletos(jornadas, n.persona) : 0
  const base = n.esquema === 'comision' ? 0 : Number(n.monto_quincena || 0)
  const extra = completos * valorDiaCompleto(n)
  const mias = comisiones.filter((c) => c.persona === n.persona && enRango(c.fecha))
  const comision = mias.reduce((s, c) => s + (Number(c.monto_cobrado) * Number(c.porcentaje)) / 100, 0)
  const misAjustes = ajustes.filter((a) => a.persona === n.persona && enRango(a.fecha))
  const ajuste = misAjustes.reduce((s, a) => s + Number(a.monto), 0)
  return { trabajado, completos, base, extra, comision, ajuste, total: base + extra + comision + ajuste, misAjustes, mias }
}

export function iniciar(D, { muestra = false } = {}) {
  const app = $('#app')
  const modal = $('#modal')
  let yo = null
  let personas = []
  let clientes = []
  let abierta = null
  let reloj = null

  const aviso = (texto, tipo = 'ok') => {
    const el = document.createElement('div')
    el.className = `aviso ${tipo}`
    el.textContent = texto
    $('#avisos').append(el)
    setTimeout(() => el.remove(), 4200)
  }
  const intenta = async (fn, bien) => {
    try {
      const r = await fn()
      if (bien) aviso(bien)
      return r
    } catch (err) {
      aviso(err.message || String(err), 'mal')
      return undefined
    }
  }
  const esAdmin = () => yo?.rol === 'admin'
  /** Lo que Eduardo le dio en Personas → Permisos (el admin puede todo). La base de datos lo hace cumplir. */
  const puede = (k) => esAdmin() || (yo?.permisos ?? []).includes(k)
  // Prospectos: lo que Eduardo le dio a cada quien en Personas (la base de datos lo hace cumplir).
  const vePros = () => esAdmin() || (yo?.pros_ver ?? 'nada') !== 'nada'
  const puedePros = (que) => esAdmin() || !!yo?.[`pros_${que}`]
  const persona = (pid) => personas.find((p) => p.id === pid)
  const nombreDe = (pid) => persona(pid)?.nombre ?? '—'
  const clienteDe = (cid) => clientes.find((c) => c.id === cid)

  function abrirModal(html, alMontar) {
    modal.innerHTML = `<div class="fondo"></div><div class="caja" role="dialog" aria-modal="true">${html}</div>`
    modal.hidden = false
    $('.fondo', modal).onclick = cerrarModal
    $$('[data-cerrar]', modal).forEach((b) => (b.onclick = cerrarModal))
    alMontar?.($('.caja', modal))
    // Un solo envío a la vez: el botón se bloquea mientras trabaja (evita guardar o subir dos veces).
    $$('form', modal).forEach((f) =>
      f.addEventListener('submit', () => {
        const b = $('button:not([type=button])', f)
        if (!b) return
        const antes = b.textContent
        b.disabled = true
        b.textContent = 'Un momento…'
        setTimeout(() => {
          if (!b.isConnected) return
          b.disabled = false
          b.textContent = antes
        }, 6000)
      }),
    )
    $('input, textarea, select', modal)?.focus()
  }
  function cerrarModal() {
    modal.hidden = true
    modal.innerHTML = ''
  }
  addEventListener('keydown', (e) => e.key === 'Escape' && !modal.hidden && cerrarModal())

  async function avatar(p, clase = '') {
    const url = p?.foto ? await D.fotoUrl(p.foto) : ''
    return url ? `<img class="avatar ${clase}" src="${h(url)}" alt="">` : `<span class="avatar ${clase}">${h(iniciales(p?.nombre))}</span>`
  }

  // ------------------------------------------------------------- entrada

  async function pantallaEntrada(error = '') {
    clearInterval(reloj)
    app.innerHTML = `
      <div class="entrada">
        <div class="entrada-caja">
          <div class="marca">${LOGO}<div><b>NXUS HQ</b><span>La empresa en un solo lugar</span></div></div>
          ${
            muestra
              ? `<p class="nota">Muestra: entra como cualquier persona para ver lo que cada quien ve.</p>
                 <div class="como">${D.usuariosMuestra().map((u) => `<button class="btn" data-como="${h(u.id)}"><b>${h(u.nombre)}</b><span>${h(u.cargo)}</span></button>`).join('')}</div>`
              : `<form id="f-entrar">
                  <label>Usuario<input name="correo" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder="tu usuario (o tu correo)"></label>
                  <label>Contraseña<input name="clave" type="password" autocomplete="current-password" required></label>
                  ${error ? `<p class="error">${h(error)}</p>` : ''}
                  <button class="btn primario">Entrar</button>
                  <button type="button" class="enlace" id="olvide">¿Olvidaste tu contraseña?</button>
                </form>`
          }
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
        const correo = $('[name=correo]', f).value.trim()
        if (!correo) return aviso('Escribe tu usuario arriba primero', 'mal')
        if (!correo.includes('@')) return aviso('Pídele a Eduardo una contraseña nueva: te llega a tu correo.', 'mal')
        intenta(() => D.olvide(correo), 'Te mandamos un correo para cambiar tu contraseña')
      }
    }
  }

  // ---------------------------------------------------------- el marco

  const SECCIONES = [
    ['inicio', 'Inicio', '◈'],
    ['clientes', 'Clientes', '◉'],
    ['prospectos', 'Prospectos', '✦'],
    ['leads', 'Leads', '⚡'],
    ['anuncios', 'Anuncios', '📈'],
    ['cartera', 'Cartera', '◌'],
    ['tareas', 'Tareas', '☰'],
    ['equipo', 'Equipo', '◎'],
    ['reloj', 'Mi reloj', '◷'],
  ]
  const misSecciones = () => SECCIONES.filter(([id]) => !['prospectos', 'leads', 'anuncios', 'cartera'].includes(id) || vePros())
  // Lo personal de Eduardo: nunca se comparte, con ningún permiso.
  const SECCIONES_ADMIN = [
    ['pendientes', 'Mis pendientes', '✓'],
    ['metas', 'Metas y hábitos', '◎'],
  ]
  // Administración: Eduardo siempre; los demás solo con el permiso.
  const SECCIONES_PERMISO = [
    ['finanzas', 'Finanzas', '$', () => puede('finanzas_ver')],
    ['nomina', 'Nómina', '⧉', () => puede('nomina_ver') || puede('asistencia_ver')],
    ['personas', 'Personas', '⚙', () => puede('personas_gestionar')],
    ['bitacora', 'Bitácora', '≡', () => puede('bitacora_ver')],
  ]
  const conPermiso = () => SECCIONES_PERMISO.filter((x) => x[3]())

  async function arrancar(perfil) {
    yo = perfil
    if (!yo) return pantallaEntrada()
    ;[personas, clientes] = await Promise.all([D.personas(), D.clientes()])
    abierta = (await D.abiertas()).find((j) => j.persona === yo.id) ?? null
    app.innerHTML = `
      <div class="hq">
        <aside class="nav">
          <div class="marca">${LOGO}<div><b>NXUS HQ</b><span>${muestra ? 'Muestra' : 'app.nxusai.org'}</span></div></div>
          <nav>
            ${misSecciones().map(([id, t, i]) => `<a href="#${id}" data-ir="${id}"><i>${i}</i>${t}</a>`).join('')}
            ${esAdmin() ? `<div class="sep">Solo tú</div>${SECCIONES_ADMIN.map(([id, t, i]) => `<a href="#${id}" data-ir="${id}"><i>${i}</i>${t}</a>`).join('')}` : ''}
            ${conPermiso().length ? `<div class="sep">${esAdmin() ? 'Administración' : 'Con permiso'}</div>${conPermiso().map(([id, t, i]) => `<a href="#${id}" data-ir="${id}"><i>${i}</i>${t}</a>`).join('')}` : ''}
          </nav>
          <div class="yo" id="yo"></div>
        </aside>
        <main>
          <header class="top">
            <button class="menu" id="menu" aria-label="Menú">☰</button>
            <h1 id="titulo"></h1>
            <div class="reloj-top" id="reloj-top"></div>
          </header>
          <section id="vista"></section>
          <footer class="frase" id="frase"><span>Frase del día</span><p></p></footer>
        </main>
      </div>`
    $('#frase p').textContent = fraseDelDia(esAdmin())
    $('#menu').onclick = () => $('.nav').classList.toggle('abierta')
    $('#yo').innerHTML = `${await avatar(yo)}<div><b>${h(yo.nombre)}</b><span>${h(yo.cargo || '')}</span><button class="enlace" id="mi-cuenta">⚙ Mi cuenta</button></div><button class="enlace" id="salir">Salir</button>`
    $('#mi-cuenta').onclick = () => miCuenta()
    // La primera vez (o después de que Eduardo le puso una nueva): que cambie la contraseña por una suya.
    if (yo.cambiar_clave && !muestra) setTimeout(() => miCuenta({ primeraVez: true }), 600)
    $('#salir').onclick = async () => {
      await D.salir()
      yo = null
      onhashchange = null
      location.hash = ''
      pantallaEntrada()
    }
    pintarReloj()
    clearInterval(reloj)
    reloj = setInterval(pintarReloj, 30000)
    onhashchange = () => mostrar()
    mostrar()
  }

  function pintarReloj() {
    const el = $('#reloj-top')
    if (!el) return
    el.innerHTML = abierta
      ? `<span class="punto vivo"></span><span>Trabajando · ${horas(duracion(abierta))}</span><button class="btn chico" id="r-salir">Marcar salida</button>`
      : `<span class="punto"></span><span>Fuera</span><button class="btn chico primario" id="r-entrar">Marcar entrada</button>`
    $('#r-entrar', el)?.addEventListener('click', marcarEntrada)
    $('#r-salir', el)?.addEventListener('click', marcarSalida)
  }
  async function marcarEntrada() {
    const j = await intenta(() => D.marcarEntrada(yo.id), 'Entrada registrada')
    if (j) abierta = j
    pintarReloj()
    if (location.hash === '#reloj' || location.hash === '#inicio' || !location.hash) mostrar()
  }
  async function marcarSalida() {
    if (!abierta) return
    const j = await intenta(() => D.marcarSalida(abierta.id), 'Salida registrada')
    if (j) abierta = null
    pintarReloj()
    if (location.hash === '#reloj' || location.hash === '#inicio' || !location.hash) mostrar()
  }

  async function mostrar() {
    if (!yo || !$('#vista')) return
    $('.nav')?.classList.remove('abierta')
    let [ruta, arg] = (location.hash.slice(1) || 'inicio').split('/')
    if (ruta === 'dinero') ruta = 'finanzas' // la sección Dinero ahora es Finanzas
    const todas = [...misSecciones(), ...(esAdmin() ? SECCIONES_ADMIN : []), ...conPermiso()]
    const sec = todas.find(([id]) => id === ruta) ? ruta : ruta === 'cliente' ? 'clientes' : ruta === 'prospecto' && vePros() ? 'prospectos' : ruta === 'lead' && vePros() ? 'leads' : 'inicio'
    $$('[data-ir]').forEach((a) => a.classList.toggle('activa', a.dataset.ir === sec))
    const vista = $('#vista')
    // Si sigues en la misma pantalla (guardar, aprobar, borrar), no se borra: se cambia cuando llega lo nuevo.
    const misma = vista.dataset.ruta === location.hash && vista.children.length
    vista.dataset.ruta = location.hash
    // El momento Nueva York: al cambiar de sección todo se va 1 segundo y se ve la ciudad (mientras, carga lo nuevo).
    const ny = !misma ? momentoNY() : null
    if (!misma) vista.innerHTML = '<div class="cargando">Cargando…</div>'
    else vista.classList.add('actualizando')
    const VISTAS = { inicio, clientes: vistaClientes, prospectos: vistaProspectos, leads: vistaLeads, anuncios: (v) => vistaAnuncios(v, { D, h, titulo, dinero: puede('anuncios_gasto') ? dinero : () => '—' }), cartera: vistaCartera, tareas: vistaTareas, equipo: vistaEquipo, reloj: vistaReloj, pendientes: vistaPendientes, metas: vistaMetas, nomina: vistaNomina, finanzas: (v) => vistaFinanzas(v, ctxFinanzas()), personas: vistaPersonas, bitacora: vistaBitacora }
    try {
      if (ruta === 'cliente' && arg) await vistaCliente(vista, arg)
      else if (ruta === 'prospecto' && arg && vePros()) await vistaProspecto(vista, arg)
      else if (ruta === 'lead' && arg && vePros()) await vistaLead(vista, arg)
      else await VISTAS[sec](vista)
      vista.classList.remove('actualizando')
      await ny?.fin()
    } catch (err) {
      vista.classList.remove('actualizando')
      await ny?.fin()
      if (/leads/.test(err.message) && /schema cache|does not exist|relation/i.test(err.message))
        return (vista.innerHTML = `<div class="tarjeta"><h3>Falta un paso en Supabase</h3><p>Leads y Cartera ya están en la página, pero la base de datos todavía no tiene su lugar. En Supabase → <b>SQL Editor</b> → <b>New query</b>, pega todo <code>hq/supabase/esquema.sql</code> y dale <b>Run</b>.</p></div>`)
      vista.innerHTML = `<p class="error">${h(err.message)}</p>`
    }
  }
  const titulo = (t) => ($('#titulo').textContent = t)
  const ctxFinanzas = () => ({ D, h, $, $$, titulo, dinero, abrirModal, cerrarModal, intenta, aviso, mostrar, opciones, puede, esAdmin, calcularPago, quincena })

  /** Todo se desvanece y queda Nueva York 1 segundo; fin() espera lo que falte y regresa la pantalla. */
  let turnoNY = 0
  function momentoNY(ms = 1000) {
    const mio = ++turnoNY
    const desde = Date.now()
    document.body.classList.add('vista-ny')
    return {
      async fin() {
        const falta = ms - (Date.now() - desde)
        if (falta > 0) await new Promise((r) => setTimeout(r, falta))
        if (mio === turnoNY) document.body.classList.remove('vista-ny') // si ya cambiaste de nuevo, sigue la otra
      },
    }
  }

  // ------------------------------------------------------------- inicio

  async function inicio(v) {
    titulo(saludo(yo.nombre))
    $('#frase p').textContent = fraseDelDia(esAdmin())
    const tareas = (await D.tareas()).filter((t) => !t.cliente_id) // solo las de NXUS: cada cliente tiene su panel
    const mias = tareas.filter((t) => t.asignado === yo.id && t.estado !== 'hecha')
    const tarjetaTarea = (t) =>
      `<li><span class="chip ${t.estado}">${TAREA[t.estado]}</span><b>${h(t.titulo)}</b><small>${h(clienteDe(t.cliente_id)?.nombre ?? '')}${t.vence ? ` · vence ${fechaCorta(t.vence)}` : ''}</small></li>`
    let html = ''
    if (esAdmin()) {
      const q = quincena()
      const [din, nom, jor, aju, com, abiertas, pagos] = await Promise.all([D.dinero(), D.nomina(), D.jornadas(q.desde, q.hasta), D.ajustes(), D.comisiones(), D.abiertas(), D.pagosProspectos()])
      const activos = clientes.filter((c) => c.estado === 'activo')
      const ingreso = cobradoMes(pagos)
      for (const d of din) if (clienteDe(d.cliente_id)?.estado === 'activo') ingreso[d.moneda] += Number(d.mensualidad || 0)
      const pago = { USD: 0, MXN: 0 }
      for (const n of nom) pago[n.moneda] += calcularPago(n, { jornadas: jor, ajustes: aju, comisiones: com, desde: q.desde, hasta: q.hasta }).total
      const abiertasHoy = tareas.filter((t) => t.estado !== 'hecha')
      const atrasadas = abiertasHoy.filter((t) => t.vence && t.vence < hoyISO())
      const avance = Math.min(100, Math.round((ingreso.USD / META_USD) * 100))
      html = `
        <div class="kpis">
          <div class="kpi"><span>Clientes activos</span><b>${activos.length}</b><small>${clientes.filter((c) => c.estado === 'prospecto').length} prospectos</small></div>
          <div class="kpi"><span>Ingreso del mes</span><b>${dinero(ingreso.USD)}</b><small>${ingreso.MXN ? `+ ${dinero(ingreso.MXN, 'MXN')}` : 'en dólares'}</small></div>
          <div class="kpi"><span>Nómina de esta quincena</span><b>${pago.MXN ? dinero(pago.MXN, 'MXN') : dinero(pago.USD)}</b><small>${pago.MXN && pago.USD ? `+ ${dinero(pago.USD)}` : q.nombre}</small></div>
          <div class="kpi"><span>Tareas abiertas</span><b>${abiertasHoy.length}</b><small class="${atrasadas.length ? 'rojo' : ''}">${atrasadas.length} atrasadas</small></div>
        </div>
        <div class="tarjeta meta"><div class="fila"><b>Meta: ${dinero(META_USD)} al mes</b><span>${avance}%</span></div><div class="barra"><i style="width:${avance}%"></i></div><small>Ingreso del mes en dólares: clientes activos más consultorías cobradas. Cómo paga cada cliente, gastos y ganancias: <a href="#finanzas">Finanzas</a>.</small></div>
        <div class="dos">
          <div class="tarjeta"><h3>Trabajando ahora</h3>${
            abiertas.length
              ? `<ul class="lista">${abiertas.map((j) => `<li><b>${h(nombreDe(j.persona))}</b><small>desde ${hora(j.entrada)} · ${horas(duracion(j))}</small></li>`).join('')}</ul>`
              : '<p class="vacio">Nadie ha marcado entrada.</p>'
          }</div>
          <div class="tarjeta"><h3>Atrasadas</h3>${atrasadas.length ? `<ul class="lista">${atrasadas.map((t) => `<li><b>${h(t.titulo)}</b><small>${h(nombreDe(t.asignado))} · venció ${fechaCorta(t.vence)}</small></li>`).join('')}</ul>` : '<p class="vacio">Nada atrasado.</p>'}</div>
        </div>`
    } else {
      html = `
        <div class="tarjeta"><h3>Mi reloj</h3><p>${abierta ? `Trabajando desde las ${hora(abierta.entrada)} (${horas(duracion(abierta))}).` : 'No has marcado entrada hoy.'}</p>
          <button class="btn ${abierta ? '' : 'primario'}" id="i-reloj">${abierta ? 'Marcar salida' : 'Marcar entrada'}</button></div>`
    }
    if (!yo.nombre.trim())
      html = `<div class="tarjeta"><p>Tu perfil no tiene nombre todavía, por eso el saludo no te llama por tu nombre. ${esAdmin() ? `Ponlo en <a href="#personas">Personas</a> → <b>Editar</b> en tu renglón.` : 'Pídele a Eduardo que lo agregue.'}</p></div>` + html
    if (vePros()) html += (await resumenLeads()) + (await resumenProspectos())
    html += `<div class="tarjeta"><h3>Mis pendientes</h3>${mias.length ? `<ul class="lista tareas">${mias.map(tarjetaTarea).join('')}</ul>` : '<p class="vacio">No tienes pendientes.</p>'}</div>`
    v.innerHTML = html
    $('#i-reloj', v)?.addEventListener('click', () => (abierta ? marcarSalida() : marcarEntrada()))
  }

  // ----------------------------------------------------------- clientes

  async function vistaClientes(v) {
    titulo('Clientes')
    clientes = await D.clientes()
    const verDinero = puede('clientes_dinero') || puede('finanzas_ver')
    const din = verDinero ? await D.dinero().catch(() => []) : []
    const grupos = ['activo', 'prospecto', 'pausado', 'terminado']
    v.innerHTML = `
      ${puede('clientes_editar') ? `<div class="acciones"><button class="btn primario" id="c-ia">✦ Nuevo cliente con IA</button><button class="btn" id="c-mano">Nuevo a mano</button></div>` : ''}
      ${grupos
        .map((g) => {
          const lista = clientes.filter((c) => c.estado === g)
          if (!lista.length) return ''
          return `<h2 class="grupo">${ESTADOS[g]} <small>${lista.length}</small></h2><div class="rejilla">${lista
            .map((c) => {
              const d = din.find((x) => x.cliente_id === c.id)
              return `<a class="cliente" href="#cliente/${c.id}">
                <div class="fila"><b>${h(c.nombre)}</b><span class="chip ${c.equipo}">${SEDE[c.equipo]}</span></div>
                ${c.grupo && c.grupo !== c.nombre ? `<small>${h(c.grupo)}</small>` : ''}
                <ul class="servicios">${c.servicios.slice(0, 4).map((s) => `<li>${h(s)}</li>`).join('')}</ul>
                <div class="fila pie">${c.sistema_url ? '<span class="chip sistema">Con sistema</span>' : '<span></span>'}${verDinero ? `<b class="monto">${d?.mensualidad ? `${dinero(d.mensualidad, d.moneda)}/mes` : 'sin monto'}</b>` : ''}</div>
              </a>`
            })
            .join('')}</div>`
        })
        .join('')}`
    $('#c-ia', v)?.addEventListener('click', clienteConIA)
    $('#c-mano', v)?.addEventListener('click', () => editarCliente(null))
  }

  async function vistaCliente(v, cid) {
    clientes = await D.clientes()
    const c = clienteDe(cid)
    if (!c) {
      titulo('Cliente')
      v.innerHTML = '<p class="vacio">Ese cliente ya no existe.</p>'
      return
    }
    titulo(c.nombre)
    const verDinero = puede('clientes_dinero') || puede('finanzas_ver')
    const [din, pros] = await Promise.all([verDinero ? D.dinero().catch(() => []) : [], vePros() ? D.prospectos() : []])
    const d = din.find((x) => x.cliente_id === c.id)
    const vino = pros.find((x) => x.cliente_id === c.id)
    const sinDocs = { html: '', conectar() {} }
    const [contrato, propuestas] = await Promise.all([
      puede('documentos_ver')
        ? seccionDocumentos({ tipo: 'contrato', cliente_id: c.id, titulo: `Contrato <small>PDF · ${esAdmin() ? 'solo tú lo ves' : 'con permiso'}</small>`, puedeSubir: esAdmin() }).catch(() => sinDocs)
        : sinDocs,
      vino && puede('documentos_ver') ? seccionDocumentos({ tipo: 'propuesta', prospecto_id: vino.id, titulo: `Propuestas que se le presentaron <small>PDF · ${esAdmin() ? 'solo tú las ves' : 'con permiso'}</small>`, puedeSubir: false }).catch(() => sinDocs) : sinDocs,
    ])
    v.innerHTML = `
      <a class="enlace" href="#clientes">← Clientes</a>
      <div class="ficha">
        <div class="tarjeta">
          <div class="fila"><span class="chip ${c.estado}">${ESTADOS[c.estado]}</span><span class="chip ${c.equipo}">${SEDE[c.equipo]}</span>${c.propio ? '<span class="chip">Empresa propia</span>' : ''}</div>
          ${c.grupo ? `<p><small>${h(c.grupo)}</small></p>` : ''}
          <p class="desc">${h(c.descripcion) || '<span class="vacio">Sin descripción.</span>'}</p>
          <h3>Servicios</h3><ul class="servicios">${c.servicios.map((s) => `<li>${h(s)}</li>`).join('') || '<li>Por definir</li>'}</ul>
          <h3>Contacto</h3><p>${[c.contacto_nombre, c.contacto_correo, c.contacto_tel].filter(Boolean).map(h).join(' · ') || '<span class="vacio">Sin contacto.</span>'}</p>
          <p><small>Responsable: ${h(nombreDe(c.responsable))}${c.traido_por ? ` · Lo trajo: ${h(nombreDe(c.traido_por))}` : ''}${c.inicio ? ` · Desde ${fechaCorta(c.inicio)}` : ''}</small></p>
          ${vino ? `<p><a href="#prospecto/${vino.id}">✦ Llegó como prospecto: ver cómo llegó y sus notas →</a></p>` : ''}
          <div class="acciones">
            ${c.sistema_url ? `<a class="btn primario" href="${h(c.sistema_url)}" target="_blank" rel="noopener">Entrar a su sistema · ${h(c.sistema_nombre || 'Abrir')} ↗</a>` : c.sistema_nombre ? `<span class="chip">${h(c.sistema_nombre)}: falta la dirección</span>` : ''}
            ${puede('clientes_editar') ? '<button class="btn" id="cl-editar">Editar</button>' : ''}
          </div>
        </div>
        ${
          verDinero
            ? (() => {
                const pl = planCliente(d)
                return `<div class="tarjeta solo-tu"><h3>Lo que paga <small>${esAdmin() ? 'solo tú lo ves' : 'con permiso'}</small></h3>
                <div class="kpis chicos"><div class="kpi"><span>Cada cobro</span><b>${dinero(pl.monto, pl.moneda)}</b></div><div class="kpi"><span>Al mes</span><b>${dinero(d?.mensualidad, d?.moneda)}</b></div><div class="kpi"><span>Cuándo</span><b class="chico-b">${d ? describirPlan(pl) : '—'}</b></div></div>
                ${d?.notas ? `<p>${h(d.notas)}</p>` : ''}${puede('finanzas_editar') ? '<button class="btn" id="cl-dinero">Cómo paga</button>' : ''}</div>`
              })()
            : ''
        }
        ${contrato.html}
        ${propuestas.html}
      </div>`
    contrato.conectar(v)
    propuestas.conectar(v)
    $('#cl-editar', v)?.addEventListener('click', () => editarCliente(c))
    $('#cl-dinero', v)?.addEventListener('click', () => editarDinero(c, d))
  }

  const opciones = (obj, actual) => Object.entries(obj).map(([k, t]) => `<option value="${k}" ${k === actual ? 'selected' : ''}>${h(t)}</option>`).join('')
  const opcionesPersonas = (actual, vacio = 'Nadie') =>
    `<option value="">${vacio}</option>${personas.filter((p) => p.activo).map((p) => `<option value="${p.id}" ${p.id === actual ? 'selected' : ''}>${h(p.nombre)}</option>`).join('')}`

  function formCliente(c = {}) {
    return `
      <div class="campos">
        <label class="ancho">Nombre<input name="nombre" required maxlength="120" value="${h(c.nombre)}"></label>
        <label>Grupo<input name="grupo" value="${h(c.grupo)}"></label>
        <label>Estado<select name="estado">${opciones(ESTADOS, c.estado || 'activo')}</select></label>
        <label>Lo atiende<select name="equipo">${opciones(SEDE, c.equipo || 'usa')}</select></label>
        <label>Inicio<input name="inicio" type="date" value="${h(c.inicio || '')}"></label>
        <label class="ancho">Servicios (uno por línea)<textarea name="servicios" rows="3">${h((c.servicios || []).join('\n'))}</textarea></label>
        <label class="ancho">Qué hacemos / haremos<textarea name="descripcion" rows="3">${h(c.descripcion)}</textarea></label>
        <label>Contacto<input name="contacto_nombre" value="${h(c.contacto_nombre)}"></label>
        <label>Correo<input name="contacto_correo" type="email" value="${h(c.contacto_correo)}"></label>
        <label>Teléfono<input name="contacto_tel" value="${h(c.contacto_tel)}"></label>
        <label>Su sistema (nombre)<input name="sistema_nombre" value="${h(c.sistema_nombre)}" placeholder="Centro de trabajo"></label>
        <label class="ancho">Dirección de su sistema<input name="sistema_url" type="url" pattern="https://.*" value="${h(c.sistema_url)}" placeholder="https://…"></label>
        <label>Responsable<select name="responsable">${opcionesPersonas(c.responsable)}</select></label>
        <label>Lo trajo<select name="traido_por">${opcionesPersonas(c.traido_por)}</select></label>
        <label class="check"><input type="checkbox" name="propio" ${c.propio ? 'checked' : ''}> Empresa propia</label>
      </div>`
  }
  const leerCliente = (f) => {
    const d = Object.fromEntries(new FormData(f))
    return {
      nombre: d.nombre.trim(),
      grupo: d.grupo.trim() || null,
      estado: d.estado,
      equipo: d.equipo,
      inicio: d.inicio || null,
      servicios: d.servicios.split('\n').map((s) => s.trim()).filter(Boolean),
      descripcion: d.descripcion.trim(),
      contacto_nombre: d.contacto_nombre.trim(),
      contacto_correo: d.contacto_correo.trim(),
      contacto_tel: d.contacto_tel.trim(),
      sistema_nombre: d.sistema_nombre.trim(),
      sistema_url: d.sistema_url.trim(),
      responsable: d.responsable || null,
      traido_por: d.traido_por || null,
      propio: !!d.propio,
    }
  }

  function editarCliente(c) {
    abrirModal(
      `<form id="f-cliente"><h2>${c ? 'Editar cliente' : 'Nuevo cliente'}</h2>${formCliente(c ?? {})}
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button>
        ${c ? '<button type="button" class="btn peligro" id="cl-borrar">Borrar</button>' : ''}</div></form>`,
      (caja) => {
        $('#f-cliente', caja).onsubmit = async (e) => {
          e.preventDefault()
          const guardado = await intenta(() => D.guardarCliente({ ...(c ? { id: c.id } : {}), ...leerCliente(e.target) }), 'Cliente guardado')
          if (!guardado) return
          if (!c && puede('finanzas_editar')) await intenta(() => D.guardarDinero({ cliente_id: guardado.id }))
          cerrarModal()
          location.hash = `#cliente/${guardado.id}`
          mostrar()
        }
        $('#cl-borrar', caja)?.addEventListener('click', async () => {
          if (!confirm(`¿Borrar a ${c.nombre}? Se borra también lo que paga. Sus tareas se quedan sin cliente.`)) return
          if ((await intenta(() => D.borrarCliente(c.id), 'Cliente borrado')) !== undefined) {
            cerrarModal()
            location.hash = '#clientes'
          }
        })
      },
    )
  }

  function editarDinero(c, d = {}) {
    return editarPlanCliente(ctxFinanzas(), c, d)
  }
  /** Eduardo escribe el cliente con sus palabras; la IA arma la ficha, el dinero y las primeras tareas. */
  function clienteConIA() {
    abrirModal(
      `<form id="f-ia"><h2>✦ Nuevo cliente con IA</h2>
        <p class="nota">Escríbelo como se lo contarías a alguien: quién es, qué le hacemos o haremos, cuánto paga y desde cuándo. La IA organiza todo y tú lo revisas antes de guardar.</p>
        <textarea name="texto" rows="7" required placeholder="Ej.: Taquería El Güero en Newark, le vamos a hacer su página web y llevarle redes. Paga 800 dólares al mes desde el 1 de noviembre, el dueño es Raúl, raul@elguero.com"></textarea>
        <div class="acciones"><button class="btn primario" id="ia-ir">Organizar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-ia', caja).onsubmit = async (e) => {
          e.preventDefault()
          const b = $('#ia-ir', caja)
          b.disabled = true
          b.textContent = 'Organizando…'
          const ficha = await intenta(() => D.ordenar(e.target.texto.value))
          b.disabled = false
          b.textContent = 'Organizar'
          if (ficha) revisarFicha(ficha)
        }
      },
    )
  }

  function revisarFicha(f) {
    const c = { ...f, grupo: f.grupo || '', inicio: f.inicio || '', sistema_nombre: '', sistema_url: '', responsable: personas.find((p) => /encargad/i.test(p.cargo))?.id }
    abrirModal(
      `<form id="f-ficha"><h2>Revisa y guarda</h2>
        ${f.dudas?.length ? `<div class="dudas"><b>Falta saber:</b><ul>${f.dudas.map((d) => `<li>${h(d)}</li>`).join('')}</ul></div>` : ''}
        ${formCliente(c)}
        ${puede('finanzas_editar') ? `<h3>Lo que paga <small>${esAdmin() ? 'solo tú lo ves' : 'con permiso'} · después puedes poner "cada dos semanas" y más en Finanzas</small></h3>
        <div class="campos">
          <label>Mensualidad<input name="mensualidad" type="number" min="0" step="0.01" value="${h(f.mensualidad || 0)}"></label>
          <label>Pago único<input name="pago_unico" type="number" min="0" step="0.01" value="${h(f.pago_unico || 0)}"></label>
          <label>Moneda<select name="moneda">${opciones({ USD: 'Dólares (USD)', MXN: 'Pesos (MXN)' }, f.moneda || 'USD')}</select></label>
          <label>Día de cobro<input name="dia_cobro" type="number" min="1" max="31" value="${h(f.dia_cobro || '')}"></label>
        </div>` : ''}
        <div class="acciones"><button class="btn primario">Guardar cliente</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-ficha', caja).onsubmit = async (e) => {
          e.preventDefault()
          const form = e.target
          const x = Object.fromEntries(new FormData(form))
          const nuevo = await intenta(() => D.guardarCliente(leerCliente(form)))
          if (!nuevo) return
          if (puede('finanzas_editar'))
            await intenta(() => D.guardarDinero({ cliente_id: nuevo.id, mensualidad: Number(x.mensualidad) || 0, monto_cobro: Number(x.mensualidad) || 0, frecuencia: 'mensual', cobro_dias: Number(x.dia_cobro) ? [Number(x.dia_cobro)] : [], pago_unico: Number(x.pago_unico) || 0, moneda: x.moneda, dia_cobro: Number(x.dia_cobro) || null, notas: '' }))
          aviso(`${nuevo.nombre} quedó dado de alta`)
          cerrarModal()
          location.hash = `#cliente/${nuevo.id}`
          mostrar()
        }
      },
    )
  }

  // ---------------------------------------------------------- prospectos

  const resumenPermisos = (p) => {
    if ((p.pros_ver || 'nada') === 'nada') return '<small>—</small>'
    const puede = [p.pros_trabajar && 'trabaja', p.pros_etapas && 'etapas', p.pros_convertir && 'convierte'].filter(Boolean)
    return `<small>${p.pros_ver === 'todos' ? 'Todos' : 'Los suyos'}${puede.length ? ` · ${puede.join(', ')}` : ''}${p.codigo ? ` · link: ${h(p.codigo)}` : ''}</small>`
  }
  /**
   * Los PDF de un prospecto (propuestas) o de un cliente (contrato): lista, subir, abrir y, solo el admin, borrar.
   * Devuelve el HTML y una función para conectarlo cuando ya esté en la página.
   */
  async function seccionDocumentos({ tipo, prospecto_id, cliente_id, titulo: t, puedeSubir, nota }) {
    const docs = await D.documentos({ prospecto_id, cliente_id })
    const peso = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
    const clave = `doc-${tipo}`
    const html = `<div class="tarjeta ancho-total documentos"><div class="fila"><h3>${t}</h3>${puedeSubir ? `<label class="btn chico primario subir">⬆ Subir PDF<input type="file" accept="application/pdf" id="${clave}" hidden></label>` : ''}</div>
      ${nota ? `<p class="nota">${nota}</p>` : ''}
      ${
        docs.length
          ? `<ul class="lista tareas">${docs
              .map((d) => `<li><span class="chip">📄 PDF</span><button class="enlace" data-abrir="${d.id}">${h(d.nombre)}</button><small>${fechaCorta(d.creado)} · ${h(nombreDe(d.subido_por))} · ${peso(d.tamano)}</small>${esAdmin() ? `<button class="enlace rojo" data-borrar-doc="${d.id}">Borrar</button>` : ''}</li>`)
              .join('')}</ul>`
          : `<p class="vacio">Todavía no hay ${tipo === 'contrato' ? 'contrato' : 'propuestas'}.</p>`
      }</div>`
    const conectar = (v) => {
      $(`#${clave}`, v)?.addEventListener('change', async (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (file.type !== 'application/pdf') return aviso('Solo PDF', 'mal')
        if (file.size > 20 * 1048576) return aviso('El PDF pesa más de 20 MB', 'mal')
        aviso('Subiendo…')
        if (await intenta(() => D.subirDocumento({ tipo, prospecto_id, cliente_id }, file), 'PDF guardado')) mostrar()
      })
      $$('[data-abrir]', v).forEach(
        (b) =>
          (b.onclick = async () => {
            // La ventana se abre antes de pedir el link para que el navegador no la bloquee.
            const w = open('', '_blank')
            const url = await intenta(() => D.abrirDocumento(docs.find((d) => d.id === b.dataset.abrir)))
            if (url && w) w.location = url
            else w?.close()
          }),
      )
      $$('[data-borrar-doc]', v).forEach(
        (b) =>
          (b.onclick = async () => {
            const d = docs.find((x) => x.id === b.dataset.borrarDoc)
            if (confirm(`¿Borrar "${d.nombre}"? No se puede deshacer.`) && (await intenta(() => D.borrarDocumento(d), 'PDF borrado')) !== undefined) mostrar()
          }),
      )
    }
    return { html, conectar }
  }

  /** El botón para entrar al Google Meet de la cita (desde 2 horas después de empezada ya no sale). */
  const botonMeet = (x, clase = 'primario') =>
    x?.meet && x.cita && new Date(x.cita).getTime() > Date.now() - 2 * 3600e3
      ? `<a class="btn ${clase} meet" href="${h(x.meet)}" target="_blank" rel="noopener">🎥 Ir al meeting${Math.abs(new Date(x.cita) - Date.now()) < 15 * 60e3 ? ' · ¡ya es hora!' : ''}</a>`
      : ''
  const nombrePros = (x) => x.empresa || x.nombre || (x.link ? x.link.replace(/-/g, ' ').replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : 'Link sin nombre')
  const atrasado = (x) => x.siguiente_fecha && x.siguiente_fecha < hoyISO() && EN_CURSO.includes(x.etapa)

  /** En Inicio: a ti el embudo y las próximas citas; al equipo, sus prospectos con su siguiente paso. */
  async function resumenProspectos() {
    const pros = await D.prospectos()
    const citas = pros.filter((x) => x.cita && new Date(x.cita) > new Date() && EN_CURSO.includes(x.etapa)).sort((a, b) => a.cita.localeCompare(b.cita))
    if (esAdmin()) {
      const semana = pros.filter((x) => Date.now() - new Date(x.creado) < 7 * 864e5).length
      return `<div class="tarjeta"><div class="fila"><h3>Prospectos</h3><a href="#prospectos">Ver todos →</a></div>
        <div class="embudo">${EN_CURSO.map((e) => `<a href="#prospectos"><b>${pros.filter((x) => x.etapa === e).length}</b><span>${ETAPAS[e]}</span></a>`).join('')}</div>
        <p><small>${semana} nuevos esta semana · ${pros.filter(atrasado).length} con seguimiento atrasado</small></p>
        ${citas.length ? `<h3>Próximas citas</h3><ul class="lista">${citas.slice(0, 5).map((x) => `<li><a href="#prospecto/${x.id}"><b>${h(nombrePros(x))}</b></a><small>${fechaHora(x.cita)} · ${h(nombreDe(x.asignado))}</small>${botonMeet(x, 'chico')}</li>`).join('')}</ul>` : ''}
      </div>`
    }
    const mios = pros.filter((x) => EN_CURSO.includes(x.etapa) && (x.asignado === yo.id || x.traido_por === yo.id))
    return `<div class="tarjeta"><div class="fila"><h3>Mis prospectos</h3><a href="#prospectos">Ver →</a></div>${
      mios.length
        ? `<ul class="lista tareas">${mios
            .map((x) => `<li><span class="chip etapa-${x.etapa}">${ETAPAS[x.etapa]}</span><a href="#prospecto/${x.id}"><b>${h(nombrePros(x))}</b></a><small class="${atrasado(x) ? 'rojo' : ''}">${x.siguiente ? `${h(x.siguiente)}${x.siguiente_fecha ? ` · ${fechaCorta(x.siguiente_fecha)}` : ''}` : 'Sin siguiente paso'}</small></li>`)
            .join('')}</ul>`
        : '<p class="vacio">No tienes prospectos abiertos.</p>'
    }</div>`
  }

  async function vistaProspectos(v) {
    titulo('Prospectos')
    const [pros, pagos] = await Promise.all([D.prospectos(), puede('finanzas_ver') ? D.pagosProspectos().catch(() => []) : []])
    const pagado = new Set(pagos.map((g) => g.prospecto_id))
    const verMios = !esAdmin() && yo.pros_ver === 'suyos'
    const filtro = verMios ? 'mios' : sessionStorage.getItem('hq-pros') || 'todos'
    const lista = filtro === 'mios' ? pros.filter((x) => x.asignado === yo.id || x.traido_por === yo.id) : filtro === 'todos' ? pros : pros.filter((x) => x.asignado === filtro)
    const mes = new Date().toISOString().slice(0, 7)
    const tarjeta = (x) => `<a class="tarea pros ${atrasado(x) ? 'atrasada' : ''}" href="#prospecto/${x.id}">
        <b>${h(nombrePros(x))}</b>
        ${x.empresa && x.nombre ? `<small>${h(x.nombre)}</small>` : ''}
        ${x.lineas.length ? `<small>${h(x.lineas.map((l) => l.split(': ')[1] || l).slice(0, 3).join(' · '))}${x.lineas.length > 3 ? '…' : ''}</small>` : ''}
        <div class="fila chips">${x.camino === 'consulta' ? '<span class="chip">Consultoría</span>' : x.camino === 'propuesta' ? '<span class="chip">Propuesta</span>' : ''}${pagado.has(x.id) ? '<span class="chip hecha">Pagó ✓</span>' : ''}${x.origen === 'manual' ? '<span class="chip">A mano</span>' : x.origen === 'anuncio' ? '<span class="chip sistema">Anuncio · NEX</span>' : ''}</div>
        <small>${x.cita && EN_CURSO.includes(x.etapa) ? `📅 ${fechaHora(x.cita)} · ` : ''}${x.asignado ? h(nombreDe(x.asignado)) : 'Sin asignar'} · ${fechaCorta(x.creado)}${x.traido_por && x.traido_por !== x.asignado ? ` · link de ${h(nombreDe(x.traido_por).split(' ')[0])}` : ''}</small>
        ${atrasado(x) ? `<small class="rojo">Seguimiento atrasado: ${h(x.siguiente || 'sin nota')}</small>` : ''}
      </a>`
    v.innerHTML = `
      <div class="acciones">
        <button class="btn primario" id="pr-link">🔗 Link para un prospecto</button>
        ${puedePros('trabajar') ? '<button class="btn" id="pr-nuevo">+ Apuntar a mano</button>' : ''}
        ${
          verMios
            ? ''
            : `<div class="segmento"><button data-pf="todos" class="${filtro === 'todos' ? 'on' : ''}">Todos</button><button data-pf="mios" class="${filtro === 'mios' ? 'on' : ''}">Míos</button></div>
               ${esAdmin() ? `<select id="pr-quien" aria-label="De quién"><option value="">Por persona…</option>${personas.filter((p) => p.activo).map((p) => `<option value="${p.id}" ${filtro === p.id ? 'selected' : ''}>${h(p.nombre)}</option>`).join('')}</select>` : ''}`
        }
      </div>
      <div class="kpis">
        <div class="kpi"><span>En proceso</span><b>${lista.filter((x) => EN_CURSO.includes(x.etapa)).length}</b><small>${lista.filter((x) => Date.now() - new Date(x.creado) < 7 * 864e5).length} nuevos esta semana</small></div>
        <div class="kpi"><span>Citas próximas</span><b>${lista.filter((x) => x.cita && new Date(x.cita) > new Date() && EN_CURSO.includes(x.etapa)).length}</b><small>con Google Meet</small></div>
        <div class="kpi"><span>Clientes este mes</span><b>${lista.filter((x) => x.etapa === 'cliente' && x.actualizado.slice(0, 7) === mes).length}</b><small>${lista.filter((x) => x.etapa === 'cliente').length} en total</small></div>
        <div class="kpi"><span>Seguimiento atrasado</span><b class="${lista.some(atrasado) ? 'rojo' : ''}">${lista.filter(atrasado).length}</b><small>siguiente paso vencido</small></div>
      </div>
      <div class="tablero embudo-tablero">${EN_CURSO.map((e) => {
        const col = lista.filter((x) => x.etapa === e)
        return `<div class="columna ${col.length ? '' : 'vacia'}"><h3>${ETAPAS[e]} <small>${col.length}</small></h3>${col.map(tarjeta).join('') || '<p class="vacio">—</p>'}</div>`
      }).join('')}</div>
      ${['cliente', 'perdido']
        .map((e) => {
          const col = lista.filter((x) => x.etapa === e)
          return col.length
            ? `<details class="tarjeta cerrados"><summary><b>${e === 'cliente' ? 'Se hicieron clientes' : 'Perdidos'}</b> <small>${col.length}</small></summary><ul class="lista tareas">${col
                .map((x) => `<li><a href="#prospecto/${x.id}"><b>${h(nombrePros(x))}</b></a><small>${e === 'perdido' ? h(x.motivo_perdido || 'Sin motivo') : `cliente desde ${fechaCorta(x.actualizado)}`} · ${h(nombreDe(x.asignado))}</small></li>`)
                .join('')}</ul></details>`
            : ''
        })
        .join('')}`
    $('#pr-link', v).onclick = crearLink
    $('#pr-nuevo', v)?.addEventListener('click', () => editarProspecto(null))
    $$('[data-pf]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-pros', b.dataset.pf), mostrar())))
    $('#pr-quien', v)?.addEventListener('change', (e) => (sessionStorage.setItem('hq-pros', e.target.value || 'todos'), mostrar()))
  }

  async function vistaProspecto(v, pid) {
    const [pros, notas, pagos, leads, propuestas] = await Promise.all([
      D.prospectos(),
      D.notasProspecto(pid),
      puede('finanzas_ver') ? D.pagosProspectos().catch(() => []) : [],
      D.leads().catch(() => []),
      puede('documentos_ver') ? seccionDocumentos({ tipo: 'propuesta', prospecto_id: pid, titulo: 'Propuestas <small>PDF</small>', puedeSubir: esAdmin(), nota: 'Las propuestas que se le presentan en el meeting.' }).catch(() => ({ html: '', conectar() {} })) : { html: '', conectar() {} },
    ])
    const x = pros.find((p) => p.id === pid)
    if (!x) {
      titulo('Prospecto')
      v.innerHTML = '<a class="enlace" href="#prospectos">← Prospectos</a><p class="vacio">Ese prospecto no existe o no te toca verlo.</p>'
      return
    }
    titulo(nombrePros(x))
    const d = x.diagnostico || {}
    const suyos = pagos.filter((g) => g.prospecto_id === x.id)
    const porLinea = {}
    for (const l of x.lineas) {
      const [linea, item] = l.includes(': ') ? l.split(': ') : ['Otro', l]
      ;(porLinea[linea] ??= []).push(item)
    }
    const cliente = x.cliente_id && clienteDe(x.cliente_id)
    v.innerHTML = `
      <a class="enlace" href="#prospectos">← Prospectos</a>
      <div class="ficha dos-cols">
        <div class="tarjeta">
          <div class="fila chips"><span class="chip etapa-${x.etapa}">${ETAPAS[x.etapa]}</span>${x.camino ? `<span class="chip">${x.camino === 'consulta' ? 'Quiere consultoría' : 'Quiere su propuesta'}</span>` : ''}<span class="chip">${{ portal: 'Llegó por el portal', anuncio: 'Llegó por los anuncios', manual: 'Apuntado a mano' }[x.origen]}</span>${x.acepta_novedades ? '<span class="chip hecha">Acepta novedades</span>' : ''}</div>
          <h3>Contacto</h3>
          <p><b>${h(x.nombre || '—')}</b>${x.empresa ? ` · ${h(x.empresa)}` : ''}</p>
          <p>${[x.whatsapp && `<a href="https://wa.me/${h(x.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp ${h(x.whatsapp)}</a>`, x.correo && `<a href="mailto:${h(x.correo)}">${h(x.correo)}</a>`].filter(Boolean).join(' · ') || '<span class="vacio">Todavía no deja sus datos.</span>'}</p>
          ${x.direccion ? `<p><small>${h(x.direccion)}</small></p>` : ''}
          <p><small>Lo atiende: <b>${h(nombreDe(x.asignado))}</b>${x.traido_por ? ` · Link de: ${h(nombreDe(x.traido_por))}` : ''}${x.link ? ` · ${PORTAL.replace('https://', '')}/${h(x.link)}` : ''} · Llegó ${fechaCorta(x.creado)}</small></p>
          ${x.cita ? `<p>📅 <b>${fechaHora(x.cita)}</b></p>${botonMeet(x) ? `<p>${botonMeet(x)}</p>` : x.meet ? `<p><a href="${h(x.meet)}" target="_blank" rel="noopener">Link del Meet ↗</a></p>` : ''}</p>` : ''}
          ${x.etapa === 'perdido' && x.motivo_perdido ? `<p class="rojo">Perdido: ${h(x.motivo_perdido)}</p>` : ''}
          ${cliente ? `<p><a class="btn" href="#cliente/${cliente.id}">Ver su ficha de cliente →</a></p>` : ''}
          ${(() => {
            const l = leads.find((y) => y.prospecto_id === x.id)
            return l ? `<p><a class="btn" href="#lead/${l.id}">Ver su llamada con NEX →</a></p>` : ''
          })()}
          <div class="acciones">
            ${puedePros('convertir') && x.etapa !== 'cliente' ? '<button class="btn primario" id="px-convertir">✓ Convertir en cliente</button>' : ''}
            ${(esAdmin() || puedePros('etapas')) && x.etapa !== 'cliente' ? `<label class="mini">Etapa<select id="px-etapa">${Object.entries(ETAPAS).filter(([k]) => k !== 'cliente').map(([k, t]) => `<option value="${k}" ${k === x.etapa ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
            ${esAdmin() ? `<label class="mini">Lo atiende<select id="px-asignar">${opcionesPersonas(x.asignado, 'Sin asignar')}</select></label>` : ''}
            ${puedePros('trabajar') ? '<button class="btn" id="px-editar">Editar datos</button>' : ''}
            ${esAdmin() ? '<button class="btn peligro" id="px-borrar">Borrar</button>' : ''}
          </div>
        </div>
        <div class="tarjeta">
          <h3>Siguiente paso</h3>
          ${
            puedePros('trabajar')
              ? `<form id="px-sig" class="campos"><label class="ancho">Qué sigue<input name="siguiente" maxlength="300" value="${h(x.siguiente)}" placeholder="Ej.: Mandarle el caso de Abuelito y llamarle el jueves"></label>
                 <label>Cuándo<input name="siguiente_fecha" type="date" value="${h(x.siguiente_fecha || '')}"></label><button class="btn">Guardar</button></form>`
              : `<p>${h(x.siguiente) || '<span class="vacio">Sin siguiente paso.</span>'}${x.siguiente_fecha ? ` · ${fechaCorta(x.siguiente_fecha)}` : ''}</p>`
          }
          ${atrasado(x) ? '<p class="rojo">Este seguimiento ya se pasó de fecha.</p>' : ''}
          <h3>Lo que le interesa</h3>
          ${Object.keys(porLinea).length ? Object.entries(porLinea).map(([l, items]) => `<p><b>${h(l)}</b></p><ul class="servicios">${items.map((i) => `<li>${h(i)}</li>`).join('')}</ul>`).join('') : '<p class="vacio">Todavía no elige.</p>'}
          <h3>Su empresa</h3>
          ${
            Object.keys(d).length
              ? `<p>${[d.giro, d.tamano && `${d.tamano} personas`, d.ciudad, d.pais, d.idioma && `habla ${d.idioma.toLowerCase()}`, d.urgencia].filter(Boolean).map(h).join(' · ')}</p>${d.quiere ? `<blockquote>${h(d.quiere)}</blockquote>` : ''}`
              : '<p class="vacio">Todavía no contesta el diagnóstico.</p>'
          }
          ${puede('finanzas_ver') ? `<h3>Pagos</h3>${suyos.length ? `<ul class="lista">${suyos.map((g) => `<li><b>${dinero(g.monto, g.moneda)}</b><small>${h(g.concepto)} · ${fechaCorta(g.fecha)} · Stripe</small></li>`).join('')}</ul>` : '<p class="vacio">No ha pagado.</p>'}` : ''}
        </div>
        ${propuestas.html}
        <div class="tarjeta ancho-total">
          <h3>Notas <small>no se borran ni se cambian</small></h3>
          ${notas.length ? `<ul class="lista notas">${notas.map((n) => `<li><b>${h(nombreDe(n.autor))}</b><small>${fechaCorta(n.creada)} ${hora(n.creada)}</small><p>${h(n.texto)}</p></li>`).join('')}</ul>` : '<p class="vacio">Sin notas todavía.</p>'}
          ${puedePros('trabajar') ? `<form id="px-nota"><textarea name="texto" rows="2" maxlength="2000" required placeholder="Qué pasó: le llamé, le mandé un caso, pidió precio…"></textarea><div class="acciones"><button class="btn">Agregar nota</button></div></form>` : ''}
        </div>
      </div>`
    propuestas.conectar(v)
    const guardar = async (cambio, bien) => (await intenta(() => D.guardarProspecto({ id: x.id, ...cambio }), bien)) && mostrar()
    $('#px-etapa', v)?.addEventListener('change', async (e) => {
      if (e.target.value === 'perdido') {
        const motivo = prompt('¿Por qué se perdió? (opcional)', x.motivo_perdido || '')
        if (motivo === null) return (e.target.value = x.etapa)
        return guardar({ etapa: 'perdido', motivo_perdido: motivo.trim().slice(0, 300) }, 'Marcado como perdido')
      }
      guardar({ etapa: e.target.value }, `Ahora: ${ETAPAS[e.target.value]}`)
    })
    $('#px-asignar', v)?.addEventListener('change', (e) => guardar({ asignado: e.target.value || null }, 'Asignado'))
    $('#px-sig', v)?.addEventListener('submit', (e) => {
      e.preventDefault()
      const f = Object.fromEntries(new FormData(e.target))
      guardar({ siguiente: f.siguiente.trim(), siguiente_fecha: f.siguiente_fecha || null }, 'Siguiente paso guardado')
    })
    $('#px-nota', v)?.addEventListener('submit', async (e) => {
      e.preventDefault()
      const texto = e.target.texto.value.trim()
      if (texto && (await intenta(() => D.agregarNota(x.id, texto), 'Nota agregada'))) mostrar()
    })
    $('#px-editar', v)?.addEventListener('click', () => editarProspecto(x))
    $('#px-convertir', v)?.addEventListener('click', async () => {
      if (!confirm(`¿Convertir a ${nombrePros(x)} en cliente? Se crea su ficha en Clientes con lo que contestó.`)) return
      const cid = await intenta(() => D.convertirProspecto(x.id), `${nombrePros(x)} ya es cliente`)
      if (cid) {
        clientes = await D.clientes()
        location.hash = `#cliente/${cid}`
      }
    })
    $('#px-borrar', v)?.addEventListener('click', async () => {
      if (!confirm(`¿Borrar a ${nombrePros(x)} con sus notas y pagos? No se puede deshacer.`)) return
      if ((await intenta(() => D.borrarProspecto(x.id), 'Prospecto borrado')) !== undefined) location.hash = '#prospectos'
    })
  }

  function editarProspecto(x) {
    abrirModal(
      `<form id="f-pros"><h2>${x ? 'Datos del prospecto' : 'Apuntar un prospecto'}</h2>
        ${x ? '' : '<p class="nota">Para alguien que conociste por otro lado (llamada, evento, recomendación). Si prefieres que él mismo llene todo, mejor mándale su link.</p>'}
        <div class="campos">
          <label>Nombre<input name="nombre" maxlength="80" required value="${h(x?.nombre)}"></label>
          <label>Empresa<input name="empresa" maxlength="120" value="${h(x?.empresa)}"></label>
          <label>WhatsApp<input name="whatsapp" maxlength="30" value="${h(x?.whatsapp)}"></label>
          <label>Correo<input name="correo" type="email" maxlength="120" value="${h(x?.correo)}"></label>
          <label class="ancho">Dirección<input name="direccion" maxlength="200" value="${h(x?.direccion)}"></label>
          ${!x && esAdmin() ? `<label>Es de<select name="traido_por">${opcionesPersonas(yo.id, 'Nadie')}</select></label>` : ''}
        </div>
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-pros', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          const fila = { nombre: d.nombre.trim(), empresa: d.empresa.trim(), whatsapp: d.whatsapp.trim(), correo: d.correo.trim().toLowerCase(), direccion: d.direccion.trim() }
          if (!x && esAdmin()) fila.traido_por = d.traido_por || null
          const r = await intenta(() => D.guardarProspecto(x ? { id: x.id, ...fila } : fila), 'Guardado')
          if (!r) return
          cerrarModal()
          if (x) mostrar()
          else location.hash = `#prospecto/${r.id}`
        }
      },
    )
  }

  /** El link del portal para un prospecto, a nombre de quien lo manda (para su comisión). */
  function crearLink() {
    const conCodigo = personas.filter((p) => p.activo && p.codigo)
    abrirModal(
      `<form id="f-link"><h2>🔗 Link para un prospecto</h2>
        <p class="nota">Escribe su nombre. El portal lo saluda por su nombre y, cuando se registre, aparece aquí solo.</p>
        <div class="campos">
          <label class="ancho">Nombre del prospecto<input name="nombre" required maxlength="60" placeholder="Juan Pérez"></label>
          ${
            esAdmin()
              ? `<label class="ancho">A nombre de<select name="de"><option value="">Nadie (link general)</option>${conCodigo.map((p) => `<option value="${h(p.codigo)}" ${p.id === yo.id ? 'selected' : ''}>${h(p.nombre)}</option>`).join('')}</select><small>Solo salen las personas con código de link (se lo pones en Personas → Editar).</small></label>`
              : yo.codigo
                ? ''
                : '<p class="nota ancho">Aún no tienes código de link: pídeselo a Eduardo para que los prospectos queden a tu nombre.</p>'
          }
        </div>
        <div id="link-listo" hidden>
          <div class="link-caja"><code id="link-url"></code></div>
          <textarea id="link-msj" rows="4"></textarea>
          <div class="acciones"><button type="button" class="btn primario" id="copiar-link">Copiar link</button><button type="button" class="btn" id="copiar-msj">Copiar mensaje</button><a class="btn" id="link-wa" target="_blank" rel="noopener">Abrir WhatsApp</a></div>
        </div>
        <div class="acciones"><button class="btn primario" id="link-hacer">Crear link</button><button type="button" class="btn" data-cerrar>Cerrar</button></div></form>`,
      (caja) => {
        const copiar = async (t, bien) => {
          try {
            await navigator.clipboard.writeText(t)
            aviso(bien)
          } catch {
            aviso('No se pudo copiar; selecciónalo y cópialo a mano', 'mal')
          }
        }
        $('#f-link', caja).onsubmit = (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          const s = slug(d.nombre)
          if (!s) return aviso('Escribe su nombre', 'mal')
          const de = esAdmin() ? d.de : yo.codigo
          const url = `${PORTAL}/${s}${de ? `?de=${encodeURIComponent(de)}` : ''}`
          const primero = d.nombre.trim().split(/\s+/)[0]
          const msj = `Hola ${primero}, te comparto el catálogo de NXUS AI: ahí ves lo que podemos hacer por tu empresa, nos cuentas qué necesitas en 2 minutos y, si quieres, agendas una reunión con nosotros cuando te acomode:\n${url}`
          $('#link-url', caja).textContent = url
          $('#link-msj', caja).value = msj
          $('#link-wa', caja).href = `https://wa.me/?text=${encodeURIComponent(msj)}`
          $('#link-listo', caja).hidden = false
          $('#link-hacer', caja).textContent = 'Crear otro'
        }
        $('#copiar-link', caja).onclick = () => copiar($('#link-url', caja).textContent, 'Link copiado')
        $('#copiar-msj', caja).onclick = () => copiar($('#link-msj', caja).value, 'Mensaje copiado')
      },
    )
  }

  // -------------------------------------------------------------- leads

  const nombreLead = (l) => l.empresa || l.nombre || 'Sin nombre'
  const duracionLlamada = (seg) => (seg == null ? '' : seg < 60 ? `${seg} s` : `${Math.floor(seg / 60)} min ${String(seg % 60).padStart(2, '0')} s`)
  const chipLead = (l) => `<span class="chip lead-${l.estado}">${l.estado === 'cartera' && l.motivo ? MOTIVO[l.motivo] : LEAD[l.estado]}</span>`
  const diaDe = (s) => {
    const d = new Date(s).toDateString()
    if (d === new Date().toDateString()) return 'Hoy'
    if (d === new Date(Date.now() - 864e5).toDateString()) return 'Ayer'
    return new Date(s).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  /** Un renglón de lead: hora, quién, qué quiere y de dónde vino. */
  const filaLead = (l, { conHora = true } = {}) => `<a class="lead-fila" href="#lead/${l.id}">
      <span class="lead-hora">${conHora ? hora(l.creado) : fechaCorta(l.creado)}</span>
      <span class="lead-quien"><b>${h(nombreLead(l))}</b>${l.empresa && l.nombre ? `<small>${h(l.nombre)}</small>` : ''}</span>
      <span class="lead-que">${l.servicio ? h(l.servicio) : '<span class="vacio">—</span>'}${(() => {
        const r = l.traduccion?.es?.resumen || l.resumen
        return r && ['cartera', 'no_llamar', 'agendado'].includes(l.estado) ? `<small>${h(r.length > 90 ? `${r.slice(0, 90)}…` : r)}</small>` : ''
      })()}</span>
      <span class="lead-chips">${l.canal ? `<span class="chip">${CANAL[l.canal]}</span>` : '<span class="chip">A mano</span>'}${l.pais ? `<span class="chip ${l.pais === 'otro' ? '' : l.pais}">${PAIS[l.pais]}${l.idioma === 'en' ? ' · EN' : ''}</span>` : ''}${l.permiso_llamada || l.motivo === 'sin_permiso' ? '' : '<span class="chip rojo">Sin permiso</span>'}${l.llamada_error && ['nuevo', 'cartera'].includes(l.estado) ? '<span class="chip rojo">⚠ No salió la llamada</span>' : ''}${chipLead(l)}</span>
    </a>`
  /** Los renglones agrupados por día (Hoy, Ayer, sábado 24 de octubre…). */
  const porDia = (lista) => {
    const grupos = []
    for (const l of lista) {
      const d = diaDe(l.creado)
      if (grupos.at(-1)?.[0] !== d) grupos.push([d, []])
      grupos.at(-1)[1].push(l)
    }
    return grupos.map(([d, ls]) => `<h3 class="grupo-dia">${h(d)} <small>${ls.length}</small></h3><div class="leads">${ls.map((l) => filaLead(l)).join('')}</div>`).join('')
  }
  const semana = (s) => Date.now() - new Date(s) < 7 * 864e5

  /** En Inicio: cómo vienen los leads de los anuncios. */
  async function resumenLeads() {
    const leads = await D.leads().catch(() => null)
    if (!leads) return '' // Sin la tabla todavía (falta correr el esquema): Inicio sigue igual.
    if (!leads.length && !esAdmin()) return ''
    const hoy = leads.filter((l) => diaDe(l.creado) === 'Hoy')
    return `<div class="tarjeta"><div class="fila"><h3>Leads de los anuncios</h3><a href="#leads">Ver todos →</a></div>
      <div class="embudo cuatro">
        <a href="#leads"><b>${hoy.filter((l) => l.estado !== 'incompleto').length}</b><span>Calificados hoy</span></a>
        <a href="#leads"><b>${leads.filter((l) => ['nuevo', 'llamando'].includes(l.estado)).length}</b><span>Por llamar</span></a>
        <a href="#prospectos"><b>${leads.filter((l) => l.estado === 'agendado' && semana(l.actualizado)).length}</b><span>Agendaron esta semana</span></a>
        <a href="#cartera"><b>${leads.filter((l) => l.estado === 'cartera').length}</b><span>En cartera</span></a>
      </div></div>`
  }

  async function vistaLeads(v) {
    titulo('Leads')
    const leads = await D.leads()
    const todos = leads.filter((l) => !['cartera', 'no_llamar'].includes(l.estado))
    const FILTROS = { activos: 'Por llamar', agendado: 'Agendaron', incompleto: 'No calificados', todos: 'Todos' }
    const filtro = FILTROS[sessionStorage.getItem('hq-leads')] ? sessionStorage.getItem('hq-leads') : 'activos'
    const lista = todos.filter((l) => (filtro === 'todos' ? true : filtro === 'activos' ? ['nuevo', 'llamando'].includes(l.estado) : l.estado === filtro))
    const calificados = leads.filter((l) => l.estado !== 'incompleto') // también los que ya se fueron a la Cartera
    v.innerHTML = `
      <p class="nota">Aquí caen solos los que terminan el filtro de ManyChat (nombre, empresa, dirección, teléfono, correo y servicio). NEX les llama en cuanto aceptan la llamada en el chat (a cualquier hora): si agendan pasan a <a href="#prospectos">Prospectos</a>; si no, a la <a href="#cartera">Cartera</a>.</p>
      <div class="acciones">
        ${puedePros('trabajar') ? '<button class="btn" id="ld-nuevo">+ Apuntar a mano</button>' : ''}
        <div class="segmento">${Object.entries(FILTROS).map(([k, t]) => `<button data-lf="${k}" class="${filtro === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>Calificados hoy</span><b>${calificados.filter((l) => diaDe(l.creado) === 'Hoy').length}</b><small>${calificados.filter((l) => semana(l.creado)).length} esta semana</small></div>
        <div class="kpi"><span>Por llamar</span><b>${todos.filter((l) => l.estado === 'nuevo').length}</b><small>${todos.filter((l) => l.estado === 'llamando').length} en llamada ahora</small></div>
        <div class="kpi"><span>Agendaron</span><b>${todos.filter((l) => l.estado === 'agendado' && semana(l.actualizado)).length}</b><small>esta semana · ${todos.filter((l) => l.estado === 'agendado').length} en total</small></div>
        <div class="kpi"><span>No calificados</span><b>${todos.filter((l) => l.estado === 'incompleto').length}</b><small>no terminaron el filtro</small></div>
      </div>
      <div class="tarjeta">${lista.length ? porDia(lista) : `<p class="vacio">${filtro === 'activos' ? 'Nadie por llamar ahorita.' : 'Nada aquí todavía.'}</p>`}</div>`
    $$('[data-lf]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-leads', b.dataset.lf), mostrar())))
    $('#ld-nuevo', v)?.addEventListener('click', () => editarLead(null))
  }

  async function vistaCartera(v) {
    titulo('Cartera de prospectos')
    const leads = await D.leads()
    const cartera = leads.filter((l) => l.estado === 'cartera')
    const bloqueados = leads.filter((l) => l.estado === 'no_llamar')
    const filtro = MOTIVO[sessionStorage.getItem('hq-cartera')] ? sessionStorage.getItem('hq-cartera') : 'todos'
    const lista = cartera.filter((l) => filtro === 'todos' || l.motivo === filtro)
    const cuenta = (m) => cartera.filter((l) => l.motivo === m).length
    v.innerHTML = `
      <p class="nota">Los que NEX no pudo agendar. Por ahora nadie los vuelve a llamar solo: se quedan aquí, ordenados, para el call center.</p>
      <div class="acciones"><div class="segmento"><button data-cf="todos" class="${filtro === 'todos' ? 'on' : ''}">Todos <small>${cartera.length}</small></button>${Object.entries(MOTIVO)
        .map(([k, t]) => `<button data-cf="${k}" class="${filtro === k ? 'on' : ''}">${t} <small>${cuenta(k)}</small></button>`)
        .join('')}</div></div>
      <div class="tarjeta">${lista.length ? `<div class="leads">${lista.map((l) => filaLead(l, { conHora: false })).join('')}</div>` : '<p class="vacio">La cartera está vacía.</p>'}</div>
      ${bloqueados.length ? `<details class="tarjeta cerrados"><summary><b>Pidieron no ser llamados</b> <small>${bloqueados.length}</small></summary><p class="nota">Nadie les vuelve a llamar, ni NEX ni el call center.</p><div class="leads">${bloqueados.map((l) => filaLead(l, { conHora: false })).join('')}</div></details>` : ''}`
    $$('[data-cf]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-cartera', b.dataset.cf), mostrar())))
  }

  async function vistaLead(v, lid) {
    const [l, notas, pros] = await Promise.all([D.lead(lid), D.notasLead(lid), D.prospectos()])
    if (!l) {
      titulo('Lead')
      v.innerHTML = '<a class="enlace" href="#leads">← Leads</a><p class="vacio">Ese lead no existe o no te toca verlo.</p>'
      return
    }
    titulo(nombreLead(l))
    const atras = ['cartera', 'no_llamar'].includes(l.estado) ? '<a class="enlace" href="#cartera">← Cartera de prospectos</a>' : '<a class="enlace" href="#leads">← Leads</a>'
    const trabaja = puedePros('trabajar')
    // El resumen y las notas de NEX en español o inglés (el equipo elige; se recuerda).
    let lengua = 'es'
    try {
      lengua = localStorage.getItem('hq-lengua') === 'en' ? 'en' : 'es'
    } catch {}
    if (l.resumen && !l.traduccion?.[lengua]) {
      const t = await D.traducirLead(l.id).catch(() => null)
      if (t) l.traduccion = t
    }
    const version = l.traduccion?.[lengua]
    const resumen = version?.resumen || l.resumen
    const p = { ...(version?.puntos ?? l.puntos ?? {}) }
    if (!esAdmin()) delete p.presupuesto // montos y dinero: solo Eduardo
    const cita = l.prospecto_id && pros.find((x) => x.id === l.prospecto_id)
    const llamada = l.llamada_inicio
      ? `<p><b>${fechaHora(l.llamada_inicio)}</b>${l.llamada_seg != null ? ` · ${duracionLlamada(l.llamada_seg)}` : ' · en curso'}${l.grabacion ? ` · <a href="${h(l.grabacion)}" target="_blank" rel="noopener">Escuchar grabación ↗</a>` : ''}</p>
         ${l.resumen ? `<div class="segmento lengua"><button data-lengua="es" class="${lengua === 'es' ? 'on' : ''}">Español</button><button data-lengua="en" class="${lengua === 'en' ? 'on' : ''}">English</button></div>${version ? '' : `<p class="nota">${lengua === 'es' ? 'Todavía sin traducir: se ve como lo escribió NEX.' : 'Not translated yet: shown as NEX wrote it.'}</p>`}<blockquote>${h(resumen)}</blockquote>` : ''}
         ${Object.keys(p).length ? `<dl class="puntos">${Object.entries(p).sort(([a], [b]) => (Object.keys(PUNTOS).indexOf(a) + 99) % 99 - (Object.keys(PUNTOS).indexOf(b) + 99) % 99).map(([k, t]) => `<dt>${h(PUNTOS[k] || k)}</dt><dd>${h(t)}</dd>`).join('')}</dl>` : ''}
         ${l.transcripcion ? `<details><summary>Ver la conversación completa</summary><pre class="transcripcion">${h(l.transcripcion)}</pre></details>` : ''}`
      : `<p class="vacio">${l.estado === 'incompleto' ? 'No terminó el filtro de ManyChat: NEX no le llama.' : !l.permiso_llamada ? 'No dio permiso de que una IA le llame: NEX no le llama.' : l.estado === 'nuevo' && !l.llamada_error ? '⏳ NEX todavía no le llama: le llama en 1 o 2 minutos desde que aceptó en el chat.' : 'NEX todavía no ha hablado con él.'}</p>`
    // Si ya le llamó, si está llamando ahora (en vivo) o por qué no salió la llamada.
    const enVivo =
      l.estado === 'llamando'
        ? '<div class="estado-llamada" id="ld-en-vivo"><span class="punto-vivo"></span><b>📞 NEX le está llamando</b> · <span id="ld-en-vivo-texto">Marcando…</span></div>'
        : l.llamada_error && ['nuevo', 'cartera'].includes(l.estado)
          ? `<div class="estado-llamada mal"><b>⚠ ${h(l.llamada_error)}</b>${l.intentos ? `<small> · intento ${l.intentos} de 3</small>` : ''}</div>`
          : l.llamada_seg != null
            ? `<div class="estado-llamada bien"><b>✅ NEX ya le llamó</b>${l.llamada_seg ? ` · habló ${duracionLlamada(l.llamada_seg)}` : ' · no contestó'}</div>`
            : ''
    v.innerHTML = `
      ${atras}
      <div class="ficha dos-cols">
        <div class="tarjeta">
          <div class="fila chips">${chipLead(l)}${l.canal ? `<span class="chip">${CANAL[l.canal]}</span>` : '<span class="chip">Apuntado a mano</span>'}${l.pais ? `<span class="chip ${l.pais === 'otro' ? '' : l.pais}">${PAIS[l.pais]}</span>` : ''}<span class="chip">${l.idioma === 'en' ? 'Inglés' : 'Español'}</span></div>
          <h3>Contacto</h3>
          <p><b>${h(l.nombre || '—')}</b>${l.empresa ? ` · ${h(l.empresa)}` : ''}</p>
          <p>${[l.telefono && `<a href="tel:${h(l.telefono.replace(/[^\d+]/g, ''))}">${h(l.telefono)}</a>`, l.telefono && `<a href="https://wa.me/${h(l.telefono.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>`, l.correo && `<a href="mailto:${h(l.correo)}">${h(l.correo)}</a>`].filter(Boolean).join(' · ') || '<span class="vacio">Sin teléfono ni correo.</span>'}</p>
          ${l.direccion || l.ciudad ? `<p><small>${h([l.direccion, l.ciudad].filter(Boolean).join(' · '))}</small></p>` : ''}
          <h3>Lo que le interesa</h3>
          <p>${l.servicio ? h(l.servicio) : '<span class="vacio">No lo dijo.</span>'}</p>
          <p><small>Llegó ${fechaHora(l.creado)}${l.fuente ? ` · ${h(l.fuente)}` : ''}${l.anuncio_id ? ` · anuncio ${h(l.anuncio_id)}` : ''}${l.asignado ? ` · Lo trabaja: ${h(nombreDe(l.asignado))}` : ''}</small></p>
          <h3>Permiso para que una IA le llame</h3>
          ${l.permiso_llamada ? `<p class="verde">✓ Aceptó el ${fechaHora(l.permiso_fecha)}</p>${l.permiso_texto ? `<p><small>“${h(l.permiso_texto)}”</small></p>` : ''}` : '<p class="rojo">✗ No dio permiso. No se le puede llamar con IA.</p>'}
          ${cita?.cita ? `<h3>Meeting</h3><p>📅 <b>${fechaHora(cita.cita)}</b> · 30 minutos</p>${botonMeet(cita) ? `<p>${botonMeet(cita)}</p>` : ''}` : ''}
          ${l.prospecto_id ? `<p><a class="btn" href="#prospecto/${l.prospecto_id}">Ver en Prospectos →</a></p>` : ''}
          <div class="acciones">
            ${trabaja && l.permiso_llamada && ['nuevo', 'cartera'].includes(l.estado) ? '<button class="btn primario" id="ld-llamar">📞 Llamar ahora</button>' : ''}
            ${trabaja && !l.prospecto_id && l.estado !== 'no_llamar' ? '<button class="btn" id="ld-agendo">✓ Agendó: pasar a Prospectos</button>' : ''}
            ${trabaja && ['nuevo', 'llamando', 'incompleto'].includes(l.estado) ? '<button class="btn" id="ld-cartera">Mandar a Cartera</button>' : ''}
            ${trabaja && (['cartera', 'incompleto'].includes(l.estado) || (l.estado === 'no_llamar' && esAdmin())) && l.permiso_llamada ? '<button class="btn" id="ld-regresar">Regresar a Por llamar</button>' : ''}
            ${trabaja && l.estado !== 'no_llamar' && !l.prospecto_id ? '<button class="btn" id="ld-bloquear">🚫 No volver a llamar</button>' : ''}
            ${esAdmin() ? `<label class="mini">Lo trabaja<select id="ld-asignar">${opcionesPersonas(l.asignado, 'Nadie')}</select></label>` : ''}
            ${trabaja ? '<button class="btn" id="ld-editar">Editar datos</button>' : ''}
            ${esAdmin() ? '<button class="btn peligro" id="ld-borrar">Borrar</button>' : ''}
          </div>
        </div>
        <div class="tarjeta">
          <h3>Llamada de NEX</h3>
          ${enVivo}
          ${llamada}
        </div>
        <div class="tarjeta ancho-total">
          <h3>Notas <small>no se borran ni se cambian</small></h3>
          ${notas.length ? `<ul class="lista notas">${notas.map((n) => `<li><b>${h(nombreDe(n.autor))}</b><small>${fechaCorta(n.creada)} ${hora(n.creada)}</small><p>${h(n.texto)}</p></li>`).join('')}</ul>` : '<p class="vacio">Sin notas todavía.</p>'}
          ${trabaja ? `<form id="ld-nota"><textarea name="texto" rows="2" maxlength="2000" required placeholder="Qué pasó: le llamó el call center, pidió que lo busquen en enero…"></textarea><div class="acciones"><button class="btn">Agregar nota</button></div></form>` : ''}
        </div>
      </div>`
    const guardar = async (cambio, bien) => (await intenta(() => D.guardarLead({ id: l.id, ...cambio }), bien)) && mostrar()
    $$('[data-lengua]', v).forEach(
      (b) =>
        (b.onclick = () => {
          try {
            localStorage.setItem('hq-lengua', b.dataset.lengua)
          } catch {}
          mostrar()
        }),
    )
    $('#ld-llamar', v)?.addEventListener('click', async () => {
      if (!confirm(`¿Que NEX le llame ahora a ${nombreLead(l)} (${l.telefono})?`)) return
      const b = $('#ld-llamar', v)
      b.disabled = true
      b.textContent = 'Marcando…'
      await intenta(() => D.llamarLead(l.id), 'La llamada salió: NEX le está llamando. Aquí ves cómo va.')
      mostrar() // si no salió, aquí queda el porqué y el botón para volver a intentar
    })
    // Mientras NEX llama: cómo va, en vivo (marcando, en llamada, terminó o no salió).
    if (l.estado === 'llamando') {
      const ruta = location.hash
      const revisar = async () => {
        if (location.hash !== ruta) return
        const r = await D.estadoLlamada(l.id).catch(() => null)
        if (location.hash !== ruta) return
        if (r?.terminado || r?.llamada === 'failed') return setTimeout(mostrar, r?.terminado ? 0 : 3000)
        const t = $('#ld-en-vivo-texto', v)
        if (t && r) t.textContent = `${r.texto}${r.llamada === 'in-progress' && r.seg ? ` · ${duracionLlamada(r.seg)}` : ''}`
        setTimeout(revisar, 4000)
      }
      setTimeout(revisar, 1500)
    }
    $('#ld-agendo', v)?.addEventListener('click', () => agendoLead(l))
    $('#ld-cartera', v)?.addEventListener('click', () => mandarACartera(l))
    $('#ld-regresar', v)?.addEventListener('click', () => guardar({ estado: 'nuevo', intentos: 0, llamada_error: '' }, 'De vuelta en Por llamar: NEX le llama en 1 o 2 minutos'))
    $('#ld-bloquear', v)?.addEventListener('click', () => {
      if (confirm(`¿${nombreLead(l)} pidió no ser llamado? Nadie le vuelve a llamar, ni NEX ni el call center.`)) guardar({ estado: 'no_llamar' }, 'Marcado: no volver a llamar')
    })
    $('#ld-asignar', v)?.addEventListener('change', (e) => guardar({ asignado: e.target.value || null }, 'Asignado'))
    $('#ld-editar', v)?.addEventListener('click', () => editarLead(l))
    $('#ld-nota', v)?.addEventListener('submit', async (e) => {
      e.preventDefault()
      const texto = e.target.texto.value.trim()
      if (texto && (await intenta(() => D.agregarNotaLead(l.id, texto), 'Nota agregada'))) mostrar()
    })
    $('#ld-borrar', v)?.addEventListener('click', async () => {
      if (!confirm(`¿Borrar a ${nombreLead(l)} con sus notas? No se puede deshacer.`)) return
      if ((await intenta(() => D.borrarLead(l.id), 'Lead borrado')) !== undefined) location.hash = '#leads'
    })
  }

  /** Agendó: pasa a Prospectos, con su cita si ya la tiene. */
  function agendoLead(l) {
    abrirModal(
      `<form id="f-agendo"><h2>✓ ${h(nombreLead(l))} agendó</h2>
        <p class="nota">Pasa a Prospectos con todo lo que se sabe de él. Si ya tiene fecha, ponla y queda en "Cita agendada"; si no, en "Dejó sus datos".</p>
        <div class="campos">
          <label>Fecha y hora del meeting<input name="cita" type="datetime-local"></label>
          <label>Link de Google Meet<input name="meet" type="url" maxlength="300" placeholder="https://meet.google.com/…"></label>
        </div>
        <div class="acciones"><button class="btn primario">Pasar a Prospectos</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-agendo', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          const pid = await intenta(() => D.leadAProspecto(l.id, d.cita ? new Date(d.cita).toISOString() : null, d.meet.trim()), 'Ya está en Prospectos')
          if (!pid) return
          cerrarModal()
          location.hash = `#prospecto/${pid}`
        }
      },
    )
  }

  function mandarACartera(l) {
    abrirModal(
      `<form id="f-cartera"><h2>Mandar a la Cartera</h2>
        <div class="campos">
          <label class="ancho">Por qué<select name="motivo">${Object.entries(MOTIVO).map(([k, t]) => `<option value="${k}" ${k === (l.permiso_llamada ? 'no_contesto' : 'sin_permiso') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label class="ancho">Nota (opcional)<textarea name="nota" rows="2" maxlength="2000" placeholder="Ej.: pidió que lo busquen en enero"></textarea></label>
        </div>
        <div class="acciones"><button class="btn primario">Mandar a Cartera</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-cartera', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          if (!(await intenta(() => D.guardarLead({ id: l.id, estado: 'cartera', motivo: d.motivo }), 'En la Cartera'))) return
          if (d.nota.trim()) await intenta(() => D.agregarNotaLead(l.id, d.nota.trim()))
          cerrarModal()
          mostrar()
        }
      },
    )
  }

  function editarLead(l) {
    const opciones = (obj, actual, vacio) => `${vacio ? `<option value="">${vacio}</option>` : ''}${Object.entries(obj).map(([k, t]) => `<option value="${k}" ${k === actual ? 'selected' : ''}>${t}</option>`).join('')}`
    abrirModal(
      `<form id="f-lead"><h2>${l ? 'Datos del lead' : 'Apuntar un lead'}</h2>
        ${l ? '' : '<p class="nota">Para alguien que llegó por otro lado y quieres que NEX le llame. Sin su permiso por escrito no se le puede llamar con IA: queda en la Cartera.</p>'}
        <div class="campos">
          <label>Nombre<input name="nombre" maxlength="80" required value="${h(l?.nombre)}"></label>
          <label>Empresa<input name="empresa" maxlength="120" value="${h(l?.empresa)}"></label>
          <label>Teléfono (con lada del país)<input name="telefono" maxlength="30" placeholder="+1 973 555 0100" value="${h(l?.telefono)}"></label>
          <label>Correo<input name="correo" type="email" maxlength="120" value="${h(l?.correo)}"></label>
          <label class="ancho">Dirección de la empresa<input name="direccion" maxlength="200" value="${h(l?.direccion)}"></label>
          <label>Ciudad<input name="ciudad" maxlength="80" value="${h(l?.ciudad)}"></label>
          <label>País<select name="pais">${opciones(PAIS, l?.pais, '—')}</select></label>
          <label>Idioma de la llamada<select name="idioma">${opciones({ es: 'Español', en: 'Inglés' }, l?.idioma ?? 'es')}</select></label>
          <label class="ancho">Servicio que le interesa<input name="servicio" maxlength="200" value="${h(l?.servicio)}"></label>
          ${
            l?.permiso_llamada
              ? ''
              : `<label class="ancho check"><input type="checkbox" name="permiso_llamada"> Me dio permiso por escrito de que una IA le llame</label>
                 <label class="ancho">Cómo lo dio<input name="permiso_texto" maxlength="500" placeholder="Ej.: por WhatsApp a Eduardo el 31 de octubre"></label>`
          }
        </div>
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-lead', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          const fila = { nombre: d.nombre.trim(), empresa: d.empresa.trim(), telefono: d.telefono.trim(), correo: d.correo.trim().toLowerCase(), direccion: d.direccion.trim(), ciudad: d.ciudad.trim(), pais: d.pais, idioma: d.idioma, servicio: d.servicio.trim() }
          if (!l?.permiso_llamada && d.permiso_llamada) {
            if (!d.permiso_texto.trim()) return aviso('Escribe cómo te dio el permiso', 'mal')
            Object.assign(fila, { permiso_llamada: true, permiso_texto: d.permiso_texto.trim() })
          }
          if (!l) Object.assign(fila, fila.permiso_llamada ? { estado: 'nuevo' } : { estado: 'cartera', motivo: 'sin_permiso' })
          const r = await intenta(() => D.guardarLead(l ? { id: l.id, ...fila } : fila), 'Guardado')
          if (!r) return
          cerrarModal()
          if (l) mostrar()
          else location.hash = `#lead/${r.id}`
        }
      },
    )
  }

  // -------------------------------------------------------------- tareas

  async function vistaTareas(v) {
    titulo('Tareas de NXUS')
    // Solo las tareas de NXUS: cada cliente lleva las suyas en su propio panel.
    const tareas = (await D.tareas()).filter((t) => !t.cliente_id)
    const filtro = sessionStorage.getItem('hq-tareas') || (puede('tareas_todas') ? 'todas' : 'mias')
    const lista = filtro === 'mias' ? tareas.filter((t) => t.asignado === yo.id) : tareas
    v.innerHTML = `
      <div class="acciones"><button class="btn primario" id="t-nueva">+ Nueva tarea</button>
        <div class="segmento"><button data-f="mias" class="${filtro === 'mias' ? 'on' : ''}">Mías</button><button data-f="todas" class="${filtro === 'todas' ? 'on' : ''}">${esAdmin() ? 'Todas' : 'Todas las que veo'}</button></div></div>
      <div class="tablero">${Object.entries(TAREA)
        .map(([e, t]) => {
          const col = lista.filter((x) => x.estado === e)
          return `<div class="columna"><h3>${t} <small>${col.length}</small></h3>${col
            .map(
              (x) => `<div class="tarea ${x.vence && x.vence < hoyISO() && e !== 'hecha' ? 'atrasada' : ''}" data-t="${x.id}">
                <b>${h(x.titulo)}</b>
                <small>${h(nombreDe(x.asignado))}${x.vence ? ` · ${fechaCorta(x.vence)}` : ''}</small>
                <div class="mover">${Object.keys(TAREA).filter((k) => k !== e).map((k) => `<button class="btn chico" data-mover="${k}">${TAREA[k]}</button>`).join('')}</div>
              </div>`,
            )
            .join('') || '<p class="vacio">—</p>'}</div>`
        })
        .join('')}</div>`
    $('#t-nueva', v).onclick = () => editarTarea({})
    $$('[data-f]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-tareas', b.dataset.f), mostrar())))
    $$('.tarea', v).forEach((el) => {
      const t = tareas.find((x) => x.id === el.dataset.t)
      el.onclick = (e) => {
        const m = e.target.closest('[data-mover]')
        if (m) return intenta(() => D.guardarTarea({ id: t.id, estado: m.dataset.mover })).then((r) => r && mostrar())
        if (puede('tareas_todas') || t.creada_por === yo.id) editarTarea(t)
      }
    })
  }

  function editarTarea(t) {
    abrirModal(
      `<form id="f-tarea"><h2>${t.id ? 'Editar tarea' : 'Nueva tarea'}</h2>
        <div class="campos">
          <label class="ancho">Qué hay que hacer<input name="titulo" required maxlength="200" value="${h(t.titulo)}"></label>
          <label class="ancho">Detalle<textarea name="detalle" rows="3">${h(t.detalle)}</textarea></label>
          <label>Para<select name="asignado">${opcionesPersonas(t.asignado ?? yo.id, 'Sin asignar')}</select></label>
          <label>Vence<input name="vence" type="date" value="${h(t.vence || '')}"></label>
          <label>Estado<select name="estado">${opciones(TAREA, t.estado || 'pendiente')}</select></label>
        </div>
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button>
        ${t.id && puede('tareas_borrar') ? '<button type="button" class="btn peligro" id="t-borrar">Borrar</button>' : ''}</div></form>`,
      (caja) => {
        $('#f-tarea', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          const ok = await intenta(
            () => D.guardarTarea({ ...(t.id ? { id: t.id } : {}), titulo: d.titulo.trim(), detalle: d.detalle.trim(), cliente_id: null, asignado: d.asignado || null, vence: d.vence || null, estado: d.estado }),
            'Tarea guardada',
          )
          if (ok) {
            cerrarModal()
            mostrar()
          }
        }
        $('#t-borrar', caja)?.addEventListener('click', async () => {
          if (!confirm('¿Borrar esta tarea?')) return
          if ((await intenta(() => D.borrarTarea(t.id), 'Tarea borrada')) !== undefined) {
            cerrarModal()
            mostrar()
          }
        })
      },
    )
  }

  // -------------------------------------------------------------- equipo

  async function vistaEquipo(v) {
    titulo('Equipo')
    personas = await D.personas()
    const activos = personas.filter((p) => p.activo)
    // Asistencia (el admin o con permiso): quién marcó entrada hoy, a qué hora y si ya salió.
    let hoyJ = []
    const verAsis = puede('asistencia_ver')
    if (verAsis) {
      const ini = new Date()
      ini.setHours(0, 0, 0, 0)
      const fin = new Date(ini.getTime() + 864e5)
      const [deHoy, abiertasYa] = await Promise.all([D.jornadas(ini, fin), D.abiertas()])
      hoyJ = [...deHoy, ...abiertasYa.filter((a) => !deHoy.some((j) => j.id === a.id))]
    }
    const estadoHoy = (p) => {
      if (!verAsis) return ''
      const suyas = hoyJ.filter((j) => j.persona === p.id).sort((a, b) => String(a.entrada).localeCompare(String(b.entrada)))
      if (!suyas.length) return '<span class="asis fuera">No ha marcado entrada hoy</span>'
      const ab = suyas.find((j) => !j.salida)
      const total = suyas.reduce((s, j) => s + duracion(j), 0)
      return ab
        ? `<span class="asis vivo"><i class="punto vivo"></i>Trabajando desde ${hora(ab.entrada)}</span>`
        : `<span class="asis">Entró ${hora(suyas[0].entrada)} · salió ${hora(suyas.at(-1).salida)} · ${horas(total)}</span>`
    }
    const bloque = async (sede) => {
      const ps = activos.filter((p) => p.sede === sede)
      if (!ps.length) return ''
      const cards = await Promise.all(
        ps.map(async (p) => `<div class="persona">${esAdmin() ? `<button class="foto-btn" data-foto="${p.id}" title="Poner o cambiar su foto">📷</button>` : ''}${await avatar(p, 'grande')}<b>${h(p.nombre)}</b><span>${h(p.cargo || '—')}</span><span class="chip ${p.sede}">${SEDE[p.sede]}</span>${estadoHoy(p)}</div>`),
      )
      return `<h2 class="grupo">${SEDE[sede]} <small>${ps.length}</small></h2><div class="rejilla personas">${cards.join('')}</div>`
    }
    const nota = verAsis ? `<p class="nota">Asistencia de hoy en cada tarjeta. Todo el historial de entradas y salidas: <a href="#nomina">Nómina → Asistencia</a>.${esAdmin() ? ' Toca 📷 en una tarjeta para ponerle su foto (solo tú puedes).' : ''}</p>` : ''
    v.innerHTML = nota + (await bloque('usa')) + (await bloque('mexico')) + (esAdmin() ? '<input type="file" id="foto-in" accept="image/jpeg,image/png,image/webp" hidden>' : '')
    // Fotos del equipo: solo el admin las pone o cambia (la base de datos no deja a nadie más subir ni borrar).
    const entrada = $('#foto-in', v)
    let paraQuien = null
    $$('[data-foto]', v).forEach((b) => (b.onclick = () => ((paraQuien = b.dataset.foto), entrada.click())))
    entrada?.addEventListener('change', async () => {
      const f = entrada.files?.[0]
      entrada.value = ''
      if (!f || !paraQuien) return
      if (f.size > 5 * 1024 * 1024) return aviso('La foto pesa más de 5 MB', 'mal')
      if (await intenta(() => D.subirFoto(paraQuien, f), 'Foto actualizada')) {
        personas = await D.personas()
        mostrar()
      }
    })
  }

  // --------------------------------------------------------------- reloj

  async function vistaReloj(v) {
    titulo('Mi reloj')
    const q = quincena()
    const mias = (await D.jornadas(q.desde, q.hasta)).filter((j) => j.persona === yo.id)
    const total = mias.reduce((s, j) => s + duracion(j), 0)
    v.innerHTML = `
      <div class="tarjeta reloj-grande">
        <div class="estado ${abierta ? 'vivo' : ''}"><span class="punto ${abierta ? 'vivo' : ''}"></span>${abierta ? `Trabajando desde las ${hora(abierta.entrada)}` : 'Fuera'}</div>
        <button class="btn grande ${abierta ? '' : 'primario'}" id="rg">${abierta ? 'Marcar salida' : 'Marcar entrada'}</button>
        <small>La hora la pone el sistema, no se puede cambiar a mano.</small>
      </div>
      <div class="tarjeta"><div class="fila"><h3>Esta quincena · ${h(q.nombre)}</h3><b>${horas(total)}</b></div>
        ${mias.length ? `<table class="tabla"><tr><th>Día</th><th>Entrada</th><th>Salida</th><th>Tiempo</th></tr>${mias.map((j) => `<tr><td>${fechaCorta(j.entrada)}${j.dia_completo ? ' <span class="chip">día completo</span>' : ''}</td><td>${hora(j.entrada)}</td><td>${j.salida ? hora(j.salida) : '<span class="chip en-curso">abierta</span>'}</td><td>${horas(duracion(j))}</td></tr>`).join('')}</table>` : '<p class="vacio">Aún no hay registros esta quincena.</p>'}
      </div>`
    $('#rg', v).onclick = () => (abierta ? marcarSalida() : marcarEntrada())
  }

  // -------------------------------------------------------------- nómina

  let saltoNomina = 0
  // Pestañas de Nómina: Pagos (quincena) y Asistencia (el registro de entradas y salidas, con todo el historial).
  const pestanasNomina = (tab) =>
    `<div class="acciones"><div class="segmento">${[['pagos', 'Pagos'], ['asistencia', 'Asistencia']].filter(([k]) => (k === 'pagos' ? puede('nomina_ver') : puede('asistencia_ver'))).map(([k, t]) => `<button data-nt="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>`
  const conectarPestanasNomina = (v) => $$('[data-nt]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-nomina', b.dataset.nt), mostrar())))

  async function vistaNomina(v) {
    titulo('Nómina')
    if (!puede('nomina_ver') || (sessionStorage.getItem('hq-nomina') === 'asistencia' && puede('asistencia_ver'))) return vistaAsistencia(v)
    const q = quincena(new Date(), saltoNomina)
    const [nom, jor, aju, com, din] = await Promise.all([D.nomina(), D.jornadas(q.desde, q.hasta), D.ajustes(), D.comisiones(), D.dinero()])
    ;[personas, clientes] = await Promise.all([D.personas(), D.clientes()])
    const trajo = (pid) => clientes.filter((c) => c.traido_por === pid && c.estado === 'activo').map((c) => ({ c, d: din.find((x) => x.cliente_id === c.id) ?? {} }))
    const equipo = personas.filter((p) => p.rol !== 'admin' && p.activo)
    const totales = { USD: 0, MXN: 0 }
    const filas = equipo.map((p) => {
      const n = nom.find((x) => x.persona === p.id)
      if (!n) return { p, n: null }
      const r = calcularPago(n, { jornadas: jor, ajustes: aju, comisiones: com, desde: q.desde, hasta: q.hasta })
      totales[n.moneda] += r.total
      return { p, n, r }
    })
    v.innerHTML = `${pestanasNomina('pagos')}
      <div class="acciones"><div class="segmento"><button id="q-ant">← Anterior</button><button class="on">${h(q.nombre)}</button><button id="q-sig" ${saltoNomina >= 0 ? 'disabled' : ''}>Siguiente →</button></div></div>
      <div class="kpis"><div class="kpi"><span>A pagar esta quincena</span><b>${dinero(totales.MXN, 'MXN')}</b><small>${totales.USD ? `+ ${dinero(totales.USD)}` : 'en pesos'}</small></div>
        <div class="kpi"><span>Al mes (aprox.)</span><b>${dinero(totales.MXN * 2, 'MXN')}</b><small>${totales.USD ? `+ ${dinero(totales.USD * 2)}` : 'dos quincenas como esta'}</small></div></div>
      ${filas
        .map(({ p, n, r }) =>
          !n
            ? `<div class="tarjeta"><div class="fila"><b>${h(p.nombre)}</b>${puede('nomina_editar') ? `<button class="btn chico" data-esq="${p.id}">Poner su pago</button>` : ''}</div><p class="vacio">Sin esquema de pago todavía.</p></div>`
            : `<div class="tarjeta pago">
                <div class="fila"><div><b>${h(p.nombre)}</b> <span class="chip">${ESQUEMA[n.esquema]}</span> <span class="chip ${p.sede}">${SEDE[p.sede]}</span></div><b class="total">${dinero(r.total, n.moneda)}</b></div>
                <div class="desglose">
                  ${n.esquema !== 'comision' ? `<span>Base quincenal <b>${dinero(r.base, n.moneda)}</b></span>` : ''}
                  ${n.esquema === 'medio-tiempo' ? `<span>Días completos <b>${r.completos} × ${dinero(valorDiaCompleto(n), n.moneda)} = ${dinero(r.extra, n.moneda)}</b>${Number(n.pago_dia_completo) > 0 ? '' : ' <small>(calculado)</small>'}</span>` : ''}
                  ${n.esquema === 'comision' ? `<span>Comisiones <b>${dinero(r.comision, n.moneda)}</b> <small>(${r.mias.length} contratos al ${n.porcentaje}%)</small></span>` : ''}
                  ${r.ajuste ? `<span>Ajustes <b>${dinero(r.ajuste, n.moneda)}</b></span>` : ''}
                  <span>Horas registradas <b>${horas(r.trabajado)}</b></span>
                </div>
                <div class="acciones">${puede('nomina_editar') ? `<button class="btn chico" data-esq="${p.id}">Su pago</button><button class="btn chico" data-aj="${p.id}">+ Ajuste</button>${n.esquema === 'comision' ? `<button class="btn chico" data-com="${p.id}">+ Comisión</button>` : ''}` : ''}<button class="btn chico" data-dias="${p.id}">Ver días</button></div>
                ${r.misAjustes.length ? `<ul class="lista">${r.misAjustes.map((a) => `<li><small>${fechaCorta(a.fecha)}</small> ${h(a.concepto)} <b>${dinero(a.monto, n.moneda)}</b> ${puede('nomina_editar') ? `<button class="enlace" data-borrar-aj="${a.id}">quitar</button>` : ''}</li>`).join('')}</ul>` : ''}
                ${
                  n.esquema === 'comision' && trajo(p.id).length
                    ? `<div class="sugeridas"><small>Clientes que trajo (activos):</small><ul class="lista">${trajo(p.id)
                        .map(({ c, d }) => `<li>${h(c.nombre)} <small>${d.mensualidad ? `${dinero(d.mensualidad, d.moneda)}/mes` : 'sin monto'}</small> ${puede('nomina_editar') ? `<button class="btn chico" data-cobro="${p.id}" data-cli="${c.id}">Registrar cobro</button>` : ''}</li>`)
                        .join('')}</ul></div>`
                    : ''
                }
                ${r.mias.length ? `<ul class="lista">${r.mias.map((c) => `<li><small>${fechaCorta(c.fecha)}</small> ${h(clienteDe(c.cliente_id)?.nombre ?? c.concepto)} · cobrado ${dinero(c.monto_cobrado, c.moneda)} → <b>${dinero((c.monto_cobrado * c.porcentaje) / 100, c.moneda)}</b> ${puede('nomina_editar') ? `<button class="enlace" data-borrar-com="${c.id}">quitar</button>` : ''}</li>`).join('')}</ul>` : ''}
              </div>`,
        )
        .join('')}
      <p class="nota">Medio tiempo: cuenta como día completo el que tú marques, o cualquier día con ${DIA_COMPLETO_HORAS} horas o más registradas. Si no le pones monto, el sistema paga las horas de más a su tarifa por hora (día completo = ${JORNADA_COMPLETA} horas).</p>`
    conectarPestanasNomina(v)
    $('#q-ant', v).onclick = () => (saltoNomina--, mostrar())
    $('#q-sig', v).onclick = () => (saltoNomina++, mostrar())
    $$('[data-esq]', v).forEach((b) => (b.onclick = () => editarEsquema(persona(b.dataset.esq), nom.find((x) => x.persona === b.dataset.esq))))
    $$('[data-aj]', v).forEach((b) => (b.onclick = () => nuevoAjuste(persona(b.dataset.aj))))
    $$('[data-com]', v).forEach((b) => (b.onclick = () => nuevaComision(persona(b.dataset.com), nom.find((x) => x.persona === b.dataset.com))))
    $$('[data-cobro]', v).forEach(
      (b) =>
        (b.onclick = () => {
          const d = din.find((x) => x.cliente_id === b.dataset.cli) ?? {}
          nuevaComision(persona(b.dataset.cobro), nom.find((x) => x.persona === b.dataset.cobro), { cliente_id: b.dataset.cli, monto_cobrado: d.mensualidad || '', moneda: d.moneda })
        }),
    )
    $$('[data-dias]', v).forEach((b) => (b.onclick = () => verDias(persona(b.dataset.dias), jor)))
    $$('[data-borrar-aj]', v).forEach((b) => (b.onclick = () => intenta(() => D.borrarAjuste(b.dataset.borrarAj), 'Ajuste quitado').then(() => mostrar())))
    $$('[data-borrar-com]', v).forEach((b) => (b.onclick = () => intenta(() => D.borrarComision(b.dataset.borrarCom), 'Comisión quitada').then(() => mostrar())))
  }

  // ------------------------------------------------------- asistencia
  // Todo el historial de entradas y salidas del equipo: se guarda para siempre (nadie del equipo
  // puede borrar ni cambiar horas; las correcciones del admin quedan en la Bitácora).

  const diaJor = (iso) => new Date(iso).toLocaleDateString('en-CA') // AAAA-MM-DD en la hora de esta computadora
  const aFecha = (d) => d.toLocaleDateString('en-CA')
  const deFecha = (t) => new Date(`${t}T00:00`)
  const aLocal = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${aFecha(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const horasDec = (ms) => (Math.max(0, ms) / 3600000).toFixed(2)
  const diaLargo = (t) => {
    const x = deFecha(t).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    return x.charAt(0).toUpperCase() + x.slice(1)
  }

  function periodoAsistencia(clave) {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const mas = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
    const lunes = mas(hoy, -((hoy.getDay() + 6) % 7))
    const q = quincena(), qa = quincena(new Date(), -1)
    return (
      {
        hoy: { desde: hoy, hasta: mas(hoy, 1) },
        ayer: { desde: mas(hoy, -1), hasta: hoy },
        semana: { desde: lunes, hasta: mas(hoy, 1) },
        'semana-pasada': { desde: mas(lunes, -7), hasta: lunes },
        quincena: { desde: q.desde, hasta: q.hasta },
        'quincena-pasada': { desde: qa.desde, hasta: qa.hasta },
        mes: { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1) },
        'mes-pasado': { desde: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth(), 1) },
        anio: { desde: new Date(hoy.getFullYear(), 0, 1), hasta: new Date(hoy.getFullYear() + 1, 0, 1) },
      }[clave] ?? null
    )
  }
  const PERIODOS = { hoy: 'Hoy', ayer: 'Ayer', semana: 'Esta semana', 'semana-pasada': 'Semana pasada', quincena: 'Esta quincena', 'quincena-pasada': 'Quincena pasada', mes: 'Este mes', 'mes-pasado': 'Mes pasado', anio: 'Este año', rango: 'Elegir fechas…' }

  async function vistaAsistencia(v) {
    let filtro = {}
    try { filtro = JSON.parse(sessionStorage.getItem('hq-asis') || '{}') } catch {}
    const per = PERIODOS[filtro.per] ? filtro.per : 'quincena'
    let rango = periodoAsistencia(per)
    if (per === 'rango') {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(filtro.desde) ? deFecha(filtro.desde) : periodoAsistencia('mes').desde
      const a = /^\d{4}-\d{2}-\d{2}$/.test(filtro.hasta) ? deFecha(filtro.hasta) : new Date()
      rango = { desde: d, hasta: new Date(a.getFullYear(), a.getMonth(), a.getDate() + 1) }
    }
    const quien = filtro.quien || ''
    const corrige = puede('asistencia_corregir')
    const [jor, todas] = await Promise.all([D.jornadas(rango.desde, rango.hasta), D.personas()])
    personas = todas
    const lista = jor.filter((j) => !quien || j.persona === quien).sort((a, b) => String(b.entrada).localeCompare(String(a.entrada)))
    const ultimoDia = new Date(rango.hasta.getTime() - 864e5)
    const etiqueta = `${diaLargo(aFecha(rango.desde))}${aFecha(rango.desde) === aFecha(ultimoDia) ? '' : ` — ${diaLargo(aFecha(ultimoDia))}`}`

    // Resumen por persona
    const porPersona = new Map()
    for (const j of lista) {
      const r = porPersona.get(j.persona) ?? { ms: 0, dias: new Set(), completos: new Set(), abiertas: 0, registros: 0, entradas: [] }
      r.ms += duracion(j)
      r.dias.add(diaJor(j.entrada))
      if (j.dia_completo || (j.salida && duracion(j) >= DIA_COMPLETO_HORAS * 3600000)) r.completos.add(diaJor(j.entrada))
      if (!j.salida) r.abiertas++
      r.registros++
      const d = new Date(j.entrada)
      r.entradas.push(d.getHours() * 60 + d.getMinutes())
      porPersona.set(j.persona, r)
    }
    const resumen = [...porPersona.entries()].map(([pid, r]) => ({ pid, nombre: nombreDe(pid), ...r })).sort((a, b) => a.nombre.localeCompare(b.nombre))
    const totalMs = resumen.reduce((s, r) => s + r.ms, 0)
    const diasTot = resumen.reduce((s, r) => s + r.dias.size, 0)
    const abiertasTot = lista.filter((j) => !j.salida).length
    const olvidos = lista.filter((j) => !j.salida && diaJor(j.entrada) < aFecha(new Date())).length
    const promedioEntrada = (arr) => {
      if (!arr.length) return '—'
      const m = Math.round(arr.reduce((s, x) => s + x, 0) / arr.length)
      return new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
    }
    const opcPersonas = `<option value="">Todo el equipo</option>${todas
      .slice()
      .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre))
      .map((p) => `<option value="${p.id}" ${p.id === quien ? 'selected' : ''}>${h(p.nombre)}${p.activo ? '' : ' (ya no está)'}</option>`)
      .join('')}`

    // Detalle agrupado por día
    const porDia = new Map()
    for (const j of lista) porDia.set(diaJor(j.entrada), [...(porDia.get(diaJor(j.entrada)) ?? []), j])
    const detalle = [...porDia.entries()]
      .map(
        ([dia, js]) => `<tr class="dia-asis"><td colspan="7">${diaLargo(dia)} <small>${horas(js.reduce((s, j) => s + duracion(j), 0))}</small></td></tr>${js
          .map(
            (j) => `<tr>
              <td>${h(nombreDe(j.persona))}</td>
              <td>${hora(j.entrada)}</td>
              <td>${j.salida ? `${hora(j.salida)}${diaJor(j.salida) !== dia ? ` <small>(${fechaCorta(j.salida)})</small>` : ''}` : diaJor(j.entrada) < aFecha(new Date()) ? '<span class="chip rojo-chip">sin salida</span>' : '<span class="chip en-curso">trabajando</span>'}</td>
              <td><b>${horas(duracion(j))}</b></td>
              <td><input type="checkbox" data-dc="${j.id}" ${j.dia_completo ? 'checked' : ''} ${corrige ? '' : 'disabled'} title="Le pediste quedarse el día completo"></td>
              <td class="nota-asis">${h(j.nota || '')}</td>
              <td>${corrige ? `<button class="enlace" data-corr="${j.id}">Corregir</button>` : ''}</td>
            </tr>`,
          )
          .join('')}`,
      )
      .join('')

    v.innerHTML = `${pestanasNomina('asistencia')}
      <div class="tarjeta filtros-asis">
        <label>Periodo<select id="as-per">${Object.entries(PERIODOS).map(([k, t]) => `<option value="${k}" ${k === per ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        ${per === 'rango' ? `<label>Desde<input type="date" id="as-desde" value="${aFecha(rango.desde)}"></label><label>Hasta<input type="date" id="as-hasta" value="${aFecha(ultimoDia)}" max="${aFecha(new Date())}"></label>` : ''}
        <label>Persona<select id="as-quien">${opcPersonas}</select></label>
        <div class="acciones-asis"><button class="btn" id="as-csv">⬇ Descargar Excel</button>${corrige ? '<button class="btn" id="as-mano">+ Registrar a mano</button>' : ''}</div>
      </div>
      <p class="nota">${etiqueta}${quien ? ` · ${h(nombreDe(quien))}` : ''}</p>
      <div class="kpis">
        <div class="kpi"><span>Horas trabajadas</span><b>${horas(totalMs)}</b><small>${horasDec(totalMs)} h en decimal</small></div>
        <div class="kpi"><span>Días trabajados</span><b>${diasTot}</b><small>suma de todas las personas</small></div>
        <div class="kpi"><span>Registros</span><b>${lista.length}</b><small>entradas y salidas</small></div>
        <div class="kpi"><span>Sin salida</span><b>${olvidos}</b><small class="${olvidos ? 'rojo' : ''}">${olvidos ? 'se les olvidó marcar salida' : abiertasTot ? `${abiertasTot} trabajando ahora` : 'todo en orden'}</small></div>
      </div>
      <div class="tarjeta"><h3>Resumen por persona</h3>${
        resumen.length
          ? `<div class="tabla-scroll"><table class="tabla"><tr><th>Persona</th><th>Días</th><th>Horas</th><th>Promedio al día</th><th>Llega en promedio</th><th>Días completos</th><th>Sin salida</th></tr>${resumen
              .map((r) => `<tr><td><b>${h(r.nombre)}</b></td><td>${r.dias.size}</td><td><b>${horas(r.ms)}</b></td><td>${horas(r.ms / Math.max(1, r.dias.size))}</td><td>${promedioEntrada(r.entradas)}</td><td>${r.completos.size}</td><td>${r.abiertas ? `<span class="chip">${r.abiertas}</span>` : '0'}</td></tr>`)
              .join('')}</table></div>`
          : '<p class="vacio">Nadie marcó entrada en estas fechas.</p>'
      }</div>
      <div class="tarjeta"><h3>Cada entrada y salida</h3>${
        lista.length
          ? `<div class="tabla-scroll"><table class="tabla tabla-asis"><tr><th>Persona</th><th>Entrada</th><th>Salida</th><th>Tiempo</th><th>Día completo</th><th>Nota</th><th></th></tr>${detalle}</table></div>`
          : '<p class="vacio">Sin registros en estas fechas.</p>'
      }</div>
      <p class="nota">Todo queda guardado para siempre: puedes ver cualquier fecha pasada con "Elegir fechas…". La hora la pone el sistema y el equipo no puede cambiarla ni borrarla. Si corriges algo, queda anotado quién, cuándo y qué en la <a href="#bitacora">Bitácora</a>. "Día completo" cuenta para la nómina de medio tiempo (también cuenta solo con ${DIA_COMPLETO_HORAS} h o más).</p>`

    conectarPestanasNomina(v)
    const guardar = (cambio) => (sessionStorage.setItem('hq-asis', JSON.stringify({ ...filtro, ...cambio })), mostrar())
    $('#as-per', v).onchange = (e) => guardar({ per: e.target.value, ...(e.target.value === 'rango' && !filtro.desde ? { desde: aFecha(rango.desde), hasta: aFecha(ultimoDia) } : {}) })
    $('#as-quien', v).onchange = (e) => guardar({ quien: e.target.value })
    const fechas = () => {
      const d = $('#as-desde', v).value, a = $('#as-hasta', v).value
      if (d && a && d <= a) guardar({ desde: d, hasta: a })
      else if (d && a) aviso('La fecha "desde" va antes que "hasta"', 'mal')
    }
    $('#as-desde', v)?.addEventListener('change', fechas)
    $('#as-hasta', v)?.addEventListener('change', fechas)
    $$('[data-dc]', v).forEach((c) => (c.onchange = () => intenta(() => D.diaCompleto(c.dataset.dc, c.checked), 'Guardado')))
    $$('[data-corr]', v).forEach((b) => (b.onclick = () => corregirJornada(lista.find((j) => j.id === b.dataset.corr))))
    $('#as-mano', v)?.addEventListener('click', () => corregirJornada(null, quien))
    $('#as-csv', v).onclick = () => {
      const c = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`
      const filas = [
        [`Asistencia NXUS — ${etiqueta}${quien ? ` — ${nombreDe(quien)}` : ''}`],
        [],
        ['RESUMEN POR PERSONA'],
        ['Persona', 'Días trabajados', 'Horas (h:mm)', 'Horas (decimal)', 'Promedio al día (decimal)', 'Llega en promedio', 'Días completos', 'Sin salida'],
        ...resumen.map((r) => [r.nombre, r.dias.size, horas(r.ms), horasDec(r.ms), horasDec(r.ms / Math.max(1, r.dias.size)), promedioEntrada(r.entradas), r.completos.size, r.abiertas]),
        ['TOTAL', diasTot, horas(totalMs), horasDec(totalMs)],
        [],
        ['DETALLE'],
        ['Fecha', 'Día', 'Persona', 'Entrada', 'Salida', 'Horas (h:mm)', 'Horas (decimal)', 'Día completo', 'Nota'],
        ...lista
          .slice()
          .reverse()
          .map((j) => [diaJor(j.entrada), deFecha(diaJor(j.entrada)).toLocaleDateString('es-MX', { weekday: 'long' }), nombreDe(j.persona), hora(j.entrada), j.salida ? `${hora(j.salida)}${diaJor(j.salida) !== diaJor(j.entrada) ? ` (${diaJor(j.salida)})` : ''}` : 'sin salida', horas(duracion(j)), horasDec(duracion(j)), j.dia_completo ? 'sí' : 'no', j.nota || '']),
      ]
      const texto = '﻿' + filas.map((f) => f.map(c).join(',')).join('\r\n')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }))
      a.download = `asistencia-nxus_${aFecha(rango.desde)}_a_${aFecha(ultimoDia)}${quien ? `_${nombreDe(quien).replace(/\s+/g, '-')}` : ''}.csv`
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
    }
  }

  /** Corregir una entrada/salida (o registrar una a mano). Queda en la Bitácora. */
  function corregirJornada(j, quien = '') {
    const nueva = !j
    const activos = personas.filter((p) => p.activo).sort((a, b) => a.nombre.localeCompare(b.nombre))
    abrirModal(
      `<form id="f-jor"><h2>${nueva ? 'Registrar entrada a mano' : `Corregir · ${h(nombreDe(j.persona))}`}</h2>
        <div class="campos">
          ${nueva ? `<label class="ancho">Persona<select name="persona" required><option value="">Elige…</option>${activos.map((p) => `<option value="${p.id}" ${p.id === quien ? 'selected' : ''}>${h(p.nombre)}</option>`).join('')}</select></label>` : ''}
          <label>Entrada<input type="datetime-local" name="entrada" required value="${aLocal(j?.entrada)}"></label>
          <label>Salida <small>vacío = sigue trabajando</small><input type="datetime-local" name="salida" value="${aLocal(j?.salida)}"></label>
          <label class="ancho">Motivo <small>queda en la nota y en la Bitácora</small><input name="nota" required maxlength="500" placeholder="Ej. olvidó marcar salida, salió a las 6 pm" value="${h(j?.nota || '')}"></label>
        </div>
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-jor', caja).onsubmit = async (e) => {
          e.preventDefault()
          const f = Object.fromEntries(new FormData(e.target))
          const entrada = new Date(f.entrada)
          const salida = f.salida ? new Date(f.salida) : null
          if (isNaN(entrada)) return aviso('Pon la hora de entrada', 'mal')
          if (salida && salida <= entrada) return aviso('La salida tiene que ser después de la entrada', 'mal')
          if (salida && salida - entrada > 24 * 3600000) return aviso('Más de 24 horas seguidas: revisa las fechas', 'mal')
          if (entrada > new Date() || (salida && salida > new Date())) return aviso('No se pueden poner horas en el futuro', 'mal')
          const datos = { entrada: entrada.toISOString(), salida: salida ? salida.toISOString() : null, nota: String(f.nota).trim().slice(0, 500) }
          const r = await intenta(() => (nueva ? D.registrarJornada({ ...datos, persona: f.persona }) : D.corregirJornada(j.id, datos)), nueva ? 'Registrado' : 'Corregido')
          if (r) (cerrarModal(), mostrar())
        }
      },
    )
  }

  function editarEsquema(p, n = {}) {
    abrirModal(
      `<form id="f-esq"><h2>Pago de ${h(p.nombre)}</h2>
        <div class="campos">
          <label>Esquema<select name="esquema">${opciones(ESQUEMA, n.esquema || 'fijo')}</select></label>
          <label>Moneda<select name="moneda">${opciones({ MXN: 'Pesos (MXN)', USD: 'Dólares (USD)' }, n.moneda || 'MXN')}</select></label>
          <label>Pago por quincena<input name="monto_quincena" type="number" min="0" step="0.01" value="${h(n.monto_quincena ?? 0)}"></label>
          <label>Horas a la semana<input name="horas_semana" type="number" min="1" step="0.5" value="${h(n.horas_semana ?? 40)}"></label>
          <label>Extra por día completo <small>0 = que lo calcule el sistema</small><input name="pago_dia_completo" type="number" min="0" step="0.01" value="${h(n.pago_dia_completo ?? 0)}"></label>
          <label>Comisión %<input name="porcentaje" type="number" min="0" max="100" step="0.5" value="${h(n.porcentaje ?? 0)}"></label>
          <label class="ancho">Notas<textarea name="notas" rows="2">${h(n.notas)}</textarea></label>
        </div>
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-esq', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          const ok = await intenta(
            () => D.guardarNomina({ persona: p.id, esquema: d.esquema, moneda: d.moneda, monto_quincena: Number(d.monto_quincena) || 0, horas_semana: Number(d.horas_semana) || 40, pago_dia_completo: Number(d.pago_dia_completo) || 0, porcentaje: Number(d.porcentaje) || 0, notas: d.notas.trim() }),
            'Guardado',
          )
          if (ok) {
            cerrarModal()
            mostrar()
          }
        }
      },
    )
  }

  function nuevoAjuste(p) {
    abrirModal(
      `<form id="f-aj"><h2>Ajuste para ${h(p.nombre)}</h2><p class="nota">Un bono, un día extra, un descuento (en negativo)…</p>
        <div class="campos"><label class="ancho">Concepto<input name="concepto" required maxlength="200"></label>
        <label>Monto<input name="monto" type="number" step="0.01" required></label><label>Fecha<input name="fecha" type="date" value="${hoyISO()}" required></label></div>
        <div class="acciones"><button class="btn primario">Agregar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-aj', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          if (await intenta(() => D.guardarAjuste({ persona: p.id, concepto: d.concepto.trim(), monto: Number(d.monto), fecha: d.fecha }), 'Ajuste agregado')) {
            cerrarModal()
            mostrar()
          }
        }
      },
    )
  }

  function nuevaComision(p, n, pre = {}) {
    abrirModal(
      `<form id="f-com"><h2>Comisión de ${h(p.nombre)}</h2><p class="nota">Un contrato que consiguió: lo que se cobró y su porcentaje. Las consultorías que pagan sus prospectos se agregan solas.</p>
        <div class="campos">
          <label>Cliente<select name="cliente_id"><option value="">Otro</option>${clientes.map((c) => `<option value="${c.id}" ${c.id === pre.cliente_id ? 'selected' : ''}>${h(c.nombre)}</option>`).join('')}</select></label>
          <label>Concepto<input name="concepto" placeholder="Si es otro"></label>
          <label>Cobrado<input name="monto_cobrado" type="number" min="0" step="0.01" required value="${h(pre.monto_cobrado ?? '')}"></label>
          <label>Porcentaje<input name="porcentaje" type="number" min="0" max="100" step="0.5" value="${h(n?.porcentaje ?? 50)}"></label>
          <label>Moneda<select name="moneda">${opciones({ MXN: 'Pesos (MXN)', USD: 'Dólares (USD)' }, pre.moneda || n?.moneda || 'MXN')}</select></label>
          <label>Fecha<input name="fecha" type="date" value="${hoyISO()}"></label>
        </div>
        <div class="acciones"><button class="btn primario">Agregar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-com', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          const ok = await intenta(
            () => D.guardarComision({ persona: p.id, cliente_id: d.cliente_id || null, concepto: d.concepto.trim(), monto_cobrado: Number(d.monto_cobrado), porcentaje: Number(d.porcentaje), moneda: d.moneda, fecha: d.fecha }),
            'Comisión agregada',
          )
          if (ok) {
            cerrarModal()
            mostrar()
          }
        }
      },
    )
  }

  function verDias(p, jornadas) {
    const suyas = jornadas.filter((j) => j.persona === p.id)
    abrirModal(
      `<h2>Días de ${h(p.nombre)}</h2>
        ${suyas.length ? `<table class="tabla"><tr><th>Día</th><th>Entrada</th><th>Salida</th><th>Tiempo</th><th>Día completo</th></tr>${suyas.map((j) => `<tr><td>${fechaCorta(j.entrada)}</td><td>${hora(j.entrada)}</td><td>${j.salida ? hora(j.salida) : 'abierta'}</td><td>${horas(duracion(j))}</td><td><input type="checkbox" data-dc="${j.id}" ${j.dia_completo ? 'checked' : ''}></td></tr>`).join('')}</table>` : '<p class="vacio">Sin registros en esta quincena.</p>'}
        <p class="nota">Marca "día completo" cuando le pediste quedarse todo el día; se paga con su extra por día completo.</p>
        <div class="acciones"><button class="btn" data-cerrar>Listo</button></div>`,
      (caja) => {
        $$('[data-dc]', caja).forEach((c) => (c.onchange = () => intenta(() => D.diaCompleto(c.dataset.dc, c.checked), 'Guardado')))
        $$('[data-cerrar]', caja).forEach((b) => (b.onclick = () => (cerrarModal(), mostrar())))
      },
    )
  }

  // ------------------------------------------------------------ personas

  async function vistaPersonas(v) {
    titulo('Personas')
    personas = await D.personas()
    const admin = esAdmin()
    const modo = admin && sessionStorage.getItem('hq-per') === 'matriz' ? 'matriz' : 'lista'
    const filas = await Promise.all(
      personas.map(async (p) => {
        const ac = estadoAcceso(p)
        const n = (p.permisos ?? []).length
        const dineroP = (p.permisos ?? []).some((k) => ['clientes_dinero', 'nomina_ver', 'nomina_editar', 'finanzas_ver', 'finanzas_editar', 'anuncios_gasto'].includes(k))
        return `<tr class="${p.activo ? '' : 'apagado'}"><td class="con-avatar">${await avatar(p)}<div><b>${h(p.nombre)}</b><small>${p.usuario ? `usuario: ${h(p.usuario)}` : 'entra con su correo'}${p.correo ? ` · ${h(p.correo)}` : ''}</small></div></td><td>${h(p.cargo)}<small class="bloque"><span class="chip ${p.sede}">${SEDE[p.sede]}</span></small></td><td>${p.rol === 'admin' ? '<b>Todo</b>' : `<b>${h(plantillaDe(p))}</b><small class="bloque">${n ? `${n} permiso${n > 1 ? 's' : ''}` : 'lo básico'}${dineroP ? ' · 💰 ve dinero' : ''}${p.pros_ver && p.pros_ver !== 'nada' ? ` · prospectos: ${p.pros_ver}` : ''}</small>`}</td><td><span class="acceso ${ac.cls}">${ac.t}</span></td><td><div class="acciones">${admin ? `<button class="btn chico" data-per="${p.id}">Editar</button>` : ''}${admin && p.rol !== 'admin' ? `<button class="btn chico primario" data-permisos="${p.id}">🔑 Permisos</button>` : ''}${p.rol !== 'admin' && p.id !== yo.id ? `<button class="btn chico" data-reenviar="${p.id}" title="Le pone una contraseña y se la manda a su correo">📧 Reenviar acceso</button>` : ''}</div></td></tr>`
      }),
    )
    const equipo = personas.filter((p) => p.rol !== 'admin')
    v.innerHTML = `
      <div class="acciones"><button class="btn primario" id="p-nueva">+ Dar de alta</button>${admin ? '<button class="btn" id="p-probar">🔧 Probar correo</button>' : ''}
        ${admin ? `<div class="segmento"><button data-pm="lista" class="${modo === 'lista' ? 'on' : ''}">Lista</button><button data-pm="matriz" class="${modo === 'matriz' ? 'on' : ''}">Matriz de permisos</button></div>` : ''}</div>
      ${
        modo === 'matriz'
          ? `<div class="tarjeta"><h3>Quién puede qué <small>toca una casilla para prender o apagar · se guarda al instante</small></h3>${matrizPermisos({ h }, equipo)}</div>`
          : `<div class="tarjeta"><div class="tabla-scroll"><table class="tabla"><tr><th>Persona</th><th>Cargo</th><th>Permisos</th><th>Acceso</th><th></th></tr>${filas.join('')}</table></div></div>`
      }
      <p class="nota">${admin ? 'Cada persona entra con su <b>usuario</b> y la contraseña que tú le pones (al entrar la cambia). En <b>🔑 Permisos</b> decides qué ve y qué puede hacer: hay plantillas (Contador, Ventas, Socio…), acceso con fecha de vencimiento y un botón para quitar todo de golpe. La base de datos los hace cumplir y cada cambio queda en la Bitácora. Tus pendientes, metas, gastos personales y ahorro nunca se comparten.' : 'Puedes dar de alta personas y reenviar accesos. Los permisos solo los da Eduardo.'}</p>`
    $$('[data-pm]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-per', b.dataset.pm), mostrar())))
    $$('[data-permisos]', v).forEach(
      (b) =>
        (b.onclick = async () => {
          const p = persona(b.dataset.permisos)
          editarPermisos({ D, h, $, $$, abrirModal, cerrarModal, intenta, mostrar, avatarHtml: await avatar(p, 'grande') }, p, async () => (personas = await D.personas()))
        }),
    )
    $$('[data-mx]', v).forEach(
      (b) =>
        (b.onclick = async () => {
          const [pid, k] = b.dataset.mx.split('|')
          const p = persona(pid)
          const permisos = alternar(p, k)
          const prende = permisos.includes(k)
          if (await intenta(() => D.guardarPersona({ id: pid, permisos, plantilla: plantillaDe({ ...p, permisos }) }), `${prende ? 'Prendido' : 'Apagado'}: ${CORTO_PERMISO[k]} · ${p.nombre}`)) {
            personas = await D.personas()
            mostrar()
          }
        }),
    )
    $('#p-nueva', v).onclick = () => editarPersona(null)
    if ($('#p-probar', v)) $('#p-probar', v).onclick = async () => {
      const b = $('#p-probar', v)
      b.disabled = true
      b.textContent = 'Probando…'
      const r = await intenta(() => D.probarCorreo())
      b.disabled = false
      b.textContent = '🔧 Probar correo'
      if (!r) return
      abrirModal(
        `<h2>${r.enviado ? '✅ El correo funciona' : '⚠ El correo no sale'}</h2>
         ${r.enviado ? `<p>Te mandamos un correo de prueba a <b>${h(r.para)}</b>.</p>` : `<p class="rojo">${h(r.motivo || '')}</p>`}
         <div class="tarjeta"><p>Clave que usa HQ ahora: <b>${h(r.clave)}</b></p><p>Agenda (ID de la implementación): <b>${h(r.agenda)}</b></p></div>
         <p class="nota">Compara: en Apps Script → Agenda Portal → ⚙️ Project Settings → Script Properties → CLAVE, los primeros 4 y los últimos 4 caracteres deben ser iguales a estos. Si no, Netlify sigue con la vieja: revisa AGENDA_CLAVE y vuelve a publicar (Deploys → Trigger deploy → Deploy site).</p>
         <div class="acciones"><button class="btn primario" data-cerrar>Cerrar</button></div>`,
      )
    }
    $$('[data-per]', v).forEach((b) => (b.onclick = () => editarPersona(persona(b.dataset.per))))
    $$('[data-reenviar]', v).forEach((b) => (b.onclick = () => reenviarAcceso(persona(b.dataset.reenviar))))
  }

  /** Después de dar de alta (o cambiar la contraseña): si se le mandó por correo y, si no, para copiársela. */
  function accesoListo({ nombre, usuario, clave, correo, enviado, pidio, nueva = false, motivo = '' }) {
    abrirModal(
      `<h2>✓ ${nueva ? `Contraseña nueva de ${h(nombre)}` : `${h(nombre)} ya puede entrar`}</h2>
       ${enviado ? `<p class="verde">📧 Le mandamos su acceso a <b>${h(correo)}</b>.</p>` : pidio ? `<p class="rojo">⚠ No se pudo mandar el correo${motivo ? `: ${h(motivo)}` : '.'}</p><p>Pásale estos datos tú o, cuando lo arregles, dale <b>📧 Reenviar acceso</b> en Personas:</p>` : '<p>Pásale estos datos:</p>'}
       <div class="tarjeta"><p>Entra en <b>${h(location.origin)}</b></p><p>Usuario: <b>${h(usuario)}</b></p><p>Contraseña: <b>${h(clave)}</b></p></div>
       <p class="nota">Al entrar se le pide cambiarla por una suya.</p>
       <div class="acciones"><button class="btn" id="ac-copiar">Copiar los datos</button><button class="btn primario" data-cerrar>Listo</button></div>`,
      (caja) => {
        $('#ac-copiar', caja).onclick = () => navigator.clipboard?.writeText(`NXUS HQ: ${location.origin}\nUsuario: ${usuario}\nContraseña: ${clave}`).then(() => aviso('Copiado'))
      },
    )
  }

  /** 📧 Reenviar acceso: HQ no guarda contraseñas, así que se le pone una (puede ser la misma) y se le manda. */
  function reenviarAcceso(p) {
    abrirModal(
      `<form id="f-reenviar"><h2>📧 Reenviar acceso a ${h(p.nombre)}</h2>
        <p>Le llega a <b>${h(p.correo || '— (no tiene correo: agrégaselo en Editar)')}</b> su usuario <b>${h(p.usuario || p.correo)}</b> y esta contraseña. HQ no guarda contraseñas, así que escribe la que le quieres mandar (puede ser la misma de antes).</p>
        ${p.cambiar_clave ? '' : '<p class="rojo">Ojo: ya cambió su contraseña por una suya. Esto la reemplaza por la que escribas aquí.</p>'}
        <div class="campos"><label class="ancho">Contraseña<input name="clave" type="text" required autocomplete="off"></label></div>
        <div class="acciones"><button class="btn primario" ${p.correo ? '' : 'disabled'}>Mandar acceso</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-reenviar', caja).onsubmit = async (e) => {
          e.preventDefault()
          const clave = e.target.clave.value
          const r = await intenta(() => D.claveDe(p.id, clave, true))
          if (r) {
            cerrarModal()
            accesoListo({ nombre: p.nombre, usuario: r.usuario || p.usuario || p.correo, clave, correo: p.correo, enviado: r.enviado, pidio: true, nueva: true, motivo: r.motivo })
          }
        }
      },
    )
  }

  function editarPersona(p) {
    const nueva = !p
    abrirModal(
      `<form id="f-per"><h2>${nueva ? 'Dar de alta' : h(p.nombre)}</h2>
        <div class="campos">
          <label>Nombre<input name="nombre" required maxlength="80" value="${h(p?.nombre)}"></label>
          <label>Cargo<input name="cargo" maxlength="80" value="${h(p?.cargo)}" placeholder="Diseñadora"></label>
          <label>Dónde<select name="sede">${opciones(SEDE, p?.sede || 'usa')}</select></label>
          <label>Reporta a<select name="reporta_a">${opcionesPersonas(p?.reporta_a, '—')}</select></label>
          ${
            nueva
              ? `<label>Usuario <small>con el que entra</small><input name="usuario" required maxlength="40" autocapitalize="none" spellcheck="false" placeholder="juan.perez"></label>
                 <label>Contraseña<input name="clave" type="text" required autocomplete="off" placeholder="la que tú quieras"></label>
                 <label class="ancho">Su correo <small>ahí le llega su acceso</small><input name="correo" type="email" placeholder="juan@gmail.com"></label>
                 <label class="check ancho"><input type="checkbox" name="enviar" checked> Mandarle su usuario y contraseña a su correo</label>`
              : ''
          }
          ${!nueva && p.id !== yo.id ? `<label class="check"><input type="checkbox" name="activo" ${p.activo ? 'checked' : ''}> Acceso prendido</label>` : ''}
          ${!nueva ? `<label class="ancho">Foto<input name="foto" type="file" accept="image/jpeg,image/png,image/webp"></label>` : ''}
        </div>
        ${
          !nueva && p.rol !== 'admin'
            ? `<fieldset class="permisos"><legend>Su link de prospectos</legend>
                <div class="campos">
                  <label class="ancho">Código de su link <small>empezar.nxusai.org/nombre-del-prospecto?de=<b>código</b></small><input name="codigo" maxlength="30" pattern="[a-z0-9-]{2,30}" value="${h(p.codigo || '')}" placeholder="${h(slug(p.nombre.split(' ')[0]))}"></label>
                </div>
                <p class="nota">Qué ve y qué puede hacer (prospectos, clientes, finanzas, nómina…): botón <b>🔑 Permisos</b> en Personas.</p>
              </fieldset>`
            : ''
        }
        <div class="acciones"><button class="btn primario">${nueva ? 'Dar de alta' : 'Guardar'}</button>
          ${!nueva && p.id !== yo.id ? '<button type="button" class="btn" id="p-clave">Nueva contraseña</button>' : ''}
          <button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-per', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          let ok
          if (nueva) {
            const r = await intenta(() => D.crearPersona({ nombre: d.nombre.trim(), usuario: d.usuario, cargo: d.cargo.trim(), sede: d.sede, reporta_a: d.reporta_a || null, correo: d.correo.trim(), clave: d.clave, enviar: !!d.enviar }))
            ok = !!r
            if (r) {
              cerrarModal()
              personas = await D.personas()
              mostrar()
              accesoListo({ nombre: d.nombre.trim(), usuario: r.usuario, clave: d.clave, correo: d.correo.trim(), enviado: r.enviado, pidio: !!d.enviar, motivo: r.motivo })
              return
            }
          } else {
            const pros =
              p.rol !== 'admin'
                ? { codigo: slug(d.codigo || '').slice(0, 30) || null }
                : {}
            ok = await intenta(() => D.guardarPersona({ id: p.id, nombre: d.nombre.trim(), cargo: d.cargo.trim(), sede: d.sede, reporta_a: d.reporta_a || null, ...(p.id !== yo.id ? { activo: !!d.activo } : {}), ...pros }), 'Guardado')
            const foto = e.target.foto?.files?.[0]
            if (ok && foto) {
              if (foto.size > 5 * 1024 * 1024) aviso('La foto pesa más de 5 MB', 'mal')
              else await intenta(() => D.subirFoto(p.id, foto), 'Foto actualizada')
            }
          }
          if (ok) {
            cerrarModal()
            personas = await D.personas()
            mostrar()
          }
        }
        $('#p-clave', caja)?.addEventListener('click', async () => {
          const clave = prompt(`Nueva contraseña para ${p.nombre}:`)
          if (!clave) return
          const enviar = !!p.correo && confirm(`¿Mandársela a su correo (${p.correo})?`)
          const r = await intenta(() => D.claveDe(p.id, clave, enviar))
          if (r) {
            cerrarModal()
            accesoListo({ nombre: p.nombre, usuario: p.usuario || p.correo, clave, correo: p.correo, enviado: r.enviado, pidio: enviar, nueva: true, motivo: r.motivo })
          }
        })
      },
    )
  }

  // ------------------------------------------------------- mis pendientes

  // Lo personal de Eduardo: pendientes, metas y hábitos. Solo el admin (la base de datos lo cuida).
  const AREAS = {
    negocios: ['Negocios', '#8fb8ff'],
    patrimonio: ['Patrimonio', '#e3c896'],
    salud: ['Salud', '#ff9fb0'],
    familia: ['Familia', '#ffc98a'],
    crecimiento: ['Crecimiento', '#bfa8ff'],
    disfrute: ['Disfrute', '#86f0cc'],
  }
  const EMPRESAS = ['NXUS AI', 'Mi Semago', 'Abuelito', 'Aurelius', 'VAYRO']
  const PRIORIDAD = { alta: 'Urgente', media: 'Importante', normal: 'Normal' }
  /** La fecha de aquí (no la de Londres): YYYY-MM-DD, con días de más o de menos. */
  const diaLocal = (mas = 0) => new Date(Date.now() + mas * 864e5).toLocaleDateString('en-CA')
  const ROMANOS = ['i', 'ii', 'iii']
  const diaBonito = (iso) => new Date(`${iso}T12:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const horaBonita = (t) => (t ? new Date(`2000-01-01T${t}`).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : '')
  const chipArea = (a) => `<span class="chip area" style="--c:${AREAS[a]?.[1] ?? '#ccc'}">${AREAS[a]?.[0] ?? a}</span>`

  /** Las tres de hoy: las de estrella; si faltan, las más urgentes (atrasadas, urgentes, con hora). */
  function tresDeHoy(lista, hoy) {
    const deHoy = lista.filter((p) => p.estado === 'pendiente' && p.fecha && p.fecha <= hoy)
    const peso = (p) => (p.estrella ? 1000 : 0) + (p.fecha < hoy ? 300 : 0) + { alta: 200, media: 100, normal: 0 }[p.prioridad] + (p.hora ? 20 : 0)
    return [...deHoy].sort((a, b) => peso(b) - peso(a) || String(a.hora ?? '99').localeCompare(String(b.hora ?? '99'))).slice(0, 3)
  }

  /** Un pendiente: círculo para terminarlo, título, etiquetas y acciones. */
  function filaPendiente(p, hoy, { numero } = {}) {
    const tarde = p.estado === 'pendiente' && p.fecha && p.fecha < hoy
    const chips = [
      chipArea(p.area),
      p.empresa ? `<span class="chip">${h(p.empresa)}</span>` : '',
      p.prioridad !== 'normal' ? `<span class="chip prio-${p.prioridad}">${PRIORIDAD[p.prioridad]}</span>` : '',
      tarde ? `<span class="chip tarde">Desde ${h(diaBonito(p.fecha))}</span>` : p.fecha && p.fecha !== hoy && p.estado === 'pendiente' ? `<span class="chip">${h(diaBonito(p.fecha))}</span>` : '',
      p.hora ? `<span class="chip">${h(horaBonita(p.hora))}</span>` : '',
      p.origen === 'nex' ? '<span class="chip nex">vía NEX</span>' : '',
    ].join('')
    return `<div class="pend ${p.estado === 'hecho' ? 'hecho' : ''}" data-p="${p.id}">
      ${numero ? `<span class="romano">${numero}</span>` : ''}
      <button class="check" data-hecho title="${p.estado === 'hecho' ? 'Regresar a pendiente' : 'Listo'}">${p.estado === 'hecho' ? '✓' : ''}</button>
      <div class="pend-cuerpo"><b>${h(p.titulo)}</b>${p.notas ? `<small>${h(p.notas)}</small>` : ''}<div class="fila chips">${chips}</div></div>
      ${
        p.estado === 'pendiente'
          ? `<div class="pend-acc"><button class="btn chico ${p.estrella ? 'estrella' : ''}" data-estrella title="${p.estrella ? 'Quitar de las tres de hoy' : 'A las tres de hoy'}">${p.estrella ? '★' : '☆'}</button><button class="btn chico" data-manana>Mañana</button><button class="btn chico" data-editar>Editar</button></div>`
          : `<div class="pend-acc"><small>${p.hecho_en ? h(hora(p.hecho_en)) : ''}</small></div>`
      }
    </div>`
  }

  /** Conecta los botones de los pendientes de una vista. */
  function conectarPendientes(v, lista, metas) {
    const de = (el) => lista.find((p) => p.id === el.closest('[data-p]').dataset.p)
    const guardar = async (cambio, bien) => (await intenta(() => D.guardarPendiente(cambio), bien)) && mostrar()
    $$('[data-hecho]', v).forEach((b) => (b.onclick = () => {
      const p = de(b)
      b.closest('.pend').classList.add('saliendo')
      guardar(p.estado === 'hecho' ? { id: p.id, estado: 'pendiente', hecho_en: null } : { id: p.id, estado: 'hecho', hecho_en: new Date().toISOString(), estrella: false }, p.estado === 'hecho' ? 'De vuelta a pendientes' : '✓ Hecho')
    }))
    $$('[data-estrella]', v).forEach((b) => (b.onclick = () => {
      const p = de(b)
      guardar({ id: p.id, estrella: !p.estrella, ...(!p.estrella && (!p.fecha || p.fecha > diaLocal()) ? { fecha: diaLocal() } : {}) }, p.estrella ? 'Quitado de las tres de hoy' : '★ En las tres de hoy')
    }))
    $$('[data-manana]', v).forEach((b) => (b.onclick = () => guardar({ id: de(b).id, fecha: diaLocal(1), estrella: false }, 'Para mañana')))
    $$('[data-editar]', v).forEach((b) => (b.onclick = () => editarPendiente(de(b), metas)))
  }

  function editarPendiente(p, metas = []) {
    const nuevo = !p?.id
    p = { titulo: '', notas: '', area: 'negocios', empresa: '', fecha: diaLocal(), hora: '', prioridad: 'normal', meta_id: '', ...p }
    abrirModal(
      `<form id="f-pend"><h2>${nuevo ? 'Nuevo pendiente' : 'Editar pendiente'}</h2>
        <div class="campos">
          <label class="ancho">Qué hay que hacer<input name="titulo" required maxlength="300" value="${h(p.titulo)}"></label>
          <label>Área<select name="area">${Object.entries(AREAS).map(([k, [t]]) => `<option value="${k}" ${k === p.area ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label>Empresa<select name="empresa"><option value="">Personal / ninguna</option>${EMPRESAS.map((e) => `<option ${e === p.empresa ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
          <label>Fecha <small>vacía = algún día</small><input name="fecha" type="date" value="${h(p.fecha ?? '')}"></label>
          <label>Hora<input name="hora" type="time" value="${h(String(p.hora ?? '').slice(0, 5))}"></label>
          <label>Prioridad<select name="prioridad">${Object.entries(PRIORIDAD).map(([k, t]) => `<option value="${k}" ${k === p.prioridad ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label>Meta<select name="meta_id"><option value="">Ninguna</option>${metas.filter((m) => m.estado === 'activa').map((m) => `<option value="${m.id}" ${m.id === p.meta_id ? 'selected' : ''}>${h(m.titulo)}</option>`).join('')}</select></label>
          <label class="ancho">Notas<textarea name="notas" rows="3" maxlength="4000">${h(p.notas)}</textarea></label>
        </div>
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button>${nuevo ? '' : '<button type="button" class="btn peligro" id="pd-borrar">Borrar</button>'}</div></form>`,
      (caja) => {
        $('#f-pend', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          const fila = { ...(nuevo ? {} : { id: p.id }), titulo: d.titulo.trim(), notas: d.notas.trim(), area: d.area, empresa: d.empresa, fecha: d.fecha || null, hora: d.hora || null, prioridad: d.prioridad, meta_id: d.meta_id || null }
          if (await intenta(() => D.guardarPendiente(fila), 'Guardado')) {
            cerrarModal()
            mostrar()
          }
        }
        $('#pd-borrar', caja)?.addEventListener('click', async () => {
          if (confirm(`¿Borrar "${p.titulo}"?`) && (await intenta(() => D.borrarPendiente(p.id), 'Borrado')) !== undefined) {
            cerrarModal()
            mostrar()
          }
        })
      },
    )
  }

  /** Días seguidos (hasta hoy, o hasta ayer si hoy todavía no) con el hábito hecho. */
  const racha = (habitoId, dias) => {
    const hechos = new Set(dias.filter((d) => d.habito_id === habitoId).map((d) => d.dia))
    let n = 0
    for (let i = hechos.has(diaLocal()) ? 0 : 1; hechos.has(diaLocal(-i)); i++) n++
    return n
  }
  const avanceMeta = (m, lista) => {
    const suyos = lista.filter((p) => p.meta_id === m.id)
    return suyos.length ? Math.round((suyos.filter((p) => p.estado === 'hecho').length / suyos.length) * 100) : m.progreso
  }

  async function vistaPendientes(v) {
    titulo('Mis pendientes')
    const hoy = diaLocal()
    const [lista, habitos, dias, metas] = await Promise.all([D.pendientes(), D.habitos(), D.habitosDias(diaLocal(-60)), D.metas()])
    const TABS = { hoy: 'Hoy', semana: 'Semana', algun: 'Algún día', hechos: 'Logrado' }
    const tab = TABS[sessionStorage.getItem('hq-pend')] ? sessionStorage.getItem('hq-pend') : 'hoy'
    const abiertos = lista.filter((p) => p.estado === 'pendiente')
    const deHoy = abiertos.filter((p) => p.fecha && p.fecha <= hoy)
    const hechosHoy = lista.filter((p) => p.estado === 'hecho' && p.hecho_en && new Date(p.hecho_en).toLocaleDateString('en-CA') === hoy)
    const tres = tresDeHoy(lista, hoy)
    const activos = habitos.filter((x) => x.activo)
    const mejorRacha = Math.max(0, ...activos.map((x) => racha(x.id, dias)))
    const metasMes = metas.filter((m) => m.estado === 'activa' && m.periodo === 'mes')
    const pctMes = metasMes.length ? Math.round(metasMes.reduce((s, m) => s + avanceMeta(m, lista), 0) / metasMes.length) : 0
    const totalHoy = deHoy.length + hechosHoy.length
    const pct = totalHoy ? Math.round((hechosHoy.length / totalHoy) * 100) : 0
    const aro = (n) => `<svg class="aro" viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,.14)"/><circle cx="28" cy="28" r="24" stroke="#e3c896" stroke-linecap="round" stroke-dasharray="${(n / 100) * 150.8} 150.8" transform="rotate(-90 28 28)"/></svg>`
    const vacio = (t, s) => `<div class="vacio-lujo"><div class="t">${t}</div><small>${s}</small></div>`
    let cuerpo = ''
    if (tab === 'hoy') {
      const resto = deHoy.filter((p) => !tres.includes(p))
      cuerpo = `<div class="rejilla-pend">
        <div class="col-pend">
          <div class="tarjeta"><h3>Las tres de hoy</h3><p class="nota">Si solo haces esto, el día valió la pena. Marca ☆ para elegirlas tú; si no, se eligen solas.</p>
            ${[0, 1, 2].map((i) => (tres[i] ? filaPendiente(tres[i], hoy, { numero: ROMANOS[i] }) : `<div class="hueco-lujo"><span class="romano">${ROMANOS[i]}</span><span>${['La más importante del día', 'La segunda', 'La tercera'][i]}</span><i></i></div>`)).join('')}
          </div>
          <div class="tarjeta"><h3>También hoy <small>${resto.length}</small></h3>${resto.length ? resto.map((p) => filaPendiente(p, hoy)).join('') : vacio('Nada más en la agenda.', 'Lo que apuntes para hoy aparece aquí.')}</div>
          ${hechosHoy.length ? `<div class="tarjeta"><h3>Logrado hoy <small>${hechosHoy.length}</small></h3>${hechosHoy.map((p) => filaPendiente(p, hoy)).join('')}</div>` : ''}
        </div>
        <div class="col-pend">
          <div class="tarjeta"><h3>Tu día con NEX</h3><p class="nota">Por Telegram, cuando tu Mac está prendida.</p>
            <div class="agenda-nex"><span>7:30</span>Tu plan del día<span>— 30′</span>Aviso antes de lo que tiene hora<span>21:00</span>Cierre del día y hábitos<span>Dom</span>Revisión de la semana y tus metas</div></div>
          <div class="tarjeta"><div class="fila"><h3>Hábitos</h3><a href="#metas" data-ir-hab>Ver todos</a></div>
            ${activos.length ? activos.map((x) => { const hecho = dias.some((d) => d.habito_id === x.id && d.dia === hoy); return `<button class="habito-hoy ${hecho ? 'si' : ''}" data-hab="${x.id}"><i>${hecho ? '✓' : ''}</i>${h(x.titulo)}<small>${racha(x.id, dias)} días</small></button>` }).join('') : vacio('Agrega tu primer hábito.', 'En Metas y hábitos → Hábitos.')}
          </div>
          <div class="tarjeta"><h3>Equilibrio <small>esta semana</small></h3>
            <div class="areas-lujo">${Object.entries(AREAS).map(([k, [t, c]]) => { const n = lista.filter((p) => p.area === k && p.estado === 'hecho' && p.hecho_en && new Date(p.hecho_en) > Date.now() - 7 * 864e5).length; return `<div><span>${t}</span><b style="color:${c}">${n}</b><div class="b"><i style="width:${Math.min(100, n * 20)}%;background:${c}"></i></div></div>` }).join('')}</div>
          </div>
        </div></div>`
    } else if (tab === 'semana') {
      const dias7 = Array.from({ length: 7 }, (_, i) => diaLocal(i))
      const atrasados = abiertos.filter((p) => p.fecha && p.fecha < hoy)
      cuerpo = `${atrasados.length ? `<div class="tarjeta"><h3>Atrasados <small>${atrasados.length}</small></h3>${atrasados.map((p) => filaPendiente(p, hoy)).join('')}</div>` : ''}
        ${dias7.map((d, i) => { const suyos = abiertos.filter((p) => p.fecha === d); return `<div class="tarjeta"><h3>${i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : h(diaBonito(d))} <small>${suyos.length}</small></h3>${suyos.length ? suyos.map((p) => filaPendiente(p, hoy)).join('') : '<p class="nota">Libre.</p>'}</div>` }).join('')}`
    } else if (tab === 'algun') {
      const sin = abiertos.filter((p) => !p.fecha)
      cuerpo = `<div class="tarjeta"><h3>Algún día <small>${sin.length}</small></h3><p class="nota">Ideas y cosas sin fecha. Cuando les toque, ponles fecha o márcalas ☆ para hoy.</p>${sin.length ? sin.map((p) => filaPendiente(p, hoy)).join('') : vacio('Nada guardado para algún día.', 'Lo que dictes sin fecha cae aquí.')}</div>`
    } else {
      const hechos = lista.filter((p) => p.estado === 'hecho').sort((a, b) => String(b.hecho_en).localeCompare(String(a.hecho_en))).slice(0, 80)
      const grupos = []
      for (const p of hechos) {
        const d = p.hecho_en ? new Date(p.hecho_en).toLocaleDateString('en-CA') : '—'
        if (grupos.at(-1)?.[0] !== d) grupos.push([d, []])
        grupos.at(-1)[1].push(p)
      }
      cuerpo = grupos.length ? grupos.map(([d, ps]) => `<div class="tarjeta"><h3>${d === hoy ? 'Hoy' : h(diaBonito(d))} <small>${ps.length}</small></h3>${ps.map((p) => filaPendiente(p, hoy)).join('')}</div>`).join('') : `<div class="tarjeta">${vacio('Todavía nada logrado.', 'Lo que termines se queda aquí, para que veas lo que avanzas.')}</div>`
    }
    v.innerHTML = `
      <p class="eyebrow">${h(new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      <form class="captura-lujo" id="pd-captura"><span class="pluma">✦</span><input name="texto" autocomplete="off" placeholder="Escribe como hablas… “mañana a las diez llamar al contador, urgente; el viernes el regalo de mi mamá”"><button class="btn primario">Apuntar</button></form>
      <div class="acciones"><div class="segmento">${Object.entries(TABS).map(([k, t]) => `<button data-pt="${k}" class="${tab === k ? 'on' : ''}">${t}${k === 'hoy' && deHoy.length ? ` <small>${deHoy.length}</small>` : k === 'algun' ? ` <small>${abiertos.filter((p) => !p.fecha).length || ''}</small>` : ''}</button>`).join('')}</div>
        <span style="flex:1"></span><button class="btn" id="pd-nuevo">+ Con detalle</button></div>
      <div class="kpis">
        <div class="kpi">${aro(pct)}<span>Para hoy</span><b>${deHoy.length}</b><small>${deHoy.filter((p) => p.fecha < hoy).length ? `${deHoy.filter((p) => p.fecha < hoy).length} atrasado(s)` : 'Al día'}</small></div>
        <div class="kpi"><span>Logrados hoy</span><b>${hechosHoy.length}</b><small>${pct}% del día</small></div>
        <div class="kpi"><span>Racha</span><b>${mejorRacha} <em>días</em></b><small>Tu mejor hábito</small></div>
        <div class="kpi"><span>Metas del mes</span><b>${pctMes}%</b><small>${metasMes.length ? `${metasMes.length} meta(s)` : 'Define tu primera meta'}</small></div>
      </div>
      ${cuerpo}`
    $$('[data-pt]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-pend', b.dataset.pt), mostrar())))
    $('#pd-nuevo', v).onclick = () => editarPendiente(null, metas)
    $('#pd-captura', v).onsubmit = async (e) => {
      e.preventDefault()
      const texto = e.target.texto.value.trim()
      if (!texto) return
      const b = $('button', e.target)
      b.disabled = true
      b.textContent = 'Ordenando…'
      const r = await intenta(() => D.entenderPendientes(texto))
      b.disabled = false
      b.textContent = 'Apuntar'
      if (r) {
        aviso(r.items.length === 1 ? `Apuntado: ${r.items[0].titulo}` : `Apunté ${r.items.length} pendientes`)
        mostrar()
      }
    }
    $$('[data-hab]', v).forEach((b) => (b.onclick = async () => {
      const hecho = b.classList.contains('si')
      if (await intenta(() => D.marcarHabito(b.dataset.hab, hoy, !hecho))) mostrar()
    }))
    $('[data-ir-hab]', v)?.addEventListener('click', () => sessionStorage.setItem('hq-metas', 'habitos'))
    conectarPendientes(v, lista, metas)
  }

  // --------------------------------------------------------- metas y hábitos

  async function vistaMetas(v) {
    titulo('Metas y hábitos')
    const [metas, lista, habitos, dias, aportes] = await Promise.all([D.metas(), D.pendientes(), D.habitos(), D.habitosDias(diaLocal(-60)), D.aportes ? D.aportes().catch(() => []) : []])
    // Metas con precio: el avance es lo apartado (Finanzas → Ahorro para metas).
    const apartado = (m) => aportes.filter((a) => a.meta_id === m.id).reduce((t, a) => t + Number(a.monto), 0)
    const tab = sessionStorage.getItem('hq-metas') === 'habitos' ? 'habitos' : 'metas'
    const hoy = diaLocal()
    let cuerpo
    if (tab === 'metas') {
      cuerpo = `<div class="metas-lujo">${Object.entries(AREAS)
        .map(([k, [t, c]], i) => {
          const suyas = metas.filter((m) => m.area === k && m.estado !== 'pausada')
          return `<div class="tarjeta meta-area" style="--c:${c}"><div class="fila"><span class="romano-chico">${['I', 'II', 'III', 'IV', 'V', 'VI'][i]}</span><span class="punto-area"></span></div><h2>${t}</h2>
            ${suyas.map((m) => { const conPrecio = Number(m.monto_objetivo) > 0; const pct = conPrecio ? Math.min(100, Math.floor((apartado(m) / Number(m.monto_objetivo)) * 100)) : avanceMeta(m, lista); return `<button class="meta-item ${m.estado}" data-meta="${m.id}"><span>${h(m.titulo)}${m.estado === 'lograda' ? ' ✓' : ''}</span><small>${conPrecio ? `💰 ${dinero(apartado(m), m.moneda)} de ${dinero(m.monto_objetivo, m.moneda)}` : m.periodo === 'mes' ? 'Este mes' : 'Este año'} · ${pct}%</small><div class="b"><i style="width:${pct}%"></i></div></button>` }).join('')}
            <button class="enlace definir" data-nueva="${k}">+ Definir meta</button></div>`
        })
        .join('')}</div>
        <p class="nota">Meta del año → metas del mes → hábitos y pendientes de cada día. Liga tus pendientes a una meta (en Editar) y su barra sube sola cuando los terminas.</p>`
    } else {
      const activos = habitos.filter((x) => x.activo)
      const ult7 = Array.from({ length: 7 }, (_, i) => diaLocal(i - 6))
      cuerpo = `<div class="tarjeta"><div class="fila"><h3>Tus hábitos <small>${activos.length}</small></h3><button class="btn primario" id="hb-nuevo">+ Nuevo hábito</button></div>
        ${activos.length ? activos.map((x) => `<div class="habito-fila"><b>${h(x.titulo)}</b>${chipArea(x.area)}<span class="racha">${racha(x.id, dias)} días seguidos</span><div class="dias7">${ult7.map((d) => { const si = dias.some((z) => z.habito_id === x.id && z.dia === d); return `<button class="${si ? 'si' : ''}" data-dia="${d}" data-hb="${x.id}" title="${h(diaBonito(d))}">${new Date(`${d}T12:00`).toLocaleDateString('es-MX', { weekday: 'narrow' })}</button>` }).join('')}</div><button class="enlace rojo" data-hb-borrar="${x.id}">Quitar</button></div>`).join('') : '<div class="vacio-lujo"><div class="t">Agrega tu primer hábito.</div><small>Ejercicio, leer, meditar, revisar finanzas… Lo marcas cada día y llevas tu racha.</small></div>'}
      </div>`
    }
    v.innerHTML = `
      <p class="eyebrow">Tu año · ${new Date().getFullYear()}</p>
      <div class="acciones"><div class="segmento"><button data-mt="metas" class="${tab === 'metas' ? 'on' : ''}">Metas</button><button data-mt="habitos" class="${tab === 'habitos' ? 'on' : ''}">Hábitos</button></div></div>
      ${cuerpo}`
    $$('[data-mt]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-metas', b.dataset.mt), mostrar())))
    $$('[data-nueva]', v).forEach((b) => (b.onclick = () => editarMeta({ area: b.dataset.nueva })))
    $$('[data-meta]', v).forEach((b) => (b.onclick = () => editarMeta(metas.find((m) => m.id === b.dataset.meta))))
    $('#hb-nuevo', v)?.addEventListener('click', () => {
      abrirModal(
        `<form id="f-hab"><h2>Nuevo hábito</h2><div class="campos"><label class="ancho">Hábito<input name="titulo" required maxlength="120" placeholder="Ej.: Ejercicio 30 minutos"></label>
          <label>Área<select name="area">${Object.entries(AREAS).map(([k, [t]]) => `<option value="${k}" ${k === 'salud' ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
          <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
        (caja) => {
          $('#f-hab', caja).onsubmit = async (e) => {
            e.preventDefault()
            const d = Object.fromEntries(new FormData(e.target))
            if (await intenta(() => D.guardarHabito({ titulo: d.titulo.trim(), area: d.area }), 'Hábito agregado')) {
              cerrarModal()
              mostrar()
            }
          }
        },
      )
    })
    $$('[data-hb]', v).forEach((b) => (b.onclick = async () => (await intenta(() => D.marcarHabito(b.dataset.hb, b.dataset.dia, !b.classList.contains('si')))) && mostrar()))
    $$('[data-hb-borrar]', v).forEach((b) => (b.onclick = async () => confirm('¿Quitar este hábito?') && (await intenta(() => D.guardarHabito({ id: b.dataset.hbBorrar, activo: false }), 'Quitado')) && mostrar()))
  }

  function editarMeta(m) {
    const nueva = !m?.id
    m = { titulo: '', porque: '', area: 'negocios', periodo: 'año', fecha_limite: '', progreso: 0, estado: 'activa', ...m }
    abrirModal(
      `<form id="f-meta"><h2>${nueva ? `Nueva meta · ${AREAS[m.area][0]}` : 'Tu meta'}</h2>
        <div class="campos">
          <label class="ancho">Qué quieres lograr<input name="titulo" required maxlength="200" value="${h(m.titulo)}" placeholder="Ej.: Facturar $50,000 al mes"></label>
          <label class="ancho">Para qué la quieres <small>NEX te lo recuerda cuando te atores</small><textarea name="porque" rows="2" maxlength="1000">${h(m.porque)}</textarea></label>
          <label>Área<select name="area">${Object.entries(AREAS).map(([k, [t]]) => `<option value="${k}" ${k === m.area ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label>Plazo<select name="periodo"><option value="año" ${m.periodo === 'año' ? 'selected' : ''}>Este año</option><option value="mes" ${m.periodo === 'mes' ? 'selected' : ''}>Este mes</option></select></label>
          <label>Fecha límite<input name="fecha_limite" type="date" value="${h(m.fecha_limite ?? '')}"></label>
          <label>Estado<select name="estado"><option value="activa" ${m.estado === 'activa' ? 'selected' : ''}>Activa</option><option value="lograda" ${m.estado === 'lograda' ? 'selected' : ''}>¡Lograda!</option><option value="pausada" ${m.estado === 'pausada' ? 'selected' : ''}>En pausa</option></select></label>
          <label class="ancho">Avance <small>si no tiene pendientes ligados ni precio</small><input name="progreso" type="range" min="0" max="100" step="5" value="${Number(m.progreso) || 0}"></label>
          <label>¿Cuesta dinero? <small>precio de la meta · opcional</small><input name="monto_objetivo" type="number" min="0" step="0.01" value="${h(Number(m.monto_objetivo) || '')}" placeholder="800000"></label>
          <label>Moneda<select name="moneda"><option value="USD" ${m.moneda !== 'MXN' ? 'selected' : ''}>Dólares (USD)</option><option value="MXN" ${m.moneda === 'MXN' ? 'selected' : ''}>Pesos (MXN)</option></select></label>
          <p class="nota ancho">Con precio, el avance es lo que vas apartando: registra cada ahorro y tu plan en <a href="#finanzas" data-ir-ahorro>Finanzas → Ahorro para metas</a>.</p>
        </div>
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button>${nueva ? '' : '<button type="button" class="btn peligro" id="mt-borrar">Borrar</button>'}</div></form>`,
      (caja) => {
        $('#f-meta', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          const fila = { ...(nueva ? {} : { id: m.id }), titulo: d.titulo.trim(), porque: d.porque.trim(), area: d.area, periodo: d.periodo, fecha_limite: d.fecha_limite || null, estado: d.estado, progreso: Number(d.progreso) || 0, monto_objetivo: Number(d.monto_objetivo) || 0, moneda: d.moneda || 'USD' }
          if (await intenta(() => D.guardarMeta(fila), 'Meta guardada')) {
            cerrarModal()
            mostrar()
          }
        }
        $('[data-ir-ahorro]', caja)?.addEventListener('click', () => (sessionStorage.setItem('hq-fin', 'metas'), cerrarModal()))
        $('#mt-borrar', caja)?.addEventListener('click', async () => {
          if (confirm(`¿Borrar la meta "${m.titulo}"?`) && (await intenta(() => D.borrarMeta(m.id), 'Borrada')) !== undefined) {
            cerrarModal()
            mostrar()
          }
        })
      },
    )
  }

  // ------------------------------------------------------------ mi cuenta

  /** Cambiar mi contraseña (al entrar por primera vez se ofrece sola; si no, en "⚙ Mi cuenta"). */
  function miCuenta({ primeraVez = false } = {}) {
    abrirModal(
      `<form id="f-cuenta"><h2>${primeraVez ? `Bienvenido, ${h(String(yo.nombre).split(' ')[0])} 👋` : '⚙ Mi cuenta'}</h2>
        ${primeraVez ? '<p>Eduardo te creó una contraseña. Cámbiala por una tuya, que solo tú sepas. Si prefieres hacerlo después, está en <b>⚙ Mi cuenta</b> (abajo a la izquierda).</p>' : `<p><small>${yo.usuario ? `Tu usuario: <b>${h(yo.usuario)}</b>` : `Entras con: <b>${h(yo.correo)}</b>`}</small></p>`}
        <div class="campos">
          <label class="ancho">Contraseña nueva<input name="clave" type="password" autocomplete="new-password" required></label>
          <label class="ancho">Escríbela otra vez<input name="otra" type="password" autocomplete="new-password" required></label>
        </div>
        <div class="acciones"><button class="btn primario">Cambiar contraseña</button><button type="button" class="btn" data-cerrar>${primeraVez ? 'Ahora no' : 'Cancelar'}</button></div></form>`,
      (caja) => {
        $('#f-cuenta', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          if (d.clave !== d.otra) return aviso('Las dos contraseñas no son iguales', 'mal')
          if (await intenta(() => D.miClave(d.clave), 'Listo: tu contraseña quedó cambiada')) {
            yo.cambiar_clave = false
            cerrarModal()
          }
        }
      },
    )
  }

  // ------------------------------------------------------------ bitácora

  async function vistaBitacora(v) {
    titulo('Bitácora')
    const [b, gente] = await Promise.all([D.bitacora(), D.personas()])
    personas = gente
    const QUE = { insert: 'creó', update: 'cambió', delete: 'borró' }
    const TABLA = { perfiles: 'una persona', clientes: 'un cliente', clientes_dinero: 'lo que paga un cliente', tareas: 'una tarea', jornadas: 'una entrada/salida', nomina: 'una nómina', nomina_ajustes: 'un ajuste', comisiones: 'una comisión', prospectos: 'un prospecto', prospectos_notas: 'una nota de prospecto', prospectos_pagos: 'un pago de consultoría', cobros: 'un cobro', cobros_omitidos: 'un cobro omitido', gastos: 'un gasto', finanzas_config: 'los ajustes de finanzas', metas_aportes: 'un ahorro para meta', leads: 'un lead', anuncios: 'un anuncio' }
    const f = (() => { try { return JSON.parse(sessionStorage.getItem('hq-bit') || '{}') } catch { return {} } })()
    const lista = b.filter((x) => (!f.quien || x.quien === f.quien) && (!f.tabla || x.tabla === f.tabla))
    const OCULTAR = new Set(['id', 'creado', 'actualizado', 'actualizada', 'creada', 'creado_por', 'foto'])
    const valor = (k, x) => {
      if (x == null || x === '') return '—'
      if (k === 'permisos' && Array.isArray(x)) return x.length ? x.map((p) => CORTO_PERMISO[p] || p).join(', ') : 'ninguno'
      if (Array.isArray(x)) return x.join(', ') || '—'
      if (typeof x === 'boolean') return x ? 'sí' : 'no'
      if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x)) return `${fechaCorta(x)} ${hora(x)}`
      if (typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x)) return nombreDe(x) !== '—' ? nombreDe(x) : '…'
      return String(x).slice(0, 80)
    }
    const cambios = (x) => {
      if (x.accion !== 'update' || !x.despues) return ''
      const ks = Object.keys(x.despues).filter((k) => !OCULTAR.has(k)).slice(0, 6)
      return ks.length ? `<ul class="cambios">${ks.map((k) => `<li><b>${h(k.replace(/_/g, ' '))}</b>: ${h(valor(k, x.antes?.[k]))} → ${h(valor(k, x.despues[k]))}</li>`).join('')}</ul>` : ''
    }
    const tablas = [...new Set(b.map((x) => x.tabla))]
    v.innerHTML = `
      <div class="acciones filtros-bit">
        <select id="bt-quien"><option value="">Todas las personas</option>${gente.map((p) => `<option value="${p.id}" ${f.quien === p.id ? 'selected' : ''}>${h(p.nombre)}</option>`).join('')}</select>
        <select id="bt-tabla"><option value="">Todo</option>${tablas.map((t) => `<option value="${t}" ${f.tabla === t ? 'selected' : ''}>${h((TABLA[t] ?? t).replace(/^(un|una|los|lo) /, ''))}</option>`).join('')}</select>
      </div>
      <div class="tarjeta">${
        lista.length
          ? `<div class="tabla-scroll"><table class="tabla"><tr><th>Cuándo</th><th>Quién</th><th>Qué</th></tr>${lista.map((x) => `<tr><td>${fechaCorta(x.cuando)} ${hora(x.cuando)}</td><td>${h(x.quien ? nombreDe(x.quien) : 'Sistema / portal / NEX')}</td><td>${QUE[x.accion] ?? x.accion} ${TABLA[x.tabla] ?? x.tabla}${x.tabla === 'perfiles' && x.fila ? ` <small>(${h(nombreDe(x.fila))})</small>` : ''}${cambios(x)}</td></tr>`).join('')}</table></div>`
          : '<p class="vacio">Todavía no hay movimientos.</p>'
      }</div>
      <p class="nota">Cada cambio queda guardado con quién lo hizo, cuándo y qué cambió (antes → después). Nadie puede borrar la bitácora.</p>`
    const guardarF = (c) => (sessionStorage.setItem('hq-bit', JSON.stringify({ ...f, ...c })), mostrar())
    $('#bt-quien', v).onchange = (e) => guardarF({ quien: e.target.value })
    $('#bt-tabla', v).onchange = (e) => guardarF({ tabla: e.target.value })
  }

  // ------------------------------------------------------------- arranque

  D.alCambiarSesion?.((evento) => {
    if (evento === 'PASSWORD_RECOVERY') {
      const clave = prompt('Escribe tu contraseña nueva:')
      if (clave) intenta(() => D.nuevaClave(clave), 'Contraseña cambiada')
    }
  })
  D.sesion()
    .then((p) => (p ? arrancar(p) : pantallaEntrada()))
    .catch((err) => pantallaEntrada(err.message))
}
