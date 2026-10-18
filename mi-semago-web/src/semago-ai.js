// "Semago IA": el asesor de marca privada.
// 1) Intenta contestar con la IA real (POST /api/chat → Claude, ver server/semago.js).
// 2) Si no está disponible (sin llave, sin internet, vista previa), contesta un cerebro local
//    con reglas que conoce el catálogo, las fichas técnicas, los tiempos y el mapa de envíos.
// Las respuestas pueden traer marcas [[p:id]] (tarjetas de producto) y [[studio:id]] (botón al Estudio).
import { gsap } from 'gsap';
import { BRAND, PRODUCTS, CATEGORIES, PROCESS, FAQ, transitDays } from './data.js';
import { STATES } from './states.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let ctx;
const history = [];
let busy = false;
let apiDown = false;

export function initChat(c) {
  ctx = c;
  $('#chatFab').addEventListener('click', () => openChat());
  $('#chatClose').addEventListener('click', closeChat);
  $('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#chatInput').value.trim(); if (v) send(v); });
  $('#chatSuggest').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) send(b.textContent); });
  $('#chatLog').addEventListener('click', (e) => {
    const p = e.target.closest('[data-chat-product]');
    const s = e.target.closest('[data-chat-studio]');
    if (p) { if (innerWidth <= 860) closeChat(); ctx.openProduct(p.dataset.chatProduct); }
    if (s) { closeChat(); ctx.toStudio(s.dataset.chatStudio); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#chat').hidden) closeChat(); });
}

export function openChat(prefill) {
  const chat = $('#chat');
  if (chat.hidden) {
    chat.hidden = false; $('#chatFab').hidden = true;
    if (!ctx.reduced) gsap.fromTo(chat, { scale: 0.5, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.5)' });
    if (!$('#chatLog').children.length) { bot(ctx.t('ai.hello')); renderSuggest(); }
  }
  if (prefill) send(prefill); else setTimeout(() => $('#chatInput').focus(), 250);
}

function closeChat() {
  const chat = $('#chat');
  const done = () => { chat.hidden = true; $('#chatFab').hidden = false; gsap.set(chat, { clearProps: 'all' }); };
  if (ctx.reduced) return done();
  gsap.to(chat, { scale: 0.6, opacity: 0, y: 30, duration: 0.25, ease: 'power2.in', onComplete: done });
}

export function refreshChat() { if (!$('#chatLog').children.length || !history.length) renderSuggest(); }
function renderSuggest() { $('#chatSuggest').innerHTML = ['ai.s1', 'ai.s2', 'ai.s3', 'ai.s4'].map((k) => `<button type="button">${esc(ctx.t(k))}</button>`).join(''); }

// ───────── Mensajes ─────────
const scrollLog = () => { const l = $('#chatLog'); l.scrollTop = l.scrollHeight; };
function me(text) {
  const el = document.createElement('div'); el.className = 'msg msg--me'; el.textContent = text;
  $('#chatLog').append(el); if (!ctx.reduced) gsap.from(el, { x: 24, opacity: 0, duration: 0.3 }); scrollLog();
}
function linkify(html) {
  return html
    .replace(/(\+1[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}|\(\d{3}\)\s?\d{3}-\d{4})/g, (m) => `<a href="tel:${m.replace(/[^\d+]/g, '')}">${m}</a>`)
    .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}
function bot(raw) {
  const pids = []; let studio = null;
  const text = String(raw)
    .replace(/\[\[p:([\w-]+)\]\]/g, (_, id) => { if (PRODUCTS.some((p) => p.id === id) && !pids.includes(id)) pids.push(id); return ''; })
    .replace(/\[\[studio:([\w-]+)\]\]/g, (_, id) => { if (PRODUCTS.some((p) => p.id === id)) studio = id; return ''; })
    .trim();
  const el = document.createElement('div'); el.className = 'msg msg--bot'; el.innerHTML = linkify(esc(text));
  $('#chatLog').append(el);
  if (pids.length) {
    const lang = ctx.lang();
    const cards = document.createElement('div'); cards.className = 'cards';
    cards.innerHTML = pids.slice(0, 6).map((id) => { const p = PRODUCTS.find((x) => x.id === id); return `<button class="mini" type="button" data-chat-product="${id}"><img src="./img/p/${p.img}.webp" alt="" loading="lazy" /><span>${esc(p.name[lang])}</span><small>${p.sizes.map((s) => s.l).join(' · ')}</small></button>`; }).join('');
    $('#chatLog').append(cards);
  }
  if (studio) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chat__btn'; b.dataset.chatStudio = studio; b.textContent = `✦ ${ctx.t('ai.open')}`;
    $('#chatLog').append(b);
  }
  if (!ctx.reduced) gsap.from(el, { x: -24, opacity: 0, duration: 0.35 });
  scrollLog();
}
function typing(on) {
  let t = $('#chatTyping');
  if (on && !t) { t = document.createElement('div'); t.id = 'chatTyping'; t.className = 'msg msg--bot msg--typing'; t.innerHTML = '<i></i><i></i><i></i>'; $('#chatLog').append(t); scrollLog(); }
  if (!on && t) t.remove();
}

async function send(text) {
  if (busy) return;
  busy = true; $('#chatInput').value = ''; $('#chatSuggest').innerHTML = '';
  me(text); history.push({ role: 'user', content: text }); typing(true);
  let reply = null;
  if (!apiDown) {
    try {
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 30000);
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-12), lang: ctx.lang() }), signal: ctl.signal });
      clearTimeout(timer);
      if (res.ok) reply = (await res.json()).reply || null;
      else if (res.status === 503 || res.status === 404 || res.status === 405) apiDown = true;
    } catch { apiDown = true; }
  }
  if (!reply) { await new Promise((r) => setTimeout(r, 500)); reply = localBrain(text); }
  typing(false); history.push({ role: 'assistant', content: reply }); bot(reply); busy = false;
}

// ───────── Cerebro local ─────────
function findProducts(q) {
  const n = norm(q); const out = [];
  const has = (...w) => w.some((x) => n.includes(x));
  if (has('hoja', 'platano', 'leaf', 'plantain')) out.push(...PRODUCTS.filter((p) => p.id.includes('hoja')));
  if (has('deshebr', 'shred')) out.push(PRODUCTS.find((p) => p.id === 'queso-deshebrado'));
  if (has('chile', 'picante', 'spicy')) out.push(PRODUCTS.find((p) => p.id === 'queso-chile-rojo'));
  if (has('cubeta', 'bucket', 'granel', 'bulk')) out.push(PRODUCTS.find((p) => p.id === 'fresco-cubeta'));
  if (has('freir', 'frying', 'blanco', 'tostones')) out.push(PRODUCTS.find((p) => p.id === 'barra-blanco'));
  if (has('chihuahua', 'fundido', 'melt')) out.push(PRODUCTS.find((p) => p.id === 'barra-chihuahua'));
  if (has('food service', 'restaurant', 'taquer', 'pupuser')) out.push(PRODUCTS.find((p) => p.id === 'oaxaca-food-service'));
  for (const c of CATEGORIES) if (n.includes(norm(c.id)) || n.includes(norm(c.name.en))) out.push(...PRODUCTS.filter((p) => p.cat === c.id));
  if (has('fresco', 'fresh')) out.push(...PRODUCTS.filter((p) => p.cat === 'fresco'));
  return [...new Set(out.filter(Boolean))];
}
function findState(q) {
  const n = ` ${norm(q).replace(/[^a-z ]/g, ' ')} `;
  return [...STATES].sort((a, b) => b.name.length - a.name.length).find((s) => n.includes(` ${norm(s.name)} `)) || STATES.find((s) => new RegExp(`\\b${s.id.toLowerCase()}\\b`).test(norm(q)) && s.id !== 'IN' && s.id !== 'OR' && s.id !== 'ME');
}
const tag = (ps) => ps.slice(0, 6).map((p) => `[[p:${p.id}]]`).join('');

function localBrain(q) {
  const en = ctx.lang() === 'en';
  const n = norm(q); const has = (...w) => w.some((x) => n.includes(x));
  const ps = findProducts(q); const st = findState(q);

  if (st && has('tarda', 'llega', 'envio', 'enviar', 'dias', 'ship', 'days', 'long', 'deliver', 'transit', 'cuanto')) {
    const d = st.id === 'AK' || st.id === 'HI' ? null : transitDays(st.miles);
    if (!d) return en ? `${st.name} needs a special route. Call us at ${BRAND.phone} and we'll plan it with you.` : `${st.name} necesita una ruta especial. Llámanos al ${BRAND.phone} y la planeamos contigo.`;
    return en
      ? `To **${st.name}** it's about **${d} ${d === 1 ? 'day' : 'days'}** in refrigerated transport at 40 °F (around ${st.miles.toLocaleString('en-US')} miles from Paterson, NJ). Add ~3 weeks for talks, label and production: under 4 weeks total.`
      : `A **${st.name}** son unos **${d} ${d === 1 ? 'día' : 'días'}** en transporte refrigerado a 40 °F (unas ${st.miles.toLocaleString('es-MX')} millas desde Paterson, NJ). Súmale ~3 semanas de plática, etiqueta y producción: menos de 4 semanas en total.`;
  }
  if (has('tarima', 'pallet', 'palet', 'caja', 'case')) {
    const list = (ps.length ? ps : PRODUCTS.filter((p) => p.packs.some((k) => k.pallet))).slice(0, 4);
    const lines = list.map((p) => `• ${p.name[en ? 'en' : 'es']}: ${p.packs.map((k) => `${k.n}/${en ? 'case' : 'caja'}${k.size ? ` (${k.size})` : ''} → ${k.pallet ? `${k.pallet} ${en ? 'cases/pallet' : 'cajas/tarima'}` : (en ? 'ask us' : 'consultar')}`).join('; ')}`).join('\n');
    return `${en ? 'Here is the pallet configuration:' : 'Así va la configuración por tarima:'}\n${lines}\n${en ? 'Try any volume in the Brand Studio calculator.' : 'Prueba cualquier volumen en la calculadora del Estudio de Marca.'} ${tag(list)}`;
  }
  if (ps.length && has('ingredient', 'contiene', 'contain', 'alerg', 'allerg', 'leche', 'milk', 'soya', 'soy')) {
    const p = ps[0];
    return p.ingredients ? `${p.name[en ? 'en' : 'es']}: ${p.ingredients[en ? 'en' : 'es']} ${en ? 'For allergy questions, always check the product label.' : 'Para alergias, revisa siempre la etiqueta del producto.'} [[p:${p.id}]]` : (en ? `We'll send you the full spec for ${p.name.en}. Write to ${BRAND.email}.` : `Te enviamos la ficha completa de ${p.name.es}. Escríbenos a ${BRAND.email}.`);
  }
  if (has('vida', 'anaquel', 'shelf', 'dura', 'caduc', 'expir')) {
    return en ? 'Shelf life: Oaxaca, Canastón and Panela 60 days (vacuum sealed); queso fresco 40 days; red chile cheese 35 days; the 8.5 lb bucket 65 days. Always at 40 °F.' : 'Vida de anaquel: Oaxaca, Canastón y Panela 60 días (al vacío); queso fresco 40 días; queso con chile rojo 35 días; la cubeta de 8.5 lb 65 días. Siempre a 40 °F.';
  }
  if (has('tiempo', 'semana', 'cuando', 'cuanto tarda', 'how long', 'lead', 'weeks', 'empez', 'start', 'como empiezo', 'proceso', 'process', 'paso')) {
    const steps = PROCESS.map((s, i) => `${i + 1}. ${s.name[en ? 'en' : 'es']} (${s.dur[en ? 'en' : 'es']})`).join('\n');
    return en ? `It takes **4 weeks or less**:\n${steps}\nStart by sketching your label in the Brand Studio, then call us at ${BRAND.phone}. [[studio:oaxaca-retail]]` : `Son **4 semanas o menos**:\n${steps}\nEmpieza armando tu etiqueta en el Estudio de Marca y luego llámanos al ${BRAND.phone}. [[studio:oaxaca-retail]]`;
  }
  if (has('precio', 'price', 'cost', 'cuesta', 'cotiz', 'quote', 'minim', 'moq')) {
    return en ? `Price and minimums depend on the cheese, size and volume. Call us at ${BRAND.phone} or use the form at the bottom of the page and you'll get a quote.` : `El precio y el mínimo dependen del queso, la presentación y el volumen. Llámanos al ${BRAND.phone} o usa el formulario al final de la página y te cotizamos.`;
  }
  if (has('capacidad', 'capacity', 'produc', 'libras', 'pounds', 'planta', 'plant', 'grande')) {
    return en ? `We process and distribute **over 500,000 pounds a week** in a 30,000 sq ft plant in Paterson, NJ, and ship refrigerated to the whole U.S.` : `Procesamos y distribuimos **más de 500,000 libras por semana** en una planta de 30,000 pies² en Paterson, NJ, y enviamos refrigerado a todo EE. UU.`;
  }
  if (has('etiqueta', 'label', 'diseño', 'diseno', 'design', 'logo', 'marca', 'brand', 'private', 'privada')) {
    return en ? `Yes: we produce under your name. You set packaging, design, specs and price; we create the label with you in 3 to 5 days. ${ps.length ? '' : 'All 16 SKUs are available.'} [[studio:${(ps[0] || PRODUCTS[0]).id}]]${tag(ps.length ? ps : PRODUCTS.filter((p) => p.hero))}` : `Sí: producimos con tu nombre. Tú defines empaque, diseño, especificaciones y precio; creamos la etiqueta contigo en 3 a 5 días. ${ps.length ? '' : 'Las 16 presentaciones están disponibles.'} [[studio:${(ps[0] || PRODUCTS[0]).id}]]${tag(ps.length ? ps : PRODUCTS.filter((p) => p.hero))}`;
  }
  if (has('contact', 'telefono', 'phone', 'llamar', 'call', 'correo', 'email', 'direcc', 'address', 'donde', 'where')) {
    return en ? `Call us at ${BRAND.phone} or write to ${BRAND.email}. Office: ${BRAND.office}. Shipping & receiving: ${BRAND.shipping}.` : `Llámanos al ${BRAND.phone} o escribe a ${BRAND.email}. Oficina: ${BRAND.office}. Envío y recepción: ${BRAND.shipping}.`;
  }
  if (ps.length) {
    const p = ps[0];
    return `${p.desc[en ? 'en' : 'es']} ${en ? 'Sizes' : 'Presentaciones'}: ${p.sizes.map((s) => s.l).join(', ')}${p.shelf ? ` · ${p.shelf} ${en ? 'days shelf life' : 'días de anaquel'}` : ''}. [[studio:${p.id}]]${tag(ps)}`;
  }
  if (has('queso', 'cheese', 'producto', 'product', 'catalog', 'que tienen', 'what do you')) {
    return en ? `We make 16 SKUs: Oaxaca (retail, pre-cut, food service, shredded), queso fresco (4", 5", 6", with plantain leaf, red chile, bucket), Canastón, Panela, and Chihuahua and white frying bars. All available under your brand. ${tag(PRODUCTS.filter((p) => p.hero))}` : `Hacemos 16 presentaciones: Oaxaca (retail, precortado, food service, deshebrado), queso fresco (4", 5", 6", con hoja de plátano, con chile rojo, en cubeta), Canastón, Panela y barras de Chihuahua y blanco para freír. Todas disponibles con tu marca. ${tag(PRODUCTS.filter((p) => p.hero))}`;
  }
  const f = FAQ.find((x) => norm(x.q.es).split(' ').filter((w) => w.length > 4).some((w) => n.includes(w)));
  if (f) return f.a[en ? 'en' : 'es'];
  return en ? `I can help with cheeses, spec sheets, pallets, lead times and shipping. For anything else, call us at ${BRAND.phone}.` : `Te ayudo con quesos, fichas técnicas, tarimas, tiempos y envíos. Para lo demás, llámanos al ${BRAND.phone}.`;
}
