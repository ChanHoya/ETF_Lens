import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_election_and_copom_tracker_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.get("/api/v1/brazil-bond/election-and-copom-tracker")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "election" in data
        assert "copom" in data
        assert data["election"]["runoff_date"] == "2026-10-25"
        assert data["election"]["phase"] == "runoff_campaign"
        assert len(data["election"]["polls"]) >= 4
        assert "average" in data["election"]
        assert data["copom"]["meeting_date"] == "2026-11-05"
        assert data["copom"]["rate_cut_probabilities"]["cut_25bp"] == 68.0
