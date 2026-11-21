// Small helpers used by every Garage screen: escaping, the login token, API calls.
import { API_BASE } from '../../lib/api';

export const KEY = 'garage_token';
export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const token = () => localStorage.getItem(KEY) ?? '';

/** Session expired: forget the token and reload, which shows the lock screen. */
export function expire() {
  localStorage.removeItem(KEY);
  location.reload();
}

/** Current local time as YYYY-MM-DDTHH:MM (for datetime-local inputs). */
export const localNow = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/** JSON request to the API with the stored token. */
export function api(method: 'POST' | 'PUT' | 'DELETE', path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body: JSON.stringify(body),
  });
}

/** Delete buttons need two taps: the first arms it for 3 s. Returns true on the second tap. */
export function confirmTap(btn: HTMLButtonElement): boolean {
  if (btn.classList.contains('armed')) return true;
  btn.classList.add('armed'); btn.textContent = 'Delete?';
  setTimeout(() => { btn.classList.remove('armed'); btn.textContent = '✕'; }, 3000);
  return false;
}

export const lapSecs = (t: string) => {
  const [m, s] = t.includes(':') ? t.split(':') : ['0', t];
  return Number(m) * 60 + Number(s);
};
export const fmtLap = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
