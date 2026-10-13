#!/usr/bin/env node
/**
 * Builds a client's brain: the folder that is installed on their Mac mini
 * (see docs/cerebro-cliente.md).
 *
 *   node scripts/cerebro.mjs armar     builds and signs it in ~/Documents/Nexy/cerebro/Cerebro-<version>
 *   node scripts/cerebro.mjs llave     the signing key's fingerprint (made the first time)
 *
 * Every package is signed with the owner's key, ~/.nexy/cerebro/firma-privada.pem,
 * made once on this Mac and never copied anywhere: a brain only accepts
 * packages signed with it (bridge/cerebro/firma.mjs). Keep it in the backup;
 * without it no brain can be updated until its key is changed by hand.
 *
 * The folder holds the brain's program and its keys screen (each one file,
 * unreadable), the label template and sets, what it needs to install, and
 * the fingerprint of every file. Before anything is written, every file is
 * checked for anything of Nexy's: if one says it, nothing is built.
 */
import { execFileSync } from 'node:child_process'
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RETIRED } from '../bridge/nucleo/etiquetas.mjs'
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
  files['etiquetas/plantilla.html'] = readFileSync(join(LABELS, 'plantilla.html'), 'utf8')
  for (const f of readdirSync(join(LABELS, 'clientes')).filter((f) => f.endsWith('.json') && !RETIRED.has(f.slice(0, -5)))) {
    files[`etiquetas/clientes/${f}`] = readFileSync(join(LABELS, 'clientes', f), 'utf8')
  }
  const exact = (p) => JSON.parse(readFileSync(join(ROOT, 'node_modules', p, 'package.json'), 'utf8')).version
  files['package.json'] = `${JSON.stringify({ name: 'cerebro', version: '1.0.0', private: true, type: 'module', dependencies: Object.fromEntries(PACKAGES.map((p) => [p, exact(p)])) }, null, 2)}\n`
  files['version.txt'] = `${version}\n`

  const found = Object.entries(files).flatMap(([name, text]) => leaks(text, name))
  if (found.length) throw new Error(`the package would carry something of Nexy's:\n- ${found.join('\n- ')}`)

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

const cmd = process.argv[2]
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (cmd === 'armar') {
    try {
      const { dir, version, files } = await buildPackage()
      console.log(` ✅ Cerebro ${version} armado y firmado: ${files} archivos, sin nada de Nexy.`)
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
  } else {
    console.log(' Uso: node scripts/cerebro.mjs armar | llave')
    process.exitCode = 1
  }
}
