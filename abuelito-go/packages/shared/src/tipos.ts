// Tipos de las tablas de Supabase (ver supabase/migrations). Mantener en sincronía con el esquema.

export type Rol = "admin" | "despachador" | "chofer";
export type CondicionPago = "contado" | "credito";
export type EstadoOrden = "pendiente" | "en_ruta" | "entregada" | "parcial" | "no_entregada" | "cancelada";
export type EstadoRuta = "borrador" | "publicada" | "en_curso" | "terminada" | "cerrada";
export type EstadoParada = "pendiente" | "entregada" | "parcial" | "no_entregada";
export type MetodoPago = "efectivo" | "transferencia";

export interface Empresa {
  id: string;
  nombre: string;
  base_direccion: string | null;
  base_lat: number | null;
  base_lng: number | null;
}

export interface Perfil {
  id: string;
  empresa_id: string;
  nombre: string;
  rol: Rol;
  telefono: string | null;
  activo: boolean;
}

export interface Camioneta {
  id: string;
  empresa_id: string;
  nombre: string;
  placas: string | null;
  capacidad_kg: number | null;
  sensor_id: string | null;
  activo: boolean;
}

export interface Cliente {
  id: string;
  empresa_id: string;
  codigo: string | null;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  direccion: string;
  lat: number | null;
  lng: number | null;
  horario_desde: string | null;
  horario_hasta: string | null;
  notas: string | null;
  condicion_pago: CondicionPago;
  limite_credito: number;
  saldo: number;
  activo: boolean;
}

export interface Producto {
  id: string;
  empresa_id: string;
  sku: string | null;
  nombre: string;
  unidad: string;
  precio: number;
  temp_min: number | null;
  temp_max: number | null;
  activo: boolean;
}

export interface Orden {
  id: string;
  empresa_id: string;
  folio: number;
  cliente_id: string;
  fecha_entrega: string;
  estado: EstadoOrden;
  notas: string | null;
}

export interface OrdenLinea {
  id: string;
  orden_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  cantidad_entregada: number | null;
}

export interface Ruta {
  id: string;
  empresa_id: string;
  fecha: string;
  nombre: string;
  chofer_id: string | null;
  camioneta_id: string | null;
  estado: EstadoRuta;
  iniciada_en: string | null;
  terminada_en: string | null;
  efectivo_recibido: number | null;
  notas_cierre: string | null;
}

export interface Parada {
  id: string;
  empresa_id: string;
  ruta_id: string;
  orden_id: string;
  secuencia: number;
  estado: EstadoParada;
  motivo: string | null;
  recibio_nombre: string | null;
  foto_path: string | null;
  firma_path: string | null;
  completada_en: string | null;
}

export interface ResumenRuta {
  ruta_id: string;
  fecha: string;
  nombre: string;
  estado: EstadoRuta;
  chofer_id: string | null;
  camioneta_id: string | null;
  efectivo_recibido: number | null;
  paradas_total: number;
  paradas_completadas: number;
  paradas_fallidas: number;
  efectivo_esperado: number;
  transferencias: number;
}

/** Argumentos de la función `registrar_entrega` en la base de datos. */
export interface RegistroEntrega {
  p_op_id: string;
  p_parada_id: string;
  p_estado: Exclude<EstadoParada, "pendiente">;
  p_lineas?: { linea_id: string; cantidad_entregada: number }[];
  p_pagos?: { metodo: MetodoPago; monto: number; referencia?: string }[];
  p_temperatura?: number | null;
  p_motivo?: string | null;
  p_recibio_nombre?: string | null;
  p_foto_path?: string | null;
  p_firma_path?: string | null;
  p_lat?: number | null;
  p_lng?: number | null;
}

export const MOTIVOS_NO_ENTREGA = [
  "Cliente cerrado",
  "Cliente rechazó el producto",
  "Producto dañado",
  "Temperatura fuera de rango",
  "Sin dinero para pagar",
  "Dirección incorrecta",
  "Sin tiempo en la ruta",
  "Otro",
] as const;

export const ETIQUETA_ESTADO_RUTA: Record<EstadoRuta, string> = {
  borrador: "Borrador",
  publicada: "Publicada",
  en_curso: "En curso",
  terminada: "Terminada",
  cerrada: "Cerrada",
};

export const ETIQUETA_ESTADO_PARADA: Record<EstadoParada, string> = {
  pendiente: "Pendiente",
  entregada: "Entregada",
  parcial: "Parcial",
  no_entregada: "No entregada",
};
