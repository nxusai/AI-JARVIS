import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel';
import type { ReelProps } from './tipos';

const ejemplo: ReelProps = {
  tipo: 'gancho',
  clip: 'muestras/fondo-1.png',
  esImagen: true,
  duracion: 8,
  texto: 'Esta empresa me paga cada mes por algo que hice en una tarde',
  resaltar: ['cada', 'mes'],
  remate: 'Comenta JARVIS',
  firma: '@nxusai',
  camara: 'empuje',
  letras: 'estirar',
  formas: true,
  pieza3D: 'cristal',
  semilla: 0,
};

export const Root: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    fps={30}
    width={1080}
    height={1920}
    durationInFrames={240}
    defaultProps={ejemplo}
    // Nunca más de 10 s.
    calculateMetadata={({ props }) => ({ durationInFrames: Math.round(Math.min(10, Math.max(4, props.duracion)) * 30) })}
  />
);
