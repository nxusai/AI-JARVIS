import { gsap, ScrollTrigger, reduced, getName, setName } from './core.js';
import { createChat } from './chat.js';
import { reply } from './replies.js';

/* ---------- A · Bautízalo ---------- */
const nameEl = document.querySelector('.j-name');
const input = document.getElementById('ai-name');
const chips = document.querySelectorAll('[data-pick]');
const markChip = (n) => chips.forEach((c) => c.classList.toggle('on', c.dataset.pick === n));
function baptize(n) {
  const name = setName(n);
  markChip(name);
  nameEl.classList.remove('pop');
  void nameEl.offsetWidth;
  nameEl.classList.add('pop');
}
input.value = getName() === 'Jarvis' ? '' : getName();
markChip(getName());
document.querySelector('.namer').addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value.trim()) baptize(input.value);
  input.blur();
});
// Mientras escribe, el nombre gigante cambia letra por letra.
input.addEventListener('input', () => { if (input.value.trim()) setName(input.value); else setName('Jarvis'); markChip(getName()); });
chips.forEach((c) => c.addEventListener('click', () => { input.value = c.dataset.pick; baptize(c.dataset.pick); }));

/* ---------- A2 · De 2008 a hoy ---------- */
const film = document.querySelector('.film');
const fy = film.querySelector('.fy');
const fsA = film.querySelector('.fs-a');
const fsB = film.querySelector('.fs-b');
const mode = film.querySelector('.hud-mode');
const pct = film.querySelector('.hud-pct');
const NOW = Math.max(2026, new Date().getFullYear());
const cl = (v) => Math.min(1, Math.max(0, v));
function filmAt(p) {
  const k = cl((p - .25) / .4);
  fy.textContent = Math.round(2008 + (NOW - 2008) * k);
  fsA.style.opacity = 1 - cl((p - .25) / .15);
  fsB.style.opacity = cl((p - .62) / .12);
  pct.textContent = String(Math.round(k * 100)).padStart(3, '0');
  const real = k >= 1;
  if (real !== film.classList.contains('real')) {
    film.classList.toggle('real', real);
    mode.textContent = real ? 'REALIDAD' : 'CIENCIA FICCIÓN';
  }
}
if (reduced) filmAt(1);
else ScrollTrigger.create({ trigger: film, start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: (st) => filmAt(st.progress) });

/* ---------- C · Telegram ---------- */
const SCENARIOS = {
  ventas: [
    { clear: true, day: 'Hoy' },
    { ai: '🔔 Entró un lead nuevo por Instagram: **Mariana López**, quiere cotización para 120 personas.' },
    { ai: 'Ya le contesté, le mandé el menú de eventos y me dio su presupuesto: $35,000.' },
    { me: '¿Qué le ofrecemos?', wait: 1200 },
    { ai: { doc: 'Cotización-Mariana-López.pdf', size: 'Paquete Premium · $34,800', text: 'Te armé esta cotización con el paquete Premium y 5% de descuento por pagar este mes.' } },
    { keys: ['✅ Envíala', '✏️ Cambiar precio'], then: [[
      { ai: '[ok]Enviada por WhatsApp y correo.[/ok] Le agendé seguimiento para el jueves 11:00 📅' },
      { pause: 1500 },
      { ai: '💰 ¡Mariana aceptó! Ya pagó el anticipo de $10,440. Registrado en tu CRM.' },
    ], [{ ai: 'Dime el precio nuevo y la rehago en 10 segundos.' }]] },
  ],
  operacion: [
    { clear: true, day: 'Hoy' },
    { me: { voice: '¿Cómo vamos con los pedidos de hoy?', dur: '0:03' }, wait: 900 },
    { ai: 'Van **38 pedidos**: 31 entregados, 4 en ruta y 3 tarde en la ruta norte 🚚' },
    { ai: 'El retraso es por tráfico en la autopista. Ya avisé a los 3 clientes con su nueva hora.' },
    { ai: '⚠️ Otra cosa: el queso fresco alcanza solo para 2 días. ¿Le pido 40 cajas al proveedor?' },
    { keys: ['✅ Pídelas', '❌ Todavía no'], then: [[
      { ai: '[ok]Orden de compra enviada.[/ok] Llega el jueves. Ya imprimí las etiquetas de entrada 🏷️' },
    ], [{ ai: 'Va. Te lo vuelvo a recordar mañana a las 9.' }]] },
  ],
  marketing: [
    { clear: true, day: 'Hoy' },
    { me: 'Hazme el post de mañana para la promo 2x1', wait: 900 },
    { ai: 'Va. Usé las fotos de la sesión del lunes y tu paleta de marca 🎨' },
    { ai: { image: 'gen-a', label: 'post · 1080×1350', text: '“2x1 todo el fin de semana 🔥 Solo en sucursal.” #promo #findesemana' } },
    { ai: { image: 'gen-b', label: 'reel · 15 s', text: 'Y un reel corto con música en tendencia.' } },
    { keys: ['✅ Programar ambos', '🔁 Otra versión'], then: [[
      { ai: '[ok]Programados[/ok] en Instagram, Facebook y TikTok para mañana 7:00 pm 📅' },
      { ai: '¿Lo impulso con $500 en Meta Ads para tu zona? Calculo ~9,000 personas alcanzadas.' },
    ], [{ ai: 'Te hago 3 versiones con otro estilo. Dame un minuto.' }]] },
  ],
  finanzas: [
    { clear: true, day: 'Hoy' },
    { me: '¿Quién nos debe?', wait: 900 },
    { ai: 'Hay **4 facturas vencidas** por $23,900:\n• Distribuidora Luna — $9,800 (18 días)\n• Café Central — $6,200 (9 días)\n• 2 más por $7,900' },
    { ai: { chart: [30, 45, 38, 60, 52, 74, 81], text: 'Tu flujo de la semana viene 14% arriba. Te dejo el reporte en Drive.' } },
    { ai: 'Preparé un recordatorio amable para cada uno. ¿Los envío?' },
    { keys: ['✅ Envíalos', '👀 Revisar'], then: [[
      { ai: '[ok]Enviados.[/ok] Te aviso cuando entren los pagos y los concilio solo 💸' },
      { pause: 1600 },
      { ai: '💰 Café Central ya pagó $6,200. Factura marcada como pagada.' },
    ], [{ ai: 'Te los dejé como borrador en tu correo.' }]] },
  ],
  clientes: [
    { clear: true, day: 'Cliente · 23:47' },
    { me: 'Hola, ¿tienen servicio a domicilio a esta hora?', wait: 900 },
    { ai: '¡Hola! 🌙 Sí, entregamos hasta la 1:00 am en tu zona. ¿Qué se te antoja?' },
    { me: 'Dos combos familiares', wait: 1300 },
    { ai: 'Perfecto: 2 combos familiares = **$598**. Llegan en 35 min aprox. ¿A qué dirección?' },
    { me: 'Calle Roble 214, Col. Centro', wait: 1300 },
    { ai: '[ok]Pedido confirmado #4907[/ok] ✅ Te mando el link de pago y el seguimiento del repartidor.' },
    { ai: '(Y a ti, dueño, te dejo el resumen: 17 pedidos atendidos esta noche mientras dormías 😉)' },
  ],
};
const tgPhone = document.querySelector('.tg-phone .phone');
const chat = createChat(tgPhone);
const tabs = document.querySelectorAll('[data-scn]');
const playScenario = (k) => {
  tabs.forEach((t) => { t.classList.toggle('on', t.dataset.scn === k); t.setAttribute('aria-selected', t.dataset.scn === k); });
  chat.play(SCENARIOS[k]);
};
tabs.forEach((t) => t.addEventListener('click', () => playScenario(t.dataset.scn)));
ScrollTrigger.create({ trigger: '#telegram', start: 'top 70%', once: true, onEnter: () => playScenario('ventas') });
tgPhone.querySelector('.tg-input').addEventListener('submit', (e) => {
  e.preventDefault();
  const i = e.target.querySelector('input');
  const text = i.value.trim();
  if (!text) return;
  i.value = '';
  tabs.forEach((t) => t.classList.remove('on'));
  chat.say(text, reply);
});

/* ---------- D · Voz ----------
   Audio grabado con voz neuronal; el anillo se mueve con el volumen real del audio. */
const stage = document.querySelector('.voice-stage');
const vc = stage.querySelector('.voice-viz');
const vctx = vc.getContext('2d');
let level = 0, analyser = null, freq = null, playing = false;
function drawVoice(t) {
  requestAnimationFrame(drawVoice);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const s = vc.clientWidth;
  if (!s) return;
  if (vc.width !== s * dpr) { vc.width = s * dpr; vc.height = s * dpr; }
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vctx.clearRect(0, 0, s, s);
  let target = .06;
  if (playing && analyser) {
    analyser.getByteFrequencyData(freq);
    let sum = 0;
    for (let i = 2; i < 60; i++) sum += freq[i];
    target = Math.min(1, sum / 58 / 150);
  } else if (playing) target = .25 + Math.abs(Math.sin(t / 90) * Math.sin(t / 233)) * .75;
  level += (target - level) * .25;
  const c = s / 2, R = s * .3, bars = 120;
  const g = vctx.createRadialGradient(c, c, 0, c, c, s / 2);
  g.addColorStop(0, `rgba(10,108,255,${.12 + level * .25})`);
  g.addColorStop(.6, 'rgba(165,28,255,.04)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  vctx.fillStyle = g;
  vctx.fillRect(0, 0, s, s);
  vctx.lineCap = 'round';
  vctx.lineWidth = Math.max(1.5, s / 220);
  for (let i = 0; i < bars; i++) {
    const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const band = analyser && playing ? freq[4 + (i < bars / 2 ? i : bars - i) % 80] / 255 : Math.abs(Math.sin(i * .5 + t / 300) * .5 + Math.sin(i * 1.7 - t / 170) * .5);
    const len = 6 + band * s * .16 * Math.max(level, .15) + s * .01;
    const u = i / bars;
    vctx.strokeStyle = u < .5 ? `rgba(${Math.round(u * 20)},${Math.round(229 - u * 242)},255,.9)` : `rgba(${Math.round(10 + (u - .5) * 310)},${Math.round(108 - (u - .5) * 160)},255,.9)`;
    vctx.beginPath();
    vctx.moveTo(c + Math.cos(a) * R, c + Math.sin(a) * R);
    vctx.lineTo(c + Math.cos(a) * (R + len), c + Math.sin(a) * (R + len));
    vctx.stroke();
  }
  vctx.beginPath();
  vctx.arc(c, c, R * (.92 + level * .06), 0, Math.PI * 2);
  vctx.strokeStyle = `rgba(0,229,255,${.25 + level * .5})`;
  vctx.lineWidth = 2;
  vctx.stroke();
  const core = vctx.createRadialGradient(c, c, 0, c, c, R * .8);
  core.addColorStop(0, `rgba(255,255,255,${.2 + level * .6})`);
  core.addColorStop(.25, `rgba(0,229,255,${.2 + level * .4})`);
  core.addColorStop(1, 'rgba(10,108,255,0)');
  vctx.fillStyle = core;
  vctx.beginPath();
  vctx.arc(c, c, R * .8, 0, Math.PI * 2);
  vctx.fill();
}
requestAnimationFrame(drawVoice);

const LINES = [
  ['audio/voz-1.mp3', '¡Buenos días, jefe! Ya revisé todo. Ayer cerramos en $48,000, 12% arriba del martes pasado.'],
  ['audio/voz-2.mp3', 'Hoy tienes 3 pendientes y una reunión a las 4. ¿Te los leo, o prefieres que yo me encargue?'],
];
const audio = new Audio();
audio.preload = 'auto';
const log = document.querySelector('.voice-log');
const vbtns = document.querySelectorAll('.voice-btn, .voice-play');
const line = (who, text) => {
  const p = document.createElement('p');
  p.innerHTML = `<b>${who}:</b> `;
  p.append(text);
  log.append(p);
  while (log.children.length > 2) log.firstElementChild.remove();
};
function setPlaying(on) {
  playing = on;
  stage.classList.toggle('talking', on);
  vbtns.forEach((b) => b.querySelector('.vb-ic, .vp-ic').textContent = on ? '■' : '▶');
}
function playFile(src) {
  return new Promise((resolve) => {
    audio.src = src; // relativo a la página: /audio en el sitio, ./audio en la vista previa
    audio.onended = () => resolve(true);
    audio.onerror = () => resolve(false);
    audio.play().catch(() => resolve(false));
  });
}
let run = 0;
async function speak() {
  const id = ++run;
  if (!analyser) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      freq = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      analyser.connect(ctx.destination);
      ctx.resume?.();
    } catch { analyser = null; }
  }
  log.innerHTML = '';
  setPlaying(true);
  for (const [src, text] of LINES) {
    line(getName(), text);
    const ok = await playFile(src);
    if (id !== run || !ok) break;
  }
  if (id === run) setPlaying(false);
}
vbtns.forEach((b) => b.addEventListener('click', () => {
  if (playing) { run++; audio.pause(); setPlaying(false); return; }
  speak();
}));

/* ---------- E · Consola ---------- */
const svgNS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => { const n = document.createElementNS(svgNS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); parent?.append(n); return n; };
const DEPS = [
  { id: 'Marketing', ic: '📣', svcs: ['Instagram', 'Canva'] },
  { id: 'Publicidad', ic: '🎯', svcs: ['Meta Ads', 'Google Ads'] },
  { id: 'Ventas', ic: '💼', svcs: ['WhatsApp', 'CRM'] },
  { id: 'Operación', ic: '📦', svcs: ['Inventario', 'Etiquetas'] },
  { id: 'Finanzas', ic: '💸', svcs: ['Facturas', 'Stripe'] },
  { id: 'Atención', ic: '🤝', svcs: ['Telegram', 'Gmail'] },
];
const CX = 300, CY = 220;
const links = document.querySelector('.map-links');
const nodes = document.querySelector('.map-nodes');
const pulses = document.querySelector('.map-pulses');
DEPS.forEach((d, i) => {
  const a = (i / DEPS.length) * Math.PI * 2 - Math.PI / 2;
  d.x = CX + Math.cos(a) * 130; d.y = CY + Math.sin(a) * 130;
  d.s = d.svcs.map((name, j) => {
    const b = a + (j ? .32 : -.32);
    return { name, x: CX + Math.cos(b) * 205, y: CY + Math.sin(b) * 195 };
  });
  el('line', { x1: CX, y1: CY, x2: d.x, y2: d.y, class: 'l1' }, links);
  d.s.forEach((s) => el('line', { x1: d.x, y1: d.y, x2: s.x, y2: s.y }, links));
});
DEPS.forEach((d) => {
  d.s.forEach((s) => {
    const g = el('g', { class: 'svc' }, nodes);
    el('circle', { cx: s.x, cy: s.y, r: 5 }, g);
    const t = el('text', { x: s.x, y: s.y + (s.y > CY ? 20 : -11) }, g);
    t.textContent = s.name;
  });
  const g = el('g', { class: 'dep-n' }, nodes);
  el('circle', { cx: d.x, cy: d.y, r: 24 }, g);
  const ic = el('text', { x: d.x, y: d.y + 5, style: 'font-size:16px' }, g);
  ic.textContent = d.ic;
  const t = el('text', { x: d.x, y: d.y + (d.y > CY ? 44 : -32) }, g);
  t.textContent = d.id;
  d.g = g;
});
const core = el('g', { class: 'core-n' }, nodes);
el('circle', { cx: CX, cy: CY, r: 58, fill: 'url(#mcore)', opacity: .5, class: 'core-glow' }, core);
el('circle', { cx: CX, cy: CY, r: 34, fill: '#05050c', stroke: 'url(#mg)', 'stroke-width': 2 }, core);
const coreT = el('text', { x: CX, y: CY + 5, 'data-ai-name': '' }, core);
coreT.textContent = getName();
if (!reduced) gsap.to('.core-glow', { attr: { r: 70 }, opacity: .8, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: 'center' });

function pulse(d, toSvc = true) {
  const pts = [[CX, CY], [d.x, d.y]];
  if (toSvc) { const s = d.s[Math.random() < .5 ? 0 : 1]; pts.push([s.x, s.y]); }
  const c = el('circle', { r: 3.5, cx: CX, cy: CY, class: Math.random() < .4 ? 'v' : '' }, pulses);
  const tl = gsap.timeline({ onComplete: () => c.remove() });
  pts.slice(1).forEach(([x, y]) => tl.to(c, { attr: { cx: x, cy: y }, duration: .7, ease: 'power1.inOut' }));
  tl.to(c, { opacity: 0, duration: .3 });
}

const FEED = [
  ['Ventas', '💬', 'Respondió a 3 leads nuevos de Instagram'],
  ['Operación', '📦', 'Confirmó 12 pedidos y avisó a los choferes'],
  ['Marketing', '🎬', 'Editó el reel de la promo con tu molde de marca'],
  ['Finanzas', '🧾', 'Emitió la factura #A-0142 por $8,400'],
  ['Publicidad', '📈', 'El anuncio B rinde 2.1x más que el A'],
  ['Atención', '🤝', 'Resolvió la duda de un cliente sobre envíos'],
  ['Operación', '🏷️', 'Imprimió 40 etiquetas de producto'],
  ['Ventas', '📞', 'Agendó llamada con un prospecto para el jueves'],
  ['Marketing', '📅', 'Programó 3 posts para el fin de semana'],
  ['Finanzas', '💸', 'Concilió 6 pagos con el banco'],
  ['Atención', '⭐', 'Pidió reseña a 9 clientes felices'],
];
const feed = document.querySelector('.feed');
const deps = [...document.querySelectorAll('.cs-deps span')];
const tareas = document.querySelector('[data-cs="tareas"]');
let fi = 0, tcount = 128, consoleOn = false;
function tick() {
  const [dep, ic, txt] = FEED[fi++ % FEED.length];
  const d = DEPS.find((x) => x.id === dep);
  const li = document.createElement('li');
  li.innerHTML = `<span>${ic}</span>${txt}<small>${dep} · ahora</small>`;
  feed.prepend(li);
  while (feed.children.length > 6) feed.lastElementChild.remove();
  deps.forEach((s) => s.classList.toggle('on', s.textContent.includes(dep)));
  DEPS.forEach((x) => x.g.classList.toggle('hot', x === d));
  pulse(d);
  setTimeout(() => pulse(DEPS[(Math.random() * DEPS.length) | 0], false), 500);
  tareas.textContent = ++tcount;
}
ScrollTrigger.create({
  trigger: '#consola', start: 'top 80%', end: 'bottom top',
  onToggle: (st) => { consoleOn = st.isActive; },
});
for (let i = 0; i < 3; i++) tick();
setInterval(() => { if (consoleOn && !document.hidden) tick(); }, 2200);

document.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => {
  const box = b.closest('.approve');
  const yes = b.dataset.approve !== 'no';
  box.classList.add('done');
  box.innerHTML = `<small>${yes ? 'Aprobado ✓' : 'Rechazado'}</small><b>${yes ? 'Listo: $2,000 movidos al anuncio B. Te aviso cómo va.' : 'Entendido, lo dejo como está.'}</b>`;
  const li = document.createElement('li');
  li.innerHTML = `<span>${yes ? '✅' : '✋'}</span>${yes ? 'Movió $2,000 al anuncio B (aprobado por ti)' : 'Canceló el cambio de presupuesto'}<small>Publicidad · ahora</small>`;
  feed.prepend(li);
  pulse(DEPS[1]);
}));

/* ---------- F · Integraciones en órbita ---------- */
const RINGS = [
  ['Gmail', 'Calendar', 'WhatsApp', 'Telegram', 'Drive', 'Sheets'],
  ['Instagram', 'TikTok', 'Facebook', 'Meta Ads', 'LinkedIn', 'Canva', 'Notion', 'Shopify'],
  ['Stripe', 'Zoho', 'ElevenLabs', 'Metricool', 'HubSpot', 'Supabase', 'Excel', 'Google Ads', 'Impresora Zebra', 'Tu sistema'],
];
document.querySelectorAll('.ring').forEach((ring, r) => {
  const items = RINGS[r];
  items.forEach((name, i) => {
    const it = document.createElement('div');
    it.className = 'it';
    it.style.setProperty('--a', `${(i / items.length) * 360 + r * 17}deg`);
    it.style.setProperty('--r', 'calc(var(--size) / 2)');
    it.innerHTML = `<span>${name}</span>`;
    ring.append(it);
  });
});
// El radio de cada anillo depende de su tamaño en pantalla.
const sizeRings = () => document.querySelectorAll('.ring').forEach((r) => r.style.setProperty('--size', `${r.clientWidth}px`));
sizeRings();
addEventListener('resize', sizeRings);
// Los anillos giran y cada etiqueta gira al revés para quedarse derecha.
const ringEls = [...document.querySelectorAll('.ring')].map((r, i) => ({ r, spans: r.querySelectorAll('span'), speed: [9, -6, 4.2][i] }));
let orbitOn = false;
ScrollTrigger.create({ trigger: '.orbit', start: 'top bottom', end: 'bottom top', onToggle: (st) => { orbitOn = st.isActive; } });
if (!reduced) {
  gsap.ticker.add((time) => {
    if (!orbitOn) return;
    ringEls.forEach(({ r, spans, speed }) => {
      const a = time * speed;
      r.style.transform = `rotate(${a}deg)`;
      spans.forEach((s) => { s.style.transform = `translate(-50%, -50%) rotate(${-a}deg)`; });
    });
  });
}

/* ---------- I · Línea de pasos ---------- */
const stepsLine = document.querySelector('.steps-line i');
ScrollTrigger.create({
  trigger: '.steps', start: 'top 70%', end: 'bottom 60%', scrub: true,
  onUpdate: (st) => stepsLine.style.setProperty('--p', st.progress.toFixed(3)),
});
