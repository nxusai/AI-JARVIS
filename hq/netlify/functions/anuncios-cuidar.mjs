// Cada hora: cuida los anuncios de HQ en Meta.
//  1. Trae lo gastado de cada anuncio (día por día) → HQ → Anuncios.
//  2. El tope del mes es duro: si ya se gastó, pausa la campaña hasta el mes
//     siguiente; si no, ajusta el presupuesto diario a lo que cabe.
//  3. Termina los anuncios que esperaban a que Meta procesara su video y, si
//     el mercado ya está lanzado, los prende.
//  4. Los lunes (7 a.m. de Nueva York): tumba lo que no funciona (7 días, 40
//     USD y 0 leads calificados) y lo reemplaza con el siguiente video
//     aprobado; anota en cada anuncio el porqué. Al que funciona, Meta le pasa
//     más presupuesto (presupuesto de campaña) y aquí se anota.
import { ACTIVOS, gastadoMes, prepararAnuncio, presupuestoDiario, traerGasto } from '../lib/anuncios.mjs'
import { graph, metaListo } from '../lib/meta.mjs'
import { sb } from '../lib/sb.mjs'

export const config = { schedule: '0 * * * *' }

const db = (path, opts = {}) => sb(path, { servicio: true, ...opts })
const usd = (n) => `${Number(n).toFixed(2)} USD`

async function cuidarMercado(t, lunes) {
  const m = t.mercado
  const gastado = await gastadoMes(m)
  const ads = await db(`/rest/v1/anuncios?mercado=eq.${m}&select=*`)
  const lanzado = ads.some((a) => a.estado === 'activo')

  // 2. El tope.
  if (lanzado && gastado >= Number(t.tope_mensual) - 0.5) {
    if (!t.pausado_por_tope) {
      await graph(t.campana_id, { method: 'POST', params: { status: 'PAUSED' } })
      await db(`/rest/v1/anuncios_topes?mercado=eq.${m}`, { method: 'PATCH', prefer: 'return=minimal', body: { pausado_por_tope: true, aviso: `⏸ Se llegó al tope del mes (${usd(gastado)}). Se reanuda solo el día 1.` } })
    }
    return
  }
  if (t.pausado_por_tope && new Date().getDate() === 1) {
    await graph(t.campana_id, { method: 'POST', params: { status: 'ACTIVE' } })
    await db(`/rest/v1/anuncios_topes?mercado=eq.${m}`, { method: 'PATCH', prefer: 'return=minimal', body: { pausado_por_tope: false, aviso: '▶ Mes nuevo: anuncios reanudados.' } })
  }
  if (lanzado && !t.pausado_por_tope) {
    const diario = presupuestoDiario(t, gastado)
    const c = await graph(t.campana_id, { params: { fields: 'daily_budget' } })
    if (Math.abs(Number(c.daily_budget) / 100 - diario) / Math.max(diario, 1) > 0.1) await graph(t.campana_id, { method: 'POST', params: { daily_budget: Math.round(diario * 100) } })
  }

  // 3. Borradores esperando el video.
  for (const a of ads.filter((x) => x.estado === 'borrador' && !x.meta_ad_id)) {
    const [p] = await db(`/rest/v1/contenido?anuncio_id=eq.${a.id}&select=*`)
    if (p) await prepararAnuncio(p, t, t.conjunto_id).catch(() => null)
  }
  if (lanzado) {
    for (const a of await db(`/rest/v1/anuncios?mercado=eq.${m}&estado=eq.borrador&meta_ad_id=not.is.null&select=*`)) {
      await graph(a.meta_ad_id, { method: 'POST', params: { status: 'ACTIVE' } })
      await db(`/rest/v1/anuncios?id=eq.${a.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { estado: 'activo', inicio: new Date().toISOString().slice(0, 10), motivo: 'Entró de reemplazo. Primeros 7 días: Meta aprende.' } })
    }
  }

  // 4. Los lunes: decidir.
  if (!lunes || !lanzado) return
  const desde = `${new Date().toISOString().slice(0, 7)}-01`
  const gastos = await db(`/rest/v1/anuncios_gasto?dia=gte.${desde}&select=anuncio_id,gasto`)
  const leads = await db('/rest/v1/leads?anuncio_id=neq.&estado=neq.incompleto&select=anuncio_id,estado,prospecto_id')
  let tumbados = 0
  for (const a of ads.filter((x) => x.estado === 'activo')) {
    const g = gastos.filter((x) => x.anuncio_id === a.id).reduce((s, x) => s + Number(x.gasto), 0)
    const suyos = leads.filter((l) => l.anuncio_id === a.meta_ad_id)
    const dias = a.inicio ? Math.floor((Date.now() - new Date(a.inicio)) / 864e5) : 0
    if (dias >= 7 && g >= 40 && !suyos.length) {
      await graph(a.meta_ad_id, { method: 'POST', params: { status: 'PAUSED' } })
      await db(`/rest/v1/anuncios?id=eq.${a.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { estado: 'pausado', fin: new Date().toISOString().slice(0, 10), motivo: `Tumbado: ${dias} días, ${usd(g)} gastados y 0 leads calificados.` } })
      tumbados++
    } else if (suyos.length) {
      const meetings = suyos.filter((l) => l.estado === 'agendado' || l.prospecto_id).length
      await db(`/rest/v1/anuncios?id=eq.${a.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { motivo: `Funciona: ${suyos.length} lead(s)${meetings ? ` y ${meetings} meeting(s)` : ''} a ${usd(g / suyos.length)} por lead. Meta le pasa más presupuesto.` } })
    } else {
      const motivo = dias < 7 ? `En aprendizaje (${dias} de 7 días, ${usd(g)}).` : `Sin leads todavía: ${dias} días y ${usd(g)}. Se decide al llegar a 40 USD.`
      await db(`/rest/v1/anuncios?id=eq.${a.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { motivo } })
    }
  }
  // Reemplazos: los siguientes videos aprobados, hasta tener 3.
  const activos = ads.filter((x) => x.estado === 'activo').length - tumbados
  if (activos < ACTIVOS) {
    const piezas = await db(`/rest/v1/contenido?uso=eq.anuncio&tipo=eq.video&estado=in.(aprobado,publicado)&mercado=in.(${m},ambos)&archivo=neq.&texto=neq.&anuncio_id=is.null&select=*&order=creado.asc`)
    for (const p of piezas.slice(0, ACTIVOS - activos)) await prepararAnuncio(p, t, t.conjunto_id).catch(() => null)
    const faltan = ACTIVOS - activos - piezas.length
    if (faltan > 0) await db(`/rest/v1/anuncios_topes?mercado=eq.${m}`, { method: 'PATCH', prefer: 'return=minimal', body: { aviso: `⚠ Faltan ${faltan} video(s) de anuncio aprobados para tener ${ACTIVOS} activos.` } })
  }
}

export default async () => {
  if (!process.env.SUPABASE_SERVICE_KEY || !metaListo()) return new Response('Meta sin conectar')
  const topes = await db('/rest/v1/anuncios_topes?campana_id=neq.&select=*')
  if (!topes.length) return new Response('sin campañas')
  await traerGasto(topes).catch((err) => console.log('gasto:', err.message))
  const ny = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date())
  const lunes = ny.find((p) => p.type === 'weekday')?.value === 'Mon' && Number(ny.find((p) => p.type === 'hour')?.value) === 7
  for (const t of topes) {
    try {
      await cuidarMercado(t, lunes)
    } catch (err) {
      await db(`/rest/v1/anuncios_topes?mercado=eq.${t.mercado}`, { method: 'PATCH', prefer: 'return=minimal', body: { aviso: `⚠ ${err.message}`.slice(0, 1000) } })
    }
  }
  return new Response('listo')
}
