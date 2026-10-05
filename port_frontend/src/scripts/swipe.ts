// Swipe (touch) or drag (mouse) a slideshow sideways: left = next photo,
// right = previous. The current photo follows the pointer a little while
// dragging. Vertical swipes still scroll the page.

export function swipeable(el: HTMLElement, onSwipe: (dir: 1 | -1) => void, threshold = 50) {
  el.style.touchAction = 'pan-y';
  let press = false, drag = false, moved = false, sx = 0, sy = 0;

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    press = true; drag = false; sx = e.clientX; sy = e.clientY;
  });
  el.addEventListener('pointermove', (e) => {
    if (!press) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!drag) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { press = false; return; } // a scroll
      if (Math.abs(dx) < 8) return;
      drag = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      el.classList.add('dragging');
    }
    el.style.setProperty('--drag', `${dx * 0.25}px`);
  });
  const up = (e: PointerEvent) => {
    press = false;
    if (!drag) return;
    drag = false; moved = true;
    el.classList.remove('dragging');
    el.style.removeProperty('--drag');
    const dx = e.clientX - sx;
    if (e.type === 'pointerup' && Math.abs(dx) > threshold) onSwipe(dx < 0 ? 1 : -1);
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('dragstart', (e) => e.preventDefault()); // no ghost-image drag of the photo
  // a drag shouldn't also open the photo viewer
  el.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}
