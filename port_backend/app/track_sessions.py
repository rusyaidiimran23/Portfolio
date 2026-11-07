"""Read LapTrophy exports and merge them into one list of sessions.

A session can arrive many times: every CSV export repeats all past sessions at
that track, a GPX and a CSV can describe the same session, and any file can simply
be sent twice. So nothing is ever added up: a session's identity is its start time,
and load_all() rebuilds the list from the stored raw files.

    Track CSV    one file per track, every session: lap times, 3 sectors, avg/top speed
    Session CSV  one file per session, about one row a second: position and speed (also lean, unused)
    GPX          one file per session: position only, so a session CSV replaces it
"""
from __future__ import annotations

import csv
import io
import json
import math
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

LOCAL_TZ = timezone(timedelta(hours=8))  # LapTrophy's CSV has local times with no offset; rides are in Malaysia
MATCH_SECONDS = 5                        # a CSV and a GPX of one session may start a moment apart
EARTH_M = 6_371_000
CSV_COLUMNS = {"session date", "lap index", "lap start", "time (s)", "sector1 (s)", "sector2 (s)", "sector3 (s)"}
TELEMETRY_COLUMNS = {"time(sec)", "lat(deg)", "lon(deg)", "speed(m/s)"}


def _num(value: str | None) -> float | None:
    try:
        return float(value) if value else None
    except ValueError:
        return None


def _local_to_utc(text: str) -> datetime:
    return datetime.strptime(text.strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=LOCAL_TZ).astimezone(timezone.utc)


def parse_csv(data: bytes, name: str = "") -> list[dict]:
    """One dict per session: {start, track, laps}. Raises ValueError if this isn't a LapTrophy CSV."""
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")), delimiter=";")
    if not CSV_COLUMNS <= set(reader.fieldnames or []):
        raise ValueError("not a LapTrophy lap CSV")
    match = re.fullmatch(r"LapTrophy (.+)\.csv", name, re.I)
    track = match.group(1).strip() if match else ""

    sessions: dict[datetime, dict[int, dict]] = {}
    for row in reader:
        time_s, index = _num(row["time (s)"]), _num(row["lap index"])
        if time_s is None or index is None:
            continue
        laps = sessions.setdefault(_local_to_utc(row["session date"]), {})
        laps[int(index)] = {   # a repeated lap index overwrites, never adds
            "lap": int(index),
            "start": _local_to_utc(row["lap start"]),
            "time": time_s,
            "sectors": [_num(row[f"sector{k} (s)"]) for k in (1, 2, 3)],  # None where LapTrophy left it blank
            "avg_kmh": _num(row.get("avg. speed (km/h)")),
            "max_kmh": _num(row.get("max. speed (km/h)")),
        }
    if not sessions:
        raise ValueError("no laps in this CSV")
    return [{"start": start, "track": track, "laps": [laps[i] for i in sorted(laps)], "points": []}
            for start, laps in sessions.items()]


def parse_gpx(data: bytes) -> list[dict]:
    """A one-session list: {start, points}, points being time-ordered (datetime, lat, lon)."""
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:  # LapTrophy never sends these; they enable XML bombs
        raise ValueError("unexpected XML declarations")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError("not valid GPX") from exc

    by_time: dict[datetime, tuple[float, float]] = {}
    for pt in root.iter():
        if not pt.tag.endswith("trkpt"):
            continue
        stamp = next((c.text for c in pt if c.tag.endswith("time")), None)
        lat, lon = _num(pt.get("lat")), _num(pt.get("lon"))
        if not stamp or lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180:
            continue
        when = datetime.fromisoformat(stamp.replace("Z", "+00:00")).astimezone(timezone.utc)
        by_time.setdefault(when, (lat, lon))  # a repeated timestamp keeps its first reading
    if not by_time:
        raise ValueError("no GPS points in this GPX")
    points = [(t, *by_time[t]) for t in sorted(by_time)]
    return [{"start": points[0][0], "track": "", "laps": [], "points": points}]


def parse_telemetry(data: bytes) -> list[dict]:
    """LapTrophy's per-session CSV, one row a second. Points gain a speed in m/s; lean is ignored on purpose."""
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")), delimiter=";")
    if not TELEMETRY_COLUMNS <= set(reader.fieldnames or []):
        raise ValueError("not a LapTrophy telemetry CSV")
    by_time: dict[datetime, tuple] = {}
    for row in reader:
        stamp, lat, lon, speed = (_num(row[c]) for c in ("time(sec)", "lat(deg)", "lon(deg)", "speed(m/s)"))
        if stamp is None or lat is None or lon is None or abs(lat) > 90 or abs(lon) > 180:
            continue
        when = datetime.fromtimestamp(stamp, timezone.utc)
        by_time.setdefault(when, (lat, lon, speed if speed is not None and speed >= 0 else None))
    if not by_time:
        raise ValueError("no readings in this CSV")
    points = [(t, *by_time[t]) for t in sorted(by_time)]
    start = (points[0][0] + timedelta(microseconds=500_000)).replace(microsecond=0)
    return [{"start": start, "track": "", "laps": [], "points": points}]


def parse_file(data: bytes, name: str) -> list[dict]:
    if name.lower().endswith(".gpx"):
        return parse_gpx(data)
    first_line = data[:500].decode("utf-8-sig", "replace").splitlines()[:1]
    if first_line and "time(sec)" in first_line[0]:
        return parse_telemetry(data)
    return parse_csv(data, name)


def _point_quality(points: list[tuple]) -> tuple[bool, int]:
    """Speed readings beat GPX positions, whichever arrives first; then more points win."""
    return (bool(points) and len(points[0]) > 3, len(points))


def same_session(a: dict, b: dict) -> bool:
    return abs((a["start"] - b["start"]).total_seconds()) <= MATCH_SECONDS


def new_sessions(before: list[dict], after: list[dict]) -> list[dict]:
    """Sessions in `after` that weren't there before, allowing for small differences in start time."""
    return [s for s in after if not any(same_session(s, old) for old in before)]


def merge(parsed: list[dict]) -> list[dict]:
    """Combine parsed sessions into one per start time, oldest first.

    Feed files oldest first: newer lap data replaces older, and the longest GPS
    track is kept.
    """
    merged: list[dict] = []
    for session in parsed:
        target = next((m for m in merged if same_session(m, session)), None)
        if target is None:
            merged.append({**session, "laps": list(session["laps"]), "points": list(session["points"])})
            continue
        if session["laps"]:
            target["laps"] = list(session["laps"])
            target["start"] = session["start"]  # the CSV's session date is the canonical start
        target["track"] = session["track"] or target["track"]
        if _point_quality(session["points"]) > _point_quality(target["points"]):
            target["points"] = list(session["points"])
    return sorted(merged, key=lambda s: s["start"])


def load_all(folder: Path) -> list[dict]:
    """Every session in the stored raw files. Unreadable files are skipped, never fatal."""
    parsed: list[dict] = []
    if not folder.is_dir():
        return []
    for path in sorted(folder.iterdir()):  # names start with a timestamp, so oldest first
        if path.suffix.lower() not in {".csv", ".gpx"}:
            continue
        original = path.name
        note = path.with_suffix(".json")
        if note.exists():
            try:
                original = json.loads(note.read_text(encoding="utf-8")).get("original_name") or original
            except ValueError:
                pass
        try:
            parsed += parse_file(path.read_bytes(), original if original.lower().endswith(path.suffix.lower()) else path.name)
        except (ValueError, OSError, UnicodeDecodeError):
            print(f"[track] skipped unreadable file: {path.name}")
    return merge(parsed)


def _metres(a: tuple, b: tuple) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[1], a[2], b[1], b[2]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_M * math.asin(math.sqrt(h))


def lap_points(session: dict, lap: dict) -> list[tuple]:
    """The GPS points recorded during one lap."""
    end = lap["start"] + timedelta(seconds=lap["time"])
    return [p for p in session["points"] if lap["start"] <= p[0] <= end]


def lap_track(points: list[tuple]) -> dict:
    """Distance around the lap and GPS-derived speed at each point."""
    distance, trace = 0.0, []
    for a, b in zip(points, points[1:]):
        step = _metres(a, b)
        seconds = (b[0] - a[0]).total_seconds()
        distance += step
        if seconds > 0:
            trace.append((round(distance, 1), round(step / seconds * 3.6, 1)))
    return {"distance_m": round(distance, 1), "trace": trace}
