// Lo que pinta el panel "Anuncios" del Centro de trabajo: los números de Meta de
// las campañas de Mi Semago (SOLO LECTURA: aquí no se crea, cambia ni publica nada;
// eso lo hace Eduardo en Ads Manager), la foto de cada semana y lo aprendido.
// SOLO para el creador del sistema (perfiles.dueno): ni los administradores ni el
// cliente lo ven.
// Necesita META_TOKEN (permiso ads_read) y META_AD_ACCOUNT_ID en Netlify.
import { json, quien } from '../lib/sb.mjs'
import { graph, filasMiSemago, estadosMeta, metaListo, cuentaMeta, FILTRO, CAMPOS } from '../lib/meta.mjs'
import { semanasGuardadas, aprendizajesGuardados } from '../lib/semana.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (!yo.perfil.dueno) return json({ ok: false, error: 'sin permiso' }, 403)

  // Lo guardado en el Centro de trabajo (no depende de Meta).
  let faltanTablas = false
  const [semanas, aprendizajes] = await Promise.all([semanasGuardadas(), aprendizajesGuardados()]).catch(() => {
    faltanTablas = true
    return [[], []]
  })
  const base = { ok: true, semanas, aprendizajes, faltanTablas, al: new Date().toISOString() }

  if (!metaListo()) return json({ ...base, conectado: false, motivo: 'Faltan META_TOKEN o META_AD_ACCOUNT_ID en Netlify' })
  const act = cuentaMeta()
  try {
    const [cuenta, total, semana, dias, estados] = await Promise.all([
      graph(`${act}?fields=currency,name`),
      graph(`${act}/insights?level=ad&date_preset=maximum&fields=${CAMPOS}&filtering=${FILTRO}&limit=500`),
      graph(`${act}/insights?level=ad&date_preset=last_7d&fields=${CAMPOS}&filtering=${FILTRO}&limit=500`),
      graph(`${act}/insights?level=campaign&date_preset=last_30d&time_increment=1&fields=campaign_name,spend,actions,impressions&limit=1000`),
      estadosMeta(),
    ])
    return json({
      ...base,
      conectado: true,
      moneda: cuenta.currency || 'USD',
      total: filasMiSemago(total),
      semana: filasMiSemago(semana),
      dias: filasMiSemago(dias),
      estados,
    })
  } catch (err) {
    return json({ ...base, conectado: false, motivo: `Meta: ${err.message}`.slice(0, 300) })
  }
}
