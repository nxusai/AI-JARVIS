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
  tiktok: 'https://www.tiktok.com/@aureliusmx',
  domain: 'https://aureliusmx.com',
  // Dirección tal como aparece en Google Maps («Aurelius Coacalco»)
  address: {
    street: 'Plaza Allende, C. Ignacio Allende 20-A N. 2, Zacuauhtitla',
    locality: 'San Francisco Coacalco',
    region: 'Estado de México',
    postalCode: '55700',
  },
  mapsQuery: 'Aurelius Coacalco',
  geo: { lat: 19.6324759, lng: -99.1005516 },
  // Ficha exacta de Google Maps (abre directo el negocio)
  mapsCid: '10890260874571343718',
  // Horario: todos los días de 1:00 pm a 10:00 pm.
  // day: 0 = domingo … 6 = sábado; horas en formato 24h
  hours: [
    { days: [0, 1, 2, 3, 4, 5, 6], open: 13, close: 22, label: 'Todos los días', text: '1:00 pm – 10:00 pm' },
  ],
  // Integración futura de IA para «El Oráculo».
  // Cuando exista un backend, pon aquí su URL. Debe aceptar POST
  // { messages: [{ role, content }] } y responder { reply: "texto" }.
  ai: { endpoint: '' },
};

export const wa = (text) =>
  `https://wa.me/${site.phoneIntl}?text=${encodeURIComponent(text)}`;

export const mapsUrl = `https://maps.google.com/?cid=${site.mapsCid}`;
export const wazeUrl = `https://waze.com/ul?ll=${site.geo.lat},${site.geo.lng}&navigate=yes`;

// La Ruta de la Conquista: lo que entra en el come todo.
export const provinces = [
  {
    id: 'tacos',
    img: 'img/menu/tacos.webp', // provisional: reemplazar por foto propia
    numeral: 'I',
    name: 'Tacos',
    icon: 'taco',
    items: ['Pastor', 'Suadero', 'Bistec', 'Longaniza', 'Enchilada', 'Campechanos', 'Queso'],
    quip: 'Roma no se hizo en un día. Tu orden de pastor, en tres minutos.',
    lore: 'La base de todo imperio.',
  },
  {
    id: 'quesadillas',
    img: 'img/menu/quesadillas.webp', // provisional: reemplazar por foto propia
    numeral: 'II',
    name: 'Quesadillas',
    icon: 'quesadilla',
    items: ['Pastor', 'Suadero', 'Bistec', 'Longaniza', 'Enchilada', 'Queso'],
    quip: '¿Con queso o sin queso? Aquí no se debate: esto es un imperio, no una democracia.',
    lore: 'El debate más viejo de la Ciudad, resuelto.',
  },
  {
    id: 'flautas',
    img: 'img/menu/flautas.webp', // provisional: reemplazar por foto propia
    numeral: 'III',
    name: 'Flautas',
    icon: 'flauta',
    items: ['Pollo', 'Queso'],
    quip: 'Largas, doradas y crujientes. Como tu lista de pendientes, pero estas sí te las acabas.',
    lore: 'Las únicas flautas que no te hacen bailar.',
  },
  {
    id: 'pozole',
    img: 'img/menu/pozole.webp', // provisional: reemplazar por foto propia
    numeral: 'IV',
    name: 'Pozole',
    icon: 'pozole',
    items: ['Maciza', 'Pollo', 'Surtida'],
    quip: 'El caldo que levanta legiones… y crudas.',
    lore: 'Medicina ancestral del imperio.',
  },
  {
    id: 'chicken',
    img: 'img/menu/alitas.webp', // provisional: reemplazar por foto propia
    numeral: 'V',
    name: 'Chicken Empire',
    icon: 'wing',
    items: ['Alitas', 'Boneless', 'Popcorn Chicken'],
    quip: 'Nosotros te damos las alas para que sigas creyendo en sus palabras.',
    lore: 'Choose your fire: báñalas en el fuego digno de tu temple.',
  },
  {
    id: 'burgers',
    img: 'img/menu/burger.webp', // provisional: reemplazar por foto propia
    numeral: 'VI',
    name: 'Burgers',
    icon: 'burger',
    items: ['Clásica', 'Hawaiana', 'Tocino'],
    quip: 'La piña no va en la pizza… por eso se la pusimos a la burger.',
    lore: 'Más clásica que decir «el lunes empiezo la dieta».',
  },
  {
    id: 'snacks',
    img: 'img/menu/snacks.webp', // provisional: reemplazar por foto propia
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
    q: '¿Las bebidas están incluidas?',
    a: 'El come todo no incluye bebidas. Pero si tu sed también quiere conquistar, pregunta por el paquete «All you can beer» y recorre El camino del brindis.',
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

// «All you can beer» · El camino del brindis (página 5 del menú come todo).
// CONFIRMAR: condiciones del paquete (el menú dice «Aplican términos y condiciones»).
export const brindis = [
  { name: 'Cantarito cervecero', text: 'Cerveza, naranja, toronja, limón, refresco de toronja y sal/chile.' },
  { name: 'Mango habanero', text: 'Cerveza, mango, limón, chamoy y chile habanero.', hot: true },
  { name: 'Tamarindo de guerra', text: 'Cerveza, tamarindo, limón, chamoy y chile.' },
  { name: 'Gladiadora de mango', text: 'Cerveza, mango, chamoy, Tajín y limón.' },
  { name: 'Chelada imperial', text: 'Cerveza, limón y sal.' },
  { name: 'Michelada Aurelius', text: 'Cerveza, limón, salsas, chile y escarchado. La firma de la casa.' },
];

// Créditos de las fotos ilustrativas (Wikimedia Commons). Cuando una
// foto provisional se reemplace por una propia, borra su crédito aquí.
export const photoCredits = [
  { what: "Tacos", author: "Popo le Chien", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", source: "https://commons.wikimedia.org/wiki/File:Tacos_2.jpg" },
  { what: "Quesadillas", author: "Popo le Chien", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/", source: "https://commons.wikimedia.org/wiki/File:Quesadilla_2.jpg" },
  { what: "Flautas", author: "Jon Sullivan", license: "Public domain", licenseUrl: "", source: "https://commons.wikimedia.org/wiki/File:Tortillas_flautas.jpg" },
  { what: "Pozole", author: "El Nuevo Doge", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", source: "https://commons.wikimedia.org/wiki/File:Pozole,_Mazatl%C3%A1n,_13_de_marzo_de_2023_02.jpg" },
  { what: "Alitas", author: "Charli Lopez from Rochester, USA", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/", source: "https://commons.wikimedia.org/wiki/File:Buffalo_Wings_(6676460575).jpg" },
  { what: "Burger", author: "Ceeseven", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: "https://commons.wikimedia.org/wiki/File:Bacon_Cheeseburger_on_plate.JPG" },
  { what: "Nachos", author: "Mack Male from Edmonton, AB, Canada", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: "https://commons.wikimedia.org/wiki/File:Nachos_(2897113413).jpg" },
  { what: "Michelada", author: "Missvain", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", source: "https://commons.wikimedia.org/wiki/File:Michelada_at_Mitote_Food_Park_-_April_2023_-_Sarah_Stierch.jpg" },
];
