// "Probar la llave de Meta" (HQ → Anuncios): solo lee. Confirma que la llave
// ve la cuenta de anuncios, la página, el Instagram y el conjunto de datos de
// NXUS AI, y qué permisos tiene. No publica ni gasta nada. Solo el admin.
import { cuenta, dataset, graph, instagram, metaListo, pagina } from '../lib/meta.mjs'
import { json, quien } from '../lib/sb.mjs'

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
    dataset()
      ? prueba('Conjunto de datos (leads y clientes)', async () => {
          const d = await graph(dataset(), { params: { fields: 'name' } })
          return { detalle: d.name }
        })
      : { nombre: 'Conjunto de datos (leads y clientes)', ok: false, error: 'Falta META_DATASET_ID' },
  ])
  return json({ ok: resultados.every((r) => r.ok), resultados })
}
