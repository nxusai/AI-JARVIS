// Los números de Meta para el panel "Anuncios" de HQ: SOLO LECTURA (HQ no crea,
// cambia ni publica anuncios; eso lo hace Eduardo en Ads Manager). Trae, de las
// campañas de NXUS (las que en su nombre dicen "NXUS |"), lo gastado, lo visto,
// las conversaciones y las reproducciones de video, por anuncio y por día.
// Necesita META_TOKEN (con permiso ads_read) y META_AD_ACCOUNT_ID en Netlify.
// Solo para el admin o quien ve prospectos.
import { json, quien } from '../lib/sb.mjs'

const env = (k) => (process.env[k] || '').trim()
const V = 'v23.0'
// Todos los estados (también pausados, archivados y borrados): lo que se apaga pasa al historial del mes, no desaparece.
const TODOS = ['ACTIVE', 'PAUSED', 'DELETED', 'PENDING_REVIEW', 'DISAPPROVED', 'PREAPPROVED', 'PENDING_BILLING_INFO', 'CAMPAIGN_PAUSED', 'ARCHIVED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES']
const FILTRO = encodeURIComponent(JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: 'NXUS |' }, { field: 'ad.effective_status', operator: 'IN', value: TODOS }]))
const FILTRO_ADS = encodeURIComponent(JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: 'NXUS |' }, { field: 'effective_status', operator: 'IN', value: TODOS }]))

async function graph(path) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`https://graph.facebook.com/${V}/${path}${sep}access_token=${encodeURIComponent(env('META_TOKEN'))}`, { signal: AbortSignal.timeout(15_000) })
  const out = await res.json().catch(() => ({}))
  if (!res.ok || out.error) throw new Error(out.error?.message || `Meta respondió ${res.status}`)
  return out
}

const accion = (lista, tipo) => Number((lista || []).find((a) => a.action_type === tipo)?.value || 0)
const CONVERSA = 'onsite_conversion.messaging_conversation_started_7d'

/** Una fila de insights de Meta → lo que usa el panel. */
export function fila(x) {
  return {
    anuncio: x.ad_name || '',
    campana: x.campaign_name || '',
    gasto: Number(x.spend || 0),
    impresiones: Number(x.impressions || 0),
    alcance: Number(x.reach || 0),
    frecuencia: Number(x.frequency || 0),
    cpm: Number(x.cpm || 0),
    clics: Number(x.inline_link_clicks || x.clicks || 0),
    conversaciones: accion(x.actions, CONVERSA),
    vistas3s: accion(x.actions, 'video_view'),
    thruplays: accion(x.video_thruplay_watched_actions, 'video_view'),
    dia: x.date_start || '',
  }
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin' && (yo.perfil.pros_ver ?? 'nada') === 'nada') return json({ ok: false, error: 'sin permiso' }, 403)
  if (!env('META_TOKEN') || !env('META_AD_ACCOUNT_ID')) return json({ ok: true, conectado: false, motivo: 'Faltan META_TOKEN o META_AD_ACCOUNT_ID en Netlify' })
  const act = env('META_AD_ACCOUNT_ID').startsWith('act_') ? env('META_AD_ACCOUNT_ID') : `act_${env('META_AD_ACCOUNT_ID')}`
  const campos = 'ad_name,campaign_name,spend,impressions,reach,frequency,cpm,clicks,inline_link_clicks,actions,video_thruplay_watched_actions'
  try {
    const [cuenta, total, semana, dias, ads] = await Promise.all([
      graph(`${act}?fields=currency,name`),
      graph(`${act}/insights?level=ad&date_preset=maximum&fields=${campos}&filtering=${FILTRO}&limit=200`),
      graph(`${act}/insights?level=ad&date_preset=last_7d&fields=${campos}&filtering=${FILTRO}&limit=200`),
      graph(`${act}/insights?level=campaign&date_preset=last_30d&time_increment=1&fields=campaign_name,spend,actions,impressions&filtering=${FILTRO}&limit=500`),
      graph(`${act}/ads?fields=name,effective_status,created_time,updated_time,campaign{name}&filtering=${FILTRO_ADS}&limit=200`),
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
      estados: (ads.data || []).map((a) => ({ anuncio: a.name, campana: a.campaign?.name || '', estado: a.effective_status, creado: a.created_time, actualizado: a.updated_time })),
      al: new Date().toISOString(),
    })
  } catch (err) {
    return json({ ok: true, conectado: false, motivo: `Meta: ${err.message}`.slice(0, 300) })
  }
}
