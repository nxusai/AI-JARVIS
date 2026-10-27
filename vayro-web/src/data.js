// Everything a non-developer may need to change lives here.
// Anything marked CONFIRM is a placeholder until the real value exists.

export const site = {
  domain: 'https://vayroinc.com',
  email: 'hello@vayroinc.com', // CONFIRM: create this inbox
  salesEmail: 'sales@vayroinc.com', // CONFIRM: create this inbox
  // Optional form endpoints (Formspree, Netlify Forms, your CRM…). Empty = the form opens
  // the visitor's email app with the message ready to send.
  forms: {
    contact: '',
    wholesale: '',
    newsletter: '',
  },
  social: {
    instagram: 'https://instagram.com/vayrofoods', // CONFIRM
    tiktok: 'https://tiktok.com/@vayrofoods', // CONFIRM
    youtube: '', // CONFIRM (empty hides the icon)
    facebook: '', // CONFIRM (empty hides the icon)
  },
  handle: '@vayrofoods',
  hashtag: '#MadeForMore',
};

// Product data is copied from the approved VAYRO labels. Nutrition values are per serving.
// Text fields are { en, es }.
export const products = [
  {
    id: 'fresh',
    family: 'fresh',
    name: { en: 'Fresh Cheese', es: 'Queso Fresco' },
    line: { en: 'Crumble. Top. Repeat.', es: 'Desmorona. Corona. Repite.' },
    use: { en: 'Perfect for crumbling & topping', es: 'Perfecto para desmoronar y coronar' },
    desc: {
      en: 'Soft, bright and clean-tasting. Crumbles over bowls, salads, eggs and toast in seconds and turns an everyday plate into a high-protein one.',
      es: 'Suave, fresco y de sabor limpio. Se desmorona sobre bowls, ensaladas, huevos y pan tostado en segundos y convierte un plato diario en uno alto en proteína.',
    },
    accent: '#EA6620',
    sizes: [{ id: 'fresh-12', label: '12 oz', grams: '340 g', img: 'img/products/fresh.webp', servings: 6, channel: 'retail' }],
    serving: '2 oz (56.8 g)',
    nf: {
      calories: 180, fat: ['14g', 18], satFat: ['9g', 45], transFat: '0g', cholesterol: ['30mg', 10], sodium: ['470mg', 20],
      carbs: ['4g', 1], fiber: ['0g', 0], sugars: '0g', addedSugars: ['0g', 0], protein: 10,
      vitD: 2, calcium: 25, iron: 0, potassium: 0,
    },
    ingredients: 'Pasteurized Milk, Nonfat Dry Milk, Palm Oil, Salt, Acetic Acid, Culture, Enzymes, Natamycin, and Sorbic Acid (mold inhibitor).',
    contains: 'Milk & Soy',
    pairs: { en: ['Power bowls', 'Eggs & toast', 'Salads', 'Roasted veggies'], es: ['Power bowls', 'Huevos y pan tostado', 'Ensaladas', 'Verduras asadas'] },
  },
  {
    id: 'oaxaca',
    family: 'melt',
    name: { en: 'Oaxaca Cheese', es: 'Queso Oaxaca' },
    line: { en: 'The pull you can see.', es: 'El estirado que se ve.' },
    use: { en: 'Perfect for melting & cooking', es: 'Perfecto para fundir y cocinar' },
    desc: {
      en: 'A stretchy, mild melting cheese that pulls apart in strands. Made for melts, wraps, pizza nights and anything that comes out of a hot pan.',
      es: 'Un queso suave para fundir que se deshebra en tiras. Hecho para sándwiches calientes, wraps, noches de pizza y todo lo que sale de un sartén caliente.',
    },
    accent: '#EA6620',
    sizes: [
      { id: 'oaxaca-12', label: '12 oz', grams: '340 g', img: 'img/products/oax12.webp', servings: 6, channel: 'retail' },
      { id: 'oaxaca-32', label: '2 lb', grams: '32 oz', img: 'img/products/oax2.webp', servings: 16, channel: 'club' },
    ],
    serving: '1/2 cup (58.8 g)',
    nf: {
      calories: 160, fat: ['12g', 15], satFat: ['8g', 40], transFat: '0g', cholesterol: ['15mg', 7], sodium: ['450mg', 20],
      carbs: ['3g', 1], fiber: ['<1g', 2], sugars: '1g', addedSugars: ['0g', 0], protein: 9,
      vitD: 0, calcium: 20, iron: 0, potassium: 0,
    },
    ingredients: 'Pasteurized Milk, Palm Oil, Rennet Casein, Corn Starch, Nonfat Dry Milk Powder, Whey, Vinegar, Sodium Citrate, Mono and Diglyceride, Titanium Dioxide, Enzymes, Salt, Artificial Flavoring, and Potassium Sorbate (Preservative).',
    contains: 'Milk and Soy',
    pairs: { en: ['Melts & wraps', 'Pizza', 'Omelets', 'Pasta bakes'], es: ['Sándwiches y wraps', 'Pizza', 'Omelets', 'Pasta al horno'] },
  },
  {
    id: 'panela',
    family: 'fresh',
    name: { en: 'Panela Cheese', es: 'Queso Panela' },
    line: { en: 'Firm. Light. Ready.', es: 'Firme. Ligero. Listo.' },
    use: { en: 'Perfect for crumbling & topping', es: 'Perfecto para desmoronar y coronar' },
    desc: {
      en: 'A firm, fresh cheese that slices clean and holds its shape on the grill. One of the shortest ingredient lists in the line-up — built for meal prep.',
      es: 'Un queso fresco y firme que se rebana limpio y mantiene su forma en la parrilla. Una de las listas de ingredientes más cortas de la línea — hecho para meal prep.',
    },
    accent: '#EA6620',
    sizes: [{ id: 'panela-48', label: '3 lb', grams: '48 oz', img: 'img/products/panela.webp', servings: 24, channel: 'club' }],
    serving: '2 oz (56.8 g)',
    nf: {
      // CONFIRM: the label reads "Trans Fat 7g". Reproduced as printed; check with the label designer.
      calories: 160, fat: ['12g', 15], satFat: ['3g', 15], transFat: '7g', cholesterol: ['35mg', 12], sodium: ['280mg', 12],
      carbs: ['4g', 1], fiber: ['0g', 0], sugars: '1g', addedSugars: ['0g', 0], protein: 9,
      vitD: 2, calcium: 25, iron: 0, potassium: 0,
    },
    ingredients: 'Pasteurized Milk, Nonfat Dry Milk, Salt, Enzymes, Natamycin, and Sorbic Acid (mold inhibitor).',
    contains: 'Milk & Soy',
    pairs: { en: ['Grill & skewers', 'Meal prep', 'Sandwiches', 'Snack plates'], es: ['Parrilla y brochetas', 'Meal prep', 'Sándwiches', 'Tablas de snack'] },
  },
  {
    id: 'frying',
    family: 'sear',
    name: { en: 'Frying Cheese', es: 'Queso para Freír' },
    line: { en: 'Sears golden. Never melts away.', es: 'Se dora. Nunca se derrite.' },
    use: { en: 'Bold flavor with the perfect texture for cooking', es: 'Sabor intenso con la textura perfecta para cocinar' },
    desc: {
      en: 'Slice it, hit a hot pan, flip once. It sears to a golden crust and stays in one piece — a protein-forward centerpiece for bowls and plates.',
      es: 'Rebánalo, al sartén caliente, voltéalo una vez. Se dora por fuera y se mantiene entero — un protagonista con proteína para bowls y platos.',
    },
    accent: '#EA6620',
    sizes: [{ id: 'frying-80', label: '5 lb', grams: '80 oz', img: 'img/products/frying.webp', servings: 40, channel: 'foodservice', tall: true }],
    serving: '2 oz (56 g)',
    nf: {
      calories: 190, fat: ['17g', 22], satFat: ['12g', 60], transFat: '0g', cholesterol: ['40mg', 13], sodium: ['360mg', 16],
      carbs: ['3g', 1], fiber: ['<1g', 3], sugars: '0g', addedSugars: ['0g', 0], protein: 6,
      vitD: 0, calcium: 30, iron: 0, potassium: 0,
    },
    ingredients: 'Pasteurized Milk, Nonfat Dry Milk, Palm Oil, Salt, Artificial Flavoring, Enzymes, Culture, Natamycin, and Sorbic Acid (mold inhibitor).',
    contains: 'Milk and Soy',
    pairs: { en: ['Seared bowls', 'Breakfast plates', 'Salads', 'Sliders'], es: ['Bowls dorados', 'Desayunos', 'Ensaladas', 'Mini sándwiches'] },
  },
];

export const recipes = [
  {
    id: 'seared-bowl',
    tags: ['protein', 'prep'],
    img: 'img/life/seared.webp',
    product: 'frying',
    time: 15,
    serves: 2,
    title: { en: 'Golden Sear Power Plate', es: 'Plato Power Dorado' },
    blurb: { en: 'Seared cheese, greens, grains and a sharp dressing. Dinner in 15.', es: 'Queso dorado, verdes, granos y un aderezo ácido. La cena en 15.' },
    ingredients: {
      en: ['8 oz VAYRO Frying Cheese, sliced 1/2 in thick', '2 cups cooked quinoa or rice', '2 handfuls mixed greens', '1 cucumber, sliced', '1 cup cherry tomatoes, halved', '2 tbsp olive oil + 1 lemon', 'Salt, pepper, chili flakes'],
      es: ['8 oz de Queso para Freír VAYRO, rebanadas de 1 cm', '2 tazas de quinoa o arroz cocido', '2 puños de hojas verdes', '1 pepino rebanado', '1 taza de jitomates cherry en mitades', '2 cdas de aceite de oliva + 1 limón', 'Sal, pimienta, hojuelas de chile'],
    },
    steps: {
      en: ['Heat a dry non-stick pan over medium-high.', 'Sear the cheese 1–2 minutes per side until deep golden. Do not move it while it sears.', 'Build bowls: grains, greens, cucumber, tomatoes.', 'Top with the hot cheese, olive oil, lemon, salt, pepper and chili.'],
      es: ['Calienta un sartén antiadherente sin aceite a fuego medio-alto.', 'Dora el queso 1–2 minutos por lado hasta que esté bien dorado. No lo muevas mientras se dora.', 'Arma los bowls: granos, verdes, pepino, jitomate.', 'Corona con el queso caliente, aceite de oliva, limón, sal, pimienta y chile.'],
    },
  },
  {
    id: 'protein-toast',
    tags: ['quick', 'family'],
    img: 'img/life/toast.webp',
    product: 'fresh',
    time: 8,
    serves: 1,
    title: { en: 'Morning Stack Toast', es: 'Toast de la Mañana' },
    blurb: { en: 'Sourdough, a jammy egg and a fresh-cheese crumble. Ready before the day starts.', es: 'Pan de masa madre, huevo cremoso y queso fresco desmoronado. Listo antes de que empiece el día.' },
    ingredients: {
      en: ['1 thick slice sourdough', '1–2 eggs', '1/4 cup VAYRO Fresh Cheese, crumbled', '1/2 avocado (optional)', 'Chili flakes, black pepper, herbs'],
      es: ['1 rebanada gruesa de pan de masa madre', '1–2 huevos', '1/4 taza de Queso Fresco VAYRO desmoronado', '1/2 aguacate (opcional)', 'Hojuelas de chile, pimienta, hierbas'],
    },
    steps: {
      en: ['Toast the bread until crisp.', 'Fry or soft-boil the eggs to your liking.', 'Layer avocado, eggs, then crumble the cheese over the top.', 'Finish with chili, pepper and fresh herbs.'],
      es: ['Tuesta el pan hasta que esté crujiente.', 'Fríe o cuece los huevos a tu gusto.', 'Pon el aguacate, los huevos y desmorona el queso encima.', 'Termina con chile, pimienta y hierbas frescas.'],
    },
  },
  {
    id: 'ultimate-melt',
    tags: ['quick', 'family'],
    img: 'img/life/melt.webp',
    product: 'oaxaca',
    time: 10,
    serves: 2,
    title: { en: 'The Ultimate Melt', es: 'El Sándwich Fundido' },
    blurb: { en: 'Crisp outside, stretch inside. The weeknight sandwich everyone asks for.', es: 'Crujiente por fuera, estirado por dentro. El sándwich que todos piden entre semana.' },
    ingredients: {
      en: ['4 slices of your favorite bread', '6 oz VAYRO Oaxaca Cheese, pulled into strands', 'Sliced turkey or grilled veggies', '1 tbsp butter', 'Mustard or pesto'],
      es: ['4 rebanadas de tu pan favorito', '6 oz de Queso Oaxaca VAYRO deshebrado', 'Pavo rebanado o verduras asadas', '1 cda de mantequilla', 'Mostaza o pesto'],
    },
    steps: {
      en: ['Spread the inside of the bread with mustard or pesto.', 'Pile on the strands of cheese and your filling.', 'Butter the outside and cook in a pan over medium heat, 3 minutes per side, pressing gently.', 'Slice and pull.'],
      es: ['Unta el interior del pan con mostaza o pesto.', 'Agrega el queso deshebrado y tu relleno.', 'Unta mantequilla por fuera y cocina en sartén a fuego medio, 3 minutos por lado, presionando suave.', 'Corta y estira.'],
    },
  },
  {
    id: 'grill-skewers',
    tags: ['prep', 'family'],
    img: 'img/life/skewers.webp',
    product: 'panela',
    time: 20,
    serves: 4,
    title: { en: 'Fire-Grilled Skewers', es: 'Brochetas a la Parrilla' },
    blurb: { en: 'Firm cheese cubes, peppers and onion off the grill. Batch them for the week.', es: 'Cubos de queso firme, pimientos y cebolla a la parrilla. Prepáralos para toda la semana.' },
    ingredients: {
      en: ['12 oz VAYRO Panela Cheese, in 1 in cubes', '2 bell peppers, in chunks', '1 red onion, in chunks', '1 zucchini, sliced', 'Olive oil, garlic powder, smoked paprika'],
      es: ['12 oz de Queso Panela VAYRO en cubos de 2.5 cm', '2 pimientos en trozos', '1 cebolla morada en trozos', '1 calabacita rebanada', 'Aceite de oliva, ajo en polvo, paprika ahumada'],
    },
    steps: {
      en: ['Toss the vegetables with oil and spices.', 'Thread cheese and vegetables onto skewers.', 'Grill over high heat 2–3 minutes per side, just until marked.', 'Eat hot, or pack with grains for meal prep.'],
      es: ['Mezcla las verduras con aceite y especias.', 'Ensarta el queso y las verduras en las brochetas.', 'Asa a fuego alto 2–3 minutos por lado, solo hasta que se marquen.', 'Cómelas calientes o empácalas con granos para tu meal prep.'],
    },
  },
  {
    id: 'power-bowl',
    tags: ['protein'],
    img: 'img/life/bowl-salmon.webp',
    product: 'fresh',
    time: 20,
    serves: 2,
    title: { en: 'Salmon Power Bowl', es: 'Bowl Power de Salmón' },
    blurb: { en: 'Salmon, grains, crunch and a fresh-cheese finish. Built for busy evenings.', es: 'Salmón, granos, algo crujiente y queso fresco al final. Hecho para las noches con prisa.' },
    ingredients: {
      en: ['2 salmon fillets', '2 cups cooked grains', 'Shredded cabbage, carrot, cucumber', '1/2 cup VAYRO Fresh Cheese, crumbled', 'Lime, olive oil, sesame seeds'],
      es: ['2 filetes de salmón', '2 tazas de granos cocidos', 'Col rallada, zanahoria, pepino', '1/2 taza de Queso Fresco VAYRO desmoronado', 'Limón, aceite de oliva, ajonjolí'],
    },
    steps: {
      en: ['Season and roast the salmon at 400°F / 200°C for 12 minutes.', 'Fill bowls with grains and the crunchy vegetables.', 'Flake the salmon on top and crumble the cheese over everything.', 'Finish with lime, oil and sesame.'],
      es: ['Sazona y hornea el salmón a 200°C / 400°F por 12 minutos.', 'Llena los bowls con granos y verduras crujientes.', 'Desmenuza el salmón encima y desmorona el queso sobre todo.', 'Termina con limón, aceite y ajonjolí.'],
    },
  },
  {
    id: 'prep-plate',
    tags: ['prep', 'protein'],
    img: 'img/life/plate-chicken.webp',
    product: 'panela',
    time: 30,
    serves: 4,
    title: { en: 'Sunday Prep Plate', es: 'Plato de Meal Prep' },
    blurb: { en: 'Grilled chicken, roasted vegetables and firm cheese slices. Four lunches, one pan.', es: 'Pollo asado, verduras al horno y rebanadas de queso firme. Cuatro comidas, un solo sartén.' },
    ingredients: {
      en: ['1.5 lb chicken breast', '4 cups mixed vegetables', '8 oz VAYRO Panela Cheese, sliced', 'Olive oil, lemon, rosemary', 'Salt and pepper'],
      es: ['700 g de pechuga de pollo', '4 tazas de verduras mixtas', '8 oz de Queso Panela VAYRO rebanado', 'Aceite de oliva, limón, romero', 'Sal y pimienta'],
    },
    steps: {
      en: ['Roast the vegetables at 425°F / 220°C for 20 minutes.', 'Grill the chicken 5–6 minutes per side and rest it.', 'Sear the cheese slices for 1 minute per side in the same pan.', 'Divide into containers. Keeps 4 days refrigerated.'],
      es: ['Hornea las verduras a 220°C / 425°F por 20 minutos.', 'Asa el pollo 5–6 minutos por lado y déjalo reposar.', 'Dora las rebanadas de queso 1 minuto por lado en el mismo sartén.', 'Divide en contenedores. Dura 4 días en refrigeración.'],
    },
  },
];

// Where to Buy. Add real stores as they come in; an empty list shows the "rolling out" state.
export const stores = [
  // { name: 'Store name', city: 'City, ST', zip: '00000', url: 'https://…' },
];

export const gallery = [
  { img: 'img/life/core.webp', pos: '50% 60%' },
  { img: 'img/life/bowl-green.webp', pos: '50% 50%' },
  { img: 'img/life/squat.webp', pos: '50% 30%' },
  { img: 'img/life/bowl-egg.webp', pos: '50% 50%' },
  { img: 'img/life/run.webp', pos: '50% 50%' },
  { img: 'img/life/dumbbell.webp', pos: '50% 50%' },
];

// Unsplash License: free for commercial use, attribution appreciated.
export const photoCredit = { label: 'Lifestyle photography: Unsplash', url: 'https://unsplash.com/license' };
