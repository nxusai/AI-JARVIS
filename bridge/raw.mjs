import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, relative, sep } from 'node:path'
import { activeBrand, findBrand, fold, MANUALS_DIR, readBrands } from './brands.mjs'

/**
 * Raw footage: each brand's folder of unedited videos and photos on the
 * owner's external memory (SSD, USB drive), which the Mac mounts under
 * /Volumes while it is plugged in. Google Drive is not used: streaming big
 * videos from it took minutes. Nexy lists what is there (subfolders included),
 * picks from it, edits copies, and keeps a ledger of what she has used and
 * for what — so she prefers new footage and, when there is none, recycles old
 * footage in a different way instead of repeating a piece.
 *
 * The folders are only ever read. Each brand sees only its own folder.
 * A folder is kept by the memory's name and the path inside it, so it is
 * found again however and wherever the memory is plugged in.
 */

const FILE = join(homedir(), '.nexy', 'crudo.json')
const VOLUMES = process.env.NEXY_VOLUMES || '/Volumes'
const VIDEO = /\.(mp4|mov|m4v|webm|avi|mts|mkv)$/i
const PHOTO = /\.(jpe?g|png|heic|webp|tiff?)$/i
const MAX_DEPTH = 8
const MAX_FILES = 2000

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })


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

/**
 * Where a brand's raw footage lives: { path, disco, conectada }. Only folders
 * on a memory count; a folder linked back when Google Drive was used is ignored.
 */
export function rawLocation(id) {
  const v = readLinks()[id]
  if (!v?.disco) return null
  const mount = mountOf(v.disco)
  return { path: join(mount ?? join(VOLUMES, v.disco), v.ruta ?? ''), disco: v.disco, conectada: Boolean(mount) }
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
      // Memory unplugged or folder moved: just not available now.
    }
  }
  return out
}

/** Folders on the plugged-in memories whose name matches, shallowest first. */
export function findFolders(name, roots = externalRoots(), limit = 12, budgetMs = 12_000) {
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

/** A folder the owner named, as a path: a path on a memory, or the one memory folder with that name. */
export function resolveFolder(q) {
  const asPath = String(q ?? '').trim().replace(/^['"]|['"]$/g, '')
  if (asPath.startsWith('/') && existsSync(asPath) && externalOf(asPath)) return { path: asPath }
  const found = findFolders(asPath.split('/').filter(Boolean).pop() ?? '')
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
    instructions: "Each brand's raw footage folder on the owner's external memory, and what has been used from it.",
    alwaysLoad: true,
    tools: [
      tool(
        'find_raw_folder',
        'Find a folder by its name on the external memory (SSD, USB drive) plugged into this Mac, to link it as a brand\'s raw footage. ' +
          'Leave the name empty to list the memories plugged in and their folders.',
        { name: z.string().describe('The folder name, or part of it, as the owner says it; empty to list the memories plugged in.') },
        async ({ name }) => {
          const memories = externalRoots()
          if (!memories.length) return refuse('No external memory is plugged into this Mac right now. Ask the owner to connect it.')
          if (!String(name ?? '').trim()) {
            return ok(
              `Memories plugged in:\n${memories.map((m) => `- ${m}${blocked(m) ? ' (macOS blocks reading it)' : ''}\n    folders: ${subfolders(m).slice(0, 20).join(', ') || '(none)'}`).join('\n')}\n` +
                'Use browse_raw_folder to look inside.',
            )
          }
          const want = fold(name)
          const found = [...memories.filter((m) => fold(basename(m)).includes(want)), ...findFolders(name, memories)]
          if (!found.length) {
            const why = memories.map(blocked).find(Boolean)
            return why ? refuse(why) : ok(`No folder called "${name}" on the memory. Ask the owner for the exact name.`)
          }
          const rows = found.map((p) => {
            const kids = subfolders(p)
            return `- ${p} (memory «${externalOf(p)?.name}»)${kids.length ? `\n    subfolders: ${kids.slice(0, 15).join(', ')}${kids.length > 15 ? '…' : ''}` : ''}`
          })
          return ok(`Folders that match:\n${rows.join('\n')}\nUse browse_raw_folder to look inside one. Confirm with the owner which one is the raw footage of which brand.`)
        },
      ),

      tool(
        'browse_raw_folder',
        'Look inside a folder of the plugged-in memory: its subfolders and how many videos and photos it holds. ' +
          'Use it to find the right folder yourself instead of asking the owner for paths.',
        { folder: z.string().describe('A path from find_raw_folder or this tool, or a folder name.') },
        async ({ folder }) => {
          const r = resolveFolder(folder)
          if (!r.path) {
            return r.candidates?.length
              ? ok(`Several folders match:\n${r.candidates.map((p) => `- ${p}`).join('\n')}`)
              : refuse(`No folder called "${folder}" on a plugged-in memory.`)
          }
          const why = blocked(r.path)
          if (why) return refuse(why)
          const kids = subfolders(r.path)
          const media = listMedia(r.path)
          return ok(
            `${r.path} — ${media.filter((m) => m.kind === 'video').length} videos and ${media.filter((m) => m.kind === 'foto').length} photos inside (subfolders included).\n` +
              (kids.length ? `Subfolders:\n${kids.map((k) => `- ${join(r.path, k)}`).join('\n')}` : 'No subfolders.'),
          )
        },
      ),

      tool(
        'link_raw_folder',
        "Make a folder on the external memory a brand's raw footage: Nexy picks from it, and from no other brand's, when making that brand's " +
          'content. Only when the owner says which folder is which brand. The owner approves it with a tap.',
        {
          brand: z.string(),
          folder: z.string().describe('The folder path from find_raw_folder or browse_raw_folder (or its exact name).'),
        },
        async ({ brand, folder }) => {
          const b = findBrand(brand)
          if (!b) return refuse(`There is no brand called ${brand}.`)
          const r = resolveFolder(folder)
          if (!r.path) {
            return refuse(
              r.candidates?.length
                ? `Several folders match; pass the full path of the right one:\n${r.candidates.map((p) => `- ${p}`).join('\n')}`
                : `No folder "${folder}" on a plugged-in memory. Use find_raw_folder or browse_raw_folder.`,
            )
          }
          const p = r.path
          const memory = externalOf(p)
          if (!memory) return refuse('Only folders on an external memory plugged into this Mac can be linked as raw footage.')
          const why = blocked(p)
          if (why) return refuse(why)
          // Folders linked back when Drive was used are dropped for good.
          const links = Object.fromEntries(Object.entries(readLinks()).filter(([, v]) => v?.disco))
          const taken = Object.entries(links).find(([id]) => id !== b.id && rawFolder(id) === p)
          if (taken) return refuse(`That folder is already the raw footage of ${findBrand(taken[0])?.nombre ?? taken[0]}.`)
          // Kept by the memory's name and the path inside it, so it is found
          // again however and wherever the memory is plugged in.
          links[b.id] = { carpeta: p, disco: memory.name, ruta: memory.rel }
          writeLinks(links)
          const media = listMedia(p)
          return ok(
            `Linked: ${b.nombre}'s raw footage is ${p} on the memory «${memory.name}» (it has to be plugged in when you edit) — ` +
              `${media.filter((m) => m.kind === 'video').length} videos and ${media.filter((m) => m.kind === 'foto').length} photos, subfolders included.`,
          )
        },
      ),

      tool(
        'list_raw',
        "A brand's raw footage on the memory (videos and photos, subfolders included), newest first, each with how many times it has been " +
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
          if (!loc) return refuse(`${b.nombre} has no raw footage folder on the memory yet. Ask the owner which folder it is (find_raw_folder, then link_raw_folder).`)
          const root = loc.path
          if (!loc.conectada) {
            return refuse(`The raw footage of ${b.nombre} is on the external memory «${loc.disco}», which is not plugged in. Ask the owner to connect it, then try again.`)
          }
          if (!existsSync(root)) {
            return refuse(`The memory «${loc.disco}» is plugged in but the folder ${loc.path} is not on it any more. Ask the owner whether it was renamed or moved.`)
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
            return `- ${m.path} [${m.kind}, ${m.mb.toFixed(1)} MB, added ${day(m.added)}] ${u.length ? `used ${u.length}× (last ${last.fecha?.slice(0, 10)}: ${last.pieza})` : 'NEW'}`
          })
          return ok(`${b.nombre} raw footage in ${root}: ${total} files, ${fresh} never used.\n${rows.join('\n') || '(none)'}`)
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
            .map((f) => relative(root, String(f)))
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
