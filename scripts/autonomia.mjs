#!/usr/bin/env node
// How much Nexy decides on her own (see bridge/autonomia.mjs).
//
//   node scripts/autonomia.mjs              her mode, and what she did on her own today
//   node scripts/autonomia.mjs socia        she runs the day-to-day and tells you after (default)
//   node scripts/autonomia.mjs asistente    back to asking for every tap
//   node scripts/autonomia.mjs tope 10      her own projects up to this many dollars of credits start without asking

import { readAutonomy, recentAutonomous, writeAutonomy } from '../bridge/autonomia.mjs'

const [cmd, arg] = process.argv.slice(2)
const say = (s = '') => console.log(s)

if (cmd === 'socia' || cmd === 'asistente') {
  writeAutonomy({ nivel: cmd })
  say(cmd === 'socia' ? '\n✅ Modo socia: Nexy lleva el día a día sola y te avisa después. Lo tuyo sigue esperando tu toque.' : '\n✅ Modo asistente: Nexy vuelve a pedirte permiso para todo lo que sale de tu Mac.')
  say('   Reinicia Nexy para que lo tome: Ctrl + C y npm start\n')
  process.exit(0)
}
if (cmd === 'tope') {
  const n = Number(String(arg ?? '').replace(/[$,]/g, ''))
  if (!(n >= 0)) {
    say('\n❌ Escribe el tope en dólares, por ejemplo: node scripts/autonomia.mjs tope 10\n')
    process.exit(1)
  }
  writeAutonomy({ tope_proyecto: n })
  say(`\n✅ Sus proyectos de hasta $${n} en créditos arrancan sin preguntarte (te dice el costo).\n`)
  process.exit(0)
}
if (cmd) {
  say('\nUso:\n  node scripts/autonomia.mjs\n  node scripts/autonomia.mjs socia | asistente\n  node scripts/autonomia.mjs tope 10\n')
  process.exit(1)
}
const a = readAutonomy()
const hoy = recentAutonomous(24)
say(`\nModo: ${a.nivel} · proyectos sin preguntar hasta $${a.tope_proyecto}`)
say(hoy.length ? `Lo que hizo sola en las últimas 24 horas (${hoy.length}):\n${hoy.slice(0, 20).map((r) => `  • ${r.at.slice(11, 16)} ${r.hizo}`).join('\n')}` : 'En las últimas 24 horas no ha hecho nada sola todavía.')
say()
