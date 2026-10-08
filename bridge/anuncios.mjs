import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { readBrands } from './brands.mjs'
import { readTelegram } from './telegram-config.mjs'

/**
 * Watching each company's Meta ad account: the owner hears on Telegram when
 * an ad starts running (or its budget changes), with the basics — company,
 * campaign, who switched it on, budget, where, and for how long — and can ask
 * "¿qué ads tiene activos Mi Semago?" at any time.
 *
 * It reads Meta directly with a read-only key (ads_read) the owner made in
 * Meta Business and typed into `node scripts/meta-ads.mjs` — no model, no
 * cost, and nothing here can create, switch on or spend. Which accounts are
 * watched comes from the brands: every ad account linked to a company
 * (service meta-ads, see brands.mjs) is watched for that company, so linking
 * the next company's account is all it takes to add it.
 *
 *   ~/.nexy/meta-ads.json          the read-only key (this Mac's user only)
 *   ~/.nexy/anuncios-estado.json   what was running at the last look
 */

const DIR = join(homedir(), '.nexy')
export const ADS_FILE = join(DIR, 'meta-ads.json')
const STATE_FILE = join(DIR, 'anuncios-estado.json')
const EVERY_MS = 15 * 60_000
const VERSION = 'v23.0'
const LIVE = ['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'PENDING_REVIEW', 'IN_PROCESS', 'WITH_ISSUES', 'PREAPPROVED', 'PENDING_BILLING_INFO', 'DISAPPROVED']

const readJson = (p, fallback) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}

export function readAdsKey() {
  const cfg = readJson(ADS_FILE, null)
  return cfg && typeof cfg.token === 'string' && cfg.token ? cfg : null
}

export function writeAdsKey(cfg) {
  mkdirSync(DIR, { recursive: true })
  writeFileSync(ADS_FILE, `${JSON.stringify(cfg, null, 2)}\n`, { mode: 0o600 })
  chmodSync(ADS_FILE, 0o600)
}

/** Every company with a Meta ad account linked, and its accounts. */
export function watchedAccounts(brands = readBrands()) {
  return brands.marcas.flatMap((b) =>
    b.conexiones.filter((c) => c.servicio === 'meta-ads').map((c) => ({ marca: b.id, empresa: b.nombre, cuenta: String(c.id).replace(/^act_/i, ''), nombre: c.nombre })),
  )
}

/** One read from Meta's Graph API. Throws with Meta's own message. */
export async function graph(path, params = {}, { key = readAdsKey(), fetchImpl = fetch } = {}) {
  if (!key) throw Object.assign(new Error('There is no Meta read-only key on this Mac yet: the owner runs node scripts/meta-ads.mjs once.'), { code: 'NOKEY' })
  const url = new URL(`https://graph.facebook.com/${key.version || VERSION}/${path.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  // The key travels in a header, never in a URL that could end up in a log.
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${key.token}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    const e = data.error ?? {}
    throw Object.assign(new Error(e.message || `Meta answered ${res.status}`), { code: e.code ?? res.status })
  }
  return data
}

/** Every page of a list, up to a sane limit. */
async function all(path, params, opts) {
  const out = []
  let page = await graph(path, { ...params, limit: 200 }, opts)
  for (let i = 0; i < 5; i += 1) {
    out.push(...(page.data ?? []))
    const after = page.paging?.cursors?.after
    if (!page.paging?.next || !after) break
    page = await graph(path, { ...params, limit: 200, after }, opts)
  }
  return out
}

const ADSET_FIELDS =
  'id,name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time,updated_time,targeting{geo_locations},campaign{id,name,status,objective,daily_budget,lifetime_budget}'

/** What an account has running or ready to run, by ad set. */
export async function readAccount(cuenta, opts) {
  const info = await graph(`act_${cuenta}`, { fields: 'name,currency,timezone_name' }, opts)
  const adsets = await all(`act_${cuenta}/adsets`, { fields: ADSET_FIELDS, filtering: [{ field: 'effective_status', operator: 'IN', value: LIVE }] }, opts)
  return { info, adsets }
}

/** Who switched things on or changed budgets lately, by object id (best effort). */
async function whoDid(cuenta, sinceSec, opts) {
  try {
    const acts = await all(`act_${cuenta}/activities`, { fields: 'actor_name,event_type,object_id,object_name,event_time', since: String(sinceSec) }, opts)
    const out = new Map()
    for (const a of acts) {
      if (!a.object_id || !a.actor_name) continue
      if (!/run_status|budget|create/i.test(a.event_type ?? '')) continue
      if (!out.has(a.object_id)) out.set(a.object_id, a.actor_name)
    }
    return out
  } catch {
    return new Map()
  }
}

// -- reading an ad set as the owner would say it -----------------------------

const NO_OFFSET = new Set(['JPY', 'KRW', 'CLP', 'COP', 'TWD', 'HUF', 'ISK', 'VND', 'PYG', 'IDR'])
export function money(minor, currency = 'USD') {
  const n = Number(minor) / (NO_OFFSET.has(currency) ? 1 : 100)
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ${currency}`
}

/** The budget that really applies: the ad set's, or the campaign's (Advantage+ budget). */
export function budgetOf(s, currency) {
  const c = s.campaign ?? {}
  if (Number(s.daily_budget) > 0) return { text: `${money(s.daily_budget, currency)} diarios`, key: `d${s.daily_budget}` }
  if (Number(s.lifetime_budget) > 0) return { text: `${money(s.lifetime_budget, currency)} en total`, key: `l${s.lifetime_budget}` }
  if (Number(c.daily_budget) > 0) return { text: `${money(c.daily_budget, currency)} diarios (de la campaña completa)`, key: `cd${c.daily_budget}` }
  if (Number(c.lifetime_budget) > 0) return { text: `${money(c.lifetime_budget, currency)} en total (de la campaña completa)`, key: `cl${c.lifetime_budget}` }
  return { text: 'no lo pude leer', key: '' }
}

const COUNTRY = { US: 'Estados Unidos', MX: 'México', CA: 'Canadá', PR: 'Puerto Rico', DO: 'República Dominicana', CO: 'Colombia', GT: 'Guatemala', ES: 'España' }
export function placeOf(t) {
  const g = t?.geo_locations ?? {}
  const unit = (u) => (u === 'kilometer' ? 'km' : 'millas')
  const parts = [
    ...(g.custom_locations ?? []).map((l) => `${l.name || l.address_string || `${l.latitude}, ${l.longitude}`} + ${l.radius} ${unit(l.distance_unit)}`),
    ...(g.cities ?? []).map((c) => `${c.name}${c.region ? `, ${c.region}` : ''}${c.radius ? ` + ${c.radius} ${unit(c.distance_unit)}` : ''}`),
    ...(g.zips ?? []).map((z) => `CP ${z.name ?? z.key}`),
    ...(g.regions ?? []).map((r) => r.name),
    ...(g.geo_markets ?? []).map((m) => m.name),
    ...(g.countries ?? []).map((c) => COUNTRY[c] ?? c),
  ]
  if (!parts.length) return 'no la pude leer'
  return parts.length > 8 ? `${parts.slice(0, 8).join('; ')} y ${parts.length - 8} más` : parts.join('; ')
}

const day = (iso, zone) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: zone })
export function datesOf(s, zone = 'America/New_York') {
  if (!s.start_time) return 'no las pude leer'
  if (!s.end_time) return `desde el ${day(s.start_time, zone)}, sin fecha de fin (corre hasta que lo pausen)`
  const days = Math.max(1, Math.round((new Date(s.end_time) - new Date(s.start_time)) / 86_400_000))
  return `del ${day(s.start_time, zone)} al ${day(s.end_time, zone)} (${days} ${days === 1 ? 'día' : 'días'})`
}

const OBJECTIVE = {
  OUTCOME_LEADS: 'clientes potenciales',
  OUTCOME_SALES: 'ventas',
  OUTCOME_TRAFFIC: 'tráfico',
  OUTCOME_ENGAGEMENT: 'interacción',
  OUTCOME_AWARENESS: 'reconocimiento',
  OUTCOME_APP_PROMOTION: 'promoción de app',
  LEAD_GENERATION: 'clientes potenciales',
  MESSAGES: 'mensajes',
  CONVERSIONS: 'conversiones',
  LINK_CLICKS: 'clics',
  REACH: 'alcance',
}

/** Running right now, as far as anyone set it: the ad set and its campaign on, and not over. */
export const isOn = (s, now = Date.now()) => s.status === 'ACTIVE' && s.campaign?.status === 'ACTIVE' && (!s.end_time || new Date(s.end_time).getTime() > now)

export function describe(s, { currency, zone, who, whoLabel = 'Lo activó' }) {
  const c = s.campaign ?? {}
  return [
    `• Campaña: ${c.name ?? '—'}${s.name && s.name !== c.name ? ` → ${s.name}` : ''}`,
    ...(who !== undefined ? [`• ${whoLabel}: ${who || '(Meta no lo dijo)'}`] : []),
    `• Presupuesto: ${budgetOf(s, currency).text}`,
    `• Ubicación: ${placeOf(s.targeting)}`,
    `• Fechas: ${datesOf(s, zone)}`,
    ...(c.objective ? [`• Objetivo: ${OBJECTIVE[c.objective] ?? c.objective.toLowerCase()}`] : []),
    ...(s.effective_status && s.effective_status !== 'ACTIVE' ? [`• Estado en Meta: ${s.effective_status === 'PENDING_REVIEW' || s.effective_status === 'IN_PROCESS' ? 'en revisión' : s.effective_status.toLowerCase()}`] : []),
  ].join('\n')
}

// -- the watch ---------------------------------------------------------------

async function tellOwner(text, fetchImpl = fetch) {
  const tg = readTelegram()
  if (!tg?.token || !tg.owner?.id) return false
  try {
    await fetchImpl(`https://api.telegram.org/bot${tg.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: tg.owner.id, text: text.slice(0, 4000) }),
    })
    return true
  } catch {
    return false
  }
}

/**
 * One look at every watched account: compares with the last look and returns
 * the messages for the owner (and keeps the new state). The first look at an
 * account only learns what is there.
 */
export async function check({ opts = {}, now = Date.now(), notifyPauses = readAdsKey()?.avisarPausas === true } = {}) {
  const state = readJson(STATE_FILE, { cuentas: {} })
  const messages = []
  const errors = []
  for (const a of watchedAccounts()) {
    const prev = state.cuentas[a.cuenta]
    let data
    try {
      data = await readAccount(a.cuenta, opts)
    } catch (err) {
      errors.push({ ...a, error: err.message, code: err.code })
      continue
    }
    const currency = data.info.currency ?? 'USD'
    const zone = data.info.timezone_name ?? 'America/New_York'
    const seen = {}
    for (const s of data.adsets) seen[s.id] = { on: isOn(s, now), budget: budgetOf(s, currency).key, name: s.name }
    if (prev) {
      const sinceSec = Math.floor((prev.at ? new Date(prev.at).getTime() : now - EVERY_MS) / 1000) - 120
      const started = data.adsets.filter((s) => seen[s.id].on && !prev.adsets?.[s.id]?.on)
      const rebudget = data.adsets.filter((s) => seen[s.id].on && prev.adsets?.[s.id]?.on && prev.adsets[s.id].budget && seen[s.id].budget && prev.adsets[s.id].budget !== seen[s.id].budget)
      const stopped = notifyPauses ? Object.entries(prev.adsets ?? {}).filter(([id, p]) => p.on && !seen[id]?.on) : []
      const who = started.length || rebudget.length ? await whoDid(a.cuenta, sinceSec, opts) : new Map()
      const by = (s) => who.get(s.id) ?? who.get(s.campaign?.id) ?? ''
      const away = prev.at && now - new Date(prev.at).getTime() > EVERY_MS * 2 ? ' (mientras Nexy estaba apagada)' : ''
      for (const s of started) messages.push(`📢 ${a.empresa} — se activó un ad${away}\n${describe(s, { currency, zone, who: by(s) })}`)
      for (const s of rebudget) {
        const before = prev.adsets[s.id].budget
        messages.push(
          `💰 ${a.empresa} — cambió el presupuesto de un ad${away}\n${describe(s, { currency, zone, who: by(s), whoLabel: 'Lo cambió' })}\n• Antes: ${budgetKeyText(before, currency)}`,
        )
      }
      for (const [, p] of stopped) messages.push(`⏸️ ${a.empresa} — se pausó o terminó: ${p.name}${away}`)
    }
    // The first look at an account: say it is being watched, and what is on.
    if (!prev) messages.push(`👀 Ya vigilo los ads de ${a.empresa} (cuenta ${data.info.name ?? a.cuenta}): ${Object.values(seen).filter((x) => x.on).length} activo(s) ahora. Te aviso cuando se active uno o cambie su presupuesto.`)
    state.cuentas[a.cuenta] = { marca: a.marca, at: new Date(now).toISOString(), adsets: seen }
  }
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)
  return { messages, errors }
}

function budgetKeyText(key, currency) {
  const m = String(key).match(/^(c?)([dl])(\d+)$/)
  if (!m) return '—'
  return `${money(m[3], currency)} ${m[2] === 'd' ? 'diarios' : 'en total'}${m[1] ? ' (de la campaña completa)' : ''}`
}

/** Every 15 minutes while Nexy is on; the first look a minute after she starts. */
export function startAdsWatch() {
  if (!readAdsKey()) {
    console.log('[jarvis] ads watch off — set it up with: node scripts/meta-ads.mjs')
    return
  }
  let warned = 0
  const run = async () => {
    if (!watchedAccounts().length) return
    try {
      const { messages, errors } = await check()
      for (const m of messages) await tellOwner(m)
      if (messages.length) console.log(`[jarvis] ads watch: ${messages.length} change(s) told to the owner`)
      // A key that stopped working: once a day, not every 15 minutes.
      if (errors.length && Date.now() - warned > 24 * 3_600_000) {
        warned = Date.now()
        const dead = errors.some((e) => e.code === 190 || e.code === 'NOKEY')
        await tellOwner(
          dead
            ? '⚠️ La llave de Meta (solo lectura) ya no sirve, así que no estoy vigilando los ads. Haz una nueva y pégala con: node scripts/meta-ads.mjs'
            : `⚠️ No pude revisar los ads de ${errors.map((e) => e.empresa).join(', ')}: ${errors[0].error}`,
        )
      }
    } catch (err) {
      console.log(`[jarvis] ads watch: ${err.message}`)
    }
  }
  setTimeout(run, 60_000).unref?.()
  setInterval(run, EVERY_MS).unref?.()
  console.log(`[jarvis] ads watch on (${watchedAccounts().map((a) => a.empresa).join(', ') || 'no ad accounts linked yet'})`)
}

// -- asking ------------------------------------------------------------------

/** What a company (or all of them) has running now, in the same words as the alerts. */
export async function runningNow(marca, opts) {
  let accounts = watchedAccounts().filter((a) => !marca || a.marca === marca)
  // A company with no ad account of its own advertises from its holding's.
  const holding = marca && !accounts.length ? readBrands().marcas.find((b) => b.id === marca)?.padre : null
  if (holding) accounts = watchedAccounts().filter((a) => a.marca === holding)
  if (!accounts.length) return marca ? 'That company has no Meta ad account linked yet.' : 'No company has a Meta ad account linked yet.'
  const out = []
  for (const a of accounts) {
    try {
      const { info, adsets } = await readAccount(a.cuenta, opts)
      const on = adsets.filter((s) => isOn(s))
      const currency = info.currency ?? 'USD'
      const zone = info.timezone_name ?? 'America/New_York'
      out.push(
        `## ${a.empresa} (cuenta ${info.name ?? a.cuenta})\n` +
          (on.length ? on.map((s) => describe(s, { currency, zone })).join('\n\n') : 'Nada activo ahora.'),
      )
    } catch (err) {
      out.push(`## ${a.empresa}\nCould not read it: ${err.message}`)
    }
  }
  return out.join('\n\n')
}

/** Nexy's tool for "¿qué ads tiene activos Mi Semago?". Read only. */
export function adsWatchServer() {
  return createSdkMcpServer({
    name: 'jarvis_anuncios',
    version: '1.0.0',
    instructions: "What each company's Meta ads are running now: budget, location, dates. Read only.",
    tools: [
      tool(
        'list_running_ads',
        "Each company's Meta ads running right now, with campaign, budget, location, dates and objective. Use it whenever the owner asks what ads are on, what they spend, or where they show; pass the company id, or none for all. Read only.",
        { marca: z.string().optional().describe('Company id, e.g. mi-semago. Omit for every company.') },
        async ({ marca }) => {
          try {
            return { content: [{ type: 'text', text: await runningNow(marca) }] }
          } catch (err) {
            return { isError: true, content: [{ type: 'text', text: err.message }] }
          }
        },
      ),
    ],
  })
}
