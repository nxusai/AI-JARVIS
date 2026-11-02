// El resultado real de una herramienta, grande y al centro: la imagen o el video que se generó
// (flotando en 3D con brillo), o un audio con su onda y el texto que se oye.
import React from 'react';
import { Easing, Img, OffthreadVideo, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FUENTE } from '../fuentes';
import { Estirado } from './piezas';
import type { Pantalla } from './tipos';

const fija = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Onda de audio que late con barras (no lee el audio: es una animación con ritmo de voz). */
const Onda: React.FC<{ acento: string; activa: boolean }> = ({ acento, activa }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 220 }}>
      {Array.from({ length: 56 }, (_, i) => {
        const base = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.37 + f * 0.21) * Math.cos(i * 0.11 - f * 0.13));
        const ruido = random(`o${i}-${Math.floor(f / 3)}`) * 0.35;
        const alto = activa ? (base * 0.75 + ruido) * 200 : 10;
        return <div key={i} style={{ width: 9, height: Math.max(8, alto), borderRadius: 5, background: acento, boxShadow: `0 0 14px ${acento}aa`, opacity: 0.55 + (i % 3) * 0.15 }} />;
      })}
    </div>
  );
};

export const Resultado: React.FC<{ p: Pantalla; acento: string }> = ({ p, acento }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f, fps, config: { damping: 14, mass: 0.9 } });
  const sale = interpolate(f, [p.dur - 9, p.dur], [0, 1], { ...fija, easing: Easing.in(Easing.cubic) });
  const flota = Math.sin(f / 35) * 6;
  const sello = spring({ frame: f - 14, fps, config: { damping: 11 } });
  const marco: React.CSSProperties = {
    transform: `translateY(${flota + (1 - entra) * 120}px) rotateX(${(1 - entra) * 25}deg) rotateY(${Math.sin(f / 60) * 4}deg) scale(${interpolate(entra, [0, 1], [0.75, 1]) * (1 + sale * 0.15)})`,
    opacity: Math.min(entra * 1.4, 1 - sale), borderRadius: 26, overflow: 'hidden',
    boxShadow: `0 50px 110px rgba(0,0,0,.6), 0 0 0 2px ${acento}88, 0 0 90px ${acento}55`,
  };
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Halo de luz detrás */}
      <div style={{ position: 'absolute', width: 1500, height: 1000, background: `radial-gradient(ellipse, ${acento}44 0%, transparent 60%)`, opacity: entra }} />
      {p.resultado === 'audio' ? (
        <div style={{ ...marco, width: 1400, padding: '60px 70px', background: 'rgba(8,14,32,.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
          <Onda acento={acento} activa={f > 12 && f < p.dur - 12} />
          {p.texto && <div style={{ fontFamily: FUENTE, fontWeight: 900, fontSize: 52, color: '#fff', textAlign: 'center', lineHeight: 1.15 }}>“{p.texto}”</div>}
        </div>
      ) : (
        <div style={{ ...marco, width: 1280, height: 720, marginTop: -40, background: '#000' }}>
          {p.esImagen
            ? <Img src={staticFile(p.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${interpolate(f, [0, p.dur], [1.02, 1.12])})` }} />
            : <OffthreadVideo src={staticFile(p.src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          {/* Brillo que cruza al aparecer */}
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, transparent ${interpolate(f, [4, 34], [-40, 120], fija)}%, rgba(255,255,255,.28) ${interpolate(f, [4, 34], [-30, 130], fija)}%, transparent ${interpolate(f, [4, 34], [-20, 140], fija)}%)` }} />
        </div>
      )}
      {/* Sello "resultado" */}
      <div style={{ position: 'absolute', top: 96, left: '50%', transform: `translateX(-50%) scale(${interpolate(sello, [0, 1], [1.8, 1])})`, opacity: Math.min(sello, 1 - sale),
        display: 'flex', alignItems: 'center', gap: 14, padding: '10px 26px', borderRadius: 999, background: acento, color: '#050914', fontFamily: FUENTE, fontWeight: 900, fontSize: 30, letterSpacing: '0.12em', boxShadow: `0 0 40px ${acento}` }}>
        ✓ RESULTADO
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 118, textAlign: 'center', opacity: 1 - sale }}>
        <Estirado texto={p.etiqueta} tamano={44} desde={18} cada={0.8} />
      </div>
    </div>
  );
};
