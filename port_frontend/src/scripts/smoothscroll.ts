// Smooth inertia scrolling for mouse wheels: each wheel notch eases the page
// to its target instead of jumping ~100px, so every scroll-driven animation
// moves continuously. Touch, trackpad momentum, keyboard, scrollbar dragging
// and anchor links still work natively — we only take over wheel input, and
// re-sync whenever something else scrolls the page.

export function smoothScroll() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (reduced || !finePointer) return;

  const EASE = 0.1; // fraction of the remaining distance covered per frame (at 60fps)
  let target = window.scrollY;
  let current = window.scrollY;
  let lastSet = -1;
  let running = false;
  let lastT = 0;

  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

  const tick = (t: number) => {
    const dt = lastT ? Math.min(t - lastT, 64) : 16.7;
    lastT = t;
    // frame-rate independent easing
    current += (target - current) * (1 - Math.pow(1 - EASE, dt / 16.7));
    if (Math.abs(target - current) < 0.4) current = target;
    lastSet = Math.round(current);
    window.scrollTo({ top: current, behavior: 'instant' as ScrollBehavior });
    if (current !== target) requestAnimationFrame(tick);
    else { running = false; lastT = 0; }
  };

  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return; // pinch-zoom
    // inside a horizontally scrolling or otherwise scrollable child? let it scroll natively
    const el = e.target as HTMLElement;
    if (el.closest?.('textarea, .lightbox, [data-native-scroll]')) return;
    // trackpads send many tiny pixel deltas with their own momentum — leave those alone
    if (e.deltaMode === 0 && Math.abs(e.deltaY) < 40 && !running) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1;
    if (!running) { current = target = window.scrollY; }
    target = Math.max(0, Math.min(maxScroll(), target + e.deltaY * unit));
    if (!running) { running = true; requestAnimationFrame(tick); }
  }, { passive: false });

  // anything else that scrolls the page (keys, scrollbar, links, scrollIntoView) wins
  window.addEventListener('scroll', () => {
    if (Math.abs(window.scrollY - lastSet) > 2) { target = current = window.scrollY; }
  }, { passive: true });
}
