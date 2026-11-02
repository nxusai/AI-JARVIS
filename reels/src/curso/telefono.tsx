// Piezas para enseñar automatizaciones sin grabar la herramienta: un teléfono con la conversación
// entre el cliente y el agente (mensaje por mensaje), y un diagrama del flujo con un punto de luz
// que recorre cada paso. Son ilustraciones genéricas, no copias de la pantalla de ninguna app.
import React from 'react';
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FUENTE } from '../fuentes';
import type { Pantalla } from './tipos';

const fija = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const Entrada: React.FC<{ p: Pantalla; children: React.ReactNode }> = ({ p, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entra = spring({ frame: f, fps, config: { damping: 15 } });
  const sale = interpolate(f, [p.dur - 9, p.dur], [0, 1], { ...fija, easing: Easing.in(Easing.cubic) });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: 2200,
      opacity: Math.min(entra * 1.4, 1 - sale), transform: `translateY(${(1 - entra) * 90}px) scale(${interpolate(entra, [0, 1], [0.88, 1]) * (1 + sale * 0.08)})` }}>
      {children}
    </div>
  );
};

/** Teléfono con la conversación: comentario público, mensajes del agente y del cliente. */
export const Telefono: React.FC<{ p: Pantalla; acento: string }> = ({ p, acento }) => {
  const f = useCurrentFrame();
  const mensajes = p.mensajes ?? [];
  const visibles = interpolate(f, [10, Math.max(20, p.dur * 0.82)], [0, mensajes.length], fija);
  const escribiendo = visibles < mensajes.length && mensajes[Math.floor(visibles)]?.de === 'agente' && visibles % 1 > 0.35;
  return (
    <Entrada p={p}>
      <div style={{ position: 'absolute', width: 1300, height: 1000, background: `radial-gradient(ellipse, ${acento}33 0%, transparent 60%)` }} />
      {/* Lo que explica la tarjeta, a la izquierda */}
      <div style={{ position: 'absolute', left: 150, top: '50%', transform: 'translateY(-50%)', width: 560, fontFamily: FUENTE }}>
        <div style={{ color: acento, fontWeight: 900, fontSize: 26, letterSpacing: '0.14em', marginBottom: 14 }}>{p.etiqueta.toUpperCase()}</div>
        {p.descripcion && <div style={{ color: '#fff', fontWeight: 900, fontSize: 52, lineHeight: 1.1 }}>{p.descripcion}</div>}
      </div>
      <div style={{ position: 'absolute', right: 300, width: 450, height: 820, marginTop: 40, borderRadius: 58, background: '#05070d', padding: 16, boxShadow: `0 50px 110px rgba(0,0,0,.7), 0 0 0 2px #2a3550, 0 0 80px ${acento}33`,
        transform: `rotateY(${-8 + Math.sin(f / 60) * 2}deg) rotateX(4deg)` }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 46, background: '#0d1220', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: FUENTE }}>
          <div style={{ padding: '26px 22px 16px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #ffffff14' }}>
            <div style={{ width: 46, height: 46, borderRadius: 23, background: `linear-gradient(135deg, ${acento}, #a01cff)` }} />
            <div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 21 }}>{p.cuenta ?? 'tu.negocio'}</div>
              <div style={{ color: '#ffffff77', fontSize: 15 }}>Agente automático</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '18px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 10 }}>
            {mensajes.map((m, i) => {
              const o = interpolate(visibles - i, [0, 0.6], [0, 1], fija);
              if (o <= 0) return null;
              if (m.de === 'comentario') {
                return (
                  <div key={i} style={{ opacity: o, alignSelf: 'stretch', padding: '10px 14px', borderRadius: 14, background: '#ffffff0d', border: '1px dashed #ffffff33', color: '#ffffffcc', fontSize: 17 }}>
                    💬 Comentó en tu reel: <b style={{ color: '#fff' }}>{m.texto}</b>
                  </div>
                );
              }
              const agente = m.de === 'agente';
              return (
                <div key={i} style={{ opacity: o, transform: `translateY(${(1 - o) * 14}px)`, alignSelf: agente ? 'flex-start' : 'flex-end', maxWidth: '82%',
                  padding: '11px 15px', borderRadius: 20, borderBottomLeftRadius: agente ? 6 : 20, borderBottomRightRadius: agente ? 20 : 6,
                  background: agente ? '#1f2a45' : acento, color: agente ? '#fff' : '#06101e', fontSize: 20, fontWeight: agente ? 500 : 700, lineHeight: 1.3 }}>
                  {m.texto}
                  {m.boton && <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 10, background: '#ffffff1a', textAlign: 'center', fontWeight: 900, color: acento }}>{m.boton}</div>}
                </div>
              );
            })}
            {escribiendo && <div style={{ alignSelf: 'flex-start', padding: '10px 16px', borderRadius: 18, background: '#1f2a45', color: '#ffffffaa', fontSize: 22, letterSpacing: 3 }}>{'•'.repeat(1 + (Math.floor(f / 5) % 3))}</div>}
          </div>
        </div>
      </div>
    </Entrada>
  );
};

/** Diagrama del flujo: cada paso es un nodo; un punto de luz los recorre en orden. */
export const Flujo: React.FC<{ p: Pantalla; acento: string }> = ({ p, acento }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nodos = p.nodos ?? [];
  const n = nodos.length;
  const ancho = 1600;
  const paso = ancho / n;
  const recorrido = interpolate(f, [16, Math.max(30, p.dur * 0.8)], [0, n - 1], fija);
  return (
    <Entrada p={p}>
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', fontFamily: FUENTE, color: acento, fontWeight: 900, fontSize: 28, letterSpacing: '0.14em' }}>{p.etiqueta.toUpperCase()}</div>
      <div style={{ position: 'relative', width: ancho, height: 360 }}>
        {/* Línea que une los pasos y se va llenando */}
        <div style={{ position: 'absolute', left: paso / 2, right: paso / 2, top: 110, height: 4, background: '#ffffff1a', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: paso / 2, top: 110, height: 4, width: (recorrido / Math.max(1, n - 1)) * (ancho - paso), background: acento, boxShadow: `0 0 18px ${acento}`, borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: paso / 2 + (recorrido / Math.max(1, n - 1)) * (ancho - paso) - 13, top: 99, width: 26, height: 26, borderRadius: 13, background: '#fff', boxShadow: `0 0 30px ${acento}, 0 0 60px ${acento}` }} />
        {nodos.map((nodo, i) => {
          const s = spring({ frame: f - 6 - i * 5, fps, config: { damping: 12 } });
          const activo = recorrido >= i - 0.15;
          return (
            <div key={i} style={{ position: 'absolute', left: i * paso, width: paso, top: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: FUENTE, transform: `scale(${s})` }}>
              <div style={{ width: 120, height: 120, borderRadius: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56,
                background: activo ? '#0f1a33' : '#0b1020', border: `3px solid ${activo ? acento : '#ffffff22'}`, boxShadow: activo ? `0 0 40px ${acento}88` : 'none' }}>{nodo.icono}</div>
              <div style={{ marginTop: 26, color: activo ? '#fff' : '#ffffff66', fontWeight: 900, fontSize: 32, textAlign: 'center', padding: '0 10px' }}>{nodo.titulo}</div>
              {nodo.sub && <div style={{ marginTop: 8, color: activo ? '#ffffffbb' : '#ffffff44', fontWeight: 500, fontSize: 22, textAlign: 'center', padding: '0 16px', lineHeight: 1.3 }}>{nodo.sub}</div>}
            </div>
          );
        })}
      </div>
    </Entrada>
  );
};
