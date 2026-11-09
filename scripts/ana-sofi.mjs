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
//   node scripts/ana-sofi.mjs instrucciones            puts Ana Sofi's instructions for the work center on her agent
//                                                      (saves a backup of the ones she had first)
//   node scripts/ana-sofi.mjs instrucciones regresar   puts back the ones she had before
//   node scripts/ana-sofi.mjs voz [arreglar|regresar]   Ana Sofi's voice and speed: looks; fixes (serious voice, fastest
//                                        models; backup first); or undoes it
//   node scripts/ana-sofi.mjs ver        copies Ana Sofi's current instructions (prompt, first message, the data
//                                        she collects, her variables) to the clipboard and the Desktop, to review
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
  SALIDA_DATA,
  SALIDA_PROMPT,
  assignInbound,
  centro,
  onlyToolIds,
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

async function eleven(key, path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/convai${path}`, {
      method,
      headers: { 'xi-api-key': key, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    })
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

const RESPALDO = join(homedir(), '.nexy', 'ana-sofi-respaldos.json')

/** Put Ana Sofi's instructions for the work center on her agent (or, with "regresar", the ones she had). */
async function instrucciones(regresar = false) {
  const cfg = readSalesConfig()
  const key = elevenKey()
  if (!key) return say('\n✋ No encuentro la llave de ElevenLabs en esta Mac.\n')
  if (!/^agent_\w+$/.test(cfg.agentId)) return say('\n✋ No tengo el Agent ID de Ana Sofi. Corre: node scripts/ana-sofi.mjs\n')
  const a = await eleven(key, `/agents/${cfg.agentId}`)
  if (a.error) return say(`\n✋ ElevenLabs no me dejó leer a Ana Sofi (${a.error}).\n`)
  const promptObj = a.data.conversation_config?.agent?.prompt ?? {}
  const dc = a.data.platform_settings?.data_collection ?? {}
  let respaldos = []
  try {
    respaldos = JSON.parse(readFileSync(RESPALDO, 'utf8'))
  } catch {}
  let prompt, data
  if (regresar) {
    const ultimo = respaldos.pop()
    if (!ultimo) return say('\n✋ No tengo respaldo de las instrucciones anteriores.\n')
    prompt = ultimo.prompt
    data = ultimo.data_collection
  } else {
    if (promptObj.prompt === SALIDA_PROMPT) return say('\n✅ Ana Sofi ya tiene las instrucciones nuevas. No cambié nada.\n')
    respaldos.push({ fecha: new Date().toISOString(), prompt: promptObj.prompt ?? '', data_collection: dc })
    prompt = SALIDA_PROMPT
    data = { ...dc, ...SALIDA_DATA }
  }
  mkdirSync(join(homedir(), '.nexy'), { recursive: true })
  writeFileSync(RESPALDO, JSON.stringify(respaldos.slice(-5), null, 2), { mode: 0o600 })
  const r = await eleven(key, `/agents/${cfg.agentId}`, {
    method: 'PATCH',
    body: { conversation_config: { agent: { prompt: onlyToolIds({ ...promptObj, prompt }) } }, platform_settings: { data_collection: data } },
  })
  if (r.error) return say(`\n✋ ElevenLabs no aceptó el cambio (${r.error}). Ana Sofi se quedó como estaba. Mándame foto de este mensaje.\n`)
  if (regresar) say('\n✅ Ana Sofi regresó a las instrucciones que tenía antes.\n')
  else {
    say('\n✅ Ana Sofi ya tiene sus instrucciones nuevas:')
    say('   • pide nombre, correo (y lo confirma letra por letra) y los datos del negocio')
    say('   • califica (caliente / medio / frío) y da los precios')
    say('   • ofrece la videollamada aunque no acepte el precio')
    say('   Guardé las de antes. Para regresar: node scripts/ana-sofi.mjs instrucciones regresar\n')
  }
}

const RESPALDO_VOZ = join(homedir(), '.nexy', 'ana-sofi-voz-respaldos.json')
// Voz seria: sin el modo expresivo (las etiquetas como [happy]), más estable, velocidad normal.
const VOZ_SERIA = { expressive_mode: false, stability: 0.75, similarity_boost: 0.75, speed: 1, optimize_streaming_latency: 3 }
const LLM_LENTOS = /(opus|o1|o3|o4|reason|think|gemini-[\d.]+-pro)/i

/** Lo que se cambia en cada agente, por partes (si ElevenLabs rechaza una, las demás sí entran). */
function arreglos(c, principal) {
  const lista = [
    ['Voz seria (sin modo expresivo, estabilidad 0.75)', { tts: VOZ_SERIA }, { tts: pick(c.tts, VOZ_SERIA) }],
    ['Contesta sin esperar de más (turnos "normal")', { turn: { turn_eagerness: 'normal' } }, { turn: pick(c.turn, { turn_eagerness: 1 }) }],
    ['Ignora voces y ruido de fondo (bueno para speaker)', { vad: { background_voice_detection: true } }, { vad: pick(c.vad, { background_voice_detection: 1 }) }],
  ]
  // Empieza en español: así no gasta segundos "cambiando de idioma" con cada lead que habla español.
  const presets = c.language_presets ?? {}
  if (principal && c.agent?.language === 'en' && presets.es) {
    const saludo = presets.es.overrides?.agent?.first_message || c.agent.first_message || '{{saludo}}'
    lista.push([
      'Empieza en español (y cambia a inglés solo si el cliente habla inglés)',
      { agent: { language: 'es', first_message: saludo }, language_presets: { en: { overrides: { agent: { first_message: c.agent.first_message || saludo } } } } },
      { agent: { language: c.agent.language, first_message: c.agent.first_message }, language_presets: presets },
    ])
  }
  return lista
}
const pick = (o = {}, keys) => Object.fromEntries(Object.keys(keys).filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]))

/** Ana Sofi's voice, speed and language: "voz" only looks, "voz arreglar" fixes them, "voz regresar" undoes it. */
async function voz(accion = '') {
  const cfg = readSalesConfig()
  const key = elevenKey()
  if (!key) return say('\n✋ No encuentro la llave de ElevenLabs en esta Mac.\n')
  const agentes = [['Ana Sofi', cfg.agentId, true], ['Ana Sofi · Llamadas entrantes', cfg.inboundAgentId, false]].filter(([, id]) => /^agent_\w+$/.test(id || ''))
  if (!agentes.length) return say('\n✋ No tengo el Agent ID de Ana Sofi. Corre: node scripts/ana-sofi.mjs\n')
  let respaldos = []
  try {
    respaldos = JSON.parse(readFileSync(RESPALDO_VOZ, 'utf8'))
  } catch {}
  const ultimo = accion === 'regresar' ? respaldos.pop() : null
  if (accion === 'regresar' && !ultimo) return say('\n✋ No tengo respaldo de la voz anterior.\n')
  const nuevo = { fecha: new Date().toISOString(), agentes: {} }
  for (const [nombre, id, principal] of agentes) {
    const a = await eleven(key, `/agents/${id}`)
    if (a.error) { say(`\n✋ ElevenLabs no me dejó leer "${nombre}" (${a.error}).`); continue }
    const c = a.data.conversation_config ?? {}
    const tts = c.tts ?? {}
    const llm = c.agent?.prompt?.llm ?? '-'
    const ok = (bien, t) => say(`  ${bien ? '✅' : '⚠️ '} ${t}`)
    say(`\n${nombre}:`)
    ok(tts.expressive_mode !== true, `Modo expresivo: ${tts.expressive_mode ? 'prendido (por eso suena con tanta emoción)' : 'apagado'}`)
    ok((tts.stability ?? 0) >= 0.7, `Estabilidad de la voz: ${tts.stability ?? '-'} (más alta = más seria; la buscamos en 0.75)`)
    ok(c.turn?.turn_eagerness !== 'patient', `Espera para contestar: ${c.turn?.turn_eagerness ?? '-'}${c.turn?.turn_eagerness === 'patient' ? ' (espera de más)' : ''}`)
    ok(c.vad?.background_voice_detection === true, `Ignorar ruido y voces de fondo: ${c.vad?.background_voice_detection ? 'sí' : 'no (en speaker oye el eco)'}`)
    if (principal) ok(c.agent?.language !== 'en', `Idioma con el que empieza: ${c.agent?.language ?? '-'}${c.agent?.language === 'en' ? ' (con cada lead en español pierde segundos cambiando de idioma)' : ''}`)
    ok(!LLM_LENTOS.test(llm), `Modelo que piensa: ${llm}`)
    if (!accion) continue
    if (accion === 'regresar') {
      const antes = ultimo.agentes[id]
      if (!antes) { say('  (no tengo respaldo de este agente; no lo toqué)'); continue }
      for (const cambio of Array.isArray(antes) ? antes : [{ tts: antes }]) {
        const r = await eleven(key, `/agents/${id}`, { method: 'PATCH', body: { conversation_config: cambio } })
        say(r.error ? `  ✋ No pude regresar una parte (${r.error}).` : '  ✅ Regresé una parte a como estaba.')
      }
      continue
    }
    nuevo.agentes[id] = []
    for (const [que, cambio, antes] of arreglos(c, principal)) {
      const r = await eleven(key, `/agents/${id}`, { method: 'PATCH', body: { conversation_config: cambio } })
      if (r.error) say(`  ✋ ${que}: ElevenLabs no lo aceptó (${r.error}); esa parte se quedó como estaba.`)
      else { say(`  ✅ ${que}`); nuevo.agentes[id].push(antes) }
    }
  }
  if (accion === 'arreglar' && Object.values(nuevo.agentes).some((x) => x.length)) respaldos.push(nuevo)
  if (accion) {
    mkdirSync(join(homedir(), '.nexy'), { recursive: true })
    writeFileSync(RESPALDO_VOZ, JSON.stringify(respaldos.slice(-5), null, 2), { mode: 0o600 })
  }
  say(accion === 'arreglar' ? '\nGuardé cómo estaba. Para regresar: node scripts/ana-sofi.mjs voz regresar\n' : accion ? '' : '\nSolo miré, no cambié nada. Para corregir: node scripts/ana-sofi.mjs voz arreglar\n')
}

/** Why Ana Sofi is slow or sounds too expressive: her voice/turn settings and the timings of her last call. Copied to paste in the chat. */
async function diagnostico() {
  const cfg = readSalesConfig()
  const key = elevenKey()
  if (!key) return say('\n✋ No encuentro la llave de ElevenLabs en esta Mac.\n')
  if (!/^agent_\w+$/.test(cfg.agentId)) return say('\n✋ No tengo el Agent ID de Ana Sofi. Corre: node scripts/ana-sofi.mjs\n')
  const a = await eleven(key, `/agents/${cfg.agentId}`)
  if (a.error) return say(`\n✋ ElevenLabs no me dejó leer a Ana Sofi (${a.error}).\n`)
  const c = a.data.conversation_config ?? {}
  const p = c.agent?.prompt ?? {}
  const sinTexto = (o) => JSON.stringify(o ?? {}, (k, v) => (/prompt|first_message|message$/i.test(k) && typeof v === 'string' ? `(${v.length} letras)` : v))
  const lineas = [
    `# Diagnóstico de Ana Sofi (${new Date().toLocaleString('es-MX')})`,
    `Modelo que piensa: ${p.llm ?? '-'} · temperatura ${p.temperature ?? '-'} · max_tokens ${p.max_tokens ?? '-'} · instrucciones ${String(p.prompt ?? '').length} letras`,
    `Base de conocimiento: ${(p.knowledge_base ?? []).length} documento(s) · RAG ${sinTexto(p.rag)}`,
    `Herramientas: ${(p.tool_ids ?? []).length + (p.tools ?? []).length}`,
    `Voz (tts): ${sinTexto(c.tts)}`,
    `Turnos (turn): ${sinTexto(c.turn)}`,
    `Oído (asr): ${sinTexto(c.asr)}`,
    `Conversación: ${sinTexto(c.conversation)}`,
    `VAD: ${sinTexto(c.vad)}`,
    `Idioma: ${c.agent?.language ?? '-'} · presets por idioma: ${sinTexto(c.language_presets)}`,
  ]
  const lista = await eleven(key, `/conversations?agent_id=${cfg.agentId}&page_size=1`)
  const conv = lista.data?.conversations?.[0]
  if (conv) {
    const d = await eleven(key, `/conversations/${conv.conversation_id}`)
    lineas.push('', `## Última llamada (${conv.start_time_unix_secs ? new Date(conv.start_time_unix_secs * 1000).toLocaleString('es-MX') : '-'}, ${conv.call_duration_secs ?? '-'} s)`)
    for (const t of d.data?.transcript ?? []) {
      const m = t.conversation_turn_metrics?.metrics ?? {}
      const tiempos = Object.entries(m).map(([k, v]) => `${k.replace(/^convai_/, '')}=${Number(v?.elapsed_time ?? v).toFixed(2)}s`).join(' ')
      lineas.push(`[${t.time_in_call_secs ?? '-'}s] ${t.role === 'agent' ? 'Ana Sofi' : 'Cliente'}: ${String(t.message ?? (t.tool_calls?.length ? '(usa herramienta)' : '')).slice(0, 160)}${tiempos ? `  ⏱ ${tiempos}` : ''}${t.interrupted ? ' (la interrumpieron)' : ''}`)
    }
  } else lineas.push('', `No encontré llamadas (${lista.error ?? 'vacío'}).`)
  const texto = lineas.join('\n')
  const archivo = join(homedir(), 'Desktop', 'ana-sofi-diagnostico.txt')
  writeFileSync(archivo, texto, { mode: 0o600 })
  const copiado = process.platform === 'darwin' && spawnSync('pbcopy', { input: texto }).status === 0
  say(`\n✅ ${copiado ? 'Listo, ya está copiado: pégalo en el chat con Cmd + V.' : 'Listo.'} También quedó en: ${archivo}`)
  say('   No trae llaves ni números de teléfono.\n')
}

/** Ana Sofi's instructions as they are in ElevenLabs: only text, never keys or tool settings. */
async function ver() {
  const cfg = readSalesConfig()
  const key = elevenKey()
  if (!key) return say('\n✋ No encuentro la llave de ElevenLabs en esta Mac.\n')
  if (!/^agent_\w+$/.test(cfg.agentId)) return say('\n✋ No tengo el Agent ID de Ana Sofi. Corre: node scripts/ana-sofi.mjs\n')
  const a = await eleven(key, `/agents/${cfg.agentId}`)
  if (a.error) return say(`\n✋ ElevenLabs no me dejó leer a Ana Sofi (${a.error}).\n`)
  const agent = a.data.conversation_config?.agent ?? {}
  const dc = a.data.platform_settings?.data_collection ?? {}
  const vars = agent.dynamic_variables?.dynamic_variable_placeholders ?? {}
  const texto = [
    `# Ana Sofi tal como está hoy en ElevenLabs (${new Date().toLocaleString('es-MX')})`,
    `Agente: ${a.data.name ?? cfg.agentId}`,
    `Idioma: ${agent.language ?? '-'}`,
    '',
    '## Primer mensaje',
    agent.first_message ?? '(vacío)',
    '',
    '## Variables que recibe',
    Object.keys(vars).join(', ') || '(ninguna)',
    '',
    '## Datos que recolecta al final de la llamada (Data collection)',
    ...Object.entries(dc).map(([k, v]) => `- ${k} (${v?.type ?? '-'}): ${v?.description ?? ''}`),
    '',
    '## Instrucciones (prompt)',
    agent.prompt?.prompt ?? '(vacío)',
  ].join('\n')
  const archivo = join(homedir(), 'Desktop', 'ana-sofi-actual.txt')
  writeFileSync(archivo, texto, { mode: 0o600 })
  const copiado = process.platform === 'darwin' && spawnSync('pbcopy', { input: texto }).status === 0
  say(`\n✅ ${copiado ? 'Copié las instrucciones de Ana Sofi (ya las puedes pegar con Cmd + V).' : 'Listo.'} También quedaron en: ${archivo}`)
  say('   Son solo textos: no incluye llaves ni números de teléfono de clientes.\n')
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
else if (cmd === 'ver') await ver()
else if (cmd === 'diagnostico') await diagnostico()
else if (cmd === 'instrucciones') await instrucciones(process.argv[3] === 'regresar')
else if (cmd === 'voz') await voz(['arreglar', 'regresar'].includes(process.argv[3]) ? process.argv[3] : '')
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
else say('\nUso: node scripts/ana-sofi.mjs [script|estado|revisar|entrantes|centro|sheet|ver|instrucciones|voz|diagnostico|avisos]\n')
