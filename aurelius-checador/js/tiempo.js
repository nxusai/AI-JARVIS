// Utilidades de fechas en horario de la Ciudad de México.
// Las fechas "de calendario" se manejan como texto 'AAAA-MM-DD'.

export const ZONA = 'America/Mexico_City';

const formatoPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

export function partesLocales(instante) {
  const p = {};
  for (const { type, value } of formatoPartes.formatToParts(new Date(instante))) p[type] = value;
  return {
    anio: +p.year, mes: +p.month, dia: +p.day,
    hora: +p.hour, minuto: +p.minute, segundo: +p.second,
  };
}

const dos = (n) => String(n).padStart(2, '0');

export function fechaLocal(instante) {
  const p = partesLocales(instante);
  return `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`;
}

export function horaLocal(instante) {
  const p = partesLocales(instante);
  return `${dos(p.hora)}:${dos(p.minuto)}`;
}

// Hora en formato de 12 horas: "8:05 a. m."
export function hora12(instante) {
  const p = partesLocales(instante);
  const h = p.hora % 12 || 12;
  return `${h}:${dos(p.minuto)} ${p.hora < 12 ? 'a. m.' : 'p. m.'}`;
}

// Minutos que la zona está adelantada (negativo = atrasada) respecto a UTC en ese instante.
function desfaseMin(instante) {
  const p = partesLocales(instante);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return Math.round((comoUtc - Math.floor(+instante / 1000) * 1000) / 60000);
}

// Convierte una fecha y hora de la CDMX ('2026-10-10', '08:30') al instante real.
export function aInstante(fecha, hora) {
  const [a, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const supuesto = Date.UTC(a, m - 1, d, h, mi);
  let resultado = supuesto - desfaseMin(new Date(supuesto)) * 60000;
  resultado = supuesto - desfaseMin(new Date(resultado)) * 60000;
  return new Date(resultado);
}

export function sumarDias(fecha, n) {
  const [a, m, d] = fecha.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return `${x.getUTCFullYear()}-${dos(x.getUTCMonth() + 1)}-${dos(x.getUTCDate())}`;
}

// 0 = domingo ... 6 = sábado
export function diaSemana(fecha) {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

export function lunesDe(fecha) {
  return sumarDias(fecha, -((diaSemana(fecha) + 6) % 7));
}

export function ultimoDiaMes(anio, mes) {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// Quincena que contiene la fecha: del 1 al 15 o del 16 al fin de mes.
export function quincenaDe(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const base = `${a}-${dos(m)}`;
  return d <= 15
    ? { inicio: `${base}-01`, fin: `${base}-15` }
    : { inicio: `${base}-16`, fin: `${base}-${dos(ultimoDiaMes(a, m))}` };
}

export const quincenaAnterior = (q) => quincenaDe(sumarDias(q.inicio, -1));
export const quincenaSiguiente = (q) => quincenaDe(sumarDias(q.fin, 1));

export function rangoFechas(inicio, fin) {
  const fechas = [];
  for (let f = inicio; f <= fin; f = sumarDias(f, 1)) fechas.push(f);
  return fechas;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const nombreMes = (mes) => MESES[mes - 1];
export const nombreDia = (dia) => DIAS[dia];

// "sábado 10 de octubre"
export function fechaLarga(fecha) {
  const [, m, d] = fecha.split('-').map(Number);
  return `${DIAS[diaSemana(fecha)]} ${d} de ${MESES[m - 1]}`;
}

// "1 al 15 de octubre de 2026"
export function nombreQuincena(q) {
  const [a, m, d1] = q.inicio.split('-').map(Number);
  const d2 = +q.fin.split('-')[2];
  return `${d1} al ${d2} de ${MESES[m - 1]} de ${a}`;
}

// "1 h 05 min", "45 min"
export function duracion(minutos) {
  const m = Math.round(minutos);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${dos(m % 60)} min`;
}
