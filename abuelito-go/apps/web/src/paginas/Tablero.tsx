import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { ETIQUETA_ESTADO_RUTA, fechaLocal, formatoMoneda, type ResumenRuta } from "@abuelito/shared";
import { supabase, revisar } from "../supabase";

export function Tablero() {
  const hoy = fechaLocal();
  const [rutas, setRutas] = useState<ResumenRuta[]>([]);
  const [sinRuta, setSinRuta] = useState(0);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    setRutas(revisar(await supabase.from("resumen_rutas").select("*").eq("fecha", hoy).order("nombre")) as ResumenRuta[]);
    const { count } = await supabase
      .from("ordenes")
      .select("id", { count: "exact", head: true })
      .eq("fecha_entrega", hoy)
      .eq("estado", "pendiente");
    setSinRuta(count ?? 0);
  }, [hoy]);

  useEffect(() => {
    recargar().catch((e) => setError(e.message));
    // Se actualiza solo cuando un chofer registra una entrega o cambia una ruta.
    const canal = supabase
      .channel("tablero")
      .on("postgres_changes", { event: "*", schema: "public", table: "paradas" }, () => recargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "rutas" }, () => recargar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [recargar]);

  const total = rutas.reduce((t, r) => t + r.paradas_total, 0);
  const hechas = rutas.reduce((t, r) => t + r.paradas_completadas, 0);
  const fallidas = rutas.reduce((t, r) => t + r.paradas_fallidas, 0);
  const efectivo = rutas.filter((r) => r.estado !== "cerrada").reduce((t, r) => t + Number(r.efectivo_esperado), 0);

  return (
    <section>
      <header className="encabezado"><h1>Hoy, {hoy}</h1></header>
      {error && <p className="error">{error}</p>}
      <div className="indicadores">
        <div className="tarjeta"><small>Entregas</small><strong>{hechas} / {total}</strong></div>
        <div className="tarjeta"><small>No entregadas</small><strong>{fallidas}</strong></div>
        <div className="tarjeta"><small>Órdenes sin ruta</small><strong>{sinRuta}</strong>{sinRuta > 0 && <Link to="/rutas">Asignar</Link>}</div>
        <div className="tarjeta"><small>Efectivo por recibir</small><strong>{formatoMoneda(efectivo)}</strong></div>
      </div>
      <h2>Rutas del día</h2>
      <table>
        <thead><tr><th>Ruta</th><th>Avance</th><th>Estado</th></tr></thead>
        <tbody>
          {rutas.map((r) => (
            <tr key={r.ruta_id}>
              <td><Link to={`/rutas/${r.ruta_id}`}>{r.nombre}</Link></td>
              <td>
                <progress max={r.paradas_total || 1} value={r.paradas_completadas} /> {r.paradas_completadas} / {r.paradas_total}
              </td>
              <td><span className={`estado ${r.estado}`}>{ETIQUETA_ESTADO_RUTA[r.estado]}</span></td>
            </tr>
          ))}
          {rutas.length === 0 && <tr><td colSpan={3} className="vacio">No hay rutas hoy. <Link to="/rutas">Crear una</Link></td></tr>}
        </tbody>
      </table>
    </section>
  );
}
