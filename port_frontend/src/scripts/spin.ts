// Drag-to-spin turntable (Track Day carousel). Drag sideways with a mouse or
// finger to turn it, flick for momentum. With `step`, it settles on the nearest
// slot and reports it. Vertical swipes still scroll the page (touch-action: pan-y).

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type Spin = {
  readonly angle: number;
  /** turn to an absolute angle over `ms` */
  to(deg: number, ms?: number): void;
};

export function spinner(host: HTMLElement, o: {
  grab: string;                                   // selector inside host that can be dragged
  apply: (angle: number, speed: number) => void;  // speed: degrees per frame (abs)
  step?: () => number;                            // snap to multiples of this (deg)
  onSettle?: (angle: number) => void;             // came to rest on a slot
  idle?: number;                                  // deg/s drift when left alone (no step)
  sens?: number;                                  // degrees per px dragged
}): Spin {
  const sens = o.sens ?? 0.45;
  const stepOf = () => o.step?.() ?? 0;
  const idle = reduced || o.step ? 0 : o.idle ?? 0;
  let a = 0, v = 0;                               // angle (deg), velocity (deg/frame @60fps)
  let tw: { from: number; to: number; t0: number; ms: number } | null = null;
  let raf = 0, last = 0, onScreen = false, settled = true;
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
      const step = stepOf();
      if (Math.abs(v) > (step ? 1.2 : 0.03)) { a += v * dt; speed = Math.abs(v); v *= Math.pow(0.94, dt); }
      else if (step) {
        v = 0;
        const target = Math.round(a / step) * step;
        if (Math.abs(target - a) > 0.05) tw = { from: a, to: target, t0: t, ms: 450 };
        else if (!settled) { a = target; settled = true; o.onSettle?.(a); }
      } else { v = 0; a += (idle * dt) / 60; speed = idle / 60; }
    }
    o.apply(a, speed);
    const busy = drag || tw || v || idle || !settled;
    raf = busy && onScreen ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  };
  const kick = () => { if (!raf && onScreen) raf = requestAnimationFrame(frame); };

  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) { o.apply(a, 0); kick(); } }).observe(host);

  host.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !(e.target as HTMLElement).closest(o.grab)) return;
    press = true; drag = false; moved = false; sx = px = e.clientX; sy = e.clientY;
  });
  host.addEventListener('pointermove', (e) => {
    if (!press) return;
    if (!drag) {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { press = false; return; } // it's a scroll
      if (Math.abs(dx) < 6) return;
      drag = true; tw = null; v = 0; settled = false;
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
    v = Math.max(-20, Math.min(20, v));
    kick();
  };
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  // a drag shouldn't also count as a click on whatever is under the pointer
  host.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

  return {
    get angle() { return a; },
    to(deg, ms = 900) {
      v = 0; settled = true; // a programmatic turn doesn't report back
      if (reduced || !onScreen || ms <= 0) { tw = null; a = deg; o.apply(a, 0); return; }
      tw = { from: a, to: deg, t0: performance.now(), ms };
      kick();
    },
  };
}
