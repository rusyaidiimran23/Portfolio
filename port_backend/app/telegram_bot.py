"""Telegram intake for the Track Day coach (stdlib only, like mailer.py).

Share a LapTrophy export to the bot and the raw file is stored on the server.
Parsing and coaching build on these stored files, so no log is ever lost.

Set in /etc/portfolio.env:

    TELEGRAM_BOT_TOKEN       from @BotFather
    TELEGRAM_WEBHOOK_SECRET  random; Telegram echoes it in a header on every call
    TELEGRAM_OWNER_ID        your numeric Telegram user id; everyone else is ignored

While TELEGRAM_OWNER_ID is unset the bot only replies with the sender's id, so you
can find yours, and stores nothing.
"""
from __future__ import annotations

import hmac
import json
import os
import re
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

from . import coach, track_compare, track_sessions

MAX_BYTES = 5 * 1024 * 1024   # a 15-minute GPS log is far smaller than this
MAX_PER_DAY = 20              # uploads will trigger paid AI calls later
ALLOWED_EXT = {".csv", ".gpx"}
API_TIMEOUT = 20

_lock = threading.Lock()
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


def upload_dir() -> Path:
    """Next to garage.json on the server, so deploys never touch it."""
    garage = os.environ.get("GARAGE_FILE")
    base = Path(garage).parent if garage else Path(__file__).parent
    return Path(os.environ.get("TRACK_UPLOADS") or base / "uploads")


def configured() -> bool:
    return bool(os.environ.get("TELEGRAM_BOT_TOKEN") and os.environ.get("TELEGRAM_WEBHOOK_SECRET"))


def secret_ok(header: str) -> bool:
    secret = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    return bool(secret) and hmac.compare_digest(header.encode(), secret.encode())


def _api(method: str, **params) -> dict:
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=urllib.parse.urlencode(params).encode(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=API_TIMEOUT) as r:
        return json.loads(r.read())


def _reply(chat_id: int, text: str) -> None:
    try:
        _api("sendMessage", chat_id=chat_id, text=text)
    except Exception as exc:  # noqa: BLE001 - never let a failed reply break intake
        print(f"[telegram] reply failed: {type(exc).__name__}")  # type only: messages can contain the token


def _download(file_id: str) -> bytes:
    path = _api("getFile", file_id=file_id)["result"]["file_path"]
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    url = f"https://api.telegram.org/file/bot{token}/{urllib.parse.quote(path)}"
    with urllib.request.urlopen(url, timeout=API_TIMEOUT) as r:
        data = r.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("file too large")
    return data


def _uploads_today(folder: Path) -> int:
    today = time.strftime("%Y%m%d", time.gmtime(time.time() + 8 * 3600))  # Malaysia time, like stats.py
    return sum(1 for f in folder.glob(f"{today}-*") if f.suffix != ".json")


def store(data: bytes, unique_id: str, ext: str, caption: str, original_name: str) -> Path:
    """Save the raw log and its note. Returns the existing path for a repeat upload.

    A re-export gets a new Telegram id, so identical bytes count as a repeat too.
    """
    folder = upload_dir()
    with _lock:
        folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        existing = next(iter(folder.glob(f"*-{unique_id}{ext}")), None)
        if existing:
            return existing
        for other in folder.glob(f"*{ext}"):
            if other.stat().st_size == len(data) and other.read_bytes() == data:
                return other
        stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime(time.time() + 8 * 3600))
        path = folder / f"{stamp}-{unique_id}{ext}"
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(data)
        tmp.replace(path)  # atomic, as in garage_store
        path.with_suffix(".json").write_text(
            json.dumps({"note": caption[:1000], "original_name": original_name[:200]}, ensure_ascii=False),
            encoding="utf-8",
        )
    return path


def handle_update(update: dict) -> dict | None:
    """Decide what to do with an update without doing any slow work.

    Returns a job for process() to run after the webhook has answered, or None.
    """
    msg = update.get("message")
    if not isinstance(msg, dict):
        return None
    sender = (msg.get("from") or {}).get("id")
    chat_id = (msg.get("chat") or {}).get("id")
    if sender is None or chat_id is None:
        return None

    owner = os.environ.get("TELEGRAM_OWNER_ID", "").strip()
    if not owner:
        return {"reply": chat_id, "text": f"Setup mode. Your Telegram user id is {sender}."}
    if str(sender) != owner:
        return None  # strangers get no reply, and cost nothing

    text = str(msg.get("text") or "").strip().lower()
    if text.split("@")[0] == "/report":
        return {"report": chat_id}

    doc = msg.get("document")
    if not isinstance(doc, dict):
        return {"reply": chat_id, "text": "Send me your LapTrophy CSV exports, or /report for your latest session."}

    name = str(doc.get("file_name") or "")
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED_EXT:
        return {"reply": chat_id, "text": "That isn't a CSV or GPX file."}
    if int(doc.get("file_size") or 0) > MAX_BYTES:
        return {"reply": chat_id, "text": "That file is too big (5 MB limit)."}

    unique_id = str(doc.get("file_unique_id") or "")
    file_id = str(doc.get("file_id") or "")
    if not _ID_RE.match(unique_id) or not file_id:
        return {"reply": chat_id, "text": "Telegram sent an unreadable file, please try again."}

    return {
        "chat_id": chat_id, "file_id": file_id, "unique_id": unique_id, "ext": ext,
        "caption": str(msg.get("caption") or ""), "name": name,
    }


def _send_report(chat_id: int, sessions: list[dict], report: dict) -> None:
    """The plain report always goes first, so slow or failed advice can't hold it back."""
    _reply(chat_id, track_compare.format_report(report))
    try:
        advice = coach.advice_for(report, sessions, upload_dir())
    except Exception as exc:  # noqa: BLE001 - advice is optional; the report has already gone
        print(f"[telegram] advice failed: {type(exc).__name__}")
        return
    if advice:
        _reply(chat_id, advice)


def process(job: dict) -> None:
    """Runs after the webhook has returned, so Telegram never waits on a download."""
    if "reply" in job:
        _reply(job["reply"], job["text"])
        return
    if "report" in job:
        sessions = track_sessions.load_all(upload_dir())
        report = track_compare.analyse(sessions)
        if report:
            _send_report(job["report"], sessions, report)
        else:
            _reply(job["report"], "No sessions with lap times yet. Send a LapTrophy track CSV.")
        return

    chat_id = job["chat_id"]
    folder = upload_dir()
    repeat = folder.is_dir() and any(folder.glob(f"*-{job['unique_id']}{job['ext']}"))
    if repeat:
        _reply(chat_id, "I already have this session.")
        return
    if folder.is_dir() and _uploads_today(folder) >= MAX_PER_DAY:
        _reply(chat_id, f"Daily limit reached ({MAX_PER_DAY} uploads). Try again tomorrow.")
        return

    try:
        data = _download(job["file_id"])
        before = track_sessions.load_all(folder)
        path = store(data, job["unique_id"], job["ext"], job["caption"], job["name"])
    except Exception as exc:  # noqa: BLE001 - tell the rider, keep the token out of the log
        print(f"[telegram] upload failed: {type(exc).__name__}")
        _reply(chat_id, "Could not save that file. Please send it again.")
        return

    try:
        in_file = len(track_sessions.parse_file(data, job["name"]))
    except (ValueError, UnicodeDecodeError):
        _reply(chat_id, f"Saved {path.name}, but I can't read that format yet.")
        return
    sessions = track_sessions.load_all(folder)
    new = track_sessions.new_sessions(before, sessions)
    _reply(chat_id, f"Saved {path.name} ({len(data) // 1024} KB): {in_file} session(s) in this file, {len(new)} new.")

    # a session only gets lap times once its track CSV has arrived, whichever file came first
    had_laps = [s for s in before if s["laps"]]
    gained_laps = track_sessions.new_sessions(had_laps, [s for s in sessions if s["laps"]])
    if gained_laps:
        report = track_compare.analyse(sessions)
        # sending old sessions shouldn't repeat the report: only speak when the newest run is what changed
        if report and any(track_sessions.same_session(s, {"start": report["latest"]["start"]}) for s in gained_laps):
            _send_report(chat_id, sessions, report)
    elif new:
        _reply(chat_id, "Send the track CSV too, so I can add lap and sector times for this session.")
