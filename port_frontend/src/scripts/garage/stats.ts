// Stats screen: who's been visiting the public site (private, from /api/stats).
import { API_BASE } from '../../lib/api';
import { esc, token } from './shared';

type Row = { name: string; count: number };
type Report = {
  today: number; month: number; total: number; online: number;
  days: { day: string; visitors: number; views: number }[]; refs: Row[]; projects: Row[]; events: Row[];
};
let projectNames: Record<string, string> | null = null;
export async function loadStats() {
  const body = document.getElementById('st-body')!;
  const res = await fetch(`${API_BASE}/api/stats`, { headers: { Authorization: `Bearer ${token()}` } }).catch(() => null);
  if (!res || !res.ok) { body.innerHTML = '<p class="st-empty mono">No telemetry — is the backend running?</p>'; return; }
  const r: Report = await res.json();
  projectNames ??= await fetch(`${API_BASE}/api/content`).then((x) => x.json())
    .then((c) => Object.fromEntries((c.projects ?? []).map((p: { id: string; tag: string }) => [p.id, p.tag]))).catch(() => ({}));
  const fmt = (n: number) => n.toLocaleString('en-US');
  const peak = Math.max(1, ...r.days.map((d) => d.visitors));
  const best = r.days.reduce((a, d) => (d.visitors > a.visitors ? d : a), r.days[0]);
  const bars = r.days.map((d, i) => {
    const h = Math.max(2, (d.visitors / peak) * 100);
    const cls = i === r.days.length - 1 ? 'today' : d === best && d.visitors ? 'best' : '';
    return `<rect x="${i * 10 + 1}" y="${100 - h}" width="8" height="${h}" class="${cls}"><title>${d.day}: ${d.visitors} visitors, ${d.views} views</title></rect>`;
  }).join('');
  const list = (rows: Row[], empty: string, name = (n: string) => n) => rows.length
    ? `<ol class="st-list">${rows.map((x) => `<li><span>${esc(name(x.name))}</span><b class="lcd-text">${fmt(x.count)}</b></li>`).join('')}</ol>`
    : `<p class="st-empty mono">${empty}</p>`;
  const EV: Record<string, string> = { game: 'Lights Out games', contact: 'Messages sent' };
  body.innerHTML = `
    <div class="st-kpis">
      ${[['On track now', r.online, 'green'], ['Today', r.today, 'amber'], ['This month', r.month, 'pink'], ['All time', r.total, 'purple']]
        .map(([k, v, c]) => `<div class="st-kpi" style="--c: var(--${c})"><span class="mono">${k}</span><b class="lcd-text">${fmt(Number(v))}</b></div>`).join('')}
    </div>
    <div class="st-chart">
      <div class="st-chart-head"><p class="eyebrow">Visitors — last 30 days</p>
        <span class="mono">best day ${best && best.visitors ? `${esc(best.day)} · ${best.visitors}` : '—'}</span></div>
      <svg viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="Daily visitors, last 30 days">${bars}</svg>
      <div class="st-axis mono"><span>${esc(r.days[0]?.day ?? '')}</span><span>today</span></div>
    </div>
    <div class="st-cols">
      <div><p class="eyebrow">Projects people looked at</p>${list(r.projects, 'No project views yet.', (n) => projectNames?.[n] ?? n.toUpperCase())}</div>
      <div><p class="eyebrow">Where they came from</p>${list(r.refs, 'Mostly direct visits so far.')}</div>
      <div><p class="eyebrow">Actions</p>${list(r.events.filter((e) => EV[e.name]), 'No games or messages yet.', (n) => EV[n] ?? n)}</div>
    </div>`;
  document.getElementById('st-upd')!.textContent = `UPDATED ${new Date().toTimeString().slice(0, 5)}`;
}
