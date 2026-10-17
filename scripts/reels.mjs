#!/usr/bin/env node
// Sets up the Reels studio's local transcription on this Mac, once.
//
//   node scripts/reels.mjs          checks FFmpeg and whisper.cpp, downloads the whisper model (~1.6 GB)
//   node scripts/reels.mjs estado   what is installed
//
// whisper.cpp hears the recordings on this Mac (free, private, fast on Apple
// silicon) so captions need no ElevenLabs key. The model goes to
// ~/.nexy/reels/modelos; nothing else is installed by this script.

import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { MODELS, findWhisper, findWhisperModel } from '../bridge/reels/motor.mjs'
import { findFfmpeg } from '../bridge/nucleo/medios.mjs'

const MODEL = process.env.NEXY_WHISPER_DESCARGA || 'ggml-large-v3-turbo.bin'
const URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL}`

const ffmpeg = findFfmpeg()
const whisper = findWhisper()
const model = findWhisperModel()
console.log(`\n FFmpeg:      ${ffmpeg ? `✅ ${ffmpeg}` : '❌ falta — instálalo con: brew install ffmpeg'}`)
console.log(` whisper.cpp: ${whisper ? `✅ ${whisper}` : '❌ falta — instálalo con: brew install whisper-cpp'}`)
console.log(` Modelo:      ${model ? `✅ ${model}` : '— todavía no'}`)

if (process.argv[2] === 'estado') process.exit(0)
if (model) {
  console.log('\n ✅ Listo: el estudio de Reels ya transcribe en esta Mac.\n')
  process.exit(0)
}

console.log(`\n Descargando el modelo de transcripción (${MODEL}, ~1.6 GB)…\n (tarda unos minutos; no cierres esta ventana)\n`)
mkdirSync(MODELS, { recursive: true })
const out = join(MODELS, MODEL)
const part = `${out}.part`
try {
  const res = await fetch(URL, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length') ?? 0)
  let got = 0
  let shown = -1
  const body = Readable.fromWeb(res.body)
  body.on('data', (b) => {
    got += b.length
    const pct = total ? Math.floor((got / total) * 100) : -1
    if (pct !== shown && pct % 5 === 0) {
      shown = pct
      process.stdout.write(`\r ${pct}% (${Math.round(got / 1048576)} MB)   `)
    }
  })
  await pipeline(body, createWriteStream(part))
  renameSync(part, out)
  console.log(`\n\n ✅ Modelo listo en ${out}`)
  console.log(whisper ? ' Reinicia Nexy (Ctrl + C y npm start) y mándale un video por Telegram.\n' : ' Falta whisper.cpp: brew install whisper-cpp, y luego reinicia Nexy.\n')
} catch (err) {
  if (existsSync(part)) rmSync(part)
  console.log(`\n ❌ No pude descargar el modelo (${err.message}). Revisa tu internet y vuelve a correr: npm run reels:setup\n`)
  process.exit(1)
}
