"""Privacy-friendly visitor stats (SQLite, no cookies).

A visitor is counted as hash(daily salt + IP + user agent): unique per day,
impossible to follow across days, and raw IPs are never stored. Bots and
browsers sending Do-Not-Track / Global Privacy Control are not counted.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import threading
import time
from contextlib import closing
from pathlib import Path
from urllib.parse import urlparse

_garage = os.environ.get("GARAGE_FILE")
DB_PATH = Path(os.environ.get("STATS_DB") or (Path(_garage).with_name("stats.db") if _garage else Path(__file__).with_name("stats.db")))
_SECRET = os.environ.get("GARAGE_SECRET") or secrets.token_hex(32)
KEEP_DAYS = 400
EVENTS = {"view", "project", "game", "contact", "garage"}
BOT_RE = re.compile(r"bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|curl|wget|python|headless|lighthouse", re.I)

_lock = threading.RLock()  # re-entrant: report() calls live()


def _db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.execute(
        """CREATE TABLE IF NOT EXISTS hits (
             ts INTEGER NOT NULL, day TEXT NOT NULL, visitor TEXT NOT NULL,
             kind TEXT NOT NULL, path TEXT NOT NULL, label TEXT NOT NULL, ref TEXT NOT NULL)"""
    )
    con.execute("CREATE INDEX IF NOT EXISTS hits_day ON hits(day)")
    return con


def _today(ts: float | None = None) -> str:
    # Malaysia time (UTC+8) so "today" matches your day
    return time.strftime("%Y-%m-%d", time.gmtime((ts or time.time()) + 8 * 3600))


def _visitor(ip: str, ua: str, day: str) -> str:
    salt = hmac.new(_SECRET.encode(), day.encode(), hashlib.sha256).digest()
    return hashlib.sha256(salt + ip.encode() + ua.encode()).hexdigest()[:16]


def skip(ua: str, dnt: str, gpc: str) -> bool:
    return not ua or bool(BOT_RE.search(ua)) or dnt == "1" or gpc == "1"


def _ref_host(ref: str) -> str:
    host = (urlparse(ref).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def record(kind: str, path: str, label: str, ref: str, ip: str, ua: str, own_host: str) -> None:
    now = time.time()
    day = _today(now)
    ref_host = _ref_host(ref)
    if ref_host == own_host.split(":")[0].lower():
        ref_host = ""  # moving around your own site isn't a referral
    with _lock, closing(_db()) as con, con:
        con.execute(
            "INSERT INTO hits VALUES (?, ?, ?, ?, ?, ?, ?)",
            (int(now), day, _visitor(ip, ua, day), kind, path[:120], label[:60], ref_host[:80]),
        )
        if int(now) % 50 == 0:  # now and then, forget old rows
            con.execute("DELETE FROM hits WHERE ts < ?", (int(now) - KEEP_DAYS * 86400,))


def live() -> dict:
    """Public numbers for the homepage LED ticker."""
    today = _today()
    month = today[:7]
    with _lock, closing(_db()) as con:
        q = lambda sql, *a: con.execute(sql, a).fetchone()[0] or 0  # noqa: E731
        return {
            "today": q("SELECT COUNT(DISTINCT visitor) FROM hits WHERE day = ?", today),
            "month": q("SELECT COUNT(*) FROM (SELECT DISTINCT day, visitor FROM hits WHERE day LIKE ?)", month + "%"),
            "total": q("SELECT COUNT(*) FROM (SELECT DISTINCT day, visitor FROM hits)"),
            "online": q("SELECT COUNT(DISTINCT visitor) FROM hits WHERE ts > ?", int(time.time()) - 300),
        }


def report(days: int = 30) -> dict:
    """Private dashboard numbers (Garage)."""
    since = _today(time.time() - (days - 1) * 86400)
    with _lock, closing(_db()) as con:
        daily = {d: (v, p) for d, v, p in con.execute(
            "SELECT day, COUNT(DISTINCT visitor), SUM(kind = 'view') FROM hits WHERE day >= ? GROUP BY day", (since,))}
        top = lambda sql: [{"name": n, "count": c} for n, c in con.execute(sql, (since,))]  # noqa: E731
        series = []
        for i in range(days - 1, -1, -1):
            d = _today(time.time() - i * 86400)
            v, p = daily.get(d, (0, 0))
            series.append({"day": d, "visitors": v, "views": p})
        return {
            **live(),
            "days": series,
            "refs": top("SELECT ref, COUNT(DISTINCT day || visitor) c FROM hits WHERE day >= ? AND ref != '' AND kind = 'view' GROUP BY ref ORDER BY c DESC LIMIT 8"),
            "projects": top("SELECT label, COUNT(DISTINCT day || visitor) c FROM hits WHERE day >= ? AND kind = 'project' GROUP BY label ORDER BY c DESC LIMIT 10"),
            "events": top("SELECT kind, COUNT(*) c FROM hits WHERE day >= ? AND kind NOT IN ('view', 'project') GROUP BY kind ORDER BY c DESC"),
        }
