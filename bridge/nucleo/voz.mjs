/**
 * Speaking: which language a text is in, the text as it should be heard, and
 * ElevenLabs saying it in that language.
 */

/** Voice notes are for listening, not for reading an essay aloud. */
const MAX_SPOKEN = 2500

export const VOICE_ID = /^\w{10,40}$/

/** Text as it should be heard: no links, no markup, nothing read out symbol by symbol. */
export function forSpeech(text) {
  return String(text ?? '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>|~]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, MAX_SPOKEN)
}

/** Spanish or English, by the words it uses. */
export function languageOf(text) {
  const t = ` ${String(text).toLowerCase()} `
  const count = (words) => words.reduce((n, w) => n + (t.split(new RegExp(`[^a-záéíóúñü]${w}[^a-záéíóúñü]`)).length - 1), 0)
  const es = count(['que', 'el', 'la', 'los', 'las', 'de', 'para', 'con', 'por', 'una', 'es', 'está', 'y', 'tu', 'te', 'ya', 'sí', 'aquí']) + (/[ñ¿¡áéíóú]/.test(t) ? 3 : 0)
  const en = count(['the', 'and', 'you', 'your', 'is', 'are', 'to', 'of', 'for', 'with', 'it', 'this', 'that', 'here', 'yes', 'i', 'we', 'can'])
  return en > es ? 'en' : 'es'
}

/**
 * Text to speech with the language set, so a voice made in one language does
 * not carry its accent into the other. Turbo v2.5 is the model that takes the
 * language; a voice note can wait the extra moment for its better sound.
 */
export async function speakAs(key, voiceId, text, lang) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      language_code: lang,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0, use_speaker_boost: true },
    }),
  })
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return Buffer.from(await res.arrayBuffer())
}
