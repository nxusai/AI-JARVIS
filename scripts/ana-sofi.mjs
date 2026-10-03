#!/usr/bin/env node
// Connect Nexy to Mi Semago's leads Sheet and to Ana Sofi, the sales agent.
//
//   node scripts/ana-sofi.mjs            1) copies the Sheet script to paste in Apps Script
//                                        2) asks for the web-app link, Agent ID and Phone number ID
//                                        3) reads the Sheet once to prove it works
//   node scripts/ana-sofi.mjs script     only copies the Sheet script again
//   node scripts/ana-sofi.mjs estado     what is set up, and the leads it can see
//
// The Sheet script answers only to a long random key made here, kept in
// ~/.nexy/ventas.json (readable by this user only) and inside the script in
// the owner's own Sheet. It can read the rows and write only Nexy's six
// columns. Nothing here is a password to Google: the script runs as the
// owner, inside their Sheet.

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { readLeads, readSalesConfig, salesMissing, wantsCall, writeSalesConfig } from '../bridge/ventas.mjs'

const say = (s = '') => console.log(s)
const SCRIPT_FILE = join(homedir(), '.nexy', 'mi-semago-sheet.gs')

function appsScript(token) {
  return `// Nexy ↔ Leads Mi Semago. Pegado por scripts/ana-sofi.mjs. No compartas este código: la llave de abajo abre tu Sheet.
const TOKEN = '${token}';
const SHEET_NAME = 'Leads';
// Las únicas columnas que Nexy puede escribir.
const WRITABLE = ['Fecha', 'Estado', 'Llamada programada', 'Resultado', 'Reunión', 'Notas'];

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
        const col = headers.findIndex(function (h) { return norm_(h) === norm_(k); });
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
else say('\nUso: node scripts/ana-sofi.mjs [script|estado]\n')
