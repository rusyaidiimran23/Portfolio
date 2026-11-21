// Forza-style screens: GARAGE <-> TRACK DAY <-> STATS (tabs, edge arrows, Q/E keys, swipes).
import { reduced } from './shared';

export type Pane = 'garage' | 'track' | 'stats';
const PANES: Pane[] = ['garage', 'track', 'stats'];
const LABEL: Record<Pane, string> = { garage: 'Garage', track: 'Track Day', stats: 'Stats' };

export const paneFromHash = (): Pane => (PANES.find((p) => p !== 'garage' && location.hash === `#${p}`) ?? 'garage');

/**
 * Wire up the screen switcher once. `onShow` runs whenever a screen comes in
 * (e.g. replay the Track Day map, refresh Stats). Returns setPane for the page.
 */
export function initPanes(content: HTMLElement, onShow: Partial<Record<Pane, () => void>>) {
  const fzm = document.getElementById('fzm')!;
  const ink = fzm.querySelector<HTMLElement>('.fzm-ink')!;
  const slash = document.getElementById('slash')!;
  let pane: Pane = 'garage';
  let switching = false;
  const step = (d: 1 | -1): Pane | undefined => PANES[PANES.indexOf(pane) + d];
  const paneEl = (p: Pane) => document.querySelector<HTMLElement>(`.pane[data-pane="${p}"]`)!;

  function moveInk() {
    const tab = fzm.querySelector<HTMLElement>(`.fzm-tab[data-pane-go="${pane}"]`);
    if (!tab || !tab.offsetWidth) return;
    ink.style.left = `${tab.offsetLeft}px`;
    ink.style.width = `${tab.offsetWidth}px`;
  }

  function chrome() { // tabs, underline and edge arrows follow the current screen
    fzm.querySelectorAll<HTMLElement>('.fzm-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.paneGo === pane)));
    ([['.edge-next', step(1)], ['.edge-prev', step(-1)]] as const).forEach(([sel, to]) => {
      const b = document.querySelector<HTMLElement>(sel)!;
      b.hidden = !to;
      if (!to) return;
      b.dataset.paneGo = to;
      b.querySelector('span')!.textContent = LABEL[to];
      b.setAttribute('aria-label', `Go to ${LABEL[to]}`);
    });
    moveInk();
  }

  function swap(to: Pane) {
    PANES.forEach((p) => { paneEl(p).hidden = p !== to; paneEl(p).classList.toggle('on', p === to); });
    pane = to;
    onShow[to]?.();
    // keep the tab bar in view (the jump happens under the slash)
    const top = fzm.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
    window.dispatchEvent(new Event('scroll')); // let the scroll animations notice the new screen
  }

  function setPane(to: Pane, animate = true, push = false) {
    if (switching || (to === pane && !paneEl(to).hidden && paneEl(to).classList.contains('on'))) { chrome(); return; }
    if (push) history.pushState(null, '', to === 'garage' ? location.pathname + location.search : `#${to}`);
    const from = pane;
    if (!animate || reduced || from === to) { swap(to); chrome(); return; }
    switching = true;
    const dir = PANES.indexOf(to) > PANES.indexOf(from) ? 'fwd' : 'back';
    const out = paneEl(from), inn = paneEl(to);
    document.getElementById('slash-label')!.textContent = LABEL[to];
    slash.classList.remove('fwd', 'back'); void slash.offsetWidth; slash.classList.add(dir);
    out.classList.add(`out-${dir}`);
    pane = to; chrome(); // underline starts gliding with the slash
    setTimeout(() => {
      out.classList.remove(`out-${dir}`);
      swap(to);
      inn.classList.add(`in-${dir}`);
    }, 330);
    setTimeout(() => {
      inn.classList.remove(`in-${dir}`);
      slash.classList.remove(dir);
      switching = false;
    }, 860);
  }

  const go = (to: Pane) => setPane(to, true, true);
  content.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pane-go]');
    if (b) go(b.dataset.paneGo as Pane);
  });
  // Q / E like a controller's bumpers (arrow keys too) — not while typing
  window.addEventListener('keydown', (e) => {
    if (content.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
    const k = e.key.toLowerCase();
    const to = k === 'q' || k === 'arrowleft' ? step(-1) : k === 'e' || k === 'arrowright' ? step(1) : undefined;
    if (to) go(to);
  });
  // swipe left / right on phones
  let sx = 0, sy = 0, sOk = false;
  const panes = document.getElementById('panes')!;
  panes.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
    // things that scroll sideways themselves keep their swipe
    sOk = e.touches.length === 1 && !(e.target as HTMLElement).closest('.td-tabs, .fz-grid, .slides, .show, .b-media, input, textarea, .td-mapwrap');
  }, { passive: true });
  panes.addEventListener('touchend', (e) => {
    if (!sOk) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    const to = Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 ? step(dx < 0 ? 1 : -1) : undefined;
    if (to) go(to);
  }, { passive: true });
  window.addEventListener('popstate', () => { if (!content.hidden) setPane(paneFromHash()); });
  window.addEventListener('resize', moveInk);
  document.fonts?.ready.then(moveInk);
  return setPane;
}
