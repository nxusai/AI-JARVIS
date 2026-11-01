// Qué toma va en cada reel. Reglas:
//   1. Una toma se puede repetir, pero nunca antes de que pasen al menos 4 reels con otras tomas.
//   2. Dos reels seguidos no salen del mismo clip (aunque sean pedazos distintos), si hay de dónde escoger.
// Entre las que se pueden usar, gana la menos usada y, si empatan, la que lleva más tiempo sin salir.

export const SEPARACION = 4

/**
 * @param {{ id: string, clip: string }[]} tomas   las tomas disponibles (ver segmentos.mjs)
 * @param {string[]} historial                     los ids de los reels anteriores, del más viejo al más nuevo
 * @param {number} cuantos                         cuántos reels hay que armar
 * @returns {{ orden: object[], aviso: string | null }}
 */
export function repartirTomas(tomas, historial, cuantos) {
  if (!tomas.length) return { orden: [], aviso: 'No hay clips en 1-Crudos.' }
  const porId = new Map(tomas.map((t) => [t.id, t]))
  // Con 4 tomas o menos no se puede cumplir la regla completa: se separan lo más posible.
  const separacion = Math.min(SEPARACION, tomas.length - 1)
  const aviso = tomas.length <= SEPARACION ? `Solo hay ${tomas.length} tomas: se repiten cada ${tomas.length} reels. Sube más clips para cumplir la regla de 4.` : null
  const usos = new Map(tomas.map((t) => [t.id, 0]))
  const ultimo = new Map(tomas.map((t) => [t.id, -Infinity]))
  const linea = [...historial]
  linea.forEach((id, i) => {
    if (usos.has(id)) {
      usos.set(id, usos.get(id) + 1)
      ultimo.set(id, i)
    }
  })
  const clipDe = (id) => porId.get(id)?.clip ?? id.split('@')[0]
  const orden = []
  for (let n = 0; n < cuantos; n++) {
    const recientes = new Set(linea.slice(-separacion))
    const anterior = linea.length ? clipDe(linea.at(-1)) : null
    let candidatos = tomas.filter((t) => !recientes.has(t.id))
    if (!candidatos.length) candidatos = [...tomas]
    const deOtroClip = candidatos.filter((t) => t.clip !== anterior)
    if (deOtroClip.length) candidatos = deOtroClip
    candidatos.sort((a, b) => usos.get(a.id) - usos.get(b.id) || ultimo.get(a.id) - ultimo.get(b.id) || Number.parseInt(a.clip) - Number.parseInt(b.clip) || a.desde - b.desde)
    const elegida = candidatos[0]
    usos.set(elegida.id, usos.get(elegida.id) + 1)
    ultimo.set(elegida.id, linea.length)
    linea.push(elegida.id)
    orden.push(elegida)
  }
  return { orden, aviso }
}
