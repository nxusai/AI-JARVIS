// La mente de NXUS: miles de puntos en una esfera que gira y, con el scroll,
// se reacomodan hasta formar el logo NX. Canvas 2D, sin librerías.

const LOGO = [
  'M177 326H305L645 717L558 816L294 497V916H177Z',
  'M495 393H663L801 560L943 393H1090L866 656L1080 916H928L790 747L642 916H484L714 656Z',
];
const LOGO_BOX = { x: 170, y: 320, w: 925, h: 600 };
const STOPS = [[0, 229, 255], [10, 108, 255], [165, 28, 255]];
const BUCKETS = 28;

function colorAt(u) {
  u = Math.min(1, Math.max(0, u));
  const [a, b, k] = u < .52 ? [STOPS[0], STOPS[1], u / .52] : [STOPS[1], STOPS[2], (u - .52) / .48];
  return a.map((v, i) => Math.round(v + (b[i] - v) * k));
}
const PALETTE = Array.from({ length: BUCKETS }, (_, i) => `rgb(${colorAt(i / (BUCKETS - 1)).join(',')})`);

// Puntos dentro del logo, en coordenadas de -1 a 1 (ancho) conservando la proporción.
function sampleLogo(n) {
  const W = 462, H = 300;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.scale(W / LOGO_BOX.w, H / LOGO_BOX.h);
  g.translate(-LOGO_BOX.x, -LOGO_BOX.y);
  LOGO.forEach((d) => g.fill(new Path2D(d)));
  const data = g.getImageData(0, 0, W, H).data;
  const inside = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) inside.push([x, y]);
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const [x, y] = inside[(Math.random() * inside.length) | 0];
    out[i * 2] = (x + Math.random() * 2) / W * 2 - 1;
    out[i * 2 + 1] = ((y + Math.random() * 2) / H * 2 - 1) * (H / W);
  }
  return out;
}

export function createOrb(canvas, { count } = {}) {
  const ctx = canvas.getContext('2d');
  const small = innerWidth < 760;
  const N = count || (small ? 1600 : 3600);
  const sphere = new Float32Array(N * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const jitter = 1 + (Math.random() - .5) * .06;
    sphere[i * 3] = Math.cos(th) * r * jitter;
    sphere[i * 3 + 1] = y * jitter;
    sphere[i * 3 + 2] = Math.sin(th) * r * jitter;
  }
  const logo = sampleLogo(N);
  const seed = new Float32Array(N).map(() => Math.random() * Math.PI * 2);
  const size = new Float32Array(N).map(() => .6 + Math.random() * 1.1);
  const buckets = Array.from({ length: BUCKETS }, () => []);

  let w = 0, h = 0, dpr = 1, t = 0, tSmooth = 0, rot = 0, mx = 0, my = 0, tx = 0, ty = 0, running = true, raf = 0;

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
  }
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });

  const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const time = now / 1000;
    tSmooth += (t - tSmooth) * .08;
    const k = ease(Math.min(1, Math.max(0, tSmooth)));
    rot += .0022 * (1 - k);
    tx += (mx - tx) * .05; ty += (my - ty) * .05;

    const R = Math.min(w, h) * (small ? .36 : .34);
    const L = Math.min(w * (small ? .4 : .26), h * .46);
    const cx = w / 2, cy = h / 2 - k * h * .07;
    const ay = rot * 6.283 + tx * .9 * (1 - k), ax = .35 + ty * .6 * (1 - k);
    const cosY = Math.cos(ay), sinY = Math.sin(ay), cosX = Math.cos(ax), sinX = Math.sin(ax);
    const breathe = 1 + Math.sin(time * 1.3) * .015;

    for (const b of buckets) b.length = 0;
    for (let i = 0; i < N; i++) {
      let x = sphere[i * 3], y = sphere[i * 3 + 1], z = sphere[i * 3 + 2];
      // giro
      let x1 = x * cosY - z * sinY, z1 = x * sinY + z * cosY;
      let y1 = y * cosX - z1 * sinX, z2 = y * sinX + z1 * cosX;
      const wob = 1 + Math.sin(time * 1.6 + seed[i]) * .012;
      const sx = x1 * R * breathe * wob, sy = y1 * R * breathe * wob, sz = z2 * R;
      // destino: el logo, plano, con un leve temblor vivo
      const lx = logo[i * 2] * L + Math.sin(time * 2 + seed[i]) * 1.2;
      const ly = logo[i * 2 + 1] * L + Math.cos(time * 2 + seed[i]) * 1.2;
      // trayectoria curva: los puntos se abren un poco antes de llegar
      const swirl = Math.sin(k * Math.PI) * R * .35;
      const px = sx + (lx - sx) * k + Math.cos(seed[i]) * swirl;
      const py = sy + (ly - sy) * k + Math.sin(seed[i]) * swirl;
      const pz = sz * (1 - k);
      const persp = 600 / (600 + pz);
      const X = cx + px * persp, Y = cy + py * persp;
      const depth = (1 - z2) / 2; // 1 = al frente
      const alpha = (.18 + depth * .82) * (1 - k) + .95 * k;
      const u = ((x1 + 1) / 2) * (1 - k) + ((logo[i * 2] + 1) / 2) * k;
      const s = size[i] * persp * (1 + k * .35) * (small ? .9 : 1.05);
      buckets[Math.min(BUCKETS - 1, Math.max(0, Math.round(u * (BUCKETS - 1))))].push(X, Y, s, alpha);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // halo central
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
    halo.addColorStop(0, `rgba(10,108,255,${.22 - k * .08})`);
    halo.addColorStop(.5, 'rgba(165,28,255,.06)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // anillos orbitales que se desvanecen al formarse el logo
    if (k < .98) {
      ctx.lineWidth = 1;
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${r === 1 ? '165,28,255' : '0,229,255'},${(.16 - r * .03) * (1 - k)})`;
        ctx.ellipse(cx, cy, R * (1.25 + r * .18), R * (.28 + r * .06), (time * .08 + r * .9) % 6.283 * (r % 2 ? -1 : 1), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < BUCKETS; b++) {
      const arr = buckets[b];
      if (!arr.length) continue;
      ctx.fillStyle = PALETTE[b];
      for (let j = 0; j < arr.length; j += 4) {
        ctx.globalAlpha = arr[j + 3];
        const s = arr[j + 2];
        ctx.fillRect(arr[j] - s / 2, arr[j + 1] - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  raf = requestAnimationFrame(frame);

  // Pausa cuando no se ve, para no gastar batería.
  new IntersectionObserver(([e]) => { running = e.isIntersecting; }).observe(canvas);

  return {
    setProgress(v) { t = v; },
    destroy() { cancelAnimationFrame(raf); },
  };
}
