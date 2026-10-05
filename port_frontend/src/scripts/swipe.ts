// Swipe (touch) or drag (mouse) a slideshow sideways: left = next photo,
// right = previous. The wipe fires the moment the swipe is long enough —
// no waiting for the finger to lift. Vertical swipes still scroll the page.

export function swipeable(el: HTMLElement, onSwipe: (dir: 1 | -1) => void, threshold = 40) {
  el.style.touchAction = 'pan-y';
  let press = false, drag = false, fired = false, moved = false, sx = 0, sy = 0;

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    press = true; drag = false; fired = false; moved = false; sx = e.clientX; sy = e.clientY;
  });
  el.addEventListener('pointermove', (e) => {
    if (!press || fired) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!drag) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { press = false; return; } // a scroll
      if (Math.abs(dx) < 8) return;
      drag = true; moved = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    }
    if (Math.abs(dx) >= threshold) { fired = true; onSwipe(dx < 0 ? 1 : -1); }
  });
  const up = () => { press = false; drag = false; };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('dragstart', (e) => e.preventDefault()); // no ghost-image drag of the photo
  // a swipe shouldn't also open the photo viewer
  el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}
