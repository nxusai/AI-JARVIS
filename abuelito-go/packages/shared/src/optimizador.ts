// Optimización del orden de paradas sin servicios externos: vecino más cercano
// seguido de mejora 2-opt, sobre distancia en línea recta (haversine).
// Suficiente para decenas de paradas; para ventanas de horario y capacidad se
// puede cambiar por Google Route Optimization o VROOM sin tocar a quien lo llama.

export interface Punto {
  lat: number;
  lng: number;
}

export interface ParadaOptimizable extends Punto {
  id: string;
}

const RADIO_TIERRA_KM = 6371;

export function distanciaKm(a: Punto, b: Punto): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(h));
}

/** Distancia total saliendo de la base, recorriendo las paradas en orden y regresando. */
export function distanciaRecorrido(base: Punto, paradas: Punto[]): number {
  if (paradas.length === 0) return 0;
  let total = distanciaKm(base, paradas[0]!);
  for (let i = 1; i < paradas.length; i++) total += distanciaKm(paradas[i - 1]!, paradas[i]!);
  return total + distanciaKm(paradas[paradas.length - 1]!, base);
}

/**
 * Devuelve las paradas en el orden que minimiza (aproximadamente) el recorrido
 * desde la base y de regreso. No modifica el arreglo recibido.
 */
export function optimizarRuta<T extends ParadaOptimizable>(base: Punto, paradas: T[]): T[] {
  if (paradas.length <= 2) return ordenarPorCercania(base, paradas);

  let ruta = ordenarPorCercania(base, paradas);
  const puntos = (r: T[]) => [base, ...r, base];

  // 2-opt: invierte tramos mientras acorten el recorrido.
  let mejoro = true;
  while (mejoro) {
    mejoro = false;
    const p = puntos(ruta);
    for (let i = 1; i < p.length - 2; i++) {
      for (let j = i + 1; j < p.length - 1; j++) {
        const antes = distanciaKm(p[i - 1]!, p[i]!) + distanciaKm(p[j]!, p[j + 1]!);
        const despues = distanciaKm(p[i - 1]!, p[j]!) + distanciaKm(p[i]!, p[j + 1]!);
        if (despues + 1e-9 < antes) {
          ruta = [...ruta.slice(0, i - 1), ...ruta.slice(i - 1, j).reverse(), ...ruta.slice(j)];
          mejoro = true;
          break;
        }
      }
      if (mejoro) break;
    }
  }
  return ruta;
}

function ordenarPorCercania<T extends ParadaOptimizable>(base: Punto, paradas: T[]): T[] {
  const restantes = [...paradas];
  const orden: T[] = [];
  let actual: Punto = base;
  while (restantes.length > 0) {
    let mejor = 0;
    for (let i = 1; i < restantes.length; i++) {
      if (distanciaKm(actual, restantes[i]!) < distanciaKm(actual, restantes[mejor]!)) mejor = i;
    }
    const [siguiente] = restantes.splice(mejor, 1);
    orden.push(siguiente!);
    actual = siguiente!;
  }
  return orden;
}
