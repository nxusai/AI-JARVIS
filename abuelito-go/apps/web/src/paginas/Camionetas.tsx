import { Catalogo } from "../componentes/Catalogo";

export function Camionetas() {
  return (
    <Catalogo
      tabla="camionetas"
      titulo="Camionetas"
      orden="nombre"
      campos={[
        { campo: "nombre", etiqueta: "Nombre", requerido: true },
        { campo: "placas", etiqueta: "Placas" },
        { campo: "capacidad_kg", etiqueta: "Capacidad (kg)", tipo: "numero" },
        { campo: "sensor_id", etiqueta: "Id del sensor de temperatura" },
      ]}
    />
  );
}
