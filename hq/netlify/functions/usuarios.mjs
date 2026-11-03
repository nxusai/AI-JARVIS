// Dar de alta a alguien del equipo y cambiar contraseñas: solo el admin. Es lo
// único que usa la llave de servicio de Supabase (lo demás de las personas
// —cargo, sede, foto, apagar— lo cambia el admin directo, con sus candados).
//
// Cada quien entra con su USUARIO y la contraseña que le puso Eduardo (sin
// reglas: ni mínimo ni máximo). Por dentro, la
// cuenta de Supabase es <usuario>@equipo.nxusai.org (y su contraseña lleva un final fijo: ver
// envolver); el correo real es para
// mandarle su acceso (lo manda la cuenta de Google de NXUS: AGENDA_URL).
import { json, quien, sb } from '../lib/sb.mjs'

export const DOMINIO = 'equipo.nxusai.org'
const env = (k) => (process.env[k] || '').trim()
const HQ = () => (process.env.URL || 'https://nxus-hq.netlify.app').replace(/\/$/, '')

/** "Juan Pérez" → "juan.perez": minúsculas, sin acentos ni espacios. */
export const limpiarUsuario = (u) =>
  String(u ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 40)

/**
 * Supabase exige mínimo 6 caracteres y no deja bajarlo. Para que Eduardo ponga la contraseña que
 * quiera (aunque sea de 1), lo que se guarda en Supabase es la contraseña + este final fijo; HQ se
 * lo agrega solo al entrar y al cambiarla (public/datos-supabase.js hace lo mismo).
 */
export const FINAL = '#nxus-hq'
export const envolver = (clave) => `${clave}${FINAL}`

/** Los errores de Supabase sobre contraseñas, en palabras. */
const claro = (err) =>
  /at least 6|least 6 characters|weak password|password should/i.test(err.message)
    ? Object.assign(new Error('Supabase pide que la contraseña tenga al menos 6 caracteres (es su mínimo; HQ no pone más reglas).'), { status: 400 })
    : err

/** Le manda a su correo su usuario, su contraseña y el link de HQ. { enviado, motivo } */
async function mandarAcceso({ correo, nombre, usuario, clave, nueva = true }) {
  if (!correo) return { enviado: false, motivo: 'No tiene correo guardado: agrégaselo en Editar.' }
  if (!env('AGENDA_URL')) return { enviado: false, motivo: 'Falta AGENDA_URL en Netlify (la agenda de Google).' }
  try {
    const res = await fetch(env('AGENDA_URL'), {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion: 'bienvenida', clave: env('AGENDA_CLAVE'), para: correo, nombre, usuario, contrasena: clave, url: HQ(), nueva }),
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })
    const d = await res.json().catch(() => null)
    if (d?.ok) return { enviado: true }
    const e = String(d?.error || `la agenda respondió ${res.status}`)
    return {
      enviado: false,
      motivo: /desconocida/i.test(e)
        ? `La agenda de Google que usa HQ todavía corre la versión vieja. HQ le habla a la implementación cuyo ID termina en "${(/\/s\/([^/]+)\/exec/.exec(env('AGENDA_URL'))?.[1] ?? '?').slice(-8)}": en Apps Script → Implementar → Administrar implementaciones, edita (lápiz) ESA, elige "New version" y Deploy.`
        : /clave/i.test(e)
          ? 'La clave de la agenda no coincide con AGENDA_CLAVE de Netlify.'
          : `La agenda de Google dijo: ${e}`,
    }
  } catch (err) {
    return { enviado: false, motivo: `No se pudo hablar con la agenda de Google (${err.message}).` }
  }
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo el administrador' }, 403)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const d = await req.json().catch(() => ({}))

  try {
    if (d.accion === 'crear') {
      const usuario = limpiarUsuario(d.usuario)
      const correo = String(d.correo || '').trim().toLowerCase()
      const nombre = String(d.nombre || '').trim().slice(0, 80)
      const cargo = String(d.cargo || '').trim().slice(0, 80)
      const sede = d.sede === 'mexico' ? 'mexico' : 'usa'
      const clave = String(d.clave ?? '')
      if (!nombre) return json({ ok: false, error: 'Falta el nombre' }, 400)
      if (usuario.length < 2) return json({ ok: false, error: 'Falta el usuario (letras, números o puntos)' }, 400)
      if (!clave) return json({ ok: false, error: 'Falta la contraseña' }, 400)
      if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return json({ ok: false, error: 'Ese correo no se ve bien' }, 400)
      const [hay] = await sb(`/rest/v1/perfiles?usuario=ilike.${encodeURIComponent(usuario)}&select=id`, { servicio: true })
      if (hay) return json({ ok: false, error: `Ya hay alguien con el usuario "${usuario}"` }, 409)
      let user
      try {
        user = await sb('/auth/v1/admin/users', {
          servicio: true,
          method: 'POST',
          body: { email: `${usuario}@${DOMINIO}`, password: envolver(clave), email_confirm: true, user_metadata: { nombre, cargo, sede, activo: true } },
        })
      } catch (err) {
        if (/already|registered|exists/i.test(err.message)) return json({ ok: false, error: `Ya hay alguien con el usuario "${usuario}"` }, 409)
        throw claro(err)
      }
      const reporta = /^[0-9a-f-]{36}$/i.test(String(d.reporta_a || '')) ? d.reporta_a : null
      await sb(`/rest/v1/perfiles?id=eq.${user.id}`, { servicio: true, method: 'PATCH', body: { nombre, correo, usuario, cargo, sede, activo: true, rol: 'equipo', reporta_a: reporta, cambiar_clave: true } })
      const correoR = d.enviar !== false ? await mandarAcceso({ correo, nombre, usuario, clave }) : { enviado: false }
      return json({ ok: true, id: user.id, usuario, ...correoR })
    }
    if (d.accion === 'clave') {
      if (!/^[0-9a-f-]{36}$/i.test(String(d.id || ''))) return json({ ok: false, error: 'Falta la persona' }, 400)
      const clave = String(d.clave ?? '')
      if (!clave) return json({ ok: false, error: 'Falta la contraseña' }, 400)
      if (d.id === yo.perfil.id) return json({ ok: false, error: 'Tu propia contraseña cámbiala en "Mi cuenta"' }, 400)
      await sb(`/auth/v1/admin/users/${d.id}`, { servicio: true, method: 'PUT', body: { password: envolver(clave) } }).catch((err) => {
        throw claro(err)
      })
      const [p] = await sb(`/rest/v1/perfiles?id=eq.${d.id}&select=nombre,correo,usuario`, { servicio: true })
      await sb(`/rest/v1/perfiles?id=eq.${d.id}`, { servicio: true, method: 'PATCH', prefer: 'return=minimal', body: { cambiar_clave: true } })
      const correoR = d.enviar && p ? await mandarAcceso({ correo: p.correo, nombre: p.nombre, usuario: p.usuario || p.correo, clave, nueva: false }) : { enviado: false }
      return json({ ok: true, usuario: p?.usuario || p?.correo, ...correoR })
    }
    if (d.accion === 'probar') {
      // 🔧 Probar correo: qué clave y qué agenda usa HQ AHORA (sin revelar la clave) y un correo de prueba al admin.
      const k = env('AGENDA_CLAVE')
      const id = /\/s\/([^/]+)\/exec/.exec(env('AGENDA_URL'))?.[1] ?? ''
      const r = await mandarAcceso({ correo: yo.perfil.correo, nombre: yo.perfil.nombre, usuario: 'prueba', clave: '123' })
      return json({
        ok: true,
        ...r,
        clave: k ? `${k.slice(0, 4)}…${k.slice(-4)} (${k.length} caracteres)` : '(vacía)',
        agenda: id ? `…${id.slice(-8)}` : '(sin AGENDA_URL)',
        para: yo.perfil.correo,
      })
    }
    return json({ ok: false, error: 'Acción desconocida' }, 400)
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
