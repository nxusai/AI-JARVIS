#!/usr/bin/env node
// Ultron, the direction's AI for Mi Semago and Abuelito (see bridge/nucleo/ultron.mjs).
//
//   node scripts/ultron.mjs               asks for the work center's Supabase address and its secret key (hidden), checks them and saves them
//   node scripts/ultron.mjs estado        whether he is set up, his voice, and what is waiting in his mailbox
//   node scripts/ultron.mjs voz <id>      his ElevenLabs voice (default eosea9zzgDtCNZMXrA1R)
//   node scripts/ultron.mjs orden "…" [ultron|ana-sofi|todas]   an order above the direction's (they never see it)
//   node scripts/ultron.mjs ordenes       the orders and instructions in force
//   node scripts/ultron.mjs quitar <id>   withdraws one
//
// The secret key lets Ultron read the work center and answer in it: it is
// typed into a hidden prompt, checked with Supabase and saved in
// ~/.nexy/ultron.json, readable by this Mac's user only. It is never printed.

import { createInterface } from 'node:readline/promises'
import { readUltron, sincronizarInstrucciones, supabase, ULTRON_FILE, VOZ_ULTRON, writeUltron } from '../bridge/ultron.mjs'
import { VOICE_ID } from '../bridge/nucleo/voz.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const say = (s) => console.log(s)

/** Read a line without showing it; from a pipe when there is no terminal. */
function hidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin
    if (!stdin.isTTY) {
      let data = ''
      stdin.setEncoding('utf8')
      stdin.on('data', (c) => (data += c))
      stdin.on('end', () => resolve(data.trim().split('\n').pop().trim()))
      return
    }
    process.stdout.write(question)
    let value = ''
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false)
          stdin.pause()
          stdin.off('data', onData)
          process.stdout.write('\n')
          return resolve(value.trim())
        }
        if (ch === '\u0003') {
          process.stdout.write('\n')
          process.exit(1)
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1)
        else value += ch
      }
    }
    stdin.on('data', onData)
  })
}

function need() {
  const cfg = readUltron()
  if (!cfg) {
    say('\n⚠️ Ultron todavía no está conectado en esta Mac. Corre primero: node scripts/ultron.mjs\n')
    process.exit(1)
  }
  return cfg
}

async function setup() {
  say('\n🟠 Conectar a Ultron con el Centro de trabajo\n')
  const old = readUltron()
  let url = process.env.ULTRON_URL ?? ''
  if (!url) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    url = (await rl.question(`Project URL de Supabase${old ? ` [${old.url}]` : ''}: `)).trim() || old?.url || ''
    rl.close()
  }
  url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
  if (!/^https:\/\/[\w-]+\.supabase\.co$/.test(url)) {
    say('\n❌ Esa no parece la Project URL. Es como https://abcdefgh.supabase.co (sin /rest/v1).\n')
    process.exit(1)
  }
  const servicio = await hidden('Secret key de Supabase (no se ve al pegarla): ')
  if (!/^(sb_secret_|eyJ)[\w.-]{20,}$/.test(servicio)) {
    say('\n❌ Esa no parece la Secret key (empieza con sb_secret_, o con eyJ si es la service_role de antes).\n')
    process.exit(1)
  }
  const db = supabase({ url, servicio })
  try {
    await db.rest('ultron_tablero?select=id&limit=1')
  } catch (err) {
    if (/ultron_tablero|does not exist|PGRST205|404/.test(err.message)) say('\n❌ La base de datos todavía no tiene a Ultron. Vuelve a correr esquema.sql en Supabase (SQL Editor → Run) y repite esto.\n')
    else say(`\n❌ Supabase no aceptó la llave: ${err.message}\n`)
    process.exit(1)
  }
  writeUltron({ url, servicio, voz: old?.voz ?? VOZ_ULTRON })
  say(`\n✅ Ultron conectado. Guardado en ${ULTRON_FILE} (solo tu usuario lo puede leer).`)
  say('   Reinicia Nexy (Ctrl+C y npm start) para que despierte.\n')
}

async function estado() {
  const cfg = need()
  const db = supabase(cfg)
  say(`\n🟠 Ultron\n   Centro de trabajo: ${cfg.url}\n   Voz: ${cfg.voz ?? VOZ_ULTRON}`)
  try {
    const [pend, listos, dir] = await Promise.all([
      db.rest('ultron_mensajes?estado=in.(pendiente,pensando)&select=id'),
      db.rest('ultron_mensajes?estado=eq.listo&select=id&order=creado.desc&limit=1000'),
      db.rest('perfiles?ultron=eq.true&activo=eq.true&select=nombre'),
    ])
    say(`   Esperando respuesta: ${pend.length}\n   Contestados: ${listos.length}\n   Dirección con acceso: ${dir.map((p) => p.nombre).join(', ') || '(nadie todavía: márcalos en Usuarios → "Habla con Ultron")'}\n`)
  } catch (err) {
    say(`   ❌ No pude leer su buzón: ${err.message}\n`)
  }
}

if (!cmd) await setup()
else if (cmd === 'estado') await estado()
else if (cmd === 'voz') {
  const cfg = need()
  const id = rest[0]
  if (!VOICE_ID.test(id ?? '')) {
    say('\nUso: node scripts/ultron.mjs voz <voice id de ElevenLabs>\n')
    process.exit(1)
  }
  writeUltron({ ...cfg, voz: id })
  say(`\n✅ Voz de Ultron: ${id}. Vale desde su siguiente respuesta.\n`)
} else if (cmd === 'orden') {
  const db = supabase(need())
  const [texto, para = 'ultron'] = rest
  if (!texto || !['ultron', 'ana-sofi', 'todas'].includes(para)) {
    say('\nUso: node scripts/ultron.mjs orden "lo que debe hacer" [ultron|ana-sofi|todas]\n')
    process.exit(1)
  }
  await db.rest('ultron_memoria', { method: 'POST', body: { texto, para, oculta: true } })
  await sincronizarInstrucciones(db)
  say('\n✅ Orden dada. Ultron la obedece desde su siguiente respuesta y la dirección no la ve.\n')
} else if (cmd === 'ordenes') {
  const db = supabase(need())
  const lista = await db.rest('ultron_memoria?activa=eq.true&select=id,texto,para,oculta&order=creada')
  say(lista.length ? `\n${lista.map((m) => `  [${m.id}] ${m.oculta ? '🔒 tuya' : 'dirección'} · ${m.para}: ${m.texto}`).join('\n')}\n` : '\nNo hay órdenes ni instrucciones vigentes.\n')
} else if (cmd === 'quitar') {
  const db = supabase(need())
  const id = Number(rest[0])
  if (!id) {
    say('\nUso: node scripts/ultron.mjs quitar <id>   (los ids salen con: node scripts/ultron.mjs ordenes)\n')
    process.exit(1)
  }
  await db.rest(`ultron_memoria?id=eq.${id}`, { method: 'PATCH', body: { activa: false } })
  await sincronizarInstrucciones(db)
  say('\n✅ Quitada.\n')
} else {
  say('\nUso: node scripts/ultron.mjs [estado | voz <id> | orden "…" | ordenes | quitar <id>]\n')
}
