// Ruta del día del chofer: se descarga del servidor, se guarda en el teléfono para
// trabajar sin señal y se combina con las operaciones que aún no se envían.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { fechaLocal } from "@abuelito/shared";
import { supabase } from "./supabase";
import { useSesion } from "./sesion";
import { encolar, leerCola, procesarCola } from "./cola";
import { detenerSeguimiento, iniciarSeguimiento } from "./ubicacion";
import type { Operacion, ParadaApp, RutaApp } from "./tipos";

const CLAVE_RUTA = "abuelito:ruta";

const SELECT =
  "*, camionetas(nombre, placas), " +
  "paradas(id, empresa_id, secuencia, estado, motivo, completada_en, pagos(metodo, monto), " +
  "ordenes(id, folio, notas, clientes(*), orden_lineas(id, cantidad, precio_unitario, cantidad_entregada, productos(nombre, unidad, temp_min, temp_max))))";

interface EstadoRuta {
  ruta: RutaApp | null;
  cola: Operacion[];
  cargando: boolean;
  enLinea: boolean;
  actualizadoEn: string | null;
  refrescar: () => Promise<void>;
  registrar: (op: Operacion) => Promise<void>;
}

const Contexto = createContext<EstadoRuta | null>(null);

/** Aplica las operaciones pendientes sobre la ruta descargada para que la pantalla refleje lo capturado. */
function combinar(ruta: RutaApp | null, cola: Operacion[]): RutaApp | null {
  if (!ruta) return null;
  let r: RutaApp = { ...ruta, paradas: [...ruta.paradas] };
  for (const op of cola) {
    if (op.ruta_id !== r.id || op.error) continue;
    if (op.tipo === "iniciar" && r.estado === "publicada") r = { ...r, estado: "en_curso" };
    if (op.tipo === "terminar" && r.estado === "en_curso") r = { ...r, estado: "terminada" };
    if (op.tipo === "entrega") {
      r.paradas = r.paradas.map(
        (p): ParadaApp =>
          p.id === op.registro.p_parada_id && p.estado === "pendiente"
            ? {
                ...p,
                estado: op.registro.p_estado,
                motivo: op.registro.p_motivo ?? null,
                completada_en: new Date().toISOString(),
                pagos: (op.registro.p_pagos ?? []).filter((x) => x.monto > 0),
              }
            : p,
      );
    }
  }
  return r;
}

export function ProveedorRuta({ children }: { children: ReactNode }) {
  const { perfil } = useSesion();
  const [servidor, setServidor] = useState<RutaApp | null>(null);
  const [cola, setCola] = useState<Operacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enLinea, setEnLinea] = useState(true);
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null);

  const descargar = useCallback(async () => {
    if (!perfil) return;
    const { data, error } = await supabase
      .from("rutas")
      .select(SELECT)
      .eq("fecha", fechaLocal())
      .eq("chofer_id", perfil.id)
      .neq("estado", "borrador")
      .order("creado_en");
    if (error) return; // sin señal: se queda la copia guardada
    const rutas = (data ?? []) as unknown as RutaApp[];
    // Si hay varias, la primera que no esté terminada; si no, la última.
    const ruta = rutas.find((r) => r.estado === "publicada" || r.estado === "en_curso") ?? rutas[rutas.length - 1] ?? null;
    if (ruta) ruta.paradas.sort((a, b) => a.secuencia - b.secuencia);
    const ahora = new Date().toISOString();
    setServidor(ruta);
    setActualizadoEn(ahora);
    await AsyncStorage.setItem(CLAVE_RUTA, JSON.stringify({ ruta, actualizadoEn: ahora }));
  }, [perfil]);

  const refrescar = useCallback(async () => {
    await procesarCola();
    setCola(await leerCola());
    await descargar();
    setCola(await leerCola());
  }, [descargar]);

  // Arranque: primero lo guardado (funciona sin señal), luego lo del servidor.
  useEffect(() => {
    if (!perfil) return;
    (async () => {
      const guardado = await AsyncStorage.getItem(CLAVE_RUTA);
      if (guardado) {
        const { ruta, actualizadoEn } = JSON.parse(guardado) as { ruta: RutaApp | null; actualizadoEn: string };
        if (ruta?.fecha === fechaLocal() && ruta.chofer_id === perfil.id) {
          setServidor(ruta);
          setActualizadoEn(actualizadoEn);
        }
      }
      setCola(await leerCola());
      setCargando(false);
      await refrescar();
    })();
  }, [perfil, refrescar]);

  // Reintenta al recuperar señal, al volver a la app y cada minuto.
  useEffect(() => {
    const quitarRed = NetInfo.addEventListener((s) => {
      const conectado = Boolean(s.isConnected && s.isInternetReachable !== false);
      setEnLinea(conectado);
      if (conectado) refrescar();
    });
    const app = AppState.addEventListener("change", (e) => e === "active" && refrescar());
    const intervalo = setInterval(refrescar, 60 * 1000);
    return () => {
      quitarRed();
      app.remove();
      clearInterval(intervalo);
    };
  }, [refrescar]);

  // Cambios de la oficina (paradas agregadas, movidas o reordenadas) llegan al momento.
  useEffect(() => {
    if (!servidor?.id) return;
    const canal = supabase
      .channel(`chofer-ruta-${servidor.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "paradas", filter: `ruta_id=eq.${servidor.id}` }, () => descargar())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rutas", filter: `id=eq.${servidor.id}` }, () => descargar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [servidor?.id, descargar]);

  const ruta = useMemo(() => combinar(servidor, cola), [servidor, cola]);

  // El GPS se enciende mientras la ruta está en curso.
  const rutaId = ruta?.id;
  const empresaId = ruta?.empresa_id;
  const enCurso = ruta?.estado === "en_curso";
  useEffect(() => {
    if (!perfil || !rutaId || !empresaId) return;
    const accion = enCurso
      ? iniciarSeguimiento({ ruta_id: rutaId, empresa_id: empresaId, chofer_id: perfil.id })
      : detenerSeguimiento();
    accion.catch(() => {});
  }, [perfil, rutaId, empresaId, enCurso]);

  const registrar = useCallback(
    async (op: Operacion) => {
      await encolar(op);
      setCola(await leerCola());
      refrescar();
    },
    [refrescar],
  );

  const valor = useMemo(
    () => ({ ruta, cola, cargando, enLinea, actualizadoEn, refrescar, registrar }),
    [ruta, cola, cargando, enLinea, actualizadoEn, refrescar, registrar],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useRuta() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useRuta debe usarse dentro de ProveedorRuta");
  return ctx;
}

/** Id único para cada operación (idempotencia en el servidor). */
export function nuevoId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}
