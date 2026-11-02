// Genera la narración de cada escena de una lección con la voz de Lalo en ElevenLabs.
// La llave no vive en el código: el entorno la agrega sola (header xi-api-key) a cada
// llamada a api.elevenlabs.io. Solo la ven las sesiones abiertas después de guardarla.
//
//   node cursos/voz.mjs cursos/leccion-1.json          todas las escenas
//   node cursos/voz.mjs cursos/leccion-1.json 3        solo la escena 3 (para rehacer una)
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const guion = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const solo = process.argv[3]
const config = JSON.parse(readFileSync(join(RAIZ, 'config.json'), 'utf8'))
const VOZ = config.vozCurso.voice_id
const DIR = join(RAIZ, 'public', 'curso', guion.id)

for (const [i, e] of guion.escenas.entries()) {
  if (solo != null && String(i) !== solo) continue
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: e.guion, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } }),
  })
  if (!r.ok) {
    console.log(`❌ Escena ${i}: ElevenLabs respondió ${r.status} ${(await r.text()).slice(0, 200)}`)
    if (r.status === 401) console.log('   La llave no llegó: ¿esta sesión se abrió antes de guardarla? Abre un chat nuevo.')
    process.exit(1)
  }
  const wav = join(DIR, e.voz)
  mkdirSync(dirname(wav), { recursive: true })
  const mp3 = wav.replace(/\.wav$/, '.mp3')
  writeFileSync(mp3, Buffer.from(await r.arrayBuffer()))
  // Igual que la voz A: sin silencios al inicio y al final, volumen parejo.
  spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp3, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5', '-ar', '48000', wav])
  rmSync(mp3)
  console.log(`🎙️ Escena ${i}: ${e.voz}`)
}
console.log('Listo. Ahora: node cursos/leccion.mjs ' + process.argv[2] + ' --render')
