// Project pit garages: each project is its team's F1 garage on a night-race pit lane, a CSS
// 3D box you look straight into. Photos run on the screens on the back wall (always visible,
// click for full size), the stack hangs as sponsor boards, the car sits on stands in tyre
// blankets, the crew is around it. The race engineer (your mascot, in a team jacket and
// headset) does the talking. A top-down cutaway of the whole pit building sits on top.
//
// Performance: off-screen garages aren't rendered at all (content-visibility), the camera
// is a single composited transform updated once per frame, and the crew blobs run at 30 fps.
import '../styles/lounge.css';
import { API_BASE } from '../lib/api';
import { Blob2D, DEFAULT_LOOK, type BlobOpts, type Look } from './crew/blob2d';

export type LoungePhoto = { src: string; caption?: string; fit?: 'cover' | 'contain'; w?: number; h?: number; frame?: string };
export type LoungeProject = {
  id: string; tag: string; color: string; title: string; category?: string; status?: string; client?: string; year?: string;
  highlights?: string[]; stack?: string[]; photos?: LoungePhoto[];
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const CREW: BlobOpts = { line: 0.4, shade: true, fps: 30 }; // thin lines, shaded, background frame rate
const EDGE = 'stroke="rgba(0,0,0,.55)" stroke-width="1.2" stroke-linejoin="round"';

// shared gradients (white/black only, so every garage can reuse them; colour comes from currentColor)
const DEFS = `<defs>
  <linearGradient id="pgShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
  <linearGradient id="pgSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
  <linearGradient id="pgTyre" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050506"/><stop offset=".5" stop-color="#2e2f36"/><stop offset="1" stop-color="#050506"/></linearGradient>
  <linearGradient id="pgCarbon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c2d34"/><stop offset="1" stop-color="#0a0a0d"/></linearGradient>
  <linearGradient id="pgSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9ebf0"/><stop offset="1" stop-color="#8e929c"/></linearGradient>
</defs>`;
const lit = (d: string) => `<path d="${d}" fill="currentColor"/><path d="${d}" fill="url(#pgShade)" stroke="none"/>`;

// the car, front-on, nose towards you
const CAR = `<svg viewBox="0 0 380 172" aria-hidden="true">${DEFS}<g ${EDGE}>
  <rect x="98" y="12" width="184" height="16" rx="3" fill="url(#pgCarbon)"/>
  <rect x="94" y="8" width="9" height="46" rx="2" fill="url(#pgCarbon)"/><rect x="277" y="8" width="9" height="46" rx="2" fill="url(#pgCarbon)"/>
  <rect x="60" y="62" width="48" height="76" rx="13" fill="url(#pgTyre)"/><rect x="272" y="62" width="48" height="76" rx="13" fill="url(#pgTyre)"/>
  ${lit('M150 98 L164 42 Q190 26 216 42 L230 98 Z')}
  <ellipse cx="190" cy="47" rx="11" ry="7" fill="#050506"/>
  ${lit('M96 122 Q100 80 150 76 L230 76 Q280 80 284 122 Z')}
  <path d="M96 122 Q100 80 150 76 L230 76 Q280 80 284 122 Z" fill="url(#pgSide)" stroke="none"/>
  <path d="M112 100 Q150 84 178 84 M268 100 Q230 84 202 84" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.4"/>
  <rect x="134" y="70" width="18" height="8" rx="3" fill="url(#pgCarbon)"/><rect x="228" y="70" width="18" height="8" rx="3" fill="url(#pgCarbon)"/>
  <path d="M158 86 Q190 54 222 86" fill="none" stroke="#141418" stroke-width="7" stroke-linecap="round"/><path d="M190 60 V88" stroke="#141418" stroke-width="6"/>
  ${lit('M172 86 L208 86 L200 138 L180 138 Z')}
  <path d="M190 88 V134" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
  <text x="190" y="120" text-anchor="middle" font-size="13" font-weight="900" font-style="italic" font-family="Titillium Web, sans-serif" fill="#fff" stroke="none">07</text>
  <rect x="18" y="72" width="70" height="88" rx="16" fill="url(#pgTyre)"/><rect x="292" y="72" width="70" height="88" rx="16" fill="url(#pgTyre)"/>
  ${lit('M28 68 H78 Q92 68 92 82 V126 Q92 140 78 140 H28 Q14 140 14 126 V82 Q14 68 28 68 Z')}
  ${lit('M302 68 H352 Q366 68 366 82 V126 Q366 140 352 140 H302 Q288 140 288 126 V82 Q288 68 302 68 Z')}
  <path d="M26 104 H80 M300 104 H354" stroke="#fff" stroke-opacity=".8" stroke-width="2"/>
  <path d="M58 140 H322 L334 154 H46 Z" fill="url(#pgCarbon)"/>
  <path d="M70 146 H310" stroke="currentColor" stroke-width="3"/>
  <rect x="40" y="128" width="11" height="28" rx="2" fill="url(#pgCarbon)"/><rect x="329" y="128" width="11" height="28" rx="2" fill="url(#pgCarbon)"/>
  <path d="M178 154 L172 170 H208 L202 154 Z" fill="url(#pgSteel)"/>
  <rect x="30" y="158" width="46" height="12" rx="2" fill="url(#pgSteel)"/><rect x="304" y="158" width="46" height="12" rx="2" fill="url(#pgSteel)"/>
</g></svg>`;
const TYRES = `<svg viewBox="0 0 74 132" aria-hidden="true"><g ${EDGE}>
  ${[0, 1, 2].map((k) => `${lit(`M10 ${4 + k * 42} H64 Q72 ${4 + k * 42} 72 ${14 + k * 42} V${34 + k * 42} Q72 ${44 + k * 42} 64 ${44 + k * 42} H10 Q2 ${44 + k * 42} 2 ${34 + k * 42} V${14 + k * 42} Q2 ${4 + k * 42} 10 ${4 + k * 42} Z`)}<path d="M8 ${24 + k * 42} H66" stroke="#fff" stroke-opacity=".75" stroke-width="2"/>`).join('')}
</g></svg>`;
const TROLLEY = `<svg viewBox="0 0 110 132" aria-hidden="true"><g ${EDGE}>
  <rect x="34" y="2" width="44" height="30" rx="2" fill="url(#pgCarbon)"/><rect x="38" y="6" width="36" height="22" fill="#0e3a44"/><path d="M56 32 V42" stroke="#222"/>
  ${lit('M10 42 H100 Q104 42 104 46 V116 Q104 120 100 120 H10 Q6 120 6 116 V46 Q6 42 10 42 Z')}
  <path d="M12 64 H98 M12 84 H98 M12 102 H98" stroke="rgba(0,0,0,.45)" stroke-width="1.5"/>
  <path d="M46 54 H64 M46 74 H64 M46 93 H64 M46 111 H64" stroke="url(#pgSteel)" stroke-width="3" stroke-linecap="round"/>
  <circle cx="20" cy="126" r="5" fill="#141418"/><circle cx="90" cy="126" r="5" fill="#141418"/>
</g></svg>`;
// the car from above, nose down (towards the pit lane): for the top-down pit view
const TOP_CAR = `<svg viewBox="0 0 60 140" aria-hidden="true">
  <rect x="2" y="16" width="14" height="24" rx="4" fill="url(#pgTyre)"/><rect x="44" y="16" width="14" height="24" rx="4" fill="url(#pgTyre)"/>
  <rect x="0" y="96" width="15" height="26" rx="4" fill="url(#pgTyre)"/><rect x="45" y="96" width="15" height="26" rx="4" fill="url(#pgTyre)"/>
  <rect x="6" y="2" width="48" height="10" rx="2" fill="url(#pgCarbon)"/>
  <path d="M30 8 C40 8 44 30 44 52 C44 70 50 78 50 92 C50 104 40 112 34 118 L33 132 H27 L26 118 C20 112 10 104 10 92 C10 78 16 70 16 52 C16 30 20 8 30 8 Z" fill="currentColor"/>
  <path d="M30 8 C40 8 44 30 44 52 C44 70 50 78 50 92 C50 104 40 112 34 118 L33 132 H27 L26 118 C20 112 10 104 10 92 C10 78 16 70 16 52 C16 30 20 8 30 8 Z" fill="url(#pgSide)"/>
  <ellipse cx="30" cy="62" rx="6" ry="10" fill="#0a0a0d"/><path d="M24 54 Q30 46 36 54" fill="none" stroke="#141418" stroke-width="3"/>
  <path d="M30 14 V50 M30 74 V128" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/>
  <rect x="4" y="128" width="52" height="10" rx="2" fill="url(#pgCarbon)"/><path d="M8 133 H52" stroke="currentColor" stroke-width="2"/>
</svg>`;

/** The main mascot from the Garage (Crew screen); falls back to the default ghost. */
export async function chiefLook(): Promise<Look> {
  const fallback: Look = { ...DEFAULT_LOOK, shape: 'ghost', visor: 'dark', eyes: 'pills', ears: 'headset', outfit: 'suit', color: '#f3f3f5' };
  try {
    const r = await fetch(`${API_BASE}/api/crew`);
    const m: { role: string; look: Look }[] = (await r.json()).members ?? [];
    return { ...DEFAULT_LOOK, ...(m.find((x) => x.role === 'main') ?? m[0])?.look };
  } catch { return fallback; }
}

/** The pit crew for one team: race engineer (the mascot), mechanic, lollipop man. */
function crewFor(p: LoungeProject, base: Look) {
  const team: Partial<Look> = { outfit: 'suit', outfitColor: p.color, helmetColor: p.color, head: 'fullface', ears: 'none', visor: 'dark' };
  return {
    engineer: { ...base, head: base.head === 'fullface' ? 'none' : base.head, ears: 'headset+antenna', outfit: 'jacket', outfitColor: p.color, prop: 'none' } as Look,
    mechanic: { ...base, ...team, prop: 'wrench' } as Look,
    lollipop: { ...base, ...team, prop: 'pitboard' } as Look,
  };
}

const frameHTML = (p: LoungeProject, ph: LoungePhoto, j: number) => {
  const ar = ph.w && ph.h ? ph.w / ph.h : 4 / 3;
  const screen = ph.fit === 'contain' && ph.frame !== 'print';
  return `<button class="ph lg-frame${screen ? ' screen' : ''}" type="button" data-pid="${esc(p.id)}" data-i="${j}"
      data-cap="${esc(ph.caption)}" style="--ar: ${ar.toFixed(3)}" aria-label="${esc(ph.caption) || `Photo ${j + 1}`}">
      <img src="${esc(ph.src)}" alt="${esc(ph.caption)}" loading="lazy" decoding="async" />
    </button>`;
};

/** Garage markup for one project. Photo frames keep the .ph/data-pid/data-i hooks the lightbox uses. */
export function loungeHTML(p: LoungeProject, i: number): string {
  const photos = (p.photos ?? []).slice(0, 3);
  const screens = photos.length
    ? photos.map((ph, j) => frameHTML(p, ph, j)).join('')
    : `<div class="pg-tv"><canvas class="case-board" data-pid="${esc(p.id)}" aria-hidden="true"></canvas></div>`;
  const timing = [p.status || 'On track', p.category, [p.client, p.year].filter(Boolean).join(' · ')].filter(Boolean);
  return `
    <div class="pit lounge${i % 2 ? ' flip' : ''}" data-pid="${esc(p.id)}">
      <div class="pg-box">
        <div class="pg-ceil"></div>
        <div class="pg-floor"></div>
        <div class="pg-left"><b>${esc(p.tag)}</b></div>
        <div class="pg-right"><b>${esc(p.tag)}</b></div>
        <div class="pg-back">
          <div class="pg-screens">${screens}</div>
          <div class="pg-sponsors">${(p.stack ?? []).slice(0, 5).map((s) => `<span>${esc(s)}</span>`).join('')}</div>
        </div>
        <div class="pg-gantry" aria-hidden="true">${timing.slice(0, 3).map((t) => `<i>${esc(t)}</i>`).join('')}</div>
        <div class="pg-prop pg-tyres">${TYRES}</div>
        <div class="pg-prop pg-tyres b">${TYRES}</div>
        <div class="pg-prop pg-trolley">${TROLLEY}</div>
        <div class="pg-prop pg-car">${CAR}</div>
        <div class="pg-crew pg-mech" aria-hidden="true"></div>
        <div class="pg-crew pg-eng">
          <p class="lg-bubble" aria-live="polite">${esc(p.status || p.category || p.title)}</p>
          <button class="lg-blob" type="button" aria-label="${esc(p.tag)} race engineer: click for highlights"></button>
        </div>
      </div>
      <div class="pg-header"><b>P${i + 1}</b><strong>${esc(p.tag)}</strong><em>${esc(p.category)}</em></div>
      <div class="pg-lane" aria-hidden="true"></div>
      <div class="pg-lolly" aria-hidden="true"></div>
    </div>
    ${photos.length ? `<div class="pg-strip">${photos.map((ph, j) => frameHTML(p, ph, j)).join('')}</div>` : ''}`;
}

/** Top-down cutaway of the pit building: every garage from above, roofless, in one 3D scene.
 *  Hover a garage to light it up, click to drop down to its full view. */
export function pitView(host: HTMLElement, projects: LoungeProject[], base: Look, onPick: (id: string) => void) {
  host.innerHTML = `${DEFS.replace('<defs>', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>').replace('</defs>', '</defs></svg>')}
    <div class="pv-world" style="--n: ${projects.length}">
      <div class="pv-lane"><i class="pv-wall"></i></div>
      ${projects.map((p, i) => `
        <button class="pv-bay" type="button" data-pv="${esc(p.id)}" style="--c: ${esc(p.color)}; --i: ${i}" aria-label="Garage P${i + 1}: ${esc(p.tag)}. Go to the project">
          <i class="pv-floor"></i>
          <i class="pv-car">${TOP_CAR}</i>
          <i class="pv-tyres"></i><i class="pv-tyres b"></i><i class="pv-trolley"></i>
          <i class="pv-back"></i><i class="pv-side"></i>
          <span class="pv-sign"><b>P${i + 1}</b>${esc(p.tag)}</span>
          <i class="pv-crew"></i>
          <i class="pv-lolly"></i>
        </button>`).join('')}
      <i class="pv-side last"></i>
    </div>`;
  const blobs: Blob2D[] = [];
  let made = false;
  // the crew is only created once the overview is near the screen
  new IntersectionObserver(([en], io) => {
    if (!en.isIntersecting || made) return;
    made = true; io.disconnect();
    projects.forEach((p) => {
      const bay = host.querySelector<HTMLElement>(`[data-pv="${p.id}"]`)!;
      const team: Partial<Look> = { outfit: 'suit', outfitColor: p.color, helmetColor: p.color, head: 'fullface', ears: 'none', visor: 'dark' };
      blobs.push(new Blob2D(bay.querySelector<HTMLElement>('.pv-crew')!, { ...base, ...team, prop: 'wrench' }, 46, { ...CREW, fps: 24 }));
      blobs.push(new Blob2D(bay.querySelector<HTMLElement>('.pv-lolly')!, { ...base, ...team, prop: 'pitboard' }, 40, { ...CREW, fps: 24 }));
    });
    host.classList.add('on');
  }, { rootMargin: '150px 0px' }).observe(host);
  host.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-pv]');
    if (b) onPick(b.dataset.pv!);
  });
  host.addEventListener('pointerover', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-pv]');
    if (!b) return;
    blobs.forEach((x) => x.svg.closest('[data-pv]') === b && x.setMood('hop'));
  });
}

/** Staff every garage; wire up the camera, switch-on, hover and click. */
export function wakeLounges(wrap: HTMLElement, projects: LoungeProject[], base: Look) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  wrap.querySelectorAll<HTMLElement>('.pit').forEach((pit) => {
    const p = projects.find((x) => x.id === pit.dataset.pid);
    if (!p) return;
    const card = pit.parentElement!;
    const box = pit.querySelector<HTMLElement>('.pg-box')!;
    const looks = crewFor(p, base);
    const host = pit.querySelector<HTMLElement>('.pg-eng .lg-blob')!;
    const bubble = pit.querySelector<HTMLElement>('.lg-bubble')!;
    let crew: Blob2D[] = [];
    let engineer: Blob2D | null = null;
    const idle = bubble.textContent ?? '';
    let backT = 0, tip = -1;
    const say = (text: string, ms = 0) => {
      clearTimeout(backT);
      bubble.textContent = text;
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
      if (ms) backT = window.setTimeout(() => { bubble.textContent = idle; }, ms);
    };

    // camera: a small turn of the whole garage towards the cursor, once per frame at most
    let raf = 0, mx = 0, my = 0;
    const turn = () => { raf = 0; box.style.transform = `rotateY(${(mx * 3).toFixed(2)}deg) rotateX(${(-my * 2).toFixed(2)}deg)`; };
    if (fine && !reduced) {
      pit.addEventListener('pointermove', (e) => {
        const r = pit.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(turn);
        crew.forEach((b) => b.lookAt(e.clientX, e.clientY));
      });
      pit.addEventListener('pointerleave', () => { mx = my = 0; if (!raf) raf = requestAnimationFrame(turn); });
    }

    card.querySelectorAll<HTMLElement>('.lg-frame').forEach((f) => {
      f.addEventListener('pointerenter', () => {
        const r = f.getBoundingClientRect();
        crew.forEach((b) => b.lookAt(r.left + r.width / 2, r.top + r.height / 2));
        if (f.dataset.cap) { say(f.dataset.cap); engineer?.setMood('talk'); }
      });
      f.addEventListener('pointerleave', () => { engineer?.setMood('idle'); backT = window.setTimeout(() => { bubble.textContent = idle; }, 1200); });
    });
    host.addEventListener('click', () => {
      const hl = p.highlights ?? [];
      if (!hl.length) { engineer?.setMood('hop'); return; }
      tip = (tip + 1) % hl.length;
      say(hl[tip], 6000);
      engineer?.setMood('happy');
    });

    // the crew is only created when the garage first comes near the screen, then it switches on
    new IntersectionObserver(([en], io) => {
      if (!en.isIntersecting) return;
      if (!crew.length) {
        engineer = new Blob2D(host, looks.engineer, 150, CREW);
        crew = [engineer,
          new Blob2D(pit.querySelector<HTMLElement>('.pg-mech')!, looks.mechanic, 110, CREW),
          new Blob2D(pit.querySelector<HTMLElement>('.pg-lolly')!, looks.lollipop, 104, CREW)];
      }
      if (en.intersectionRatio > 0.4) {
        io.disconnect();
        pit.classList.add('on');
        if (!reduced) crew.forEach((b, k) => setTimeout(() => b.setMood('hop'), 500 + k * 160));
      }
    }, { threshold: [0, 0.45], rootMargin: '200px 0px' }).observe(pit);
  });
}
