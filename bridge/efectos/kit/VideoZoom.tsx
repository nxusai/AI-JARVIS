// A clip with punch-in zooms (and a little shake) at the moments given.
import React from 'react';
import { OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const VideoZoom: React.FC<{ archivo: string; zooms?: { segundo: number; escala?: number }[]; sacudida?: boolean; desdeSegundo?: number; volumen?: number }> = ({
  archivo, zooms = [], sacudida = false, desdeSegundo = 0, volumen = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let scale = 1;
  for (const z of zooms) {
    const f = z.segundo * fps;
    scale *= interpolate(frame, [f - 3, f, f + fps * 0.8], [1, z.escala ?? 1.25, (z.escala ?? 1.25) * 0.97], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }
  const shake = sacudida ? Math.sin(frame * 1.7) * 4 : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <OffthreadVideo src={staticFile(archivo)} startFrom={Math.round(desdeSegundo * fps)} volume={volumen} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale}) translate(${shake}px, ${-shake}px)` }} />
    </div>
  );
};
