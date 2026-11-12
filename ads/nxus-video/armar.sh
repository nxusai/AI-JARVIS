#!/usr/bin/env bash
# Arma una versión del anuncio: tomas + capa de gráficos + voz + música.
set -e
A="$(cd "$(dirname "$0")" && pwd)"; V=$1; cd "$A"
read H T <<< $(python3 -c "import json;p=json.load(open('plan.json'))['$V'];print(p['H'],p['T'])")
G="eq=contrast=1.06:saturation=1.1,colorbalance=bs=.04:bm=.02:rh=.02"
Z() { echo "scale=w='trunc(1080*(1+$1*t/$2)/2)*2':h=-2:eval=frame,crop=1080:1920,setsar=1,fps=30"; }
f() { python3 -c "print(round($1,3))"; }
E() { python3 -c "print(round($1/$2,4))"; }   # estira la toma para que dure lo que toca
case $V in A) GH=s1;; B) GH=s3;; C) GH=s4;; esac
case $V in B) CHAT=s1;; *) CHAT=s3;; esac
TH=$H; T1=5.3; T2=7.7; T3=3.9; T4=6.5; T5=$(f "$T-$H-23.4")
# Audio aparte (mezclarlo junto con el video lo cortaba antes del final)
ffmpeg -v error -y -i musica-$V.wav -i voz-$V.wav -filter_complex "
 [1:a]volume='if(gt(t,$H+23.2),1.5,1.2)':eval=frame,asplit[voz][llave];[0:a]volume='if(gt(t,$H+23.2),0.32,0.85)':eval=frame[mus];
 [mus][llave]sidechaincompress=threshold=0.03:ratio=7:attack=12:release=300[musb];
 [musb][voz]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.2,aresample=48000[au]" -map "[au]" -t $T -c:a pcm_s16le mezcla-$V.wav
ffmpeg -v error -y -i in/$GH.mp4 -i in/s2.mp4 -i in/$CHAT.mp4 -i in/s4.mp4 -ss 1.2 -i in/s4.mp4 \
 -framerate 30 -i capa-$V/%04d.png -i mezcla-$V.wav -filter_complex "
 [0:v]setpts=$(E $TH 5.04)*(PTS-STARTPTS),$(Z 0.09 $TH),$G,$( [ $V = B ] && echo 'gblur=sigma=10,eq=brightness=-.08,' )trim=duration=$TH[s0];
 [1:v]setpts=$(E $T1 5.04)*(PTS-STARTPTS),$(Z 0.07 $T1),$G,trim=duration=$T1[s1];
 [2:v]setpts=$(E $T2 5.04)*(PTS-STARTPTS),$(Z 0.04 $T2),$G,gblur=sigma=12,eq=brightness=-.1,trim=duration=$T2[s2];
 [3:v]setpts=$(E $T3 5.04)*(PTS-STARTPTS),$(Z 0.04 $T3),$G,gblur=sigma=14,eq=brightness=-.12,trim=duration=$T3[s3];
 [4:v]hflip,setpts=$(E $T4 3.8)*(PTS-STARTPTS),$(Z 0.08 $T4),$G,eq=brightness=-.06,trim=duration=$T4[s4];
 color=c=0x050914:s=1080x1920:r=30:d=$T5[s5];
 [s0][s1][s2][s3][s4][s5]concat=n=6:v=1:a=0,format=yuv420p,trim=duration=$T[base];
 [base][5:v]overlay=format=auto,format=yuv420p[v]" \
 -map "[v]" -map 6:a -t $T -c:v libx264 -crf 17 -preset slow -profile:v high -c:a aac -b:a 256k -movflags +faststart "NXUS-Ad-$V.mp4"
echo "$V listo audio $(ffprobe -v error -select_streams a -show_entries stream=duration -of csv=p=0 NXUS-Ad-$V.mp4) video $(ffprobe -v error -show_entries format=duration -of csv=p=0 NXUS-Ad-$V.mp4)"
