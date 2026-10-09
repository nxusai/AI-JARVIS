#!/usr/bin/env node
// Ana Sofi's own bot on Telegram, for the clients' Zebra labels (see bridge/anasofi.mjs).
//
//   node scripts/anasofi.mjs           asks for the bot's token (hidden) and saves it
//   node scripts/anasofi.mjs estado    shows the bot, its group and the label sets
//   node scripts/anasofi.mjs apagar    disconnects the bot (the labels and their history stay)
//   node scripts/anasofi.mjs carpeta [correo]   the Google Drive folder the printer's computer opens the programs from
//
// A bot of its own, made with @BotFather. The token is typed into a hidden
// prompt, checked with Telegram and saved in ~/.nexy/anasofi.json, readable by
// this Mac's user only. It is never printed.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { ANASOFI_FILE, anaSofiVoice, readAnaSofi, writeAnaSofi } from '../bridge/anasofi.mjs'
import { listClients, publish, readLabelConfig, sharedFolder, writeLabelConfig } from '../bridge/etiquetas.mjs'
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
  // The same ElevenLabs key Nexy uses (the elevenlabs MCP server's).
  let key = process.env.ELEVENLABS_API_KEY ?? null
  try {
    key ??= JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8')).mcpServers?.elevenlabs?.env?.ELEVENLABS_API_KEY ?? null
  } catch {}
  const voz = await anaSofiVoice(key)
  console.log(` Voz (para contestar notas de voz): ${voz ? 'la de Ana Sofi en ElevenLabs ✅' : key ? '⚠️ no encontré la voz de Ana Sofi (¿está conectada la agente de ventas? node scripts/ana-sofi.mjs estado); contestará solo con texto' : '⚠️ falta la llave de ElevenLabs; contestará solo con texto'}`)
  console.log(` Carpeta compartida: ${sharedFolder() ?? (readLabelConfig().carpeta ? `${readLabelConfig().carpeta} — NO la encuentro (¿Google Drive abierto?)` : 'falta (node scripts/anasofi.mjs carpeta)')}`)
  console.log(` Etiquetas: ${listClients().map((c) => `${c.nombre} (${c.productos.length})`).join(', ')}`)
  process.exit(0)
} else if (cmd === 'apagar') {
  rmSync(ANASOFI_FILE, { force: true })
  console.log(' El bot de Ana Sofi quedó desconectado de esta Mac. Las etiquetas y su historial se quedan guardados. Reinicia Nexy.')
  process.exit(0)
} else if (cmd === 'carpeta') {
  // Google Drive for desktop keeps each account under ~/Library/CloudStorage/GoogleDrive-<correo>.
  const want = (process.argv[3] ?? '').toLowerCase()
  const cloud = join(homedir(), 'Library', 'CloudStorage')
  const drives = existsSync(cloud) ? readdirSync(cloud).filter((d) => d.startsWith('GoogleDrive-')) : []
  const drive = want ? drives.find((d) => d.toLowerCase().includes(want)) : (drives.find((d) => /misemago/i.test(d)) ?? (drives.length === 1 ? drives[0] : null))
  if (!drive) {
    console.log(drives.length ? ` Hay varias cuentas de Google Drive: ${drives.map((d) => d.slice(12)).join(', ')}.\n Escribe cuál: node scripts/anasofi.mjs carpeta correo@ejemplo.com` : ' No encuentro Google Drive en esta Mac. Abre la app Google Drive (inicia sesión con la cuenta de Mi Semago) y vuelve a correr esto.')
    process.exit(1)
  }
  const root = ['My Drive', 'Mi unidad'].map((n) => join(cloud, drive, n)).find((p) => existsSync(p))
  if (!root) {
    console.log(` No encuentro "Mi unidad" dentro de ${drive}. Abre la app Google Drive, espera a que termine de cargar y vuelve a intentarlo.`)
    process.exit(1)
  }
  const carpeta = join(root, 'Etiquetas Mi Semago')
  mkdirSync(carpeta, { recursive: true })
  writeLabelConfig({ ...readLabelConfig(), carpeta })
  for (const c of listClients()) {
    const { shared } = publish(c, 'primera versión en la carpeta')
    console.log(` ✅ ${c.nombre} → ${shared.split('/').pop()}`)
  }
  console.log(`\n Carpeta lista: ${carpeta}`)
  console.log(' (En Google Drive se ve como "Mi unidad › Etiquetas Mi Semago".) Cada vez que Ana Sofi publique, el programa se actualiza ahí solo.')
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
  console.log(' Uso: node scripts/anasofi.mjs [estado | apagar | carpeta [correo]]')
  process.exit(1)
}
