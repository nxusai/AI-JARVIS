// La puerta de la tarea semanal de contenido (Claude) a HQ. Solo entra quien
// trae CONTENIDO_CLAVE en el encabezado x-contenido-clave.
//   { accion: "crear", pieza: { tipo, uso, mercado, idioma, titulo, texto, idea, publicar_en }, archivo_url }
//       baja la foto o el video (de Bloom o Higgsfield), lo guarda en el
//       almacenamiento privado "contenido" y deja la pieza "por aprobar".
//   { accion: "reporte", reporte: { semana, mercado, resumen, funciono, no_funciono, decisiones, siguiente } }
//   { accion: "resumen" }  lo que hay: piezas por aprobar o con cambios pedidos, anuncios y su gasto del mes,
//       los topes (zonas y negocios) y los pedidos de video pendientes.
//   { accion: "pedido", id, estado: "en_proceso" | "error", nota }  marca un pedido de video.
//   En "crear", "solicitud_id" liga la pieza a su pedido (y hereda el anuncio que reemplaza).
import { timingSafeEqual } from 'node:crypto'
import { json, sb, URL_SB } from '../lib/sb.mjs'

const texto = (v, max) => String(v ?? '').trim().slice(0, max)
const uno = (v, opciones, defecto) => (opciones.includes(v) ? v : defecto)
const TIPOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov' }

function autorizado(req) {
  const want = Buffer.from((process.env.CONTENIDO_CLAVE || '').trim())
  const got = Buffer.from((req.headers.get('x-contenido-clave') || '').trim())
  return want.length >= 24 && want.length === got.length && timingSafeEqual(want, got)
}

/** Baja el archivo y lo sube al almacenamiento "contenido"; devuelve su ruta. */
async function guardarArchivo(url, tipo) {
  if (!/^https:\/\//.test(String(url))) throw Object.assign(new Error('archivo_url debe ser https'), { status: 400 })
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw Object.assign(new Error(`no se pudo bajar el archivo (${res.status})`), { status: 400 })
  const mime = String(res.headers.get('content-type') || '').split(';')[0].trim()
  const ext = TIPOS[mime]
  if (!ext || (tipo === 'video') !== mime.startsWith('video/')) throw Object.assign(new Error(`tipo de archivo no válido: ${mime || 'desconocido'}`), { status: 400 })
  const cuerpo = Buffer.from(await res.arrayBuffer())
  if (cuerpo.length > 50 * 1048576) throw Object.assign(new Error('el archivo pesa más de 50 MB'), { status: 400 })
  const ruta = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
  const llave = process.env.SUPABASE_SERVICE_KEY
  const sube = await fetch(`${URL_SB()}/storage/v1/object/contenido/${ruta}`, {
    method: 'POST',
    headers: { apikey: llave, ...(/^eyJ/.test(llave) ? { authorization: `Bearer ${llave}` } : {}), 'content-type': mime, 'x-upsert': 'false' },
    body: cuerpo,
  })
  if (!sube.ok) throw new Error(`no se pudo guardar el archivo (${sube.status})`)
  return ruta
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  if (!autorizado(req)) return json({ ok: false, error: 'sin permiso' }, 401)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const b = await req.json().catch(() => ({}))

  try {
    if (b.accion === 'crear') {
      const p = b.pieza ?? {}
      const tipo = uno(p.tipo, ['foto', 'video'], '')
      if (!tipo) return json({ ok: false, error: 'pieza.tipo: foto o video' }, 400)
      const sid = /^[0-9a-f-]{36}$/i.test(String(b.solicitud_id ?? '')) ? b.solicitud_id : null
      const [pedido] = sid ? await sb(`/rest/v1/solicitudes?id=eq.${sid}&select=*`, { servicio: true }) : []
      // Si el pedido ya se entregó (el taller lo mandó dos veces), no se crea otra pieza.
      if (pedido?.estado === 'listo' && pedido.contenido_id) return json({ ok: true, id: pedido.contenido_id, repetido: true })
      const archivo = await guardarArchivo(b.archivo_url, tipo)
      const fila = {
        tipo,
        uso: uno(p.uso, ['feed', 'anuncio'], 'feed'),
        mercado: uno(p.mercado, ['usa', 'mexico', 'ambos'], 'ambos'),
        idioma: uno(p.idioma, ['es', 'en'], 'es'),
        titulo: texto(p.titulo, 200),
        texto: texto(p.texto, 2200),
        idea: texto(p.idea, 2000),
        palabra: texto(p.palabra, 40).toUpperCase(), // la palabra que pide el video (si no, INFO)
        archivo,
        publicar_en: p.publicar_en && !Number.isNaN(Date.parse(p.publicar_en)) ? new Date(p.publicar_en).toISOString() : null,
      }
      if (pedido) Object.assign(fila, { reemplaza: pedido.reemplaza, objetivo: pedido.objetivo, uso: pedido.uso, mercado: pedido.mercado })
      // Un anuncio nuevo del reporte de los lunes puede venir ya ligado al anuncio que conviene cambiar.
      else if (/^[0-9a-f-]{36}$/i.test(String(p.reemplaza ?? ''))) fila.reemplaza = p.reemplaza
      const [pieza] = await sb('/rest/v1/contenido', { servicio: true, method: 'POST', prefer: 'return=representation', body: fila })
      if (pedido) await sb(`/rest/v1/solicitudes?id=eq.${pedido.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: { estado: 'listo', contenido_id: pieza.id, nota: '' } })
      return json({ ok: true, id: pieza.id })
    }

    if (b.accion === 'reporte') {
      const r = b.reporte ?? {}
      const semana = /^\d{4}-\d{2}-\d{2}$/.test(String(r.semana)) ? r.semana : new Date().toISOString().slice(0, 10)
      const fila = { semana, mercado: uno(r.mercado, ['usa', 'mexico', 'ambos'], 'ambos') }
      for (const k of ['resumen', 'funciono', 'no_funciono', 'decisiones', 'siguiente']) fila[k] = texto(r[k], 4000)
      const [rep] = await sb('/rest/v1/anuncios_reportes', { servicio: true, method: 'POST', prefer: 'return=representation', body: fila })
      return json({ ok: true, id: rep.id })
    }

    if (b.accion === 'rehacer') {
      // Una pieza con cambio pedido en el video: nuevo archivo (y texto), y vuelve a "por aprobar".
      if (!/^[0-9a-f-]{36}$/i.test(String(b.id ?? ''))) return json({ ok: false, error: 'falta id' }, 400)
      const [c] = await sb(`/rest/v1/contenido?id=eq.${b.id}&select=id,tipo,archivo`, { servicio: true })
      if (!c) return json({ ok: false, error: 'no existe' }, 404)
      const cambio = { estado: 'por_aprobar', comentario: '', error: '' }
      if (b.archivo_url) Object.assign(cambio, { archivo: await guardarArchivo(b.archivo_url, c.tipo), analisis: '', palabra: '' })
      if (b.palabra !== undefined) cambio.palabra = texto(b.palabra, 40).toUpperCase()
      if (b.texto) cambio.texto = texto(b.texto, 2200)
      if (b.idea) cambio.idea = texto(b.idea, 2000)
      await sb(`/rest/v1/contenido?id=eq.${c.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: cambio })
      return json({ ok: true })
    }

    if (b.accion === 'pedido') {
      if (!/^[0-9a-f-]{36}$/i.test(String(b.id ?? ''))) return json({ ok: false, error: 'falta id' }, 400)
      await sb(`/rest/v1/solicitudes?id=eq.${b.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: { estado: uno(b.estado, ['en_proceso', 'error', 'pendiente'], 'en_proceso'), nota: texto(b.nota, 1000) } })
      return json({ ok: true })
    }

    if (b.accion === 'resumen') {
      const mes = `${new Date().toISOString().slice(0, 7)}-01`
      const [pendientes, anuncios, gasto, topes, reportes, pedidos, recientes] = await Promise.all([
        sb('/rest/v1/contenido?estado=in.(por_aprobar,rechazado)&select=id,tipo,uso,mercado,titulo,estado,comentario,creado&order=creado.desc&limit=50', { servicio: true }),
        sb('/rest/v1/anuncios?select=id,contenido_id,codigo,nombre,mercado,meta_ad_id,estado,presupuesto_dia,impresiones,clics,inicio,fin,motivo,recomendacion&order=creado.desc', { servicio: true }),
        sb(`/rest/v1/anuncios_gasto?dia=gte.${mes}&select=anuncio_id,gasto`, { servicio: true }),
        sb('/rest/v1/anuncios_topes?select=mercado,tope_mensual,zonas,negocios,aviso', { servicio: true }),
        sb('/rest/v1/anuncios_reportes?select=*&order=semana.desc&limit=4', { servicio: true }),
        sb('/rest/v1/solicitudes?estado=in.(pendiente,en_proceso)&select=*&order=creado.asc', { servicio: true }),
        sb('/rest/v1/contenido?select=id,tipo,uso,mercado,titulo,objetivo,texto,estado,publicar_en,anuncio_id,creado&order=creado.desc&limit=30', { servicio: true }),
      ])
      // Lo que trajo cada anuncio (leads calificados y meetings), para aprender qué funciona.
      const leads = await sb('/rest/v1/leads?anuncio_id=neq.&estado=neq.incompleto&select=anuncio_id,estado,prospecto_id,servicio,ciudad', { servicio: true })
      const delMes = {}
      for (const g of gasto) delMes[g.anuncio_id] = (delMes[g.anuncio_id] ?? 0) + Number(g.gasto)
      const de = (a) => leads.filter((l) => l.anuncio_id === a.meta_ad_id)
      return json({
        ok: true,
        pedidos,
        pendientes,
        recientes,
        anuncios: anuncios.map((a) => ({ ...a, gastado_mes: delMes[a.id] ?? 0, leads: de(a).length, meetings: de(a).filter((l) => l.estado === 'agendado' || l.prospecto_id).length, quienes: de(a).map((l) => [l.servicio, l.ciudad].filter(Boolean).join(' · ')).slice(0, 10) })),
        topes,
        reportes,
      })
    }

    return json({ ok: false, error: 'acción desconocida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
