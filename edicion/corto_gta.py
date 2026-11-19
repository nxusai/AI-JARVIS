# Corto estilo videojuego (personaje "Eduardo-GTA"): primer corte con escenas fijas que se mueven
# (acercamientos y paneos), su voz de ElevenLabs, subtítulos blancos al centro, letreros de "misión",
# el logo de NXUS, música original y efectos. Todo sale de una carpeta de trabajo:
#   <dir>/esc/sNN.png      escenas (9:16)
#   <dir>/voz/lN.wav       frases de la voz, una por línea del guion
#   <dir>/voz/palabras.json tiempos por palabra (whisper)
#   <dir>/logo.png         logo
#   python corto_gta.py <dir>   ->  <dir>/Corto-GTA.mp4
import json, subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFilter
from scipy.signal import butter, sosfilt

D = Path(sys.argv[1])
W, H, FPS = 1080, 1920, 30
FONT = 'Inter ExtraBold'
P = json.loads((D / 'voz/palabras.json').read_text())
# Los subtítulos llevan el texto exacto del guion (voz/texto.txt) con los tiempos de whisper.
_txt = D / 'voz/texto.txt'
if _txt.exists():
    for n, linea_ in enumerate(_txt.read_text().strip().split('\n'), 1):
        pal = linea_.split()
        if len(pal) == len(P[str(n)]):
            P[str(n)] = [[p, w[1], w[2]] for p, w in zip(pal, P[str(n)])]
        else:
            print(f'Ojo: la frase {n} no coincide en número de palabras; uso whisper')

# Guion: cada frase de voz y las escenas que van debajo ('logo' = tarjeta del logo).
GUION = [
    (1, ['s01']), (2, ['s02', 's03']), (3, ['s04']), (4, ['s05']), (5, ['s06']),
    (6, ['logo']), (7, ['s07', 's08']), (8, ['s09']), (9, ['s10']), (10, ['s11']),
]
PAUSA = {5: 0.55, 6: 0.5}  # aire extra después de esa frase
MOV = {'s01': 'in', 's02': 'izq', 's03': 'out', 's04': 'in', 's05': 'der', 's06': 'in', 'logo': 'in',
       's07': 'out', 's08': 'izq', 's09': 'in', 's10': 'out', 's11': 'arriba'}

def dur(f):
    return sf.info(str(f)).duration

# 1) Tiempos
t = 0.35
frases, tomas = [], []
for n, esc in GUION:
    largo = dur(D / f'voz/l{n}.wav')
    ws = P[str(n)]
    fin = t + largo + 0.28 + PAUSA.get(n, 0)
    frases.append((n, t, largo, ws))
    if len(esc) == 1:
        tomas.append((esc[0], t if not tomas else tomas[-1][2], fin))
    else:  # parte la frase en la palabra más cercana a la mitad
        mitad = min(ws, key=lambda w: abs(w[1] - largo / 2))[1]
        ini = t if not tomas else tomas[-1][2]
        tomas.append((esc[0], ini, t + mitad))
        tomas.append((esc[1], t + mitad, fin))
    t = fin
TOTAL = t + 0.6
tomas[-1] = (tomas[-1][0], tomas[-1][1], TOTAL)
tomas[0] = (tomas[0][0], 0.0, tomas[0][2])
print(f'Duración: {TOTAL:.1f} s, {len(tomas)} tomas')

# 2) Tarjeta del logo: fondo oscuro con brillo y el logo sin el blanco
tmp = D / 'tmp'; tmp.mkdir(exist_ok=True)
logo = Image.open(D / 'logo.png').convert('RGB')
a = np.asarray(logo).astype(np.float32)
alfa = np.clip((255 - a.min(axis=2)) * 1.6, 0, 255).astype(np.uint8)
logo = Image.fromarray(np.dstack([np.asarray(logo), alfa]), 'RGBA')
logo = logo.crop(logo.getbbox()).resize((760, int(760 * logo.crop(logo.getbbox()).height / logo.crop(logo.getbbox()).width)))
yy, xx = np.mgrid[0:H, 0:W]
r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.47) / H) ** 2)
fondo = np.zeros((H, W, 3))
fondo[..., 0] = 10 + 70 * np.exp(-r * 6)
fondo[..., 1] = 6 + 25 * np.exp(-r * 7)
fondo[..., 2] = 25 + 120 * np.exp(-r * 5)
tarjeta = Image.fromarray(fondo.astype(np.uint8)).convert('RGBA')
brillo = Image.new('RGBA', (W, H)); brillo.paste(logo, ((W - logo.width) // 2, int(H * 0.47 - logo.height / 2)), logo)
brillo = brillo.filter(ImageFilter.GaussianBlur(40))
tarjeta = Image.alpha_composite(tarjeta, brillo)
tarjeta.paste(logo, ((W - logo.width) // 2, int(H * 0.47 - logo.height / 2)), logo)
tarjeta.convert('RGB').save(tmp / 'logo_card.png')

# 3) Cada toma con movimiento
def toma(nombre, d, salida):
    src = tmp / 'logo_card.png' if nombre == 'logo' else D / f'esc/{nombre}.png'
    m = MOV[nombre]
    if m in ('in', 'out'):
        z = f"(1.04+0.13*t/{d:.3f})" if m == 'in' else f"(1.17-0.13*t/{d:.3f})"
        vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
              f"scale=w='2*trunc({W}*{z}/2)':h=-2:eval=frame:flags=lanczos,crop={W}:{H}")
    else:
        dx = {'izq': f"(iw-{W})*(1-t/{d:.3f})", 'der': f"(iw-{W})*t/{d:.3f}"}.get(m, f"(iw-{W})/2")
        dy = f"(ih-{H})*(1-t/{d:.3f})" if m == 'arriba' else f"(ih-{H})/2"
        vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
              f"scale={int(W*1.14)//2*2}:-2:flags=lanczos,crop={W}:{H}:'{dx}':'{dy}'")
    vf += ",eq=contrast=1.04:saturation=1.06"
    if nombre == 'logo':
        vf += ",fade=in:st=0:d=0.35:color=white"
    vf += ",format=yuv420p"
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-t', f'{d:.3f}',
                    '-i', str(src), '-vf', vf, '-r', str(FPS), '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', str(salida)], check=True)

lista = []
for i, (nom, a0, a1) in enumerate(tomas):
    f = tmp / f't{i:02d}.mp4'
    toma(nom, round((a1 - a0) * FPS) / FPS, f)
    lista.append(f"file '{f}'")
(tmp / 'lista.txt').write_text('\n'.join(lista))
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(tmp / 'lista.txt'), '-c', 'copy', str(tmp / 'base.mp4')], check=True)

# 4) Letreros y subtítulos (ASS)
def ts(s):
    s = max(0, s); return f"{int(s//3600)}:{int(s%3600//60):02d}:{s%60:05.2f}"
ev = []
def linea(a0, a1, estilo, texto):
    ev.append(f"Dialogue: 0,{ts(a0)},{ts(a1)},{estilo},,0,0,0,,{texto}")
fin_t = {nom: (a0, a1) for nom, a0, a1 in tomas}
# subtítulos de 1 a 3 palabras, blancos, al centro
for n, t0, largo, ws in frases:
    grupos, g = [], []
    for w in ws:
        g.append(w)
        txt = ' '.join(x[0] for x in g)
        if len(g) == 3 or len(txt) > 13 or w[0][-1] in '.,…?!':
            grupos.append(g); g = []
    if g: grupos.append(g)
    for k, g in enumerate(grupos):
        a0 = t0 + g[0][1]
        a1 = t0 + (grupos[k + 1][0][1] if k + 1 < len(grupos) else g[-1][2] + 0.15)
        txt = ' '.join(x[0] for x in g).upper().replace('NEXUS AI', 'NXUS AI').replace('NEXUS', 'NXUS').strip('.,…:')
        txt = txt.replace('13 .500', '$13,500').replace('13.500', '$13,500')
        y = 1450 if fin_t['logo'][0] - 0.01 <= a0 < fin_t['logo'][1] else 1190
        linea(a0, a1, 'Sub', r"{\pos(540," + str(y) + r")\fscx92\fscy92\t(0,90,\fscx100\fscy100)}" + txt)
inicio = {n: t0 for n, t0, _, _ in frases}
# MISIÓN FALLIDA al inicio
linea(0.15, 2.9, 'Mision', r"{\fad(60,250)\fscx150\fscy150\t(0,160,\fscx100\fscy100)\c&H3C28E0&}MISIÓN FALLIDA")
# NUEVA MISIÓN en la tarjeta del logo
a0, a1 = fin_t['logo']
linea(a0 + 0.15, a1, 'Mision', r"{\fad(120,200)\pos(540,520)\fs78\c&HF0E000&}NUEVA MISIÓN")
# Contador de ingresos en la toma del carro
a0, a1 = fin_t['s09']
pasos = 22
for k in range(pasos + 1):
    v = 13500 * (1 - (1 - k / pasos) ** 3)
    b0 = a0 + 0.25 + k * 0.06
    b1 = a1 if k == pasos else b0 + 0.06
    linea(b0, b1, 'Dinero', r"{\pos(540,470)}" + f"${int(round(v, -1)):,}" + r"{\fs56} /MES")
# Misión en curso al final
a0, a1 = fin_t['s11']
linea(a1 - 3.6, a1, 'Mision', r"{\fad(150,300)\pos(540,430)\fs82\c&H18D8FF&}MISIÓN EN CURSO")
ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,{FONT},86,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,1,0,1,6,4,5,60,60,0,1
Style: Mision,{FONT},104,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,-1,-1,0,0,100,100,3,0,1,8,6,8,60,60,330,1
Style: Dinero,{FONT},108,&H0078FF3D,&H00FFFFFF,&H00000000,&HA0000000,-1,0,0,0,100,100,1,0,1,8,6,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + '\n'.join(ev).replace('Style: Sub', 'Style: Sub')
# Subtítulos a la altura del pecho (62 % de la pantalla)
(tmp / 'texto.ass').write_text(ass)

# 5) Audio: voz, música original y efectos
SR = 48000
N = int(TOTAL * SR)
voz = np.zeros(N)
for n, t0, largo, _ in frases:
    x, sr = sf.read(str(D / f'voz/l{n}.wav'))
    if x.ndim > 1: x = x.mean(1)
    i = int(t0 * SR); voz[i:i + len(x)] += x[:N - i]
rng = np.random.default_rng(7)
def filt(x, f, tipo): return sosfilt(butter(2, f, tipo, fs=SR, output='sos'), x)
mus = np.zeros(N); sfx = np.zeros(N)
def poner(dst, sig, t0, g=1.0):
    i = int(t0 * SR)
    if 0 <= i < N: dst[i:i + len(sig)] += sig[:N - i] * g
def tono(f, d, forma='sin'):
    tt = np.arange(int(d * SR)) / SR
    if forma == 'saw': return 2 * ((tt * f) % 1) - 1
    return np.sin(2 * np.pi * f * tt)
def env(n, a=0.01, r=0.2):
    e = np.ones(n); na = int(a * SR); nr = min(n, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
T_AI = inicio[5]; T_LOGO = fin_t['logo'][0]
# Parte 1: lluvia, pad oscuro en La menor y latido
lluvia = filt(rng.normal(0, 1, int(T_LOGO * SR)), [800, 6000], 'band') * 0.05
lluvia *= np.minimum(1, np.linspace(1.6, 0, len(lluvia)))
poner(mus, lluvia, 0)
for f0, g in ((55, .35), (110, .18), (130.81, .12), (164.81, .1)):
    p = tono(f0, T_LOGO, 'saw'); p = filt(p, 600, 'low') * g * env(len(p), 1.5, 1.0)
    poner(mus, p, 0)
for b in np.arange(0.35, T_AI, 1.05):
    k = tono(48, 0.25) * np.exp(-np.arange(int(.25 * SR)) / SR * 14)
    poner(mus, k, b, .55); poner(mus, k, b + .22, .35)
# Subida hacia el logo
d = T_LOGO - T_AI
sub = filt(rng.normal(0, 1, int(d * SR)), [300, 9000], 'band') * np.linspace(0, .35, int(d * SR)) ** 2
poner(mus, sub, T_AI)
# Parte 2: synthwave a 100 BPM (Am F C G)
BEAT = 60 / 100
acordes = [(110, 130.81, 164.81), (87.31, 110, 130.81), (130.81, 164.81, 196), (98, 123.47, 146.83)]
t2 = T_LOGO
k = 0
while t2 < TOTAL - 0.2:
    acorde = acordes[(k // 4) % 4]
    kick = tono(55, .3) * np.exp(-np.arange(int(.3 * SR)) / SR * 10) * 0.9
    poner(mus, kick, t2)
    if k % 2 == 1:
        sn = filt(rng.normal(0, 1, int(.25 * SR)), [1500, 8000], 'band') * np.exp(-np.arange(int(.25 * SR)) / SR * 16)
        poner(mus, sn, t2, .5)
    for h in range(2):
        hh = filt(rng.normal(0, 1, int(.05 * SR)), 7000, 'high') * np.exp(-np.arange(int(.05 * SR)) / SR * 60)
        poner(mus, hh, t2 + h * BEAT / 2, .18)
        bajo = filt(tono(acorde[0] / 2, BEAT / 2 * .9, 'saw'), 400, 'low') * env(int(BEAT / 2 * .9 * SR), .005, .05)
        poner(mus, bajo, t2 + h * BEAT / 2, .35)
    for j, f in enumerate(acorde):
        arp = filt(tono(f * 2, BEAT / 4 * .9, 'saw'), 2500, 'low') * env(int(BEAT / 4 * .9 * SR), .005, .06)
        poner(mus, arp, t2 + j * BEAT / 4, .1)
    if k % 4 == 0:
        for f in acorde:
            pad = filt(tono(f, BEAT * 4, 'saw'), 1200, 'low') * env(int(BEAT * 4 * SR), .3, .5)
            poner(mus, pad, t2, .07)
    t2 += BEAT; k += 1
# Efectos: whoosh en cada corte, golpe en MISIÓN FALLIDA y en el logo
for nom, a0, a1 in tomas[1:]:
    n = int(.35 * SR)
    w = filt(rng.normal(0, 1, n), [400, 5000], 'band') * np.sin(np.linspace(0, np.pi, n)) ** 2
    poner(sfx, w, a0 - .2, .25)
for tg in (0.15, T_LOGO):
    n = int(1.2 * SR)
    boom = (tono(42, 1.2) + .5 * filt(rng.normal(0, 1, n), 300, 'low')) * np.exp(-np.arange(n) / SR * 3.5)
    poner(sfx, boom, tg, .9)
# Ducking: la música baja cuando habla
envv = np.convolve(np.abs(voz), np.ones(int(.08 * SR)) / int(.08 * SR), 'same')
duck = 1 - 0.55 * np.clip(envv / (envv.max() * .25), 0, 1)
duck = np.convolve(duck, np.ones(int(.15 * SR)) / int(.15 * SR), 'same')
mus = mus / (np.abs(mus).max() + 1e-9) * 0.30 * duck
sfx = sfx / (np.abs(sfx).max() + 1e-9) * 0.35
voz = voz / (np.abs(voz).max() + 1e-9) * 0.95
mezcla = voz + mus + sfx
sf.write(str(tmp / 'mezcla.wav'), np.stack([mezcla, mezcla], 1) * 0.8, SR)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(tmp / 'mezcla.wav'),
                '-af', 'alimiter=limit=0.95,loudnorm=I=-14:TP=-1.2:LRA=9', '-ar', '48000', str(tmp / 'audio.wav')], check=True)

# 6) Final: base (el destello del logo va en su toma) + textos + audio
vf = f"ass={tmp / 'texto.ass'}"
salida = D / 'Corto-GTA.mp4'
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(tmp / 'base.mp4'), '-i', str(tmp / 'audio.wav'),
                '-vf', vf, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(salida)], check=True)
print('Listo:', salida)
