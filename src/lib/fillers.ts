/**
 * Filler speech.
 *
 * A tool call can take ten seconds, and silence that long reads as a crash. So
 * JARVIS says something the instant work starts — then goes quiet until he has
 * an answer. One acknowledgement, no progress chatter.
 *
 * The lines sound like a person, in natural Mexican Spanish: short, varied,
 * never the same twice running, and never a robotic status word.
 */

/** Said as soon as the first tool fires, before any answer exists. */
const WORKING = [
  'Va, dame un segundo.',
  'Ahorita lo veo.',
  'Déjame revisar.',
  'Va, lo checo.',
  'Sale, ya voy.',
  'Un momentito.',
  'Déjame ver.',
]

/** Acknowledging an order where no tool is involved. */
const ACKNOWLEDGE = [
  'Va.',
  'Sale, ahorita.',
  'Claro.',
  'Entendido.',
  'Dalo por hecho.',
  'Va Boss.',
]

/** Answering to his name, before the user has said what they want. */
const ATTENTION = [
  '¿Qué pasó?',
  'Dime.',
  '¿Sí, Boss?',
  'Aquí estoy.',
  '¿Qué onda?',
  'Te escucho.',
]

/**
 * Avoids repeating the same phrase twice running, which is what makes canned
 * lines sound canned. Keeps one slot of history per pool.
 */
function makePicker(pool: string[]) {
  let last = -1
  return () => {
    if (pool.length < 2) return pool[0] ?? ''
    let i = last
    while (i === last) i = Math.floor(Math.random() * pool.length)
    last = i
    return pool[i]
  }
}

/**
 * Said once, in her own voice, as the start-up sequence finishes. The boot
 * music used to carry a recorded introduction under another name; the music
 * now ends before any voice, and this is the introduction instead.
 */
export const BOOT_LINE =
  'Welcome back, Eduardo. Es un gusto tenerte de vuelta. Nexy en línea. Todos los sistemas listos.'

export const working = makePicker(WORKING)
export const acknowledge = makePicker(ACKNOWLEDGE)
export const attention = makePicker(ATTENTION)

/**
 * Naming the task is warmer than a generic acknowledgement and shows the
 * integration off on camera. Still short, still under five words.
 *
 * MCP tool names are `mcp__<server>__<tool>`, and the two halves say different
 * things: the server is who is being asked, the tool is what is being asked
 * for. Matching one flat substring against the whole string gets both wrong —
 * `mcp__playwright__browser_click` announced a web search because "browse"
 * appeared earlier in the table than "browser", `Get-Report` looked like a code
 * repository, `Get-Events` like a calendar entry, and "highlight" like a lamp.
 *
 * So: split the name, match the halves separately, order the table so the
 * specific beats the general, and put word boundaries on the short words that
 * hide inside longer ones. Either half matching is enough — the server is the
 * better signal when a name gives one, but plenty of them don't.
 */
type Rule = {
  /** Matched against the server segment, if there is one. */
  server?: RegExp
  /** Matched against the tool segment, or the whole name for a built-in. */
  tool?: RegExp
  lines: string[]
}

const FOOTAGE = ['Va, armo el video.', 'Déjame armar el video.']

const BY_TOOL: Rule[] = [
  // Video sits above image because higgsfield and palmier both do either, so
  // the verb in the tool name is the only thing separating them — a rule on the
  // server alone would send every generate_video to "Rendering."
  { tool: /video|footage|\bclip\b|\breel\b|talking_head/, lines: FOOTAGE },
  {
    server: /higgsfield|openrouter-image|dalle|flux|midjourney/,
    tool: /image|photo|thumbnail|render|upscale|seedream/,
    lines: ['Va, la hago.', 'Déjame hacer la imagen.'],
  },
  // The editors, once the two rules that read the verb have had their turn.
  { server: /palmier|heygen|runway|descript/, lines: FOOTAGE },
  {
    server: /playwright|puppeteer|browserbase|chrome/,
    tool: /\bbrowser\b|navigate/,
    lines: ['Déjame abrirlo.', 'Lo abro.'],
  },
  {
    server: /android|\badb\b|simulator/,
    tool: /\bdevice\b|\bapk\b|\bphone\b/,
    lines: ['Déjame conectarme al cel.', 'Va, me conecto.'],
  },
  {
    server: /gmail|\bmail\b/,
    tool: /gmail|\bmail\b|email|inbox/,
    lines: ['Déjame ver tu correo.', 'Checo el correo.'],
  },
  // Calendar keys off "calendar" alone. "event" used to live here, which is how
  // a Mixpanel event query came out as "Checking your calendar."
  {
    tool: /calendar|\bdiary\b|\bmeeting\b/,
    lines: ['Déjame ver tu agenda.', 'Checo tu calendario.'],
  },
  {
    server: /elevenlabs|openai-tts/,
    tool: /speech|\bvoice\b|\btts\b|text_to_sound/,
    lines: ['Va, preparo el audio.', 'Ahorita lo grabo.'],
  },
  {
    server: /spotify|sonos/,
    tool: /\bplay\b|\bmusic\b|playlist|\btrack\b/,
    lines: ['Va, la pongo.', 'Ahí va.'],
  },
  {
    server: /^home|homeassistant|\bhue\b|\bhass\b/,
    tool: /\blights?\b|thermostat|\bdimmer\b/,
    lines: ['Va, lo ajusto.', 'Ahorita.'],
  },
  {
    server: /github|linear|jira|sentry/,
    tool: /\brepo\b|repository|\bissues?\b|pull_request|\bcommit\b/,
    lines: ['Déjame revisar el código.', 'Lo checo en GitHub.'],
  },
  // Also where the anonymously named analytics servers land — theirs are bare
  // UUIDs, so only the tool half says anything: Get-Report, Get-Events,
  // Run-Query. "report" is safe from the repository rule above because that one
  // is bounded.
  {
    server: /mixpanel|clarity|posthog|amplitude/,
    tool: /analytic|\bmetrics?\b|\breports?\b|\bevents?\b|cohort|funnel|dashboard|\bquery\b/,
    lines: ['Déjame sacar los números.', 'Va, saco las cifras.'],
  },
  {
    server: /\bexa\b|serper|serpapi|perplexity|tavily|brave/,
    tool: /search|\bweb\b|\bfetch\b|crawl|research/,
    lines: ['Déjame buscarlo.', 'Lo busco.'],
  },
]

const pickers = BY_TOOL.map((r) => ({ ...r, pick: makePicker(r.lines) }))

/**
 * `mcp__<server>__<tool>`, split on the first separator so tool names keep
 * their own underscores (`browser_click`, `text_to_speech`). A built-in like
 * WebSearch or Bash has no server half.
 *
 * The second form matters more than it looks: the bridge client prettifies
 * names for the HUD badge before handing them on, so what actually arrives
 * here is `higgsfield · generate image`. Parsing only the raw form meant every
 * rule below silently missed and every tool got the generic line.
 */
function split(toolName: string): { server: string; tool: string } {
  const raw = /^mcp__(.+?)__(.+)$/.exec(toolName)
  if (raw) return { server: raw[1].toLowerCase(), tool: raw[2].toLowerCase() }

  const pretty = toolName.split(' · ')
  if (pretty.length === 2) {
    return { server: pretty[0].toLowerCase(), tool: pretty[1].toLowerCase() }
  }

  return { server: '', tool: toolName.toLowerCase() }
}

/** A phrase suited to the tool that just fired. */
export function forTool(toolName: string): string {
  const { server, tool } = split(toolName)
  for (const r of pickers) {
    const hit =
      (r.server !== undefined && server !== '' && r.server.test(server)) ||
      (r.tool !== undefined && r.tool.test(tool))
    if (hit) return r.pick()
  }
  // Read, Bash, Grep and anything unrecognised: better a neutral line than a
  // confident wrong one.
  return working()
}
