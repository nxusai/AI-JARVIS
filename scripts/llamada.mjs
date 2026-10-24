#!/usr/bin/env node
// NEX's phone calls with you, with internet and real work behind them.
//
//   node scripts/llamada.mjs conectar <url del portal>   makes the calls' key, saves it here and copies it
//                                                       (paste it in Netlify as NEX_LLAMADA_CLAVE)
//   node scripts/llamada.mjs llave                      copies the key again
//   node scripts/llamada.mjs agente                     gives the agent that calls you (NEXY_CALL_AGENT_ID)
//                                                       its two tools in ElevenLabs: "investigar" (internet)
//                                                       and "encargar_a_nex" (work NEX does on your Mac)
//   node scripts/llamada.mjs                            how it is set up, and whether the portal answers
//
// Only the agent that calls you gets the tools: the messenger and the receptionist, who talk to other
// people, never do. The key is never printed; the ElevenLabs key comes from ELEVENLABS_API_KEY or
// ~/.claude.json, as the bridge reads it.

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { CALL_FILE, readCall } from '../bridge/llamada.mjs'

const [cmd, arg] = process.argv.slice(2)
const say = (s = '') => console.log(s)
const API = 'https://api.elevenlabs.io/v1'
const MARK = 'HERRAMIENTAS DE NEX EN ESTA LLAMADA'
const BLOCK = `${MARK}
- Para cualquier pregunta que necesite datos actuales o que no sepas con certeza (noticias, precios, clima, empresas, personas, leyes, cualquier tema), usa la herramienta "investigar" con la pregunta completa y di su respuesta con tus palabras.
- Para cualquier cosa que haya que hacer (mandar un correo, agendar, preparar un documento, darle trabajo a Ultron o a Ana Sofi, revisar algo en sus sistemas), usa "encargar_a_nex" con la tarea completa y clara, y dile que queda anotada.
- Antes de usar una herramienta di una sola frase corta, como "Un momento.", y espera la respuesta.
- Eres NEX, hombre. Hablas en masculino, frío, calmado y directo: sin expresiones, sin exclamaciones, sin risas, sin entusiasmo. Frases completas y cortas.`

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
  const clave = readCall()?.clave ?? randomBytes(24).toString('base64url')
  mkdirSync(dirname(CALL_FILE), { recursive: true })
  writeFileSync(CALL_FILE, JSON.stringify({ url, clave }, null, 2) + '\n')
  chmodSync(CALL_FILE, 0o600)
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
  if (!c) {
    say('\n✋ Primero: node scripts/llamada.mjs conectar <url del portal>\n')
    process.exit(1)
  }
  if (!apiKey || !/^agent_\w+$/.test(agentId)) {
    say('\n✋ No encuentro la llave de ElevenLabs o NEXY_CALL_AGENT_ID en esta Terminal. Abre una pestaña nueva e inténtalo otra vez.\n')
    process.exit(1)
  }
  const h = { 'xi-api-key': apiKey, 'content-type': 'application/json' }
  const tools = [
    {
      name: 'investigar',
      description: 'Investiga en internet cualquier pregunta de Eduardo y devuelve la respuesta lista para decirla en voz alta.',
      path: 'nex-investigar',
      field: 'pregunta',
      what: 'La pregunta completa, con todo el contexto que dio Eduardo.',
      wait: 45,
    },
    {
      name: 'encargar_a_nex',
      description: 'Deja una tarea para que NEX la haga en la Mac de Eduardo con todas sus herramientas (correos, agenda, documentos, Ultron, Ana Sofi). NEX avisa por Telegram al terminar.',
      path: 'nex-encargo',
      field: 'tarea',
      what: 'La tarea completa y clara: qué hacer, para quién, cuándo y cualquier dato que dio Eduardo.',
      wait: 15,
    },
  ]
  const ids = []
  for (const t of tools) {
    const res = await fetch(`${API}/convai/tools`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        tool_config: {
          type: 'webhook',
          name: t.name,
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
      say(`\n✋ ElevenLabs no aceptó la herramienta "${t.name}" (error ${res.status}): ${JSON.stringify(data).slice(0, 200)}`)
      say('   Agrégala a mano siguiendo la guía (docs/guia-llamadas.md) y avísame.\n')
      process.exit(1)
    }
    ids.push(data.id)
    say(`✅ Herramienta "${t.name}" creada.`)
  }
  const got = await fetch(`${API}/convai/agents/${agentId}`, { headers: h })
  if (!got.ok) {
    say(`\n✋ No pude leer tu agente de llamadas (error ${got.status}).\n`)
    process.exit(1)
  }
  const prompt = (await got.json()).conversation_config?.agent?.prompt ?? {}
  const text = String(prompt.prompt ?? '')
  const next = {
    ...prompt,
    prompt: text.includes(MARK) ? text : `${text.trim()}\n\n${BLOCK}`,
    tool_ids: [...new Set([...(prompt.tool_ids ?? []), ...ids])],
  }
  const up = await fetch(`${API}/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ conversation_config: { agent: { prompt: next } } }),
  })
  say(up.ok ? '✅ Tu agente de llamadas ya tiene internet y puede dejarle trabajo a NEX.\n' : `\n✋ ElevenLabs no guardó el agente (error ${up.status}): ${(await up.text()).slice(0, 200)}\n`)
  process.exit(up.ok ? 0 : 1)
}

if (cmd) {
  say('\nUso:\n  node scripts/llamada.mjs conectar <url del portal>\n  node scripts/llamada.mjs llave\n  node scripts/llamada.mjs agente\n  node scripts/llamada.mjs\n')
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
