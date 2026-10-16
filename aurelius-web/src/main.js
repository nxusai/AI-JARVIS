import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import {
  site, wa, mapsUrl, wazeUrl, provinces, fireLevels, ranks, conquests, laws, gallery, carta,
} from './data.js';
import { icons, laurel, flag, svgInstagram, svgFacebook, svgTiktok, svgWhatsApp } from './icons.js';
import { embers } from './embers.js';
import { mountOracle } from './oraculo.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ═════════ Datos → enlaces ═════════ */
function wireLinks() {
  $$('[data-wa]').forEach((a) => {
    a.href = wa(a.dataset.wa);
    a.target = '_blank';
    a.rel = 'noopener';
  });
  $$('[data-maps]').forEach((a) => Object.assign(a, { href: mapsUrl, target: '_blank', rel: 'noopener' }));
  $$('[data-waze]').forEach((a) => Object.assign(a, { href: wazeUrl, target: '_blank', rel: 'noopener' }));
  $$('[data-tel]').forEach((a) => (a.href = `tel:+${site.phoneIntl}`));
  $$('[data-ig]').forEach((a) => Object.assign(a, { href: site.instagram, target: '_blank', rel: 'noopener' }));

  const social = [
    [site.instagram, 'Instagram', svgInstagram],
    [site.facebook, 'Facebook', svgFacebook],
    [site.tiktok, 'TikTok', svgTiktok],
    [wa('Hola Aurelius 👋'), 'WhatsApp', svgWhatsApp],
  ].filter(([href]) => href);
  $('#social').innerHTML = social
    .map(([href, label, svg]) => `<a href="${href}" target="_blank" rel="noopener" aria-label="${label}">${svg}</a>`)
    .join('');
  $('#year').textContent = new Date().getFullYear();
}

/* ═════════ SEO: datos estructurados ═════════ */
function jsonLd() {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pad = (h) => `${String(h % 24).padStart(2, '0')}:00`;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: 'Aurelius Coacalco',
    alternateName: 'Aurelius · La conquista del come todo',
    image: ['https://www.aurelius.mx/img/og.jpg'],
    logo: 'https://www.aurelius.mx/img/icon-512.png',
    url: 'https://www.aurelius.mx/',
    telephone: `+${site.phoneIntl}`,
    servesCuisine: ['Mexicana', 'Tacos', 'Alitas', 'Hamburguesas'],
    priceRange: '$',
    acceptsReservations: true,
    slogan: site.slogan,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: 'MX',
    },
    openingHoursSpecification: site.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days.map((d) => dayNames[d]),
      opens: pad(h.open),
      closes: h.close >= 24 ? '23:59' : pad(h.close),
    })),
    makesOffer: {
      '@type': 'Offer',
      name: `Come todo $${site.price}`,
      price: site.price,
      priceCurrency: 'MXN',
    },
    sameAs: [site.instagram, site.facebook, site.tiktok].filter(Boolean),
  };
  $('#ld-json').textContent = JSON.stringify(data);
}

/* ═════════ Ruta de la conquista ═════════ */
function renderRoute() {
  const track = $('#routeTrack');
  track.innerHTML =
    provinces
      .map(
        (p) => `
      <article class="province" id="prov-${p.id}">
        <span class="province__num" aria-hidden="true">${p.numeral}</span>
        <div class="province__bg" aria-hidden="true">${icons[p.icon]}</div>
        <div class="province__icon">${icons[p.icon]}</div>
        <p class="province__lore">Provincia ${p.numeral} · ${p.lore}</p>
        <h3>${p.name}</h3>
        <ul class="chips">${p.items.map((i) => `<li>${i}</li>`).join('')}</ul>
        <p class="province__quip">${p.quip}</p>
      </article>`,
      )
      .join('') +
    `<article class="province province--final">
        <div class="laurel-big">${laurel({ leaves: 8, size: 120 })}</div>
        <h3>¿Llegaste hasta aquí?<br>Ya eres César.</h3>
        <p>Siete provincias, un solo tributo de $${site.price}. Ahora conquístalas en persona.</p>
        <a class="btn btn--gold" href="${mapsUrl}" target="_blank" rel="noopener"><span>Ir a conquistar</span></a>
      </article>`;
  $('#routeStops').innerHTML = provinces
    .map((p, i) => `<span class="route__stop" data-i="${i}">${p.numeral}</span>`)
    .join('') + '<span class="route__stop" data-i="7">★</span>';
}

/* ═════════ Choose your fire ═════════ */
function mountFire() {
  const range = $('#fireRange');
  const ticks = $('#fireTicks');
  ticks.innerHTML = fireLevels.map((f, i) => `<button type="button" data-i="${i}">${f.name}</button>`).join('');
  const glow = $('#fireGlow');
  const flame = $('#fireFlame');
  const set = (i) => {
    const f = fireLevels[i];
    $('#fireLevel').textContent = f.name;
    $('#fireSauce').textContent = f.sauce;
    $('#fireText').textContent = f.text;
    $$('button', ticks).forEach((b, j) => b.classList.toggle('is-on', j === i));
    flame.style.transform = `scale(${0.7 + i * 0.16})`;
    glow.style.opacity = 0.25 + i * 0.2;
    glow.style.transform = `translate(-50%, -50%) scale(${0.8 + i * 0.15})`;
    if (!reduced) gsap.fromTo('#fireLevel', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' });
  };
  range.addEventListener('input', () => set(+range.value));
  ticks.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    range.value = b.dataset.i;
    set(+b.dataset.i);
  });
  set(+range.value);
}

/* ═════════ El coliseo (juego) ═════════ */
function mountArena() {
  const counts = Object.fromEntries(provinces.map((p) => [p.id, 0]));
  const box = $('#arenaButtons');
  box.innerHTML = provinces
    .map(
      (p) => `
      <button class="food-btn" type="button" data-id="${p.id}" aria-label="Agregar una orden de ${p.name}">
        ${icons[p.icon]}
        <span><b>${p.name}</b><small>+1 orden</small></span>
        <span class="badge" aria-hidden="true">0</span>
      </button>`,
    )
    .join('');
  const plate = $('#arenaPlate');
  let lastRank = 0;

  const total = () => Object.values(counts).reduce((a, b) => a + b, 0);
  const update = () => {
    const n = total();
    $('#arenaCount').textContent = n;
    let idx = 0;
    ranks.forEach((r, i) => n >= r.min && (idx = i));
    const r = ranks[idx];
    const next = ranks[idx + 1];
    const nameEl = $('#arenaRank');
    nameEl.textContent = r.name;
    $('#arenaRankText').textContent = r.text;
    const pct = next ? ((n - r.min) / (next.min - r.min)) * 100 : 100;
    $('#arenaBar').style.width = `${pct}%`;
    $('#arenaNext').textContent = next
      ? `Te faltan ${next.min - n} órdenes para ser ${next.name}.`
      : 'Rango máximo. El imperio se inclina ante ti.';
    if (idx > lastRank) {
      nameEl.classList.remove('rank-pop');
      void nameEl.offsetWidth;
      nameEl.classList.add('rank-pop');
    }
    lastRank = idx;
  };

  box.addEventListener('click', (e) => {
    const b = e.target.closest('.food-btn');
    if (!b) return;
    const id = b.dataset.id;
    counts[id]++;
    const badge = $('.badge', b);
    badge.textContent = counts[id];
    badge.classList.add('is-on');
    // icono que vuela al plato
    const p = provinces.find((x) => x.id === id);
    const f = document.createElement('div');
    f.className = 'flying';
    f.innerHTML = icons[p.icon];
    plate.appendChild(f);
    const pw = plate.clientWidth;
    const n = plate.children.length;
    const x = 10 + Math.random() * (pw - 56);
    const y = Math.max(0, 94 - Math.floor(n / 9) * 14);
    if (reduced) gsap.set(f, { x, y });
    else gsap.fromTo(f, { x: pw / 2, y: -40, rotate: -90, scale: 0.4, opacity: 0 }, { x, y, rotate: Math.random() * 40 - 20, scale: 1, opacity: 1, duration: 0.7, ease: 'bounce.out' });
    if (plate.children.length > 45) plate.firstElementChild.remove();
    update();
  });

  $('#arenaReset').addEventListener('click', () => {
    Object.keys(counts).forEach((k) => (counts[k] = 0));
    $$('.badge', box).forEach((b) => { b.textContent = 0; b.classList.remove('is-on'); });
    plate.innerHTML = '';
    lastRank = 0;
    update();
  });

  $('#arenaShare').addEventListener('click', async () => {
    const n = total();
    const r = $('#arenaRank').textContent;
    const text = `En el Coliseo de Aurelius conquisté ${n} órdenes y soy ${r} 👑. ¿Me superas? Come todo $${site.price} en Aurelius Coacalco.`;
    const url = location.href.split('#')[0] + '#coliseo';
    if (navigator.share) {
      try { await navigator.share({ title: 'Aurelius · El Coliseo', text, url }); return; } catch { /* cancelado */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
  });
  update();
}

/* ═════════ Próximas conquistas ═════════ */
function renderConquests() {
  const label = { done: 'Conquistado', next: 'En campaña', soon: 'Próximamente', vote: 'Tu voto' };
  $('#conquestGrid').innerHTML = conquests
    .map((c) => {
      const btn =
        c.status === 'done'
          ? `<a class="btn btn--ghost btn--sm" href="#ruta"><span>Ver la ruta</span></a>`
          : c.status === 'vote'
            ? `<a class="btn btn--gold btn--sm" href="${wa('¡Hola Aurelius! Quiero proponer que conquisten la comida de: ')}" target="_blank" rel="noopener"><span>Proponer país</span></a>`
            : `<a class="btn btn--ghost btn--sm" href="${wa(`¡Voto por que Aurelius conquiste ${c.country}! 🗳️`)}" target="_blank" rel="noopener"><span>Votar por ${c.country}</span></a>`;
      return `
      <article class="country country--${c.status} reveal">
        <span class="country__status country__status--${c.status}">${label[c.status]}</span>
        <div class="country__flag">${flag(c.flag)}</div>
        <h3>${c.country}</h3>
        <p class="country__dishes">${c.dishes}</p>
        <p>${c.text}</p>
        ${btn}
      </article>`;
    })
    .join('');
}

/* ═════════ Galería + lightbox ═════════ */
function renderGallery() {
  const g = $('#gallery');
  g.innerHTML = gallery
    .map(
      (s, i) => `
      <figure class="shot" style="aspect-ratio:${s.w}/${s.h}">
        <img src="${s.src}" alt="${s.alt}" width="${s.w}" height="${s.h}" loading="lazy" draggable="false" />
        <figcaption>${s.caption}</figcaption>
        <button type="button" data-i="${i}" aria-label="Ampliar foto: ${s.alt}"></button>
      </figure>`,
    )
    .join('');

  // arrastrar con el mouse en escritorio
  let down = false, startX = 0, startScroll = 0, moved = false;
  g.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = true; moved = false; startX = e.clientX; startScroll = g.scrollLeft;
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 5) { moved = true; g.classList.add('is-drag'); }
    g.scrollLeft = startScroll - dx;
  });
  window.addEventListener('pointerup', () => { down = false; g.classList.remove('is-drag'); });

  const lb = $('#lightbox');
  const open = (i) => {
    const s = gallery[i];
    $('img', lb).src = s.src;
    $('img', lb).alt = s.alt;
    $('figcaption', lb).textContent = s.caption;
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    $('.lightbox__close', lb).focus();
  };
  const close = () => { lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); };
  g.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b && !moved) open(+b.dataset.i);
  });
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.lightbox__close')) close(); });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && close());
}

/* ═════════ Carta, leyes, visita ═════════ */
function renderInfo() {
  $('#carta').innerHTML = carta.map((c) => `<li><b>${c.name}</b><span>${c.text}</span></li>`).join('');

  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  $('#laws').innerHTML = laws
    .map(
      (l, i) => `
      <div class="law${i === 0 ? ' is-open' : ''}">
        <button type="button" aria-expanded="${i === 0}" aria-controls="law-${i}">
          <span class="law__num">${romans[i]}</span><span class="law__q">${l.q}</span><span class="law__icon" aria-hidden="true"></span>
        </button>
        <div class="law__a" id="law-${i}" role="region"><div><p>${l.a}</p></div></div>
      </div>`,
    )
    .join('');
  $('#laws').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const law = b.parentElement;
    const open = !law.classList.contains('is-open');
    law.classList.toggle('is-open', open);
    b.setAttribute('aria-expanded', String(open));
    setTimeout(() => ScrollTrigger.refresh(), 520);
  });

  const a = site.address;
  $('#addr').textContent = `${a.street}, ${a.locality}, ${a.region}, C.P. ${a.postalCode}`;
  const today = new Date().getDay();
  $('#hours').innerHTML = site.hours
    .map((h) => `<span class="hours-row${h.days.includes(today) ? ' is-today' : ''}"><span>${h.label}</span><span>${h.text}</span></span>`)
    .join('');
  $('#phoneLink').textContent = site.phoneDisplay;
  $('#mapFrame').src = `https://www.google.com/maps?q=${encodeURIComponent(site.mapsQuery)}&output=embed&hl=es`;

  // ¿abierto ahora? (hora de Ciudad de México)
  const status = $('#openStatus');
  const mx = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const d = mx.getDay();
  const hr = mx.getHours() + mx.getMinutes() / 60;
  const prev = (d + 6) % 7;
  const isOpen = site.hours.some(
    (h) => (h.days.includes(d) && hr >= h.open && hr < h.close) || (h.days.includes(prev) && h.close > 24 && hr < h.close - 24),
  );
  status.classList.add(isOpen ? 'is-open' : 'is-closed');
  status.lastChild.textContent = isOpen ? 'Abierto ahora · la conquista está en curso' : 'Cerrado ahora · descansa, guerrero';
}

/* ═════════ Preloader ═════════ */
function runLoader() {
  const loader = $('#loader');
  $('[data-laurel]', loader).innerHTML = laurel({ leaves: 11, size: 170 });
  $$('.loader__laurel path').forEach((p, i) => (p.style.animationDelay = `${i * 0.04}s`));
  const lines = ['Calentando el comal…', 'Afilando las espadas…', 'Convenciendo al pollo…', 'Desabrochando cinturones…', 'Preparando la conquista…'];
  const line = $('#loaderLine');
  let li = 0;
  const iv = setInterval(() => (line.textContent = lines[++li % lines.length]), 380);
  const state = { p: 0 };
  return new Promise((resolve) => {
    const finish = () => {
      clearInterval(iv);
      line.textContent = '¡Que comience la conquista!';
      gsap.to(loader, {
        clipPath: 'inset(0 0 100% 0)', duration: reduced ? 0.01 : 0.9, ease: 'power4.inOut', delay: 0.15,
        onComplete: () => { loader.remove(); document.body.classList.remove('is-loading'); resolve(); },
      });
    };
    const ready = Promise.all([document.fonts?.ready, new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r)))]);
    gsap.to(state, {
      p: 82, duration: reduced ? 0.01 : 1.1, ease: 'power2.out',
      onUpdate: () => { $('#loaderPct').textContent = Math.round(state.p); $('#loaderBar').style.width = `${state.p}%`; },
    });
    Promise.race([ready, new Promise((r) => setTimeout(r, 3500))]).then(() => {
      gsap.to(state, {
        p: 100, duration: reduced ? 0.01 : 0.45, ease: 'power2.inOut', delay: reduced ? 0 : 0.6,
        onUpdate: () => { $('#loaderPct').textContent = Math.round(state.p); $('#loaderBar').style.width = `${state.p}%`; },
        onComplete: finish,
      });
    });
  });
}

/* ═════════ Nav, drawer, cursor, magnetismo ═════════ */
function mountChrome(lenis) {
  const nav = $('#nav');
  const burger = $('#burger');
  const drawer = $('#drawer');
  const setDrawer = (open) => {
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    $$('a', drawer).forEach((a, i) => (a.style.transitionDelay = open ? `${0.15 + i * 0.05}s` : '0s'));
    open ? lenis?.stop() : lenis?.start();
  };
  burger.addEventListener('click', () => setDrawer(!drawer.classList.contains('is-open')));

  // anclas con scroll suave
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = $(id);
    if (!target) return;
    e.preventDefault();
    setDrawer(false);
    if (lenis) lenis.scrollTo(target, { offset: id === '#inicio' ? 0 : -20, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  });

  // ocultar nav al bajar, mostrar al subir; barra de progreso; dock móvil
  let lastY = 0;
  const dock = $('#dock');
  const oracleBtn = $('#oracleBtn');
  const progress = $('#progressBar');
  const onScroll = (y) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle('is-hidden', y > lastY && y > 300 && !drawer.classList.contains('is-open'));
    const past = y > innerHeight * 0.6;
    dock.classList.toggle('is-visible', past);
    oracleBtn.classList.toggle('is-visible', past);
    lastY = y;
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
  else addEventListener('scroll', () => onScroll(scrollY), { passive: true });

  if (!finePointer || reduced) return;

  // cursor dorado
  const cursor = $('#cursor');
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
  addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); });
  document.addEventListener('pointerover', (e) => cursor.classList.toggle('is-hover', !!e.target.closest('a, button, input, .shot')));

  // botones magnéticos
  $$('.magnetic').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    const my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - r.left - r.width / 2) * 0.3);
      my((e.clientY - r.top - r.height / 2) * 0.4);
    });
    el.addEventListener('pointerleave', () => { mx(0); my(0); });
  });

  // tarjetas con inclinación 3D
  $$('.tilt').forEach((el) => {
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 12);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 12);
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });

  // el escudo del hero sigue al mouse
  const crest = $('#crest');
  const logo = $('.hero__logo');
  const coin = $('.coin');
  const lx = gsap.quickTo(logo, 'x', { duration: 1, ease: 'power3' });
  const ly = gsap.quickTo(logo, 'y', { duration: 1, ease: 'power3' });
  const cx = gsap.quickTo(coin, 'x', { duration: 1.2, ease: 'power3' });
  const cy = gsap.quickTo(coin, 'y', { duration: 1.2, ease: 'power3' });
  $('#inicio').addEventListener('pointermove', (e) => {
    const r = crest.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
    const dy = (e.clientY - (r.top + r.height / 2)) / innerHeight;
    lx(dx * 30); ly(dy * 30); cx(dx * -50); cy(dy * -50);
  });
}

// Enlace activo del nav. Se crea después del pin de la ruta para
// que ScrollTrigger calcule las posiciones con el espacio del pin.
function navActive() {
  $$('.nav__links a').forEach((a) => {
    const sec = $(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: ({ isActive }) => a.classList.toggle('is-active', isActive),
    });
  });
}

/* ═════════ Animaciones con scroll ═════════ */
function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
          else {
            const s = document.createElement('span');
            s.className = 'word';
            s.textContent = part;
            frag.appendChild(s);
          }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
  return $$('.word', el);
}

function animate() {
  // hero: entrada
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.from('.hero__title .line > span', { yPercent: 110, duration: 1.1, stagger: 0.09 })
    .from('.kicker, .hero__sub, .hero__ctas', { y: 30, opacity: 0, duration: 0.9, stagger: 0.1 }, '-=0.7')
    .from('.hero__logo', { scale: 0.6, opacity: 0, rotate: -8, duration: 1.3, ease: 'expo.out' }, 0.1)
    .from('.coin', { scale: 0, rotate: -180, duration: 1.2, ease: 'back.out(1.6)' }, 0.6)
    .from('.hero__halo', { scale: 0.3, opacity: 0, duration: 1.4 }, 0.1);

  // hero: parallax al salir
  gsap.to('.hero__bg img', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__ghost', { xPercent: -12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.hero__crest', { yPercent: 18, scale: 0.92, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // marquesinas infinitas que aceleran con el scroll
  $$('[data-marquee]').forEach((track) => {
    const dir = +track.dataset.marquee;
    const parent = track.parentElement;
    for (let i = 0; i < 3; i++) parent.appendChild(track.cloneNode(true));
    const tracks = $$('.marquee__track', parent);
    const tween = gsap.fromTo(tracks, { xPercent: dir > 0 ? 0 : -100 }, { xPercent: dir > 0 ? -100 : 0, duration: 22, ease: 'none', repeat: -1 });
    ScrollTrigger.create({
      trigger: parent, start: 'top bottom', end: 'bottom top',
      onUpdate: (self) => {
        const v = Math.min(Math.abs(self.getVelocity()) / 400, 5);
        gsap.to(tween, { timeScale: 1 + v, duration: 0.2, overwrite: true });
        gsap.to(tween, { timeScale: 1, duration: 1, delay: 0.25 });
      },
    });
  });

  // manifiesto: palabras que se encienden
  const words = splitWords($('#manifestoText'));
  gsap.to(words, {
    opacity: 1, stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: '.manifesto', start: 'top 70%', end: 'bottom 75%', scrub: true },
  });

  // contadores
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const o = { v: end === 0 ? 99 : 0 };
    gsap.to(o, {
      v: end, duration: 1.6, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => (el.textContent = Math.round(o.v)),
    });
  });

  // apariciones genéricas
  const revealSel = '.section-head, .act, .tablet, .chapter, .law, .delivery__img, .carta li, .visit__info, .visit__map, .legion__inner, .fire__card, .arena__panel, .food-btn, .story__frame, .stat';
  $$(revealSel).forEach((el) => {
    gsap.from(el, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  ScrollTrigger.batch('.country', {
    start: 'top 88%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' }),
  });
  gsap.set('.country', { y: 50 });

  // galería: revelado con máscara
  $$('.shot').forEach((s, i) => {
    gsap.fromTo(s, { clipPath: 'inset(100% 0 0 0)' }, {
      clipPath: 'inset(0% 0 0 0)', duration: 1.2, ease: 'power4.inOut', delay: (i % 4) * 0.08,
      scrollTrigger: { trigger: '#gallery', start: 'top 85%', once: true },
    });
  });

  // historia: rayo + parallax de la estatua
  ScrollTrigger.create({
    trigger: '.story', start: 'top 60%', once: true,
    onEnter: () => gsap.timeline()
      .to('.story__flash', { opacity: 1, duration: 0.08 })
      .to('.story__flash', { opacity: 0, duration: 0.12 })
      .to('.story__flash', { opacity: 0.8, duration: 0.06 })
      .to('.story__flash', { opacity: 0, duration: 0.6 }),
  });
  gsap.fromTo('.story__frame img', { yPercent: 8 }, { yPercent: -4, ease: 'none', scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: true } });

  // footer: AURELIUS gigante
  gsap.from('.footer__big', { yPercent: 40, opacity: 0, duration: 1.4, ease: 'power4.out', scrollTrigger: { trigger: '.footer', start: 'top 85%', once: true } });

  // ruta: scroll horizontal en escritorio
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', () => {
    const track = $('#routeTrack');
    const stops = $$('.route__stop');
    const dist = () => track.scrollWidth - innerWidth;
    const st = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '#routePin', start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (self) => {
          $('#routeFill').style.transform = `scaleX(${self.progress})`;
          const active = Math.round(self.progress * (stops.length - 1));
          stops.forEach((s, i) => s.classList.toggle('is-on', i <= active));
        },
      },
    });
    // ligera inclinación de cada tarjeta mientras viaja
    $$('.province', track).forEach((card) => {
      gsap.fromTo(card, { rotateY: 14, scale: 0.92 }, {
        rotateY: -6, scale: 1, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: st, start: 'left right', end: 'center center', scrub: true },
      });
    });
    return () => gsap.set(track, { clearProps: 'all' });
  });
  mm.add('(max-width: 760px)', () => {
    $$('.province').forEach((card) => {
      gsap.from(card, { y: 60, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 90%', once: true } });
    });
  });
}

/* ═════════ Inicio ═════════ */
async function init() {
  wireLinks();
  jsonLd();
  renderRoute();
  mountFire();
  mountArena();
  renderConquests();
  renderGallery();
  renderInfo();
  mountOracle();

  let lenis = null;
  if (!reduced) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  mountChrome(lenis);
  embers($('#embers'), { density: innerWidth < 760 ? 0.6 : 1 });

  await runLoader();
  lenis?.start();
  if (reduced) {
    gsap.set('.country', { opacity: 1, y: 0 });
    $$('.word').forEach((w) => (w.style.opacity = 1));
  } else animate();
  navActive();
  ScrollTrigger.refresh();
  if (location.hash && $(location.hash)) setTimeout(() => (lenis ? lenis.scrollTo(location.hash, { immediate: true }) : $(location.hash).scrollIntoView()), 50);
}

init();
