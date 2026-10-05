"""Garage data that can be edited from the site.

The builds live in garage.json next to this file. On first run it's seeded
from GARAGE in data.py; after that, garage.json is the source of truth (log
entries added on the site are saved there). To edit a build's details by hand,
edit garage.json while the server is stopped.
"""
from __future__ import annotations

import copy
import json
import os
import threading
from pathlib import Path

from .data import GARAGE

# GARAGE_FILE lets the server keep the data outside the app folder (so deploys never touch it)
PATH = Path(os.environ.get("GARAGE_FILE") or Path(__file__).with_name("garage.json"))
_lock = threading.Lock()


def _load() -> dict:
    if not PATH.exists():
        _save(copy.deepcopy(GARAGE))
    return json.loads(PATH.read_text(encoding="utf-8"))


def _save(data: dict) -> None:
    tmp = PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(PATH)  # atomic swap so a crash never leaves a half-written file


def get() -> dict:
    with _lock:
        return _load()


def _find(data: dict, build_id: str) -> dict | None:
    return next((b for b in data["builds"] if b.get("id") == build_id), None)


def add_log(build_id: str, date: str, time: str, note: str) -> dict | None:
    """Append a log entry; returns the updated build, or None if no such build."""
    with _lock:
        data = _load()
        build = _find(data, build_id)
        if build is None:
            return None
        entry = {"date": date, "note": note}
        if time:
            entry["time"] = time
        build.setdefault("log", []).append(entry)
        _save(data)
        return build


def delete_log(build_id: str, date: str, time: str, note: str) -> dict | None:
    """Remove the first entry matching date/time/note; returns the build, or None."""
    with _lock:
        data = _load()
        build = _find(data, build_id)
        if build is None:
            return None
        log = build.get("log", [])
        for i, e in enumerate(log):
            if e.get("date") == date and e.get("time", "") == time and e.get("note") == note:
                del log[i]
                _save(data)
                break
        return build
