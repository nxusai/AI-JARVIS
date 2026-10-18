// Todo el contenido de Mi Semago en un solo lugar: contacto, catálogo con fichas técnicas,
// proceso de marca privada, capítulos de la planta y preguntas frecuentes. Todo va en { es, en }.
// Las fichas técnicas vienen del sitio actual (misemago.com). Lo marcado con CONFIRMAR es provisional.
// La IA (server/semago.js) lee este archivo: si agregas un producto, la IA ya lo conoce.

export const BRAND = {
  name: 'Mi Semago',
  tagline: { es: 'The Better Latin Dairy Company', en: 'The Better Latin Dairy Company' },
  phone: '(973) 626-4057',
  phoneHref: '+19736264057',
  email: 'contacto@misemagolp.com',
  office: '98 2nd Ave, Paterson, NJ 07514',
  shipping: '51 E 23rd St, Paterson, NJ 07514',
  instagram: 'https://www.instagram.com/misemago.cheese/',
  instagramHandle: '@misemago.cheese',
  facebook: 'https://www.facebook.com/profile.php?id=61573389944690',
  capacityLbWeek: 500000,
  facilitySqft: 30000,
  tempF: 40,
  leadWeeks: 4,
};

export const CATEGORIES = [
  { id: 'oaxaca', name: { es: 'Oaxaca', en: 'Oaxaca' } },
  { id: 'fresco', name: { es: 'Fresco', en: 'Fresh' } },
  { id: 'canaston', name: { es: 'Canastón', en: 'Canastón' } },
  { id: 'panela', name: { es: 'Panela', en: 'Panela' } },
  { id: 'barra', name: { es: 'En barra', en: 'Bar' } },
];

const ING = {
  oaxaca: {
    es: 'Leche pasteurizada, aceite de palma, caseína de cuajo, almidón de maíz, leche en polvo descremada, suero, vinagre, citrato de sodio, mono y diglicéridos, dióxido de titanio, enzimas, sal, saborizante artificial y sorbato de potasio (conservante). Contiene Leche.',
    en: 'Pasteurized milk, palm oil, rennet casein, corn starch, nonfat dry milk powder, whey, vinegar, sodium citrate, mono and diglycerides, titanium dioxide, enzymes, salt, artificial flavoring and potassium sorbate (preservative). Contains Milk.',
  },
  fresco: {
    es: 'Leche pasteurizada, leche descremada en polvo, enzimas, natamicina y ácido sórbico (inhibidor de moho). Contiene Leche.',
    en: 'Pasteurized milk, nonfat dry milk, enzymes, natamycin and sorbic acid (mold inhibitor). Contains Milk.',
  },
  chile: {
    es: 'Leche pasteurizada, leche descremada en polvo, chile rojo, enzimas, natamicina y ácido sórbico (inhibidor de moho). Contiene Leche.',
    en: 'Pasteurized milk, nonfat dry milk, red chile, enzymes, natamycin and sorbic acid (mold inhibitor). Contains Milk.',
  },
  // CONFIRMAR: así aparece en el sitio actual para la cubeta (menciona chile, cebolla y soya).
  cubeta: {
    es: 'Leche pasteurizada, leche descremada en polvo, aceite de palma, sal, sabor artificial, ácido sórbico, cloruro de calcio, cuajo, cultivos lácticos, benzoato de sodio, sorbato de potasio y natamicina (conservadores), chile rojo, cebolla en polvo y ajo en polvo. Contiene Leche y Soya.',
    en: 'Pasteurized milk, nonfat dry milk, palm oil, salt, artificial flavor, sorbic acid, calcium chloride, rennet, lactic cultures, sodium benzoate, potassium sorbate and natamycin (preservatives), red chile, onion powder and garlic powder. Contains Milk and Soy.',
  },
};

const VAC = { es: 'Empaque al vacío', en: 'Vacuum sealed' };
const DELI = { es: 'Deli container', en: 'Deli container' };
const ROUND = { es: 'Contenedor redondo', en: 'Round container' };
const CLAM = { es: 'Clamshell', en: 'Clamshell' };
const oz = (n) => ({ l: `${n} oz`, lb: n / 16 });
const lb = (n) => ({ l: `${n} lb`, lb: n });
const LEAF_PACKS = [{ n: 6, pallet: 180 }, { n: 9, pallet: 180 }, { n: 12, pallet: 144 }];

// sizes: presentaciones (l = etiqueta, lb = peso en libras)
// packs: unidades por caja (n) y cajas máximas por tarima (pallet); `size` limita el pack a una presentación
// label: dónde cae la etiqueta del Estudio de Marca sobre la foto (% del ancho/alto, giro en grados)
export const PRODUCTS = [
  {
    id: 'oaxaca-retail', cat: 'oaxaca', img: 'oaxaca-retail', hero: true,
    name: { es: 'Queso Oaxaca Retail', en: 'Oaxaca Cheese Retail' },
    desc: { es: 'La bola de quesillo hilada a mano, lista para el anaquel. Se deshebra en tiras largas y funde parejo: quesadillas, tlayudas y empanadas.', en: 'The hand-stretched quesillo ball, shelf-ready. Pulls into long strings and melts evenly: quesadillas, tlayudas and empanadas.' },
    ingredients: ING.oaxaca, packaging: VAC, shelf: 60,
    sizes: [oz(12), oz(14)], packs: [{ n: 12, pallet: 180 }, { n: 25, pallet: 52 }],
    label: { x: 34, y: 56, w: 40, r: -6 },
  },
  {
    id: 'oaxaca-precortado', cat: 'oaxaca', img: 'oaxaca-precortado',
    name: { es: 'Queso Oaxaca Precortado', en: 'Pre-cut Oaxaca Cheese' },
    desc: { es: 'Oaxaca en formato de 5 libras, precortado para cocinas con mucho volumen. Abre la bolsa y a la plancha.', en: 'Oaxaca in a 5 lb format, pre-cut for high-volume kitchens. Open the bag and onto the griddle.' },
    ingredients: ING.oaxaca, packaging: { es: 'Al vacío / bolsa de polietileno con etiqueta', en: 'Vacuum sealed / polyethylene bag with label' }, shelf: 60,
    sizes: [lb(5)], packs: [{ n: 4, pallet: 77 }, { n: 6, pallet: 77 }],
    label: { x: 50, y: 50, w: 34, r: -2 },
  },
  {
    id: 'oaxaca-food-service', cat: 'oaxaca', img: 'oaxaca-food-service',
    name: { es: 'Oaxaca Food Service', en: 'Food Service Oaxaca' },
    desc: { es: 'La bola grande para taquerías, pupuserías y restaurantes. Rinde, se deshebra fácil y funde sin soltar grasa de más.', en: 'The big ball for taquerias, pupuserias and restaurants. High yield, easy to pull and a clean melt.' },
    ingredients: ING.oaxaca, packaging: VAC, shelf: 60,
    sizes: [lb(5), lb(10)], packs: [{ n: 6, pallet: 60, size: '5 lb' }, { n: 4, pallet: 40, size: '10 lb' }],
    label: { x: 50, y: 56, w: 38, r: -4 },
  },
  {
    id: 'queso-deshebrado', cat: 'oaxaca', img: 'queso-deshebrado',
    name: { es: 'Queso Oaxaca Deshebrado', en: 'Shredded Oaxaca Cheese' },
    desc: { es: 'Oaxaca ya deshebrado en charola: el trabajo hecho para el cliente que tiene prisa.', en: 'Oaxaca already pulled, in a tray: the work done for the shopper in a hurry.' },
    ingredients: ING.oaxaca, packaging: { es: 'Charola de plástico', en: 'Plastic tray' }, shelf: 40,
    sizes: [oz(12)], packs: [{ n: 6, pallet: null }, { n: 12, pallet: null }],
    label: { x: 50, y: 40, w: 36, r: 0 },
  },
  {
    id: 'fresco-4', cat: 'fresco', img: 'fresco-4',
    name: { es: 'Queso Fresco 4"', en: 'Fresh Cheese 4"' },
    desc: { es: 'Fresco, suave y ligeramente salado. Se desmorona sobre frijoles, enchiladas, tostadas y elotes.', en: 'Fresh, soft and lightly salted. Crumbles over beans, enchiladas, tostadas and street corn.' },
    ingredients: ING.fresco, packaging: DELI, shelf: 40,
    sizes: [oz(10), oz(12), oz(14)], packs: [{ n: 6, pallet: 247 }],
    label: { x: 50, y: 30, w: 38, r: 0 },
  },
  {
    id: 'fresco-5', cat: 'fresco', img: 'fresco-5',
    name: { es: 'Queso Fresco 5"', en: 'Fresh Cheese 5"' },
    desc: { es: 'El queso fresco de todos los días en clamshell de 5 pulgadas, cómodo para el refrigerador de casa.', en: 'The everyday fresh cheese in a 5-inch clamshell, easy to keep in the home fridge.' },
    ingredients: ING.fresco, packaging: CLAM, shelf: 40,
    sizes: [oz(10), oz(12), oz(14)], packs: LEAF_PACKS,
    label: { x: 50, y: 36, w: 34, r: 0 },
  },
  {
    id: 'fresco-6', cat: 'fresco', img: 'fresco-6',
    name: { es: 'Queso Fresco 6"', en: 'Fresh Cheese 6"' },
    desc: { es: 'Rueda ancha de 6 pulgadas en contenedor redondo: más superficie para rallar o rebanar.', en: 'A wide 6-inch wheel in a round container: more surface to grate or slice.' },
    ingredients: ING.fresco, packaging: ROUND, shelf: 40,
    sizes: [oz(10), oz(12)], packs: [{ n: 6, pallet: 225 }],
    label: { x: 50, y: 38, w: 34, r: 0 },
  },
  {
    id: 'fresco-hoja-4', cat: 'fresco', img: 'fresco-hoja-4', hero: true,
    name: { es: 'Queso Fresco con Hoja de Plátano 4"', en: 'Fresh Cheese with Plantain Leaf 4"' },
    desc: { es: 'Fresco envuelto en hoja de plátano, como en Centroamérica. La hoja le da aroma y una presentación que se ve desde el pasillo.', en: 'Fresh cheese wrapped in plantain leaf, Central American style. The leaf adds aroma and a look you notice from the aisle.' },
    ingredients: ING.fresco, packaging: DELI, shelf: 40,
    sizes: [oz(6), oz(12), oz(14)], packs: LEAF_PACKS,
    label: { x: 50, y: 70, w: 34, r: 0 },
  },
  {
    id: 'fresco-hoja-5', cat: 'fresco', img: 'fresco-hoja-5',
    name: { es: 'Queso Fresco con Hoja de Plátano 5"', en: 'Fresh Cheese with Plantain Leaf 5"' },
    desc: { es: 'La versión de 5 pulgadas en clamshell, con su hoja de plátano. Para pupusas, casamiento y desayunos típicos.', en: 'The 5-inch clamshell version, plantain leaf included. For pupusas, casamiento and traditional breakfasts.' },
    ingredients: ING.fresco, packaging: CLAM, shelf: 40,
    sizes: [oz(6), oz(10), oz(12), oz(14)], packs: LEAF_PACKS,
    label: { x: 62, y: 40, w: 30, r: -14 },
  },
  {
    id: 'fresco-hoja-6', cat: 'fresco', img: 'fresco-hoja-6',
    name: { es: 'Queso Fresco con Hoja de Plátano 6"', en: 'Fresh Cheese with Plantain Leaf 6"' },
    desc: { es: 'Rueda de 6 pulgadas con hoja de plátano en contenedor redondo: la más vistosa del exhibidor.', en: 'A 6-inch wheel with plantain leaf in a round container: the showiest one in the case.' },
    ingredients: ING.fresco, packaging: ROUND, shelf: 40,
    sizes: [oz(6), oz(10), oz(12)], packs: LEAF_PACKS,
    label: { x: 30, y: 30, w: 28, r: -8 },
  },
  {
    id: 'queso-chile-rojo', cat: 'fresco', img: 'queso-chile-rojo',
    name: { es: 'Queso con Chile Rojo', en: 'Red Chile Cheese' },
    desc: { es: 'Queso fresco con chile rojo: color, un toque picosito y mucho carácter para botanas y antojitos.', en: 'Fresh cheese with red chile: color, a gentle kick and lots of character for snacks and antojitos.' },
    ingredients: ING.chile, packaging: DELI, shelf: 35,
    sizes: [oz(12), oz(14)], packs: [{ n: 6, pallet: 169 }, { n: 12, pallet: 96 }],
    label: { x: 50, y: 22, w: 34, r: 0 },
  },
  {
    id: 'fresco-cubeta', cat: 'fresco', img: 'fresco-cubeta',
    name: { es: 'Queso Fresco en Cubeta', en: 'Fresh Cheese in Bucket' },
    desc: { es: 'Cilindro de 8.5 libras en cubeta para cocinas, cremerías y venta a granel.', en: 'An 8.5 lb cylinder in a bucket for kitchens, creameries and bulk sales.' },
    ingredients: ING.cubeta, packaging: { es: 'Cubeta de plástico', en: 'Plastic bucket' }, shelf: 65,
    sizes: [lb(8.5)], packs: [{ n: 1, pallet: null }],
    label: { x: 50, y: 52, w: 46, r: 0 },
  },
  {
    id: 'canaston', cat: 'canaston', img: 'canaston', hero: true,
    name: { es: 'Queso Canastón', en: 'Canastón Cheese' },
    desc: { es: 'Rueda grande con la marca de la canasta en la corteza. Se rebana firme y se sirve fresco o a la plancha.', en: 'A large wheel with the basket mark on its rind. Slices firm; serve fresh or griddled.' },
    ingredients: ING.fresco, packaging: VAC, shelf: 60,
    sizes: [lb(5), lb(14)], packs: [{ n: 2, pallet: 135, size: '5 lb' }, { n: 1, pallet: 120, size: '14 lb' }],
    label: { x: 50, y: 64, w: 40, r: 0 },
  },
  {
    id: 'panela', cat: 'panela', img: 'panela',
    name: { es: 'Queso Panela', en: 'Panela Cheese' },
    desc: { es: 'Panela de canasta, fresca y firme. Aguanta la plancha sin derretirse: asado, en ensalada o en cubos.', en: 'Basket panela, fresh and firm. Holds its shape on the grill: seared, in salads or cubed.' },
    ingredients: ING.fresco, packaging: VAC, shelf: 60,
    sizes: [lb(3), lb(5)], packs: [{ n: 4, pallet: 135, size: '3 lb' }, { n: 2, pallet: 135, size: '5 lb' }],
    label: { x: 50, y: 64, w: 40, r: 0 },
  },
  {
    id: 'barra-blanco', cat: 'barra', img: 'barra-blanco',
    name: { es: 'Queso Blanco para Freír (barra)', en: 'White Frying Cheese (bar)' },
    desc: { es: 'Barra de 6 libras de queso blanco para freír: se dora por fuera y no se deshace. Para tostones, desayunos y frituras.', en: 'A 6 lb bar of white frying cheese: browns outside and holds together. For tostones, breakfasts and fritters.' },
    // CONFIRMAR: el sitio actual no publica ingredientes, empaque ni vida de anaquel de las barras.
    ingredients: null, packaging: null, shelf: null,
    sizes: [lb(6)], packs: [{ n: 8, pallet: 42 }],
    label: { x: 50, y: 46, w: 70, r: -90 },
  },
  {
    id: 'barra-chihuahua', cat: 'barra', img: 'barra-chihuahua',
    name: { es: 'Queso Chihuahua (barra)', en: 'Chihuahua Cheese (bar)' },
    desc: { es: 'Barra de 5 libras estilo Chihuahua, amarillo pálido y cremoso. Funde suave para queso fundido, chiles rellenos y gratinados.', en: 'A 5 lb Chihuahua-style bar, pale yellow and creamy. Melts smooth for queso fundido, chiles rellenos and gratins.' },
    ingredients: null, packaging: null, shelf: null,
    sizes: [lb(5)], packs: [{ n: 8, pallet: 42 }],
    label: { x: 50, y: 46, w: 70, r: -90 },
  },
];

// Proceso real antes del envío (sitio actual): en total, 4 semanas o menos.
export const PROCESS = [
  { id: 'talk', days: [5, 7], name: { es: 'Plática de negociación', en: 'Negotiation talk' }, dur: { es: '1 semana', en: '1 week' }, text: { es: 'Eliges los quesos que quieres llevar con tu marca y defines especificaciones, volumen y precio.', en: 'Pick the cheeses you want under your brand and set specs, volume and price.' } },
  { id: 'label', days: [3, 5], name: { es: 'Creación de tu etiqueta', en: 'Your label is created' }, dur: { es: '3 a 5 días', en: '3 to 5 days' }, text: { es: 'Definimos empaque, etiqueta, diseño y presentación con tu identidad.', en: 'We define packaging, label, design and presentation with your identity.' } },
  { id: 'make', days: [5, 7], name: { es: 'Producción', en: 'Production' }, dur: { es: '1 semana', en: '1 week' }, text: { es: 'Producimos tu lote cumpliendo tus requerimientos, con consistencia y control en cada lote.', en: 'We make your run to spec, with consistency and control in every batch.' } },
  { id: 'ship', days: [1, 5], name: { es: 'Envío refrigerado', en: 'Refrigerated shipping' }, dur: { es: '1 a 5 días según el estado', en: '1 to 5 days by state' }, text: { es: 'Recibes tu producto terminado, a 40 °F, con tu marca y calidad Mi Semago.', en: 'You receive the finished product at 40 °F, with your brand and Mi Semago quality.' } },
];

// Capítulos del video de la planta (cuadro inicial a 4 cuadros por segundo).
export const PLANT_CHAPTERS = [
  { from: 0, name: { es: 'La cuajada', en: 'The curd' }, text: { es: 'Todo empieza con leche pasteurizada que se vuelve cuajada, a mano y con paciencia.', en: 'It all starts with pasteurized milk turned into curd, by hand and with patience.' } },
  { from: 9, name: { es: 'El hilado', en: 'The stretch' }, text: { es: 'El Oaxaca se estira en tiras largas, como se ha hecho siempre. Así se forma el hilo que se deshebra en tu cocina.', en: 'Oaxaca is stretched into long ribbons, the way it has always been done. That is the string you pull apart at home.' } },
  { from: 26, name: { es: 'La bola', en: 'The ball' }, text: { es: 'Las tiras se enrollan en bolas y pasan a los carritos, listas para empacar.', en: 'The ribbons are wound into balls and loaded onto carts, ready to pack.' } },
  { from: 38, name: { es: 'El empaque', en: 'Packing' }, text: { es: 'Cada pieza se empaca con la etiqueta de la marca que la va a vender. Puede ser la tuya.', en: 'Each piece is packed under the label of the brand that will sell it. It can be yours.' } },
  { from: 54, name: { es: 'El moldeado', en: 'Molding' }, text: { es: 'El queso fresco se llena en moldes, cientos a la vez, sobre mesas de acero inoxidable.', en: 'Fresh cheese is filled into molds, hundreds at a time, on stainless steel tables.' } },
  { from: 78, name: { es: 'El reposo', en: 'Resting' }, text: { es: 'Prensado y reposo en frío hasta que el queso toma su forma. Luego, a 40 °F hasta tu almacén.', en: 'Pressed and rested cold until it holds its shape. Then kept at 40 °F all the way to your warehouse.' } },
];
export const PLANT_FRAMES = 96;

export const FAQ = [
  { q: { es: '¿Cuánto tarda en salir mi marca al mercado?', en: 'How long until my brand is on the market?' }, a: { es: 'Cuatro semanas o menos: una semana de plática, de 3 a 5 días para la etiqueta, una semana de producción y de 1 a 5 días de envío según el estado.', en: 'Four weeks or less: one week of talks, 3 to 5 days for the label, one week of production and 1 to 5 days of shipping depending on the state.' } },
  { q: { es: '¿Ustedes hacen el diseño de la etiqueta?', en: 'Do you design the label?' }, a: { es: 'Sí. Definimos contigo el empaque, la etiqueta, el diseño y la presentación con tu identidad. Puedes empezar a imaginarla en el Estudio de Marca de esta página.', en: 'Yes. We define packaging, label, design and presentation with you, in your identity. You can start sketching it in the Brand Studio on this page.' } },
  { q: { es: '¿Puedo poner mis propias especificaciones?', en: 'Can I set my own specifications?' }, a: { es: 'Tú defines empaques, diseño, especificaciones y precio. Nosotros nos encargamos de la producción y de que cada lote salga igual.', en: 'You define packaging, design, specifications and price. We handle production and make sure every batch comes out the same.' } },
  { q: { es: '¿A qué estados envían?', en: 'Which states do you ship to?' }, a: { es: 'A todo Estados Unidos, con transporte refrigerado y seguimiento. El envío tarda de 1 a 5 días según el estado.', en: 'All of the United States, with refrigerated, tracked transport. Shipping takes 1 to 5 days depending on the state.' } },
  { q: { es: '¿Cuánto pueden producir?', en: 'How much can you produce?' }, a: { es: 'Más de 500,000 libras por semana en 30,000 pies cuadrados de planta en Paterson, Nueva Jersey.', en: 'Over 500,000 pounds a week in a 30,000 sq ft plant in Paterson, New Jersey.' } },
  { q: { es: '¿Cuál es el pedido mínimo y el precio?', en: 'What are the minimum order and price?' }, a: { es: 'Depende del queso, la presentación y el volumen. Escríbenos o llama al (973) 626-4057 y te cotizamos.', en: 'It depends on the cheese, size and volume. Write to us or call (973) 626-4057 for a quote.' } },
];

// Para el mapa: días de tránsito estimados desde Paterson, NJ según la distancia (rango real: 1 a 5 días).
export function transitDays(miles) {
  if (miles < 260) return 1;
  if (miles < 650) return 2;
  if (miles < 1150) return 3;
  if (miles < 1800) return 4;
  return 5;
}
