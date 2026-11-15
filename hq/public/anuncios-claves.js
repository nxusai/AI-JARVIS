// Cómo se reconoce cada anuncio. Lo usan el panel (navegador) y las funciones de
// Netlify, para que los dos cuenten igual.
// Rondas 1–2: "Video A/B/C". Desde la ronda 3: idea y versión, "C3-V1".

/** Fuente de ManyChat → { camp, video }. "Anuncio MX · Video C" o "Anuncio MX · C3-V1". Lo que no viene de un anuncio es orgánico (null). */
export function claveDeFuente(fuente) {
  const m = /Anuncio\s+(MX|NY)\s*·\s*(?:Video\s+([A-Z])\b|(C\d+-V\d+))/i.exec(fuente || '')
  return m ? { camp: m[1].toUpperCase(), video: (m[2] || m[3]).toUpperCase() } : null
}

/** Anuncio de Meta → { camp, video }. "MX | C | Sucursales" o "MX | C3-V1 | VID | Pruébelo", en una campaña "NXUS | MX | …". */
export function claveDeAnuncio(nombre, campana) {
  const camp = /\|\s*NY\s*\|/i.test(campana) || /^\s*NY\b/i.test(nombre) ? 'NY' : /\|\s*MX\s*\|/i.test(campana) || /^\s*MX\b/i.test(nombre) ? 'MX' : ''
  const video = /^\s*(?:MX|NY)\s*\|\s*(C\d+-V\d+|[A-Z])\s*\|/i.exec(nombre || '')?.[1]?.toUpperCase() || ''
  return camp && video ? { camp, video } : null
}

/** "C" → "Video C"; "C3-V1" → "C3-V1". */
export const nombreCorto = (video) => (/^[A-Z]$/.test(video) ? `Video ${video}` : video)
