# Transcribe con tiempo por palabra. Uso: oir.py audio [salida.json]
import sys, json, subprocess, numpy as np
from faster_whisper import WhisperModel
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout
a = np.frombuffer(raw, np.float32)
m = WhisperModel('small', device='cpu', compute_type='int8')
s, _ = m.transcribe(a, language='es', word_timestamps=True, initial_prompt=sys.argv[3] if len(sys.argv) > 3 else None)
W = [[round(w.start, 2), round(w.end, 2), w.word.strip()] for x in s for w in x.words]
print(' '.join(w[2] for w in W))
if len(sys.argv) > 2: json.dump(W, open(sys.argv[2], 'w'), ensure_ascii=False)
