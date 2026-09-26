import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

/**
 * `call_me` — ring the owner's phone through an ElevenLabs phone agent.
 *
 * The agent, the Twilio number it calls from and the number it calls are all
 * fixed by environment variables on this machine. The model supplies only what
 * to say. That is the whole safety argument: a tool that can dial any number is
 * a tool an email or a web page can talk into phoning a stranger, so this one
 * cannot be pointed anywhere but at the person who owns the machine.
 *
 *   NEXY_MY_PHONE        the owner's phone, E.164 (+1XXXXXXXXXX)
 *   NEXY_CALL_AGENT_ID   the ElevenLabs agent that talks on the call
 *   NEXY_CALL_PHONE_ID   the ElevenLabs id of the imported Twilio number
 *
 * The message travels as the dynamic variable `nexy_brief`, which the agent's
 * first message speaks straight after its greeting. ElevenLabs rejects a call
 * whose agent names a variable it was not sent, so one is always sent — and
 * because it is spoken as-is, the empty case is a line worth hearing.
 */

const OUTBOUND_URL = 'https://api.elevenlabs.io/v1/convai/twilio/outbound-call'
const E164 = /^\+[1-9]\d{6,14}$/

/** A model that retries on silence can ring a phone five times in a minute. */
const MIN_GAP_MS = 60_000

const NO_MESSAGE = '¿En qué te ayudo?'

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })

const CALL_ME_DESCRIPTION =
  "Phone the user on their own mobile, right now, using the Nexy phone agent. " +
  'Use it when they ask you to call them, ring them, or phone them with ' +
  'something — a summary, a reminder, what is on today. Gather what they want ' +
  'first, then put it in `message`: it is spoken word for word as soon as ' +
  'they answer, so write it in their language, in short spoken sentences, ' +
  'with no lists and no links. It can only ever call the user; there is no ' +
  'way to call anyone else, so never offer to.'

const callMeSchema = {
  message: z
    .string()
    .max(4000)
    .optional()
    .catch(undefined)
    .describe('What the agent should tell them on the call. Optional.'),
}

export function phoneServer(elevenKey) {
  let lastCall = 0

  return createSdkMcpServer({
    name: 'jarvis_phone',
    version: '1.0.0',
    instructions:
      "Rings the user's own phone through the Nexy phone agent. It cannot " +
      'call anyone else.',
    alwaysLoad: true,
    tools: [
      tool('call_me', CALL_ME_DESCRIPTION, callMeSchema, async (args) => {
        const to = (process.env.NEXY_MY_PHONE ?? '').trim()
        const agent = (process.env.NEXY_CALL_AGENT_ID ?? '').trim()
        const from = (process.env.NEXY_CALL_PHONE_ID ?? '').trim()
        const key = elevenKey()

        if (!key || !agent || !from || !to) {
          return refuse(
            'Phone calls are not set up on this machine yet. Tell the user ' +
              'the calling settings are missing.',
          )
        }
        if (!E164.test(to)) {
          return refuse(
            'The saved phone number is not in international format. Tell the ' +
              'user to check it.',
          )
        }
        const now = Date.now()
        if (now - lastCall < MIN_GAP_MS) {
          return refuse('A call was placed less than a minute ago. Do not call again yet.')
        }
        lastCall = now

        const message = (args.message ?? '').trim() || NO_MESSAGE
        try {
          const res = await fetch(OUTBOUND_URL, {
            method: 'POST',
            headers: { 'xi-api-key': key, 'content-type': 'application/json' },
            body: JSON.stringify({
              agent_id: agent,
              agent_phone_number_id: from,
              to_number: to,
              conversation_initiation_client_data: {
                dynamic_variables: { nexy_brief: message },
              },
            }),
            signal: AbortSignal.timeout(20_000),
          })
          if (!res.ok) {
            const detail = (await res.text()).slice(0, 300)
            console.log(`[jarvis] call_me failed: ${res.status} ${detail}`)
            lastCall = 0
            return refuse(`The call could not be placed (error ${res.status}).`)
          }
          return ok('The call is on its way to their phone.')
        } catch (err) {
          console.log(`[jarvis] call_me failed: ${err?.message ?? err}`)
          lastCall = 0
          return refuse('The call could not be placed: the phone service did not answer.')
        }
      }),
    ],
  })
}
