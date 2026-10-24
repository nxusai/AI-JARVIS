#!/usr/bin/env node
/**
 * Builds a client's brain: the folder that is installed on their Mac mini
 * (see docs/cerebro-cliente.md).
 *
 *   node scripts/cerebro.mjs armar     builds and signs it in ~/Documents/Nexy/cerebro/Cerebro-<version>
 *   node scripts/cerebro.mjs llave     the signing key's fingerprint (made the first time)
 *
 * And the door into each brain (bridge/cerebros.mjs, bridge/cerebro/canal.sh):
 *
 *   node scripts/cerebro.mjs conectar <nombre> <dirección> <usuario>   remember a brain (its Mac mini, the administrator account)
 *   node scripts/cerebro.mjs estado [nombre]                           how it is
 *   node scripts/cerebro.mjs enviar [nombre]                           build, sign and install the program on it
 *   node scripts/cerebro.mjs datos [nombre] [--etiquetas] [--forzar]   send the group, voices, owner and line (and the label sets)
 *   node scripts/cerebro.mjs espejo [nombre]                           take a copy of its labels
 *   node scripts/cerebro.mjs registro|reiniciar|apagar|prender [nombre]
 *   node scripts/cerebro.mjs borrar-llaves [nombre]                    emergency: wipe its keys and stop it
 *   node scripts/cerebro.mjs mudar-anasofi [nombre]                    moving day: the labels and her group go to the brain, and NEX stops answering with her bot
 *   node scripts/cerebro.mjs regresar-anasofi [nombre]                 calls the move off: the brain stops, and she answers from NEX again
 * With one brain, the name can be left out.
 *
 * Every package is signed with the owner's key, ~/.nexy/cerebro/firma-privada.pem,
 * made once on this Mac and never copied anywhere: a brain only accepts
 * packages signed with it (bridge/cerebro/firma.mjs). Keep it in the backup;
 * without it no brain can be updated until its key is changed by hand.
 *
 * The folder holds the brain's program and its keys screen (each one file,
 * unreadable), the label template and sets, what it needs to install, and
 * the fingerprint of every file. Before anything is written, every file is
 * checked for anything of NEX's: if one says it, nothing is built.
 */
import { execFileSync } from 'node:child_process'
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listClients, RETIRED } from '../bridge/nucleo/etiquetas.mjs'
import { brainState, buildData, doorKey, mirror, order, readBrains, saveBrain } from '../bridge/cerebros.mjs'
import { fingerprint, MANIFEST, PUBLIC_KEY, SIGNATURE } from '../bridge/cerebro/firma.mjs'
import { buildBrain, ENTRIES, importProblems, leaks, PACKAGES } from './nucleo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BRAIN = join(ROOT, 'bridge', 'cerebro')
const LABELS = join(ROOT, 'bridge', 'etiquetas')
export const OUT = join(homedir(), 'Documents', 'Nexy', 'cerebro')
export const SIGNING_KEY = join(homedir(), '.nexy', 'cerebro', 'firma-privada.pem')

/** The owner's signing key: made the first time, this Mac's user only. */
export function signingKey() {
  if (!existsSync(SIGNING_KEY)) {
    const { privateKey } = generateKeyPairSync('ed25519')
    mkdirSync(dirname(SIGNING_KEY), { recursive: true, mode: 0o700 })
    writeFileSync(SIGNING_KEY, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
    chmodSync(SIGNING_KEY, 0o600)
  }
  const privateKey = createPrivateKey(readFileSync(SIGNING_KEY, 'utf8'))
  const publicPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })
  return { privateKey, publicPem }
}

/** The version: when it was built, and which commit, if known. */
function versionNow() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')
  try {
    return `${stamp}-${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()}`
  } catch {
    return stamp
  }
}

export async function buildPackage({ out = OUT, version = versionNow() } = {}) {
  const problems = importProblems()
  if (problems.length) throw new Error(`the core imports what it should not:\n- ${problems.join('\n- ')}`)

  // Everything in memory first, checked, then written.
  const files = {}
  for (const name of Object.keys(ENTRIES)) files[name] = (await buildBrain(name, { version })).outputFiles[0].text
  files['instalar.sh'] = readFileSync(join(BRAIN, 'instalar.sh'), 'utf8')
  files['canal.sh'] = readFileSync(join(BRAIN, 'canal.sh'), 'utf8')
  // The Apps Script to paste in the client's Google account (Drive), at hand on the Mac mini.
  files['drive-google.gs'] = readFileSync(join(BRAIN, 'drive-google.gs'), 'utf8')
  // The door's key, so this system can reach the brain once installed.
  files['canal.pub'] = `${doorKey()}\n`
  files['etiquetas/plantilla.html'] = readFileSync(join(LABELS, 'plantilla.html'), 'utf8')
  for (const f of readdirSync(join(LABELS, 'clientes')).filter((f) => f.endsWith('.json') && !RETIRED.has(f.slice(0, -5)))) {
    files[`etiquetas/clientes/${f}`] = readFileSync(join(LABELS, 'clientes', f), 'utf8')
  }
  const exact = (p) => JSON.parse(readFileSync(join(ROOT, 'node_modules', p, 'package.json'), 'utf8')).version
  files['package.json'] = `${JSON.stringify({ name: 'cerebro', version: '1.0.0', private: true, type: 'module', dependencies: Object.fromEntries(PACKAGES.map((p) => [p, exact(p)])) }, null, 2)}\n`
  files['version.txt'] = `${version}\n`

  const found = Object.entries(files).flatMap(([name, text]) => leaks(text, name))
  if (found.length) throw new Error(`the package would carry something of NEX's:\n- ${found.join('\n- ')}`)

  // The fingerprint of every file, for the brain to check it was not touched.
  const sha = (text) => createHash('sha256').update(text).digest('hex')
  files[MANIFEST] = `${JSON.stringify({ version, archivos: Object.fromEntries(Object.entries(files).map(([n, t]) => [n, sha(t)])) }, null, 2)}\n`
  // Signed with the owner's key; the public half goes along for the first install.
  const { privateKey, publicPem } = signingKey()
  files[SIGNATURE] = `${sign(null, Buffer.from(files[MANIFEST]), privateKey).toString('base64')}\n`
  files[PUBLIC_KEY] = publicPem

  const dir = join(out, `Cerebro-${version}`)
  rmSync(dir, { recursive: true, force: true })
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), text, { mode: name.endsWith('.sh') ? 0o755 : 0o644 })
  }
  return { dir, version, files: Object.keys(files).length }
}

const DOOR = ['estado', 'enviar', 'datos', 'espejo', 'registro', 'reiniciar', 'apagar', 'prender', 'borrar-llaves', 'mudar-anasofi', 'regresar-anasofi']

/** Which brain: the one named, or the only one there is. */
function pick(args) {
  const names = Object.keys(readBrains())
  const named = args.find((a) => !a.startsWith('--'))
  if (named) return names.includes(named) ? named : (console.log(` ❌ No hay un cerebro llamado ${named}. Están: ${names.join(', ') || 'ninguno'}.`), null)
  if (names.length === 1) return names[0]
  console.log(names.length ? ` Di cuál: ${names.join(', ')}.` : ' Todavía no hay cerebros. Primero: node scripts/cerebro.mjs conectar <nombre> <dirección> <usuario>')
  return null
}

const answer = (r) => (r.out.toString().trim() || r.err || `respondió ${r.code}`)

async function door(what, args) {
  const name = pick(args)
  if (!name) return 1
  try {
    if (what === 'estado') {
      const s = await brainState(name)
      const e = s.estado ?? {}
      const ago = e.latido ? Math.round((Date.now() - Date.parse(e.latido)) / 60_000) : null
      console.log(` Cerebro ${name}: ${s.servicio ? 'servicio cargado' : '⚠️ servicio apagado'}`)
      console.log(` Versión: ${e.version ?? '?'} · último latido: ${ago === null ? 'nunca' : ago <= 2 ? 'ahora' : `hace ${ago} min`}`)
      console.log(` Sello: ${e.sello === 'bien' ? '✅ correcto' : `❌ ${e.sello ?? 'sin revisar'}`}`)
      for (const [ia, st] of Object.entries(e.ias ?? {})) console.log(` ${ia === 'anasofi' ? 'Ana Sofi' : ia}: ${st}`)
      for (const a of (e.avisos ?? []).slice(-5)) console.log(` ⚠️ ${a.text}`)
      return 0
    }
    if (what === 'enviar') {
      const { dir, version } = await buildPackage()
      console.log(` Paquete ${version} armado y firmado. Enviando…`)
      const tar = execFileSync('tar', ['-czf', '-', '-C', dirname(dir), basename(dir)], { maxBuffer: 200 * 1024 * 1024 })
      const r = await order(name, 'paquete', tar)
      console.log(answer(r))
      return r.code === 0 ? 0 : 1
    }
    if (what === 'datos') {
      const labels = args.includes('--etiquetas')
      if (labels && !args.includes('--forzar')) {
        const { differ } = await mirror(name)
        if (differ.length) {
          console.log(` ⚠️ En el cerebro hay ${differ.length} empresas de etiquetas distintas a las de aquí: ${differ.join(', ')}.`)
          console.log(' Mandarlas borraría lo que se cambió allá. Revisa la copia (node scripts/cerebro.mjs espejo) o, si estás seguro (por ejemplo, la primera vez), agrega --forzar.')
          return 1
        }
      }
      signingKey()
      const r = await order(name, 'datos', buildData({ labels }))
      console.log(answer(r))
      return r.code === 0 ? 0 : 1
    }
    if (what === 'espejo') {
      const { dir, differ, adopted } = await mirror(name)
      console.log(` ✅ Copia del cerebro ${name} guardada en ${dir}`)
      console.log(differ.length ? ` Distintas a las de aquí: ${differ.join(', ')}` : ' Las etiquetas son iguales a las de aquí.')
      if (adopted.length) console.log(` Se guardaron aquí los cambios hechos allá: ${adopted.join(', ')}`)
      return 0
    }
    if (what === 'mudar-anasofi') {
      const st = await brainState(name)
      if (st.estado?.sello && st.estado.sello !== 'bien') return console.log(` ❌ El sello del cerebro no cuadra (${st.estado.sello}). Reinstálalo antes de mudarla.`), 1
      signingKey()
      const r = await order(name, 'datos', buildData({ labels: true }))
      console.log(answer(r))
      if (r.code !== 0) return 1
      saveBrain(name, { ...readBrains()[name], anasofi: 'cerebro' })
      console.log(` ✅ Las ${listClients().length} empresas de etiquetas, su grupo y sus voces ya están en el cerebro ${name}.`)
      console.log(' Ahora, en este orden:')
      console.log('   1. Reinicia NEX (Ctrl + C y npm start): ya no contestará con el bot de Ana Sofi.')
      console.log('   2. En el Mac mini pon la llave del bot: sudo node "/Library/Application Support/Cerebro/programa/llaves.mjs" (Enter en todo lo demás).')
      console.log(' Si algo sale mal: node scripts/cerebro.mjs regresar-anasofi')
      return 0
    }
    if (what === 'regresar-anasofi') {
      const r = await order(name, 'apagar').catch((err) => ({ code: 1, out: Buffer.from(''), err: err.message }))
      console.log(r.code === 0 ? ` El cerebro ${name} quedó apagado.` : ` ⚠️ No pude apagar el cerebro (${answer(r)}). Apágalo desde el Mac mini antes de seguir, o contestarán los dos.`)
      saveBrain(name, { ...readBrains()[name], anasofi: undefined })
      console.log(' ✅ Ana Sofi vuelve a NEX: reinicia NEX (Ctrl + C y npm start).')
      return 0
    }
    if (what === 'borrar-llaves') {
      const rl = (await import('node:readline')).createInterface({ input: process.stdin, output: process.stdout })
      const sure = await new Promise((r) => rl.question(` Esto borra las llaves del cerebro ${name} y lo apaga. Escribe borrar para seguir: `, r))
      rl.close()
      if (sure.trim() !== 'borrar') return console.log(' No se hizo nada.'), 1
    }
    const r = await order(name, what)
    console.log(answer(r))
    return r.code === 0 ? 0 : 1
  } catch (err) {
    console.log(` ❌ No se pudo hablar con el cerebro ${name}: ${err.message}`)
    return 1
  }
}

const cmd = process.argv[2]
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (cmd === 'armar') {
    try {
      const { dir, version, files } = await buildPackage()
      console.log(` ✅ Cerebro ${version} armado y firmado: ${files} archivos, sin nada de NEX.`)
      console.log(` Firma: ${fingerprint(signingKey().publicPem)}`)
      console.log(` Carpeta: ${dir}`)
    } catch (err) {
      console.log(` ❌ No se armó el cerebro: ${err.message}`)
      process.exitCode = 1
    }
  } else if (cmd === 'llave') {
    const fresh = !existsSync(SIGNING_KEY)
    const { publicPem } = signingKey()
    console.log(`${fresh ? ' 🔑 Llave de firma creada.\n' : ''} Huella de tu llave de firma: ${fingerprint(publicPem)}`)
    console.log(' El día de la instalación, el Mac mini debe mostrar esta misma huella.')
    console.log(` Está en ${SIGNING_KEY}: nunca la copies a otro lado que no sea tu respaldo.`)
  } else if (cmd === 'conectar') {
    const [, , , name, host, usuario] = process.argv
    try {
      saveBrain(name, { ...(readBrains()[name] ?? {}), host, usuario })
      console.log(` ✅ Cerebro "${name}" guardado: ${usuario}@${host}. Pruébalo con: node scripts/cerebro.mjs estado ${name}`)
    } catch (err) {
      console.log(` ❌ ${err.message}. Uso: node scripts/cerebro.mjs conectar mi-semago <dirección> <usuario>`)
      process.exitCode = 1
    }
  } else if (DOOR.includes(cmd)) {
    process.exitCode = await door(cmd, process.argv.slice(3))
  } else {
    console.log(' Uso: node scripts/cerebro.mjs armar | llave | conectar | estado | enviar | datos | espejo | registro | reiniciar | apagar | prender | borrar-llaves')
    process.exitCode = 1
  }
}
