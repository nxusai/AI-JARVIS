import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { spawn } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { findBrand } from './brands.mjs'

/**
 * Routines: work the owner leaves Nexy to do on her own, every day or on
 * some days of the week, at a set time — "every morning at 9, find ten
 * prospects for NXUS and draft their emails".
 *
 * They live in one file on this Mac. A clock checks every half minute; when
 * one is due it goes to whoever runs it (the Telegram conversation), as if
 * the owner had asked just then, and the report comes back to their phone.
 * Nothing about approvals changes: whatever publishes, sends or spends still
 * waits for the owner's tap.
 *
 * Creating, changing and removing a routine is held for the owner's tap too,
 * so a web page or an email can never leave work scheduled behind their back.
 *
 * The Mac has to be on. A routine missed while it was asleep or Nexy was
 * closed runs late, if it is within a few hours; past that it is skipped
 * rather than done at a time nobody expects.
 */

const FILE = join(homedir(), '.nexy', 'rutinas.json')
const MAX_ROUTINES = 30
const LATE_LIMIT_MIN = 6 * 60
const TICK_MS = 30_000

export const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })

export function readRoutines() {
  try {
    const list = JSON.parse(readFileSync(FILE, 'utf8'))
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string') : []
  } catch {
    return []
  }
}

function writeRoutines(list) {
  mkdirSync(join(homedir(), '.nexy'), { recursive: true })
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(list, null, 2), { mode: 0o600 })
  renameSync(tmp, FILE)
  try {
    chmodSync(FILE, 0o600)
  } catch {}
  changed()
}

let listeners = []
const changed = () => listeners.forEach((f) => f())
export const onRoutinesChange = (f) => listeners.push(f)

/** "9", "9:30", "09:30", "9 am", "7:15 pm", "21:00" → "HH:MM", or null. */
export function parseTime(s) {
  const m = fold(s).replace(/\s+/g, '').match(/^(\d{1,2})(?::(\d{2}))?(am|pm|a\.m\.|p\.m\.)?$/)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  const half = m[3]?.[0]
  if (half) {
    if (h < 1 || h > 12) return null
    if (half === 'p' && h !== 12) h += 12
    if (half === 'a' && h === 12) h = 0
  }
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Day names ("lunes", "sábado"), "diario" or "entre semana" → day numbers. */
export function parseDays(days) {
  if (!days || !days.length) return ALL_DAYS
  const out = new Set()
  for (const d of days) {
    const f = fold(d)
    if (/^(diario|todos|todos los dias|cada dia|everyday|daily)$/.test(f)) ALL_DAYS.forEach((n) => out.add(n))
    else if (/^(entre semana|laborales|weekdays)$/.test(f)) [1, 2, 3, 4, 5].forEach((n) => out.add(n))
    else if (/^(fin de semana|fines de semana|weekend)$/.test(f)) [0, 6].forEach((n) => out.add(n))
    else {
      const i = DAYS.findIndex((n) => n === f || n.slice(0, 3) === f.slice(0, 3))
      if (i < 0) return null
      out.add(i)
    }
  }
  return [...out].sort()
}

export function describeDays(dias) {
  const set = [...new Set(dias ?? ALL_DAYS)].sort()
  if (set.length === 7) return 'todos los días'
  if (set.join() === '1,2,3,4,5') return 'de lunes a viernes'
  if (set.join() === '0,6') return 'sábados y domingos'
  return set.map((d) => DAYS[d].replace('miercoles', 'miércoles').replace('sabado', 'sábado')).join(', ')
}

/** Today's date, weekday and minutes since midnight, in the owner's zone. */
export function localNow(zone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

const minutesOf = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3))

/**
 * Which routines are due now, and which were missed by too much to run.
 * A run is keyed by date and time, so each happens at most once a day and
 * changing the time lets it run again at the new one.
 */
export function dueRoutines(list, zone, now = new Date()) {
  const today = localNow(zone, now)
  const due = []
  const missed = []
  for (const r of list) {
    if (!r.activa || !(r.dias ?? ALL_DAYS).includes(today.weekday)) continue
    const key = `${today.date} ${r.hora}`
    if (r.ultima === key) continue
    const late = today.minutes - minutesOf(r.hora)
    if (late < 0) continue
    if (late > LATE_LIMIT_MIN) missed.push({ routine: r, key })
    else due.push({ routine: r, key, late })
  }
  return { due, missed }
}

/** Created or moved after today's time has passed: first run is the next one. */
function settleToday(r, zone) {
  const today = localNow(zone)
  if ((r.dias ?? ALL_DAYS).includes(today.weekday) && today.minutes >= minutesOf(r.hora)) r.ultima = `${today.date} ${r.hora}`
  return r
}

const brandName = (id) => (id ? (findBrand(id)?.nombre ?? id) : null)

export function describeRoutine(r) {
  const where = r.marca ? ` · ${brandName(r.marca)}` : ''
  return `«${r.nombre}» (${r.id}) — ${describeDays(r.dias)} a las ${r.hora}${where}${r.activa ? '' : ' · EN PAUSA'}\n  ${r.instrucciones}`
}

/** What the agent is handed when a routine comes due. */
export function routinePrompt(r, late = 0) {
  const brand = r.marca ? findBrand(r.marca) : null
  return (
    `[Scheduled routine «${r.nombre}», set up earlier by the owner and running now on its own` +
    `${late > 5 ? `, ${late} minutes late because this Mac was asleep or Nexy was closed` : ''}. ` +
    'Nobody is waiting live: do the whole job, then answer with a short report for their phone — what you did, ' +
    'what you found, and what is waiting for their approval. Anything that publishes, sends, calls or spends still ' +
    'goes through approval as always; never skip that because the owner is away.' +
    (brand ? ` It is for the brand ${brand.nombre}: call use_brand with "${brand.id}" first.` : '') +
    ']\n\n' +
    r.instrucciones
  )
}

let runner = null
/** Who does a routine when it comes due; the Telegram conversation registers itself. */
export function setRoutineRunner(fn) {
  runner = fn
}

/**
 * One job handed to Nexy outside any routine — the sales line uses it for a
 * new lead — run the same way and reported the same way. `aviso` is the line
 * the owner sees when it starts. False when nothing can run it yet.
 */
export function runJob(nombre, marca, prompt, aviso) {
  if (!runner) return false
  try {
    runner({ id: 'job', nombre, marca, aviso }, prompt)
    return true
  } catch (err) {
    console.log(`[jarvis] job «${nombre}» could not start: ${err?.message ?? err}`)
    return false
  }
}

/**
 * Start the clock. While any routine is active on a Mac, it also keeps the
 * Mac from dozing off on its own (the built-in caffeinate, only while Nexy
 * runs); closing the lid still puts it to sleep.
 */
export function startRoutines(zone) {
  let awake = null
  const keepAwake = () => {
    const want = process.platform === 'darwin' && readRoutines().some((r) => r.activa)
    if (want && !awake) {
      try {
        awake = spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' })
        awake.on('error', () => (awake = null))
        awake.on('exit', () => (awake = null))
        console.log('[jarvis] routines: keeping this Mac awake while Nexy runs')
      } catch {
        awake = null
      }
    } else if (!want && awake) {
      awake.kill()
      awake = null
    }
  }
  keepAwake()
  onRoutinesChange(keepAwake)

  const tick = () => {
    const list = readRoutines()
    const { due, missed } = dueRoutines(list, zone)
    if (!due.length && !missed.length) return
    for (const { routine, key } of missed) {
      console.log(`[jarvis] routine ${routine.id} skipped: its time passed hours ago`)
      routine.ultima = key
      routine.perdida = key
    }
    for (const { routine, key, late } of due) {
      if (!runner) {
        // Nothing to run it on yet (Telegram still starting); try next tick
        // unless it is a long wait, in which case it counts as missed.
        continue
      }
      routine.ultima = key
      delete routine.perdida
      console.log(`[jarvis] routine ${routine.id} due: ${routine.nombre}`)
      try {
        runner(routine, routinePrompt(routine, late))
      } catch (err) {
        console.log(`[jarvis] routine ${routine.id} could not start: ${err?.message ?? err}`)
      }
    }
    writeRoutines(list)
  }
  const clock = setInterval(tick, TICK_MS)
  clock.unref?.()
  setTimeout(tick, 5_000).unref?.()
  const n = readRoutines().filter((r) => r.activa).length
  console.log(`[jarvis] routines on (${n} active, time zone ${zone})`)
}

export function routinesServer(zone) {
  const find = (id) => {
    const list = readRoutines()
    const f = fold(id)
    const r = list.find((x) => x.id === id) ?? list.find((x) => fold(x.nombre) === f) ?? list.find((x) => f.length >= 3 && fold(x.nombre).includes(f))
    return { list, r }
  }
  const dayList = z
    .array(z.string())
    .optional()
    .describe('Days in Spanish: "lunes"… "domingo", "diario", "entre semana" or "fin de semana". Left out: every day.')

  return createSdkMcpServer({
    name: 'jarvis_rutinas',
    version: '1.0.0',
    instructions:
      "The owner's routines: work Nexy does on her own at set times, every day or on some days. Creating, changing or removing one is approved by the owner with a tap.",
    alwaysLoad: true,
    tools: [
      tool('list_routines', 'The routines the owner has set up, with their days, time, brand and whether they are paused.', {}, async () => {
        const list = readRoutines()
        if (!list.length) return ok('No routines yet.')
        return ok(list.map((r) => describeRoutine(r) + (r.perdida ? `\n  (se saltó la del ${r.perdida}: la Mac estaba apagada)` : '')).join('\n\n'))
      }),

      tool(
        'create_routine',
        'Schedule work for Nexy to do on her own, at a set time every day or on some days — only when the owner asks for it. ' +
          'Write the instructions complete and self-contained, as you would brief someone who will not be able to ask: ' +
          'what to do, for which brand, how much, and what to send back. The owner approves it with a tap.',
        {
          name: z.string().describe('A short name, e.g. "Prospectos NXUS".'),
          instructions: z.string().describe('What to do each time, complete and self-contained.'),
          time: z.string().describe('The time in the owner’s time zone, e.g. "09:00" or "7:30 pm".'),
          days: dayList,
          brand: z.string().optional().describe('The brand it works for, if any.'),
        },
        async ({ name, instructions, time, days, brand }) => {
          const hora = parseTime(time)
          if (!hora) return refuse('Say the time like 09:00 or 7:30 pm.')
          const dias = parseDays(days)
          if (!dias || !dias.length) return refuse('Say the days in Spanish (lunes… domingo), or "diario".')
          const b = brand ? findBrand(brand) : null
          if (brand && !b) return refuse(`There is no brand called ${brand}.`)
          const text = String(instructions ?? '').trim()
          if (text.length < 10) return refuse('Write out what to do each time.')
          const list = readRoutines()
          if (list.length >= MAX_ROUTINES) return refuse(`There are already ${MAX_ROUTINES} routines; remove one first.`)
          const nombre = String(name ?? '').trim().slice(0, 60) || 'Rutina'
          const r = settleToday(
            {
              id: `r${Date.now().toString(36)}`,
              nombre,
              instrucciones: text.slice(0, 4000),
              hora,
              dias,
              marca: b?.id ?? null,
              activa: true,
              creada: new Date().toISOString(),
              ultima: null,
            },
            zone,
          )
          list.push(r)
          writeRoutines(list)
          return ok(`Scheduled. ${describeRoutine(r)}\nIt runs while this Mac is on and Nexy is open, and the report arrives on Telegram.`)
        },
      ),

      tool(
        'update_routine',
        'Pause, resume or change a routine — only when the owner asks. The owner approves it with a tap.',
        {
          routine: z.string().describe('Its id or name.'),
          active: z.boolean().optional().describe('false pauses it, true resumes it.'),
          time: z.string().optional(),
          days: dayList,
          instructions: z.string().optional(),
          name: z.string().optional(),
          brand: z.string().optional(),
        },
        async ({ routine, active, time, days, instructions, name, brand }) => {
          const { list, r } = find(routine)
          if (!r) return refuse('There is no such routine. list_routines shows them.')
          if (time !== undefined) {
            const hora = parseTime(time)
            if (!hora) return refuse('Say the time like 09:00 or 7:30 pm.')
            r.hora = hora
          }
          if (days !== undefined) {
            const dias = parseDays(days)
            if (!dias || !dias.length) return refuse('Say the days in Spanish (lunes… domingo), or "diario".')
            r.dias = dias
          }
          if (instructions !== undefined && String(instructions).trim().length >= 10) r.instrucciones = String(instructions).trim().slice(0, 4000)
          if (name) r.nombre = String(name).trim().slice(0, 60)
          if (brand !== undefined) {
            const b = brand ? findBrand(brand) : null
            if (brand && !b) return refuse(`There is no brand called ${brand}.`)
            r.marca = b?.id ?? null
          }
          if (active !== undefined) r.activa = active
          if (time !== undefined || days !== undefined || active === true) settleToday(r, zone)
          writeRoutines(list)
          return ok(`Updated. ${describeRoutine(r)}`)
        },
      ),

      tool(
        'remove_routine',
        'Delete a routine for good — only when the owner asks. Pausing (update_routine) keeps it for later. The owner approves it with a tap.',
        { routine: z.string().describe('Its id or name.') },
        async ({ routine }) => {
          const { list, r } = find(routine)
          if (!r) return refuse('There is no such routine.')
          writeRoutines(list.filter((x) => x !== r))
          return ok(`Removed «${r.nombre}».`)
        },
      ),

      tool(
        'run_routine_now',
        'Run a routine right away, once, as a test — only when the owner asks. Its schedule does not change.',
        { routine: z.string().describe('Its id or name.') },
        async ({ routine }) => {
          const { r } = find(routine)
          if (!r) return refuse('There is no such routine.')
          return ok(`Do it now, in this turn, exactly as the routine says:\n\n${routinePrompt(r)}`)
        },
      ),
    ],
  })
}
