# Arma un video de la ronda 2: tomas de Kling + capa de gráficos (capa-X/) + voces + música.
#   python3 armar.py A|B|C
import json, subprocess, sys

V = sys.argv[1]
D = __file__.rsplit('/', 1)[0] or '.'
P = json.load(open(f'{D}/plan.json'))[V]
T = P['T']

# (clip, desde_en_el_clip, inicio, fin) — None = fondo azul NXUS (la capa lo tapa)
TOMAS = {
    'A': [('c1', 0, 0, 2.6), ('c2', 0, 2.6, 7.4), ('c3', 0, 7.4, 11.8), (None, 0, 11.8, T)],
    'B': [('c4', 0, 0, 2.5), ('c5', 0, 2.5, 7.0), ('c6', 0, 7.0, 12.2), (None, 0, 12.2, T)],
    'C': [('c7', 0, 0, 2.0), (None, 0, 2.0, 6.6), ('c8b', 0, 6.6, 10.0), (None, 0, 10.0, T)],
}[V]
# (archivo, empieza_en, volumen, filtro_extra)
VOCES = {
    'A': [('vozA.mp3', 0.05, 1.25, '')],
    'B': [('vozB.mp3', 0.05, 1.25, '')],
    'C': [('vozC1.mp3', 0.05, 1.25, ''), ('timbre.wav', 5.9, 0.55, ''),
          ('nex.mp3', 8.35, 1.5, 'highpass=f=300,lowpass=f=3400,'), ('vozC2.mp3', 13.75, 1.25, '')],
}[V]

ent, fil, n = [], [], 0
for i, (c, ss, a, b) in enumerate(TOMAS):
    d = b - a
    if c is None:
        fil.append(f'color=c=0x120c33:s=1080x1920:r=30:d={d:.3f}[s{i}]')
        continue
    ent += ['-ss', str(ss), '-i', f'{D}/in/{c}.mp4']
    disp = 5.04 - ss
    lento = max(1.0, d / disp)          # si la toma es más corta que el tramo, se estira un poco
    z = 0.06
    fil.append(f'[{n}:v]setpts={lento:.4f}*(PTS-STARTPTS),fps=30,scale=1080:-2,crop=1080:1920,'
               f"scale=w='trunc(1080*(1+{z}*t/{d:.3f})/2)*2':h=-2:eval=frame,crop=1080:1920,setsar=1,"
               f'eq=contrast=1.05:saturation=1.08,trim=duration={d:.3f}[s{i}]')
    n += 1
fil.append(''.join(f'[s{i}]' for i in range(len(TOMAS))) + f'concat=n={len(TOMAS)}:v=1:a=0,format=yuv420p[v]')
# Paso 1: el fondo (tomas) en su propio archivo; en un solo paso con la capa, ffmpeg desfasaba las tomas
base = f'{D}/base-{V}.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y', *ent, '-filter_complex', ';'.join(fil), '-map', '[v]', '-t', str(T),
                '-r', '30', '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', base], check=True)

# Audio aparte (mezclado junto con el video se cortaba antes del final)
aent = ['-i', f'{D}/in/mus{V}.wav']
af = []
vz = []
for j, (f, a, vol, extra) in enumerate(VOCES):
    aent += ['-i', f'{D}/in/{f}']
    ms = int(a * 1000)
    af.append(f'[{j + 1}:a]{extra}aresample=44100,aformat=channel_layouts=stereo,volume={vol},adelay={ms}|{ms},apad=whole_dur={T}[v{j}]')
    vz.append(f'[v{j}]')
af.append(''.join(vz) + f'amix=inputs={len(vz)}:normalize=0:duration=longest,atrim=duration={T}[voces]')
af.append('[voces]asplit[voz][llave]')
af.append(f'[0:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.8,apad=whole_dur={T}[mus]')
af.append('[mus][llave]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=320[musb]')
af.append(f'[musb][voz]amix=inputs=2:normalize=0:duration=longest,atrim=duration={T},loudnorm=I=-14:TP=-1.2,aresample=48000,apad=whole_dur={T},atrim=duration={T}[au]')
wav = f'{D}/mezcla-{V}.wav'
subprocess.run(['ffmpeg', '-v', 'error', '-y', *aent, '-filter_complex', ';'.join(af), '-map', '[au]', '-c:a', 'pcm_s16le', wav], check=True)

out = f'{D}/NXUS-R2-{V}.mp4'
# Paso 2: fondo + capa de gráficos + audio
cmd = ['ffmpeg', '-v', 'error', '-y', '-i', base, '-framerate', '30', '-i', f'{D}/capa-{V}/%04d.png', '-i', wav,
       '-filter_complex', f'[0:v][1:v]overlay=format=auto,format=yuv420p,trim=duration={T}[v]', '-map', '[v]', '-map', '2:a', '-t', str(T),
       '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-profile:v', 'high', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out]
subprocess.run(cmd, check=True)
dur = lambda s: subprocess.run(['ffprobe', '-v', 'error', '-select_streams', s, '-show_entries', 'stream=duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout.strip()
print(V, 'listo · video', dur('v'), '· audio', dur('a'))
