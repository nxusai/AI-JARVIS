// Correos de acceso del Centro de trabajo Mi Semago · Abuelito.
//
// Corre en la cuenta de Google Workspace de NXUS (la de Eduardo). Cuando el
// admin crea un usuario, le cambia la contraseña o le corrige el correo, el
// Centro de trabajo le pide a este programa que le mande a esa persona su
// acceso: el link de la página, su usuario y su contraseña. Al entrar, la
// página le ofrece cambiarla por una suya.
//
// Solo responde si viene la clave. No lee tu correo ni tu Drive, y no guarda
// ninguna contraseña: la recibe, manda el correo y la olvida.
//
// Instalación (una vez):
//   1. script.google.com con la cuenta de NXUS → New project → pegar esto.
//   2. Correr "preparar": da la clave para Netlify (ACCESO_CLAVE).
//   3. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone.
//      La URL que termina en /exec va en Netlify como ACCESO_URL.

const REMITENTE = 'NXUS AI · Centro de trabajo'
const SISTEMA = 'Centro de trabajo Mi Semago · Abuelito'

function preparar() {
  const clave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '')
  PropertiesService.getScriptProperties().setProperty('CLAVE', clave)
  Logger.log('Clave para Netlify, ACCESO_CLAVE (cópiala completa): ' + clave)
  Logger.log('Correos que te quedan hoy: ' + MailApp.getRemainingDailyQuota())
}

/** Para probar desde el editor: te manda a ti mismo un correo de ejemplo. */
function probar() {
  const yo = Session.getActiveUser().getEmail()
  mandar_({ para: yo, nombre: 'Prueba', usuario: 'prueba', contrasena: '123', enlace: 'https://centro-misemago-abuelito.netlify.app', motivo: 'nuevo' })
  Logger.log('Te mandé un correo de prueba a ' + yo)
}

function respuesta_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}

function limpio_(s) {
  return String(s || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  })
}

const MOTIVOS = {
  nuevo: { asunto: 'Tu acceso al ' + SISTEMA, intro: 'Ya tienes acceso al <b>' + SISTEMA + '</b>. Estos son tus datos para entrar:' },
  clave: { asunto: 'Tu contraseña nueva del ' + SISTEMA, intro: 'Te pusimos una contraseña nueva para el <b>' + SISTEMA + '</b>. Estos son tus datos para entrar:' },
  correo: { asunto: 'Tu acceso al ' + SISTEMA, intro: 'Actualizamos tu correo en el <b>' + SISTEMA + '</b>. Desde hoy entras con estos datos:' },
}

function mandar_(d) {
  const m = MOTIVOS[d.motivo] || MOTIVOS.nuevo
  const fila = function (etiqueta, valor) {
    return '<tr><td style="padding:6px 12px 6px 0;color:#6b645c">' + etiqueta + '</td><td style="padding:6px 0;font-weight:bold;font-family:Consolas,Menlo,monospace;font-size:15px">' + limpio_(valor) + '</td></tr>'
  }
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f1c19;line-height:1.5">' +
    '<p>Hola' + (d.nombre ? ' ' + limpio_(String(d.nombre).split(' ')[0]) : '') + ',</p>' +
    '<p>' + m.intro + '</p>' +
    '<table style="border-collapse:collapse;margin:8px 0 16px">' + fila('Usuario', d.usuario) + fila('Contraseña', d.contrasena) + '</table>' +
    '<p><a href="' + limpio_(d.enlace) + '" style="background:#23303f;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Entrar al Centro de trabajo</a></p>' +
    '<p style="color:#6b645c;font-size:13px">O copia este link: ' + limpio_(d.enlace) + '</p>' +
    '<p>Al entrar te vamos a ofrecer cambiar la contraseña por una tuya. Te lo recomendamos, y después borra este correo.</p>' +
    '<p style="color:#888;font-size:12px;margin-top:24px">Si no esperabas este correo, ignóralo o respóndenos para avisarnos.<br>NXUS AI</p></div>'
  const texto =
    'Hola' + (d.nombre ? ' ' + String(d.nombre).split(' ')[0] : '') + ',\n\n' +
    m.intro.replace(/<[^>]+>/g, '') + '\n\nUsuario: ' + d.usuario + '\nContraseña: ' + d.contrasena + '\n\nEntra aquí: ' + d.enlace +
    '\n\nAl entrar te vamos a ofrecer cambiar la contraseña por una tuya.\n\nNXUS AI'
  MailApp.sendEmail({ to: d.para, subject: m.asunto, body: texto, htmlBody: html, name: REMITENTE })
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents)
    const clave = PropertiesService.getScriptProperties().getProperty('CLAVE')
    if (!clave || d.clave !== clave) return respuesta_({ ok: false, error: 'clave incorrecta' })
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.para || ''))) return respuesta_({ ok: false, error: 'correo inválido' })
    if (!/^https:\/\//.test(String(d.enlace || ''))) return respuesta_({ ok: false, error: 'falta el link de la página' })
    if (!String(d.contrasena || '').trim() || !String(d.usuario || '').trim()) return respuesta_({ ok: false, error: 'falta el usuario o la contraseña' })
    if (MailApp.getRemainingDailyQuota() < 1) return respuesta_({ ok: false, error: 'Ya se mandaron todos los correos de hoy.' })
    mandar_(d)
    return respuesta_({ ok: true })
  } catch (err) {
    return respuesta_({ ok: false, error: String((err && err.message) || err) })
  }
}
