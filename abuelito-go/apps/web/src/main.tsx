import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./estilos.css";
import { App } from "./App";
import { ProveedorSesion } from "./sesion";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProveedorSesion>
      <App />
    </ProveedorSesion>
  </StrictMode>,
);
