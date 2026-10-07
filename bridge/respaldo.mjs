import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import * as fsp from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { readTelegram } from './telegram-config.mjs'

/**
 * A backup of everything that is Nexy, onto the owner's external drive, when
 * he asks for it ("Nexy, haz un respaldo", on Telegram or by voice) or with
 * `node scripts/respaldo.mjs`.
 *
 * Where it goes is set once on this Mac (`node scripts/respaldo.mjs configurar
 * Lexar`), never by the model: the tool takes no path. Inside that folder:
 *
 *   cerebro/<fecha>/   ~/.nexy, the Gmail and Calendar sign-ins, the connector
 *                      list (~/.claude.json) and the NEXY_/JARVIS_/ELEVENLABS_
 *                      settings from ~/.zshrc. A dated copy each time; the
 *                      last 15 are kept. Small.
 *   archivos/          ~/Documents/Nexy and ~/Movies/Nexy, mirrored: only new
 *                      or changed files are copied, and nothing is ever
 *                      deleted from the backup. Big, so copied once.
 *
 * It holds the keys, as the owner chose: the drive should be kept like a wallet.
 * Works on any drive format (ExFAT too): plain files, no permissions needed.
 */

const HOME = homedir()
export const BACKUP_FILE = join(HOME, '.nexy', 'respaldo.json')
const FOLDER = 'Nexy-respaldo'
const KEEP = 15
const ENV_LINE = /^\s*export\s+(NEXY_|JARVIS_|ELEVENLABS_)[A-Z0-9_]*=/

/** The brain: small, kept as dated copies. */
const BRAIN = [
  ['.nexy', (rel) => !/^(sesiones|bin)(\/|$)/.test(rel) && rel !== 'mudada.json'],
  ['.gmail-mcp'],
  [join('.config', 'nexy')],
  [join('.config', 'google-calendar-mcp')],
]
/** The files: big, mirrored. */
const FILES = [join('Documents', 'Nexy'), join('Movies', 'Nexy')]

const JUNK = /(^|\/)(\.DS_Store|\._[^/]*|\.Spotlight-V100|\.Trashes|node_modules)(\/|$)/

export function readBackup() {
  try {
    const cfg = JSON.parse(readFileSync(BACKUP_FILE, 'utf8'))
    return typeof cfg?.disco === 'string' && cfg.disco ? cfg : null
  } catch {
    return null
  }
}

export function writeBackup(cfg) {
  mkdirSync(dirname(BACKUP_FILE), { recursive: true })
  writeFileSync(BACKUP_FILE, `${JSON.stringify(cfg, null, 2)}\n`)
}

/** Where the backup goes, or why it cannot go. */
export function target(cfg = readBackup(), volumes = '/Volumes') {
  if (!cfg) return { error: 'Backups are not set up on this Mac yet: the owner runs node scripts/respaldo.mjs configurar Lexar once.' }
  const disk = join(volumes, cfg.disco)
  if (!existsSync(disk)) return { error: `The drive "${cfg.disco}" is not connected. Ask the owner to plug it in and ask again.` }
  return { disk, dir: join(disk, FOLDER) }
}

/**
 * Copy a tree, skipping files already there with the same size and time.
 * Asynchronous, so Nexy keeps answering while gigabytes of video copy.
 */
async function mirror(src, dest, keep = () => true, count = { files: 0, bytes: 0, errors: [] }) {
  if (!existsSync(src)) return count
  const walk = async (dir) => {
    let entries = []
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch (err) {
      count.errors.push(`${dir}: ${err.code ?? err.message}`)
      return
    }
    for (const e of entries) {
      const from = join(dir, e.name)
      const rel = relative(src, from)
      if (JUNK.test(rel) || !keep(rel)) continue
      if (e.isDirectory()) {
        await walk(from)
        continue
      }
      if (!e.isFile()) continue
      const to = join(dest, rel)
      try {
        const s = await fsp.stat(from)
        const d = await fsp.stat(to).catch(() => null)
        // ExFAT keeps times to 10 ms (FAT to 2 s): close enough is the same.
        if (d && d.size === s.size && Math.abs(d.mtimeMs - s.mtimeMs) < 2100) continue
        await fsp.mkdir(dirname(to), { recursive: true })
        await fsp.copyFile(from, to)
        await fsp.utimes(to, s.atime, s.mtime)
        count.files += 1
        count.bytes += s.size
      } catch (err) {
        count.errors.push(`${rel}: ${err.code ?? err.message}`)
      }
    }
  }
  await walk(src)
  return count
}

const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}
const size = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`)

let running = null

/** Make the backup. Resolves a summary in Spanish, for the owner. */
export async function backup({ home = HOME, volumes = '/Volumes', cfg = readBackup(), now = new Date() } = {}) {
  if (running) return running
  running = (async () => {
    const t = target(cfg, volumes)
    if (t.error) throw new Error(t.error)
    const started = Date.now()
    const brain = join(t.dir, 'cerebro', stamp(now))
    mkdirSync(brain, { recursive: true })
    const b = { files: 0, bytes: 0, errors: [] }
    for (const [rel, keep] of BRAIN) await mirror(join(home, rel), join(brain, rel), keep, b)
    // The connector list and the settings, as the move script packs them.
    try {
      copyFileSync(join(home, '.claude.json'), join(brain, 'claude.json'))
      b.files += 1
    } catch {
      // no Claude config
    }
    try {
      const env = readFileSync(join(home, '.zshrc'), 'utf8').split('\n').filter((l) => ENV_LINE.test(l))
      writeFileSync(join(brain, 'variables.sh'), `${env.join('\n')}\n`)
    } catch {
      // no settings
    }
    // Only the newest copies of the brain are kept.
    const all = readdirSync(join(t.dir, 'cerebro')).filter((n) => /^\d{4}-\d\d-\d\d_\d{4}$/.test(n)).sort()
    for (const old of all.slice(0, -KEEP)) rmSync(join(t.dir, 'cerebro', old), { recursive: true, force: true })

    const f = { files: 0, bytes: 0, errors: [] }
    for (const rel of FILES) await mirror(join(home, rel), join(t.dir, 'archivos', rel), undefined, f)

    writeFileSync(
      join(t.dir, 'LEEME.txt'),
      'Respaldo de Nexy. Tiene llaves (bots de Telegram, sesiones de Google, conectores): cuida este disco como tu cartera.\n\n' +
        'cerebro/<fecha>/  lo que Nexy sabe: .nexy (empresas, manuales, memoria, contactos, rutinas, clientes, NXUS México, Telegram),\n' +
        '                  .gmail-mcp y .config (sesiones de Gmail y Calendario), claude.json (conectores) y variables.sh (ajustes).\n' +
        'archivos/         Documents/Nexy (facturas, archivos de los grupos) y Movies/Nexy (videos, música, referencias).\n\n' +
        'Para regresarlo a una Mac: copia las carpetas de cerebro/<fecha>/ a tu carpeta de usuario (las que empiezan con punto van ahí),\n' +
        'y archivos/Documents/Nexy y archivos/Movies/Nexy a Documentos y Películas. Si tienes dudas, pídeselo a Claude.\n',
    )
    const errors = [...b.errors, ...f.errors]
    const secs = Math.round((Date.now() - started) / 1000)
    writeBackup({ ...cfg, ultimo: { fecha: now.toISOString(), cerebro: stamp(now), archivos: f.files, mb: Math.round((b.bytes + f.bytes) / 1e6), errores: errors.length } })
    console.log(`[jarvis] backup: done in ${secs} s, ${f.files} file(s) copied, ${errors.length} error(s)`)
    return (
      `✅ Respaldo listo en ${cfg.disco} → ${FOLDER}.\n` +
      `• Cerebro de Nexy: copia del ${stamp(now).replace('_', ' a las ').replace(/(\d\d)(\d\d)$/, '$1:$2')} (se guardan las últimas ${KEEP}).\n` +
      `• Archivos: ${f.files ? `${f.files} nuevos o cambiados (${size(f.bytes)})` : 'ya estaban todos al día'}.\n` +
      `• Tardó ${secs < 60 ? `${secs} s` : `${Math.round(secs / 60)} min`}.` +
      (errors.length ? `\n⚠️ ${errors.length} archivo(s) no se pudieron copiar, por ejemplo: ${errors.slice(0, 3).join('; ')}` : '')
    )
  })()
  try {
    return await running
  } finally {
    running = null
  }
}

async function tellOwner(text) {
  const tg = readTelegram()
  if (!tg?.token || !tg.owner?.id) return
  try {
    await fetch(`https://api.telegram.org/bot${tg.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: tg.owner.id, text }),
    })
  } catch {
    // the console log has it
  }
}

/** Nexy's tool: start a backup; the result reaches the owner's Telegram. */
export function backupServer() {
  return createSdkMcpServer({
    name: 'jarvis_respaldo',
    version: '1.0.0',
    instructions: "A backup of everything that is Nexy, onto the owner's external drive.",
    tools: [
      tool(
        'make_backup',
        "Back up everything that is Nexy (her brain, sign-ins and keys, invoices, the groups' files, videos) to the owner's external drive. Only when the owner asks for a backup. Runs in the background; when it ends he gets the summary on Telegram.",
        {},
        async () => {
          const t = target()
          if (t.error) return { isError: true, content: [{ type: 'text', text: t.error }] }
          if (running) return { content: [{ type: 'text', text: 'A backup is already running; he will get the summary on Telegram when it ends.' }] }
          void backup()
            .then((summary) => tellOwner(summary))
            .catch((err) => tellOwner(`❌ No se pudo hacer el respaldo: ${err.message}`))
          return {
            content: [{ type: 'text', text: `Started, onto "${readBackup().disco}". Tell him in one line; the summary reaches his Telegram when it ends (the first one can take a while because of the videos).` }],
          }
        },
      ),
      tool('backup_status', 'When the last backup was made and onto which drive.', {}, async () => {
        const cfg = readBackup()
        if (!cfg) return { content: [{ type: 'text', text: 'Backups are not set up yet.' }] }
        const u = cfg.ultimo
        return {
          content: [
            {
              type: 'text',
              text: `Drive: ${cfg.disco} (${existsSync(join('/Volumes', cfg.disco)) ? 'connected' : 'not connected'}). ` +
                (u ? `Last backup: ${u.fecha}, ${u.archivos} file(s) copied, ${u.errores} error(s).` : 'No backup made yet.') +
                (running ? ' One is running now.' : ''),
            },
          ],
        }
      }),
    ],
  })
}
