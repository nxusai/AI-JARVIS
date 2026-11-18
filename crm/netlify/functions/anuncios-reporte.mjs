// Acceso de SOLO LECTURA a los números de los anuncios de Mi Semago para el reporte
// automático de los lunes (una tarea programada en la nube) y para el asesor de
// anuncios. No usa sesión del Centro de trabajo: pide el encabezado X-Reporte-Key
// igual a REPORTE_CLAVE en Netlify (mínimo 24 caracteres).
// GET  → las semanas guardadas + lo aprendido + cómo va todo desde el inicio (Meta, solo lectura).
// POST → toma la foto de la última semana completa (o de ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD) y devuelve lo mismo.
// GET ?desde=&hasta= → además calcula ese rango sin guardarlo (campo "rango").
// GET ?estados=1 → estado de las campañas, conjuntos y anuncios de la cuenta (campo "cuenta"), solo lectura.
// PUT  → guarda lo aprendido { aprendizajes: [{ fecha, tipo, estado, titulo, texto, fuente }] } y registros
//        manuales de anuncios viejos { registros: [filas de anuncios_semanas] } (quedan con estado MANUAL);
//        { borrarRegistros: [{ semana, camp, anuncio }] } borra solo registros MANUALES (para corregirlos).
// Nunca cambia nada en Meta ni en los leads; no devuelve datos personales.
import { timingSafeEqual } from 'node:crypto'
import { json, sb } from '../lib/sb.mjs'
import { graph, filasMiSemago, metaListo, cuentaMeta, FILTRO, CAMPOS } from '../lib/meta.mjs'
import { tomarFoto, semanasGuardadas, aprendizajesGuardados, calcular, rango } from '../lib/semana.mjs'

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
    const enRango = req.method === 'GET' && r ? { desde: r.desde, hasta: r.hasta, ...(await calcular(r)) } : null
    let total = []
    let motivo = ''
    if (metaListo()) {
      try {
        total = filasMiSemago(await graph(`${cuentaMeta()}/insights?level=ad&date_preset=maximum&fields=${CAMPOS}&filtering=${FILTRO}&limit=500`))
      } catch (err) {
        motivo = `Meta: ${err.message}`.slice(0, 300)
      }
    } else motivo = 'Meta sin conectar'
    const aprendizajes = await aprendizajesGuardados().catch(() => [])
    // Estado de las campañas, conjuntos y anuncios de la cuenta (solo lectura), para revisar qué cambió.
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
    return json({ ok: true, foto, rango: enRango, cuenta, semanas: await semanasGuardadas(), aprendizajes, total, motivo, al: new Date().toISOString() })
  } catch (err) {
    return json({ ok: false, error: err.message.slice(0, 300) }, 500)
  }
}

const TIPOS = ['regla', 'ronda', 'semana', 'hipotesis', 'competencia']
const ESTADOS = ['confirmado', 'pendiente', 'descartado', 'recomendacion']
const MERCADO = /^[A-Z]{2,12}$/
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
  const reg = (Array.isArray(registros) ? registros : []).slice(0, 50).filter((r) => MERCADO.test(r?.camp || '') && r?.anuncio).map((r) => ({
    semana: fecha(r.semana), hasta: fecha(r.hasta), camp: r.camp, anuncio: txt(r.anuncio, 20), nombre: txt(r.nombre, 200), campana: txt(r.campana, 200),
    estado: 'MANUAL', moneda: txt(r.moneda || 'USD', 5), gasto: Math.round((Number(r.gasto) || 0) * 100) / 100,
    impresiones: ent(r.impresiones), alcance: ent(r.alcance), vistas3s: ent(r.vistas3s), thruplays: ent(r.thruplays), clics: ent(r.clics),
    conversaciones: ent(r.conversaciones), frecuencia: Number(r.frecuencia) || 0, leads: ent(r.leads), reales: ent(r.reales), hablo: ent(r.hablo),
    buenos: ent(r.buenos), agendo: ent(r.agendo), cliente: ent(r.cliente),
  }))
  // Solo se pueden borrar registros MANUALES (los de Meta los vuelve a escribir la foto semanal).
  let borrados = 0
  for (const b of (Array.isArray(borrarRegistros) ? borrarRegistros : []).slice(0, 20)) {
    if (!MERCADO.test(b?.camp || '') || !b?.anuncio || !/^\d{4}-\d{2}-\d{2}$/.test(b?.semana || '')) continue
    await sb(`/rest/v1/anuncios_semanas?semana=eq.${b.semana}&camp=eq.${b.camp}&anuncio=eq.${encodeURIComponent(txt(b.anuncio, 20))}&estado=eq.MANUAL`, { servicio: true, method: 'DELETE' })
    borrados++
  }
  const op = { servicio: true, method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal' }
  if (apr.length) await sb('/rest/v1/anuncios_aprendizajes?on_conflict=titulo', { ...op, body: apr })
  if (reg.length) await sb('/rest/v1/anuncios_semanas?on_conflict=semana,camp,anuncio', { ...op, body: reg })
  return { aprendizajes: apr.length, registros: reg.length, borrados }
}
