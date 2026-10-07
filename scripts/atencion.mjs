#!/usr/bin/env node
// Nexy's client-service bot on Telegram (see bridge/atencion.mjs).
//
//   node scripts/atencion.mjs           asks for the new bot's token (hidden) and saves it
//   node scripts/atencion.mjs estado    shows the bot and which groups are linked
//   node scripts/atencion.mjs apagar    deletes its settings from this Mac (orders and files stay)
//
// A separate bot from the owner's own Nexy, made with @BotFather. The token is
// typed into a hidden prompt, checked with Telegram and saved in
// ~/.nexy/atencion.json, readable by this Mac's user only. It is never printed.

import { rmSync } from 'node:fs'
import { ATENCION_FILE, readAtencion, writeAtencion } from '../bridge/atencion.mjs'
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
  const cfg = readAtencion()
  if (!cfg) {
    console.log(' El bot de atención no está configurado. Corre: node scripts/atencion.mjs')
    process.exit(0)
  }
  try {
    const me = await getMe(cfg.token)
    console.log(` Bot: @${me.username} — la llave funciona.`)
    console.log(me.can_read_all_group_messages ? ' Lee todos los mensajes de los grupos ✅' : ' ⚠️ Todavía no lee todos los mensajes: en @BotFather → /setprivacy → elige el bot → Disable, y vuelve a agregarlo a los grupos.')
  } catch (err) {
    console.log(` La llave del bot no funciona (${err.message}). Vuelve a correr: node scripts/atencion.mjs`)
  }
  console.log(` Grupo del cliente: ${cfg.grupos?.cliente ? 'vinculado ✅' : 'falta (escribe /cliente dentro del grupo)'}`)
  console.log(` Grupo del equipo:  ${cfg.grupos?.equipo ? 'vinculado ✅' : 'falta (escribe /equipo dentro del grupo)'}`)
} else if (cmd === 'apagar') {
  rmSync(ATENCION_FILE, { force: true })
  console.log(' El bot de atención quedó desconectado de esta Mac. Los pedidos y archivos se quedan guardados. Reinicia Nexy.')
} else if (!cmd) {
  const token = (await hidden(' Pega la llave (token) del bot de atención y presiona Enter — no se verá mientras la pegas: ')).replace(/\s+/g, '')
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
  const old = readAtencion()
  writeAtencion({ token, bot: me.username, grupos: old?.grupos ?? {}, equipo: old?.equipo ?? [] })
  console.log(`\n ✅ Bot de atención conectado: @${me.username}`)
  console.log(` Guardado en ${ATENCION_FILE} (solo tu usuario puede leerlo).`)
  if (!me.can_read_all_group_messages) console.log(' ⚠️ Falta: en @BotFather → /setprivacy → elige este bot → Disable (para que lea todo lo del grupo).')
  console.log(' Siguiente: reinicia Nexy (npm start), agrega el bot a los dos grupos y escribe /cliente o /equipo dentro de cada uno.')
} else {
  console.log(' Uso: node scripts/atencion.mjs [estado | apagar]')
  process.exit(1)
}
