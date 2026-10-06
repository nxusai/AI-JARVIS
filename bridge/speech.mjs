/**
 * Text about to be spoken. A comma either side of "Boss" makes every voice
 * engine pause on it ("Listo, Boss." — beat — "Boss"), which the owner finds
 * ugly; said straight through it sounds natural. Used on everything Nexy says
 * out loud: the face's voice, Telegram voice notes and phone calls.
 */
export function smoothBoss(text) {
  return String(text ?? '')
    .replace(/\s*,\s*(boss)\b/gi, ' $1')
    .replace(/\b(boss)\s*,\s*/gi, '$1 ')
}
