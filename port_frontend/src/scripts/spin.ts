// Drag-to-spin turntable (Track Day hologram disk). Drag sideways with a mouse
// or finger to turn it, flick for momentum; left alone it drifts slowly.
// Vertical swipes still scroll the page (touch-action: pan-y on the grab area).

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type Spin = {
  readonly angle: number;
  /** turn by `deg` over `ms` (stacks on a turn already in progress) */
  by(deg: number, ms?: number): void;
};

export function spinner(host: HTMLElement, o: {
  grab: string;                              // selector inside host that can be dragged
  apply: (angle: number, speed: number) => void; // speed: degrees per frame (abs)
  idle?: number;                             // deg/s drift when left alone
  sens?: number;                             // degrees per px dragged
}): Spin {
  const sens = o.sens ?? 0.45;
  const idle = reduced ? 0 : o.idle ?? 0;
  let a = 0, v = 0;                          // angle (deg), velocity (deg/frame @60fps)
  let tw: { from: number; to: number; t0: number; ms: number } | null = null;
  let raf = 0, last = 0, onScreen = false;
  let press = false, drag = false, sx = 0, sy = 0, px = 0, moved = false;

  const frame = (t: number) => {
    const dt = last ? Math.min(t - last, 50) / 16.7 : 1;
    last = t;
    let speed = 0;
    if (tw) {
      const k = Math.min(1, (t - tw.t0) / tw.ms);
      const na = tw.from + (tw.to - tw.from) * ease(k);
      speed = Math.abs(na - a); a = na;
      if (k >= 1) tw = null;
    } else if (!drag) {
      if (Math.abs(v) > 0.03) { a += v * dt; speed = Math.abs(v); v *= Math.pow(0.95, dt); }
      else { v = 0; a += (idle * dt) / 60; speed = idle / 60; }
    }
    o.apply(a, speed);
    const busy = drag || tw || v || idle;
    raf = busy && onScreen ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  };
  const kick = () => { if (!raf && onScreen) raf = requestAnimationFrame(frame); };

  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) kick(); }).observe(host);

  host.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !(e.target as HTMLElement).closest(o.grab)) return;
    press = true; drag = false; sx = px = e.clientX; sy = e.clientY;
  });
  host.addEventListener('pointermove', (e) => {
    if (!press) return;
    if (!drag) {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { press = false; return; } // it's a scroll
      if (Math.abs(dx) < 6) return;
      drag = true; tw = null; v = 0;
      try { host.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      host.classList.add('spinning');
    }
    const d = (e.clientX - px) * sens;
    px = e.clientX;
    a += d; v = v * 0.4 + d * 0.6;
    kick();
  });
  const up = () => {
    press = false;
    if (!drag) return;
    drag = false; moved = true;
    host.classList.remove('spinning');
    v = Math.max(-30, Math.min(30, v));
    kick();
  };
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  // a drag shouldn't also count as a click on whatever is under the pointer
  host.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

  return {
    get angle() { return a; },
    by(deg, ms = 1000) {
      const from = a;
      const to = (tw ? tw.to : a) + deg;
      v = 0;
      if (reduced) { a = to; o.apply(a, 0); return; }
      tw = { from, to, t0: performance.now(), ms };
      kick();
    },
  };
}
