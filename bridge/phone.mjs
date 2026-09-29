import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

/**
 * `call_me` — ring the owner's phone through an ElevenLabs phone agent, now or
 * at a set time — plus the two tools that look after the scheduled ones.
 *
 * The agent, the Twilio number it calls from and the number it calls are all
 * fixed by environment variables on this machine. The model supplies only what
 * to say and when. That is the whole safety argument: a tool that can dial any
 * number is a tool an email or a web page can talk into phoning a stranger, so
 * this one cannot be pointed anywhere but at the person who owns the machine.
 *
 *   NEXY_MY_PHONE        the owner's phone, E.164 (+1XXXXXXXXXX)
 *   NEXY_CALL_AGENT_ID   the ElevenLabs agent that talks on the call
 *   NEXY_CALL_PHONE_ID   the ElevenLabs id of the imported Twilio number
 *
 * The message travels as the dynamic variable `nexy_brief`, which the agent's
 * first message speaks straight after its greeting. ElevenLabs rejects a call
 * whose agent names a variable it was not sent, so one is always sent — and
 * because it is spoken as-is, the empty case is a line worth hearing.
 *
 * Timing. A wait of under two minutes is kept here with a timer: ElevenLabs'
 * scheduler is not built for "in thirty seconds", and the bridge is certainly
 * still running. Anything later is handed to ElevenLabs batch calling with a
 * start time, so it rings whether or not this Mac is awake by then. The
 * message is written when the call is booked, so a call set for tomorrow
 * carries what was true today.
 */

const API = 'https://api.elevenlabs.io/v1/convai'
const E164 = /^\+[1-9]\d{6,14}$/

/** Waits shorter than this stay on a local timer. */
const LOCAL_MAX_MS = 2 * 60_000
/** Nothing is booked further out than this. */
const MAX_AHEAD_MS = 30 * 24 * 60 * 60_000
/** A model that retries on silence can ring a phone five times in a minute. */
const MIN_GAP_MS = 60_000
/** Every booking carries this prefix, so the cancel tool can tell ours apart. */
const NAME_PREFIX = 'Nexy: '

const NO_MESSAGE = '¿En qué te ayudo?'

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })

/** Offset of `zone` from UTC at instant `ms`, in milliseconds. */
function zoneOffset(ms, zone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms))
  const n = (type) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
  return asUtc - Math.floor(ms / 1000) * 1000
}

/**
 * When a call should ring, in epoch ms. `at` without an offset is a wall-clock
 * time in the owner's zone — what "tomorrow at eight" means to them — so it is
 * converted here rather than trusting the model to get the offset right.
 */
export function resolveWhen({ at, in_minutes }, zone, now) {
  if (in_minutes !== undefined && in_minutes !== null && in_minutes !== '') {
    const minutes = Number(in_minutes)
    if (!Number.isFinite(minutes) || minutes < 0) return { error: 'in_minutes must be a number of minutes.' }
    return { when: now + minutes * 60_000 }
  }
  if (!at) return { when: now }
  const text = String(at).trim()
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) {
    const ms = Date.parse(text)
    return Number.isFinite(ms) ? { when: ms } : { error: `Could not read the time "${text}".` }
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text)
  if (!m) return { error: 'Give `at` as YYYY-MM-DDTHH:MM in the user\'s time zone.' }
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0))
  let when = wall - zoneOffset(wall, zone)
  when = wall - zoneOffset(when, zone) // second pass settles a daylight-saving edge
  return { when }
}

function speakable(ms, zone) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: zone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

const CALL_ME_DESCRIPTION =
  "Phone the user on their own mobile using the Nexy phone agent — now, after " +
  'a delay, or at a set time. Use it when they ask you to call them, ring ' +
  'them, or phone them with something — a summary, a reminder, what is on ' +
  'today. For "in 5 minutes" pass in_minutes; for a clock time pass `at` as ' +
  "YYYY-MM-DDTHH:MM in the user's time zone (check the date with " +
  'get-current-time first). Leave both out to call right now. Gather what ' +
  'they want first, then put it in `message`: it is spoken word for word as ' +
  'soon as they answer, so write it in their language, in short spoken ' +
  'sentences, with no lists and no links. It can only ever call the user; ' +
  'there is no way to call anyone else, so never offer to. Tell them back the ' +
  'time the call was booked for.'

const callMeSchema = {
  message: z
    .string()
    .max(4000)
    .optional()
    .catch(undefined)
    .describe('What the agent should tell them on the call. Optional.'),
  in_minutes: z
    .union([z.number(), z.string()])
    .optional()
    .catch(undefined)
    .describe('Call after this many minutes (0.5 = thirty seconds).'),
  at: z
    .string()
    .optional()
    .catch(undefined)
    .describe("Call at this local time, YYYY-MM-DDTHH:MM, in the user's time zone."),
}

export function phoneServer(elevenKey, zone) {
  let lastCall = 0

  const settings = () => ({
    to: (process.env.NEXY_MY_PHONE ?? '').trim(),
    agent: (process.env.NEXY_CALL_AGENT_ID ?? '').trim(),
    from: (process.env.NEXY_CALL_PHONE_ID ?? '').trim(),
    key: elevenKey(),
  })

  const missing = (s) =>
    !s.key || !s.agent || !s.from || !s.to
      ? 'Phone calls are not set up on this machine yet. Tell the user the calling settings are missing.'
      : !E164.test(s.to)
        ? 'The saved phone number is not in international format. Tell the user to check it.'
        : null

  const api = async (key, path, init = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { 'xi-api-key': key, 'content-type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(20_000),
    })
    const body = await res.text()
    if (!res.ok) {
      console.log(`[jarvis] phone ${path} failed: ${res.status} ${body.slice(0, 300)}`)
      return { error: res.status }
    }
    try {
      return { data: JSON.parse(body || '{}') }
    } catch {
      return { data: {} }
    }
  }

  const dialNow = async (s, message) => {
    const r = await api(s.key, '/twilio/outbound-call', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: s.agent,
        agent_phone_number_id: s.from,
        to_number: s.to,
        conversation_initiation_client_data: { dynamic_variables: { nexy_brief: message } },
      }),
    })
    return r.error ? `error ${r.error}` : null
  }

  return createSdkMcpServer({
    name: 'jarvis_phone',
    version: '1.0.0',
    instructions:
      "Rings the user's own phone through the Nexy phone agent, now or at a " +
      'set time, and lists or cancels the calls already booked. It cannot ' +
      'call anyone else.',
    alwaysLoad: true,
    tools: [
      tool('call_me', CALL_ME_DESCRIPTION, callMeSchema, async (args) => {
        const s = settings()
        const problem = missing(s)
        if (problem) return refuse(problem)

        const now = Date.now()
        const { when, error } = resolveWhen(args, zone, now)
        if (error) return refuse(error)
        if (when < now - 60_000) return refuse('That time has already passed. Ask for a time in the future.')
        if (when - now > MAX_AHEAD_MS) return refuse('Calls can be booked at most 30 days ahead.')

        const message = (args.message ?? '').trim() || NO_MESSAGE
        const delay = Math.max(0, when - now)
        console.log(
          delay < 1000
            ? '[jarvis] call_me: calling now'
            : `[jarvis] call_me: ringing in ${Math.round(delay / 1000)}s (${speakable(when, zone)})`,
        )

        if (delay <= LOCAL_MAX_MS) {
          if (now - lastCall < MIN_GAP_MS) {
            return refuse('A call was placed less than a minute ago. Do not call again yet.')
          }
          lastCall = now
          if (delay < 1000) {
            try {
              const failed = await dialNow(s, message)
              if (failed) {
                lastCall = 0
                return refuse(`The call could not be placed (${failed}).`)
              }
              return ok('The call is on its way to their phone.')
            } catch (err) {
              console.log(`[jarvis] call_me failed: ${err?.message ?? err}`)
              lastCall = 0
              return refuse('The call could not be placed: the phone service did not answer.')
            }
          }
          setTimeout(() => {
            dialNow(s, message).catch((err) =>
              console.log(`[jarvis] call_me failed: ${err?.message ?? err}`),
            )
          }, delay)
          const secs = Math.round(delay / 1000)
          return ok(`The call will ring in ${secs} seconds. This short wait only works while Nexy stays open.`)
        }

        try {
          const r = await api(s.key, '/batch-calling/submit', {
            method: 'POST',
            body: JSON.stringify({
              call_name: `${NAME_PREFIX}${speakable(when, zone)}`.slice(0, 120),
              agent_id: s.agent,
              agent_phone_number_id: s.from,
              scheduled_time_unix: Math.floor(when / 1000),
              timezone: zone,
              recipients: [
                {
                  phone_number: s.to,
                  conversation_initiation_client_data: {
                    dynamic_variables: { nexy_brief: message },
                  },
                },
              ],
            }),
          })
          if (r.error) return refuse(`The call could not be booked (error ${r.error}).`)
          return ok(
            `Call booked for ${speakable(when, zone)} (${zone}). ElevenLabs will ` +
              'place it even if this computer is off.',
          )
        } catch (err) {
          console.log(`[jarvis] call_me failed: ${err?.message ?? err}`)
          return refuse('The call could not be booked: the phone service did not answer.')
        }
      }),

      tool(
        'list_my_calls',
        'List the calls to the user that are booked for later and have not ' +
          'happened yet, with their times and ids. Use it when they ask what ' +
          'calls are scheduled, or before cancelling one.',
        {},
        async () => {
          const s = settings()
          const problem = missing(s)
          if (problem) return refuse(problem)
          const r = await api(s.key, `/batch-calling/workspace?agent_id=${encodeURIComponent(s.agent)}`)
          if (r.error) return refuse(`The scheduled calls could not be read (error ${r.error}).`)
          const all = r.data.batch_calls ?? (Array.isArray(r.data) ? r.data : [])
          const now = Date.now() / 1000
          const pending = all.filter(
            (b) =>
              String(b.name ?? '').startsWith(NAME_PREFIX) &&
              (b.scheduled_time_unix ?? 0) > now - 60 &&
              !/cancel|complet|fail/i.test(String(b.status ?? '')),
          )
          if (!pending.length) return ok('No calls are booked.')
          return ok(
            pending
              .map((b) => `${speakable(b.scheduled_time_unix * 1000, zone)} — id ${b.id} — ${b.status ?? 'pending'}`)
              .join('\n'),
          )
        },
      ),

      tool(
        'cancel_my_call',
        'Cancel one call to the user that was booked for later, by the id ' +
          'list_my_calls gave. Use it only when the user asks to cancel it.',
        { id: z.string().describe('The id from list_my_calls.') },
        async ({ id }) => {
          const s = settings()
          const problem = missing(s)
          if (problem) return refuse(problem)
          if (!/^[\w-]{1,100}$/.test(id ?? '')) return refuse('That is not a valid call id.')
          const got = await api(s.key, `/batch-calling/${id}`)
          if (got.error) return refuse(`That call could not be found (error ${got.error}).`)
          if (!String(got.data.name ?? '').startsWith(NAME_PREFIX) || got.data.agent_id !== s.agent) {
            return refuse('That call was not booked by Nexy, so it is left alone.')
          }
          const r = await api(s.key, `/batch-calling/${id}/cancel`, { method: 'POST' })
          if (r.error) return refuse(`The call could not be cancelled (error ${r.error}).`)
          return ok('The call is cancelled.')
        },
      ),
    ],
  })
}
