// "Pregúntale al Abuelito": el chat con IA.
// 1) Intenta contestar con la IA real (POST /api/chat → Claude, ver api/chat.js).
// 2) Si la IA no está disponible (sin llave, sin internet, vista previa), contesta un
//    "cerebro local" con reglas que conoce todo el catálogo, recetas y datos de contacto.
// Las respuestas pueden traer marcas [[p:id]] y [[r:id]] que se convierten en tarjetas.
import { gsap } from 'gsap';
import { BRAND, PRODUCTS, RECIPES, COUNTRIES, CRAVINGS, DEPARTMENTS } from './data.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let ctx;
const history = []; // { role: 'user' | 'assistant', content }
let busy = false;
let apiDown = false;

export function initChat(c) {
  ctx = c;
  $('#chatClose').addEventListener('click', closeChat);
  $('#chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#chatInput').value.trim();
    if (v) send(v);
  });
  $('#chatSuggest').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) send(b.textContent); });
  $('#chatLog').addEventListener('click', (e) => {
    const p = e.target.closest('[data-chat-product]');
    const r = e.target.closest('[data-chat-recipe]');
    if (p) { if (innerWidth <= 860) closeChat(); ctx.openProduct(p.dataset.chatProduct); }
    if (r) { if (innerWidth <= 860) closeChat(); ctx.openRecipe(r.dataset.chatRecipe); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#chat').hidden) closeChat(); });
}

export function openChat(prefill) {
  const chat = $('#chat');
  if (chat.hidden) {
    chat.hidden = false;
    $('#chatFab').hidden = true;
    gsap.fromTo(chat, { scale: 0.4, opacity: 0, y: 40 }, { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.6)' });
    if (!history.length && !$('#chatLog').children.length) {
      bot(ctx.t('chat.hello'));
      renderSuggest();
    }
  }
  if (prefill) send(prefill);
  else setTimeout(() => $('#chatInput').focus(), 300);
}

function closeChat() {
  const chat = $('#chat');
  gsap.to(chat, { scale: 0.5, opacity: 0, y: 40, duration: 0.25, ease: 'power2.in', onComplete: () => { chat.hidden = true; $('#chatFab').hidden = false; gsap.set(chat, { clearProps: 'all' }); } });
}

function renderSuggest() {
  $('#chatSuggest').innerHTML = ['chat.s1', 'chat.s2', 'chat.s3', 'chat.s4'].map((k) => `<button type="button">${esc(ctx.t(k))}</button>`).join('');
}

// ───────── Mensajes ─────────
function scrollLog() { const log = $('#chatLog'); log.scrollTop = log.scrollHeight; }

function me(text) {
  const el = document.createElement('div');
  el.className = 'msg msg--me';
  el.textContent = text;
  $('#chatLog').append(el);
  gsap.from(el, { x: 30, opacity: 0, duration: 0.3 });
  scrollLog();
}

function linkify(html) {
  return html
    .replace(/(\+?1?[\s(]*\d{3}[)\s.-]*\d{3}[\s.-]\d{4})/g, (m) => `<a href="tel:${m.replace(/[^\d+]/g, '')}">${m}</a>`)
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}

function bot(raw) {
  const pids = [];
  const rids = [];
  let text = String(raw)
    .replace(/\[\[p:([\w-]+)\]\]/g, (_, id) => { if (PRODUCTS.some((p) => p.id === id) && !pids.includes(id)) pids.push(id); return ''; })
    .replace(/\[\[r:([\w-]+)\]\]/g, (_, id) => { if (RECIPES.some((r) => r.id === id) && !rids.includes(id)) rids.push(id); return ''; })
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const el = document.createElement('div');
  el.className = 'msg msg--bot';
  el.innerHTML = linkify(esc(text));
  if (pids.length) {
    el.insertAdjacentHTML('beforeend', `<div class="msg__prods">${pids.slice(0, 8).map((id) => {
      const p = PRODUCTS.find((x) => x.id === id);
      return `<button class="mprod" data-chat-product="${id}"><img src="img/p/${p.v[0][1]}.webp" alt="" loading="lazy" />${esc(ctx.L(p.name))}</button>`;
    }).join('')}</div>`);
  }
  if (rids.length) {
    el.insertAdjacentHTML('beforeend', `<div class="msg__prods">${rids.map((id) => {
      const r = RECIPES.find((x) => x.id === id);
      return `<button class="btn btn--small btn--green" data-chat-recipe="${id}">${r.emoji} ${esc(ctx.L(r.name))}</button>`;
    }).join('')}</div>`);
  }
  $('#chatLog').append(el);
  gsap.from(el, { y: 20, opacity: 0, scale: 0.95, duration: 0.35, ease: 'back.out(1.6)' });
  scrollLog();
  return text;
}

function typing() {
  const el = document.createElement('div');
  el.className = 'msg msg--bot';
  el.setAttribute('aria-label', ctx.t('chat.thinking'));
  el.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  $('#chatLog').append(el);
  scrollLog();
  return el;
}

async function send(text) {
  if (busy) return;
  busy = true;
  $('#chatInput').value = '';
  $('#chatSuggest').innerHTML = '';
  me(text);
  history.push({ role: 'user', content: text });
  const dots = typing();
  let reply;
  try {
    reply = apiDown ? null : await askAPI();
  } catch {
    apiDown = true;
    reply = null;
  }
  if (!reply) {
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
    reply = localBrain(text, ctx.state.lang);
  }
  dots.remove();
  history.push({ role: 'assistant', content: reply });
  bot(reply);
  busy = false;
  $('#chatInput').focus();
}

async function askAPI() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch('api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: ctx.state.lang, messages: history.slice(-12) }),
      signal: ctrl.signal,
    });
    if (res.status === 404 || res.status === 405 || res.status === 501 || res.status === 503) { apiDown = true; return null; }
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.reply === 'string' && data.reply.trim() ? data.reply : null;
  } finally {
    clearTimeout(timer);
  }
}

// ───────── Cerebro local (respaldo sin IA) ─────────
const KW = {
  hi: ['hola', 'buenas', 'buenos', 'hello', 'hi', 'hey', 'que tal', 'saludos'],
  thanks: ['gracias', 'thank', 'thanks'],
  where: ['donde compro', 'donde lo compro', 'donde encuentro', 'donde venden', 'tiendas', 'where can i buy', 'where to buy', 'stores', 'comprar', 'buy'],
  contact: ['telefono', 'llamar', 'numero', 'correo', 'email', 'direccion', 'ubicacion', 'phone', 'call', 'address', 'contact', 'contacto', 'oficina'],
  wholesale: ['mayoreo', 'mayorista', 'distribuir', 'distribuidor', 'vender sus productos', 'vender', 'mi negocio', 'mi tienda', 'restaurante', 'taqueria', 'carniceria', 'wholesale', 'distributor', 'sell your', 'my store', 'my business', 'cliente'],
  news: ['nuevo', 'nuevos', 'novedad', 'novedades', 'new', 'latest'],
  recipe: ['receta', 'recetas', 'cocinar', 'preparar', 'recipe', 'recipes', 'cook', 'how to make'],
  story: ['historia', 'fundador', 'miguel', 'quien es', 'story', 'founder', 'history'],
  quality: ['calidad', 'fda', 'seguro', 'laboratorio', 'quality', 'safe', 'lab'],
  storage: ['conservar', 'guardar', 'refrigerar', 'caduca', 'dura', 'store it', 'how do i store', 'storage', 'storing', 'keep', 'fridge', 'expire'],
  health: ['alergia', 'alergeno', 'gluten', 'lactosa', 'embaraz', 'pasteuriz', 'calorias', 'allerg', 'lactose', 'pregnan', 'pasteur', 'calorie', 'nutri'],
};
// Palabras cortas ("hi", "lab") solo cuentan como palabra completa; las largas, como prefijo.
const has = (q, list) => list.some((k) => (k.length <= 3 ? new RegExp(`\\b${k}\\b`).test(q) : q.includes(k)));

const COUNTRY_WORDS = {
  mx: ['mexic', 'mexico'], sv: ['salvador', 'salvadoren', 'salvadoran'], hn: ['hondur', 'olanch'], gt: ['guatemal', 'chapin'],
  ec: ['ecuator', 'ecuador'], pe: ['peru'], co: ['colombi'], do: ['dominican', 'dominicano', 'dominicana'],
};

function scoreProducts(q) {
  const words = q.split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !['que', 'con', 'para', 'los', 'las', 'del', 'una', 'uno', 'the', 'and', 'for', 'with', 'what', 'queso', 'cheese', 'tienen', 'have', 'quiero', 'want', 'hay'].includes(w));
  const scored = PRODUCTS.map((p) => {
    const name = norm(p.name.es + ' ' + p.name.en);
    const tags = p.tags.join(' ');
    let s = 0;
    for (const w of words) {
      const stem = w.length > 5 ? w.slice(0, -1) : w;
      if (name.includes(stem)) s += 3;
      if (tags.includes(stem)) s += 2;
      if (norm(p.desc.es + ' ' + p.desc.en).includes(stem)) s += 0.5;
    }
    if (s > 0 && /\b(queso|quesos|cheese|cheeses)\b/.test(q) && p.dept === 'quesos') s += 4;
    for (const [cid, ws] of Object.entries(COUNTRY_WORDS)) if (p.country === cid && ws.some((x) => q.includes(x))) s += 2;
    return [s, p];
  }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
  return scored.map(([, p]) => p);
}

export function localBrain(input, lang) {
  const q = norm(input);
  const es = lang !== 'en';
  const tag = (ids) => ids.map((id) => `[[p:${id}]]`).join(' ');

  if (has(q, KW.health)) {
    return es
      ? `Ay, mijo, para temas de salud, alérgenos o pasteurización lo más seguro es revisar la etiqueta de cada producto; ahí viene todo. Si tienes una duda específica, llámanos al ${BRAND.phone} o escríbenos a ${BRAND.email} y con gusto te ayudamos.`
      : `Mijo, for health, allergen or pasteurization questions, the safest thing is to check each product's label; everything is listed there. For a specific question, call us at ${BRAND.phone} or email ${BRAND.email} and we'll gladly help.`;
  }
  if (has(q, KW.wholesale)) {
    return es
      ? `¡Qué gusto que quieras trabajar con nosotros! Tenemos presentaciones para negocio de 5 y 10 libras y cubetas, ideales para tiendas, carnicerías, taquerías y pupuserías. Llena el formulario de contacto eligiendo "Tienda" o "Restaurante", o llámanos al ${BRAND.phone} (gratis: ${BRAND.tollFree}). ${tag(['carne-cecina', 'queso-oaxaca', 'crema-mexicana', 'queso-fresco'])}`
      : `So glad you want to work with us! We have business sizes in 5 and 10 lb and buckets, great for stores, butcher shops, taquerias and pupuserías. Fill out the contact form choosing "Store" or "Restaurant", or call ${BRAND.phone} (toll free: ${BRAND.tollFree}). ${tag(['carne-cecina', 'queso-oaxaca', 'crema-mexicana', 'queso-fresco'])}`;
  }
  if (has(q, KW.where)) {
    return es
      ? `Nuestros productos se venden en tiendas latinas, supermercados y carnicerías del área triestatal. Si no los ves en tu tienda de confianza, pídeselos al encargado, ¡o escríbenos a ${BRAND.email} y te orientamos!`
      : `Our products are sold at Latino stores, supermarkets and butcher shops across the tri-state area. If your usual store doesn't have them, ask the manager, or email us at ${BRAND.email} and we'll point you in the right direction!`;
  }
  if (has(q, KW.contact)) {
    return es
      ? `Aquí me encuentras, mijo:\n📍 ${BRAND.address}\n📞 ${BRAND.phone}\n☎️ Gratis: ${BRAND.tollFree}\n✉️ ${BRAND.email}\n📸 Instagram: ${BRAND.instagramHandle}`
      : `Here's where to find me, mijo:\n📍 ${BRAND.address}\n📞 ${BRAND.phone}\n☎️ Toll free: ${BRAND.tollFree}\n✉️ ${BRAND.email}\n📸 Instagram: ${BRAND.instagramHandle}`;
  }
  if (has(q, KW.storage)) {
    return es
      ? 'Los quesos frescos y cremas siempre en el refri, bien tapaditos, y consúmelos antes de la fecha del empaque. Ya abiertos, guárdalos en un recipiente hermético. Las carnes marinadas, refrigeradas o congeladas si no las vas a usar pronto.'
      : 'Keep fresh cheeses and creams in the fridge, well sealed, and enjoy them before the date on the package. Once opened, store them in an airtight container. Keep marinated meats refrigerated, or freeze them if you won\'t use them soon.';
  }

  // Recetas
  if (has(q, KW.recipe)) {
    const rMatch = RECIPES.find((r) => norm(r.name.es + ' ' + r.name.en).split(/\s+/).some((w) => w.length >= 4 && q.includes(w)));
    const r = rMatch || RECIPES[Math.floor(Math.random() * RECIPES.length)];
    return es
      ? `¡Claro que sí! Te recomiendo esta: **${r.name.es}**. ${r.intro.es} Queda lista en unos ${r.time} minutos. Toca la receta para ver ingredientes y pasos. [[r:${r.id}]] ${tag(r.products)}`
      : `Of course! Try this one: **${r.name.en}**. ${r.intro.en} It's ready in about ${r.time} minutes. Tap the recipe for ingredients and steps. [[r:${r.id}]] ${tag(r.products)}`;
  }
  if (has(q, KW.news)) {
    const n = PRODUCTS.filter((p) => p.isNew);
    return es
      ? `¡Recién salidos de la cocina! Tenemos quesos frescos caseros, mozzarella, queso con chile rojo, jamón de pavo, arepas y cuatro moles nuevos. ${tag(n.map((p) => p.id))}`
      : `Fresh out of the kitchen! We have homestyle fresh cheeses, mozzarella, cheese with red pepper, turkey ham, arepas and four new moles. ${tag(n.map((p) => p.id))}`;
  }
  if (has(q, KW.story)) {
    return es
      ? 'El Abuelito nació en 1998, el sueño de Don Miguel Torres, un mexicano apasionado que quiso llevar un pedacito de México a cada rincón del área triestatal. Hoy, desde Paterson, NJ, seguimos haciendo todo con el mismo cariño. ¡Su legado vive en cada bocado!'
      : 'El Abuelito was born in 1998, the dream of Don Miguel Torres, a passionate Mexican who wanted to bring a piece of Mexico to every corner of the tri-state area. Today, from Paterson, NJ, we keep making everything with the same love. His legacy lives on in every bite!';
  }
  if (has(q, KW.quality)) {
    return es
      ? 'La calidad es nuestra filosofía, mijo. Tenemos un laboratorio de control de calidad que hace pruebas analíticas y trabaja con producción para cumplir con los estándares del Departamento de Salud y la FDA.'
      : 'Quality is our philosophy, mijo. Our quality control lab runs analytical tests and works with production to meet Department of Health and FDA standards.';
  }

  // Antojos / platillos
  const crave = CRAVINGS.find((c) => q.includes(norm(c.name.es)) || q.includes(norm(c.name.en)) || q.includes(c.tag));
  const found = scoreProducts(q);
  if (crave && found.length < 2) {
    const items = PRODUCTS.filter((p) => p.tags.includes(crave.tag)).slice(0, 6);
    return es
      ? `¡Ay, qué rico! Para ${crave.name.es.toLowerCase()} yo me llevaría esto: ${tag(items.map((p) => p.id))}`
      : `Oh, delicious! For ${crave.name.en.toLowerCase()}, I'd grab these: ${tag(items.map((p) => p.id))}`;
  }
  if (found.length) {
    const top = found.slice(0, 6);
    const p = top[0];
    return es
      ? `${p.name.es}: ${p.desc.es}${top.length > 1 ? '\n\nTambién te puede gustar:' : ''} ${tag(top.map((x) => x.id))}`
      : `${p.name.en}: ${p.desc.en}${top.length > 1 ? '\n\nYou might also like:' : ''} ${tag(top.map((x) => x.id))}`;
  }
  const country = COUNTRIES.find((c) => COUNTRY_WORDS[c.id].some((w) => q.includes(w)));
  if (country) {
    const items = PRODUCTS.filter((p) => p.country === country.id).slice(0, 6);
    return es ? `${country.flag} ¡Claro! De ${country.name.es} tenemos: ${tag(items.map((p) => p.id))}` : `${country.flag} Of course! From ${country.name.en} we have: ${tag(items.map((p) => p.id))}`;
  }
  if (has(q, KW.thanks)) return es ? '¡De nada, mijo! Aquí estoy para lo que se te ofrezca. ¡Buen provecho! 🧀' : 'You\'re welcome, mijo! I\'m here whenever you need me. Enjoy! 🧀';
  if (has(q, KW.hi)) return es ? '¡Hola, mijo! ¿Qué se te antoja hoy? Puedo recomendarte quesos, darte una receta o ayudarte si tienes un negocio.' : 'Hi, mijo! What are you craving today? I can recommend cheeses, share a recipe or help if you own a business.';

  const depts = DEPARTMENTS.map((d) => `${d.emoji} ${d.name[es ? 'es' : 'en']}`).join(', ');
  return es
    ? `Mmm, no estoy seguro de haberte entendido, mijo. Tenemos ${depts}. Pregúntame por un producto, un platillo (pupusas, tacos, enchiladas…) o pídeme una receta. Si prefieres, llámanos al ${BRAND.phone}.`
    : `Hmm, I'm not sure I understood, mijo. We have ${depts}. Ask me about a product, a dish (pupusas, tacos, enchiladas…) or ask for a recipe. Or call us at ${BRAND.phone}.`;
}
