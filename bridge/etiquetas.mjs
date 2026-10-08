import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findFfmpeg } from './video.mjs'

/**
 * The 4×4 Zebra case labels of the owner's clients (Mi Semago's customers:
 * Depensa, Diamond Rock, Mi Semago itself), kept as data so Ana Sofi can
 * change them from Telegram: products, logos, a few safe design settings.
 * Each change keeps the version before it, so anything can be undone.
 * Publishing builds the one-file program the printer's computer opens
 * (the template is bridge/etiquetas/plantilla.html, the one that prints well).
 *
 *   ~/.nexy/etiquetas/<cliente>.json            the label set as it is now
 *   ~/.nexy/etiquetas/historial/<cliente>/…     every earlier version
 *   ~/.nexy/etiquetas/recibidos/                images sent in the group (logos, samples)
 *   ~/Documents/Nexy/etiquetas/Etiquetas-….html the published programs
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const TEMPLATE = join(HERE, 'etiquetas', 'plantilla.html')
const SEEDS = join(HERE, 'etiquetas', 'clientes')
export const LABELS_DIR = join(homedir(), '.nexy', 'etiquetas')
const HISTORY = join(LABELS_DIR, 'historial')
export const RECEIVED = join(LABELS_DIR, 'recibidos')
export const PUBLISHED = join(homedir(), 'Documents', 'Nexy', 'etiquetas')

const ID = /^[a-z0-9-]{2,40}$/
const KEEP_VERSIONS = 200
const FIELDS = ['brand', 'name1', 'name2', 'english', 'pack', 'upc', 'days']
export const SIZES = ['codigo_texto', 'marca', 'nombre', 'ingles', 'presentacion', 'lote_titulo', 'lote', 'sell_titulo', 'sell', 'item', 'upc', 'keep']
const TEXTS = ['keep', 'lote_titulo', 'sell_titulo']
const SHOWN = ['ingles', 'item', 'upc', 'codigo_texto', 'keep']

// -- the data ------------------------------------------------------------------

const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

/** First run: the three label sets as they were delivered. */
function seed() {
  mkdirSync(LABELS_DIR, { recursive: true })
  if (!existsSync(SEEDS)) return
  for (const f of readdirSync(SEEDS)) if (f.endsWith('.json') && !existsSync(join(LABELS_DIR, f))) copyFileSync(join(SEEDS, f), join(LABELS_DIR, f))
}

export function listClients() {
  seed()
  return readdirSync(LABELS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readClient(f.slice(0, -5)))
    .filter(Boolean)
}

export function readClient(id) {
  if (!ID.test(String(id))) return null
  seed()
  try {
    return JSON.parse(readFileSync(join(LABELS_DIR, `${id}.json`), 'utf8'))
  } catch {
    return null
  }
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

/** A product as it may be saved, or the reason it cannot. */
export function cleanProduct(p) {
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

// -- the program ------------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function buildHtml(c) {
  const logos = Object.fromEntries(Object.entries(c.logos ?? {}).map(([k, v]) => [k, { png: v.png, at: v.at, gfa: v.gfa }]))
  const options = Object.entries(c.logos ?? {})
    .map(([k, v]) => `          <option value="${esc(k)}">${esc(v.nombre ?? k)}</option>`)
    .join('\n')
  const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c')
  const t = readFileSync(TEMPLATE, 'utf8')
  return t
    .replace('__TITLE__', esc(`Etiquetas ${c.nombre}`))
    .replace('__CLIENT__', esc(c.nombre))
    .replaceAll('__STORE__', c.store)
    .replace('__PRODUCTS__', json(c.productos))
    .replace('__DESIGN__', json(c.diseno ?? {}))
    .replace('__LOGOS__', json(logos))
    .replace('__LOGO_OPTIONS__', options)
    .replace('__DEFAULT_LOGO__', json(c.sin_logo ? 'none' : c.logo_inicial && (c.logos?.[c.logo_inicial] || c.logo_inicial === 'texto') ? c.logo_inicial : 'none'))
    .replace('__DEFAULT_TEXT__', json(c.texto_inicial ?? {}))
    .replaceAll('__HIDE_LOGO__', c.sin_logo ? 'true' : 'false')
}

export const programName = (c) => (/^[\w.-]+\.html$/.test(c.archivo ?? '') ? c.archivo : null) ?? `Etiquetas-${slug(c.nombre).replace(/(^|-)([a-z])/g, (_, d, l) => `${d}${l.toUpperCase()}`)}.html`

/** Build the program and keep it in ~/Documents/Nexy/etiquetas. */
export function publish(c) {
  mkdirSync(PUBLISHED, { recursive: true })
  const path = join(PUBLISHED, programName(c))
  writeFileSync(path, buildHtml(c))
  return path
}

// -- pictures ---------------------------------------------------------------------

const CHROMES = [
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

const run = (cmd, args, { input, ms = 60_000 } = {}) =>
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
    writeFileSync(html, buildHtml(c))
    const png = join(dir, 'e.png')
    const hash = new URLSearchParams({ prod: p.code, ...(logo ? { logo } : {}), ...(fecha ? { fprod: fecha } : {}) }).toString()
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
  `${p.code} · ${[p.brand, p.name1, p.name2].filter(Boolean).join(' / ')} · ${p.english || '—'} · ${p.pack} · UPC ${p.upc} · ${p.days} días`

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
    instructions: "The clients' 4×4 Zebra labels: products, logos, design, previews, publishing and undo.",
    tools: [
      tool('al_grupo', 'Write in the group.', { texto: z.string() }, async ({ texto }) => {
        await post(texto)
        return ok('Sent.')
      }),
      tool('clientes', 'The label sets there are, with how many products each.', {}, async () =>
        ok(listClients().map((c) => `${c.id} · ${c.nombre} · ${c.productos.length} productos · logos: ${Object.values(c.logos ?? {}).map((l) => l.nombre).join(', ') || (c.sin_logo ? 'no lleva' : 'ninguno')}`).join('\n')),
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
          cambios: z.object({
            code: z.string().optional().describe('A new code, to rename it.'),
            brand: z.string().optional(),
            name1: z.string().optional(),
            name2: z.string().optional(),
            english: z.string().optional(),
            pack: z.string().optional(),
            upc: z.string().optional(),
            days: z.number().optional(),
          }),
        },
        async ({ cliente, codigo, cambios }) => {
          const c = get(cliente)
          if (!c) return unknown(cliente)
          const i = c.productos.findIndex((p) => p.code === codigo)
          if (i < 0) return refuse(`${c.nombre} has no product ${codigo}.`)
          const r = cleanProduct({ ...c.productos[i], ...cambios })
          if (r.error) return refuse(r.error)
          if (r.product.code !== codigo && c.productos.some((p) => p.code === r.product.code)) return refuse(`There is already a product ${r.product.code}.`)
          const before = c.productos[i]
          c.productos[i] = r.product
          const diff = Object.keys(r.product).filter((k) => String(r.product[k]) !== String(before[k] ?? '')).map((k) => `${k}: «${before[k] ?? ''}» → «${r.product[k]}»`)
          if (!diff.length) return ok('Nothing changed: it already had those values.')
          return change(c, `${codigo}: ${diff.join('; ')}`)
        },
      ),
      tool(
        'agregar_producto',
        'Add a product to a label set.',
        {
          cliente: z.string(),
          producto: z.object({
            code: z.string(),
            brand: z.string().optional(),
            name1: z.string(),
            name2: z.string().optional(),
            english: z.string().optional(),
            pack: z.string(),
            upc: z.string(),
            days: z.number(),
          }),
        },
        async ({ cliente, producto }) => {
          const c = get(cliente)
          if (!c) return unknown(cliente)
          const r = cleanProduct(producto)
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
        "Build the label program with every change so far and send it to the group, for the printer's computer. Say what changed.",
        { cliente: z.string(), que_cambio: z.string() },
        async ({ cliente, que_cambio }) => {
          const c = get(cliente)
          if (!c) return unknown(cliente)
          const path = publish(c)
          await postFile(
            path,
            `🆕 ${c.nombre}: ${que_cambio}\n\nEn la computadora de la Zebra: descarga este archivo y reemplaza el anterior (mismo nombre).`,
          )
          return ok(`Published and sent: ${path.split('/').pop()}.`)
        },
      ),
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
        'Start a new label set, copying the design (not the products) of an existing one.',
        { nombre: z.string(), copiar_de: z.string(), sin_logo: z.boolean().optional() },
        async ({ nombre, copiar_de, sin_logo }) => {
          const from = get(copiar_de)
          if (!from) return unknown(copiar_de)
          const id = slug(nombre)
          if (!ID.test(id)) return refuse('Give it a name with letters or numbers.')
          if (readClient(id)) return refuse(`There is already a label set ${id}.`)
          const { archivo: _archivo, ...design } = from
          const c = { ...design, id, nombre: nombre.slice(0, 40), store: `et-${id}`, productos: [], logos: {}, logo_inicial: 'none', texto_inicial: {}, sin_logo: sin_logo ?? from.sin_logo }
          saveClient(c, { quien: who(), que: `creó ${nombre}` })
          return ok(`Created ${id}. Add its products with agregar_producto.`)
        },
      ),
    ],
  })
}
