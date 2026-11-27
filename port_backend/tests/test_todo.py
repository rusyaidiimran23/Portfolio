"""Garage to-do list: validation and endpoints."""
import pytest
from fastapi.testclient import TestClient

from app import garage_store, main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(garage_store, "PATH", tmp_path / "garage.json")
    return TestClient(main.app)


AUTH = lambda: {"Authorization": f"Bearer {main.make_token()}"}  # noqa: E731
UPGRADE = {"id": "u1", "kind": "upgrade", "title": "Quickshifter", "priority": "high", "cost": 1200, "link": "https://example.com/qs"}
SERVICE = {"id": "s1", "kind": "service", "title": "Chain lube", "every_km": 500, "last_km": 9800, "last_date": "2026-11-01"}
TAX = {"id": "r1", "kind": "roadtax", "title": "Road tax", "due_date": "2027-03-15"}


def test_needs_login(client):
    assert client.get("/api/garage/todo").status_code == 401
    assert client.put("/api/garage/todo/zx4rr", json={"items": []}).status_code == 401


def test_only_active_vehicles(client):
    got = client.get("/api/garage/todo", headers=AUTH()).json()
    assert "zx4rr" in got["vehicles"] and "satria" not in got["vehicles"]  # sold ones are left out
    assert client.put("/api/garage/todo/satria", json={"items": []}, headers=AUTH()).status_code == 404


def test_save_and_read_back(client):
    r = client.put("/api/garage/todo/zx4rr", json={"items": [UPGRADE, SERVICE, TAX], "odo": 10120}, headers=AUTH())
    assert r.status_code == 200, r.text
    got = client.get("/api/garage/todo", headers=AUTH()).json()
    assert [i["kind"] for i in got["todo"]["zx4rr"]] == ["upgrade", "service", "roadtax"]
    assert got["odo"]["zx4rr"] == 10120
    assert got["todo"]["cefiro"] == []


@pytest.mark.parametrize("bad", [
    {**UPGRADE, "kind": "wish"},
    {**UPGRADE, "title": "  "},
    {**UPGRADE, "link": "javascript:alert(1)"},
    {**SERVICE, "every_km": None, "every_months": None},
    {**TAX, "due_date": "15/03/2027"},
    {**TAX, "due_date": ""},
])
def test_rejects_bad_items(client, bad):
    assert client.put("/api/garage/todo/zx4rr", json={"items": [bad]}, headers=AUTH()).status_code == 422


def test_rejects_duplicate_ids(client):
    assert client.put("/api/garage/todo/zx4rr", json={"items": [UPGRADE, UPGRADE]}, headers=AUTH()).status_code == 422
