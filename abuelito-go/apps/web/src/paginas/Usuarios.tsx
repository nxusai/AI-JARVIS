import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Perfil, Rol } from "@abuelito/shared";
import { supabase, revisar } from "../supabase";
import { useSesion } from "../sesion";

const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: "chofer", etiqueta: "Chofer" },
  { valor: "despachador", etiqueta: "Despachador" },
  { valor: "admin", etiqueta: "Administrador" },
];

const VACIO = { nombre: "", email: "", password: "", telefono: "", rol: "chofer" as Rol };

export function Usuarios() {
  const { perfil } = useSesion();
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [nuevo, setNuevo] = useState<typeof VACIO | null>(null);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    setUsuarios(revisar(await supabase.from("perfiles").select("*").order("nombre")) as Perfil[]);
  }, []);

  useEffect(() => {
    recargar().catch((e) => setError(e.message));
  }, [recargar]);

  if (perfil?.rol !== "admin") return <p>Solo un administrador puede administrar usuarios.</p>;

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError("");
    const { data, error } = await supabase.functions.invoke("crear-usuario", { body: nuevo ?? undefined });
    if (error || data?.error) {
      setError(data?.error ?? error?.message ?? "No se pudo crear el usuario");
      return;
    }
    setNuevo(null);
    await recargar();
  }

  async function actualizar(u: Perfil, cambios: Partial<Perfil>) {
    if (u.id === perfil?.id && (cambios.activo === false || (cambios.rol && cambios.rol !== "admin"))) {
      setError("No puedes quitarte el acceso de administrador a ti mismo.");
      return;
    }
    try {
      revisar(await supabase.from("perfiles").update(cambios).eq("id", u.id));
      await recargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section>
      <header className="encabezado">
        <h1>Usuarios</h1>
        <button onClick={() => setNuevo({ ...VACIO })}>Agregar usuario</button>
      </header>
      {error && <p className="error">{error}</p>}
      {nuevo && (
        <form className="tarjeta formulario" onSubmit={crear}>
          <h2>Nuevo usuario</h2>
          <div className="rejilla">
            <label>Nombre<input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required /></label>
            <label>Correo<input type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} required /></label>
            <label>Contraseña inicial<input type="text" minLength={8} value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} required /></label>
            <label>Teléfono<input value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} /></label>
            <label>
              Rol
              <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })}>
                {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
              </select>
            </label>
          </div>
          <div className="acciones">
            <button type="button" className="secundario" onClick={() => setNuevo(null)}>Cancelar</button>
            <button>Crear</button>
          </div>
        </form>
      )}
      <table>
        <thead><tr><th>Nombre</th><th>Teléfono</th><th>Rol</th><th>Estado</th><th /></tr></thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className={u.activo ? undefined : "inactivo"}>
              <td>{u.nombre}</td>
              <td>{u.telefono}</td>
              <td>
                <select value={u.rol} onChange={(e) => actualizar(u, { rol: e.target.value as Rol })}>
                  {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
                </select>
              </td>
              <td>{u.activo ? "Activo" : "Dado de baja"}</td>
              <td className="derecha">
                <button className="enlace" onClick={() => actualizar(u, { activo: !u.activo })}>
                  {u.activo ? "Dar de baja" : "Reactivar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
