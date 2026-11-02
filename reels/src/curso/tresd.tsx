// Piezas en 3D real (Three.js): el título de la intro y los números de cada bloque.
import React, { useMemo } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { Center, Text3D } from '@react-three/drei';
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import fuente from './droid_sans_bold.typeface.json';

const Luces: React.FC<{ acento: string }> = ({ acento }) => (
  <>
    <ambientLight intensity={0.7} />
    <directionalLight position={[5, 6, 9]} intensity={2.6} />
    <directionalLight position={[-7, -3, 5]} intensity={1} color="#88aaff" />
    <pointLight position={[0, 0, 4]} intensity={30} color={acento} />
  </>
);

/** Polvo de luz alrededor del título. */
const Polvo: React.FC<{ color: string; cuantos?: number }> = ({ color, cuantos = 160 }) => {
  const f = useCurrentFrame();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(cuantos * 3);
    for (let i = 0; i < cuantos; i++) {
      pos[i * 3] = (random(`px${i}`) - 0.5) * 22;
      pos[i * 3 + 1] = (random(`py${i}`) - 0.5) * 12;
      pos[i * 3 + 2] = (random(`pz${i}`) - 0.5) * 10 - 2;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [cuantos]);
  return (
    <points geometry={geo} rotation={[0, f / 300, 0]}>
      <pointsMaterial color={color} size={0.06} transparent opacity={0.8} />
    </points>
  );
};

/** Título en letras 3D que entran girando, con un aro y polvo; la cámara se acerca despacio. */
export const Titulo3D: React.FC<{ texto: string; acento: string; desde?: number; tamano?: number }> = ({ texto, acento, desde = 0, tamano = 1 }) => {
  const f = useCurrentFrame() - desde;
  const { fps, width, height } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 14, mass: 1 } });
  const giro = interpolate(s, [0, 1], [-Math.PI * 0.6, 0]) + Math.sin(f / 50) * 0.08;
  const z = interpolate(f, [0, 240], [13, 10.5], { extrapolateRight: 'clamp' });
  return (
    <ThreeCanvas width={width} height={height} style={{ position: 'absolute', inset: 0 }} camera={{ fov: 38, position: [0, 0, z] }}>
      <Luces acento={acento} />
      <Polvo color={acento} />
      <group rotation={[0.12 * (1 - s), giro, 0]} scale={interpolate(s, [0, 1], [0.3, tamano])}>
        <Center>
          <Text3D font={fuente as never} size={1.15} height={0.45} bevelEnabled bevelSize={0.035} bevelThickness={0.06} curveSegments={8} letterSpacing={0.04}>
            {texto}
            <meshStandardMaterial color="#f2fbff" metalness={0.45} roughness={0.18} emissive={acento} emissiveIntensity={0.18} />
          </Text3D>
        </Center>
      </group>
      <mesh rotation={[Math.PI / 2.3, 0, f / 60]} scale={interpolate(s, [0, 1], [0.2, 1])}>
        <torusGeometry args={[5.4, 0.035, 16, 160]} />
        <meshBasicMaterial color={acento} />
      </mesh>
    </ThreeCanvas>
  );
};

/** El número de un bloque, gigante y metálico, que llega girando. */
export const Numero3D: React.FC<{ numero: number; acento: string }> = ({ numero, acento }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 12, mass: 0.8 } });
  return (
    <ThreeCanvas width={width} height={height} style={{ position: 'absolute', inset: 0 }} camera={{ fov: 38, position: [0, 0, 10] }}>
      <Luces acento={acento} />
      <group position={[-3.2, 0.2, 0]} rotation={[0.2 * (1 - s), interpolate(s, [0, 1], [Math.PI, -0.35]) + f / 200, 0]} scale={interpolate(s, [0, 1], [0.2, 1])}>
        <Center>
          <Text3D font={fuente as never} size={2.6} height={0.9} bevelEnabled bevelSize={0.06} bevelThickness={0.08} curveSegments={8}>
            {String(numero).padStart(2, '0')}
            <meshStandardMaterial color={acento} metalness={0.8} roughness={0.25} emissive={acento} emissiveIntensity={0.15} />
          </Text3D>
        </Center>
      </group>
    </ThreeCanvas>
  );
};
