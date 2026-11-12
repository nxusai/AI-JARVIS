// Mis pendientes (solo Eduardo). Lo usan HQ (su sesión de admin) y NEX desde su
// Mac por Telegram (encabezado x-pendientes-clave = PENDIENTES_CLAVE en Netlify).
//   { accion: "entender", texto }  la IA separa y ordena lo que escribió o dictó
//        (uno o varios pendientes: título, área, empresa, fecha, hora, prioridad) y los guarda.
//   { accion: "lista", que: "hoy" | "semana" | "algun_dia" | "atrasados" }  para que NEX conteste.
//   { accion: "hecho", id | texto }   marca como hecho (por id o por parecido del título).
//   { accion: "mover", id | texto, fecha }   cambia la fecha ("" = algún día).
//   { accion: "resumen" }   el plan del día: las tres importantes, lo demás, hábitos y metas.
import Anthropic from '@anthropic-ai/sdk'
import { timingSafeEqual } from 'node:crypto'
import { json, quien, sb } from '../lib/sb.mjs'

const AREAS = ['negocios', 'patrimonio', 'salud', 'familia', 'crecimiento', 'disfrute']
const EMPRESAS = ['NXUS AI', 'Mi Semago', 'Abuelito', 'Aurelius', 'VAYRO']
const db = (path, opts = {}) => sb(path, { servicio: true, ...opts })

function claveNex(req) {
  const want = Buffer.from((process.env.PENDIENTES_CLAVE || '').trim())
  const got = Buffer.from((req.headers.get('x-pendientes-clave') || '').trim())
  return want.length >= 24 && want.length === got.length && timingSafeEqual(want, got)
}

/** Hoy en Nueva York: { iso: "2026-11-12", texto: "miércoles 12 de noviembre de 2026" } */
function hoyNY(dias = 0) {
  const d = new Date(Date.now() + dias * 864e5)
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d)
  const texto = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/New_York', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  return { iso, texto }
}

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['titulo', 'area', 'empresa', 'fecha', 'hora', 'prioridad', 'notas'],
        properties: {
          titulo: { type: 'string', description: 'Corto y accionable, empezando con verbo: "Llamar al contador por la factura de octubre".' },
          area: { type: 'string', enum: AREAS },
          empresa: { type: 'string', description: `Una de: ${EMPRESAS.join(', ')}; o "" si es personal o no aplica.` },
          fecha: { type: 'string', description: 'YYYY-MM-DD, o "" si no dijo cuándo (queda en "Algún día").' },
          hora: { type: 'string', description: 'HH:MM en 24 horas, o "".' },
          prioridad: { type: 'string', enum: ['alta', 'media', 'normal'] },
          notas: { type: 'string', description: 'Detalles extra que dijo, o "".' },
        },
      },
    },
  },
}

async function entender(texto) {
  const hoy = hoyNY()
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 })
  const res = await client.messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 2000,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
    system:
      `Ordenas los pendientes de Eduardo Ramos, dueño de NXUS AI y de otros negocios (${EMPRESAS.join(', ')}). ` +
      `Hoy es ${hoy.texto} (${hoy.iso}), hora de Nueva York. Te dicta uno o varios pendientes en un mensaje; sepáralos (uno por cosa que hacer). ` +
      'Áreas: negocios (sus empresas y clientes), patrimonio (dinero, inversiones, pagos, impuestos), salud, familia, crecimiento (aprender, leer, cursos), disfrute (viajes, descanso, gustos). ' +
      'Fechas: "mañana", "el viernes", "la próxima semana" → la fecha exacta; si no dice cuándo, fecha "". "Hoy" → hoy. ' +
      'Prioridad: alta si dice urgente/importante/ya/sin falta o vence hoy con consecuencias; media si es importante sin prisa; si no, normal. ' +
      'Escribe en español, con mayúscula inicial, sin inventar nada que no dijo.',
    messages: [{ role: 'user', content: String(texto).slice(0, 4000) }],
  })
  const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''))
  return (out.items ?? [])
    .filter((x) => String(x.titulo || '').trim())
    .map((x) => ({
      titulo: String(x.titulo).trim().slice(0, 300),
      area: AREAS.includes(x.area) ? x.area : 'negocios',
      empresa: EMPRESAS.includes(x.empresa) ? x.empresa : '',
      fecha: /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) ? x.fecha : null,
      hora: /^\d{2}:\d{2}$/.test(x.hora) ? x.hora : null,
      prioridad: ['alta', 'media', 'normal'].includes(x.prioridad) ? x.prioridad : 'normal',
      notas: String(x.notas || '').slice(0, 4000),
    }))
}

/** Busca un pendiente abierto por su id o por parecido del título. */
async function buscar({ id, texto }) {
  if (/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) return (await db(`/rest/v1/pendientes?id=eq.${id}&select=*`))[0]
  const palabras = String(texto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\W+/).filter((w) => w.length > 2)
  if (!palabras.length) return null
  const abiertos = await db('/rest/v1/pendientes?estado=eq.pendiente&select=*&order=fecha.asc.nullslast')
  const puntos = (p) => {
    const t = p.titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return palabras.filter((w) => t.includes(w)).length
  }
  const mejor = abiertos.map((p) => [puntos(p), p]).sort((a, b) => b[0] - a[0])[0]
  return mejor && mejor[0] > 0 ? mejor[1] : null
}

/** Las tres de hoy: las marcadas con estrella; si faltan, las más urgentes (atrasadas, alta, con hora). */
export function tresDeHoy(lista, hoy) {
  const deHoy = lista.filter((p) => p.estado === 'pendiente' && p.fecha && p.fecha <= hoy)
  const peso = (p) => (p.estrella ? 1000 : 0) + (p.fecha < hoy ? 300 : 0) + { alta: 200, media: 100, normal: 0 }[p.prioridad] + (p.hora ? 20 : 0)
  return [...deHoy].sort((a, b) => peso(b) - peso(a) || String(a.hora ?? '99').localeCompare(String(b.hora ?? '99'))).slice(0, 3)
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  if (!claveNex(req)) {
    const yo = await quien(req)
    if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
    if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo el administrador' }, 403)
  }
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const b = await req.json().catch(() => ({}))
  const origen = claveNex(req) ? 'nex' : 'hq'
  const hoy = hoyNY().iso
  try {
    if (b.accion === 'entender') {
      const texto = String(b.texto ?? '').trim()
      if (!texto) return json({ ok: false, error: 'Escribe tu pendiente' }, 400)
      let items
      try {
        items = process.env.ANTHROPIC_API_KEY ? await entender(texto) : []
      } catch (err) {
        console.log('entender:', err.message)
        items = []
      }
      // Si la IA no respondió, se guarda tal cual para hoy (no se pierde nada).
      if (!items.length) items = [{ titulo: texto.slice(0, 300), area: 'negocios', empresa: '', fecha: hoy, hora: null, prioridad: 'normal', notas: '' }]
      const guardados = await db('/rest/v1/pendientes', { method: 'POST', prefer: 'return=representation', body: items.map((x) => ({ ...x, origen })) })
      return json({ ok: true, items: guardados })
    }
    if (b.accion === 'lista') {
      const filtro = {
        hoy: `estado=eq.pendiente&fecha=lte.${hoy}`,
        atrasados: `estado=eq.pendiente&fecha=lt.${hoy}`,
        semana: `estado=eq.pendiente&fecha=gte.${hoy}&fecha=lte.${hoyNY(7).iso}`,
        algun_dia: 'estado=eq.pendiente&fecha=is.null',
      }[b.que] ?? `estado=eq.pendiente&fecha=lte.${hoy}`
      const items = await db(`/rest/v1/pendientes?${filtro}&select=id,titulo,area,empresa,fecha,hora,prioridad,estrella&order=fecha.asc.nullslast,hora.asc.nullslast`)
      return json({ ok: true, hoy, items })
    }
    if (b.accion === 'hecho' || b.accion === 'mover') {
      const p = await buscar(b)
      if (!p) return json({ ok: false, error: 'No encontré ese pendiente' }, 404)
      const cambio =
        b.accion === 'hecho'
          ? { estado: 'hecho', hecho_en: new Date().toISOString(), estrella: false }
          : { fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha)) ? b.fecha : null, estrella: false }
      const [nuevo] = await db(`/rest/v1/pendientes?id=eq.${p.id}`, { method: 'PATCH', prefer: 'return=representation', body: cambio })
      return json({ ok: true, item: nuevo })
    }
    if (b.accion === 'resumen') {
      const [abiertos, hechos, habitos, dias, metas] = await Promise.all([
        db(`/rest/v1/pendientes?estado=eq.pendiente&fecha=lte.${hoy}&select=*`),
        db(`/rest/v1/pendientes?estado=eq.hecho&hecho_en=gte.${hoy}T00:00:00&select=id`),
        db('/rest/v1/habitos?activo=is.true&select=id,titulo'),
        db(`/rest/v1/habitos_dias?dia=eq.${hoy}&select=habito_id`),
        db('/rest/v1/metas?estado=eq.activa&select=titulo,area,progreso,periodo'),
      ])
      const tres = tresDeHoy(abiertos, hoy)
      return json({
        ok: true,
        hoy,
        tres,
        tambien: abiertos.filter((p) => !tres.includes(p)),
        atrasados: abiertos.filter((p) => p.fecha < hoy).length,
        hechos_hoy: hechos.length,
        habitos: habitos.map((h) => ({ ...h, hecho: dias.some((d) => d.habito_id === h.id) })),
        metas,
      })
    }
    return json({ ok: false, error: 'acción desconocida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
