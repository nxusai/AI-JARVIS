// La "foto" semanal de los anuncios de Mi Semago: por cada anuncio, lo de Meta de
// esa semana (gastado, vistas, gancho, chats) + lo que pasó en el Centro de trabajo
// con los leads que llegaron esa semana (dieron permiso, Ana Sofi habló, leads
// buenos, Meet, cliente). Se guarda en la tabla anuncios_semanas para que el
// historial no dependa de Meta. Solo lee Meta y los leads (sin datos personales:
// solo fuente, etapa, calificación, permiso y si hay Meet); solo escribe en
// anuncios_semanas.
import { sb } from './sb.mjs'
import { graph, filasMiSemago, estadosMeta, metaListo, cuentaMeta, FILTRO, CAMPOS } from './meta.mjs'
import { claveDeFuente, claveDeAnuncio, llaveDe, codigoDe, pasoDe } from '../../public/anuncios-claves.js'

const dia = (d) => d.toISOString().slice(0, 10)

/** La última semana completa, de lunes a domingo (si hoy es lunes, la que terminó ayer). */
export function semanaPasada(hoy = new Date()) {
  const h = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  const fin = new Date(h.getTime() - ((h.getUTCDay() + 6) % 7) * 864e5) // el lunes de esta semana, 00:00 UTC (no se cuenta)
  return rango(dia(new Date(fin.getTime() - 7 * 864e5)), dia(new Date(fin.getTime() - 864e5)))
}

/** Un rango de días, incluidos los dos: "2026-11-09" a "2026-11-16". */
export function rango(desde, hasta) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || '') || !/^\d{4}-\d{2}-\d{2}$/.test(hasta || '') || desde > hasta) throw new Error('Rango de fechas inválido (AAAA-MM-DD)')
  return { desde, hasta, iniISO: `${desde}T00:00:00.000Z`, finISO: new Date(new Date(`${hasta}T00:00:00Z`).getTime() + 864e5).toISOString() }
}

/** Calcula (sin guardar) los números por anuncio de un rango. */
export async function calcular(s) {
  const filas = {}
  const nueva = (k) => ({ semana: s.desde, hasta: s.hasta, camp: k.camp, anuncio: codigoDe(k), nombre: '', campana: '', estado: '', gasto: 0, impresiones: 0, alcance: 0, vistas3s: 0, thruplays: 0, clics: 0, conversaciones: 0, frecuencia: 0, leads: 0, reales: 0, hablo: 0, buenos: 0, agendo: 0, cliente: 0, moneda: 'USD' })

  let moneda = 'USD'
  let meta = 'sin conectar'
  if (metaListo()) {
    const act = cuentaMeta()
    const tiempo = encodeURIComponent(JSON.stringify({ since: s.desde, until: s.hasta }))
    const [cuenta, ins, est] = await Promise.all([
      graph(`${act}?fields=currency`),
      graph(`${act}/insights?level=ad&time_range=${tiempo}&fields=${CAMPOS}&filtering=${FILTRO}&limit=500`),
      estadosMeta(),
    ])
    moneda = cuenta.currency || 'USD'
    meta = 'ok'
    for (const f of filasMiSemago(ins)) {
      const k = claveDeAnuncio(f.anuncio, f.campana)
      if (!k) continue
      const x = (filas[llaveDe(k)] ??= nueva(k))
      for (const c of ['gasto', 'impresiones', 'alcance', 'vistas3s', 'thruplays', 'clics', 'conversaciones']) x[c] += f[c]
      x.frecuencia = Math.max(x.frecuencia, f.frecuencia)
      x.nombre = f.anuncio
      x.campana = f.campana
    }
    const VIVOS = ['ACTIVE', 'IN_PROCESS', 'PENDING_REVIEW', 'WITH_ISSUES', 'PREAPPROVED']
    for (const e of est) {
      const k = claveDeAnuncio(e.anuncio, e.campana)
      const x = k && filas[llaveDe(k)]
      if (x && (!x.estado || (VIVOS.includes(e.estado) && !VIVOS.includes(x.estado)))) x.estado = e.estado
    }
  }

  // Leads que llegaron esa semana y en qué van hoy (sin nombres, teléfonos ni conversación).
  const leads = await sb(`/rest/v1/leads?select=fuente,etapa,calificacion,permiso_llamada,meet_inicio&creado=gte.${s.iniISO}&creado=lt.${s.finISO}&limit=5000`, { servicio: true })
  for (const l of leads) {
    const k = claveDeFuente(l.fuente)
    if (!k) continue
    const x = (filas[llaveDe(k)] ??= nueva(k))
    const p = pasoDe(l)
    x.leads++
    if (p.real) x.reales++
    if (p.hablo) x.hablo++
    if (p.bueno) x.buenos++
    if (p.agendo) x.agendo++
    if (p.cliente) x.cliente++
  }

  return { meta, lista: Object.values(filas).map((x) => ({ ...x, moneda, gasto: Math.round(x.gasto * 100) / 100 })) }
}

/** Guarda la foto de un rango (por omisión, la última semana completa). */
export async function tomarFoto(hoy = new Date(), r = null) {
  const s = r || semanaPasada(hoy)
  const { meta, lista } = await calcular(s)
  if (lista.length) await sb('/rest/v1/anuncios_semanas?on_conflict=semana,camp,anuncio', { servicio: true, method: 'POST', body: lista, prefer: 'resolution=merge-duplicates,return=minimal' })
  return { semana: { desde: s.desde, hasta: s.hasta }, meta, anuncios: lista.length }
}

/** Las últimas semanas guardadas (más nueva primero). */
export const semanasGuardadas = (n = 26) => sb(`/rest/v1/anuncios_semanas?select=*&order=semana.desc,camp.asc,anuncio.asc&limit=${n * 40}`, { servicio: true })

/** Lo aprendido, lo más nuevo primero. */
export const aprendizajesGuardados = () => sb('/rest/v1/anuncios_aprendizajes?select=fecha,tipo,estado,titulo,texto,fuente&order=fecha.desc,creado.desc&limit=300', { servicio: true })
