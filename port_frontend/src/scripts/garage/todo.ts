// To-do screen: per active vehicle, upgrades (one-off), servicing (repeats by km and/or
// months) and road tax (renew yearly by expiry date). Each vehicle's list is saved whole to
// /api/garage/todo/<id>; due status is worked out here from today's date and the odometer.
import '../../styles/todo.css';
import { API_BASE } from '../../lib/api';
import { api, confirmTap, esc, expire, token } from './shared';
import type { Build } from './types';

type Kind = 'upgrade' | 'service' | 'roadtax';
type Item = {
  id: string; kind: Kind; title: string; notes?: string;
  priority?: 'high' | 'med' | 'low'; cost?: number | null; link?: string; done?: boolean; done_on?: string;
  every_km?: number | null; every_months?: number | null; last_km?: number | null; last_date?: string;
  due_date?: string;
};
type TodoData = { vehicles: string[]; todo: Record<string, Item[]>; odo: Record<string, number | null> };
type Status = 'overdue' | 'soon' | 'ok' | 'done';

let data: TodoData | null = null;
let builds: Build[] = [];
let wired = false;
const $ = (id: string) => document.getElementById(id)!;

const DAY = 86_400_000;
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const days = (iso: string) => Math.round((Date.parse(iso) - Date.parse(today())) / DAY);
const addMonths = (iso: string, m: number) => {
  const d = new Date(`${iso}T00:00:00`); d.setMonth(d.getMonth() + m);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const km = (n: number) => `${Math.round(n).toLocaleString('en-US')} km`;
const rm = (n: number) => `RM ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const newId = (k: Kind) => `${k[0]}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Where an item stands, plus a one-line "when" for the row. */
function statusOf(it: Item, odo: number | null): { s: Status; when: string; sort: number } {
  if (it.kind === 'upgrade') {
    if (it.done) return { s: 'done', when: it.done_on ? `Done ${fmtDate(it.done_on)}` : 'Done', sort: 9e9 };
    return { s: 'ok', when: [it.cost ? rm(it.cost) : '', `${(it.priority ?? 'med').toUpperCase()} priority`].filter(Boolean).join(' · '), sort: 1e9 + ({ high: 0, med: 1, low: 2 }[it.priority ?? 'med']) };
  }
  if (it.kind === 'roadtax') {
    const d = days(it.due_date!);
    const when = d < 0 ? `Expired ${-d} day${d === -1 ? '' : 's'} ago · ${fmtDate(it.due_date!)}` : d === 0 ? 'Expires today' : `Expires in ${d} day${d === 1 ? '' : 's'} · ${fmtDate(it.due_date!)}`;
    return { s: d < 0 ? 'overdue' : d <= 30 ? 'soon' : 'ok', when, sort: d };
  }
  // service: whichever comes first, distance or time
  const parts: string[] = [];
  let s = 'ok' as Status, sort = 1e8;
  if (it.every_km && it.last_km != null) {
    const left = it.last_km + it.every_km - (odo ?? it.last_km);
    parts.push(left < 0 ? `${km(-left)} over` : `in ${km(left)}`);
    if (left < 0) s = 'overdue'; else if (left <= Math.max(100, it.every_km * 0.15)) s = 'soon';
    sort = Math.min(sort, (left / it.every_km) * 120); // comparable-ish with days
  }
  if (it.every_months && it.last_date) {
    const due = addMonths(it.last_date, it.every_months), d = days(due);
    parts.push(d < 0 ? `${-d} days over (${fmtDate(due)})` : `by ${fmtDate(due)}`);
    if (d < 0) s = 'overdue'; else if (d <= 30 && s !== 'overdue') s = 'soon';
    sort = Math.min(sort, d);
  }
  const every = [it.every_km ? `every ${km(it.every_km)}` : '', it.every_months ? `${it.every_months} mo` : ''].filter(Boolean).join(' / ');
  return { s, when: `${parts.join(' or ') || 'Log when it was last done'} · ${every}`, sort };
}

const KIND_LABEL: Record<Kind, string> = { upgrade: 'Upgrade', service: 'Service', roadtax: 'Road tax' };
const ACTION: Record<Kind, string> = { upgrade: 'Done ✓', service: 'Done today ✓', roadtax: 'Renewed ✓' };

function rowHTML(it: Item, odo: number | null) {
  const st = statusOf(it, odo);
  const tag = st.s === 'overdue' ? (it.kind === 'roadtax' ? 'EXPIRED' : 'OVERDUE') : st.s === 'soon' ? 'DUE SOON' : st.s === 'done' ? 'DONE' : '';
  return `
    <li class="td-item k-${it.kind} s-${st.s}" data-id="${esc(it.id)}">
      <span class="td-kind mono">${KIND_LABEL[it.kind]}</span>
      <div class="td-main">
        <b>${esc(it.title)}</b>${tag ? `<em class="mono">${tag}</em>` : ''}
        <span class="td-when mono">${esc(st.when)}</span>
        ${it.notes ? `<span class="td-notes">${esc(it.notes)}</span>` : ''}
        ${it.link ? `<a class="td-link mono" href="${esc(it.link)}" target="_blank" rel="noopener">Part link ↗</a>` : ''}
      </div>
      <div class="td-act">
        ${st.s === 'done' ? `<button class="td-btn" type="button" data-undo>Undo</button>` : `<button class="td-btn go" type="button" data-done>${ACTION[it.kind]}</button>`}
        <button class="del" type="button" aria-label="Delete" data-del>✕</button>
      </div>
    </li>`;
}

function cardHTML(b: Build) {
  const items = data!.todo[b.id] ?? [];
  const odo = data!.odo[b.id] ?? null;
  const sorted = [...items].map((it) => ({ it, st: statusOf(it, odo) })).sort((a, z) => a.st.sort - z.st.sort);
  const open = sorted.filter((x) => x.st.s !== 'done'), done = sorted.filter((x) => x.st.s === 'done');
  const over = open.filter((x) => x.st.s === 'overdue').length, soon = open.filter((x) => x.st.s === 'soon').length;
  const spent = items.filter((i) => i.kind === 'upgrade' && i.done && i.cost).reduce((a, i) => a + (i.cost ?? 0), 0);
  const plan = items.filter((i) => i.kind === 'upgrade' && !i.done && i.cost).reduce((a, i) => a + (i.cost ?? 0), 0);
  return `
    <article class="td-card" data-b="${esc(b.id)}" style="--c: ${esc(b.color)}">
      <header class="td-card-head">
        <div><p class="eyebrow">${esc(b.tag)}</p><h3 class="display">${esc(b.name)}</h3></div>
        <div class="td-badges mono">
          ${over ? `<span class="b-over">${over} overdue</span>` : ''}${soon ? `<span class="b-soon">${soon} due soon</span>` : ''}
          ${!over && !soon ? '<span class="b-ok">All clear</span>' : ''}
        </div>
        <label class="td-odo mono">Odometer <input type="number" min="0" step="1" inputmode="numeric" value="${odo ?? ''}" placeholder="km" data-odo /> km</label>
      </header>
      ${plan || spent ? `<p class="td-money mono">${plan ? `Planned ${rm(plan)}` : ''}${plan && spent ? ' · ' : ''}${spent ? `Spent ${rm(spent)}` : ''}</p>` : ''}
      <ul class="td-list">${open.map((x) => rowHTML(x.it, odo)).join('') || '<li class="td-empty mono">Nothing on the list. Add an upgrade, a service or the road tax.</li>'}</ul>
      ${done.length ? `<details class="td-done"><summary class="mono">${done.length} done</summary><ul class="td-list">${done.map((x) => rowHTML(x.it, odo)).join('')}</ul></details>` : ''}
      <button class="btn td-add" type="button" data-add>+ Add item</button>
      <form class="td-form" hidden>
        <div class="td-kinds" role="radiogroup">
          ${(['upgrade', 'service', 'roadtax'] as Kind[]).map((k, i) => `<label><input type="radio" name="kind" value="${k}" ${i ? '' : 'checked'} /> ${KIND_LABEL[k]}</label>`).join('')}
        </div>
        <input name="title" maxlength="120" placeholder="What? e.g. Quickshifter, Chain lube, Road tax" required />
        <div class="td-f k-upgrade">
          <select name="priority"><option value="high">High priority</option><option value="med" selected>Medium priority</option><option value="low">Low priority</option></select>
          <input name="cost" type="number" min="0" step="0.01" placeholder="Cost (RM)" />
          <input name="link" type="url" placeholder="Part link (https://…)" />
        </div>
        <div class="td-f k-service" hidden>
          <input name="every_km" type="number" min="0" step="1" placeholder="Every … km" />
          <input name="every_months" type="number" min="0" max="120" step="1" placeholder="and/or every … months" />
          <input name="last_km" type="number" min="0" step="1" placeholder="Last done at … km" />
          <label class="mono">Last done on <input name="last_date" type="date" /></label>
        </div>
        <div class="td-f k-roadtax" hidden>
          <label class="mono">Expires on <input name="due_date" type="date" /></label>
        </div>
        <input name="notes" maxlength="600" placeholder="Notes (optional)" />
        <div class="lf-actions"><button class="btn btn-primary" type="submit">Add ▸</button><button class="btn" type="button" data-cancel>Cancel</button><span class="lf-msg lcd-text"></span></div>
      </form>
    </article>`;
}

function render() {
  const box = $('todo-cards');
  const list = (data?.vehicles ?? []).map((id) => builds.find((b) => b.id === id)).filter((b): b is Build => !!b);
  box.innerHTML = list.length ? list.map(cardHTML).join('') : '<p class="td-empty mono">No active vehicles.</p>';
  let over = 0, soon = 0;
  for (const id of data?.vehicles ?? []) for (const it of data!.todo[id] ?? []) {
    const s = statusOf(it, data!.odo[id] ?? null).s;
    if (s === 'overdue') over++; else if (s === 'soon') soon++;
  }
  $('todo-sum').textContent = over || soon ? [over ? `${over} OVERDUE` : '', soon ? `${soon} DUE SOON` : ''].filter(Boolean).join(' · ') : 'ALL CLEAR';
  $('todo-sum').classList.toggle('alert', over > 0);
}

async function save(bid: string, odo?: number | null) {
  const res = await api('PUT', `/api/garage/todo/${bid}`, { items: data!.todo[bid] ?? [], odo: odo ?? data!.odo[bid] });
  if (res.status === 401) { expire(); return false; }
  if (!res.ok) { alert(`Could not save: ${(await res.json().catch(() => ({}))).detail ?? res.status}`); return false; }
  const out = await res.json();
  data!.todo[bid] = out.items; data!.odo[bid] = out.odo;
  render();
  return true;
}

function wire() {
  const box = $('todo-cards');
  box.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;
    const card = el.closest<HTMLElement>('.td-card');
    if (!card || !data) return;
    const bid = card.dataset.b!;
    const form = card.querySelector<HTMLFormElement>('.td-form')!;
    if (el.closest('[data-add]')) { form.hidden = !form.hidden; if (!form.hidden) (form.elements.namedItem('title') as HTMLInputElement).focus(); return; }
    if (el.closest('[data-cancel]')) { form.hidden = true; return; }
    const row = el.closest<HTMLElement>('.td-item');
    if (!row) return;
    const items = data.todo[bid] ?? [];
    const it = items.find((x) => x.id === row.dataset.id);
    if (!it) return;
    const del = el.closest<HTMLButtonElement>('[data-del]');
    if (del) { if (confirmTap(del)) { data.todo[bid] = items.filter((x) => x !== it); await save(bid); } return; }
    if (el.closest('[data-done]')) {
      if (it.kind === 'upgrade') { it.done = true; it.done_on = today(); }
      else if (it.kind === 'roadtax') it.due_date = addMonths(it.due_date && days(it.due_date) > 0 ? it.due_date : today(), 12);
      else { it.last_date = today(); if (it.every_km) it.last_km = data.odo[bid] ?? it.last_km ?? null; }
      await save(bid);
      return;
    }
    if (el.closest('[data-undo]')) { it.done = false; it.done_on = ''; await save(bid); }
  });
  // odometer: saved when you leave the box (or press Enter)
  box.addEventListener('change', async (e) => {
    const el = e.target as HTMLInputElement;
    const card = el.closest<HTMLElement>('.td-card');
    if (!card || !data) return;
    if (el.matches('[data-odo]')) { const v = el.value.trim(); await save(card.dataset.b!, v ? Number(v) : null); return; }
    if (el.name === 'kind') {
      card.querySelectorAll<HTMLElement>('.td-f').forEach((f) => { f.hidden = !f.classList.contains(`k-${el.value}`); });
      const t = card.querySelector<HTMLInputElement>('[name="title"]')!;
      if (el.value === 'roadtax' && !t.value) t.value = 'Road tax';
      if (el.value !== 'roadtax' && t.value === 'Road tax') t.value = '';
    }
  });
  box.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const card = form.closest<HTMLElement>('.td-card')!;
    const bid = card.dataset.b!;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const num = (k: string) => (f[k] ? Number(f[k]) : null);
    const kind = f.kind as Kind;
    const it: Item = { id: newId(kind), kind, title: f.title.trim(), notes: f.notes?.trim() };
    if (kind === 'upgrade') Object.assign(it, { priority: f.priority, cost: num('cost'), link: f.link?.trim(), done: false, done_on: '' });
    else if (kind === 'service') Object.assign(it, { every_km: num('every_km'), every_months: num('every_months'), last_km: num('last_km') ?? data!.odo[bid] ?? null, last_date: f.last_date || today() });
    else Object.assign(it, { due_date: f.due_date });
    const msg = form.querySelector('.lf-msg')!;
    if (kind === 'service' && !it.every_km && !it.every_months) { msg.textContent = 'SET KM OR MONTHS'; return; }
    if (kind === 'roadtax' && !it.due_date) { msg.textContent = 'SET THE EXPIRY DATE'; return; }
    msg.textContent = 'SAVING…';
    data!.todo[bid] = [...(data!.todo[bid] ?? []), it];
    if (!(await save(bid))) data!.todo[bid] = data!.todo[bid].filter((x) => x !== it);
  });
}

/** Called by the page with the builds once the Garage is unlocked. */
export function setTodoBuilds(b: Build[]) { builds = b; if (data) render(); }

/** Runs when the To-do screen comes in. */
export async function loadTodo() {
  if (!wired) { wire(); wired = true; }
  const res = await fetch(`${API_BASE}/api/garage/todo`, { headers: { Authorization: `Bearer ${token()}` } }).catch(() => null);
  if (!res) { $('todo-sum').textContent = 'NO SIGNAL'; return; }
  if (res.status === 401) { expire(); return; }
  data = await res.json();
  render();
}
