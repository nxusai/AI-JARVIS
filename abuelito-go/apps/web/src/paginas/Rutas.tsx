import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ETIQUETA_ESTADO_RUTA, fechaLocal, formatoMoneda, type Camioneta, type Perfil, type ResumenRuta } from "@abuelito/shared";
import { supabase, revisar } from "../supabase";
import { useSesion } from "../sesion";

export function Rutas() {
  const { perfil } = useSesion();
  const navegar = useNavigate();
  const [fecha, setFecha] = useState(fechaLocal());
  const [rutas, setRutas] = useState<ResumenRuta[]>([]);
  const [choferes, setChoferes] = useState<Perfil[]>([]);
  const [camionetas, setCamionetas] = useState<Camioneta[]>([]);
  const [nueva, setNueva] = useState<{ nombre: string; chofer_id: string; camioneta_id: string } | null>(null);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    setRutas(revisar(await supabase.from("resumen_rutas").select("*").eq("fecha", fecha).order("nombre")) as ResumenRuta[]);
  }, [fecha]);

  useEffect(() => {
    recargar().catch((e) => setError(e.message));
  }, [recargar]);

  useEffect(() => {
    (async () => {
      setChoferes(revisar(await supabase.from("perfiles").select("*").eq("rol", "chofer").eq("activo", true).order("nombre")) as Perfil[]);
      setCamionetas(revisar(await supabase.from("camionetas").select("*").eq("activo", true).order("nombre")) as Camioneta[]);
    })().catch((e) => setError(e.message));
  }, []);

  const nombreChofer = (id: string | null) => choferes.find((c) => c.id === id)?.nombre ?? "Sin chofer";
  const nombreCamioneta = (id: string | null) => camionetas.find((c) => c.id === id)?.nombre ?? "Sin camioneta";

  async function crear(e: FormEvent) {
    e.preventDefault();
    if (!nueva || !perfil) return;
    try {
      const ruta = revisar(
        await supabase
          .from("rutas")
          .insert({
            empresa_id: perfil.empresa_id,
            fecha,
            nombre: nueva.nombre,
            chofer_id: nueva.chofer_id || null,
            camioneta_id: nueva.camioneta_id || null,
          })
          .select("id")
          .single(),
      ) as { id: string };
      navegar(`/rutas/${ruta.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <header className="encabezado">
        <h1>Rutas</h1>
        <div className="acciones">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <button onClick={() => setNueva({ nombre: `Ruta ${rutas.length + 1}`, chofer_id: "", camioneta_id: "" })}>Nueva ruta</button>
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {nueva && (
        <form className="tarjeta formulario" onSubmit={crear}>
          <h2>Nueva ruta para el {fecha}</h2>
          <div className="rejilla">
            <label>Nombre<input value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} required /></label>
            <label>
              Chofer
              <select value={nueva.chofer_id} onChange={(e) => setNueva({ ...nueva, chofer_id: e.target.value })}>
                <option value="">Asignar después</option>
                {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label>
              Camioneta
              <select value={nueva.camioneta_id} onChange={(e) => setNueva({ ...nueva, camioneta_id: e.target.value })}>
                <option value="">Asignar después</option>
                {camionetas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
          </div>
          <div className="acciones">
            <button type="button" className="secundario" onClick={() => setNueva(null)}>Cancelar</button>
            <button>Crear y agregar paradas</button>
          </div>
        </form>
      )}
      <table>
        <thead>
          <tr><th>Ruta</th><th>Chofer</th><th>Camioneta</th><th>Avance</th><th>No entregadas</th><th>Efectivo esperado</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {rutas.map((r) => (
            <tr key={r.ruta_id}>
              <td><Link to={`/rutas/${r.ruta_id}`}>{r.nombre}</Link></td>
              <td>{nombreChofer(r.chofer_id)}</td>
              <td>{nombreCamioneta(r.camioneta_id)}</td>
              <td>{r.paradas_completadas} / {r.paradas_total}</td>
              <td>{r.paradas_fallidas}</td>
              <td>{formatoMoneda(r.efectivo_esperado)}</td>
              <td><span className={`estado ${r.estado}`}>{ETIQUETA_ESTADO_RUTA[r.estado]}</span></td>
            </tr>
          ))}
          {rutas.length === 0 && <tr><td colSpan={7} className="vacio">Sin rutas para esta fecha</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
