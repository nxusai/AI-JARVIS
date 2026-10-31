// El resumen de la llamada y lo que anotó NEX, en español y en inglés: ElevenLabs
// los escribe en inglés y el equipo de NXUS no siempre lo lee. Se traducen una
// vez (al terminar la llamada o la primera vez que alguien abre la ficha) y se
// guardan en leads.traduccion = { es: { resumen, puntos }, en: { resumen, puntos } }.
import Anthropic from '@anthropic-ai/sdk'

const PUNTOS = ['empresa', 'necesidad', 'usa_hoy', 'decide', 'urgencia', 'presupuesto', 'consejo']
const version = { type: 'object', additionalProperties: false, required: ['resumen', 'puntos'], properties: { resumen: { type: 'string' }, puntos: { type: 'object', additionalProperties: false, required: PUNTOS, properties: Object.fromEntries(PUNTOS.map((k) => [k, { type: 'string' }])) } } }
const ESQUEMA = { type: 'object', additionalProperties: false, required: ['es', 'en'], properties: { es: version, en: version } }

const SISTEMA =
  'Traduces notas de llamadas de ventas de NXUS AI. Te doy un resumen y unas notas (pueden venir en inglés o en español). ' +
  'Devuelve las dos versiones completas: "es" en español natural de México y "en" en inglés. Conserva nombres, empresas, cifras y fechas tal cual. ' +
  'No agregues ni quites información. Una nota que no viene va como texto vacío.'

/** { es, en } a partir del resumen y los puntos; null si no hay nada que traducir o la IA no está. */
export async function traducir(resumen, puntos = {}) {
  const hay = String(resumen || '').trim() || PUNTOS.some((k) => String(puntos?.[k] || '').trim())
  if (!hay || !process.env.ANTHROPIC_API_KEY) return null
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 8_000, maxRetries: 0 })
  const notas = Object.fromEntries(PUNTOS.map((k) => [k, String(puntos?.[k] || '')]))
  const res = await client.messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 3000,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
    system: SISTEMA,
    messages: [{ role: 'user', content: JSON.stringify({ resumen: String(resumen || ''), notas }) }],
  })
  const texto = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const out = JSON.parse(texto)
  // Las notas vacías no se guardan, igual que en lead.puntos.
  for (const v of [out.es, out.en]) for (const k of PUNTOS) if (!String(v.puntos[k] || '').trim()) delete v.puntos[k]
  return out
}
