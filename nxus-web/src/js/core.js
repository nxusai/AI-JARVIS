// Lo que comparten todas las páginas: scroll suave, menú, telón entre páginas,
// apariciones al hacer scroll y el nombre que el visitante le pone a su IA.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;

/* ---------- Scroll suave ---------- */
export const lenis = reduced ? null : new Lenis({ duration: 1.15, smoothWheel: true });
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------- Barra de menú ---------- */
const nav = document.getElementById('nav');
const page = document.body.dataset.page;
document.querySelectorAll(`[data-nav="${page}"]`).forEach((a) => a.setAttribute('aria-current', 'page'));
const bar = document.querySelector('.progress-bar');
let lastY = 0;
const onScroll = () => {
  const y = scrollY;
  nav.classList.toggle('scrolled', y > 10);
  nav.classList.toggle('hidden', y > 400 && y > lastY + 2 && !document.body.classList.contains('menu-open'));
  if (y < lastY - 2) nav.classList.remove('hidden');
  lastY = y;
  const max = document.documentElement.scrollHeight - innerHeight;
  bar?.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const burger = document.querySelector('.burger');
burger?.addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  open ? lenis?.stop() : lenis?.start();
});

/* ---------- Telón entre páginas ---------- */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.hash && url.pathname === location.pathname) return;
  if (url.pathname === location.pathname) return;
  e.preventDefault();
  root.classList.add('leaving');
  setTimeout(() => { location.href = url.href; }, 420);
});
// Volver con el botón "atrás" desde la caché del navegador no debe dejar el telón puesto.
addEventListener('pageshow', (e) => { if (e.persisted) root.classList.remove('leaving'); });

/* ---------- Anclas dentro de la página, con scroll suave ---------- */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const target = document.querySelector(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(target, { offset: -100 });
  else target.scrollIntoView({ behavior: 'smooth' });
  history.replaceState(null, '', a.getAttribute('href'));
});

/* ---------- Palabras que suben al aparecer ---------- */
function split(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((w) => {
          if (!w) return;
          if (/^\s+$/.test(w)) return frag.append(' ');
          const outer = document.createElement('span');
          outer.className = 'split-w';
          const inner = document.createElement('span');
          inner.textContent = w;
          outer.append(inner);
          frag.append(outer);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  el.querySelectorAll('.split-w > span').forEach((s, i) => s.style.setProperty('--i', i));
}
document.querySelectorAll('[data-split]').forEach(split);

/* ---------- Apariciones ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
export const observe = (scope = document) => scope.querySelectorAll('[data-reveal], [data-split]').forEach((el) => io.observe(el));
observe();

/* ---------- Texto que se enciende palabra por palabra al hacer scroll ---------- */
document.querySelectorAll('[data-scrub]').forEach((el) => {
  const hl = (el.dataset.scrub || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="scrub-w${hl.some((h) => w.toLowerCase().includes(h)) ? ' hl' : ''}">${w}</span>`).join(' ');
  const spans = el.querySelectorAll('.scrub-w');
  if (reduced) return spans.forEach((s) => s.classList.add('on'));
  ScrollTrigger.create({
    trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true,
    onUpdate: (st) => {
      const n = Math.round(st.progress * spans.length);
      spans.forEach((s, i) => s.classList.toggle('on', i < n));
    },
  });
});

/* ---------- Brillo que sigue al cursor ---------- */
document.addEventListener('pointermove', (e) => {
  const c = e.target.closest?.('.glow');
  if (!c) return;
  const r = c.getBoundingClientRect();
  c.style.setProperty('--mx', `${e.clientX - r.left}px`);
  c.style.setProperty('--my', `${e.clientY - r.top}px`);
});

/* ---------- Botones magnéticos ---------- */
if (matchMedia('(hover: hover)').matches && !reduced) {
  document.querySelectorAll('[data-magnetic]').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * .25, y: (e.clientY - r.top - r.height / 2) * .35, duration: .4, ease: 'power3.out' });
    });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: .7, ease: 'elastic.out(1, .4)' }));
  });
}

/* ---------- Contadores ---------- */
document.querySelectorAll('[data-count]').forEach((el) => {
  const to = Number(el.dataset.count);
  const obj = { v: 0 };
  ScrollTrigger.create({
    trigger: el, start: 'top 90%', once: true,
    onEnter: () => gsap.to(obj, { v: to, duration: 1.8, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(obj.v); } }),
  });
});

/* ---------- Parallax ligero ---------- */
if (!reduced) {
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    gsap.to(el, { yPercent: Number(el.dataset.parallax) || -20, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/* ---------- El nombre de tu IA ----------
   El visitante bautiza a su asistente en la página de Jarvis y el nombre lo sigue por todo el sitio. */
const NAME_KEY = 'nxus-ai-name';
export const getName = () => {
  try { return localStorage.getItem(NAME_KEY) || 'Jarvis'; } catch { return 'Jarvis'; }
};
export function setName(name) {
  const clean = (name || '').replace(/[<>]/g, '').trim().slice(0, 18) || 'Jarvis';
  try { localStorage.setItem(NAME_KEY, clean); } catch {}
  paintName(clean);
  return clean;
}
export function paintName(name = getName()) {
  document.querySelectorAll('[data-ai-name]').forEach((el) => { el.textContent = name; });
  document.querySelectorAll('[data-ai-name-up]').forEach((el) => { el.textContent = name.toUpperCase(); });
}
paintName();

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

// Las imágenes y fuentes cambian alturas: recalcular los disparadores cuando todo cargó.
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
