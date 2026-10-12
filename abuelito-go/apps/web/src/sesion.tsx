import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Empresa, Perfil } from "@abuelito/shared";
import { supabase } from "./supabase";

interface EstadoSesion {
  cargando: boolean;
  sesion: Session | null;
  perfil: Perfil | null;
  empresa: Empresa | null;
}

const Contexto = createContext<EstadoSesion>({ cargando: true, sesion: null, perfil: null, empresa: null });

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ cargando: true, sesion: null, perfil: null, empresa: null });

  useEffect(() => {
    async function cargar(sesion: Session | null) {
      if (!sesion) {
        setEstado({ cargando: false, sesion: null, perfil: null, empresa: null });
        return;
      }
      const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", sesion.user.id).maybeSingle();
      const { data: empresa } = perfil
        ? await supabase.from("empresas").select("*").eq("id", perfil.empresa_id).maybeSingle()
        : { data: null };
      setEstado({ cargando: false, sesion, perfil: perfil as Perfil | null, empresa: empresa as Empresa | null });
    }

    supabase.auth.getSession().then(({ data }) => cargar(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      // Diferido: no se debe llamar a Supabase dentro del callback de auth.
      setTimeout(() => cargar(sesion), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export const useSesion = () => useContext(Contexto);
