// Track Day screen: lazy-susan carousel of track maps, PB board, ghost lap, session log.
import { spinner } from '../spin';
import { MAPS } from './maps';
import { renderTelemetry } from './telemetry';
import { api, confirmTap, esc, expire, fmtLap, lapSecs, localNow, reduced } from './shared';
import type { Build, Session, Track, TrackDay } from './types';

const fmtDelta = (d: number) => (d === 0 ? 'PB' : `+${d.toFixed(3)}`);
// lap-by-lap bars for sessions imported with lap data: taller = faster, purple = best lap
function lapBars(laps: number[]): string {
  const best = Math.min(...laps), worst = Math.max(...laps);
  return `<span class="ts-laps" aria-label="Lap times">${laps.map((l, i) => {
    const h = worst === best ? 100 : 35 + 65 * (worst - l) / (worst - best);
    const cls = l === best ? 'best' : l - best < 1 ? 'near' : '';
    return `<i class="${cls}" style="--h: ${h.toFixed(0)}%" title="Lap ${i + 1}: ${fmtLap(l)}"><b>${fmtLap(l)}</b></i>`;
  }).join('')}</span>`;
}

let tdData: TrackDay | null = null;
let tdBuilds: Build[] = [];
let tdSel = '';
let teleDate = ''; // which session's telemetry is showing; '' = the latest
let ghostRaf = 0;
let tdStage: HTMLElement;
let trackSpin: ReturnType<typeof spinner>;

/** Replay the selected track's race-line draw and ghost lap (when the screen is shown again). */
export function replayTrack() {
  if (tdSel) showTrack(tdSel);
}

export function renderTrackday(td: TrackDay | undefined, builds: Build[]) {
  if (!td) return;
  // a planned track counts as ridden as soon as it has a session
  td.tracks.forEach((t) => { if (td.sessions.some((s) => s.track === t.id)) t.status = 'active'; });
  tdData = td; tdBuilds = builds;
  if (!tdSel || !td.tracks.some((t) => t.id === tdSel)) tdSel = td.tracks[0]?.id ?? '';
  const ridden = td.tracks.filter((t) => t.status === 'active').length;
  document.getElementById('td-count')!.textContent = `${String(ridden).padStart(2, '0')} TRACKS · ${String(td.sessions.length).padStart(2, '0')} SESSIONS`;
  document.getElementById('td-tabs')!.innerHTML = td.tracks.map((t) => {
    const best = bestOf(t.id);
    return `<button class="td-tab" type="button" role="tab" data-track="${esc(t.id)}" style="--c: ${esc(t.color)}" aria-selected="${t.id === tdSel}">
      <span class="tt-name">${esc(t.alias ? `${t.name} · ${t.alias}` : t.name)}</span>
      <span class="tt-sub mono">${t.status === 'planned' ? 'UPCOMING' : best ? `PB ${esc(best.best)}` : t.note ? 'RIDDEN · NO TIME YET' : 'NO LAPS YET'}</span>
    </button>`;
  }).join('');
  buildCarousel(td);
  showTrack(tdSel);
}

// --- lazy-susan carousel ---------------------------------------------------------
// track i rides at angle a + i*step on the orbit; it's at the front when a = -i*step
const stepDeg = () => 360 / Math.max(1, tdData?.tracks.length ?? 1);
const frontAngle = (i: number, from: number) => {
  const want = -i * stepDeg();
  return want + Math.round((from - want) / 360) * 360; // shortest way round
};

function buildCarousel(td: TrackDay) {
  const stage = document.getElementById('td-stage')!;
  stage.innerHTML = `
    <div class="td-mapwrap">
      <div class="susan" title="Drag to spin">
        <svg class="orbit" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <ellipse cx="50" cy="50" rx="50" ry="50" class="o-glow"/><ellipse cx="50" cy="50" rx="50" ry="50" class="o-line"/>
        </svg>
        ${td.tracks.map((t) => `
          <div class="sz" data-track="${esc(t.id)}" style="--c: ${esc(t.color)}">
            <div class="sz-holo">${mapSvg(t)}</div>
            <span class="sz-tag mono">${esc(t.alias ?? t.name)}</span>
          </div>`).join('')}
      </div>
      <span class="td-hud mono"></span>
      <span class="hud-hint mono">◂ DRAG TO SPIN ▸</span>
    </div>
    <div class="td-info"></div>`;
  const i = td.tracks.findIndex((t) => t.id === tdSel);
  trackSpin.to(frontAngle(Math.max(0, i), trackSpin.angle), 0);
}

function placeCarousel(a: number) {
  const box = tdStage.querySelector<HTMLElement>('.susan');
  if (!box) return;
  const rx = box.clientWidth * 0.34, ry = box.clientHeight * 0.15, step = stepDeg();
  box.querySelectorAll<HTMLElement>('.sz').forEach((el, i) => {
    const th = ((a + i * step) * Math.PI) / 180;
    const f = (Math.cos(th) + 1) / 2; // 1 = front, 0 = back
    el.style.transform = `translate(-50%, -88%) translate(${(Math.sin(th) * rx).toFixed(1)}px, ${(Math.cos(th) * ry).toFixed(1)}px) scale(${(0.5 + 0.5 * f).toFixed(3)})`;
    el.style.opacity = (0.38 + 0.62 * f * f).toFixed(3);
    el.style.zIndex = String(Math.round(f * 100));
    el.style.filter = f > 0.93 ? '' : `blur(${((1 - f) * 1.2).toFixed(2)}px)`;
  });
  // the orbit's dashes travel with the spin
  box.querySelector('.o-line')?.setAttribute('stroke-dashoffset', (a * 0.6).toFixed(1));
}

function bestOf(trackId: string): Session | undefined {
  return (tdData?.sessions ?? []).filter((s) => s.track === trackId)
    .sort((a, b) => lapSecs(a.best) - lapSecs(b.best))[0];
}

function mapSvg(t: Track): string {
  const m = t.map ? MAPS[t.map] : undefined;
  if (!m) {
    // no known layout yet: an honest placeholder, clearly not a real track
    return `<svg class="td-map pending" viewBox="0 0 1000 620" role="img" aria-label="Track map pending">
      <defs><pattern id="g-${t.id}" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" class="dot"/></pattern></defs>
      <rect x="170" y="150" width="660" height="320" rx="160" class="pend-line"/>
      <line x1="0" y1="0" x2="0" y2="620" class="scan"/>
      <text x="500" y="300" class="pend-big">TRACE PENDING</text>
      <text x="500" y="345" class="pend-small">the real layout is drawn from your first GPS session</text>
    </svg>`;
  }
  return `<svg class="td-map" viewBox="0 0 1000 620" role="img" aria-label="${esc(t.name)} layout">
    <defs>
      <filter id="glow-${t.id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <pattern id="g-${t.id}" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" class="dot"/></pattern>
    </defs>
    <path d="${m.d}" class="tarmac"/>
    <path d="${m.d}" class="kerbline"/>
    <path d="${m.d}" class="race-line" filter="url(#glow-${t.id})" pathLength="1000"/>
    <line x1="${m.start[0]}" y1="${m.start[1] - 22}" x2="${m.start[0]}" y2="${m.start[1] + 22}" class="start"/>
    <text x="${m.start[0] - 60}" y="${m.start[1] - 32}" class="lbl">START / FINISH</text>
    ${m.labels.map(([s, x, y]) => `<text x="${x}" y="${y}" class="lbl dim">${s}</text>`).join('')}
    <g class="ghost" style="display: none"><circle r="20" class="ghost-halo"/><circle r="8" class="ghost-dot"/></g>
  </svg>`;
}

function showTrack(id: string, dir = 0) {
  if (!tdData) return;
  tdSel = id;
  const idx = tdData.tracks.findIndex((x) => x.id === id);
  const t = tdData.tracks[idx];
  const best = bestOf(id);
  const pbSecs = best ? lapSecs(best.best) : 0;
  const sessions = tdData.sessions.filter((s) => s.track === id).sort((a, b) => b.date.localeCompare(a.date));
  document.querySelectorAll<HTMLElement>('.td-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.track === id)));
  const vehicles = tdBuilds.filter((b) => !b.sold).map((b) => b.name);
  const facts = [
    t.kind, t.location, t.length_km ? `${t.length_km} km` : '', t.turns ? `${t.turns} turns` : '',
  ].filter(Boolean);

  const stage = document.getElementById('td-stage')!;
  stage.style.setProperty('--c', t.color);
  stage.querySelectorAll<HTMLElement>('.sz').forEach((el) => el.classList.toggle('on', el.dataset.track === id));
  stage.querySelector('.td-hud')!.innerHTML = `<b>TRACK ${String(idx + 1).padStart(2, '0')}/${String(tdData.tracks.length).padStart(2, '0')}</b>
    <i class="hud-lock">LOCKING ON…</i><i class="hud-ok">${t.map ? 'GPS LOCKED' : 'AWAITING GPS'}</i>`;
  stage.querySelector('.ghost-tag')?.remove();
  if (best) stage.querySelector('.td-mapwrap')!.insertAdjacentHTML('beforeend', `<span class="ghost-tag mono">GHOST LAP · ${esc(best.best)}</span>`);
  stage.querySelector('.td-info')!.outerHTML = `
    <div class="td-info">
      <div class="td-top">
        <span class="td-chip ${t.status}">${t.status === 'planned' ? 'Upcoming' : 'Ridden'}</span>
        ${t.alias ? `<span class="td-alias mono">${esc(t.alias)}</span>` : ''}
      </div>
      <h3 class="td-name display">${esc(t.name)}</h3>
      <p class="td-facts mono">${facts.map(esc).join(' · ')}</p>
      <div class="td-pb lcd">
        <span>PERSONAL BEST</span>
        <b class="lcd-text">${best ? esc(best.best) : '-:--.---'}</b>
        <em class="mono">${best ? `${esc(best.vehicle || '')}${best.vehicle ? ' · ' : ''}${esc(best.date)}` : t.status === 'planned' ? 'Not ridden yet — on the list' : esc(t.note || 'Log your first session below')}</em>
      </div>
      <div class="td-bar">
        <p class="eyebrow">Sessions — latest first</p>
        <button class="add-btn" type="button" data-td-add>+ Add session</button>
      </div>
      <form class="td-form" hidden>
        <div class="tf-row">
          <input name="date" type="date" required />
          <input name="best" placeholder="Best lap  1:02.345" pattern="^(\\d{1,2}:)?\\d{1,2}\\.\\d{1,3}$" required />
        </div>
        <select name="vehicle">${vehicles.map((v) => `<option>${esc(v)}</option>`).join('')}<option>Rental kart</option></select>
        <input name="notes" maxlength="300" placeholder="Notes — conditions, tyres, setup…" />
        <div class="lf-actions">
          <button class="btn btn-primary" type="submit">Save ▸</button>
          <button class="btn" type="button" data-td-cancel>Cancel</button>
          <span class="lf-msg lcd-text"></span>
        </div>
      </form>
      <ol class="td-sessions">${sessions.length ? sessions.map((s) => {
        const d = lapSecs(s.best) - pbSecs;
        return `<li class="${d === 0 ? 'pb' : ''}">
          <span class="ts-date lcd-text">${esc(s.date)}</span>
          <span class="ts-lap lcd-text">${esc(s.best)}</span>
          <span class="ts-delta mono">${fmtDelta(d)}</span>
          <span class="ts-meta">${esc(s.vehicle || '')}${s.notes ? ` — ${esc(s.notes)}` : ''}${s.telemetry ? `<button class="ts-view mono" type="button" data-tele="${esc(s.date)}">Details ▾</button>` : ''}</span>
          ${s.uploaded ? '' : `<button class="del" type="button" aria-label="Delete session" data-td-del='${esc(JSON.stringify({ date: s.date, best: s.best, vehicle: s.vehicle, notes: s.notes }))}'>✕</button>`}
          ${s.laps?.length ? lapBars(s.laps) : ''}
        </li>`;
      }).join('') : `<li class="empty">${t.status === 'planned' ? 'Not ridden yet.' : 'No sessions logged yet.'}</li>`}</ol>
    </div>`;
  startGhost(pbSecs);
  renderTelemetry(t, sessions, teleDate, tdData.coach?.[t.id]);
  if (dir && !reduced) {
    stage.style.setProperty('--dir', String(dir));
    stage.classList.remove('td-in'); void stage.offsetWidth; stage.classList.add('td-in');
    rollPb(stage.querySelector<HTMLElement>('.td-pb b')!, best?.best ?? '');
  }
}

// --- track change: carousel brings the track round to the front, info panel swaps ---
let tdSwap = 0;
function switchTrack(id: string, spin = true) {
  if (!tdData || id === tdSel) return;
  const ids = tdData.tracks.map((t) => t.id);
  const to = ids.indexOf(id), from = ids.indexOf(tdSel);
  if (spin) trackSpin.to(frontAngle(to, trackSpin.angle), 950);
  // slide the info panel the way the carousel turns
  const dir = (((to - from) % ids.length) + ids.length) % ids.length <= ids.length / 2 ? 1 : -1;
  if (reduced) { showTrack(id); return; }
  const n = ++tdSwap;
  const stage = document.getElementById('td-stage')!;
  document.querySelectorAll<HTMLElement>('.td-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.track === id)));
  stage.style.setProperty('--dir', String(dir));
  stage.classList.remove('td-in'); void stage.offsetWidth; stage.classList.add('td-out');
  setTimeout(() => {
    if (n !== tdSwap) return; // a newer pick wins
    stage.classList.remove('td-out');
    showTrack(id, dir);
  }, 260);
}

// timing-board roll: digits count up to the PB (or scramble when there's none)
function rollPb(el: HTMLElement, best: string) {
  const fmt = (v: number) => `${Math.floor(v / 60)}:${(v % 60).toFixed(3).padStart(6, '0')}`;
  const target = best ? lapSecs(best) : 0;
  const t0 = performance.now(), dur = target ? 900 : 520;
  const rnd = (n: number, w: number) => String(Math.floor(Math.random() * n)).padStart(w, '0');
  const step = (now: number) => {
    if (!el.isConnected) return;
    const k = Math.min(1, (now - t0) / dur);
    if (k >= 1) { el.textContent = best || '-:--.---'; return; }
    el.textContent = target ? fmt(target * (1 - Math.pow(1 - k, 3))) : `${rnd(10, 1)}:${rnd(60, 2)}.${rnd(1000, 3)}`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ghost dot laps the map in exactly the PB time
function startGhost(pbSecs: number) {
  cancelAnimationFrame(ghostRaf);
  document.querySelectorAll<SVGGElement>('#td-stage .ghost').forEach((g) => { g.style.display = 'none'; });
  const path = document.querySelector<SVGPathElement>('#td-stage .sz.on .race-line');
  const ghost = document.querySelector<SVGGElement>('#td-stage .sz.on .ghost');
  if (!path || !ghost || !pbSecs) return;
  ghost.style.display = ''; // SVG ignores the hidden attribute
  const len = path.getTotalLength();
  const t0 = performance.now();
  const step = (now: number) => {
    const p = reduced ? 0 : (((now - t0) / 1000) % pbSecs) / pbSecs;
    const pt = path.getPointAtLength(p * len);
    ghost.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    if (!reduced) ghostRaf = requestAnimationFrame(step);
  };
  ghostRaf = requestAnimationFrame(step);
}

const sessionPath = () => `/api/garage/trackday/${encodeURIComponent(tdSel)}/session`;

/** Wire up the carousel, tabs and session form once. */
export function initTrackday() {
  const tdEl = document.getElementById('trackday')!;
  tdStage = document.getElementById('td-stage')!;
  trackSpin = spinner(tdStage, {
    grab: '.susan',
    step: stepDeg,
    apply: (a) => placeCarousel(a),
    onSettle: (a) => {
      if (!tdData) return;
      const n = tdData.tracks.length;
      const i = ((Math.round(-a / stepDeg()) % n) + n) % n;
      switchTrack(tdData.tracks[i].id, false);
    },
  });
  window.addEventListener('resize', () => placeCarousel(trackSpin.angle));
  tdEl.addEventListener('pointermove', (e) => {
    const w = (e.target as HTMLElement).closest<HTMLElement>('.td-mapwrap');
    if (!w) return;
    const r = w.getBoundingClientRect();
    w.style.setProperty('--mx', `${e.clientX - r.left}px`);
    w.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
  tdEl.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;
    const tab = el.closest<HTMLElement>('[data-track]');
    if (tab) { switchTrack(tab.dataset.track!); return; }
    const view = el.closest<HTMLElement>('[data-tele]');
    if (view && tdData) {
      teleDate = view.dataset.tele ?? '';
      const track = tdData.tracks.find((x) => x.id === tdSel);
      if (!track) return;
      renderTelemetry(track, tdData.sessions.filter((s) => s.track === tdSel).sort((a, b) => b.date.localeCompare(a.date)), teleDate, tdData.coach?.[track.id]);
      document.getElementById('td-tele')!.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const form = tdEl.querySelector<HTMLFormElement>('.td-form');
    if (el.closest('[data-td-add]') && form) {
      form.hidden = !form.hidden;
      if (!form.hidden) (form.elements.namedItem('date') as HTMLInputElement).value = localNow().slice(0, 10);
      return;
    }
    if (el.closest('[data-td-cancel]') && form) { form.hidden = true; return; }
    const del = el.closest<HTMLButtonElement>('[data-td-del]');
    if (del && confirmTap(del)) {
      const s: Session = JSON.parse(del.dataset.tdDel!);
      const res = await api('DELETE', sessionPath(), { date: s.date, best: s.best, vehicle: s.vehicle ?? '', notes: s.notes ?? '' });
      if (res.status === 401) { expire(); return; }
      if (res.ok) renderTrackday(await res.json(), tdBuilds);
    }
  });
  tdEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const msg = form.querySelector('.lf-msg')!;
    const body = Object.fromEntries(new FormData(form) as any);
    msg.textContent = 'SAVING…';
    try {
      const res = await api('POST', sessionPath(), body);
      if (res.status === 401) { expire(); return; }
      if (!res.ok) { msg.textContent = 'CHECK THE LAP TIME FORMAT'; return; }
      renderTrackday(await res.json(), tdBuilds);
    } catch {
      msg.textContent = 'NO SIGNAL — BACKEND OFFLINE?';
    }
  });
}
