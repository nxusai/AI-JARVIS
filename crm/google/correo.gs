// Correo del Centro de trabajo Mi Semago · Abuelito.
//
// Corre en la cuenta de Google de la empresa. Cuando alguien toca
// "✉️ A mi correo", el Centro de trabajo le pide a este programa que le mande
// el archivo a SU correo (o varios juntos en un solo correo): adjuntos mientras
// sumen menos de 20 MB y, siempre, cada uno con su enlace (vale 7 días).
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

    // Uno ("archivo") o varios juntos en un solo correo ("archivos").
    const lista = Array.isArray(d.archivos) && d.archivos.length
      ? d.archivos.slice(0, 20)
      : [{ nombre: d.archivo, tamano: d.tamano, enlace: d.enlace }]
    const adjuntos = []
    let pesoAdjuntos = 0
    lista.forEach(function (a) {
      a.nombre = String(a.nombre || 'archivo').slice(0, 200)
      a.adjunto = false
      if (!/^https:\/\//.test(String(a.enlace || ''))) return
      const peso = Number(a.tamano || 0)
      if (peso > 0 && peso <= MAX_ADJUNTO && pesoAdjuntos + peso <= MAX_ADJUNTO) {
        const r = UrlFetchApp.fetch(a.enlace, { muteHttpExceptions: true })
        if (r.getResponseCode() === 200) {
          adjuntos.push(r.getBlob().setName(a.nombre))
          pesoAdjuntos += peso
          a.adjunto = true
        }
      }
    })
    const varios = lista.length > 1
    const boton = function (a) {
      return '<tr><td style="padding:6px 12px 6px 0"><b>' + limpio_(a.nombre) + '</b>' + (a.adjunto ? ' <span style="color:#888">(adjunto)</span>' : '') + '</td>' +
        '<td style="padding:6px 0"><a href="' + a.enlace + '" style="background:#23303f;color:#fff;padding:7px 12px;border-radius:8px;text-decoration:none;font-weight:bold">Descargar</a></td></tr>'
    }
    const html =
      '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f1c19">' +
      '<p>Hola' + (d.nombre ? ' ' + limpio_(String(d.nombre).split(' ')[0]) : '') + ',</p>' +
      '<p>' + (varios ? 'Aquí están los ' + lista.length + ' archivos que pediste' : 'Aquí está el archivo que pediste') + (d.empresa ? ' de <b>' + limpio_(d.empresa) + '</b>' : '') + ':</p>' +
      '<table style="border-collapse:collapse;margin:8px 0 14px">' + lista.map(boton).join('') + '</table>' +
      (adjuntos.length ? '<p>' + (adjuntos.length === lista.length ? (varios ? 'Van adjuntos en este correo.' : 'Va adjunto en este correo.') : 'Los marcados van adjuntos; los demás, con su botón (pesan mucho para adjuntarlos).') + '</p>' : '') +
      '<p style="color:#888;font-size:12px">Los enlaces valen 7 días. Después los encuentras siempre en el Centro de trabajo.</p></div>'
    const asunto = varios ? lista.length + ' archivos' + (d.empresa ? ' · ' + String(d.empresa) : '') : lista[0].nombre
    MailApp.sendEmail({ to: d.para, subject: asunto, htmlBody: html, name: REMITENTE, attachments: adjuntos })
    return respuesta_({ ok: true, varios: true, adjuntos: adjuntos.length })
  } catch (err) {
    return respuesta_({ ok: false, error: String((err && err.message) || err) })
  }
}
