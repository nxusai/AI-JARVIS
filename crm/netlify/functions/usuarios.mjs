// Crear usuarios, cambiar contraseñas, usuarios y correos: solo el admin. Es lo
// único que usa la llave de servicio de Supabase (lo demás de los usuarios
// —rol, empresas, apagar— lo cambia el admin directo, con sus candados).
//
// Cada quien entra con su usuario (por ejemplo "senen") y la contraseña que
// le ponga el admin, aunque sea corta (ver public/acceso.js). Si la persona
// tiene correo, su acceso (link, usuario y contraseña) se le manda desde la
// cuenta de Google de NXUS (google/accesos.gs). Al dueño nadie lo toca desde
// aquí: ni su contraseña ni su correo (la base de datos también lo impide).
import { json, quien, sb } from '../lib/sb.mjs'
import { CLAVE_MINIMA, DOMINIO_ENTRADA, claveReal, correoDeUsuario, normalizarUsuario, usuarioValido } from '../../public/acceso.js'

const ROLES = new Set(['cliente', 'equipo'])
const SECCIONES = ['ve_tareas', 've_biblioteca', 've_catalogos', 've_parrilla']
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const ID = /^[0-9a-f-]{36}$/i

const mal = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status })
const claveValida = (c) => String(c ?? '').trim().length >= CLAVE_MINIMA
const ERROR_CLAVE = `La contraseña necesita al menos ${CLAVE_MINIMA} caracteres`

/** El correo de verdad (opcional): '' si no hay; error si está mal escrito. */
function correoOpcional(c) {
  const correo = String(c || '').trim().toLowerCase()
  if (correo && !CORREO.test(correo)) throw mal('Ese correo no se ve bien')
  return correo
}

/** El usuario, limpio; error si no sirve o ya lo tiene otra persona. */
async function usuarioLibre(u, menos = null) {
  const usuario = normalizarUsuario(u)
  if (!usuarioValido(usuario)) throw mal('El usuario necesita al menos 2 letras o números (sin espacios ni acentos)')
  const [otro] = await sb(`/rest/v1/perfiles?usuario=eq.${encodeURIComponent(usuario)}&select=id`, { servicio: true })
  if (otro && otro.id !== menos) throw mal(`Ya hay alguien con el usuario "${usuario}". Elige otro.`, 409)
  return usuario
}

/** Le manda a la persona su acceso. Nunca truena: dice si salió o por qué no. */
async function mandarAcceso({ para, nombre, usuario, contrasena, motivo, enlace }) {
  if (!para) return { enviado: false }
  if (!process.env.ACCESO_URL || !process.env.ACCESO_CLAVE) return { enviado: false, aviso: 'El correo de acceso todavía no está conectado (ACCESO_URL en Netlify). Mándale sus datos por WhatsApp.' }
  try {
    const res = await fetch(process.env.ACCESO_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clave: process.env.ACCESO_CLAVE, para, nombre, usuario, contrasena, motivo, enlace }),
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
  if (!ID.test(String(id || ''))) throw mal('Falta el usuario')
  if (id === yo.perfil.id) throw mal('Lo tuyo cámbialo en "🔑 Contraseña"')
  const [p] = await sb(`/rest/v1/perfiles?id=eq.${id}&select=id,nombre,correo,usuario,dueno,eliminado`, { servicio: true })
  if (!p || p.eliminado) throw mal('Ese usuario ya no existe', 404)
  if (p.dueno) throw mal('El acceso del administrador principal solo lo cambia él', 403)
  return p
}

async function ponerClave(id, clave) {
  await sb(`/auth/v1/admin/users/${id}`, { servicio: true, method: 'PUT', body: { password: claveReal(clave) } })
  await sb(`/rest/v1/perfiles?id=eq.${id}`, { servicio: true, method: 'PATCH', body: { clave_temporal: true } })
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo el administrador' }, 403)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const d = await req.json().catch(() => ({}))
  const enlace = (process.env.CRM_URL || process.env.URL || new URL(req.url).origin).replace(/\/$/, '')
  const mandar = d.mandar !== false
  const clave = String(d.clave ?? '').trim()

  try {
    if (d.accion === 'crear') {
      const nombre = String(d.nombre || '').trim().slice(0, 80)
      if (!nombre) throw mal('Falta el nombre')
      const usuario = await usuarioLibre(d.usuario || nombre)
      const correo = correoOpcional(d.correo)
      if (!claveValida(clave)) throw mal(ERROR_CLAVE)
      if (!ROLES.has(d.rol)) throw mal('Rol inválido')
      const empresas = d.empresas === null ? null : Array.isArray(d.empresas) ? d.empresas.map(String).slice(0, 20) : null
      let user
      try {
        user = await sb('/auth/v1/admin/users', {
          servicio: true,
          method: 'POST',
          body: { email: correoDeUsuario(usuario), password: claveReal(clave), email_confirm: true, user_metadata: { nombre } },
        })
      } catch (err) {
        if (/already|registered|exists/i.test(err.message)) throw mal(`Ya hay alguien con el usuario "${usuario}". Elige otro.`, 409)
        throw err
      }
      const perfil = { nombre, usuario, correo, rol: d.rol, activo: true, empresas, clave_temporal: true }
      for (const s of SECCIONES) perfil[s] = d[s] !== false
      perfil.pide_extras = perfil.ve_parrilla && d.pide_extras === true
      perfil.ve_leads = d.ve_leads === true
      perfil.ultron = d.rol === 'cliente' && d.ultron === true
      try {
        await sb(`/rest/v1/perfiles?id=eq.${user.id}`, { servicio: true, method: 'PATCH', body: perfil })
      } catch (err) {
        // Que no quede una cuenta a medias (sin perfil acomodado no podría entrar).
        await sb(`/auth/v1/admin/users/${user.id}`, { servicio: true, method: 'DELETE' }).catch(() => {})
        throw mal(/usuario|clave_temporal|column/i.test(err.message) ? 'Falta actualizar la base de datos: corre el esquema en Supabase (SQL Editor) y vuelve a intentar.' : err.message, err.status || 500)
      }
      const correoAcceso = mandar ? await mandarAcceso({ para: correo, nombre, usuario, contrasena: clave, motivo: 'nuevo', enlace }) : { enviado: false }
      return json({ ok: true, id: user.id, usuario, clave, para: correo, ...correoAcceso })
    }

    if (d.accion === 'clave') {
      const p = await persona(d.id, yo)
      if (!claveValida(clave)) throw mal(ERROR_CLAVE)
      if (!p.usuario) throw mal('Primero ponle un usuario en Editar')
      await ponerClave(p.id, clave)
      const correoAcceso = mandar ? await mandarAcceso({ para: p.correo, nombre: p.nombre, usuario: p.usuario, contrasena: clave, motivo: 'clave', enlace }) : { enviado: false }
      return json({ ok: true, usuario: p.usuario, clave, para: p.correo, ...correoAcceso })
    }

    // Cambiar con qué entra (usuario) y/o su correo. Con clave, también una
    // contraseña nueva (y si tiene correo y se pide, se le manda el acceso).
    if (d.accion === 'acceso') {
      const p = await persona(d.id, yo)
      const usuario = await usuarioLibre(d.usuario, p.id)
      const correo = correoOpcional(d.correo)
      if (clave && !claveValida(clave)) throw mal(ERROR_CLAVE)
      if (!p.usuario && !clave) throw mal('Para darle su usuario ponle también una contraseña')
      if (usuario !== p.usuario) {
        try {
          await sb(`/auth/v1/admin/users/${p.id}`, { servicio: true, method: 'PUT', body: { email: correoDeUsuario(usuario), email_confirm: true } })
        } catch (err) {
          if (/already|registered|exists/i.test(err.message)) throw mal(`Ya hay alguien con el usuario "${usuario}". Elige otro.`, 409)
          throw err
        }
      }
      if (usuario !== p.usuario || correo !== p.correo) await sb(`/rest/v1/perfiles?id=eq.${p.id}`, { servicio: true, method: 'PATCH', body: { usuario, correo } })
      if (!clave) return json({ ok: true, usuario, para: correo, enviado: false })
      await ponerClave(p.id, clave)
      const correoAcceso = mandar ? await mandarAcceso({ para: correo, nombre: p.nombre, usuario, contrasena: clave, motivo: correo !== p.correo ? 'correo' : 'clave', enlace }) : { enviado: false }
      return json({ ok: true, usuario, clave, para: correo, ...correoAcceso })
    }

    // Eliminar: solo el dueño. Sin historial se borra de verdad (y su usuario
    // queda libre). Si ya pidió o subió algo, la base de datos no deja borrarlo
    // (se perderían sus tareas): se le cierra la cuenta para siempre y se
    // esconde, y sus tareas y archivos siguen diciendo de quién son.
    if (d.accion === 'eliminar') {
      if (!yo.perfil.dueno) throw mal('Solo el administrador principal elimina usuarios', 403)
      const p = await persona(d.id, yo)
      try {
        await sb(`/auth/v1/admin/users/${p.id}`, { servicio: true, method: 'DELETE' })
        return json({ ok: true, borrado: true })
      } catch (err) {
        if (err.status && err.status < 500 && !/database|foreign|violates/i.test(err.message)) throw err
      }
      await sb(`/rest/v1/perfiles?id=eq.${p.id}`, { servicio: true, method: 'PATCH', body: { activo: false, eliminado: true, usuario: null, correo: '', clave_temporal: false } })
      const azar = `${crypto.randomUUID()}${crypto.randomUUID()}`
      await sb(`/auth/v1/admin/users/${p.id}`, { servicio: true, method: 'PUT', body: { email: `baja.${p.id}@${DOMINIO_ENTRADA}`, email_confirm: true, password: azar } })
      await sb(`/auth/v1/admin/users/${p.id}`, { servicio: true, method: 'PUT', body: { ban_duration: '876000h' } }).catch(() => {})
      return json({ ok: true, borrado: false })
    }

    return json({ ok: false, error: 'Acción desconocida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
