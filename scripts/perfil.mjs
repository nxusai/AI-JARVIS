#!/usr/bin/env node
// The owner's profile, the second brain (see bridge/perfil.mjs).
//
//   node scripts/perfil.mjs importar ~/Downloads/perfil-eduardo.json   puts the organized profile in ~/.nexy/perfil
//   node scripts/perfil.mjs estado                                     what each compartment holds
//   node scripts/perfil.mjs abrir                                      opens the folder in Finder, to read or correct by hand
//
// Importing replaces only the compartments the file brings; whatever was there
// before is kept in ~/.nexy/perfil/anterior/<fecha>/ first.

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { COMPARTMENTS, PROFILE_DIR, profileIndex, readCompartment, writeCompartment } from '../bridge/perfil.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const say = (s) => console.log(s)

if (cmd === 'importar') {
  const file = resolve(String(rest[0] ?? '').replace(/^~(?=\/|$)/, homedir()))
  let data
  try {
    data = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    say(`\n❌ No pude leer "${rest[0] ?? ''}". Escribe la ruta del archivo, por ejemplo: node scripts/perfil.mjs importar ~/Downloads/perfil-eduardo.json\n`)
    process.exit(1)
  }
  const ids = COMPARTMENTS.map((c) => c.id)
  const entries = Object.entries(data?.compartimentos ?? {}).filter(([id, text]) => ids.includes(id) && typeof text === 'string' && text.trim())
  if (!entries.length) {
    say('\n❌ Ese archivo no trae ningún compartimento.\n')
    process.exit(1)
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const before = join(PROFILE_DIR, 'anterior', stamp)
  for (const [id, text] of entries) {
    if (readCompartment(id)) {
      mkdirSync(before, { recursive: true, mode: 0o700 })
      copyFileSync(join(PROFILE_DIR, `${id}.md`), join(before, `${id}.md`))
    }
    writeCompartment(id, text)
  }
  say(`\n✅ Perfil guardado en ${PROFILE_DIR}`)
  for (const c of profileIndex()) say(`   ${c.icono} ${c.nombre}: ${c.lineas} datos`)
  if (existsSync(before)) say(`\n   Lo que había antes quedó en ${before}`)
  say('\n   Reinicia Nexy para que lo lea: Ctrl + C y luego npm start')
  say('   Ya puedes borrar el archivo que importaste de Descargas.\n')
  process.exit(0)
}

if (cmd === 'estado') {
  const index = profileIndex()
  if (!index.length) {
    say('\nTodavía no hay perfil. Impórtalo con: node scripts/perfil.mjs importar <archivo>\n')
    process.exit(0)
  }
  say(`\nPerfil en ${PROFILE_DIR}\n`)
  for (const c of index) say(`${c.icono} ${c.nombre}${c.privado ? ' (privado)' : ''}: ${c.lineas} datos\n   ${c.temas.join(' · ')}\n`)
  process.exit(0)
}

if (cmd === 'abrir') {
  mkdirSync(PROFILE_DIR, { recursive: true, mode: 0o700 })
  execFileSync('open', [PROFILE_DIR])
  process.exit(0)
}

say('\nUso:\n  node scripts/perfil.mjs importar <archivo.json>\n  node scripts/perfil.mjs estado\n  node scripts/perfil.mjs abrir\n')
process.exit(cmd ? 1 : 0)
