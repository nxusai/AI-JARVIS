import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Videos the owner points at to show a style — an Instagram reel, a TikTok, a
 * YouTube short — fetched so the editor can watch them.
 *
 * Those sites don't hand out the video file, so this uses yt-dlp, the
 * open-source downloader. It is fetched once from its official GitHub
 * release into ~/.nexy/bin, checked against the release's published SHA-256,
 * and only ever run with arguments built here. Nothing is installed
 * system-wide.
 *
 * What comes down is a reference to study, kept in ~/Movies/Nexy/referencias:
 * never something to publish.
 */

export const REFS = join(homedir(), 'Movies', 'Nexy', 'referencias')
const BIN_DIR = join(homedir(), '.nexy', 'bin')
const RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download'
const MAX_MB = 300

/** The sites a style reference may come from. */
const HOSTS = /(^|\.)(instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|x\.com|twitter\.com|vimeo\.com|threads\.net)$/i

export function referenceHost(url) {
  let u
  try {
    u = new URL(String(url).trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || !HOSTS.test(u.hostname)) return null
  return u
}

const asset = () => (process.platform === 'darwin' ? 'yt-dlp_macos' : process.platform === 'linux' ? (process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux') : null)

let installing = null
/** The yt-dlp binary, fetched and verified the first time it is needed. */
export function ensureYtDlp(fetchImpl = fetch) {
  if (process.env.NEXY_YTDLP) return Promise.resolve(process.env.NEXY_YTDLP)
  const bin = join(BIN_DIR, 'yt-dlp')
  if (existsSync(bin)) return Promise.resolve(bin)
  installing ??= (async () => {
    const name = asset()
    if (!name) throw new Error('downloading reference videos works on Mac only')
    const sums = await fetchImpl(`${RELEASE}/SHA2-256SUMS`, { redirect: 'follow' })
    if (!sums.ok) throw new Error(`could not reach the yt-dlp release (HTTP ${sums.status})`)
    const want = (await sums.text())
      .split('\n')
      .map((l) => l.trim().split(/\s+/))
      .find(([, file]) => file === name)?.[0]
    if (!want) throw new Error('the yt-dlp release lists no checksum for this Mac')
    const res = await fetchImpl(`${RELEASE}/${name}`, { redirect: 'follow' })
    if (!res.ok) throw new Error(`could not download yt-dlp (HTTP ${res.status})`)
    const bytes = Buffer.from(await res.arrayBuffer())
    const got = createHash('sha256').update(bytes).digest('hex')
    if (got !== want.toLowerCase()) throw new Error('the yt-dlp download did not match its published checksum; not using it')
    mkdirSync(BIN_DIR, { recursive: true })
    const tmp = `${bin}.part`
    writeFileSync(tmp, bytes)
    chmodSync(tmp, 0o755)
    renameSync(tmp, bin)
    console.log('[jarvis] reference videos: yt-dlp ready')
    return bin
  })().finally(() => {
    installing = null
  })
  return installing
}

function runYtDlp(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out = (out + d).slice(-20_000)))
    child.stderr.on('data', (d) => (err = (err + d).slice(-20_000)))
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, out, err })
    })
  })
}

/** Why a download failed, in words the owner can act on. */
function explain(err) {
  if (/login|log in|sign in|cookies|rate.?limit|empty media|private|not available|requires authentication/i.test(err)) {
    return 'the site asked to log in or blocked the download (Instagram often does). Ask the owner to save the video on their phone and send it on Telegram instead.'
  }
  if (/File is larger|max-filesize/i.test(err)) return `the video is over ${MAX_MB} MB.`
  if (/Unsupported URL|no video/i.test(err)) return 'there is no video at that link.'
  return err.split('\n').filter((l) => /ERROR/.test(l)).slice(-1)[0]?.replace(/^.*ERROR:\s*/, '') || 'yt-dlp could not get it.'
}

/**
 * Download the video at a social link into REFS. Resolves
 * { path, title, uploader, duration } or rejects with a reason to tell the owner.
 */
export async function fetchReference(url, { ffmpeg, bin } = {}) {
  const u = referenceHost(url)
  if (!u) throw new Error('only Instagram, TikTok, YouTube, Facebook, X, Threads or Vimeo links')
  const ytdlp = bin ?? (await ensureYtDlp())
  mkdirSync(REFS, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const before = new Set(readdirSync(REFS))
  const args = [
    '--no-playlist',
    '--no-progress',
    '--no-warnings',
    '--restrict-filenames',
    '--max-filesize',
    `${MAX_MB}M`,
    '-f',
    'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
    '--merge-output-format',
    'mp4',
    ...(ffmpeg ? ['--ffmpeg-location', ffmpeg] : []),
    '-o',
    join(REFS, `${stamp}-%(extractor)s-%(id).40s.%(ext)s`),
    '--print',
    'before_dl:TITLE %(title).200s',
    '--print',
    'before_dl:WHO %(uploader|channel|creator|NA).80s',
    '--print',
    'before_dl:SECS %(duration|0)s',
    '--print',
    'after_move:FILE %(filepath)s',
    '--',
    u.href,
  ]
  const { code, out, err } = await runYtDlp(ytdlp, args, 5 * 60_000)
  const line = (k) => out.split('\n').find((l) => l.startsWith(`${k} `))?.slice(k.length + 1).trim()
  let path = line('FILE')
  if (!path) path = readdirSync(REFS).filter((f) => !before.has(f) && /\.(mp4|mov|webm|mkv)$/i.test(f)).map((f) => join(REFS, f))[0]
  if (code !== 0 || !path || !existsSync(path)) throw new Error(explain(err || out))
  return {
    path,
    title: line('TITLE') ?? '',
    uploader: line('WHO') === 'NA' ? '' : (line('WHO') ?? ''),
    duration: Number(line('SECS')) || 0,
    mb: Math.round(statSync(path).size / 1048576),
  }
}
