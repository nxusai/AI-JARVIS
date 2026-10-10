import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aInstante, fechaLocal, horaLocal, hora12, quincenaDe, quincenaAnterior, quincenaSiguiente,
  lunesDe, diaSemana, rangoFechas, duracion, nombreQuincena,
} from '../js/tiempo.js';

test('la CDMX está en UTC-6 todo el año (sin horario de verano desde 2022)', () => {
  assert.equal(aInstante('2026-10-10', '08:30').toISOString(), '2026-10-10T14:30:00.000Z');
  assert.equal(aInstante('2026-06-15', '23:59').toISOString(), '2026-06-16T05:59:00.000Z');
});

test('convierte instantes a fecha y hora de la CDMX', () => {
  const t = new Date('2026-10-11T03:15:00Z'); // 10 oct, 9:15 p. m. en CDMX
  assert.equal(fechaLocal(t), '2026-10-10');
  assert.equal(horaLocal(t), '21:15');
  assert.equal(hora12(t), '9:15 p. m.');
  assert.equal(hora12(new Date('2026-10-10T06:05:00Z')), '12:05 a. m.');
});

test('quincenas del 1 al 15 y del 16 a fin de mes', () => {
  assert.deepEqual(quincenaDe('2026-10-10'), { inicio: '2026-10-01', fin: '2026-10-15' });
  assert.deepEqual(quincenaDe('2026-02-20'), { inicio: '2026-02-16', fin: '2026-02-28' });
  assert.deepEqual(quincenaDe('2028-02-16'), { inicio: '2028-02-16', fin: '2028-02-29' });
  assert.deepEqual(quincenaAnterior({ inicio: '2026-10-01', fin: '2026-10-15' }), { inicio: '2026-09-16', fin: '2026-09-30' });
  assert.deepEqual(quincenaSiguiente({ inicio: '2026-12-16', fin: '2026-12-31' }), { inicio: '2027-01-01', fin: '2027-01-15' });
  assert.equal(rangoFechas('2026-10-01', '2026-10-15').length, 15);
  assert.equal(nombreQuincena({ inicio: '2026-10-16', fin: '2026-10-31' }), '16 al 31 de octubre de 2026');
});

test('semanas de lunes a domingo', () => {
  assert.equal(diaSemana('2026-10-10'), 6); // sábado
  assert.equal(lunesDe('2026-10-10'), '2026-10-05');
  assert.equal(lunesDe('2026-10-11'), '2026-10-05'); // domingo
  assert.equal(lunesDe('2026-10-12'), '2026-10-12');
});

test('duración legible', () => {
  assert.equal(duracion(45), '45 min');
  assert.equal(duracion(65), '1 h 05 min');
});
