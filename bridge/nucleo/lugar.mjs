import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Where the core keeps things, and how it signs its log lines.
 *
 * The core (bridge/nucleo) is what Ana Sofi and the labels are made of, and
 * it runs in two places: inside NEX, and alone in a client's brain (see
 * docs/cerebro-cliente.md). Everything that names the place lives here, so
 * the core itself never does: the brain's package swaps this file for
 * bridge/cerebro/lugar.mjs, and nothing of this one goes with it.
 */

/** Private data: settings, label sets, conversations. */
export const DATA = join(homedir(), '.nexy')
/** Files people open: the published label program. */
export const DOCS = join(homedir(), 'Documents', 'Nexy')
/** Reference videos fetched to look at. */
export const REFS_DIR = join(homedir(), 'Movies', 'Nexy', 'referencias')
/** Where the core's own files are (the label template and the seed sets). */
export const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..')
/** In front of every log line. */
export const TAG = '[jarvis]'
/** Temporary folders' names start with this. */
export const TMP = 'nexy'
/** A different FFmpeg, yt-dlp or Chrome, for a Mac that has its own. */
export const FFMPEG_OVERRIDE = process.env.NEXY_FFMPEG
export const YTDLP_OVERRIDE = process.env.NEXY_YTDLP
export const CHROME_OVERRIDE = process.env.NEXY_CHROME
/** Where a brain keeps the key its program is sealed with; NEX has none. */
export const SEAL_KEY = null
