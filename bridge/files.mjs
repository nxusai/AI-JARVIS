import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { readFileSync, realpathSync, statSync } from 'node:fs'
import { extname, sep } from 'node:path'
import { MANUALS_DIR, RECEIVED_DIR } from './brands.mjs'
import { VOICE_LINES } from './video.mjs'
import { vetTarget } from './net.mjs'

/**
 * Handing the owner's brand images to a service that asks for them.
 *
 * Higgsfield (and publishing services) take a local image by giving out a
 * one-time upload link. Without this tool the only way to use that link is
 * the shell, which Nexy rightly does not have. This does the one thing
 * needed and nothing else: it sends an image from the brand folders — the
 * references the owner kept, or images the owner sent on Telegram — to an
 * https link. No other file on this Mac can be read, and nothing is written.
 */

const MAX_BYTES = 30 * 1024 * 1024
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }
/** Lines in the owner's own cloned voice (see video.mjs), for a lip-sync. */
const AUDIO_TYPES = { '.mp3': 'audio/mpeg' }

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })

/** The folders images may come from, resolved; missing ones are skipped. */
function roots() {
  const out = []
  for (const dir of [MANUALS_DIR, RECEIVED_DIR]) {
    try {
      out.push(realpathSync(dir) + sep)
    } catch {
      // Not created yet.
    }
  }
  return out
}

/** The real path of an allowed image, or null. */
export function allowedImage(path) {
  let real
  try {
    real = realpathSync(String(path ?? ''))
  } catch {
    return null
  }
  const ext = extname(real).toLowerCase()
  if (AUDIO_TYPES[ext]) {
    try {
      return real.startsWith(realpathSync(VOICE_LINES) + sep) ? real : null
    } catch {
      return null
    }
  }
  if (!TYPES[ext]) return null
  return roots().some((r) => real.startsWith(r)) ? real : null
}

export function filesServer() {
  return createSdkMcpServer({
    name: 'jarvis_files',
    version: '1.0.0',
    instructions: "Uploads the owner's brand images to an upload link a service gave you.",
    alwaysLoad: true,
    tools: [
      tool(
        'upload_to_url',
        'Upload one of the owner’s brand images — a visual reference listed by read_brand, or an image the owner sent you — ' +
          "or a line in the owner's voice made with speak_as_owner (for a lip-sync) " +
          'to an https upload link a service gave you (for example the link from higgsfield media_upload). Use this instead of ' +
          'any shell command. Afterwards, confirm the upload with that service as it asks.',
        {
          path: z.string().describe('The image path, exactly as read_brand or the owner’s message gave it.'),
          upload_url: z.string().describe('The https upload link the service returned.'),
          method: z.enum(['PUT', 'POST']).optional().describe('PUT unless the service said POST.'),
          content_type: z.string().optional().describe('Only if the service asked for a specific one.'),
        },
        async ({ path, upload_url, method, content_type }) => {
          const real = allowedImage(path)
          if (!real) return refuse('That file is not one of the brand images. Only brand references and images the owner sent can be uploaded.')
          let url
          try {
            url = vetTarget(upload_url)
          } catch {
            return refuse('That upload link is not allowed.')
          }
          if (url.protocol !== 'https:') return refuse('The upload link must be https.')
          const size = statSync(real).size
          if (size > MAX_BYTES) return refuse('That image is too large to upload.')
          try {
            const res = await fetch(url, {
              method: method ?? 'PUT',
              headers: { 'content-type': content_type || TYPES[extname(real).toLowerCase()] || AUDIO_TYPES[extname(real).toLowerCase()] },
              body: readFileSync(real),
              redirect: 'error',
            })
            if (!res.ok) return refuse(`The upload was refused (HTTP ${res.status}).`)
            console.log(`[jarvis] files: uploaded a brand image to ${url.hostname}`)
            return ok(`Uploaded (${Math.round(size / 1024)} KB).`)
          } catch (err) {
            console.log(`[jarvis] files: upload failed: ${err?.message ?? err}`)
            return refuse('The upload failed: the service did not answer.')
          }
        },
      ),
    ],
  })
}
