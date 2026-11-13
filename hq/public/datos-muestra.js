// La muestra: los mismos datos y reglas que la versión real, en memoria, para
// ver NXUS HQ antes de conectar Supabase. Se entra como cualquier persona del
// equipo para ver lo que cada quien ve.

const hoy = new Date()
const dia = (d, h = 9, m = 0) => {
  const x = new Date(hoy)
  x.setDate(x.getDate() + d)
  x.setHours(h, m, 0, 0)
  return x.toISOString()
}
const fecha = (d) => dia(d).slice(0, 10)
const id = () => crypto.randomUUID()

const ED = 'u-eduardo'
const LU = 'u-luis'
const AN = 'u-angeles'
const S1 = 'u-socia1'
const S2 = 'u-socia2'

/** Lo que cada quien puede hacer con los prospectos (lo decide Eduardo en Personas). */
function permisos(codigo, ver = 'nada', trabajar = false, etapas = false, convertir = false, pagos = false) {
  return { codigo, pros_ver: ver, pros_trabajar: trabajar, pros_etapas: etapas, pros_convertir: convertir, pros_pagos: pagos }
}

const db = {
  perfiles: [
    { id: ED, nombre: 'Eduardo Ramos', correo: 'contacto@nxusai.org', rol: 'admin', activo: true, cargo: 'Fundador y CEO', sede: 'usa', foto: null, reporta_a: null, creado: dia(-90), ...permisos('eduardo', 'todos', true, true, true, true) },
    { id: LU, nombre: 'Luis Enrique', correo: 'luis@nxusai.org', rol: 'equipo', activo: true, cargo: 'Encargado de operaciones', sede: 'usa', foto: null, reporta_a: ED, creado: dia(-80), ...permisos('luis', 'todos', true, true, true, false) },
    { id: AN, nombre: 'María de los Ángeles', correo: 'angeles@nxusai.org', rol: 'equipo', activo: true, cargo: 'Diseñadora', sede: 'usa', foto: null, reporta_a: LU, creado: dia(-60), ...permisos(null) },
    { id: S1, nombre: 'Barbara', correo: 'barbara@nxusai.org', rol: 'equipo', activo: true, cargo: 'Socia · NXUS México', sede: 'mexico', foto: null, reporta_a: ED, creado: dia(-30), ...permisos('barbara', 'suyos', true, true, false, false) },
    { id: S2, nombre: 'Tania', correo: 'tania@nxusai.org', rol: 'equipo', activo: true, cargo: 'Socia · NXUS México', sede: 'mexico', foto: null, reporta_a: ED, creado: dia(-30), ...permisos('tania', 'suyos', true, true, false, false) },
  ],
  clientes: [],
  clientes_dinero: [],
  tareas: [],
  jornadas: [],
  nomina: [
    { persona: LU, esquema: 'fijo', monto_quincena: 5000, moneda: 'MXN', horas_semana: 40, pago_dia_completo: 0, porcentaje: 0, notas: '' },
    { persona: AN, esquema: 'medio-tiempo', monto_quincena: 2500, moneda: 'MXN', horas_semana: 20, pago_dia_completo: 0, porcentaje: 0, notas: '4 horas al día, 20 a la semana; los días completos (8 horas) se pagan aparte.' },
    { persona: S1, esquema: 'comision', monto_quincena: 0, moneda: 'MXN', horas_semana: 40, pago_dia_completo: 0, porcentaje: 50, notas: '50% de los contratos que consiga.' },
    { persona: S2, esquema: 'comision', monto_quincena: 0, moneda: 'MXN', horas_semana: 40, pago_dia_completo: 0, porcentaje: 50, notas: '50% de los contratos que consiga.' },
  ],
  nomina_ajustes: [],
  comisiones: [],
  bitacora: [],
  prospectos: [],
  prospectos_notas: [],
  prospectos_pagos: [],
  leads: [],
  leads_notas: [],
  pendientes: [],
  metas: [],
  habitos: [],
  habitos_dias: [],
  documentos: [],
  cobros: [],
  cobros_omitidos: [],
  gastos: [],
  finanzas_config: [{ id: 1, tipo_cambio: 18.5, moneda_base: 'USD', saldo: 6200, saldo_moneda: 'USD', saldo_fecha: dia(-1), meta_libre: 5000, desde: fecha(-20), nomina_cuenta: 'c-mx', cambio_auto: true, saldo_usd: 7700, saldo_mxn: 9000, tc_felix: 18.42, tc_felix_fecha: dia(-1) }],
  metas_aportes: [],
  cuentas: [
    { id: 'c-usa', nombre: 'Chase principal', banco: 'Chase', moneda: 'USD', saldo: 6200, saldo_fecha: dia(-2), principal: true, activa: true, orden: 1 },
    { id: 'c-usa2', nombre: 'Bank of America', banco: 'BofA', moneda: 'USD', saldo: 1500, saldo_fecha: dia(-2), principal: false, activa: true, orden: 2 },
    { id: 'c-mx', nombre: 'BBVA México', banco: 'BBVA', moneda: 'MXN', saldo: 9000, saldo_fecha: dia(-2), principal: false, activa: true, orden: 3 },
  ],
  traspasos: [],
  envios: [],
  gastos_estado: [],
  movimientos: [],
}

const cliente = (c, dinero) => {
  const x = { id: id(), grupo: null, estado: 'activo', equipo: 'usa', servicios: [], descripcion: '', contacto_nombre: '', contacto_correo: '', contacto_tel: '', sistema_nombre: '', sistema_url: '', inicio: null, responsable: LU, traido_por: null, propio: false, creado: dia(-60), actualizado: dia(-2), ...c }
  db.clientes.push(x)
  db.clientes_dinero.push({ cliente_id: x.id, mensualidad: 0, pago_unico: 0, moneda: 'USD', dia_cobro: null, notas: '', ...dinero })
  return x
}
const aurelius = cliente(
  { nombre: 'Aurelius', grupo: 'Ramos & Co.', equipo: 'mexico', propio: true, responsable: S1, servicios: ['Marketing y redes', 'Sitio web', 'Sistema de entrada y salida'], descripcion: 'El restaurante de Eduardo. El equipo NXUS México lleva su marketing. Tiene su sistema de entrada y salida del personal.', sistema_nombre: 'Entrada y salida' },
  {},
)
// Un viernes en que Abuelito sí pagó (paga cada dos viernes).
const viernesPagado = (() => {
  const d = new Date(hoy)
  d.setDate(d.getDate() - ((d.getDay() + 2) % 7) - 7)
  return d.toLocaleDateString('en-CA')
})()
const abuelito = cliente(
  { nombre: 'Abuelito INC', grupo: 'Abuelito INC', servicios: ['Centro de trabajo (CRM) con Ultron', 'Anuncios en Meta', 'Contenido'], descripcion: 'Holding de Abuelito Cheese, Abuelito Meat y Abuelito Corn. Usa el Centro de trabajo con Ultron para su dirección.', sistema_nombre: 'Centro de trabajo', sistema_url: 'https://centro-misemago-abuelito.netlify.app' },
  { frecuencia: 'catorcenal', monto_cobro: 1500, mensualidad: 3250, moneda: 'USD', cobro_ancla: viernesPagado, cobro_dias: [] },
)
const semago = cliente(
  { nombre: 'Mi Semago', servicios: ['Centro de trabajo (CRM) con Ultron', 'Ana Sofi: ventas por teléfono', 'Etiquetas de trazabilidad', 'Anuncios en Meta'], descripcion: 'Comparte el Centro de trabajo con Abuelito INC. Ana Sofi llama a sus prospectos e imprime sus etiquetas.', sistema_nombre: 'Centro de trabajo', sistema_url: 'https://centro-misemago-abuelito.netlify.app' },
  { frecuencia: 'mensual', monto_cobro: 1200, mensualidad: 1200, moneda: 'USD', dia_cobro: 1, cobro_dias: [1] },
)
cliente({ nombre: 'VAYRO', grupo: 'Keko Foods', estado: 'prospecto', servicios: ['Administración por Ramos & Co.', 'IA Vivian (en preparación)'], descripcion: 'De los mismos dueños de Abuelito, empresa independiente. Primero la administra Ramos & Co.' }, {})

// Finanzas de muestra: cobros que llegaron, gastos con sus días y una meta con precio.
cliente({ nombre: 'Grupo Norte (contrato MX)', equipo: 'mexico', servicios: ['Centro de trabajo'], descripcion: 'Contrato en México: paga en pesos, directo a la cuenta de México.' }, { frecuencia: 'mensual', monto_cobro: 45000, mensualidad: 45000, moneda: 'MXN', dia_cobro: 5, cobro_dias: [5], cuenta_id: 'c-mx' })
{
  const mesHoy = (d) => new Date(hoy.getFullYear(), hoy.getMonth(), d).toLocaleDateString('en-CA')
  db.cobros.push({ id: id(), cliente_id: abuelito.id, concepto: '', monto: 1500, moneda: 'USD', fecha: viernesPagado, para_fecha: viernesPagado, metodo: 'Zelle', nota: '', creado: dia(-7) })
  if (hoy.getDate() > 1) db.cobros.push({ id: id(), cliente_id: semago.id, concepto: '', monto: 1200, moneda: 'USD', fecha: mesHoy(1), para_fecha: mesHoy(1), metodo: 'Transferencia', nota: '', creado: dia(-3) })
  const g = (x) => db.gastos.push({ id: id(), categoria: 'software', tipo: 'negocio', empresa: 'NXUS AI', moneda: 'USD', frecuencia: 'mensual', ancla: null, dias: [], hasta: null, activo: true, automatico: false, notas: '', creado: dia(-30), orden: db.gastos.length, ...x })
  // Como el Notion de Eduardo (gastos de NXUS).
  for (const [concepto, monto, quincena, dia_texto, automatico, notas, activo = true] of [
    ['Pago Luis Bermudez (empleado)', 295, 'primera', '29 - 2', false, 'Tarjeta México'],
    ['Pago Ángeles (empleada)', 148, 'primera', '29 - 2', false, 'Tarjeta México'],
    ['Deudas', 253, 'primera', '', false, 'Destinar a una deuda'],
    ['Canva', 14.99, 'primera', '1', true, 'Automatizado'],
    ['Google account', 106, 'primera', '2', true, 'Automatizado'],
    ['Internet México', 100, 'primera', '5', false, 'Tarjeta México'],
    ['Goodnotes', 0.9, 'primera', '6', true, 'Automatizado'],
    ['Adobe', 31.97, 'primera', '9', true, 'Automatizado'],
    ['ChatGPT NXUS', 20, 'primera', '11', true, 'Automatizado'],
    ['ChatGPT', 20, 'primera', '12', true, 'Automatizado'],
    ['Pago Luis Bermudez (empleado)', 295, 'segunda', '15 - 17', false, 'Tarjeta de México'],
    ['Pago Ángeles (empleada)', 148, 'segunda', '15 - 17', false, 'Tarjeta de México'],
    ['Deudas', 253, 'segunda', '', false, 'Destinar a una deuda'],
    ['StackBlitz (Bolt)', 20, 'segunda', '23', true, 'Automatizado'],
    ['Notion', 24, 'segunda', '23', true, 'Automatizado'],
    ['The Real World', 50, 'segunda', '29', true, 'Automatizado'],
    ['ElevenLabs (voces)', 22, 'segunda', '29 - 31', true, 'Automatizado'],
    ['Runway AI', 0, 'segunda', '29 - 31', true, 'Cancelada', false],
  ])
    g({ concepto, monto, quincena, dia_texto, automatico, notas, activo })
  // Personales (solo Eduardo).
  for (const [concepto, monto, quincena, dia_texto, automatico, notas, activo = true] of [
    ['Mamá', 100, 'primera', '29 - 2', false, 'Tarjeta México'], ['Capital One', 100, 'primera', '2', true, 'Automatizado'], ['Netflix', 26.65, 'primera', '5', true, 'Automatizado'],
    ['iCloud Apple', 1, 'primera', '5', true, 'Automatizado'], ['Amazon Prime', 10, 'primera', '9', true, ''], ['Crédito Wells Fargo', 100, 'primera', '11', false, 'Pagar directo a la tarjeta'],
    ['iCloud mamá', 0.99, 'primera', '13', true, 'Automatizado'], ['Renta', 224, 'primera', '14', false, 'Pago manual'],
    ['Mamá', 100, 'segunda', '15 - 17', false, 'Tarjeta de México'], ['Apple Music (yo)', 11, 'segunda', '15', true, 'Automatizado'], ['Apple Music (mamá)', 11, 'segunda', '15', true, 'Automatizado'],
    ['Agua México', 40, 'segunda', '15', false, 'Tarjeta de México'], ['Luz México', 118, 'segunda', '15', false, 'Tarjeta de México'], ['AT&T celular', 352, 'segunda', '16', true, 'Automatizado'],
    ['Coppel', 60, 'segunda', '25', false, 'Tarjeta de México'], ['Credit One', 100, 'segunda', '26', true, 'Automatizado'],
    ['Verizon', 0, 'segunda', '27', true, 'Automatizado · cancelada', false], ['PSE&G', 0, 'segunda', '25', false, 'Pago manual · cancelada', false],
  ])
    g({ concepto, monto, quincena, dia_texto, automatico, notas, activo, tipo: 'personal', empresa: '', categoria: 'casa' })
  const casa = { id: id(), area: 'patrimonio', titulo: 'Casa multifamiliar para rentar', porque: 'Que la renta pague la casa y me deje ingreso', periodo: 'año', fecha_limite: null, progreso: 0, estado: 'activa', monto_objetivo: 800000, moneda: 'USD', aporte_monto: 500, aporte_frecuencia: 'quincenal', creado: dia(-20), actualizado: dia(-1) }
  db.metas.push(casa)
  db.metas_aportes.push({ id: id(), meta_id: casa.id, monto: 30, moneda: 'USD', fecha: fecha(-6), nota: 'Primer apartado', creado: dia(-6) })
}

const tarea = (t) => db.tareas.push({ id: id(), cliente_id: null, detalle: '', estado: 'pendiente', vence: null, creada_por: ED, creada: dia(-3), actualizada: dia(-1), ...t })
tarea({ titulo: 'Parrilla de contenido de noviembre', cliente_id: aurelius.id, asignado: AN, vence: fecha(4), estado: 'en-curso' })
tarea({ titulo: 'Revisar tareas atrasadas en el Centro de trabajo', cliente_id: abuelito.id, asignado: LU, vence: fecha(1) })
tarea({ titulo: 'Diseños de anuncios para Mi Semago', cliente_id: semago.id, asignado: AN, vence: fecha(2) })
tarea({ titulo: 'Reporte mensual de anuncios', cliente_id: semago.id, asignado: LU, vence: fecha(6) })
tarea({ titulo: 'Propuesta para el cliente nuevo de México', asignado: S1, vence: fecha(3), creada_por: S1 })
tarea({ titulo: 'Logo y paleta de VAYRO', asignado: AN, estado: 'hecha' })

// Entradas y salidas de esta quincena; un día completo de Ángeles.
for (let d = -6; d <= -1; d++) {
  const w = new Date(dia(d)).getDay()
  if (w === 0 || w === 6) continue
  db.jornadas.push({ id: id(), persona: LU, entrada: dia(d, 9), salida: dia(d, 17, 30), dia_completo: false, nota: '' })
  const largo = d === -3
  db.jornadas.push({ id: id(), persona: AN, entrada: dia(d, 10), salida: largo ? dia(d, 18, 15) : dia(d, 14), dia_completo: largo, nota: largo ? 'Se quedó el día completo' : '' })
}
db.jornadas.push({ id: id(), persona: LU, entrada: dia(0, 9, 5), salida: null, dia_completo: false, nota: '' })

// Prospectos que llegaron por el portal (y uno apuntado a mano).
const prospecto = (p) => {
  const x = { id: id(), portal_id: id(), origen: 'portal', link: '', nombre: '', empresa: '', direccion: '', whatsapp: '', correo: '', lineas: [], diagnostico: {}, camino: '', acepta_novedades: false, etapa: 'abrio', cita: null, meet: '', siguiente: '', siguiente_fecha: null, motivo_perdido: '', traido_por: null, asignado: null, cliente_id: null, creado: dia(-5), actualizado: dia(-1), ...p }
  x.asignado ??= x.traido_por
  db.prospectos.push(x)
  return x
}
const nota = (p, autor, texto, d) => db.prospectos_notas.push({ id: id(), prospecto_id: p.id, autor, texto, creada: dia(d, 12) })
const juan = prospecto({
  link: 'juan-perez', nombre: 'Juan Pérez', empresa: 'Distribuidora Pérez', direccion: 'Av. Juárez 120, Centro, Monterrey', whatsapp: '+52 81 1234 5678', correo: 'juan@distribuidoraperez.mx',
  lineas: ['NXUS Neural: Consulta', 'NXUS Neural: Coordina', 'Software a la medida: Ventas y CRM'],
  diagnostico: { giro: 'Distribución', tamano: '21 a 100', pais: 'México', urgencia: 'Pronto: este mes', quiere: 'Saber en tiempo real cuánto vendemos y que el inventario se pida solo.' },
  camino: 'consulta', acepta_novedades: true, etapa: 'cita', cita: dia(2, 11), meet: 'https://meet.google.com/abc-defg-hij', traido_por: S1, creado: dia(-4), actualizado: dia(-1),
  siguiente: 'Preparar la consultoría con su caso de inventarios', siguiente_fecha: fecha(1),
})
nota(juan, S1, 'Le mandé el video del Centro de trabajo de Abuelito; le encantó lo de las tareas por mes.', -3)
nota(juan, ED, 'Pagó la consultoría. Que Luis prepare la demo de inventarios.', -1)
db.prospectos_pagos.push({ id: id(), prospecto_id: juan.id, concepto: 'Consultoría', monto: 2500, moneda: 'MXN', sesion: 'cs_muestra_1', fecha: dia(-2, 16) })
db.comisiones.push({ id: id(), persona: S1, cliente_id: null, concepto: 'Consultoría · Distribuidora Pérez', fecha: fecha(-2), monto_cobrado: 2500, porcentaje: 50, moneda: 'MXN', pagada: false })
prospecto({
  link: 'karla-mendez', nombre: 'Karla Méndez', empresa: 'Clínica Dental Sonríe', whatsapp: '+52 55 2345 6789', correo: 'karla@sonrie.mx',
  lineas: ['Atención y ventas con IA: WhatsApp y mensajes', 'Marketing y producción: Publicidad digital'],
  diagnostico: { giro: 'Servicios', tamano: '6 a 20', pais: 'México', urgencia: 'Urgente: lo necesito ya', quiere: 'Que el WhatsApp conteste solo y agende citas.' },
  camino: 'propuesta', etapa: 'datos', traido_por: S2, creado: dia(-1, 18), actualizado: dia(-1, 18),
})
prospecto({ link: 'roberto-diaz', etapa: 'abrio', traido_por: S2, creado: dia(0, 9), actualizado: dia(0, 9) })
const mario = prospecto({
  link: 'mario-ruiz', nombre: 'Mario Ruiz', empresa: 'Taquería El Güero', direccion: 'Newark, NJ', whatsapp: '+1 973 555 0182', correo: 'mario@elguero.com',
  lineas: ['Web, conexiones y datos: Websites y tiendas', 'Marketing y producción: Estrategia y redes'],
  diagnostico: { giro: 'Restaurantes', tamano: '6 a 20', pais: 'USA', urgencia: 'Planeándolo: 1 a 3 meses', quiere: 'Página con pedidos en línea y redes que se vean pro.' },
  camino: 'propuesta', etapa: 'propuesta', cita: dia(-6, 15), traido_por: null, asignado: LU, creado: dia(-12), actualizado: dia(-2),
  siguiente: 'Llamarle para cerrar la propuesta', siguiente_fecha: fecha(-1),
})
nota(mario, LU, 'Se le mandó la propuesta: web + redes, 800 USD al mes.', -2)
prospecto({
  link: 'sofia-luna', nombre: 'Sofía Luna', empresa: 'Boutique Luna', whatsapp: '+52 33 3456 7890', correo: 'sofia@boutiqueluna.mx',
  lineas: ['Marketing y producción: Contenido con IA'], diagnostico: { giro: 'Comercio', tamano: '1 a 5', pais: 'México', urgencia: 'Sin prisa: solo explorando', quiere: '' },
  camino: 'propuesta', etapa: 'perdido', motivo_perdido: 'Por ahora no tiene presupuesto; retomar en enero.', traido_por: S1, creado: dia(-20), actualizado: dia(-8),
})
prospecto({ origen: 'manual', portal_id: null, nombre: 'Lic. Andrés Torres', empresa: 'Despacho Torres', whatsapp: '+52 81 9876 5432', etapa: 'reunion', traido_por: ED, asignado: ED, creado: dia(-3), actualizado: dia(-1), siguiente: 'Mandarle el portal para que llene su diagnóstico', siguiente_fecha: fecha(0) })

// Leads de los anuncios: llegan de ManyChat, NEX les llama una vez y quedan
// agendados (→ Prospectos), en la Cartera o como no calificados.
const lead = (l) => {
  const x = { id: id(), manychat_id: id(), origen: 'manychat', canal: 'instagram', fuente: 'Comentó INFO', anuncio_id: '', nombre: '', empresa: '', direccion: '', telefono: '', correo: '', ciudad: '', pais: '', idioma: 'es', servicio: '', permiso_llamada: true, permiso_fecha: null, permiso_texto: 'Sí, acepto que un asistente de IA de NXUS AI me llame a este número.', estado: 'nuevo', motivo: '', llamada_id: '', llamada_error: '', intentos: 0, llamada_inicio: null, llamada_seg: null, grabacion: '', resumen: '', puntos: {}, transcripcion: '', prospecto_id: null, asignado: null, creado: dia(0, 9), actualizado: dia(0, 9), ...l }
  if (x.idioma === 'en' && !l.permiso_texto) x.permiso_texto = 'Yes, I agree to receive a call from an NXUS AI assistant at this number.'
  if (!x.permiso_llamada) x.permiso_texto = ''
  x.permiso_fecha = x.permiso_llamada ? x.creado : null
  db.leads.push(x)
  return x
}
const carlos = prospecto({
  origen: 'anuncio', portal_id: null, nombre: 'Carlos Medina', empresa: 'Medina Logistics', direccion: 'Elizabeth, NJ', whatsapp: '+1 908 555 0147', correo: 'carlos@medinalogistics.com',
  lineas: ['Pidió en el chat: Automatización de despacho'], diagnostico: { pais: 'USA', ciudad: 'Elizabeth, NJ', idioma: 'Español', quiere: 'Empresa de transporte con 14 camiones. Coordina todo por WhatsApp y Excel; pierde viajes por no contestar a tiempo.' },
  etapa: 'cita', cita: dia(1, 11), meet: 'https://meet.google.com/nxs-cmed-ina', asignado: ED, creado: dia(0, 8, 47), actualizado: dia(0, 9, 2),
})
lead({
  nombre: 'Carlos Medina', empresa: 'Medina Logistics', direccion: '410 N Broad St, Elizabeth, NJ', telefono: '+1 908 555 0147', correo: 'carlos@medinalogistics.com', ciudad: 'Elizabeth, NJ', pais: 'usa', canal: 'facebook', fuente: 'Anuncio NY · Video B', anuncio_id: '120210000000001',
  servicio: 'Automatización de despacho', estado: 'agendado', prospecto_id: carlos.id, creado: dia(0, 8, 47), actualizado: dia(0, 9, 2),
  llamada_id: 'conv_muestra_1', llamada_inicio: dia(0, 8, 49), llamada_seg: 412, grabacion: 'https://elevenlabs.io',
  resumen: 'Empresa de transporte con 14 camiones en NJ. Coordina viajes por WhatsApp y Excel, pierde viajes por no contestar a tiempo. Le interesa que los clientes coticen y agenden solos. Agendó meeting mañana a las 11:00.',
  puntos: { empresa: 'Transporte de carga, 14 camiones, 22 empleados', necesidad: 'Que las cotizaciones y la agenda de viajes se hagan solas', usa_hoy: 'WhatsApp, Excel y llamadas', decide: 'Sí, es el dueño', urgencia: 'Alta: está perdiendo viajes cada semana', presupuesto: 'No dio cifra; dijo que lo que se pierde al mes es más que una solución', consejo: 'Un asistente que conteste WhatsApp y cotice con sus tarifas, conectado a su agenda' },
  transcripcion: 'NEX: Hola Carlos, soy NEX, el asistente de inteligencia artificial de NXUS AI. Te llamo porque dejaste tus datos hace un momento en nuestro chat. Esta llamada se graba para darte un mejor servicio. ¿Tienes unos minutos?\nCarlos: Sí, claro.\nNEX: Perfecto. Cuéntame de tu empresa…',
})
// ElevenLabs escribe el resumen en inglés; HQ guarda las dos versiones.
Object.assign(db.leads.at(-1), {
  resumen: 'Trucking company with 14 trucks in NJ. Coordinates trips over WhatsApp and Excel and loses jobs by not answering in time. Wants customers to get quotes and book on their own. Booked a meeting for tomorrow at 11:00.',
  traduccion: {
    es: { resumen: db.leads.at(-1).resumen, puntos: db.leads.at(-1).puntos },
    en: {
      resumen: 'Trucking company with 14 trucks in NJ. Coordinates trips over WhatsApp and Excel and loses jobs by not answering in time. Wants customers to get quotes and book on their own. Booked a meeting for tomorrow at 11:00.',
      puntos: { empresa: 'Freight trucking, 14 trucks, 22 employees', necesidad: 'Quotes and trip scheduling that run on their own', usa_hoy: 'WhatsApp, Excel and phone calls', decide: 'Yes, he is the owner', urgencia: 'High: losing jobs every week', presupuesto: "Didn't give a number; said what he loses each month is more than a solution", consejo: 'An assistant that answers WhatsApp and quotes with his rates, connected to his schedule' },
    },
  },
})
db.leads_notas.push({ id: id(), lead_id: db.leads.at(-1).id, autor: ED, texto: 'Llevar ejemplo de cotizador por WhatsApp.', creada: dia(0, 9, 30) })
lead({ nombre: 'Jessica Brown', empresa: 'Bright Smile Dental', telefono: '+1 201 555 0133', correo: 'jessica@brightsmile.com', ciudad: 'Jersey City, NJ', pais: 'usa', idioma: 'en', servicio: 'AI receptionist / appointment booking', canal: 'instagram', fuente: 'Commented INFO', creado: dia(0, 9, 41), actualizado: dia(0, 9, 41), estado: 'llamando', llamada_inicio: dia(0, 9, 42) })
lead({ nombre: 'Rosa Elena Vázquez', empresa: 'Panadería La Espiga', direccion: 'Calle Morelos 55, Puebla', telefono: '+52 222 555 0190', correo: 'rosa@laespiga.mx', ciudad: 'Puebla', pais: 'mexico', servicio: 'Pedidos por WhatsApp', canal: 'facebook', fuente: 'Anuncio MX · Video C', creado: dia(0, 10, 5), actualizado: dia(0, 10, 5) })
lead({ nombre: 'Tom Kowalski', empresa: 'TK Roofing', telefono: '+1 732 555 0111', ciudad: 'Edison, NJ', pais: 'usa', idioma: 'en', servicio: 'Lead follow-up', canal: 'instagram', fuente: 'Commented INFO', permiso_llamada: false, estado: 'cartera', motivo: 'sin_permiso', creado: dia(0, 7, 30), actualizado: dia(0, 7, 31) })
lead({ nombre: 'Miguel Ángel Soto', empresa: 'Autolavado Soto', telefono: '+52 81 5555 0177', correo: 'miguel@autolavadosoto.mx', ciudad: 'Monterrey', pais: 'mexico', servicio: 'Página web y redes', canal: 'instagram', estado: 'cartera', motivo: 'no_contesto', creado: dia(-1, 17, 12), actualizado: dia(-1, 17, 15), llamada_inicio: dia(-1, 17, 13), llamada_seg: 0, resumen: 'No contestó. Se dejó mensaje en el buzón.' })
lead({ nombre: 'Laura Peña', empresa: 'Inmobiliaria Peña', telefono: '+52 55 5555 0122', correo: 'laura@inmopena.mx', ciudad: 'CDMX', pais: 'mexico', servicio: 'Chatbot para clientes', canal: 'facebook', fuente: 'Anuncio MX · Video A', estado: 'cartera', motivo: 'ahora_no', creado: dia(-2, 12), actualizado: dia(-2, 12, 20), llamada_inicio: dia(-2, 12, 2), llamada_seg: 148, resumen: 'Le interesa, pero está cerrando el trimestre. Pidió que la busquen en diciembre.', puntos: { necesidad: 'Contestar a los interesados en propiedades fuera de horario', decide: 'Sí, con su socio', urgencia: 'Baja: después de diciembre' } })
lead({ nombre: 'Kevin Ortiz', empresa: 'Ortiz Cleaning', telefono: '+1 973 555 0166', ciudad: 'Paterson, NJ', pais: 'usa', idioma: 'en', servicio: 'Social media', canal: 'instagram', estado: 'cartera', motivo: 'colgo', creado: dia(-2, 15), actualizado: dia(-2, 15, 3), llamada_inicio: dia(-2, 15, 1), llamada_seg: 21, resumen: 'Colgó después de la presentación.' })
lead({ nombre: 'Daniela Ríos', empresa: 'Estética Dany', telefono: '+52 33 5555 0155', ciudad: 'Guadalajara', pais: 'mexico', servicio: 'Agenda de citas', canal: 'instagram', estado: 'no_llamar', creado: dia(-3, 11), actualizado: dia(-3, 11, 6), llamada_inicio: dia(-3, 11, 2), llamada_seg: 35, resumen: 'Dijo que ya no le interesa y que no le vuelvan a llamar.' })
lead({ nombre: 'Humberto Olvera', empresa: 'Laboratorio Dental Olvera', telefono: '+52 55 5555 0101', correo: 'h@olvera.mx', ciudad: 'CDMX', pais: 'mexico', servicio: 'Sucursales: 2 a 5 · WhatsApp con IA', canal: 'facebook', fuente: 'Anuncio MX · Video C', estado: 'agendado', creado: dia(-1, 3, 15), actualizado: dia(-1, 3, 30), llamada_inicio: dia(-1, 3, 23), llamada_seg: 590 })
lead({ nombre: 'Mariana Ortiz', empresa: 'Grupo La Terraza', telefono: '+52 55 5555 0102', correo: 'mo@laterraza.mx', ciudad: 'CDMX', pais: 'mexico', servicio: 'Sucursales: 6 o más · Reservas', canal: 'facebook', fuente: 'Anuncio MX · Video A', estado: 'agendado', creado: dia(-3, 22, 10), actualizado: dia(-3, 22, 30), llamada_inicio: dia(-3, 22, 12), llamada_seg: 410 })
lead({ nombre: 'Ricardo Salas', empresa: 'Mariscos Salas', telefono: '+52 81 5555 0103', ciudad: 'Monterrey', pais: 'mexico', servicio: 'Sucursales: 2 a 5', canal: 'facebook', fuente: 'Anuncio MX · Video A', estado: 'cartera', motivo: 'no_contesto', creado: dia(-2, 20), actualizado: dia(-2, 20, 5) })
lead({ nombre: '', empresa: '', canal: 'facebook', fuente: 'Anuncio MX · Video B', estado: 'incompleto', permiso_llamada: false, creado: dia(-1, 11), actualizado: dia(-1, 11) })
lead({ nombre: 'Luis Pérez', empresa: 'Pérez Remodeling', telefono: '+1 201 555 0104', correo: 'luis@perezremodel.com', ciudad: 'Union City, NJ', pais: 'usa', servicio: 'Sucursales: 1', canal: 'facebook', fuente: 'Anuncio NY · Video A', estado: 'agendado', creado: dia(-4, 19), actualizado: dia(-4, 19, 20), llamada_inicio: dia(-4, 19, 2), llamada_seg: 330 })
lead({ nombre: 'Ana Gómez', empresa: 'Clínica Gómez', telefono: '+1 973 555 0105', ciudad: 'Paterson, NJ', pais: 'usa', servicio: 'Sucursales: 2 a 5', canal: 'facebook', fuente: 'Anuncio NY · Video C', estado: 'cartera', motivo: 'ahora_no', creado: dia(-5, 15), actualizado: dia(-5, 15, 10), llamada_inicio: dia(-5, 15, 1), llamada_seg: 95 })
lead({ nombre: 'Jorge Ruiz', empresa: 'Taquería El Güero', telefono: '5512345678', ciudad: '', pais: '', servicio: 'Pedidos por WhatsApp', canal: 'instagram', fuente: 'Comentó RESTAURANTES', llamada_error: 'No sé de qué país es el número "5512345678" (no trae lada y no dijo el país). Corrígelo con "Editar datos" y dale "Llamar ahora".', creado: dia(0, 9, 40), actualizado: dia(0, 9, 41) })
lead({ nombre: 'Pedro', empresa: '', telefono: '', ciudad: '', pais: '', servicio: '', canal: 'instagram', permiso_llamada: false, estado: 'incompleto', creado: dia(0, 8, 15), actualizado: dia(0, 8, 16) })
lead({ nombre: 'Andrea Gil', empresa: 'Café Gil', telefono: '', ciudad: 'León', pais: 'mexico', servicio: 'Contenido para redes', canal: 'facebook', permiso_llamada: false, estado: 'incompleto', creado: dia(-1, 20, 40), actualizado: dia(-1, 20, 44) })

let yo = null
const copia = (x) => JSON.parse(JSON.stringify(x))
const admin = () => yo?.rol === 'admin'
const nunca = () => {
  throw new Error('No tienes permiso para hacer eso')
}
const anotar = (accion, tabla, fila) => db.bitacora.unshift({ id: db.bitacora.length + 1, quien: yo?.id ?? null, accion, tabla, fila: String(fila ?? ''), cuando: new Date().toISOString() })
const yoPerfil = () => db.perfiles.find((p) => p.id === yo?.id)
/** Los permisos que Eduardo le dio (el admin todo). */
const tiene = (k) => admin() || (yoPerfil()?.permisos ?? []).includes(k)
const puede = (que) => admin() || !!yoPerfil()?.[`pros_${que}`]
const veLead = (l) => !!l && (admin() || yoPerfil()?.pros_ver === 'todos' || (yoPerfil()?.pros_ver === 'suyos' && l.asignado === yo?.id))
const veProspecto = (p) => !!p && (admin() || yoPerfil()?.pros_ver === 'todos' || (yoPerfil()?.pros_ver === 'suyos' && [p.asignado, p.traido_por].includes(yo?.id)))
const espera = (x) => new Promise((r) => setTimeout(() => r(copia(x)), 60))

function upsert(lista, fila, llave = 'id') {
  const i = fila[llave] ? lista.findIndex((x) => x[llave] === fila[llave]) : -1
  if (i >= 0) {
    lista[i] = { ...lista[i], ...fila }
    return lista[i]
  }
  const nueva = { [llave]: fila[llave] ?? id(), ...fila }
  lista.push(nueva)
  return nueva
}

export function crearMuestra() {
  return {
    muestra: true,
    usuariosMuestra: () => db.perfiles.map((p) => ({ id: p.id, nombre: p.nombre, cargo: p.cargo })),

    sesion: () => espera(yo),
    async entrarComo(pid) {
      yo = db.perfiles.find((p) => p.id === pid) ?? null
      return copia(yo)
    },
    async entrar() {
      throw new Error('En la muestra entra con uno de los botones de abajo')
    },
    async salir() {
      yo = null
    },
    async olvide() {},
    async nuevaClave() {},
    async miClave(clave) {
      if (!clave) throw new Error('Escribe la contraseña')
      if (yo) yo.cambiar_clave = false
      return true
    },
    alCambiarSesion() {},

    personas: () => espera(db.perfiles),
    async guardarPersona(p) {
      if (!admin()) nunca()
      if (p.codigo && db.perfiles.some((x) => x.codigo === p.codigo && x.id !== p.id)) throw new Error('Ese código de link ya lo tiene otra persona')
      anotar('update', 'perfiles', p.id)
      return copia(upsert(db.perfiles, p))
    },
    async crearPersona(p) {
      if (!tiene('personas_gestionar')) nunca()
      const usuario = String(p.usuario || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '')
      if (usuario.length < 2) throw new Error('Falta el usuario')
      if (!p.clave) throw new Error('Falta la contraseña')
      if (db.perfiles.some((x) => x.usuario === usuario)) throw new Error(`Ya hay alguien con el usuario "${usuario}"`)
      const nueva = { id: id(), permisos: [], acceso_hasta: null, usuario, cambiar_clave: true, nombre: p.nombre, correo: p.correo, rol: 'equipo', activo: true, cargo: p.cargo || '', sede: p.sede === 'mexico' ? 'mexico' : 'usa', foto: null, reporta_a: p.reporta_a || null, creado: new Date().toISOString(), ...permisos(null) }
      db.perfiles.push(nueva)
      anotar('insert', 'perfiles', nueva.id)
      return { ok: true, id: nueva.id, usuario, enviado: !!(p.enviar && p.correo) }
    },
    probarCorreo: async () => ({ ok: true, enviado: true, para: 'eduardo@nxusai.org', clave: 'ab12…yz89 (64 caracteres)', agenda: '…muestra1' }),
    async claveDe(pid, clave, enviar) {
      if (!tiene('personas_gestionar') || db.perfiles.find((q) => q.id === pid)?.rol === 'admin') nunca()
      const x = db.perfiles.find((q) => q.id === pid)
      if (x) x.cambiar_clave = true
      return { ok: true, usuario: x?.usuario, enviado: !!(enviar && x?.correo) }
    },
    async subirFoto(pid, file) {
      if (!admin()) nunca()
      const url = await new Promise((r) => {
        const fr = new FileReader()
        fr.onload = () => r(fr.result)
        fr.readAsDataURL(file)
      })
      return copia(upsert(db.perfiles, { id: pid, foto: url }))
    },
    fotoUrl: async (ruta) => ruta || '',

    clientes: () => espera(db.clientes),
    async guardarCliente(c) {
      if (!tiene('clientes_editar')) nunca()
      anotar(c.id ? 'update' : 'insert', 'clientes', c.id)
      return copia(upsert(db.clientes, { ...c, actualizado: new Date().toISOString(), ...(c.id ? {} : { creado: new Date().toISOString() }) }))
    },
    async borrarCliente(cid) {
      if (!tiene('clientes_borrar')) nunca()
      db.clientes = db.clientes.filter((c) => c.id !== cid)
      db.clientes_dinero = db.clientes_dinero.filter((d) => d.cliente_id !== cid)
    },
    dinero: () => espera(tiene('clientes_dinero') || tiene('finanzas_ver') ? db.clientes_dinero : []),
    async guardarDinero(d) {
      if (!tiene('finanzas_editar')) nunca()
      return copia(upsert(db.clientes_dinero, d, 'cliente_id'))
    },

    tareas: () => espera(db.tareas.filter((t) => tiene('tareas_todas') || t.asignado === yo?.id || t.creada_por === yo?.id)),
    async guardarTarea(t) {
      const vieja = t.id && db.tareas.find((x) => x.id === t.id)
      if (vieja && !tiene('tareas_todas') && vieja.asignado !== yo.id && vieja.creada_por !== yo.id) nunca()
      if (vieja && !tiene('tareas_todas') && vieja.creada_por !== yo.id) {
        const soloEstado = Object.keys(t).every((k) => k === 'id' || k === 'estado' || t[k] === vieja[k])
        if (!soloEstado) throw new Error('Solo quien creó la tarea (o el admin) cambia eso; tú mueves su estado')
      }
      anotar(vieja ? 'update' : 'insert', 'tareas', t.id)
      return copia(upsert(db.tareas, { ...t, actualizada: new Date().toISOString(), ...(vieja ? {} : { creada: new Date().toISOString(), creada_por: yo.id }) }))
    },
    async borrarTarea(tid) {
      if (!admin()) nunca()
      db.tareas = db.tareas.filter((t) => t.id !== tid)
    },

    jornadas: (desde, hasta) =>
      espera(db.jornadas.filter((j) => (tiene('asistencia_ver') || j.persona === yo?.id) && new Date(j.entrada) >= desde && new Date(j.entrada) < hasta).sort((a, b) => b.entrada.localeCompare(a.entrada))),
    abiertas: () => espera(db.jornadas.filter((j) => !j.salida && (tiene('asistencia_ver') || j.persona === yo?.id))),
    async marcarEntrada() {
      if (db.jornadas.some((j) => j.persona === yo.id && !j.salida)) throw new Error('Ya tienes una entrada abierta')
      const j = { id: id(), persona: yo.id, entrada: new Date().toISOString(), salida: null, dia_completo: false, nota: '' }
      db.jornadas.push(j)
      anotar('insert', 'jornadas', j.id)
      return copia(j)
    },
    async marcarSalida(jid) {
      const j = db.jornadas.find((x) => x.id === jid && (admin() || x.persona === yo.id) && !x.salida)
      if (!j) throw new Error('Esa jornada ya está cerrada')
      j.salida = new Date().toISOString()
      anotar('update', 'jornadas', j.id)
      return copia(j)
    },
    async corregirJornada(jid, c) {
      if (!tiene('asistencia_corregir')) nunca()
      const j = db.jornadas.find((x) => x.id === jid)
      Object.assign(j, { entrada: c.entrada, salida: c.salida, nota: c.nota })
      anotar('update', 'jornadas', j.id)
      return copia(j)
    },
    async registrarJornada(c) {
      if (!tiene('asistencia_corregir')) nunca()
      if (!c.salida && db.jornadas.some((j) => j.persona === c.persona && !j.salida)) throw new Error('Esa persona ya tiene una entrada abierta')
      const j = { id: id(), persona: c.persona, entrada: c.entrada, salida: c.salida, dia_completo: false, nota: c.nota }
      db.jornadas.push(j)
      anotar('insert', 'jornadas', j.id)
      return copia(j)
    },
    async diaCompleto(jid, si) {
      if (!tiene('asistencia_corregir')) nunca()
      return copia(upsert(db.jornadas, { id: jid, dia_completo: si }))
    },

    nomina: () => espera(tiene('nomina_ver') ? db.nomina : []),
    async guardarNomina(n) {
      if (!tiene('nomina_editar')) nunca()
      return copia(upsert(db.nomina, n, 'persona'))
    },
    ajustes: () => espera(tiene('nomina_ver') ? db.nomina_ajustes : []),
    async guardarAjuste(a) {
      if (!tiene('nomina_editar')) nunca()
      return copia(upsert(db.nomina_ajustes, a))
    },
    async borrarAjuste(aid) {
      if (!tiene('nomina_editar')) nunca()
      db.nomina_ajustes = db.nomina_ajustes.filter((a) => a.id !== aid)
    },
    comisiones: () => espera(tiene('nomina_ver') ? db.comisiones : []),
    async guardarComision(c) {
      if (!tiene('nomina_editar')) nunca()
      return copia(upsert(db.comisiones, c))
    },
    async borrarComision(cid) {
      if (!tiene('nomina_editar')) nunca()
      db.comisiones = db.comisiones.filter((c) => c.id !== cid)
    },

    // Leads: las mismas reglas que la base de datos (supabase/esquema.sql).
    leads: () => espera(db.leads.filter(veLead).map(({ transcripcion, ...l }) => l).sort((a, b) => b.creado.localeCompare(a.creado))),
    lead: (lid) => espera(db.leads.find((l) => l.id === lid && veLead(l)) ?? null),
    // Números de Meta de muestra (en la versión real los trae la función "anuncios").
    metaAnuncios: () => {
      const f = (anuncio, campana, gasto, impresiones, conversaciones, vistas3s, thruplays, frecuencia) => ({ anuncio, campana, gasto, impresiones, alcance: Math.round(impresiones / frecuencia), frecuencia, cpm: (gasto / impresiones) * 1000, clics: Math.round(conversaciones * 1.6), conversaciones, vistas3s, thruplays, dia: '' })
      const total = [
        f('MX | A | 11:48', 'NXUS | MX | Mensajes | Diagnóstico v2', 61.2, 9800, 21, 2750, 610, 1.9),
        f('MX | B | Empleado', 'NXUS | MX | Mensajes | Diagnóstico v2', 48.5, 8100, 12, 1620, 300, 1.8),
        f('MX | C | Sucursales', 'NXUS | MX | Mensajes | Diagnóstico v2', 30.3, 5200, 9, 1350, 340, 1.7),
        f('NY | A | 11:48', 'NXUS | NY | Mensajes | Diagnóstico', 52.0, 3900, 7, 900, 160, 1.6),
        f('NY | B | Empleado', 'NXUS | NY | Mensajes | Diagnóstico', 39.4, 3100, 6, 700, 150, 1.5),
        f('NY | C | Sucursales', 'NXUS | NY | Mensajes | Diagnóstico', 28.6, 2400, 3, 410, 70, 1.4),
        f('MX | D | Promo octubre', 'NXUS | MX | Mensajes | Diagnóstico', 120.5, 68000, 27, 9100, 1200, 2.6),
      ]
      const dias = [...Array(30)].flatMap((_, i) => {
        const d = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10)
        return i < 23 ? [] : [{ ...f('', 'NXUS | MX | Mensajes | Diagnóstico v2', 18 + (i % 3) * 3, 3000, 5, 0, 0, 1), dia: d }, { ...f('', 'NXUS | NY | Mensajes | Diagnóstico', 15 + (i % 2) * 4, 1200, 2, 0, 0, 1), dia: d }]
      })
      const creado = new Date(Date.now() - 9 * 864e5).toISOString()
      return espera({ ok: true, conectado: true, moneda: 'USD', total, semana: total.map((x) => ({ ...x, gasto: x.gasto * 0.7, impresiones: Math.round(x.impresiones * 0.7), conversaciones: Math.round(x.conversaciones * 0.7), vistas3s: Math.round(x.vistas3s * 0.7), thruplays: Math.round(x.thruplays * 0.7) })), dias, estados: total.map((x) => (x.anuncio.startsWith('MX | D') ? { anuncio: x.anuncio, campana: x.campana, estado: 'PAUSED', creado: '2026-10-12T15:00:00Z', actualizado: '2026-10-28T15:00:00Z' } : { anuncio: x.anuncio, campana: x.campana, estado: 'ACTIVE', creado })), al: new Date().toISOString() })
    },
    async guardarLead(l) {
      const viejo = l.id && db.leads.find((x) => x.id === l.id && veLead(x))
      if (l.id && !viejo) nunca()
      if (!puede('trabajar')) nunca()
      const ahora = new Date().toISOString()
      if (!viejo) {
        const nuevo = lead({ ...l, id: id(), manychat_id: null, origen: 'manual', canal: '', fuente: '', creado: ahora, actualizado: ahora })
        anotar('insert', 'leads', nuevo.id)
        return copia(nuevo)
      }
      if (viejo.estado === 'no_llamar' && l.estado && l.estado !== 'no_llamar' && !admin()) throw new Error('Pidió no ser llamado: solo Eduardo lo puede cambiar')
      if (viejo.permiso_llamada) for (const k of ['permiso_llamada', 'permiso_fecha', 'permiso_texto']) delete l[k]
      else if (l.permiso_llamada) l.permiso_fecha = ahora
      if (!admin()) delete l.asignado
      const estado = l.estado ?? viejo.estado
      if (estado !== 'cartera') l.motivo = ''
      anotar('update', 'leads', l.id)
      return copia(upsert(db.leads, { ...l, actualizado: ahora }))
    },
    async borrarLead(lid) {
      if (!admin()) nunca()
      db.leads = db.leads.filter((l) => l.id !== lid)
      db.leads_notas = db.leads_notas.filter((n) => n.lead_id !== lid)
    },
    notasLead: (lid) => espera(db.leads_notas.filter((n) => n.lead_id === lid && veLead(db.leads.find((l) => l.id === lid)))),
    async agregarNotaLead(lid, texto) {
      const l = db.leads.find((x) => x.id === lid)
      if (!l || !veLead(l) || !puede('trabajar')) nunca()
      const n = { id: id(), lead_id: lid, autor: yo.id, texto, creada: new Date().toISOString() }
      db.leads_notas.push(n)
      anotar('insert', 'leads_notas', n.id)
      return copia(n)
    },
    async traducirLead(lid) {
      const l = db.leads.find((x) => x.id === lid)
      return l?.traduccion?.es ? copia(l.traduccion) : null
    },
    async llamarLead(lid) {
      const l = db.leads.find((x) => x.id === lid)
      if (!l || !veLead(l) || !puede('trabajar')) nunca()
      if (l.estado === 'no_llamar') throw new Error('Pidió no ser llamado')
      if (!l.permiso_llamada) throw new Error('No dio permiso de que una IA le llame')
      if (!/^\+(52|1)\d{10}$/.test(l.telefono)) {
        l.llamada_error = `No sé de qué país es el número "${l.telefono}". Corrígelo con "Editar datos" y dale "Llamar ahora".`
        throw new Error(l.llamada_error)
      }
      Object.assign(l, { estado: 'llamando', motivo: '', llamada_error: '', intentos: (l.intentos ?? 0) + 1, llamada_inicio: new Date().toISOString(), llamada_seg: null, llamada_id: 'conv_muestra' })
      return { ok: true }
    },
    /** En la muestra la llamada avanza sola: marcando → en llamada → termina en la Cartera. */
    async estadoLlamada(lid) {
      const l = db.leads.find((x) => x.id === lid)
      if (!l) nunca()
      if (l.estado !== 'llamando') return { ok: true, estado: l.estado, terminado: true }
      const seg = Math.round((Date.now() - new Date(l.llamada_inicio)) / 1000)
      if (seg < 4) return { ok: true, estado: 'llamando', llamada: 'initiated', texto: 'Marcando…' }
      if (seg < 12) return { ok: true, estado: 'llamando', llamada: 'in-progress', seg: seg - 4, texto: 'En llamada' }
      Object.assign(l, { estado: 'cartera', motivo: 'ahora_no', llamada_seg: seg - 4, resumen: 'Muestra: le interesa pero pidió que le llamen el próximo mes.' })
      return { ok: true, estado: 'cartera', terminado: true }
    },
    async leadAProspecto(lid, cita = null, meet = '') {
      const l = db.leads.find((x) => x.id === lid)
      if (!l || !veLead(l)) throw new Error('Ese lead no existe')
      if (!puede('trabajar')) throw new Error('No tienes permiso para trabajar leads')
      if (l.prospecto_id) return l.prospecto_id
      const p = prospecto({
        origen: 'anuncio', portal_id: null, nombre: l.nombre, empresa: l.empresa, direccion: l.direccion, whatsapp: l.telefono, correo: l.correo,
        lineas: l.servicio ? [`Pidió en el chat: ${l.servicio}`.slice(0, 80)] : [],
        diagnostico: Object.fromEntries(Object.entries({ pais: { mexico: 'México', usa: 'USA' }[l.pais], ciudad: l.ciudad, idioma: l.idioma === 'en' ? 'Inglés' : 'Español', quiere: l.resumen }).filter(([, v]) => v)),
        etapa: cita ? 'cita' : 'datos', cita, meet, asignado: l.asignado ?? ED, creado: new Date().toISOString(), actualizado: new Date().toISOString(),
      })
      Object.assign(l, { estado: 'agendado', motivo: '', prospecto_id: p.id, actualizado: new Date().toISOString() })
      anotar('insert', 'prospectos', p.id)
      return p.id
    },

    // Documentos en PDF: las mismas reglas que la base de datos.
    documentos: ({ prospecto_id, cliente_id }) =>
      espera(
        db.documentos.filter((d) =>
          prospecto_id ? d.prospecto_id === prospecto_id && veProspecto(db.prospectos.find((p) => p.id === prospecto_id)) : d.cliente_id === cliente_id && admin(),
        ),
      ),
    async subirDocumento({ tipo, prospecto_id, cliente_id }, file) {
      if (tipo === 'contrato' ? !admin() : !puede('trabajar')) nunca()
      const d = { id: id(), tipo, prospecto_id: prospecto_id ?? null, cliente_id: cliente_id ?? null, nombre: file.name, ruta: URL.createObjectURL(file), tamano: file.size, subido_por: yo.id, creado: new Date().toISOString() }
      db.documentos.unshift(d)
      return copia(d)
    },
    abrirDocumento: async (d) => d.ruta,
    async borrarDocumento(d) {
      if (!admin()) nunca()
      db.documentos = db.documentos.filter((x) => x.id !== d.id)
      return true
    },

    // Mis pendientes, metas y hábitos: vacíos para empezar (solo el admin).
    pendientes: () => espera(admin() ? db.pendientes : nunca()),
    async guardarPendiente(p) {
      if (!admin()) nunca()
      return copia(upsert(db.pendientes, p.id ? p : { estado: 'pendiente', estrella: false, origen: 'hq', notas: '', empresa: '', prioridad: 'normal', area: 'negocios', fecha: null, hora: null, meta_id: null, creado: new Date().toISOString(), ...p }))
    },
    async borrarPendiente(pid) {
      if (!admin()) nunca()
      db.pendientes = db.pendientes.filter((x) => x.id !== pid)
      return true
    },
    async entenderPendientes(texto) {
      if (!admin()) nunca()
      // En la muestra no hay IA: cada línea o "; " es un pendiente para hoy.
      const hoy = new Date().toLocaleDateString('en-CA')
      const items = String(texto).split(/;|\n/).map((t) => t.trim()).filter(Boolean).map((t) => ({ id: id(), titulo: t[0].toUpperCase() + t.slice(1), notas: '', area: /mam|pap|famil|hij/i.test(t) ? 'familia' : /gym|ejercicio|doctor|dentista/i.test(t) ? 'salud' : 'negocios', empresa: '', fecha: hoy, hora: null, prioridad: /urgente/i.test(t) ? 'alta' : 'normal', estrella: false, estado: 'pendiente', origen: 'hq', meta_id: null, creado: new Date().toISOString() }))
      db.pendientes.push(...items)
      return { ok: true, items: copia(items) }
    },
    metas: () => espera(admin() ? db.metas : nunca()),
    async guardarMeta(m) {
      if (!admin()) nunca()
      return copia(upsert(db.metas, m.id ? m : { estado: 'activa', progreso: 0, periodo: 'año', porque: '', creado: new Date().toISOString(), ...m }))
    },
    async borrarMeta(mid) {
      if (!admin()) nunca()
      db.metas = db.metas.filter((x) => x.id !== mid)
      return true
    },
    habitos: () => espera(admin() ? db.habitos : nunca()),
    async guardarHabito(x) {
      if (!admin()) nunca()
      return copia(upsert(db.habitos, x.id ? x : { activo: true, area: 'salud', creado: new Date().toISOString(), ...x }))
    },
    habitosDias: (desde) => espera(admin() ? db.habitos_dias.filter((x) => x.dia >= desde) : nunca()),
    async marcarHabito(habito_id, dia, hecho) {
      if (!admin()) nunca()
      db.habitos_dias = db.habitos_dias.filter((x) => !(x.habito_id === habito_id && x.dia === dia))
      if (hecho) db.habitos_dias.push({ habito_id, dia })
      return true
    },

    bitacora: () => espera(tiene('bitacora_ver') ? db.bitacora : []),

    // Finanzas: las mismas reglas que la base de datos (lo personal, solo el admin).
    cobros: () => espera(tiene('finanzas_ver') ? db.cobros : []),
    async guardarCobro(c) {
      if (!tiene('finanzas_editar')) nunca()
      anotar(c.id ? 'update' : 'insert', 'cobros', c.id)
      return copia(upsert(db.cobros, c.id ? c : { creado: new Date().toISOString(), creado_por: yo.id, ...c }))
    },
    async borrarCobro(cid) {
      if (!tiene('finanzas_editar')) nunca()
      db.cobros = db.cobros.filter((x) => x.id !== cid)
      return true
    },
    cobrosOmitidos: () => espera(tiene('finanzas_ver') ? db.cobros_omitidos : []),
    async omitirCobro(o) {
      if (!tiene('finanzas_editar')) nunca()
      db.cobros_omitidos = db.cobros_omitidos.filter((x) => !(x.cliente_id === o.cliente_id && x.fecha === o.fecha))
      db.cobros_omitidos.push(o)
      return copia(o)
    },
    gastos: () => espera(db.gastos.filter((g) => admin() || (g.tipo === 'negocio' && tiene('finanzas_ver')))),
    async guardarGasto(g) {
      if (!(admin() || (g.tipo === 'negocio' && tiene('finanzas_editar')))) nunca()
      anotar(g.id ? 'update' : 'insert', 'gastos', g.id)
      return copia(upsert(db.gastos, g.id ? g : { creado: new Date().toISOString(), ...g }))
    },
    async borrarGasto(gid) {
      const g = db.gastos.find((x) => x.id === gid)
      if (!g || !(admin() || (g.tipo === 'negocio' && tiene('finanzas_editar')))) nunca()
      db.gastos = db.gastos.filter((x) => x.id !== gid)
      return true
    },
    finanzasConfig: () => espera(tiene('finanzas_ver') ? db.finanzas_config[0] : null),
    async guardarFinanzasConfig(c) {
      if (!tiene('finanzas_editar')) nunca()
      Object.assign(db.finanzas_config[0], c)
      return copia(db.finanzas_config[0])
    },
    cuentas: () => espera(tiene('finanzas_ver') ? db.cuentas : []),
    async guardarCuenta(c) {
      if (!tiene('finanzas_editar')) nunca()
      if (c.principal) db.cuentas.forEach((x) => (x.principal = x.id === c.id))
      return copia(upsert(db.cuentas, c.id ? c : { activa: true, creado: new Date().toISOString(), ...c }))
    },
    async borrarCuenta(cid) {
      if (!admin()) nunca()
      db.cuentas = db.cuentas.filter((x) => x.id !== cid)
      db.traspasos = db.traspasos.filter((t) => t.de_cuenta !== cid && t.a_cuenta !== cid)
      return true
    },
    traspasos: () => espera(tiene('finanzas_ver') ? db.traspasos : []),
    async guardarTraspaso(t) {
      if (!tiene('finanzas_editar')) nunca()
      return copia(upsert(db.traspasos, t.id ? t : { creado: new Date().toISOString(), nota: '', ...t }))
    },
    async borrarTraspaso(tid) {
      if (!admin()) nunca()
      db.traspasos = db.traspasos.filter((x) => x.id !== tid)
      return true
    },
    // NEX en la muestra: sin IA, entiende "llévame a…" y "no encuentro…" para probar la pantalla.
    async nex(mensajes) {
      const t = String(mensajes.at(-1)?.content || '').toLowerCase()
      const destinos = [['entrada', 'finanzas/entradas'], ['personal', 'finanzas/personal'], ['finanza', 'finanzas'], ['gasto', 'finanzas'], ['ahorro', 'metas/ahorro'], ['meta', 'metas'], ['asistencia', 'nomina/asistencia'], ['nómina', 'nomina'], ['nomina', 'nomina'], ['cliente', 'clientes'], ['lead', 'leads'], ['prospecto', 'prospectos'], ['tarea', 'tareas'], ['reloj', 'reloj'], ['usuario', 'personas'], ['permiso', 'personas'], ['pendiente', 'pendientes'], ['equipo', 'equipo']]
      const d = destinos.find(([k]) => t.includes(k))
      const acciones = d ? [{ tipo: 'ir', ruta: d[1] }] : []
      if (/no encuentro|d[oó]nde/.test(t) && t.includes('gasto')) acciones.push({ tipo: 'senalar', objetivo: '+ Gasto' })
      if (/no encuentro|d[oó]nde/.test(t) && t.includes('permiso')) acciones.push({ tipo: 'senalar', objetivo: '🔑 Permisos' })
      if (/llam|llegó|llego/.test(t) && t.includes('pago')) acciones.push({ tipo: 'proponer', accion: 'apuntar_pendiente', datos: { texto: 'Revisar pago' }, resumen: 'Apuntar: revisar pago (muestra)' })
      await new Promise((r) => setTimeout(r, 400))
      return { ok: true, texto: d ? (acciones.some((a) => a.tipo === 'senalar') ? 'Aquí está, te lo marqué en dorado.' : 'Listo, ya estás ahí.') : 'En la muestra solo entiendo "llévame a…" y "no encuentro…". Con HQ de verdad te contesto todo.', acciones }
    },
    nexVoz: async () => null,
    nexMemoria: async () => [{ id: 'm1', texto: 'Los pagos de cada dos viernes que llegan del 4 al 14 pagan el corte del 15 al 31.', tema: 'finanzas', creado: new Date().toISOString() }],
    borrarMemoria: async () => true,
    nexOido: async () => '',
    movimientos: () => espera(admin() ? db.movimientos : []),
    async marcarMovimiento(m) {
      if (!admin()) nunca()
      db.movimientos = db.movimientos.filter((x) => !(x.mes === m.mes && x.tipo === m.tipo))
      db.movimientos.push(m)
      return copia(m)
    },
    async borrarMovimiento(mes, tipo) {
      if (!admin()) nunca()
      db.movimientos = db.movimientos.filter((x) => !(x.mes === mes && x.tipo === tipo))
      return true
    },
    async quitarOmitido(cliente_id, fecha) {
      if (!tiene('finanzas_editar')) nunca()
      db.cobros_omitidos = db.cobros_omitidos.filter((x) => !(x.cliente_id === cliente_id && x.fecha === fecha))
      return true
    },
    gastosEstado: () => espera(db.gastos_estado.filter((e) => { const g = db.gastos.find((x) => x.id === e.gasto_id); return g && (admin() || (g.tipo === 'negocio' && tiene('finanzas_ver'))) })),
    async marcarGasto(gasto_id, mes, estado) {
      if (!tiene('finanzas_editar')) nunca()
      db.gastos_estado = db.gastos_estado.filter((e) => !(e.gasto_id === gasto_id && e.mes === mes))
      db.gastos_estado.push({ gasto_id, mes, estado })
      return true
    },
    envios: () => espera(tiene('finanzas_ver') ? db.envios : []),
    async guardarEnvio(e) {
      if (!tiene('finanzas_editar')) nunca()
      return copia(upsert(db.envios, { creado: new Date().toISOString(), nota: '', ...e }))
    },
    async borrarEnvio(eid) {
      if (!admin()) nunca()
      db.envios = db.envios.filter((x) => x.id !== eid)
      return true
    },
    aportes: () => espera(admin() ? db.metas_aportes : nunca()),
    async guardarAporte(a) {
      if (!admin()) nunca()
      return copia(upsert(db.metas_aportes, a.id ? a : { creado: new Date().toISOString(), ...a }))
    },
    async borrarAporte(aid) {
      if (!admin()) nunca()
      db.metas_aportes = db.metas_aportes.filter((x) => x.id !== aid)
      return true
    },

    // Prospectos: las mismas reglas que la base de datos (supabase/esquema.sql).
    prospectos: () => espera(db.prospectos.filter(veProspecto).sort((a, b) => b.actualizado.localeCompare(a.actualizado))),
    async guardarProspecto(p) {
      const viejo = p.id && db.prospectos.find((x) => x.id === p.id && veProspecto(x))
      if (p.id && !viejo) nunca()
      if (!viejo) {
        if (!puede('trabajar')) nunca()
        const nuevo = { id: id(), portal_id: null, origen: 'manual', link: '', nombre: '', empresa: '', direccion: '', whatsapp: '', correo: '', lineas: [], diagnostico: {}, camino: '', acepta_novedades: false, etapa: 'datos', cita: null, meet: '', siguiente: '', siguiente_fecha: null, motivo_perdido: '', cliente_id: null, ...p, creado: new Date().toISOString(), actualizado: new Date().toISOString() }
        if (!admin()) Object.assign(nuevo, { traido_por: yo.id, asignado: yo.id })
        nuevo.asignado ??= nuevo.traido_por
        if (['cliente', 'perdido'].includes(nuevo.etapa)) nuevo.etapa = 'datos'
        db.prospectos.push(nuevo)
        anotar('insert', 'prospectos', nuevo.id)
        return copia(nuevo)
      }
      if (!admin()) {
        if (!puede('trabajar') && !puede('etapas')) nunca()
        if (('asignado' in p && p.asignado !== viejo.asignado) || ('traido_por' in p && p.traido_por !== viejo.traido_por)) throw new Error('Solo Eduardo asigna prospectos')
        if ('etapa' in p && p.etapa !== viejo.etapa) {
          if (p.etapa === 'cliente' || viejo.etapa === 'cliente') throw new Error('Para hacerlo cliente usa "Convertir en cliente"')
          if (!puede('etapas')) throw new Error('No tienes permiso para mover la etapa')
        }
        const trabajo = ['nombre', 'empresa', 'direccion', 'whatsapp', 'correo', 'siguiente', 'siguiente_fecha', 'motivo_perdido'].some((k) => k in p && p[k] !== viejo[k])
        if (trabajo && !puede('trabajar')) throw new Error('No tienes permiso para trabajar este prospecto')
        for (const k of ['link', 'lineas', 'diagnostico', 'camino', 'acepta_novedades', 'cita', 'meet', 'cliente_id']) delete p[k]
      }
      anotar('update', 'prospectos', p.id)
      return copia(upsert(db.prospectos, { ...p, actualizado: new Date().toISOString() }))
    },
    async borrarProspecto(pid) {
      if (!admin()) nunca()
      db.prospectos = db.prospectos.filter((p) => p.id !== pid)
      db.prospectos_notas = db.prospectos_notas.filter((n) => n.prospecto_id !== pid)
      db.prospectos_pagos = db.prospectos_pagos.filter((n) => n.prospecto_id !== pid)
    },
    notasProspecto: (pid) => espera(db.prospectos_notas.filter((n) => n.prospecto_id === pid && veProspecto(db.prospectos.find((p) => p.id === pid)))),
    async agregarNota(pid, texto) {
      const p = db.prospectos.find((x) => x.id === pid)
      if (!p || !veProspecto(p) || !puede('trabajar')) nunca()
      const n = { id: id(), prospecto_id: pid, autor: yo.id, texto, creada: new Date().toISOString() }
      db.prospectos_notas.push(n)
      anotar('insert', 'prospectos_notas', n.id)
      return copia(n)
    },
    pagosProspectos: () => espera(db.prospectos_pagos.filter(() => tiene('finanzas_ver'))),
    async convertirProspecto(pid) {
      const p = db.prospectos.find((x) => x.id === pid)
      if (!p || !veProspecto(p)) throw new Error('Ese prospecto no existe')
      if (!puede('convertir')) throw new Error('No tienes permiso para convertir prospectos en clientes')
      if (p.cliente_id) return p.cliente_id
      const d = p.diagnostico || {}
      const c = cliente(
        {
          nombre: p.empresa || p.nombre || 'Cliente nuevo',
          equipo: d.pais === 'USA' ? 'usa' : 'mexico',
          servicios: p.lineas,
          descripcion: [p.origen === 'portal' ? 'Llegó por el portal.' : '', [d.giro, d.tamano && `${d.tamano} personas`, d.pais].filter(Boolean).join(' · '), d.quiere ? `Quiere: ${d.quiere}` : '', p.direccion ? `Dirección: ${p.direccion}` : ''].filter(Boolean).join('\n'),
          contacto_nombre: p.nombre,
          contacto_correo: p.correo,
          contacto_tel: p.whatsapp,
          inicio: fecha(0),
          responsable: p.asignado,
          traido_por: p.traido_por,
          creado: new Date().toISOString(),
        },
        {},
      )
      Object.assign(p, { etapa: 'cliente', cliente_id: c.id, actualizado: new Date().toISOString() })
      anotar('insert', 'clientes', c.id)
      return c.id
    },

    // La IA real (netlify/functions/ordenar.mjs) entiende cualquier texto; la
    // muestra solo saca lo básico para enseñar cómo se ve.
    async ordenar(texto) {
      if (!admin()) nunca()
      await new Promise((r) => setTimeout(r, 700))
      const monto = Number((texto.match(/\$?\s?([\d,]+(?:\.\d+)?)\s*(?:usd|dlls|d[oó]lares|mxn|pesos)?\s*(?:al mes|mensual|\/mes)/i)?.[1] || '0').replace(/,/g, ''))
      const palabra = "\\p{Lu}[\\p{L}\\d&'.-]*"
      const nombre = (texto.match(new RegExp(`(?:cliente|empresa|negocio|restaurante|tienda)\\s+(?:se llama\\s+)?(${palabra}(?:\\s+${palabra}){0,3})`, 'u')) || texto.match(new RegExp(`^(${palabra}(?:\\s+${palabra}){0,3})`, 'u')))?.[1] || 'Cliente nuevo'
      const servicios = [
        [/p[aá]gina|sitio|web/i, 'Sitio web'],
        [/anuncio|ads|meta|facebook/i, 'Anuncios en Meta'],
        [/redes|contenido|instagram|tiktok|post/i, 'Redes y contenido'],
        [/crm|sistema|software/i, 'Sistema a la medida'],
        [/llamada|agente|ia\b|recepcionista/i, 'Agente de IA'],
      ].filter(([re]) => re.test(texto)).map(([, s]) => s)
      return {
        nombre,
        grupo: '',
        estado: /prospecto|todav[ií]a no|propuesta/i.test(texto) ? 'prospecto' : 'activo',
        equipo: /m[eé]xico/i.test(texto) ? 'mexico' : 'usa',
        servicios: servicios.length ? servicios : ['Por definir'],
        descripcion: texto.slice(0, 280),
        contacto_nombre: '',
        contacto_correo: texto.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i)?.[0] ?? '',
        contacto_tel: '',
        inicio: '',
        mensualidad: monto,
        pago_unico: 0,
        moneda: /mxn|pesos/i.test(texto) ? 'MXN' : 'USD',
        dia_cobro: 0,
        tareas: servicios.map((s) => ({ titulo: `Arrancar: ${s}`, detalle: '' })).slice(0, 4),
        dudas: ['(Muestra) La IA real llena esto mucho mejor.'],
      }
    },
  }
}
