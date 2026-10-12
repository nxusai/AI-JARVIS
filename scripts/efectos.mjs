#!/usr/bin/env node
// Sets up Nexy's effects workshop (Remotion + Three.js) on this Mac, once.
//
//   node scripts/efectos.mjs          installs it in ~/Movies/Nexy/efectos (a few minutes, ~450 MB)
//   node scripts/efectos.mjs estado   whether it is installed, and the scenes there are
//
// Everything stays inside that folder; nothing is installed system-wide. The
// first render also downloads Remotion's own headless browser (~100 MB).

import { spawn } from 'node:child_process'
import { EFX_DIR, installed, listScenes, prepareProject } from '../bridge/efectos.mjs'

const cmd = process.argv[2]
if (cmd === 'estado') {
  console.log(installed() ? ` ✅ Taller de efectos instalado en ${EFX_DIR}` : ' Todavía no está instalado. Corre: node scripts/efectos.mjs')
  if (installed()) console.log(` Escenas: ${listScenes().join(', ') || 'ninguna todavía'}`)
  process.exit(0)
}
prepareProject()
console.log(`\n Instalando el taller de efectos en ${EFX_DIR}…\n (tarda unos minutos; no cierres esta ventana)\n`)
const p = spawn('npm', ['install', '--no-audit', '--no-fund'], { cwd: EFX_DIR, stdio: 'inherit' })
p.on('error', (err) => {
  console.log(`\n ❌ No pude correr npm (${err.message}). ¿Está instalado Node.js? Es el mismo que usa Nexy.`)
  process.exit(1)
})
p.on('close', (code) => {
  if (code === 0 && installed()) {
    console.log('\n ✅ Listo: el taller de efectos quedó instalado.')
    console.log(' Reinicia Nexy (Ctrl + C y npm start) y pídele por Telegram un video con efectos.\n')
    process.exit(0)
  }
  console.log('\n ❌ La instalación no terminó. Revisa tu internet y vuelve a correr: node scripts/efectos.mjs\n')
  process.exit(1)
})
