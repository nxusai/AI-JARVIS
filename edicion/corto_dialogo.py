# Corto con diálogo en escena (estilo togi): tomas animadas de Kling 3.0 donde los personajes
# hablan, la voz de Eduardo puesta encima (ElevenLabs voz a voz, mismos tiempos), cortes justos
# en cada frase, subtítulos blancos de 1 a 3 palabras al centro, montaje con rótulo, logo,
# música original y loop. Se adapta la lista ESCENAS a cada video.
#   python corto_dialogo.py <carpeta>   ->  <carpeta>/Corto-Dialogo.mp4
# En la carpeta: tNN.mp4 (tomas), tNN.wav (su audio a 44.1 kHz), tNN_ed.mp3 / tNN_b_ed.mp3
# (las partes de Eduardo con su voz), las imágenes del montaje y logo.png.
import json, subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf
from PIL import Image, ImageFilter
from scipy.signal import butter, sosfilt, resample_poly

D = Path(sys.argv[1])
W, H, FPS, SR = 1080, 1920, 30, 48000
TMP = D / 'tmp'; TMP.mkdir(exist_ok=True)

# Cada escena: ('toma', nombre, partes de audio, texto) | ('fija', imagen, segundos, rótulo) | ('logo', segundos)
# Partes de audio: [(segundo_en_la_toma, archivo, desde, hasta)] — hasta None = hasta el final.
# Frases cortas o susurradas: el voz a voz las deforma ("Último curso" -> "Última corcha"). Esas se dicen
# con su clon (texto a voz) y se ponen donde mueve la boca, pedazo por pedazo: _fix.wav (ver ajustar_voz.py; voz a voz con voz_a_voz.sh).
ESCENAS = [
    ('toma', 't01', [(0, 't01_ed.mp3', 0, None)], 'Otro negocio cerrado… ¿cuántos van ya?', 'lluvia'),
    ('toma', 't02', [(0, 't02.wav', 0, 3.6), (3.6, 't02_b_ed.mp3', 0, None)],
     'Bro, ¿y ahora qué vas a intentar? No sé… pero algo va a funcionar.', 'lluvia'),
    ('fija', 's02.png', 1.4, '~ UN NEGOCIO TRAS OTRO ~'),
    ('fija', 's03.png', 1.4, '~ UN NEGOCIO TRAS OTRO ~'),
    ('toma', 't03', [(0, 't03_ed.mp3', 0, None)], 'Ninguno me gusta… Siento que el fracasado soy yo.', 'lluvia'),
    ('toma', 't04', [(0, 't04_fix.wav', 0, None)], 'Último curso… lo prometo.', None),
    ('toma', 't05', [(0, 't05_ed.mp3', 0, None)], 'Espérate… ¿inteligencia artificial?', None),
    ('logo', 1.9),
    ('toma', 't06', [(0, 't06.wav', 0, 4.9), (4.9, 't06_b_fix.wav', 0, None)],
     '¿Y eso de la inteligencia artificial me va a traer clientes? Usted deme un mes.', None),
    ('toma', 't07', [(0, 't07.mp4', 0, None)], '¡Muchacho, no paran de llegar pedidos!', None),
    ('toma', 't08', [(0, 't08_fix.wav', 0, None)], '$13,500 dólares… en un mes.', None),
    ('toma', 't09', [(0, 't09.wav', 0, 3.3), (3.3, 't09_b_ed.mp3', 0, None)],
     'Bro… ¿todo esto es tuyo? Nuestro. Y vamos creciendo, primero Dios.', None),
    ('toma', 't10', [(0, 't10_ed.mp3', 0, None)], 'Otro día cerrado… ¿cuántos clientes van ya?', 'lluvia'),
]
SUSTITUYE = {'TRECE MIL QUINIENTOS DÓLARES': '$13,500 DÓLARES'}

def leer(f, desde=0, hasta=None):
    x, sr = sf.read(str(f), always_2d=True) if not str(f).endswith(('.mp3', '.mp4')) else (None, None)
    if x is None:
        tmp = TMP / '_a.wav'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(f), '-vn', '-ac', '1', '-ar', str(SR), str(tmp)], check=True)
        x, sr = sf.read(str(tmp), always_2d=True)
    x = x.mean(1)
    if sr != SR:
        x = resample_poly(x, SR, sr)
    a = int(desde * SR); b = None if hasta is None else int(hasta * SR)
    return x[a:b]

def norm(x, lufs_rms=0.08):
    r = np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2)) if np.any(np.abs(x) > 0.01) else 1
    return x * (lufs_rms / (r + 1e-9))

# 1) Audio de cada toma y tiempos de las palabras (whisper sobre la voz final)
from faster_whisper import WhisperModel
modelo = WhisperModel('small', device='cpu', compute_type='int8')
tomas = []
for e in ESCENAS:
    if e[0] != 'toma':
        continue
    _, nom, partes, texto, amb = e
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(D / f'{nom}.mp4')],
                               capture_output=True, text=True).stdout)
    voz = np.zeros(int(dur * SR))
    for t0, f, a, b in partes:
        x = norm(leer(D / f, a, b))
        i = int(t0 * SR); voz[i:i + len(x)] += x[:len(voz) - i]
    a16 = resample_poly(voz, 1, 3).astype(np.float32)
    ws = [w for s in modelo.transcribe(a16, language='es', word_timestamps=True)[0] for w in s.words]
    ini = max(0, ws[0].start - 0.3); fin = min(dur, ws[-1].end + 0.45)
    pal = texto.split()
    if len(pal) == len(ws):
        tiempos = [(p, w.start, w.end) for p, w in zip(pal, ws)]
    else:  # reparte el texto del guion en el tramo hablado
        print(f'{nom}: whisper oyó {len(ws)} palabras y el guion tiene {len(pal)}; reparto parejo')
        paso = (ws[-1].end - ws[0].start) / len(pal)
        tiempos = [(p, ws[0].start + k * paso, ws[0].start + (k + 1) * paso) for k, p in enumerate(pal)]
    tomas.append(dict(nom=nom, ini=ini, fin=fin, voz=voz[int(ini * SR):int(fin * SR)],
                      pal=[(p, a - ini, b - ini) for p, a, b in tiempos], amb=amb))
porNom = {t['nom']: t for t in tomas}

# 2) Video: cada pieza a 1080x1920
def logo_card():
    logo = Image.open(D / 'logo.png').convert('RGB')
    a = np.asarray(logo).astype(np.float32)
    alfa = np.clip((255 - a.min(axis=2)) * 1.6, 0, 255).astype(np.uint8)
    logo = Image.fromarray(np.dstack([np.asarray(logo), alfa]), 'RGBA'); logo = logo.crop(logo.getbbox())
    logo = logo.resize((760, int(760 * logo.height / logo.width)))
    yy, xx = np.mgrid[0:H, 0:W]; r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * .47) / H) ** 2)
    f = np.dstack([10 + 70 * np.exp(-r * 6), 6 + 25 * np.exp(-r * 7), 25 + 120 * np.exp(-r * 5)]).astype(np.uint8)
    card = Image.fromarray(f).convert('RGBA'); pos = ((W - logo.width) // 2, int(H * .47 - logo.height / 2))
    glow = Image.new('RGBA', (W, H)); glow.paste(logo, pos, logo); card = Image.alpha_composite(card, glow.filter(ImageFilter.GaussianBlur(40)))
    card.paste(logo, pos, logo); card.convert('RGB').save(TMP / 'logo_card.png')

piezas, lineas, t = [], [], 0.0
cortes, rotulos, logo_t = [], [], None
for k, e in enumerate(ESCENAS):
    out = TMP / f'p{k:02d}.mp4'
    if e[0] == 'toma':
        tm = porNom[e[1]]; d = tm['fin'] - tm['ini']
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f"{tm['ini']:.3f}", '-t', f'{d:.3f}', '-i', str(D / f"{e[1]}.mp4"),
                        '-vf', f'scale={W}:{H}:flags=lanczos,unsharp=5:5:0.6,fps={FPS},format=yuv420p', '-an',
                        '-c:v', 'libx264', '-crf', '17', '-preset', 'fast', str(out)], check=True)
        tm['t'] = t
    else:
        if e[0] == 'logo':
            logo_card(); src, d, z = TMP / 'logo_card.png', e[1], '(1.0+0.08*t/%.2f)' % e[1]; logo_t = t
        else:
            src, d, z = D / e[1], e[2], '(1.06+0.10*t/%.2f)' % e[2]; rotulos.append((t, t + d, e[3]))
        vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
              f"scale=w='2*trunc({W}*{z}/2)':h=-2:eval=frame:flags=lanczos,crop={W}:{H},fps={FPS}")
        if e[0] == 'logo':
            vf += ',fade=in:st=0:d=0.3:color=white'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-t', f'{d:.3f}', '-i', str(src),
                        '-vf', vf + ',format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-preset', 'fast', str(out)], check=True)
    d = round(d * FPS) / FPS
    cortes.append(t); piezas.append(f"file '{out}'"); t += d
TOTAL = t
(TMP / 'lista.txt').write_text('\n'.join(piezas))
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(TMP / 'lista.txt'), '-c', 'copy', str(TMP / 'base.mp4')], check=True)
print(f'Duración: {TOTAL:.1f} s')

# 3) Subtítulos y rótulos (ASS)
def ts(s): return f"{int(s//3600)}:{int(s%3600//60):02d}:{max(0,s)%60:05.2f}"
ev = []
for tm in tomas:
    g, grupos = [], []
    for w in tm['pal']:
        g.append(w)
        if len(g) == 3 or len(' '.join(x[0] for x in g)) > 14 or w[0][-1] in '.,…?!':
            grupos.append(g); g = []
    if g: grupos.append(g)
    for k, g in enumerate(grupos):
        a0 = tm['t'] + g[0][1]
        a1 = tm['t'] + (grupos[k + 1][0][1] if k + 1 < len(grupos) else min(g[-1][2] + 0.3, tm['fin'] - tm['ini']))
        txt = ' '.join(x[0] for x in g).upper().rstrip('.,…')
        for a, b in SUSTITUYE.items(): txt = txt.replace(a, b)
        ev.append(f"Dialogue: 0,{ts(a0)},{ts(a1)},Sub,,0,0,0,,{{\\pos(540,1240)\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}}{txt}")
for a0, a1, txt in rotulos:
    ev.append(f"Dialogue: 0,{ts(a0)},{ts(a1)},Rotulo,,0,0,0,,{{\\pos(540,960)}}{txt}")
(TMP / 'texto.ass').write_text(f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter ExtraBold,80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,1,0,1,6,4,5,60,60,0,1
Style: Rotulo,Inter ExtraBold,72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,-1,0,0,100,100,2,0,1,6,5,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + '\n'.join(ev) + '\n')

# 4) Audio: voces, ambiente, música y efectos
N = int(TOTAL * SR); rng = np.random.default_rng(5)
voz = np.zeros(N); amb = np.zeros(N); mus = np.zeros(N); sfx = np.zeros(N)
def filt(x, f, tipo): return sosfilt(butter(2, f, tipo, fs=SR, output='sos'), x)
def poner(dst, s, t0, g=1.0):
    i = int(t0 * SR)
    if 0 <= i < N: dst[i:i + len(s)] += s[:N - i] * g
def tono(f, d, forma='sin'):
    tt = np.arange(int(d * SR)) / SR
    return 2 * ((tt * f) % 1) - 1 if forma == 'saw' else np.sin(2 * np.pi * f * tt)
def env(n, a=.01, r=.2):
    e = np.ones(n); na = max(1, int(a * SR)); nr = min(n, int(r * SR)); e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
for tm in tomas:
    poner(voz, tm['voz'], tm['t'])
    d = tm['fin'] - tm['ini']
    if tm['amb'] == 'lluvia':
        poner(amb, filt(rng.normal(0, 1, int(d * SR)), [700, 7000], 'band') * env(int(d * SR), .15, .15), tm['t'], .05)
# música: tensa hasta el logo, golpe en el montaje, synthwave después del logo
T_LOGO = logo_t
for f0, g in ((55, .3), (110, .15), (130.81, .1), (164.81, .08)):
    p = filt(tono(f0, T_LOGO, 'saw'), 500, 'low') * g * env(int(T_LOGO * SR), 1.5, .6); poner(mus, p, 0)
t_mont = [a0 for a0, _, _ in rotulos]
for a0 in t_mont[:1]:
    n = int(1.0 * SR); poner(sfx, (tono(45, 1.0) + .4 * filt(rng.normal(0, 1, n), 300, 'low')) * np.exp(-np.arange(n) / SR * 4), a0, .8)
d_sub = 3.5
poner(mus, filt(rng.normal(0, 1, int(d_sub * SR)), [300, 9000], 'band') * np.linspace(0, .3, int(d_sub * SR)) ** 2, T_LOGO - d_sub)
BEAT = 60 / 100; acordes = [(110, 130.81, 164.81), (87.31, 110, 130.81), (130.81, 164.81, 196), (98, 123.47, 146.83)]
t2, k = T_LOGO, 0
while t2 < TOTAL - .1:
    ac = acordes[(k // 4) % 4]
    poner(mus, tono(55, .3) * np.exp(-np.arange(int(.3 * SR)) / SR * 10), t2, .8)
    if k % 2: poner(mus, filt(rng.normal(0, 1, int(.25 * SR)), [1500, 8000], 'band') * np.exp(-np.arange(int(.25 * SR)) / SR * 16), t2, .4)
    for h in range(2):
        poner(mus, filt(tono(ac[0] / 2, BEAT / 2 * .9, 'saw'), 400, 'low') * env(int(BEAT / 2 * .9 * SR), .005, .05), t2 + h * BEAT / 2, .3)
    for j, f in enumerate(ac):
        poner(mus, filt(tono(f * 2, BEAT / 4 * .9, 'saw'), 2500, 'low') * env(int(BEAT / 4 * .9 * SR), .005, .06), t2 + j * BEAT / 4, .08)
    t2 += BEAT; k += 1
n = int(1.3 * SR); poner(sfx, (tono(40, 1.3) + .5 * filt(rng.normal(0, 1, n), 300, 'low')) * np.exp(-np.arange(n) / SR * 3), T_LOGO, 1.0)
for c in cortes[1:]:
    n = int(.3 * SR); poner(sfx, filt(rng.normal(0, 1, n), [500, 5000], 'band') * np.sin(np.linspace(0, np.pi, n)) ** 2, c - .15, .12)
envv = np.convolve(np.abs(voz), np.ones(int(.08 * SR)) / int(.08 * SR), 'same')
duck = np.convolve(1 - .6 * np.clip(envv / (envv.max() * .2 + 1e-9), 0, 1), np.ones(int(.15 * SR)) / int(.15 * SR), 'same')
mus = mus / (np.abs(mus).max() + 1e-9) * .22 * duck
sfx = sfx / (np.abs(sfx).max() + 1e-9) * .35
voz = voz / (np.abs(voz).max() + 1e-9) * .95
mezcla = voz + amb + mus + sfx
sf.write(str(TMP / 'mezcla.wav'), np.stack([mezcla, mezcla], 1) * .8, SR)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(TMP / 'mezcla.wav'), '-af', 'highpass=f=70,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.2:LRA=9',
                '-ar', str(SR), str(TMP / 'audio.wav')], check=True)

# 5) Final
salida = D / 'Corto-Dialogo.mp4'
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(TMP / 'base.mp4'), '-i', str(TMP / 'audio.wav'), '-vf', f"ass={TMP / 'texto.ass'}",
                '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(salida)], check=True)
print('Listo:', salida)
