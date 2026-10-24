#!/usr/bin/env node
// Client projects and what they cost (see bridge/proyectos.mjs).
//
//   node scripts/proyectos.mjs              the projects, newest first, with their budget and real cost
//   node scripts/proyectos.mjs tope 40      the most one project may cost without asking again (USD)

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { PROJECTS_FILE, readProjects } from '../bridge/proyectos.mjs'

const [cmd, arg] = process.argv.slice(2)
const say = (s = '') => console.log(s)
const usd = (n) => `$${Number(n ?? 0).toFixed(2)}`

if (cmd === 'tope') {
  const n = Number(String(arg ?? '').replace(/[$,]/g, ''))
  if (!(n > 0) || n > 1000) {
    say('\n❌ Escribe el tope en dólares, por ejemplo: node scripts/proyectos.mjs tope 40\n')
    process.exit(1)
  }
  const d = readProjects()
  d.tope = n
  mkdirSync(dirname(PROJECTS_FILE), { recursive: true })
  writeFileSync(PROJECTS_FILE, JSON.stringify(d, null, 2) + '\n')
  say(`\n✅ Listo: ningún proyecto nuevo puede pasar de ${usd(n)} USD sin tu permiso.\n`)
  process.exit(0)
}

if (cmd) {
  say('\nUso:\n  node scripts/proyectos.mjs\n  node scripts/proyectos.mjs tope <dólares>\n')
  process.exit(1)
}

const d = readProjects()
say(`\nTope por proyecto: ${usd(d.tope)} USD\n`)
if (!d.proyectos.length) {
  say('Todavía no hay proyectos.\n')
  process.exit(0)
}
let total = 0
for (const p of [...d.proyectos].reverse()) {
  total += p.gastado
  const mark = { 'en-curso': '🔨', terminado: '✅', pausado: '⏸' }[p.estado] ?? '•'
  say(`${mark} ${p.creado.slice(0, 10)}  ${p.cliente} · ${p.nombre}\n   presupuesto ${usd(p.presupuesto)} · costó ${usd(p.gastado)}`)
}
say(`\nTotal en proyectos: ${usd(total)} USD\n`)
