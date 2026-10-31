// Qué clip va en cada reel. Regla: un clip se puede repetir, pero nunca antes de que pasen
// al menos 4 reels con clips diferentes. Entre los que se pueden usar, gana el menos usado
// y, si empatan, el que lleva más tiempo sin salir.

export const SEPARACION = 4

/**
 * @param {string[]} clips       los clips disponibles ("1.mp4", "2.mp4", …)
 * @param {string[]} historial   los clips de los reels anteriores, del más viejo al más nuevo
 * @param {number} cuantos       cuántos reels hay que armar
 * @returns {{ orden: string[], aviso: string | null }}
 */
export function repartirClips(clips, historial, cuantos) {
  if (!clips.length) return { orden: [], aviso: 'No hay clips en 1-Crudos.' }
  // Con menos de 5 clips no se puede cumplir la regla completa: se separan lo más posible.
  const separacion = Math.min(SEPARACION, clips.length - 1)
  const aviso = clips.length <= SEPARACION ? `Solo hay ${clips.length} clips: se repiten cada ${clips.length} reels. Sube más para cumplir la regla de 4.` : null
  const usos = new Map(clips.map((c) => [c, 0]))
  const ultimo = new Map(clips.map((c) => [c, -Infinity]))
  const linea = [...historial]
  linea.forEach((c, i) => {
    if (usos.has(c)) {
      usos.set(c, usos.get(c) + 1)
      ultimo.set(c, i)
    }
  })
  const orden = []
  for (let n = 0; n < cuantos; n++) {
    const recientes = new Set(linea.slice(-separacion))
    const libres = clips.filter((c) => !recientes.has(c))
    const candidatos = libres.length ? libres : clips
    candidatos.sort((a, b) => usos.get(a) - usos.get(b) || ultimo.get(a) - ultimo.get(b) || Number.parseInt(a) - Number.parseInt(b))
    const elegido = candidatos[0]
    usos.set(elegido, usos.get(elegido) + 1)
    ultimo.set(elegido, linea.length)
    linea.push(elegido)
    orden.push(elegido)
  }
  return { orden, aviso }
}
