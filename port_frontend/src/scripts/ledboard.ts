// Trackside LED billboard: a W×H dot-matrix screen drawn on a canvas.
// Each project gets an animated pixel-art scene, its tag in big LED letters,
// sector bars and a scrolling marquee. Switching dissolves the old screen
// pixel by pixel, then wipes the new one in behind a white scan edge.

const BOARD_W = 128;
const BOARD_H = 41;
const OUT = 0.35; // seconds: pixel dissolve of the old screen
const IN = 0.6;   // seconds: scan-wipe of the new screen

// scene: building | palm | signal | station | bolt | camera | cocoa | track | car | bike | static
// sub: optional override for the small line under the tag (default "P1 LAP 01/04")
// light: status lamp colour, banner layout only
export type BoardProject = { scene: string; tag: string; color: string; line: string; sub?: string; light?: 'green' | 'red' | 'amber' };
// banner: a long thin strip (tag + status lamp + scrolling marquee) instead of the full board
export type BoardOptions = { banner?: boolean };
export const BANNER_W = 200, BANNER_H = 11;
export type BoardApi = { show(i: number): void };

// colour indices in the frame buffer
const OFF = 0, ACC = 1, DIM = 2, WHITE = 3, PURPLE = 4, GREEN = 5, YELLOW = 6, RED = 7;
const FIXED: Record<number, string> = {
  [WHITE]: '#ffffff', [PURPLE]: '#b14cff', [GREEN]: '#39ff6a', [YELLOW]: '#ffd400', [RED]: '#ff2a1a',
};

// --- 5×7 LED font -------------------------------------------------------------
const FONT_SRC: Record<string, string> = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 10001 01010 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  '0': '01110 10001 10011 10101 11001 10001 01110', '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111', '3': '11111 00010 00100 00010 00001 10001 01110',
  '4': '00010 00110 01010 10010 11111 00010 00010', '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110', '9': '01110 10001 10001 01111 00001 00010 01100',
  ' ': '00000 00000 00000 00000 00000 00000 00000', '-': '00000 00000 00000 11111 00000 00000 00000',
  '.': '00000 00000 00000 00000 00000 01100 01100', '/': '00001 00001 00010 00100 01000 10000 10000',
  ':': '00000 01100 01100 00000 01100 01100 00000', '+': '00000 00100 00100 11111 00100 00100 00000',
  '&': '01100 10010 10100 01000 10101 10010 01101', '%': '11000 11001 00010 00100 01000 10011 00011',
  ',': '00000 00000 00000 00000 01100 00100 01000', '!': '00100 00100 00100 00100 00100 00000 00100',
  '*': '00000 00100 01110 11111 01110 00100 00000', // diamond separator
  '@': '01110 10001 10111 10101 10111 10000 01110',
};
const FONT: Record<string, number[]> = Object.fromEntries(
  Object.entries(FONT_SRC).map(([k, v]) => [k, v.split(' ').map((r) => parseInt(r, 2))]),
);

// --- pixel-art bodies (wheels, fronds, windows are drawn procedurally) -------
// '#' accent, '+' dim accent, 'o' white, 'r' red
const CAR = [ // boxy A31 sedan, facing right
  '.............##############.............',
  '............#+++++#+++++++##............',
  '...........#++++++#++++++++##...........',
  '..........#+++++++#+++++++++##..........',
  '..####################################..',
  '.r#################+##################o.',
  '.##################+###################.',
  '.##################+###################.',
  '..####################################..',
];
const BIKE = [ // sportbike, facing right
  '.......................++.........',
  '...............######..+++#.......',
  'r#...........##########+++###.....',
  '.####.....###############+#####...',
  '..##############################..',
  '...#######++++++++#############o..',
  '.+++++...+++++++++##########......',
  '.........+++++++++####....#.......',
  '......####++++++++........#.......',
  '....####..........................',
];
const SPRITE_CODES: Record<string, number> = { '#': ACC, '+': DIM, o: WHITE, r: RED };

const hash = (x: number, y: number, s: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function initBoard(canvas: HTMLCanvasElement, projects: BoardProject[], onClick?: () => void, opts: BoardOptions = {}): BoardApi {
  const banner = !!opts.banner;
  const W = banner ? BANNER_W : BOARD_W;
  const H = banner ? BANNER_H : BOARD_H;
  const ctx = canvas.getContext('2d')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => performance.now() / 1000;

  const buf = new Uint8Array(W * H);
  const rnd = Float32Array.from({ length: W * H }, () => Math.random()); // dissolve order
  let cur = -1;
  let shownAt = 0;
  let tr: { from: number; to: number; t0: number } | null = null;

  // ---- drawing primitives (into the frame buffer) ----------------------------
  let clipX = 0; // pixels left of this are not drawn (keeps the banner marquee behind the tag)
  const set = (x: number, y: number, c: number) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= clipX && x < W && y >= 0 && y < H) buf[y * W + x] = c;
  };

  function text(str: string, x: number, y: number, scale: number, c: number, advance = 6 * scale) {
    for (const ch of str.toUpperCase()) {
      const g = FONT[ch] ?? FONT[' '];
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < 5; col++)
          if ((g[row] >> (4 - col)) & 1)
            for (let sy = 0; sy < scale; sy++)
              for (let sx = 0; sx < scale; sx++) set(x + col * scale + sx, y + row * scale + sy, c);
      x += advance;
    }
  }

  function line(x0: number, y0: number, x1: number, y1: number, c: number) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) set(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, c);
  }

  /** Union of circles: filled with `fill`, outlined with `edge` (clouds, canopies). */
  function blob(circles: [number, number, number][], fill: number, edge: number) {
    const inside = (x: number, y: number) => circles.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r);
    for (let y = 0; y < 30; y++)
      for (let x = 0; x < 47; x++) {
        if (!inside(x, y)) continue;
        const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
        set(x, y, rim ? edge : fill);
      }
  }

  function ground(x0 = 2, x1 = 45) { for (let x = x0; x < x1; x++) set(x, 29, DIM); }

  function sprite(rows: string[], ox: number, oy: number) {
    rows.forEach((row, y) => [...row].forEach((ch, x) => { const c = SPRITE_CODES[ch]; if (c) set(ox + x, oy + y, c); }));
  }

  function wheel(cx: number, cy: number, r: number, spin: number, clearR = 0) {
    const R = Math.ceil(r + 2);
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy);
        if (clearR && d < clearR) set(cx + dx, cy + dy, OFF);        // cut the wheel arch
        if (d >= r - 0.9 && d <= r + 0.45) set(cx + dx, cy + dy, ACC); // tyre
      }
    for (let m = 0; m < 3; m++) {                                   // spinning spokes
      const a = spin + (m * Math.PI * 2) / 3;
      for (let k = 1; k < r - 1; k++) set(cx + Math.cos(a) * k, cy + Math.sin(a) * k, DIM);
    }
    set(cx, cy, WHITE);
  }

  function road(t: number) {
    const shift = reduced ? 0 : Math.floor(t * 34);
    for (let x = 0; x < 47; x++) {
      set(x, 29, DIM);
      if ((x + shift) % 7 < 3) set(x, 30, DIM);
    }
  }

  // ---- scenes ---------------------------------------------------------------------
  function towerShape(cx: number, top: number, hb: number, ht: number, col: number, t: number, seed: number) {
    for (let y = top; y <= 28; y++) {
      const f = (28 - y) / (28 - top);
      const hw = Math.round(hb + (ht - hb) * f);
      set(cx - hw, y, col); set(cx + hw, y, col);
      if (y === top) for (let x = cx - hw; x <= cx + hw; x++) set(x, y, col);
      if (y % 2 === 0)
        for (let x = cx - hw + 2; x <= cx + hw - 2; x += 2) {
          const h = hash(x, y, seed);
          if (h > 0.55) continue; // unlit office
          const twinkle = !reduced && Math.sin(t * 1.3 + h * 140) > 0.96;
          set(x, y, twinkle ? WHITE : DIM);
        }
    }
  }
  // TRX skyline: The Exchange 106 — a slim, near-straight tower that steps in
  // slightly towards the top, an open (unglazed) crown frame, lit vertical edges
  // and a groove up the middle — flanked by lower TRX towers, on the podium
  // with its rooftop park.
  function sceneTower(t: number) {
    const cx = 24, top = 2, crownEnd = 7, step = 13, base = 26;
    towerShape(9, 13, 4, 4, DIM, t, 2);                                // neighbouring towers
    towerShape(39, 10, 4, 4, DIM, t, 3);

    for (let y = top; y <= base; y++) {
      const hw = y < step ? 3 : 4;                                     // slightly thinner up top
      const l = cx - hw, r = cx + hw;
      for (let x = l + 1; x < r; x++) set(x, y, OFF);                  // clear what's behind it
      const sweep = !reduced && Math.abs(y - (base - ((t * 9) % 30))) < 1.5; // light running up the edges
      set(l, y, sweep ? WHITE : ACC); set(r, y, sweep ? WHITE : ACC);

      if (y <= crownEnd) {                                             // open crown: frame only, no glass
        if (y === top || y === crownEnd) for (let x = l; x <= r; x++) set(x, y, ACC);
        else if (y === top + 2) for (let x = l; x <= r; x += 2) set(x, y, DIM); // light lattice
        continue;
      }
      set(cx, y, y % 2 ? DIM : OFF);                                   // recessed centre groove
      if (y % 2 === 0)                                                 // floor plates + windows
        for (let x = l + 1; x < r; x++) {
          if (x === cx) continue;
          const h = hash(x, y, 7);
          const twinkle = !reduced && Math.sin(t * 1.1 + h * 160) > 0.97;
          set(x, y, twinkle ? WHITE : h < 0.6 ? DIM : OFF);
        }
    }
    set(cx, 0, ACC); set(cx, 1, ACC);                                  // rooftop mast
    set(cx, 0, reduced || blink(t, 0.8) ? RED : DIM);                  // aviation light

    // podium (The Exchange TRX) with the rooftop city park
    for (let x = 3; x < 45; x++) { set(x, 27, ACC); set(x, 28, (x % 3) ? DIM : OFF); }
    [5, 9, 14, 34, 39, 43].forEach((x, i) => {                         // park trees
      const sway = !reduced && Math.sin(t * 1.5 + i) > 0.7 ? 1 : 0;
      set(x, 26, DIM); set(x - 1 + sway, 25, ACC); set(x + sway, 25, ACC); set(x + sway, 24, ACC);
    });
    for (let x = 2; x < 45; x++) set(x, 29, DIM);
  }

  function scenePalm(t: number) {
    for (let s = 0; s <= 1.0001; s += 0.02) {                       // curved trunk
      const x = 17 + 7 * s * s, y = 29 - 21 * s;
      const notch = Math.round(y) % 3 === 0;
      set(x, y, ACC); set(x + 1, y, notch ? DIM : ACC);
    }
    const cx = 25, cy = 7;
    const fronds: [number, number, number][] = [
      [-172, 15, 9], [-140, 13, 10], [-108, 8, 5], [-72, 8, 5], [-40, 13, 10], [-8, 15, 9], [150, 9, 4], [30, 9, 4],
    ];
    fronds.forEach(([deg, len, droop], i) => {
      const a = ((deg + (reduced ? 0 : Math.sin(t * 1.4 + i) * 5)) * Math.PI) / 180;
      const nx = -Math.sin(a), ny = Math.cos(a);
      for (let k = 0; k <= len; k++) {
        const f = k / len;
        const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k + droop * f * f;
        set(x, y, ACC);
        if (k > 2 && k % 2 === 0) { set(x + nx, y + ny, DIM); set(x - nx, y - ny, DIM); } // leaflets
      }
    });
    set(24, 9, WHITE); set(26, 9, WHITE); set(25, 10, WHITE);       // coconuts
    for (let x = 8; x < 38; x++) set(x, 29, DIM);
  }

  function sceneCar(t: number) {
    road(t);
    sprite(CAR, 3, 16);
    const spin = reduced ? 0 : -t * 9;
    wheel(12, 25, 3.4, spin, 4.3);
    wheel(33, 25, 3.4, spin, 4.3);
  }

  function sceneBike(t: number) {
    road(t);
    sprite(BIKE, 6, 14);
    const spin = reduced ? 0 : -t * 9;
    wheel(13, 25, 3.9, spin);
    wheel(33, 25, 3.9, spin);
  }

  function rect(x0: number, y0: number, x1: number, y1: number, edge: number, fill: number) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) set(x, y, x === x0 || x === x1 || y === y0 || y === y1 ? edge : fill);
  }
  const blink = (t: number, hz: number, phase = 0) => !reduced && Math.floor(t * hz + phase) % 2 === 1;

  // STARS: LoRaWAN gateway mast pulsing radio waves out to soil-sensor nodes
  function sceneSignal(t: number) {
    ground();
    line(10, 6, 10, 28, ACC); line(14, 6, 14, 28, ACC);
    for (let y = 8; y < 26; y += 4) { line(10, y, 14, y + 4, DIM); line(14, y, 10, y + 4, DIM); }
    line(12, 1, 12, 6, ACC); set(12, 1, WHITE);
    for (let k = 0; k < 3; k++) {
      const r = reduced ? 7 + k * 8 : ((t * 12 + k * 9) % 27) + 2;
      for (let d = -55; d <= 55; d += 5) {
        const a = (d * Math.PI) / 180;
        set(12 + Math.cos(a) * r, 3 + Math.sin(a) * r * 0.8, r < 14 ? ACC : DIM);
      }
    }
    [[28, 23], [36, 21], [42, 24]].forEach(([x, y], i) => {
      line(x, y + 3, x, 28, DIM);
      rect(x - 1, y, x + 1, y + 2, ACC, DIM);
      line(x, y - 3, x, y - 1, DIM);
      set(x, y - 3, blink(t, 1.5, i * 0.7) ? WHITE : DIM);
    });
  }

  // RHT: weather station — spinning cups, swinging vane, solar panel, logger, rain gauge
  function sceneStation(t: number) {
    for (let k = 0; k < 16; k++) {
      const x = Math.floor(hash(k, 1, 3) * 46);
      const y = reduced ? hash(k, 2, 3) * 27 : (t * 22 + hash(k, 2, 3) * 30) % 29;
      set(x, y, DIM);
    }
    ground();
    line(22, 6, 22, 28, ACC);
    line(22, 22, 15, 28, ACC); line(22, 22, 29, 28, ACC);
    line(13, 8, 31, 8, ACC);
    line(13, 8, 13, 5, ACC);                                         // anemometer
    const a = reduced ? 0.5 : t * 7;
    for (let k = 0; k < 3; k++) {
      const ang = a + (k * Math.PI * 2) / 3;
      const cx = 13 + Math.cos(ang) * 3.2, cy = 4 + Math.sin(ang) * 1.2;
      line(13, 4, cx, cy, DIM); set(cx, cy, WHITE);
    }
    const v = reduced ? 0 : Math.sin(t * 0.8) * 0.5;                // wind vane
    line(31, 8, 31, 5, ACC);
    line(31 - Math.cos(v) * 4, 4 - Math.sin(v) * 2, 31 + Math.cos(v) * 3, 4 + Math.sin(v) * 2, ACC);
    set(31 + Math.cos(v) * 3, 4 + Math.sin(v) * 2, WHITE);
    for (let y = 12; y <= 15; y++) line(24 + (y - 12), y, 31 + (y - 12), y, y === 12 || y === 15 ? ACC : DIM); // solar panel
    rect(16, 15, 20, 19, ACC, DIM);                                  // logger
    set(18, 17, blink(t, 2) ? WHITE : DIM);
    line(35, 22, 41, 22, ACC); rect(36, 23, 40, 28, ACC, OFF);       // rain gauge
  }

  // ALRAS: storm cloud, double-flash lightning strike, warning beacon
  function sceneBolt(t: number) {
    const cyc = t % 2.6;
    const flash = !reduced && (cyc < 0.12 || (cyc > 0.22 && cyc < 0.32));
    for (let k = 0; k < 18; k++) {
      const x = 6 + hash(k, 4, 9) * 34;
      const y = 12 + (reduced ? hash(k, 5, 9) * 16 : (t * 26 + hash(k, 5, 9) * 17) % 17);
      set(x, y, DIM);
    }
    ground();
    blob([[14, 8, 5], [22, 6, 6], [30, 8, 5], [22, 10, 4.5]], DIM, flash ? WHITE : ACC);
    if (flash || reduced) {
      const c = flash ? WHITE : ACC;
      line(22, 13, 18, 19, c); line(18, 19, 24, 19, c); line(24, 19, 19, 28, c);
      if (flash) for (let x = 13; x < 27; x++) set(x, 29, ACC);
    }
    line(38, 20, 38, 28, ACC);
    const alarm = !reduced && cyc < 1.4;
    rect(36, 17, 40, 19, ACC, alarm && blink(t, 6) ? RED : DIM);
  }

  // SureCam: CCTV camera sweeping its field of view, detection box hopping between people
  function figure(x: number, y: number) {
    set(x, y - 1, ACC); set(x - 1, y, ACC); set(x + 1, y, ACC); set(x, y, ACC);
    line(x, y + 1, x, y + 4, ACC);
    line(x - 2, y + 2, x + 2, y + 2, ACC);
    line(x, y + 4, x - 2, y + 8, ACC); line(x, y + 4, x + 2, y + 8, ACC);
  }
  function sceneCamera(t: number) {
    ground();
    const sweep = reduced ? 0 : Math.sin(t * 0.7) * 7;
    line(19, 7, 12 + sweep, 28, DIM); line(19, 7, 40 + sweep, 28, DIM);
    line(3, 2, 3, 9, DIM); line(3, 6, 8, 6, DIM);
    rect(7, 4, 17, 8, ACC, DIM);
    rect(17, 5, 19, 7, ACC, OFF); set(18, 6, WHITE);
    set(9, 5, reduced || blink(t, 1.5) ? RED : OFF);                 // REC
    const people = [15, 27, 38];
    people.forEach((x) => figure(x, 21));
    const tx = people[Math.floor(reduced ? 1 : t / 2.2) % people.length];
    const c = blink(t, 4) ? WHITE : ACC;
    const [x0, y0, x1, y1] = [tx - 4, 18, tx + 4, 30];
    for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      set(cx, cy, c); set(cx + dx, cy, c); set(cx, cy + dy, c);       // corner brackets
    }
  }

  // LKM: cocoa tree with glowing pods + a soil probe sending telemetry
  function sceneCocoa(t: number) {
    ground();
    line(20, 12, 20, 28, ACC); line(21, 12, 21, 28, ACC);
    line(20, 16, 14, 12, ACC); line(21, 15, 27, 11, ACC);
    blob([[20, 7, 6], [13, 10, 4.5], [28, 9, 4.5]], DIM, ACC);
    [[17, 18], [24, 20], [17, 23]].forEach(([x, y], i) => {
      const glow = !reduced && Math.sin(t * 2 + i * 2) > 0.6;
      set(x, y - 1, DIM);
      for (let dy = 0; dy < 4; dy++) { set(x, y + dy, glow ? WHITE : ACC); set(x + 1, y + dy, ACC); }
    });
    line(37, 21, 37, 29, ACC); rect(35, 18, 39, 20, ACC, DIM);
    set(37, 16, blink(t, 2) ? WHITE : DIM);
    if (blink(t, 2)) { set(40, 15, DIM); set(41, 14, DIM); set(34, 15, DIM); set(33, 14, DIM); }
  }

  // SIC: Sepang tarmac + kerb, a monitoring station reading the surface, an F1 car flashing past
  const F1CAR = [
    '.##......#....',
    '.##..#######..',
    '##############',
    '.oo.......oo..',
  ];
  function sceneTrack(t: number) {
    for (let y = 21; y <= 29; y++) for (let x = 0; x < 47; x++) if ((x + y * 2) % 4 === 0) set(x, y, DIM); // asphalt
    for (let x = 0; x < 47; x++) set(x, 20, Math.floor(x / 3) % 2 ? WHITE : RED);                          // kerb
    line(36, 4, 36, 19, ACC);                                                                              // mast
    rect(31, 2, 39, 5, ACC, DIM);                                                                          // sensor head
    for (let y = 8; y <= 10; y++) line(37 + (y - 8), y, 43 + (y - 8), y, y === 8 || y === 10 ? ACC : DIM); // solar panel
    const read = blink(t, 1.6);
    for (let k = 0; k < 11; k += 2) set(31 - k * 1.1, 6 + k * 1.4, read ? WHITE : DIM);                  // IR beam to the tarmac
    set(19, 22, read ? WHITE : ACC); set(20, 22, read ? WHITE : ACC);
    const p = reduced ? 0.35 : (t % 2.6) / 2.6;
    const cx = Math.round(-16 + p * 72);
    sprite(F1CAR, cx, 23);
    if (!reduced) for (let x = cx - 7; x < cx - 1; x++) if ((x + Math.floor(t * 30)) % 2) set(x, 25, DIM); // speed streak
  }

  // no data: TV static
  function sceneStatic(t: number) {
    const f = reduced ? 0 : Math.floor(t * 14);
    for (let y = 0; y < 30; y++) for (let x = 0; x < 47; x++) if (hash(x, y, f) < 0.12) set(x, y, DIM);
  }

  const SCENES: Record<string, (t: number) => void> = {
    building: sceneTower, palm: scenePalm, car: sceneCar, bike: sceneBike,
    signal: sceneSignal, station: sceneStation, bolt: sceneBolt, camera: sceneCamera, cocoa: sceneCocoa,
    track: sceneTrack,
    static: sceneStatic,
  };

  // ---- full screen for one project --------------------------------------------
  // banner layout (W×11): [TAG] [lamp] ┊ marquee scrolling ← … with dotted rails top + bottom
  function renderBanner(i: number, t: number, since: number) {
    const p = projects[i];
    for (let x = 0; x < W; x += 2) { set(x, 0, DIM); set(x, H - 1, DIM); }       // rails
    text(p.tag, 3, 2, 1, ACC);
    let x = 3 + p.tag.length * 6 + 2;
    const lamp = p.light === 'green' ? GREEN : p.light === 'red' ? RED : YELLOW;
    const on = reduced || Math.floor(t * 1.6) % 2 === 0;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) set(x + dx, 4 + dy, on ? lamp : DIM);
    x += 6;
    for (let y = 2; y < H - 2; y += 2) set(x, y, DIM);                          // divider
    clipX = x + 2;
    const msg = `${p.line}   *   `;
    const room = W - clipX;
    const total = msg.length * 6 + room;
    const offset = reduced ? room - 2 : (since * 22) % total;
    text(msg, Math.round(W - offset), 2, 1, ACC);
    clipX = 0;
  }

  function render(i: number, t: number, since: number) {
    if (banner) { renderBanner(i, t, since); return; }
    const p = projects[i];
    (SCENES[p.scene] ?? sceneStatic)(t);
    for (let y = 2; y < 30; y += 2) set(47, y, DIM);                  // divider

    text(p.tag, 51, 3, 2, ACC, p.tag.length > 6 ? 11 : 12);           // tighten 7-letter tags
    const pad = (n: number) => String(n).padStart(2, '0');
    text(p.sub ?? `P${i + 1} LAP ${pad(i + 1)}/${pad(projects.length)}`, 51, 19, 1, WHITE);

    [PURPLE, GREEN, YELLOW].forEach((c, k) => {                       // sector bars
      const x0 = 51 + k * 25, w = 22;
      const fill = reduced ? 1 : Math.min(1, Math.max(0, (since - 0.4 - k * 0.5) / 0.45));
      for (let x = 0; x < w; x++)
        for (let y = 27; y <= 28; y++) set(x0 + x, y, x < w * fill ? c : (x % 2 ? OFF : DIM));
    });

    for (let x = 0; x < W; x += 2) set(x, 31, DIM);                   // separator

    const msg = `${p.line}   *   `;
    const total = msg.length * 6 + W;
    const offset = reduced ? W - 2 : (since * 24) % total;
    text(msg, Math.round(W - offset), 33, 1, ACC);
  }

  // ---- canvas output ---------------------------------------------------------------
  let pitch = 8, dpr = 1;
  const bg = document.createElement('canvas');
  const sprites = new Map<string, HTMLCanvasElement>();

  function ledSprite(css: string): HTMLCanvasElement {
    const key = css;
    let s = sprites.get(key);
    if (s) return s;
    const size = Math.max(4, Math.ceil(pitch * dpr * 2.6));
    s = document.createElement('canvas');
    s.width = s.height = size;
    const g = s.getContext('2d')!;
    const c = size / 2, p = pitch * dpr;
    const [r, gg, b] = hexToRgb(css);
    const glow = g.createRadialGradient(c, c, p * 0.25, c, c, p * 1.25);
    glow.addColorStop(0, `rgba(${r},${gg},${b},0.45)`);
    glow.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = glow; g.fillRect(0, 0, size, size);
    g.fillStyle = css; g.beginPath(); g.arc(c, c, p * 0.36, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(c - p * 0.1, c - p * 0.1, p * 0.12, 0, Math.PI * 2); g.fill();
    sprites.set(key, s);
    return s;
  }

  function resize() {
    const cssW = canvas.clientWidth || 640;
    pitch = cssW / W;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * pitch * dpr);
    canvas.height = Math.round(H * pitch * dpr);
    bg.width = canvas.width; bg.height = canvas.height;
    const g = bg.getContext('2d')!;
    g.fillStyle = '#050507'; g.fillRect(0, 0, bg.width, bg.height);
    g.fillStyle = '#15151b';
    const p = pitch * dpr;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) { g.beginPath(); g.arc((x + 0.5) * p, (y + 0.5) * p, p * 0.32, 0, Math.PI * 2); g.fill(); }
    sprites.clear();
  }
  window.addEventListener('resize', resize);
  resize();

  function blit(accent: string) {
    const [r, g, b] = hexToRgb(accent);
    const dim = `#${[r, g, b].map((v) => Math.round(v * 0.36).toString(16).padStart(2, '0')).join('')}`;
    const colours: Record<number, string> = { ...FIXED, [ACC]: accent, [DIM]: dim };
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(bg, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const p = pitch * dpr;
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (!c) continue;
      const s = ledSprite(colours[c]);
      ctx.drawImage(s, ((i % W) + 0.5) * p - s.width / 2, (((i / W) | 0) + 0.5) * p - s.height / 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // only draw while on screen, at ~30fps (pixel art doesn't need 60) — keeps
  // the main thread free so scrolling stays smooth
  let onScreen = true, lastDraw = 0;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }, { rootMargin: '100px' }).observe(canvas);

  function frame() {
    const t = now();
    if (!onScreen || t - lastDraw < 0.032) { requestAnimationFrame(frame); return; }
    lastDraw = t;
    buf.fill(OFF);
    let accent = cur >= 0 ? projects[cur].color : '#ff2bd6';

    if (tr) {
      const el = t - tr.t0;
      const outDur = tr.from >= 0 ? OUT : 0;
      if (el < outDur) {
        // old screen breaks up pixel by pixel, a few sparks flash white
        render(tr.from, t, t - shownAt);
        accent = projects[tr.from].color;
        const p = el / outDur;
        for (let i = 0; i < buf.length; i++) {
          if (!buf[i]) continue;
          if (rnd[i] < p) buf[i] = OFF;
          else if (rnd[i] < p + 0.04) buf[i] = WHITE;
        }
      } else {
        // new screen wipes in behind a bright scan column
        if (shownAt < tr.t0 + outDur) shownAt = tr.t0 + outDur;
        render(tr.to, t, t - shownAt);
        accent = projects[tr.to].color;
        const p = Math.min(1, (el - outDur) / IN);
        const sx = Math.floor(p * (W + 3));
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (x > sx) buf[i] = OFF;
            else if (x >= sx - 1 && buf[i]) buf[i] = WHITE;
          }
        if (p >= 1) { cur = tr.to; tr = null; }
      }
    } else if (cur >= 0) {
      render(cur, t, t - shownAt);
    }

    blit(accent);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  canvas.addEventListener('click', () => onClick?.());

  return {
    show(i: number) {
      if (i === (tr ? tr.to : cur)) return;
      if (reduced) { cur = i; shownAt = now(); tr = null; return; }
      const from = tr ? tr.to : cur;
      tr = { from, to: i, t0: now() };
      if (from < 0) shownAt = now();
    },
  };
}
