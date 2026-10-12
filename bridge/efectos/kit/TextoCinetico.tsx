// Words that land one by one, big and bold, with one highlighted.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const TextoCinetico: React.FC<{
  texto: string;
  resaltar?: string[];
  color?: string;
  colorResalte?: string;
  tamano?: number;
  desde?: number;
  cadaCuadros?: number;
  y?: string;
  fuente?: string;
}> = ({ texto, resaltar = [], color = '#ffffff', colorResalte = '#f5c518', tamano = 110, desde = 0, cadaCuadros = 5, y = '50%', fuente = '"Arial Black", "Helvetica Neue", Arial, sans-serif' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = texto.split(/\s+/).filter(Boolean);
  const hi = new Set(resaltar.map((w) => w.toLowerCase()));
  return (
    <div style={{ position: 'absolute', left: '6%', right: '6%', top: y, transform: 'translateY(-50%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `0 ${tamano * 0.28}px`, lineHeight: 1.05 }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - desde - i * cadaCuadros, fps, config: { damping: 11, mass: 0.6 } });
        const on = hi.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
        return (
          <span key={i} style={{
            fontFamily: fuente, fontWeight: 900, fontSize: tamano, textTransform: 'uppercase',
            color: on ? colorResalte : color,
            transform: `translateY(${interpolate(s, [0, 1], [60, 0])}px) scale(${interpolate(s, [0, 1], [1.6, 1])})`,
            opacity: interpolate(s, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' }),
            filter: `blur(${interpolate(s, [0, 1], [12, 0])}px)`,
            textShadow: '0 8px 30px rgba(0,0,0,.55), 0 0 2px rgba(0,0,0,.9)',
            WebkitTextStroke: on ? '0' : '2px rgba(0,0,0,.35)',
          }}>{w}</span>
        );
      })}
    </div>
  );
};
