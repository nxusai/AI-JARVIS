// Los datos de verdad, en Supabase. Quién ve y toca qué lo cuida la base de
// datos (supabase/esquema.sql); si algo no se permite, aquí solo llega el
// error y se le enseña a la persona en palabras.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm'

/** Los errores de la base de datos, en palabras. */
function claro(error) {
  const m = error?.message || String(error)
  if (/Invalid login credentials/i.test(m)) return new Error('Usuario o contraseña incorrectos')
  if (/same.*password|different from the old/i.test(m)) return new Error('Escribe una contraseña distinta a la que tienes')
  if (/row-level security|violates row-level|permission denied/i.test(m)) return new Error('No tienes permiso para hacer eso')
  if (/jornadas_una_abierta/i.test(m)) return new Error('Ya hay una entrada abierta (sin salida) para esa persona')
  if (/duplicate key.*perfiles_codigo/i.test(m)) return new Error('Ese código de link ya lo tiene otra persona')
  if (/Failed to fetch|NetworkError/i.test(m)) return new Error('Sin conexión. Revisa tu internet e intenta otra vez.')
  return new Error(m)
}
// Supabase pide mínimo 6 caracteres; para que la contraseña pueda ser cualquiera, se guarda con este
// final fijo (igual que en netlify/functions/usuarios.mjs). Las cuentas de antes entran sin él.
const envolver = (clave) => `${clave}#nxus-hq`

const ok = ({ data, error }) => {
  if (error) throw claro(error)
  return data
}

const LEAD_LISTA =
  'id,origen,canal,fuente,nombre,empresa,telefono,correo,ciudad,pais,idioma,servicio,permiso_llamada,estado,motivo,llamada_inicio,llamada_seg,resumen,prospecto_id,asignado,traduccion,anuncio_id,creado,actualizado'
// Lo nuevo de las llamadas (si todavía no se corre el SQL, la lista sale sin esto en vez de fallar).
const LEAD_LLAMADA = ',llamada_error,intentos'

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
    /** Con su usuario (juan.perez) o, quien ya lo tenía, con su correo. */
    async entrar(correo, clave) {
      const u = correo.trim().toLowerCase()
      const email = u.includes('@') ? u : `${u.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '')}@equipo.nxusai.org`
      const r = await sb.auth.signInWithPassword({ email, password: envolver(clave) })
      // Las cuentas creadas antes (como la de Eduardo) tienen la contraseña tal cual.
      if (r.error) ok(await sb.auth.signInWithPassword({ email, password: clave }))
      return this.sesion()
    },
    async salir() {
      await sb.auth.signOut()
    },
    async olvide(correo) {
      ok(await sb.auth.resetPasswordForEmail(correo.trim().toLowerCase(), { redirectTo: location.origin }))
    },
    async nuevaClave(clave) {
      ok(await sb.auth.updateUser({ password: envolver(clave) }))
    },
    /** Cambiar mi propia contraseña (y que ya no se me pida al entrar). */
    async miClave(clave) {
      if (!clave) throw new Error('Escribe tu contraseña nueva')
      ok(await sb.auth.updateUser({ password: envolver(clave) }))
      await sb.rpc('ya_cambie_mi_clave')
      return true
    },
    alCambiarSesion(fn) {
      sb.auth.onAuthStateChange((evento) => fn(evento))
    },

    personas: async () => ok(await tabla('perfiles').select('*').order('creado')),
    guardarPersona: (p) => guardar('perfiles', p),
    crearPersona: (p) => funcion('usuarios', { accion: 'crear', ...p }),
    claveDe: (id, clave, enviar = false) => funcion('usuarios', { accion: 'clave', id, clave, enviar }),
    probarCorreo: () => funcion('usuarios', { accion: 'probar' }),
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
      ok(await tabla('jornadas').select('*').gte('entrada', desde.toISOString()).lt('entrada', hasta.toISOString()).order('entrada', { ascending: false }).limit(10000)),
    abiertas: async () => ok(await tabla('jornadas').select('*').is('salida', null)),
    marcarEntrada: async (persona) => ok(await tabla('jornadas').insert(persona ? { persona } : {}).select().single()),
    marcarSalida: async (id) => ok(await tabla('jornadas').update({ salida: new Date().toISOString() }).eq('id', id).select().single()),
    // Solo el admin (lo hace cumplir la base de datos). Queda en la Bitácora.
    corregirJornada: async (id, c) => ok(await tabla('jornadas').update({ entrada: c.entrada, salida: c.salida, nota: c.nota }).eq('id', id).select().single()),
    registrarJornada: async (c) => ok(await tabla('jornadas').insert({ persona: c.persona, entrada: c.entrada, salida: c.salida, nota: c.nota }).select().single()),
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
    async leads() {
      const r = await tabla('leads').select(LEAD_LISTA + LEAD_LLAMADA).order('creado', { ascending: false })
      if (r.error && /llamada_error|intentos/.test(r.error.message)) return ok(await tabla('leads').select(LEAD_LISTA).order('creado', { ascending: false }))
      return ok(r)
    },
    lead: async (id) => ok(await tabla('leads').select('*').eq('id', id).maybeSingle()),
    guardarLead: (l) => guardar('leads', l),
    borrarLead: async (id) => ok(await tabla('leads').delete().eq('id', id)),
    notasLead: async (id) => ok(await tabla('leads_notas').select('*').eq('lead_id', id).order('creada')),
    agregarNotaLead: async (id, texto) => ok(await tabla('leads_notas').insert({ lead_id: id, texto }).select().single()),
    llamarLead: (id) => funcion('nex-llamar', { id }),
    /** Cómo va la llamada de NEX en este momento: { estado, llamada, seg, texto, terminado }. */
    estadoLlamada: (id) => funcion('nex-estado', { id }),
    traducirLead: async (id) => (await funcion('traducir', { id })).traduccion,
    metaAnuncios: () => funcion('anuncios', {}),
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
      return true
    },

    // Mis pendientes, metas y hábitos (solo el admin: lo cuida la base de datos).
    pendientes: async () => ok(await tabla('pendientes').select('*').order('fecha', { ascending: true, nullsFirst: false }).order('hora', { ascending: true, nullsFirst: false }).limit(1000)),
    guardarPendiente: (p) => guardar('pendientes', p),
    async borrarPendiente(id) {
      ok(await tabla('pendientes').delete().eq('id', id))
      return true
    },
    /** Lo que escribió o dictó → la IA lo separa y ordena (área, fecha, hora, prioridad) y lo guarda. */
    entenderPendientes: (texto) => funcion('pendientes', { accion: 'entender', texto }),
    metas: async () => ok(await tabla('metas').select('*').order('creado')),
    guardarMeta: (m) => guardar('metas', m),
    async borrarMeta(id) {
      ok(await tabla('metas').delete().eq('id', id))
      return true
    },
    habitos: async () => ok(await tabla('habitos').select('*').order('creado')),
    guardarHabito: (x) => guardar('habitos', x),
    habitosDias: async (desde) => ok(await tabla('habitos_dias').select('*').gte('dia', desde)),
    async marcarHabito(habito_id, dia, hecho) {
      if (hecho) ok(await tabla('habitos_dias').upsert({ habito_id, dia }, { onConflict: 'habito_id,dia', ignoreDuplicates: true }))
      else ok(await tabla('habitos_dias').delete().eq('habito_id', habito_id).eq('dia', dia))
      return true
    },

    bitacora: async () => ok(await tabla('bitacora').select('*').order('cuando', { ascending: false }).limit(500)),

    // Finanzas (quién ve y cambia qué lo cuida la base de datos con los permisos).
    cobros: async () => ok(await tabla('cobros').select('*').order('fecha', { ascending: false }).limit(5000)),
    guardarCobro: (c) => guardar('cobros', c),
    async borrarCobro(id) {
      ok(await tabla('cobros').delete().eq('id', id))
      return true
    },
    cobrosOmitidos: async () => ok(await tabla('cobros_omitidos').select('*')),
    omitirCobro: async (o) => ok(await tabla('cobros_omitidos').upsert(o, { onConflict: 'cliente_id,fecha' }).select().single()),
    gastos: async () => ok(await tabla('gastos').select('*').order('concepto')),
    guardarGasto: (g) => guardar('gastos', g),
    async borrarGasto(id) {
      ok(await tabla('gastos').delete().eq('id', id))
      return true
    },
    finanzasConfig: async () => ok(await tabla('finanzas_config').select('*').eq('id', 1).maybeSingle()),
    guardarFinanzasConfig: async (c) => ok(await tabla('finanzas_config').update(c).eq('id', 1).select().single()),
    cuentas: async () => ok(await tabla('cuentas').select('*').order('orden').order('creado')),
    guardarCuenta: (c) => guardar('cuentas', c),
    async borrarCuenta(id) {
      ok(await tabla('cuentas').delete().eq('id', id))
      return true
    },
    traspasos: async () => ok(await tabla('traspasos').select('*').order('fecha', { ascending: false }).limit(2000)),
    guardarTraspaso: (t) => guardar('traspasos', t),
    async borrarTraspaso(id) {
      ok(await tabla('traspasos').delete().eq('id', id))
      return true
    },
    aportes: async () => ok(await tabla('metas_aportes').select('*').order('fecha', { ascending: false })),
    guardarAporte: (a) => guardar('metas_aportes', a),
    async borrarAporte(id) {
      ok(await tabla('metas_aportes').delete().eq('id', id))
      return true
    },

    ordenar: async (texto) => (await funcion('ordenar', { texto })).ficha,
  }
}
