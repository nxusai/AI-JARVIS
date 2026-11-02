# Música de fondo propia (sin derechos de terceros) para las lecciones: electrónica tranquila
# a 100 BPM. Intro sin batería, luego entra el ritmo, y cierra en desvanecido.
#
#   python3 cursos/musica.py <segundos> <salida.wav> [intro_segundos]
import sys
import wave

import numpy as np

SR = 48000
BPM = 100
BEAT = 60 / BPM

total = float(sys.argv[1])
salida = sys.argv[2]
intro = float(sys.argv[3]) if len(sys.argv) > 3 else 8.0
n = int(total * SR)
t = np.arange(n) / SR
izq = np.zeros(n)
der = np.zeros(n)

nota = lambda m: 440.0 * 2 ** ((m - 69) / 12)
# Am – F – C – G, dos compases cada uno.
ACORDES = [(57, 60, 64), (53, 57, 60), (48, 52, 55), (55, 59, 62)]
COMPAS = 4 * BEAT


def pasabajos(x, corte):
    """Filtro pasabajos suave (12 dB/oct) en frecuencia."""
    espectro = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(espectro / (1 + (f / corte) ** 2), len(x))


def sierra(f, tt, armonicos=8):
    return sum(np.sin(2 * np.pi * f * k * tt) / k for k in range(1, armonicos + 1))


# Pad: acordes suaves con desafinación entre canales.
for i in range(int(total / (2 * COMPAS)) + 1):
    ini = i * 2 * COMPAS
    fin = min(total, ini + 2 * COMPAS)
    if ini >= total:
        break
    a, b = int(ini * SR), int(fin * SR)
    tt = t[a:b] - ini
    env = np.minimum(1, tt / 0.8) * np.minimum(1, (fin - ini - tt) / 0.6)
    for m in ACORDES[i % 4]:
        izq[a:b] += 0.05 * sierra(nota(m) * 0.997, tt, 6) * env
        der[a:b] += 0.05 * sierra(nota(m) * 1.003, tt, 6) * env
izq = pasabajos(izq, 1400)
der = pasabajos(der, 1400)

# Ritmo: entra después de la intro.
ritmo = np.zeros(n)
bajo = np.zeros(n)
pulsos = int((total - intro) / BEAT)
for k in range(pulsos):
    ini = intro + k * BEAT
    a = int(ini * SR)
    largo = int(0.35 * SR)
    tt = np.arange(min(largo, n - a)) / SR
    # Bombo: tono que cae.
    fase = 2 * np.pi * np.cumsum(45 + 90 * np.exp(-tt * 30)) / SR
    ritmo[a:a + len(tt)] += 0.55 * np.sin(fase) * np.exp(-tt * 9)
    # Hi-hat en el contratiempo.
    h = int((ini + BEAT / 2) * SR)
    hl = min(int(0.06 * SR), n - h)
    if hl > 0:
        ruido = np.random.default_rng(k).standard_normal(hl)
        ritmo[h:h + hl] += 0.07 * np.diff(ruido, prepend=0) * np.exp(-np.arange(hl) / SR * 60)
    # Bajo en corcheas, raíz del acorde.
    raiz = ACORDES[int(ini / (2 * COMPAS)) % 4][0] - 24
    for c in (0, 0.5):
        s = int((ini + c * BEAT) * SR)
        sl = min(int(0.28 * SR), n - s)
        if sl > 0:
            ts = np.arange(sl) / SR
            bajo[s:s + sl] += 0.16 * sierra(nota(raiz), ts, 4) * np.exp(-ts * 7)
bajo = pasabajos(bajo, 500)

# El pad se agacha con cada bombo (sidechain), para que respire.
agacha = np.ones(n)
for k in range(pulsos):
    a = int((intro + k * BEAT) * SR)
    largo = min(int(BEAT * SR), n - a)
    agacha[a:a + largo] = 1 - 0.45 * np.exp(-np.arange(largo) / SR * 8)

mezcla_i = izq * agacha + ritmo + bajo
mezcla_d = der * agacha + ritmo + bajo
fade = np.minimum(1, np.minimum(t / 1.5, (total - t) / 3.0))
estereo = np.stack([mezcla_i * fade, mezcla_d * fade], axis=1)
estereo /= np.max(np.abs(estereo)) / 0.8
with wave.open(salida, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((estereo * 32767).astype('<i2').tobytes())
print(f'🎵 {salida}: {total:.1f} s')
