// Cálculo de asistencia y nómina. No depende del navegador ni de la base
// de datos, así que se puede probar por separado (ver tests/).
import { aInstante, diaSemana, fechaLocal, lunesDe, sumarDias } from './tiempo.js';

const MIN = 60000;
// Una salida sólo cierra una entrada de las últimas 20 horas.
export const MAX_TURNO_MS = 20 * 60 * MIN;
// Por ley: las primeras 9 horas extra de la semana se pagan dobles, el resto triples.
export const MINUTOS_DOBLES_SEMANA = 9 * 60;

const redondear = (n) => Math.round(n * 100) / 100;
const minutosEntre = (a, b) => Math.floor((+b - +a) / MIN);

/**
 * Qué le tocaba trabajar a alguien en una fecha.
 * horariosSemana: { [dia 0-6]: { entrada:'HH:MM', salida:'HH:MM' } }
 * cambio: fila de cambios_dia para esa fecha, o undefined.
 */
export function programaDelDia(fecha, horariosSemana, cambio) {
  if (cambio) {
    if (cambio.tipo === 'turno') {
      return { tipo: 'turno', entrada: cambio.entrada.slice(0, 5), salida: cambio.salida.slice(0, 5), origen: 'cambio', nota: cambio.nota };
    }
    return { tipo: cambio.tipo, origen: 'cambio', nota: cambio.nota };
  }
  const h = horariosSemana[diaSemana(fecha)];
  if (!h) return { tipo: 'descanso', origen: 'semanal' };
  return { tipo: 'turno', entrada: h.entrada.slice(0, 5), salida: h.salida.slice(0, 5), origen: 'semanal' };
}

// Inicio y fin reales del turno. Si la salida es menor o igual, termina al día siguiente.
export function limitesTurno(fecha, programa) {
  const inicio = aInstante(fecha, programa.entrada);
  const fechaFin = programa.salida <= programa.entrada ? sumarDias(fecha, 1) : fecha;
  return { inicio, fin: aInstante(fechaFin, programa.salida) };
}

/**
 * Empareja entradas con salidas. Cada sesión se asigna a la fecha (CDMX) de su entrada.
 * Devuelve { porFecha: { fecha: [sesión] }, salidasSueltas: [registro] }.
 * sesión = { entrada: Date, salida: Date|null, regEntrada, regSalida }
 */
export function armarSesiones(registros) {
  const ordenados = [...registros].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const porFecha = {};
  const salidasSueltas = [];
  let abierta = null;
  const guardar = (s) => { (porFecha[fechaLocal(s.entrada)] ??= []).push(s); };

  for (const r of ordenados) {
    const ts = new Date(r.ts);
    if (r.tipo === 'entrada') {
      if (abierta) guardar(abierta);
      abierta = { entrada: ts, salida: null, regEntrada: r, regSalida: null };
    } else if (abierta && ts - abierta.entrada <= MAX_TURNO_MS) {
      abierta.salida = ts;
      abierta.regSalida = r;
      guardar(abierta);
      abierta = null;
    } else {
      if (abierta) { guardar(abierta); abierta = null; }
      salidasSueltas.push(r);
    }
  }
  if (abierta) guardar(abierta);
  return { porFecha, salidasSueltas };
}

/**
 * Resultado de un día:
 *  estado: 'a_tiempo' | 'retardo' | 'falta' | 'descanso' | 'permiso' | 'trabajo_descanso'
 *          | 'en_turno' | 'incompleto' | 'pendiente' (ya empezó su turno y no checa) | 'futuro'
 */
export function analizarDia({ fecha, programa, sesiones = [], toleranciaMin, ahora = new Date() }) {
  const r = {
    fecha, programa, sesiones, estado: null,
    minutosTrabajados: 0, minutosRetardo: 0, minutosSalidaTemprana: 0, minutosExtra: 0,
    primeraEntrada: null, ultimaSalida: null, enTurno: false, incompleto: false,
  };
  const completas = sesiones.filter((s) => s.salida);
  r.minutosTrabajados = completas.reduce((t, s) => t + minutosEntre(s.entrada, s.salida), 0);
  if (sesiones.length) r.primeraEntrada = new Date(Math.min(...sesiones.map((s) => +s.entrada)));
  if (completas.length) r.ultimaSalida = new Date(Math.max(...completas.map((s) => +s.salida)));

  const abiertas = sesiones.filter((s) => !s.salida);
  r.enTurno = abiertas.some((s) => ahora - s.entrada < MAX_TURNO_MS);
  r.incompleto = abiertas.length > 0 && !r.enTurno;

  if (programa.tipo !== 'turno') {
    if (!sesiones.length) {
      r.estado = programa.tipo;
    } else {
      r.estado = r.incompleto ? 'incompleto' : r.enTurno ? 'en_turno' : 'trabajo_descanso';
      // Trabajar un día de descanso cuenta todo como tiempo extra (si lo autorizas).
      r.minutosExtra = r.minutosTrabajados;
    }
    return r;
  }

  const { inicio, fin } = limitesTurno(fecha, programa);
  r.inicio = inicio;
  r.fin = fin;

  if (!sesiones.length) {
    r.estado = ahora < inicio ? 'futuro' : ahora < fin ? 'pendiente' : 'falta';
    return r;
  }

  const tarde = minutosEntre(inicio, r.primeraEntrada);
  if (tarde > toleranciaMin) r.minutosRetardo = tarde;

  if (r.ultimaSalida && !r.enTurno && !r.incompleto) {
    const temprano = minutosEntre(r.ultimaSalida, fin);
    if (temprano > toleranciaMin) r.minutosSalidaTemprana = temprano;
    r.minutosExtra = Math.max(0, minutosEntre(fin, r.ultimaSalida));
  }

  if (r.incompleto) r.estado = 'incompleto';
  else if (r.enTurno) r.estado = 'en_turno';
  else r.estado = r.minutosRetardo ? 'retardo' : 'a_tiempo';
  return r;
}

/** Analiza varias fechas de un empleado. Devuelve { dias: {fecha: análisis}, salidasSueltas }. */
export function analizarFechas({ fechas, horariosSemana, cambios = {}, registros, toleranciaMin, ahora }) {
  const { porFecha, salidasSueltas } = armarSesiones(registros);
  const dias = {};
  for (const fecha of fechas) {
    dias[fecha] = analizarDia({
      fecha,
      programa: programaDelDia(fecha, horariosSemana, cambios[fecha]),
      sesiones: porFecha[fecha] ?? [],
      toleranciaMin,
      ahora,
    });
  }
  const enRango = new Set(fechas);
  return { dias, salidasSueltas: salidasSueltas.filter((r) => enRango.has(fechaLocal(r.ts))) };
}

/**
 * Pago de horas extra autorizadas en la quincena, semana por semana (lunes a domingo).
 * Las extras de días de la misma semana que caen en la quincena anterior
 * cuentan para el tope de 9 horas dobles, pero no se vuelven a pagar.
 * extras: { fecha: minutosAutorizados } (debe incluir desde el lunes de la semana de "inicio").
 */
export function calcularExtras({ inicio, fin, extras, valorHora }) {
  const fechas = Object.keys(extras).filter((f) => f >= lunesDe(inicio) && f <= fin).sort();
  const acumuladoSemana = {};
  let minutosDobles = 0;
  let minutosTriples = 0;
  for (const f of fechas) {
    const semana = lunesDe(f);
    const antes = acumuladoSemana[semana] ?? 0;
    const min = Math.max(0, extras[f] || 0);
    acumuladoSemana[semana] = antes + min;
    if (f < inicio) continue;
    const dobles = Math.max(0, Math.min(min, MINUTOS_DOBLES_SEMANA - antes));
    minutosDobles += dobles;
    minutosTriples += min - dobles;
  }
  const pagoDobles = redondear((minutosDobles / 60) * valorHora * 2);
  const pagoTriples = redondear((minutosTriples / 60) * valorHora * 3);
  return { minutosDobles, minutosTriples, pagoDobles, pagoTriples, pago: redondear(pagoDobles + pagoTriples) };
}

// ¿La persona ya trabajaba aquí (y no se había dado de baja) en esa fecha?
export function activoEn(empleado, fecha) {
  if (empleado.fecha_ingreso && fecha < empleado.fecha_ingreso) return false;
  if (empleado.fecha_baja && fecha > empleado.fecha_baja) return false;
  return true;
}

/**
 * Nómina de una quincena para un empleado con sueldo fijo quincenal.
 *  - Salario diario = sueldo quincenal / 15.
 *  - Si entró o salió a media quincena, se paga sólo por los días que estuvo.
 *  - Valor de la hora = salario diario / horas de jornada (8 por defecto).
 *  - Falta: se descuenta un día de salario.
 *  - Retardo (más de la tolerancia): se descuentan los minutos desde la hora de entrada.
 *  - Salida antes de tiempo (más de la tolerancia): se descuentan esos minutos.
 *  - Horas extra: sólo las autorizadas; dobles hasta 9 h por semana, triples después.
 */
export function calcularNomina({
  empleado, inicio, fin, fechas, horariosSemana, cambios, registros, extras,
  toleranciaMin, horasJornada, ahora,
}) {
  const sueldoQuincenal = Number(empleado.sueldo_quincenal) || 0;
  const salarioDiario = sueldoQuincenal / 15;
  const valorHora = salarioDiario / horasJornada;
  const todas = fechas;
  fechas = todas.filter((f) => activoEn(empleado, f));
  const sueldo = fechas.length === todas.length ? sueldoQuincenal : redondear(fechas.length * salarioDiario);
  const { dias, salidasSueltas } = analizarFechas({ fechas, horariosSemana, cambios, registros, toleranciaMin, ahora });

  const lista = fechas.map((f) => dias[f]);
  const faltas = lista.filter((d) => d.estado === 'falta').map((d) => d.fecha);
  const conRetardo = lista.filter((d) => d.minutosRetardo > 0);
  const minutosRetardo = conRetardo.reduce((t, d) => t + d.minutosRetardo, 0);
  const conSalidaTemprana = lista.filter((d) => d.minutosSalidaTemprana > 0);
  const minutosSalidaTemprana = conSalidaTemprana.reduce((t, d) => t + d.minutosSalidaTemprana, 0);

  const descuentoFaltas = redondear(faltas.length * salarioDiario);
  const descuentoRetardos = redondear((minutosRetardo / 60) * valorHora);
  const descuentoSalidas = redondear((minutosSalidaTemprana / 60) * valorHora);
  // Extras autorizadas de días en que ya no trabajaba aquí no se pagan.
  extras = Object.fromEntries(Object.entries(extras).filter(([f]) => activoEn(empleado, f)));
  const horasExtra = calcularExtras({ inicio, fin, extras, valorHora });

  const pendientes = {
    incompletos: lista.filter((d) => d.estado === 'incompleto').map((d) => d.fecha),
    salidasSueltas: salidasSueltas.map((r) => fechaLocal(r.ts)),
    extrasSinRevisar: lista.filter((d) => d.minutosExtra > 0 && !(d.fecha in extras)).map((d) => d.fecha),
  };

  const total = redondear(Math.max(0,
    sueldo - descuentoFaltas - descuentoRetardos - descuentoSalidas + horasExtra.pago));

  return {
    empleadoId: empleado.id, nombre: empleado.nombre, inicio, fin,
    sueldoQuincenal, sueldo, diasPagados: fechas.length, diasQuincena: todas.length,
    salarioDiario: redondear(salarioDiario), valorHora: redondear(valorHora),
    dias,
    faltas, descuentoFaltas,
    numRetardos: conRetardo.length, minutosRetardo, descuentoRetardos,
    numSalidasTempranas: conSalidaTemprana.length, minutosSalidaTemprana, descuentoSalidas,
    horasExtra,
    minutosTrabajados: lista.reduce((t, d) => t + d.minutosTrabajados, 0),
    pendientes,
    total,
  };
}
