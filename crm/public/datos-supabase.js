// Los datos de verdad, en Supabase. Las reglas de quién ve y toca qué las
// cuida la base de datos (supabase/esquema.sql); si algo no se permite, aquí
// solo llega el error y se le enseña a la persona en palabras.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm'

const BUCKET = 'archivos'

/** Un nombre de archivo que el almacenamiento acepta (sin acentos ni signos raros). */
function nombreSeguro(nombre) {
  const limpio = String(nombre)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return limpio.slice(-120) || 'archivo'
}

/** Los errores de la base de datos, en palabras. */
function claro(error) {
  const m = error?.message || String(error)
  if (/Invalid login credentials/i.test(m)) return new Error('Correo o contraseña incorrectos')
  if (/row-level security|violates row-level|permission denied/i.test(m)) return new Error('No tienes permiso para hacer eso')
  if (/duplicate key.*carpetas/i.test(m)) return new Error('Ya hay una carpeta con ese nombre aquí')
  if (/carpetas.*foreign key|violates foreign key constraint .*carpeta/i.test(m)) return new Error('Solo se borran carpetas vacías')
  if (/exceeded the maximum allowed size|Payload too large|413/i.test(m)) return new Error('El archivo es muy pesado (máximo 50 MB)')
  if (/Failed to fetch|NetworkError/i.test(m)) return new Error('Sin conexión. Revisa tu internet e intenta otra vez.')
  return new Error(m)
}
const ok = ({ data, error }) => {
  if (error) throw claro(error)
  return data
}

export function crearSupabase({ url, anon }) {
  const sb = createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } })
  let yo = null

  async function miPerfil() {
    const { data } = await sb.auth.getUser()
    if (!data?.user) return null
    const p = ok(await sb.from('perfiles').select('*').eq('id', data.user.id).maybeSingle())
    if (!p || !p.activo) {
      await sb.auth.signOut()
      throw new Error('Tu acceso está apagado. Pídeselo a tu administrador.')
    }
    yo = p
    return p
  }

  async function subir(carpeta, file) {
    const ruta = `${carpeta}/${crypto.randomUUID()}-${nombreSeguro(file.name)}`
    ok(await sb.storage.from(BUCKET).upload(ruta, file, { contentType: file.type || 'application/octet-stream', upsert: false }))
    return { ruta, tamano: file.size, tipo_mime: file.type || '' }
  }

  /** Borra del almacenamiento los archivos que ya ninguna ficha usa. */
  async function limpiar(rutas) {
    for (const ruta of new Set(rutas)) {
      const otros = await sb.from('archivos').select('id').eq('ruta', ruta).limit(1)
      if (!otros.error && !otros.data.length) await sb.storage.from(BUCKET).remove([ruta])
    }
  }

  async function token() {
    const { data } = await sb.auth.getSession()
    if (!data?.session) throw new Error('Tu sesión se cerró. Vuelve a entrar.')
    return data.session.access_token
  }

  async function funcion(nombre, cuerpo) {
    const res = await fetch(`/.netlify/functions/${nombre}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
      body: JSON.stringify(cuerpo),
    })
    const r = await res.json().catch(() => ({}))
    if (!res.ok || r.ok === false) throw new Error(r.error || 'No se pudo')
    return r
  }

  return {
    async sesion() {
      return miPerfil()
    },
    async entrar(correo, clave) {
      ok(await sb.auth.signInWithPassword({ email: correo, password: clave }))
      return miPerfil()
    },
    async salir() {
      await sb.auth.signOut()
      yo = null
    },
    async empresas() {
      return ok(await sb.from('empresas').select('*').order('orden'))
    },
    async clientes() {
      return ok(await sb.from('perfiles').select('id, nombre').eq('rol', 'cliente').order('nombre'))
    },
    async tareas() {
      const [tareas, correcciones, archivos, notas] = await Promise.all([
        sb.from('tareas').select('*').order('pedida', { ascending: false }).limit(5000).then(ok),
        sb.from('correcciones').select('*').limit(10000).then(ok),
        sb.from('archivos').select('*').in('tipo', ['referencia', 'entrega']).limit(20000).then(ok),
        sb.from('notas').select('*').order('creada').limit(20000).then(ok),
      ])
      return tareas.map((t) => ({
        ...t,
        correcciones: correcciones.filter((c) => c.tarea_id === t.id),
        archivos: archivos.filter((a) => a.tarea_id === t.id),
        notas: notas.filter((n) => n.tarea_id === t.id),
      }))
    },
    async pedir({ cliente_id, empresa_id, titulo, descripcion, urgente, archivos }) {
      if (!empresa_id) throw new Error('Elige la empresa')
      if (!titulo) throw new Error('Escribe qué necesitas')
      const t = ok(await sb.from('tareas').insert({ cliente_id, empresa_id, titulo, descripcion, urgente }).select().single())
      for (const f of archivos ?? []) {
        const s = await subir(`ref/${yo.id}/${t.id}`, f)
        ok(await sb.from('archivos').insert({ tipo: 'referencia', empresa_id, tarea_id: t.id, nombre: f.name, ...s }))
      }
      return t
    },
    async agregarNota(tarea, texto, archivos = []) {
      if (!texto && !archivos.length) throw new Error('Escribe las instrucciones nuevas o adjunta un archivo')
      const n = ok(await sb.from('notas').insert({ tarea_id: tarea.id, texto }).select().single())
      for (const f of archivos) {
        const s = await subir(`ref/${yo.id}/${tarea.id}`, f)
        ok(await sb.from('archivos').insert({ tipo: 'referencia', empresa_id: tarea.empresa_id, tarea_id: tarea.id, nota_id: n.id, nombre: f.name, ...s }))
      }
    },
    async borrarTarea(t) {
      const rutas = t.archivos.map((a) => a.ruta)
      ok(await sb.from('tareas').delete().eq('id', t.id))
      await limpiar(rutas)
    },
    async borrarCorreccion(c, archivos) {
      ok(await sb.from('correcciones').delete().eq('id', c.id))
      await limpiar(archivos.map((a) => a.ruta))
    },
    async borrarNota(n, archivos) {
      ok(await sb.from('notas').delete().eq('id', n.id))
      await limpiar(archivos.map((a) => a.ruta))
    },
    async cambiarTarea(id, cambios) {
      ok(await sb.from('tareas').update(cambios).eq('id', id))
    },
    async subirEntrega(tarea, correccion_id, file) {
      const s = await subir(`tareas/${tarea.id}`, file)
      ok(await sb.from('archivos').insert({ tipo: 'entrega', empresa_id: tarea.empresa_id, tarea_id: tarea.id, correccion_id, nombre: file.name, ...s }))
    },
    async corregir(tarea_id, instrucciones) {
      if (!instrucciones) throw new Error('Escribe qué hay que corregir')
      ok(await sb.from('correcciones').insert({ tarea_id, instrucciones, n: 0 }))
    },
    async cambiarCorreccion(id, cambios) {
      ok(await sb.from('correcciones').update(cambios).eq('id', id))
    },
    async aprobar(tarea_id) {
      ok(await sb.rpc('aprobar', { p_tarea: tarea_id }))
    },
    async carpetas() {
      return ok(await sb.from('carpetas').select('*').limit(10000))
    },
    async crearCarpeta({ empresa_id, padre_id, nombre }) {
      ok(await sb.from('carpetas').insert({ empresa_id, padre_id: padre_id ?? null, nombre }))
    },
    async renombrarCarpeta(id, nombre) {
      ok(await sb.from('carpetas').update({ nombre }).eq('id', id))
    },
    async borrarCarpeta(id) {
      ok(await sb.from('carpetas').delete().eq('id', id))
    },
    async biblioteca() {
      return ok(await sb.from('archivos').select('*').eq('tipo', 'biblioteca').limit(20000))
    },
    async subirBiblioteca({ empresa_id, carpeta_id, file, anterior_id }) {
      const s = await subir(`biblioteca/${empresa_id}`, file)
      ok(await sb.from('archivos').insert({ tipo: 'biblioteca', empresa_id, carpeta_id: carpeta_id ?? null, anterior_id: anterior_id ?? null, nombre: file.name, ...s }))
    },
    async cambiarArchivo(id, cambios) {
      ok(await sb.from('archivos').update(cambios).eq('id', id))
    },
    async guardarEnBiblioteca(a, { carpeta_id, nombre, empresa_id }) {
      ok(await sb.from('archivos').insert({ tipo: 'biblioteca', empresa_id, carpeta_id, nombre, ruta: a.ruta, tamano: a.tamano, tipo_mime: a.tipo_mime }))
    },
    async borrarArchivo(a) {
      ok(await sb.from('archivos').delete().eq('id', a.id))
      // El archivo de verdad solo se borra si ya nadie lo usa (una entrega
      // guardada en la biblioteca comparte el mismo archivo).
      await limpiar([a.ruta])
    },
    async catalogos() {
      return ok(await sb.from('archivos').select('*').eq('tipo', 'catalogo').limit(5000))
    },
    // La parrilla de contenidos de las vendedoras (los candados: supabase/esquema.sql).
    async contenidos() {
      return ok(await sb.from('contenidos').select('*').order('fecha').order('hora', { nullsFirst: true }).limit(5000))
    },
    async guardarContenido({ id, ...c }) {
      if (id) return ok(await sb.from('contenidos').update(c).eq('id', id).select().single())
      return ok(await sb.from('contenidos').insert(c).select().single())
    },
    async borrarContenido(id) {
      ok(await sb.from('contenidos').delete().eq('id', id))
    },
    async subirCatalogo({ empresa_id, file, anterior_id }) {
      const s = await subir(`catalogos/${empresa_id}`, file)
      ok(await sb.from('archivos').insert({ tipo: 'catalogo', empresa_id, anterior_id: anterior_id ?? null, nombre: file.name, ...s }))
    },
    async url(a, { descargar = false } = {}) {
      const r = ok(await sb.storage.from(BUCKET).createSignedUrl(a.ruta, 3600, descargar ? { download: a.nombre } : undefined))
      return r.signedUrl
    },
    async correo(a) {
      return funcion('correo', { archivo: a.id })
    },
    anotar(accion, id) {
      sb.rpc('anotar', { p_accion: accion, p_archivo: id }).then(
        () => {},
        () => {},
      )
    },
    async usuarios() {
      return ok(await sb.from('perfiles').select('*').order('nombre'))
    },
    async crearUsuario(datos) {
      await funcion('usuarios', { accion: 'crear', ...datos })
    },
    async cambiarUsuario(id, datos) {
      ok(await sb.from('perfiles').update(datos).eq('id', id))
    },
    async cambiarClave(id, clave) {
      await funcion('usuarios', { accion: 'clave', id, clave })
    },
    async cambiarEmpresa(id, cambios) {
      ok(await sb.from('empresas').update(cambios).eq('id', id))
    },
    // Ultron: la pregunta va a su buzón; él (en su computadora) contesta ahí.
    async ultron(texto, canal = 'crm') {
      const m = ok(await sb.from('ultron_mensajes').insert({ canal, pregunta: texto, persona: yo.id }).select('id').single())
      const hasta = Date.now() + 120_000
      while (Date.now() < hasta) {
        await new Promise((r) => setTimeout(r, 1200))
        const r = ok(await sb.from('ultron_mensajes').select('estado, respuesta, acciones, voz').eq('id', m.id).single())
        if (r.estado === 'listo' || r.estado === 'error') {
          let voz = null
          if (r.voz) {
            const v = await sb.storage.from('ultron').createSignedUrl(r.voz, 3600)
            voz = v.data?.signedUrl ?? null
          }
          return { texto: r.respuesta || 'Listo.', acciones: r.acciones ?? [], voz }
        }
      }
      return { texto: 'Ultron está dormido en este momento (su computadora no responde). Intenta en un rato.', acciones: [] }
    },
    async bitacora() {
      return ok(await sb.from('bitacora').select('*').order('cuando', { ascending: false }).limit(300))
    },
  }
}
