// Los botones de HQ → Anuncios: "Preparar" (crea en Meta, en pausa, la campaña,
// el público y un anuncio por cada video aprobado, hasta 3 por mercado),
// "✓ Lanzar" (los prende, con el presupuesto que cabe en el tope del mes) y
// "⏸ Pausar". Corre en segundo plano (puede tardar): lo que pasa queda en
// anuncios_topes.aviso y HQ lo enseña. Solo el admin.
import { ACTIVOS, asegurarCampana, gastadoMes, lanzar, prepararAnuncio, presupuestoDiario } from '../lib/anuncios.mjs'
import { graph, metaListo } from '../lib/meta.mjs'
import { quien, sb } from '../lib/sb.mjs'

const db = (path, opts = {}) => sb(path, { servicio: true, ...opts })
const avisar = (mercado, aviso) => db(`/rest/v1/anuncios_topes?mercado=eq.${mercado}`, { method: 'PATCH', prefer: 'return=minimal', body: { aviso: String(aviso).slice(0, 1000) } })

export default async (req) => {
  const yo = await quien(req)
  if (!yo || yo.perfil.rol !== 'admin' || !metaListo()) return
  const { accion, mercado } = await req.json().catch(() => ({}))
  if (!['usa', 'mexico'].includes(mercado)) return
  const [tope] = await db(`/rest/v1/anuncios_topes?mercado=eq.${mercado}&select=*`)
  if (!tope) return
  try {
    if (accion === 'preparar') {
      await avisar(mercado, '⏳ Preparando en Meta (en pausa)…')
      const { conjunto } = await asegurarCampana(tope)
      // Los videos aprobados que todavía no son anuncio (o que quedaron a medias), hasta completar 3 activos.
      const ads = await db(`/rest/v1/anuncios?mercado=eq.${mercado}&select=id,estado`)
      const estado = Object.fromEntries(ads.map((a) => [a.id, a.estado]))
      const activos = ads.filter((a) => a.estado === 'activo').length
      const piezas = await db(
        `/rest/v1/contenido?uso=eq.anuncio&tipo=eq.video&estado=in.(aprobado,publicado)&mercado=in.(${mercado},ambos)&archivo=neq.&texto=neq.&select=*&order=creado.asc`,
      )
      const nuevos = piezas.filter((p) => !p.anuncio_id || estado[p.anuncio_id] === 'borrador').slice(0, Math.max(0, ACTIVOS - activos))
      if (activos >= ACTIVOS) return await avisar(mercado, `Ya hay ${activos} anuncios activos.`)
      if (!nuevos.length) return await avisar(mercado, 'No hay videos de anuncio aprobados para este mercado. Sube o aprueba al menos uno en Contenido (Para: Anuncio).')
      let listos = 0
      for (const p of nuevos) if ((await prepararAnuncio(p, { ...tope }, conjunto)).listo) listos++
      const faltan = nuevos.length - listos
      await avisar(mercado, `✓ ${listos} anuncio(s) listos en Meta, en pausa.${faltan ? ` ${faltan} se terminan solos cuando Meta acabe de procesar el video (unos minutos).` : ''} Revisa y da "✓ Lanzar".`)
    } else if (accion === 'lanzar') {
      const [t] = await db(`/rest/v1/anuncios_topes?mercado=eq.${mercado}&select=*`)
      if (!t.campana_id) return await avisar(mercado, 'Primero "Preparar".')
      const gastado = await gastadoMes(mercado)
      const diario = presupuestoDiario(t, gastado)
      if (diario < 1) return await avisar(mercado, `No se lanzó: ya se gastó el tope del mes (${gastado.toFixed(2)} de ${t.tope_mensual} USD).`)
      const n = await lanzar(t, diario)
      await avisar(mercado, `🚀 Lanzado: ${n} anuncio(s) activos · ${diario.toFixed(2)} USD al día (para no pasar de ${t.tope_mensual} USD en el mes).`)
    } else if (accion === 'pausar') {
      if (tope.campana_id) await graph(tope.campana_id, { method: 'POST', params: { status: 'PAUSED' } })
      await avisar(mercado, '⏸ Pausado por Eduardo: no se gasta nada hasta "✓ Lanzar".')
    }
  } catch (err) {
    await avisar(mercado, `⚠ ${err.message}`)
  }
}
