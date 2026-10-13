import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The brain's places. The package puts this file where bridge/nucleo/lugar.mjs
 * was, so the core reads and writes only inside the brain's own folder.
 * Built into one file, import.meta.url is the package itself: its assets sit
 * next to it.
 */

const HOME = process.env.CEREBRO_HOME || join(homedir(), 'Library', 'Application Support', 'Cerebro')

export const DATA = join(HOME, 'datos')
export const DOCS = join(HOME, 'documentos')
export const REFS_DIR = join(HOME, 'referencias')
export const ASSETS = dirname(fileURLToPath(import.meta.url))
export const TAG = '[cerebro]'
export const TMP = 'cerebro'
export const FFMPEG_OVERRIDE = undefined
export const YTDLP_OVERRIDE = undefined
export const CHROME_OVERRIDE = undefined
