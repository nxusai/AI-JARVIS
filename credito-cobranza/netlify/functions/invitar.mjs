// Invita a un usuario nuevo al sistema (NXUS AI).
// La clave secreta de Supabase vive sólo aquí, como variable de entorno de
// Netlify (SUPABASE_SECRET_KEY). La página nunca la ve.
// Sólo un administrador activo (dueño, dirección o soporte) puede invitar.

const ROLES = ['direccion', 'regional', 'zonal', 'gerente', 'asesor', 'mesa', 'consulta']
const AMBITO = /^empresa$|^(region|zona|gerencia|oficina|ruta):[0-9]+$/
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const resp = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export default async (req) => {
  if (req.method !== 'POST') return resp(405, { error: 'Método no permitido.' })
  const url = process.env.SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY, pub = process.env.SUPABASE_ANON_KEY
  if (!url || !secret || !pub) return resp(503, { error: 'Las invitaciones aún no están activadas en el servidor.' })

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return resp(401, { error: 'Inicia sesión de nuevo.' })

  // ¿Quién invita? Se valida la sesión con Supabase.
  const me = await fetch(`${url}/auth/v1/user`, { headers: { apikey: pub, Authorization: `Bearer ${token}` } })
  if (!me.ok) return resp(401, { error: 'Tu sesión expiró. Inicia sesión de nuevo.' })
  const yo = await me.json()

  const adm = { apikey: secret, 'Content-Type': 'application/json' }
  if (!secret.startsWith('sb_')) adm.Authorization = `Bearer ${secret}` // claves JWT antiguas
  const pr = await fetch(`${url}/rest/v1/perfiles?id=eq.${encodeURIComponent(yo.id)}&select=rol,activo`, { headers: adm })
  const [perfil] = pr.ok ? await pr.json() : []
  if (!perfil?.activo || !['dueno', 'direccion', 'soporte'].includes(perfil.rol)) return resp(403, { error: 'Tu cuenta no tiene permiso para invitar usuarios.' })

  let v
  try { v = await req.json() } catch { return resp(400, { error: 'Datos inválidos.' }) }
  const nombre = String(v.nombre || '').trim().slice(0, 120), correo = String(v.correo || '').trim().toLowerCase()
  const rol = String(v.rol || ''), ambito = String(v.ambito || 'empresa')
  if (!nombre || !CORREO.test(correo)) return resp(400, { error: 'Revisa el nombre y el correo.' })
  if (!ROLES.includes(rol) || !AMBITO.test(ambito)) return resp(400, { error: 'Cargo o ámbito no válido.' })

  const origin = new URL(req.url).origin
  const inv = await fetch(`${url}/auth/v1/invite`, { method: 'POST', headers: adm, body: JSON.stringify({ email: correo, data: { nombre }, redirect_to: origin }) })
  const ij = await inv.json().catch(() => ({}))
  if (!inv.ok) {
    const m = String(ij.msg || ij.message || ij.error_description || '')
    return resp(inv.status === 422 ? 409 : 502, { error: /registered|exists/i.test(m) ? 'Ese correo ya tiene cuenta.' : 'No se pudo enviar la invitación.' })
  }
  const id = ij.id || ij.user?.id
  // El perfil lo crea la base de datos al registrarse; aquí se le pone cargo, ámbito y se activa.
  const up = await fetch(`${url}/rest/v1/perfiles?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { ...adm, Prefer: 'return=minimal' }, body: JSON.stringify({ nombre, correo, rol, ambito, activo: true }),
  })
  if (!up.ok) return resp(502, { error: 'Se envió el correo, pero no se pudo asignar el cargo. Edítalo desde Usuarios.' })
  return resp(200, { ok: true })
}
