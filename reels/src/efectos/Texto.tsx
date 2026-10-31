// Texto animado: palabras que caen una por una (kinetic type) o letras que se estiran.
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FUENTE } from '../fuentes';
import type { Letras } from '../tipos';

const limpia = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Tamaño que cabe: frases largas, letra más chica. */
export const tamanoPara = (texto: string) => Math.round(Math.max(84, Math.min(150, 190 - texto.length * 2.1)));

export const Texto: React.FC<{
  texto: string;
  resaltar?: string[];
  modo: Letras;
  acento: string;
  desde?: number;
  /** Cuadros entre palabra y palabra (cinético). */
  cada?: number;
  y?: string;
  tamano?: number;
}> = ({ texto, resaltar = [], modo, acento, desde = 0, cada = 4, y = '46%', tamano }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = tamano ?? tamanoPara(texto);
  const hi = new Set(resaltar.map(limpia));
  const palabras = texto.split(/\s+/).filter(Boolean);
  let letra = 0;

  return (
    <div style={{ position: 'absolute', left: '7%', right: '7%', top: y, transform: 'translateY(-50%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `${t * 0.06}px ${t * 0.24}px`, lineHeight: 0.98 }}>
      {palabras.map((w, i) => {
        const on = hi.has(limpia(w));
        const base: React.CSSProperties = {
          fontFamily: FUENTE, fontWeight: 900, fontSize: t, textTransform: 'uppercase', letterSpacing: '-0.02em',
          fontStyle: on ? 'italic' : 'normal', color: on ? acento : '#ffffff',
          textShadow: on ? `0 0 28px ${acento}88, 0 6px 24px rgba(0,0,0,.6)` : '0 6px 26px rgba(0,0,0,.65)',
          display: 'inline-block',
        };
        if (modo === 'cinetico') {
          const s = spring({ frame: frame - desde - i * cada, fps, config: { damping: 12, mass: 0.55 } });
          return (
            <span key={i} style={{ ...base,
              transform: `translateY(${interpolate(s, [0, 1], [70, 0])}px) scale(${interpolate(s, [0, 1], [1.7, 1])}) rotate(${interpolate(s, [0, 1], [i % 2 ? 6 : -6, 0])}deg)`,
              opacity: interpolate(s, [0, 0.25], [0, 1], { extrapolateRight: 'clamp' }),
              filter: `blur(${interpolate(s, [0, 1], [10, 0])}px)`,
            }}>{w}</span>
          );
        }
        // Estirar: cada letra cae alargada y se encoge a su forma, con rebote.
        return (
          <span key={i} style={{ ...base, whiteSpace: 'nowrap' }}>
            {[...w].map((c, j) => {
              const k = letra++;
              const s = spring({ frame: frame - desde - k * 0.9, fps, config: { damping: 9, mass: 0.5, stiffness: 140 } });
              const respira = 1 + Math.sin((frame - k * 2) / 9) * 0.025 * Math.min(1, s);
              return (
                <span key={j} style={{ display: 'inline-block', transformOrigin: '50% 100%',
                  transform: `translateY(${interpolate(s, [0, 1], [-60, 0])}px) scaleY(${interpolate(s, [0, 1], [3.2, 1]) * respira}) scaleX(${interpolate(s, [0, 1], [0.45, 1])})`,
                  opacity: interpolate(s, [0, 0.2], [0, 1], { extrapolateRight: 'clamp' }),
                }}>{c}</span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};

/** La línea chica del final (remate) y el usuario. */
export const Remate: React.FC<{ texto?: string; firma?: string; desde: number; acento: string }> = ({ texto, firma, desde, acento }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - desde, fps, config: { damping: 14 } });
  const linea = interpolate(frame - desde, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: '66%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
      {texto && (
        <div style={{ fontFamily: FUENTE, fontWeight: 900, fontSize: 54, color: '#0a0f1e', background: acento, padding: '14px 30px', borderRadius: 18,
          transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`, opacity: s, boxShadow: `0 0 40px ${acento}77` }}>{texto}</div>
      )}
      {firma && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: linea }}>
          <div style={{ width: 70 * linea, height: 3, background: acento }} />
          <div style={{ fontFamily: FUENTE, fontWeight: 500, fontSize: 38, color: '#ffffffdd', letterSpacing: '0.04em' }}>{firma}</div>
          <div style={{ width: 70 * linea, height: 3, background: acento }} />
        </div>
      )}
    </div>
  );
};

/** Subtítulos palabra por palabra para la narración. */
export const Subtitulos: React.FC<{ palabras: { texto: string; inicio: number; fin: number }[]; acento: string; porLinea?: number }> = ({ palabras, acento, porLinea = 3 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const grupo = Math.floor(Math.max(0, palabras.findIndex((p) => t < p.fin) === -1 ? palabras.length - 1 : palabras.findIndex((p) => t < p.fin)) / porLinea);
  const linea = palabras.slice(grupo * porLinea, grupo * porLinea + porLinea);
  if (!linea.length || t < palabras[0].inicio - 0.05) return null;
  const s = spring({ frame: frame - Math.round(linea[0].inicio * fps), fps, config: { damping: 13 } });
  return (
    <div style={{ position: 'absolute', left: '6%', right: '6%', top: '62%', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0 22px', transform: `scale(${interpolate(s, [0, 1], [0.85, 1])})` }}>
      {linea.map((p, i) => {
        const dicha = t >= p.inicio;
        return (
          <span key={i} style={{ fontFamily: FUENTE, fontWeight: 900, fontSize: 82, textTransform: 'uppercase', color: t >= p.inicio && t < p.fin ? acento : dicha ? '#ffffff' : '#ffffff66',
            textShadow: '0 5px 22px rgba(0,0,0,.75)', WebkitTextStroke: '2px rgba(0,0,0,.4)' }}>{p.texto}</span>
        );
      })}
    </div>
  );
};
