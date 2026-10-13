import { createHash, createPublicKey, verify } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * The seal on a brain's program. Each package carries the fingerprint of every
 * file (huellas.json) and the owner's signature over it (firma.sig), made with
 * a key that never leaves his Mac. The brain keeps his public key outside the
 * program (installed once, writable only by the administrator), and checks
 * the seal before an update is installed and every time it starts: a file
 * changed, added or missing, or a signature from any other key, and it stops.
 */

export const MANIFEST = 'huellas.json'
export const SIGNATURE = 'firma.sig'
export const PUBLIC_KEY = 'firma.pub'
// Never part of the seal: what npm installs, and the seal's own files.
const UNSEALED = new Set([MANIFEST, SIGNATURE, PUBLIC_KEY, 'package-lock.json'])

/** A key's short fingerprint, to compare by eye: "3fa2 91c0 …". */
export function fingerprint(pem) {
  const raw = createPublicKey(pem).export({ type: 'spki', format: 'der' })
  return createHash('sha256').update(raw).digest('hex').slice(0, 24).match(/.{4}/g).join(' ')
}

const files = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return []
    return e.isDirectory() ? files(join(dir, e.name), base) : [relative(base, join(dir, e.name))]
  })

/**
 * Checks a program folder against the owner's public key (its PEM text).
 * Resolves { ok: true, version } or { ok: false, why }.
 */
export function checkSeal(dir, publicPem) {
  try {
    if (!publicPem) return { ok: false, why: 'no hay llave de firma instalada en este equipo' }
    if (!existsSync(join(dir, MANIFEST)) || !existsSync(join(dir, SIGNATURE))) return { ok: false, why: 'el programa no trae sello' }
    const manifest = readFileSync(join(dir, MANIFEST))
    const signature = Buffer.from(readFileSync(join(dir, SIGNATURE), 'utf8').trim(), 'base64')
    if (!verify(null, manifest, createPublicKey(publicPem), signature)) return { ok: false, why: 'la firma no es de la llave del dueño' }
    const { version, archivos } = JSON.parse(manifest.toString('utf8'))
    for (const [name, sha] of Object.entries(archivos ?? {})) {
      const path = join(dir, name)
      if (!existsSync(path)) return { ok: false, why: `falta ${name}` }
      if (createHash('sha256').update(readFileSync(path)).digest('hex') !== sha) return { ok: false, why: `${name} fue modificado` }
    }
    const extra = files(dir).filter((f) => !UNSEALED.has(f) && !(f in archivos))
    if (extra.length) return { ok: false, why: `hay archivos que no son del paquete: ${extra.slice(0, 5).join(', ')}` }
    return { ok: true, version }
  } catch (err) {
    return { ok: false, why: `no se pudo revisar el sello (${err.message})` }
  }
}
