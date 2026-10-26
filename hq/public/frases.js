// El saludo de Inicio y la frase del día que se ve en todas las hojas.
//
// Cambian una vez al día (a medianoche, hora de quien entra) y todos los del
// mismo grupo ven la misma frase ese día. Hay dos juegos: el del dueño
// (mentalidad de dueño de negocio) y el del equipo (excelencia en su trabajo,
// confianza y crecer dentro de NXUS).

const SALUDOS = [
  (n) => `Hola${n ? ` ${n}` : ''}`,
  (n) => `Qué onda${n ? `, ${n}` : ''}`,
  (n) => `¿Qué tal${n ? `, ${n}` : ''}?`,
  (n) => `Qué gusto verte${n ? `, ${n}` : ''}`,
  (n) => `A darle${n ? `, ${n}` : ''}`,
  (n) => `De vuelta al juego${n ? `, ${n}` : ''}`,
  (n) => `Arriba${n ? `, ${n}` : ''}`,
  (n) => `Listos para hoy${n ? `, ${n}` : ''}`,
]

const DUENO = [
  'El empleado vende su tiempo. El dueño construye algo que trabaja sin él. Hoy construye.',
  'Nadie va a cuidar tu negocio como tú. Por eso tu negocio no puede depender solo de ti.',
  'Un jefe da órdenes. Un dueño diseña sistemas para que las órdenes sobren.',
  'Cada cliente que cierras hoy es un ladrillo de algo que nadie más ve todavía.',
  'La comodidad es el sueldo más caro que existe: se cobra en años.',
  'No compitas por precio. Compite por ser imposible de reemplazar.',
  'El dinero sigue a la claridad. Decide hoy qué es lo único que mueve tu negocio.',
  'Los que mandan no son los que más trabajan, son los que mejor deciden.',
  'Tu meta no es tener trabajo. Es tener un negocio que te dé libertad.',
  'Delegar no es perder el control: es ganar tiempo para lo que solo tú puedes hacer.',
  'Lo que no se mide no se mejora. Lo que no se cobra no se valora.',
  'Un negocio grande es un negocio pequeño que nunca dejó de hacer lo correcto.',
  'Piensa en diez años, actúa en diez minutos.',
  'Quien controla la relación con el cliente controla el negocio.',
  'La visión es tuya. Si tú no la cargas, nadie la va a cargar.',
  'Cada "no" de un cliente es información. Cada "sí" es responsabilidad.',
  'No necesitas permiso para construir algo grande. Necesitas constancia.',
  'Tu agenda dice más de tu futuro que tus sueños.',
  'Los dueños no esperan el momento perfecto: lo fabrican.',
  'Si tu negocio se detiene cuando tú descansas, todavía tienes un empleo.',
  'Rodéate de gente que sea la mejor en lo suyo; tú sé el mejor en saber hacia dónde van.',
  'La reputación se construye en años y se pierde en un día. Cuídala en cada entrega.',
  'El margen es oxígeno. Sin margen no hay crecimiento, solo cansancio.',
  'Hoy alguien está construyendo lo que tú solo estás pensando. Muévete.',
  'Liderar es poner el estándar tan alto que el equipo se mida contra él.',
  'La riqueza no está en lo que ganas, sino en lo que construyes y sigue ganando.',
  'El dueño ve el tablero completo; el resto ve su casilla. Nunca pierdas el tablero.',
  'Una decisión a tiempo vale más que una decisión perfecta tarde.',
  'No vendas horas. Vende resultados.',
  'Tu competencia no es la otra agencia: es tu propia excusa.',
  'Los sistemas crecen; las personas se cansan. Construye sistemas.',
  'Cobrar lo que vales es respeto: a ti y a tu trabajo.',
  'La gente sigue a quien sabe a dónde va. Ten claro a dónde vas.',
  'La disciplina de hoy es la libertad de mañana.',
  'Un buen negocio resuelve un problema. Uno grande lo resuelve una y otra vez sin ti.',
  'Invierte en lo que se multiplica: personas, sistemas y reputación.',
  'Crecer duele. Quedarse igual duele más y no paga.',
  'Ser dueño es elegir tus problemas. Elige problemas grandes.',
  'Cada proceso que documentas es una hora que nunca vuelves a perder.',
  'El cliente compra confianza; el servicio solo la confirma.',
  'Lo urgente te mantiene ocupado. Lo importante te hace dueño.',
  'Construye algo que se pueda heredar, no solo algo que pague el mes.',
  'No hay techo para quien es dueño de su tiempo.',
  'La mejor hora del día es la que pasas pensando en el negocio, no dentro de él.',
  'Si tu meta no te incomoda, es demasiado pequeña.',
  'Los negocios grandes se construyen con las llamadas que nadie quiere hacer.',
  'Tu firma vale lo que valen tus entregas.',
  'Quien domina sus números domina su destino.',
  'Cada día que no vendes, tu negocio se hace un poco más pequeño. Vende.',
  'Piensa como dueño, decide como inversionista, ejecuta como el mejor.',
  'La paciencia construye; la prisa solo factura una vez.',
  'Tu negocio es el reflejo de tus estándares. Súbelos.',
  'El mercado premia a quien resuelve, no a quien se queja.',
  'Antes de crecer en tamaño, crece en estándares.',
  'Tu red es tu patrimonio: cuida cada relación como un activo.',
  'La ventaja del dueño es ver primero. Sal a ver.',
  'Nada escala sin claridad: qué vendes, a quién y por qué tú.',
  'Ganar un cliente es una venta. Quedártelo cinco años es un negocio.',
  'Lo que hagas hoy decide el tamaño de NXUS mañana.',
  'El que construye el sistema nunca compite con el que solo lo opera.',
]

const EQUIPO = [
  'La excelencia no es un acto: es la forma en que entregas cada cosa, aunque nadie la revise.',
  'Tu trabajo lleva el nombre de NXUS. Hazlo digno de ese nombre.',
  'Un equipo fuerte se construye con personas en las que se puede confiar sin preguntar dos veces.',
  'Entregar a tiempo es una forma de respeto: al cliente, al equipo y a ti.',
  'El detalle que nadie pidió es el que hace que el cliente se quede.',
  'Haz tu parte tan bien que el equipo no pueda imaginarse sin ti.',
  'Los mejores no esperan instrucciones perfectas: preguntan, entienden y ejecutan.',
  'Cada entrega es tu carta de presentación.',
  'Crecer es aprender algo nuevo cada semana y aplicarlo el lunes.',
  'La confianza se gana cumpliendo lo pequeño, todos los días.',
  'Un buen profesional resuelve; uno excelente previene.',
  'El talento abre la puerta; la constancia te hace subir.',
  'Cuando todo el equipo rema hacia el mismo lado, el barco llega lejos y todos con él.',
  'No hay trabajo pequeño cuando lo haces con estándares grandes.',
  'Tu reputación dentro del equipo se escribe con cada tarea que cierras.',
  'La calidad no se negocia, ni cuando hay prisa.',
  'Escucha la instrucción completa, entiende el objetivo y luego supéralo.',
  'Los que crecen son los que hacen más fácil el trabajo de los demás.',
  'La actitud es la mitad del trabajo; la otra mitad es terminarlo bien.',
  'Ser confiable es un superpoder raro. Tenlo.',
  'Lo que hoy practicas con disciplina, mañana lo haces con maestría.',
  'Un cliente feliz es el resultado de muchas personas haciendo bien su parte.',
  'Revisa dos veces, entrega una vez.',
  'Pide retroalimentación como quien busca oro: ahí está tu siguiente nivel.',
  'El orgullo profesional se nota en lo que entregas un viernes a las seis.',
  'Cumple tu palabra y tu palabra empezará a valer más.',
  'Los grandes equipos no tienen estrellas sueltas: tienen piezas que encajan.',
  'Hoy alguien va a usar lo que hagas. Hazlo pensando en esa persona.',
  'La diferencia entre bueno y excelente casi siempre son diez minutos más de cuidado.',
  'Cuando tu líder confía en ti, devuélvele resultados, no excusas.',
  'Entiende el porqué de cada tarea y tu trabajo dejará de ser solo una tarea.',
  'Las oportunidades llegan a quien ya demostró que puede con lo que tiene.',
  'Un problema avisado a tiempo vale más que uno bien escondido.',
  'La excelencia es un hábito que se construye una entrega a la vez.',
  'El equipo gana cuando cada quien domina su lugar.',
  'Haz que tu trabajo hable antes que tú.',
  'La organización de hoy es la tranquilidad de mañana.',
  'No compitas con tus compañeros: compite con tu versión de ayer.',
  'Ser parte de algo que crece es la mejor forma de crecer.',
  'La puntualidad, la claridad y el cuidado nunca pasan de moda.',
  'Tu mejor currículum es la confianza de tu equipo.',
  'Cuando no sepas, pregunta. Cuando sepas, enseña.',
  'Las marcas que admiramos las hicieron equipos obsesionados con los detalles.',
  'Lo que se entrega con prisa se corrige dos veces.',
  'Haz que tu área funcione sin sorpresas y las responsabilidades grandes llegarán solas.',
  'Celebra los logros del equipo como propios: lo son.',
  'Trabaja de forma que tu líder pueda dormir tranquilo.',
  'La creatividad brilla más con orden y fechas claras.',
  'Hoy es un buen día para hacer algo de lo que te sientas orgulloso.',
  'Cada cliente de NXUS confía en nosotros. Cada tarea es una forma de no fallarle.',
  'Domina tu oficio y siempre habrá un lugar importante para ti.',
  'El esfuerzo constante siempre se nota, aunque tarde.',
  'Un "listo" bien hecho vale más que diez "casi".',
  'La lealtad se demuestra en los días difíciles, no en los fáciles.',
  'Sigue el proceso, mejóralo con ideas y comparte lo que aprendas.',
  'Los mejores equipos se cuidan entre sí y cuidan la marca que los une.',
  'Tu energía cambia el ritmo de todo el equipo. Tráela.',
  'Enfócate en lo que depende de ti y hazlo excelente.',
  'Llegar lejos es un trabajo de equipo; nadie llega solo.',
  'Lo que hoy entregas construye el NXUS del que mañana serás parte con orgullo.',
]

/** Días desde 2020, contados a medianoche de quien entra. */
function hoy(fecha = new Date()) {
  return Math.floor((Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) - Date.UTC(2020, 0, 1)) / 864e5)
}

/** El saludo de hoy, con el primer nombre de la persona (sin nombre, solo el saludo). */
export function saludo(nombre, fecha) {
  const n = String(nombre || '').trim().split(/\s+/)[0] || ''
  return SALUDOS[hoy(fecha) % SALUDOS.length](n)
}

/** La frase de hoy: la del dueño para el admin y la del equipo para los demás. */
export function fraseDelDia(esDueno, fecha) {
  const lista = esDueno ? DUENO : EQUIPO
  // Un paso que no divide al total: recorre todas antes de repetir, pero sin ir en orden.
  return lista[(hoy(fecha) * 7) % lista.length]
}
