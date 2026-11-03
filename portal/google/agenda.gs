// Agenda del portal de NXUS AI.
//
// Corre en la cuenta de Google de NXUS (la del calendario). El portal le pide
// los horarios libres y le pide agendar; este programa crea la cita en el
// calendario con su link de Meet, Google le manda la invitación al cliente, y
// le llega además un correo de confirmación. Cada 15 minutos manda los
// recordatorios de 24 horas y de 1 hora antes.
//
// Solo responde si viene la clave. Solo lee tus horarios ocupados (no el
// contenido de tus citas) y solo crea citas del portal.
//
// Instalación (una vez):
//   1. script.google.com con la cuenta de NXUS → Nuevo proyecto → pegar esto.
//   2. Servicios (+) → Google Calendar API → Agregar.
//   3. Correr "preparar": da la clave para el portal y activa los recordatorios.
//   4. Implementar → Aplicación web → Ejecutar como: Yo · Acceso: Cualquier persona.

// Tus horarios para citas (hora de Nueva York / New Jersey). Los usan el
// portal y NEX (las llamadas a los leads, desde NXUS HQ).
const ZONA = 'America/New_York'
const DIAS = [1, 2, 3, 4, 5, 6] // lunes a sábado
const DESDE = 9 // primera cita
const HASTA = 16 // la última termina a esta hora
const DURACION = 30 // minutos de cada cita
const ESPACIO = 0 // minutos libres entre citas
const DIAS_ADELANTE = 6 // cuántos días con citas se ofrecen
const AVISO_MINIMO = 2 // horas: no se ofrece nada antes de esto
const MARCA = 'Portal NXUS AI' // así se reconocen las citas del portal

function preparar() {
  const clave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '')
  PropertiesService.getScriptProperties().setProperty('CLAVE', clave)
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger('recordatorios').timeBased().everyMinutes(15).create()
  Logger.log('Clave para el portal (cópiala completa): ' + clave)
}

function respuesta_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents)
    const clave = PropertiesService.getScriptProperties().getProperty('CLAVE')
    if (!clave || d.clave !== clave) return respuesta_({ ok: false, error: 'clave incorrecta' })
    if (d.accion === 'horarios') return respuesta_({ ok: true, horarios: horarios_() })
    if (d.accion === 'agendar') return respuesta_(agendar_(d))
    if (d.accion === 'bienvenida') return respuesta_(bienvenida_(d))
    return respuesta_({ ok: false, error: 'acción desconocida' })
  } catch (err) {
    return respuesta_({ ok: false, error: String((err && err.message) || err) })
  }
}

/** Hora del día en Ciudad de México, para un instante. */
function partes_(fecha) {
  const f = Utilities.formatDate(fecha, ZONA, 'u H m').split(' ').map(Number)
  return { dia: f[0] % 7, hora: f[1], minuto: f[2] }
}

/** Un instante a partir de una fecha (yyyy-MM-dd) y una hora local. */
function instante_(ymd, h, m) {
  const base = new Date(ymd + 'T12:00:00Z')
  const off = Utilities.formatDate(base, ZONA, 'XXX') // p. ej. -06:00
  return new Date(ymd + 'T' + ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2) + ':00' + off)
}

/** Los horarios libres de los próximos días hábiles, como texto ISO. */
function horarios_() {
  const cal = CalendarApp.getDefaultCalendar()
  const ahora = new Date()
  const desde = new Date(ahora.getTime() + AVISO_MINIMO * 3600e3)
  const out = []
  let dias = 0
  for (let i = 0; dias < DIAS_ADELANTE && i < 30; i++) {
    const dia = new Date(ahora.getTime() + i * 864e5)
    const ymd = Utilities.formatDate(dia, ZONA, 'yyyy-MM-dd')
    if (DIAS.indexOf(partes_(instante_(ymd, 12, 0)).dia) < 0) continue
    dias++
    const inicioDia = instante_(ymd, DESDE, 0)
    const finDia = instante_(ymd, HASTA, 0)
    // Todo lo que tengas ese día cuenta como ocupado, menos los de todo el día (feriados, recordatorios).
    const ocupado = cal.getEvents(inicioDia, finDia).filter((ev) => !ev.isAllDayEvent())
    for (let t = inicioDia.getTime(); t + DURACION * 60e3 <= finDia.getTime(); t += (DURACION + ESPACIO) * 60e3) {
      const a = new Date(t)
      const b = new Date(t + DURACION * 60e3)
      if (a < desde) continue
      const choca = ocupado.some((ev) => ev.getStartTime() < new Date(b.getTime() + ESPACIO * 60e3) && ev.getEndTime() > new Date(a.getTime() - ESPACIO * 60e3))
      if (!choca) out.push(a.toISOString())
    }
  }
  return out
}

/** Crea la cita con Meet, invita al cliente y le manda su confirmación. */
function agendar_(d) {
  const inicio = new Date(d.inicio)
  if (isNaN(inicio)) return { ok: false, error: 'fecha inválida' }
  if (horarios_().indexOf(inicio.toISOString()) < 0) return { ok: false, error: 'ese horario ya no está libre' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.correo || ''))) return { ok: false, error: 'correo inválido' }
  const fin = new Date(inicio.getTime() + DURACION * 60e3)
  const en = d.idioma === 'en'
  const zonaLead = ZONAS_.indexOf(d.zona) >= 0 ? d.zona : ZONA
  const titulo = (d.tipo === 'consulta' ? 'Consultoría NXUS AI' : d.tipo === 'llamada' ? (en ? 'NXUS AI meeting' : 'Reunión NXUS AI') : 'Tu propuesta NXUS AI') + ' · ' + String(d.empresa || d.nombre || '').slice(0, 80)
  const ev = Calendar.Events.insert(
    {
      summary: titulo,
      description: MARCA + '\n\n' + String(d.notas || '').slice(0, 3000),
      start: { dateTime: inicio.toISOString(), timeZone: ZONA },
      end: { dateTime: fin.toISOString(), timeZone: ZONA },
      attendees: [{ email: d.correo, displayName: String(d.nombre || '').slice(0, 80) }],
      conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      extendedProperties: { private: { portal: '1', prospecto: String(d.id || '').slice(0, 40) } },
    },
    'primary',
    { conferenceDataVersion: 1, sendUpdates: 'all' },
  )
  const meet = ev.hangoutLink || ''
  // El link de Meet también en la descripción, para los recordatorios.
  if (meet) Calendar.Events.patch({ description: MARCA + '\nMeet: ' + meet + '\n\n' + String(d.notas || '').slice(0, 3000) }, 'primary', ev.id)
  // El idioma y la zona del cliente, para sus recordatorios.
  const evento = CalendarApp.getDefaultCalendar().getEventById(ev.iCalUID || ev.id)
  if (evento) {
    evento.setTag('idioma', en ? 'en' : 'es')
    evento.setTag('zona', zonaLead)
  }
  correo_(d.correo, d.nombre, d.tipo, inicio, meet, '', en ? 'en' : 'es', zonaLead)
  return { ok: true, inicio: inicio.toISOString(), meet: meet, evento: ev.id }
}

const ZONAS_ = ['America/New_York', 'America/Mexico_City']
const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** La fecha y hora en la zona y el idioma del cliente. */
function cuando_(inicio, idioma, zona) {
  const z = ZONAS_.indexOf(zona) >= 0 ? zona : ZONA
  const [d, n, m, hm] = Utilities.formatDate(inicio, z, 'u d M HH:mm').split(' ')
  if (idioma === 'en') return DIAS_EN[Number(d) % 7] + ', ' + MESES_EN[Number(m) - 1] + ' ' + n + ' at ' + hm + (z === 'America/Mexico_City' ? ' (Mexico City time)' : ' (New York time)')
  return DIAS_ES[Number(d) % 7] + ' ' + n + ' de ' + MESES_ES[Number(m) - 1] + ' a las ' + hm + (z === 'America/Mexico_City' ? ' (hora del centro de México)' : ' (hora de Nueva York)')
}

function correo_(para, nombre, tipo, inicio, meet, aviso, idioma, zona) {
  const en = idioma === 'en'
  const que = en ? 'your NXUS AI meeting' : tipo === 'consulta' ? 'tu consultoría' : tipo === 'llamada' ? 'tu reunión' : 'tu reunión para tu propuesta'
  const nom = String(nombre || '').split(' ')[0]
  const avisoEn = { 'mañana': 'tomorrow', 'en 1 hora': 'in 1 hour' }[aviso] || ''
  const titulo = en ? (aviso ? 'Reminder: ' + que + ' ' + avisoEn : 'Confirmed: ' + que) : aviso ? 'Recordatorio: ' + que + ' ' + aviso : 'Confirmado: ' + que
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#12161f">' +
    '<h2 style="margin:0 0 12px">' + (en ? (aviso ? 'See you ' + avisoEn : "You're all set" + (nom ? ', ' + nom : '') + '!') : aviso ? 'Te esperamos ' + aviso : '¡Listo' + (nom ? ', ' + nom : '') + '!') + '</h2>' +
    '<p>' + (en ? (aviso ? 'A reminder of ' : 'Booked: ') + que + ' (30 minutes, Google Meet):' : (aviso ? 'Te recordamos ' : 'Quedó agendada ') + que + ' con NXUS AI:') + '</p>' +
    '<p style="font-size:17px"><b>' + cuando_(inicio, idioma, zona) + '</b></p>' +
    (meet ? '<p><a href="' + meet + '" style="background:#4fd8f7;color:#04101a;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">' + (en ? 'Join the meeting' : 'Entrar a la reunión') + '</a></p>' : '') +
    '<p style="color:#555">' + (en ? "It's also in your calendar. To change the time, just reply to this email." : 'También la tienes en tu calendario. Si necesitas cambiar el horario, contesta este correo.') + '</p>' +
    '<p style="color:#888;font-size:12px">NXUS AI · nxusai.org</p></div>'
  MailApp.sendEmail({ to: para, subject: titulo, htmlBody: html, name: 'NXUS AI' })
}

/** Para probar desde el editor (botón Run): te manda a ti un correo de acceso de ejemplo. */
function probarBienvenida() {
  const yo = Session.getActiveUser().getEmail()
  const r = bienvenida_({ para: yo, nombre: 'Prueba', usuario: 'prueba', contrasena: '123', url: 'https://nxus-hq.netlify.app' })
  Logger.log(r.ok ? 'Listo: te mandé un correo de prueba a ' + yo : 'Falló: ' + r.error)
}

/** NXUS HQ: el acceso de alguien nuevo del equipo (o su contraseña nueva) a su correo. */
function bienvenida_(d) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.para || ''))) return { ok: false, error: 'correo inválido' }
  const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const nom = String(d.nombre || '').split(' ')[0]
  const titulo = d.nueva === false ? 'Tu contraseña nueva de NXUS HQ' : 'Tu acceso a NXUS HQ'
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#12161f">' +
    '<h2 style="margin:0 0 12px">' + (d.nueva === false ? 'Hola' : 'Bienvenido') + (nom ? ', ' + esc(nom) : '') + '</h2>' +
    '<p>' + (d.nueva === false ? 'Eduardo te puso una contraseña nueva para entrar a NXUS HQ:' : 'Ya tienes tu acceso a NXUS HQ, el sistema de trabajo de NXUS AI:') + '</p>' +
    '<table style="font-size:16px;margin:12px 0"><tr><td style="color:#666;padding-right:12px">Usuario</td><td><b>' + esc(d.usuario) + '</b></td></tr>' +
    '<tr><td style="color:#666;padding-right:12px">Contraseña</td><td><b>' + esc(d.contrasena) + '</b></td></tr></table>' +
    '<p><a href="' + esc(d.url) + '" style="background:#4fd8f7;color:#04101a;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Entrar a NXUS HQ</a></p>' +
    '<p style="color:#555">Al entrar te pedirá que cambies tu contraseña por una tuya. Si no lo haces en ese momento, puedes hacerlo después en "Mi cuenta" (abajo a la izquierda, junto a tu nombre).</p>' +
    '<p style="color:#888;font-size:12px">NXUS AI · No compartas este correo con nadie.</p></div>'
  MailApp.sendEmail({ to: d.para, subject: titulo, htmlBody: html, name: 'NXUS AI' })
  return { ok: true }
}

/** Cada 15 minutos: los recordatorios de 24 h y de 1 h, una sola vez cada uno. */
function recordatorios() {
  const ahora = new Date()
  const cal = CalendarApp.getDefaultCalendar()
  const proximas = cal.getEvents(ahora, new Date(ahora.getTime() + 25 * 3600e3)).filter((ev) => String(ev.getDescription() || '').indexOf(MARCA) === 0)
  proximas.forEach((ev) => {
    const faltan = (ev.getStartTime().getTime() - ahora.getTime()) / 60e3
    const invitado = ev.getGuestList()[0]
    if (!invitado) return
    const t = ev.getTitle()
    const tipo = t.indexOf('Consultoría') === 0 ? 'consulta' : t.indexOf('Reunión NXUS AI') === 0 || t.indexOf('NXUS AI meeting') === 0 ? 'llamada' : 'propuesta'
    const idioma = ev.getTag('idioma') || 'es'
    const zona = ev.getTag('zona') || ZONA
    const meet = (ev.getDescription().match(/https:\/\/meet\.google\.com\/\S+/) || [''])[0]
    if (faltan <= 24 * 60 && faltan > 23 * 60 && !ev.getTag('aviso24')) {
      correo_(invitado.getEmail(), invitado.getName(), tipo, ev.getStartTime(), meet, 'mañana', idioma, zona)
      ev.setTag('aviso24', '1')
    }
    if (faltan <= 60 && faltan > 0 && !ev.getTag('aviso1')) {
      correo_(invitado.getEmail(), invitado.getName(), tipo, ev.getStartTime(), meet, 'en 1 hora', idioma, zona)
      ev.setTag('aviso1', '1')
    }
  })
}
