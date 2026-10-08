import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { brandOfTag, inShare, readBrands, readShared, tagOf, tagsFor } from './brands.mjs'
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

/**
 * Every company with a Meta ad account linked, and its accounts, once each.
 * A shared account (see brands.mjs) carries its share: who it is for comes
 * from each campaign's "[Company]" tag.
 */
export function watchedAccounts(brands = readBrands()) {
  const shares = readShared()
  const out = []
  for (const b of brands.marcas) {
    for (const c of b.conexiones.filter((x) => x.servicio === 'meta-ads')) {
      const cuenta = String(c.id).replace(/^act_/i, '')
      if (out.some((a) => a.cuenta === cuenta)) continue
      const share = shares.find((x) => x.id === cuenta) ?? null
      const empresa = share ? share.marcas.map((m) => brands.marcas.find((x) => x.id === m)?.nombre ?? m).join(' + ') : b.nombre
      out.push({ marca: b.id, empresa, cuenta, nombre: c.nombre, compartida: share })
    }
  }
  return out
}

/** Which company an ad set is for: the account's, or in a shared account its campaign's tag. */
export function companyOf(a, s, marcas = readBrands().marcas) {
  if (!a.compartida) return a.empresa
  return brandOfTag(tagOf(s.campaign?.name) ?? tagOf(s.name), marcas)?.nombre ?? null
}
const UNTAGGED = '⚠️ Sin empresa en el nombre'

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
    for (const s of data.adsets) seen[s.id] = { on: isOn(s, now), budget: budgetOf(s, currency).key, name: s.campaign?.name && s.campaign.name !== s.name ? `${s.campaign.name} → ${s.name}` : s.name }
    if (prev) {
      const sinceSec = Math.floor((prev.at ? new Date(prev.at).getTime() : now - EVERY_MS) / 1000) - 120
      const started = data.adsets.filter((s) => seen[s.id].on && !prev.adsets?.[s.id]?.on)
      const rebudget = data.adsets.filter((s) => seen[s.id].on && prev.adsets?.[s.id]?.on && prev.adsets[s.id].budget && seen[s.id].budget && prev.adsets[s.id].budget !== seen[s.id].budget)
      const stopped = notifyPauses ? Object.entries(prev.adsets ?? {}).filter(([id, p]) => p.on && !seen[id]?.on) : []
      const who = started.length || rebudget.length ? await whoDid(a.cuenta, sinceSec, opts) : new Map()
      const by = (s) => who.get(s.id) ?? who.get(s.campaign?.id) ?? ''
      const away = prev.at && now - new Date(prev.at).getTime() > EVERY_MS * 2 ? ' (mientras Nexy estaba apagada)' : ''
      const label = (s) => companyOf(a, s) ?? `${UNTAGGED} (cuenta compartida ${a.empresa})`
      const fix = (s) => (a.compartida && !companyOf(a, s) ? '\n• Ponle al nombre de la campaña la empresa entre corchetes, por ejemplo "[Abuelito Cheese] …", para saber de quién es.' : '')
      for (const s of started) messages.push(`📢 ${label(s)} — se activó un ad${away}\n${describe(s, { currency, zone, who: by(s) })}${fix(s)}`)
      for (const s of rebudget) {
        const before = prev.adsets[s.id].budget
        messages.push(
          `💰 ${label(s)} — cambió el presupuesto de un ad${away}\n${describe(s, { currency, zone, who: by(s), whoLabel: 'Lo cambió' })}\n• Antes: ${budgetKeyText(before, currency)}${fix(s)}`,
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

/** The accounts that hold a company's ads: its own, its holding's, or a share it is in. */
function accountsFor(marca, marcas = readBrands().marcas) {
  const all = watchedAccounts()
  if (!marca) return all
  const b = marcas.find((x) => x.id === marca)
  if (!b) return []
  const own = all.filter((a) => a.marca === marca || (a.compartida && inShare(a.compartida, b, marcas)))
  if (own.length) return own
  // A company with no ad account of its own advertises from its holding's.
  return b.padre ? all.filter((a) => a.marca === b.padre) : []
}

/** In a shared account, whether an ad set is this company's (a holding sees its companies'). */
function belongs(a, s, marca, marcas) {
  if (!a.compartida || !marca) return true
  const b = marcas.find((x) => x.id === marca)
  const who = companyOf(a, s, marcas)
  return Boolean(b && who && tagsFor(b, marcas).includes(who))
}

/** What a company (or all of them) has running now, in the same words as the alerts. */
export async function runningNow(marca, opts) {
  const marcas = readBrands().marcas
  const accounts = accountsFor(marca, marcas)
  if (!accounts.length) return marca ? 'That company has no Meta ad account linked yet.' : 'No company has a Meta ad account linked yet.'
  const out = []
  for (const a of accounts) {
    try {
      const { info, adsets } = await readAccount(a.cuenta, opts)
      const currency = info.currency ?? 'USD'
      const zone = info.timezone_name ?? 'America/New_York'
      const on = adsets.filter((s) => isOn(s))
      if (!a.compartida) {
        out.push(`## ${a.empresa} (cuenta ${info.name ?? a.cuenta})\n` + (on.length ? on.map((s) => describe(s, { currency, zone })).join('\n\n') : 'Nada activo ahora.'))
        continue
      }
      // A shared account: each company apart, and what has no company tag flagged.
      const groups = new Map()
      for (const s of on) {
        if (!belongs(a, s, marca, marcas) && companyOf(a, s, marcas)) continue
        const k = companyOf(a, s, marcas) ?? UNTAGGED
        groups.set(k, [...(groups.get(k) ?? []), s])
      }
      const wanted = marca ? tagsFor(marcas.find((x) => x.id === marca), marcas) : []
      for (const w of wanted) if (!groups.has(w)) groups.set(w, [])
      if (!groups.size) out.push(`## Cuenta compartida ${a.empresa} (${info.name ?? a.cuenta})\nNada activo ahora.`)
      for (const [k, list] of groups) {
        out.push(
          `## ${k} (cuenta compartida ${info.name ?? a.cuenta})\n` +
            (list.length ? list.map((s) => describe(s, { currency, zone })).join('\n\n') : 'Nada activo ahora.') +
            (k === UNTAGGED && list.length ? '\n(These campaigns have no company tag in their name: ask the owner whose they are.)' : ''),
        )
      }
    } catch (err) {
      out.push(`## ${a.empresa}\nCould not read it: ${err.message}`)
    }
  }
  return out.join('\n\n')
}

// -- reports -----------------------------------------------------------------

const PERIODS = { hoy: 'today', ayer: 'yesterday', '7dias': 'last_7d', '14dias': 'last_14d', '30dias': 'last_30d', 'este-mes': 'this_month', 'mes-pasado': 'last_month' }
const count = (actions, re) => (actions ?? []).filter((x) => re.test(x.action_type)).reduce((n, x) => n + Number(x.value || 0), 0)

/** Spend and results per company and campaign over a period, from Meta's insights. */
export async function adsReport(marca, periodo = '7dias', opts) {
  const marcas = readBrands().marcas
  const accounts = accountsFor(marca, marcas)
  if (!accounts.length) return marca ? 'That company has no Meta ad account linked yet.' : 'No company has a Meta ad account linked yet.'
  const preset = PERIODS[periodo] ?? 'last_7d'
  const out = []
  for (const a of accounts) {
    try {
      const info = await graph(`act_${a.cuenta}`, { fields: 'name,currency' }, opts)
      const rows = await all(`act_${a.cuenta}/insights`, { level: 'campaign', date_preset: preset, fields: 'campaign_name,spend,impressions,clicks,actions' }, opts)
      const groups = new Map()
      for (const r of rows) {
        const fake = { campaign: { name: r.campaign_name }, name: r.campaign_name }
        if (!belongs(a, fake, marca, marcas) && companyOf(a, fake, marcas)) continue
        const k = companyOf(a, fake, marcas) ?? UNTAGGED
        groups.set(k, [...(groups.get(k) ?? []), r])
      }
      if (!groups.size) out.push(`## ${a.compartida ? `Cuenta compartida ${a.empresa}` : a.empresa}\nSin gasto en ese periodo.`)
      for (const [k, list] of groups) {
        const cur = info.currency ?? 'USD'
        const spend = list.reduce((n, r) => n + Number(r.spend || 0), 0)
        const line = (r) => {
          const leads = count(r.actions, /lead/i)
          const msgs = count(r.actions, /messaging_conversation_started/i)
          return `• ${r.campaign_name}: $${Number(r.spend || 0).toFixed(2)} ${cur} · ${Number(r.impressions || 0).toLocaleString('en-US')} impresiones · ${r.clicks ?? 0} clics` +
            (leads ? ` · ${leads} leads ($${(Number(r.spend) / leads).toFixed(2)} c/u)` : '') + (msgs ? ` · ${msgs} conversaciones` : '')
        }
        out.push(`## ${k}${a.compartida ? ` (cuenta compartida ${info.name ?? a.cuenta})` : ''} — gastado: $${spend.toFixed(2)} ${cur}\n${list.map(line).join('\n')}`)
      }
    } catch (err) {
      out.push(`## ${a.empresa}\nCould not read it: ${err.message}`)
    }
  }
  return `Periodo: ${periodo}\n\n${out.join('\n\n')}`
}

// -- the lock inside a shared account ----------------------------------------

const OBJECT_KEY = /^(campaign_?id|adset_?id|ad_?set_?id|ad_?id|object_?id|id|campaign_?ids|adset_?ids|ad_?ids)$/i
const CREATES = /create|duplicate|copy/i

/**
 * A write in a shared ad account (see brands.mjs): what is created is named
 * for the company Nexy is working in ("[Abuelito Cheese] …", added when
 * missing), and what is changed must already carry one of its tags — read
 * from Meta with the read-only key, so the model cannot claim it.
 * Resolves { ok, input?, changed? } or { ok: false, message }.
 */
export async function sharedWriteCheck(tool, input, tags, opts) {
  const mine = (name) => tags.includes(brandOfTag(tagOf(name))?.nombre)
  if (CREATES.test(tool)) {
    let changed = false
    const tagName = (obj) => {
      if (!obj || typeof obj !== 'object' || typeof obj.name !== 'string') return null
      const t = tagOf(obj.name)
      if (t && !mine(obj.name)) return `"${obj.name}" is tagged for ${t}, and you are working for ${tags[0]}. Name it for ${tags[0]}, or switch company with use_brand.`
      if (!t) {
        obj.name = `[${tags[0]}] ${obj.name.trim()}`
        changed = true
      }
      return null
    }
    const copy = JSON.parse(JSON.stringify(input ?? {}))
    const problems = [tagName(copy), ...Object.values(copy).map((v) => (v && typeof v === 'object' && !Array.isArray(v) ? tagName(v) : null))].filter(Boolean)
    if (problems.length) return { ok: false, message: `Blocked: ${problems[0]}` }
    return { ok: true, input: copy, changed }
  }
  // Changing something that exists: it has to be this company's.
  const ids = []
  for (const [k, v] of Object.entries(input ?? {})) if (OBJECT_KEY.test(k)) for (const x of Array.isArray(v) ? v : [v]) if (/^\d{6,}$/.test(String(x))) ids.push(String(x))
  if (!ids.length) {
    // Something that names no campaign, ad set or ad: allowed when its own name (if any) is ours.
    if (typeof input?.name === 'string' && tagOf(input.name) && !mine(input.name)) return { ok: false, message: `Blocked: "${input.name}" is not ${tags[0]}'s.` }
    return { ok: true }
  }
  for (const id of ids) {
    let obj
    try {
      obj = await graph(id, { fields: 'name,campaign{name}' }, opts)
    } catch (err) {
      return { ok: false, message: `Blocked: this ad account is shared, and I could not check whose ${id} is (${err.message}). Ask the owner to check it in Ads Manager.` }
    }
    const name = obj.campaign?.name ?? obj.name
    if (!mine(name)) {
      const t = tagOf(name)
      return {
        ok: false,
        message: t
          ? `Blocked: "${name}" is ${t}'s, and you are working for ${tags[0]}. Never change another company's ads; if the owner meant ${t}, switch with use_brand.`
          : `Blocked: "${name}" has no company tag, so it is not clear whose it is. Ask the owner; once it is renamed "[Company] …" you can change it.`,
      }
    }
  }
  return { ok: true }
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
      tool(
        'get_ads_report',
        "Each company's Meta ad spend and results over a period (per campaign: spent, impressions, clicks, leads and cost per lead, conversations). In a shared ad account each company is reported apart by its campaign tag. Read only.",
        {
          marca: z.string().optional().describe('Company id, e.g. abuelito-cheese. Omit for every company.'),
          periodo: z.enum(Object.keys(PERIODS)).optional().describe('Default 7dias.'),
        },
        async ({ marca, periodo }) => {
          try {
            return { content: [{ type: 'text', text: await adsReport(marca, periodo) }] }
          } catch (err) {
            return { isError: true, content: [{ type: 'text', text: err.message }] }
          }
        },
      ),
    ],
  })
}
