"""Synthetic logs only."""
import json

import pytest

from app import track_view as tv

NAME = "LapTrophy SGK Test.csv"
HEADER = ("session name;session date;lap index;lap start;time (s);sector1 (s);sector2 (s);sector3 (s);"
          "avg. speed (km/h);max. speed (km/h)\n")
LAPS = ("Untitled;2026-10-31 20:00:00;1;2026-10-31 20:00:00;10;3;4;3;50;60\n"
        "Untitled;2026-10-31 20:00:00;2;2026-10-31 20:00:10;9;3;;3;50;70\n")
OLDER = "Untitled;2026-09-15 23:34:23;1;2026-09-15 23:34:23;12;4;4;4;50;60\nUntitled;2026-09-15 23:34:23;2;2026-09-15 23:34:35;11;4;4;3;50;60\n"
START = 1793448000.0  # 2026-10-31 20:00:00 local


def telemetry():
    rows = "".join(f"{START + i};{2.7632 + i * 1e-5};{101.7283 + i * 1e-5};3.5;10.0;-10\n" for i in range(20))
    return ("time(sec);lat(deg);lon(deg);accuracy(m);speed(m/s);lean(deg)\n" + rows).encode()


def trackday(**extra):
    return {"tracks": [{
        "id": "sgk", "length_km": 1.0, "laptrophy": "SGK Test",
        "map_fit": {"lat0": 2.7632, "lon0": 101.7283, "x": [2.0, 0.0, 500.0], "y": [0.0, -2.0, 300.0]},
    }, {"id": "other", "length_km": 1.0}], "sessions": [], **extra}


@pytest.fixture
def folder(tmp_path):
    tv._cache = None
    def add(name, data, original):
        (tmp_path / name).write_bytes(data)
        (tmp_path / name.replace(name[name.rfind("."):], ".json")).write_text(json.dumps({"note": "", "original_name": original}))
    add("1-a.csv", (HEADER + LAPS + OLDER).encode(), NAME)
    add("2-b.csv", telemetry(), "LapTrophy 2026-10-31 12:00:00 +0000.csv")
    return tmp_path


def test_uploaded_sessions_are_added_with_coach(folder):
    view = tv.trackday_view(trackday(), folder)
    assert [s["date"] for s in view["sessions"]] == ["2026-09-15 23:34", "2026-10-31 20:00"]
    assert all(s["uploaded"] for s in view["sessions"])
    assert "sgk" in view["coach"]
    session = view["sessions"][1]
    assert session["best"] == "9.00s" and session["laps"] == [10.0, 9.0]


def test_blank_sector_stays_null_and_is_json_safe(folder):
    tele = tv.trackday_view(trackday(), folder)["sessions"][1]["telemetry"]
    assert tele["sectors"][1] == [3.0, None, 3.0]
    json.dumps(tele)


def test_trace_and_map_use_speed_data(folder):
    tele = tv.trackday_view(trackday(), folder)["sessions"][1]["telemetry"]
    assert tele["trace_best"][-1][0] == 1000  # scaled to the track length
    assert tele["trace_best"][0][1] == 36.0   # 10 m/s
    assert tele["map_best"][0][2] == 36
    assert tele["map_best"][0][:2][0] > 500   # projected, not raw coordinates


def test_session_without_speed_data_still_has_lap_table(folder):
    tele = tv.trackday_view(trackday(), folder)["sessions"][0]["telemetry"]
    assert tele["map_best"] == [] and tele["trace_best"] == []
    assert tele["sectors"][1] == [4.0, 4.0, 3.0]


def test_stored_import_is_replaced_not_duplicated_and_keeps_vehicle(folder):
    stored = {"track": "sgk", "date": "2026-09-15", "vehicle": "Kawasaki ZX-4RR", "best": "1:06.67",
              "source": "laptrophy-2026-09-15-153423"}
    view = tv.trackday_view(trackday(sessions=[stored]), folder)
    matching = [s for s in view["sessions"] if s["source"] == stored["source"]]
    assert len(view["sessions"]) == 2 and len(matching) == 1
    assert matching[0]["vehicle"] == "Kawasaki ZX-4RR" and matching[0]["best"] == "11.00s"


def test_manual_sessions_are_kept(folder):
    manual = {"track": "sgk", "date": "2026-01-01", "best": "1:10.00"}
    assert manual in tv.trackday_view(trackday(sessions=[manual]), folder)["sessions"]


def test_dismissed_upload_stays_hidden(folder):
    view = tv.trackday_view(trackday(dismissed=["laptrophy-2026-09-15-153423"]), folder)
    assert len(view["sessions"]) == 1


def test_unmapped_track_is_ignored_and_input_is_not_modified(folder):
    original = trackday()
    original["tracks"][0].pop("laptrophy")
    view = tv.trackday_view(original, folder)
    assert view["sessions"] == [] and view["coach"] == {} and original["sessions"] == []


def test_missing_folder_is_fine(tmp_path):
    tv._cache = None
    assert tv.trackday_view(trackday(), tmp_path / "nope")["sessions"] == []


def test_uploads_use_the_tracks_bike_unless_one_was_stored(folder):
    td = trackday(sessions=[{"track": "sgk", "date": "2026-09-15", "vehicle": "Rental kart", "best": "1:06.67",
                             "source": "laptrophy-2026-09-15-153423"}])
    td["tracks"][0]["vehicle"] = "Kawasaki ZX-4RR"
    assert [s["vehicle"] for s in tv.trackday_view(td, folder)["sessions"]] == ["Rental kart", "Kawasaki ZX-4RR"]


def test_saved_advice_appears_with_the_report(folder):
    (folder / "coach-laptrophy-2026-10-31-120000.txt").write_text("Try something.", encoding="utf-8")
    text = tv.trackday_view(trackday(), folder)["coach"]["sgk"]
    assert text.endswith("Try something.") and "session" in text
