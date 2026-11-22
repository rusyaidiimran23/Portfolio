// Night-race light trails behind the page: neon streaks that react to scroll speed. A gentle
// scroll gives a faint shimmer; flinging the page gives a warp-speed rush. A few streaks drift
// when idle. One fixed 2D canvas behind the content, additive blending, no work when hidden.
type Streak = { x: number; y: number; len: number; v: number; w: number; c: string; a: number };

const COLORS = ['#ff2bd6', '#ffb000', '#00d2be', '#e10600', '#b14cff', '#5ff7ff'];

export function speedTrails() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '1', pointerEvents: 'none' });
  document.body.prepend(cv);
  const g = cv.getContext('2d')!;
  let W = 0, H = 0;
  const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  resize();
  addEventListener('resize', resize);

  const N = innerWidth < 700 ? 26 : 46;
  const spawn = (s?: Streak): Streak => Object.assign(s ?? ({} as Streak), {
    x: W + Math.random() * W, y: Math.random() * H, len: 40 + Math.random() * 120, v: 0.4 + Math.random() * 0.8,
    w: Math.random() < 0.15 ? 2 : 1, c: COLORS[(Math.random() * COLORS.length) | 0], a: 0.25 + Math.random() * 0.5,
  });
  const streaks = Array.from({ length: N }, () => { const s = spawn(); s.x = Math.random() * W; return s; });

  // scroll speed, smoothed: 0 = still, 1 = flinging
  let lastY = scrollY, lastT = performance.now(), speed = 0, dyAcc = 0;
  addEventListener('scroll', () => {
    const now = performance.now(), dy = scrollY - lastY, dt = Math.max(8, now - lastT);
    speed = Math.max(speed, Math.min(1, Math.abs(dy / dt) / 4));
    dyAcc += dy; lastY = scrollY; lastT = now;
  }, { passive: true });

  let prev = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (document.hidden) { prev = now; return; }
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    speed *= Math.pow(0.04, dt);              // eases off in about a second
    const k = speed, drift = dyAcc * 0.35; dyAcc = 0;
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const s of streaks) {
      s.x -= (40 + s.v * 60 + k * 2600 * s.v) * dt;   // idle drift → warp
      s.y -= drift * s.v;                               // streaks slide with the scroll direction
      if (s.y < -20) s.y += H + 40; else if (s.y > H + 20) s.y -= H + 40;
      if (s.x + s.len * (1 + k * 6) < 0) spawn(s);
      const len = s.len * (1 + k * 6);
      const alpha = s.a * (0.12 + k * 0.88);
      if (alpha < 0.01 || s.x > W) continue;
      const grd = g.createLinearGradient(s.x, 0, s.x + len, 0);
      grd.addColorStop(0, s.c);
      grd.addColorStop(1, 'transparent');
      g.globalAlpha = alpha;
      g.strokeStyle = grd;
      g.lineWidth = s.w + k * 1.5;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x + len, s.y); g.stroke();
    }
    g.globalAlpha = 1;
  };
  requestAnimationFrame(frame);
}
