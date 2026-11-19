# Corto con diálogo en escena, versión 2 (estilo togi): voces con emoción (voces_v3.py), efectos de
# sonido reales (ElevenLabs sound-generation), música compuesta por partes (ElevenLabs music) que
# cambia con la historia (tensa → emotiva → subida → éxito), gags con rótulo y loop.
#   python corto_dialogo2.py <carpeta> <carpeta_sfx>   ->  <carpeta>/Corto-Dialogo-v2.mp4
import json, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf
from PIL import Image, ImageFilter
from scipy.signal import resample_poly
from faster_whisper import WhisperModel

D, FX = Path(sys.argv[1]), Path(sys.argv[2])
W, H, FPS, SR = 1080, 1920, 30, 48000
TMP = D / 'tmp2'; TMP.mkdir(exist_ok=True)

# ('toma', nombre, subtítulo, opciones) | ('fija', imagen, seg, rótulo, opciones) | ('logo', seg)
# opciones: ini (forzar inicio en la toma), amb (ambiente), sfx [(efecto, segundo_en_la_toma, volumen)],
#           rotulo (texto, desde, hasta: segundos desde el inicio recortado), musica (parte que empieza aquí)
ESCENAS = [
    ('toma', 't01', 'Otro negocio cerrado… ¿cuántos van ya?', dict(ini=0.8, amb='lluvia', musica='tenso',
        sfx=[('cortina', 0.25, 1.0), ('trueno', 1.3, .8)])),
    ('toma', 't02', 'Bro, ¿y ahora qué vas a intentar? No sé… pero algo va a funcionar.', dict(amb='lluvia')),
    ('fija', 's02.png', 1.4, '~ UN NEGOCIO TRAS OTRO ~', dict(sfx=[('golpe', 0, 1.0)])),
    ('fija', 's03.png', 1.4, '~ UN NEGOCIO TRAS OTRO ~', dict(sfx=[('golpe', 0, .8)])),
    ('toma', 't31', 'Ninguno me gusta… Siento que el fracasado soy yo.', dict(amb='lluvia_carro', musica='emocional')),
    ('toma', 't32', 'No te rindas, bro. Ya casi… lo presiento.', dict(amb='lluvia_carro')),
    ('toma', 't04', 'Último curso… lo prometo.', dict(amb='cuarto')),
    ('toma', 't05', 'Espérate… ¿inteligencia artificial?', dict(ini=0.2, musica='subida', rotulo=('~ NO ERA EL ÚLTIMO ~', 0, 1.3),
        sfx=[('scratch', 0.2, .9), ('chispa', 1.1, .9)])),
    ('logo', 1.9),
    ('toma', 't06', '¿Y eso de la inteligencia artificial me va a traer clientes? Usted deme un mes.', dict(amb='restaurante', musica='exito')),
    ('toma', 't65', '¿Bueno? ¿¡Otro pedido!? ¡Sí, sí, sí!', dict(ini=0.3, amb='caos', rotulo=('~ UN MES DESPUÉS ~', 0, 1.4),
        sfx=[('ding', 0.6, .7), ('ding', 1.0, .7), ('ding', 1.3, .7), ('caja', 2.2, .8), ('ding', 3.0, .7)])),
    ('toma', 't07', '¡Muchacho, no paran de llegar pedidos!', dict(amb='restaurante', sfx=[('caja', 0.8, .8)])),
    ('toma', 't08', 'Trece mil quinientos dólares… en un mes.', dict(amb='carro_lujo', sfx=[('ding', 0.05, 1.0)])),
    ('toma', 't09', 'Bro… ¿todo esto es tuyo? Nuestro. Y vamos creciendo, primero Dios.', dict(amb='oficina')),
    ('toma', 't99', '¿Nuestro? ¿O sea que ya me pagas? Empiezas el lunes.', dict(amb='oficina', pausa=0.8)),
    ('toma', 't10', 'Otro día cerrado… ¿cuántos clientes van ya?', dict(ini=0.2, amb='lluvia', sfx=[('llaves', 0.3, 1.0)])),
]
MUSICA = {
    'tenso': 'Dark tense cinematic synth drone for a rainy night in a crime video game cutscene, low heartbeat pulse, distant thunder mood, minimal, instrumental',
    'emocional': 'Sad emotional solo piano with soft warm strings, intimate and heartfelt, slowly becoming hopeful at the very end, instrumental',
    'subida': 'Suspense build: ticking synth arpeggio and rising risers getting louder, tension building to a huge drop, instrumental',
    'exito': 'Confident energetic retro 80s synthwave with punchy drums, driving bass and bright synth lead, triumphant Miami night drive vibe, instrumental',
}
SUSTITUYE = {'TRECE MIL QUINIENTOS': '$13,500', 'MIL QUINIENTOS': '$13,500'}

def dur(f): return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)], capture_output=True, text=True).stdout)
def leer(f):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(f), '-vn', '-ac', '1', '-ar', str(SR), str(TMP / '_a.wav')], check=True)
    return sf.read(str(TMP / '_a.wav'))[0]

# 1) Tiempos de cada toma según la voz nueva
modelo = WhisperModel('small', device='cpu', compute_type='int8')
info = {}
for e in ESCENAS:
    if e[0] != 'toma': continue
    nom, texto, op = e[1], e[2], e[3]
    voz = leer(D / f'{nom}_v3.wav')
    ws = [w for s in modelo.transcribe(resample_poly(voz, 1, 3).astype(np.float32), language='es', word_timestamps=True)[0] for w in s.words]
    ini = op.get('ini', max(0, ws[0].start - 0.15)); fin = ws[-1].end + 0.3
    # Se quitan las pausas largas entre frases (corte en cada línea, como togi): se dejan 0.2 s antes
    # de la siguiente frase y 0.2 s después de la anterior. La pausa del remate se respeta con 'pausa'.
    keep, a0 = [], ini
    for w1, w2 in zip(ws, ws[1:]):
        if w2.start - w1.end > op.get('pausa', 0.45) and w1.end + 0.2 > a0:
            keep.append((a0, w1.end + 0.2)); a0 = w2.start - 0.2
    keep.append((a0, fin))
    pal = texto.split()
    if len(pal) == len(ws): tiempos = [(p, w.start, w.end) for p, w in zip(pal, ws)]
    else:
        paso = (ws[-1].end - ws[0].start) / len(pal)
        tiempos = [(p, ws[0].start + k * paso, ws[0].start + (k + 1) * paso) for k, p in enumerate(pal)]
    info[nom] = dict(ini=ini, fin=fin, voz=voz, pal=tiempos, vdur=dur(D / f'{nom}.mp4'), keep=keep)

def mapa(i, tc):
    # segundo de la toma original -> segundo dentro de la pieza recortada
    acum = 0.0
    for a, b in i['keep']:
        if tc < a: return acum
        if tc <= b: return acum + tc - a
        acum += b - a
    return acum

# 2) Video
def logo_card():
    logo = Image.open(D / 'logo.png').convert('RGB'); a = np.asarray(logo).astype(np.float32)
    logo = Image.fromarray(np.dstack([np.asarray(logo), np.clip((255 - a.min(axis=2)) * 1.6, 0, 255).astype(np.uint8)]), 'RGBA')
    logo = logo.crop(logo.getbbox()); logo = logo.resize((760, int(760 * logo.height / logo.width)))
    yy, xx = np.mgrid[0:H, 0:W]; r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * .47) / H) ** 2)
    card = Image.fromarray(np.dstack([10 + 70 * np.exp(-r * 6), 6 + 25 * np.exp(-r * 7), 25 + 120 * np.exp(-r * 5)]).astype(np.uint8)).convert('RGBA')
    pos = ((W - logo.width) // 2, int(H * .47 - logo.height / 2)); g = Image.new('RGBA', (W, H)); g.paste(logo, pos, logo)
    card = Image.alpha_composite(card, g.filter(ImageFilter.GaussianBlur(40))); card.paste(logo, pos, logo); card.convert('RGB').save(TMP / 'logo_card.png')

t, piezas, plan = 0.0, [], []
for k, e in enumerate(ESCENAS):
    out = TMP / f'p{k:02d}.mp4'
    if e[0] == 'toma':
        i = info[e[1]]
        falta = max(0, i['fin'] - i['vdur'])
        vf = f'scale={W}:{H}:flags=lanczos,unsharp=5:5:0.6,fps={FPS}' + (f',tpad=stop_mode=clone:stop_duration={falta + 0.1:.2f}' if falta > 0 else '')
        larga = TMP / f'l{k:02d}.mp4'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(D / f'{e[1]}.mp4'), '-vf', vf + ',format=yuv420p', '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', str(larga)], check=True)
        partes = []
        for j, (a, b) in enumerate(i['keep']):
            pj = TMP / f'p{k:02d}_{j}.mp4'; dj = round((b - a) * FPS) / FPS
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{a:.3f}', '-i', str(larga), '-t', f'{dj:.3f}', '-c:v', 'libx264', '-crf', '17', '-preset', 'fast', str(pj)], check=True)
            partes.append(f"file '{pj}'")
        (TMP / f'l{k:02d}.txt').write_text('\n'.join(partes))
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(TMP / f'l{k:02d}.txt'), '-c', 'copy', str(out)], check=True)
        d = dur(out)
        plan.append(dict(tipo='toma', nom=e[1], t=t, d=d, op=e[3]))
    else:
        if e[0] == 'logo':
            logo_card(); src, d, z, op = TMP / 'logo_card.png', e[1], f'(1.0+0.08*t/{e[1]})', dict(sfx=[('logo', -0.5, 1.0)])
        else:
            src, d, z, op = D / e[1], e[2], f'(1.06+0.10*t/{e[2]})', dict(e[4], rotulo=(e[3], 0, e[2]))
        vf = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},scale=w='2*trunc({W}*{z}/2)':h=-2:eval=frame:flags=lanczos,crop={W}:{H},fps={FPS}"
        if e[0] == 'logo': vf += ',fade=in:st=0:d=0.3:color=white'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-t', f'{d:.3f}', '-i', str(src), '-vf', vf + ',format=yuv420p',
                        '-c:v', 'libx264', '-crf', '17', '-preset', 'fast', str(out)], check=True)
        d = round(d * FPS) / FPS
        plan.append(dict(tipo=e[0], t=t, d=d, op=op))
    piezas.append(f"file '{out}'"); t += d
TOTAL = t
(TMP / 'lista.txt').write_text('\n'.join(piezas))
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(TMP / 'lista.txt'), '-c', 'copy', str(TMP / 'base.mp4')], check=True)
print(f'Duración: {TOTAL:.1f} s')

# 3) Subtítulos y rótulos
def ts(s): return f"{int(s//3600)}:{int(s%3600//60):02d}:{max(0,s)%60:05.2f}"
ev = []
for p in plan:
    if p['tipo'] == 'toma':
        i = info[p['nom']]; g, grupos = [], []
        for w in i['pal']:
            g.append(w)
            if len(g) == 3 or len(' '.join(x[0] for x in g)) > 14 or w[0][-1] in '.,…?!':
                grupos.append(g); g = []
        if g: grupos.append(g)
        for k, g in enumerate(grupos):
            a0 = p['t'] + mapa(i, g[0][1])
            a1 = p['t'] + (mapa(i, grupos[k + 1][0][1]) if k + 1 < len(grupos) else min(mapa(i, g[-1][2]) + .3, p['d']))
            txt = ' '.join(x[0] for x in g).upper().rstrip('.,…')
            for a, b in SUSTITUYE.items(): txt = txt.replace(a, b)
            ev.append(f"Dialogue: 0,{ts(a0)},{ts(a1)},Sub,,0,0,0,,{{\\pos(540,1240)\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}}{txt}")
    if 'rotulo' in p['op']:
        txt, a, b = p['op']['rotulo']
        ev.append(f"Dialogue: 1,{ts(p['t'] + a)},{ts(p['t'] + b)},Rotulo,,0,0,0,,{{\\pos(540,700)\\fad(80,150)}}{txt}")
(TMP / 'texto.ass').write_text(f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter ExtraBold,80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,1,0,1,6,4,5,60,60,0,1
Style: Rotulo,Inter ExtraBold,70,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,-1,-1,0,0,100,100,2,0,1,6,5,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + '\n'.join(ev) + '\n')

# 4) Música por partes (ElevenLabs music), a la medida de cada tramo
inicios = [(p['op']['musica'], p['t']) for p in plan if 'musica' in p.get('op', {})]
tramos = [(n, a, (inicios[k + 1][1] if k + 1 < len(inicios) else TOTAL)) for k, (n, a) in enumerate(inicios)]
N = int(TOTAL * SR); mus = np.zeros(N)
for n, a, b in tramos:
    f = TMP / f'musica_{n}.mp3'; largo = b - a + (0.6 if b < TOTAL else 0)
    if not f.exists():
        json.dump({'prompt': MUSICA[n] + f'. Exactly {largo:.0f} seconds.', 'music_length_ms': int(max(3, largo) * 1000), 'force_instrumental': True}, open(TMP / '_m.json', 'w'))
        c = subprocess.run(['curl', '-sS', '-X', 'POST', 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', '-H', 'content-type: application/json',
                            '--data-binary', f"@{TMP / '_m.json'}", '-o', str(f), '-w', '%{http_code}'], capture_output=True, text=True).stdout
        print(f'música {n}: {c} ({largo:.1f} s)')
    x = leer(f); L = int(largo * SR); x = x[:L]
    fi, fo = int(.3 * SR), int(.6 * SR)
    x[:fi] *= np.linspace(0, 1, fi)
    if b < TOTAL: x[-fo:] *= np.linspace(1, 0, fo)
    i = int(a * SR); mus[i:i + len(x)] += x[:N - i] / (np.abs(x).max() + 1e-9)

# 5) Voces, ambientes y efectos
voz = np.zeros(N); amb = np.zeros(N); sfx = np.zeros(N)
def poner(dst, s, t0, g=1.0):
    i = int(t0 * SR)
    if i < 0: s = s[-i:]; i = 0
    if i < N: dst[i:i + len(s)] += s[:N - i] * g
for p in plan:
    op = p.get('op', {})
    ini = info[p['nom']]['ini'] if p['tipo'] == 'toma' else 0
    if p['tipo'] == 'toma':
        vv = info[p['nom']]['voz']; v = np.concatenate([vv[int(a * SR):int(b * SR)] for a, b in info[p['nom']]['keep']])[:int(p['d'] * SR)]
        r = np.sqrt(np.mean(v[np.abs(v) > .01] ** 2)) if np.any(np.abs(v) > .01) else 1
        poner(voz, v * (.12 / r), p['t'])
    if op.get('amb'):
        a = leer(FX / f"{op['amb']}.mp3"); L = int(p['d'] * SR)
        a = np.tile(a, L // len(a) + 1)[:L]; e = np.ones(L); f = min(L // 4, int(.15 * SR)); e[:f] = np.linspace(0, 1, f); e[-f:] = np.linspace(1, 0, f)
        poner(amb, a * e / (np.abs(a).max() + 1e-9), p['t'], .9 if op['amb'] == 'caos' else .55)
    for n, s0, g in op.get('sfx', []):
        x = leer(FX / f'{n}.mp3'); poner(sfx, x / (np.abs(x).max() + 1e-9), p['t'] + (mapa(info[p['nom']], s0) if p['tipo'] == 'toma' else s0), g)
for p in plan[1:]:
    w = leer(FX / 'whoosh.mp3'); poner(sfx, w / (np.abs(w).max() + 1e-9), p['t'] - .25, .25)
envv = np.convolve(np.abs(voz), np.ones(int(.08 * SR)) / int(.08 * SR), 'same')
duck = np.convolve(1 - .55 * np.clip(envv / (envv.max() * .2 + 1e-9), 0, 1), np.ones(int(.15 * SR)) / int(.15 * SR), 'same')
mezcla = voz / (np.abs(voz).max() + 1e-9) * .95 + mus * .28 * duck + amb * .22 * (0.5 + 0.5 * duck) + sfx * .45
sf.write(str(TMP / 'mezcla.wav'), np.stack([mezcla, mezcla], 1) * .7, SR)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(TMP / 'mezcla.wav'), '-af', 'highpass=f=40,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.2:LRA=11',
                '-ar', str(SR), str(TMP / 'audio.wav')], check=True)

# 6) Final
salida = D / 'Corto-Dialogo-v2.mp4'
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(TMP / 'base.mp4'), '-i', str(TMP / 'audio.wav'), '-vf', f"ass={TMP / 'texto.ass'}",
                '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(salida)], check=True)
print('Listo:', salida)
