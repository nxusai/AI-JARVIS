// Envío de la ubicación de la camioneta mientras la ruta está en curso, también con la app
// en segundo plano. La tarea se define al cargar el módulo (requisito de expo-task-manager),
// por eso este archivo se importa desde el layout raíz.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "./supabase";

const TAREA = "abuelito-ubicacion";
const CLAVE = "abuelito:ruta-en-curso";

interface Contexto {
  ruta_id: string;
  empresa_id: string;
  chofer_id: string;
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREA, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const texto = await AsyncStorage.getItem(CLAVE);
  if (!texto) return;
  const ctx = JSON.parse(texto) as Contexto;
  // Sin señal se pierden puntos intermedios; solo importa la ubicación más reciente.
  const ultima = data.locations[data.locations.length - 1]!;
  await supabase.from("ubicaciones").insert({
    ...ctx,
    lat: ultima.coords.latitude,
    lng: ultima.coords.longitude,
    velocidad: ultima.coords.speed,
    registrado_en: new Date(ultima.timestamp).toISOString(),
  });
});

export async function iniciarSeguimiento(ctx: Contexto): Promise<boolean> {
  const primer = await Location.requestForegroundPermissionsAsync();
  if (!primer.granted) return false;
  const fondo = await Location.requestBackgroundPermissionsAsync();
  await AsyncStorage.setItem(CLAVE, JSON.stringify(ctx));
  if (await Location.hasStartedLocationUpdatesAsync(TAREA)) return true;
  await Location.startLocationUpdatesAsync(TAREA, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 2 * 60 * 1000,
    distanceInterval: 200,
    activityType: Location.LocationActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: fondo.granted,
  });
  return true;
}

export async function detenerSeguimiento() {
  await AsyncStorage.removeItem(CLAVE);
  if (await Location.hasStartedLocationUpdatesAsync(TAREA)) {
    await Location.stopLocationUpdatesAsync(TAREA);
  }
}

export async function ubicacionActual(): Promise<{ lat: number; lng: number } | null> {
  try {
    const u = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    return u ? { lat: u.coords.latitude, lng: u.coords.longitude } : null;
  } catch {
    return null;
  }
}
