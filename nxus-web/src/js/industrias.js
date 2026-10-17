// Elige tu industria: qué hace tu IA en ella y un ejemplo de conversación.
import { getName } from './core.js';

const IND = [
  { e: '🍽️', n: 'Restaurantes', does: [['Toma pedidos', 'por WhatsApp e Instagram y los manda a cocina'], ['Reservaciones', 'con confirmación y recordatorio automático'], ['Inventario', 'de insumos con alertas antes de que se acaben'], ['Reseñas', 'pide opinión a clientes felices y responde las malas']], chat: ['¿Cómo nos fue anoche?', 'Vendimos $41,200 (+8%). El platillo estrella fue la birria. Mañana falta cebolla y tortilla: ya lo pedí al proveedor.'] },
  { e: '🚚', n: 'Distribución', does: [['Pedidos', 'de tus clientes por chat, directo a tu sistema'], ['Rutas', 'y aviso al cliente con su hora de llegada'], ['Etiquetas', 'y documentos impresos sin capturar nada'], ['Cobranza', 'con recordatorios y estado de cuenta']], chat: ['¿Qué rutas van tarde?', 'Solo la norte, 25 min por tráfico. Ya avisé a los 3 clientes afectados y al chofer.'] },
  { e: '🏥', n: 'Clínicas', does: [['Agenda', 'citas 24/7 y confirma un día antes'], ['Recepción', 'resuelve dudas de precios, horarios y preparación'], ['Seguimiento', 'post consulta y recordatorio de próxima cita'], ['Expedientes', 'ordenados y fáciles de consultar']], chat: ['¿Cuántos pacientes tenemos mañana?', '18 citas. 2 cancelaron y ya llené sus espacios con la lista de espera.'] },
  { e: '🏠', n: 'Inmobiliarias', does: [['Leads', 'calificados al instante: presupuesto, zona y tiempos'], ['Visitas', 'agendadas con el asesor disponible'], ['Fichas', 'de propiedades y videos generados en minutos'], ['Seguimiento', 'hasta la firma, sin que nadie se enfríe']], chat: ['¿Algún lead caliente hoy?', 'Sí: Carlos busca depa de 2 recámaras en la Roma, hasta $4.5M. Le agendé visita a las 5 con Ana.'] },
  { e: '🛍️', n: 'Retail', does: [['Ventas', 'en chat con catálogo, tallas y existencias'], ['Promociones', 'creadas y publicadas en tus redes'], ['Inventario', 'entre sucursales en tiempo real'], ['Clientes', 'frecuentes con mensajes personalizados']], chat: ['¿Qué producto se está moviendo?', 'Los tenis blancos talla 26: quedan 4 en Centro y 12 en Norte. ¿Muevo 6 a Centro?'] },
  { e: '🏭', n: 'Manufactura', does: [['Producción', 'planeada con los pedidos reales'], ['Compras', 'de materia prima a tiempo y al mejor precio'], ['Calidad', 'con reportes y fotos que la IA revisa'], ['Mantenimiento', 'programado antes de que algo falle']], chat: ['¿Llegamos con el pedido del viernes?', 'Sí, con 6 horas de margen. Falta resina para la próxima semana: tengo 3 cotizaciones listas.'] },
  { e: '⚖️', n: 'Despachos', does: [['Prospectos', 'atendidos y filtrados antes de la cita'], ['Documentos', 'redactados con tus plantillas'], ['Plazos', 'vigilados con alertas para cada caso'], ['Cobranza', 'de honorarios sin incomodidades']], chat: ['¿Qué vence esta semana?', '3 plazos: contestación del caso Pérez (miércoles), y dos promociones el viernes. Borradores en tu Drive.'] },
  { e: '🎓', n: 'Escuelas', does: [['Inscripciones', 'con informes, recorridos y documentos'], ['Padres', 'informados por WhatsApp sin saturar a nadie'], ['Pagos', 'de colegiaturas con recordatorios amables'], ['Contenido', 'para redes que atrae nuevas familias']], chat: ['¿Cómo va la inscripción?', '42 familias interesadas, 17 recorridos agendados y 9 inscritos. Faltan documentos de 3.'] },
  { e: '🏨', n: 'Hoteles', does: [['Reservas', 'directas sin comisiones de terceros'], ['Huéspedes', 'atendidos en su idioma, a cualquier hora'], ['Upselling', 'de tours, spa y restaurante'], ['Reputación', 'en Google y TripAdvisor']], chat: ['¿Ocupación del fin?', '87%. Ofrecí upgrade a 6 reservas y 2 aceptaron: +$5,800 extra.'] },
  { e: '💪', n: 'Gimnasios', does: [['Prospectos', 'convertidos con clase de prueba'], ['Renovaciones', 'antes de que la membresía venza'], ['Clases', 'y lugares reservados desde el chat'], ['Retención', 'detecta a quien dejó de venir y lo motiva']], chat: ['¿Quién está por irse?', '11 socios no vienen hace 2 semanas. Les mandé un mensaje con una clase gratis de regreso.'] },
  { e: '🚗', n: 'Autos', does: [['Leads', 'de anuncios atendidos en segundos'], ['Pruebas de manejo', 'agendadas con el vendedor'], ['Servicio', 'recordatorios de mantenimiento'], ['Seguimiento', 'del financiamiento paso a paso']], chat: ['¿Cuántas pruebas de manejo hay?', '7 hoy. La de las 4 pm viene por la SUV híbrida y ya tiene crédito preaprobado.'] },
  { e: '💇', n: 'Salones y spas', does: [['Citas', 'por chat con el estilista favorito'], ['Recordatorios', 'que reducen las faltas'], ['Paquetes', 'y promociones en fechas clave'], ['Redes', 'con el antes y después de cada trabajo']], chat: ['¿Hay huecos mañana?', '3 espacios: 11, 13:30 y 17:00. Ya los ofrecí a tu lista de clientas frecuentes.'] },
  { e: '📊', n: 'Contadores', does: [['Documentos', 'de clientes recolectados y ordenados'], ['Facturas', 'leídas y clasificadas solas'], ['Fechas', 'fiscales con avisos a cada cliente'], ['Reportes', 'mensuales listos para enviar']], chat: ['¿Quién no ha mandado sus papeles?', '6 clientes. Les recordé hoy por WhatsApp; 2 ya enviaron todo.'] },
  { e: '🏗️', n: 'Construcción', does: [['Obra', 'avances con fotos que la IA resume'], ['Materiales', 'pedidos y entregas coordinadas'], ['Cotizaciones', 'rápidas con tus precios unitarios'], ['Cuadrillas', 'asistencia y pagos al día']], chat: ['¿Cómo va la obra de Juriquilla?', '68% de avance, 2 días adelantados. El concreto del jueves ya está confirmado.'] },
  { e: '🛒', n: 'E-commerce', does: [['Atención', 'de pedidos, envíos y devoluciones'], ['Carritos', 'abandonados recuperados por chat'], ['Catálogo', 'con descripciones y fotos generadas'], ['Anuncios', 'optimizados según tus ventas reales']], chat: ['¿Recuperamos carritos?', '23 de 61 compraron después del mensaje: $18,900 que se iban a perder.'] },
  { e: '🐾', n: 'Veterinarias', does: [['Citas', 'y vacunas con recordatorio al dueño'], ['Urgencias', 'filtradas y canalizadas al instante'], ['Tienda', 'de alimento con reorden automático'], ['Historial', 'de cada mascota siempre a la mano']], chat: ['¿Qué vacunas tocan esta semana?', '14 mascotas. Ya avisé a sus dueños y 9 confirmaron cita.'] },
];

const picker = document.querySelector('.ind-picker');
const panel = document.getElementById('panel');
picker.innerHTML = IND.map((x, i) => `<button class="ind-btn" role="tab" data-i="${i}"><span>${x.e}</span><b>${x.n}</b></button>`).join('');
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

function show(i, scroll) {
  const x = IND[i];
  picker.querySelectorAll('.ind-btn').forEach((b) => { const on = +b.dataset.i === i; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  panel.querySelector('.ind-big').textContent = x.e;
  panel.querySelector('h3').innerHTML = `En ${esc(x.n.toLowerCase())}, <span class="grad-text">${esc(getName())}</span>:`;
  panel.querySelector('.ind-does').innerHTML = x.does.map(([b, t], k) => `<li style="animation-delay:${k * .08}s"><i>✓</i><span><b>${b}</b> ${t}</span></li>`).join('');
  panel.querySelector('.ind-msgs').innerHTML =
    `<div class="msg me" style="animation-delay:.1s;margin-left:auto">${esc(x.chat[0])}</div>` +
    `<div class="msg ai" style="animation-delay:.7s">${esc(x.chat[1])}</div>`;
  if (scroll && innerWidth < 860) panel.scrollIntoView({ behavior: 'smooth' });
}
picker.addEventListener('click', (e) => {
  const b = e.target.closest('.ind-btn');
  if (b) show(+b.dataset.i, true);
});
show(0);
