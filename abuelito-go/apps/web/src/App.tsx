import { createBrowserRouter, Navigate, NavLink, Outlet, RouterProvider } from "react-router";
import { useSesion } from "./sesion";
import { supabase } from "./supabase";
import { Login } from "./paginas/Login";
import { Tablero } from "./paginas/Tablero";
import { Clientes } from "./paginas/Clientes";
import { Productos } from "./paginas/Productos";
import { Camionetas } from "./paginas/Camionetas";
import { Usuarios } from "./paginas/Usuarios";
import { Ordenes } from "./paginas/Ordenes";
import { Rutas } from "./paginas/Rutas";
import { RutaDetalle } from "./paginas/RutaDetalle";
import { MapaEnVivo } from "./paginas/MapaEnVivo";

function Marco() {
  const { cargando, sesion, perfil, empresa } = useSesion();
  if (cargando) return <p className="centro">Cargando…</p>;
  if (!sesion) return <Navigate to="/entrar" replace />;
  if (!perfil || !perfil.activo || perfil.rol === "chofer") {
    return (
      <div className="centro">
        <p>Esta cuenta no tiene acceso al panel. Los choferes usan la app del iPhone.</p>
        <button onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>
    );
  }
  const esAdmin = perfil.rol === "admin";
  return (
    <div className="marco">
      <nav className="menu">
        <div className="marca">
          Abuelito Go<small>{empresa?.nombre}</small>
        </div>
        <NavLink to="/" end>Tablero</NavLink>
        <NavLink to="/rutas">Rutas</NavLink>
        <NavLink to="/ordenes">Órdenes</NavLink>
        <NavLink to="/mapa">Mapa en vivo</NavLink>
        <NavLink to="/clientes">Clientes</NavLink>
        <NavLink to="/productos">Productos</NavLink>
        <NavLink to="/camionetas">Camionetas</NavLink>
        {esAdmin && <NavLink to="/usuarios">Usuarios</NavLink>}
        <div className="usuario">
          {perfil.nombre}
          <small>{perfil.rol}</small>
          <button className="secundario" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </nav>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/entrar", element: <Login /> },
  {
    element: <Marco />,
    children: [
      { path: "/", element: <Tablero /> },
      { path: "/rutas", element: <Rutas /> },
      { path: "/rutas/:id", element: <RutaDetalle /> },
      { path: "/ordenes", element: <Ordenes /> },
      { path: "/mapa", element: <MapaEnVivo /> },
      { path: "/clientes", element: <Clientes /> },
      { path: "/productos", element: <Productos /> },
      { path: "/camionetas", element: <Camionetas /> },
      { path: "/usuarios", element: <Usuarios /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
