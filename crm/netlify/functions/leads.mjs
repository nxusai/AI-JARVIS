// Website leads: el formulario «Cotizar / Get a quote» de misemago.com manda aquí
// cada solicitud. No pide sesión (cualquiera en el sitio puede escribir), así
// que todo se revisa en este lado y se guarda con la llave de servicio. Dentro
// del Centro de trabajo aparece en la pestaña WEBSITE LEADS.
import { json, sb } from '../lib/sb.mjs'

// El sitio vive en otro dominio: el navegador pregunta antes de mandar (CORS).
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
}
const responder = (o, status = 200) => {
  const r = json(o, status)
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v)
  return r
}

export const TIPOS = ['Cadena de supermercados', 'Distribuidor', 'Marca propia nueva', 'Restaurante / food service', 'Otro']
const texto = (v, max) => String(v ?? '').replace(/[<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max)
const linea = (v, max) => texto(v, max).replace(/\s+/g, ' ')

// Pocas solicitudes por persona y por minuto, para frenar robots.
const vistos = new Map()
function demasiadas(ip) {
  const ahora = Date.now()
  const lista = (vistos.get(ip) || []).filter((t) => ahora - t < 60_000)
  lista.push(ahora)
  vistos.set(ip, lista)
  if (vistos.size > 5000) vistos.clear()
  return lista.length > 5
}

export default async (req, context) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return responder({ ok: false, error: 'POST' }, 405)
  if (!process.env.SUPABASE_SERVICE_KEY) return responder({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  if (demasiadas(context?.ip || 'anon')) return responder({ ok: false, error: 'Demasiadas solicitudes. Intenta en un minuto.' }, 429)
  const d = await req.json().catch(() => ({}))
  if (d.sitio) return responder({ ok: true }) // trampa para robots: un humano nunca llena ese campo

  const nombre = linea(d.nombre, 80)
  const correo = linea(d.correo, 160).toLowerCase()
  const telefono = linea(d.telefono, 40)
  if (nombre.length < 2) return responder({ ok: false, error: 'Falta el nombre' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return responder({ ok: false, error: 'El correo no es válido' }, 400)
  const tipo = TIPOS.includes(d.tipo) ? d.tipo : null
  const intereses = (Array.isArray(d.intereses) ? d.intereses : []).map((x) => linea(x, 40)).filter(Boolean).slice(0, 10)

  try {
    await sb('/rest/v1/website_leads', {
      servicio: true,
      method: 'POST',
      prefer: 'return=minimal',
      body: {
        nombre,
        empresa: linea(d.empresa, 120),
        correo,
        telefono,
        tipo,
        intereses,
        mensaje: texto(d.mensaje, 4000),
        propuesta: texto(d.propuesta, 2000),
        idioma: d.idioma === 'en' ? 'en' : 'es',
        origen: linea(d.origen, 200),
      },
    })
    return responder({ ok: true })
  } catch {
    return responder({ ok: false, error: 'No pudimos guardar tu solicitud. Intenta otra vez en un momento.' }, 500)
  }
}
