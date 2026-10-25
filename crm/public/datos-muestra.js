// La muestra: los mismos datos y las mismas reglas que la base de datos real
// (supabase/esquema.sql), pero en la memoria del navegador, con ejemplos.
// Nada sale a internet y al recargar la página vuelve a empezar.

const EMPRESAS = [
  { id: 'abuelito-cheese', nombre: 'Abuelito Cheese', grupo: 'Abuelito INC', orden: 1, activa: true },
  { id: 'abuelito-meat', nombre: 'Abuelito Meat', grupo: 'Abuelito INC', orden: 2, activa: true },
  { id: 'abuelito-corn', nombre: 'Abuelito Corn', grupo: 'Abuelito INC', orden: 3, activa: true },
  { id: 'mi-semago', nombre: 'Mi Semago', grupo: null, orden: 4, activa: true },
  { id: 'vayro', nombre: 'VAYRO', grupo: null, orden: 5, activa: false },
]

const PERSONAS = [
  { id: 'u-senen', nombre: 'Senen', correo: 'senen@ejemplo.com', rol: 'cliente', explica: 'Cliente (dueño): pide sus tareas, corrige, aprueba · tiene a Ultron' },
  { id: 'u-gerardo', nombre: 'Gerardo', correo: 'gerardo@ejemplo.com', rol: 'cliente', explica: 'Cliente (gerente): sus propias tareas, no ve las de Senen · tiene a Ultron' },
  { id: 'u-marisol', nombre: 'Marisol', correo: 'marisol@ejemplo.com', rol: 'cliente', explica: 'Cabeza (puesto por definir): habla con Ultron' },
  { id: 'u-miguel', nombre: 'Miguel', correo: 'miguel@ejemplo.com', rol: 'cliente', explica: 'Cabeza (puesto por definir): habla con Ultron' },
  { id: 'u-equipo1', nombre: 'Diseñador 1', correo: 'equipo1@ejemplo.com', rol: 'equipo', explica: 'Tu equipo: ve todo, mueve estatus, sube PDFs' },
  { id: 'u-admin', nombre: 'Eduardo', correo: 'admin@ejemplo.com', rol: 'admin', explica: 'Tú (admin): todo, más usuarios y bitácora' },
]

let n = 0
const uid = () => `m-${(++n).toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const ahora = () => new Date().toISOString()
const copia = (x) => structuredClone(x)
const sinTilde = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms))

/** Un PDF de una página con unas líneas de texto, para que "Ver" abra algo. */
function pdf(lineas) {
  const limpio = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[()\\]/g, '')
  const texto = lineas.map((l, i) => `BT /F1 ${i === 0 ? 22 : 13} Tf 60 ${740 - i * 30} Td (${limpio(l)}) Tj ET`).join('\n')
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${texto.length} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const pos = []
  objetos.forEach((o, i) => {
    pos.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([out], { type: 'application/pdf' })
}

function logo(nombre, colorFondo) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" rx="24" fill="${colorFondo}"/><text x="200" y="118" font-family="Arial" font-size="40" font-weight="700" fill="#fff" text-anchor="middle">${nombre}</text></svg>`
  return new Blob([svg], { type: 'image/svg+xml' })
}

export function crearMuestra() {
  const db = { empresas: copia(EMPRESAS), perfiles: [], tareas: [], correcciones: [], notas: [], carpetas: [], archivos: [], bitacora: [], contenidos: [] }
  {
    // Una parrilla de ejemplo para este mes.
    const d = (n) => {
      const x = new Date()
      x.setDate(x.getDate() + n)
      return x.toISOString().slice(0, 10)
    }
    const c = (dia, empresa_id, canal, titulo, texto, hora, estado = 'listo') =>
      db.contenidos.push({ id: uid(), empresa_id, fecha: d(dia), hora, canal, titulo, texto, enlace: '', estado, enviado: estado === 'enviado' ? ahora() : null, creado_por: 'u-equipo1', creada: ahora(), actualizada: ahora() })
    c(-3, 'mi-semago', 'whatsapp', 'Lista de precios de la semana', 'Buen día. Les comparto los quesos disponibles esta semana. Pedidos antes del jueves para entrega el viernes.', '09:00', 'enviado')
    c(-1, 'abuelito-cheese', 'estado', 'Receta: pupusas con quesillo', 'Hoy en casa: pupusas con quesillo Abuelito. ¿Ya lo probaste? Pídelo con tu vendedora.', '11:00', 'enviado')
    c(0, 'abuelito-meat', 'instagram', 'Chorizo salvadoreño estilo casero', 'Nuevo empaque, mismo sabor de siempre. Disponible con tu distribuidor.', '10:00')
    c(1, 'mi-semago', 'whatsapp', 'Promo cliente nuevo', 'Si tu tienda es nueva con nosotros, el primer pedido lleva 10% de descuento en quesos frescos.', '09:30')
    c(3, 'abuelito-corn', 'estado', 'Tortillas recién hechas', 'Tortillas de maíz Abuelito, recién salidas. Pregunta por el paquete de 30.', '12:00', 'borrador')
    c(6, 'abuelito-cheese', 'facebook', 'Queso fresco para el fin de semana', '¿Carne asada este fin? No olvides el queso fresco Abuelito.', '17:00', 'borrador')
  }
  const blobs = new Map()
  let yo = null
  let folio = 0

  const CABEZAS = ['u-senen', 'u-gerardo', 'u-marisol', 'u-miguel']
  for (const p of PERSONAS) db.perfiles.push({ id: p.id, nombre: p.nombre, correo: p.correo, rol: p.rol, activo: true, empresas: null, ve_tareas: true, ve_biblioteca: true, ve_catalogos: true, ultron: CABEZAS.includes(p.id) })
  db.perfiles.push({ id: 'u-equipo2', nombre: 'Diseñador 2', correo: 'equipo2@ejemplo.com', rol: 'equipo', activo: true, empresas: null, ve_tareas: true, ve_biblioteca: true, ve_catalogos: true })

  // -- reglas (las mismas que la base de datos) --------------------------------
  const perfil = () => db.perfiles.find((p) => p.id === yo && p.activo)
  const rol = () => perfil()?.rol
  const equipo = () => ['admin', 'equipo'].includes(rol())
  const admin = () => rol() === 'admin'
  const veo = (seccion, empresa) => {
    const p = perfil()
    if (!p) return false
    if (equipo()) return true
    return (!p.empresas || p.empresas.includes(empresa)) && p[`ve_${seccion}`]
  }
  const veoTarea = (t) => equipo() || (t.cliente_id === yo && veo('tareas', t.empresa_id))
  const veoArchivo = (a) =>
    a.tipo === 'biblioteca'
      ? veo('biblioteca', a.empresa_id)
      : a.tipo === 'catalogo'
        ? veo('catalogos', a.empresa_id)
        : a.tipo === 'contenido'
          ? Boolean(perfil()) && (equipo() || !perfil().empresas || perfil().empresas.includes(a.empresa_id))
          : veoTarea(db.tareas.find((t) => t.id === a.tarea_id) ?? {})
  const no = (m) => {
    throw new Error(m)
  }
  const anota = (accion, tabla, fila, detalle = {}) => db.bitacora.unshift({ id: db.bitacora.length + 1, cuando: ahora(), quien: yo, accion, tabla, fila, detalle })

  function guardarBlob(blob) {
    const ruta = `m/${uid()}`
    blobs.set(ruta, blob)
    return ruta
  }

  function nuevoArchivo(campos, blob, cuando) {
    const a = {
      id: uid(),
      tipo: campos.tipo,
      empresa_id: campos.empresa_id,
      tarea_id: campos.tarea_id ?? null,
      correccion_id: campos.correccion_id ?? null,
      nota_id: campos.nota_id ?? null,
      contenido_id: campos.contenido_id ?? null,
      carpeta_id: campos.carpeta_id ?? null,
      nombre: campos.nombre,
      ruta: campos.ruta ?? guardarBlob(blob),
      tamano: campos.tamano ?? blob?.size ?? 0,
      tipo_mime: campos.tipo_mime ?? blob?.type ?? '',
      subido: cuando ?? ahora(),
      subido_por: yo,
      anterior_id: campos.anterior_id ?? null,
      vigente: true,
      notas: campos.notas ?? '',
    }
    if (a.anterior_id) {
      const prev = db.archivos.find((x) => x.id === a.anterior_id)
      a.empresa_id = prev.empresa_id
      a.carpeta_id = prev.carpeta_id
      prev.vigente = false
    }
    if (a.tipo === 'entrega' || a.tipo === 'referencia') {
      const t = db.tareas.find((x) => x.id === a.tarea_id)
      a.empresa_id = t.empresa_id
    }
    db.archivos.push(a)
    if (a.tipo === 'entrega') {
      const t = db.tareas.find((x) => x.id === a.tarea_id)
      if (a.correccion_id) {
        const c = db.correcciones.find((x) => x.id === a.correccion_id)
        c.estatus = 'entregada'
        c.entregada = a.subido
      }
      t.entregada = a.subido
      if (t.estatus !== 'aprobada') t.estatus = db.correcciones.some((c) => c.tarea_id === t.id && c.estatus !== 'entregada') ? 'en-correccion' : 'entregada'
    }
    anota('creó', 'archivos', a.id, { nombre: a.nombre, tipo: a.tipo })
    return a
  }

  // -- ejemplos ----------------------------------------------------------------
  const hace = (dias, hora = 10) => {
    const d = new Date()
    d.setDate(d.getDate() - dias)
    d.setHours(hora, 15, 0, 0)
    return d.toISOString()
  }
  const dia = (dias) => hace(dias).slice(0, 10)

  function ejemplo(cliente, empresa_id, titulo, descripcion, { dias, urgente = false, estatus = 'recibida', compromiso = null, entregas = [], correcciones = [], aprobada = null }) {
    yo = cliente
    const t = { id: uid(), folio: ++folio, cliente_id: cliente, empresa_id, titulo, descripcion, urgente, pedida: hace(dias, 9), creada_por: cliente, estatus, compromiso, entregada: null, aprobada: null, actualizada: hace(dias) }
    db.tareas.push(t)
    yo = 'u-equipo1'
    for (const [d, nombre] of entregas) nuevoArchivo({ tipo: 'entrega', tarea_id: t.id, nombre }, pdf([titulo, empresa_id.replace('-', ' ').toUpperCase(), 'Entrega original', '(archivo de ejemplo)']), hace(d, 16))
    for (const c of correcciones) {
      const cor = { id: uid(), tarea_id: t.id, n: db.correcciones.filter((x) => x.tarea_id === t.id).length + 1, instrucciones: c.texto, pedida: hace(c.dias, 11), pedida_por: cliente, estatus: 'pedida', entregada: null }
      db.correcciones.push(cor)
      if (t.estatus !== 'aprobada') t.estatus = 'en-correccion'
      if (c.estatus) cor.estatus = c.estatus
      if (c.entrega) nuevoArchivo({ tipo: 'entrega', tarea_id: t.id, correccion_id: cor.id, nombre: c.entrega[1] }, pdf([titulo, `Correccion ${cor.n}`, c.texto, '(archivo de ejemplo)']), hace(c.entrega[0], 17))
    }
    if (aprobada !== null) {
      t.estatus = 'aprobada'
      t.aprobada = hace(aprobada, 12)
    } else if (estatus !== 'recibida' && !entregas.length) t.estatus = estatus
    yo = null
    return t
  }

  ejemplo('u-senen', 'abuelito-corn', 'Label pupusas de frijol 12 oz', 'Label frontal para la pupusa de frijol, presentación de 12 oz. Mismo estilo que la de queso pero en color café. Necesito la tabla nutricional en inglés.', {
    dias: 75, entregas: [[72, 'Label pupusas frijol 12oz.pdf']],
    correcciones: [{ dias: 71, texto: 'El café está muy oscuro, que se parezca más al de la foto. Y el logo más grande.', entrega: [70, 'Label pupusas frijol 12oz - correccion 1.pdf'] }], aprobada: 69,
  })
  ejemplo('u-senen', 'abuelito-cheese', 'Label quesillo 5 lb vacío', 'Actualizar el label del quesillo 5 libras empaque al vacío con la nueva dirección del almacén.', { dias: 48, entregas: [[46, 'Label quesillo 5lb vacio.pdf']], aprobada: 45 })
  ejemplo('u-senen', 'mi-semago', 'Catálogo de quesos para distribuidores', 'Catálogo con todos los quesos que distribuimos, con fotos y presentaciones. Sin precios.', {
    dias: 20, compromiso: dia(-3), entregas: [[15, 'Catalogo distribuidores v1.pdf']],
    correcciones: [
      { dias: 14, texto: 'Falta el queso duro blando y el cuajada. Cambiar la portada por una foto de producto.', entrega: [12, 'Catalogo distribuidores - correccion 1.pdf'] },
      { dias: 10, texto: 'Ya casi. Solo el teléfono de ventas está mal, es el que termina en 4410.', estatus: 'en-proceso' },
    ],
  })
  ejemplo('u-senen', 'abuelito-meat', 'Label chorizo salvadoreño 1 lb', 'Label nuevo para el chorizo salvadoreño de 1 libra. Que diga "Estilo casero".', { dias: 6, urgente: true, estatus: 'en-proceso', compromiso: dia(-2) })
  {
    const t = db.tareas.find((x) => x.titulo.startsWith('Label chorizo'))
    db.notas.push({ id: uid(), tarea_id: t.id, texto: 'Cambio: mejor que diga "Receta de la abuela" en lugar de "Estilo casero". Les mando la foto del empaque nuevo.', creada: hace(4, 13), autor: 'u-senen' })
  }
  ejemplo('u-senen', 'abuelito-cheese', 'Post de Instagram queso fresco', 'Un post para Instagram del queso fresco con receta de pupusas.', { dias: 1 })
  ejemplo('u-gerardo', 'mi-semago', 'Etiqueta de rutas de reparto', 'Etiquetas para las cajas de reparto con número de ruta y día.', { dias: 40, entregas: [[37, 'Etiquetas rutas reparto.pdf']], aprobada: 36 })
  ejemplo('u-gerardo', 'mi-semago', 'Formato de inventario semanal', 'Un formato imprimible para el inventario de cada semana en la bodega.', { dias: 9, entregas: [[5, 'Formato inventario semanal.pdf']] })
  ejemplo('u-gerardo', 'abuelito-cheese', 'Letrero de bodega', 'Letrero grande para la entrada de la bodega con el logo de Abuelito.', { dias: 3, estatus: 'en-proceso', compromiso: dia(-5) })

  // Biblioteca
  yo = 'u-equipo1'
  const carpeta = (empresa_id, nombre, padre_id = null) => {
    const c = { id: uid(), empresa_id, padre_id, nombre, creada: hace(90) }
    db.carpetas.push(c)
    return c
  }
  for (const e of ['abuelito-cheese', 'abuelito-meat', 'abuelito-corn', 'mi-semago']) {
    const cs = Object.fromEntries(['Labels', 'Logotipos', 'Diseños', 'Estructuras de label', 'Documentos'].map((nm) => [nm, carpeta(e, nm)]))
    const nom = EMPRESAS.find((x) => x.id === e).nombre
    const col = { 'abuelito-cheese': '#d99a1e', 'abuelito-meat': '#b3261e', 'abuelito-corn': '#6f8f1f', 'mi-semago': '#2b5ea7' }[e]
    nuevoArchivo({ tipo: 'biblioteca', empresa_id: e, carpeta_id: cs.Logotipos.id, nombre: `Logo ${nom}.svg` }, logo(nom, col), hace(88))
    nuevoArchivo({ tipo: 'biblioteca', empresa_id: e, carpeta_id: cs.Documentos.id, nombre: `Manual de marca ${nom}.pdf` }, pdf([`Manual de marca ${nom}`, 'Colores, tipografias y usos del logo', '(archivo de ejemplo)']), hace(80))
    nuevoArchivo({ tipo: 'biblioteca', empresa_id: e, carpeta_id: cs['Estructuras de label'].id, nombre: 'Estructura label frontal.pdf', notas: 'medidas, zonas de texto, codigo de barras' }, pdf(['Estructura de label frontal', nom, '(archivo de ejemplo)']), hace(70))
  }
  const labelsCorn = db.carpetas.find((c) => c.empresa_id === 'abuelito-corn' && c.nombre === 'Labels')
  const v1 = nuevoArchivo({ tipo: 'biblioteca', empresa_id: 'abuelito-corn', carpeta_id: labelsCorn.id, nombre: 'Label pupusas frijol 12 oz.pdf', notas: 'pupusa frijol 12oz label frontal' }, pdf(['Label pupusas frijol 12 oz', 'Version 1', '(archivo de ejemplo)']), hace(69))
  nuevoArchivo({ tipo: 'biblioteca', empresa_id: 'abuelito-corn', nombre: 'Label pupusas frijol 12 oz.pdf', anterior_id: v1.id, notas: 'pupusa frijol 12oz label frontal' }, pdf(['Label pupusas frijol 12 oz', 'Version 2 (vigente)', '(archivo de ejemplo)']), hace(30))
  nuevoArchivo({ tipo: 'biblioteca', empresa_id: 'abuelito-corn', carpeta_id: labelsCorn.id, nombre: 'Label pupusas queso 12 oz.pdf', notas: 'pupusa queso 12oz' }, pdf(['Label pupusas queso 12 oz', '(archivo de ejemplo)']), hace(60))
  const labelsCheese = db.carpetas.find((c) => c.empresa_id === 'abuelito-cheese' && c.nombre === 'Labels')
  const quesillo = carpeta('abuelito-cheese', 'Quesillo', labelsCheese.id)
  for (const p of ['5 lb regular', '5 lb vacío', '10 lb regular', '12 oz vacío']) nuevoArchivo({ tipo: 'biblioteca', empresa_id: 'abuelito-cheese', carpeta_id: quesillo.id, nombre: `Label quesillo ${p}.pdf` }, pdf([`Label quesillo ${p}`, 'Abuelito Cheese', '(archivo de ejemplo)']), hace(44))

  // Catálogos
  const c1 = nuevoArchivo({ tipo: 'catalogo', empresa_id: 'abuelito-cheese', nombre: 'Catálogo Abuelito Cheese 2025.pdf' }, pdf(['Catalogo Abuelito Cheese 2025', '(archivo de ejemplo)']), hace(300))
  nuevoArchivo({ tipo: 'catalogo', empresa_id: 'abuelito-cheese', nombre: 'Catálogo Abuelito Cheese 2026.pdf', anterior_id: c1.id }, pdf(['Catalogo Abuelito Cheese 2026', '(archivo de ejemplo)']), hace(40))
  nuevoArchivo({ tipo: 'catalogo', empresa_id: 'abuelito-meat', nombre: 'Catálogo Abuelito Meat 2026.pdf' }, pdf(['Catalogo Abuelito Meat 2026', '(archivo de ejemplo)']), hace(50))
  nuevoArchivo({ tipo: 'catalogo', empresa_id: 'mi-semago', nombre: 'Catálogo Mi Semago 2026.pdf' }, pdf(['Catalogo Mi Semago 2026', '(archivo de ejemplo)']), hace(25))
  yo = null
  db.bitacora.length = 0

  // -- la misma interfaz que datos-supabase.js ---------------------------------
  const mio = () => copia(perfil())
  return {
    personas: () => PERSONAS,
    async sesion() {
      return null
    },
    async entrar(id) {
      yo = id
      const p = perfil()
      if (!p) no('Ese acceso está apagado')
      return mio()
    },
    async salir() {
      yo = null
    },
    async empresas() {
      return perfil() ? copia(db.empresas) : []
    },
    async clientes() {
      return equipo() ? db.perfiles.filter((p) => p.rol === 'cliente').map((p) => ({ id: p.id, nombre: p.nombre })) : []
    },
    async tareas() {
      await espera()
      return db.tareas.filter(veoTarea).map((t) => ({
        ...copia(t),
        correcciones: copia(db.correcciones.filter((c) => c.tarea_id === t.id)),
        archivos: copia(db.archivos.filter((a) => a.tarea_id === t.id)),
        notas: copia(db.notas.filter((x) => x.tarea_id === t.id)),
      }))
    },
    async pedir({ cliente_id, empresa_id, titulo, descripcion, urgente, archivos }) {
      await espera(300)
      if (!empresa_id) no('Elige la empresa')
      if (!titulo) no('Escribe qué necesitas')
      if (rol() === 'cliente' ? cliente_id !== yo || !veo('tareas', empresa_id) : !(equipo() && db.perfiles.some((p) => p.id === cliente_id && p.rol === 'cliente'))) no('No tienes permiso para pedir esa tarea')
      const t = { id: uid(), folio: ++folio, cliente_id, empresa_id, titulo, descripcion, urgente, pedida: ahora(), creada_por: yo, estatus: 'recibida', compromiso: null, entregada: null, aprobada: null, actualizada: ahora() }
      db.tareas.push(t)
      anota('creó', 'tareas', t.id, { titulo })
      for (const f of archivos ?? []) nuevoArchivo({ tipo: 'referencia', tarea_id: t.id, nombre: f.name }, f)
      return copia(t)
    },
    async agregarNota(tarea, texto, archivos = []) {
      await espera(300)
      const t = db.tareas.find((x) => x.id === tarea.id)
      if (t.estatus === 'aprobada') no('La tarea ya está aprobada')
      if (!(equipo() || (rol() === 'cliente' && t.cliente_id === yo))) no('No tienes permiso para agregar aquí')
      if (!texto && !archivos.length) no('Escribe las instrucciones nuevas o adjunta un archivo')
      const n = { id: uid(), tarea_id: t.id, texto, creada: ahora(), autor: yo }
      db.notas.push(n)
      anota('creó', 'notas', n.id, { texto })
      for (const f of archivos) nuevoArchivo({ tipo: 'referencia', tarea_id: t.id, nota_id: n.id, nombre: f.name }, f)
    },
    async borrarTarea(t) {
      if (!admin()) no('Solo el admin borra')
      db.tareas = db.tareas.filter((x) => x.id !== t.id)
      db.archivos = db.archivos.filter((a) => a.tarea_id !== t.id)
      anota('borró', 'tareas', t.id, { titulo: t.titulo })
    },
    async borrarCorreccion(c) {
      if (!admin()) no('Solo el admin borra')
      db.correcciones = db.correcciones.filter((x) => x.id !== c.id)
      db.archivos = db.archivos.filter((a) => a.correccion_id !== c.id)
      anota('borró', 'correcciones', c.id, { n: c.n })
    },
    async borrarNota(n) {
      if (!admin()) no('Solo el admin borra')
      db.notas = db.notas.filter((x) => x.id !== n.id)
      db.archivos = db.archivos.filter((a) => a.nota_id !== n.id)
      anota('borró', 'notas', n.id)
    },
    async cambiarTarea(id, cambios) {
      await espera()
      if (!equipo()) no('Solo el equipo puede cambiar una tarea')
      const t = db.tareas.find((x) => x.id === id)
      if (t.estatus === 'aprobada') no('La tarea ya está aprobada')
      if (cambios.estatus === 'aprobada') no('Solo el cliente aprueba')
      const antes = {}
      for (const k of ['estatus', 'compromiso']) if (k in cambios) { antes[k] = [t[k], cambios[k]]; t[k] = cambios[k] }
      anota('cambió', 'tareas', id, antes)
    },
    async subirEntrega(tarea, correccion_id, file) {
      await espera(500)
      if (!equipo()) no('Solo el equipo sube entregas')
      nuevoArchivo({ tipo: 'entrega', tarea_id: tarea.id, correccion_id, nombre: file.name }, file)
    },
    async corregir(tarea_id, instrucciones) {
      await espera(300)
      const t = db.tareas.find((x) => x.id === tarea_id)
      if (rol() !== 'cliente' || t.cliente_id !== yo) no('Solo quien pidió la tarea puede pedir correcciones')
      if (!t.entregada || t.estatus === 'aprobada') no('Esta tarea no puede recibir correcciones')
      if (!instrucciones) no('Escribe qué hay que corregir')
      const c = { id: uid(), tarea_id, n: db.correcciones.filter((x) => x.tarea_id === tarea_id).length + 1, instrucciones, pedida: ahora(), pedida_por: yo, estatus: 'pedida', entregada: null }
      db.correcciones.push(c)
      t.estatus = 'en-correccion'
      anota('creó', 'correcciones', c.id, { n: c.n })
    },
    async cambiarCorreccion(id, { estatus }) {
      await espera()
      if (!equipo()) no('Solo el equipo puede cambiar una corrección')
      const c = db.correcciones.find((x) => x.id === id)
      anota('cambió', 'correcciones', id, { estatus: [c.estatus, estatus] })
      c.estatus = estatus
    },
    async aprobar(tarea_id) {
      await espera(300)
      const t = db.tareas.find((x) => x.id === tarea_id)
      if (rol() !== 'cliente' || t.cliente_id !== yo) no('Solo quien pidió la tarea la puede aprobar')
      if (!t.entregada) no('Todavía no hay nada entregado para aprobar')
      t.estatus = 'aprobada'
      t.aprobada = ahora()
      anota('cambió', 'tareas', t.id, { estatus: ['', 'aprobada'] })
    },
    async carpetas() {
      return copia(db.carpetas.filter((c) => veo('biblioteca', c.empresa_id)))
    },
    async crearCarpeta({ empresa_id, padre_id, nombre }) {
      if (!equipo()) no('Solo el equipo arma carpetas')
      if (db.carpetas.some((c) => c.empresa_id === empresa_id && (c.padre_id ?? null) === (padre_id ?? null) && c.nombre === nombre)) no('Ya hay una carpeta con ese nombre aquí')
      const c = { id: uid(), empresa_id, padre_id: padre_id ?? null, nombre, creada: ahora() }
      db.carpetas.push(c)
      anota('creó', 'carpetas', c.id, { nombre })
    },
    async renombrarCarpeta(id, nombre) {
      if (!equipo()) no('Solo el equipo arma carpetas')
      const c = db.carpetas.find((x) => x.id === id)
      anota('cambió', 'carpetas', id, { nombre: [c.nombre, nombre] })
      c.nombre = nombre
    },
    async borrarCarpeta(id) {
      if (!admin()) no('Solo el admin borra')
      if (db.archivos.some((a) => a.carpeta_id === id) || db.carpetas.some((c) => c.padre_id === id)) no('Solo se borran carpetas vacías')
      db.carpetas = db.carpetas.filter((c) => c.id !== id)
      anota('borró', 'carpetas', id)
    },
    async biblioteca() {
      return copia(db.archivos.filter((a) => a.tipo === 'biblioteca' && veoArchivo(a)))
    },
    async subirBiblioteca({ empresa_id, carpeta_id, file, anterior_id }) {
      await espera(400)
      if (!equipo()) no('Solo el equipo sube a la biblioteca')
      nuevoArchivo({ tipo: 'biblioteca', empresa_id, carpeta_id, anterior_id, nombre: file.name }, file)
    },
    async cambiarArchivo(id, { nombre, carpeta_id, notas }) {
      if (!equipo()) no('Solo el equipo cambia archivos')
      const a = db.archivos.find((x) => x.id === id)
      const antes = { nombre: [a.nombre, nombre] }
      Object.assign(a, { nombre, carpeta_id, notas })
      if (carpeta_id) a.empresa_id = db.carpetas.find((c) => c.id === carpeta_id).empresa_id
      anota('cambió', 'archivos', id, antes)
    },
    async guardarEnBiblioteca(a, { carpeta_id, nombre, empresa_id }) {
      if (!equipo()) no('Solo el equipo guarda en la biblioteca')
      nuevoArchivo({ tipo: 'biblioteca', empresa_id, carpeta_id, nombre, ruta: a.ruta, tamano: a.tamano, tipo_mime: a.tipo_mime })
    },
    async borrarArchivo(a) {
      if (!admin()) no('Solo el admin borra')
      db.archivos = db.archivos.filter((x) => x.id !== a.id)
      anota('borró', 'archivos', a.id, { nombre: a.nombre })
    },
    async catalogos() {
      return copia(db.archivos.filter((a) => a.tipo === 'catalogo' && veoArchivo(a)))
    },
    async contenidos() {
      const p = perfil()
      if (!p) return []
      return copia(
        db.contenidos
          .filter((c) => equipo() || !p.empresas || p.empresas.includes(c.empresa_id))
          .map((c) => ({ ...c, archivos: db.archivos.filter((a) => a.tipo === 'contenido' && a.contenido_id === c.id) })),
      )
    },
    async guardarContenido({ id, ...c }) {
      if (!equipo()) no('Solo tu equipo llena la parrilla')
      if (id) {
        const x = db.contenidos.find((v) => v.id === id)
        Object.assign(x, c, { actualizada: ahora() })
        anota('cambió', 'contenidos', id)
        return copia(x)
      }
      const x = { id: uid(), enlace: '', texto: '', hora: null, estado: 'borrador', enviado: null, ...c, creado_por: yo, creada: ahora(), actualizada: ahora() }
      db.contenidos.push(x)
      anota('creó', 'contenidos', x.id)
      return copia(x)
    },
    async borrarContenido(id) {
      if (!admin()) no('Solo el admin borra')
      db.contenidos = db.contenidos.filter((c) => c.id !== id)
      db.archivos = db.archivos.filter((a) => a.contenido_id !== id)
      anota('borró', 'contenidos', id)
    },
    async subirMaterial(contenido, file) {
      await espera(300)
      if (!equipo()) no('Solo tu equipo sube material')
      nuevoArchivo({ tipo: 'contenido', contenido_id: contenido.id, empresa_id: contenido.empresa_id, nombre: file.name }, file)
    },
    async subirCatalogo({ empresa_id, file, anterior_id }) {
      await espera(400)
      if (!equipo()) no('Solo el equipo sube catálogos')
      nuevoArchivo({ tipo: 'catalogo', empresa_id, anterior_id, nombre: file.name }, file)
    },
    async url(a) {
      const real = db.archivos.find((x) => x.id === a.id)
      if (!real || !veoArchivo(real)) no('No puedes ver ese archivo')
      const blob = blobs.get(real.ruta)
      if (!blob) no('El archivo no está')
      return URL.createObjectURL(blob)
    },
    async correo(a) {
      await espera(600)
      const real = db.archivos.find((x) => x.id === a.id)
      if (!real || !veoArchivo(real)) no('No puedes ver ese archivo')
      anota('envió por correo', 'archivos', a.id)
      return { para: `${perfil().correo} (en la muestra no sale correo de verdad)` }
    },
    anotar(accion, id) {
      anota(accion, 'archivos', id)
    },
    async usuarios() {
      if (!admin()) return []
      return copia(db.perfiles)
    },
    async crearUsuario({ correo, clave, ...datos }) {
      await espera(400)
      if (!admin()) no('Solo el admin crea usuarios')
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) no('Ese correo no se ve bien')
      if ((clave || '').length < 8) no('La contraseña necesita al menos 8 caracteres')
      if (db.perfiles.some((p) => p.correo === correo)) no('Ya hay un usuario con ese correo')
      const p = { id: uid(), correo, activo: true, ...datos }
      db.perfiles.push(p)
      PERSONAS.push({ id: p.id, nombre: p.nombre, correo, rol: p.rol, explica: `Creado por ti (${p.rol})` })
      anota('creó', 'perfiles', p.id, { nombre: p.nombre })
    },
    async cambiarUsuario(id, datos) {
      if (!admin()) no('Solo el admin cambia usuarios')
      const p = db.perfiles.find((x) => x.id === id)
      Object.assign(p, datos)
      anota('cambió', 'perfiles', id, { nombre: p.nombre })
    },
    async cambiarClave() {
      await espera(300)
      if (!admin()) no('Solo el admin cambia contraseñas')
    },
    async cambiarEmpresa(id, { activa }) {
      if (!admin()) no('Solo el admin')
      db.empresas.find((e) => e.id === id).activa = activa
      anota('cambió', 'empresas', id, { activa: [!activa, activa] })
    },
    // Ultron dentro del Centro de trabajo (en la muestra contesta aquí; en el
    // sistema real, el cerebro). Solo cosas del Centro de trabajo, con los
    // permisos de quien pregunta; nunca borra ni cambia nada.
    async ultron(texto) {
      await espera(800 + Math.random() * 600)
      const p = perfil()
      if (!p || !(p.ultron || admin())) no('Ultron solo atiende a la dirección')
      const q = sinTilde(texto).toLowerCase()
      const mias = db.tareas.filter(veoTarea)
      const hoy = new Date().toISOString().slice(0, 10)
      const emp = (id) => db.empresas.find((e) => e.id === id)?.nombre ?? id
      const empresaDe = (t) =>
        /semago/.test(t) ? 'mi-semago' : /cheese|queso|quesillo|cuajada|crema/.test(t) ? 'abuelito-cheese' : /meat|carne|chorizo|longaniza/.test(t) ? 'abuelito-meat' : /corn|pupusa|tortilla|tamal|maiz/.test(t) ? 'abuelito-corn' : null
      if (/borra|elimina|quita|cambia|modifica|edita|mueve el estatus/.test(q)) {
        return { texto: 'Desde el Centro de trabajo no borro ni cambio nada. Si algo cambió en una tarea, puedo **agregarle instrucciones nuevas** (quedan con fecha). Lo demás lo ve tu equipo.' }
      }
      if (/ana sofi|vivian|empleado|whatsapp|llama|ia de |otras ia/.test(q)) {
        return { texto: 'Eso no lo manejo desde aquí: en el Centro de trabajo solo veo tareas, biblioteca y catálogos. Pídemelo por **Telegram** o en mi **consola** y lo hago.' }
      }
      const crear = q.match(/crea(?:r)?(?: una)? tarea[:,]?\s*(.*)$/)
      if (crear) {
        const titulo = texto.slice(texto.length - crear[1].length).trim()
        if (!titulo) return { texto: 'Claro. Dime qué necesitas y para qué empresa, por ejemplo: “Crea una tarea: label de tamales de elote para Abuelito Corn”.' }
        const limpio = titulo.replace(/\s+para\s+(abuelito\s+\w+|mi semago)\s*$/i, '').trim()
        const e = empresaDe(q)
        const opciones = e ? [e] : db.empresas.filter((x) => x.activa && veo('tareas', x.id)).map((x) => x.id)
        return {
          texto: e ? `Te preparo la tarea **“${limpio}”** para **${emp(e)}**. ¿La registro?` : `¿Para qué empresa es **“${limpio}”**?`,
          acciones: opciones.map((id) => ({ etiqueta: e ? '✓ Sí, regístrala' : emp(id), crear: { empresa_id: id, titulo: limpio } })),
        }
      }
      const agregar = q.match(/agrega(?:r|le)?.*(?:tarea|folio)\s*#?(\d+)[:,]?\s*(.*)$/)
      if (agregar) {
        const t = mias.find((x) => String(x.folio) === agregar[1])
        if (!t) return { texto: `No encuentro la tarea #${agregar[1]} entre las tuyas.` }
        if (t.estatus === 'aprobada') return { texto: `La #${t.folio} ya está aprobada; ya no se le agrega nada.` }
        const nota = texto.slice(texto.length - agregar[2].length).trim()
        if (!nota) return { texto: `¿Qué instrucciones le agrego a la #${t.folio} ${t.titulo}?` }
        return { texto: `Le agrego a la **#${t.folio} ${t.titulo}**: “${nota}”. ¿Confirmas?`, acciones: [{ etiqueta: '✓ Sí, agrégalo', nota: { tarea_id: t.id, texto: nota } }] }
      }
      if (/atras|retras|tarde|venc/.test(q)) {
        const tarde = mias.filter((t) => t.compromiso && t.compromiso < hoy && !['entregada', 'aprobada'].includes(t.estatus))
        if (!tarde.length) return { texto: 'Nada atrasado. Todo lo que tiene fecha compromiso va a tiempo.' }
        return { texto: `Hay **${tarde.length}** atrasada${tarde.length === 1 ? '' : 's'}:\n${tarde.map((t) => `• #${t.folio} ${t.titulo} (${emp(t.empresa_id)}), compromiso ${t.compromiso}`).join('\n')}` }
      }
      if (/revis/.test(q)) {
        const rev = mias.filter((t) => t.estatus === 'entregada')
        return { texto: rev.length ? `Para revisar:\n${rev.map((t) => `• #${t.folio} ${t.titulo}`).join('\n')}` : 'No tienes nada pendiente de revisar.' }
      }
      if (/catalogo/.test(q)) {
        const cats = db.archivos.filter((a) => a.tipo === 'catalogo' && a.vigente && veoArchivo(a))
        const e = empresaDe(q)
        const cual = cats.find((a) => a.empresa_id === e) ?? cats[0]
        if (!cual) return { texto: 'No encontré un catálogo que puedas ver.' }
        return { texto: `Aquí está: **${cual.nombre}**. ¿Te lo mando a tu correo?`, acciones: [{ etiqueta: '✉️ A mi correo', archivo: cual.id }, { etiqueta: 'Ver', archivo: cual.id, ver: true }] }
      }
      if (/label|etiqueta|logo|pdf|archivo|manda/.test(q)) {
        const palabras = q.split(/\s+/).filter((w) => w.length > 3 && !/manda|mandame|label|labels|etiqueta|archivo|pdf/.test(w))
        const hallados = db.archivos.filter((a) => a.tipo === 'biblioteca' && a.vigente && veoArchivo(a) && palabras.every((w) => sinTilde(`${a.nombre} ${a.notas}`).toLowerCase().includes(w)))
        if (!hallados.length) return { texto: 'No lo encontré en la biblioteca. Dime el producto o la empresa y lo vuelvo a buscar.' }
        const a = hallados[0]
        return { texto: `Encontré **${a.nombre}** (${emp(a.empresa_id)}).${hallados.length > 1 ? ` Hay ${hallados.length - 1} más parecido${hallados.length > 2 ? 's' : ''}.` : ''}`, acciones: [{ etiqueta: '✉️ A mi correo', archivo: a.id }, { etiqueta: 'Ver', archivo: a.id, ver: true }] }
      }
      if (/resumen|hoy|como va|semana|que hay/.test(q)) {
        const pend = mias.filter((t) => t.estatus !== 'aprobada')
        const rev = mias.filter((t) => t.estatus === 'entregada')
        return {
          texto: `Resumen: **${pend.length}** tareas abiertas, **${rev.length}** esperando tu revisión, ${mias.filter((t) => t.estatus === 'en-correccion').length} en corrección, ${mias.filter((t) => t.urgente && t.estatus !== 'aprobada').length} urgente(s).`,
          acciones: rev.length ? [{ etiqueta: '¿Cuáles reviso?', pregunta: '¿Qué tengo para revisar?' }] : [],
        }
      }
      return { texto: 'Aquí te ayudo con el Centro de trabajo: “Resumen de hoy”, “¿Qué está atrasado?”, “Mándame el label de pupusas de frijol”, “Crea una tarea: …” o “Agrégale a la tarea #4: …”.' }
    },
    async bitacora() {
      if (!admin()) return []
      return copia(db.bitacora.slice(0, 300))
    },
  }
}
