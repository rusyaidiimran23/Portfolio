# Rusyaidi Yeng — Portfolio

F1 / Forza-styled portfolio: LED-board showcase, spotlit deployment map,
scroll-scrubbed animations, project case studies, and a password-protected
**Garage** (vehicle select, build logs, rider's notes).

- `port_frontend/` — Astro site (`src/pages/index.astro`, `garage.astro`, scripts in `src/scripts/`)
- `port_backend/` — FastAPI: content, contact form → email, garage login + build logs
- `photos/` — photo drop folders (one per project / vehicle)
- `deploy/` — one-command VPS setup + deploy

## Run locally
```powershell
# backend (port 8001)
cd port_backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:GARAGE_PASSWORD = "redline"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001

# frontend (http://localhost:4321)
cd port_frontend
npm install
npm run dev
```

## Edit content
- Projects, about, skills: `port_backend/app/data.py`
- Garage vehicles + logs: on the site (+ Add log), or `port_backend/app/garage.json`
  (created from `GARAGE` in data.py on first run; not committed — it's private)
- Photos: drop into `photos/<project-or-vehicle-id>/` as `1 - Caption.jpg`, then run
  `.\update-photos.ps1` (resizes, strips GPS, writes `public/work/photos.json`)

## Deploy (VPS, Ubuntu 24.04)
```powershell
.\deploy\deploy.ps1 -Server root@SERVER_IP -Site yourdomain.com -Setup   # first time
.\deploy\deploy.ps1 -Server root@SERVER_IP                                # updates
```
Secrets (garage password, SMTP for the contact form) live on the server in
`/etc/portfolio.env` — never in this repo.

Turn on contact-form email (asks for a Gmail App Password, hidden, then sends a test email):
```powershell
.\deploy\set-email.ps1 -Server root@SERVER_IP -Gmail you@gmail.com
```

Visitor stats: counted on your own server (no cookies, bots and Do-Not-Track skipped),
shown publicly as the LIVE ticker on the homepage and in detail under **Garage → Stats**.
Your own browser stops being counted once you've unlocked the Garage on it.
