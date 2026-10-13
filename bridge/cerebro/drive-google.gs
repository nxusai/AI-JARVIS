// Etiquetas en Drive: guarda el programa de etiquetas y la cola de impresión
// que manda el cerebro, para que la computadora de la Zebra los tenga.
//
// Solo escribe esos dos archivos, solo en la carpeta "Etiquetas Mi Semago" de
// Mi unidad, y solo si viene la clave. No lee ni borra nada más.
//
// Se pega en script.google.com con la cuenta de Mi Semago; se corre una vez
// preparar() (da la clave para el cerebro) y se implementa como aplicación web.

const CARPETA = 'Etiquetas Mi Semago'
const ARCHIVOS = { 'Etiquetas.html': 'text/html', 'cola-impresion.js': 'application/javascript' }

function preparar() {
  const clave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '')
  PropertiesService.getScriptProperties().setProperty('CLAVE', clave)
  carpeta_()
  Logger.log('Clave para el cerebro (cópiala completa, sin espacios): ' + clave)
}

function carpeta_() {
  const it = DriveApp.getRootFolder().getFoldersByName(CARPETA)
  if (!it.hasNext()) throw new Error('No encuentro la carpeta "' + CARPETA + '" en Mi unidad')
  return it.next()
}

function respuesta_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents)
    const clave = PropertiesService.getScriptProperties().getProperty('CLAVE')
    if (!clave || d.clave !== clave) return respuesta_({ ok: false, error: 'clave incorrecta' })
    const carpeta = carpeta_()
    if (d.prueba) return respuesta_({ ok: true, carpeta: carpeta.getName() })
    if (!ARCHIVOS[d.nombre] || typeof d.contenido !== 'string') return respuesta_({ ok: false, error: 'archivo no permitido' })
    const it = carpeta.getFilesByName(d.nombre)
    if (it.hasNext()) it.next().setContent(d.contenido)
    else carpeta.createFile(d.nombre, d.contenido, ARCHIVOS[d.nombre])
    return respuesta_({ ok: true })
  } catch (err) {
    return respuesta_({ ok: false, error: String((err && err.message) || err) })
  }
}
