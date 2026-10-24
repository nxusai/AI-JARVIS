#!/usr/bin/env node
/**
 * Checks that the core (bridge/nucleo) can leave NEX: what goes to a client's
 * brain must carry nothing of NEX's.
 *
 *   node scripts/nucleo.mjs
 *
 * 1. Every import in the core stays in the core (or is Node's own, or one of
 *    the few packages the brain installs).
 * 2. The core built the way the brain gets it (one file, the brain's
 *    lugar.mjs in place of NEX's) says nothing of NEX, the owner's
 *    company or his mail.
 * Exits with 1 and says what is wrong when either fails.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORE = join(ROOT, 'bridge', 'nucleo')
const BRAIN = join(ROOT, 'bridge', 'cerebro')
const BRAIN_PLACE = join(BRAIN, 'lugar.mjs')
/** The packages the brain installs next to its program. */
export const PACKAGES = ['@anthropic-ai/claude-agent-sdk', 'zod', 'ffmpeg-static']
/** Words that must never reach a brain. */
export const FORBIDDEN = /nexy|\bnex\b|jarvis|nxus|ramos ?& ?co|contacto@/i
/** What a brain runs: the program, and the keys screen. Built as these names. */
export const ENTRIES = { 'cerebro.mjs': join(BRAIN, 'main.mjs'), 'llaves.mjs': join(BRAIN, 'llaves.mjs') }

const problems = []

// 1. Imports: the core only imports itself; the brain, itself and the core.
const node = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)])
const inside = (to, dirs) => dirs.some((d) => !relative(d, to).startsWith('..'))
for (const [dir, allowed] of [
  [CORE, [CORE]],
  [BRAIN, [BRAIN, CORE]],
]) for (const f of readdirSync(dir).filter((f) => f.endsWith('.mjs'))) {
  const src = readFileSync(join(dir, f), 'utf8')
  for (const [, spec] of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
    if (spec.startsWith('.')) {
      if (!inside(resolve(dir, spec), allowed)) problems.push(`${relative(ROOT, join(dir, f))} imports ${spec}, outside what goes to a brain`)
    } else if (!node.has(spec) && !PACKAGES.some((p) => spec === p || spec.startsWith(`${p}/`))) {
      problems.push(`${f} imports the package ${spec}, which the brain does not install`)
    }
  }
}

/** One of the brain's programs as one file, the way the brain gets it. */
export async function buildBrain(name, { outfile, write = false, minify = true, version = 'desarrollo' } = {}) {
  const { build } = await import('esbuild')
  return build({
    entryPoints: [ENTRIES[name]],
    define: { __CEREBRO_VERSION__: JSON.stringify(version) },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    minify,
    legalComments: 'none',
    external: PACKAGES,
    write,
    outfile: outfile ?? join(ROOT, name),
    logLevel: 'silent',
    plugins: [
      {
        name: 'lugar-del-cerebro',
        setup(b) {
          b.onResolve({ filter: /(^|\/)lugar\.mjs$/ }, () => ({ path: BRAIN_PLACE }))
        },
      },
    ],
  })
}

/** Where a text says something that must never reach a brain. */
export function leaks(text, where) {
  const found = []
  for (const m of String(text).matchAll(new RegExp(FORBIDDEN.source, 'gi'))) {
    found.push(`${where} says "${m[0]}": …${text.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, ' ')}…`)
    if (found.length >= 10) break
  }
  return found
}

// 2. Leaks, in what would really go.
const run = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (run && !problems.length) {
  try {
    let size = 0
    for (const name of Object.keys(ENTRIES)) {
      const code = (await buildBrain(name)).outputFiles[0].text
      size += code.length
      problems.push(...leaks(code, name))
    }
    if (!problems.length) console.log(`✅ The core is clean: ${Object.keys(ENTRIES).join(' and ')} built (${(size / 1024).toFixed(0)} KB), nothing of NEX.`)
  } catch (err) {
    problems.push(`could not build the core: ${err.message}`)
  }
}

if (run && problems.length) {
  console.log(`❌ The core is not ready to leave:\n${problems.map((p) => `- ${p}`).join('\n')}`)
  process.exitCode = 1
}

/** What is wrong with the core's imports (empty when nothing). */
export const importProblems = () => [...problems]
