import { describe, expect, it } from "vitest";
import { horarioRecepcion, importeLineas, temperaturaFueraDeRango } from "./formato";

describe("formato", () => {
  it("muestra el horario de recepción", () => {
    expect(horarioRecepcion("08:00:00", "13:00:00")).toBe("08:00 – 13:00");
    expect(horarioRecepcion(null, null)).toBe("Sin horario");
  });

  it("detecta temperatura fuera del rango más estricto", () => {
    const productos = [
      { temp_min: 0, temp_max: 4 },
      { temp_min: null, temp_max: null },
    ];
    expect(temperaturaFueraDeRango(3, productos)).toBe(false);
    expect(temperaturaFueraDeRango(5.5, productos)).toBe(true);
    expect(temperaturaFueraDeRango(-1, productos)).toBe(true);
  });

  it("suma el importe de las líneas", () => {
    expect(importeLineas([{ cantidad: 10, precio_unitario: 95 }, { cantidad: 2, precio_unitario: 60 }])).toBe(1070);
  });
});
