// La frase del día del Centro de trabajo, solo para el cliente (dueños,
// gerentes y quien trabaje en sus empresas). Cambia a medianoche: dos días
// sale una frase de la lista y el tercero una con sus propios números
// (entregas, aprobadas, archivos, contenidos); si ese número está en cero,
// sale una de la lista.

const FRASES = [
  'Las marcas que crecen no improvisan. Tienen un equipo que piensa en ellas todos los días.',
  'Tu competencia publica. Tu marca construye.',
  'Detrás de cada etiqueta, catálogo y post hay un equipo que conoce tu marca de memoria.',
  'Tú te enfocas en vender. NXUS se enfoca en que tu marca esté a la altura.',
  'Cada tarea que pides aquí es una cosa menos en tu cabeza.',
  'Un buen diseño se ve. Uno estratégico se vende.',
  'Las grandes marcas no se hacen solas. Se hacen con el equipo correcto.',
  'Crecer es más fácil cuando no tienes que explicarle tu marca a nadie dos veces.',
  'Tu marca merece la misma obsesión por el detalle que tú le pones a tu producto.',
  'Aquí todo queda guardado, ordenado y listo para cuando lo necesites.',
  'Lo que pides hoy ya está en manos de gente que sabe lo que hace.',
  'En NXUS no entregamos archivos: entregamos marcas que se ven listas para crecer.',
  'La constancia gana mercados. Por eso tu marca no se detiene.',
  'Tu producto es de primera. Tu imagen también tiene que serlo.',
  'Las ventas empiezan por los ojos. Nosotros cuidamos lo que tu cliente ve primero.',
  'Ordenar tu marca hoy es vender más mañana.',
  'Tu tiempo vale para dirigir tu empresa. Lo demás, déjalo en manos de tu equipo NXUS.',
  'Una marca clara se recuerda. Una marca recordada se compra.',
  'Mientras otros buscan proveedor, tú ya tienes un equipo.',
  'Cada pieza que hacemos lleva tu nombre. Por eso la hacemos con el nuestro en juego.',
  'El crecimiento se construye con decisiones correctas, una tras otra. Aquí las tomamos contigo.',
  'Tu marca habla por ti cuando no estás. Nos aseguramos de que hable bien.',
  'Detalles que tu cliente no nota, pero siente. En eso trabajamos.',
  'NXUS trabaja tu marca como si fuera nuestra.',
  'Lo que hoy se ve profesional, mañana se paga solo.',
  'Un catálogo bien hecho vende aunque nadie esté explicando.',
  'Tu equipo de vendedoras sale mejor armado cuando la marca está bien hecha.',
  'Pides, trabajamos, revisas, apruebas. Simple para ti, exigente para nosotros.',
  'Cada mes tu marca puede verse mejor que el anterior. Ese es nuestro estándar.',
  'La diferencia entre una marca más y una marca líder está en los detalles.',
  'Con NXUS, tu marca tiene un equipo detrás todos los días, no solo cuando hay prisa.',
  'Las empresas que crecen tienen algo en común: alguien cuidando su imagen sin descanso.',
  'Tu historia merece contarse bien. Para eso estamos.',
  'No hay trabajo pequeño cuando se trata de tu marca.',
  'Lo urgente para ti es prioridad para nosotros.',
  'Tu Centro de trabajo guarda la historia de tu marca: cada etiqueta, cada versión, cada logro.',
  'Una marca fuerte abre puertas que el precio solo no abre.',
  'Cada aprobación tuya es un paso más de tu marca hacia donde quieres llevarla.',
  'Tu competencia ve tus resultados. No ve el equipo que hay detrás.',
  'En NXUS medimos nuestro trabajo por cómo crece tu marca, no por cuántos archivos mandamos.',
  'Cuando tu imagen está resuelta, tú solo te dedicas a crecer.',
  'Lo que hoy construimos juntos es lo que mañana te va a diferenciar.',
  'Estamos atentos a tu marca incluso cuando tú no lo estás.',
  'Una marca seria inspira confianza antes de la primera venta.',
  'Tus clientes compran tu producto. Se quedan por lo que tu marca les hace sentir.',
  'Con el equipo correcto, crecer deja de ser cuestión de suerte.',
  'NXUS: tu equipo de marca, sin que tengas que contratar uno.',
  'Cada versión mejor que la anterior. Ese es el trato.',
  'Tu marca no compite sola. Compite con todo un equipo detrás.',
  'Hacerlo bien a la primera es respeto por tu tiempo.',
  'Las empresas que se ven grandes, se vuelven grandes.',
  'Pide con confianza: aquí nada se pierde y todo se cumple.',
  'Tu visión, nuestra ejecución.',
  'El mercado cambia rápido. Tu marca, con NXUS, cambia primero.',
  'Hoy es buen día para pedir eso que tenías pendiente.',
  'Un empaque bien pensado es el mejor vendedor en el anaquel.',
  'Lo que tus vendedoras comparten hoy fue pensado para vender.',
  'Tu marca está en buenas manos. En las nuestras.',
  'Crecer ordenado es crecer dos veces.',
  'Gracias por confiar tu marca a NXUS. Cada día trabajamos para merecerlo.',
]

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

// Las frases con sus números; cada una se usa solo si su número no es cero.
const CON_NUMEROS = [
  (d) => d.entregadasMes > 0 && `Este mes tu equipo NXUS ya te entregó <b>${plural(d.entregadasMes, 'trabajo', 'trabajos')}</b>.`,
  (d) => d.aprobadas > 0 && `Llevamos <b>${plural(d.aprobadas, 'trabajo aprobado', 'trabajos aprobados')}</b> juntos. Vamos por más.`,
  (d) => d.archivos > 0 && `Tu Biblioteca ya guarda <b>${plural(d.archivos, 'archivo', 'archivos')}</b> de tu marca, siempre a la mano.`,
  (d) => d.contenidosSemana > 0 && `Esta semana hay <b>${plural(d.contenidosSemana, 'contenido', 'contenidos')}</b> listos para tus vendedoras.`,
  (d) =>
    d.porRevisar > 0 &&
    `Tienes <b>${plural(d.porRevisar, 'trabajo', 'trabajos')}</b> ${d.porRevisar === 1 ? 'listo' : 'listos'} para revisar. Tu marca avanza cuando tú apruebas.`,
]

/** Días desde 2020, contados a medianoche de quien entra. */
function hoy(fecha = new Date()) {
  return Math.floor((Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) - Date.UTC(2020, 0, 1)) / 864e5)
}

/**
 * La frase de hoy, en HTML (los números van en negritas).
 * datos: { entregadasMes, aprobadas, archivos, contenidosSemana, porRevisar }
 */
export function fraseDelDia(datos = {}, fecha) {
  const d = hoy(fecha)
  if (d % 3 === 2) {
    const tipo = Math.floor(d / 3)
    for (let i = 0; i < CON_NUMEROS.length; i++) {
      const f = CON_NUMEROS[(tipo + i) % CON_NUMEROS.length](datos)
      if (f) return f
    }
  }
  // Contando solo los días de frase de la lista, con un paso que no divide al
  // total: pasa por las 60 antes de repetir.
  const k = d - Math.floor(d / 3)
  return FRASES[(k * 7) % FRASES.length].replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
}
