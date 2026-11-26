// Invita a un usuario nuevo al sistema (NXUS AI): crea su cuenta y devuelve su enlace de acceso.
// La clave secreta de Supabase vive sólo aquí, como variable de entorno de
// Netlify (SUPABASE_SECRET_KEY). La página nunca la ve.
// Sólo un administrador activo (dueño, dirección o soporte) puede invitar.

const ROLES = ['direccion', 'regional', 'zonal', 'gerente', 'asesor', 'mesa', 'tesoreria', 'consulta']
// El cargo de dueño sólo lo puede dar soporte NXUS o el mismo dueño.
const ROLES_DUENO = [...ROLES, 'dueno']
const AMBITO = /^empresa$|^(region|zona|gerencia|oficina|ruta):[0-9]+(,(region|zona|gerencia|oficina|ruta):[0-9]+)*$/
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const resp = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

// Enlace nuevo para alguien que ya tiene cuenta pero NUNCA ha entrado (por ejemplo, se le venció el correo).
// A quien ya entró no se le genera: así nadie puede entrar con la cuenta de otra persona.
async function enlaceNuevo(url, adm, id, correo, origin) {
  const ur = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(id)}`, { headers: adm })
  if (!ur.ok) return { status: 404, error: 'No encontré esa cuenta.' }
  const u = await ur.json()
  if ((u.user || u).last_sign_in_at) return { status: 409, error: 'Esa persona ya entró al sistema: que use su correo y su contraseña.' }
  for (const type of ['invite', 'recovery']) {
    const r = await fetch(`${url}/auth/v1/admin/generate_link`, { method: 'POST', headers: adm, body: JSON.stringify({ type, email: correo, redirect_to: origin }) })
    const j = await r.json().catch(() => ({}))
    const enlace = j.action_link || j.properties?.action_link
    if (r.ok && enlace) return { enlace }
  }
  return { status: 502, error: 'No se pudo generar el enlace nuevo.' }
}

export default async (req) => {
  const url = process.env.SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY, pub = process.env.SUPABASE_ANON_KEY
  // Sin la clave responde 503; con la clave, una visita normal (GET) responde 405.
  if (!url || !secret || !pub) return resp(503, { error: 'Las invitaciones aún no están activadas en el servidor.' })
  if (req.method !== 'POST') return resp(405, { error: 'Método no permitido.' })

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
  const origin = new URL(req.url).origin
  if (v.accion === 'reenviar') {
    const id = String(v.id || '')
    if (!/^[0-9a-f-]{36}$/i.test(id) || id === yo.id) return resp(400, { error: 'Usuario no válido.' })
    const tr = await fetch(`${url}/rest/v1/perfiles?id=eq.${id}&select=rol,correo,activo`, { headers: adm })
    const [t] = tr.ok ? await tr.json() : []
    if (!t) return resp(404, { error: 'No encontré ese usuario.' })
    if (t.rol === 'soporte' || (t.rol === 'dueno' && !['dueno', 'soporte'].includes(perfil.rol))) return resp(403, { error: 'No puedes reenviar el acceso a esa cuenta.' })
    if (!t.activo) return resp(409, { error: 'Ese usuario está inactivo: actívalo primero en Editar.' })
    const e = await enlaceNuevo(url, adm, id, t.correo, origin)
    return e.enlace ? resp(200, { ok: true, enlace: e.enlace }) : resp(e.status, { error: e.error })
  }
  const nombre = String(v.nombre || '').trim().slice(0, 120), correo = String(v.correo || '').trim().toLowerCase()
  const rol = String(v.rol || ''), ambito = String(v.ambito || 'empresa')
  if (!nombre || !CORREO.test(correo)) return resp(400, { error: 'Revisa el nombre y el correo.' })
  const permitidos = ['dueno', 'soporte'].includes(perfil.rol) ? ROLES_DUENO : ROLES
  if (!permitidos.includes(rol) || !AMBITO.test(ambito)) return resp(400, { error: 'Cargo o ámbito no válido.' })
  if (rol === 'dueno' && ambito !== 'empresa') return resp(400, { error: 'El dueño ve toda la empresa: elige «Toda la empresa».' })

  // Se genera el enlace de invitación SIN mandar correo (el correo de Supabase sin SMTP propio
  // sólo llega al equipo del proyecto y tiene límite por hora). El dueño lo comparte por WhatsApp.
  const inv = await fetch(`${url}/auth/v1/admin/generate_link`, { method: 'POST', headers: adm, body: JSON.stringify({ type: 'invite', email: correo, data: { nombre }, redirect_to: origin }) })
  const ij = await inv.json().catch(() => ({}))
  if (!inv.ok) {
    const m = String(ij.msg || ij.message || ij.error_description || ij.error || '')
    if (!/registered|exists/i.test(m)) return resp(502, { error: 'No se pudo crear la invitación: ' + (m || 'error ' + inv.status) })
    const er = await fetch(`${url}/rest/v1/perfiles?correo=eq.${encodeURIComponent(correo)}&select=id,rol`, { headers: adm })
    const [ya] = er.ok ? await er.json() : []
    if (!ya || ya.rol === 'soporte' || (ya.rol === 'dueno' && !['dueno', 'soporte'].includes(perfil.rol)) || ya.id === yo.id) return resp(409, { error: 'Ese correo ya tiene cuenta.' })
    const e = await enlaceNuevo(url, adm, ya.id, correo, origin)
    if (!e.enlace) return resp(e.status, { error: e.error })
    await fetch(`${url}/rest/v1/perfiles?id=eq.${ya.id}`, { method: 'PATCH', headers: { ...adm, Prefer: 'return=minimal' }, body: JSON.stringify({ nombre, rol, ambito, activo: true }) })
    return resp(200, { ok: true, enlace: e.enlace, existia: true })
  }
  const enlace = ij.action_link || ij.properties?.action_link
  const id = ij.id || ij.user?.id
  // El perfil lo crea la base de datos al registrarse; aquí se le pone cargo, ámbito y se activa.
  const up = await fetch(`${url}/rest/v1/perfiles?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { ...adm, Prefer: 'return=minimal' }, body: JSON.stringify({ nombre, correo, rol, ambito, activo: true }),
  })
  if (!up.ok) return resp(502, { error: 'Se envió el correo, pero no se pudo asignar el cargo. Edítalo desde Usuarios.' })
  return resp(200, { ok: true, enlace })
}
