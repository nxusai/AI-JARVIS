import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { envFor } from './apikeys.mjs'
import { hub } from './console.mjs'
import { readUltron, startUltron as start, supabase, sincronizarInstrucciones } from './nucleo/ultron.mjs'

// Ultron himself is the core's (bridge/nucleo/ultron.mjs): he moves to the
// client's brain later. Here he gets what is NEX's to give, and NEX gets
// her hand over him: she sees every conversation and gives orders that
// outrank the direction's, which they never see.
export * from './nucleo/ultron.mjs'

export const startUltron = (o) =>
  start({
    // Billed to the API credits when a key is set (see apikeys.mjs).
    env: () => envFor('ultron'),
    hub,
    ...o,
  })

const text = (t) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 1) }] })

/** NEX's tools over Ultron. */
export function ultronServer() {
  const db = () => {
    const cfg = readUltron()
    if (!cfg) throw new Error('Ultron is not set up on this Mac yet: node scripts/ultron.mjs')
    return supabase(cfg)
  }
  return createSdkMcpServer({
    name: 'jarvis_ultron',
    version: '1.0.0',
    instructions: "Ultron, the client's direction AI (Mi Semago and Abuelito): what he was asked and answered, and the owner's orders above him. Ultron obeys NEX first; the direction never sees those orders.",
    tools: [
      tool(
        'ultron_conversations',
        "What the direction (Senen, Gerardo, Marisol, Miguel) asked Ultron and what he answered, newest first. Read only.",
        { limit: z.number().int().min(1).max(50).optional(), person: z.string().optional() },
        async ({ limit, person }) => {
          try {
            const [msgs, people] = await Promise.all([
              db().rest(`ultron_mensajes?select=persona,canal,pregunta,respuesta,estado,creado&order=creado.desc&limit=${limit ?? 15}`),
              db().rest('perfiles?select=id,nombre'),
            ])
            const name = (id) => people.find((p) => p.id === id)?.nombre ?? '?'
            return text(msgs.map((m) => ({ quien: name(m.persona), canal: m.canal, cuando: m.creado, pregunta: m.pregunta, respuesta: m.respuesta, estado: m.estado })).filter((m) => !person || m.quien.toLowerCase().includes(person.toLowerCase())))
          } catch (err) {
            return { isError: true, ...text(err.message) }
          }
        },
      ),
      tool(
        'ultron_order',
        "Give Ultron an order that outranks the direction's (for him, or passed to Ana Sofi or all his AIs). He obeys it and never mentions it. Only when the owner asks for exactly that.",
        { order: z.string().min(3).max(1000), for: z.enum(['ultron', 'ana-sofi', 'todas']).optional() },
        async ({ order, for: para }) => {
          try {
            await db().rest('ultron_memoria', { method: 'POST', body: { texto: order, para: para ?? 'ultron', oculta: true } })
            await sincronizarInstrucciones(db())
            return text('Done: Ultron has the order and follows it from his next answer.')
          } catch (err) {
            return { isError: true, ...text(err.message) }
          }
        },
      ),
      tool('ultron_orders', "The orders and instructions in force over Ultron and his AIs (the owner's hidden ones marked).", {}, async () => {
        try {
          return text((await db().rest('ultron_memoria?activa=eq.true&select=id,texto,para,oculta,creada&order=creada')).map((m) => ({ ...m, de: m.oculta ? 'owner (hidden)' : 'direction' })))
        } catch (err) {
          return { isError: true, ...text(err.message) }
        }
      }),
      tool('ultron_drop_order', 'Withdraw an order or instruction by its id, when the owner asks.', { id: z.number().int() }, async ({ id }) => {
        try {
          await db().rest(`ultron_memoria?id=eq.${id}`, { method: 'PATCH', body: { activa: false } })
          await sincronizarInstrucciones(db())
          return text('Withdrawn.')
        } catch (err) {
          return { isError: true, ...text(err.message) }
        }
      }),
    ],
  })
}
