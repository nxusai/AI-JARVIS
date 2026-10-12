// Word-by-word captions: the word being said lights up and pops.
import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type Palabra = { texto: string; inicio: number; fin: number };
export const Subtitulos: React.FC<{ palabras: Palabra[]; porLinea?: number; color?: string; colorActiva?: string; tamano?: number; y?: string }> = ({
  palabras, porLinea = 3, color = '#ffffff', colorActiva = '#f5c518', tamano = 84, y = '72%',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = frame / fps;
  const i = palabras.findIndex((p) => now >= p.inicio && now < p.fin + 0.15);
  if (i < 0) return null;
  const start = Math.floor(i / porLinea) * porLinea;
  const line = palabras.slice(start, start + porLinea);
  return (
    <div style={{ position: 'absolute', left: '5%', right: '5%', top: y, display: 'flex', justifyContent: 'center', gap: tamano * 0.3, flexWrap: 'wrap' }}>
      {line.map((p, k) => {
        const active = start + k === i;
        const s = active ? spring({ frame: frame - Math.round(p.inicio * fps), fps, config: { damping: 10 } }) : 1;
        return (
          <span key={k} style={{ fontFamily: '"Arial Black", Arial, sans-serif', fontWeight: 900, fontSize: tamano, textTransform: 'uppercase', color: active ? colorActiva : color, transform: `scale(${active ? 0.85 + 0.25 * s : 1})`, textShadow: '0 6px 24px rgba(0,0,0,.7), 0 0 3px #000' }}>{p.texto}</span>
        );
      })}
    </div>
  );
};
