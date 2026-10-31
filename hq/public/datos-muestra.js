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
const abuelito = cliente(
  { nombre: 'Abuelito INC', grupo: 'Abuelito INC', servicios: ['Centro de trabajo (CRM) con Ultron', 'Anuncios en Meta', 'Contenido'], descripcion: 'Holding de Abuelito Cheese, Abuelito Meat y Abuelito Corn. Usa el Centro de trabajo con Ultron para su dirección.', sistema_nombre: 'Centro de trabajo', sistema_url: 'https://centro-misemago-abuelito.netlify.app' },
  {},
)
const semago = cliente(
  { nombre: 'Mi Semago', servicios: ['Centro de trabajo (CRM) con Ultron', 'Ana Sofi: ventas por teléfono', 'Etiquetas de trazabilidad', 'Anuncios en Meta'], descripcion: 'Comparte el Centro de trabajo con Abuelito INC. Ana Sofi llama a sus prospectos e imprime sus etiquetas.', sistema_nombre: 'Centro de trabajo', sistema_url: 'https://centro-misemago-abuelito.netlify.app' },
  {},
)
cliente({ nombre: 'VAYRO', grupo: 'Keko Foods', estado: 'prospecto', servicios: ['Administración por Ramos & Co.', 'IA Vivian (en preparación)'], descripcion: 'De los mismos dueños de Abuelito, empresa independiente. Primero la administra Ramos & Co.' }, {})

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
  const x = { id: id(), manychat_id: id(), origen: 'manychat', canal: 'instagram', fuente: 'Comentó INFO', anuncio_id: '', nombre: '', empresa: '', direccion: '', telefono: '', correo: '', ciudad: '', pais: '', idioma: 'es', servicio: '', permiso_llamada: true, permiso_fecha: null, permiso_texto: 'Sí, acepto que un asistente de IA de NXUS AI me llame a este número.', estado: 'nuevo', motivo: '', llamada_id: '', llamada_inicio: null, llamada_seg: null, grabacion: '', resumen: '', puntos: {}, transcripcion: '', prospecto_id: null, asignado: null, creado: dia(0, 9), actualizado: dia(0, 9), ...l }
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
  nombre: 'Carlos Medina', empresa: 'Medina Logistics', direccion: '410 N Broad St, Elizabeth, NJ', telefono: '+1 908 555 0147', correo: 'carlos@medinalogistics.com', ciudad: 'Elizabeth, NJ', pais: 'usa', canal: 'facebook', fuente: 'Anuncio · "Tu negocio contesta solo"', anuncio_id: '120210000000001',
  servicio: 'Automatización de despacho', estado: 'agendado', prospecto_id: carlos.id, creado: dia(0, 8, 47), actualizado: dia(0, 9, 2),
  llamada_id: 'conv_muestra_1', llamada_inicio: dia(0, 8, 49), llamada_seg: 412, grabacion: 'https://elevenlabs.io',
  resumen: 'Empresa de transporte con 14 camiones en NJ. Coordina viajes por WhatsApp y Excel, pierde viajes por no contestar a tiempo. Le interesa que los clientes coticen y agenden solos. Agendó meeting mañana a las 11:00.',
  puntos: { empresa: 'Transporte de carga, 14 camiones, 22 empleados', necesidad: 'Que las cotizaciones y la agenda de viajes se hagan solas', usa_hoy: 'WhatsApp, Excel y llamadas', decide: 'Sí, es el dueño', urgencia: 'Alta: está perdiendo viajes cada semana', presupuesto: 'No dio cifra; dijo que lo que se pierde al mes es más que una solución', consejo: 'Un asistente que conteste WhatsApp y cotice con sus tarifas, conectado a su agenda' },
  transcripcion: 'NEX: Hola Carlos, soy NEX, el asistente de inteligencia artificial de NXUS AI. Te llamo porque dejaste tus datos hace un momento en nuestro chat. Esta llamada se graba para darte un mejor servicio. ¿Tienes unos minutos?\nCarlos: Sí, claro.\nNEX: Perfecto. Cuéntame de tu empresa…',
})
db.leads_notas.push({ id: id(), lead_id: db.leads.at(-1).id, autor: ED, texto: 'Llevar ejemplo de cotizador por WhatsApp.', creada: dia(0, 9, 30) })
lead({ nombre: 'Jessica Brown', empresa: 'Bright Smile Dental', telefono: '+1 201 555 0133', correo: 'jessica@brightsmile.com', ciudad: 'Jersey City, NJ', pais: 'usa', idioma: 'en', servicio: 'AI receptionist / appointment booking', canal: 'instagram', fuente: 'Commented INFO', creado: dia(0, 9, 41), actualizado: dia(0, 9, 41), estado: 'llamando', llamada_inicio: dia(0, 9, 42) })
lead({ nombre: 'Rosa Elena Vázquez', empresa: 'Panadería La Espiga', direccion: 'Calle Morelos 55, Puebla', telefono: '+52 222 555 0190', correo: 'rosa@laespiga.mx', ciudad: 'Puebla', pais: 'mexico', servicio: 'Pedidos por WhatsApp', canal: 'facebook', fuente: 'Anuncio · "Pedidos que llegan solos"', creado: dia(0, 10, 5), actualizado: dia(0, 10, 5) })
lead({ nombre: 'Tom Kowalski', empresa: 'TK Roofing', telefono: '+1 732 555 0111', ciudad: 'Edison, NJ', pais: 'usa', idioma: 'en', servicio: 'Lead follow-up', canal: 'instagram', fuente: 'Commented INFO', permiso_llamada: false, estado: 'cartera', motivo: 'sin_permiso', creado: dia(0, 7, 30), actualizado: dia(0, 7, 31) })
lead({ nombre: 'Miguel Ángel Soto', empresa: 'Autolavado Soto', telefono: '+52 81 5555 0177', correo: 'miguel@autolavadosoto.mx', ciudad: 'Monterrey', pais: 'mexico', servicio: 'Página web y redes', canal: 'instagram', estado: 'cartera', motivo: 'no_contesto', creado: dia(-1, 17, 12), actualizado: dia(-1, 17, 15), llamada_inicio: dia(-1, 17, 13), llamada_seg: 0, resumen: 'No contestó. Se dejó mensaje en el buzón.' })
lead({ nombre: 'Laura Peña', empresa: 'Inmobiliaria Peña', telefono: '+52 55 5555 0122', correo: 'laura@inmopena.mx', ciudad: 'CDMX', pais: 'mexico', servicio: 'Chatbot para clientes', canal: 'facebook', fuente: 'Anuncio · "Tu negocio contesta solo"', estado: 'cartera', motivo: 'ahora_no', creado: dia(-2, 12), actualizado: dia(-2, 12, 20), llamada_inicio: dia(-2, 12, 2), llamada_seg: 148, resumen: 'Le interesa, pero está cerrando el trimestre. Pidió que la busquen en diciembre.', puntos: { necesidad: 'Contestar a los interesados en propiedades fuera de horario', decide: 'Sí, con su socio', urgencia: 'Baja: después de diciembre' } })
lead({ nombre: 'Kevin Ortiz', empresa: 'Ortiz Cleaning', telefono: '+1 973 555 0166', ciudad: 'Paterson, NJ', pais: 'usa', idioma: 'en', servicio: 'Social media', canal: 'instagram', estado: 'cartera', motivo: 'colgo', creado: dia(-2, 15), actualizado: dia(-2, 15, 3), llamada_inicio: dia(-2, 15, 1), llamada_seg: 21, resumen: 'Colgó después de la presentación.' })
lead({ nombre: 'Daniela Ríos', empresa: 'Estética Dany', telefono: '+52 33 5555 0155', ciudad: 'Guadalajara', pais: 'mexico', servicio: 'Agenda de citas', canal: 'instagram', estado: 'no_llamar', creado: dia(-3, 11), actualizado: dia(-3, 11, 6), llamada_inicio: dia(-3, 11, 2), llamada_seg: 35, resumen: 'Dijo que ya no le interesa y que no le vuelvan a llamar.' })
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
    alCambiarSesion() {},

    personas: () => espera(db.perfiles),
    async guardarPersona(p) {
      if (!admin()) nunca()
      if (p.codigo && db.perfiles.some((x) => x.codigo === p.codigo && x.id !== p.id)) throw new Error('Ese código de link ya lo tiene otra persona')
      anotar('update', 'perfiles', p.id)
      return copia(upsert(db.perfiles, p))
    },
    async crearPersona(p) {
      if (!admin()) nunca()
      const nueva = { id: id(), nombre: p.nombre, correo: p.correo, rol: 'equipo', activo: true, cargo: p.cargo || '', sede: p.sede === 'mexico' ? 'mexico' : 'usa', foto: null, reporta_a: p.reporta_a || null, creado: new Date().toISOString(), ...permisos(null) }
      db.perfiles.push(nueva)
      anotar('insert', 'perfiles', nueva.id)
      return { ok: true, id: nueva.id }
    },
    async claveDe() {
      if (!admin()) nunca()
      return { ok: true }
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
      if (!admin()) nunca()
      anotar(c.id ? 'update' : 'insert', 'clientes', c.id)
      return copia(upsert(db.clientes, { ...c, actualizado: new Date().toISOString(), ...(c.id ? {} : { creado: new Date().toISOString() }) }))
    },
    async borrarCliente(cid) {
      if (!admin()) nunca()
      db.clientes = db.clientes.filter((c) => c.id !== cid)
      db.clientes_dinero = db.clientes_dinero.filter((d) => d.cliente_id !== cid)
    },
    dinero: () => espera(admin() ? db.clientes_dinero : []),
    async guardarDinero(d) {
      if (!admin()) nunca()
      return copia(upsert(db.clientes_dinero, d, 'cliente_id'))
    },

    tareas: () => espera(db.tareas.filter((t) => admin() || t.asignado === yo?.id || t.creada_por === yo?.id)),
    async guardarTarea(t) {
      const vieja = t.id && db.tareas.find((x) => x.id === t.id)
      if (vieja && !admin() && vieja.asignado !== yo.id && vieja.creada_por !== yo.id) nunca()
      if (vieja && !admin() && vieja.creada_por !== yo.id) {
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
      espera(db.jornadas.filter((j) => (admin() || j.persona === yo?.id) && new Date(j.entrada) >= desde && new Date(j.entrada) < hasta).sort((a, b) => b.entrada.localeCompare(a.entrada))),
    abiertas: () => espera(db.jornadas.filter((j) => !j.salida && (admin() || j.persona === yo?.id))),
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
    async diaCompleto(jid, si) {
      if (!admin()) nunca()
      return copia(upsert(db.jornadas, { id: jid, dia_completo: si }))
    },

    nomina: () => espera(admin() ? db.nomina : []),
    async guardarNomina(n) {
      if (!admin()) nunca()
      return copia(upsert(db.nomina, n, 'persona'))
    },
    ajustes: () => espera(admin() ? db.nomina_ajustes : []),
    async guardarAjuste(a) {
      if (!admin()) nunca()
      return copia(upsert(db.nomina_ajustes, a))
    },
    async borrarAjuste(aid) {
      if (!admin()) nunca()
      db.nomina_ajustes = db.nomina_ajustes.filter((a) => a.id !== aid)
    },
    comisiones: () => espera(admin() ? db.comisiones : []),
    async guardarComision(c) {
      if (!admin()) nunca()
      return copia(upsert(db.comisiones, c))
    },
    async borrarComision(cid) {
      if (!admin()) nunca()
      db.comisiones = db.comisiones.filter((c) => c.id !== cid)
    },

    // Leads: las mismas reglas que la base de datos (supabase/esquema.sql).
    leads: () => espera(db.leads.filter(veLead).map(({ transcripcion, ...l }) => l).sort((a, b) => b.creado.localeCompare(a.creado))),
    lead: (lid) => espera(db.leads.find((l) => l.id === lid && veLead(l)) ?? null),
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

    bitacora: () => espera(admin() ? db.bitacora : []),

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
    pagosProspectos: () => espera(db.prospectos_pagos.filter((g) => admin() || (puede('pagos') && veProspecto(db.prospectos.find((p) => p.id === g.prospecto_id))))),
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
