import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findFfmpeg } from './video.mjs'

/**
 * The 4×4 Zebra labels Mi Semago prints, kept as data so Ana Sofi can change
 * them from Telegram: products, logos, a few safe design settings. One label
 * set per company (a category in the program): the GS1 case labels with a
 * barcode (tipo gs1: Mi Semago, Diamond Rock) and the traceability labels
 * without one (tipo traza: Abuelito, Río Lindo, … and Laboratorio).
 * Each change keeps the version before it, so anything can be undone.
 * Publishing builds ONE program with every company, the file the printer's
 * computer opens (the template is bridge/etiquetas/plantilla.html, the one
 * that prints well). Orders to print from Telegram go to a small queue file
 * next to it, which that program reads and prints by itself.
 *
 *   ~/.nexy/etiquetas/<empresa>.json            the label set as it is now
 *   ~/.nexy/etiquetas/historial/<empresa>/…     every earlier version
 *   ~/.nexy/etiquetas/recibidos/                images sent in the group (logos, samples)
 *   ~/Documents/Nexy/etiquetas/Etiquetas.html   the published program (and in the shared folder)
 *   <shared folder>/cola-impresion.js           print orders from Telegram
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const TEMPLATE = join(HERE, 'etiquetas', 'plantilla.html')
const SEEDS = join(HERE, 'etiquetas', 'clientes')
export const LABELS_DIR = join(homedir(), '.nexy', 'etiquetas')
const HISTORY = join(LABELS_DIR, 'historial')
export const RECEIVED = join(LABELS_DIR, 'recibidos')
export const PUBLISHED = join(homedir(), 'Documents', 'Nexy', 'etiquetas')
// Where the printer's computer reads the programs from: a Google Drive folder
// synced on this Mac and on that computer (set with node scripts/anasofi.mjs carpeta).
const CONFIG = join(LABELS_DIR, '_ajustes.json')
export const readLabelConfig = () => {
  try {
    return JSON.parse(readFileSync(CONFIG, 'utf8')) ?? {}
  } catch {
    return {}
  }
}
export function writeLabelConfig(cfg) {
  mkdirSync(LABELS_DIR, { recursive: true })
  writeFileSync(CONFIG, `${JSON.stringify(cfg, null, 2)}\n`)
}
/** The shared folder, when it is set and there. */
export const sharedFolder = () => {
  const f = readLabelConfig().carpeta
  return f && existsSync(f) ? f : null
}

const ID = /^[a-z0-9-]{2,40}$/
const KEEP_VERSIONS = 200
const FIELDS = ['brand', 'name1', 'name2', 'english', 'pack', 'upc', 'days']
export const SIZES = ['codigo_texto', 'marca', 'nombre', 'ingles', 'presentacion', 'lote_titulo', 'lote', 'sell_titulo', 'sell', 'item', 'upc', 'keep', 'titulo', 'lineas', 'nota', 'empaque']
const TEXTS = ['keep', 'lote_titulo', 'sell_titulo']
const SHOWN = ['ingles', 'item', 'upc', 'codigo_texto', 'keep', 'lineas', 'nota', 'empaque']
export const PROGRAM = 'Etiquetas.html'
export const QUEUE_FILE = 'cola-impresion.js'
const EMPAQUES = ['VACIO', 'REGULAR', '']
// The order of the buttons: these first, Otros and Laboratorio last, the rest by name.
const FIRST = ['mi-semago', 'diamond-rock']
const LAST = ['otros', 'laboratorio']

// -- the data ------------------------------------------------------------------

const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

/**
 * The label sets as they were delivered, each copied once (after that, the
 * copy here is the one Ana Sofi changes). Catalog 2 put everything in one
 * program: Depensa was the same twenty products as Mi Semago without a logo
 * (now "Sin logo" in Mi Semago), and Diamond Rock repeated two of them.
 */
const CATALOG_VERSION = 2
const CATALOG_FILE = join(LABELS_DIR, '_catalogo.json')
let seeded = false
function seed() {
  if (seeded) return
  seeded = true
  mkdirSync(LABELS_DIR, { recursive: true })
  const version = (() => {
    try {
      return JSON.parse(readFileSync(CATALOG_FILE, 'utf8')).version ?? 1
    } catch {
      return existsSync(join(LABELS_DIR, 'mi-semago.json')) ? 1 : CATALOG_VERSION
    }
  })()
  if (version < 2) {
    const dep = join(LABELS_DIR, 'depensa.json')
    if (existsSync(dep)) {
      const c = JSON.parse(readFileSync(dep, 'utf8'))
      saveClient(c, { quien: 'Nexy', que: 'se juntó con Mi Semago (mismos productos; Sin logo = Depensa)' })
      rmSync(dep, { force: true })
    }
    const dr = readJson(join(LABELS_DIR, 'diamond-rock.json'))
    if (dr?.productos) {
      const repeated = new Set(['CH1135', 'CH1101'])
      if (dr.productos.some((p) => repeated.has(p.code))) saveClient({ ...dr, productos: dr.productos.filter((p) => !repeated.has(p.code)) }, { quien: 'Nexy', que: 'quitó CH1135 y CH1101, que ya están en Mi Semago' })
    }
  }
  if (existsSync(SEEDS)) for (const f of readdirSync(SEEDS)) if (f.endsWith('.json') && !existsSync(join(LABELS_DIR, f))) copyFileSync(join(SEEDS, f), join(LABELS_DIR, f))
  writeFileSync(CATALOG_FILE, `${JSON.stringify({ version: CATALOG_VERSION })}\n`)
}
const readJson = (f) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8'))
  } catch {
    return null
  }
}

const rank = (c) => (FIRST.includes(c.id) ? FIRST.indexOf(c.id) - 100 : LAST.includes(c.id) ? 100 + LAST.indexOf(c.id) : 0)
export function listClients() {
  seed()
  return readdirSync(LABELS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readClient(f.slice(0, -5)))
    .filter((c) => Array.isArray(c?.productos))
    .sort((a, b) => rank(a) - rank(b) || a.nombre.localeCompare(b.nombre, 'es'))
}

export function readClient(id) {
  if (!ID.test(String(id))) return null
  seed()
  const c = readJson(join(LABELS_DIR, `${id}.json`))
  return c ? { ...c, tipo: c.tipo === 'traza' ? 'traza' : 'gs1' } : null
}
/** Which company a product code belongs to, when only the code is given (codes are unique across companies). */
export function findProduct(code) {
  const want = String(code ?? '').trim().toUpperCase()
  for (const c of listClients()) {
    const p = c.productos.find((x) => x.code.toUpperCase() === want)
    if (p) return { c, p }
  }
  return null
}

/** Save a label set, keeping the one before it. */
export function saveClient(c, { quien = 'alguien', que = '' } = {}) {
  mkdirSync(LABELS_DIR, { recursive: true })
  const file = join(LABELS_DIR, `${c.id}.json`)
  if (existsSync(file)) {
    const dir = join(HISTORY, c.id)
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const before = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(join(dir, `${stamp}.json`), JSON.stringify({ ...before, _cambio: { quien, que, at: new Date().toISOString() } }))
    const all = readdirSync(dir).sort()
    for (const old of all.slice(0, -KEEP_VERSIONS)) rmSync(join(dir, old), { force: true })
  }
  writeFileSync(file, JSON.stringify(c, null, 1))
}

/** The versions of a label set, newest first: what each change was, and by whom. */
export function history(id) {
  const dir = join(HISTORY, id)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f, i) => {
      let cambio = {}
      try {
        cambio = JSON.parse(readFileSync(join(dir, f), 'utf8'))._cambio ?? {}
      } catch {
        // an unreadable version is still listed
      }
      return { n: i + 1, file: f, ...cambio }
    })
}

/** Put a label set back as it was before change n (1 = the last change). */
export function restore(id, n, quien) {
  const v = history(id).find((x) => x.n === n)
  if (!v) return null
  const before = JSON.parse(readFileSync(join(HISTORY, id, v.file), 'utf8'))
  delete before._cambio
  saveClient(before, { quien, que: `regresó a como estaba antes de: ${v.que || 'cambio'}` })
  return before
}

// -- checks ----------------------------------------------------------------------

export function upcCheck(d11) {
  let odd = 0
  let even = 0
  for (let i = 0; i < 11; i++) {
    if (i % 2 === 0) odd += +d11[i]
    else even += +d11[i]
  }
  return String((10 - ((odd * 3 + even) % 10)) % 10)
}

/** A traceability product (no barcode) as it may be saved, or the reason it cannot. */
export function cleanTraza(p) {
  const t = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
  const code = t(p.code, 20).toUpperCase()
  if (!/^[\w.-]{1,20}$/.test(code)) return { error: 'The product code must be 1-20 letters, numbers, dots or dashes.' }
  const name1 = t(p.name1, 40)
  if (!name1) return { error: 'The product needs a name (the big line on top).' }
  const lineas = (Array.isArray(p.lineas) ? p.lineas : []).map((l) => t(l, 50)).filter(Boolean)
  if (lineas.length > 3) return { error: 'At most 3 lines for the company and address.' }
  const empaque = t(p.empaque, 10).toUpperCase().replace('VACÍO', 'VACIO')
  if (!EMPAQUES.includes(empaque)) return { error: 'Empaque is VACIO, REGULAR or empty.' }
  const days = Number(p.days)
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: 'Shelf life (days for the sell by) must be a whole number from 1 to 365.' }
  const nota = t(p.nota, 50)
  return { product: { code, name1, pack: t(p.pack, 40), lineas, empaque, days, ...(nota ? { nota } : {}), ...(p.duda ? { duda: t(p.duda, 200) } : {}) } }
}

/** A product as it may be saved, or the reason it cannot. */
export function cleanProduct(p, tipo = 'gs1') {
  if (tipo === 'traza') return cleanTraza(p)
  const out = {}
  for (const k of FIELDS) if (p[k] !== undefined && p[k] !== null) out[k] = typeof p[k] === 'string' ? p[k].replace(/\s+/g, ' ').trim() : p[k]
  out.code = String(p.code ?? '').trim().toUpperCase()
  if (!/^[\w.-]{1,20}$/.test(out.code)) return { error: 'The product code (ITEM) must be 1-20 letters, numbers, dots or dashes.' }
  const upc = String(out.upc ?? '').replace(/\D/g, '')
  if (upc.length === 11) out.upc = upc + upcCheck(upc)
  else if (upc.length === 12) {
    if (upc[11] !== upcCheck(upc.slice(0, 11))) return { error: `The UPC ${upc} does not check out: its last digit should be ${upcCheck(upc.slice(0, 11))}. Ask to confirm the number.` }
    out.upc = upc
  } else return { error: 'The UPC must have 12 digits (or 11, and the last one is worked out).' }
  const days = Number(out.days)
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: 'Shelf life (days for the sell by) must be a whole number from 1 to 365.' }
  out.days = days
  if (!out.name1) return { error: 'The product needs a name.' }
  for (const k of ['brand', 'name1', 'name2', 'english', 'pack']) if (out[k] && out[k].length > 60) return { error: `${k} is too long (60 characters at most).` }
  for (const k of ['brand', 'name1', 'name2', 'english', 'pack']) out[k] = out[k] ?? ''
  return { product: { code: out.code, brand: out.brand, name1: out.name1, name2: out.name2, english: out.english, pack: out.pack, upc: out.upc, days: out.days } }
}

/**
 * Everything that would print wrong, before it prints: UPCs that do not check
 * out, repeated codes or UPCs, shelf lives out of range, missing data, and
 * texts so long the program has to shrink them a lot. Returns problems
 * (must fix) and warnings (worth a look at the preview).
 */
export function review(c) {
  if (c.tipo === 'traza') return reviewTraza(c)
  const problems = []
  const warnings = []
  const seenCode = new Map()
  const seenUpc = new Map()
  // Roughly how many capital letters fit in a line at full size (from the layout).
  const FIT = { brand: 22, name: 26, english: 42, pack: 34 }
  for (const p of c.productos) {
    const tag = p.code || '(sin código)'
    if (!/^[\w.-]{1,20}$/.test(p.code ?? '')) problems.push(`${tag}: el código (ITEM) no es válido.`)
    if (seenCode.has(p.code)) problems.push(`${tag}: el código está repetido.`)
    seenCode.set(p.code, true)
    if (!/^\d{12}$/.test(p.upc ?? '')) problems.push(`${tag}: el UPC no tiene 12 dígitos.`)
    else if (p.upc[11] !== upcCheck(p.upc.slice(0, 11))) problems.push(`${tag}: el UPC ${p.upc} no cuadra (debería terminar en ${upcCheck(p.upc.slice(0, 11))}).`)
    if (seenUpc.has(p.upc)) warnings.push(`${tag}: tiene el mismo UPC que ${seenUpc.get(p.upc)}; dos productos distintos normalmente no comparten UPC.`)
    seenUpc.set(p.upc, tag)
    if (!Number.isInteger(p.days) || p.days < 1 || p.days > 365) problems.push(`${tag}: los días de vida (${p.days}) no son válidos.`)
    if (!p.name1) problems.push(`${tag}: no tiene nombre.`)
    if (!p.pack) warnings.push(`${tag}: no tiene presentación.`)
    if (!p.english) warnings.push(`${tag}: no tiene descripción en inglés.`)
    const name = [p.name1, p.name2].filter(Boolean).join(' ')
    if (name.length > FIT.name * 2) warnings.push(`${tag}: el nombre es muy largo (${name.length} letras); saldrá más chico. Mejor acortarlo.`)
    if ((p.brand ?? '').length > FIT.brand) warnings.push(`${tag}: la marca es larga; saldrá más chica.`)
    if ((p.english ?? '').length > FIT.english) warnings.push(`${tag}: la descripción en inglés es larga; saldrá más chica.`)
    if ((p.pack ?? '').length > FIT.pack) warnings.push(`${tag}: la presentación es larga; saldrá más chica.`)
    if (/[^\x20-\x7E\u00C0-\u017F·]/.test([p.brand, p.name1, p.name2, p.english, p.pack].join(''))) warnings.push(`${tag}: tiene caracteres raros (emojis o símbolos) que la impresora puede no tener.`)
  }
  if (!c.productos.length) problems.push('No tiene productos.')
  if (!c.sin_logo && c.logo_inicial && c.logo_inicial !== 'none' && c.logo_inicial !== 'texto' && !c.logos?.[c.logo_inicial]) problems.push(`El logo que sale por defecto (${c.logo_inicial}) ya no existe.`)
  return { problems, warnings }
}

function reviewTraza(c) {
  const problems = []
  const warnings = []
  const seen = new Map()
  for (const p of c.productos) {
    const tag = p.code || '(sin código)'
    const r = cleanTraza(p)
    if (r.error) problems.push(`${tag}: ${r.error}`)
    if (seen.has(p.code)) problems.push(`${tag}: el código está repetido.`)
    seen.set(p.code, true)
    if ((p.name1 ?? '').length > 26) warnings.push(`${tag}: el nombre es largo; saldrá en dos renglones o más chico.`)
    if ((p.pack ?? '').length > 28) warnings.push(`${tag}: la presentación es larga; saldrá más chica.`)
    if ((p.lineas ?? []).some((l) => l.length > 36)) warnings.push(`${tag}: un renglón de la dirección es largo; saldrá más chico.`)
    if (p.duda) warnings.push(`${tag}: por confirmar — ${p.duda}`)
  }
  // The same label twice under different codes.
  const same = new Map()
  for (const p of c.productos) {
    const k = [p.name1, p.pack, (p.lineas ?? []).join('|'), p.empaque].join('·').toUpperCase()
    if (same.has(k)) warnings.push(`${p.code}: es igual a ${same.get(k)}.`)
    else same.set(k, p.code)
  }
  if (!c.productos.length) problems.push('No tiene productos.')
  return { problems, warnings }
}

// -- the program ------------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** One company as the program sees it. */
function forProgram(c) {
  const logos = c.tipo === 'traza' ? {} : Object.fromEntries(Object.entries(c.logos ?? {}).map(([k, v]) => [k, { nombre: v.nombre ?? k, png: v.png, at: v.at, gfa: v.gfa }]))
  return {
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    productos: c.productos.map(({ duda: _d, ...p }) => p),
    diseno: c.diseno ?? {},
    logos,
    logo: c.sin_logo || c.tipo === 'traza' ? 'none' : c.logo_inicial && (logos[c.logo_inicial] || c.logo_inicial === 'texto') ? c.logo_inicial : 'none',
    texto: c.texto_inicial ?? {},
    sinLogo: Boolean(c.sin_logo) || c.tipo === 'traza',
  }
}

/** The one program, every company a button. */
export function buildCatalog(version = '', sets = listClients()) {
  const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c')
  return readFileSync(TEMPLATE, 'utf8')
    .replace('__TITLE__', 'Etiquetas Zebra 4×4')
    .replace('__VERSION__', esc(version))
    .replace('__CATALOG__', json(sets.map(forProgram)))
}
/** Kept for callers that build one company: the whole program, opened on it. */
export const buildHtml = (_c, version = '') => buildCatalog(version)

export const programName = () => PROGRAM

/**
 * Build the program and keep it in ~/Documents/Nexy/etiquetas and, when it is
 * set, in the shared Google Drive folder the printer's computer opens it from.
 * The header says which version it is, so they can tell they have the latest.
 */
export function publish(_c, nota = '') {
  const when = new Date().toLocaleString('es-MX', { timeZone: 'America/New_York', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  const html = buildCatalog(`Versión del ${when}${nota ? ` · ${String(nota).slice(0, 80)}` : ''}`)
  mkdirSync(PUBLISHED, { recursive: true })
  const path = join(PUBLISHED, PROGRAM)
  writeFileSync(path, html)
  const folder = sharedFolder()
  let shared = null
  if (folder) {
    shared = join(folder, PROGRAM)
    writeFileSync(shared, html)
  }
  return { path, shared }
}

// -- printing from Telegram ---------------------------------------------------------

export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const JOB_HOURS = 6
const MAX_JOBS = 60

/**
 * An order to print, left in the shared folder for the program open on the
 * printer's computer (the one ticked as "la computadora de la Zebra"): it reads
 * the queue every 15 seconds and prints each order once. The program works out
 * the lot and sell by itself, from the production date and the days of life.
 */
export function queuePrint({ c, p, qty, fecha, logo, quien }) {
  const folder = sharedFolder()
  if (!folder) return { error: 'The shared Google Drive folder is not set up on this Mac (node scripts/anasofi.mjs carpeta), so nothing can reach the printer from here.' }
  const file = join(folder, QUEUE_FILE)
  let jobs = []
  try {
    const m = readFileSync(file, 'utf8').match(/colaImpresion\((\[[\s\S]*\])\)/)
    jobs = m ? JSON.parse(m[1]) : []
  } catch {
    jobs = []
  }
  const now = Date.now()
  jobs = jobs.filter((j) => now - Number(j.at) < JOB_HOURS * 3600e3).slice(-MAX_JOBS + 1)
  const job = { id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`, at: now, cat: c.id, code: p.code, qty, fecha, ...(logo ? { logo } : {}), quien: String(quien ?? '').slice(0, 60) }
  jobs.push(job)
  writeFileSync(file, `// Pedidos de impresión de Telegram (Ana Sofi y Nexy). Los lee Etiquetas.html.\nwindow.colaImpresion && window.colaImpresion(${JSON.stringify(jobs)});\n`)
  return { job, folder }
}

// -- pictures ---------------------------------------------------------------------

export const CHROMES = [
  process.env.NEXY_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean)

export const run = (cmd, args, { input, ms = 60_000 } = {}) =>
  new Promise((resolve) => {
    let err = ''
    const out = []
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] })
    p.stdout.on('data', (b) => out.push(b))
    p.stderr.on('data', (b) => (err = (err + b).slice(-3000)))
    const t = setTimeout(() => p.kill('SIGKILL'), ms)
    p.on('error', (e) => resolve({ ok: false, err: e.message, out: Buffer.alloc(0) }))
    p.on('close', (code) => {
      clearTimeout(t)
      resolve({ ok: code === 0, err, out: Buffer.concat(out) })
    })
    if (input) p.stdin.end(input)
  })

/** One product's label as a PNG, drawn by the same program the printer uses. */
export async function preview(c, code, { logo, fecha } = {}) {
  const chrome = CHROMES.find((p) => existsSync(p))
  if (!chrome) return { error: 'Chrome is not installed on this Mac, so no picture can be drawn.' }
  const p = c.productos.find((x) => x.code === code) ?? c.productos[0]
  if (!p) return { error: 'This label set has no products.' }
  const dir = mkdtempSync(join(tmpdir(), 'nexy-etiqueta-'))
  try {
    const html = join(dir, 'e.html')
    writeFileSync(html, buildCatalog())
    const png = join(dir, 'e.png')
    const hash = new URLSearchParams({ cat: c.id, prod: p.code, ...(logo ? { logo } : {}), ...(fecha ? { fprod: fecha } : {}) }).toString()
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      // Taller than the label: the window's own bars eat into the height; cropped below.
      '--window-size=812,1000',
      `--user-data-dir=${join(dir, 'profile')}`,
      '--virtual-time-budget=4000',
      `--screenshot=${png}`,
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      `${pathToFileURL(html).href}#preview&${hash}`,
    ]
    const r = await run(chrome, args, { ms: 60_000 })
    if (!existsSync(png)) return { error: `Could not draw the label (${r.err.split('\n').filter(Boolean).pop() ?? 'Chrome failed'}).` }
    const ffmpeg = findFfmpeg()
    if (ffmpeg) {
      const cut = await run(ffmpeg, ['-v', 'error', '-i', png, '-vf', 'crop=812:812:0:0', '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], { ms: 20_000 })
      if (cut.ok && cut.out.length) return { png: cut.out, product: p }
    }
    return { png: readFileSync(png), product: p }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * A logo for the bottom of the label, from an image someone sent: pure black
 * and white (a thermal printer has no grey), a picture for the program and the
 * ZPL graphic (^GFA) for Browser Print at 203 and 300 dpi.
 * `lugar`: centro (the whole bottom), izquierda or derecha (half each).
 */
export async function makeLogo(path, lugar = 'centro') {
  const ffmpeg = findFfmpeg()
  if (!ffmpeg) return { error: 'FFmpeg is not on this Mac, so the image cannot be prepared.' }
  // Its size first, to keep its proportions.
  const probe = await run(ffmpeg, ['-i', path], { ms: 20_000 })
  const m = probe.err.match(/,\s*(\d{2,5})x(\d{2,5})[\s,]/)
  if (!m) return { error: 'That file does not look like an image (PNG or JPG).' }
  const [iw, ih] = [Number(m[1]), Number(m[2])]
  const box = { centro: { x: 24, w: 764 }, izquierda: { x: 24, w: 372 }, derecha: { x: 416, w: 372 } }[lugar] ?? { x: 24, w: 764 }
  const top = 662
  const maxH = 142
  let w = box.w
  let h = Math.round((ih * w) / iw)
  if (h > maxH) {
    h = maxH
    w = Math.round((iw * h) / ih)
  }
  const at = { x: box.x + Math.round((box.w - w) / 2), y: top + Math.round((maxH - h) / 2), w, h }
  const gray = async (W, H) => {
    const r = await run(ffmpeg, ['-v', 'error', '-i', path, '-vf', `scale=${W}:${H}:flags=lanczos,format=gray`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { ms: 30_000 })
    return r.ok && r.out.length >= W * H ? r.out.subarray(0, W * H) : null
  }
  const gfa = async (W, H) => {
    const px = await gray(W, H)
    if (!px) return null
    const bpr = Math.ceil(W / 8)
    const bytes = Buffer.alloc(bpr * H)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[y * W + x] < 160) bytes[y * bpr + (x >> 3)] |= 0x80 >> (x & 7)
    return { total: bytes.length, bpr, hex: bytes.toString('hex').toUpperCase() }
  }
  // The picture at three times the 203-dpi size, so a 300 or 600 dpi printer gets detail.
  const W3 = w * 3
  const H3 = h * 3
  const px = await gray(W3, H3)
  if (!px) return { error: 'Could not read that image.' }
  for (let i = 0; i < px.length; i++) px[i] = px[i] < 160 ? 0 : 255
  const png = await run(ffmpeg, ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${W3}x${H3}`, '-i', '-', '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], { input: px, ms: 30_000 })
  if (!png.ok || !png.out.length) return { error: 'Could not prepare that image.' }
  const g203 = await gfa(w, h)
  const g300 = await gfa(Math.round((w * 300) / 203), Math.round((h * 300) / 203))
  if (!g203 || !g300) return { error: 'Could not prepare that image for the printer.' }
  return { png: `data:image/png;base64,${png.out.toString('base64')}`, at, gfa203: g203, gfa300: g300 }
}

// -- Ana Sofi's tools ---------------------------------------------------------------

const productLine = (p) =>
  p.upc
    ? `${p.code} · ${[p.brand, p.name1, p.name2].filter(Boolean).join(' / ')} · ${p.english || '—'} · ${p.pack} · UPC ${p.upc} · ${p.days} días`
    : `${p.code} · ${p.name1} · ${p.pack || '—'} · ${(p.lineas ?? []).join(' / ') || 'sin dirección'} · ${p.empaque ? `empaque ${p.empaque}` : 'sin empaque'} · ${p.days} días${p.nota ? ` · ${p.nota}` : ''}${p.duda ? ` · POR CONFIRMAR: ${p.duda}` : ''}`
const PRODUCT_FIELDS = {
  code: z.string().optional().describe('A new code, to rename it.'),
  brand: z.string().optional().describe('Barcode labels only.'),
  name1: z.string().optional().describe('Barcode labels: the name. Traceability labels: the big line on top.'),
  name2: z.string().optional().describe('Barcode labels only: second line of the name.'),
  english: z.string().optional().describe('Barcode labels only.'),
  pack: z.string().optional().describe('The size line (in the black band).'),
  upc: z.string().optional().describe('Barcode labels only: 12 digits, checked.'),
  days: z.number().optional().describe('Shelf life: sell by = production date + days.'),
  lineas: z.array(z.string()).max(3).optional().describe('Traceability labels only: up to 3 lines, the company and its address.'),
  empaque: z.enum(['VACIO', 'REGULAR', '']).optional().describe('Traceability labels only.'),
  nota: z.string().optional().describe('Traceability labels only: a small extra line (e.g. "6 PZS / 5 LB · P/CJS").'),
}

/**
 * The only things Ana Sofi can do: the label sets. `files()` gives the images
 * sent in the group (id → path); `post` and `postFile` write in the group.
 */
export function labelTools({ who, files, post, postPhoto, postFile }) {
  const ok = (text) => ({ content: [{ type: 'text', text }] })
  const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })
  const get = (cliente) => readClient(cliente) ?? null
  const unknown = (cliente) => refuse(`There is no label set "${cliente}". The ones there are: ${listClients().map((c) => `${c.id} (${c.nombre})`).join(', ')}.`)
  const change = (c, que) => {
    saveClient(c, { quien: who(), que })
    return ok(`Saved: ${que}. Show it with vista_previa; it reaches the printer's computer when you publicar.`)
  }
  return createSdkMcpServer({
    name: 'et',
    version: '1.0.0',
    instructions: "Mi Semago's 4×4 Zebra labels, one program with a button per company: products, logos, design, previews, publishing, undo and printing.",
    tools: [
      tool('al_grupo', 'Write in the group.', { texto: z.string() }, async ({ texto }) => {
        await post(texto)
        return ok('Sent.')
      }),
      tool('clientes', 'The companies (label sets) there are, each a button in the program, with their kind and how many products.', {}, async () =>
        ok(listClients().map((c) => `${c.id} · ${c.nombre} · ${c.tipo === 'traza' ? 'trazabilidad (sin código de barras)' : 'con código de barras'} · ${c.productos.length} productos${c.tipo === 'traza' ? '' : ` · logos: ${Object.values(c.logos ?? {}).map((l) => l.nombre).join(', ') || (c.sin_logo ? 'no lleva' : 'ninguno')}`}`).join('\n')),
      ),
      tool('buscar', 'Find products in every company by words (name, size, code, company), e.g. "quesillo abuelito 5 libras vacio".', { texto: z.string() }, async ({ texto }) => {
        const fold = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        const words = fold(texto).split(/\s+/).filter(Boolean)
        const hits = []
        for (const c of listClients()) for (const p of c.productos) {
          const hay = fold(`${c.nombre} ${c.id} ${productLine(p)}`)
          if (words.every((w) => hay.includes(w))) hits.push(`${c.id} · ${productLine(p)}`)
        }
        return ok(hits.length ? hits.slice(0, 40).join('\n') + (hits.length > 40 ? `\n…and ${hits.length - 40} more: be more specific.` : '') : 'Nothing matches all those words.')
      }),
      tool(
        'imprimir',
        "Print labels on the Zebra at Mi Semago, from here: the order goes to the program open on the printer's computer, which prints it by itself within a minute (it works out the lot and sell by from the production date and the product's days). Only when someone in the group asks to print, after confirming which product (code) and how many. fecha: production date YYYY-MM-DD, today if not given.",
        { codigo: z.string(), cantidad: z.number().int().min(1).max(500), cliente: z.string().optional(), fecha: z.string().optional(), logo: z.string().optional().describe('Barcode labels with logos only: tqf, 3ac, both, texto or none.') },
        async ({ codigo, cantidad, cliente, fecha, logo }) => {
          const hit = cliente ? (() => { const c = get(cliente); const p = c?.productos.find((x) => x.code.toUpperCase() === codigo.toUpperCase()); return c && p ? { c, p } : null })() : findProduct(codigo)
          if (!hit) return refuse(`There is no product ${codigo}${cliente ? ` in ${cliente}` : ''}. Use buscar.`)
          if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return refuse('fecha is YYYY-MM-DD.')
          if (logo && hit.c.tipo !== 'traza' && !['texto', 'none'].includes(logo) && !hit.c.logos?.[logo]) return refuse(`${hit.c.nombre} has no logo ${logo}.`)
          const r = queuePrint({ c: hit.c, p: hit.p, qty: cantidad, fecha: fecha || today(), logo, quien: who() })
          if (r.error) return refuse(r.error)
          return ok(`Sent to the printer's computer: ${cantidad} × ${productLine(hit.p)} (${hit.c.nombre}), production ${fecha || today()}. It prints within a minute if the program is open there and ticked as the Zebra's computer (Opciones avanzadas); if that computer has no Zebra Browser Print, a button appears there to print it.`)
        },
      ),
      tool('productos', "A label set's products and its design settings.", { cliente: z.string() }, async ({ cliente }) => {
        const c = get(cliente)
        if (!c) return unknown(cliente)
        return ok(`${c.nombre}\n${c.productos.map(productLine).join('\n')}\n\nDiseño: ${JSON.stringify(c.diseno ?? {})}`)
      }),
      tool(
        'editar_producto',
        "Change a product's data. Only the fields given change. UPC: 12 digits, checked; days: shelf life for the sell by.",
        {
          cliente: z.string(),
          codigo: z.string().describe('The product code (ITEM) as it is now.'),
          cambios: z.object(PRODUCT_FIELDS),
        },
        async ({ cliente, codigo, cambios }) => {
          const c = get(cliente)
          if (!c) return unknown(cliente)
          const i = c.productos.findIndex((p) => p.code === codigo)
          if (i < 0) return refuse(`${c.nombre} has no product ${codigo}.`)
          const { duda: _resolved, ...was } = c.productos[i]
          const r = cleanProduct({ ...was, ...cambios }, c.tipo)
          if (r.error) return refuse(r.error)
          if (r.product.code !== codigo && c.productos.some((p) => p.code === r.product.code)) return refuse(`There is already a product ${r.product.code}.`)
          const before = c.productos[i]
          c.productos[i] = r.product
          const diff = Object.keys({ ...before, ...r.product }).filter((k) => String(r.product[k] ?? '') !== String(before[k] ?? '')).map((k) => `${k}: «${before[k] ?? ''}» → «${r.product[k] ?? ''}»`)
          if (!diff.length) return ok('Nothing changed: it already had those values.')
          return change(c, `${codigo}: ${diff.join('; ')}`)
        },
      ),
      tool(
        'agregar_producto',
        'Add a product to a label set. Barcode labels (gs1) need code, name1, pack, upc and days; traceability labels (traza) need code, name1, pack, lineas, empaque and days. Codes are unique across all companies.',
        {
          cliente: z.string(),
          producto: z.object({ ...PRODUCT_FIELDS, code: z.string(), name1: z.string(), days: z.number() }),
        },
        async ({ cliente, producto }) => {
          const c = get(cliente)
          if (!c) return unknown(cliente)
          const other = findProduct(producto.code)
          if (other && other.c.id !== c.id) return refuse(`The code ${producto.code} is already used in ${other.c.nombre}; pick another.`)
          const r = cleanProduct(producto, c.tipo)
          if (r.error) return refuse(r.error)
          if (c.productos.some((p) => p.code === r.product.code)) return refuse(`There is already a product ${r.product.code}; use editar_producto.`)
          c.productos.push(r.product)
          return change(c, `agregó ${productLine(r.product)}`)
        },
      ),
      tool('quitar_producto', 'Remove a product from a label set (it can be undone).', { cliente: z.string(), codigo: z.string() }, async ({ cliente, codigo }) => {
        const c = get(cliente)
        if (!c) return unknown(cliente)
        const p = c.productos.find((x) => x.code === codigo)
        if (!p) return refuse(`${c.nombre} has no product ${codigo}.`)
        c.productos = c.productos.filter((x) => x.code !== codigo)
        return change(c, `quitó ${productLine(p)}`)
      }),
      tool(
        'cambiar_diseno',
        `Safe design settings of a label set. tam: size of each text, 0.8 to 1.15 (1 = normal) for ${SIZES.join(', ')}. textos: the words of keep, lote_titulo, sell_titulo (e.g. "BEST BY"). mostrar: false hides ${SHOWN.join(', ')}. texto_abajo: up to 3 lines for the bottom when it carries text instead of a logo. Bigger redesigns are Eduardo's.`,
        {
          cliente: z.string(),
          tam: z.record(z.string(), z.number()).optional(),
          textos: z.record(z.string(), z.string()).optional(),
          mostrar: z.record(z.string(), z.boolean()).optional(),
          texto_abajo: z.array(z.string()).max(3).optional(),
        },
        async ({ cliente, tam = {}, textos = {}, mostrar = {}, texto_abajo }) => {
          const c = get(cliente)
          if (!c) return unknown(cliente)
          const d = { tam: { ...(c.diseno?.tam ?? {}) }, textos: { ...(c.diseno?.textos ?? {}) }, mostrar: { ...(c.diseno?.mostrar ?? {}) } }
          for (const [k, v] of Object.entries(tam)) {
            if (!SIZES.includes(k)) return refuse(`Unknown text "${k}". Sizes are for: ${SIZES.join(', ')}.`)
            if (v < 0.8 || v > 1.15) return refuse(`Sizes go from 0.8 to 1.15 (asked ${v} for ${k}): anything bigger would run into the next line. A bigger redesign is Eduardo's.`)
            d.tam[k] = Math.round(v * 100) / 100
          }
          for (const [k, v] of Object.entries(textos)) {
            if (!TEXTS.includes(k)) return refuse(`Only the words of ${TEXTS.join(', ')} can change.`)
            if (v.length > 30) return refuse('At most 30 characters.')
            d.textos[k] = v.toUpperCase()
          }
          for (const [k, v] of Object.entries(mostrar)) {
            if (!SHOWN.includes(k)) return refuse(`Only ${SHOWN.join(', ')} can be hidden.`)
            d.mostrar[k] = v
          }
          c.diseno = d
          if (texto_abajo) {
            const [b1 = '', b2 = '', b3 = ''] = texto_abajo.map((x) => x.slice(0, 70))
            c.texto_inicial = { b1, b2, b3 }
            if (!c.sin_logo && !c.logos?.[c.logo_inicial]) c.logo_inicial = 'texto'
          }
          return change(c, `diseño: ${JSON.stringify({ tam, textos, mostrar, ...(texto_abajo ? { texto_abajo } : {}) })}`)
        },
      ),
      tool(
        'poner_logo',
        "Put a logo option at the bottom of a label set, from images sent in the group (their ids, like E3). One image: lugar centro. Two side by side: one izquierda and one derecha. Replaces an option with the same id. Then it is the one chosen by default unless predeterminado is false.",
        {
          cliente: z.string(),
          id: z.string().describe('Short id for the option, e.g. tqf or nuevo.'),
          nombre: z.string().describe('How it shows in the program, e.g. "Triangle Quality Foods".'),
          imagenes: z.array(z.object({ archivo: z.string(), lugar: z.enum(['centro', 'izquierda', 'derecha']) })).min(1).max(2),
          predeterminado: z.boolean().optional(),
        },
        async ({ cliente, id, nombre, imagenes, predeterminado = true }) => {
          const c = get(cliente)
          if (!c) return unknown(cliente)
          if (c.sin_logo) return refuse(`${c.nombre}'s labels never carry a logo (set up that way). Changing that is Eduardo's.`)
          const key = slug(id).slice(0, 20)
          if (!key || key === 'none' || key === 'texto') return refuse('Pick another id for the option.')
          const out = { nombre: nombre.slice(0, 40), png: [], at: [], gfa: { 203: [], 300: [] } }
          for (const im of imagenes) {
            const path = files()[im.archivo]
            if (!path) return refuse(`There is no image ${im.archivo} from the group (or it was too big to download).`)
            const l = await makeLogo(path, im.lugar)
            if (l.error) return refuse(l.error)
            out.png.push(l.png)
            out.at.push(l.at)
            out.gfa[203].push(l.gfa203)
            out.gfa[300].push(l.gfa300)
          }
          c.logos = { ...(c.logos ?? {}), [key]: out }
          if (predeterminado) c.logo_inicial = key
          return change(c, `logo «${out.nombre}» (${key})${predeterminado ? ', el que sale por defecto' : ''}`)
        },
      ),
      tool('quitar_logo', 'Remove a logo option from a label set (it can be undone).', { cliente: z.string(), id: z.string() }, async ({ cliente, id }) => {
        const c = get(cliente)
        if (!c) return unknown(cliente)
        if (!c.logos?.[id]) return refuse(`${c.nombre} has no logo option ${id}. It has: ${Object.keys(c.logos ?? {}).join(', ') || 'none'}.`)
        const name = c.logos[id].nombre
        delete c.logos[id]
        if (c.logo_inicial === id) c.logo_inicial = Object.keys(c.logos)[0] ?? 'none'
        return change(c, `quitó el logo «${name}»`)
      }),
      tool(
        'vista_previa',
        'Show in the group how a product\'s label looks now (a picture of exactly what will print). Logo: an option id, "texto" or "none"; by default the one the program starts with.',
        { cliente: z.string(), codigo: z.string().optional(), logo: z.string().optional(), mensaje: z.string().optional() },
        async ({ cliente, codigo, logo, mensaje }) => {
          const c = get(cliente)
          if (!c) return unknown(cliente)
          const r = await preview(c, codigo, { logo })
          if (r.error) return refuse(r.error)
          await postPhoto(r.png, mensaje ?? `${c.nombre} · ${r.product.code} ${r.product.name1}`)
          return ok(`Shown: ${r.product.code}.`)
        },
      ),
      tool(
        'publicar',
        "Publish the label program with every change so far to the printer's computer (through the shared folder, or as a file in the group). Say what changed. Only after checking the previews.",
        { cliente: z.string(), que_cambio: z.string() },
        async ({ cliente, que_cambio }) => {
          const c = get(cliente)
          if (!c) return unknown(cliente)
          const { problems } = review(c)
          if (problems.length) return refuse(`Not published: fix these first:\n- ${problems.join('\n- ')}`)
          const { path, shared } = publish(c, que_cambio)
          // With the shared folder the printer's computer gets it by itself; without it, as a file.
          if (shared) return ok(`Published: ${path.split('/').pop()} (every company in one program) is updated in the shared folder; in a minute the printer's computer has it. Tell them in one line to reload the program (F5) and check the version line at the top.`)
          await postFile(path, `🆕 ${c.nombre}: ${que_cambio}\n\nEn la computadora de la Zebra: descarga este archivo y reemplaza el anterior (mismo nombre).`)
          return ok(`Published and sent as a file: ${path.split('/').pop()}.`)
        },
      ),
      tool('revisar', "Check a whole label set for what would print wrong (bad UPCs, repeated codes, bad shelf life, missing data, texts too long). Run it before publishing new or many changes.", { cliente: z.string() }, async ({ cliente }) => {
        const c = get(cliente)
        if (!c) return unknown(cliente)
        const { problems, warnings } = review(c)
        return ok(
          `${c.nombre}: ${c.productos.length} productos.\n` +
            (problems.length ? `MUST FIX before publishing:\n- ${problems.join('\n- ')}\n` : 'No problems.\n') +
            (warnings.length ? `Worth a look (check their previews):\n- ${warnings.join('\n- ')}` : 'No warnings.'),
        )
      }),
      tool('historial', "A label set's last changes, newest first: what, who and when (n = 1 is the last).", { cliente: z.string() }, async ({ cliente }) => {
        const c = get(cliente)
        if (!c) return unknown(cliente)
        const h = history(cliente).slice(0, 20)
        return ok(h.length ? h.map((v) => `${v.n}. ${v.at ? new Date(v.at).toLocaleString('es-MX', { timeZone: 'America/New_York' }) : ''} · ${v.quien ?? ''} · ${v.que ?? ''}`).join('\n') : 'No changes yet.')
      }),
      tool(
        'regresar',
        'Undo: put a label set back as it was before change n of historial (1 = the last change). Itself undoable.',
        { cliente: z.string(), n: z.number().int().min(1) },
        async ({ cliente, n }) => {
          if (!get(cliente)) return unknown(cliente)
          const r = restore(cliente, n, who())
          return r ? ok(`Back as it was before change ${n}. Show it and publish it if it is right.`) : refuse(`There is no change ${n}.`)
        },
      ),
      tool(
        'nuevo_cliente',
        'Start a new company (label set, a new button in the program), copying the design and kind (barcode or traceability) of an existing one, not its products.',
        { nombre: z.string(), copiar_de: z.string(), sin_logo: z.boolean().optional() },
        async ({ nombre, copiar_de, sin_logo }) => {
          const from = get(copiar_de)
          if (!from) return unknown(copiar_de)
          const id = slug(nombre)
          if (!ID.test(id)) return refuse('Give it a name with letters or numbers.')
          if (readClient(id)) return refuse(`There is already a label set ${id}.`)
          const { archivo: _archivo, ...design } = from
          const c = { ...design, id, nombre: nombre.slice(0, 40), tipo: from.tipo, store: `et-${id}`, productos: [], logos: {}, logo_inicial: 'none', texto_inicial: {}, sin_logo: from.tipo === 'traza' ? true : (sin_logo ?? from.sin_logo) }
          saveClient(c, { quien: who(), que: `creó ${nombre}` })
          return ok(`Created ${id}. Add its products with agregar_producto.`)
        },
      ),
    ],
  })
}

/**
 * The owner's own Nexy and the labels: find a product and send labels to the
 * Zebra ("imprímeme 20 del quesillo abuelito de 5 libras"). Changing the
 * labels stays with Ana Sofi's group.
 */
export function ownerLabelsServer() {
  const ok = (text) => ({ content: [{ type: 'text', text }] })
  const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })
  const fold = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return createSdkMcpServer({
    name: 'jarvis_etiquetas',
    version: '1.0.0',
    instructions: "Mi Semago's Zebra labels: find a product and print labels on the Zebra at Mi Semago.",
    tools: [
      tool('search_labels', "Find label products in every company by words (name, size, packing, company, code). Codes are unique; use one to print.", { texto: z.string() }, async ({ texto }) => {
        const words = fold(texto).split(/\s+/).filter(Boolean)
        const hits = []
        for (const c of listClients()) for (const p of c.productos) if (words.every((w) => fold(`${c.nombre} ${productLine(p)}`).includes(w))) hits.push(`${c.nombre} · ${productLine(p)}`)
        return ok(hits.length ? hits.slice(0, 30).join('\n') : 'Nothing matches all those words.')
      }),
      tool(
        'print_labels',
        "Print labels on the Zebra at Mi Semago: the order reaches the label program open on the printer's computer through the shared Drive folder and prints within a minute. Only when the owner asks, with the product (code from search_labels) and how many; if more than one product could be it, ask which. fecha: production date YYYY-MM-DD, today if not given.",
        { codigo: z.string(), cantidad: z.number().int().min(1).max(500), fecha: z.string().optional(), logo: z.string().optional() },
        async ({ codigo, cantidad, fecha, logo }) => {
          const hit = findProduct(codigo)
          if (!hit) return refuse(`There is no label product ${codigo}. Use search_labels.`)
          if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return refuse('fecha is YYYY-MM-DD.')
          const r = queuePrint({ c: hit.c, p: hit.p, qty: cantidad, fecha: fecha || today(), logo, quien: 'Eduardo (Nexy)' })
          if (r.error) return refuse(r.error)
          return ok(`Sent: ${cantidad} × ${productLine(hit.p)} (${hit.c.nombre}). It prints within a minute if the program is open on the printer's computer.`)
        },
      ),
    ],
  })
}
