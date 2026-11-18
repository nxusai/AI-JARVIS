// Leer Meta (Graph API) en SOLO LECTURA. Lo usan el panel "Anuncios" y la foto
// semanal. Necesita META_TOKEN (ads_read) y META_AD_ACCOUNT_ID en Netlify.
// Nunca crea, cambia, prende ni apaga nada en Meta.
import { esDeMiSemago } from '../../public/anuncios-claves.js'

const env = (k) => (process.env[k] || '').trim()
export const V = 'v23.0'
// Todos los estados (también pausados, archivados y borrados): lo que se apaga pasa al historial, no desaparece.
const TODOS = ['ACTIVE', 'PAUSED', 'DELETED', 'PENDING_REVIEW', 'DISAPPROVED', 'PREAPPROVED', 'PENDING_BILLING_INFO', 'CAMPAIGN_PAUSED', 'ARCHIVED', 'ADSET_PAUSED', 'IN_PROCESS', 'WITH_ISSUES']
export const FILTRO = encodeURIComponent(JSON.stringify([{ field: 'ad.effective_status', operator: 'IN', value: TODOS }]))
export const FILTRO_ADS = encodeURIComponent(JSON.stringify([{ field: 'effective_status', operator: 'IN', value: TODOS }]))
export const CAMPOS = 'ad_name,campaign_name,spend,impressions,reach,frequency,cpm,clicks,inline_link_clicks,actions,video_thruplay_watched_actions'

export const metaListo = () => Boolean(env('META_TOKEN') && env('META_AD_ACCOUNT_ID'))
export const cuentaMeta = () => (env('META_AD_ACCOUNT_ID').startsWith('act_') ? env('META_AD_ACCOUNT_ID') : `act_${env('META_AD_ACCOUNT_ID')}`)

export async function graph(path) {
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

/** Las filas de insights que son de Mi Semago (la cuenta puede traer campañas de otra empresa). */
export const filasMiSemago = (r) => (r?.data || []).map(fila).filter((f) => esDeMiSemago(f.campana))

/** Estado de cada anuncio de Mi Semago (también los apagados). */
export async function estadosMeta() {
  const ads = await graph(`${cuentaMeta()}/ads?fields=name,effective_status,created_time,updated_time,campaign{name}&filtering=${FILTRO_ADS}&limit=300`)
  return (ads.data || [])
    .map((a) => ({ anuncio: a.name, campana: a.campaign?.name || '', estado: a.effective_status, creado: a.created_time, actualizado: a.updated_time }))
    .filter((a) => esDeMiSemago(a.campana))
}
