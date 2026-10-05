// Privacy-friendly visit counter (see port_backend/app/stats.py): no cookies,
// nothing stored on the visitor's device. Your own browser is left out once
// you've unlocked the Garage on it.

import { API_BASE } from '../lib/api';

export const OWNER_KEY = 'rx-owner';

export function track(kind: 'view' | 'project' | 'game' | 'contact' = 'view', label = '') {
  try { if (localStorage.getItem(OWNER_KEY)) return; } catch { /* storage blocked: count it */ }
  fetch(`${API_BASE}/api/hit`, {
    method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, label, path: location.pathname, ref: kind === 'view' ? document.referrer : '' }),
  }).catch(() => { /* stats are best-effort */ });
}
