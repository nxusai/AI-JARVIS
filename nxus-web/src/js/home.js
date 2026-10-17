import { gsap, ScrollTrigger, reduced } from './core.js';
import { createOrb } from './orb.js';
import { createChat } from './chat.js';
import { reply } from './replies.js';

/* 1 · La esfera se convierte en el logo mientras el héroe está fijo */
const orb = createOrb(document.querySelector('.orb'));
const heroA = document.querySelector('.hero-a');
const heroB = document.querySelector('.hero-b');
const hint = document.querySelector('.scroll-hint');
const clamp = (v) => Math.min(1, Math.max(0, v));
ScrollTrigger.create({
  trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: true,
  onUpdate: ({ progress: p }) => {
    orb.setProgress(clamp((p - .12) / .6));
    const a = clamp(p / .3);
    heroA.style.opacity = 1 - a;
    heroA.style.transform = `scale(${1 - a * .08}) translateY(${-a * 40}px)`;
    heroA.style.filter = `blur(${a * 8}px)`;
    heroA.style.pointerEvents = a > .5 ? 'none' : '';
    hint.style.opacity = 1 - clamp(p / .08);
    const b = clamp((p - .72) / .2);
    heroB.style.opacity = b;
    heroB.style.transform = `translateY(${(1 - b) * 30}px)`;
  },
});

/* 3 · El teléfono de muestra: una conversación que se repite, y responde si le escriben */
const phone = document.querySelector('.tease-phone .phone');
const chat = createChat(phone);
const SCRIPT = [
  { clear: true, day: 'Hoy' },
  { me: 'Buenos días {name} ☀️ ¿cómo amanecimos?', wait: 900 },
  { ai: 'Buenos días, jefe. Ayer cerramos en **$52,400** (+12%) y quedaron 3 pendientes:' },
  { ai: '1. Confirmar pedido de La Esquina\n2. Aprobar el post de hoy\n3. Firmar la orden de compra' },
  { me: { voice: 'Confirma lo de La Esquina y enséñame el post', dur: '0:04' } },
  { ai: '[ok]Pedido #4821 confirmado[/ok] ✅ Aquí está el post:' },
  { ai: { image: 'gen-a', label: 'post · 1080×1350', text: '“Fin de semana 2x1 🔥” — sale a las 7 pm' } },
  { keys: ['✅ Aprobar', '🔁 Otra versión'], pick: 0, then: [[{ ai: 'Programado en Instagram, Facebook y TikTok 📅' }], [{ ai: 'Te preparo 3 versiones nuevas 🎨' }]] },
];
chat.play(SCRIPT, { loop: true });
phone.querySelector('.tg-input').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = e.target.querySelector('input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  chat.say(text, reply);
});

/* 5 · Un día con tu IA: scroll horizontal en pantallas anchas */
const mm = gsap.matchMedia();
mm.add('(min-width: 761px)', () => {
  if (reduced) return;
  const track = document.querySelector('.day-track');
  const dist = () => track.scrollWidth - innerWidth + 0;
  gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: { trigger: '#day', pin: '.day-pin', start: 'top top', end: () => `+=${dist()}`, scrub: 1, invalidateOnRefresh: true },
  });
  gsap.from('.day-card', { opacity: .25, scale: .94, stagger: .1, scrollTrigger: { trigger: '#day', start: 'top 60%', end: 'top top', scrub: true } });
});
