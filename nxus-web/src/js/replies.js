// Lo que contesta la IA del demo cuando el visitante le escribe. Es un guion
// local (sin IA real todavía): reconoce el tema y responde como lo haría su asistente.
const R = [
  {
    k: /hola|buen[oa]s|hey|qué tal|que tal/,
    s: [{ ai: '¡Hola! Soy {name}, la IA de tu empresa 👋\nPídeme lo que harías con tu mejor empleado: ventas, pedidos, agenda, facturas, redes, reportes…' }],
  },
  {
    k: /venta|vend|ingreso|factur(ó|o) hoy|cuánto (llevamos|vendimos)/,
    s: [
      { ai: 'Hoy van **$48,320** en 37 pedidos, 12% arriba del martes pasado 📈' },
      { ai: { chart: [42, 55, 38, 64, 71, 58, 86], text: 'Últimos 7 días. El mejor producto: **combo familiar** (31%).' } },
    ],
  },
  {
    k: /pedido|orden|envío|envio|entrega|ruta|chofer/,
    s: [
      { ai: 'Salieron **38 pedidos** hoy. 3 de la ruta norte van tarde.' },
      { ai: 'Ya le avisé al chofer y le mandé a cada cliente su hora nueva por WhatsApp ✅' },
    ],
  },
  {
    k: /inventario|stock|existencia|almac|compra|proveedor/,
    s: [
      { ai: 'Quedan **14 cajas** de queso fresco: alcanzan para 2 días al ritmo de esta semana.' },
      { ai: '¿Le pido 40 cajas al proveedor de siempre? Mismo precio que la última vez.' },
      { keys: ['✅ Sí, pídelas', '✏️ Cambiar cantidad'], then: [[{ ai: '[ok]Listo.[/ok] Orden enviada al proveedor. Llega el jueves y ya está en tu calendario 📦' }], [{ ai: 'Claro, ¿cuántas cajas quieres?' }]] },
    ],
  },
  {
    k: /agenda|cita|reuni|calendario|junta|mañana/,
    s: [
      { ai: 'Mañana tienes 3 cosas:\n• 10:00 reunión con proveedor (Meet)\n• 13:30 comida con Carlos\n• 17:00 revisión de campañas' },
      { ai: 'Te bloqueé 9:00 a 10:00 para que prepares la junta. Te recuerdo 15 min antes ⏰' },
    ],
  },
  {
    k: /factura|cobr|pago|deb|cuenta/,
    s: [
      { ai: 'Hay **4 facturas** vencidas por $23,900. La más vieja es de Distribuidora Luna (18 días).' },
      { ai: { doc: 'Recordatorios-cobranza.pdf', size: '4 correos listos · 62 KB', text: '¿Les mando el recordatorio a los 4?' } },
      { keys: ['✅ Mándalos', '👀 Déjame verlos'], then: [[{ ai: '[ok]Enviados.[/ok] Te aviso en cuanto alguien pague 💸' }], [{ ai: 'Te los dejé en tu correo como borradores para que los revises.' }]] },
    ],
  },
  {
    k: /post|public|instagram|tiktok|redes|contenido|reel|video/,
    s: [
      { ai: 'Te armé el post de mañana con la foto del producto nuevo:' },
      { ai: { image: 'gen-a', label: 'post · 1080×1350', text: '“Lo nuevo ya llegó 🔥 Pruébalo este fin de semana con 2x1.” #promo' } },
      { keys: ['✅ Programar 7 pm', '🔁 Otra versión'], then: [[{ ai: '[ok]Programado[/ok] en Instagram, Facebook y TikTok para mañana 7:00 pm 📅' }], [{ ai: 'Va, te hago 3 versiones con otro estilo. Dame 1 minuto 🎨' }]] },
    ],
  },
  {
    k: /anuncio|ads|campaña|campana|publicidad|meta/,
    s: [
      { ai: 'La campaña “Fin de semana” gastó $1,240 y trajo **52 mensajes** (a $23.8 cada uno).' },
      { ai: 'El anuncio B rinde el doble que el A. ¿Le paso el presupuesto de A a B?' },
      { keys: ['✅ Sí, muévelo', '❌ No por ahora'], then: [[{ ai: '[ok]Hecho.[/ok] Lo sigo vigilando y te aviso si algo cambia 🎯' }], [{ ai: 'Ok, lo dejo igual. Te mando el reporte el lunes.' }]] },
    ],
  },
  {
    k: /correo|mail|email|inbox|bandeja/,
    s: [
      { ai: 'Tienes 23 correos nuevos. Solo **3 importan**:\n1. Cliente pide cotización de 200 piezas\n2. El banco confirma tu transferencia\n3. Proveedor cambia precios en noviembre' },
      { ai: '¿Le contesto la cotización con la lista de precios de siempre?' },
    ],
  },
  {
    k: /reporte|resumen|cómo vamos|como vamos|kpi|número|numero/,
    s: [
      { ai: '**Resumen de la semana**\nVentas: $312k (+9%)\nLeads nuevos: 64\nPedidos tarde: 2%\nGasto en anuncios: $8.4k' },
      { ai: { doc: 'Reporte-semanal.pdf', size: '6 páginas · 1.2 MB', text: 'Te lo dejé también en Drive 📁' } },
    ],
  },
  {
    k: /llam|marca|teléfono|telefono/,
    s: [
      { ai: 'Le estoy marcando a Laura con mi voz 📞' },
      { ai: { voice: 'Laura confirmó: mañana a las 11 pasa por el pedido.', dur: '0:09' } },
    ],
  },
  {
    k: /imagen|foto|diseñ|logo|flyer/,
    s: [{ ai: { image: 'gen-b', label: 'generada en 8 s', text: 'Aquí está. ¿La quieres en formato historia también?' } }],
  },
  {
    k: /precio|cuesta|costo|cotiza|plan|paquete/,
    s: [
      { ai: 'Cada IA se diseña a la medida de tu negocio, por eso el precio depende de lo que conectemos 🙂' },
      { ai: 'Agenda una reunión sin costo en **empezar.nxusai.org** y te presentamos tu propuesta.' },
    ],
  },
  {
    k: /gracias|perfecto|excelente|genial|chido|\bva\b/,
    s: [{ ai: 'Para eso estoy 💙 Aquí sigo, 24/7.' }],
  },
];

export function reply(text) {
  const t = text.toLowerCase();
  const hit = R.find((r) => r.k.test(t));
  if (hit) return hit.s;
  return [
    { ai: 'Entendido 👌 En tu empresa real, aquí estaría consultando tus sistemas para contestarte eso.' },
    { ai: 'Prueba preguntarme por **ventas, pedidos, inventario, agenda, facturas, redes o anuncios**.' },
  ];
}
