// ─────────────────────────────────────────────────────────────
//  EL ORÁCULO · la entrada para la IA de Aurelius
//
//  Hoy responde con reglas (palabras clave → respuesta) usando
//  los datos de data.js. Para conectar una IA real basta con
//  poner `site.ai.endpoint` en data.js: el Oráculo enviará
//  POST { messages: [{ role: 'user'|'assistant', content }] }
//  y mostrará el campo `reply` de la respuesta. Si la IA falla,
//  vuelve solo a las respuestas por reglas.
// ─────────────────────────────────────────────────────────────
import { site, provinces, wa, mapsUrl } from './data.js';

const hoursText = () => site.hours.map((h) => `${h.label}: ${h.text}`).join('<br>');
const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

const intents = [
  {
    keys: ['precio', 'cuesta', 'cuanto', 'cuánto', 'costo', 'vale', '259', 'cobran'],
    reply: () => `El come todo cuesta <b>$${site.price}</b> por guerrero. Un solo tributo y tú decides cuándo parar. 👑`,
  },
  {
    keys: ['incluye', 'entra', 'menu', 'menú', 'comida', 'que hay', 'qué hay', 'platillos', 'carta'],
    reply: () =>
      `La Ruta de la Conquista incluye: ${provinces.map((p) => `<b>${p.name}</b>`).join(', ')}. Todo sin límite por $${site.price}.`,
  },
  {
    keys: ['horario', 'hora', 'abren', 'cierran', 'abierto', 'abre', 'cierra'],
    reply: () => `Abrimos las puertas del templo:<br>${hoursText()}`,
  },
  {
    keys: ['donde', 'dónde', 'ubicacion', 'ubicación', 'direccion', 'dirección', 'llegar', 'mapa', 'maps'],
    reply: () =>
      `Estamos en ${site.address.street}, ${site.address.locality}. Búscanos como «Aurelius Coacalco» o ${link(mapsUrl, 'abre el mapa aquí')}.`,
  },
  {
    keys: ['domicilio', 'llevar', 'delivery', 'envio', 'envío', 'pedido', 'ordenar', 'pedir'],
    reply: () =>
      `La carta viaja hasta tu puerta. ${link(wa('Hola Aurelius 👋 quiero ordenar a domicilio:'), 'Pide por WhatsApp aquí')}. El come todo se conquista en el templo.`,
  },
  {
    keys: ['reserv', 'apartar', 'mesa', 'grupo', 'cumple', 'fiesta', 'evento'],
    reply: () =>
      `¿Vienes con toda tu legión? ${link(wa('Hola Aurelius, quiero apartar mesa para un grupo.'), 'Escríbenos por WhatsApp')} y te apartamos el campo de batalla.`,
  },
  {
    keys: ['cerveza', 'beer', 'chela', 'bebida', 'michelada', 'tomar', 'trago', 'alcohol'],
    reply: () => 'El come todo no incluye bebidas, pero tenemos el paquete <b>All you can beer</b>: Cantarito cervecero, Mango habanero, Tamarindo de guerra, Gladiadora de mango, Chelada imperial y la Michelada Aurelius. Pregunta en el templo por las condiciones. 🍺',
  },
  {
    keys: ['picante', 'salsa', 'fuego', 'pica', 'alitas', 'boneless'],
    reply: () => 'Las alitas y boneless se bañan en el fuego digno de tu temple. Pregunta a tu mesero por el arsenal de salsas del día. 🔥',
  },
  {
    keys: ['italia', 'corea', 'japon', 'japón', 'pais', 'país', 'nuevo', 'nueva', 'próxim', 'proxim'],
    reply: () => 'El imperio se expande: pronto llegarán cocinas de Italia, Corea y más países al come todo. Vota por tu favorito en la sección «Próximas conquistas».',
  },
  {
    keys: ['trabajo', 'empleo', 'vacante', 'trabajar', 'chamba'],
    reply: () => `¿Quieres servir al imperio? ${link(wa('Hola Aurelius, quiero unirme a la legión.'), 'Mándanos WhatsApp')} y cuéntanos de ti.`,
  },
  {
    keys: ['aurelius', 'nombre', 'historia', 'marco', 'quien', 'quién'],
    reply: () => 'Aurelius se llama así por Marco Aurelio, el emperador filósofo. Nuestro fundador escuchaba su filosofía mientras luchaba por este sueño. Aquí la virtud tiene sabor.',
  },
  {
    keys: ['hola', 'buenas', 'que onda', 'qué onda', 'hey'],
    reply: () => 'Salve, conquistador. ¿Qué deseas saber del imperio?',
  },
  {
    keys: ['gracias', 'grax', 'thank'],
    reply: () => 'A ti, guerrero. Te esperamos en el templo. ⚔️',
  },
];

const fallback = () =>
  `Esa pregunta es digna de los dioses. Muy pronto el Oráculo tendrá inteligencia artificial; mientras, un humano del imperio te responde ${link(wa('Hola Aurelius 👋 tengo una pregunta:'), 'por WhatsApp')}.`;

const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function ruleReply(text) {
  const t = normalize(text);
  const hit = intents.find((i) => i.keys.some((k) => t.includes(normalize(k))));
  return hit ? hit.reply() : fallback();
}

const history = [];

export async function askOracle(text) {
  history.push({ role: 'user', content: text });
  let reply;
  if (site.ai.endpoint) {
    try {
      const res = await fetch(site.ai.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (res.ok) reply = (await res.json()).reply;
    } catch {
      /* la IA no respondió: usamos las reglas */
    }
  }
  if (!reply) reply = ruleReply(text);
  history.push({ role: 'assistant', content: reply });
  return reply;
}

export const suggestions = ['¿Cuánto cuesta?', '¿Qué incluye?', '¿Horario?', '¿Dónde están?', '¿Tienen domicilio?', 'Quiero reservar'];

export function mountOracle() {
  const btn = document.getElementById('oracleBtn');
  const panel = document.getElementById('oracle');
  const close = document.getElementById('oracleClose');
  const log = document.getElementById('oracleLog');
  const chips = document.getElementById('oracleChips');
  const form = document.getElementById('oracleForm');
  const input = document.getElementById('oracleInput');
  let greeted = false;

  const add = (html, who) => {
    const el = document.createElement('div');
    el.className = `msg msg--${who}`;
    if (who === 'me') el.textContent = html;
    else el.innerHTML = html;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };

  const send = async (text) => {
    if (!text.trim()) return;
    add(text, 'me');
    const typing = add('<i></i><i></i><i></i>', 'bot');
    typing.classList.add('msg--typing');
    const [reply] = await Promise.all([askOracle(text), new Promise((r) => setTimeout(r, 650))]);
    typing.remove();
    add(reply, 'bot');
  };

  const toggle = (open) => {
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', String(!open));
    btn.setAttribute('aria-expanded', String(open));
    if (open && !greeted) {
      greeted = true;
      add('Salve, conquistador. Soy el Oráculo de Aurelius. Pregúntame del come todo, horarios, ubicación o lo que se te antoje.', 'bot');
    }
    if (open && matchMedia('(hover: hover)').matches) setTimeout(() => input.focus(), 300);
  };

  btn.addEventListener('click', () => toggle(!panel.classList.contains('is-open')));
  close.addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && toggle(false));

  chips.innerHTML = suggestions.map((s) => `<button type="button">${s}</button>`).join('');
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) send(b.textContent);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    send(v);
  });

  // API pública para la futura integración de IA
  window.AureliusOracle = { open: () => toggle(true), close: () => toggle(false), ask: send };
}
