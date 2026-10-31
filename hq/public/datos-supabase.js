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
  if (/duplicate key.*perfiles_codigo/i.test(m)) return new Error('Ese código de link ya lo tiene otra persona')
  if (/Failed to fetch|NetworkError/i.test(m)) return new Error('Sin conexión. Revisa tu internet e intenta otra vez.')
  return new Error(m)
}
const ok = ({ data, error }) => {
  if (error) throw claro(error)
  return data
}

const LEAD_LISTA =
  'id,origen,canal,fuente,nombre,empresa,telefono,correo,ciudad,pais,idioma,servicio,permiso_llamada,estado,motivo,llamada_inicio,llamada_seg,resumen,prospecto_id,asignado,creado,actualizado'

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

    prospectos: async () => ok(await tabla('prospectos').select('*').order('actualizado', { ascending: false })),
    guardarProspecto: (p) => guardar('prospectos', p),
    borrarProspecto: async (id) => ok(await tabla('prospectos').delete().eq('id', id)),
    notasProspecto: async (id) => ok(await tabla('prospectos_notas').select('*').eq('prospecto_id', id).order('creada')),
    agregarNota: async (id, texto) => ok(await tabla('prospectos_notas').insert({ prospecto_id: id, texto }).select().single()),
    pagosProspectos: async () => ok(await tabla('prospectos_pagos').select('*').order('fecha', { ascending: false })),
    convertirProspecto: async (id) => ok(await sb.rpc('convertir_prospecto', { pid: id })),

    // Leads de los anuncios (ManyChat). La lista sin la transcripción, que pesa; la ficha completa.
    leads: async () => ok(await tabla('leads').select(LEAD_LISTA).order('creado', { ascending: false })),
    lead: async (id) => ok(await tabla('leads').select('*').eq('id', id).maybeSingle()),
    guardarLead: (l) => guardar('leads', l),
    borrarLead: async (id) => ok(await tabla('leads').delete().eq('id', id)),
    notasLead: async (id) => ok(await tabla('leads_notas').select('*').eq('lead_id', id).order('creada')),
    agregarNotaLead: async (id, texto) => ok(await tabla('leads_notas').insert({ lead_id: id, texto }).select().single()),
    leadAProspecto: async (id, cita = null, meet = '') => ok(await sb.rpc('lead_a_prospecto', { lid: id, cita, meet })),

    bitacora: async () => ok(await tabla('bitacora').select('*').order('cuando', { ascending: false }).limit(200)),

    ordenar: async (texto) => (await funcion('ordenar', { texto })).ficha,
  }
}
