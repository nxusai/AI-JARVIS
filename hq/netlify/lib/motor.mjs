// El motor de NXUS HQ: publica en el feed (Facebook e Instagram) y pone los
// anuncios al aire en Meta. Corre UNA vez a la vez (candado en Supabase), así
// nada se duplica aunque Eduardo apruebe algo mientras corre la revisión
// automática. Lo despiertan HQ (al aprobar, subir o cambiar algo) y la
// revisión programada de cada 5 minutos (functions/publicar.mjs). Cada 15
// minutos además trae lo gastado de Meta y cuida el tope del mes.
//
// Contenido aprobado sin fecha (o con su fecha ya cumplida):
//   · Feed: se publica en Facebook y en Instagram (una sola vez en cada uno).
//   · Si es anuncio: se crea en Meta (un anuncio por pieza y por mercado, nunca
//     dos) y se prende en cuanto Meta termina de procesar el video, dentro del
//     tope del mes. Si reemplaza a otro anuncio, el otro se pausa.
import { createHash } from 'node:crypto'
import { asegurarCampana, gastadoMes, prepararAnuncio, presupuestoDiario, siguienteCodigo, traerGasto } from './anuncios.mjs'
import { graph, instagram, llaveDePagina, metaListo, pagina } from './meta.mjs'
import { sb, URL_SB } from './sb.mjs'

const db = (path, opts = {}) => sb(path, { servicio: true, ...opts })
const rpc = (fn, args) => db(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args })
const usd = (n) => `${Number(n).toFixed(2)} USD`
const hoy = () => new Date().toISOString().slice(0, 10)
const NOMBRE = { usa: 'USA', mexico: 'México' }

/** La clave con la que las revisiones programadas despiertan al motor (sale de la llave de servicio; no hay que guardarla). */
export const claveMotor = () => createHash('sha256').update(`nxus-motor:${process.env.SUPABASE_SERVICE_KEY || ''}`).digest('hex')

/** Despierta al motor en segundo plano (desde una revisión programada). */
export async function despertarMotor(body = {}, funcion = 'motor-background') {
  const base = (process.env.URL || 'https://nxus-hq.netlify.app').replace(/\/$/, '')
  const res = await fetch(`${base}/.netlify/functions/${funcion}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-motor': claveMotor() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  return res.status
}

// ------------------------------------------------------------------ candado

const marca = async () => (await db('/rest/v1/candados?nombre=eq.motor&select=pedido'))[0]?.pedido ?? ''

/**
 * Corre fn con el candado del motor. Si otro lo tiene, espera hasta "esperar"
 * segundos; si no se libera, regresa false (la otra vuelta verá lo pedido).
 */
export async function conCandado(fn, { esperar = 0 } = {}) {
  const hasta = Date.now() + esperar * 1000
  while (!(await rpc('tomar_candado', { n: 'motor', segundos: 900 }))) {
    if (Date.now() >= hasta) return false
    await new Promise((r) => setTimeout(r, 3000))
  }
  try {
    await fn()
  } finally {
    await rpc('soltar_candado', { n: 'motor' }).catch(() => null)
  }
  return true
}

/** Una vuelta completa; si mientras corría alguien pidió otra (aprobó algo), da otra. */
export async function correrMotor() {
  await rpc('pedir_candado', { n: 'motor' })
  let ultima = ''
  const corrio = await conCandado(async () => {
    for (let vuelta = 0; vuelta < 5; vuelta++) {
      ultima = await marca()
      await vueltaCompleta()
      if ((await marca()) === ultima) break
    }
  })
  // Si llegó un pedido justo al soltar el candado, una vuelta más.
  if (corrio && (await marca()) !== ultima) await conCandado(() => vueltaCompleta())
  return corrio
}

/**
 * Las piezas sin texto (el video que subió Eduardo): la IA las ve y escribe en el servidor,
 * aunque nadie tenga HQ abierto. Si un intento se atoró más de 12 minutos, otra vez.
 * Las que fallaron (⚠) esperan a que Eduardo dé "✦ Escribir texto", para no gastar en ciclo.
 */
async function escribirFaltantes() {
  const piezas = await db('/rest/v1/contenido?estado=in.(aprobado,por_aprobar)&texto=eq.&archivo=neq.&select=id,idea,actualizado&order=creado.asc&limit=5')
  for (const c of piezas) {
    if (/^⚠/.test(c.idea)) continue
    if (/^👀/.test(c.idea) && Date.now() - new Date(c.actualizado) < 12 * 60e3) continue
    await despertarMotor({ id: c.id }, 'analizar-background').catch((err) => console.log('analizar:', err.message))
  }
}

async function vueltaCompleta() {
  await escribirFaltantes().catch((err) => console.log('faltantes:', err.message))
  await publicarFeed().catch((err) => console.log('feed:', err.message))
  if (!metaListo()) return
  // Cada 15 minutos (el candado "cuidar" dura 14): lo gastado, el tope y el presupuesto diario.
  const cuidar = await rpc('tomar_candado', { n: 'cuidar', segundos: 840 })
  const topes = await db('/rest/v1/anuncios_topes?select=*')
  if (cuidar) await traerGasto(topes.filter((t) => t.campana_id)).catch((err) => console.log('gasto:', err.message))
  for (const t of topes) {
    try {
      await anunciosDelMercado(t, { cuidar })
    } catch (err) {
      await avisar(t.mercado, `⚠ ${err.message}`)
    }
  }
}

const avisar = (mercado, aviso) => db(`/rest/v1/anuncios_topes?mercado=eq.${mercado}`, { method: 'PATCH', prefer: 'return=minimal', body: { aviso: String(aviso).slice(0, 1000) } })

// --------------------------------------------------------------------- feed

/** Un link temporal (3 horas) al archivo, para que Meta lo descargue. */
async function linkTemporal(ruta) {
  const llave = process.env.SUPABASE_SERVICE_KEY
  const res = await fetch(`${URL_SB()}/storage/v1/object/sign/contenido/${ruta}`, {
    method: 'POST',
    headers: { apikey: llave, ...(/^eyJ/.test(llave) ? { authorization: `Bearer ${llave}` } : {}), 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: 10800 }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d.signedURL) throw new Error(`no se pudo preparar el archivo (${res.status})`)
  return `${URL_SB()}/storage/v1${d.signedURL}`
}

const guardarPieza = (id, cambio) => db(`/rest/v1/contenido?id=eq.${id}`, { method: 'PATCH', prefer: 'return=minimal', body: cambio })
const mismo = (a, b) => String(a ?? '').trim() === String(b ?? '').trim()

/** Si un intento anterior se cortó, ¿la publicación ya está en Facebook? */
async function yaEnFacebook(c, llave) {
  const video = c.tipo === 'video'
  const r = await graph(`${pagina()}/${video ? 'videos' : 'photos'}`, { token: llave, params: video ? { fields: 'id,description', limit: 25 } : { type: 'uploaded', fields: 'id,name', limit: 25 } })
  return (r.data ?? []).find((x) => mismo(video ? x.description : x.name, c.texto))?.id ?? ''
}
/** Si un intento anterior se cortó, ¿la publicación ya está en Instagram? */
async function yaEnInstagram(c) {
  const r = await graph(`${instagram()}/media`, { params: { fields: 'id,caption', limit: 25 } })
  return (r.data ?? []).find((x) => mismo(x.caption, c.texto))?.id ?? ''
}

/** Avanza una pieza lo más que se pueda. true si ya está en los dos. */
async function avanzar(c, llave) {
  const video = c.tipo === 'video'
  if (!c.publicado_fb) {
    const ya = c.fb_intento ? await yaEnFacebook(c, llave) : ''
    if (ya) c.publicado_fb = ya
    else {
      await guardarPieza(c.id, { fb_intento: new Date().toISOString() })
      const url = await linkTemporal(c.archivo)
      const r = video
        ? await graph(`${pagina()}/videos`, { method: 'POST', host: 'graph-video.facebook.com', token: llave, timeout: 180_000, params: { file_url: url, description: c.texto, title: c.titulo.slice(0, 100) } })
        : await graph(`${pagina()}/photos`, { method: 'POST', token: llave, timeout: 60_000, params: { url, caption: c.texto, published: true } })
      c.publicado_fb = String(r.post_id || r.id)
    }
    await guardarPieza(c.id, { publicado_fb: c.publicado_fb })
  }
  if (!c.publicado_ig) {
    const ya = c.ig_intento ? await yaEnInstagram(c) : ''
    if (ya) {
      c.publicado_ig = ya
      await guardarPieza(c.id, { publicado_ig: ya, ig_contenedor: '' })
      return true
    }
    if (!c.ig_contenedor) {
      const url = await linkTemporal(c.archivo)
      const r = await graph(`${instagram()}/media`, {
        method: 'POST',
        timeout: 60_000,
        params: video ? { media_type: 'REELS', video_url: url, caption: c.texto, share_to_feed: true } : { image_url: url, caption: c.texto },
      })
      c.ig_contenedor = r.id
      await guardarPieza(c.id, { ig_contenedor: c.ig_contenedor })
    }
    let { status_code: estado } = await graph(c.ig_contenedor, { params: { fields: 'status_code' } })
    // Una foto o un video corto suelen estar listos en segundos: se espera un poco antes de dejarlo para la siguiente vuelta.
    for (let i = 0; i < 6 && estado === 'IN_PROGRESS'; i++) {
      await new Promise((r) => setTimeout(r, video ? 10_000 : 3000))
      ;({ status_code: estado } = await graph(c.ig_contenedor, { params: { fields: 'status_code' } }))
    }
    if (estado === 'ERROR' || estado === 'EXPIRED') {
      await guardarPieza(c.id, { ig_contenedor: '' })
      throw new Error(`Instagram no pudo procesar el ${video ? 'video' : 'archivo'} (${estado}). Revisa formato: video vertical MP4, foto JPG.`)
    }
    if (estado !== 'FINISHED') return false // Instagram sigue preparando el video: en la siguiente vuelta
    await guardarPieza(c.id, { ig_intento: new Date().toISOString() })
    const r = await graph(`${instagram()}/media_publish`, { method: 'POST', timeout: 60_000, params: { creation_id: c.ig_contenedor } })
    c.publicado_ig = String(r.id)
    await guardarPieza(c.id, { publicado_ig: c.publicado_ig, ig_contenedor: '' })
  }
  return true
}

/** Lo aprobado que ya le toca (o no tiene fecha) sale al feed de Facebook e Instagram. */
export async function publicarFeed() {
  if (!metaListo()) return
  const ahora = new Date().toISOString()
  const piezas = await db(`/rest/v1/contenido?estado=eq.aprobado&error=eq.&archivo=neq.&texto=neq.&or=(publicar_en.is.null,publicar_en.lte.${ahora})&select=*&order=publicar_en.asc.nullsfirst&limit=10`)
  if (!piezas.length) return
  const llave = await llaveDePagina()
  for (const c of piezas) {
    try {
      if (await avanzar(c, llave)) await guardarPieza(c.id, { estado: 'publicado', publicar_en: c.publicar_en ?? new Date().toISOString() })
    } catch (err) {
      await guardarPieza(c.id, { error: `No se pudo publicar: ${err.message}`.slice(0, 1000) })
    }
  }
}

// ---------------------------------------------------------------- anuncios

const yaToca = (p) => !p.publicar_en || new Date(p.publicar_en) <= new Date()
const fechaNY = (d) => new Intl.DateTimeFormat('es-MX', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d))

/** La fila del anuncio de esta pieza en este mercado (la crea si no hay; nunca dos). */
async function anuncioDe(p, t) {
  const buscar = async () => (await db(`/rest/v1/anuncios?contenido_id=eq.${p.id}&mercado=eq.${t.mercado}&select=*`))[0]
  const hay = await buscar()
  if (hay) return hay
  for (let intento = 0; intento < 3; intento++) {
    const codigo = await siguienteCodigo(t.mercado)
    try {
      const [ad] = await db('/rest/v1/anuncios', {
        method: 'POST',
        prefer: 'return=representation',
        body: { contenido_id: p.id, nombre: `${NOMBRE[t.mercado]} · ${p.titulo || 'Video'} (${codigo})`.slice(0, 200), mercado: t.mercado, estado: 'borrador', codigo, motivo: 'Preparándose en Meta…' },
      })
      if (!p.anuncio_id) await guardarPieza(p.id, { anuncio_id: ad.id })
      return ad
    } catch (err) {
      if (err.status !== 409) throw err
      const ya = await buscar() // ya existía (de esta pieza y mercado): se usa ese
      if (ya) return ya
    }
  }
  throw new Error('no se pudo crear el anuncio (código repetido)')
}

const guardarAd = (ad, cambio) => db(`/rest/v1/anuncios?id=eq.${ad.id}`, { method: 'PATCH', prefer: 'return=minimal', body: cambio }).then(() => Object.assign(ad, cambio))

/** Prende el anuncio (y su campaña) si el mercado no está pausado y cabe en el tope. */
async function alAire(ad, p, t) {
  if (t.pausado_manual) return guardarAd(ad, { motivo: 'Listo en Meta. No sale porque pausaste este mercado: dale "▶ Reanudar" en Anuncios.' })
  const gastado = await gastadoMes(t.mercado)
  const diario = presupuestoDiario(t, gastado)
  if (t.pausado_por_tope || diario < 1) return guardarAd(ad, { motivo: `Listo en Meta. Ya se gastó el tope del mes (${usd(gastado)}): sale al aire el día 1.` })
  await graph(ad.meta_ad_id, { method: 'POST', params: { status: 'ACTIVE' } })
  await graph(t.conjunto_id, { method: 'POST', params: { status: 'ACTIVE' } })
  await graph(t.campana_id, { method: 'POST', params: { status: 'ACTIVE', daily_budget: Math.round(diario * 100) } })
  let reemplazo = ''
  if (p.reemplaza) {
    const [viejo] = await db(`/rest/v1/anuncios?id=eq.${p.reemplaza}&mercado=eq.${t.mercado}&estado=eq.activo&select=*`)
    if (viejo?.meta_ad_id) {
      await graph(viejo.meta_ad_id, { method: 'POST', params: { status: 'PAUSED' } })
      await guardarAd(viejo, { estado: 'pausado', fin: hoy(), recomendacion: '', motivo: `Reemplazado por ${ad.codigo}. ${viejo.motivo}`.slice(0, 1000) })
      reemplazo = `Entró en lugar de ${viejo.codigo}. `
    }
  }
  await guardarAd(ad, { estado: 'activo', inicio: hoy(), presupuesto_dia: diario, recomendacion: 'esperar', motivo: `${reemplazo}Al aire desde el ${fechaNY(new Date())} · los primeros 7 días Meta aprende.` })
  await avisar(t.mercado, `🚀 ${ad.codigo} al aire · campaña a ${usd(diario)} al día (sin pasar de ${usd(t.tope_mensual)} en el mes).`)
}

async function anunciosDelMercado(t, { cuidar }) {
  const m = t.mercado
  const gastado = await gastadoMes(m)
  const lleno = gastado >= Number(t.tope_mensual) - 0.5

  // 1. El tope del mes es duro. Al empezar el mes (lo gastado vuelve a 0) se reanuda solo.
  if (t.campana_id) {
    if (lleno && (!t.pausado_por_tope || cuidar)) {
      const c = await graph(t.campana_id, { params: { fields: 'status' } })
      if (c.status !== 'PAUSED') await graph(t.campana_id, { method: 'POST', params: { status: 'PAUSED' } })
      if (!t.pausado_por_tope) {
        t.pausado_por_tope = true
        await db(`/rest/v1/anuncios_topes?mercado=eq.${m}`, { method: 'PATCH', prefer: 'return=minimal', body: { pausado_por_tope: true, aviso: `⏸ Se llegó al tope del mes (${usd(gastado)}). Se reanuda solo el día 1.` } })
      }
    } else if (!lleno && t.pausado_por_tope) {
      t.pausado_por_tope = false
      await db(`/rest/v1/anuncios_topes?mercado=eq.${m}`, { method: 'PATCH', prefer: 'return=minimal', body: { pausado_por_tope: false, aviso: '▶ Mes nuevo: anuncios reanudados.' } })
      const activos = await db(`/rest/v1/anuncios?mercado=eq.${m}&estado=eq.activo&select=id`)
      if (activos.length && !t.pausado_manual) await graph(t.campana_id, { method: 'POST', params: { status: 'ACTIVE', daily_budget: Math.round(presupuestoDiario(t, gastado) * 100) } })
    }
  }

  // 2. Cada video de anuncio aprobado → su anuncio en Meta → al aire en su fecha.
  const piezas = await db(`/rest/v1/contenido?uso=eq.anuncio&tipo=eq.video&estado=in.(aprobado,publicado)&mercado=in.(${m},ambos)&archivo=neq.&texto=neq.&select=*&order=creado.asc`)
  for (const p of piezas) {
    let ad
    try {
      ad = await anuncioDe(p, t)
      if (ad.estado !== 'borrador') continue
      if (!ad.meta_ad_id) {
        const { conjunto } = await asegurarCampana(t)
        if (!(await prepararAnuncio(p, t, conjunto, ad)).listo) {
          await guardarAd(ad, { motivo: 'Meta está procesando el video (unos minutos)…' })
          continue
        }
      }
      if (yaToca(p)) await alAire(ad, p, t)
      else await guardarAd(ad, { motivo: `Listo en Meta, en pausa: sale al aire el ${fechaNY(p.publicar_en)}` })
    } catch (err) {
      if (ad) await guardarAd(ad, { motivo: `⚠ ${err.message}`.slice(0, 1000) }).catch(() => null)
      await avisar(m, `⚠ ${ad?.codigo ?? p.titulo ?? 'Anuncio'}: ${err.message}`)
    }
  }

  // 3. Borradores cuya pieza se borró: fuera de Meta (nunca estuvieron al aire).
  for (const a of await db(`/rest/v1/anuncios?mercado=eq.${m}&estado=eq.borrador&contenido_id=is.null&select=*`)) {
    if (a.meta_ad_id) await graph(a.meta_ad_id, { method: 'POST', params: { status: 'DELETED' } }).catch(() => null)
    await guardarAd(a, { estado: 'terminado', fin: hoy(), motivo: 'Su video se borró de Contenido: se quitó de Meta.' })
  }

  // 4. Seguir / Cambiar en cada anuncio activo, con lo que se sabe hasta ahora.
  const activos = await db(`/rest/v1/anuncios?mercado=eq.${m}&estado=eq.activo&select=*`)
  if (!activos.length) return
  const desde = `${new Date().toISOString().slice(0, 7)}-01`
  const gastos = await db(`/rest/v1/anuncios_gasto?dia=gte.${desde}&anuncio_id=in.(${activos.map((a) => a.id).join(',')})&select=anuncio_id,gasto`)
  const leads = await db('/rest/v1/leads?anuncio_id=neq.&estado=neq.incompleto&select=anuncio_id,estado,prospecto_id')
  const de = (a) => ({
    g: gastos.filter((x) => x.anuncio_id === a.id).reduce((s, x) => s + Number(x.gasto), 0),
    suyos: leads.filter((l) => l.anuncio_id === a.meta_ad_id),
    dias: a.inicio ? Math.floor((Date.now() - new Date(a.inicio)) / 864e5) : 0,
  })
  for (const a of activos) {
    const { g, suyos, dias } = de(a)
    const rec = suyos.length ? 'seguir' : dias >= 7 && g >= 20 ? 'cambiar' : 'esperar'
    if (rec !== a.recomendacion) await guardarAd(a, { recomendacion: rec })
  }

  // 5. Al ritmo del tope: el presupuesto diario de la campaña se ajusta a lo que cabe.
  if (cuidar && t.campana_id && !t.pausado_por_tope && !t.pausado_manual) {
    const diario = presupuestoDiario(t, gastado)
    const c = await graph(t.campana_id, { params: { fields: 'daily_budget' } })
    if (diario >= 1 && Math.abs(Number(c.daily_budget) / 100 - diario) / diario > 0.1) await graph(t.campana_id, { method: 'POST', params: { daily_budget: Math.round(diario * 100) } })
  }

  // 6. Los lunes desde las 7 a.m. (Nueva York), una vez: se tumba lo que no funciona.
  const ny = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]))
  const fechaHoyNY = `${ny.year}-${ny.month}-${ny.day}`
  if (ny.weekday !== 'Mon' || Number(ny.hour) < 7 || t.ultima_revision === fechaHoyNY) return
  let quedan = activos.length
  for (const a of activos) {
    const { g, suyos, dias } = de(a)
    if (dias >= 7 && g >= 40 && !suyos.length) {
      await graph(a.meta_ad_id, { method: 'POST', params: { status: 'PAUSED' } })
      await guardarAd(a, { estado: 'pausado', recomendacion: '', fin: hoy(), motivo: `Tumbado: ${dias} días, ${usd(g)} gastados y 0 leads calificados.` })
      quedan--
    } else if (suyos.length) {
      const meetings = suyos.filter((l) => l.estado === 'agendado' || l.prospecto_id).length
      await guardarAd(a, { motivo: `Funciona: ${suyos.length} lead(s)${meetings ? ` y ${meetings} meeting(s)` : ''} a ${usd(g / suyos.length)} por lead. Meta le pasa más presupuesto.` })
    } else {
      await guardarAd(a, { motivo: dias < 7 ? `En aprendizaje (${dias} de 7 días, ${usd(g)}).` : `Sin leads todavía: ${dias} días y ${usd(g)}. Se decide al llegar a 40 USD.` })
    }
  }
  await db(`/rest/v1/anuncios_topes?mercado=eq.${m}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { ultima_revision: fechaHoyNY, ...(quedan < 3 ? { aviso: `⚠ Quedan ${quedan} anuncio(s) al aire: faltan ${3 - quedan} para tener 3. Dale "✦ Nuevo anuncio".` } : {}) },
  })
}

// ---------------------------------------------------------- botones de HQ

/** ⏸ Pausar / ▶ Reanudar un mercado, y 🗑 Borrar un anuncio que no está al aire. */
export async function accionManual({ accion, mercado, id }) {
  if (accion === 'borrar') {
    const [a] = await db(`/rest/v1/anuncios?id=eq.${id}&estado=eq.borrador&select=*`)
    if (!a) return
    try {
      if (a.meta_ad_id) await graph(a.meta_ad_id, { method: 'DELETE' }).catch(() => graph(a.meta_ad_id, { method: 'POST', params: { status: 'DELETED' } }))
      // Se queda como "terminado" (no se borra la fila): así el motor nunca lo vuelve a crear.
      await guardarAd(a, { estado: 'terminado', fin: hoy(), motivo: '🗑 Borrado por Eduardo antes de salir al aire.' })
      await avisar(a.mercado, `🗑 Anuncio ${a.codigo ?? ''} borrado de Meta.`)
    } catch (err) {
      await avisar(a.mercado, `⚠ No se pudo borrar ${a.codigo ?? ''}: ${err.message}`)
    }
    return
  }
  if (!['usa', 'mexico'].includes(mercado)) return
  const [t] = await db(`/rest/v1/anuncios_topes?mercado=eq.${mercado}&select=*`)
  if (!t) return
  try {
    if (accion === 'pausar') {
      if (t.campana_id) await graph(t.campana_id, { method: 'POST', params: { status: 'PAUSED' } })
      await db(`/rest/v1/anuncios_topes?mercado=eq.${mercado}`, { method: 'PATCH', prefer: 'return=minimal', body: { pausado_manual: true, aviso: '⏸ Pausado por Eduardo: no se gasta nada hasta "▶ Reanudar".' } })
    } else if (accion === 'reanudar') {
      await db(`/rest/v1/anuncios_topes?mercado=eq.${mercado}`, { method: 'PATCH', prefer: 'return=minimal', body: { pausado_manual: false } })
      t.pausado_manual = false
      const activos = await db(`/rest/v1/anuncios?mercado=eq.${mercado}&estado=eq.activo&select=id`)
      const gastado = await gastadoMes(mercado)
      const diario = presupuestoDiario(t, gastado)
      if (activos.length && t.campana_id && !t.pausado_por_tope && diario >= 1) await graph(t.campana_id, { method: 'POST', params: { status: 'ACTIVE', daily_budget: Math.round(diario * 100) } })
      await avisar(mercado, diario >= 1 ? `▶ Reanudado · ${usd(diario)} al día.` : `▶ Reanudado, pero el tope del mes ya se gastó (${usd(gastado)}): sale al aire el día 1.`)
      await anunciosDelMercado(t, { cuidar: false }) // los que esperaban salen ya
    }
  } catch (err) {
    await avisar(mercado, `⚠ ${err.message}`)
  }
}
