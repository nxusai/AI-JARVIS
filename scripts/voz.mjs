#!/usr/bin/env node
// NEX's voice.
//
//   node scripts/voz.mjs                 which voice she uses now
//   node scripts/voz.mjs <voice_id>      her new voice: the face, Telegram voice notes, the iPhone
//                                        and her phone agents in ElevenLabs (calls to you, the
//                                        messenger and the receptionist), which also learn her
//                                        new name, NEX
//
// The voice id is the one ElevenLabs shows under the voice (My Voices → ⋯ → Copy voice ID).
// The ElevenLabs key comes from ELEVENLABS_API_KEY or ~/.claude.json, as the bridge reads it;
// it is never printed.

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { ownVoiceId, VOICE_FILE } from '../bridge/speech.mjs'

const say = (s = '') => console.log(s)
const API = 'https://api.elevenlabs.io/v1'
const id = String(process.argv[2] ?? '').trim()

function key() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim()
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'))
    return cfg.mcpServers?.elevenlabs?.env?.ELEVENLABS_API_KEY?.trim() ?? null
  } catch {
    return null
  }
}

async function voiceName(apiKey, voiceId) {
  if (!apiKey) return null
  try {
    const res = await fetch(`${API}/voices/${voiceId}`, { headers: { 'xi-api-key': apiKey } })
    return res.ok ? ((await res.json()).name ?? '') : false
  } catch {
    return null
  }
}

/** Her old name becomes NEX, said as a word ("Nex") on the phone. */
const rename = (s) => String(s ?? '').replace(/\bNexy\b/g, 'Nex').replace(/\bNEXY\b/g, 'NEX')

async function agent(label, agentId, apiKey, voiceId) {
  const res = await fetch(`${API}/convai/agents/${agentId}`, { headers: { 'xi-api-key': apiKey } })
  if (!res.ok) return say(`  ✋ ${label}: no pude leer la agente (error ${res.status}).`)
  const a = await res.json()
  const conv = a.conversation_config ?? {}
  const patch = { tts: { ...(conv.tts ?? {}), voice_id: voiceId } }
  const prompt = conv.agent?.prompt
  const agentPatch = {}
  if (prompt?.prompt && rename(prompt.prompt) !== prompt.prompt) agentPatch.prompt = { ...prompt, prompt: rename(prompt.prompt) }
  if (conv.agent?.first_message && rename(conv.agent.first_message) !== conv.agent.first_message) agentPatch.first_message = rename(conv.agent.first_message)
  if (Object.keys(agentPatch).length) patch.agent = agentPatch
  const body = { conversation_config: patch, ...(a.name && rename(a.name) !== a.name ? { name: rename(a.name) } : {}) }
  const up = await fetch(`${API}/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  say(up.ok ? `  ✅ ${label}: voz nueva${patch.agent || body.name ? ' y su nombre ya es NEX' : ''}.` : `  ✋ ${label}: ElevenLabs no aceptó el cambio (error ${up.status}): ${(await up.text()).slice(0, 200)}`)
}

const apiKey = key()

if (!id) {
  const now = ownVoiceId()
  const name = await voiceName(apiKey, now)
  say(`\nNEX habla con la voz ${now}${name ? ` («${name}»)` : ''}.`)
  say('Para cambiarla: node scripts/voz.mjs <voice_id>\n')
  process.exit(0)
}

if (!/^\w{10,40}$/.test(id)) {
  say('\n❌ Eso no parece un voice ID de ElevenLabs (son unas 20 letras y números, por ejemplo JBFqnCBsd6RMkjVDRZzb).\n')
  process.exit(1)
}

const name = await voiceName(apiKey, id)
if (name === false) {
  say('\n❌ ElevenLabs no encuentra esa voz en tu cuenta. Revisa que esté en My Voices y copia otra vez su voice ID.\n')
  process.exit(1)
}

mkdirSync(dirname(VOICE_FILE), { recursive: true })
writeFileSync(VOICE_FILE, JSON.stringify({ voice_id: id, nombre: name || '', cambiada: new Date().toISOString() }, null, 2) + '\n')
chmodSync(VOICE_FILE, 0o600)
say(`\n✅ Voz nueva de NEX${name ? `: «${name}»` : ''} (consola, notas de voz de Telegram y el iPhone).`)

const agents = [
  ['Llamadas a ti', process.env.NEXY_CALL_AGENT_ID],
  ['Mensajera (llamadas a contactos)', process.env.NEXY_MESSENGER_AGENT_ID],
  ['Recepcionista', process.env.NEXY_RECEPTION_AGENT_ID],
].filter(([, a]) => a && /^agent_\w+$/.test(a.trim()))

if (!apiKey) say('⚠️  No encontré la llave de ElevenLabs en esta Terminal, así que no cambié la voz de las llamadas.')
else if (!agents.length) say('ℹ️  No encontré los ids de tus agentes de llamadas en esta Terminal; las llamadas siguen con su voz de antes.')
else {
  say('\nAgentes de llamadas en ElevenLabs:')
  for (const [label, a] of agents) await agent(label, a.trim(), apiKey, id)
}
say('\nReinicia NEX para que hable con su voz nueva: Ctrl + C y npm start\n')
