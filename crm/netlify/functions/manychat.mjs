// La puerta por donde entran los leads de Mi Semago: ManyChat (WhatsApp) la
// llama al terminar el chat corto (nombre, negocio y ciudad, la hora para
// llamarle y el permiso por escrito). Guarda el lead en "leads"; Ana Sofi, en
// la computadora del sistema, lo ve y le llama.
//
// Solo responde si viene la clave: encabezado "x-manychat-clave" igual a
// MANYCHAT_CLAVE en Netlify. Usa la llave de servicio solo para la tabla leads.
import { timingSafeEqual } from 'node:crypto'
import { json, sb } from '../lib/sb.mjs'

// Un campo vacío en ManyChat puede llegar como la variable sin reemplazar ("{{cuf_123}}", "{{phone}}"): eso cuenta como vacío.
const texto = (v, n) => String(v ?? '').replace(/\{\{[^{}]*\}\}/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const SI = /^(s[ií]+|yes|y|ok|okay|claro|dale|va|por favor|sure|yeah|yep|1|true)(?=$|[\s,.!¡?¿])/i

function claveBuena(dada) {
  const buena = process.env.MANYCHAT_CLAVE || ''
  const a = Buffer.from(String(dada || ''))
  const b = Buffer.from(buena)
  return buena.length >= 20 && a.length === b.length && timingSafeEqual(a, b)
}

/**
 * "Tienda La Esperanza, Houston TX" o "Carnicería El Toro en Dallas": la
 * respuesta a "¿cómo se llama tu negocio y en qué ciudad está?", separada.
 * Si no se puede separar, todo queda como negocio (Ana Sofi confirma la ciudad).
 */
export function separarNegocio(t) {
  const s = texto(t, 200)
  const corte = (i, largo) => ({ negocio: s.slice(0, i).trim().replace(/[,-]$/, '').trim().slice(0, 120), ciudad: s.slice(i + largo).trim().slice(0, 80) })
  const en = Math.max(s.toLowerCase().lastIndexOf(' en '), s.toLowerCase().lastIndexOf(' in '))
  if (en > 0) return corte(en, 4)
  const guion = s.lastIndexOf(' - ')
  if (guion > 0) return corte(guion, 3)
  const coma = s.indexOf(',')
  if (coma > 0) return corte(coma, 1)
  return { negocio: s.slice(0, 120), ciudad: '' }
}

/** Las etapas en las que un lead que vuelve a escribir (y da permiso) se llama otra vez. */
const TERMINADAS = new Set(['hablo', 'no_contesto', 'cerrado', 'no_califica', 'no_llamar'])

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  if (!claveBuena(req.headers.get('x-manychat-clave'))) return json({ ok: false, error: 'clave incorrecta' }, 401)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const d = await req.json().catch(() => null)
  if (!d) return json({ ok: false, error: 'Mándame JSON' }, 400)

  const manychat_id = texto(d.contacto_id ?? d.contact_id ?? d.id, 80)
  if (!manychat_id) return json({ ok: false, error: 'Falta contacto_id' }, 400)
  const respuesta = texto(d.permiso, 120)
  const permiso = d.permiso === true || SI.test(respuesta)
  const junto = d.negocio_ciudad ? separarNegocio(d.negocio_ciudad) : {}
  const datos = {
    nombre: texto(d.nombre, 80),
    negocio: texto(d.negocio, 120) || junto.negocio || '',
    ciudad: texto(d.ciudad, 80) || junto.ciudad || '',
    telefono: texto(d.telefono, 30),
    hora_pedida: texto(d.hora, 200),
    idioma: /^en/i.test(String(d.idioma ?? '')) ? 'en' : 'es',
    // De qué anuncio llegó (campo "MS Fuente" en ManyChat).
    fuente: texto(d.fuente, 120),
  }
  if (!datos.fuente) delete datos.fuente
  // Lo que venga vacío no borra lo que ya había.
  const lleno = Object.fromEntries(Object.entries(datos).filter(([, v]) => v))
  const permisoTexto = texto(d.permiso_texto, 300) || `Respondió "${respuesta || 'sí'}" a: ¿Te podemos llamar para darte precios?`

  try {
    const [antes] = await sb(`/rest/v1/leads?manychat_id=eq.${encodeURIComponent(manychat_id)}&select=id,etapa,permiso_llamada`, { servicio: true })
    if (!antes) {
      const [nuevo] = await sinFuenteSiFalta('/rest/v1/leads', {
        servicio: true,
        method: 'POST',
        body: {
          manychat_id,
          origen: 'manychat',
          ...datos,
          permiso_llamada: permiso,
          permiso_texto: permiso ? permisoTexto : '',
          etapa: permiso ? 'nuevo' : 'no_llamar',
        },
      })
      if (!permiso) await nota(nuevo.id, `En el chat no dio permiso para que le llamen ("${respuesta || 'sin respuesta'}"). Ana Sofi no le llama.`)
      return json({ ok: true, id: nuevo.id, llamar: permiso })
    }
    // Ya existía: se actualizan sus datos; si vuelve a pedir llamada, se le llama otra vez.
    const otraVez = permiso && TERMINADAS.has(antes.etapa)
    await sinFuenteSiFalta(`/rest/v1/leads?id=eq.${antes.id}`, {
      servicio: true,
      method: 'PATCH',
      body: {
        ...lleno,
        ...(permiso && !antes.permiso_llamada ? { permiso_llamada: true, permiso_texto: permisoTexto } : {}),
        ...(otraVez ? { etapa: 'nuevo', llamada_programada: null, llamada_estado: '' } : {}),
      },
    })
    await nota(antes.id, otraVez ? `Volvió a escribir por WhatsApp y pidió que le llamen${datos.hora_pedida ? ` (${datos.hora_pedida})` : ''}. Ana Sofi le vuelve a llamar.` : `Volvió a escribir por WhatsApp${datos.hora_pedida ? `; hora que pidió: ${datos.hora_pedida}` : ''}.`)
    return json({ ok: true, id: antes.id, llamar: permiso })
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}

/** Si la base de datos todavía no tiene la columna "fuente" (falta correr el esquema), se guarda sin ella: nunca se pierde un lead. */
async function sinFuenteSiFalta(path, opts) {
  try {
    return await sb(path, opts)
  } catch (err) {
    if (!/fuente/i.test(err.message) || !opts.body || !('fuente' in opts.body)) throw err
    const { fuente: _f, ...body } = opts.body
    return sb(path, { ...opts, body })
  }
}

async function nota(lead_id, texto) {
  await sb('/rest/v1/leads_notas', { servicio: true, method: 'POST', body: { lead_id, texto, autor_nombre: 'WhatsApp' } }).catch(() => {})
}
