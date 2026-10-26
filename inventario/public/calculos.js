// Las cuentas del inventario, sin pantalla: las usa la página y también la
// puerta de Ana Sofi (netlify/functions/anasofi.mjs), para que las dos digan
// exactamente lo mismo.
//
// Nada se borra ni se cambia: una corrección es un registro nuevo que apunta
// al anterior (corrige_id). Aquí se decide cuál vale: el más nuevo.

export const PROBLEMA = {
  ninguno: 'Sin problema',
  faltante: 'Faltante',
  sobrante: 'Sobrante',
  danado: 'Dañado',
  caducado: 'Caducado o por caducar',
  calidad: 'Mala calidad',
  equivocado: 'Producto equivocado',
  otro: 'Otro',
}
export const INCIDENCIA = {
  ...PROBLEMA,
  'sin-packing': 'Sin packing slip',
  temperatura: 'Temperatura fuera de rango',
  transporte: 'Transporte sucio o en mal estado',
}
export const RESULTADO = { completa: 'Completa', incompleta: 'Incompleta', 'con-problemas': 'Con problemas', rechazada: 'Rechazada' }
export const SALIDA = { produccion: 'Uso en producción', merma: 'Merma (se tiró)', devolucion: 'Devolución al proveedor', otro: 'Otro' }

export const folio = (letra, n) => `${letra}-${String(n ?? 0).padStart(4, '0')}`
export const plegar = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
const redondo = (n) => Math.round(n * 100) / 100

/** Quién corrige a quién: id → el registro que lo corrige. */
export function correcciones(lista) {
  const m = new Map()
  for (const x of lista) if (x.corrige_id) m.set(x.corrige_id, x)
  return m
}

/** Recepciones que valen: cerradas y sin una corrección ya cerrada encima. */
export function recepcionesVigentes(recs) {
  const corr = correcciones(recs.filter((r) => r.estado === 'cerrada'))
  return recs.filter((r) => r.estado === 'cerrada' && !corr.has(r.id))
}

/** Salidas que valen: sin corrección encima y que no sean una anulación. */
export function salidasVigentes(salidas) {
  const corr = correcciones(salidas)
  return salidas.filter((s) => !corr.has(s.id) && !s.anula)
}

/** El estado de un pedido, contando sus correcciones. */
export function estadoPedido(p, pedidos) {
  const c = pedidos.find((x) => x.corrige_id === p.id)
  if (c) return c.cancela ? 'cancelado' : 'corregido'
  if (p.cancela) return 'cancelacion'
  return p.estado
}
export const ESTADO_PEDIDO = {
  pedido: 'Por comprar',
  comprado: 'Comprado',
  recibido: 'Recibido',
  corregido: 'Corregido',
  cancelado: 'Cancelado',
  cancelacion: 'Cancelación',
}

/** Lo que salió mal en una recepción: lo que ordenó la IA o, si no, lo que dicen sus productos. */
export function incidenciasDe(r) {
  const lista = Array.isArray(r.incidencias) && r.incidencias.length ? r.incidencias.map((i) => ({ ...i })) : []
  if (!lista.length) {
    if (r.sin_packing) lista.push({ tipo: 'sin-packing', producto: '', cantidad: 0, detalle: 'El proveedor no trajo el packing slip' })
    if (r.transporte_ok === false) lista.push({ tipo: 'transporte', producto: '', cantidad: 0, detalle: 'Transporte sucio o en mal estado' })
    for (const l of r.lineas ?? []) {
      const esp = num(l.cantidad_esperada)
      const rec = num(l.cantidad_recibida)
      if (esp !== null && rec !== null && rec < esp) lista.push({ tipo: 'faltante', producto: l.producto, cantidad: redondo(esp - rec), detalle: `Llegaron ${rec} de ${esp} ${l.unidad}`.trim() })
      if (esp !== null && rec !== null && rec > esp) lista.push({ tipo: 'sobrante', producto: l.producto, cantidad: redondo(rec - esp), detalle: `Llegaron ${rec} y la hoja dice ${esp}` })
      if (Number(l.danados) > 0) lista.push({ tipo: 'danado', producto: l.producto, cantidad: Number(l.danados), detalle: l.nota || `${l.danados} ${l.unidad} dañados`.trim() })
      if (!['ninguno', 'faltante', 'sobrante', 'danado', ''].includes(l.problema ?? 'ninguno')) lista.push({ tipo: l.problema, producto: l.producto, cantidad: 0, detalle: l.nota || PROBLEMA[l.problema] })
    }
  }
  // Lo que cuesta, si la hoja trae precio.
  for (const i of lista) {
    const l = (r.lineas ?? []).find((x) => plegar(x.producto) === plegar(i.producto))
    i.valor = l && Number(l.precio) > 0 && Number(i.cantidad) > 0 && ['faltante', 'danado', 'caducado', 'calidad', 'equivocado'].includes(i.tipo) ? redondo(Number(l.precio) * Number(i.cantidad)) : 0
  }
  return lista
}

/** El resultado de una recepción si nadie lo puso: completa o con problemas. */
export const resultadoDe = (r) => r.resultado || (incidenciasDe(r).length ? 'con-problemas' : 'completa')

const llave = (x) => x.producto_id || `${plegar(x.producto)}|${plegar(x.unidad)}`

/**
 * Lo que hay en el almacén, por producto y por lote: lo bueno que llegó en
 * recepciones vigentes menos las salidas vigentes. Una salida sin lote se
 * descuenta del lote que caduca primero.
 */
export function existencias(recs, salidas, productos = []) {
  const prods = new Map()
  const prodDe = (x) => {
    const k = llave(x)
    if (!prods.has(k)) {
      const cat = productos.find((p) => p.id === x.producto_id)
      prods.set(k, { llave: k, producto_id: x.producto_id || null, producto: cat?.nombre || x.producto, unidad: cat?.unidad || x.unidad || '', minimo: Number(cat?.minimo || 0), lotes: [], recibido: 0, salido: 0, queda: 0 })
    }
    return prods.get(k)
  }
  for (const r of recepcionesVigentes(recs)) {
    for (const l of r.lineas ?? []) {
      if (!l.producto) continue
      const bueno = Math.max(0, (num(l.cantidad_recibida) ?? 0) - Number(l.danados || 0))
      if (!bueno) continue
      const p = prodDe(l)
      let lote = p.lotes.find((x) => x.lote === (l.lote || '') && (x.caducidad || '') === (l.caducidad || ''))
      if (!lote) {
        lote = { lote: l.lote || '', caducidad: l.caducidad || '', llego: r.llegada, proveedor: r.proveedor_nombre, recibido: 0, salido: 0, queda: 0 }
        p.lotes.push(lote)
      }
      lote.recibido += bueno
      p.recibido += bueno
    }
  }
  const ordenCaducidad = (a, b) => (a.caducidad || '9999').localeCompare(b.caducidad || '9999') || String(a.llego).localeCompare(String(b.llego))
  for (const p of prods.values()) p.lotes.sort(ordenCaducidad)
  for (const s of salidasVigentes(salidas).sort((a, b) => String(a.hecha_en).localeCompare(String(b.hecha_en)))) {
    const p = prodDe(s)
    let falta = Number(s.cantidad || 0)
    p.salido += falta
    const lotes = s.lote ? p.lotes.filter((x) => x.lote === s.lote) : p.lotes
    for (const lote of lotes) {
      if (falta <= 0) break
      const quita = Math.min(falta, lote.recibido - lote.salido)
      if (quita <= 0) continue
      lote.salido += quita
      falta -= quita
    }
    if (falta > 0) {
      // Salió más de lo que se registró que entró: queda en negativo a la vista.
      let sin = p.lotes.find((x) => x.lote === (s.lote || '') && !x.recibido)
      if (!sin) p.lotes.push((sin = { lote: s.lote || '', caducidad: '', llego: null, proveedor: '', recibido: 0, salido: 0, queda: 0 }))
      sin.salido += falta
    }
  }
  const lista = [...prods.values()]
  for (const p of lista) {
    for (const l of p.lotes) l.queda = redondo(l.recibido - l.salido)
    p.lotes = p.lotes.filter((l) => l.queda !== 0)
    p.recibido = redondo(p.recibido)
    p.salido = redondo(p.salido)
    p.queda = redondo(p.recibido - p.salido)
    p.bajo = p.minimo > 0 && p.queda < p.minimo
  }
  // Los del catálogo que nunca han llegado también cuentan (en cero).
  for (const c of productos) if (c.activo !== false && !prods.has(c.id)) lista.push({ llave: c.id, producto_id: c.id, producto: c.nombre, unidad: c.unidad, minimo: Number(c.minimo || 0), lotes: [], recibido: 0, salido: 0, queda: 0, bajo: Number(c.minimo || 0) > 0 })
  return lista.sort((a, b) => a.producto.localeCompare(b.producto, 'es'))
}

/** Días que faltan para una fecha AAAA-MM-DD (negativo si ya pasó). */
export function diasPara(fecha, hoy = new Date()) {
  if (!fecha) return null
  const [y, m, d] = fecha.split('-').map(Number)
  const a = Date.UTC(y, m - 1, d)
  const b = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return Math.round((a - b) / 86400000)
}

/** Los lotes que ya caducaron o caducan en `dias` días o menos, el más urgente primero. */
export function porCaducar(exist, dias = 30, hoy = new Date()) {
  const r = []
  for (const p of exist) for (const l of p.lotes) {
    const d = diasPara(l.caducidad, hoy)
    if (d !== null && d <= dias && l.queda > 0) r.push({ producto: p.producto, unidad: p.unidad, lote: l.lote, caducidad: l.caducidad, queda: l.queda, dias: d })
  }
  return r.sort((a, b) => a.dias - b.dias)
}
