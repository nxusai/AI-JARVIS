// La muestra: el inventario completo sin internet, con tres semanas de
// ejemplo. Hace cumplir las mismas reglas que la base de datos (lo cerrado no
// se cambia, las horas las pone el "servidor", las correcciones apuntan a la
// original) para que se vea exactamente como se va a sentir. Ana Sofi aquí
// finge: lee siempre un packing slip de ejemplo y revisa con las cuentas.

import { incidenciasDe, plegar } from './calculos.js'

const copia = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)))
const espera = (x, ms = 60) => new Promise((r) => setTimeout(() => r(copia(x)), ms))
const id = () => crypto.randomUUID()
const ahora = () => new Date().toISOString()
const nunca = () => {
  throw new Error('No tienes permiso para hacer eso')
}
const CERRADA = 'Esta recepción ya se cerró y no se puede cambiar. Si algo está mal, haz una corrección.'

// ------------------------------------------------------------ las fotos

const svg = (s) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`
function fotoCostales(roto = false, texto = 'Sal 50 lb') {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd6de"/><stop offset="1" stop-color="#8d98a5"/></linearGradient></defs><rect width="400" height="300" fill="url(#p)"/><rect y="230" width="400" height="70" fill="#6b5a3e"/>${[0, 1, 2]
    .map((i) => `<g transform="translate(${40 + i * 115} ${90 - (i % 2) * 8})"><path d="M10 0 h80 q14 70 0 140 h-80 q-14 -70 0 -140z" fill="#efe7d4" stroke="#b9ab8a" stroke-width="3"/><text x="50" y="62" font-family="Arial" font-size="13" font-weight="700" text-anchor="middle" fill="#022c5e">${texto}</text>${roto && i === 1 ? '<path d="M30 80 l14 -16 l8 20 l12 -14 l10 18" fill="none" stroke="#7a1d1d" stroke-width="4"/><circle cx="58" cy="132" r="9" fill="#fff" opacity=".9"/><circle cx="72" cy="140" r="6" fill="#fff" opacity=".9"/>' : ''}</g>`)
    .join('')}<text x="12" y="22" font-family="Arial" font-size="13" fill="#1d2735">Foto de ejemplo</text></svg>`)
}
function fotoPacking(prov, numero) {
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#7d8792"/><g transform="rotate(-3 150 200)"><rect x="30" y="20" width="240" height="360" fill="#fbfbf7"/><text x="50" y="60" font-family="Arial" font-size="16" font-weight="700" fill="#111">PACKING SLIP</text><text x="50" y="82" font-family="Arial" font-size="11" fill="#333">${prov}</text><text x="50" y="100" font-family="Arial" font-size="11" fill="#333">No. ${numero}</text>${[0, 1, 2, 3, 4]
    .map((i) => `<rect x="50" y="${130 + i * 26}" width="${150 - i * 12}" height="8" fill="#c9c9c9"/><rect x="220" y="${130 + i * 26}" width="30" height="8" fill="#c9c9c9"/>`)
    .join('')}<text x="50" y="340" font-family="Arial" font-size="10" fill="#666">Received by: ________</text></g></svg>`)
}

// ------------------------------------------------------------ los datos

const DIA = 86400000
const hace = (dias, h = 9, m = 0) => {
  const d = new Date(Date.now() - dias * DIA)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const fecha = (dias) => new Date(Date.now() + dias * DIA).toISOString().slice(0, 10)

const db = {
  perfiles: [
    { id: 'u-eduardo', nombre: 'Eduardo Ramos', correo: 'contacto@nxusai.org', rol: 'admin', activo: true, cargo: 'NXUS AI · administrador', creado: hace(30) },
    { id: 'u-senen', nombre: 'Senén', correo: 'dueno@misemago.com', rol: 'dueno', activo: true, cargo: 'Dueño', creado: hace(30) },
    { id: 'u-karla', nombre: 'Karla', correo: 'compras@misemago.com', rol: 'compras', activo: true, cargo: 'Secretaria · compras', creado: hace(30) },
    { id: 'u-luis', nombre: 'Luis', correo: 'almacen@misemago.com', rol: 'almacen', activo: true, cargo: 'Almacén', creado: hace(30) },
    { id: 'u-miguel', nombre: 'Miguel', correo: 'produccion@misemago.com', rol: 'almacen', activo: true, cargo: 'Producción', creado: hace(30) },
  ],
  proveedores: [],
  productos: [],
  recepciones: [],
  recepcion_lineas: [],
  recepcion_archivos: [],
  pedidos: [],
  pedido_lineas: [],
  salidas: [],
  bitacora: [],
}
const folios = { recepciones: 0, pedidos: 0, salidas: 0 }

const PROV = [
  ['p-dfa', 'Dairy Farmers of America', 'Ventas NJ', '(201) 555-0142', 'orders@example.com'],
  ['p-sal', 'Cargill Salt', 'Atención a clientes', '(800) 555-0177', ''],
  ['p-chr', 'Chr. Hansen', 'Rep. lácteos', '(414) 555-0190', ''],
  ['p-uline', 'Uline', '', '(800) 555-0101', ''],
  ['p-univar', 'Univar Solutions', '', '(855) 555-0123', ''],
]
for (const [pid, nombre, contacto, telefono, correo] of PROV) db.proveedores.push({ id: pid, nombre, contacto, telefono, correo, notas: '', activo: true, creado: hace(30) })

const PROD = [
  ['x-leche', 'Leche en polvo descremada 50 lb', 'costal', 'p-dfa', 20],
  ['x-sal', 'Sal de grano 50 lb', 'costal', 'p-sal', 15],
  ['x-cuajo', 'Cuajo líquido', 'galón', 'p-chr', 4],
  ['x-cultivo', 'Cultivo mesófilo', 'sobre', 'p-chr', 10],
  ['x-cloruro', 'Cloruro de calcio 5 gal', 'cubeta', 'p-univar', 2],
  ['x-bolsas', 'Bolsas al vacío 8x12', 'caja', 'p-uline', 6],
  ['x-crema', 'Crema 40%', 'cubeta', 'p-dfa', 0],
]
for (const [pid, nombre, unidad, proveedor_id, minimo] of PROD) db.productos.push({ id: pid, nombre, unidad, proveedor_id, minimo, notas: '', activo: true, creado: hace(30) })
const prod = (pid) => db.productos.find((p) => p.id === pid)
const prov = (pid) => db.proveedores.find((p) => p.id === pid)

function sembrarRecepcion(dias, h, pid, quien, lineas, extra = {}) {
  const r = {
    id: id(),
    folio: ++folios.recepciones,
    estado: 'cerrada',
    proveedor_id: pid,
    proveedor_nombre: prov(pid).nombre,
    packing_numero: extra.sin_packing ? '' : `PS-${48210 + folios.recepciones * 7}`,
    packing_fecha: extra.sin_packing ? null : fecha(-dias),
    sin_packing: false,
    pedido_id: null,
    temperatura: '',
    transporte_ok: true,
    resultado: '',
    resumen: '',
    notas: '',
    incidencias: [],
    creado_por: quien,
    creado: hace(dias, h, 2),
    llegada: hace(dias, h, 2),
    ia_leido_en: extra.sin_packing ? null : hace(dias, h, 4),
    inspeccion_en: hace(dias, h, 11),
    ia_revisado_en: hace(dias, h, 19),
    cerrada_en: hace(dias, h, 22),
    cerrada_por: quien,
    corrige_id: null,
    motivo: '',
    actualizado: hace(dias, h, 22),
    ...extra,
  }
  db.recepciones.push(r)
  lineas.forEach(([xid, esperada, recibida, danados, lote, cad, precio, nota], i) => {
    const p = prod(xid)
    db.recepcion_lineas.push({
      id: id(),
      recepcion_id: r.id,
      orden: i + 1,
      producto_id: xid,
      producto: p.nombre,
      unidad: p.unidad,
      cantidad_esperada: esperada,
      cantidad_recibida: recibida,
      danados,
      lote,
      caducidad: cad,
      calidad: danados ? 'regular' : 'buena',
      problema: recibida < esperada ? 'faltante' : danados ? 'danado' : 'ninguno',
      precio,
      nota: nota || '',
    })
  })
  const foto = (tipo, ruta, min) => db.recepcion_archivos.push({ id: id(), recepcion_id: r.id, linea_id: null, tipo, ruta, nota: '', subido_por: quien, subido: hace(dias, h, min) })
  if (!r.sin_packing) foto('packing', fotoPacking(r.proveedor_nombre, r.packing_numero), 3)
  foto('mercancia', fotoCostales(false, prod(lineas[0][0]).unidad === 'costal' ? prod(lineas[0][0]).nombre.split(' ')[0] : 'Mi Semago'), 11)
  if (lineas.some((l) => l[3] > 0)) foto('dano', fotoCostales(true, prod(lineas.find((l) => l[3] > 0)[0]).nombre.split(' ')[0]), 14)
  const conLineas = { ...r, lineas: db.recepcion_lineas.filter((l) => l.recepcion_id === r.id) }
  r.incidencias = incidenciasDe(conLineas).map(({ valor: _v, ...i }) => i)
  r.resultado = r.incidencias.some((i) => i.tipo === 'faltante') ? 'incompleta' : r.incidencias.length ? 'con-problemas' : 'completa'
  r.resumen = r.resumen || resumenDe(conLineas, r.incidencias)
  return r
}

function resumenDe(r, inc) {
  const total = (r.lineas ?? []).reduce((s, l) => s + Number(l.cantidad_recibida || 0), 0)
  if (!inc.length) return `Llegó todo completo y en buen estado (${total} unidades en ${r.lineas.length} productos).`
  const partes = inc.map((i) => `${i.cantidad ? `${i.cantidad} ` : ''}${i.producto ? `${i.producto}: ` : ''}${i.detalle}`.trim())
  return `Llegaron ${total} unidades en ${r.lineas.length} productos, con problemas: ${partes.join('; ')}. Conviene avisar al proveedor y apartar lo dañado con su foto.`
}

function sembrarPedido(dias, h, quien, lineas, extra = {}) {
  const p = {
    id: id(),
    folio: ++folios.pedidos,
    estado: 'pedido',
    proveedor_texto: '',
    urgente: false,
    nota: '',
    pedido_por: quien,
    pedido_en: hace(dias, h, 15),
    comprado_por: null,
    comprado_en: null,
    proveedor_id: null,
    orden_compra: '',
    llega: null,
    nota_compra: '',
    recibido_en: null,
    corrige_id: null,
    motivo: '',
    cancela: false,
    ...extra,
  }
  db.pedidos.push(p)
  lineas.forEach(([xid, cantidad, nota], i) => db.pedido_lineas.push({ id: id(), pedido_id: p.id, orden: i + 1, producto_id: xid, producto: prod(xid).nombre, cantidad, unidad: prod(xid).unidad, nota: nota || '' }))
  return p
}

function sembrarSalida(dias, h, quien, xid, cantidad, lote, tipo = 'produccion', nota = '', extra = {}) {
  const s = { id: id(), folio: ++folios.salidas, producto_id: xid, producto: prod(xid).nombre, lote, unidad: prod(xid).unidad, cantidad, tipo, nota, hecha_por: quien, hecha_en: hace(dias, h, 30), corrige_id: null, motivo: '', anula: false, ...extra }
  db.salidas.push(s)
  return s
}

// Tres semanas de Mi Semago.
;(() => {
  const p1 = sembrarPedido(22, 8, 'u-luis', [['x-leche', 40], ['x-crema', 6]], { estado: 'recibido', comprado_por: 'u-karla', comprado_en: hace(22, 11, 40), proveedor_id: 'p-dfa', orden_compra: 'OC-1031', llega: fecha(-20), recibido_en: hace(20, 7, 50) })
  sembrarRecepcion(20, 7, 'p-dfa', 'u-luis', [['x-leche', 40, 40, 0, 'DFA-2291', fecha(160), 62.5], ['x-crema', 6, 6, 0, 'CR-0912', fecha(-6), 38]], { pedido_id: p1.id, temperatura: '37 °F' })
  sembrarRecepcion(18, 10, 'p-sal', 'u-miguel', [['x-sal', 30, 30, 2, 'L24-118', fecha(700), 8.9, '2 costales rotos de la esquina']])
  sembrarRecepcion(15, 9, 'p-chr', 'u-luis', [['x-cuajo', 6, 6, 0, 'RN-55021', fecha(25), 54], ['x-cultivo', 20, 20, 0, 'MS-77310', fecha(12), 21]], { temperatura: '39 °F' })
  const p2 = sembrarPedido(14, 13, 'u-miguel', [['x-bolsas', 10, '8x12, las de siempre']], { estado: 'recibido', comprado_por: 'u-karla', comprado_en: hace(14, 15, 5), proveedor_id: 'p-uline', orden_compra: 'Uline #8812030', llega: fecha(-11), recibido_en: hace(11, 12, 30) })
  sembrarRecepcion(11, 12, 'p-uline', 'u-miguel', [['x-bolsas', 10, 8, 0, '', null, 41]], { pedido_id: p2.id, notas: 'Faltaron 2 cajas, el chofer dice que vienen en otro envío' })
  sembrarRecepcion(9, 8, 'p-dfa', 'u-luis', [['x-leche', 30, 30, 0, 'DFA-2340', fecha(170), 62.5]], { sin_packing: true, temperatura: '', notas: 'El chofer no traía la hoja' })
  // Una recepción que se corrigió: Luis anotó los 25 buenos y uno venía roto.
  const mal = sembrarRecepcion(6, 10, 'p-sal', 'u-luis', [['x-sal', 25, 25, 0, 'L24-131', fecha(720), 8.9]])
  sembrarRecepcion(6, 10, 'p-sal', 'u-luis', [['x-sal', 25, 25, 1, 'L24-131', fecha(720), 8.9, '1 costal mojado y roto debajo de la tarima']], {
    corrige_id: mal.id,
    motivo: 'Los anoté todos como buenos, pero uno venía mojado y roto debajo de la tarima',
    creado: hace(5, 16, 5),
    llegada: mal.llegada,
    cerrada_en: hace(5, 16, 20),
    actualizado: hace(5, 16, 20),
  })
  sembrarRecepcion(3, 9, 'p-univar', 'u-miguel', [['x-cloruro', 4, 4, 0, 'CC-2209', fecha(300), 46]])
  sembrarRecepcion(1, 11, 'p-chr', 'u-luis', [['x-cultivo', 15, 12, 0, 'MS-78112', fecha(60), 21], ['x-cuajo', 4, 4, 1, 'RN-55190', fecha(90), 54, 'Un galón llegó abierto']], { temperatura: '44 °F', notas: 'La caja se sentía tibia' })

  // Pedidos de esta semana.
  sembrarPedido(4, 10, 'u-miguel', [['x-sal', 30]], { estado: 'comprado', comprado_por: 'u-karla', comprado_en: hace(3, 16, 10), proveedor_id: 'p-sal', orden_compra: 'OC-1044', llega: fecha(2) })
  const malPedido = sembrarPedido(2, 9, 'u-luis', [['x-cultivo', 10]], {})
  sembrarPedido(2, 9, 'u-luis', [['x-cultivo', 25]], { corrige_id: malPedido.id, motivo: 'Eran 25 sobres, no 10: viene la producción grande', pedido_en: hace(2, 9, 40) })
  sembrarPedido(1, 14, 'u-miguel', [['x-bolsas', 8], ['x-crema', 4, 'Si se puede, para el jueves']], { urgente: true, proveedor_texto: 'Uline y DFA' })
  sembrarPedido(0, 8, 'u-luis', [['x-leche', 30]], { proveedor_texto: 'DFA' })

  // Salidas a producción.
  for (const [d, x, c, lote] of [[19, 'x-leche', 8, 'DFA-2291'], [17, 'x-leche', 10, 'DFA-2291'], [16, 'x-sal', 6, 'L24-118'], [14, 'x-cuajo', 2, 'RN-55021'], [13, 'x-cultivo', 6, 'MS-77310'], [12, 'x-leche', 9, 'DFA-2291'], [10, 'x-bolsas', 3, ''], [8, 'x-leche', 12, 'DFA-2291'], [7, 'x-sal', 8, 'L24-118'], [5, 'x-cultivo', 8, 'MS-77310'], [4, 'x-leche', 10, 'DFA-2340'], [2, 'x-crema', 4, 'CR-0912'], [2, 'x-sal', 7, 'L24-118'], [1, 'x-cuajo', 2, 'RN-55021']])
    sembrarSalida(d, 13, d % 2 ? 'u-miguel' : 'u-luis', x, c, lote)
  sembrarSalida(5, 17, 'u-miguel', 'x-sal', 2, 'L24-118', 'merma', 'Los 2 costales rotos de la entrega R-0002')
  const s = sembrarSalida(3, 13, 'u-luis', 'x-cultivo', 5, 'MS-77310')
  sembrarSalida(3, 15, 'u-luis', 'x-cultivo', 3, 'MS-77310', 'produccion', '', { corrige_id: s.id, motivo: 'Fueron 3 sobres, no 5', hecha_en: hace(3, 15, 2) })

  // Una recepción abierta ahora mismo (Miguel la está llenando).
  const abierta = {
    id: 'r-abierta',
    folio: ++folios.recepciones,
    estado: 'borrador',
    proveedor_id: 'p-dfa',
    proveedor_nombre: 'Dairy Farmers of America',
    packing_numero: 'PS-50112',
    packing_fecha: fecha(0),
    sin_packing: false,
    pedido_id: null,
    temperatura: '',
    transporte_ok: null,
    resultado: '',
    resumen: '',
    notas: '',
    incidencias: [],
    creado_por: 'u-miguel',
    creado: new Date(Date.now() - 25 * 60000).toISOString(),
    llegada: new Date(Date.now() - 25 * 60000).toISOString(),
    ia_leido_en: new Date(Date.now() - 23 * 60000).toISOString(),
    inspeccion_en: null,
    ia_revisado_en: null,
    cerrada_en: null,
    cerrada_por: null,
    corrige_id: null,
    motivo: '',
    actualizado: ahora(),
  }
  db.recepciones.push(abierta)
  db.recepcion_lineas.push({ id: id(), recepcion_id: abierta.id, orden: 1, producto_id: 'x-leche', producto: 'Leche en polvo descremada 50 lb', unidad: 'costal', cantidad_esperada: 30, cantidad_recibida: null, danados: 0, lote: 'DFA-2402', caducidad: fecha(175), calidad: '', problema: 'ninguno', precio: 62.5, nota: '' })
  db.recepcion_archivos.push({ id: id(), recepcion_id: abierta.id, linea_id: null, tipo: 'packing', ruta: fotoPacking('Dairy Farmers of America', 'PS-50112'), nota: '', subido_por: 'u-miguel', subido: new Date(Date.now() - 24 * 60000).toISOString() })
})()

// ------------------------------------------------------------ las reglas

let yo = null
const admin = () => yo?.rol === 'admin'
const compra = () => ['admin', 'dueno', 'compras'].includes(yo?.rol)
const anotar = (accion, tabla, fila, detalle = null) => db.bitacora.unshift({ id: db.bitacora.length + 1, quien: yo?.id ?? null, accion, tabla, fila, detalle, cuando: ahora() })
const conRecepcion = (r) => ({ ...r, lineas: db.recepcion_lineas.filter((l) => l.recepcion_id === r.id).sort((a, b) => a.orden - b.orden), archivos: db.recepcion_archivos.filter((a) => a.recepcion_id === r.id) })
const conPedido = (p) => ({ ...p, lineas: db.pedido_lineas.filter((l) => l.pedido_id === p.id).sort((a, b) => a.orden - b.orden) })
const recep = (rid) => db.recepciones.find((r) => r.id === rid) ?? (() => { throw new Error('No existe esa recepción') })()
const abierta = (rid) => {
  if (!admin() && recep(rid).estado !== 'borrador') throw new Error(CERRADA)
}
const unico = (lista, nombre, sin) => {
  if (lista.some((x) => x.id !== sin && plegar(x.nombre) === plegar(nombre))) throw new Error(`Ya hay un ${lista === db.proveedores ? 'proveedor' : 'producto'} con ese nombre`)
}
const leerArchivo = (blob) =>
  new Promise((r) => {
    const fr = new FileReader()
    fr.onload = () => r(fr.result)
    fr.readAsDataURL(blob)
  })

export function crearMuestra() {
  return {
    muestra: true,
    usuariosMuestra: () => db.perfiles.filter((p) => p.activo).map((p) => ({ id: p.id, nombre: p.nombre, cargo: p.cargo, rol: p.rol })),

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
      const x = db.perfiles.find((y) => y.id === p.id)
      if (x.id === yo.id && (p.rol && p.rol !== 'admin' || p.activo === false)) throw new Error('No te puedes quitar tu propio acceso de admin')
      Object.assign(x, p)
      anotar('update', 'perfiles', p.id)
      return copia(x)
    },
    async crearPersona(p) {
      if (!admin()) nunca()
      if (db.perfiles.some((x) => x.correo === p.correo)) throw new Error('Ya hay un usuario con ese correo')
      const nueva = { id: id(), nombre: p.nombre, correo: p.correo, rol: ['dueno', 'compras', 'almacen'].includes(p.rol) ? p.rol : 'almacen', activo: true, cargo: p.cargo || '', creado: ahora() }
      db.perfiles.push(nueva)
      anotar('insert', 'perfiles', nueva.id)
      return { ok: true, id: nueva.id }
    },
    async claveDe() {
      if (!admin()) nunca()
      return { ok: true }
    },

    proveedores: () => espera([...db.proveedores].sort((a, b) => a.nombre.localeCompare(b.nombre))),
    async guardarProveedor(p) {
      if (p.id && !compra()) nunca()
      unico(db.proveedores, p.nombre ?? db.proveedores.find((x) => x.id === p.id)?.nombre, p.id)
      let x = db.proveedores.find((y) => y.id === p.id)
      if (x) Object.assign(x, p)
      else db.proveedores.push((x = { id: id(), contacto: '', telefono: '', correo: '', notas: '', activo: true, creado: ahora(), ...p }))
      anotar(p.id ? 'update' : 'insert', 'proveedores', x.id)
      return copia(x)
    },
    async borrarProveedor(pid) {
      if (!admin()) nunca()
      db.proveedores = db.proveedores.filter((p) => p.id !== pid)
      anotar('delete', 'proveedores', pid)
    },
    productos: () => espera([...db.productos].sort((a, b) => a.nombre.localeCompare(b.nombre))),
    async guardarProducto(p) {
      if (p.id && !compra()) nunca()
      unico(db.productos, p.nombre ?? db.productos.find((x) => x.id === p.id)?.nombre, p.id)
      let x = db.productos.find((y) => y.id === p.id)
      if (x) Object.assign(x, p)
      else db.productos.push((x = { id: id(), unidad: '', proveedor_id: null, minimo: 0, notas: '', activo: true, creado: ahora(), ...p }))
      anotar(p.id ? 'update' : 'insert', 'productos', x.id)
      return copia(x)
    },
    async borrarProducto(pid) {
      if (!admin()) nunca()
      db.productos = db.productos.filter((p) => p.id !== pid)
      anotar('delete', 'productos', pid)
    },

    recepciones: () => espera(db.recepciones.map(conRecepcion).sort((a, b) => b.llegada.localeCompare(a.llegada))),
    recepcion: (rid) => espera(conRecepcion(recep(rid))),
    async nuevaRecepcion() {
      const r = { id: id(), folio: ++folios.recepciones, estado: 'borrador', proveedor_id: null, proveedor_nombre: '', packing_numero: '', packing_fecha: null, sin_packing: false, pedido_id: null, temperatura: '', transporte_ok: null, resultado: '', resumen: '', notas: '', incidencias: [], creado_por: yo.id, creado: ahora(), llegada: ahora(), ia_leido_en: null, inspeccion_en: null, ia_revisado_en: null, cerrada_en: null, cerrada_por: null, corrige_id: null, motivo: '', actualizado: ahora() }
      db.recepciones.push(r)
      anotar('insert', 'recepciones', r.id)
      return copia(conRecepcion(r))
    },
    async guardarRecepcion(cambios) {
      const r = recep(cambios.id)
      abierta(r.id)
      const c = { ...cambios }
      if (!admin()) {
        for (const k of ['folio', 'creado_por', 'creado', 'llegada', 'corrige_id', 'motivo', 'inspeccion_en', 'cerrada_en', 'cerrada_por', 'estado']) delete c[k]
        if ('ia_leido_en' in c) c.ia_leido_en = ahora()
        if ('ia_revisado_en' in c) c.ia_revisado_en = ahora()
      }
      Object.assign(r, c, { actualizado: ahora() })
      anotar('update', 'recepciones', r.id)
      return copia(conRecepcion(r))
    },
    async cerrarRecepcion(rid) {
      const r = recep(rid)
      if (r.estado !== 'borrador') throw new Error(CERRADA)
      const x = conRecepcion(r)
      if (!r.proveedor_id && !r.proveedor_nombre.trim()) throw new Error('Falta el proveedor')
      if (!x.lineas.length) throw new Error('Falta lo que llegó: agrega al menos un producto')
      if (!r.sin_packing && !x.archivos.some((a) => a.tipo === 'packing')) throw new Error('Falta la foto del packing slip (o marca que no lo trajo)')
      if (!x.archivos.some((a) => ['mercancia', 'dano'].includes(a.tipo))) throw new Error('Falta al menos una foto de la mercancía')
      Object.assign(r, { estado: 'cerrada', cerrada_en: ahora(), cerrada_por: yo.id, inspeccion_en: r.inspeccion_en ?? ahora(), actualizado: ahora() })
      const p = db.pedidos.find((y) => y.id === r.pedido_id && ['pedido', 'comprado'].includes(y.estado))
      if (p) Object.assign(p, { estado: 'recibido', recibido_en: ahora() })
      anotar('update', 'recepciones', r.id, { estado: ['borrador', 'cerrada'] })
      return copia(conRecepcion(r))
    },
    async reabrirRecepcion(rid) {
      if (!admin()) nunca()
      const r = recep(rid)
      Object.assign(r, { estado: 'borrador', cerrada_en: null, cerrada_por: null })
      anotar('update', 'recepciones', r.id, { estado: ['cerrada', 'borrador'] })
      return copia(conRecepcion(r))
    },
    async borrarRecepcion(rid) {
      if (!admin()) nunca()
      db.recepciones = db.recepciones.filter((r) => r.id !== rid)
      for (const r of db.recepciones) if (r.corrige_id === rid) r.corrige_id = null
      db.recepcion_lineas = db.recepcion_lineas.filter((l) => l.recepcion_id !== rid)
      db.recepcion_archivos = db.recepcion_archivos.filter((a) => a.recepcion_id !== rid)
      anotar('delete', 'recepciones', rid)
    },
    async corregirRecepcion(rid, motivo) {
      const o = recep(rid)
      if (o.estado !== 'cerrada') throw new Error('Esa recepción sigue abierta: corrígela ahí mismo')
      if (db.recepciones.some((r) => r.corrige_id === rid)) throw new Error('Esa recepción ya tiene una corrección; corrige la más nueva')
      if (String(motivo || '').trim().length < 3) throw new Error('Escribe por qué es la corrección')
      const n = { ...copia(o), id: id(), folio: ++folios.recepciones, estado: 'borrador', creado_por: yo.id, creado: ahora(), ia_revisado_en: null, cerrada_en: null, cerrada_por: null, corrige_id: o.id, motivo: motivo.trim(), actualizado: ahora() }
      db.recepciones.push(n)
      const mapa = {}
      for (const l of db.recepcion_lineas.filter((y) => y.recepcion_id === o.id)) {
        const nl = { ...copia(l), id: id(), recepcion_id: n.id }
        mapa[l.id] = nl.id
        db.recepcion_lineas.push(nl)
      }
      for (const a of db.recepcion_archivos.filter((y) => y.recepcion_id === o.id)) db.recepcion_archivos.push({ ...copia(a), id: id(), recepcion_id: n.id, linea_id: mapa[a.linea_id] ?? null })
      anotar('insert', 'recepciones', n.id)
      return n.id
    },
    async guardarLinea(l) {
      abierta(l.recepcion_id ?? db.recepcion_lineas.find((x) => x.id === l.id)?.recepcion_id)
      let x = db.recepcion_lineas.find((y) => y.id === l.id)
      if (x) Object.assign(x, l)
      else db.recepcion_lineas.push((x = { id: id(), orden: 0, producto_id: null, producto: '', unidad: '', cantidad_esperada: null, cantidad_recibida: null, danados: 0, lote: '', caducidad: null, calidad: '', problema: 'ninguno', precio: null, nota: '', ...l }))
      anotar(l.id ? 'update' : 'insert', 'recepcion_lineas', x.recepcion_id)
      return copia(x)
    },
    async borrarLinea(lid) {
      const l = db.recepcion_lineas.find((y) => y.id === lid)
      if (!l) return
      abierta(l.recepcion_id)
      db.recepcion_lineas = db.recepcion_lineas.filter((y) => y.id !== lid)
      anotar('delete', 'recepcion_lineas', l.recepcion_id)
    },
    async subirFoto(rid, tipo, blob, lineaId = null) {
      abierta(rid)
      const a = { id: id(), recepcion_id: rid, linea_id: lineaId, tipo, ruta: await leerArchivo(blob), nota: '', subido_por: yo.id, subido: ahora() }
      db.recepcion_archivos.push(a)
      const r = recep(rid)
      if (['mercancia', 'dano'].includes(tipo) && !r.inspeccion_en) r.inspeccion_en = ahora()
      anotar('insert', 'recepcion_archivos', rid)
      return copia(a)
    },
    async guardarFoto(f) {
      const a = db.recepcion_archivos.find((y) => y.id === f.id)
      abierta(a.recepcion_id)
      Object.assign(a, { nota: f.nota ?? a.nota, tipo: f.tipo ?? a.tipo, linea_id: f.linea_id === undefined ? a.linea_id : f.linea_id })
      return copia(a)
    },
    async borrarFoto(fid) {
      const a = db.recepcion_archivos.find((y) => y.id === fid)
      if (!a) return
      abierta(a.recepcion_id)
      db.recepcion_archivos = db.recepcion_archivos.filter((y) => y.id !== fid)
      anotar('delete', 'recepcion_archivos', a.recepcion_id)
    },
    fotoUrl: async (ruta) => ruta || '',

    pedidos: () => espera(db.pedidos.map(conPedido).sort((a, b) => b.pedido_en.localeCompare(a.pedido_en))),
    async hacerPedido(d) {
      let orig = null
      let cancela = false
      if (d.corrige_id) {
        orig = db.pedidos.find((p) => p.id === d.corrige_id)
        if (!orig) throw new Error('No existe el pedido que quieres corregir')
        if (db.pedidos.some((p) => p.corrige_id === orig.id)) throw new Error('Ese pedido ya tiene una corrección; corrige la más nueva')
        if (String(d.motivo || '').trim().length < 3) throw new Error('Escribe por qué es la corrección')
        cancela = !!d.cancela
      }
      if (!cancela && !(d.lineas ?? []).length) throw new Error('Agrega al menos un producto')
      const p = { id: id(), folio: ++folios.pedidos, estado: 'pedido', proveedor_texto: (d.proveedor_texto || '').trim(), urgente: !!d.urgente, nota: (d.nota || '').trim(), pedido_por: yo.id, pedido_en: ahora(), comprado_por: null, comprado_en: null, proveedor_id: null, orden_compra: '', llega: null, nota_compra: '', recibido_en: null, corrige_id: orig?.id ?? null, motivo: orig ? d.motivo.trim() : '', cancela }
      db.pedidos.push(p)
      if (!cancela) d.lineas.forEach((l, i) => db.pedido_lineas.push({ id: id(), pedido_id: p.id, orden: i + 1, producto_id: l.producto_id || null, producto: l.producto.trim(), cantidad: Number(l.cantidad), unidad: (l.unidad || '').trim(), nota: (l.nota || '').trim() }))
      anotar('insert', 'pedidos', p.id)
      return p.id
    },
    async marcarComprado(pid, d) {
      if (!compra()) throw new Error('Solo quien compra puede marcar una orden como comprada')
      const p = db.pedidos.find((x) => x.id === pid)
      if (!p) throw new Error('No existe ese pedido')
      if (p.cancela) throw new Error('Este es una cancelación; no hay nada que comprar')
      const c = db.pedidos.find((x) => x.corrige_id === pid)
      if (c) throw new Error(`Este pedido se corrigió; compra el folio P-${String(c.folio).padStart(4, '0')}`)
      if (p.estado !== 'pedido') throw new Error(`Este pedido ya está marcado como ${p.estado}`)
      Object.assign(p, { estado: 'comprado', comprado_por: yo.id, comprado_en: ahora(), proveedor_id: d.proveedor_id || null, orden_compra: (d.orden_compra || '').trim(), llega: d.llega || null, nota_compra: (d.nota || '').trim() })
      anotar('update', 'pedidos', p.id, { estado: ['pedido', 'comprado'] })
    },
    async borrarPedido(pid) {
      if (!admin()) nunca()
      db.pedidos = db.pedidos.filter((p) => p.id !== pid)
      for (const p of db.pedidos) if (p.corrige_id === pid) p.corrige_id = null
      db.pedido_lineas = db.pedido_lineas.filter((l) => l.pedido_id !== pid)
      anotar('delete', 'pedidos', pid)
    },

    salidas: () => espera([...db.salidas].sort((a, b) => b.hecha_en.localeCompare(a.hecha_en))),
    async registrarSalida(s) {
      if (s.corrige_id) {
        if (!db.salidas.some((x) => x.id === s.corrige_id)) throw new Error('No existe la salida que quieres corregir')
        if (db.salidas.some((x) => x.corrige_id === s.corrige_id)) throw new Error('Eso ya tiene una corrección; corrige la más nueva')
        if (String(s.motivo || '').trim().length < 3) throw new Error('Escribe por qué es la corrección')
      }
      const n = { id: id(), folio: ++folios.salidas, producto_id: null, lote: '', unidad: '', tipo: 'produccion', nota: '', corrige_id: null, motivo: '', anula: false, ...s, hecha_por: yo.id, hecha_en: ahora() }
      db.salidas.push(n)
      anotar('insert', 'salidas', n.id)
      return copia(n)
    },
    async borrarSalida(sid) {
      if (!admin()) nunca()
      db.salidas = db.salidas.filter((s) => s.id !== sid)
      for (const s of db.salidas) if (s.corrige_id === sid) s.corrige_id = null
      anotar('delete', 'salidas', sid)
    },

    bitacora: () => espera(admin() ? db.bitacora : []),

    // Ana Sofi de mentiritas.
    async leerPacking() {
      await new Promise((r) => setTimeout(r, 1400))
      return {
        es_packing: true,
        proveedor_nombre: 'Chr. Hansen',
        proveedor_id: 'p-chr',
        packing_numero: `PS-${Math.floor(50000 + Math.random() * 9000)}`,
        packing_fecha: new Date().toISOString().slice(0, 10),
        lineas: [
          { producto: 'Cuajo líquido', producto_id: 'x-cuajo', unidad: 'galón', cantidad: 6, lote: 'RN-56004', caducidad: fecha(120), precio: 54 },
          { producto: 'Cultivo mesófilo', producto_id: 'x-cultivo', unidad: 'sobre', cantidad: 20, lote: 'MS-79020', caducidad: fecha(75), precio: 21 },
        ],
        notas: 'La hoja dice "Keep refrigerated 34–40 °F".',
        dudas: ['En la muestra Ana Sofi siempre lee este mismo packing slip de ejemplo.'],
      }
    },
    async revisar(r) {
      await new Promise((res) => setTimeout(res, 1600))
      const inc = incidenciasDe({ ...r, incidencias: [] }).map(({ valor: _v, ...i }) => i)
      const grados = parseFloat(String(r.temperatura).replace(',', '.'))
      if (grados > 41) inc.push({ tipo: 'temperatura', producto: '', cantidad: 0, detalle: `Llegó a ${r.temperatura}; lo refrigerado debe llegar a 41 °F o menos` })
      if (/abiert|roto|rota|mojad|golpe/i.test(r.notas || '') && !inc.some((i) => i.tipo === 'danado')) inc.push({ tipo: 'danado', producto: '', cantidad: 0, detalle: r.notas })
      return {
        resultado: /regres|rechaz/i.test(r.notas || '') ? 'rechazada' : inc.some((i) => i.tipo === 'faltante') ? 'incompleta' : inc.length ? 'con-problemas' : 'completa',
        resumen: resumenDe(r, inc),
        lineas: (r.lineas ?? []).map((l) => {
          const esp = Number(l.cantidad_esperada ?? l.cantidad_recibida ?? 0)
          const rec = Number(l.cantidad_recibida ?? 0)
          const problema = rec < esp ? 'faltante' : rec > esp ? 'sobrante' : Number(l.danados) > 0 ? 'danado' : l.problema && l.problema !== 'ninguno' ? l.problema : 'ninguno'
          return { id: l.id, problema, calidad: Number(l.danados) > 0 ? 'regular' : l.calidad || 'buena', nota: l.nota || (problema === 'faltante' ? `Faltaron ${esp - rec} ${l.unidad}`.trim() : '') }
        }),
        incidencias: inc,
        dudas: r.lineas?.some((l) => l.cantidad_recibida === null || l.cantidad_recibida === '') ? ['Hay productos sin la cantidad que llegó.'] : [],
      }
    },
  }
}
