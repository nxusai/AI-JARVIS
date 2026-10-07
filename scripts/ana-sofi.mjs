#!/usr/bin/env node
// Connect Nexy to Mi Semago's leads Sheet and to Ana Sofi, the sales agent.
//
//   node scripts/ana-sofi.mjs            1) copies the Sheet script to paste in Apps Script
//                                        2) asks for the web-app link, Agent ID and Phone number ID
//                                        3) reads the Sheet once to prove it works
//   node scripts/ana-sofi.mjs script     only copies the Sheet script again
//   node scripts/ana-sofi.mjs estado     what is set up, and the leads it can see
//   node scripts/ana-sofi.mjs revisar    why each lead was or was not called, piece by piece
//   node scripts/ana-sofi.mjs entrantes  lets leads call Ana Sofi back: makes her inbound twin and gives it the number
//   node scripts/ana-sofi.mjs avisos meetings | todo   what reaches the owner: only video calls (default) or everything
//
// The Sheet script answers only to a long random key made here, kept in
// ~/.nexy/ventas.json (readable by this user only) and inside the script in
// the owner's own Sheet. It can read the rows and write only Nexy's six
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
  createInboundAgent,
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
  return `// Nexy ↔ Leads Mi Semago. Pegado por scripts/ana-sofi.mjs. No compartas este código: la llave de abajo abre tu Sheet.
const TOKEN = '${token}';
const SHEET_NAME = 'Leads';
// Las únicas columnas que Nexy puede escribir.
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
  try {
    const leads = await readLeads()
    const pending = leads.filter((l) => wantsCall(l) && !l.estado).length
    say(`\n✅ Leí el Sheet: ${leads.length} lead(s); ${pending} esperando que Ana Sofi les llame.`)
    if (pending) say('   Ojo: en cuanto prendas a Nexy, Ana Sofi va a programar llamadas para esos leads.')
    if (leads.length && leads[0].contacto === undefined) say('   ⚠️ No encontré la columna "Contacto ID". Revisa que los títulos de la fila 1 se llamen como en ManyChat.')
    return true
  } catch (err) {
    say(`\n✋ No pude leer el Sheet: ${err.message}`)
    return false
  }
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
  if (await check()) say('\nListo. Reinicia a Nexy (Ctrl + C y npm start) para que Ana Sofi empiece a trabajar.\n')
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
  nuevo: 'Nexy lo recibió y está programando la llamada',
  programada: 'llamada programada',
  callback: 'pidió otra llamada; Nexy la reprograma',
  reunion_pendiente: 'aceptó el precio; falta que apruebes la invitación',
  cerrado: 'terminado',
  fuera: 'número fuera de EE.UU.',
  atorado: 'Nexy no pudo programarla',
}

async function revisar() {
  const cfg = readSalesConfig()
  const good = (t) => say(`  ✅ ${t}`)
  const bad = (t) => say(`  ❌ ${t}`)
  say('\n— Conexión')
  const missing = salesMissing(cfg)
  if (missing.length) bad(`Falta: ${missing.join(', ')}. Corre: node scripts/ana-sofi.mjs`)
  else good('Sheet, Agent ID y Phone number ID guardados')

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

  say('\n— Nexy')
  const port = Number(process.env.JARVIS_BRIDGE_PORT ?? 8787)
  const up = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' }).stdout?.trim()
  if (up) good('Nexy está prendida')
  else bad('Nexy está apagada. Préndela con: cd ~/Desktop/nexy && npm start')
  if (readTelegram()?.owner) good('Telegram conectado')
  else bad('Telegram no está conectado: Nexy no tiene a quién avisar ni cómo trabajar sola')
  if (existsSync(join(homedir(), '.nexy', 'mudada.json'))) bad('Esta Mac está marcada como "mudada": aquí Nexy no revisa el Sheet')

  say('\n— Leads en el Sheet')
  let leads = []
  try {
    leads = await readLeads(cfg)
    good(`Leí el Sheet: ${leads.length} fila(s)`)
    if ((await sheetVersion(cfg)) < 2) bad('El script del Sheet es la versión vieja. Actualízalo: node scripts/ana-sofi.mjs script, pégalo en Apps Script y publica una versión nueva')
    else good('Script del Sheet al día')
  } catch (err) {
    bad(`No pude leer el Sheet: ${err.message}`)
  }
  const state = readSalesState()
  for (const l of leads.slice(-15)) {
    const name = `fila ${l.row} · ${l.nombre || '-'} · ${l.empresa || '-'}`
    const s = state[l.key]
    let why
    if (!wantsCall(l)) why = `no se llama: Calificación es "${l.calificacion || 'vacía'}" (solo caliente o medio)`
    else if (!usPhone(l.telefono)) why = `no se llama: el Teléfono "${l.telefono || 'vacío'}" no es de EE.UU.`
    else if (s) why = `${STAGES[s.stage] ?? s.stage}${s.at ? ` · ${new Date(s.at).toLocaleString('es-MX')}` : ''}`
    else if (l.estado) why = `no se llama: la columna Estado ya dice "${l.estado}" (bórrala para que Ana Sofi lo llame)`
    else why = 'listo para llamar: Nexy lo toma en su siguiente revisión (cada 3 minutos, con Nexy prendida)'
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
  say('\nReinicia a Nexy (Ctrl + C y npm start) para que empiece a leer esas llamadas.\n')
}

async function estado() {
  const cfg = readSalesConfig()
  const missing = salesMissing(cfg)
  say(missing.length ? `\n🟡 Falta: ${missing.join(', ')}.` : '\n🟢 Ana Sofi está conectada.')
  if (cfg.agentId) say(`   Agente: ${cfg.agentId}`)
  if (cfg.phoneId) say(`   Número: ${cfg.phoneId}`)
  if (!missing.includes('el link del Sheet') && !missing.includes('la llave del Sheet')) await check()
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
else say('\nUso: node scripts/ana-sofi.mjs [script|estado|revisar|entrantes]\n')
