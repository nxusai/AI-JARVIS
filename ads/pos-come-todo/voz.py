# Voz hecha aquí (Kokoro, voz em_alex): una frase a la vez, sin huecos, con tiempos por palabra.
import json, re, subprocess, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
from faster_whisper import WhisperModel
FRASES = [
 "Tu come todo se llena. Pero, ¿sabes en qué mesas ganaste y en cuáles perdiste?",
 "El precio es fijo, pero cada mesa te cuesta distinto.",
 "Y en un punto de venta genérico, lo común es el truco de capturar platillos en ceros.",
 "En Nexus AI te construimos un punto de venta a tu medida.",
 "El mesero abre un come todo y anota todo lo que pide la mesa, sin sumarlo a la cuenta.",
 "Tu cliente solo ve una línea: un come todo, un precio.",
 "Pero tú ves todo lo que se consumió, cuánto te costó, y si en esa mesa ganaste o perdiste.",
 "Por mesa, por día y por platillo.",
 "Con tus reglas: tiempo por mesa, niños, bebidas aparte.",
 "Un sistema hecho para tu restaurante. Agenda tu diagnóstico gratis de treinta minutos.",
]
PAUSA = 0.16
k = Kokoro('modelos/kokoro-v1.0.onnx', 'modelos/voices-v1.0.bin')
m = WhisperModel('small', device='cpu', compute_type='int8')
def recorta(a, sr):
    e = np.abs(a) > 0.012; i = np.argmax(e); j = len(a) - np.argmax(e[::-1])
    return a[max(0, i - int(.02*sr)): min(len(a), j + int(.05*sr))]
out = []; palabras = []; frases = []; t = 0.25; sr = 24000
out.append(np.zeros(int(t*sr), np.float32))
for f in FRASES:
    a, sr = k.create(f, voice='em_alex', speed=1.06, lang='es'); a = recorta(a.astype(np.float32), sr)
    raw = subprocess.run(['ffmpeg','-v','error','-f','f32le','-ar',str(sr),'-ac','1','-i','-','-ar','16000','-f','f32le','-'], input=a.tobytes(), capture_output=True).stdout
    s, _ = m.transcribe(np.frombuffer(raw, np.float32), language='es', word_timestamps=True, initial_prompt=f)
    oidas = [(w.start, w.end, w.word.strip()) for x in s for w in x.words]
    mias = f.split(); d = len(a)/sr
    limpia = lambda x: re.sub(r'[^\wáéíóúñ]', '', x.lower())
    if len(oidas) == len(mias): tiempos = [(o[0], o[1]) for o in oidas]; modo = 'whisper'
    else:
        pesos = np.array([len(limpia(x)) + 1.5 for x in mias], float); c = np.concatenate([[0], np.cumsum(pesos)]) / pesos.sum() * d
        tiempos = list(zip(c[:-1], c[1:])); modo = 'REPARTIDO'
    print(f'{t:6.2f} {d:5.2f} {modo:9s} {" ".join(o[2] for o in oidas)}')
    for (a0, a1), w in zip(tiempos, mias): palabras.append([round(t + a0, 2), round(t + min(a1, d), 2), w])
    frases.append([round(t, 2), round(t + d, 2), f])
    out += [a, np.zeros(int(PAUSA*sr), np.float32)]; t += d + PAUSA
out.append(np.zeros(int(1.2*sr), np.float32))
v = np.concatenate(out); sf.write('voz.wav', v, sr)
json.dump(palabras, open('palabras.json','w'), ensure_ascii=False); json.dump(frases, open('frases.json','w'), ensure_ascii=False, indent=0)
print('TOTAL', len(v)/sr)
