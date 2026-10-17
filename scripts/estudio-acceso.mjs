#!/usr/bin/env node
// Puts "Estudio de Reels" on the Desktop: a shortcut that opens the editor
// (http://localhost:5180) in the browser. Nexy has to be running (npm start).
//
//   npm run estudio:acceso

import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const url = `http://localhost:${process.env.ESTUDIO_PORT || 5180}`
const file = join(homedir(), 'Desktop', 'Estudio de Reels.webloc')
writeFileSync(
  file,
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>URL</key><string>${url}</string></dict></plist>
`,
)
console.log(`\n ✅ Listo: en tu Escritorio quedó «Estudio de Reels». Doble clic y se abre el editor (${url}).`)
console.log(' Nexy tiene que estar prendida (npm start).\n')
