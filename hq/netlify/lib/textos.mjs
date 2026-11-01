// Cómo escribe la IA el texto de cada foto o video de NXUS AI (Instagram y
// Facebook). Primero VE la pieza (cuadros del video + lo que se dice en el
// audio) y el texto coincide con ella: si el video dice "escríbenos
// AUTOMATIZACIÓN", el texto pide exactamente esa palabra.
import Anthropic from '@anthropic-ai/sdk'

export const MODELO = 'claude-sonnet-5-5'

// Las palabras que ManyChat ya contesta (comentarios y mensajes, Instagram y Facebook).
// Si una pieza pide otra, no se publica sola: queda por aprobar hasta que Eduardo la agregue en ManyChat.
// (La misma lista está en hq/public/app.js.)
export const PALABRAS_MANYCHAT = ['INFO', 'OPERACIONES']
export const sinAcentos = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
export const palabraConocida = (p) => PALABRAS_MANYCHAT.includes(sinAcentos(p || 'INFO'))

export const SISTEMA = `Escribes los textos de las publicaciones y anuncios de NXUS AI en Instagram y Facebook.
NXUS AI hace software y automatizaciones a la medida para negocios (sistemas que contestan, cotizan y agendan solos, inventarios que se piden solos, control del personal, todo el negocio en un solo sistema, IA que conoce el negocio).
Reglas:
- Español natural, cálido y directo; para dueños de negocio. Nada de tecnicismos.
- El texto acompaña a la pieza: habla de lo mismo que el video o la foto (mismo problema, mismo negocio, mismas promesas). No contradigas ni inventes algo que no está en la pieza ni en lo que Eduardo pidió.
- La primera línea es el problema concreto del negocio al que le hablas (que se sienta: "¿Se te acaban los productos y te enteras tarde?").
- Después, en 1 o 2 líneas, el resultado que logran con NXUS AI, "a la medida".
- Nunca nombres herramientas, marcas de software, IA de terceros, ni clientes. Nunca des precios ni prometas cifras.
- Máximo 2 o 3 emojis, sin exagerar. Máximo 450 caracteres.
- La llamada final usa LA PALABRA que pide el video (en pantalla o en voz), escrita igual y en mayúsculas: si es anuncio "Escríbenos PALABRA 👇"; si es solo feed "Comenta PALABRA y te mandamos más info." Si el video no pide ninguna palabra, la palabra es INFO.
- Si el mercado es USA, háblale al dueño hispano en USA; si es México, al de México.`

const ESQUEMA_VER = {
  type: 'object',
  additionalProperties: false,
  required: ['analisis', 'palabra', 'texto', 'idea'],
  properties: {
    analisis: { type: 'string', description: 'Qué muestra y qué dice la pieza, en 2 a 5 líneas: negocio, problema, promesa, textos en pantalla y la llamada a la acción final (palabras exactas).' },
    palabra: { type: 'string', description: 'La palabra que la pieza pide escribir o comentar (en pantalla o en voz), en MAYÚSCULAS y como se ve. Vacío si no pide ninguna.' },
    texto: { type: 'string', description: 'El texto de la publicación, listo para Instagram y Facebook.' },
    idea: { type: 'string', description: 'Una línea: por qué se escribió así (a quién le habla y qué dolor toca).' },
  },
}
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['texto', 'idea'],
  properties: {
    texto: { type: 'string', description: 'El texto de la publicación, listo para Instagram y Facebook.' },
    idea: { type: 'string', description: 'Una línea: por qué se escribió así (a quién le habla y qué dolor toca).' },
  },
}

/** Lo que se le cuenta a la IA de la pieza. */
export function pedido(c, { transcripcion = '' } = {}) {
  return [
    `Tipo: ${c.tipo === 'video' ? 'video' : 'foto'} · ${c.uso === 'anuncio' ? 'ANUNCIO (también sale al feed)' : 'solo FEED'} · Mercado: ${{ usa: 'USA', mexico: 'México', ambos: 'USA y México' }[c.mercado]}`,
    `Título (de Eduardo): ${c.titulo}`,
    `Lo que Eduardo quiere lograr y a qué negocios: ${c.objetivo || c.titulo}`,
    c.analisis ? `Lo que muestra y dice la pieza (ya analizada): ${c.analisis}` : '',
    c.analisis ? `Palabra que pide la pieza: ${c.palabra || '(ninguna: usa INFO)'}` : '',
    transcripcion ? `Lo que se dice en el audio del video (transcripción automática):\n${transcripcion}` : '',
    c.comentario ? `Cambio que pidió Eduardo sobre el texto anterior: ${c.comentario}\nTexto anterior: ${c.texto}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

const cliente = (timeout) => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout, maxRetries: 1 })
const leer = (res) => {
  const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''))
  if (typeof out?.texto !== 'string' || !out.texto.trim()) throw new Error('la IA no devolvió el texto')
  return out
}

/** Solo el texto (la pieza ya se vio antes y su análisis está guardado). Rápido. */
export async function escribir(c) {
  const res = await cliente(20_000).messages.create({
    model: MODELO,
    max_tokens: 1500,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA } },
    system: SISTEMA,
    messages: [{ role: 'user', content: pedido(c) }],
  })
  return leer(res)
}

/** Ver la pieza (cuadros en JPEG, en orden; los últimos son el final del video) y escribir su texto. */
export async function verYEscribir(c, { cuadros = [], transcripcion = '' } = {}) {
  const imagenes = cuadros.map((data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }))
  const intro =
    c.tipo === 'video'
      ? `Estos son ${cuadros.length} cuadros del video en orden (los últimos son el final, donde suele ir la llamada a la acción). Míralos con cuidado, lee todo el texto en pantalla y escucha la transcripción.`
      : 'Esta es la foto. Lee todo el texto que tenga.'
  const res = await cliente(120_000).messages.create({
    model: MODELO,
    max_tokens: 2500,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_VER } },
    system: SISTEMA,
    messages: [{ role: 'user', content: [...imagenes, { type: 'text', text: `${cuadros.length ? intro : 'No se pudieron sacar imágenes de la pieza; usa la transcripción.'}\n\n${pedido(c, { transcripcion })}` }] }],
  })
  return leer(res)
}
