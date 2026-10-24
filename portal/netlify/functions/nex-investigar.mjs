import Anthropic from '@anthropic-ai/sdk'
import { clean, env, json, nexAutorizado } from '../lib/comun.mjs'

/**
 * Lo que NEX investiga en internet mientras habla contigo por teléfono. La
 * agente de llamadas de ElevenLabs la llama como herramienta ("investigar")
 * con tu pregunta, y lee en voz alta lo que esto contesta. Solo con la llave
 * de las llamadas: nadie más la puede usar.
 */

const SYSTEM =
  'Eres NEX y estás en una llamada de voz con Eduardo, tu jefe. Investiga en internet lo que te pide y contesta como se dice en voz alta: ' +
  'en español (o en inglés si te pregunta en inglés), de dos a cinco frases, el dato primero, con números y fechas dichos como se hablan. ' +
  'Sin listas, sin links, sin fuentes, sin markdown. Tono frío, seguro y directo: nada de expresiones ni entusiasmo. ' +
  'Si no encuentras algo confiable, dilo en una frase.'

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'usa POST' }, 405)
  if (!nexAutorizado(req)) return json({ error: 'sin permiso' }, 401)
  const body = await req.json().catch(() => ({}))
  const pregunta = clean(body?.pregunta, 1500)
  if (!pregunta) return json({ respuesta: 'No escuché la pregunta.' })
  if (!env('ANTHROPIC_API_KEY')) return json({ respuesta: 'No tengo acceso a internet ahorita: falta la llave en Netlify.' })

  const client = new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), timeout: 25_000, maxRetries: 0 })
  const messages = [{ role: 'user', content: pregunta }]
  try {
    let res
    // A long search can pause the turn; it picks up where it stopped.
    for (let i = 0; i < 3; i++) {
      res = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 2000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
        messages,
      })
      if (res.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: res.content })
    }
    if (res.stop_reason === 'refusal') return json({ respuesta: 'Eso no lo puedo contestar.' })
    const texto = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    return json({ respuesta: texto || 'No encontré nada confiable.' })
  } catch (err) {
    console.log('investigar:', err?.status ?? '', err?.message ?? err)
    return json({ respuesta: 'La búsqueda no respondió a tiempo. Pídemelo de nuevo o te lo mando por Telegram.' })
  }
}
