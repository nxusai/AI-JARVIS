// Dar de alta a alguien del equipo y cambiar contraseñas: solo el admin. Es lo
// único que usa la llave de servicio de Supabase (lo demás de las personas
// —cargo, sede, foto, apagar— lo cambia el admin directo, con sus candados).
import { json, quien, sb } from '../lib/sb.mjs'

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
      const cargo = String(d.cargo || '').trim().slice(0, 80)
      const sede = d.sede === 'mexico' ? 'mexico' : 'usa'
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return json({ ok: false, error: 'Ese correo no se ve bien' }, 400)
      if (String(d.clave || '').length < 8) return json({ ok: false, error: 'La contraseña necesita al menos 8 caracteres' }, 400)
      if (!nombre) return json({ ok: false, error: 'Falta el nombre' }, 400)
      let user
      try {
        user = await sb('/auth/v1/admin/users', {
          servicio: true,
          method: 'POST',
          body: { email: correo, password: d.clave, email_confirm: true, user_metadata: { nombre, cargo, sede, activo: true } },
        })
      } catch (err) {
        if (/already|registered|exists/i.test(err.message)) return json({ ok: false, error: 'Ya hay un usuario con ese correo' }, 409)
        throw err
      }
      const reporta = /^[0-9a-f-]{36}$/i.test(String(d.reporta_a || '')) ? d.reporta_a : null
      await sb(`/rest/v1/perfiles?id=eq.${user.id}`, { servicio: true, method: 'PATCH', body: { nombre, correo, cargo, sede, activo: true, rol: 'equipo', reporta_a: reporta } })
      return json({ ok: true, id: user.id })
    }
    if (d.accion === 'clave') {
      if (!/^[0-9a-f-]{36}$/i.test(String(d.id || ''))) return json({ ok: false, error: 'Falta la persona' }, 400)
      if (String(d.clave || '').length < 8) return json({ ok: false, error: 'La contraseña necesita al menos 8 caracteres' }, 400)
      if (d.id === yo.perfil.id) return json({ ok: false, error: 'Tu propia contraseña cámbiala con "¿Olvidaste tu contraseña?" o desde Supabase' }, 400)
      await sb(`/auth/v1/admin/users/${d.id}`, { servicio: true, method: 'PUT', body: { password: d.clave } })
      return json({ ok: true })
    }
    return json({ ok: false, error: 'Acción desconocida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
