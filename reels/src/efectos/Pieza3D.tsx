// Elementos 3D reales (Three.js): un cristal o un aro metálico que entra girando y flota.
import React from 'react';
import { ThreeCanvas } from '@remotion/three';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Pieza3D as Tipo } from '../tipos';

export const Pieza3D: React.FC<{ tipo: Exclude<Tipo, 'ninguna'>; acento: string; desde?: number; arriba?: boolean }> = ({ tipo, acento, desde = 0, arriba = true }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = spring({ frame: frame - desde, fps, config: { damping: 13, mass: 0.9 } });
  const t = (frame - desde) / fps;
  const escala = interpolate(s, [0, 1], [0.01, 0.62]);
  const y = (arriba ? 3.6 : -3.6) + Math.sin(t * 1.6) * 0.15;
  const giro = interpolate(s, [0, 1], [-Math.PI, 0]) + t * 0.7;
  return (
    <ThreeCanvas width={width} height={height} style={{ position: 'absolute', inset: 0 }} camera={{ fov: 40, position: [0, 0, 12] }}>
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 6, 8]} intensity={2.4} />
      <pointLight position={[-4, -2, 5]} intensity={40} color={acento} />
      <group position={[1.35, y, 0]} rotation={[0.4 + t * 0.3, giro, 0.2]} scale={escala}>
        {tipo === 'cristal' ? (
          <>
            <mesh>
              <icosahedronGeometry args={[1.1, 0]} />
              <meshStandardMaterial color="#16305e" metalness={0.6} roughness={0.25} emissive={acento} emissiveIntensity={0.12} flatShading />
            </mesh>
            <mesh scale={1.02}>
              <icosahedronGeometry args={[1.1, 0]} />
              <meshBasicMaterial color={acento} wireframe />
            </mesh>
          </>
        ) : (
          <mesh>
            <torusGeometry args={[1, 0.32, 32, 96]} />
            <meshStandardMaterial color={acento} metalness={0.85} roughness={0.2} emissive={acento} emissiveIntensity={0.15} />
          </mesh>
        )}
      </group>
    </ThreeCanvas>
  );
};
