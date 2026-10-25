// La muestra: los mismos datos y reglas que la versión real, en memoria, para
// ver NXUS HQ antes de conectar Supabase. Se entra como cualquier persona del
// equipo para ver lo que cada quien ve.

const hoy = new Date()
const dia = (d, h = 9, m = 0) => {
  const x = new Date(hoy)
  x.setDate(x.getDate() + d)
  x.setHours(h, m, 0, 0)
  return x.toISOString()
}
const fecha = (d) => dia(d).slice(0, 10)
const id = () => crypto.randomUUID()

const ED = 'u-eduardo'
const LU = 'u-luis'
const AN = 'u-angeles'
const S1 = 'u-socia1'
const S2 = 'u-socia2'

const db = {
  perfiles: [
    { id: ED, nombre: 'Eduardo Ramos', correo: 'contacto@nxusai.org', rol: 'admin', activo: true, cargo: 'Fundador y CEO', sede: 'usa', foto: null, reporta_a: null, creado: dia(-90) },
    { id: LU, nombre: 'Luis Enrique', correo: 'luis@nxusai.org', rol: 'equipo', activo: true, cargo: 'Encargado de operaciones', sede: 'usa', foto: null, reporta_a: ED, creado: dia(-80) },
    { id: AN, nombre: 'María de los Ángeles', correo: 'angeles@nxusai.org', rol: 'equipo', activo: true, cargo: 'Diseñadora', sede: 'usa', foto: null, reporta_a: LU, creado: dia(-60) },
    { id: S1, nombre: 'Barbara', correo: 'barbara@nxusai.org', rol: 'equipo', activo: true, cargo: 'Socia · NXUS México', sede: 'mexico', foto: null, reporta_a: ED, creado: dia(-30) },
    { id: S2, nombre: 'Tania', correo: 'tania@nxusai.org', rol: 'equipo', activo: true, cargo: 'Socia · NXUS México', sede: 'mexico', foto: null, reporta_a: ED, creado: dia(-30) },
  ],
  clientes: [],
  clientes_dinero: [],
  tareas: [],
  jornadas: [],
  nomina: [
    { persona: LU, esquema: 'fijo', monto_quincena: 5000, moneda: 'MXN', horas_semana: 40, pago_dia_completo: 0, porcentaje: 0, notas: '' },
    { persona: AN, esquema: 'medio-tiempo', monto_quincena: 2500, moneda: 'MXN', horas_semana: 20, pago_dia_completo: 0, porcentaje: 0, notas: '4 horas al día, 20 a la semana; los días completos (8 horas) se pagan aparte.' },
    { persona: S1, esquema: 'comision', monto_quincena: 0, moneda: 'MXN', horas_semana: 40, pago_dia_completo: 0, porcentaje: 50, notas: '50% de los contratos que consiga.' },
    { persona: S2, esquema: 'comision', monto_quincena: 0, moneda: 'MXN', horas_semana: 40, pago_dia_completo: 0, porcentaje: 50, notas: '50% de los contratos que consiga.' },
  ],
  nomina_ajustes: [],
  comisiones: [],
  bitacora: [],
}

const cliente = (c, dinero) => {
  const x = { id: id(), grupo: null, estado: 'activo', equipo: 'usa', servicios: [], descripcion: '', contacto_nombre: '', contacto_correo: '', contacto_tel: '', sistema_nombre: '', sistema_url: '', inicio: null, responsable: LU, traido_por: null, propio: false, creado: dia(-60), actualizado: dia(-2), ...c }
  db.clientes.push(x)
  db.clientes_dinero.push({ cliente_id: x.id, mensualidad: 0, pago_unico: 0, moneda: 'USD', dia_cobro: null, notas: '', ...dinero })
  return x
}
const aurelius = cliente(
  { nombre: 'Aurelius', grupo: 'Ramos & Co.', equipo: 'mexico', propio: true, responsable: S1, servicios: ['Marketing y redes', 'Sitio web', 'Sistema de entrada y salida'], descripcion: 'El restaurante de Eduardo. El equipo NXUS México lleva su marketing. Tiene su sistema de entrada y salida del personal.', sistema_nombre: 'Entrada y salida' },
  {},
)
const abuelito = cliente(
  { nombre: 'Abuelito INC', grupo: 'Abuelito INC', servicios: ['Centro de trabajo (CRM) con Ultron', 'Anuncios en Meta', 'Contenido'], descripcion: 'Holding de Abuelito Cheese, Abuelito Meat y Abuelito Corn. Usa el Centro de trabajo con Ultron para su dirección.', sistema_nombre: 'Centro de trabajo', sistema_url: 'https://centro-misemago-abuelito.netlify.app' },
  {},
)
const semago = cliente(
  { nombre: 'Mi Semago', servicios: ['Centro de trabajo (CRM) con Ultron', 'Ana Sofi: ventas por teléfono', 'Etiquetas de trazabilidad', 'Anuncios en Meta'], descripcion: 'Comparte el Centro de trabajo con Abuelito INC. Ana Sofi llama a sus prospectos e imprime sus etiquetas.', sistema_nombre: 'Centro de trabajo', sistema_url: 'https://centro-misemago-abuelito.netlify.app' },
  {},
)
cliente({ nombre: 'VAYRO', grupo: 'Keko Foods', estado: 'prospecto', servicios: ['Administración por Ramos & Co.', 'IA Vivian (en preparación)'], descripcion: 'De los mismos dueños de Abuelito, empresa independiente. Primero la administra Ramos & Co.' }, {})

const tarea = (t) => db.tareas.push({ id: id(), cliente_id: null, detalle: '', estado: 'pendiente', vence: null, creada_por: ED, creada: dia(-3), actualizada: dia(-1), ...t })
tarea({ titulo: 'Parrilla de contenido de noviembre', cliente_id: aurelius.id, asignado: AN, vence: fecha(4), estado: 'en-curso' })
tarea({ titulo: 'Revisar tareas atrasadas en el Centro de trabajo', cliente_id: abuelito.id, asignado: LU, vence: fecha(1) })
tarea({ titulo: 'Diseños de anuncios para Mi Semago', cliente_id: semago.id, asignado: AN, vence: fecha(2) })
tarea({ titulo: 'Reporte mensual de anuncios', cliente_id: semago.id, asignado: LU, vence: fecha(6) })
tarea({ titulo: 'Propuesta para el cliente nuevo de México', asignado: S1, vence: fecha(3), creada_por: S1 })
tarea({ titulo: 'Logo y paleta de VAYRO', asignado: AN, estado: 'hecha' })

// Entradas y salidas de esta quincena; un día completo de Ángeles.
for (let d = -6; d <= -1; d++) {
  const w = new Date(dia(d)).getDay()
  if (w === 0 || w === 6) continue
  db.jornadas.push({ id: id(), persona: LU, entrada: dia(d, 9), salida: dia(d, 17, 30), dia_completo: false, nota: '' })
  const largo = d === -3
  db.jornadas.push({ id: id(), persona: AN, entrada: dia(d, 10), salida: largo ? dia(d, 18, 15) : dia(d, 14), dia_completo: largo, nota: largo ? 'Se quedó el día completo' : '' })
}
db.jornadas.push({ id: id(), persona: LU, entrada: dia(0, 9, 5), salida: null, dia_completo: false, nota: '' })

let yo = null
const copia = (x) => JSON.parse(JSON.stringify(x))
const admin = () => yo?.rol === 'admin'
const nunca = () => {
  throw new Error('No tienes permiso para hacer eso')
}
const anotar = (accion, tabla, fila) => db.bitacora.unshift({ id: db.bitacora.length + 1, quien: yo?.id ?? null, accion, tabla, fila: String(fila ?? ''), cuando: new Date().toISOString() })
const espera = (x) => new Promise((r) => setTimeout(() => r(copia(x)), 60))

function upsert(lista, fila, llave = 'id') {
  const i = fila[llave] ? lista.findIndex((x) => x[llave] === fila[llave]) : -1
  if (i >= 0) {
    lista[i] = { ...lista[i], ...fila }
    return lista[i]
  }
  const nueva = { [llave]: fila[llave] ?? id(), ...fila }
  lista.push(nueva)
  return nueva
}

export function crearMuestra() {
  return {
    muestra: true,
    usuariosMuestra: () => db.perfiles.map((p) => ({ id: p.id, nombre: p.nombre, cargo: p.cargo })),

    sesion: () => espera(yo),
    async entrarComo(pid) {
      yo = db.perfiles.find((p) => p.id === pid) ?? null
      return copia(yo)
    },
    async entrar() {
      throw new Error('En la muestra entra con uno de los botones de abajo')
    },
    async salir() {
      yo = null
    },
    async olvide() {},
    async nuevaClave() {},
    alCambiarSesion() {},

    personas: () => espera(db.perfiles),
    async guardarPersona(p) {
      if (!admin()) nunca()
      anotar('update', 'perfiles', p.id)
      return copia(upsert(db.perfiles, p))
    },
    async crearPersona(p) {
      if (!admin()) nunca()
      const nueva = { id: id(), nombre: p.nombre, correo: p.correo, rol: 'equipo', activo: true, cargo: p.cargo || '', sede: p.sede === 'mexico' ? 'mexico' : 'usa', foto: null, reporta_a: p.reporta_a || null, creado: new Date().toISOString() }
      db.perfiles.push(nueva)
      anotar('insert', 'perfiles', nueva.id)
      return { ok: true, id: nueva.id }
    },
    async claveDe() {
      if (!admin()) nunca()
      return { ok: true }
    },
    async subirFoto(pid, file) {
      if (!admin()) nunca()
      const url = await new Promise((r) => {
        const fr = new FileReader()
        fr.onload = () => r(fr.result)
        fr.readAsDataURL(file)
      })
      return copia(upsert(db.perfiles, { id: pid, foto: url }))
    },
    fotoUrl: async (ruta) => ruta || '',

    clientes: () => espera(db.clientes),
    async guardarCliente(c) {
      if (!admin()) nunca()
      anotar(c.id ? 'update' : 'insert', 'clientes', c.id)
      return copia(upsert(db.clientes, { ...c, actualizado: new Date().toISOString(), ...(c.id ? {} : { creado: new Date().toISOString() }) }))
    },
    async borrarCliente(cid) {
      if (!admin()) nunca()
      db.clientes = db.clientes.filter((c) => c.id !== cid)
      db.clientes_dinero = db.clientes_dinero.filter((d) => d.cliente_id !== cid)
    },
    dinero: () => espera(admin() ? db.clientes_dinero : []),
    async guardarDinero(d) {
      if (!admin()) nunca()
      return copia(upsert(db.clientes_dinero, d, 'cliente_id'))
    },

    tareas: () => espera(db.tareas.filter((t) => admin() || t.asignado === yo?.id || t.creada_por === yo?.id)),
    async guardarTarea(t) {
      const vieja = t.id && db.tareas.find((x) => x.id === t.id)
      if (vieja && !admin() && vieja.asignado !== yo.id && vieja.creada_por !== yo.id) nunca()
      if (vieja && !admin() && vieja.creada_por !== yo.id) {
        const soloEstado = Object.keys(t).every((k) => k === 'id' || k === 'estado' || t[k] === vieja[k])
        if (!soloEstado) throw new Error('Solo quien creó la tarea (o el admin) cambia eso; tú mueves su estado')
      }
      anotar(vieja ? 'update' : 'insert', 'tareas', t.id)
      return copia(upsert(db.tareas, { ...t, actualizada: new Date().toISOString(), ...(vieja ? {} : { creada: new Date().toISOString(), creada_por: yo.id }) }))
    },
    async borrarTarea(tid) {
      if (!admin()) nunca()
      db.tareas = db.tareas.filter((t) => t.id !== tid)
    },

    jornadas: (desde, hasta) =>
      espera(db.jornadas.filter((j) => (admin() || j.persona === yo?.id) && new Date(j.entrada) >= desde && new Date(j.entrada) < hasta).sort((a, b) => b.entrada.localeCompare(a.entrada))),
    abiertas: () => espera(db.jornadas.filter((j) => !j.salida && (admin() || j.persona === yo?.id))),
    async marcarEntrada() {
      if (db.jornadas.some((j) => j.persona === yo.id && !j.salida)) throw new Error('Ya tienes una entrada abierta')
      const j = { id: id(), persona: yo.id, entrada: new Date().toISOString(), salida: null, dia_completo: false, nota: '' }
      db.jornadas.push(j)
      anotar('insert', 'jornadas', j.id)
      return copia(j)
    },
    async marcarSalida(jid) {
      const j = db.jornadas.find((x) => x.id === jid && (admin() || x.persona === yo.id) && !x.salida)
      if (!j) throw new Error('Esa jornada ya está cerrada')
      j.salida = new Date().toISOString()
      anotar('update', 'jornadas', j.id)
      return copia(j)
    },
    async diaCompleto(jid, si) {
      if (!admin()) nunca()
      return copia(upsert(db.jornadas, { id: jid, dia_completo: si }))
    },

    nomina: () => espera(admin() ? db.nomina : []),
    async guardarNomina(n) {
      if (!admin()) nunca()
      return copia(upsert(db.nomina, n, 'persona'))
    },
    ajustes: () => espera(admin() ? db.nomina_ajustes : []),
    async guardarAjuste(a) {
      if (!admin()) nunca()
      return copia(upsert(db.nomina_ajustes, a))
    },
    async borrarAjuste(aid) {
      if (!admin()) nunca()
      db.nomina_ajustes = db.nomina_ajustes.filter((a) => a.id !== aid)
    },
    comisiones: () => espera(admin() ? db.comisiones : []),
    async guardarComision(c) {
      if (!admin()) nunca()
      return copia(upsert(db.comisiones, c))
    },
    async borrarComision(cid) {
      if (!admin()) nunca()
      db.comisiones = db.comisiones.filter((c) => c.id !== cid)
    },

    bitacora: () => espera(admin() ? db.bitacora : []),

    // La IA real (netlify/functions/ordenar.mjs) entiende cualquier texto; la
    // muestra solo saca lo básico para enseñar cómo se ve.
    async ordenar(texto) {
      if (!admin()) nunca()
      await new Promise((r) => setTimeout(r, 700))
      const monto = Number((texto.match(/\$?\s?([\d,]+(?:\.\d+)?)\s*(?:usd|dlls|d[oó]lares|mxn|pesos)?\s*(?:al mes|mensual|\/mes)/i)?.[1] || '0').replace(/,/g, ''))
      const palabra = "\\p{Lu}[\\p{L}\\d&'.-]*"
      const nombre = (texto.match(new RegExp(`(?:cliente|empresa|negocio|restaurante|tienda)\\s+(?:se llama\\s+)?(${palabra}(?:\\s+${palabra}){0,3})`, 'u')) || texto.match(new RegExp(`^(${palabra}(?:\\s+${palabra}){0,3})`, 'u')))?.[1] || 'Cliente nuevo'
      const servicios = [
        [/p[aá]gina|sitio|web/i, 'Sitio web'],
        [/anuncio|ads|meta|facebook/i, 'Anuncios en Meta'],
        [/redes|contenido|instagram|tiktok|post/i, 'Redes y contenido'],
        [/crm|sistema|software/i, 'Sistema a la medida'],
        [/llamada|agente|ia\b|recepcionista/i, 'Agente de IA'],
      ].filter(([re]) => re.test(texto)).map(([, s]) => s)
      return {
        nombre,
        grupo: '',
        estado: /prospecto|todav[ií]a no|propuesta/i.test(texto) ? 'prospecto' : 'activo',
        equipo: /m[eé]xico/i.test(texto) ? 'mexico' : 'usa',
        servicios: servicios.length ? servicios : ['Por definir'],
        descripcion: texto.slice(0, 280),
        contacto_nombre: '',
        contacto_correo: texto.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i)?.[0] ?? '',
        contacto_tel: '',
        inicio: '',
        mensualidad: monto,
        pago_unico: 0,
        moneda: /mxn|pesos/i.test(texto) ? 'MXN' : 'USD',
        dia_cobro: 0,
        tareas: servicios.map((s) => ({ titulo: `Arrancar: ${s}`, detalle: '' })).slice(0, 4),
        dudas: ['(Muestra) La IA real llena esto mucho mejor.'],
      }
    },
  }
}
