import pytest
from api.brazil_election_intel import normalize_intel, merge_ai_patch, DEFAULT_ELECTION_INTEL

def test_normalize_intel_defaults():
    intel = normalize_intel(None)
    assert intel["phase"] == "pre_first_round"
    assert len(intel["candidates"]) == 2
    assert len(intel["polls"]) >= 2
    assert intel["first_round"] is None


def test_merge_ai_patch_updates_headline_and_events():
    base = normalize_intel(None)
    patch = {
        "headline": "1차 투표 공식 결과 발표 직전 초긴장",
        "phase": "runoff_campaign",
        "events": [
            {"date": "2026-10-04", "title": "전국 전자투표 투표율 81.2% 기록", "detail": "역대급 투표율"}
        ],
        "first_round": {
            "status": "개표 완료",
            "lula_pct": 48.4,
            "flavio_pct": 43.2,
            "others_pct": 8.4,
            "turnout_pct": 81.2,
            "runoff": True,
            "summary": "과반 미달로 10월 25일 결선 확정"
        }
    }
    merged = merge_ai_patch(base, patch)
    assert merged["headline"] == "1차 투표 공식 결과 발표 직전 초긴장"
    assert merged["phase"] == "runoff_campaign"
    assert merged["first_round"]["runoff"] is True
    assert any(e["date"] == "2026-10-04" for e in merged["events"])
