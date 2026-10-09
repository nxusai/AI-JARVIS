#!/usr/bin/env node
// The API key Nexy runs on (see bridge/apikeys.mjs): the owner's own Nexy and the
// groups (client service, NXUS México, Ana Sofi) spend API credits; the owner's
// subscription stays for building with Claude Code.
//
//   node scripts/api.mjs                 asks for the key (hidden), checks it and uses it for all of Nexy
//   node scripts/api.mjs anasofi         the same, but only for one space (personal, atencion, mexico or anasofi)
//   node scripts/api.mjs estado          which spaces run on API credits
//   node scripts/api.mjs quitar [space]  back to the subscription (all, or one space)
//
// The key is typed into a hidden prompt, checked with Anthropic and saved in
// ~/.nexy/api.json, readable by this Mac's user only. It is never printed.

import { API_FILE, checkKey, KEY_SHAPE, readApiKeys, SPACES, writeApiKeys } from '../bridge/apikeys.mjs'

const [cmd, arg] = process.argv.slice(2)
const say = (s) => console.log(s)
const NAMES = { grupos: 'todo Nexy (tu Nexy personal y los grupos)', personal: 'tu Nexy personal (voz, consola, tu Telegram, rutinas)', atencion: 'atención (cliente y equipo)', mexico: 'NXUS México', anasofi: 'Ana Sofi (etiquetas)' }

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
  const keys = readApiKeys()
  say('')
  for (const s of SPACES.filter((x) => x !== 'grupos')) {
    const own = keys[s]
    say(` ${NAMES[s]}: ${own ? 'créditos de API (llave propia) ✅' : keys.grupos ? 'créditos de API ✅' : 'tu suscripción'}`)
  }
  say(' Programar con Claude: tu suscripción.\n')
  process.exit(0)
}

if (cmd === 'quitar') {
  const keys = readApiKeys()
  if (arg && SPACES.includes(arg)) delete keys[arg]
  else for (const k of Object.keys(keys)) delete keys[k]
  writeApiKeys(keys)
  say(`\n✅ ${arg && SPACES.includes(arg) ? NAMES[arg] : 'Todo Nexy'} vuelve a tu suscripción. Reinicia Nexy (Ctrl+C y npm start).\n`)
  process.exit(0)
}

const space = cmd ? cmd : 'grupos'
if (!SPACES.includes(space)) {
  say('Uso:\n  node scripts/api.mjs\n  node scripts/api.mjs personal|atencion|mexico|anasofi\n  node scripts/api.mjs estado\n  node scripts/api.mjs quitar [personal|atencion|mexico|anasofi]')
  process.exit(1)
}
say(`\nPega la API key de Claude para ${NAMES[space]} y presiona Enter. No se va a ver mientras la pegas.`)
const key = (await hidden('API key: ')).replace(/\s+/g, '')
if (!KEY_SHAPE.test(key)) {
  say('\n❌ Eso no parece una API key de Claude (empieza con sk-ant-). Cópiala completa y vuelve a correr el comando.\n')
  process.exit(1)
}
const ok = await checkKey(key)
if (ok !== true) {
  say(`\n❌ Anthropic no aceptó la llave: ${ok}\n`)
  process.exit(1)
}
writeApiKeys({ ...readApiKeys(), [space]: key })
say(`\n✅ Listo: ${NAMES[space]} → tus créditos de API (guardado en ${API_FILE}, solo tu usuario puede leerlo).`)
say('   Programar con Claude sigue con tu suscripción.')
say('   Reinicia Nexy (Ctrl+C en su ventana y npm start) para que lo tome.\n')
process.exit(0)
