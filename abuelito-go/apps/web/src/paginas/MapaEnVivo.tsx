import { useCallback, useEffect, useState } from "react";
import { fechaLocal, type Perfil, type Ruta } from "@abuelito/shared";
import { Mapa, type Marca } from "../componentes/Mapa";
import { supabase, revisar } from "../supabase";

interface Ubicacion {
  ruta_id: string;
  lat: number;
  lng: number;
  registrado_en: string;
}

const COLORES = ["#1f6feb", "#8250df", "#bf3989", "#1a7f37", "#bc4c00", "#0a3069"];

export function MapaEnVivo() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [choferes, setChoferes] = useState<Perfil[]>([]);
  const [ultimas, setUltimas] = useState<Record<string, Ubicacion>>({});
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    const hoy = revisar(await supabase.from("rutas").select("*").eq("fecha", fechaLocal()).in("estado", ["en_curso", "terminada"])) as Ruta[];
    setRutas(hoy);
    setChoferes(revisar(await supabase.from("perfiles").select("*").eq("rol", "chofer")) as Perfil[]);
    if (hoy.length === 0) return;
    const ubic = revisar(
      await supabase
        .from("ubicaciones")
        .select("ruta_id, lat, lng, registrado_en")
        .in("ruta_id", hoy.map((r) => r.id))
        .order("registrado_en", { ascending: false })
        .limit(500),
    ) as Ubicacion[];
    const porRuta: Record<string, Ubicacion> = {};
    for (const u of ubic) porRuta[u.ruta_id] ??= u;
    setUltimas(porRuta);
  }, []);

  useEffect(() => {
    recargar().catch((e) => setError(e.message));
    const canal = supabase
      .channel("ubicaciones")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ubicaciones" }, (cambio) => {
        const u = cambio.new as Ubicacion;
        setUltimas((prev) => ({ ...prev, [u.ruta_id]: u }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [recargar]);

  const marcas: Marca[] = rutas
    .filter((r) => ultimas[r.id])
    .map((r, i) => {
      const u = ultimas[r.id]!;
      const chofer = choferes.find((c) => c.id === r.chofer_id)?.nombre ?? "Chofer";
      return {
        id: r.id,
        lat: u.lat,
        lng: u.lng,
        etiqueta: chofer.slice(0, 2).toUpperCase(),
        color: COLORES[i % COLORES.length],
        detalle: `${r.nombre} · ${chofer} · ${new Date(u.registrado_en).toLocaleTimeString("es-MX")}`,
      };
    });

  return (
    <section>
      <header className="encabezado"><h1>Mapa en vivo</h1></header>
      {error && <p className="error">{error}</p>}
      {rutas.length === 0 ? (
        <p className="vacio">No hay rutas en curso.</p>
      ) : (
        <>
          <Mapa marcas={marcas} alto={560} />
          {marcas.length < rutas.length && (
            <p className="nota">{rutas.length - marcas.length} ruta(s) en curso aún no reportan ubicación.</p>
          )}
        </>
      )}
    </section>
  );
}
