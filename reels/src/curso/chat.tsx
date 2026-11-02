// Una conversación con Claude contada en tarjeta: lo que se le pide (se escribe letra por letra)
// y lo que responde (aparece línea por línea). El texto de la respuesta es real: lo escribió Claude.
import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FUENTE } from '../fuentes';
import type { Pantalla } from './tipos';

const fija = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const NARANJA = '#e8825a';

export const Chat: React.FC<{ p: Pantalla; acento: string }> = ({ p, acento }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f, fps, config: { damping: 15 } });
  const sale = interpolate(f, [p.dur - 9, p.dur], [0, 1], { ...fija, easing: Easing.in(Easing.cubic) });
  const pregunta = p.pregunta ?? '';
  const lineas = p.respuesta ?? [];
  // La pregunta se escribe en el primer 30 % y la respuesta aparece hasta el 80 %.
  const finPregunta = pregunta ? Math.max(20, Math.round(p.dur * 0.3)) : 4;
  const letras = pregunta ? Math.round(interpolate(f, [6, finPregunta], [0, pregunta.length], fija)) : 0;
  const inicioResp = finPregunta + 8;
  const finResp = Math.max(inicioResp + 10, Math.round(p.dur * 0.8));
  const visibles = interpolate(f, [inicioResp, finResp], [0, lineas.length], fija);
  const pensando = !!pregunta && f > finPregunta && f < inicioResp + 4;
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', width: 1500, height: 1000, background: `radial-gradient(ellipse, ${acento}33 0%, transparent 60%)`, opacity: entra }} />
      <div style={{ width: 1360, padding: '38px 48px 44px', borderRadius: 28, background: 'rgba(10,15,30,.94)', fontFamily: FUENTE,
        boxShadow: `0 50px 110px rgba(0,0,0,.6), 0 0 0 1px ${acento}55, 0 0 70px ${acento}33`,
        transform: `translateY(${(1 - entra) * 100 + Math.sin(f / 40) * 4}px) rotateX(${(1 - entra) * 18}deg) scale(${interpolate(entra, [0, 1], [0.85, 1]) * (1 + sale * 0.1)})`, opacity: Math.min(entra * 1.4, 1 - sale) }}>
        {/* Lo que se le pide */}
        {pregunta && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 26 }}>
          <div style={{ maxWidth: 1050, padding: '18px 26px', borderRadius: 22, background: '#1d2742', color: '#fff', fontSize: 31, fontWeight: 500, lineHeight: 1.35 }}>
            {pregunta.slice(0, letras)}
            {letras < pregunta.length && <span style={{ color: acento }}>▍</span>}
          </div>
        </div>}
        {/* Lo que responde Claude */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', opacity: f > finPregunta ? 1 : 0 }}>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: NARANJA, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 30, fontWeight: 900 }}>✳</div>
          <div style={{ flex: 1, color: '#e9eef9', fontSize: 30, lineHeight: 1.4, fontWeight: 500 }}>
            {pensando && <span style={{ color: '#ffffff88' }}>Pensando{'.'.repeat(1 + (Math.floor(f / 6) % 3))}</span>}
            {lineas.map((l, i) => {
              const o = interpolate(visibles - i, [0, 1], [0, 1], fija);
              const titulo = l.startsWith('# ');
              const texto = titulo ? l.slice(2) : l;
              return (
                <div key={i} style={{ opacity: o, transform: `translateY(${(1 - o) * 12}px)`, marginTop: titulo && i ? 14 : 4,
                  fontWeight: titulo ? 900 : 500, color: titulo ? acento : '#e9eef9', fontSize: titulo ? 32 : 29 }}>{texto}</div>
              );
            })}
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 92, left: '50%', transform: 'translateX(-50%)', opacity: Math.min(entra, 1 - sale), padding: '8px 22px', borderRadius: 999, border: `1px solid ${acento}88`, color: acento, fontFamily: FUENTE, fontWeight: 900, fontSize: 24, letterSpacing: '0.14em' }}>
        {p.etiqueta.toUpperCase()}
      </div>
    </div>
  );
};
