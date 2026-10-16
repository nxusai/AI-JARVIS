// Crear usuarios y cambiar contraseñas: solo el admin. Es lo único que usa la
// llave de servicio de Supabase (lo demás de los usuarios —rol, empresas,
// apagar— lo cambia el admin directo, con sus candados).
import { json, quien, sb } from '../lib/sb.mjs'

const ROLES = new Set(['cliente', 'equipo'])
const SECCIONES = ['ve_tareas', 've_biblioteca', 've_catalogos']

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo el administrador' }, 403)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const d = await req.json().catch(() => ({}))

  try {
    if (d.accion === 'crear') {
      const correo = String(d.correo || '').trim().toLowerCase()
      const nombre = String(d.nombre || '').trim().slice(0, 80)
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return json({ ok: false, error: 'Ese correo no se ve bien' }, 400)
      if (String(d.clave || '').length < 8) return json({ ok: false, error: 'La contraseña necesita al menos 8 caracteres' }, 400)
      if (!nombre) return json({ ok: false, error: 'Falta el nombre' }, 400)
      if (!ROLES.has(d.rol)) return json({ ok: false, error: 'Rol inválido' }, 400)
      const empresas = d.empresas === null ? null : Array.isArray(d.empresas) ? d.empresas.map(String).slice(0, 20) : null
      let user
      try {
        user = await sb('/auth/v1/admin/users', {
          servicio: true,
          method: 'POST',
          body: { email: correo, password: d.clave, email_confirm: true, user_metadata: { nombre } },
        })
      } catch (err) {
        if (/already|registered|exists/i.test(err.message)) return json({ ok: false, error: 'Ya hay un usuario con ese correo' }, 409)
        throw err
      }
      const perfil = { nombre, correo, rol: d.rol, activo: true, empresas }
      for (const s of SECCIONES) perfil[s] = d[s] !== false
      await sb(`/rest/v1/perfiles?id=eq.${user.id}`, { servicio: true, method: 'PATCH', body: perfil })
      return json({ ok: true, id: user.id })
    }
    if (d.accion === 'clave') {
      if (!/^[0-9a-f-]{36}$/i.test(String(d.id || ''))) return json({ ok: false, error: 'Falta el usuario' }, 400)
      if (String(d.clave || '').length < 8) return json({ ok: false, error: 'La contraseña necesita al menos 8 caracteres' }, 400)
      if (d.id === yo.perfil.id) return json({ ok: false, error: 'Tu propia contraseña cámbiala desde Supabase' }, 400)
      await sb(`/auth/v1/admin/users/${d.id}`, { servicio: true, method: 'PUT', body: { password: d.clave } })
      return json({ ok: true })
    }
    return json({ ok: false, error: 'Acción desconocida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
