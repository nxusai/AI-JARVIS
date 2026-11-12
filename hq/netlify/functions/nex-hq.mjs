// NEX dentro de HQ: el asistente de Eduardo mientras trabaja. Le escribe o le habla;
// NEX contesta, lo lleva a la página que pide, le ilumina el botón que no encuentra,
// busca en todo HQ y le propone acciones (marcar un pago, apuntar un pendiente…)
// que la página solo hace si Eduardo dice que sí. Solo el admin.
//
// La página manda: los mensajes, qué pantalla está viendo (ruta, título, el texto
// visible y sus botones) y datos útiles (los paydays sin confirmar). Aquí corre el
// ciclo con Claude: "buscar" se resuelve aquí (con la sesión de Eduardo, así que la
// base de datos aplica sus reglas); "ir_a", "senalar" y "proponer" se devuelven a la
// página para que los haga ella.
import Anthropic from '@anthropic-ai/sdk'
import { json, quien, sb } from '../lib/sb.mjs'

const RUTAS = {
  inicio: 'Inicio: saludo, resumen del negocio, quién está trabajando, leads, prospectos y pendientes del equipo',
  clientes: 'Clientes: tarjetas de todos los clientes; botones "✦ Nuevo cliente con IA" y "Nuevo a mano"',
  prospectos: 'Prospectos: tablero por etapas (abrió, datos, pagado, cita, reunión, propuesta, cliente, perdido)',
  leads: 'Leads: los que llegan por ManyChat; NEX les llama; botón "Llamar ahora"',
  anuncios: 'Anuncios: el camino del lead por video, de la vista al cliente',
  cartera: 'Cartera: leads que no contestaron o no les interesó por ahora',
  tareas: 'Tareas de NXUS: tablero Pendiente / En curso / Hecha; botón "+ Nueva tarea"',
  equipo: 'Equipo: tarjetas del equipo con su asistencia de hoy; botón 📷 para poner su foto',
  reloj: 'Reloj: marcar entrada/salida y quién está conectado ahora, en vivo',
  pendientes: 'Mis pendientes (solo Eduardo): Hoy / Semana / Algún día / Logrado; escribir pendientes como habla',
  metas: 'Metas y hábitos: pestañas Metas, Hábitos y Ahorro para metas',
  'metas/ahorro': 'Ahorro para metas: metas con precio, "+ Aparté dinero", plan de ahorro',
  'metas/habitos': 'Hábitos: marcar los de hoy, rachas',
  finanzas: 'Finanzas → Gastos del mes (NXUS): cortes de cada quincena (mandar a México, pasar automáticos, "Ya lo hice"), tablas del 1 al 14 y del 15 al 31, "+ Gasto", estados Se debe/Pagado/Cancelada',
  'finanzas/personal': 'Finanzas → Gastos del mes, vista Personal (gastos personales de Eduardo)',
  'finanzas/entradas': 'Finanzas → Entradas: cobros de clientes por quincena (Por llegar / Payday ¿llegó? / Llegó / No llegó), "+ Otra entrada"',
  nomina: 'Nómina → Pagos: lo que se paga a cada quien; fechas Desde/Hasta',
  'nomina/asistencia': 'Nómina → Asistencia: historial de entradas y salidas, corregir, descargar Excel',
  personas: 'Usuarios: dar de alta, 🔑 Permisos, matriz de permisos, reenviar acceso',
  bitacora: 'Bitácora: quién hizo qué y cuándo',
}

const HERRAMIENTAS = [
  {
    name: 'ir_a',
    description: 'Lleva a Eduardo a una pantalla de HQ. Úsala cuando pide ir a algún lado o cuando lo que busca está en otra pantalla.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['ruta'],
      properties: {
        ruta: { type: 'string', description: `Una de: ${Object.keys(RUTAS).join(', ')}; o "cliente/<id>", "lead/<id>", "prospecto/<id>" con un id que te dio buscar.` },
      },
    },
  },
  {
    name: 'senalar',
    description:
      'Ilumina un botón, campo o sección en la pantalla (con un aro dorado) para que Eduardo lo encuentre. Úsala después de ir_a cuando él no encuentra algo. "objetivo" es el texto visible del botón o del título (ej. "+ Gasto", "Cómo paga", "Ya lo hice", "Descargar Excel", "🔑 Permisos").',
    input_schema: { type: 'object', additionalProperties: false, required: ['objetivo'], properties: { objetivo: { type: 'string' } } },
  },
  {
    name: 'buscar',
    description: 'Busca en todo HQ (clientes, leads, prospectos, tareas, gastos, mis pendientes, personas) por nombre o palabra. Regresa resultados con su ruta.',
    input_schema: { type: 'object', additionalProperties: false, required: ['texto'], properties: { texto: { type: 'string' } } },
  },
  {
    name: 'proponer',
    description:
      'Propone una acción que cambia algo en HQ. NO se hace sola: la página le muestra a Eduardo un botón "Sí, hazlo" y solo se hace si dice que sí. Úsala cuando él te pide hacer algo. Acciones:\n' +
      '- pago_llego: datos {cliente_id, fecha, monto, moneda} (de los paydays sin confirmar).\n' +
      '- pago_no_llego: datos {cliente_id, fecha}.\n' +
      '- gasto_estado: datos {gasto_id, mitad: 1|2, estado: "pagado"|"debe"|"cancelado"} (mitad 1 = del 1 al 14, 2 = del 15 al 31, del mes actual).\n' +
      '- apuntar_pendiente: datos {texto} (como lo dijo; la IA de pendientes lo ordena).\n' +
      '- registrar_entrada: datos {concepto, monto, moneda, cliente_id?} (dinero que llegó y no es un payday).\n' +
      '- nueva_tarea: datos {titulo, detalle?, vence? (AAAA-MM-DD)}.\n' +
      '- marcar_entrada / marcar_salida: datos {} (su reloj).',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['accion', 'datos', 'resumen'],
      properties: {
        accion: { type: 'string', enum: ['pago_llego', 'pago_no_llego', 'gasto_estado', 'apuntar_pendiente', 'registrar_entrada', 'nueva_tarea', 'marcar_entrada', 'marcar_salida'] },
        datos: { type: 'object', description: 'Los datos de la acción (ver la lista).' },
        resumen: { type: 'string', description: 'En una línea, qué vas a hacer, para que Eduardo lo confirme. Ej.: "Marcar que llegó el pago de Abuelito INC ($1,500) del vie 13 nov".' },
      },
    },
  },
]

const SISTEMA = `Eres NEX, el asistente personal de Eduardo Ramos (dueño de NXUS AI) dentro de NXUS HQ, su plataforma. Él te escribe o te habla mientras trabaja en HQ.

Cómo eres: directo, cálido, en español de México, con frases cortas (muchas veces te escucha en voz alta: nada de listas largas ni markdown, máximo 2-3 frases salvo que pida detalle). Tuteas a Eduardo. Nunca inventas datos: si no está en la pantalla ni en lo que encontraste con buscar, dilo.

Lo que puedes hacer:
- Llevarlo a cualquier pantalla (ir_a). Si dice "llévame a…", "abre…", "enséñame…", ve directo, sin preguntar.
- Si "no encuentra" algo: llévalo a la pantalla donde está (ir_a) y señálalo (senalar) con el texto exacto del botón; luego dile en una frase "aquí está" y qué hacer.
- Contestar con lo que hay en la pantalla que está viendo (te llega su texto) o buscando (buscar).
- Hacer cosas por él SOLO proponiéndolas (proponer); la página le pide confirmación. Nunca digas que ya lo hiciste: di que te confirme.

Mapa de HQ (rutas para ir_a):
${Object.entries(RUTAS)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}
Para un cliente concreto: busca su id con buscar y usa "cliente/<id>". "Cómo paga" un cliente se pone en su ficha (cliente/<id>, botón "Cómo paga"). Los permisos de alguien: personas, botón "🔑 Permisos". Las fotos del equipo: equipo, botón 📷.`

/** Busca en las tablas con la sesión de Eduardo (la base de datos aplica sus reglas). */
async function buscar(texto, token) {
  const t = String(texto || '').trim().slice(0, 60)
  if (!t) return []
  const q = (s) => encodeURIComponent(`*${s.replace(/[*,()]/g, ' ').trim()}*`)
  const fuentes = [
    ['clientes', 'id,nombre,grupo,estado', ['nombre', 'grupo'], (x) => ({ tipo: 'cliente', nombre: x.nombre, detalle: x.estado, ruta: `cliente/${x.id}`, id: x.id })],
    ['leads', 'id,nombre,empresa,telefono,estado', ['nombre', 'empresa', 'telefono'], (x) => ({ tipo: 'lead', nombre: x.nombre || x.empresa, detalle: `${x.empresa || ''} · ${x.estado}`, ruta: `lead/${x.id}`, id: x.id })],
    ['prospectos', 'id,nombre,empresa,etapa', ['nombre', 'empresa'], (x) => ({ tipo: 'prospecto', nombre: x.empresa || x.nombre, detalle: x.etapa, ruta: `prospecto/${x.id}`, id: x.id })],
    ['tareas', 'id,titulo,estado,vence', ['titulo'], (x) => ({ tipo: 'tarea', nombre: x.titulo, detalle: `${x.estado}${x.vence ? ` · vence ${x.vence}` : ''}`, ruta: 'tareas', id: x.id })],
    ['gastos', 'id,concepto,monto,moneda,quincena,tipo,notas', ['concepto', 'notas'], (x) => ({ tipo: x.tipo === 'personal' ? 'gasto personal' : 'gasto NXUS', nombre: x.concepto, detalle: `${x.monto} ${x.moneda} · ${x.quincena === 'segunda' ? 'del 15 al 31' : 'del 1 al 14'}`, ruta: x.tipo === 'personal' ? 'finanzas/personal' : 'finanzas', id: x.id })],
    ['pendientes', 'id,titulo,fecha,estado', ['titulo'], (x) => ({ tipo: 'mi pendiente', nombre: x.titulo, detalle: `${x.estado}${x.fecha ? ` · ${x.fecha}` : ''}`, ruta: 'pendientes', id: x.id })],
    ['perfiles', 'id,nombre,cargo,usuario', ['nombre', 'usuario', 'cargo'], (x) => ({ tipo: 'persona', nombre: x.nombre || x.usuario, detalle: x.cargo, ruta: 'personas', id: x.id })],
  ]
  const palabras = [t, ...t.split(/\s+/).filter((w) => w.length > 3)].slice(0, 3)
  const out = []
  for (const p of palabras) {
    const res = await Promise.all(
      fuentes.map(([tabla, campos, donde, map]) =>
        sb(`/rest/v1/${tabla}?select=${campos}&or=(${donde.map((c) => `${c}.ilike.${q(p)}`).join(',')})&limit=5`, { token })
          .then((xs) => (Array.isArray(xs) ? xs.map(map) : []))
          .catch(() => []),
      ),
    )
    for (const x of res.flat()) if (!out.some((y) => y.tipo === x.tipo && y.id === x.id)) out.push(x)
    if (out.length) break
  }
  return out.slice(0, 15)
}

const texto = (c) =>
  (Array.isArray(c) ? c : [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'NEX en HQ es solo para Eduardo' }, 403)
  if (!process.env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'Falta ANTHROPIC_API_KEY en Netlify' }, 503)
  const b = await req.json().catch(() => ({}))
  const historial = (Array.isArray(b.mensajes) ? b.mensajes : [])
    .filter((m) => ['user', 'assistant'].includes(m.role) && String(m.content || '').trim())
    .slice(-16)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
  if (!historial.length || historial.at(-1).role !== 'user') return json({ ok: false, error: 'Escribe algo' }, 400)
  while (historial.length && historial[0].role !== 'user') historial.shift()

  const p = b.pantalla ?? {}
  const ahora = new Date().toLocaleString('es-MX', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })
  const contexto =
    `Ahora: ${ahora} (Nueva York).\n` +
    `Eduardo está viendo: ${String(p.titulo || '').slice(0, 120)} (ruta "${String(p.ruta || 'inicio').slice(0, 80)}").\n` +
    `Botones visibles: ${(Array.isArray(p.botones) ? p.botones : []).slice(0, 80).map((x) => String(x).slice(0, 40)).join(' | ')}\n` +
    `Texto de la pantalla:\n${String(p.texto || '').slice(0, 7000)}\n` +
    (Array.isArray(p.paydays) && p.paydays.length ? `Paydays sin confirmar: ${JSON.stringify(p.paydays.slice(0, 20))}\n` : '') +
    (p.mesFinanzas ? `Mes que tiene abierto en Finanzas: ${p.mesFinanzas}\n` : '')
  // El contexto de la pantalla va como mensaje de sistema a mitad de conversación, después de la última pregunta.
  const mensajes = [...historial, { role: 'system', content: contexto }]

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 })
  const acciones = []
  let respuesta = ''
  try {
    for (let vuelta = 0; vuelta < 6; vuelta++) {
      const res = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
        tools: HERRAMIENTAS,
        messages: mensajes,
      })
      if (res.stop_reason === 'refusal') {
        respuesta = 'Eso no te lo puedo ayudar a hacer.'
        break
      }
      const usos = res.content.filter((x) => x.type === 'tool_use')
      respuesta = texto(res.content) || respuesta
      if (res.stop_reason !== 'tool_use' || !usos.length) break
      mensajes.push({ role: 'assistant', content: res.content })
      const resultados = []
      for (const u of usos) {
        let r
        if (u.name === 'buscar') {
          const xs = await buscar(u.input?.texto, yo.token)
          r = xs.length ? JSON.stringify(xs) : 'Sin resultados.'
        } else if (u.name === 'ir_a') {
          acciones.push({ tipo: 'ir', ruta: String(u.input?.ruta || 'inicio') })
          r = 'Listo, ya está en esa pantalla.'
        } else if (u.name === 'senalar') {
          acciones.push({ tipo: 'senalar', objetivo: String(u.input?.objetivo || '') })
          r = 'Señalado en la pantalla.'
        } else if (u.name === 'proponer') {
          acciones.push({ tipo: 'proponer', accion: u.input?.accion, datos: u.input?.datos ?? {}, resumen: String(u.input?.resumen || '') })
          r = 'Se lo mostré para que confirme. Todavía NO está hecho.'
        } else r = 'Herramienta desconocida.'
        resultados.push({ type: 'tool_result', tool_use_id: u.id, content: r })
      }
      mensajes.push({ role: 'user', content: resultados })
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ ok: false, error: 'Muchas preguntas seguidas; espera un momento.' }, 429)
    if (err instanceof Anthropic.APIError) return json({ ok: false, error: `NEX no pudo pensar (${err.status})` }, 502)
    return json({ ok: false, error: String(err?.message ?? err).slice(0, 200) }, 502)
  }
  return json({ ok: true, texto: respuesta || (acciones.length ? 'Listo.' : 'No te entendí, ¿me lo dices otra vez?'), acciones })
}
