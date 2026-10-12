// Crea el primer administrador (después, los usuarios se crean desde el panel).
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run crear-admin -- correo@empresa.com "Contraseña123" "Nombre"
// La llave service_role da acceso total: úsala solo en tu computadora, nunca en las apps.
import { createClient } from "@supabase/supabase-js";

const [email, password, nombre = "Administrador"] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !llave || !email || !password) {
  console.error('Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run crear-admin -- correo "contraseña" "Nombre"');
  process.exit(1);
}

const supabase = createClient(url, llave, { auth: { persistSession: false } });

let { data: empresa } = await supabase.from("empresas").select("id, nombre").order("creado_en").limit(1).maybeSingle();
if (!empresa) {
  const r = await supabase.from("empresas").insert({ nombre: "El abuelito INC" }).select("id, nombre").single();
  if (r.error) throw r.error;
  empresa = r.data;
}

const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error("No se pudo crear el usuario:", error.message);
  process.exit(1);
}

const perfil = await supabase.from("perfiles").insert({ id: data.user.id, empresa_id: empresa.id, nombre, rol: "admin" });
if (perfil.error) {
  await supabase.auth.admin.deleteUser(data.user.id);
  console.error("No se pudo crear el perfil:", perfil.error.message);
  process.exit(1);
}

console.log(`Administrador ${email} creado en "${empresa.nombre}".`);
