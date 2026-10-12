// Alta de usuarios (admin, despachador o chofer) desde el panel web.
// Solo un administrador activo puede llamarla; el usuario nuevo queda en su empresa.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES = ["admin", "despachador", "chofer"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: quien } = await admin.auth.getUser(token);
  if (!quien.user) return json({ error: "Sesión inválida" }, 401);

  const { data: perfil } = await admin
    .from("perfiles")
    .select("empresa_id, rol, activo")
    .eq("id", quien.user.id)
    .single();
  if (!perfil || !perfil.activo || perfil.rol !== "admin") {
    return json({ error: "Solo un administrador puede crear usuarios" }, 403);
  }

  const { email, password, nombre, rol, telefono } = await req.json();
  if (!email || !password || !nombre || !ROLES.includes(rol)) {
    return json({ error: "Faltan datos: email, password, nombre y rol" }, 400);
  }
  if (String(password).length < 8) {
    return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
  }

  const { data: creado, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !creado.user) return json({ error: error?.message ?? "No se pudo crear" }, 400);

  const { error: errPerfil } = await admin.from("perfiles").insert({
    id: creado.user.id,
    empresa_id: perfil.empresa_id,
    nombre,
    rol,
    telefono: telefono || null,
  });
  if (errPerfil) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return json({ error: errPerfil.message }, 400);
  }

  return json({ id: creado.user.id });
});
