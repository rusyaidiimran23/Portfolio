// Project lounges: each project is a CSS 3D room you look straight into, furnished like a
// paddock hospitality lounge. Its photos hang as a gallery on the back wall (always visible,
// click for full size) and a crew member sits on the sofa: dressed for the job, looks at the
// photo you hover and reads its caption. The camera drifts with the cursor and with scroll.
import '../styles/lounge.css';
import { API_BASE } from '../lib/api';
import { Blob2D, DEFAULT_LOOK, type Look } from './crew/blob2d';

export type LoungePhoto = { src: string; caption?: string; fit?: 'cover' | 'contain'; w?: number; h?: number; frame?: string };
export type LoungeProject = {
  id: string; tag: string; color: string; title: string; category?: string; status?: string;
  highlights?: string[]; photos?: LoungePhoto[];
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const TILT = [-1.6, 1.2, -0.8];
const INK = '#0a0a0d';

// furniture, drawn in the blob style (ink outlines); currentColor = the project colour
const SOFA = `<svg viewBox="0 0 300 130" aria-hidden="true"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round">
  <rect x="20" y="8" width="260" height="74" rx="24" fill="#24242e"/>
  <path d="M60 22 Q150 12 240 22" fill="none" stroke="#2f2f3b" stroke-width="5"/>
  <rect x="44" y="64" width="212" height="42" rx="12" fill="#2f2f3c"/>
  <path d="M150 66 V104" stroke="#1b1b23" stroke-width="3"/>
  <rect x="4" y="46" width="48" height="74" rx="16" fill="#2a2a35"/>
  <rect x="248" y="46" width="48" height="74" rx="16" fill="#2a2a35"/>
  <rect x="44" y="104" width="212" height="9" fill="currentColor" stroke="none"/>
  <rect x="30" y="118" width="12" height="10" rx="2" fill="#111"/><rect x="258" y="118" width="12" height="10" rx="2" fill="#111"/>
</g></svg>`;
const TABLE = `<svg viewBox="0 0 200 92" aria-hidden="true"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
  <path d="M74 44 C74 14 126 14 126 44 Z" fill="#f3f3f5"/>
  <path d="M80 36 Q100 26 122 34 L122 42 L80 42 Z" fill="#14141b"/>
  <path d="M96 18 L96 44" stroke="currentColor" stroke-width="6"/>
  <rect x="140" y="28" width="20" height="18" rx="3" fill="#e6e8ee"/><path d="M160 32 q8 0 8 6 q0 6 -8 6" fill="none"/>
  <rect x="10" y="44" width="180" height="12" rx="6" fill="#2a2a35"/>
  <path d="M30 56 L24 90 M170 56 L176 90 M70 56 L68 86 M130 56 L132 86" stroke="#15151c" stroke-width="6"/>
</g></svg>`;
const PLANT = `<svg viewBox="0 0 90 170" aria-hidden="true"><g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round">
  <path d="M45 110 C20 90 6 60 10 30 C30 50 40 80 45 110Z" fill="#2f9e5b"/>
  <path d="M45 110 C70 90 84 56 80 24 C60 46 50 80 45 110Z" fill="#37b56a"/>
  <path d="M45 112 C40 70 46 30 45 6 C54 34 56 76 45 112Z" fill="#2a8c50"/>
  <path d="M20 108 H70 L64 166 H26 Z" fill="#1d1d26"/><rect x="16" y="102" width="58" height="12" rx="4" fill="#2a2a35"/>
</g></svg>`;

/** The main mascot from the Garage (Crew screen); falls back to the default ghost. */
export async function chiefLook(): Promise<Look> {
  const fallback: Look = { ...DEFAULT_LOOK, shape: 'ghost', visor: 'dark', eyes: 'pills', ears: 'headset', outfit: 'suit', color: '#f3f3f5' };
  try {
    const r = await fetch(`${API_BASE}/api/crew`);
    const m: { role: string; look: Look }[] = (await r.json()).members ?? [];
    return { ...DEFAULT_LOOK, ...(m.find((x) => x.role === 'main') ?? m[0])?.look };
  } catch { return fallback; }
}

/** Same crew shape as the main mascot, in the project's colour, kitted out for the kind of work. */
export function gearFor(p: LoungeProject, base: Look): Look {
  const look: Look = { ...base, color: p.color, outfitColor: '#14141b', helmetColor: p.color, prop: 'none', head: base.head === 'fullface' ? 'none' : base.head };
  const cat = (p.category ?? '').toLowerCase();
  if (cat.includes('field')) Object.assign(look, { outfit: 'vest', ears: 'earmuffs', prop: 'wrench' });
  else if (cat.includes('platform')) Object.assign(look, { outfit: 'jacket', ears: 'headset+antenna', eyes: 'led', visor: look.visor === 'none' ? 'dark' : look.visor });
  else if (cat.includes('ai') || cat.includes('vision')) Object.assign(look, { outfit: 'bomber', ears: 'antenna', eyes: 'led', visor: 'sunset' });
  else if (cat.includes('proposal')) Object.assign(look, { outfit: 'suit', prop: 'pitboard', ears: 'headset' });
  else look.outfit = 'suit';
  return look;
}

const frameHTML = (p: LoungeProject, ph: LoungePhoto, j: number) => {
  const ar = ph.w && ph.h ? ph.w / ph.h : 4 / 3;
  const screen = ph.fit === 'contain' && ph.frame !== 'print';
  return `<button class="ph lg-frame${screen ? ' screen' : ''}" type="button" data-pid="${esc(p.id)}" data-i="${j}"
      data-cap="${esc(ph.caption)}" style="--ar: ${ar.toFixed(3)}; --tilt: ${TILT[j % TILT.length]}deg" aria-label="${esc(ph.caption) || `Photo ${j + 1}`}">
      <img src="${esc(ph.src)}" alt="${esc(ph.caption)}" loading="lazy" />
    </button>`;
};

/** Room markup for one project. Photo frames keep the .ph/data-pid/data-i hooks the lightbox uses. */
export function loungeHTML(p: LoungeProject, i: number): string {
  const photos = (p.photos ?? []).slice(0, 3);
  const wall = photos.length
    ? photos.map((ph, j) => frameHTML(p, ph, j)).join('')
    : `<div class="lg-tv"><canvas class="case-board" data-pid="${esc(p.id)}" aria-hidden="true"></canvas></div>`;
  return `
    <div class="lounge${i % 2 ? ' flip' : ''}" data-pid="${esc(p.id)}">
      <div class="lg-room">
        <div class="lg-ceil"></div>
        <div class="lg-floor"><i class="lg-rug"></i></div>
        <div class="lg-left"></div>
        <div class="lg-right"></div>
        <div class="lg-back">
          <span class="lg-sign" aria-hidden="true"><b>P${i + 1}</b>${esc(p.tag)}</span>
          <div class="lg-frames">${wall}</div>
        </div>
        <i class="lg-lamp a"></i><i class="lg-lamp b"></i>
        <div class="lg-prop lg-plant">${PLANT}</div>
        <div class="lg-prop lg-plant r">${PLANT}</div>
        <div class="lg-prop lg-sofa">${SOFA}</div>
        <div class="lg-crew">
          <p class="lg-bubble" aria-live="polite">${esc(p.status || p.category || p.title)}</p>
          <button class="lg-blob" type="button" aria-label="${esc(p.tag)} crew member: click for highlights"></button>
        </div>
        <div class="lg-prop lg-table">${TABLE}</div>
      </div>
    </div>
    ${photos.length ? `<div class="lg-strip">${photos.map((ph, j) => frameHTML(p, ph, j)).join('')}</div>` : ''}`;
}

/** Put a crew member in every lounge; wire up camera drift, power-on, hover and click. */
export function wakeLounges(wrap: HTMLElement, projects: LoungeProject[], base: Look) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rooms = Array.from(wrap.querySelectorAll<HTMLElement>('.lounge'));
  const visible = new Set<HTMLElement>();

  // camera: drifts up/down as the room scrolls past, and towards the cursor while hovered
  const aim = (room: HTMLElement, mx = 0, my = 0) => {
    const r = room.getBoundingClientRect();
    const t = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight)); // -1 above .. 1 below
    room.style.setProperty('--px', `${50 + mx * 16}%`);
    room.style.setProperty('--py', `${38 + t * 22 + my * 10}%`);
  };
  if (!reduced) {
    let raf = 0;
    addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => visible.forEach((room) => { if (!room.matches(':hover')) aim(room); }));
    }, { passive: true });
  }

  rooms.forEach((room) => {
    const p = projects.find((x) => x.id === room.dataset.pid);
    if (!p) return;
    const card = room.parentElement!;
    const host = room.querySelector<HTMLElement>('.lg-blob')!;
    const bubble = room.querySelector<HTMLElement>('.lg-bubble')!;
    const blob = new Blob2D(host, gearFor(p, base), 140);
    const idle = bubble.textContent ?? '';
    let backT = 0, tip = -1;
    const say = (text: string, ms = 0) => {
      clearTimeout(backT);
      bubble.textContent = text;
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
      if (ms) backT = window.setTimeout(() => { bubble.textContent = idle; }, ms);
    };
    aim(room);

    room.addEventListener('pointermove', (e) => {
      blob.lookAt(e.clientX, e.clientY);
      if (reduced) return;
      const r = room.getBoundingClientRect();
      aim(room, ((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    });
    room.addEventListener('pointerleave', () => aim(room));

    // photos (on the wall and in the phone strip): look at it, read the caption
    card.querySelectorAll<HTMLElement>('.lg-frame').forEach((f) => {
      f.addEventListener('pointerenter', () => {
        const r = f.getBoundingClientRect();
        blob.lookAt(r.left + r.width / 2, r.top + r.height / 2);
        if (f.dataset.cap) { say(f.dataset.cap); blob.setMood('talk'); }
      });
      f.addEventListener('pointerleave', () => { blob.setMood('idle'); backT = window.setTimeout(() => { bubble.textContent = idle; }, 1200); });
    });
    // click the crew member: step through the highlights
    host.addEventListener('click', () => {
      const hl = p.highlights ?? [];
      if (!hl.length) { blob.setMood('hop'); return; }
      tip = (tip + 1) % hl.length;
      say(hl[tip], 6000);
      blob.setMood('happy');
    });
    // power on (neon, strips, lamps) the first time it's in view; track visibility for the camera
    let lit = false;
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting) visible.add(room); else visible.delete(room);
      if (en.isIntersecting && en.intersectionRatio > 0.45 && !lit) {
        lit = true;
        room.classList.add('on');
        if (!reduced) setTimeout(() => blob.setMood('hop'), 500);
      }
    }, { threshold: [0, 0.5] }).observe(room);
  });
}
