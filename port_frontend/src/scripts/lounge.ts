// Project pit garages: each project is its team's F1 garage on a night-race pit lane, a CSS
// 3D box you look straight into. Photos run on the screens on the back wall (always visible,
// click for full size), the stack hangs as sponsor boards, the car sits on stands with tyre
// blankets, the crew is around it. The race engineer (your mascot, in a team jacket and
// headset) does the talking: reads the caption of the photo you hover, and the highlights
// when clicked. The camera drifts with the cursor and with scroll.
import '../styles/lounge.css';
import { API_BASE } from '../lib/api';
import { Blob2D, DEFAULT_LOOK, type Look } from './crew/blob2d';

export type LoungePhoto = { src: string; caption?: string; fit?: 'cover' | 'contain'; w?: number; h?: number; frame?: string };
export type LoungeProject = {
  id: string; tag: string; color: string; title: string; category?: string; status?: string; client?: string; year?: string;
  highlights?: string[]; stack?: string[]; photos?: LoungePhoto[];
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const INK = '#0a0a0d';

// the car, front-on, nose towards you: currentColor = team colour
const CAR = `<svg viewBox="0 0 380 172" aria-hidden="true"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
  <rect x="98" y="12" width="184" height="16" rx="3" fill="#15151c"/>
  <rect x="94" y="8" width="10" height="46" rx="2" fill="#15151c"/><rect x="276" y="8" width="10" height="46" rx="2" fill="#15151c"/>
  <rect x="60" y="62" width="48" height="76" rx="13" fill="#15151c"/><rect x="272" y="62" width="48" height="76" rx="13" fill="#15151c"/>
  <path d="M150 98 L164 42 Q190 26 216 42 L230 98 Z" fill="currentColor"/>
  <ellipse cx="190" cy="47" rx="12" ry="8" fill="${INK}"/>
  <path d="M96 122 Q100 80 150 76 L230 76 Q280 80 284 122 Z" fill="currentColor"/>
  <path d="M110 112 Q150 96 176 96 M270 112 Q230 96 204 96" fill="none" stroke="#f3f3f5" stroke-width="5"/>
  <rect x="134" y="70" width="18" height="9" rx="3" fill="#15151c"/><rect x="228" y="70" width="18" height="9" rx="3" fill="#15151c"/>
  <path d="M158 86 Q190 54 222 86" fill="none" stroke="${INK}" stroke-width="8"/><path d="M190 60 V88" stroke-width="7"/>
  <path d="M172 86 L208 86 L200 138 L180 138 Z" fill="currentColor"/>
  <text x="190" y="118" text-anchor="middle" font-size="15" font-weight="900" font-style="italic" font-family="Titillium Web, sans-serif" fill="#fff" stroke="none">07</text>
  <rect x="18" y="72" width="70" height="88" rx="16" fill="#15151c"/><rect x="292" y="72" width="70" height="88" rx="16" fill="#15151c"/>
  <rect x="14" y="68" width="78" height="72" rx="14" fill="currentColor"/><rect x="288" y="68" width="78" height="72" rx="14" fill="currentColor"/>
  <path d="M24 104 H82 M298 104 H356" stroke="#f3f3f5" stroke-width="5"/>
  <path d="M58 140 H322 L334 154 H46 Z" fill="#15151c"/>
  <path d="M70 146 H310" stroke="currentColor" stroke-width="5"/>
  <rect x="40" y="128" width="12" height="28" rx="2" fill="#15151c"/><rect x="328" y="128" width="12" height="28" rx="2" fill="#15151c"/>
  <path d="M178 154 L172 170 H208 L202 154" fill="#c9ccd6"/>
  <rect x="30" y="158" width="46" height="12" rx="2" fill="#c9ccd6"/><rect x="304" y="158" width="46" height="12" rx="2" fill="#c9ccd6"/>
</g></svg>`;
// a stack of tyres in their blankets
const TYRES = `<svg viewBox="0 0 74 132" aria-hidden="true"><g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round">
  ${[0, 1, 2].map((k) => `<rect x="2" y="${4 + k * 42}" width="70" height="40" rx="10" fill="currentColor"/><path d="M8 ${24 + k * 42} H66" stroke="#f3f3f5" stroke-width="4"/>`).join('')}
</g></svg>`;
// tool trolley with a little monitor on top
const TROLLEY = `<svg viewBox="0 0 110 132" aria-hidden="true"><g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round">
  <rect x="34" y="2" width="44" height="30" rx="3" fill="#15151c"/><rect x="39" y="7" width="34" height="20" fill="#0d3b36"/><path d="M56 32 V42" />
  <rect x="6" y="42" width="98" height="78" rx="6" fill="currentColor"/>
  <path d="M12 64 H98 M12 84 H98 M12 102 H98" stroke="${INK}" stroke-width="3"/>
  <path d="M46 54 H64 M46 74 H64 M46 93 H64 M46 111 H64" stroke="#f3f3f5" stroke-width="4"/>
  <circle cx="20" cy="126" r="5" fill="#15151c"/><circle cx="90" cy="126" r="5" fill="#15151c"/>
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
      <img src="${esc(ph.src)}" alt="${esc(ph.caption)}" loading="lazy" />
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
      <i class="pg-glare l" aria-hidden="true"></i><i class="pg-glare r" aria-hidden="true"></i>
    </div>
    ${photos.length ? `<div class="pg-strip">${photos.map((ph, j) => frameHTML(p, ph, j)).join('')}</div>` : ''}`;
}

/** Staff every garage; wire up camera drift, switch-on, hover and click. */
export function wakeLounges(wrap: HTMLElement, projects: LoungeProject[], base: Look) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pits = Array.from(wrap.querySelectorAll<HTMLElement>('.pit'));
  const visible = new Set<HTMLElement>();

  // camera: drifts as the garage scrolls past, and towards the cursor while hovered
  const aim = (pit: HTMLElement, mx = 0, my = 0) => {
    const r = pit.getBoundingClientRect();
    const t = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / innerHeight));
    pit.style.setProperty('--px', `${50 + mx * 14}%`);
    pit.style.setProperty('--py', `${34 + t * 18 + my * 8}%`);
  };
  if (!reduced) {
    let raf = 0;
    addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => visible.forEach((pit) => { if (!pit.matches(':hover')) aim(pit); }));
    }, { passive: true });
  }

  pits.forEach((pit) => {
    const p = projects.find((x) => x.id === pit.dataset.pid);
    if (!p) return;
    const card = pit.parentElement!;
    const looks = crewFor(p, base);
    const host = pit.querySelector<HTMLElement>('.pg-eng .lg-blob')!;
    const bubble = pit.querySelector<HTMLElement>('.lg-bubble')!;
    const engineer = new Blob2D(host, looks.engineer, 150);
    const mechanic = new Blob2D(pit.querySelector<HTMLElement>('.pg-mech')!, looks.mechanic, 110);
    const lollipop = new Blob2D(pit.querySelector<HTMLElement>('.pg-lolly')!, looks.lollipop, 104);
    const crew = [engineer, mechanic, lollipop];
    const idle = bubble.textContent ?? '';
    let backT = 0, tip = -1;
    const say = (text: string, ms = 0) => {
      clearTimeout(backT);
      bubble.textContent = text;
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
      if (ms) backT = window.setTimeout(() => { bubble.textContent = idle; }, ms);
    };
    aim(pit);

    pit.addEventListener('pointermove', (e) => {
      crew.forEach((b) => b.lookAt(e.clientX, e.clientY));
      if (reduced) return;
      const r = pit.getBoundingClientRect();
      aim(pit, ((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2);
    });
    pit.addEventListener('pointerleave', () => aim(pit));

    // screens (and the phone strip): the crew looks at it, the engineer reads the caption
    card.querySelectorAll<HTMLElement>('.lg-frame').forEach((f) => {
      f.addEventListener('pointerenter', () => {
        const r = f.getBoundingClientRect();
        crew.forEach((b) => b.lookAt(r.left + r.width / 2, r.top + r.height / 2));
        if (f.dataset.cap) { say(f.dataset.cap); engineer.setMood('talk'); }
      });
      f.addEventListener('pointerleave', () => { engineer.setMood('idle'); backT = window.setTimeout(() => { bubble.textContent = idle; }, 1200); });
    });
    host.addEventListener('click', () => {
      const hl = p.highlights ?? [];
      if (!hl.length) { engineer.setMood('hop'); return; }
      tip = (tip + 1) % hl.length;
      say(hl[tip], 6000);
      engineer.setMood('happy');
    });
    // switch the garage on the first time it's properly in view
    let lit = false;
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting) visible.add(pit); else visible.delete(pit);
      if (en.isIntersecting && en.intersectionRatio > 0.45 && !lit) {
        lit = true;
        pit.classList.add('on');
        if (!reduced) crew.forEach((b, k) => setTimeout(() => b.setMood('hop'), 500 + k * 160));
      }
    }, { threshold: [0, 0.5] }).observe(pit);
  });
}
