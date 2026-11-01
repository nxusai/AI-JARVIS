// El administrador de los anuncios de NXUS en Meta. Una campaña por mercado
// ("[NXUS HQ] USA", "[NXUS HQ] México") con presupuesto de campaña (Meta lo
// reparte entre los anuncios), un conjunto con el público (ciudades, español,
// dueños de negocio) y hasta 3 anuncios activos, cada uno un video aprobado en
// HQ → Contenido que abre el chat de Messenger (ManyChat lo atiende).
// La cuenta de anuncios también la usan otros negocios: aquí solo se tocan las
// campañas que HQ creó (guardadas en anuncios_topes) y sus anuncios.
import { cuenta, graph, instagram, MARCA, pagina } from './meta.mjs'
import { sb, URL_SB } from './sb.mjs'

export const ACTIVOS = 3
// Dónde se anuncia (decidido el 1 de noviembre de 2026): en USA sin NJ ni NY.
const CIUDADES = {
  usa: ['Houston', 'Dallas', 'Fort Worth', 'San Antonio', 'Miami', 'Orlando', 'Los Angeles', 'Chicago', 'Phoenix'],
  mexico: ['Mexico City', 'Monterrey', 'Guadalajara', 'Queretaro', 'Puebla'],
}
const PAIS = { usa: 'US', mexico: 'MX' }
const NOMBRE = { usa: 'USA', mexico: 'México' }
const db = (path, opts = {}) => sb(path, { servicio: true, ...opts })

/** El público del conjunto: ciudades (40 km), sin NJ ni NY en USA, que hablan español, de 25 a 65. */
export async function publico(mercado) {
  const buscar = (q, tipo) => graph('search', { params: { type: 'adgeolocation', location_types: [tipo], q, country_code: PAIS[mercado], limit: 1 } }).then((r) => r.data?.[0])
  const ciudades = (await Promise.all(CIUDADES[mercado].map((c) => buscar(c, 'city')))).filter(Boolean)
  if (!ciudades.length) throw new Error(`Meta no encontró las ciudades de ${NOMBRE[mercado]}`)
  const t = {
    geo_locations: { cities: ciudades.map((c) => ({ key: c.key, radius: 40, distance_unit: 'kilometer' })), location_types: ['home', 'recent'] },
    age_min: 25,
    age_max: 65,
  }
  if (mercado === 'usa') {
    const fuera = (await Promise.all(['New Jersey', 'New York'].map((r) => buscar(r, 'region')))).filter(Boolean)
    if (fuera.length) t.excluded_geo_locations = { regions: fuera.map((r) => ({ key: r.key })) }
  }
  const idiomas = await graph('search', { params: { type: 'adlocale', q: 'Spanish' } })
  const es = (idiomas.data ?? []).filter((l) => /spanish/i.test(l.name)).map((l) => l.key)
  if (es.length) t.locales = es
  return t
}

/** La campaña y el conjunto del mercado: si no existen en Meta, se crean en pausa. */
export async function asegurarCampana(tope) {
  const m = tope.mercado
  let { campana_id: campana, conjunto_id: conjunto } = tope
  const diario = Math.max(100, Math.round((Number(tope.tope_mensual) / 30) * 100)) // centavos de USD
  if (!campana) {
    const c = await graph(`${cuenta()}/campaigns`, {
      method: 'POST',
      params: { name: `${MARCA} ${NOMBRE[m]}`, objective: 'OUTCOME_ENGAGEMENT', status: 'PAUSED', special_ad_categories: [], buying_type: 'AUCTION', daily_budget: diario, bid_strategy: 'LOWEST_COST_WITHOUT_CAP' },
    })
    campana = c.id
    await db(`/rest/v1/anuncios_topes?mercado=eq.${m}`, { method: 'PATCH', prefer: 'return=minimal', body: { campana_id: campana } })
  }
  if (!conjunto) {
    const a = await graph(`${cuenta()}/adsets`, {
      method: 'POST',
      params: {
        name: `${MARCA} ${NOMBRE[m]} · español · chat`,
        campaign_id: campana,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'CONVERSATIONS',
        destination_type: 'MESSENGER',
        promoted_object: { page_id: pagina() },
        targeting: await publico(m),
        status: 'PAUSED',
      },
    })
    conjunto = a.id
    await db(`/rest/v1/anuncios_topes?mercado=eq.${m}`, { method: 'PATCH', prefer: 'return=minimal', body: { conjunto_id: conjunto } })
  }
  return { campana, conjunto }
}

/** Un link temporal (6 horas) al video en el almacenamiento, para que Meta lo baje. */
async function linkTemporal(ruta) {
  const llave = process.env.SUPABASE_SERVICE_KEY
  const res = await fetch(`${URL_SB()}/storage/v1/object/sign/contenido/${ruta}`, {
    method: 'POST',
    headers: { apikey: llave, ...(/^eyJ/.test(llave) ? { authorization: `Bearer ${llave}` } : {}), 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: 21600 }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d.signedURL) throw new Error(`no se pudo preparar el video (${res.status})`)
  return `${URL_SB()}/storage/v1${d.signedURL}`
}

/** El siguiente código libre del mercado: U1, U2… / M1, M2… */
async function siguienteCodigo(mercado) {
  const letra = mercado === 'usa' ? 'U' : 'M'
  const hay = await db(`/rest/v1/anuncios?codigo=like.${letra}*&select=codigo`)
  const n = hay.reduce((max, a) => Math.max(max, Number(String(a.codigo).slice(1)) || 0), 0)
  return `${letra}${n + 1}`
}

/**
 * Prepara (en pausa) un anuncio a partir de un video aprobado de Contenido. Si
 * Meta todavía procesa el video, queda en borrador y se termina en otra vuelta.
 */
export async function prepararAnuncio(pieza, tope, conjunto) {
  let [ad] = await db(`/rest/v1/anuncios?id=eq.${pieza.anuncio_id ?? '00000000-0000-0000-0000-000000000000'}&select=*`)
  if (!ad) {
    const codigo = await siguienteCodigo(tope.mercado)
    ;[ad] = await db('/rest/v1/anuncios', {
      method: 'POST',
      prefer: 'return=representation',
      body: { nombre: `${NOMBRE[tope.mercado]} · ${pieza.titulo || 'Video'} (${codigo})`.slice(0, 200), mercado: tope.mercado, estado: 'borrador', codigo, motivo: 'Preparándose en Meta (en pausa).' },
    })
    await db(`/rest/v1/contenido?id=eq.${pieza.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { anuncio_id: ad.id } })
  }
  const guardar = (cambio) => db(`/rest/v1/anuncios?id=eq.${ad.id}`, { method: 'PATCH', prefer: 'return=minimal', body: cambio }).then(() => Object.assign(ad, cambio))
  if (!ad.meta_video_id) {
    const v = await graph(`${cuenta()}/advideos`, { method: 'POST', host: 'graph-video.facebook.com', params: { file_url: await linkTemporal(pieza.archivo), name: ad.nombre } })
    await guardar({ meta_video_id: v.id })
  }
  if (!ad.meta_creative_id) {
    const v = await graph(ad.meta_video_id, { params: { fields: 'status,picture' } })
    if (v.status?.video_status !== 'ready' || !v.picture) return { ad, listo: false } // Meta sigue procesando el video
    const cr = await graph(`${cuenta()}/adcreatives`, {
      method: 'POST',
      params: {
        name: ad.nombre,
        object_story_spec: {
          page_id: pagina(),
          instagram_user_id: instagram(),
          video_data: {
            video_id: ad.meta_video_id,
            image_url: v.picture,
            message: pieza.texto,
            call_to_action: { type: 'MESSAGE_PAGE', value: { app_destination: 'MESSENGER' } },
            // El botón que toca la persona lleva el código del anuncio: así HQ sabe qué anuncio la trajo.
            page_welcome_message: JSON.stringify({
              type: 'VISUAL_EDITOR',
              version: 2,
              landing_screen_type: 'welcome_message',
              media_type: 'text',
              text_format: {
                customer_action_type: 'ice_breakers',
                message: {
                  ice_breakers: [{ title: `Quiero información (${ad.codigo})`, response: '¡Claro! Ahora te ayudo 👇' }],
                  quick_replies: [],
                  text: 'Hola {{user_first_name}} 👋 Gracias por escribir a NXUS AI. Toca el botón para empezar.',
                },
              },
              user_edit: false,
              surface: 'visual_editor_new',
            }),
          },
        },
      },
    })
    await guardar({ meta_creative_id: cr.id })
  }
  if (!ad.meta_ad_id) {
    const a = await graph(`${cuenta()}/ads`, { method: 'POST', params: { name: ad.nombre, adset_id: conjunto, creative: { creative_id: ad.meta_creative_id }, status: 'PAUSED' } })
    await guardar({ meta_ad_id: a.id, motivo: 'Listo en Meta, en pausa: falta "✓ Lanzar".' })
  }
  return { ad, listo: true }
}

/** Activa en Meta la campaña, el conjunto y los anuncios listos del mercado. */
export async function lanzar(tope, presupuestoDia) {
  const listos = await db(`/rest/v1/anuncios?mercado=eq.${tope.mercado}&estado=eq.borrador&meta_ad_id=not.is.null&select=*`)
  for (const a of listos) {
    await graph(a.meta_ad_id, { method: 'POST', params: { status: 'ACTIVE' } })
    await db(`/rest/v1/anuncios?id=eq.${a.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { estado: 'activo', inicio: new Date().toISOString().slice(0, 10), motivo: 'Lanzado. Primeros 7 días: Meta aprende; no se juzga antes.' } })
  }
  await graph(tope.conjunto_id, { method: 'POST', params: { status: 'ACTIVE' } })
  await graph(tope.campana_id, { method: 'POST', params: { status: 'ACTIVE', daily_budget: Math.round(presupuestoDia * 100) } })
  await db(`/rest/v1/anuncios_topes?mercado=eq.${tope.mercado}`, { method: 'PATCH', prefer: 'return=minimal', body: { pausado_por_tope: false } })
  return listos.length
}

/** Lo gastado este mes por cada anuncio de HQ, día por día, desde Meta → anuncios_gasto. */
export async function traerGasto(topes) {
  const hoy = new Date()
  const desde = `${hoy.toISOString().slice(0, 7)}-01`
  const ads = await db('/rest/v1/anuncios?meta_ad_id=not.is.null&select=id,meta_ad_id')
  const porMeta = Object.fromEntries(ads.map((a) => [a.meta_ad_id, a.id]))
  for (const t of topes.filter((x) => x.campana_id)) {
    const r = await graph(`${t.campana_id}/insights`, {
      params: { level: 'ad', fields: 'ad_id,spend,impressions,clicks', time_range: { since: desde, until: hoy.toISOString().slice(0, 10) }, time_increment: 1, limit: 500 },
    })
    const filas = []
    const totales = {}
    for (const d of r.data ?? []) {
      const id = porMeta[d.ad_id]
      if (!id) continue
      filas.push({ anuncio_id: id, dia: d.date_start, gasto: Number(d.spend) || 0 })
      totales[id] ??= { impresiones: 0, clics: 0 }
      totales[id].impresiones += Number(d.impressions) || 0
      totales[id].clics += Number(d.clicks) || 0
    }
    if (filas.length) await db('/rest/v1/anuncios_gasto?on_conflict=anuncio_id,dia', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: filas })
    for (const [id, t2] of Object.entries(totales)) await db(`/rest/v1/anuncios?id=eq.${id}`, { method: 'PATCH', prefer: 'return=minimal', body: t2 })
  }
}

/** Lo gastado este mes en un mercado (desde anuncios_gasto). */
export async function gastadoMes(mercado) {
  const desde = `${new Date().toISOString().slice(0, 7)}-01`
  const ads = await db(`/rest/v1/anuncios?mercado=eq.${mercado}&select=id`)
  if (!ads.length) return 0
  const g = await db(`/rest/v1/anuncios_gasto?dia=gte.${desde}&anuncio_id=in.(${ads.map((a) => a.id).join(',')})&select=gasto`)
  return g.reduce((s, x) => s + Number(x.gasto), 0)
}

/** Lo que se puede gastar por día lo que queda del mes sin pasarse del tope. */
export function presupuestoDiario(tope, gastado, fecha = new Date()) {
  const dias = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate()
  const quedan = Math.max(1, dias - fecha.getDate() + 1)
  return Math.max(0, Math.round(((Number(tope.tope_mensual) - gastado) / quedan) * 100) / 100)
}
