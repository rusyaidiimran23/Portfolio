// Easter egg: "Lights Out" reaction game on an LED signage board.
// Five reds come on, a random hold, they go out — tap as fast as you can.
// Times go to a global top 10 (port_backend/app/game.py).

import { API_BASE } from '../lib/api';

const W = 96, H = 36;                          // board size in LEDs
const PAL: Record<string, string> = {
  R: '#ff2a1a', A: '#ffb000', G: '#39ff6a', P: '#b14cff', W: '#f3f3f5',
  K: '#6b6b78', L: '#b6ff2e', B: '#3d7bff', D: '#5c1008', S: '#ff2bd6',
};
const OFF = '#17171d';

// --- 3x5 pixel font ------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'], '.': ['...', '...', '...', '...', '.#.'], ':': ['...', '.#.', '...', '.#.', '...'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'], '?': ['##.', '..#', '.#.', '...', '.#.'], '-': ['...', '...', '###', '...', '...'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'], '<': ['..#', '.#.', '#..', '.#.', '..#'], ' ': ['...', '...', '...', '...', '...'],
};

// --- sprites (facing right) ----------------------------------------------------
const SPRITES: Record<'bike' | 'f1', string[]> = {
  bike: [
    '..........WW............',
    '.........WWWL...........',
    '........LLLLLL..LL......',
    '......LLLLLLLLLLLLL.....',
    '..LLLLLLLLLLLLLLLLLLL...',
    '.LL...LLLLLLLLLL...LLL..',
    '..KKK...........KKK.....',
    '.K...K.........K...K....',
    '.K.W.K.........K.W.K....',
    '..KKK...........KKK.....',
  ],
  f1: [
    'RRR.....................',
    'RRR..........WW.........',
    '.R.......RRRRWWRR.......',
    '.R....RRRRRRRRRRRRRR....',
    'RRRRRRRRRRRRRRRRRRRRRRR.',
    'RRRRWWWWRRRRRRRRRRRRRRWW',
    '.KKKK.............KKKK..',
    'KKWWKK...........KKWWKK.',
    '.KKKK.............KKKK..',
  ],
};

type Vehicle = 'bike' | 'f1';
type State = 'idle' | 'arming' | 'out' | 'launch' | 'result' | 'jump';

export function initReaction() {
  const box = document.getElementById('rx')!;
  const cv = document.getElementById('rx-cv') as HTMLCanvasElement;
  const ctx = cv.getContext('2d')!;
  const lastEl = document.getElementById('rx-last')!;
  const pbEl = document.getElementById('rx-pb')!;
  const form = document.getElementById('rx-form') as HTMLFormElement;
  const codeIn = document.getElementById('rx-code') as HTMLInputElement;
  const msg = document.getElementById('rx-msg')!;
  const topEl = document.getElementById('rx-top')!;

  let fb = new Uint8Array(W * H);                // palette index per LED (0 = off)
  const keys = ['', ...Object.keys(PAL)];
  const idx = Object.fromEntries(keys.map((k, i) => [k, i]));
  let dots: HTMLCanvasElement[] = [];            // pre-rendered LED sprite per colour
  let pitch = 8, raf = 0, open = false;

  let vehicle: Vehicle = (localStorage.getItem('rx-veh') as Vehicle) || 'bike';
  let state: State = 'idle', since = 0, lit = 0, outAt = 0, holdMs = 0, ms = 0;
  let ticket: Promise<string | null> = Promise.resolve(null);
  let vx = 0, vv = 0, scroll = 0;
  let pb = Number(localStorage.getItem('rx-pb')) || 0;
  let newPb = false;

  // --- drawing -------------------------------------------------------------------
  function size() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = cv.clientWidth || 600;
    pitch = (cssW * dpr) / W;
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(pitch * H);
    dots = keys.map((k) => {
      const c = document.createElement('canvas');
      const s = Math.ceil(pitch * 2);
      c.width = c.height = s;
      const g = c.getContext('2d')!;
      const r = pitch * 0.36;
      if (k) {
        const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, pitch);
        grad.addColorStop(0, PAL[k] + '66'); grad.addColorStop(1, PAL[k] + '00');
        g.fillStyle = grad; g.fillRect(0, 0, s, s);                       // glow
      }
      g.fillStyle = k ? PAL[k] : OFF;
      g.beginPath(); g.arc(s / 2, s / 2, r, 0, Math.PI * 2); g.fill();
      if (k) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(s / 2 - r * 0.25, s / 2 - r * 0.25, r * 0.35, 0, Math.PI * 2); g.fill(); }
      return c;
    });
  }
  const px = (x: number, y: number, c: string) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < W && y >= 0 && y < H) fb[y * W + x] = idx[c];
  };
  const textW = (t: string, s = 1) => t.length * 4 * s - s;
  function text(t: string, x: number, y: number, c: string, s = 1) {
    [...t.toUpperCase()].forEach((ch, i) => {
      const g = FONT[ch] ?? FONT[' '];
      g.forEach((row, ry) => [...row].forEach((v, rx) => {
        if (v === '#') for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) px(x + i * 4 * s + rx * s + a, y + ry * s + b, c);
      }));
    });
  }
  const center = (t: string, y: number, c: string, s = 1) => text(t, Math.round((W - textW(t, s)) / 2), y, c, s);
  function marquee(t: string, y: number, c: string, now: number) {
    const w = textW(t);
    if (w <= W - 4) return center(t, y, c);
    const off = ((now / 28) % (w + W)) | 0;
    text(t, W - off, y, c);
  }
  function sprite(v: Vehicle, x: number, y: number) {
    SPRITES[v].forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.') px(x + rx, y + ry, ch); }));
  }
  function lamp(cx: number, cy: number, c: string) {
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) px(cx + x, cy + y, c);
  }
  function render() {
    ctx.fillStyle = '#060608';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const s = dots[0].width;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      ctx.drawImage(dots[fb[y * W + x]], (x + 0.5) * pitch - s / 2, (y + 0.5) * pitch - s / 2);
    }
  }

  // --- scene -----------------------------------------------------------------------
  const GROUND = 33, CAR_Y = () => GROUND - SPRITES[vehicle].length - 1, START_X = 6;
  function scene(now: number) {
    fb = new Uint8Array(W * H);
    const t = now - since;
    // gantry bar + five lamps
    for (let x = 16; x < 80; x++) px(x, 0, 'K');
    for (let i = 0; i < 5; i++) {
      const on = (state === 'arming' && i < lit) || (state === 'jump' && Math.floor(t / 180) % 2 === 0);
      lamp(26 + i * 11, 5, on ? (state === 'jump' ? 'A' : 'R') : 'D');
    }
    // kerb: red/white blocks that scroll as you launch
    for (let x = 0; x < W; x++) {
      const k = Math.floor((x + scroll) / 3) % 2 === 0 ? 'R' : 'W';
      px(x, GROUND + 1, k); px(x, GROUND + 2, k);
    }
    // start line (checkered) — stays put
    if (state !== 'result') for (let y = GROUND - 9; y <= GROUND; y++) px(START_X + 26 - Math.round(scroll), y, (y % 2) ? 'W' : '');

    if (state === 'idle') {
      if (Math.floor(now / 600) % 2 === 0) center('TAP TO START', 13, 'A');
      text(vehicle === 'bike' ? 'ZX-4RR' : 'F1', 70, 21, vehicle === 'bike' ? 'L' : 'R');
      sprite(vehicle, START_X, CAR_Y() + (Math.floor(now / 140) % 2)); // idling
    } else if (state === 'arming' || state === 'out') {
      center(state === 'arming' && lit === 0 ? 'STAND BY' : '', 13, 'W');
      sprite(vehicle, START_X, CAR_Y() + (Math.floor(now / 70) % 2)); // revving
    } else if (state === 'jump') {
      if (Math.floor(t / 180) % 2 === 0) center('JUMP START!', 13, 'A');
      sprite(vehicle, START_X + Math.min(4, t / 120), CAR_Y());
    } else if (state === 'launch') {
      sprite(vehicle, START_X + vx, CAR_Y() - (vehicle === 'bike' && vx < 30 ? 1 : 0));
      // speed lines behind
      for (let i = 0; i < 6; i++) {
        const y = CAR_Y() + 1 + i, len = 6 + ((i * 7 + Math.floor(now / 40)) % 9);
        for (let x = 0; x < len; x++) px(START_X + vx - 2 - x * 1.5 - (i % 2) * 3, y, x < 2 ? 'W' : 'K');
      }
    } else if (state === 'result') {
      const s = (ms / 1000).toFixed(3);
      const c = newPb ? 'P' : ms < 220 ? 'G' : ms < 330 ? 'A' : 'R';
      center(s, 11, c, 2);
      center(rating(ms), 24, newPb ? 'P' : 'W');
      if (newPb && Math.floor(t / 300) % 2 === 0) text('PB', 84, 11, 'P');
    }
  }
  const rating = (m: number) =>
    m < 170 ? 'ALIEN!' : m < 210 ? 'F1 DRIVER' : m < 260 ? 'QUICK' : m < 350 ? 'CLUB RACER' : m < 600 ? 'SUNDAY DRIVER' : 'ASLEEP?';

  // --- game flow -----------------------------------------------------------------
  const go = (s: State, now = performance.now()) => { state = s; since = now; };
  function tick(now: number) {
    const t = now - since;
    if (state === 'arming') {
      const want = Math.min(5, Math.floor((t - 600) / 900) + 1);
      if (t > 600 && want > lit) lit = want;
      if (lit === 5 && t > 600 + 4 * 900 + holdMs) { lit = 0; outAt = now; go('out', now); }
    } else if (state === 'out' && now - outAt > 2500) {
      finish(2500);                              // nobody home
    } else if (state === 'launch') {
      vv += 0.05 + Math.max(0, (400 - ms) / 4000); vx += vv; scroll += vv;
      if (t > 1100) go('result', now);
    } else if (state === 'jump' && t > 1700) {
      go('idle', now);
    } else if (state === 'result') {
      scroll += 0.15;
    }
    scene(now); render();
    raf = open ? requestAnimationFrame(tick) : 0;
  }

  function press(stamp: number) {
    if (state === 'idle' || state === 'result') {
      lit = 0; vx = 0; vv = 0; scroll = 0;
      holdMs = 200 + Math.random() * 2800;       // the random hold, like the real thing
      form.hidden = true; msg.textContent = '';
      ticket = fetch(`${API_BASE}/api/game/start`, { method: 'POST' })
        .then((r) => (r.ok ? r.json() : null)).then((j) => j?.ticket ?? null).catch(() => null);
      go('arming');
    } else if (state === 'arming') {
      go('jump');                                // too early
    } else if (state === 'out') {
      finish(Math.max(0, Math.round(stamp - outAt)));
    }
  }

  function finish(time: number) {
    ms = time;
    newPb = time >= 100 && time <= 1500 && (!pb || time < pb);
    if (newPb) { pb = time; try { localStorage.setItem('rx-pb', String(pb)); } catch { /* private mode */ } }
    lastEl.textContent = (time / 1000).toFixed(3);
    pbEl.textContent = pb ? (pb / 1000).toFixed(3) : '-.---';
    form.hidden = !(time >= 100 && time <= 1500);
    if (!form.hidden) codeIn.value = codeIn.value || localStorage.getItem('rx-code') || '';
    go(time >= 2500 ? 'result' : 'launch');
  }

  // --- leaderboard ---------------------------------------------------------------
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  function showTop(rows: { code: string; ms: number; vehicle: string }[]) {
    topEl.innerHTML = rows.length
      ? rows.map((r, i) => `<li class="${i === 0 ? 'p1' : ''}"><span class="rk">P${i + 1}</span><b>${esc(r.code)}</b>
          <span class="tm lcd-text">${(r.ms / 1000).toFixed(3)}</span><em>${r.vehicle === 'f1' ? 'F1' : 'BIKE'}</em></li>`).join('')
      : '<li class="empty">No times yet — set the first one.</li>';
  }
  const loadTop = () => fetch(`${API_BASE}/api/game/top`).then((r) => (r.ok ? r.json() : [])).then(showTop)
    .catch(() => { topEl.innerHTML = '<li class="empty">Leaderboard offline.</li>'; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeIn.value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) { msg.textContent = '3 LETTERS'; return; }
    const tk = await ticket;
    if (!tk) { msg.textContent = 'NO SIGNAL'; return; }
    msg.textContent = 'POSTING…';
    try { localStorage.setItem('rx-code', code); } catch { /* private mode */ }
    const res = await fetch(`${API_BASE}/api/game/score`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket: tk, code, ms, vehicle }),
    }).catch(() => null);
    if (!res) { msg.textContent = 'NO SIGNAL'; return; }
    if (res.ok) { showTop(await res.json()); form.hidden = true; msg.textContent = ''; ticket = Promise.resolve(null); return; }
    const err = await res.json().catch(() => ({}));
    const d = typeof err.detail === 'string' ? err.detail : err.detail?.[0]?.msg?.replace('Value error, ', '') ?? 'REJECTED';
    msg.textContent = String(d).toUpperCase();
  });
  codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3); });

  // --- input ---------------------------------------------------------------------
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); press(e.timeStamp); });
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { close(); return; }
    if ((e.target as HTMLElement).closest('input, button')) return;
    if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) press(e.timeStamp); }
  });
  box.querySelectorAll<HTMLButtonElement>('[data-veh]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.veh === vehicle));
    b.addEventListener('click', () => {
      vehicle = b.dataset.veh as Vehicle;
      try { localStorage.setItem('rx-veh', vehicle); } catch { /* private mode */ }
      box.querySelectorAll('[data-veh]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
      if (state !== 'arming' && state !== 'out') go('idle');
    });
  });
  box.querySelector('.rx-close')!.addEventListener('click', () => close());
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  window.addEventListener('resize', () => { if (open) size(); });

  function close() {
    open = false; box.hidden = true; cancelAnimationFrame(raf); raf = 0;
    document.documentElement.style.overflow = '';
  }

  // --- the secret trigger: 5 taps on the mini start-light icon in the header -----
  const egg = document.getElementById('egg')!;
  const eggDots = Array.from(egg.querySelectorAll('i'));
  let taps = 0, tapTimer = 0;
  egg.addEventListener('click', () => {
    clearTimeout(tapTimer);
    taps++;
    eggDots.forEach((d, i) => d.classList.toggle('on', i < taps));
    if (taps >= 5) {
      taps = 0;
      setTimeout(() => { eggDots.forEach((d) => d.classList.remove('on')); openGame(); }, 350); // lights out!
      return;
    }
    tapTimer = window.setTimeout(() => { taps = 0; eggDots.forEach((d) => d.classList.remove('on')); }, 1800);
  });

  function openGame() {
    box.hidden = false; open = true;
    document.documentElement.style.overflow = 'hidden';
    pbEl.textContent = pb ? (pb / 1000).toFixed(3) : '-.---';
    size(); go('idle'); loadTop();
    cv.focus({ preventScroll: true });
    if (!raf) raf = requestAnimationFrame(tick);
  }
  if (location.hash === '#lights-out') openGame(); // direct link for testing
}
