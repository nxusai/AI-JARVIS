import { Alert, Linking } from "react-native";

/** Ofrece abrir la dirección en Apple Maps, Google Maps o Waze (las que estén instaladas). */
export async function navegarA(destino: { lat: number | null; lng: number | null; direccion: string }) {
  const coords = destino.lat != null && destino.lng != null ? `${destino.lat},${destino.lng}` : null;
  const consulta = encodeURIComponent(coords ?? destino.direccion);
  const opciones = [
    { nombre: "Apple Maps", url: `maps://?daddr=${consulta}&dirflg=d` },
    { nombre: "Google Maps", url: `comgooglemaps://?daddr=${consulta}&directionsmode=driving` },
    { nombre: "Waze", url: coords ? `waze://?ll=${coords}&navigate=yes` : `waze://?q=${consulta}&navigate=yes` },
  ];
  const disponibles = [];
  for (const o of opciones) {
    if (await Linking.canOpenURL(o.url).catch(() => false)) disponibles.push(o);
  }
  if (disponibles.length === 0) {
    await Linking.openURL(`https://maps.apple.com/?daddr=${consulta}`);
    return;
  }
  if (disponibles.length === 1) {
    await Linking.openURL(disponibles[0]!.url);
    return;
  }
  Alert.alert("Navegar con", undefined, [
    ...disponibles.map((o) => ({ text: o.nombre, onPress: () => Linking.openURL(o.url) })),
    { text: "Cancelar", style: "cancel" as const },
  ]);
}

export function llamar(telefono: string) {
  Linking.openURL(`tel:${telefono.replace(/[^\d+]/g, "")}`);
}
