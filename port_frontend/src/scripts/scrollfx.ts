// Scroll-scrubbed choreography: every effect is a pure function of scroll
// position, so the page moves continuously while you scroll and plays in
// reverse when you scroll back up. Nothing is a one-shot reveal.
//
//   data-fx="title | wipe | rise | left | right | line | flick"   entrance, scrubbed
//   data-d="120"                                                  stagger (ms-ish → progress offset)
//   data-speed="0.12" [data-scale="1.18"]                         parallax layer
//
// Hidden start states only exist while <html> has .fx-on (set by this script),
// so content never disappears if JS fails; reduced-motion users get none of it.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (x: number) => 1 - Math.pow(1 - x, 3);

let started = false;
let request = () => {};

// element lists, collected once (and again whenever new content is tagged)
let fxEls: HTMLElement[] = [], layerEls: HTMLElement[] = [], driftEls: HTMLElement[] = [];
function collect() {
  fxEls = Array.from(document.querySelectorAll<HTMLElement>('[data-fx]'));
  layerEls = Array.from(document.querySelectorAll<HTMLElement>('[data-speed]'));
  driftEls = Array.from(document.querySelectorAll<HTMLElement>('.section-title, .case .slide img, .billboard, .case, .bigword'));
}

/** Tag elements that should animate (safe to call again after content renders). */
function tag(root: ParentNode) {
  const mark = (sel: string, fx: string, stagger = 0, base = 0) =>
    root.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
      if (!el.dataset.fx) el.dataset.fx = fx;
      if ((stagger || base) && !el.dataset.d) el.dataset.d = String(base + i * stagger);
    });

  mark('.section-title', 'title');
  mark('.sec-no', 'flick');
  mark('.kerb', 'line');
  mark('.case-media', 'wipe');
  root.querySelectorAll<HTMLElement>('.case-body').forEach((body) =>
    Array.from(body.children).forEach((c, i) => {
      const el = c as HTMLElement;
      if (!el.dataset.fx) { el.dataset.fx = 'rise'; el.dataset.d = String(150 + i * 70); }
    }));
  mark('.driver-photo', 'rise');
  mark('.driver-name', 'left');
  mark('.driver-role', 'left', 0, 120);
  root.querySelectorAll<HTMLElement>('.oc-strip figure').forEach((f, i) => { if (!f.dataset.fx) f.dataset.fx = i ? 'right' : 'left'; });
  mark('.contact', 'rise');
  mark('.pit', 'rise');
  root.querySelectorAll<HTMLElement>('[data-fx]').forEach((el) => el.classList.add('fx'));
}

/** Call once on load, and again with the container after dynamic content renders. */
export function scrollFx(root: ParentNode = document) {
  if (reduced) return;
  if (!started) { started = true; document.documentElement.classList.add('fx-on'); start(); }
  tag(root);
  collect();
  request();
}

// flicker on like an LED panel powering up, scrubbed by progress
const flick = (e: number) => (e < 0.15 ? 0 : e < 0.3 ? 1 : e < 0.45 ? 0.2 : e < 0.6 ? 1 : e < 0.75 ? 0.4 : 1);


// giant outlined words that slide sideways behind each section
const BIG_WORDS: Record<string, string> = {
  work: 'THE WORK', about: 'FIELD + CODE', 'garage-teaser': 'PIT LANE', contact: 'BOX, BOX',
};
function addBigWords() {
  for (const [id, word] of Object.entries(BIG_WORDS)) {
    const sec = document.getElementById(id);
    if (!sec || sec.querySelector('.bigword')) continue;
    const el = document.createElement('div');
    el.className = 'bigword';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = `${word} — `.repeat(4);
    sec.prepend(el);
  }
}

function start() {
  const heroCopy = document.querySelector<HTMLElement>('.hero-copy');
  const spot = document.querySelector<HTMLElement>('.spot');
  addBigWords();
  collect();
  let ticking = false;

  const frame = () => {
    ticking = false;
    const vh = window.innerHeight;

    const fx = fxEls, layers = layerEls, drift = driftEls; // cached — no DOM queries per frame

    // --- read phase (measure parents: they aren't transformed by us, so no feedback jitter)
    const fxRects = fx.map((el) => (el.parentElement ?? el).getBoundingClientRect());
    const layerRects = layers.map((el) => el.parentElement!.getBoundingClientRect());
    // cards + billboard measure themselves (we only move them sideways, so their own top is stable);
    // titles + photos measure their parent (we move them vertically / inside a frame)
    const self = (el: HTMLElement) => el.classList.contains('case') || el.classList.contains('billboard');
    const driftRects = drift.map((el) => (self(el) ? el : el.parentElement ?? el).getBoundingClientRect());

    // --- write phase
    const p = Math.min(1, window.scrollY / (vh * 0.9)); // hero exit
    if (heroCopy) { heroCopy.style.transform = `translate3d(${-p * 120}px, ${-p * 160}px, 0)`; heroCopy.style.opacity = String(1 - p * 1.1); }
    if (spot) { spot.style.transform = `translate3d(0, ${-p * 80}px, 0) scale(${1 - p * 0.15})`; spot.style.opacity = String(1 - p * 0.9); }


    fx.forEach((el, i) => {
      const r = fxRects[i];
      if (r.bottom < -vh || r.top > vh * 2) return;
      // entrance runs from when the block's top hits the bottom of the screen
      // until it's 30% from the top — the motion happens where you're looking
      const shift = (parseFloat(el.dataset.d ?? '0') / 1000) * 0.35;
      const e = ease(clamp((vh * 1.0 - r.top) / (vh * 0.7) - shift));
      const k = 1 - e;
      const s = el.style;
      switch (el.dataset.fx) {
        case 'title':
          s.clipPath = `inset(-20% -10% ${(k * 125 - 25).toFixed(1)}% -10%)`;
          s.transform = `translate3d(0, ${(k * 90).toFixed(1)}%, 0) skewY(${(k * 9).toFixed(2)}deg)`;
          break;
        case 'wipe': {
          const x = e * 125;
          s.clipPath = `polygon(0 0, ${x.toFixed(1)}% 0, ${(x - 25).toFixed(1)}% 100%, -25% 100%)`;
          break;
        }
        case 'rise': s.transform = `translate3d(0, ${(k * 140).toFixed(1)}px, 0)`; s.opacity = e.toFixed(3); break;
        case 'left': s.transform = `translate3d(${(-k * 220).toFixed(1)}px, 0, 0) skewX(${(-k * 14).toFixed(2)}deg)`; s.opacity = e.toFixed(3); break;
        case 'right': s.transform = `translate3d(${(k * 220).toFixed(1)}px, 0, 0) skewX(${(-k * 14).toFixed(2)}deg)`; s.opacity = e.toFixed(3); break;
        case 'line': s.transform = `scaleX(${e.toFixed(3)})`; break;
        case 'flick': s.opacity = String(flick(e)); break;
      }
    });

    // parallax layers
    layers.forEach((el, i) => {
      const r = layerRects[i];
      if (r.bottom < -200 || r.top > vh + 200) return;
      const off = r.top + r.height / 2 - vh / 2;
      const scale = el.dataset.scale ? ` scale(${el.dataset.scale})` : '';
      el.style.transform = `translate3d(0, ${(off * parseFloat(el.dataset.speed!) * 2).toFixed(1)}px, 0)${scale}`;
    });

    // continuous drift: nothing sits still while the page moves.
    // pos is -1 (block at top of screen) … 0 (centred) … 1 (block at bottom)
    drift.forEach((el, i) => {
      const r = driftRects[i];
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) return;
      const pos = clamp((r.top + r.height / 2 - vh / 2) / vh, -1.5, 1.5);
      const c = el.classList;
      if (c.contains('bigword')) {
        // huge outlined word streams sideways — direction alternates per section
        const dir = el.parentElement!.id === 'about' || el.parentElement!.id === 'contact' ? 1 : -1;
        el.style.transform = `translate3d(${(dir * pos * 55 - 20).toFixed(2)}vw, 0, 0)`;
      } else if (c.contains('section-title')) {
        el.style.translate = `${(pos * -180).toFixed(1)}px 0`;            // big type slides sideways
      } else if (c.contains('case')) {
        // one card at a time: it slides in from its side while arriving (lower part of
        // the screen), then locks in place — nothing slides back out
        const odd = Array.prototype.indexOf.call(el.parentElement!.children, el) % 2 === 0;
        const k = ease(clamp(1 - (pos - 0.02) / 0.6));      // 0 just below the screen … 1 settled
        el.style.transform = k < 1 ? `translate3d(${((1 - k) * (odd ? -22 : 22)).toFixed(2)}vw, 0, 0)` : '';
        el.style.opacity = (0.25 + 0.75 * k).toFixed(3);
      } else if (el.tagName === 'IMG') {
        // individual translate/scale props, so they stack with the photo's own push-in animation
        el.style.translate = `0 ${(pos * -80).toFixed(1)}px`; el.style.scale = '1.25'; // photo drifts inside its frame
      } else {
        const k = ease(clamp(1 - (pos - 0.02) / 0.6));      // slides in from the right, then holds
        el.style.transform = k < 1 ? `translate3d(${((1 - k) * 18).toFixed(2)}vw, 0, 0)` : '';
      }
    });

  };

  request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request, { passive: true });
  // the hero's own reveal transition would make the exit lag the scroll — drop it once revealed
  setTimeout(() => [heroCopy, spot].forEach((el) => el && (el.style.transition = 'none')), 1400);
  request();
}
