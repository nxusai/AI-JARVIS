#!/usr/bin/env node
// Nexy always on, on the Mac that stays at home.
//
//   node scripts/siempre.mjs            starts Nexy now and every time this Mac starts up,
//                                       and brings her back if she ever stops
//   node scripts/siempre.mjs estado     is she running, and the last lines of her log
//   node scripts/siempre.mjs quitar     back to starting her by hand with npm start
//
// A LaunchAgent for this user: no admin password, nothing system-wide. It
// loads the same ~/.zshrc the Terminal does (phone numbers, agent ids, keys),
// and keeps the Mac from dozing off while Nexy runs. Closing the lid still
// sleeps a laptop; this is meant for a Mac that stays open and plugged in.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, userInfo } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LABEL = 'org.nxusai.nexy'
const HOME = homedir()
const PLIST = join(HOME, 'Library', 'LaunchAgents', `${LABEL}.plist`)
const LOG_DIR = join(HOME, 'Library', 'Logs', 'Nexy')
const LOG = join(LOG_DIR, 'nexy.log')
const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOMAIN = `gui/${userInfo().uid}`

const say = (s = '') => console.log(s)
const launchctl = (...args) => spawnSync('launchctl', args, { encoding: 'utf8' })
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const sh = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`
const running = () => launchctl('print', `${DOMAIN}/${LABEL}`).status === 0

function instalar() {
  if (process.platform !== 'darwin') return say('\nEsto es solo para Mac.\n')
  if (!existsSync(join(APP, 'node_modules'))) return say(`\n✋ Primero instala Nexy aquí: cd ${APP} && npm install\n`)
  const busy = spawnSync('lsof', ['-ti', 'tcp:8787'], { encoding: 'utf8' }).stdout.trim()
  if (busy && !running()) return say('\n✋ Nexy ya está abierta en una Terminal. Ciérrala (Ctrl+C) y vuelve a correr esto.\n')

  mkdirSync(LOG_DIR, { recursive: true })
  // A log that has grown past 20 MB starts over.
  if (existsSync(LOG) && statSync(LOG).size > 20 * 1024 * 1024) writeFileSync(LOG, '')
  // The Mac starts this without a Terminal: put this Node (and Homebrew's) on the PATH, then the owner's settings.
  const command =
    `export PATH=${sh([dirname(process.execPath), '/opt/homebrew/bin', '/usr/local/bin'].join(':'))}:"$PATH"; ` +
    `source ~/.zprofile >/dev/null 2>&1; source ~/.zshrc >/dev/null 2>&1; cd ${sh(APP)} && exec ${sh(process.execPath)} scripts/start.mjs`
  const args = ['/usr/bin/caffeinate', '-i', '/bin/zsh', '-c', command]
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((a) => `    <string>${xml(a)}</string>`).join('\n')}
  </array>
  <key>WorkingDirectory</key><string>${xml(APP)}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>${xml(LOG)}</string>
  <key>StandardErrorPath</key><string>${xml(LOG)}</string>
</dict>
</plist>
`
  if (running()) launchctl('bootout', `${DOMAIN}/${LABEL}`)
  mkdirSync(dirname(PLIST), { recursive: true })
  writeFileSync(PLIST, plist)
  const r = launchctl('bootstrap', DOMAIN, PLIST)
  if (r.status !== 0 && !running()) return say(`\n✋ macOS no la dejó arrancar: ${(r.stderr || r.stdout).trim()}\n`)
  say('\n✅ Listo: Nexy ya está prendida y se prende sola cada vez que esta Mac arranque.')
  say('   Si algo la tumba, se vuelve a levantar en 30 segundos.')
  say('   Ya no uses npm start en esta Mac. Para ver cómo va: node scripts/siempre.mjs estado\n')
}

function estado() {
  say(running() ? '\n🟢 Nexy está prendida (modo siempre).' : existsSync(PLIST) ? '\n🟡 Instalada, pero no está corriendo ahora.' : '\n⚪ Modo siempre no instalado.')
  if (existsSync(LOG)) {
    const lines = readFileSync(LOG, 'utf8').trim().split('\n').slice(-15)
    say(`\nÚltimas líneas (${LOG}):\n${lines.join('\n')}`)
  }
  say()
}

function quitar() {
  if (running()) launchctl('bootout', `${DOMAIN}/${LABEL}`)
  if (existsSync(PLIST)) rmSync(PLIST)
  say('\n⏹️  Listo: Nexy ya no se prende sola. Para usarla: npm start\n')
}

const cmd = process.argv[2]
if (!cmd || cmd === 'instalar') instalar()
else if (cmd === 'estado') estado()
else if (cmd === 'quitar') quitar()
else say('\nUso: node scripts/siempre.mjs [estado|quitar]\n')
