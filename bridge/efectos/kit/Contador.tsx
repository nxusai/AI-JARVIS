// A number that counts up fast and settles, e.g. "+5,000 clientes".
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Contador: React.FC<{ hasta: number; antes?: string; despues?: string; desde?: number; color?: string; tamano?: number; y?: string }> = ({
  hasta, antes = '', despues = '', desde = 0, color = '#ffffff', tamano = 180, y = '50%',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - desde, fps, config: { damping: 30, mass: 1.2 }, durationInFrames: Math.round(fps * 1.4) });
  const n = Math.round(interpolate(s, [0, 1], [0, hasta]));
  return (
    <div style={{ position: 'absolute', width: '100%', top: y, transform: `translateY(-50%) scale(${interpolate(s, [0, 1], [0.7, 1])})`, textAlign: 'center', fontFamily: '"Arial Black", Arial, sans-serif', fontWeight: 900, fontSize: tamano, color, textShadow: '0 10px 40px rgba(0,0,0,.6)' }}>
      {antes}{n.toLocaleString('en-US')}{despues}
    </div>
  );
};
