const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatoMoneda(valor: number | null | undefined): string {
  return moneda.format(Number(valor ?? 0));
}

/** "08:00:00" → "08:00" */
export function formatoHora(hora: string | null | undefined): string {
  return hora ? hora.slice(0, 5) : "";
}

export function horarioRecepcion(desde: string | null, hasta: string | null): string {
  if (!desde && !hasta) return "Sin horario";
  return `${formatoHora(desde) || "?"} – ${formatoHora(hasta) || "?"}`;
}

/** Fecha local en formato YYYY-MM-DD (la que usa la columna `date`). */
export function fechaLocal(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Una lectura está fuera de rango si rebasa el rango más estricto de los productos dados. */
export function temperaturaFueraDeRango(
  valorC: number,
  productos: { temp_min: number | null; temp_max: number | null }[],
): boolean {
  return productos.some(
    (p) => (p.temp_min != null && valorC < Number(p.temp_min)) || (p.temp_max != null && valorC > Number(p.temp_max)),
  );
}

export function importeLineas(lineas: { cantidad: number; precio_unitario: number }[]): number {
  return lineas.reduce((t, l) => t + Number(l.cantidad) * Number(l.precio_unitario), 0);
}
