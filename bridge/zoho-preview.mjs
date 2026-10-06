/**
 * A Zoho Invoice action as the owner reads it on an approval card: what it
 * does in Spanish, and its fields as "Monto: $6,000" rather than JSON. Zoho's
 * tools take a `body` (sometimes a JSON string) and headers; the headers only
 * carry the organization.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Zoho's create calls name the client only by id, which the owner cannot
 * read. Nexy looks clients up before invoicing them, so the names come back
 * in those results: they are remembered here (in a small file, so a restart
 * keeps them) and the card says "Cliente: Mi Semago" instead of a number.
 */
const NAMES_FILE = join(homedir(), '.nexy', 'zoho-nombres.json')
const MAX_NAMES = 2000
let names = null
const loadNames = () => {
  if (names) return names
  try {
    names = new Map(Object.entries(JSON.parse(readFileSync(NAMES_FILE, 'utf8'))))
  } catch {
    names = new Map()
  }
  return names
}

const str = (v) => (v === undefined || v === null ? '' : String(v).trim())

/** Every Zoho record in a result that carries an id and a readable name. */
function walk(v, found, depth = 0) {
  if (depth > 8 || !v || typeof v !== 'object') return
  if (Array.isArray(v)) return v.forEach((x) => walk(x, found, depth + 1))
  const company = str(v.company_name)
  const contact = str(v.contact_name ?? v.customer_name)
  if (v.contact_id ?? v.customer_id) {
    const name = contact && company && contact !== company ? `${contact} (${company})` : contact || company
    if (name) found.push([str(v.contact_id ?? v.customer_id), name])
  }
  if (v.contact_person_id) {
    const person = [str(v.first_name), str(v.last_name)].filter(Boolean).join(' ')
    const name = [person, str(v.email)].filter(Boolean).join(' · ')
    if (name) found.push([str(v.contact_person_id), name])
  }
  for (const x of Object.values(v)) if (x && typeof x === 'object') walk(x, found, depth + 1)
}

/** Remember the client and contact names in a Zoho result's text. */
export function rememberZohoNames(text) {
  const t = String(text ?? '')
  if (!/"(contact_id|customer_id|contact_person_id)"/.test(t)) return 0
  const found = []
  // The result is JSON, sometimes with a line of text around it.
  for (const chunk of [t, ...(t.match(/[[{][\s\S]*[\]}]/g) ?? [])]) {
    try {
      walk(JSON.parse(chunk), found)
      break
    } catch {
      // try the next shape
    }
  }
  if (!found.length) return 0
  const map = loadNames()
  for (const [id, name] of found) {
    map.delete(id)
    map.set(id, name.slice(0, 160))
  }
  while (map.size > MAX_NAMES) map.delete(map.keys().next().value)
  try {
    mkdirSync(join(NAMES_FILE, '..'), { recursive: true })
    writeFileSync(NAMES_FILE, JSON.stringify(Object.fromEntries(map)))
  } catch {
    // Only the card's wording depends on it.
  }
  return found.length
}

const nameOf = (id) => loadNames().get(str(id)) ?? null

const MODES = {
  cash: 'efectivo',
  banktransfer: 'transferencia',
  bank_transfer: 'transferencia',
  check: 'cheque',
  creditcard: 'tarjeta',
  credit_card: 'tarjeta',
  bankremittance: 'depósito bancario',
  others: 'otro',
}

const money = (n) => {
  const v = Number(n)
  return Number.isFinite(v) ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : String(n)
}

const LABELS = {
  customer_name: 'Cliente',
  contact_name: 'Cliente',
  customer_id: 'Cliente (id)',
  contact_id: 'Cliente (id)',
  invoice_number: 'Factura',
  invoice_id: 'Factura (id)',
  estimate_number: 'Cotización',
  date: 'Fecha',
  due_date: 'Vence',
  payment_date: 'Fecha de pago',
  amount: 'Monto',
  total: 'Total',
  payment_mode: 'Forma de pago',
  reference_number: 'Referencia',
  description: 'Descripción',
  notes: 'Notas',
  terms: 'Condiciones',
  currency_code: 'Moneda',
  email: 'Correo',
  company_name: 'Empresa',
  first_name: 'Nombre',
  last_name: 'Apellido',
  phone: 'Teléfono',
  subject: 'Asunto',
  body: 'Mensaje',
  recurrence_name: 'Nombre de la recurrencia',
  recurrence_frequency: 'Cada',
  repeat_every: 'Repetir cada',
  start_date: 'Empieza',
  end_date: 'Termina',
}

/** What a Zoho tool does, in a few words. */
export function zohoAction(tool) {
  const t = String(tool).toLowerCase().replace(/[_-]+/g, ' ')
  if (/payment/.test(t) && /create|record|add/.test(t)) return 'Registrar un pago recibido'
  if (/reminder/.test(t)) return 'Mandar recordatorio de pago'
  if (/(email|send).*(invoice)|invoice.*(email|send)/.test(t)) return 'Enviar factura por correo'
  if (/mark.*sent/.test(t)) return 'Marcar factura como enviada'
  if (/recurring/.test(t) && /create/.test(t)) return 'Crear factura recurrente (se repite sola)'
  if (/estimate/.test(t) && /(email|send)/.test(t)) return 'Enviar cotización por correo'
  if (/estimate/.test(t) && /create/.test(t)) return 'Crear cotización'
  if (/invoice/.test(t) && /create/.test(t)) return 'Crear factura'
  if (/(contact|customer)/.test(t) && /create/.test(t)) return 'Dar de alta un cliente'
  if (/update|edit/.test(t)) return 'Cambiar datos en Zoho'
  return `Zoho: ${String(tool).replace(/^zoho ?invoice[_ ]*/i, '').replace(/[_-]+/g, ' ')}`
}

/** A JSON object or list sent as text; anything else (ids included) stays as it is. */
const parse = (v) => {
  if (typeof v !== 'string' || !/^\s*[[{]/.test(v)) return v
  try {
    return JSON.parse(v)
  } catch {
    return v
  }
}

/** The card's lines for a Zoho call's input. */
export function zohoLines(input) {
  const raw = input && typeof input === 'object' ? input : {}
  const headers = parse(raw.headers) ?? {}
  const body = parse(raw.body)
  const data = body && typeof body === 'object' ? body : Object.fromEntries(Object.entries(raw).filter(([k]) => k !== 'headers'))
  const lines = []
  for (const [k, v0] of Object.entries(data)) {
    const v = parse(v0)
    if (v === undefined || v === null || v === '') continue
    if ((k === 'customer_id' || k === 'contact_id') && typeof v !== 'object') {
      const name = nameOf(v)
      lines.unshift(name ? `👤 Cliente: ${name}` : `👤 Cliente: id ${v} — ⚠️ Nexy no confirmó el nombre; revísalo en Zoho antes de aprobar`)
    } else if (k === 'contact_persons' && Array.isArray(v)) {
      lines.push(`Se envía a: ${v.map((id) => nameOf(id) ?? `id ${id}`).join(', ')}`)
    } else if (k === 'invoices' && Array.isArray(v)) {
      const parts = v.map((i) => `${i.invoice_number ?? `#${String(i.invoice_id ?? '').slice(-6)}`}: ${money(i.amount_applied ?? i.amount)}`)
      lines.push(`Se aplica a ${v.length} factura${v.length === 1 ? '' : 's'}: ${parts.join(' · ')}`)
    } else if (k === 'line_items' && Array.isArray(v)) {
      lines.push('Conceptos:')
      for (const li of v) lines.push(`  • ${li.name ?? li.description ?? 'Concepto'} × ${li.quantity ?? 1} a ${money(li.rate ?? li.item_total ?? 0)}`)
    } else if (k === 'payment_mode') {
      lines.push(`Forma de pago: ${MODES[String(v).toLowerCase().replace(/\s+/g, '')] ?? v}`)
    } else if (/^(amount|total|rate|balance)$/.test(k)) {
      lines.push(`${LABELS[k] ?? k}: ${money(v)}`)
    } else if ((k === 'to_mail_ids' || k === 'cc_mail_ids') && Array.isArray(v)) {
      lines.push(`${k === 'to_mail_ids' ? 'Para' : 'Copia'}: ${v.join(', ')}`)
    } else if (typeof v !== 'object') {
      lines.push(`${LABELS[k] ?? k.replace(/_/g, ' ')}: ${String(v).slice(0, 600)}`)
    } else {
      lines.push(`${LABELS[k] ?? k.replace(/_/g, ' ')}: ${JSON.stringify(v).slice(0, 300)}`)
    }
  }
  const org = headers?.['X-com-zoho-invoice-organizationid'] ?? headers?.organization_id
  if (org) lines.push(`Organización de Zoho: ${org}`)
  return lines
}
