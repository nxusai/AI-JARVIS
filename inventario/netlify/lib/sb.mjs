// Lo que comparten las funciones: hablar con Supabase como la persona que
// pidió (sus candados aplican) o, solo para crear usuarios y para que Ana Sofi
// lea, con la llave de servicio.

const env = (k) => process.env[k] || ''
export const URL_SB = () => env('SUPABASE_URL').replace(/\/$/, '')

export const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store' } })

/** Pide a Supabase con la sesión de la persona (o con la llave de servicio). */
export async function sb(path, { token, servicio = false, method = 'GET', body, prefer } = {}) {
  const llave = servicio ? env('SUPABASE_SERVICE_KEY') : env('SUPABASE_ANON_KEY')
  const res = await fetch(`${URL_SB()}${path}`, {
    method,
    headers: {
      apikey: llave,
      // Las llaves nuevas (sb_secret_) van solo en apikey; las de antes (JWT) también como Bearer.
      ...(servicio ? (/^eyJ/.test(llave) ? { authorization: `Bearer ${llave}` } : {}) : { authorization: `Bearer ${token}` }),
      'content-type': 'application/json',
      ...(prefer ? { prefer } : method === 'POST' && path.startsWith('/rest/') ? { prefer: 'return=representation' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || `Supabase respondió ${res.status}`
    throw Object.assign(new Error(msg), { status: res.status })
  }
  return data
}

/** Quién está pidiendo, según su sesión. null si no hay sesión válida. */
export async function quien(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  try {
    const user = await sb('/auth/v1/user', { token })
    if (!user?.id) return null
    const [perfil] = await sb(`/rest/v1/perfiles?id=eq.${user.id}&select=*`, { token })
    if (!perfil?.activo) return null
    return { token, perfil }
  } catch {
    return null
  }
}
