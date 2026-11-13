// STOIC: la IA de la hoja de lo que Eduardo aprende (solo él). Es un NEX aparte: solo conoce sus
// notas de STOIC, nada más de HQ, y no comparte memoria con el NEX de HQ.
//   { accion: 'resumir', tipo, titulo, autor, texto }  → bullets, lecciones, una frase, etiquetas y tarjetas para estudiar
//   { accion: 'preguntar', mensajes }                   → le contesta con lo que ha escrito ("recuerda lo que escribiste el…")
import Anthropic from '@anthropic-ai/sdk'
import { json, quien, sb } from '../lib/sb.mjs'

const MODELO = 'claude-opus-5-5'

const ESQUEMA_RESUMEN = {
  type: 'object',
  additionalProperties: false,
  required: ['titulo', 'bullets', 'lecciones', 'frase', 'etiquetas', 'tarjetas'],
  properties: {
    titulo: { type: 'string', description: 'Título corto si él no puso uno; si puso, el suyo.' },
    bullets: { type: 'array', items: { type: 'string' }, description: 'Lo más importante, 3 a 7 bullets cortos y claros.' },
    lecciones: { type: 'array', items: { type: 'string' }, description: '1 a 4 lecciones para su vida: qué hacer o no hacer, en primera persona ("Cuando…, yo…").' },
    frase: { type: 'string', description: 'Una frase para recordar todo esto, como un mantra.' },
    etiquetas: { type: 'array', items: { type: 'string' }, description: '1 a 5 temas en minúsculas: disciplina, dinero, relaciones, liderazgo, salud, mentalidad, negocios, familia, amor, hábitos…' },
    tarjetas: {
      type: 'array',
      description: '2 a 5 tarjetas para estudiar (pregunta y respuesta) que le ayuden a tenerlo presente.',
      items: { type: 'object', additionalProperties: false, required: ['frente', 'reverso'], properties: { frente: { type: 'string' }, reverso: { type: 'string' } } },
    },
  },
}

const SISTEMA_RESUMEN =
  'Eres STOIC, el cuaderno de sabiduría de Eduardo Ramos (empresario mexicano, dueño de NXUS AI). Él te da lo que aprendió (de un libro, un podcast, un video, una conversación o la vida). ' +
  'Resúmelo en español, claro y directo: lo más importante en bullets, las lecciones para su vida, una frase para recordarlo y tarjetas de estudio. ' +
  'No inventes nada que no esté en lo que escribió; si su nota es corta, el resumen también.'

const SISTEMA_CHAT = `Eres STOIC, el mentor personal de Eduardo Ramos. Eres un NEX aparte, solo para su cuaderno STOIC: lo único que conoces de él es lo que ha escrito ahí (libros, podcasts, videos, conversaciones, lecciones de vida). No sabes nada de su negocio ni de HQ salvo lo que esté en esas notas.

Cómo le ayudas:
- Le contestas con base en lo que él ha escrito. Cuando algo viene de una nota, díselo con su fecha y su fuente: "Recuerda lo que escribiste el 3 de marzo, de 'Meditaciones' de Marco Aurelio: …" o "Conforme a lo que has aprendido y anotado aquí, te aconsejo…".
- Si te pide consejo (de dinero, de su negocio, de una mujer, de su familia, de él mismo), primero busca en sus notas lo que aplica y recuérdaselo; luego aconséjalo en concreto. Si sus notas no cubren el tema, díselo y dale un consejo sabio general, aclarando que eso no está en su cuaderno.
- Le ayudas a no repetir errores ni patrones: si lo que cuenta se parece a algo que ya escribió que aprendió, señálalo con cariño y firmeza.
- Puedes hacerle preguntas para que repase ("¿te acuerdas qué aprendiste de…?").
Tu estilo: cálido, sereno y directo, como un mentor estoico. Español de México, tuteándolo. Respuestas cortas (3 a 6 frases) salvo que pida más; sin listas largas ni markdown pesado. Nunca inventes una nota que no existe ni cambies lo que escribió.`

/** Su cuaderno, para que STOIC lo lea. Si es mucho, el texto completo solo de las notas que más tienen que ver. */
function cuaderno(notas, pregunta) {
  const palabras = String(pregunta || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\W+/)
    .filter((w) => w.length > 3)
  const puntos = (n) => {
    const t = `${n.titulo} ${n.autor} ${n.texto} ${JSON.stringify(n.resumen)}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return palabras.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0)
  }
  const grande = notas.reduce((s, n) => s + n.texto.length, 0) > 120_000
  const cercanas = new Set(grande ? [...notas].sort((a, b) => puntos(b) - puntos(a)).slice(0, 15).map((n) => n.id) : notas.map((n) => n.id))
  const fecha = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  return notas
    .map((n) => {
      const r = n.resumen || {}
      return [
        `### ${fecha(n.fecha)} · ${n.tipo}${n.titulo ? ` · "${n.titulo}"` : ''}${n.autor ? ` de ${n.autor}` : ''}`,
        r.bullets?.length ? `Lo importante: ${r.bullets.join(' | ')}` : '',
        r.lecciones?.length ? `Lecciones: ${r.lecciones.join(' | ')}` : '',
        r.frase ? `Frase: ${r.frase}` : '',
        cercanas.has(n.id) ? `Lo que escribió: ${n.texto.slice(0, grande ? 3000 : 6000)}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'STOIC es solo para Eduardo' }, 403)
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'Falta ANTHROPIC_API_KEY en Netlify' }, 503)
  const b = await req.json().catch(() => ({}))
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 })
  try {
    if (b.accion === 'resumir') {
      const texto = String(b.texto || '').trim()
      if (!texto) return json({ ok: false, error: 'Escribe lo que aprendiste' }, 400)
      const res = await client.beta.messages.create({
        model: MODELO,
        max_tokens: 6000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_RESUMEN } },
        system: SISTEMA_RESUMEN,
        messages: [{ role: 'user', content: `Tipo: ${b.tipo || 'otro'}\nTítulo: ${b.titulo || '(sin título)'}\nAutor: ${b.autor || ''}\n\nLo que aprendí:\n${texto.slice(0, 30000)}` }],
      })
      if (res.stop_reason === 'refusal') return json({ ok: false, error: 'No pude resumir esto' }, 422)
      const out = JSON.parse(res.content.filter((x) => x.type === 'text').map((x) => x.text).join(''))
      return json({ ok: true, resumen: out })
    }
    if (b.accion === 'preguntar') {
      const historial = (Array.isArray(b.mensajes) ? b.mensajes : [])
        .filter((m) => ['user', 'assistant'].includes(m.role) && String(m.content || '').trim())
        .slice(-20)
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
      while (historial.length && historial[0].role !== 'user') historial.shift()
      if (!historial.length || historial.at(-1).role !== 'user') return json({ ok: false, error: 'Pregúntame algo' }, 400)
      const notas = await sb('/rest/v1/stoic_notas?select=id,fecha,tipo,titulo,autor,texto,resumen&order=fecha.asc&limit=1000', { token: yo.token })
      const hoy = new Date().toLocaleDateString('es-MX', { timeZone: 'America/New_York', dateStyle: 'full' })
      const contexto = notas.length ? `Hoy es ${hoy}. Su cuaderno STOIC (${notas.length} notas):\n\n${cuaderno(notas, historial.at(-1).content)}` : `Hoy es ${hoy}. Su cuaderno STOIC todavía está vacío: dile con cariño que empiece a escribir lo que aprende.`
      const res = await client.beta.messages.create({
        model: MODELO,
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        system: [{ type: 'text', text: SISTEMA_CHAT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: [{ type: 'text', text: contexto, cache_control: { type: 'ephemeral' } }] }, { role: 'assistant', content: 'Entendido. Tengo tu cuaderno presente.' }, ...historial],
      })
      if (res.stop_reason === 'refusal') return json({ ok: true, texto: 'De eso no te puedo aconsejar.' })
      const texto = res.content.filter((x) => x.type === 'text').map((x) => x.text).join('').trim()
      return json({ ok: true, texto: texto || 'No tengo algo que decirte de eso todavía.' })
    }
    return json({ ok: false, error: 'acción desconocida' }, 400)
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ ok: false, error: 'Muchas preguntas seguidas; espera un momento.' }, 429)
    if (err instanceof Anthropic.APIError) return json({ ok: false, error: `STOIC no pudo pensar (${err.status})` }, 502)
    return json({ ok: false, error: String(err?.message ?? err).slice(0, 200) }, 502)
  }
}
