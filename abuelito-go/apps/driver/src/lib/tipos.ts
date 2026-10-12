import type { Camioneta, Cliente, EstadoParada, MetodoPago, RegistroEntrega, Ruta } from "@abuelito/shared";

export interface LineaApp {
  id: string;
  cantidad: number;
  precio_unitario: number;
  cantidad_entregada: number | null;
  productos: { nombre: string; unidad: string; temp_min: number | null; temp_max: number | null };
}

export interface ParadaApp {
  id: string;
  empresa_id: string;
  secuencia: number;
  estado: EstadoParada;
  motivo: string | null;
  completada_en: string | null;
  pagos: { metodo: MetodoPago; monto: number }[];
  ordenes: {
    id: string;
    folio: number;
    notas: string | null;
    clientes: Cliente;
    orden_lineas: LineaApp[];
  };
}

export interface RutaApp extends Ruta {
  camionetas: Pick<Camioneta, "nombre" | "placas"> | null;
  paradas: ParadaApp[];
}

/** Operación pendiente de enviar al servidor; se guarda en el teléfono hasta que haya señal. */
export type Operacion =
  | { id: string; tipo: "iniciar"; ruta_id: string; temperatura: number; error?: string }
  | { id: string; tipo: "terminar"; ruta_id: string; temperatura: number | null; error?: string }
  | {
      id: string;
      tipo: "entrega";
      ruta_id: string;
      empresa_id: string;
      registro: Omit<RegistroEntrega, "p_foto_path" | "p_firma_path">;
      /** Ruta local de la foto, copiada a documentos para que sobreviva hasta subirla. */
      foto?: string;
      /** Firma como SVG. */
      firma?: string;
      error?: string;
    };
