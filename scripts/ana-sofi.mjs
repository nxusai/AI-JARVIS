#!/usr/bin/env node
// Connect NEX to Mi Semago's leads Sheet and to Ana Sofi, the sales agent.
//
//   node scripts/ana-sofi.mjs            1) copies the Sheet script to paste in Apps Script
//                                        2) asks for the web-app link, Agent ID and Phone number ID
//                                        3) reads the Sheet once to prove it works
//   node scripts/ana-sofi.mjs script     only copies the Sheet script again
//   node scripts/ana-sofi.mjs estado     what is set up, and the leads it can see
//   node scripts/ana-sofi.mjs revisar    why each lead was or was not called, piece by piece
//   node scripts/ana-sofi.mjs entrantes  lets leads call Ana Sofi back: makes her inbound twin and gives it the number
//   node scripts/ana-sofi.mjs avisos meetings | todo   what reaches the owner: only video calls (default) or everything
//   node scripts/ana-sofi.mjs centro     the leads come from the Centro de trabajo (not the Sheet): asks for its
//                                        service key from the clipboard, copies the Sheet's leads once, and switches
//   node scripts/ana-sofi.mjs sheet      back to the Sheet
//
// The Sheet script answers only to a long random key made here, kept in
// ~/.nexy/ventas.json (readable by this user only) and inside the script in
// the owner's own Sheet. It can read the rows and write only NEX's six
// columns. Nothing here is a password to Google: the script runs as the
// owner, inside their Sheet.

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import {
  assignInbound,
  centro,
  createInboundAgent,
  fromCentro,
  readLeads,
  readSalesConfig,
  readSalesState,
  salesMissing,
  sheetVersion,
  usPhone,
  wantsCall,
  writeSalesConfig,
} from '../bridge/ventas.mjs'
import { readTelegram } from '../bridge/telegram-config.mjs'

const say = (s = '') => console.log(s)
const SCRIPT_FILE = join(homedir(), '.nexy', 'mi-semago-sheet.gs')

function appsScript(token) {
  return `// NEX ↔ Leads Mi Semago. Pegado por scripts/ana-sofi.mjs. No compartas este código: la llave de abajo abre tu Sheet.
const TOKEN = '${token}';
const SHEET_NAME = 'Leads';
// Las únicas columnas que NEX puede escribir.
const WRITABLE = ['Fecha', 'Estado', 'Llamada programada', 'Resultado', 'Reunión', 'Notas'];
const VERSION = 2;

function norm_(s) {
  return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
// Un texto que empieza con = + - @ se guardaría como fórmula.
function safe_(v) {
  const s = String(v == null ? '' : v).slice(0, 2000);
  return /^[=+\\-@]/.test(s) ? "'" + s : s;
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.token !== TOKEN) return out_({ error: 'llave' });
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh) return out_({ error: 'no encuentro la pestaña ' + SHEET_NAME });
  const values = sh.getDataRange().getDisplayValues();
  const headers = values[0] || [];

  if (p.action === 'version') return out_({ version: VERSION });

  if (p.action === 'leads') {
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      if (!values[i].some(function (v) { return v !== ''; })) continue;
      const r = { row: i + 1 };
      headers.forEach(function (h, j) { if (h) r[h] = values[i][j]; });
      rows.push(r);
    }
    return out_({ headers: headers, rows: rows });
  }

  if (p.action === 'update') {
    const row = Number(p.row);
    if (!(row >= 2 && row <= sh.getLastRow())) return out_({ error: 'fila' });
    let fields;
    try { fields = JSON.parse(p.fields || '{}'); } catch (err) { return out_({ error: 'datos' }); }
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const idCol = headers.findIndex(function (h) { return norm_(h) === 'contacto id'; });
      if (p.id && idCol >= 0 && String(sh.getRange(row, idCol + 1).getDisplayValue()) !== String(p.id)) {
        return out_({ error: 'la fila ya no es de ese lead' });
      }
      Object.keys(fields).forEach(function (k) {
        if (!WRITABLE.some(function (w) { return norm_(w) === norm_(k); })) return;
        // El título puede traer más palabras: "Resultado llamada", "Reunión agendada".
        let col = headers.findIndex(function (h) { return norm_(h) === norm_(k); });
        if (col < 0) col = headers.findIndex(function (h) { return norm_(h).indexOf(norm_(k) + ' ') === 0; });
        if (col >= 0) sh.getRange(row, col + 1).setValue(safe_(fields[k]));
      });
    } finally {
      lock.releaseLock();
    }
    return out_({ ok: true });
  }

  return out_({ error: 'acción' });
}
`
}

function copyScript(token) {
  const code = appsScript(token)
  mkdirSync(join(homedir(), '.nexy'), { recursive: true })
  writeFileSync(SCRIPT_FILE, code, { mode: 0o600 })
  const copied = process.platform === 'darwin' && spawnSync('pbcopy', { input: code }).status === 0
  say(copied ? '\n✅ Copié el script del Sheet. Ya lo puedes pegar (Cmd + V) en Apps Script.' : `\nEl script del Sheet quedó en: ${SCRIPT_FILE}`)
}

async function check() {
  const lugar = fromCentro() ? 'el Centro de trabajo' : 'el Sheet'
  try {
    const leads = await readLeads()
    const pending = leads.filter((l) => wantsCall(l) && !l.estado).length
    say(`\n✅ Leí ${lugar}: ${leads.length} lead(s); ${pending} esperando que Ana Sofi les llame.`)
    if (pending) say('   Ojo: en cuanto prendas a NEX, Ana Sofi va a programar llamadas para esos leads.')
    if (leads.length && leads[0].contacto === undefined) say('   ⚠️ No encontré la columna "Contacto ID". Revisa que los títulos de la fila 1 se llamen como en ManyChat.')
    return true
  } catch (err) {
    say(`\n✋ No pude leer ${lugar}: ${err.message}`)
    return false
  }
}

// ── el Centro de trabajo ──────────────────────────────────────────────────

const CENTRO_PAGINA = 'https://centro-misemago-abuelito.netlify.app'

const ETAPA_DESDE_SHEET = (l, s) => {
  const e = String(l.estado ?? '').toLowerCase()
  if (!e) return wantsCall(l) ? 'nuevo' : 'no_califica'
  if (/videollamada agendada|reuni/.test(e)) return 'meet'
  if (/programada|segundo intento|reprogram/.test(e)) return s?.stage === 'programada' || s?.stage === 'callback' || s?.stage === 'nuevo' ? 'programada' : 'hablo'
  if (/no contest/.test(e)) return 'no_contesto'
  if (/no le interesa|no acept|fuera de ee|cancelada/.test(e)) return 'no_califica'
  return 'hablo'
}

async function aCentro() {
  say('\nVoy a cambiar a Ana Sofi para que tome los leads del Centro de trabajo en vez del Sheet.')
  let url = ''
  try {
    url = String((await (await fetch(`${CENTRO_PAGINA}/.netlify/functions/config`)).json()).url ?? '').replace(/\/+$/, '')
  } catch {}
  if (!/^https:\/\/[\w-]+\.supabase\.co$/.test(url)) return say('\n✋ No pude leer el Project URL del Centro de trabajo desde su página. Revisa tu internet y vuelve a intentar.\n')
  say(`   Centro de trabajo: ${url}`)
  say('\n1. En Supabase, proyecto "Centro de trabajo" → Project Settings → API Keys → Secret key → Reveal → copia la llave.')
  say('2. Regresa aquí y presiona Enter. La leo de lo que copiaste (no se ve en pantalla ni se guarda en ningún otro lado).')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  await rl.question('\nPresiona Enter cuando la hayas copiado… ')
  rl.close()
  const key = (spawnSync('pbpaste', { encoding: 'utf8' }).stdout ?? '').trim()
  if (key.length < 30 || /\s/.test(key)) return say('\n✋ Lo que copiaste no parece la llave. Cópiala otra vez y vuelve a correr: node scripts/ana-sofi.mjs centro\n')
  const cfgCentro = { ...readSalesConfig(), centroUrl: url, centroKey: key }
  try {
    await centro(cfgCentro, '/rest/v1/leads?select=id&limit=1')
  } catch (err) {
    return say(`\n✋ El Centro de trabajo no aceptó la llave o no tiene la tabla de Leads (${err.message}).\n   ¿Ya corriste el esquema en Supabase? ¿Copiaste la Secret key (no la Publishable)?\n`)
  }
  spawnSync('pbcopy', { input: '' }) // que la llave no se quede en el portapapeles
  say('✅ La llave sirve. (Borré tu portapapeles para que no se quede ahí.)')

  // Los leads del Sheet, una sola vez (si ya están, no se tocan).
  const cfg = readSalesConfig()
  let pasados = 0
  if (!fromCentro(cfg) && cfg.sheetUrl && cfg.token) {
    try {
      const leads = await readLeads(cfg)
      const state = readSalesState()
      const filas = leads
        .filter((l) => l.contacto)
        .map((l) => {
          const s = state[l.key]
          const etapa = ETAPA_DESDE_SHEET(l, s)
          const meet = /https:\/\/meet\.google\.com\/[\w-]+/.exec(l.reunion ?? '')?.[0] ?? ''
          return {
            manychat_id: l.contacto,
            origen: 'sheet',
            nombre: String(l.nombre ?? '').slice(0, 80),
            negocio: String(l.empresa ?? '').slice(0, 120),
            ciudad: String(l.ciudad ?? '').slice(0, 80),
            telefono: String(l.telefono ?? '').slice(0, 30),
            correo: /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(String(l.correo ?? '').trim()) ? String(l.correo).trim().toLowerCase() : '',
            idioma: /^(en|ingl)/i.test(String(l.idioma ?? '')) ? 'en' : 'es',
            hora_pedida: String(l.horario ?? '').slice(0, 200),
            tipo_negocio: String(l.tipo ?? '').slice(0, 200),
            quesos: String(l.quesos ?? '').slice(0, 300),
            libras: String(l.libras ?? '').slice(0, 120),
            frecuencia: String(l.frecuencia ?? '').slice(0, 120),
            marca_propia: String(l.marca ?? '').slice(0, 200),
            calificacion: /caliente|medio|frio|frío/i.exec(String(l.calificacion ?? ''))?.[0].toLowerCase().replace('í', 'i') ?? '',
            permiso_llamada: wantsCall(l),
            permiso_texto: wantsCall(l) ? 'Pidió llamada en el chat de WhatsApp (pasado del Sheet)' : '',
            etapa,
            llamada_programada: etapa === 'programada' && s?.at ? new Date(s.at).toISOString() : null,
            intentos: Number(s?.attempts ?? 0) || 0,
            resumen: [l.resultado, l.notas, l.reunion && !meet ? `Videollamada: ${l.reunion}` : ''].filter(Boolean).join('\n').slice(0, 4000),
            meet_link: meet,
            meet_evento: meet ? String(l.reunion).replace(meet, '').replace(/[·\s]+$/, '').slice(0, 200) : '',
          }
        })
      if (filas.length) {
        const nuevos = await centro(cfgCentro, '/rest/v1/leads?on_conflict=manychat_id', { method: 'POST', body: filas, prefer: 'resolution=ignore-duplicates,return=representation' })
        pasados = nuevos?.length ?? 0
      }
      // Las llamadas que ya estaban en marcha siguen igual: el estado de NEX pasa al lead nuevo.
      const todos = await centro(cfgCentro, '/rest/v1/leads?select=id,manychat_id&limit=5000')
      const porContacto = new Map(todos.filter((r) => r.manychat_id).map((r) => [r.manychat_id, r.id]))
      let movidos = 0
      for (const l of leads) {
        const id = porContacto.get(l.contacto)
        if (!id || !state[l.key] || state[`id:${id}`]) continue
        state[`id:${id}`] = { ...state[l.key] }
        delete state[l.key]
        movidos++
      }
      if (movidos) writeFileSync(join(homedir(), '.nexy', 'ventas-estado.json'), JSON.stringify(state, null, 2), { mode: 0o600 })
      say(`✅ Pasé ${pasados} lead(s) del Sheet al Centro de trabajo${leads.length - filas.length ? ` (${leads.length - filas.length} sin Contacto ID se quedaron solo en el Sheet)` : ''}.`)
    } catch (err) {
      say(`⚠️ No pude pasar los leads del Sheet (${err.message}). Sigo: los nuevos llegarán al Centro de trabajo.`)
    }
  }
  writeSalesConfig({ fuente: 'centro', centroUrl: url, centroKey: key })
  await check()
  say('\nListo. Desde ahora Ana Sofi toma los leads del Centro de trabajo (pestaña Leads).')
  say('Reinicia a NEX para que tome el cambio: en su Terminal Ctrl + C y luego:  cd ~/Desktop/nexy && npm start')
  say('Para regresar al Sheet: node scripts/ana-sofi.mjs sheet\n')
}

async function setup() {
  let cfg = readSalesConfig()
  if (cfg.token.length < 24) {
    writeSalesConfig({ token: randomBytes(24).toString('hex') })
    cfg = readSalesConfig()
  }
  copyScript(cfg.token)
  say('\nPégalo en el Sheet "Leads Mi Semago" → Extensiones → Apps Script, guarda, y publícalo como')
  say('aplicación web (Implementar → Nueva implementación → Aplicación web → Ejecutar como: Yo,')
  say('Quién tiene acceso: Cualquier persona). Copia el link que termina en /exec.\n')

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const ask = async (q, valid, current) => {
    for (;;) {
      const a = (await rl.question(current ? `${q} [Enter = dejar ${current.slice(0, 18)}…]: ` : `${q}: `)).trim()
      if (!a && current) return current
      if (valid.test(a)) return a
      say('   Eso no se ve bien, inténtalo otra vez.')
    }
  }
  try {
    const sheetUrl = await ask('Link de la aplicación web (termina en /exec)', /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/, cfg.sheetUrl)
    const agentId = await ask('Agent ID de Ana Sofi (agent_…)', /^agent_\w+$/, cfg.agentId)
    const phoneId = await ask('Phone number ID de Ana Sofi (phnum_…)', /^phnum_\w+$/, cfg.phoneId)
    writeSalesConfig({ sheetUrl, agentId, phoneId })
  } finally {
    rl.close()
  }
  if (await check()) say('\nListo. Reinicia a NEX (Ctrl + C y npm start) para que Ana Sofi empiece a trabajar.\n')
  else say('\nRevisa el paso de "Implementar" y vuelve a correr: node scripts/ana-sofi.mjs\n')
}

function elevenKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim()
  try {
    return JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8')).mcpServers?.elevenlabs?.env?.ELEVENLABS_API_KEY?.trim() ?? null
  } catch {
    return null
  }
}

async function eleven(key, path) {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/convai${path}`, { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(20_000) })
    return res.ok ? { data: await res.json() } : { error: res.status }
  } catch (err) {
    return { error: err.message }
  }
}

const STAGES = {
  nuevo: 'NEX lo recibió y está programando la llamada',
  programada: 'llamada programada',
  callback: 'pidió otra llamada; NEX la reprograma',
  reunion_pendiente: 'aceptó el precio; falta que apruebes la invitación',
  cerrado: 'terminado',
  fuera: 'número fuera de EE.UU.',
  atorado: 'NEX no pudo programarla',
}

async function revisar() {
  const cfg = readSalesConfig()
  const lugar = fromCentro(cfg) ? 'el Centro de trabajo' : 'el Sheet'
  const good = (t) => say(`  ✅ ${t}`)
  const bad = (t) => say(`  ❌ ${t}`)
  say('\n— Conexión')
  const missing = salesMissing(cfg)
  if (missing.length) bad(`Falta: ${missing.join(', ')}. Corre: node scripts/ana-sofi.mjs`)
  else good(`${fromCentro(cfg) ? 'Centro de trabajo' : 'Sheet'}, Agent ID y Phone number ID guardados`)

  const key = elevenKey()
  if (!key) bad('No encuentro la llave de ElevenLabs en esta Mac')
  else {
    const a = cfg.agentId ? await eleven(key, `/agents/${cfg.agentId}`) : { error: 'sin id' }
    if (a.error) bad(`ElevenLabs no reconoce el Agent ID ${cfg.agentId || ''} (${a.error})`)
    else good(`Agente: ${a.data.name ?? cfg.agentId}`)
    const p = cfg.phoneId ? await eleven(key, `/phone-numbers/${cfg.phoneId}`) : { error: 'sin id' }
    if (p.error) bad(`ElevenLabs no reconoce el Phone number ID ${cfg.phoneId || ''} (${p.error})`)
    else {
      good(`Número: ${p.data.phone_number ?? cfg.phoneId}`)
      const assigned = p.data.assigned_agent?.agent_id
      const want = cfg.inboundAgentId || cfg.agentId
      if (assigned && assigned !== want) bad(`Las llamadas que entran a ese número las contesta OTRO agente. Corre: node scripts/ana-sofi.mjs entrantes`)
      else if (cfg.inboundAgentId && assigned === want) good('Llamadas entrantes: las contesta "Ana Sofi · Llamadas entrantes"')
    }
    if (!cfg.inboundAgentId) say('  • Llamadas entrantes: todavía no. Para activarlas: node scripts/ana-sofi.mjs entrantes')
    else {
      const i = await eleven(key, `/agents/${cfg.inboundAgentId}`)
      if (i.error) bad(`ElevenLabs no encuentra el agente de llamadas entrantes (${i.error}). Corre: node scripts/ana-sofi.mjs entrantes`)
    }
  }

  say('\n— NEX')
  const port = Number(process.env.JARVIS_BRIDGE_PORT ?? 8787)
  const up = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' }).stdout?.trim()
  if (up) good('NEX está prendida')
  else bad('NEX está apagada. Préndela con: cd ~/Desktop/nexy && npm start')
  if (readTelegram()?.owner) good('Telegram conectado')
  else bad('Telegram no está conectado: NEX no tiene a quién avisar ni cómo trabajar sola')
  if (existsSync(join(homedir(), '.nexy', 'mudada.json'))) bad(`Esta Mac está marcada como "mudada": aquí NEX no revisa ${lugar}`)

  say(`\n— Leads en ${lugar}`)
  let leads = []
  try {
    leads = await readLeads(cfg)
    good(`Leí ${lugar}: ${leads.length} lead(s)`)
    if (!fromCentro(cfg)) {
      if ((await sheetVersion(cfg)) < 2) bad('El script del Sheet es la versión vieja. Actualízalo: node scripts/ana-sofi.mjs script, pégalo en Apps Script y publica una versión nueva')
      else good('Script del Sheet al día')
    }
  } catch (err) {
    bad(`No pude leer ${lugar}: ${err.message}`)
  }
  const state = readSalesState()
  for (const l of leads.slice(-15)) {
    const name = `${l.centro ? '' : `fila ${l.row} · `}${l.nombre || '-'} · ${l.empresa || '-'}`
    const s = state[l.key]
    let why
    if (!wantsCall(l)) why = l.centro ? 'no se llama: no dio permiso por escrito en el chat' : `no se llama: Calificación es "${l.calificacion || 'vacía'}" (solo caliente o medio)`
    else if (!usPhone(l.telefono)) why = `no se llama: el Teléfono "${l.telefono || 'vacío'}" no es de EE.UU.`
    else if (s) why = `${STAGES[s.stage] ?? s.stage}${s.at ? ` · ${new Date(s.at).toLocaleString('es-MX')}` : ''}`
    else if (l.estado) why = l.centro ? `no se llama otra vez: está en "${l.estado}"` : `no se llama: la columna Estado ya dice "${l.estado}" (bórrala para que Ana Sofi lo llame)`
    else why = 'listo para llamar: NEX lo toma en su siguiente revisión (cada 3 minutos, con NEX prendida)'
    say(`  • ${name}\n      ${why}`)
  }
  say()
}

async function entrantes() {
  const cfg = readSalesConfig()
  const missing = salesMissing(cfg)
  if (missing.length) return say(`\n✋ Primero conecta a Ana Sofi (falta ${missing.join(', ')}): node scripts/ana-sofi.mjs\n`)
  const key = elevenKey()
  if (!key) return say('\n✋ No encuentro la llave de ElevenLabs en esta Mac.\n')
  let id = cfg.inboundAgentId
  if (id && !(await eleven(key, `/agents/${id}`)).error) {
    say('\n✅ "Ana Sofi · Llamadas entrantes" ya existe.')
  } else {
    say('\nCreo "Ana Sofi · Llamadas entrantes" con la voz, el modelo, los idiomas y el catálogo de Ana Sofi…')
    const made = await createInboundAgent(key, cfg)
    if (made.error) return say(`\n✋ ${made.error}. Mándame foto de este mensaje.\n`)
    id = made.id
    writeSalesConfig({ inboundAgentId: id })
    say(`✅ Agente creado: ${id}`)
  }
  const a = await assignInbound(key, cfg, id)
  if (a.error) return say(`\n✋ No pude darle el número (error ${a.error}). Hazlo a mano: en ElevenLabs, tu número → Agent → "Ana Sofi · Llamadas entrantes".\n`)
  say('✅ Las llamadas que entran al número de Ana Sofi ahora las contesta ella, sabiendo quién llama.')
  say('   Las llamadas que Ana Sofi hace a los leads siguen saliendo igual.')
  say('\nReinicia a NEX (Ctrl + C y npm start) para que empiece a leer esas llamadas.\n')
}

async function estado() {
  const cfg = readSalesConfig()
  const missing = salesMissing(cfg)
  say(missing.length ? `\n🟡 Falta: ${missing.join(', ')}.` : '\n🟢 Ana Sofi está conectada.')
  if (cfg.agentId) say(`   Agente: ${cfg.agentId}`)
  if (cfg.phoneId) say(`   Número: ${cfg.phoneId}`)
  say(`   Leads desde: ${fromCentro(cfg) ? 'el Centro de trabajo' : 'el Sheet'}`)
  if (!missing.some((m) => /Sheet|Centro/.test(m))) await check()
  say()
}

const cmd = process.argv[2]
if (!cmd) await setup()
else if (cmd === 'script') {
  const cfg = readSalesConfig()
  if (cfg.token.length < 24) writeSalesConfig({ token: randomBytes(24).toString('hex') })
  copyScript(readSalesConfig().token)
} else if (cmd === 'estado') await estado()
else if (cmd === 'revisar') await revisar()
else if (cmd === 'entrantes') await entrantes()
else if (cmd === 'centro') await aCentro()
else if (cmd === 'sheet') {
  writeSalesConfig({ fuente: 'sheet' })
  say('\n Listo: Ana Sofi vuelve a tomar los leads del Sheet. Reinicia a NEX (Ctrl + C y npm start).\n')
}
else if (cmd === 'avisos') {
  const want = process.argv[3]
  if (want !== 'meetings' && want !== 'todo') {
    say(` Ahora: ${readSalesConfig().avisos === 'todo' ? 'te aviso de todo (cada lead, llamada y resultado)' : 'solo te aviso de meetings'}.`)
    say(' Cambiar: node scripts/ana-sofi.mjs avisos meetings   o   node scripts/ana-sofi.mjs avisos todo')
  } else {
    writeSalesConfig({ avisos: want })
    say(want === 'todo' ? ' Listo: te aviso de todo otra vez.' : ' Listo: solo te aviso cuando hay meeting (agendado, movido o cancelado). Lo demás queda en el Sheet y en la consola.')
  }
}
else say('\nUso: node scripts/ana-sofi.mjs [script|estado|revisar|entrantes|centro|sheet|avisos]\n')
