// El clip con movimiento de cámara fluido y color de cine.
//   empuje  — se acerca despacio (push-in)
//   paneo   — barrido lateral con un leve giro
//   seguir  — cámara en mano que sigue al sujeto, con entrada en zoom rápido ("follow that camera")
//   orbita  — gira alrededor en perspectiva
import React from 'react';
import { Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Camara as Modo } from '../tipos';

export const Camara: React.FC<{ clip: string; esImagen?: boolean; modo: Modo; desdeSegundo?: number; golpeEn?: number }> = ({
  clip, esImagen, modo, desdeSegundo = 0, golpeEn,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: d } = useVideoConfig();
  const p = interpolate(frame, [0, d], [0, 1], { easing: Easing.inOut(Easing.cubic) });

  // Entrada: zoom rápido con desenfoque de movimiento, en todas.
  const entra = interpolate(frame, [0, 9], [1, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  let escala = 1.12 + entra * 0.45;
  let x = 0;
  let y = 0;
  let giro = 0;
  let giroY = 0;

  if (modo === 'empuje') {
    escala += p * 0.22;
    y = interpolate(p, [0, 1], [10, -18]);
  } else if (modo === 'paneo') {
    escala += 0.1;
    x = interpolate(p, [0, 1], [-5, 5]);
    giro = interpolate(p, [0, 1], [-1.2, 1.2]);
  } else if (modo === 'seguir') {
    const t = frame / fps;
    escala += 0.08 + p * 0.08;
    x = Math.sin(t * 1.3) * 1.6 + Math.sin(t * 3.1) * 0.5;
    y = Math.cos(t * 1.1) * 1.2 + Math.sin(t * 2.7) * 0.4;
    giro = Math.sin(t * 0.9) * 0.9;
  } else {
    escala += 0.14;
    giroY = interpolate(p, [0, 1], [-7, 7]);
    x = interpolate(p, [0, 1], [3, -3]);
  }

  // Golpe de zoom a mitad del reel (con el impacto).
  if (golpeEn != null) {
    escala *= interpolate(frame, [golpeEn - 2, golpeEn, golpeEn + 14], [1, 1.12, 1.04], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }

  const desenfoque = entra * 14;
  const estilo: React.CSSProperties = {
    width: '100%', height: '100%', objectFit: 'cover',
    transform: `perspective(1600px) translate(${x}%, ${y}px) rotate(${giro}deg) rotateY(${giroY}deg) scale(${escala})`,
    filter: `contrast(1.12) saturate(1.08) brightness(0.86) blur(${desenfoque}px)`,
  };
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      {esImagen ? <Img src={staticFile(clip)} style={estilo} /> : <OffthreadVideo src={staticFile(clip)} startFrom={Math.round(desdeSegundo * fps)} muted style={estilo} />}
      {/* Tinte frío en las sombras, como la marca. */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(5,9,20,.55) 0%, rgba(5,9,20,.05) 35%, rgba(5,9,20,.1) 60%, rgba(5,9,20,.75) 100%)' }} />
    </div>
  );
};
