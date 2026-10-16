// Arranque: si el sitio ya está conectado a Supabase, los datos de verdad; si
// todavía no, la muestra.
import { iniciar } from './app.js'

let cfg = {}
try {
  const r = await fetch('/.netlify/functions/config')
  if (r.ok) cfg = await r.json()
} catch {
  cfg = {}
}

if (cfg.url && cfg.anon) {
  const { crearSupabase } = await import('./datos-supabase.js')
  iniciar(crearSupabase(cfg))
} else {
  const { crearMuestra } = await import('./datos-muestra.js')
  iniciar(crearMuestra(), { muestra: true })
}
