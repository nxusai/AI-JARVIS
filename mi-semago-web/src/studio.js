// Estudio de Marca: el comprador escoge un queso real, le pone su marca y ve la etiqueta sobre la foto.
// También calcula piezas, libras, tarimas, % de la capacidad de la planta y la fecha estimada de llegada.
// Nada sale del navegador hasta que el usuario decide enviar su propuesta.
import { gsap } from 'gsap';
import { BRAND, PRODUCTS, PROCESS, transitDays } from './data.js';
import { STATES } from './states.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const COLORS = ['#0b2b57', '#b3261e', '#3a7c44', '#c19a32', '#d9661f', '#6b2c91', '#1b1b1b'];

let ctx;
const S = { view: 'product', pid: 'oaxaca-retail', size: 0, brand: '', claim: '', logo: null, tpl: 'tradicion', color: COLORS[0], pack: 0, cases: 120, dest: 'TX', touched: false };

const product = () => PRODUCTS.find((p) => p.id === S.pid);
const sizeOf = () => product().sizes[S.size] || product().sizes[0];
const packsFor = () => product().packs.filter((k) => !k.size || k.size === sizeOf().l);
const packOf = () => packsFor()[S.pack] || packsFor()[0];
const brandName = () => S.brand.trim() || ctx.t('st.defaultBrand');
const shortName = (p, lang) => p.name[lang].replace(/\s*\(.*?\)\s*/g, '').replace(/^Queso\s+/i, '').replace(/\s+Cheese$/i, '').replace(/^Fresh Cheese/i, 'Fresh').trim();

export function initStudio(c) {
  ctx = c;
  // Paso 1: quesos
  $('#stCheese').innerHTML = PRODUCTS.map((p) => `<button type="button" role="radio" data-pid="${p.id}" aria-label="${esc(p.name.es)}"><img src="./img/p/${p.img}.webp" alt="" loading="lazy" /></button>`).join('') + '<p class="cheese-name" id="stCheeseName" style="grid-column:1/-1"></p>';
  $('#stCheese').addEventListener('click', (e) => { const b = e.target.closest('[data-pid]'); if (b) setProduct(b.dataset.pid); });
  $('#stSize').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; S.size = +b.dataset.i; S.pack = 0; renderOptions(); update(); });
  $('#stTpl').addEventListener('click', (e) => { const b = e.target.closest('[data-tpl]'); if (!b) return; S.tpl = b.dataset.tpl; marks('#stTpl', b); update(true); });

  // Colores
  $('#stColors').innerHTML = COLORS.map((c, i) => `<button type="button" style="--c:${c}" data-c="${c}" aria-label="Color ${i + 1}" class="${i ? '' : 'on'}"></button>`).join('') + '<label aria-label="Otro color"><input type="color" id="stCustom" value="#0b2b57" /></label>';
  $('#stColors').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; S.color = b.dataset.c; marks('#stColors', b); update(); });
  $('#stCustom').addEventListener('input', (e) => { S.color = e.target.value; marks('#stColors', null); update(); });

  // Marca
  $('#stBrand').addEventListener('input', (e) => { S.brand = e.target.value; S.touched = true; update(); });
  $('#stClaim').addEventListener('input', (e) => { S.claim = e.target.value; update(); });
  $('#stLogo').addEventListener('change', onLogo);
  $('#stLogoRemove').addEventListener('click', () => { S.logo = null; $('#stLogo').value = ''; $('#stLogoRemove').hidden = true; update(); });
  $('#stSuggest').addEventListener('click', suggestNames);
  $('#stNames').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.brand = b.textContent; $('#stBrand').value = S.brand; update(true); });

  // Volumen y destino
  $('#stPack').addEventListener('change', (e) => { S.pack = +e.target.value; update(); });
  $('#stCases').addEventListener('input', (e) => { S.cases = +e.target.value; update(); });
  $('#stDest').addEventListener('change', (e) => { S.dest = e.target.value; update(); });

  $('#stDownload').addEventListener('click', downloadLabel);
  $('#stSend').addEventListener('click', () => ctx.sendStudio(summary()));
  $('#stAsk').addEventListener('click', () => ctx.openChat(ctx.lang() === 'en'
    ? `I'm designing "${brandName()}" with ${product().name.en} ${sizeOf().l}, ${S.cases} cases a week to ${stateName()}. What do you recommend and what should I ask in my quote?`
    : `Estoy armando "${brandName()}" con ${product().name.es} de ${sizeOf().l}, ${S.cases} cajas por semana a ${stateName()}. ¿Qué me recomiendas y qué debo preguntar al cotizar?`));

  $('#stView').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });

  initTilt();
  setProduct(S.pid, true);
}

// Al cambiar de idioma: textos de opciones y etiqueta.
export function refreshStudio() { renderOptions(); update(); }

export function setProduct(id, silent) {
  if (!PRODUCTS.some((p) => p.id === id)) return;
  S.pid = id; S.size = 0; S.pack = 0;
  const p = product();
  $('#stCheese').querySelectorAll('[data-pid]').forEach((b) => { b.classList.toggle('on', b.dataset.pid === id); b.setAttribute('aria-checked', b.dataset.pid === id); });
  const img = $('#mockImg');
  img.src = `./img/p/${p.img}.webp`;
  img.alt = p.name[ctx.lang()];
  renderOptions();
  update(true);
  if (!silent && !ctx.reduced) gsap.fromTo('#mockTilt', { y: -60, rotate: -6, opacity: 0, scale: 0.9 }, { y: 0, rotate: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.7)' });
}

function marks(sel, on) { $(sel).querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b === on); b.setAttribute('aria-checked', b === on); }); }

function renderOptions() {
  const p = product(); const lang = ctx.lang();
  $('#stCheeseName').textContent = p.name[lang];
  $('#stSize').innerHTML = p.sizes.map((s, i) => `<button type="button" role="radio" data-i="${i}" class="${i === S.size ? 'on' : ''}" aria-checked="${i === S.size}">${s.l}</button>`).join('');
  $('#stPack').innerHTML = packsFor().map((k, i) => `<option value="${i}" ${i === S.pack ? 'selected' : ''}>${k.n} ${ctx.t('cat.perCase')}${k.pallet ? ` · ${k.pallet} ${ctx.t('cat.perPallet')}` : ''}</option>`).join('');
  const dest = $('#stDest');
  if (!dest.options.length || dest.dataset.lang !== lang) {
    dest.innerHTML = [...STATES].sort((a, b) => a.name.localeCompare(b.name)).map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
    dest.value = S.dest; dest.dataset.lang = lang;
  }
}

const stateName = () => (STATES.find((s) => s.id === S.dest) || {}).name || S.dest;
const fmt = (n, d = 0) => n.toLocaleString(ctx.lang() === 'en' ? 'en-US' : 'es-MX', { maximumFractionDigits: d, minimumFractionDigits: d });

function numbers() {
  const pack = packOf(); const size = sizeOf();
  const units = S.cases * pack.n;
  const lbs = units * size.lb;
  const pallets = pack.pallet ? S.cases / pack.pallet : null;
  const share = (lbs / BRAND.capacityLbWeek) * 100;
  const st = STATES.find((s) => s.id === S.dest);
  const far = st && (st.id === 'AK' || st.id === 'HI');
  const transit = st ? (far ? 5 : transitDays(st.miles)) : 5;
  const steps = [PROCESS[0].days[1], PROCESS[1].days[1], PROCESS[2].days[1], transit];
  const date = new Date(); date.setDate(date.getDate() + steps.reduce((a, b) => a + b, 0));
  return { units, lbs, pallets, share, transit, steps, date, pack, size };
}

let lastLabel = '';
function update(animateLabel) {
  const n = numbers();
  const r = $('#stCases'); r.style.setProperty('--p', `${((S.cases - r.min) / (r.max - r.min)) * 100}%`);
  $('#stCasesOut').textContent = fmt(S.cases);
  $('#oUnits').textContent = fmt(n.units);
  $('#oLbs').textContent = fmt(n.lbs);
  $('#oPallets').textContent = n.pallets == null ? ctx.t('st.o.palletNa') : fmt(n.pallets, n.pallets < 10 ? 1 : 0);
  $('#oShare').textContent = `${fmt(n.share, n.share < 1 ? 2 : 1)}%`;
  $('#oMeter').style.width = `${Math.min(100, Math.max(1.5, n.share))}%`;
  $('#oDate').textContent = n.date.toLocaleDateString(ctx.lang() === 'en' ? 'en-US' : 'es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#launchBar').innerHTML = n.steps.map((d) => `<i style="flex-grow:${d}"></i>`).join('');

  // Etiqueta
  const p = product(); const L = p.label;
  const el = $('#mockLabel');
  el.style.left = `${L.x}%`; el.style.top = `${L.y}%`; el.style.width = `${L.w}%`;
  el.style.transform = `translate(-50%, -50%) rotate(${L.r}deg)`;
  const svg = labelSVG();
  if (svg !== lastLabel) {
    el.innerHTML = svg; lastLabel = svg;
    if (animateLabel && !ctx.reduced) gsap.fromTo(el, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)', clearProps: 'scale,opacity' });
  }
  if (S.view === 'shelf') renderShelf(svg);
  ctx.onStudioChange?.({ brand: brandName(), cheese: p.name[ctx.lang()] });
}

// ───────── Vista de anaquel: el queso con tu marca repetido en un estante de supermercado ─────────
function setView(v) {
  S.view = v;
  $('#stView').dataset.view = v;
  $('#stView').querySelectorAll('[data-view]').forEach((b) => { b.classList.toggle('on', b.dataset.view === v); b.setAttribute('aria-selected', b.dataset.view === v); });
  const shelf = $('#shelf'); const mock = $('#mock');
  mock.classList.toggle('mock--shelf', v === 'shelf');
  shelf.hidden = v !== 'shelf';
  $('#mockTilt').hidden = v === 'shelf';
  if (v === 'shelf') {
    renderShelf(labelSVG());
    if (!ctx.reduced) {
      gsap.fromTo('#shelf .shelf__item', { y: -80, opacity: 0, rotate: () => gsap.utils.random(-8, 8) }, { y: 0, opacity: 1, rotate: 0, duration: 0.9, stagger: { each: 0.06, from: 'random' }, ease: 'bounce.out' });
      gsap.fromTo('#shelf .shelf__edge', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'expo.out', stagger: 0.15 });
    }
  }
}
function renderShelf(svg) {
  const p = product(); const L = p.label; const c = S.color;
  const tall = p.img.startsWith('barra') || p.img === 'fresco-cubeta';
  const per = tall ? 7 : 5;
  const item = `<div class="shelf__item${tall ? ' shelf__item--tall' : ''}"><img src="./img/p/${p.img}.webp" alt="" /><div class="shelf__label" style="left:${L.x}%;top:${L.y}%;width:${L.w}%;transform:translate(-50%,-50%) rotate(${L.r}deg)">${svg}</div></div>`;
  const edge = `<div class="shelf__edge" style="--c:${c}"><b>${esc(brandName())}</b><span class="shelf__new">${esc(ctx.t('st.new'))}</span><span>${esc(shortName(p, ctx.lang()))} · ${sizeOf().l}</span></div>`;
  $('#shelf').innerHTML = `<div class="shelf__sign" style="--c:${c}">${esc(ctx.t('st.shelfTag'))}</div>` +
    [0, 1, 2].map(() => `<div class="shelf__row">${item.repeat(per)}</div>${edge}`).join('');
}

// ───────── Plantillas de etiqueta (SVG 300 × 190) ─────────
function fit(text, max, base) { return Math.max(13, Math.min(base, (max / Math.max(text.length, 1)) * 1.9)); }
function labelSVG(forExport) {
  const p = product(); const lang = ctx.lang(); const c = S.color;
  const brand = esc(brandName()); const cheese = esc(shortName(p, lang).toUpperCase());
  const claim = esc(S.claim.trim());
  const net = `${ctx.t('st.net')} ${sizeOf().l}`; const keep = esc(ctx.t('st.keep'));
  const fs = fit(brandName(), 230, 46);
  const serif = forExport ? 'Georgia, serif' : "'Fraunces', Georgia, serif";
  const sans = forExport ? 'Arial, sans-serif' : "'Manrope', Arial, sans-serif";
  const cond = forExport ? 'Impact, Arial Narrow, sans-serif' : "'Bebas Neue', Impact, sans-serif";
  const logo = S.logo ? `<image href="${S.logo}" x="122" y="${S.tpl === 'fiesta' ? 30 : 16}" width="56" height="40" preserveAspectRatio="xMidYMid meet"/>` : '';
  const dy = S.logo ? 18 : 0;
  // Nombres largos ("Fresco con hoja de plátano 4") se comprimen para caber en la banda.
  const squeeze = (max) => (cheese.length * 11 > max ? ` textLength="${max}" lengthAdjust="spacingAndGlyphs"` : '');
  if (S.tpl === 'moderno') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 190"><rect x="2" y="2" width="296" height="186" rx="18" fill="#fff" stroke="${c}" stroke-width="3"/><rect x="2" y="2" width="296" height="40" rx="18" fill="${c}"/><rect x="2" y="24" width="296" height="18" fill="${c}"/>
      <text x="150" y="29" text-anchor="middle" font-family="${cond}" font-size="20" letter-spacing="3" fill="#fff"${squeeze(250)}>${cheese}</text>
      ${S.logo ? `<image href="${S.logo}" x="20" y="58" width="56" height="56" preserveAspectRatio="xMidYMid meet"/>` : ''}
      <text x="${S.logo ? 186 : 150}" y="${claim ? 98 : 108}" text-anchor="middle" font-family="${sans}" font-weight="800" font-size="${Math.min(fs, S.logo ? 34 : 46)}" fill="${c}" letter-spacing="-1">${brand}</text>
      ${claim ? `<text x="${S.logo ? 186 : 150}" y="124" text-anchor="middle" font-family="${sans}" font-size="13" fill="#5b6b82">${claim}</text>` : ''}
      <line x1="22" y1="142" x2="278" y2="142" stroke="${c}" stroke-opacity=".25"/>
      <text x="22" y="166" font-family="${sans}" font-weight="700" font-size="12" fill="#0d1b33">${net}</text>
      <text x="278" y="166" text-anchor="end" font-family="${sans}" font-size="10.5" fill="#5b6b82">${keep}</text></svg>`;
  }
  if (S.tpl === 'fiesta') {
    const zig = Array.from({ length: 15 }, (_, i) => `${10 + i * 20},14 ${20 + i * 20},26`).join(' ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 190"><rect x="2" y="2" width="296" height="186" rx="26" fill="${c}"/>
      <polyline points="0,14 ${zig} 300,14" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
      <g fill="#fff" fill-opacity=".18">${Array.from({ length: 6 }, (_, i) => `<circle cx="${30 + i * 48}" cy="176" r="14"/>`).join('')}</g>
      ${logo}
      <text x="150" y="${92 + dy}" text-anchor="middle" font-family="${serif}" font-style="italic" font-weight="800" font-size="${fs}" fill="#fff">${brand}</text>
      <rect x="60" y="${106 + dy}" width="180" height="28" rx="14" fill="#fff"/>
      <text x="150" y="${126 + dy}" text-anchor="middle" font-family="${cond}" font-size="19" letter-spacing="2" fill="${c}"${squeeze(164)}>${cheese}</text>
      ${claim && !S.logo ? `<text x="150" y="52" text-anchor="middle" font-family="${sans}" font-weight="700" font-size="13" fill="#fff">${claim}</text>` : ''}
      <text x="150" y="${S.logo ? 166 : 160}" text-anchor="middle" font-family="${sans}" font-weight="700" font-size="11" fill="#fff">${net} · ${keep}</text></svg>`;
  }
  // tradición
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 190"><ellipse cx="150" cy="95" rx="146" ry="91" fill="#fbf4e2" stroke="${c}" stroke-width="4"/><ellipse cx="150" cy="95" rx="136" ry="81" fill="none" stroke="${c}" stroke-width="1.2" stroke-dasharray="2 4"/>
    ${logo}
    <text x="150" y="${claim ? 78 + dy : 86 + dy}" text-anchor="middle" font-family="${serif}" font-style="italic" font-weight="700" font-size="${Math.min(fs, 42)}" fill="${c}">${brand}</text>
    ${claim ? `<text x="150" y="${98 + dy}" text-anchor="middle" font-family="${serif}" font-style="italic" font-size="13" fill="#5b4a2a">${claim}</text>` : ''}
    <path d="M28 ${110 + dy}h244l-12 13 12 13H28l12-13z" fill="${c}"/>
    <text x="150" y="${129 + dy}" text-anchor="middle" font-family="${cond}" font-size="19" letter-spacing="2.5" fill="#fff"${squeeze(210)}>${cheese}</text>
    <text x="150" y="${S.logo ? 168 : 158}" text-anchor="middle" font-family="${sans}" font-weight="700" font-size="10.5" fill="#5b4a2a">${net} · ${keep}</text></svg>`;
}

function onLogo(e) {
  const f = e.target.files?.[0];
  if (!f || f.size > 4e6) return;
  const r = new FileReader();
  r.onload = () => {
    // Se reduce a 300 px para que la etiqueta pese poco y se pueda descargar.
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 300 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k) || 300; cv.height = Math.round(img.height * k) || 300;
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      S.logo = cv.toDataURL('image/png'); $('#stLogoRemove').hidden = false; update(true);
    };
    img.src = r.result;
  };
  r.readAsDataURL(f);
}

function downloadLabel() {
  const svg = labelSVG(true);
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas'); cv.width = 1500; cv.height = 950;
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const a = document.createElement('a');
    a.download = `etiqueta-${(S.brand.trim() || 'mi-marca').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`;
    a.href = cv.toDataURL('image/png'); a.click();
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ───────── Nombres con IA (o sugerencias locales si la IA no está disponible) ─────────
async function suggestNames() {
  const btn = $('#stSuggest'); const label = btn.querySelector('span');
  label.textContent = ctx.t('st.suggesting'); btn.disabled = true;
  let names = [];
  try {
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'names', lang: ctx.lang(), cheese: product().name.es, hint: S.brand.slice(0, 40) }) });
    if (res.ok) names = ((await res.json()).names || []).filter((x) => typeof x === 'string' && x.length <= 26).slice(0, 6);
  } catch { /* sin IA: usamos las sugerencias locales */ }
  if (!names.length) names = localNames();
  label.textContent = ctx.t('st.suggest'); btn.disabled = false;
  $('#stNames').innerHTML = names.map((n) => `<button type="button">${esc(n)}</button>`).join('');
  if (!ctx.reduced) gsap.from('#stNames button', { y: 10, opacity: 0, stagger: 0.06, duration: 0.4 });
}
function localNames() {
  const a = ['La Abuela', 'Don', 'Doña', 'El Rancho de', 'Sabor de', 'Rancho', 'La Cremería de', 'Hacienda'];
  const b = ['Rosa', 'Chuy', 'Lupita', 'Los Altos', 'Mi Tierra', 'San Miguel', 'El Valle', 'Copán', 'Oaxaca', 'La Sierra', 'Pancho'];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return Array.from(new Set(Array.from({ length: 10 }, () => `${pick(a)} ${pick(b)}`))).slice(0, 5);
}

// ───────── Inclinación 3D con el cursor ─────────
function initTilt() {
  const mock = $('#mock'); const tilt = $('#mockTilt'); const shine = mock.querySelector('.mock__shine');
  if (ctx.reduced) return;
  mock.addEventListener('pointermove', (e) => {
    const r = mock.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5;
    tilt.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 16}deg) translateZ(20px)`;
    shine.style.backgroundPosition = `${x * 100}% ${y * 100}%`;
  });
  mock.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
}

// Resumen de la propuesta para el formulario de contacto y la IA.
function summary() {
  const n = numbers(); const p = product(); const lang = ctx.lang();
  const en = lang === 'en';
  return {
    pid: p.id,
    short: `${brandName()} · ${p.name[lang]} ${sizeOf().l}`,
    text: en
      ? `Brand Studio proposal\n- Brand: ${brandName()}${S.claim ? ` ("${S.claim}")` : ''}\n- Cheese: ${p.name.en} · ${sizeOf().l}\n- Style: ${ctx.t('st.tpl.' + S.tpl)} · color ${S.color}${S.logo ? ' · has logo' : ''}\n- Volume: ${S.cases} cases/week of ${n.pack.n} (${fmt(n.units)} units, ${fmt(n.lbs)} lb${n.pallets != null ? `, ${fmt(n.pallets, 1)} pallets` : ''})\n- Destination: ${stateName()} (~${n.transit} days in transit)`
      : `Propuesta del Estudio de Marca\n- Marca: ${brandName()}${S.claim ? ` ("${S.claim}")` : ''}\n- Queso: ${p.name.es} · ${sizeOf().l}\n- Estilo: ${ctx.t('st.tpl.' + S.tpl)} · color ${S.color}${S.logo ? ' · con logo' : ''}\n- Volumen: ${S.cases} cajas/semana de ${n.pack.n} (${fmt(n.units)} piezas, ${fmt(n.lbs)} lb${n.pallets != null ? `, ${fmt(n.pallets, 1)} tarimas` : ''})\n- Destino: ${stateName()} (~${n.transit} días en camino)`,
  };
}
