#!/usr/bin/env bash
# Baja las tomas y voces de Higgsfield y arma voz y música de cada versión (A, B, C).
# Después: NODE_PATH=$(npm root -g) node capa.js A   y   bash armar.sh A   (igual B y C).
# Necesita ffmpeg, node con playwright y python con numpy, scipy y soundfile.
set -e
cd "$(dirname "$0")"; mkdir -p in
B=https://d8j0ntlcm91z4.cloudfront.net/user_38fVGME9vKjjtrwom56q66jjT9K
b() { [ -s "in/$1" ] || curl -sS -o "in/$1" "$B/$2"; }
b s1.mp4 hf_20261103_213242_276acb62-6fad-460c-a72a-b969a8df6fb8.mp4        # restaurante cerrado, celular con avisos
b s2.mp4 hf_20261103_213242_1bbaa4a2-c581-4420-ae8e-1b96224bd9d0.mp4        # restaurante lleno, gerente estresado
b s3.mp4 hf_20261103_213242_e4acc254-3b9f-497f-abd9-cca037a68dda.mp4        # comedor elegante
b s4.mp4 hf_20261103_213244_f57eaf86-a383-40b4-9189-5cad124e66af.mp4        # toma aérea de edificios
b ganchoA.mp3 hf_20261103_213250_252eda70-7c80-46fd-8c6b-72d5cf0d9a55.mp3   # voz Mark
b ganchoB.mp3 hf_20261103_213250_a438bfcb-0730-4f2f-bee9-65ffccf31bf0.mp3
b ganchoC2.mp3 hf_20261103_230033_be25c90b-fa87-4b19-9c77-ad89f0d435e4.mp3  # sin zonas (ya no se usa)
b ganchoC3.mp3 hf_20261106_202224_66a45f15-9228-421b-a537-6beb6bb6d424.mp3  # "¿Tienes un restaurante con varias sucursales? Mira lo que se pierde cuando nadie contesta."
b cuerpo.mp3 hf_20261103_213251_52697343-d81e-4578-b6fa-ae19e3aa5ccf.mp3
b zona.mp3 hf_20261103_230036_fbc66ed7-74a7-4131-ade6-d120f341abb8.mp3      # "para restaurantes y empresas que quieren crecer."
b cierre.mp3 hf_20261104_010841_5a1179ad-536b-4afc-87e0-fa0e816828cd.mp3    # "Agenda tu diagnóstico gratis de treinta minutos."
# Cuerpo final: se cambia la frase de zonas y se cierra con el diagnóstico (sin "Escríbenos INFO").
ffmpeg -v error -y -i in/cuerpo.mp3 -i in/zona.mp3 -filter_complex "[0:a]aresample=44100,asplit[x][y];[x]atrim=0:21.137[p1];[y]atrim=start=24.676,asetpts=PTS-STARTPTS[p3];[1:a]aresample=44100,atrim=0:2.75,apad=whole_dur=3.539[p2];[p1][p2][p3]concat=n=3:v=0:a=1[a]" -map "[a]" in/cuerpo2.wav
ffmpeg -v error -y -i in/cuerpo2.wav -i in/cierre.mp3 -filter_complex "[0:a]atrim=0:25.05[p1];[1:a]aresample=44100,atrim=0:2.85,afade=t=out:st=2.7:d=0.15[p2];[p1][p2]concat=n=2:v=0:a=1[a]" -map "[a]" in/cuerpo4.wav
python3 versiones.py plan.json
for g in A B C; do
  read H T FIN <<< $(python3 -c "import json;p=json.load(open('plan.json'))['$g'];print(p['H'],p['T'],p['ganchoFin'])")
  GF=in/gancho$g.mp3; [ $g = C ] && GF=in/ganchoC3.mp3
  python3 musica.py musica-$g.wav $T $H
  ffmpeg -v error -y -i $GF -i in/cuerpo4.wav -filter_complex "[0:a]atrim=0:$FIN,asetpts=PTS-STARTPTS,aresample=44100,atempo=1.07,apad=whole_dur=$H,atrim=0:$H[g];[1:a]aresample=44100,atempo=1.07[c];[g][c]concat=n=2:v=0:a=1,apad=whole_dur=$T,atrim=0:$T[a]" -map "[a]" voz-$g.wav
done
echo "Listo: voz y música de A, B y C"
