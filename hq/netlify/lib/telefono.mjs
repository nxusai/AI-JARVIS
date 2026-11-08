// El teléfono del lead, listo para marcar (+52… o +1…), y su país.
// La gente escribe el número sin lada, con lada vieja de México (044, 045, 01,
// +521) o ManyChat le pone +1 a un número de México. Se decide con, en orden:
//   1. Lo que respondió en el chat (México / USA).
//   2. Su ciudad y dirección (CDMX, Coacalco, Jalisco… / NJ, Texas, Houston…).
//   3. La IA (Claude), con todo lo que dejó, si lo anterior no alcanza.
import Anthropic from '@anthropic-ai/sdk'

const sinAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const MX = /\b(mexico|mex|mx|cdmx|ciudad de mexico|edomex|estado de mexico|df|d\.f\.|jalisco|guadalajara|zapopan|nuevo leon|monterrey|puebla|queretaro|guanajuato|leon|toluca|ecatepec|naucalpan|tlalnepantla|coacalco|tultitlan|cuautitlan|nezahualcoyotl|satelite|lindavista|polanco|condesa|roma|coyoacan|iztapalapa|tlalpan|xochimilco|azcapotzalco|gustavo a\.? madero|veracruz|yucatan|merida|cancun|quintana roo|oaxaca|chiapas|tabasco|sonora|hermosillo|chihuahua|juarez|tijuana|baja california|sinaloa|culiacan|mazatlan|michoacan|morelia|morelos|cuernavaca|hidalgo|pachuca|aguascalientes|san luis potosi|zacatecas|durango|coahuila|saltillo|torreon|tamaulipas|tampico|reynosa|nayarit|colima|guerrero|acapulco|campeche|tlaxcala|col\.|colonia|alcaldia|municipio|c\.p\.)\b/
const US = /\b(usa|u\.s\.a?|united states|estados unidos|eeuu|ee\.? ?uu|nj|new jersey|ny|new york|nyc|texas|tx|california|ca|florida|fl|illinois|il|arizona|az|georgia|ga|nevada|nv|colorado|co|north carolina|nc|houston|dallas|san antonio|austin|los angeles|chicago|miami|orlando|phoenix|las vegas|atlanta|denver|newark|paterson|elizabeth|jersey city|jersey|union city|passaic|bronx|brooklyn|queens|street|st\.|ave|avenue|apt|suite)\b/

/** México o USA por la ciudad y la dirección; '' si no se sabe. */
export function paisPorLugar(...textos) {
  const t = sinAcentos(textos.filter(Boolean).join(' · '))
  if (!t.trim()) return ''
  const mx = MX.test(t)
  const us = US.test(t)
  return mx && !us ? 'mexico' : us && !mx ? 'usa' : ''
}

/** Los 10 dígitos nacionales y el país que trae el número escrito, si lo trae. */
function partes(v) {
  const t = String(v ?? '').trim()
  let d = t.replace(/\D/g, '')
  if (!d) return { d: '' }
  if (d.startsWith('00')) d = d.slice(2) // 0052…, 001…
  const mas = t.startsWith('+') || String(v).trim().startsWith('00')
  if ((mas || d.length >= 12) && d.startsWith('521') && d.length === 13) return { cc: '52', d: d.slice(3) } // +521 (celular, formato viejo)
  if ((mas || d.length >= 12) && d.startsWith('52') && d.length === 12) return { cc: '52', d: d.slice(2) }
  if (d.length === 11 && d.startsWith('1')) return { cc: '1', d: d.slice(1) }
  if (d.length === 13 && /^04[45]/.test(d)) return { d: d.slice(3) } // 044 / 045 + 10
  if (d.length === 12 && d.startsWith('01')) return { d: d.slice(2) } // 01 + 10 (lada vieja)
  if (d.length === 10) return { d }
  return { d, raro: true, mas }
}

/**
 * El número para marcar y el país, sin IA. pais: lo que respondió en el chat.
 * Devuelve { telefono, pais } o { telefono: '' } si no se puede saber.
 */
export function normalizar(v, pais = '', ...lugar) {
  const p = partes(v)
  if (!p.d) return { telefono: '', pais }
  if (p.raro) return p.mas ? { telefono: `+${p.d}`.slice(0, 30), pais: pais || 'otro' } : { telefono: '', pais }
  // Trae +1 pero dijo México: puede ser el +1 que ManyChat le pone solo a un número de México, o un número
  // de USA de verdad (ej. vive en NJ y eligió México). Si su ciudad o dirección es de USA, es de USA; si no,
  // queda en duda: se guarda tal cual y al llamar decide la IA (telefonoParaLlamar).
  if (p.cc === '1' && pais === 'mexico') {
    if (paisPorLugar(...lugar) === 'usa') return { telefono: `+1${p.d}`, pais }
    return { telefono: `+52${p.d}`, pais, duda: true, original: `+1${p.d}` }
  }
  // Si escribió +52, es de México (aunque viva en USA). Sin lada: lo que respondió, si no su ciudad o dirección.
  const elegido =
    p.cc === '52' ? 'mexico' : p.cc === '1' && pais !== 'mexico' ? 'usa' : pais === 'mexico' || pais === 'usa' ? pais : paisPorLugar(...lugar) || (p.cc === '1' ? 'usa' : '')
  if (!elegido) return { telefono: '', pais }
  return { telefono: `${elegido === 'mexico' ? '+52' : '+1'}${p.d}`, pais: pais === 'mexico' || pais === 'usa' ? pais : elegido }
}

/** Cuando no alcanza: la IA decide con todo lo que dejó el lead. */
async function preguntarIA(l) {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 6_000, maxRetries: 0 })
  const res = await client.messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 300,
    output_config: {
      format: {
        type: 'json_schema',
        schema: { type: 'object', additionalProperties: false, required: ['pais', 'telefono'], properties: { pais: { type: 'string', enum: ['mexico', 'usa', 'no_se'] }, telefono: { type: 'string' } } },
      },
    },
    system:
      'Decides de qué país es el teléfono de un cliente de NXUS AI (México o Estados Unidos) con lo que dejó en un chat, y lo escribes en formato internacional (E.164): México = +52 y 10 dígitos (sin el 1, 044, 045 ni 01 viejos); USA = +1 y 10 dígitos. Usa la ciudad, la dirección, el país que dijo y la forma del número. Ojo: el chat (ManyChat) a veces le pone +1 a un número de México escrito sin lada, pero también hay gente que vive en USA y dice México. Fíjate en los primeros dígitos de los 10: si son una lada de México (55, 56, 33, 81, 222, 442, 477, 664, 998…) es de México; si son un código de área de USA que no existe como lada en México (201, 973, 862, 908, 732, 212, 646, 718, 347, 917…) es de USA. Si no hay forma de saberlo con seguridad, pais = "no_se" y telefono vacío.',
    messages: [{ role: 'user', content: JSON.stringify({ telefono: l.telefono, pais_que_dijo: l.pais, ciudad: l.ciudad, direccion: l.direccion, empresa: l.empresa, idioma: l.idioma }) }],
  })
  const out = JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''))
  if (!['mexico', 'usa'].includes(out.pais)) return null
  const n = normalizar(out.telefono || l.telefono, out.pais)
  return n.telefono ? n : null
}

/** El número listo para marcar (con IA si hace falta). { telefono, pais } o null. */
export async function telefonoParaLlamar(l) {
  if (/^\+(52|1)\d{10}$/.test(String(l.telefono || ''))) {
    // Ya viene con lada: solo se corrige si choca con el país que dijo (ManyChat le pone +1 a números de México).
    const n = normalizar(l.telefono, l.pais, l.ciudad, l.direccion)
    if (n.duda) return (await preguntarIA(l).catch(() => null)) || { telefono: n.telefono, pais: n.pais }
    return n.telefono ? n : { telefono: l.telefono, pais: l.pais }
  }
  const n = normalizar(l.telefono, l.pais, l.ciudad, l.direccion)
  if (n.telefono) return n
  return preguntarIA(l).catch(() => null)
}
