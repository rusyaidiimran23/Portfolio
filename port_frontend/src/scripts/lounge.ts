// Project lounges: each project is a room in its colour. All its photos hang on the back
// wall as framed prints (always visible, click for full size) and a crew member stands in
// the room: dressed for the job, looks at whichever photo you hover and reads its caption.
import { API_BASE } from '../lib/api';
import { Blob2D, DEFAULT_LOOK, type Look } from './crew/blob2d';

export type LoungePhoto = { src: string; caption?: string; fit?: 'cover' | 'contain'; w?: number; h?: number; frame?: string };
export type LoungeProject = {
  id: string; tag: string; color: string; title: string; category?: string; status?: string;
  highlights?: string[]; photos?: LoungePhoto[];
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const TILT = [-2.2, 1.6, -1.1, 2];

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

/** Room markup for one project. Photo frames keep the .ph/data-pid/data-i hooks the lightbox uses. */
export function loungeHTML(p: LoungeProject, i: number): string {
  const photos = (p.photos ?? []).slice(0, 3);
  const shot = (ph: LoungePhoto) => ph.fit === 'contain' && ph.frame !== 'print';
  const frames = photos.length
    ? photos.map((ph, j) => {
      const ar = ph.w && ph.h ? ph.w / ph.h : 4 / 3;
      return `<button class="ph lg-frame${shot(ph) ? ' screen' : ''}" type="button" data-pid="${esc(p.id)}" data-i="${j}"
          data-cap="${esc(ph.caption)}" style="--ar: ${ar.toFixed(3)}; --tilt: ${TILT[j % TILT.length]}deg" aria-label="${esc(ph.caption) || `Photo ${j + 1}`}">
          <img src="${esc(ph.src)}" alt="${esc(ph.caption)}" loading="lazy" />
        </button>`;
    }).join('')
    : `<div class="lg-tv"><canvas class="case-board" data-pid="${esc(p.id)}" aria-hidden="true"></canvas></div>`;
  return `
    <div class="lounge${i % 2 ? ' flip' : ''}" data-pid="${esc(p.id)}">
      <span class="lg-sign" aria-hidden="true"><b>P${i + 1}</b>${esc(p.tag)}</span>
      <div class="lg-frames">${frames}</div>
      <div class="lg-crew">
        <p class="lg-bubble" aria-live="polite">${esc(p.status || p.category || p.title)}</p>
        <button class="lg-blob" type="button" aria-label="${esc(p.tag)} crew member: click for highlights"></button>
      </div>
      <div class="lg-floor" aria-hidden="true"></div>
    </div>`;
}

/** Put a crew member in every lounge and wire up the hover / click / scroll behaviour. */
export function wakeLounges(wrap: HTMLElement, projects: LoungeProject[], base: Look) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  wrap.querySelectorAll<HTMLElement>('.lounge').forEach((room) => {
    const p = projects.find((x) => x.id === room.dataset.pid);
    if (!p) return;
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

    // eyes follow the cursor around the room; a hovered photo gets a look and its caption read out
    room.addEventListener('pointermove', (e) => blob.lookAt(e.clientX, e.clientY));
    room.querySelectorAll<HTMLElement>('.lg-frame').forEach((f) => {
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
    // hop once when the room scrolls into view
    new IntersectionObserver(([en], io) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      if (!reduced) setTimeout(() => blob.setMood('hop'), 250);
    }, { threshold: 0.5 }).observe(room);
  });
}
