#!/usr/bin/env node
// Make Nexy's phone agents hold up on a noisy line.
//
//   node scripts/voz-llamadas.mjs           shows, then applies, the changes
//   node scripts/voz-llamadas.mjs ver       only shows the current settings
//
// For the messenger (NEXY_MESSENGER_AGENT_ID) and the agent that calls the
// owner (NEXY_CALL_AGENT_ID), in ElevenLabs:
//   - turn eagerness "patient": she waits for the person to really finish,
//     instead of jumping in at every noise;
//   - the first message cannot be interrupted, so the message is always said
//     in full, even on speaker in a noisy room.
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

async function fix(label, id, apiKey) {
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
  const prompt = String(get(conv, ['agent', 'prompt', 'prompt']) ?? '')
  if (!/\{\{\s*nexy_brief\s*\}\}/.test(prompt)) {
    console.log('  ⚠️  Su system prompt no tiene {{nexy_brief}}: si la interrumpen, no sabrá el recado. Pega el prompt nuevo que te pasó Claude.')
  }
  const llm = get(conv, ['agent', 'prompt', 'llm'])
  if (llm) console.log(`  ℹ️  Modelo: ${llm}${/haiku/i.test(String(llm)) ? ' (recomendado: cambiar a Claude Sonnet en ElevenLabs)' : ''}`)
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
].filter(([, id]) => id && /^agent_\w+$/.test(id.trim()))
if (!agents.length) {
  console.log('\n✋ No encuentro los ids de tus agentes (NEXY_MESSENGER_AGENT_ID / NEXY_CALL_AGENT_ID). Abre una Terminal nueva e inténtalo otra vez.\n')
  process.exit(1)
}
for (const [label, id] of agents) await fix(label, id.trim(), apiKey)
console.log(onlyShow ? '\nSolo mostré los ajustes. Para aplicarlos: node scripts/voz-llamadas.mjs\n' : '\nListo. Haz una llamada de prueba en altavoz con algo de ruido.\n')
