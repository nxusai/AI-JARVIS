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
// Como el Notion de Eduardo: cada mes, dos tablas ("del 1 al 14" y "del 15 al 31") con sus gastos,
// lo que hay que tener, las entradas (solas, de cómo paga cada cliente) y lo que sobra. Más los
// movimientos de cada corte: mandar a México lo de "Tarjeta de México" (el último día del mes) y pasar
// lo de los "Automatizado" a la cuenta donde están domiciliados (antes de cada mitad). Si los hace a
// tiempo, verde; si se le pasa la fecha, rojo.

/** En qué mitad del mes va un gasto: la que él eligió; si no, por su día. */
export function mitadDe(g) {
  if (g.quincena) return g.quincena
  if (g.frecuencia === 'quincenal') return 'ambas'
  const d = Number((g.dias ?? [])[0] || String(g.dia_texto || '').match(/\d+/)?.[0] || (g.ancla ? deIso(g.ancla).getDate() : 1))
  return d >= 15 ? 'segunda' : 'primera'
}
/** Cómo se paga un gasto: Tarjeta de México, automático (otra cuenta de USA) o manual. */
export function pagoDe(g) {
  if (g.pago) return g.pago
  if (/tarjeta\s+(de\s+)?m[eé]xico/i.test(g.notas || '')) return 'mexico'
  if (g.automatico || /automatizad/i.test(g.notas || '')) return 'automatica'
  return 'manual'
}
const PAGO = { mexico: '🇲🇽 Tarjeta de México', automatica: '⟳ Automático (cuenta USA)', manual: '✋ Pago manual' }
const PAGO_CORTO = { mexico: '🇲🇽 México', automatica: '⟳ Automático', manual: '✋ Manual' }
const MITAD = { 1: { clave: 'primera', titulo: 'Dinero a tener para gastos del 1 al 14', corto: '1–14' }, 2: { clave: 'segunda', titulo: 'Dinero a tener para gastos del 15 al 31', corto: '15–31' } }
const ESTADOS = { debe: 'Se debe', pagado: 'Pagado', cancelado: 'Cancelada' }

export async function vistaFinanzas(v, ctx) {
  const { D, h, $, $$, titulo, dinero, intenta, mostrar, puede, esAdmin } = ctx
  titulo('Finanzas')
  const admin = esAdmin()
  const TABS = { gastos: 'Gastos del mes', entradas: 'Entradas' }
  let tab = sessionStorage.getItem('hq-fin2')
  if (!TABS[tab]) tab = 'gastos'
  const salto = Number(sessionStorage.getItem('hq-fin-mes') || 0)
  const hoyD = new Date()
  const ref = new Date(hoyD.getFullYear(), hoyD.getMonth() + salto, 1)
  const Y = ref.getFullYear()
  const Mo = ref.getMonth()
  const hoy = hoyIso()
  const mesTxt = (() => {
    const t = ref.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    return t.charAt(0).toUpperCase() + t.slice(1)
  })()
  const vacio = () => Promise.resolve([])
  const [clientes, din, cobros, omitidos, pagosPros, gastos, estados, movs, config, cambio] = await Promise.all([
    D.clientes(),
    D.dinero().catch(() => []),
    D.cobros().catch(() => []),
    D.cobrosOmitidos().catch(() => []),
    D.pagosProspectos().catch(() => []),
    D.gastos().catch(() => []),
    D.gastosEstado ? D.gastosEstado().catch(() => []) : vacio(),
    admin && D.movimientos ? D.movimientos().catch(() => []) : vacio(),
    D.finanzasConfig().catch(() => null),
    cambioDelDia(),
  ])
  const tc = Number(config?.tc_felix) || cambio?.tc || Number(config?.tipo_cambio) || 18.5
  const editar = puede('finanzas_editar')
  const c2 = { ...ctx, tc }
  const sum = (xs) => {
    const o = suma()
    for (const x of xs) o[x.moneda || 'USD'] += Number(x.monto || 0)
    return o
  }
  const verMon = (o, cls = '') => {
    const p = ['USD', 'MXN'].filter((m) => Math.round(o[m] * 100))
    return p.length ? p.map((m) => `<span class="${cls} ${o[m] < 0 ? 'rojo' : ''}">${o[m] < 0 ? '−' : ''}${dinero(Math.abs(o[m]), m)}</span>`).join('<i class="mas">+</i>') : `<span>${dinero(0, 'USD')}</span>`
  }
  const juntoUSD = (o) => o.USD + o.MXN / tc
  const tieneDos = (o) => Math.round(o.USD * 100) && Math.round(o.MXN * 100)
  const rango = (n) => ({ desde: iso(new Date(Y, Mo, n === 1 ? 1 : 15)), hasta: iso(n === 1 ? new Date(Y, Mo, 15) : new Date(Y, Mo + 1, 1)) })
  const claveMes = (n) => `${Y}-${String(Mo + 1).padStart(2, '0')}-${n}`
  const mesClave = `${Y}-${String(Mo + 1).padStart(2, '0')}`
  const estadoDe = (g, n) => estados.find((e) => e.gasto_id === g.id && e.mes === claveMes(n))?.estado ?? (g.activo === false ? 'cancelado' : g.automatico ? 'pagado' : 'debe')

  // ---- Entradas: solas, de cómo paga cada cliente (más las que registre a mano).
  const inicioCuentas = (() => {
    const d = config?.desde ? deIso(String(config.desde).slice(0, 10)) : new Date()
    return iso(new Date(d.getFullYear(), d.getMonth(), 1))
  })()
  const M = motor({ clientes, dinero: din, cobros, omitidos, pagosPros: [], gastos: [], aportes: [], metas: [], nomina: [], jornadas: [], ajustes: [], comisiones: [], config: { ...(config ?? {}), desde: inicioCuentas } }, ctx, cambio)
  function entradasDe(n) {
    const r = rango(n)
    const prog = M.cobrosProgramados(r.desde, r.hasta)
    const usados = new Set(prog.filter((p) => p.cobro).map((p) => p.cobro.id))
    const deClientes = prog.map((p) => ({
      clave: `${p.cliente.id}|${p.fecha}`,
      fecha: p.fecha,
      de: p.cliente.nombre,
      monto: p.cobro ? Number(p.cobro.monto) : p.monto,
      moneda: p.cobro ? p.cobro.moneda : p.moneda,
      // cobrado = lo registró; omitido = "no llegó"; vencido = ya pasó su día (se da por llegado); pendiente = por llegar
      // cobrado = confirmó que llegó; omitido = "no llegó"; su día ya llegó y no ha confirmado = payday; si no, por llegar
      estado: p.estado === 'cobrado' ? 'llego' : p.estado === 'omitido' ? 'no' : p.fecha <= hoy ? 'payday' : 'por-llegar',
      cobro: p.cobro,
      plan: p,
    }))
    const extras = [
      // Los cobros de un payday (para_fecha) cuentan en la mitad de ese payday, aunque hayan llegado después.
      ...cobros.filter((x) => !x.para_fecha && x.fecha >= r.desde && x.fecha < r.hasta && !usados.has(x.id)).map((x) => ({ clave: x.id, fecha: x.fecha, de: x.cliente_id ? clientes.find((c) => c.id === x.cliente_id)?.nombre || 'Cliente' : x.concepto || 'Otra entrada', monto: Number(x.monto), moneda: x.moneda, estado: 'extra', cobro: x })),
      ...pagosPros.filter((g) => { const f = iso(new Date(g.fecha)); return f >= r.desde && f < r.hasta }).map((g) => ({ clave: g.id, fecha: iso(new Date(g.fecha)), de: `${g.concepto || 'Consultoría'} · Stripe`, monto: Number(g.monto), moneda: g.moneda, estado: 'stripe' })),
    ]
    return [...deClientes, ...extras].sort((a, b) => a.fecha.localeCompare(b.fecha))
  }
  const cuentan = (xs) => xs.filter((x) => x.estado !== 'no')

  // ---- Gastos
  const deTipo = (tipo, n) => gastos.filter((g) => (!tipo || (g.tipo || 'negocio') === tipo) && [MITAD[n].clave, 'ambas'].includes(mitadDe(g)))
  const vivosDe = (tipo, n) => deTipo(tipo, n).filter((g) => estadoDe(g, n) !== 'cancelado')
  const aTenerDe = (tipo, n) => sum(vivosDe(tipo, n))

  // ---- Movimientos de cada corte (solo Eduardo: mezcla lo de NXUS y lo personal)
  const ultimoDelAnterior = iso(new Date(Y, Mo, 0))
  const MOVS = [
    { tipo: 'mexico-1', corte: 1, titulo: 'Mandar a México (Félix)', que: 'Lo de "Tarjeta de México" del 1 al 14', vence: ultimoDelAnterior, items: () => vivosDe(null, 1).filter((g) => pagoDe(g) === 'mexico') },
    { tipo: 'auto-1', corte: 1, titulo: 'Pasar a la cuenta de los automáticos', que: 'Los "Automatizado" del 1 al 14', vence: ultimoDelAnterior, items: () => vivosDe(null, 1).filter((g) => pagoDe(g) === 'automatica') },
    { tipo: 'mexico-2', corte: 2, titulo: 'Mandar a México (Félix)', que: 'Lo de "Tarjeta de México" del 15 al 31', vence: iso(new Date(Y, Mo, 14)), items: () => vivosDe(null, 2).filter((g) => pagoDe(g) === 'mexico') },
    { tipo: 'auto-2', corte: 2, titulo: 'Pasar a la cuenta de los automáticos', que: 'Los "Automatizado" del 15 al 31', vence: iso(new Date(Y, Mo, 14)), items: () => vivosDe(null, 2).filter((g) => pagoDe(g) === 'automatica') },
  ]
  const desdeCuentas = config?.desde ? String(config.desde).slice(0, 10) : hoy
  const estadoMov = (m) => {
    const hecho = movs.find((x) => x.mes === mesClave && x.tipo === m.tipo)
    if (hecho) return { k: 'hecho', hecho }
    if (m.vence < desdeCuentas) return { k: 'previo' }
    if (hoy > m.vence) return { k: 'tarde' }
    return { k: 'pendiente' }
  }

  const cambioTxt = `💱 1 USD = ${tc.toFixed(2)} MXN${Number(config?.tc_felix) ? ' · Félix' : ' · mercado'}`
  const pestanas = `<div class="acciones fin-tabs"><div class="segmento">${Object.entries(TABS).map(([k, t]) => `<button data-ft="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}</div><button class="cambio-chip" id="fin-felix" title="Solo para sumar pesos y dólares juntos">${cambioTxt}</button></div>`
  const navMes = `<div class="acciones mes-nav"><div class="segmento"><button data-mes="-1" aria-label="Mes anterior">←</button><button class="on">${h(mesTxt)}</button><button data-mes="1" aria-label="Mes siguiente">→</button></div>${salto ? '<button class="btn chico" data-mes="0">Este mes</button>' : ''}</div>`
  const ESTADO_ENT = { llego: '✓ Llegó', payday: '💰 Payday · ¿llegó?', 'por-llegar': 'Por llegar', no: 'No llegó', extra: '✓ Registrada', stripe: '✓ Stripe' }
  // Paydays sin confirmar (de los últimos 75 días, cualquier mes): arriba de Finanzas para confirmar con un toque.
  const paydays = M.cobrosProgramados(sumarDias(hoy, -75), sumarDias(hoy, 1)).filter((p) => p.estado !== 'cobrado' && p.estado !== 'omitido' && p.fecha <= hoy)
  const avisoPayday = paydays.length
    ? `<div class="tarjeta payday"><h3>💰 ${paydays.some((p) => p.fecha === hoy) ? 'Hoy es payday' : 'Payday sin confirmar'}</h3><ul class="movs">${paydays
        .map((p) => `<li><div><b>${h(p.cliente.nombre)}</b><small>${p.fecha === hoy ? 'hoy' : fechaBonita(p.fecha)} · ${dinero(p.monto, p.moneda)}</small></div><div class="mov-der">${editar ? `<button class="btn chico primario" data-llego="${p.cliente.id}|${p.fecha}">✓ Llegó</button><button class="btn chico" data-ajustar="${p.cliente.id}|${p.fecha}">Llegó otro monto</button><button class="btn chico" data-nollego="${p.cliente.id}|${p.fecha}">No llegó</button>` : '<span class="chip">sin confirmar</span>'}</div></li>`)
        .join('')}</ul><p class="nota">Si todavía no te llega (cheque o transferencia tardada), déjalo así: aquí sigue hasta que lo confirmes.</p></div>`
    : ''

  // ------------------------------------------------- Cortes (semáforo y movimientos)
  function cortes() {
    if (!admin) return ''
    const corte = (n) => {
      const ms = MOVS.filter((m) => m.corte === n)
      const ent = cuentan(entradasDe(n))
      const entradas = sum(ent)
      const aTener = aTenerDe(null, n)
      const sobran = { USD: entradas.USD - aTener.USD, MXN: entradas.MXN - aTener.MXN }
      const ests = ms.map((m) => ({ m, e: estadoMov(m), total: sum(m.items()) }))
      const tarde = ests.some((x) => x.e.k === 'tarde' && juntoUSD(x.total) > 0)
      const pend = ests.some((x) => x.e.k === 'pendiente' && juntoUSD(x.total) > 0)
      const color = tarde || juntoUSD(sobran) < 0 ? 'rojo' : pend ? 'amarillo' : 'verde'
      const frase = tarde ? 'Se pasó la fecha de un movimiento' : juntoUSD(sobran) < 0 ? 'No alcanzan las entradas para los gastos' : pend ? 'Vas bien: faltan movimientos (todavía a tiempo)' : 'Todo en orden'
      return `<div class="corte-t c-${color}">
        <div class="fila"><b><span class="luz-chica"></span>Corte del ${MITAD[n].corto}</b><small>${frase}</small></div>
        <ul class="movs">${ests
          .map(({ m, e, total }) => {
            const n2 = m.items().length
            return `<li class="${e.k}"><div><b>${m.titulo}</b><small>${m.que} · ${n2} gasto${n2 === 1 ? '' : 's'}</small></div><div class="mov-der"><b>${verMon(total)}</b>${
              e.k === 'hecho'
                ? `<span class="chip verde-chip">✓ Hecho ${fechaBonita(iso(new Date(e.hecho.hecho_en)))}</span>${e.hecho.pesos ? `<small>llegaron ${dinero(e.hecho.pesos, 'MXN')}</small>` : ''}<button class="enlace" data-deshacer="${m.tipo}">deshacer</button>`
                : `<span class="chip ${e.k === 'tarde' ? 'rojo-chip' : ''}">${e.k === 'tarde' ? `Atrasado · era el ${fechaBonita(m.vence)}` : e.k === 'previo' ? `Era el ${fechaBonita(m.vence)} (antes de usar HQ)` : `Antes del ${fechaBonita(m.vence)}`}</span><button class="btn chico primario" data-hacer="${m.tipo}">Ya lo hice</button>`
            }</div></li>`
          })
          .join('')}</ul>
        <div class="corte-num"><span>Entradas <b>${verMon(entradas)}</b></span><span>A tener (NXUS + personal) <b>${verMon(aTener)}</b></span><span class="${juntoUSD(sobran) < 0 ? 'rojo' : 'verde'}">Sobran <b>${verMon(sobran)}</b></span></div>
      </div>`
    }
    return `<div class="tarjeta cortes"><h3>Cortes de ${h(mesTxt.toLowerCase())} <small>tus movimientos de dinero</small></h3><div class="dos">${corte(1)}${corte(2)}</div>
      <p class="nota">Cada corte: mandar a México lo de "Tarjeta de México" y pasar lo de los "Automatizado" a su cuenta (el del 1 al 14 antes del día 1; el del 15 al 31 antes del 15). Toca <b>"Ya lo hice"</b> cuando lo hagas. A tiempo = verde; si se pasa la fecha y no lo has hecho = rojo. Lo de pago manual (deudas, renta, tarjetas) lo pagas tú directo y no entra aquí.</p></div>`
  }

  // ------------------------------------------------- Gastos del mes (como Notion)
  const cual = admin && sessionStorage.getItem('hq-fin-tipo') === 'personal' ? 'personal' : 'negocio'
  function vistaGastos() {
    const tabla = (n) => {
      const M2 = MITAD[n]
      const lista = deTipo(cual, n).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.concepto).localeCompare(String(b.concepto)))
      const vivos = lista.filter((g) => estadoDe(g, n) !== 'cancelado')
      const aTener = sum(vivos)
      const entradas = sum(cuentan(entradasDe(n)))
      const nx = aTenerDe('negocio', n)
      const income = cual === 'personal' ? { USD: entradas.USD - nx.USD, MXN: entradas.MXN - nx.MXN } : entradas
      const sobran = { USD: income.USD - aTener.USD, MXN: income.MXN - aTener.MXN }
      const pagados = vivos.filter((g) => estadoDe(g, n) === 'pagado').length
      const enCurso = hoy >= rango(n).desde && hoy < rango(n).hasta
      return `<div class="tarjeta notion-t">
        <div class="fila"><h3><span class="punto-n ${enCurso ? 'vivo' : ''}"></span>${M2.titulo} <small class="tipo-n ${cual}">${cual === 'personal' ? 'Personal' : 'NXUS'}</small></h3>${editar ? `<button class="btn chico" data-nuevo="${M2.clave}">+ Gasto</button>` : ''}</div>
        <div class="resumen-n">
          <div><span>A tener</span><b>${verMon(aTener)}</b></div>
          <div><span>${cual === 'personal' ? 'Te sobra de NXUS' : 'Entradas'}</span><b>${verMon(income)}</b>${cual === 'personal' ? `<small>entradas ${verMon(entradas)} − NXUS ${verMon(nx)}</small>` : ''}</div>
          <div class="${juntoUSD(sobran) < 0 ? 'neg' : 'pos'}"><span>Sobran</span><b>${verMon(sobran)}</b>${tieneDos(sobran) ? `<small>todo junto ≈ ${juntoUSD(sobran) < 0 ? '−' : ''}${dinero(Math.abs(juntoUSD(sobran)), 'USD')}</small>` : ''}</div>
          <div><span>Pagados</span><b>${pagados}/${vivos.length}</b></div>
        </div>
        <div class="tabla-scroll"><table class="tabla tabla-n"><tr><th>Gasto</th><th>Día</th><th class="num">Monto</th><th>Estado</th><th>Se paga con</th><th>Notas</th><th></th></tr>
          ${
            lista
              .map((g) => {
                const e = estadoDe(g, n)
                return `<tr class="${e === 'cancelado' ? 'apagado' : ''}"><td><b>${h(g.concepto)}</b></td><td>${h(g.dia_texto || (g.dias ?? []).join(', ') || '—')}</td><td class="num">${dinero(g.monto, g.moneda)}</td><td>${editar ? `<button class="estado-n ${e}" data-estado="${g.id}|${n}" title="Toca para cambiar">${ESTADOS[e]}</button>` : `<span class="estado-n ${e}">${ESTADOS[e]}</span>`}</td><td><span class="pago-n ${pagoDe(g)}">${PAGO_CORTO[pagoDe(g)]}</span></td><td class="nota-asis">${h(g.notas || '')}</td><td>${editar && (admin || g.tipo === 'negocio') ? `<button class="enlace" data-gasto="${g.id}">Editar</button>` : ''}</td></tr>`
              })
              .join('') || '<tr><td colspan="7" class="vacio">Sin gastos en esta mitad.</td></tr>'
          }
          <tr class="suma-n"><td>Suma</td><td></td><td class="num">${verMon(aTener)}</td><td colspan="4"></td></tr>
        </table></div>
      </div>`
    }
    const selector = admin ? `<div class="segmento tipo-sel">${[['negocio', 'NXUS'], ['personal', 'Personal']].map(([k, t]) => `<button data-tipo="${k}" class="${cual === k ? 'on' : ''}">${t}</button>`).join('')}</div>` : ''
    return `${navMes}${cortes()}<div class="acciones">${selector}</div>${tabla(1)}${tabla(2)}<p class="nota">${cual === 'personal' ? 'Personal: solo tú lo ves. "Te sobra de NXUS" = entradas − gastos de NXUS de esa mitad; "Sobran" = eso − tus gastos personales. ' : ''}Toca el estado para cambiarlo (Se debe → Pagado → Cancelada); se guarda por mes. "A tener" = la suma de los gastos (sin los cancelados); "Sobran" = entradas − a tener.</p>`
  }

  // ------------------------------------------------- Entradas (solas, de cómo paga cada cliente)
  function vistaEntradas() {
    const lista = (n) => {
      const xs = entradasDe(n)
      const tot = sum(cuentan(xs))
      return `<div class="tarjeta"><div class="fila"><h3>Del ${MITAD[n].corto}</h3><b class="dos-mon">${verMon(tot)}</b></div>${
        xs.length
          ? `<div class="tabla-scroll"><table class="tabla"><tr><th>Día</th><th>De</th><th class="num">Monto</th><th>Estado</th><th></th></tr>${xs
              .map(
                (x) => `<tr class="${x.estado === 'no' ? 'apagado' : ''}"><td>${fechaBonita(x.fecha)}</td><td>${h(x.de)}</td><td class="num"><b>${dinero(x.monto, x.moneda)}</b></td><td><span class="ent-est ${x.estado}">${ESTADO_ENT[x.estado]}</span></td><td>${
                  !editar
                    ? ''
                    : x.estado === 'no'
                      ? `<button class="enlace" data-silego="${x.clave}">sí llegó</button>`
                      : x.plan
                        ? x.estado === 'llego'
                          ? `<button class="enlace" data-borrar-cobro="${x.cobro.id}">deshacer</button>`
                          : `${x.estado === 'payday' ? `<button class="btn chico primario" data-llego="${x.clave}">✓ Llegó</button> ` : ''}<button class="enlace" data-ajustar="${x.clave}">otro monto</button> · <button class="enlace" data-nollego="${x.clave}">no llegó</button>`
                        : x.estado === 'extra'
                          ? `<button class="enlace" data-borrar-cobro="${x.cobro.id}">quitar</button>`
                          : ''
                }</td></tr>`,
              )
              .join('')}</table></div>`
          : '<p class="vacio">Sin entradas.</p>'
      }</div>`
    }
    const sinPlan = clientes.filter((c) => c.estado === 'activo' && !M.planes.some((p) => p.c.id === c.id && p.monto))
    return `${navMes}
      <p class="nota">Salen solas de <b>cómo te paga cada cliente</b> (Clientes → el cliente → "Cómo paga"). Antes de su día dicen "Por llegar"; en su día es <b>payday</b> y te pregunta si llegó. Tú confirmas: ✓ Llegó, otro monto o No llegó.</p>
      ${editar ? '<div class="acciones"><button class="btn" id="fin-cobro">+ Otra entrada (que no es de un cliente fijo)</button></div>' : ''}
      ${lista(1)}${lista(2)}
      ${sinPlan.length ? `<div class="tarjeta"><h3>Clientes activos sin "cómo paga"</h3><p class="nota">Sus entradas no salen solas hasta que les pongas cómo pagan:</p><ul class="lista">${sinPlan.map((c) => `<li><a href="#cliente/${c.id}">${h(c.nombre)}</a>${editar ? `<button class="btn chico" data-plan="${c.id}">Cómo paga</button>` : ''}</li>`).join('')}</ul></div>` : ''}`
  }

  const cuerpo = { gastos: vistaGastos, entradas: vistaEntradas }[tab]
  v.innerHTML = pestanas + avisoPayday + cuerpo() + `<p class="nota">${admin ? 'Solo tú ves los gastos personales y los cortes.' : 'Ves lo del negocio; lo personal no aparece aquí.'}</p>`
  $$('[data-ft]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-fin2', b.dataset.ft), mostrar())))
  $$('[data-mes]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-fin-mes', b.dataset.mes === '0' ? '0' : String(salto + Number(b.dataset.mes))), mostrar())))
  $('#fin-felix', v)?.addEventListener('click', () => (editar ? cambioFelix(c2, cambio, config) : null))
  $$('[data-tipo]', v).forEach((b) => (b.onclick = () => (sessionStorage.setItem('hq-fin-tipo', b.dataset.tipo), mostrar())))
  $$('[data-nuevo]', v).forEach((b) => (b.onclick = () => editarGasto(c2, null, b.dataset.nuevo, cual)))
  $$('[data-gasto]', v).forEach((b) => (b.onclick = () => editarGasto(c2, gastos.find((g) => g.id === b.dataset.gasto))))
  $$('[data-estado]', v).forEach(
    (b) =>
      (b.onclick = async () => {
        const [gid, n] = b.dataset.estado.split('|')
        const g = gastos.find((x) => x.id === gid)
        const sig = { debe: 'pagado', pagado: 'cancelado', cancelado: 'debe' }[estadoDe(g, Number(n))]
        if (await intenta(() => D.marcarGasto(gid, claveMes(n), sig))) mostrar()
      }),
  )
  $$('[data-hacer]', v).forEach(
    (b) =>
      (b.onclick = () => {
        const m = MOVS.find((x) => x.tipo === b.dataset.hacer)
        yaLoHice(c2, { mes: mesClave, tipo: m.tipo, titulo: m.titulo, total: sum(m.items()), mexico: m.tipo.startsWith('mexico') })
      }),
  )
  $$('[data-deshacer]', v).forEach((b) => (b.onclick = async () => confirm('¿Marcarlo como no hecho?') && (await intenta(() => D.borrarMovimiento(mesClave, b.dataset.deshacer), 'Listo')) && mostrar()))
  const buscar = (clave) => {
    const x = [...entradasDe(1), ...entradasDe(2)].find((y) => y.clave === clave)
    if (x) return x
    const p = paydays.find((y) => `${y.cliente.id}|${y.fecha}` === clave)
    return p && { clave, fecha: p.fecha, monto: p.monto, moneda: p.moneda, plan: p, estado: 'payday' }
  }
  $$('[data-nollego]', v).forEach(
    (b) =>
      (b.onclick = async () => {
        const [cid, f] = b.dataset.nollego.split('|')
        const x = buscar(b.dataset.nollego)
        if (x?.cobro && x.estado === 'llego') await intenta(() => D.borrarCobro(x.cobro.id))
        if (await intenta(() => D.omitirCobro({ cliente_id: cid, fecha: f, motivo: 'No llegó' }), 'Marcada: no llegó')) mostrar()
      }),
  )
  $$('[data-llego]', v).forEach(
    (b) =>
      (b.onclick = async () => {
        const [cid, f] = b.dataset.llego.split('|')
        const p = M.planes.find((x) => x.c.id === cid)
        if (!p) return
        b.disabled = true
        if (await intenta(() => D.guardarCobro({ cliente_id: cid, concepto: '', monto: p.monto, moneda: p.moneda, fecha: hoy < f ? f : hoy, para_fecha: f, metodo: '', nota: '' }), `✓ Llegó: ${p.c.nombre}`)) mostrar()
        else b.disabled = false
      }),
  )
  $$('[data-silego]', v).forEach(
    (b) =>
      (b.onclick = async () => {
        const [cid, f] = b.dataset.silego.split('|')
        if (await intenta(() => D.quitarOmitido(cid, f), 'Listo')) mostrar()
      }),
  )
  $$('[data-ajustar]', v).forEach(
    (b) =>
      (b.onclick = () => {
        const x = buscar(b.dataset.ajustar)
        registrarCobro(c2, { clientes, cliente_id: x.plan.cliente.id, para_fecha: x.fecha, monto: x.monto, moneda: x.moneda })
      }),
  )
  $$('[data-plan]', v).forEach((b) => (b.onclick = () => editarPlanCliente(c2, clientes.find((c) => c.id === b.dataset.plan), din.find((x) => x.cliente_id === b.dataset.plan))))
  $('#fin-cobro', v)?.addEventListener('click', () => registrarCobro(c2, { clientes }))
  $$('[data-borrar-cobro]', v).forEach((b) => (b.onclick = async () => confirm('¿Quitar?') && (await intenta(() => D.borrarCobro(b.dataset.borrarCobro), 'Quitada')) && mostrar()))
}

/** Los paydays sin confirmar (para el aviso de Inicio). */
export async function paydaysPendientes(D, ctx) {
  const [clientes, din, cobros, omitidos, config] = await Promise.all([D.clientes(), D.dinero().catch(() => []), D.cobros().catch(() => []), D.cobrosOmitidos().catch(() => []), D.finanzasConfig().catch(() => null)])
  const d = config?.desde ? deIso(String(config.desde).slice(0, 10)) : new Date()
  const M = motor({ clientes, dinero: din, cobros, omitidos, pagosPros: [], gastos: [], aportes: [], metas: [], nomina: [], jornadas: [], ajustes: [], comisiones: [], config: { ...(config ?? {}), desde: iso(new Date(d.getFullYear(), d.getMonth(), 1)) } }, ctx, null)
  const hoy = hoyIso()
  return M.cobrosProgramados(sumarDias(hoy, -75), sumarDias(hoy, 1)).filter((p) => p.estado !== 'cobrado' && p.estado !== 'omitido' && p.fecha <= hoy)
}

/** "Ya lo hice": el movimiento del corte. Para México se puede poner lo que llegó en pesos (cambio real de Félix). */
function yaLoHice({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, dinero, tc }, { mes, tipo, titulo, total, mexico }) {
  const sugerido = Math.round((total.USD + total.MXN / tc) * 100) / 100
  abrirModal(
    `<form id="f-mov"><h2>✓ ${h(titulo)}</h2>
      <div class="campos">
        <label>Cuánto mandaste (dólares)<input name="monto" type="number" min="0" step="0.01" required value="${sugerido}"></label>
        ${mexico ? '<label>Llegaron (pesos) <small>opcional, lo que dice Félix</small><input name="pesos" type="number" min="0" step="0.01"></label>' : ''}
        <label class="ancho">Nota <small>opcional</small><input name="nota" maxlength="300"></label>
      </div>
      <p class="nota">Lo que tocaba: ${dinero(total.USD, 'USD')}${Math.round(total.MXN) ? ` + ${dinero(total.MXN, 'MXN')}` : ''}.</p>
      <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      $('#f-mov', caja).onsubmit = async (e) => {
        e.preventDefault()
        const x = Object.fromEntries(new FormData(e.target))
        const pesos = Number(x.pesos) || null
        if (!(await intenta(() => D.marcarMovimiento({ mes, tipo, monto: Number(x.monto) || 0, moneda: 'USD', pesos, nota: x.nota.trim(), hecho_en: new Date().toISOString() }), 'Hecho ✓'))) return
        if (pesos && Number(x.monto)) await intenta(() => D.guardarFinanzasConfig({ id: 1, tc_felix: Math.round((pesos / Number(x.monto)) * 10000) / 10000, tc_felix_fecha: new Date().toISOString() }))
        cerrarModal()
        mostrar()
      }
    },
  )
}

/** El ahorro para las metas con precio (vive en Metas y hábitos). Solo Eduardo. */
export async function vistaAhorro(v, ctx, encabezado = '') {
  const { D, h, $, $$, dinero, intenta, mostrar } = ctx
  const [aportes, metas, config, cambio] = await Promise.all([D.aportes().catch(() => []), D.metas().catch(() => []), D.finanzasConfig().catch(() => null), cambioDelDia()])
  const M = motor({ clientes: [], dinero: [], cobros: [], omitidos: [], pagosPros: [], gastos: [], aportes, metas, nomina: [], jornadas: [], ajustes: [], comisiones: [], config }, ctx, cambio)
  const ms = M.metasDinero()
  const sinPrecio = metas.filter((m) => !(Number(m.monto_objetivo) > 0) && m.estado !== 'lograda')
  const tarjeta = (x) => `<div class="tarjeta meta-dinero">
      <div class="fila"><div><b>${h(x.mt.titulo)}</b>${x.mt.porque ? `<small>${h(x.mt.porque)}</small>` : ''}</div><span class="pct">${x.pct > 0 && x.pct < 1 ? '<1' : Math.floor(x.pct)}%</span></div>
      <div class="barra grande"><i style="width:${x.pct}%"></i></div>
      <div class="desglose"><span>Apartado <b>${dinero(x.ahorrado, x.mt.moneda)}</b></span><span>Meta <b>${dinero(x.objetivo, x.mt.moneda)}</b></span><span>Falta <b>${dinero(x.falta, x.mt.moneda)}</b></span></div>
      <p class="nota">${x.planMes ? `Apartas ${dinero(x.mt.aporte_monto, x.mt.moneda)} ${FREC_AHORRO[x.mt.aporte_frecuencia].toLowerCase()} (≈ ${dinero(x.planMes, x.mt.moneda)} al mes)${x.llega ? ` → llegas en <b>${x.meses >= 24 ? `${Math.round(x.meses / 12)} años` : `${x.meses} meses`}</b>` : ''}.` : 'Sin plan fijo: pon cuánto y cada cuándo vas a apartar para saber cuándo llegas.'}${x.necesita ? ` Para llegar el ${fechaBonita(x.mt.fecha_limite)} necesitas <b>${dinero(x.necesita, x.mt.moneda)} al mes</b>.` : ''}</p>
      <div class="acciones"><button class="btn chico primario" data-aportar="${x.mt.id}">+ Aparté dinero</button><button class="btn chico" data-sacar="${x.mt.id}">Saqué</button><button class="btn chico" data-plan-meta="${x.mt.id}">Precio y plan</button></div>
      ${x.aps.length ? `<details><summary>Historial (${x.aps.length})</summary><ul class="lista">${x.aps.map((a) => `<li><b class="${a.monto < 0 ? 'rojo' : ''}">${a.monto < 0 ? '−' : '+'}${dinero(Math.abs(a.monto), a.moneda)}</b><small>${fechaBonita(a.fecha)}${a.nota ? ` · ${h(a.nota)}` : ''}</small> <button class="enlace" data-borrar-aporte="${a.id}">quitar</button></li>`).join('')}</ul></details>` : ''}
    </div>`
  v.innerHTML = `${encabezado}
    <div class="acciones"><button class="btn primario" id="fin-meta-nueva">+ Meta con precio</button></div>
    <div class="rejilla-metas">${ms.map(tarjeta).join('') || '<div class="tarjeta"><p class="vacio">Ponle precio a una meta (ej. "Casa multifamiliar para rentar · $800,000") y registra lo que vas apartando.</p></div>'}</div>
    ${sinPrecio.length ? `<div class="tarjeta"><h3>Metas sin precio</h3><ul class="lista">${sinPrecio.map((m) => `<li><b>${h(m.titulo)}</b> <button class="btn chico" data-plan-meta="${m.id}">Ponerle precio</button></li>`).join('')}</ul></div>` : ''}
    <p class="nota">El dinero lo apartas tú; aquí llevas la cuenta.</p>`
  $('#fin-meta-nueva', v)?.addEventListener('click', () => planMeta(ctx, null))
  $$('[data-plan-meta]', v).forEach((b) => (b.onclick = () => planMeta(ctx, metas.find((m) => m.id === b.dataset.planMeta))))
  $$('[data-aportar]', v).forEach((b) => (b.onclick = () => aportar(ctx, metas.find((m) => m.id === b.dataset.aportar), 1)))
  $$('[data-sacar]', v).forEach((b) => (b.onclick = () => aportar(ctx, metas.find((m) => m.id === b.dataset.sacar), -1)))
  $$('[data-borrar-aporte]', v).forEach((b) => (b.onclick = async () => confirm('¿Quitar este movimiento?') && (await intenta(() => D.borrarAporte(b.dataset.borrarAporte), 'Quitado')) && mostrar()))
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
    `<form id="f-cobro"><h2>${para_fecha ? 'Ya pagó' : 'Registrar entrada'}</h2>
      <div class="campos">
        <label class="ancho">De<select name="cliente_id"><option value="">Otra entrada (no es de un cliente)</option>${clientes.map((c) => `<option value="${c.id}" ${c.id === cliente_id ? 'selected' : ''}>${h(c.nombre)}</option>`).join('')}</select></label>
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
        if (await intenta(() => D.guardarCobro(fila), 'Entrada registrada')) (cerrarModal(), mostrar())
      }
    },
  )
}

function editarGasto({ D, h, $, abrirModal, cerrarModal, intenta, mostrar, opciones, esAdmin }, g, mitad = 'primera', tipo = 'negocio') {
  const n = g ?? { tipo, moneda: 'USD', categoria: 'otros', empresa: 'NXUS AI', quincena: mitad, dia_texto: '', automatico: false, activo: true, notas: '' }
  const admin = esAdmin()
  abrirModal(
    `<form id="f-gasto"><h2>${g ? h(g.concepto) : 'Nuevo gasto'}</h2>
      <div class="campos">
        <label class="ancho">Gasto<input name="concepto" required maxlength="200" value="${h(n.concepto || '')}" placeholder="Canva, Pago Luis, Internet México…"></label>
        <label>Va en<select name="quincena">${opciones({ primera: 'Del 1 al 14', segunda: 'Del 15 al 31', ambas: 'Las dos mitades' }, mitadDe(n))}</select></label>
        <label>Día <small>como lo escribes: "5", "29 - 2"</small><input name="dia_texto" maxlength="30" value="${h(n.dia_texto || (n.dias ?? []).join(', ') || '')}"></label>
        <label>Monto<input name="monto" type="number" min="0" step="0.01" required value="${h(n.monto ?? '')}"></label>
        <label>Moneda<select name="moneda">${opciones(MONEDAS, n.moneda || 'USD')}</select></label>
        <label class="ancho">Se paga con<select name="pago">${opciones(PAGO, pagoDe(n))}</select></label>
        <label class="ancho">Notas <small>ej. Tarjeta México, Automatizado, Destinar a una deuda</small><input name="notas" maxlength="1000" value="${h(n.notas || '')}"></label>
        <label class="check ancho"><input type="checkbox" name="automatico" ${n.automatico ? 'checked' : ''}> Automatizado (se cobra solo: sale como "Pagado" cada mes)</label>
        ${admin ? `<label>Es de<select name="tipo">${opciones({ negocio: 'NXUS (negocio)', personal: 'Personal (solo tú lo ves)' }, n.tipo || 'negocio')}</select></label>` : ''}
        <label>Categoría<select name="categoria">${opciones(CATEGORIAS, n.categoria || 'otros')}</select></label>
        ${g ? `<label class="check ancho"><input type="checkbox" name="activo" ${n.activo !== false ? 'checked' : ''}> Sigue activo (si lo cancelaste para siempre, quítalo)</label>` : ''}
      </div>
      <div class="acciones"><button class="btn primario">Guardar</button>${g ? '<button type="button" class="btn peligro" id="g-borrar">Borrar</button>' : ''}<button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      const f = $('#f-gasto', caja)
      f.onsubmit = async (e) => {
        e.preventDefault()
        const x = Object.fromEntries(new FormData(f))
        const dia = Number(String(x.dia_texto || '').match(/\d+/)?.[0]) || null
        const fila = {
          ...(g ? { id: g.id } : {}),
          concepto: x.concepto.trim(),
          quincena: x.quincena,
          dia_texto: String(x.dia_texto || '').trim(),
          monto: Number(x.monto) || 0,
          moneda: x.moneda,
          notas: x.notas.trim(),
          automatico: !!x.automatico,
          pago: x.pago,
          tipo: admin ? x.tipo : 'negocio',
          categoria: x.categoria,
          empresa: (x.tipo || 'negocio') === 'negocio' ? n.empresa || 'NXUS AI' : '',
          frecuencia: x.quincena === 'ambas' ? 'quincenal' : 'mensual',
          dias: dia ? [dia] : [],
          activo: g ? !!x.activo : true,
        }
        if (await intenta(() => D.guardarGasto(fila), 'Guardado')) (cerrarModal(), mostrar())
      }
      $('#g-borrar', caja)?.addEventListener('click', async () => {
        if (!confirm(`¿Borrar "${g.concepto}"?`)) return
        if (await intenta(() => D.borrarGasto(g.id), 'Borrado')) (cerrarModal(), mostrar())
      })
    },
  )
}

/** El tipo de cambio (solo para sumar pesos y dólares juntos): el de Félix si lo pone. */
function cambioFelix({ D, h, $, abrirModal, cerrarModal, intenta, mostrar }, cambio, cfg) {
  abrirModal(
    `<form id="f-felix"><h2>💱 Tipo de cambio</h2>
      <div class="campos">
        <label class="ancho">1 dólar = cuántos pesos <small>el de Félix; vacío = el del mercado${cambio?.tc ? ` (hoy ${cambio.tc.toFixed(2)})` : ''}</small><input name="tc" type="number" min="5" max="60" step="0.0001" value="${h(cfg?.tc_felix ?? '')}"></label>
      </div>
      <p class="nota">Solo se usa para mostrar "todo junto" cuando hay pesos y dólares en la misma tabla.</p>
      <div class="acciones"><button class="btn primario">Guardar</button><button type="button" class="btn" data-cerrar>Cancelar</button></div></form>`,
    (caja) => {
      $('#f-felix', caja).onsubmit = async (e) => {
        e.preventDefault()
        const tc = Number(e.target.tc.value) || null
        if (await intenta(() => D.guardarFinanzasConfig({ id: 1, tc_felix: tc, tc_felix_fecha: tc ? new Date().toISOString() : null }), 'Guardado')) (cerrarModal(), mostrar())
      }
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
