# Voz de Higgsfield (ElevenLabs, Mark): quita los huecos entre frases y saca tiempos por palabra alineados al guion.
import json, re, subprocess, difflib, numpy as np, soundfile as sf
from faster_whisper import WhisperModel
GUION = """Ocho de la mañana, y tu día ya se salió de control.|La agenda llena, el teléfono no para, y los mensajes se acumulan.|Diez de la noche, ¡y sigues en la oficina!|Así no se puede crecer.|Ahora imagina esto:|una inteligencia artificial que contesta por ti, agenda tus citas, y guarda cada cliente en tu sistema.|Y tú, a lo que importa: dirigir tu negocio, y llegar a cenar a tu casa.|En Nexus AI lo hacemos realidad.|¡Agenda tu diagnóstico gratis de treinta minutos!""".split('|')
SR = 44100; MAXP = 0.20; INI = 0.2
raw = subprocess.run(['ffmpeg','-v','error','-i','junta.wav','-ac','1','-ar',str(SR),'-f','f32le','-'], capture_output=True).stdout
a = np.frombuffer(raw, np.float32).copy()
# 1) recortar silencios largos (energía cada 10 ms)
h = SR // 100; e = np.sqrt(np.convolve(a**2, np.ones(h)/h, 'same')); cal = e < max(0.012, np.percentile(e, 20) * 1.5)
trozos = []; i = 0; n = len(a)
while i < n:
    j = i
    while j < n and cal[j] == cal[i]: j += h
    j = min(j, n)
    if cal[i]:
        d = (j - i) / SR; lim = INI if i == 0 else MAXP
        if d > lim and j < n: quita = int((d - lim) * SR); m = i + (j - i - quita) // 2; trozos += [a[i:m], a[m + quita:j]]
        elif j >= n: trozos.append(a[i:i + int(1.0 * SR)])
        else: trozos.append(a[i:j])
    else: trozos.append(a[i:j])
    i = j
v = np.concatenate(trozos); sf.write('voz.wav', v, SR); print('antes', len(a)/SR, 'después', len(v)/SR)
# 2) tiempos por palabra y alineación con el guion
r16 = subprocess.run(['ffmpeg','-v','error','-i','voz.wav','-ac','1','-ar','16000','-f','f32le','-'], capture_output=True).stdout
m = WhisperModel('small', device='cpu', compute_type='int8')
s, _ = m.transcribe(np.frombuffer(r16, np.float32), language='es', word_timestamps=True)
O = [(w.start, w.end, w.word.strip()) for x in s for w in x.words]
print(' '.join(o[2] for o in O))
import unicodedata
NUM={'30':'treinta','8':'ocho','10':'diez'}
def nz(x):
    x=re.sub(r'[^a-z0-9ñ]', '', ''.join(c for c in unicodedata.normalize('NFD', x.lower().replace('ñ','\0')) if unicodedata.category(c)!='Mn').replace('\0','ñ')); return NUM.get(x,x)
mias = [(w, fi) for fi, f in enumerate(GUION) for w in f.split()]
sm = difflib.SequenceMatcher(None, [nz(w) for w, _ in mias], [nz(o[2]) for o in O], autojunk=False)
t = [None] * len(mias)
for blk in sm.get_matching_blocks():
    for k in range(blk.size): t[blk.a + k] = (O[blk.b + k][0], O[blk.b + k][1])
print('sin alinear:', [mias[i][0] for i in range(len(mias)) if t[i] is None])
# huecos: repartir entre vecinos
i = 0
while i < len(t):
    if t[i] is None:
        j = i
        while j < len(t) and t[j] is None: j += 1
        a0 = t[i-1][1] if i else 0.0; b0 = t[j][0] if j < len(t) else len(v)/SR
        for k in range(i, j): t[k] = (a0 + (b0-a0)*(k-i)/(j-i), a0 + (b0-a0)*(k-i+1)/(j-i))
        i = j
    else: i += 1
P = [[round(t[i][0], 2), round(t[i][1], 2), mias[i][0]] for i in range(len(mias))]
F = []
for fi, f in enumerate(GUION):
    idx = [i for i in range(len(mias)) if mias[i][1] == fi]; F.append([P[idx[0]][0], P[idx[-1]][1], f])
json.dump(P, open('palabras.json','w'), ensure_ascii=False); json.dump(F, open('frases.json','w'), ensure_ascii=False, indent=0)
for f in F: print(f[0], f[1], f[2][:50])
print('pausa máxima entre palabras:', max(P[i+1][0]-P[i][1] for i in range(len(P)-1)))
