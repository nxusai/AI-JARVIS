// Un reel de máximo 10 s: clip con cámara, texto animado, formas, 3D, acabado de cine y, si toca, voz.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import './fuentes';
import { Camara } from './efectos/Camara';
import { Cine, Destello } from './efectos/Cine';
import { Formas } from './efectos/Formas';
import { Pieza3D } from './efectos/Pieza3D';
import { Remate, Subtitulos, Texto } from './efectos/Texto';
import { COLORES, acento as acentoDe, type ReelProps } from './tipos';

export const Reel: React.FC<ReelProps> = (p) => {
  const { fps, durationInFrames: d } = useVideoConfig();
  const acento = acentoDe(p.semilla);
  const segundo = acento === COLORES.violeta ? COLORES.azul : COLORES.violeta;
  const narrado = p.tipo === 'narrado';
  const frase = p.tipo === 'frase';
  // El gancho se lee desde el cuadro 3; la frase entra con calma.
  const textoDesde = frase ? Math.round(fps * 0.5) : 3;
  const golpe = Math.round(d * 0.45);
  const remateDesde = d - Math.round(fps * 2.2);

  return (
    <AbsoluteFill style={{ background: COLORES.fondo }}>
      <Camara clip={p.clip} esImagen={p.esImagen} modo={p.camara ?? 'empuje'} desdeSegundo={p.desdeSegundo} golpeEn={frase ? undefined : golpe} />
      {p.formas && <Formas acento={acento} segundo={segundo} semilla={p.semilla} y={narrado ? 0.3 : 0.46} desde={frase ? 6 : 0} />}
      {p.pieza3D && p.pieza3D !== 'ninguna' && <Pieza3D tipo={p.pieza3D} acento={acento} desde={frase ? 20 : 8} arriba />}
      <Texto texto={p.texto} resaltar={p.resaltar} modo={p.letras ?? 'cinetico'} acento={acento} desde={textoDesde} cada={frase ? 7 : 3}
        y={narrado ? '30%' : '46%'} tamano={narrado ? Math.min(104, Math.max(76, 150 - p.texto.length * 2)) : undefined} />
      {narrado && p.palabras?.length ? <Subtitulos palabras={p.palabras} acento={acento} /> : null}
      {!narrado && (p.remate || p.firma) && <Remate texto={p.remate} firma={p.firma} desde={remateDesde} acento={acento} />}
      {narrado && p.firma && <Remate firma={p.firma} desde={remateDesde} acento={acento} y="76%" />}
      <Cine barras={p.cine ?? frase} color={acento} />
      {!frase && <Destello en={golpe} color={acento} fuerza={0.45} />}
      <Destello en={1} fuerza={0.5} />

      {p.voz && <Sequence from={Math.round(fps * 0.35)}><Audio src={staticFile(p.voz)} /></Sequence>}
      {p.sonidos?.whoosh && <Audio src={staticFile(p.sonidos.whoosh)} volume={0.55} />}
      {p.sonidos?.impacto && !frase && <Sequence from={golpe - 1}><Audio src={staticFile(p.sonidos.impacto)} volume={0.5} /></Sequence>}
    </AbsoluteFill>
  );
};
