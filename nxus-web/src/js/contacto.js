// El formulario de contacto. Por ahora el mensaje sale por correo (mailto);
// cuando conectemos Supabase, solo cambia enviar().
import { getName } from './core.js';

const form = document.getElementById('form');
const err = form.querySelector('.form-err');
form.querySelectorAll('.pill').forEach((p) => p.addEventListener('click', () => p.setAttribute('aria-pressed', p.getAttribute('aria-pressed') !== 'true')));

// Si el visitante ya bautizó a su IA en la demo, lo traemos al mensaje.
if (getName() !== 'Jarvis') {
  form.querySelector('.pill').setAttribute('aria-pressed', 'true');
  form.mensaje.placeholder = `Por ejemplo: quiero que ${getName()} atienda a mis clientes por WhatsApp y me mande un reporte diario.`;
}

async function enviar(datos) {
  const cuerpo = [
    `Nombre: ${datos.nombre}`, `Empresa: ${datos.empresa}`, `WhatsApp: ${datos.whatsapp}`, `Correo: ${datos.correo}`,
    `Industria: ${datos.giro || '—'}`, `Intereses: ${datos.intereses.join(', ') || '—'}`,
    datos.ia !== 'Jarvis' ? `Nombre para su IA: ${datos.ia}` : '', '', datos.mensaje,
  ].filter((l) => l !== null).join('\n');
  location.href = `mailto:contacto@nxusai.org?subject=${encodeURIComponent(`Nuevo contacto web · ${datos.empresa}`)}&body=${encodeURIComponent(cuerpo)}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = form.elements;
  const datos = {
    nombre: f.nombre.value.trim(), empresa: f.empresa.value.trim(), whatsapp: f.whatsapp.value.trim(), correo: f.correo.value.trim(),
    giro: f.giro.value, mensaje: f.mensaje.value.trim(), ia: getName(),
    intereses: [...form.querySelectorAll('.pill[aria-pressed="true"]')].map((p) => p.textContent),
  };
  if (!datos.nombre || !datos.empresa || !datos.whatsapp) { err.textContent = 'Escribe tu nombre, tu empresa y tu WhatsApp.'; return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(datos.correo)) { err.textContent = 'Revisa tu correo.'; return; }
  err.textContent = '';
  await enviar(datos);
  const nombre = datos.nombre.split(' ')[0].replace(/[<>&]/g, '');
  form.innerHTML = `<div class="form-ok"><span class="check">✓</span><h2 class="h3">¡Gracias, ${nombre}!</h2><p class="muted">Se abrió tu correo con el mensaje listo: solo dale enviar. Si prefieres, agenda directo tu reunión.</p><a class="btn btn-grad" href="https://empezar.nxusai.org">Agendar reunión <span class="arrow">→</span></a></div>`;
});
