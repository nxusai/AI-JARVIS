// Las piezas de una lección: fondo, marca, barra de avance, ventana de navegador en 3D,
// etiquetas, títulos de bloque, subtítulos.
import React from 'react';
import { Easing, Img, OffthreadVideo, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FUENTE } from '../fuentes';
import type { Palabra, Pantalla } from './tipos';

export const C = { fondo: '#050914', cian: '#00e5ff', azul: '#0a6cff', violeta: '#a01cff', ambar: '#ffb547', verde: '#c8ff3c' };
export const ACENTOS = [C.cian, C.violeta, C.ambar, C.cian, C.verde];

const fija = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Fondo vivo: rejilla en perspectiva que avanza, luces que flotan y polvo. */
export const Fondo: React.FC<{ acento: string }> = ({ acento }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 120%, #0b1a3a 0%, ${C.fondo} 60%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '-50%', right: '-50%', bottom: '-30%', height: '80%', transform: 'perspective(700px) rotateX(72deg)', transformOrigin: '50% 100%',
        backgroundImage: `linear-gradient(${acento}33 2px, transparent 2px), linear-gradient(90deg, ${acento}33 2px, transparent 2px)`, backgroundSize: '90px 90px',
        backgroundPosition: `0 ${(f * 2.2) % 90}px`, maskImage: 'linear-gradient(to top, black 10%, transparent 90%)', WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 90%)' }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: 'absolute', width: 1300, height: 1300, opacity: 0.4,
          background: `radial-gradient(circle, ${[acento, C.violeta, C.azul][i]} 0%, transparent 62%)`,
          left: `${20 + 30 * i + Math.sin(f / (90 + i * 30) + i) * 12}%`, top: `${-20 + Math.cos(f / (110 + i * 20) + i * 2) * 15}%`, transform: 'translate(-50%,0)' }} />
      ))}
      {Array.from({ length: 40 }, (_, i) => {
        const x = random(`x${i}`) * 1920, y0 = random(`y${i}`) * 1080, v = 0.2 + random(`v${i}`) * 0.6;
        return <div key={i} style={{ position: 'absolute', left: x, top: (y0 - f * v + 1080) % 1080, width: 3, height: 3, borderRadius: 2, background: '#fff', opacity: 0.15 + random(`o${i}`) * 0.35 }} />;
      })}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,.7) 100%)' }} />
    </div>
  );
};

/** Marca del curso arriba a la izquierda y barra de avance por bloques arriba a la derecha. */
export const Marca: React.FC<{ curso: string; numero: number; bloques: string[]; activo: number; avance: number }> = ({ curso, numero, bloques, activo, avance }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [20, 40], [0, 1], fija);
  return (
    <>
      <div style={{ position: 'absolute', left: 56, top: 44, display: 'flex', alignItems: 'center', gap: 16, opacity: o, fontFamily: FUENTE }}>
        <div style={{ width: 14, height: 14, borderRadius: 4, background: C.cian, boxShadow: `0 0 18px ${C.cian}` }} />
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 24, letterSpacing: '0.12em' }}>{curso.toUpperCase()}</div>
        <div style={{ color: '#ffffffaa', fontWeight: 500, fontSize: 20, padding: '4px 12px', border: '1px solid #ffffff33', borderRadius: 999 }}>Lección {numero}</div>
      </div>
      <div style={{ position: 'absolute', right: 56, top: 50, display: 'flex', gap: 10, opacity: o }}>
        {bloques.map((b, i) => {
          const lleno = i < activo ? 1 : i === activo ? avance : 0;
          return (
            <div key={b} style={{ width: 120, fontFamily: FUENTE }}>
              <div style={{ height: 5, borderRadius: 3, background: '#ffffff22', overflow: 'hidden' }}>
                <div style={{ width: `${lleno * 100}%`, height: '100%', background: ACENTOS[i], boxShadow: `0 0 10px ${ACENTOS[i]}` }} />
              </div>
              <div style={{ marginTop: 8, fontSize: 15, fontWeight: 900, letterSpacing: '0.1em', color: i === activo ? ACENTOS[i] : '#ffffff66' }}>{String(i + 1).padStart(2, '0')} {b}</div>
            </div>
          );
        })}
      </div>
    </>
  );
};

/** Una pantalla grabada dentro de una ventana de navegador flotando en 3D, que entra y sale girando. */
export const Navegador: React.FC<{ p: Pantalla; acento: string; lado: number }> = ({ p, acento, lado }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f, fps, config: { damping: 15, mass: 0.9 } });
  const sale = interpolate(f, [p.dur - 9, p.dur], [0, 1], { ...fija, easing: Easing.in(Easing.cubic) });
  const deriva = Math.sin(f / 40) * 1.2;
  const rotY = interpolate(entra, [0, 1], [38 * lado, -7 * lado]) + deriva - sale * 40 * lado;
  const rotX = interpolate(entra, [0, 1], [18, 5]);
  const x = interpolate(entra, [0, 1], [900 * lado, 0]) - sale * 1100 * lado;
  const escala = interpolate(entra, [0, 1], [0.7, 1]) * interpolate(f, [0, p.dur], [1, 1.05]);
  const desenfoque = (1 - entra) * 18 + sale * 22;

  // Acercamiento a una zona de la página (el contenido crece desde ese punto).
  let zx = 50, zy = 50, ze = 1;
  if (p.zoom) {
    const z = p.zoom;
    const k = interpolate(f, [z.desde, z.desde + 18, z.hasta, z.hasta + 18], [0, 1, 1, 0], { ...fija, easing: Easing.inOut(Easing.cubic) });
    ze = 1 + (z.escala - 1) * k; zx = z.x; zy = z.y;
  }
  const ancho = 1500, alto = 844;
  const contenido: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', transformOrigin: `${zx}% ${zy}%`, transform: `scale(${ze})` };
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: ancho, height: alto + 46, transform: `translate(${x}px, 30px) rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${escala})`, filter: desenfoque > 0.3 ? `blur(${desenfoque}px)` : undefined,
        opacity: Math.min(entra * 1.5, 1 - sale), borderRadius: 18, overflow: 'hidden', background: '#0b1224',
        boxShadow: `0 60px 120px rgba(0,0,0,.65), 0 0 0 1px ${acento}55, 0 0 60px ${acento}40` }}>
        <div style={{ height: 46, background: 'linear-gradient(#1a2440, #121a30)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
          <div style={{ marginLeft: 20, flex: 1, maxWidth: 640, height: 28, borderRadius: 14, background: '#0b1224', color: '#ffffffaa', fontFamily: FUENTE, fontSize: 16, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
            <span style={{ color: C.verde }}>●</span>{p.url}
          </div>
        </div>
        <div style={{ position: 'relative', width: ancho, height: alto, overflow: 'hidden' }}>
          {p.esImagen
            ? <Img src={staticFile(p.src)} style={{ ...contenido, transform: `scale(${ze * interpolate(f, [0, p.dur], [1, 1.12])})` }} />
            : <OffthreadVideo src={staticFile(p.src)} startFrom={Math.round(p.desde * fps)} playbackRate={p.velocidad ?? 1} muted style={contenido} />}
          {/* Reflejo de vidrio que cruza al entrar. */}
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, transparent ${interpolate(f, [0, 30], [-40, 120], fija)}%, rgba(255,255,255,.18) ${interpolate(f, [0, 30], [-30, 130], fija)}%, transparent ${interpolate(f, [0, 30], [-20, 140], fija)}%)` }} />
        </div>
      </div>
    </div>
  );
};

/** Letras que caen estiradas y se acomodan (para nombres de herramientas y títulos). */
export const Estirado: React.FC<{ texto: string; tamano: number; color?: string; desde?: number; cada?: number; italica?: boolean }> = ({ texto, tamano, color = '#fff', desde = 0, cada = 1.2, italica }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <span style={{ display: 'inline-block', whiteSpace: 'nowrap', fontFamily: FUENTE, fontWeight: 900, fontSize: tamano, color, letterSpacing: '-0.02em', fontStyle: italica ? 'italic' : 'normal' }}>
      {[...texto].map((c, i) => {
        const s = spring({ frame: f - desde - i * cada, fps, config: { damping: 10, mass: 0.5, stiffness: 150 } });
        return (
          <span key={i} style={{ display: 'inline-block', transformOrigin: '50% 100%', whiteSpace: 'pre',
            transform: `translateY(${interpolate(s, [0, 1], [-tamano * 0.5, 0])}px) scaleY(${interpolate(s, [0, 1], [3, 1])}) scaleX(${interpolate(s, [0, 1], [0.4, 1])})`,
            opacity: interpolate(s, [0, 0.2], [0, 1], fija) }}>{c}</span>
        );
      })}
    </span>
  );
};

/** Nombre de la herramienta y qué hace, abajo a la izquierda de la ventana. */
export const Etiqueta: React.FC<{ nombre: string; descripcion?: string; acento: string; dur: number }> = ({ nombre, descripcion, acento, dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 8, fps, config: { damping: 14 } });
  const sale = interpolate(f, [dur - 10, dur - 2], [0, 1], fija);
  return (
    <div style={{ position: 'absolute', left: 110, bottom: 150, transform: `translateX(${interpolate(s, [0, 1], [-80, 0]) - sale * 60}px)`, opacity: Math.min(s, 1 - sale) }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 18, padding: '14px 28px 14px 18px', borderRadius: 20, background: 'rgba(5,9,20,.88)', border: `1px solid ${acento}66`, boxShadow: `0 20px 50px rgba(0,0,0,.5), 0 0 40px ${acento}33` }}>
        <div style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, background: acento, boxShadow: `0 0 16px ${acento}` }} />
        <div>
          <Estirado texto={nombre} tamano={52} desde={10} />
          {descripcion && <div style={{ fontFamily: FUENTE, fontWeight: 500, fontSize: 24, color: '#ffffffcc', marginTop: 4, opacity: interpolate(f, [22, 32], [0, 1], fija) }}>{descripcion}</div>}
        </div>
      </div>
    </div>
  );
};

/** Texto con separación de color (glitch) que tiembla al entrar. */
export const Glitch: React.FC<{ texto: string; tamano: number; desde?: number }> = ({ texto, tamano, desde = 0 }) => {
  const f = useCurrentFrame() - desde;
  const fuerza = interpolate(f, [0, 10, 18], [1, 0.6, 0], fija) + (f % 23 < 2 && f > 18 ? 0.35 : 0);
  const dx = (random(`g${f}`) - 0.5) * 30 * fuerza;
  const capa = (color: string, x: number): React.CSSProperties => ({ position: 'absolute', inset: 0, color, transform: `translateX(${x}px)`, mixBlendMode: 'screen', opacity: fuerza > 0.01 ? 0.9 : 0 });
  const base: React.CSSProperties = { fontFamily: FUENTE, fontWeight: 900, fontSize: tamano, letterSpacing: '0.06em', whiteSpace: 'nowrap' };
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...base }}>
      <span style={capa('#ff2a6d', dx + 8 * fuerza)}>{texto}</span>
      <span style={capa('#00e5ff', -dx - 8 * fuerza)}>{texto}</span>
      <span style={{ position: 'relative', color: '#fff' }}>{texto}</span>
    </div>
  );
};

/** Subtítulos karaoke abajo al centro: líneas de pocas palabras, la que se dice en color. */
export const Subtitulos: React.FC<{ palabras: Palabra[]; acento: string; porLinea?: number }> = ({ palabras, acento, porLinea = 7 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  if (!palabras.length || t < palabras[0].inicio - 0.1 || t > palabras.at(-1).fin + 0.4) return null;
  let i = palabras.findIndex((p) => t < p.fin);
  if (i < 0) i = palabras.length - 1;
  const g = Math.floor(i / porLinea);
  const linea = palabras.slice(g * porLinea, g * porLinea + porLinea);
  const s = spring({ frame: f - Math.round(linea[0].inicio * fps), fps, config: { damping: 16 } });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 52, display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: '0 14px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1500, padding: '12px 26px', borderRadius: 16, background: 'rgba(0,0,0,.66)',
        transform: `translateY(${interpolate(s, [0, 1], [16, 0])}px)`, opacity: s }}>
        {linea.map((p, k) => {
          const ahora = t >= p.inicio && t < p.fin;
          return <span key={k} style={{ fontFamily: FUENTE, fontWeight: 900, fontSize: 40, color: ahora ? acento : t >= p.inicio ? '#fff' : '#ffffff77', transform: ahora ? 'scale(1.08)' : undefined, display: 'inline-block' }}>{p.texto}</span>;
        })}
      </div>
    </div>
  );
};

/** Destello de color para un corte. */
export const Flash: React.FC<{ en: number; color: string; fuerza?: number }> = ({ en, color, fuerza = 0.55 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [en - 1, en, en + 8], [0, fuerza, 0], fija);
  return <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 50%, #fff, ${color})`, opacity: o, mixBlendMode: 'screen' }} />;
};
