import { describe, expect, it } from "vitest";
import { distanciaKm, distanciaRecorrido, optimizarRuta } from "./optimizador";

const base = { lat: 0, lng: 0 };

describe("distanciaKm", () => {
  it("mide un grado de latitud en ~111 km", () => {
    expect(distanciaKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });
});

describe("optimizarRuta", () => {
  it("devuelve vacío y conserva una sola parada", () => {
    expect(optimizarRuta(base, [])).toEqual([]);
    expect(optimizarRuta(base, [{ id: "a", lat: 1, lng: 1 }]).map((p) => p.id)).toEqual(["a"]);
  });

  it("recorre en orden los puntos alineados", () => {
    const paradas = [
      { id: "c", lat: 0, lng: 0.3 },
      { id: "a", lat: 0, lng: 0.1 },
      { id: "b", lat: 0, lng: 0.2 },
    ];
    expect(optimizarRuta(base, paradas).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("no empeora y elimina cruces en un cuadrado", () => {
    const paradas = [
      { id: "1", lat: 0.1, lng: 0.1 },
      { id: "3", lat: 0.2, lng: 0.2 },
      { id: "2", lat: 0.1, lng: 0.2 },
      { id: "4", lat: 0.2, lng: 0.1 },
    ];
    const optima = optimizarRuta(base, paradas);
    expect(distanciaRecorrido(base, optima)).toBeLessThanOrEqual(distanciaRecorrido(base, paradas));
    // Sin cruces, las esquinas opuestas (1 y 3) nunca quedan consecutivas.
    const ids = optima.map((p) => p.id).join("");
    expect(ids).not.toMatch(/13|31/);
  });

  it("no modifica el arreglo original y conserva todas las paradas", () => {
    const paradas = Array.from({ length: 30 }, (_, i) => ({
      id: String(i),
      lat: Math.sin(i * 7.3) * 0.2,
      lng: Math.cos(i * 3.1) * 0.2,
    }));
    const copia = paradas.map((p) => p.id);
    const optima = optimizarRuta(base, paradas);
    expect(paradas.map((p) => p.id)).toEqual(copia);
    expect([...optima.map((p) => p.id)].sort()).toEqual([...copia].sort());
    expect(distanciaRecorrido(base, optima)).toBeLessThan(distanciaRecorrido(base, paradas));
  });
});
