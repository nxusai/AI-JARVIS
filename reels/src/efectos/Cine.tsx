// Acabado de cine: viñeta, grano, destello de luz que cruza y barras que entran.
import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export const Cine: React.FC<{ barras?: boolean; color: string }> = ({ barras = true, color }) => {
  const frame = useCurrentFrame();
  const { durationInFrames: d, height } = useVideoConfig();
  const barra = barras ? interpolate(frame, [0, 18], [0, height * 0.075], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }) : 0;
  const luzX = interpolate(frame, [0, d], [-40, 140]);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,.65) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen', opacity: 0.35, background: `radial-gradient(circle at ${luzX}% 20%, ${color}88 0%, transparent 38%)` }} />
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.09, mixBlendMode: 'overlay' }}>
        <filter id="grano">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 12} stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grano)" />
      </svg>
      {barra > 0 && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: barra, background: '#000' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: barra, background: '#000' }} />
        </>
      )}
    </>
  );
};

/** Un destello para marcar un corte o un golpe. */
export const Destello: React.FC<{ en: number; color?: string; fuerza?: number }> = ({ en, color = '#ffffff', fuerza = 0.7 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [en - 1, en, en + 7], [0, fuerza, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', inset: 0, background: color, opacity: o, mixBlendMode: 'screen' }} />;
};
