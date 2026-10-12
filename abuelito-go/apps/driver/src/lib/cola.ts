// Cola de operaciones sin señal: todo lo que registra el chofer se guarda primero en el
// teléfono y se envía en orden cuando hay conexión. Cada operación lleva un id único que
// el servidor usa para no aplicarla dos veces si un reintento llega duplicado.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import { supabase } from "./supabase";
import type { Operacion } from "./tipos";

const CLAVE = "abuelito:cola";

export async function leerCola(): Promise<Operacion[]> {
  const texto = await AsyncStorage.getItem(CLAVE);
  return texto ? (JSON.parse(texto) as Operacion[]) : [];
}

async function guardarCola(cola: Operacion[]) {
  await AsyncStorage.setItem(CLAVE, JSON.stringify(cola));
}

export async function encolar(op: Operacion) {
  await guardarCola([...(await leerCola()), op]);
}

/** Error de conexión (reintentar después) frente a error del servidor (no se arregla reintentando). */
function esErrorDeRed(error: { code?: string; message: string }) {
  return !error.code || /network|fetch|timeout/i.test(error.message);
}

async function subir(ruta: string, cuerpo: ArrayBuffer | string, contentType: string) {
  const { error } = await supabase.storage.from("entregas").upload(ruta, cuerpo, { contentType, upsert: true });
  if (error) throw Object.assign(new Error(error.message), { red: true });
}

async function enviar(op: Operacion) {
  if (op.tipo === "iniciar") {
    return supabase.rpc("iniciar_ruta", { p_ruta_id: op.ruta_id, p_temperatura: op.temperatura });
  }
  if (op.tipo === "terminar") {
    return supabase.rpc("terminar_ruta", { p_ruta_id: op.ruta_id, p_temperatura: op.temperatura });
  }
  const carpeta = `${op.empresa_id}/${op.ruta_id}/${op.registro.p_parada_id}`;
  let fotoPath: string | null = null;
  let firmaPath: string | null = null;
  if (op.foto) {
    fotoPath = `${carpeta}/foto-${op.id}.jpg`;
    await subir(fotoPath, await new File(op.foto).arrayBuffer(), "image/jpeg");
  }
  if (op.firma) {
    firmaPath = `${carpeta}/firma-${op.id}.svg`;
    await subir(firmaPath, op.firma, "image/svg+xml");
  }
  return supabase.rpc("registrar_entrega", { ...op.registro, p_foto_path: fotoPath, p_firma_path: firmaPath });
}

let procesando = false;

/**
 * Envía las operaciones pendientes en orden. Se detiene al primer error de red;
 * un error del servidor se marca en la operación y se sigue con las demás.
 * Devuelve true si se envió algo.
 */
export async function procesarCola(): Promise<boolean> {
  if (procesando) return false;
  procesando = true;
  let envio = false;
  try {
    for (const op of await leerCola()) {
      if (op.error) continue;
      let resultado: { error: { code?: string; message: string } | null };
      try {
        resultado = await enviar(op);
      } catch (e) {
        resultado = { error: { message: (e as Error).message } };
      }
      const cola = await leerCola();
      if (resultado.error && esErrorDeRed(resultado.error)) break;
      if (resultado.error) {
        await guardarCola(cola.map((o) => (o.id === op.id ? { ...o, error: resultado.error!.message } : o)));
      } else {
        await guardarCola(cola.filter((o) => o.id !== op.id));
        if (op.tipo === "entrega" && op.foto) {
          try {
            new File(op.foto).delete();
          } catch {
            // Si la foto ya no existe no hay nada que limpiar.
          }
        }
        envio = true;
      }
    }
  } finally {
    procesando = false;
  }
  return envio;
}

/** Descarta una operación que el servidor rechazó (el chofer debe volver a capturarla). */
export async function descartar(id: string) {
  await guardarCola((await leerCola()).filter((o) => o.id !== id));
}
