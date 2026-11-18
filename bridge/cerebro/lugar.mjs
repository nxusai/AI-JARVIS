import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The brain's places. The package puts this file where bridge/nucleo/lugar.mjs
 * was, so the core reads and writes only inside the brain's own folder.
 * Built into one file, import.meta.url is the package itself: its assets sit
 * next to it.
 */

// The installed brain lives in /Library/Application Support/Cerebro. The service
// says so with CEREBRO_HOME; tools the administrator runs with sudo (llaves.mjs,
// the door) are root, whose home is /var/root: they use the same folder too.
export const SYSTEM_HOME = '/Library/Application Support/Cerebro'
const HOME = process.env.CEREBRO_HOME || (process.getuid?.() === 0 ? SYSTEM_HOME : join(homedir(), 'Library', 'Application Support', 'Cerebro'))

export const DATA = join(HOME, 'datos')
export const DOCS = join(HOME, 'documentos')
export const REFS_DIR = join(HOME, 'referencias')
export const ASSETS = dirname(fileURLToPath(import.meta.url))
export const TAG = '[cerebro]'
export const TMP = 'cerebro'
export const FFMPEG_OVERRIDE = undefined
export const YTDLP_OVERRIDE = undefined
export const CHROME_OVERRIDE = undefined
/** The owner's public key, installed once, outside the program (see firma.mjs). */
export const SEAL_KEY = join(HOME, 'firma.pub')
