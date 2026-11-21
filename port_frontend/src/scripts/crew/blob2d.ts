// A simple 2D blob drawn in SVG: a wobbly jelly outline, eyes that follow the cursor, a tiny
// mouth, and mix-and-match pit-crew gear (visor, headset, helmet, props...). No libraries.

export type Mood = 'idle' | 'hop' | 'happy' | 'talk' | 'think' | 'wow';
export type Look = {
  color: string;
  shape: Shape;
  eyes: 'dots' | 'big' | 'pills' | 'led';
  visor: 'none' | 'dark' | 'sunset' | 'smoke';
  head: 'none' | 'cap' | 'helmet' | 'fullface' | 'headband' | 'goggles';
  ears: 'none' | 'headset' | 'earmuffs' | 'antenna' | 'headset+antenna';
  prop: 'none' | 'flag' | 'wrench' | 'pitboard';
  mouth: 'smile' | 'cat' | 'grin' | 'none';
  outfit: 'none' | 'jacket' | 'suit' | 'vest' | 'bomber';
  outfitColor: string;
  helmetColor: string;
};
// Body shapes. Each maps an angle round the body (a, from the top, clockwise; s>0 is the
// bottom half) and a wobbling radius r (~80) to a point. Most get a flat base afterwards.
type ShapeFn = (a: number, r: number, t: number) => [number, number];
const g = (x: number, w: number) => Math.exp(-((x / w) ** 2)); // bump
const polar = (f: (p: number) => number, sx = 1.06, sy = 0.95, dy = 0): ShapeFn => (a, r) => {
  const p = a + Math.PI / 2; // 0 at the top
  const k = f(p);
  return [Math.cos(a) * r * k * sx, Math.sin(a) * r * k * sy + dy];
};
const angDist = (p: number, q: number) => Math.atan2(Math.sin(p - q), Math.cos(p - q));
export const SHAPES: Record<string, ShapeFn> = {
  round: polar(() => 1),
  tall: polar(() => 1, 0.9, 1.08, -8),
  gumdrop: (a, r) => { const c = Math.cos(a), s = Math.sin(a); return [c * r * 1.06 * (1 + Math.max(0, s) * 0.16 - Math.max(0, -s) * 0.12), s * r * 0.95]; },
  squircle: (a, r) => { const c = Math.cos(a), s = Math.sin(a), p = 2 / 4.2; return [Math.sign(c) * Math.abs(c) ** p * r, Math.sign(s) * Math.abs(s) ** p * r * 0.92]; },
  egg: (a, r) => { const c = Math.cos(a), s = Math.sin(a); return [c * r * 0.9 * (1 - Math.max(0, -s) * 0.16), s * r * 1.06 - 6]; },
  pear: (a, r) => { const c = Math.cos(a), s = Math.sin(a); return [c * r * (1 + Math.max(0, s) * 0.3 - Math.max(0, -s) * 0.32), s * r * 1.06 - 6]; },
  pancake: polar(() => 1, 1.38, 0.66, 14),
  onigiri: polar((p) => 1 + 0.13 * Math.cos(3 * p), 1.08, 1.0, 2),
  star: polar((p) => 1 + 0.2 * Math.cos(5 * p), 1.04, 1.0, 2),
  flower: polar((p) => 1 + 0.09 * Math.cos(8 * p)),
  urchin: polar((p) => 1 + 0.1 * Math.cos(14 * p)),
  cloud: polar((p) => 1 + 0.1 * Math.abs(Math.cos(3.5 * p)), 1.12, 0.9, 4),
  cat: polar((p) => 1 + 0.36 * (g(angDist(p, -0.62), 0.15) + g(angDist(p, 0.62), 0.15))),
  bunny: polar((p) => 1 + 0.75 * (g(angDist(p, -0.3), 0.09) + g(angDist(p, 0.3), 0.09)), 1.04, 0.95, 8),
  bear: polar((p) => 1 + 0.2 * (g(angDist(p, -0.75), 0.2) + g(angDist(p, 0.75), 0.2))),
  teardrop: polar((p) => 1 + 0.5 * Math.max(0, Math.cos(p)) ** 8, 1.02, 0.98, 4),
  onion: polar((p) => 1 + 0.32 * Math.max(0, Math.cos(p)) ** 14 + 0.06 * Math.max(0, Math.cos(p)) ** 2, 1.1, 0.95, 4),
  crown: polar((p) => 1 + 0.42 * Math.max(0, Math.cos(p)) ** 0.8 * Math.max(0, Math.cos(6 * p)) ** 6, 1.06, 0.95, 10), // three points on top
  dumpling: polar((p) => 1 + Math.max(0, Math.cos(p)) ** 2 * 0.05 * Math.cos(11 * p) + 0.18 * Math.max(0, Math.cos(p)) ** 10, 1.15, 0.88, 8),
  peanut: (a, r) => { const c = Math.cos(a), s = Math.sin(a); return [c * r * (0.78 + 0.32 * Math.abs(s)), s * r * 1.08 - 8]; },
  hexagon: polar((p) => { const n = 6, q = ((p % (2 * Math.PI / n)) + 2 * Math.PI / n) % (2 * Math.PI / n) - Math.PI / n; return 0.35 + 0.65 * Math.cos(Math.PI / n) / Math.cos(q); }),
  pebble: polar((p) => 1 + 0.08 * Math.sin(p + 1) + 0.06 * Math.sin(2 * p + 2) + 0.04 * Math.sin(3 * p + 0.5)),
  slime: (a, r, t) => { const c = Math.cos(a), s = Math.sin(a); return [c * r * (1 + Math.max(0, s) ** 2 * 0.55) * 1.02, s * r * 0.9 + 4 + Math.max(0, s) ** 4 * Math.sin(c * 9 + t * 3) * 4]; },
  heart: (a, r) => {
    const th = a + Math.PI / 2, k = (r / 80) * 5.4, sn = Math.sin(th);
    return [16 * sn ** 3 * k, -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)) * k - 28];
  },
  ghost: (a, r, t) => {
    const c = Math.cos(a), s = Math.sin(a);
    if (s < 0.2) return [c * r * 0.98, s * r];
    return [c * r * 0.98, 80 + 8 * Math.sin(c * 10 + t * 5)]; // long straight sides down to a wavy hem
  },
};
export type Shape = keyof typeof SHAPES & string;
const FLOATING = new Set(['heart', 'ghost']); // keep their own bottoms

export const DEFAULT_LOOK: Look = { color: '#ff2bd6', shape: 'round', eyes: 'dots', visor: 'none', head: 'none', ears: 'none', prop: 'none', mouth: 'smile', outfit: 'none', outfitColor: '#e10600', helmetColor: '#f3f3f5' };

const VISORS = {
  dark: { fill: '#14141b', glow: '#5ff7ff' },
  smoke: { fill: '#2a2d36', glow: '#b6ff2e' },
  sunset: { fill: 'url(#bl-sunset)', glow: '#ffffff' },
} as const;

const NS = 'http://www.w3.org/2000/svg';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const INK = '#0a0a0d';
type Attrs = Record<string, string | number>;
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: SVGElement[]) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...kids);
  return e;
};
const ink = (w = 5): Attrs => ({ stroke: INK, 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });

// closed Catmull-Rom spline through the points -> smooth SVG path
function smooth(pts: [number, number][]): string {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

export class Blob2D {
  readonly svg: SVGSVGElement;
  private static ids = 0;
  mood: Mood = 'idle';
  look: Look;
  private rig = el('g');
  private body = el('path', ink());
  private shine = el('path', { d: 'M-52,-38 Q-46,-62 -20,-70', stroke: '#fff', 'stroke-width': 9, 'stroke-linecap': 'round', fill: 'none', opacity: 0.55 });
  private shadow = el('ellipse', { cx: 0, cy: 68, rx: 70, ry: 9, fill: '#000', opacity: 0.35 });
  private clipShape = el('path');
  private outfit = el('g');  // jacket etc., clipped to the body outline so it follows the hem
  private back = el('g');   // drawn behind the body (headset band, antenna)
  private gear = el('g');   // visor, helmet, ears... over the body
  private face = el('g');   // eyes + mouth, slides towards the cursor
  private front = el('g');  // props and the hand holding them
  private eyes: SVGGElement[] = [];
  private mouth = el('path', ink(4.5));
  private cheeks = el('g', { opacity: 0.55 });
  private dots = el('g', { fill: '#f3f3f5', opacity: 0 });
  private anim: ((t: number) => void)[] = []; // per-frame updates for gear (flag wave, antenna blink)
  private t = Math.random() * 10;
  private mt = 0;
  private blinkIn = 1.5 + Math.random() * 2;
  private gaze = { x: 0, y: 0 };
  private gazeTo = { x: 0, y: 0 };
  private raf = 0;
  private last = 0;
  private onScreen = true;

  constructor(host: HTMLElement, look: Partial<Look> = {}, size = 220) {
    this.look = { ...DEFAULT_LOOK, ...look };
    this.svg = el('svg', { viewBox: '-140 -150 280 240', width: size * 280 / 240, height: size, role: 'img', 'aria-label': 'Blob mascot' });
    this.svg.style.overflow = 'visible';
    const defs = el('defs', {},
      el('linearGradient', { id: 'bl-sunset', x1: 0, y1: 0, x2: 1, y2: 1 },
        el('stop', { offset: '0', 'stop-color': '#ff6a00' }), el('stop', { offset: '0.55', 'stop-color': '#ff2bd6' }), el('stop', { offset: '1', 'stop-color': '#7b2bff' })));
    for (const x of [-46, 46]) this.cheeks.append(el('ellipse', { cx: x, cy: 18, rx: 10, ry: 6, fill: '#ff8fa8' }));
    for (let i = 0; i < 3; i++) this.dots.append(el('circle', { cx: 50 + i * 16, cy: -105 - i * 8, r: 4 + i * 1.5 }));
    const clipId = `bl-clip-${++Blob2D.ids}`;
    defs.append(el('clipPath', { id: clipId }, this.clipShape));
    this.outfit.setAttribute('clip-path', `url(#${clipId})`);
    this.rig.append(this.back, this.body, this.outfit, this.shine, this.gear, this.face, this.front, this.dots);
    this.svg.append(defs, this.shadow, this.rig);
    host.append(this.svg);
    this.build();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
    // skip the animation work while scrolled out of view (pages can have many blobs)
    new IntersectionObserver(([en]) => { this.onScreen = en.isIntersecting; }, { rootMargin: '100px' }).observe(this.svg);
  }

  set(look: Partial<Look>) { this.look = { ...this.look, ...look }; this.build(); }
  setMood(m: Mood) { this.mood = m; this.mt = 0; }
  destroy() { cancelAnimationFrame(this.raf); this.svg.remove(); }

  /** Point the eyes at a page position (clientX/clientY). */
  lookAt(cx: number, cy: number) {
    const r = this.svg.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 300);
    this.gazeTo = { x: (dx / d) * 10 * k, y: (dy / d) * 7 * k };
  }

  /** Racing jacket / suit / pit vest / bomber over the lower body (clipped to the outline). */
  private buildOutfit() {
    const L = this.look, o = this.outfit;
    o.replaceChildren();
    if (L.outfit === 'none') return;
    const top = 34, c = L.outfitColor;
    const shade = (hex: string, k: number) => {
      const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.round(v * k).toString(16).padStart(2, '0');
      return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
    };
    const dark = shade(c, 0.62);
    const base = (fill: string) => el('path', { d: `M-140,${top + 6} Q0,${top - 8} 140,${top + 6} L140,160 L-140,160Z`, fill });
    const edge = () => el('path', { d: `M-140,${top + 6} Q0,${top - 8} 140,${top + 6}`, fill: 'none', ...ink(5) });
    const label = (x: number, y: number, txt: string, size: number, fill: string) => {
      const t = el('text', { x, y, 'text-anchor': 'middle', 'font-size': size, 'font-weight': 900, 'font-style': 'italic', 'font-family': 'Titillium Web, sans-serif', fill });
      t.textContent = txt;
      return t;
    };
    const patch = (x: number, y: number, txt: string, bg = '#f3f3f5', fg = '#e10600') =>
      el('g', {}, el('rect', { x, y, width: 26, height: 14, rx: 3, fill: bg, ...ink(2.5) }), label(x + 13, y + 10.5, txt, 10, fg));
    const zip = () => el('path', { d: `M0,${top + 4} L0,160`, stroke: '#c9ccd6', 'stroke-width': 3.5, 'stroke-dasharray': '3 3' });
    if (L.outfit === 'jacket') {
      // two-tone racing jacket: side panels with piping, white collar flaps, zip, patches
      o.append(base(c),
        el('path', { d: `M-140,${top} L-58,${top + 2} L-48,160 L-140,160Z`, fill: dark }),
        el('path', { d: `M140,${top} L58,${top + 2} L48,160 L140,160Z`, fill: dark }),
        el('path', { d: `M-60,${top + 10} L-46,160`, stroke: '#f3f3f5', 'stroke-width': 4 }),
        el('path', { d: `M60,${top + 10} L46,160`, stroke: '#f3f3f5', 'stroke-width': 4 }),
        zip(),
        el('path', { d: `M-30,${top - 1} L-3,${top + 2} L-12,${top + 18}Z`, fill: '#f3f3f5', ...ink(3) }),
        el('path', { d: `M30,${top - 1} L3,${top + 2} L12,${top + 18}Z`, fill: '#f3f3f5', ...ink(3) }),
        patch(14, top + 16, '07'), patch(-40, top + 18, 'BOX', '#14141b', '#ffd400'), edge());
    } else if (L.outfit === 'suit') {
      // one-piece motorcycle racing leathers
      const white = '#f3f3f5', black = '#14141b';
      const shoulder = (sx: number) => el('g', {},
        el('rect', { x: sx - 13, y: top - 1, width: 26, height: 15, rx: 7.5, fill: '#d8dae0', ...ink(3) }),
        el('path', { d: `M${sx - 5},${top + 1} L${sx - 5},${top + 12} M${sx + 1},${top + 1} L${sx + 1},${top + 12} M${sx + 7},${top + 2} L${sx + 7},${top + 11}`, stroke: '#9a9eaa', 'stroke-width': 2 }));
      const perf = (x0: number) => {
        const g = el('g', { fill: dark });
        for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) g.append(el('circle', { cx: x0 + i * 5 + (j % 2) * 2.5, cy: top + 42 + j * 5, r: 1.3 }));
        return g;
      };
      const accordion = el('g', {}, el('rect', { x: -15, y: top + 14, width: 30, height: 30, rx: 7, fill: black, ...ink(3) }));
      for (let y = top + 19; y < top + 42; y += 4.5) accordion.append(el('path', { d: `M-11,${y} Q0,${y + 2} 11,${y}`, fill: 'none', stroke: '#454552', 'stroke-width': 2 }));
      o.append(base(c),
        // the swoosh: a white sweep with a dark trailing edge, shoulder to opposite hip
        el('path', { d: `M-140,${top + 34} C-70,${top + 18} -10,${top + 44} 140,${top + 22} L140,${top + 31} C-10,${top + 53} -70,${top + 27} -140,${top + 43}Z`, fill: white }),
        el('path', { d: `M-140,${top + 43} C-70,${top + 27} -10,${top + 53} 140,${top + 31} L140,${top + 36} C-10,${top + 58} -70,${top + 32} -140,${top + 48}Z`, fill: dark }),
        perf(-70), perf(48),
        accordion,
        // centre zip above the stretch panel
        el('path', { d: `M0,${top + 2} L0,${top + 14}`, stroke: '#c9ccd6', 'stroke-width': 3.5, 'stroke-dasharray': '2.5 2' }),
        // stand-up collar with a snap
        el('path', { d: `M-32,${top - 1} Q0,${top - 9} 32,${top - 1} L29,${top + 7} Q0,${top + 1} -29,${top + 7}Z`, fill: black, ...ink(3) }),
        el('circle', { cx: 0, cy: top + 1, r: 2.6, fill: '#c9ccd6' }),
        shoulder(-62), shoulder(62),
        patch(22, top + 14, '07'), patch(-48, top + 15, 'RY', black, '#c6ff00'),
        edge());
    } else if (L.outfit === 'vest') {
      // hi-vis pit-crew vest, open at the front, reflective bands
      const lime = '#c6ff00';
      o.append(
        el('path', { d: `M-140,${top + 6} Q-60,${top - 4} -16,${top - 2} L-12,160 L-140,160Z`, fill: lime }),
        el('path', { d: `M140,${top + 6} Q60,${top - 4} 16,${top - 2} L12,160 L140,160Z`, fill: lime }),
        el('rect', { x: -140, y: top + 22, width: 126, height: 8, fill: '#e6e8ee' }),
        el('rect', { x: 14, y: top + 22, width: 126, height: 8, fill: '#e6e8ee' }),
        el('path', { d: `M-16,${top - 2} L-12,160 M16,${top - 2} L12,160`, fill: 'none', ...ink(4) }),
        el('path', { d: `M-140,${top + 6} Q-60,${top - 4} -16,${top - 2} M140,${top + 6} Q60,${top - 4} 16,${top - 2}`, fill: 'none', ...ink(5) }));
    } else if (L.outfit === 'bomber') {
      // puffy bomber: quilted lines, ribbed collar
      o.append(base(c));
      for (let y = top + 18; y < 120; y += 14) o.append(el('path', { d: `M-140,${y} Q0,${y - 8} 140,${y}`, fill: 'none', stroke: dark, 'stroke-width': 3 }));
      o.append(el('path', { d: `M-70,${top + 1} Q0,${top - 10} 70,${top + 1}`, fill: 'none', stroke: dark, 'stroke-width': 10 }), zip(), patch(16, top + 22, '07', '#f3f3f5', '#14141b'), edge());
    }
  }

  private build() {
    const L = this.look;
    this.body.setAttribute('fill', L.color);
    this.buildOutfit();
    this.back.replaceChildren(); this.gear.replaceChildren(); this.front.replaceChildren(); this.face.replaceChildren();
    this.anim = [];
    const full = L.head === 'fullface';
    // a full-face helmet always has a visor: default to dark if none is picked
    const visor = L.visor !== 'none' ? VISORS[L.visor] : full ? VISORS.dark : null;
    const glow = visor?.glow;

    // --- ears / radio, behind and beside the head
    if (L.ears.includes('antenna')) {
      const tip = el('circle', { cx: 46, cy: -118, r: 7, fill: glow ?? '#ffb000', ...ink(3.5) });
      this.back.append(el('path', { d: 'M30,-70 L44,-112', fill: 'none', ...ink(5) }), tip);
      this.anim.push((t) => tip.setAttribute('opacity', Math.floor(t * 2) % 2 ? '0.35' : '1'));
    }
    if (L.ears.startsWith('headset')) {
      this.back.append(el('path', { d: 'M-76,-8 Q-78,-98 0,-98 Q78,-98 76,-8', fill: 'none', ...ink(8) }));
      this.gear.append(
        el('rect', { x: -92, y: -24, width: 24, height: 36, rx: 10, fill: '#22222a', ...ink() }),
        el('rect', { x: 68, y: -24, width: 24, height: 36, rx: 10, fill: '#22222a', ...ink() }),
        el('path', { d: 'M-76,8 Q-66,36 -38,40', fill: 'none', ...ink(4) }),
        el('circle', { cx: -34, cy: 40, r: 6.5, fill: '#22222a', ...ink(3) }));
    }
    if (L.ears === 'earmuffs') {
      this.back.append(el('path', { d: 'M-82,-6 Q-84,-108 0,-108 Q84,-108 82,-6', fill: 'none', ...ink(9) }));
      for (const s of [-1, 1]) this.gear.append(
        el('circle', { cx: 84 * s, cy: -4, r: 24, fill: '#22222a', ...ink() }),
        el('circle', { cx: 84 * s, cy: -4, r: 11, fill: L.color, ...ink(3.5) }));
    }

    // --- headgear
    const hc = L.helmetColor || '#f3f3f5';
    if (full) {
      // full-face race helmet: shell over the whole head down to a chin bar, the visor is
      // the eye port. Drawn first in the gear layer so headset earcups sit on top of it.
      const shell = el('g', {},
        el('path', { d: 'M-90,34 C-96,-56 -52,-108 0,-108 C52,-108 96,-56 90,34 Q62,52 0,54 Q-62,52 -90,34Z', fill: hc, ...ink() }),
        el('path', { d: 'M-10,-107 Q0,-108 10,-107 L8,-32 L-8,-32Z', fill: L.outfitColor, opacity: 0.9 }),
        el('path', { d: 'M-62,-80 Q-40,-98 -14,-102', stroke: '#fff', 'stroke-width': 8, 'stroke-linecap': 'round', fill: 'none', opacity: 0.6 }),
        el('path', { d: 'M-20,34 L20,34 M-16,41 L16,41', stroke: INK, 'stroke-width': 3.5, 'stroke-linecap': 'round', opacity: 0.55 }),
        el('path', { d: 'M-34,-104 Q0,-118 34,-104', fill: 'none', ...ink(6) }));
      this.gear.prepend(shell);
    } else if (L.head === 'helmet') {
      this.gear.append(el('path', { d: 'M-84,-28 C-84,-82 -46,-102 0,-102 C46,-102 84,-82 84,-28 Q0,-40 -84,-28Z', fill: hc, ...ink() }),
        el('path', { d: 'M-50,-84 Q-30,-96 -8,-97', stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round', fill: 'none' }));
    } else if (L.head === 'cap') {
      this.gear.append(el('path', { d: 'M-60,-56 Q0,-118 60,-56 Q0,-68 -60,-56Z', fill: '#14141b', ...ink() }),
        el('path', { d: 'M32,-60 Q76,-64 96,-50 Q72,-42 42,-50 Z', fill: '#14141b', ...ink() }),
        el('circle', { cx: 0, cy: -86, r: 4.5, fill: L.color }));
    } else if (L.head === 'headband') {
      const tail = el('path', { fill: '#e10600', ...ink(4) });
      this.gear.append(el('path', { d: 'M-80,-42 Q0,-62 80,-42 L78,-26 Q0,-46 -78,-26Z', fill: '#e10600', ...ink(4.5) }), tail);
      this.anim.push((t) => {
        const a = Math.sin(t * 7) * 6, b = Math.sin(t * 7 + 1) * 8;
        tail.setAttribute('d', `M76,-40 Q96,${-44 + a} 116,${-30 + b} L110,${-20 + b} Q94,${-32 + a} 76,-28Z`);
      });
    } else if (L.head === 'goggles') {
      this.gear.append(el('path', { d: 'M-82,-50 Q0,-66 82,-50', fill: 'none', ...ink(8) }));
      for (const s of [-1, 1]) this.gear.append(el('circle', { cx: 22 * s, cy: -58, r: 16, fill: glow ?? '#5ff7ff', 'fill-opacity': 0.75, ...ink(6) }));
    }

    // --- visor band the eyes glow through
    if (visor) this.gear.append(el('rect', { x: -66, y: -28, width: 132, height: 48, rx: 22, fill: visor.fill, ...ink() }),
      el('path', { d: 'M-50,-18 L-30,-18', stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.35 }));

    // --- eyes
    this.eyes = [];
    for (const x of [-26, 26]) {
      const g = el('g');
      if (L.eyes === 'led') {
        const c = glow ?? INK;
        for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
          if ((i === 0 || i === 2) && (j === 0 || j === 3)) continue; // rounded corners
          g.append(el('rect', { x: -9 + i * 6.2, y: -12 + j * 6.2, width: 5, height: 5, rx: 1.2, fill: c }));
        }
      } else if (L.eyes === 'pills') {
        g.append(el('rect', { x: -6, y: -13, width: 12, height: 26, rx: 6, fill: glow ?? INK }));
      } else if (L.eyes === 'big') {
        g.append(el('ellipse', { rx: 13, ry: 17, fill: glow ?? INK }));
        if (!glow) g.append(el('circle', { cx: 4, cy: -7, r: 4.6, fill: '#fff' }), el('circle', { cx: -4, cy: 6, r: 2.2, fill: '#fff' }));
      } else {
        g.append(el('ellipse', { rx: 9, ry: 13, fill: glow ?? INK }));
        if (!glow) g.append(el('circle', { cx: 3, cy: -5, r: 3.4, fill: '#fff' }));
      }
      if (glow) g.setAttribute('filter', 'drop-shadow(0 0 4px ' + glow + ')');
      this.eyes.push(g);
      this.face.append(g);
    }
    this.cheeks.setAttribute('opacity', visor ? '0' : '0.55');
    this.face.append(this.cheeks, this.mouth);

    // --- prop, held by a little nub hand on the right
    if (L.prop !== 'none') {
      const hold = el('g');
      if (L.prop === 'flag') {
        const flag = el('g');
        flag.append(el('rect', { x: 0, y: 0, width: 54, height: 36, fill: '#fff', ...ink(4) }));
        for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) flag.append(el('rect', { x: i * 9, y: j * 9, width: 9, height: 9, fill: INK }));
        flag.append(el('rect', { x: 0, y: 0, width: 54, height: 36, fill: 'none', ...ink(4) }));
        hold.append(el('path', { d: 'M100,30 L108,-74', fill: 'none', ...ink(5) }), flag);
        this.anim.push((t) => flag.setAttribute('transform', `translate(108,-74) skewY(${(Math.sin(t * 6) * 8).toFixed(1)}) scale(${(1 + Math.sin(t * 6 + 1) * 0.05).toFixed(3)},1)`));
      } else if (L.prop === 'wrench') {
        hold.append(el('g', { transform: 'translate(104,-6) rotate(20)' },
          el('rect', { x: -6, y: -8, width: 12, height: 52, rx: 5, fill: '#c9ccd6', ...ink(4) }),
          el('path', { d: 'M-15,-18 A16,16 0 1,1 15,-18 L6,-10 L6,-28 L-6,-28 L-6,-10 Z', fill: '#c9ccd6', ...ink(4) })));
      } else if (L.prop === 'pitboard') {
        hold.append(el('path', { d: 'M104,32 L104,-40', fill: 'none', ...ink(5) }),
          el('circle', { cx: 104, cy: -66, r: 28, fill: '#e10600', ...ink() }),
          el('text', { x: 104, y: -57, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 900, 'font-style': 'italic', 'font-family': 'Titillium Web, sans-serif', fill: '#fff' }));
        (hold.lastChild as SVGTextElement).textContent = 'BOX';
      }
      hold.append(el('circle', { cx: 100, cy: 26, r: 13, fill: L.color, ...ink(4.5) }));
      this.front.append(hold);
      this.anim.push((t) => hold.setAttribute('transform', `translate(0,${(Math.sin(t * 2.6) * 2).toFixed(1)})`));
    }
  }

  private frame(now: number) {
    this.raf = requestAnimationFrame(this.frame);
    if (!this.onScreen) { this.last = now; return; }
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.t += dt; this.mt += dt;
    const t = this.t, m = this.mood;

    // jelly outline: radius wobbles a little, base flattens where it meets the floor
    const wob = REDUCED ? 0 : (m === 'happy' || m === 'hop' ? 4 : 2.2);
    const pts: [number, number][] = [];
    const fn = SHAPES[this.look.shape] ?? SHAPES.round, flat = !FLOATING.has(this.look.shape);
    const N = 48; // enough points for ears, petals and spikes
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const r = 80 + Math.sin(a * 3 + t * 2.1) * wob + Math.sin(a * 2 - t * 1.6) * wob * 0.8;
      const [x, y0] = fn(a, r, t);
      pts.push([x, flat && y0 > 62 ? 62 + (y0 - 62) * 0.25 : y0]);
    }
    const outline = smooth(pts);
    this.body.setAttribute("d", outline);
    this.clipShape.setAttribute("d", outline);

    // hop / squash
    let hop = 0, sx = 1 + Math.sin(t * 2.6) * 0.015, sy = 1 - Math.sin(t * 2.6) * 0.015;
    if (m === 'hop' || m === 'happy') {
      const n = this.mt * (m === 'hop' ? 2.2 : 3), count = m === 'hop' ? 2 : 3;
      if (n < count) {
        const ph = n % 1, land = ph < 0.12 || ph > 0.88;
        hop = Math.sin(ph * Math.PI) * (m === 'hop' ? 48 : 22);
        sx = land ? 1.14 : 0.94; sy = land ? 0.86 : 1.07;
      } else this.mood = 'idle';
    }
    if (REDUCED) hop = 0;
    this.rig.setAttribute('transform', `translate(0,${(-hop).toFixed(1)}) translate(0,62) scale(${sx.toFixed(3)},${sy.toFixed(3)}) translate(0,-62)`);
    const floating = !flat, sh = 1 - hop / 120 - (floating ? 0.25 : 0);
    this.shadow.setAttribute('cy', floating ? '104' : '68'); // floaty shapes hover above their shadow
    this.shadow.setAttribute('rx', (70 * sh).toFixed(1));
    this.shadow.setAttribute('opacity', (0.35 * sh).toFixed(2));
    for (const f of this.anim) f(REDUCED ? 0 : t);

    // eyes follow the cursor (less behind a visor); think looks up and away
    const lim = this.look.visor !== 'none' ? 0.6 : 1;
    const target = m === 'think' ? { x: 9, y: -7 } : { x: this.gazeTo.x * lim, y: this.gazeTo.y * lim };
    const k = 1 - Math.exp(-dt * 8);
    this.gaze.x += (target.x - this.gaze.x) * k;
    this.gaze.y += (target.y - this.gaze.y) * k;
    this.face.setAttribute('transform', `translate(${this.gaze.x.toFixed(1)},${(this.gaze.y - 6).toFixed(1)})`);

    // blink, happy ^ ^, wow
    this.blinkIn -= dt;
    if (this.blinkIn < 0) this.blinkIn = 2.2 + Math.random() * 3;
    const closed = this.blinkIn < 0.12, happy = m === 'happy', wow = m === 'wow';
    this.eyes.forEach((g, i) => {
      const esy = closed ? 0.12 : happy ? 0.35 : wow ? 1.25 : 1;
      g.setAttribute('transform', `translate(${i ? 26 : -26},${happy ? -3 : 0}) scale(${wow ? 1.25 : 1},${esy})`);
    });

    // mouth
    let d = '', fill = 'none';
    const style = this.look.head === 'fullface' ? 'none' : this.look.mouth; // chin bar covers the mouth
    if (m === 'talk') { const o = 3 + Math.abs(Math.sin(this.mt * 13) * Math.sin(this.mt * 4.3)) * 12; d = `M-10,30 Q0,${30 + o * 1.6} 10,30 Q0,28 -10,30Z`; fill = '#5a1a22'; }
    else if (wow) { d = 'M-6,32 a6,8 0 1,0 12,0 a6,8 0 1,0 -12,0Z'; fill = '#5a1a22'; }
    else if (happy) { d = 'M-14,26 Q0,46 14,26 Q0,32 -14,26Z'; fill = '#5a1a22'; }
    else if (m === 'think') d = 'M-8,34 Q2,30 10,33';
    else if (style === 'cat') d = 'M-13,28 Q-6.5,36 0,28 Q6.5,36 13,28';
    else if (style === 'grin') { d = 'M-15,26 Q0,44 15,26 Z'; fill = '#fff'; }
    else if (style === 'smile') d = 'M-10,28 Q0,38 10,28';
    if (this.look.head === 'fullface') d = ''; // hidden behind the chin bar, whatever the mood
    this.mouth.setAttribute('d', d);
    this.mouth.setAttribute('fill', fill);

    this.dots.setAttribute('opacity', m === 'think' ? '1' : '0');
    if (m === 'think') [...this.dots.children].forEach((c, i) => c.setAttribute('opacity', Math.floor(this.mt * 2.5) % 4 > i ? '1' : '0'));
  }
}
