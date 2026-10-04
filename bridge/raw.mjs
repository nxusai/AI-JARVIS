import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, relative, sep } from 'node:path'
import { activeBrand, findBrand, fold, MANUALS_DIR, readBrands } from './brands.mjs'

/**
 * Raw footage: each brand's folder of unedited videos and photos, either in
 * the owner's Google Drive, which Drive for desktop puts on this Mac under
 * ~/Library/CloudStorage, or on an external memory (SSD, USB drive) that the
 * Mac mounts under /Volumes while it is plugged in. Nexy lists what is there (subfolders included),
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
const VOLUMES = process.env.NEXY_VOLUMES || '/Volumes'
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

/**
 * External memories plugged into this Mac, by the folder macOS mounts each one
 * at. The Mac's own disk shows up there too, as a link back to /, and is left out.
 */
export function externalRoots() {
  if (process.platform !== 'darwin' && !process.env.NEXY_VOLUMES) return []
  let entries = []
  try {
    entries = readdirSync(VOLUMES, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => !e.name.startsWith('.') && !/^(Recovery|Preboot|VM|Update|com\.apple)/i.test(e.name))
    .map((e) => join(VOLUMES, e.name))
    .filter((p) => {
      try {
        return realpathSync(p) !== '/' && statSync(p).isDirectory()
      } catch {
        return false
      }
    })
}

/** The mounted folder of the memory called `name` (macOS adds " 1" to a second one with the same name). */
function mountOf(name) {
  const roots = externalRoots()
  return roots.find((r) => basename(r) === name) ?? roots.find((r) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+$`).test(basename(r))) ?? null
}

/** The memory a path is on, as { root, name }, or null for anything else. */
function externalOf(p) {
  let real
  try {
    real = realpathSync(p)
  } catch {
    return null
  }
  for (const root of externalRoots()) {
    let r
    try {
      r = realpathSync(root)
    } catch {
      continue
    }
    if (real === r || real.startsWith(r + sep)) return { root, real: r, name: basename(root), rel: relative(r, real) }
  }
  return null
}

/** Where a brand's raw footage lives: { path, disco } — disco is the memory's name when it is on one. */
export function rawLocation(id) {
  const v = readLinks()[id]
  if (!v?.carpeta) return null
  if (v.disco) {
    const mount = mountOf(v.disco)
    return { path: join(mount ?? join(VOLUMES, v.disco), v.ruta ?? ''), disco: v.disco, conectada: Boolean(mount) }
  }
  return { path: fromHome(v.carpeta), disco: null, conectada: true }
}

/** A brand's raw-footage folder on this Mac, or null. */
export function rawFolder(id) {
  return rawLocation(id)?.path ?? null
}

/** Why a memory can't be read, in words for the owner: macOS asks Terminal for permission first. */
function blocked(path) {
  try {
    readdirSync(path)
    return null
  } catch (err) {
    if (err?.code === 'EPERM' || err?.code === 'EACCES') {
      return (
        'macOS is not letting Nexy read that memory. Tell the owner: System Settings → Privacy & Security → ' +
        'Files and Folders → Terminal → turn on "Removable Volumes" (or Full Disk Access for Terminal), then try again.'
      )
    }
    return null
  }
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
  // A file on a plugged-in memory is all there; only Drive keeps placeholders.
  if (String(path).startsWith(VOLUMES + sep)) return 1
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

/** A folder the owner named, as a path: an existing path, or the one Drive or memory folder with that name. */
export function resolveDriveFolder(q) {
  const asPath = fromHome(String(q ?? '').trim().replace(/^['"]|['"]$/g, ''))
  if (asPath.startsWith('/') && existsSync(asPath)) return { path: asPath }
  const found = findDriveFolders(String(q ?? '').split('/').filter(Boolean).pop() ?? '', [...driveRoots(), ...externalRoots()])
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
    instructions: "Each brand's raw footage folder (in the owner's Google Drive or on an external memory), and what has been used from it.",
    alwaysLoad: true,
    tools: [
      tool(
        'find_drive_folder',
        "Find a folder by its name in the owner's Google Drive (on this Mac through Drive for desktop) or on an external memory " +
          '(SSD, USB drive) plugged into this Mac, to link it as a brand\'s raw footage. Leave the name empty to list the memories plugged in.',
        { name: z.string().describe('The folder name, or part of it, as the owner says it; empty to list the memories plugged in.') },
        async ({ name }) => {
          const memories = externalRoots()
          const roots = [...driveRoots(), ...memories]
          if (!String(name ?? '').trim()) {
            if (!memories.length) return ok('No external memory is plugged into this Mac right now. Ask the owner to connect it.')
            return ok(
              `Memories plugged in:\n${memories.map((m) => `- ${m}${blocked(m) ? ' (macOS blocks reading it)' : ''}\n    folders: ${subfolders(m).slice(0, 20).join(', ') || '(none)'}`).join('\n')}\n` +
                'Use browse_drive_folder to look inside.',
            )
          }
          if (!roots.length) {
            return refuse('Neither Google Drive for desktop nor an external memory is on this Mac. Ask the owner to connect the memory (or sign in to Drive).')
          }
          const want = fold(name)
          const found = [...memories.filter((m) => fold(basename(m)).includes(want)), ...findDriveFolders(name, roots)]
          if (!found.length) {
            const why = memories.map(blocked).find(Boolean)
            return why ? refuse(why) : ok(`No folder called "${name}" in Drive or on a plugged-in memory. Ask the owner for the exact name, or whether the memory is connected.`)
          }
          const rows = found.map((p) => {
            const kids = subfolders(p)
            const where = externalOf(p) ? ` (memory «${externalOf(p).name}»)` : ' (Google Drive)'
            return `- ${toHome(p)}${where}${kids.length ? `\n    subfolders: ${kids.slice(0, 15).join(', ')}${kids.length > 15 ? '…' : ''}` : ''}`
          })
          return ok(`Folders that match:\n${rows.join('\n')}\nUse browse_drive_folder to look inside one. Confirm with the owner which one is the raw footage of which brand.`)
        },
      ),

      tool(
        'browse_drive_folder',
        "Look inside a folder of the owner's Google Drive or of a plugged-in memory: its subfolders and how many videos and photos it holds. " +
          'Use it to find the right folder yourself instead of asking the owner for paths.',
        { folder: z.string().describe('A path from find_drive_folder or this tool, or a folder name.') },
        async ({ folder }) => {
          const r = resolveDriveFolder(folder)
          if (!r.path) {
            return r.candidates?.length
              ? ok(`Several folders match:\n${r.candidates.map((p) => `- ${toHome(p)}`).join('\n')}`)
              : refuse(`No folder called "${folder}" in Drive or on a plugged-in memory.`)
          }
          const why = blocked(r.path)
          if (why) return refuse(why)
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
        "Make a folder (in Drive or on an external memory) a brand's raw footage: Nexy picks from it, and from no other brand's, when making that brand's " +
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
                : `No folder "${folder}" in Drive or on a plugged-in memory. Use find_drive_folder or browse_drive_folder.`,
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
          const memory = inDrive ? null : externalOf(p)
          if (!inDrive && !memory) return refuse('Only folders inside Google Drive or on an external memory plugged into this Mac can be linked as raw footage.')
          const why = blocked(p)
          if (why) return refuse(why)
          const links = readLinks()
          const taken = Object.entries(links).find(([id]) => id !== b.id && rawFolder(id) === p)
          if (taken) return refuse(`That folder is already the raw footage of ${findBrand(taken[0])?.nombre ?? taken[0]}.`)
          // On a memory the folder is kept by the memory's name and the path inside it,
          // so it is found again however and wherever the memory is plugged in.
          links[b.id] = memory ? { carpeta: p, disco: memory.name, ruta: memory.rel } : { carpeta: toHome(p) }
          writeLinks(links)
          const media = listMedia(p)
          return ok(
            `Linked: ${b.nombre}'s raw footage is ${toHome(p)}${memory ? ` on the memory «${memory.name}» (it has to be plugged in when you edit)` : ''} — ` +
              `${media.filter((m) => m.kind === 'video').length} videos and ${media.filter((m) => m.kind === 'foto').length} photos, subfolders included.`,
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
          const loc = rawLocation(b.id)
          if (!loc) return refuse(`${b.nombre} has no raw footage folder linked yet. Ask the owner which folder it is (find_drive_folder, then link_raw_folder).`)
          const root = loc.path
          if (loc.disco && !loc.conectada) {
            return refuse(`The raw footage of ${b.nombre} is on the external memory «${loc.disco}», which is not plugged in. Ask the owner to connect it, then try again.`)
          }
          if (!existsSync(root)) {
            return refuse(
              loc.disco
                ? `The memory «${loc.disco}» is plugged in but the folder ${loc.path} is not on it any more. Ask the owner whether it was renamed or moved.`
                : `The raw footage folder of ${b.nombre} is not reachable (${toHome(root)}). Is Google Drive open on this Mac?`,
            )
          }
          const why = blocked(root)
          if (why) return refuse(why)
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
