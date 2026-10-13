#!/usr/bin/env node
/**
 * Builds a client's brain: the folder that is installed on their Mac mini
 * (see docs/cerebro-cliente.md).
 *
 *   node scripts/cerebro.mjs armar     builds it in ~/Documents/Nexy/cerebro/Cerebro-<version>
 *
 * The folder holds the brain's program and its keys screen (each one file,
 * unreadable), the label template and sets, what it needs to install, and
 * the fingerprint of every file. Before anything is written, every file is
 * checked for anything of Nexy's: if one says it, nothing is built.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RETIRED } from '../bridge/nucleo/etiquetas.mjs'
import { buildBrain, ENTRIES, importProblems, leaks, PACKAGES } from './nucleo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BRAIN = join(ROOT, 'bridge', 'cerebro')
const LABELS = join(ROOT, 'bridge', 'etiquetas')
export const OUT = join(homedir(), 'Documents', 'Nexy', 'cerebro')

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
  files['huellas.json'] = `${JSON.stringify({ version, archivos: Object.fromEntries(Object.entries(files).map(([n, t]) => [n, sha(t)])) }, null, 2)}\n`

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
      console.log(` ✅ Cerebro ${version} armado: ${files} archivos, sin nada de Nexy.`)
      console.log(` Carpeta: ${dir}`)
    } catch (err) {
      console.log(` ❌ No se armó el cerebro: ${err.message}`)
      process.exitCode = 1
    }
  } else {
    console.log(' Uso: node scripts/cerebro.mjs armar')
    process.exitCode = 1
  }
}
