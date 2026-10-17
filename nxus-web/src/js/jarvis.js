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

/* ---------- D · Voz ---------- */
const stage = document.querySelector('.voice-stage');
const vc = stage.querySelector('.voice-viz');
const vctx = vc.getContext('2d');
let level = 0, target = .08, talking = false;
function drawVoice(t) {
  requestAnimationFrame(drawVoice);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const s = vc.clientWidth;
  if (vc.width !== s * dpr) { vc.width = s * dpr; vc.height = s * dpr; }
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vctx.clearRect(0, 0, s, s);
  if (talking) target = .25 + Math.abs(Math.sin(t / 90) * Math.sin(t / 233)) * .75;
  else target = .06;
  level += (target - level) * .15;
  const c = s / 2, R = s * .3, bars = 120;
  const g = vctx.createRadialGradient(c, c, 0, c, c, s / 2);
  g.addColorStop(0, `rgba(10,108,255,${.12 + level * .25})`);
  g.addColorStop(.6, 'rgba(165,28,255,.04)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  vctx.fillStyle = g;
  vctx.fillRect(0, 0, s, s);
  vctx.lineCap = 'round';
  for (let i = 0; i < bars; i++) {
    const a = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const n = Math.sin(i * .5 + t / 300) * .5 + Math.sin(i * 1.7 - t / 170) * .5;
    const len = 6 + Math.abs(n) * s * .16 * level + s * .01;
    const u = i / bars;
    vctx.strokeStyle = u < .5 ? `rgba(${Math.round(u * 2 * 10)},${Math.round(229 - u * 2 * 121)},255,.9)` : `rgba(${Math.round(10 + (u - .5) * 2 * 155)},${Math.round(108 - (u - .5) * 2 * 80)},255,.9)`;
    vctx.lineWidth = Math.max(1.5, s / 220);
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
  core.addColorStop(0, `rgba(255,255,255,${.25 + level * .6})`);
  core.addColorStop(.25, `rgba(0,229,255,${.25 + level * .4})`);
  core.addColorStop(1, 'rgba(10,108,255,0)');
  vctx.fillStyle = core;
  vctx.beginPath();
  vctx.arc(c, c, R * .8, 0, Math.PI * 2);
  vctx.fill();
}
requestAnimationFrame(drawVoice);

const log = document.querySelector('.voice-log');
const vbtn = document.querySelector('.voice-btn');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  return vs.find((v) => /es[-_]MX/i.test(v.lang)) || vs.find((v) => /es[-_]US/i.test(v.lang)) || vs.find((v) => /^es/i.test(v.lang));
}
function speak(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { setTimeout(resolve, text.length * 55); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-MX';
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.03;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
    setTimeout(resolve, text.length * 90 + 3000); // por si el navegador no avisa
  });
}
const line = (who, text, you) => {
  const p = document.createElement('p');
  if (you) p.className = 'you';
  p.innerHTML = `<b>${who}:</b> `;
  p.append(text);
  log.append(p);
  while (log.children.length > 3) log.firstElementChild.remove();
};
let voiceBusy = false;
vbtn.addEventListener('click', async () => {
  if (voiceBusy) { speechSynthesis?.cancel(); return; }
  voiceBusy = true;
  const name = getName();
  log.innerHTML = '';
  line('Tú', `“Hey, ${name}, ¿cómo va el día?”`, true);
  await sleep(700);
  talking = true; stage.classList.add('talking');
  const a = `Hola, jefe. Soy ${name}. Hoy llevamos cuarenta y ocho mil pesos en ventas, doce por ciento más que el martes pasado.`;
  line(name, a);
  await speak(a);
  const b = 'Tienes tres pendientes y una reunión a las cuatro. ¿Quieres que te los lea?';
  line(name, b);
  await speak(b);
  talking = false; stage.classList.remove('talking');
  voiceBusy = false;
});

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
