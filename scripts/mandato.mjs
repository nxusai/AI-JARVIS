#!/usr/bin/env node
// Nexy's sales mandate for NXUS (see bridge/mandato.mjs).
//
//   node scripts/mandato.mjs                          how the month goes, the pipeline and the rules
//   node scripts/mandato.mjs direccion "123 Main St, Paterson, NJ 07501"
//                                                     the physical address every prospecting email must carry (US law)
//   node scripts/mandato.mjs prospectar [05:00]       her daily prospecting, Monday to Friday (the time is optional)
//   node scripts/mandato.mjs meta 1500 3000           the month's minimum and ideal (USD)
//   node scripts/mandato.mjs correos 10               first emails to prospects per day, at most

import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { monthProgress, readMandate, readPipeline, STAGES, writeMandate } from '../bridge/mandato.mjs'
import { localNow, parseTime, readRoutines } from '../bridge/routines.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const say = (s = '') => console.log(s)
const usd = (n) => `$${Number(n ?? 0).toLocaleString('en-US')}`
const ROUTINES = join(homedir(), '.nexy', 'rutinas.json')
const ZONE = process.env.NEXY_TIMEZONE?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone

const PROSPECTING =
  'Prospección diaria de NXUS AI, según tu mandato de ventas. ' +
  '1) Revisa list_pipeline: contesta lo que llegó y haz los seguimientos que tocan hoy. ' +
  '2) Busca negocios nuevos en NJ/NY (restaurantes, talleres, clínicas, distribuidores, tiendas, servicios) que ganarían con un sitio web, automatización, llamadas con IA, un CRM, contenido o anuncios: sin sitio o con uno débil, malas respuestas, sin WhatsApp. ' +
  '3) Elige los mejores hasta llenar los correos del día. Para cada uno: investígalo, agrégalo con pipeline_add y escríbele un correo corto y específico sobre SU negocio desde el correo de NXUS, con tu firma, la dirección y la línea para dejar de recibir correos. ' +
  '4) Si alguien está por cerrar, sigue el mandato: llama a Eduardo. ' +
  '5) Al final manda por Telegram un resumen de 3 líneas: a quién escribiste, quién contestó y cómo va el mes contra la meta.'

if (cmd === 'direccion') {
  const d = rest.join(' ').trim()
  if (d.length < 10) {
    say('\n❌ Escribe la dirección completa entre comillas, por ejemplo:\n   node scripts/mandato.mjs direccion "123 Main St, Paterson, NJ 07501"\n')
    process.exit(1)
  }
  writeMandate({ direccion_fisica: d })
  say(`\n✅ Dirección guardada: ${d}\n   Desde ahora Nexy puede mandar sola los primeros correos a prospectos (con esa dirección al final).\n`)
  process.exit(0)
}

if (cmd === 'meta') {
  const [min, ideal] = rest.map((x) => Number(String(x).replace(/[$,]/g, '')))
  if (!(min > 0)) {
    say('\n❌ Ejemplo: node scripts/mandato.mjs meta 1500 3000\n')
    process.exit(1)
  }
  writeMandate({ meta_minima: min, meta_ideal: ideal > min ? ideal : readMandate().meta_ideal })
  say(`\n✅ Meta del mes: mínimo ${usd(min)}${ideal > min ? `, ideal ${usd(ideal)}` : ''}.\n`)
  process.exit(0)
}

if (cmd === 'correos') {
  const n = Number(rest[0])
  if (!(n >= 1 && n <= 50)) {
    say('\n❌ Un número del 1 al 50, por ejemplo: node scripts/mandato.mjs correos 10\n')
    process.exit(1)
  }
  writeMandate({ correos_por_dia: n })
  say(`\n✅ Hasta ${n} correos nuevos a prospectos por día.\n`)
  process.exit(0)
}

if (cmd === 'prospectar') {
  const hora = parseTime(rest[0] ?? '05:00')
  if (!hora) {
    say('\n❌ Escribe la hora así: 05:00 o 6:30 am\n')
    process.exit(1)
  }
  const list = readRoutines().filter((r) => r.id !== 'prospeccion-nxus')
  const now = localNow(ZONE)
  list.push({
    id: 'prospeccion-nxus',
    nombre: 'Prospección NXUS',
    instrucciones: PROSPECTING,
    hora,
    dias: [1, 2, 3, 4, 5],
    marca: 'nxus-ai',
    activa: true,
    creada: new Date().toISOString(),
    // Not today if the hour already passed: it starts on the next working day.
    ultima: `${now.date} ${hora}`,
  })
  mkdirSync(join(homedir(), '.nexy'), { recursive: true })
  writeFileSync(`${ROUTINES}.tmp`, JSON.stringify(list, null, 2), { mode: 0o600 })
  renameSync(`${ROUTINES}.tmp`, ROUTINES)
  chmodSync(ROUTINES, 0o600)
  say(`\n✅ Prospección diaria lista: de lunes a viernes a las ${hora} (${ZONE}).`)
  if (!readMandate().direccion_fisica) say('⚠️  Falta la dirección física: sin ella Nexy te pedirá aprobar cada correo. Ponla con: node scripts/mandato.mjs direccion "…"')
  say('   Reinicia Nexy para que la tome: Ctrl + C y npm start\n')
  process.exit(0)
}

if (cmd) {
  say('\nUso:\n  node scripts/mandato.mjs\n  node scripts/mandato.mjs direccion "…"\n  node scripts/mandato.mjs prospectar [05:00]\n  node scripts/mandato.mjs meta 1500 3000\n  node scripts/mandato.mjs correos 10\n')
  process.exit(1)
}

const m = readMandate()
const p = monthProgress()
const d = readPipeline()
const by = Object.fromEntries(STAGES.map((s) => [s, d.leads.filter((l) => l.etapa === s).length]))
const routine = (() => {
  try {
    return JSON.parse(readFileSync(ROUTINES, 'utf8')).find((r) => r.id === 'prospeccion-nxus')
  } catch {
    return null
  }
})()
say(`\n📈 Este mes: ${p.clientes} cliente(s), ${usd(p.total)} · meta ${usd(p.minima)} (ideal ${usd(p.ideal)})`)
say(`🗂  Pipeline: ${STAGES.map((s) => `${s} ${by[s]}`).join(' · ')}`)
say(`✉️  Correos nuevos por día: ${m.correos_por_dia} · descuentos ${m.descuento_inicial}% → ${m.descuento_maximo}% (de ${m.descuento_paso} en ${m.descuento_paso})`)
say(`📍 Dirección: ${m.direccion_fisica || '⚠️ falta (node scripts/mandato.mjs direccion "…")'}`)
say(`⏰ Prospección diaria: ${routine ? `${routine.activa ? 'activa' : 'en pausa'}, lunes a viernes a las ${routine.hora}` : 'no instalada (node scripts/mandato.mjs prospectar)'}\n`)
