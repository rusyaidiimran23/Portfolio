"""Synthetic data only: real logs contain GPS tracks and stay out of the repo."""
import pytest

from app import track_sessions as ts

HEADER = ("session name;session date;lap index;lap start;time (s);sector1 (s);sector2 (s);sector3 (s);"
          "avg. speed (km/h);max. speed (km/h)\n")
LAP_A1 = "Untitled;2026-10-31 22:57:49;1;2026-10-31 22:59:24;79.99;29.69;29.93;20.37;57.3;99.9\n"
LAP_A2 = "Untitled;2026-10-31 22:57:49;2;2026-10-31 23:00:44;65.56;17.21;;20.06;72.8;117.5\n"
LAP_B1 = "Untitled;2026-09-15 21:04:38;1;2026-09-15 21:05:00;70.21;18.29;29.35;22.57;62.1;83.2\n"
NAME = "LapTrophy Sepang Go Kart Circuit.csv"


def csv_file(*rows):
    return (HEADER + "".join(rows)).encode()


def gpx_file(*stamps, lat=2.76, lon=101.72):
    pts = "".join(f'<trkpt lat="{lat + i * 0.0001}" lon="{lon}"><time>{s}</time></trkpt>' for i, s in enumerate(stamps))
    return (f'<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>{pts}'
            "</trkseg></trk></gpx>").encode()


def test_csv_groups_laps_by_session_and_keeps_blank_sectors():
    sessions = ts.merge(ts.parse_csv(csv_file(LAP_A1, LAP_A2, LAP_B1), NAME))
    assert [len(s["laps"]) for s in sessions] == [1, 2]  # oldest first
    assert sessions[1]["track"] == "Sepang Go Kart Circuit"
    assert sessions[1]["laps"][1]["sectors"] == [17.21, None, 20.06]


def test_csv_local_time_becomes_utc():
    session = ts.parse_csv(csv_file(LAP_A1), NAME)[0]
    assert session["start"].isoformat() == "2026-10-31T14:57:49+00:00"


def test_repeated_lap_row_is_not_counted_twice():
    sessions = ts.parse_csv(csv_file(LAP_A1, LAP_A1), NAME)
    assert len(sessions[0]["laps"]) == 1


def test_re_export_of_same_sessions_does_not_duplicate():
    first = ts.parse_csv(csv_file(LAP_B1), NAME)
    later = ts.parse_csv(csv_file(LAP_B1, LAP_A1, LAP_A2), NAME)  # every export repeats old sessions
    assert [len(s["laps"]) for s in ts.merge(first + later)] == [1, 2]


def test_gpx_and_csv_of_one_session_merge_into_one():
    gpx = ts.parse_gpx(gpx_file("2026-10-31T14:57:49Z", "2026-10-31T14:57:50Z"))
    merged = ts.merge(ts.parse_csv(csv_file(LAP_A1), NAME) + gpx)
    assert len(merged) == 1
    assert len(merged[0]["laps"]) == 1 and len(merged[0]["points"]) == 2


def test_merge_order_does_not_lose_data():
    gpx = ts.parse_gpx(gpx_file("2026-10-31T14:57:49Z"))
    merged = ts.merge(gpx + ts.parse_csv(csv_file(LAP_A1), NAME))
    assert len(merged) == 1 and merged[0]["laps"] and merged[0]["points"]


def test_gpx_starting_a_few_seconds_off_still_matches():
    gpx = ts.parse_gpx(gpx_file("2026-10-31T14:57:52Z"))
    assert len(ts.merge(ts.parse_csv(csv_file(LAP_A1), NAME) + gpx)) == 1


def test_a_different_session_stays_separate():
    gpx = ts.parse_gpx(gpx_file("2026-10-31T13:00:00Z"))
    assert len(ts.merge(ts.parse_csv(csv_file(LAP_A1), NAME) + gpx)) == 2


def test_gpx_repeated_timestamp_keeps_one_point_in_order():
    session = ts.parse_gpx(gpx_file("2026-10-31T14:57:50Z", "2026-10-31T14:57:49Z", "2026-10-31T14:57:50Z"))[0]
    assert [p[0].second for p in session["points"]] == [49, 50]


def test_same_gpx_twice_is_one_session():
    gpx = gpx_file("2026-10-31T14:57:49Z", "2026-10-31T14:57:50Z")
    assert len(ts.merge(ts.parse_gpx(gpx) + ts.parse_gpx(gpx))) == 1


@pytest.mark.parametrize("data", [
    b"time,lat,lon\n1,2,3\n",
    HEADER.encode(),
])
def test_csv_that_is_not_laptrophy_is_refused(data):
    with pytest.raises(ValueError):
        ts.parse_csv(data, NAME)


@pytest.mark.parametrize("data", [
    b"not xml at all",
    b'<!DOCTYPE lolz [<!ENTITY a "a">]><gpx/>',
    b"<gpx></gpx>",
])
def test_bad_gpx_is_refused(data):
    with pytest.raises(ValueError):
        ts.parse_gpx(data)


def test_lap_points_and_distance():
    stamps = [f"2026-10-31T15:00:{s:02d}Z" for s in range(0, 11)]
    session = ts.merge(ts.parse_csv(csv_file(LAP_A1), NAME) + ts.parse_gpx(gpx_file(*stamps)))
    lap = {"start": session[-1]["points"][2][0], "time": 4.0}
    pts = ts.lap_points(session[-1], lap)
    assert len(pts) == 5
    track = ts.lap_track(pts)
    assert 40 < track["distance_m"] < 50  # 4 steps of about 11.1 m
    assert 38 < track["trace"][0][1] < 42  # about 11 m/s


def test_load_all_rebuilds_from_files_and_skips_junk(tmp_path, capsys):
    (tmp_path / "20261101-000000-a.csv").write_bytes(csv_file(LAP_B1))
    (tmp_path / "20261102-000000-b.csv").write_bytes(csv_file(LAP_B1, LAP_A1))
    (tmp_path / "20261103-000000-c.gpx").write_bytes(gpx_file("2026-10-31T14:57:49Z"))
    (tmp_path / "20261104-000000-d.csv").write_bytes(b"junk")
    sessions = ts.load_all(tmp_path)
    assert len(sessions) == 2 and sessions[1]["laps"] and sessions[1]["points"]
    assert "20261104-000000-d.csv" in capsys.readouterr().out


TELEMETRY_HEADER = "time(sec);lat(deg);lon(deg);accuracy(m);speed(m/s);lean(deg)\n"
START = 1793458668.9995  # 2026-10-31 14:57:49 UTC, the session LAP_A1 belongs to


def telemetry_file(*offsets, speed=20.0):
    rows = "".join(f"{START + o};2.76;101.72;3.5;{speed};-10\n" for o in offsets)
    return (TELEMETRY_HEADER + rows).encode()


def test_session_csv_is_recognised_and_lean_is_not_kept():
    session = ts.parse_file(telemetry_file(0, 1), "LapTrophy 2026-10-31 14:57:49 +0000.csv")[0]
    assert session["start"].isoformat() == "2026-10-31T14:57:49+00:00"
    assert session["points"][0][1:] == (2.76, 101.72, 20.0)
    assert not session["laps"]


def test_track_csv_still_recognised_by_parse_file():
    assert ts.parse_file(csv_file(LAP_A1), NAME)[0]["laps"]


def test_session_and_track_csv_merge_in_either_order():
    tele = ts.parse_telemetry(telemetry_file(0, 1))
    track = ts.parse_csv(csv_file(LAP_A1), NAME)
    for parts in (tele + track, track + tele):
        merged = ts.merge(parts)
        assert len(merged) == 1 and merged[0]["laps"] and len(merged[0]["points"][0]) == 4


def test_speed_data_beats_a_longer_gpx_in_either_order():
    tele = ts.parse_telemetry(telemetry_file(0, 1))
    gpx = ts.parse_gpx(gpx_file("2026-10-31T14:57:49Z", "2026-10-31T14:57:50Z", "2026-10-31T14:57:51Z"))
    for parts in (tele + gpx, gpx + tele):
        merged = ts.merge(parts)
        assert len(merged) == 1 and len(merged[0]["points"]) == 2 and len(merged[0]["points"][0]) == 4


def test_session_csv_repeated_rows_and_resends_do_not_duplicate():
    tele = ts.parse_telemetry(telemetry_file(0, 0, 1))
    assert len(tele[0]["points"]) == 2
    assert len(ts.merge(tele + tele + tele)) == 1


def test_unknown_csv_is_refused():
    with pytest.raises(ValueError):
        ts.parse_telemetry(b"a;b\n1;2\n")


def test_new_sessions_allows_small_start_differences():
    old = ts.parse_gpx(gpx_file("2026-10-31T14:57:52Z"))
    assert ts.new_sessions(old, ts.parse_csv(csv_file(LAP_A1), NAME)) == []
    assert ts.new_sessions(old, ts.parse_csv(csv_file(LAP_B1), NAME))
