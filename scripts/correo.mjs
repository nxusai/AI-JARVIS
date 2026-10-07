#!/usr/bin/env node
// A company's own mailbox for Nexy (see bridge/correos.mjs).
//
//   node scripts/correo.mjs conectar mi-semago info@misemago.com
//        opens Google in the browser: sign in with that address and allow it.
//        Checks Google really signed in to that address before keeping it.
//   node scripts/correo.mjs estado            which mailboxes are connected
//   node scripts/correo.mjs quitar mi-semago  disconnects it (deletes its sign-in on this Mac)
//
// Uses the same Google app as the owner's Gmail (~/.gmail-mcp/gcp-oauth.keys.json).
// Restart Nexy afterwards (Ctrl+C, then npm start) so she picks it up.

import { spawn } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readBrands } from '../bridge/brands.mjs'
import { GMAIL_DIR, GMAIL_PACKAGE, readMailboxes, serverOf, writeMailboxes } from '../bridge/correos.mjs'

const [cmd, marca, email] = process.argv.slice(2)
const KEYS = join(GMAIL_DIR, 'gcp-oauth.keys.json')

const fail = (msg) => {
  console.log(`\n❌ ${msg}\n`)
  process.exit(1)
}

/** How the owner's Gmail is started, from the Claude config, so both run the same server. */
function gmailCommand() {
  try {
    const cfg = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'))
    const g = cfg.mcpServers?.gmail ?? cfg.projects?.[homedir()]?.mcpServers?.gmail
    if (g?.command && Array.isArray(g.args) && g.args.length) return { command: g.command, args: g.args }
  } catch {
    // no Claude config: the default below
  }
  return { command: 'npx', args: ['-y', GMAIL_PACKAGE] }
}

/** The address a sign-in belongs to, refreshing its access once if needed. */
async function whoIs(credsPath) {
  const creds = JSON.parse(readFileSync(credsPath, 'utf8'))
  const ask = (token) => fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { authorization: `Bearer ${token}` } })
  let res = creds.access_token ? await ask(creds.access_token) : null
  if (!res || res.status === 401) {
    const keys = JSON.parse(readFileSync(KEYS, 'utf8'))
    const k = keys.installed ?? keys.web
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: k.client_id, client_secret: k.client_secret, refresh_token: creds.refresh_token ?? '', grant_type: 'refresh_token' }),
    })
    const t = await r.json().catch(() => ({}))
    if (!t.access_token) throw new Error(`Google no aceptó la sesión (${t.error ?? r.status})`)
    res = await ask(t.access_token)
  }
  const data = await res.json().catch(() => ({}))
  if (!data.emailAddress) throw new Error(`Gmail respondió ${res.status}`)
  return String(data.emailAddress).toLowerCase()
}

if (cmd === 'estado') {
  const list = readMailboxes()
  if (!list.length) console.log('\nNo hay correos de empresas conectados. (Tu Gmail sigue igual.)\n')
  for (const b of list) console.log(`${existsSync(b.credenciales) ? '✅' : '⚠️ sin sesión'}  ${b.marca} · ${b.email} · herramientas ${serverOf(b.marca)}`)
  process.exit(0)
}

if (cmd === 'quitar') {
  const list = readMailboxes()
  const b = list.find((x) => x.marca === marca)
  if (!b) fail(`No hay un correo conectado para "${marca ?? ''}".`)
  rmSync(b.credenciales, { force: true })
  writeMailboxes(list.filter((x) => x !== b))
  console.log(`\n✅ Desconecté ${b.email}. Reinicia Nexy (Ctrl+C y npm start).\n`)
  process.exit(0)
}

if (cmd !== 'conectar') {
  console.log('Uso:\n  node scripts/correo.mjs conectar mi-semago info@misemago.com\n  node scripts/correo.mjs estado\n  node scripts/correo.mjs quitar mi-semago')
  process.exit(cmd ? 1 : 0)
}

const company = readBrands().marcas.find((b) => b.id === marca)
if (!company) fail(`No conozco la empresa "${marca ?? ''}". Usa su id, por ejemplo: mi-semago, vayro, abuelito-cheese.`)
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) fail('Falta el correo. Ejemplo: node scripts/correo.mjs conectar mi-semago info@misemago.com')
if (!existsSync(KEYS)) fail(`No encuentro ${KEYS}: es la llave de Google de tu Gmail. Conecta primero tu Gmail como la vez pasada.`)
const wanted = email.toLowerCase()
const archivo = `${marca}.json`
const creds = join(GMAIL_DIR, archivo)

console.log(`\nConectando el correo de ${company.nombre}: ${wanted}`)
console.log('Se va a abrir Google en el navegador.')
console.log(`👉 Escoge (o inicia sesión con) ${wanted} — NO tu correo personal — y dale Permitir/Continuar.\n`)

const { command, args } = gmailCommand()
const before = existsSync(creds) ? readFileSync(creds, 'utf8') : null
const code = await new Promise((resolve) => {
  const p = spawn(command, [...args, 'auth'], { cwd: homedir(), stdio: 'inherit', env: { ...process.env, GMAIL_CREDENTIALS_PATH: creds } })
  p.on('error', () => resolve(1))
  p.on('close', resolve)
})
if (code !== 0 || !existsSync(creds) || readFileSync(creds, 'utf8') === before) fail('Google no terminó de conectar. Vuelve a correr el mismo comando.')
chmodSync(creds, 0o600)

let got
try {
  got = await whoIs(creds)
} catch (err) {
  rmSync(creds, { force: true })
  fail(`No pude comprobar la cuenta: ${err.message}. Vuelve a correr el mismo comando.`)
}
if (got !== wanted) {
  rmSync(creds, { force: true })
  fail(`Entraste con ${got}, no con ${wanted}. No lo guardé. Vuelve a correr el comando y escoge ${wanted}.`)
}

writeMailboxes([...readMailboxes().filter((b) => b.marca !== marca && b.email !== wanted), { marca, email: wanted, archivo }])
console.log(`\n✅ Listo: ${wanted} conectado como el correo de ${company.nombre}.`)
console.log('Reinicia Nexy (Ctrl+C en su ventana y luego npm start) para que lo use.\n')
process.exit(0)
