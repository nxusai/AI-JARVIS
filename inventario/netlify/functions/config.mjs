// Lo que la página necesita para hablar con Supabase. La llave "anon" es
// pública a propósito: sin una sesión no deja ver nada (los candados están en
// la base de datos).
import { URL_SB } from '../lib/sb.mjs'

export default async () => {
  const url = URL_SB()
  const anon = (process.env.SUPABASE_ANON_KEY || '').trim()
  return Response.json(url && anon ? { url, anon } : { muestra: true }, { headers: { 'cache-control': 'no-store' } })
}
