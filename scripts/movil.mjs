#!/usr/bin/env node
// NEX on the iPhone (see bridge/movil.mjs and docs/guia-movil.md).
//
//   node scripts/movil.mjs              makes the phone's key (once), copies it to the clipboard and shows the address
//   node scripts/movil.mjs llave        copies the key to the clipboard again
//   node scripts/movil.mjs nueva-llave  a new key: the old one stops working (if the phone was lost)
//   node scripts/movil.mjs estado       the address, and whether NEX's door is open
//
// The key is never printed: it goes to the clipboard, which the iPhone shares
// with this Mac (same Apple ID), to be pasted into the Shortcut.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { newPhoneKey, readPhone } from '../bridge/movil.mjs'

const [cmd] = process.argv.slice(2)
const say = (s = '') => console.log(s)

function tailscaleName() {
  for (const bin of ['tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale']) {
    if (bin.startsWith('/') && !existsSync(bin)) continue
    const r = spawnSync(bin, ['status', '--json'], { encoding: 'utf8' })
    if (r.status !== 0) continue
    try {
      const self = JSON.parse(r.stdout).Self
      return { name: String(self?.DNSName ?? '').replace(/\.$/, ''), ip: self?.TailscaleIPs?.[0] ?? '', online: self?.Online !== false }
    } catch {
      // Not JSON: an old CLI, or not signed in.
    }
  }
  return null
}

function copy(text) {
  const r = spawnSync('pbcopy', { input: text })
  return r.status === 0
}

function show(cfg) {
  const ts = tailscaleName()
  const port = cfg.puerto ?? 8789
  say('')
  if (!ts?.name) {
    say('⚠️  No encuentro Tailscale en esta Mac (o no has entrado a tu cuenta).')
    say('   Instálalo de https://tailscale.com/download, entra con tu cuenta y vuelve a correr esto.')
  } else {
    say(`📍 Dirección para el atajo:  http://${ts.name.split('.')[0]}:${port}/movil`)
    say(`   (si esa no responde, usa: http://${ts.ip}:${port}/movil)`)
  }
  say('')
}

if (cmd === 'nueva-llave') {
  const cfg = newPhoneKey()
  if (copy(cfg.llave)) say('\n🔑 Llave nueva copiada. Pégala en el atajo "NEX" del iPhone (en Authorization, después de "Bearer ").')
  else say('\n🔑 Llave nueva creada, pero no pude copiarla. Corre: node scripts/movil.mjs llave')
  say('   La anterior ya no sirve. Reinicia NEX para que la use: Ctrl + C y npm start.')
  show(cfg)
  process.exit(0)
}

if (cmd === 'llave') {
  const cfg = readPhone()
  if (!cfg) {
    say('\nTodavía no hay llave. Corre: node scripts/movil.mjs\n')
    process.exit(1)
  }
  say(copy(cfg.llave) ? '\n🔑 Llave copiada. En el iPhone, pégala en el atajo.\n' : '\n❌ No pude copiarla.\n')
  process.exit(0)
}

if (cmd === 'estado') {
  const cfg = readPhone()
  if (!cfg) {
    say('\nEl celular no está configurado. Corre: node scripts/movil.mjs\n')
    process.exit(0)
  }
  const open = spawnSync('lsof', ['-ti', `tcp:${cfg.puerto ?? 8789}`], { encoding: 'utf8' }).stdout.trim()
  say(`\nPuerta del celular: ${open ? '✅ abierta (NEX está corriendo)' : '❌ cerrada (arranca NEX con npm start)'}`)
  show(cfg)
  process.exit(0)
}

if (cmd) {
  say('\nUso:\n  node scripts/movil.mjs\n  node scripts/movil.mjs llave\n  node scripts/movil.mjs nueva-llave\n  node scripts/movil.mjs estado\n')
  process.exit(1)
}

const cfg = readPhone() ?? newPhoneKey()
say(copy(cfg.llave) ? '\n🔑 Llave del celular copiada. En el iPhone, pégala en el atajo "NEX" (en Authorization, después de "Bearer ").' : '\n🔑 Llave lista. Cópiala con: node scripts/movil.mjs llave')
say('   No la pegues en ningún chat: es la llave de entrada a NEX.')
show(cfg)
say('Reinicia NEX para abrir la puerta del celular: Ctrl + C y luego npm start\n')
