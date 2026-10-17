// Soluciones, Cómo trabajamos y Nosotros.
import { ScrollTrigger, lenis } from './core.js';

/* Barra de capítulos: marca la sección que estás viendo */
const links = [...document.querySelectorAll('.chapters a')];
links.forEach((a) => {
  const sec = document.querySelector(a.getAttribute('href'));
  if (!sec) return;
  ScrollTrigger.create({
    trigger: sec, start: 'top 50%', end: 'bottom 50%',
    onToggle: (st) => {
      if (!st.isActive) return;
      links.forEach((l) => l.classList.toggle('on', l === a));
      const bar = a.parentElement;
      bar.scrollTo({ left: a.offsetLeft - bar.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
    },
  });
});

/* Cómo trabajamos: el número grande sigue al paso que estás leyendo */
const num = document.querySelector('.flow-num');
const label = document.querySelector('.flow-label');
document.querySelectorAll('.flow-step').forEach((step) => {
  ScrollTrigger.create({
    trigger: step, start: 'top 60%', end: 'bottom 40%',
    onToggle: (st) => {
      step.classList.toggle('on', st.isActive);
      if (st.isActive && num) {
        num.textContent = step.dataset.n;
        label.textContent = step.dataset.label;
      }
    },
  });
});

// Al abrir una pregunta cambia el alto de la página.
document.querySelectorAll('.faq details').forEach((d) => d.addEventListener('toggle', () => { ScrollTrigger.refresh(); lenis?.resize(); }));
