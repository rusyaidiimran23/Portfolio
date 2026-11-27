"""Garage to-do list per vehicle: upgrades, servicing and road tax.

Stored under "todo" in garage.json (deploys never overwrite it), with each vehicle's
last odometer reading under "odo". The frontend sends a vehicle's whole list on every
change; everything is validated here so the file only ever holds clean data.

Item kinds:
  upgrade  one-off job: priority, optional cost and link; done/done_on when ticked
  service  repeats every N km and/or N months, measured from last_km / last_date
  roadtax  renewal by expiry date (due_date); renewing moves it on a year
"""
from __future__ import annotations

import copy
import re

from . import garage_store

DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID = re.compile(r"^[a-z0-9-]{1,40}$")
KINDS = {"upgrade", "service", "roadtax"}
PRIORITIES = {"high", "med", "low"}
MAX_ITEMS = 100


def _text(v: object, field: str, max_len: int, required: bool = False) -> str:
    s = str(v or "").strip()
    if required and not s:
        raise ValueError(f"{field} must not be blank")
    if len(s) > max_len:
        raise ValueError(f"{field} is too long (max {max_len})")
    return s


def _date(v: object, field: str) -> str:
    s = str(v or "").strip()
    if s and not DATE.match(s):
        raise ValueError(f"{field} must be YYYY-MM-DD")
    return s


def _num(v: object, field: str, max_v: float) -> float | None:
    if v in (None, ""):
        return None
    try:
        n = float(v)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a number") from None
    if not 0 <= n <= max_v:
        raise ValueError(f"{field} is out of range")
    return int(n) if n.is_integer() else round(n, 2)


def clean_item(it: object) -> dict:
    if not isinstance(it, dict):
        raise ValueError("each item must be an object")
    kind = it.get("kind")
    if kind not in KINDS:
        raise ValueError(f"kind must be one of {sorted(KINDS)}")
    iid = str(it.get("id", "")).strip()
    if not ID.match(iid):
        raise ValueError("bad item id")
    out: dict = {"id": iid, "kind": kind, "title": _text(it.get("title"), "title", 120, required=True),
                 "notes": _text(it.get("notes"), "notes", 600)}
    if kind == "upgrade":
        pr = it.get("priority") or "med"
        if pr not in PRIORITIES:
            raise ValueError("priority must be high, med or low")
        out.update(priority=pr, cost=_num(it.get("cost"), "cost", 10_000_000),
                   link=_text(it.get("link"), "link", 500), done=bool(it.get("done")),
                   done_on=_date(it.get("done_on"), "done_on"))
        if out["link"] and not re.match(r"^https?://", out["link"]):
            raise ValueError("link must start with http:// or https://")
    elif kind == "service":
        out.update(every_km=_num(it.get("every_km"), "every_km", 1_000_000),
                   every_months=_num(it.get("every_months"), "every_months", 120),
                   last_km=_num(it.get("last_km"), "last_km", 10_000_000),
                   last_date=_date(it.get("last_date"), "last_date"))
        if not out["every_km"] and not out["every_months"]:
            raise ValueError("a service needs every_km or every_months")
    else:  # roadtax
        out["due_date"] = _date(it.get("due_date"), "due_date")
        if not out["due_date"]:
            raise ValueError("road tax needs its expiry date")
    return out


def clean_list(items: object) -> list[dict]:
    if not isinstance(items, list) or len(items) > MAX_ITEMS:
        raise ValueError(f"items must be a list of at most {MAX_ITEMS}")
    out, seen = [], set()
    for it in items:
        c = clean_item(it)
        if c["id"] in seen:
            raise ValueError(f"duplicate item id {c['id']!r}")
        seen.add(c["id"])
        out.append(c)
    return out


def _active_ids(data: dict) -> list[str]:
    return [b["id"] for b in data["builds"] if not b.get("sold")]


def get() -> dict:
    with garage_store._lock:
        data = garage_store._load()
        ids = _active_ids(data)
        todo, odo = data.get("todo", {}), data.get("odo", {})
        return {"vehicles": ids,
                "todo": {i: copy.deepcopy(todo.get(i, [])) for i in ids},
                "odo": {i: odo.get(i) for i in ids}}


def save(build_id: str, items: object, odo: object = None) -> dict | None:
    """Replace one vehicle's list (and odometer). None if it's not an active vehicle."""
    clean = clean_list(items)
    km = _num(odo, "odo", 10_000_000)
    with garage_store._lock:
        data = garage_store._load()
        if build_id not in _active_ids(data):
            return None
        data.setdefault("todo", {})[build_id] = clean
        if km is not None:
            data.setdefault("odo", {})[build_id] = km
        garage_store._save(data)
        return {"items": copy.deepcopy(clean), "odo": data.get("odo", {}).get(build_id)}
