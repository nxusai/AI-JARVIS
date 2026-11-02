// Crear usuarios, cambiar contraseñas y corregir correos: solo el admin. Es lo
// único que usa la llave de servicio de Supabase (lo demás de los usuarios
// —rol, empresas, apagar— lo cambia el admin directo, con sus candados).
//
// El acceso (link, correo y contraseña) se le manda a la persona desde la
// cuenta de Google de NXUS (google/accesos.gs). Al dueño nadie lo toca desde
// aquí: ni su contraseña ni su correo (la base de datos también lo impide).
import { json, quien, sb } from '../lib/sb.mjs'

const ROLES = new Set(['cliente', 'equipo'])
const SECCIONES = ['ve_tareas', 've_biblioteca', 've_catalogos']
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const ID = /^[0-9a-f-]{36}$/i

/** Le manda a la persona su acceso. Nunca truena: dice si salió o por qué no. */
async function mandarAcceso({ para, nombre, contrasena, motivo, enlace }) {
  if (!process.env.ACCESO_URL || !process.env.ACCESO_CLAVE) return { enviado: false, aviso: 'El correo de acceso todavía no está conectado (ACCESO_URL en Netlify). Mándale sus datos por WhatsApp.' }
  try {
    const res = await fetch(process.env.ACCESO_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clave: process.env.ACCESO_CLAVE, para, nombre, usuario: para, contrasena, motivo, enlace }),
      redirect: 'follow',
    })
    const r = await res.json().catch(() => ({}))
    if (r.ok) return { enviado: true }
    return { enviado: false, aviso: `El correo no salió (${r.error || `respondió ${res.status}`}). Mándale sus datos por WhatsApp.` }
  } catch (err) {
    return { enviado: false, aviso: `El correo no salió (${err.message}). Mándale sus datos por WhatsApp.` }
  }
}

/** La persona a la que se le va a cambiar algo; nunca el dueño ni uno mismo. */
async function persona(id, yo) {
  if (!ID.test(String(id || ''))) throw Object.assign(new Error('Falta el usuario'), { status: 400 })
  if (id === yo.perfil.id) throw Object.assign(new Error('Lo tuyo cámbialo en "Mi contraseña"'), { status: 400 })
  const [p] = await sb(`/rest/v1/perfiles?id=eq.${id}&select=id,nombre,correo,dueno`, { servicio: true })
  if (!p) throw Object.assign(new Error('Ese usuario ya no existe'), { status: 404 })
  if (p.dueno) throw Object.assign(new Error('El acceso del dueño solo lo cambia él'), { status: 403 })
  return p
}

const claveValida = (c) => String(c || '').length >= 8

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo el administrador' }, 403)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const d = await req.json().catch(() => ({}))
  const enlace = (process.env.CRM_URL || process.env.URL || new URL(req.url).origin).replace(/\/$/, '')
  const mandar = d.mandar !== false

  try {
    if (d.accion === 'crear') {
      const correo = String(d.correo || '').trim().toLowerCase()
      const nombre = String(d.nombre || '').trim().slice(0, 80)
      if (!CORREO.test(correo)) return json({ ok: false, error: 'Ese correo no se ve bien' }, 400)
      if (!claveValida(d.clave)) return json({ ok: false, error: 'La contraseña necesita al menos 8 caracteres' }, 400)
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
      const perfil = { nombre, correo, rol: d.rol, activo: true, empresas, clave_temporal: true }
      for (const s of SECCIONES) perfil[s] = d[s] !== false
      perfil.ultron = d.rol === 'cliente' && d.ultron === true
      await sb(`/rest/v1/perfiles?id=eq.${user.id}`, { servicio: true, method: 'PATCH', body: perfil })
      const correoAcceso = mandar ? await mandarAcceso({ para: correo, nombre, contrasena: d.clave, motivo: 'nuevo', enlace }) : { enviado: false }
      return json({ ok: true, id: user.id, para: correo, ...correoAcceso })
    }

    if (d.accion === 'clave') {
      const p = await persona(d.id, yo)
      if (!claveValida(d.clave)) return json({ ok: false, error: 'La contraseña necesita al menos 8 caracteres' }, 400)
      await sb(`/auth/v1/admin/users/${p.id}`, { servicio: true, method: 'PUT', body: { password: d.clave } })
      await sb(`/rest/v1/perfiles?id=eq.${p.id}`, { servicio: true, method: 'PATCH', body: { clave_temporal: true } })
      const correoAcceso = mandar ? await mandarAcceso({ para: p.correo, nombre: p.nombre, contrasena: d.clave, motivo: 'clave', enlace }) : { enviado: false }
      return json({ ok: true, para: p.correo, ...correoAcceso })
    }

    // Corregir el correo (por si se escribió mal). Se cambia en los dos lados:
    // con el que entra y el del perfil. Si se manda el acceso, va con una
    // contraseña nueva (la de antes nadie la conoce).
    if (d.accion === 'correo') {
      const p = await persona(d.id, yo)
      const correo = String(d.correo || '').trim().toLowerCase()
      if (!CORREO.test(correo)) return json({ ok: false, error: 'Ese correo no se ve bien' }, 400)
      if (mandar && !claveValida(d.clave)) return json({ ok: false, error: 'La contraseña necesita al menos 8 caracteres' }, 400)
      if (correo !== p.correo) {
        try {
          await sb(`/auth/v1/admin/users/${p.id}`, { servicio: true, method: 'PUT', body: { email: correo, email_confirm: true } })
        } catch (err) {
          if (/already|registered|exists/i.test(err.message)) return json({ ok: false, error: 'Ya hay un usuario con ese correo' }, 409)
          throw err
        }
        await sb(`/rest/v1/perfiles?id=eq.${p.id}`, { servicio: true, method: 'PATCH', body: { correo } })
      }
      if (!mandar) return json({ ok: true, para: correo, enviado: false })
      await sb(`/auth/v1/admin/users/${p.id}`, { servicio: true, method: 'PUT', body: { password: d.clave } })
      await sb(`/rest/v1/perfiles?id=eq.${p.id}`, { servicio: true, method: 'PATCH', body: { clave_temporal: true } })
      return json({ ok: true, para: correo, ...(await mandarAcceso({ para: correo, nombre: p.nombre, contrasena: d.clave, motivo: 'correo', enlace })) })
    }

    return json({ ok: false, error: 'Acción desconocida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
