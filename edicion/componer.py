# Arma cada cuadro: acercamiento según los gestos → fondo desenfocado → texto gigante → la persona → subtítulos.
#   python componer.py prueba 3.0,8.0,...   (fotos de prueba)   |   python componer.py todo   (video completo, a stdout raw)
import json, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter
from rembg import remove, new_session
import cuerpo
P = json.load(open('plan.json')); T, DUR = P['T'], P['DUR']
SW, SH, OW, OH = 2160, 3840, 1080, 1920
ses = new_session('u2net_human_seg')
cl = lambda x, a=0., b=1.: min(b, max(a, x))
def zoom(t):
    Z = P['zoom']; z = Z[0][1]
    for i in range(1, len(Z)):
        t0, z0 = Z[i-1][0], Z[i-1][1]; t1, z1, tipo = Z[i]
        if t < t0: break
        if tipo == 'salto':
            if t >= t1: z = z1
            continue
        if t <= t1:
            k = (t - t0) / (t1 - t0) if t1 > t0 else 1
            if tipo == 'suave': k = k * k * (3 - 2 * k)
            z = z0 + (z1 - z0) * k; break
        z = z1
    return z
def recorte(fr, t):
    z = zoom(t); k = cl((z - 1) / 0.6)
    cx = 0.5 + (P['cara'][0] - 0.5) * k; cy = 0.5 + (P['cara'][1] - 0.5) * k
    w, h = 1 / z, 1 / z
    x0 = cl(cx - w / 2, 0, 1 - w); y0 = cl(cy - h / 2, 0, 1 - h)
    box = (int(x0 * SW), int(y0 * SH), int((x0 + w) * SW), int((y0 + h) * SH))
    return Image.fromarray(fr).crop(box).resize((OW, OH), Image.LANCZOS)
def capa(modo, i):
    try: return Image.open(f'{modo}/{i:04d}.png').convert('RGBA')
    except FileNotFoundError: return None
prev = None
def cuadro(fr, t, i, sec='', reset=False):
    global prev
    im = recorte(fr, t)
    a0 = np.array(im); im = Image.fromarray(cuerpo.retocar(a0, cuerpo.pose(a0, reset), panza=0.14, brazo=0.18))   # retoque de cuerpo (Eduardo)
    m = np.asarray(remove(im.resize((540, 960)), session=ses, only_mask=True).resize((OW, OH), Image.BILINEAR), dtype=np.float32) / 255
    if prev is not None and not reset: m = 0.55 * m + 0.45 * prev
    prev = m
    mi = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
    fondo = im.filter(ImageFilter.GaussianBlur(4.5 + 1.5 * (zoom(t) - 1)))   # desenfoque ligero (Eduardo)
    nitida = im.filter(ImageFilter.UnsharpMask(radius=2, percent=40, threshold=2))
    out = fondo.convert('RGBA')
    a = capa(sec + 'atras', i)
    if a: out = Image.alpha_composite(out, a)
    out = Image.composite(nitida.convert('RGBA'), out, mi)
    f = capa(sec + 'frente', i)
    if f: out = Image.alpha_composite(out, f)
    return out.convert('RGB')
def fuente(desde=0.0):
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-ss', str(desde), '-i', 'cortes.mov', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    while True:
        b = p.stdout.read(SW * SH * 3)
        if len(b) < SW * SH * 3: break
        yield np.frombuffer(b, np.uint8).reshape(SH, SW, 3)
cortes = [round(c * 30) for c in P['cortes']]
if sys.argv[1] == 'prueba':
    ts = [float(x) for x in sys.argv[2].split(',')]
    for j, t in enumerate(ts):
        fr = next(fuente(min(t, DUR - 0.04)))
        cuadro(fr, t, j, 'p-', reset=True).save(f'prueba-{j}.jpg', quality=88)
    print('listo', len(ts))
else:
    n = round(T * 30); ultimo = None; i = 0
    for fr in fuente():
        if i >= n: break
        sys.stdout.buffer.write(cuadro(fr, i / 30, i, '', reset=i in cortes).tobytes()); ultimo = fr; i += 1
    while i < n:
        sys.stdout.buffer.write(cuadro(ultimo, i / 30, i).tobytes()); i += 1
    print('cuadros', i, file=sys.stderr)
