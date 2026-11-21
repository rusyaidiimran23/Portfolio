// Telemetry panel under Track Day: charts from an imported GPS log (LapTrophy).
import { MAPS } from './maps';
import { esc, fmtLap } from './shared';
import type { Session, Track } from './types';

// colours checked with the dataviz validator on the dark surface: best #5f9e1f, compare #6f8fe0
const C_BEST = '#5f9e1f', C_CMP = '#6f8fe0';
const fmtS = (s: number) => (s < 60 ? s.toFixed(2) : fmtLap(s));
// sequential lime ramp for the speed map: slow = dim, fast = bright
const ramp = (u: number) => {
  const a = [46, 74, 16], b = [214, 255, 106];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',')})`;
};

/** Telemetry for the session dated `date` (or the latest one with a log), with the coach's advice on top. */
export function renderTelemetry(t: Track, sessions: Session[], date = '', coach?: string) {
  const box = document.getElementById('td-tele')!;
  const s = sessions.find((x) => x.telemetry && x.date === date) ?? sessions.find((x) => x.telemetry);
  if (!s || !s.telemetry) { box.hidden = true; box.innerHTML = ''; return; }
  document.querySelectorAll<HTMLElement>('#td-stage [data-tele]').forEach((b) => b.classList.toggle('on', b.dataset.tele === s.date));
  const tm = s.telemetry;
  const L = tm.lap_length_m;
  const flying = tm.laps.slice(1);
  const mean = flying.reduce((a, b) => a + b, 0) / flying.length;
  const sd = Math.sqrt(flying.reduce((a, b) => a + (b - mean) ** 2, 0) / flying.length);
  // LapTrophy sometimes leaves a sector blank: skip it, never count it as zero
  const bestS = [0, 1, 2].map((k) => Math.min(...tm.sectors.slice(1).map((r) => r[k]).filter((v): v is number => v !== null)));
  const theo = bestS.reduce((a, b) => a + b, 0);
  const best = Math.min(...tm.laps);
  const avg = (L / best) * 3.6;
  const gain = tm.laps[1] - best;

  // --- sector table: purple = fastest sector of the session
  const rows = tm.laps.map((lap, i) => {
    const sec = tm.sectors[i];
    const cells = sec.map((v, k) => `<td class="${i > 0 && v === bestS[k] ? 'fast' : ''}">${v === null ? '–' : v.toFixed(2)}</td>`).join('');
    const d = lap - best;
    return `<tr class="${lap === best ? 'pb' : ''}"><th scope="row">${i + 1}${i === 0 ? ' <em>out</em>' : ''}</th>${cells}
      <td class="lt">${fmtLap(lap)}</td><td class="dl">${d === 0 ? 'PB' : `+${d.toFixed(2)}`}</td></tr>`;
  }).join('');
  const table = `
    <table class="tl-table">
      <thead><tr><th scope="col">Lap</th><th scope="col">S1</th><th scope="col">S2</th><th scope="col">S3</th><th scope="col">Time</th><th scope="col">Gap</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th scope="row">Ideal</th>${bestS.map((v) => `<td class="fast">${v.toFixed(2)}</td>`).join('')}<td class="lt">${fmtLap(theo)}</td><td class="dl">−${(best - theo).toFixed(2)}</td></tr></tfoot>
    </table>
    <p class="tl-axis-note mono"><i class="tl-fast-key"></i>fastest sector · lap 1 is the out-lap and isn't counted · splits ±0.5 s (1 Hz GPS)</p>`;

  const head = `
    <div class="tl-head">
      <p class="eyebrow">Telemetry — ${[s.vehicle, s.date, 'LapTrophy GPS'].filter(Boolean).map((x) => esc(x)).join(' · ')}</p>
    </div>
    ${coach ? `<figure class="tl-card"><figcaption class="eyebrow">Coach — latest session</figcaption><p class="tl-coach mono">${esc(coach)}</p></figure>` : ''}
    <div class="tl-kpis">
      ${[['Best lap', fmtLap(best), `lap ${tm.best_lap}`], ['Ideal lap', fmtLap(theo), 'best sectors combined'],
         ['Top speed', `${tm.top_speed}`, 'km/h'], ['Avg speed', `${avg.toFixed(0)}`, 'km/h on the best lap'],
         ['Consistency', `±${sd.toFixed(2)}`, 's across flying laps'], ['Improvement', `−${gain.toFixed(2)}`, `s, lap 2 → best`]]
        .map(([k, v, u]) => `<div class="tl-kpi"><span class="mono">${k}</span><b class="lcd-text">${v}</b><em class="mono">${u}</em></div>`).join('')}
    </div>`;
  box.hidden = false;
  if (tm.map_best.length < 2 || tm.trace_best.length < 2 || tm.trace_compare.length < 2) { // lap times only, no speed log for this run
    box.innerHTML = head + `<figure class="tl-card"><figcaption class="eyebrow">Sector times</figcaption>${table}</figure>
      <p class="tl-axis-note mono">No speed log for this session, so no map or speed trace.</p>`;
    return;
  }

  // --- speed map: best lap's GPS line, coloured by speed
  const m = MAPS[t.map ?? ''];
  const pts = tm.map_best;
  const vmin = Math.min(...pts.map((p) => p[2])), vmax = Math.max(...pts.map((p) => p[2]));
  const segs = pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1], v = (p[2] + q[2]) / 2, u = (v - vmin) / (vmax - vmin || 1);
    return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${ramp(u)}"><title>${Math.round(v)} km/h</title></line>`;
  }).join('');
  const top = pts.reduce((a, b) => (b[2] > a[2] ? b : a)), slow = pts.slice(3, -3).reduce((a, b) => (b[2] < a[2] ? b : a));
  const speedMap = `
    <svg class="tl-map" viewBox="0 0 1000 620" role="img" aria-label="Best lap racing line coloured by speed, ${vmin} to ${vmax} km/h">
      ${m ? `<path d="${m.d}" class="tl-tarmac"/>` : ''}
      <g class="tl-heat">${segs}</g>
      <circle cx="${top[0]}" cy="${top[1]}" r="9" class="tl-pin"/><text x="${top[0] + 16}" y="${top[1] + 6}" class="tl-pin-l">${top[2]} km/h</text>
      <circle cx="${slow[0]}" cy="${slow[1]}" r="9" class="tl-pin"/><text x="${slow[0] + 16}" y="${slow[1] + 6}" class="tl-pin-l">${slow[2]} km/h</text>
    </svg>
    <div class="tl-legend mono"><span>${vmin} km/h</span><i style="background: linear-gradient(90deg, ${ramp(0)}, ${ramp(0.5)}, ${ramp(1)})"></i><span>${vmax} km/h</span></div>`;

  // --- speed trace: best lap vs the first flying lap, by distance round the lap
  const W = 640, H = 260, pl = 40, pr = 16, pt = 14, pb = 28;
  const X = (d: number) => pl + (Math.max(0, Math.min(L, d)) / L) * (W - pl - pr);
  const ymax = Math.ceil(Math.max(...tm.trace_best.map((p) => p[1]), ...tm.trace_compare.map((p) => p[1])) / 20) * 20;
  const Y = (v: number) => pt + (1 - v / ymax) * (H - pt - pb);
  const line = (tr: number[][]) => tr.filter((p) => p[0] >= 0 && p[0] <= L).map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' ');
  const grid = Array.from({ length: ymax / 20 + 1 }, (_, i) => i * 20).map((v) =>
    `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" class="tl-grid"/><text x="${pl - 6}" y="${Y(v) + 4}" class="tl-ax" text-anchor="end">${v}</text>`).join('');
  const secs = [1, 2].map((k) => `<line x1="${X(L * k / 3)}" x2="${X(L * k / 3)}" y1="${pt}" y2="${H - pb}" class="tl-sec"/>`).join('')
    + ['S1', 'S2', 'S3'].map((n, k) => `<text x="${X(L * (k + 0.5) / 3)}" y="${H - 8}" class="tl-ax" text-anchor="middle">${n}</text>`).join('');
  const lastB = tm.trace_best.filter((p) => p[0] <= L).at(-1)!, lastC = tm.trace_compare.filter((p) => p[0] <= L).at(-1)!;
  const trace = `
    <div class="tl-key mono">
      <span><i style="background:${C_BEST}"></i>Lap ${tm.best_lap} · ${fmtLap(tm.laps[tm.best_lap - 1])} (best)</span>
      <span><i style="background:${C_CMP}"></i>Lap ${tm.compare_lap} · ${fmtLap(tm.laps[tm.compare_lap - 1])}</span>
    </div>
    <div class="tl-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Speed through the lap, best lap against lap ${tm.compare_lap}">
        ${grid}${secs}
        <text x="${pl}" y="${pt - 3}" class="tl-ax">km/h</text>
        <path d="${line(tm.trace_compare)}" class="tl-line" stroke="${C_CMP}"/>
        <path d="${line(tm.trace_best)}" class="tl-line" stroke="${C_BEST}"/>
        <text x="${W - pr}" y="${Y(lastB[1]) - 6}" class="tl-dl" text-anchor="end">best</text>
        <text x="${W - pr}" y="${Y(lastC[1]) + 14}" class="tl-dl" text-anchor="end">lap ${tm.compare_lap}</text>
        <g class="tl-cross" style="display:none"><line y1="${pt}" y2="${H - pb}" class="tl-cross-l"/>
          <circle r="4" fill="${C_BEST}" class="tl-dot tb"/><circle r="4" fill="${C_CMP}" class="tl-dot tc"/></g>
        <rect x="${pl}" y="${pt}" width="${W - pl - pr}" height="${H - pt - pb}" fill="transparent" class="tl-hit"/>
      </svg>
      <div class="tl-tip mono" hidden></div>
    </div>
    <p class="tl-axis-note mono">Distance round the lap, 0–${L} m</p>`;

  box.innerHTML = head + `
    <div class="tl-grid2">
      <figure class="tl-card"><figcaption class="eyebrow">Speed map — best lap</figcaption>${speedMap}</figure>
      <figure class="tl-card"><figcaption class="eyebrow">Speed trace</figcaption>${trace}</figure>
    </div>
    <figure class="tl-card"><figcaption class="eyebrow">Sector times</figcaption>${table}</figure>`;

  // crosshair + tooltip on the speed trace
  const svg = box.querySelector<SVGSVGElement>('.tl-chart svg')!, tip = box.querySelector<HTMLElement>('.tl-tip')!;
  const cross = svg.querySelector<SVGGElement>('.tl-cross')!;
  const at = (tr: number[][], d: number) => {
    const j = tr.findIndex((p) => p[0] >= d);
    if (j <= 0) return tr[Math.max(0, j)][1];
    const a = tr[j - 1], b = tr[j]; return a[1] + (b[1] - a[1]) * ((d - a[0]) / (b[0] - a[0] || 1));
  };
  svg.querySelector('.tl-hit')!.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect();
    const sx = ((e as PointerEvent).clientX - r.left) * (W / r.width);
    const d = Math.max(0, Math.min(L, ((sx - pl) / (W - pl - pr)) * L));
    const vb = at(tm.trace_best, d), vc = at(tm.trace_compare, d), x = X(d);
    cross.style.display = '';
    cross.querySelector('line')!.setAttribute('x1', String(x)); cross.querySelector('line')!.setAttribute('x2', String(x));
    const tb = cross.querySelector('.tb')!, tc = cross.querySelector('.tc')!;
    tb.setAttribute('cx', String(x)); tb.setAttribute('cy', String(Y(vb)));
    tc.setAttribute('cx', String(x)); tc.setAttribute('cy', String(Y(vc)));
    tip.hidden = false;
    tip.innerHTML = `<b>${Math.round(d)} m</b><span><i style="background:${C_BEST}"></i>best ${vb.toFixed(0)} km/h</span><span><i style="background:${C_CMP}"></i>lap ${tm.compare_lap} ${vc.toFixed(0)} km/h</span><span>Δ ${(vb - vc) >= 0 ? '+' : ''}${(vb - vc).toFixed(0)} km/h</span>`;
    tip.style.left = `${(x / W) * 100}%`;
  });
  svg.querySelector('.tl-hit')!.addEventListener('pointerleave', () => { cross.style.display = 'none'; tip.hidden = true; });
}
