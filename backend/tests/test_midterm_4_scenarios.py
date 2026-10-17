import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_midterm_scenarios_returns_4_items():
    res = client.get("/api/v1/midterm/scenarios")
    assert res.status_code == 200
    data = res.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) == 4

    ids = [s["id"] for s in data["scenarios"]]
    assert "gridlock" in ids
    assert "red_hold" in ids
    assert "blue_wave" in ids
    assert "reverse_gridlock" in ids


def test_midterm_simulate_combinations():
    # 1. 상원 공화 / 하원 민주 -> gridlock
    r1 = client.get("/api/v1/midterm/simulate?senate=republican&house=democrat")
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["scenario_id"] == "gridlock"
    assert d1["probability"] == 60
    assert len(d1["recommended_etfs"]) > 0

    # 2. 상원 공화 / 하원 공화 -> red_hold
    r2 = client.get("/api/v1/midterm/simulate?senate=republican&house=republican")
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["scenario_id"] == "red_hold"
    assert d2["probability"] == 25

    # 3. 상원 민주 / 하원 민주 -> blue_wave
    r3 = client.get("/api/v1/midterm/simulate?senate=democrat&house=democrat")
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["scenario_id"] == "blue_wave"
    assert d3["probability"] == 10

    # 4. 상원 민주 / 하원 공화 -> reverse_gridlock
    r4 = client.get("/api/v1/midterm/simulate?senate=democrat&house=republican")
    assert r4.status_code == 200
    d4 = r4.json()
    assert d4["scenario_id"] == "reverse_gridlock"
    assert d4["probability"] == 5
