#!/usr/bin/env node
// The approved contact list: the only people Nexy may phone for you.
//
// This script is the only way onto the list — Nexy can read it but not change
// it — so a number from an email or a caller can never be dialled.
//
//   node scripts/contacts.mjs list
//   node scripts/contacts.mjs add "Juan Pérez" +5215512345678
//   node scripts/contacts.mjs remove "Juan Pérez"
//
// Numbers: +1 and 10 digits (US), or +52 and 10 digits (Mexico).

import {
  ALLOWED_NUMBER,
  CONTACTS_FILE,
  country,
  fold,
  normalisePhone,
  readContacts,
  writeContacts,
} from '../bridge/contact-book.mjs'

const [cmd, name, phone] = process.argv.slice(2)
const list = readContacts()

function show() {
  if (!list.length) return console.log('  (no hay contactos aprobados todavía)')
  for (const c of list) console.log(`  ${c.nombre} — ${c.telefono} (${country(c.telefono)})`)
}

if (cmd === 'add') {
  const number = normalisePhone(phone)
  if (!name?.trim() || !ALLOWED_NUMBER.test(number)) {
    console.log('Uso: node scripts/contacts.mjs add "Nombre" +1XXXXXXXXXX  (o +52 y 10 dígitos para México)')
    process.exit(1)
  }
  const kept = list.filter((c) => fold(c.nombre) !== fold(name))
  kept.push({ nombre: name.trim(), telefono: number })
  writeContacts(kept)
  console.log(` Guardado: ${name.trim()} — ${number} (${country(number)})`)
} else if (cmd === 'remove') {
  const kept = list.filter((c) => fold(c.nombre) !== fold(name))
  if (kept.length === list.length) {
    console.log(` No encontré a "${name}". Contactos actuales:`)
    show()
    process.exit(1)
  }
  writeContacts(kept)
  console.log(` Eliminado: ${name}`)
} else {
  console.log(`Contactos aprobados (${CONTACTS_FILE}):`)
  show()
}
