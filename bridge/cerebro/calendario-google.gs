// Calendario de ventas: agenda las videollamadas de Mi Semago que pide el
// cerebro (Ana Sofi, cuando un lead acepta en la llamada).
//
// Solo hace dos cosas, y solo con la clave:
//   - prueba: contesta que está vivo;
//   - agendar: revisa que la hora esté libre en el calendario (si no, toma la
//     hora libre más cercana entre 10 y 16 h del Este, ese día o el siguiente)
//     y crea UNA cita de una hora con Google Meet, título "Mi Semago · …",
//     invitando al correo del lead.
// No lee ni devuelve ninguna otra cita (solo mira si una hora está ocupada),
// no borra ni cambia nada que no haya creado él.
//
// Se pega en script.google.com con la cuenta del calendario donde caen los
// meetings; en el editor: Servicios (+) → Google Calendar API → Agregar.
// Se corre una vez preparar() (da la clave para el cerebro) y se implementa
// como aplicación web (Ejecutar como: yo · Acceso: cualquier persona).

const ZONA = 'America/New_York'
const DESDE = 10
const HASTA = 16

function preparar() {
  const clave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '')
  PropertiesService.getScriptProperties().setProperty('CLAVE', clave)
  CalendarApp.getDefaultCalendar()
  Calendar.Events.list('primary', { maxResults: 1 })
  Logger.log('Clave para el cerebro (cópiala completa, sin espacios): ' + clave)
}

function respuesta_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}

function hora_(d) {
  return Number(Utilities.formatDate(d, ZONA, 'H'))
}

function libre_(inicio, fin) {
  return CalendarApp.getDefaultCalendar()
    .getEvents(inicio, fin)
    .filter(function (ev) {
      return !ev.isAllDayEvent() && ev.getMyStatus() !== CalendarApp.GuestStatus.NO
    }).length === 0
}

// La hora pedida si está libre; si no, la libre más cercana entre DESDE y HASTA, ese día o el siguiente.
function horaLibre_(pedida) {
  const H = 60 * 60 * 1000
  if (libre_(pedida, new Date(pedida.getTime() + H))) return { inicio: pedida, ajustado: false }
  const opciones = []
  for (let dia = 0; dia < 2; dia++) {
    for (let h = DESDE; h < HASTA; h++) {
      const base = new Date(pedida.getTime() + dia * 24 * H)
      const cambio = (h - hora_(base)) * H
      const t = new Date(base.getTime() + cambio)
      t.setMinutes(0, 0, 0)
      if (t.getTime() < Date.now() + 2 * H || hora_(t) !== h) continue
      opciones.push(t)
    }
  }
  opciones.sort(function (a, b) {
    return Math.abs(a - pedida) - Math.abs(b - pedida)
  })
  for (let i = 0; i < opciones.length; i++) {
    if (libre_(opciones[i], new Date(opciones[i].getTime() + H))) return { inicio: opciones[i], ajustado: true }
  }
  return null
}

function agendar_(d) {
  const titulo = String(d.titulo || '')
  if (titulo.indexOf('Mi Semago · ') !== 0) return { ok: false, error: 'título no permitido' }
  const pedida = new Date(d.inicio)
  if (isNaN(pedida) || pedida.getTime() < Date.now() + 60 * 60 * 1000 || pedida.getTime() > Date.now() + 10 * 24 * 60 * 60 * 1000) return { ok: false, error: 'hora fuera de rango' }
  const correo = String(d.invitado || '').trim().toLowerCase()
  if (!/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(correo)) return { ok: false, error: 'falta el correo del lead' }
  const lugar = horaLibre_(pedida)
  if (!lugar) return { ok: false, error: 'no hay horas libres ese día ni el siguiente' }
  const fin = new Date(lugar.inicio.getTime() + 60 * 60 * 1000)
  const ev = Calendar.Events.insert(
    {
      summary: titulo.slice(0, 200),
      description: String(d.descripcion || '').slice(0, 6000) + (lugar.ajustado ? '\n\nAjustamos el horario al más cercano disponible. / We moved it to the closest available time.' : ''),
      start: { dateTime: lugar.inicio.toISOString(), timeZone: ZONA },
      end: { dateTime: fin.toISOString(), timeZone: ZONA },
      attendees: [{ email: correo }],
      conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      extendedProperties: { private: { origen: 'cerebro-ventas', lead: String(d.lead || '').slice(0, 80) } },
    },
    'primary',
    { conferenceDataVersion: 1, sendUpdates: 'all' },
  )
  return { ok: true, id: ev.id, inicio: lugar.inicio.toISOString(), ajustado: lugar.ajustado, link: ev.hangoutLink || '' }
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents)
    const clave = PropertiesService.getScriptProperties().getProperty('CLAVE')
    if (!clave || d.clave !== clave) return respuesta_({ ok: false, error: 'clave incorrecta' })
    if (d.prueba) return respuesta_({ ok: true, calendario: true })
    if (d.accion === 'agendar') return respuesta_(agendar_(d))
    return respuesta_({ ok: false, error: 'acción no permitida' })
  } catch (err) {
    return respuesta_({ ok: false, error: String((err && err.message) || err) })
  }
}
