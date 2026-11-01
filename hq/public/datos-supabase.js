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
  'id,origen,canal,fuente,nombre,empresa,telefono,correo,ciudad,pais,idioma,servicio,permiso_llamada,estado,motivo,llamada_inicio,llamada_seg,resumen,prospecto_id,asignado,traduccion,anuncio_id,creado,actualizado'

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
    llamarLead: (id) => funcion('nex-llamar', { id }),
    traducirLead: async (id) => (await funcion('traducir', { id })).traduccion,
    leadAProspecto: async (id, cita = null, meet = '') => ok(await sb.rpc('lead_a_prospecto', { lid: id, cita, meet })),

    // Propuestas (del prospecto) y contratos (del cliente) en PDF, en el almacenamiento privado "documentos".
    documentos: async ({ prospecto_id, cliente_id }) => {
      let q = tabla('documentos').select('*').order('creado', { ascending: false })
      q = prospecto_id ? q.eq('prospecto_id', prospecto_id) : q.eq('cliente_id', cliente_id)
      return ok(await q)
    },
    async subirDocumento({ tipo, prospecto_id, cliente_id }, file) {
      const ruta = `${tipo === 'propuesta' ? 'propuestas' : 'contratos'}/${prospecto_id || cliente_id}/${crypto.randomUUID()}.pdf`
      ok(await sb.storage.from('documentos').upload(ruta, file, { contentType: 'application/pdf', upsert: false }))
      const fila = { tipo, nombre: file.name.slice(0, 200), ruta, tamano: file.size, ...(prospecto_id ? { prospecto_id } : { cliente_id }) }
      try {
        return ok(await tabla('documentos').insert(fila).select().single())
      } catch (err) {
        await sb.storage.from('documentos').remove([ruta])
        throw err
      }
    },
    async abrirDocumento(d) {
      const { data, error } = await sb.storage.from('documentos').createSignedUrl(d.ruta, 60 * 10)
      if (error) throw claro(error)
      return data.signedUrl
    },
    async borrarDocumento(d) {
      ok(await tabla('documentos').delete().eq('id', d.id))
      await sb.storage.from('documentos').remove([d.ruta])
    },

    // Contenido y anuncios (solo el admin).
    contenido: async () => ok(await tabla('contenido').select('*').order('publicar_en', { ascending: true, nullsFirst: false })),
    guardarContenido: (c) => guardar('contenido', c),
    /** Una foto o video de Eduardo: se guarda en "contenido" y queda aprobado. */
    redactarContenido: (id) => funcion('redactar', { id }),
    /** Preparar, lanzar o pausar los anuncios de un mercado (corre en segundo plano en Netlify). */
    async accionAnuncios(accion, mercado) {
      const { data } = await sb.auth.getSession()
      const res = await fetch('/.netlify/functions/anuncios-background', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${data?.session?.access_token ?? ''}` },
        body: JSON.stringify({ accion, mercado }),
      })
      if (!res.ok && res.status !== 202) throw new Error(`No se pudo iniciar (${res.status})`)
      return true
    },
    probarMeta: () => funcion('meta-prueba', {}).catch((err) => ({ ok: false, resultados: [{ nombre: 'Llave', ok: false, error: err.message }] })),
    async subirContenido(file, fila) {
      const ext = (file.name.split('.').pop() || '').toLowerCase().replace('jpeg', 'jpg')
      const ruta = `propios/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
      ok(await sb.storage.from('contenido').upload(ruta, file, { contentType: file.type, upsert: false }))
      try {
        return ok(await tabla('contenido').insert({ ...fila, archivo: ruta }).select().single())
      } catch (err) {
        await sb.storage.from('contenido').remove([ruta])
        throw err
      }
    },
    async borrarContenido(c) {
      ok(await tabla('contenido').delete().eq('id', c.id))
      if (c.archivo) await sb.storage.from('contenido').remove([c.archivo])
    },
    /** Links temporales para ver las fotos y videos: { ruta: url }. */
    async mediaUrls(rutas) {
      const r = [...new Set(rutas.filter(Boolean))]
      if (!r.length) return {}
      const { data } = await sb.storage.from('contenido').createSignedUrls(r, 60 * 60)
      return Object.fromEntries((data ?? []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]))
    },
    anuncios: async () => ok(await tabla('anuncios').select('*').order('creado', { ascending: false })),
    gastoAnuncios: async (desde) => ok(await tabla('anuncios_gasto').select('*').gte('dia', desde)),
    topesAnuncios: async () => ok(await tabla('anuncios_topes').select('*').order('mercado', { ascending: false })),
    guardarTope: (t) => guardar('anuncios_topes', t, 'mercado'),
    reportesAnuncios: async () => ok(await tabla('anuncios_reportes').select('*').order('semana', { ascending: false }).limit(20)),

    bitacora: async () => ok(await tabla('bitacora').select('*').order('cuando', { ascending: false }).limit(200)),

    ordenar: async (texto) => (await funcion('ordenar', { texto })).ficha,
  }
}
