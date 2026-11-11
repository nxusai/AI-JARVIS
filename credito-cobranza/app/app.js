// Crédito y Cobranza · portal (NXUS AI)
// Sesión con Supabase Auth; los datos sólo llegan si la base de datos reconoce
// al usuario como activo (candados RLS en supabase/01_esquema.sql).
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const CFG = window.APP_CONFIG || {}
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm'

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const NUM = new Intl.NumberFormat('es-MX')
const peso = (n) => MXN.format(Math.round(Number(n) || 0))
const pesoK = (n) => (n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + ' M' : n >= 1000 ? '$' + Math.round(n / 1000) + ' k' : '$' + Math.round(n))
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d) }
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0)
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const COL = { teal: '#2ee6cf', blue: '#6b97ff', violet: '#b294ff', amber: '#ffc857', rose: '#ff86a6', green: '#55e8a8', red: '#ff7272', ink2: '#d3dae7', grid: 'rgba(255,255,255,.09)' }
const ESTADOS = [
  { k: 'al_dia', n: 'Al día', c: COL.green, s: 'sin atraso', st: 'ok' },
  { k: 'atrasado', n: 'Atrasado', c: COL.amber, s: '1 a 7 días', st: 'wait' },
  { k: 'alto_riesgo', n: 'Alto riesgo', c: COL.rose, s: '8 a 30 días', st: 'mid' },
  { k: 'vencido', n: 'Vencido', c: COL.red, s: 'más de 30 días', st: 'bad' },
]
const ESTADO = Object.fromEntries([...ESTADOS, { k: 'liquidado', n: 'Liquidado', c: '#8892a6', s: 'pagado', st: 'off' }].map((e) => [e.k, e]))
const ROLES = {
  dueno: 'Dueño', direccion: 'Dirección', regional: 'Regional', zonal: 'Zonal', gerente: 'Gerente',
  asesor: 'Asesor / cobrador', mesa: 'Mesa de control', consulta: 'Consulta / auditoría', soporte: 'Soporte NXUS',
}
const ICON = {
  tablero: '<path d="M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z"/>',
  clientes: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  solicitudes: '<path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
  creditos: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
  cobranza: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  cajas: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  reportes: '<path d="M4 19V5M10 19V9M16 19v-7M22 19H2"/>',
  importar: '<path d="M12 3v12M8 11l4 4 4-4M4 21h16"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
}
const NAV = [
  ['h', 'Operación'], ['tablero', 'Tablero'], ['clientes', 'Clientes'], ['solicitudes', 'Solicitudes'], ['creditos', 'Créditos'],
  ['cobranza', 'Cobranza'], ['cajas', 'Cajas'], ['reportes', 'Reportes'], ['h', 'Sistema'], ['importar', 'Importar datos'], ['admin', 'Administración'],
]

let sb = null
let DB = null
let SCOPE = 'emp'
let VIEW = 'tablero'
let charts = []

// ============================================================ arranque
async function boot() {
  if (window.__FIXTURE__) { DB = prep(window.__FIXTURE__); return showApp() }
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) return showLogin('Falta conectar la base de datos. Configuración pendiente.', true)
  const recovery = /type=recovery/.test(location.hash)
  try {
    const { createClient } = await import(SUPABASE_JS)
    sb = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  } catch (e) {
    return showLogin('No se pudo cargar el módulo de acceso. Revisa tu conexión y recarga la página.', true)
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') showNewPass(); if (ev === 'SIGNED_OUT') showLogin() })
  const { data } = await sb.auth.getSession()
  if (recovery && data.session) return showNewPass()
  if (!data.session) return showLogin()
  await loadAndShow(data.session)
}

function showLogin(msg = '', bloquear = false) {
  $('#loading').hidden = true; $('#app').hidden = true; $('#login').hidden = false
  $('#loginForm').hidden = false; $('#newPassForm').hidden = true
  $('#loginErr').textContent = msg
  $('#btnLogin').disabled = bloquear
}
function showNewPass() {
  $('#loading').hidden = true; $('#app').hidden = true; $('#login').hidden = false
  $('#loginForm').hidden = true; $('#newPassForm').hidden = false
}

$('#fLogin').addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = $('#email').value.trim(), password = $('#pass').value
  const err = $('#loginErr'); err.textContent = ''
  if (!email || !password) { err.textContent = 'Escribe tu correo y tu contraseña.'; return }
  const b = $('#btnLogin'); b.disabled = true; b.textContent = 'Entrando…'
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  b.disabled = false; b.textContent = 'Entrar'
  if (error) {
    err.textContent = /invalid login/i.test(error.message) ? 'Correo o contraseña incorrectos.'
      : /rate|too many/i.test(error.message) ? 'Demasiados intentos. Espera un minuto y vuelve a intentar.'
      : 'No se pudo iniciar sesión. Intenta de nuevo.'
    return
  }
  $('#pass').value = ''
  await loadAndShow(data.session)
})
$('#btnOlvide').addEventListener('click', async () => {
  const email = $('#email').value.trim(), err = $('#loginErr')
  if (!sb) return
  if (!email) { err.textContent = 'Escribe tu correo arriba y vuelve a dar clic en «Olvidé mi contraseña».'; return }
  await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' })
  err.textContent = 'Si el correo está registrado, te llegará un enlace para crear una nueva contraseña.'
})
$('#fNewPass').addEventListener('submit', async (e) => {
  e.preventDefault()
  const p = $('#pass2').value, err = $('#newPassErr')
  if (p.length < 10) { err.textContent = 'Usa al menos 10 caracteres.'; return }
  const { error } = await sb.auth.updateUser({ password: p })
  if (error) { err.textContent = 'No se pudo guardar. Pide un enlace nuevo.'; return }
  history.replaceState(null, '', location.pathname)
  const { data } = await sb.auth.getSession()
  await loadAndShow(data.session)
})
$('#btnSalir').addEventListener('click', async () => { if (sb) await sb.auth.signOut(); else location.reload() })

async function fetchAll(table, build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb.from(table).select('*')).range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) return out
  }
}

async function loadAndShow(session) {
  $('#login').hidden = true; $('#loading').hidden = false; $('#loading').textContent = 'Cargando información…'
  try {
    const { data: perfil, error: pe } = await sb.from('perfiles').select('*').eq('id', session.user.id).maybeSingle()
    if (pe) throw pe
    if (!perfil || !perfil.activo) {
      await sb.auth.signOut()
      return showLogin('Tu cuenta todavía no está activa. Pide al administrador que la active.')
    }
    const desde = addDays(iso(new Date()), -400)
    const [rutas, cartera, recaudo, solicitudes] = await Promise.all([
      fetchAll('v_rutas', (q) => q.order('ruta_id')),
      fetchAll('v_cartera', (q) => q.order('credito_id')),
      fetchAll('v_recaudo_diario', (q) => q.gte('fecha', desde).order('fecha')),
      fetchAll('solicitudes', (q) => q.order('id')),
    ])
    DB = prep({ rutas, cartera, recaudo, solicitudes, perfil: { ...perfil, correo: session.user.email } })
    showApp()
  } catch (e) {
    console.error(e)
    showLogin('No se pudo cargar la información. Recarga la página; si sigue pasando, avisa a soporte.')
  }
}

// ============================================================ datos
function prep(raw) {
  const rutas = raw.rutas || []
  const R = Object.fromEntries(rutas.map((r) => [r.ruta_id, r]))
  const cartera = (raw.cartera || []).map((c) => ({ ...c, monto: +c.monto, saldo: +c.saldo, cuota: +c.cuota, total_pagar: +c.total_pagar }))
  const recaudo = (raw.recaudo || []).map((p) => ({ ...p, monto: +p.monto, ...(R[p.ruta_id] || {}) }))
  const solicitudes = (raw.solicitudes || []).map((s) => ({ ...s, monto: +s.monto, ...(R[s.ruta_id] || {}) }))
  const uniq = (key, name, extra = () => ({})) => {
    const m = new Map(); rutas.forEach((r) => { if (!m.has(r[key])) m.set(r[key], { id: r[key], nombre: r[name], ...extra(r) }) }); return [...m.values()]
  }
  return {
    rutas, R, cartera, recaudo, solicitudes, perfil: raw.perfil || {},
    hoy: iso(new Date()),
    demo: cartera.some((c) => c.es_demo) || solicitudes.some((s) => s.es_demo),
    zonas: uniq('zona_id', 'zona', (r) => ({ resp: r.zonal })),
    gerencias: uniq('gerencia_id', 'gerencia', (r) => ({ resp: r.gerente, zona_id: r.zona_id })),
    oficinas: uniq('oficina_id', 'oficina', (r) => ({ gerencia_id: r.gerencia_id })),
  }
}
function inScope(row) {
  if (SCOPE === 'emp') return true
  const [nivel, id] = SCOPE.split(':')
  return String(row[nivel + '_id']) === id
}
const sc = {
  cartera: () => DB.cartera.filter(inScope),
  activos: () => DB.cartera.filter((c) => c.saldo > 0 && inScope(c)),
  recaudo: () => DB.recaudo.filter(inScope),
  rutas: () => DB.rutas.filter(inScope),
  solicitudes: () => DB.solicitudes.filter(inScope),
}
function scopeLabel() {
  if (SCOPE === 'emp') return 'toda la empresa'
  const [nivel, id] = SCOPE.split(':')
  const r = DB.rutas.find((x) => String(x[nivel + '_id']) === id)
  const name = { zona: r?.zona, gerencia: r?.gerencia, oficina: 'oficina ' + r?.oficina, ruta: 'ruta ' + r?.ruta }[nivel]
  return name || 'toda la empresa'
}
function porDia(rows, fechaKey, valKey, desde, hasta) {
  const m = new Map()
  rows.forEach((r) => { const f = r[fechaKey]; if (f >= desde && f <= hasta) m.set(f, (m.get(f) || 0) + (Number(r[valKey]) || 0)) })
  return m
}
function estadoDeDias(d) { return d <= 0 ? 'al_dia' : d <= 7 ? 'atrasado' : d <= 30 ? 'alto_riesgo' : 'vencido' }
function porCliente(rows) {
  const m = new Map()
  rows.forEach((c) => {
    let x = m.get(c.cliente_id)
    if (!x) { x = { ...c, creditos: 0, activos: 0, saldo: 0, prestado: 0, dias: 0 }; m.set(c.cliente_id, x) }
    x.creditos++; x.prestado += c.monto
    if (c.saldo > 0) { x.activos++; x.saldo += c.saldo; x.dias = Math.max(x.dias, c.dias_atraso) }
  })
  return [...m.values()].map((x) => ({ ...x, estado: x.saldo > 0 ? estadoDeDias(x.dias) : 'liquidado' }))
}
function agrupa(rows, key, label, extra = () => ({})) {
  const m = new Map()
  rows.forEach((c) => {
    let x = m.get(c[key])
    if (!x) { x = { id: c[key], nombre: c[label], ...extra(c), clientes: new Set(), creditos: 0, saldo: 0, al_dia: 0, atrasado: 0, alto_riesgo: 0, vencido: 0, prestado: 0 }; m.set(c[key], x) }
    if (c.saldo > 0) { x.clientes.add(c.cliente_id); x.creditos++; x.saldo += c.saldo; x[c.estado] += c.saldo; x.prestado += c.monto }
  })
  return [...m.values()].map((x) => ({ ...x, clientes: x.clientes.size, atraso: x.atrasado + x.alto_riesgo + x.vencido }))
}

// ============================================================ app shell
function showApp() {
  $('#loading').hidden = true; $('#login').hidden = true; $('#app').hidden = false
  const p = DB.perfil
  const nombre = p.nombre || (p.correo || '').split('@')[0] || 'Usuario'
  $('#meNombre').textContent = nombre
  $('#meRol').textContent = ROLES[p.rol] || p.rol || ''
  $('#meAv').textContent = nombre.trim().slice(0, 1).toUpperCase()
  $('#bannerTxt').innerHTML = DB.demo
    ? '<b>DATOS DE EJEMPLO</b> — nombres y deudas inventados para mostrar el avance; se borrarán antes de cargar la información real.'
    : `Información al ${new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`
  const nRev = DB.solicitudes.filter((s) => s.estado === 'revision').length
  $('#nav').innerHTML = NAV.map(([k, t]) => k === 'h' ? `<div class="nav-h">${t}</div>`
    : `<a data-view="${k}" class="${k === VIEW ? 'on' : ''}"><svg class="ic" viewBox="0 0 24 24">${ICON[k]}</svg>${t}${k === 'solicitudes' && nRev ? `<span class="tag">${nRev}</span>` : ''}</a>`).join('')
  $$('#nav a').forEach((a) => a.addEventListener('click', () => go(a.dataset.view)))
  go(VIEW, false)
}
function reveal() {
  if (reduceMotion) return
  const app = $('#app'); app.classList.add('reveal'); clearTimeout(reveal.t); reveal.t = setTimeout(() => app.classList.remove('reveal'), 210)
}
function go(view, animate = true) {
  VIEW = view
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.view === view))
  $('#side').classList.remove('open'); $('#scrim').classList.remove('on')
  if (animate) reveal()
  render()
}
function render() {
  charts.forEach((c) => { try { c.destroy() } catch {} }); charts = []
  const v = VIEWS[VIEW] || VIEWS.tablero
  $('#view').innerHTML = `<div class="wrap">${v.html()}</div>`
  bindScope()
  v.init?.()
  $('#main').scrollTop = 0
}
$('#menuBtn').addEventListener('click', () => { $('#side').classList.add('open'); $('#scrim').classList.add('on') })
$('#scrim').addEventListener('click', () => { $('#side').classList.remove('open'); $('#scrim').classList.remove('on') })

function scopeField() {
  const o = (v, t) => `<option value="${v}"${SCOPE === v ? ' selected' : ''}>${esc(t)}</option>`
  return `<div class="field sel"><label for="scope">Ámbito</label><select class="ctl" id="scope">
    ${o('emp', 'Toda la empresa')}
    <optgroup label="Zonas">${DB.zonas.map((z) => o('zona:' + z.id, z.nombre)).join('')}</optgroup>
    <optgroup label="Gerencias">${DB.gerencias.map((g) => o('gerencia:' + g.id, g.nombre)).join('')}</optgroup>
    <optgroup label="Oficinas">${DB.oficinas.map((x) => o('oficina:' + x.id, x.nombre)).join('')}</optgroup>
    <optgroup label="Rutas">${DB.rutas.map((r) => o('ruta:' + r.ruta_id, `${r.ruta} · ${r.asesor || ''}`)).join('')}</optgroup>
  </select></div>`
}
function bindScope() {
  const s = $('#scope'); if (!s) return
  s.addEventListener('change', () => { SCOPE = s.value; reveal(); render() })
}
function head(title, desc, extra = '') {
  return `<div class="page-head"><div><h1>${title}</h1><p>${desc}</p></div><div class="toolbar">${extra}${scopeField()}</div></div>`
}
function chart(el, cfg) { if (!window.Chart || !el) return; const c = new Chart(el, cfg); charts.push(c); return c }
function estadoChip(k) { const e = ESTADO[k] || ESTADO.al_dia; return `<span class="st ${e.st}">${e.n}</span>` }

// ============================================================ vistas
const VIEWS = {}

VIEWS.tablero = {
  periodo: 'sem',
  html() {
    const h = new Date().getHours()
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
    const nombre = (DB.perfil.nombre || '').split(' ')[0]
    return `<div class="top">
        <div class="hello"><h1>${saludo}${nombre ? ', ' + esc(nombre) : ''}</h1><p>Así va la cartera de ${esc(scopeLabel())} hoy.</p></div>
        <div class="toolbar">${scopeField()}
          <div class="seg" id="period">${[['sem', 'Semana'], ['mes', 'Mes'], ['anio', 'Año']].map(([k, t]) => `<button type="button" data-p="${k}" class="${this.periodo === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        </div>
      </div>
      <section class="kpis" id="kpis"></section>
      <div class="grid2">
        <div class="card panel">
          <div class="ph"><div><h3>Cartera por estado</h3><div class="sub">Saldo pendiente en pesos · ${esc(scopeLabel())}</div></div><span class="chip" id="cliDeuda"></span></div>
          <div class="donut-wrap"><div class="chart-box" style="height:190px;width:190px"><canvas id="donut"></canvas><div class="donut-center"><div><b id="donutTot"></b><span>cartera activa</span></div></div></div><div class="legend" id="legend"></div></div>
          <div class="note">Estados provisionales: al día · 1–7 días · 8–30 días · más de 30 días. Se ajustan cuando el cliente confirme sus rangos.</div>
        </div>
        <div class="card panel"><div class="ph"><div><h3>Cobranza del día</h3><div class="sub">Cobrado hoy vs promedio diario de las últimas 2 semanas</div></div></div><div class="list" id="cobranza"></div></div>
      </div>
      <div class="grid3">
        <div class="card panel span2"><div class="ph"><div><h3>Recaudo vs colocación</h3><div class="sub" id="trendSub"></div></div></div><div class="chart-box" style="height:250px"><canvas id="trend"></canvas></div></div>
        <div class="card panel"><div class="ph"><div><h3>Cajas por gerente</h3><div class="sub">Cobranza recibida hoy</div></div></div><div class="list" id="cajas"></div>
          <div class="auto"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> Traslado automático a las 18:00 · con bitácora</div></div>
      </div>`
  },
  init() {
    const hoy = DB.hoy, act = sc.activos(), car = sc.cartera(), rec = sc.recaudo()
    const total = sum(act, (c) => c.saldo)
    const atraso = sum(act.filter((c) => c.dias_atraso > 0), (c) => c.saldo)
    const recHoy = sum(rec.filter((r) => r.fecha === hoy), (r) => r.monto)
    const mes = hoy.slice(0, 8) + '01'
    const colMes = sum(car.filter((c) => c.fecha_inicio >= mes), (c) => c.monto)
    const d14 = Array.from({ length: 14 }, (_, i) => addDays(hoy, i - 13))
    const recD = porDia(rec, 'fecha', 'monto', d14[0], hoy), colD = porDia(car, 'fecha_inicio', 'monto', d14[0], hoy)
    const recPrev = sum(rec.filter((r) => r.fecha >= addDays(hoy, -14) && r.fecha < hoy), (r) => r.monto) / 14
    const porEstado = Object.fromEntries(ESTADOS.map((e) => [e.k, sum(act.filter((c) => c.estado === e.k), (c) => c.saldo)]))
    const meter = (parts) => `<div class="meter">${parts.map(([v, c]) => `<i style="width:${v}%;background:${c}"></i>`).join('')}</div>`
    const K = [
      { lab: 'Cartera total', val: peso(total), meta: `${NUM.format(act.length)} créditos activos`, grad: [COL.teal, COL.blue], ico: '<path d="M3 6h18v12H3z"/><path d="M3 10h18"/>',
        extra: meter(ESTADOS.map((e) => [pct(porEstado[e.k], total), e.c])) },
      { lab: 'Cartera con atraso', val: peso(atraso), meta: `${pct(atraso, total)}% de la cartera`, grad: [COL.rose, COL.red], ico: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>',
        chip: `<span class="chip ${pct(atraso, total) > 25 ? 'r' : 'a'}">${pct(atraso, total)}%</span>`, extra: meter([[pct(atraso, total), COL.rose]]) },
      { lab: 'Recaudo del día', val: peso(recHoy), meta: `promedio diario ${peso(recPrev)}`, grad: [COL.blue, COL.violet], ico: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
        chip: recPrev ? `<span class="chip ${recHoy >= recPrev ? 'g' : 'a'}">${recHoy >= recPrev ? '▲' : '▼'} ${Math.abs(pct(recHoy - recPrev, recPrev))}%</span>` : '', spark: d14.map((d) => recD.get(d) || 0), sc: COL.blue },
      { lab: 'Colocación del mes', val: peso(colMes), meta: `${NUM.format(car.filter((c) => c.fecha_inicio >= mes).length)} créditos nuevos`, grad: [COL.violet, COL.teal], ico: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
        spark: d14.map((d) => colD.get(d) || 0), sc: COL.violet },
    ]
    $('#kpis').innerHTML = K.map((k, i) => `<div class="card kpi lift">
      <div class="row1"><div class="ico" style="background:linear-gradient(135deg,${k.grad[0]},${k.grad[1]})"><svg viewBox="0 0 24 24">${k.ico}</svg></div>${k.chip || ''}</div>
      <div><div class="lab">${k.lab}</div><div class="val">${k.val}</div><div class="meta">${k.meta}</div></div>
      ${k.spark ? `<div class="spark"><canvas id="sp${i}"></canvas></div>` : k.extra}</div>`).join('')
    K.forEach((k, i) => k.spark && chart($('#sp' + i), {
      type: 'line', data: { labels: k.spark.map((_, j) => j), datasets: [{ data: k.spark, borderColor: k.sc, borderWidth: 2, tension: 0.4, pointRadius: 0, fill: true,
        backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 40); g.addColorStop(0, k.sc + '66'); g.addColorStop(1, k.sc + '00'); return g } }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } },
    }))

    const cli = new Set(act.map((c) => c.cliente_id)).size
    $('#cliDeuda').textContent = `${NUM.format(cli)} clientes con deuda`
    $('#donutTot').textContent = pesoK(total)
    $('#legend').innerHTML = ESTADOS.map((e) => {
      const n = new Set(act.filter((c) => c.estado === e.k).map((c) => c.cliente_id)).size
      return `<div class="li"><span class="dot" style="background:${e.c};color:${e.c}"></span><span>${e.n}</span><span class="amt">${peso(porEstado[e.k])}</span><small>${e.s} · ${n} clientes · ${pct(porEstado[e.k], total)}%</small></div>`
    }).join('')
    chart($('#donut'), {
      type: 'doughnut',
      data: { labels: ESTADOS.map((e) => e.n), datasets: [{ data: total ? ESTADOS.map((e) => porEstado[e.k]) : [1], backgroundColor: total ? ESTADOS.map((e) => e.c) : ['rgba(255,255,255,.08)'], borderWidth: 0, cutout: '74%', hoverOffset: 6, spacing: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: !!total, callbacks: { label: (c) => ' ' + peso(c.raw) } } } },
    })

    const rutas = sc.rutas().map((r) => {
      const hoyR = sum(rec.filter((x) => x.ruta_id === r.ruta_id && x.fecha === hoy), (x) => x.monto)
      const prom = sum(rec.filter((x) => x.ruta_id === r.ruta_id && x.fecha >= addDays(hoy, -14) && x.fecha < hoy), (x) => x.monto) / 14
      return { ...r, hoyR, prom, p: pct(hoyR, prom) }
    }).sort((a, b) => b.prom - a.prom).slice(0, 4)
    $('#cobranza').innerHTML = rutas.length ? rutas.map((r) => `<div class="rowitem inset"><div><div class="t">${esc(r.ruta)}</div><div class="s">${esc(r.asesor || '')}</div></div>
      <div class="m">${peso(r.hoyR)}<small>de ${peso(r.prom)} · ${r.p}%</small></div><div class="bar ${r.p < 60 ? 'warn' : ''}"><i style="width:${Math.min(100, r.p)}%"></i></div></div>`).join('')
      : '<div class="empty"><b>Sin rutas en este ámbito</b></div>'

    const ger = DB.gerencias.filter((g) => sc.rutas().some((r) => r.gerencia_id === g.id))
    const cerrada = new Date().getHours() >= 18
    $('#cajas').innerHTML = ger.map((g) => {
      const m = sum(rec.filter((x) => x.gerencia_id === g.id && x.fecha === hoy), (x) => x.monto)
      return `<div class="rowitem inset"><div><div class="t">${esc(g.resp || g.nombre)}</div><div class="s">${esc(g.nombre)}</div></div><div class="m">${peso(m)}<small><span class="st ${cerrada ? 'ok' : 'wait'}">${cerrada ? 'Recibido 18:00' : 'Cierre 18:00'}</span></small></div></div>`
    }).join('')
    this.trend()
    $$('#period button').forEach((b) => b.addEventListener('click', () => { this.periodo = b.dataset.p; $$('#period button').forEach((x) => x.classList.toggle('on', x === b)); reveal(); this.trend() }))
  },
  trend() {
    const hoy = DB.hoy, rec = sc.recaudo(), car = sc.cartera()
    let labels = [], R = [], Cc = [], sub = ''
    if (this.periodo === 'anio') {
      const meses = Array.from({ length: 12 }, (_, i) => { const d = new Date(hoy + 'T12:00:00'); d.setDate(1); d.setMonth(d.getMonth() - (11 - i)); return iso(d).slice(0, 7) })
      labels = meses.map((m) => new Date(m + '-15T12:00:00').toLocaleDateString('es-MX', { month: 'short' }))
      R = meses.map((m) => sum(rec.filter((r) => r.fecha.startsWith(m)), (r) => r.monto))
      Cc = meses.map((m) => sum(car.filter((c) => c.fecha_inicio.startsWith(m)), (c) => c.monto)); sub = 'Últimos 12 meses'
    } else {
      const n = this.periodo === 'mes' ? 30 : 7
      const dias = Array.from({ length: n }, (_, i) => addDays(hoy, i - (n - 1)))
      const rd = porDia(rec, 'fecha', 'monto', dias[0], hoy), cd = porDia(car, 'fecha_inicio', 'monto', dias[0], hoy)
      labels = dias.map((d) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', n === 7 ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' }))
      R = dias.map((d) => rd.get(d) || 0); Cc = dias.map((d) => cd.get(d) || 0); sub = n === 7 ? 'Últimos 7 días' : 'Últimos 30 días'
    }
    $('#trendSub').textContent = `${sub} · recaudo ${peso(sum(R, (x) => x))} · colocación ${peso(sum(Cc, (x) => x))}`
    const grad = (ctx, c) => { const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 250); g.addColorStop(0, c + '70'); g.addColorStop(1, c + '05'); return g }
    const old = charts.find((c) => c.canvas?.id === 'trend'); if (old) { old.destroy(); charts = charts.filter((c) => c !== old) }
    chart($('#trend'), {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Recaudo', data: R, borderColor: COL.teal, borderWidth: 2.6, tension: 0.38, pointRadius: 0, pointHoverRadius: 5, fill: true, backgroundColor: (c) => grad(c, COL.teal) },
        { label: 'Colocación', data: Cc, borderColor: COL.violet, borderWidth: 2.6, tension: 0.38, pointRadius: 0, pointHoverRadius: 5, fill: true, backgroundColor: (c) => grad(c, COL.violet) },
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: COL.ink2, usePointStyle: true, pointStyleWidth: 9, boxHeight: 7, font: { weight: 600 } } }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${peso(c.raw)}` } } },
        scales: { x: { grid: { color: COL.grid }, ticks: { color: COL.ink2, maxRotation: 0, autoSkipPadding: 14 } }, y: { grid: { color: COL.grid }, ticks: { color: COL.ink2, callback: (v) => pesoK(v) }, beginAtZero: true } } },
    })
  },
}

VIEWS.clientes = {
  q: '',
  html() {
    return `${head('Clientes', 'Un expediente por cliente con sus créditos, saldo y estado. Busca antes de registrar para evitar duplicados.')}
      <div class="card panel">
        <div class="ph"><input class="ctl" id="q" placeholder="Buscar por nombre, código, colonia o asesor…" value="${esc(this.q)}" style="flex:1;min-width:220px"><span class="chip" id="cnt"></span></div>
        <div class="tablewrap"><table class="tbl"><thead><tr><th>Código</th><th>Cliente</th><th>Ruta / asesor</th><th>Gerencia</th><th>Zona</th><th class="num">Créditos</th><th class="num">Saldo</th><th class="num">Días de atraso</th><th>Estado</th></tr></thead><tbody id="tb"></tbody></table></div>
        <div class="note">Toca un cliente para ver sus créditos.</div>
      </div>`
  },
  init() {
    const all = porCliente(sc.cartera()).sort((a, b) => b.saldo - a.saldo)
    const paint = () => {
      const q = norm(this.q)
      const rows = q ? all.filter((c) => norm(`${c.cliente} ${c.codigo} ${c.colonia} ${c.asesor} ${c.ruta}`).includes(q)) : all
      $('#cnt').textContent = `${NUM.format(rows.length)} clientes`
      $('#tb').innerHTML = rows.slice(0, 200).map((c) => `<tr class="click" data-id="${c.cliente_id}"><td class="muted">${esc(c.codigo)}</td><td class="strong">${esc(c.cliente)}</td>
        <td>${esc(c.ruta)}<div class="muted" style="font-size:12px">${esc(c.asesor || '')}</div></td><td>${esc(c.gerencia)}</td><td>${esc(c.zona)}</td>
        <td class="num">${c.activos}/${c.creditos}</td><td class="num strong">${peso(c.saldo)}</td><td class="num">${c.saldo > 0 ? c.dias : '—'}</td><td>${estadoChip(c.estado)}</td></tr>`).join('')
        || '<tr><td colspan="9"><div class="empty"><b>Sin resultados</b>Prueba con otro nombre o código.</div></td></tr>'
      $$('#tb tr.click').forEach((tr) => tr.addEventListener('click', () => fichaCliente(+tr.dataset.id)))
    }
    paint()
    $('#q').addEventListener('input', (e) => { this.q = e.target.value; paint() })
  },
}
function fichaCliente(id) {
  const cr = DB.cartera.filter((c) => c.cliente_id === id).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
  if (!cr.length) return
  const c = cr[0]
  modal(`<div class="ph"><div><h3 style="font-size:20px">${esc(c.cliente)}</h3><div class="sub">${esc(c.codigo)} · ${esc(c.colonia || '')} · ${esc(c.ruta)} (${esc(c.asesor || '')}) · ${esc(c.gerencia)} · ${esc(c.zona)}</div></div><button class="x" data-close aria-label="Cerrar">×</button></div>
    <div class="statrow">${[['Saldo total', peso(sum(cr, (x) => x.saldo))], ['Prestado', peso(sum(cr, (x) => x.monto))], ['Créditos', cr.length], ['Atraso máx.', Math.max(...cr.map((x) => x.dias_atraso)) + ' días']].map(([l, v]) => `<div class="card"><div class="lab">${l}</div><div class="val">${v}</div></div>`).join('')}</div>
    <div class="tablewrap"><table class="tbl"><thead><tr><th>Crédito</th><th>Inicio</th><th class="num">Monto</th><th class="num">Cuota</th><th>Frecuencia</th><th class="num">Pagadas</th><th class="num">Saldo</th><th>Estado</th></tr></thead><tbody>
    ${cr.map((x) => `<tr><td>#${x.credito_id}</td><td>${x.fecha_inicio}</td><td class="num">${peso(x.monto)}</td><td class="num">${peso(x.cuota)}</td><td>${x.frecuencia}</td><td class="num">${x.cuotas_pagadas}/${x.num_cuotas}</td><td class="num strong">${peso(x.saldo)}</td><td>${estadoChip(x.estado)}</td></tr>`).join('')}
    </tbody></table></div>`)
}
function modal(inner) {
  const host = $('#modalHost')
  host.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="card">${inner}</div></div>`
  const close = () => { host.innerHTML = ''; document.removeEventListener('keydown', onKey) }
  const onKey = (e) => { if (e.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)
  $('.modal', host).addEventListener('click', (e) => { if (e.target.classList.contains('modal') || e.target.closest('[data-close]')) close() })
}

VIEWS.solicitudes = {
  html() {
    const cols = [['borrador', 'Borrador', 'Capturada por el asesor'], ['revision', 'En revisión', 'Mesa de control revisa documentos'], ['observada', 'Observada', 'Regresa al asesor'], ['aprobada', 'Aprobada', 'Lista para desembolsar'], ['rechazada', 'Rechazada', 'Con motivo y bitácora']]
    const S = sc.solicitudes()
    return `${head('Solicitudes', 'Cada crédito registrado pasa a mesa de control dentro del mismo sistema: revisión humana que aprueba, rechaza o devuelve.')}
      <div class="note-card"><b>Mesa de control integrada.</b> Reemplaza el sistema externo que hoy se usa para validar documentos.</div>
      <div class="pipe">${cols.map(([k, t, d]) => { const L = S.filter((s) => s.estado === k); return `<div class="card col"><div class="ch"><h4>${t}</h4><span class="cnt">${L.length}</span></div>
        ${L.map((s) => `<div class="sol inset"><b>${esc(s.cliente_nombre)}</b><span>${peso(s.monto)} · ${esc(s.ruta || '')}</span><span class="muted">${esc(s.asesor || '')}</span></div>`).join('') || `<div class="note">${d}</div>`}</div>` }).join('')}</div>`
  },
}

VIEWS.creditos = {
  filtro: 'todos',
  html() {
    const act = sc.activos(), car = sc.cartera(), mes = DB.hoy.slice(0, 8) + '01'
    return `${head('Créditos', 'Cartera con condiciones, calendario de pagos y estado de atraso.')}
      <div class="statrow">${[['Créditos activos', NUM.format(act.length)], ['Colocado este mes', peso(sum(car.filter((c) => c.fecha_inicio >= mes), (c) => c.monto))], ['Saldo por cobrar', peso(sum(act, (c) => c.saldo))], ['Liquidados', NUM.format(car.length - act.length)]]
        .map(([l, v]) => `<div class="card lift"><div class="lab">${l}</div><div class="val">${v}</div></div>`).join('')}</div>
      <div class="card panel">
        <div class="ph"><div class="tabs" id="fil">${[['todos', 'Todos'], ...ESTADOS.map((e) => [e.k, e.n]), ['liquidado', 'Liquidados']].map(([k, t]) => `<button type="button" data-f="${k}" class="${this.filtro === k ? 'on' : ''}">${t}</button>`).join('')}</div><span class="chip" id="cnt"></span></div>
        <div class="tablewrap"><table class="tbl"><thead><tr><th>Crédito</th><th>Cliente</th><th>Ruta</th><th>Inicio</th><th class="num">Monto</th><th class="num">Cuota</th><th>Frecuencia</th><th class="num">Pagadas</th><th class="num">Saldo</th><th class="num">Atraso</th><th>Estado</th></tr></thead><tbody id="tb"></tbody></table></div>
        <div class="note">Cálculo de interés provisional (40 % y 10 cuotas) mientras el cliente confirma sus reglas.</div>
      </div>`
  },
  init() {
    const paint = () => {
      const rows = sc.cartera().filter((c) => this.filtro === 'todos' || c.estado === this.filtro).sort((a, b) => b.dias_atraso - a.dias_atraso || b.saldo - a.saldo)
      $('#cnt').textContent = `${NUM.format(rows.length)} créditos`
      $('#tb').innerHTML = rows.slice(0, 250).map((c) => `<tr class="click" data-id="${c.cliente_id}"><td class="muted">#${c.credito_id}</td><td class="strong">${esc(c.cliente)}</td><td>${esc(c.ruta)}</td><td>${c.fecha_inicio}</td><td class="num">${peso(c.monto)}</td><td class="num">${peso(c.cuota)}</td><td>${c.frecuencia}</td><td class="num">${c.cuotas_pagadas}/${c.num_cuotas}</td><td class="num strong">${peso(c.saldo)}</td><td class="num">${c.saldo > 0 ? c.dias_atraso + ' d' : '—'}</td><td>${estadoChip(c.estado)}</td></tr>`).join('')
        || '<tr><td colspan="11"><div class="empty"><b>Sin créditos en este filtro</b></div></td></tr>'
      $$('#tb tr.click').forEach((tr) => tr.addEventListener('click', () => fichaCliente(+tr.dataset.id)))
    }
    paint()
    $$('#fil button').forEach((b) => b.addEventListener('click', () => { this.filtro = b.dataset.f; $$('#fil button').forEach((x) => x.classList.toggle('on', x === b)); paint() }))
  },
}

VIEWS.cobranza = {
  html() {
    const hoy = DB.hoy, rec = sc.recaudo(), act = sc.activos()
    const recHoy = rec.filter((r) => r.fecha === hoy)
    const prom = sum(rec.filter((r) => r.fecha >= addDays(hoy, -14) && r.fecha < hoy), (r) => r.monto) / 14
    const rows = sc.rutas().map((r) => {
      const hoyR = recHoy.filter((x) => x.ruta_id === r.ruta_id)
      const p = sum(rec.filter((x) => x.ruta_id === r.ruta_id && x.fecha >= addDays(hoy, -14) && x.fecha < hoy), (x) => x.monto) / 14
      const at = act.filter((c) => c.ruta_id === r.ruta_id && c.dias_atraso > 0)
      return { ...r, cobrado: sum(hoyR, (x) => x.monto), pagos: sum(hoyR, (x) => x.pagos), prom: p, atN: new Set(at.map((c) => c.cliente_id)).size, atS: sum(at, (c) => c.saldo) }
    })
    const tot = sum(rows, (r) => r.cobrado)
    return `${head('Cobranza', 'Cobro en efectivo por ruta: lo cobrado hoy, el ritmo normal de cada ruta y quién trae atraso.')}
      <div class="statrow">${[['Cobrado hoy', peso(tot)], ['Pagos registrados hoy', NUM.format(sum(rows, (r) => r.pagos))], ['Promedio diario', peso(prom)], ['Avance vs promedio', pct(tot, prom) + '%']]
        .map(([l, v]) => `<div class="card lift"><div class="lab">${l}</div><div class="val">${v}</div></div>`).join('')}</div>
      <div class="card panel"><div class="ph"><h3>Por ruta</h3></div>
        <div class="tablewrap"><table class="tbl"><thead><tr><th>Ruta</th><th>Asesor</th><th>Oficina</th><th class="num">Cobrado hoy</th><th class="num">Pagos</th><th class="num">Promedio diario</th><th class="num">Avance</th><th class="num">Clientes con atraso</th><th class="num">Saldo en atraso</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="strong">${esc(r.ruta)}</td><td>${esc(r.asesor || '')}</td><td>${esc(r.oficina)}</td><td class="num strong">${peso(r.cobrado)}</td><td class="num">${r.pagos}</td><td class="num">${peso(r.prom)}</td><td class="num"><span class="st ${pct(r.cobrado, r.prom) >= 80 ? 'ok' : pct(r.cobrado, r.prom) >= 40 ? 'wait' : 'bad'}">${pct(r.cobrado, r.prom)}%</span></td><td class="num">${r.atN}</td><td class="num">${peso(r.atS)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="3">Total</td><td class="num">${peso(tot)}</td><td class="num">${sum(rows, (r) => r.pagos)}</td><td class="num">${peso(prom)}</td><td class="num">${pct(tot, prom)}%</td><td class="num">${sum(rows, (r) => r.atN)}</td><td class="num">${peso(sum(rows, (r) => r.atS))}</td></tr></tfoot></table></div>
        <div class="note">Hoy los pagos son sólo en efectivo. El registro desde celular con recibo llega en la siguiente etapa.</div></div>`
  },
}

VIEWS.cajas = {
  html() {
    const hoy = DB.hoy, rec = sc.recaudo(), cerrada = new Date().getHours() >= 18
    const ger = DB.gerencias.filter((g) => sc.rutas().some((r) => r.gerencia_id === g.id))
    return `${head('Cajas', 'La cobranza del día pasa de la caja de cada asesor a la de su gerente, automáticamente a las 18:00 y con bitácora.')}
      <div class="card panel"><h3 class="sec-title">Flujo del efectivo</h3>
        <div class="flow"><div class="node inset"><b>Asesor cobra en ruta</b><span>entra a su caja</span></div><div class="arr">→</div><div class="node inset"><b>Cierre 18:00</b><span>traslado automático</span></div><div class="arr">→</div><div class="node inset"><b>Caja del gerente</b><span>recibe y resguarda</span></div><div class="arr">→</div><div class="node inset"><b>Redistribución</b><span>reparte para colocar</span></div></div>
        <div class="note-card"><b>Regla:</b> la suma de las cajas no cambia con un traslado y un cierre que se ejecute dos veces genera un solo traslado. Toda diferencia queda visible.</div></div>
      <div class="grid3">${ger.map((g) => {
        const rg = sc.rutas().filter((r) => r.gerencia_id === g.id)
        const m = sum(rec.filter((x) => x.gerencia_id === g.id && x.fecha === hoy), (x) => x.monto)
        return `<div class="card panel lift"><div class="ph"><div><h3>${esc(g.resp || g.nombre)}</h3><div class="sub">${esc(g.nombre)} · ${rg.length} rutas</div></div><span class="st ${cerrada ? 'ok' : 'wait'}">${cerrada ? 'Cerrada' : '18:00'}</span></div>
          <div class="kv">${rg.map((r) => `<div class="r"><span class="k">${esc(r.asesor || r.ruta)}</span><span class="v">${peso(sum(rec.filter((x) => x.ruta_id === r.ruta_id && x.fecha === hoy), (x) => x.monto))}</span></div>`).join('')}
          <div class="r"><span class="k strong">Recibe el gerente</span><span class="v" style="color:var(--teal)">${peso(m)}</span></div></div></div>`
      }).join('')}</div>`
  },
}

// ---------------- Reportes
function csv(nombre, cols, rows) {
  const q = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const txt = '﻿' + [cols.map((c) => q(c[0])).join(','), ...rows.map((r) => cols.map((c) => q(c[2] ? c[2](r) : r[c[1]])).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }))
  a.download = `${nombre}_${DB.hoy}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500)
}
function tabla(cols, rows, totals) {
  return `<div class="tablewrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${c.t}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.num ? 'num' : ''} ${c.b ? 'strong' : ''}">${c.f ? c.f(r) : esc(r[c.k])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}"><div class="empty"><b>Sin datos en este ámbito</b></div></td></tr>`}
    </tbody>${totals ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.num ? 'num' : ''}">${i === 0 ? 'Total' : c.tot ? c.tot(rows) : ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`
}
const P = (k) => (r) => peso(r[k])
const T = (k) => (rows) => peso(sum(rows, (r) => r[k]))
const REPORTES = {
  general: { t: 'General', d: 'Totales de todos los que tienen préstamo con la empresa en el ámbito elegido.' },
  zona: { t: 'Por zona', d: 'Deuda total por zona, con su responsable zonal.' },
  gerente: { t: 'Por gerente', d: 'Deuda de los clientes a cargo de cada gerente.' },
  ruta: { t: 'Por ruta / asesor', d: 'Cartera, atraso y cobranza de hoy por cada ruta.' },
  cliente: { t: 'Por cliente', d: 'Deuda de cada cliente, de mayor a menor.' },
  antiguedad: { t: 'Antigüedad', d: 'Saldo agrupado por días de atraso.' },
}
VIEWS.reportes = {
  tab: 'general', q: '',
  html() {
    return `${head('Reportes', 'Cada reporte se puede ver para toda la empresa o por zona, gerencia, oficina o ruta, y descargar en Excel.')}
      <div class="tabs" id="rtabs">${Object.entries(REPORTES).map(([k, r]) => `<button type="button" data-t="${k}" class="${this.tab === k ? 'on' : ''}">${r.t}</button>`).join('')}</div>
      <div id="rbody"></div>`
  },
  init() {
    $$('#rtabs button').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.t; $$('#rtabs button').forEach((x) => x.classList.toggle('on', x === b)); this.paint() }))
    this.paint()
  },
  paint() {
    const car = sc.cartera(), act = car.filter((c) => c.saldo > 0), R = REPORTES[this.tab]
    let body = '', exp = null
    const hdr = (extra = '') => `<div class="ph"><div><h3>${R.t}</h3><div class="sub">${R.d} · ${esc(scopeLabel())}</div></div><div class="toolbar">${extra}<button class="btn ghost" id="bxls" type="button"><svg viewBox="0 0 24 24"><path d="M12 3v12M8 11l4 4 4-4M4 21h16"/></svg>Excel</button></div></div>`
    const cEst = [
      { t: 'Al día', k: 'al_dia', num: 1, f: P('al_dia'), tot: T('al_dia') }, { t: 'Atrasado', k: 'atrasado', num: 1, f: P('atrasado'), tot: T('atrasado') },
      { t: 'Alto riesgo', k: 'alto_riesgo', num: 1, f: P('alto_riesgo'), tot: T('alto_riesgo') }, { t: 'Vencido', k: 'vencido', num: 1, f: P('vencido'), tot: T('vencido') },
      { t: '% con atraso', num: 1, f: (r) => pct(r.atraso, r.saldo) + '%', tot: (rows) => pct(sum(rows, (r) => r.atraso), sum(rows, (r) => r.saldo)) + '%' },
    ]
    if (this.tab === 'general') {
      const tot = sum(act, (c) => c.saldo), at = sum(act.filter((c) => c.dias_atraso > 0), (c) => c.saldo)
      const tiles = [['Clientes con préstamo', NUM.format(new Set(act.map((c) => c.cliente_id)).size)], ['Créditos activos', NUM.format(act.length)], ['Total prestado (activos)', peso(sum(act, (c) => c.monto))],
        ['Deuda total', peso(tot)], ['Deuda con atraso', peso(at)], ['% con atraso', pct(at, tot) + '%'], ['Cuota promedio', peso(act.length ? sum(act, (c) => c.cuota) / act.length : 0)], ['Rutas', NUM.format(sc.rutas().length)]]
      const est = ESTADOS.map((e) => ({ estado: e.n, creditos: act.filter((c) => c.estado === e.k).length, clientes: new Set(act.filter((c) => c.estado === e.k).map((c) => c.cliente_id)).size, saldo: sum(act.filter((c) => c.estado === e.k), (c) => c.saldo) }))
      const cols = [{ t: 'Estado', k: 'estado', b: 1 }, { t: 'Clientes', k: 'clientes', num: 1, tot: (r) => sum(r, (x) => x.clientes) }, { t: 'Créditos', k: 'creditos', num: 1, tot: (r) => sum(r, (x) => x.creditos) }, { t: 'Saldo', num: 1, b: 1, f: P('saldo'), tot: T('saldo') }, { t: '% del total', num: 1, f: (r) => pct(r.saldo, tot) + '%', tot: () => '100%' }]
      body = `<div class="card panel">${hdr()}<div class="grid-rep">${tiles.map(([l, v]) => `<div class="mini inset"><div class="lab">${l}</div><div class="val">${v}</div></div>`).join('')}</div>${tabla(cols, est, true)}</div>`
      exp = () => csv('reporte_general', [['Estado', 'estado'], ['Clientes', 'clientes'], ['Créditos', 'creditos'], ['Saldo', 'saldo']], est)
    } else if (this.tab === 'zona') {
      const rows = agrupa(car, 'zona_id', 'zona', (c) => ({ resp: c.zonal })).sort((a, b) => b.saldo - a.saldo)
      const cols = [{ t: 'Zona', k: 'nombre', b: 1 }, { t: 'Zonal', k: 'resp' }, { t: 'Clientes', k: 'clientes', num: 1, tot: (r) => sum(r, (x) => x.clientes) }, { t: 'Créditos', k: 'creditos', num: 1, tot: (r) => sum(r, (x) => x.creditos) }, { t: 'Deuda total', num: 1, b: 1, f: P('saldo'), tot: T('saldo') }, ...cEst]
      body = `<div class="card panel">${hdr()}${tabla(cols, rows, true)}</div>`
      exp = () => csv('deuda_por_zona', [['Zona', 'nombre'], ['Zonal', 'resp'], ['Clientes', 'clientes'], ['Créditos', 'creditos'], ['Deuda total', 'saldo'], ['Al día', 'al_dia'], ['Atrasado', 'atrasado'], ['Alto riesgo', 'alto_riesgo'], ['Vencido', 'vencido']], rows)
    } else if (this.tab === 'gerente') {
      const rows = agrupa(car, 'gerencia_id', 'gerencia', (c) => ({ resp: c.gerente, zona: c.zona })).sort((a, b) => b.saldo - a.saldo)
      const cols = [{ t: 'Gerente', k: 'resp', b: 1 }, { t: 'Gerencia', k: 'nombre' }, { t: 'Zona', k: 'zona' }, { t: 'Clientes a su cargo', k: 'clientes', num: 1, tot: (r) => sum(r, (x) => x.clientes) }, { t: 'Deuda total', num: 1, b: 1, f: P('saldo'), tot: T('saldo') }, ...cEst]
      body = `<div class="card panel">${hdr()}${tabla(cols, rows, true)}</div>`
      exp = () => csv('deuda_por_gerente', [['Gerente', 'resp'], ['Gerencia', 'nombre'], ['Zona', 'zona'], ['Clientes', 'clientes'], ['Deuda total', 'saldo'], ['Al día', 'al_dia'], ['Atrasado', 'atrasado'], ['Alto riesgo', 'alto_riesgo'], ['Vencido', 'vencido']], rows)
    } else if (this.tab === 'ruta') {
      const hoy = DB.hoy, rec = sc.recaudo()
      const rows = agrupa(car, 'ruta_id', 'ruta', (c) => ({ resp: c.asesor, oficina: c.oficina, gerente: c.gerente })).map((r) => ({ ...r, hoyR: sum(rec.filter((x) => x.ruta_id === r.id && x.fecha === hoy), (x) => x.monto) })).sort((a, b) => b.saldo - a.saldo)
      const cols = [{ t: 'Ruta', k: 'nombre', b: 1 }, { t: 'Asesor', k: 'resp' }, { t: 'Oficina', k: 'oficina' }, { t: 'Gerente', k: 'gerente' }, { t: 'Clientes', k: 'clientes', num: 1, tot: (r) => sum(r, (x) => x.clientes) }, { t: 'Deuda total', num: 1, b: 1, f: P('saldo'), tot: T('saldo') }, { t: 'Con atraso', num: 1, f: P('atraso'), tot: T('atraso') }, { t: 'Cobrado hoy', num: 1, f: P('hoyR'), tot: T('hoyR') }]
      body = `<div class="card panel">${hdr()}${tabla(cols, rows, true)}</div>`
      exp = () => csv('cartera_por_ruta', [['Ruta', 'nombre'], ['Asesor', 'resp'], ['Oficina', 'oficina'], ['Gerente', 'gerente'], ['Clientes', 'clientes'], ['Deuda total', 'saldo'], ['Con atraso', 'atraso'], ['Cobrado hoy', 'hoyR']], rows)
    } else if (this.tab === 'cliente') {
      const all = porCliente(car).filter((c) => c.saldo > 0).sort((a, b) => b.saldo - a.saldo)
      const q = norm(this.q), rows = q ? all.filter((c) => norm(`${c.cliente} ${c.codigo} ${c.ruta} ${c.gerente} ${c.zona}`).includes(q)) : all
      const cols = [{ t: 'Cliente', k: 'cliente', b: 1 }, { t: 'Código', k: 'codigo' }, { t: 'Ruta', k: 'ruta' }, { t: 'Gerente', k: 'gerente' }, { t: 'Zona', k: 'zona' }, { t: 'Créditos', k: 'activos', num: 1, tot: (r) => sum(r, (x) => x.activos) }, { t: 'Deuda', num: 1, b: 1, f: P('saldo'), tot: T('saldo') }, { t: 'Días atraso', num: 1, f: (r) => r.dias }, { t: 'Estado', f: (r) => estadoChip(r.estado) }]
      body = `<div class="card panel">${hdr(`<input class="ctl" id="rq" placeholder="Buscar cliente…" value="${esc(this.q)}">`)}${tabla(cols, rows.slice(0, 300), true)}${rows.length > 300 ? `<div class="note">Se muestran 300 de ${NUM.format(rows.length)}; la descarga en Excel incluye todos.</div>` : ''}</div>`
      exp = () => csv('deuda_por_cliente', [['Cliente', 'cliente'], ['Código', 'codigo'], ['Ruta', 'ruta'], ['Asesor', 'asesor'], ['Gerente', 'gerente'], ['Zona', 'zona'], ['Créditos activos', 'activos'], ['Deuda', 'saldo'], ['Días de atraso', 'dias'], ['Estado', '', (r) => ESTADO[r.estado].n]], rows)
    } else {
      const B = [['Al día', 0, 0], ['1 a 7 días', 1, 7], ['8 a 30 días', 8, 30], ['31 a 60 días', 31, 60], ['Más de 60 días', 61, 1e9]]
      const tot = sum(act, (c) => c.saldo)
      const rows = B.map(([t, a, b]) => { const L = act.filter((c) => c.dias_atraso >= a && c.dias_atraso <= b); return { t, creditos: L.length, clientes: new Set(L.map((c) => c.cliente_id)).size, saldo: sum(L, (c) => c.saldo) } })
      const cols = [{ t: 'Atraso', k: 't', b: 1 }, { t: 'Clientes', k: 'clientes', num: 1, tot: (r) => sum(r, (x) => x.clientes) }, { t: 'Créditos', k: 'creditos', num: 1, tot: (r) => sum(r, (x) => x.creditos) }, { t: 'Saldo', num: 1, b: 1, f: P('saldo'), tot: T('saldo') }, { t: '% del total', num: 1, f: (r) => pct(r.saldo, tot) + '%', tot: () => '100%' }]
      body = `<div class="card panel">${hdr()}${tabla(cols, rows, true)}</div>`
      exp = () => csv('antiguedad_de_saldos', [['Atraso', 't'], ['Clientes', 'clientes'], ['Créditos', 'creditos'], ['Saldo', 'saldo']], rows)
    }
    $('#rbody').innerHTML = body
    $('#bxls')?.addEventListener('click', exp)
    const rq = $('#rq'); if (rq) { rq.addEventListener('input', (e) => { this.q = e.target.value; this.paint(); const n = $('#rq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length) }) }
  },
}

VIEWS.importar = {
  html() {
    return `${head('Importar datos', 'Trae la cartera del sistema actual (Listo) con Excel o CSV: primero una carga de prueba para conciliar y luego la carga final.')}
      <div class="steps">${[['Subir archivo', 'Excel o CSV exportado'], ['Mapear columnas', 'Emparejar con el sistema'], ['Validar', 'Duplicados y faltantes'], ['Confirmar', 'Prueba o carga final']].map(([t, d], i) => `<div class="step card ${i === 0 ? 'on' : ''}"><div class="num">${i + 1}</div><div><b>${t}</b><small>${d}</small></div></div>`).join('')}</div>
      <div class="card panel"><div class="drop"><b style="color:var(--ink);font-family:var(--font-d);font-size:16px">Arrastra tu archivo aquí</b><span>.xlsx, .xls o .csv — clientes, créditos, pagos y movimientos</span><button class="btn" disabled type="button">Seleccionar archivo</button></div>
        <div class="note-card">Antes de la carga real se borran los datos de ejemplo. Referencia del sistema actual: hasta 5,000 clientes, 5,000 créditos y 50,000 movimientos.</div></div>`
  },
}

VIEWS.admin = {
  tab: 'usuarios',
  html() {
    return `${head('Administración', 'Usuarios y roles, estructura de la empresa, parámetros y bitácora. Las acciones sensibles quedan registradas.')}
      <div class="tabs" id="atabs">${[['usuarios', 'Usuarios y roles'], ['estructura', 'Estructura'], ['parametros', 'Parámetros'], ['bitacora', 'Bitácora']].map(([k, t]) => `<button type="button" data-t="${k}" class="${this.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div id="abody" style="display:grid;gap:14px"></div>`
  },
  init() {
    $$('#atabs button').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.t; $$('#atabs button').forEach((x) => x.classList.toggle('on', x === b)); this.paint() }))
    this.paint()
  },
  paint() {
    const p = DB.perfil, el = $('#abody')
    if (this.tab === 'usuarios') {
      const roles = [['Dirección', 'Ve toda la empresa; autoriza acciones financieras'], ['Regional', 'Su región: zonas, gerencias, oficinas y rutas'], ['Zonal', 'Su zona: gerencias, oficinas y rutas; ve el resumen completo de su zona', 1],
        ['Gerente', 'Sus oficinas y rutas; recibe y redistribuye la caja'], ['Asesor / cobrador', 'Su ruta: clientes, cobro y caja propia'], ['Mesa de control', 'Revisa documentos; aprueba, rechaza u observa'], ['Consulta / auditoría', 'Sólo lectura dentro de su ámbito']]
      el.innerHTML = `<div class="card panel"><div class="ph"><h3>Roles del sistema</h3><span class="chip">región → zona → gerencia → oficina → ruta</span></div>
          ${roles.map(([n, d, nuevo]) => `<div class="rolerow inset ${nuevo ? 'new' : ''}"><div><div class="rn">${n}${nuevo ? ' <span class="chip g" style="margin-left:6px">nuevo</span>' : ''}</div><div class="rd">${d}</div></div><div class="cap">Permisos validados en la base de datos</div></div>`).join('')}
        </div>
        <div class="card panel"><div class="ph"><h3>Usuarios</h3><button class="btn" disabled type="button">+ Nuevo usuario</button></div>
          <div class="tablewrap"><table class="tbl"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead><tbody>
          <tr><td class="strong">${esc(p.nombre || '')}</td><td>${esc(p.correo || '')}</td><td>${esc(ROLES[p.rol] || p.rol || '')}</td><td><span class="st ok">Activo</span></td></tr></tbody></table></div>
          <div class="note">Por ahora sólo existe tu cuenta. Las altas de usuarios (con rol y ámbito) se activan en la siguiente etapa; los nuevos usuarios entran inactivos hasta que el dueño los active.</div></div>`
    } else if (this.tab === 'estructura') {
      const car = DB.cartera.filter((c) => c.saldo > 0)
      const s = (k, id) => peso(sum(car.filter((c) => c[k] === id), (c) => c.saldo))
      const reg = [...new Map(DB.rutas.map((r) => [r.region_id, r])).values()]
      el.innerHTML = `<div class="card panel"><div class="ph"><h3>Estructura de la empresa</h3><span class="chip">${DB.zonas.length} zonas · ${DB.gerencias.length} gerencias · ${DB.oficinas.length} oficinas · ${DB.rutas.length} rutas</span></div><div class="tree">
        ${reg.map((rg) => `<div class="tn inset"><span><b>${esc(rg.region)}</b> <small>· Regional: ${esc(rg.regional || '—')}</small></span><small>${s('region_id', rg.region_id)}</small></div>
          ${DB.zonas.filter((z) => DB.rutas.some((r) => r.zona_id === z.id && r.region_id === rg.region_id)).map((z) => `<div class="tn inset l2"><span><b>${esc(z.nombre)}</b> <small>· Zonal: ${esc(z.resp || '—')}</small></span><small>${s('zona_id', z.id)}</small></div>
            ${DB.gerencias.filter((g) => g.zona_id === z.id).map((g) => `<div class="tn inset l3"><span>${esc(g.nombre)} <small>· Gerente: ${esc(g.resp || '—')}</small></span><small>${s('gerencia_id', g.id)}</small></div>
              ${DB.oficinas.filter((o) => o.gerencia_id === g.id).map((o) => `<div class="tn inset l4"><span>Oficina ${esc(o.nombre)}</span><small>${s('oficina_id', o.id)}</small></div>
                ${DB.rutas.filter((r) => r.oficina_id === o.id).map((r) => `<div class="tn inset l5"><span>${esc(r.ruta)} <small>· ${esc(r.asesor || '')}</small></span><small>${s('ruta_id', r.ruta_id)}</small></div>`).join('')}`).join('')}`).join('')}`).join('')}`).join('')}
        </div></div>`
    } else if (this.tab === 'parametros') {
      const kv = [['Productos de préstamo', '<span class="pend">por definir</span>'], ['Cálculo de interés', '<span class="pend">provisional: 40 % · 10 cuotas</span>'], ['Frecuencias', 'semanal · quincenal (2 fechas fijas) · mensual'], ['Hora de cierre de caja', '18:00'],
        ['Rangos de atraso', '<span class="pend">provisional: 1–7 · 8–30 · +30 días</span>'], ['Mora / penalización', '<span class="pend">por definir</span>'], ['Días no laborables', '<span class="pend">por definir</span>'], ['Respaldos', 'diarios · 30 días']]
      el.innerHTML = `<div class="card panel"><h3 class="sec-title">Parámetros</h3><div class="kv">${kv.map(([k, v]) => `<div class="r"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}</div></div>`
    } else {
      el.innerHTML = `<div class="card panel"><div class="ph"><h3>Bitácora</h3><span class="chip">0 eventos</span></div><div class="empty"><b>Sin eventos todavía</b>Cada alta, cambio, pago, reverso o cierre quedará aquí: quién, cuándo, qué y por qué.</div></div>`
    }
  },
}

boot()
