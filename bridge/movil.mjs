import http from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { askFromPhone, forSpeech, speak } from './telegram.mjs'

/**
 * Nexy on the owner's iPhone: the Action button (or "Oye Siri, Nexy") runs a
 * Shortcut that dictates what they say and posts it here; Nexy answers in the
 * same conversation as Telegram, and the reply comes back as her voice.
 *
 * The bridge itself answers only this Mac. This is a separate, small door:
 *   - it opens only to the owner's own devices on their Tailscale network
 *     (100.64.0.0/10, fd7a:115c:a1e0::/48) and to this Mac;
 *   - every request carries the phone's key (~/.nexy/movil.json, made by
 *     scripts/movil.mjs), compared in constant time;
 *   - it takes plain text only, a few requests a minute, and nothing it is
 *     sent gets any power Telegram doesn't have: sends, posts and the like
 *     still wait for the owner's tap.
 *
 *   POST /movil   { "texto": "…" }   → audio/mpeg (her voice), or JSON with ?formato=texto
 */

export const PHONE_FILE = join(homedir(), '.nexy', 'movil.json')
const DEFAULT_PORT = 8789
const MAX_TEXT = 2000
const PER_MINUTE = 12
// iOS gives a Shortcut's request about a minute; past this she keeps working
// and the answer arrives on Telegram instead.
const WAIT_MS = 50_000

export function readPhone() {
  try {
    const cfg = JSON.parse(readFileSync(PHONE_FILE, 'utf8'))
    return typeof cfg?.llave === 'string' && cfg.llave.length >= 32 ? cfg : null
  } catch {
    return null
  }
}

/** A new key for the phone (the old one stops working). */
export function newPhoneKey(port = DEFAULT_PORT) {
  const cfg = { llave: randomBytes(32).toString('base64url'), puerto: readPhone()?.puerto ?? port }
  mkdirSync(dirname(PHONE_FILE), { recursive: true, mode: 0o700 })
  writeFileSync(PHONE_FILE, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 })
  chmodSync(PHONE_FILE, 0o600)
  return cfg
}

/** This Mac, or one of the owner's devices on their Tailscale network. */
export function ownDevice(address) {
  const a = String(address ?? '').replace(/^::ffff:/, '')
  if (a === '127.0.0.1' || a === '::1') return true
  const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(a)
  if (v4) return Number(v4[1]) === 100 && Number(v4[2]) >= 64 && Number(v4[2]) <= 127
  return /^fd7a:115c:a1e0:/i.test(a)
}

function sameKey(given, expected) {
  const a = Buffer.from(String(given ?? ''))
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function readBody(req, limit = 16_384) {
  return new Promise((resolve, reject) => {
    let size = 0
    const parts = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('too large'))
        req.destroy()
      } else parts.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')))
    req.on('error', reject)
  })
}

export function startMovil({ elevenKey, voiceId }) {
  const cfg = readPhone()
  if (!cfg) {
    console.log('[jarvis] phone off — set it up with: node scripts/movil.mjs')
    return null
  }
  const hits = []
  const server = http.createServer(async (req, res) => {
    const reply = (status, body, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
      res.end(body)
    }
    const json = (status, o) => reply(status, JSON.stringify(o))
    if (!ownDevice(req.socket?.remoteAddress)) {
      console.warn(`[jarvis] phone: refused ${req.socket?.remoteAddress} — not one of the owner's devices`)
      return json(403, { error: 'Solo tus dispositivos.' })
    }
    const url = new URL(req.url ?? '/', 'http://nexy')
    if (req.method !== 'POST' || url.pathname !== '/movil') return json(404, { error: 'No existe.' })
    const key = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (!sameKey(key, readPhone()?.llave ?? cfg.llave)) {
      console.warn('[jarvis] phone: refused a request with a wrong key')
      return json(401, { error: 'Llave incorrecta.' })
    }
    const now = Date.now()
    while (hits.length && now - hits[0] > 60_000) hits.shift()
    if (hits.length >= PER_MINUTE) return json(429, { error: 'Demasiado seguido. Espera un momento.' })
    hits.push(now)

    let text = ''
    try {
      const raw = await readBody(req)
      const type = String(req.headers['content-type'] ?? '')
      text = type.includes('json') ? String(JSON.parse(raw || '{}').texto ?? '') : raw
    } catch {
      return json(400, { error: 'No entendí lo que mandó el atajo.' })
    }
    text = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)
    if (!text) return json(400, { error: 'No escuché nada.' })

    console.log('[jarvis] phone: a request from the owner\'s iPhone')
    let answer
    try {
      answer = await askFromPhone(text, WAIT_MS)
    } catch (err) {
      return json(503, { error: err.message })
    }
    const said = answer.tarde ? 'Sigo trabajando en eso. Te mando el resultado por Telegram.' : answer.texto
    if (url.searchParams.get('formato') === 'texto') return json(200, { texto: said })
    const k = elevenKey()
    if (!k) return reply(200, said, 'text/plain; charset=utf-8')
    try {
      return reply(200, await speak(k, voiceId, forSpeech(said)), 'audio/mpeg')
    } catch (err) {
      console.log(`[jarvis] phone: voice failed, sending text: ${err.message}`)
      return reply(200, said, 'text/plain; charset=utf-8')
    }
  })
  server.on('error', (err) => console.log(`[jarvis] phone could not start: ${err.message}`))
  // On every interface, so Tailscale's reaches it; ownDevice() turns away the rest.
  server.listen(cfg.puerto ?? DEFAULT_PORT, () => console.log(`[jarvis] phone on, port ${cfg.puerto ?? DEFAULT_PORT} (your devices only)`))
  return server
}
