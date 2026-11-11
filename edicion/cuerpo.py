# Retoque de cuerpo cuadro por cuadro: abdomen más delgado y brazos más fuertes (deformación suave guiada por la pose).
import numpy as np, cv2, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
import os
MODELO = os.environ.get('POSE_MODEL', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelos', 'pose.task'))
_det = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=MODELO), running_mode=vision.RunningMode.IMAGE))
_prev = None
def pose(rgb, reset=False):
    global _prev
    r = _det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb)))
    if not r.pose_landmarks: return _prev
    h, w = rgb.shape[:2]
    p = np.array([[l.x * w, l.y * h, l.visibility] for l in r.pose_landmarks[0]])
    if _prev is not None and not reset: p[:, :2] = 0.6 * p[:, :2] + 0.4 * _prev[:, :2]   # sin temblor
    _prev = p
    return p
def retocar(rgb, p, panza=0.11, brazo=0.16):
    if p is None: return rgb
    h, w = rgb.shape[:2]
    X, Y = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    sx, sy = X.copy(), Y.copy()
    hom_i, hom_d, cad_i, cad_d, cod_i, cod_d = p[11], p[12], p[23], p[24], p[13], p[14]
    hombros = np.linalg.norm(hom_i[:2] - hom_d[:2])
    # abdomen: se jala hacia el centro del torso, más fuerte a la altura de la panza
    xc = (hom_i[0] + hom_d[0] + cad_i[0] + cad_d[0]) / 4
    y0, y1 = (hom_i[1] + hom_d[1]) / 2, (cad_i[1] + cad_d[1]) / 2
    if y1 - y0 > 40:
        yb = y0 + 0.72 * (y1 - y0)
        g = np.exp(-((Y - yb) / (0.33 * (y1 - y0))) ** 2)
        R = 0.62 * hombros
        dx = X - xc
        sx += panza * g * dx * np.exp(-(dx / R) ** 2) * 1.6
    # brazos: crecen alrededor del bíceps (entre hombro y codo)
    for a, b in ((hom_i, cod_i), (hom_d, cod_d)):
        if min(a[2], b[2]) < 0.4: continue
        c = a[:2] + 0.5 * (b[:2] - a[:2])
        L = np.linalg.norm(b[:2] - a[:2])
        if L < 20: continue
        R = 0.42 * L
        dX, dY = X - c[0], Y - c[1]
        r2 = (dX ** 2 + dY ** 2) / R ** 2
        k = np.where(r2 < 1, brazo * (1 - r2) ** 2, 0).astype(np.float32)
        sx -= k * dX; sy -= k * dY
    # las manos no se tocan: cerca de las muñecas y dedos la deformación vuelve a cero
    prot = np.ones_like(X)
    for i in (15, 16, 17, 18, 19, 20, 21, 22):
        if p[i][2] < 0.3: continue
        r = 0.5 * hombros
        d2 = ((X - p[i][0]) ** 2 + (Y - p[i][1]) ** 2) / r ** 2
        prot = np.minimum(prot, np.clip(d2 - 0.15, 0, 1) ** 1.5)
    sx = X + (sx - X) * prot; sy = Y + (sy - Y) * prot
    return cv2.remap(rgb, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
