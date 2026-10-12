import "../lib/ubicacion"; // registra la tarea de GPS en segundo plano al arrancar
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ProveedorSesion } from "../lib/sesion";
import { ProveedorRuta } from "../lib/ruta";
import { colores } from "../componentes/ui";

export default function Layout() {
  return (
    <ProveedorSesion>
      <ProveedorRuta>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colores.primario,
            headerTitleStyle: { color: colores.texto },
            headerBackTitle: "Ruta",
          }}
        >
          <Stack.Screen name="index" options={{ title: "Mi ruta de hoy" }} />
          <Stack.Screen name="entrar" options={{ headerShown: false }} />
          <Stack.Screen name="parada/[id]" options={{ title: "Parada" }} />
        </Stack>
      </ProveedorRuta>
    </ProveedorSesion>
  );
}
