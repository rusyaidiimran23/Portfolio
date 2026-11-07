from datetime import datetime, timedelta, timezone

from app import track_compare as tc

T0 = datetime(2026, 10, 31, 12, 0, tzinfo=timezone.utc)


def lap(n, time, sectors):
    return {"lap": n, "start": T0, "time": time, "sectors": sectors, "avg_kmh": None, "max_kmh": None}


def session(hours, laps, track="SGK"):
    return {"start": T0 + timedelta(hours=hours), "track": track, "laps": laps, "points": []}


def steady(offset=0.0, s1=17.0, s2=28.0, s3=20.0):
    """Six laps: an out-lap, then five with small natural variation."""
    wobble = [0.0, 0.02, -0.02, 0.01, -0.01]
    laps = [lap(1, 95.0, [30.0, 40.0, 25.0])]
    for i, w in enumerate(wobble):
        laps.append(lap(i + 2, round(s1 + s2 + s3 + offset + w, 2), [s1 + w, s2 + offset, s3]))
    return laps


def test_first_lap_and_slow_laps_are_not_representative():
    laps = steady() + [lap(7, 90.0, [25.0, 40.0, 25.0])]
    assert [l["lap"] for l in tc.clean_laps(session(0, laps))] == [2, 3, 4, 5, 6]


def test_blank_sectors_are_ignored_not_treated_as_zero():
    laps = steady()
    laps[2]["sectors"] = [17.0, None, None]
    summary = tc.summarize(session(0, laps))
    assert summary["sectors"][1]["count"] == 4
    assert summary["sectors"][1]["best"] == 28.0


def test_first_session_is_a_baseline():
    report = tc.analyse([session(0, steady())])
    assert report["vs_previous"] is None and report["session_number"] == 1
    assert "baseline" in tc.format_report(report)
    assert "PERSONAL BEST" not in tc.format_report(report)


def test_real_gain_is_called_faster_in_the_right_sector():
    report = tc.analyse([session(0, steady()), session(1, steady(offset=-0.5, s2=28.0))])
    sectors = report["vs_previous"]["sectors"]
    assert sectors[1]["verdict"] == "faster"
    assert sectors[0]["verdict"] == "same" and sectors[2]["verdict"] == "same"
    assert report["personal_best"] is True
    assert "Sector 2: 0.50s faster" in tc.format_report(report)


def test_real_loss_is_called_slower():
    report = tc.analyse([session(0, steady()), session(1, steady(offset=0.5))])
    assert report["vs_previous"]["sectors"][1]["verdict"] == "slower"
    assert report["personal_best"] is False
    assert "PERSONAL BEST" not in tc.format_report(report)


def test_tiny_difference_is_about_the_same():
    report = tc.analyse([session(0, steady()), session(1, steady(offset=0.01))])
    assert report["vs_previous"]["sectors"][1]["verdict"] == "same"


def test_noisy_laps_need_a_bigger_gap_to_count():
    def noisy(shift):
        return [lap(1, 95.0, [30.0, 40.0, 25.0])] + [
            lap(i + 2, round(65 + shift + w, 2), [17.0, 28.0 + shift + w, 20.0])
            for i, w in enumerate([-0.8, 0.8, -0.6, 0.6, 0.0])]
    report = tc.analyse([session(0, noisy(0)), session(1, noisy(-0.2))])
    assert report["vs_previous"]["sectors"][1]["verdict"] == "same"


def test_other_tracks_are_not_compared():
    report = tc.analyse([session(0, steady(), track="Horizon"), session(1, steady(), track="SGK")])
    assert report["vs_previous"] is None


def test_all_time_ideal_uses_best_sector_from_any_session():
    report = tc.analyse([session(0, steady(s1=16.5, s2=29.0)), session(1, steady(s1=17.0, s2=28.0))])
    assert report["ideal_all_time"] == round(16.48 + 28.0 + 20.0, 3)


def test_no_laps_means_no_report():
    assert tc.analyse([session(0, [])]) is None
    assert tc.analyse([]) is None
    assert tc.analyse([session(0, [lap(1, 95.0, [30.0, 40.0, 25.0])])]) is None


def test_lap_format():
    assert tc.fmt_lap(65.1) == "1:05.10"
    assert tc.fmt_lap(59.5) == "59.50s"
