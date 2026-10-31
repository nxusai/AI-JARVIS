// Inter Display, cargada antes del primer cuadro para que el texto nunca salga con otra letra.
import { continueRender, delayRender, staticFile } from 'remotion';

export const FUENTE = '"Inter Display", "Arial Black", sans-serif';

const caras: [string, string, string][] = [
  ['InterDisplay-Black.otf', '900', 'normal'],
  ['InterDisplay-BlackItalic.otf', '900', 'italic'],
  ['InterDisplay-Medium.otf', '500', 'normal'],
];

if (typeof window !== 'undefined' && 'FontFace' in window) {
  const espera = delayRender('Cargando fuentes');
  Promise.all(
    caras.map(([archivo, weight, style]) => {
      const f = new FontFace('Inter Display', `url(${staticFile(`fuentes/${archivo}`)})`, { weight, style });
      return f.load().then((cargada) => document.fonts.add(cargada));
    }),
  )
    .then(() => continueRender(espera))
    .catch((err) => {
      console.error('No cargó la fuente', err);
      continueRender(espera);
    });
}
