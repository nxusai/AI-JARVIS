import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { findProduct, listClients, productLine, queuePrint, today } from './nucleo/etiquetas.mjs'

// The labels themselves are the core's (bridge/nucleo/etiquetas.mjs): they run
// in the clients' brains too. What is NEX's alone is below.
export * from './nucleo/etiquetas.mjs'

/**
 * The owner's own NEX and the labels: find a product and send labels to the
 * Zebra ("imprímeme 20 del quesillo abuelito de 5 libras"). Changing the
 * labels stays with Ana Sofi's group.
 */
export function ownerLabelsServer() {
  const ok = (text) => ({ content: [{ type: 'text', text }] })
  const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })
  const fold = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return createSdkMcpServer({
    name: 'jarvis_etiquetas',
    version: '1.0.0',
    instructions: "Mi Semago's Zebra labels: find a product and print labels on the Zebra at Mi Semago.",
    tools: [
      tool('search_labels', "Find label products in every company by words (name, size, packing, company, code). Codes are unique; use one to print.", { texto: z.string() }, async ({ texto }) => {
        const words = fold(texto).split(/\s+/).filter(Boolean)
        const hits = []
        for (const c of listClients()) for (const p of c.productos) if (words.every((w) => fold(`${c.nombre} ${productLine(p)}`).includes(w))) hits.push(`${c.nombre} · ${productLine(p)}`)
        return ok(hits.length ? hits.slice(0, 30).join('\n') : 'Nothing matches all those words.')
      }),
      tool(
        'print_labels',
        "Print labels on the Zebra at Mi Semago: the order reaches the label program open on the printer's computer through the shared Drive folder and prints within a minute. Only when the owner asks, with the product (code from search_labels) and how many; if more than one product could be it, ask which. fecha: production date YYYY-MM-DD, today if not given.",
        { codigo: z.string(), cantidad: z.number().int().min(1).max(500), fecha: z.string().optional(), logo: z.string().optional() },
        async ({ codigo, cantidad, fecha, logo }) => {
          const hit = findProduct(codigo)
          if (!hit) return refuse(`There is no label product ${codigo}. Use search_labels.`)
          if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return refuse('fecha is YYYY-MM-DD.')
          const r = queuePrint({ c: hit.c, p: hit.p, qty: cantidad, fecha: fecha || today(), logo, quien: 'Eduardo' })
          if (r.error) return refuse(r.error)
          return ok(`Sent: ${cantidad} × ${productLine(hit.p)} (${hit.c.nombre}). It prints in a few seconds if the program is open on the printer's computer.`)
        },
      ),
    ],
  })
}
