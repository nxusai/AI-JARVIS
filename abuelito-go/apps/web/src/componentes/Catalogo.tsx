// Tabla editable genérica para los catálogos (clientes, productos, camionetas).
// Las bajas desactivan el registro en lugar de borrarlo para conservar el historial.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase, revisar } from "../supabase";
import { useSesion } from "../sesion";

export interface Campo {
  campo: string;
  etiqueta: string;
  tipo?: "texto" | "numero" | "hora" | "opciones" | "area";
  opciones?: { valor: string; etiqueta: string }[];
  requerido?: boolean;
  enTabla?: boolean;
  formato?: (valor: unknown) => ReactNode;
}

type Fila = Record<string, unknown> & { id: string; activo: boolean };

interface Props {
  tabla: string;
  titulo: string;
  campos: Campo[];
  orden: string;
  /** Acciones extra arriba de la tabla (p. ej. importar Excel). Reciben `recargar`. */
  extras?: (recargar: () => void) => ReactNode;
  /** Botones extra dentro del formulario (p. ej. ubicar dirección). */
  extrasFormulario?: (valores: Record<string, string>, cambiar: (campo: string, valor: string) => void) => ReactNode;
}

export function Catalogo({ tabla, titulo, campos, orden, extras, extrasFormulario }: Props) {
  const { perfil } = useSesion();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);
  const [editando, setEditando] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    const data = revisar(await supabase.from(tabla).select("*").order(orden));
    setFilas(data as Fila[]);
  }, [tabla, orden]);

  useEffect(() => {
    recargar().catch((e) => setError(String(e.message ?? e)));
  }, [recargar]);

  const visibles = filas.filter(
    (f) =>
      (verInactivos || f.activo) &&
      JSON.stringify(f).toLowerCase().includes(busqueda.toLowerCase()),
  );

  function abrir(fila?: Fila) {
    const valores: Record<string, string> = {};
    for (const c of campos) {
      valores[c.campo] = fila?.[c.campo] == null ? (c.opciones?.[0]?.valor ?? "") : String(fila[c.campo]);
    }
    if (fila) valores.id = fila.id;
    setEditando(valores);
    setError("");
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!editando || !perfil) return;
    const registro: Record<string, unknown> = { empresa_id: perfil.empresa_id };
    for (const c of campos) {
      const v = editando[c.campo]?.trim() ?? "";
      // Al agregar se omiten los vacíos para que apliquen los valores por defecto de la base.
      if (v === "" && !editando.id) continue;
      registro[c.campo] = v === "" ? null : c.tipo === "numero" ? Number(v) : v;
    }
    try {
      if (editando.id) revisar(await supabase.from(tabla).update(registro).eq("id", editando.id));
      else revisar(await supabase.from(tabla).insert(registro));
      setEditando(null);
      await recargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function cambiarActivo(fila: Fila) {
    try {
      revisar(await supabase.from(tabla).update({ activo: !fila.activo }).eq("id", fila.id));
      await recargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const enTabla = campos.filter((c) => c.enTabla !== false);
  const cambiar = (campo: string, valor: string) => setEditando((v) => (v ? { ...v, [campo]: valor } : v));

  return (
    <section>
      <header className="encabezado">
        <h1>{titulo}</h1>
        <div className="acciones">
          {extras?.(recargar)}
          <button onClick={() => abrir()}>Agregar</button>
        </div>
      </header>
      <div className="filtros">
        <input placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <label className="casilla">
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
          Ver dados de baja
        </label>
      </div>
      {error && <p className="error">{error}</p>}

      {editando && (
        <form className="tarjeta formulario" onSubmit={guardar}>
          <h2>{editando.id ? "Editar" : "Agregar"}</h2>
          <div className="rejilla">
            {campos.map((c) => (
              <label key={c.campo} className={c.tipo === "area" ? "ancho" : undefined}>
                {c.etiqueta}
                {c.tipo === "opciones" ? (
                  <select value={editando[c.campo]} onChange={(e) => cambiar(c.campo, e.target.value)} required={c.requerido}>
                    {c.opciones!.map((o) => (
                      <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
                    ))}
                  </select>
                ) : c.tipo === "area" ? (
                  <textarea value={editando[c.campo]} onChange={(e) => cambiar(c.campo, e.target.value)} />
                ) : (
                  <input
                    type={c.tipo === "numero" ? "number" : c.tipo === "hora" ? "time" : "text"}
                    step={c.tipo === "numero" ? "any" : undefined}
                    value={editando[c.campo]}
                    onChange={(e) => cambiar(c.campo, e.target.value)}
                    required={c.requerido}
                  />
                )}
              </label>
            ))}
          </div>
          {extrasFormulario?.(editando, cambiar)}
          <div className="acciones">
            <button type="button" className="secundario" onClick={() => setEditando(null)}>Cancelar</button>
            <button>Guardar</button>
          </div>
        </form>
      )}

      <table>
        <thead>
          <tr>
            {enTabla.map((c) => <th key={c.campo}>{c.etiqueta}</th>)}
            <th />
          </tr>
        </thead>
        <tbody>
          {visibles.map((f) => (
            <tr key={f.id} className={f.activo ? undefined : "inactivo"}>
              {enTabla.map((c) => (
                <td key={c.campo}>{c.formato ? c.formato(f[c.campo]) : String(f[c.campo] ?? "")}</td>
              ))}
              <td className="derecha">
                <button className="enlace" onClick={() => abrir(f)}>Editar</button>
                <button className="enlace" onClick={() => cambiarActivo(f)}>{f.activo ? "Dar de baja" : "Reactivar"}</button>
              </td>
            </tr>
          ))}
          {visibles.length === 0 && (
            <tr><td colSpan={enTabla.length + 1} className="vacio">Sin registros</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
