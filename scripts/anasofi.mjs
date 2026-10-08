#!/usr/bin/env node
// Ana Sofi's own bot on Telegram, for the clients' Zebra labels (see bridge/anasofi.mjs).
//
//   node scripts/anasofi.mjs           asks for the bot's token (hidden) and saves it
//   node scripts/anasofi.mjs estado    shows the bot, its group and the label sets
//   node scripts/anasofi.mjs apagar    disconnects the bot (the labels and their history stay)
//
// A bot of its own, made with @BotFather. The token is typed into a hidden
// prompt, checked with Telegram and saved in ~/.nexy/anasofi.json, readable by
// this Mac's user only. It is never printed.

import { rmSync } from 'node:fs'
import { ANASOFI_FILE, readAnaSofi, writeAnaSofi } from '../bridge/anasofi.mjs'
import { listClients } from '../bridge/etiquetas.mjs'
import { TOKEN_SHAPE } from '../bridge/telegram-config.mjs'

const cmd = process.argv[2]

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

if (cmd === 'estado') {
  const cfg = readAnaSofi()
  if (!cfg) {
    console.log(' El bot de Ana Sofi no está configurado. Corre: node scripts/anasofi.mjs')
    process.exit(0)
  }
  try {
    const me = await getMe(cfg.token)
    console.log(` Bot: @${me.username} — la llave funciona.`)
    console.log(me.can_read_all_group_messages ? ' Lee todos los mensajes del grupo ✅' : ' ⚠️ Todavía no lee todos los mensajes: en @BotFather → /setprivacy → elige el bot → Disable, y vuelve a agregarlo al grupo.')
  } catch (err) {
    console.log(` La llave del bot no funciona (${err.message}). Vuelve a correr: node scripts/anasofi.mjs`)
  }
  console.log(` Grupo de etiquetas: ${cfg.grupo ? 'vinculado ✅' : 'falta (escribe /etiquetas dentro del grupo)'}`)
  console.log(` Etiquetas: ${listClients().map((c) => `${c.nombre} (${c.productos.length})`).join(', ')}`)
  process.exit(0)
} else if (cmd === 'apagar') {
  rmSync(ANASOFI_FILE, { force: true })
  console.log(' El bot de Ana Sofi quedó desconectado de esta Mac. Las etiquetas y su historial se quedan guardados. Reinicia Nexy.')
  process.exit(0)
} else if (!cmd) {
  const token = (await hidden(' Pega la llave (token) del bot de Ana Sofi y presiona Enter — no se verá mientras la pegas: ')).replace(/\s+/g, '')
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
  const old = readAnaSofi()
  writeAnaSofi({ token, bot: me.username, grupo: old?.grupo ?? null })
  console.log(`\n ✅ Bot de Ana Sofi conectado: @${me.username}`)
  console.log(` Guardado en ${ANASOFI_FILE} (solo tu usuario puede leerlo).`)
  if (!me.can_read_all_group_messages) console.log(' ⚠️ Falta: en @BotFather → /setprivacy → elige este bot → Disable (para que lea todo lo del grupo).')
  console.log(' Siguiente: reinicia Nexy (npm start), agrega el bot al grupo y escribe /etiquetas dentro del grupo.')
  process.exit(0)
} else {
  console.log(' Uso: node scripts/anasofi.mjs [estado | apagar]')
  process.exit(1)
}
