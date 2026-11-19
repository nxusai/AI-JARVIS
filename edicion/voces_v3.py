# Voces con emoción (ElevenLabs v3 con etiquetas como [sighs], [whispers] o [laughs]) para cada toma de Kling.
# Cada turno se dice con la voz de su personaje y se pone donde ese personaje mueve la boca:
# whisper ubica las palabras en el audio de Kling dentro de la ventana del turno. La duración se
# ajusta poco (x0.8 a x1.3) para que no suene raro.
#   python voces_v3.py <carpeta>   ->  <carpeta>/tNN_v3.wav (mismo largo que la toma)
import json, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
from faster_whisper import WhisperModel

D = Path(sys.argv[1]); SR = 44100
VOZ = {'ED': 'ljWLDJb7OMkYo3VM9z8g',   # Eduardo: "El Nero", joven latino, para animación
       'AM': 'VvYiNBPylZtUh8Bf6u8l',   # el amigo: "Juan - Friendly & Effortless"
       'RA': 'z365btkMkbqu8wJGFTrh'}   # don Ramón: "Abel Quiñonez", mexicano
TURNOS = {
    't01': [('ED', '[sighs] Otro negocio cerrado... ¿cuántos van ya?', 0, 99)],
    't02': [('AM', 'Bro, ¿y ahora qué vas a intentar?', 0, 3.6), ('ED', '[stubborn] No sé... pero algo va a funcionar.', 3.6, 99)],
    't31': [('ED', '[sad] Ninguno me gusta... [broken voice] Siento que el fracasado soy yo.', 0, 99)],
    't32': [('AM', '[warmly] No te rindas, bro. Ya casi... lo presiento.', 0, 99)],
    't04': [('ED', '[tired] Último curso... lo prometo.', 0, 99)],
    't05': [('ED', '[whispers] Espérate... ¿inteligencia artificial?', 0, 99)],
    't06': [('RA', '[skeptical] ¿Y eso de la inteligencia artificial me va a traer clientes?', 0, 4.9), ('ED', '[confident] Usted deme un mes.', 4.9, 99)],
    't65': [('RA', '[shouting] ¿Bueno? ¿¡Otro pedido!? ¡Sí, sí, sí!', 0, 99)],
    't07': [('RA', '[laughs] ¡Muchacho, no paran de llegar pedidos!', 0, 99)],
    't08': [('ED', '[in disbelief] Trece mil quinientos dólares... en un mes.', 0, 99)],
    't09': [('AM', 'Bro... ¿todo esto es tuyo?', 0, 3.3), ('ED', '[proud] Nuestro. Y vamos creciendo, primero Dios.', 3.3, 99)],
    't99': [('AM', '[cheeky] ¿Nuestro? ¿O sea que ya me pagas?', 0, 3.6), ('ED', '[laughs] Empiezas el lunes.', 3.6, 99)],
    't10': [('ED', '[satisfied] Otro día cerrado... ¿cuántos clientes van ya?', 0, 99)],
}
solo = sys.argv[2:] or list(TURNOS)
m = WhisperModel('small', device='cpu', compute_type='int8')
for t in solo:
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(D / f'{t}.mp4'), '-vn', '-ac', '1', '-ar', str(SR), str(D / '_k.wav')], check=True)
    x, _ = sf.read(str(D / '_k.wav'))
    ws = [w for s in m.transcribe(resample_poly(x, 16000, SR).astype(np.float32), language='es', word_timestamps=True)[0] for w in s.words]
    out = np.zeros(len(x))
    for quien, texto, a, b in TURNOS[t]:
        mios = [w for w in ws if a <= w.start < b]
        t0, t1 = (mios[0].start, mios[-1].end) if mios else (a, min(b, len(x) / SR))
        json.dump({'text': texto, 'model_id': 'eleven_v3'}, open(D / '_c.json', 'w'))
        for intento in range(3):
            c = subprocess.run(['curl', '-sS', '-X', 'POST', f'https://api.elevenlabs.io/v1/text-to-speech/{VOZ[quien]}?output_format=mp3_44100_128',
                                '-H', 'content-type: application/json', '--data-binary', f"@{D / '_c.json'}", '-o', str(D / '_v.mp3'), '-w', '%{http_code}'],
                               capture_output=True, text=True).stdout
            if c == '200': break
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(D / '_v.mp3'), '-af',
                        'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
                        '-ar', str(SR), '-ac', '1', str(D / '_v.wav')], check=True)
        y, _ = sf.read(str(D / '_v.wav'))
        r = min(1.3, max(0.8, (len(y) / SR) / max(0.3, t1 - t0)))
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(D / '_v.wav'), '-af', f'atempo={r:.4f}', str(D / '_v2.wav')], check=True)
        y, _ = sf.read(str(D / '_v2.wav'))
        i = int(max(0, t0 - 0.05) * SR)
        if i + len(y) > len(out):  # la voz termina después de la toma: se alarga (el armado congela el último cuadro)
            out = np.concatenate([out, np.zeros(i + len(y) - len(out) + int(0.2 * SR))])
        out[i:i + len(y)] += y
        print(f'{t} {quien} {c} boca {t0:.2f}-{t1:.2f} s, voz {len(y)/SR:.2f} s (x{r:.2f}): {texto}')
    sf.write(str(D / f'{t}_v3.wav'), out, SR)
