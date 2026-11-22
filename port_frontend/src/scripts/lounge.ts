// Project cards: a pit-wall strip per project. All its photos in one row (always visible,
// click for full size) and a crew member at the end: dressed for the job, looks at the
// photo you hover and reads its caption; click it for the highlights.
import '../styles/lounge.css';
import { API_BASE } from '../lib/api';
import { Blob2D, DEFAULT_LOOK, type Look } from './crew/blob2d';

export type LoungePhoto = { src: string; caption?: string; fit?: 'cover' | 'contain'; w?: number; h?: number; frame?: string };
export type LoungeProject = {
  id: string; tag: string; color: string; title: string; category?: string; status?: string;
  highlights?: string[]; photos?: LoungePhoto[];
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

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
      data-cap="${esc(ph.caption)}" style="--ar: ${ar.toFixed(3)}" aria-label="${esc(ph.caption) || `Photo ${j + 1}`}">
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
      <span class="lg-sign" aria-hidden="true"><b>P${i + 1}</b>${esc(p.tag)}</span>
      <div class="lg-crew">
        <p class="lg-bubble" aria-live="polite">${esc(p.status || p.category || p.title)}</p>
        <button class="lg-blob" type="button" aria-label="${esc(p.tag)} crew member: click for highlights"></button>
      </div>
      <div class="lg-frames">${wall}</div>
      <i class="lg-kerb" aria-hidden="true"></i>
    </div>`;
}

/** Put a crew member on every strip; wire up hover, click and the hop on arrival. */
export function wakeLounges(wrap: HTMLElement, projects: LoungeProject[], base: Look) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rooms = Array.from(wrap.querySelectorAll<HTMLElement>('.lounge'));

  rooms.forEach((room) => {
    const p = projects.find((x) => x.id === room.dataset.pid);
    if (!p) return;
    const card = room.parentElement!;
    const host = room.querySelector<HTMLElement>('.lg-blob')!;
    const bubble = room.querySelector<HTMLElement>('.lg-bubble')!;
    const blob = new Blob2D(host, gearFor(p, base), 150);
    const idle = bubble.textContent ?? '';
    let backT = 0, tip = -1;
    const say = (text: string, ms = 0) => {
      clearTimeout(backT);
      bubble.textContent = text;
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
      if (ms) backT = window.setTimeout(() => { bubble.textContent = idle; }, ms);
    };
    room.addEventListener('pointermove', (e) => blob.lookAt(e.clientX, e.clientY));

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
    // hop once when the strip scrolls into view
    new IntersectionObserver(([en], io) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      if (!reduced) setTimeout(() => blob.setMood('hop'), 250);
    }, { threshold: 0.5 }).observe(room);
  });
}
