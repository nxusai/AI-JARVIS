# Música original del anuncio: pulso tecnológico a 112 BPM, golpes en cada corte,
# riser hacia el llamado a la acción. Sintetizado aquí, sin muestras de terceros.
#   python musica.py salida.wav T H
import sys
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

out_path, T, H = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
SR = 44100
N = int(SR * T)
out = np.zeros((N, 2))
rng = np.random.default_rng(11)
BEAT = 60 / 112
CORTES = [H, H + 5.3, H + 13.0, H + 16.9, H + 23.4]
CTA = H + 23.4


def filt(x, f, tipo):
    return sosfilt(butter(2, f, tipo, fs=SR, output='sos'), x, axis=0)


def poner(sig, t, gan=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i < 0:
        return
    s = sig[: N - i]
    if s.ndim == 1:
        s = np.stack([s * (1 - max(0, pan)), s * (1 + min(0, pan))], 1)
    out[i:i + len(s)] += s * gan


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)


def saw(f, dur, det=(0,)):
    t = np.arange(int(dur * SR)) / SR
    return sum(2 * ((t * f * (1 + d)) % 1) - 1 for d in det) / len(det)


def kick():
    n = int(.4 * SR)
    f = 48 + 120 * np.exp(-np.arange(n) / SR / .025)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, .16)


def hat(d=.018):
    n = int(.07 * SR)
    return filt(rng.standard_normal(n), 7500, 'high') * env(n, .0005, d)


def clap():
    n = int(.25 * SR)
    return filt(rng.standard_normal(n), [900, 4000], 'band') * env(n, .002, .07)


def hit(grande=False):
    dur = 3.0 if grande else 1.6
    n = int(dur * SR)
    s = sum(saw(f, dur, (-.004, .005)) for f in (41.2, 61.7, 82.4))
    s = filt(s, 240, 'low') * env(n, .008, .9 if grande else .45)
    sub = np.sin(2 * np.pi * np.cumsum(np.linspace(90, 38, n)) / SR) * env(n, .002, .35)
    return s * .8 + sub


def woosh(dur=.45):
    n = int(dur * SR)
    k = np.linspace(0, 1, n)
    r = rng.standard_normal(n)
    s = np.zeros(n)
    for j in range(8):
        a, b = int(n * j / 8), int(n * (j + 1) / 8)
        f = 500 + 6000 * (j / 8) ** 2
        s[a:b] = filt(r, [f, f * 1.7], 'band')[a:b]
    return s * k ** 2 * 1.3


def riser(dur):
    n = int(dur * SR)
    k = np.linspace(0, 1, n)
    return (np.sin(2 * np.pi * np.cumsum(260 + 900 * k ** 2) / SR) * .22 + filt(rng.standard_normal(n), 2000, 'high') * .3) * k ** 2.4


# Arpegio y bajo (Mi menor · Do · Sol · Re): moderno, con tensión que se resuelve.
ACORDES = [(82.41, 164.81, 196.0, 246.94), (65.41, 130.81, 164.81, 196.0), (98.0, 196.0, 246.94, 293.66), (73.42, 146.83, 185.0, 220.0)]
t, i = 0.0, 0
while t < T - .5:
    bajo, *notas = ACORDES[(i // 8) % 4]
    paso = BEAT / 2
    n = int(paso * SR * .95)
    nota = notas[i % 3] * (2 if (i // 3) % 2 else 1)
    pl = filt(saw(nota, paso * .95, (-.003, .003)), 2600, 'low') * env(n, .003, .09)
    poner(pl, t, .07 if t < H else .1, (-.4, .4)[i % 2])
    if i % 2 == 0:
        b = filt(saw(bajo, paso * 1.9), 380, 'low') * env(int(paso * 1.9 * SR), .005, .25)
        poner(b, t, .16 if t < H else .22)
    t += paso
    i += 1

# Batería: suave en el gancho, completa en el cuerpo; se abre en el llamado a la acción.
t = 0.0
while t < T - .4:
    en_gancho = t < H
    poner(kick(), t, .3 if en_gancho else .55)
    if not en_gancho:
        poner(hat(), t + BEAT / 2, .1, .3)
        if round(t / BEAT) % 2 == 1:
            poner(clap(), t, .14)
    t += BEAT

for c in CORTES:
    poner(woosh(), c - .45, .4)
    poner(hit(c == CTA), c, .45 if c != CTA else .6)
poner(riser(1.6), CTA - 1.6, .45)
poner(hit(True), T - 2.2, .35)

eco = np.zeros_like(out)
for d, g in [(.029, .3), (.043, .26), (.067, .2), (.109, .15), (.171, .1)]:
    k = int(d * SR)
    eco[k:] += out[:-k] * g
out = out + filt(eco, 3200, 'low')
out[-int(1.0 * SR):] *= np.linspace(1, 0, int(1.0 * SR))[:, None]
out /= np.max(np.abs(out)) * 1.12
sf.write(out_path, out, SR)
print('música', T)
