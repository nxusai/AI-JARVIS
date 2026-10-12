// A logo (PNG, ideally transparent) as a thick card that spins in and floats.
import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { ThreeCanvas } from '@remotion/three';
import { continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const Logo3D: React.FC<{ archivo: string; desde?: number; tamano?: number; grosor?: number; colorLado?: string }> = ({
  archivo, desde = 0, tamano = 3, grosor = 0.12, colorLado = '#111111',
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [handle] = useState(() => delayRender(`logo ${archivo}`));
  useEffect(() => {
    new THREE.TextureLoader().load(staticFile(archivo), (t) => { t.colorSpace = THREE.SRGBColorSpace; setTex(t); continueRender(handle); }, undefined, () => continueRender(handle));
  }, [archivo, handle]);
  const t = spring({ frame: frame - desde, fps, config: { damping: 12 } });
  const ratio = tex?.image ? (tex.image as HTMLImageElement).height / (tex.image as HTMLImageElement).width : 1;
  // Never wider than the frame (or taller), whatever size was asked.
  const visibleH = 2 * 9 * Math.tan((20 * Math.PI) / 180);
  const w = Math.min(tamano, visibleH * (width / height) * 0.86, (visibleH * 0.8) / ratio);
  return (
    <ThreeCanvas width={width} height={height} style={{ position: 'absolute', inset: 0 }} camera={{ fov: 40, position: [0, 0, 9] }}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 6]} intensity={1.6} />
      <group rotation={[0, interpolate(t, [0, 1], [Math.PI * 1.5, 0]) + Math.sin((frame - desde) / fps) * 0.15, 0]} position={[0, Math.sin(frame / fps * 2) * 0.08, 0]} scale={interpolate(t, [0, 1], [0.2, 1])}>
        <mesh>
          <boxGeometry args={[w, w * ratio, grosor]} />
          <meshStandardMaterial attach="material-0" color={colorLado} />
          <meshStandardMaterial attach="material-1" color={colorLado} />
          <meshStandardMaterial attach="material-2" color={colorLado} />
          <meshStandardMaterial attach="material-3" color={colorLado} />
          <meshStandardMaterial attach="material-4" map={tex ?? undefined} transparent />
          <meshStandardMaterial attach="material-5" color={colorLado} />
        </mesh>
      </group>
    </ThreeCanvas>
  );
};
