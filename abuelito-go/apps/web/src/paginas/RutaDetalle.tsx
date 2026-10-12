import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ETIQUETA_ESTADO_PARADA,
  ETIQUETA_ESTADO_RUTA,
  formatoMoneda,
  horarioRecepcion,
  importeLineas,
  optimizarRuta,
  type Camioneta,
  type Cliente,
  type EstadoParada,
  type Perfil,
  type ResumenRuta,
  type Ruta,
} from "@abuelito/shared";
import { COLOR_PARADA, Mapa, type Marca } from "../componentes/Mapa";
import { supabase, revisar } from "../supabase";
import { useSesion } from "../sesion";

interface ParadaDetalle {
  id: string;
  secuencia: number;
  estado: EstadoParada;
  motivo: string | null;
  recibio_nombre: string | null;
  foto_path: string | null;
  firma_path: string | null;
  completada_en: string | null;
  ordenes: {
    id: string;
    folio: number;
    notas: string | null;
    clientes: Cliente;
    orden_lineas: { cantidad: number; precio_unitario: number; cantidad_entregada: number | null; productos: { nombre: string } }[];
  };
}

interface OrdenPendiente {
  id: string;
  folio: number;
  clientes: { nombre: string; lat: number | null };
  orden_lineas: { cantidad: number; precio_unitario: number }[];
}

interface Lectura {
  momento: string;
  valor_c: number;
  creado_en: string;
}

const SELECT_PARADAS =
  "id, secuencia, estado, motivo, recibio_nombre, foto_path, firma_path, completada_en, " +
  "ordenes(id, folio, notas, clientes(*), orden_lineas(cantidad, precio_unitario, cantidad_entregada, productos(nombre)))";

export function RutaDetalle() {
  const { id } = useParams();
  const { empresa } = useSesion();
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [paradas, setParadas] = useState<ParadaDetalle[]>([]);
  const [pendientes, setPendientes] = useState<OrdenPendiente[]>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [otrasRutas, setOtrasRutas] = useState<Ruta[]>([]);
  const [choferes, setChoferes] = useState<Perfil[]>([]);
  const [camionetas, setCamionetas] = useState<Camioneta[]>([]);
  const [resumen, setResumen] = useState<ResumenRuta | null>(null);
  const [lecturas, setLecturas] = useState<Lectura[]>([]);
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [efectivo, setEfectivo] = useState("");
  const [notasCierre, setNotasCierre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    if (!id) return;
    const r = revisar(await supabase.from("rutas").select("*").eq("id", id).single()) as Ruta;
    setRuta(r);
    setParadas(revisar(await supabase.from("paradas").select(SELECT_PARADAS).eq("ruta_id", id).order("secuencia")) as unknown as ParadaDetalle[]);
    setPendientes(
      revisar(
        await supabase
          .from("ordenes")
          .select("id, folio, clientes(nombre, lat), orden_lineas(cantidad, precio_unitario)")
          .eq("fecha_entrega", r.fecha)
          .eq("estado", "pendiente")
          .order("folio"),
      ) as unknown as OrdenPendiente[],
    );
    setOtrasRutas(revisar(await supabase.from("rutas").select("*").eq("fecha", r.fecha).neq("id", id).neq("estado", "cerrada")) as Ruta[]);
    setResumen(revisar(await supabase.from("resumen_rutas").select("*").eq("ruta_id", id).single()) as ResumenRuta);
    setLecturas(revisar(await supabase.from("lecturas_temperatura").select("momento, valor_c, creado_en").eq("ruta_id", id).order("creado_en")) as Lectura[]);
    const { data: u } = await supabase
      .from("ubicaciones")
      .select("lat, lng")
      .eq("ruta_id", id)
      .order("registrado_en", { ascending: false })
      .limit(1)
      .maybeSingle();
    setUbicacion(u);
  }, [id]);

  useEffect(() => {
    recargar().catch((e) => setError(e.message));
    const canal = supabase
      .channel(`ruta-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "paradas", filter: `ruta_id=eq.${id}` }, () => recargar())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ubicaciones", filter: `ruta_id=eq.${id}` }, (c) =>
        setUbicacion(c.new as { lat: number; lng: number }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, recargar]);

  useEffect(() => {
    (async () => {
      setChoferes(revisar(await supabase.from("perfiles").select("*").eq("rol", "chofer").eq("activo", true).order("nombre")) as Perfil[]);
      setCamionetas(revisar(await supabase.from("camionetas").select("*").eq("activo", true).order("nombre")) as Camioneta[]);
    })().catch((e) => setError(e.message));
  }, []);

  async function ejecutar(accion: () => Promise<void>, exito?: string) {
    setError("");
    setMensaje("");
    try {
      await accion();
      if (exito) setMensaje(exito);
      await recargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  /** Guarda el orden de las paradas tal como viene en la lista. */
  async function guardarSecuencia(lista: { id: string }[]) {
    const resultados = await Promise.all(lista.map((p, i) => supabase.from("paradas").update({ secuencia: i + 1 }).eq("id", p.id)));
    const fallo = resultados.find((r) => r.error);
    if (fallo?.error) throw new Error(fallo.error.message);
  }

  const editable = ruta != null && ["borrador", "publicada", "en_curso"].includes(ruta.estado);

  const agregar = () =>
    ejecutar(async () => {
      if (!ruta) return;
      const inicio = paradas.length;
      revisar(
        await supabase.from("paradas").insert(
          [...seleccion].map((ordenId, i) => ({
            empresa_id: ruta.empresa_id,
            ruta_id: ruta.id,
            orden_id: ordenId,
            secuencia: inicio + i + 1,
          })),
        ),
      );
      setSeleccion(new Set());
    });

  const quitar = (p: ParadaDetalle) =>
    ejecutar(async () => {
      revisar(await supabase.from("paradas").delete().eq("id", p.id).eq("estado", "pendiente"));
      await guardarSecuencia(paradas.filter((x) => x.id !== p.id));
    });

  const mover = (indice: number, delta: number) =>
    ejecutar(async () => {
      const lista = [...paradas];
      const destino = indice + delta;
      if (destino < 0 || destino >= lista.length) return;
      [lista[indice], lista[destino]] = [lista[destino]!, lista[indice]!];
      await guardarSecuencia(lista);
    });

  const moverARuta = (p: ParadaDetalle, rutaDestino: string) =>
    ejecutar(async () => {
      const { count } = await supabase.from("paradas").select("id", { count: "exact", head: true }).eq("ruta_id", rutaDestino);
      revisar(await supabase.from("paradas").update({ ruta_id: rutaDestino, secuencia: (count ?? 0) + 1 }).eq("id", p.id));
      await guardarSecuencia(paradas.filter((x) => x.id !== p.id));
    }, "Parada movida a la otra ruta");

  const optimizar = () =>
    ejecutar(async () => {
      if (empresa?.base_lat == null || empresa.base_lng == null) {
        throw new Error("Falta la ubicación de la bodega (empresas.base_lat / base_lng) para optimizar.");
      }
      // Las paradas ya atendidas quedan primero; se optimizan solo las pendientes con ubicación.
      const hechas = paradas.filter((p) => p.estado !== "pendiente");
      const pendientesRuta = paradas.filter((p) => p.estado === "pendiente");
      const conUbicacion = pendientesRuta.filter((p) => p.ordenes.clientes.lat != null && p.ordenes.clientes.lng != null);
      const sinUbicacion = pendientesRuta.filter((p) => !conUbicacion.includes(p));
      const ultimoPunto = [...hechas].reverse().find((p) => p.ordenes.clientes.lat != null)?.ordenes.clientes;
      const desde = ultimoPunto ? { lat: ultimoPunto.lat!, lng: ultimoPunto.lng! } : { lat: empresa.base_lat, lng: empresa.base_lng };
      const optimas = optimizarRuta(
        desde,
        conUbicacion.map((p) => ({ id: p.id, lat: p.ordenes.clientes.lat!, lng: p.ordenes.clientes.lng! })),
      );
      await guardarSecuencia([...hechas, ...optimas, ...sinUbicacion]);
      if (sinUbicacion.length) {
        setMensaje(`${sinUbicacion.length} cliente(s) sin ubicación quedaron al final. Ubícalos en Clientes.`);
      }
    });

  const actualizarRuta = (cambios: Partial<Ruta>, exito?: string) =>
    ejecutar(async () => {
      revisar(await supabase.from("rutas").update(cambios).eq("id", id!));
    }, exito);

  const publicar = () => {
    if (!ruta?.chofer_id || !ruta.camioneta_id) return setError("Asigna chofer y camioneta antes de publicar.");
    if (paradas.length === 0) return setError("La ruta no tiene paradas.");
    actualizarRuta({ estado: "publicada" }, "Ruta publicada: el chofer ya la ve en su iPhone.");
  };

  const cerrar = () =>
    ejecutar(async () => {
      if (efectivo === "") throw new Error("Captura el efectivo recibido.");
      revisar(await supabase.rpc("cerrar_ruta", { p_ruta_id: id, p_efectivo_recibido: Number(efectivo), p_notas: notasCierre || null }));
    }, "Ruta cerrada");

  async function verEvidencia(ruta: string) {
    const { data, error } = await supabase.storage.from("entregas").createSignedUrl(ruta, 300);
    if (error) setError(error.message);
    else window.open(data.signedUrl, "_blank");
  }

  if (!ruta) return <p>{error || "Cargando…"}</p>;

  const marcas: Marca[] = paradas
    .filter((p) => p.ordenes.clientes.lat != null && p.ordenes.clientes.lng != null)
    .map((p) => ({
      id: p.id,
      lat: p.ordenes.clientes.lat!,
      lng: p.ordenes.clientes.lng!,
      etiqueta: String(p.secuencia),
      color: COLOR_PARADA[p.estado],
      detalle: `${p.secuencia}. ${p.ordenes.clientes.nombre} — ${ETIQUETA_ESTADO_PARADA[p.estado]}`,
    }));
  if (empresa?.base_lat != null && empresa.base_lng != null) {
    marcas.unshift({ id: "base", lat: empresa.base_lat, lng: empresa.base_lng, etiqueta: "B", color: "#57606a", detalle: "Bodega" });
  }
  if (ubicacion) {
    marcas.push({ id: "camioneta", ...ubicacion, etiqueta: "🚚", color: "#8250df", detalle: "Última ubicación de la camioneta" });
  }
  const recorrido = marcas.filter((m) => m.id !== "camioneta");
  if (empresa?.base_lat != null && empresa.base_lng != null && recorrido.length > 1) recorrido.push(recorrido[0]!);

  const diferencia = resumen && efectivo !== "" ? Number(efectivo) - Number(resumen.efectivo_esperado) : null;

  return (
    <section>
      <header className="encabezado">
        <div>
          <Link to="/rutas">← Rutas</Link>
          <h1>
            {ruta.nombre} <span className={`estado ${ruta.estado}`}>{ETIQUETA_ESTADO_RUTA[ruta.estado]}</span>
          </h1>
          <small>{ruta.fecha}</small>
        </div>
        <div className="acciones">
          {ruta.estado === "borrador" && <button onClick={publicar}>Publicar al chofer</button>}
          {ruta.estado === "publicada" && (
            <button className="secundario" onClick={() => actualizarRuta({ estado: "borrador" }, "La ruta regresó a borrador")}>
              Regresar a borrador
            </button>
          )}
        </div>
      </header>
      {error && <p className="error">{error}</p>}
      {mensaje && <p className="exito">{mensaje}</p>}

      <div className="rejilla">
        <label>
          Chofer
          <select
            value={ruta.chofer_id ?? ""}
            disabled={!editable || ruta.estado === "en_curso"}
            onChange={(e) => actualizarRuta({ chofer_id: e.target.value || null })}
          >
            <option value="">Sin chofer</option>
            {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label>
          Camioneta
          <select
            value={ruta.camioneta_id ?? ""}
            disabled={!editable || ruta.estado === "en_curso"}
            onChange={(e) => actualizarRuta({ camioneta_id: e.target.value || null })}
          >
            <option value="">Sin camioneta</option>
            {camionetas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      </div>

      <div className="dos-columnas">
        <div>
          <header className="encabezado">
            <h2>Paradas ({paradas.length})</h2>
            {editable && paradas.length > 1 && <button onClick={optimizar}>Optimizar orden</button>}
          </header>
          <ol className="paradas">
            {paradas.map((p, i) => {
              const c = p.ordenes.clientes;
              return (
                <li key={p.id} className={`tarjeta parada ${p.estado}`}>
                  <div className="parada-titulo">
                    <strong>{p.secuencia}. {c.nombre}</strong>
                    <span className={`estado ${p.estado}`}>{ETIQUETA_ESTADO_PARADA[p.estado]}</span>
                  </div>
                  <small>
                    {c.direccion} · Recibe {horarioRecepcion(c.horario_desde, c.horario_hasta)} · {formatoMoneda(importeLineas(p.ordenes.orden_lineas))}
                    {c.condicion_pago === "credito" && ` · Crédito, saldo ${formatoMoneda(c.saldo)}`}
                  </small>
                  {p.motivo && <small className="error">Motivo: {p.motivo}</small>}
                  {p.estado !== "pendiente" && (
                    <small>
                      {p.recibio_nombre && `Recibió: ${p.recibio_nombre} · `}
                      {p.completada_en && new Date(p.completada_en).toLocaleTimeString("es-MX")}
                      {p.foto_path && <button className="enlace" onClick={() => verEvidencia(p.foto_path!)}>Foto</button>}
                      {p.firma_path && <button className="enlace" onClick={() => verEvidencia(p.firma_path!)}>Firma</button>}
                    </small>
                  )}
                  {editable && p.estado === "pendiente" && (
                    <div className="acciones">
                      <button className="enlace" onClick={() => mover(i, -1)} disabled={i === 0}>↑</button>
                      <button className="enlace" onClick={() => mover(i, 1)} disabled={i === paradas.length - 1}>↓</button>
                      {otrasRutas.length > 0 && (
                        <select value="" onChange={(e) => e.target.value && moverARuta(p, e.target.value)}>
                          <option value="">Mover a…</option>
                          {otrasRutas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                        </select>
                      )}
                      <button className="enlace" onClick={() => quitar(p)}>Quitar</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {editable && (
            <div className="tarjeta">
              <h3>Órdenes del día sin ruta ({pendientes.length})</h3>
              {pendientes.length === 0 ? (
                <p className="vacio">No hay órdenes pendientes para esta fecha.</p>
              ) : (
                <>
                  {pendientes.map((o) => (
                    <label key={o.id} className="casilla">
                      <input
                        type="checkbox"
                        checked={seleccion.has(o.id)}
                        onChange={(e) => {
                          const s = new Set(seleccion);
                          if (e.target.checked) s.add(o.id);
                          else s.delete(o.id);
                          setSeleccion(s);
                        }}
                      />
                      #{o.folio} {o.clientes.nombre} · {formatoMoneda(importeLineas(o.orden_lineas))}
                      {o.clientes.lat == null && <em> (sin ubicación)</em>}
                    </label>
                  ))}
                  <div className="acciones">
                    <button className="secundario" onClick={() => setSeleccion(new Set(pendientes.map((o) => o.id)))}>Seleccionar todas</button>
                    <button onClick={agregar} disabled={seleccion.size === 0}>Agregar {seleccion.size} a la ruta</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div>
          <Mapa marcas={marcas} recorrido={recorrido} />
          {lecturas.length > 0 && (
            <div className="tarjeta">
              <h3>Temperaturas</h3>
              <table>
                <tbody>
                  {lecturas.map((l, i) => (
                    <tr key={i}>
                      <td>{l.momento}</td>
                      <td>{l.valor_c} °C</td>
                      <td>{new Date(l.creado_en).toLocaleTimeString("es-MX")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resumen && ["terminada", "cerrada"].includes(ruta.estado) && (
            <div className="tarjeta">
              <h3>Cierre de ruta</h3>
              <table>
                <tbody>
                  <tr><td>Entregas</td><td>{resumen.paradas_completadas - resumen.paradas_fallidas} de {resumen.paradas_total}</td></tr>
                  <tr><td>No entregadas</td><td>{resumen.paradas_fallidas}</td></tr>
                  <tr><td>Transferencias</td><td>{formatoMoneda(resumen.transferencias)}</td></tr>
                  <tr><td><strong>Efectivo esperado</strong></td><td><strong>{formatoMoneda(resumen.efectivo_esperado)}</strong></td></tr>
                  {ruta.estado === "cerrada" && (
                    <tr><td>Efectivo recibido</td><td>{formatoMoneda(ruta.efectivo_recibido)}</td></tr>
                  )}
                </tbody>
              </table>
              {ruta.estado === "terminada" && (
                <>
                  <div className="rejilla">
                    <label>Efectivo recibido<input type="number" step="0.01" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} /></label>
                    <label className="ancho">Notas<input value={notasCierre} onChange={(e) => setNotasCierre(e.target.value)} /></label>
                  </div>
                  {diferencia != null && diferencia !== 0 && (
                    <p className={diferencia < 0 ? "error" : "nota"}>
                      {diferencia < 0 ? "Faltan" : "Sobran"} {formatoMoneda(Math.abs(diferencia))}
                    </p>
                  )}
                  <button onClick={cerrar}>Cerrar ruta</button>
                </>
              )}
              {ruta.notas_cierre && <p className="nota">{ruta.notas_cierre}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
