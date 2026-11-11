# Plan de la edición: segmentos, palabras en el tiempo final, acercamientos y texto detrás.
import json
SEG = [(5.20, 9.52), (10.18, 14.95), (15.36, 20.48), (21.00, 22.15)]
off, MAP = 0.0, []
for a, b in SEG: MAP.append((a, b, off)); off += b - a
DUR = round(off, 3); T = round(DUR, 3)
def out(t):
    for a, b, o in MAP:
        if a - .4 <= t <= b + .05: return round(o + min(b - a, max(0, t - a)), 3)
W = json.load(open('palabras.json'))
pal = []
for w in W:
    a, b = out(w['a']), out(min(w['b'], w['a'] + .7))
    if a is None or b is None: continue
    pal.append({'w': w['w'], 'a': a, 'b': max(b, a + .12)})
# Acercamientos (t, z, curva): 'salto' = corte seco, 'suave' = transición con easing desde el punto anterior.
ZOOM = [
  [0.00, 1.25, 'salto'], [4.32, 1.38, 'lineal'],
  [4.32, 1.55, 'salto'], [9.09, 1.62, 'lineal'],
  [9.09, 1.18, 'salto'], [10.00, 1.18, 'lineal'], [10.70, 1.97, 'suave'],   # agarra y jala hacia él: se acerca
  [13.20, 2.0, 'lineal'], [13.55, 1.0, 'suave'],                             # empuja con la palma: se aleja
  [14.21, 1.0, 'lineal'], [14.21, 1.0, 'salto'], [15.36, 1.10, 'lineal'], [T, 1.10, 'lineal'],
]
ATRAS = [
  {'txt': 'EDICIONES', 'a': 2.25, 'b': 3.62},
  {'txt': 'EFECTOS', 'sub': 'ESPECIALES', 'a': 7.15, 'b': 9.05},
  {'txt': 'ACERCA', 'a': 11.95, 'b': 13.15},
  {'txt': 'ALEJA', 'a': 13.30, 'b': 14.19},
  {'txt': 'VAMOS A VER', 'a': 14.40, 'b': 15.36},
]
json.dump({'T': T, 'DUR': DUR, 'pal': pal, 'zoom': ZOOM, 'atras': ATRAS, 'cabeza': [0.52, 0.432], 'cara': [0.52, 0.47], 'cortes': [m[2] for m in MAP[1:]]},
          open('plan.json', 'w'), ensure_ascii=False, indent=1)
print('T', T, 'DUR', DUR); print(' '.join(f"{p['w']}@{p['a']}" for p in pal))
