"""Compare a session with the previous one, plain code and exact numbers.

Every faster/slower call is made here, not by an AI. An AI may only reword the
result. Lap and sector times are the trusted data; GPS points are not used, because
1 Hz phone GPS is too noisy to time a corner (see track_sessions.py).
"""
from __future__ import annotations

import math
import statistics as st

SECTORS = (0, 1, 2)
SLOW_LAP = 1.07         # slower than best + 7% is an in-lap, traffic or a mistake, not representative
MIN_DIFFERENCE = 0.05   # never call a gap smaller than this real, however consistent the laps


def clean_laps(session: dict) -> list[dict]:
    """Laps that show real pace: not the first lap, and not far off the session's best."""
    flying = [lap for lap in session["laps"] if lap["lap"] > 1]
    if not flying:
        return []
    limit = min(lap["time"] for lap in flying) * SLOW_LAP
    return [lap for lap in flying if lap["time"] <= limit]


def _spread(values: list[float]) -> float:
    return st.stdev(values) if len(values) > 1 else 0.0


def summarize(session: dict) -> dict | None:
    laps = clean_laps(session)
    if not laps:
        return None
    times = [lap["time"] for lap in laps]
    best = min(laps, key=lambda lap: lap["time"])
    sectors = []
    for k in SECTORS:
        values = [lap["sectors"][k] for lap in laps if lap["sectors"][k] is not None]
        sectors.append({
            "best": min(values) if values else None,
            "typical": round(st.median(values), 3) if values else None,
            "spread": round(_spread(values), 3),
            "count": len(values),
        })
    known = [s["best"] for s in sectors]
    return {
        "start": session["start"],
        "track": session.get("track", ""),
        "laps_total": len(session["laps"]),
        "laps_clean": len(laps),
        "best": best["time"],
        "best_lap": best["lap"],
        "typical": round(st.median(times), 3),
        "spread": round(_spread(times), 3),
        "times": times,
        "sectors": sectors,
        "ideal": round(sum(known), 3) if all(v is not None for v in known) else None,
    }


def _verdict(delta: float, margin: float) -> str:
    if delta <= -margin:
        return "faster"
    if delta >= margin:
        return "slower"
    return "same"


def _margin(a_spread: float, a_count: int, b_spread: float, b_count: int) -> float:
    """How big a change in typical pace must be before it isn't just lap-to-lap variation."""
    if not a_count or not b_count:
        return MIN_DIFFERENCE
    return round(max(MIN_DIFFERENCE, 2 * math.sqrt(a_spread ** 2 / a_count + b_spread ** 2 / b_count)), 3)


def compare(latest: dict, baseline: dict) -> dict:
    margin = _margin(latest["spread"], latest["laps_clean"], baseline["spread"], baseline["laps_clean"])
    delta = round(latest["typical"] - baseline["typical"], 3)
    result = {
        "best_delta": round(latest["best"] - baseline["best"], 3),
        "typical_delta": delta,
        "typical_margin": margin,
        "typical": _verdict(delta, margin),
        "consistency_delta": round(latest["spread"] - baseline["spread"], 3),
        "sectors": [],
    }
    for k in SECTORS:
        a, b = latest["sectors"][k], baseline["sectors"][k]
        if a["typical"] is None or b["typical"] is None:
            result["sectors"].append({"sector": k + 1, "verdict": "unknown"})
            continue
        sector_margin = _margin(a["spread"], a["count"], b["spread"], b["count"])
        sector_delta = round(a["typical"] - b["typical"], 3)
        result["sectors"].append({
            "sector": k + 1,
            "typical_delta": sector_delta,
            "margin": sector_margin,
            "verdict": _verdict(sector_delta, sector_margin),
            "best_delta": round(a["best"] - b["best"], 3),
        })
    return result


def analyse(sessions: list[dict]) -> dict | None:
    """Analyse the newest session with lap data against that track's earlier ones."""
    timed = [s for s in sessions if s["laps"] and summarize(s)]
    if not timed:
        return None
    newest = timed[-1]
    track = newest.get("track", "")
    history = [s for s in timed[:-1] if s.get("track", "") == track]
    latest = summarize(newest)
    past = [summarize(s) for s in history]

    report = {"latest": latest, "session_number": len(past) + 1, "previous": None, "vs_previous": None}
    if past:
        report["previous"] = past[-1]
        report["vs_previous"] = compare(latest, past[-1])
        best_ever = min(p["best"] for p in past)
        report["best_before"] = best_ever
        report["personal_best"] = latest["best"] < best_ever
        all_time = []
        for k in SECTORS:
            values = [p["sectors"][k]["best"] for p in past + [latest] if p["sectors"][k]["best"] is not None]
            all_time.append(min(values) if values else None)
        report["ideal_all_time"] = round(sum(all_time), 3) if all(v is not None for v in all_time) else None
    else:
        report["ideal_all_time"] = latest["ideal"]
        report["personal_best"] = True
        report["best_before"] = None

    # where the most time is still on the table: typical pace against this session's own best
    gaps = [(s["typical"] - s["best"], i + 1) for i, s in enumerate(latest["sectors"]) if s["best"] is not None]
    report["focus_sector"] = max(gaps)[1] if gaps else None
    report["focus_gain"] = round(max(gaps)[0], 3) if gaps else None
    return report


def fmt_lap(seconds: float) -> str:
    minutes, rest = divmod(seconds, 60)
    return f"{int(minutes)}:{rest:05.2f}" if minutes else f"{rest:.2f}s"


def _signed(seconds: float) -> str:
    return f"{abs(seconds):.2f}s {'faster' if seconds < 0 else 'slower'}"


def format_report(report: dict) -> str:
    """A complete coaching summary with no AI involved, and the fallback if an AI call fails."""
    latest = report["latest"]
    lines = [f"{latest['track'] or 'Track session'}: session {report['session_number']}"]
    lines.append(f"Best lap {fmt_lap(latest['best'])} (lap {latest['best_lap']})"
                 + (" - NEW PERSONAL BEST" if report["personal_best"] and report["best_before"] else ""))
    lines.append(f"Typical lap {fmt_lap(latest['typical'])}, from {latest['laps_clean']} clean of {latest['laps_total']} laps")

    versus = report.get("vs_previous")
    if versus:
        lines.append("")
        lines.append("Against your previous session:")
        lines.append(f"Best lap: {_signed(versus['best_delta'])}")
        lines.append("Typical pace: " + ("about the same" if versus["typical"] == "same" else _signed(versus["typical_delta"])))
        for s in versus["sectors"]:
            if s["verdict"] == "unknown":
                lines.append(f"Sector {s['sector']}: no data")
            elif s["verdict"] == "same":
                lines.append(f"Sector {s['sector']}: about the same")
            else:
                lines.append(f"Sector {s['sector']}: {_signed(s['typical_delta'])}")
        change = versus["consistency_delta"]
        if abs(change) >= MIN_DIFFERENCE:
            lines.append(f"Consistency: laps {'tighter' if change < 0 else 'more spread out'} ({latest['spread']:.2f}s spread)")
    else:
        lines.append("")
        lines.append("First session at this track, so this one is your baseline.")

    lines.append("")
    if report["ideal_all_time"]:
        lines.append(f"Ideal lap from your best sectors across all sessions: {fmt_lap(report['ideal_all_time'])}")
    if report["focus_sector"]:
        lines.append(f"Focus next: Sector {report['focus_sector']}. Matching your best there every lap is worth about {report['focus_gain']:.2f}s.")
    return "\n".join(lines)
