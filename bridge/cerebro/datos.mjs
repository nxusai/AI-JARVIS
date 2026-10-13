import { createPublicKey, verify } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readAnaSofi, writeAnaSofi } from '../nucleo/anasofi.mjs'
import { LABELS_DIR, listClients, readLabelConfig, REMOVED_FILE, saveClient, writeLabelConfig } from '../nucleo/etiquetas.mjs'
import { DATA } from '../nucleo/lugar.mjs'

/**
 * Data the owner sends a brain (canal.sh datos): the label sets as he keeps
 * them, Ana Sofi's group and voices, who the owner is, and the printer's
 * direct line. One JSON document, its signature on the first line, made with
 * the same key as the packages. Applied only if the signature is his and it
 * is newer than the last one applied, so an old order cannot be replayed.
 * Keys never travel this way: those are typed on the brain (llaves.mjs).
 *
 *   { tipo: 'datos', fecha, etiquetas?: { <id>: set }, anasofi?: { grupo, voz, voz_es, voz_en },
 *     cerebro?: { dueno }, canal? }
 */

const LAST_FILE = join(DATA, 'ultimos-datos.json')
const SET_ID = /^[a-z0-9-]{2,40}$/
const VOICE = /^\w{10,40}$/

const readJson = (f, fallback) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8'))
  } catch {
    return fallback
  }
}
function writePrivate(file, value) {
  mkdirSync(DATA, { recursive: true })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(file, 0o600)
}

/** Checks and applies a data file; resolves what changed, or throws why not. */
export function applyData(file, publicPem) {
  if (!publicPem) throw new Error('no hay llave de firma instalada en este equipo')
  const text = readFileSync(file, 'utf8')
  const cut = text.indexOf('\n')
  const signature = Buffer.from(text.slice(0, cut).trim(), 'base64')
  const body = Buffer.from(text.slice(cut + 1), 'utf8')
  if (!verify(null, body, createPublicKey(publicPem), signature)) throw new Error('la firma no es de la llave del dueño')
  const data = JSON.parse(body.toString('utf8'))
  if (data?.tipo !== 'datos') throw new Error('no son datos del cerebro')
  const last = readJson(LAST_FILE, {}).fecha ?? ''
  if (!(String(data.fecha) > String(last))) throw new Error('son datos viejos (ya se aplicaron unos más nuevos)')

  const done = []
  if (data.etiquetas && typeof data.etiquetas === 'object') {
    const sent = Object.entries(data.etiquetas).filter(([id, c]) => SET_ID.test(id) && c?.id === id && Array.isArray(c.productos))
    for (const [, c] of sent) saveClient(c, { quien: 'actualización', que: 'datos del dueño' })
    // Sets the owner no longer has go too (kept in their history), and are never seeded back.
    const keep = new Set(sent.map(([id]) => id))
    const gone = listClients().filter((c) => !keep.has(c.id))
    for (const c of gone) {
      saveClient(c, { quien: 'actualización', que: 'se quitó' })
      rmSync(join(LABELS_DIR, `${c.id}.json`), { force: true })
    }
    if (gone.length) writeFileSync(REMOVED_FILE, JSON.stringify([...new Set([...readJson(REMOVED_FILE, []), ...gone.map((c) => c.id)])]))
    done.push(`${sent.length} empresas de etiquetas${gone.length ? ` (se quitaron ${gone.map((c) => c.nombre).join(', ')})` : ''}`)
  }
  if (data.anasofi && typeof data.anasofi === 'object') {
    const a = data.anasofi
    const now = readAnaSofi() ?? {}
    const next = { ...now }
    if (Number.isInteger(a.grupo)) next.grupo = a.grupo
    for (const k of ['voz', 'voz_es', 'voz_en']) {
      if (a[k] === null) delete next[k]
      else if (typeof a[k] === 'string' && VOICE.test(a[k])) next[k] = a[k]
    }
    // Without a token she is not set up yet: the group and voices wait in the file for llaves.mjs.
    if (now.token) writeAnaSofi(next)
    else writePrivate(join(DATA, 'anasofi.json'), next)
    done.push('grupo y voces de Ana Sofi')
  }
  if (data.cerebro && /^\d{4,15}$/.test(String(data.cerebro.dueno ?? ''))) {
    const file = join(DATA, 'cerebro.json')
    writePrivate(file, { ...(existsSync(file) ? readJson(file, {}) : {}), dueno: Number(data.cerebro.dueno) })
    done.push('el dueño')
  }
  if (typeof data.canal === 'string' && /^et-[0-9a-f]{32}$/.test(data.canal)) {
    writeLabelConfig({ ...readLabelConfig(), canal: data.canal })
    done.push('la línea directa de la impresora')
  }
  writePrivate(LAST_FILE, { fecha: data.fecha, aplicado: new Date().toISOString(), que: done })
  return done
}
