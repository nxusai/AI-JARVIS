// Acceso de SOLO LECTURA a los números de los anuncios para el reporte automático
// de los lunes (una tarea programada de Claude en la nube). No usa sesión de HQ:
// pide el encabezado X-Reporte-Key igual a REPORTE_CLAVE en Netlify.
// GET  → las semanas guardadas + cómo va todo desde el inicio (Meta, solo lectura).
// POST → toma la foto de la última semana completa (o de ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD) y devuelve lo mismo.
// GET ?desde=&hasta= → además calcula ese rango sin guardarlo (campo "rango").
// GET ?fuentes=48 → leads por fuente de las últimas N horas (sin datos personales).
// GET ?estados=1 → estado de todas las campañas y anuncios de la cuenta (campo "cuenta"), solo lectura.
// PUT  → guarda lo aprendido { aprendizajes: [{ fecha, tipo, estado, titulo, texto, fuente }] } y registros
//        manuales de anuncios viejos { registros: [filas de anuncios_semanas] } (quedan con estado MANUAL);
//        { borrarRegistros: [{ semana, camp, anuncio }] } borra solo registros MANUALES (para corregirlos).
// Nunca cambia nada en Meta ni en los leads; no devuelve datos personales.
import { timingSafeEqual } from 'node:crypto'
import { json } from '../lib/sb.mjs'
import { graph, fila, metaListo, cuentaMeta, FILTRO, CAMPOS } from '../lib/meta.mjs'
import { sb } from '../lib/sb.mjs'
import { tomarFoto, semanasGuardadas, calcular, rango } from '../lib/semana.mjs'

const clave = () => (process.env.REPORTE_CLAVE || '').trim()
function autorizado(req) {
  const a = Buffer.from(req.headers.get('x-reporte-key') || '')
  const b = Buffer.from(clave())
  return b.length >= 24 && a.length === b.length && timingSafeEqual(a, b)
}

export default async (req) => {
  if (!clave()) return json({ ok: false, error: 'Falta REPORTE_CLAVE en Netlify' }, 503)
  if (!autorizado(req)) return json({ ok: false, error: 'sin permiso' }, 401)
  if (!['GET', 'POST', 'PUT'].includes(req.method)) return json({ ok: false, error: 'GET, POST o PUT' }, 405)
  try {
    if (req.method === 'PUT') return json({ ok: true, ...(await guardar(await req.json().catch(() => ({})))) })
    const q = new URL(req.url).searchParams
    const r = q.get('desde') || q.get('hasta') ? rango(q.get('desde'), q.get('hasta') || new Date().toISOString().slice(0, 10)) : null
    const foto = req.method === 'POST' ? await tomarFoto(new Date(), r) : null
    const enRango = req.method === 'GET' && r ? { ...r, ...(await calcular(r)) } : null
    let total = []
    let motivo = ''
    if (metaListo()) {
      try {
        const r = await graph(`${cuentaMeta()}/insights?level=ad&date_preset=maximum&fields=${CAMPOS}&filtering=${FILTRO}&limit=200`)
        total = (r.data || []).map(fila)
      } catch (err) {
        motivo = `Meta: ${err.message}`.slice(0, 300)
      }
    } else motivo = 'Meta sin conectar'
    const aprendizajes = await sb('/rest/v1/anuncios_aprendizajes?select=fecha,tipo,estado,titulo,texto,fuente&order=fecha.desc&limit=200', { servicio: true }).catch(() => [])
    // Estado de TODAS las campañas y anuncios de la cuenta (solo lectura), para revisar qué cambió
    let cuenta = null
    if (metaListo() && q.get('estados')) {
      const act = cuentaMeta()
      const [camps, ads, sets, gasto] = await Promise.all([
        graph(`${act}/campaigns?fields=name,effective_status,configured_status,updated_time,daily_budget,spend_cap&limit=100`),
        graph(`${act}/ads?fields=name,effective_status,configured_status,updated_time,campaign{name},adset{name,effective_status}&limit=200`),
        graph(`${act}/adsets?fields=name,effective_status,configured_status,updated_time,campaign{name},daily_budget,optimization_goal,destination_type,targeting&limit=100`),
        graph(`${act}/insights?level=campaign&date_preset=last_7d&fields=campaign_name,spend&limit=200`),
      ]).catch((e) => [{ error: e.message }, {}, {}, {}])
      cuenta = { campanas: camps.data || camps, anuncios: ads.data || [], conjuntos: sets.data || [], gasto7: gasto.data || [] }
    }
    // Cuántos leads llegaron por fuente en las últimas horas (sin datos personales), para revisar que cada anuncio entre bien.
    let fuentes = null
    if (q.get('fuentes')) {
      const horas = Math.min(24 * 14, Math.max(1, Number(q.get('fuentes')) || 48))
      const desde = new Date(Date.now() - horas * 36e5).toISOString()
      const ls = await sb(`/rest/v1/leads?select=fuente,estado,motivo,permiso_llamada,llamada_seg,prospecto_id,creado,actualizado,nombre,empresa,telefono,correo,servicio,pais,idioma&creado=gte.${desde}&order=creado.desc`, { servicio: true }).catch(() => [])
      // Detalle sin datos personales: solo si cada campo llegó lleno o vacío.
      const lleno = (l) => Object.fromEntries(['nombre', 'empresa', 'telefono', 'correo', 'servicio', 'pais', 'idioma'].map((k) => [k, Boolean(l[k])]))
      fuentes = { horas, total: ls.length, por_fuente: {}, detalle: ls.slice(0, 20).map((l) => ({ fuente: l.fuente, estado: l.estado, motivo: l.motivo, permiso: l.permiso_llamada, llamada_seg: l.llamada_seg, creado: l.creado, actualizado: l.actualizado, campos: lleno(l) })) }
      for (const l of ls) {
        const k = l.fuente || '(sin fuente)'
        const x = (fuentes.por_fuente[k] ??= { leads: 0, reales: 0, hablo: 0, agendo: 0, ultimo: l.creado })
        x.leads++
        if (l.estado !== 'incompleto') x.reales++
        if ((l.llamada_seg ?? 0) >= 20) x.hablo++
        if (l.estado === 'agendado' || l.prospecto_id) x.agendo++
      }
    }
    return json({ ok: true, foto, rango: enRango, cuenta, fuentes, semanas: await semanasGuardadas(), aprendizajes, total, motivo, al: new Date().toISOString() })
  } catch (err) {
    return json({ ok: false, error: err.message.slice(0, 300) }, 500)
  }
}

const TIPOS = ['regla', 'ronda', 'semana', 'hipotesis', 'competencia']
const ESTADOS = ['confirmado', 'pendiente', 'descartado', 'recomendacion']
const fecha = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : new Date().toISOString().slice(0, 10))
const txt = (v, n) => String(v ?? '').slice(0, n)
const ent = (v) => Math.max(0, Math.round(Number(v) || 0))

async function guardar({ aprendizajes = [], registros = [], borrarRegistros = [] }) {
  const apr = (Array.isArray(aprendizajes) ? aprendizajes : []).slice(0, 50).filter((a) => a?.titulo).map((a) => ({
    fecha: fecha(a.fecha),
    tipo: TIPOS.includes(a.tipo) ? a.tipo : 'semana',
    estado: ESTADOS.includes(a.estado) ? a.estado : 'confirmado',
    titulo: txt(a.titulo, 200),
    texto: txt(a.texto, 6000),
    fuente: txt(a.fuente, 200),
  }))
  const reg = (Array.isArray(registros) ? registros : []).slice(0, 50).filter((r) => ['MX', 'NY'].includes(r?.camp) && r?.anuncio).map((r) => ({
    semana: fecha(r.semana), hasta: fecha(r.hasta), camp: r.camp, anuncio: txt(r.anuncio, 20), nombre: txt(r.nombre, 200), campana: txt(r.campana, 200),
    estado: 'MANUAL', moneda: txt(r.moneda || 'USD', 5), gasto: Math.round((Number(r.gasto) || 0) * 100) / 100,
    impresiones: ent(r.impresiones), alcance: ent(r.alcance), vistas3s: ent(r.vistas3s), thruplays: ent(r.thruplays), clics: ent(r.clics),
    conversaciones: ent(r.conversaciones), frecuencia: Number(r.frecuencia) || 0, leads: ent(r.leads), reales: ent(r.reales), hablo: ent(r.hablo),
    agendo: ent(r.agendo), asistio: ent(r.asistio), cliente: ent(r.cliente),
  }))
  // Solo se pueden borrar registros MANUALES (los de Meta los vuelve a escribir la foto semanal).
  let borrados = 0
  for (const b of (Array.isArray(borrarRegistros) ? borrarRegistros : []).slice(0, 20)) {
    if (!['MX', 'NY'].includes(b?.camp) || !b?.anuncio || !/^\d{4}-\d{2}-\d{2}$/.test(b?.semana || '')) continue
    await sb(`/rest/v1/anuncios_semanas?semana=eq.${b.semana}&camp=eq.${b.camp}&anuncio=eq.${encodeURIComponent(txt(b.anuncio, 20))}&estado=eq.MANUAL`, { servicio: true, method: 'DELETE', prefer: 'return=minimal' })
    borrados++
  }
  const op = { servicio: true, method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal' }
  if (apr.length) await sb('/rest/v1/anuncios_aprendizajes?on_conflict=titulo', { ...op, body: apr })
  if (reg.length) await sb('/rest/v1/anuncios_semanas?on_conflict=semana,camp,anuncio', { ...op, body: reg })
  return { aprendizajes: apr.length, registros: reg.length, borrados }
}
