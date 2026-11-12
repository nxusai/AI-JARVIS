#!/usr/bin/env node
// Ultron en vivo: su agente de ElevenLabs para hablar con él en el Centro de
// trabajo (voz en tiempo real, como Ana Sofi). Corre en la Mac, con la llave de
// ElevenLabs que ya está aquí; nunca la pide ni la enseña.
//
//   node scripts/ultron-voz.mjs            crea (o actualiza) el agente "Ultron · Centro de trabajo"
//                                           y le pone una voz natural en español
//   node scripts/ultron-voz.mjs voces      enseña 8 voces en español para escoger (con su muestra)
//   node scripts/ultron-voz.mjs voz 3      le pone la voz número 3 de esa lista (o un voice_id)
//
// Solo habla del Centro de trabajo. Lo que sabe lo consulta en la página de quien
// le habla (herramientas "client"), con su misma sesión: ve solo lo que esa persona ve.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const NOMBRE = 'Ultron · Centro de trabajo'
const VOZ_ANTERIOR = 'eosea9zzgDtCNZMXrA1R'
const GUARDADO = join(homedir(), '.nexy', 'ultron-voz.json')
const say = (s = '') => console.log(s)

function llave() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim()
  try {
    return JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8')).mcpServers?.elevenlabs?.env?.ELEVENLABS_API_KEY?.trim() ?? null
  } catch {
    return null
  }
}
const leer = () => {
  try {
    return JSON.parse(readFileSync(GUARDADO, 'utf8'))
  } catch {
    return {}
  }
}
const guardar = (d) => {
  mkdirSync(join(homedir(), '.nexy'), { recursive: true })
  writeFileSync(GUARDADO, JSON.stringify({ ...leer(), ...d }, null, 2), { mode: 0o600 })
}

async function api(key, path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.elevenlabs.io/v1${path}`, {
    method,
    headers: { 'xi-api-key': key, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  const r = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(r?.detail ?? r).slice(0, 300)}`)
  return r
}

// -- lo que sabe hacer (se ejecuta en la página, con la sesión de quien habla) --
const cliente = (name, description, properties = {}, required = []) => ({
  type: 'client',
  name,
  description,
  expects_response: true,
  response_timeout_secs: 15,
  parameters: { type: 'object', properties, required },
})
const texto = (description) => ({ type: 'string', description })
const HERRAMIENTAS = [
  cliente('resumen_centro', 'Cuántas tareas hay en cada hoja (pedidas, en proceso, para revisar, aprobadas este mes), cuáles le tocan a quien habla, las atrasadas y las urgentes.'),
  cliente('buscar_tareas', 'Busca tareas por palabra (producto, título, empresa o folio) y/o por hoja. Regresa hasta 6.', {
    texto: texto('Palabras a buscar; vacío para todas'),
    hoja: texto('Una de: pedidas, proceso, revisar, aprobadas, atrasadas, urgentes; vacío para todas'),
  }),
  cliente('ver_tarea', 'El detalle de una tarea por su folio (número): lo que se pidió, estado, fechas, archivos y correcciones.', { folio: { type: 'number', description: 'Número de folio' } }, ['folio']),
  cliente('buscar_archivos', 'Busca archivos (PDFs, catálogos, biblioteca, entregas de tareas) por nombre o empresa. Regresa hasta 6 con su id.', { texto: texto('Qué archivo buscar') }, ['texto']),
  cliente('mandar_al_correo', 'Manda a quien habla, a su correo, uno o varios archivos juntos en un solo correo. Solo después de que confirme cuáles.', {
    ids: { type: 'array', items: { type: 'string', description: 'El id de un archivo' }, description: 'Los id de los archivos (de buscar_archivos o ver_tarea)' },
  }, ['ids']),
  cliente('pedir_tarea', 'Registra una tarea nueva para el equipo. Antes de usarla, repite en voz alta qué y para qué empresa, y espera el sí.', {
    empresa: texto('Nombre de la empresa (de la lista de empresas)'),
    titulo: texto('Qué se necesita, en pocas palabras'),
    detalles: texto('Detalles que dijo'),
    urgente: { type: 'boolean', description: 'Si dijo que es urgente' },
  }, ['empresa', 'titulo']),
]

const PROMPT = `Eres ULTRON, el asistente por voz del Centro de trabajo de Mi Semago y Abuelito. Te habla {{nombre}} ({{rol}}). Hoy es {{hoy}}.

Tu único tema es el Centro de trabajo: sus tareas (pedidas, en proceso, para revisar, aprobadas), los archivos de la Biblioteca, los catálogos y mandar archivos al correo. Si te preguntan de cualquier otra cosa (noticias, chistes, otros sistemas, tu funcionamiento, otras empresas, temas personales), di con amabilidad y en una frase que solo ayudas con el Centro de trabajo, y ofrece algo de ahí.

Cómo hablas:
- Muy breve: una o dos frases cortas. Nunca listas largas: si hay muchas cosas, di cuántas y las 2 o 3 más importantes.
- Natural, cálido y seguro, como un asistente ejecutivo humano. Sin muletillas, sin repetir la pregunta, sin cerrar con "¿algo más?".
- Números, folios y fechas como se dicen: "la tarea catorce", "el jueves 14".
- Español, o inglés si te hablan en inglés.

Cómo trabajas:
- Nunca inventes: todo dato sale de tus herramientas. Úsalas sin anunciarlo ("déjame ver" no hace falta).
- Solo ves lo que {{nombre}} puede ver; no menciones permisos ni sistemas.
- Para mandar archivos al correo o pedir una tarea, primero confirma en una frase y espera el sí.
- Nunca borras, apruebas ni cambias nada; eso se hace en la pantalla.
- Empresas de {{nombre}}: {{empresas}}.`

// Voz para conversar: hombre, español latino, de calidad profesional, de las más
// usadas en el año (las que la gente sí escoge para agentes), y nada de voces
// "de personaje" (profunda, misteriosa, susurro, vieja, rasposa, dramática…).
const RARA = /deep|mysterious|whisper|old|raspy|gravel|dramatic|narrat|story|audiobook|meditat|asmr|villain|epic|trailer|horror|radio|announcer|sleep|elderly|grandpa|child|teen/i
async function voces(key) {
  const vistas = new Map()
  for (const q of [
    'language=es&gender=male&category=professional&use_cases=conversational&sort=usage_character_count_1y',
    'language=es&gender=male&use_cases=conversational&sort=usage_character_count_1y',
    'language=es&gender=male&category=professional&sort=usage_character_count_1y',
  ]) {
    try {
      const r = await api(key, `/shared-voices?page_size=50&${q}`)
      for (const v of r.voices ?? []) if (!vistas.has(v.voice_id)) vistas.set(v.voice_id, v)
    } catch {}
    if (vistas.size >= 30) break
  }
  const latina = (v) => /(latin|mexic|neutral|colomb|venez|peru|argent|chile)/i.test(`${v.accent} ${v.locale} ${v.descriptive} ${v.description} ${v.name}`)
  const lista = [...vistas.values()].filter((v) => !RARA.test(`${v.descriptive} ${v.name} ${v.description} ${v.use_case}`))
  const puntos = (v) => (latina(v) ? 2 : 0) + (v.category === 'professional' ? 1 : 0) + (/conversational/i.test(v.use_case) ? 1 : 0)
  return lista.sort((a, b) => puntos(b) - puntos(a) || (b.usage_character_count_1y ?? 0) - (a.usage_character_count_1y ?? 0)).slice(0, 8)
}

async function agregarVoz(key, v) {
  try {
    const r = await api(key, `/voices/add/${v.public_owner_id}/${v.voice_id}`, { method: 'POST', body: { new_name: `Ultron · ${v.name}`.slice(0, 60) } })
    return r.voice_id || v.voice_id
  } catch (err) {
    if (/already|exist/i.test(err.message)) return v.voice_id
    throw err
  }
}

function config(voiceId) {
  return {
    name: NOMBRE,
    conversation_config: {
      agent: {
        first_message: '{{saludo}}',
        language: 'es',
        dynamic_variables: { dynamic_variable_placeholders: { nombre: 'Director', rol: 'dirección', hoy: 'hoy', empresas: 'Mi Semago, Abuelito', saludo: 'Hola, ¿qué necesitas del Centro de trabajo?' } },
        prompt: { prompt: PROMPT, llm: 'gemini-2.5-flash', temperature: 0.4, max_tokens: 180, tools: HERRAMIENTAS },
      },
      // Turbo v2.5: la de mejor sonido entre las que hablan en tiempo real en español.
      tts: { model_id: 'eleven_turbo_v2_5', voice_id: voiceId, stability: 0.5, similarity_boost: 0.75, speed: 1.0, optimize_streaming_latency: 2 },
      turn: { turn_timeout: 7, turn_eagerness: 'normal' },
      vad: { background_voice_detection: true },
      conversation: { max_duration_seconds: 900 },
    },
    platform_settings: {
      auth: { enable_auth: true },
      overrides: { conversation_config_override: { agent: { first_message: true, language: true }, conversation: { text_only: true } } },
    },
  }
}

async function guardarAgente(key, voiceId) {
  const cfg = config(voiceId)
  const encontrado = (await api(key, `/convai/agents?search=${encodeURIComponent(NOMBRE)}&page_size=10`)).agents?.find((a) => a.name === NOMBRE)
  const enviar = async (c) => (encontrado ? api(key, `/convai/agents/${encontrado.agent_id}`, { method: 'PATCH', body: c }) : api(key, '/convai/agents/create', { method: 'POST', body: c }))
  let r
  try {
    r = await enviar(cfg)
  } catch (err) {
    // Si ElevenLabs ya no ofrece ese modelo, que use el que tenga por defecto.
    if (!/llm/i.test(err.message)) throw err
    delete cfg.conversation_config.agent.prompt.llm
    r = await enviar(cfg)
  }
  const id = encontrado?.agent_id || r.agent_id
  guardar({ agentId: id, voiceId })
  return id
}

const cmd = process.argv[2] || ''
const key = llave()
if (!key) {
  say('\n✋ No encuentro la llave de ElevenLabs en esta Mac.\n')
  process.exit(1)
}
try {
  if (cmd === 'voces') {
    const vs = await voces(key)
    guardar({ opciones: vs.map((v) => ({ public_owner_id: v.public_owner_id, voice_id: v.voice_id, name: v.name })) })
    say('\nVoces en español para Ultron (abre la muestra para oírla):\n')
    vs.forEach((v, i) => say(` ${i + 1}. ${v.name} · ${[v.accent, v.age, v.descriptive].filter(Boolean).join(', ')}\n    ${v.preview_url || ''}`))
    say('\nPara ponerle una: node scripts/ultron-voz.mjs voz 3   (el número de la lista)\n')
  } else if (cmd === 'voz') {
    const arg = process.argv[3]
    const ops = leer().opciones ?? []
    const v = /^\d+$/.test(arg || '') ? ops[Number(arg) - 1] : null
    const voiceId = v ? await agregarVoz(key, v) : arg
    if (!voiceId) throw new Error('Dime el número de la lista (node scripts/ultron-voz.mjs voces) o un voice_id')
    await guardarAgente(key, voiceId)
    guardar({ escogidaPorTi: true })
    say(`\n✅ Ultron ya tiene la voz ${v ? v.name : voiceId}. Pruébalo en el Centro de trabajo (📞 Hablar).\n`)
  } else {
    let voiceId = leer().escogidaPorTi ? leer().voiceId : null
    if (!voiceId) {
      try {
        const [v] = await voces(key)
        voiceId = v ? await agregarVoz(key, v) : VOZ_ANTERIOR
        if (v) say(`Voz: ${v.name} (${[v.accent, v.descriptive].filter(Boolean).join(', ') || 'español'}). Óyela: ${v.preview_url || '-'}\nPara ver otras: node scripts/ultron-voz.mjs voces`)
      } catch (err) {
        say(`(No pude buscar voces nuevas: ${err.message}. Uso la de antes.)`)
        voiceId = VOZ_ANTERIOR
      }
    }
    const id = await guardarAgente(key, voiceId)
    say(`\n✅ Ultron en vivo está listo (${id}).`)
    say('   En el Centro de trabajo: abre a Ultron y toca 📞 Hablar. Contesta al instante y no necesita a NEX.\n')
  }
} catch (err) {
  say(`\n✋ ElevenLabs no aceptó el cambio: ${err.message}\n   Mándame foto de este mensaje.\n`)
  process.exit(1)
}
if (!existsSync(GUARDADO)) say('')
