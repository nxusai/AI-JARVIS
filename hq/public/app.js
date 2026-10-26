// NXUS HQ: la empresa en un solo lugar.
//
// Una sola página, sin dependencias. Las pantallas se arman con la persona que
// entró: Eduardo (admin) ve todo; el equipo ve los clientes sin dinero, el
// equipo, sus tareas y su propio reloj. Las reglas de verdad están en la base
// de datos (supabase/esquema.sql); aquí solo se esconde lo que no le toca.

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
                  <label>Correo<input name="correo" type="email" autocomplete="username" required></label>
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
        const correo = $('[name=correo]', f).value
        if (!correo) return aviso('Escribe tu correo arriba primero', 'mal')
        intenta(() => D.olvide(correo), 'Te mandamos un correo para cambiar tu contraseña')
      }
    }
  }

  // ---------------------------------------------------------- el marco

  const SECCIONES = [
    ['inicio', 'Inicio', '◈'],
    ['clientes', 'Clientes', '◉'],
    ['prospectos', 'Prospectos', '✦'],
    ['tareas', 'Tareas', '☰'],
    ['equipo', 'Equipo', '◎'],
    ['reloj', 'Mi reloj', '◷'],
  ]
  const misSecciones = () => SECCIONES.filter(([id]) => id !== 'prospectos' || vePros())
  const SECCIONES_ADMIN = [
    ['nomina', 'Nómina', '⧉'],
    ['dinero', 'Dinero', '$'],
    ['personas', 'Personas', '⚙'],
    ['bitacora', 'Bitácora', '≡'],
  ]

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
        </main>
      </div>`
    $('#menu').onclick = () => $('.nav').classList.toggle('abierta')
    $('#yo').innerHTML = `${await avatar(yo)}<div><b>${h(yo.nombre)}</b><span>${h(yo.cargo || '')}</span></div><button class="enlace" id="salir">Salir</button>`
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
    const j = await intenta(() => D.marcarEntrada(), 'Entrada registrada')
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
    const [ruta, arg] = (location.hash.slice(1) || 'inicio').split('/')
    const todas = [...misSecciones(), ...(esAdmin() ? SECCIONES_ADMIN : [])]
    const sec = todas.find(([id]) => id === ruta) ? ruta : ruta === 'cliente' ? 'clientes' : ruta === 'prospecto' && vePros() ? 'prospectos' : 'inicio'
    $$('[data-ir]').forEach((a) => a.classList.toggle('activa', a.dataset.ir === sec))
    const vista = $('#vista')
    vista.innerHTML = '<div class="cargando">Cargando…</div>'
    const VISTAS = { inicio, clientes: vistaClientes, prospectos: vistaProspectos, tareas: vistaTareas, equipo: vistaEquipo, reloj: vistaReloj, nomina: vistaNomina, dinero: vistaDinero, personas: vistaPersonas, bitacora: vistaBitacora }
    try {
      if (ruta === 'cliente' && arg) await vistaCliente(vista, arg)
      else if (ruta === 'prospecto' && arg && vePros()) await vistaProspecto(vista, arg)
      else await VISTAS[sec](vista)
    } catch (err) {
      vista.innerHTML = `<p class="error">${h(err.message)}</p>`
    }
  }
  const titulo = (t) => ($('#titulo').textContent = t)

  // ------------------------------------------------------------- inicio

  async function inicio(v) {
    titulo(`Hola ${yo.nombre.split(' ')[0]}`)
    const tareas = await D.tareas()
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
        <div class="tarjeta meta"><div class="fila"><b>Meta: ${dinero(META_USD)} al mes</b><span>${avance}%</span></div><div class="barra"><i style="width:${avance}%"></i></div><small>Ingreso del mes en dólares: clientes activos más consultorías cobradas. Pon lo que paga cada cliente en <a href="#dinero">Dinero</a>.</small></div>
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
    if (vePros()) html += await resumenProspectos()
    html += `<div class="tarjeta"><h3>Mis pendientes</h3>${mias.length ? `<ul class="lista tareas">${mias.map(tarjetaTarea).join('')}</ul>` : '<p class="vacio">No tienes pendientes.</p>'}</div>`
    v.innerHTML = html
    $('#i-reloj', v)?.addEventListener('click', () => (abierta ? marcarSalida() : marcarEntrada()))
  }

  // ----------------------------------------------------------- clientes

  async function vistaClientes(v) {
    titulo('Clientes')
    clientes = await D.clientes()
    const din = esAdmin() ? await D.dinero() : []
    const grupos = ['activo', 'prospecto', 'pausado', 'terminado']
    v.innerHTML = `
      ${esAdmin() ? `<div class="acciones"><button class="btn primario" id="c-ia">✦ Nuevo cliente con IA</button><button class="btn" id="c-mano">Nuevo a mano</button></div>` : ''}
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
                <div class="fila pie">${c.sistema_url ? '<span class="chip sistema">Con sistema</span>' : '<span></span>'}${esAdmin() ? `<b class="monto">${d?.mensualidad ? `${dinero(d.mensualidad, d.moneda)}/mes` : 'sin monto'}</b>` : ''}</div>
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
    const [tareas, din, pros] = await Promise.all([D.tareas(), esAdmin() ? D.dinero() : [], vePros() ? D.prospectos() : []])
    const d = din.find((x) => x.cliente_id === c.id)
    const vino = pros.find((x) => x.cliente_id === c.id)
    const suyas = tareas.filter((t) => t.cliente_id === c.id)
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
            ${esAdmin() ? '<button class="btn" id="cl-editar">Editar</button>' : ''}
          </div>
        </div>
        ${
          esAdmin()
            ? `<div class="tarjeta solo-tu"><h3>Lo que paga <small>solo tú lo ves</small></h3>
                <div class="kpis chicos"><div class="kpi"><span>Mensualidad</span><b>${dinero(d?.mensualidad, d?.moneda)}</b></div><div class="kpi"><span>Pago único</span><b>${dinero(d?.pago_unico, d?.moneda)}</b></div><div class="kpi"><span>Cobro</span><b>${d?.dia_cobro ? `día ${d.dia_cobro}` : '—'}</b></div></div>
                ${d?.notas ? `<p>${h(d.notas)}</p>` : ''}<button class="btn" id="cl-dinero">Cambiar</button></div>`
            : ''
        }
        <div class="tarjeta"><div class="fila"><h3>Tareas</h3><button class="btn chico" id="cl-tarea">+ Tarea</button></div>
          ${suyas.length ? `<ul class="lista tareas">${suyas.map((t) => `<li><span class="chip ${t.estado}">${TAREA[t.estado]}</span><b>${h(t.titulo)}</b><small>${h(nombreDe(t.asignado))}${t.vence ? ` · vence ${fechaCorta(t.vence)}` : ''}</small></li>`).join('')}</ul>` : '<p class="vacio">Sin tareas que puedas ver.</p>'}
        </div>
      </div>`
    $('#cl-editar', v)?.addEventListener('click', () => editarCliente(c))
    $('#cl-dinero', v)?.addEventListener('click', () => editarDinero(c, d))
    $('#cl-tarea', v).onclick = () => editarTarea({ cliente_id: c.id })
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
          if (!c) await intenta(() => D.guardarDinero({ cliente_id: guardado.id }))
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
    abrirModal(
      `<form id="f-dinero"><h2>Lo que paga ${h(c.nombre)}</h2>
        <div class="campos">
          <label>Mensualidad<input name="mensualidad" type="number" min="0" step="0.01" value="${h(d.mensualidad ?? 0)}"></label>
          <label>Pago único<input name="pago_unico" type="number" min="0" step="0.01" value="${h(d.pago_unico ?? 0)}"></label>
          <label>Moneda<select name="moneda">${opciones({ USD: 'Dólares (USD)', MXN: 'Pesos (MXN)' }, d.moneda || 'USD')}</select></label>
          <label>Día de cobro<input name="dia_cobro" type="number" min="1" max="31" value="${h(d.dia_cobro ?? '')}"></label>
          <label class="ancho">Notas<textarea name="notas" rows="2">${h(d.notas)}</textarea></label>
        </div>
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-dinero', caja).onsubmit = async (e) => {
          e.preventDefault()
          const x = Object.fromEntries(new FormData(e.target))
          const ok = await intenta(
            () => D.guardarDinero({ cliente_id: c.id, mensualidad: Number(x.mensualidad) || 0, pago_unico: Number(x.pago_unico) || 0, moneda: x.moneda, dia_cobro: Number(x.dia_cobro) || null, notas: x.notas.trim() }),
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
        <h3>Lo que paga <small>solo tú lo ves</small></h3>
        <div class="campos">
          <label>Mensualidad<input name="mensualidad" type="number" min="0" step="0.01" value="${h(f.mensualidad || 0)}"></label>
          <label>Pago único<input name="pago_unico" type="number" min="0" step="0.01" value="${h(f.pago_unico || 0)}"></label>
          <label>Moneda<select name="moneda">${opciones({ USD: 'Dólares (USD)', MXN: 'Pesos (MXN)' }, f.moneda || 'USD')}</select></label>
          <label>Día de cobro<input name="dia_cobro" type="number" min="1" max="31" value="${h(f.dia_cobro || '')}"></label>
        </div>
        <h3>Primeras tareas</h3>
        <div class="tareas-ia">${(f.tareas || [])
          .map(
            (t, i) => `<div class="tarea-ia"><label class="check"><input type="checkbox" name="t${i}" checked> <b>${h(t.titulo)}</b></label>${t.detalle ? `<small>${h(t.detalle)}</small>` : ''}
            <select name="a${i}">${opcionesPersonas(c.responsable, 'Sin asignar')}</select></div>`,
          )
          .join('') || '<p class="vacio">Sin tareas sugeridas.</p>'}</div>
        <div class="acciones"><button class="btn primario">Guardar cliente</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
      (caja) => {
        $('#f-ficha', caja).onsubmit = async (e) => {
          e.preventDefault()
          const form = e.target
          const x = Object.fromEntries(new FormData(form))
          const nuevo = await intenta(() => D.guardarCliente(leerCliente(form)))
          if (!nuevo) return
          await intenta(() => D.guardarDinero({ cliente_id: nuevo.id, mensualidad: Number(x.mensualidad) || 0, pago_unico: Number(x.pago_unico) || 0, moneda: x.moneda, dia_cobro: Number(x.dia_cobro) || null, notas: '' }))
          for (const [i, t] of (f.tareas || []).entries()) {
            if (!x[`t${i}`]) continue
            await intenta(() => D.guardarTarea({ titulo: t.titulo.slice(0, 200), detalle: t.detalle || '', cliente_id: nuevo.id, asignado: x[`a${i}`] || null }))
          }
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
    const puede = [p.pros_trabajar && 'trabaja', p.pros_etapas && 'etapas', p.pros_convertir && 'convierte', p.pros_pagos && 've pagos'].filter(Boolean)
    return `<small>${p.pros_ver === 'todos' ? 'Todos' : 'Los suyos'}${puede.length ? ` · ${puede.join(', ')}` : ''}${p.codigo ? ` · link: ${h(p.codigo)}` : ''}</small>`
  }
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
        ${citas.length ? `<h3>Próximas citas</h3><ul class="lista">${citas.slice(0, 5).map((x) => `<li><a href="#prospecto/${x.id}"><b>${h(nombrePros(x))}</b></a><small>${fechaHora(x.cita)} · ${h(nombreDe(x.asignado))}</small></li>`).join('')}</ul>` : ''}
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
    const [pros, pagos] = await Promise.all([D.prospectos(), puedePros('pagos') ? D.pagosProspectos() : []])
    const pagado = new Set(pagos.map((g) => g.prospecto_id))
    const verMios = !esAdmin() && yo.pros_ver === 'suyos'
    const filtro = verMios ? 'mios' : sessionStorage.getItem('hq-pros') || 'todos'
    const lista = filtro === 'mios' ? pros.filter((x) => x.asignado === yo.id || x.traido_por === yo.id) : filtro === 'todos' ? pros : pros.filter((x) => x.asignado === filtro)
    const mes = new Date().toISOString().slice(0, 7)
    const tarjeta = (x) => `<a class="tarea pros ${atrasado(x) ? 'atrasada' : ''}" href="#prospecto/${x.id}">
        <b>${h(nombrePros(x))}</b>
        ${x.empresa && x.nombre ? `<small>${h(x.nombre)}</small>` : ''}
        ${x.lineas.length ? `<small>${h(x.lineas.map((l) => l.split(': ')[1] || l).slice(0, 3).join(' · '))}${x.lineas.length > 3 ? '…' : ''}</small>` : ''}
        <div class="fila chips">${x.camino === 'consulta' ? '<span class="chip">Consultoría</span>' : x.camino === 'propuesta' ? '<span class="chip">Propuesta</span>' : ''}${pagado.has(x.id) ? '<span class="chip hecha">Pagó ✓</span>' : ''}${x.origen === 'manual' ? '<span class="chip">A mano</span>' : ''}</div>
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
    const [pros, notas, pagos] = await Promise.all([D.prospectos(), D.notasProspecto(pid), puedePros('pagos') ? D.pagosProspectos() : []])
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
          <div class="fila chips"><span class="chip etapa-${x.etapa}">${ETAPAS[x.etapa]}</span>${x.camino ? `<span class="chip">${x.camino === 'consulta' ? 'Quiere consultoría' : 'Quiere su propuesta'}</span>` : ''}<span class="chip">${x.origen === 'portal' ? 'Llegó por el portal' : 'Apuntado a mano'}</span>${x.acepta_novedades ? '<span class="chip hecha">Acepta novedades</span>' : ''}</div>
          <h3>Contacto</h3>
          <p><b>${h(x.nombre || '—')}</b>${x.empresa ? ` · ${h(x.empresa)}` : ''}</p>
          <p>${[x.whatsapp && `<a href="https://wa.me/${h(x.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp ${h(x.whatsapp)}</a>`, x.correo && `<a href="mailto:${h(x.correo)}">${h(x.correo)}</a>`].filter(Boolean).join(' · ') || '<span class="vacio">Todavía no deja sus datos.</span>'}</p>
          ${x.direccion ? `<p><small>${h(x.direccion)}</small></p>` : ''}
          <p><small>Lo atiende: <b>${h(nombreDe(x.asignado))}</b>${x.traido_por ? ` · Link de: ${h(nombreDe(x.traido_por))}` : ''}${x.link ? ` · ${PORTAL.replace('https://', '')}/${h(x.link)}` : ''} · Llegó ${fechaCorta(x.creado)}</small></p>
          ${x.cita ? `<p>📅 <b>${fechaHora(x.cita)}</b>${x.meet ? ` · <a href="${h(x.meet)}" target="_blank" rel="noopener">Entrar al Meet ↗</a>` : ''}</p>` : ''}
          ${x.etapa === 'perdido' && x.motivo_perdido ? `<p class="rojo">Perdido: ${h(x.motivo_perdido)}</p>` : ''}
          ${cliente ? `<p><a class="btn" href="#cliente/${cliente.id}">Ver su ficha de cliente →</a></p>` : ''}
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
              ? `<p>${[d.giro, d.tamano && `${d.tamano} personas`, d.pais, d.urgencia].filter(Boolean).map(h).join(' · ')}</p>${d.quiere ? `<blockquote>${h(d.quiere)}</blockquote>` : ''}`
              : '<p class="vacio">Todavía no contesta el diagnóstico.</p>'
          }
          ${puedePros('pagos') ? `<h3>Pagos</h3>${suyos.length ? `<ul class="lista">${suyos.map((g) => `<li><b>${dinero(g.monto, g.moneda)}</b><small>${h(g.concepto)} · ${fechaCorta(g.fecha)} · Stripe</small></li>`).join('')}</ul>` : '<p class="vacio">No ha pagado.</p>'}` : ''}
        </div>
        <div class="tarjeta ancho-total">
          <h3>Notas <small>no se borran ni se cambian</small></h3>
          ${notas.length ? `<ul class="lista notas">${notas.map((n) => `<li><b>${h(nombreDe(n.autor))}</b><small>${fechaCorta(n.creada)} ${hora(n.creada)}</small><p>${h(n.texto)}</p></li>`).join('')}</ul>` : '<p class="vacio">Sin notas todavía.</p>'}
          ${puedePros('trabajar') ? `<form id="px-nota"><textarea name="texto" rows="2" maxlength="2000" required placeholder="Qué pasó: le llamé, le mandé un caso, pidió precio…"></textarea><div class="acciones"><button class="btn">Agregar nota</button></div></form>` : ''}
        </div>
      </div>`
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

  // -------------------------------------------------------------- tareas

  async function vistaTareas(v) {
    titulo('Tareas')
    const tareas = await D.tareas()
    const filtro = sessionStorage.getItem('hq-tareas') || (esAdmin() ? 'todas' : 'mias')
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
                <small>${h(clienteDe(x.cliente_id)?.nombre ?? 'Interna')} · ${h(nombreDe(x.asignado))}${x.vence ? ` · ${fechaCorta(x.vence)}` : ''}</small>
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
        if (esAdmin() || t.creada_por === yo.id) editarTarea(t)
      }
    })
  }

  function editarTarea(t) {
    abrirModal(
      `<form id="f-tarea"><h2>${t.id ? 'Editar tarea' : 'Nueva tarea'}</h2>
        <div class="campos">
          <label class="ancho">Qué hay que hacer<input name="titulo" required maxlength="200" value="${h(t.titulo)}"></label>
          <label class="ancho">Detalle<textarea name="detalle" rows="3">${h(t.detalle)}</textarea></label>
          <label>Cliente<select name="cliente_id"><option value="">Interna (NXUS)</option>${clientes.map((c) => `<option value="${c.id}" ${c.id === t.cliente_id ? 'selected' : ''}>${h(c.nombre)}</option>`).join('')}</select></label>
          <label>Para<select name="asignado">${opcionesPersonas(t.asignado ?? yo.id, 'Sin asignar')}</select></label>
          <label>Vence<input name="vence" type="date" value="${h(t.vence || '')}"></label>
          <label>Estado<select name="estado">${opciones(TAREA, t.estado || 'pendiente')}</select></label>
        </div>
        <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button>
        ${t.id && esAdmin() ? '<button type="button" class="btn peligro" id="t-borrar">Borrar</button>' : ''}</div></form>`,
      (caja) => {
        $('#f-tarea', caja).onsubmit = async (e) => {
          e.preventDefault()
          const d = Object.fromEntries(new FormData(e.target))
          const ok = await intenta(
            () => D.guardarTarea({ ...(t.id ? { id: t.id } : {}), titulo: d.titulo.trim(), detalle: d.detalle.trim(), cliente_id: d.cliente_id || null, asignado: d.asignado || null, vence: d.vence || null, estado: d.estado }),
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
    const bloque = async (sede) => {
      const ps = activos.filter((p) => p.sede === sede)
      if (!ps.length) return ''
      const cards = await Promise.all(
        ps.map(async (p) => `<div class="persona">${await avatar(p, 'grande')}<b>${h(p.nombre)}</b><span>${h(p.cargo || '—')}</span><span class="chip ${p.sede}">${SEDE[p.sede]}</span></div>`),
      )
      return `<h2 class="grupo">${SEDE[sede]} <small>${ps.length}</small></h2><div class="rejilla personas">${cards.join('')}</div>`
    }
    v.innerHTML = (await bloque('usa')) + (await bloque('mexico'))
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
  async function vistaNomina(v) {
    titulo('Nómina')
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
    v.innerHTML = `
      <div class="acciones"><div class="segmento"><button id="q-ant">← Anterior</button><button class="on">${h(q.nombre)}</button><button id="q-sig" ${saltoNomina >= 0 ? 'disabled' : ''}>Siguiente →</button></div></div>
      <div class="kpis"><div class="kpi"><span>A pagar esta quincena</span><b>${dinero(totales.MXN, 'MXN')}</b><small>${totales.USD ? `+ ${dinero(totales.USD)}` : 'en pesos'}</small></div>
        <div class="kpi"><span>Al mes (aprox.)</span><b>${dinero(totales.MXN * 2, 'MXN')}</b><small>${totales.USD ? `+ ${dinero(totales.USD * 2)}` : 'dos quincenas como esta'}</small></div></div>
      ${filas
        .map(({ p, n, r }) =>
          !n
            ? `<div class="tarjeta"><div class="fila"><b>${h(p.nombre)}</b><button class="btn chico" data-esq="${p.id}">Poner su pago</button></div><p class="vacio">Sin esquema de pago todavía.</p></div>`
            : `<div class="tarjeta pago">
                <div class="fila"><div><b>${h(p.nombre)}</b> <span class="chip">${ESQUEMA[n.esquema]}</span> <span class="chip ${p.sede}">${SEDE[p.sede]}</span></div><b class="total">${dinero(r.total, n.moneda)}</b></div>
                <div class="desglose">
                  ${n.esquema !== 'comision' ? `<span>Base quincenal <b>${dinero(r.base, n.moneda)}</b></span>` : ''}
                  ${n.esquema === 'medio-tiempo' ? `<span>Días completos <b>${r.completos} × ${dinero(valorDiaCompleto(n), n.moneda)} = ${dinero(r.extra, n.moneda)}</b>${Number(n.pago_dia_completo) > 0 ? '' : ' <small>(calculado)</small>'}</span>` : ''}
                  ${n.esquema === 'comision' ? `<span>Comisiones <b>${dinero(r.comision, n.moneda)}</b> <small>(${r.mias.length} contratos al ${n.porcentaje}%)</small></span>` : ''}
                  ${r.ajuste ? `<span>Ajustes <b>${dinero(r.ajuste, n.moneda)}</b></span>` : ''}
                  <span>Horas registradas <b>${horas(r.trabajado)}</b></span>
                </div>
                <div class="acciones"><button class="btn chico" data-esq="${p.id}">Su pago</button><button class="btn chico" data-aj="${p.id}">+ Ajuste</button>${n.esquema === 'comision' ? `<button class="btn chico" data-com="${p.id}">+ Comisión</button>` : ''}<button class="btn chico" data-dias="${p.id}">Ver días</button></div>
                ${r.misAjustes.length ? `<ul class="lista">${r.misAjustes.map((a) => `<li><small>${fechaCorta(a.fecha)}</small> ${h(a.concepto)} <b>${dinero(a.monto, n.moneda)}</b> <button class="enlace" data-borrar-aj="${a.id}">quitar</button></li>`).join('')}</ul>` : ''}
                ${
                  n.esquema === 'comision' && trajo(p.id).length
                    ? `<div class="sugeridas"><small>Clientes que trajo (activos):</small><ul class="lista">${trajo(p.id)
                        .map(({ c, d }) => `<li>${h(c.nombre)} <small>${d.mensualidad ? `${dinero(d.mensualidad, d.moneda)}/mes` : 'sin monto'}</small> <button class="btn chico" data-cobro="${p.id}" data-cli="${c.id}">Registrar cobro</button></li>`)
                        .join('')}</ul></div>`
                    : ''
                }
                ${r.mias.length ? `<ul class="lista">${r.mias.map((c) => `<li><small>${fechaCorta(c.fecha)}</small> ${h(clienteDe(c.cliente_id)?.nombre ?? c.concepto)} · cobrado ${dinero(c.monto_cobrado, c.moneda)} → <b>${dinero((c.monto_cobrado * c.porcentaje) / 100, c.moneda)}</b> <button class="enlace" data-borrar-com="${c.id}">quitar</button></li>`).join('')}</ul>` : ''}
              </div>`,
        )
        .join('')}
      <p class="nota">Medio tiempo: cuenta como día completo el que tú marques, o cualquier día con ${DIA_COMPLETO_HORAS} horas o más registradas. Si no le pones monto, el sistema paga las horas de más a su tarifa por hora (día completo = ${JORNADA_COMPLETA} horas).</p>`
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

  // -------------------------------------------------------------- dinero

  async function vistaDinero(v) {
    titulo('Dinero')
    const q = quincena()
    const [din, nom, jor, aju, com, pagos, pros] = await Promise.all([D.dinero(), D.nomina(), D.jornadas(q.desde, q.hasta), D.ajustes(), D.comisiones(), D.pagosProspectos(), D.prospectos()])
    clientes = await D.clientes()
    const consultas = cobradoMes(pagos)
    const ingreso = { ...consultas }
    const filas = clientes.map((c) => ({ c, d: din.find((x) => x.cliente_id === c.id) ?? {} }))
    for (const { c, d } of filas) if (c.estado === 'activo') ingreso[d.moneda || 'USD'] += Number(d.mensualidad || 0)
    const nominaMes = { USD: 0, MXN: 0 }
    for (const n of nom) nominaMes[n.moneda] += calcularPago(n, { jornadas: jor, ajustes: aju, comisiones: com, desde: q.desde, hasta: q.hasta }).total * 2
    const margen = (m) => ingreso[m] - nominaMes[m]
    const avance = Math.min(100, Math.round((Math.max(0, margen('USD')) / META_USD) * 100))
    v.innerHTML = `
      <div class="kpis">
        <div class="kpi"><span>Ingreso del mes</span><b>${dinero(ingreso.USD)}</b><small>${dinero(ingreso.MXN, 'MXN')}</small></div>
        <div class="kpi"><span>Consultorías cobradas (mes)</span><b>${dinero(consultas.MXN, 'MXN')}</b><small>${consultas.USD ? `+ ${dinero(consultas.USD)}` : 'por el portal'}</small></div>
        <div class="kpi"><span>Nómina al mes (aprox.)</span><b>${dinero(nominaMes.USD)}</b><small>${dinero(nominaMes.MXN, 'MXN')}</small></div>
        <div class="kpi"><span>Queda (antes de gastos)</span><b class="${margen('USD') < 0 ? 'rojo' : ''}">${dinero(margen('USD'))}</b><small class="${margen('MXN') < 0 ? 'rojo' : ''}">${dinero(margen('MXN'), 'MXN')}</small></div>
      </div>
      <div class="tarjeta meta"><div class="fila"><b>Meta: ${dinero(META_USD)} libres al mes</b><span>${avance}%</span></div><div class="barra"><i style="width:${avance}%"></i></div><small>En dólares, ingreso menos nómina. Gastos e impuestos se agregan después.</small></div>
      <div class="tarjeta"><h3>Lo que paga cada cliente</h3>
        <table class="tabla"><tr><th>Cliente</th><th>Estado</th><th>Mensualidad</th><th>Pago único</th><th>Cobro</th><th></th></tr>
        ${filas.map(({ c, d }) => `<tr><td><a href="#cliente/${c.id}">${h(c.nombre)}</a></td><td><span class="chip ${c.estado}">${ESTADOS[c.estado]}</span></td><td>${dinero(d.mensualidad, d.moneda)}</td><td>${dinero(d.pago_unico, d.moneda)}</td><td>${d.dia_cobro ? `día ${d.dia_cobro}` : '—'}</td><td><button class="btn chico" data-din="${c.id}">Cambiar</button></td></tr>`).join('')}
        </table></div>
      <div class="tarjeta"><h3>Consultorías cobradas por el portal</h3>${
        pagos.length
          ? `<table class="tabla"><tr><th>Fecha</th><th>Prospecto</th><th>Monto</th></tr>${pagos
              .map((g) => {
                const x = pros.find((y) => y.id === g.prospecto_id)
                return `<tr><td>${fechaCorta(g.fecha)}</td><td>${x ? `<a href="#prospecto/${x.id}">${h(x.empresa || x.nombre || x.link)}</a>` : '—'}</td><td>${dinero(g.monto, g.moneda)}</td></tr>`
              })
              .join('')}</table>`
          : '<p class="vacio">Todavía no hay consultorías cobradas.</p>'
      }</div>
      <p class="nota">Ingreso del mes = mensualidades de clientes activos + consultorías cobradas este mes. Facturas: Zoho Invoice se conecta en la siguiente fase, solo para ti.</p>`
    $$('[data-din]', v).forEach((b) => (b.onclick = () => editarDinero(clienteDe(b.dataset.din), din.find((x) => x.cliente_id === b.dataset.din))))
  }

  // ------------------------------------------------------------ personas

  async function vistaPersonas(v) {
    titulo('Personas')
    personas = await D.personas()
    const filas = await Promise.all(
      personas.map(
        async (p) =>
          `<tr class="${p.activo ? '' : 'apagado'}"><td class="con-avatar">${await avatar(p)}<div><b>${h(p.nombre)}</b><small>${h(p.correo)}</small></div></td><td>${h(p.cargo)}</td><td><span class="chip ${p.sede}">${SEDE[p.sede]}</span></td><td>${p.rol === 'admin' ? 'Admin' : 'Equipo'}</td><td>${p.rol === 'admin' ? 'Todo' : resumenPermisos(p)}</td><td>${p.activo ? 'Activo' : 'Apagado'}</td><td><button class="btn chico" data-per="${p.id}">Editar</button></td></tr>`,
      ),
    )
    v.innerHTML = `
      <div class="acciones"><button class="btn primario" id="p-nueva">+ Dar de alta</button></div>
      <div class="tarjeta"><table class="tabla"><tr><th>Persona</th><th>Cargo</th><th>Dónde</th><th>Rol</th><th>Prospectos</th><th>Acceso</th><th></th></tr>${filas.join('')}</table></div>
      <p class="nota">Cada persona entra con su correo y su contraseña. Solo tú ves todo; los demás, aunque sean socios, entran como equipo. Lo que cada quien puede hacer con los prospectos lo decides en <b>Editar</b>.</p>`
    $('#p-nueva', v).onclick = () => editarPersona(null)
    $$('[data-per]', v).forEach((b) => (b.onclick = () => editarPersona(persona(b.dataset.per))))
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
          ${nueva ? `<label>Correo<input name="correo" type="email" required></label><label>Contraseña<input name="clave" type="text" minlength="8" required placeholder="mínimo 8"></label>` : ''}
          ${!nueva && p.id !== yo.id ? `<label class="check"><input type="checkbox" name="activo" ${p.activo ? 'checked' : ''}> Acceso prendido</label>` : ''}
          ${!nueva ? `<label class="ancho">Foto<input name="foto" type="file" accept="image/jpeg,image/png,image/webp"></label>` : ''}
        </div>
        ${
          !nueva && p.rol !== 'admin'
            ? `<fieldset class="permisos"><legend>Prospectos</legend>
                <div class="campos">
                  <label class="ancho">Qué prospectos ve<select name="pros_ver">${opciones(VER_PROS, p.pros_ver || 'nada')}</select></label>
                  <label class="check ancho"><input type="checkbox" name="pros_trabajar" ${p.pros_trabajar ? 'checked' : ''}> Trabajarlos: notas, siguiente paso, datos de contacto y apuntar prospectos nuevos</label>
                  <label class="check ancho"><input type="checkbox" name="pros_etapas" ${p.pros_etapas ? 'checked' : ''}> Mover etapas (reunión hecha, propuesta enviada, perdido…)</label>
                  <label class="check ancho"><input type="checkbox" name="pros_convertir" ${p.pros_convertir ? 'checked' : ''}> Convertirlos en clientes</label>
                  <label class="check ancho"><input type="checkbox" name="pros_pagos" ${p.pros_pagos ? 'checked' : ''}> Ver lo que pagaron</label>
                  <label class="ancho">Código de su link <small>empezar.nxusai.org/nombre-del-prospecto?de=<b>código</b></small><input name="codigo" maxlength="30" pattern="[a-z0-9-]{2,30}" value="${h(p.codigo || '')}" placeholder="${h(slug(p.nombre.split(' ')[0]))}"></label>
                </div>
                <p class="nota">Asignar y borrar prospectos es solo tuyo. Los prospectos que lleguen por su link quedan a su nombre (y su comisión, si cobra comisión).</p>
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
            ok = await intenta(() => D.crearPersona({ nombre: d.nombre.trim(), cargo: d.cargo.trim(), sede: d.sede, reporta_a: d.reporta_a || null, correo: d.correo.trim(), clave: d.clave }), `${d.nombre} ya puede entrar con su correo`)
          } else {
            const pros =
              p.rol !== 'admin'
                ? { pros_ver: d.pros_ver, pros_trabajar: !!d.pros_trabajar, pros_etapas: !!d.pros_etapas, pros_convertir: !!d.pros_convertir, pros_pagos: !!d.pros_pagos, codigo: slug(d.codigo).slice(0, 30) || null }
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
          const clave = prompt(`Nueva contraseña para ${p.nombre} (mínimo 8):`)
          if (clave) await intenta(() => D.claveDe(p.id, clave), 'Contraseña cambiada')
        })
      },
    )
  }

  // ------------------------------------------------------------ bitácora

  async function vistaBitacora(v) {
    titulo('Bitácora')
    const b = await D.bitacora()
    const QUE = { insert: 'creó', update: 'cambió', delete: 'borró' }
    const TABLA = { perfiles: 'una persona', clientes: 'un cliente', clientes_dinero: 'lo que paga un cliente', tareas: 'una tarea', jornadas: 'una entrada/salida', nomina: 'una nómina', nomina_ajustes: 'un ajuste', comisiones: 'una comisión', prospectos: 'un prospecto', prospectos_notas: 'una nota de prospecto', prospectos_pagos: 'un pago de consultoría' }
    v.innerHTML = `<div class="tarjeta">${
      b.length
        ? `<table class="tabla"><tr><th>Cuándo</th><th>Quién</th><th>Qué</th></tr>${b.map((x) => `<tr><td>${fechaCorta(x.cuando)} ${hora(x.cuando)}</td><td>${h(x.quien ? nombreDe(x.quien) : 'Sistema / portal / NEX')}</td><td>${QUE[x.accion] ?? x.accion} ${TABLA[x.tabla] ?? x.tabla}</td></tr>`).join('')}</table>`
        : '<p class="vacio">Todavía no hay movimientos.</p>'
    }</div>`
  }

  // ------------------------------------------------------------- arranque

  D.alCambiarSesion?.((evento) => {
    if (evento === 'PASSWORD_RECOVERY') {
      const clave = prompt('Escribe tu contraseña nueva (mínimo 8):')
      if (clave) intenta(() => D.nuevaClave(clave), 'Contraseña cambiada')
    }
  })
  D.sesion()
    .then((p) => (p ? arrancar(p) : pantallaEntrada()))
    .catch((err) => pantallaEntrada(err.message))
}
