// Cómo se reconoce cada anuncio de Mi Semago. Lo usan el panel (navegador) y las
// funciones de Netlify, para que los dos cuenten igual.
//
// Cada ronda vuelve a usar las letras A, B, C…: por eso cada anuncio se identifica
// por RONDA + MERCADO + LETRA.
//   Campaña en Meta:    "MI SEMAGO | OESTE | R2 | WhatsApp"
//   Anuncio en Meta:    "OESTE | A | Tu marca"
//   Fuente en ManyChat: "Anuncio OESTE R2 · Video A"  (también "Imagen A", "Carrusel A" o solo "A")
// La ronda 1 (9–16 nov 2026, "Mi Semago · Distribuidores Oeste · WhatsApp · Prueba 7
// días") no llevaba letras: se reconoce por el nombre del anuncio y por la fuente
// "Anuncio · Capacidad", "Anuncio · Tu marca", "Anuncio · Logística", "Anuncio · Carrusel".

const limpio = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Los 4 anuncios de la ronda 1: cómo se reconocen, su letra y de qué tratan. */
const RONDA1 = [
  [/capacidad/i, 'A', 'Capacidad 500k lb'],
  [/marca/i, 'B', 'Tu marca'],
  [/logistica/i, 'C', 'Logística 40°F'],
  [/carrusel/i, 'D', 'Carrusel planta real'],
]
const deRonda1 = (texto) => RONDA1.find(([re]) => re.test(limpio(texto)))
export const MERCADO_R1 = 'OESTE'

/** Solo las campañas de Mi Semago (la cuenta de anuncios puede tener las de otra empresa). */
export const esDeMiSemago = (campana) => /mi\s*semago/i.test(limpio(campana))

/**
 * Ronda de una campaña: "MI SEMAGO | OESTE | R2 | WhatsApp" → 2. La ronda 1 es "Mi Semago · Distribuidores
 * Oeste · …" (9–16 nov 2026). Las campañas de antes (2025 a marzo 2026, otro método) son la ronda 0: "Anteriores".
 */
export function rondaDeCampana(campana) {
  const m = /\|\s*R(\d+)\s*(\||$)/i.exec(campana || '') || /\bRonda\s*(\d+)/i.exec(campana || '')
  if (m) return Number(m[1])
  return /distribuidores\s+oeste/i.test(limpio(campana)) ? 1 : 0
}

/** Mercado de una campaña: el segundo tramo de "MI SEMAGO | OESTE | R2 | …". */
export function mercadoDeCampana(campana) {
  const m = /^[^|]*\|\s*([A-Za-z]{2,12})\s*\|/.exec(limpio(campana))
  return m ? m[1].toUpperCase() : ''
}

/** Mercado de cualquier campaña de Mi Semago (la de la ronda 1 no llevaba "|": se reconoce por "Oeste"). */
export const campDe = (campana) => (rondaDeCampana(campana) === 0 ? 'ANTES' : mercadoDeCampana(campana) || (/\boeste\b/i.test(limpio(campana)) ? MERCADO_R1 : 'OTRO'))

/** Fuente de ManyChat → { camp, video, ronda }. Lo que no viene de un anuncio es orgánico (null). */
export function claveDeFuente(fuente) {
  const f = limpio(fuente).trim()
  const m = /^Anuncio\s+([A-Za-z]{2,12})\s+R(\d+)\s*[·\-:|]\s*(?:(?:Video|Imagen|Carrusel)\s+)?([A-Za-z])\s*$/i.exec(f)
  if (m) return { camp: m[1].toUpperCase(), ronda: Number(m[2]), video: m[3].toUpperCase() }
  const v = /^Anuncio\s*[·\-:|]\s*(.+)$/i.exec(f)
  const r1 = v && deRonda1(v[1])
  return r1 ? { camp: MERCADO_R1, ronda: 1, video: r1[1] } : null
}

/** Anuncio de Meta → { camp, video, ronda }. null si la campaña no es de Mi Semago. */
export function claveDeAnuncio(nombre, campana) {
  if (!esDeMiSemago(campana)) return null
  const ronda = rondaDeCampana(campana)
  const n = /^\s*([A-Za-z]{2,12})\s*\|\s*([A-Za-z])\s*(\||$)/.exec(limpio(nombre))
  if (n && ronda > 0) return { camp: mercadoDeCampana(campana) || n[1].toUpperCase(), ronda, video: n[2].toUpperCase() }
  const camp = campDe(campana)
  const r1 = ronda === 1 && deRonda1(nombre)
  if (r1) return { camp: camp === 'OTRO' ? MERCADO_R1 : camp, ronda: 1, video: r1[1] }
  // Un anuncio de Mi Semago con otro nombre no se esconde: sale con su nombre.
  const otro = limpio(nombre).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12)
  return otro ? { camp, ronda, video: otro } : null
}

/** La llave única de un anuncio: "2-OESTE-A". */
export const llaveDe = (k) => `${k.ronda ?? 1}-${k.camp}-${k.video}`
/** Código para guardar en la foto semanal: "R1-A", "R2-A". */
export const codigoDe = (k) => `R${k.ronda ?? 1}-${k.video}`
/** Y al revés: "R2-A" → { ronda: 2, video: 'A' }. */
export const deCodigo = (c) => {
  const m = /^R(\d+)-(.+)$/.exec(c || '')
  return m ? { ronda: Number(m[1]), video: m[2] } : { ronda: 1, video: c }
}

/** "A" → "Anuncio A"; un nombre largo se queda igual. */
export const nombreCorto = (video) => (/^[A-Z]$/.test(video) ? `Anuncio ${video}` : video)

/** De qué trata: "OESTE | A | Tu marca" → "Tu marca"; en la ronda 1, por su letra. */
export function descripcion(nombre, k) {
  const partes = String(nombre || '').split('|').map((s) => s.trim())
  if (partes.length >= 3) return partes.slice(2).filter((s) => s && !/^(VID|IMG|CAR)$/i.test(s)).join(' · ')
  const r1 = k && (k.ronda ?? 1) === 1 && RONDA1.find(([, letra]) => letra === k.video)
  return r1 ? r1[2] : String(nombre || '')
}

/** En qué va un lead, para el embudo (lo cuentan igual el panel y la foto semanal). */
export function pasoDe(l) {
  return {
    real: Boolean(l.permiso_llamada), // dio permiso por escrito de que le llamen
    hablo: Boolean(l.calificacion) || ['hablo', 'meet', 'cerrado'].includes(l.etapa), // Ana Sofi habló con él
    bueno: ['caliente', 'medio'].includes(l.calificacion), // Ana Sofi lo calificó caliente o medio
    agendo: Boolean(l.meet_inicio) || l.etapa === 'meet', // Meet agendado
    cliente: l.etapa === 'cerrado',
  }
}
