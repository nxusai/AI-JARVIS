#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
export NODE_PATH=$(npm root -g)
rm -rf atras frente
node capa.js atras && node capa.js frente
# Voz limpia arriba y música abajo (la voz se normaliza ANTES de mezclar).
ffmpeg -v error -y -i cortes.mov -i musica.wav -filter_complex "[0:a]highpass=f=80,afftdn=nf=-25,acompressor=threshold=-24dB:ratio=3:attack=8:release=120,loudnorm=I=-15:TP=-1.5,aresample=48000,asplit[voz][llave];[1:a]aresample=48000,volume=0.16[mus];[mus][llave]sidechaincompress=threshold=0.03:ratio=6:attack=10:release=300[musb];[voz][musb]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89[a]" -map "[a]" -t 15.36 -c:a pcm_s16le mezcla.wav
${PY:-python3} componer.py todo 2>log-componer.txt | ffmpeg -v error -y -f rawvideo -pix_fmt rgb24 -s 1080x1920 -r 30 -i - -i mezcla.wav -map 0:v -map 1:a -vf "eq=contrast=1.05:saturation=1.08,colorbalance=rs=.02:gs=.0:bs=-.03:rm=.02:bm=-.02,vignette=PI/6" -c:v libx264 -crf 17 -preset slow -profile:v high -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart ${SALIDA:-Editado.mp4}
echo "video $(ffprobe -v error -select_streams v -show_entries stream=duration -of csv=p=0 ${SALIDA:-Editado.mp4}) audio $(ffprobe -v error -select_streams a -show_entries stream=duration -of csv=p=0 ${SALIDA:-Editado.mp4})"
