// Los datos de verdad, en Supabase. Quién ve y toca qué —y que lo cerrado no
// se cambie— lo cuida la base de datos (supabase/esquema.sql); si algo no se
// permite, aquí solo llega el error y se le enseña a la persona en palabras.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm'

/** Los errores de la base de datos, en palabras. */
function claro(error) {
  const m = error?.message || String(error)
  if (/Invalid login credentials/i.test(m)) return new Error('Correo o contraseña incorrectos')
  if (/row-level security|violates row-level|permission denied/i.test(m)) return new Error('No tienes permiso para hacer eso')
  if (/proveedores_nombre/i.test(m)) return new Error('Ya hay un proveedor con ese nombre')
  if (/productos_nombre/i.test(m)) return new Error('Ya hay un producto con ese nombre')
  if (/corrige_id_key|duplicate key.*corrige/i.test(m)) return new Error('Eso ya tiene una corrección; corrige la más nueva')
  if (/Failed to fetch|NetworkError/i.test(m)) return new Error('Sin conexión. Revisa tu internet e intenta otra vez.')
  return new Error(m)
}
const ok = ({ data, error }) => {
  if (error) throw claro(error)
  return data
}

const RECEPCION = '*, lineas:recepcion_lineas(*), archivos:recepcion_archivos(*)'
const PEDIDO = '*, lineas:pedido_lineas(*)'

export function crearSupabase({ url, anon }) {
  const sb = createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } })
  const urls = new Map()

  async function funcion(nombre, body) {
    const { data } = await sb.auth.getSession()
    const res = await fetch(`/.netlify/functions/${nombre}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${data?.session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    })
    const out = await res.json().catch(() => ({}))
    if (!out.ok) throw new Error(out.error || (res.status === 504 ? 'Ana Sofi tardó demasiado. Intenta otra vez.' : `Error ${res.status}`))
    return out
  }

  const tabla = (t) => sb.from(t)
  const guardar = async (t, fila, sel = '*') => {
    if (fila.id) {
      const { id, ...resto } = fila
      return ok(await tabla(t).update(resto).eq('id', id).select(sel).single())
    }
    return ok(await tabla(t).insert(fila).select(sel).single())
  }

  return {
    muestra: false,

    async sesion() {
      const { data } = await sb.auth.getUser()
      if (!data?.user) return null
      const p = ok(await tabla('perfiles').select('*').eq('id', data.user.id).maybeSingle())
      if (!p || !p.activo) {
        await sb.auth.signOut()
        throw new Error('Tu acceso está apagado. Pídeselo a NXUS.')
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

    proveedores: async () => ok(await tabla('proveedores').select('*').order('nombre')),
    guardarProveedor: (p) => guardar('proveedores', p),
    borrarProveedor: async (id) => ok(await tabla('proveedores').delete().eq('id', id)),
    productos: async () => ok(await tabla('productos').select('*').order('nombre')),
    guardarProducto: (p) => guardar('productos', p),
    borrarProducto: async (id) => ok(await tabla('productos').delete().eq('id', id)),

    recepciones: async () => ok(await tabla('recepciones').select(RECEPCION).order('llegada', { ascending: false }).limit(3000)),
    recepcion: async (id) => ok(await tabla('recepciones').select(RECEPCION).eq('id', id).single()),
    nuevaRecepcion: async () => ok(await tabla('recepciones').insert({}).select(RECEPCION).single()),
    guardarRecepcion: (r) => guardar('recepciones', r, RECEPCION),
    cerrarRecepcion: async (id) => ok(await tabla('recepciones').update({ estado: 'cerrada' }).eq('id', id).select(RECEPCION).single()),
    reabrirRecepcion: async (id) => ok(await tabla('recepciones').update({ estado: 'borrador', cerrada_en: null, cerrada_por: null }).eq('id', id).select(RECEPCION).single()),
    borrarRecepcion: async (id) => ok(await tabla('recepciones').delete().eq('id', id)),
    corregirRecepcion: async (id, motivo) => ok(await sb.rpc('corregir_recepcion', { rid: id, motivo })),
    guardarLinea: (l) => guardar('recepcion_lineas', l),
    borrarLinea: async (id) => ok(await tabla('recepcion_lineas').delete().eq('id', id)),
    async subirFoto(recepcionId, tipo, blob, lineaId = null) {
      const ruta = `${recepcionId}/${crypto.randomUUID()}.jpg`
      ok(await sb.storage.from('recepciones').upload(ruta, blob, { contentType: blob.type || 'image/jpeg', upsert: false }))
      return ok(await tabla('recepcion_archivos').insert({ recepcion_id: recepcionId, tipo, ruta, linea_id: lineaId }).select().single())
    },
    guardarFoto: (f) => guardar('recepcion_archivos', f),
    borrarFoto: async (id) => ok(await tabla('recepcion_archivos').delete().eq('id', id)),
    async fotoUrl(ruta) {
      if (!ruta) return ''
      if (urls.has(ruta)) return urls.get(ruta)
      const { data } = await sb.storage.from('recepciones').createSignedUrl(ruta, 60 * 60 * 12)
      const u = data?.signedUrl ?? ''
      urls.set(ruta, u)
      return u
    },

    pedidos: async () => ok(await tabla('pedidos').select(PEDIDO).order('pedido_en', { ascending: false }).limit(3000)),
    hacerPedido: async (datos) => ok(await sb.rpc('hacer_pedido', { datos })),
    marcarComprado: async (id, datos) => ok(await sb.rpc('marcar_comprado', { pid: id, datos })),
    borrarPedido: async (id) => ok(await tabla('pedidos').delete().eq('id', id)),

    salidas: async () => ok(await tabla('salidas').select('*').order('hecha_en', { ascending: false }).limit(10000)),
    registrarSalida: async (s) => ok(await tabla('salidas').insert(s).select().single()),
    borrarSalida: async (id) => ok(await tabla('salidas').delete().eq('id', id)),

    bitacora: async () => ok(await tabla('bitacora').select('*').order('cuando', { ascending: false }).limit(300)),

    leerPacking: async (imagenes) => (await funcion('ia', { accion: 'packing', imagenes })).ficha,
    revisar: async (recepcion, imagenes) => (await funcion('ia', { accion: 'revisar', recepcion, imagenes })).revision,
  }
}
