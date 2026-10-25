// Los datos de verdad, en Supabase. Quién ve y toca qué lo cuida la base de
// datos (supabase/esquema.sql); si algo no se permite, aquí solo llega el
// error y se le enseña a la persona en palabras.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm'

/** Los errores de la base de datos, en palabras. */
function claro(error) {
  const m = error?.message || String(error)
  if (/Invalid login credentials/i.test(m)) return new Error('Correo o contraseña incorrectos')
  if (/row-level security|violates row-level|permission denied/i.test(m)) return new Error('No tienes permiso para hacer eso')
  if (/jornadas_una_abierta/i.test(m)) return new Error('Ya tienes una entrada abierta')
  if (/Failed to fetch|NetworkError/i.test(m)) return new Error('Sin conexión. Revisa tu internet e intenta otra vez.')
  return new Error(m)
}
const ok = ({ data, error }) => {
  if (error) throw claro(error)
  return data
}

export function crearSupabase({ url, anon }) {
  const sb = createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } })
  const fotos = new Map()

  async function funcion(nombre, body) {
    const { data } = await sb.auth.getSession()
    const res = await fetch(`/.netlify/functions/${nombre}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${data?.session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    })
    const out = await res.json().catch(() => ({}))
    if (!out.ok) throw new Error(out.error || `Error ${res.status}`)
    return out
  }

  const tabla = (t) => sb.from(t)
  const guardar = async (t, fila, llave = 'id') => {
    if (fila[llave]) {
      const { [llave]: id, ...resto } = fila
      return ok(await tabla(t).update(resto).eq(llave, id).select().single())
    }
    return ok(await tabla(t).insert(fila).select().single())
  }

  return {
    muestra: false,

    async sesion() {
      const { data } = await sb.auth.getUser()
      if (!data?.user) return null
      const p = ok(await tabla('perfiles').select('*').eq('id', data.user.id).maybeSingle())
      if (!p || !p.activo) {
        await sb.auth.signOut()
        throw new Error('Tu acceso está apagado. Pídeselo a Eduardo.')
      }
      return p
    },
    async entrar(correo, clave) {
      ok(await sb.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password: clave }))
      return this.sesion()
    },
    async salir() {
      await sb.auth.signOut()
    },
    async olvide(correo) {
      ok(await sb.auth.resetPasswordForEmail(correo.trim().toLowerCase(), { redirectTo: location.origin }))
    },
    async nuevaClave(clave) {
      ok(await sb.auth.updateUser({ password: clave }))
    },
    alCambiarSesion(fn) {
      sb.auth.onAuthStateChange((evento) => fn(evento))
    },

    personas: async () => ok(await tabla('perfiles').select('*').order('creado')),
    guardarPersona: (p) => guardar('perfiles', p),
    crearPersona: (p) => funcion('usuarios', { accion: 'crear', ...p }),
    claveDe: (id, clave) => funcion('usuarios', { accion: 'clave', id, clave }),
    async subirFoto(id, file) {
      const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      const ruta = `${id}/${crypto.randomUUID()}.${ext}`
      ok(await sb.storage.from('fotos').upload(ruta, file, { contentType: file.type, upsert: false }))
      return ok(await tabla('perfiles').update({ foto: ruta }).eq('id', id).select().single())
    },
    async fotoUrl(ruta) {
      if (!ruta) return ''
      if (fotos.has(ruta)) return fotos.get(ruta)
      const { data } = await sb.storage.from('fotos').createSignedUrl(ruta, 60 * 60 * 12)
      const u = data?.signedUrl ?? ''
      fotos.set(ruta, u)
      return u
    },

    clientes: async () => ok(await tabla('clientes').select('*').order('nombre')),
    guardarCliente: (c) => guardar('clientes', c),
    borrarCliente: async (id) => ok(await tabla('clientes').delete().eq('id', id)),
    dinero: async () => ok(await tabla('clientes_dinero').select('*')),
    guardarDinero: async (d) => ok(await tabla('clientes_dinero').upsert(d).select().single()),

    tareas: async () => ok(await tabla('tareas').select('*').order('creada', { ascending: false })),
    guardarTarea: (t) => guardar('tareas', t),
    borrarTarea: async (id) => ok(await tabla('tareas').delete().eq('id', id)),

    jornadas: async (desde, hasta) =>
      ok(await tabla('jornadas').select('*').gte('entrada', desde.toISOString()).lt('entrada', hasta.toISOString()).order('entrada', { ascending: false })),
    abiertas: async () => ok(await tabla('jornadas').select('*').is('salida', null)),
    marcarEntrada: async () => ok(await tabla('jornadas').insert({}).select().single()),
    marcarSalida: async (id) => ok(await tabla('jornadas').update({ salida: new Date().toISOString() }).eq('id', id).select().single()),
    diaCompleto: async (id, si) => ok(await tabla('jornadas').update({ dia_completo: si }).eq('id', id).select().single()),

    nomina: async () => ok(await tabla('nomina').select('*')),
    guardarNomina: async (n) => ok(await tabla('nomina').upsert(n).select().single()),
    ajustes: async () => ok(await tabla('nomina_ajustes').select('*').order('fecha', { ascending: false })),
    guardarAjuste: (a) => guardar('nomina_ajustes', a),
    borrarAjuste: async (id) => ok(await tabla('nomina_ajustes').delete().eq('id', id)),
    comisiones: async () => ok(await tabla('comisiones').select('*').order('fecha', { ascending: false })),
    guardarComision: (c) => guardar('comisiones', c),
    borrarComision: async (id) => ok(await tabla('comisiones').delete().eq('id', id)),

    bitacora: async () => ok(await tabla('bitacora').select('*').order('cuando', { ascending: false }).limit(200)),

    ordenar: async (texto) => (await funcion('ordenar', { texto })).ficha,
  }
}
