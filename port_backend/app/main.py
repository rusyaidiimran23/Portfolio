r"""FastAPI backend for the portfolio.

Run (from port_backend/):
    .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8001

Public:
    GET  /api/content        -> homepage content
    POST /api/contact        -> contact form  {name, email, message} -> emailed (see mailer.py)
Private (Cefiro / ZX-4RR) — saved in app/garage.json:
    POST /api/auth           -> {password} -> {token}
    GET  /api/garage         -> requires header  Authorization: Bearer <token>
    POST   /api/garage/{id}/log -> {date, time?, note}  add a build-log entry (auth)
    DELETE /api/garage/{id}/log -> {date, time?, note}  remove that entry (auth)
Easter-egg reaction game (game.py, SQLite):
    GET  /api/game/top       -> top 10 reaction times
    POST /api/game/start     -> {ticket}  one per run
    POST /api/game/score     -> {ticket, code, ms, vehicle}
Visitor stats (stats.py, SQLite, no cookies):
    POST /api/hit            -> {kind, path, label?, ref?}  page view / event
    GET  /api/stats/live     -> public numbers for the homepage LED ticker
    GET  /api/stats          -> private dashboard (auth)
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import time

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from .data import CONTENT
from . import game, garage_store, mailer, stats

# --- config -----------------------------------------------------------------
# Change the garage password by setting GARAGE_PASSWORD in the environment.
# A random SECRET is generated per process; set GARAGE_SECRET to keep tokens
# valid across restarts.
GARAGE_PASSWORD = os.environ.get("GARAGE_PASSWORD", "redline")
SECRET = os.environ.get("GARAGE_SECRET", secrets.token_hex(32))
TOKEN_TTL = 60 * 60 * 8  # 8 hours

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:4321,http://127.0.0.1:4321",
).split(",")

app = FastAPI(title="Portfolio API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# --- tiny signed-token auth (no external deps) ------------------------------

def _sign(msg: str) -> str:
    return hmac.new(SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()


def make_token() -> str:
    exp = str(int(time.time()) + TOKEN_TTL)
    return f"{exp}.{_sign(exp)}"


def verify_token(token: str) -> bool:
    try:
        exp, sig = token.split(".", 1)
    except ValueError:
        return False
    if not hmac.compare_digest(sig, _sign(exp)):
        return False
    return int(exp) > time.time()


def require_auth(authorization: str = Header(default="")) -> None:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not verify_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )


# --- models -----------------------------------------------------------------

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ContactForm(BaseModel):
    name: str
    email: str
    message: str
    website: str = ""  # honeypot: hidden on the page, only bots fill it in

    @field_validator("name", "message")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("name")
    @classmethod
    def name_len(cls, v: str) -> str:
        if len(v) > 100:
            raise ValueError("name is too long")
        return v

    @field_validator("message")
    @classmethod
    def message_len(cls, v: str) -> str:
        if len(v) > 5000:
            raise ValueError("message is too long (max 5000 characters)")
        return v

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("invalid email")
        return v


class Login(BaseModel):
    password: str


# --- routes -----------------------------------------------------------------

@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/content")
def content() -> dict:
    return CONTENT


# simple per-IP rate limit for the contact form: 5 messages per hour
_CONTACT_LIMIT, _CONTACT_WINDOW = 5, 3600
_contact_hits: dict[str, list[float]] = {}


@app.post("/api/contact")
def contact(form: ContactForm, request: Request) -> dict:
    ok = {"ok": True, "message": "Message received — I'll get back to you."}
    if form.website:  # honeypot tripped: pretend it worked, send nothing
        return ok

    ip = request.client.host if request.client else ""
    now = time.time()
    hits = [t for t in _contact_hits.get(ip, []) if now - t < _CONTACT_WINDOW]
    if len(hits) >= _CONTACT_LIMIT:
        raise HTTPException(status_code=429, detail="Too many messages — try again later.")
    _contact_hits[ip] = hits + [now]

    if not mailer.configured():  # local dev: just log it
        print(f"[contact] {form.name} <{form.email}> ({ip}): {form.message}")
        return ok
    try:
        mailer.send_contact(form.name, form.email, form.message, ip)
    except Exception as exc:  # noqa: BLE001 — report any SMTP failure the same way
        print(f"[contact] EMAIL FAILED ({exc!r}) — {form.name} <{form.email}>: {form.message}")
        raise HTTPException(status_code=502, detail="Could not send right now — please email me directly.")
    return ok


@app.post("/api/auth")
def auth(login: Login) -> dict:
    if not hmac.compare_digest(login.password, GARAGE_PASSWORD):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong password.",
        )
    return {"token": make_token()}


@app.get("/api/garage", dependencies=[Depends(require_auth)])
def garage() -> dict:
    return garage_store.get()


_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^(\d{2}:\d{2})?$")


class LogEntry(BaseModel):
    date: str
    time: str = ""
    note: str

    @field_validator("date")
    @classmethod
    def valid_date(cls, v: str) -> str:
        if not _DATE_RE.match(v.strip()):
            raise ValueError("date must be YYYY-MM-DD")
        return v.strip()

    @field_validator("time")
    @classmethod
    def valid_time(cls, v: str) -> str:
        if not _TIME_RE.match(v.strip()):
            raise ValueError("time must be HH:MM")
        return v.strip()

    @field_validator("note")
    @classmethod
    def valid_note(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("note must not be blank")
        if len(v) > 600:
            raise ValueError("note is too long (max 600 characters)")
        return v


@app.post("/api/garage/{build_id}/log", dependencies=[Depends(require_auth)])
def add_log(build_id: str, entry: LogEntry) -> dict:
    build = garage_store.add_log(build_id, entry.date, entry.time, entry.note)
    if build is None:
        raise HTTPException(status_code=404, detail="No such build.")
    return build


_LAP_RE = re.compile(r"^(\d{1,2}:)?\d{1,2}\.\d{1,3}$")  # 1:02.345 or 58.12


class TrackSession(BaseModel):
    date: str
    vehicle: str = ""
    best: str          # best lap, e.g. "1:02.345"
    notes: str = ""

    @field_validator("date")
    @classmethod
    def valid_date(cls, v: str) -> str:
        if not _DATE_RE.match(v.strip()):
            raise ValueError("date must be YYYY-MM-DD")
        return v.strip()

    @field_validator("best")
    @classmethod
    def valid_best(cls, v: str) -> str:
        v = v.strip()
        if not _LAP_RE.match(v):
            raise ValueError("lap time must look like 1:02.345 or 58.12")
        return v

    @field_validator("vehicle", "notes")
    @classmethod
    def short(cls, v: str) -> str:
        v = v.strip()
        if len(v) > 300:
            raise ValueError("too long")
        return v


@app.post("/api/garage/trackday/{track_id}/session", dependencies=[Depends(require_auth)])
def add_session(track_id: str, s: TrackSession) -> dict:
    td = garage_store.add_session(track_id, s.model_dump())
    if td is None:
        raise HTTPException(status_code=404, detail="No such track.")
    return td


@app.delete("/api/garage/trackday/{track_id}/session", dependencies=[Depends(require_auth)])
def delete_session(track_id: str, s: TrackSession) -> dict:
    td = garage_store.delete_session(track_id, s.model_dump())
    if td is None:
        raise HTTPException(status_code=404, detail="No such track.")
    return td


@app.delete("/api/garage/{build_id}/log", dependencies=[Depends(require_auth)])
def delete_log(build_id: str, entry: LogEntry) -> dict:
    build = garage_store.delete_log(build_id, entry.date, entry.time, entry.note)
    if build is None:
        raise HTTPException(status_code=404, detail="No such build.")
    return build


# --- easter egg: lights-out reaction game ---------------------------------------

_GAME_LIMIT, _GAME_WINDOW = 30, 3600   # score submissions per IP per hour
_game_hits: dict[str, list[float]] = {}


class GameScore(BaseModel):
    ticket: str
    code: str
    ms: int
    vehicle: str

    @field_validator("code")
    @classmethod
    def valid_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not re.fullmatch(r"[A-Z]{3}", v):
            raise ValueError("code must be 3 letters")
        if not game.code_ok(v):
            raise ValueError("pick another code")
        return v

    @field_validator("ms")
    @classmethod
    def valid_ms(cls, v: int) -> int:
        if not game.MIN_MS <= v <= game.MAX_MS:
            raise ValueError("reaction time out of range")
        return v

    @field_validator("vehicle")
    @classmethod
    def valid_vehicle(cls, v: str) -> str:
        if v not in game.VEHICLES:
            raise ValueError("unknown vehicle")
        return v


@app.get("/api/game/top")
def game_top() -> list[dict]:
    return game.top()


@app.post("/api/game/start")
def game_start() -> dict:
    return {"ticket": game.new_ticket()}


@app.post("/api/game/score")
def game_score(s: GameScore, request: Request) -> list[dict]:
    ip = request.client.host if request.client else ""
    now = time.time()
    hits = [t for t in _game_hits.get(ip, []) if now - t < _GAME_WINDOW]
    if len(hits) >= _GAME_LIMIT:
        raise HTTPException(status_code=429, detail="Too many runs — cool the tyres and try later.")
    _game_hits[ip] = hits + [now]
    reason = game.redeem_ticket(s.ticket)
    if reason:
        raise HTTPException(status_code=400, detail=reason)
    game.add_score(s.code, s.ms, s.vehicle, ip)
    return game.top()


# --- visitor stats ----------------------------------------------------------------

_HIT_LIMIT, _HIT_WINDOW = 300, 3600
_hit_hits: dict[str, list[float]] = {}


class Hit(BaseModel):
    kind: str = "view"
    path: str = "/"
    label: str = ""
    ref: str = ""


@app.post("/api/hit")
def hit(h: Hit, request: Request) -> dict:
    ip = request.client.host if request.client else ""
    hd = request.headers
    if h.kind not in stats.EVENTS or stats.skip(hd.get("user-agent", ""), hd.get("dnt", ""), hd.get("sec-gpc", "")):
        return {"ok": True}
    now = time.time()
    hits = [t for t in _hit_hits.get(ip, []) if now - t < _HIT_WINDOW]
    if len(hits) >= _HIT_LIMIT:
        return {"ok": True}  # quietly drop floods
    _hit_hits[ip] = hits + [now]
    stats.record(h.kind, h.path, h.label, h.ref, ip, hd.get("user-agent", ""), hd.get("host", ""))
    return {"ok": True}


@app.get("/api/stats/live")
def stats_live() -> dict:
    best = game.top(1)
    return {**stats.live(), "fastest": best[0] if best else None}


@app.get("/api/stats", dependencies=[Depends(require_auth)])
def stats_report() -> dict:
    return stats.report()
