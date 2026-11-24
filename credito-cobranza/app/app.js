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
  asesor: 'Asesor de crédito', mesa: 'Mesa de control', tesoreria: 'Tesorería', consulta: 'Consulta / auditoría', soporte: 'Soporte NXUS',
}
const CAMPO_ROLES = ['asesor', 'gerente', 'zonal', 'regional', 'dueno', 'direccion', 'soporte']
// Permisos que el dueño decide por cargo (Administración → Usuarios). Se validan también en la base de datos.
const PERMISOS = [
  ['Ver secciones', [['ver_tablero', 'Tablero'], ['ver_clientes', 'Clientes'], ['ver_originacion', 'Crear crédito'], ['ver_solicitudes', 'Solicitudes'], ['ver_creditos', 'Créditos'],
    ['ver_cobranza', 'Cobranza'], ['ver_normalidad', 'Normalidad'], ['ver_proyecciones', 'Proyecciones'], ['ver_cajas', 'Cajas'], ['ver_tesoreria', 'Tesorería'], ['ver_reportes', 'Reportes']]],
  ['Puede hacer', [['registrar_pagos', 'Registrar pagos'], ['crear_solicitudes', 'Crear y renovar créditos (solicitudes)'], ['resolver_solicitudes', 'Mesa de control: aprobar o rechazar'],
    ['registrar_gastos', 'Registrar gastos de su caja'], ['tesoreria_excedente', 'Pasar excedente de gerente al banco'], ['capturar_proyecciones', 'Capturar proyecciones'],
    ['desembolsar', 'Desembolsar créditos autorizados (con video)'], ['autorizar_excepciones', 'Autorizar renovaciones con excepción'],
    ['ordenar_ruta', 'Ordenar su ruta de cobro'], ['reasignar_cartera', 'Reasignar clientes a otra ruta'],
    ['subir_documentos', 'Subir documentos y fotos'], ['descargar_excel', 'Descargar reportes en Excel']]],
]
const CARGOS_PERM = ['direccion', 'regional', 'zonal', 'gerente', 'asesor', 'mesa', 'tesoreria', 'consulta']
const V = (...k) => k.map((x) => 'ver_' + x)
const PERM_EXTRA = { direccion: ['desembolsar', 'autorizar_excepciones', 'reasignar_cartera', 'ordenar_ruta'], regional: ['desembolsar', 'autorizar_excepciones', 'reasignar_cartera', 'ordenar_ruta'],
  zonal: ['desembolsar', 'autorizar_excepciones', 'reasignar_cartera', 'ordenar_ruta'], gerente: ['desembolsar', 'reasignar_cartera', 'ordenar_ruta'], asesor: ['desembolsar', 'ordenar_ruta'] }
const PERM_BASE = {
  direccion: [...V('tablero', 'clientes', 'originacion', 'solicitudes', 'creditos', 'cobranza', 'normalidad', 'proyecciones', 'cajas', 'tesoreria', 'reportes'), 'registrar_pagos', 'crear_solicitudes', 'resolver_solicitudes', 'registrar_gastos', 'tesoreria_excedente', 'capturar_proyecciones', 'subir_documentos', 'descargar_excel'],
  regional: [...V('tablero', 'clientes', 'originacion', 'solicitudes', 'creditos', 'cobranza', 'normalidad', 'proyecciones', 'cajas', 'tesoreria', 'reportes'), 'registrar_pagos', 'crear_solicitudes', 'capturar_proyecciones', 'subir_documentos', 'descargar_excel'],
  zonal: [...V('tablero', 'clientes', 'originacion', 'solicitudes', 'creditos', 'cobranza', 'normalidad', 'proyecciones', 'cajas', 'tesoreria', 'reportes'), 'registrar_pagos', 'crear_solicitudes', 'capturar_proyecciones', 'subir_documentos', 'descargar_excel'],
  gerente: [...V('tablero', 'clientes', 'originacion', 'solicitudes', 'creditos', 'cobranza', 'normalidad', 'proyecciones', 'cajas', 'tesoreria', 'reportes'), 'registrar_pagos', 'crear_solicitudes', 'registrar_gastos', 'capturar_proyecciones', 'subir_documentos', 'descargar_excel'],
  asesor: [...V('tablero', 'clientes', 'originacion', 'creditos', 'cobranza', 'normalidad', 'cajas', 'reportes'), 'registrar_pagos', 'crear_solicitudes', 'registrar_gastos', 'subir_documentos', 'descargar_excel'],
  mesa: [...V('solicitudes'), 'resolver_solicitudes'],
  tesoreria: [...V('tablero', 'clientes', 'solicitudes', 'creditos', 'cobranza', 'normalidad', 'proyecciones', 'cajas', 'tesoreria', 'reportes'), 'tesoreria_excedente', 'descargar_excel'],
  consulta: [...V('tablero', 'clientes', 'solicitudes', 'creditos', 'cobranza', 'normalidad', 'proyecciones', 'cajas', 'tesoreria', 'reportes'), 'descargar_excel'],
}
function permitido(rol, k, uid) {
  if (['dueno', 'soporte'].includes(rol)) return true
  const o = uid && (DB.permisosUsuario || []).find((q) => q.usuario === uid && q.permiso === k)
  if (o) return !!o.permitido
  const x = DB.permisos.find((q) => q.rol === rol && q.permiso === k)
  return x ? !!x.permitido : (PERM_BASE[rol] || []).includes(k) || (PERM_EXTRA[rol] || []).includes(k)
}
const puede = (k) => permitido(DB.perfil.rol, k, DB.perfil.id)
const TIPO = { nuevo: 'Nuevo', renovacion: 'Renovación', recompra: 'Recompra' }
const tipoChip = (t) => `<span class="chip ${t === 'renovacion' ? 'g' : t === 'recompra' ? 'a' : ''}">${TIPO[t] || 'Nuevo'}</span>`
const ADMIN_ROLES = ['dueno', 'direccion', 'soporte']
const PER = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
const FRECUENCIAS = [['diario', 'Diario'], ['semanal', 'Semanal'], ['quincenal', 'Quincenal'], ['mensual', 'Mensual']]
// «Gastos administrativos» (antes «Seguro»: lo cambió el abogado). Se aceptan los dos nombres de los registros anteriores.
const esGA = (m) => m.categoria === 'Gastos administrativos' || m.categoria === 'Seguro'
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
  originacion: '<path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
  proyecciones: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
}
const NAV = [
  ['h', 'Operación'], ['tablero', 'Tablero'], ['clientes', 'Clientes'], ['originacion', 'Crear crédito'], ['solicitudes', 'Solicitudes'], ['creditos', 'Créditos'],
  ['cobranza', 'Cobranza'], ['normalidad', 'Normalidad'], ['proyecciones', 'Proyecciones'], ['cajas', 'Cajas'], ['tesoreria', 'Tesorería'], ['reportes', 'Reportes'],
  ['h', 'Sistema'], ['importar', 'Importar datos'], ['admin', 'Administración'],
]

let sb = null
let DB = null
let SCOPE = 'emp'
let SIM = null // «Ver como…»: el dueño ve el sistema como otro cargo, sin poder guardar
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
  const [rutas, cartera, recaudo, solicitudes, movimientos, cuentas, perfiles, regiones, zonas, gerencias, oficinas, rutasT, pagos, parametros, proyecciones, personal, peticiones, documentos, permisos, condiciones, mensajes, permisosUsuario, bitacora] = await Promise.all([
    fetchAll('v_rutas', (q) => q.order('ruta_id')),
    fetchAll('v_cartera', (q) => q.order('credito_id')),
    fetchAll('v_recaudo_diario', (q) => q.gte('fecha', desde).order('fecha')),
    fetchAll('solicitudes', (q) => q.order('id')),
    opt('v_movimientos', (q) => q.order('fecha').order('id')),
    opt('cuentas_bancarias', (q) => q.order('id')),
    opt('perfiles', (q) => q.order('creado')),
    opt('regiones', (q) => q.order('id')), opt('zonas', (q) => q.order('id')), opt('gerencias', (q) => q.order('id')),
    opt('oficinas', (q) => q.order('id')), opt('rutas', (q) => q.order('id')),
    opt('v_pagos', (q) => q.order('fecha').order('id')), opt('parametros', (q) => q), opt('proyecciones', (q) => q.gte('fecha', addDays(iso(new Date()), -120)).order('fecha')),
    opt('personal', (q) => q.order('id')), opt('peticiones', (q) => q.order('creado', { ascending: false })),
    opt('documentos', (q) => q.order('creado', { ascending: false })), opt('permisos', (q) => q),
    opt('condiciones', (q) => q.order('id')), opt('solicitud_mensajes', (q) => q.order('creado')), opt('permisos_usuario', (q) => q),
    opt('bitacora', (q) => q.gte('cuando', addDays(iso(new Date()), -120)).order('cuando', { ascending: false })),
  ])
  return { rutas, cartera, recaudo, solicitudes, movimientos, cuentas, perfiles, est: { regiones, zonas, gerencias, oficinas, rutas: rutasT }, perfil, pagos, parametros, proyecciones, personal, peticiones, documentos, permisos, condiciones, mensajes, permisosUsuario, bitacora }
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
    // Si el dueño estaba en «Ver como…» y recargó la página, sigue en esa vista
    try { const g = JSON.parse(sessionStorage.getItem('verComo') || 'null'); if (g && ['dueno', 'soporte'].includes(DB.perfil.rol)) {
      SIM = { real: DB.perfil, ...g, rutas: g.rol === 'mesa' ? null : rutasDeAmbito(g.ambito) }; DB.perfil = { ...DB.perfil, id: g.uid || DB.perfil.id, rol: g.rol, ambito: g.ambito, nombre: g.nombre } } } catch {}
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
  const cartera = (raw.cartera || []).map((c) => ({ ...c, monto: +c.monto, saldo: +c.saldo, cuota: +c.cuota, total_pagar: +c.total_pagar,
    tipo: c.tipo || 'nuevo', entregado: c.entregado != null ? +c.entregado : +c.monto - (+c.descuento_renovacion || 0), seguro: +c.seguro || 0, descuento_renovacion: +c.descuento_renovacion || 0 }))
  const recaudo = (raw.recaudo || []).map((p) => ({ ...p, monto: +p.monto, ...(R[p.ruta_id] || {}) }))
  const solicitudes = (raw.solicitudes || []).map((s) => ({ ...s, monto: +s.monto, monto_autorizado: s.monto_autorizado == null ? null : +s.monto_autorizado,
    estado: s.estado === 'aprobada' ? 'desembolsada' : s.estado, ...(R[s.ruta_id] || {}) }))
  const uniq = (key, name, extra = () => ({})) => {
    const m = new Map(); rutas.forEach((r) => { if (!m.has(r[key])) m.set(r[key], { id: r[key], nombre: r[name], ...extra(r) }) }); return [...m.values()]
  }
  const movimientos = (raw.movimientos || []).map((m) => ({ ...m, monto: +m.monto }))
  return {
    rutas, R, cartera, recaudo, solicitudes, perfil: raw.perfil || {}, movimientos, cuentas: raw.cuentas || [], perfiles: raw.perfiles || [],
    pagos: (raw.pagos || []).map((x) => ({ ...x, monto: +x.monto })),
    param: Object.fromEntries((raw.parametros || []).map((x) => [x.clave, x.valor == null ? null : +x.valor])), parametros: raw.parametros || [],
    proyecciones: (raw.proyecciones || []).map((x) => ({ ...x, ...(Object.fromEntries(['meta_cobro', 'meta_colocacion', 'logro_cobro', 'logro_colocacion'].map((k) => [k, x[k] == null ? null : +x[k]]))) })),
    personal: raw.personal || [], peticiones: raw.peticiones || [], documentos: raw.documentos || [], permisos: raw.permisos || [],
    permisosUsuario: raw.permisosUsuario || [], bitacora: raw.bitacora || [],
    condiciones: (raw.condiciones || []).map((x) => ({ ...x, interes_pct: +x.interes_pct, num_cuotas: +x.num_cuotas })), mensajes: raw.mensajes || [],
    est: raw.est || { regiones: [], zonas: [], gerencias: [], oficinas: [], rutas: [] },
    hoy: iso(new Date()),
    demo: cartera.some((c) => c.es_demo) || solicitudes.some((s) => s.es_demo),
    zonas: uniq('zona_id', 'zona', (r) => ({ resp: r.zonal })),
    gerencias: uniq('gerencia_id', 'gerencia', (r) => ({ resp: r.gerente, zona_id: r.zona_id })),
    oficinas: uniq('oficina_id', 'oficina', (r) => ({ gerencia_id: r.gerencia_id })),
  }
}
// Ámbito del usuario: la base de datos ya sólo entrega su parte; aquí se usa para
// el selector (no puede subir más arriba de su ámbito) y el nivel inicial.
const NIVEL = ['emp', 'region', 'zona', 'gerencia', 'oficina', 'ruta']
function raiz() {
  const p = DB.perfil
  // Con varias rutas o zonas, la base de datos ya sólo entrega lo suyo: «todo mi ámbito»
  if (ADMIN_ROLES.includes(p.rol) || !p.ambito || p.ambito === 'empresa' || p.ambito.includes(',') || p.ambito === 'ninguno') return 'emp'
  return p.ambito
}
const multiAmbito = () => !ADMIN_ROLES.includes(DB.perfil.rol) && String(DB.perfil.ambito || '').includes(',')
// Rutas que entran en una lista de ámbitos («ruta:3,gerencia:2»)
function rutasDeAmbito(amb) {
  if (!amb || amb === 'empresa') return null
  const L = String(amb).split(',')
  return new Set(DB.rutas.filter((r) => L.some((a) => { const [n, id] = a.split(':'); return String(r[n + '_id']) === id })).map((r) => r.ruta_id))
}
const nivelDe = (sc) => NIVEL.indexOf(sc.split(':')[0])
function inScope(row) { return inScopeDe(SCOPE)(row) && (!SIM || !SIM.rutas || row.ruta_id == null || SIM.rutas.has(row.ruta_id)) }
function inScopeDe(scope) {
  if (scope === 'emp') return () => true
  const [nivel, id] = scope.split(':')
  return (row) => String(row[nivel + '_id']) === id
}
const sc = {
  cartera: () => DB.cartera.filter(inScope),
  activos: () => DB.cartera.filter((c) => c.saldo > 0 && inScope(c)),
  recaudo: () => DB.recaudo.filter(inScope),
  rutas: () => DB.rutas.filter(inScope),
  solicitudes: () => DB.solicitudes.filter((s) => (SIM && puede('resolver_solicitudes') ? inScopeDe(SCOPE)(s) : inScope(s))),
}
const PARAM = (k, d = null) => (DB.param && DB.param[k] != null ? DB.param[k] : d)
const dias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5)
const lunes = (d) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x) }
const fechaCorta = (d) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
const esCampo = () => CAMPO_ROLES.includes(DB.perfil.rol)
// Al día = menos días de atraso que el umbral (parámetro, 1 por omisión)
const alDia = (c) => c.saldo > 0 && c.dias_atraso < PARAM('atraso_dias', 1)
// Normalidad en dinero (fórmula del dueño): cartera al día ÷ cartera total × 100
function normalidadHoy(rows) {
  const act = rows.filter((c) => c.saldo > 0), tot = sum(act, (c) => c.saldo), ok = sum(act.filter(alDia), (c) => c.saldo)
  return { tot, ok, p: tot ? (ok / tot) * 100 : 0 }
}
// Historia: reconstruye el saldo y el atraso de cada crédito en cada fecha con sus pagos
const _hist = new Map()
function historiaNormalidad(fechas, clave = '') {
  const key = SCOPE + '|' + clave + '|' + fechas[0] + '|' + fechas[fechas.length - 1] + '|' + fechas.length
  if (_hist.has(key)) return _hist.get(key)
  const umbral = PARAM('atraso_dias', 1)
  const porCredito = new Map()
  DB.pagos.forEach((x) => { let L = porCredito.get(x.credito_id); if (!L) porCredito.set(x.credito_id, (L = [])); L.push(x) })
  const out = new Map(fechas.map((d) => [d, { tot: 0, ok: 0 }]))
  const orden = [...fechas].sort()
  sc.cartera().forEach((c) => {
    const ps = (porCredito.get(c.credito_id) || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha))
    const per = PER[c.frecuencia] || 7, pagadoHoy = c.total_pagar - c.saldo
    let despues = sum(ps, (x) => x.monto), i = 0
    for (const d of orden) {
      while (i < ps.length && ps[i].fecha <= d) { despues -= ps[i].monto; i++ }
      if (d < c.fecha_inicio) continue
      const pagado = pagadoHoy - despues, saldo = c.total_pagar - pagado
      if (saldo <= 0.5) continue
      const esperadas = Math.min(c.num_cuotas, Math.floor(dias(c.fecha_inicio, d) / per))
      const pagadas = Math.floor(pagado / c.cuota + 1e-4)
      const atraso = pagadas >= esperadas ? 0 : Math.max(1, dias(addDays(c.fecha_inicio, (pagadas + 1) * per), d))
      const o = out.get(d); o.tot += saldo; if (atraso < umbral) o.ok += saldo
    }
  })
  _hist.set(key, out)
  return out
}
function scopeLabel() {
  if (SCOPE === 'emp') return multiAmbito() || SIM?.rutas ? 'todo tu ámbito' : 'toda la empresa'
  const [nivel, id] = SCOPE.split(':')
  const r = DB.rutas.find((x) => String(x[nivel + '_id']) === id)
  const name = { region: r?.region, zona: r?.zona, gerencia: r?.gerencia, oficina: 'oficina ' + r?.oficina, ruta: 'ruta ' + r?.ruta }[nivel]
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
    if (!x) { x = { ...c, creditos: 0, activos: 0, saldo: 0, prestado: 0, base: 0, dias: 0 }; m.set(c.cliente_id, x) }
    x.creditos++; x.prestado += c.monto
    if (c.saldo > 0) { x.activos++; x.saldo += c.saldo; x.base += c.monto; x.dias = Math.max(x.dias, c.dias_atraso) }
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
  $('#bannerTxt').dataset.corto = DB.demo ? 'DATOS DE EJEMPLO' : ''
  if (!scopeValido(SCOPE)) SCOPE = raiz()
  const ok = vistasPermitidas()
  if (!ok.includes(VIEW)) VIEW = ok[0] || 'tablero'
  const S0 = DB.solicitudes.filter(inScopeDe(raiz()))
  const nRev = (esMesa() ? S0.filter((s) => s.estado === 'revision').length : 0) + (puede('autorizar_excepciones') ? S0.filter((s) => s.estado === 'excepcion').length : 0)
  const nOri = puede('crear_solicitudes') ? S0.filter((s) => s.estado === 'observada' || (s.estado === 'autorizada' && puedeDesembolsar(s))).length : 0
  const tag = (k) => k === 'solicitudes' && nRev ? `<span class="tag">${nRev}</span>` : k === 'originacion' && nOri ? `<span class="tag">${nOri}</span>` : ''
  const nAut = S0.filter((s) => s.estado === 'autorizada' && puedeDesembolsar(s)).length
  if (nAut && ['asesor', 'gerente'].includes(p.rol) && !showApp.avisado) { showApp.avisado = true; setTimeout(() => toast(`Mesa autorizó ${nAut === 1 ? '1 solicitud' : nAut + ' solicitudes'}: ve a «Crear crédito» para desembolsar.`), 900) }
  // Encabezados de sección sólo si debajo queda alguna opción visible
  const nav = NAV.filter(([k], i) => {
    if (k !== 'h') return ok.includes(k)
    const resto = NAV.slice(i + 1), fin = resto.findIndex(([x]) => x === 'h')
    return (fin < 0 ? resto : resto.slice(0, fin)).some(([x]) => ok.includes(x))
  })
  $('#nav').innerHTML = nav.map(([k, t]) => k === 'h' ? `<div class="nav-h">${t}</div>`
    : `<a data-view="${k}" class="${k === VIEW ? 'on' : ''}"><svg class="ic" viewBox="0 0 24 24">${ICON[k]}</svg>${t}${tag(k)}</a>`).join('')
  $$('#nav a').forEach((a) => a.addEventListener('click', () => go(a.dataset.view)))
  if (!$('#btnPeticion')) {
    const b = document.createElement('button'); b.id = 'btnPeticion'; b.type = 'button'; b.className = 'btn ghost peticion'
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>Enviar petición'
    b.addEventListener('click', () => { cerrarMenu(); enviarPeticion() }); $('.side-foot').prepend(b)
  }
  const rolReal = SIM ? SIM.real.rol : p.rol
  let bvc = $('#btnVerComo')
  if (['dueno', 'soporte'].includes(rolReal) && !bvc) {
    bvc = document.createElement('button'); bvc.id = 'btnVerComo'; bvc.type = 'button'; bvc.className = 'btn ghost peticion'
    bvc.innerHTML = '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>Ver como…'
    bvc.addEventListener('click', () => { cerrarMenu(); verComo() }); $('.side-foot').prepend(bvc)
  }
  let bar = $('#simBar')
  if (SIM) {
    if (!bar) { bar = document.createElement('div'); bar.id = 'simBar'; document.body.appendChild(bar) }
    bar.innerHTML = `<span>👁 Viendo como <b>${esc(ROLES[SIM.rol] || SIM.rol)}</b>${SIM.nombre && SIM.nombre !== ROLES[SIM.rol] ? ' · ' + esc(SIM.nombre) : ''} · ${esc(ambitoNombre(SIM.ambito || 'empresa'))} · sólo lectura</span><button type="button" class="btn sm" id="simOtro">Otro cargo</button><button type="button" class="btn sm" id="simSalir">Salir</button>`
    $('#simSalir').addEventListener('click', salirVerComo); $('#simOtro').addEventListener('click', verComo)
    document.body.classList.add('simulando')
  } else { bar?.remove(); document.body.classList.remove('simulando') }
  // Celular: 4 secciones principales abajo + «Más» (guías de iOS y Android: 3 a 5 destinos)
  const tabs = ({ asesor: ['tablero', 'cobranza', 'originacion', 'cajas'], mesa: ['solicitudes', 'tablero', 'clientes', 'reportes'], tesoreria: ['tablero', 'tesoreria', 'cajas', 'reportes'] }[DB.perfil.rol]
    || ['tablero', 'cobranza', 'normalidad', 'reportes']).filter((k) => ok.includes(k))
  const corto = { tablero: 'Inicio', cobranza: 'Cobranza', clientes: 'Clientes', cajas: 'Mi caja', normalidad: 'Normalidad', reportes: 'Reportes', originacion: 'Crédito', solicitudes: 'Mesa', tesoreria: 'Tesorería' }
  $('#tabbar').innerHTML = tabs.map((k) => `<button type="button" data-tab="${k}"><svg viewBox="0 0 24 24">${ICON[k]}</svg><span>${corto[k]}</span></button>`).join('')
    .replace(/(data-tab="originacion"[^>]*>)/, nOri ? '$1<i class="dot"></i>' : '$1')
    + `<button type="button" data-tab="mas"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg><span>Más</span>${nRev || nOri ? '<i class="dot"></i>' : ''}</button>`
  $$('#tabbar button').forEach((b) => b.addEventListener('click', () => b.dataset.tab === 'mas' ? abrirMenu() : go(b.dataset.tab)))
  go(VIEW, false)
}
function vistasPermitidas() {
  const rol = DB.perfil.rol
  return NAV.map(([k]) => k).filter((k) => k !== 'h'
    && (['importar', 'admin'].includes(k) ? esAdmin() : puede('ver_' + k)))
}
function abrirMenu() { $('#side').classList.add('open'); $('#scrim').classList.add('on') }
function cerrarMenu() { $('#side').classList.remove('open'); $('#scrim').classList.remove('on') }
function reveal() {
  if (reduceMotion) return
  const app = $('#app'); app.classList.add('reveal'); clearTimeout(reveal.t); reveal.t = setTimeout(() => app.classList.remove('reveal'), 210)
}
function go(view, animate = true) {
  VIEW = view
  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.view === view))
  const enTab = $$('#tabbar [data-tab]').some((b) => b.dataset.tab === view)
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === view || (!enTab && b.dataset.tab === 'mas')))
  cerrarMenu()
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
$('#menuBtn').addEventListener('click', abrirMenu)
$('#scrim').addEventListener('click', cerrarMenu)

// Celular: cada celda de tabla lleva el nombre de su columna para mostrarse como tarjeta.
function etiquetarTablas(root) {
  root.querySelectorAll('table.tbl').forEach((t) => {
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim())
    t.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => {
      let i = 0
      tr.querySelectorAll('td').forEach((td) => {
        if (!td.dataset.l && heads[i]) td.dataset.l = heads[i]
        if (!td.textContent.trim() && !td.querySelector('button,svg,img,input')) td.classList.add('vacia')
        i += +(td.getAttribute('colspan') || 1)
      })
    })
  })
}
let etqPend = false
new MutationObserver(() => {
  if (etqPend) return
  etqPend = true
  requestAnimationFrame(() => { etqPend = false; etiquetarTablas(document.body) })
}).observe(document.body, { childList: true, subtree: true })

function scopeOpciones() {
  const R = raiz(), nr = nivelDe(R)
  const grupos = [
    ['zona', 'Zonas', DB.zonas.map((z) => ['zona:' + z.id, z.nombre])],
    ['gerencia', 'Gerencias', DB.gerencias.map((g) => ['gerencia:' + g.id, g.nombre])],
    ['oficina', 'Oficinas', DB.oficinas.map((x) => ['oficina:' + x.id, x.nombre])],
    ['ruta', 'Rutas', DB.rutas.map((r) => ['ruta:' + r.ruta_id, `${r.ruta} · ${r.asesor || ''}`])],
  ].map(([n, l, ops]) => [n, l, SIM?.rutas ? ops.filter(([v]) => DB.rutas.some((r) => SIM.rutas.has(r.ruta_id) && String(r[v.split(':')[0] + '_id']) === v.split(':')[1])) : ops])
   .filter(([n, , ops]) => NIVEL.indexOf(n) > nr && ops.length)
  const top = R === 'emp' ? ['emp', multiAmbito() || SIM?.rutas ? `Todo mi ámbito · ${new Set(sc.rutas().map((r) => r.ruta_id)).size} rutas` : 'Toda la empresa'] : [R, 'Todo mi ámbito · ' + scopeLabelDe(R)]
  return { top, grupos }
}
function scopeLabelDe(sc) { const k = SCOPE; SCOPE = sc; const l = scopeLabel(); SCOPE = k; return l }
function scopeValido(sc) {
  const { top, grupos } = scopeOpciones()
  return sc === top[0] || grupos.some(([, , ops]) => ops.some(([v]) => v === sc))
}
function scopeField() {
  if (DB.perfil.rol === 'mesa') return ''
  const o = (v, t) => `<option value="${v}"${SCOPE === v ? ' selected' : ''}>${esc(t)}</option>`
  const { top, grupos } = scopeOpciones()
  return `<div class="field sel"><label for="scope">Ámbito</label><select class="ctl" id="scope">
    ${o(top[0], top[1])}
    ${grupos.map(([, lab, ops]) => `<optgroup label="${lab}">${ops.map(([v, t]) => o(v, t)).join('')}</optgroup>`).join('')}
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

// Inicio del asesor: como una app. Su avance del día en un anillo y botones grandes para trabajar.
const esInicioCampo = () => DB.perfil.rol === 'asesor' && !VIEWS.tablero.completo
function inicioCampo() {
  const hoy = DB.hoy, act = sc.activos()
  const pagHoy = new Set(DB.pagos.filter((x) => x.fecha === hoy && x.tipo !== 'liquidacion_renovacion').map((x) => x.credito_id))
  const toca = act.filter((c) => addDays(c.fecha_inicio, (c.cuotas_pagadas + 1) * (PER[c.frecuencia] || 7)) <= hoy || pagHoy.has(c.credito_id))
  const esperado = sum(toca, (c) => Math.min(c.cuota, c.saldo + (pagHoy.has(c.credito_id) ? c.cuota : 0)))
  const cobrado = sum(sc.recaudo().filter((r) => r.fecha === hoy), (r) => r.monto)
  const visitados = toca.filter((c) => pagHoy.has(c.credito_id)).length, faltan = toca.length - visitados
  const P = esperado ? Math.min(100, Math.round(cobrado / esperado * 100)) : 0
  const S = sc.solicitudes(), A = S.filter((x) => x.estado === 'autorizada' && puedeDesembolsar(x)).length, O = S.filter((x) => x.estado === 'observada').length
  const R = act.filter(puedeRenovar).length, N = Math.round(normalidadHoy(sc.cartera()).p)
  const caja = sum(sc.rutas(), (r) => saldos(hoy).get('ruta:' + r.ruta_id) || 0)
  const nombre = SIM && SIM.nombre === ROLES[SIM.rol] ? '' : (DB.perfil.nombre || '').split(' ')[0]
  const h = new Date().getHours(), saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  const C = 2 * Math.PI * 54
  const tiles = [
    ['cobrar', 'Cobrar mi ruta', faltan ? `${faltan} por cobrar hoy` : 'Todo cobrado por hoy', ICON.cobranza, ['#2ee6cf', '#3f7bff'], faltan, 'registrar_pagos'],
    ['nuevo', 'Nuevo crédito', 'Cliente, fotos y GPS', ICON.originacion, ['#b294ff', '#6b5bff'], 0, 'crear_solicitudes'],
    ['desembolso', 'Desembolsos', A ? `${A} listo${A > 1 ? 's' : ''} para entregar` : 'Ninguno pendiente', '<path d="M3 7h18v10H3z"/><circle cx="12" cy="12" r="2.6"/><path d="M7 7V5h10v2"/>', ['#55e8a8', '#13a874'], A, 'desembolsar'],
    ['correccion', 'Correcciones', O ? `${O} que mesa regresó` : 'Sin pendientes', '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="M13 7l4 4"/>', ['#ffc857', '#ff8a3d'], O, 'crear_solicitudes'],
    ['renovar', 'Renovar', R ? `${R} cliente${R > 1 ? 's' : ''} al ${PARAM('renovacion_pct', 80)} %` : 'Nadie al 80 % todavía', '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>', ['#ff86a6', '#d14b8f'], R, 'crear_solicitudes'],
    ['clientes', 'Mis clientes', `${new Set(act.map((c) => c.cliente_id)).size} con crédito`, ICON.clientes, ['#6b97ff', '#3956d6'], 0, 'ver_clientes'],
    ['caja', 'Mi caja', peso(caja), ICON.cajas, ['#8fd3ff', '#3a8edb'], 0, 'ver_cajas'],
    ['gasto', 'Registrar gasto', 'Gasolina y otros', '<path d="M3 21V5a2 2 0 012-2h7a2 2 0 012 2v16"/><path d="M3 21h11M14 9h2a2 2 0 012 2v6a2 2 0 004 0V8l-3-3"/>', ['#c7a2ff', '#8b5cf6'], 0, 'registrar_gastos'],
    ['normalidad', 'Mi normalidad', `${N} % al día`, ICON.normalidad, N >= PARAM('meta_normalidad', 90) ? ['#55e8a8', '#2ee6cf'] : ['#ffc857', '#ff7272'], 0, 'ver_normalidad'],
  ].filter((t) => puede(t[6]))
  return `<div class="home">
    <div class="hero card"><div class="ring"><svg viewBox="0 0 120 120"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2ee6cf"/><stop offset="1" stop-color="#6b97ff"/></linearGradient></defs>
        <circle cx="60" cy="60" r="54" class="trk"/><circle cx="60" cy="60" r="54" class="val" stroke="url(#rg)" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - P / 100)}"/></svg>
        <div class="rc"><b>${P}%</b><span>de la meta de hoy</span></div></div>
      <div class="hi"><div class="dt">${new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>${saludo}${nombre ? ', ' + esc(nombre) : ''}</h1>
        <div class="hm"><div><b>${peso(cobrado)}</b><span>cobrado de ${peso(esperado)}</span></div><div><b>${visitados}/${toca.length}</b><span>clientes cobrados hoy</span></div><div><b>${act.filter((c) => c.dias_atraso > 0).length}</b><span>con atraso</span></div></div></div></div>
    <div class="tiles">${tiles.map(([k, t, d, ico, g, n]) => `<button type="button" class="tile card" data-tile="${k}"><span class="ti" style="background:linear-gradient(135deg,${g[0]},${g[1]})"><svg viewBox="0 0 24 24">${ico}</svg></span>${n ? `<span class="tb">${n}</span>` : ''}<b>${t}</b><small>${d}</small></button>`).join('')}</div>
    <button type="button" class="btn ghost sm vertab" id="vTab">Ver tablero completo</button></div>`
}
function inicioCampoInit() {
  const ir = { cobrar: () => go('cobranza'), nuevo: () => nuevaSolicitud(), desembolso: () => go('originacion'), correccion: () => go('originacion'), renovar: () => go('originacion'),
    clientes: () => go('clientes'), caja: () => go('cajas'), gasto: () => registrarGasto(), normalidad: () => go('normalidad') }
  $$('[data-tile]').forEach((b) => b.addEventListener('click', () => ir[b.dataset.tile]?.()))
  $('#vTab')?.addEventListener('click', () => { VIEWS.tablero.completo = true; render() })
}
VIEWS.tablero = {
  periodo: 'sem',
  html() {
    if (esInicioCampo()) return inicioCampo()
    const h = new Date().getHours()
    const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
    const nombre = SIM && SIM.nombre === ROLES[SIM.rol] ? '' : (DB.perfil.nombre || '').split(' ')[0]
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
          <div class="note"><b>Toca un color</b> para ver quiénes son esos clientes, exportarlos o pasárselos a otro asesor. Rangos: al día · 1–7 días · 8–30 días · más de 30 días.</div>
        </div>
        <div class="card panel"><div class="ph"><div><h3>Cobranza del día</h3><div class="sub">Cobrado hoy vs promedio diario de las últimas 2 semanas</div></div></div><div class="list" id="cobranza"></div></div>
      </div>
      <div class="grid2">
        <div class="card panel"><div class="ph"><div><h3>Colocación: nuevos y renovaciones</h3><div class="sub">Nuevos se pagan por cliente; renovaciones por dinero entregado</div></div><div class="seg" id="colp"><button type="button" data-p="sem" class="on">Semana</button><button type="button" data-p="mes">Mes</button></div></div><div id="colTab"></div></div>
        <div class="card panel"><div class="ph"><div><h3>Gastos administrativos cobrados</h3><div class="sub">$${PARAM('seguro_monto', 150)} por crédito · no cambia la deuda del cliente</div></div></div><div class="grid-rep" id="segTab"></div></div>
      </div>
      <div class="grid3">
        <div class="card panel span2"><div class="ph"><div><h3>Recaudo vs colocación</h3><div class="sub" id="trendSub"></div></div></div><div class="chart-box" style="height:250px"><canvas id="trend"></canvas></div></div>
        <div class="card panel"><div class="ph"><div><h3>Cajas por gerente</h3><div class="sub">Cobranza recibida hoy</div></div></div><div class="list" id="cajas"></div>
          <div class="auto"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> Traslado automático a las 18:00 · con bitácora</div></div>
      </div>`
  },
  init() {
    if (esInicioCampo()) return inicioCampoInit()
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
    const umbral = PARAM('atraso_dias', 1)
    const N = normalidadHoy(car), meta = PARAM('meta_normalidad', 90)
    const colm = car.filter((c) => c.fecha_inicio >= mes)
    const nuevos = colm.filter((c) => c.tipo !== 'renovacion'), renov = colm.filter((c) => c.tipo === 'renovacion')
    const clientes = new Set(act.map((c) => c.cliente_id)).size
    const K = [
      { lab: 'Cartera total', val: peso(total), meta: `${NUM.format(clientes)} clientes · ${NUM.format(act.length)} créditos activos`, grad: [COL.teal, COL.blue], ico: '<path d="M3 6h18v12H3z"/><path d="M3 10h18"/>',
        extra: meter(ESTADOS.map((e) => [pct(porEstado[e.k], total), e.c])) },
      { lab: 'Normalidad', val: Math.round(N.p) + '%', meta: `${peso(N.ok)} al día de ${pesoK(N.tot)} · meta ${meta}%`, grad: [COL.green, COL.teal], ico: ICON.normalidad,
        chip: `<span class="chip ${N.p >= meta ? 'g' : N.p >= meta - 15 ? 'a' : 'r'}">${N.p >= meta ? 'En meta' : 'Abajo de meta'}</span>`, extra: meter([[Math.round(N.p), N.p >= meta ? COL.green : COL.amber]]) },
      { lab: 'Cobrado hoy', val: peso(recHoy), meta: `promedio diario ${peso(recPrev)}`, grad: [COL.blue, COL.violet], ico: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
        chip: recPrev ? `<span class="chip ${recHoy >= recPrev ? 'g' : 'a'}">${recHoy >= recPrev ? '▲' : '▼'} ${Math.abs(pct(recHoy - recPrev, recPrev))}%</span>` : '', spark: d14.map((d) => recD.get(d) || 0), sc: COL.blue },
      { lab: 'Colocado este mes', val: peso(colMes), meta: `${NUM.format(new Set(nuevos.map((c) => c.cliente_id)).size)} clientes nuevos · renovaciones ${pesoK(sum(renov, (c) => c.entregado))}`, grad: [COL.violet, COL.teal], ico: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
        spark: d14.map((d) => colD.get(d) || 0), sc: COL.violet },
    ]
    this.atraso = { atraso, total, umbral }
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
    $('#cliDeuda').innerHTML = `<b style="color:#ff9a9a">${peso(atraso)}</b>&nbsp;con atraso · ${pct(atraso, total)}%`
    $('#donutTot').textContent = pesoK(total)
    $('#legend').innerHTML = ESTADOS.map((e) => {
      const n = new Set(act.filter((c) => c.estado === e.k).map((c) => c.cliente_id)).size
      return `<button type="button" class="li click" data-est="${e.k}"><span class="dot" style="background:${e.c};color:${e.c}"></span><span>${e.n}</span><span class="amt">${peso(porEstado[e.k])}</span><small>${pct(porEstado[e.k], total)}% de lo que deben · ${e.s} · ${n} clientes · <u>ver</u></small></button>`
    }).join('')
    chart($('#donut'), {
      type: 'doughnut',
      data: { labels: ESTADOS.map((e) => e.n), datasets: [{ data: total ? ESTADOS.map((e) => porEstado[e.k]) : [1], backgroundColor: total ? ESTADOS.map((e) => e.c) : ['rgba(255,255,255,.08)'], borderWidth: 0, cutout: '74%', hoverOffset: 6, spacing: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, onClick: (ev, els) => { if (total && els[0]) clientesPorEstado(ESTADOS[els[0].index].k) },
        onHover: (ev, els) => { if (ev.native?.target) ev.native.target.style.cursor = els[0] ? 'pointer' : 'default' },
        plugins: { legend: { display: false }, tooltip: { enabled: !!total, callbacks: { label: (c) => ' ' + peso(c.raw) + ' · toca para ver' } } } },
    })
    $$('#legend [data-est]').forEach((b) => b.addEventListener('click', () => clientesPorEstado(b.dataset.est)))

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
    this.colocacion('sem'); this.seguros()
    $$('#colp button').forEach((b) => b.addEventListener('click', () => { $$('#colp button').forEach((x) => x.classList.toggle('on', x === b)); this.colocacion(b.dataset.p) }))
    this.trend()
    $$('#period button').forEach((b) => b.addEventListener('click', () => { this.periodo = b.dataset.p; $$('#period button').forEach((x) => x.classList.toggle('on', x === b)); reveal(); this.trend() }))
  },
  colocacion(p) {
    const desde = p === 'sem' ? lunes(DB.hoy) : DB.hoy.slice(0, 8) + '01'
    const L = sc.cartera().filter((c) => c.fecha_inicio >= desde && c.fecha_inicio <= DB.hoy)
    const g = (t) => L.filter((c) => c.tipo === t)
    const rows = [['Nuevos', g('nuevo')], ['Renovaciones', g('renovacion')], ['Recompras', g('recompra')]].map(([n, X]) => ({ n, clientes: new Set(X.map((c) => c.cliente_id)).size, base: sum(X, (c) => c.monto), entregado: sum(X, (c) => c.entregado) }))
    $('#colTab').innerHTML = tabla([{ t: 'Tipo', k: 'n', b: 1 }, { t: 'Clientes', k: 'clientes', num: 1, tot: (r) => sum(r, (x) => x.clientes) }, { t: 'Prestado (base)', num: 1, f: P('base'), tot: T('base') }, { t: 'Entregado', num: 1, b: 1, f: P('entregado'), tot: T('entregado') }], rows, true)
      + `<div class="note">${p === 'sem' ? 'Desde el lunes' : 'Desde el día 1'} · ${esc(scopeLabel())}. En renovaciones, «entregado» ya descuenta lo que debía el cliente.</div>`
  },
  seguros() {
    const L = DB.movimientos.filter((m) => esGA(m) && cajasAmbito().has(m.caja_destino))
    const s = (desde) => sum(L.filter((m) => m.fecha >= desde && m.fecha <= DB.hoy), (m) => m.monto)
    const tiles = [['Hoy', s(DB.hoy)], ['Esta semana', s(lunes(DB.hoy))], ['Este mes', s(DB.hoy.slice(0, 8) + '01')], ['Últimos 12 meses', s(addDays(DB.hoy, -365))]]
    $('#segTab').innerHTML = tiles.map(([l, v]) => `<div class="mini inset"><div class="lab">${l}</div><div class="val">${peso(v)}</div></div>`).join('')
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
function puedeRenovar(c) {
  return c.saldo > 0 && (c.total_pagar - c.saldo) >= c.total_pagar * PARAM('renovacion_pct', 80) / 100 - 0.01
    && !DB.solicitudes.some((s) => s.credito_anterior_id === c.credito_id && ['borrador', 'revision', 'observada'].includes(s.estado))
}
function fichaCliente(id) {
  const cr = DB.cartera.filter((c) => c.cliente_id === id).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
  if (!cr.length) return
  const c = cr[0], act = cr.filter((x) => x.saldo > 0)
  const pagos = (k) => DB.pagos.filter((x) => x.credito_id === k).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const dato = (l, v) => v ? `<div class="r"><span class="k">${l}</span><span class="v">${esc(v)}</span></div>` : ''
  const ft = fotoCliente(id)
  modal(`<div class="ph"><div class="fhead">${ft ? `<img class="cfoto big" alt="" id="fFoto">` : ''}<div><h3 style="font-size:20px">${esc(c.cliente)}</h3><div class="sub">${esc(c.codigo)} · ${esc(c.ruta)} (${esc(c.asesor || '')}) · ${esc(c.gerencia)} · ${esc(c.zona)}</div></div></div><button class="x" data-close aria-label="Cerrar">×</button></div>
    <div class="statrow">${[['Debe hoy (saldo)', peso(sum(cr, (x) => x.saldo))], ['Base (prestado)', peso(sum(act, (x) => x.monto))], ['Créditos en su historial', cr.length], ['Atraso', act.length ? Math.max(...act.map((x) => x.dias_atraso)) + ' días' : '—']].map(([l, v]) => `<div class="card"><div class="lab">${l}</div><div class="val">${v}</div></div>`).join('')}</div>
    <div class="toolbar">${act.length && puede('registrar_pagos') ? `<button class="btn" type="button" id="fpago"><svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>Registrar pago</button>` : ''}
      ${act.some(puedeRenovar) && puede('crear_solicitudes') ? `<button class="btn ghost" type="button" id="fren">Renovar</button>` : ''}
      ${!act.length && puede('crear_solicitudes') ? `<button class="btn ghost" type="button" id="frec">Recompra (nuevo crédito)</button>` : ''}</div>
    <div class="kv">${dato('CURP', c.curp)}${dato('Teléfono', c.telefono)}${dato('Celular', c.celular)}${dato('Dirección de cobro', [c.direccion, c.colonia].filter(Boolean).join(', '))}${dato('Dirección del negocio', c.direccion_negocio)}${dato('Fecha de nacimiento', c.fecha_nacimiento)}${dato('Observaciones', c.observaciones)}</div>
    <div class="toolbar">${(() => { const a = mapsUrl(c.lat, c.lng, [c.direccion, c.colonia].filter(Boolean).join(', ')), b = c.direccion_negocio || c.lat_negocio != null ? mapsUrl(c.lat_negocio, c.lng_negocio, c.direccion_negocio) : ''
      return (a ? `<a class="btn ghost sm" href="${a}" target="_blank" rel="noopener">Maps: dirección de cobro</a>` : '') + (b ? `<a class="btn ghost sm" href="${b}" target="_blank" rel="noopener">Maps: negocio</a>` : '')
        + (puede('registrar_pagos') && DB.R[c.ruta_id] ? '<button class="btn ghost sm" type="button" id="fUbi">📍 Guardar ubicación</button>' : '')
        + (puede('reasignar_cartera') && sc.rutas().length > 1 ? '<button class="btn ghost sm" type="button" id="fRuta">Cambiar de ruta</button>' : '') })()}</div>
    <h3 class="sec-title" style="margin-top:6px">Expediente de créditos</h3>
    <div class="tablewrap"><table class="tbl"><thead><tr><th>Crédito</th><th>Tipo</th><th>Inicio</th><th class="num">Base</th><th class="num">Descuento renovación</th><th class="num">Entregado</th><th class="num">Gastos adm.</th><th class="num">Pagadas</th><th class="num">Saldo</th><th>Estado</th></tr></thead><tbody>
    ${cr.map((x) => `<tr class="click" data-pg="${x.credito_id}"><td>#${x.credito_id}${x.credito_anterior_id ? `<div class="muted" style="font-size:12px">renueva #${x.credito_anterior_id}</div>` : ''}</td><td>${tipoChip(x.tipo)}</td><td>${x.fecha_inicio}</td><td class="num">${peso(x.monto)}</td><td class="num">${x.descuento_renovacion ? peso(x.descuento_renovacion) : '—'}</td><td class="num">${peso(x.entregado)}</td><td class="num">${x.seguro ? peso(x.seguro) : '—'}</td><td class="num">${x.cuotas_pagadas}/${x.num_cuotas}</td><td class="num strong">${peso(x.saldo)}</td><td>${estadoChip(x.estado)}</td></tr>`).join('')}
    </tbody></table></div>
    <div id="fpagos"></div>
    <div id="fdocs"></div>
    <div class="note">El expediente se conserva completo (también los créditos liquidados) para auditorías de 6 años. Toca un crédito para ver sus pagos.</div>`)
  if (ft) fotoEn($('#fFoto'), ft.path)
  $('#fUbi')?.addEventListener('click', () => guardarUbicacion(c))
  $('#fRuta')?.addEventListener('click', () => formModal({
    titulo: 'Cambiar de ruta', nota: `${esc(c.cliente)} está en ${esc(c.ruta)} (${esc(c.asesor || '')}). Al cambiarlo, su crédito y su historial pasan al nuevo asesor; el anterior deja de verlo.`, boton: 'Cambiar de ruta',
    campos: [{ id: 'ruta', label: 'Nueva ruta', tipo: 'select', req: 1, opciones: sc.rutas().filter((r) => r.ruta_id !== c.ruta_id).map((r) => [r.ruta_id, `${r.ruta} · ${r.asesor || ''} · ${r.oficina}`]) }],
    guardar: async (v) => { const n = await escribir(() => sb.rpc('reasignar_clientes', { p_clientes: [id], p_ruta: +v.ruta })); return n !== false ? `${c.cliente} ahora está en ${DB.R[+v.ruta]?.ruta || 'la nueva ruta'}.` : '' },
  }))
  const sols = DB.solicitudes.filter((x) => x.cliente_id === id || cr.some((k) => k.credito_id === x.credito_id)).map((x) => ['solicitud', x.id])
  panelDocs($('#fdocs'), 'cliente', id, { puede: puede('subir_documentos'), extra: [...sols, ...cr.map((k) => ['credito', k.credito_id])], titulo: 'Documentos del expediente' })
  const verPagos = (k) => {
    const L = pagos(k)
    $('#fpagos').innerHTML = `<h3 class="sec-title">Pagos del crédito #${k}</h3>` + tabla([{ t: 'Fecha', k: 'fecha' }, { t: 'Tipo', f: (x) => x.tipo === 'liquidacion_renovacion' ? 'Liquidado al renovar' : 'Pago' }, { t: 'Observación', f: (x) => esc(x.observacion || '') }, { t: 'Monto', num: 1, b: 1, f: P('monto'), tot: T('monto') }], L, true)
  }
  $$('[data-pg]').forEach((tr) => tr.addEventListener('click', () => verPagos(+tr.dataset.pg)))
  verPagos(cr[0].credito_id)
  $('#fpago')?.addEventListener('click', () => registrarPago(act[0].credito_id))
  $('#fren')?.addEventListener('click', () => nuevaSolicitud({ renovar: act.find(puedeRenovar).credito_id }))
  $('#frec')?.addEventListener('click', () => nuevaSolicitud({ recompra: cr[0].credito_id }))
}
function modal(inner) {
  const host = $('#modalHost')
  host.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="card">${inner}</div></div>`
  const close = () => { host.innerHTML = ''; document.removeEventListener('keydown', onKey) }
  const onKey = (e) => { if (e.key === 'Escape') close() }
  document.addEventListener('keydown', onKey)
  $('.modal', host).addEventListener('click', (e) => { if (e.target.classList.contains('modal') || e.target.closest('[data-close]')) close() })
}

// ============================================================ mesa de control
// Flujo: borrador → pendiente mesa → (corrección) → autorizada → video de entrega → desembolsada.
// Renovaciones que piden más del 20 % sobre el crédito anterior pasan al gerente zonal (excepción).
const EST_SOL = { borrador: ['Borrador', 'off'], revision: ['Pendiente mesa', 'wait'], observada: ['Corrección solicitada', 'mid'], excepcion: ['Excepción · la autoriza el zonal', 'mid'],
  autorizada: ['Autorizada · falta desembolsar', 'ok'], desembolsada: ['Desembolsada', 'ok'], rechazada: ['Rechazada', 'bad'], cancelada: ['Cancelada', 'off'] }
const estSol = (e) => `<span class="st ${(EST_SOL[e] || ['', 'off'])[1]}">${(EST_SOL[e] || [e])[0]}</span>`
const esMesa = () => puede('resolver_solicitudes')
const esZonalDe = (s) => puede('autorizar_excepciones') && !!DB.R[s.ruta_id]
const puedeDesembolsar = (s) => puede('desembolsar') && !!DB.R[s.ruta_id]
const nombreDe = (uid) => (uid && (DB.perfiles.find((p) => p.id === uid) || {}).nombre) || (uid === DB.perfil.id ? DB.perfil.nombre : '') || ''
const fechaLocal = (ts) => (ts ? iso(new Date(ts)) : '')
const horaLocal = (ts) => (ts ? new Date(ts).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
// Modalidad y porcentaje: los fija el dueño por gerencia (o para toda la empresa)
function condicion(rutaId, frec) {
  const g = DB.R[rutaId]?.gerencia_id
  const L = DB.condiciones.filter((c) => c.frecuencia === frec)
  const c = L.find((x) => x.gerencia_id === g) || L.find((x) => x.gerencia_id == null)
  return c || { interes_pct: PARAM('interes_pct', 50), num_cuotas: PARAM('num_cuotas', 10), activo: frec !== 'diario' }
}
const modalidades = (rutaId) => FRECUENCIAS.filter(([f]) => condicion(rutaId, f).activo)
const condSol = (s) => { const c = condicion(s.ruta_id, s.frecuencia || 'semanal'); return { i: s.interes_pct != null ? +s.interes_pct : c.interes_pct, n: s.num_cuotas != null ? +s.num_cuotas : c.num_cuotas } }
const FREC_TXT = { diario: 'diario', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' }
// Fotos que pide mesa de control en cada solicitud (video de Emmanuel)
const FOTOS_SOL = ['Foto del cliente', 'INE (frente)', 'INE (reverso)', 'Comprobante de domicilio', 'Solicitud firmada', 'Carta de declaración de ingresos',
  'Domicilio (frente)', 'Domicilio (lado derecho)', 'Domicilio (lado izquierdo)', 'Negocio (frente)', 'Negocio (lado derecho)', 'Negocio (lado izquierdo)', 'Video de la mercancía (15 s)']
const FOTOS_OPC = ['Fotos de mercancía', 'Documento opcional 1', 'Documento opcional 2']
const esVideoCat = (c) => /^Video/.test(c)
const fechaDoc = (t) => { const d = new Date(t); return isNaN(d) ? String(t || '').slice(0, 10) : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) }
const docsSol = (id) => DB.documentos.filter((d) => d.tipo === 'solicitud' && d.entidad_id === id)
const faltanFotos = (id) => { const D = docsSol(id); return FOTOS_SOL.filter((f) => !D.some((d) => d.categoria === f)) }
const mapsUrl = (lat, lng, txt) => lat != null && lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  : txt ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(txt)}` : ''
const BANDEJAS = [
  ['revision', 'Pendientes mesa', '#f5b83d', (s) => s.estado === 'revision', 'Ya las mandó el asesor. Ábrela, revisa y decide.'],
  ['excepcion', 'Renovaciones con excepción', '#a27bff', (s) => s.estado === 'excepcion', 'Piden más del ' + 20 + ' % sobre su crédito anterior: las autoriza el gerente zonal.'],
  ['autorizada', 'Autorizadas · falta desembolsar', '#2fbf71', (s) => s.estado === 'autorizada', 'El asesor va con el cliente, graba el video de entrega y desembolsa.'],
  ['hoy', 'Desembolsadas hoy', '#4c8dff', (s) => s.estado === 'desembolsada' && fechaLocal(s.desembolsado) === DB.hoy, ''],
  ['videos', 'Videos de entrega', '#2bb7d6', (s) => s.estado === 'desembolsada' && !!s.video_path, 'El cliente dice en video cuánto recibe y cómo va a pagar.'],
  ['observada', 'Corrección solicitada', '#ff9f43', (s) => s.estado === 'observada', 'Regresaron al asesor para corregir.'],
  ['borrador', 'Borradores', '#8892a6', (s) => s.estado === 'borrador', 'Capturadas, sin enviar a mesa.'],
  ['no', 'Rechazadas y canceladas', '#ff6b6b', (s) => ['rechazada', 'cancelada'].includes(s.estado), 'Se guardan con su motivo, como piden las regulaciones.'],
  ['desembolsada', 'Desembolsadas', '#1fb5a6', (s) => s.estado === 'desembolsada', 'Ya son créditos.'],
]
VIEWS.solicitudes = {
  abiertas: new Set(['revision', 'excepcion']),
  html() {
    const S = sc.solicitudes().slice().sort((a, b) => String(b.creada).localeCompare(String(a.creada)) || b.id - a.id)
    const sig = esMesa() && S.some((s) => s.estado === 'revision')
    const item = (s, k) => `<button type="button" class="sol inset click" data-sol="${s.id}" data-tab="${k === 'videos' ? 'archivos' : 'datos'}">
      <b>${esc(s.cliente_nombre)}</b><span>${peso(s.monto_autorizado ?? s.monto)}${s.monto_autorizado != null && s.monto_autorizado !== s.monto ? ` <s class="muted">${peso(s.monto)}</s>` : ''} · ${TIPO[s.tipo] || 'Nuevo'} · ${FREC_TXT[s.frecuencia] || 'semanal'}</span>
      <span class="muted">Oficina ${esc(s.oficina || '')} · ${esc(s.asesor || '')}${k === 'revision' && s.revision_por ? ' · revisando: ' + esc(nombreDe(s.revision_por) || 'mesa') : ''}${k === 'videos' || k === 'hoy' ? ' · entregado ' + esc(horaLocal(s.desembolsado)) : ''}${['observada', 'no'].includes(k) && s.motivo ? ' · ' + esc(s.motivo) : ''}</span></button>`
    return `${head('Solicitudes', 'Mesa de control: revisa cada solicitud con sus fotos, autoriza, pide corrección o rechaza. El crédito nace cuando el asesor sube el video de entrega.',
      sig ? '<button class="btn" type="button" id="ssig"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>Revisar siguiente pendiente</button>' : '')}
      <div class="bandejas">${BANDEJAS.map(([k, t, c, f, d]) => { const L = S.filter(f)
        return `<details class="card bandeja" style="--c:${c}" data-b="${k}"${this.abiertas.has(k) ? ' open' : ''}><summary><span class="bt">${t}</span><span class="cnt">${L.length}</span></summary>
          ${d ? `<div class="note">${d}</div>` : ''}<div class="list">${L.slice(0, 60).map((s) => item(s, k)).join('') || '<div class="empty"><b>Sin solicitudes</b></div>'}</div></details>` }).join('')}</div>`
  },
  init() {
    $$('[data-sol]').forEach((b) => b.addEventListener('click', () => detalleSolicitud(+b.dataset.sol, b.dataset.tab)))
    $$('details.bandeja').forEach((d) => d.addEventListener('toggle', () => { if (d.open) this.abiertas.add(d.dataset.b); else this.abiertas.delete(d.dataset.b) }))
    $('#ssig')?.addEventListener('click', () => {
      const L = sc.solicitudes().filter((s) => s.estado === 'revision' && (!s.revision_por || s.revision_por === DB.perfil.id)).sort((a, b) => String(a.creada).localeCompare(String(b.creada)) || a.id - b.id)
      if (L.length) detalleSolicitud(L[0].id); else toast('Todas las pendientes ya las está revisando alguien.', 'warn')
    })
  },
}
async function duplicados(curp, nombre) {
  if (sb) {
    const { data, error } = await sb.rpc('buscar_duplicado', { p_curp: curp || '', p_nombre: nombre || '' })
    if (error) throw errorAmigable(error)
    return data || []
  }
  const n = norm(nombre), c = String(curp || '').toUpperCase()
  const cl = [...new Map(DB.cartera.filter((x) => (c && String(x.curp || '').toUpperCase() === c) || (n && norm(x.cliente) === n)).map((x) => [x.cliente_id, x])).values()]
    .map((x) => ({ origen: 'cliente', nombre: x.cliente, ruta: x.ruta, estado: DB.cartera.some((y) => y.cliente_id === x.cliente_id && y.saldo > 0) ? 'con crédito activo' : 'sin crédito activo' }))
  const so = DB.solicitudes.filter((x) => (c && String(x.curp || '').toUpperCase() === c) || (n && norm(x.cliente_nombre) === n)).map((x) => ({ origen: 'solicitud', nombre: x.cliente_nombre, ruta: x.ruta, estado: x.estado }))
  return [...cl, ...so]
}
const dupHtml = (L) => L.length ? `<div class="note-card" style="background:rgba(255,200,87,.12);box-shadow:inset 0 0 0 1px rgba(255,200,87,.45)"><b>Este cliente ya está registrado.</b>
  ${L.map((d) => `<div>${d.origen === 'cliente' ? 'Cliente' : 'Solicitud'}: ${esc(d.nombre)} · ruta ${esc(d.ruta)} · ${esc(EST_SOL[d.estado]?.[0] || d.estado)}</div>`).join('')}</div>` : ''
// Ficha de la solicitud: Datos · Archivos · Historial · Conversación (como la mesa que usan hoy)
function detalleSolicitud(id, tab = 'datos') {
  const s = DB.solicitudes.find((x) => x.id === id); if (!s) return
  const ant = s.credito_anterior_id ? DB.cartera.find((c) => c.credito_id === s.credito_anterior_id) : null
  const cr = s.credito_id ? DB.cartera.find((c) => c.credito_id === s.credito_id) : null
  const k = condSol(s), monto = s.monto_autorizado ?? s.monto
  const desc = cr ? cr.descuento_renovacion : s.tipo === 'renovacion' && ant ? ant.saldo : 0
  const total = monto * (1 + k.i / 100)
  const dato = (l, v) => v ? `<div class="r"><span class="k">${l}</span><span class="v">${v}</span></div>` : ''
  const lugar = (dir, lat, lng) => dir || lat != null ? `${esc(dir || 'Ubicación capturada')}${mapsUrl(lat, lng, dir) ? ` · <a href="${mapsUrl(lat, lng, dir)}" target="_blank" rel="noopener">Abrir en Maps</a>` : ''}` : ''
  const abierta = ['borrador', 'revision', 'observada'].includes(s.estado)
  const faltan = faltanFotos(s.id), msgs = DB.mensajes.filter((m) => m.solicitud_id === s.id)
  const btn = (a, t, cls = 'ghost') => `<button class="btn ${cls}" type="button" data-acc="${a}">${t}</button>`
  const acc = []
  if (s.estado === 'revision' && esMesa()) {
    if (!s.revision_por) acc.push(btn('tomar', 'Comenzar revisión'))
    acc.push(btn('observada', 'Solicitar corrección'), btn('rechazada', 'Rechazar'), btn('cancelada', 'Cancelar (no lo quiso)'), btn('autorizar', 'Autorizar', ''))
  }
  if (s.estado === 'excepcion' && esZonalDe(s)) acc.push(btn('observada', 'Solicitar corrección'), btn('rechazada', 'Rechazar'), btn('autorizar', 'Autorizar excepción', ''))
  if (s.estado === 'autorizada' && (esMesa() || esZonalDe(s))) acc.push(btn('cancelada', 'Cancelar'))
  if (s.estado === 'autorizada' && puedeDesembolsar(s)) acc.push(btn('desembolsar', 'Grabar video y desembolsar', ''))
  if (['borrador', 'observada'].includes(s.estado) && puede('crear_solicitudes')) acc.push(btn('editar', 'Corregir datos'), btn('revision', 'Enviar a mesa de control', ''))
  modal(`<div class="ph"><div><h3 style="font-size:20px">${esc(s.cliente_nombre)}</h3><div class="sub">Solicitud #${s.id} · ${esc(s.ruta || '')} (${esc(s.asesor || '')}) · oficina ${esc(s.oficina || '')} · capturada ${esc(s.creada || '')}</div></div><button class="x" data-close aria-label="Cerrar">×</button></div>
    <div class="toolbar">${estSol(s.estado)} ${tipoChip(s.tipo)} ${s.excepcion && s.estado !== 'excepcion' ? '<span class="chip a">Fue excepción</span>' : ''} ${faltan.length && s.estado !== 'desembolsada' ? `<span class="chip r">Faltan ${faltan.length} fotos</span>` : ''}
      <button class="btn ghost sm" type="button" id="spdf" style="margin-left:auto"><svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="7"/></svg>Expediente PDF</button></div>
    <div class="tabs stabs" id="stabs">${[['datos', 'Datos'], ['archivos', `Archivos (${docsSol(s.id).length})`], ['historial', 'Historial'], ['conversacion', `Conversación${msgs.length ? ' (' + msgs.length + ')' : ''}`]].map(([t, l]) => `<button type="button" data-st="${t}" class="${t === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="sbody"></div>
    <div class="err" id="sErr" role="alert" style="color:var(--red);font-weight:600"></div>
    ${acc.length ? `${SIM ? '<div class="note">Vista de prueba: así ve estos botones quien tiene este cargo. Aquí no guardan nada.</div>' : ''}<div class="toolbar sacc${SIM ? ' simacc' : ''}" style="justify-content:flex-end">${acc.join('')}</div>` : ''}`)
  const pinta = (t) => {
    $$('#stabs button').forEach((b) => b.classList.toggle('on', b.dataset.st === t))
    const el = $('#sbody'); if (!el) return
    if (t === 'datos') {
      el.innerHTML = `<div class="kv">${dato('Monto solicitado', peso(s.monto))}${s.monto_autorizado != null ? dato('Monto autorizado', `<b>${peso(s.monto_autorizado)}</b>`) : ''}
        ${dato('Modalidad', esc(FREC_TXT[s.frecuencia] || 'semanal'))}${dato('Porcentaje', k.i + ' %')}${dato('Pago', `${peso(total / k.n)} × ${k.n}`)}${dato('Total a pagar', peso(total))}
        ${s.tipo === 'renovacion' && ant ? dato('Monto del crédito anterior (#' + s.credito_anterior_id + ')', peso(ant.monto)) + dato('Debe del crédito anterior', peso(desc)) + dato('Se le entrega', peso(monto - desc)) : s.credito_anterior_id ? dato('Crédito anterior', `#${s.credito_anterior_id} · ve la pestaña Historial`) : ''}
        ${dato('Sexo', { H: 'Hombre', M: 'Mujer', X: 'No binario' }[s.sexo] || '')}${dato('Correo', esc(s.correo || ''))}${dato('Teléfono adicional', esc(s.telefono2 || ''))}
        ${(s.referencias || []).map((r, i) => dato('Referencia ' + (i + 1), esc([r.nombre, r.parentesco, r.telefono].filter(Boolean).join(' · ')))).join('')}
        ${dato('Gastos administrativos', peso(PARAM('seguro_monto', 150)) + ' (no cambia la deuda)')}
        ${dato('CURP', esc(s.curp || ''))}${dato('Teléfono', esc(s.telefono || ''))}${dato('Celular', esc(s.celular || ''))}${dato('Fecha de nacimiento', esc(s.fecha_nacimiento || ''))}
        ${dato('Dirección de cobro', lugar([s.direccion, s.colonia].filter(Boolean).join(', '), s.lat, s.lng))}${dato('Dirección del negocio', lugar(s.direccion_negocio, s.lat_negocio, s.lng_negocio))}
        ${dato('Observaciones', esc(s.observaciones || ''))}${dato('Comentario de autorización', esc(s.comentario || ''))}${dato('Motivo', esc(s.motivo || ''))}</div><div id="sdup"></div>`
      if (s.tipo === 'nuevo' && abierta) duplicados(s.curp, s.cliente_nombre).then((L) => { const e = $('#sdup'); if (e) e.innerHTML = dupHtml(L.filter((d) => !(d.origen === 'solicitud' && d.nombre === s.cliente_nombre && d.estado === s.estado))) }).catch(() => {})
    } else if (t === 'archivos') {
      panelFotos(el, s)
    } else if (t === 'historial') {
      el.innerHTML = '<div class="note">Cargando historial del cliente…</div>'
      historialDe(s).then(({ creditos: H, pagos: PG }) => {
      if ($('#stabs .on')?.dataset.st !== 'historial') return
      const a2 = H.find((c) => c.credito_id === s.credito_anterior_id)
      el.innerHTML = H.length ? `<h3 class="sec-title">Créditos del cliente</h3>` + tabla([{ t: 'Crédito', f: (c) => '#' + c.credito_id }, { t: 'Tipo', f: (c) => tipoChip(c.tipo) }, { t: 'Inicio', k: 'fecha_inicio' }, { t: 'Base', num: 1, f: P('monto') }, { t: 'Pagadas', num: 1, f: (c) => `${c.cuotas_pagadas}/${c.num_cuotas}` }, { t: 'Saldo', num: 1, b: 1, f: P('saldo') }, { t: 'Estado', f: (c) => estadoChip(c.estado) }], H)
        + (a2 ? estadoCuenta(a2, PG) : '') : '<div class="empty"><b>Cliente nuevo</b>No tiene créditos anteriores con la empresa.</div>'
      })
    } else {
      const bit = [[s.creada, `Capturada por ${esc(s.asesor || 'el asesor')}`], [s.revision_inicio, s.revision_por ? `Mesa comenzó la revisión · ${esc(nombreDe(s.revision_por))}` : ''],
        [s.autorizado, s.autorizado_por ? `Autorizada por ${peso(s.monto_autorizado)} · ${esc(nombreDe(s.autorizado_por))}` : ''], [s.autorizado, s.excepcion_por ? `Excepción autorizada por el zonal · ${esc(nombreDe(s.excepcion_por))}` : ''],
        [s.revisado, ['rechazada', 'cancelada', 'observada'].includes(s.estado) ? `${EST_SOL[s.estado][0]} · ${esc(s.motivo || '')}` : ''], [s.desembolsado, s.desembolsado ? `Desembolsada con video · ${esc(nombreDe(s.desembolsado_por))}` : '']].filter(([, x]) => x)
      el.innerHTML = `<h3 class="sec-title">Conversación con mesa de control</h3><div class="chat">${msgs.map((m) => `<div class="msg ${m.autor === DB.perfil.id ? 'yo' : ''}"><b>${esc(m.autor_nombre || nombreDe(m.autor) || 'Usuario')}</b><span>${esc(m.texto)}</span><small>${esc(horaLocal(m.creado))}</small></div>`).join('') || '<div class="note">Aún no hay mensajes en este expediente.</div>'}</div>
        <form class="chatform" id="sMsg"><input class="ctl" id="sTxt" maxlength="2000" placeholder="Escribe un mensaje para ${esMesa() ? 'el asesor' : 'mesa de control'}…" autocomplete="off"><button class="btn" type="submit">Enviar</button></form>
        <h3 class="sec-title" style="margin-top:14px">Bitácora</h3><div class="kv">${bit.map(([f, x]) => `<div class="r"><span class="k">${x}</span><span class="v muted">${esc(String(f || '').length > 10 ? horaLocal(f) : f || '')}</span></div>`).join('')}</div>`
      $('#sMsg').addEventListener('submit', async (e) => {
        e.preventDefault(); const txt = $('#sTxt').value.trim(); if (!txt) return
        try { const ok = await escribir(() => sb.from('solicitud_mensajes').insert({ solicitud_id: s.id, texto: txt, autor_nombre: DB.perfil.nombre || null })); if (ok) detalleSolicitud(s.id, 'conversacion') }
        catch (er) { $('#sErr').textContent = er.userMsg || 'No se pudo enviar.' }
      })
    }
  }
  pinta(tab)
  $$('#stabs button').forEach((b) => b.addEventListener('click', () => pinta(b.dataset.st)))
  $('#spdf').addEventListener('click', () => imprimirExpediente(s))
  $$('[data-acc]').forEach((b) => b.addEventListener('click', async () => {
    const a = b.dataset.acc, err = $('#sErr')
    if (a === 'editar') return nuevaSolicitud({ editar: s })
    if (a === 'desembolsar') return grabarVideoEntrega(s)
    if (a === 'revision') {
      if (faltan.length && !b.dataset.ok) { b.dataset.ok = 1; b.textContent = 'Enviar aunque falten fotos'; err.textContent = `Faltan ${faltan.length} fotos: ${faltan.join(', ')}. Mesa puede pedir corrección.`; return }
      try { const ok = await escribir(() => sb.from('solicitudes').update({ estado: 'revision' }).eq('id', s.id)); if (ok) { $('#modalHost').innerHTML = ''; toast('Solicitud enviada a mesa de control.') } } catch (e) { err.textContent = e.userMsg || 'No se pudo enviar.' }
      return
    }
    const rpc = (estado, motivo, montoA) => escribir(() => sb.rpc('resolver_solicitud', { p_id: s.id, p_estado: estado, p_motivo: motivo || null, p_monto: montoA ?? null }))
    if (a === 'tomar') {
      try { const r = await rpc('tomar'); if (r) { toast('Revisión iniciada: el equipo ve que tú la estás revisando.'); detalleSolicitud(s.id, 'archivos') } } catch (e) { err.textContent = e.userMsg || 'No se pudo iniciar la revisión.' }
      return
    }
    if (a === 'autorizar') {
      const antX = ant || (s.credito_anterior_id ? (await historialDe(s)).creditos.find((c) => c.credito_id === s.credito_anterior_id) : null)
      const tope = antX ? antX.monto * (1 + PARAM('excepcion_pct', 20) / 100) : Infinity
      return formModal({
        titulo: s.estado === 'excepcion' ? 'Autorizar excepción (zonal)' : 'Autorizar solicitud',
        nota: `${esc(s.cliente_nombre)} pidió ${peso(s.monto)}. El monto solicitado y el autorizado se guardan por separado.${s.tipo === 'renovacion' && antX && s.estado !== 'excepcion' && !esZonalDe(s) ? ` Si autorizas más de ${peso(tope)} (${PARAM('excepcion_pct', 20)} % sobre su crédito anterior), pasa al gerente zonal.` : ''}${faltan.length ? ` <b>Ojo: faltan ${faltan.length} fotos.</b>` : ''}`,
        boton: 'Confirmar autorización',
        campos: [{ id: 'monto', label: 'Monto autorizado (MXN)', tipo: 'number', min: 500, step: '50', req: 1, valor: s.monto_autorizado ?? s.monto }, { id: 'comentario', label: 'Dictamen o comentario (puedes pegar aquí el dictamen de ChatGPT)', tipo: 'textarea', rows: 6 }],
        guardar: async (v) => {
          const m = +v.monto
          if (!(m >= 500)) { const e = new Error('m'); e.userMsg = 'El monto mínimo es $500.'; throw e }
          const r = await rpc('autorizada', v.comentario, m)
          return r === 'excepcion' ? 'Es una renovación con excepción: pasa al gerente zonal para que la autorice.' : r ? 'Solicitud autorizada. El asesor ya la ve para desembolsarla con el video de entrega.' : ''
        },
      })
    }
    formModal({ titulo: { observada: 'Solicitar corrección', rechazada: 'Rechazar solicitud', cancelada: 'Cancelar solicitud' }[a],
      nota: a === 'observada' ? 'La solicitud regresa al asesor con este mensaje para que corrija o suba lo que falta.' : 'La solicitud y sus datos se conservan con este motivo (regulación).', boton: 'Guardar',
      campos: [{ id: 'motivo', label: a === 'observada' ? 'Qué debe corregir' : 'Motivo', req: 1, tipo: 'textarea' }],
      guardar: async (v) => { const r = await rpc(a, v.motivo); return r ? `Solicitud: ${EST_SOL[a][0].toLowerCase()}.` : '' } })
  }))
}
// Historial del cliente de una solicitud: de la cartera si la ve; si no (mesa), lo pide a la base de datos
const _histSol = new Map()
async function historialDe(s) {
  const ant = s.credito_anterior_id ? DB.cartera.find((c) => c.credito_id === s.credito_anterior_id) : null
  const curp = String(s.curp || '').toUpperCase()
  const cli = s.cliente_id || ant?.cliente_id || (curp ? DB.cartera.find((c) => String(c.curp || '').toUpperCase() === curp)?.cliente_id : null)
  if (cli && DB.cartera.some((c) => c.cliente_id === cli)) return { creditos: DB.cartera.filter((c) => c.cliente_id === cli).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)), pagos: DB.pagos }
  if (!sb) return { creditos: [], pagos: [] }
  if (_histSol.has(s.id)) return _histSol.get(s.id)
  const { data, error } = await sb.rpc('historial_solicitud', { p_id: s.id })
  const num = (o, ks) => ({ ...o, ...Object.fromEntries(ks.map((k) => [k, o[k] == null ? o[k] : +o[k]])) })
  const r = error || !data ? { creditos: [], pagos: [] } : { creditos: (data.creditos || []).map((c) => num(c, ['monto', 'saldo', 'total_pagar', 'cuota', 'entregado', 'descuento_renovacion', 'seguro'])), pagos: (data.pagos || []).map((x) => num(x, ['monto'])) }
  _histSol.set(s.id, r); return r
}
// Estado de cuenta del crédito anterior (para renovaciones): pagos y saldo después de cada uno
function estadoCuenta(c, pagos = DB.pagos) {
  const ps = pagos.filter((x) => x.credito_id === c.credito_id).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
  let saldo = c.total_pagar
  const rows = ps.map((x) => { saldo -= x.monto; return { ...x, saldo: Math.max(0, saldo) } })
  return `<h3 class="sec-title" style="margin-top:14px">Estado de cuenta del crédito anterior #${c.credito_id}</h3>
    <div class="kv">${[['Prestado', peso(c.monto)], ['Total a pagar', peso(c.total_pagar)], ['Pago', peso(c.cuota) + ' × ' + c.num_cuotas + ' (' + (FREC_TXT[c.frecuencia] || '') + ')'], ['Pagado', peso(c.total_pagar - c.saldo) + ` · ${pct(c.total_pagar - c.saldo, c.total_pagar)} %`], ['Debe hoy', peso(c.saldo)], ['Atraso', c.dias_atraso ? c.dias_atraso + ' días' : 'Al día']].map(([l, v]) => `<div class="r"><span class="k">${l}</span><span class="v">${v}</span></div>`).join('')}</div>`
    + tabla([{ t: 'Fecha', k: 'fecha' }, { t: 'Tipo', f: (x) => x.tipo === 'liquidacion_renovacion' ? 'Liquidado al renovar' : 'Pago' }, { t: 'Monto', num: 1, f: P('monto') }, { t: 'Saldo después', num: 1, b: 1, f: P('saldo') }], rows.slice().reverse())
}
// Lista de fotos obligatorias: cada una con su botón de cámara
function panelFotos(el, s) {
  const D = docsSol(s.id), abierta = ['borrador', 'revision', 'observada'].includes(s.estado)
  const sube = abierta && puede('subir_documentos')
  const video = D.find((d) => d.categoria === 'Video de entrega')
  const otros = D.filter((d) => !FOTOS_SOL.includes(d.categoria) && !FOTOS_OPC.includes(d.categoria) && d.categoria !== 'Video de entrega')
  const fila = (cat, opc) => {
    const L = D.filter((d) => d.categoria === cat), ok = L.length > 0, vid = esVideoCat(cat), mult = cat === 'Fotos de mercancía'
    const reus = ok && L.every((d) => d.origen_id)
    return `<div class="foto inset ${ok ? 'ok' : ''}${opc ? ' opc' : ''}${reus ? ' reus' : ''}"><span class="ic">${ok ? '✓' : opc ? '+' : '•'}</span><div class="t">${cat}${opc ? ' <span class="muted">(opcional)</span>' : ''}${L.length > 1 ? ` <span class="muted">(${L.length})</span>` : ''}${reus ? `<span class="chip a reu">♻ del crédito anterior · ${esc(fechaDoc(L[0].creado))}</span>` : ''}</div>
      <div class="b">${L.map((d, i) => `<button type="button" class="btn ghost sm" data-doc="${d.id}">${vid ? 'Ver video' : 'Ver'}${L.length > 1 ? ' ' + (i + 1) : ''}${L.length > 1 && d.origen_id ? ' (anterior)' : ''}</button>`).join('')}
      ${sube && (!ok || mult || reus) ? (vid ? `<label class="btn sm"><input type="file" accept="video/*" capture="environment" data-cat="${esc(cat)}" hidden>Grabar video</label><label class="btn ghost sm"><input type="file" accept="video/*" data-cat="${esc(cat)}" hidden>Subir</label>`
        : `<label class="btn sm"><input type="file" accept="image/*" capture="${cat === 'Foto del cliente' ? 'user' : 'environment'}" data-cat="${esc(cat)}" hidden>${reus ? 'Actualizar' : ok ? 'Otra' : 'Tomar foto'}</label><label class="btn ghost sm"><input type="file" accept="image/*,application/pdf" data-cat="${esc(cat)}" hidden>Subir</label>`) : ''}</div></div>`
  }
  el.innerHTML = `${video ? `<div class="vid inset"><div class="ph"><h3 class="sec-title">Video de entrega</h3><span class="muted">${esc(horaLocal(video.creado))}</span></div><div data-vid></div></div>` : ''}
    <div class="ph"><h3 class="sec-title">Fotos del expediente</h3><span class="chip ${faltanFotos(s.id).length ? 'r' : 'g'}">${FOTOS_SOL.length - faltanFotos(s.id).length} de ${FOTOS_SOL.length}</span></div>
    <div class="fotos">${FOTOS_SOL.map((c) => fila(c)).join('')}${FOTOS_OPC.map((c) => fila(c, true)).join('')}</div>
    ${otros.length ? `<h3 class="sec-title" style="margin-top:10px">Otros documentos</h3><div class="list">${otros.map((d) => `<button type="button" class="rowitem inset docrow" data-doc="${d.id}"><div><div class="t">${esc(d.categoria)}</div><div class="s">${esc(d.nombre)}</div></div><div class="m"><small>Ver</small></div></button>`).join('')}</div>` : ''}
    <div class="muted" data-fmsg></div>
    ${D.some((d) => d.origen_id) ? `<div class="note-card reus"><b>♻ Renovación:</b> la foto del cliente, la INE y el comprobante (si tiene menos de ${PARAM('comprobante_vigencia_dias', 90)} días) se tomaron solos del crédito anterior. ${sube ? 'Si cambió algo, toca <b>Actualizar</b>. ' : ''}Lo demás se toma nuevo para ver cómo está hoy su casa y su negocio.</div>` : ''}
    <div class="note">${sube ? 'Toma cada foto con el celular; se reduce sola para que suba rápido. El video de la mercancía: unos 15 segundos. ' : ''}Se guardan en privado y no se pueden borrar (auditorías de 6 años).</div>`
  $$('[data-doc]', el).forEach((b) => b.addEventListener('click', () => verDocumento(DB.documentos.find((d) => d.id === +b.dataset.doc))))
  if (video) { const box = $('[data-vid]', el); if (sb) blobDe(video.path).then((u) => { box.innerHTML = `<video controls playsinline preload="metadata" src="${u}" style="width:100%;max-height:52vh;border-radius:14px;background:#000"></video>` }).catch(() => { box.innerHTML = '<div class="note">No se pudo cargar el video.</div>' }); else box.innerHTML = '<div class="note">Modo de prueba: sin video.</div>' }
  $$('[data-cat]', el).forEach((inp) => inp.addEventListener('change', async () => {
    const f = inp.files?.[0]; if (!f) return
    const msg = $('[data-fmsg]', el); msg.textContent = `Subiendo ${inp.dataset.cat}…${/^video/.test(f.type) ? ' (los videos tardan un poco más)' : ''}`
    try { const ok = await subirDocumento('solicitud', s.id, inp.dataset.cat, f); if (ok) toast(`${inp.dataset.cat}: guardado.`); panelFotos(el, DB.solicitudes.find((x) => x.id === s.id) || s) }
    catch (e) { msg.textContent = ''; toast(e.userMsg || 'No se pudo subir la foto.', 'warn') }
    inp.value = ''
  }))
}
// Video de entrega: el cliente dice cuánto recibe y cómo paga. Sin video no hay desembolso.
function guionEntrega(s) {
  const k = condSol(s), monto = s.monto_autorizado ?? s.monto, cuota = monto * (1 + k.i / 100) / k.n
  const dia = new Date().toLocaleDateString('es-MX', { weekday: 'long' }), dias = dia.endsWith('s') ? dia : dia + 's'
  const cada = { diario: 'cada día', semanal: 'cada 8 días', quincenal: 'cada 15 días', mensual: 'cada mes' }[s.frecuencia] || 'cada 8 días'
  const plazo = { diario: 'días', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }[s.frecuencia] || 'semanas'
  const hoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  return `Yo, ${s.cliente_nombre}, hoy ${hoy}, recibo un crédito de parte de Nexus Capital por la cantidad de ${peso(monto)}, de los cuales estaré pagando ${peso(cuota)} ${cada}${s.frecuencia === 'semanal' ? ', los días ' + dias : ''}, durante ${k.n} ${plazo}.`
}
function grabarVideoEntrega(s) {
  const guion = guionEntrega(s), monto = s.monto_autorizado ?? s.monto
  const ant = s.tipo === 'renovacion' && s.credito_anterior_id ? DB.cartera.find((c) => c.credito_id === s.credito_anterior_id) : null
  const entrega = monto - (ant ? ant.saldo : 0)
  const puedeGrabar = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)
  modal(`<div class="ph"><div><h3 style="font-size:20px">Video de entrega</h3><div class="sub">${esc(s.cliente_nombre)} · entregas ${peso(entrega)}${ant ? ` (autorizado ${peso(monto)} menos ${peso(ant.saldo)} que debía)` : ''}</div></div><button class="x" data-close aria-label="Cerrar">×</button></div>
    <div class="guion inset"><span class="muted">Pide al cliente que diga, mirando a la cámara:</span><p>“${esc(guion)}”</p></div>
    <div class="cam"><video id="vCam" playsinline muted autoplay></video><span class="rec" id="vRec" hidden>● <b id="vT">0:00</b></span></div>
    <div class="err" id="vErr" role="alert" style="color:var(--red);font-weight:600"></div>
    <div class="toolbar" style="justify-content:flex-end" id="vBtns">
      ${puedeGrabar ? '<button class="btn ghost" type="button" id="vFlip">Cambiar cámara</button><button class="btn" type="button" id="vGo">Empezar a grabar</button>' : ''}
      <label class="btn ${puedeGrabar ? 'ghost' : ''}"><input type="file" accept="video/*" capture="environment" id="vFile" hidden>${puedeGrabar ? 'Usar la cámara del teléfono' : 'Grabar video'}</label>
      <button class="btn" type="button" id="vUp" hidden>Subir video y desembolsar</button></div>
    <div class="note">El video es obligatorio para desembolsar y queda en el expediente. Graba con buena luz; dura de 15 a 60 segundos.</div>`)
  let stream = null, rec = null, chunks = [], blob = null, cara = 'environment', t0 = 0, timer = 0
  const cam = $('#vCam'), err = $('#vErr')
  const parar = () => { clearInterval(timer); try { rec?.state === 'recording' && rec.stop() } catch {} stream?.getTracks().forEach((t) => t.stop()); stream = null }
  const obs = new MutationObserver(() => { if (!document.body.contains(cam)) { parar(); obs.disconnect() } }); obs.observe($('#modalHost'), { childList: true })
  const encender = async () => {
    stream?.getTracks().forEach((t) => t.stop())
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cara, width: { ideal: 640 }, height: { ideal: 480 } }, audio: true })
      cam.srcObject = stream; cam.muted = true; cam.controls = false; await cam.play().catch(() => {})
    } catch (e) { err.textContent = 'No se pudo abrir la cámara. Da permiso de cámara y micrófono, o usa «Usar la cámara del teléfono».' }
  }
  const listo = (b) => {
    blob = b; parar()
    cam.srcObject = null; cam.src = URL.createObjectURL(b); cam.muted = false; cam.controls = true
    $('#vUp').hidden = false; if ($('#vGo')) $('#vGo').textContent = 'Grabar otra vez'
  }
  if (puedeGrabar) {
    encender()
    $('#vFlip').addEventListener('click', () => { cara = cara === 'environment' ? 'user' : 'environment'; if (!rec || rec.state !== 'recording') encender() })
    $('#vGo').addEventListener('click', async () => {
      err.textContent = ''
      if (rec && rec.state === 'recording') { if (Date.now() - t0 < 5000) { err.textContent = 'Graba al menos 5 segundos.'; return } rec.stop(); return }
      if (!stream) await encender(); if (!stream) return
      cam.src = ''; cam.srcObject = stream; cam.muted = true; cam.controls = false; $('#vUp').hidden = true; blob = null
      const tipo = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find((x) => MediaRecorder.isTypeSupported?.(x)) || ''
      chunks = []
      rec = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 900000, audioBitsPerSecond: 64000 })
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => { $('#vRec').hidden = true; $('#vGo').textContent = 'Grabar otra vez'; listo(new Blob(chunks, { type: (rec.mimeType || tipo || 'video/webm').split(';')[0] })) }
      rec.start(1000); t0 = Date.now(); $('#vRec').hidden = false; $('#vGo').textContent = 'Detener'
      timer = setInterval(() => { const x = Math.floor((Date.now() - t0) / 1000); $('#vT').textContent = `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; if (x >= 180) rec.stop() }, 500)
    })
  }
  $('#vFile').addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) listo(f) })
  $('#vUp').addEventListener('click', async () => {
    if (!blob) return
    if (blob.size > 50 * 1024 * 1024) { err.textContent = 'El video pesa más de 50 MB. Graba uno más corto (30 a 60 segundos).'; return }
    const b = $('#vUp'); b.disabled = true; b.textContent = 'Subiendo video…'
    try {
      const tipo = (blob.type || 'video/mp4').split(';')[0], ext = tipo.includes('webm') ? 'webm' : tipo.includes('quicktime') ? 'mov' : 'mp4'
      const path = await subirDocumento('solicitud', s.id, 'Video de entrega', new File([blob], `entrega-${s.id}.${ext}`, { type: tipo }), { volver: true })
      if (!path) { b.disabled = false; b.textContent = 'Subir video y desembolsar'; return }
      b.textContent = 'Creando el crédito…'
      const r = await escribir(() => sb.rpc('desembolsar_solicitud', { p_id: s.id, p_video: path }))
      if (r) { $('#modalHost').innerHTML = ''; toast(`Desembolsado: crédito #${r}. Ya aparece en su ruta.`) }
    } catch (e) { err.textContent = e.userMsg || 'No se pudo desembolsar. Intenta de nuevo.'; b.disabled = false; b.textContent = 'Subir video y desembolsar' }
  })
}
// Expediente en PDF (para revisarlo o pasarlo a la IA): se abre la impresión y se elige «Guardar como PDF»
async function imprimirExpediente(s) {
  const k = condSol(s), monto = s.monto_autorizado ?? s.monto, total = monto * (1 + k.i / 100)
  const HIST = await historialDe(s)
  const ant = HIST.creditos.find((c) => c.credito_id === s.credito_anterior_id) || null
  const D = docsSol(s.id).filter((d) => /^image\//.test(d.mime || ''))
  const r = (l, v) => v ? `<tr><th>${l}</th><td>${v}</td></tr>` : ''
  let host = $('#printHost'); if (!host) { host = document.createElement('div'); host.id = 'printHost'; document.body.appendChild(host) }
  toast('Preparando el expediente…')
  const imgs = []
  for (const d of D) { try { imgs.push([d.categoria + (d.origen_id ? ' · del crédito anterior (' + fechaDoc(d.creado) + ')' : ''), sb ? await blobDe(d.path) : '']) } catch {} }
  const msgs = DB.mensajes.filter((m) => m.solicitud_id === s.id)
  host.innerHTML = `<div class="pg"><img src="logo-nexus.png" alt="Nexus Capital" class="plogo"><h1>Expediente de solicitud #${s.id}</h1>
    <p class="psub">${esc(s.cliente_nombre)} · ${TIPO[s.tipo] || 'Nuevo'} · ${EST_SOL[s.estado]?.[0] || s.estado} · impreso ${new Date().toLocaleString('es-MX')}</p>
    <h2>Solicitud</h2><table>${r('Cliente', esc(s.cliente_nombre))}${r('CURP', esc(s.curp || ''))}${r('Fecha de nacimiento', esc(s.fecha_nacimiento || ''))}${r('Teléfono', esc(s.telefono || ''))}${r('Celular', esc(s.celular || ''))}
      ${r('Dirección de cobro', esc([s.direccion, s.colonia].filter(Boolean).join(', ')) + (s.lat != null ? ` (${s.lat}, ${s.lng})` : ''))}${r('Dirección del negocio', esc(s.direccion_negocio || '') + (s.lat_negocio != null ? ` (${s.lat_negocio}, ${s.lng_negocio})` : ''))}
      ${r('Sexo', { H: 'Hombre', M: 'Mujer', X: 'No binario' }[s.sexo] || '')}${r('Correo', esc(s.correo || ''))}${r('Teléfono adicional', esc(s.telefono2 || ''))}
      ${(s.referencias || []).map((x, i) => r('Referencia ' + (i + 1), esc([x.nombre, x.parentesco, x.telefono].filter(Boolean).join(' · ')))).join('')}
      ${r('Observaciones', esc(s.observaciones || ''))}${r('Asesor', esc(s.asesor || ''))}${r('Ruta / oficina', esc(`${s.ruta || ''} · ${s.oficina || ''} · ${s.gerencia || ''}`))}${r('Capturada', esc(s.creada || ''))}</table>
    <h2>Condiciones</h2><table>${r('Monto solicitado', peso(s.monto))}${s.monto_autorizado != null ? r('Monto autorizado', peso(s.monto_autorizado)) : ''}${r('Modalidad', FREC_TXT[s.frecuencia] || 'semanal')}${r('Porcentaje', k.i + ' %')}
      ${r('Pago', `${peso(total / k.n)} × ${k.n}`)}${r('Total a pagar', peso(total))}${r('Gastos administrativos', peso(PARAM('seguro_monto', 150)))}
      ${ant ? r('Crédito anterior', `#${ant.credito_id} · prestado ${peso(ant.monto)} · debe ${peso(ant.saldo)} · ${pct(ant.total_pagar - ant.saldo, ant.total_pagar)} % pagado`) + r('Se le entrega', peso(monto - (s.estado === 'desembolsada' ? 0 : ant.saldo))) : ''}</table>
    ${HIST.creditos.length ? `<h2>Historial de créditos del cliente</h2><table class="pt"><tr><th>Crédito</th><th>Tipo</th><th>Inicio</th><th>Prestado</th><th>Pagos</th><th>Debe</th></tr>${HIST.creditos.map((c) => `<tr><td>#${c.credito_id}</td><td>${TIPO[c.tipo] || 'Nuevo'}</td><td>${c.fecha_inicio}</td><td>${peso(c.monto)}</td><td>${c.cuotas_pagadas}/${c.num_cuotas}</td><td>${peso(c.saldo)}</td></tr>`).join('')}</table>` : '<h2>Historial</h2><p class="psub">Cliente nuevo: sin créditos anteriores.</p>'}
    ${ant ? `<h2>Estado de cuenta anterior</h2><table class="pt"><tr><th>Fecha</th><th>Monto</th><th>Tipo</th></tr>${HIST.pagos.filter((x) => x.credito_id === ant.credito_id).sort((a, b) => a.fecha.localeCompare(b.fecha)).map((x) => `<tr><td>${x.fecha}</td><td>${peso(x.monto)}</td><td>${x.tipo === 'liquidacion_renovacion' ? 'Liquidado al renovar' : 'Pago'}</td></tr>`).join('')}</table>` : ''}
    ${msgs.length ? `<h2>Conversación con mesa</h2><table>${msgs.map((m) => r(esc(m.autor_nombre || 'Usuario') + ' · ' + esc(horaLocal(m.creado)), esc(m.texto))).join('')}</table>` : ''}
    <h2>Fotos (${imgs.length} de ${FOTOS_SOL.length} requeridas)</h2><p class="psub">Faltan: ${esc(faltanFotos(s.id).join(', ') || 'ninguna')}</p></div>
    ${imgs.map(([c, u]) => `<div class="pg pimg"><h2>${esc(c)}</h2>${u ? `<img src="${u}" alt="${esc(c)}">` : ''}</div>`).join('')}`
  await Promise.all($$('img', host).map((im) => im.complete ? 0 : new Promise((ok) => { im.onload = im.onerror = ok })))
  setTimeout(() => { window.print(); toast('Elige «Guardar como PDF» para descargarlo.') }, 150)
}
// Captura de solicitud: nueva, renovación (al 80 %) o recompra. Revisa duplicados por CURP o nombre.
// La modalidad y el porcentaje los fija el dueño por gerencia: el asesor no los puede cambiar.
function nuevaSolicitud({ renovar, recompra, editar } = {}) {
  const ant = renovar ? DB.cartera.find((c) => c.credito_id === renovar) : recompra ? DB.cartera.find((c) => c.credito_id === recompra) : editar?.credito_anterior_id ? DB.cartera.find((c) => c.credito_id === editar.credito_anterior_id) : null
  const tipo = editar ? editar.tipo : renovar ? 'renovacion' : recompra ? 'recompra' : 'nuevo'
  const rutas = sc.rutas()
  if (!rutas.length) { toast('No tienes rutas en tu ámbito.', 'warn'); return }
  const e = editar || {}
  const ruta0 = tipo === 'nuevo' ? (e.ruta_id ?? rutas[0].ruta_id) : ant.ruta_id
  const mods = modalidades(ruta0)
  if (!mods.length) { toast('Tu gerencia no tiene modalidades activas. Pide al dueño que las configure.', 'warn'); return }
  const geo = (lat, lng) => (lat != null && lng != null ? `${lat},${lng}` : '')
  const campos = []
  const R0 = e.referencias || ant?.referencias || []
  if (tipo === 'nuevo') campos.push(
    { tipo: 'titulo', label: '1 · Datos del cliente' },
    { id: 'curp', label: 'CURP (llena sola la fecha de nacimiento y el sexo)', req: 1, valor: e.curp }, { id: 'nombre', label: 'Nombre completo (nombres y apellidos)', req: 1, valor: e.cliente_nombre },
    { id: 'fnac', label: 'Fecha de nacimiento', tipo: 'date', valor: e.fecha_nacimiento }, { id: 'sexo', label: 'Sexo', tipo: 'select', opciones: [['', '—'], ['M', 'Mujer'], ['H', 'Hombre'], ['X', 'No binario']], valor: e.sexo || '' },
    { id: 'telefono', label: 'Teléfono', tipo: 'tel', req: 1, valor: e.telefono }, { id: 'celular', label: 'Celular (WhatsApp)', tipo: 'tel', valor: e.celular },
    { id: 'tel2', label: 'Teléfono adicional', tipo: 'tel', valor: e.telefono2 }, { id: 'correo', label: 'Correo (opcional)', tipo: 'email', valor: e.correo },
    { id: 'ruta', label: 'Ruta', tipo: 'select', req: 1, opciones: rutas.map((r) => [r.ruta_id, `${r.ruta} · ${r.asesor || ''}`]), valor: ruta0 })
  campos.push({ tipo: 'titulo', label: tipo === 'nuevo' ? '2 · Dónde vive y dónde se le cobra' : 'Domicilio de cobro y negocio' },
    { id: 'geo', label: 'Ubicación de cobro', tipo: 'geo', dir: 'direccion', col: 'colonia', valor: geo(e.lat ?? ant?.lat, e.lng ?? ant?.lng) },
    { id: 'direccion', label: 'Dirección de cobro (calle y número)', req: tipo === 'nuevo' ? 1 : 0, valor: e.direccion ?? ant?.direccion }, { id: 'colonia', label: 'Colonia', valor: e.colonia ?? ant?.colonia },
    { id: 'geon', label: 'Ubicación del negocio', tipo: 'geo', dir: 'negocio', valor: geo(e.lat_negocio ?? ant?.lat_negocio, e.lng_negocio ?? ant?.lng_negocio) },
    { id: 'negocio', label: 'Dirección del negocio', valor: e.direccion_negocio ?? ant?.direccion_negocio },
    { tipo: 'titulo', label: tipo === 'nuevo' ? '3 · Referencias (opcional)' : 'Referencias (opcional)' },
    ...[0, 1].flatMap((i) => [{ id: 'rn' + i, label: `Referencia ${i + 1}: nombre`, valor: R0[i]?.nombre }, { id: 'rp' + i, label: 'Parentesco o relación', valor: R0[i]?.parentesco }, { id: 'rt' + i, label: 'Teléfono', tipo: 'tel', valor: R0[i]?.telefono }]),
    { tipo: 'titulo', label: tipo === 'nuevo' ? '4 · Crédito' : 'Crédito' },
    { id: 'monto', label: 'Monto del crédito (MXN)', tipo: 'number', min: 500, step: '500', req: 1, valor: e.monto ?? (ant ? ant.monto : '') },
    { id: 'frecuencia', label: 'Modalidad', tipo: 'select', req: 1, opciones: mods, valor: mods.some(([f]) => f === (e.frecuencia || ant?.frecuencia)) ? (e.frecuencia || ant?.frecuencia) : mods.some(([f]) => f === 'semanal') ? 'semanal' : mods[0][0] },
    { id: 'obs', label: 'Observaciones', tipo: 'textarea', valor: e.observaciones },
    { id: 'enviar', label: 'Enviar a mesa de control ahora', tipo: 'check', valor: !editar })
  const saldoAnt = tipo === 'renovacion' && ant ? ant.saldo : 0
  let confirmado = false
  formModal({
    titulo: editar ? 'Corregir solicitud' : { nuevo: 'Nuevo crédito', renovacion: 'Renovar crédito', recompra: 'Recompra' }[tipo],
    nota: (tipo === 'renovacion' ? `${esc(ant.cliente)} · debe ${peso(saldoAnt)} del crédito #${ant.credito_id} (prestado ${peso(ant.monto)}). Ese saldo se descuenta de lo que se le entrega.`
      : tipo === 'recompra' ? `${esc(ant.cliente)} · ya liquidó. Se crea un crédito nuevo y queda en su expediente como recompra.`
      : 'Revisamos en toda la empresa que el cliente no esté registrado (por CURP o por nombre).') + ' <span id="fCond"></span> ' + (tipo === 'nuevo' || editar ? '<b>Al guardar se abre la lista de fotos y videos:</b> INE, comprobante, 3 del domicilio, 3 del negocio, foto del cliente y video de su mercancía.'
        : `<b>No se vuelve a subir todo:</b> la foto del cliente, la INE y el comprobante (si tiene menos de ${PARAM('comprobante_vigencia_dias', 90)} días) se toman solos del crédito anterior. Al guardar sólo tomas la solicitud firmada, la carta de ingresos, 3 fotos del domicilio, 3 del negocio y el video de su mercancía.`),
    boton: 'Guardar solicitud', campos,
    guardar: async (v) => {
      const err = (t) => { const x = new Error(t); x.userMsg = t; throw x }
      const monto = +v.monto
      if (!(monto >= 500)) err('El monto mínimo es $500.')
      if (tipo === 'renovacion' && monto <= saldoAnt) err(`El nuevo crédito debe ser mayor a lo que debe (${peso(saldoAnt)}).`)
      if (tipo === 'nuevo') {
        v.curp = v.curp.toUpperCase().replace(/\s+/g, '')
        if (!/^[A-Z]{4}\d{6}[HMX][A-Z]{5}[0-9A-Z]\d$/.test(v.curp)) err('La CURP no tiene el formato correcto (18 caracteres).')
        if (!confirmado) {
          const L = (await duplicados(v.curp, v.nombre)).filter((d) => !(editar && d.origen === 'solicitud' && d.nombre === editar.cliente_nombre))
          if (L.length) { confirmado = true; $('#fmOk').textContent = 'Guardar de todos modos'; $('#fmErr').innerHTML = dupHtml(L); const x = new Error('dup'); x.userMsg = ''; x.html = true; throw x }
        }
      }
      const [lat, lng] = v.geo ? v.geo.split(',').map(Number) : [null, null]
      const [latn, lngn] = v.geon ? v.geon.split(',').map(Number) : [null, null]
      const row = tipo === 'nuevo'
        ? { cliente_nombre: v.nombre, curp: v.curp, fecha_nacimiento: v.fnac || null, telefono: v.telefono, celular: v.celular || null, ruta_id: +v.ruta }
        : { cliente_nombre: ant.cliente, ruta_id: ant.ruta_id, curp: ant.curp || null, telefono: ant.telefono || null, celular: ant.celular || null, ...(editar ? {} : { credito_anterior_id: ant.credito_id, cliente_id: ant.cliente_id }) }
      const refs = [0, 1].map((i) => ({ nombre: v['rn' + i], parentesco: v['rp' + i], telefono: v['rt' + i] })).filter((r) => r.nombre || r.telefono)
      if (tipo === 'nuevo') Object.assign(row, { sexo: v.sexo || null, correo: v.correo || null, telefono2: v.tel2 || null })
      Object.assign(row, { referencias: refs.length ? refs : null, direccion: v.direccion || null, colonia: v.colonia || null, lat, lng, direccion_negocio: v.negocio || null, lat_negocio: latn, lng_negocio: lngn,
        observaciones: v.obs || null, monto, frecuencia: v.frecuencia, tipo, estado: v.enviar ? 'revision' : 'borrador' })
      if (!editar) row.creado_por = DB.perfil.id
      const ok = await escribir(() => editar ? sb.from('solicitudes').update(row).eq('id', editar.id) : sb.from('solicitudes').insert(row).select('id').single())
      if (!ok) return ''
      const nid = editar ? editar.id : ok.id
      if (nid) setTimeout(() => {
        detalleSolicitud(nid, 'archivos')
        const r = docsSol(nid).filter((d) => d.origen_id).length, f = faltanFotos(nid).length
        toast(r ? `Se tomaron ${r} documentos del crédito anterior. Faltan ${f}: casa, negocio, solicitud y mercancía.` : 'Ahora toma las fotos: INE, comprobante, casa, negocio y mercancía.')
      }, 50)
      return v.enviar ? 'Solicitud enviada a mesa de control.' : 'Solicitud guardada como borrador.'
    },
  })
  // La modalidad depende de la gerencia de la ruta; el porcentaje y los pagos se muestran, no se editan
  const fr = $('#f_frecuencia'), ru = $('#f_ruta')
  const cond = () => {
    const rid = ru ? +ru.value : ruta0, c = condicion(rid, fr.value)
    $('#fCond').innerHTML = `<b>Condiciones: ${c.interes_pct} % en ${c.num_cuotas} pagos (${FREC_TXT[fr.value]}).</b> Las fija el dueño por gerencia.`
  }
  ru?.addEventListener('change', () => {
    const L = modalidades(+ru.value), cur = fr.value
    fr.innerHTML = L.map(([v, t]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${t}</option>`).join('')
    cond()
  })
  fr.addEventListener('change', cond); cond()
  // La CURP trae la fecha de nacimiento y el sexo: se llenan solos
  $('#f_curp')?.addEventListener('input', (ev) => {
    const c = ev.target.value.toUpperCase().replace(/\s+/g, ''), m = c.match(/^[A-Z]{4}(\d{2})(\d{2})(\d{2})([HMX])[A-Z]{5}([0-9A-Z])/)
    if (!m) return
    const siglo = /\d/.test(m[5]) ? '19' : '20', f = `${siglo}${m[1]}-${m[2]}-${m[3]}`
    if (!isNaN(new Date(f + 'T12:00:00')) && !$('#f_fnac').value) $('#f_fnac').value = f
    if (!$('#f_sexo').value) $('#f_sexo').value = m[4]
  })
}
VIEWS.originacion = {
  html() {
    const mias = sc.solicitudes().filter((s) => ['borrador', 'revision', 'observada'].includes(s.estado) || (s.creada && s.creada >= addDays(DB.hoy, -30)))
      .sort((a, b) => String(b.creada).localeCompare(String(a.creada)) || b.id - a.id)
    const renov = sc.activos().filter(puedeRenovar).sort((a, b) => a.saldo - b.saldo)
    const liq = porCliente(sc.cartera()).filter((c) => c.saldo === 0).sort((a, b) => a.cliente.localeCompare(b.cliente))
    return `${head('Crear crédito', 'Captura la solicitud del cliente y envíala a mesa de control. Aquí también renuevas al ' + PARAM('renovacion_pct', 80) + ' % de pagos.',
      puede('crear_solicitudes') ? '<button class="btn" type="button" id="onuevo"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Nuevo crédito</button>' : '')}
      ${(() => { const A = sc.solicitudes().filter((s) => s.estado === 'autorizada'), O = sc.solicitudes().filter((s) => s.estado === 'observada')
        const verDes = puede('desembolsar')
        return A.length || O.length || verDes ? `<div class="grid2">
        ${A.length || verDes ? `<div class="card panel aviso ok"><div class="ph"><div><h3>Desembolsos pendientes</h3><div class="sub">Mesa ya las autorizó. Ve con el cliente, graba el video de entrega y desembolsa.</div></div><span class="chip g">${A.length}</span></div>
          <div class="list">${A.map((s) => `<div class="rowitem inset"><div><div class="t">${esc(s.cliente_nombre)}</div><div class="s">${peso(s.monto_autorizado ?? s.monto)} · ${TIPO[s.tipo] || 'Nuevo'} · ${esc(s.ruta || '')}</div></div><div class="m"><small>${puedeDesembolsar(s) ? `<button class="btn sm" type="button" data-des="${s.id}">Grabar video y desembolsar</button>` : ''}</small></div></div>`).join('') || '<div class="empty"><b>Ninguno pendiente</b>Cuando mesa autorice una solicitud tuya, aparece aquí para entregar el dinero.</div>'}</div></div>` : ''}
        ${O.length ? `<div class="card panel aviso"><div class="ph"><div><h3>Mesa pidió corrección</h3><div class="sub">Corrige o sube lo que falta y vuelve a enviar.</div></div><span class="chip a">${O.length}</span></div>
          <div class="list">${O.map((s) => `<button type="button" class="rowitem inset docrow" data-obs="${s.id}"><div><div class="t">${esc(s.cliente_nombre)}</div><div class="s">${esc(s.motivo || '')}</div></div><div class="m"><small>Abrir</small></div></button>`).join('')}</div></div>` : ''}</div>` : '' })()}
      <div class="card panel"><div class="ph"><div><h3>Mis solicitudes</h3><div class="sub">Pendientes y de los últimos 30 días · toca una para verla</div></div><span class="chip">${mias.length}</span></div>
        ${tabla([{ t: 'Cliente', f: (s) => `<b>${esc(s.cliente_nombre)}</b>`, }, { t: 'Tipo', f: (s) => tipoChip(s.tipo) }, { t: 'Monto', num: 1, f: P('monto') }, { t: 'Ruta', k: 'ruta' }, { t: 'Estado', f: (s) => estSol(s.estado) }, { t: 'Fotos', f: (s) => { const n = FOTOS_SOL.length - faltanFotos(s.id).length; return `<span class="chip ${n === FOTOS_SOL.length ? 'g' : 'r'}">📷 ${n}/${FOTOS_SOL.length}</span>` } }, { t: 'Motivo', f: (s) => esc(s.motivo || '') }], mias)}</div>
      <div class="grid2">
        <div class="card panel"><div class="ph"><div><h3>Listos para renovar</h3><div class="sub">Llevan ${PARAM('renovacion_pct', 80)} % o más de sus pagos</div></div><span class="chip g">${renov.length}</span></div>
          <div class="list">${renov.slice(0, 30).map((c) => `<div class="rowitem inset"><div><div class="t">${esc(c.cliente)}</div><div class="s">${esc(c.ruta)} · #${c.credito_id} · ${c.cuotas_pagadas}/${c.num_cuotas} pagos</div></div><div class="m">debe ${peso(c.saldo)}<small><button class="btn sm" type="button" data-ren="${c.credito_id}">Renovar</button></small></div></div>`).join('') || '<div class="empty"><b>Nadie llega todavía al ' + PARAM('renovacion_pct', 80) + ' %</b></div>'}</div></div>
        <div class="card panel"><div class="ph"><div><h3>Recompras</h3><div class="sub">Clientes que ya liquidaron y vuelven a pedir</div></div><input class="ctl" id="oq" placeholder="Buscar cliente…" style="max-width:220px"></div>
          <div class="list" id="oliq"></div></div>
      </div>`
  },
  init() {
    const liq = porCliente(sc.cartera()).filter((c) => c.saldo === 0).sort((a, b) => a.cliente.localeCompare(b.cliente))
    const pinta = (q = '') => {
      const L = liq.filter((c) => !q || norm(c.cliente).includes(norm(q))).slice(0, 25)
      $('#oliq').innerHTML = L.map((c) => { const ult = DB.cartera.filter((x) => x.cliente_id === c.cliente_id).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0]
        return `<div class="rowitem inset"><div><div class="t">${esc(c.cliente)}</div><div class="s">${esc(c.ruta)} · ${c.creditos} crédito(s) liquidado(s)</div></div><div class="m"><small><button class="btn ghost sm" type="button" data-rec="${ult.credito_id}">Recompra</button></small></div></div>` }).join('') || '<div class="empty"><b>Sin clientes liquidados</b></div>'
      $$('[data-rec]').forEach((b) => b.addEventListener('click', () => nuevaSolicitud({ recompra: +b.dataset.rec })))
    }
    pinta()
    $('#oq').addEventListener('input', (e) => pinta(e.target.value))
    $('#onuevo')?.addEventListener('click', () => nuevaSolicitud())
    $$('[data-des]').forEach((b) => b.addEventListener('click', () => grabarVideoEntrega(DB.solicitudes.find((s) => s.id === +b.dataset.des))))
    $$('[data-obs]').forEach((b) => b.addEventListener('click', () => detalleSolicitud(+b.dataset.obs)))
    $$('[data-ren]').forEach((b) => b.addEventListener('click', () => nuevaSolicitud({ renovar: +b.dataset.ren })))
    $$('#view .tbl tbody tr').forEach((tr, i) => { const L = sc.solicitudes().filter((s) => ['borrador', 'revision', 'observada'].includes(s.estado) || (s.creada && s.creada >= addDays(DB.hoy, -30))).sort((a, b) => String(b.creada).localeCompare(String(a.creada)) || b.id - a.id); if (L[i]) { tr.classList.add('click'); tr.addEventListener('click', () => detalleSolicitud(L[i].id)) } })
  },
}

VIEWS.creditos = {
  filtro: 'todos',
  html() {
    const act = sc.activos(), car = sc.cartera(), mes = DB.hoy.slice(0, 8) + '01'
    return `${head('Créditos', 'Cartera con condiciones, calendario de pagos y estado de atraso.')}
      <div class="statrow">${[['Créditos activos', NUM.format(act.length)], ['Colocado este mes', peso(sum(car.filter((c) => c.fecha_inicio >= mes), (c) => c.monto))], ['Renovables hoy', NUM.format(act.filter(puedeRenovar).length)], ['Saldo por cobrar', peso(sum(act, (c) => c.saldo))]]
        .map(([l, v]) => `<div class="card lift"><div class="lab">${l}</div><div class="val">${v}</div></div>`).join('')}</div>
      <div class="card panel">
        <div class="ph"><div class="tabs" id="fil">${[['todos', 'Todos'], ...ESTADOS.map((e) => [e.k, e.n]), ['liquidado', 'Liquidados'], ['renovacion', 'Renovaciones'], ['recompra', 'Recompras']].map(([k, t]) => `<button type="button" data-f="${k}" class="${this.filtro === k ? 'on' : ''}">${t}</button>`).join('')}</div><span class="chip" id="cnt"></span></div>
        <div class="tablewrap"><table class="tbl"><thead><tr><th>Crédito</th><th>Cliente</th><th>Tipo</th><th>Ruta</th><th>Inicio</th><th class="num">Base (prestado)</th><th class="num">Cuota</th><th class="num">Pagadas</th><th class="num">Saldo (debe)</th><th class="num">Atraso</th><th>Estado</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>
        <div class="note">Interés ${PARAM('interes_pct', 50)} % plano en ${PARAM('num_cuotas', 10)} pagos. Se puede renovar al ${PARAM('renovacion_pct', 80)} % de pagos. A cada crédito se le cobran $${PARAM('seguro_monto', 150)} de gastos administrativos que no cambian lo que debe el cliente.</div>
      </div>`
  },
  init() {
    const paint = () => {
      const rows = sc.cartera().filter((c) => this.filtro === 'todos' || c.estado === this.filtro || c.tipo === this.filtro).sort((a, b) => b.dias_atraso - a.dias_atraso || b.saldo - a.saldo)
      $('#cnt').textContent = `${NUM.format(rows.length)} créditos`
      $('#tb').innerHTML = rows.slice(0, 250).map((c) => `<tr class="click" data-id="${c.cliente_id}"><td class="muted">#${c.credito_id}</td><td class="strong">${esc(c.cliente)}</td><td>${tipoChip(c.tipo)}</td><td>${esc(c.ruta)}</td><td>${c.fecha_inicio}</td><td class="num">${peso(c.monto)}</td><td class="num">${peso(c.cuota)}</td><td class="num">${c.cuotas_pagadas}/${c.num_cuotas}</td><td class="num strong">${peso(c.saldo)}</td><td class="num">${c.saldo > 0 ? c.dias_atraso + ' d' : '—'}</td><td>${estadoChip(c.estado)}</td>
        <td class="num">${puedeRenovar(c) && puede('crear_solicitudes') ? `<button class="btn ghost sm" type="button" data-ren="${c.credito_id}">Renovar</button>` : ''}</td></tr>`).join('')
        || '<tr><td colspan="12"><div class="empty"><b>Sin créditos en este filtro</b></div></td></tr>'
      $$('#tb tr.click').forEach((tr) => tr.addEventListener('click', (e) => { if (e.target.closest('[data-ren]')) return; fichaCliente(+tr.dataset.id) }))
      $$('#tb [data-ren]').forEach((b) => b.addEventListener('click', () => nuevaSolicitud({ renovar: +b.dataset.ren })))
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
    this.unaRuta = rows.length === 1 ? rows[0].ruta_id : null
    if (this.unaRuta) return `${head('Mi ruta de cobro', 'Toca «Cobrar» en cada cliente. Los colores dicen cómo va: verde al día, amarillo atrasado, rosa alto riesgo y rojo vencido.')}
      <div class="statrow">${[['Cobrado hoy', peso(tot)], ['Pagos registrados hoy', NUM.format(sum(rows, (r) => r.pagos))], ['Promedio diario', peso(prom)], ['Avance vs promedio', pct(tot, prom) + '%']]
        .map(([l, v]) => `<div class="card lift"><div class="lab">${l}</div><div class="val">${v}</div></div>`).join('')}</div>
      <div class="card panel" id="miRuta"></div><div class="note">Pagos en efectivo. Lo que se registre después de las 18:00 cuenta para el día siguiente.</div>`
    return `${head('Cobranza', 'Cobro en efectivo por ruta: lo cobrado hoy, el ritmo normal de cada ruta y quién trae atraso. Toca una ruta para ver sus clientes por color y en su orden de visita.', puede('registrar_pagos') ? '<button class="btn" type="button" id="cpago"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Registrar pago</button>' : '')}
      <div class="statrow">${[['Cobrado hoy', peso(tot)], ['Pagos registrados hoy', NUM.format(sum(rows, (r) => r.pagos))], ['Promedio diario', peso(prom)], ['Avance vs promedio', pct(tot, prom) + '%']]
        .map(([l, v]) => `<div class="card lift"><div class="lab">${l}</div><div class="val">${v}</div></div>`).join('')}</div>
      <div class="card panel"><div class="ph"><h3>Por ruta</h3></div>
        <div class="tablewrap"><table class="tbl"><thead><tr><th>Ruta</th><th>Asesor</th><th>Oficina</th><th class="num">Cobrado hoy</th><th class="num">Pagos</th><th class="num">Promedio diario</th><th class="num">Avance</th><th class="num">Clientes con atraso</th><th class="num">Saldo en atraso</th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="click" data-ruta="${r.ruta_id}"><td class="strong">${esc(r.ruta)}</td><td>${esc(r.asesor || '')}</td><td>${esc(r.oficina)}</td><td class="num strong">${peso(r.cobrado)}</td><td class="num">${r.pagos}</td><td class="num">${peso(r.prom)}</td><td class="num"><span class="st ${pct(r.cobrado, r.prom) >= 80 ? 'ok' : pct(r.cobrado, r.prom) >= 40 ? 'wait' : 'bad'}">${pct(r.cobrado, r.prom)}%</span></td><td class="num">${r.atN}</td><td class="num">${peso(r.atS)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="3">Total</td><td class="num">${peso(tot)}</td><td class="num">${sum(rows, (r) => r.pagos)}</td><td class="num">${peso(prom)}</td><td class="num">${pct(tot, prom)}%</td><td class="num">${sum(rows, (r) => r.atN)}</td><td class="num">${peso(sum(rows, (r) => r.atS))}</td></tr></tfoot></table></div>
        <div class="note">Pagos en efectivo. Lo que se registre después de las 18:00 cuenta para el día siguiente.</div></div>`
  },
  init() {
    if (this.unaRuta) listaCobro($('#miRuta'), this.unaRuta)
    $('#cpago')?.addEventListener('click', () => registrarPago())
    $$('[data-ruta]').forEach((tr) => tr.addEventListener('click', () => detalleRuta(+tr.dataset.ruta)))
  },
}
// Ruta de cobro del asesor: tarjetas por color (verde al día, amarillo, naranja, rojo), con foto,
// botones a Google Maps (cobro y negocio) y su orden de visita.
const fotoCliente = (cid) => DB.documentos.find((d) => d.categoria === 'Foto del cliente' && /^image\//.test(d.mime || '')
  && ((d.tipo === 'cliente' && d.entidad_id === cid) || (d.tipo === 'solicitud' && DB.solicitudes.some((s) => s.id === d.entidad_id && s.cliente_id === cid))))
function ordenRuta(L) {
  return L.slice().sort((a, b) => (a.orden_ruta ?? 1e9) - (b.orden_ruta ?? 1e9) || a.cliente.localeCompare(b.cliente) || a.credito_id - b.credito_id)
}
function listaCobro(el, rutaId, est = { f: 'todos', ordenar: false }) {
  if (!el) return
  const r = DB.R[rutaId], hoy = DB.hoy
  const pagHoy = new Set(DB.pagos.filter((x) => x.fecha === hoy && x.tipo !== 'liquidacion_renovacion').map((x) => x.credito_id))
  const todos = ordenRuta(DB.cartera.filter((c) => c.ruta_id === rutaId && c.saldo > 0))
  const F = { todos: () => true, pendientes: (c) => !pagHoy.has(c.credito_id), atraso: (c) => c.dias_atraso > 0, pagaron: (c) => pagHoy.has(c.credito_id) }
  const L = est.ordenar ? todos : todos.filter(F[est.f] || F.todos)
  const n = (k) => todos.filter(F[k]).length
  const card = (c, i) => {
    const e = ESTADO[c.estado] || ESTADO.al_dia, foto = fotoCliente(c.cliente_id)
    const cob = mapsUrl(c.lat, c.lng, [c.direccion, c.colonia].filter(Boolean).join(', ')), neg = c.direccion_negocio || c.lat_negocio != null ? mapsUrl(c.lat_negocio, c.lng_negocio, c.direccion_negocio) : ''
    return `<div class="cobro inset${pagHoy.has(c.credito_id) ? ' pago' : ''}" style="--c:${e.c}" data-cc="${c.credito_id}">
      <div class="cfoto">${foto ? `<img alt="" data-ft="${esc(foto.path)}">` : esc(c.cliente.trim().slice(0, 1))}</div>
      <div class="cinfo"><b>${est.ordenar ? `<span class="num-orden">${i + 1}</span>` : ''}${esc(c.cliente)}</b><span>${esc([c.direccion, c.colonia].filter(Boolean).join(', ') || 'Sin dirección')}</span>
        <span class="muted">${e.n}${c.dias_atraso ? ` · ${c.dias_atraso} días` : ''} · ${c.cuotas_pagadas}/${c.num_cuotas} pagos · ${FREC_TXT[c.frecuencia] || ''}</span></div>
      <div class="cmonto"><b>${peso(Math.min(c.cuota, c.saldo))}</b><small>debe ${peso(c.saldo)}</small>${pagHoy.has(c.credito_id) ? '<span class="st ok">Pagó hoy</span>' : ''}</div>
      <div class="cacc">${est.ordenar ? `<button class="btn ghost sm" type="button" data-up="${i}" aria-label="Subir">▲</button><button class="btn ghost sm" type="button" data-dn="${i}" aria-label="Bajar">▼</button>`
        : `${puede('registrar_pagos') ? `<button class="btn sm" type="button" data-cobrar="${c.credito_id}">Cobrar</button>` : ''}
        ${puedeRenovar(c) && puede('crear_solicitudes') ? `<button class="btn sm renov" type="button" data-renov="${c.credito_id}">Renovar</button>` : ''}
        ${cob ? `<a class="btn ghost sm" href="${cob}" target="_blank" rel="noopener">Ir a cobrar</a>` : ''}${neg ? `<a class="btn ghost sm" href="${neg}" target="_blank" rel="noopener">Negocio</a>` : ''}
        ${puede('registrar_pagos') ? `<button class="btn ghost sm${c.lat == null ? ' falta' : ''}" type="button" data-ubi="${c.credito_id}">${c.lat == null ? '📍 Guardar ubicación' : 'Ubicación'}</button>` : ''}
        <button class="btn ghost sm" type="button" data-ficha="${c.cliente_id}">Ficha</button>`}</div></div>`
  }
  el.innerHTML = `<div class="ph"><div><h3>${esc(r?.ruta || 'Ruta')}</h3><div class="sub">${esc(r?.asesor || '')} · ${todos.length} créditos por cobrar · ${pagHoy.size ? [...pagHoy].filter((k) => todos.some((c) => c.credito_id === k)).length + ' ya pagaron hoy' : 'nadie ha pagado hoy'}</div></div>
      ${puede('ordenar_ruta') ? `<div class="toolbar">${est.ordenar ? '<button class="btn ghost sm" type="button" data-ord="no">Cancelar</button><button class="btn sm" type="button" data-ord="ok">Guardar orden</button>' : '<button class="btn ghost sm" type="button" data-ord="si">Ordenar ruta</button>'}</div>` : ''}</div>
    ${est.ordenar ? '<div class="note-card">Acomoda a los clientes en el orden en que pasas a cobrarles. Así aparecen siempre, también para el gerente si sale a cubrir la ruta.</div>'
      : `<div class="tabs ftabs">${[['todos', 'Todos'], ['pendientes', 'Por cobrar hoy'], ['atraso', 'Con atraso'], ['pagaron', 'Pagaron hoy']].map(([k, t]) => `<button type="button" data-fc="${k}" class="${est.f === k ? 'on' : ''}">${t} <span class="muted">${n(k)}</span></button>`).join('')}</div>`}
    <div class="cobros">${L.map(card).join('') || '<div class="empty"><b>Nadie en este filtro</b></div>'}</div>
    <div class="legend-st">${ESTADOS.map((x) => `<span><i style="background:${x.c}"></i>${x.n}</span>`).join('')}</div>`
  $$('[data-ft]', el).forEach((im) => fotoEn(im, im.dataset.ft))
  $$('[data-fc]', el).forEach((b) => b.addEventListener('click', () => listaCobro(el, rutaId, { ...est, f: b.dataset.fc })))
  $$('[data-cobrar]', el).forEach((b) => b.addEventListener('click', () => registrarPago(+b.dataset.cobrar)))
  $$('[data-renov]', el).forEach((b) => b.addEventListener('click', () => nuevaSolicitud({ renovar: +b.dataset.renov })))
  $$('[data-ficha]', el).forEach((b) => b.addEventListener('click', () => fichaCliente(+b.dataset.ficha)))
  $$('[data-ubi]', el).forEach((b) => b.addEventListener('click', () => guardarUbicacion(todos.find((c) => c.credito_id === +b.dataset.ubi), () => listaCobro($('#miRuta') || $('#rCobro'), rutaId, { f: est.f }))))
  const mover = (i, d) => { const j = i + d; if (j < 0 || j >= todos.length) return; [todos[i], todos[j]] = [todos[j], todos[i]]; todos.forEach((c, k) => { DB.cartera.filter((x) => x.cliente_id === c.cliente_id).forEach((x) => { x.orden_ruta = k + 1 }) }); listaCobro(el, rutaId, est) }
  $$('[data-up]', el).forEach((b) => b.addEventListener('click', () => mover(+b.dataset.up, -1)))
  $$('[data-dn]', el).forEach((b) => b.addEventListener('click', () => mover(+b.dataset.dn, 1)))
  $$('[data-ord]', el).forEach((b) => b.addEventListener('click', async () => {
    const a = b.dataset.ord
    if (a === 'si') { est.antes = DB.cartera.filter((c) => c.ruta_id === rutaId).map((c) => [c, c.orden_ruta]); return listaCobro(el, rutaId, { ...est, ordenar: true }) }
    if (a === 'no') { (est.antes || []).forEach(([c, o]) => { c.orden_ruta = o }); return listaCobro(el, rutaId, { f: est.f, ordenar: false }) }
    const ids = [...new Set(todos.map((c) => c.cliente_id))]
    b.disabled = true; b.textContent = 'Guardando…'
    try { const ok = await escribir(() => sb.rpc('ordenar_ruta', { p_ruta: rutaId, p_clientes: ids })); if (ok) toast('Orden de la ruta guardado.'); else listaCobro(el, rutaId, { f: est.f }) }
    catch (e) { toast(e.userMsg || 'No se pudo guardar el orden.', 'warn'); b.disabled = false; b.textContent = 'Guardar orden' }
  }))
}
// Guardar la ubicación de un cliente que ya existe, estando con él (clientes de Listo sin GPS)
function guardarUbicacion(c, alTerminar) {
  const tiene = (t) => t === 'cobro' ? c.lat != null : c.lat_negocio != null
  let tipo = tiene('cobro') && !tiene('negocio') && c.direccion_negocio ? 'negocio' : 'cobro', pos = null, dir = ''
  modal(`<div class="ph"><div><h3 style="font-size:20px">Guardar ubicación</h3><div class="sub">${esc(c.cliente)} · ponte en la puerta del lugar y toca «Tomar ubicación»</div></div><button class="x" data-close aria-label="Cerrar">×</button></div>
    <div class="seg" id="uTipo"><button type="button" data-t="cobro">Dirección de cobro${tiene('cobro') ? ' ✓' : ''}</button><button type="button" data-t="negocio">Negocio${tiene('negocio') ? ' ✓' : ''}</button></div>
    <div class="pinfo" id="uEst"></div>
    <div class="err" id="uErr" role="alert" style="color:var(--red);font-weight:600"></div>
    <div class="toolbar" style="justify-content:flex-end"><button class="btn ghost" type="button" id="uGps"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>Tomar ubicación</button><button class="btn" type="button" id="uOk" disabled>Guardar aquí</button></div>
    <div class="note">Desde ese momento «Ir a cobrar» abre Google Maps justo en este punto, para ti y para quien cubra la ruta.</div>`)
  const pinta = () => {
    $$('#uTipo button').forEach((b) => b.classList.toggle('on', b.dataset.t === tipo))
    const ya = tipo === 'cobro' ? [c.lat, c.lng, [c.direccion, c.colonia].filter(Boolean).join(', ')] : [c.lat_negocio, c.lng_negocio, c.direccion_negocio]
    $('#uEst').innerHTML = pos ? `<b>Ubicación lista</b> · precisión ±${Math.round(pos.acc)} m${dir ? '<br>' + esc(dir) : ''} · <a href="${mapsUrl(pos.lat, pos.lng)}" target="_blank" rel="noopener">ver en el mapa</a>`
      : ya[0] != null ? `Ya tiene ubicación guardada${ya[2] ? ': ' + esc(ya[2]) : ''} · <a href="${mapsUrl(ya[0], ya[1])}" target="_blank" rel="noopener">ver</a>. Si tomas otra, la reemplaza.`
      : `Todavía no tiene ubicación${ya[2] ? ' (sólo la dirección escrita: ' + esc(ya[2]) + ')' : ''}.`
  }
  pinta()
  $$('#uTipo button').forEach((b) => b.addEventListener('click', () => { tipo = b.dataset.t; pinta() }))
  $('#uGps').addEventListener('click', () => {
    const err = $('#uErr'); err.textContent = ''
    if (!navigator.geolocation) { err.textContent = 'Este navegador no da la ubicación.'; return }
    $('#uEst').textContent = 'Buscando ubicación…'
    navigator.geolocation.getCurrentPosition(async (g) => {
      pos = { lat: +g.coords.latitude.toFixed(6), lng: +g.coords.longitude.toFixed(6), acc: g.coords.accuracy }
      $('#uOk').disabled = false; pinta()
      if (pos.acc > 80) err.textContent = 'La señal está débil (más de 80 m). Si puedes, sal a la calle y vuelve a tomarla.'
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}&zoom=18&accept-language=es`)
        const a = (await r.json()).address || {}
        dir = [[a.road || a.pedestrian, a.house_number].filter(Boolean).join(' '), a.neighbourhood || a.suburb || a.quarter].filter(Boolean).join(', ')
        pinta()
      } catch {}
    }, (e) => { $('#uEst').textContent = ''; err.textContent = e.code === 1 ? 'Sin permiso de ubicación: actívalo en el navegador.' : 'No se pudo obtener la ubicación. Intenta al aire libre.' },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  })
  $('#uOk').addEventListener('click', async () => {
    const b = $('#uOk'); b.disabled = true; b.textContent = 'Guardando…'
    try {
      const ok = await escribir(() => sb.rpc('guardar_ubicacion', { p_cliente: c.cliente_id, p_tipo: tipo, p_lat: pos.lat, p_lng: pos.lng, p_direccion: dir || null }))
      if (ok) { $('#modalHost').innerHTML = ''; toast(`Ubicación ${tipo === 'cobro' ? 'de cobro' : 'del negocio'} guardada para ${c.cliente}.`); alTerminar?.() }
      else { b.disabled = false; b.textContent = 'Guardar aquí' }
    } catch (e) { $('#uErr').textContent = e.userMsg || 'No se pudo guardar.'; b.disabled = false; b.textContent = 'Guardar aquí' }
  })
}
function detalleRuta(rutaId) {
  modal(`<div class="ph"><div></div><button class="x" data-close aria-label="Cerrar">×</button></div><div id="rCobro"></div>`)
  listaCobro($('#rCobro'), rutaId)
}
// Registrar pago: primero se ve la información del cliente; después monto, observación y foto (opcional).
// Al guardar se ofrece el comprobante para mandarlo al cliente por WhatsApp.
function registrarPago(creditoId) {
  const act = sc.activos().sort((a, b) => a.cliente.localeCompare(b.cliente))
  if (!act.length) { toast('No hay créditos activos en tu ámbito.', 'warn'); return }
  const c0 = act.find((c) => c.credito_id === creditoId) || null
  const tarde = new Date().getHours() >= 18
  const info = (c) => c ? `<div class="pinfo"><b>${esc(c.cliente)}</b> · crédito #${c.credito_id} · ${estadoChip(c.estado)}<br>Pago ${peso(c.cuota)} · debe ${peso(c.saldo)} · ${c.cuotas_pagadas}/${c.num_cuotas} pagos${c.dias_atraso ? ` · <b style="color:#ff9a9a">${c.dias_atraso} días de atraso</b>` : ''}
    <br>${esc([c.direccion, c.colonia].filter(Boolean).join(', ') || '')}${c.telefono || c.celular ? ' · tel. ' + esc(c.celular || c.telefono) : ''}${c.observaciones ? `<br><span class="muted">${esc(c.observaciones)}</span>` : ''}</div>` : ''
  formModal({
    titulo: 'Registrar pago', boton: 'Registrar abono',
    nota: `<span id="pInfo">${info(c0)}</span>` + (tarde ? 'Ya pasó el cierre de las 18:00: este pago cuenta para mañana.' : 'Se registra con la fecha de hoy y tu usuario. Queda en tu caja hasta el cierre de las 18:00.'),
    campos: [
      ...(c0 ? [] : [{ id: 'credito', label: 'Cliente y crédito', tipo: 'select', req: 1, valor: act[0].credito_id,
        opciones: act.map((c) => [c.credito_id, `${c.cliente} · #${c.credito_id} · pago ${peso(c.cuota)} · debe ${peso(c.saldo)}${c.dias_atraso ? ' · ' + c.dias_atraso + ' d atraso' : ''}`]) }]),
      { id: 'monto', label: 'Monto cobrado (MXN)', tipo: 'number', min: 1, step: '0.01', req: 1, valor: c0 ? Math.min(c0.cuota, c0.saldo) : Math.min(act[0].cuota, act[0].saldo) },
      { id: 'obs', label: 'Observación (opcional)', tipo: 'textarea' },
      { id: 'foto', label: 'Foto (opcional)', tipo: 'foto' },
    ],
    guardar: async (v) => {
      const c = c0 || act.find((x) => x.credito_id === +v.credito), m = +v.monto
      const err = (t) => { const e = new Error(t); e.userMsg = t; throw e }
      if (!(m > 0)) err('El monto debe ser mayor a cero.')
      if (m > c.saldo + 0.01) err(`El pago no puede ser mayor a lo que debe (${peso(c.saldo)}).`)
      if (!sb) { setTimeout(() => ticketPago(c, m, 0, v.obs), 60); return 'Modo de prueba: el pago no se guardó.' }
      const ok = await escribir(() => sb.from('pagos').insert({ credito_id: c.credito_id, monto: m, observacion: v.obs || null }).select('id').single())
      if (!ok) return ''
      if (v.foto) { try { await subirDocumento('credito', c.credito_id, 'Foto del pago', v.foto) } catch (e) { toast('El pago se guardó, pero la foto no se pudo subir.', 'warn') } }
      setTimeout(() => ticketPago(c, m, ok.id, v.obs), 60)
      return `Pago de ${peso(m)} registrado a ${c.cliente}.`
    },
  })
  const sel = $('#f_credito'), mon = $('#f_monto')
  sel?.addEventListener('change', () => { const c = act.find((x) => x.credito_id === +sel.value); if (c) { mon.value = Math.min(c.cuota, c.saldo); $('#pInfo').innerHTML = info(c) } })
  if (sel) $('#pInfo').innerHTML = info(act[0])
}
// Comprobante del abono para el cliente (WhatsApp, compartir o copiar)
function ticketPago(c, monto, folio, obs) {
  const saldo = Math.max(0, c.saldo - monto), pagadas = Math.min(c.num_cuotas, Math.floor((c.total_pagar - saldo) / c.cuota + 1e-4))
  const ahora = new Date().toLocaleString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const txt = `NEXUS CAPITAL MX\nComprobante de pago${folio ? ' · folio ' + folio : ''}\n\nCliente: ${c.cliente}\nCrédito: #${c.credito_id}\nFecha: ${ahora}\nAbono: ${peso(monto)}\nSaldo pendiente: ${peso(saldo)}\nPagos: ${pagadas} de ${c.num_cuotas}\nRecibió: ${DB.perfil.nombre || 'Asesor'}${obs ? '\nNota: ' + obs : ''}\n\n${saldo === 0 ? '¡Crédito liquidado! Gracias por su puntualidad.' : 'Gracias por su pago.'}`
  const tel = String(c.celular || c.telefono || '').replace(/\D/g, ''), wa = tel.length === 10 ? '52' + tel : tel.length === 12 && tel.startsWith('52') ? tel : ''
  modal(`<div class="ph"><div><h3 style="font-size:20px">Comprobante de pago</h3><div class="sub">Mándaselo al cliente</div></div><button class="x" data-close aria-label="Cerrar">×</button></div>
    <pre class="ticket">${esc(txt)}</pre>
    <div class="toolbar" style="justify-content:flex-end">
      <button class="btn ghost" type="button" id="tCopy">Copiar</button>
      ${navigator.share ? '<button class="btn ghost" type="button" id="tShare">Compartir</button>' : ''}
      <a class="btn" href="https://wa.me/${wa}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">${wa ? 'Enviar por WhatsApp' : 'Abrir WhatsApp'}</a></div>
    ${saldo > 0 && (c.total_pagar - saldo) >= c.total_pagar * PARAM('renovacion_pct', 80) / 100 - 0.01 && puede('crear_solicitudes') ? `<div class="note-card renovar"><b>${esc(c.cliente)} ya llegó al ${PARAM('renovacion_pct', 80)} % de sus pagos.</b> ¿Quiere renovar?
      <div class="toolbar" style="margin-top:8px"><button class="btn" type="button" id="tRen">Renovar ahora</button><button class="btn ghost" type="button" data-close>No renovar</button></div></div>` : ''}
    ${wa ? '' : '<div class="note">El cliente no tiene celular registrado: WhatsApp te pedirá elegir el contacto.</div>'}`)
  $('#tCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(txt); toast('Comprobante copiado.') } catch { toast('No se pudo copiar.', 'warn') } })
  $('#tRen')?.addEventListener('click', () => nuevaSolicitud({ renovar: c.credito_id }))
  $('#tShare')?.addEventListener('click', () => navigator.share({ title: 'Comprobante de pago', text: txt }).catch(() => {}))
}
// Modalidad y porcentaje por gerencia (lo decide el dueño). Sin regla propia, la gerencia usa la de la empresa.
function pintarCondiciones(el) {
  const puedeEditar = ['dueno', 'soporte', 'direccion'].includes(DB.perfil.rol)
  const filas = [{ id: null, nombre: 'Toda la empresa (regla general)' }, ...DB.gerencias.map((g) => ({ id: g.id, nombre: g.nombre }))]
  const celda = (g, f) => {
    const propia = DB.condiciones.find((c) => c.gerencia_id === g.id && c.frecuencia === f)
    const c = propia || (g.id != null ? DB.condiciones.find((x) => x.gerencia_id == null && x.frecuencia === f) : null)
    const txt = !c ? '<span class="muted">—</span>' : c.activo ? `${+c.interes_pct} % · ${c.num_cuotas} pagos` : `<span class="muted">${+c.interes_pct} % · ${c.num_cuotas} pagos</span> <em class="chip">apagada</em>`
    return `<td class="${propia || g.id == null ? '' : 'hereda'}">${puedeEditar ? `<button type="button" class="celda" data-cg="${g.id ?? ''}" data-cf="${f}">${txt}</button>` : txt}</td>`
  }
  el.innerHTML = `<div class="card panel"><div class="ph"><div><h3>Modalidades y porcentaje por gerencia</h3><div class="sub">El asesor sólo ve las modalidades activas de su gerencia y no puede cambiar el porcentaje. En gris: usa la regla de la empresa. «Apagada»: ya está configurada pero no se ofrece; tócala para encenderla.</div></div></div>
    <div class="tablewrap"><table class="tbl cond"><thead><tr><th>Gerencia</th>${FRECUENCIAS.map(([, t]) => `<th>${t}</th>`).join('')}</tr></thead><tbody>
    ${filas.map((g) => `<tr><td class="strong">${esc(g.nombre)}</td>${FRECUENCIAS.map(([f]) => celda(g, f)).join('')}</tr>`).join('')}</tbody></table></div>
    ${DB.condiciones.length ? '' : '<div class="note">Falta aplicar la actualización 08 de la base de datos.</div>'}</div>`
  $$('[data-cf]', el).forEach((b) => b.addEventListener('click', () => {
    const gid = b.dataset.cg === '' ? null : +b.dataset.cg, f = b.dataset.cf
    const propia = DB.condiciones.find((c) => c.gerencia_id === gid && c.frecuencia === f)
    const base = propia || DB.condiciones.find((c) => c.gerencia_id == null && c.frecuencia === f) || { interes_pct: PARAM('interes_pct', 50), num_cuotas: PARAM('num_cuotas', 10), activo: true }
    const nom = gid == null ? 'toda la empresa' : DB.gerencias.find((g) => g.id === gid)?.nombre
    formModal({
      titulo: `${FRECUENCIAS.find(([k]) => k === f)[1]} · ${esc(nom)}`,
      nota: gid == null ? 'Regla general: la usan las gerencias que no tienen una propia.' : 'Regla propia de esta gerencia. Deja la casilla de «Usar la regla de la empresa» para quitarla.',
      boton: 'Guardar',
      campos: [{ id: 'activo', label: 'Se ofrece esta modalidad', tipo: 'check', valor: base.activo },
        { id: 'interes', label: 'Porcentaje (interés plano %)', tipo: 'number', min: 0, step: '0.5', req: 1, valor: base.interes_pct },
        { id: 'pagos', label: 'Número de pagos', tipo: 'number', min: 1, step: '1', req: 1, valor: base.num_cuotas },
        ...(gid != null && propia ? [{ id: 'quitar', label: 'Usar la regla de la empresa (quitar la propia)', tipo: 'check', valor: false }] : [])],
      guardar: async (v) => {
        const err = (t) => { const e = new Error(t); e.userMsg = t; throw e }
        if (v.quitar) { const ok = await escribir(() => sb.from('condiciones').delete().eq('id', propia.id)); return ok ? 'La gerencia vuelve a usar la regla de la empresa.' : '' }
        if (!(+v.interes >= 0 && +v.interes <= 300)) err('El porcentaje debe estar entre 0 y 300.')
        if (!(+v.pagos >= 1 && +v.pagos <= 400 && Number.isInteger(+v.pagos))) err('El número de pagos debe ser entero, de 1 a 400.')
        const row = { gerencia_id: gid, frecuencia: f, interes_pct: +v.interes, num_cuotas: +v.pagos, activo: !!v.activo, actualizado: new Date().toISOString(), actualizado_por: DB.perfil.id }
        const ok = await escribir(() => propia ? sb.from('condiciones').update(row).eq('id', propia.id) : sb.from('condiciones').insert(row))
        return ok ? 'Condiciones guardadas. Aplican a las solicitudes nuevas.' : ''
      },
    })
  }))
}

VIEWS.cajas = {
  html() {
    const hoy = DB.hoy, rec = sc.recaudo(), cerrada = new Date().getHours() >= 18, S = saldos(hoy)
    const ger = DB.gerencias.filter((g) => sc.rutas().some((r) => r.gerencia_id === g.id))
    const segHoy = (rid) => sum(DB.movimientos.filter((m) => esGA(m) && m.fecha === hoy && m.caja_destino === 'ruta:' + rid), (m) => m.monto)
    const btns = [puede('registrar_pagos') ? '<button class="btn" type="button" id="kpago"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Registrar pago</button>' : '',
      puede('registrar_gastos') ? '<button class="btn ghost" type="button" id="kgasto">Registrar gasto</button>' : '',
      puede('ver_tesoreria') && (esAdmin() || puede('tesoreria_excedente')) ? '<button class="btn ghost" type="button" id="kteso">Ir a tesorería</button>' : ''].join('')
    return `${head('Cajas', 'Lo que cobra cada asesor entra a su caja; a las 18:00 pasa solo a la caja de su gerente. Lo que se registre después de las 18:00 cuenta para el día siguiente.', btns)}
      <div class="card panel"><h3 class="sec-title">Flujo del efectivo</h3>
        <div class="flow"><div class="node inset"><b>Asesor cobra en ruta</b><span>pagos y gastos administrativos entran a su caja</span></div><div class="arr">→</div><div class="node inset"><b>Cierre 18:00</b><span>traslado automático</span></div><div class="arr">→</div><div class="node inset"><b>Caja del gerente</b><span>recibe y resguarda</span></div><div class="arr">→</div><div class="node inset"><b>Banco</b><span>tesorería retira el excedente</span></div></div></div>
      <div class="grid3">${ger.map((g) => {
        const rg = sc.rutas().filter((r) => r.gerencia_id === g.id)
        const m = sum(rec.filter((x) => x.gerencia_id === g.id && x.fecha === hoy), (x) => x.monto) + sum(rg, (r) => segHoy(r.ruta_id))
        return `<div class="card panel lift"><div class="ph"><div><h3>${esc(g.resp || g.nombre)}</h3><div class="sub">${esc(g.nombre)} · caja ${peso(S.get('gerencia:' + g.id) || 0)}</div></div><span class="st ${cerrada ? 'ok' : 'wait'}">${cerrada ? 'Cerrada' : '18:00'}</span></div>
          <div class="kv">${rg.map((r) => { const c = sum(rec.filter((x) => x.ruta_id === r.ruta_id && x.fecha === hoy), (x) => x.monto), sg = segHoy(r.ruta_id)
            return `<div class="r"><span class="k">${esc(r.asesor || r.ruta)}<div class="muted" style="font-size:12px">cobrado ${peso(c)}${sg ? ' · gastos adm. ' + peso(sg) : ''} · en caja ${peso(S.get('ruta:' + r.ruta_id) || 0)}</div></span><span class="v">${peso(c + sg)}</span></div>` }).join('')}
          <div class="r"><span class="k strong">${cerrada ? 'Recibió el gerente' : 'Recibe el gerente a las 18:00'}</span><span class="v" style="color:var(--teal)">${peso(m)}</span></div></div></div>`
      }).join('')}</div>`
  },
  init() {
    $('#kpago')?.addEventListener('click', () => registrarPago())
    $('#kgasto')?.addEventListener('click', registrarGasto)
    $('#kteso')?.addEventListener('click', () => go('tesoreria'))
  },
}
function registrarGasto() {
  const propias = DB.perfil.rol === 'asesor' ? sc.rutas().map((r) => ['ruta:' + r.ruta_id, cajaNombre('ruta:' + r.ruta_id)])
    : [...new Set(sc.rutas().map((r) => r.gerencia_id))].map((g) => ['gerencia:' + g, cajaNombre('gerencia:' + g)]).concat(esAdmin() ? sc.rutas().map((r) => ['ruta:' + r.ruta_id, cajaNombre('ruta:' + r.ruta_id)]) : [])
  formModal({
    titulo: 'Registrar gasto', nota: 'Sale de la caja y queda en la bitácora con tu usuario.', boton: 'Registrar gasto',
    campos: [{ id: 'caja', label: 'Sale de la caja', tipo: 'select', req: 1, opciones: propias }, { id: 'categoria', label: 'Tipo de gasto', tipo: 'select', req: 1, opciones: [['Gastos de ruta', 'Gasolina / transporte'], ['Papelería', 'Papelería'], ['Otros gastos', 'Otro']] },
      { id: 'concepto', label: 'Concepto', req: 1 }, { id: 'monto', label: 'Monto (MXN)', tipo: 'number', min: 1, step: '0.01', req: 1 }],
    guardar: async (v) => {
      if (!(+v.monto > 0)) { const e = new Error('m'); e.userMsg = 'El monto debe ser mayor a cero.'; throw e }
      const ok = await escribir(() => sb.from('movimientos_tesoreria').insert({ fecha: DB.hoy, tipo: 'egreso', caja_origen: v.caja, caja_destino: 'externo', categoria: v.categoria, concepto: v.concepto, monto: +v.monto, creado_por: DB.perfil.id }))
      return ok ? 'Gasto registrado.' : ''
    },
  })
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
  colocacion: { t: 'Nuevos y renovaciones', d: 'Colocación por asesor: clientes nuevos, renovaciones y recompras.' },
  comisiones: { t: 'Comisiones', d: 'Nuevos: monto fijo por cliente. Renovaciones: porcentaje del dinero entregado.' },
  seguros: { t: 'Gastos administrativos', d: 'Gastos administrativos cobrados por ruta.' },
  medida: { t: 'A la medida', d: 'Elige cómo agrupar, las fechas y las columnas; descárgalo en Excel.' },
}
const RCOLS = {
  clientes: 'Clientes', creditos: 'Créditos activos', base: 'Base prestada', saldo: 'Saldo (deuda)', al_dia: 'Cartera al día', atraso: 'Con atraso', normalidad: 'Normalidad %',
  cobrado: 'Cobrado', nuevos: 'Clientes nuevos', colocado: 'Colocado (base)', renovado: 'Renovaciones (entregado)', seguros: 'Gastos administrativos',
}
VIEWS.reportes = {
  tab: 'general', q: '', desde: null, hasta: null, agrupar: 'ruta', cols: ['clientes', 'base', 'saldo', 'normalidad', 'cobrado', 'nuevos', 'renovado', 'seguros'],
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
    if (!this.desde) { this.hasta = DB.hoy; this.desde = lunes(DB.hoy) }
    const car = sc.cartera(), act = car.filter((c) => c.saldo > 0), R = REPORTES[this.tab]
    const fechas = `<label class="field"><label>Desde</label><input class="ctl" type="date" id="rd" value="${this.desde}" max="${DB.hoy}"></label><label class="field"><label>Hasta</label><input class="ctl" type="date" id="rh" value="${this.hasta}" max="${DB.hoy}"></label>`
    const enRango = (f) => f >= this.desde && f <= this.hasta
    let body = '', exp = null
    const hdr = (extra = '') => `<div class="ph"><div><h3>${R.t}</h3><div class="sub">${R.d} · ${esc(scopeLabel())}</div></div><div class="toolbar">${extra}${puede('descargar_excel') ? '<button class="btn ghost" id="bxls" type="button"><svg viewBox="0 0 24 24"><path d="M12 3v12M8 11l4 4 4-4M4 21h16"/></svg>Excel</button>' : ''}</div></div>`
    const cEst = [
      { t: 'Al día', k: 'al_dia', num: 1, f: P('al_dia'), tot: T('al_dia') }, { t: 'Atrasado', k: 'atrasado', num: 1, f: P('atrasado'), tot: T('atrasado') },
      { t: 'Alto riesgo', k: 'alto_riesgo', num: 1, f: P('alto_riesgo'), tot: T('alto_riesgo') }, { t: 'Vencido', k: 'vencido', num: 1, f: P('vencido'), tot: T('vencido') },
      { t: '% con atraso', num: 1, f: (r) => pct(r.atraso, r.saldo) + '%', tot: (rows) => pct(sum(rows, (r) => r.atraso), sum(rows, (r) => r.saldo)) + '%' },
    ]
    const porAsesor = (L, extra = () => ({})) => { const m = new Map(); sc.rutas().forEach((r) => m.set(r.ruta_id, { ruta: r.ruta, asesor: r.asesor || '', oficina: r.oficina, gerente: r.gerente, ...extra() })); return m }
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
      const cols = [{ t: 'Cliente', k: 'cliente', b: 1 }, { t: 'Código', k: 'codigo' }, { t: 'Ruta', k: 'ruta' }, { t: 'Gerente', k: 'gerente' }, { t: 'Zona', k: 'zona' }, { t: 'Créditos', k: 'activos', num: 1, tot: (r) => sum(r, (x) => x.activos) }, { t: 'Base (prestado)', num: 1, f: P('base'), tot: T('base') }, { t: 'Deuda (saldo)', num: 1, b: 1, f: P('saldo'), tot: T('saldo') }, { t: 'Días atraso', num: 1, f: (r) => r.dias }, { t: 'Estado', f: (r) => estadoChip(r.estado) }]
      body = `<div class="card panel">${hdr(`<input class="ctl" id="rq" placeholder="Buscar cliente…" value="${esc(this.q)}">`)}${tabla(cols, rows.slice(0, 300), true)}${rows.length > 300 ? `<div class="note">Se muestran 300 de ${NUM.format(rows.length)}; la descarga en Excel incluye todos.</div>` : ''}</div>`
      exp = () => csv('deuda_por_cliente', [['Cliente', 'cliente'], ['Código', 'codigo'], ['Ruta', 'ruta'], ['Asesor', 'asesor'], ['Gerente', 'gerente'], ['Zona', 'zona'], ['Créditos activos', 'activos'], ['Base (prestado)', 'base'], ['Deuda (saldo)', 'saldo'], ['Días de atraso', 'dias'], ['Estado', '', (r) => ESTADO[r.estado].n]], rows)
    } else if (this.tab === 'colocacion' || this.tab === 'comisiones') {
      const L = car.filter((c) => enRango(c.fecha_inicio))
      const m = porAsesor(L, () => ({ nuevos: 0, base_nuevos: 0, renov: 0, entregado_ren: 0, base_ren: 0, recompras: 0, base_rec: 0 }))
      L.forEach((c) => { const x = m.get(c.ruta_id); if (!x) return
        if (c.tipo === 'renovacion') { x.renov++; x.entregado_ren += c.entregado; x.base_ren += c.monto } else if (c.tipo === 'recompra') { x.recompras++; x.base_rec += c.monto } else { x.nuevos++; x.base_nuevos += c.monto } })
      const rows = [...m.values()].sort((a, b) => (b.base_nuevos + b.entregado_ren) - (a.base_nuevos + a.entregado_ren))
      const cn = PARAM('comision_nuevo'), cr = PARAM('comision_renovacion_pct')
      rows.forEach((r) => { r.com_n = cn != null ? r.nuevos * cn : null; r.com_r = cr != null ? r.entregado_ren * cr / 100 : null; r.com = (r.com_n || 0) + (r.com_r || 0) })
      const n = (k) => ({ t: '', k, num: 1, tot: (rr) => sum(rr, (x) => x[k]) })
      if (this.tab === 'colocacion') {
        const cols = [{ t: 'Asesor', k: 'asesor', b: 1 }, { t: 'Ruta', k: 'ruta' }, { ...n('nuevos'), t: 'Nuevos' }, { t: 'Base nuevos', num: 1, f: P('base_nuevos'), tot: T('base_nuevos') }, { ...n('renov'), t: 'Renovaciones' },
          { t: 'Renovaciones (base)', num: 1, f: P('base_ren'), tot: T('base_ren') }, { t: 'Renovaciones (entregado)', num: 1, b: 1, f: P('entregado_ren'), tot: T('entregado_ren') }, { ...n('recompras'), t: 'Recompras' }, { t: 'Base recompras', num: 1, f: P('base_rec'), tot: T('base_rec') }]
        body = `<div class="card panel">${hdr(fechas)}${tabla(cols, rows, true)}<div class="note">«Entregado» en renovaciones = nuevo crédito menos lo que debía el cliente.</div></div>`
        exp = () => csv('nuevos_y_renovaciones', [['Asesor', 'asesor'], ['Ruta', 'ruta'], ['Nuevos', 'nuevos'], ['Base nuevos', 'base_nuevos'], ['Renovaciones', 'renov'], ['Renovaciones base', 'base_ren'], ['Renovaciones entregado', 'entregado_ren'], ['Recompras', 'recompras'], ['Base recompras', 'base_rec']], rows)
      } else {
        const falta = cn == null || cr == null
        const cols = [{ t: 'Asesor', k: 'asesor', b: 1 }, { t: 'Ruta', k: 'ruta' }, { ...n('nuevos'), t: 'Clientes nuevos' }, { t: `Comisión nuevos (${cn != null ? peso(cn) + ' c/u' : 'por definir'})`, num: 1, f: (r) => r.com_n == null ? '—' : peso(r.com_n), tot: (rr) => cn == null ? '—' : peso(sum(rr, (x) => x.com_n)) },
          { t: 'Renovaciones (entregado)', num: 1, f: P('entregado_ren'), tot: T('entregado_ren') }, { t: `Comisión renovaciones (${cr != null ? cr + ' %' : 'por definir'})`, num: 1, f: (r) => r.com_r == null ? '—' : peso(r.com_r), tot: (rr) => cr == null ? '—' : peso(sum(rr, (x) => x.com_r)) },
          { ...n('recompras'), t: 'Recompras' }, { t: 'Total a pagar', num: 1, b: 1, f: P('com'), tot: T('com') }]
        const bcom = esAdmin() ? '<button class="btn" type="button" id="rcom">Cambiar comisiones</button>' : ''
        body = `<div class="card panel">${hdr(bcom + fechas)}${falta ? `<div class="note-card"><b>Falta capturar las comisiones.</b> ${esAdmin() ? 'Da clic en «Cambiar comisiones» y pon' : 'El dueño debe capturar'} el monto por cliente nuevo y el porcentaje por renovación.</div>` : ''}${tabla(cols, rows, true)}
          <div class="note">Las recompras se muestran aparte mientras se define si pagan como cliente nuevo o como renovación.</div></div>`
        exp = () => csv('comisiones', [['Asesor', 'asesor'], ['Ruta', 'ruta'], ['Clientes nuevos', 'nuevos'], ['Comisión nuevos', 'com_n'], ['Renovaciones entregado', 'entregado_ren'], ['Comisión renovaciones', 'com_r'], ['Recompras', 'recompras'], ['Total', 'com']], rows)
      }
    } else if (this.tab === 'seguros') {
      const M = DB.movimientos.filter((x) => esGA(x) && enRango(x.fecha) && cajasAmbito().has(x.caja_destino))
      const m = porAsesor(M, () => ({ n: 0, monto: 0 }))
      M.forEach((x) => { const y = m.get(+x.caja_destino.split(':')[1]); if (y) { y.n++; y.monto += x.monto } })
      const rows = [...m.values()].sort((a, b) => b.monto - a.monto)
      const sem = new Map(); M.forEach((x) => { const k = lunes(x.fecha); sem.set(k, (sem.get(k) || 0) + x.monto) })
      const semanas = [...sem.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => ({ semana: 'Semana del ' + fechaCorta(k), monto: v }))
      body = `<div class="card panel">${hdr(fechas)}<div class="grid-rep">${[['Total cobrado', peso(sum(rows, (r) => r.monto))], ['Créditos con gastos adm.', NUM.format(sum(rows, (r) => r.n))], ['Por crédito', peso(PARAM('seguro_monto', 150))]].map(([l, v]) => `<div class="mini inset"><div class="lab">${l}</div><div class="val">${v}</div></div>`).join('')}</div>
        ${tabla([{ t: 'Asesor', k: 'asesor', b: 1 }, { t: 'Ruta', k: 'ruta' }, { t: 'Créditos', k: 'n', num: 1, tot: (r) => sum(r, (x) => x.n) }, { t: 'Gastos adm. cobrados', num: 1, b: 1, f: P('monto'), tot: T('monto') }], rows, true)}
        <h3 class="sec-title">Por semana</h3>${tabla([{ t: 'Semana', k: 'semana', b: 1 }, { t: 'Cobrado', num: 1, f: P('monto'), tot: T('monto') }], semanas, true)}
        <div class="note">Los gastos administrativos entran a la caja del asesor; la deuda del cliente no cambia.</div></div>`
      exp = () => csv('gastos_administrativos', [['Asesor', 'asesor'], ['Ruta', 'ruta'], ['Créditos', 'n'], ['Gastos administrativos', 'monto']], rows)
    } else if (this.tab === 'medida') {
      const key = this.agrupar, idk = key === 'cliente' ? 'cliente_id' : key + '_id', namek = { zona: 'zona', gerencia: 'gerencia', oficina: 'oficina', ruta: 'ruta', cliente: 'cliente' }[key]
      const m = new Map(), get = (c) => { let y = m.get(c[idk]); if (!y) { y = { nombre: c[namek], resp: key === 'ruta' ? c.asesor : key === 'gerencia' || key === 'oficina' ? c.gerente : key === 'zona' ? c.zonal : c.ruta, cli: new Set(), creditos: 0, base: 0, saldo: 0, al_dia: 0, cobrado: 0, nuevosS: new Set(), colocado: 0, renovado: 0, seguros: 0 }; m.set(c[idk], y) } return y }
      act.forEach((c) => { const y = get(c); y.cli.add(c.cliente_id); y.creditos++; y.base += c.monto; y.saldo += c.saldo; if (alDia(c)) y.al_dia += c.saldo })
      car.filter((c) => enRango(c.fecha_inicio)).forEach((c) => { const y = get(c); if (c.tipo === 'renovacion') y.renovado += c.entregado; else { y.colocado += c.monto; if (c.tipo === 'nuevo') y.nuevosS.add(c.cliente_id) } if (c.seguro) y.seguros += c.seguro })
      const C = new Map(car.map((c) => [c.credito_id, c]))
      DB.pagos.filter((x) => x.tipo !== 'liquidacion_renovacion' && enRango(x.fecha)).forEach((x) => { const c = C.get(x.credito_id); if (c) get(c).cobrado += x.monto })
      const rows = [...m.values()].map((y) => ({ ...y, clientes: y.cli.size, nuevos: y.nuevosS.size, atraso: y.saldo - y.al_dia, normalidad: y.saldo ? Math.round((y.al_dia / y.saldo) * 100) : 0 })).sort((a, b) => b.saldo - a.saldo)
      const money = ['base', 'saldo', 'al_dia', 'atraso', 'cobrado', 'colocado', 'renovado', 'seguros']
      const cols = [{ t: { zona: 'Zona', gerencia: 'Gerencia', oficina: 'Oficina', ruta: 'Ruta', cliente: 'Cliente' }[key], k: 'nombre', b: 1 }, { t: { ruta: 'Asesor', cliente: 'Ruta', zona: 'Zonal' }[key] || 'Gerente', k: 'resp' },
        ...this.cols.map((k) => k === 'normalidad' ? { t: RCOLS[k], num: 1, f: (r) => r.normalidad + '%', tot: (rr) => Math.round((sum(rr, (x) => x.al_dia) / Math.max(1, sum(rr, (x) => x.saldo))) * 100) + '%' }
          : money.includes(k) ? { t: RCOLS[k], num: 1, f: P(k), tot: T(k) } : { t: RCOLS[k], k, num: 1, tot: (rr) => sum(rr, (x) => x[k]) })]
      const ctrl = `<label class="field sel"><label>Agrupar por</label><select class="ctl" id="rag">${[['zona', 'Zona'], ['gerencia', 'Gerencia'], ['oficina', 'Oficina'], ['ruta', 'Ruta / asesor'], ['cliente', 'Cliente']].map(([k, t]) => `<option value="${k}"${k === key ? ' selected' : ''}>${t}</option>`).join('')}</select></label>${fechas}`
      body = `<div class="card panel">${hdr(ctrl)}<div class="toolbar">${Object.entries(RCOLS).map(([k, t]) => `<label class="fl chk" style="display:inline-flex;font-size:12.5px"><input type="checkbox" data-col="${k}"${this.cols.includes(k) ? ' checked' : ''}> <span>${t}</span></label>`).join('')}</div>
        ${tabla(cols, rows.slice(0, 400), true)}<div class="note">Saldos y cartera: al día de hoy. Cobrado, colocado, renovaciones y gastos administrativos: entre las fechas elegidas. ${esc(scopeLabel())}.</div></div>`
      exp = () => csv('reporte_a_la_medida', [[cols[0].t, 'nombre'], [cols[1].t, 'resp'], ...this.cols.map((k) => [RCOLS[k], k])], rows)
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
    $('#rd')?.addEventListener('change', (e) => { if (e.target.value) { this.desde = e.target.value; this.paint() } })
    $('#rh')?.addEventListener('change', (e) => { if (e.target.value) { this.hasta = e.target.value; this.paint() } })
    $('#rag')?.addEventListener('change', (e) => { this.agrupar = e.target.value; this.paint() })
    $('#rcom')?.addEventListener('click', editarComisiones)
    $$('[data-col]').forEach((c) => c.addEventListener('change', () => { this.cols = Object.keys(RCOLS).filter((k) => $(`[data-col="${k}"]`).checked); this.paint() }))
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
      <div class="tabs" id="atabs">${[['usuarios', 'Usuarios'], ['permisos', 'Permisos'], ['modalidades', 'Modalidades y %'], ['estructura', 'Estructura'], ['personal', 'Personal'], ['parametros', 'Parámetros'], ['peticiones', 'Peticiones'], ['bitacora', 'Bitácora']].map(([k, t]) => `<button type="button" data-t="${k}" class="${this.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
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
        ['Asesor de crédito', 'Su ruta: crea créditos, registra cobros y su caja'], ['Mesa de control', 'Empresa externa: sólo ve las solicitudes y el historial del cliente de cada una; autoriza, pide corrección, rechaza o cancela'], ['Tesorería', 'Pasa el excedente de la caja de los gerentes al banco; ve bancos y movimientos'], ['Consulta / auditoría', 'Sólo lectura dentro de su ámbito']]
      const lista = DB.perfiles.length ? DB.perfiles : [p]
      const amb = (a) => !a || a === 'empresa' ? 'Toda la empresa' : ambitoNombre(a)
      el.innerHTML = `<div class="card panel"><div class="ph"><div><h3>Usuarios</h3><div class="sub">Cada usuario tiene un cargo y un ámbito: sólo ve lo que le toca. Los permisos se validan en la base de datos.</div></div>
          ${esAdmin() ? '<button class="btn" type="button" id="uinv"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Invitar usuario</button>' : ''}</div>
          <div class="tablewrap"><table class="tbl"><thead><tr><th>Nombre</th><th>Correo</th><th>Cargo</th><th>Ámbito</th><th>Estado</th><th></th></tr></thead><tbody>
          ${lista.map((u) => `<tr><td class="strong">${esc(u.nombre || '')}${u.id === p.id ? ' <span class="chip">tú</span>' : ''}</td><td>${esc(u.correo || '')}</td><td>${esc(ROLES[u.rol] || u.rol || '')}</td><td>${esc(amb(u.ambito))}</td>
            <td><span class="st ${u.activo ? 'ok' : 'off'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td class="num">${esAdmin() && u.id !== p.id && u.rol !== 'soporte' ? `<button class="btn ghost sm" type="button" data-edit="${esc(u.id)}">Editar</button>` : ''}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="note">Los usuarios nuevos reciben un correo para crear su contraseña. Entran con el cargo y las rutas que les asignes; si a un asesor le cambias la ruta, desde ese momento ve la nueva y deja de ver la anterior. Lo que cada cargo puede ver y hacer se decide en la pestaña <b>Permisos</b>.</div></div>
        <div class="card panel"><div class="ph"><h3>Cargos del sistema</h3><span class="chip">región → zona → gerencia → oficina → ruta</span></div>
          ${roles.map(([n, d]) => `<div class="rolerow inset"><div><div class="rn">${n}</div><div class="rd">${d}</div></div><div class="cap">Permisos validados en la base de datos</div></div>`).join('')}</div>`
      $('#uinv')?.addEventListener('click', invitarUsuario)
      $$('[data-edit]').forEach((b) => b.addEventListener('click', () => editarUsuario(DB.perfiles.find((u) => u.id === b.dataset.edit))))
    } else if (this.tab === 'permisos') {
      el.innerHTML = '<div id="permisos"></div><div id="permPers"></div>'; pintarPermisos(); pintarPermisosPersona()
    } else if (this.tab === 'modalidades') {
      el.innerHTML = '<div id="pcond"></div>'; pintarCondiciones($('#pcond'))
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
    } else if (this.tab === 'personal') {
      const P6 = (f) => addDays(f, 365 * 6)
      const act = DB.personal.filter((x) => !x.fecha_baja), bajas = DB.personal.filter((x) => x.fecha_baja)
      const foto = (x) => DB.documentos.find((d) => d.tipo === 'personal' && d.entidad_id === x.id && d.categoria === 'Foto')
      const fila = (x) => `<tr><td class="strong"><span class="perfoto">${foto(x) ? `<img data-foto="${esc(foto(x).path)}" alt="">` : esc((x.nombre || '?').slice(0, 1))}</span>${esc(x.nombre)}</td><td>${esc(x.puesto)}</td><td>${esc(x.ambito ? ambitoNombre(x.ambito) : '')}</td><td>${esc(x.curp || '')}</td><td>${esc(x.telefono || '')}</td><td>${esc(x.correo || '')}</td><td>${esc(x.fecha_ingreso || '')}</td>
        <td>${x.fecha_baja ? `<span class="st off">Baja ${esc(x.fecha_baja)}</span><div class="muted" style="font-size:12px">${esc(x.motivo_baja || '')} · se guarda hasta ${P6(x.fecha_baja)}</div>` : '<span class="st ok">Activo</span>'}</td>
        <td class="num">${esAdmin() ? `<button class="btn ghost sm" type="button" data-per="${x.id}">Expediente</button>${x.fecha_baja ? '' : ` <button class="btn ghost sm" type="button" data-baja="${x.id}">Dar de baja</button>`}` : ''}</td></tr>`
      const head = '<thead><tr><th>Nombre</th><th>Puesto</th><th>Ámbito</th><th>CURP</th><th>Teléfono</th><th>Correo</th><th>Ingreso</th><th>Estado</th><th></th></tr></thead>'
      el.innerHTML = `<div class="card panel"><div class="ph"><div><h3>Personal activo</h3><div class="sub">Expediente de asesores, gerentes y demás personal</div></div>${esAdmin() ? '<button class="btn" type="button" id="pnuevo"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Agregar persona</button>' : ''}</div>
          <div class="tablewrap"><table class="tbl">${head}<tbody>${act.map(fila).join('') || '<tr><td colspan="9"><div class="empty"><b>Sin personal registrado</b></div></td></tr>'}</tbody></table></div></div>
        <div class="card panel"><div class="ph"><div><h3>Personal dado de baja</h3><div class="sub">Se conserva 6 años por auditoría: foto, nombre, fecha de nacimiento, CURP, dirección, teléfono y correo</div></div><span class="chip">${bajas.length}</span></div>
          <div class="tablewrap"><table class="tbl">${head}<tbody>${bajas.map(fila).join('') || '<tr><td colspan="9"><div class="empty"><b>Sin bajas</b></div></td></tr>'}</tbody></table></div>
          <div class="note">Dar de baja no borra a la persona: sólo marca la fecha y el motivo. Recuerda desactivar también su usuario en «Usuarios y roles».</div></div>`
      $('#pnuevo')?.addEventListener('click', () => editarPersona())
      $$('[data-per]').forEach((b) => b.addEventListener('click', () => fichaPersona(DB.personal.find((x) => x.id === +b.dataset.per))))
      $$('[data-foto]').forEach((img) => fotoEn(img, img.dataset.foto))
      $$('[data-baja]').forEach((b) => b.addEventListener('click', () => bajaPersona(DB.personal.find((x) => x.id === +b.dataset.baja))))
    } else if (this.tab === 'parametros') {
      const L = DB.parametros.slice().sort((a, b) => a.clave.localeCompare(b.clave))
      const fmt = (x) => x.valor == null ? '<span class="pend">por definir</span>' : /pct|_pct|meta/.test(x.clave) ? x.valor + ' %' : /monto|comision_nuevo/.test(x.clave) ? peso(x.valor) : /dias/.test(x.clave) ? x.valor + ' días' : x.valor
      const fijos = [['Hora de cierre de caja', '18:00 (lo que se registre después cuenta para el día siguiente)'], ['Rangos de atraso', '<span class="pend">provisional: 1–7 · 8–30 · +30 días</span>'], ['Respaldos', 'base de datos: diaria, se guardan 7 días · fotos y videos: espacio privado que no se borra desde el portal']]
      el.innerHTML = `<div class="card panel"><div class="ph"><div><h3>Parámetros del negocio</h3><div class="sub">Se aplican a los créditos nuevos desde que se cambian</div></div></div>
        <div class="kv">${L.map((x) => `<div class="r"><span class="k">${esc(x.descripcion)}</span><span class="v">${fmt(x)} ${esAdmin() ? `<button class="btn ghost sm" type="button" data-par="${esc(x.clave)}" style="margin-left:8px">Cambiar</button>` : ''}</span></div>`).join('') || '<div class="empty"><b>Falta aplicar la actualización de la base de datos</b></div>'}
        ${fijos.map(([k, v]) => `<div class="r"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
        <div class="r"><span class="k">Modalidades (diario, semanal, quincenal, mensual) y porcentaje por gerencia</span><span class="v"><button class="btn ghost sm" type="button" id="irMod">Ir a «Modalidades y %»</button></span></div></div></div>`
      $('#irMod')?.addEventListener('click', () => { this.tab = 'modalidades'; render() })
      $$('[data-par]').forEach((b) => b.addEventListener('click', () => { const x = DB.parametros.find((y) => y.clave === b.dataset.par)
        formModal({ titulo: 'Cambiar parámetro', nota: esc(x.descripcion), campos: [{ id: 'valor', label: 'Valor', tipo: 'number', step: 'any', min: 0, valor: x.valor ?? '' }],
          guardar: async (v) => { const ok = await escribir(() => sb.from('parametros').update({ valor: v.valor === '' ? null : +v.valor }).eq('clave', x.clave)); return ok ? 'Parámetro actualizado.' : '' } }) }))
    } else if (this.tab === 'peticiones') {
      const L = DB.peticiones, quien = (id) => (DB.perfiles.find((u) => u.id === id) || {}).nombre
      const EP = { nueva: ['Nueva', 'wait'], en_proceso: ['En proceso', 'mid'], lista: ['Lista', 'ok'], descartada: ['Descartada', 'off'] }
      el.innerHTML = `<div class="card panel"><div class="ph"><div><h3>Peticiones y mejoras</h3><div class="sub">Lo que se pide desde el botón «Enviar petición» del menú; le llega al equipo de NXUS AI</div></div><button class="btn" type="button" id="ppet">Enviar petición</button></div>
        ${tabla([{ t: 'Fecha', f: (x) => esc(String(x.creado || '').slice(0, 10)) }, { t: 'Quién', f: (x) => esc(x.nombre || quien(x.creado_por) || '') }, { t: 'Sección', f: (x) => esc(x.seccion || '') }, { t: 'Petición', f: (x) => esc(x.texto) },
          { t: 'Estado', f: (x) => `<span class="st ${(EP[x.estado] || EP.nueva)[1]}">${(EP[x.estado] || EP.nueva)[0]}</span>` },
          { t: '', f: (x) => DB.perfil.rol === 'soporte' ? `<select class="ctl" data-pet="${x.id}" style="height:34px">${Object.entries(EP).map(([k, [t]]) => `<option value="${k}"${k === x.estado ? ' selected' : ''}>${t}</option>`).join('')}</select>` : '' }], L)}</div>`
      $('#ppet').addEventListener('click', enviarPeticion)
      $$('[data-pet]').forEach((sel) => sel.addEventListener('change', async () => { try { await escribir(() => sb.from('peticiones').update({ estado: sel.value }).eq('id', +sel.dataset.pet)); toast('Petición actualizada.') } catch (e) { toast(e.userMsg || 'No se pudo actualizar.', 'warn') } }))
    } else {
      // Bitácora: la escribe la base de datos sola en cada acción importante; nadie la edita.
      const NP = Object.fromEntries(PERMISOS.flatMap(([, L]) => L)), quien = (id) => id ? (DB.perfiles.find((u) => u.id === id)?.nombre || 'Usuario') : 'Sistema'
      const det = (t) => esc(t || '').replace(/\b(ver_[a-z_]+|registrar_[a-z_]+|crear_[a-z_]+|resolver_[a-z_]+|autorizar_[a-z_]+|reasignar_[a-z_]+|ordenar_[a-z_]+|subir_[a-z_]+|descargar_[a-z_]+|capturar_[a-z_]+|tesoreria_[a-z_]+|desembolsar)\b/g, (k) => NP[k] ? '«' + NP[k] + '»' : k)
        .replace(/^(dueno|direccion|regional|zonal|gerente|asesor|mesa|tesoreria|consulta):/, (m, r) => (ROLES[r] || r) + ':')
      const L = DB.bitacora || [], q = (this.qb || '').toLowerCase()
      const F = L.filter((x) => !q || [quien(x.usuario), x.accion, x.detalle].join(' ').toLowerCase().includes(q))
      el.innerHTML = `<div class="card panel"><div class="ph"><div><h3>Bitácora</h3><div class="sub">La base de datos registra sola cada acción importante: quién, cuándo y qué. Nadie la puede editar ni borrar. Últimos 120 días.</div></div><span class="chip">${L.length} eventos</span></div>
        <input class="ctl" id="bq" placeholder="Buscar por persona, acción o cliente…" value="${esc(this.qb || '')}">
        ${L.length ? tabla([{ t: 'Cuándo', f: (x) => esc(horaLocal(x.cuando)) }, { t: 'Quién', f: (x) => `<b>${esc(quien(x.usuario))}</b>` }, { t: 'Acción', k: 'accion' }, { t: 'Detalle', f: (x) => det(x.detalle) }], F.slice(0, 300))
          : '<div class="empty"><b>Sin eventos todavía</b>Desde que se activa, cada pago, solicitud, desembolso, movimiento de dinero, cambio de usuario, permiso, parámetro o modalidad queda aquí.</div>'}</div>`
      $('#bq')?.addEventListener('input', (e) => { this.qb = e.target.value; const pos = e.target.selectionStart; this.paint ? this.paint() : render(); const i = $('#bq'); if (i) { i.focus(); i.setSelectionRange(pos, pos) } })
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
    if (c.tipo === 'foto') return `<div class="fl"><span>${c.label}</span><div class="geo"><label class="btn ghost sm"><input type="file" accept="image/*" capture="environment" id="${id}" hidden onchange="this.closest('.geo').querySelector('.muted').textContent = this.files[0] ? 'Foto lista ✓' : ''">Tomar foto</label><span class="muted"></span></div></div>`
    if (c.tipo === 'multi') {
      const sel = new Set(String(c.valor || '').split(',').filter(Boolean))
      let g = ''
      return `<div class="fl"><span>${c.label}${c.req ? ' *' : ''}</span><div class="multi" id="${id}">${c.opciones.map(([v, t, grupo]) => { const h = grupo && grupo !== g ? `<div class="mg">${esc(grupo)}</div>` : ''; g = grupo || g
        return `${h}<label class="chk mi"><input type="checkbox" value="${esc(v)}"${sel.has(String(v)) ? ' checked' : ''}> <span>${esc(t)}</span></label>` }).join('')}</div></div>`
    }
    if (c.tipo === 'titulo') return `<div class="ftit">${c.label}</div>`
    if (c.tipo === 'textarea') return `<label class="fl"><span>${c.label}${c.req ? ' *' : ''}</span><textarea class="ctl" id="${id}" rows="${c.rows || 2}" maxlength="${c.max || 2000}" style="width:100%"${req}>${esc(c.valor ?? '')}</textarea></label>`
    if (c.tipo === 'geo') return `<div class="fl"><span>${c.label}</span><div class="geo"><button class="btn ghost sm" type="button" data-geo="${c.id}"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>Capturar ubicación</button><span class="muted" id="g_${c.id}">${c.valor ? 'Ubicación guardada ✓' : 'Toca el botón estando en el lugar'}</span><input type="hidden" id="${id}" value="${esc(c.valor ?? '')}"></div></div>`
    return `<label class="fl"><span>${c.label}${c.req ? ' *' : ''}</span><input class="ctl" id="${id}" type="${c.tipo || 'text'}" value="${esc(c.valor ?? '')}"${c.min != null ? ` min="${c.min}"` : ''}${c.step ? ` step="${c.step}"` : ''}${req} style="width:100%"></label>`
  }
  modal(`<div class="ph"><div><h3 style="font-size:19px">${titulo}</h3>${nota ? `<div class="sub">${nota}</div>` : ''}</div><button class="x" data-close aria-label="Cerrar">×</button></div>
    <form id="fm" class="fgrid" novalidate>${campos.map(f).join('')}<div class="err" id="fmErr" role="alert"></div>
    <div class="toolbar" style="justify-content:flex-end"><button class="btn ghost" type="button" data-close>Cancelar</button><button class="btn" type="submit" id="fmOk">${boton}</button></div></form>`)
  // «Toda la empresa» y las demás casillas no se combinan
  campos.filter((c) => c.tipo === 'multi').forEach((c) => $$('#f_' + c.id + ' input').forEach((x) => x.addEventListener('change', () => {
    if (!x.checked) return
    $$('#f_' + c.id + ' input').forEach((y) => { if (y !== x && (x.value === 'empresa' || y.value === 'empresa')) y.checked = false })
  })))
  campos.filter((c) => c.tipo === 'geo').forEach((c) => $(`[data-geo="${c.id}"]`).addEventListener('click', () => capturarUbicacion(c)))
  $('#fm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const v = {}
    campos.forEach((c) => { if (c.tipo === 'titulo') return; const el = $('#f_' + c.id); v[c.id] = c.tipo === 'check' ? el.checked : c.tipo === 'foto' ? (el.files?.[0] || null) : c.tipo === 'multi' ? $$('input:checked', el).map((x) => x.value).join(',') : el.value.trim() })
    const falta = campos.find((c) => c.req && c.id && !v[c.id])
    if (falta) { $('#fmErr').textContent = `Falta: ${falta.label}.`; return }
    const b = $('#fmOk'); b.disabled = true; b.textContent = 'Guardando…'
    try {
      const msg = await guardar(v)
      $('#modalHost').innerHTML = ''
      if (msg) toast(msg)
    } catch (err) {
      if (!err.html) { console.error(err); $('#fmErr').textContent = err.userMsg || 'No se pudo guardar. Revisa los datos e intenta de nuevo.' }
      b.disabled = false; if (!err.html) b.textContent = boton
    }
  })
}
// GPS del celular: guarda la ubicación y, si la dirección está vacía, la llena con el mapa (OpenStreetMap)
function capturarUbicacion(c) {
  const st = $('#g_' + c.id), inp = $('#f_' + c.id)
  if (!navigator.geolocation) { st.textContent = 'Este navegador no da la ubicación.'; return }
  st.textContent = 'Buscando ubicación…'
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = +pos.coords.latitude.toFixed(6), lng = +pos.coords.longitude.toFixed(6)
    inp.value = `${lat},${lng}`
    st.innerHTML = `Ubicación capturada ✓ (±${Math.round(pos.coords.accuracy)} m) · <a href="${mapsUrl(lat, lng)}" target="_blank" rel="noopener">ver</a>`
    const dir = c.dir && $('#f_' + c.dir), col = c.col && $('#f_' + c.col)
    if (!dir || dir.value.trim()) return
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=es`)
      const a = (await r.json()).address || {}
      const calle = [a.road || a.pedestrian || a.street, a.house_number].filter(Boolean).join(' ')
      if (calle && !dir.value.trim()) dir.value = calle
      const colonia = a.neighbourhood || a.suburb || a.quarter || a.village || ''
      if (col && colonia && !col.value.trim()) col.value = colonia
    } catch {}
  }, (e) => { st.textContent = e.code === 1 ? 'Sin permiso de ubicación: actívalo en el navegador.' : 'No se pudo obtener la ubicación. Intenta al aire libre.' },
  { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
}
const SIN_RED = 'Sin conexión a internet: NO se guardó. Inténtalo de nuevo cuando tengas señal.'
function errorAmigable(error) {
  const m = String(error?.message || error || '')
  const e = new Error(m)
  e.userMsg = !navigator.onLine || /failed to fetch|network|load failed/i.test(m) ? SIN_RED
    : /row-level security|permission|Sólo mesa/i.test(m) ? (/Sólo mesa/.test(m) ? m : 'Tu cuenta no tiene permiso para este cambio.')
    : /duplicate|unique/i.test(m) ? 'Ya existe un registro con esos datos.'
    : /^[A-ZÁÉÍÓÚ][^\n]{6,160}\.$/.test(m) ? m : ''
  return e
}
async function escribir(fn) {
  if (!sb) { toast('Modo de prueba: los cambios no se guardan.'); return false }
  if (SIM) { toast('Vista de prueba («Ver como»): no se guarda nada.', 'warn'); return false }
  if (!navigator.onLine) throw errorAmigable('network')
  let res
  try { res = await fn() } catch (err) { throw errorAmigable(err) }
  if (res?.error) throw errorAmigable(res.error)
  _hist.clear()
  await reload(); return res?.data ?? true
}
addEventListener('offline', () => toast('Sin conexión a internet: lo que registres no se guardará hasta que vuelva la señal.', 'warn'))
addEventListener('online', () => toast('Conexión recuperada.'))

// ============================================================ documentos y fotos del expediente
// Espacio privado «expedientes» de Supabase Storage. Carpeta: <tipo>/<id>/<archivo>.
// No se borran desde la página (auditorías de 6 años).
const CAT_DOC = {
  cliente: ['INE (frente)', 'INE (reverso)', 'Comprobante de domicilio', 'Foto del cliente', 'Foto del domicilio', 'Contrato / pagaré', 'Otro'],
  personal: ['Foto', 'INE', 'Comprobante de domicilio', 'CURP', 'Contrato laboral', 'Otro'],
}
const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'archivo'
// Las fotos del celular pesan mucho: se reducen a 1600 px antes de subirlas.
async function reducirImagen(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82))
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
  } catch { return file }
}
async function subirDocumento(tipo, id, categoria, file) {
  if (!sb) { toast('Modo de prueba: los archivos no se guardan.'); return false }
  if (SIM) { toast('Vista de prueba («Ver como»): no se guarda nada.', 'warn'); return false }
  if (!navigator.onLine) throw errorAmigable('network')
  const esVideo = /^video\/(mp4|webm|quicktime)$/.test(file.type)
  const okTipo = esVideoCat(categoria) ? esVideo : /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(file.type)
  if (!okTipo) { const e = new Error('tipo'); e.userMsg = esVideoCat(categoria) ? 'Aquí va un video (MP4 o MOV).' : 'Sólo se aceptan fotos (JPG, PNG, HEIC) o PDF.'; throw e }
  const f = esVideo ? file : await reducirImagen(file)
  if (f.size > (esVideo ? 50 : 10) * 1024 * 1024) { const e = new Error('tam'); e.userMsg = `El archivo pesa más de ${esVideo ? 50 : 10} MB.`; throw e }
  const ext = f.type === 'application/pdf' ? 'pdf' : f.type === 'video/quicktime' ? 'mov' : f.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${tipo}/${id}/${Date.now()}-${slug(categoria)}.${ext}`
  const up = await sb.storage.from('expedientes').upload(path, f, { contentType: f.type, upsert: false })
  if (up.error) throw errorAmigable(up.error)
  const ok = await escribir(() => sb.from('documentos').insert({ tipo, entidad_id: id, categoria, nombre: file.name.slice(0, 120), path, mime: f.type, tamano: f.size, subido_por: DB.perfil.id }))
  return ok ? path : false
}
const _blobs = new Map()
async function blobDe(path) {
  if (_blobs.has(path)) return _blobs.get(path)
  const { data, error } = await sb.storage.from('expedientes').download(path)
  if (error) throw errorAmigable(error)
  const u = URL.createObjectURL(data); _blobs.set(path, u); return u
}
async function verDocumento(d) {
  if (!sb) { toast('Modo de prueba: no hay archivos.'); return }
  try {
    const u = await blobDe(d.path), img = /^image\//.test(d.mime || ''), vid = /^video\//.test(d.mime || '')
    modal(`<div class="ph"><div><h3 style="font-size:19px">${esc(d.categoria)}</h3><div class="sub">${esc(d.nombre)} · subido ${esc(String(d.creado).slice(0, 10))}</div></div><button class="x" data-close aria-label="Cerrar">×</button></div>
      ${img ? `<img src="${u}" alt="${esc(d.categoria)}" style="max-width:100%;max-height:70vh;border-radius:14px;justify-self:center">` : vid ? `<video controls playsinline src="${u}" style="width:100%;max-height:70vh;border-radius:14px;background:#000"></video>` : `<div class="empty"><b>Documento PDF</b>Ábrelo para verlo completo.</div>`}
      <div class="toolbar" style="justify-content:flex-end"><a class="btn" href="${u}" target="_blank" rel="noopener" download="${esc(d.nombre)}">${img ? 'Descargar' : 'Abrir PDF'}</a></div>`)
  } catch (e) { toast(e.userMsg || 'No se pudo abrir el archivo.', 'warn') }
}
// Panel de documentos: lista + subir archivo o tomar foto. «extra» suma documentos de otros expedientes ligados.
function panelDocs(el, tipo, id, { puede = true, extra = [], titulo = 'Documentos' } = {}) {
  if (!el) return
  const cats = CAT_DOC[tipo === 'personal' ? 'personal' : 'cliente']
  const L = DB.documentos.filter((d) => (d.tipo === tipo && d.entidad_id === id) || extra.some(([t, i]) => d.tipo === t && d.entidad_id === i))
  const ico = (d) => /pdf/.test(d.mime || '') ? '📄' : '🖼️'
  el.innerHTML = `<div class="docs"><div class="ph"><h3 class="sec-title">${titulo}</h3><span class="chip">${L.length}</span></div>
    <div class="list">${L.map((d) => `<button type="button" class="rowitem inset docrow" data-doc="${d.id}"><div><div class="t">${ico(d)} ${esc(d.categoria)}</div><div class="s">${esc(d.nombre)} · ${esc(String(d.creado).slice(0, 10))}${d.tipo !== tipo ? ' · de la solicitud' : ''}</div></div><div class="m"><small>Ver</small></div></button>`).join('') || '<div class="note">Todavía no hay documentos.</div>'}</div>
    ${puede ? `<div class="toolbar docup"><div class="field sel"><label>Tipo</label><select class="ctl" data-dcat>${cats.map((c) => `<option>${c}</option>`).join('')}</select></div>
      <label class="btn ghost"><input type="file" accept="image/*,application/pdf" data-dfile hidden>Subir archivo</label>
      <label class="btn"><input type="file" accept="image/*" capture="environment" data-dfile hidden>Tomar foto</label><span class="muted" data-dmsg></span></div>
      <div class="note">Fotos o PDF de hasta 10 MB. Se guardan en privado y no se pueden borrar (auditorías de 6 años).</div>` : ''}</div>`
  $$('[data-doc]', el).forEach((b) => b.addEventListener('click', () => verDocumento(DB.documentos.find((d) => d.id === +b.dataset.doc))))
  $$('[data-dfile]', el).forEach((inp) => inp.addEventListener('change', async () => {
    const f = inp.files?.[0]; if (!f) return
    const msg = $('[data-dmsg]', el), cat = $('[data-dcat]', el).value
    msg.textContent = 'Subiendo…'; $$('.docup .btn', el).forEach((b) => b.classList.add('disabled'))
    try { const ok = await subirDocumento(tipo, id, cat, f); if (ok) toast(`${cat} guardado.`); panelDocs(el, tipo, id, { puede, extra, titulo }) }
    catch (e) { msg.textContent = ''; toast(e.userMsg || 'No se pudo subir el archivo.', 'warn'); $$('.docup .btn', el).forEach((b) => b.classList.remove('disabled')) }
    inp.value = ''
  }))
}
async function fotoEn(img, path) { try { if (sb && path) img.src = await blobDe(path) } catch {} }

// Tablero → toca un color: quiénes son esos clientes (con el ámbito elegido), Excel y reasignar a otra ruta
function clientesPorEstado(k) {
  const e = ESTADO[k]; if (!e) return
  const L = porCliente(sc.cartera()).filter((c) => c.estado === k).sort((a, b) => b.dias - a.dias || b.saldo - a.saldo)
  const reasig = puede('reasignar_cartera') && sc.rutas().length > 1
  const rutas = sc.rutas()
  modal(`<div class="ph"><div><h3 style="font-size:20px"><span class="dot" style="background:${e.c};display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px"></span>${e.n} · ${NUM.format(L.length)} clientes</h3>
      <div class="sub">${e.s} · deben ${peso(sum(L, (c) => c.saldo))} · ${esc(scopeLabel())} (cambia el ámbito en el tablero para filtrar por asesor, gerencia o zona)</div></div><button class="x" data-close aria-label="Cerrar">×</button></div>
    <div class="toolbar"><div class="seg" id="ceSeg">${ESTADOS.map((x) => `<button type="button" data-k="${x.k}" class="${x.k === k ? 'on' : ''}">${x.n}</button>`).join('')}</div>
      ${puede('descargar_excel') ? '<button class="btn ghost sm" type="button" id="ceX"><svg viewBox="0 0 24 24"><path d="M12 3v12M8 11l4 4 4-4M4 21h16"/></svg>Exportar cartera (Excel)</button>' : ''}</div>
    <div class="tablewrap"><table class="tbl"><thead><tr>${reasig ? '<th><input type="checkbox" id="ceAll" aria-label="Seleccionar todos"></th>' : ''}<th>Cliente</th><th>Ruta / asesor</th><th>Gerencia</th><th class="num">Debe</th><th class="num">Atraso</th><th>Teléfono</th><th>Dirección</th></tr></thead><tbody>
    ${L.slice(0, 500).map((c) => `<tr class="click" data-cli="${c.cliente_id}">${reasig ? `<td><input type="checkbox" data-sel="${c.cliente_id}" aria-label="Seleccionar"></td>` : ''}<td class="strong">${esc(c.cliente)}</td><td>${esc(c.ruta)}<div class="muted" style="font-size:12px">${esc(c.asesor || '')}</div></td><td>${esc(c.gerencia)}</td>
      <td class="num strong">${peso(c.saldo)}</td><td class="num">${c.dias} d</td><td>${esc(c.celular || c.telefono || '')}</td><td>${esc([c.direccion, c.colonia].filter(Boolean).join(', '))}</td></tr>`).join('') || `<tr><td colspan="8"><div class="empty"><b>Nadie en ${e.n.toLowerCase()}</b></div></td></tr>`}
    </tbody></table></div>
    ${reasig && L.length ? `<div class="toolbar reasig"><span class="muted" id="ceN">Selecciona clientes para asignárselos a otro asesor</span><div class="field sel"><label>Pasar a la ruta</label><select class="ctl" id="ceR">${rutas.map((r) => `<option value="${r.ruta_id}">${esc(r.ruta)} · ${esc(r.asesor || '')}</option>`).join('')}</select></div><button class="btn" type="button" id="ceGo" disabled>Reasignar</button></div>` : ''}`)
  $$('#ceSeg button').forEach((b) => b.addEventListener('click', () => clientesPorEstado(b.dataset.k)))
  $$('[data-cli]').forEach((tr) => tr.addEventListener('click', (ev) => { if (ev.target.closest('input')) return; fichaCliente(+tr.dataset.cli) }))
  $('#ceX')?.addEventListener('click', () => csv(`cartera_${k}_${DB.hoy}`, [['Cliente', 'cliente'], ['Código', 'codigo'], ['Ruta', 'ruta'], ['Asesor', 'asesor'], ['Oficina', 'oficina'], ['Gerencia', 'gerencia'], ['Zona', 'zona'],
    ['Debe', 'saldo'], ['Días de atraso', 'dias'], ['Teléfono', 'telefono'], ['Celular', 'celular'], ['Dirección', 'direccion'], ['Colonia', 'colonia'], ['Negocio', 'direccion_negocio']], L))
  const sel = () => $$('[data-sel]:checked').map((x) => +x.dataset.sel)
  const upd = () => { const n = sel().length; if ($('#ceN')) $('#ceN').textContent = n ? `${n} cliente(s) seleccionado(s)` : 'Selecciona clientes para asignárselos a otro asesor'; if ($('#ceGo')) $('#ceGo').disabled = !n }
  $$('[data-sel]').forEach((x) => x.addEventListener('change', upd))
  $('#ceAll')?.addEventListener('change', (ev) => { $$('[data-sel]').forEach((x) => { x.checked = ev.target.checked }); upd() })
  $('#ceGo')?.addEventListener('click', async () => {
    const ids = sel(), rid = +$('#ceR').value, b = $('#ceGo')
    b.disabled = true; b.textContent = 'Reasignando…'
    try { const n = await escribir(() => sb.rpc('reasignar_clientes', { p_clientes: ids, p_ruta: rid })); if (n !== false) { toast(`${typeof n === 'number' ? n : ids.length} cliente(s) pasaron a ${DB.R[rid]?.ruta || 'la ruta'}.`); clientesPorEstado(k) } else { b.disabled = false; b.textContent = 'Reasignar' } }
    catch (er) { toast(er.userMsg || 'No se pudo reasignar.', 'warn'); b.disabled = false; b.textContent = 'Reasignar' }
  })
}
// «Ver como…»: el dueño ve exactamente las pantallas de un cargo (y de una persona) para capacitar. No guarda nada.
function verComo() {
  const cargos = CARGOS_PERM.map((r) => [r, ROLES[r]])
  const gente = (rol) => DB.perfiles.filter((u) => u.rol === rol && u.activo !== false)
  const ops = (rol) => [['', '— Elegir sólo el ámbito —'], ...gente(rol).map((u) => [u.id, `${u.nombre || u.correo} · ${ambitoNombre(u.ambito || 'empresa')}`])]
  formModal({
    titulo: 'Ver el sistema como…', boton: 'Ver como este cargo',
    nota: 'Verás lo mismo que ve esa persona: sus secciones, su ámbito y sus botones. Es sólo para ver y capacitar: nada se guarda.',
    campos: [{ id: 'rol', label: 'Cargo', tipo: 'select', req: 1, opciones: cargos, valor: 'asesor' },
      { id: 'persona', label: 'Persona', tipo: 'select', opciones: ops('asesor'), valor: gente('asesor')[0]?.id || '' },
      { id: 'ambito', label: 'Ámbito (si no eliges persona)', tipo: 'select', opciones: ambitoOpciones(), valor: DB.rutas[0] ? 'ruta:' + DB.rutas[0].ruta_id : 'empresa' }],
    guardar: async (v) => {
      const u = DB.perfiles.find((x) => x.id === v.persona)
      const real = SIM ? SIM.real : DB.perfil
      const amb = ['mesa', 'direccion'].includes(v.rol) ? 'empresa' : u ? u.ambito || 'empresa' : v.ambito
      SIM = { real, rol: v.rol, nombre: u?.nombre || ROLES[v.rol], ambito: amb, rutas: v.rol === 'mesa' ? null : rutasDeAmbito(amb), uid: u?.id || null }
      DB.perfil = { ...real, id: SIM.uid || real.id, rol: SIM.rol, ambito: SIM.ambito, nombre: SIM.nombre }
      try { sessionStorage.setItem('verComo', JSON.stringify({ rol: SIM.rol, nombre: SIM.nombre, ambito: SIM.ambito, uid: SIM.uid })) } catch {}
      SCOPE = raiz(); VIEW = 'tablero'; showApp.avisado = true; showApp()
      return `Viendo como ${ROLES[v.rol]}${u ? ' · ' + (u.nombre || '') : ''}.`
    },
  })
  const r = $('#f_rol'), p = $('#f_persona')
  const amb = $('#f_ambito').closest('.fl')
  const sinc = () => { amb.style.display = ['mesa', 'direccion'].includes(r.value) || p.value ? 'none' : '' }
  r.addEventListener('change', () => { p.innerHTML = ops(r.value).map(([a, b]) => `<option value="${esc(a)}">${esc(b)}</option>`).join(''); p.value = gente(r.value)[0]?.id || ''; sinc() })
  p.addEventListener('change', sinc); sinc()
}
function salirVerComo() {
  if (!SIM) return
  DB.perfil = SIM.real; SIM = null
  try { sessionStorage.removeItem('verComo') } catch {}
  SCOPE = raiz(); VIEW = 'tablero'; showApp()
  toast('Regresaste a tu vista.')
}

// ============================================================ personal y peticiones
function editarPersona(x) {
  const e = x || {}
  const puestos = ['Asesor de crédito', 'Gerente', 'Gerente zonal', 'Gerente regional', 'Mesa de control', 'Tesorería', 'Dirección', 'Administrativo']
  formModal({
    titulo: x ? `Expediente de ${esc(x.nombre)}` : 'Agregar persona', nota: 'Datos que se conservan 6 años, aunque la persona se dé de baja.', boton: 'Guardar',
    campos: [{ id: 'nombre', label: 'Nombre completo', req: 1, valor: e.nombre }, { id: 'puesto', label: 'Puesto', tipo: 'select', req: 1, opciones: puestos.map((p) => [p, p]), valor: e.puesto || 'Asesor de crédito' },
      { id: 'ambito', label: 'Ruta, oficina o gerencia', tipo: 'select', opciones: ambitoOpciones(), valor: e.ambito || 'empresa' }, { id: 'curp', label: 'CURP', req: 1, valor: e.curp },
      { id: 'fnac', label: 'Fecha de nacimiento', tipo: 'date', valor: e.fecha_nacimiento }, { id: 'direccion', label: 'Dirección', valor: e.direccion },
      { id: 'telefono', label: 'Teléfono', tipo: 'tel', req: 1, valor: e.telefono }, { id: 'correo', label: 'Correo', tipo: 'email', valor: e.correo },
      { id: 'ingreso', label: 'Fecha de ingreso', tipo: 'date', req: 1, valor: e.fecha_ingreso || DB.hoy }],
    guardar: async (v) => {
      const row = { nombre: v.nombre, puesto: v.puesto, ambito: v.ambito, curp: v.curp.toUpperCase(), fecha_nacimiento: v.fnac || null, direccion: v.direccion || null, telefono: v.telefono, correo: v.correo || null, fecha_ingreso: v.ingreso }
      const ok = await escribir(() => x ? sb.from('personal').update(row).eq('id', x.id) : sb.from('personal').insert(row))
      return ok ? 'Expediente guardado.' : ''
    },
  })
}
function fichaPersona(x) {
  const foto = DB.documentos.find((d) => d.tipo === 'personal' && d.entidad_id === x.id && d.categoria === 'Foto')
  const dato = (l, v) => v ? `<div class="r"><span class="k">${l}</span><span class="v">${esc(v)}</span></div>` : ''
  modal(`<div class="ph"><div style="display:flex;gap:14px;align-items:center"><span class="perfoto grande">${foto ? '<img id="pfoto" alt="">' : esc((x.nombre || '?').slice(0, 1))}</span>
      <div><h3 style="font-size:20px">${esc(x.nombre)}</h3><div class="sub">${esc(x.puesto)} · ${esc(x.ambito ? ambitoNombre(x.ambito) : '')}</div></div></div><button class="x" data-close aria-label="Cerrar">×</button></div>
    ${x.fecha_baja ? `<div class="note-card"><b>Dado de baja el ${esc(x.fecha_baja)}</b> · ${esc(x.motivo_baja || '')}. Su expediente se conserva hasta ${addDays(x.fecha_baja, 365 * 6)}.</div>` : ''}
    <div class="kv">${dato('CURP', x.curp)}${dato('Fecha de nacimiento', x.fecha_nacimiento)}${dato('Dirección', x.direccion)}${dato('Teléfono', x.telefono)}${dato('Correo', x.correo)}${dato('Fecha de ingreso', x.fecha_ingreso)}</div>
    <div class="toolbar"><button class="btn ghost" type="button" id="pedit">Editar datos</button>${x.fecha_baja ? '' : '<button class="btn ghost" type="button" id="pbaja">Dar de baja</button>'}</div>
    <div id="pdocs"></div>`)
  if (foto) fotoEn($('#pfoto'), foto.path)
  $('#pedit').addEventListener('click', () => editarPersona(x))
  $('#pbaja')?.addEventListener('click', () => bajaPersona(x))
  panelDocs($('#pdocs'), 'personal', x.id, { puede: esAdmin(), titulo: 'Foto y documentos' })
}
function bajaPersona(x) {
  formModal({
    titulo: `Dar de baja a ${esc(x.nombre)}`, nota: 'Su expediente se conserva 6 años para auditorías. No se borra nada.', boton: 'Dar de baja',
    campos: [{ id: 'fecha', label: 'Fecha de baja', tipo: 'date', req: 1, valor: DB.hoy }, { id: 'motivo', label: 'Motivo', req: 1 }],
    guardar: async (v) => { const ok = await escribir(() => sb.from('personal').update({ fecha_baja: v.fecha, motivo_baja: v.motivo }).eq('id', x.id)); return ok ? 'Baja registrada. Recuerda desactivar su usuario.' : '' },
  })
}
function enviarPeticion() {
  const secciones = NAV.filter(([k]) => k !== 'h').map(([k, t]) => [t, t]).concat([['Otra', 'Otra / general']])
  formModal({
    titulo: 'Enviar petición o mejora', nota: 'Dinos qué quieres cambiar, agregar o qué no te gustó. Le llega al equipo de NXUS AI.', boton: 'Enviar',
    campos: [{ id: 'seccion', label: 'Sección', tipo: 'select', req: 1, opciones: secciones, valor: (NAV.find(([k]) => k === VIEW) || [])[1] || 'Otra' }, { id: 'texto', label: 'Tu petición', req: 1 }],
    guardar: async (v) => {
      if (v.texto.length < 3) { const e = new Error('t'); e.userMsg = 'Escribe un poco más.'; throw e }
      const ok = await escribir(() => sb.from('peticiones').insert({ seccion: v.seccion, texto: v.texto, nombre: DB.perfil.nombre || null, creado_por: DB.perfil.id }))
      return ok ? '¡Gracias! Tu petición quedó registrada.' : ''
    },
  })
  const t = $('#f_texto'); if (t) { const a = document.createElement('textarea'); a.id = 'f_texto'; a.className = 'ctl'; a.rows = 4; a.style.cssText = 'width:100%;height:auto;padding:10px 13px;resize:vertical'; a.required = true; t.replaceWith(a) }
}

// Comisiones: las decide el dueño; se aplican al reporte de inmediato
function editarComisiones() {
  formModal({
    titulo: 'Comisiones de los asesores', nota: 'Se aplican al reporte de comisiones de inmediato. Puedes cambiarlas cuando quieras.', boton: 'Guardar comisiones',
    campos: [
      { id: 'nuevo', label: 'Por cada cliente nuevo (pesos)', tipo: 'number', min: 0, step: '1', valor: PARAM('comision_nuevo') ?? '' },
      { id: 'renov', label: 'Por renovación (% del dinero entregado)', tipo: 'number', min: 0, step: '0.1', valor: PARAM('comision_renovacion_pct') ?? '' },
    ],
    guardar: async (v) => {
      const num = (x) => (x === '' ? null : +x)
      const err = (m) => { const e = new Error(m); e.userMsg = m; throw e }
      if (num(v.renov) != null && num(v.renov) > 100) err('El porcentaje no puede ser mayor a 100.')
      if (!sb) { toast('Modo de prueba: los cambios no se guardan.'); return '' }
      const a = await sb.from('parametros').update({ valor: num(v.nuevo) }).eq('clave', 'comision_nuevo')
      if (a.error) throw errorAmigable(a.error)
      const ok = await escribir(() => sb.from('parametros').update({ valor: num(v.renov) }).eq('clave', 'comision_renovacion_pct'))
      return ok ? 'Comisiones guardadas.' : ''
    },
  })
}

// ============================================================ permisos por cargo
// Explicación corta de cada permiso (lo que ve el dueño)
const PERM_DESC = {
  ver_tablero: 'Resumen de la cartera, normalidad y cobranza del día', ver_clientes: 'Lista de clientes y su expediente', ver_originacion: 'Pantalla para capturar créditos nuevos y renovaciones',
  ver_solicitudes: 'Solicitudes en revisión, aprobadas y rechazadas', ver_creditos: 'Todos los créditos con su saldo y atraso', ver_cobranza: 'Lo cobrado por ruta y los clientes por cobrar',
  ver_normalidad: 'Porcentaje de cartera al día y comparativos', ver_proyecciones: 'Metas y logros de cada oficina', ver_cajas: 'Dinero en la caja de cada asesor y gerente',
  ver_tesoreria: 'Bancos, flujo del dinero y movimientos', ver_reportes: 'Reportes de cartera, comisiones y gastos administrativos',
  registrar_pagos: 'Cobrar a los clientes desde el celular', crear_solicitudes: 'Capturar créditos nuevos, renovaciones y recompras', resolver_solicitudes: 'Mesa de control: autorizar, pedir corrección, rechazar o cancelar',
  registrar_gastos: 'Gasolina, papelería y otros gastos de su caja', tesoreria_excedente: 'Sacar dinero de más de la caja de un gerente y depositarlo al banco',
  capturar_proyecciones: 'Subir la meta de la mañana y el logro de la tarde', subir_documentos: 'INE, comprobantes y fotos del expediente', descargar_excel: 'Bajar los reportes a Excel',
  desembolsar: 'Grabar el video de entrega y convertir la solicitud autorizada en crédito', autorizar_excepciones: 'Renovaciones que piden más del 20 % sobre su crédito anterior',
  ordenar_ruta: 'Acomodar a los clientes en el orden en que se les cobra', reasignar_cartera: 'Pasar clientes de una ruta a otra (desde el tablero)',
}
let permCargo = (() => { try { const v = localStorage.getItem('permCargo'); return CARGOS_PERM.includes(v) ? v : 'asesor' } catch { return 'asesor' } })()
function matrizPermisos() {
  const dueno = ['dueno', 'soporte'].includes(DB.perfil.rol), r = permCargo
  const fila = ([k, t]) => `<label class="perm inset${dueno ? '' : ' ro'}"><span><b>${t}</b><small>${PERM_DESC[k] || ''}</small></span>
    <span class="sw"><input type="checkbox" data-perm="${r}|${k}"${permitido(r, k) ? ' checked' : ''}${dueno ? '' : ' disabled'} aria-label="${esc(t)}"><i></i></span></label>`
  return `<div class="card panel" id="permisos"><div class="ph"><div><h3>Permisos por cargo</h3><div class="sub">${dueno ? 'Elige un cargo y enciende o apaga lo que puede ver y hacer. Se guarda al instante.' : 'Sólo el dueño puede cambiarlos.'} El dueño siempre tiene todo.</div></div></div>
    <div class="field sel" style="display:block"><label for="pcargo">Cargo</label><select class="ctl" id="pcargo" style="width:100%">${CARGOS_PERM.map((x) => `<option value="${x}"${x === r ? ' selected' : ''}>${esc(ROLES[x])}</option>`).join('')}</select></div>
    ${PERMISOS.map(([g, L]) => `<h3 class="sec-title" style="margin-top:4px">${g}</h3><div class="perms">${L.map(fila).join('')}</div>`).join('')}
    <div class="note">Cada quien sólo ve la parte de la empresa de sus rutas. Lo de «Puede hacer» también lo revisa la base de datos: si no lo tiene, el sistema lo rechaza. Mesa de control es externa: aunque le prendas secciones, nunca ve la cartera ni los clientes; sólo las solicitudes y el historial del cliente de cada una. Dar de alta usuarios, estructura y parámetros es sólo de dueño y dirección.</div></div>`
}
function pintarPermisos() {
  const el = document.getElementById('permisos'); if (!el) return
  el.outerHTML = matrizPermisos()
  document.getElementById('pcargo').addEventListener('change', (e) => { permCargo = e.target.value; try { localStorage.setItem('permCargo', permCargo) } catch {} pintarPermisos() })
  document.querySelectorAll('[data-perm]').forEach((c) => c.addEventListener('change', () => cambiarPermiso(c)))
}
async function cambiarPermiso(c) {
  const [rol, permiso] = c.dataset.perm.split('|'), v = c.checked
  if (!sb) { toast('Modo de prueba: los cambios no se guardan.'); c.checked = !v; return }
  c.disabled = true
  try {
    const { error } = await sb.from('permisos').update({ permitido: v, actualizado: new Date().toISOString(), actualizado_por: DB.perfil.id }).eq('rol', rol).eq('permiso', permiso)
    if (error) throw errorAmigable(error)
    const x = DB.permisos.find((q) => q.rol === rol && q.permiso === permiso); if (x) x.permitido = v; else DB.permisos.push({ rol, permiso, permitido: v })
    toast(`${ROLES[rol]}: ${v ? 'puede' : 'ya no puede'} «${PERMISOS.flatMap(([, L]) => L).find(([k]) => k === permiso)[1]}».`)
  } catch (e) { c.checked = !v; toast(e.userMsg || 'No se pudo guardar el permiso.', 'warn') }
  c.disabled = false
}

let permPersona = ''
function pintarPermisosPersona() {
  const el = document.getElementById('permPers'); if (!el) return
  const dueno = ['dueno', 'soporte'].includes(DB.perfil.rol)
  const gente = DB.perfiles.filter((u) => !['dueno', 'soporte'].includes(u.rol) && u.activo !== false).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
  if (!gente.some((u) => u.id === permPersona)) permPersona = gente[0]?.id || ''
  const u = gente.find((x) => x.id === permPersona)
  const exc = (k) => (DB.permisosUsuario || []).find((q) => q.usuario === permPersona && q.permiso === k)
  const fila = ([k, t]) => { const x = exc(k), base = permitido(u.rol, k), val = x ? !!x.permitido : base
    return `<label class="perm inset${dueno ? '' : ' ro'}${x ? ' exc' : ''}"><span><b>${t}${x ? ' <em class="chip a">sólo a esta persona</em>' : ''}</b><small>${x ? `Su cargo ${base ? 'sí' : 'no'} lo tiene` : 'Igual que su cargo'}</small></span>
      <span class="sw"><input type="checkbox" data-pp="${k}"${val ? ' checked' : ''}${dueno ? '' : ' disabled'} aria-label="${esc(t)}"><i></i></span></label>` }
  el.innerHTML = `<div class="card panel"><div class="ph"><div><h3>Permisos de una persona</h3><div class="sub">Para darle o quitarle algo a alguien en específico sin cambiar a todo su cargo. Lo que no cambies aquí, sigue igual que su cargo.</div></div></div>
    ${gente.length ? `<div class="field sel" style="display:block"><label for="ppers">Persona</label><select class="ctl" id="ppers" style="width:100%">${gente.map((x) => `<option value="${esc(x.id)}"${x.id === permPersona ? ' selected' : ''}>${esc(x.nombre || x.correo)} · ${esc(ROLES[x.rol] || x.rol)}</option>`).join('')}</select></div>
    ${PERMISOS.map(([g, L]) => `<h3 class="sec-title" style="margin-top:4px">${g}</h3><div class="perms">${L.map(fila).join('')}</div>`).join('')}
    ${dueno && (DB.permisosUsuario || []).some((q) => q.usuario === permPersona) ? '<div class="toolbar" style="justify-content:flex-end"><button class="btn ghost" type="button" id="ppReset">Quitar sus excepciones (que quede igual que su cargo)</button></div>' : ''}`
    : '<div class="empty"><b>Todavía no hay personal dado de alta</b>Invita usuarios en la pestaña Usuarios.</div>'}</div>`
  $('#ppers')?.addEventListener('change', (e) => { permPersona = e.target.value; pintarPermisosPersona() })
  $$('[data-pp]', el).forEach((c) => c.addEventListener('change', async () => {
    const k = c.dataset.pp, v = c.checked
    if (!sb) { toast('Modo de prueba: los cambios no se guardan.'); c.checked = !v; return }
    if (SIM) { toast('Vista de prueba («Ver como»): no se guarda nada.', 'warn'); c.checked = !v; return }
    c.disabled = true
    try {
      const igual = permitido(u.rol, k) === v
      const r = igual ? await sb.from('permisos_usuario').delete().eq('usuario', permPersona).eq('permiso', k)
        : await sb.from('permisos_usuario').upsert({ usuario: permPersona, permiso: k, permitido: v, actualizado: new Date().toISOString(), actualizado_por: DB.perfil.id })
      if (r.error) throw errorAmigable(r.error)
      DB.permisosUsuario = DB.permisosUsuario.filter((q) => !(q.usuario === permPersona && q.permiso === k))
      if (!igual) DB.permisosUsuario.push({ usuario: permPersona, permiso: k, permitido: v })
      toast(`${u.nombre || 'La persona'}: ${v ? 'puede' : 'ya no puede'} «${PERMISOS.flatMap(([, L]) => L).find(([x]) => x === k)[1]}».`)
      pintarPermisosPersona()
    } catch (e) { c.checked = !v; c.disabled = false; toast(e.userMsg || 'No se pudo guardar el permiso.', 'warn') }
  }))
  $('#ppReset')?.addEventListener('click', async () => {
    try { const r = await sb.from('permisos_usuario').delete().eq('usuario', permPersona); if (r.error) throw errorAmigable(r.error)
      DB.permisosUsuario = DB.permisosUsuario.filter((q) => q.usuario !== permPersona); toast('Listo: tiene los mismos permisos que su cargo.'); pintarPermisosPersona() }
    catch (e) { toast(e.userMsg || 'No se pudo.', 'warn') }
  })
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
// Lista para las casillas: agrupada por nivel, como «consultar y agregar rutas» de Listo
function ambitoCasillas() {
  const E = DB.est, ofi = (o) => E.oficinas.find((x) => x.id === o)?.nombre || ''
  return [['empresa', 'Toda la empresa', 'General'], ...E.zonas.map((x) => ['zona:' + x.id, x.nombre, 'Zonas']), ...E.gerencias.map((x) => ['gerencia:' + x.id, x.nombre, 'Gerencias']),
    ...E.oficinas.map((x) => ['oficina:' + x.id, x.nombre, 'Oficinas']), ...E.rutas.map((x) => ['ruta:' + x.id, `${x.nombre}${x.responsable ? ' · ' + x.responsable : ''} (oficina ${ofi(x.oficina_id)})`, 'Rutas'])]
}
// Al asignar rutas a un asesor, su nombre queda como responsable de esas rutas (asignación inmediata)
async function asignarResponsable(rol, ambito, nombre) {
  if (rol !== 'asesor' || !sb) return
  const ids = String(ambito).split(',').filter((a) => a.startsWith('ruta:')).map((a) => +a.split(':')[1])
  for (const id of ids) await sb.from('rutas').update({ responsable: nombre }).eq('id', id)
}
function ambitoOpciones() {
  const E = DB.est
  return [['empresa', 'Toda la empresa'], ...E.regiones.map((x) => ['region:' + x.id, 'Región · ' + x.nombre]), ...E.zonas.map((x) => ['zona:' + x.id, 'Zona · ' + x.nombre]),
    ...E.gerencias.map((x) => ['gerencia:' + x.id, 'Gerencia · ' + x.nombre]), ...E.oficinas.map((x) => ['oficina:' + x.id, 'Oficina · ' + x.nombre]), ...E.rutas.map((x) => ['ruta:' + x.id, 'Ruta · ' + x.nombre])]
}
function ambitoNombre(a) {
  if (a === 'ninguno') return 'Sólo solicitudes (mesa de control)'
  const O = ambitoOpciones(), L = String(a || 'empresa').split(',')
  return L.map((x) => (O.find(([v]) => v === x) || [x, x])[1]).join(' + ')
}
const cargoOpciones = () => Object.entries(ROLES).filter(([k]) => !['soporte', 'dueno'].includes(k) || (k === 'dueno' && ['soporte', 'dueno'].includes(DB.perfil.rol)))
function editarUsuario(u) {
  if (!u) return
  formModal({
    titulo: `Editar a ${esc(u.nombre || u.correo || '')}`, nota: esc(u.correo || ''),
    campos: [
      { id: 'nombre', label: 'Nombre', req: 1, valor: u.nombre },
      { id: 'rol', label: 'Cargo', tipo: 'select', req: 1, opciones: cargoOpciones(), valor: u.rol },
      { id: 'ambito', label: 'Qué puede ver: marca sus rutas, oficinas, gerencias o zonas (puedes marcar varias)', tipo: 'multi', req: 1, opciones: ambitoCasillas(), valor: u.ambito || 'empresa' },
      { id: 'activo', label: 'Activo (puede entrar al sistema)', tipo: 'check', valor: u.activo },
    ],
    guardar: async (v) => {
      const amb = ['dueno', 'direccion', 'mesa'].includes(v.rol) ? 'empresa' : v.ambito
      if (!amb) { const e = new Error('amb'); e.userMsg = 'Marca al menos una ruta, oficina, gerencia o zona.'; throw e }
      if (sb && !SIM) await asignarResponsable(v.rol, amb, v.nombre)
      const ok = await escribir(() => sb.from('perfiles').update({ nombre: v.nombre, rol: v.rol, ambito: amb, activo: v.activo }).eq('id', u.id))
      return ok ? `Usuario actualizado. Desde ahora ve: ${ambitoNombre(amb)}.` : ''
    },
  })
}
function invitarUsuario() {
  formModal({
    titulo: 'Invitar usuario', nota: 'Le llega un correo para crear su contraseña. Entra con este cargo y ámbito.', boton: 'Enviar invitación',
    campos: [
      { id: 'nombre', label: 'Nombre completo', req: 1 }, { id: 'correo', label: 'Correo', tipo: 'email', req: 1 },
      { id: 'rol', label: 'Cargo', tipo: 'select', req: 1, opciones: cargoOpciones(), valor: 'asesor' },
      { id: 'ambito', label: 'Qué puede ver: marca sus rutas, oficinas, gerencias o zonas (puedes marcar varias)', tipo: 'multi', req: 1, opciones: ambitoCasillas(), valor: 'empresa' },
    ],
    guardar: async (v) => {
      if (!sb) { toast('Modo de prueba: los cambios no se guardan.'); return '' }
      if (SIM) { toast('Vista de prueba («Ver como»): no se guarda nada.', 'warn'); return '' }
      if (['dueno', 'direccion', 'mesa'].includes(v.rol)) v.ambito = 'empresa'
      if (!v.ambito) { const e = new Error('amb'); e.userMsg = 'Marca al menos una ruta, oficina, gerencia o zona.'; throw e }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.correo)) { const e = new Error('correo'); e.userMsg = 'Escribe un correo válido.'; throw e }
      const { data } = await sb.auth.getSession()
      const r = await fetch('/.netlify/functions/invitar', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify(v) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { const e = new Error(j.error || 'invitar'); e.userMsg = j.error || 'No se pudo enviar la invitación.'; throw e }
      await asignarResponsable(v.rol, v.ambito, v.nombre)
      await reload()
      return `Invitación enviada a ${v.correo}.`
    },
  })
}

// ============================================================ Normalidad
// Normalidad (fórmula del dueño) = cartera al día ÷ cartera total × 100, en dinero.
// Como dato de apoyo se muestra también lo cobrado contra lo que tocaba cobrar.
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
const semaforo = (p) => (p >= PARAM('meta_normalidad', 90) ? 'ok' : p >= PARAM('meta_normalidad', 90) - 15 ? 'wait' : 'bad')
const rangoFechas = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out }
VIEWS.normalidad = {
  rango: '30', nivel: 'ruta', fecha: null, comp: 'mes', A: null, B: null,
  html() {
    const hoy = DB.hoy
    this.fecha = this.fecha || hoy
    const mes = hoy.slice(0, 7), mesAnt = addDays(hoy.slice(0, 8) + '01', -1).slice(0, 7), anio = +hoy.slice(0, 4)
    if (!this.A) this.ajustarComp()
    return `${head('Normalidad', `Cartera al día ÷ cartera total, en dinero. Meta: ${PARAM('meta_normalidad', 90)} %.`,
      `<div class="seg" id="nrango">${[['7', '7 días'], ['30', '30 días'], ['90', '90 días']].map(([k, t]) => `<button type="button" data-r="${k}" class="${this.rango === k ? 'on' : ''}">${t}</button>`).join('')}</div>
       <label class="field"><label for="nfecha">Fecha</label><input class="ctl" type="date" id="nfecha" value="${this.fecha}" max="${hoy}"></label>`)}
      <section class="kpis" id="nk"></section>
      <div class="card panel"><div class="ph"><div><h3>Normalidad por día</h3><div class="sub" id="ngsub"></div></div></div><div class="chart-box" style="height:250px"><canvas id="nchart"></canvas></div></div>
      <div class="card panel"><div class="ph"><div><h3>Comparar periodos</h3><div class="sub">Un día contra otro, un mes contra otro o un año contra otro</div></div>
        <div class="seg" id="ncomp">${[['dia', 'Día vs día'], ['mes', 'Mes vs mes'], ['anio', 'Año vs año']].map(([k, t]) => `<button type="button" data-c="${k}" class="${this.comp === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <div class="toolbar" id="ncompIn"></div>
        <div class="statrow" id="ncompK" style="grid-template-columns:repeat(3,minmax(0,1fr))"></div>
        <div class="chart-box" style="height:240px"><canvas id="ncchart"></canvas></div></div>
      <div class="card panel"><div class="ph"><div><h3>Por nivel</h3><div class="sub" id="nsub"></div></div><div class="tabs" id="nnivel">${[['ruta', 'Ruta'], ['oficina', 'Oficina'], ['gerencia', 'Gerencia'], ['zona', 'Zona']].map(([k, t]) => `<button type="button" data-n="${k}" class="${this.nivel === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <div id="ntabla"></div>
        <div class="note">Normalidad = saldo de créditos al día ÷ saldo total. «Cobrado vs esperado» compara lo cobrado con las cuotas que vencían en los últimos 7 días. Verde: en meta · ámbar: hasta 15 puntos abajo.</div></div>`
  },
  ajustarComp() {
    const hoy = DB.hoy
    if (this.comp === 'dia') { this.A = addDays(hoy, -7); this.B = hoy }
    else if (this.comp === 'mes') { this.A = addDays(hoy.slice(0, 8) + '01', -1).slice(0, 7); this.B = hoy.slice(0, 7) }
    else { this.A = String(+hoy.slice(0, 4) - 1); this.B = hoy.slice(0, 4) }
  },
  init() {
    $$('#nrango button').forEach((b) => b.addEventListener('click', () => { this.rango = b.dataset.r; $$('#nrango button').forEach((x) => x.classList.toggle('on', x === b)); reveal(); this.grafica() }))
    $$('#nnivel button').forEach((b) => b.addEventListener('click', () => { this.nivel = b.dataset.n; $$('#nnivel button').forEach((x) => x.classList.toggle('on', x === b)); this.tabla() }))
    $$('#ncomp button').forEach((b) => b.addEventListener('click', () => { this.comp = b.dataset.c; $$('#ncomp button').forEach((x) => x.classList.toggle('on', x === b)); this.ajustarComp(); this.comparar() }))
    $('#nfecha').addEventListener('change', (e) => { if (e.target.value) { this.fecha = e.target.value; reveal(); this.pintar(); this.grafica() } })
    this.pintar(); this.grafica(); this.comparar()
  },
  enFecha(d) { return historiaNormalidad([d]).get(d) },
  pintar() {
    const d = this.fecha, esHoy = d === DB.hoy
    const N = esHoy ? normalidadHoy(sc.cartera()) : (() => { const x = this.enFecha(d); return { ...x, p: x.tot ? (x.ok / x.tot) * 100 : 0 } })()
    const ant = this.enFecha(addDays(d, -7)), pAnt = ant.tot ? (ant.ok / ant.tot) * 100 : 0
    const desde = addDays(d, -6), ag = agenda(desde, d)
    let esp = 0; ag.forEach((v) => { esp += v.s })
    const cob = sum(sc.recaudo().filter((r) => r.fecha >= desde && r.fecha <= d), (r) => r.monto)
    const k = [
      { lab: 'Normalidad', val: Math.round(N.p) + '%', meta: `${esHoy ? 'hoy' : 'al ' + fechaCorta(d)} · hace una semana ${Math.round(pAnt)}%`, g: [COL.green, COL.teal], st: semaforo(N.p) },
      { lab: 'Cartera al día', val: peso(N.ok), meta: 'saldo de créditos sin atraso', g: [COL.teal, COL.blue] },
      { lab: 'Cartera total', val: peso(N.tot), meta: 'saldo por cobrar', g: [COL.blue, COL.violet] },
      { lab: 'Cobrado vs esperado', val: pct(cob, esp) + '%', meta: `${peso(cob)} de ${peso(esp)} · 7 días`, g: [COL.violet, COL.teal] },
    ]
    $('#nk').innerHTML = k.map((x) => `<div class="card kpi lift"><div class="row1"><div class="ico" style="background:linear-gradient(135deg,${x.g[0]},${x.g[1]})"><svg viewBox="0 0 24 24">${ICON.normalidad}</svg></div>${x.st ? `<span class="st ${x.st}">${x.st === 'ok' ? 'En meta' : x.st === 'wait' ? 'Atención' : 'Baja'}</span>` : ''}</div>
      <div><div class="lab">${x.lab}</div><div class="val">${x.val}</div><div class="meta">${x.meta}</div></div></div>`).join('')
    $('#nsub').textContent = `${esHoy ? 'Hoy' : 'Al ' + fechaCorta(d)} · ${scopeLabel()}`
    this.tabla()
  },
  tabla() {
    const d = this.fecha, nivel = this.nivel, esHoy = d === DB.hoy
    const desde = addDays(d, -6), ag = agenda(desde, d), rec = sc.recaudo().filter((r) => r.fecha >= desde && r.fecha <= d)
    const m = new Map()
    const get = (r) => {
      const id = r[nivel + '_id']; let y = m.get(id)
      if (!y) { y = { nombre: nivel === 'ruta' ? r.ruta : r[nivel], resp: { ruta: r.asesor, oficina: r.gerente, gerencia: r.gerente, zona: r.zonal }[nivel], tot: 0, ok: 0, esp: 0, cob: 0 }; m.set(id, y) }
      return y
    }
    DB.rutas.filter(inScope).forEach(get)
    if (esHoy) sc.activos().forEach((c) => { const y = get(DB.R[c.ruta_id] || c); y.tot += c.saldo; if (alDia(c)) y.ok += c.saldo })
    else {
      const k0 = SCOPE
      DB.rutas.filter(inScope).forEach((r) => { SCOPE = 'ruta:' + r.ruta_id; const x = historiaNormalidad([d]).get(d); const y = get(r); y.tot += x.tot; y.ok += x.ok })
      SCOPE = k0
    }
    ag.forEach((v, k) => { const r = DB.R[+k.split('|')[0]]; if (r) get(r).esp += v.s })
    rec.forEach((x) => { const r = DB.R[x.ruta_id]; if (r) get(r).cob += x.monto })
    const rows = [...m.values()].map((y) => ({ ...y, p: y.tot ? Math.round((y.ok / y.tot) * 100) : 0, pc: pct(y.cob, y.esp) })).sort((a, b) => a.p - b.p)
    const chip = (p) => `<span class="st ${semaforo(p)}">${p}%</span>`
    const respT = { ruta: 'Asesor', oficina: 'Gerente', gerencia: 'Gerente', zona: 'Gerente zonal' }[nivel]
    $('#ntabla').innerHTML = tabla([
      { t: { ruta: 'Ruta', oficina: 'Oficina', gerencia: 'Gerencia', zona: 'Zona' }[nivel], k: 'nombre', b: 1 }, { t: respT, k: 'resp' },
      { t: 'Normalidad', num: 1, f: (r) => chip(r.p), tot: (r) => chip(Math.round((sum(r, (x) => x.ok) / Math.max(1, sum(r, (x) => x.tot))) * 100)) },
      { t: 'Cartera al día', num: 1, f: P('ok'), tot: T('ok') }, { t: 'Cartera total', num: 1, b: 1, f: P('tot'), tot: T('tot') },
      { t: 'Con atraso', num: 1, f: (r) => peso(r.tot - r.ok), tot: (r) => peso(sum(r, (x) => x.tot - x.ok)) },
      { t: 'Cobrado vs esperado (7 d)', num: 1, f: (r) => r.esp ? pct(r.cob, r.esp) + '%' : '—', tot: (r) => pct(sum(r, (x) => x.cob), sum(r, (x) => x.esp)) + '%' },
    ], rows, true)
  },
  grafica() {
    const fin = this.fecha, n = +this.rango, dd = rangoFechas(addDays(fin, -(n - 1)), fin)
    const H = historiaNormalidad(dd), meta = PARAM('meta_normalidad', 90)
    const ys = dd.map((d) => { const x = H.get(d); return x.tot ? +((x.ok / x.tot) * 100).toFixed(1) : null })
    $('#ngsub').textContent = `Últimos ${n} días hasta el ${fechaCorta(fin)} · ${scopeLabel()}`
    const old = charts.find((c) => c.canvas?.id === 'nchart'); if (old) { old.destroy(); charts = charts.filter((c) => c !== old) }
    chart($('#nchart'), {
      type: 'line',
      data: { labels: dd.map(fechaCorta), datasets: [
        { label: 'Normalidad', data: ys, borderColor: COL.teal, backgroundColor: COL.teal + '30', fill: true, tension: 0.3, borderWidth: 2.6, pointRadius: n > 31 ? 0 : 2 },
        { label: `Meta ${meta} %`, data: dd.map(() => meta), borderColor: 'rgba(255,255,255,.4)', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: COL.ink2, usePointStyle: true, boxHeight: 7, font: { weight: 600 } } }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${x.raw}%` } } },
        scales: { x: { grid: { color: COL.grid }, ticks: { color: COL.ink2, maxRotation: 0, autoSkipPadding: 12 } }, y: { grid: { color: COL.grid }, ticks: { color: COL.ink2, callback: (v) => v + '%' }, suggestedMin: 50, max: 100 } } },
    })
  },
  comparar() {
    const hoy = DB.hoy, mode = this.comp
    const inp = mode === 'dia' ? (k, v) => `<label class="field"><label>${k}</label><input class="ctl" type="date" data-k="${k}" value="${v}" max="${hoy}"></label>`
      : mode === 'mes' ? (k, v) => `<label class="field"><label>${k}</label><input class="ctl" type="month" data-k="${k}" value="${v}" max="${hoy.slice(0, 7)}"></label>`
      : (k, v) => `<label class="field sel"><label>${k}</label><select class="ctl" data-k="${k}">${Array.from({ length: 4 }, (_, i) => String(+hoy.slice(0, 4) - i)).map((y) => `<option${y === v ? ' selected' : ''}>${y}</option>`).join('')}</select></label>`
    $('#ncompIn').innerHTML = inp('A', this.A) + '<span class="muted">contra</span>' + inp('B', this.B)
    $$('#ncompIn [data-k]').forEach((el) => el.addEventListener('change', () => { if (el.value) { this[el.dataset.k] = el.value; this.comparar() } }))
    // Puntos de cada periodo
    let labels, serie
    if (mode === 'dia') {
      const H = historiaNormalidad([this.A, this.B])
      labels = ['Normalidad']
      serie = (x) => [H.get(x)].map((v) => (v.tot ? +((v.ok / v.tot) * 100).toFixed(1) : null))
    } else if (mode === 'mes') {
      const diasMes = (m) => { const fin = addDays(addDays(m + '-01', 32).slice(0, 8) + '01', -1); return rangoFechas(m + '-01', fin < hoy ? fin : hoy) }
      labels = Array.from({ length: 31 }, (_, i) => String(i + 1))
      serie = (m) => { const dd = diasMes(m); const H = historiaNormalidad(dd, 'mes'); return labels.map((_, i) => { const x = dd[i] && H.get(dd[i]); return x && x.tot ? +((x.ok / x.tot) * 100).toFixed(1) : null }) }
    } else {
      labels = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      serie = (y) => {
        const cortes = labels.map((_, i) => { const ini = `${y}-${String(i + 1).padStart(2, '0')}-01`; if (ini > hoy) return null; const sig = i === 11 ? `${+y + 1}-01-01` : `${y}-${String(i + 2).padStart(2, '0')}-01`; const fin = addDays(sig, -1); return fin <= hoy ? fin : hoy })
        const H = historiaNormalidad(cortes.filter(Boolean), 'anio')
        return cortes.map((d) => { const x = d && H.get(d); return x && x.tot ? +((x.ok / x.tot) * 100).toFixed(1) : null })
      }
    }
    const a = serie(this.A), b = serie(this.B)
    const prom = (v) => { const L = v.filter((x) => x != null); return L.length ? L.reduce((s, x) => s + x, 0) / L.length : null }
    const pa = prom(a), pb = prom(b), dif = pa != null && pb != null ? pb - pa : null
    const nombre = (x) => mode === 'dia' ? fechaCorta(x) : mode === 'mes' ? new Date(x + '-15T12:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }) : x
    $('#ncompK').innerHTML = [[nombre(this.A), pa], [nombre(this.B), pb]].map(([l, v]) => `<div class="card"><div class="lab">${esc(l)}${mode === 'dia' ? '' : ' (promedio)'}</div><div class="val">${v == null ? 'sin datos' : v.toFixed(1) + '%'}</div></div>`).join('')
      + `<div class="card"><div class="lab">Diferencia</div><div class="val" style="color:${dif == null ? 'inherit' : dif >= 0 ? 'var(--green)' : 'var(--red)'}">${dif == null ? '—' : (dif >= 0 ? '▲ +' : '▼ ') + dif.toFixed(1) + ' pts'}</div></div>`
    const old = charts.find((c) => c.canvas?.id === 'ncchart'); if (old) { old.destroy(); charts = charts.filter((c) => c !== old) }
    chart($('#ncchart'), {
      type: mode === 'dia' ? 'bar' : 'line',
      data: { labels, datasets: [
        { label: nombre(this.A), data: a, borderColor: COL.violet, backgroundColor: mode === 'dia' ? COL.violet + 'aa' : COL.violet + '22', borderWidth: 2.4, tension: 0.3, pointRadius: 2, spanGaps: true, borderRadius: 8 },
        { label: nombre(this.B), data: b, borderColor: COL.teal, backgroundColor: mode === 'dia' ? COL.teal + 'aa' : COL.teal + '22', borderWidth: 2.4, tension: 0.3, pointRadius: 2, spanGaps: true, borderRadius: 8 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: COL.ink2, usePointStyle: true, boxHeight: 7, font: { weight: 600 } } }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${x.raw ?? '—'}%` } } },
        scales: { x: { grid: { color: COL.grid }, ticks: { color: COL.ink2, maxRotation: 0, autoSkipPadding: 8 } }, y: { grid: { color: COL.grid }, ticks: { color: COL.ink2, callback: (v) => v + '%' }, suggestedMin: 50, max: 100 } } },
    })
  },
}

// ============================================================ Proyecciones
// En la mañana el gerente sube cuánto va a cobrar y colocar cada oficina; en la tarde, lo que logró.
const puedeProyectar = () => puede('capturar_proyecciones')
VIEWS.proyecciones = {
  fecha: null,
  html() {
    this.fecha = this.fecha || DB.hoy
    return `${head('Proyecciones', 'Meta de la mañana contra logro de la tarde, por oficina: cobranza y colocación.',
      `<label class="field"><label>Fecha</label><input class="ctl" type="date" id="pfecha" value="${this.fecha}"></label>`)}
      <section class="kpis" id="pk"></section>
      <div class="card panel"><div class="ph"><div><h3>Por oficina</h3><div class="sub" id="psub"></div></div></div><div id="ptab"></div>
        <div class="note">«Sistema» es lo que registró la plataforma ese día. Si el gerente no captura su logro, se usa el del sistema.</div></div>
      <div class="card panel"><div class="ph"><div><h3>Cumplimiento de los últimos 30 días</h3><div class="sub">${esc(scopeLabel())}</div></div></div><div class="chart-box" style="height:240px"><canvas id="pchart"></canvas></div></div>`
  },
  datos(d) {
    const ofs = DB.oficinas.filter((o) => sc.rutas().some((r) => r.oficina_id === o.id))
    const rec = sc.recaudo().filter((r) => r.fecha === d), col = sc.cartera().filter((c) => c.fecha_inicio === d)
    return ofs.map((o) => {
      const pr = DB.proyecciones.find((x) => x.fecha === d && x.oficina_id === o.id) || {}
      const sCob = sum(rec.filter((r) => r.oficina_id === o.id), (r) => r.monto), sCol = sum(col.filter((c) => c.oficina_id === o.id), (c) => c.entregado)
      const lCob = pr.logro_cobro ?? sCob, lCol = pr.logro_colocacion ?? sCol
      const g = sc.rutas().find((r) => r.oficina_id === o.id)
      return { id: o.id, nombre: o.nombre, gerente: g?.gerente || '', mCob: pr.meta_cobro, mCol: pr.meta_colocacion, lCob, lCol, sCob, sCol, capt: pr.logro_cobro != null }
    })
  },
  init() {
    $('#pfecha').addEventListener('change', (e) => { if (e.target.value) { this.fecha = e.target.value; reveal(); this.pintar() } })
    this.pintar(); this.grafica()
  },
  pintar() {
    const d = this.fecha, rows = this.datos(d)
    const tm = (k) => sum(rows, (r) => r[k] || 0)
    const cc = pct(tm('lCob'), tm('mCob')), cl = pct(tm('lCol'), tm('mCol'))
    const k = [['Meta de cobranza', peso(tm('mCob')), `logrado ${peso(tm('lCob'))}`], ['Cumplimiento cobranza', tm('mCob') ? cc + '%' : '—', tm('mCob') ? (cc >= 100 ? 'meta cumplida' : 'falta ' + peso(tm('mCob') - tm('lCob'))) : 'sin meta capturada'],
      ['Meta de colocación', peso(tm('mCol')), `logrado ${peso(tm('lCol'))}`], ['Cumplimiento colocación', tm('mCol') ? cl + '%' : '—', tm('mCol') ? (cl >= 100 ? 'meta cumplida' : 'falta ' + peso(tm('mCol') - tm('lCol'))) : 'sin meta capturada']]
    $('#pk').innerHTML = k.map(([l, v, m], i) => `<div class="card kpi lift"><div class="row1"><div class="ico" style="background:linear-gradient(135deg,${[COL.teal, COL.green, COL.violet, COL.blue][i]},${COL.blue})"><svg viewBox="0 0 24 24">${ICON.proyecciones}</svg></div></div><div><div class="lab">${l}</div><div class="val">${v}</div><div class="meta">${m}</div></div></div>`).join('')
    $('#psub').textContent = `${d === DB.hoy ? 'Hoy' : fechaCorta(d)} · ${scopeLabel()}`
    const chip = (a, b) => b ? `<span class="st ${pct(a, b) >= 100 ? 'ok' : pct(a, b) >= 85 ? 'wait' : 'bad'}">${pct(a, b)}%</span>` : '—'
    $('#ptab').innerHTML = tabla([
      { t: 'Oficina', k: 'nombre', b: 1 }, { t: 'Gerente', k: 'gerente' },
      { t: 'Meta cobro', num: 1, f: (r) => r.mCob != null ? peso(r.mCob) : '—', tot: (rr) => peso(sum(rr, (x) => x.mCob || 0)) }, { t: 'Logro cobro', num: 1, b: 1, f: (r) => peso(r.lCob) + (r.capt ? '' : ' <span class="muted">(sistema)</span>'), tot: (rr) => peso(sum(rr, (x) => x.lCob)) },
      { t: '% cobro', num: 1, f: (r) => chip(r.lCob, r.mCob), tot: (rr) => chip(sum(rr, (x) => x.lCob), sum(rr, (x) => x.mCob || 0)) },
      { t: 'Meta colocación', num: 1, f: (r) => r.mCol != null ? peso(r.mCol) : '—', tot: (rr) => peso(sum(rr, (x) => x.mCol || 0)) }, { t: 'Logro colocación', num: 1, b: 1, f: (r) => peso(r.lCol), tot: (rr) => peso(sum(rr, (x) => x.lCol)) },
      { t: '% colocación', num: 1, f: (r) => chip(r.lCol, r.mCol), tot: (rr) => chip(sum(rr, (x) => x.lCol), sum(rr, (x) => x.mCol || 0)) },
      { t: '', f: (r) => puedeProyectar() ? `<button class="btn ghost sm" type="button" data-proy="${r.id}">Capturar</button>` : '' },
    ], rows, true)
    $$('[data-proy]').forEach((b) => b.addEventListener('click', () => this.capturar(rows.find((r) => r.id === +b.dataset.proy))))
  },
  capturar(r) {
    const tarde = new Date().getHours() >= 12 || this.fecha < DB.hoy
    formModal({
      titulo: `Proyección · Oficina ${esc(r.nombre)}`, nota: `${this.fecha === DB.hoy ? 'Hoy' : fechaCorta(this.fecha)}. En la mañana captura la meta; en la tarde, antes del cierre, el logro.`, boton: 'Guardar',
      campos: [{ id: 'mCob', label: 'Meta de cobranza', tipo: 'number', min: 0, step: '100', valor: r.mCob ?? '' }, { id: 'mCol', label: 'Meta de colocación', tipo: 'number', min: 0, step: '500', valor: r.mCol ?? '' },
        { id: 'lCob', label: `Logro de cobranza (sistema: ${peso(r.sCob)})`, tipo: 'number', min: 0, step: '0.01', valor: r.capt ? r.lCob : (tarde ? r.sCob : '') }, { id: 'lCol', label: `Logro de colocación (sistema: ${peso(r.sCol)})`, tipo: 'number', min: 0, step: '0.01', valor: r.capt ? r.lCol : (tarde ? r.sCol : '') }],
      guardar: async (v) => {
        const num = (x) => (x === '' ? null : +x)
        const ok = await escribir(() => sb.from('proyecciones').upsert({ fecha: this.fecha, oficina_id: r.id, meta_cobro: num(v.mCob), meta_colocacion: num(v.mCol), logro_cobro: num(v.lCob), logro_colocacion: num(v.lCol), capturado_por: DB.perfil.id, actualizado: new Date().toISOString() }, { onConflict: 'fecha,oficina_id' }))
        return ok ? 'Proyección guardada.' : ''
      },
    })
  },
  grafica() {
    const dd = rangoFechas(addDays(DB.hoy, -29), DB.hoy)
    const ser = dd.map((d) => { const R = this.datos(d); const mc = sum(R, (x) => x.mCob || 0), ml = sum(R, (x) => x.mCol || 0); return [mc ? pct(sum(R, (x) => x.lCob), mc) : null, ml ? pct(sum(R, (x) => x.lCol), ml) : null] })
    chart($('#pchart'), {
      type: 'line',
      data: { labels: dd.map(fechaCorta), datasets: [
        { label: '% cobranza', data: ser.map((x) => x[0]), borderColor: COL.teal, backgroundColor: COL.teal + '25', fill: true, tension: 0.3, borderWidth: 2.4, pointRadius: 2, spanGaps: true },
        { label: '% colocación', data: ser.map((x) => x[1]), borderColor: COL.violet, tension: 0.3, borderWidth: 2.2, pointRadius: 2, spanGaps: true },
        { label: 'Meta 100 %', data: dd.map(() => 100), borderColor: 'rgba(255,255,255,.4)', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: COL.ink2, usePointStyle: true, boxHeight: 7, font: { weight: 600 } } }, tooltip: { callbacks: { label: (x) => ` ${x.dataset.label}: ${x.raw ?? '—'}%` } } },
        scales: { x: { grid: { color: COL.grid }, ticks: { color: COL.ink2, maxRotation: 0, autoSkipPadding: 12 } }, y: { grid: { color: COL.grid }, ticks: { color: COL.ink2, callback: (v) => v + '%' }, beginAtZero: true, suggestedMax: 130 } } },
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
  DB.cartera.forEach((c) => { if (c.fecha_inicio <= hasta) add('ruta:' + c.ruta_id, -c.entregado) })
  return s
}
VIEWS.tesoreria = {
  periodo: 'mes', tipo: 'todos',
  html() {
    return `${head('Tesorería', 'El dinero de la empresa de punta a punta: socios y bancos, cajas de gerentes, cajas de asesores y cartera en la calle.',
      `<div class="seg" id="tper">${[['semana', 'Semana'], ['mes', 'Mes']].map(([k, t]) => `<button type="button" data-p="${k}" class="${this.periodo === k ? 'on' : ''}">${t}</button>`).join('')}</div>${esAdmin() ? '<button class="btn ghost" type="button" id="tinv">Inversión de capital</button>' : ''}${['dueno', 'soporte'].includes(DB.perfil.rol) ? '<button class="btn ghost" type="button" id="tret">Retiro de utilidades</button>' : ''}${puede('tesoreria_excedente') ? '<button class="btn ghost" type="button" id="texc">Excedente de gerente → banco</button>' : ''}${esAdmin() ? '<button class="btn" type="button" id="tnuevo"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Otro movimiento</button>' : ''}`)}
      <section class="kpis" id="tk"></section>
      <div class="card panel"><div class="ph"><div><h3>Flujo del dinero</h3><div class="sub" id="tflsub"></div></div></div><div class="flow" id="tflow"></div></div>
      <div class="grid2">
        <div class="card panel"><div class="ph"><div><h3>Balance de caja</h3><div class="sub" id="tbsub"></div></div></div><div class="kv" id="tbal"></div></div>
        <div class="card panel"><div class="ph"><div><h3>Utilidad del periodo</h3><div class="sub">Interés del periodo menos gastos</div></div></div><div class="kv" id="tutil"></div>
          <div class="note">El sistema actual cuenta todo el interés como utilidad el día que se presta. Aquí ves las dos: la que se reconoce al prestar y la que realmente entra al cobrar.</div></div>
      </div>
      <div class="grid2">
        <div class="card panel"><div class="ph"><h3>Cajas</h3><span class="chip" id="tcnt"></span></div><div class="list" id="tcajas"></div></div>
        <div class="card panel"><div class="ph"><h3>Movimientos</h3><div class="tabs" id="ttipo">${[['todos', 'Todos'], ['traslado', 'Traslados'], ['deposito', 'Depósitos'], ['retiro', 'Retiros'], ['egreso', 'Gastos'], ['ingreso', 'Ingresos'], ['fondeo', 'Inversiones']].map(([k, t]) => `<button type="button" data-t="${k}" class="${this.tipo === k ? 'on' : ''}">${t}</button>`).join('')}</div></div><div id="tmov"></div></div>
      </div>`
  },
  init() {
    $$('#tper button').forEach((b) => b.addEventListener('click', () => { this.periodo = b.dataset.p; $$('#tper button').forEach((x) => x.classList.toggle('on', x === b)); reveal(); this.pintar() }))
    $$('#ttipo button').forEach((b) => b.addEventListener('click', () => { this.tipo = b.dataset.t; $$('#ttipo button').forEach((x) => x.classList.toggle('on', x === b)); this.movs() }))
    $('#tnuevo')?.addEventListener('click', () => this.nuevo())
    $('#tinv')?.addEventListener('click', () => this.rapido('inversion'))
    $('#tret')?.addEventListener('click', () => this.rapido('retiro'))
    $('#texc')?.addEventListener('click', () => this.rapido('excedente'))
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
    const prest = sum(sc.cartera().filter((c) => c.fecha_inicio >= desde && c.fecha_inicio <= hoy), (c) => c.entregado)
    const segP = sumM((m) => esGA(m) && isIn(m.caja_destino))
    const ing = sumM((m) => m.caja_origen === 'externo' && isIn(m.caja_destino))
    const egr = sumM((m) => m.caja_destino === 'externo' && isIn(m.caja_origen))
    const ent = sumM((m) => m.caja_origen !== 'externo' && !isIn(m.caja_origen) && isIn(m.caja_destino))
    const sal = sumM((m) => m.caja_destino !== 'externo' && isIn(m.caja_origen) && !isIn(m.caja_destino))
    const Si = saldos(addDays(desde, -1)), inicial = sum([...set], (k) => Si.get(k) || 0)
    const final = inicial + rec - prest + ing - egr + ent - sal
    $('#tbsub').textContent = `${lab[0].toUpperCase() + lab.slice(1)} · ${scopeLabel()}`
    const row = (k, v, cls = '') => `<div class="r"><span class="k ${cls}">${k}</span><span class="v ${cls}">${v}</span></div>`
    $('#tbal').innerHTML = row('Caja inicial', peso(inicial)) + row('+ Cobrado a clientes', peso(rec)) + row('− Préstamos entregados', peso(prest)) + row('+ Gastos administrativos', peso(segP)) + row('+ Inversión y otros ingresos', peso(ing - segP)) + row('− Gastos', peso(egr))
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
    const L = DB.movimientos.filter((m) => (set.has(m.caja_origen) || set.has(m.caja_destino)) && (this.tipo === 'todos' || m.tipo === this.tipo))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.id || 0) - (a.id || 0)).slice(0, 80)
    $('#tmov').innerHTML = tabla([
      { t: 'Fecha', k: 'fecha' }, { t: 'Concepto', f: (m) => `<b>${esc(m.concepto || m.categoria || m.tipo)}</b><div class="muted" style="font-size:12px">${esc(m.categoria || '')}</div>` },
      { t: 'De', f: (m) => esc(cajaNombre(m.caja_origen)) }, { t: 'A', f: (m) => esc(cajaNombre(m.caja_destino)) }, { t: 'Monto', num: 1, b: 1, f: P('monto') },
    ], L)
  },
  rapido(tipo) {
    const S = saldos(DB.hoy), bancos = DB.cuentas.map((b) => ['banco:' + b.id, cajaNombre('banco:' + b.id) + ' · ' + peso(S.get('banco:' + b.id) || 0)])
    const gers = DB.gerencias.filter((g) => sc.rutas().some((r) => r.gerencia_id === g.id)).map((g) => ['gerencia:' + g.id, cajaNombre('gerencia:' + g.id) + ' · en caja ' + peso(S.get('gerencia:' + g.id) || 0)])
    if (!bancos.length) { toast('Primero da de alta una cuenta bancaria.', 'warn'); return }
    const C = {
      inversion: { titulo: 'Inversión de capital', nota: 'Entra dinero de fuera al banco para tener capital para prestar.', campos: [{ id: 'destino', label: 'Entra a', tipo: 'select', req: 1, opciones: bancos }],
        row: (v) => ({ tipo: 'fondeo', caja_origen: 'externo', caja_destino: v.destino, categoria: 'Inversión' }) },
      retiro: { titulo: 'Retiro de utilidades', nota: 'Sale dinero del banco para el dueño: utilidades, aguinaldos u otro. Sólo el dueño puede hacerlo.', campos: [{ id: 'origen', label: 'Sale de', tipo: 'select', req: 1, opciones: bancos }, { id: 'categoria', label: 'Para', tipo: 'select', req: 1, opciones: [['Utilidades', 'Utilidades'], ['Aguinaldos', 'Aguinaldos'], ['Otro retiro', 'Otro']] }],
        row: (v) => ({ tipo: 'retiro', caja_origen: v.origen, caja_destino: 'externo', categoria: v.categoria }) },
      excedente: { titulo: 'Excedente de gerente → banco', nota: 'Tesorería retira el dinero de más de la caja de un gerente y lo deposita al banco. A los asesores no se les retira.', campos: [{ id: 'origen', label: 'Caja del gerente', tipo: 'select', req: 1, opciones: gers }, { id: 'destino', label: 'Se deposita en', tipo: 'select', req: 1, opciones: bancos }],
        row: (v) => ({ tipo: 'deposito', caja_origen: v.origen, caja_destino: v.destino, categoria: 'Depósito de excedente' }) },
    }[tipo]
    formModal({
      titulo: C.titulo, nota: C.nota, boton: 'Registrar',
      campos: [...C.campos, { id: 'concepto', label: 'Concepto', req: 1, valor: C.titulo }, { id: 'monto', label: 'Monto (MXN)', tipo: 'number', min: 1, step: '0.01', req: 1 }, { id: 'fecha', label: 'Fecha', tipo: 'date', req: 1, valor: DB.hoy }],
      guardar: async (v) => {
        const err = (m) => { const e = new Error(m); e.userMsg = m; throw e }
        if (!(+v.monto > 0)) err('El monto debe ser mayor a cero.')
        const row = C.row(v)
        if (row.caja_origen !== 'externo' && +v.monto > (S.get(row.caja_origen) || 0) + 0.01) err(`En esa caja sólo hay ${peso(S.get(row.caja_origen) || 0)}.`)
        const ok = await escribir(() => sb.from('movimientos_tesoreria').insert({ ...row, fecha: v.fecha, concepto: v.concepto, monto: +v.monto, creado_por: DB.perfil.id }))
        return ok ? 'Movimiento registrado.' : ''
      },
    })
  },
  nuevo() {
    const cajas = [['externo', 'Externo (fuera de la empresa)'], ...DB.cuentas.map((b) => ['banco:' + b.id, cajaNombre('banco:' + b.id)]),
      ...DB.gerencias.map((g) => ['gerencia:' + g.id, cajaNombre('gerencia:' + g.id)]), ...DB.rutas.map((r) => ['ruta:' + r.ruta_id, cajaNombre('ruta:' + r.ruta_id)])]
    formModal({
      titulo: 'Registrar movimiento', nota: 'Queda en la bitácora con tu usuario, fecha y hora.',
      campos: [
        { id: 'tipo', label: 'Tipo', tipo: 'select', req: 1, opciones: [['deposito', 'Depósito a banco'], ['retiro', 'Retiro de banco'], ['traslado', 'Traslado entre cajas'], ['egreso', 'Gasto'], ['ingreso', 'Ingreso'], ['fondeo', 'Inversión de capital']] },
        { id: 'origen', label: 'Sale de', tipo: 'select', req: 1, opciones: cajas }, { id: 'destino', label: 'Entra a', tipo: 'select', req: 1, opciones: cajas, valor: cajas[1]?.[0] },
        { id: 'concepto', label: 'Concepto', req: 1 }, { id: 'monto', label: 'Monto (MXN)', tipo: 'number', min: 1, step: '0.01', req: 1 },
        { id: 'fecha', label: 'Fecha', tipo: 'date', req: 1, valor: DB.hoy }, { id: 'obs', label: 'Observación' },
      ],
      guardar: async (v) => {
        const err = (m) => { const e = new Error(m); e.userMsg = m; throw e }
        if (v.origen === v.destino) err('El origen y el destino no pueden ser la misma caja.')
        if (['ingreso', 'fondeo'].includes(v.tipo) && v.origen !== 'externo') err('Un ingreso o inversión debe salir de «Externo».')
        if (v.origen.startsWith('banco:') && v.destino === 'externo' && !['dueno', 'soporte'].includes(DB.perfil.rol)) err('Sólo el dueño puede sacar dinero del banco hacia fuera.')
        if (v.tipo === 'egreso' && v.destino !== 'externo') err('Un gasto debe ir a «Externo».')
        if (!(+v.monto > 0)) err('El monto debe ser mayor a cero.')
        const ok = await escribir(() => sb.from('movimientos_tesoreria').insert({ fecha: v.fecha, tipo: v.tipo, caja_origen: v.origen, caja_destino: v.destino, concepto: v.concepto, categoria: { deposito: 'Depósito', retiro: 'Retiro', traslado: 'Traslado', egreso: 'Gasto', ingreso: 'Ingreso', fondeo: 'Inversión' }[v.tipo], monto: +v.monto, observacion: v.obs || null, creado_por: DB.perfil.id }))
        return ok ? 'Movimiento registrado.' : ''
      },
    })
  },
}

boot()
