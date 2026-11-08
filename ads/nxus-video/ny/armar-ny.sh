#!/usr/bin/env bash
# Arma un video de NY (sin voz): cuadros + música. Uso: bash armar-ny.sh en 1
set -e
cd "$(dirname "$0")"; L=$1; K=$2; T=19
NODE_PATH=$(npm root -g) node capa-ny.cjs $L $K
python3 ../musica.py musica-ny.wav $T 3.6 "3.6,7.0,12.6,15.6"
ffmpeg -v error -y -i musica-ny.wav -af "loudnorm=I=-16:TP=-1.5,aresample=48000" -c:a pcm_s16le musica-ny-n.wav
ffmpeg -v error -y -framerate 30 -i cuadros-$L$K/%04d.jpg -i musica-ny-n.wav -map 0:v -map 1:a -t $T \
  -c:v libx264 -crf 18 -preset slow -profile:v high -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "NXUS-NY-$K-${L^^}.mp4"
echo "NY-$K-$L audio $(ffprobe -v error -select_streams a -show_entries stream=duration -of csv=p=0 NXUS-NY-$K-${L^^}.mp4) video $(ffprobe -v error -show_entries format=duration -of csv=p=0 NXUS-NY-$K-${L^^}.mp4)"
