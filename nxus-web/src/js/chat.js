// Un chat de Telegram que se reproduce solo: mensajes, notas de voz, imágenes,
// documentos y botones de aprobación. También contesta lo que el visitante escribe.
import { getName } from './core.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (s) => esc(s.replaceAll('{name}', getName()))
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/\[ok\](.+?)\[\/ok\]/g, '<span class="ok">$1</span>')
  .replace(/\n/g, '<br>');
const now = () => new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wave = (n = 28) => Array.from({ length: n }, () => `<i style="height:${20 + Math.random() * 80}%"></i>`).join('');

export function createChat(root, { speed = 1 } = {}) {
  const body = root.querySelector('.tg-body');
  const status = root.querySelector('.tg-who span');
  let run = 0;
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: .15 }).observe(root);

  // Espera respetando pausas: si el teléfono no se ve, el guion se detiene ahí.
  async function wait(ms, id) {
    const end = performance.now() + ms / speed;
    while (performance.now() < end || !visible) {
      if (id !== run) throw new Error('stop');
      await sleep(80);
    }
    if (id !== run) throw new Error('stop');
  }
  const scroll = () => { body.scrollTop = body.scrollHeight; };
  const setStatus = (typing) => {
    if (!status) return;
    status.textContent = typing ? (typing === 'voice' ? 'grabando audio…' : 'escribiendo…') : 'en línea';
    status.classList.toggle('typing', !!typing);
  };

  function bubble(who, m) {
    const el = document.createElement('div');
    el.className = `msg ${who}`;
    const t = `<span class="time">${now()}</span>`;
    if (typeof m === 'string') el.innerHTML = fmt(m) + t;
    else if (m.voice) el.innerHTML = `<div class="voice"><span class="play"></span><span class="wave">${wave()}</span><span class="dur">${m.dur || '0:06'}</span></div><span class="voice-txt">“${fmt(m.voice)}”</span>${t}`;
    else if (m.image) el.innerHTML = `<div class="media"><div class="gen ${m.image}" data-label="${esc(m.label || '')}"></div></div>${m.text ? fmt(m.text) : ''}${t}`;
    else if (m.chart) el.innerHTML = `<div class="media"><div class="gen gen-chart">${m.chart.map((v, i) => `<i style="height:${v}%;animation-delay:${i * .08}s;background-position:${i * 14}% 0"></i>`).join('')}</div></div>${m.text ? fmt(m.text) : ''}${t}`;
    else if (m.doc) el.innerHTML = `<div class="doc"><span class="ic">📄</span><span><b>${esc(m.doc)}</b><small>${esc(m.size || '')}</small></span></div>${m.text ? `<div style="margin-top:6px">${fmt(m.text)}</div>` : ''}${t}`;
    body.append(el);
    scroll();
    return el;
  }

  async function typing(id, kind, len = 40) {
    setStatus(kind);
    const el = document.createElement('div');
    el.className = 'msg ai typing';
    el.innerHTML = '<i></i><i></i><i></i>';
    body.append(el);
    scroll();
    try { await wait(Math.min(2200, 600 + len * 18), id); } finally { el.remove(); setStatus(false); }
  }

  async function step(s, id) {
    if (s.pause) return wait(s.pause, id);
    if (s.clear) { body.innerHTML = s.day ? `<div class="tg-day">${esc(s.day)}</div>` : ''; return; }
    if (s.me !== undefined) {
      await wait(s.wait ?? 700, id);
      bubble('me', s.me);
      return;
    }
    if (s.ai !== undefined) {
      const len = typeof s.ai === 'string' ? s.ai.length : 60;
      await typing(id, s.ai.voice ? 'voice' : true, len);
      bubble('ai', s.ai);
      return;
    }
    if (s.keys) {
      const k = document.createElement('div');
      k.className = 'tg-keys';
      k.innerHTML = s.keys.map((x) => `<button type="button">${esc(x)}</button>`).join('');
      body.append(k);
      scroll();
      const buttons = [...k.querySelectorAll('button')];
      // El visitante puede tocar; si no, el guion elige solo.
      const chosen = await new Promise((resolve) => {
        buttons.forEach((b, i) => b.addEventListener('click', () => resolve(i), { once: true }));
        wait(2600, id).then(() => resolve(s.pick ?? 0), () => resolve(-1));
      });
      if (chosen < 0) throw new Error('stop');
      buttons.forEach((b, i) => { b.disabled = true; b.classList.toggle('on', i === chosen); });
      const follow = s.then?.[chosen];
      if (follow) for (const f of follow) await step(f, id);
    }
  }

  async function play(script, { loop = false } = {}) {
    const id = ++run;
    setStatus(false);
    try {
      do {
        for (const s of script) await step(s, id);
        if (loop) await wait(4000, id);
      } while (loop);
    } catch (e) { if (e.message !== 'stop') throw e; }
  }

  return {
    play,
    stop() { run++; setStatus(false); },
    clear(day) { body.innerHTML = day ? `<div class="tg-day">${esc(day)}</div>` : ''; },
    async say(text, replyFn) {
      const id = ++run;
      bubble('me', text);
      try {
        for (const s of replyFn(text)) await step(s, id);
      } catch (e) { if (e.message !== 'stop') throw e; }
    },
  };
}
