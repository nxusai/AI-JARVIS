import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { Punto } from "@abuelito/shared";

export interface Marca extends Punto {
  id: string;
  etiqueta: string;
  detalle?: string;
  /** Color del círculo: estado de la parada o tipo de marca. */
  color?: string;
}

function icono(texto: string, color = "#1f6feb") {
  return L.divIcon({
    className: "",
    html: `<div class="pin" style="background:${color}">${texto}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function Encuadre({ puntos }: { puntos: Punto[] }) {
  const mapa = useMap();
  const clave = puntos.map((p) => `${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    if (puntos.length === 0) return;
    mapa.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
    // Solo reencuadra cuando cambian los puntos, no en cada render.
  }, [clave, mapa]);
  return null;
}

export function Mapa({ marcas, recorrido, alto = 420 }: { marcas: Marca[]; recorrido?: Punto[]; alto?: number }) {
  const centro: [number, number] = marcas[0] ? [marcas[0].lat, marcas[0].lng] : [20.6597, -103.3496];
  return (
    <MapContainer center={centro} zoom={12} style={{ height: alto }} className="mapa">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {recorrido && recorrido.length > 1 && (
        <Polyline positions={recorrido.map((p) => [p.lat, p.lng] as [number, number])} color="#1f6feb" weight={3} opacity={0.6} />
      )}
      {marcas.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={icono(m.etiqueta, m.color)}>
          {m.detalle && <Popup>{m.detalle}</Popup>}
        </Marker>
      ))}
      <Encuadre puntos={[...marcas, ...(recorrido ?? [])]} />
    </MapContainer>
  );
}

export const COLOR_PARADA: Record<string, string> = {
  pendiente: "#1f6feb",
  entregada: "#1a7f37",
  parcial: "#bf8700",
  no_entregada: "#cf222e",
};
