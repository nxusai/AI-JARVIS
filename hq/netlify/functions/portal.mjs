// La puerta del portal (empezar.nxusai.org) a HQ: cada vez que un prospecto
// avanza, el portal manda aquí su registro y queda en Prospectos. Solo entra
// quien trae la clave que comparten los dos (PORTAL_CLAVE, en ambos Netlify);
// la llave de servicio de Supabase nunca sale de HQ.
import { timingSafeEqual } from 'node:crypto'
import { json, sb } from '../lib/sb.mjs'

const ETAPAS = ['abrio', 'datos', 'pagado', 'cita']
const texto = (v, max) => String(v ?? '').trim().slice(0, max)

function autorizado(req) {
  const want = Buffer.from(process.env.PORTAL_CLAVE || '')
  const got = Buffer.from(req.headers.get('x-portal-clave') || '')
  return want.length >= 24 && want.length === got.length && timingSafeEqual(want, got)
}

/** El registro del portal, como fila de prospectos (solo lo que trae). */
function fila(lead) {
  const c = lead.contacto ?? {}
  const f = {
    portal_id: texto(lead.id, 60),
    etapa: ETAPAS.includes(lead.etapa) ? lead.etapa : 'abrio',
    link: texto(lead.de, 60),
    nombre: texto(c.nombre, 80),
    empresa: texto(c.empresa, 120),
    direccion: texto(c.direccion, 200),
    whatsapp: texto(c.whatsapp, 30),
    correo: texto(c.correo, 120).toLowerCase(),
    camino: ['consulta', 'propuesta'].includes(lead.camino) ? lead.camino : '',
    meet: texto(lead.cita?.meet, 300),
  }
  for (const k of Object.keys(f)) if (f[k] === '') delete f[k]
  if (Array.isArray(lead.lineas) && lead.lineas.length) f.lineas = lead.lineas.slice(0, 40).map((x) => texto(x, 80))
  if (lead.diagnostico && Object.keys(lead.diagnostico).length) f.diagnostico = lead.diagnostico
  if (typeof lead.acepta_novedades === 'boolean') f.acepta_novedades = lead.acepta_novedades
  if (lead.cita?.inicio && !Number.isNaN(Date.parse(lead.cita.inicio))) f.cita = new Date(lead.cita.inicio).toISOString()
  return f
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  if (!autorizado(req)) return json({ ok: false, error: 'sin permiso' }, 401)
  if (!process.env.SUPABASE_SERVICE_KEY) return json({ ok: false, error: 'Falta SUPABASE_SERVICE_KEY en Netlify' }, 503)
  const { lead } = await req.json().catch(() => ({}))
  if (!/^[\w-]{8,60}$/.test(String(lead?.id ?? ''))) return json({ ok: false, error: 'falta el registro' }, 400)

  try {
    const f = fila(lead)
    // ?de=barbara → el prospecto queda a nombre de Barbara (y su comisión).
    const codigo = String(lead.vendedor ?? '').toLowerCase()
    if (/^[a-z0-9-]{2,30}$/.test(codigo)) {
      const [p] = await sb(`/rest/v1/perfiles?codigo=eq.${codigo}&activo=eq.true&select=id`, { servicio: true })
      if (p) f.traido_por = p.id
    }
    const [pros] = await sb('/rest/v1/prospectos?on_conflict=portal_id', {
      servicio: true,
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: f,
    })
    // Lo que pagó por Stripe (una sola vez por sesión).
    const pago = lead.pago
    if (pros && pago?.estado === 'pagado' && /^cs_\w+$/.test(String(pago.sesion ?? ''))) {
      await sb('/rest/v1/prospectos_pagos?on_conflict=sesion', {
        servicio: true,
        method: 'POST',
        prefer: 'resolution=ignore-duplicates,return=minimal',
        body: { prospecto_id: pros.id, monto: Math.round(Number(pago.monto) || 0) / 100, moneda: String(pago.moneda).toUpperCase() === 'USD' ? 'USD' : 'MXN', sesion: pago.sesion },
      })
    }
    return json({ ok: true, id: pros?.id })
  } catch (err) {
    return json({ ok: false, error: err.message }, err.status || 500)
  }
}
