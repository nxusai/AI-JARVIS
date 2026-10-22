import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './style.css';
import { site, products, recipes, stores, gallery, photoCredit } from './data.js';
import { ES, UI } from './i18n.js';

gsap.registerPlugin(ScrollTrigger);
document.documentElement.classList.add('js');

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const desktop = matchMedia('(min-width: 901px)');

/* ═════════ Language ═════════ */
const LANG_KEY = 'vayro-lang';
let lang = (() => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {}
  return (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
})();
const t = (k) => UI[lang][k];
const tx = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o[lang] ?? o.en : o);
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

function applyLang() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach((el) => {
    if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
    const es = ES[el.dataset.i18n];
    el.innerHTML = lang === 'es' && es ? es : el.dataset.en;
  });
  $$('[data-i18n-ph]').forEach((el) => {
    if (el.dataset.enPh === undefined) el.dataset.enPh = el.placeholder;
    el.placeholder = lang === 'es' ? ES[el.dataset.i18nPh] : el.dataset.enPh;
  });
  $('[data-lang-toggle]').setAttribute('aria-label', t('toEs'));
  $('.burger').setAttribute('aria-label', t('menu'));
  $$('.drawer__x').forEach((b) => b.setAttribute('aria-label', t('close')));
}

/* ═════════ Icons ═════════ */
const ICON = {
  instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2Zm0 4.9a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8Zm0 8.1a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm5.1-9.4a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24"><path d="M19.6 6.7a4.8 4.8 0 0 1-3.8-4.2V2h-3.4v13.4a2.9 2.9 0 1 1-2-2.8V9.2a6.3 6.3 0 1 0 5.4 6.2V8.6a8.2 8.2 0 0 0 4.8 1.5V6.8l-1-.1Z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15V9l5.8 3-5.8 3Z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24"><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z"/></svg>',
};
const markSvg = '<svg viewBox="572 110 670 518"><path d="M578 117h153l247 397-72 108z"/><path d="M983 117h252l-218 336-49-76 101-159h-66l-69 105-43-66z"/></svg>';

function wireStatic() {
  const social = Object.entries(site.social)
    .filter(([, href]) => href)
    .map(([k, href]) => `<a href="${href}" target="_blank" rel="noopener" aria-label="${k[0].toUpperCase() + k.slice(1)}">${ICON[k]}</a>`)
    .join('');
  $$('[data-social]').forEach((el) => (el.innerHTML = social));
  $$('[data-hashtag]').forEach((el) => (el.textContent = site.hashtag));
  $$('[data-email]').forEach((a) => Object.assign(a, { href: `mailto:${site.email}`, textContent: site.email }));
  $$('[data-credit]').forEach((a) => Object.assign(a, { href: photoCredit.url, textContent: photoCredit.label, target: '_blank', rel: 'noopener' }));
  $('#year').textContent = new Date().getFullYear();
}

function jsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'VAYRO',
        slogan: 'Food built for the way you live.',
        url: `${site.domain}/`,
        logo: `${site.domain}/img/icon-512.png`,
        email: site.email,
        sameAs: Object.values(site.social).filter(Boolean),
      },
      ...products.flatMap((p) =>
        p.sizes.map((s) => ({
          '@type': 'Product',
          name: `VAYRO ${p.name.en} ${s.label}`,
          brand: { '@type': 'Brand', name: 'VAYRO' },
          image: `${site.domain}/${s.img}`,
          description: p.desc.en,
          category: 'Cheese',
          weight: s.label,
        })),
      ),
    ],
  };
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.textContent = JSON.stringify(data);
  document.head.append(el);
}

/* ═════════ Smooth scroll ═════════ */
let lenis = null;
function smoothScroll() {
  if (!reduced) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    else if (target === 0) window.scrollTo({ top: 0 });
    else target.scrollIntoView();
  });
}
const lockScroll = (on) => {
  document.body.classList.toggle('is-locked', on);
  if (lenis) on ? lenis.stop() : lenis.start();
};

/* ═════════ Nav ═════════ */
function nav() {
  const bar = $('#nav');
  let last = 0;
  const lightSections = $$('.brand, .fuel, .recipes, .community, .where');
  const onScroll = () => {
    const y = window.scrollY;
    bar.classList.toggle('is-solid', y > 40);
    bar.classList.toggle('is-hidden', y > 500 && y > last && !$('#menu').classList.contains('is-open'));
    last = y;
    const probe = 36;
    const light = lightSections.some((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= probe && r.bottom >= probe;
    });
    bar.classList.toggle('is-light', light && !$('#menu').classList.contains('is-open'));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const links = $$('.nav__links a');
  links.forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    });
  });

  $('.burger').addEventListener('click', () => ($('#menu').classList.contains('is-open') ? closeMenu() : openMenu()));
  $('[data-lang-toggle]').addEventListener('click', () => {
    lang = lang === 'en' ? 'es' : 'en';
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
    rerender();
  });
}
function openMenu() {
  const m = $('#menu');
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('is-open'));
  $('.burger').setAttribute('aria-expanded', 'true');
  $('#nav').classList.remove('is-light', 'is-hidden');
  lockScroll(true);
}
function closeMenu() {
  const m = $('#menu');
  if (!m.classList.contains('is-open')) return;
  m.classList.remove('is-open');
  $('.burger').setAttribute('aria-expanded', 'false');
  lockScroll(false);
  setTimeout(() => !m.classList.contains('is-open') && (m.hidden = true), 800);
}

/* ═════════ Hero ═════════ */
function intro() {
  const loader = $('.loader');
  const tl = gsap.timeline();
  if (reduced) {
    loader.classList.add('is-done');
    return;
  }
  tl.from('.loader__o', { yPercent: -60, opacity: 0, duration: 0.7, ease: 'power3.out' })
    .from('.loader__d', { yPercent: 60, opacity: 0, duration: 0.7, ease: 'power3.out' }, '<0.12')
    .to('.loader__bar i', { scaleX: 1, duration: 0.7, ease: 'power2.inOut' }, '<')
    .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'expo.inOut' }, '+=0.1')
    .add(() => loader.classList.add('is-done'))
    .from('.hero__title .line > span', { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, '-=0.35')
    .from('.hero .eyebrow, .hero__sub, .hero__ctas', { y: 24, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }, '<0.2')
    .from('#heroLid', { scale: 0.6, rotate: -120, opacity: 0, duration: 1.5, ease: 'expo.out' }, '<-0.2')
    .from('.hero__ring', { scale: 0.8, opacity: 0, duration: 1.2, ease: 'expo.out' }, '<')
    .from('.chip', { scale: 0.6, opacity: 0, duration: 0.8, ease: 'back.out(1.8)', stagger: 0.12 }, '<0.5')
    .from('.hero__slash', { yPercent: -120, duration: 1.4, ease: 'expo.out' }, '<-0.8');
}

function hero() {
  if (reduced) return;
  const lid = $('#heroLid');
  gsap.to(lid, { y: -14, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  gsap.to('.chip--a', { y: -10, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  gsap.to('.chip--b', { y: 12, duration: 3.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  gsap.to('.chip--c', { y: -8, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  if (finePointer) {
    const rx = gsap.quickTo(lid, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(lid, 'rotationY', { duration: 0.8, ease: 'power3' });
    $('.hero').addEventListener('pointermove', (e) => {
      const x = e.clientX / innerWidth - 0.5;
      const y = e.clientY / innerHeight - 0.5;
      ry(x * 26);
      rx(-y * 26);
    });
  }
  gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
    .to('.hero__product', { yPercent: 30, scale: 0.85, rotate: 40, ease: 'none' }, 0)
    .to('.hero__copy', { yPercent: -18, opacity: 0.2, ease: 'none' }, 0)
    .to('.hero__bg img', { yPercent: 12, ease: 'none' }, 0);
}

/* ═════════ Marquee ═════════ */
let marqueeST = null;
function marquee() {
  const track = $('.marquee__track');
  const span = track.firstElementChild;
  track.querySelectorAll('[data-clone]').forEach((c) => c.remove());
  for (let i = 0; i < 3; i++) {
    const c = span.cloneNode(true);
    c.dataset.clone = '';
    c.removeAttribute('data-i18n');
    track.append(c);
  }
  if (reduced) return;
  gsap.killTweensOf(track);
  marqueeST?.kill();
  gsap.set(track, { xPercent: 0 });
  const loop = gsap.to(track, { xPercent: -25, duration: 22, ease: 'none', repeat: -1 });
  marqueeST = ScrollTrigger.create({
    trigger: '.marquee',
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      const v = Math.min(Math.abs(self.getVelocity()) / 400, 5);
      gsap.to(loop, { timeScale: 1 + v, duration: 0.2, overwrite: true });
      gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.2, overwrite: false });
    },
  });
}

/* ═════════ Manifesto ═════════ */
let manifestoST = null;
function manifesto() {
  const el = $('[data-words]');
  el.innerHTML = el.textContent
    .trim()
    .split(/\s+/)
    .map((w) => `<span class="w">${w}</span> `)
    .join('');
  if (reduced) return;
  manifestoST?.kill();
  const words = $$('.w', el);
  manifestoST = ScrollTrigger.create({
    trigger: el,
    start: 'top 80%',
    end: 'bottom 45%',
    scrub: true,
    onUpdate: (self) => {
      const n = Math.round(self.progress * words.length);
      words.forEach((w, i) => w.classList.toggle('is-on', i < n));
    },
  });
}

/* ═════════ Products ═════════ */
function productCards() {
  const cards = products
    .map((p) => {
      const s = p.sizes[0];
      return `
      <button class="pcard${s.tall ? ' pcard--tall' : ''}" type="button" data-product="${p.id}" aria-label="${tx(p.name)} — ${t('details')}">
        <div class="pcard__top">
          <span class="pcard__tag">${t('fam')[p.family]}</span>
          <span class="pcard__sizes">${p.sizes.map((z) => `<span>${z.label}</span>`).join('')}</span>
        </div>
        <div class="pcard__img"><img src="${s.img}" alt="VAYRO ${tx(p.name)} ${s.label}" loading="lazy" /></div>
        <h3>${tx(p.name)}</h3>
        <p class="pcard__line">${tx(p.line)}</p>
        <div class="pcard__facts">
          <div><b class="o">${p.nf.protein}g</b><span>${t('protein')}</span></div>
          <div><b>${p.nf.calcium}%</b><span>${t('calcium')}</span></div>
          <div><b>${p.nf.calories}</b><span>kcal</span></div>
        </div>
        <span class="pcard__more">${t('details')}<i>→</i></span>
      </button>`;
    })
    .join('');
  const next = `
      <div class="pcard pcard--next">
        <div class="pcard__top"><span class="pcard__tag">${t('nextT')}</span></div>
        <div class="pcard__img"><span class="ghost-mark">${markSvg}</span></div>
        <div>
          <h3>${t('nextH')}</h3>
          <p>${t('nextP')}</p>
          <a class="btn btn--ghost btn--block" href="#contact">${t('nextCta')}</a>
        </div>
      </div>`;
  $('#productTrack').innerHTML = cards + next;
}

let productST = null;
function productScroll() {
  productST?.scrollTrigger?.kill();
  productST?.kill();
  productST = null;
  const sec = $('.products');
  const track = $('#productTrack');
  const bar = $('#productProgress');
  sec.classList.remove('is-pinned');
  gsap.set(track, { x: 0 });

  if (desktop.matches && !reduced) {
    sec.classList.add('is-pinned');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    productST = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: '.products__pin',
        start: 'center center',
        end: () => `+=${dist()}`,
        pin: sec,
        pinSpacing: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
        // The pin adds scroll length, so it must measure before every trigger below it.
        refreshPriority: 1,
        onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
      },
    });
    ScrollTrigger.sort();
  } else {
    track.onscroll = () => gsap.set(bar, { scaleX: track.scrollLeft / Math.max(1, track.scrollWidth - track.clientWidth) });
  }
}

/* ═════════ Product drawer ═════════ */
let lastFocus = null;
function openDrawer(id, sizeId) {
  const p = products.find((x) => x.id === id);
  if (!p) return;
  const s = p.sizes.find((z) => z.id === sizeId) || p.sizes[0];
  const n = p.nf;
  const row = (label, val, dv, cls = '') => `<div class="row ${cls}"><span>${label} ${val}</span>${dv === undefined ? '' : `<b>${dv}%</b>`}</div>`;
  const related = recipes.filter((r) => r.product === p.id);
  $('#drawerBody').innerHTML = `
    <div class="dhero">
      <div class="dhero__img${s.tall ? ' dhero__img--tall' : ''}"><img src="${s.img}" alt="VAYRO ${tx(p.name)} ${s.label}" /></div>
      <h2 id="drawerTitle">${tx(p.name)}</h2>
      <p>${tx(p.use)}</p>
      <div class="dsizes" role="group" aria-label="${t('sizes')}">
        ${p.sizes.map((z) => `<button type="button" data-size="${z.id}" aria-pressed="${z.id === s.id}">${z.label}<small>· ${t('channel')[z.channel]}</small></button>`).join('')}
      </div>
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected="true" data-tab="o">${t('tabOverview')}</button>
      <button role="tab" aria-selected="false" data-tab="n">${t('tabNutrition')}</button>
      <button role="tab" aria-selected="false" data-tab="i">${t('tabIngredients')}</button>
    </div>
    <div class="tabpane" data-pane="o">
      <div class="kpis">
        <div><b>${n.protein}g</b><span>${t('protein')} ${t('perServing')}</span></div>
        <div><b>${n.calcium}%</b><span>${t('calcium')}</span></div>
        <div><b>${n.addedSugars[0]}</b><span>${t('addedShort')}</span></div>
      </div>
      <p>${tx(p.desc)}</p>
      <p class="dsub">${t('pairs')}</p>
      <ul class="dpairs">${tx(p.pairs).map((x) => `<li>${x}</li>`).join('')}</ul>
      ${related.length ? `<p class="dsub">${t('recipes')}</p>${related.map((r) => `<button class="rmade" type="button" data-recipe="${r.id}"><img src="${r.img}" alt="" style="object-fit:cover;border-radius:12px" /><span><b>${tx(r.title)}</b><span>${r.time} ${t('min')}</span></span></button>`).join('')}` : ''}
    </div>
    <div class="tabpane" data-pane="n" hidden>
      <div class="nf">
        <h4>${t('nutritionFacts')}</h4>
        <div class="bar-m" style="padding:4px 0 6px;font-size:14px">${s.servings} ${t('servingsPer')}<br /><b>${t('servingSize')}</b> <b style="float:right">${p.serving}</b></div>
        <div class="bar-l"></div>
        <div style="font-size:12px;font-weight:700;padding-top:4px">${t('amount')}</div>
        <div class="cal bar-m"><span>${t('calories')}</span>${n.calories}</div>
        <div class="row" style="justify-content:flex-end;font-size:12px;font-weight:700">% DV*</div>
        ${row(`<b>${t('totalFat')}</b>`, n.fat[0], n.fat[1])}
        ${row(t('satFat'), n.satFat[0], n.satFat[1], 'ind')}
        ${row(`<i>${t('transFat')}</i>`, n.transFat, undefined, 'ind')}
        ${row(`<b>${t('cholesterol')}</b>`, n.cholesterol[0], n.cholesterol[1])}
        ${row(`<b>${t('sodium')}</b>`, n.sodium[0], n.sodium[1])}
        ${row(`<b>${t('totalCarb')}</b>`, n.carbs[0], n.carbs[1])}
        ${row(t('fiber'), n.fiber[0], n.fiber[1], 'ind')}
        ${row(t('sugars'), n.sugars, undefined, 'ind')}
        ${row(fill(t('added'), { x: n.addedSugars[0] }), '', n.addedSugars[1], 'ind2')}
        <div class="bar-l">${row(`<b>${t('proteinNF')}</b>`, `${n.protein}g`)}</div>
        <div class="row">${t('vitD')} ${n.vitD}% · ${t('calciumNF')} ${n.calcium}% · ${t('iron')} ${n.iron}% · ${t('potassium')} ${n.potassium}%</div>
        <div class="row small">* ${lang === 'es' ? 'El % de Valor Diario indica cuánto aporta un nutriente en una porción a una dieta diaria. Se usan 2,000 calorías al día como consejo general de nutrición.' : 'The % Daily Value tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.'}</div>
      </div>
    </div>
    <div class="tabpane" data-pane="i" hidden>
      <p class="ingr"><b>${lang === 'es' ? 'Ingredientes (como aparecen en la etiqueta)' : 'Ingredients'}:</b> ${p.ingredients}</p>
      <span class="contains">${t('contains')}: ${p.contains}</span>
      <p class="ingr" style="margin-top:16px">${t('keepCold')}</p>
    </div>
    <div class="dactions">
      <a class="btn btn--orange" href="#where" data-close>${t('findIt')}</a>
      <a class="btn btn--dark" href="#retail" data-close>${lang === 'es' ? 'Mayoreo' : 'Wholesale'}</a>
    </div>`;

  const body = $('#drawerBody');
  $$('[data-size]', body).forEach((b) => b.addEventListener('click', () => {
    openDrawer(p.id, b.dataset.size);
    $(`[data-size="${b.dataset.size}"]`, body)?.focus();
  }));
  $$('[data-tab]', body).forEach((b) =>
    b.addEventListener('click', () => {
      $$('[data-tab]', body).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      $$('[data-pane]', body).forEach((x) => (x.hidden = x.dataset.pane !== b.dataset.tab));
    }),
  );
  $$('[data-recipe]', body).forEach((b) => b.addEventListener('click', () => {
    closeLayer($('#drawer'));
    setTimeout(() => openRecipe(b.dataset.recipe), 350);
  }));
  showLayer($('#drawer'));
}

function showLayer(layer) {
  if (!layer.hidden && layer.classList.contains('is-open')) return;
  lastFocus = document.activeElement;
  layer.hidden = false;
  layer.querySelector('.drawer__body').scrollTop = 0;
  requestAnimationFrame(() => {
    layer.classList.add('is-open');
    layer.querySelector('.drawer__x').focus({ preventScroll: true });
  });
  lockScroll(true);
}
function closeLayer(layer) {
  if (layer.hidden) return;
  layer.classList.remove('is-open');
  lockScroll(false);
  setTimeout(() => !layer.classList.contains('is-open') && (layer.hidden = true), 700);
  lastFocus?.focus?.({ preventScroll: true });
}
function layers() {
  $$('.drawer').forEach((layer) =>
    layer.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeLayer(layer);
    }),
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.drawer').forEach(closeLayer);
      closeMenu();
    }
    if (e.key === 'Tab') {
      const layer = $$('.drawer').find((l) => !l.hidden);
      if (!layer) return;
      const f = $$('button, a[href], input, select, textarea', layer).filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-product]');
    if (card) openDrawer(card.dataset.product);
  });
}

/* ═════════ Fuel calculator ═════════ */
let calcId = products[0].id;
function calc() {
  $('#calcProducts').innerHTML = products
    .map((p) => `<button type="button" role="radio" aria-checked="${p.id === calcId}" data-calc="${p.id}">${tx(p.name)}</button>`)
    .join('');
  $$('[data-calc]').forEach((b) =>
    b.addEventListener('click', () => {
      calcId = b.dataset.calc;
      $$('[data-calc]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      updateCalc();
    }),
  );
  const range = $('#calcRange');
  range.oninput = updateCalc;
  updateCalc();
}
function updateCalc() {
  const p = products.find((x) => x.id === calcId);
  const range = $('#calcRange');
  const n = +range.value;
  $('#calcServ').textContent = n;
  range.style.setProperty('--p', `${((n - 1) / 3) * 100}%`);
  const carbs = parseFloat(p.nf.carbs[0]);
  // Bar maxima: 4 servings of the richest product in each column.
  const vals = { protein: [p.nf.protein * n, 40], calcium: [p.nf.calcium * n, 120], calories: [p.nf.calories * n, 760], carbs: [carbs * n, 16] };
  $$('.meter').forEach((m) => {
    const [v, max] = vals[m.dataset.k];
    const out = $('[data-v]', m);
    const from = +out.textContent || 0;
    if (reduced) out.textContent = v;
    else gsap.to({ v: from }, { v, duration: 0.7, ease: 'power3.out', onUpdate() { out.textContent = Math.round(this.targets()[0].v); } });
    $('.meter__bar i', m).style.width = `${Math.min(100, (v / max) * 100)}%`;
  });
}

/* ═════════ Recipes ═════════ */
let recipeFilter = 'all';
function recipeCards() {
  $('#recipeGrid').innerHTML = recipes
    .map((r) => {
      const p = products.find((x) => x.id === r.product);
      return `
      <button class="rcard" type="button" data-recipe="${r.id}" data-tags="${r.tags.join(' ')}">
        <div class="rcard__img"><img src="${r.img}" alt="${tx(r.title)}" loading="lazy" /></div>
        <div class="rcard__body">
          <div class="rcard__meta"><span class="o">${tx(p.name)}</span><span>${r.time} ${t('min')}</span></div>
          <h3>${tx(r.title)}</h3>
          <p>${tx(r.blurb)}</p>
          <span class="rcard__go">${t('view')}</span>
        </div>
      </button>`;
    })
    .join('');
  filterRecipes(recipeFilter, false);
}
function filterRecipes(f, animate = true) {
  recipeFilter = f;
  $$('#recipeFilters button').forEach((b) => b.classList.toggle('is-on', b.dataset.f === f));
  const cards = $$('.rcard');
  cards.forEach((c) => c.classList.toggle('is-out', f !== 'all' && !c.dataset.tags.split(' ').includes(f)));
  if (animate && !reduced) gsap.fromTo(cards.filter((c) => !c.classList.contains('is-out')), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: 'power3.out' });
  ScrollTrigger.refresh();
}
function recipesUI() {
  $('#recipeFilters').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) filterRecipes(b.dataset.f);
  });
  $('#recipeGrid').addEventListener('click', (e) => {
    const c = e.target.closest('[data-recipe]');
    if (c) openRecipe(c.dataset.recipe);
  });
}
function openRecipe(id) {
  const r = recipes.find((x) => x.id === id);
  const p = products.find((x) => x.id === r.product);
  $('#recipeBody').innerHTML = `
    <div class="rhero"><img src="${r.img}" alt="${tx(r.title)}" /></div>
    <h2 id="recipeTitle">${tx(r.title)}</h2>
    <div class="rcard__meta"><span class="o">${r.time} ${t('min')}</span><span>${t('serves')}: ${r.serves}</span></div>
    <p>${tx(r.blurb)}</p>
    <p class="dsub">${t('ingredients')}</p>
    <ul class="ringr">${tx(r.ingredients).map((x) => `<li>${x}</li>`).join('')}</ul>
    <p class="dsub">${t('method')}</p>
    <ol class="rsteps">${tx(r.steps).map((x) => `<li>${x}</li>`).join('')}</ol>
    <p class="dsub">${t('made')}</p>
    <button class="rmade" type="button" data-goto="${p.id}"><img src="${p.sizes[0].img}" alt="" /><span><b>VAYRO ${tx(p.name)}</b><span>${p.nf.protein}g ${t('protein')} ${t('perServing')}</span></span></button>`;
  $('[data-goto]', $('#recipeBody')).addEventListener('click', () => {
    closeLayer($('#recipeModal'));
    setTimeout(() => openDrawer(p.id), 350);
  });
  showLayer($('#recipeModal'));
}

/* ═════════ Gallery ═════════ */
function galleryGrid() {
  $('#gallery').innerHTML = gallery
    .map((g) => `<a href="${site.social.instagram}" target="_blank" rel="noopener" data-h="${site.handle}" aria-label="${site.handle} on Instagram"><img src="${g.img}" alt="" loading="lazy" style="object-position:${g.pos}" /></a>`)
    .join('');
}

/* ═════════ Forms ═════════ */
function validate(form) {
  let ok = true;
  $$('[required]', form).forEach((f) => {
    const bad = !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim()));
    f.classList.toggle('is-bad', bad);
    if (bad) ok = false;
  });
  return ok;
}
async function send(endpoint, payload, mail) {
  if (endpoint) {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(res.status);
    return 'api';
  }
  location.href = `mailto:${mail.to}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.body)}`;
  return 'mail';
}
function forms() {
  const status = (form, msg, ok) => {
    const s = $('.form__status', form) || $('#newsStatus');
    s.textContent = msg;
    s.className = `form__status ${ok ? 'ok' : 'bad'}`;
  };
  const handle = (form, endpoint, to, subject) =>
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate(form)) return status(form, t('error'), false);
      const data = Object.fromEntries(new FormData(form));
      const body = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n');
      try {
        const how = await send(endpoint, data, { to, subject: `${subject} — ${data.company || data.name}`, body });
        status(form, how === 'api' ? t('sentApi') : t('sent'), true);
        if (how === 'api') form.reset();
      } catch {
        status(form, fill(t('failed'), { email: to }), false);
      }
    });
  handle($('#wholesaleForm'), site.forms.wholesale, site.salesEmail, 'VAYRO wholesale inquiry');
  handle($('#contactForm'), site.forms.contact, site.email, 'VAYRO contact');

  const news = $('#newsForm');
  news.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#newsEmail');
    const st = $('#newsStatus');
    if (!validate(news)) {
      st.textContent = t('error');
      return;
    }
    try {
      const how = await send(site.forms.newsletter, { email: input.value.trim() }, { to: site.email, subject: 'Join the VAYRO list', body: `Please add me to the VAYRO list: ${input.value.trim()}` });
      st.textContent = how === 'api' ? t('joined') : t('sent');
      if (how === 'api') news.reset();
    } catch {
      st.textContent = fill(t('failed'), { email: site.email });
    }
  });
  $$('input, textarea', document).forEach((f) => f.addEventListener('input', () => f.classList.remove('is-bad')));
}

/* ═════════ Where to buy ═════════ */
function whereToBuy() {
  $('#zipForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const zip = $('#zip').value.trim();
    const out = $('#zipResult');
    if (!/^\d{5}(-\d{4})?$/.test(zip)) {
      out.textContent = t('zipBad');
      return;
    }
    const near = stores.filter((s) => s.zip.slice(0, 3) === zip.slice(0, 3));
    out.innerHTML = near.length
      ? `<p>${fill(t('zipFound'), { zip })}</p><ul>${near.map((s) => `<li><b>${s.name}</b> — ${s.city}${s.url ? ` · <a href="${s.url}" target="_blank" rel="noopener">↗</a>` : ''}</li>`).join('')}</ul>`
      : `<p>${fill(t('zipNone'), { zip })}</p>`;
    if (!reduced) gsap.from(out, { y: 10, opacity: 0, duration: 0.5 });
  });
  const req = $('#requestStore');
  const setHref = () => (req.href = `mailto:?subject=${encodeURIComponent(t('requestSubject'))}&body=${encodeURIComponent(`${t('requestBody')}\n\n${site.domain}`)}`);
  setHref();
  req.addEventListener('click', setHref);
}

/* ═════════ Scroll effects ═════════ */
function scrollFx() {
  if (reduced) return;
  $$('.reveal').forEach((el) =>
    gsap.to(el, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }),
  );
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.6, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true }, onUpdate: () => (el.textContent = Math.round(o.v)) });
  });
  $$('.panel').forEach((p) => {
    gsap.fromTo($('img', p), { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.from($('.panel__img', p), { clipPath: 'inset(18% 10% 18% 10% round 28px)', duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: p, start: 'top 80%', once: true } });
    gsap.from($$('.panel__txt > *', p), { y: 40, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out', scrollTrigger: { trigger: p, start: 'top 70%', once: true } });
  });
  gsap.from('.story__mark path', { xPercent: (i) => (i ? 40 : -40), yPercent: (i) => (i ? -30 : 30), opacity: 0, duration: 1.6, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.story', start: 'top 65%', once: true } });
  gsap.to('.story__bg img', { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.values li', { y: 20, opacity: 0, stagger: 0.07, duration: 0.7, ease: 'back.out(2)', scrollTrigger: { trigger: '.values', start: 'top 90%', once: true } });
  gsap.from('.community__grid a', { y: 60, opacity: 0, stagger: 0.07, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.community__grid', start: 'top 85%', once: true } });
  gsap.from('.retail__inner > *', { y: 50, opacity: 0, stagger: 0.12, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '.retail', start: 'top 70%', once: true } });
  gsap.from('.footer__big .wordmark', { yPercent: 60, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.footer', start: 'top 85%', once: true } });
  $$('.h2').forEach((h) => gsap.from(h, { y: 50, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 88%', once: true } }));
}

function magnetic() {
  if (!finePointer || reduced) return;
  $$('.magnetic').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.25);
      y((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}

/* ═════════ Language-dependent parts ═════════ */
function rerender() {
  applyLang();
  marquee();
  manifesto();
  productCards();
  productScroll();
  calc();
  recipeCards();
  const open = $('#drawer:not([hidden]) #drawerTitle');
  if (open) $('#drawer').hidden = true;
  if (!$('#recipeModal').hidden) $('#recipeModal').hidden = true;
  $$('.drawer').forEach((d) => d.classList.remove('is-open'));
  lockScroll(false);
  ScrollTrigger.refresh();
}

/* ═════════ Boot ═════════ */
wireStatic();
jsonLd();
applyLang();
smoothScroll();
nav();
productCards();
calc();
recipeCards();
recipesUI();
galleryGrid();
forms();
whereToBuy();
layers();
marquee();
manifesto();
productScroll();
hero();
scrollFx();
magnetic();
intro();

desktop.addEventListener('change', () => {
  productScroll();
  ScrollTrigger.refresh();
});
window.addEventListener('load', () => ScrollTrigger.refresh());
