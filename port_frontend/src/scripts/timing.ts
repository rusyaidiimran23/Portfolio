// The Work section as an F1 TV timing screen: a timing tower on the left (P1..Pn, team-colour
// bars, status in the gap column) and a broadcast panel on the right (the project's photos with
// a TV lower-third, then the story, highlights and stack). One project at a time, everything
// readable without extra clicks. The host page drives selection (it is shared with the hero map)
// through show(i); the tower reports clicks through onPick.
import '../styles/timing.css';
import { initBoard, type BoardApi } from './ledboard';

export type TimingPhoto = { src: string; caption?: string; fit?: 'cover' | 'contain'; w?: number; h?: number; frame?: string };
export type TimingProject = {
  id: string; tag: string; color: string; title: string; scene: string; marquee?: string;
  client?: string; location?: string; year?: string; category?: string; role?: string; status?: string;
  summary?: string; highlights?: string[]; stack?: string[]; photos?: TimingPhoto[];
};

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const two = (n: number) => String(n).padStart(2, '0');
const COMPOUNDS: [string, string][] = [['S', '#e10600'], ['M', '#ffd400'], ['H', '#efefef']];
/** "Live · 2 more stations coming" -> "LIVE": the short bit for the tower's gap column. */
const short = (p: TimingProject) => (p.status?.split('·')[0].trim() || p.year || p.category || '').toUpperCase();

export function initTiming(host: HTMLElement, projects: TimingProject[], opts: { onPick: (i: number) => void; autoMs: number }) {
  host.innerHTML = `
    <div class="tv-tower" role="tablist" aria-label="Projects">
      <div class="tv-head"><span class="lcd-text tv-lap">LAP <b>01</b>/${two(projects.length)}</span><span class="mono">Selected work</span></div>
      ${projects.map((p, i) => `
        <button class="tv-row" type="button" role="tab" data-i="${i}" style="--c: ${esc(p.color)}" aria-controls="tv-stage">
          <b class="tv-pos">${i + 1}</b><i class="tv-bar"></i><span class="tv-tag">${esc(p.tag)}</span>
          <span class="tv-gap mono">${esc(short(p))}</span><i class="tv-prog"></i>
        </button>`).join('')}
      <div class="tv-foot mono"><button class="tv-auto" type="button" aria-pressed="true">● Auto</button><span><kbd>Q</kbd><kbd>E</kbd> or click</span></div>
    </div>
    <div class="tv-stage" id="tv-stage" role="tabpanel">
      <div class="tv-media">
        <div class="tv-shots"></div>
        <canvas class="tv-board" aria-hidden="true" hidden></canvas>
        <div class="tv-lower"><span class="tv-ltag"></span><div><strong class="tv-ltitle"></strong><span class="tv-lsub mono"></span></div></div>
        <div class="tv-thumbs"></div>
      </div>
      <div class="tv-body">
        <div class="tv-story">
          <p class="tv-status mono"></p>
          <p class="tv-sum"></p>
          <dl class="tv-meta mono"></dl>
        </div>
        <div class="tv-facts">
          <ul class="tv-hl"></ul>
          <div class="tv-stack"></div>
        </div>
      </div>
    </div>`;

  const $ = <T extends Element = HTMLElement>(s: string) => host.querySelector<T>(s)!;
  const rows = Array.from(host.querySelectorAll<HTMLElement>('.tv-row'));
  const stage = $('.tv-stage'), shots = $('.tv-shots'), thumbs = $('.tv-thumbs');
  const boardCanvas = $<HTMLCanvasElement>('.tv-board');
  host.style.setProperty('--auto', `${opts.autoMs}ms`);

  // LED board for projects without photos (all screens in one board; show(i) picks)
  let board: BoardApi | null = null;
  const boardFor = () => board ??= initBoard(boardCanvas, projects.map((p, i) => ({
    scene: p.scene, tag: p.tag, color: p.color, line: p.marquee || p.title, sub: `P${i + 1} LAP ${two(i + 1)}/${two(projects.length)}`,
  })));

  let at = -1;
  function photoHTML(p: TimingProject, ph: TimingPhoto, j: number, main: boolean) {
    const screen = ph.fit === 'contain' && ph.frame !== 'print';
    return `<button class="ph ${main ? 'tv-shot' : 'tv-thumb'}${screen ? ' screen' : ''}" type="button" data-pid="${esc(p.id)}" data-i="${j}"
        aria-label="${esc(ph.caption) || `Photo ${j + 1}`}${main ? ': open full size' : ''}"><img src="${esc(ph.src)}" alt="${esc(ph.caption)}" ${main ? '' : 'loading="lazy"'} /></button>`;
  }
  function showPhoto(p: TimingProject, j: number) {
    const photos = p.photos ?? [];
    const old = shots.querySelector('.tv-shot');
    shots.insertAdjacentHTML('beforeend', photoHTML(p, photos[j], j, true));
    const fresh = shots.lastElementChild as HTMLElement;
    requestAnimationFrame(() => fresh.classList.add('in'));
    if (old) setTimeout(() => old.remove(), 600);
    thumbs.querySelectorAll('.tv-thumb').forEach((t, k) => t.classList.toggle('on', k === j));
    $('.tv-lsub').textContent = photos[j]?.caption || [p.client, p.location, p.year].filter(Boolean).join(' · ');
  }

  function show(i: number) {
    if (i === at || !projects[i]) return;
    at = i;
    const p = projects[i];
    host.style.setProperty('--c', p.color);
    rows.forEach((r, k) => {
      r.setAttribute('aria-selected', String(k === i));
      const prog = r.querySelector<HTMLElement>('.tv-prog')!;
      prog.style.animation = 'none'; void prog.offsetWidth; prog.style.animation = '';
    });
    $('.tv-lap b').textContent = two(i + 1);
    stage.classList.remove('swap'); void stage.offsetWidth; stage.classList.add('swap');

    // media: photos with thumbnails, or the project's LED scene
    const photos = (p.photos ?? []).slice(0, 3);
    thumbs.innerHTML = photos.length > 1 ? photos.map((ph, j) => photoHTML(p, ph, j, false)).join('') : '';
    if (photos.length) { boardCanvas.hidden = true; shots.hidden = false; showPhoto(p, 0); }
    else { shots.hidden = true; shots.innerHTML = ''; boardCanvas.hidden = false; boardFor().show(i); }

    $('.tv-ltag').textContent = p.tag;
    $('.tv-ltitle').textContent = p.title;
    if (!photos.length) $('.tv-lsub').textContent = [p.client, p.location, p.year].filter(Boolean).join(' · ');
    $('.tv-status').textContent = [p.category, p.status].filter(Boolean).join('  ·  ');
    $('.tv-sum').textContent = p.summary ?? '';
    $('.tv-meta').innerHTML = [['Client', p.client], ['Where', p.location], ['Year', p.year], ['Role', p.role]]
      .filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
    $('.tv-hl').innerHTML = (p.highlights ?? []).map((h) => `<li>${esc(h)}</li>`).join('');
    $('.tv-stack').innerHTML = (p.stack ?? []).map((t, j) =>
      `<span class="tv-tyre" style="--compound: ${COMPOUNDS[j % 3][1]}"><i>${COMPOUNDS[j % 3][0]}</i>${esc(t)}</span>`).join('');
  }

  // tower clicks, thumbnails, auto toggle
  host.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const row = el.closest<HTMLElement>('.tv-row');
    if (row) { opts.onPick(Number(row.dataset.i)); return; }
    const thumb = el.closest<HTMLElement>('.tv-thumb');
    if (thumb) { e.stopPropagation(); showPhoto(projects[at], Number(thumb.dataset.i)); }
  }, true);
  const autoBtn = $('.tv-auto');
  const setAuto = (on: boolean) => { host.classList.toggle('manual', !on); autoBtn.setAttribute('aria-pressed', String(on)); autoBtn.textContent = on ? '● Auto' : '▶ Auto'; };

  return {
    show,
    setAuto,
    onAutoToggle(fn: () => void) { autoBtn.addEventListener('click', fn); },
    get index() { return at; },
  };
}
