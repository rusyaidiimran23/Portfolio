"""The site mascot crew: blob designs edited in the Garage, shown on the public site.

Stored under "crew" in garage.json (so deploys never overwrite it). Every look is
validated against the parts the frontend knows (src/scripts/crew/blob2d.ts); unknown
values are rejected rather than stored, so the public page can trust what it gets.
"""
from __future__ import annotations

import copy
import re

from . import garage_store

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
ID = re.compile(r"^[a-z0-9-]{1,24}$")
MAX_MEMBERS = 12

PARTS: dict[str, set[str]] = {
    "shape": {"round", "tall", "gumdrop", "squircle", "egg", "pear", "pancake", "onigiri", "star", "flower",
              "urchin", "cloud", "cat", "bunny", "bear", "teardrop", "onion", "crown", "dumpling", "peanut",
              "hexagon", "pebble", "slime", "heart", "ghost"},
    "eyes": {"dots", "big", "pills", "led"},
    "visor": {"none", "dark", "smoke", "sunset"},
    "head": {"none", "cap", "helmet", "fullface", "headband", "goggles"},
    "ears": {"none", "headset", "earmuffs", "antenna", "headset+antenna"},
    "prop": {"none", "flag", "wrench", "pitboard"},
    "mouth": {"smile", "cat", "grin", "none"},
    "outfit": {"none", "jacket", "suit", "vest", "bomber"},
}
COLORS = ("color", "outfitColor", "helmetColor")

DEFAULT_CREW = [{
    "id": "chief", "name": "Crew chief", "role": "main",
    "look": {"color": "#f3f3f5", "shape": "ghost", "eyes": "pills", "visor": "dark", "head": "none",
             "ears": "headset", "prop": "none", "mouth": "smile", "outfit": "suit",
             "outfitColor": "#e10600", "helmetColor": "#f3f3f5"},
}]


def clean_look(look: object) -> dict:
    """Return a validated copy of a look, or raise ValueError naming the bad field."""
    if not isinstance(look, dict):
        raise ValueError("look must be an object")
    out: dict[str, str] = {}
    for key, allowed in PARTS.items():
        v = look.get(key)
        if v not in allowed:
            raise ValueError(f"{key}: unknown value {v!r}")
        out[key] = v
    for key in COLORS:
        v = look.get(key, "#f3f3f5" if key == "helmetColor" else None)
        if not isinstance(v, str) or not HEX.match(v):
            raise ValueError(f"{key}: must be a #rrggbb colour")
        out[key] = v.lower()
    return out


def clean_members(members: object) -> list[dict]:
    if not isinstance(members, list) or not 1 <= len(members) <= MAX_MEMBERS:
        raise ValueError(f"crew must have 1 to {MAX_MEMBERS} members")
    out, seen = [], set()
    for m in members:
        if not isinstance(m, dict):
            raise ValueError("each member must be an object")
        mid = str(m.get("id", "")).strip()
        if not ID.match(mid) or mid in seen:
            raise ValueError(f"bad or duplicate id {mid!r} (a-z, 0-9, dashes)")
        seen.add(mid)
        name = str(m.get("name", "")).strip()
        if not 1 <= len(name) <= 30:
            raise ValueError("name must be 1-30 characters")
        role = "main" if m.get("role") == "main" else "crew"
        out.append({"id": mid, "name": name, "role": role, "look": clean_look(m.get("look"))})
    # exactly one main mascot: the first marked main, else the first member
    mains = [m for m in out if m["role"] == "main"]
    for m in out:
        m["role"] = "crew"
    (mains[0] if mains else out[0])["role"] = "main"
    return out


def get() -> list[dict]:
    with garage_store._lock:
        data = garage_store._load()
        return copy.deepcopy(data.get("crew") or DEFAULT_CREW)


def save(members: object) -> list[dict]:
    clean = clean_members(members)
    with garage_store._lock:
        data = garage_store._load()
        data["crew"] = clean
        garage_store._save(data)
    return copy.deepcopy(clean)
