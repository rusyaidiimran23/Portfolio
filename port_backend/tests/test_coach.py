"""Gemini is never really called here: the HTTP call is faked."""
import io
import json
import urllib.error

import pytest

from app import coach, track_compare, track_sessions as ts

HEADER = ("session name;session date;lap index;lap start;time (s);sector1 (s);sector2 (s);sector3 (s);"
          "avg. speed (km/h);max. speed (km/h)\n")


def rows(date, *times):
    return "".join(f"Untitled;{date};{i};{date};{t};17.0;28.0;{t - 45:.2f};70;110\n" for i, t in enumerate(times, 1))


def sessions(*parts):
    return ts.merge(ts.parse_csv((HEADER + "".join(parts)).encode(), "LapTrophy SGK.csv"))


TWO = sessions(rows("2026-10-31 20:00:00", 90.0, 65.0, 65.1, 65.2), rows("2026-10-31 21:00:00", 90.0, 64.0, 64.1, 64.2))

GOOD = {
    "headline": "A genuine step forward.",
    "what_changed": "Your whole pace moved by 1.00s, not just one lap.",
    "where_the_time_is": "Sector 3 still holds time.",
    "previous_advice_check": "",
    "experiment": "Try braking a touch later into sector 3, as a test.",
    "success_looks_like": "Your sector 3 typical drops below 19.10s.",
}


def gemini(advice=GOOD, finish="STOP", raw=None):
    text = raw if raw is not None else json.dumps(advice)
    return {"candidates": [{"finishReason": finish, "content": {"parts": [
        {"text": "thinking...", "thought": True}, {"text": text}]}}],
        "usageMetadata": {"promptTokenCount": 900, "thoughtsTokenCount": 400, "candidatesTokenCount": 120}}


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.delenv("COACH_MODEL", raising=False)
    calls, answers = [], [gemini()]

    def fake_post(model, body):
        calls.append((model, body))
        answer = answers[-1]
        if isinstance(answer, Exception):
            raise answer
        return answer

    monkeypatch.setattr(coach, "_post", fake_post)
    return calls, answers


def test_request_shape(api, tmp_path):
    calls, _ = api
    coach.advice_for(track_compare.analyse(TWO), TWO, tmp_path)
    model, body = calls[0]
    config = body["generationConfig"]
    assert model == "gemini-3.8-flash"
    assert config["thinkingConfig"] == {"thinkingLevel": "high"}
    assert config["responseMimeType"] == "application/json" and config["responseSchema"]["required"] == coach.FIELDS
    assert "temperature" not in config
    data = json.loads(body["contents"][0]["parts"][0]["text"])
    assert data["highlights"] and data["this_session"]["best_lap_s"] == 64.0


def test_key_goes_in_a_header_not_the_url(monkeypatch):
    seen = {}

    class Reply(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(req, timeout):
        seen["url"], seen["key"] = req.full_url, req.get_header("X-goog-api-key")
        return Reply(b"{}")

    monkeypatch.setenv("GEMINI_API_KEY", "secret-key")
    monkeypatch.setattr(coach.urllib.request, "urlopen", fake_urlopen)
    coach._post("gemini-3.8-flash", {})
    assert seen["key"] == "secret-key" and "secret-key" not in seen["url"]


def test_render_is_clean_and_consistent(api, tmp_path):
    text = coach.advice_for(track_compare.analyse(TWO), TWO, tmp_path)
    assert text.splitlines()[0] == "COACH"
    assert "What changed" in text and "Try next session" in text and "Success looks like: " in text
    assert "Last session's advice" not in text  # empty field is left out


def test_markdown_is_stripped():
    text = coach.render(dict(GOOD, headline="**Big** step `forward`", what_changed="# Pace\n\nmoved"))
    assert "*" not in text and "`" not in text and "#" not in text and "Big step forward" in text


def test_invented_number_drops_the_advice(api, tmp_path):
    _, answers = api
    answers.append(gemini(dict(GOOD, success_looks_like="Below 18.73s.")))
    assert coach.advice_for(track_compare.analyse(TWO), TWO, tmp_path) is None
    assert list(tmp_path.iterdir()) == []


def test_lap_time_format_is_checked_too():
    data = {"best": 65.1}
    assert coach.numbers_check(dict(GOOD, headline="1:05.10", what_changed="", success_looks_like=""), data)
    assert not coach.numbers_check(dict(GOOD, headline="1:04.90", what_changed="", success_looks_like=""), data)


def test_only_one_call_per_session(api, tmp_path):
    calls, _ = api
    report = track_compare.analyse(TWO)
    first = coach.advice_for(report, TWO, tmp_path)
    assert coach.advice_for(report, TWO, tmp_path) == first and len(calls) == 1


def test_model_can_be_switched(api, tmp_path, monkeypatch):
    calls, _ = api
    monkeypatch.setenv("COACH_MODEL", "gemini-3.6-flash")
    coach.advice_for(track_compare.analyse(TWO), TWO, tmp_path)
    assert calls[0][0] == "gemini-3.6-flash"


def test_no_key_means_no_call(api, tmp_path, monkeypatch):
    calls, _ = api
    monkeypatch.delenv("GEMINI_API_KEY")
    assert coach.advice_for(track_compare.analyse(TWO), TWO, tmp_path) is None and calls == []


@pytest.mark.parametrize("answer", [
    urllib.error.HTTPError("u", 429, "rate limited", {}, None),
    urllib.error.URLError("down"),
    gemini(finish="MAX_TOKENS"),
    gemini(finish="SAFETY"),
    gemini(raw="not json"),
    gemini(raw=json.dumps({"headline": "only one field"})),
    gemini(dict(GOOD, experiment="  ")),
    {"candidates": []},
])
def test_failure_gives_no_advice_and_saves_nothing(api, tmp_path, answer):
    _, answers = api
    answers.append(answer)
    assert coach.advice_for(track_compare.analyse(TWO), TWO, tmp_path) is None
    assert list(tmp_path.iterdir()) == []


def test_next_session_receives_previous_advice(api, tmp_path):
    calls, answers = api
    answers.append(gemini({k: ("" if k == "previous_advice_check" else "Settle in and build a baseline.") for k in coach.FIELDS}))
    assert coach.advice_for(track_compare.analyse(TWO[:1]), TWO[:1], tmp_path)
    answers.append(gemini())
    coach.advice_for(track_compare.analyse(TWO), TWO, tmp_path)
    previous = json.loads(calls[1][1]["contents"][0]["parts"][0]["text"])["previous_advice"]
    assert previous.startswith("COACH")


def test_no_gps_is_sent(api, tmp_path):
    calls, _ = api
    session = dict(TWO[-1], points=[(TWO[-1]["start"], 2.7632, 101.7283, 10.0)])
    coach.advice_for(track_compare.analyse([TWO[0], session]), [TWO[0], session], tmp_path)
    assert "101.7283" not in json.dumps(calls[0][1])


def highlights_for(*parts):
    s = sessions(*parts)
    return coach.facts(track_compare.analyse(s), s, None)["highlights"]


def test_highlights_baseline():
    assert "baseline" in highlights_for(rows("2026-10-31 20:00:00", 90.0, 65.0, 65.1, 65.2))[0]


def test_highlights_real_gain_pb_and_sector():
    h = " | ".join(coach.facts(track_compare.analyse(TWO), TWO, None)["highlights"])
    assert "New personal best 64.00s, 1.00s under" in h
    assert "not one lucky lap" in h and "Sector 3 typical was 1.00s faster" in h
    assert "Sectors 1 and 2: within normal variation" in h


def test_highlights_lucky_lap_when_only_best_moved():
    h = " | ".join(highlights_for(rows("2026-10-31 20:00:00", 90.0, 65.0, 65.6, 65.2, 65.9, 65.4),
                                 rows("2026-10-31 21:00:00", 90.0, 64.6, 65.6, 65.3, 65.9, 65.5)))
    assert "best lap stood out" in h and "lucky" not in h


def test_highlights_consistency_rank_needs_three_sessions():
    s = (rows("2026-10-31 18:00:00", 90.0, 66.0, 67.0, 66.5), rows("2026-10-31 19:00:00", 90.0, 65.0, 65.6, 65.3),
         rows("2026-10-31 20:00:00", 90.0, 65.0, 65.1, 65.2))
    assert any("the tightest of 3 sessions" in x for x in highlights_for(*s))
    assert not any("sessions here" in x for x in highlights_for(*s[1:]))
    assert coach._ordinal(2) == "2nd" and coach._ordinal(11) == "11th" and coach._ordinal(23) == "23rd"


def test_error_reason_is_logged_without_the_key(api, tmp_path, capsys):
    _, answers = api
    body = io.BytesIO(json.dumps({"error": {"code": 400, "status": "INVALID_ARGUMENT", "message": "API key not valid.",
                                            "details": [{"reason": "API_KEY_INVALID"}]}}).encode())
    answers.append(urllib.error.HTTPError("u", 400, "Bad Request", {}, body))
    coach.advice_for(track_compare.analyse(TWO), TWO, tmp_path)
    out = capsys.readouterr().out
    assert "400: INVALID_ARGUMENT API_KEY_INVALID" in out and "test-key" not in out
