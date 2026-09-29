/**
 * A scheduled post as the owner should see it before approving: the caption,
 * the networks, the date and the media — not the raw request. Metricool's
 * scheduling call carries all of it inside `info` (sometimes as a JSON
 * string); other services put the same things at the top level.
 */

const NETWORK = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'X',
  youtube: 'YouTube',
  threads: 'Threads',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
}

const mediaUrl = (m) => (typeof m === 'string' ? m : (m?.url ?? m?.mediaUrl ?? m?.src ?? null))

export const isVideo = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url)

export function postPreview(input) {
  if (!input || typeof input !== 'object') return null
  let info = input.info
  if (typeof info === 'string') {
    try {
      info = JSON.parse(info)
    } catch {
      info = null
    }
  }
  const src = info && typeof info === 'object' ? info : input
  const caption = typeof src.text === 'string' ? src.text : typeof input.text === 'string' ? input.text : null
  const media = (Array.isArray(src.media) ? src.media : Array.isArray(input.media) ? input.media : [])
    .map(mediaUrl)
    .filter((u) => typeof u === 'string' && /^https:\/\//.test(u))
  if (caption == null && !media.length) return null
  const networks = (Array.isArray(src.providers) ? src.providers : [])
    .map((p) => NETWORK[String(p?.network ?? '').toLowerCase()] ?? p?.network)
    .filter(Boolean)
  const when = src.publicationDate?.dateTime ?? input.date ?? null
  const zone = src.publicationDate?.timezone ?? null
  return {
    caption: caption ?? '',
    media,
    networks,
    when: when ? String(when).replace('T', ' ').slice(0, 16) + (zone ? ` (${zone})` : '') : null,
    draft: src.draft === true || src.draft === 'true',
    firstComment: typeof src.firstCommentText === 'string' && src.firstCommentText.trim() ? src.firstCommentText : null,
  }
}
