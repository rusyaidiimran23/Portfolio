"""Lights-out reaction game: global top-10 leaderboard in SQLite.

Anti-cheat is "good enough for fun": each run gets a signed, single-use ticket
from /api/game/start, and a score is only accepted if the ticket is old enough
for the lights sequence to have actually played. Plus a sane reaction range,
a per-IP rate limit, and a small filter for rude 3-letter codes.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import sqlite3
import threading
import time
from contextlib import closing
from pathlib import Path

# next to garage.json on the server (/var/lib/portfolio), next to this file locally
_garage = os.environ.get("GARAGE_FILE")
DB_PATH = Path(os.environ.get("SCORES_DB") or (Path(_garage).with_name("scores.db") if _garage else Path(__file__).with_name("scores.db")))

MIN_MS, MAX_MS = 100, 1500     # faster than 100 ms isn't human; slower isn't worth a board spot
MIN_RUN_S = 2.0                # 5 lights at ~0.6s each + hold: no real run is quicker than this
TICKET_TTL = 10 * 60
VEHICLES = {"bike", "f1"}
BLOCKED = {
    "ASS", "FUK", "FUC", "FCK", "SEX", "CUM", "DIK", "DIC", "FAG", "NIG", "NGR", "KKK", "TIT",
    "PUS", "COK", "JIZ", "WTF", "XXX", "POO", "PEE", "NAZ", "HTL", "KYS", "SUK",
}

_lock = threading.Lock()
_used: dict[str, float] = {}   # ticket nonce -> expiry (single use)
_SECRET = os.environ.get("GARAGE_SECRET") or secrets.token_hex(32)


def _db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.execute(
        """CREATE TABLE IF NOT EXISTS scores (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             code TEXT NOT NULL, ms INTEGER NOT NULL, vehicle TEXT NOT NULL,
             created INTEGER NOT NULL, ip TEXT NOT NULL)"""
    )
    return con


def _sign(msg: str) -> str:
    return hmac.new(_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()[:32]


def new_ticket() -> str:
    msg = f"{int(time.time() * 1000)}.{secrets.token_hex(8)}"
    return f"{msg}.{_sign(msg)}"


def redeem_ticket(ticket: str) -> str | None:
    """Return None if the ticket is valid (and burn it), else a reason."""
    try:
        issued, nonce, sig = ticket.split(".")
        age = time.time() - int(issued) / 1000
    except ValueError:
        return "bad ticket"
    if not hmac.compare_digest(sig, _sign(f"{issued}.{nonce}")):
        return "bad ticket"
    if age < MIN_RUN_S:
        return "too quick"
    if age > TICKET_TTL:
        return "ticket expired"
    with _lock:
        now = time.time()
        for k in [k for k, exp in _used.items() if exp < now]:
            del _used[k]
        if nonce in _used:
            return "ticket already used"
        _used[nonce] = now + TICKET_TTL
    return None


def code_ok(code: str) -> bool:
    return code not in BLOCKED


def add_score(code: str, ms: int, vehicle: str, ip: str) -> None:
    ip_hash = hashlib.sha256((ip + _SECRET).encode()).hexdigest()[:16]  # never store raw IPs
    with _lock, closing(_db()) as con, con:
        con.execute(
            "INSERT INTO scores (code, ms, vehicle, created, ip) VALUES (?, ?, ?, ?, ?)",
            (code, ms, vehicle, int(time.time()), ip_hash),
        )


def top(n: int = 10) -> list[dict]:
    """Best run per code, fastest first."""
    with _lock, closing(_db()) as con:
        rows = con.execute(
            """SELECT code, MIN(ms) AS ms,
                      (SELECT vehicle FROM scores s2 WHERE s2.code = s.code ORDER BY ms, id LIMIT 1),
                      MIN(created)
               FROM scores s GROUP BY code ORDER BY ms, MIN(id) LIMIT ?""",
            (n,),
        ).fetchall()
    return [
        {"code": c, "ms": ms, "vehicle": v, "date": time.strftime("%Y-%m-%d", time.gmtime(t))}
        for c, ms, v, t in rows
    ]
