import { useRef, useState } from "react";
import { readSheet } from "read-excel-file/browser";
import { formatoMoneda, horarioRecepcion } from "@abuelito/shared";
import { Catalogo } from "../componentes/Catalogo";
import { supabase, revisar } from "../supabase";
import { useSesion } from "../sesion";

// Columnas que reconoce la importación (encabezados de la primera fila del Excel).
const COLUMNAS: Record<string, string> = {
  codigo: "codigo",
  "código": "codigo",
  nombre: "nombre",
  contacto: "contacto",
  telefono: "telefono",
  "teléfono": "telefono",
  direccion: "direccion",
  "dirección": "direccion",
  latitud: "lat",
  lat: "lat",
  longitud: "lng",
  lng: "lng",
  "horario desde": "horario_desde",
  "horario hasta": "horario_hasta",
  notas: "notas",
  "condicion de pago": "condicion_pago",
  "condición de pago": "condicion_pago",
  "limite de credito": "limite_credito",
  "límite de crédito": "limite_credito",
};

/** Busca coordenadas de una dirección con OpenStreetMap (gratis, uso moderado). */
async function geocodificar(direccion: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(direccion)}`;
  const r = await fetch(url, { headers: { "Accept-Language": "es" } });
  const [primero] = (await r.json()) as { lat: string; lon: string }[];
  return primero ? { lat: Number(primero.lat), lng: Number(primero.lon) } : null;
}

function ImportarExcel({ recargar }: { recargar: () => void }) {
  const { perfil } = useSesion();
  const entrada = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState("");

  async function importar(archivo: File) {
    if (!perfil) return;
    setMensaje("Leyendo archivo…");
    try {
      const filas = await readSheet(archivo);
      const [encabezados, ...datos] = filas;
      const mapa = (encabezados ?? []).map((h) => COLUMNAS[String(h ?? "").trim().toLowerCase()]);
      const registros = datos
        .map((fila) => {
          const r: Record<string, unknown> = { empresa_id: perfil.empresa_id };
          fila.forEach((valor, i) => {
            const campo = mapa[i];
            if (campo && valor != null && valor !== "") r[campo] = valor instanceof Date ? valor.toISOString().slice(11, 16) : valor;
          });
          if (r.condicion_pago) r.condicion_pago = String(r.condicion_pago).toLowerCase().startsWith("cr") ? "credito" : "contado";
          return r;
        })
        .filter((r) => r.nombre && r.direccion);
      if (registros.length === 0) {
        setMensaje("No encontré filas con Nombre y Dirección. Revisa los encabezados.");
        return;
      }
      // Con código se actualiza el cliente existente; sin código se agrega.
      const conCodigo = registros.filter((r) => r.codigo);
      const sinCodigo = registros.filter((r) => !r.codigo);
      if (conCodigo.length) revisar(await supabase.from("clientes").upsert(conCodigo, { onConflict: "empresa_id,codigo" }));
      if (sinCodigo.length) revisar(await supabase.from("clientes").insert(sinCodigo));
      setMensaje(`Importados ${registros.length} clientes.`);
      recargar();
    } catch (e) {
      setMensaje(`Error al importar: ${(e as Error).message}`);
    }
  }

  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) importar(archivo);
          e.target.value = "";
        }}
      />
      <button className="secundario" onClick={() => entrada.current?.click()}>Importar Excel</button>
      {mensaje && <span className="nota">{mensaje}</span>}
    </>
  );
}

export function Clientes() {
  const [buscando, setBuscando] = useState("");
  return (
    <>
      <Catalogo
        tabla="clientes"
        titulo="Clientes"
        orden="nombre"
        extras={(recargar) => <ImportarExcel recargar={recargar} />}
        extrasFormulario={(valores, cambiar) => (
          <p className="nota">
            <button
              type="button"
              className="secundario"
              disabled={!valores.direccion}
              onClick={async () => {
                setBuscando("Buscando…");
                const r = await geocodificar(valores.direccion!).catch(() => null);
                if (r) {
                  cambiar("lat", String(r.lat));
                  cambiar("lng", String(r.lng));
                  setBuscando("Ubicación encontrada; revísala en el mapa de la ruta.");
                } else setBuscando("No encontré la dirección; captura latitud y longitud a mano.");
              }}
            >
              Ubicar dirección
            </button>{" "}
            {buscando}
          </p>
        )}
        campos={[
          { campo: "codigo", etiqueta: "Código" },
          { campo: "nombre", etiqueta: "Nombre", requerido: true },
          { campo: "contacto", etiqueta: "Contacto" },
          { campo: "telefono", etiqueta: "Teléfono" },
          { campo: "direccion", etiqueta: "Dirección", requerido: true, enTabla: false },
          { campo: "lat", etiqueta: "Latitud", tipo: "numero", enTabla: false },
          { campo: "lng", etiqueta: "Longitud", tipo: "numero", enTabla: false },
          { campo: "horario_desde", etiqueta: "Recibe desde", tipo: "hora", enTabla: false },
          { campo: "horario_hasta", etiqueta: "Recibe hasta", tipo: "hora", enTabla: false },
          {
            campo: "condicion_pago",
            etiqueta: "Pago",
            tipo: "opciones",
            opciones: [
              { valor: "contado", etiqueta: "Contado" },
              { valor: "credito", etiqueta: "Crédito" },
            ],
          },
          { campo: "limite_credito", etiqueta: "Límite de crédito", tipo: "numero", formato: (v) => formatoMoneda(Number(v)) },
          { campo: "saldo", etiqueta: "Saldo", tipo: "numero", formato: (v) => formatoMoneda(Number(v)) },
          { campo: "notas", etiqueta: "Notas para el chofer", tipo: "area", enTabla: false },
        ]}
      />
      <p className="nota">
        Importar Excel: la primera fila debe traer encabezados como Código, Nombre, Contacto, Teléfono, Dirección,
        Latitud, Longitud, Horario desde, Horario hasta, Notas, Condición de pago y Límite de crédito. Un cliente con
        código existente se actualiza. Horario de recepción de ejemplo: {horarioRecepcion("08:00", "13:00")}.
      </p>
    </>
  );
}
