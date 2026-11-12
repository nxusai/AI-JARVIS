// Website leads: el formulario «Cotizar / Get a quote» de misemago.com manda aquí
// cada solicitud. No pide sesión (cualquiera en el sitio puede escribir), así
// que todo se revisa en este lado y se guarda con la llave de servicio. Dentro
// del Centro de trabajo aparece en la pestaña WEBSITE LEADS.
// Si la persona marcó «Quiero que me llamen» (su permiso por escrito) y dejó un
// número, también entra a Leads con lo que ya contó en el formulario: NEX lo ve
// como cualquier lead con permiso y Ana Sofi le llama.
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
  const empresa = linea(d.empresa, 120)
  const mensaje = texto(d.mensaje, 4000)
  const propuesta = texto(d.propuesta, 2000)
  const idioma = d.idioma === 'en' ? 'en' : 'es'
  const digitos = telefono.replace(/\D/g, '')
  const llamar = d.llamar === true && digitos.length >= 10
  if (d.llamar === true && !llamar) return responder({ ok: false, error: 'Para que te llamemos necesitamos tu teléfono' }, 400)

  // Para Ana Sofi: lo que ya sabemos, para que no lo vuelva a preguntar.
  let leadId = null
  if (llamar) {
    const e = d.estudio && typeof d.estudio === 'object' ? d.estudio : {}
    const queso = linea(e.queso, 120)
    try {
      const [l] = await sb('/rest/v1/leads', {
        servicio: true,
        method: 'POST',
        body: {
          origen: 'web',
          nombre,
          negocio: empresa,
          ciudad: linea(e.destino, 80),
          telefono: telefono.slice(0, 30),
          correo: correo.slice(0, 120),
          idioma,
          hora_pedida: idioma === 'en' ? 'As soon as possible (asked on misemago.com)' : 'Lo antes posible (lo pidió en misemago.com)',
          permiso_llamada: true,
          permiso_texto: linea(d.permiso_texto, 480) || 'Marcó «Quiero que me llamen» en el formulario de misemago.com.',
          tipo_negocio: tipo || '',
          quesos: [queso, ...intereses].filter(Boolean).join(', ').slice(0, 300),
          libras: e.libras_semana ? linea(`${e.libras_semana} lb por semana (lo calculó en el Estudio de Marca)`, 120) : '',
          marca_propia: e.marca ? linea(`Sí, quiere su marca «${e.marca}»`, 200) : tipo === 'Marca propia nueva' ? 'Sí, quiere lanzar su marca' : '',
          resumen: texto(['Llegó por misemago.com y pidió que le llamen.', mensaje && `Mensaje: ${mensaje}`, propuesta].filter(Boolean).join('\n\n'), 4000),
        },
      })
      leadId = l?.id ?? null
    } catch (err) {
      console.log('leads: no pude crear el lead para Ana Sofi:', err.message)
    }
  }

  try {
    await sb('/rest/v1/website_leads', {
      servicio: true,
      method: 'POST',
      prefer: 'return=minimal',
      body: {
        nombre,
        empresa,
        correo,
        telefono,
        tipo,
        intereses,
        mensaje,
        propuesta,
        idioma,
        origen: linea(d.origen, 200),
        ...(leadId ? { lead_id: leadId } : {}),
      },
    })
    return responder({ ok: true, llamada: Boolean(leadId) })
  } catch {
    return responder({ ok: false, error: 'No pudimos guardar tu solicitud. Intenta otra vez en un momento.' }, 500)
  }
}
