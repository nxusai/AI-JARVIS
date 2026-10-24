#!/usr/bin/env node
// NEX's voice.
//
//   node scripts/voz.mjs                 which voice he uses now
//   node scripts/voz.mjs prueba          a test phrase, as the iPhone gets it: saved on the Desktop,
//                                        played here, with how loud it came out
//   node scripts/voz.mjs llamadas        his phone agents get his current voice, its flat delivery
//                                        and his name, without changing anything else
//   node scripts/voz.mjs <voice_id>      his new voice: the face, Telegram voice notes, the iPhone
//                                        and his phone agents in ElevenLabs (calls to you, the
//                                        messenger and the receptionist), which also learn his
//                                        new name, NEX
//
// The voice id is the one ElevenLabs shows under the voice (My Voices → ⋯ → Copy voice ID).
// The ElevenLabs key comes from ELEVENLABS_API_KEY or ~/.claude.json, as the bridge reads it;
// it is never printed.

import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { louder, ownVoiceId, VOICE_FILE } from '../bridge/speech.mjs'
import { findFfmpeg } from '../bridge/nucleo/medios.mjs'

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

/** How NEX talks on every call: a man, cold, no expressions. Added once. */
const STYLE_MARK = 'ESTILO DE NEX'
const STYLE = `${STYLE_MARK}
- Eres NEX, hombre: hablas de ti en masculino (listo, seguro).
- Frío, calmado y directo. Sin expresiones, sin exclamaciones, sin risas, sin entusiasmo, sin muletillas. Frases completas y cortas.`

/** His old name becomes NEX, said as a word ("Nex") on the phone. */
const rename = (s) => String(s ?? '').replace(/\bNexy\b/g, 'Nex').replace(/\bNEXY\b/g, 'NEX')

async function agent(label, agentId, apiKey, voiceId) {
  const res = await fetch(`${API}/convai/agents/${agentId}`, { headers: { 'xi-api-key': apiKey } })
  if (!res.ok) return say(`  ✋ ${label}: no pude leer la agente (error ${res.status}).`)
  const a = await res.json()
  const conv = a.conversation_config ?? {}
  // The same flat, controlled delivery as everywhere else: high stability, no style.
  const patch = { tts: { ...(conv.tts ?? {}), voice_id: voiceId, stability: 0.8, similarity_boost: 0.8, speed: 0.97 } }
  const prompt = conv.agent?.prompt
  const agentPatch = {}
  if (prompt?.prompt) {
    let text = rename(prompt.prompt)
    if (!text.includes(STYLE_MARK)) text = `${text.trim()}\n\n${STYLE}`
    if (text !== prompt.prompt) agentPatch.prompt = { ...prompt, prompt: text }
  }
  if (conv.agent?.first_message && rename(conv.agent.first_message) !== conv.agent.first_message) agentPatch.first_message = rename(conv.agent.first_message)
  if (Object.keys(agentPatch).length) patch.agent = agentPatch
  const body = { conversation_config: patch, ...(a.name && rename(a.name) !== a.name ? { name: rename(a.name) } : {}) }
  const up = await fetch(`${API}/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  say(up.ok ? `  ✅ ${label}: voz plana y fría${patch.agent || body.name ? ', nombre NEX y estilo sin expresiones' : ''}.` : `  ✋ ${label}: ElevenLabs no aceptó el cambio (error ${up.status}): ${(await up.text()).slice(0, 200)}`)
}

const apiKey = key()

if (!id) {
  const now = ownVoiceId()
  const name = await voiceName(apiKey, now)
  say(`\nNEX habla con la voz ${now}${name ? ` («${name}»)` : ''}.`)
  say('Para cambiarla: node scripts/voz.mjs <voice_id>\n')
  process.exit(0)
}

/** How loud an MP3 is, as FFmpeg measures it (mean and peak, in dB). */
function loudness(file) {
  const ff = findFfmpeg()
  if (!ff) return null
  const r = spawnSync(ff, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' })
  const mean = r.stderr.match(/mean_volume: (-?[\d.]+) dB/)?.[1]
  const max = r.stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1]
  return mean ? `${mean} dB de promedio, pico ${max} dB` : null
}

if (id === 'prueba') {
  if (!apiKey) {
    say('\n✋ No encuentro la llave de ElevenLabs en esta Terminal. Abre una pestaña nueva e inténtalo otra vez.\n')
    process.exit(1)
  }
  if (!findFfmpeg()) say('\n⚠️  No encontré FFmpeg: sin él no se le puede subir el volumen. Corre: cd ~/Desktop/nexy && npm install ffmpeg-static')
  const res = await fetch(`${API}/text-to-speech/${ownVoiceId()}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: 'Soy Nex. Así me vas a escuchar en tu iPhone. Todos los sistemas bajo control.',
      model_id: 'eleven_flash_v2_5',
      voice_settings: { stability: 0.8, similarity_boost: 0.8, style: 0, speed: 0.97, use_speaker_boost: true },
    }),
  })
  if (!res.ok) {
    say(`\n✋ ElevenLabs no generó la voz (error ${res.status}).\n`)
    process.exit(1)
  }
  const raw = Buffer.from(await res.arrayBuffer())
  const desk = join(homedir(), 'Desktop')
  const before = join(desk, 'nex-prueba-original.mp3')
  const after = join(desk, 'nex-prueba.mp3')
  writeFileSync(before, raw)
  writeFileSync(after, await louder(raw))
  say(`\nVoz original de ElevenLabs: ${loudness(before) ?? '(no la pude medir)'}`)
  say(`Como la recibe tu iPhone:  ${loudness(after) ?? '(no la pude medir)'}`)
  say('Lo normal en el iPhone es un promedio de -14 a -10 dB. Te la pongo en la Mac (la segunda)…\n')
  if (process.platform === 'darwin') {
    spawnSync('afplay', [before])
    spawnSync('afplay', [after])
  }
  say('Quedaron en tu Escritorio: nex-prueba-original.mp3 y nex-prueba.mp3\n')
  process.exit(0)
}

const callAgents = () =>
  [
    ['Llamadas a ti', process.env.NEXY_CALL_AGENT_ID],
    ['Mensajera (llamadas a contactos)', process.env.NEXY_MESSENGER_AGENT_ID],
    ['Recepcionista', process.env.NEXY_RECEPTION_AGENT_ID],
  ].filter(([, a]) => a && /^agent_\w+$/.test(a.trim()))

if (id === 'llamadas') {
  const agents = callAgents()
  if (!apiKey || !agents.length) {
    say('\n✋ No encuentro la llave de ElevenLabs o los ids de tus agentes en esta Terminal. Abre una pestaña nueva e inténtalo otra vez.\n')
    process.exit(1)
  }
  say('\nAgentes de llamadas en ElevenLabs:')
  for (const [label, a] of agents) await agent(label, a.trim(), apiKey, ownVoiceId())
  say('\nListo. Haz una llamada de prueba.\n')
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

const agents = callAgents()

if (!apiKey) say('⚠️  No encontré la llave de ElevenLabs en esta Terminal, así que no cambié la voz de las llamadas.')
else if (!agents.length) say('ℹ️  No encontré los ids de tus agentes de llamadas en esta Terminal; las llamadas siguen con su voz de antes.')
else {
  say('\nAgentes de llamadas en ElevenLabs:')
  for (const [label, a] of agents) await agent(label, a.trim(), apiKey, id)
}
say('\nReinicia NEX para que hable con su voz nueva: Ctrl + C y npm start\n')
