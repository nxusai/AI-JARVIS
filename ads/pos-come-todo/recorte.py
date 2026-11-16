# Quita el fondo gris liso de las poses: lo que se parece al gris del borde y toca el borde es fondo.
import numpy as np, sys
from PIL import Image, ImageFilter
from scipy import ndimage as ni
for n in ['brazos-arriba','caminando','acostado','cara-boca-cerrada','cara-boca-abierta']:
    im = Image.open(f'/home/user/AI-JARVIS/ads/personaje/{n}.webp').convert('RGB'); a = np.asarray(im).astype(int)
    bg = np.median(np.concatenate([a[:8].reshape(-1,3), a[:, :8].reshape(-1,3), a[:, -8:].reshape(-1,3)]), 0)
    d = np.abs(a - bg).max(2); sat = a.max(2) - a.min(2)
    cand = (d < 30) & (sat < 22)
    lab, _ = ni.label(cand); borde = np.unique(np.concatenate([lab[0], lab[-1], lab[:,0], lab[:,-1]]))
    fondo = np.isin(lab, borde[borde > 0])
    if n.startswith('cara'): fondo[-4:, :] = fondo[-5, :]  # el busto llega al borde de abajo
    m = ~fondo; lab2, k = ni.label(m); 
    if k > 1: s = ni.sum(m, lab2, range(1, k+1)); m = lab2 == (1 + int(np.argmax(s)))
    m = ni.binary_fill_holes(m)
    alfa = Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2))
    alfa = alfa.point(lambda v: max(0, min(255, int((v - 110) * 255 / 100))))
    out = im.convert('RGBA'); out.putalpha(alfa); bb = out.getbbox(); out = out.crop(bb); out.save(f'pj_{n}.png'); print(n, out.size, bb)
