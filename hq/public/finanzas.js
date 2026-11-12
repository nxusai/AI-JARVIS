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
const fechaBonita = (s) => {
  const t = deIso(s).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
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

// ----------------------------------------------------------- dos monedas
export const MONEDAS = { USD: 'Dólares (USD)', MXN: 'Pesos (MXN)' }
const suma = () => ({ USD: 0, MXN: 0 })

/** La quincena de una fecha (o saltando n quincenas): 1–15 se paga el 15; 16–fin se paga el último día. */
export function quincenaDe(ref = new Date(), salto = 0) {
  let y = ref.getFullYear()
  let m = ref.getMonth()
  let q = ref.getDate() <= 15 ? 0 : 1
  let k = q + salto
  m += Math.floor(k / 2)
  q = ((k % 2) + 2) % 2
  const d = new Date(y, m, 1)
  y = d.getFullYear()
  m = d.getMonth()
  const ult = ultimoDia(y, m)
  const desde = iso(new Date(y, m, q ? 16 : 1))
  const hasta = q ? iso(new Date(y, m + 1, 1)) : iso(new Date(y, m, 16))
  const mes = new Date(y, m, 1).toLocaleDateString('es-MX', { month: 'long' })
  return { y, m, q, desde, hasta, paga: iso(new Date(y, m, q ? ult : 15)), nombre: `${q ? `16–${ult}` : '1–15'} de ${mes} ${y}`, corto: `${q ? '16' : '1'}–${q ? ult : 15} ${mes.slice(0, 3)}` }
}

/** Tipo de cambio del día (Banco Central Europeo, sin llave; si falla, otro servicio; si falla, el guardado). */
let cambioCache = null
export async function cambioDelDia() {
  if (cambioCache && Date.now() - cambioCache.t < 3 * 3600e3) return cambioCache
  try {
    const guardado = JSON.parse(localStorage.getItem('hq-cambio') || 'null')
    if (guardado && Date.now() - guardado.t < 3 * 3600e3) return (cambioCache = guardado)
  } catch {}
  const intentos = [
    async () => {
      const r = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=MXN')
      const j = await r.json()
      return { tc: Number(j.rates.MXN), fecha: j.date, fuente: 'Banco Central Europeo' }
    },
    async () => {
      const r = await fetch('https://open.er-api.com/v6/latest/USD')
      const j = await r.json()
      return { tc: Number(j.rates.MXN), fecha: new Date(j.time_last_update_utc).toLocaleDateString('en-CA'), fuente: 'ExchangeRate-API' }
    },
  ]
  for (const f of intentos) {
    try {
      const x = await Promise.race([f(), new Promise((_, no) => setTimeout(() => no(new Error('lento')), 4000))])
      if (x.tc > 5 && x.tc < 60) {
        cambioCache = { ...x, t: Date.now() }
        try {
          localStorage.setItem('hq-cambio', JSON.stringify(cambioCache))
        } catch {}
        return cambioCache
      }
    } catch {}
  }
  return null
}

// ----------------------------------------------------------- el motor
/**
 * Todo lo que HQ sabe de dinero, en dólares (USA) y en pesos (México), y todo junto.
 */
export function motor(datos, { calcularPago }, cambio = null) {
  const cfg = datos.config ?? { tipo_cambio: 18.5, moneda_base: 'USD', meta_libre: 0, cambio_auto: true }
  // El tipo de cambio: el de Félix (lo pone Eduardo o sale del último envío); si no hay, el del mercado; si no, el guardado.
  const mercado = cambio?.tc || null
  const felix = Number(cfg.tc_felix) || null
  const tc = felix || (cfg.cambio_auto !== false && mercado) || Number(cfg.tipo_cambio) || 18.5
  const fuenteTc = felix ? 'felix' : cfg.cambio_auto !== false && mercado ? 'mercado' : 'manual'
  const base = cfg.moneda_base || 'USD'
  const conv = (monto, moneda = 'USD', a = base) => {
    const n = Number(monto || 0)
    if (moneda === a) return n
    return a === 'USD' ? n / tc : n * tc
  }
  const enBase = (o) => conv(o.USD, 'USD') + conv(o.MXN, 'MXN')
  const en = (o, a) => conv(o.USD, 'USD', a) + conv(o.MXN, 'MXN', a)
  const hoy = hoyIso()
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
        out.push({ cliente: p.c, fecha: f, monto: p.monto, moneda: p.moneda, base: conv(p.monto, p.moneda), estado: cobro ? 'cobrado' : omit ? 'omitido' : f < hoy ? 'vencido' : 'pendiente', cobro, omit })
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

  /** Lo que se paga de nómina en una quincena, por moneda (se paga el 15 y el último día). */
  function nominaQuincena(q) {
    const r = suma()
    if (q.paga < inicio) return r
    for (const n of datos.nomina) r[n.moneda] += calcularPago(n, { jornadas: datos.jornadas, ajustes: datos.ajustes, comisiones: datos.comisiones, desde: deIso(q.desde), hasta: deIso(q.hasta) }).total
    return r
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
            ? { frecuencia: 'mensual', dias: [15] }
            : { frecuencia: mt.aporte_frecuencia, ancla: String(mt.creado || hoy).slice(0, 10) }
      for (const f of fechas(plan, desdeInicio(desde), hasta)) {
        const hecho = datos.aportes.some((a) => a.meta_id === mt.id && Math.abs(entreDias(a.fecha, f)) <= TOL)
        out.push({ meta: mt, fecha: f, monto: Number(mt.aporte_monto), moneda: mt.moneda, base: conv(mt.aporte_monto, mt.moneda), hecho })
      }
    }
    return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
  }

  /** Una quincena (o cualquier periodo): lo que entra y sale por moneda, y el total. */
  function periodo(desde, hasta) {
    const pasado = hasta <= hoy
    const enRango = (f) => f >= desde && f < hasta && f >= inicio
    const real = suma()
    for (const x of datos.cobros) if (enRango(x.fecha)) real[x.moneda] += Number(x.monto)
    for (const g of datos.pagosPros) if (enRango(iso(new Date(g.fecha)))) real[g.moneda] += Number(g.monto)
    const prog = cobrosProgramados(desde, hasta)
    const porCobrar = suma()
    const vencido = suma()
    for (const x of prog) if (x.estado === 'pendiente') porCobrar[x.moneda] += x.monto
    for (const x of prog) if (x.estado === 'vencido') vencido[x.moneda] += x.monto
    const entra = { USD: real.USD + porCobrar.USD, MXN: real.MXN + porCobrar.MXN }
    const gs = gastosEn(desde, hasta)
    const negocio = suma()
    const personal = suma()
    for (const x of gs) (x.tipo === 'personal' ? personal : negocio)[x.moneda] += x.monto
    const nomina = nominaQuincena({ desde, hasta, paga: sumarDias(hasta, -1) })
    const metas = suma()
    for (const a of datos.aportes) if (enRango(a.fecha)) metas[a.moneda] += Number(a.monto)
    if (!pasado) for (const a of aportesPlaneados(hoy > desde ? hoy : desde, hasta)) if (!a.hecho) metas[a.moneda] += a.monto
    const neto = (m, todo) => entra[m] - negocio[m] - nomina[m] - (todo ? personal[m] + metas[m] : 0)
    const netoNegocio = { USD: neto('USD', false), MXN: neto('MXN', false) }
    const netoTodo = { USD: neto('USD', true), MXN: neto('MXN', true) }
    const ganancia = enBase(netoNegocio)
    return {
      desde, hasta, pasado, antes: hasta <= inicio,
      real, porCobrar, vencido, entra, negocio, personal, nomina, metas, netoNegocio, netoTodo,
      ingresos: enBase(entra), ganancia, libre: enBase(netoTodo), margen: enBase(entra) ? ganancia / enBase(entra) : 0,
      prog, gastos: gs,
    }
  }

  /**
   * Cómo va a ir tu dinero: el saldo de hoy en dólares y en pesos, y quincena por quincena lo que entra,
   * lo que sale y con cuánto cierras. personal = incluir gastos personales y ahorro (solo el admin).
   */
  function flujo(quincenas = 4, { personal = true } = {}) {
    const saldoDia = cfg.saldo_fecha ? iso(new Date(cfg.saldo_fecha)) : hoy
    const inicial = { USD: Number(cfg.saldo_usd || 0), MXN: Number(cfg.saldo_mxn || 0) }
    const manana = sumarDias(hoy, 1)
    // Lo que de verdad pasó (cobros, envíos, apartados) cuenta si es posterior al saldo que pusiste.
    const realOk = (x) => !cfg.saldo_fecha || x.fecha > saldoDia || (x.creado && x.creado > cfg.saldo_fecha)
    const nombreCobro = (x) => (x.cliente_id ? datos.clientes.find((c) => c.id === x.cliente_id)?.nombre || 'Cobro' : x.concepto || 'Otro ingreso')
    function reales(hasta) {
      const xs = []
      for (const x of datos.cobros) if (x.fecha < hasta && realOk(x)) xs.push({ fecha: x.fecha, tipo: 'entra', que: nombreCobro(x), monto: Number(x.monto), moneda: x.moneda })
      for (const e of datos.envios ?? []) if (e.fecha < hasta && realOk(e)) xs.push({ fecha: e.fecha, tipo: 'envio', que: 'Envío con Félix', monto: -Number(e.dolares), moneda: 'USD' }, { fecha: e.fecha, tipo: 'envio', que: 'Envío con Félix', monto: Number(e.pesos), moneda: 'MXN' })
      if (personal) for (const a of datos.aportes) if (a.fecha < hasta && realOk(a)) xs.push({ fecha: a.fecha, tipo: 'meta', que: `Apartado: ${datos.metas.find((m) => m.id === a.meta_id)?.titulo ?? 'meta'}`, monto: -Number(a.monto), moneda: a.moneda })
      return xs
    }
    // Lo programado (gastos y nómina se dan por pagados en su día).
    function programados(desde, hasta) {
      const xs = []
      if (desde >= hasta) return xs
      for (const x of gastosEn(desde, hasta)) if (personal || x.tipo === 'negocio') xs.push({ fecha: x.fecha, tipo: 'sale', que: x.g.concepto, monto: -x.monto, moneda: x.moneda, personal: x.tipo === 'personal' })
      for (let k = -3; k < 30; k++) {
        const q = quincenaDe(new Date(), k)
        if (q.paga >= desde && q.paga < hasta) {
          const n = nominaQuincena(q)
          for (const m of ['MXN', 'USD']) if (n[m]) xs.push({ fecha: q.paga, tipo: 'sale', que: 'Nómina', monto: -n[m], moneda: m })
        }
      }
      return xs
    }
    function esperados(desde, hasta) {
      const xs = []
      for (const x of cobrosProgramados(desde, hasta)) if (x.estado === 'pendiente') xs.push({ fecha: x.fecha, tipo: 'entra', que: x.cliente.nombre, monto: x.monto, moneda: x.moneda })
      if (personal) for (const a of aportesPlaneados(desde, hasta)) if (!a.hecho) xs.push({ fecha: a.fecha, tipo: 'meta', que: `Apartar: ${a.meta.titulo}`, monto: -a.monto, moneda: a.moneda })
      return xs
    }
    // Hoy = el saldo que pusiste + lo que pasó desde entonces (incluido hoy).
    const hoyS = { ...inicial }
    for (const x of [...reales(manana), ...programados(sumarDias(saldoDia, 1), manana)]) hoyS[x.moneda] += x.monto
    const qs = []
    let corre = { ...hoyS }
    for (let k = 0; k < quincenas; k++) {
      const Q = quincenaDe(new Date(), k)
      const desdeP = k === 0 ? manana : Q.desde
      const desdeE = k === 0 ? hoy : Q.desde
      const xs = [...programados(desdeP, Q.hasta), ...esperados(desdeE, Q.hasta)].sort((a, b) => a.fecha.localeCompare(b.fecha) || b.monto - a.monto)
      const entra = suma()
      const sale = suma()
      const empieza = { ...corre }
      const bajo = { ...corre }
      let rojo = null
      for (const x of xs) {
        ;(x.monto > 0 ? entra : sale)[x.moneda] += Math.abs(x.monto)
        corre[x.moneda] += x.monto
        if (corre[x.moneda] < bajo[x.moneda]) bajo[x.moneda] = corre[x.moneda]
        if (corre.MXN < 0 && !rojo) rojo = { moneda: 'MXN', fecha: x.fecha, falta: -corre.MXN }
        if (corre.USD < 0 && !rojo) rojo = { moneda: 'USD', fecha: x.fecha, falta: -corre.USD }
      }
      corre = { ...corre }
      qs.push({ Q, xs, entra, sale, empieza, termina: { ...corre }, bajo, rojo })
    }
    return { hoy: hoyS, saldoDia, inicial, qs }
  }

  /** Cuándo vas a necesitar mandar dólares a México (por Félix) para cubrir lo que se paga en pesos. */
  function sugerencias(fl) {
    // Quincena por quincena: cuántos pesos faltarían (contando lo que ya mandaste antes) y cuándo.
    const out = []
    let mandado = 0
    for (const q of fl.qs) {
      if (q.bajo.MXN + mandado >= 0) continue
      let s = q.empieza.MXN + mandado
      let primer = q.Q.desde
      for (const x of q.xs)
        if (x.moneda === 'MXN') {
          s += x.monto
          if (s < 0) {
            primer = x.fecha
            break
          }
        }
      const pesos = Math.ceil((-(q.bajo.MXN + mandado) * 1.03) / 100) * 100
      mandado += pesos
      out.push({ q: q.Q, pesos, dolares: Math.ceil(pesos / tc / 10) * 10, antes: sumarDias(primer, -1) < hoy ? hoy : sumarDias(primer, -1), alcanzaUSD: q.bajo.USD - mandado / tc >= 0 })
    }
    return out
  }

  /** Cada meta con dinero: lo apartado, lo que falta y cuándo llega a ese paso. */
  function metasDinero() {
    return datos.metas
      .filter((mt) => Number(mt.monto_objetivo) > 0)
      .map((mt) => {
        const aps = datos.aportes.filter((a) => a.meta_id === mt.id).sort((a, b) => b.fecha.localeCompare(a.fecha))
        const ahorrado = aps.reduce((s, a) => s + conv(a.monto, a.moneda, mt.moneda), 0)
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

  return { conv, enBase, en, base, tc, mercado, felix, fuenteTc, cfg, hoy, inicio, planes, cobrosProgramados, gastosEn, periodo, flujo, sugerencias, metasDinero, aportesPlaneados, nominaQuincena }
}

// ----------------------------------------------------------- la vista
export async function vistaFinanzas(v, ctx) {
  const { D, h, $, $$, titulo, dinero, intenta, mostrar, puede, esAdmin } = ctx
  titulo('Finanzas')
  const admin = esAdmin()
  const TABS = { resumen: 'Quincena', ingresos: 'Ingresos', gastos: 'Gastos', flujo: 'Flujo de dinero', ...(admin ? { metas: 'Ahorro para metas' } : {}) }
  let tab = sessionStorage.getItem('hq-fin')
  if (!TABS[tab]) tab = 'resumen'
  const salto = Number(sessionStorage.getItem('hq-fin-q') || 0)
  const ahora = new Date()
  const desdeDatos = new Date(ahora.getFullYear(), ahora.getMonth() - 4, 1)
  const hastaDatos = new Date(ahora.getFullYear(), ahora.getMonth() + 5, 1)
  const vacio = () => Promise.resolve([])
  const [clientes, din, cobros, omitidos, pagosPros, gastos, aportes, metas, nomina, jornadas, ajustes, comisiones, config, envios, cambio] = await Promise.all([
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
    D.envios ? D.envios().catch(() => []) : vacio(),
    cambioDelDia(),
  ])
  const datos = { clientes, dinero: din, cobros, omitidos, pagosPros, gastos, aportes, metas, nomina, jornadas, ajustes, comisiones, config, envios }
  const M = motor(datos, ctx, cambio)
  const $b = (n) => dinero(Math.round(n), M.base)
  const signo = (n, mon = M.base) => (n < 0 ? `−${dinero(Math.round(-n), mon)}` : dinero(Math.round(n), mon))
  const dos = (o, cls = '') => {
    const p = ['USD', 'MXN'].filter((m) => Math.round(o[m]))
    return p.length ? p.map((m) => `<span class="${cls} ${o[m] < 0 ? 'rojo' : ''}">${signo(o[m], m)}</span>`).join('<i class="mas">+</i>') : `<span>${dinero(0, M.base)}</span>`
  }
  /** Todo junto, en dólares y en pesos. */
  const junto = (o) => `<span class="${M.en(o, 'USD') < 0 ? 'rojo' : ''}">${signo(M.en(o, 'USD'), 'USD')}</span><i class="mas">=</i><span class="${M.en(o, 'MXN') < 0 ? 'rojo' : ''}">${signo(M.en(o, 'MXN'), 'MXN')}</span>`
  const editar = puede('finanzas_editar')
  const c2 = { ...ctx, M }

  const cambioTxt =
    M.fuenteTc === 'felix'
      ? `Félix: 1 USD = ${M.tc.toFixed(2)} MXN${M.cfg.tc_felix_fecha ? ` · ${fechaBonita(iso(new Date(M.cfg.tc_felix_fecha)))}` : ''}${M.mercado ? ` · mercado ${M.mercado.toFixed(2)}` : ''}`
      : `1 USD = ${M.tc.toFixed(2)} MXN · ${M.fuenteTc === 'mercado' ? 'mercado (pon el de Félix)' : 'a mano'}`
  const pestanas = `<div class="acciones fin-tabs"><div class="segmento">${Object.entries(TABS).map(([k, t]) => `<button data-ft="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div><button class="cambio-chip" id="fin-felix" title="El tipo de cambio que usa HQ (el de Félix)">💱 ${cambioTxt}</button>${admin ? '<button class="btn chico" id="fin-ajustes">⚙ Ajustes</button>' : ''}</div>`
  const pie = `<p class="nota">Lo de USA se lleva en dólares y lo de México en pesos. "Todo junto" convierte con el tipo de cambio de Félix. ${admin ? 'Solo tú ves los gastos personales y el ahorro para tus metas.' : 'Ves lo del negocio; lo personal no aparece aquí.'}</p>`

  // ------------------------------------------------- Quincena
  function resumen() {
    const Q = quincenaDe(new Date(), salto)
    const x = M.periodo(Q.desde, Q.hasta)
    const libre = admin ? x.libre : x.ganancia
    const fl = M.flujo(4, { personal: admin })
    const sug = salto >= 0 ? M.sugerencias(fl) : []
    const color = libre < 0 ? 'rojo' : x.margen < 0.2 || Math.round(M.enBase(x.vencido)) > 0 || sug.length ? 'amarillo' : 'verde'
    const frase = {
      verde: `Vas en verde: ${x.pasado ? 'te sobró' : 'te van a sobrar'} ${$b(libre)} esta quincena.`,
      amarillo: `En verde, pero con cuidado: ${sug.length ? 'te van a faltar pesos' : Math.round(M.enBase(x.vencido)) ? `hay ${$b(M.enBase(x.vencido))} de cobros atrasados` : `el margen es de ${Math.round(x.margen * 100)}%`}.`,
      rojo: `Vas en rojo: ${x.pasado ? 'faltaron' : 'van a faltar'} ${$b(-libre)} esta quincena.`,
    }[color]
    const metaQ = Number(M.cfg.meta_libre || 0)
    const avance = metaQ ? Math.max(0, Math.min(100, Math.round((libre / metaQ) * 100))) : 0
    const porPagar = x.gastos.filter((g) => admin || g.tipo === 'negocio')
    const nomQ = x.nomina
    const filaMon = (t, o, cls = '') => `<tr class="${cls}"><td>${t}</td><td class="num">${Math.round(o.USD) ? signo(o.USD, 'USD') : '—'}</td><td class="num">${Math.round(o.MXN) ? signo(o.MXN, 'MXN') : '—'}</td><td class="num junto">${signo(M.en(o, 'USD'), 'USD')}</td><td class="num junto">${signo(M.en(o, 'MXN'), 'MXN')}</td></tr>`
    const neg = (o) => ({ USD: -o.USD, MXN: -o.MXN })
    const alertas = []
    const s1 = sug[0]
    if (s1) alertas.push(`<li class="mal">💸 <b>Te van a faltar pesos</b>: manda <b>unos ${dinero(s1.dolares, 'USD')}</b> con Félix (≈ ${dinero(s1.pesos, 'MXN')}) <b>antes del ${fechaBonita(s1.antes)}</b>.${s1.alcanzaUSD ? '' : ' <span class="rojo">Ojo: tampoco alcanzan los dólares.</span>'}${sug.length > 1 ? ` <a href="#" data-ir-tab="flujo">Ver los siguientes envíos</a>` : ''} ${editar ? '<button class="btn chico" data-envio>Ya lo mandé</button>' : ''}</li>`)
    const venc = M.cobrosProgramados(sumarDias(M.hoy, -75), M.hoy).filter((c) => c.estado === 'vencido')
    if (venc.length) alertas.push(`<li class="mal">⏳ <b>${venc.length} cobro${venc.length > 1 ? 's' : ''} sin confirmar</b>: ${[...new Set(venc.map((c) => c.cliente.nombre))].slice(0, 4).map(h).join(', ')}. <a href="#" data-ir-tab="ingresos">Confirmar</a></li>`)
    if (!M.cfg.saldo_fecha && editar) alertas.push('<li>Pon cuánto tienes hoy en dólares y en pesos en <a href="#" data-ir-tab="flujo">Flujo de dinero</a> para saber si te alcanza.</li>')
    if (M.fuenteTc !== 'felix' && editar) alertas.push('<li>Toca 💱 arriba y pon el tipo de cambio que te da <b>Félix</b> hoy.</li>')
    if (!M.planes.length) alertas.push('<li>Pon cómo te paga cada cliente en <a href="#" data-ir-tab="ingresos">Ingresos</a>.</li>')
    if (!gastos.length) alertas.push('<li>Agrega tus gastos en <a href="#" data-ir-tab="gastos">Gastos</a>, con sus días.</li>')
    if (!puede('nomina_ver')) alertas.push('<li>No tienes permiso de ver la nómina: no se resta aquí.</li>')
    return `
      <div class="acciones mes-nav"><div class="segmento"><button data-q="-1" aria-label="Quincena anterior">←</button><button class="on">${h(Q.nombre)}</button><button data-q="1" aria-label="Quincena siguiente">→</button></div>${salto ? '<button class="btn chico" data-q="0">Esta quincena</button>' : ''}<span class="nota-corte">Corte el ${Q.q ? 'último día' : '15'} · se paga el ${fechaBonita(Q.paga)}</span></div>
      <div class="tarjeta semaforo ${color}"><span class="luz"></span><div><b>${frase}</b><small>${x.antes ? 'Antes de llevar las cuentas en HQ.' : x.pasado ? 'Quincena cerrada: con lo que de verdad se cobró.' : 'Lo ya cobrado más lo que falta cobrar y pagar en la quincena.'}</small></div></div>
      ${alertas.length ? `<div class="tarjeta"><h3>Para tu atención</h3><ul class="alertas-fin">${alertas.join('')}</ul></div>` : ''}
      <div class="kpis">
        <div class="kpi"><span>Entra</span><b>${$b(x.ingresos)}</b><small class="dos-mon">${dos(x.entra)}</small></div>
        <div class="kpi"><span>Sale (negocio)</span><b>${$b(M.enBase(x.negocio) + M.enBase(nomQ))}</b><small class="dos-mon">${dos({ USD: x.negocio.USD + nomQ.USD, MXN: x.negocio.MXN + nomQ.MXN })}</small></div>
        <div class="kpi"><span>Ganancia</span><b class="${x.ganancia < 0 ? 'rojo' : ''}">${signo(x.ganancia)}</b><small>margen ${Math.round(x.margen * 100)}%</small></div>
        ${admin ? `<div class="kpi"><span>Te queda libre</span><b class="${x.libre < 0 ? 'rojo' : ''}">${signo(x.libre)}</b><small>después de lo personal y tus metas</small></div>` : `<div class="kpi"><span>Por cobrar</span><b>${$b(M.enBase(x.porCobrar))}</b><small class="dos-mon">${dos(x.porCobrar)}</small></div>`}
      </div>
      ${admin && metaQ ? `<div class="tarjeta meta"><div class="fila"><b>Meta: ${$b(metaQ)} libres cada quincena</b><span>${avance}%</span></div><div class="barra"><i style="width:${avance}%"></i></div></div>` : ''}
      <div class="tarjeta"><h3>La quincena: dólares, pesos y todo junto</h3><div class="tabla-scroll"><table class="tabla cascada"><tr><th></th><th>Dólares (USA)</th><th>Pesos (México)</th><th>Todo junto en dólares</th><th>Todo junto en pesos</th></tr>
          ${filaMon('Entra', x.entra)}${filaMon('− Gastos del negocio', neg(x.negocio))}${filaMon('− Nómina', neg(nomQ))}${filaMon('= Ganancia', x.netoNegocio, 'total')}
          ${admin ? `${filaMon('− Gastos personales', neg(x.personal))}${filaMon('− Para tus metas', neg(x.metas))}${filaMon('= Te queda', x.netoTodo, 'total')}` : ''}
        </table></div><p class="nota">Si los pesos salen en rojo y los dólares en verde, no te faltó dinero: te toca mandar dólares a México con Félix.</p></div>
      <div class="dos">
        <div class="tarjeta"><h3>Por pagar esta quincena</h3>${listaPagos(porPagar, nomQ, Q)}</div>
        <div class="tarjeta"><h3>Por cobrar esta quincena</h3>${listaCobros(x.prog)}</div>
      </div>
      <div class="tarjeta"><h3>12 quincenas <small>pasado real · futuro proyectado · todo junto en ${M.base === 'USD' ? 'dólares' : 'pesos'}</small></h3>${grafica()}</div>`
  }

  function listaPagos(gs, nomQ, Q) {
    const items = [
      ...gs.map((g) => ({ fecha: g.fecha, que: g.g.concepto, monto: g.monto, moneda: g.moneda, personal: g.tipo === 'personal' })),
      ...['MXN', 'USD'].filter((m) => nomQ[m]).map((m) => ({ fecha: Q.paga, que: 'Nómina', monto: nomQ[m], moneda: m })),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha))
    if (!items.length) return '<p class="vacio">Nada por pagar en esta quincena.</p>'
    return ['USD', 'MXN']
      .map((m) => {
        const xs = items.filter((i) => i.moneda === m)
        if (!xs.length) return ''
        const tot = xs.reduce((s, i) => s + i.monto, 0)
        return `<div class="grupo-cuenta"><div class="fila"><b>${m === 'USD' ? 'En dólares (USA)' : 'En pesos (México)'}</b><span>${dinero(tot, m)}</span></div><ul class="lista">${xs.map((i) => `<li><span>${fechaBonita(i.fecha)} · ${h(i.que)}${i.personal ? ' <span class="chip personal">personal</span>' : ''}</span><b>${dinero(i.monto, i.moneda)}</b></li>`).join('')}</ul></div>`
      })
      .join('')
  }
  function listaCobros(prog) {
    const xs = prog.filter((p) => p.estado !== 'omitido')
    if (!xs.length) return '<p class="vacio">No hay cobros programados en esta quincena.</p>'
    return `<ul class="lista">${xs.map((p) => `<li><span>${fechaBonita(p.fecha)} · ${h(p.cliente.nombre)}</span><b class="${p.estado === 'cobrado' ? 'verde' : p.estado === 'vencido' ? 'rojo' : ''}">${dinero(p.monto, p.moneda)}${p.estado === 'cobrado' ? ' ✓' : p.estado === 'vencido' ? ' · sin confirmar' : ''}</b></li>`).join('')}</ul>`
  }

  function grafica() {
    const qs = []
    for (let k = -5; k <= 6; k++) {
      const Q = quincenaDe(new Date(), k)
      const x = M.periodo(Q.desde, Q.hasta)
      const sale = M.enBase(x.negocio) + M.enBase(x.nomina) + (admin ? M.enBase(x.personal) : 0)
      qs.push({ Q, x, entra: x.antes ? 0 : x.ingresos, sale: x.antes ? 0 : sale, futuro: k > 0, actual: k === 0 })
    }
    const max = Math.max(1, ...qs.flatMap((q) => [q.entra, q.sale]))
    const W = 560, H = 220, top = 14, abajo = 30, izq = 52
    const ancho = (W - izq) / qs.length
    const barra = Math.min(14, (ancho - 8) / 2)
    const y = (n) => top + (H - top - abajo) * (1 - n / max)
    const rect = (x0, n, cls, fut) => {
      const alto = Math.max(n > 0 ? 2 : 0, H - abajo - y(n))
      const yy = H - abajo - alto
      const r = Math.min(4, alto / 2)
      return alto ? `<path class="${cls}${fut ? ' futuro' : ''}" d="M${x0},${H - abajo} V${yy + r} Q${x0},${yy} ${x0 + r},${yy} H${x0 + barra - r} Q${x0 + barra},${yy} ${x0 + barra},${yy + r} V${H - abajo} Z"/>` : ''
    }
    const barras = qs
      .map((q, i) => {
        const cx = izq + i * ancho + ancho / 2
        const libre = admin ? q.x.libre : q.x.ganancia
        const tip = q.x.antes ? `${q.Q.nombre}&#10;Antes de llevar las cuentas en HQ` : `${q.Q.nombre}${q.futuro ? ' (proyección)' : ''}&#10;Entra: ${$b(q.entra)}&#10;Sale: ${$b(q.sale)}&#10;${admin ? 'Queda' : 'Ganancia'}: ${signo(libre)}`
        const mes = q.Q.q === 0 ? new Date(q.Q.y, q.Q.m, 1).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '') : ''
        return `<g class="mes-g${q.actual ? ' actual' : ''}" data-tip="${tip}" tabindex="0"><rect class="hit" x="${izq + i * ancho}" y="0" width="${ancho}" height="${H}"/>${rect(cx - barra - 1, q.entra, 'entra', q.futuro)}${rect(cx + 1, q.sale, 'sale', q.futuro)}<text x="${cx}" y="${H - 16}" text-anchor="middle">${q.Q.q ? '16' : '1'}</text>${mes ? `<text class="eje" x="${cx + ancho / 2}" y="${H - 3}" text-anchor="middle">${mes}</text>` : ''}</g>`
      })
      .join('')
    const lineas = [0.5, 1].map((f) => `<line class="grid" x1="${izq}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}"/><text class="eje" x="${izq - 6}" y="${y(max * f) + 3}" text-anchor="end">${$b(max * f)}</text>`).join('')
    return `<div class="leyenda-fin"><span><i class="entra"></i>Entra</span><span><i class="sale"></i>Sale${admin ? ' (todo)' : ' (negocio)'}</span><span><i class="futuro-m"></i>Proyección</span></div>
      <div class="grafica-fin"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lo que entra y sale cada quincena">${lineas}<line class="base" x1="${izq}" x2="${W}" y1="${H - abajo}" y2="${H - abajo}"/>${barras}</svg><div class="tip-fin" hidden></div></div>
      <details class="tabla-ver"><summary>Ver como tabla</summary><div class="tabla-scroll"><table class="tabla"><tr><th>Quincena</th><th>Entra</th><th>Sale</th><th>${admin ? 'Queda' : 'Ganancia'}</th></tr>${qs.map((q) => `<tr><td>${h(q.Q.nombre)}${q.futuro ? ' <small>proyección</small>' : q.x.antes ? ' <small>antes de HQ</small>' : ''}</td><td>${$b(q.entra)}</td><td>${$b(q.sale)}</td><td>${q.x.antes ? '—' : signo(admin ? q.x.libre : q.x.ganancia)}</td></tr>`).join('')}</table></div></details>`
  }

  // ------------------------------------------------- Ingresos
  function ingresos() {
    const prog = M.cobrosProgramados(sumarDias(M.hoy, -75), sumarDias(M.hoy, 46))
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
    const desdeH = sumarDias(M.hoy, -92)
    const historial = [...cobros.filter((x) => x.fecha >= desdeH).map((x) => ({ ...x, es: 'cobro' })), ...pagosPros.filter((g) => iso(new Date(g.fecha)) >= desdeH).map((g) => ({ id: g.id, fecha: iso(new Date(g.fecha)), monto: g.monto, moneda: g.moneda, concepto: `${g.concepto || 'Consultoría'} · Stripe`, es: 'stripe' }))].sort((a, b) => b.fecha.localeCompare(a.fecha))
    const alMesT = suma()
    for (const p of M.planes) alMesT[p.moneda] += alMes(p.monto, p.frecuencia, p.dias)
    const tot = (xs) => {
      const o = suma()
      for (const x of xs) o[x.moneda] += x.monto
      return o
    }
    return `
      <div class="kpis">
        <div class="kpi"><span>Al mes (clientes activos)</span><b>${$b(M.enBase(alMesT))}</b><small class="dos-mon">${dos(alMesT)}</small></div>
        <div class="kpi"><span>Por cobrar · 45 días</span><b>${$b(M.enBase(tot(proximos)))}</b><small class="dos-mon">${dos(tot(proximos))}</small></div>
        <div class="kpi"><span>Sin confirmar</span><b class="${vencidos.length ? 'rojo' : ''}">${$b(M.enBase(tot(vencidos)))}</b><small>${vencidos.length ? `${vencidos.length} ya pasaron` : 'todo al día'}</small></div>
      </div>
      ${vencidos.length ? `<div class="tarjeta"><h3>¿Ya te pagaron? <small>la fecha ya pasó</small></h3><ul class="cobros-lista">${vencidos.map(filaCobro).join('')}</ul></div>` : ''}
      <div class="tarjeta"><div class="fila"><h3>Próximos cobros <small>45 días</small></h3>${editar ? '<button class="btn chico" id="fin-cobro">+ Registrar un cobro</button>' : ''}</div>${proximos.length ? `<ul class="cobros-lista">${proximos.map(filaCobro).join('')}</ul>` : '<p class="vacio">No hay cobros programados. Pon cómo te paga cada cliente abajo.</p>'}</div>
      <div class="tarjeta"><h3>Cómo te paga cada cliente</h3><div class="tabla-scroll"><table class="tabla"><tr><th>Cliente</th><th>Cuándo</th><th>Cada cobro</th><th>Al mes</th><th>Próximo</th><th></th></tr>${clientesTabla}</table></div>
        <p class="nota">¿Te paga "cada dos viernes"? Elige <b>Cada dos semanas</b> y pon la fecha de <b>un viernes en que sí te pagó</b>. El contrato de México va en <b>pesos</b>: así se suma a lo que tienes en México.</p></div>
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
    const porQ = (tipo) => {
      const o = suma()
      for (const g of gastos) if (g.activo !== false && (!tipo || g.tipo === tipo)) o[g.moneda] += alMes(g.monto, g.frecuencia, g.dias) / 2
      return o
    }
    const Q = quincenaDe(new Date(), 0)
    const Q2 = quincenaDe(new Date(), 1)
    const prox = M.gastosEn(Q.desde, Q2.hasta).filter((x) => filtro === 'todos' || x.tipo === filtro)
    const porCat = {}
    for (const g of lista) (porCat[g.categoria] ??= []).push(g)
    const grupos = Object.entries(porCat)
      .sort((a, b) => (CATEGORIAS[a[0]] || a[0]).localeCompare(CATEGORIAS[b[0]] || b[0]))
      .map(
        ([cat, gs]) => `<tr class="dia-asis"><td colspan="5">${h(CATEGORIAS[cat] || cat)}</td></tr>${gs
          .map((g) => {
            const sig = fechas({ frecuencia: g.frecuencia, ancla: g.ancla, dias: g.dias, fin: g.hasta }, M.hoy, sumarDias(M.hoy, 400))[0]
            const qn = sig ? quincenaDe(deIso(sig)) : null
            return `<tr class="${g.activo === false ? 'apagado' : ''}"><td><b>${h(g.concepto)}</b>${admin ? ` <span class="chip ${g.tipo === 'personal' ? 'personal' : ''}">${g.tipo === 'personal' ? 'Personal' : h(g.empresa || 'Negocio')}</span>` : ''}${g.notas ? `<small> · ${h(g.notas)}</small>` : ''}</td><td>${dinero(g.monto, g.moneda)}</td><td>${describirPlan({ frecuencia: g.frecuencia, ancla: g.ancla, dias: g.dias })}${g.hasta ? `<small> · hasta ${fechaBonita(g.hasta)}</small>` : ''}</td><td>${sig ? `${fechaBonita(sig)}<small class="bloque">quincena ${qn.q ? '16–fin' : '1–15'}</small>` : '—'}</td><td>${editar && (admin || g.tipo === 'negocio') ? `<button class="btn chico" data-gasto="${g.id}">Editar</button>` : ''}</td></tr>`
          })
          .join('')}`,
      )
      .join('')
    const lq = (xs) => {
      if (!xs.length) return '<p class="vacio">Nada.</p>'
      const t = suma()
      for (const x of xs) t[x.moneda] += x.monto
      return `<ul class="lista">${xs.map((x) => `<li><span>${fechaBonita(x.fecha)} · ${h(x.g.concepto)}${admin && x.tipo === 'personal' ? ' <span class="chip personal">personal</span>' : ''}</span><b>${dinero(x.monto, x.moneda)}</b></li>`).join('')}</ul><div class="fila total-q"><span>Total</span><b>${dos(t)}</b></div>`
    }
    return `
      <div class="kpis">
        <div class="kpi"><span>Negocio por quincena</span><b>${$b(M.enBase(porQ('negocio')))}</b><small class="dos-mon">${dos(porQ('negocio'))}</small></div>
        ${admin ? `<div class="kpi"><span>Personal por quincena</span><b>${$b(M.enBase(porQ('personal')))}</b><small class="dos-mon">${dos(porQ('personal'))}</small></div>` : ''}
        <div class="kpi"><span>Total por quincena</span><b>${$b(M.enBase(porQ(admin ? '' : 'negocio')))}</b><small>promedio, sin nómina</small></div>
      </div>
      <div class="acciones">${admin ? `<div class="segmento">${[['todos', 'Todos'], ['negocio', 'Negocio'], ['personal', 'Personal']].map(([k, t]) => `<button data-gf="${k}" class="${filtro === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''}${editar ? '<button class="btn primario" id="fin-gasto">+ Agregar gasto</button>' : ''}</div>
      <div class="dos">
        <div class="tarjeta"><h3>Quincena ${h(Q.nombre)}</h3>${lq(prox.filter((x) => x.fecha < Q.hasta))}</div>
        <div class="tarjeta"><h3>Quincena ${h(Q2.nombre)}</h3>${lq(prox.filter((x) => x.fecha >= Q2.desde))}</div>
      </div>
      <div class="tarjeta">${lista.length ? `<div class="tabla-scroll"><table class="tabla tabla-asis"><tr><th>Gasto</th><th>Monto</th><th>Cuándo se paga</th><th>Próximo</th><th></th></tr>${grupos}</table></div>` : '<p class="vacio">Sin gastos todavía. Agrega renta, software, publicidad, tarjetas… con los días en que se pagan.</p>'}</div>`
  }

  // ------------------------------------------------- Flujo de dinero
  function vistaFlujo() {
    const fl = M.flujo(4, { personal: admin })
    const sug = M.sugerencias(fl)
    const tarjetaQ = (q, i) => {
      const fila = (t, o, cls = '') => `<tr class="${cls}"><td>${t}</td><td class="num">${signo(o.USD, 'USD')}</td><td class="num">${signo(o.MXN, 'MXN')}</td><td class="num junto">${signo(M.en(o, 'USD'), 'USD')}</td><td class="num junto">${signo(M.en(o, 'MXN'), 'MXN')}</td></tr>`
      return `<div class="tarjeta q-flujo ${q.rojo ? 'con-rojo' : ''}">
        <div class="fila"><h3>${i === 0 ? 'Lo que queda de esta quincena' : 'Quincena'} <small>${h(q.Q.nombre)}</small></h3>${q.rojo ? `<span class="chip rojo-chip">faltan ${q.rojo.moneda === 'MXN' ? 'pesos' : 'dólares'} el ${fechaBonita(q.rojo.fecha)}</span>` : '<span class="chip verde-chip">alcanza</span>'}</div>
        <div class="tabla-scroll"><table class="tabla cascada"><tr><th></th><th>Dólares</th><th>Pesos</th><th>Todo junto en dólares</th><th>Todo junto en pesos</th></tr>
          ${fila(i === 0 ? 'Tienes hoy' : 'Empiezas con', q.empieza)}
          ${fila('+ Entra', q.entra)}
          ${fila('− Sale', { USD: -q.sale.USD, MXN: -q.sale.MXN })}
          ${fila('= Terminas con', q.termina, 'total')}
        </table></div>
        ${q.xs.length ? `<details><summary>Ver qué entra y qué sale (${q.xs.length})</summary><ul class="lista">${q.xs.map((x) => `<li><span>${fechaBonita(x.fecha)} · ${h(x.que)}${x.personal ? ' <span class="chip personal">personal</span>' : ''}</span><b class="${x.monto > 0 ? 'verde' : ''}">${x.monto > 0 ? '+' : '−'}${dinero(Math.abs(x.monto), x.moneda)}</b></li>`).join('')}</ul></details>` : ''}
      </div>`
    }
    const hist = [...(envios ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 12)
    return `
      <div class="tarjeta saldo-hoy">
        <div class="fila"><h3>Hoy tienes</h3>${editar ? '<div class="acciones"><button class="btn chico primario" id="fin-saldos">Actualizar saldos</button><button class="btn chico" data-envio>Envié con Félix</button></div>' : ''}</div>
        <div class="saldos-g">
          <div><span>En dólares (USA)</span><b class="${fl.hoy.USD < 0 ? 'rojo' : ''}">${signo(fl.hoy.USD, 'USD')}</b></div>
          <div><span>En pesos (México)</span><b class="${fl.hoy.MXN < 0 ? 'rojo' : ''}">${signo(fl.hoy.MXN, 'MXN')}</b></div>
          <div class="junto-g"><span>Todo junto</span><b>${signo(M.en(fl.hoy, 'USD'), 'USD')}</b><b>${signo(M.en(fl.hoy, 'MXN'), 'MXN')}</b></div>
        </div>
        <small>${M.cfg.saldo_fecha ? `Saldos que pusiste el ${fechaBonita(fl.saldoDia)}${fl.saldoDia < M.hoy ? ', más lo que entró y salió desde entonces' : ''}.` : 'Pon tus saldos de hoy (todos tus bancos de USA juntos en dólares, y los de México en pesos).'}</small>
      </div>
      ${sug.length ? `<div class="tarjeta semaforo amarillo"><span class="luz"></span><div><b>Te van a faltar pesos. Con Félix, manda:</b><ul class="lista envios-plan">${sug.map((s) => `<li><span>Antes del <b>${fechaBonita(s.antes)}</b> <small>(quincena ${h(s.q.corto)})</small></span><b>${dinero(s.dolares, 'USD')} <small>≈ ${dinero(s.pesos, 'MXN')}</small></b></li>`).join('')}</ul><small>Con el cambio de Félix (${M.tc.toFixed(2)}) y un colchón de 3%. Si mandas antes o más, regístralo con "Envié con Félix" y esto se ajusta solo.</small></div></div>` : ''}
      ${fl.qs.map(tarjetaQ).join('')}
      <div class="tarjeta"><h3>Envíos con Félix</h3>${
        hist.length
          ? `<div class="tabla-scroll"><table class="tabla"><tr><th>Fecha</th><th>Mandaste</th><th>Llegaron</th><th>Cambio</th><th></th></tr>${hist.map((e) => `<tr><td>${fechaBonita(e.fecha)}</td><td>${dinero(e.dolares, 'USD')}</td><td>${dinero(e.pesos, 'MXN')}</td><td>${(e.pesos / e.dolares).toFixed(2)}</td><td>${admin ? `<button class="enlace" data-borrar-envio="${e.id}">quitar</button>` : ''}</td></tr>`).join('')}</table></div>`
          : '<p class="vacio">Cuando mandes dinero a México, toca "Envié con Félix": se resta de tus dólares, se suma a tus pesos y HQ aprende el tipo de cambio real.</p>'
      }</div>`
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
        <p class="nota">${x.planMes ? `Apartas ${dinero(x.mt.aporte_monto, x.mt.moneda)} ${FREC_AHORRO[x.mt.aporte_frecuencia].toLowerCase()} (≈ ${dinero(x.planMes, x.mt.moneda)} al mes)${x.llega ? ` → llegas en <b>${x.meses >= 24 ? `${Math.round(x.meses / 12)} años` : `${x.meses} meses`}</b>` : ''}.` : 'Sin plan fijo: pon cuánto y cada cuándo vas a apartar para saber cuándo llegas.'}${x.necesita ? ` Para llegar el ${fechaBonita(x.mt.fecha_limite)} necesitas <b>${dinero(x.necesita, x.mt.moneda)} al mes</b>.` : ''}</p>
        <div class="acciones"><button class="btn chico primario" data-aportar="${x.mt.id}">+ Aparté dinero</button><button class="btn chico" data-sacar="${x.mt.id}">Saqué</button><button class="btn chico" data-plan-meta="${x.mt.id}">Precio y plan</button></div>
        ${x.aps.length ? `<details><summary>Historial (${x.aps.length})</summary><ul class="lista">${x.aps.map((a) => `<li><b class="${a.monto < 0 ? 'rojo' : ''}">${a.monto < 0 ? '−' : '+'}${dinero(Math.abs(a.monto), a.moneda)}</b><small>${fechaBonita(a.fecha)}${a.nota ? ` · ${h(a.nota)}` : ''}</small> <button class="enlace" data-borrar-aporte="${a.id}">quitar</button></li>`).join('')}</ul></details>` : ''}
      </div>`
    return `
      <div class="kpis">
        <div class="kpi"><span>Apartado para tus metas</span><b>${$b(totalAhorrado)}</b><small>${ms.length} meta${ms.length === 1 ? '' : 's'} con precio</small></div>
        <div class="kpi"><span>Tu plan</span><b>${$b(planMes / 2)}</b><small>por quincena</small></div>
      </div>
      <div class="acciones"><button class="btn primario" id="fin-meta-nueva">+ Meta con precio</button></div>
      <div class="rejilla-metas">${ms.map(tarjeta).join('') || '<div class="tarjeta"><p class="vacio">Ponle precio a una meta (ej. "Casa multifamiliar para rentar · $800,000") y registra lo que vas apartando.</p></div>'}</div>
      ${sinPrecio.length ? `<div class="tarjeta"><h3>Metas sin precio</h3><ul class="lista">${sinPrecio.map((m) => `<li><b>${h(m.titulo)}</b> <button class="btn chico" data-plan-meta="${m.id}">Ponerle precio</button></li>`).join('')}</ul></div>` : ''}
      <p class="nota">El dinero lo apartas tú; aquí llevas la cuenta. Lo apartado se resta de lo que te queda libre.</p>`
  }

  // ------------------------------------------------- acciones
  const conectar = {
    resumen() {
      $$('[data-q]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-fin-q', b.dataset.q === '0' ? '0' : String(salto + Number(b.dataset.q))), mostrar())))
      $$('[data-ir-tab]', v).forEach((a) => (a.onclick = (e) => (e.preventDefault(), sessionStorage.setItem('hq-fin', a.dataset.irTab), mostrar())))
      tooltips()
    },
    ingresos() {
      $$('[data-cobrado]', v).forEach(
        (b) =>
          (b.onclick = () => {
            const [cid, f] = b.dataset.cobrado.split('|')
            const p = M.planes.find((x) => x.c.id === cid)
            registrarCobro(c2, { clientes, cliente_id: cid, para_fecha: f, monto: p?.monto, moneda: p?.moneda })
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
      $$('[data-plan]', v).forEach((b) => (b.onclick = () => editarPlanCliente(c2, clientes.find((c) => c.id === b.dataset.plan), din.find((x) => x.cliente_id === b.dataset.plan))))
      $('#fin-cobro', v)?.addEventListener('click', () => registrarCobro(c2, { clientes }))
      $$('[data-borrar-cobro]', v).forEach((b) => (b.onclick = async () => confirm('¿Quitar este cobro?') && (await intenta(() => D.borrarCobro(b.dataset.borrarCobro), 'Quitado')) && mostrar()))
    },
    gastos() {
      $$('[data-gf]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-fin-g', b.dataset.gf), mostrar())))
      $('#fin-gasto', v)?.addEventListener('click', () => editarGasto(c2, null))
      $$('[data-gasto]', v).forEach((b) => (b.onclick = () => editarGasto(c2, gastos.find((g) => g.id === b.dataset.gasto))))
    },
    flujo() {
      $('#fin-saldos', v)?.addEventListener('click', () => saldos(c2, M.flujo(1, { personal: admin }).hoy))
      $$('[data-borrar-envio]', v).forEach((b) => (b.onclick = async () => confirm('¿Quitar este envío? (No cambia tus saldos: ajústalos si hace falta.)') && (await intenta(() => D.borrarEnvio(b.dataset.borrarEnvio), 'Quitado')) && mostrar()))
    },
    metas() {
      $('#fin-meta-nueva', v)?.addEventListener('click', () => planMeta(c2, null))
      $$('[data-plan-meta]', v).forEach((b) => (b.onclick = () => planMeta(c2, metas.find((m) => m.id === b.dataset.planMeta))))
      $$('[data-aportar]', v).forEach((b) => (b.onclick = () => aportar(c2, metas.find((m) => m.id === b.dataset.aportar), 1)))
      $$('[data-sacar]', v).forEach((b) => (b.onclick = () => aportar(c2, metas.find((m) => m.id === b.dataset.sacar), -1)))
      $$('[data-borrar-aporte]', v).forEach((b) => (b.onclick = async () => confirm('¿Quitar este movimiento?') && (await intenta(() => D.borrarAporte(b.dataset.borrarAporte), 'Quitado')) && mostrar()))
    },
  }
  function tooltips() {
    const caja = $('.grafica-fin', v)
    const tip = $('.tip-fin', v)
    if (!caja) return
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
  }

  const cuerpo = { resumen, ingresos, gastos: vistaGastos, flujo: vistaFlujo, metas: vistaMetas }[tab]
  v.innerHTML = pestanas + cuerpo() + pie
  $$('[data-ft]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-fin', b.dataset.ft), mostrar())))
  $('#fin-ajustes', v)?.addEventListener('click', () => ajustesFinanzas(c2, config, cambio))
  $('#fin-felix', v)?.addEventListener('click', () => (editar ? cambioFelix(c2, cambio) : null))
  $$('[data-envio]', v).forEach((b) => (b.onclick = () => envioFelix(c2)))
  conectar[tab]?.()
}

// ----------------------------------------------------------- formularios
/** Cómo paga un cliente: frecuencia, monto de cada cobro y los días. También lo usa la ficha del cliente. */
export function editarPlanCliente({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, opciones }, c, d = {}) {
  const p = planCliente(d)
  abrirModal(
    `<form id="f-plan"><h2>Cómo te paga ${h(c.nombre)}</h2>
      <div class="campos">
        <label class="ancho">Cada cuándo<select name="frecuencia">${opciones(FRECUENCIAS, p.frecuencia)}</select></label>
        <label>Monto de cada cobro<input name="monto" type="number" min="0" step="0.01" value="${h(p.monto || '')}" required></label>
        <label>Moneda <small>pesos = cae en México · dólares = cae en USA</small><select name="moneda">${opciones(MONEDAS, p.moneda)}</select></label>
        <label class="ancho" data-si="mensual quincenal">Días del mes <small>separados por coma: "15, 30" · 31 = el último día</small><input name="dias" value="${h((p.dias ?? []).join(', '))}" placeholder="${p.frecuencia === 'quincenal' ? '15, 31' : '5'}"></label>
        <label class="ancho" data-si="catorcenal semanal bimestral trimestral semestral anual unico">Fecha de referencia <small data-ayuda></small><input name="ancla" type="date" value="${h(p.ancla || '')}"></label>
        <label>Pago único al empezar<input name="pago_unico" type="number" min="0" step="0.01" value="${h(d?.pago_unico ?? 0)}"></label>
        <label class="ancho">Notas<textarea name="notas" rows="2">${h(d?.notas || '')}</textarea></label>
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
        caja.querySelector('[data-vista]').innerHTML = q.frecuencia === 'irregular' ? 'Sin fecha fija: registra cada cobro cuando llegue (Finanzas → Ingresos).' : prox.length ? `Próximos cobros: <b>${prox.map(fechaBonita).join(' · ')}</b> · ≈ ${Math.round(alMes(q.monto, q.frecuencia, q.dias)).toLocaleString('es-MX')} ${q.moneda} al mes` : 'Pon el monto y la fecha para ver los próximos cobros.'
      }
      f.addEventListener('input', pintar)
      f.addEventListener('change', pintar)
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
        <label>Moneda <small>pesos = se paga en México</small><select name="moneda">${opciones(MONEDAS, n.moneda)}</select></label>
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
        caja.querySelector('[data-vista]').innerHTML = prox.length ? `Próximos pagos: <b>${prox.map((p) => `${fechaBonita(p)} (quincena ${quincenaDe(deIso(p)).q ? '16–fin' : '1–15'})`).join(' · ')}</b>` : ''
      }
      f.addEventListener('input', pintar)
      f.addEventListener('change', pintar)
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

/** Los saldos de hoy: todo lo de USA junto en dólares, todo lo de México junto en pesos. */
function saldos({ D, h, $, abrirModal, cerrarModal, intenta, mostrar }, hoyS) {
  abrirModal(
    `<form id="f-saldos"><h2>Lo que tienes hoy</h2>
      <div class="campos">
        <label>En dólares <small>suma todos tus bancos de USA</small><input name="usd" type="number" step="0.01" required value="${h(Math.round((hoyS?.USD ?? 0) * 100) / 100)}"></label>
        <label>En pesos <small>suma todos tus bancos de México</small><input name="mxn" type="number" step="0.01" required value="${h(Math.round((hoyS?.MXN ?? 0) * 100) / 100)}"></label>
      </div>
      <p class="nota">Desde hoy HQ suma lo que entra y resta lo que sale. Actualízalo cuando quieras (una vez por quincena basta).</p>
      <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      $('#f-saldos', caja).onsubmit = async (e) => {
        e.preventDefault()
        if (await intenta(() => D.guardarFinanzasConfig({ id: 1, saldo_usd: Number(e.target.usd.value) || 0, saldo_mxn: Number(e.target.mxn.value) || 0, saldo_fecha: new Date().toISOString() }), 'Saldos guardados')) (cerrarModal(), mostrar())
      }
    },
  )
}

/** Envié con Félix: resta los dólares, suma los pesos y aprende el tipo de cambio real. */
function envioFelix({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, M }) {
  abrirModal(
    `<form id="f-envio"><h2>Envié con Félix</h2>
      <div class="campos">
        <label>Mandé (dólares)<input name="dolares" type="number" min="0.01" step="0.01" required></label>
        <label>Llegaron (pesos) <small>lo que dice Félix</small><input name="pesos" type="number" min="0.01" step="0.01" required></label>
        <label>Fecha<input name="fecha" type="date" required value="${hoyIso()}" max="${hoyIso()}"></label>
        <label class="ancho">Nota <small>opcional</small><input name="nota" maxlength="300"></label>
      </div>
      <p class="nota" data-tc>Con el cambio de Félix (${M.tc.toFixed(2)}).</p>
      <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      const f = $('#f-envio', caja)
      let tocado = false
      f.addEventListener('input', (e) => {
        if (e.target === f.pesos) tocado = true
        if (!tocado && Number(f.dolares.value)) f.pesos.value = (Math.round(Number(f.dolares.value) * M.tc * 100) / 100).toFixed(2)
        const d = Number(f.dolares.value)
        const p = Number(f.pesos.value)
        caja.querySelector('[data-tc]').innerHTML = d && p ? `Tipo de cambio de este envío: <b>${(p / d).toFixed(4)}</b> pesos por dólar. Queda como el cambio de Félix en HQ.` : ''
      })
      f.onsubmit = async (e) => {
        e.preventDefault()
        const x = Object.fromEntries(new FormData(f))
        const d = Number(x.dolares)
        const p = Number(x.pesos)
        const r = await intenta(() => D.guardarEnvio({ fecha: x.fecha, dolares: d, pesos: p, nota: x.nota.trim() }), 'Envío registrado')
        if (!r) return
        await intenta(() => D.guardarFinanzasConfig({ id: 1, tc_felix: Math.round((p / d) * 10000) / 10000, tc_felix_fecha: new Date().toISOString() }))
        cerrarModal()
        mostrar()
      }
    },
  )
}

/** El tipo de cambio de Félix de hoy (el que sale en la app al mandar). */
function cambioFelix({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, M }, cambio) {
  abrirModal(
    `<form id="f-felix"><h2>💱 Tipo de cambio de Félix</h2>
      <div class="campos">
        <label class="ancho">1 dólar = cuántos pesos <small>el que te sale hoy en la app de Félix</small><input name="tc" type="number" min="5" max="60" step="0.0001" required value="${h(M.felix ?? (cambio?.tc ? cambio.tc.toFixed(4) : M.tc))}"></label>
      </div>
      <p class="nota">Félix no publica su tipo de cambio para otras apps, así que lo pones tú (o se aprende solo cada vez que registras "Envié con Félix").${cambio?.tc ? ` Como referencia, el del mercado hoy es ${cambio.tc.toFixed(2)} (${h(cambio.fuente)}).` : ''}</p>
      <div class="acciones"><button class="btn primario">Guardar</button>${M.felix ? '<button type="button" class="btn" id="tc-mercado">Usar el del mercado</button>' : ''}<button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      $('#f-felix', caja).onsubmit = async (e) => {
        e.preventDefault()
        if (await intenta(() => D.guardarFinanzasConfig({ id: 1, tc_felix: Number(e.target.tc.value), tc_felix_fecha: new Date().toISOString() }), 'Tipo de cambio guardado')) (cerrarModal(), mostrar())
      }
      $('#tc-mercado', caja)?.addEventListener('click', async () => {
        if (await intenta(() => D.guardarFinanzasConfig({ id: 1, tc_felix: null, tc_felix_fecha: null, cambio_auto: true }), 'Usando el del mercado')) (cerrarModal(), mostrar())
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
        const mes = alMes(Number(x.aporte_monto) || 0, x.aporte_frecuencia || 'irregular')
        const falta = Math.max(0, Number(x.monto_objetivo) || 0)
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
        <label>Cuánto (${h(m.moneda || 'USD')})<input name="monto" type="number" min="0.01" step="0.01" required value="${signo > 0 ? h(m.aporte_monto || '') : ''}"></label>
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

function ajustesFinanzas({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, opciones }, cfg = {}, cambio) {
  const c = cfg ?? {}
  abrirModal(
    `<form id="f-ajfin"><h2>Ajustes de finanzas</h2>
      <div class="campos">
        <label>Tipo de cambio de Félix <small>vacío = el del mercado${cambio ? ` (hoy ${cambio.tc.toFixed(2)})` : ''}</small><input name="tc_felix" type="number" min="5" max="60" step="0.0001" value="${h(c.tc_felix ?? '')}"></label>
        <label>Ver los totales en<select name="moneda_base">${opciones(MONEDAS, c.moneda_base || 'USD')}</select></label>
        <label>Quiero que me queden libres cada quincena <small>en la moneda de los totales</small><input name="meta_libre" type="number" min="0" step="1" value="${h(c.meta_libre ?? 5000)}"></label>
        <label>Llevo las cuentas desde <small>lo de antes no cuenta</small><input name="desde" type="date" value="${h(String(c.desde || '').slice(0, 10))}" max="${hoyIso()}"></label>
      </div>
      <p class="nota">Tus saldos de hoy se ponen en Finanzas → Flujo de dinero.</p>
      <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      $('#f-ajfin', caja).onsubmit = async (e) => {
        e.preventDefault()
        const x = Object.fromEntries(new FormData(e.target))
        const felix = Number(x.tc_felix) || null
        const fila = { id: 1, moneda_base: x.moneda_base, meta_libre: Number(x.meta_libre) || 0, cambio_auto: true, ...(x.desde ? { desde: x.desde } : {}), tc_felix: felix, ...(felix !== (Number(c.tc_felix) || null) ? { tc_felix_fecha: felix ? new Date().toISOString() : null } : {}) }
        if (await intenta(() => D.guardarFinanzasConfig(fila), 'Guardado')) (cerrarModal(), mostrar())
      }
    },
  )
}
