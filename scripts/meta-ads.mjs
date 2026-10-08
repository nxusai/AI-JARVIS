#!/usr/bin/env node
// Nexy's watch over each company's Meta ads (see bridge/anuncios.mjs).
//
//   node scripts/meta-ads.mjs              asks for the read-only key (hidden), checks it and saves it
//   node scripts/meta-ads.mjs estado       the key and which companies' ad accounts are watched
//   node scripts/meta-ads.mjs probar       what each company has running now, as Nexy reads it
//   node scripts/meta-ads.mjs pausas si|no also tell when an ad is paused or ends (off by default)
//   node scripts/meta-ads.mjs quitar       deletes the key from this Mac
//   node scripts/meta-ads.mjs compartir mi-semago abuelito-inc
//        the ad account linked to the first company is shared with the others
//        (ads only): each campaign carries its company, "[Abuelito Cheese] …"
//   node scripts/meta-ads.mjs descompartir mi-semago   undoes it
//
// The key is a Meta Business system user token with ads_read only: it can see
// ads, never create, switch on or spend. Typed into a hidden prompt, checked
// with Meta and saved in ~/.nexy/meta-ads.json, readable by this Mac's user
// only. It is never printed.

import { rmSync } from 'node:fs'
import { ADS_FILE, graph, readAdsKey, runningNow, watchedAccounts, writeAdsKey } from '../bridge/anuncios.mjs'
import { readBrands, readShared, writeShared } from '../bridge/brands.mjs'

const [cmd, arg] = process.argv.slice(2)
const say = (s) => console.log(s)

/** Read a line without showing it; from a pipe when there is no terminal. */
function hidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin
    if (!stdin.isTTY) {
      let data = ''
      stdin.setEncoding('utf8')
      stdin.on('data', (c) => (data += c))
      stdin.on('end', () => resolve(data.trim()))
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

async function accounts(key) {
  const list = watchedAccounts()
  if (!list.length) {
    say('\n⚠️ Ninguna empresa tiene ligada su cuenta de Meta Ads en Nexy todavía.')
    say('   Pídeselo a Nexy: "liga la cuenta de Meta Ads <número> a Mi Semago".')
    return
  }
  for (const a of list) {
    try {
      const info = await graph(`act_${a.cuenta}`, { fields: 'name,currency,account_status' }, { key })
      say(`   ✅ ${a.empresa}: cuenta ${info.name} (${a.cuenta}), ${info.currency}`)
    } catch (err) {
      say(`   ❌ ${a.empresa}: la cuenta ${a.cuenta} no se puede leer con esta llave (${err.message}).`)
      say('      En Meta Business, al usuario del sistema dale acceso a esa cuenta publicitaria (Ver rendimiento).')
    }
  }
}

if (cmd === 'estado') {
  const key = readAdsKey()
  say(key ? `\nLlave de Meta: guardada (de ${key.quien ?? 'Meta Business'}).` : '\nTodavía no hay llave de Meta. Pégala con: node scripts/meta-ads.mjs')
  say(`Avisos de pausas: ${key?.avisarPausas ? 'sí' : 'no'}`)
  for (const c of readShared()) say(`Cuenta compartida (solo anuncios): ${c.id} · ${c.marcas.map((m) => readBrands().marcas.find((b) => b.id === m)?.nombre ?? m).join(' + ')}`)
  say('Empresas vigiladas:')
  if (key) await accounts(key)
  else for (const a of watchedAccounts()) say(`   • ${a.empresa}: cuenta ${a.cuenta}`)
  say('')
  process.exit(0)
}

if (cmd === 'probar') {
  try {
    say(`\n${await runningNow()}\n`)
    process.exit(0)
  } catch (err) {
    say(`\n❌ ${err.message}\n`)
    process.exit(1)
  }
}

if (cmd === 'pausas') {
  const key = readAdsKey()
  if (!key) {
    say('\nPrimero pega la llave: node scripts/meta-ads.mjs\n')
    process.exit(1)
  }
  writeAdsKey({ ...key, avisarPausas: /^s[ií]$/i.test(arg ?? '') })
  say(`\n✅ Avisos cuando se pausa o termina un ad: ${/^s[ií]$/i.test(arg ?? '') ? 'sí' : 'no'}. Reinicia Nexy para que lo tome.\n`)
  process.exit(0)
}

if (cmd === 'compartir' || cmd === 'descompartir') {
  const ids = process.argv.slice(3)
  const marcas = readBrands().marcas
  const owner = marcas.find((b) => b.id === ids[0])
  const link = owner?.conexiones.find((c) => c.servicio === 'meta-ads')
  if (!owner || !link) {
    say(`\n❌ "${ids[0] ?? ''}" no tiene una cuenta de Meta Ads ligada. Primero la empresa dueña de la cuenta, por ejemplo: node scripts/meta-ads.mjs compartir mi-semago abuelito-inc\n`)
    process.exit(1)
  }
  const cuenta = String(link.id).replace(/^act_/i, '')
  const rest = readShared().filter((c) => c.id !== cuenta)
  if (cmd === 'descompartir') {
    writeShared(rest)
    say(`\n✅ La cuenta ${link.nombre || cuenta} ya es solo de ${owner.nombre}. Reinicia Nexy.\n`)
    process.exit(0)
  }
  const others = ids.slice(1).map((id) => marcas.find((b) => b.id === id))
  if (!others.length || others.some((b) => !b)) {
    say(`\n❌ Di con qué empresas se comparte, por su id. Las que hay: ${marcas.map((b) => b.id).join(', ')}\n`)
    process.exit(1)
  }
  const taken = others.find((b) => b.conexiones.some((c) => c.servicio === 'meta-ads'))
  if (taken) say(`\n⚠️ ${taken.nombre} ya tiene su propia cuenta de Meta Ads; seguirá usando la suya y además podrá usar esta.`)
  writeShared([...rest, { servicio: 'meta-ads', id: cuenta, marcas: [owner.id, ...others.map((b) => b.id)] }])
  const names = [owner, ...others].map((b) => b.nombre).join(' + ')
  say(`\n✅ La cuenta ${link.nombre || cuenta} queda compartida, solo para anuncios: ${names}.`)
  say('   Nexy pone la empresa al inicio del nombre de cada campaña, por ejemplo "[Abuelito Cheese] Promo queso",')
  say('   solo cambia las campañas de la empresa en la que está trabajando, y te avisa y reporta cada empresa por separado.')
  say('   Reinicia Nexy (Ctrl+C y npm start) para que lo tome.\n')
  process.exit(0)
}

if (cmd === 'quitar') {
  rmSync(ADS_FILE, { force: true })
  say('\n✅ Borré la llave de Meta de esta Mac. Nexy ya no vigila los ads (reiníciala).\n')
  process.exit(0)
}

if (cmd) {
  say('Uso:\n  node scripts/meta-ads.mjs\n  node scripts/meta-ads.mjs estado\n  node scripts/meta-ads.mjs probar\n  node scripts/meta-ads.mjs pausas si|no\n  node scripts/meta-ads.mjs compartir mi-semago abuelito-inc\n  node scripts/meta-ads.mjs descompartir mi-semago\n  node scripts/meta-ads.mjs quitar')
  process.exit(1)
}

say('\nPega la llave de Meta (solo lectura) y presiona Enter. No se va a ver mientras la pegas.')
const token = (await hidden('Llave: ')).replace(/\s+/g, '')
if (token.length < 40) {
  say('\n❌ Eso no parece una llave de Meta (es muy corta). Cópiala completa y vuelve a correr el comando.\n')
  process.exit(1)
}
const key = { ...(readAdsKey() ?? {}), token }
let me
try {
  me = await graph('me', { fields: 'id,name' }, { key })
} catch (err) {
  say(`\n❌ Meta no aceptó la llave: ${err.message}\n`)
  process.exit(1)
}
// Only a read-only key is kept: one that can manage ads is refused.
try {
  const perms = await graph('me/permissions', {}, { key })
  const granted = (perms.data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission)
  if (granted.includes('ads_management')) {
    say('\n❌ Esta llave puede CREAR y GASTAR en anuncios (tiene ads_management). Para vigilar solo hace falta ver.')
    say('   Genera otra llave marcando solo ads_read (y business_management si te lo pide) y pégala de nuevo.\n')
    process.exit(1)
  }
  if (granted.length && !granted.includes('ads_read')) {
    say('\n❌ A esta llave le falta el permiso ads_read. Genera otra marcando ads_read y pégala de nuevo.\n')
    process.exit(1)
  }
} catch {
  // A system user token may not list its permissions: the account check below tells.
}
writeAdsKey({ ...key, quien: me.name ?? 'Meta Business' })
say(`\n✅ Llave guardada (${me.name ?? 'usuario del sistema'}). Empresas que Nexy va a vigilar:`)
await accounts(key)
say('\nReinicia Nexy (Ctrl+C en su ventana y npm start). En un minuto te escribe por Telegram qué está vigilando.\n')
process.exit(0)
