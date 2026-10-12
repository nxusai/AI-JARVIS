import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { supabase } from "../supabase";
import { useSesion } from "../sesion";

export function Login() {
  const { sesion } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (sesion) return <Navigate to="/" replace />;

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError("Correo o contraseña incorrectos");
    setEnviando(false);
  }

  return (
    <form className="login" onSubmit={entrar}>
      <h1>Abuelito Go</h1>
      <p>Panel de rutas y entregas</p>
      <label>
        Correo
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </label>
      <label>
        Contraseña
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
