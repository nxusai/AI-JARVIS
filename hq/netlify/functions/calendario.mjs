// El calendario de Eduardo en HQ (solo el admin): lee y escribe en el Google Calendar de la
// cuenta de NXUS a través del mismo programa de Google de la agenda (portal/google/agenda.gs,
// AGENDA_URL y AGENDA_CLAVE en este Netlify).
//   { accion: 'listar', desde, hasta }                  sus eventos (ISO)
//   { accion: 'crear', titulo, fecha, todo_el_dia, hora_inicio, hora_fin, repetir, descripcion, tipo, aviso_min }
//   { accion: 'editar', id, ...lo mismo }
//   { accion: 'borrar', id }
import { json, quien } from '../lib/sb.mjs'

const env = (k) => (process.env[k] || '').trim()

async function agenda(body) {
  if (!env('AGENDA_URL')) throw new Error('El calendario no está conectado (falta AGENDA_URL en Netlify)')
  const res = await fetch(env('AGENDA_URL'), {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, clave: env('AGENDA_CLAVE') }),
    redirect: 'follow',
    signal: AbortSignal.timeout(25_000),
  })
  const data = await res.json().catch(() => null)
  if (data?.error === 'acción desconocida') throw new Error('Falta actualizar el programa de Google (agenda) con la versión nueva: así HQ puede leer y escribir tu calendario.')
  if (!data?.ok) throw new Error(data?.error ?? `Google respondió ${res.status}`)
  return data
}

const CAMPOS = ['titulo', 'fecha', 'todo_el_dia', 'hora_inicio', 'hora_fin', 'repetir', 'descripcion', 'tipo', 'aviso_min']
const limpio = (b) => Object.fromEntries(CAMPOS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]))

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo Eduardo' }, 403)
  const b = await req.json().catch(() => ({}))
  try {
    if (b.accion === 'listar') {
      const desde = new Date(b.desde)
      const hasta = new Date(b.hasta)
      if (isNaN(desde) || isNaN(hasta) || hasta - desde > 400 * 864e5) return json({ ok: false, error: 'Fechas inválidas' }, 400)
      const r = await agenda({ accion: 'cal_listar', desde: desde.toISOString(), hasta: hasta.toISOString() })
      return json({ ok: true, eventos: r.eventos ?? [] })
    }
    if (b.accion === 'crear') return json(await agenda({ accion: 'cal_crear', ...limpio(b) }))
    if (b.accion === 'editar') return json(await agenda({ accion: 'cal_editar', id: String(b.id || ''), ...limpio(b) }))
    if (b.accion === 'borrar') return json(await agenda({ accion: 'cal_borrar', id: String(b.id || '') }))
    return json({ ok: false, error: 'acción desconocida' }, 400)
  } catch (err) {
    return json({ ok: false, error: String(err?.message ?? err).slice(0, 300) }, 502)
  }
}
