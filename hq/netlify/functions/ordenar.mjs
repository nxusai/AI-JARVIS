// "Escríbele el cliente y la IA lo organiza": Eduardo describe con sus
// palabras qué hace NXUS para un cliente (o qué hará) y cuánto paga; Claude lo
// convierte en la ficha del cliente, su dinero y las primeras tareas. Nada se
// guarda aquí: la página le enseña el resultado y él lo guarda. Solo el admin.
import Anthropic from '@anthropic-ai/sdk'
import { json, quien } from '../lib/sb.mjs'

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['nombre', 'grupo', 'estado', 'equipo', 'servicios', 'descripcion', 'contacto_nombre', 'contacto_correo', 'contacto_tel', 'inicio', 'mensualidad', 'pago_unico', 'moneda', 'dia_cobro', 'tareas', 'dudas'],
  properties: {
    nombre: { type: 'string', description: 'Nombre del cliente o empresa.' },
    grupo: { type: 'string', description: 'Holding o grupo al que pertenece; vacío si no se dijo.' },
    estado: { type: 'string', enum: ['prospecto', 'activo', 'pausado', 'terminado'] },
    equipo: { type: 'string', enum: ['usa', 'mexico'], description: 'Qué equipo lo atiende: NXUS USA o NXUS México.' },
    servicios: { type: 'array', items: { type: 'string' }, description: 'Cada servicio en pocas palabras (Sitio web, Anuncios en Meta, CRM a la medida, Contenido…).' },
    descripcion: { type: 'string', description: 'Dos o tres líneas: qué hacemos o haremos y cualquier contexto útil.' },
    contacto_nombre: { type: 'string' },
    contacto_correo: { type: 'string' },
    contacto_tel: { type: 'string' },
    inicio: { type: 'string', description: 'Fecha de inicio AAAA-MM-DD si se dijo; vacío si no.' },
    mensualidad: { type: 'number', description: 'Lo que paga al mes; 0 si no se dijo.' },
    pago_unico: { type: 'number', description: 'Pago de una sola vez (proyecto); 0 si no se dijo.' },
    moneda: { type: 'string', enum: ['USD', 'MXN'] },
    dia_cobro: { type: 'integer', description: 'Día del mes en que se cobra; 0 si no se dijo.' },
    tareas: {
      type: 'array',
      description: 'Las primeras tareas concretas para arrancar con este cliente (máximo 8), en orden.',
      items: { type: 'object', additionalProperties: false, required: ['titulo', 'detalle'], properties: { titulo: { type: 'string' }, detalle: { type: 'string' } } },
    },
    dudas: { type: 'array', items: { type: 'string' }, description: 'Lo que falta saber para completar la ficha (máximo 4).' },
  },
}

const SISTEMA =
  'Eres el sistema de NXUS AI, la agencia de IA y marketing de Eduardo Ramos (NXUS USA en Nueva Jersey y NXUS México). ' +
  'Eduardo te describe un cliente con sus palabras. Ordénalo en la ficha. No inventes datos: lo que no se dijo va vacío o en 0 y, si importa, en "dudas". ' +
  'Si no dice moneda, USD para NXUS USA y MXN para NXUS México. Las tareas deben ser concretas y accionables por el equipo.'

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo el administrador' }, 403)
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'Falta ANTHROPIC_API_KEY en Netlify' }, 503)
  const { texto } = await req.json().catch(() => ({}))
  const t = String(texto || '').trim().slice(0, 6000)
  if (t.length < 10) return json({ ok: false, error: 'Escribe un poco más del cliente' }, 400)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25_000, maxRetries: 1 })
  try {
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
      system: SISTEMA,
      messages: [{ role: 'user', content: t }],
    })
    if (res.stop_reason === 'refusal') return json({ ok: false, error: 'La IA no pudo con eso. Escríbelo de otra forma.' }, 422)
    const texto = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
    return json({ ok: true, ficha: JSON.parse(texto) })
  } catch (err) {
    console.log('ordenar:', err?.status ?? '', err?.message ?? err)
    return json({ ok: false, error: 'La IA no respondió a tiempo. Intenta otra vez.' }, 502)
  }
}
