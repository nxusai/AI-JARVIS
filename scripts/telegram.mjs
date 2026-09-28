#!/usr/bin/env node
// Nexy on Telegram: set up the bot, see its state, or turn it off.
//
//   node scripts/telegram.mjs            asks for the bot token (hidden) and prints a pairing code
//   node scripts/telegram.mjs estado     shows the bot and who its owner is
//   node scripts/telegram.mjs olvidar    forgets the owner and prints a new pairing code
//   node scripts/telegram.mjs apagar     deletes the Telegram settings from this Mac
//
// The token comes from @BotFather in Telegram. It is typed into a hidden
// prompt, checked with Telegram, and saved in ~/.nexy/telegram.json, readable
// by this Mac's user only. It is never printed.

import { randomInt } from 'node:crypto'
import { TELEGRAM_FILE, TOKEN_SHAPE, readTelegram, removeTelegram, writeTelegram } from '../bridge/telegram-config.mjs'

const cmd = process.argv[2]
const newCode = () => String(randomInt(100000, 1000000))

async function getMe(token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const data = await res.json().catch(() => ({}))
  if (!data.ok) throw new Error(data.description ?? `HTTP ${res.status}`)
  return data.result
}

/** Read a line without showing it; from a pipe when there is no terminal. */
function hidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin
    if (!stdin.isTTY) {
      let data = ''
      stdin.setEncoding('utf8')
      stdin.on('data', (c) => (data += c))
      stdin.on('end', () => resolve(data.trim()))
      return
    }
    process.stdout.write(question)
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          return resolve(value.trim())
        }
        if (ch === '\u0003') {
          process.stdout.write('\n')
          process.exit(1)
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

const pairingHelp = (bot, code) =>
  `\n Ahora, en tu celular:\n` +
  `   1. Abre Telegram y busca @${bot}\n` +
  `   2. Toca "Iniciar" (Start)\n` +
  `   3. Mándale este código:  ${code}\n\n` +
  ` Nexy tiene que estar encendida (npm start) para recibirlo.\n`

if (cmd === 'estado') {
  const cfg = readTelegram()
  if (!cfg) {
    console.log(' Telegram no está configurado. Corre: node scripts/telegram.mjs')
    process.exit(0)
  }
  try {
    const me = await getMe(cfg.token)
    console.log(` Bot: @${me.username} — la llave funciona.`)
  } catch (err) {
    console.log(` La llave del bot no funciona (${err.message}). Vuelve a correr: node scripts/telegram.mjs`)
  }
  console.log(cfg.owner ? ` Dueño: ${cfg.owner.name || 'emparejado'}` : ` Esperando el código de emparejamiento: ${cfg.pairCode}`)
  console.log(` Respuestas: ${{ siempre: 'siempre con voz', nunca: 'siempre por escrito' }[cfg.voice] ?? 'voz si le hablas, texto si le escribes'}`)
} else if (cmd === 'olvidar') {
  const cfg = readTelegram()
  if (!cfg) {
    console.log(' Telegram no está configurado. Corre: node scripts/telegram.mjs')
    process.exit(1)
  }
  const code = newCode()
  writeTelegram({ ...cfg, owner: null, pairCode: code })
  console.log(' Listo: el bot ya no tiene dueño.')
  console.log(pairingHelp(cfg.bot ?? 'tu bot', code))
} else if (cmd === 'apagar') {
  removeTelegram()
  console.log(' Telegram quedó desconectado de esta Mac. Reinicia Nexy para que lo note.')
} else if (!cmd) {
  const token = (await hidden(' Pega la llave (token) de tu bot y presiona Enter — no se verá mientras la pegas: ')).replace(/\s+/g, '')
  if (!TOKEN_SHAPE.test(token)) {
    console.log(' Eso no parece una llave de bot de Telegram. Debe verse como 1234567890:ABC… Inténtalo otra vez.')
    process.exit(1)
  }
  let me
  try {
    me = await getMe(token)
  } catch (err) {
    console.log(` Telegram no aceptó esa llave (${err.message}). Revísala en @BotFather e inténtalo otra vez.`)
    process.exit(1)
  }
  const old = readTelegram()
  const code = newCode()
  writeTelegram({ token, bot: me.username, owner: null, pairCode: code, voice: old?.voice ?? 'auto' })
  console.log(`\n ✅ Bot conectado: @${me.username}`)
  console.log(` Guardado en ${TELEGRAM_FILE} (solo tu usuario puede leerlo).`)
  console.log(pairingHelp(me.username, code))
} else {
  console.log(' Uso: node scripts/telegram.mjs [estado | olvidar | apagar]')
  process.exit(1)
}
