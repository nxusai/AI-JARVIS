// Correo del Centro de trabajo Mi Semago · Abuelito.
//
// Corre en la cuenta de Google de la empresa. Cuando alguien toca
// "✉️ A mi correo", el Centro de trabajo le pide a este programa que le mande
// el archivo a SU correo: adjunto si pesa menos de 20 MB y, siempre, con un
// enlace para descargarlo (vale 7 días).
//
// Solo responde si viene la clave. No lee tu correo ni tu Drive.
//
// Instalación (una vez):
//   1. script.google.com con la cuenta de la empresa → New project → pegar esto.
//   2. Correr "preparar": da la clave para Netlify (CORREO_CLAVE).
//   3. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone.
//      La URL que termina en /exec va en Netlify como CORREO_URL.

const REMITENTE = 'Mi Semago · Abuelito'
const MAX_ADJUNTO = 20 * 1024 * 1024

function preparar() {
  const clave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '')
  PropertiesService.getScriptProperties().setProperty('CLAVE', clave)
  Logger.log('Clave para Netlify, CORREO_CLAVE (cópiala completa): ' + clave)
  Logger.log('Correos que te quedan hoy: ' + MailApp.getRemainingDailyQuota())
}

function respuesta_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}

function limpio_(s) {
  return String(s || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  })
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents)
    const clave = PropertiesService.getScriptProperties().getProperty('CLAVE')
    if (!clave || d.clave !== clave) return respuesta_({ ok: false, error: 'clave incorrecta' })
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.para || ''))) return respuesta_({ ok: false, error: 'correo inválido' })
    if (!/^https:\/\//.test(String(d.enlace || ''))) return respuesta_({ ok: false, error: 'falta el enlace' })
    if (MailApp.getRemainingDailyQuota() < 1) return respuesta_({ ok: false, error: 'Ya se mandaron todos los correos de hoy. Descárgalo por ahora.' })

    const nombre = String(d.archivo || 'archivo').slice(0, 200)
    const adjuntos = []
    if (Number(d.tamano || 0) > 0 && Number(d.tamano) <= MAX_ADJUNTO) {
      const r = UrlFetchApp.fetch(d.enlace, { muteHttpExceptions: true })
      if (r.getResponseCode() === 200) adjuntos.push(r.getBlob().setName(nombre))
    }
    const html =
      '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f1c19">' +
      '<p>Hola' + (d.nombre ? ' ' + limpio_(String(d.nombre).split(' ')[0]) : '') + ',</p>' +
      '<p>Aquí está el archivo que pediste' + (d.empresa ? ' de <b>' + limpio_(d.empresa) + '</b>' : '') + ':</p>' +
      '<p style="font-size:16px"><b>' + limpio_(nombre) + '</b></p>' +
      (adjuntos.length ? '<p>Va adjunto en este correo.</p>' : '') +
      '<p><a href="' + d.enlace + '" style="background:#23303f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Descargar</a></p>' +
      '<p style="color:#888;font-size:12px">El enlace vale 7 días. Después lo encuentras siempre en el Centro de trabajo.</p></div>'
    MailApp.sendEmail({ to: d.para, subject: nombre, htmlBody: html, name: REMITENTE, attachments: adjuntos })
    return respuesta_({ ok: true, adjunto: adjuntos.length > 0 })
  } catch (err) {
    return respuesta_({ ok: false, error: String((err && err.message) || err) })
  }
}
