// A title in real 3D: extruded letters that turn in, with studio light.
import React from 'react';
import { ThreeCanvas } from '@remotion/three';
import { Center, Text3D } from '@react-three/drei';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import font from './fuentes/droid_sans_bold.typeface.json';

export const Titulo3D: React.FC<{
  texto: string;
  color?: string;
  metal?: number;
  tamano?: number;
  desde?: number;
  giro?: boolean;
}> = ({ texto, color = '#f5c518', metal = 0.6, tamano = 1, desde = 0, giro = true }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = spring({ frame: frame - desde, fps, config: { damping: 14, mass: 0.8 } });
  const rotY = interpolate(t, [0, 1], [-Math.PI / 2, 0]) + (giro ? Math.sin((frame - desde) / fps) * 0.12 : 0);
  // Fit the word to the frame's width (a reel is narrow): visible width at the text's depth, with margin.
  const visible = 2 * 9 * Math.tan((20 * Math.PI) / 180) * (width / height);
  const fit = Math.min(1.4, (visible * 0.82) / Math.max(1, texto.length * 0.8 * 0.9));
  const scale = interpolate(t, [0, 1], [0.4, 1]) * tamano * fit;
  return (
    <ThreeCanvas width={width} height={height} style={{ position: 'absolute', inset: 0 }} camera={{ fov: 40, position: [0, 0, 9] }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 8]} intensity={2.2} />
      <directionalLight position={[-6, -2, 4]} intensity={0.8} color="#88aaff" />
      <group rotation={[0.08, rotY, 0]} scale={scale}>
        <Center>
          <Text3D font={font as never} size={0.9} height={0.35} bevelEnabled bevelSize={0.03} bevelThickness={0.05} curveSegments={10}>
            {texto}
            <meshStandardMaterial color={color} metalness={metal} roughness={0.25} />
          </Text3D>
        </Center>
      </group>
    </ThreeCanvas>
  );
};
