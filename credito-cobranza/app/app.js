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
  dueno: 'Dueño', direccion: 'Dirección', regional: 'Gerente regional', zonal: 'Gerente zonal', gerente: 'Gerente',
  asesor: 'Asesor de crédito', mesa: 'Mesa de control', consulta: 'Consulta / auditoría', soporte: 'Soporte NXUS',
}
const ADMIN_ROLES = ['dueno', 'direccion', 'soporte']
const PER = { semanal: 7, quincenal: 15, mensual: 30 }
const ICON = {
  tablero: '<path d="M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z"/>',
  clientes: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  solicitudes: '<path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
  creditos: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
  cobranza: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
  cajas: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  reportes: '<path d="M4 19V5M10 19V9M16 19v-7M22 19H2"/>',
  importar: '<path d="M12 3v12M8 11l4 4 4-4M4 21h16"/>',
  normalidad: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  tesoreria: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
}
const NAV = [
  ['h', 'Operación'], ['tablero', 'Tablero'], ['clientes', 'Clientes'], ['solicitudes', 'Solicitudes'], ['creditos', 'Créditos'],
  ['cobranza', 'Cobranza'], ['normalidad', 'Normalidad'], ['cajas', 'Cajas'], ['tesoreria', 'Tesorería'], ['reportes', 'Reportes'],
  ['h', 'Sistema'], ['importar', 'Importar datos'], ['admin', 'Administración'],
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
  const recovery = /type=(recovery|invite)/.test(location.hash)
  try {
    const { createClient } = await import(SUPABASE_JS)
    sb = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  } catch (e) {
    return showLogin('No se pudo cargar el módulo de acceso. Revisa tu conexión y recarga la página.', true)
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') showNewPass(); if (ev === 'SIGNED_OUT') showLogin() })
  window.addEventListener('hashchange', () => { if (/type=(recovery|invite)/.test(location.hash)) showNewPass() })
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

async function loadRaw(perfil) {
  const desde = addDays(iso(new Date()), -400)
  const opt = async (t, b) => { try { return await fetchAll(t, b) } catch (e) { console.warn('sin acceso a', t); return [] } }
  const [rutas, cartera, recaudo, solicitudes, movimientos, cuentas, perfiles, regiones, zonas, gerencias, oficinas, rutasT] = await Promise.all([
    fetchAll('v_rutas', (q) => q.order('ruta_id')),
    fetchAll('v_cartera', (q) => q.order('credito_id')),
    fetchAll('v_recaudo_diario', (q) => q.gte('fecha', desde).order('fecha')),
    fetchAll('solicitudes', (q) => q.order('id')),
    opt('v_movimientos', (q) => q.order('fecha').order('id')),
    opt('cuentas_bancarias', (q) => q.order('id')),
    opt('perfiles', (q) => q.order('creado')),
    opt('regiones', (q) => q.order('id')), opt('zonas', (q) => q.order('id')), opt('gerencias', (q) => q.order('id')),
    opt('oficinas', (q) => q.order('id')), opt('rutas', (q) => q.order('id')),
  ])
  return { rutas, cartera, recaudo, solicitudes, movimientos, cuentas, perfiles, est: { regiones, zonas, gerencias, oficinas, rutas: rutasT }, perfil }
}
async function reload() {
  if (!sb) { toast('Modo de prueba: los cambios no se guardan.'); return }
  const keep = { VIEW, SCOPE }
  DB = prep(await loadRaw(DB.perfil))
  VIEW = keep.VIEW; SCOPE = keep.SCOPE
  showApp()
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
    DB = prep(await loadRaw({ ...perfil, correo: session.user.email }))
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
  const movimientos = (raw.movimientos || []).map((m) => ({ ...m, monto: +m.monto }))
  return {
    rutas, R, cartera, recaudo, solicitudes, perfil: raw.perfil || {}, movimientos, cuentas: raw.cuentas || [], perfiles: raw.perfiles || [],
    est: raw.est || { regiones: [], zonas: [], gerencias: [], oficinas: [], rutas: [] },
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
        <div class="note">Fórmula tomada del sistema actual (por confirmar): 50 % de interés plano en 10 cuotas de 15 % del monto.</div>
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
      const roles = [['Dirección', 'Ve toda la empresa; autoriza acciones financieras y da de alta usuarios'], ['Gerente regional', 'Su región: zonas, gerencias, oficinas y rutas'],
        ['Gerente zonal', 'Su zona: gerencias, oficinas y rutas; ve el resumen completo de su zona'], ['Gerente', 'Sus oficinas y rutas; recibe y redistribuye la caja'],
        ['Asesor de crédito', 'Su ruta: clientes, cobro y caja propia'], ['Mesa de control', 'Revisa documentos; aprueba, rechaza u observa'], ['Consulta / auditoría', 'Sólo lectura dentro de su ámbito']]
      const lista = DB.perfiles.length ? DB.perfiles : [p]
      const amb = (a) => !a || a === 'empresa' ? 'Toda la empresa' : ambitoNombre(a)
      el.innerHTML = `<div class="card panel"><div class="ph"><div><h3>Usuarios</h3><div class="sub">Cada usuario tiene un cargo y un ámbito: sólo ve lo que le toca. Los permisos se validan en la base de datos.</div></div>
          ${esAdmin() ? '<button class="btn" type="button" id="uinv"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Invitar usuario</button>' : ''}</div>
          <div class="tablewrap"><table class="tbl"><thead><tr><th>Nombre</th><th>Correo</th><th>Cargo</th><th>Ámbito</th><th>Estado</th><th></th></tr></thead><tbody>
          ${lista.map((u) => `<tr><td class="strong">${esc(u.nombre || '')}${u.id === p.id ? ' <span class="chip">tú</span>' : ''}</td><td>${esc(u.correo || '')}</td><td>${esc(ROLES[u.rol] || u.rol || '')}</td><td>${esc(amb(u.ambito))}</td>
            <td><span class="st ${u.activo ? 'ok' : 'off'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td class="num">${esAdmin() && u.id !== p.id && u.rol !== 'soporte' ? `<button class="btn ghost sm" type="button" data-edit="${esc(u.id)}">Editar</button>` : ''}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="note">Los usuarios nuevos reciben un correo para crear su contraseña. Entran con el cargo y el ámbito que les asignes; puedes desactivarlos en cualquier momento.</div></div>
        <div class="card panel"><div class="ph"><h3>Cargos del sistema</h3><span class="chip">región → zona → gerencia → oficina → ruta</span></div>
          ${roles.map(([n, d]) => `<div class="rolerow inset"><div><div class="rn">${n}</div><div class="rd">${d}</div></div><div class="cap">Permisos validados en la base de datos</div></div>`).join('')}</div>`
      $('#uinv')?.addEventListener('click', invitarUsuario)
      $$('[data-edit]').forEach((b) => b.addEventListener('click', () => editarUsuario(DB.perfiles.find((u) => u.id === b.dataset.edit))))
    } else if (this.tab === 'estructura') {
      const E = DB.est, car = DB.cartera.filter((c) => c.saldo > 0)
      const s$ = (k, id) => peso(sum(car.filter((c) => c[k] === id), (c) => c.saldo))
      const ed = (t, id) => esAdmin() ? `<button class="btn ghost sm" type="button" data-et="${t}" data-id="${id}">Editar</button>` : ''
      el.innerHTML = `<div class="card panel"><div class="ph"><div><h3>Estructura de la empresa</h3><div class="sub">${E.zonas.length} zonas · ${E.gerencias.length} gerencias · ${E.oficinas.length} oficinas · ${E.rutas.length} rutas</div></div>
        ${esAdmin() ? `<div class="toolbar">${[['region', 'Región'], ['zona', 'Zona'], ['gerencia', 'Gerencia'], ['oficina', 'Oficina'], ['ruta', 'Ruta']].map(([t, n]) => `<button class="btn ghost sm" type="button" data-nt="${t}">+ ${n}</button>`).join('')}</div>` : ''}</div>
        <div class="tree">
        ${E.regiones.map((rg) => `<div class="tn inset"><span><b>${esc(rg.nombre)}</b> <small>· Gerente regional: ${esc(rg.responsable || '—')}</small></span><span class="toolbar"><small>${s$('region_id', rg.id)}</small>${ed('region', rg.id)}</span></div>
          ${E.zonas.filter((z) => z.region_id === rg.id).map((z) => `<div class="tn inset l2"><span><b>${esc(z.nombre)}</b> <small>· Gerente zonal: ${esc(z.responsable || '—')}</small></span><span class="toolbar"><small>${s$('zona_id', z.id)}</small>${ed('zona', z.id)}</span></div>
            ${E.gerencias.filter((g) => g.zona_id === z.id).map((g) => `<div class="tn inset l3"><span>${esc(g.nombre)} <small>· Gerente: ${esc(g.responsable || '—')}</small></span><span class="toolbar"><small>${s$('gerencia_id', g.id)}</small>${ed('gerencia', g.id)}</span></div>
              ${E.oficinas.filter((o) => o.gerencia_id === g.id).map((o) => `<div class="tn inset l4"><span>Oficina ${esc(o.nombre)}</span><span class="toolbar"><small>${s$('oficina_id', o.id)}</small>${ed('oficina', o.id)}</span></div>
                ${E.rutas.filter((r) => r.oficina_id === o.id).map((r) => `<div class="tn inset l5"><span>${esc(r.nombre)} <small>· ${esc(r.responsable || 'sin asesor')}</small></span><span class="toolbar"><small>${s$('ruta_id', r.id)}</small>${ed('ruta', r.id)}</span></div>`).join('')}`).join('')}`).join('')}`).join('')}`).join('')}
        </div></div>`
      $$('[data-nt]').forEach((b) => b.addEventListener('click', () => editarNivel(b.dataset.nt)))
      $$('[data-et]').forEach((b) => b.addEventListener('click', () => editarNivel(b.dataset.et, +b.dataset.id)))
    } else if (this.tab === 'parametros') {
      const kv = [['Productos de préstamo', '<span class="pend">por definir</span>'], ['Cálculo de interés', '50 % plano · 10 cuotas de 15 % del monto <span class="pend">deducido de Listo, por confirmar</span>'], ['Frecuencias', 'semanal · quincenal (2 fechas fijas) · mensual'], ['Hora de cierre de caja', '18:00'],
        ['Rangos de atraso', '<span class="pend">provisional: 1–7 · 8–30 · +30 días</span>'], ['Mora / penalización', '<span class="pend">por definir</span>'], ['Días no laborables', '<span class="pend">por definir</span>'], ['Respaldos', 'diarios automáticos · 7 días']]
      el.innerHTML = `<div class="card panel"><h3 class="sec-title">Parámetros</h3><div class="kv">${kv.map(([k, v]) => `<div class="r"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}</div></div>`
    } else {
      el.innerHTML = `<div class="card panel"><div class="ph"><h3>Bitácora</h3><span class="chip">0 eventos</span></div><div class="empty"><b>Sin eventos todavía</b>Cada alta, cambio, pago, reverso o cierre quedará aquí: quién, cuándo, qué y por qué.</div></div>`
    }
  },
}

// ============================================================ utilidades de formularios
function toast(msg, tipo = 'ok') {
  let t = $('#toast')
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t) }
  t.className = 'toast ' + tipo; t.textContent = msg; t.hidden = false
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true }, 3800)
}
const esAdmin = () => ADMIN_ROLES.includes(DB.perfil.rol)
function formModal({ titulo, nota = '', campos, guardar, boton = 'Guardar' }) {
  const f = (c) => {
    const id = 'f_' + c.id, req = c.req ? ' required' : ''
    if (c.tipo === 'select') return `<label class="fl"><span>${c.label}${c.req ? ' *' : ''}</span><div class="field sel" style="display:block"><select class="ctl" id="${id}" style="width:100%"${req}>${c.opciones.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(c.valor ?? '') ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div></label>`
    if (c.tipo === 'check') return `<label class="fl chk"><input type="checkbox" id="${id}"${c.valor ? ' checked' : ''}> <span>${c.label}</span></label>`
    return `<label class="fl"><span>${c.label}${c.req ? ' *' : ''}</span><input class="ctl" id="${id}" type="${c.tipo || 'text'}" value="${esc(c.valor ?? '')}"${c.min != null ? ` min="${c.min}"` : ''}${c.step ? ` step="${c.step}"` : ''}${req} style="width:100%"></label>`
  }
  modal(`<div class="ph"><div><h3 style="font-size:19px">${titulo}</h3>${nota ? `<div class="sub">${nota}</div>` : ''}</div><button class="x" data-close aria-label="Cerrar">×</button></div>
    <form id="fm" class="fgrid" novalidate>${campos.map(f).join('')}<div class="err" id="fmErr" role="alert"></div>
    <div class="toolbar" style="justify-content:flex-end"><button class="btn ghost" type="button" data-close>Cancelar</button><button class="btn" type="submit" id="fmOk">${boton}</button></div></form>`)
  $('#fm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const v = {}
    campos.forEach((c) => { const el = $('#f_' + c.id); v[c.id] = c.tipo === 'check' ? el.checked : el.value.trim() })
    const falta = campos.find((c) => c.req && !v[c.id])
    if (falta) { $('#fmErr').textContent = `Falta: ${falta.label}.`; return }
    const b = $('#fmOk'); b.disabled = true; b.textContent = 'Guardando…'
    try {
      const msg = await guardar(v)
      $('#modalHost').innerHTML = ''
      if (msg) toast(msg)
    } catch (err) {
      console.error(err)
      $('#fmErr').textContent = err.userMsg || 'No se pudo guardar. Revisa los datos e intenta de nuevo.'
      b.disabled = false; b.textContent = boton
    }
  })
}
async function escribir(fn) {
  if (!sb) { toast('Modo de prueba: los cambios no se guardan.'); return false }
  const { error } = await fn()
  if (error) { const e = new Error(error.message); e.userMsg = /row-level security|permission/i.test(error.message) ? 'Tu cuenta no tiene permiso para este cambio.' : /duplicate|unique/i.test(error.message) ? 'Ya existe un registro con esos datos.' : ''; throw e }
  await reload(); return true
}

// ============================================================ altas de estructura y usuarios
const NIVELES = {
  region: { tabla: 'regiones', nombre: 'Región', resp: 'Gerente regional', padre: null },
  zona: { tabla: 'zonas', nombre: 'Zona', resp: 'Gerente zonal', padre: ['region_id', 'regiones', 'Región'] },
  gerencia: { tabla: 'gerencias', nombre: 'Gerencia', resp: 'Gerente', padre: ['zona_id', 'zonas', 'Zona'] },
  oficina: { tabla: 'oficinas', nombre: 'Oficina', resp: null, padre: ['gerencia_id', 'gerencias', 'Gerencia'] },
  ruta: { tabla: 'rutas', nombre: 'Ruta', resp: 'Asesor de crédito', padre: ['oficina_id', 'oficinas', 'Oficina'] },
}
function editarNivel(tipo, id) {
  const N = NIVELES[tipo], reg = id ? DB.est[N.tabla].find((x) => x.id === id) : null
  const campos = [{ id: 'nombre', label: 'Nombre', req: 1, valor: reg?.nombre }]
  if (N.resp) campos.push({ id: 'responsable', label: N.resp, valor: reg?.responsable })
  if (N.padre) {
    const [col, tabla, lab] = N.padre
    const ops = DB.est[tabla].map((x) => [x.id, x.nombre])
    if (!ops.length) { toast(`Primero crea una ${lab.toLowerCase()}.`, 'warn'); return }
    campos.push({ id: 'padre', label: `Pertenece a (${lab})`, tipo: 'select', req: 1, opciones: ops, valor: reg?.[col] ?? ops[0][0] })
  }
  formModal({
    titulo: `${id ? 'Editar' : 'Nueva'} ${N.nombre.toLowerCase()}`, nota: 'El cambio queda registrado con tu usuario.',
    campos,
    guardar: async (v) => {
      const row = { nombre: v.nombre }
      if (N.resp) row.responsable = v.responsable || null
      if (N.padre) row[N.padre[0]] = +v.padre
      const ok = await escribir(() => id ? sb.from(N.tabla).update(row).eq('id', id) : sb.from(N.tabla).insert(row))
      return ok ? `${N.nombre} ${id ? 'actualizada' : 'creada'}.` : ''
    },
  })
}
function ambitoOpciones() {
  const E = DB.est
  return [['empresa', 'Toda la empresa'], ...E.regiones.map((x) => ['region:' + x.id, 'Región · ' + x.nombre]), ...E.zonas.map((x) => ['zona:' + x.id, 'Zona · ' + x.nombre]),
    ...E.gerencias.map((x) => ['gerencia:' + x.id, 'Gerencia · ' + x.nombre]), ...E.oficinas.map((x) => ['oficina:' + x.id, 'Oficina · ' + x.nombre]), ...E.rutas.map((x) => ['ruta:' + x.id, 'Ruta · ' + x.nombre])]
}
function ambitoNombre(a) { return (ambitoOpciones().find(([v]) => v === a) || [a, a])[1] }
const cargoOpciones = () => Object.entries(ROLES).filter(([k]) => !['soporte', 'dueno'].includes(k) || (k === 'dueno' && DB.perfil.rol === 'soporte'))
function editarUsuario(u) {
  if (!u) return
  formModal({
    titulo: `Editar a ${esc(u.nombre || u.correo || '')}`, nota: esc(u.correo || ''),
    campos: [
      { id: 'nombre', label: 'Nombre', req: 1, valor: u.nombre },
      { id: 'rol', label: 'Cargo', tipo: 'select', req: 1, opciones: cargoOpciones(), valor: u.rol },
      { id: 'ambito', label: 'Ámbito (qué parte de la empresa ve)', tipo: 'select', req: 1, opciones: ambitoOpciones(), valor: u.ambito || 'empresa' },
      { id: 'activo', label: 'Activo (puede entrar al sistema)', tipo: 'check', valor: u.activo },
    ],
    guardar: async (v) => {
      const ok = await escribir(() => sb.from('perfiles').update({ nombre: v.nombre, rol: v.rol, ambito: v.ambito, activo: v.activo }).eq('id', u.id))
      return ok ? 'Usuario actualizado.' : ''
    },
  })
}
function invitarUsuario() {
  formModal({
    titulo: 'Invitar usuario', nota: 'Le llega un correo para crear su contraseña. Entra con este cargo y ámbito.', boton: 'Enviar invitación',
    campos: [
      { id: 'nombre', label: 'Nombre completo', req: 1 }, { id: 'correo', label: 'Correo', tipo: 'email', req: 1 },
      { id: 'rol', label: 'Cargo', tipo: 'select', req: 1, opciones: cargoOpciones(), valor: 'asesor' },
      { id: 'ambito', label: 'Ámbito (qué parte de la empresa ve)', tipo: 'select', req: 1, opciones: ambitoOpciones(), valor: 'empresa' },
    ],
    guardar: async (v) => {
      if (!sb) { toast('Modo de prueba: los cambios no se guardan.'); return '' }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.correo)) { const e = new Error('correo'); e.userMsg = 'Escribe un correo válido.'; throw e }
      const { data } = await sb.auth.getSession()
      const r = await fetch('/.netlify/functions/invitar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify(v) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { const e = new Error(j.error || 'invitar'); e.userMsg = j.error || 'No se pudo enviar la invitación.'; throw e }
      await reload()
      return `Invitación enviada a ${v.correo}.`
    },
  })
}

// ============================================================ Normalidad
// % de pagos  = $ cobrado ÷ $ esperado (cuotas que vencen en el periodo)
// % de clientes = número de pagos ÷ créditos con cuota en el periodo
// Mismo cálculo que "Estadística ruta" de Listo, pero a cualquier nivel.
function agenda(desde, hasta) {
  const m = new Map()
  sc.cartera().forEach((c) => {
    const per = PER[c.frecuencia] || 7
    for (let k = 1; k <= c.num_cuotas; k++) {
      const d = addDays(c.fecha_inicio, k * per)
      if (d > hasta) break
      if (d < desde) continue
      const key = c.ruta_id + '|' + d, x = m.get(key) || { n: 0, s: 0 }
      x.n++; x.s += c.cuota; m.set(key, x)
    }
  })
  return m
}
const semaforo = (p) => (p >= 90 ? 'ok' : p >= 70 ? 'wait' : 'bad')
VIEWS.normalidad = {
  rango: '7', nivel: 'ruta',
  html() {
    return `${head('Normalidad', 'Qué tanto se cobra de lo que tocaba cobrar: en pesos y en clientes, por ruta, oficina, gerencia o zona.',
      `<div class="seg" id="nrango">${[['1', 'Hoy'], ['7', '7 días'], ['30', '30 días']].map(([k, t]) => `<button type="button" data-r="${k}" class="${this.rango === k ? 'on' : ''}">${t}</button>`).join('')}</div>`)}
      <section class="kpis" id="nk"></section>
      <div class="card panel"><div class="ph"><div><h3>Normalidad diaria</h3><div class="sub">Últimos 30 días · días sin cuotas por cobrar no se grafican</div></div></div><div class="chart-box" style="height:250px"><canvas id="nchart"></canvas></div></div>
      <div class="card panel"><div class="ph"><div><h3>Por nivel</h3><div class="sub" id="nsub"></div></div><div class="tabs" id="nnivel">${[['ruta', 'Ruta'], ['oficina', 'Oficina'], ['gerencia', 'Gerencia'], ['zona', 'Zona']].map(([k, t]) => `<button type="button" data-n="${k}" class="${this.nivel === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <div id="ntabla"></div>
        <div class="note">Mismo cálculo que el reporte «Estadística ruta» del sistema actual. Puede pasar de 100 % cuando se cobran cuotas atrasadas. Verde ≥ 90 % · ámbar ≥ 70 %.</div></div>`
  },
  init() {
    $$('#nrango button').forEach((b) => b.addEventListener('click', () => { this.rango = b.dataset.r; $$('#nrango button').forEach((x) => x.classList.toggle('on', x === b)); reveal(); this.pintar() }))
    $$('#nnivel button').forEach((b) => b.addEventListener('click', () => { this.nivel = b.dataset.n; $$('#nnivel button').forEach((x) => x.classList.toggle('on', x === b)); this.tabla() }))
    this.pintar(); this.grafica()
  },
  datos() {
    const hoy = DB.hoy, n = +this.rango, desde = addDays(hoy, -(n - 1))
    const ag = agenda(desde, hoy), rec = sc.recaudo().filter((r) => r.fecha >= desde && r.fecha <= hoy)
    const porRuta = new Map()
    const get = (id) => { let x = porRuta.get(id); if (!x) { x = { esperado: 0, porCobrar: 0, cobrado: 0, pagos: 0 }; porRuta.set(id, x) } return x }
    ag.forEach((v, k) => { const x = get(+k.split('|')[0]); x.esperado += v.s; x.porCobrar += v.n })
    rec.forEach((r) => { const x = get(r.ruta_id); x.cobrado += r.monto; x.pagos += +r.pagos || 0 })
    return { porRuta, desde, hoy }
  },
  pintar() {
    const { porRuta } = this.datos()
    const T = { esperado: 0, porCobrar: 0, cobrado: 0, pagos: 0 }
    porRuta.forEach((x) => { for (const k in T) T[k] += x[k] })
    const pP = pct(T.cobrado, T.esperado), pC = pct(T.pagos, T.porCobrar)
    const lab = { 1: 'hoy', 7: 'últimos 7 días', 30: 'últimos 30 días' }[this.rango]
    const k = [
      { lab: 'Normalidad en pesos', val: pP + '%', meta: `cobrado vs esperado · ${lab}`, g: [COL.teal, COL.blue], st: semaforo(pP) },
      { lab: 'Normalidad en clientes', val: pC + '%', meta: `pagos vs clientes por cobrar`, g: [COL.blue, COL.violet], st: semaforo(pC) },
      { lab: 'Esperado', val: peso(T.esperado), meta: `${NUM.format(T.porCobrar)} cuotas por cobrar`, g: [COL.violet, COL.teal] },
      { lab: 'Cobrado', val: peso(T.cobrado), meta: `${NUM.format(T.pagos)} pagos registrados`, g: [COL.green, COL.teal] },
    ]
    $('#nk').innerHTML = k.map((x) => `<div class="card kpi lift"><div class="row1"><div class="ico" style="background:linear-gradient(135deg,${x.g[0]},${x.g[1]})"><svg viewBox="0 0 24 24">${ICON.normalidad}</svg></div>${x.st ? `<span class="st ${x.st}">${x.st === 'ok' ? 'Sana' : x.st === 'wait' ? 'Atención' : 'Baja'}</span>` : ''}</div>
      <div><div class="lab">${x.lab}</div><div class="val">${x.val}</div><div class="meta">${x.meta}</div></div></div>`).join('')
    $('#nsub').textContent = `${lab[0].toUpperCase() + lab.slice(1)} · ${scopeLabel()}`
    this.tabla()
  },
  tabla() {
    const { porRuta } = this.datos(), nivel = this.nivel
    const m = new Map()
    DB.rutas.filter(inScope).forEach((r) => {
      const x = porRuta.get(r.ruta_id) || { esperado: 0, porCobrar: 0, cobrado: 0, pagos: 0 }
      const id = r[nivel + '_id'], nombre = nivel === 'ruta' ? r.ruta : r[nivel]
      const resp = { ruta: r.asesor, oficina: r.gerente, gerencia: r.gerente, zona: r.zonal }[nivel]
      let y = m.get(id); if (!y) { y = { nombre, resp, esperado: 0, porCobrar: 0, cobrado: 0, pagos: 0 }; m.set(id, y) }
      for (const k of ['esperado', 'porCobrar', 'cobrado', 'pagos']) y[k] += x[k]
    })
    const rows = [...m.values()].map((y) => ({ ...y, pp: pct(y.cobrado, y.esperado), pc: pct(y.pagos, y.porCobrar) })).sort((a, b) => a.pp - b.pp)
    const chip = (p) => `<span class="st ${semaforo(p)}">${p}%</span>`
    const respT = { ruta: 'Asesor', oficina: 'Gerente', gerencia: 'Gerente', zona: 'Gerente zonal' }[nivel]
    $('#ntabla').innerHTML = tabla([
      { t: { ruta: 'Ruta', oficina: 'Oficina', gerencia: 'Gerencia', zona: 'Zona' }[nivel], k: 'nombre', b: 1 }, { t: respT, k: 'resp' },
      { t: 'Esperado', num: 1, f: P('esperado'), tot: T('esperado') }, { t: 'Cobrado', num: 1, b: 1, f: P('cobrado'), tot: T('cobrado') },
      { t: '% pagos', num: 1, f: (r) => chip(r.pp), tot: (r) => chip(pct(sum(r, (x) => x.cobrado), sum(r, (x) => x.esperado))) },
      { t: 'Por cobrar', k: 'porCobrar', num: 1, tot: (r) => sum(r, (x) => x.porCobrar) }, { t: 'Pagos', k: 'pagos', num: 1, tot: (r) => sum(r, (x) => x.pagos) },
      { t: '% clientes', num: 1, f: (r) => chip(r.pc), tot: (r) => chip(pct(sum(r, (x) => x.pagos), sum(r, (x) => x.porCobrar))) },
    ], rows, true)
  },
  grafica() {
    const hoy = DB.hoy, desde = addDays(hoy, -29)
    const ag = agenda(desde, hoy), rec = sc.recaudo()
    const dias = Array.from({ length: 30 }, (_, i) => addDays(desde, i))
    const e = new Map(), n = new Map(), c = new Map(), p = new Map()
    ag.forEach((v, k) => { const d = k.split('|')[1]; e.set(d, (e.get(d) || 0) + v.s); n.set(d, (n.get(d) || 0) + v.n) })
    rec.forEach((r) => { if (r.fecha >= desde) { c.set(r.fecha, (c.get(r.fecha) || 0) + r.monto); p.set(r.fecha, (p.get(r.fecha) || 0) + (+r.pagos || 0)) } })
    const dd = dias.filter((d) => e.get(d) > 0)
    chart($('#nchart'), {
      type: 'line',
      data: { labels: dd.map((d) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })), datasets: [
        { label: '% pagos', data: dd.map((d) => pct(c.get(d) || 0, e.get(d))), borderColor: COL.teal, backgroundColor: COL.teal + '30', fill: true, tension: 0.35, borderWidth: 2.6, pointRadius: 2 },
        { label: '% clientes', data: dd.map((d) => pct(p.get(d) || 0, n.get(d))), borderColor: COL.violet, borderWidth: 2.2, tension: 0.35, pointRadius: 0 },
        { label: 'Meta 90 %', data: dd.map(() => 90), borderColor: 'rgba(255,255,255,.35)', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: COL.ink2, usePointStyle: true, boxHeight: 7, font: { weight: 600 } } }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${x.raw}%` } } },
        scales: { x: { grid: { color: COL.grid }, ticks: { color: COL.ink2, maxRotation: 0, autoSkipPadding: 12 } }, y: { grid: { color: COL.grid }, ticks: { color: COL.ink2, callback: (v) => v + '%' }, beginAtZero: true, suggestedMax: 120 } } },
    })
  },
}

// ============================================================ Tesorería
const BANCO = () => Object.fromEntries(DB.cuentas.map((c) => [c.id, c]))
function cajaNombre(k) {
  if (k === 'externo') return 'Externo'
  const [t, id] = k.split(':')
  if (t === 'ruta') { const r = DB.R[id]; return r ? `Asesor · ${r.asesor || r.ruta}` : k }
  if (t === 'gerencia') { const g = DB.gerencias.find((x) => String(x.id) === id); return g ? `Gerente · ${g.resp || g.nombre}` : k }
  if (t === 'banco') { const b = BANCO()[id]; return b ? `${b.banco} ····${b.terminacion || ''}` : k }
  if (t === 'oficina') { const o = DB.oficinas.find((x) => String(x.id) === id); return o ? `Oficina ${o.nombre}` : k }
  return k
}
function cajasAmbito() {
  const set = new Set()
  DB.rutas.filter(inScope).forEach((r) => { set.add('ruta:' + r.ruta_id); set.add('gerencia:' + r.gerencia_id) })
  if (SCOPE === 'emp') { DB.cuentas.forEach((b) => set.add('banco:' + b.id)); DB.oficinas.forEach((o) => set.add('oficina:' + o.id)) }
  return set
}
function saldos(hasta) {
  const s = new Map(), add = (k, v) => s.set(k, (s.get(k) || 0) + v)
  DB.movimientos.forEach((m) => { if (m.fecha > hasta) return; if (m.caja_destino !== 'externo') add(m.caja_destino, m.monto); if (m.caja_origen !== 'externo') add(m.caja_origen, -m.monto) })
  DB.recaudo.forEach((r) => { if (r.fecha <= hasta) add('ruta:' + r.ruta_id, r.monto) })
  DB.cartera.forEach((c) => { if (c.fecha_inicio <= hasta) add('ruta:' + c.ruta_id, -c.monto) })
  return s
}
VIEWS.tesoreria = {
  periodo: 'mes', tipo: 'todos',
  html() {
    return `${head('Tesorería', 'El dinero de la empresa de punta a punta: socios y bancos, cajas de gerentes, cajas de asesores y cartera en la calle.',
      `<div class="seg" id="tper">${[['semana', 'Semana'], ['mes', 'Mes']].map(([k, t]) => `<button type="button" data-p="${k}" class="${this.periodo === k ? 'on' : ''}">${t}</button>`).join('')}</div>${esAdmin() ? '<button class="btn" type="button" id="tnuevo"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Registrar movimiento</button>' : ''}`)}
      <section class="kpis" id="tk"></section>
      <div class="card panel"><div class="ph"><div><h3>Flujo del dinero</h3><div class="sub" id="tflsub"></div></div></div><div class="flow" id="tflow"></div></div>
      <div class="grid2">
        <div class="card panel"><div class="ph"><div><h3>Balance de caja</h3><div class="sub" id="tbsub"></div></div></div><div class="kv" id="tbal"></div></div>
        <div class="card panel"><div class="ph"><div><h3>Utilidad del periodo</h3><div class="sub">Interés del periodo menos gastos</div></div></div><div class="kv" id="tutil"></div>
          <div class="note">El sistema actual cuenta todo el interés como utilidad el día que se presta. Aquí ves las dos: la que se reconoce al prestar y la que realmente entra al cobrar.</div></div>
      </div>
      <div class="grid2">
        <div class="card panel"><div class="ph"><h3>Cajas</h3><span class="chip" id="tcnt"></span></div><div class="list" id="tcajas"></div></div>
        <div class="card panel"><div class="ph"><h3>Movimientos</h3><div class="tabs" id="ttipo">${[['todos', 'Todos'], ['traslado', 'Traslados'], ['deposito', 'Depósitos'], ['retiro', 'Retiros'], ['egreso', 'Gastos'], ['fondeo', 'Fondeo']].map(([k, t]) => `<button type="button" data-t="${k}" class="${this.tipo === k ? 'on' : ''}">${t}</button>`).join('')}</div></div><div id="tmov"></div></div>
      </div>`
  },
  init() {
    $$('#tper button').forEach((b) => b.addEventListener('click', () => { this.periodo = b.dataset.p; $$('#tper button').forEach((x) => x.classList.toggle('on', x === b)); reveal(); this.pintar() }))
    $$('#ttipo button').forEach((b) => b.addEventListener('click', () => { this.tipo = b.dataset.t; $$('#ttipo button').forEach((x) => x.classList.toggle('on', x === b)); this.movs() }))
    $('#tnuevo')?.addEventListener('click', () => this.nuevo())
    this.pintar()
  },
  pintar() {
    const hoy = DB.hoy, set = cajasAmbito(), S = saldos(hoy)
    const sumT = (t) => sum([...set].filter((k) => k.startsWith(t + ':')), (k) => S.get(k) || 0)
    const enRutas = sumT('ruta'), enGer = sumT('gerencia'), enBanco = sumT('banco'), cartera = sum(sc.activos(), (c) => c.saldo)
    const K = [
      { lab: 'Efectivo con asesores', val: peso(enRutas), meta: new Date().getHours() < 18 ? 'cobranza de hoy, pendiente del cierre 18:00' : 'después del cierre 18:00', g: [COL.teal, COL.blue], i: ICON.cobranza },
      { lab: 'Efectivo con gerentes', val: peso(enGer), meta: 'fondo fijo y cierres por depositar', g: [COL.blue, COL.violet], i: ICON.cajas },
      { lab: 'Bancos', val: SCOPE === 'emp' ? peso(enBanco) : '—', meta: SCOPE === 'emp' ? `${DB.cuentas.length} cuentas` : 'sólo a nivel empresa', g: [COL.violet, COL.teal], i: ICON.tesoreria },
      { lab: 'Cartera en la calle', val: peso(cartera), meta: 'saldo por cobrar a clientes', g: [COL.green, COL.teal], i: ICON.creditos },
    ]
    $('#tk').innerHTML = K.map((x) => `<div class="card kpi lift"><div class="row1"><div class="ico" style="background:linear-gradient(135deg,${x.g[0]},${x.g[1]})"><svg viewBox="0 0 24 24">${x.i}</svg></div></div><div><div class="lab">${x.lab}</div><div class="val">${x.val}</div><div class="meta">${x.meta}</div></div></div>`).join('')

    const desde = this.periodo === 'semana' ? addDays(hoy, -6) : hoy.slice(0, 8) + '01'
    const lab = this.periodo === 'semana' ? 'últimos 7 días' : 'este mes'
    const M = DB.movimientos.filter((m) => m.fecha >= desde && m.fecha <= hoy)
    const sumM = (f) => sum(M.filter(f), (m) => m.monto)
    const isIn = (k) => set.has(k)
    const rec = sum(sc.recaudo().filter((r) => r.fecha >= desde && r.fecha <= hoy), (r) => r.monto)
    const prest = sum(sc.cartera().filter((c) => c.fecha_inicio >= desde && c.fecha_inicio <= hoy), (c) => c.monto)
    const ing = sumM((m) => m.caja_origen === 'externo' && isIn(m.caja_destino))
    const egr = sumM((m) => m.caja_destino === 'externo' && isIn(m.caja_origen))
    const ent = sumM((m) => m.caja_origen !== 'externo' && !isIn(m.caja_origen) && isIn(m.caja_destino))
    const sal = sumM((m) => m.caja_destino !== 'externo' && isIn(m.caja_origen) && !isIn(m.caja_destino))
    const Si = saldos(addDays(desde, -1)), inicial = sum([...set], (k) => Si.get(k) || 0)
    const final = inicial + rec - prest + ing - egr + ent - sal
    $('#tbsub').textContent = `${lab[0].toUpperCase() + lab.slice(1)} · ${scopeLabel()}`
    const row = (k, v, cls = '') => `<div class="r"><span class="k ${cls}">${k}</span><span class="v ${cls}">${v}</span></div>`
    $('#tbal').innerHTML = row('Caja inicial', peso(inicial)) + row('+ Cobrado a clientes', peso(rec)) + row('− Préstamos entregados', peso(prest)) + row('+ Fondeo e ingresos', peso(ing)) + row('− Gastos', peso(egr))
      + (SCOPE === 'emp' ? '' : row('+ Entradas de otras cajas', peso(ent)) + row('− Salidas a otras cajas', peso(sal))) + row('Caja final', peso(final), 'strong')

    const act = sc.cartera()
    const ratio = sum(act, (c) => c.total_pagar - c.monto) / Math.max(1, sum(act, (c) => c.total_pagar))
    const dev = sum(act.filter((c) => c.fecha_inicio >= desde && c.fecha_inicio <= hoy), (c) => c.total_pagar - c.monto)
    const cob = rec * ratio
    $('#tutil').innerHTML = row('Interés de préstamos nuevos (al prestar)', peso(dev)) + row('Interés cobrado (aprox.)', peso(cob)) + row('− Gastos del periodo', peso(egr))
      + row('Utilidad al prestar', peso(dev - egr), 'strong') + row('Utilidad cobrada', peso(cob - egr), 'strong')

    // Flujo
    const f = (o, d) => sumM((m) => m.caja_origen.startsWith(o) && m.caja_destino.startsWith(d) && (isIn(m.caja_origen) || isIn(m.caja_destino)))
    const nodo = (t, v, sub) => `<div class="node inset"><b>${t}</b><span class="nv">${v}</span><span>${sub}</span></div>`
    const flecha = (a, b) => `<div class="arr2"><span>→ ${a}</span><span>← ${b}</span></div>`
    $('#tflsub').textContent = `Saldos al día de hoy · movimientos de ${lab} · ${scopeLabel()}`
    $('#tflow').innerHTML = (SCOPE === 'emp' ? nodo('Socios', peso(sumM((m) => m.tipo === 'fondeo')), 'fondeo del periodo') + flecha('fondeo', '—') + nodo('Bancos', peso(enBanco), `${DB.cuentas.length} cuentas`)
      + flecha(peso(f('banco:', 'gerencia:')) + ' reposición', peso(f('gerencia:', 'banco:')) + ' depósitos') : '')
      + nodo('Gerentes', peso(enGer), 'cajas de gerencia') + flecha(peso(f('gerencia:', 'ruta:')) + ' para prestar', peso(f('ruta:', 'gerencia:')) + ' cierre 18:00')
      + nodo('Asesores', peso(enRutas), 'cajas de ruta') + flecha(peso(prest) + ' préstamos', peso(rec) + ' cobranza') + nodo('Clientes', peso(cartera), 'cartera por cobrar')

    // Cajas
    const cajas = [...set].filter((k) => !k.startsWith('oficina:') || (S.get(k) || 0) !== 0).map((k) => ({ k, n: cajaNombre(k), v: S.get(k) || 0, t: k.split(':')[0] }))
      .sort((a, b) => ['banco', 'gerencia', 'oficina', 'ruta'].indexOf(a.t) - ['banco', 'gerencia', 'oficina', 'ruta'].indexOf(b.t) || b.v - a.v)
    $('#tcnt').textContent = `${cajas.length} cajas`
    $('#tcajas').innerHTML = cajas.map((c) => `<div class="rowitem inset"><div><div class="t">${esc(c.n)}</div><div class="s">${{ banco: 'Cuenta bancaria', gerencia: 'Caja de gerente', ruta: 'Caja de asesor', oficina: 'Caja de oficina' }[c.t]}</div></div><div class="m" style="${c.v < 0 ? 'color:var(--red)' : ''}">${peso(c.v)}</div></div>`).join('')
    this.movs()
  },
  movs() {
    const set = cajasAmbito()
    const L = DB.movimientos.filter((m) => (set.has(m.caja_origen) || set.has(m.caja_destino)) && (this.tipo === 'todos' || m.tipo === this.tipo)).slice(-60).reverse()
    $('#tmov').innerHTML = tabla([
      { t: 'Fecha', k: 'fecha' }, { t: 'Concepto', f: (m) => `<b>${esc(m.concepto || m.categoria || m.tipo)}</b><div class="muted" style="font-size:12px">${esc(m.categoria || '')}</div>` },
      { t: 'De', f: (m) => esc(cajaNombre(m.caja_origen)) }, { t: 'A', f: (m) => esc(cajaNombre(m.caja_destino)) }, { t: 'Monto', num: 1, b: 1, f: P('monto') },
    ], L)
  },
  nuevo() {
    const cajas = [['externo', 'Externo (fuera de la empresa)'], ...DB.cuentas.map((b) => ['banco:' + b.id, cajaNombre('banco:' + b.id)]),
      ...DB.gerencias.map((g) => ['gerencia:' + g.id, cajaNombre('gerencia:' + g.id)]), ...DB.rutas.map((r) => ['ruta:' + r.ruta_id, cajaNombre('ruta:' + r.ruta_id)])]
    formModal({
      titulo: 'Registrar movimiento', nota: 'Queda en la bitácora con tu usuario, fecha y hora.',
      campos: [
        { id: 'tipo', label: 'Tipo', tipo: 'select', req: 1, opciones: [['deposito', 'Depósito a banco'], ['retiro', 'Retiro de banco'], ['traslado', 'Traslado entre cajas'], ['egreso', 'Gasto'], ['ingreso', 'Ingreso'], ['fondeo', 'Fondeo de socios']] },
        { id: 'origen', label: 'Sale de', tipo: 'select', req: 1, opciones: cajas }, { id: 'destino', label: 'Entra a', tipo: 'select', req: 1, opciones: cajas, valor: cajas[1]?.[0] },
        { id: 'concepto', label: 'Concepto', req: 1 }, { id: 'monto', label: 'Monto (MXN)', tipo: 'number', min: 1, step: '0.01', req: 1 },
        { id: 'fecha', label: 'Fecha', tipo: 'date', req: 1, valor: DB.hoy }, { id: 'obs', label: 'Observación' },
      ],
      guardar: async (v) => {
        const err = (m) => { const e = new Error(m); e.userMsg = m; throw e }
        if (v.origen === v.destino) err('El origen y el destino no pueden ser la misma caja.')
        if (['ingreso', 'fondeo'].includes(v.tipo) && v.origen !== 'externo') err('Un ingreso o fondeo debe salir de «Externo».')
        if (v.tipo === 'egreso' && v.destino !== 'externo') err('Un gasto debe ir a «Externo».')
        if (!(+v.monto > 0)) err('El monto debe ser mayor a cero.')
        const ok = await escribir(() => sb.from('movimientos_tesoreria').insert({ fecha: v.fecha, tipo: v.tipo, caja_origen: v.origen, caja_destino: v.destino, concepto: v.concepto, categoria: { deposito: 'Depósito', retiro: 'Retiro', traslado: 'Traslado', egreso: 'Gasto', ingreso: 'Ingreso', fondeo: 'Fondeo' }[v.tipo], monto: +v.monto, observacion: v.obs || null, creado_por: DB.perfil.id }))
        return ok ? 'Movimiento registrado.' : ''
      },
    })
  },
}

boot()
