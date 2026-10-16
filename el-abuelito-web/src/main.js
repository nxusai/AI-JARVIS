import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { BRAND, DEPARTMENTS, PRODUCTS, COUNTRIES, CRAVINGS, RECIPES, TIMELINE, FAQ } from './data.js';
import { STRINGS } from './i18n.js';
import { initChat, openChat } from './abuelito-ai.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ───────── Idioma ─────────
function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'es' || q === 'en') return q;
  try { const s = localStorage.getItem('abuelito-lang'); if (s === 'es' || s === 'en') return s; } catch {}
  return 'es';
}
export const state = { lang: pickLang(), dept: 'all', group: 'all', q: '' };
export const t = (k) => STRINGS[state.lang][k] ?? STRINGS.es[k] ?? k;
export const L = (v) => (v && typeof v === 'object' ? v[state.lang] ?? v.es : v ?? '');
export const imgOf = (p, i = 0) => `img/p/${p.v[i][1]}.webp`;
export const productById = (id) => PRODUCTS.find((p) => p.id === id);
const deptOf = (id) => DEPARTMENTS.find((d) => d.id === id);
const countryOf = (id) => COUNTRIES.find((c) => c.id === id);

function applyStrings() {
  document.documentElement.lang = state.lang;
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
}

function setLang(lang) {
  state.lang = lang;
  try { localStorage.setItem('abuelito-lang', lang); } catch {}
  applyStrings();
  splitHeroTitle();
  renderAll();
  ScrollTrigger.refresh();
}

// ───────── Plantillas ─────────
const sizeLabel = (p) => (p.v.length > 1 ? `${p.v.length} ${t('cat.sizes')}` : L(p.v[0][0]));

function cardHTML(p, { lazy = true } = {}) {
  const c = p.country ? countryOf(p.country) : null;
  return `<button class="card" data-product="${p.id}">
    <span class="badges">${p.isNew ? `<span class="badge">${t('cat.new')}</span>` : ''}${p.spicy ? `<span class="badge badge--spicy">🌶 ${t('cat.spicy')}</span>` : ''}</span>
    <span class="card__img"><img src="${imgOf(p)}" alt="${esc(L(p.name))}" ${lazy ? 'loading="lazy"' : ''} width="640" height="800" /></span>
    <span class="card__name">${esc(L(p.name))}</span>
    <span class="card__meta">${c ? `<span class="flagtag" title="${esc(L(c.name))}">${c.flag}</span>` : ''}<span>${esc(sizeLabel(p))}</span></span>
  </button>`;
}

// ───────── Papel picado ─────────
function papelPicado() {
  const colors = ['#c8102e', '#f2b33d', '#ffffff', '#0b7a3e', '#d94f8a', '#2b8fd6'];
  const cut = (i) => {
    const holes = [
      '<circle cx="50" cy="38" r="12"/><circle cx="24" cy="66" r="6"/><circle cx="76" cy="66" r="6"/><path d="M50 58 l8 14 -8 14 -8 -14z"/>',
      '<path d="M50 22 l6 12 13 2 -10 9 3 13 -12 -7 -12 7 3 -13 -10 -9 13 -2z"/><circle cx="26" cy="78" r="5"/><circle cx="74" cy="78" r="5"/>',
      '<path d="M50 70 C20 50 26 26 42 30 C47 31 50 36 50 38 C50 36 53 31 58 30 C74 26 80 50 50 70z"/><circle cx="20" cy="30" r="5"/><circle cx="80" cy="30" r="5"/>',
    ][i % 3];
    return `<svg viewBox="0 0 100 110"><defs><mask id="m${i}"><rect width="100" height="110" fill="#fff"/><g fill="#000">${holes}</g><path d="M0 110 L10 96 L20 110 L30 96 L40 110 L50 96 L60 110 L70 96 L80 110 L90 96 L100 110z" fill="#000"/></mask></defs><rect width="100" height="110" fill="${colors[i % colors.length]}" mask="url(#m${i})"/></svg>`;
  };
  const n = Math.min(16, Math.ceil(innerWidth / 90));
  $('#papel').innerHTML = Array.from({ length: n }, (_, i) => `<div class="flag" style="animation-delay:${(-i * 0.37).toFixed(2)}s">${cut(i)}</div>`).join('');
}

// ───────── Hero ─────────
function splitHeroTitle() {
  const el = $('#heroTitle');
  el.innerHTML = t('hero.title').split(' ').map((w) => `<span class="w">${[...w].map((c) => `<span class="ch">${esc(c)}</span>`).join('')}</span>`).join(' ');
}

function heroOrbit() {
  const picks = ['queso-cotija', 'crema-mexicana', 'chorizo', 'pupusas-frijol'].map(productById);
  const spots = [[0, 14], [84, 30], [2, 56], [82, 70]];
  $('#orbit').innerHTML = picks.map((p, i) => `<img src="${imgOf(p)}" alt="" style="left:${spots[i][0]}%;top:${spots[i][1]}%" width="120" height="150" />`).join('');
  if (reduced) return;
  $$('#orbit img').forEach((img, i) => {
    gsap.to(img, { y: i % 2 ? 16 : -16, rotate: i % 2 ? 6 : -6, duration: 2.4 + i * 0.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  });
}

function heroIntro() {
  if (reduced) return;
  const tl = gsap.timeline({ defaults: { ease: 'back.out(1.7)' } });
  tl.from('.flag', { y: -140, rotate: () => gsap.utils.random(-30, 30), stagger: 0.04, duration: 0.8, ease: 'bounce.out' })
    .from('#heroTitle .ch', { y: 80, rotate: () => gsap.utils.random(-25, 25), opacity: 0, stagger: 0.025, duration: 0.6 }, '-=.5')
    .from('.hero__script', { scale: 0, rotate: -20, duration: 0.6 }, '-=.3')
    .from('.hero .kicker, .hero__sub, .hero__ctas > *', { y: 30, opacity: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out' }, '-=.4')
    .from('.hero__abuelo', { y: 300, scale: 0.6, duration: 1, ease: 'elastic.out(1, .6)' }, 0.2)
    .from('#orbit img', { scale: 0, opacity: 0, stagger: 0.08, duration: 0.6 }, '-=.6')
    .from('#heroBubble', { scale: 0, transformOrigin: '0% 100%', duration: 0.5 }, '-=.2')
    .from('.stats li', { y: 40, opacity: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out' }, '-=.4');

  // El abuelito saluda de vez en cuando
  gsap.timeline({ repeat: -1, repeatDelay: 3, delay: 2 })
    .to('#abueloImg', { rotate: -4, duration: 0.25, ease: 'sine.inOut', transformOrigin: '50% 100%' })
    .to('#abueloImg', { rotate: 3, duration: 0.25, yoyo: true, repeat: 3, ease: 'sine.inOut' })
    .to('#abueloImg', { rotate: 0, duration: 0.3 });

  // Parallax con el mouse
  const stage = $('#heroStage');
  const qx = gsap.quickTo('#abueloImg', 'x', { duration: 0.8, ease: 'power3' });
  const ox = gsap.quickTo('#orbit', 'x', { duration: 1.2, ease: 'power3' });
  const oy = gsap.quickTo('#orbit', 'y', { duration: 1.2, ease: 'power3' });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
    const dy = (e.clientY - (r.top + r.height / 2)) / innerHeight;
    qx(dx * 30); ox(dx * -50); oy(dy * -30);
  });

  // Al bajar, el hero se va despidiendo
  gsap.to('.hero__inner', { yPercent: 18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__sun', { scale: 1.4, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // Frases del globito
  const lines = { es: ['¡Hola, mijo! ¿Qué se te antoja hoy?', '¿Ya probaste el queso Cotija?', '¡Tócame y platicamos!', 'Tengo recetas bien sabrosas 😋'], en: ['Hi, mijo! What are you craving today?', 'Have you tried our Cotija cheese?', 'Tap me and let\'s chat!', 'I\'ve got some tasty recipes 😋'] };
  let li = 0;
  setInterval(() => {
    li = (li + 1) % 4;
    gsap.timeline().to('#heroBubble', { scale: 0.6, opacity: 0, duration: 0.2 }).add(() => { $('#heroBubble').textContent = lines[state.lang][li]; }).to('#heroBubble', { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2)' });
  }, 5000);
}

function counters() {
  const years = new Date().getFullYear() - BRAND.founded;
  $$('[data-count]').forEach((el) => {
    const target = el.dataset.count === '28' ? years : +el.dataset.count;
    const suf = el.dataset.suffix || '';
    if (reduced) { el.textContent = target + suf; return; }
    const o = { v: 0 };
    gsap.to(o, { v: target, duration: 2, delay: 1.6, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v) + suf; } });
  });
}

function marquee() {
  const names = ['Queso Fresco', 'Crema Mexicana', 'Cotija', 'Queso Oaxaca', 'Chorizo', 'Carne Cecina', 'Pupusas', 'Mole Poblano', 'Arepas', 'Chicharrón', 'Pastel 3 Leches', 'Salsa Verde', 'Panela', 'Longaniza'];
  const html = names.map((n) => `<span>${n}</span>`).join('');
  const track = $('#marquee1');
  track.innerHTML = html + html;
  if (reduced) return;
  const tw = gsap.to(track, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });
  ScrollTrigger.create({ onUpdate: (s) => { gsap.to(tw, { timeScale: 1 + Math.min(Math.abs(s.getVelocity()) / 300, 6) * (s.direction || 1), duration: 0.2, overwrite: true }); gsap.to(tw, { timeScale: 1, duration: 1.2, delay: 0.2 }); } });
}

// ───────── Departamentos ─────────
function renderDepts() {
  $('#deptGrid').innerHTML = DEPARTMENTS.map((d) => {
    const n = PRODUCTS.filter((p) => p.dept === d.id).length;
    return `<button class="dept reveal" style="--c:${d.color}" data-goto-dept="${d.id}">
      <span class="dept__count">${n} ${t('depts.items')}</span>
      <span class="dept__img"><img src="${d.img}" alt="${esc(L(d.name))}" loading="lazy" width="900" height="600" /></span>
      <span class="dept__body"><span><span class="dept__name">${d.emoji} ${esc(L(d.name))}</span><span class="dept__tag">${esc(L(d.tagline))}</span></span><span class="dept__go" aria-hidden="true">→</span></span>
    </button>`;
  }).join('');
  if (!reduced && matchMedia('(hover: hover)').matches) {
    $$('.dept').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { rotateY: ((e.clientX - r.left) / r.width - 0.5) * 12, rotateX: -((e.clientY - r.top) / r.height - 0.5) * 12, transformPerspective: 800, duration: 0.4 });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.6, ease: 'elastic.out(1,.5)' }));
    });
  }
}

// ───────── Catálogo ─────────
function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function filtered() {
  const q = norm(state.q.trim());
  return PRODUCTS.filter((p) => {
    if (state.dept !== 'all' && p.dept !== state.dept) return false;
    if (state.group !== 'all' && p.group !== state.group) return false;
    if (!q) return true;
    const hay = norm([p.name.es, p.name.en, p.desc.es, p.desc.en, p.tags.join(' '), L(deptOf(p.dept).name), p.country ? L(countryOf(p.country).name) : ''].join(' '));
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}

function renderTabs() {
  const tabs = [{ id: 'all', emoji: '✨', name: { es: t('cat.all'), en: t('cat.all') } }, ...DEPARTMENTS];
  $('#deptTabs').innerHTML = tabs.map((d) => `<button class="tab" role="tab" aria-selected="${state.dept === d.id}" data-tab="${d.id}"><span>${d.emoji}</span>${esc(L(d.name))}</button>`).join('');
}

function renderChips() {
  const box = $('#groupChips');
  if (state.dept === 'all') { box.innerHTML = ''; return; }
  const d = deptOf(state.dept);
  const groups = Object.entries(d.groups);
  if (groups.length < 2) { box.innerHTML = ''; return; }
  box.innerHTML = [['all', { es: t('cat.all'), en: t('cat.all') }], ...groups].map(([id, name]) => `<button class="chip" aria-pressed="${state.group === id}" data-group="${id}">${esc(L(name))}</button>`).join('');
}

function renderGrid(animate = true) {
  const list = filtered();
  const grid = $('#productGrid');
  grid.innerHTML = list.map((p) => cardHTML(p)).join('');
  $('#catEmpty').hidden = list.length > 0;
  $('#catCount').textContent = `${t('cat.showing')} ${list.length} ${t('depts.items')}`;
  if (animate && !reduced) gsap.from(grid.children, { y: 30, opacity: 0, scale: 0.94, stagger: { each: 0.03, from: 'start' }, duration: 0.5, ease: 'back.out(1.5)', clearProps: 'all' });
}

function selectDept(id, { scroll = true } = {}) {
  state.dept = id; state.group = 'all';
  renderTabs(); renderChips(); renderGrid();
  if (scroll) scrollToEl('#catalogo');
}

function initCatalog() {
  $('#deptTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) selectDept(b.dataset.tab, { scroll: false }); });
  $('#groupChips').addEventListener('click', (e) => { const b = e.target.closest('[data-group]'); if (!b) return; state.group = b.dataset.group; renderChips(); renderGrid(); });
  let to;
  $('#catSearch').addEventListener('input', (e) => { clearTimeout(to); to = setTimeout(() => { state.q = e.target.value; if (state.q) { state.dept = 'all'; state.group = 'all'; renderTabs(); renderChips(); } renderGrid(); }, 160); });
}

// ───────── Ficha de producto ─────────
let lastFocus;
function lock(on) {
  document.body.classList.toggle('locked', on);
  if (lenis) on ? lenis.stop() : lenis.start();
}

export function openProduct(id) {
  const p = productById(id);
  if (!p) return;
  const d = deptOf(p.dept);
  const c = p.country ? countryOf(p.country) : null;
  const recs = RECIPES.filter((r) => r.products.includes(p.id));
  const goes = CRAVINGS.filter((cr) => p.tags.includes(cr.tag));
  $('#drawerBody').innerHTML = `
    <div class="dhero" style="--c:${d.color}"><img id="dImg" src="${imgOf(p)}" alt="${esc(L(p.name))}" width="640" height="800" /></div>
    <div class="dbody">
      <span class="dcrumb">${d.emoji} ${esc(L(d.name))} · ${esc(L(d.groups[p.group]))}</span>
      <div class="badges" style="position:static;margin-top:8px">${p.isNew ? `<span class="badge">${t('cat.new')}</span>` : ''}${p.spicy ? `<span class="badge badge--spicy">🌶 ${t('cat.spicy')}</span>` : ''}${c ? `<span class="badge" style="background:var(--cream);color:var(--ink)">${c.flag} ${t('drawer.from')} ${esc(L(c.name))}</span>` : ''}</div>
      <h2 id="drawerTitle">${esc(L(p.name))}</h2>
      <p>${esc(L(p.desc))}</p>
      ${p.v.length > 1 || L(p.v[0][0]) ? `<p class="dlabel">${t('drawer.sizes')}</p><div class="sizes">${p.v.map((v, i) => `<button class="size" data-size="${i}" aria-pressed="${i === 0}">${esc(L(v[0]) || L(p.name))}</button>`).join('')}</div>` : ''}
      ${goes.length ? `<p class="dlabel">${t('drawer.goes')}</p><div class="goes">${goes.map((g) => `<button data-crave-go="${g.tag}">${g.emoji} ${esc(L(g.name))}</button>`).join('')}</div>` : ''}
      ${recs.length ? `<p class="dlabel">${t('drawer.recipes')}</p><div class="dlinks">${recs.map((r) => `<button data-recipe="${r.id}">${r.emoji} ${esc(L(r.name))} <small>· ${r.time} ${t('recipes.min')}</small></button>`).join('')}</div>` : ''}
      <div class="dactions">
        <button class="btn btn--red" data-ask-product="${p.id}">💬 ${t('drawer.ask')}</button>
        <a class="btn btn--yellow" href="#contacto" data-wholesale data-close-drawer>🏪 ${t('drawer.wholesale')}</a>
      </div>
    </div>`;
  const dr = $('#drawer');
  lastFocus = document.activeElement;
  dr.hidden = false; lock(true);
  history.replaceState(null, '', `#producto/${p.id}`);
  const mobile = innerWidth <= 860;
  gsap.fromTo('.drawer__panel', mobile ? { yPercent: 100 } : { xPercent: 100 }, { xPercent: 0, yPercent: 0, duration: 0.55, ease: 'power4.out' });
  gsap.fromTo('.drawer__scrim', { opacity: 0 }, { opacity: 1, duration: 0.3 });
  if (!reduced) gsap.from('#dImg', { scale: 0.6, rotate: -8, opacity: 0, duration: 0.7, delay: 0.15, ease: 'back.out(1.6)' });
  $('.drawer__close').focus();
  $$('#drawerBody .size').forEach((b) => b.addEventListener('click', () => {
    $$('#drawerBody .size').forEach((x) => x.setAttribute('aria-pressed', x === b));
    const img = $('#dImg');
    gsap.timeline().to(img, { scale: 0.85, opacity: 0, duration: 0.15 }).add(() => { img.src = imgOf(p, +b.dataset.size); }).to(img, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
  }));
}

function closeDrawer() {
  const dr = $('#drawer');
  if (dr.hidden) return;
  const mobile = innerWidth <= 860;
  gsap.to('.drawer__panel', { ...(mobile ? { yPercent: 100 } : { xPercent: 100 }), duration: 0.35, ease: 'power3.in' });
  gsap.to('.drawer__scrim', { opacity: 0, duration: 0.3, onComplete: () => { dr.hidden = true; lock(false); lastFocus?.focus?.(); } });
  if (location.hash.startsWith('#producto/')) history.replaceState(null, '', location.pathname + location.search);
}

// ───────── Novedades ─────────
function renderNews() {
  const rail = $('#newsRail');
  rail.innerHTML = PRODUCTS.filter((p) => p.isNew).map((p) => `<button class="ncard" data-product="${p.id}"><span class="badge">${t('cat.new')}</span><img src="${imgOf(p)}" alt="${esc(L(p.name))}" loading="lazy" width="640" height="800" /><b>${esc(L(p.name))}</b><small>${esc(L(deptOf(p.dept).name))}</small></button>`).join('');
}
function dragScroll(el) {
  let down = false, sx = 0, sl = 0, moved = 0;
  el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = el.scrollLeft; el.classList.add('is-drag'); });
  window.addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); el.scrollLeft = sl - dx; });
  window.addEventListener('pointerup', () => { down = false; el.classList.remove('is-drag'); });
  el.addEventListener('click', (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
}

// ───────── Ruta del queso ─────────
let routeCountry = 'mx';
function renderRoute(animate) {
  $('#routeFlags').innerHTML = COUNTRIES.map((c) => `<button class="rflag" role="tab" aria-selected="${c.id === routeCountry}" data-country="${c.id}"><span>${c.flag}</span><em>${esc(L(c.name))}</em></button>`).join('');
  const c = countryOf(routeCountry);
  const items = PRODUCTS.filter((p) => p.country === c.id && (p.dept === 'quesos' || p.dept === 'cremas' || p.tags.includes('pupusas') || p.tags.includes('arepas'))).slice(0, 12);
  $('#routePanel').innerHTML = `
    <div class="route__info"><span class="route__big">${c.flag}</span><h3>${esc(L(c.name))}</h3><p class="dish">${t('route.dish')}: ${esc(L(c.dish))}</p><div class="route__fact"><b>${t('route.fact')}</b>${esc(L(c.fact))}</div></div>
    <div class="route__items">${items.map((p) => cardHTML(p)).join('')}</div>`;
  if (animate && !reduced) {
    gsap.from('.route__info', { x: -40, opacity: 0, duration: 0.5, ease: 'power3.out' });
    gsap.from('.route__big', { scale: 0, rotate: -40, duration: 0.7, ease: 'back.out(2.5)' });
    gsap.from('.route__items > *', { y: 30, opacity: 0, rotate: () => gsap.utils.random(-6, 6), stagger: 0.05, duration: 0.5, ease: 'back.out(1.6)', clearProps: 'all' });
  }
}

// ───────── Antojos ─────────
let craveTag = null;
function renderCraves(animate) {
  $('#craveChips').innerHTML = CRAVINGS.map((c) => `<button class="cchip" aria-pressed="${c.tag === craveTag}" data-crave="${c.tag}"><span>${c.emoji}</span>${esc(L(c.name))}</button>`).join('');
  const box = $('#craveResult');
  if (!craveTag) { box.innerHTML = ''; return; }
  const items = PRODUCTS.filter((p) => p.tags.includes(craveTag)).slice(0, 10);
  const recipe = RECIPES.find((r) => r.products.some((id) => productById(id).tags.includes(craveTag)));
  box.innerHTML = `<h3>${t('crave.result')}</h3><div class="crave__row">${items.map((p) => cardHTML(p)).join('')}</div>
    ${recipe ? `<div class="crave__recipe"><button class="btn btn--green" data-recipe="${recipe.id}">${recipe.emoji} ${t('crave.recipe')} ${esc(L(recipe.name))}</button></div>` : ''}`;
  if (animate && !reduced) gsap.from('#craveResult .card, #craveResult h3, .crave__recipe', { y: 40, opacity: 0, scale: 0.8, stagger: 0.04, duration: 0.5, ease: 'back.out(1.8)', clearProps: 'all' });
}

// ───────── Recetas ─────────
const recipeColors = ['#f2b33d', '#8fd19e', '#ffb3a7', '#ffd66b', '#b9e3f5', '#f6c4dd', '#c9e7a6', '#ffcf99'];
function renderRecipes() {
  $('#recipeGrid').innerHTML = RECIPES.map((r, i) => `<button class="rcard reveal" data-recipe="${r.id}">
    <span class="rcard__top" style="--c:${recipeColors[i % recipeColors.length]}"><span class="rcard__emoji">${r.emoji}</span><span class="rcard__thumbs">${r.products.slice(0, 3).map((id) => `<img src="${imgOf(productById(id))}" alt="" loading="lazy" width="46" height="56" />`).join('')}</span></span>
    <span class="rcard__body"><h3>${esc(L(r.name))}</h3><span class="rmeta"><span>⏱ ${r.time} ${t('recipes.min')}</span><span>👨‍👩‍👧 ${r.serves} ${t('recipes.serves')}</span><span>${r.level === 1 ? '⭐ ' + t('recipes.easy') : '⭐⭐ ' + t('recipes.medium')}</span></span></span>
  </button>`).join('');
}

export function openRecipe(id) {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return;
  closeDrawer();
  const i = RECIPES.indexOf(r);
  const share = `https://wa.me/?text=${encodeURIComponent(`${L(r.name)} — ${L(r.intro)} ${location.origin}${location.pathname}#receta/${r.id}`)}`;
  $('#recipeBody').innerHTML = `
    <div class="rhead" style="--c:${recipeColors[i % recipeColors.length]}"><span class="remo">${r.emoji}</span><h2 id="recipeTitle">${esc(L(r.name))}</h2><p>${esc(L(r.intro))}</p><span class="rmeta"><span>⏱ ${r.time} ${t('recipes.min')}</span><span>👨‍👩‍👧 ${r.serves} ${t('recipes.serves')}</span><span>${r.level === 1 ? '⭐ ' + t('recipes.easy') : '⭐⭐ ' + t('recipes.medium')}</span></span></div>
    <div class="rcols">
      <div><h3>${t('recipes.ingredients')}</h3><small>${t('recipes.tick')}</small><ul class="ingr">${L(r.ingredients).map((x) => `<li><label><input type="checkbox" /><span>${esc(x)}</span></label></li>`).join('')}</ul></div>
      <div><h3>${t('recipes.steps')}</h3><ol class="steps">${L(r.steps).map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <p style="margin-top:20px"><a class="btn btn--green btn--small" href="${share}" target="_blank" rel="noopener">📲 ${t('recipes.share')}</a></p></div>
    </div>
    <div class="rprods"><p class="dlabel">${t('recipes.products')}</p><div class="crave__row">${r.products.map((pid) => cardHTML(productById(pid))).join('')}</div></div>`;
  const m = $('#recipeModal');
  lastFocus = document.activeElement;
  m.hidden = false; lock(true);
  m.querySelector('.modal__panel').scrollTop = 0;
  gsap.fromTo('.modal__panel', { scale: 0.85, opacity: 0, y: 40 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.5)' });
  gsap.fromTo('.modal__scrim', { opacity: 0 }, { opacity: 1, duration: 0.3 });
  if (!reduced) gsap.from('.steps li', { x: 30, opacity: 0, stagger: 0.07, delay: 0.2, duration: 0.4 });
  m.querySelector('.drawer__close').focus();
}
function closeRecipe() {
  const m = $('#recipeModal');
  if (m.hidden) return;
  gsap.to('.modal__panel', { scale: 0.9, opacity: 0, duration: 0.25 });
  gsap.to('.modal__scrim', { opacity: 0, duration: 0.25, onComplete: () => { m.hidden = true; lock(false); lastFocus?.focus?.(); } });
}

// ───────── Historia ─────────
let storyTriggers = [];
function renderStory() {
  storyTriggers.forEach((x) => x.kill());
  storyTriggers = [];
  const p = $('.story__text');
  p.innerHTML = t('story.letter').split(' ').map((w) => `<span class="wd">${esc(w)}</span>`).join(' ');
  if (reduced) { $$('.wd', p).forEach((w) => w.classList.add('on')); }
  else {
    const words = $$('.wd', p);
    storyTriggers.push(ScrollTrigger.create({
      trigger: p, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: (s) => { const n = Math.round(s.progress * words.length); words.forEach((w, i) => w.classList.toggle('on', i < n)); },
    }));
  }
  $('#timeline').innerHTML = '<span class="timeline__fill"></span>' + TIMELINE.map((x) => `<li class="reveal"><span class="yr">${esc(L(x.year))}</span><h3>${esc(L(x.title))}</h3><p>${esc(L(x.text))}</p></li>`).join('');
  if (!reduced) storyTriggers.push(gsap.to('.timeline__fill', { height: 'calc(100% - 12px)', ease: 'none', scrollTrigger: { trigger: '#timeline', start: 'top 70%', end: 'bottom 60%', scrub: true } }).scrollTrigger);
}

// ───────── Instagram, contacto, FAQ ─────────
const ICONS = {
  ig: '<svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1.1.4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1.1.4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1.1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1.1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 4.8a5 5 0 100 10 5 5 0 000-10zm0 8.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zm5.2-9.6a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z"/></svg>',
  fb: '<svg viewBox="0 0 24 24"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.5V14h2.7v8h3.3z"/></svg>',
};
function renderContact() {
  $('#igLink').href = BRAND.instagram;
  $('#igGrid').innerHTML = [1, 2, 3, 4, 5, 6].map((n) => `<a href="${BRAND.instagram}" target="_blank" rel="noopener" aria-label="Instagram ${BRAND.instagramHandle}"><img src="img/ui/ig-${n}.webp" alt="" loading="lazy" width="600" height="750" /></a>`).join('');
  $('#contactList').innerHTML = `
    <li><a href="${BRAND.mapsUrl}" target="_blank" rel="noopener"><span class="ico">📍</span><span><small>${t('contact.address')}</small><b>${BRAND.address}</b></span></a></li>
    <li><a href="${BRAND.phoneHref}"><span class="ico">📞</span><span><small>${t('contact.phone')}</small><b>${BRAND.phone}</b></span></a></li>
    <li><a href="${BRAND.tollFreeHref}"><span class="ico">☎️</span><span><small>${t('contact.toll')}</small><b>${BRAND.tollFree}</b></span></a></li>
    <li><a href="mailto:${BRAND.email}"><span class="ico">✉️</span><span><small>${t('contact.email')}</small><b>${BRAND.email}</b></span></a></li>
    <li><a href="${BRAND.instagram}" target="_blank" rel="noopener"><span class="ico">📸</span><span><small>Instagram</small><b>${BRAND.instagramHandle}</b></span></a></li>
    <li><a href="${BRAND.facebook}" target="_blank" rel="noopener"><span class="ico">👍</span><span><small>Facebook</small><b>El Abuelito Inc</b></span></a></li>`;
  $('#faqList').innerHTML = FAQ.map((f) => `<details><summary>${esc(L(f.q))}</summary><p>${esc(L(f.a))}</p></details>`).join('');
  $('#footerSocial').innerHTML = `<a href="${BRAND.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${ICONS.ig}</a><a href="${BRAND.facebook}" target="_blank" rel="noopener" aria-label="Facebook">${ICONS.fb}</a>`;
  $('#mbarCall').href = BRAND.phoneHref;
  $('#year').textContent = new Date().getFullYear();
}

function initForm() {
  const f = $('#contactForm');
  const syncBiz = () => { $('#formBiz').hidden = f.type.value === 't1'; };
  f.type.addEventListener('change', syncBiz);
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    for (const el of [f.name, f.email, f.msg]) {
      const bad = !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value));
      el.classList.toggle('is-bad', bad);
      if (bad) ok = false;
    }
    if (!ok) { gsap.fromTo(f, { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, .3)' }); return; }
    const type = t('form.' + f.type.value);
    const subject = `[Web] ${type} — ${f.name.value}`;
    const body = [`${t('form.name')}: ${f.name.value}`, `${t('form.email')}: ${f.email.value}`, `${t('form.phone')}: ${f.phone.value}`, `${t('form.type')}: ${type}`, f.business.value ? `${t('form.business')}: ${f.business.value}` : '', '', f.msg.value].filter((x) => x !== '').join('\n');
    location.href = `mailto:${BRAND.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    $('#formOk').hidden = false;
  });
  syncBiz();
}

function presetWholesale() {
  const f = $('#contactForm');
  f.type.value = 't2';
  f.type.dispatchEvent(new Event('change'));
}

// ───────── Video ─────────
function initVideo() {
  const v = $('#promoVideo');
  if (!reduced) {
    ScrollTrigger.create({ trigger: '#video', start: 'top 80%', end: 'bottom 20%', onToggle: (s) => { if (s.isActive) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); } else v.pause(); } });
    gsap.fromTo(v, { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '#video', start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  $('#videoPlay').addEventListener('click', () => {
    v.muted = !v.muted;
    if (!v.muted) { v.currentTime = 0; v.play(); }
    $('#videoPlay span').textContent = v.muted ? '▶' : '🔊';
  });
}

// ───────── Navegación ─────────
let lenis;
function scrollToEl(sel) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.2 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}

function initNav() {
  const nav = $('#nav');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    nav.classList.toggle('is-solid', y > 40);
    nav.classList.toggle('is-hidden', y > lastY && y > 600 && $('#mmenu').hidden);
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const burger = $('#burger');
  const menu = $('#mmenu');
  burger.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open; burger.setAttribute('aria-expanded', open); lock(open);
    if (open && !reduced) gsap.from('#mmenu a', { y: 40, opacity: 0, stagger: 0.05, duration: 0.4, ease: 'back.out(2)' });
  });
  $$('.nav__links a').forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (sec) ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
  });
  $('#langBtn').addEventListener('click', () => setLang(state.lang === 'es' ? 'en' : 'es'));
}

// Un solo manejador de clics para todo lo que se genera dinámicamente
function initDelegation() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    const prod = e.target.closest('[data-product]');
    const rec = e.target.closest('[data-recipe]');
    const dept = e.target.closest('[data-goto-dept]');
    const ask = e.target.closest('[data-ask-product]');
    const chat = e.target.closest('[data-open-chat]');
    const crave = e.target.closest('[data-crave]');
    const craveGo = e.target.closest('[data-crave-go]');
    const country = e.target.closest('[data-country]');

    if (e.target.closest('[data-close]')) { closeDrawer(); closeRecipe(); return; }
    if (prod) { e.preventDefault(); closeRecipe(); openProduct(prod.dataset.product); return; }
    if (rec) { e.preventDefault(); openRecipe(rec.dataset.recipe); return; }
    if (dept) { selectDept(dept.dataset.gotoDept); return; }
    if (ask) { const p = productById(ask.dataset.askProduct); closeDrawer(); openChat(state.lang === 'es' ? `Cuéntame del ${L(p.name)}: ¿cómo lo uso y con qué lo acompaño?` : `Tell me about ${L(p.name)}: how do I use it and what goes with it?`); return; }
    if (chat) { e.preventDefault(); openChat(); return; }
    if (crave) { craveTag = craveTag === crave.dataset.crave ? null : crave.dataset.crave; renderCraves(true); return; }
    if (craveGo) { closeDrawer(); craveTag = craveGo.dataset.craveGo; renderCraves(true); scrollToEl('#antojos'); return; }
    if (country) { routeCountry = country.dataset.country; renderRoute(true); return; }
    if (a) {
      const href = a.getAttribute('href');
      if (a.hasAttribute('data-wholesale')) presetWholesale();
      if (a.hasAttribute('data-close-drawer')) closeDrawer();
      if (!$('#mmenu').hidden) { $('#mmenu').hidden = true; $('#burger').setAttribute('aria-expanded', 'false'); lock(false); }
      if (href.length > 1 && $(href)) { e.preventDefault(); scrollToEl(href); }
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawer(); closeRecipe(); } });
}

function handleHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith('producto/')) openProduct(h.split('/')[1]);
  else if (h.startsWith('receta/')) openRecipe(h.split('/')[1]);
  else if (h.startsWith('productos/')) { const d = h.split('/')[1]; if (deptOf(d)) selectDept(d); }
}

// ───────── Animaciones al hacer scroll ─────────
function reveals() {
  if (reduced) return;
  ScrollTrigger.batch('.reveal:not(.is-in)', {
    start: 'top 88%',
    onEnter: (els) => { els.forEach((el) => el.classList.add('is-in')); gsap.to(els, { opacity: 1, y: 0, stagger: 0.08, duration: 0.8, ease: 'power3.out' }); },
  });
  $$('.section__head').forEach((h) => gsap.from(h.children, { y: 40, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: h, start: 'top 85%' } }));
  gsap.from('.pillars li', { y: 50, opacity: 0, rotate: () => gsap.utils.random(-5, 5), stagger: 0.1, duration: 0.7, ease: 'back.out(1.6)', clearProps: 'transform', scrollTrigger: { trigger: '.pillars', start: 'top 80%' } });
  gsap.from('.wholesale__img img', { scale: 1.25, ease: 'none', clearProps: 'transform', scrollTrigger: { trigger: '.wholesale', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.ig__grid a', { y: 60, opacity: 0, rotate: () => gsap.utils.random(-8, 8), stagger: 0.06, duration: 0.7, ease: 'back.out(1.7)', clearProps: 'transform', scrollTrigger: { trigger: '.ig__grid', start: 'top 85%' } });
  gsap.from('.rflag', { y: 40, opacity: 0, scale: 0.6, stagger: 0.05, duration: 0.6, ease: 'back.out(2)', clearProps: 'transform', scrollTrigger: { trigger: '#routeFlags', start: 'top 85%' } });
  gsap.from('.cchip', { y: 30, opacity: 0, scale: 0.6, stagger: 0.04, duration: 0.5, ease: 'back.out(2)', clearProps: 'transform', scrollTrigger: { trigger: '#craveChips', start: 'top 85%' } });
  gsap.from('.crave__abuelo', { x: 200, rotate: 40, duration: 1, ease: 'elastic.out(1,.6)', clearProps: 'transform', scrollTrigger: { trigger: '.crave', start: 'top 70%' } });
  gsap.from('.ncard', { x: 200, opacity: 0, stagger: 0.07, duration: 0.8, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: '#newsRail', start: 'top 85%' } });
  gsap.from('.story__letter', { rotate: -8, y: 80, opacity: 0, duration: 1, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: '.story', start: 'top 75%' } });
}

function renderAll() {
  renderDepts();
  renderTabs(); renderChips(); renderGrid(false);
  renderNews();
  renderRoute(false);
  renderCraves(false);
  renderRecipes();
  renderStory();
  renderContact();
  if (!reduced) $$('.reveal').forEach((el) => { el.classList.add('is-in'); gsap.set(el, { opacity: 1, y: 0 }); });
}

// ───────── Arranque ─────────
function boot() {
  applyStrings();
  papelPicado();
  splitHeroTitle();
  heroOrbit();
  marquee();
  renderDepts();
  renderTabs(); renderChips(); renderGrid(false);
  renderNews(); dragScroll($('#newsRail'));
  renderRoute(false);
  renderCraves(false);
  renderRecipes();
  renderStory();
  renderContact();
  initCatalog();
  initForm();
  initVideo();
  initDelegation();
  initChat({ t, L, state, openProduct, openRecipe, scrollToEl });

  if (!reduced) {
    lenis = new Lenis({ lerp: 0.11 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  initNav();

  // Pantalla de carga con frases chistosas
  const msgs = ['loader.1', 'loader.2', 'loader.3', 'loader.4'];
  let mi = 0;
  $('#loaderMsg').textContent = t(msgs[0]);
  const iv = setInterval(() => { mi = (mi + 1) % msgs.length; $('#loaderMsg').textContent = t(msgs[mi]); }, 450);
  const done = () => {
    clearInterval(iv);
    const ld = $('#loader');
    gsap.to(ld, { yPercent: -100, duration: reduced ? 0 : 0.8, ease: 'power4.inOut', onComplete: () => ld.remove() });
    heroIntro();
    counters();
    reveals();
    handleHash();
    ScrollTrigger.refresh();
  };
  const minTime = new Promise((r) => setTimeout(r, reduced ? 0 : 1500));
  const loaded = new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })));
  Promise.race([Promise.all([minTime, loaded]), new Promise((r) => setTimeout(r, 4000))]).then(done);

  let rw = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - rw) > 80) { rw = innerWidth; papelPicado(); } });
  addEventListener('hashchange', handleHash);
}

boot();
