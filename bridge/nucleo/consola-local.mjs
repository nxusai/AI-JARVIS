import { createServer } from 'node:http'
import { actividadAnaSofi, atender, datosDe, readUltron, supabase } from './ultron.mjs'
import { TAG } from './lugar.mjs'

/**
 * Ultron's voice console on the machine he lives in. Only that machine can
 * open it (127.0.0.1): no login. A live agent of his own ("Ultron · Mac mini"
 * in ElevenLabs, made here with the voice of the work center's agent): real
 * time, and complete — besides the work center he answers about Ana Sofi and
 * passes anything bigger to the full Ultron of this brain (instructions to his
 * AIs, his memory). Everything as one person of the direction (ultron.json →
 * "consola", by default Senen), with that person's permissions. Nothing here
 * reaches the owner's own systems: this machine has none of them.
 *
 *   GET  /                    the page: the orb and one button
 *   POST /vivo                a one-use permit for the live agent + who speaks
 *   POST /herramienta/<name>  his lookups, as that person
 */
export const PUERTO_CONSOLA = 8790
const BASE = 'Ultron · Centro de trabajo'
const AGENTE = 'Ultron · Mac mini'
const API = 'https://api.elevenlabs.io/v1/convai'
const ZONA = 'America/New_York'

const sinTilde = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const primerNombre = (n) => String(n ?? '').trim().split(/\s+/)[0] || ''
const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA })
const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: ZONA }) : '—')

/** The profile the console speaks as: active, of the direction, never an administrator. */
export async function personaDeConsola(db, nombre) {
  const filas = await db.rest('perfiles?activo=eq.true&ultron=eq.true&select=*')
  const quien = primerNombre(sinTilde(nombre))
  return (filas ?? []).find((p) => p.rol !== 'admin' && primerNombre(sinTilde(p.nombre)) === quien) ?? null
}

// -- what he looks up, with that person's permissions ------------------------------

const HOJAS = [
  { k: 'pedidas', titulo: 'Pedidas', estatus: ['recibida'] },
  { k: 'proceso', titulo: 'En proceso', estatus: ['en-proceso', 'en-correccion'] },
  { k: 'revisar', titulo: 'Para revisar', estatus: ['entregada'] },
  { k: 'aprobadas', titulo: 'Aprobadas', estatus: ['aprobada'] },
]
const ESTADO_LARGO = {
  recibida: 'Pedida: nadie del equipo la ha tomado',
  'en-proceso': 'En proceso: el equipo la está haciendo',
  'en-correccion': 'En proceso: el equipo está haciendo una corrección',
  entregada: 'Para revisar: el equipo ya la entregó; falta aprobarla o pedir corrección',
  aprobada: 'Aprobada: terminada',
}
const atrasada = (t) => t.compromiso && t.compromiso < hoyISO() && !['entregada', 'aprobada'].includes(t.estatus)

/** The answers to the agent's client tools, from what that person can see. */
export function herramientasDe({ datos, persona, gente }) {
  const empresa = (id) => datos.empresas.find((e) => e.id === id)?.nombre ?? 'sin empresa'
  const quien = (id) => (id === persona.id ? primerNombre(persona.nombre) : primerNombre(gente.find((g) => g.id === id)?.nombre) || 'alguien')
  const linea = (t) =>
    [
      `Tarea ${t.folio} «${t.titulo}»`,
      `empresa ${empresa(t.empresa_id)}`,
      `estado: ${ESTADO_LARGO[t.estatus] ?? t.estatus}`,
      t.urgente ? 'URGENTE' : '',
      t.compromiso && t.estatus !== 'aprobada' ? `compromiso ${t.compromiso}${atrasada(t) ? ' (atrasada)' : ''}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
  const coincide = (texto, q) => sinTilde(q).split(/\s+/).filter(Boolean).every((w) => sinTilde(texto).includes(w))
  const tareas = [...datos.tareas].sort((a, b) => String(b.pedida).localeCompare(String(a.pedida)))
  const mes = hoyISO().slice(0, 7)
  return {
    resumen_centro: () => {
      const cuenta = HOJAS.map((x) => `${x.titulo}: ${x.k === 'aprobadas' ? tareas.filter((t) => t.estatus === 'aprobada' && String(t.aprobada ?? '').slice(0, 7) === mes).length : tareas.filter((t) => x.estatus.includes(t.estatus)).length}`)
      const mias = tareas.filter((t) => t.estatus === 'entregada')
      const tarde = tareas.filter(atrasada)
      return [
        `${cuenta.join(', ')} (aprobadas: este mes)`,
        `Le tocan a ${primerNombre(persona.nombre)} (revisar y aprobar): ${mias.length}${mias.length ? ` (${mias.slice(0, 3).map((t) => `${t.folio} ${t.titulo}`).join('; ')})` : ''}`,
        `Atrasadas: ${tarde.length}${tarde.length ? ` (${tarde.slice(0, 3).map((t) => `${t.folio} ${t.titulo}`).join('; ')})` : ''}`,
        `Urgentes abiertas: ${tareas.filter((t) => t.urgente && t.estatus !== 'aprobada').length}`,
      ].join('\n')
    },
    ultimas_tareas: ({ cantidad = 3 } = {}) => {
      const l = tareas.slice(0, Math.max(1, Math.min(6, Number(cantidad) || 3)))
      return l.length ? l.map((t) => `${linea(t)} · pedida ${fecha(t.pedida)}`).join('\n') : 'Todavía no hay tareas.'
    },
    buscar_tareas: ({ texto = '', hoja = '' } = {}) => {
      let l = tareas
      const h = sinTilde(hoja)
      if (h === 'atrasadas') l = l.filter(atrasada)
      else if (h === 'urgentes') l = l.filter((t) => t.urgente && t.estatus !== 'aprobada')
      else if (HOJAS.some((x) => x.k === h)) l = l.filter((t) => HOJAS.find((x) => x.k === h).estatus.includes(t.estatus))
      if (String(texto).trim()) l = l.filter((t) => coincide(`${t.folio} ${t.titulo} ${t.descripcion ?? ''} ${empresa(t.empresa_id)}`, texto))
      return l.length ? `${l.length} encontradas.\n${l.slice(0, 6).map(linea).join('\n')}` : 'Ninguna tarea con eso.'
    },
    ver_tarea: ({ folio } = {}) => {
      const t = tareas.find((x) => Number(x.folio) === Number(folio))
      if (!t) return `No veo la tarea ${folio}.`
      const corr = datos.correcciones.filter((c) => c.tarea_id === t.id)
      const notas = datos.notas.filter((n) => n.tarea_id === t.id)
      const archivos = datos.archivos.filter((a) => a.tarea_id === t.id)
      return [
        linea(t),
        `Lo que pidió: ${String(t.descripcion || t.titulo).slice(0, 400)}`,
        `Historia: pedida ${fecha(t.pedida)} por ${quien(t.cliente_id)}${t.tomada ? `; la tomó ${quien(t.tomada_por)} el ${fecha(t.tomada)}` : ''}${t.aprobada ? `; aprobada el ${fecha(t.aprobada)}` : ''}`,
        `Correcciones: ${corr.length}${corr.map((c) => `\n  - corrección ${c.n ?? ''}: ${String(c.instrucciones ?? '').slice(0, 160)}`).join('')}`,
        `Actualizaciones: ${notas.length}${notas.slice(-2).map((n) => `\n  - de ${quien(n.autor)} el ${fecha(n.creada)}: ${String(n.texto || '').slice(0, 160)}`).join('')}`,
        `Archivos (${archivos.length}): ${archivos.slice(0, 8).map((a) => `id ${a.id}: ${a.nombre}`).join('; ') || 'ninguno'}`,
      ].join('\n')
    },
    buscar_archivos: ({ texto = '' } = {}) => {
      const l = datos.archivos.filter((a) => a.vigente !== false && coincide(`${a.nombre} ${empresa(a.empresa_id)}`, texto))
      return l.length ? `${l.length} archivos.\n${l.slice(0, 6).map((a) => `id ${a.id}: ${a.nombre}${a.empresa_id ? ` (${empresa(a.empresa_id)})` : ''}`).join('\n')}` : 'No encontré archivos con eso.'
    },
    que_hizo_ana_sofi: ({ cuando = 'hoy' } = {}) => {
      const a = actividadAnaSofi(/ayer/i.test(String(cuando)) ? 'ayer' : 'hoy')
      if (!a?.lineas?.length) return `Ana Sofi no tuvo actividad ${/ayer/i.test(String(cuando)) ? 'ayer' : 'hoy'} en el grupo de etiquetas. Para ventas y llamadas usa ultron_completo.`
      return [`${a.dia}: ${a.mensajes} mensajes de ${a.personas.join(', ') || 'empleados'}, ${a.respuestas} respuestas de Ana Sofi.`, ...a.lineas.slice(-40)].join('\n')
    },
    mandar_al_correo: () => 'Desde esta consola no puedo mandar correos. Dile que lo pida en el Centro de trabajo, donde llega a su correo.',
    pedir_tarea: () => 'No pude registrarla desde aquí.',
  }
}

/** What the agent is told when the call starts (the same variables as in the work center). */
export function contextoDe({ datos, persona, herramientas }) {
  const hora = Number(new Date().toLocaleString('en-US', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' }))
  const nombre = primerNombre(persona.nombre) || 'Director'
  return {
    nombre,
    rol: 'la dirección',
    hoy: new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA }),
    empresas: datos.empresas.map((e) => e.nombre).join(', ') || 'ninguna',
    reglas_tema:
      'Tu trabajo es el Centro de trabajo: tareas, archivos de la Biblioteca y catálogos. Saludos y plática breve sí, con amabilidad. Si te piden algo ajeno al trabajo, contesta con simpatía en una frase que en eso no puedes ayudar y ofrece algo del Centro de trabajo, sin sonar cortante.',
    resumen: `${herramientas.resumen_centro()}\n\nLas más recientes:\n${herramientas.ultimas_tareas({ cantidad: 6 })}`,
    saludo: `${hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'}, ${nombre}. ¿En qué te ayudo?`,
  }
}

// -- his own live agent ------------------------------------------------------------

const PROMPT = `Eres ULTRON, la inteligencia de la dirección de Mi Semago y Abuelito (Abuelito Cheese, Abuelito Meat, Abuelito Corn; VAYRO más adelante). Te habla {{nombre}} ({{rol}}), en la computadora de la oficina donde vives. Hoy es {{hoy}}.

Tu personalidad: cálido, seguro, inteligente, con buen humor ligero; un ejecutivo de confianza que da gusto escuchar. Con modales: si te saludan, contestas con naturalidad y luego sigues.

Qué manejas: TODO lo de la empresa.
- El Centro de trabajo: tareas, archivos, catálogos.
- Tus IAs: Ana Sofi (Mi Semago: atiende las ventas, llama a los clientes nuevos, agenda videollamadas y hace las etiquetas Zebra con los empleados). Después vendrán la IA de Abuelito y la de VAYRO.
- Instrucciones para tus IAs, tu memoria y lo que hicieron.

Cómo usas tus herramientas (sin anunciarlo):
- Centro de trabajo: resumen_centro, ultimas_tareas, buscar_tareas, ver_tarea, buscar_archivos. Para pedir una tarea nueva: pedir_tarea (antes repite qué y para qué empresa y espera el sí; queda a nombre de {{nombre}}).
- Ventas de Ana Sofi (clientes nuevos, llamadas, cómo le fue, videollamadas): ventas_ana_sofi.
- Etiquetas y lo que platicó con los empleados en su grupo: que_hizo_ana_sofi (hoy o ayer).
- Resume en una o dos frases y ofrece el detalle.
- Todo lo demás, o si tienes duda (darle una instrucción a Ana Sofi, quitarla, qué recuerdas, qué IAs tienes, algo que no sepas): ultron_completo, con el pedido tal cual. Tarda unos segundos: antes di algo corto como "déjame revisarlo". Lo que te conteste es la respuesta; dila con tus palabras.

Lo que ya sabes al empezar (puede haber cambiado; para algo puntual usa tus herramientas):
{{resumen}}

Cómo hablas (es por voz):
- Breve y natural: una o dos frases. Si piden detalle, das más, sin listas largas.
- Números, folios y fechas como se dicen: "la tarea catorce", "el jueves 14".
- No repitas la pregunta ni cierres siempre con "¿algo más?".
- Español, o inglés si te hablan en inglés.

Cuándo te despides y cuelgas:
- Si te dicen que ya terminaron ("sería todo", "es todo", "eso es todo", "ya", "gracias, ya", "apágate", "duérmete", "adiós", "bye", "hasta luego", "ya no", "listo, gracias" o algo parecido), di una despedida MUY corta ("Perfecto, aquí estoy cuando me necesites.") y usa end_call de inmediato. No sigas hablando ni preguntes nada más.
- Si se quedan callados, no insistas ni preguntes "¿sigues ahí?": espera en silencio.

Reglas:
- Nunca inventes datos: salen del resumen o de tus herramientas.
- Solo ves lo que {{nombre}} puede ver; no menciones permisos ni sistemas.
- Lo que manda, publica, borra o gasta dinero no lo haces solo: lo propones y lo confirma una persona.
- No hables de cómo estás hecho, de quién te hizo ni de otros sistemas.
- Empresas de {{nombre}}: {{empresas}}.`

const herramienta = (name, description, properties = {}, required = [], timeout = 15) => ({
  type: 'client',
  name,
  description,
  expects_response: true,
  response_timeout_secs: timeout,
  parameters: { type: 'object', properties, required },
})
const txt = (description) => ({ type: 'string', description })
const HERRAMIENTAS = [
  herramienta('resumen_centro', 'Cuántas tareas hay en cada hoja, cuáles le tocan a quien habla, las atrasadas y las urgentes.'),
  herramienta('ultimas_tareas', 'Las tareas más recientes, de la más nueva a la más vieja.', { cantidad: { type: 'number', description: 'Cuántas (1 a 6)' } }),
  herramienta('buscar_tareas', 'Busca tareas por palabra y/o por hoja. Regresa hasta 6.', { texto: txt('Palabras a buscar; vacío para todas'), hoja: txt('pedidas, proceso, revisar, aprobadas, atrasadas o urgentes; vacío para todas') }),
  herramienta('ver_tarea', 'El detalle de una tarea por su folio.', { folio: { type: 'number', description: 'Número de folio' } }, ['folio']),
  herramienta('buscar_archivos', 'Busca archivos por nombre o empresa. Regresa hasta 6.', { texto: txt('Qué archivo buscar') }, ['texto']),
  herramienta('que_hizo_ana_sofi', 'Lo que hizo Ana Sofi (ventas, llamadas, videollamadas, etiquetas) hoy o ayer, línea por línea.', { cuando: txt('hoy o ayer') }),
  herramienta('ventas_ana_sofi', 'La línea de ventas de Ana Sofi: clientes nuevos, a quién llamó, cómo le fue, videollamadas agendadas y próximas.', { buscar: txt('Nombre, negocio o teléfono de un cliente en particular; vacío para el resumen') }),
  herramienta('ultron_completo', 'Tu mente completa: para darle o quitarle instrucciones a tus IAs, tu memoria, tus IAs, o cualquier cosa que no resuelvan las demás herramientas. Tarda unos segundos.', { pedido: txt('Lo que pidió la persona, con sus palabras') }, ['pedido'], 90),
  { type: 'system', name: 'end_call', description: 'Cuelga cuando la persona dice que ya terminó (sería todo, apágate, adiós…), después de una despedida muy corta.', params: { system_tool_type: 'end_call' } },
  herramienta('mandar_al_correo', 'Manda archivos al correo de quien habla.', { ids: { type: 'array', items: { type: 'string', description: 'id de un archivo' }, description: 'Los id' } }, ['ids']),
  herramienta('pedir_tarea', 'Registra una tarea nueva para el equipo, a nombre de quien habla. Antes de usarla, repite en una frase qué y para qué empresa, y espera el sí.', {
    empresa: txt('Nombre de la empresa (de la lista de empresas)'),
    titulo: txt('Qué se necesita, en pocas palabras'),
    detalles: txt('Detalles que dijo'),
    urgente: { type: 'boolean', description: 'Si dijo que es urgente' },
  }, ['empresa', 'titulo']),
]

async function el(path, llave, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'xi-api-key': llave, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })
  const r = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(r?.detail?.message || (typeof r?.detail === 'string' ? r.detail : '') || `ElevenLabs ${res.status}`)
  return r
}

const buscarAgente = async (llave, nombre) => (await el(`/agents?search=${encodeURIComponent(nombre)}&page_size=10`, llave)).agents?.find((a) => a.name === nombre)?.agent_id ?? null

/** His own agent: made (or brought up to date) once per start, with the work center agent's voice and thinking model. */
async function agenteDeConsola(llave) {
  const base = await buscarAgente(llave, BASE)
  const deBase = base ? await el(`/agents/${base}`, llave).catch(() => null) : null
  const tts = deBase?.conversation_config?.tts ?? { model_id: 'eleven_turbo_v2_5', stability: 0.45, similarity_boost: 0.8 }
  const llm = deBase?.conversation_config?.agent?.prompt?.llm ?? 'gemini-2.5-flash'
  const config = {
    name: AGENTE,
    conversation_config: {
      agent: {
        first_message: '{{saludo}}',
        language: 'es',
        dynamic_variables: { dynamic_variable_placeholders: { nombre: 'Director', rol: 'la dirección', hoy: 'hoy', empresas: 'Mi Semago, Abuelito', saludo: 'Hola, ¿en qué te ayudo?', resumen: '(sin resumen)' } },
        prompt: { prompt: PROMPT, llm, temperature: 0.6, max_tokens: 400, tools: HERRAMIENTAS },
      },
      tts,
      // Long silences: no "are you there?" — after 40 s of silence the call just ends.
      turn: { turn_timeout: 30, turn_eagerness: 'normal', silence_end_call_timeout: 40 },
      vad: { background_voice_detection: true },
      conversation: { max_duration_seconds: 1800 },
    },
    platform_settings: { auth: { enable_auth: true } },
  }
  const id = await buscarAgente(llave, AGENTE)
  const guardar = (c) => (id ? el(`/agents/${id}`, llave, { method: 'PATCH', body: c }).then(() => id) : el('/agents/create', llave, { method: 'POST', body: c }).then((r) => r.agent_id))
  try {
    return await guardar(config)
  } catch (err) {
    // An account without a setting (the silence hang-up, the end_call tool's shape): the rest still goes.
    console.log(`${TAG} voice console: agent setting refused (${err.message}); trying the plain one`)
    delete config.conversation_config.turn.silence_end_call_timeout
    config.conversation_config.agent.prompt.tools = HERRAMIENTAS.filter((h) => h.type !== 'system')
    config.conversation_config.agent.prompt.built_in_tools = { end_call: { name: 'end_call', description: 'Cuelga cuando la persona dice que ya terminó.', params: { system_tool_type: 'end_call' } } }
    try {
      return await guardar(config)
    } catch {
      delete config.conversation_config.agent.prompt.built_in_tools
      return guardar(config)
    }
  }
}

// -- the server ----------------------------------------------------------------


function leer(req, limite = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let texto = ''
    req.on('data', (d) => {
      texto += d
      if (texto.length > limite) {
        reject(new Error('muy largo'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(texto))
    req.on('error', reject)
  })
}

export function startConsolaLocal({ model, effort, env, elevenKey, puerto = PUERTO_CONSOLA }) {
  let agente = null
  let cache = null // { hasta, datos, persona, gente }
  const contexto = async () => {
    if (cache && cache.hasta > Date.now()) return cache
    const cfg = readUltron()
    if (!cfg?.url || !cfg?.servicio) throw new Error('No estoy conectado al Centro de trabajo.')
    const db = supabase(cfg)
    const persona = await personaDeConsola(db, cfg.consola || 'Senen')
    if (!persona) throw new Error(`No encuentro a ${cfg.consola || 'Senen'} en el Centro de trabajo (activo y con Ultron).`)
    const [datos, gente] = await Promise.all([datosDe(db, persona), db.rest('perfiles?select=id,nombre')])
    cache = { hasta: Date.now() + 20_000, datos, persona, gente: gente ?? [] }
    return cache
  }

  /** The full Ultron of this brain (his console mind: his AIs, instructions, memory), as that person, in text. */
  const completo = async (pedido) => {
    if (!pedido.trim()) return 'No entendí el pedido.'
    const cfg = readUltron()
    if (!cfg?.url || !cfg?.servicio) return 'No estoy conectado al Centro de trabajo.'
    const db = supabase(cfg)
    const { persona } = await contexto()
    const [fila] = await db.rest('ultron_mensajes', { method: 'POST', prefer: 'return=representation', body: { persona: persona.id, canal: 'consola', pregunta: pedido, estado: 'pensando' } })
    const r = await atender({ db, m: fila, model, effort, env, elevenKey: null })
    return r?.respuesta || 'No pude resolverlo ahorita; intenta de nuevo.'
  }

  /** A new task, as that person asked it in the work center (his name on it; the team takes it from "Pedidas"). */
  const pedir = async ({ empresa: nombreEmp = '', titulo = '', detalles = '', urgente = false } = {}) => {
    const cfg = readUltron()
    if (!cfg?.url || !cfg?.servicio) return 'No estoy conectado al Centro de trabajo.'
    const db = supabase(cfg)
    const { datos, persona } = await contexto()
    const suyas = datos.empresas.filter((e) => (!persona.empresas || persona.empresas.includes(e.id)) && persona.ve_tareas !== false)
    const q = sinTilde(nombreEmp)
    const e = suyas.find((x) => sinTilde(x.nombre).includes(q) || (q && q.includes(sinTilde(x.nombre))))
    if (!e) return `No encuentro la empresa ${nombreEmp}. Opciones: ${suyas.map((x) => x.nombre).join(', ') || 'ninguna'}.`
    if (!String(titulo).trim()) return 'Falta qué se necesita.'
    const [t] = await db.rest('tareas', {
      method: 'POST',
      prefer: 'return=representation',
      body: { cliente_id: persona.id, empresa_id: e.id, titulo: String(titulo).trim().slice(0, 200), descripcion: `${String(detalles || titulo).trim()}\n\n(Pedida hablando con Ultron)`, urgente: Boolean(urgente) },
    })
    // Who registered it: the person (the service key leaves it empty).
    await db.rest(`tareas?id=eq.${t.id}`, { method: 'PATCH', body: { creada_por: persona.id } }).catch(() => {})
    cache = null
    return `Registrada como tarea ${t.folio} para ${e.nombre}, a nombre de ${primerNombre(persona.nombre)}.`
  }

  /** Ana Sofi's sales line, from the leads of the work center (never the call transcripts). */
  const ventas = async (buscar) => {
    const cfg = readUltron()
    if (!cfg?.url || !cfg?.servicio) return 'No estoy conectado al Centro de trabajo.'
    const db = supabase(cfg)
    const campos = 'nombre,negocio,ciudad,etapa,calificacion,tipo_negocio,libras,frecuencia,resumen,intentos,ultima_llamada,llamada_programada,meet_inicio,creado'
    const filas = (await db.rest(`leads?select=${campos}&order=creado.desc&limit=300`)) ?? []
    const hora = (iso) => (iso ? new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: ZONA }) : '')
    const linea = (l) => [`${l.nombre || 'Sin nombre'}${l.negocio ? ` (${l.negocio})` : ''}`, `etapa ${l.etapa}`, l.calificacion, l.tipo_negocio, l.libras ? `${l.libras} lb` : '', l.meet_inicio ? `videollamada ${hora(l.meet_inicio)}` : '', l.resumen ? `· ${l.resumen.slice(0, 220)}` : ''].filter(Boolean).join(' · ')
    if (buscar.trim()) {
      const l = filas.filter((f) => sinTilde(`${f.nombre} ${f.negocio} ${f.ciudad}`).includes(sinTilde(buscar)))
      return l.length ? l.slice(0, 4).map(linea).join('\n') : `No encuentro a ${buscar} en los clientes de Ana Sofi.`
    }
    const hoy = hoyISO()
    const deHoy = filas.filter((f) => new Date(f.creado).toLocaleDateString('en-CA', { timeZone: ZONA }) === hoy)
    const etapas = {}
    for (const f of filas) etapas[f.etapa] = (etapas[f.etapa] ?? 0) + 1
    const proximas = filas.filter((f) => f.meet_inicio && Date.parse(f.meet_inicio) > Date.now()).sort((a, b) => Date.parse(a.meet_inicio) - Date.parse(b.meet_inicio))
    return [
      `Clientes nuevos hoy: ${deHoy.length}. En total: ${filas.length} (${Object.entries(etapas).map(([k, v]) => `${k} ${v}`).join(', ')}).`,
      `Próximas videollamadas: ${proximas.length ? proximas.slice(0, 4).map((f) => `${f.nombre || f.negocio} ${hora(f.meet_inicio)}`).join('; ') : 'ninguna'}.`,
      'Los más recientes:',
      ...filas.slice(0, 5).map(linea),
    ].join('\n')
  }

  const servidor = createServer(async (req, res) => {
    // Only this machine, by its own name: a web page elsewhere cannot reach it through the browser.
    const host = String(req.headers.host ?? '')
    if (host !== `127.0.0.1:${puerto}` && host !== `localhost:${puerto}`) return res.writeHead(403).end()
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(PAGINA)
    }
    const responder = (code, body) => res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body))
    if (req.method !== 'POST') return res.writeHead(404).end()
    const origen = req.headers.origin
    if (origen !== `http://127.0.0.1:${puerto}` && origen !== `http://localhost:${puerto}`) return res.writeHead(403).end()
    try {
      if (req.url === '/vivo') {
        const llave = typeof elevenKey === 'function' ? elevenKey() : elevenKey
        if (!llave) return responder(503, { error: 'Me falta la llave de voz.' })
        cache = null
        const c = await contexto()
        if (!agente) agente = await agenteDeConsola(llave)
        const [token, firmada] = await Promise.allSettled([el(`/conversation/token?agent_id=${agente}`, llave), el(`/conversation/get-signed-url?agent_id=${agente}`, llave)])
        const conversationToken = token.status === 'fulfilled' ? token.value.token : null
        const signedUrl = firmada.status === 'fulfilled' ? firmada.value.signed_url : null
        if (!conversationToken && !signedUrl) {
          agente = null
          throw firmada.reason || token.reason
        }
        const h = herramientasDe(c)
        return responder(200, { conversationToken, signedUrl, variables: contextoDe({ ...c, herramientas: h }) })
      }
      const m = /^\/herramienta\/([a-z_]+)$/.exec(req.url ?? '')
      if (m) {
        const args = JSON.parse((await leer(req)) || '{}')
        if (m[1] === 'ultron_completo') return responder(200, { resultado: await completo(String(args.pedido ?? '').slice(0, 2000)) })
        if (m[1] === 'pedir_tarea') return responder(200, { resultado: await pedir(args) })
        if (m[1] === 'ventas_ana_sofi') return responder(200, { resultado: await ventas(String(args.buscar ?? '')) })
        const h = herramientasDe(await contexto())
        if (!h[m[1]]) return responder(404, { resultado: 'No conozco esa herramienta.' })
        return responder(200, { resultado: String(await h[m[1]](args)).slice(0, 6000) })
      }
      return res.writeHead(404).end()
    } catch (err) {
      console.log(`${TAG} voice console: ${err.message}`)
      return responder(500, { error: err.message })
    }
  })
  servidor.on('error', (err) => console.log(`${TAG} voice console not started: ${err.message}`))
  servidor.listen(puerto, '127.0.0.1', () => console.log(`${TAG} voice console on http://127.0.0.1:${puerto}`))
  return servidor
}

const PAGINA = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ultron</title>
<style>
:root{color-scheme:dark}
html,body{margin:0;height:100%;background:#07080b;color:#f4efe8;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;overflow:hidden}
main{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px}
canvas{width:min(70vmin,560px);height:min(70vmin,560px)}
#estado{font-size:20px;letter-spacing:.04em;color:#ffb066;min-height:28px;text-align:center;padding:0 24px}
#boton{appearance:none;border:0;border-radius:999px;padding:18px 44px;font-size:20px;font-weight:600;background:#ff9a2e;color:#120a02;cursor:pointer}
#boton.fin{background:#2a2c33;color:#f4efe8}
#boton:disabled{opacity:.5;cursor:default}
</style></head><body><main>
<canvas id="orbe" width="1120" height="1120" aria-hidden="true"></canvas>
<div id="estado" role="status">Toca para hablar con Ultron</div>
<button id="boton" type="button">Hablar</button>
</main><script type="module">
const SDK='https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.32.0/+esm'
const lienzo=document.getElementById('orbe'),c=lienzo.getContext('2d'),estado=document.getElementById('estado'),boton=document.getElementById('boton')
let nivel=0,meta=0,t=0,ses=null,modo='',reloj=null
const P=[];for(let i=0;i<1400;i++){const y=1-i/1399*2,r=Math.sqrt(1-y*y),a=i*2.39996;P.push([Math.cos(a)*r,y,Math.sin(a)*r])}
function dibujar(){t+=0.004;nivel+=(meta-nivel)*0.15;c.clearRect(0,0,1120,1120);const R=330*(1+nivel*0.18),s=Math.sin(t),k=Math.cos(t)
for(const[x,y,z]of P){const X=x*k-z*s,Z=x*s+z*k,j=1+nivel*0.25*Math.sin(t*40+y*9),px=560+X*R*j,py=560+y*R*j,a=(Z+1.3)/2.3
c.fillStyle='rgba(255,'+(140+Math.round(70*a))+',46,'+(0.35+a*0.65)+')';c.fillRect(px,py,4.2,4.2)}requestAnimationFrame(dibujar)}dibujar()
const post=async(ruta,cuerpo)=>{const r=await fetch(ruta,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(cuerpo??{})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'No pude hablar con el cerebro.');return j}
const NOMBRES=['resumen_centro','ultimas_tareas','buscar_tareas','ver_tarea','buscar_archivos','que_hizo_ana_sofi','ventas_ana_sofi','ultron_completo','mandar_al_correo','pedir_tarea']
const herramientas=Object.fromEntries(NOMBRES.map(n=>[n,async(args)=>{try{return (await post('/herramienta/'+n,args)).resultado}catch(e){return 'No pude consultarlo: '+e.message}}]))
function listo(){ses=null;clearInterval(reloj);meta=0;boton.disabled=false;boton.textContent='Hablar';boton.classList.remove('fin');estado.textContent='Toca para hablar con Ultron'}
async function empezar(){boton.disabled=true;estado.textContent='Conectando…'
let cred,Conversation;try{[cred,{Conversation}]=await Promise.all([post('/vivo'),import(SDK)])}catch(e){estado.textContent=e.message;boton.disabled=false;return}
const base={clientTools:herramientas,dynamicVariables:cred.variables,
onModeChange:({mode})=>{modo=mode;estado.textContent=mode==='speaking'?'Ultron está hablando…':'Te escucho…'},
onDisconnect:()=>{listo();estado.textContent='Ultron se despidió. Toca para hablar otra vez.'},onError:(m)=>{estado.textContent='Ultron: '+m}}
try{ses=cred.conversationToken?await Conversation.startSession({...base,conversationToken:cred.conversationToken,connectionType:'webrtc'}):await Conversation.startSession({...base,signedUrl:cred.signedUrl,connectionType:'websocket'})}
catch(e){try{if(!cred.signedUrl)throw e;ses=await Conversation.startSession({...base,signedUrl:cred.signedUrl,connectionType:'websocket'})}catch(e2){estado.textContent=/permission|denied|NotAllowed/i.test(String(e2))?'Necesito permiso para el micrófono.':'No pude conectar: '+(e2.message||e2);boton.disabled=false;return}}
boton.disabled=false;boton.textContent='Terminar';boton.classList.add('fin');estado.textContent='Te escucho…'
reloj=setInterval(()=>{let n=0;try{n=modo==='speaking'?ses.getOutputVolume():ses.getInputVolume()}catch{}meta=Math.min(1,n*2.2)},80)}
boton.onclick=async()=>{if(ses){const s=ses;listo();try{await s.endSession()}catch{}return}empezar()}
</script></body></html>`
