import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { z } from 'zod'
import { findBrand, readLogo } from './brands.mjs'
import { CHROMES, run } from './etiquetas.mjs'

/**
 * The content calendar ("parrilla") of each brand: its strategy — goals,
 * audience, pillars and their share, networks and how often, KPIs — and,
 * week by week, every post with its day, time, networks, format, pillar,
 * hook, copy, call to action, visual brief and where it stands:
 *
 *   idea → en_produccion → listo → aprobado → programado → publicado  (or descartado)
 *
 * Nexy plans the week (with the strategist and the writers), the owner
 * changes what he wants, she produces it (Canva, Higgsfield, the video
 * editor) and schedules it in Metricool — every post held for his tap, as
 * always — and marks each step here. The week can be drawn as a PDF to send
 * or present.
 *
 * Only files on this Mac: nothing here posts, sends or spends.
 *
 *   ~/.nexy/parrillas/<brand>/estrategia.json
 *   ~/.nexy/parrillas/<brand>/<monday YYYY-MM-DD>.json   (+ .anteriores/, the versions before)
 *   ~/Documents/Nexy/parrillas/<Brand>/Parrilla-<brand>-<monday>.pdf|.html
 */

export const PLANS_DIR = join(homedir(), '.nexy', 'parrillas')
export const EXPORT_DIR = join(homedir(), 'Documents', 'Nexy', 'parrillas')
const KEEP_VERSIONS = 30

export const STATES = ['idea', 'en_produccion', 'listo', 'aprobado', 'programado', 'publicado', 'descartado']
const STATE_LABEL = { idea: 'Idea', en_produccion: 'En producción', listo: 'Listo', aprobado: 'Aprobado', programado: 'Programado', publicado: 'Publicado', descartado: 'Descartado' }
const STATE_COLOR = { idea: '#94a3b8', en_produccion: '#f59e0b', listo: '#3b82f6', aprobado: '#8b5cf6', programado: '#0ea5e9', publicado: '#22c55e', descartado: '#ef4444' }
const NETWORKS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x', 'threads', 'pinterest', 'whatsapp', 'google']
const NET_LABEL = { instagram: 'IG', facebook: 'FB', tiktok: 'TikTok', linkedin: 'LinkedIn', youtube: 'YouTube', x: 'X', threads: 'Threads', pinterest: 'Pinterest', whatsapp: 'WhatsApp', google: 'Google' }
const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const PALETTE = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626']

const readJson = (f, fallback) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8'))
  } catch {
    return fallback
  }
}

// -- dates ------------------------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/
const iso = (d) => d.toISOString().slice(0, 10)
const utc = (s) => new Date(`${s}T12:00:00Z`)
/** Today in New York, as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
/** The Monday of the week a date falls in. */
export function mondayOf(s = today()) {
  const d = utc(DATE.test(s) ? s : today())
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return iso(d)
}
const addDays = (s, n) => {
  const d = utc(s)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
/** "esta", "próxima", "siguiente" or a date, to the Monday of that week. */
export function weekOf(q) {
  const w = String(q ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  if (!w || /^(esta|actual|this)/.test(w)) return mondayOf()
  if (/^(proxima|siguiente|next)/.test(w)) return addDays(mondayOf(), 7)
  if (/^(pasada|anterior|last)/.test(w)) return addDays(mondayOf(), -7)
  return DATE.test(w) ? mondayOf(w) : null
}
const shortDate = (s) => utc(s).toLocaleDateString('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short' })

// -- the data ---------------------------------------------------------------------

const brandDir = (id) => join(PLANS_DIR, id)
const planFile = (id, monday) => join(brandDir(id), `${monday}.json`)

export const readStrategy = (id) => readJson(join(brandDir(id), 'estrategia.json'), null)
export function saveStrategy(id, s) {
  mkdirSync(brandDir(id), { recursive: true })
  writeFileSync(join(brandDir(id), 'estrategia.json'), `${JSON.stringify({ ...s, actualizada: new Date().toISOString() }, null, 2)}\n`)
}

export const readPlan = (id, monday) => readJson(planFile(id, monday), null)
export function listPlans(id) {
  try {
    return readdirSync(brandDir(id))
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
  } catch {
    return []
  }
}

/** Save a week, keeping the one before it. */
export function savePlan(id, plan) {
  mkdirSync(brandDir(id), { recursive: true })
  const f = planFile(id, plan.semana)
  if (existsSync(f)) {
    const old = join(brandDir(id), '.anteriores')
    mkdirSync(old, { recursive: true })
    copyFileSync(f, join(old, `${plan.semana}-${Date.now()}.json`))
    const kept = readdirSync(old).filter((x) => x.startsWith(plan.semana)).sort()
    for (const x of kept.slice(0, Math.max(0, kept.length - KEEP_VERSIONS))) rmSync(join(old, x), { force: true })
  }
  writeFileSync(f, `${JSON.stringify({ ...plan, actualizada: new Date().toISOString() }, null, 2)}\n`)
}

const clip = (s, n) => (s == null ? '' : String(s).trim().slice(0, n))

/** A post as it is kept: known fields only, dates inside its week, a known state. */
export function cleanPost(p, monday, n) {
  const fecha = DATE.test(p.fecha ?? '') ? p.fecha : null
  if (!fecha || fecha < monday || fecha > addDays(monday, 6)) return { error: `${p.id ?? `#${n}`}: la fecha ${p.fecha ?? '(ninguna)'} no está en la semana del ${monday} al ${addDays(monday, 6)}.` }
  const redes = [...new Set((p.redes ?? []).map((r) => String(r).toLowerCase().trim()))]
  const bad = redes.filter((r) => !NETWORKS.includes(r))
  if (!redes.length || bad.length) return { error: `${p.id ?? `#${n}`}: redes no válidas (${bad.join(', ') || 'ninguna'}). Usa: ${NETWORKS.join(', ')}.` }
  const estado = p.estado ?? 'idea'
  if (!STATES.includes(estado)) return { error: `${p.id ?? `#${n}`}: estado no válido (${estado}).` }
  return {
    post: {
      id: /^P\d{1,3}$/.test(p.id ?? '') ? p.id : `P${n}`,
      fecha,
      hora: /^\d{1,2}:\d{2}$/.test(p.hora ?? '') ? p.hora.padStart(5, '0') : '',
      redes,
      formato: clip(p.formato, 40),
      pilar: clip(p.pilar, 60),
      tema: clip(p.tema, 200),
      gancho: clip(p.gancho, 300),
      copy: clip(p.copy, 3000),
      cta: clip(p.cta, 200),
      hashtags: clip(p.hashtags, 500),
      visual: clip(p.visual, 1500),
      estado,
      archivo: clip(p.archivo, 1000),
      metricool: clip(p.metricool, 200),
      notas: clip(p.notas, 1000),
    },
  }
}

const sortPosts = (posts) => posts.sort((a, b) => (a.fecha + (a.hora || '99')).localeCompare(b.fecha + (b.hora || '99')))

// -- the PDF --------------------------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const nl = (s) => esc(s).replace(/\n/g, '<br>')

export function planHtml(brand, plan, strategy) {
  const posts = plan.publicaciones.filter((p) => p.estado !== 'descartado')
  const pillars = [...new Set([...(strategy?.pilares ?? []).map((p) => p.nombre), ...posts.map((p) => p.pilar).filter(Boolean)])]
  const color = (pilar) => PALETTE[Math.max(0, pillars.indexOf(pilar)) % PALETTE.length]
  const count = (key) => posts.reduce((m, p) => ((m[key(p)] = (m[key(p)] ?? 0) + 1), m), {})
  const byPillar = count((p) => p.pilar || 'Sin pilar')
  const byFormat = count((p) => p.formato || 'Sin formato')
  const byState = count((p) => p.estado)
  const byNet = posts.flatMap((p) => p.redes).reduce((m, r) => ((m[r] = (m[r] ?? 0) + 1), m), {})
  const accent = /^#[0-9a-f]{6}$/i.test(brand.color ?? '') ? brand.color : '#111827'
  let logo = ''
  const lf = readLogo(brand.id)
  if (lf) {
    const mime = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[extname(lf).toLowerCase()]
    if (mime) logo = `<img class="logo" src="data:${mime};base64,${readFileSync(lf).toString('base64')}">`
  }
  const chips = (m, label = (k) => k) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<span class="chip">${esc(label(k))} <b>${v}</b></span>`)
      .join('')
  const days = DAY_NAMES.map((name, i) => {
    const date = addDays(plan.semana, i)
    const cards = posts
      .filter((p) => p.fecha === date)
      .map(
        (p) => `<div class="card" style="border-left-color:${color(p.pilar)}">
          <div class="top"><span class="time">${esc(p.hora || '—')}</span><span class="st" style="background:${STATE_COLOR[p.estado]}">${STATE_LABEL[p.estado]}</span></div>
          <div class="meta">${esc(p.formato)} · ${p.redes.map((r) => NET_LABEL[r]).join(' + ')}</div>
          <div class="pil" style="color:${color(p.pilar)}">${esc(p.pilar)}</div>
          <div class="hook">${esc(p.gancho || p.tema)}</div>
        </div>`,
      )
      .join('')
    return `<div class="day"><div class="dh">${name}<span>${shortDate(date)}</span></div>${cards || '<div class="empty">—</div>'}</div>`
  }).join('')
  const rows = posts
    .map(
      (p) => `<tr>
        <td><b>${esc(p.id)}</b><br>${DAY_NAMES[(utc(p.fecha).getUTCDay() + 6) % 7]} ${shortDate(p.fecha)}<br>${esc(p.hora)}</td>
        <td>${p.redes.map((r) => NET_LABEL[r]).join(', ')}<br><i>${esc(p.formato)}</i><br><span style="color:${color(p.pilar)};font-weight:700">${esc(p.pilar)}</span></td>
        <td>${p.gancho ? `<b>${esc(p.gancho)}</b><br>` : ''}${nl(p.copy)}${p.cta ? `<br><b>CTA:</b> ${esc(p.cta)}` : ''}${p.hashtags ? `<br><span class="tags">${esc(p.hashtags)}</span>` : ''}</td>
        <td>${nl(p.visual)}</td>
        <td><span class="st" style="background:${STATE_COLOR[p.estado]}">${STATE_LABEL[p.estado]}</span>${p.notas ? `<br><small>${esc(p.notas)}</small>` : ''}</td>
      </tr>`,
    )
    .join('')
  const kpis = (strategy?.kpis ?? []).map((k) => `<li><b>${esc(k.nombre)}</b>${k.meta ? `: ${esc(k.meta)}` : ''}</li>`).join('')
  const mix = (strategy?.pilares ?? []).map((p) => `<li><span class="dot" style="background:${color(p.nombre)}"></span><b>${esc(p.nombre)}</b>${p.porcentaje ? ` · ${esc(p.porcentaje)}%` : ''}${p.descripcion ? ` — ${esc(p.descripcion)}` : ''}</li>`).join('')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Parrilla ${esc(brand.nombre)} · semana del ${shortDate(plan.semana)}</title>
<style>
@page { size: 11in 8.5in; margin: 0.4in; }
* { box-sizing: border-box; }
body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #111827; margin: 0; font-size: 11px; background: #fff; }
header { display: flex; align-items: center; gap: 16px; border-bottom: 4px solid ${accent}; padding-bottom: 10px; margin-bottom: 12px; }
.logo { height: 48px; max-width: 140px; object-fit: contain; }
h1 { margin: 0; font-size: 22px; }
h2 { font-size: 14px; margin: 16px 0 6px; color: ${accent}; }
.sub { color: #4b5563; font-size: 12px; margin-top: 2px; }
.goal { background: #f3f4f6; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; font-size: 12px; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
.stat .n { font-size: 22px; font-weight: 800; color: ${accent}; }
.stat .l { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
.chip { display: inline-block; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; margin: 2px 2px 0 0; font-size: 10px; }
.week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.day { background: #f9fafb; border-radius: 8px; padding: 6px; min-height: 120px; }
.dh { font-weight: 800; font-size: 11px; margin-bottom: 6px; display: flex; justify-content: space-between; }
.dh span { color: #6b7280; font-weight: 500; }
.card { background: #fff; border: 1px solid #e5e7eb; border-left: 4px solid; border-radius: 6px; padding: 5px; margin-bottom: 5px; break-inside: avoid; }
.top { display: flex; justify-content: space-between; align-items: center; }
.time { font-weight: 700; }
.st { color: #fff; border-radius: 999px; padding: 1px 6px; font-size: 8.5px; font-weight: 700; white-space: nowrap; }
.meta { color: #6b7280; font-size: 9px; margin-top: 2px; }
.pil { font-size: 9px; font-weight: 700; margin-top: 2px; }
.hook { font-size: 10px; margin-top: 3px; line-height: 1.25; }
.empty { color: #d1d5db; text-align: center; padding-top: 30px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
ul { margin: 4px 0; padding-left: 16px; } li { margin: 2px 0; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
table { width: 100%; border-collapse: collapse; font-size: 10px; }
th { text-align: left; background: ${accent}; color: #fff; padding: 5px; }
td { border-bottom: 1px solid #e5e7eb; padding: 5px; vertical-align: top; }
tr { break-inside: avoid; }
.tags { color: #2563eb; }
.page { break-before: page; }
footer { margin-top: 14px; color: #9ca3af; font-size: 9px; text-align: right; }
</style></head><body>
<header>${logo}<div><h1>Parrilla de contenido · ${esc(brand.nombre)}</h1><div class="sub">Semana del ${shortDate(plan.semana)} al ${shortDate(addDays(plan.semana, 6))} ${plan.semana.slice(0, 4)}</div></div></header>
${plan.objetivo ? `<div class="goal"><b>Objetivo de la semana:</b> ${esc(plan.objetivo)}</div>` : ''}
<div class="stats">
  <div class="stat"><div class="n">${posts.length}</div><div class="l">Publicaciones</div></div>
  <div class="stat"><div class="l">Por red</div>${chips(byNet, (k) => NET_LABEL[k] ?? k)}</div>
  <div class="stat"><div class="l">Por formato</div>${chips(byFormat)}</div>
  <div class="stat"><div class="l">Avance</div>${chips(byState, (k) => STATE_LABEL[k] ?? k)}</div>
</div>
<div class="week">${days}</div>
<div class="stat" style="margin-top:8px"><div class="l">Por pilar</div>${chips(byPillar)}</div>
${mix || kpis ? `<div class="cols">${mix ? `<div><h2>Pilares de contenido</h2><ul>${mix}</ul></div>` : ''}${kpis ? `<div><h2>Metas (KPIs)</h2><ul>${kpis}</ul></div>` : ''}</div>` : ''}
<div class="page"><h2>Detalle de cada publicación</h2>
<table><thead><tr><th style="width:9%">Cuándo</th><th style="width:13%">Dónde · formato · pilar</th><th style="width:44%">Gancho, texto y llamado a la acción</th><th style="width:24%">Visual</th><th style="width:10%">Estado</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Sin publicaciones todavía.</td></tr>'}</tbody></table></div>
<footer>Actualizada ${new Date(plan.actualizada ?? Date.now()).toLocaleString('es-MX', { timeZone: 'America/New_York' })}</footer>
</body></html>`
}

/** The week as HTML and, when Chrome is there, as a PDF; resolves the paths. */
export async function exportPlan(brand, plan) {
  const dir = join(EXPORT_DIR, brand.nombre.replace(/[^\w .-]/g, '').trim() || brand.id)
  mkdirSync(dir, { recursive: true })
  const base = join(dir, `Parrilla-${brand.id}-${plan.semana}`)
  writeFileSync(`${base}.html`, planHtml(brand, plan, readStrategy(brand.id)))
  const chrome = CHROMES.find((p) => existsSync(p))
  if (!chrome) return { html: `${base}.html`, pdf: null }
  const profile = join(tmpdir(), `nexy-pdf-${process.pid}-${Date.now()}`)
  const r = await run(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`, '--no-pdf-header-footer', `--print-to-pdf=${base}.pdf`, `file://${base}.html`], { ms: 60_000 })
  rmSync(profile, { recursive: true, force: true })
  return { html: `${base}.html`, pdf: r.ok && existsSync(`${base}.pdf`) ? `${base}.pdf` : null }
}

// -- the tools ------------------------------------------------------------------------

const ok = (text) => ({ content: [{ type: 'text', text }] })
const refuse = (text) => ({ isError: true, content: [{ type: 'text', text }] })

const POST = z.object({
  id: z.string().optional().describe('P1, P2… (kept when changing a week).'),
  fecha: z.string().describe('YYYY-MM-DD, inside the week.'),
  hora: z.string().optional().describe('HH:MM, the brand\'s local time.'),
  redes: z.array(z.string()).describe(`Networks: ${NETWORKS.join(', ')}.`),
  formato: z.string().describe('Reel, carrusel, post, historia, video, live…'),
  pilar: z.string().describe('One of the strategy\'s pillars.'),
  tema: z.string().optional(),
  gancho: z.string().optional().describe('The first line or first 3 seconds.'),
  copy: z.string().optional().describe('The caption, finished.'),
  cta: z.string().optional(),
  hashtags: z.string().optional(),
  visual: z.string().optional().describe('What it looks like: shots, design, on-screen text, references.'),
  estado: z.enum(STATES).optional(),
  archivo: z.string().optional().describe('Path or link of the finished piece.'),
  metricool: z.string().optional().describe('The Metricool post id once scheduled.'),
  notas: z.string().optional(),
})

export function contentPlanServer() {
  const brandOf = (q) => findBrand(q)
  return createSdkMcpServer({
    name: 'jarvis_parrilla',
    version: '1.0.0',
    instructions: "Each brand's content strategy and weekly content calendar (parrilla), kept on this Mac, and drawn as a PDF.",
    tools: [
      tool('read_content_strategy', "A brand's content strategy: goals, audience, pillars and their share, networks and frequency, best times, KPIs and tone.", { marca: z.string() }, async ({ marca }) => {
        const b = brandOf(marca)
        if (!b) return refuse(`No brand "${marca}".`)
        const s = readStrategy(b.id)
        return ok(s ? JSON.stringify(s, null, 1) : `${b.nombre} has no content strategy yet: propose one (save_content_strategy) from its manual and what the owner says, and show it to him.`)
      }),
      tool(
        'save_content_strategy',
        "Save a brand's content strategy (replaces the one before). Only with what the owner agreed.",
        {
          marca: z.string(),
          objetivos: z.array(z.string()).describe('Business goals of the content (e.g. leads for private label cheese).'),
          publico: z.string().describe('Who it talks to.'),
          pilares: z.array(z.object({ nombre: z.string(), porcentaje: z.number().optional(), descripcion: z.string().optional() })),
          redes: z.array(z.object({ red: z.string(), frecuencia: z.string(), formatos: z.string().optional() })),
          horarios: z.string().optional().describe('Best times to post, per network.'),
          kpis: z.array(z.object({ nombre: z.string(), meta: z.string().optional() })).describe('What is measured each week and the target.'),
          tono: z.string().optional(),
          notas: z.string().optional(),
        },
        async ({ marca, ...s }) => {
          const b = brandOf(marca)
          if (!b) return refuse(`No brand "${marca}".`)
          saveStrategy(b.id, s)
          return ok(`Saved ${b.nombre}'s content strategy.`)
        },
      ),
      tool('list_content_plans', "The weeks a brand has a content calendar for, with how many posts and how far along.", { marca: z.string() }, async ({ marca }) => {
        const b = brandOf(marca)
        if (!b) return refuse(`No brand "${marca}".`)
        const weeks = listPlans(b.id)
        if (!weeks.length) return ok(`${b.nombre} has no weekly calendar yet. This week starts ${mondayOf()}.`)
        return ok(
          weeks
            .map((w) => {
              const p = readPlan(b.id, w)
              const st = (p?.publicaciones ?? []).reduce((m, x) => ((m[x.estado] = (m[x.estado] ?? 0) + 1), m), {})
              return `${w}: ${p?.publicaciones?.length ?? 0} posts (${Object.entries(st).map(([k, v]) => `${v} ${k}`).join(', ')})`
            })
            .join('\n') + `\n(This week starts ${mondayOf()}.)`,
        )
      }),
      tool(
        'read_content_plan',
        "A brand's calendar for one week, every post in full. semana: 'esta', 'proxima', 'pasada' or any date in the week.",
        { marca: z.string(), semana: z.string().optional() },
        async ({ marca, semana }) => {
          const b = brandOf(marca)
          if (!b) return refuse(`No brand "${marca}".`)
          const monday = weekOf(semana)
          if (!monday) return refuse('Give the week as esta, proxima, pasada or a date YYYY-MM-DD.')
          const p = readPlan(b.id, monday)
          return ok(p ? JSON.stringify(p, null, 1) : `${b.nombre} has no calendar for the week of ${monday} yet.`)
        },
      ),
      tool(
        'save_content_plan',
        "Save a brand's whole calendar for one week (replaces that week; the one before is kept). Every post with its date inside the week. Show it to the owner (export_content_plan) before producing.",
        { marca: z.string(), semana: z.string().describe("'esta', 'proxima' or a date in the week."), objetivo: z.string().optional(), publicaciones: z.array(POST) },
        async ({ marca, semana, objetivo, publicaciones }) => {
          const b = brandOf(marca)
          if (!b) return refuse(`No brand "${marca}".`)
          const monday = weekOf(semana)
          if (!monday) return refuse('Give the week as esta, proxima, pasada or a date YYYY-MM-DD.')
          const posts = []
          const errors = []
          publicaciones.forEach((p, i) => {
            const r = cleanPost(p, monday, i + 1)
            if (r.error) errors.push(r.error)
            else posts.push(r.post)
          })
          if (errors.length) return refuse(`Not saved:\n- ${errors.join('\n- ')}`)
          const ids = posts.map((p) => p.id)
          if (new Set(ids).size !== ids.length) posts.forEach((p, i) => (p.id = `P${i + 1}`))
          savePlan(b.id, { marca: b.id, semana: monday, objetivo: clip(objetivo, 500), publicaciones: sortPosts(posts) })
          return ok(`Saved ${b.nombre}'s calendar for the week of ${monday}: ${posts.length} posts.`)
        },
      ),
      tool(
        'update_content_post',
        "Change one post of a week's calendar: any field, or move it along (estado), or add the finished file or the Metricool id. Only the fields given change.",
        { marca: z.string(), semana: z.string(), id: z.string(), cambios: POST.partial() },
        async ({ marca, semana, id, cambios }) => {
          const b = brandOf(marca)
          if (!b) return refuse(`No brand "${marca}".`)
          const monday = weekOf(semana)
          const plan = monday && readPlan(b.id, monday)
          if (!plan) return refuse(`No calendar for that week.`)
          const i = plan.publicaciones.findIndex((p) => p.id.toLowerCase() === String(id).toLowerCase())
          if (i < 0) return refuse(`No post ${id} that week.`)
          const merged = { ...plan.publicaciones[i], ...Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined)), id: plan.publicaciones[i].id }
          let target = monday
          if (merged.fecha && mondayOf(merged.fecha) !== monday) target = mondayOf(merged.fecha)
          const r = cleanPost(merged, target, i + 1)
          if (r.error) return refuse(r.error)
          if (target === monday) {
            plan.publicaciones[i] = r.post
            savePlan(b.id, { ...plan, publicaciones: sortPosts(plan.publicaciones) })
            return ok(`${r.post.id} updated.`)
          }
          // Moved to another week.
          const other = readPlan(b.id, target) ?? { marca: b.id, semana: target, objetivo: '', publicaciones: [] }
          const used = new Set(other.publicaciones.map((p) => p.id))
          let n = other.publicaciones.length + 1
          while (used.has(`P${n}`)) n++
          other.publicaciones.push({ ...r.post, id: `P${n}` })
          plan.publicaciones.splice(i, 1)
          savePlan(b.id, plan)
          savePlan(b.id, { ...other, publicaciones: sortPosts(other.publicaciones) })
          return ok(`Moved to the week of ${target} as P${n}.`)
        },
      ),
      tool(
        'export_content_plan',
        "Draw a week's calendar as a PDF (and HTML) in ~/Documents/Nexy/parrillas: the week at a glance, the mix by network, format, pillar and progress, the pillars and KPIs, and every post in detail. Send it to the owner with send_file.",
        { marca: z.string(), semana: z.string().optional() },
        async ({ marca, semana }) => {
          const b = brandOf(marca)
          if (!b) return refuse(`No brand "${marca}".`)
          const monday = weekOf(semana)
          const plan = monday && readPlan(b.id, monday)
          if (!plan) return refuse(`No calendar for that week.`)
          const r = await exportPlan(b, plan)
          return ok(r.pdf ? `PDF: ${r.pdf}\nHTML: ${r.html}` : `Chrome is not on this Mac, so only the page: ${r.html}`)
        },
      ),
    ],
  })
}

/** For Nexy's prompt: how the content calendar works. */
export const CONTENT_PLAN_PROMPT = `

# Content calendar (parrilla)
Each brand has a content strategy and a weekly calendar (jarvis_parrilla). The work, week by week:
1. Strategy first: read_content_strategy. If there is none, propose one with the estratega (goals tied to the business, audience, 3–5 pillars with their share, networks and how often, best times, weekly KPIs) and save it when the owner agrees.
2. Plan the week: with the estratega, ganchos, guionista and captions agents, draft every post (date, time, networks, format, pillar, hook, finished copy, CTA, hashtags, visual brief), respecting the pillar mix and frequency. save_content_plan, then export_content_plan and send_file the PDF to the owner. Everything starts as "idea".
3. The owner changes what he wants (update_content_post) and approves: mark "aprobado".
4. Produce each post (Canva, Higgsfield, the video editor with the brand's molds): mark "en_produccion", then "listo" with archivo; show it to him.
5. Schedule it in Metricool (held for his tap, as always) and mark "programado" with the Metricool id; once it is out, "publicado".
6. Monday: read last week's results in Metricool against the KPIs and say in a few lines what worked, what did not and what changes this week.
Never schedule a post the owner has not approved.`
