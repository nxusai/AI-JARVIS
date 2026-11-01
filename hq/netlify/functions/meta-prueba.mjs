// "Probar la llave de Meta" (HQ → Anuncios): solo lee. Confirma que la llave
// ve la cuenta de anuncios, la página, el Instagram y el conjunto de datos de
// NXUS AI, y qué permisos tiene. No publica ni gasta nada. Solo el admin.
import { cuenta, dataset, graph, instagram, metaListo, pagina, VERSION } from '../lib/meta.mjs'
import { publico } from '../lib/anuncios.mjs'
import { json, quien, sb } from '../lib/sb.mjs'

const NECESARIOS = ['ads_management', 'pages_manage_posts', 'instagram_content_publish']

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST' }, 405)
  const yo = await quien(req)
  if (!yo) return json({ ok: false, error: 'Tu sesión se cerró. Vuelve a entrar.' }, 401)
  if (yo.perfil.rol !== 'admin') return json({ ok: false, error: 'Solo el administrador' }, 403)
  if (!metaListo()) return json({ ok: false, error: 'Faltan variables de Meta en Netlify (META_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID, META_IG_ID)' }, 503)

  const prueba = async (nombre, fn) => {
    try {
      return { nombre, ok: true, ...(await fn()) }
    } catch (err) {
      return { nombre, ok: false, error: err.message }
    }
  }
  const resultados = await Promise.all([
    prueba('Llave', async () => {
      const yoMeta = await graph('me', { params: { fields: 'id,name' } })
      const perms = await graph('me/permissions').catch(() => ({ data: [] }))
      const dados = (perms.data ?? []).filter((p) => p.status === 'granted').map((p) => p.permission)
      const faltan = dados.length ? NECESARIOS.filter((p) => !dados.includes(p)) : []
      return { detalle: `${yoMeta.name}${dados.length ? ` · ${dados.length} permisos` : ''}${faltan.length ? ` · faltan: ${faltan.join(', ')}` : ''}`, aviso: faltan.length > 0 }
    }),
    // ¿La llave caduca? (si caduca, HQ deja de publicar ese día sin avisar)
    prueba('La llave no caduca', async () => {
      const t = (process.env.META_TOKEN || '').trim()
      const d = (await graph('debug_token', { params: { input_token: t } })).data ?? {}
      if (!d.is_valid) throw new Error('Meta dice que la llave ya no es válida: hay que generar otra')
      const vence = Number(d.expires_at) || 0
      if (!vence) return { detalle: `nunca caduca · app ${d.application ?? d.app_id ?? ''}` }
      const dias = Math.floor((vence * 1000 - Date.now()) / 864e5)
      return { detalle: `caduca en ${dias} días (${new Date(vence * 1000).toISOString().slice(0, 10)}): hay que generar una que no caduque`, aviso: true }
    }),
    prueba('Cuenta de anuncios', async () => {
      const a = await graph(cuenta(), { params: { fields: 'name,currency,timezone_name,account_status,amount_spent,spend_cap,funding_source_details' } })
      const estado = { 1: 'activa', 2: 'deshabilitada', 3: 'con saldo pendiente', 7: 'en revisión', 9: 'en periodo de gracia', 101: 'cerrada' }[a.account_status] ?? `estado ${a.account_status}`
      const pago = a.funding_source_details ? 'con método de pago' : 'sin método de pago visible'
      return { detalle: `${a.name} · ${a.currency} · ${a.timezone_name} · ${estado} · ${pago}${Number(a.spend_cap) ? ` · límite de gasto de la cuenta: ${Number(a.spend_cap) / 100} ${a.currency}` : ' · sin límite de gasto en la cuenta'}`, aviso: a.account_status !== 1 }
    }),
    prueba('Página de Facebook', async () => {
      const p = await graph(pagina(), { params: { fields: 'name,link' } })
      return { detalle: p.name }
    }),
    prueba('Instagram', async () => {
      const i = await graph(instagram(), { params: { fields: 'username,followers_count' } })
      return { detalle: `@${i.username} · ${i.followers_count ?? '?'} seguidores` }
    }),
    prueba('Campañas de HQ en Meta', async () => {
      const c = await graph(`${cuenta()}/campaigns`, { params: { fields: 'name,effective_status,ads{name,effective_status}', limit: 50 } })
      const mias = (c.data ?? []).filter((x) => String(x.name).startsWith('[NXUS HQ]'))
      if (!mias.length) return { detalle: 'Todavía ninguna (HQ no ha creado nada en Meta).' }
      const txt = mias.map((x) => `${x.name}: ${x.effective_status}${x.ads?.data?.length ? ` · ${x.ads.data.map((a) => `${a.name} (${a.effective_status})`).join(', ')}` : ' · sin anuncios'}`).join(' | ')
      return { detalle: txt.slice(0, 900) }
    }),
    // Cuánto del límite de uso de Meta gasta la llave de HQ en la cuenta de anuncios.
    // Si HQ estuviera saturando la cuenta, aquí saldría un porcentaje alto.
    prueba('Uso de la API de Meta (HQ)', async () => {
      const url = new URL(`https://graph.facebook.com/${VERSION}/${cuenta()}`)
      url.searchParams.set('fields', 'name')
      url.searchParams.set('access_token', (process.env.META_TOKEN || '').trim())
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      const leer = (h) => {
        try {
          return JSON.parse(res.headers.get(h) || 'null')
        } catch {
          return null
        }
      }
      const cuentaUso = leer('x-ad-account-usage')
      const negocio = leer('x-business-use-case-usage')
      const usos = Object.values(negocio ?? {}).flat()
      const max = Math.max(0, Number(cuentaUso?.acc_id_util_pct ?? 0), ...usos.map((u) => Math.max(u.call_count ?? 0, u.total_cputime ?? 0, u.total_time ?? 0)))
      const bloqueo = usos.some((u) => Number(u.estimated_time_to_regain_access) > 0)
      return { detalle: `${max}% del límite usado${bloqueo ? ' · Meta frenó a HQ por un rato' : ' · sin bloqueos'}`, aviso: max >= 75 || bloqueo }
    }),
    // Meta revisa (sin crear nada: validate_only) que aceptaría la campaña y el público que HQ usa para los anuncios.
    prueba('Crear anuncios (Meta lo valida sin crear nada)', async () => {
      const v = { execution_options: ['validate_only'] }
      await graph(`${cuenta()}/campaigns`, { method: 'POST', params: { ...v, name: '[NXUS HQ] prueba', objective: 'OUTCOME_ENGAGEMENT', status: 'PAUSED', special_ad_categories: [], buying_type: 'AUCTION', daily_budget: 1000, bid_strategy: 'LOWEST_COST_WITHOUT_CAP' } })
      const topes = await sb('/rest/v1/anuncios_topes?campana_id=neq.&select=mercado,campana_id', { servicio: true }).catch(() => [])
      const hechos = ['campaña ✓']
      for (const t of topes) {
        await graph(`${cuenta()}/adsets`, {
          method: 'POST',
          params: { ...v, name: '[NXUS HQ] prueba', campaign_id: t.campana_id, billing_event: 'IMPRESSIONS', optimization_goal: 'CONVERSATIONS', destination_type: 'MESSENGER', promoted_object: { page_id: pagina() }, targeting: await publico(t.mercado), status: 'PAUSED' },
        })
        hechos.push(`público ${t.mercado === 'usa' ? 'USA' : 'México'} ✓`)
      }
      return { detalle: hechos.join(' · ') }
    }),
    dataset()
      ? prueba('Conjunto de datos (leads y clientes)', async () => {
          const d = await graph(dataset(), { params: { fields: 'name' } })
          return { detalle: d.name }
        })
      : { nombre: 'Conjunto de datos (leads y clientes)', ok: false, error: 'Falta META_DATASET_ID' },
  ])
  return json({ ok: resultados.every((r) => r.ok), resultados })
}
