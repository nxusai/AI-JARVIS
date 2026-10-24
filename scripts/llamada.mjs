#!/usr/bin/env node
// NEX's phone calls with you, with internet and real work behind them.
//
//   node scripts/llamada.mjs conectar <url del portal>   makes the calls' key, saves it here and copies it
//                                                       (paste it in Netlify as NEX_LLAMADA_CLAVE)
//   node scripts/llamada.mjs llave                      copies the key again
//   node scripts/llamada.mjs agente                     the agent that calls you (NEXY_CALL_AGENT_ID) learns the
//                                                       business (a summary travels with each call) and, once
//                                                       the portal is connected, gets "encargar_a_nex" (work
//                                                       NEX does on your Mac)
//   node scripts/llamada.mjs agente internet            the same, plus "investigar" (internet)
//   node scripts/llamada.mjs                            how it is set up, and whether the portal answers
//
// Only the agent that calls you gets the tools: the messenger and the receptionist, who talk to other
// people, never do. The key is never printed; the ElevenLabs key comes from ELEVENLABS_API_KEY or
// ~/.claude.json, as the bridge reads it.

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readCall, readCallFile, writeCallFile } from '../bridge/llamada.mjs'

const [cmd, arg] = process.argv.slice(2)
const say = (s = '') => console.log(s)
const API = 'https://api.elevenlabs.io/v1'
const MARKS = { negocio: 'NEGOCIO EN ESTA LLAMADA', encargar_a_nex: 'ENCARGOS EN ESTA LLAMADA', investigar: 'INTERNET EN ESTA LLAMADA' }
const BLOCKS = {
  negocio: `${MARKS.negocio}
Así está la empresa de Eduardo al momento de esta llamada (ventas, clientes por cerrar, pendientes, software, lo que hicieron NEX, Ultron y Ana Sofi):
{{nex_negocio}}
- Contesta sus preguntas sobre el negocio con estos datos, en voz alta y con números dichos como se hablan.
- Si te pregunta algo que no está aquí, dilo y ofrece dejarlo como encargo para que NEX lo revise.`,
  encargar_a_nex: `${MARKS.encargar_a_nex}
- Para cualquier cosa que haya que hacer o revisar (mandar un correo, agendar, preparar un documento, darle trabajo a Ultron o a Ana Sofi, dar seguimiento a un cliente, revisar algo que no está en el resumen), usa "encargar_a_nex" con la tarea completa y clara: qué, para quién, cuándo y los datos que dio. Luego dile que queda anotado y que le avisas por Telegram.
- Antes de usarla di una sola frase corta, como "Un momento.", y espera la respuesta.`,
  investigar: `${MARKS.investigar}
- Para cualquier pregunta que necesite datos actuales de internet (noticias, precios, clima, empresas, personas, leyes), usa "investigar" con la pregunta completa y di la respuesta con tus palabras.`,
}
const STYLE = 'Eres NEX, hombre. Hablas en masculino, frío, calmado y directo: sin expresiones, sin exclamaciones, sin risas, sin entusiasmo. Frases completas y cortas.'

function copy(text) {
  if (process.platform !== 'darwin') return false
  return spawnSync('pbcopy', { input: text }).status === 0
}

function key() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim()
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'))
    return cfg.mcpServers?.elevenlabs?.env?.ELEVENLABS_API_KEY?.trim() ?? null
  } catch {
    return null
  }
}

if (cmd === 'conectar') {
  let url
  try {
    url = new URL(String(arg ?? '')).origin
  } catch {
    say('\n❌ Escribe la dirección de tu portal, por ejemplo: node scripts/llamada.mjs conectar https://empezar.nxusai.org\n')
    process.exit(1)
  }
  const clave = readCallFile().clave ?? randomBytes(24).toString('base64url')
  writeCallFile({ url, clave })
  say(`\n✅ Portal: ${url}`)
  say(copy(clave) ? '🔑 Llave de las llamadas copiada. Pégala en Netlify como NEX_LLAMADA_CLAVE.\n' : '🔑 Llave guardada. Cópiala con: node scripts/llamada.mjs llave\n')
  process.exit(0)
}

if (cmd === 'llave') {
  const c = readCall()
  if (!c) {
    say('\n✋ Primero: node scripts/llamada.mjs conectar <url del portal>\n')
    process.exit(1)
  }
  say(copy(c.clave) ? '\n🔑 Llave de las llamadas copiada.\n' : '\n✋ No pude copiarla (esto solo funciona en tu Mac).\n')
  process.exit(0)
}

if (cmd === 'agente') {
  const c = readCall()
  const apiKey = key()
  const agentId = String(process.env.NEXY_CALL_AGENT_ID ?? '').trim()
  const withInternet = arg === 'internet'
  if (withInternet && !c) {
    say('\n✋ Para internet primero conecta el portal: node scripts/llamada.mjs conectar <url del portal>\n')
    process.exit(1)
  }
  if (!apiKey || !/^agent_\w+$/.test(agentId)) {
    say('\n✋ No encuentro la llave de ElevenLabs o NEXY_CALL_AGENT_ID en esta Terminal. Abre una pestaña nueva e inténtalo otra vez.\n')
    process.exit(1)
  }
  const h = { 'xi-api-key': apiKey, 'content-type': 'application/json' }
  const TOOLS = {
    encargar_a_nex: {
      description: 'Deja una tarea para que NEX la haga en la Mac de Eduardo con todas sus herramientas (correos, agenda, documentos, clientes, Ultron, Ana Sofi). NEX avisa por Telegram al terminar.',
      path: 'nex-encargo',
      field: 'tarea',
      what: 'La tarea completa y clara: qué hacer, para quién, cuándo y cualquier dato que dio Eduardo.',
      wait: 15,
    },
    investigar: {
      description: 'Investiga en internet cualquier pregunta de Eduardo y devuelve la respuesta lista para decirla en voz alta.',
      path: 'nex-investigar',
      field: 'pregunta',
      what: 'La pregunta completa, con todo el contexto que dio Eduardo.',
      wait: 45,
    },
  }
  // The business summary always; tasks once the portal is connected; internet only when asked.
  const want = [...(c ? ['encargar_a_nex'] : []), ...(withInternet ? ['investigar'] : [])]
  const made = { ...(readCallFile().herramientas ?? {}) }
  for (const name of want) {
    if (made[name]) {
      say(`✅ Herramienta "${name}" ya estaba.`)
      continue
    }
    const t = TOOLS[name]
    const res = await fetch(`${API}/convai/tools`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        tool_config: {
          type: 'webhook',
          name,
          description: t.description,
          response_timeout_secs: t.wait,
          api_schema: {
            url: `${c.url}/.netlify/functions/${t.path}`,
            method: 'POST',
            request_headers: { 'x-nex-clave': c.clave },
            request_body_schema: { type: 'object', properties: { [t.field]: { type: 'string', description: t.what } }, required: [t.field] },
          },
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.id) {
      say(`\n✋ ElevenLabs no aceptó la herramienta "${name}" (error ${res.status}): ${JSON.stringify(data).slice(0, 200)}`)
      say('   Agrégala a mano siguiendo la guía (docs/guia-llamadas.md) y avísame.\n')
      process.exit(1)
    }
    made[name] = data.id
    writeCallFile({ herramientas: made })
    say(`✅ Herramienta "${name}" creada.`)
  }
  const got = await fetch(`${API}/convai/agents/${agentId}`, { headers: h })
  if (!got.ok) {
    say(`\n✋ No pude leer tu agente de llamadas (error ${got.status}).\n`)
    process.exit(1)
  }
  const prompt = (await got.json()).conversation_config?.agent?.prompt ?? {}
  let text = String(prompt.prompt ?? '').trim()
  for (const part of ['negocio', ...want]) if (!text.includes(MARKS[part])) text += `\n\n${BLOCKS[part]}`
  if (!text.includes(STYLE)) text += `\n\n${STYLE}`
  const next = { ...prompt, prompt: text, tool_ids: [...new Set([...(prompt.tool_ids ?? []), ...want.map((n) => made[n])])] }
  const up = await fetch(`${API}/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ conversation_config: { agent: { prompt: next } } }),
  })
  if (!up.ok) {
    say(`\n✋ ElevenLabs no guardó el agente (error ${up.status}): ${(await up.text()).slice(0, 200)}\n`)
    process.exit(1)
  }
  // Only now may calls carry the summary: the agent knows the variable.
  writeCallFile({ negocio: true })
  say('✅ Tu agente de llamadas ya conoce el negocio: cada llamada lleva el resumen del momento.')
  say(c ? '✅ Y lo que le pidas en la llamada queda anotado para que NEX lo haga en tu Mac.' : 'ℹ️  Para que también haga lo que le pidas: conecta el portal (node scripts/llamada.mjs conectar <url>) y corre esto otra vez.')
  if (withInternet) say('✅ Y tiene internet.')
  say('\nReinicia NEX para que lo tome: Ctrl + C y npm start\n')
  process.exit(0)
}

if (cmd) {
  say('\nUso:\n  node scripts/llamada.mjs conectar <url del portal>\n  node scripts/llamada.mjs llave\n  node scripts/llamada.mjs agente [internet]\n  node scripts/llamada.mjs\n')
  process.exit(1)
}

const c = readCall()
if (!c) {
  say('\nLas llamadas todavía no tienen internet. Empieza con: node scripts/llamada.mjs conectar <url del portal>\n')
  process.exit(0)
}
say(`\nPortal: ${c.url}`)
try {
  const res = await fetch(`${c.url}/.netlify/functions/nex-pendientes`, { headers: { 'x-nex-clave': c.clave } })
  if (res.ok) say(`✅ El portal contesta. Encargos esperando: ${(await res.json()).encargos?.length ?? 0}`)
  else if (res.status === 401) say('✋ El portal no reconoce la llave: pégala en Netlify como NEX_LLAMADA_CLAVE y vuelve a publicar (Trigger deploy).')
  else say(`✋ El portal respondió ${res.status}: ¿ya publicaste la versión nueva en Netlify?`)
} catch (err) {
  say(`✋ No pude llegar al portal: ${err?.message ?? err}`)
}
say()
