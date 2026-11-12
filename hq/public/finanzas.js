// Finanzas: lo que entra (clientes, consultorías, otros), lo que sale (gastos del negocio,
// nómina y gastos personales), lo que queda, y lo que se aparta para las metas.
// Todo se calcula solo con lo que ya está en HQ: cómo paga cada cliente (aunque sea "cada dos
// viernes"), los cobros que sí llegaron, los gastos con sus días, la nómina y el plan de ahorro.
// Lo personal (gastos personales y ahorro para metas) solo lo ve Eduardo: lo cuida la base de datos.

export const FRECUENCIAS = {
  mensual: 'Cada mes',
  quincenal: 'Cada quincena (dos días al mes)',
  catorcenal: 'Cada dos semanas (ej. cada dos viernes)',
  semanal: 'Cada semana',
  bimestral: 'Cada 2 meses',
  trimestral: 'Cada 3 meses',
  semestral: 'Cada 6 meses',
  anual: 'Cada año',
  unico: 'Una sola vez',
  irregular: 'Sin fecha fija (registro cada cobro)',
}
const FREC_GASTO = Object.fromEntries(Object.entries(FRECUENCIAS).filter(([k]) => k !== 'irregular'))
const FREC_AHORRO = { '': 'Sin plan fijo', semanal: 'Cada semana', catorcenal: 'Cada dos semanas', quincenal: 'Cada quincena', mensual: 'Cada mes' }
const MESES_DE = { bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }
const POR_MES = { mensual: 1, quincenal: 2, semanal: 52 / 12, catorcenal: 26 / 12, bimestral: 1 / 2, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12, unico: 0, irregular: 0 }
export const CATEGORIAS = {
  renta: 'Renta / oficina',
  software: 'Software y suscripciones',
  publicidad: 'Publicidad',
  servicios: 'Luz, internet, teléfono',
  profesionales: 'Contador, abogado, freelancers',
  impuestos: 'Impuestos',
  prestamos: 'Préstamos y tarjetas',
  transporte: 'Auto y transporte',
  seguros: 'Seguros',
  casa: 'Casa',
  familia: 'Familia y escuela',
  comida: 'Comida y súper',
  salud: 'Salud',
  otros: 'Otros',
}
const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const TOL = 6 // días de tolerancia para reconocer que un cobro corresponde a una fecha programada

// ----------------------------------------------------------- fechas
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const deIso = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00`)
const utc = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
const entreDias = (a, b) => Math.round((utc(b) - utc(a)) / 864e5)
const sumarDias = (s, n) => {
  const d = deIso(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}
const ultimoDia = (y, m) => new Date(y, m + 1, 0).getDate()
const hoyIso = () => iso(new Date())
const mesIso = (y, m) => iso(new Date(y, m, 1))
const finMes = (y, m) => iso(new Date(y, m + 1, 1)) // exclusivo
const fechaBonita = (s) => {
  const t = deIso(s).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const nombreMes = (y, m) => {
  const t = new Date(y, m, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Las fechas en que toca un pago, entre desde (incluido) y hasta (sin incluir), AAAA-MM-DD.
 * plan: { frecuencia, ancla, dias, fin }. ancla = desde cuándo (o un día en que sí tocó, para "cada dos semanas").
 */
export function fechas(plan, desde, hasta) {
  const { frecuencia = 'mensual', ancla = null, fin = null } = plan
  let dias = (plan.dias ?? []).map(Number).filter((n) => n >= 1 && n <= 31)
  const out = []
  if (frecuencia === 'irregular') return out
  if (frecuencia === 'unico') return ancla && ancla >= desde && ancla < hasta && (!fin || ancla <= fin) ? [ancla] : out
  if (frecuencia === 'semanal' || frecuencia === 'catorcenal') {
    if (!ancla) return out
    const paso = frecuencia === 'semanal' ? 7 : 14
    let k = Math.ceil(entreDias(ancla, desde) / paso)
    for (let f = sumarDias(ancla, k * paso); f < hasta; k++, f = sumarDias(ancla, k * paso)) if (f >= desde && (!fin || f <= fin)) out.push(f)
    return out
  }
  if (!dias.length) dias = frecuencia === 'quincenal' ? [15, 31] : ancla ? [deIso(ancla).getDate()] : [1]
  const cada = MESES_DE[frecuencia] || 1
  const a = deIso(desde)
  const z = deIso(hasta)
  const mesAncla = ancla ? deIso(ancla).getFullYear() * 12 + deIso(ancla).getMonth() : null
  for (let y = a.getFullYear(), m = a.getMonth(); y * 12 + m <= z.getFullYear() * 12 + z.getMonth(); m === 11 ? ((m = 0), y++) : m++) {
    if (cada > 1 && mesAncla != null && ((y * 12 + m - mesAncla) % cada + cada) % cada !== 0) continue
    for (const d of [...new Set(dias)].sort((p, q) => p - q)) {
      const f = iso(new Date(y, m, Math.min(d, ultimoDia(y, m))))
      if (f >= desde && f < hasta && (!ancla || f >= ancla) && (!fin || f <= fin) && !out.includes(f)) out.push(f)
    }
  }
  return out
}

/** Cuánto es al mes (aproximado) un pago que se repite. */
export const alMes = (monto, frecuencia, dias = []) => Number(monto || 0) * (frecuencia === 'mensual' ? Math.max(1, (dias ?? []).length) : POR_MES[frecuencia] ?? 0)

/** "Cada dos semanas · viernes" / "Día 15 y 30 de cada mes" … */
export function describirPlan({ frecuencia, ancla, dias = [] }) {
  const ds = (dias ?? []).filter(Boolean)
  const lista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : `${xs[0]}`)
  if (frecuencia === 'semanal' || frecuencia === 'catorcenal') return `${frecuencia === 'semanal' ? 'Cada semana' : 'Cada dos semanas'}${ancla ? ` · los ${DIAS_SEM[deIso(ancla).getDay()]}` : ' · falta un día de referencia'}`
  if (frecuencia === 'quincenal') return `Días ${lista(ds.length ? ds : [15, 'último'])} de cada mes`
  if (frecuencia === 'mensual') return ds.length ? `Día ${lista(ds)} de cada mes` : ancla ? `Día ${deIso(ancla).getDate()} de cada mes` : 'Cada mes'
  if (MESES_DE[frecuencia]) return `${FRECUENCIAS[frecuencia]}${ancla ? ` · desde ${fechaBonita(ancla)}` : ''}`
  if (frecuencia === 'unico') return ancla ? `Una vez · ${fechaBonita(ancla)}` : 'Una vez'
  return 'Sin fecha fija'
}

/** El plan de cobro de un cliente, a partir de su fila de dinero. */
export function planCliente(d = {}) {
  const frecuencia = d.frecuencia || 'mensual'
  const monto = Number(d.monto_cobro) || (frecuencia === 'mensual' ? Number(d.mensualidad) || 0 : 0)
  const dias = (d.cobro_dias ?? []).length ? d.cobro_dias : d.dia_cobro ? [d.dia_cobro] : []
  return { frecuencia, monto, moneda: d.moneda || 'USD', ancla: d.cobro_ancla || null, dias }
}

// ----------------------------------------------------------- el motor
/**
 * Todo lo que HQ sabe de dinero, en la moneda base.
 * datos: { clientes, dinero, cobros, omitidos, pagosPros, gastos, aportes, metas, nomina, jornadas, ajustes, comisiones, config }
 */
export function motor(datos, { calcularPago, quincena }) {
  const cfg = datos.config ?? { tipo_cambio: 18.5, moneda_base: 'USD', saldo: 0, saldo_moneda: 'USD', meta_libre: 0 }
  const tc = Number(cfg.tipo_cambio) || 18.5
  const base = cfg.moneda_base || 'USD'
  const conv = (monto, moneda = 'USD') => {
    const n = Number(monto || 0)
    if (moneda === base) return n
    return base === 'USD' ? n / tc : n * tc
  }
  const hoy = hoyIso()
  // Desde cuándo HQ lleva las cuentas (lo de antes no se inventa como pendiente ni como gasto).
  const inicio = String(cfg.desde || hoy).slice(0, 10)
  const desdeInicio = (d) => (d < inicio ? inicio : d)
  const activos = datos.clientes.filter((c) => c.estado === 'activo')
  const planes = activos
    .map((c) => ({ c, d: datos.dinero.find((x) => x.cliente_id === c.id) }))
    .filter((x) => x.d)
    .map(({ c, d }) => ({ c, ...planCliente(d) }))

  /** Las fechas de cobro de los clientes, con su estado (cobrado, no pagó, pendiente, vencido). */
  function cobrosProgramados(desde, hasta) {
    const usados = new Set()
    const out = []
    for (const p of planes) {
      if (!p.monto) continue
      for (const f of fechas(p, desdeInicio(desde), hasta)) {
        const omit = datos.omitidos.find((o) => o.cliente_id === p.c.id && o.fecha === f)
        let cobro = datos.cobros.find((x) => x.cliente_id === p.c.id && x.para_fecha === f)
        if (!cobro)
          cobro = datos.cobros
            .filter((x) => x.cliente_id === p.c.id && !x.para_fecha && !usados.has(x.id) && Math.abs(entreDias(x.fecha, f)) <= TOL)
            .sort((a, b) => Math.abs(entreDias(a.fecha, f)) - Math.abs(entreDias(b.fecha, f)))[0]
        if (cobro) usados.add(cobro.id)
        out.push({
          cliente: p.c,
          fecha: f,
          monto: p.monto,
          moneda: p.moneda,
          base: conv(p.monto, p.moneda),
          estado: cobro ? 'cobrado' : omit ? 'omitido' : f < hoy ? 'vencido' : 'pendiente',
          cobro,
          omit,
        })
      }
    }
    return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  const gastosActivos = datos.gastos.filter((g) => g.activo !== false)
  function gastosEn(desde, hasta) {
    const out = []
    for (const g of gastosActivos)
      for (const f of fechas({ frecuencia: g.frecuencia, ancla: g.ancla, dias: g.dias, fin: g.hasta }, desdeInicio(desde), hasta))
        out.push({ g, fecha: f, monto: Number(g.monto), moneda: g.moneda, base: conv(g.monto, g.moneda), tipo: g.tipo })
    return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  /** Nómina de una quincena (lo que se paga el 15 y el último día), en la moneda base. */
  function nominaQuincena(q) {
    let total = 0
    for (const n of datos.nomina) total += conv(calcularPago(n, { jornadas: datos.jornadas, ajustes: datos.ajustes, comisiones: datos.comisiones, desde: q.desde, hasta: q.hasta }).total, n.moneda)
    return total
  }
  const quincenasDelMes = (y, m) => {
    const ref = new Date(y, m, 5)
    const a = quincena(ref)
    const b = quincena(new Date(y, m, 20))
    return [
      { ...a, paga: iso(new Date(y, m, 15)) },
      { ...b, paga: iso(new Date(y, m, ultimoDia(y, m))) },
    ]
  }

  const metasConDinero = datos.metas.filter((x) => x.estado !== 'lograda' && Number(x.monto_objetivo) > 0)
  function aportesPlaneados(desde, hasta) {
    const out = []
    for (const mt of metasConDinero) {
      if (!mt.aporte_frecuencia || !Number(mt.aporte_monto)) continue
      const plan =
        mt.aporte_frecuencia === 'quincenal'
          ? { frecuencia: 'quincenal', dias: [15, 31] }
          : mt.aporte_frecuencia === 'mensual'
            ? { frecuencia: 'mensual', dias: [1] }
            : { frecuencia: mt.aporte_frecuencia, ancla: String(mt.creado || hoy).slice(0, 10) }
      for (const f of fechas(plan, desde, hasta)) {
        const hecho = datos.aportes.some((a) => a.meta_id === mt.id && Math.abs(entreDias(a.fecha, f)) <= TOL)
        out.push({ meta: mt, fecha: f, monto: Number(mt.aporte_monto), moneda: mt.moneda, base: conv(mt.aporte_monto, mt.moneda), hecho })
      }
    }
    return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  /** El mes completo: lo real hasta hoy y lo que falta (proyectado). */
  function mes(y, m) {
    const desde = mesIso(y, m)
    const hasta = finMes(y, m)
    const pasado = hasta <= hoy
    const enRango = (f) => f >= desde && f < hasta
    const cobrosReales = datos.cobros.filter((x) => enRango(x.fecha))
    const consultorias = datos.pagosPros.filter((g) => enRango(iso(new Date(g.fecha))))
    const real = cobrosReales.reduce((s, x) => s + conv(x.monto, x.moneda), 0) + consultorias.reduce((s, g) => s + conv(g.monto, g.moneda), 0)
    const prog = cobrosProgramados(desde, hasta)
    const porCobrar = prog.filter((x) => x.estado === 'pendiente').reduce((s, x) => s + x.base, 0)
    const vencido = prog.filter((x) => x.estado === 'vencido').reduce((s, x) => s + x.base, 0)
    const esperado = prog.filter((x) => x.estado !== 'omitido').reduce((s, x) => s + x.base, 0)
    const ingresos = real + porCobrar
    const gs = gastosEn(desde, hasta)
    const gastosNegocio = gs.filter((x) => x.tipo === 'negocio').reduce((s, x) => s + x.base, 0)
    const gastosPersonales = gs.filter((x) => x.tipo === 'personal').reduce((s, x) => s + x.base, 0)
    const nomina = quincenasDelMes(y, m).filter((q) => q.paga >= inicio).reduce((s, q) => s + nominaQuincena(q), 0)
    const aportesReales = datos.aportes.filter((a) => enRango(a.fecha)).reduce((s, a) => s + conv(a.monto, a.moneda), 0)
    const aportesFaltan = pasado ? 0 : aportesPlaneados(hoy > desde ? hoy : desde, hasta).filter((a) => !a.hecho).reduce((s, a) => s + a.base, 0)
    const metas = aportesReales + aportesFaltan
    const ganancia = ingresos - gastosNegocio - nomina
    const libre = ganancia - gastosPersonales - metas
    return { y, m, desde, hasta, pasado, antes: hasta <= inicio, real, porCobrar, vencido, esperado, ingresos, gastosNegocio, gastosPersonales, nomina, metas, aportesReales, ganancia, libre, margen: ingresos ? ganancia / ingresos : 0, prog, gastos: gs, consultorias, cobrosReales }
  }

  /** Lo que entra y sale día por día en los próximos N días, con el saldo que va quedando. */
  function flujo(dias = 60, { personal = true } = {}) {
    const desde = hoy
    const hasta = sumarDias(hoy, dias)
    const mov = []
    for (const x of cobrosProgramados(sumarDias(hoy, -TOL), hasta)) if (x.estado === 'pendiente') mov.push({ fecha: x.fecha, tipo: 'entra', que: x.cliente.nombre, base: x.base, detalle: `${FRECUENCIAS[planes.find((p) => p.c.id === x.cliente.id)?.frecuencia] ?? ''}` })
    for (const x of gastosEn(desde, hasta)) if (personal || x.tipo === 'negocio') mov.push({ fecha: x.fecha, tipo: 'sale', que: x.g.concepto, base: -x.base, detalle: x.tipo === 'personal' ? 'Gasto personal' : CATEGORIAS[x.g.categoria] || 'Gasto' })
    const d0 = deIso(desde)
    for (let k = 0; k < Math.ceil(dias / 28) + 2; k++) {
      const y = d0.getFullYear() + Math.floor((d0.getMonth() + k) / 12)
      const m = (d0.getMonth() + k) % 12
      for (const q of quincenasDelMes(y, m)) if (q.paga >= desde && q.paga >= inicio && q.paga < hasta && datos.nomina.length) mov.push({ fecha: q.paga, tipo: 'sale', que: 'Nómina', base: -nominaQuincena(q), detalle: q.nombre })
    }
    if (personal) for (const a of aportesPlaneados(desde, hasta)) if (!a.hecho) mov.push({ fecha: a.fecha, tipo: 'meta', que: `Apartar para: ${a.meta.titulo}`, base: -a.base, detalle: 'Tu plan de ahorro' })
    mov.sort((a, b) => a.fecha.localeCompare(b.fecha) || b.base - a.base)
    let saldo = conv(cfg.saldo, cfg.saldo_moneda)
    let minimo = { saldo, fecha: hoy }
    for (const x of mov) {
      saldo += x.base
      x.saldo = saldo
      if (saldo < minimo.saldo) minimo = { saldo, fecha: x.fecha }
    }
    return { mov, inicial: conv(cfg.saldo, cfg.saldo_moneda), final: saldo, minimo }
  }

  /** Cada meta con dinero: lo apartado, lo que falta y cuándo llega a ese paso. */
  function metasDinero() {
    return datos.metas
      .filter((mt) => Number(mt.monto_objetivo) > 0)
      .map((mt) => {
        const aps = datos.aportes.filter((a) => a.meta_id === mt.id).sort((a, b) => b.fecha.localeCompare(a.fecha))
        const ahorrado = aps.reduce((s, a) => s + (a.moneda === mt.moneda ? Number(a.monto) : conv(a.monto, a.moneda)), 0)
        const objetivo = Number(mt.monto_objetivo)
        const falta = Math.max(0, objetivo - ahorrado)
        const planMes = alMes(mt.aporte_monto, mt.aporte_frecuencia || 'irregular')
        const meses = planMes > 0 ? Math.ceil(falta / planMes) : null
        const llega = meses != null ? iso(new Date(new Date().getFullYear(), new Date().getMonth() + meses, 1)) : null
        let necesita = null
        if (mt.fecha_limite && falta > 0) {
          const ms = Math.max(1, (deIso(mt.fecha_limite).getFullYear() - new Date().getFullYear()) * 12 + deIso(mt.fecha_limite).getMonth() - new Date().getMonth())
          necesita = falta / ms
        }
        return { mt, aps, ahorrado, objetivo, falta, pct: objetivo ? Math.min(100, (ahorrado / objetivo) * 100) : 0, planMes, meses, llega, necesita }
      })
  }

  return { conv, base, tc, cfg, hoy, inicio, planes, cobrosProgramados, gastosEn, mes, flujo, metasDinero, aportesPlaneados }
}

// ----------------------------------------------------------- la vista
export async function vistaFinanzas(v, ctx) {
  const { D, h, $, $$, titulo, dinero, intenta, mostrar, puede, esAdmin } = ctx
  titulo('Finanzas')
  const admin = esAdmin()
  const TABS = { resumen: 'Resumen', ingresos: 'Ingresos', gastos: 'Gastos', flujo: 'Flujo de dinero', ...(admin ? { metas: 'Ahorro para metas' } : {}) }
  let tab = sessionStorage.getItem('hq-fin')
  if (!TABS[tab]) tab = 'resumen'
  let salto = Number(sessionStorage.getItem('hq-fin-mes') || 0)
  const ahora = new Date()
  const ref = new Date(ahora.getFullYear(), ahora.getMonth() + salto, 1)
  const desdeDatos = new Date(ahora.getFullYear(), ahora.getMonth() - 7, 1)
  const hastaDatos = new Date(ahora.getFullYear(), ahora.getMonth() + 7, 1)
  const vacio = () => Promise.resolve([])
  const [clientes, din, cobros, omitidos, pagosPros, gastos, aportes, metas, nomina, jornadas, ajustes, comisiones, config] = await Promise.all([
    D.clientes(),
    D.dinero().catch(() => []),
    D.cobros().catch(() => []),
    D.cobrosOmitidos().catch(() => []),
    D.pagosProspectos().catch(() => []),
    D.gastos().catch(() => []),
    admin ? D.aportes().catch(() => []) : vacio(),
    admin ? D.metas().catch(() => []) : vacio(),
    puede('nomina_ver') ? D.nomina().catch(() => []) : vacio(),
    puede('nomina_ver') ? D.jornadas(desdeDatos, hastaDatos).catch(() => []) : vacio(),
    puede('nomina_ver') ? D.ajustes().catch(() => []) : vacio(),
    puede('nomina_ver') ? D.comisiones().catch(() => []) : vacio(),
    D.finanzasConfig().catch(() => null),
  ])
  const datos = { clientes, dinero: din, cobros, omitidos, pagosPros, gastos, aportes, metas, nomina, jornadas, ajustes, comisiones, config }
  const M = motor(datos, ctx)
  const $b = (n, dec = false) => dinero(dec ? n : Math.round(n), M.base)
  const signo = (n) => (n < 0 ? `−${$b(-n)}` : $b(n))
  const editar = puede('finanzas_editar')

  const pestanas = `<div class="acciones fin-tabs"><div class="segmento">${Object.entries(TABS).map(([k, t]) => `<button data-ft="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>${admin ? '<button class="btn chico" id="fin-ajustes">⚙ Ajustes</button>' : ''}</div>`
  const pie = `<p class="nota">Todo en ${M.base === 'USD' ? 'dólares' : 'pesos'}${M.tc ? ` · tipo de cambio ${M.tc} pesos por dólar` : ''}. ${admin ? 'Solo tú ves los gastos personales y el ahorro para tus metas; a nadie más se le puede dar ese permiso.' : 'Ves lo del negocio; lo personal no aparece aquí.'}</p>`


  // ------------------------------------------------- Resumen
  function resumen() {
    const x = M.mes(ref.getFullYear(), ref.getMonth())
    const libreReal = admin ? x.libre : x.ganancia
    const color = libreReal < 0 ? 'rojo' : x.margen < 0.2 || x.vencido > 0 ? 'amarillo' : 'verde'
    const frase = {
      verde: `Vas en verde: ${x.pasado ? 'te sobró' : 'te van a sobrar'} ${$b(libreReal)} ${x.pasado ? 'ese mes' : 'este mes'}.`,
      amarillo: libreReal < 0 ? '' : `En verde, pero con cuidado: ${x.vencido > 0 ? `hay ${$b(x.vencido)} de cobros atrasados` : `el margen del negocio es de ${Math.round(x.margen * 100)}%`}.`,
      rojo: `Vas en rojo: ${x.pasado ? 'faltaron' : 'van a faltar'} ${$b(-libreReal)} ${x.pasado ? 'ese mes' : 'este mes'}.`,
    }[color]
    const metaLibre = Number(M.cfg.meta_libre || 0)
    const avance = metaLibre ? Math.max(0, Math.min(100, Math.round((libreReal / metaLibre) * 100))) : 0
    const fl = M.flujo(45, { personal: admin })
    const alertas = []
    const venc = M.cobrosProgramados(iso(new Date(ahora.getFullYear(), ahora.getMonth() - 2, 1)), M.hoy).filter((c) => c.estado === 'vencido')
    if (venc.length) alertas.push(`<li class="mal">💸 <b>${venc.length} cobro${venc.length > 1 ? 's' : ''} sin confirmar</b> (${$b(venc.reduce((s, c) => s + c.base, 0))}): ${[...new Set(venc.map((c) => c.cliente.nombre))].slice(0, 4).map(h).join(', ')}. <a href="#" data-ir-tab="ingresos">Confirmar</a></li>`)
    if (fl.minimo.saldo < 0) alertas.push(`<li class="mal">⚠ Con lo programado, el <b>${fechaBonita(fl.minimo.fecha)}</b> tu cuenta quedaría en <b>${signo(fl.minimo.saldo)}</b>. <a href="#" data-ir-tab="flujo">Ver flujo</a></li>`)
    if (x.gastosNegocio + x.nomina > x.ingresos && x.ingresos > 0) alertas.push('<li class="mal">El negocio gasta más de lo que entra este mes.</li>')
    if (!M.planes.length) alertas.push('<li>Pon cómo te paga cada cliente en <a href="#" data-ir-tab="ingresos">Ingresos</a> para que el sistema calcule solo.</li>')
    if (!gastos.length) alertas.push('<li>Agrega tus gastos en <a href="#" data-ir-tab="gastos">Gastos</a> (con los días en que se pagan).</li>')
    if (M.cfg.saldo_fecha == null && admin) alertas.push('<li>Pon cuánto tienes hoy en el banco (⚙ Ajustes) para ver el flujo real.</li>')
    if (!puede('nomina_ver')) alertas.push('<li>No tienes permiso de ver la nómina: no se resta aquí.</li>')
    const cascada = [
      ['Entra', x.ingresos, `${$b(x.real)} ya cobrado${x.porCobrar ? ` + ${$b(x.porCobrar)} por cobrar` : ''}`],
      ['− Gastos del negocio', -x.gastosNegocio, ''],
      ['− Nómina', -x.nomina, ''],
      ['= Ganancia del negocio', x.ganancia, `margen ${Math.round(x.margen * 100)}%`, 'total'],
      ...(admin
        ? [
            ['− Gastos personales', -x.gastosPersonales, ''],
            ['− Apartado para tus metas', -x.metas, x.aportesReales ? `${$b(x.aportesReales)} ya apartado` : ''],
            ['= Te queda libre', x.libre, '', 'total'],
          ]
        : []),
    ]
    return `
      <div class="acciones mes-nav"><div class="segmento"><button data-mes="-1">←</button><button class="on">${nombreMes(ref.getFullYear(), ref.getMonth())}</button><button data-mes="1">→</button></div>${salto ? '<button class="btn chico" data-mes="0">Hoy</button>' : ''}</div>
      <div class="tarjeta semaforo ${color}"><span class="luz"></span><div><b>${frase}</b><small>${x.pasado ? 'Mes cerrado: con lo que de verdad se cobró.' : 'Con lo ya cobrado más lo que falta cobrar y pagar en el mes.'}</small></div></div>
      <div class="kpis">
        <div class="kpi"><span>Entra</span><b>${$b(x.ingresos)}</b><small>${$b(x.real)} cobrado</small></div>
        <div class="kpi"><span>Sale (negocio)</span><b>${$b(x.gastosNegocio + x.nomina)}</b><small>gastos ${$b(x.gastosNegocio)} · nómina ${$b(x.nomina)}</small></div>
        <div class="kpi"><span>Ganancia</span><b class="${x.ganancia < 0 ? 'rojo' : ''}">${signo(x.ganancia)}</b><small>margen ${Math.round(x.margen * 100)}%</small></div>
        ${admin ? `<div class="kpi"><span>Te queda libre</span><b class="${x.libre < 0 ? 'rojo' : ''}">${signo(x.libre)}</b><small>después de lo personal y tus metas</small></div>` : `<div class="kpi"><span>Por cobrar</span><b>${$b(x.porCobrar)}</b><small>${x.vencido ? `${$b(x.vencido)} atrasado` : 'al día'}</small></div>`}
      </div>
      ${admin && metaLibre ? `<div class="tarjeta meta"><div class="fila"><b>Meta: ${$b(metaLibre)} libres al mes</b><span>${avance}%</span></div><div class="barra"><i style="width:${avance}%"></i></div></div>` : ''}
      ${alertas.length ? `<div class="tarjeta"><h3>Para tu atención</h3><ul class="alertas-fin">${alertas.join('')}</ul></div>` : ''}
      <div class="dos">
        <div class="tarjeta"><h3>El mes, paso a paso</h3><table class="tabla cascada">${cascada.map(([t, n, s, cls]) => `<tr class="${cls || ''}"><td>${t}${s ? `<small>${s}</small>` : ''}</td><td class="num ${n < 0 && cls ? 'rojo' : ''}">${cls ? signo(n) : n < 0 ? `−${$b(-n)}` : $b(n)}</td></tr>`).join('')}</table></div>
        <div class="tarjeta"><h3>12 meses <small>pasado real · futuro proyectado</small></h3>${grafica()}</div>
      </div>`
  }

  function grafica() {
    const meses = []
    for (let k = -6; k <= 5; k++) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() + k, 1)
      const x = M.mes(d.getFullYear(), d.getMonth())
      if (x.antes) Object.assign(x, { ingresos: 0, gastosNegocio: 0, nomina: 0, gastosPersonales: 0, libre: 0, ganancia: 0 })
      meses.push({ ...x, entra: x.ingresos, sale: x.gastosNegocio + x.nomina + (admin ? x.gastosPersonales : 0), futuro: k > 0, actual: k === 0, etiqueta: d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '') })
    }
    const max = Math.max(1, ...meses.flatMap((x) => [x.entra, x.sale]))
    const W = 560
    const H = 220
    const top = 14
    const abajo = 28
    const izq = 52
    const ancho = (W - izq) / meses.length
    const barra = Math.min(16, (ancho - 10) / 2)
    const y = (n) => top + (H - top - abajo) * (1 - n / max)
    const rect = (x0, n, cls, mes) => {
      const alto = Math.max(n > 0 ? 2 : 0, H - abajo - y(n))
      const yy = H - abajo - alto
      const r = Math.min(4, alto / 2)
      return alto ? `<path class="${cls}${mes.futuro ? ' futuro' : ''}" d="M${x0},${H - abajo} V${yy + r} Q${x0},${yy} ${x0 + r},${yy} H${x0 + barra - r} Q${x0 + barra},${yy} ${x0 + barra},${yy + r} V${H - abajo} Z"/>` : ''
    }
    const barras = meses
      .map((x, i) => {
        const cx = izq + i * ancho + ancho / 2
        const tip = x.antes ? `${nombreMes(x.y, x.m)}&#10;Antes de llevar las cuentas en HQ` : `${nombreMes(x.y, x.m)}${x.futuro ? ' (proyección)' : ''}&#10;Entra: ${$b(x.entra)}&#10;Sale: ${$b(x.sale)}&#10;${admin ? 'Queda' : 'Ganancia'}: ${signo(admin ? x.libre : x.ganancia)}`
        return `<g class="mes-g${x.actual ? ' actual' : ''}" data-tip="${tip}" tabindex="0"><rect class="hit" x="${izq + i * ancho}" y="0" width="${ancho}" height="${H}"/>${rect(cx - barra - 1, x.entra, 'entra', x)}${rect(cx + 1, x.sale, 'sale', x)}<text x="${cx}" y="${H - 8}" text-anchor="middle">${x.etiqueta}</text></g>`
      })
      .join('')
    const lineas = [0.5, 1].map((f) => `<line class="grid" x1="${izq}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}"/><text class="eje" x="${izq - 6}" y="${y(max * f) + 3}" text-anchor="end">${$b(max * f)}</text>`).join('')
    return `<div class="leyenda-fin"><span><i class="entra"></i>Entra</span><span><i class="sale"></i>Sale${admin ? ' (todo)' : ' (negocio)'}</span><span><i class="futuro-m"></i>Proyección</span></div>
      <div class="grafica-fin"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lo que entra y sale cada mes">${lineas}<line class="base" x1="${izq}" x2="${W}" y1="${H - abajo}" y2="${H - abajo}"/>${barras}</svg><div class="tip-fin" hidden></div></div>
      <details class="tabla-ver"><summary>Ver como tabla</summary><div class="tabla-scroll"><table class="tabla"><tr><th>Mes</th><th>Entra</th><th>Sale</th><th>${admin ? 'Queda' : 'Ganancia'}</th></tr>${meses.map((x) => `<tr><td>${nombreMes(x.y, x.m)}${x.futuro ? ' <small>proyección</small>' : x.antes ? ' <small>antes de HQ</small>' : ''}</td><td>${$b(x.entra)}</td><td>${$b(x.sale)}</td><td class="${(admin ? x.libre : x.ganancia) < 0 ? 'rojo' : ''}">${signo(admin ? x.libre : x.ganancia)}</td></tr>`).join('')}</table></div></details>`
  }

  // ------------------------------------------------- Ingresos
  function ingresos() {
    const desde = sumarDias(M.hoy, -60)
    const prog = M.cobrosProgramados(desde, sumarDias(M.hoy, 46))
    const vencidos = prog.filter((x) => x.estado === 'vencido')
    const proximos = prog.filter((x) => x.estado === 'pendiente')
    const filaCobro = (x) => `<li class="cobro-fila ${x.estado}">
        <div><b>${h(x.cliente.nombre)}</b><small>${fechaBonita(x.fecha)} · ${dinero(x.monto, x.moneda)}</small></div>
        ${editar ? `<div class="acciones"><button class="btn chico primario" data-cobrado="${x.cliente.id}|${x.fecha}">✓ Ya pagó</button><button class="btn chico" data-omitir="${x.cliente.id}|${x.fecha}">No pagó / se recorre</button></div>` : `<span class="chip">${x.estado === 'vencido' ? 'sin confirmar' : 'por cobrar'}</span>`}
      </li>`
    const clientesTabla = clientes
      .filter((c) => c.estado !== 'terminado')
      .map((c) => {
        const d = din.find((x) => x.cliente_id === c.id)
        const p = planCliente(d)
        const prox = p.monto ? fechas(p, M.hoy, sumarDias(M.hoy, 400))[0] : null
        return `<tr><td><a href="#cliente/${c.id}">${h(c.nombre)}</a>${c.estado !== 'activo' ? ` <span class="chip ${c.estado}">${c.estado}</span>` : ''}</td><td>${d ? describirPlan(p) : '<span class="vacio-txt">Sin poner</span>'}</td><td>${p.monto ? dinero(p.monto, p.moneda) : '—'}</td><td>${p.monto ? dinero(alMes(p.monto, p.frecuencia, p.dias), p.moneda) : '—'}</td><td>${prox ? fechaBonita(prox) : '—'}</td><td>${editar ? `<button class="btn chico" data-plan="${c.id}">Cómo paga</button>` : ''}</td></tr>`
      })
      .join('')
    const desdeMes = mesIso(ahora.getFullYear(), ahora.getMonth() - 2)
    const historial = [...cobros.filter((x) => x.fecha >= desdeMes).map((x) => ({ ...x, es: 'cobro' })), ...pagosPros.filter((g) => iso(new Date(g.fecha)) >= desdeMes).map((g) => ({ id: g.id, fecha: iso(new Date(g.fecha)), monto: g.monto, moneda: g.moneda, concepto: `${g.concepto || 'Consultoría'} · Stripe`, es: 'stripe' }))].sort((a, b) => b.fecha.localeCompare(a.fecha))
    const alMesTotal = M.planes.reduce((s, p) => s + M.conv(alMes(p.monto, p.frecuencia, p.dias), p.moneda), 0)
    return `
      <div class="kpis">
        <div class="kpi"><span>Al mes (clientes activos)</span><b>${$b(alMesTotal)}</b><small>${M.planes.filter((p) => p.monto).length} clientes con plan</small></div>
        <div class="kpi"><span>Por cobrar · 45 días</span><b>${$b(proximos.reduce((s, x) => s + x.base, 0))}</b><small>${proximos.length} cobros</small></div>
        <div class="kpi"><span>Sin confirmar</span><b class="${vencidos.length ? 'rojo' : ''}">${$b(vencidos.reduce((s, x) => s + x.base, 0))}</b><small>${vencidos.length ? `${vencidos.length} ya pasaron` : 'todo al día'}</small></div>
      </div>
      ${vencidos.length ? `<div class="tarjeta"><h3>¿Ya te pagaron? <small>la fecha ya pasó</small></h3><ul class="cobros-lista">${vencidos.map(filaCobro).join('')}</ul></div>` : ''}
      <div class="tarjeta"><div class="fila"><h3>Próximos cobros <small>45 días</small></h3>${editar ? '<button class="btn chico" id="fin-cobro">+ Registrar un cobro</button>' : ''}</div>${proximos.length ? `<ul class="cobros-lista">${proximos.map(filaCobro).join('')}</ul>` : '<p class="vacio">No hay cobros programados. Pon cómo te paga cada cliente abajo.</p>'}</div>
      <div class="tarjeta"><h3>Cómo te paga cada cliente</h3><div class="tabla-scroll"><table class="tabla"><tr><th>Cliente</th><th>Cuándo</th><th>Cada cobro</th><th>Al mes</th><th>Próximo</th><th></th></tr>${clientesTabla}</table></div>
        <p class="nota">¿Te paga "cada dos viernes"? Elige <b>Cada dos semanas</b> y pon la fecha de <b>un viernes en que sí te pagó</b>: el sistema cuenta de dos en dos semanas desde ahí, así que sabe que este viernes no toca y el siguiente sí. Si un día se recorre, marca "No pagó / se recorre" y registra el cobro cuando llegue; si cambia para siempre, cambia la fecha de referencia.</p></div>
      <div class="tarjeta"><h3>Cobros recibidos <small>últimos 3 meses</small></h3>${
        historial.length
          ? `<div class="tabla-scroll"><table class="tabla"><tr><th>Fecha</th><th>De</th><th>Monto</th><th>Método</th><th></th></tr>${historial.map((x) => `<tr><td>${fechaBonita(x.fecha)}</td><td>${h(x.es === 'stripe' ? x.concepto : x.cliente_id ? clientes.find((c) => c.id === x.cliente_id)?.nombre || '—' : x.concepto || 'Otro ingreso')}${x.nota ? `<small> · ${h(x.nota)}</small>` : ''}</td><td><b>${dinero(x.monto, x.moneda)}</b></td><td>${h(x.metodo || (x.es === 'stripe' ? 'Stripe' : ''))}</td><td>${x.es === 'cobro' && editar ? `<button class="enlace" data-borrar-cobro="${x.id}">quitar</button>` : ''}</td></tr>`).join('')}</table></div>`
          : '<p class="vacio">Aún no registras cobros.</p>'
      }</div>`
  }

  // ------------------------------------------------- Gastos
  function vistaGastos() {
    const filtro = sessionStorage.getItem('hq-fin-g') || 'todos'
    const lista = gastos.filter((g) => filtro === 'todos' || g.tipo === filtro)
    const mensual = (tipo) => gastos.filter((g) => g.activo !== false && (!tipo || g.tipo === tipo)).reduce((s, g) => s + M.conv(alMes(g.monto, g.frecuencia, g.dias), g.moneda), 0)
    const prox = M.gastosEn(M.hoy, sumarDias(M.hoy, 31)).filter((x) => filtro === 'todos' || x.tipo === filtro)
    const porCat = {}
    for (const g of lista) (porCat[g.categoria] ??= []).push(g)
    const grupos = Object.entries(porCat)
      .sort((a, b) => (CATEGORIAS[a[0]] || a[0]).localeCompare(CATEGORIAS[b[0]] || b[0]))
      .map(
        ([cat, gs]) => `<tr class="dia-asis"><td colspan="6">${h(CATEGORIAS[cat] || cat)} <small>${$b(gs.filter((g) => g.activo !== false).reduce((s, g) => s + M.conv(alMes(g.monto, g.frecuencia, g.dias), g.moneda), 0))}/mes</small></td></tr>${gs
          .map((g) => {
            const sig = fechas({ frecuencia: g.frecuencia, ancla: g.ancla, dias: g.dias, fin: g.hasta }, M.hoy, sumarDias(M.hoy, 400))[0]
            return `<tr class="${g.activo === false ? 'apagado' : ''}"><td><b>${h(g.concepto)}</b>${admin ? ` <span class="chip ${g.tipo === 'personal' ? 'personal' : ''}">${g.tipo === 'personal' ? 'Personal' : h(g.empresa || 'Negocio')}</span>` : ''}${g.notas ? `<small> · ${h(g.notas)}</small>` : ''}</td><td>${dinero(g.monto, g.moneda)}</td><td>${describirPlan({ frecuencia: g.frecuencia, ancla: g.ancla, dias: g.dias })}${g.hasta ? `<small> · hasta ${fechaBonita(g.hasta)}</small>` : ''}</td><td>${g.frecuencia === 'unico' ? '—' : dinero(alMes(g.monto, g.frecuencia, g.dias), g.moneda)}</td><td>${sig ? fechaBonita(sig) : '—'}</td><td>${editar && (admin || g.tipo === 'negocio') ? `<button class="btn chico" data-gasto="${g.id}">Editar</button>` : ''}</td></tr>`
          })
          .join('')}`,
      )
      .join('')
    return `
      <div class="kpis">
        <div class="kpi"><span>Gastos del negocio</span><b>${$b(mensual('negocio'))}</b><small>al mes</small></div>
        ${admin ? `<div class="kpi"><span>Gastos personales</span><b>${$b(mensual('personal'))}</b><small>al mes · solo tú</small></div><div class="kpi"><span>Total al mes</span><b>${$b(mensual())}</b><small>sin nómina</small></div>` : ''}
        <div class="kpi"><span>Próximos 30 días</span><b>${$b(prox.reduce((s, x) => s + x.base, 0))}</b><small>${prox.length} pagos</small></div>
      </div>
      <div class="acciones">${admin ? `<div class="segmento">${[['todos', 'Todos'], ['negocio', 'Negocio'], ['personal', 'Personal']].map(([k, t]) => `<button data-gf="${k}" class="${filtro === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}${editar ? '<button class="btn primario" id="fin-gasto">+ Agregar gasto</button>' : ''}</div>
      <div class="tarjeta">${lista.length ? `<div class="tabla-scroll"><table class="tabla tabla-asis"><tr><th>Gasto</th><th>Monto</th><th>Cuándo se paga</th><th>Al mes</th><th>Próximo</th><th></th></tr>${grupos}</table></div>` : '<p class="vacio">Sin gastos todavía. Agrega renta, software, publicidad, tarjetas… con los días en que se pagan.</p>'}</div>
      ${prox.length ? `<div class="tarjeta"><h3>Lo que se paga en los próximos 30 días</h3><ul class="lista">${prox.map((x) => `<li><b>${h(x.g.concepto)}</b><small>${fechaBonita(x.fecha)} · ${dinero(x.monto, x.moneda)}${admin && x.tipo === 'personal' ? ' · personal' : ''}</small></li>`).join('')}</ul></div>` : ''}`
  }

  // ------------------------------------------------- Flujo
  function vistaFlujo() {
    const fl = M.flujo(60, { personal: admin })
    const porDia = new Map()
    for (const x of fl.mov) porDia.set(x.fecha, [...(porDia.get(x.fecha) ?? []), x])
    const filas = [...porDia.entries()]
      .map(([f, xs]) => `<tr class="dia-asis"><td colspan="3">${fechaBonita(f)}</td><td class="num ${xs.at(-1).saldo < 0 ? 'rojo' : ''}">${signo(xs.at(-1).saldo)}</td></tr>${xs.map((x) => `<tr><td>${x.tipo === 'entra' ? '<span class="chip verde-chip">Entra</span>' : x.tipo === 'meta' ? '<span class="chip">Meta</span>' : '<span class="chip">Sale</span>'}</td><td>${h(x.que)}<small> · ${h(x.detalle)}</small></td><td class="num ${x.base < 0 ? '' : 'verde'}">${x.base < 0 ? `−${$b(-x.base)}` : `+${$b(x.base)}`}</td><td></td></tr>`).join('')}`)
      .join('')
    const entra = fl.mov.filter((x) => x.base > 0).reduce((s, x) => s + x.base, 0)
    const sale = fl.mov.filter((x) => x.base < 0).reduce((s, x) => s - x.base, 0)
    return `
      <div class="kpis">
        <div class="kpi"><span>Hoy en el banco</span><b>${$b(fl.inicial)}</b><small>${M.cfg.saldo_fecha ? `al ${fechaBonita(iso(new Date(M.cfg.saldo_fecha)))}` : admin ? 'ponlo en ⚙ Ajustes' : 'sin poner'}</small></div>
        <div class="kpi"><span>Entra · 60 días</span><b>${$b(entra)}</b><small>cobros programados</small></div>
        <div class="kpi"><span>Sale · 60 días</span><b>${$b(sale)}</b><small>gastos, nómina${admin ? ' y metas' : ''}</small></div>
        <div class="kpi"><span>Punto más bajo</span><b class="${fl.minimo.saldo < 0 ? 'rojo' : ''}">${signo(fl.minimo.saldo)}</b><small>${fechaBonita(fl.minimo.fecha)}</small></div>
      </div>
      ${fl.minimo.saldo < 0 ? `<div class="tarjeta semaforo rojo"><span class="luz"></span><div><b>Ojo: el ${fechaBonita(fl.minimo.fecha)} te quedarías en ${signo(fl.minimo.saldo)}.</b><small>Cobra antes, mueve un gasto o aparta menos esa quincena.</small></div></div>` : ''}
      <div class="tarjeta"><h3>Día por día <small>saldo que va quedando</small></h3>${fl.mov.length ? `<div class="tabla-scroll"><table class="tabla tabla-asis">${filas}</table></div>` : '<p class="vacio">No hay nada programado en los próximos 60 días.</p>'}</div>`
  }

  // ------------------------------------------------- Ahorro para metas (solo admin)
  function vistaMetas() {
    const ms = M.metasDinero()
    const sinPrecio = metas.filter((m) => !(Number(m.monto_objetivo) > 0) && m.estado !== 'lograda')
    const totalAhorrado = ms.reduce((s, x) => s + M.conv(x.ahorrado, x.mt.moneda), 0)
    const planMes = ms.reduce((s, x) => s + M.conv(x.planMes, x.mt.moneda), 0)
    const tarjeta = (x) => `<div class="tarjeta meta-dinero">
        <div class="fila"><div><b>${h(x.mt.titulo)}</b>${x.mt.porque ? `<small>${h(x.mt.porque)}</small>` : ''}</div><span class="pct">${x.pct > 0 && x.pct < 1 ? '<1' : Math.floor(x.pct)}%</span></div>
        <div class="barra grande"><i style="width:${x.pct}%"></i></div>
        <div class="desglose"><span>Apartado <b>${dinero(x.ahorrado, x.mt.moneda)}</b></span><span>Meta <b>${dinero(x.objetivo, x.mt.moneda)}</b></span><span>Falta <b>${dinero(x.falta, x.mt.moneda)}</b></span></div>
        <p class="nota">${x.planMes ? `Apartas ${dinero(x.mt.aporte_monto, x.mt.moneda)} ${FREC_AHORRO[x.mt.aporte_frecuencia].toLowerCase()} (≈ ${dinero(x.planMes, x.mt.moneda)} al mes)${x.llega ? ` → llegas en <b>${x.meses >= 24 ? `${Math.round(x.meses / 12)} años` : `${x.meses} meses`}</b> (${nombreMes(deIso(x.llega).getFullYear(), deIso(x.llega).getMonth()).toLowerCase()})` : ''}.` : 'Sin plan fijo: pon cuánto y cada cuándo vas a apartar para saber cuándo llegas.'}${x.necesita ? ` Para llegar el ${fechaBonita(x.mt.fecha_limite)} necesitas <b>${dinero(x.necesita, x.mt.moneda)} al mes</b>.` : ''}</p>
        <div class="acciones"><button class="btn chico primario" data-aportar="${x.mt.id}">+ Aparté dinero</button><button class="btn chico" data-sacar="${x.mt.id}">Saqué</button><button class="btn chico" data-plan-meta="${x.mt.id}">Precio y plan</button></div>
        ${x.aps.length ? `<details><summary>Historial (${x.aps.length})</summary><ul class="lista">${x.aps.map((a) => `<li><b class="${a.monto < 0 ? 'rojo' : ''}">${a.monto < 0 ? '−' : '+'}${dinero(Math.abs(a.monto), a.moneda)}</b><small>${fechaBonita(a.fecha)}${a.nota ? ` · ${h(a.nota)}` : ''}</small> <button class="enlace" data-borrar-aporte="${a.id}">quitar</button></li>`).join('')}</ul></details>` : ''}
      </div>`
    return `
      <div class="kpis">
        <div class="kpi"><span>Apartado para tus metas</span><b>${$b(totalAhorrado)}</b><small>${ms.length} meta${ms.length === 1 ? '' : 's'} con precio</small></div>
        <div class="kpi"><span>Tu plan</span><b>${$b(planMes)}</b><small>al mes</small></div>
      </div>
      <div class="acciones"><button class="btn primario" id="fin-meta-nueva">+ Meta con precio</button></div>
      <div class="rejilla-metas">${ms.map(tarjeta).join('') || '<div class="tarjeta"><p class="vacio">Ponle precio a una meta (ej. "Casa multifamiliar para rentar · $800,000") y registra lo que vas apartando. Aquí ves cuánto llevas, cuánto falta y cuándo llegas.</p></div>'}</div>
      ${sinPrecio.length ? `<div class="tarjeta"><h3>Metas sin precio</h3><ul class="lista">${sinPrecio.map((m) => `<li><b>${h(m.titulo)}</b> <button class="btn chico" data-plan-meta="${m.id}">Ponerle precio</button></li>`).join('')}</ul></div>` : ''}
      <p class="nota">El dinero lo apartas tú (en otra cuenta o donde lo guardes); aquí llevas la cuenta. Lo apartado se resta de lo que te queda libre cada mes.</p>`
  }

  // ------------------------------------------------- acciones
  const conectar = {
    resumen() {
      $$('[data-mes]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-fin-mes', b.dataset.mes === '0' ? '0' : String(salto + Number(b.dataset.mes))), mostrar())))
      $$('[data-ir-tab]', v).forEach((a) => (a.onclick = (e) => (e.preventDefault(), sessionStorage.setItem('hq-fin', a.dataset.irTab), mostrar())))
      const caja = $('.grafica-fin', v)
      const tip = $('.tip-fin', v)
      $$('.mes-g', v).forEach((g) => {
        const ver = () => {
          tip.innerHTML = g.dataset.tip.split('\n').map((l, i) => (i ? `<span>${h(l)}</span>` : `<b>${h(l)}</b>`)).join('')
          tip.hidden = false
          const r = g.getBoundingClientRect()
          const c = caja.getBoundingClientRect()
          tip.style.left = `${Math.min(c.width - 170, Math.max(0, r.left - c.left + r.width / 2 - 85))}px`
          g.classList.add('foco')
        }
        const ocultar = () => ((tip.hidden = true), g.classList.remove('foco'))
        g.addEventListener('mouseenter', ver)
        g.addEventListener('focus', ver)
        g.addEventListener('mouseleave', ocultar)
        g.addEventListener('blur', ocultar)
      })
    },
    ingresos() {
      $$('[data-cobrado]', v).forEach(
        (b) =>
          (b.onclick = () => {
            const [cid, f] = b.dataset.cobrado.split('|')
            const p = M.planes.find((x) => x.c.id === cid)
            registrarCobro(ctx, { clientes, cliente_id: cid, para_fecha: f, monto: p?.monto, moneda: p?.moneda })
          }),
      )
      $$('[data-omitir]', v).forEach(
        (b) =>
          (b.onclick = async () => {
            const [cid, f] = b.dataset.omitir.split('|')
            const motivo = prompt('¿Qué pasó? (ej. se recorrió al siguiente viernes, no pagó, pausó el servicio)') ?? null
            if (motivo === null) return
            if (await intenta(() => D.omitirCobro({ cliente_id: cid, fecha: f, motivo: motivo.slice(0, 200) }), 'Anotado')) mostrar()
          }),
      )
      $$('[data-plan]', v).forEach((b) => (b.onclick = () => editarPlanCliente(ctx, clientes.find((c) => c.id === b.dataset.plan), din.find((x) => x.cliente_id === b.dataset.plan))))
      $('#fin-cobro', v)?.addEventListener('click', () => registrarCobro(ctx, { clientes }))
      $$('[data-borrar-cobro]', v).forEach((b) => (b.onclick = async () => confirm('¿Quitar este cobro?') && (await intenta(() => D.borrarCobro(b.dataset.borrarCobro), 'Quitado')) && mostrar()))
    },
    gastos() {
      $$('[data-gf]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-fin-g', b.dataset.gf), mostrar())))
      $('#fin-gasto', v)?.addEventListener('click', () => editarGasto(ctx, null))
      $$('[data-gasto]', v).forEach((b) => (b.onclick = () => editarGasto(ctx, gastos.find((g) => g.id === b.dataset.gasto))))
    },
    metas() {
      $('#fin-meta-nueva', v)?.addEventListener('click', () => planMeta(ctx, null))
      $$('[data-plan-meta]', v).forEach((b) => (b.onclick = () => planMeta(ctx, metas.find((m) => m.id === b.dataset.planMeta))))
      $$('[data-aportar]', v).forEach((b) => (b.onclick = () => aportar(ctx, metas.find((m) => m.id === b.dataset.aportar), 1)))
      $$('[data-sacar]', v).forEach((b) => (b.onclick = () => aportar(ctx, metas.find((m) => m.id === b.dataset.sacar), -1)))
      $$('[data-borrar-aporte]', v).forEach((b) => (b.onclick = async () => confirm('¿Quitar este movimiento?') && (await intenta(() => D.borrarAporte(b.dataset.borrarAporte), 'Quitado')) && mostrar()))
    },
  }

  const cuerpo = { resumen, ingresos, gastos: vistaGastos, flujo: vistaFlujo, metas: vistaMetas }[tab]
  v.innerHTML = pestanas + cuerpo() + pie
  $$('[data-ft]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-fin', b.dataset.ft), mostrar())))
  $('#fin-ajustes', v)?.addEventListener('click', () => ajustesFinanzas(ctx, config))
  conectar[tab]?.()
}

// ----------------------------------------------------------- formularios
const MONEDAS = { USD: 'Dólares (USD)', MXN: 'Pesos (MXN)' }

/** Cómo paga un cliente: frecuencia, monto de cada cobro y los días. También lo usa la ficha del cliente. */
export function editarPlanCliente({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, opciones }, c, d = {}) {
  const p = planCliente(d)
  abrirModal(
    `<form id="f-plan"><h2>Cómo te paga ${h(c.nombre)}</h2>
      <div class="campos">
        <label class="ancho">Cada cuándo<select name="frecuencia">${opciones(FRECUENCIAS, p.frecuencia)}</select></label>
        <label>Monto de cada cobro<input name="monto" type="number" min="0" step="0.01" value="${h(p.monto || '')}" required></label>
        <label>Moneda<select name="moneda">${opciones(MONEDAS, p.moneda)}</select></label>
        <label class="ancho" data-si="mensual quincenal">Días del mes <small>separados por coma: "15, 30" · 31 = el último día</small><input name="dias" value="${h((p.dias ?? []).join(', '))}" placeholder="${p.frecuencia === 'quincenal' ? '15, 31' : '5'}"></label>
        <label class="ancho" data-si="catorcenal semanal bimestral trimestral semestral anual unico">Fecha de referencia <small data-ayuda></small><input name="ancla" type="date" value="${h(p.ancla || '')}"></label>
        <label>Pago único al empezar<input name="pago_unico" type="number" min="0" step="0.01" value="${h(d.pago_unico ?? 0)}"></label>
        <label class="ancho">Notas<textarea name="notas" rows="2">${h(d.notas || '')}</textarea></label>
      </div>
      <p class="nota" data-vista></p>
      <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      const f = $('#f-plan', caja)
      const leer = () => {
        const x = Object.fromEntries(new FormData(f))
        const dias = String(x.dias || '').split(/[,\sy]+/).map(Number).filter((n) => n >= 1 && n <= 31)
        return { frecuencia: x.frecuencia, monto: Number(x.monto) || 0, moneda: x.moneda, dias, ancla: x.ancla || null, x }
      }
      const pintar = () => {
        const q = leer()
        caja.querySelectorAll('[data-si]').forEach((el) => (el.hidden = !el.dataset.si.split(' ').includes(q.frecuencia)))
        const ayuda = { catorcenal: 'un día en que SÍ te pagó (o te va a pagar)', semanal: 'un día en que te paga', unico: 'cuándo te paga', bimestral: 'el primer cobro', trimestral: 'el primer cobro', semestral: 'el primer cobro', anual: 'el primer cobro' }[q.frecuencia]
        const el = caja.querySelector('[data-ayuda]')
        if (el) el.textContent = ayuda || ''
        const hoy = hoyIso()
        const prox = q.monto ? fechas(q, hoy, sumarDias(hoy, 120)).slice(0, 4) : []
        caja.querySelector('[data-vista]').innerHTML = q.frecuencia === 'irregular' ? 'Sin fecha fija: registra cada cobro cuando llegue (Finanzas → Ingresos).' : prox.length ? `Próximos cobros: <b>${prox.map(fechaBonita).join(' · ')}</b> · ≈ ${q.monto ? Math.round(alMes(q.monto, q.frecuencia, q.dias)).toLocaleString('es-MX') : 0} ${q.moneda} al mes` : 'Pon el monto y la fecha para ver los próximos cobros.'
      }
      f.addEventListener('input', pintar)
      pintar()
      f.onsubmit = async (e) => {
        e.preventDefault()
        const q = leer()
        if (['catorcenal', 'semanal', 'unico', 'bimestral', 'trimestral', 'semestral', 'anual'].includes(q.frecuencia) && !q.ancla) return ctxAviso(caja, 'Pon la fecha de referencia')
        const fila = {
          cliente_id: c.id,
          frecuencia: q.frecuencia,
          monto_cobro: q.monto,
          moneda: q.moneda,
          cobro_dias: ['mensual', 'quincenal'].includes(q.frecuencia) ? q.dias : [],
          cobro_ancla: q.ancla,
          dia_cobro: q.frecuencia === 'mensual' && q.dias.length ? q.dias[0] : null,
          mensualidad: Math.round(alMes(q.monto, q.frecuencia, q.dias) * 100) / 100,
          pago_unico: Number(q.x.pago_unico) || 0,
          notas: String(q.x.notas || '').trim(),
        }
        if (await intenta(() => D.guardarDinero(fila), 'Guardado')) (cerrarModal(), mostrar())
      }
    },
  )
}
const ctxAviso = (caja, t) => {
  let p = caja.querySelector('.error-form')
  if (!p) caja.querySelector('.acciones').before((p = Object.assign(document.createElement('p'), { className: 'error-form rojo' })))
  p.textContent = t
}

function registrarCobro({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, opciones }, { clientes, cliente_id = '', para_fecha = '', monto = '', moneda = 'USD' }) {
  abrirModal(
    `<form id="f-cobro"><h2>${para_fecha ? 'Ya pagó' : 'Registrar un cobro'}</h2>
      <div class="campos">
        <label class="ancho">De<select name="cliente_id"><option value="">Otro ingreso (no es de un cliente)</option>${clientes.map((c) => `<option value="${c.id}" ${c.id === cliente_id ? 'selected' : ''}>${h(c.nombre)}</option>`).join('')}</select></label>
        <label class="ancho" data-otro>Concepto<input name="concepto" maxlength="200" placeholder="Ej. Venta de equipo, reembolso…"></label>
        <label>Monto<input name="monto" type="number" min="0.01" step="0.01" required value="${h(monto)}"></label>
        <label>Moneda<select name="moneda">${opciones(MONEDAS, moneda)}</select></label>
        <label>Fecha en que llegó<input name="fecha" type="date" required value="${hoyIso()}" max="${hoyIso()}"></label>
        <label>Método<input name="metodo" maxlength="60" placeholder="Zelle, transferencia, efectivo…"></label>
        <label class="ancho">Nota<input name="nota" maxlength="500"></label>
      </div>
      ${para_fecha ? `<p class="nota">Cubre el cobro del ${fechaBonita(para_fecha)}.</p>` : ''}
      <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      const f = $('#f-cobro', caja)
      const otro = () => (caja.querySelector('[data-otro]').hidden = !!f.cliente_id.value)
      f.cliente_id.onchange = otro
      otro()
      f.onsubmit = async (e) => {
        e.preventDefault()
        const x = Object.fromEntries(new FormData(f))
        const fila = { cliente_id: x.cliente_id || null, concepto: x.cliente_id ? '' : String(x.concepto || 'Otro ingreso').trim(), monto: Number(x.monto), moneda: x.moneda, fecha: x.fecha, para_fecha: x.cliente_id && para_fecha ? para_fecha : null, metodo: x.metodo.trim(), nota: x.nota.trim() }
        if (await intenta(() => D.guardarCobro(fila), 'Cobro registrado')) (cerrarModal(), mostrar())
      }
    },
  )
}

function editarGasto({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, opciones, esAdmin }, g) {
  const n = g ?? { tipo: 'negocio', frecuencia: 'mensual', moneda: 'USD', categoria: 'otros', empresa: 'NXUS AI', dias: [], activo: true }
  const admin = esAdmin()
  abrirModal(
    `<form id="f-gasto"><h2>${g ? h(g.concepto) : 'Nuevo gasto'}</h2>
      <div class="campos">
        <label class="ancho">Qué es<input name="concepto" required maxlength="200" value="${h(n.concepto || '')}" placeholder="Renta de la oficina, Adobe, tarjeta Amex…"></label>
        ${admin ? `<label>Es<select name="tipo">${opciones({ negocio: 'Del negocio', personal: 'Personal (solo tú lo ves)' }, n.tipo)}</select></label>` : ''}
        <label>Categoría<select name="categoria">${opciones(CATEGORIAS, n.categoria)}</select></label>
        <label data-neg>Empresa<input name="empresa" maxlength="60" value="${h(n.empresa || 'NXUS AI')}" list="empresas-l"><datalist id="empresas-l"><option>NXUS AI</option><option>Mi Semago</option><option>Abuelito</option><option>Aurelius</option><option>VAYRO</option></datalist></label>
        <label>Monto<input name="monto" type="number" min="0" step="0.01" required value="${h(n.monto ?? '')}"></label>
        <label>Moneda<select name="moneda">${opciones(MONEDAS, n.moneda)}</select></label>
        <label class="ancho">Cada cuándo<select name="frecuencia">${opciones(FREC_GASTO, n.frecuencia)}</select></label>
        <label class="ancho" data-si="mensual quincenal">Días en que se paga <small>"1" · "15, 30" · 31 = el último</small><input name="dias" value="${h((n.dias ?? []).join(', '))}" placeholder="1"></label>
        <label data-si="catorcenal semanal bimestral trimestral semestral anual unico">Fecha <small>la del pago (o la primera)</small><input name="ancla" type="date" value="${h(n.ancla || '')}"></label>
        <label data-si="mensual quincenal catorcenal semanal bimestral trimestral semestral anual">Se termina <small>opcional (ej. un préstamo)</small><input name="hasta" type="date" value="${h(n.hasta || '')}"></label>
        <label class="ancho">Notas<input name="notas" maxlength="1000" value="${h(n.notas || '')}"></label>
        ${g ? `<label class="check ancho"><input type="checkbox" name="activo" ${n.activo !== false ? 'checked' : ''}> Sigue activo</label>` : ''}
      </div>
      <p class="nota" data-vista></p>
      <div class="acciones"><button class="btn primario">Guardar</button>${g ? '<button type="button" class="btn peligro" id="g-borrar">Borrar</button>' : ''}<button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      const f = $('#f-gasto', caja)
      const leer = () => {
        const x = Object.fromEntries(new FormData(f))
        return { x, frecuencia: x.frecuencia, dias: String(x.dias || '').split(/[,\sy]+/).map(Number).filter((k) => k >= 1 && k <= 31), ancla: x.ancla || null, fin: x.hasta || null }
      }
      const pintar = () => {
        const q = leer()
        caja.querySelectorAll('[data-si]').forEach((el) => (el.hidden = !el.dataset.si.split(' ').includes(q.frecuencia)))
        const neg = caja.querySelector('[data-neg]')
        if (neg) neg.hidden = (q.x.tipo || 'negocio') !== 'negocio'
        const prox = fechas(q, hoyIso(), sumarDias(hoyIso(), 120)).slice(0, 4)
        caja.querySelector('[data-vista]').innerHTML = prox.length ? `Próximos pagos: <b>${prox.map(fechaBonita).join(' · ')}</b>` : ''
      }
      f.addEventListener('input', pintar)
      pintar()
      f.onsubmit = async (e) => {
        e.preventDefault()
        const q = leer()
        if (['catorcenal', 'semanal', 'unico', 'bimestral', 'trimestral', 'semestral', 'anual'].includes(q.frecuencia) && !q.ancla) return ctxAviso(caja, 'Pon la fecha')
        const fila = {
          ...(g ? { id: g.id } : {}),
          concepto: q.x.concepto.trim(),
          tipo: admin ? q.x.tipo : 'negocio',
          categoria: q.x.categoria,
          empresa: (q.x.tipo || 'negocio') === 'negocio' ? String(q.x.empresa || '').trim() : '',
          monto: Number(q.x.monto) || 0,
          moneda: q.x.moneda,
          frecuencia: q.frecuencia,
          dias: ['mensual', 'quincenal'].includes(q.frecuencia) ? q.dias : [],
          ancla: q.ancla,
          hasta: q.frecuencia === 'unico' ? null : q.fin,
          notas: q.x.notas.trim(),
          activo: g ? !!q.x.activo : true,
        }
        if (await intenta(() => D.guardarGasto(fila), 'Guardado')) (cerrarModal(), mostrar())
      }
      $('#g-borrar', caja)?.addEventListener('click', async () => {
        if (!confirm(`¿Borrar "${g.concepto}"? Si ya no lo pagas pero quieres guardar el historial, mejor quítale "Sigue activo".`)) return
        if (await intenta(() => D.borrarGasto(g.id), 'Borrado')) (cerrarModal(), mostrar())
      })
    },
  )
}

function planMeta({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, opciones }, m) {
  const n = m ?? { area: 'patrimonio', periodo: 'año', moneda: 'USD', aporte_frecuencia: 'quincenal' }
  abrirModal(
    `<form id="f-pmeta"><h2>${m ? h(m.titulo) : 'Meta con precio'}</h2>
      <div class="campos">
        ${m ? '' : '<label class="ancho">Qué quieres<input name="titulo" required maxlength="200" placeholder="Casa multifamiliar para rentar"></label><label class="ancho">Para qué <small>NEX te lo recuerda</small><input name="porque" maxlength="1000" placeholder="Que la renta pague la casa y me deje ingreso"></label>'}
        <label>Cuánto cuesta<input name="monto_objetivo" type="number" min="0" step="0.01" required value="${h(n.monto_objetivo || '')}" placeholder="800000"></label>
        <label>Moneda<select name="moneda">${opciones(MONEDAS, n.moneda || 'USD')}</select></label>
        <label>Para cuándo <small>opcional</small><input name="fecha_limite" type="date" value="${h(n.fecha_limite || '')}"></label>
        <label>Cuánto vas a apartar<input name="aporte_monto" type="number" min="0" step="0.01" value="${h(n.aporte_monto || '')}" placeholder="500"></label>
        <label>Cada cuándo<select name="aporte_frecuencia">${opciones(FREC_AHORRO, n.aporte_frecuencia || '')}</select></label>
      </div>
      <p class="nota" data-vista></p>
      <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      const f = $('#f-pmeta', caja)
      const pintar = () => {
        const x = Object.fromEntries(new FormData(f))
        const yaTiene = 0
        const mes = alMes(Number(x.aporte_monto) || 0, x.aporte_frecuencia || 'irregular')
        const falta = Math.max(0, (Number(x.monto_objetivo) || 0) - yaTiene)
        const meses = mes ? Math.ceil(falta / mes) : 0
        caja.querySelector('[data-vista]').innerHTML = mes && falta ? `≈ ${Math.round(mes).toLocaleString('es-MX')} ${x.moneda} al mes → la juntas en <b>${meses >= 24 ? `${(meses / 12).toFixed(1)} años` : `${meses} meses`}</b> (sin contar lo que ya llevas).` : ''
      }
      f.addEventListener('input', pintar)
      pintar()
      f.onsubmit = async (e) => {
        e.preventDefault()
        const x = Object.fromEntries(new FormData(f))
        const fila = {
          ...(m ? { id: m.id } : { titulo: x.titulo.trim(), porque: x.porque.trim(), area: 'patrimonio', periodo: 'año' }),
          monto_objetivo: Number(x.monto_objetivo) || 0,
          moneda: x.moneda,
          fecha_limite: x.fecha_limite || null,
          aporte_monto: Number(x.aporte_monto) || 0,
          aporte_frecuencia: x.aporte_frecuencia || '',
        }
        if (await intenta(() => D.guardarMeta(fila), 'Guardado')) (cerrarModal(), mostrar())
      }
    },
  )
}

function aportar({ D, h, $, abrirModal, cerrarModal, intenta, mostrar }, m, signo) {
  abrirModal(
    `<form id="f-aporte"><h2>${signo > 0 ? 'Aparté para' : 'Saqué de'}: ${h(m.titulo)}</h2>
      <div class="campos">
        <label>Cuánto<input name="monto" type="number" min="0.01" step="0.01" required value="${signo > 0 ? h(m.aporte_monto || '') : ''}"></label>
        <label>Fecha<input name="fecha" type="date" required value="${hoyIso()}" max="${hoyIso()}"></label>
        <label class="ancho">Nota <small>opcional</small><input name="nota" maxlength="300" placeholder="${signo > 0 ? 'Cuenta de ahorro, CETES…' : 'Para qué lo saqué'}"></label>
      </div>
      <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      $('#f-aporte', caja).onsubmit = async (e) => {
        e.preventDefault()
        const x = Object.fromEntries(new FormData(e.target))
        if (await intenta(() => D.guardarAporte({ meta_id: m.id, monto: signo * Math.abs(Number(x.monto)), moneda: m.moneda || 'USD', fecha: x.fecha, nota: x.nota.trim() }), signo > 0 ? 'Apartado ✓' : 'Anotado')) (cerrarModal(), mostrar())
      }
    },
  )
}

function ajustesFinanzas({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, opciones }, cfg = {}) {
  const c = cfg ?? {}
  abrirModal(
    `<form id="f-ajfin"><h2>Ajustes de finanzas</h2>
      <div class="campos">
        <label>Hoy tengo en el banco<input name="saldo" type="number" step="0.01" value="${h(c.saldo ?? 0)}"></label>
        <label>Moneda del saldo<select name="saldo_moneda">${opciones(MONEDAS, c.saldo_moneda || 'USD')}</select></label>
        <label>Tipo de cambio <small>pesos por dólar</small><input name="tipo_cambio" type="number" min="1" step="0.0001" value="${h(c.tipo_cambio ?? 18.5)}"></label>
        <label>Ver todo en<select name="moneda_base">${opciones(MONEDAS, c.moneda_base || 'USD')}</select></label>
        <label>Llevo las cuentas desde <small>lo de antes no cuenta</small><input name="desde" type="date" value="${h(String(c.desde || '').slice(0, 10))}" max="${hoyIso()}"></label>
        <label class="ancho">Quiero que me queden libres al mes <small>en la moneda de arriba</small><input name="meta_libre" type="number" min="0" step="1" value="${h(c.meta_libre ?? 10000)}"></label>
      </div>
      <p class="nota">El saldo es para ver el flujo día por día (cuándo podrías quedar en rojo). Actualízalo cuando quieras.</p>
      <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      $('#f-ajfin', caja).onsubmit = async (e) => {
        e.preventDefault()
        const x = Object.fromEntries(new FormData(e.target))
        const fila = { id: 1, saldo: Number(x.saldo) || 0, saldo_moneda: x.saldo_moneda, tipo_cambio: Number(x.tipo_cambio) || 18.5, moneda_base: x.moneda_base, meta_libre: Number(x.meta_libre) || 0, ...(x.desde ? { desde: x.desde } : {}), ...(Number(x.saldo) !== Number(c.saldo) || x.saldo_moneda !== c.saldo_moneda || !c.saldo_fecha ? { saldo_fecha: new Date().toISOString() } : {}) }
        if (await intenta(() => D.guardarFinanzasConfig(fila), 'Guardado')) (cerrarModal(), mostrar())
      }
    },
  )
}
