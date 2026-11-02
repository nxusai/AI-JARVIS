// Una lección completa: intro en 3D, bloques con título, pantallas grabadas en ventanas 3D,
// etiquetas, subtítulos, música y efectos de sonido. Los tiempos los calcula cursos/leccion.mjs.
import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import '../fuentes';
import { FUENTE } from '../fuentes';
import { ACENTOS, C, Estirado, Etiqueta, Flash, Fondo, Glitch, Marca, Navegador, Subtitulos } from './piezas';
import { Numero3D, Titulo3D } from './tresd';
import type { Escena, LeccionProps } from './tipos';

const fija = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const TITULO = 42; // cuadros que dura la entrada de cada bloque

/** Entrada de bloque: número 3D, nombre con glitch y barrido de luz; sale atravesando la cámara. */
const EntradaBloque: React.FC<{ numero: number; nombre: string; acento: string }> = ({ numero, nombre, acento }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sale = interpolate(f, [TITULO - 12, TITULO], [0, 1], fija);
  const s = spring({ frame: f - 4, fps, config: { damping: 13 } });
  return (
    <AbsoluteFill style={{ opacity: 1 - sale, transform: `scale(${1 + sale * 2.2})`, filter: sale > 0.02 ? `blur(${sale * 14}px)` : undefined }}>
      <AbsoluteFill style={{ background: `linear-gradient(90deg, rgba(5,9,20,.92) 40%, rgba(5,9,20,.6))` }} />
      <Numero3D numero={numero} acento={acento} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-10%, -50%) translateX(${interpolate(s, [0, 1], [120, 0])}px)`, opacity: s }}>
        <div style={{ fontFamily: FUENTE, fontWeight: 500, fontSize: 30, letterSpacing: '0.4em', color: acento, marginBottom: 10 }}>BLOQUE {numero}</div>
        <Glitch texto={nombre} tamano={Math.min(150, 1500 / nombre.length)} desde={6} />
      </div>
      {/* Barrido de luz */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, width: 260, left: `${interpolate(f, [0, TITULO], [-20, 110])}%`, background: `linear-gradient(90deg, transparent, ${acento}55, transparent)`, transform: 'skewX(-20deg)', mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  );
};

const Intro: React.FC<{ e: Escena; titulo: string; numero: number }> = ({ e, titulo, numero }) => {
  const f = useCurrentFrame();
  const sube = interpolate(f, [e.dur - 40, e.dur], [0, 1], fija);
  return (
    <AbsoluteFill style={{ opacity: 1 - sube * 0.9 }}>
      <AbsoluteFill style={{ transform: `translateY(${-sube * 120}px) scale(${1 + sube * 0.4})` }}>
        <Titulo3D texto="HIGGSFIELD" acento={C.cian} desde={6} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 700, textAlign: 'center' }}>
        <div style={{ fontFamily: FUENTE, fontWeight: 500, fontSize: 28, letterSpacing: '0.5em', color: C.cian, opacity: interpolate(f, [30, 45], [0, 1], fija) }}>LECCIÓN {numero}</div>
        <div style={{ marginTop: 14 }}><Estirado texto={titulo} tamano={54} desde={40} cada={0.7} /></div>
      </div>
      <Flash en={7} color={C.cian} fuerza={0.8} />
    </AbsoluteFill>
  );
};

const Pantallas: React.FC<{ e: Escena; acento: string }> = ({ e, acento }) => {
  const conTitulo = !!e.bloque;
  return (
    <AbsoluteFill>
      {e.pantallas.map((p, i) => (
        <Sequence key={i} from={p.inicio} durationInFrames={p.dur}>
          <Navegador p={p} acento={acento} lado={i % 2 ? -1 : 1} />
          <Etiqueta nombre={p.etiqueta} descripcion={p.descripcion} acento={acento} dur={p.dur} />
        </Sequence>
      ))}
      {e.pantallas.slice(1).map((p, i) => <Flash key={i} en={p.inicio} color={acento} fuerza={0.35} />)}
      {conTitulo && (
        <Sequence durationInFrames={TITULO}>
          <EntradaBloque numero={e.bloque.numero} nombre={e.bloque.nombre} acento={acento} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

/** Cierre: los cinco bloques en tarjetas sobre un arco que se prenden al nombrarlos; luego la marca. */
const Final: React.FC<{ e: Escena; bloques: string[]; curso: string }> = ({ e, bloques, curso }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fin = e.marcas?.[5] ?? e.dur - 90;
  const vuela = interpolate(f, [fin, fin + 20], [0, 1], fija);
  const marca = spring({ frame: f - fin - 10, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ perspective: 2000, alignItems: 'center', justifyContent: 'center', opacity: 1 - vuela, transform: `scale(${1 + vuela * 0.6})`, filter: vuela > 0.02 ? `blur(${vuela * 10}px)` : undefined }}>
        {bloques.map((b, i) => {
          const s = spring({ frame: f - 4 - i * 4, fps, config: { damping: 14 } });
          const on = f >= (e.marcas?.[i] ?? 0);
          const angulo = (i - 2) * 16;
          const ac = ACENTOS[i];
          return (
            <div key={b} style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -150, marginTop: -230, width: 300, height: 420, borderRadius: 24, overflow: 'hidden',
              transform: `translateX(${(i - 2) * 330}px) translateZ(${-Math.abs(i - 2) * 120}px) rotateY(${-angulo}deg) translateY(${interpolate(s, [0, 1], [400, on ? -20 : 0])}px)`,
              opacity: s, background: '#0b1224', border: `2px solid ${on ? ac : '#ffffff22'}`, boxShadow: on ? `0 0 60px ${ac}88, 0 30px 60px rgba(0,0,0,.6)` : '0 30px 60px rgba(0,0,0,.6)' }}>
              {e.miniaturas?.[i] && <Img src={staticFile(e.miniaturas[i])} style={{ width: '100%', height: 230, objectFit: 'cover', filter: on ? 'none' : 'grayscale(1) brightness(.4)' }} />}
              <div style={{ padding: 22, fontFamily: FUENTE }}>
                <div style={{ fontSize: 64, fontWeight: 900, color: on ? ac : '#ffffff33' }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: on ? '#fff' : '#ffffff55', letterSpacing: '0.08em' }}>{b}</div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      {e.marcas?.slice(0, 5).map((m, i) => <Flash key={i} en={m} color={ACENTOS[i]} fuerza={0.25} />)}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: marca }}>
        <div style={{ textAlign: 'center', transform: `scale(${interpolate(marca, [0, 1], [0.8, 1])})` }}>
          <Glitch texto={curso.toUpperCase()} tamano={130} desde={fin + 10} />
          <div style={{ fontFamily: FUENTE, fontWeight: 500, fontSize: 32, color: '#ffffffcc', marginTop: 18, letterSpacing: '0.2em' }}>SIGUIENTE LECCIÓN →</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Leccion: React.FC<LeccionProps> = (p) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const actual = p.escenas.findLast((e) => f >= e.inicio) ?? p.escenas[0];
  const bloque = actual.bloque ? actual.bloque.numero - 1 : actual.tipo === 'final' ? 5 : -1;
  const acento = bloque >= 0 && bloque < 5 ? ACENTOS[bloque] : C.cian;
  const avance = (f - actual.inicio) / actual.dur;
  // Música más alta sin voz (intro y cierre), más baja debajo de la voz.
  const musica = (cuadro: number) => interpolate(cuadro, [0, 25, 45, durationInFrames - 110, durationInFrames - 70, durationInFrames], [0, 0.32, 0.13, 0.13, 0.3, 0], fija);

  return (
    <AbsoluteFill style={{ background: C.fondo }}>
      <Fondo acento={acento} />
      {p.escenas.map((e, i) => (
        <Sequence key={i} from={e.inicio} durationInFrames={e.dur}>
          {e.tipo === 'intro' && <Intro e={e} titulo={p.titulo} numero={p.numero} />}
          {e.tipo === 'pantallas' && <Pantallas e={e} acento={e.bloque ? ACENTOS[e.bloque.numero - 1] : C.cian} />}
          {e.tipo === 'final' && <Final e={e} bloques={p.bloques} curso={p.curso} />}
          <Sequence from={e.vozDesde}>
            <Subtitulos palabras={e.palabras.map((w) => ({ ...w, inicio: w.inicio - e.vozDesde / 30, fin: w.fin - e.vozDesde / 30 }))} acento={e.bloque ? ACENTOS[e.bloque.numero - 1] : C.cian} />
            <Audio src={staticFile(e.voz)} />
          </Sequence>
          {/* Whoosh en cada entrada de pantalla y golpe en cada bloque. */}
          {(e.pantallas ?? []).map((s, k) => (
            <Sequence key={k} from={Math.max(0, s.inicio - 4)} durationInFrames={30}><Audio src={staticFile('sonidos/whoosh.wav')} volume={0.4} /></Sequence>
          ))}
          {(e.bloque || e.tipo !== 'pantallas') && <Sequence durationInFrames={30}><Audio src={staticFile('sonidos/impacto.wav')} volume={0.6} /></Sequence>}
        </Sequence>
      ))}
      {f > 30 && <Marca curso={p.curso} numero={p.numero} bloques={p.bloques} activo={bloque} avance={Math.min(1, avance)} />}
      <Audio src={staticFile(p.musica)} volume={musica} />
    </AbsoluteFill>
  );
};
