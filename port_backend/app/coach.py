"""Gemini's advice on top of the plain session report (track_compare.py).

The numbers and every faster/slower call come from code and are always sent. Gemini
only adds the coaching, so a failure here costs the advice, never the report.

To keep the advice clean and trustworthy:
- Gemini fills fixed fields (structured output) and code lays them out the same way every time
- the key insights arrive pre-computed ("highlights"), so they can't be missed or misstated
- advice quoting any number that isn't in the data is thrown away

Advice is saved beside the raw logs: one call per session, however often a report is
shown, and the next session can follow up on what was suggested.

    GEMINI_API_KEY   from aistudio.google.com; without it there's just no advice
    COACH_MODEL      optional, default gemini-3.8-flash

Only lap and sector statistics are sent, never GPS. On Gemini's free tier, Google may
use requests to improve its products.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

from . import track_compare, track_sessions

DEFAULT_MODEL = "gemini-3.8-flash"
API = "https://generativelanguage.googleapis.com/v1beta/models"
TIMEOUT = 240  # "high" thinking can take well over a minute; it runs after the report has gone
HISTORY = 8  # earlier sessions shown to the model, enough for a trend

FIELDS = ["headline", "what_changed", "where_the_time_is", "previous_advice_check", "experiment", "success_looks_like"]
SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "headline": {"type": "STRING", "description": "One sentence: what this session means."},
        "what_changed": {"type": "STRING", "description": "2-3 sentences: real or lucky, consistency, sectors, trend."},
        "where_the_time_is": {"type": "STRING", "description": "1-2 sentences: the sector with most time left and how much."},
        "previous_advice_check": {"type": "STRING", "description": "One sentence on whether last advice helped, or empty if none."},
        "experiment": {"type": "STRING", "description": "One concrete thing to try in the focus sector, framed as a test."},
        "success_looks_like": {"type": "STRING", "description": "The measurable sign it worked, using a number from the data."},
    },
    "required": FIELDS,
    "propertyOrdering": FIELDS,
}

SYSTEM = """You are an experienced motorcycle track-day coach writing to a rider right after a \
session. The rider has already received a plain report of the numbers, so your job is to explain \
what they mean and what to do next, like a good coach in the pit lane: specific, direct, warm \
but never gushing.

The JSON has a "highlights" list worked out by code. Every highlight is correct: base your \
coaching on them, keep their numbers, and never contradict them. Code also made the comparison \
verdicts: "same" means within normal lap-to-lap variation, so never call it a gain or a loss.

Rules:
- Only use numbers that appear in the data, written as seconds like 65.10s, never as 1:05.10. Use at \
most four numbers in total; explain meaning rather than repeating the report.
- The data is lap and sector times only. It can't show braking, lines, throttle, body position or \
where a sector starts and ends, so never state a cause as fact.
- The experiment must be one concrete change in the focus sector, chosen from braking point, turn-in \
point, entry speed or throttle pickup, with a direction (earlier, later, more, less). Present it as \
something to test, not a diagnosis.
- Only talk about a gain being "real" or "not luck" when a highlight says so. If pace didn't improve, don't mention luck at all.
- previous_advice_check: if previous_advice is null, return an empty string. Otherwise you don't know whether the rider actually tried it, so never say it worked or paid off. Say whether the relevant sector moved in the hoped-for direction, then ask them whether they tried it.
- Plain sentences only: no markdown, no bullet points, no emoji. Speak to the rider as "you".

Example of the tone and depth wanted, for a different, made-up session:
headline: "A genuine step forward, not a one-off."
what_changed: "Your whole pace moved, not just one lap, and the gap between your laps was the \
smallest yet, which is what lasting speed looks like. Sector 2 did the work."
where_the_time_is: "Sector 1 is where the next gain sits: your typical there is still 0.40s off \
your best."
previous_advice_check: ""
experiment: "Try braking a touch later into sector 1, one marker at a time. Treat it as a test, \
not a fix."
success_looks_like: "If your sector 1 typical drops below 17.20s, keep it."
"""


def configured() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


def advice_path(folder: Path, session: dict) -> Path:
    return folder / f"coach-{track_sessions.source_id(session)}.txt"


def saved_advice(folder: Path, session: dict) -> str | None:
    try:
        return advice_path(folder, session).read_text(encoding="utf-8")
    except OSError:
        return None


def _session_facts(summary: dict) -> dict:
    return {
        "started": summary["start"].astimezone(track_sessions.LOCAL_TZ).strftime("%Y-%m-%d %H:%M"),
        "best_lap_s": summary["best"],
        "typical_lap_s": summary["typical"],
        "lap_spread_s": summary["spread"],
        "clean_laps": summary["laps_clean"],
        "total_laps": summary["laps_total"],
        "sectors": [{"sector": i + 1, "best_s": s["best"], "typical_s": s["typical"]}
                    for i, s in enumerate(summary["sectors"])],
    }


def _ordinal(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def highlights(report: dict, earlier: list[dict]) -> list[str]:
    """The insights worth saying, worked out in code so no model can miss or misstate them."""
    latest, versus = report["latest"], report["vs_previous"]
    out: list[str] = []
    if not versus:
        return ["First session at this track, so it sets the baseline. There is nothing to compare yet."]

    if report["personal_best"] and report["best_before"]:
        out.append(f"New personal best {latest['best']:.2f}s, {report['best_before'] - latest['best']:.2f}s under the previous best.")
    typical = versus["typical"]
    if typical == "faster":
        out.append(f"Typical lap improved by {-versus['typical_delta']:.2f}s, more than the {versus['typical_margin']:.2f}s "
                   "normal variation, so the pace gain was real and not one lucky lap.")
    elif typical == "same" and versus["best_delta"] < 0:
        out.append(f"Best lap improved by {-versus['best_delta']:.2f}s but typical pace was about the same, "
                   "so the best lap stood out rather than the whole session moving forward.")
    elif typical == "slower":
        out.append(f"Typical lap was {versus['typical_delta']:.2f}s slower than last session, beyond the "
                   f"{versus['typical_margin']:.2f}s normal variation.")

    spreads = [s["spread"] for s in earlier] + [latest["spread"]]
    if len(spreads) >= 3:
        rank = sorted(spreads).index(latest["spread"]) + 1
        where = ("the tightest" if rank == 1 else "the loosest" if rank == len(spreads)
                 else f"the {_ordinal(rank)} tightest")
        out.append(f"Lap spread {latest['spread']:.2f}s, {where} of {len(spreads)} sessions here.")

    for s in versus["sectors"]:
        if s["verdict"] in ("faster", "slower"):
            out.append(f"Sector {s['sector']} typical was {abs(s['typical_delta']):.2f}s {s['verdict']} than last session.")
    same = [str(s["sector"]) for s in versus["sectors"] if s["verdict"] == "same"]
    if same:
        out.append(f"Sector{'s' if len(same) > 1 else ''} {' and '.join(same)}: within normal variation, so unchanged.")

    if report["focus_sector"]:
        focus = latest["sectors"][report["focus_sector"] - 1]
        out.append(f"Most time still available in sector {report['focus_sector']}: its typical time {focus['typical']:.2f}s "
                   f"is {report['focus_gain']:.2f}s off this session's best there of {focus['best']:.2f}s.")

    if len(earlier) >= 2:
        first = earlier[0]
        out.append(f"Over {len(earlier) + 1} sessions the best lap went from {first['best']:.2f}s to {latest['best']:.2f}s "
                   f"and the typical lap from {first['typical']:.2f}s to {latest['typical']:.2f}s.")
    return out


def facts(report: dict, sessions: list[dict], previous_advice: str | None) -> dict:
    latest = report["latest"]
    same_track = [s for s in sessions if s.get("track", "") == latest["track"] and s["start"] < latest["start"]]
    summaries = [x for x in map(track_compare.summarize, same_track) if x]
    return {
        "highlights": highlights(report, summaries),
        "track": latest["track"],
        "session_number_at_this_track": report["session_number"],
        "this_session": _session_facts(latest),
        "versus_previous_session": report["vs_previous"],
        "new_personal_best": bool(report["personal_best"] and report["best_before"]),
        "personal_best_before_s": report["best_before"],
        "ideal_lap_from_best_sectors_all_sessions_s": report["ideal_all_time"],
        "most_time_available_in_sector": report["focus_sector"],
        "seconds_available_there_s": report["focus_gain"],
        "earlier_sessions": [_session_facts(x) for x in summaries[-HISTORY:]],
        "previous_advice": previous_advice,
    }


def _numbers(text: str) -> list[float]:
    """Decimal numbers in a text, with lap times like 1:05.10 converted to seconds."""
    text = re.sub(r"(\d+):(\d{2}(?:\.\d+)?)", lambda m: str(int(m.group(1)) * 60 + float(m.group(2))), text)
    return [float(x) for x in re.findall(r"\d+\.\d+", text)]


def numbers_check(advice: dict, data: dict) -> bool:
    """True if every decimal number in the advice appears in the data (to the nearest 0.01)."""
    allowed = _numbers(json.dumps(data))
    return all(any(abs(v - a) <= 0.006 for a in allowed) for v in _numbers(" ".join(advice.values())))


def _clean(text: str) -> str:
    text = re.sub(r"[*_`#>]+", "", str(text))
    return re.sub(r"\s+", " ", text).strip()


def render(advice: dict) -> str:
    """Lay the fields out the same way every time, as plain text that reads well in Telegram."""
    a = {k: _clean(advice.get(k, "")) for k in FIELDS}
    parts = ["COACH", a["headline"], "", "What changed", a["what_changed"], "", "Where the time is", a["where_the_time_is"]]
    if a["previous_advice_check"]:
        parts += ["", "Last session's advice", a["previous_advice_check"]]
    parts += ["", "Try next session", a["experiment"], f"Success looks like: {a['success_looks_like']}"]
    return "\n".join(parts)


def _error_reason(exc: urllib.error.HTTPError) -> str:
    """Google's short reason, e.g. API_KEY_INVALID. Its error bodies never contain the key."""
    try:
        error = json.loads(exc.read()).get("error", {})
    except (ValueError, OSError):
        return "no details"
    reasons = [d.get("reason") for d in error.get("details", []) if isinstance(d, dict) and d.get("reason")]
    return " ".join(filter(None, [error.get("status"), *reasons, str(error.get("message", ""))[:160]])) or "no details"


def _post(model: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{API}/{model}:generateContent", data=json.dumps(body).encode(), method="POST",
        headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"], "Content-Type": "application/json"},
    )  # key in a header, never the URL, so it can't end up in a log
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read())


def _ask(data: dict) -> dict | None:
    model = os.environ.get("COACH_MODEL") or DEFAULT_MODEL
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(data, ensure_ascii=False)}]}],
        "generationConfig": {  # temperature left at the default, as Google recommends for Gemini 3
            "thinkingConfig": {"thinkingLevel": "high"},
            "responseMimeType": "application/json",
            "responseSchema": SCHEMA,
            "maxOutputTokens": 16384,
        },
    }
    try:
        response = _post(model, body)
    except urllib.error.HTTPError as exc:
        print(f"[coach] Gemini error {exc.code}: {_error_reason(exc)}")
        return None
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f"[coach] Gemini unreachable: {type(exc).__name__}")
        return None

    usage = response.get("usageMetadata", {})
    candidate = (response.get("candidates") or [{}])[0]
    print(f"[coach] {model} tokens in={usage.get('promptTokenCount')} thinking={usage.get('thoughtsTokenCount')} "
          f"out={usage.get('candidatesTokenCount')} finish={candidate.get('finishReason')}")
    if candidate.get("finishReason") != "STOP":  # cut off or blocked: the plain report stands on its own
        return None
    text = "".join(p.get("text", "") for p in candidate.get("content", {}).get("parts", []) if not p.get("thought"))
    try:
        advice = json.loads(text)
    except ValueError:
        print("[coach] Gemini returned invalid JSON")
        return None
    if not isinstance(advice, dict) or not all(isinstance(advice.get(k), str) for k in FIELDS):
        print("[coach] Gemini returned incomplete advice")
        return None
    if not advice["headline"].strip() or not advice["experiment"].strip():
        return None
    if not numbers_check(advice, data):
        print("[coach] advice quoted a number that isn't in the data; dropped")
        return None
    return advice


def advice_for(report: dict, sessions: list[dict], folder: Path) -> str | None:
    """Saved advice for the report's session, or new advice if Gemini is configured."""
    latest = {"start": report["latest"]["start"]}
    existing = saved_advice(folder, latest)
    if existing or not configured():
        return existing
    before = [s for s in sessions if s.get("track", "") == report["latest"]["track"]
              and s["laps"] and s["start"] < latest["start"]]
    previous = saved_advice(folder, before[-1]) if before else None
    advice = _ask(facts(report, sessions, previous))
    if not advice:
        return None
    text = render(advice)
    advice_path(folder, latest).write_text(text, encoding="utf-8")
    return text
