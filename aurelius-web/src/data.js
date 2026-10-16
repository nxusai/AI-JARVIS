// ─────────────────────────────────────────────────────────────
//  AURELIUS · Datos del sitio
//  Todo lo que el negocio cambia seguido vive aquí: teléfono,
//  horarios, menú, países, preguntas frecuentes y rangos.
//  Lo marcado con «CONFIRMAR» es provisional.
// ─────────────────────────────────────────────────────────────

export const site = {
  name: 'Aurelius',
  city: 'Coacalco',
  price: 259,
  slogan: 'Conquistando el come todo',
  // WhatsApp / teléfono (del menú y de Instagram)
  phoneDisplay: '55 7357 3060',
  phoneIntl: '525573573060',
  instagram: 'https://www.instagram.com/aurelius.mx/',
  facebook: '', // CONFIRMAR: pega aquí el link de Facebook cuando exista
  tiktok: '', // CONFIRMAR: pega aquí el link de TikTok cuando exista
  // Dirección (tal como aparece en Google Maps) — CONFIRMAR
  address: {
    street: 'Plaza Allende, C. Ignacio Allende 20-A N. 2, Zacuauhtitla',
    locality: 'San Francisco Coacalco',
    region: 'Estado de México',
    postalCode: '55700',
  },
  mapsQuery: 'Aurelius Coacalco',
  // Horario — CONFIRMAR (tomado de publicaciones en TikTok)
  // day: 0 = domingo … 6 = sábado; horas en formato 24h
  hours: [
    { days: [0, 1, 2, 3, 4], open: 14, close: 22, label: 'Domingo a jueves', text: '2:00 pm – 10:00 pm' },
    { days: [5, 6], open: 14, close: 24, label: 'Viernes y sábado', text: '2:00 pm – 12:00 am' },
  ],
  // Integración futura de IA para «El Oráculo».
  // Cuando exista un backend, pon aquí su URL. Debe aceptar POST
  // { messages: [{ role, content }] } y responder { reply: "texto" }.
  ai: { endpoint: '' },
};

export const wa = (text) =>
  `https://wa.me/${site.phoneIntl}?text=${encodeURIComponent(text)}`;

export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.mapsQuery)}`;
export const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(site.mapsQuery)}&navigate=yes`;

// La Ruta de la Conquista: lo que entra en el come todo.
export const provinces = [
  {
    id: 'tacos',
    numeral: 'I',
    name: 'Tacos',
    icon: 'taco',
    items: ['Pastor', 'Suadero', 'Bistec', 'Longaniza', 'Enchilada', 'Campechanos', 'Queso'],
    quip: 'Roma no se hizo en un día. Tu orden de pastor, en tres minutos.',
    lore: 'La base de todo imperio.',
  },
  {
    id: 'quesadillas',
    numeral: 'II',
    name: 'Quesadillas',
    icon: 'quesadilla',
    items: ['Pastor', 'Suadero', 'Bistec', 'Longaniza', 'Enchilada', 'Queso'],
    quip: '¿Con queso o sin queso? Aquí no se debate: esto es un imperio, no una democracia.',
    lore: 'El debate más viejo de la Ciudad, resuelto.',
  },
  {
    id: 'flautas',
    numeral: 'III',
    name: 'Flautas',
    icon: 'flauta',
    items: ['Pollo', 'Queso'],
    quip: 'Largas, doradas y crujientes. Como tu lista de pendientes, pero estas sí te las acabas.',
    lore: 'Las únicas flautas que no te hacen bailar.',
  },
  {
    id: 'pozole',
    numeral: 'IV',
    name: 'Pozole',
    icon: 'pozole',
    items: ['Maciza', 'Pollo', 'Surtida'],
    quip: 'El caldo que levanta legiones… y crudas.',
    lore: 'Medicina ancestral del imperio.',
  },
  {
    id: 'chicken',
    numeral: 'V',
    name: 'Chicken Empire',
    icon: 'wing',
    items: ['Alitas', 'Boneless', 'Popcorn Chicken'],
    quip: 'Nosotros te damos las alas para que sigas creyendo en sus palabras.',
    lore: 'Choose your fire: báñalas en el fuego digno de tu temple.',
  },
  {
    id: 'burgers',
    numeral: 'VI',
    name: 'Burgers',
    icon: 'burger',
    items: ['Clásica', 'Hawaiana', 'Tocino'],
    quip: 'La piña no va en la pizza… por eso se la pusimos a la burger.',
    lore: 'Más clásica que decir «el lunes empiezo la dieta».',
  },
  {
    id: 'snacks',
    numeral: 'VII',
    name: 'Snacks',
    icon: 'fries',
    items: ['Papas a la francesa', 'Papas chips', 'Nachos'],
    quip: 'Se llaman francesas, pero nunca han salido de Coacalco.',
    lore: 'Para cuando ya no cabe nada… pero sí cabe.',
  },
];

// Niveles de fuego (el selector «Choose your fire»).
// CONFIRMAR: cuando tengan la lista oficial de salsas se puede
// poner el nombre real de cada una en `sauce`.
export const fireLevels = [
  { name: 'Plebeyo', sauce: 'Sin picante', text: 'Respetable. Hasta los emperadores tienen días tranquilos.' },
  { name: 'Legionario', sauce: 'Picor suave', text: 'Un cosquilleo. Tu abuelita aprobaría.' },
  { name: 'Centurión', sauce: 'Picor medio', text: 'Ya empezaste a sudar con dignidad.' },
  { name: 'Gladiador', sauce: 'Picor fuerte', text: 'Tus lágrimas son de gloria. Pide otra bebida.' },
  { name: 'Emperador', sauce: 'Nivel infierno', text: 'Ni Nerón quemó tanto. Firma aquí tu testamento.' },
];

// Rangos del juego «¿Qué tan conquistador eres?»
export const ranks = [
  { min: 0, name: 'Turista', text: 'Llegaste a ver. Todavía no conquistas nada.' },
  { min: 3, name: 'Plebeyo', text: 'Calentando motores. El comal apenas te conoce.' },
  { min: 6, name: 'Legionario', text: 'Ya marchas con la legión. Desabrocha un botón.' },
  { min: 10, name: 'Centurión', text: 'Cien hombres te siguen. Y el mesero también.' },
  { min: 15, name: 'Gladiador', text: 'El Coliseo grita tu nombre. Tu cinturón, no tanto.' },
  { min: 21, name: 'César', text: 'Llegaste, viste y venciste. Veni, vidi, comi.' },
  { min: 30, name: 'Emperador Aurelius', text: 'Marco Aurelio te mira con respeto. Y con un poco de miedo.' },
  { min: 42, name: 'Leyenda inmortal', text: 'Tu foto va en la pared. Por favor, hidrátate.' },
];

// Nuevas conquistas: cocinas del mundo que llegarán al come todo.
// `status`: 'done' (ya conquistado) · 'next' (en campaña) · 'soon'
// `flag`: mx · it · kr · jp · us · vote (ver flags en icons.js)
export const conquests = [
  {
    country: 'México',
    status: 'done',
    flag: 'mx',
    dishes: 'Tacos · Quesadillas · Flautas · Pozole',
    text: 'Territorio conquistado. Aquí empezó todo.',
  },
  {
    country: 'Italia',
    status: 'next',
    flag: 'it',
    dishes: 'Pasta · Pizza · Lasaña',
    text: 'Volvemos a Roma, pero ahora con hambre.',
  },
  {
    country: 'Corea',
    status: 'soon',
    flag: 'kr',
    dishes: 'K-BBQ · Corn dogs · Kimchi',
    text: 'Seúl, prepárate: la legión aprendió a usar palillos.',
  },
  {
    country: 'Japón',
    status: 'soon',
    flag: 'jp',
    dishes: 'Ramen · Gyozas · Katsu',
    text: 'Ramen hasta que el emperador diga basta.',
  },
  {
    country: 'Estados Unidos',
    status: 'soon',
    flag: 'us',
    dishes: 'BBQ · Mac & cheese · Hot dogs',
    text: 'Cruzamos la frontera sin visa. Solo con apetito.',
  },
  {
    country: '¿Tú qué propones?',
    status: 'vote',
    flag: 'vote',
    dishes: 'Tu voto cuenta en el Senado',
    text: 'Dinos qué país quieres que conquistemos y lo llevamos a votación.',
  },
];

// Preguntas frecuentes («Las leyes del imperio»).
export const laws = [
  {
    q: '¿Cuánto cuesta el come todo?',
    a: `$${site.price} por persona. Un solo tributo y conquistas todo lo que tu voluntad aguante.`,
  },
  {
    q: '¿Qué entra en el come todo?',
    a: 'Toda la Ruta de la Conquista: tacos, quesadillas, flautas, pozole, alitas, boneless, popcorn chicken, burgers y snacks. Tú decides cuándo parar.',
  },
  {
    q: '¿Tengo que reservar?',
    a: 'No es obligatorio. Pero si vienes con toda tu legión, mándanos WhatsApp y te apartamos el campo de batalla.',
  },
  {
    q: '¿Tienen servicio a domicilio?',
    a: 'La carta sí viaja hasta tu puerta: pide por WhatsApp. El come todo se conquista aquí, en el templo.',
  },
  {
    q: '¿Puedo festejar mi cumpleaños aquí?',
    a: 'Obvio. Escríbenos por WhatsApp, cuéntanos cuántos guerreros vienen y preparamos la batalla.',
  },
  {
    q: '¿Por qué se llama Aurelius?',
    a: 'Por Marco Aurelio, el emperador filósofo. Su estoicismo acompañó a nuestro fundador en los días difíciles. Aquí la virtud tiene sabor.',
  },
  {
    q: '¿Dónde están?',
    a: `${site.address.street}, ${site.address.locality}, ${site.address.region}. En Google Maps nos encuentras como «Aurelius Coacalco».`,
  },
];

// Galería «El Templo»
export const gallery = [
  { src: 'img/storefront.webp', alt: 'Fachada de Aurelius Coacalco con letrero dorado', caption: 'La puerta del imperio. Entras con hambre, sales con gloria.', w: 1440, h: 1080 },
  { src: 'img/enchiladas.webp', alt: 'Enchiladas rojas con cebolla morada y crema', caption: 'Enchiladas rojas. Rojas como tu cara después de la sexta.', w: 1080, h: 1350 },
  { src: 'img/interior-1.webp', alt: 'Comedor de Aurelius con piso de ajedrez y muros negro con dorado', caption: 'Piso de ajedrez: aquí todos juegan como reyes.', w: 960, h: 1280 },
  { src: 'img/bar.webp', alt: 'Barra de Aurelius con letrero «Aurelius aprueba este desmadre»', caption: 'Aurelius aprueba este desmadre.', w: 1080, h: 1350 },
  { src: 'img/tostada.webp', alt: 'Tostada de pata con lechuga y crema', caption: 'Tostada de pata. Crujiente, honesta, legendaria.', w: 1080, h: 1350 },
  { src: 'img/comensales.webp', alt: 'Comensales sonriendo en una mesa de Aurelius', caption: 'Aurelius aprueba que vengas y tengas tu colapso mental.', w: 1080, h: 1350 },
  { src: 'img/interior-2.webp', alt: 'Mesas de Aurelius con el mural del emperador con rayo', caption: 'El emperador vigila. Y aprueba tu tercera orden.', w: 960, h: 1280 },
  { src: 'img/para-llevar.webp', alt: 'Cajas para llevar con el logo de Aurelius', caption: 'El imperio también viaja. Pide a domicilio.', w: 1080, h: 1350 },
  { src: 'img/drones.webp', alt: 'Espectáculo de drones con el logo de Aurelius sobre un estadio', caption: 'Algún día en el cielo. Hoy, en tu plato.', w: 896, h: 1120 },
];

// A la carta (para llevar / a domicilio) — sin precios a propósito.
export const carta = [
  { name: 'Wings', text: 'Nosotros te damos las alas para que sigas creyendo en sus palabras.' },
  { name: 'Boneless', text: 'Les quitamos el hueso porque viniste a comer, no a resolver problemas.' },
  { name: 'Popcorn chicken', text: 'El pollo quiso ir al cine y terminó en el menú.' },
  { name: 'Classic burger', text: 'Más clásica que decir: «el lunes empiezo la dieta».' },
  { name: 'Hawaiian burger', text: 'La piña no va en la pizza… por eso se la pusimos a la burger.' },
  { name: 'Papas a la francesa', text: 'Se llaman francesas, pero nunca han salido de Coacalco.' },
  { name: 'Chips Sabritas style', text: 'Las que ya conoces, pero más ricas, más naturales y más grandes.' },
  { name: 'Tacos, quesadillas, flautas y pozole', text: 'Lo clásico del imperio, empacado para que conquistes desde el sillón.' },
];
