import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel';
import type { ReelProps } from './tipos';

// Solo lo indispensable: Remotion mezcla estos valores con los de cada reel,
// así que nada opcional (remate, 3D, formas…) va aquí o se colaría en todos.
const base: ReelProps = {
  tipo: 'gancho',
  clip: 'muestras/fondo-1.png',
  esImagen: true,
  duracion: 8,
  texto: 'Esta empresa me paga cada mes por algo que hice en una tarde',
};

export const Root: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    fps={30}
    width={1080}
    height={1920}
    durationInFrames={240}
    defaultProps={base}
    // Nunca más de 10 s.
    calculateMetadata={({ props }) => ({ durationInFrames: Math.round(Math.min(10, Math.max(4, props.duracion)) * 30) })}
  />
);
