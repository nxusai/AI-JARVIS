import { formatoMoneda } from "@abuelito/shared";
import { Catalogo } from "../componentes/Catalogo";

export function Productos() {
  return (
    <Catalogo
      tabla="productos"
      titulo="Productos"
      orden="nombre"
      campos={[
        { campo: "sku", etiqueta: "Clave" },
        { campo: "nombre", etiqueta: "Nombre", requerido: true },
        { campo: "unidad", etiqueta: "Unidad", requerido: true },
        { campo: "precio", etiqueta: "Precio", tipo: "numero", requerido: true, formato: (v) => formatoMoneda(Number(v)) },
        { campo: "temp_min", etiqueta: "Temp. mín. °C", tipo: "numero" },
        { campo: "temp_max", etiqueta: "Temp. máx. °C", tipo: "numero" },
      ]}
    />
  );
}
