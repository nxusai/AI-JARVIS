// Cómo se reconoce cada anuncio. Lo usan el panel (navegador) y las funciones de
// Netlify, para que los dos cuenten igual.
// Cada ronda vuelve a usar "Video A, B, C…": por eso cada video se identifica por
// RONDA + MERCADO + LETRA. La ronda sale de la campaña ("NXUS | MX | R2 | …");
// sin "R#" es la ronda 1 (las campañas del 8 nov). En ManyChat la fuente lleva la
// ronda desde la 2: "Anuncio MX R2 · Video A". También se entienden "C3-V1".

/** Ronda de una campaña: "NXUS | MX | R2 | Mensajes" → 2; sin "R#" → 1. */
export function rondaDeCampana(campana) {
  const m = /\|\s*R(\d+)\s*\|/i.exec(campana || '') || /\bRonda\s*(\d+)/i.exec(campana || '')
  return m ? Number(m[1]) : 1
}

/** Fuente de ManyChat → { camp, video, ronda }. "Anuncio MX · Video C" (ronda 1) o "Anuncio MX R2 · Video A". Lo que no viene de un anuncio es orgánico (null). */
export function claveDeFuente(fuente) {
  const m = /Anuncio\s+(MX|NY)(?:\s+R(\d+))?\s*·\s*(?:Video\s+([A-Z])\b|(C\d+-V\d+))/i.exec(fuente || '')
  return m ? { camp: m[1].toUpperCase(), video: (m[3] || m[4]).toUpperCase(), ronda: m[2] ? Number(m[2]) : 1 } : null
}

/** Anuncio de Meta → { camp, video, ronda }. "MX | A | Pruébelo" en la campaña "NXUS | MX | R2 | …". */
export function claveDeAnuncio(nombre, campana) {
  const camp = /\|\s*NY\s*\|/i.test(campana) || /^\s*NY\b/i.test(nombre) ? 'NY' : /\|\s*MX\s*\|/i.test(campana) || /^\s*MX\b/i.test(nombre) ? 'MX' : ''
  const video = /^\s*(?:MX|NY)\s*\|\s*(C\d+-V\d+|[A-Z])\s*\|/i.exec(nombre || '')?.[1]?.toUpperCase() || ''
  return camp && video ? { camp, video, ronda: rondaDeCampana(campana) } : null
}

/** La llave única de un video: "1-MX-A". */
export const llaveDe = (k) => `${k.ronda || 1}-${k.camp}-${k.video}`
/** Código para guardar en la foto semanal: "A" en la ronda 1 (como ya estaba), "R2-A" desde la 2. */
export const codigoDe = (k) => ((k.ronda || 1) > 1 ? `R${k.ronda}-${k.video}` : k.video)
/** Y al revés: "R2-A" → { ronda: 2, video: 'A' }. */
export const deCodigo = (c) => { const m = /^R(\d+)-(.+)$/.exec(c || ''); return m ? { ronda: Number(m[1]), video: m[2] } : { ronda: 1, video: c } }

/** "C" → "Video C"; "C3-V1" → "C3-V1". */
export const nombreCorto = (video) => (/^[A-Z]$/.test(video) ? `Video ${video}` : video)

/** La parte descriptiva del nombre en Meta: "MX | A | 11:48" → "11:48". */
export const descripcion = (nombre) => (nombre || '').split('|').slice(2).map((s) => s.trim()).filter((s) => s && !/^(VID|IMG)$/i.test(s)).join(' · ')
