/**
 * A Zoho Invoice action as the owner reads it on an approval card: what it
 * does in Spanish, and its fields as "Monto: $6,000" rather than JSON. Zoho's
 * tools take a `body` (sometimes a JSON string) and headers; the headers only
 * carry the organization.
 */

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
    if (k === 'invoices' && Array.isArray(v)) {
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
