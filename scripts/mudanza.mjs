#!/usr/bin/env node
// Moving Nexy from one Mac to another, with everything she knows.
//
//   node scripts/mudanza.mjs empacar      on the old Mac: packs Nexy into ~/Desktop/nexy-mudanza.tgz
//                                          and switches off Telegram and routines here, so only one
//                                          Nexy answers
//   node scripts/mudanza.mjs desempacar   on the new Mac: unpacks it (from the Desktop or Downloads)
//   node scripts/mudanza.mjs regresar     on the old Mac: undoes the switch-off, if the move is called off
//
// What travels: ~/.nexy (brands, manuals, logos, references, memory, contacts,
// routines, Telegram), the connector list from ~/.claude.json, the Gmail and
// Calendar sign-ins, and the NEXY_/JARVIS_/ELEVENLABS_ lines from ~/.zshrc.
// What does not: the Claude login and the connectors signed in through the
// browser (Metricool, Higgsfield, Meta Ads...) — macOS keeps those in the
// Keychain, so they are signed in again on the new Mac with /mcp.
//
// The package holds keys. It is readable by this user only; move it by
// AirDrop and delete it from both Macs once Nexy works on the new one.

import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

const HOME = homedir()
const NEXY = join(HOME, '.nexy')
const MOVED = join(NEXY, 'mudada.json')
const PACKAGE = 'nexy-mudanza.tgz'
// Sign-ins kept as files by the Gmail and Calendar connectors.
const EXTRA_DIRS = ['.gmail-mcp', join('.config', 'nexy'), join('.config', 'google-calendar-mcp')]
const ENV_LINE = /^\s*export\s+(NEXY_|JARVIS_|ELEVENLABS_)[A-Z0-9_]*=/
const MARK = '# Nexy — traído de la otra Mac'

const say = (s = '') => console.log(s)
const fail = (s) => {
  console.error(`\n✋ ${s}\n`)
  process.exit(1)
}
const tar = (args) => {
  const r = spawnSync('tar', args, { stdio: ['ignore', 'ignore', 'pipe'] })
  if (r.status !== 0) fail(`No pude ${args[0] === '-czf' ? 'empacar' : 'desempacar'}: ${String(r.stderr).trim()}`)
}
const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}

function empacar() {
  if (!existsSync(NEXY)) fail('No encuentro a Nexy en esta Mac (no existe ~/.nexy).')
  const stage = mkdtempSync(join(tmpdir(), 'nexy-mudanza-'))
  try {
    // What she knows. The conversation ids stay behind: they point at chat
    // logs that live on this Mac only.
    cpSync(NEXY, join(stage, 'home', '.nexy'), {
      recursive: true,
      filter: (src) => !src.startsWith(join(NEXY, 'sesiones')) && src !== MOVED,
    })
    for (const d of EXTRA_DIRS) {
      if (existsSync(join(HOME, d))) cpSync(join(HOME, d), join(stage, 'home', d), { recursive: true })
    }
    const cfg = readJson(join(HOME, '.claude.json'), {})
    const servers = { ...(cfg.mcpServers ?? {}), ...(cfg.projects?.[HOME]?.mcpServers ?? {}) }
    writeFileSync(join(stage, 'conectores.json'), JSON.stringify({ home: HOME, mcpServers: servers }, null, 2))
    let env = []
    try {
      env = readFileSync(join(HOME, '.zshrc'), 'utf8').split('\n').filter((l) => ENV_LINE.test(l))
    } catch {}
    writeFileSync(join(stage, 'variables.sh'), env.join('\n') + '\n')

    const out = join(HOME, 'Desktop', PACKAGE)
    tar(['-czf', out, '-C', stage, '.'])
    chmodSync(out, 0o600)
    writeFileSync(MOVED, JSON.stringify({ fecha: new Date().toISOString() }))

    const names = Object.keys(servers)
    say(`\n📦 Listo: Nexy quedó empacada en el Escritorio → ${PACKAGE}`)
    say(`   Lleva: marcas, manuales, memoria, contactos, rutinas, Telegram, ${env.length} ajustes y ${names.length} conectores (${names.join(', ') || 'ninguno'}).`)
    say('\n🔕 En ESTA Mac, Nexy ya no contestará Telegram ni correrá rutinas (para que no haya dos Nexys).')
    say('   Si te arrepientes: node scripts/mudanza.mjs regresar')
    say('\n⚠️  El archivo tiene llaves: pásalo por AirDrop y bórralo de las dos Macs cuando todo funcione.\n')
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

function desempacar() {
  const given = process.argv[3]
  const file = [given, join(HOME, 'Desktop', PACKAGE), join(HOME, 'Downloads', PACKAGE)].find((p) => p && existsSync(p))
  if (!file) fail(`No encuentro ${PACKAGE} en el Escritorio ni en Descargas.`)
  const stage = mkdtempSync(join(tmpdir(), 'nexy-mudanza-'))
  try {
    tar(['-xzf', file, '-C', stage])
    const packed = readJson(join(stage, 'conectores.json'), null)
    if (!packed || !existsSync(join(stage, 'home', '.nexy'))) fail('Ese archivo no parece una mudanza de Nexy.')

    // Whatever Nexy already had here is kept aside, not overwritten.
    if (existsSync(NEXY)) {
      const aside = `${NEXY}-antes-${new Date().toISOString().slice(0, 10)}`
      renameSync(NEXY, existsSync(aside) ? `${aside}-${Date.now()}` : aside)
      say(`(Lo que había de Nexy en esta Mac quedó guardado en ${aside})`)
    }
    cpSync(join(stage, 'home'), HOME, { recursive: true })

    // The connectors, with the old Mac's home folder swapped for this one's.
    const text = JSON.stringify(packed.mcpServers ?? {}).split(packed.home).join(HOME)
    const servers = JSON.parse(text)
    const cfgPath = join(HOME, '.claude.json')
    const cfg = readJson(cfgPath, {})
    cfg.mcpServers = cfg.mcpServers ?? {}
    const added = []
    for (const [name, def] of Object.entries(servers)) {
      if (cfg.mcpServers[name]) continue
      cfg.mcpServers[name] = def
      added.push(name)
    }
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), { mode: 0o600 })

    // The phone numbers, agent ids and keys, once.
    const env = readFileSync(join(stage, 'variables.sh'), 'utf8').trim()
    const zshrc = join(HOME, '.zshrc')
    const current = existsSync(zshrc) ? readFileSync(zshrc, 'utf8') : ''
    if (env && !current.includes(MARK)) writeFileSync(zshrc, `${current.replace(/\n*$/, '\n')}\n${MARK}\n${env}\n`)

    const browser = Object.entries(servers)
      .filter(([, d]) => d?.type === 'http' || d?.type === 'sse' || d?.url)
      .map(([n]) => n)
    say('\n🏠 Listo: Nexy ya vive en esta Mac con todo lo que sabe.')
    say(`   Conectores agregados: ${added.join(', ') || 'ya estaban todos'}.`)
    if (browser.length) {
      say(`\n🔑 Falta volver a iniciar sesión en: ${browser.join(', ')}.`)
      say('   En la Terminal: cd ~/Desktop/nexy && claude  →  escribe /mcp  →  cada uno  →  Authenticate.')
    }
    say('\n⚠️  Borra el archivo de la mudanza de esta Mac y de la otra.\n')
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}

function regresar() {
  if (!existsSync(MOVED)) return say('\nNexy no estaba marcada como mudada en esta Mac. Nada que hacer.\n')
  rmSync(MOVED)
  say('\n↩️  Listo: al reiniciar Nexy en esta Mac, vuelve a contestar Telegram y a correr rutinas.')
  say('   Asegúrate de que NO esté prendida en la otra Mac al mismo tiempo.\n')
}

const cmd = process.argv[2]
if (cmd === 'empacar') empacar()
else if (cmd === 'desempacar') desempacar()
else if (cmd === 'regresar') regresar()
else say('\nUso:\n  node scripts/mudanza.mjs empacar      (en la Mac vieja)\n  node scripts/mudanza.mjs desempacar   (en la Mac nueva)\n  node scripts/mudanza.mjs regresar     (deshacer, en la Mac vieja)\n')
