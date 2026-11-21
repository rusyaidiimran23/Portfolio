// Crew screen: design the site mascots (2D blobs). Saved to /api/crew; the public site reads it.
import { API_BASE } from '../../lib/api';
import { createEditor } from '../crew/editor';
import { Blob2D, DEFAULT_LOOK, type Look } from '../crew/blob2d';
import { api, esc, expire } from './shared';

type Member = { id: string; name: string; role: 'main' | 'crew'; look: Look };

let members: Member[] = [];
let sel = 0;
let dirty = false;
let editor: ReturnType<typeof createEditor> | null = null;
const chips: Blob2D[] = [];

const $ = (id: string) => document.getElementById(id)!;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'crew';

function setDirty(d: boolean, msg = '') {
  dirty = d;
  $('cr-save').toggleAttribute('disabled', !d);
  $('cr-msg').textContent = msg || (d ? 'UNSAVED CHANGES' : 'SAVED');
}

function renderList() {
  chips.forEach((c) => c.destroy()); chips.length = 0;
  const list = $('cr-list');
  list.innerHTML = members.map((m, i) => `
    <button class="cr-chip${i === sel ? ' on' : ''}" type="button" data-i="${i}">
      <span class="cr-mini" data-mini="${i}"></span>
      <b>${esc(m.name)}</b>${m.role === 'main' ? '<em class="mono">MAIN</em>' : ''}
    </button>`).join('');
  members.forEach((m, i) => chips.push(new Blob2D(list.querySelector<HTMLElement>(`[data-mini="${i}"]`)!, m.look, 46)));
  const m = members[sel];
  ($('cr-name') as HTMLInputElement).value = m.name;
  $('cr-main').toggleAttribute('disabled', m.role === 'main');
  $('cr-del').toggleAttribute('disabled', members.length < 2);
}

function select(i: number) {
  sel = i;
  editor!.load(members[i].look);
  renderList();
}

export async function loadCrew() {
  if (!editor) {
    editor = createEditor($('cr-editor'), (look) => {
      members[sel].look = look;
      chips[sel]?.set(look);
      setDirty(true);
    });
    $('cr-list').addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-i]');
      if (b) select(Number(b.dataset.i));
    });
    $('cr-name').addEventListener('input', (e) => {
      members[sel].name = (e.target as HTMLInputElement).value.slice(0, 30);
      const chip = $('cr-list').querySelector(`[data-i="${sel}"] b`);
      if (chip) chip.textContent = members[sel].name;
      setDirty(true);
    });
    $('cr-add').addEventListener('click', () => {
      if (members.length >= 12) return;
      const n = members.length + 1;
      let id = `crew-${n}`;
      while (members.some((m) => m.id === id)) id += 'x';
      members.push({ id, name: `Crew ${n}`, role: 'crew', look: { ...members[sel].look } });
      select(members.length - 1);
      setDirty(true);
    });
    $('cr-del').addEventListener('click', () => {
      if (members.length < 2) return;
      const wasMain = members[sel].role === 'main';
      members.splice(sel, 1);
      if (wasMain) members[0].role = 'main';
      select(Math.max(0, sel - 1));
      setDirty(true);
    });
    $('cr-main').addEventListener('click', () => {
      members.forEach((m, i) => { m.role = i === sel ? 'main' : 'crew'; });
      renderList();
      setDirty(true);
    });
    $('cr-save').addEventListener('click', save);
    addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
  }
  if (dirty) return; // don't throw away edits when coming back to the screen
  const res = await fetch(`${API_BASE}/api/crew`).catch(() => null);
  if (!res || !res.ok) { $('cr-msg').textContent = 'NO SIGNAL — BACKEND OFFLINE?'; return; }
  members = (await res.json()).members;
  members.forEach((m) => { m.look = { ...DEFAULT_LOOK, ...m.look }; });
  select(Math.max(0, members.findIndex((m) => m.role === 'main')));
  setDirty(false, ' ');
}

async function save() {
  // ids follow the names, kept unique
  const used = new Set<string>();
  for (const m of members) {
    let id = slug(m.name), k = 2;
    while (used.has(id)) id = `${slug(m.name).slice(0, 21)}-${k++}`;
    used.add(id); m.id = id;
    m.name = m.name.trim() || 'Crew';
  }
  $('cr-msg').textContent = 'SAVING…';
  try {
    const res = await api('PUT', '/api/crew', { members });
    if (res.status === 401) { expire(); return; }
    if (!res.ok) { $('cr-msg').textContent = `COULD NOT SAVE: ${(await res.json().catch(() => ({}))).detail ?? res.status}`; return; }
    members = (await res.json()).members;
    renderList();
    setDirty(false, 'SAVED — LIVE ON THE SITE');
  } catch {
    $('cr-msg').textContent = 'NO SIGNAL — BACKEND OFFLINE?';
  }
}
