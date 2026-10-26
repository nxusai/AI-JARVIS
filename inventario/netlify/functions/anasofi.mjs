// La puerta de Ana Sofi al inventario, para cuando el dueño le pregunte por
// Telegram ("¿qué llegó hoy?", "¿qué falta por comprar?", "¿qué se va a
// caducar?"). Solo lee: no cambia nada. Solo entra quien trae la clave que
// comparten este sitio y el cerebro de Ana Sofi (ANASOFI_CLAVE); la llave de
// servicio de Supabase nunca sale de aquí. Ver docs/guia-inventario.md.
//
//   POST { pregunta, desde?, hasta?, dias?, folio?, texto? }   header x-anasofi-clave
//
//   resumen        lo del día (o del rango): recepciones, problemas, pedidos, compras y salidas
//   pendientes     pedidos por comprar y comprados que no han llegado
//   recepciones    lo que llegó en el rango, con sus problemas
//   recepcion      una recepción completa por su folio (R-0012 o 12)
//   problemas      faltantes, dañados y demás del rango, por proveedor
//   existencias    lo que hay en el almacén (texto: filtra por producto)
//   caducidades    lotes que caducan en `dias` días o menos (30 si no se dice)
import { timingSafeEqual } from 'node:crypto'
import { json, sb } from '../lib/sb.mjs'
import {
  ESTADO_PEDIDO,
  INCIDENCIA,
  RESULTADO,
  SALIDA,
  estadoPedido,
  existencias,
  folio,
  incidenciasDe,
  plegar,
  porCaducar,
  recepcionesVigentes,
  resultadoDe,
} from '../../public/calculos.js'

const ZONA = process.env.ZONA || 'America/New_York'

function autorizado(req) {
  const want = Buffer.from((process.env.ANASOFI_CLAVE || '').trim())
  const got = Buffer.from((req.headers.get('x-anasofi-clave') || '').trim())
  return want.length >= 24 && want.length === got.length && timingSafeEqual(want, got)
}

/** Cuántos minutos va la zona del negocio respecto a UTC en un instante. */
function desfase(fecha) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(fecha).map((x) => [x.type, x.value]))
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - fecha.getTime()) / 60000
}
/** El inicio de un día AAAA-MM-DD en la zona del negocio. */
function inicioDia(dia) {
  const [y, m, d] = dia.split('-').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d))
  return new Date(guess.getTime() - desfase(guess) * 60000)
}
const hoyZona = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date())
const masUno = (dia) => new Date(Date.parse(`${dia}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)
const enZona = (iso) => (iso ? new Date(iso).toLocaleString('es-MX', { timeZone: ZONA, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')
const DIA = /^\d{4}-\d{2}-\d{2}$/

function rango(d) {
  const desde = DIA.test(d.desde ?? '') ? d.desde : hoyZona()
  const hasta = DIA.test(d.hasta ?? '') ? d.hasta : desde
  return { desde, hasta, a: inicioDia(desde), b: inicioDia(masUno(hasta)) }
}
const dentro = (iso, r) => iso && new Date(iso) >= r.a && new Date(iso) < r.b

async function cargar() {
  const q = (t, sel = '*', extra = '') => sb(`/rest/v1/${t}?select=${sel}${extra}`, { servicio: true })
  const [recs, pedidos, salidas, productos, proveedores, perfiles] = await Promise.all([
    q('recepciones', '*,lineas:recepcion_lineas(*)', '&order=llegada.desc&limit=5000'),
    q('pedidos', '*,lineas:pedido_lineas(*)', '&order=pedido_en.desc&limit=5000'),
    q('salidas', '*', '&order=hecha_en.desc&limit=10000'),
    q('productos'),
    q('proveedores', 'id,nombre'),
    q('perfiles', 'id,nombre'),
  ])
  const nombre = (id) => perfiles.find((p) => p.id === id)?.nombre ?? ''
  const proveedor = (r) => proveedores.find((p) => p.id === r.proveedor_id)?.nombre || r.proveedor_nombre || r.proveedor_texto || ''
  return { recs, pedidos, salidas, productos, nombre, proveedor }
}

const lineaPedido = (l) => `${l.cantidad} ${l.unidad} ${l.producto}`.replace(/\s+/g, ' ').trim()

function verRecepcion(r, x, todas) {
  const corregida = todas.find((c) => c.corrige_id === r.id && c.estado === 'cerrada')
  return {
    folio: folio('R', r.folio),
    estado: r.estado === 'borrador' ? 'abierta (la están llenando)' : corregida ? `corregida por ${folio('R', corregida.folio)}` : 'cerrada',
    proveedor: x.proveedor(r),
    llego: enZona(r.llegada),
    inspeccion: enZona(r.inspeccion_en),
    cerrada: enZona(r.cerrada_en),
    recibio: x.nombre(r.creado_por),
    packing_slip: r.sin_packing ? 'NO lo trajo' : r.packing_numero || 'sí',
    resultado: r.estado === 'cerrada' ? RESULTADO[resultadoDe(r)] : '',
    resumen: r.resumen,
    productos: (r.lineas ?? [])
      .sort((a, b) => a.orden - b.orden)
      .map((l) => ({ producto: l.producto, unidad: l.unidad, esperado: l.cantidad_esperada, recibido: l.cantidad_recibida, danados: Number(l.danados || 0), lote: l.lote, caducidad: l.caducidad, calidad: l.calidad })),
    problemas: incidenciasDe(r).map((i) => ({ tipo: INCIDENCIA[i.tipo] ?? i.tipo, producto: i.producto, cantidad: i.cantidad, detalle: i.detalle, valor: i.valor })),
    ...(r.corrige_id ? { corrige_a: folio('R', todas.find((o) => o.id === r.corrige_id)?.folio), motivo: r.motivo } : {}),
  }
}

function verPedido(p, x) {
  return {
    folio: folio('P', p.folio),
    estado: ESTADO_PEDIDO[estadoPedido(p, x.pedidos)],
    urgente: p.urgente,
    pidio: x.nombre(p.pedido_por),
    cuando: enZona(p.pedido_en),
    productos: (p.lineas ?? []).sort((a, b) => a.orden - b.orden).map(lineaPedido),
    proveedor: x.proveedor(p),
    nota: p.nota,
    ...(p.comprado_en ? { compro: x.nombre(p.comprado_por), comprado: enZona(p.comprado_en), orden_compra: p.orden_compra, llega: p.llega } : {}),
    ...(p.corrige_id ? { corrige_a: folio('P', x.pedidos.find((o) => o.id === p.corrige_id)?.folio), motivo: p.motivo } : {}),
  }
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  if (!autorizado(req)) return json({ ok: false, error: 'sin permiso' }, 401)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const d = await req.json().catch(() => ({}))

  try {
    const x = await cargar()
    const r = rango(d)
    const pendientes = () => x.pedidos.filter((p) => ['pedido', 'comprado'].includes(estadoPedido(p, x.pedidos))).map((p) => verPedido(p, x))

    switch (d.pregunta) {
      case 'resumen': {
        const recs = x.recs.filter((y) => dentro(y.llegada, r) || dentro(y.creado, r))
        const ex = existencias(x.recs, x.salidas, x.productos)
        return json({
          ok: true,
          zona: ZONA,
          desde: r.desde,
          hasta: r.hasta,
          recepciones: recs.map((y) => verRecepcion(y, x, x.recs)),
          pedidos_hechos: x.pedidos.filter((p) => dentro(p.pedido_en, r)).map((p) => verPedido(p, x)),
          compras_hechas: x.pedidos.filter((p) => dentro(p.comprado_en, r)).map((p) => verPedido(p, x)),
          salidas: x.salidas.filter((s) => dentro(s.hecha_en, r)).map((s) => ({ folio: folio('S', s.folio), producto: s.producto, cantidad: s.cantidad, unidad: s.unidad, lote: s.lote, tipo: SALIDA[s.tipo], quien: x.nombre(s.hecha_por), cuando: enZona(s.hecha_en), ...(s.corrige_id ? { correccion: s.motivo, anula: s.anula } : {}) })),
          pendientes_de_compra: pendientes(),
          por_caducar_14_dias: porCaducar(ex, 14),
          bajos_de_minimo: ex.filter((p) => p.bajo).map((p) => ({ producto: p.producto, queda: p.queda, minimo: p.minimo, unidad: p.unidad })),
        })
      }
      case 'pendientes':
        return json({ ok: true, pedidos: pendientes() })
      case 'recepciones':
        return json({ ok: true, desde: r.desde, hasta: r.hasta, recepciones: x.recs.filter((y) => dentro(y.llegada, r)).map((y) => verRecepcion(y, x, x.recs)) })
      case 'recepcion': {
        const n = Number(String(d.folio ?? '').replace(/\D/g, ''))
        const y = x.recs.find((z) => z.folio === n)
        return y ? json({ ok: true, recepcion: verRecepcion(y, x, x.recs) }) : json({ ok: false, error: `No hay recepción ${folio('R', n)}` }, 404)
      }
      case 'problemas': {
        const porProv = {}
        for (const y of recepcionesVigentes(x.recs).filter((z) => dentro(z.llegada, r))) {
          const lista = incidenciasDe(y)
          if (!lista.length) continue
          const p = (porProv[x.proveedor(y) || '—'] ??= { entregas_con_problema: 0, valor: 0, problemas: [] })
          p.entregas_con_problema += 1
          for (const i of lista) {
            p.valor += i.valor
            p.problemas.push({ recepcion: folio('R', y.folio), dia: enZona(y.llegada), tipo: INCIDENCIA[i.tipo] ?? i.tipo, producto: i.producto, cantidad: i.cantidad, detalle: i.detalle })
          }
        }
        return json({ ok: true, desde: r.desde, hasta: r.hasta, proveedores: porProv })
      }
      case 'existencias': {
        const t = plegar(d.texto)
        const ex = existencias(x.recs, x.salidas, x.productos).filter((p) => !t || plegar(p.producto).includes(t))
        return json({ ok: true, existencias: ex.map((p) => ({ producto: p.producto, unidad: p.unidad, queda: p.queda, minimo: p.minimo, bajo: p.bajo, lotes: p.lotes.map((l) => ({ lote: l.lote, caducidad: l.caducidad, queda: l.queda })) })) })
      }
      case 'caducidades': {
        const dias = Math.min(365, Math.max(0, Number(d.dias) || 30))
        return json({ ok: true, dias, lotes: porCaducar(existencias(x.recs, x.salidas, x.productos), dias) })
      }
      default:
        return json({ ok: false, error: 'Pregunta desconocida', preguntas: ['resumen', 'pendientes', 'recepciones', 'recepcion', 'problemas', 'existencias', 'caducidades'] }, 400)
    }
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}

