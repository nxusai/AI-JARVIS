#!/usr/bin/env node
// Make Nexy's phone agents hold up on a noisy line.
//
//   node scripts/voz-llamadas.mjs           shows, then applies, the changes
//   node scripts/voz-llamadas.mjs ver       only shows the current settings
//
// For the messenger (NEXY_MESSENGER_AGENT_ID) and the agent that calls the
// owner (NEXY_CALL_AGENT_ID), in ElevenLabs:
//   - the message ({{nexy_brief}}) written into her instructions, so an
//     interrupted greeting never loses it;
//   - turn eagerness "patient": she waits for the person to really finish,
//     instead of jumping in at every noise;
//   - the first message cannot be interrupted, so the message is always said
//     in full, even on speaker in a noisy room.
//
//   - the same brain and speed as Ana Sofi, the Mi Semago sales agent: her
//     LLM and her voice model and latency settings are copied over (each agent
//     keeps its own voice and its own instructions). The receptionist
//     (NEXY_RECEPTION_AGENT_ID) gets this too.
//
// It only changes settings the agent already has, found by name in its
// configuration, so a renamed or missing setting is reported, never guessed.
// The ElevenLabs key comes from ELEVENLABS_API_KEY or ~/.claude.json, as the
// bridge reads it; it is never printed.

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API = 'https://api.elevenlabs.io/v1/convai/agents'
const WANT = { turn_eagerness: 'patient', disable_first_message_interruptions: true }
const onlyShow = process.argv[2] === 'ver'
const RECEPTION = 'Nexy Recepcionista (llamadas que no contestas)'
const MESSAGE_BLOCK = `MENSAJE DE ESTA LLAMADA: {{nexy_brief}}
- Ese es el mensaje que tienes que dar en esta llamada. Si te interrumpen, si hubo ruido o si te piden que lo repitas, dilo otra vez completo y con calma.
- Ignora ruidos, sonidos, palabras sueltas o frases sin sentido: no les respondas y nunca digas que no tienes mensaje.`

function key() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim()
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'))
    return cfg.mcpServers?.elevenlabs?.env?.ELEVENLABS_API_KEY?.trim() ?? null
  } catch {
    return null
  }
}

/** Every place a setting lives in the config, as a path of keys. */
function findPaths(obj, name, path = [], out = []) {
  if (!obj || typeof obj !== 'object') return out
  for (const [k, v] of Object.entries(obj)) {
    if (k === name) out.push([...path, k])
    else if (v && typeof v === 'object' && !Array.isArray(v)) findPaths(v, name, [...path, k], out)
  }
  return out
}

const get = (obj, path) => path.reduce((o, k) => o?.[k], obj)
function setIn(target, path, value) {
  let o = target
  for (const k of path.slice(0, -1)) o = o[k] ??= {}
  o[path.at(-1)] = value
}

/** What makes Ana Sofi quick: her LLM and how her voice is generated. */
const FROM_ANA = [
  ['agent', 'prompt', 'llm'],
  ['tts', 'model_id'],
  ['tts', 'optimize_streaming_latency'],
  ['tts', 'speed'],
]

async function anaSofi(apiKey) {
  let id = null
  try {
    id = JSON.parse(readFileSync(join(homedir(), '.nexy', 'ventas.json'), 'utf8')).agentId
  } catch {}
  if (!/^agent_\w+$/.test(String(id ?? ''))) return null
  const res = await fetch(`${API}/${id}`, { headers: { 'xi-api-key': apiKey } })
  if (!res.ok) return null
  return (await res.json()).conversation_config ?? null
}

async function fix(label, id, apiKey, ana) {
  console.log(`\n— ${label} (${id})`)
  const res = await fetch(`${API}/${id}`, { headers: { 'xi-api-key': apiKey } })
  if (!res.ok) return console.log(`  ✋ No pude leer la agente (error ${res.status}).`)
  const agent = await res.json()
  const conv = agent.conversation_config ?? {}
  const patch = {}
  let changes = 0
  for (const [name, value] of Object.entries(WANT)) {
    const paths = findPaths(conv, name)
    if (!paths.length) {
      console.log(`  ⚠️  ${name}: esta agente no tiene ese ajuste (ElevenLabs pudo cambiarle el nombre).`)
      continue
    }
    for (const p of paths) {
      const now = get(conv, p)
      if (now === value) {
        console.log(`  ✅ ${p.join('.')} ya está en ${JSON.stringify(value)}`)
        continue
      }
      console.log(`  ${onlyShow ? '•' : '🔧'} ${p.join('.')}: ${JSON.stringify(now)} → ${JSON.stringify(value)}`)
      setIn(patch, p, value)
      changes++
    }
  }
  // The message has to be in her instructions, not only in her greeting: a
  // greeting cut short by a noise or an interruption is otherwise lost.
  const promptObj = get(conv, ['agent', 'prompt'])
  const prompt = String(promptObj?.prompt ?? '')
  // Ana Sofi's brain and speed, settings this agent already has only.
  const copied = {}
  if (ana) {
    for (const path of FROM_ANA) {
      const want = get(ana, path)
      const now = get(conv, path)
      if (want === undefined || now === undefined) continue
      if (JSON.stringify(want) === JSON.stringify(now)) {
        console.log(`  ✅ ${path.join('.')} ya es igual que Ana Sofi (${JSON.stringify(want)})`)
        continue
      }
      console.log(`  ${onlyShow ? '•' : '🔧'} ${path.join('.')}: ${JSON.stringify(now)} → ${JSON.stringify(want)} (como Ana Sofi)`)
      copied[path.join('.')] = want
      changes++
    }
  }
  if (copied['tts.model_id'] !== undefined || copied['tts.optimize_streaming_latency'] !== undefined || copied['tts.speed'] !== undefined) {
    const tts = { ...(conv.tts ?? {}) }
    for (const k of ['model_id', 'optimize_streaming_latency', 'speed']) if (copied[`tts.${k}`] !== undefined) tts[k] = copied[`tts.${k}`]
    patch.tts = { ...(patch.tts ?? {}), ...tts }
  }
  // One merged prompt object, so the LLM and the message block never undo each other.
  const nextPrompt = { ...(promptObj ?? {}) }
  if (copied['agent.prompt.llm'] !== undefined) nextPrompt.llm = copied['agent.prompt.llm']
  if (promptObj && !/\{\{\s*nexy_brief\s*\}\}/.test(prompt) && label !== RECEPTION) {
    console.log(`  ${onlyShow ? '•' : '🔧'} system prompt: le agrego el mensaje ({{nexy_brief}}) para que nunca lo olvide`)
    nextPrompt.prompt = `${prompt.trim()}\n\n${MESSAGE_BLOCK}`
    changes++
  } else if (promptObj && label !== RECEPTION) {
    console.log('  ✅ system prompt ya tiene el mensaje ({{nexy_brief}})')
  }
  if (promptObj && (nextPrompt.llm !== promptObj.llm || nextPrompt.prompt !== promptObj.prompt)) setIn(patch, ['agent', 'prompt'], nextPrompt)
  const llm = get(conv, ['agent', 'prompt', 'llm'])
  if (llm && !ana) console.log(`  ℹ️  Modelo: ${llm} (no encontré a Ana Sofi para copiarle el suyo)`)
  if (onlyShow || !changes) return
  const up = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ conversation_config: patch }),
  })
  console.log(up.ok ? `  ✅ Guardado (${changes} cambio${changes === 1 ? '' : 's'}).` : `  ✋ ElevenLabs no aceptó el cambio (error ${up.status}): ${(await up.text()).slice(0, 200)}`)
}

const apiKey = key()
if (!apiKey) {
  console.log('\n✋ No encuentro la llave de ElevenLabs en esta Mac. Corre esto en la Terminal donde corre Nexy.\n')
  process.exit(1)
}
const agents = [
  ['Nexy Mensajera (llamadas a contactos)', process.env.NEXY_MESSENGER_AGENT_ID],
  ['Nexy (llamadas a ti)', process.env.NEXY_CALL_AGENT_ID],
  [RECEPTION, process.env.NEXY_RECEPTION_AGENT_ID],
].filter(([, id]) => id && /^agent_\w+$/.test(id.trim()))
if (!agents.length) {
  console.log('\n✋ No encuentro los ids de tus agentes (NEXY_MESSENGER_AGENT_ID / NEXY_CALL_AGENT_ID). Abre una Terminal nueva e inténtalo otra vez.\n')
  process.exit(1)
}
const ana = await anaSofi(apiKey)
if (ana) console.log(`\nAna Sofi usa: LLM ${JSON.stringify(get(ana, ['agent', 'prompt', 'llm']))} · voz ${JSON.stringify(get(ana, ['tts', 'model_id']))}. Se lo copio a las agentes de Nexy.`)
else console.log('\n⚠️  No encontré a Ana Sofi (~/.nexy/ventas.json); solo aplico los demás ajustes.')
for (const [label, id] of agents) await fix(label, id.trim(), apiKey, ana)
console.log(onlyShow ? '\nSolo mostré los ajustes. Para aplicarlos: node scripts/voz-llamadas.mjs\n' : '\nListo. Haz una llamada de prueba en altavoz con algo de ruido.\n')
