// Los números de Meta para el panel "Anuncios" de HQ: SOLO LECTURA (HQ no crea,
// cambia ni publica anuncios; eso lo hace Eduardo en Ads Manager). Trae, de las
// campañas de NXUS (las que en su nombre dicen "NXUS |"), lo gastado, lo visto,
// las conversaciones y las reproducciones de video, por anuncio y por día.
// Necesita META_TOKEN (con permiso ads_read) y META_AD_ACCOUNT_ID en Netlify.
// Solo para el admin o quien ve prospectos.
import { json, quien } from '../lib/sb.mjs'
import { graph, fila, estadosMeta, metaListo, cuentaMeta, FILTRO, CAMPOS } from '../lib/meta.mjs'

export { fila }

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin' && (yo.perfil.pros_ver ?? 'nada') === 'nada') return json({ ok: false, error: 'sin permiso' }, 403)
  if (!metaListo()) return json({ ok: true, conectado: false, motivo: 'Faltan META_TOKEN o META_AD_ACCOUNT_ID en Netlify' })
  const act = cuentaMeta()
  const campos = CAMPOS
  try {
    const [cuenta, total, semana, dias, ads] = await Promise.all([
      graph(`${act}?fields=currency,name`),
      graph(`${act}/insights?level=ad&date_preset=maximum&fields=${campos}&filtering=${FILTRO}&limit=200`),
      graph(`${act}/insights?level=ad&date_preset=last_7d&fields=${campos}&filtering=${FILTRO}&limit=200`),
      graph(`${act}/insights?level=campaign&date_preset=last_30d&time_increment=1&fields=campaign_name,spend,actions,impressions&filtering=${FILTRO}&limit=500`),
      estadosMeta(),
    ])
    // Lo gastado en anuncios es dinero: solo el admin o con el permiso "anuncios_gasto".
    const verGasto = yo.perfil.rol === 'admin' || (yo.perfil.permisos ?? []).includes('anuncios_gasto')
    const sinDinero = (x) => (verGasto ? x : { ...x, gasto: 0, cpm: 0 })
    return json({
      ok: true,
      conectado: true,
      sinGasto: !verGasto,
      moneda: cuenta.currency || 'USD',
      total: (total.data || []).map(fila).map(sinDinero),
      semana: (semana.data || []).map(fila).map(sinDinero),
      dias: (dias.data || []).map(fila).map(sinDinero),
      estados: ads,
      al: new Date().toISOString(),
    })
  } catch (err) {
    return json({ ok: true, conectado: false, motivo: `Meta: ${err.message}`.slice(0, 300) })
  }
}
