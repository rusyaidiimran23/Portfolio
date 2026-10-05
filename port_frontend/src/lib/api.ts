// Central place for the backend base URL. Override with PUBLIC_API_BASE.
// Dev talks to the local FastAPI; production builds call /api/... on the same
// domain (Caddy on the VPS forwards /api to the backend).
export const API_BASE =
  import.meta.env.PUBLIC_API_BASE ?? (import.meta.env.DEV ? 'http://localhost:8001' : '');
