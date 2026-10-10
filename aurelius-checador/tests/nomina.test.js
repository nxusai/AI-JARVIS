import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aInstante, rangoFechas } from '../js/tiempo.js';
import { analizarFechas, calcularExtras, calcularNomina, programaDelDia } from '../js/nomina.js';

// Lunes a sábado de 9:00 a 17:00, descansa domingo.
const semana = Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [d, { entrada: '09:00:00', salida: '17:00:00' }]));
let id = 0;
const reg = (fecha, hora, tipo) => ({ id: ++id, tipo, ts: aInstante(fecha, hora).toISOString() });
const turno = (fecha, entrada, salida) => [reg(fecha, entrada, 'entrada'), reg(fecha, salida, 'salida')];
const DESPUES = new Date('2027-01-01T00:00:00Z');

function dia(fecha, registros, extra = {}) {
  return analizarFechas({
    fechas: [fecha], horariosSemana: semana, registros, toleranciaMin: 10, ahora: DESPUES, ...extra,
  }).dias[fecha];
}

test('llegar dentro de los 10 minutos de tolerancia es a tiempo', () => {
  const d = dia('2026-10-05', turno('2026-10-05', '09:10', '17:00'));
  assert.equal(d.estado, 'a_tiempo');
  assert.equal(d.minutosRetardo, 0);
  assert.equal(d.minutosTrabajados, 470);
});

test('pasando la tolerancia se cuentan todos los minutos desde la hora de entrada', () => {
  const d = dia('2026-10-05', turno('2026-10-05', '09:11', '17:00'));
  assert.equal(d.estado, 'retardo');
  assert.equal(d.minutosRetardo, 11);
});

test('sin registros en un día de trabajo es falta; en domingo es descanso', () => {
  assert.equal(dia('2026-10-05', []).estado, 'falta');
  assert.equal(dia('2026-10-11', []).estado, 'descanso');
});

test('el día de hoy sin checar todavía no es falta', () => {
  assert.equal(dia('2026-10-05', [], { ahora: aInstante('2026-10-05', '08:00') }).estado, 'futuro');
  assert.equal(dia('2026-10-05', [], { ahora: aInstante('2026-10-05', '09:30') }).estado, 'pendiente');
});

test('entrada sin salida: en turno hoy, incompleto días después', () => {
  const r = [reg('2026-10-05', '09:00', 'entrada')];
  assert.equal(dia('2026-10-05', r, { ahora: aInstante('2026-10-05', '12:00') }).estado, 'en_turno');
  assert.equal(dia('2026-10-05', r).estado, 'incompleto');
});

test('quedarse después de la hora detecta minutos extra; salir antes se descuenta', () => {
  assert.equal(dia('2026-10-05', turno('2026-10-05', '09:00', '18:30')).minutosExtra, 90);
  const temprano = dia('2026-10-05', turno('2026-10-05', '09:00', '16:30'));
  assert.equal(temprano.minutosSalidaTemprana, 30);
  assert.equal(dia('2026-10-05', turno('2026-10-05', '09:00', '16:55')).minutosSalidaTemprana, 0);
});

test('turno que termina después de medianoche', () => {
  const noche = { 5: { entrada: '18:00', salida: '01:00' } }; // viernes
  const r = [reg('2026-10-09', '18:05', 'entrada'), reg('2026-10-10', '02:00', 'salida')];
  const d = analizarFechas({ fechas: ['2026-10-09'], horariosSemana: noche, registros: r, toleranciaMin: 10, ahora: DESPUES }).dias['2026-10-09'];
  assert.equal(d.estado, 'a_tiempo');
  assert.equal(d.minutosExtra, 60);
  assert.equal(d.minutosTrabajados, 475);
});

test('un cambio de un día manda sobre el horario semanal', () => {
  assert.equal(programaDelDia('2026-10-05', semana, { tipo: 'descanso' }).tipo, 'descanso');
  const p = programaDelDia('2026-10-05', semana, { tipo: 'turno', entrada: '12:00:00', salida: '20:00:00' });
  assert.equal(p.entrada, '12:00');
  const d = dia('2026-10-05', turno('2026-10-05', '12:05', '20:00'), {
    cambios: { '2026-10-05': { tipo: 'turno', entrada: '12:00:00', salida: '20:00:00' } },
  });
  assert.equal(d.estado, 'a_tiempo');
  assert.equal(dia('2026-10-05', [], { cambios: { '2026-10-05': { tipo: 'permiso' } } }).estado, 'permiso');
});

test('trabajar en día de descanso cuenta como posible tiempo extra', () => {
  const d = dia('2026-10-11', turno('2026-10-11', '10:00', '14:00'));
  assert.equal(d.estado, 'trabajo_descanso');
  assert.equal(d.minutosExtra, 240);
});

test('horas extra: 9 dobles por semana y el resto triples, contando la quincena anterior', () => {
  // Semana del lunes 12 al domingo 18 de octubre; la quincena empieza el 16.
  const extras = { '2026-10-12': 300, '2026-10-14': 180, '2026-10-16': 120, '2026-10-19': 60 };
  const r = calcularExtras({ inicio: '2026-10-16', fin: '2026-10-31', extras, valorHora: 40 });
  // 12 y 14 ya suman 8 h (pagadas antes). El 16: 1 h doble + 1 h triple. El 19: semana nueva, doble.
  assert.equal(r.minutosDobles, 120);
  assert.equal(r.minutosTriples, 60);
  assert.equal(r.pago, 2 * 40 * 2 + 1 * 40 * 3);
});

test('nómina quincenal completa', () => {
  const fechas = rangoFechas('2026-10-01', '2026-10-15');
  const registros = [];
  for (const f of fechas) {
    if (f === '2026-10-04' || f === '2026-10-11') continue; // domingos
    if (f === '2026-10-07') continue; // falta
    if (f === '2026-10-06') registros.push(...turno(f, '09:30', '17:00')); // 30 min tarde
    else if (f === '2026-10-08') registros.push(...turno(f, '09:00', '19:00')); // 2 h extra
    else if (f === '2026-10-09') registros.push(...turno(f, '09:00', '18:00')); // 1 h extra no autorizada
    else registros.push(...turno(f, '09:00', '17:00'));
  }
  const n = calcularNomina({
    empleado: { id: 'e1', nombre: 'Juan', sueldo_quincenal: 6000 },
    inicio: '2026-10-01', fin: '2026-10-15', fechas, horariosSemana: semana, cambios: {}, registros,
    extras: { '2026-10-08': 120, '2026-10-09': 0 }, toleranciaMin: 10, horasJornada: 8, ahora: DESPUES,
  });
  // Salario diario 400, hora 50.
  assert.equal(n.salarioDiario, 400);
  assert.equal(n.valorHora, 50);
  assert.deepEqual(n.faltas, ['2026-10-07']);
  assert.equal(n.descuentoFaltas, 400);
  assert.equal(n.minutosRetardo, 30);
  assert.equal(n.descuentoRetardos, 25);
  assert.equal(n.horasExtra.pago, 200); // 2 h dobles x 50
  assert.equal(n.total, 6000 - 400 - 25 + 200);
  assert.deepEqual(n.pendientes.extrasSinRevisar, []);
});

test('la nómina avisa de días incompletos y extras sin revisar', () => {
  const fechas = ['2026-10-05', '2026-10-06'];
  const n = calcularNomina({
    empleado: { id: 'e1', nombre: 'Ana', sueldo_quincenal: 4500 },
    inicio: '2026-10-01', fin: '2026-10-15', fechas, horariosSemana: semana, cambios: {},
    registros: [reg('2026-10-05', '09:00', 'entrada'), ...turno('2026-10-06', '09:00', '18:00')],
    extras: {}, toleranciaMin: 10, horasJornada: 8, ahora: DESPUES,
  });
  assert.deepEqual(n.pendientes.incompletos, ['2026-10-05']);
  assert.deepEqual(n.pendientes.extrasSinRevisar, ['2026-10-06']);
  assert.equal(n.horasExtra.pago, 0);
});

test('quien entra a media quincena cobra sólo los días desde su ingreso', () => {
  const fechas = rangoFechas('2026-10-01', '2026-10-15');
  const registros = rangoFechas('2026-10-12', '2026-10-15').flatMap((f) => turno(f, '09:00', '17:00'));
  const n = calcularNomina({
    empleado: { id: 'e2', nombre: 'Luis', sueldo_quincenal: 6000, fecha_ingreso: '2026-10-12' },
    inicio: '2026-10-01', fin: '2026-10-15', fechas, horariosSemana: semana, cambios: {}, registros,
    extras: { '2026-10-05': 60 }, toleranciaMin: 10, horasJornada: 8, ahora: DESPUES,
  });
  assert.equal(n.diasPagados, 4);
  assert.equal(n.sueldo, 1600);
  assert.deepEqual(n.faltas, []);
  assert.equal(n.horasExtra.pago, 0);
  assert.equal(n.total, 1600);
});
