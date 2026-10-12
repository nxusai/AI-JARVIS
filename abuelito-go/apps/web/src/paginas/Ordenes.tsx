import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { fechaLocal, formatoMoneda, importeLineas, type Cliente, type Producto } from "@abuelito/shared";
import { supabase, revisar } from "../supabase";
import { useSesion } from "../sesion";

interface OrdenFila {
  id: string;
  folio: number;
  fecha_entrega: string;
  estado: string;
  notas: string | null;
  clientes: { nombre: string } | null;
  orden_lineas: { cantidad: number; precio_unitario: number }[];
}

interface LineaNueva {
  producto_id: string;
  cantidad: string;
  precio_unitario: string;
}

export function Ordenes() {
  const { perfil } = useSesion();
  const [fecha, setFecha] = useState(fechaLocal());
  const [ordenes, setOrdenes] = useState<OrdenFila[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nueva, setNueva] = useState<{ cliente_id: string; notas: string; lineas: LineaNueva[] } | null>(null);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    const data = revisar(
      await supabase
        .from("ordenes")
        .select("id, folio, fecha_entrega, estado, notas, clientes(nombre), orden_lineas(cantidad, precio_unitario)")
        .eq("fecha_entrega", fecha)
        .order("folio"),
    );
    setOrdenes(data as unknown as OrdenFila[]);
  }, [fecha]);

  useEffect(() => {
    recargar().catch((e) => setError(e.message));
  }, [recargar]);

  useEffect(() => {
    (async () => {
      setClientes(revisar(await supabase.from("clientes").select("*").eq("activo", true).order("nombre")) as Cliente[]);
      setProductos(revisar(await supabase.from("productos").select("*").eq("activo", true).order("nombre")) as Producto[]);
    })().catch((e) => setError(e.message));
  }, []);

  const precioDe = useMemo(() => new Map(productos.map((p) => [p.id, p.precio])), [productos]);

  function cambiarLinea(i: number, cambios: Partial<LineaNueva>) {
    if (!nueva) return;
    const lineas = nueva.lineas.map((l, j) => (j === i ? { ...l, ...cambios } : l));
    setNueva({ ...nueva, lineas });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!nueva || !perfil) return;
    const lineas = nueva.lineas.filter((l) => l.producto_id && Number(l.cantidad) > 0);
    if (lineas.length === 0) {
      setError("Agrega al menos un producto con cantidad");
      return;
    }
    try {
      const orden = revisar(
        await supabase
          .from("ordenes")
          .insert({ empresa_id: perfil.empresa_id, cliente_id: nueva.cliente_id, fecha_entrega: fecha, notas: nueva.notas || null, creado_por: perfil.id })
          .select("id")
          .single(),
      ) as { id: string };
      const insert = await supabase.from("orden_lineas").insert(
        lineas.map((l) => ({
          empresa_id: perfil.empresa_id,
          orden_id: orden.id,
          producto_id: l.producto_id,
          cantidad: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario),
        })),
      );
      if (insert.error) {
        // Sin líneas la orden no sirve: se borra para no dejarla a medias.
        await supabase.from("ordenes").delete().eq("id", orden.id);
        throw new Error(insert.error.message);
      }
      setNueva(null);
      setError("");
      await recargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function cancelar(id: string) {
    if (!confirm("¿Cancelar esta orden?")) return;
    try {
      revisar(await supabase.from("ordenes").update({ estado: "cancelada" }).eq("id", id).eq("estado", "pendiente"));
      await recargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const total = nueva
    ? importeLineas(nueva.lineas.map((l) => ({ cantidad: Number(l.cantidad) || 0, precio_unitario: Number(l.precio_unitario) || 0 })))
    : 0;

  return (
    <section>
      <header className="encabezado">
        <h1>Órdenes</h1>
        <div className="acciones">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <button
            onClick={() => setNueva({ cliente_id: clientes[0]?.id ?? "", notas: "", lineas: [{ producto_id: "", cantidad: "1", precio_unitario: "" }] })}
            disabled={clientes.length === 0}
          >
            Nueva orden
          </button>
        </div>
      </header>
      {error && <p className="error">{error}</p>}

      {nueva && (
        <form className="tarjeta formulario" onSubmit={guardar}>
          <h2>Nueva orden para el {fecha}</h2>
          <div className="rejilla">
            <label>
              Cliente
              <select value={nueva.cliente_id} onChange={(e) => setNueva({ ...nueva, cliente_id: e.target.value })} required>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label className="ancho">Notas<input value={nueva.notas} onChange={(e) => setNueva({ ...nueva, notas: e.target.value })} /></label>
          </div>
          <table>
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Importe</th><th /></tr></thead>
            <tbody>
              {nueva.lineas.map((l, i) => (
                <tr key={i}>
                  <td>
                    <select
                      value={l.producto_id}
                      onChange={(e) => cambiarLinea(i, { producto_id: e.target.value, precio_unitario: String(precioDe.get(e.target.value) ?? "") })}
                    >
                      <option value="">Elegir…</option>
                      {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </td>
                  <td><input type="number" min="0" step="any" value={l.cantidad} onChange={(e) => cambiarLinea(i, { cantidad: e.target.value })} /></td>
                  <td><input type="number" min="0" step="any" value={l.precio_unitario} onChange={(e) => cambiarLinea(i, { precio_unitario: e.target.value })} /></td>
                  <td>{formatoMoneda((Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0))}</td>
                  <td>
                    <button type="button" className="enlace" onClick={() => setNueva({ ...nueva, lineas: nueva.lineas.filter((_, j) => j !== i) })}>Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="acciones">
            <button type="button" className="secundario" onClick={() => setNueva({ ...nueva, lineas: [...nueva.lineas, { producto_id: "", cantidad: "1", precio_unitario: "" }] })}>
              Agregar producto
            </button>
            <strong>Total {formatoMoneda(total)}</strong>
            <button type="button" className="secundario" onClick={() => setNueva(null)}>Cancelar</button>
            <button>Guardar orden</button>
          </div>
        </form>
      )}

      <table>
        <thead><tr><th>Folio</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Notas</th><th /></tr></thead>
        <tbody>
          {ordenes.map((o) => (
            <tr key={o.id} className={o.estado === "cancelada" ? "inactivo" : undefined}>
              <td>{o.folio}</td>
              <td>{o.clientes?.nombre}</td>
              <td>{formatoMoneda(importeLineas(o.orden_lineas))}</td>
              <td><span className={`estado ${o.estado}`}>{o.estado.replace("_", " ")}</span></td>
              <td>{o.notas}</td>
              <td className="derecha">
                {o.estado === "pendiente" && <button className="enlace" onClick={() => cancelar(o.id)}>Cancelar</button>}
              </td>
            </tr>
          ))}
          {ordenes.length === 0 && <tr><td colSpan={6} className="vacio">Sin órdenes para esta fecha</td></tr>}
        </tbody>
      </table>
    </section>
  );
}
