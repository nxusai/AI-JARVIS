// PORTAFOLIO: la IA que arma el portafolio de NXUS (Eduardo y quien tenga el permiso "portafolio").
//   { accion: 'captura', link }                       → foto de la página y su texto (para analizarla)
//   { accion: 'analizar', link?, notas?, texto?, imagenes: [dataURL] }
//        → ficha limpia (sin datos de clientes) + zonas de cada imagen que hay que poner borrosas
//   { accion: 'pedir', solicitud, idioma, para }      → escoge trabajos aprobados y escribe el portafolio
//   { accion: 'video', pedido, archivos }             → guion por escenas para hacer el video con Claude
// Los originales nunca se guardan: solo pasan por aquí para que la IA los lea.
import Anthropic from '@anthropic-ai/sdk'
import { json, quien, sb } from '../lib/sb.mjs'

const MODELO = 'claude-opus-5-5'
const CATEGORIAS = ['web', 'app', 'automatizacion', 'ia', 'marketing', 'diseno', 'video', 'contenido', 'otro']
const lista = (desc) => ({ type: 'array', items: { type: 'string' }, description: desc })

const ESQUEMA_FICHA = {
  type: 'object',
  additionalProperties: false,
  required: ['titulo', 'categoria', 'industria', 'descripcion', 'reto', 'solucion', 'resultados', 'servicios', 'tecnologias', 'quitado', 'zonas'],
  properties: {
    titulo: { type: 'string', description: 'Título público corto, SIN el nombre del cliente. Ej. "Sitio web para restaurante familiar".' },
    categoria: { type: 'string', enum: CATEGORIAS },
    industria: { type: 'string', description: 'Industria genérica, sin identificar al cliente. Ej. "Restaurantes", "Logística", "Salud".' },
    descripcion: { type: 'string', description: '2 o 3 frases: qué hizo NXUS.' },
    reto: { type: 'string', description: 'El problema que tenía el negocio, en 1 o 2 frases (genérico).' },
    solucion: { type: 'string', description: 'Lo que hizo NXUS, en 1 o 2 frases.' },
    resultados: lista('0 a 4 resultados. Porcentajes o mejoras generales sí; montos de dinero del cliente, nombres o datos que lo identifiquen no. Si no hay resultados claros, vacío; nunca los inventes.'),
    servicios: lista('Servicios de NXUS que se ven: diseño web, automatización, agente de IA, anuncios, branding…'),
    tecnologias: lista('Tecnologías o herramientas que se ven, si aplica.'),
    quitado: lista('Lo confidencial que encontraste y dejaste fuera o marcaste borroso: "nombre del cliente", "logo", "teléfono", "precios"… (sin repetir el dato).'),
    zonas: {
      type: 'array',
      description: 'Rectángulos a poner borrosos en cada imagen. Coordenadas de 0 a 1 respecto al ancho y alto de esa imagen (x,y = esquina de arriba a la izquierda). Sé generoso: tapa el bloque completo con margen.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['imagen', 'x', 'y', 'w', 'h', 'que'],
        properties: { imagen: { type: 'integer', description: 'Número de imagen, empezando en 0' }, x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' }, que: { type: 'string', description: 'Qué tapa: logo, nombre, teléfono…' } },
      },
    },
  },
}

const SISTEMA_FICHA = `Eres la IA del portafolio de NXUS AI (agencia de Eduardo Ramos: sitios web, automatizaciones, agentes de IA, marketing). Te dan un trabajo que NXUS hizo para un cliente (imágenes, un link, texto o notas). Tu trabajo:
1. Escribir una ficha de portafolio breve, clara y vendedora, en español, sobre lo que hizo NXUS.
2. Proteger al cliente: en el texto NUNCA pongas su nombre, marca, dominio, dirección, teléfonos, correos, nombres de personas, precios, montos, datos de sus clientes ni nada que permita saber quién es. Usa descripciones genéricas ("una cadena de restaurantes en Texas").
3. En las imágenes, marca como zonas borrosas TODO lo que identifique al cliente o sea información: logos, nombre o marca (aunque sea grande en el encabezado), URLs y dominios, teléfonos, correos, direcciones, nombres de personas, caras de personas, precios y cifras, textos con datos, códigos QR, firmas. Deja visible el diseño (colores, estructura, botones, fotos de producto genéricas). Si una imagen es casi toda información confidencial (un contrato, una tabla de datos), marca la imagen completa (x 0, y 0, w 1, h 1).
Nunca inventes resultados ni datos que no estén.`

const ESQUEMA_PEDIDO = {
  type: 'object',
  additionalProperties: false,
  required: ['titulo', 'subtitulo', 'introduccion', 'trabajos', 'cierre', 'nota_para_ti'],
  properties: {
    titulo: { type: 'string', description: 'Título del portafolio (portada).' },
    subtitulo: { type: 'string' },
    introduccion: { type: 'string', description: '2 a 4 frases: quién es NXUS y por qué estos trabajos le sirven a este cliente.' },
    trabajos: {
      type: 'array',
      description: 'Los trabajos elegidos, en el orden en que deben ir (lo más relevante primero).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'titulo', 'texto', 'puntos', 'destacado'],
        properties: { id: { type: 'string' }, titulo: { type: 'string' }, texto: { type: 'string', description: '2 a 4 frases enfocadas en lo que le importa a este cliente.' }, puntos: lista('Hasta 4 puntos cortos (resultados o lo que incluye).'), destacado: { type: 'boolean' } },
      },
    },
    cierre: { type: 'string', description: 'Invitación corta a trabajar con NXUS.' },
    nota_para_ti: { type: 'string', description: 'Para Eduardo, no para el cliente: por qué elegiste estos y qué falta (ej. "no tienes trabajos de clínicas").' },
  },
}

const ESQUEMA_VIDEO = {
  type: 'object',
  additionalProperties: false,
  required: ['titulo', 'duracion_seg', 'formato', 'estilo', 'musica', 'escenas', 'cierre'],
  properties: {
    titulo: { type: 'string' },
    duracion_seg: { type: 'integer', description: '30 a 90' },
    formato: { type: 'string', description: 'Horizontal 16:9 o vertical 9:16, según para qué sirve.' },
    estilo: { type: 'string', description: 'Look del video: colores NXUS (azul marino, dorado), ritmo, transiciones.' },
    musica: { type: 'string' },
    escenas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['segundos', 'imagen', 'texto_pantalla', 'voz', 'movimiento'],
        properties: { segundos: { type: 'integer' }, imagen: { type: 'string', description: 'Nombre exacto de un archivo de la lista, o "" si es una escena de texto.' }, texto_pantalla: { type: 'string' }, voz: { type: 'string', description: 'Lo que dice la voz en off.' }, movimiento: { type: 'string', description: 'Movimiento de cámara o animación.' } },
      },
    },
    cierre: { type: 'string', description: 'Escena final: llamada a la acción de NXUS.' },
  },
}

/** Solo links públicos de internet (nada de la red interna). */
function linkSeguro(s) {
  let u
  try {
    u = new URL(String(s || '').trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(u.protocol)) return null
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^(\d+\.){3}\d+$/.test(host) || host.includes(':')) return null
  return u
}

async function textoDe(u) {
  try {
    const res = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (NXUS portafolio)' }, redirect: 'follow', signal: AbortSignal.timeout(8000) })
    const html = (await res.text()).slice(0, 600_000)
    const titulo = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ''
    const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? ''
    const cuerpo = html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return `Título: ${titulo}\nDescripción: ${desc}\n${cuerpo.slice(0, 12000)}`
  } catch {
    return ''
  }
}

async function fotoDe(u) {
  const aDataUrl = async (res) => {
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 2000 || buf.length > 4_500_000) return null
    return `data:${res.headers.get('content-type').split(';')[0]};base64,${buf.toString('base64')}`
  }
  try {
    const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(u)}&screenshot=true&meta=false&viewport.width=1366&viewport.height=900&waitForTimeout=1500`, { signal: AbortSignal.timeout(20000) })
    const d = await r.json()
    const img = d?.data?.screenshot?.url
    if (img) {
      const foto = await aDataUrl(await fetch(img, { signal: AbortSignal.timeout(10000) }))
      if (foto) return foto
    }
  } catch {}
  try {
    return await aDataUrl(await fetch(`https://image.thum.io/get/width/1366/crop/900/noanimate/${u}`, { signal: AbortSignal.timeout(20000) }))
  } catch {
    return null
  }
}

const bloqueImagen = (d) => {
  const m = String(d).match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/)
  return m ? { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } } : null
}

async function preguntar(client, { system, contenido, esquema, effort = 'low', max = 8000 }) {
  const res = await client.beta.messages.create({
    model: MODELO,
    max_tokens: max,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort, format: { type: 'json_schema', schema: esquema } },
    system,
    messages: [{ role: 'user', content: contenido }],
  })
  if (res.stop_reason === 'refusal') throw new Error('La IA no pudo trabajar con esto')
  return JSON.parse(res.content.filter((x) => x.type === 'text').map((x) => x.text).join(''))
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin' && !(yo.perfil.permisos ?? []).includes('portafolio')) return json({ ok: false, error: 'No tienes permiso para el portafolio' }, 403)
  const b = await req.json().catch(() => ({}))
  try {
    if (b.accion === 'captura') {
      const u = linkSeguro(b.link)
      if (!u) return json({ ok: false, error: 'Ese link no se puede abrir (debe empezar con https://)' }, 400)
      const [imagen, texto] = await Promise.all([fotoDe(u.href), textoDe(u.href)])
      if (!imagen && !texto) return json({ ok: false, error: 'No pude abrir esa página' }, 502)
      return json({ ok: true, imagen, texto })
    }
    if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'Falta ANTHROPIC_API_KEY en Netlify' }, 503)
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 1 })

    if (b.accion === 'analizar') {
      const imgs = (Array.isArray(b.imagenes) ? b.imagenes : []).slice(0, 8).map(bloqueImagen).filter(Boolean)
      const texto = String(b.texto || '').slice(0, 20000)
      const notas = String(b.notas || '').slice(0, 3000)
      if (!imgs.length && !texto && !notas) return json({ ok: false, error: 'Sube algo o pega un link' }, 400)
      const contenido = [
        ...imgs.flatMap((im, i) => [{ type: 'text', text: `Imagen ${i}:` }, im]),
        { type: 'text', text: [b.link ? `Link del trabajo (es del cliente: no lo pongas en la ficha): ${String(b.link).slice(0, 300)}` : '', notas ? `Notas de NXUS: ${notas}` : '', texto ? `Texto del trabajo:\n${texto}` : '', `Hay ${imgs.length} imágenes. Haz la ficha y marca las zonas borrosas.`].filter(Boolean).join('\n\n') },
      ]
      const f = await preguntar(client, { system: SISTEMA_FICHA, contenido, esquema: ESQUEMA_FICHA, effort: 'medium', max: 10000 })
      const c = (n) => Math.min(1, Math.max(0, Number(n) || 0))
      f.zonas = (f.zonas ?? []).filter((z) => z.imagen >= 0 && z.imagen < imgs.length).map((z) => ({ ...z, x: c(z.x), y: c(z.y), w: c(z.w), h: c(z.h) })).filter((z) => z.w > 0 && z.h > 0)
      if (!CATEGORIAS.includes(f.categoria)) f.categoria = 'otro'
      return json({ ok: true, ficha: f })
    }

    if (b.accion === 'pedir') {
      const solicitud = String(b.solicitud || '').trim().slice(0, 2000)
      if (!solicitud) return json({ ok: false, error: 'Dime qué portafolio necesitas' }, 400)
      const idioma = b.idioma === 'en' ? 'en' : 'es'
      const trabajos = await sb('/rest/v1/portafolio_trabajos?select=id,titulo,categoria,industria,ficha,fecha&estado=eq.aprobado&order=fecha.desc&limit=300', { token: yo.token })
      if (!trabajos.length) return json({ ok: false, error: 'Todavía no hay trabajos aprobados en el portafolio' }, 400)
      const catalogo = trabajos
        .map((t) => `- id ${t.id} · ${t.fecha} · ${t.categoria} · ${t.industria}\n  ${t.titulo}: ${t.ficha?.descripcion ?? ''} Reto: ${t.ficha?.reto ?? ''} Solución: ${t.ficha?.solucion ?? ''} Resultados: ${(t.ficha?.resultados ?? []).join('; ')} Servicios: ${(t.ficha?.servicios ?? []).join(', ')}`)
        .join('\n')
      const out = await preguntar(client, {
        system: `Eres la IA del portafolio de NXUS AI (agencia de Eduardo Ramos: sitios web, automatizaciones, agentes de IA, marketing; en Estados Unidos y México). Armas portafolios a la medida para mandar a prospectos. Escoges SOLO de los trabajos del catálogo (usa sus id exactos), los más relevantes para lo que piden, y los describes pensando en lo que le importa a ese cliente. Nunca inventes trabajos, clientes ni resultados, y nunca pongas datos que identifiquen a los clientes. Escribe todo lo que ve el cliente en ${idioma === 'en' ? 'inglés' : 'español'}; "nota_para_ti" siempre en español.`,
        contenido: `Lo que necesito: ${solicitud}\n${b.para ? `Es para: ${String(b.para).slice(0, 160)}\n` : ''}\nCatálogo de trabajos aprobados (${trabajos.length}):\n${catalogo}`,
        esquema: ESQUEMA_PEDIDO,
        effort: 'medium',
      })
      const ids = new Set(trabajos.map((t) => t.id))
      out.trabajos = (out.trabajos ?? []).filter((t) => ids.has(t.id))
      return json({ ok: true, portafolio: out })
    }

    if (b.accion === 'video') {
      const p = b.pedido ?? {}
      const archivos = (Array.isArray(b.archivos) ? b.archivos : []).slice(0, 60).map((a) => `- ${String(a.archivo).slice(0, 80)} → ${String(a.trabajo).slice(0, 160)}`)
      const out = await preguntar(client, {
        system: 'Eres director creativo de NXUS AI. Conviertes un portafolio en el guion de un video corto y elegante para mandar a un prospecto: escenas claras, voz en off natural, textos en pantalla cortos. Usa solo las imágenes de la lista (nombre exacto). Las imágenes ya vienen con lo confidencial borroso: no pidas quitar lo borroso. Escribe en el mismo idioma que el portafolio.',
        contenido: `Portafolio:\n${JSON.stringify({ titulo: p.titulo, subtitulo: p.subtitulo, introduccion: p.introduccion, trabajos: (p.trabajos ?? []).map((t) => ({ titulo: t.titulo, texto: t.texto, puntos: t.puntos })), cierre: p.cierre }).slice(0, 20000)}\n\nImágenes disponibles:\n${archivos.join('\n')}`,
        esquema: ESQUEMA_VIDEO,
      })
      return json({ ok: true, video: out })
    }
    return json({ ok: false, error: 'acción desconocida' }, 400)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ ok: false, error: 'Muchas peticiones seguidas; espera un momento.' }, 429)
    if (err instanceof Anthropic.APIError) return json({ ok: false, error: `La IA no pudo (${err.status})` }, 502)
    return json({ ok: false, error: String(err?.message ?? err).slice(0, 200) }, 502)
  }
}
