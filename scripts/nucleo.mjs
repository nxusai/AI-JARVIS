#!/usr/bin/env node
/**
 * Checks that the core (bridge/nucleo) can leave Nexy: what goes to a client's
 * brain must carry nothing of Nexy's.
 *
 *   node scripts/nucleo.mjs
 *
 * 1. Every import in the core stays in the core (or is Node's own, or one of
 *    the few packages the brain installs).
 * 2. The core built the way the brain gets it (one file, the brain's
 *    lugar.mjs in place of Nexy's) says nothing of Nexy, the owner's
 *    company or his mail.
 * Exits with 1 and says what is wrong when either fails.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORE = join(ROOT, 'bridge', 'nucleo')
const BRAIN_PLACE = join(ROOT, 'bridge', 'cerebro', 'lugar.mjs')
/** The packages the brain installs next to its program. */
export const PACKAGES = ['@anthropic-ai/claude-agent-sdk', 'zod', 'ffmpeg-static']
/** Words that must never reach a brain. */
export const FORBIDDEN = /nexy|jarvis|nxus|ramos ?& ?co|contacto@/i
/** The entry points a brain runs. */
export const ENTRIES = [join(CORE, 'anasofi.mjs')]

const problems = []

// 1. Imports.
const node = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)])
for (const f of readdirSync(CORE).filter((f) => f.endsWith('.mjs'))) {
  const src = readFileSync(join(CORE, f), 'utf8')
  for (const [, spec] of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
    if (spec.startsWith('.')) {
      const to = resolve(CORE, spec)
      if (relative(CORE, to).startsWith('..')) problems.push(`${f} imports ${spec}, outside the core`)
    } else if (!node.has(spec) && !PACKAGES.some((p) => spec === p || spec.startsWith(`${p}/`))) {
      problems.push(`${f} imports the package ${spec}, which the brain does not install`)
    }
  }
}

/** The core as one file, the way the brain gets it. */
export async function buildCore({ outfile, write = false, minify = true } = {}) {
  const { build } = await import('esbuild')
  return build({
    entryPoints: ENTRIES,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    minify,
    legalComments: 'none',
    external: PACKAGES,
    write,
    outfile: outfile ?? join(ROOT, 'cerebro.mjs'),
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

// 2. Leaks, in what would really go.
if (!problems.length) {
  try {
    const out = await buildCore()
    const code = out.outputFiles[0].text
    const lines = code.split(/(?<=[;{}])/)
    for (const m of code.matchAll(new RegExp(FORBIDDEN.source, 'gi'))) {
      const at = m.index
      problems.push(`the built core says "${m[0]}": …${code.slice(Math.max(0, at - 60), at + 60).replace(/\s+/g, ' ')}…`)
      if (problems.length > 20) break
    }
    if (!problems.length) console.log(`✅ The core is clean: ${ENTRIES.length} entry, ${(code.length / 1024).toFixed(0)} KB built, ${lines.length} statements, nothing of Nexy.`)
  } catch (err) {
    problems.push(`could not build the core: ${err.message}`)
  }
}

if (problems.length) {
  console.log(`❌ The core is not ready to leave:\n${problems.map((p) => `- ${p}`).join('\n')}`)
  process.exitCode = 1
}
