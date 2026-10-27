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
    id: 'fresh-leaf',
    family: 'fresh',
    name: { en: 'Fresh Cheese with Banana Leaf', es: 'Queso Fresco con Hoja de Plátano' },
    line: { en: 'Soft, fresh, wrapped in leaf.', es: 'Suave, fresco, envuelto en hoja.' },
    use: { en: 'Traditional flavor with a fresh, soft and crumbly texture', es: 'Sabor tradicional con textura fresca, suave y desmoronable' },
    desc: {
      en: 'Our fresh cheese, rested on banana leaf for a delicate, natural aroma. Soft enough to crumble, firm enough to slice, with 10g of protein per serving.',
      es: 'Nuestro queso fresco, reposado sobre hoja de plátano para un aroma delicado y natural. Lo bastante suave para desmoronar y firme para rebanar, con 10 g de proteína por porción.',
    },
    accent: '#EA6620',
    sizes: [
      { id: 'fresh-leaf-12', label: '12 oz', grams: '340 g', img: 'img/products/fresh-leaf-12.webp', servings: 6, channel: 'retail' },
      { id: 'fresh-leaf-14', label: '14 oz', grams: '396 g', img: 'img/products/fresh-leaf-14.webp', servings: 7, channel: 'retail' },
      { id: 'fresh-leaf-80', label: '5 lb', grams: '80 oz', img: 'img/products/fresh-leaf-5lb.webp', servings: 40, channel: 'foodservice' },
    ],
    serving: '2 oz (56.8 g)',
    // CONFIRM: same panel as VAYRO Fresh Cheese (matches the legible values on the 12 oz label).
    nf: {
      calories: 180, fat: ['14g', 18], satFat: ['9g', 45], transFat: '0g', cholesterol: ['30mg', 10], sodium: ['470mg', 20],
      carbs: ['4g', 1], fiber: ['0g', 0], sugars: '0g', addedSugars: ['0g', 0], protein: 10,
      vitD: 2, calcium: 25, iron: 0, potassium: 0,
    },
    ingredients: 'Pasteurized Milk, Nonfat Dry Milk, Palm Oil, Salt, Acetic Acid, Culture, Enzymes, Natamycin, and Sorbic Acid (mold inhibitor).',
    contains: 'Milk & Soy',
    pairs: { en: ['Breakfast plates', 'Salads', 'Grilled vegetables', 'Fruit & honey'], es: ['Desayunos', 'Ensaladas', 'Verduras asadas', 'Fruta con miel'] },
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
      // CONFIRM: servings for 30 oz (850 g ÷ 58.8 g per serving ≈ 14).
      { id: 'oaxaca-30', label: '30 oz', grams: '850 g', img: 'img/products/oax30.webp', servings: 14, channel: 'club' },
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
    id: 'basket',
    family: 'slice',
    name: { en: 'Basket Cheese', es: 'Queso Canasta' },
    line: { en: 'One wheel. Every meal.', es: 'Una rueda. Todas las comidas.' },
    use: { en: 'Perfect for slicing, crumbling and everyday meals', es: 'Perfecto para rebanar, desmoronar y las comidas de todos los días' },
    desc: {
      en: 'A big fresh-cheese wheel with the classic basket-weave pattern. Slices clean, crumbles easily and feeds a full kitchen, with 9g of protein per serving.',
      es: 'Una rueda grande de queso fresco con el clásico tejido de canasta. Se rebana limpio, se desmorona fácil y rinde para toda una cocina, con 9 g de proteína por porción.',
    },
    accent: '#EA6620',
    sizes: [{ id: 'basket-224', label: '14 lb', grams: '224 oz', img: 'img/products/basket.webp', servings: null, channel: 'foodservice' }],
    serving: null,
    // CONFIRM: only the front-of-pack claims are known (9g protein, excellent source of calcium).
    // Add the full panel and ingredients from the label to show them on the site.
    nf: { protein: 9, calcium: null },
    ingredients: null,
    contains: null,
    pairs: { en: ['Sandwiches', 'Platters', 'Salads', 'Family meals'], es: ['Sándwiches', 'Tablas', 'Ensaladas', 'Comidas familiares'] },
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
    id: 'seared-plate',
    tags: ['protein', 'prep'],
    img: 'img/recipes/golden-sear-plate.webp',
    product: 'frying',
    time: 15,
    serves: 2,
    title: { en: 'Golden Sear Power Plate', es: 'Plato Power Dorado' },
    blurb: { en: 'Golden seared cheese over spinach, pomegranate and toasted nuts. Dinner in 15.', es: 'Queso dorado sobre espinaca, granada y nueces tostadas. La cena en 15.' },
    ingredients: {
      en: ['8 oz VAYRO Frying Cheese, sliced 1/2 in thick', '4 handfuls baby spinach', '1 small beet, roasted and sliced (optional)', '1/2 cup pomegranate seeds', '1/4 cup walnuts or pecans, toasted', '2 tbsp olive oil + 1 lemon', 'Salt and black pepper'],
      es: ['8 oz de Queso para Freír VAYRO, rebanadas de 1 cm', '4 puños de espinaca baby', '1 betabel pequeño asado y rebanado (opcional)', '1/2 taza de granos de granada', '1/4 taza de nuez tostada', '2 cdas de aceite de oliva + 1 limón', 'Sal y pimienta negra'],
    },
    steps: {
      en: ['Heat a dry non-stick pan over medium-high.', 'Sear the cheese 1–2 minutes per side until deep golden. Do not move it while it sears.', 'Toss the spinach with olive oil, lemon, salt and pepper and plate it.', 'Top with beet, pomegranate, nuts and the hot cheese.'],
      es: ['Calienta un sartén antiadherente sin aceite a fuego medio-alto.', 'Dora el queso 1–2 minutos por lado hasta que esté bien dorado. No lo muevas mientras se dora.', 'Mezcla la espinaca con aceite de oliva, limón, sal y pimienta y sírvela.', 'Corona con el betabel, la granada, las nueces y el queso caliente.'],
    },
  },
  {
    id: 'fresh-toast',
    tags: ['quick', 'family'],
    img: 'img/recipes/fresh-cheese-toast.webp',
    product: 'fresh',
    time: 8,
    serves: 1,
    title: { en: 'Morning Stack Toast', es: 'Toast de la Mañana' },
    blurb: { en: 'Thick toast piled with crumbled fresh cheese, cherry tomatoes and herbs. Ready before the day starts.', es: 'Pan grueso con queso fresco desmoronado, jitomates cherry y hierbas. Listo antes de que empiece el día.' },
    ingredients: {
      en: ['1 thick slice of bread or brioche', '1/3 cup VAYRO Fresh Cheese, crumbled', '4 cherry tomatoes, halved', '1 tsp honey or olive oil', 'Fresh basil or microgreens, black pepper', '1 egg (optional, for extra protein)'],
      es: ['1 rebanada gruesa de pan o brioche', '1/3 de taza de Queso Fresco VAYRO desmoronado', '4 jitomates cherry en mitades', '1 cdita de miel o aceite de oliva', 'Albahaca fresca o germinados, pimienta negra', '1 huevo (opcional, para más proteína)'],
    },
    steps: {
      en: ['Toast the bread until golden and crisp.', 'Crumble the cheese generously over the warm toast.', 'Add the tomatoes and a drizzle of honey or olive oil.', 'Finish with herbs and pepper. Add a fried egg on top if you want more protein.'],
      es: ['Tuesta el pan hasta que esté dorado y crujiente.', 'Desmorona bastante queso sobre el pan caliente.', 'Agrega los jitomates y un chorrito de miel o aceite de oliva.', 'Termina con hierbas y pimienta. Si quieres más proteína, ponle un huevo estrellado encima.'],
    },
  },
  {
    id: 'ultimate-melt',
    tags: ['quick', 'family'],
    img: 'img/recipes/ultimate-melt.webp',
    product: 'oaxaca',
    time: 10,
    serves: 2,
    title: { en: 'The Ultimate Melt', es: 'El Sándwich Fundido' },
    blurb: { en: 'Crisp outside, stretch inside. The weeknight sandwich everyone asks for.', es: 'Crujiente por fuera, estirado por dentro. El sándwich que todos piden entre semana.' },
    ingredients: {
      en: ['4 slices of your favorite bread', '6 oz VAYRO Oaxaca Cheese, pulled into strands', 'Sliced turkey, ham or grilled veggies', '1 tbsp butter', 'Mustard or pesto', 'A side salad or fries'],
      es: ['4 rebanadas de tu pan favorito', '6 oz de Queso Oaxaca VAYRO deshebrado', 'Pavo, jamón o verduras asadas', '1 cda de mantequilla', 'Mostaza o pesto', 'Ensalada o papas para acompañar'],
    },
    steps: {
      en: ['Spread the inside of the bread with mustard or pesto.', 'Pile on the strands of cheese and your filling.', 'Butter the outside and cook in a pan over medium heat, 3 minutes per side, pressing gently.', 'Slice, pull and serve with salad or fries.'],
      es: ['Unta el interior del pan con mostaza o pesto.', 'Agrega el queso deshebrado y tu relleno.', 'Unta mantequilla por fuera y cocina en sartén a fuego medio, 3 minutos por lado, presionando suave.', 'Corta, estira y sirve con ensalada o papas.'],
    },
  },
  {
    id: 'fresh-skewers',
    tags: ['quick', 'family'],
    img: 'img/recipes/fresh-skewers.webp',
    product: 'panela',
    time: 10,
    serves: 4,
    title: { en: 'Fresh Bite Skewers', es: 'Brochetas Frescas' },
    blurb: { en: 'Firm cheese cubes, cherry tomatoes and basil on a stick. The snack every table finishes first.', es: 'Cubos de queso firme, jitomates cherry y albahaca en brocheta. La botana que se acaba primero en cualquier mesa.' },
    ingredients: {
      en: ['12 oz VAYRO Panela Cheese, in 3/4 in cubes', '24 cherry tomatoes', '1 bunch fresh basil', '2 tbsp olive oil or pesto', 'Flaky salt and black pepper', 'Small skewers'],
      es: ['12 oz de Queso Panela VAYRO en cubos de 2 cm', '24 jitomates cherry', '1 manojo de albahaca fresca', '2 cdas de aceite de oliva o pesto', 'Sal en escamas y pimienta negra', 'Palillos para brocheta'],
    },
    steps: {
      en: ['Thread tomato, basil leaf and cheese onto each skewer, then repeat.', 'Lay them on a board or tray.', 'Drizzle with olive oil or pesto and season with salt and pepper.', 'Serve cold, or grill 1 minute per side for a warm version.'],
      es: ['Ensarta jitomate, hoja de albahaca y queso en cada brocheta, y repite.', 'Acomódalas en una tabla o charola.', 'Báñalas con aceite de oliva o pesto y sazona con sal y pimienta.', 'Sírvelas frías, o ásalas 1 minuto por lado para una versión caliente.'],
    },
  },
  {
    id: 'apple-salad',
    tags: ['quick'],
    img: 'img/recipes/apple-power-salad.webp',
    product: 'fresh',
    time: 10,
    serves: 2,
    title: { en: 'Crisp Apple Power Salad', es: 'Ensalada Power de Manzana' },
    blurb: { en: 'Green apple, spinach, walnuts and a generous fresh-cheese crumble. Fresh, filling and fast.', es: 'Manzana verde, espinaca, nueces y bastante queso fresco desmoronado. Fresca, llenadora y rápida.' },
    ingredients: {
      en: ['4 handfuls spinach or kale', '1 green apple, thinly sliced', '1/2 cup VAYRO Fresh Cheese, crumbled', '1/3 cup walnuts', '1/4 cup pomegranate seeds', '2 tbsp olive oil, 1 tbsp lemon juice, 1 tsp honey'],
      es: ['4 puños de espinaca o kale', '1 manzana verde en rebanadas delgadas', '1/2 taza de Queso Fresco VAYRO desmoronado', '1/3 de taza de nueces', '1/4 de taza de granos de granada', '2 cdas de aceite de oliva, 1 cda de jugo de limón, 1 cdita de miel'],
    },
    steps: {
      en: ['Whisk the olive oil, lemon and honey with a pinch of salt.', 'Toss the greens and apple with the dressing.', 'Scatter the walnuts and pomegranate on top.', 'Crumble the cheese over everything just before serving.'],
      es: ['Bate el aceite de oliva, el limón y la miel con una pizca de sal.', 'Mezcla las hojas y la manzana con el aderezo.', 'Agrega las nueces y la granada encima.', 'Desmorona el queso sobre todo justo antes de servir.'],
    },
  },
  {
    id: 'snack-boxes',
    tags: ['prep', 'protein'],
    img: 'img/recipes/snack-boxes.webp',
    product: 'panela',
    time: 10,
    serves: 4,
    title: { en: 'Sunday Snack Boxes', es: 'Cajitas de Snack para la Semana' },
    blurb: { en: 'Firm cheese cubes with a pinch of chili, crisp cucumber and sweet corn. Four grab-and-go boxes in 10 minutes.', es: 'Cubos de queso firme con un toque de chile, pepino crujiente y elote dulce. Cuatro cajitas para llevar en 10 minutos.' },
    ingredients: {
      en: ['12 oz VAYRO Panela Cheese, in thick cubes', '2 cucumbers, sliced', '1 1/2 cups sweet corn', '1 cup cherry tomatoes', 'Chili flakes or smoked paprika', '4 meal-prep containers'],
      es: ['12 oz de Queso Panela VAYRO en cubos gruesos', '2 pepinos rebanados', '1 1/2 tazas de elote dulce', '1 taza de jitomates cherry', 'Hojuelas de chile o paprika ahumada', '4 contenedores para meal prep'],
    },
    steps: {
      en: ['Cut the cheese into thick cubes and dust with chili flakes or paprika.', 'Slice the cucumbers and drain the corn.', 'Divide cheese, cucumber, corn and tomatoes between the containers.', 'Close and refrigerate. Keeps 4 days.'],
      es: ['Corta el queso en cubos gruesos y espolvoréale chile o paprika.', 'Rebana los pepinos y escurre el elote.', 'Reparte el queso, el pepino, el elote y los jitomates en los contenedores.', 'Tapa y refrigera. Dura 4 días.'],
    },
  },
];

// Where to Buy. Add real stores as they come in; an empty list shows the "rolling out" state.
export const stores = [
  // { name: 'Store name', city: 'City, ST', zip: '00000', url: 'https://…' },
];

export const gallery = [
  { img: 'img/life/core.webp', pos: '50% 60%' },
  { img: 'img/life/watermelon-cheese.webp', pos: '50% 55%' },
  { img: 'img/life/squat.webp', pos: '50% 30%' },
  { img: 'img/life/bowl-egg.webp', pos: '50% 50%' },
  { img: 'img/life/run.webp', pos: '50% 50%' },
  { img: 'img/life/dumbbell.webp', pos: '50% 50%' },
];

// Unsplash License: free for commercial use, attribution appreciated.
export const photoCredit = { label: 'Lifestyle photography: Unsplash', url: 'https://unsplash.com/license' };
