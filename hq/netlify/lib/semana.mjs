// La "foto" semanal de los anuncios: por cada anuncio, lo de Meta de esa semana
// (gastado, vistas, gancho, chats) + lo que pasó en HQ con los leads que llegaron
// esa semana (reales, NEX habló, agendó, llegó al Meet, cliente). Se guarda en
// la tabla anuncios_semanas para que el historial no dependa de Meta.
// Solo lee Meta; solo escribe en anuncios_semanas.
import { sb } from './sb.mjs'
import { graph, fila, estadosMeta, metaListo, cuentaMeta, FILTRO, CAMPOS } from './meta.mjs'
import { claveDeFuente, claveDeAnuncio } from '../../public/anuncios-claves.js'

const ASISTIO = ['reunion', 'propuesta', 'cliente']
const dia = (d) => d.toISOString().slice(0, 10)

/** La semana que se cierra: los 7 días completos antes de hoy (de lunes a domingo si corre en lunes). */
export function semanaPasada(hoy = new Date()) {
  const fin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())) // hoy 00:00 UTC (no se cuenta)
  const ini = new Date(fin.getTime() - 7 * 864e5)
  return { desde: dia(ini), hasta: dia(new Date(fin.getTime() - 864e5)), iniISO: ini.toISOString(), finISO: fin.toISOString() }
}

export async function tomarFoto(hoy = new Date()) {
  const s = semanaPasada(hoy)
  const filas = {}
  const llave = (k) => `${k.camp}-${k.video}`
  const nueva = (k) => ({ semana: s.desde, hasta: s.hasta, camp: k.camp, anuncio: k.video, nombre: '', campana: '', estado: '', gasto: 0, impresiones: 0, alcance: 0, vistas3s: 0, thruplays: 0, clics: 0, conversaciones: 0, frecuencia: 0, leads: 0, reales: 0, hablo: 0, agendo: 0, asistio: 0, cliente: 0, moneda: 'USD' })

  let moneda = 'USD'
  let meta = 'sin conectar'
  if (metaListo()) {
    const act = cuentaMeta()
    const rango = encodeURIComponent(JSON.stringify({ since: s.desde, until: s.hasta }))
    const [cuenta, ins, est] = await Promise.all([
      graph(`${act}?fields=currency`),
      graph(`${act}/insights?level=ad&time_range=${rango}&fields=${CAMPOS}&filtering=${FILTRO}&limit=500`),
      estadosMeta(),
    ])
    moneda = cuenta.currency || 'USD'
    meta = 'ok'
    for (const f of (ins.data || []).map(fila)) {
      const k = claveDeAnuncio(f.anuncio, f.campana)
      if (!k) continue
      const x = (filas[llave(k)] ??= nueva(k))
      for (const c of ['gasto', 'impresiones', 'alcance', 'vistas3s', 'thruplays', 'clics', 'conversaciones']) x[c] += f[c]
      x.frecuencia = Math.max(x.frecuencia, f.frecuencia)
      x.nombre = f.anuncio
      x.campana = f.campana
    }
    const VIVOS = ['ACTIVE', 'IN_PROCESS', 'PENDING_REVIEW', 'WITH_ISSUES', 'PREAPPROVED']
    for (const e of est) {
      const k = claveDeAnuncio(e.anuncio, e.campana)
      const x = k && filas[llave(k)]
      if (x && (!x.estado || (VIVOS.includes(e.estado) && !VIVOS.includes(x.estado)))) x.estado = e.estado
    }
  }

  // Leads que llegaron esa semana y en qué van hoy.
  const leads = await sb(`/rest/v1/leads?select=fuente,estado,llamada_seg,prospecto_id&creado=gte.${s.iniISO}&creado=lt.${s.finISO}`, { servicio: true })
  const ids = [...new Set(leads.map((l) => l.prospecto_id).filter(Boolean))]
  const pros = ids.length ? Object.fromEntries((await sb(`/rest/v1/prospectos?select=id,etapa&id=in.(${ids.join(',')})`, { servicio: true })).map((p) => [p.id, p.etapa])) : {}
  for (const l of leads) {
    const k = claveDeFuente(l.fuente)
    if (!k) continue
    const x = (filas[llave(k)] ??= nueva(k))
    x.leads++
    if (l.estado !== 'incompleto') x.reales++
    if ((l.llamada_seg ?? 0) >= 20) x.hablo++
    if (l.estado === 'agendado' || l.prospecto_id) {
      x.agendo++
      if (ASISTIO.includes(pros[l.prospecto_id])) x.asistio++
      if (pros[l.prospecto_id] === 'cliente') x.cliente++
    }
  }

  const lista = Object.values(filas).map((x) => ({ ...x, moneda, gasto: Math.round(x.gasto * 100) / 100 }))
  if (lista.length) await sb('/rest/v1/anuncios_semanas?on_conflict=semana,camp,anuncio', { servicio: true, method: 'POST', body: lista, prefer: 'resolution=merge-duplicates,return=minimal' })
  return { semana: s, meta, anuncios: lista.length }
}

/** Las últimas semanas guardadas (más nueva primero). */
export const semanasGuardadas = (n = 26) => sb(`/rest/v1/anuncios_semanas?select=*&order=semana.desc,camp.asc,anuncio.asc&limit=${n * 40}`, { servicio: true })
