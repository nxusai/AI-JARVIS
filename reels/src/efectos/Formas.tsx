// Formas que se transforman (morphing): manchas de luz detrás del texto que cambian de forma sin parar.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/** Contorno cerrado y suave por puntos (Catmull-Rom → Bézier). */
const contorno = (pts: [number, number][]) => {
  const n = pts.length;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return d + ' Z';
};

const mancha = (cx: number, cy: number, r: number, t: number, semilla: number, n = 9) =>
  contorno(Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.22 * Math.sin(a * 3 + t * 1.4 + semilla) + 0.12 * Math.cos(a * 2 - t * 1.1 + semilla * 2);
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k] as [number, number];
  }));

export const Formas: React.FC<{ acento: string; segundo: string; semilla?: number; y?: number; desde?: number }> = ({ acento, segundo, semilla = 0, y = 0.46, desde = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const entra = spring({ frame: frame - desde, fps, config: { damping: 16 } });
  const cy = height * y;
  const r = width * 0.36 * entra;
  const g = `g${semilla}`;
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={acento} />
          <stop offset="1" stopColor={segundo} />
        </linearGradient>
        <filter id={`${g}b`}><feGaussianBlur stdDeviation="38" /></filter>
      </defs>
      <path d={mancha(width * 0.5 + Math.sin(t * 0.7) * 40, cy, r, t, semilla)} fill={`url(#${g})`} opacity={0.42} filter={`url(#${g}b)`} />
      <path d={mancha(width * 0.62, cy - 120, r * 0.55, t * 1.3, semilla + 3, 7)} fill={segundo} opacity={0.3} filter={`url(#${g}b)`} />
      {/* El aro que cambia de forma, nítido. */}
      <path d={mancha(width * 0.5, cy, r * 1.08, t * 0.9 + 2, semilla + 7, 11)} fill="none" stroke={acento} strokeWidth={3}
        opacity={interpolate(entra, [0, 1], [0, 0.55])} strokeDasharray="14 18" strokeDashoffset={-frame * 3} />
    </svg>
  );
};
