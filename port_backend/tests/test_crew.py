"""Mascot crew: validation and the GET/PUT endpoints."""
import copy

import pytest
from fastapi.testclient import TestClient

from app import crew, garage_store, main


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(garage_store, "PATH", tmp_path / "garage.json")
    return TestClient(main.app)


def auth():
    return {"Authorization": f"Bearer {main.make_token()}"}


def member(**over):
    m = copy.deepcopy(crew.DEFAULT_CREW[0])
    m.update(over)
    return m


def test_default_crew_is_public(client):
    r = client.get("/api/crew")
    assert r.status_code == 200
    assert r.json()["members"][0]["look"]["shape"] == "ghost"


def test_saving_needs_the_garage_password(client):
    assert client.put("/api/crew", json={"members": [member()]}).status_code == 401


def test_save_and_read_back(client):
    m = member(name="Chief", look={**crew.DEFAULT_CREW[0]["look"], "head": "fullface", "helmetColor": "#E10600"})
    r = client.put("/api/crew", json={"members": [m, member(id="two", name="Two", role="main")]}, headers=auth())
    assert r.status_code == 200
    got = client.get("/api/crew").json()["members"]
    assert [x["id"] for x in got] == ["chief", "two"]
    assert got[0]["look"]["helmetColor"] == "#e10600"      # normalised
    assert [x["role"] for x in got] == ["main", "crew"]   # exactly one main: the first one marked


@pytest.mark.parametrize("bad", [
    {"shape": "spaceship"},
    {"color": "red"},
    {"outfitColor": "#12345"},
    {"eyes": None},
])
def test_rejects_unknown_parts(client, bad):
    m = member(look={**crew.DEFAULT_CREW[0]["look"], **bad})
    assert client.put("/api/crew", json={"members": [m]}, headers=auth()).status_code == 422


def test_rejects_duplicate_ids_and_empty_crew(client):
    assert client.put("/api/crew", json={"members": [member(), member()]}, headers=auth()).status_code == 422
    assert client.put("/api/crew", json={"members": []}, headers=auth()).status_code == 422


def test_old_looks_without_helmet_colour_still_load():
    look = {k: v for k, v in crew.DEFAULT_CREW[0]["look"].items() if k != "helmetColor"}
    assert crew.clean_look(look)["helmetColor"] == "#f3f3f5"
