# ajustar_voz.py original.wav salida.wav "texto parte 1" N1 "texto parte 2" N2 ...
# Cada parte (N palabras de whisper) se dice con su clon y se pone donde empieza esa parte en la toma.
import sys, json, subprocess, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from faster_whisper import WhisperModel
orig, salida, resto = sys.argv[1], sys.argv[2], sys.argv[3:]
partes = [(resto[i], int(resto[i + 1])) for i in range(0, len(resto), 2)]
x, sr = sf.read(orig, always_2d=True); x = x.mean(1)
m = WhisperModel('small', device='cpu', compute_type='int8')
ws = [w for s in m.transcribe(resample_poly(x, 16000, sr).astype(np.float32), language='es', word_timestamps=True)[0] for w in s.words]
print('whisper:', [(w.word.strip(), round(w.start, 2)) for w in ws])
out = np.zeros(len(x)); k = 0
for texto, n in partes:
    t0, t1 = ws[k].start, ws[k + n - 1].end; k += n
    json.dump({'text': texto, 'model_id': 'eleven_multilingual_v2', 'voice_settings': {'stability': 0.5, 'similarity_boost': 0.9, 'style': 0.25, 'use_speaker_boost': True}}, open('_c.json', 'w'))
    subprocess.run(['curl', '-sS', '-X', 'POST', 'https://api.elevenlabs.io/v1/text-to-speech/pZyxpOKXKkSeNV6q2OnW?output_format=mp3_44100_128', '-H', 'content-type: application/json', '-H', 'accept: audio/mpeg', '--data-binary', '@_c.json', '-o', '_tts.mp3'], check=True)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', '_tts.mp3', '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', '-ar', str(sr), '-ac', '1', '_tts.wav'], check=True)
    y, _ = sf.read('_tts.wav')
    r = min(1.25, max(0.85, (len(y) / sr) / (t1 - t0)))
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', '_tts.wav', '-af', f'atempo={r:.4f}', '_tts2.wav'], check=True)
    y, _ = sf.read('_tts2.wav'); i = int(t0 * sr); out[i:i + len(y)] += y[:len(out) - i]
    print(f'  "{texto}" en {t0:.2f}-{t1:.2f} s (dura {len(y)/sr:.2f}, ajuste x{r:.2f})')
sf.write(salida, out, sr)
