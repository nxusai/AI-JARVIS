import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { spawn } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DONE, VIDEO_DIR, resolveSource } from './video.mjs'

/**
 * The effects workshop: motion graphics and 3D for the brands' videos, with
 * Remotion (video written as React) and Three.js. NEX writes a scene — a
 * React component using the kit in bridge/efectos/kit (3D titles, 3D logos,
 * kinetic text, counters, word-by-word captions, punch-in zooms, flashes) and
 * the brand's clips — looks at a few frames, and renders the MP4.
 *
 *   ~/Movies/Nexy/efectos/               the Remotion project (set up with node scripts/efectos.mjs)
 *   ~/Movies/Nexy/efectos/escenas/*.tsx  one file per scene NEX wrote
 *   ~/Movies/Nexy/efectos/public/        the clips, images and logos the scenes use
 *   ~/Movies/Nexy/listos/                finished videos
 *
 * A scene's code only gets to import Remotion, React, Three.js and the kit;
 * it cannot reach the network or the Mac (no fetch, no require, no process):
 * it runs in Remotion's headless browser and only sees public/.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const TEMPLATE = join(HERE, 'efectos')
export const EFX_DIR = join(VIDEO_DIR, 'efectos')
const SCENES = join(EFX_DIR, 'escenas')
const PUBLIC = join(EFX_DIR, 'public')
const CLI = join(EFX_DIR, 'node_modules', '@remotion', 'cli', 'remotion-cli.js')

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })

export const installed = () => existsSync(CLI)

/** The project with the current kit (the kit is refreshed every time, so updates reach it). */
export function prepareProject() {
  mkdirSync(SCENES, { recursive: true })
  mkdirSync(PUBLIC, { recursive: true })
  for (const f of ['package.json', 'remotion.config.ts', 'index.ts', 'tsconfig.json']) copyFileSync(join(TEMPLATE, f), join(EFX_DIR, f))
  rmSync(join(EFX_DIR, 'kit'), { recursive: true, force: true })
  cpSync(join(TEMPLATE, 'kit'), join(EFX_DIR, 'kit'), { recursive: true })
  writeRoot()
}

const SCENE = /^[a-z][a-z0-9-]{1,39}$/
const compId = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase())
export const listScenes = () => (existsSync(SCENES) ? readdirSync(SCENES).filter((f) => f.endsWith('.tsx')).map((f) => f.slice(0, -4)).filter((n) => SCENE.test(n)) : [])

/** Root.tsx: every scene a composition, with the size and length its file declares. */
function writeRoot() {
  const scenes = listScenes()
  const lines = [
    "import React from 'react';",
    "import { Composition } from 'remotion';",
    ...scenes.map((s, i) => `import S${i}, { config as C${i} } from './escenas/${s}';`),
    '',
    'export const Root: React.FC = () => (',
    '  <>',
    ...scenes.map((s, i) => `    <Composition id="${compId(s)}" component={S${i}} durationInFrames={Math.round((C${i}.duracion ?? 10) * (C${i}.fps ?? 30))} fps={C${i}.fps ?? 30} width={C${i}.ancho ?? 1080} height={C${i}.alto ?? 1920} />`),
    '  </>',
    ');',
    '',
  ]
  writeFileSync(join(EFX_DIR, 'Root.tsx'), lines.join('\n'))
}

const IMPORTS = /^(remotion|@remotion\/(three|media-utils|shapes|transitions|noise|paths|motion-blur|layout-utils)|react|three(\/examples\/fonts\/[\w-]+\.typeface\.json)?|@react-three\/(fiber|drei)|\.\.\/kit(\/\w+)?)$/
const FORBIDDEN = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|eval|Function|importScripts|sendBeacon|require|process|child_process|localStorage|sessionStorage|indexedDB|document\.cookie|window\.open|postMessage)\b|\bimport\s*\(/

/** Why a scene's code is refused, or null when it may be written. */
export function vetScene(code) {
  const c = String(code ?? '')
  if (!c.trim()) return 'the scene is empty'
  if (c.length > 80_000) return 'the scene is too long'
  const bad = c.match(FORBIDDEN)
  if (bad) return `"${bad[0]}" is not allowed in a scene: scenes only use Remotion, React, Three.js, the kit and files in public/`
  for (const m of c.matchAll(/(?:^|\n)\s*import\b[^'"\n]*['"]([^'"]+)['"]/g)) if (!IMPORTS.test(m[1])) return `importing "${m[1]}" is not allowed: only remotion, @remotion/*, react, three, @react-three/fiber, @react-three/drei and ../kit`
  if (/\bhttps?:\/\//i.test(c)) return 'no links in a scene: bring files in with add_to_effects and use staticFile("name")'
  if (!/export\s+default\b/.test(c)) return 'the scene needs an `export default` component'
  if (!/export\s+const\s+config\b/.test(c)) return 'the scene needs `export const config = { duracion, fps, ancho, alto }`'
  return null
}

/** Remotion's command line, in the project, no shell. */
function remotion(args, ms = 30 * 60_000) {
  return new Promise((resolve) => {
    let out = ''
    const browser = process.env.NEXY_REMOTION_BROWSER
    const gl = process.env.NEXY_REMOTION_GL
    const p = spawn(process.execPath, [CLI, ...args, ...(browser ? [`--browser-executable=${browser}`] : []), ...(gl ? [`--gl=${gl}`] : [])], { cwd: EFX_DIR, stdio: ['ignore', 'pipe', 'pipe'] })
    const keep = (b) => (out = (out + b).slice(-6000))
    p.stdout.on('data', keep)
    p.stderr.on('data', keep)
    const t = setTimeout(() => p.kill('SIGKILL'), ms)
    p.on('error', (e) => resolve({ ok: false, out: e.message }))
    p.on('close', (code) => {
      clearTimeout(t)
      resolve({ ok: code === 0, out })
    })
  })
}
const lastLines = (s, n = 12) => s.split('\n').map((l) => l.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "")).filter((l) => l.trim()).slice(-n).join('\n')

const KIT_GUIDE = `Kit (import { … } from '../kit'):
- <Titulo3D texto="ABUELITO" color="#f5c518" metal={0.6} tamano={1} desde={0} giro /> — extruded 3D letters that turn in.
- <Logo3D archivo="logo.png" desde={10} tamano={3} /> — a logo as a thick 3D card spinning in.
- <TextoCinetico texto="HECHO A MANO" resaltar={["MANO"]} tamano={110} desde={0} cadaCuadros={5} y="50%" /> — words landing one by one.
- <Contador hasta={5000} antes="+" despues=" CLIENTES" desde={0} tamano={180} y="40%" />
- <Subtitulos palabras={[{ texto: "hola", inicio: 0.2, fin: 0.5 }, …]} porLinea={3} y="72%" /> — word-by-word captions (times in seconds).
- <VideoZoom archivo="clip.mp4" zooms={[{ segundo: 1.2, escala: 1.3 }]} sacudida desdeSegundo={0} /> — a clip with punch-in zooms.
- <Destello en={45} /> — a white flash at a frame.
Remotion: <AbsoluteFill>, <Sequence from={frame} durationInFrames={n}>, <OffthreadVideo src={staticFile("clip.mp4")} />, <Img src={staticFile("x.png")} />, <Audio src={staticFile("musica.mp3")} />, useCurrentFrame(), useVideoConfig(), interpolate(), spring(). Files only by name with staticFile().
A scene file: import what it needs, \`export const config = { duracion: 12, fps: 30, ancho: 1080, alto: 1920 }\` (seconds; 1080×1920 for reels/stories, 1080×1080 square, 1920×1080 wide), and \`export default\` the component. Fonts: system fonts ("Arial Black", "Helvetica Neue", "Futura", "Impact").`

export function effectsServer() {
  const guard = (fn) => async (args) => {
    if (!installed()) return refuse('The effects workshop is not set up on this Mac yet: the owner runs node scripts/efectos.mjs once (it installs Remotion, a few minutes).')
    try {
      prepareProject()
      return await fn(args)
    } catch (err) {
      return refuse(err.message)
    }
  }
  return createSdkMcpServer({
    name: 'jarvis_efectos',
    version: '1.0.0',
    instructions: "Motion graphics and 3D effects for the brands' videos (Remotion + Three.js), rendered on this Mac.",
    tools: [
      tool('effects_guide', 'How to write an effects scene: the kit (3D title, 3D logo, kinetic text, counter, captions, zooms, flash), the file shape and the scenes there are. Read it before writing one.', {}, async () =>
        ok(`${KIT_GUIDE}\n\nScenes there are: ${listScenes().join(', ') || 'none yet'}.\nFiles in public/: ${existsSync(PUBLIC) ? readdirSync(PUBLIC).slice(0, 80).join(', ') || 'none' : 'none'}.\n${installed() ? 'Installed.' : 'NOT installed yet (node scripts/efectos.mjs).'}`),
      ),
      tool(
        'add_to_effects',
        'Bring clips, images, logos or music into the effects workshop (from list_videos, files the owner sent, brand logos, the editing workshop, or public https links such as Higgsfield results). Returns the names to use with staticFile().',
        { sources: z.array(z.string()) },
        guard(async ({ sources }) => {
          const work = mkdtempSync(join(tmpdir(), 'nexy-efectos-'))
          const added = []
          try {
            for (const [i, src] of sources.slice(0, 20).entries()) {
              const file = await resolveSource(src, work, i)
              const ext = extname(file).toLowerCase() || '.mp4'
              const base = basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `archivo${i + 1}`
              let name = `${base}${ext}`
              for (let n = 2; existsSync(join(PUBLIC, name)); n++) name = `${base}-${n}${ext}`
              copyFileSync(file, join(PUBLIC, name))
              added.push(name)
            }
          } finally {
            rmSync(work, { recursive: true, force: true })
          }
          return ok(`In public/: ${added.join(', ')}`)
        }),
      ),
      tool(
        'write_effects_scene',
        'Write (or replace) one scene: a React component file using the kit, Remotion and the files in public/. Then look at it with effects_frame before rendering.',
        { nombre: z.string().describe('lowercase with dashes, e.g. "abuelito-reel-queso"'), codigo: z.string().describe('The whole .tsx file.') },
        guard(async ({ nombre, codigo }) => {
          if (!SCENE.test(nombre)) return refuse('Scene names are lowercase letters, numbers and dashes, starting with a letter.')
          const bad = vetScene(codigo)
          if (bad) return refuse(bad)
          for (const m of codigo.matchAll(/staticFile\(\s*['"]([^'"]+)['"]\s*\)/g)) if (!existsSync(join(PUBLIC, m[1]))) return refuse(`public/${m[1]} does not exist: add it with add_to_effects first.`)
          writeFileSync(join(SCENES, `${nombre}.tsx`), codigo)
          writeRoot()
          return ok(`Written: ${nombre} (composition ${compId(nombre)}). Look at a few moments with effects_frame.`)
        }),
      ),
      tool(
        'effects_frame',
        'See one moment of a scene as a picture (renders a single frame; much faster than the video). Check the start, the key moments and the end before rendering.',
        { nombre: z.string(), segundo: z.number().min(0) },
        guard(async ({ nombre, segundo }) => {
          if (!listScenes().includes(nombre)) return refuse(`No scene ${nombre}.`)
          const m = readFileSync(join(SCENES, `${nombre}.tsx`), 'utf8').match(/fps\s*:\s*(\d+)/)
          const frame = Math.round(segundo * Number(m?.[1] ?? 30))
          const dir = mkdtempSync(join(tmpdir(), 'nexy-cuadro-'))
          try {
            const out = join(dir, 'cuadro.png')
            const r = await remotion(['still', 'index.ts', compId(nombre), out, `--frame=${frame}`, '--scale=0.5'], 5 * 60_000)
            if (!r.ok || !existsSync(out)) return refuse(`Could not draw it:\n${lastLines(r.out)}`)
            return { content: [{ type: 'image', data: readFileSync(out).toString('base64'), mimeType: 'image/png' }, { type: 'text', text: `${nombre} at ${segundo}s (frame ${frame}), half size.` }] }
          } finally {
            rmSync(dir, { recursive: true, force: true })
          }
        }),
      ),
      tool(
        'render_effects',
        'Render a scene to an MP4 in ~/Movies/Nexy/listos (a few minutes; more with a lot of 3D). Then send_file it to the owner.',
        { nombre: z.string() },
        guard(async ({ nombre }) => {
          if (!listScenes().includes(nombre)) return refuse(`No scene ${nombre}.`)
          mkdirSync(DONE, { recursive: true })
          const out = join(DONE, `${nombre}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.mp4`)
          const started = Date.now()
          const r = await remotion(['render', 'index.ts', compId(nombre), out, '--codec=h264', '--crf=18'])
          if (!r.ok || !existsSync(out)) return refuse(`The render failed:\n${lastLines(r.out)}`)
          return ok(`Rendered in ${Math.round((Date.now() - started) / 1000)} s: ${out} (${(statSync(out).size / 1048576).toFixed(1)} MB).`)
        }),
      ),
    ],
  })
}

/** For NEX's prompt. */
export const EFFECTS_PROMPT = `

# Effects (motion graphics and 3D)
For professional edits with effects — 3D titles or logos, kinetic text, counters, word-by-word captions, punch-in zooms, flashes, branded intros and outros — use the effects workshop (jarvis_efectos): effects_guide first, add_to_effects for the clips/logos/music, write_effects_scene (a Remotion React file using the kit and the brand's colours, fonts and molds), effects_frame at the start, key moments and end to check it looks right (fix and look again until it does), then render_effects and send_file. Plain cuts and captions can stay with the video editor; mix both: edit the clip in the workshop first, then bring the result in here for the effects. When the owner likes a style, save it as an editing mold for the brand. Rendering takes minutes: say so.`
