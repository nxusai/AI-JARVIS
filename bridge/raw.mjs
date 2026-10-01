import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { activeBrand, findBrand, fold, MANUALS_DIR, readBrands } from './brands.mjs'

/**
 * Raw footage: each brand's folder of unedited videos and photos in the
 * owner's Google Drive, which Drive for desktop puts on this Mac under
 * ~/Library/CloudStorage. Nexy lists what is there (subfolders included),
 * picks from it, edits copies, and keeps a ledger of what she has used and
 * for what — so she prefers new footage and, when there is none, recycles old
 * footage in a different way instead of repeating a piece.
 *
 * The folders are only ever read. Each brand sees only its own folder.
 * Paths are kept relative to the home folder, so they survive a move to
 * another Mac.
 */

const FILE = join(homedir(), '.nexy', 'crudo.json')
const CLOUD = join(homedir(), 'Library', 'CloudStorage')
const VIDEO = /\.(mp4|mov|m4v|webm|avi|mts|mkv)$/i
const PHOTO = /\.(jpe?g|png|heic|webp|tiff?)$/i
const MAX_DEPTH = 8
const MAX_FILES = 2000

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })

const toHome = (p) => (p.startsWith(homedir() + sep) ? `~/${relative(homedir(), p)}` : p)
const fromHome = (p) => (String(p).startsWith('~/') ? join(homedir(), String(p).slice(2)) : String(p))

function readLinks() {
  try {
    const v = JSON.parse(readFileSync(FILE, 'utf8'))
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function writeLinks(links) {
  mkdirSync(join(homedir(), '.nexy'), { recursive: true })
  writeFileSync(FILE, JSON.stringify(links, null, 2) + '\n')
}

/** A brand's raw-footage folder on this Mac, or null. */
export function rawFolder(id) {
  const p = readLinks()[id]?.carpeta
  return p ? fromHome(p) : null
}

/** Every linked raw folder, real paths, for the editor's list of allowed sources. */
export function rawRoots() {
  const out = []
  for (const { id } of readBrands().marcas) {
    const p = rawFolder(id)
    if (!p) continue
    try {
      out.push(realpathSync(p) + sep)
    } catch {
      // Drive not running or folder moved: just not available now.
    }
  }
  return out
}

/** Where Google Drive for desktop keeps each signed-in account's drives. */
export function driveRoots() {
  try {
    return readdirSync(CLOUD)
      .filter((d) => /^GoogleDrive-/i.test(d))
      .flatMap((d) => {
        const base = join(CLOUD, d)
        try {
          return readdirSync(base)
            .filter((x) => !x.startsWith('.'))
            .map((x) => join(base, x))
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

/**
 * Folders in Drive whose name matches, shallowest first. Drive streams its
 * folders over the network, so the search stops after a few seconds rather
 * than walk a large Drive for minutes.
 */
export function findDriveFolders(name, roots = driveRoots(), limit = 12, budgetMs = 12_000) {
  const want = fold(name)
  const found = []
  const until = Date.now() + budgetMs
  let queue = roots.map((r) => [r, 0])
  while (queue.length && found.length < limit && Date.now() < until) {
    const next = []
    for (const [dir, depth] of queue) {
      if (found.length >= limit || Date.now() >= until) break
      let entries = []
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith('.')) continue
        const p = join(dir, e.name)
        if (fold(e.name).includes(want)) found.push(p)
        if (depth < 8) next.push([p, depth + 1])
      }
    }
    queue = next
  }
  return found.slice(0, limit)
}

/**
 * How much of a file is actually on this Mac. Drive's "stream files" keeps
 * only a placeholder until the file is opened, and opening a multi-gigabyte
 * video downloads all of it first — minutes, during which an edit looks stuck.
 * A placeholder occupies no disk blocks.
 */
export function onDisk(path) {
  try {
    const st = statSync(path)
    if (!st.size) return 1
    if (typeof st.blocks !== 'number') return 1
    return Math.min(1, (st.blocks * 512) / st.size)
  } catch {
    return 1
  }
}

const fetching = new Map()
/**
 * Start bringing a cloud-only file down in the background (once), so it is
 * ready on a later try. Returns how much is already here.
 */
export function prefetch(path) {
  const have = onDisk(path)
  if (have >= 0.98 || fetching.has(path)) return have
  const stream = createReadStream(path)
  fetching.set(path, stream)
  stream.on('data', () => {})
  stream.on('error', () => fetching.delete(path))
  stream.on('close', () => fetching.delete(path))
  return have
}

/** The folders directly inside a folder. */
export function subfolders(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

/** A folder the owner named, as a path: an existing path, or the one Drive folder with that name. */
export function resolveDriveFolder(q) {
  const asPath = fromHome(String(q ?? '').trim().replace(/^['"]|['"]$/g, ''))
  if (asPath.startsWith('/') && existsSync(asPath)) return { path: asPath }
  const found = findDriveFolders(String(q ?? '').split('/').filter(Boolean).pop() ?? '')
  if (found.length === 1) return { path: found[0] }
  return { candidates: found }
}

/** Every video and photo under a folder, subfolders included, newest first. */
export function listMedia(root, budgetMs = 25_000) {
  const out = []
  const until = Date.now() + budgetMs
  const walk = (dir, depth) => {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES || Date.now() > until) return
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p, depth + 1)
      else if (VIDEO.test(e.name) || PHOTO.test(e.name)) {
        let st = null
        try {
          st = statSync(p)
        } catch {
          continue
        }
        out.push({ path: p, rel: relative(root, p), kind: VIDEO.test(e.name) ? 'video' : 'foto', mb: st.size / 1048576, added: st.birthtimeMs || st.mtimeMs })
      }
    }
  }
  walk(root, 0)
  return out.sort((a, b) => b.added - a.added)
}

const ledgerFile = (id) => join(MANUALS_DIR, id, 'crudo-usado.json')

export function readLedger(id) {
  try {
    const v = JSON.parse(readFileSync(ledgerFile(id), 'utf8'))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function writeLedger(id, list) {
  mkdirSync(join(MANUALS_DIR, id), { recursive: true })
  writeFileSync(ledgerFile(id), JSON.stringify(list.slice(-3000), null, 2) + '\n')
}

const day = (ms) => new Date(ms).toISOString().slice(0, 10)

export function rawServer() {
  const brandOf = (q) => (q ? findBrand(q) : activeBrand())
  return createSdkMcpServer({
    name: 'jarvis_crudo',
    version: '1.0.0',
    instructions: "Each brand's raw footage folder in the owner's Google Drive, and what has been used from it.",
    alwaysLoad: true,
    tools: [
      tool(
        'find_drive_folder',
        "Find a folder in the owner's Google Drive (on this Mac through Drive for desktop) by its name, to link it as a brand's raw footage.",
        { name: z.string().describe('The folder name, or part of it, as the owner says it.') },
        async ({ name }) => {
          const roots = driveRoots()
          if (!roots.length) {
            return refuse('Google Drive for desktop is not on this Mac or not signed in. Ask the owner to install it, sign in, and choose "Stream files".')
          }
          const found = findDriveFolders(name, roots)
          if (!found.length) return ok(`No folder called "${name}" in Drive (looked in ${roots.map(toHome).join(', ')}). Ask the owner for the exact name.`)
          const rows = found.map((p) => {
            const kids = subfolders(p)
            return `- ${toHome(p)}${kids.length ? `\n    subfolders: ${kids.slice(0, 15).join(', ')}${kids.length > 15 ? '…' : ''}` : ''}`
          })
          return ok(`Folders that match:\n${rows.join('\n')}\nUse browse_drive_folder to look inside one. Confirm with the owner which one is the raw footage of which brand.`)
        },
      ),

      tool(
        'browse_drive_folder',
        "Look inside a folder of the owner's Google Drive: its subfolders and how many videos and photos it holds. " +
          'Use it to find the right folder yourself instead of asking the owner for paths.',
        { folder: z.string().describe('A path from find_drive_folder or this tool, or a folder name.') },
        async ({ folder }) => {
          const r = resolveDriveFolder(folder)
          if (!r.path) {
            return r.candidates?.length
              ? ok(`Several folders match:\n${r.candidates.map((p) => `- ${toHome(p)}`).join('\n')}`)
              : refuse(`No folder called "${folder}" in Drive.`)
          }
          const kids = subfolders(r.path)
          const media = listMedia(r.path)
          return ok(
            `${toHome(r.path)} — ${media.filter((m) => m.kind === 'video').length} videos and ${media.filter((m) => m.kind === 'foto').length} photos inside (subfolders included).\n` +
              (kids.length ? `Subfolders:\n${kids.map((k) => `- ${toHome(join(r.path, k))}`).join('\n')}` : 'No subfolders.'),
          )
        },
      ),

      tool(
        'link_raw_folder',
        "Make a Drive folder a brand's raw footage: Nexy picks from it, and from no other brand's, when making that brand's " +
          'content. Only when the owner says which folder is which brand. The owner approves it with a tap.',
        {
          brand: z.string(),
          folder: z.string().describe('The folder path from find_drive_folder or browse_drive_folder (or its exact name).'),
        },
        async ({ brand, folder }) => {
          const b = findBrand(brand)
          if (!b) return refuse(`There is no brand called ${brand}.`)
          const r = resolveDriveFolder(folder)
          if (!r.path) {
            return refuse(
              r.candidates?.length
                ? `Several folders match; pass the full path of the right one:\n${r.candidates.map((p) => `- ${toHome(p)}`).join('\n')}`
                : `No folder "${folder}" in Drive. Use find_drive_folder or browse_drive_folder.`,
            )
          }
          const p = r.path
          let real
          try {
            real = realpathSync(p)
          } catch {
            return refuse('That folder does not exist on this Mac.')
          }
          const inDrive = driveRoots().some((r) => {
            try {
              return real.startsWith(realpathSync(r) + sep) || real === realpathSync(r)
            } catch {
              return false
            }
          })
          if (!inDrive) return refuse('Only folders inside Google Drive can be linked as raw footage.')
          const links = readLinks()
          const taken = Object.entries(links).find(([id, v]) => id !== b.id && v?.carpeta && fromHome(v.carpeta) === p)
          if (taken) return refuse(`That folder is already the raw footage of ${findBrand(taken[0])?.nombre ?? taken[0]}.`)
          links[b.id] = { carpeta: toHome(p) }
          writeLinks(links)
          const media = listMedia(p)
          return ok(
            `Linked: ${b.nombre}'s raw footage is ${toHome(p)} — ${media.filter((m) => m.kind === 'video').length} videos and ` +
              `${media.filter((m) => m.kind === 'foto').length} photos, subfolders included.`,
          )
        },
      ),

      tool(
        'list_raw',
        "A brand's raw footage (videos and photos, subfolders included), newest first, each with how many times it has been " +
          'used and for what. Use it before making content from real footage.',
        {
          brand: z.string().optional().describe('The brand; the active one when left out.'),
          only: z.enum(['new', 'used', 'all']).optional().describe('new = never used. Default all.'),
          kind: z.enum(['video', 'foto']).optional(),
          limit: z.number().optional().describe('How many to list. Default 60.'),
        },
        async ({ brand, only, kind, limit }) => {
          const b = brandOf(brand)
          if (!b) return refuse(`There is no brand called ${brand}.`)
          const root = rawFolder(b.id)
          if (!root) return refuse(`${b.nombre} has no raw footage folder linked yet. Ask the owner which Drive folder it is (find_drive_folder, then link_raw_folder).`)
          if (!existsSync(root)) return refuse(`The raw footage folder of ${b.nombre} is not reachable (${toHome(root)}). Is Google Drive open on this Mac?`)
          const ledger = readLedger(b.id)
          const uses = new Map()
          for (const u of ledger) uses.set(u.archivo, [...(uses.get(u.archivo) ?? []), u])
          let media = listMedia(root).filter((m) => !kind || m.kind === kind)
          if (only === 'new') media = media.filter((m) => !uses.has(m.rel))
          if (only === 'used') media = media.filter((m) => uses.has(m.rel))
          const total = media.length
          const fresh = media.filter((m) => !uses.has(m.rel)).length
          const rows = media.slice(0, Math.min(Math.max(Number(limit) || 60, 1), 300)).map((m) => {
            const u = uses.get(m.rel) ?? []
            const last = u.at(-1)
            const cloud = m.mb > 20 && onDisk(m.path) < 0.98 ? ' ☁️ in the cloud, not downloaded yet' : ''
            return `- ${m.path} [${m.kind}, ${m.mb.toFixed(1)} MB, added ${day(m.added)}${cloud}] ${u.length ? `used ${u.length}× (last ${last.fecha?.slice(0, 10)}: ${last.pieza})` : 'NEW'}`
          })
          return ok(`${b.nombre} raw footage in ${toHome(root)}: ${total} files, ${fresh} never used.\n${rows.join('\n') || '(none)'}`)
        },
      ),

      tool(
        'mark_raw_used',
        'Record which raw files went into a finished piece and what the piece was, so later pieces prefer new footage and ' +
          'recycle old footage differently. Call it after the owner approves or once the piece is finished.',
        {
          files: z.array(z.string()).describe('The raw file paths used, as list_raw gave them.'),
          piece: z.string().describe('What was made, e.g. "Reel 30 s: gancho precio, subtítulos amarillos, 0:12–0:40".'),
          brand: z.string().optional(),
        },
        async ({ files, piece, brand }) => {
          const b = brandOf(brand)
          if (!b) return refuse(`There is no brand called ${brand}.`)
          const root = rawFolder(b.id)
          if (!root) return refuse(`${b.nombre} has no raw footage folder linked.`)
          const rels = (Array.isArray(files) ? files : [])
            .map((f) => relative(root, fromHome(f)))
            .filter((r) => r && !r.startsWith('..'))
          if (!rels.length) return refuse(`None of those files are in ${b.nombre}'s raw footage folder.`)
          const ledger = readLedger(b.id)
          const fecha = new Date().toISOString()
          for (const archivo of rels) ledger.push({ archivo, pieza: String(piece ?? '').slice(0, 300), fecha })
          writeLedger(b.id, ledger)
          return ok(`Noted ${rels.length} file${rels.length === 1 ? '' : 's'} as used for: ${piece}`)
        },
      ),
    ],
  })
}
