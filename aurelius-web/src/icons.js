// Iconos de línea para la Ruta de la Conquista (64×64, trazo dorado).
const wrap = (body) =>
  `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  taco: wrap(`
    <path d="M6 44c0-14 11.6-26 26-26s26 12 26 26z"/>
    <path d="M12 40c2-4 5-4 7-1s5 3 7 0 5-3 7 0 5 3 7 0 5-3 7 1"/>
    <circle cx="22" cy="32" r="1.6"/><circle cx="34" cy="28" r="1.6"/><circle cx="44" cy="33" r="1.6"/>
    <path d="M6 44h52"/>`),
  quesadilla: wrap(`
    <path d="M8 40a24 24 0 0 1 48 0z"/>
    <path d="M18 40v5c0 2 3 2 3 0v-3M30 40v8c0 2 3 2 3 0v-6M42 40v4c0 2 3 2 3 0v-2"/>
    <path d="M16 30c4-6 10-9 16-9"/>`),
  flauta: wrap(`
    <rect x="6" y="14" width="44" height="9" rx="4.5" transform="rotate(-12 28 18)"/>
    <rect x="10" y="28" width="46" height="9" rx="4.5" transform="rotate(-6 33 32)"/>
    <rect x="8" y="42" width="44" height="9" rx="4.5" transform="rotate(4 30 46)"/>
    <path d="M14 47c3 2 8 2 11 0M30 33c3 2 8 2 11 0"/>`),
  pozole: wrap(`
    <path d="M6 30h52c0 14-11.6 24-26 24S6 44 6 30z"/>
    <path d="M24 54l-2 4h20l-2-4"/>
    <path d="M20 22c-3-4 3-6 0-10M32 22c-3-4 3-6 0-10M44 22c-3-4 3-6 0-10"/>
    <circle cx="22" cy="38" r="2"/><circle cx="30" cy="42" r="2"/><circle cx="40" cy="37" r="2"/>`),
  wing: wrap(`
    <path d="M38 8c10 0 18 8 18 18 0 9-6 15-14 17l-9 2-12 12"/>
    <path d="M38 8c-9 0-16 7-17 16l-1 8-8 8"/>
    <circle cx="10" cy="44" r="4"/><circle cx="18" cy="56" r="4"/>
    <path d="M30 22c3-3 8-3 11 0"/>`),
  burger: wrap(`
    <path d="M8 26c0-10 10.7-16 24-16s24 6 24 16z"/>
    <path d="M6 32h52"/>
    <path d="M8 38c4 3 8-3 12 0s8 3 12 0 8-3 12 0 8 3 12 0"/>
    <path d="M8 44h48c0 6-4 10-10 10H18C12 54 8 50 8 44z"/>
    <path d="M22 18h.01M32 15h.01M42 18h.01" stroke-width="3.4"/>`),
  fries: wrap(`
    <path d="M14 28l4 30h28l4-30z"/>
    <path d="M14 28c6 6 30 6 36 0"/>
    <path d="M20 28V10M27 28V6M34 28V9M41 28V7M46 28V13"/>`),
};

// Corona de laurel dibujada a mano: dos ramas sobre un arco.
export function laurel({ leaves = 9, size = 120, stroke = 'currentColor' } = {}) {
  const r = size * 0.42;
  const cx = size / 2;
  const cy = size / 2;
  let paths = '';
  for (const side of [-1, 1]) {
    for (let i = 0; i < leaves; i++) {
      const t = 0.18 + (i / leaves) * 0.72;
      const ang = Math.PI / 2 + side * t * Math.PI * 0.95;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      const rot = (ang * 180) / Math.PI + (side > 0 ? 60 : 120);
      const L = size * 0.11;
      const W = size * 0.04;
      paths += `<path d="M0 0 C ${W} ${-L * 0.4}, ${W} ${-L * 0.8}, 0 ${-L} C ${-W} ${-L * 0.8}, ${-W} ${-L * 0.4}, 0 0Z" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})"/>`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" fill="${stroke}" aria-hidden="true">${paths}</svg>`;
}

export const svgWhatsApp = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.6-.3z"/></svg>`;

export const svgInstagram = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>`;
export const svgFacebook = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z"/></svg>`;
export const svgTiktok = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 3c.4 2.3 1.9 3.8 4 4v3.2c-1.5 0-2.9-.4-4-1.2V15a6 6 0 1 1-6-6v3.3a2.7 2.7 0 1 0 2.7 2.7V3z"/></svg>`;
export const svgPin = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>`;
export const svgPhone = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>`;
export const svgBolt = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>`;

// Banderas simplificadas (3:2) para «Próximas conquistas».
const tri = (a, b, c) => `<rect width="20" height="40" fill="${a}"/><rect x="20" width="20" height="40" fill="${b}"/><rect x="40" width="20" height="40" fill="${c}"/>`;
const usStripes = Array.from({ length: 7 }, (_, i) => `<rect y="${i * 6.15}" width="60" height="3.08" fill="#b22234"/>`).join('');
export const flags = {
  mx: tri('#006847', '#f4efe4', '#ce1126') + '<circle cx="30" cy="20" r="4.5" fill="#8a5a1a"/>',
  it: tri('#009246', '#f4efe4', '#ce2b37'),
  kr: '<rect width="60" height="40" fill="#f4efe4"/><path d="M22 20a8 8 0 0 1 16 0a4 4 0 0 1-8 0a4 4 0 0 0-8 0z" fill="#cd2e3a"/><path d="M22 20a8 8 0 0 0 16 0a4 4 0 0 0-8 0a4 4 0 0 1-8 0z" fill="#0047a0"/><g stroke="#111" stroke-width="1.6"><path d="M8 8l6 4M7 10l6 4M6 12l6 4M46 24l6 4M45 26l6 4M44 28l6 4M46 16l6-4M45 14l6-4M8 32l6-4M7 30l6-4"/></g>',
  jp: '<rect width="60" height="40" fill="#f4efe4"/><circle cx="30" cy="20" r="10" fill="#bc002d"/>',
  us: `<rect width="60" height="40" fill="#f4efe4"/>${usStripes}<rect width="26" height="21.5" fill="#3c3b6e"/>`,
  vote: '<rect width="60" height="40" fill="#f4b521"/><text x="30" y="30" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="28" fill="#0b0906">?</text>',
};
export const flag = (id) => `<svg viewBox="0 0 60 40" aria-hidden="true">${flags[id] || flags.vote}</svg>`;
