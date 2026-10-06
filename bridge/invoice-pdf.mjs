import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { activeBrand, findBrand, readLogo } from './brands.mjs'

/**
 * An invoice as a PDF the owner can check on Telegram before it goes to the
 * client: the brand's logo and colour, the client, every line, the totals
 * and the due date, read from the invoice as it is in Zoho. Zoho's MCP tools
 * return the invoice's data but not its PDF file, so the page is drawn on
 * this Mac with the owner's Chrome (headless, print to PDF) from that data.
 * Nothing is sent to anyone: the file lands in ~/Documents/Nexy/facturas.
 */

export const INVOICES_DIR = join(homedir(), 'Documents', 'Nexy', 'facturas')

const CHROMES = [
  process.env.NEXY_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean)

const findChrome = () => CHROMES.find((p) => existsSync(p)) ?? null

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const money = (n, cur) => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${esc(cur)}`

const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }

/** The invoice page. Exported for tests. */
export function invoiceHtml(d, brand) {
  const cur = d.currency || 'USD'
  const items = d.items.map((i) => ({ ...i, quantity: Number(i.quantity ?? 1), rate: Number(i.rate ?? 0) }))
  const subtotal = items.reduce((s, i) => s + i.quantity * i.rate, 0)
  const discount = Number(d.discount ?? 0)
  const taxed = subtotal - discount
  // Zoho's own figures win when given: its taxes and rounding are the real ones.
  const tax = d.tax_amount != null ? Number(d.tax_amount) : d.tax_percent ? (taxed * Number(d.tax_percent)) / 100 : 0
  const total = d.total != null ? Number(d.total) : taxed + tax
  const color = brand?.color || '#3b2fc9'
  let logo = ''
  const file = brand ? readLogo(brand.id) : null
  if (file) logo = `<img class="logo" src="data:${MIME[extname(file).toLowerCase()] ?? 'image/png'};base64,${readFileSync(file).toString('base64')}">`
  const row = (k, v) => (v ? `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>` : '')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: Letter; margin: 0 }
  * { box-sizing: border-box }
  body { margin: 0; font: 13px/1.45 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1d1d2b }
  .page { padding: 48px 54px }
  .preview { background: #fff4d6; color: #7a5600; border: 1px solid #f0c75e; padding: 8px 12px; border-radius: 8px; font-weight: 600; margin-bottom: 26px }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px }
  .logo { max-height: 64px; max-width: 220px; object-fit: contain }
  .issuer { font-size: 18px; font-weight: 700 }
  .title { text-align: right }
  .title h1 { margin: 0; font-size: 30px; letter-spacing: .06em; color: ${esc(color)} }
  .title .num { color: #666 }
  .meta { margin-top: 30px; display: flex; justify-content: space-between; gap: 30px }
  .meta h3 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #888 }
  .client { font-size: 15px; font-weight: 600 }
  table.dates th { text-align: left; font-weight: 600; color: #666; padding: 2px 14px 2px 0 }
  table.items { width: 100%; border-collapse: collapse; margin-top: 30px }
  table.items th { background: ${esc(color)}; color: #fff; text-align: left; padding: 9px 10px; font-size: 12px }
  table.items td { padding: 10px; border-bottom: 1px solid #e6e6ef; vertical-align: top }
  table.items .n { text-align: right; white-space: nowrap }
  .desc { color: #666; font-size: 12px }
  .totals { margin: 18px 0 0 auto; width: 300px }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0 }
  .totals .grand { border-top: 2px solid ${esc(color)}; margin-top: 6px; padding-top: 9px; font-size: 17px; font-weight: 700 }
  .notes { margin-top: 34px; white-space: pre-wrap }
  .notes h3 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #888 }
  </style></head><body><div class="page">
  ${d.preview ? '<div class="preview">VISTA PREVIA — Todavía no existe en Zoho.</div>' : ''}
  <header>
    <div>${logo}<div class="issuer">${esc(d.issuer_name || brand?.nombre || '')}</div></div>
    <div class="title"><h1>${d.kind === 'estimate' ? 'ESTIMATE' : 'INVOICE'}</h1><div class="num">${esc(d.invoice_number || 'Borrador')}</div>${d.status ? `<div class="num">${esc(d.status)}</div>` : ''}</div>
  </header>
  <div class="meta">
    <div><h3>Bill to</h3><div class="client">${esc(d.client_name)}</div>${d.client_email ? `<div>${esc(d.client_email)}</div>` : ''}${d.client_address ? `<div>${esc(d.client_address).replace(/\n/g, '<br>')}</div>` : ''}</div>
    <table class="dates">${row('Invoice date', d.date)}${row('Due by', d.due_date)}${row('Terms', d.payment_terms)}</table>
  </div>
  <table class="items"><thead><tr><th>#</th><th>Item</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead><tbody>
  ${items
    .map(
      (i, n) =>
        `<tr><td>${n + 1}</td><td>${esc(i.name)}${i.description ? `<div class="desc">${esc(i.description)}</div>` : ''}</td><td class="n">${i.quantity}</td><td class="n">${money(i.rate, cur)}</td><td class="n">${money(i.quantity * i.rate, cur)}</td></tr>`,
    )
    .join('')}
  </tbody></table>
  <div class="totals">
    <div><span>Subtotal</span><span>${money(subtotal, cur)}</span></div>
    ${discount ? `<div><span>Discount</span><span>−${money(discount, cur)}</span></div>` : ''}
    ${tax ? `<div><span>Tax${d.tax_percent ? ` (${esc(d.tax_percent)}%)` : ''}</span><span>${money(tax, cur)}</span></div>` : ''}
    <div class="grand"><span>Total</span><span>${money(total, cur)}</span></div>
    ${d.balance_due != null && Number(d.balance_due) !== total ? `<div><span>Balance due</span><span>${money(d.balance_due, cur)}</span></div>` : ''}
  </div>
  ${d.notes ? `<div class="notes"><h3>Notes</h3>${esc(d.notes)}</div>` : ''}
  ${d.terms ? `<div class="notes"><h3>Terms &amp; conditions</h3>${esc(d.terms)}</div>` : ''}
  </div></body></html>`
}

/** Print an HTML file to PDF with headless Chrome. */
function printPdf(chrome, html, out) {
  const dir = mkdtempSync(join(tmpdir(), 'nexy-factura-'))
  const page = join(dir, 'factura.html')
  writeFileSync(page, html)
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(dir, 'profile')}`, '--no-pdf-header-footer',
    // Chrome refuses to start as root with its sandbox; the page is our own HTML.
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), `--print-to-pdf=${out}`, pathToFileURL(page).href]
  return new Promise((resolve, reject) => {
    const p = spawn(chrome, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', (b) => (err = (err + b).slice(-2000)))
    const timer = setTimeout(() => p.kill('SIGKILL'), 60_000)
    p.on('error', reject)
    p.on('close', () => {
      clearTimeout(timer)
      rmSync(dir, { recursive: true, force: true })
      if (existsSync(out) && statSync(out).size > 0) resolve(out)
      else reject(new Error(err.trim().split('\n').at(-1) || 'Chrome did not write the PDF'))
    })
  })
}

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })

export function invoicesServer() {
  return createSdkMcpServer({
    name: 'jarvis_facturas',
    version: '1.0.0',
    instructions: 'A PDF of an invoice or estimate, for the owner to look at before it is created in Zoho.',
    tools: [
      tool(
        'invoice_pdf',
        'Draw an invoice (or estimate) that exists in Zoho as a PDF on this Mac, so the owner can check it before it goes ' +
          'to the client: read the invoice from Zoho first and pass its data exactly (number, status, client, dates, every ' +
          'line, tax, total). Then send the file with send_file. It does not create or send anything in Zoho.',
        {
          brand: z.string().optional().describe('The brand issuing it; the active one when left out.'),
          issuer_name: z.string().optional().describe('The legal name on the invoice, e.g. "NXUS AI LLC".'),
          kind: z.enum(['invoice', 'estimate']).optional(),
          invoice_number: z.string().optional().describe('Zoho\'s number, once it exists.'),
          client_name: z.string(),
          client_email: z.string().optional(),
          client_address: z.string().optional(),
          date: z.string().describe('Invoice date, YYYY-MM-DD.'),
          due_date: z.string().optional().describe('Due by, YYYY-MM-DD.'),
          payment_terms: z.string().optional().describe('e.g. "Net 15", "Due on receipt".'),
          currency: z.string().optional().describe('Default USD.'),
          items: z
            .array(z.object({ name: z.string(), description: z.string().optional(), quantity: z.number().optional(), rate: z.number() }))
            .min(1),
          discount: z.number().optional().describe('An amount off the subtotal.'),
          tax_percent: z.number().optional(),
          tax_amount: z.number().optional().describe("Zoho's tax total, when it has one."),
          total: z.number().optional().describe("Zoho's total for the invoice."),
          balance_due: z.number().optional(),
          status: z.string().optional().describe('Zoho status, e.g. Draft, Sent, Paid.'),
          notes: z.string().optional(),
          terms: z.string().optional(),
          preview: z.boolean().optional().describe('True only when the owner asks to see one before it is created in Zoho.'),
        },
        async (d) => {
          const brand = d.brand ? findBrand(d.brand) : activeBrand()
          if (d.brand && !brand) return refuse(`There is no brand called ${d.brand}.`)
          const chrome = findChrome()
          if (!chrome) return refuse('Google Chrome is not installed on this Mac, so the PDF cannot be drawn.')
          mkdirSync(INVOICES_DIR, { recursive: true })
          const name = `${new Date().toISOString().slice(0, 10)}-${String(d.invoice_number || d.client_name)
            .normalize('NFD')
            .replace(/[^\w-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40)}-${Date.now().toString(36)}.pdf`
          try {
            const out = await printPdf(chrome, invoiceHtml(d, brand), join(INVOICES_DIR, name))
            console.log(`[jarvis] invoice PDF drawn: ${out}`)
            return ok(`PDF ready: ${out}. Send it to the owner with send_file.`)
          } catch (err) {
            return refuse(`Could not draw the PDF: ${err?.message ?? err}`)
          }
        },
      ),
    ],
  })
}
