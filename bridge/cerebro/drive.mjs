/**
 * The shared folder, reached over the internet. The brain runs as its own
 * hidden user, and Google Drive for desktop lives in the client's session, so
 * the brain cannot write in the synced folder. Instead it hands the two files
 * the printer's computer reads (the label program and the print queue) to a
 * small Apps Script in Mi Semago's Google account (drive-google.gs), which
 * writes only those two files, only in that folder, and only with the key.
 *
 *   llaves.json  { drive_url: "https://script.google.com/macros/s/…/exec", drive_clave }
 */

export const DRIVE_URL = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]{20,}\/exec$/
export const DRIVE_KEY = /^[0-9a-f]{32,64}$/

async function call(url, body, fetchImpl) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  })
  const data = await res.json().catch(() => null)
  if (!data?.ok) throw new Error(data?.error ?? `Drive respondió ${res.status}`)
  return data
}

/** A writer for the core's labels: (name, content) → Promise. */
export const driveWriter = ({ url, clave }, fetchImpl = fetch) => (nombre, contenido) => call(url, { clave, nombre, contenido }, fetchImpl)

/** Whether the script answers with this key: resolves true, or why not. */
export async function driveWorks(url, clave, fetchImpl = fetch) {
  try {
    const r = await call(url, { clave, prueba: true }, fetchImpl)
    return r.carpeta ? true : 'no encontró la carpeta'
  } catch (err) {
    return err.message
  }
}
