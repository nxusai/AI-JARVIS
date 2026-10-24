import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { envFor } from './apikeys.mjs'
import { anaSofiMoved } from './cerebros.mjs'
import { hub } from './console.mjs'
import { anaSofiVoice as voiceFor, startAnaSofi as start } from './nucleo/anasofi.mjs'
import { readTelegram } from './telegram-config.mjs'

// Ana Sofi herself is the core's (bridge/nucleo/anasofi.mjs): she runs in the
// clients' brains too. Here she gets what is NEX's to give.
export * from './nucleo/anasofi.mjs'

/** The voice of Ana Sofi, Mi Semago's sales agent on ElevenLabs, when none is set for her. */
let agentVoice = null
async function salesAgentVoice(key) {
  if (agentVoice) return agentVoice
  try {
    const agentId = JSON.parse(readFileSync(join(homedir(), '.nexy', 'ventas.json'), 'utf8')).agentId
    if (!/^agent_\w+$/.test(String(agentId ?? ''))) return null
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, { headers: { 'xi-api-key': key } })
    if (!res.ok) return null
    agentVoice = (await res.json())?.conversation_config?.tts?.voice_id ?? null
    return agentVoice
  } catch {
    return null
  }
}

/** Her voice for a language, with the sales agent's as the last resort. */
export const anaSofiVoice = (key, lang) => voiceFor(key, lang, salesAgentVoice)

export const startAnaSofi = (o) => {
  // Telegram lets a bot answer from one place only: once she answers from a client's brain, not here.
  if (anaSofiMoved()) {
    console.log('[jarvis] Ana Sofi answers from the client\'s brain now; not starting her here')
    return Promise.resolve()
  }
  return start({
    // Billed to the API credits when a key is set (see apikeys.mjs).
    env: () => envFor('anasofi'),
    ownerId: () => readTelegram()?.owner?.id ?? null,
    hub,
    fallbackVoice: salesAgentVoice,
    ...o,
  })
}
