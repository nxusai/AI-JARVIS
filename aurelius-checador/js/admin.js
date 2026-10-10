// Consola del dueño: asistencia, calendario, empleados y nómina.
import { crearCliente, configurado } from './supabase.js';
import {
  aInstante, duracion, fechaLarga, fechaLocal, hora12, horaLocal, lunesDe, nombreMes, nombreQuincena,
  quincenaAnterior, quincenaDe, quincenaSiguiente, rangoFechas, sumarDias, ultimoDiaMes, diaSemana,
} from './tiempo.js';
import { activoEn, analizarFechas, calcularNomina } from './nomina.js';

// ---------------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------------
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatoMXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const dinero = (n) => formatoMXN.format(n || 0);
const dos = (n) => String(n).padStart(2, '0');
const hoy = () => fechaLocal(new Date());

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

const ESTADOS = {
  a_tiempo: ['A tiempo', '✓'],
  retardo: ['Retardo', 'R'],
  falta: ['Falta', 'F'],
  descanso: ['Descanso', 'D'],
  permiso: ['Permiso', 'P'],
  trabajo_descanso: ['Trabajó en descanso', 'T'],
  en_turno: ['En turno', '•'],
  incompleto: ['Sin salida', '!'],
  pendiente: ['No ha llegado', '·'],
  futuro: ['Programado', ''],
  fuera: ['No trabajaba aquí', ''],
};
const etiqueta = (estado) => `<span class="estado e-${estado}">${ESTADOS[estado][0]}</span>`;

// "17:00" -> "5:00 p. m."
function hm12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${dos(m)} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}
// Hora compacta para el calendario: "8:03a"
function horaCorta(instante) {
  const [h, m] = horaLocal(instante).split(':').map(Number);
  return `${h % 12 || 12}:${dos(m)}${h < 12 ? 'a' : 'p'}`;
}
function textoPrograma(p) {
  if (p.tipo === 'turno') return `${hm12(p.entrada)} – ${hm12(p.salida)}`;
  return p.tipo === 'descanso' ? 'Descanso' : 'Permiso / vacaciones';
}
function resumenHorario(empId) {
  const h = st.horarios[empId] ?? {};
  const dias = ORDEN_SEMANA.filter((d) => h[d]);
  if (!dias.length) return '<span class="sub">Sin horario</span>';
  return dias.map((d) => `${DIAS_CORTOS[d]} ${hm12(h[d].entrada)}–${hm12(h[d].salida)}`).join('<br>');
}

function avisar(mensaje, error = false) {
  for (const viejo of document.querySelectorAll('.toast')) viejo.remove();
  const t = document.createElement('div');
  t.className = `toast${error ? ' error' : ''}`;
  t.textContent = mensaje;
  document.body.append(t);
  setTimeout(() => t.remove(), error ? 7000 : 3000);
}
async function q(promesa) {
  const { data, error } = await promesa;
  if (error) throw error;
  return data;
}
const mensajeError = (e) => e?.message ?? String(e);

// ---------------------------------------------------------------------
//  Estado
// ---------------------------------------------------------------------
let sb = null;
const st = {
  correo: '',
  config: { tolerancia_min: 10, horas_jornada: 8 },
  empleados: [],
  horarios: {},
  vista: 'hoy',
  cal: { empleado: 'todos', anio: +hoy().slice(0, 4), mes: +hoy().slice(5, 7) },
  quincena: quincenaDe(hoy()),
  nomina: null,
  abiertos: new Set(),
  dia: null,
};
const empleado = (id) => st.empleados.find((e) => e.id === id);

async function cargarBase() {
  const [config, empleados, horarios] = await Promise.all([
    q(sb.from('config').select('tolerancia_min,horas_jornada').eq('id', 1).single()),
    q(sb.from('empleados').select('id,nombre,puesto,sueldo_quincenal,activo,fecha_ingreso,fecha_baja,pin_hash').order('nombre')),
    q(sb.from('horarios').select('empleado_id,dia,entrada,salida')),
  ]);
  st.config = { tolerancia_min: config.tolerancia_min, horas_jornada: Number(config.horas_jornada) };
  st.empleados = empleados.map(({ pin_hash: pinHash, ...e }) => ({ ...e, tienePin: Boolean(pinHash) }));
  st.horarios = {};
  for (const h of horarios) {
    (st.horarios[h.empleado_id] ??= {})[h.dia] = { entrada: h.entrada.slice(0, 5), salida: h.salida.slice(0, 5) };
  }
}

// Registros, cambios de horario y extras autorizadas de un rango de fechas.
async function cargarRango(inicio, fin, { empleadoId, conFotos = false } = {}) {
  const desde = aInstante(sumarDias(inicio, -1), '00:00').toISOString();
  const hasta = aInstante(sumarDias(fin, 2), '00:00').toISOString();
  let qr = sb.from('registros').select(`id,empleado_id,tipo,ts,origen,nota,editado${conFotos ? ',foto' : ''}`)
    .gte('ts', desde).lt('ts', hasta).order('ts');
  let qc = sb.from('cambios_dia').select('*').gte('fecha', inicio).lte('fecha', fin);
  let qe = sb.from('extras_aprobadas').select('*').gte('fecha', lunesDe(inicio)).lte('fecha', fin);
  if (empleadoId) {
    qr = qr.eq('empleado_id', empleadoId);
    qc = qc.eq('empleado_id', empleadoId);
    qe = qe.eq('empleado_id', empleadoId);
  }
  const [registros, cambios, extras] = await Promise.all([q(qr), q(qc), q(qe)]);
  const d = { registros: {}, cambios: {}, extras: {}, extrasFilas: {} };
  for (const r of registros) (d.registros[r.empleado_id] ??= []).push(r);
  for (const c of cambios) (d.cambios[c.empleado_id] ??= {})[c.fecha] = c;
  for (const x of extras) {
    (d.extras[x.empleado_id] ??= {})[x.fecha] = x.minutos;
    (d.extrasFilas[x.empleado_id] ??= {})[x.fecha] = x;
  }
  return d;
}

function analizar(emp, fechas, datos, { soloActivo = true } = {}) {
  return analizarFechas({
    fechas: soloActivo ? fechas.filter((f) => activoEn(emp, f)) : fechas,
    horariosSemana: st.horarios[emp.id] ?? {},
    cambios: datos.cambios[emp.id] ?? {},
    registros: datos.registros[emp.id] ?? [],
    toleranciaMin: st.config.tolerancia_min,
    ahora: new Date(),
  });
}

// Cosas por revisar (sin salida, salidas sin entrada, extras sin decidir).
function contarPendientes(emp, fechas, datos) {
  const { dias, salidasSueltas } = analizar(emp, fechas, datos);
  const extras = datos.extras[emp.id] ?? {};
  const lista = [];
  for (const d of Object.values(dias)) {
    if (d.estado === 'incompleto') lista.push({ fecha: d.fecha, texto: 'sin salida' });
    if (d.minutosExtra > 0 && !(d.fecha in extras) && !d.enTurno) lista.push({ fecha: d.fecha, texto: 'horas extra por revisar' });
  }
  for (const r of salidasSueltas) lista.push({ fecha: fechaLocal(r.ts), texto: 'salida sin entrada' });
  return lista;
}

// ---------------------------------------------------------------------
//  Navegación
// ---------------------------------------------------------------------
const contenido = $('#contenido');
const modal = $('#modal');
const modalFoto = $('#modal-foto');

const VISTAS = { hoy: vistaHoy, calendario: vistaCalendario, nomina: vistaNomina, empleados: vistaEmpleados, ajustes: vistaAjustes };

async function irA(vista, { silencioso = false } = {}) {
  st.vista = vista;
  for (const b of document.querySelectorAll('#pestanas button')) b.classList.toggle('activa', b.dataset.vista === vista);
  if (!silencioso) contenido.innerHTML = '<p class="vacio-msg">Cargando…</p>';
  try {
    await VISTAS[vista]();
  } catch (e) {
    contenido.innerHTML = `<div class="tarjeta"><p>No se pudo cargar: ${esc(mensajeError(e))}</p>
      <button class="btn" data-accion="reintentar">Reintentar</button></div>`;
  }
}
const refrescar = () => irA(st.vista, { silencioso: true });

function abrirModal({ titulo, subtitulo = '', cuerpo, pie = '' }) {
  modal.innerHTML = `
    <div class="modal-cab">
      <h2>${esc(titulo)}${subtitulo ? `<small>${esc(subtitulo)}</small>` : ''}</h2>
      <button class="btn-texto" data-cerrar aria-label="Cerrar">✕</button>
    </div>
    <div class="modal-cuerpo">${cuerpo}</div>
    ${pie ? `<div class="modal-pie">${pie}</div>` : ''}`;
  if (!modal.open) modal.showModal();
}
function cerrarModal() {
  if (modal.open) modal.close();
  st.dia = null;
}

// ---------------------------------------------------------------------
//  HOY
// ---------------------------------------------------------------------
async function vistaHoy() {
  const fecha = hoy();
  const qn = quincenaDe(fecha);
  const [datos, datosQ] = await Promise.all([
    cargarRango(fecha, fecha, { conFotos: true }),
    cargarRango(qn.inicio, fecha),
  ]);
  const activos = st.empleados.filter((e) => e.activo && activoEn(e, fecha));

  let pendientes = 0;
  for (const e of st.empleados) pendientes += contarPendientes(e, rangoFechas(qn.inicio, fecha), datosQ).length;

  const tarjetas = activos.map((e) => {
    const d = analizar(e, [fecha], datos).dias[fecha];
    const deHoy = (datos.registros[e.id] ?? []).filter((r) => fechaLocal(r.ts) === fecha);
    const conFoto = [...deHoy].reverse().find((r) => r.foto);
    const entrada = d.primeraEntrada ? hora12(d.primeraEntrada) : '—';
    const salida = d.ultimaSalida ? hora12(d.ultimaSalida) : (d.enTurno ? 'trabajando' : '—');
    return `
      <div class="tarjeta t-emp" data-accion="abrir-dia" data-emp="${e.id}" data-fecha="${fecha}">
        ${conFoto ? `<img class="foto" src="${esc(conFoto.foto)}" alt="">` : `<div class="foto">${esc(e.nombre[0] ?? '')}</div>`}
        <div>
          <h3>${esc(e.nombre)}</h3>
          <p class="puesto">${esc(e.puesto || ' ')}</p>
          ${etiqueta(d.estado)}
          <p class="linea">Horario: <b>${textoPrograma(d.programa)}</b></p>
          ${d.programa.tipo === 'turno' || deHoy.length ? `<p class="linea">Entrada <b>${entrada}</b> · Salida <b>${salida}</b></p>` : ''}
          ${d.minutosRetardo ? `<p class="linea">Llegó <b>${duracion(d.minutosRetardo)}</b> tarde</p>` : ''}
        </div>
      </div>`;
  }).join('');

  const todos = Object.values(datos.registros).flat()
    .filter((r) => fechaLocal(r.ts) === fecha)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));

  contenido.innerHTML = `
    <div class="c-titulo">
      <h1>Hoy<small>${fechaLarga(fecha)}</small></h1>
      <button class="btn" data-accion="reintentar">Actualizar</button>
    </div>
    ${pendientes ? `<div class="aviso-banda">Tienes ${pendientes} ${pendientes === 1 ? 'cosa' : 'cosas'} por revisar en esta quincena.
      <button class="btn btn-chico" data-accion="ir" data-vista="nomina">Ver en Nómina</button></div>` : ''}
    ${activos.length ? `<div class="tarjetas-hoy">${tarjetas}</div>` : `
      <div class="tarjeta vacio-msg">Aún no tienes empleados.
        <p><button class="btn btn-oro" data-accion="nuevo-empleado">Agregar el primero</button></p></div>`}
    <div class="tarjeta" style="margin-top:16px">
      <h2>Registros de hoy</h2>
      ${todos.length ? `<div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Hora</th><th>Empleado</th><th>Tipo</th><th>Foto</th></tr></thead>
        <tbody>${todos.map((r) => `
          <tr class="clic" data-accion="abrir-dia" data-emp="${r.empleado_id}" data-fecha="${fecha}">
            <td>${hora12(r.ts)}</td>
            <td>${esc(empleado(r.empleado_id)?.nombre)}</td>
            <td style="text-transform:capitalize">${r.tipo}${r.origen === 'admin' ? ' <span class="sub">agregado por ti</span>' : ''}</td>
            <td>${r.foto ? `<img src="${esc(r.foto)}" alt="" style="width:36px;height:48px;object-fit:cover;border-radius:6px">` : '<span class="sub">—</span>'}</td>
          </tr>`).join('')}</tbody></table></div>` : '<p class="vacio-msg">Nadie ha checado hoy.</p>'}
    </div>`;
}

// ---------------------------------------------------------------------
//  CALENDARIO
// ---------------------------------------------------------------------
async function vistaCalendario() {
  const { anio, mes } = st.cal;
  const inicio = `${anio}-${dos(mes)}-01`;
  const fin = `${anio}-${dos(mes)}-${dos(ultimoDiaMes(anio, mes))}`;
  const fechas = rangoFechas(inicio, fin);
  const datos = await cargarRango(inicio, fin);
  const visibles = st.empleados.filter((e) => fechas.some((f) => activoEn(e, f)) && (e.activo || e.fecha_baja));
  if (st.cal.empleado !== 'todos' && !visibles.some((e) => e.id === st.cal.empleado)) st.cal.empleado = 'todos';

  const selector = `
    <label class="campo" style="min-width:180px">Empleado
      <select data-cambio="cal-empleado">
        <option value="todos">Todos</option>
        ${visibles.map((e) => `<option value="${e.id}" ${st.cal.empleado === e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
      </select>
    </label>`;

  let cuerpo;
  if (!visibles.length) {
    cuerpo = '<p class="vacio-msg">No hay empleados en este mes.</p>';
  } else if (st.cal.empleado === 'todos') {
    const filas = visibles.map((e) => {
      const { dias } = analizar(e, fechas, datos);
      return `<tr><td class="nombre">${esc(e.nombre)}</td>${fechas.map((f) => {
        const d = dias[f];
        const estado = d?.estado ?? 'fuera';
        if (estado === 'futuro') return `<td><button class="punto e-fuera" style="cursor:pointer" title="${esc(e.nombre)} · ${fechaLarga(f)} · ${textoPrograma(d.programa)}" data-accion="abrir-dia" data-emp="${e.id}" data-fecha="${f}"></button></td>`;
        const titulo = `${esc(e.nombre)} · ${fechaLarga(f)} · ${ESTADOS[estado][0]}`;
        return `<td><button class="punto e-${estado}" title="${titulo}" ${d ? `data-accion="abrir-dia" data-emp="${e.id}" data-fecha="${f}"` : 'disabled'}>${ESTADOS[estado][1]}</button></td>`;
      }).join('')}</tr>`;
    }).join('');
    cuerpo = `<div class="tabla-envoltura"><table class="tabla matriz">
      <thead><tr><th class="nombre">Empleado</th>${fechas.map((f) => `<th${f === hoy() ? ' style="color:var(--oro)"' : ''}>${DIAS_CORTOS[diaSemana(f)][0]}<br>${+f.slice(8)}</th>`).join('')}</tr></thead>
      <tbody>${filas}</tbody></table></div>`;
  } else {
    const e = empleado(st.cal.empleado);
    const { dias } = analizar(e, fechas, datos);
    const extras = datos.extras[e.id] ?? {};
    const huecos = (diaSemana(inicio) + 6) % 7;
    const celdas = fechas.map((f) => {
      const d = dias[f];
      if (!d) return `<div class="cal-dia" style="opacity:.4"><span class="n">${+f.slice(8)}</span></div>`;
      if (d.estado === 'futuro') {
        return `<button class="cal-dia${f === hoy() ? ' hoy' : ''}" data-accion="abrir-dia" data-emp="${e.id}" data-fecha="${f}">
          <span class="n">${+f.slice(8)}</span><span class="h">${d.programa.origen === 'cambio' ? '✎ ' : ''}${horaCorta(aInstante(f, d.programa.entrada))}–${horaCorta(aInstante(f, d.programa.salida))}</span></button>`;
      }
      const horas = d.primeraEntrada ? `${horaCorta(d.primeraEntrada)}–${d.ultimaSalida ? horaCorta(d.ultimaSalida) : '…'}` : '';
      let extra = '';
      if (d.minutosExtra > 0) {
        const decidido = f in extras;
        extra = `<span class="x">+${duracion(d.minutosExtra)}${decidido ? (extras[f] > 0 ? ' ✓' : ' ✗') : ' ?'}</span>`;
      }
      return `<button class="cal-dia${f === hoy() ? ' hoy' : ''}" data-accion="abrir-dia" data-emp="${e.id}" data-fecha="${f}">
        <span class="n">${+f.slice(8)}</span>${etiqueta(d.estado)}${d.programa.origen === 'cambio' ? '<span class="h">✎ horario cambiado</span>' : ''}
        ${horas ? `<span class="h">${horas}</span>` : ''}${extra}</button>`;
    });
    cuerpo = `<div class="cal">
      ${ORDEN_SEMANA.map((d) => `<div class="cal-cab">${DIAS_CORTOS[d]}</div>`).join('')}
      ${'<div class="cal-dia vacio"></div>'.repeat(huecos)}${celdas.join('')}
    </div>
    <p class="ayuda" style="margin-top:10px">Horas extra: ✓ autorizadas · ✗ no se pagan · ? por revisar · ✎ horario cambiado ese día</p>`;
  }

  const leyenda = ['a_tiempo', 'retardo', 'falta', 'incompleto', 'descanso', 'permiso', 'trabajo_descanso', 'en_turno']
    .map((k) => etiqueta(k)).join('');

  contenido.innerHTML = `
    <div class="c-titulo">
      <h1>Calendario<small>${nombreMes(mes)} ${anio}</small></h1>
      <div class="nav-periodo">
        <button class="btn" data-accion="mes" data-delta="-1" aria-label="Mes anterior">‹</button>
        <button class="btn" data-accion="mes" data-delta="0">Este mes</button>
        <button class="btn" data-accion="mes" data-delta="1" aria-label="Mes siguiente">›</button>
      </div>
    </div>
    <div class="tarjeta">
      <div class="fila" style="margin-bottom:16px">
        ${selector}
        <button class="btn btn-oro" data-accion="abrir-rango">Cambiar horario de varios días</button>
      </div>
      ${cuerpo}
      <div class="leyenda">${leyenda}</div>
    </div>`;
}

// ---------------------------------------------------------------------
//  DETALLE DE UN DÍA (modal)
// ---------------------------------------------------------------------
async function abrirDia(empId, fecha) {
  const e = empleado(empId);
  if (!e) return;
  st.dia = { empId, fecha };
  const datos = await cargarRango(fecha, fecha, { empleadoId: empId, conFotos: true });
  const { dias, salidasSueltas } = analizar(e, [fecha], datos, { soloActivo: false });
  const d = dias[fecha];
  const cambio = datos.cambios[empId]?.[fecha];
  const extraFila = datos.extrasFilas[empId]?.[fecha];

  const registros = [
    ...d.sesiones.flatMap((s) => [s.regEntrada, s.regSalida].filter(Boolean)),
    ...salidasSueltas.filter((r) => fechaLocal(r.ts) === fecha),
  ].sort((a, b) => new Date(a.ts) - new Date(b.ts));

  const tipoActual = cambio ? cambio.tipo : 'semanal';
  const prog = d.programa;

  const resumen = [etiqueta(d.estado)];
  if (d.minutosTrabajados) resumen.push(`Trabajó <b>${duracion(d.minutosTrabajados)}</b>`);
  if (d.minutosRetardo) resumen.push(`Llegó <b>${duracion(d.minutosRetardo)}</b> tarde`);
  if (d.minutosSalidaTemprana) resumen.push(`Salió <b>${duracion(d.minutosSalidaTemprana)}</b> antes`);
  if (!activoEn(e, fecha)) resumen.push('<span class="ayuda">Fuera de sus fechas de ingreso/baja</span>');

  const filaRegistro = (r) => `
    <div class="registro">
      ${r.foto ? `<img src="${esc(r.foto)}" alt="Foto" data-accion="ver-foto" data-id="${r.id}">` : '<div class="sin-foto">Sin foto</div>'}
      <div class="info">
        <b>${r.tipo}</b> · ${hora12(r.ts)}${fechaLocal(r.ts) !== fecha ? ` <small>${fechaLarga(fechaLocal(r.ts))}</small>` : ''}
        <small>${r.origen === 'admin' ? 'Agregado por ti' : 'Checador'}${r.editado ? ' · corregido' : ''}${r.nota ? ` · ${esc(r.nota)}` : ''}</small>
      </div>
      <div class="acciones">
        <button class="btn btn-chico" data-accion="editar-registro" data-id="${r.id}">Corregir</button>
        <button class="btn btn-chico btn-peligro" data-accion="borrar-registro" data-id="${r.id}">Borrar</button>
      </div>
      <form class="fila" data-form="editar-registro" data-id="${r.id}" hidden style="flex-basis:100%">
        <label class="campo">Fecha y hora correcta
          <input type="datetime-local" name="momento" value="${fechaLocal(r.ts)}T${horaLocal(r.ts)}" required></label>
        <label class="campo">Motivo<input name="nota" value="${esc(r.nota)}" placeholder="Ej. olvidó checar"></label>
        <button class="btn btn-primario">Guardar</button>
      </form>
    </div>`;

  let seccionExtra = '';
  if (d.minutosExtra > 0 || extraFila) {
    const explicacion = d.programa.tipo === 'turno'
      ? `Se quedó <b>${duracion(d.minutosExtra)}</b> después de su hora de salida.`
      : `Trabajó <b>${duracion(d.minutosExtra)}</b> en un día que no le tocaba.`;
    const estadoExtra = !extraFila ? '<span class="estado e-retardo">Sin revisar</span>'
      : extraFila.minutos > 0 ? `<span class="estado e-a_tiempo">Se pagan ${duracion(extraFila.minutos)}</span>`
        : '<span class="estado e-falta">No se pagan</span>';
    seccionExtra = `
      <div class="seccion">
        <h3>Horas extra</h3>
        <div class="resumen-dia"><span>${explicacion}</span>${estadoExtra}</div>
        <form class="fila" data-form="extra">
          <label class="campo">Minutos a pagar
            <input type="number" name="minutos" min="0" max="1440" step="1" value="${extraFila?.minutos ?? d.minutosExtra}" required></label>
          <label class="campo">Nota<input name="nota" value="${esc(extraFila?.nota)}" placeholder="Ej. mesa grande que no se iba"></label>
          <button class="btn btn-primario">Pagar estos minutos</button>
          <button class="btn" type="button" data-accion="extra-no">No pagar</button>
          ${extraFila ? '<button class="btn btn-texto" type="button" data-accion="extra-quitar">Quitar decisión</button>' : ''}
        </form>
        <p class="ayuda">Por ley se pagan al doble las primeras 9 horas extra de la semana y al triple las siguientes. La nómina lo calcula sola.</p>
      </div>`;
  }

  const ahoraLocal = `${fecha}T${prog.tipo === 'turno' ? (registros.length ? prog.salida : prog.entrada) : '09:00'}`;

  abrirModal({
    titulo: e.nombre,
    subtitulo: fechaLarga(fecha),
    cuerpo: `
      <div class="resumen-dia">${resumen.map((x) => `<span>${x}</span>`).join('')}</div>

      <div class="seccion">
        <h3>Horario de este día</h3>
        <p style="margin:0">Le toca: <b>${textoPrograma(prog)}</b>
          <span class="ayuda">(${cambio ? 'cambio sólo para este día' : 'su horario semanal'})</span></p>
        <form class="fila" data-form="cambio-dia">
          <label class="campo">Este día
            <select name="tipo" data-cambio="tipo-dia">
              <option value="semanal" ${tipoActual === 'semanal' ? 'selected' : ''}>Usar su horario normal</option>
              <option value="turno" ${tipoActual === 'turno' ? 'selected' : ''}>Horario especial</option>
              <option value="descanso" ${tipoActual === 'descanso' ? 'selected' : ''}>Descansa</option>
              <option value="permiso" ${tipoActual === 'permiso' ? 'selected' : ''}>Permiso / vacaciones (con goce)</option>
            </select></label>
          <label class="campo">Entra<input type="time" name="entrada" value="${prog.entrada ?? '09:00'}" ${tipoActual === 'turno' ? '' : 'disabled'}></label>
          <label class="campo">Sale<input type="time" name="salida" value="${prog.salida ?? '17:00'}" ${tipoActual === 'turno' ? '' : 'disabled'}></label>
          <label class="campo">Nota<input name="nota" value="${esc(cambio?.nota)}"></label>
          <button class="btn">Guardar</button>
        </form>
      </div>

      <div class="seccion">
        <h3>Entradas y salidas</h3>
        ${registros.length ? registros.map(filaRegistro).join('') : '<p class="ayuda">No hay registros este día.</p>'}
        <details>
          <summary class="btn btn-chico" style="list-style:none">+ Agregar registro (si olvidó checar)</summary>
          <form class="fila" data-form="nuevo-registro" style="margin-top:10px">
            <label class="campo">Tipo
              <select name="tipo">
                <option value="entrada" ${registros.length ? '' : 'selected'}>Entrada</option>
                <option value="salida" ${registros.length ? 'selected' : ''}>Salida</option>
              </select></label>
            <label class="campo">Fecha y hora<input type="datetime-local" name="momento" value="${ahoraLocal}" required></label>
            <label class="campo">Motivo<input name="nota" placeholder="Ej. olvidó checar"></label>
            <button class="btn btn-primario">Agregar</button>
          </form>
        </details>
      </div>
      ${seccionExtra}`,
  });
}

async function despuesDeCambio(mensaje) {
  avisar(mensaje);
  if (st.dia) await abrirDia(st.dia.empId, st.dia.fecha);
  refrescar();
}

// "2026-10-10T08:30" (hora CDMX) -> ISO
function momentoAInstante(valor) {
  const [fecha, hora] = valor.split('T');
  return aInstante(fecha, hora.slice(0, 5)).toISOString();
}

// ---------------------------------------------------------------------
//  CAMBIO DE HORARIO POR RANGO (modal)
// ---------------------------------------------------------------------
function abrirRango() {
  const activos = st.empleados.filter((e) => e.activo);
  const preseleccion = st.cal.empleado !== 'todos' ? st.cal.empleado : activos[0]?.id;
  const lunes = lunesDe(sumarDias(hoy(), 7));
  abrirModal({
    titulo: 'Cambiar horario de varios días',
    subtitulo: 'Para una semana distinta, vacaciones o permisos',
    cuerpo: `
      <form class="seccion" data-form="rango" id="form-rango">
        <label class="campo">Empleado
          <select name="empleado" required>
            ${activos.map((e) => `<option value="${e.id}" ${e.id === preseleccion ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}
          </select></label>
        <div class="rejilla-2">
          <label class="campo">Desde<input type="date" name="desde" value="${lunes}" required></label>
          <label class="campo">Hasta<input type="date" name="hasta" value="${sumarDias(lunes, 6)}" required></label>
        </div>
        <label class="campo">Qué pasa esos días
          <select name="tipo" data-cambio="tipo-dia">
            <option value="turno">Horario especial</option>
            <option value="descanso">Descansa</option>
            <option value="permiso">Permiso / vacaciones (con goce)</option>
            <option value="semanal">Volver a su horario normal (quitar cambios)</option>
          </select></label>
        <div class="rejilla-2">
          <label class="campo">Entra<input type="time" name="entrada" value="09:00"></label>
          <label class="campo">Sale<input type="time" name="salida" value="17:00"></label>
        </div>
        <div class="campo">Sólo estos días de la semana
          <span class="fila" style="gap:.6rem">${ORDEN_SEMANA.map((d) => `
            <label style="display:flex;gap:.3rem;align-items:center;font-weight:500;color:var(--texto)">
              <input type="checkbox" name="dia-${d}" checked> ${DIAS_CORTOS[d]}</label>`).join('')}</span>
        </div>
        <label class="campo">Nota<input name="nota" placeholder="Ej. vacaciones, evento privado"></label>
      </form>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button>
          <button class="btn btn-primario" type="submit" form="form-rango">Guardar cambios</button>`,
  });
}

// ---------------------------------------------------------------------
//  EMPLEADOS
// ---------------------------------------------------------------------
async function vistaEmpleados() {
  await cargarBase();
  const filas = st.empleados.map((e) => `
    <tr class="clic" data-accion="editar-empleado" data-id="${e.id}">
      <td><b>${esc(e.nombre)}</b><span class="sub">${esc(e.puesto)}</span></td>
      <td class="num">${dinero(e.sueldo_quincenal)}</td>
      <td style="font-size:.82rem">${resumenHorario(e.id)}</td>
      <td>${e.activo ? etiqueta('a_tiempo').replace('A tiempo', 'Activo') : `<span class="estado e-fuera">Baja ${e.fecha_baja ?? ''}</span>`}
        ${e.tienePin ? '' : '<span class="sub neg">Sin código</span>'}</td>
    </tr>`).join('');
  contenido.innerHTML = `
    <div class="c-titulo">
      <h1>Empleados</h1>
      <button class="btn btn-oro" data-accion="nuevo-empleado">+ Nuevo empleado</button>
    </div>
    <div class="tarjeta">
      ${st.empleados.length ? `<div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Nombre</th><th class="num">Sueldo quincenal</th><th>Horario semanal</th><th>Estado</th></tr></thead>
        <tbody>${filas}</tbody></table></div>` : '<p class="vacio-msg">Todavía no hay empleados.</p>'}
      <p class="ayuda" style="margin-top:12px">Para cambiar el horario sólo unos días (una semana distinta, vacaciones), usa
        <b>Calendario → Cambiar horario de varios días</b>. El horario semanal es el que se repite normalmente.</p>
    </div>`;
}

function abrirEmpleado(id) {
  const e = id ? empleado(id) : null;
  const h = (id && st.horarios[id]) || {};
  const filasHorario = ORDEN_SEMANA.map((d) => `
    <div class="horario-dia">
      <label class="chk"><input type="checkbox" name="trabaja-${d}" data-cambio="trabaja" data-dia="${d}" ${h[d] ? 'checked' : ''}> ${DIAS_LARGOS[d]}</label>
      <input type="time" name="entrada-${d}" value="${h[d]?.entrada ?? '09:00'}" ${h[d] ? '' : 'disabled'} aria-label="Entrada ${DIAS_LARGOS[d]}">
      <input type="time" name="salida-${d}" value="${h[d]?.salida ?? '17:00'}" ${h[d] ? '' : 'disabled'} aria-label="Salida ${DIAS_LARGOS[d]}">
    </div>`).join('');

  abrirModal({
    titulo: e ? e.nombre : 'Nuevo empleado',
    cuerpo: `
      <form class="seccion" data-form="empleado" id="form-empleado" data-id="${e?.id ?? ''}">
        <div class="rejilla-2">
          <label class="campo">Nombre<input name="nombre" value="${esc(e?.nombre)}" required></label>
          <label class="campo">Puesto<input name="puesto" value="${esc(e?.puesto)}" placeholder="Mesero, cocina…"></label>
          <label class="campo">Sueldo quincenal (MXN)<input type="number" name="sueldo" min="0" step="0.01" value="${e?.sueldo_quincenal ?? ''}" required></label>
          <label class="campo">Código para checar
            <input name="pin" inputmode="numeric" pattern="[0-9]{4,6}" maxlength="6" autocomplete="off"
              placeholder="${e?.tienePin ? 'Dejar vacío para no cambiar' : '4 a 6 números'}" ${e?.tienePin ? '' : 'required'}>
          </label>
          <label class="campo">Fecha de ingreso<input type="date" name="ingreso" value="${e?.fecha_ingreso ?? hoy()}" required></label>
          <label class="campo">¿Sigue trabajando aquí?
            <select name="activo" data-cambio="activo">
              <option value="si" ${e?.activo !== false ? 'selected' : ''}>Sí, activo</option>
              <option value="no" ${e?.activo === false ? 'selected' : ''}>No, dado de baja</option>
            </select></label>
          <label class="campo" ${e?.activo === false ? '' : 'hidden'} id="campo-baja">Último día que trabajó
            <input type="date" name="baja" value="${e?.fecha_baja ?? hoy()}"></label>
        </div>
        <p class="ayuda">El código es secreto: díselo sólo a esa persona. No se puede ver después, sólo cambiar.</p>
        <div class="seccion">
          <h3>Horario semanal</h3>
          <div class="horario-semana">${filasHorario}</div>
          <div class="fila">
            <button type="button" class="btn btn-chico" data-accion="copiar-horario">Copiar el horario del primer día marcado a los demás marcados</button>
          </div>
          <p class="ayuda">Si la hora de salida es más temprano que la de entrada (ej. 6:00 p. m. a 1:00 a. m.), el turno termina al día siguiente.
            Cambiar este horario también cambia las quincenas que todavía no cierras.</p>
        </div>
      </form>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button>
          <button class="btn btn-primario" type="submit" form="form-empleado">Guardar</button>`,
  });
}

// ---------------------------------------------------------------------
//  NÓMINA
// ---------------------------------------------------------------------
function resumirNomina(n, extrasEmp) {
  const { dias, ...resto } = n;
  return {
    ...resto,
    dias: Object.values(dias).map((d) => ({
      fecha: d.fecha,
      estado: d.estado,
      programa: textoPrograma(d.programa),
      entrada: d.primeraEntrada ? hora12(d.primeraEntrada) : '',
      salida: d.ultimaSalida ? hora12(d.ultimaSalida) : '',
      trabajado: d.minutosTrabajados,
      retardo: d.minutosRetardo,
      salidaTemprana: d.minutosSalidaTemprana,
      extra: d.minutosExtra,
      extraPagado: extrasEmp[d.fecha] ?? null,
    })),
  };
}

async function vistaNomina() {
  const qn = st.quincena;
  const cerrada = await q(sb.from('nominas_cerradas').select('*').eq('inicio', qn.inicio).maybeSingle());
  let filas;
  if (cerrada) {
    filas = cerrada.datos.filas;
  } else {
    const datos = await cargarRango(qn.inicio, qn.fin);
    const fechas = rangoFechas(qn.inicio, qn.fin);
    const incluidos = st.empleados.filter((e) => fechas.some((f) => activoEn(e, f)) && (e.activo || e.fecha_baja));
    filas = incluidos.map((e) => {
      const extras = datos.extras[e.id] ?? {};
      const n = calcularNomina({
        empleado: e, inicio: qn.inicio, fin: qn.fin, fechas,
        horariosSemana: st.horarios[e.id] ?? {}, cambios: datos.cambios[e.id] ?? {},
        registros: datos.registros[e.id] ?? [], extras,
        toleranciaMin: st.config.tolerancia_min, horasJornada: st.config.horas_jornada, ahora: new Date(),
      });
      return resumirNomina(n, extras);
    });
  }
  st.nomina = { quincena: qn, filas, cerrada };
  const total = filas.reduce((t, f) => t + f.total, 0);
  const numPendientes = filas.reduce((t, f) => t + f.pendientes.incompletos.length + f.pendientes.salidasSueltas.length + f.pendientes.extrasSinRevisar.length, 0);

  const chips = (f) => {
    const p = f.pendientes;
    const chip = (fechasP, texto) => (fechasP.length
      ? `<button class="pendiente-chip no-imprimir" data-accion="abrir-dia" data-emp="${f.empleadoId}" data-fecha="${fechasP[0]}">⚠ ${fechasP.length} ${texto}</button>` : '');
    return chip(p.incompletos, p.incompletos.length === 1 ? 'día sin salida' : 'días sin salida')
      + chip(p.salidasSueltas, 'salida sin entrada')
      + chip(p.extrasSinRevisar, 'extra por revisar');
  };

  const detalle = (f) => `
    <tr class="detalle-fila ${st.abiertos.has(f.empleadoId) ? '' : 'oculto'}" data-detalle="${f.empleadoId}">
      <td colspan="6">
        <p class="ayuda" style="margin:0 0 6px">Salario diario ${dinero(f.salarioDiario)} · Valor de la hora ${dinero(f.valorHora)}
          · Trabajó ${duracion(f.minutosTrabajados)} en total${f.diasPagados < f.diasQuincena ? ` · Se paga por ${f.diasPagados} de ${f.diasQuincena} días (ingreso o baja en esta quincena)` : ''}</p>
        <div class="tabla-envoltura"><table class="tabla detalle-dias">
          <thead><tr><th>Día</th><th>Horario</th><th>Entrada</th><th>Salida</th><th>Estado</th><th class="num">Retardo</th><th class="num">Salió antes</th><th class="num">Extra</th></tr></thead>
          <tbody>${f.dias.map((d) => `
            <tr class="clic no-imprimir-clic" data-accion="abrir-dia" data-emp="${f.empleadoId}" data-fecha="${d.fecha}">
              <td style="text-transform:capitalize;white-space:nowrap">${fechaLarga(d.fecha).replace(/ de \S+$/, '')}</td>
              <td>${d.programa}</td><td>${d.entrada}</td><td>${d.salida}</td>
              <td>${etiqueta(d.estado)}</td>
              <td class="num">${d.retardo ? duracion(d.retardo) : ''}</td>
              <td class="num">${d.salidaTemprana ? duracion(d.salidaTemprana) : ''}</td>
              <td class="num">${d.extra ? `${duracion(d.extra)} ${d.extraPagado === null ? '<span class="sub">por revisar</span>' : d.extraPagado > 0 ? `<span class="sub pos">paga ${duracion(d.extraPagado)}</span>` : '<span class="sub neg">no se paga</span>'}` : ''}</td>
            </tr>`).join('')}</tbody>
        </table></div>
      </td>
    </tr>`;

  const filasHtml = filas.map((f) => `
    <tr class="clic" data-accion="detalle" data-id="${f.empleadoId}">
      <td><b>${esc(f.nombre)}</b> <span class="no-imprimir sub" style="display:inline">${st.abiertos.has(f.empleadoId) ? '▲' : '▼'} detalle</span>
        <span class="sub">Sueldo ${dinero(f.sueldoQuincenal)}${f.diasPagados < f.diasQuincena ? ` · proporcional: ${dinero(f.sueldo)}` : ''}</span>${chips(f)}</td>
      <td class="num">${f.faltas.length}<span class="sub neg">${f.descuentoFaltas ? `−${dinero(f.descuentoFaltas)}` : ''}</span></td>
      <td class="num">${f.numRetardos}${f.minutosRetardo ? ` (${duracion(f.minutosRetardo)})` : ''}<span class="sub neg">${f.descuentoRetardos ? `−${dinero(f.descuentoRetardos)}` : ''}</span></td>
      <td class="num">${f.numSalidasTempranas}${f.minutosSalidaTemprana ? ` (${duracion(f.minutosSalidaTemprana)})` : ''}<span class="sub neg">${f.descuentoSalidas ? `−${dinero(f.descuentoSalidas)}` : ''}</span></td>
      <td class="num">${f.horasExtra.minutosDobles + f.horasExtra.minutosTriples ? duracion(f.horasExtra.minutosDobles + f.horasExtra.minutosTriples) : '0'}<span class="sub pos">${f.horasExtra.pago ? `+${dinero(f.horasExtra.pago)}` : ''}</span></td>
      <td class="num total-pagar">${dinero(f.total)}</td>
    </tr>${detalle(f)}`).join('');

  contenido.innerHTML = `
    <div class="c-titulo">
      <h1>Nómina<small>Quincena del ${nombreQuincena(qn)}</small></h1>
      <div class="nav-periodo no-imprimir">
        <button class="btn" data-accion="quincena" data-delta="-1" aria-label="Quincena anterior">‹</button>
        <button class="btn" data-accion="quincena" data-delta="0">Actual</button>
        <button class="btn" data-accion="quincena" data-delta="1" aria-label="Quincena siguiente">›</button>
      </div>
    </div>
    <h2 class="solo-imprimir">Aurelius · Nómina del ${nombreQuincena(qn)}</h2>
    ${cerrada ? `<div class="aviso-banda info">Quincena cerrada el ${fechaLarga(fechaLocal(cerrada.cerrada))}. Los números ya no cambian aunque edites registros.
        <button class="btn btn-chico no-imprimir" data-accion="reabrir">Reabrir</button></div>`
    : numPendientes ? `<div class="aviso-banda no-imprimir">Hay ${numPendientes} ${numPendientes === 1 ? 'cosa' : 'cosas'} por revisar antes de pagar. Toca los avisos ⚠ para corregirlas.</div>` : ''}
    <div class="tarjeta">
      ${filas.length ? `<div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Empleado</th><th class="num">Faltas</th><th class="num">Retardos</th><th class="num">Salió antes</th><th class="num">Horas extra</th><th class="num">Total a pagar</th></tr></thead>
        <tbody>${filasHtml}</tbody>
        <tfoot><tr><td colspan="5">Total de la quincena</td><td class="num total-pagar">${dinero(total)}</td></tr></tfoot>
      </table></div>` : '<p class="vacio-msg">No hay empleados en esta quincena.</p>'}
    </div>
    <div class="fila no-imprimir" style="margin-top:16px">
      <button class="btn" data-accion="exportar">Descargar Excel</button>
      <button class="btn" data-accion="imprimir">Imprimir / PDF</button>
      ${cerrada ? '' : '<button class="btn btn-primario" data-accion="cerrar-quincena">Cerrar quincena (ya pagué)</button>'}
    </div>
    <div class="tarjeta no-imprimir" style="margin-top:16px">
      <h2>Cómo se calcula</h2>
      <p class="ayuda">Salario diario = sueldo quincenal ÷ 15. Valor de la hora = salario diario ÷ ${st.config.horas_jornada} horas.
        <b>Falta:</b> se descuenta un día. <b>Retardo:</b> si llega más de ${st.config.tolerancia_min} minutos tarde se descuentan los minutos desde su hora de entrada.
        <b>Salió antes:</b> igual, si se va más de ${st.config.tolerancia_min} minutos antes.
        <b>Horas extra:</b> sólo las que autorizas; dobles las primeras 9 de la semana y triples después (Ley Federal del Trabajo, arts. 67 y 68).
        Los descuentos son sólo por tiempo no trabajado; la ley no permite multas.</p>
    </div>`;
}

function exportarNomina() {
  const { quincena: qn, filas } = st.nomina;
  const celda = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [
    [`Aurelius - Nómina del ${nombreQuincena(qn)}`],
    [],
    ['Empleado', 'Sueldo quincenal', 'Sueldo del periodo', 'Faltas', 'Descuento faltas', 'Retardos', 'Minutos de retardo',
      'Descuento retardos', 'Salidas antes', 'Minutos salió antes', 'Descuento salidas', 'Minutos extra dobles',
      'Minutos extra triples', 'Pago horas extra', 'Total a pagar'],
    ...filas.map((f) => [f.nombre, f.sueldoQuincenal, f.sueldo, f.faltas.length, f.descuentoFaltas, f.numRetardos, f.minutosRetardo,
      f.descuentoRetardos, f.numSalidasTempranas, f.minutosSalidaTemprana, f.descuentoSalidas, f.horasExtra.minutosDobles,
      f.horasExtra.minutosTriples, f.horasExtra.pago, f.total]),
    ['TOTAL', '', '', '', '', '', '', '', '', '', '', '', '', '', filas.reduce((t, f) => t + f.total, 0).toFixed(2)],
    [],
    ['Detalle por día'],
    ['Empleado', 'Fecha', 'Horario', 'Entrada', 'Salida', 'Estado', 'Minutos trabajados', 'Minutos de retardo',
      'Minutos salió antes', 'Minutos extra', 'Minutos extra pagados'],
    ...filas.flatMap((f) => f.dias.map((d) => [f.nombre, d.fecha, d.programa, d.entrada, d.salida, ESTADOS[d.estado][0],
      d.trabajado, d.retardo, d.salidaTemprana, d.extra, d.extraPagado ?? (d.extra ? 'por revisar' : '')])),
  ];
  const csv = `﻿${lineas.map((l) => l.map(celda).join(',')).join('\r\n')}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `nomina-aurelius-${qn.inicio}-al-${qn.fin}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------------
//  AJUSTES
// ---------------------------------------------------------------------
const NOMBRES_TABLAS = {
  registros: 'entrada/salida', cambios_dia: 'horario de un día', extras_aprobadas: 'horas extra',
  empleados: 'empleado', horarios: 'horario semanal', config: 'ajustes', dispositivos: 'computadora',
  nominas_cerradas: 'nómina',
};
const ACCIONES_BITACORA = { insert: 'Agregó', update: 'Cambió', delete: 'Borró' };

function describirBitacora(b) {
  const fila = b.despues ?? b.antes ?? {};
  const partes = [];
  const emp = empleado(fila.empleado_id ?? (b.tabla === 'empleados' ? fila.id : null));
  if (emp) partes.push(emp.nombre);
  else if (fila.nombre) partes.push(fila.nombre);
  if (fila.fecha) partes.push(fechaLarga(fila.fecha));
  if (b.tabla === 'registros') {
    if (b.antes && b.despues && b.antes.ts !== b.despues.ts) {
      partes.push(`${fila.tipo}: ${fechaLarga(fechaLocal(b.antes.ts))} ${hora12(b.antes.ts)} → ${hora12(b.despues.ts)}`);
    } else {
      partes.push(`${fila.tipo} ${fechaLarga(fechaLocal(fila.ts))} ${hora12(fila.ts)}`);
    }
  }
  if (b.tabla === 'extras_aprobadas' && b.despues) partes.push(`${duracion(b.despues.minutos)} a pagar`);
  if (b.tabla === 'cambios_dia' && b.despues) partes.push(b.despues.tipo === 'turno' ? `${hm12(b.despues.entrada)}–${hm12(b.despues.salida)}` : b.despues.tipo);
  if (b.tabla === 'nominas_cerradas') partes.push(`quincena ${fila.inicio}`);
  return partes.map(esc).join(' · ');
}

async function vistaAjustes() {
  const [dispositivos, bitacora] = await Promise.all([
    q(sb.from('dispositivos').select('id,nombre,activo,creado,ultimo_uso').order('creado')),
    q(sb.from('bitacora').select('*').order('ts', { ascending: false }).limit(60)),
  ]);
  contenido.innerHTML = `
    <div class="c-titulo"><h1>Ajustes</h1></div>

    <div class="tarjeta">
      <h2>Reglas de asistencia</h2>
      <form class="fila" data-form="config">
        <label class="campo">Minutos de tolerancia
          <input type="number" name="tolerancia" min="0" max="120" value="${st.config.tolerancia_min}" required></label>
        <label class="campo">Horas de una jornada (para el valor de la hora)
          <input type="number" name="horas" min="1" max="24" step="0.5" value="${st.config.horas_jornada}" required></label>
        <button class="btn btn-primario">Guardar</button>
      </form>
    </div>

    <div class="tarjeta">
      <h2>Computadoras que pueden checar</h2>
      ${dispositivos.length ? `<div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Nombre</th><th>Autorizada</th><th>Último uso</th><th></th></tr></thead>
        <tbody>${dispositivos.map((d) => `
          <tr>
            <td><b>${esc(d.nombre)}</b> ${d.activo ? '' : '<span class="estado e-falta">Sin acceso</span>'}</td>
            <td>${fechaLarga(fechaLocal(d.creado))}</td>
            <td>${d.ultimo_uso ? `${fechaLarga(fechaLocal(d.ultimo_uso))}, ${hora12(d.ultimo_uso)}` : 'Nunca'}</td>
            <td class="num"><button class="btn btn-chico ${d.activo ? 'btn-peligro' : ''}" data-accion="dispositivo" data-id="${d.id}" data-activo="${d.activo}">
              ${d.activo ? 'Quitar acceso' : 'Devolver acceso'}</button></td>
          </tr>`).join('')}</tbody></table></div>` : '<p class="ayuda">Todavía no hay ninguna computadora autorizada.</p>'}
      <div class="fila" style="margin-top:12px">
        <button class="btn btn-oro" data-accion="nuevo-codigo">Autorizar una computadora</button>
      </div>
      <p class="ayuda" style="margin-top:8px">Sólo las computadoras autorizadas pueden registrar entradas y salidas. Así nadie checa desde su casa o su celular.</p>
    </div>

    <div class="tarjeta">
      <h2>Cambiar mi contraseña</h2>
      <form class="fila" data-form="clave">
        <label class="campo">Contraseña nueva<input type="password" name="clave" minlength="8" autocomplete="new-password" required></label>
        <button class="btn">Cambiar</button>
      </form>
    </div>

    <div class="tarjeta">
      <h2>Historial de cambios</h2>
      ${bitacora.length ? `<div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Cuándo</th><th>Qué</th><th>Detalle</th></tr></thead>
        <tbody>${bitacora.map((b) => `
          <tr><td style="white-space:nowrap">${fechaLarga(fechaLocal(b.ts)).replace(/^\S+ /, '')}, ${hora12(b.ts)}</td>
            <td>${ACCIONES_BITACORA[b.accion] ?? b.accion} ${NOMBRES_TABLAS[b.tabla] ?? b.tabla}</td>
            <td>${describirBitacora(b)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="ayuda">Sin cambios todavía.</p>'}
    </div>`;
}

// ---------------------------------------------------------------------
//  Acciones (clics)
// ---------------------------------------------------------------------
const ACCIONES = {
  reintentar: () => irA(st.vista),
  ir: (ds) => irA(ds.vista),
  'abrir-dia': (ds) => abrirDia(ds.emp, ds.fecha),
  'abrir-rango': () => abrirRango(),
  'nuevo-empleado': () => abrirEmpleado(null),
  'editar-empleado': (ds) => abrirEmpleado(ds.id),
  mes: (ds) => {
    const delta = +ds.delta;
    if (!delta) {
      st.cal.anio = +hoy().slice(0, 4);
      st.cal.mes = +hoy().slice(5, 7);
    } else {
      const m = st.cal.mes - 1 + delta;
      st.cal.anio += Math.floor(m / 12);
      st.cal.mes = ((m % 12) + 12) % 12 + 1;
    }
    irA('calendario');
  },
  quincena: (ds) => {
    const delta = +ds.delta;
    st.quincena = delta < 0 ? quincenaAnterior(st.quincena) : delta > 0 ? quincenaSiguiente(st.quincena) : quincenaDe(hoy());
    irA('nomina');
  },
  detalle: (ds) => {
    if (st.abiertos.has(ds.id)) st.abiertos.delete(ds.id);
    else st.abiertos.add(ds.id);
    const fila = contenido.querySelector(`[data-detalle="${ds.id}"]`);
    fila?.classList.toggle('oculto', !st.abiertos.has(ds.id));
  },
  exportar: () => exportarNomina(),
  imprimir: () => {
    for (const f of st.nomina?.filas ?? []) st.abiertos.add(f.empleadoId);
    for (const fila of contenido.querySelectorAll('.detalle-fila')) fila.classList.remove('oculto');
    window.print();
  },
  'cerrar-quincena': async () => {
    const { quincena: qn, filas } = st.nomina;
    const pendientes = filas.reduce((t, f) => t + f.pendientes.incompletos.length + f.pendientes.salidasSueltas.length + f.pendientes.extrasSinRevisar.length, 0);
    const pregunta = `${pendientes ? `Todavía hay ${pendientes} cosas por revisar.\n\n` : ''}¿Cerrar la quincena del ${nombreQuincena(qn)}? Los totales quedarán guardados tal como están.`;
    if (!confirm(pregunta)) return;
    try {
      await q(sb.from('nominas_cerradas').insert({
        inicio: qn.inicio, fin: qn.fin, total: filas.reduce((t, f) => t + f.total, 0),
        datos: { filas, config: st.config }, cerrada_por: st.correo,
      }));
      avisar('Quincena cerrada');
      irA('nomina');
    } catch (e) { avisar(mensajeError(e), true); }
  },
  reabrir: async () => {
    if (!confirm('¿Reabrir esta quincena? Los totales se volverán a calcular con los registros actuales.')) return;
    try {
      await q(sb.from('nominas_cerradas').delete().eq('inicio', st.quincena.inicio));
      avisar('Quincena reabierta');
      irA('nomina');
    } catch (e) { avisar(mensajeError(e), true); }
  },
  'ver-foto': async (ds) => {
    try {
      const r = await q(sb.from('registros').select('foto,tipo,ts,empleado_id').eq('id', ds.id).single());
      modalFoto.innerHTML = `
        <div class="modal-cab"><h2>${esc(empleado(r.empleado_id)?.nombre)}<small>${r.tipo} · ${fechaLarga(fechaLocal(r.ts))}, ${hora12(r.ts)}</small></h2>
          <button class="btn-texto" data-cerrar aria-label="Cerrar">✕</button></div>
        <div class="modal-cuerpo"><img class="foto-grande" src="${esc(r.foto)}" alt="Foto al checar"></div>`;
      modalFoto.showModal();
    } catch (e) { avisar(mensajeError(e), true); }
  },
  'editar-registro': (ds) => {
    const form = modal.querySelector(`form[data-form="editar-registro"][data-id="${ds.id}"]`);
    form.hidden = !form.hidden;
  },
  'borrar-registro': async (ds) => {
    if (!confirm('¿Borrar este registro? Quedará anotado en el historial de cambios.')) return;
    try {
      await q(sb.from('registros').delete().eq('id', ds.id));
      await despuesDeCambio('Registro borrado');
    } catch (e) { avisar(mensajeError(e), true); }
  },
  'extra-no': async () => guardarExtra(0, modal.querySelector('form[data-form="extra"] [name=nota]').value),
  'extra-quitar': async () => {
    try {
      await q(sb.from('extras_aprobadas').delete().eq('empleado_id', st.dia.empId).eq('fecha', st.dia.fecha));
      await despuesDeCambio('Decisión quitada');
    } catch (e) { avisar(mensajeError(e), true); }
  },
  'copiar-horario': () => {
    const form = $('#form-empleado');
    const marcados = ORDEN_SEMANA.filter((d) => form[`trabaja-${d}`].checked);
    if (marcados.length < 2) { avisar('Marca al menos dos días'); return; }
    const [primero, ...resto] = marcados;
    for (const d of resto) {
      form[`entrada-${d}`].value = form[`entrada-${primero}`].value;
      form[`salida-${d}`].value = form[`salida-${primero}`].value;
    }
  },
  dispositivo: async (ds) => {
    const activar = ds.activo !== 'true';
    if (!activar && !confirm('Esa computadora ya no podrá registrar entradas y salidas. ¿Continuar?')) return;
    try {
      await q(sb.from('dispositivos').update({ activo: activar }).eq('id', ds.id));
      avisar(activar ? 'Acceso devuelto' : 'Acceso quitado');
      irA('ajustes');
    } catch (e) { avisar(mensajeError(e), true); }
  },
  'nuevo-codigo': async () => {
    const nombre = prompt('¿Cómo se llama esta computadora?', 'Caja del restaurante');
    if (nombre === null) return;
    try {
      const codigo = await q(sb.rpc('crear_codigo_activacion', { p_nombre: nombre }));
      abrirModal({
        titulo: 'Código de activación',
        subtitulo: nombre,
        cuerpo: `
          <div class="codigo-grande">${esc(codigo)}</div>
          <ol class="ayuda" style="font-size:.92rem;line-height:1.6">
            <li>En la computadora del restaurante abre la página del <b>checador</b>.</li>
            <li>Escribe este código y presiona <b>Autorizar</b>.</li>
            <li>Cuando el navegador pregunte por la cámara, elige <b>Permitir</b>.</li>
          </ol>
          <p class="ayuda">Sirve una sola vez y vence en 24 horas.</p>`,
        pie: '<button class="btn btn-primario" data-cerrar>Listo</button>',
      });
    } catch (e) { avisar(mensajeError(e), true); }
  },
};

async function guardarExtra(minutos, nota) {
  try {
    await q(sb.from('extras_aprobadas').upsert({
      empleado_id: st.dia.empId, fecha: st.dia.fecha, minutos, nota: nota || null, aprobado: new Date().toISOString(),
    }));
    await despuesDeCambio(minutos > 0 ? `Se pagarán ${duracion(minutos)} extra` : 'Horas extra marcadas como no pagadas');
  } catch (e) { avisar(mensajeError(e), true); }
}

// ---------------------------------------------------------------------
//  Formularios
// ---------------------------------------------------------------------
const FORMULARIOS = {
  'cambio-dia': async (form) => {
    const { empId, fecha } = st.dia;
    const tipo = form.tipo.value;
    if (tipo === 'semanal') {
      await q(sb.from('cambios_dia').delete().eq('empleado_id', empId).eq('fecha', fecha));
    } else {
      if (tipo === 'turno' && form.entrada.value === form.salida.value) throw new Error('La entrada y la salida no pueden ser iguales');
      await q(sb.from('cambios_dia').upsert({
        empleado_id: empId, fecha, tipo,
        entrada: tipo === 'turno' ? form.entrada.value : null,
        salida: tipo === 'turno' ? form.salida.value : null,
        nota: form.nota.value || null,
      }));
    }
    await despuesDeCambio('Horario del día guardado');
  },
  'editar-registro': async (form) => {
    await q(sb.from('registros').update({
      ts: momentoAInstante(form.momento.value), nota: form.nota.value || null, editado: new Date().toISOString(),
    }).eq('id', form.dataset.id));
    await despuesDeCambio('Registro corregido');
  },
  'nuevo-registro': async (form) => {
    await q(sb.from('registros').insert({
      empleado_id: st.dia.empId, tipo: form.tipo.value, ts: momentoAInstante(form.momento.value),
      origen: 'admin', nota: form.nota.value || null,
    }));
    await despuesDeCambio('Registro agregado');
  },
  extra: async (form) => guardarExtra(Math.max(0, Math.round(+form.minutos.value)), form.nota.value),
  rango: async (form) => {
    const empId = form.empleado.value;
    const { desde, hasta, tipo } = { desde: form.desde.value, hasta: form.hasta.value, tipo: form.tipo.value };
    if (hasta < desde) throw new Error('La fecha "hasta" es anterior a "desde"');
    const fechas = rangoFechas(desde, hasta).filter((f) => form[`dia-${diaSemana(f)}`].checked);
    if (!fechas.length) throw new Error('No hay días seleccionados');
    if (fechas.length > 92) throw new Error('Elige un rango de máximo 3 meses');
    if (tipo === 'semanal') {
      await q(sb.from('cambios_dia').delete().eq('empleado_id', empId).in('fecha', fechas));
    } else {
      if (tipo === 'turno' && form.entrada.value === form.salida.value) throw new Error('La entrada y la salida no pueden ser iguales');
      await q(sb.from('cambios_dia').upsert(fechas.map((fecha) => ({
        empleado_id: empId, fecha, tipo,
        entrada: tipo === 'turno' ? form.entrada.value : null,
        salida: tipo === 'turno' ? form.salida.value : null,
        nota: form.nota.value || null,
      }))));
    }
    cerrarModal();
    avisar(`Listo: ${fechas.length} ${fechas.length === 1 ? 'día actualizado' : 'días actualizados'}`);
    st.cal.empleado = empId;
    refrescar();
  },
  empleado: async (form) => {
    const pin = form.pin.value.trim();
    const activo = form.activo.value === 'si';
    const datos = {
      nombre: form.nombre.value.trim(),
      puesto: form.puesto.value.trim() || null,
      sueldo_quincenal: Math.round(+form.sueldo.value * 100) / 100,
      fecha_ingreso: form.ingreso.value,
      activo,
      fecha_baja: activo ? null : (form.baja.value || hoy()),
    };
    if (!datos.nombre) throw new Error('Escribe el nombre');
    if (pin && !/^\d{4,6}$/.test(pin)) throw new Error('El código debe tener de 4 a 6 números');
    const horarios = [];
    for (const d of ORDEN_SEMANA) {
      if (!form[`trabaja-${d}`].checked) continue;
      const entrada = form[`entrada-${d}`].value;
      const salida = form[`salida-${d}`].value;
      if (!entrada || !salida || entrada === salida) throw new Error(`Revisa el horario del ${DIAS_LARGOS[d].toLowerCase()}`);
      horarios.push({ dia: d, entrada, salida });
    }

    let id = form.dataset.id;
    if (id) {
      await q(sb.from('empleados').update(datos).eq('id', id));
    } else {
      id = (await q(sb.from('empleados').insert(datos).select('id').single())).id;
      form.dataset.id = id; // si algo falla después, volver a guardar actualiza en vez de duplicar
    }
    await q(sb.from('horarios').delete().eq('empleado_id', id));
    if (horarios.length) await q(sb.from('horarios').insert(horarios.map((h) => ({ ...h, empleado_id: id }))));
    if (pin) await q(sb.rpc('fijar_pin', { p_empleado: id, p_pin: pin }));
    cerrarModal();
    avisar('Empleado guardado');
    await cargarBase();
    refrescar();
  },
  config: async (form) => {
    await q(sb.from('config').update({ tolerancia_min: +form.tolerancia.value, horas_jornada: +form.horas.value }).eq('id', 1));
    await cargarBase();
    avisar('Ajustes guardados');
  },
  clave: async (form) => {
    const { error } = await sb.auth.updateUser({ password: form.clave.value });
    if (error) throw error;
    form.reset();
    avisar('Contraseña cambiada');
  },
};

// ---------------------------------------------------------------------
//  Eventos
// ---------------------------------------------------------------------
function alClic(e) {
  if (e.target.closest('[data-cerrar]')) {
    const dlg = e.target.closest('dialog');
    if (dlg === modal) cerrarModal(); else dlg?.close();
    return;
  }
  const el = e.target.closest('[data-accion]');
  if (!el || el.disabled) return;
  ACCIONES[el.dataset.accion]?.(el.dataset, el, e);
}

async function alEnviar(e) {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const boton = e.submitter ?? form.querySelector('button:not([type=button])');
  if (boton) boton.disabled = true;
  try {
    await FORMULARIOS[form.dataset.form](form);
  } catch (err) {
    avisar(mensajeError(err), true);
  } finally {
    if (boton) boton.disabled = false;
  }
}

function alCambiar(e) {
  const el = e.target.closest('[data-cambio]');
  if (!el) return;
  const form = el.form;
  switch (el.dataset.cambio) {
    case 'cal-empleado':
      st.cal.empleado = el.value;
      irA('calendario');
      break;
    case 'tipo-dia':
      form.entrada.disabled = form.salida.disabled = el.value !== 'turno';
      break;
    case 'trabaja':
      form[`entrada-${el.dataset.dia}`].disabled = form[`salida-${el.dataset.dia}`].disabled = !el.checked;
      break;
    case 'activo':
      $('#campo-baja').hidden = el.value === 'si';
      break;
    default:
  }
}

for (const raiz of [contenido, modal, modalFoto]) {
  raiz.addEventListener('click', alClic);
  raiz.addEventListener('submit', alEnviar);
  raiz.addEventListener('change', alCambiar);
}
for (const dlg of [modal, modalFoto]) {
  dlg.addEventListener('click', (e) => { if (e.target === dlg) (dlg === modal ? cerrarModal() : dlg.close()); });
}
modal.addEventListener('close', () => { st.dia = null; });
$('#pestanas').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-vista]');
  if (b) irA(b.dataset.vista);
});

// Actualiza "Hoy" cada minuto mientras no estés editando algo.
setInterval(() => {
  if (sb && st.vista === 'hoy' && !modal.open && !$('#consola').hidden) refrescar();
}, 60000);

// ---------------------------------------------------------------------
//  Acceso
// ---------------------------------------------------------------------
async function entrar(sesion) {
  const esAdmin = await q(sb.rpc('es_admin'));
  if (!esAdmin) {
    await sb.auth.signOut();
    $('#pantalla-acceso').hidden = false;
    $('#acceso-mensaje').textContent = 'Esta cuenta no tiene permiso para usar la consola.';
    return;
  }
  st.correo = sesion.user.email;
  $('#usuario').textContent = st.correo;
  $('#pantalla-acceso').hidden = true;
  $('#consola').hidden = false;
  await cargarBase();
  irA('hoy');
}

$('#form-acceso').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#acceso-mensaje').textContent = 'Entrando…';
  const { data, error } = await sb.auth.signInWithPassword({
    email: $('#acceso-correo').value.trim(), password: $('#acceso-clave').value,
  });
  if (error) {
    $('#acceso-mensaje').textContent = 'Correo o contraseña incorrectos.';
    return;
  }
  $('#acceso-mensaje').textContent = '';
  try { await entrar(data.session); } catch (err) { $('#acceso-mensaje').textContent = mensajeError(err); }
});

$('#btn-salir').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

async function arrancar() {
  if (!configurado) { $('#pantalla-sin-config').hidden = false; return; }
  sb = crearCliente();
  const { data } = await sb.auth.getSession();
  if (data.session) {
    try { await entrar(data.session); return; } catch { /* sesión vencida */ }
  }
  $('#pantalla-acceso').hidden = false;
}

arrancar();
