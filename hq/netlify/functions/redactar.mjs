// El texto de una foto o video que subió Eduardo: él solo dice qué quiere
// lograr y a qué negocios; Claude escribe la publicación (o el anuncio) en
// español, con la voz de NXUS AI, y explica en una línea por qué así. Solo el admin.
import Anthropic from '@anthropic-ai/sdk'
import { json, quien, sb } from '../lib/sb.mjs'

const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['texto', 'idea'],
  properties: {
    texto: { type: 'string', description: 'El texto de la publicación, listo para Instagram y Facebook.' },
    idea: { type: 'string', description: 'Una línea: por qué se escribió así (a quién le habla y qué dolor toca).' },
  },
}

const SISTEMA = `Escribes los textos de las publicaciones y anuncios de NXUS AI en Instagram y Facebook.
NXUS AI hace software y automatizaciones a la medida para negocios (sistemas que contestan, cotizan y agendan solos, inventarios que se piden solos, control del personal, todo el negocio en un solo sistema, IA que conoce el negocio).
Reglas:
- Español natural, cálido y directo; para dueños de negocio. Nada de tecnicismos.
- La primera línea es el problema concreto del negocio al que le hablas (que se sienta: "¿Se te acaban los productos y te enteras tarde?").
- Después, en 1 o 2 líneas, el resultado que logran con NXUS AI, "a la medida".
- Nunca nombres herramientas, marcas de software, IA de terceros, ni clientes. Nunca des precios ni prometas cifras.
- Máximo 2 o 3 emojis, sin exagerar. Máximo 450 caracteres.
- Termina siempre con la llamada: si es anuncio "Escríbenos INFO 👇"; si es solo feed "Comenta INFO y te contamos cómo lo haríamos en tu negocio."
- Si el mercado es USA, háblale al dueño hispano en USA; si es México, al de México.`

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo el administrador' }, 403)
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'Falta ANTHROPIC_API_KEY en Netlify' }, 503)
  const { id } = await req.json().catch(() => ({}))
  if (!/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) return json({ ok: false, error: 'falta la pieza' }, 400)
  try {
    const [c] = await sb(`/rest/v1/contenido?id=eq.${id}&select=*`, { token: yo.token })
    if (!c) return json({ ok: false, error: 'Esa pieza no existe' }, 404)
    const pide = [
      `Tipo: ${c.tipo === 'video' ? 'video' : 'foto'} · ${c.uso === 'anuncio' ? 'ANUNCIO (también sale al feed)' : 'solo FEED'} · Mercado: ${{ usa: 'USA', mexico: 'México', ambos: 'USA y México' }[c.mercado]}`,
      `Título del video (de Eduardo): ${c.titulo}`,
      `Lo que Eduardo quiere lograr y a qué negocios: ${c.objetivo || c.titulo}`,
      c.comentario ? `Cambio que pidió Eduardo sobre el texto anterior: ${c.comentario}\nTexto anterior: ${c.texto}` : '',
    ].filter(Boolean).join('\n')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 })
    const res = await client.messages.create({
      model: 'claude-sonnet-5-5',
      max_tokens: 1500,
      output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
      system: SISTEMA,
      messages: [{ role: 'user', content: pide }],
    })
    const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''))
    const cambio = { texto: String(out.texto).slice(0, 2200), idea: String(out.idea).slice(0, 2000), comentario: '', ...(c.estado === 'rechazado' ? { estado: 'aprobado' } : {}) }
    await sb(`/rest/v1/contenido?id=eq.${c.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: cambio })
    return json({ ok: true, ...cambio })
  } catch (err) {
    console.log('redactar:', err?.status ?? '', err?.message ?? err)
    return json({ ok: false, error: 'La IA no respondió a tiempo. Intenta otra vez con "✦ Escribir texto".' }, 502)
  }
}
