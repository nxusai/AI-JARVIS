// Cada 10 minutos: publica en la página de Facebook y en el Instagram de NXUS
// AI lo que Eduardo aprobó en HQ → Contenido y ya le toca (o no tiene fecha).
// Los videos de Instagram (Reels) los prepara Meta unos minutos: se deja el
// "contenedor" y se publica en una vuelta siguiente. Si algo falla, queda el
// porqué en la pieza y no se reintenta hasta que Eduardo da "Reintentar".
import { graph, instagram, llaveDePagina, metaListo, pagina } from '../lib/meta.mjs'
import { sb, URL_SB } from '../lib/sb.mjs'

export const config = { schedule: '*/10 * * * *' }

/** Un link temporal (2 horas) al archivo, para que Meta lo descargue. */
async function linkTemporal(ruta) {
  const llave = process.env.SUPABASE_SERVICE_KEY
  const res = await fetch(`${URL_SB()}/storage/v1/object/sign/contenido/${ruta}`, {
    method: 'POST',
    headers: { apikey: llave, ...(/^eyJ/.test(llave) ? { authorization: `Bearer ${llave}` } : {}), 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: 7200 }),
  })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d.signedURL) throw new Error(`no se pudo preparar el archivo (${res.status})`)
  return `${URL_SB()}/storage/v1${d.signedURL}`
}

const guardar = (id, cambio) => sb(`/rest/v1/contenido?id=eq.${id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: cambio })

/** Avanza una pieza lo más que se pueda. Devuelve true si quedó publicada en las dos. */
async function avanzar(c, llavePagina) {
  const url = await linkTemporal(c.archivo)
  const video = c.tipo === 'video'
  if (!c.publicado_fb) {
    const r = video
      ? await graph(`${pagina()}/videos`, { method: 'POST', host: 'graph-video.facebook.com', token: llavePagina, params: { file_url: url, description: c.texto, title: c.titulo.slice(0, 100) } })
      : await graph(`${pagina()}/photos`, { method: 'POST', token: llavePagina, params: { url, caption: c.texto, published: true } })
    c.publicado_fb = String(r.post_id || r.id)
    await guardar(c.id, { publicado_fb: c.publicado_fb })
  }
  if (!c.publicado_ig) {
    if (!c.ig_contenedor) {
      const r = await graph(`${instagram()}/media`, {
        method: 'POST',
        params: video ? { media_type: 'REELS', video_url: url, caption: c.texto, share_to_feed: true } : { image_url: url, caption: c.texto },
      })
      c.ig_contenedor = r.id
      await guardar(c.id, { ig_contenedor: c.ig_contenedor })
    }
    const { status_code: estado } = await graph(c.ig_contenedor, { params: { fields: 'status_code' } })
    if (estado === 'ERROR' || estado === 'EXPIRED') {
      await guardar(c.id, { ig_contenedor: '' })
      throw new Error(`Instagram no pudo procesar el ${video ? 'video' : 'archivo'} (${estado}). Revisa formato: video vertical MP4, foto JPG.`)
    }
    if (estado !== 'FINISHED') return false // Instagram sigue preparando el video: en la siguiente vuelta
    const r = await graph(`${instagram()}/media_publish`, { method: 'POST', params: { creation_id: c.ig_contenedor } })
    c.publicado_ig = String(r.id)
    await guardar(c.id, { publicado_ig: c.publicado_ig, ig_contenedor: '' })
  }
  return true
}

export default async () => {
  if (!process.env.SUPABASE_SERVICE_KEY || !metaListo()) return new Response('Meta sin conectar')
  const ahora = new Date().toISOString()
  // Aprobadas, con texto y archivo, sin error, que ya les toca (o no tienen fecha). Pocas por vuelta.
  const piezas = await sb(
    `/rest/v1/contenido?estado=eq.aprobado&error=eq.&archivo=neq.&texto=neq.&or=(publicar_en.is.null,publicar_en.lte.${ahora})&select=*&order=publicar_en.asc.nullsfirst&limit=3`,
    { servicio: true },
  )
  if (!piezas.length) return new Response('nada por publicar')
  let llavePagina
  try {
    llavePagina = await llaveDePagina()
  } catch (err) {
    return new Response(`sin llave de página: ${err.message}`)
  }
  let listas = 0
  for (const c of piezas) {
    try {
      if (await avanzar(c, llavePagina)) {
        await guardar(c.id, { estado: 'publicado', publicar_en: c.publicar_en ?? ahora })
        listas++
      }
    } catch (err) {
      await guardar(c.id, { error: `No se pudo publicar: ${err.message}`.slice(0, 1000) })
    }
  }
  return new Response(`publicadas: ${listas}`)
}
