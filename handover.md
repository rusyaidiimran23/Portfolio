# Handover — P.Portfolio

Session handover for the portfolio webapp build.

## Goal
A unique, "cool" portfolio webapp with interactive 3D animation tied to the
owner's hobbies (Nissan **Cefiro**, Kawasaki **ZX-4RR**). Key decision from the
owner: the Cefiro/ZX-4RR update status must live on a **private page**, so the
public homepage uses a different 3D centerpiece.

## Decisions made
- **Frontend:** Astro + Three.js (in `port_frontend/`).
- **Backend:** FastAPI — content + contact API, and it gates the private page
  (in `port_backend/`).
- **3D centerpiece (public):** abstract kinetic scene (glowing wireframe
  torus-knot + streaming particle field = speed/motion motif). Real vehicle
  models deliberately kept OFF the homepage.
- **Private page:** `/garage` — password-gated Cefiro & ZX-4RR build logs.

## Architecture
```
P.Portfolio/
├─ port_backend/          FastAPI (Python 3.14 venv already present)
│  ├─ app/
│  │  ├─ main.py          app + routes + HMAC token auth
│  │  └─ data.py          CONTENT (public) + GARAGE (private) — EDIT HERE
│  └─ requirements.txt    fastapi, uvicorn
├─ port_frontend/         Astro site
│  └─ src/
│     ├─ layouts/Base.astro     global dark/neon theme + design tokens
│     ├─ pages/index.astro      homepage (hero, about, work, contact)
│     ├─ pages/garage.astro     private password-gated page
│     ├─ scripts/hero.ts        Three.js kinetic hero
│     └─ lib/api.ts             API base URL (defaults to :8001)
├─ README.md
└─ handover.md            (this file)
```

## API surface (backend)
| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/health`  | `{ok:true}` |
| GET  | `/api/content` | public homepage content |
| POST | `/api/contact` | `{name,email,message}` — currently logs server-side only |
| POST | `/api/auth`    | `{password}` → `{token}` (HMAC-signed, 8h TTL) |
| GET  | `/api/garage`  | requires `Authorization: Bearer <token>` |

Auth is a dependency-free HMAC signed token (`exp.signature`). Token stored in
`localStorage` on the frontend for auto-unlock.

## How to run
Backend (port **8001** — Windows reserves 8000 on this machine):
```powershell
cd port_backend
$env:GARAGE_PASSWORD = "redline"
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001
```
Frontend:
```powershell
cd port_frontend
npm install
npm run dev            # http://localhost:4321
```

## Config
- Backend env: `GARAGE_PASSWORD` (default `redline` — CHANGE IT),
  `GARAGE_SECRET` (set to persist tokens across restarts), `ALLOWED_ORIGINS`.
- Frontend env: `PUBLIC_API_BASE` (default `http://localhost:8001`).

## Verification done this session
- Frontend production build compiles clean (`npm run build`).
- Backend: `/api/garage` → 401 without token; wrong password → 401; correct
  password → token → garage data returns; contact returns success.
- Both pages serve HTTP 200; hero canvas present in served HTML.

## Editing content
Everything on the site is driven by `port_backend/app/data.py`:
- `CONTENT` — hero text, about, skills, projects, redline RPM.
- `GARAGE` — private Cefiro/ZX-4RR builds + dated log entries.

## Known limitations / notes
- Contact form only prints server-side (no email/DB wired yet).
- Garage auth is lightweight (fine for a personal portfolio). For sensitive
  data: strong `GARAGE_SECRET` + HTTPS.
- No deployment configured yet.

## Suggested next steps
1. Change `GARAGE_PASSWORD` from the default.
2. Fill in real projects/build logs in `data.py`.
3. Optional: real `.glb` vehicle models on `/garage`; wire contact form to
   email; set up deployment.
