// La invitación pública de la fiesta (/fiesta) confirma asistencia aquí.
// No pide sesión: cualquiera con el enlace puede confirmar, así que todo se
// revisa en este lado y se guarda con la llave de servicio. Si alguien confirma
// dos veces con el mismo teléfono, se actualiza su registro (no se duplica).
import { json, sb } from '../lib/sb.mjs'

export const EMPRESAS = ['MI SEMAGO', 'ABUELITO CORN', 'ABUELITO MEAT', 'ABUELITO CHEESE']
// Se puede confirmar hasta el 16 de noviembre de 2026, todo el día (hora de Nueva Jersey).
export const LIMITE = Date.parse('2026-11-17T05:00:00Z')

export const limpiarNombre = (v) => String(v || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80)
export function limpiarTelefono(v) {
  let d = String(v || '').replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1) // +1 de EE. UU.
  return d
}

export default async (req) => {
  const abierto = Date.now() < LIMITE
  if (req.method === 'GET') return json({ ok: true, abierto, empresas: EMPRESAS })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  if (!abierto) return json({ ok: false, error: 'La confirmación cerró el 16 de noviembre.' }, 410)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const d = await req.json().catch(() => ({}))
  if (d.sitio) return json({ ok: true }) // trampa para robots: un humano nunca llena ese campo
  const nombre = limpiarNombre(d.nombre)
  const telefono = limpiarTelefono(d.telefono)
  const empresa = String(d.empresa || '').toUpperCase()
  if (nombre.length < 2) return json({ ok: false, error: 'Escribe tu nombre completo' }, 400)
  if (telefono.length < 10 || telefono.length > 15) return json({ ok: false, error: 'Escribe tu número a 10 dígitos' }, 400)
  if (!EMPRESAS.includes(empresa)) return json({ ok: false, error: 'Elige la empresa donde trabajas' }, 400)
  try {
    await sb('/rest/v1/fiesta_asistentes?on_conflict=telefono', {
      servicio: true,
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: { nombre, telefono, empresa, actualizada: new Date().toISOString() },
    })
    return json({ ok: true })
  } catch (err) {
    return json({ ok: false, error: 'No pudimos guardar tu confirmación. Intenta otra vez en un momento.' }, 500)
  }
}
