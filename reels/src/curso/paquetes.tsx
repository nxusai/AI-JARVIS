// Tres paquetes de precio, lado a lado: entran uno por uno y el recomendado se levanta y brilla.
import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FUENTE } from '../fuentes';
import type { Pantalla } from './tipos';

const fija = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const Paquetes: React.FC<{ p: Pantalla; acento: string }> = ({ p, acento }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lista = p.paquetes ?? [];
  const sale = interpolate(f, [p.dur - 9, p.dur], [0, 1], { ...fija, easing: Easing.in(Easing.cubic) });
  const resalta = interpolate(f, [p.dur * 0.45, p.dur * 0.55], [0, 1], fija);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', perspective: 2000, opacity: 1 - sale }}>
      <div style={{ fontFamily: FUENTE, color: acento, fontWeight: 900, fontSize: 28, letterSpacing: '0.14em', marginBottom: 90 }}>{p.etiqueta.toUpperCase()}</div>
      <div style={{ display: 'flex', gap: 34, alignItems: 'center' }}>
        {lista.map((q, i) => {
          const s = spring({ frame: f - 6 - i * 7, fps, config: { damping: 13 } });
          const top = q.destacado ? resalta : 0;
          return (
            <div key={i} style={{ width: 430, padding: '36px 34px 40px', borderRadius: 28, fontFamily: FUENTE, background: q.destacado ? '#121b38' : '#0d1428',
              border: `2px solid ${q.destacado ? acento : '#ffffff1f'}`, boxShadow: q.destacado ? `0 0 ${70 * top}px ${acento}88, 0 40px 80px rgba(0,0,0,.5)` : '0 30px 60px rgba(0,0,0,.45)',
              transform: `translateY(${(1 - s) * 260 - top * 40}px) rotateY(${(i - 1) * -10 * (1 - top * 0.6)}deg) scale(${1 + top * 0.08})`, opacity: s }}>
              {q.destacado && <div style={{ display: 'inline-block', marginBottom: 14, padding: '6px 16px', borderRadius: 999, background: acento, color: '#06101e', fontWeight: 900, fontSize: 18, letterSpacing: '0.1em', opacity: top }}>{q.insignia ?? 'RECOMENDADO'}</div>}
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 34 }}>{q.nombre}</div>
              <div style={{ marginTop: 10, color: q.destacado ? acento : '#fff', fontWeight: 900, fontSize: 56 }}>{q.precio}<span style={{ fontSize: 22, color: '#ffffff88', fontWeight: 500 }}>{q.periodo ?? ' /mes'}</span></div>
              <div style={{ marginTop: 18, borderTop: '1px solid #ffffff1a', paddingTop: 18 }}>
                {q.incluye.map((x, k) => (
                  <div key={k} style={{ color: '#d9e1f5', fontSize: 23, lineHeight: 1.5, opacity: interpolate(f - 14 - i * 7 - k * 4, [0, 8], [0, 1], fija) }}>✓ {x}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {p.descripcion && <div style={{ marginTop: 34, fontFamily: FUENTE, color: '#ffffff99', fontSize: 22 }}>{p.descripcion}</div>}
    </div>
  );
};
