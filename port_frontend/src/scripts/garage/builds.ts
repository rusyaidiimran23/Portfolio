// Garage screen: the Forza-style vehicle grid, each build's card, and the build log editor.
import { initBoard } from '../ledboard';
import { scrollFx } from '../scrollfx';
import { swipeable } from '../swipe';
import { api, confirmTap, esc, expire, localNow, reduced } from './shared';
import type { Build, LogItem, Photo, Photos } from './types';

let selectedId = ''; // vehicle whose card is shown below ('' = none yet)

const hp = (b: Build) => b.hp ?? Number((b.power ?? '').match(/(\d+)\s*hp/i)?.[1] ?? 0);
const isRunning = (b: Build) => /run|done|complete/i.test(b.status ?? '');
const lampOf = (b: Build) => (b.sold ? 'var(--f1red)' : isRunning(b) ? 'var(--green)' : 'var(--amber)');

/** Forza-style performance class (just for fun). */
export function perfClass(b: Build): { cls: string; pi: string; color: string } {
  const h = hp(b);
  if (!h) return { cls: '?', pi: '---', color: '#5a5a66' };
  // like Forza: graded on power-to-weight (hp per tonne), not raw power. Log curve calibrated
  // to real 0-100 times: ~13 s -> D 400, ~6 s -> C, ~5 s -> B, ~3.5 s -> A 760
  const pi = b.weight_kg
    ? Math.max(100, Math.min(999, Math.round(-557 + 219.5 * Math.log(h / (b.weight_kg / 1000)))))
    : Math.min(999, Math.round(100 + h * 8));
  const [cls, color] =
    pi > 900 ? ['S2', '#3d7bff'] : pi > 800 ? ['S1', '#b14cff'] : pi > 700 ? ['A', '#ff2a1a']
    : pi > 600 ? ['B', '#ff7a1a'] : pi > 500 ? ['C', '#ffd400'] : ['D', '#39c5ff'];
  return { cls, pi: String(pi), color };
}

function renderGrid(builds: Build[], photos: Photos) {
  document.getElementById('fz-count')!.textContent = `${String(builds.length).padStart(2, '0')} VEHICLES`;
  const grid = document.getElementById('fz-grid')!;
  grid.innerHTML = builds.map((b) => {
    // card cover: photos/<id>/cover.jpg if there is one, else the first photo's thumbnail
    const cover = photos._covers?.[b.id];
    const first = photos[b.id]?.[0];
    const img = cover ?? first?.src.replace(/\.jpg$/, '-t.jpg');
    const pc = perfClass(b);
    const [make, ...model] = b.name.split(' ');
    const year = b.year ?? (/^\d{4}$/.test(b.chassis ?? '') ? b.chassis : '');
    // bars on a common scale so the vehicles compare honestly
    const stats: [string, number, string][] = [
      ['POWER', Math.min(1, hp(b) / 250), hp(b) ? `${b.estimate ? '~' : ''}${hp(b)} HP` : '—'],
      ['TORQUE', Math.min(1, (b.torque_nm ?? 0) / 300), b.torque_nm ? `${b.estimate ? '~' : ''}${b.torque_nm} NM` : '—'],
    ];
    return `
      <button class="fz-card${b.id === selectedId ? ' on' : ''}" type="button" data-pick="${esc(b.id)}" style="--c: ${esc(b.color)}" aria-pressed="${b.id === selectedId}">
        <span class="fz-photo">${img ? `<img src="${esc(img)}"${cover ? ' class="cover"' : ''} alt="" loading="lazy" />` : `<span class="fz-ph display">${esc(b.tag)}</span>`}
          ${b.sold ? '<span class="fz-sold">SOLD</span>' : ''}
          <span class="fz-class" style="--k: ${pc.color}"><b>${pc.cls}</b><em>${pc.pi}</em></span>
        </span>
        <span class="fz-body">
          <span class="fz-make mono">${esc(make)}${year ? ` · ${esc(year)}` : ''}</span>
          <span class="fz-model display">${esc(model.join(' ') || b.name)}</span>
          <span class="fz-status mono"><i style="background: ${lampOf(b)}"></i>${esc(b.status ?? '')}</span>
          <span class="fz-stats">${stats.map(([k, v, t]) => `<span><em>${k}</em><span class="fz-bar"><i style="--v: ${v}"></i></span><b class="mono">${t}</b></span>`).join('')}</span>
        </span>
        <span class="fz-cta">${b.id === selectedId ? 'Selected ✓' : 'Open ▸'}</span>
      </button>`;
  }).join('');
}

/** Show only the chosen vehicle's card and bring it into view. */
function choose(id: string) {
  selectedId = id;
  document.querySelectorAll<HTMLElement>('.build').forEach((c) => { c.hidden = c.id !== `build-${id}`; });
  document.querySelectorAll<HTMLElement>('.fz-card').forEach((c) => {
    const on = c.dataset.pick === id;
    c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on));
    c.querySelector('.fz-cta')!.textContent = on ? 'Selected ✓' : 'Open ▸';
  });
  const card = document.getElementById(`build-${id}`);
  if (card) {
    card.classList.remove('arrive'); void card.offsetWidth; card.classList.add('arrive');
    card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    window.dispatchEvent(new Event('scroll')); // let scroll animations measure the newly shown card
  }
}

function buildCard(b: Build, photos: Photos): string {
  const ph: Photo[] = (photos[b.id] ?? []).slice(0, 7); // private page: up to 7 per build
  // no gallery yet but there is a card cover: show that instead of "photos coming soon"
  const coverSrc = photos._covers?.[b.id];
  if (!ph.length && coverSrc) ph.push({ src: coverSrc, caption: b.name });
  const media = ph.length
    ? ph.map((p, j) => `<figure class="b-slide${j === 0 ? ' on' : ''}" data-cap="${esc(p.caption)}"><img src="${esc(p.src)}" alt="${esc(p.caption)}" loading="lazy" /></figure>`).join('')
      + `<span class="b-cap">${esc(ph[0].caption)}</span>`
    : `<div class="b-empty"><span class="display">${esc(b.short ?? b.tag)}</span><em class="mono">Photos coming soon</em></div>`;
  const running = isRunning(b);
  const stamp = (e: LogItem) => `${e.date} ${e.time ?? ''}`;
  const log = [...(b.log ?? [])].sort((x, y) => stamp(y).localeCompare(stamp(x))); // newest first
  const longReview = (b.review?.body ?? []).join(' ').length > 240;
  return `
    <article class="build" id="build-${esc(b.id)}" style="--c: ${esc(b.color)}"${b.id === selectedId ? '' : ' hidden'}>
      <button class="sel-back" type="button" data-back>▲ Change vehicle</button>
      <div class="b-sign" data-fx="rise"><canvas data-build="${esc(b.id)}" role="img" aria-label="${esc(b.name)} — ${esc(b.status)}"></canvas></div>
      <div class="b-media" data-fx="wipe">${media}${b.sold ? `<div class="sold-banner" role="note"><span class="lcd-text">SOLD</span><em>Former build — moved on to the next one</em></div>` : ''}</div>
      <div class="b-body">
        <div class="b-top" data-fx="rise" data-d="150">
          <span class="b-tag">${esc(b.tag)}</span>
          <span class="b-status lcd-text" style="--c: var(${b.sold ? '--f1red' : running ? '--green' : '--amber'})"><i></i>${esc(b.status)}</span>
        </div>
        <h2 class="display" data-fx="left" data-d="220">${esc(b.name)}</h2>
        <div class="tiles" data-fx="rise" data-d="300">
          <div class="tile lcd"><span>${b.chassis ? 'CHASSIS · YEAR' : 'MODEL YEAR'}</span><b class="lcd-text">${esc([b.chassis, b.year].filter(Boolean).join(' · ') || '—')}</b></div>
          <div class="tile lcd"><span>POWER</span><b class="lcd-text">${esc(b.power || '—')}</b></div>
          <div class="tile lcd"><span>TORQUE</span><b class="lcd-text">${esc(b.torque || '—')}</b></div>
        </div>
        ${b.review?.body?.length ? `
        <div class="review${longReview ? '' : ' open'}" data-fx="rise" data-d="330">
          <p class="eyebrow">Rider's notes${b.review.title ? ` — ${esc(b.review.title)}` : ''}</p>
          <div class="rv-body">${b.review.body.map((para) => `<p>${esc(para)}</p>`).join('')}</div>
          ${longReview ? `<button class="rv-toggle" type="button" data-review>Read full review ▸</button>` : ''}
        </div>` : ''}
        <div class="log-bar" data-fx="rise" data-d="360">
          <p class="eyebrow log-head">Build log — latest first</p>
          <button class="add-btn" type="button" data-add="${esc(b.id)}">+ Add log</button>
        </div>
        <form class="log-form" data-build="${esc(b.id)}" hidden>
          <input name="when" type="datetime-local" required />
          <textarea name="note" rows="2" maxlength="600" placeholder="What did you do to it?" required></textarea>
          <div class="lf-actions">
            <button class="btn btn-primary" type="submit">Save ▸</button>
            <button class="btn" type="button" data-cancel>Cancel</button>
            <span class="lf-msg lcd-text"></span>
          </div>
        </form>
        <ol class="log" data-native-scroll>${log.length ? log.map((e, j) => `
          <li data-fx="rise" data-d="${400 + Math.min(j, 5) * 80}">
            <span class="d lcd-text">${esc(e.date)}${e.time ? `<em>${esc(e.time)}</em>` : ''}</span>
            <span class="n">${esc(e.note)}</span>
            <button class="del" type="button" title="Delete entry" aria-label="Delete entry"
              data-del="${esc(b.id)}" data-date="${esc(e.date)}" data-time="${esc(e.time ?? '')}" data-note="${esc(e.note)}">✕</button>
          </li>`).join('') : '<li class="empty"><span class="n">No entries yet — add the first one.</span></li>'}
        </ol>
      </div>
    </article>`;
}

/** Draw the vehicle grid and every build's card (only the selected one is visible). */
export function renderBuilds(builds: Build[], photos: Photos) {
  const wrap = document.getElementById('builds')!;
  wrap.innerHTML = builds.map((b) => buildCard(b, photos)).join('');

  // LED sign on top of every vehicle: pixel art, name, chassis, scrolling status + specs
  wrap.querySelectorAll<HTMLCanvasElement>('canvas[data-build]').forEach((cv) => {
    const b = builds.find((x) => x.id === cv.dataset.build);
    if (b) initBoard(cv, [{
      scene: b.scene, tag: b.tag, color: b.color,
      light: b.sold ? 'red' : isRunning(b) ? 'green' : 'amber',
      line: [b.name, b.year, b.chassis && `CHASSIS ${b.chassis}`, b.status, b.power, b.torque, b.log?.length ? `${b.log.length} LOG ENTRIES` : ''].filter(Boolean).join(' * ').toUpperCase(),
    }], undefined, { banner: true }).show(0);
  });

  // photo slides: diagonal wipe every 5s; swipe / drag sideways to flip through
  wrap.querySelectorAll<HTMLElement>('.b-media').forEach((m) => {
    const slides = Array.from(m.querySelectorAll<HTMLElement>('.b-slide'));
    const cap = m.querySelector('.b-cap');
    if (slides.length < 2) return;
    let at = 0, touched = 0;
    const go = (i: number, dir: 1 | -1 = 1) => {
      const from = at; at = (i + slides.length) % slides.length;
      m.classList.toggle('rev', dir < 0); void m.offsetWidth;
      slides.forEach((s, j) => { s.classList.toggle('prev', j === from); s.classList.toggle('on', j === at); });
      if (cap) cap.textContent = slides[at].dataset.cap ?? '';
    };
    swipeable(m, (dir) => { touched = Date.now(); go(at + dir, dir); });
    if (!reduced) setInterval(() => { if (Date.now() - touched > 6000) go(at + 1); }, 5000);
  });

  renderGrid(builds, photos);
  scrollFx(wrap);
}

async function logRequest(method: 'POST' | 'DELETE', id: string, body: LogItem): Promise<boolean> {
  const res = await api(method, `/api/garage/${encodeURIComponent(id)}/log`, body);
  if (res.status === 401) expire();
  return res.ok;
}

/**
 * Wire up the grid and the build cards once. `reload` refetches the garage
 * after a log entry is saved or deleted.
 */
export function initBuilds(reload: () => Promise<unknown>) {
  // one listener for the grid (survives re-renders)
  document.getElementById('fz-grid')!.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
    if (card) choose(card.dataset.pick!);
  });

  // build log editing: + Add log / Save / Cancel / delete (✕, tap twice)
  const buildsEl = document.getElementById('builds')!;
  buildsEl.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const add = t.closest<HTMLElement>('[data-add]');
    if (add) {
      const form = buildsEl.querySelector<HTMLFormElement>(`.log-form[data-build="${add.dataset.add}"]`)!;
      form.hidden = !form.hidden;
      if (!form.hidden) {
        (form.elements.namedItem('when') as HTMLInputElement).value = localNow();
        (form.elements.namedItem('note') as HTMLTextAreaElement).focus();
      }
      return;
    }
    if (t.closest('[data-cancel]')) { (t.closest('form') as HTMLFormElement).hidden = true; return; }
    if (t.closest('[data-back]')) { document.getElementById('select')!.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); return; }
    const rv = t.closest<HTMLButtonElement>('[data-review]');
    if (rv) {
      const open = rv.closest('.review')!.classList.toggle('open');
      rv.textContent = open ? 'Show less ▴' : 'Read full review ▸';
      return;
    }
    const del = t.closest<HTMLButtonElement>('[data-del]');
    if (del && confirmTap(del)) {
      del.disabled = true;
      const ok = await logRequest('DELETE', del.dataset.del!, { date: del.dataset.date!, time: del.dataset.time ?? '', note: del.dataset.note! });
      if (ok) await reload();
    }
  });

  buildsEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const msg = form.querySelector('.lf-msg')!;
    const when = (form.elements.namedItem('when') as HTMLInputElement).value; // YYYY-MM-DDTHH:MM
    const note = (form.elements.namedItem('note') as HTMLTextAreaElement).value.trim();
    if (!when || !note) { msg.textContent = 'DATE + NOTE NEEDED'; return; }
    msg.textContent = 'SAVING…';
    const [date, time = ''] = when.split('T');
    try {
      const ok = await logRequest('POST', form.dataset.build!, { date, time: time.slice(0, 5), note });
      if (!ok) { msg.textContent = 'COULD NOT SAVE'; return; }
      await reload();
    } catch {
      msg.textContent = 'NO SIGNAL — BACKEND OFFLINE?';
    }
  });
}
