import { timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'

/**
 * Lo que comparten las funciones del portal: los prospectos guardados en
 * Netlify, el aviso a Telegram y las respuestas.
 *
 * Variables de entorno (Netlify → Site configuration → Environment variables):
 *   TELEGRAM_TOKEN   el bot "NXUS Portal" (solo manda avisos)
 *   TELEGRAM_CHAT    tu número de cuenta de Telegram
 *   AGENDA_URL       la aplicación web de google/agenda.gs
 *   AGENDA_CLAVE     la clave que dio "preparar"
 *   STRIPE_KEY       llave restringida de Stripe (solo leer pagos de Checkout)
 *   PAGO_MX, PAGO_US los links de pago de la consultoría (pesos y dólares)
 *   NEXY_CLAVE       la llave con la que NEX lee los prospectos
 *   NEX_LLAMADA_CLAVE la llave de las llamadas de NEX contigo (scripts/llamada.mjs)
 *   ANTHROPIC_API_KEY para que NEX investigue en internet durante la llamada
 *   HQ_URL           NXUS HQ (https://app.nxusai.org): cada prospecto cae ahí
 *   PORTAL_CLAVE     la clave que comparten el portal y HQ (la misma en los dos)
 */

export const env = (k) => (typeof Netlify !== 'undefined' ? Netlify.env.get(k) : process.env[k]) ?? ''

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

const ID = /^[0-9a-f-]{36}$/
export const store = () => getStore({ name: 'prospectos', consistency: 'strong' })
export async function readLead(id) {
  if (!ID.test(String(id ?? ''))) return null
  return store().get(id, { type: 'json' })
}
export async function saveLead(lead) {
  lead.actualizado = new Date().toISOString()
  await store().setJSON(lead.id, lead)
  await aHQ(lead)
  return lead
}

/** Manda el prospecto a NXUS HQ (sección Prospectos). Si HQ no contesta, el portal sigue. */
export async function aHQ(lead) {
  const url = env('HQ_URL').trim().replace(/\/+$/, '')
  const clave = env('PORTAL_CLAVE').trim()
  if (!url || !clave) return
  try {
    const res = await fetch(`${url}/.netlify/functions/portal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-portal-clave': clave },
      body: JSON.stringify({ lead }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) console.error(`HQ respondió ${res.status}: ${(await res.text()).slice(0, 200)}`)
  } catch (err) {
    console.error(`HQ no contestó: ${err.message}`)
  }
}

/** Texto limpio y corto, de lo que mande el navegador. */
export const clean = (v, max = 200) => [...String(v ?? '')].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch)).join('').trim().slice(0, max)

/** Un aviso a tu Telegram. Si falla, el portal sigue. */
export async function avisar(text) {
  const token = env('TELEGRAM_TOKEN')
  const chat = env('TELEGRAM_CHAT')
  if (!token || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true }),
    })
  } catch {
    // el aviso es extra; el prospecto ya quedó guardado
  }
}

/** Una llamada a la agenda de Google (google/agenda.gs). */
export async function agenda(body) {
  const url = env('AGENDA_URL')
  if (!url) throw new Error('la agenda no está conectada todavía')
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, clave: env('AGENDA_CLAVE') }), redirect: 'follow' })
  const data = await res.json().catch(() => null)
  if (!data?.ok) throw new Error(data?.error ?? `la agenda respondió ${res.status}`)
  return data
}

export const quien = (l) => `${l.contacto?.nombre || l.de || 'Alguien'}${l.contacto?.empresa ? ` · ${l.contacto.empresa}` : ''}${l.vendedor ? ` (link de ${l.vendedor})` : ''}`

/** Si la petición trae la llave de las llamadas de NEX (header x-nex-clave). */
export function nexAutorizado(req) {
  const want = Buffer.from(env('NEX_LLAMADA_CLAVE'))
  const got = Buffer.from(req.headers.get('x-nex-clave') ?? '')
  return want.length >= 24 && want.length === got.length && timingSafeEqual(want, got)
}

/** Los encargos que dejas en una llamada, hasta que NEX los toma en tu Mac. */
export const encargos = () => getStore({ name: 'nex-encargos', consistency: 'strong' })
