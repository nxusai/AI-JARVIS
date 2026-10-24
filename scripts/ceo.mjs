#!/usr/bin/env node
// NEX as the owner's CEO (see bridge/ceo.mjs).
//
//   node scripts/ceo.mjs                  the company in one look, as NEX sees it
//   node scripts/ceo.mjs activar [10:00]  her daily management meeting (Monday to Friday) and the Monday weekly report
//   node scripts/ceo.mjs quitar           back to no meetings (her other routines stay)
//   node scripts/ceo.mjs arranque no|si   her report the first time she is switched on each day (on by default)

import { chmodSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { overview, writeCeo } from '../bridge/ceo.mjs'
import { localNow, parseTime, readRoutines } from '../bridge/routines.mjs'

const [cmd, arg] = process.argv.slice(2)
const say = (s = '') => console.log(s)
const FILE = join(homedir(), '.nexy', 'rutinas.json')
const ZONE = process.env.NEXY_TIMEZONE?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone
const IDS = ['junta-diaria', 'reporte-semanal']

const DAILY =
  'Junta diaria de dirección, como CEO de Eduardo. ' +
  '1) Mira la empresa con company_overview y su perfil (prioridades de 90 días). ' +
  '2) Actúa dentro de tu mandato sin esperar: los seguimientos que tocan hoy, lo que se atoró, el trabajo que les toca a Ultron y a Ana Sofi (assign_task), los proyectos que deben moverse. ' +
  '3) Mándale a Eduardo por Telegram un reporte por departamento, máximo 6 líneas: Ventas (cómo va el mes contra la meta y quién está por cerrar), Operaciones, IAs, y "Hoy hago:" con 2 o 3 acciones tuyas. ' +
  '4) Si hay algo que de verdad necesita su decisión (un cliente por cerrar, dinero que sale, algo irreversible), dilo primero; si es urgente, llámale.'

const WEEKLY =
  'Reporte semanal de crecimiento, como CEO de Eduardo. ' +
  '1) company_overview, list_pipeline, list_projects y list_tasks: qué pasó la semana pasada. ' +
  '2) Compáralo con la meta del mes y sus prioridades de 90 días: vamos bien o no, y por qué, con números. ' +
  '3) Propón el plan de esta semana en 5 puntos concretos (a quién prospectar, qué ofrecer, qué construir, qué mejorar), y di cuáles vas a hacer tú solo. ' +
  '4) Mándalo por Telegram, claro y corto; si hay una decisión que es suya, pregúntasela al final.'

function save(list) {
  mkdirSync(join(homedir(), '.nexy'), { recursive: true })
  writeFileSync(`${FILE}.tmp`, JSON.stringify(list, null, 2), { mode: 0o600 })
  renameSync(`${FILE}.tmp`, FILE)
  chmodSync(FILE, 0o600)
}

if (cmd === 'activar') {
  const hora = parseTime(arg ?? '10:00')
  if (!hora) {
    say('\n❌ Escribe la hora así: 10:00 o 9:30 am\n')
    process.exit(1)
  }
  const [h, mm] = hora.split(':').map(Number)
  const later = `${String(h + Math.floor((mm + 20) / 60)).padStart(2, '0')}:${String((mm + 20) % 60).padStart(2, '0')}`
  const now = localNow(ZONE)
  const list = readRoutines().filter((r) => !IDS.includes(r.id))
  const base = { activa: true, marca: 'nxus-ai', creada: new Date().toISOString() }
  list.push(
    { ...base, id: 'junta-diaria', nombre: 'Junta diaria de dirección', instrucciones: DAILY, hora, dias: [1, 2, 3, 4, 5], ultima: `${now.date} ${hora}` },
    { ...base, id: 'reporte-semanal', nombre: 'Reporte semanal de crecimiento', instrucciones: WEEKLY, hora: later, dias: [1], ultima: `${now.date} ${later}` },
  )
  save(list)
  say(`\n✅ NEX CEO activa (${ZONE}):`)
  say(`   • Junta diaria de dirección: lunes a viernes a las ${hora}`)
  say(`   • Reporte semanal de crecimiento: lunes a las ${later}`)
  say('   Las hace cuando NEX está prendida (o al prenderla, si fue en las últimas 6 horas).')
  say('   Reinicia NEX para que las tome: Ctrl + C y npm start\n')
  process.exit(0)
}

if (cmd === 'arranque') {
  const on = !/^(no|off|apagar|quitar)$/i.test(String(arg ?? ''))
  writeCeo({ arranque: on })
  say(on ? '\n✅ Al prenderla por primera vez en el día, NEX te manda su reporte por Telegram.\n' : '\n✅ Listo: ya no manda el reporte al prenderla.\n')
  process.exit(0)
}

if (cmd === 'quitar') {
  save(readRoutines().filter((r) => !IDS.includes(r.id)))
  say('\n✅ Quité la junta diaria y el reporte semanal. Sus otras rutinas siguen igual.\n')
  process.exit(0)
}

if (cmd) {
  say('\nUso:\n  node scripts/ceo.mjs\n  node scripts/ceo.mjs activar [10:00]\n  node scripts/ceo.mjs quitar\n  node scripts/ceo.mjs arranque no|si\n')
  process.exit(1)
}

say('\n' + overview() + '\n')
