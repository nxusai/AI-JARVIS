// Mi Semago · sitio web. Arma la página, las animaciones (GSAP + Lenis) y conecta el Estudio y la IA.
import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { BRAND, PRODUCTS, CATEGORIES, PROCESS, PLANT_CHAPTERS, PLANT_FRAMES, FAQ, transitDays } from './data.js';
import { STRINGS } from './i18n.js';
import { STATES, ORIGIN } from './states.js';
import { initStudio, refreshStudio, setProduct } from './studio.js';
import { initChat, openChat, refreshChat } from './semago-ai.js';
import { milk } from './milk.js';

gsap.registerPlugin(ScrollTrigger);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) document.documentElement.classList.add('reduce');

// ───────── Idioma ─────────
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } } };
let LANG = store.get('ms-lang') || ((navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es');
const t = (k) => STRINGS[LANG][k] ?? STRINGS.es[k] ?? k;
const lang = () => LANG;

function applyLang() {
  document.documentElement.lang = LANG;
  document.title = t('meta.title');
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $$('#langBtn span').forEach((s) => s.classList.toggle('on', s.textContent.toLowerCase() === LANG));
  splitAll();
  litManifesto();
  const ems = $$('#heroRot em'); if (ems.length === 1) ems[0].textContent = t('hero.words').split('|')[0];
  if (!studioBrand || studioBrand.brand === STRINGS[LANG === 'es' ? 'en' : 'es']['st.defaultBrand']) $('#heroTicketName').textContent = t('st.defaultBrand');
}

// ───────── Contexto compartido con el Estudio y la IA ─────────
let lenis;
const ctx = {
  t, lang, reduced,
  openProduct: (id) => openDrawer(id),
  toStudio: (id) => { setProduct(id); scrollToEl('#estudio'); },
  openChat: (q) => openChat(q),
  sendStudio: (s) => sendStudio(s),
  onStudioChange: (s) => { studioBrand = s; },
};
let studioBrand = null;
let studioProposal = null;

function scrollToEl(sel) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.4 });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}

// ───────── Texto en palabras (para animarlas) ─────────
function splitAll() {
  $$('.split').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="sw"><span>${esc(w)}</span></span>`).join(' ');
    if (el.dataset.shown || reduced) gsap.set($$('.sw > span', el), { yPercent: 0 });
    else gsap.set($$('.sw > span', el), { yPercent: 110 });
  });
}
function litManifesto() {
  const m = $('#manifesto');
  m.innerHTML = m.textContent.trim().split(/\s+/).map((w) => `<span class="mw">${esc(w)}</span>`).join(' ');
  manifestoProgress(m.dataset.p ? +m.dataset.p : reduced ? 1 : 0);
}
function manifestoProgress(p) {
  const m = $('#manifesto'); m.dataset.p = p;
  const ws = $$('.mw', m); const n = Math.round(p * ws.length);
  ws.forEach((w, i) => w.classList.toggle('lit', i < n));
}

// ───────── Pantalla de carga ─────────
function preload(srcs, onProgress) {
  let done = 0;
  return Promise.all(srcs.map((src) => new Promise((res) => {
    const img = new Image(); img.onload = img.onerror = () => { done++; onProgress(done / srcs.length); res(); }; img.src = src;
  })));
}
async function boot() {
  const heroItems = PRODUCTS.filter((p) => p.hero || ['panela', 'queso-chile-rojo', 'fresco-6'].includes(p.id)).slice(0, 6);
  const srcs = ['./img/ui/knot.png', './img/ui/logo-white.png', ...heroItems.map((p) => `./img/p/${p.img}.webp`), frameSrc(0)];
  let shown = 0; const pct = $('#loaderPct');
  const msgs = ['load.1', 'load.2', 'load.3']; let mi = 0;
  const msgTimer = setInterval(() => { mi = (mi + 1) % msgs.length; $('#loaderMsg').textContent = t(msgs[mi]); }, 900);
  const counter = { v: 0 };
  const start = performance.now();
  await preload(srcs, (p) => { gsap.to(counter, { v: p * 100, duration: 0.4, onUpdate: () => { shown = Math.round(counter.v); pct.textContent = shown; } }); });
  const wait = Math.max(0, (reduced ? 200 : 1500) - (performance.now() - start));
  await new Promise((r) => setTimeout(r, wait));
  gsap.to(counter, { v: 100, duration: 0.3, onUpdate: () => { pct.textContent = Math.round(counter.v); } });
  clearInterval(msgTimer);
  buildOrbit(heroItems);
  await new Promise((r) => setTimeout(r, 300));
  document.body.classList.remove('is-loading');
  const loader = $('#loader');
  if (reduced) { loader.remove(); heroIntro(); return; }
  gsap.to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut', onComplete: () => loader.remove() });
  setTimeout(heroIntro, 450);
}

// ───────── Hero ─────────
function heroIntro() {
  if (reduced) { countUp(); return; }
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from('.hero__title .line > *', { yPercent: 120, duration: 1.3, stagger: 0.1 })
    .from('.hero .kicker, .hero__sub, .hero__ctas', { y: 30, opacity: 0, duration: 1, stagger: 0.1 }, '-=1')
    .from('.orbit__item', { scale: 0, opacity: 0, duration: 1.4, stagger: 0.08, ease: 'elastic.out(1, 0.6)' }, '-=1.2')
    .from('.hero__knot', { scale: 0, rotate: -180, duration: 1.4 }, '<')
    .from('.hero__ticket', { y: 60, rotate: 20, opacity: 0, duration: 1 }, '-=0.9')
    .from('.stat', { y: 30, opacity: 0, duration: 0.8, stagger: 0.07 }, '-=1')
    .add(countUp, '-=0.8');
  rotateWords();
  ticketCycle();
}
function countUp() {
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count; const o = { v: reduced ? end : 0 };
    const f = () => { el.textContent = Math.round(o.v).toLocaleString('en-US'); };
    if (reduced) return f();
    gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: f });
  });
}
function rotateWords() {
  const box = $('#heroRot');
  let i = 0;
  setInterval(() => {
    const words = t('hero.words').split('|'); i = (i + 1) % words.length;
    const old = box.querySelector('em'); const em = document.createElement('em'); em.textContent = words[i]; box.append(em);
    gsap.fromTo(em, { yPercent: 100, rotateX: -80, opacity: 0 }, { yPercent: 0, rotateX: 0, opacity: 1, duration: 0.9, ease: 'expo.out' });
    gsap.to(old, { yPercent: -100, rotateX: 80, opacity: 0, duration: 0.7, ease: 'expo.in', onComplete: () => old.remove() });
  }, 2800);
}
const SAMPLE_BRANDS = ['La Abuela Rosa', 'Don Chuy', 'Sabor Catracho', 'Rancho Los Altos', 'Doña Lupita', 'Mi Tierra'];
function ticketCycle() {
  let i = 0;
  const cheeses = PRODUCTS.filter((p) => p.hero);
  setInterval(() => {
    i++;
    const userBrand = studioBrand && studioBrand.brand !== t('st.defaultBrand') ? studioBrand : null;
    const name = userBrand ? userBrand.brand : SAMPLE_BRANDS[i % SAMPLE_BRANDS.length];
    const cheese = userBrand ? userBrand.cheese : cheeses[i % cheeses.length].name[LANG];
    gsap.to('#heroTicket', { rotateY: 90, duration: 0.35, ease: 'power2.in', onComplete: () => {
      $('#heroTicketName').textContent = name; $('#heroTicketCheese').textContent = cheese;
      gsap.to('#heroTicket', { rotateY: 0, duration: 0.5, ease: 'back.out(2)' });
    } });
  }, 3200);
}

let orbitItems = [];
function buildOrbit(items) {
  const o = $('#orbit');
  o.innerHTML = items.map((p) => `<div class="orbit__item"><img src="./img/p/${p.img}.webp" alt="" /></div>`).join('');
  orbitItems = $$('.orbit__item', o);
  const mouse = { x: 0, y: 0 }; const cur = { x: 0, y: 0 };
  addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; });
  let visible = true;
  ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom top', onToggle: (s) => { visible = s.isActive; } });
  const N = orbitItems.length;
  gsap.ticker.add((time) => {
    if (!visible) return;
    cur.x += (mouse.x - cur.x) * 0.05; cur.y += (mouse.y - cur.y) * 0.05;
    const R = o.clientWidth * 0.36;
    orbitItems.forEach((el, k) => {
      const a = (reduced ? 0 : time * 0.22) + (k / N) * Math.PI * 2 + cur.x * 1.2;
      const x = Math.cos(a) * R; const z = Math.sin(a) * R;
      const y = Math.sin(a * 2 + k) * R * 0.08 + Math.sin(a) * R * (0.28 + cur.y * 0.4);
      const s = 0.62 + ((z / R) + 1) * 0.28;
      el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) scale(${s}) rotate(${Math.cos(a) * 8}deg)`;
      el.style.zIndex = Math.round(z + R);
      el.style.opacity = 0.45 + ((z / R) + 1) * 0.275;
    });
  });
}

// Hilos de quesillo (pasta filata) que se mecen en el fondo del hero y siguen al cursor.
function strands() {
  const cv = $('#strands'); const g = cv.getContext('2d');
  let w, h, dpr; const mouse = { x: 0.6, y: 0.4 }; const cur = { x: 0.6, y: 0.4 };
  const resize = () => { dpr = Math.min(devicePixelRatio || 1, 2); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
  resize(); addEventListener('resize', resize);
  addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth; mouse.y = e.clientY / innerHeight; });
  const lines = Array.from({ length: 18 }, (_, i) => ({ o: i / 18, sp: 0.15 + Math.random() * 0.25, amp: 30 + Math.random() * 70, gold: i % 5 === 0, wdt: 0.6 + Math.random() * 1.6 }));
  let visible = true;
  ScrollTrigger.create({ trigger: '.hero', start: 'top bottom', end: 'bottom top', onToggle: (s) => { visible = s.isActive; } });
  const draw = (time) => {
    if (!visible) return;
    cur.x += (mouse.x - cur.x) * 0.04; cur.y += (mouse.y - cur.y) * 0.04;
    g.clearRect(0, 0, w, h);
    for (const l of lines) {
      const t0 = time * l.sp;
      const y0 = h * (0.15 + l.o * 0.8);
      g.beginPath();
      g.moveTo(-50, y0 + Math.sin(t0) * l.amp);
      const cx1 = w * 0.3, cy1 = y0 + Math.sin(t0 + 1.3) * l.amp * 1.4 + (cur.y - 0.5) * 160;
      const cx2 = w * cur.x, cy2 = h * cur.y + Math.cos(t0 + l.o * 6) * l.amp * 1.8;
      g.bezierCurveTo(cx1, cy1, cx2, cy2, w + 50, y0 * 0.6 + Math.cos(t0 * 0.8) * l.amp);
      g.strokeStyle = l.gold ? 'rgba(230, 200, 115, 0.42)' : 'rgba(251, 247, 238, 0.11)';
      g.lineWidth = l.wdt * (l.gold ? 1.3 : 1);
      g.stroke();
    }
  };
  if (reduced) draw(0); else gsap.ticker.add(draw);
  // Fondo de leche y oro en WebGL debajo de los hilos.
  const frame = milk($('#milk'), { reduced });
  if (frame) { if (reduced) frame(0); else gsap.ticker.add((time) => { if (visible) frame(time); }); }
}

// ───────── Hecho a mano: el video del hilado dentro de letras gigantes que se abren con el scroll ─────────
function handmade() {
  const video = $('#hmVideo');
  ScrollTrigger.create({ trigger: '#handmade', start: 'top 150%', once: true, onEnter: () => { video.preload = 'auto'; video.load(); } });
  ScrollTrigger.create({ trigger: '#handmade', start: 'top bottom', end: 'bottom top', onToggle: (st) => { if (st.isActive && !reduced) video.play().catch(() => {}); else video.pause(); } });
  if (reduced) { gsap.set('#hmMask', { opacity: 0 }); gsap.set('#hmCap', { opacity: 1 }); return; }
  gsap.timeline({ scrollTrigger: { trigger: '#handmade', start: 'top top', end: 'bottom bottom', scrub: 0.6 } })
    .fromTo('#hmMask', { scale: 1 }, { scale: 16, ease: 'power2.in', duration: 1 })
    .to('#hmMask', { opacity: 0, duration: 0.25, ease: 'none' }, 0.62)
    .fromTo('#hmVideo', { scale: 1.25 }, { scale: 1, ease: 'none', duration: 1 }, 0)
    .fromTo('#hmCap', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.25, ease: 'none' }, 0.78);
}

// Secciones oscuras que se abren de una tarjeta redondeada a pantalla completa al entrar.
function openSections() {
  if (reduced) return;
  $$('.studio, .ship, .contact').forEach((sec) => gsap.fromTo(sec,
    { '--inset': () => `${Math.round(innerWidth * 0.035)}px`, '--round': '48px' },
    { '--inset': '0px', '--round': '0px', ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top 15%', scrub: true, invalidateOnRefresh: true } }));
}

// Tarjetas del catálogo: se inclinan y una luz dorada sigue al cursor.
function cardLights() {
  if (reduced || !matchMedia('(hover: hover)').matches) return;
  const grid = $('#catGrid');
  grid.addEventListener('pointermove', (e) => {
    const c = e.target.closest('.card'); if (!c) return;
    const r = c.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
    c.style.setProperty('--mx', `${x * 100}%`); c.style.setProperty('--my', `${y * 100}%`);
    c.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 10}deg) rotateX(${(0.5 - y) * 10}deg) translateY(-6px)`;
  });
  grid.addEventListener('pointerout', (e) => { const c = e.target.closest('.card'); if (c && !c.contains(e.relatedTarget)) c.style.transform = ''; });
}

// ───────── Marquesina ─────────
function marquee() {
  const names = ['Queso Oaxaca', 'Queso Fresco', 'Hoja de Plátano', 'Canastón', 'Panela', 'Chihuahua', 'Blanco para Freír', 'Chile Rojo', 'Private Label'];
  const tr = $('#marquee');
  tr.innerHTML = [...names, ...names].map((n) => `<span>${n}</span>`).join('');
  if (reduced) return;
  let x = 0; let speed = 1;
  gsap.ticker.add(() => {
    x -= speed; const half = tr.scrollWidth / 2; if (-x >= half) x += half; tr.style.transform = `translate3d(${x}px,0,0)`;
    speed += (1 - speed) * 0.05;
  });
  lenis?.on('scroll', (e) => { speed = 1 + Math.min(12, Math.abs(e.velocity) * 0.6); });
}

// ───────── Línea de tiempo del proceso ─────────
function timeline() {
  $('#timelineBars').innerHTML = PROCESS.map((s) => `<div class="tstep"><div class="tstep__bar"><i></i></div><b data-n="${s.id}">${esc(s.name[LANG])}</b><small>${esc(s.dur[LANG])}</small><p>${esc(s.text[LANG])}</p></div>`).join('');
}

// ───────── Catálogo y ficha técnica ─────────
let catFilter = 'all';
function catalog() {
  const tabs = [{ id: 'all', name: { es: t('cat.all'), en: t('cat.all') } }, ...CATEGORIES];
  $('#catTabs').innerHTML = tabs.map((c) => `<button type="button" role="tab" data-cat="${c.id}" class="${c.id === catFilter ? 'on' : ''}" aria-selected="${c.id === catFilter}">${esc(c.name[LANG])}<sup>${c.id === 'all' ? PRODUCTS.length : PRODUCTS.filter((p) => p.cat === c.id).length}</sup></button>`).join('');
  renderGrid(false);
}
function renderGrid(animate) {
  const list = PRODUCTS.filter((p) => catFilter === 'all' || p.cat === catFilter);
  $('#catGrid').innerHTML = list.map((p) => `<button type="button" class="card" data-pid="${p.id}">
    <span class="card__go">↗</span>
    <div class="card__img"><img src="./img/p/${p.img}.webp" alt="${esc(p.name[LANG])}" loading="lazy" /></div>
    <span class="card__cat">${esc(CATEGORIES.find((c) => c.id === p.cat).name[LANG])}</span>
    <h3>${esc(p.name[LANG])}</h3>
    <div class="card__meta">${p.sizes.map((s) => `<span>${s.l}</span>`).join('')}${p.shelf ? `<span class="life">${p.shelf} ${t('cat.days')}</span>` : ''}</div>
  </button>`).join('');
  if (animate && !reduced) gsap.from('#catGrid .card', { y: 40, opacity: 0, duration: 0.7, stagger: 0.04, ease: 'expo.out' });
  else if (!reduced && !catalogShown) gsap.set('#catGrid .card', { y: 60, opacity: 0 });
}
let catalogShown = false;
let timelineShown = false;

function openDrawer(id) {
  const p = PRODUCTS.find((x) => x.id === id); if (!p) return;
  const L = LANG; const ask = t('cat.ask');
  const packs = p.packs.map((k) => `${k.n}${k.size ? ` (${k.size})` : ''}`).join(' · ');
  const pallets = p.packs.some((k) => k.pallet) ? p.packs.map((k) => `${k.pallet ?? '—'}${k.size ? ` (${k.size})` : ` (${k.n}/${L === 'en' ? 'case' : 'caja'})`}`).join(' · ') : ask;
  $('#drawerPanel').innerHTML = `
    <button type="button" class="drawer__close" data-close aria-label="${t('cat.close')}">×</button>
    <p class="kicker">${t('cat.spec')} · ${esc(CATEGORIES.find((c) => c.id === p.cat).name[L])}</p>
    <div class="drawer__img"><img src="./img/p/${p.img}.webp" alt="${esc(p.name[L])}" /></div>
    <h2 id="drawerTitle">${esc(p.name[L])}</h2>
    <p class="desc">${esc(p.desc[L])}</p>
    <table class="spec"><tbody>
      <tr><th>${t('cat.pres')}</th><td>${p.sizes.map((s) => s.l).join(' · ')}</td></tr>
      <tr><th>${t('cat.pkg')}</th><td>${p.packaging ? esc(p.packaging[L]) : ask}</td></tr>
      <tr><th>${t('cat.life')}</th><td>${p.shelf ? `${p.shelf} ${t('cat.days')}` : ask}</td></tr>
      <tr><th>${t('cat.case')}</th><td>${packs}</td></tr>
      <tr><th>${t('cat.pallet')}</th><td>${pallets}</td></tr>
      <tr><th>${t('cat.temp')}</th><td>40 °F</td></tr>
      <tr><th>${t('cat.ing')}</th><td>${p.ingredients ? esc(p.ingredients[L]) : ask}</td></tr>
    </tbody></table>
    <div class="drawer__actions">
      <button type="button" class="btn btn--gold" data-design="${p.id}">${t('cat.design')} <i class="arrow">→</i></button>
      <button type="button" class="btn btn--line" data-ask="${p.id}">✦ ${t('cat.askAi')}</button>
      <button type="button" class="btn btn--line" data-print="${p.id}">${t('cat.print')}</button>
    </div>`;
  const d = $('#drawer'); d.hidden = false; lenis?.stop();
  if (!reduced) { gsap.fromTo('#drawerPanel', { xPercent: 100 }, { xPercent: 0, duration: 0.7, ease: 'expo.out' }); gsap.fromTo('.drawer__bg', { opacity: 0 }, { opacity: 1, duration: 0.4 }); gsap.from('.drawer__img img', { scale: 0.6, rotate: -10, opacity: 0, duration: 0.9, delay: 0.15, ease: 'back.out(1.6)' }); }
  setTimeout(() => $('.drawer__close').focus(), 50);
}
function closeDrawer() {
  const d = $('#drawer'); if (d.hidden) return;
  const done = () => { d.hidden = true; lenis?.start(); };
  if (reduced) return done();
  gsap.to('#drawerPanel', { xPercent: 100, duration: 0.45, ease: 'expo.in' }); gsap.to('.drawer__bg', { opacity: 0, duration: 0.45, onComplete: done });
}
function printSpec(id) {
  const p = PRODUCTS.find((x) => x.id === id); const L = LANG;
  const sheet = document.createElement('div'); sheet.className = 'print-sheet';
  sheet.innerHTML = `<style>.print-sheet{font:14px/1.5 Arial,sans-serif;color:#0d1b33;padding:24px}.print-sheet img.logo{height:40px}.print-sheet h1{font:700 28px Georgia,serif;margin:18px 0 6px}.print-sheet table{width:100%;border-collapse:collapse;margin-top:14px}.print-sheet th,.print-sheet td{text-align:left;border-bottom:1px solid #ccc;padding:8px 6px;vertical-align:top}.print-sheet th{width:30%}.print-sheet .pimg{height:200px;margin:12px 0}</style>
    <img class="logo" src="./img/ui/logo.png" alt="Mi Semago" /><h1>${esc(p.name[L])}</h1><p>${esc(p.desc[L])}</p><img class="pimg" src="./img/p/${p.img}.webp" alt="" />${$('#drawerPanel .spec').outerHTML}
    <p style="margin-top:18px">${BRAND.email} · ${BRAND.phone} · ${BRAND.office}</p>`;
  document.body.append(sheet);
  const imgs = $$('img', sheet);
  Promise.all(imgs.map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => { print(); sheet.remove(); });
}

// ───────── La planta: video cuadro por cuadro con el scroll ─────────
const frameSrc = (i) => `./frames/f${String(i + 1).padStart(3, '0')}.webp`;
const frames = [];
let framesRequested = false;
function loadFrames() {
  if (framesRequested) return;
  framesRequested = true;
  for (let i = 0; i < PLANT_FRAMES; i++) { if (frames[i]) continue; const img = new Image(); img.decoding = 'async'; img.src = frameSrc(i); frames[i] = img; }
}
function plant() {
  const cv = $('#plantCanvas'); const g = cv.getContext('2d');
  let cur = -1; let w = 0, h = 0;
  const size = () => { const dpr = Math.min(devicePixelRatio || 1, 1.6); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); draw(Math.max(cur, 0), true); };
  const draw = (i, force) => {
    if (i === cur && !force) return;
    // Si el cuadro todavía no carga, usa el más cercano que ya esté listo.
    let k = i; while (k > 0 && !(frames[k] && frames[k].complete && frames[k].naturalWidth)) k--;
    const img = frames[k]; if (!img || !img.naturalWidth) return;
    cur = i;
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  };
  $('#plantDots').innerHTML = PLANT_CHAPTERS.map(() => '<li></li>').join('');
  let chap = -1;
  const setChapter = (c) => {
    if (c === chap) return; chap = c; const ch = PLANT_CHAPTERS[c];
    $('#plantNum').textContent = String(c + 1).padStart(2, '0'); $('#plantName').textContent = ch.name[LANG]; $('#plantText').textContent = ch.text[LANG];
    $$('#plantDots li').forEach((li, i) => li.classList.toggle('on', i === c));
    if (!reduced) gsap.fromTo('#plantChapter > *', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: 'expo.out' });
  };
  plant.setChapter = () => { const c = chap; chap = -1; setChapter(Math.max(c, 0)); };
  setChapter(0);
  ScrollTrigger.create({ trigger: '#planta', start: 'top 200%', once: true, onEnter: loadFrames });
  ScrollTrigger.create({
    trigger: '#planta', start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: (s) => {
      const i = Math.min(PLANT_FRAMES - 1, Math.floor(s.progress * PLANT_FRAMES));
      draw(i);
      let c = 0; PLANT_CHAPTERS.forEach((ch, k) => { if (i >= ch.from) c = k; }); setChapter(c);
      $('#plantProgress').style.transform = `scaleX(${s.progress})`;
    },
  });
  const first = new Image(); first.onload = () => { frames[0] = frames[0] || first; size(); }; first.src = frameSrc(0);
  addEventListener('resize', size);
  // Si un cuadro carga tarde, vuelve a pintar el actual.
  let plantVisible = false;
  ScrollTrigger.create({ trigger: '#planta', start: 'top bottom', end: 'bottom top', onToggle: (s) => { plantVisible = s.isActive; } });
  setInterval(() => { if (plantVisible && cur >= 0) draw(cur, true); }, 700);
}

// ───────── Mapa de distribución ─────────
const DAY_COLORS = ['#f3dc8f', '#e2c167', '#c79e3c', '#9f7a26', '#6f551a'];
function map() {
  const svg = $('#mapSvg');
  svg.innerHTML = `<g id="mapStates">${STATES.map((s) => { const d = s.id === 'AK' || s.id === 'HI' ? 5 : transitDays(s.miles); return `<path class="st" data-id="${s.id}" d="${s.d}" fill="${DAY_COLORS[d - 1]}" fill-opacity="${s.id === 'AK' || s.id === 'HI' ? 0.35 : 0.9}"><title>${esc(s.name)}</title></path>`; }).join('')}</g>
    <path id="mapRoute" class="route" d="" />
    <circle class="pulse" cx="${ORIGIN.x}" cy="${ORIGIN.y}" r="8" /><circle class="origin" cx="${ORIGIN.x}" cy="${ORIGIN.y}" r="6" />
    <g id="mapTruck" opacity="0"><circle class="truck" r="9" /><text text-anchor="middle" dy="4" font-size="10" font-weight="800" fill="#0b2b57">❄</text></g>`;
  svg.addEventListener('click', (e) => { const p = e.target.closest('.st'); if (p) pickState(p.dataset.id); });
  ScrollTrigger.create({ trigger: '#map', start: 'top 75%', once: true, onEnter: () => {
    if (!reduced) gsap.fromTo('#mapStates .st', { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.7, stagger: { each: 0.014, from: 'end' }, ease: 'expo.out' });
    setTimeout(() => pickState(shipState || 'TX'), reduced ? 0 : 500);
  } });
}
let shipState = null;
function pickState(id) {
  const s = STATES.find((x) => x.id === id); if (!s) return;
  shipState = id;
  $$('#mapStates .st').forEach((p) => p.classList.toggle('on', p.dataset.id === id));
  const far = id === 'AK' || id === 'HI'; const d = far ? null : transitDays(s.miles);
  $('#shState').textContent = s.name;
  $('#shDays').textContent = d ?? '—';
  $('#shDaysLbl').textContent = far ? t('sh.consult') : d === 1 ? t('sh.day') : t('sh.days');
  $('#shMiles').textContent = s.miles.toLocaleString(LANG === 'en' ? 'en-US' : 'es-MX');
  const x0 = ORIGIN.x, y0 = ORIGIN.y, x1 = s.cx, y1 = s.cy;
  const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - Math.max(40, Math.abs(x1 - x0) * 0.28);
  const route = $('#mapRoute'); route.setAttribute('d', `M${x0},${y0} Q${mx},${my} ${x1},${y1}`);
  const len = route.getTotalLength(); const truck = $('#mapTruck');
  if (reduced || id === 'NJ') { const pt = route.getPointAtLength(len); truck.setAttribute('transform', `translate(${pt.x},${pt.y})`); truck.setAttribute('opacity', 1); return; }
  gsap.killTweensOf(route);
  gsap.fromTo(route, { strokeDashoffset: len * 1 }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', onStart: () => { route.style.strokeDasharray = `${len}`; }, onComplete: () => { route.style.strokeDasharray = ''; } });
  const o = { p: 0 }; truck.setAttribute('opacity', 1);
  gsap.to(o, { p: 1, duration: 1.4, ease: 'power2.inOut', onUpdate: () => { const pt = route.getPointAtLength(o.p * len); truck.setAttribute('transform', `translate(${pt.x},${pt.y})`); } });
  gsap.fromTo('#shDays', { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)' });
}

// ───────── Preguntas frecuentes ─────────
function faq() {
  $('#faqList').innerHTML = FAQ.map((f, i) => `<div class="qa"><button type="button" aria-expanded="false" aria-controls="qa${i}">${esc(f.q[LANG])}<i>+</i></button><div class="qa__a" id="qa${i}" role="region"><p>${esc(f.a[LANG])}</p></div></div>`).join('');
}
function toggleQa(btn) {
  const qa = btn.parentElement; const a = qa.querySelector('.qa__a'); const open = !qa.classList.contains('open');
  qa.classList.toggle('open', open); btn.setAttribute('aria-expanded', open);
  if (reduced) { a.style.height = open ? 'auto' : '0'; return; }
  gsap.to(a, { height: open ? 'auto' : 0, duration: 0.5, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
}

// ───────── Contacto ─────────
const contact = { type: null, interest: new Set() };
function contactChips() {
  $('#ctInterest').innerHTML = CATEGORIES.map((c) => `<button type="button" data-cat="${c.id}" class="${contact.interest.has(c.id) ? 'on' : ''}">${esc(c.name[LANG])}</button>`).join('');
}
function sendStudio(s) {
  studioProposal = s;
  const cat = PRODUCTS.find((p) => p.id === s.pid)?.cat; if (cat) contact.interest.add(cat);
  contactChips();
  $('#ctStudio').hidden = false; $('#ctStudioTxt').textContent = s.short;
  scrollToEl('#contacto');
  setTimeout(() => $('#contactForm [name=name]').focus({ preventScroll: true }), 1400);
}
function submitContact(e) {
  e.preventDefault();
  const f = e.target; const name = f.name.value.trim(); const email = f.email.value.trim();
  if (!name) { f.name.focus(); f.name.reportValidity?.(); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { f.email.focus(); f.email.reportValidity?.(); return; }
  const en = LANG === 'en';
  const lines = [
    `${en ? 'Name' : 'Nombre'}: ${name}`, `${en ? 'Company' : 'Empresa'}: ${f.company.value.trim() || '—'}`, `Email: ${email}`, `${en ? 'Phone' : 'Teléfono'}: ${f.phone.value.trim() || '—'}`,
    `${en ? 'Business' : 'Negocio'}: ${contact.type || '—'}`,
    `${en ? 'Interested in' : 'Le interesa'}: ${[...contact.interest].map((c) => CATEGORIES.find((x) => x.id === c).name[LANG]).join(', ') || '—'}`,
    '', f.msg.value.trim(),
  ];
  if (studioProposal) lines.push('', studioProposal.text);
  const subject = `${en ? 'Private label request' : 'Solicitud de marca privada'} · ${f.company.value.trim() || name}`;
  location.href = `mailto:${BRAND.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  $('#ctOk').hidden = false;
}

// ───────── Navegación, hilo, cursor ─────────
function nav() {
  const navEl = $('#nav'); let lastY = 0;
  const onScroll = (y) => {
    navEl.classList.toggle('scrolled', y > 40);
    const down = y > lastY && y > 400; navEl.classList.toggle('hide', down && $('#mnav').hidden); lastY = y;
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll)); else addEventListener('scroll', () => onScroll(scrollY), { passive: true });
  $$('.private, .catalog, .handmade, .people, .why, .faq').forEach((sec) => ScrollTrigger.create({ trigger: sec, start: 'top 60px', end: 'bottom 60px', onToggle: (s) => navEl.classList.toggle('light', s.isActive) }));
  $$('.nav__links a').forEach((a) => { const sec = $(a.getAttribute('href')); if (sec) ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => a.classList.toggle('on', s.isActive) }); });
  const burger = $('#burger'); const m = $('#mnav');
  const setMenu = (open) => { m.hidden = !open; burger.setAttribute('aria-expanded', open); if (open) { lenis?.stop(); if (!reduced) gsap.from('#mnav a', { y: 40, opacity: 0, stagger: 0.05, duration: 0.6, ease: 'expo.out' }); } else lenis?.start(); };
  burger.addEventListener('click', () => setMenu(m.hidden));
  m.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
}
function thread() {
  const path = $('#threadPath'); const svg = $('#thread'); const len = path.getTotalLength();
  path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
  ScrollTrigger.create({ trigger: 'main', start: 'top top', end: 'bottom bottom', onUpdate: (s) => { path.style.strokeDashoffset = len * (1 - s.progress); svg.classList.toggle('on', s.progress > 0.04 && s.progress < 0.995); } });
}
function cursor() {
  if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const c = $('#cursor'); const pos = { x: innerWidth / 2, y: innerHeight / 2 }; const cur = { ...pos };
  addEventListener('pointermove', (e) => { pos.x = e.clientX; pos.y = e.clientY; });
  gsap.ticker.add(() => { cur.x += (pos.x - cur.x) * 0.2; cur.y += (pos.y - cur.y) * 0.2; c.style.transform = `translate(${cur.x}px, ${cur.y}px)`; });
  document.addEventListener('pointerover', (e) => c.classList.toggle('big', !!e.target.closest('a, button, input, select, textarea, label, .st')));
  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4 }); });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }));
  });
}

// ───────── Entradas con el scroll ─────────
function reveals() {
  if (reduced) { $$('.split').forEach((el) => { el.dataset.shown = 1; }); return; }
  $$('.split').forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => { el.dataset.shown = 1; gsap.to($$('.sw > span', el), { yPercent: 0, duration: 1.1, stagger: 0.05, ease: 'expo.out' }); } }));
  $$('.reveal').forEach((el, i) => gsap.to(el, { opacity: 1, y: 0, duration: 1, delay: (i % 4) * 0.08, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));
  $$('.reveal-img').forEach((el) => {
    gsap.to(el, { clipPath: 'inset(0% 0 0 0)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 85%' } });
    gsap.to($('img', el), { scale: 1, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
    gsap.to($('img', el), { yPercent: -8, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  ScrollTrigger.create({ trigger: '#manifesto', start: 'top 80%', end: 'bottom 45%', scrub: true, onUpdate: (s) => manifestoProgress(s.progress) });
  ScrollTrigger.create({ trigger: '#timeline', start: 'top 75%', once: true, onEnter: () => { timelineShown = true; gsap.to('.tstep__bar i', { scaleX: 1, duration: 0.9, stagger: 0.5, ease: 'power2.inOut' }); } });
  ScrollTrigger.create({ trigger: '#catGrid', start: 'top 85%', once: true, onEnter: () => { catalogShown = true; gsap.to('#catGrid .card', { y: 0, opacity: 1, duration: 0.9, stagger: 0.05, ease: 'expo.out' }); } });
  gsap.from('.studio__stage', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.studio__grid', start: 'top 80%' } });
  gsap.from('.step', { x: -40, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.studio__grid', start: 'top 80%' } });
  gsap.to('.hero__inner', { yPercent: 18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.from('.footer__big', { xPercent: -20, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
}

// ───────── Arranque ─────────
function init() {
  $('#year').textContent = new Date().getFullYear();
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  $('#drawerPanel').setAttribute('data-lenis-prevent', ''); $('#chatLog').setAttribute('data-lenis-prevent', ''); $('#mnav').setAttribute('data-lenis-prevent', '');

  applyLang();
  timeline(); catalog(); faq(); contactChips();
  initStudio(ctx); initChat(ctx);
  strands(); handmade(); openSections(); cardLights(); marquee(); plant(); map(); nav(); thread(); cursor(); reveals();

  // Enlaces internos con scroll suave
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const el = $(id); if (!el) return; e.preventDefault(); scrollToEl(el);
  });
  $('#langBtn').addEventListener('click', () => {
    LANG = LANG === 'es' ? 'en' : 'es'; store.set('ms-lang', LANG);
    const swap = () => { applyLang(); timeline(); if (timelineShown || reduced) gsap.set('.tstep__bar i', { scaleX: 1 }); catalog(); catalogShown && gsap.set('#catGrid .card', { opacity: 1, y: 0 }); faq(); contactChips(); refreshStudio(); refreshChat(); plant.setChapter?.(); if (shipState) pickState(shipState); };
    if (reduced) return swap();
    gsap.to('main, .nav__links', { opacity: 0, duration: 0.2, onComplete: () => { swap(); gsap.to('main, .nav__links', { opacity: 1, duration: 0.35 }); } });
  });
  $('#catTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; catFilter = b.dataset.cat; $$('#catTabs button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); renderGrid(true); ScrollTrigger.refresh(); });
  $('#catGrid').addEventListener('click', (e) => { const c = e.target.closest('[data-pid]'); if (c) openDrawer(c.dataset.pid); });
  $('#drawer').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return closeDrawer();
    const d = e.target.closest('[data-design]'); const a = e.target.closest('[data-ask]'); const pr = e.target.closest('[data-print]');
    if (d) { closeDrawer(); ctx.toStudio(d.dataset.design); }
    if (a) { const p = PRODUCTS.find((x) => x.id === a.dataset.ask); closeDrawer(); openChat(LANG === 'en' ? `Tell me about ${p.name.en} for my private label: sizes, pallets and shelf life.` : `Cuéntame del ${p.name.es} para mi marca privada: presentaciones, tarimas y vida de anaquel.`); }
    if (pr) printSpec(pr.dataset.print);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  $('#faqList').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) toggleQa(b); });
  $('#ctType').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; contact.type = b.textContent; $$('#ctType button').forEach((x) => x.classList.toggle('on', x === b)); });
  $('#ctInterest').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; const c = b.dataset.cat; contact.interest.has(c) ? contact.interest.delete(c) : contact.interest.add(c); b.classList.toggle('on'); });
  $('#contactForm').addEventListener('submit', submitContact);

  boot();
  addEventListener('load', () => ScrollTrigger.refresh());
}
init();
