// El formulario de contacto. Por ahora el mensaje sale por correo (mailto) y se
// puede copiar; cuando conectemos Supabase, solo cambia enviar().
import { getName } from './core.js';

const form = document.getElementById('form');
const err = form.querySelector('.form-err');
const caminos = form.querySelectorAll('[data-camino] .pill');
const intereses = form.querySelectorAll('[data-intereses] .pill');
intereses.forEach((p) => p.addEventListener('click', () => p.setAttribute('aria-pressed', p.getAttribute('aria-pressed') !== 'true')));
const elegirCamino = (v) => caminos.forEach((p) => p.setAttribute('aria-pressed', p.dataset.v === v));
caminos.forEach((p) => p.addEventListener('click', () => elegirCamino(p.dataset.v)));

// Llegó desde otro botón del sitio: /contacto#jarvis, #consultoria o #propuesta.
const desde = location.hash.slice(1);
if (desde === 'consultoria' || desde === 'propuesta') elegirCamino(desde);
else elegirCamino('propuesta');
if (desde === 'jarvis' || getName() !== 'Jarvis') intereses[0].setAttribute('aria-pressed', 'true');
if (getName() !== 'Jarvis') form.mensaje.placeholder = `Por ejemplo: quiero que ${getName()} atienda a mis clientes por WhatsApp y me mande un reporte diario.`;

const esc = (s) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

function texto(d) {
  return [
    `Nombre: ${d.nombre}`, `Empresa: ${d.empresa}`, `WhatsApp: ${d.whatsapp}`, `Correo: ${d.correo}`,
    `Cómo quiere empezar: ${d.camino}`, `Industria: ${d.giro || '—'}`, `Intereses: ${d.intereses.join(', ') || '—'}`,
    ...(d.ia !== 'Jarvis' ? [`Nombre para su IA: ${d.ia}`] : []), '', d.mensaje,
  ].join('\n');
}

async function enviar(d) {
  location.href = `mailto:contacto@nxusai.org?subject=${encodeURIComponent(`Nuevo contacto web · ${d.empresa}`)}&body=${encodeURIComponent(texto(d))}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = form.elements;
  const d = {
    nombre: f.nombre.value.trim(), empresa: f.empresa.value.trim(), whatsapp: f.whatsapp.value.trim(), correo: f.correo.value.trim(),
    giro: f.giro.value, mensaje: f.mensaje.value.trim(), ia: getName(),
    camino: form.querySelector('[data-camino] .pill[aria-pressed="true"]')?.textContent || '—',
    intereses: [...form.querySelectorAll('[data-intereses] .pill[aria-pressed="true"]')].map((p) => p.textContent),
  };
  if (!d.nombre || !d.empresa || !d.whatsapp) { err.textContent = 'Escribe tu nombre, tu empresa y tu WhatsApp.'; return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.correo)) { err.textContent = 'Revisa tu correo: debe verse como nombre@empresa.com.'; return; }
  err.textContent = '';
  try { await enviar(d); } catch {}
  const msg = texto(d);
  form.innerHTML = `<div class="form-ok"><span class="check">✓</span><h2 class="h3">¡Gracias, ${esc(d.nombre.split(' ')[0])}!</h2>
    <p class="muted">Abrimos tu correo con el mensaje listo: solo dale <b>Enviar</b>. Si no se abrió, copia el mensaje y mándalo a <b style="user-select:all">contacto@nxusai.org</b>.</p>
    <div class="row" style="justify-content:center"><button class="btn btn-grad" type="button" data-copiar>Copiar mensaje</button><a class="btn btn-ghost" href="${document.querySelector('a[data-nav="jarvis"]').getAttribute('href')}">Volver a la demo</a></div>
    <textarea class="form-copy" readonly aria-label="Tu mensaje">${esc(msg)}</textarea></div>`;
  form.querySelector('[data-copiar]').addEventListener('click', async (ev) => {
    const ta = form.querySelector('.form-copy');
    try { await navigator.clipboard.writeText(msg); ev.target.textContent = 'Copiado ✓'; } catch { ta.focus(); ta.select(); ev.target.textContent = 'Selecciónalo y cópialo'; }
  });
});
