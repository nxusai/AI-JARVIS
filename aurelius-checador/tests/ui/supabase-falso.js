// Supabase de mentira, en memoria, para probar las pantallas sin internet.
// Las pruebas lo sirven en lugar de la librería real (ver recorrido.mjs).
const ZONA_OFFSET = '-06:00';
const dos = (n) => String(n).padStart(2, '0');
const fechaCdmx = (d) => new Date(d.getTime() - 6 * 3600e3).toISOString().slice(0, 10);
const instante = (fecha, hora) => new Date(`${fecha}T${hora}:00${ZONA_OFFSET}`).toISOString();
const sumar = (fecha, n) => new Date(Date.parse(`${fecha}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8sPv/fwAHvwMvlQ0cuQAAAABJRU5ErkJggg==';

const db = {
  config: [{ id: 1, tolerancia_min: 10, horas_jornada: 8 }],
  empleados: [], horarios: [], cambios_dia: [], registros: [], extras_aprobadas: [],
  nominas_cerradas: [], bitacora: [], dispositivos: [{ id: 'd1', nombre: 'Caja', activo: true, creado: new Date().toISOString(), ultimo_uso: null }],
};
const pins = {};
let sigId = 1;
const CLAVES = { cambios_dia: ['empleado_id', 'fecha'], extras_aprobadas: ['empleado_id', 'fecha'], horarios: ['empleado_id', 'dia'], nominas_cerradas: ['inicio'] };

// ---- Datos de ejemplo: la quincena actual hasta ayer ----
const hoy = fechaCdmx(new Date());
const inicioQ = hoy.slice(8) <= '15' ? `${hoy.slice(0, 8)}01` : `${hoy.slice(0, 8)}16`;
const ingreso = sumar(inicioQ, -40);
const emp = (id, nombre, puesto, sueldo, pin) => {
  db.empleados.push({ id, nombre, puesto, sueldo_quincenal: sueldo, activo: true, fecha_ingreso: ingreso, fecha_baja: null, pin_hash: 'x', creado: '' });
  pins[pin] = id;
};
emp('e1', 'Juan Pérez', 'Mesero', 4500, '1234');
emp('e2', 'Ana López', 'Cocina', 5200, '5678');
emp('e3', 'Luis Torres', 'Barra', 4800, '4321');
for (const d of [1, 2, 3, 4, 5, 6]) db.horarios.push({ empleado_id: 'e1', dia: d, entrada: '09:00:00', salida: '17:00:00' });
for (const d of [2, 3, 4, 5, 6, 0]) db.horarios.push({ empleado_id: 'e2', dia: d, entrada: '14:00:00', salida: '23:00:00' });
for (const d of [1, 2, 3, 4, 5]) db.horarios.push({ empleado_id: 'e3', dia: d, entrada: '18:00:00', salida: '01:00:00' });

const reg = (empleado_id, tipo, ts, foto = FOTO) => db.registros.push({ id: sigId++, empleado_id, tipo, ts, foto, origen: 'checador', nota: null, editado: null, dispositivo_id: 'd1' });
const tieneTurno = (e, f) => db.horarios.find((h) => h.empleado_id === e && h.dia === new Date(`${f}T12:00:00Z`).getUTCDay());
let i = 0;
for (let f = sumar(inicioQ, -7); f < hoy; f = sumar(f, 1), i++) {
  for (const e of ['e1', 'e2', 'e3']) {
    const h = tieneTurno(e, f);
    if (!h) continue;
    if (e === 'e1' && i % 6 === 2) continue; // falta
    const tarde = e === 'e1' && i % 5 === 1 ? 22 : e === 'e2' && i % 4 === 0 ? 7 : 0;
    const [hh, mm] = h.entrada.split(':').map(Number);
    reg(e, 'entrada', new Date(Date.parse(instante(f, `${dos(hh)}:${dos(mm)}`)) + tarde * 60e3).toISOString());
    if (e === 'e2' && i % 7 === 3) continue; // olvidó checar salida
    const [sh, sm] = h.salida.split(':').map(Number);
    const extra = e === 'e2' && i % 3 === 0 ? 75 : 0;
    const fechaSalida = sh < hh ? sumar(f, 1) : f;
    reg(e, 'salida', new Date(Date.parse(instante(fechaSalida, `${dos(sh)}:${dos(sm)}`)) + extra * 60e3).toISOString());
  }
}
reg('e1', 'entrada', new Date(Date.now() - 2 * 3600e3).toISOString());

// ---- Consultas ----
class Consulta {
  constructor(tabla) { this.tabla = tabla; this.op = 'select'; this.filtros = []; this.orden = null; this.lim = null; this.modo = null; this.devolver = false; }
  select() { if (this.op !== 'select') this.devolver = true; return this; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p) { this.op = 'upsert'; this.payload = p; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filtros.push((r) => String(r[c]) === String(v)); return this; }
  gte(c, v) { this.filtros.push((r) => r[c] >= v); return this; }
  lte(c, v) { this.filtros.push((r) => r[c] <= v); return this; }
  lt(c, v) { this.filtros.push((r) => r[c] < v); return this; }
  in(c, vs) { this.filtros.push((r) => vs.includes(r[c])); return this; }
  order(c, { ascending = true } = {}) { this.orden = [c, ascending]; return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.modo = 'single'; return this; }
  maybeSingle() { this.modo = 'maybe'; return this; }
  then(ok, mal) { return Promise.resolve().then(() => this.ejecutar()).then(ok, mal); }
  ejecutar() {
    const t = db[this.tabla];
    const coincide = (r) => this.filtros.every((f) => f(r));
    const llave = CLAVES[this.tabla];
    let filas;
    if (this.op === 'insert' || this.op === 'upsert') {
      const lista = [].concat(this.payload).map((p) => ({ ...p }));
      for (const p of lista) {
        if (this.tabla === 'empleados') { p.id ??= `n${sigId++}`; p.pin_hash ??= null; }
        if (this.tabla === 'registros') { p.id = sigId++; p.foto ??= null; p.editado ??= null; }
        if (this.tabla === 'nominas_cerradas') p.cerrada = new Date().toISOString();
        const existente = llave && t.findIndex((r) => llave.every((k) => String(r[k]) === String(p[k])));
        if (llave && existente >= 0) {
          if (this.op === 'insert') return { data: null, error: { message: 'duplicado' } };
          t[existente] = { ...t[existente], ...p };
        } else t.push(p);
        db.bitacora.unshift({ id: sigId++, ts: new Date().toISOString(), tabla: this.tabla, accion: 'insert', antes: null, despues: p });
      }
      filas = lista;
    } else if (this.op === 'update') {
      filas = t.filter(coincide);
      for (const r of filas) {
        const antes = { ...r };
        Object.assign(r, this.payload);
        db.bitacora.unshift({ id: sigId++, ts: new Date().toISOString(), tabla: this.tabla, accion: 'update', antes, despues: { ...r } });
      }
    } else if (this.op === 'delete') {
      filas = t.filter(coincide);
      db[this.tabla] = t.filter((r) => !coincide(r));
      for (const r of filas) db.bitacora.unshift({ id: sigId++, ts: new Date().toISOString(), tabla: this.tabla, accion: 'delete', antes: r, despues: null });
    } else {
      filas = t.filter(coincide).map((r) => ({ ...r }));
      if (this.orden) {
        const [c, asc] = this.orden;
        filas.sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
      }
      if (this.lim) filas = filas.slice(0, this.lim);
    }
    if (this.op !== 'select' && !this.devolver && !this.modo) return { data: null, error: null };
    if (this.modo === 'single') return filas.length === 1 ? { data: filas[0], error: null } : { data: null, error: { message: 'no single' } };
    if (this.modo === 'maybe') return { data: filas[0] ?? null, error: null };
    return { data: filas, error: null };
  }
}

const RPC = {
  hora_servidor: () => new Date().toISOString(),
  es_admin: () => true,
  estado_dispositivo: ({ p_token }) => ({ autorizado: p_token === 'tok', nombre: 'Caja' }),
  activar_dispositivo: ({ p_codigo }) => (p_codigo?.toUpperCase() === 'ABCD2345' ? { ok: true, token: 'tok', nombre: 'Caja' } : { ok: false, error: 'CODIGO_INVALIDO' }),
  crear_codigo_activacion: () => 'ABCD2345',
  fijar_pin: ({ p_empleado, p_pin }) => {
    if (pins[p_pin] && pins[p_pin] !== p_empleado) throw new Error('Ese código ya lo usa otro empleado. Elige otro.');
    pins[p_pin] = p_empleado;
    db.empleados.find((e) => e.id === p_empleado).pin_hash = 'x';
    return null;
  },
  checar: ({ p_token, p_pin, p_tipo, p_foto }) => {
    if (p_token !== 'tok') return { ok: false, error: 'DISPOSITIVO_NO_AUTORIZADO' };
    const id = pins[p_pin];
    if (!id) return { ok: false, error: 'PIN_INCORRECTO' };
    const ts = new Date().toISOString();
    db.registros.push({ id: sigId++, empleado_id: id, tipo: p_tipo, ts, foto: p_foto, origen: 'checador', nota: null, editado: null });
    window.__fotoRecibida = Boolean(p_foto);
    return { ok: true, nombre: db.empleados.find((e) => e.id === id).nombre, tipo: p_tipo, ts, aviso: null };
  },
};

export function createClient() {
  const clave = 'falso.sesion';
  const sesion = () => (sessionStorage.getItem(clave) ? { user: { email: 'duena@aurelius.mx' } } : null);
  return {
    from: (tabla) => new Consulta(tabla),
    rpc: async (nombre, args = {}) => {
      try { return { data: RPC[nombre](args), error: null }; } catch (e) { return { data: null, error: { message: e.message } }; }
    },
    auth: {
      getSession: async () => ({ data: { session: sesion() } }),
      signInWithPassword: async ({ password }) => {
        if (password !== 'secreto') return { data: null, error: { message: 'Invalid login' } };
        sessionStorage.setItem(clave, '1');
        return { data: { session: sesion() }, error: null };
      },
      signOut: async () => { sessionStorage.removeItem(clave); return { error: null }; },
      updateUser: async () => ({ data: {}, error: null }),
    },
  };
}
window.__db = db;
