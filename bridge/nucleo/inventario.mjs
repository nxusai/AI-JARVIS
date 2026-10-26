import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

/**
 * Ana Sofi and Mi Semago's inventory (inventario/ in this repo): what came in
 * from the suppliers, what is waiting to be bought, what is in the warehouse
 * and what is about to expire. Read only: she answers, she never changes a
 * thing (receiving, ordering and buying happen in the app, by people).
 *
 * NOT CONNECTED YET. To turn it on, in anasofi.mjs next to the labels' server
 * — and only for the owner of Mi Semago, in his group:
 *
 *   const inv = inventarioTools({ url: cfg.inventario_url, clave: cfg.inventario_clave })
 *   mcpServers: { et: server, ...(inv ? { inv } : {}) }
 *
 * with `inventario_url` (https://inventario.misemago.com, say) and
 * `inventario_clave` (the same ANASOFI_CLAVE set in that site's Netlify) in
 * anasofi.json. See docs/guia-inventario.md.
 */
export function inventarioTools({ url, clave } = {}) {
  if (!url || !clave) return null
  const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] })
  const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })
  const ask = async (body) => {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/.netlify/functions/anasofi`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-anasofi-clave': clave },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      })
      const data = await res.json().catch(() => ({}))
      return data.ok ? ok(data) : refuse(data.error || `The inventory answered ${res.status}`)
    } catch (err) {
      return refuse(`The inventory did not answer: ${err.message}`)
    }
  }
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  const range = { desde: day.describe('First day, YYYY-MM-DD (today if not given).'), hasta: day.describe('Last day, YYYY-MM-DD (same as desde if not given).') }

  return createSdkMcpServer({
    name: 'inv',
    version: '1.0.0',
    instructions: "Mi Semago's inventory, read only: receipts from suppliers (with their problems), purchase orders, stock by lot and expiring lots. Times are the business's own (New Jersey). Folios: R- receipts, P- orders, S- stock outs.",
    tools: [
      tool('resumen', "A day's (or range's) inventory report: what arrived and its problems, orders made, purchases made, stock outs, what is still to buy, lots expiring within 14 days and products under their minimum. Use it for \"¿cómo vamos?\", \"reporte de hoy\", \"¿qué pasó ayer?\".", range, async (a) => ask({ pregunta: 'resumen', ...a })),
      tool('pendientes', 'Orders still to buy, and bought ones that have not arrived.', {}, async () => ask({ pregunta: 'pendientes' })),
      tool('recepciones', 'Everything that arrived in a range, with its times, who received it and its problems.', range, async (a) => ask({ pregunta: 'recepciones', ...a })),
      tool('recepcion', 'One receipt in full by its folio (R-0012 or 12).', { folio: z.string() }, async ({ folio }) => ask({ pregunta: 'recepcion', folio })),
      tool('problemas', 'Shortages, damaged sacks, expired goods, missing packing slips and the like in a range, grouped by supplier, with what they are worth when the slip had prices.', range, async (a) => ask({ pregunta: 'problemas', ...a })),
      tool('existencias', 'What is in the warehouse, by product and lot. texto filters by product name.', { texto: z.string().optional() }, async (a) => ask({ pregunta: 'existencias', ...a })),
      tool('caducidades', 'Lots already expired or expiring within `dias` days (30 if not given).', { dias: z.number().int().min(0).max(365).optional() }, async (a) => ask({ pregunta: 'caducidades', ...a })),
    ],
  })
}
