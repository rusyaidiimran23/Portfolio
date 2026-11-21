"""Turn sessions uploaded through the Telegram bot into what Track Day displays.

Stored sessions stay in garage.json. Uploaded ones are rebuilt from the raw logs on
each change and shown alongside them, so a re-sent file can't create a duplicate.
"""
from __future__ import annotations

import copy
from pathlib import Path

from . import coach as ai_coach, track_compare, track_sessions
from .track_sessions import LOCAL_TZ

_cache: tuple[tuple, list[dict]] | None = None


def _sessions(folder: Path) -> list[dict]:
    """load_all, re-read only when the folder's files have changed."""
    global _cache
    if not folder.is_dir():
        return []
    signature = tuple(sorted((f.name, f.stat().st_size, f.stat().st_mtime_ns) for f in folder.iterdir()))
    if _cache is None or _cache[0] != signature:
        _cache = (signature, track_sessions.load_all(folder))
    return _cache[1]


def _speed_points(points: list[tuple]) -> list[tuple]:
    return [p for p in points if len(p) > 3 and p[3] is not None]


def _lap_trace(points: list[tuple], length_m: float) -> list[list[float]]:
    """[distance, km/h] from recorded speed, scaled so every lap ends at the track's length."""
    if len(points) < 2:
        return []
    distances = [0.0]
    for a, b in zip(points, points[1:]):
        distances.append(distances[-1] + (a[3] + b[3]) / 2 * (b[0] - a[0]).total_seconds())
    scale = length_m / distances[-1] if distances[-1] else 0
    return [[round(d * scale), round(p[3] * 3.6, 1)] for d, p in zip(distances, points)]


def _map_line(points: list[tuple], fit: dict) -> list[list[float]]:
    """[x, y, km/h] in the drawn map's coordinates."""
    line = []
    for p in points:
        east, north = (p[2] - fit["lon0"]) * 1e5, (p[1] - fit["lat0"]) * 1e5
        line.append([
            round(fit["x"][0] * east + fit["x"][1] * north + fit["x"][2], 1),
            round(fit["y"][0] * east + fit["y"][1] * north + fit["y"][2], 1),
            round(p[3] * 3.6),
        ])
    return line


def _telemetry(session: dict, track: dict) -> dict:
    laps = session["laps"]
    best = min(laps, key=lambda lap: lap["time"])
    compare = next((lap for lap in laps if lap["lap"] == 2), best)
    length = round(track["length_km"] * 1000)
    tracked = dict(session, points=_speed_points(session["points"]))
    best_points = track_sessions.lap_points(tracked, best)
    fit = track.get("map_fit")
    speeds = [lap["max_kmh"] for lap in laps if lap["max_kmh"] is not None]
    return {
        "lap_length_m": length,
        "laps": [lap["time"] for lap in laps],
        "sectors": [lap["sectors"] for lap in laps],
        "best_lap": best["lap"],
        "compare_lap": compare["lap"],
        "top_speed": round(max(speeds)) if speeds else 0,
        "trace_best": _lap_trace(best_points, length),
        "trace_compare": _lap_trace(track_sessions.lap_points(tracked, compare), length),
        "map_best": _map_line(best_points, fit) if fit else [],
    }


def trackday_view(trackday: dict, folder: Path) -> dict:
    """The stored Track Day block plus every uploaded session and each track's latest report."""
    view = copy.deepcopy(trackday)
    uploads = _sessions(folder)
    dismissed = set(view.get("dismissed", []))
    tracks = {t["laptrophy"]: t for t in view["tracks"] if t.get("laptrophy")}
    coach: dict[str, str] = {}

    for name, track in tracks.items():
        here = [s for s in uploads if s["track"] == name and s["laps"]]
        report = track_compare.analyse(here)
        if report:
            text = track_compare.format_report(report)
            advice = ai_coach.saved_advice(folder, {"start": report["latest"]["start"]})
            coach[track["id"]] = f"{text}\n\n{advice}" if advice else text
        for session in here:
            source = track_sessions.source_id(session)
            if source in dismissed:
                continue
            stored = next((s for s in view["sessions"] if s.get("source") == source), None)
            if stored:
                view["sessions"].remove(stored)
            best = min(lap["time"] for lap in session["laps"])
            view["sessions"].append({
                "track": track["id"],
                "date": session["start"].astimezone(LOCAL_TZ).strftime("%Y-%m-%d %H:%M"),
                "vehicle": (stored or {}).get("vehicle") or track.get("vehicle", ""),
                "best": track_compare.fmt_lap(best),
                "notes": "",
                "laps": [lap["time"] for lap in session["laps"]],
                "source": source,
                "uploaded": True,
                "telemetry": _telemetry(session, track),
            })
    view["coach"] = coach
    return view
