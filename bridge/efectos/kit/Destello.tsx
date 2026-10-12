// A white flash (or any colour) for a hard cut or a beat.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export const Destello: React.FC<{ en: number; color?: string; duracion?: number }> = ({ en, color = '#ffffff', duracion = 8 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [en - 2, en, en + duracion], [0, 0.9, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', inset: 0, background: color, opacity: o, pointerEvents: 'none' }} />;
};
