// Brasas que suben desde abajo en el hero. Se pausa fuera de pantalla.
export function embers(canvas, { density = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  let w, h, dpr, parts = [], raf, running = false, intensity = density;
  const colors = ['244,181,33', '228,80,30', '255,213,106', '255,140,40'];

  const spawn = (initial) => ({
    x: Math.random() * w,
    y: initial ? Math.random() * h : h + 10,
    r: Math.random() * 2.2 + 0.6,
    vy: -(Math.random() * 0.8 + 0.35),
    vx: (Math.random() - 0.5) * 0.4,
    life: 0,
    max: Math.random() * 400 + 260,
    c: colors[(Math.random() * colors.length) | 0],
    wob: Math.random() * Math.PI * 2,
  });

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(110, (w * h) / 14000) * intensity);
    parts = Array.from({ length: n }, () => spawn(true));
  };

  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      p.life++;
      p.wob += 0.03;
      p.x += p.vx + Math.sin(p.wob) * 0.3;
      p.y += p.vy;
      const t = p.life / p.max;
      const a = t < 0.1 ? t * 10 : 1 - t;
      if (p.life > p.max || p.y < -10) Object.assign(p, spawn(false));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      g.addColorStop(0, `rgba(${p.c},${0.9 * a})`);
      g.addColorStop(1, `rgba(${p.c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  };

  const start = () => { if (!running) { running = true; tick(); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  resize();
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(canvas);
  return { setIntensity: (v) => { intensity = v; resize(); } };
}
