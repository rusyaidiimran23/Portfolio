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

from .data import GARAGE, TRACKDAY

# GARAGE_FILE lets the server keep the data outside the app folder (so deploys never touch it)
PATH = Path(os.environ.get("GARAGE_FILE") or Path(__file__).with_name("garage.json"))
_lock = threading.Lock()


def _load() -> dict:
    if not PATH.exists():
        _save(copy.deepcopy(GARAGE))
    data = json.loads(PATH.read_text(encoding="utf-8"))
    # specs, photos-related fields and reviews come from data.py (so edits there reach the
    # live server); only the build logs added on the site live in garage.json
    seed = {b["id"]: b for b in GARAGE["builds"]}
    for b in data["builds"]:
        b.update({k: copy.deepcopy(v) for k, v in seed.get(b["id"], {}).items() if k != "log"})
    known = {b["id"] for b in data["builds"]}
    data["builds"] += [copy.deepcopy(b) for i, b in seed.items() if i not in known]
    order = list(seed)  # show them in data.py's order (sold ones last)
    data["builds"].sort(key=lambda b: order.index(b["id"]) if b["id"] in order else len(order))
    if "trackday" not in data:  # older garage.json (e.g. the live server): add Track Day once
        data["trackday"] = copy.deepcopy(TRACKDAY)
        _save(data)
    return data


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


# --- Track Day sessions ---------------------------------------------------------

def add_session(track_id: str, entry: dict) -> dict | None:
    """Add a track-day session; returns the updated trackday block, or None if no such track."""
    with _lock:
        data = _load()
        td = data["trackday"]
        if not any(t["id"] == track_id for t in td["tracks"]):
            return None
        td["sessions"].append({"track": track_id, **entry})
        _save(data)
        return td


def delete_session(track_id: str, entry: dict) -> dict | None:
    """Remove the first session matching track/date/best/vehicle; returns the trackday block."""
    with _lock:
        data = _load()
        td = data["trackday"]
        if not any(t["id"] == track_id for t in td["tracks"]):
            return None
        for i, s in enumerate(td["sessions"]):
            if s.get("track") == track_id and all(s.get(k, "") == entry.get(k, "") for k in ("date", "best", "vehicle")):
                del td["sessions"][i]
                _save(data)
                break
        return td
