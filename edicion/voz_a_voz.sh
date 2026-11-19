# voz_a_voz.sh entrada.wav salida.mp3  -> voz de Eduardo (clon "Dueño (voz propia)")
code=$(curl -sS -X POST "https://api.elevenlabs.io/v1/speech-to-speech/pZyxpOKXKkSeNV6q2OnW?output_format=mp3_44100_128" -H 'accept: audio/mpeg' -F "audio=@$1" -F "model_id=eleven_multilingual_sts_v2" -F 'voice_settings={"stability":0.5,"similarity_boost":0.9,"style":0.15,"use_speaker_boost":true}' -F "remove_background_noise=true" -o "$2" -w '%{http_code}')
echo "$1 -> $code"
