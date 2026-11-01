// La llave de Meta de NXUS HQ (el usuario del sistema "NXUS HQ" del
// portafolio): publica en la página e Instagram de NXUS AI y lleva sus
// anuncios. Ver docs/meta-llave-construccion.md.
//
//   META_TOKEN          la llave (secreta)
//   META_AD_ACCOUNT_ID  act_… (la cuenta también la usan otros negocios: HQ solo
//                       toca las campañas que él crea, con "[NXUS HQ]" en el nombre)
//   META_PAGE_ID        la página de Facebook Nxus.AI
//   META_IG_ID          la cuenta de Instagram @nxusai
//   META_DATASET_ID     el conjunto de datos donde HQ avisa leads y clientes

export const VERSION = 'v26.0'
export const MARCA = '[NXUS HQ]'
const env = (k) => (process.env[k] || '').trim()

export const metaListo = () => !!(env('META_TOKEN') && env('META_AD_ACCOUNT_ID') && env('META_PAGE_ID') && env('META_IG_ID'))
export const cuenta = () => env('META_AD_ACCOUNT_ID')
export const pagina = () => env('META_PAGE_ID')
export const instagram = () => env('META_IG_ID')
export const dataset = () => env('META_DATASET_ID')

/** Una llamada a la Graph API con la llave de HQ. GET con params en la URL; POST con params en el cuerpo. */
export async function graph(path, { method = 'GET', params = {}, token = env('META_TOKEN') } = {}) {
  const url = new URL(`https://graph.facebook.com/${VERSION}/${String(path).replace(/^\//, '')}`)
  const cuerpo = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (method === 'GET') url.searchParams.set(k, s)
    else cuerpo.set(k, s)
  }
  if (method === 'GET') url.searchParams.set('access_token', token)
  else cuerpo.set('access_token', token)
  const res = await fetch(url, { method, body: method === 'GET' ? undefined : cuerpo, signal: AbortSignal.timeout(25_000) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    const e = data.error ?? {}
    throw Object.assign(new Error(e.error_user_msg || e.message || `Meta respondió ${res.status}`), { status: res.status, codigo: e.code, sub: e.error_subcode })
  }
  return data
}
