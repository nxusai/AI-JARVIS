#!/usr/bin/env node
// Nexy's backup onto the owner's external drive (see bridge/respaldo.mjs).
//
//   node scripts/respaldo.mjs configurar Lexar   once: which drive the backups go to
//   node scripts/respaldo.mjs ahora              makes one now (Nexy does it too when asked on Telegram)
//   node scripts/respaldo.mjs estado             the drive and the last backup

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { backup, readBackup, writeBackup } from '../bridge/respaldo.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const say = (s) => console.log(s)

if (cmd === 'configurar') {
  const name = rest.join(' ').replace(/^\/Volumes\//, '').replace(/\/+$/, '').trim()
  const drives = existsSync('/Volumes') ? readdirSync('/Volumes').filter((d) => d !== 'Macintosh HD' && !d.startsWith('.')) : []
  if (!name || !existsSync(join('/Volumes', name))) {
    say(`\n❌ No encuentro el disco "${name}". Conéctalo y escribe su nombre tal cual.`)
    say(`   Discos conectados: ${drives.join(', ') || 'ninguno'}\n`)
    process.exit(1)
  }
  writeBackup({ ...(readBackup() ?? {}), disco: name })
  say(`\n✅ Listo: los respaldos de Nexy irán a "${name}", en la carpeta Nexy-respaldo.`)
  say('   Haz el primero con: node scripts/respaldo.mjs ahora  (o pídeselo a Nexy por Telegram: "haz un respaldo")\n')
  process.exit(0)
}

if (cmd === 'ahora') {
  say('\nHaciendo el respaldo… (el primero tarda más por los videos; no desconectes el disco)')
  try {
    say(`\n${await backup()}\n`)
    process.exit(0)
  } catch (err) {
    say(`\n❌ ${err.message}\n`)
    process.exit(1)
  }
}

if (cmd === 'estado') {
  const cfg = readBackup()
  if (!cfg) say('\nTodavía no hay disco de respaldo. Configúralo con: node scripts/respaldo.mjs configurar Lexar\n')
  else {
    say(`\nDisco: ${cfg.disco} (${existsSync(join('/Volumes', cfg.disco)) ? 'conectado' : 'NO conectado'})`)
    say(cfg.ultimo ? `Último respaldo: ${new Date(cfg.ultimo.fecha).toLocaleString('es-MX')} · ${cfg.ultimo.archivos} archivo(s) copiados · ${cfg.ultimo.errores} error(es)\n` : 'Todavía no se ha hecho ningún respaldo.\n')
  }
  process.exit(0)
}

say('Uso:\n  node scripts/respaldo.mjs configurar Lexar\n  node scripts/respaldo.mjs ahora\n  node scripts/respaldo.mjs estado')
process.exit(cmd ? 1 : 0)
