"""Run from port_backend/:  .venv\\Scripts\\python.exe -m pytest tests"""
import json

import pytest
from fastapi.testclient import TestClient

from app import main, telegram_bot as tb

SECRET = "test-secret"
OWNER = 111
HEADERS = {"X-Telegram-Bot-Api-Secret-Token": SECRET}


def doc_update(sender=OWNER, name="session.csv", size=100, uid="abc_123", caption="traffic on lap 4"):
    return {"update_id": 1, "message": {
        "from": {"id": sender}, "chat": {"id": sender}, "caption": caption,
        "document": {"file_id": "fid", "file_unique_id": uid, "file_name": name, "file_size": size},
    }}


@pytest.fixture
def bot(monkeypatch, tmp_path):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", SECRET)
    monkeypatch.setenv("TELEGRAM_OWNER_ID", str(OWNER))
    monkeypatch.setenv("TRACK_UPLOADS", str(tmp_path))
    replies = []
    monkeypatch.setattr(tb, "_reply", lambda chat, text: replies.append((chat, text)))
    monkeypatch.setattr(tb, "_download", lambda file_id: b"time,lat,lon\n1,2,3\n")
    return replies, tmp_path


client = TestClient(main.app)


def post(update, headers=HEADERS):
    return client.post("/api/telegram/webhook", json=update, headers=headers)


def test_rejects_wrong_or_missing_secret(bot):
    replies, folder = bot
    assert post(doc_update(), {"X-Telegram-Bot-Api-Secret-Token": "nope"}).status_code == 403
    assert post(doc_update(), {}).status_code == 403
    assert replies == [] and list(folder.iterdir()) == []


def test_unconfigured_bot_is_not_found(monkeypatch, tmp_path):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
    assert post(doc_update()).status_code == 404


def test_owner_upload_is_stored_with_note(bot):
    replies, folder = bot
    assert post(doc_update()).status_code == 200
    logs = list(folder.glob("*.csv"))
    assert len(logs) == 1 and logs[0].read_bytes().startswith(b"time")
    assert json.loads(logs[0].with_suffix(".json").read_text(encoding="utf-8"))["note"] == "traffic on lap 4"
    assert replies[-1][1].startswith("Saved ")


def test_stranger_is_ignored_silently(bot):
    replies, folder = bot
    assert post(doc_update(sender=999)).status_code == 200
    assert replies == [] and list(folder.iterdir()) == []


def test_setup_mode_only_reveals_sender_id(bot, monkeypatch):
    replies, folder = bot
    monkeypatch.delenv("TELEGRAM_OWNER_ID")
    assert post(doc_update(sender=999)).status_code == 200
    assert "999" in replies[-1][1] and list(folder.iterdir()) == []


def test_same_file_twice_is_stored_once(bot):
    replies, folder = bot
    post(doc_update()); post(doc_update())
    assert len(list(folder.glob("*.csv"))) == 1
    assert "already have" in replies[-1][1]


@pytest.mark.parametrize("kwargs,expected", [
    ({"name": "photo.exe"}, "isn't a CSV"),
    ({"size": tb.MAX_BYTES + 1}, "too big"),
    ({"uid": "../../evil"}, "unreadable"),
])
def test_bad_files_are_refused(bot, kwargs, expected):
    replies, folder = bot
    post(doc_update(**kwargs))
    assert expected in replies[-1][1] and list(folder.iterdir()) == []


def test_download_larger_than_limit_is_not_saved(bot, monkeypatch):
    replies, folder = bot
    def too_big(file_id):
        raise ValueError("file too large")
    monkeypatch.setattr(tb, "_download", too_big)
    post(doc_update())
    assert "Could not save" in replies[-1][1] and list(folder.iterdir()) == []


def test_daily_limit(bot, monkeypatch):
    replies, folder = bot
    monkeypatch.setattr(tb, "MAX_PER_DAY", 1)
    post(doc_update(uid="one")); post(doc_update(uid="two"))
    assert len(list(folder.glob("*.csv"))) == 1
    assert "Daily limit" in replies[-1][1]


def test_failure_log_never_contains_token(bot, monkeypatch, capsys):
    def boom(file_id):
        raise RuntimeError("https://api.telegram.org/bottok/getFile failed")
    monkeypatch.setattr(tb, "_download", boom)
    post(doc_update())
    assert "tok" not in capsys.readouterr().out


HEADER = ("session name;session date;lap index;lap start;time (s);sector1 (s);sector2 (s);sector3 (s);"
          "avg. speed (km/h);max. speed (km/h)\n")
def laptrophy_csv(*sessions):
    rows = ""
    for date, times in sessions:
        for i, t in enumerate(times, 1):
            rows += f"Untitled;{date};{i};{date};{t};17.0;28.0;{t - 45:.2f};70;110\n"
    return (HEADER + rows).encode()


FIRST = ("2026-10-31 20:00:00", [90.0, 65.0, 65.1, 65.2])
SECOND = ("2026-10-31 21:00:00", [90.0, 64.0, 64.1, 64.2])


def send(monkeypatch, data, uid):
    monkeypatch.setattr(tb, "_download", lambda file_id: data)
    post(doc_update(uid=uid, name="LapTrophy SGK.csv"))


def test_new_session_gets_a_report(bot, monkeypatch):
    replies, _ = bot
    send(monkeypatch, laptrophy_csv(FIRST), "one")
    assert "1 new" in replies[-2][1] and "baseline" in replies[-1][1]
    send(monkeypatch, laptrophy_csv(FIRST, SECOND), "two")
    assert "2 session(s) in this file, 1 new" in replies[-2][1]
    assert "PERSONAL BEST" in replies[-1][1] and "Sector 3" in replies[-1][1]


def test_re_export_with_nothing_new_sends_no_second_report(bot, monkeypatch):
    replies, folder = bot
    send(monkeypatch, laptrophy_csv(FIRST), "one")
    count = len(replies)
    send(monkeypatch, laptrophy_csv(FIRST), "two")  # same bytes, new Telegram id
    assert len(replies) == count + 1 and "0 new" in replies[-1][1]
    assert len(list(folder.glob("*.csv"))) == 1


TELEMETRY = ("time(sec);lat(deg);lon(deg);accuracy(m);speed(m/s);lean(deg)\n"
             "1793448000.0;2.76;101.72;3.5;20.0;-10\n1793448001.0;2.76;101.72;3.5;21.0;-10\n").encode()  # 2026-10-31 12:00 UTC = 20:00 local


def test_session_csv_first_asks_for_track_csv_then_reports_once(bot, monkeypatch):
    replies, _ = bot
    send(monkeypatch, TELEMETRY, "tele")
    assert "1 new" in replies[-2][1] and "track CSV" in replies[-1][1]
    send(monkeypatch, laptrophy_csv(FIRST), "track")
    assert "0 new" in replies[-2][1] and "baseline" in replies[-1][1]  # same session, now with laps
    count = len(replies)
    send(monkeypatch, TELEMETRY + b"1793448002.0;2.76;101.72;3.5;21.0;-10\n", "tele2")
    assert len(replies) == count + 1 and "0 new" in replies[-1][1]


def test_backfilling_an_older_session_stays_quiet(bot, monkeypatch):
    replies, _ = bot
    send(monkeypatch, laptrophy_csv(SECOND), "newer")
    count = len(replies)
    send(monkeypatch, laptrophy_csv(FIRST), "older")
    assert len(replies) == count + 1 and "1 new" in replies[-1][1]


def test_report_command_uses_stored_sessions(bot, monkeypatch):
    replies, _ = bot
    post({"message": {"from": {"id": OWNER}, "chat": {"id": OWNER}, "text": "/report"}})
    assert "No sessions" in replies[-1][1]
    send(monkeypatch, laptrophy_csv(FIRST, SECOND), "one")
    post({"message": {"from": {"id": OWNER}, "chat": {"id": OWNER}, "text": "/report"}})
    assert "PERSONAL BEST" in replies[-1][1]


def test_stranger_cannot_trigger_a_report(bot):
    replies, _ = bot
    post({"message": {"from": {"id": 999}, "chat": {"id": 999}, "text": "/report"}})
    assert replies == []


def test_advice_follows_report_and_failure_keeps_report(bot, monkeypatch):
    replies, _ = bot
    monkeypatch.setattr(tb.coach, "advice_for", lambda *a: "Try something.")
    send(monkeypatch, laptrophy_csv(FIRST), "one")
    assert "baseline" in replies[-2][1] and replies[-1][1] == "Try something."
    def boom(*a):
        raise RuntimeError("no")
    monkeypatch.setattr(tb.coach, "advice_for", boom)
    send(monkeypatch, laptrophy_csv(FIRST, SECOND), "two")
    assert "PERSONAL BEST" in replies[-1][1]
