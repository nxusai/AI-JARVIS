import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Perfil } from "@abuelito/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

interface EstadoSesion {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
}

const Contexto = createContext<EstadoSesion>({ cargando: true, sesion: null, perfil: null });
const CLAVE_PERFIL = "abuelito:perfil";

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ cargando: true, sesion: null, perfil: null });

  useEffect(() => {
    async function cargar(sesion: Session | null) {
      if (!sesion) {
        await AsyncStorage.removeItem(CLAVE_PERFIL);
        setEstado({ cargando: false, sesion: null, perfil: null });
        return;
      }
      // Sin señal se usa el perfil guardado de la última vez.
      const { data } = await supabase.from("perfiles").select("*").eq("id", sesion.user.id).maybeSingle();
      let perfil = data as Perfil | null;
      if (perfil) await AsyncStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil));
      else {
        const guardado = await AsyncStorage.getItem(CLAVE_PERFIL);
        perfil = guardado ? (JSON.parse(guardado) as Perfil) : null;
      }
      setEstado({ cargando: false, sesion, perfil });
    }

    supabase.auth.getSession().then(({ data }) => cargar(data.session));
    const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === "TOKEN_REFRESHED") return;
      setTimeout(() => cargar(sesion), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export const useSesion = () => useContext(Contexto);
