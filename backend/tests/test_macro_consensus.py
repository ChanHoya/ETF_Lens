# 8대 주요 경제 지표 월가 예상치 vs 실제치 서프라이즈 엔진 단위 테스트
import pytest
from core.macro_consensus import (
    INDICATOR_METADATA,
    CONSENSUS_SERIES_DATABASE,
    compute_surprise_attributes,
    get_macro_consensus_indicators
)


def test_indicator_metadata_complete():
    """8대 주요 경제 지표 메타데이터가 모두 포함되어 있는지 검증"""
    expected_keys = [
        "unemployment", "nonfarm_payrolls", "cpi", "core_cpi",
        "ppi", "core_ppi", "pce", "core_pce"
    ]
    for key in expected_keys:
        assert key in INDICATOR_METADATA
        meta = INDICATOR_METADATA[key]
        assert "name" in meta
        assert "category" in meta
        assert "unit" in meta
        assert "fed_target" in meta


def test_consensus_series_database():
    """모든 8대 지표에 대해 12개월 이상의 시계열 데이터가 존재하는지 검증"""
    for key in INDICATOR_METADATA:
        assert key in CONSENSUS_SERIES_DATABASE
        series = CONSENSUS_SERIES_DATABASE[key]
        assert len(series) >= 12
        for item in series:
            assert "date" in item
            assert "period" in item
            assert "actual" in item
            assert "estimate" in item
            assert "previous" in item


def test_compute_surprise_attributes_inflation():
    """인플레이션 지표의 서프라이즈 및 매파적(HAWKISH) 센티먼트 판정 검증"""
    # 실제치 > 예상치: 물가 상회 -> HAWKISH
    high_cpi = {"actual": 3.5, "estimate": 3.2, "previous": 3.1}
    res_high = compute_surprise_attributes("cpi", high_cpi)
    assert res_high["diff"] == 0.3
    assert res_high["status"] == "SURPRISE_UP"
    assert res_high["sentiment"] == "HAWKISH"
    assert res_high["badge_color"] == "rose"

    # 실제치 < 예상치: 물가 하회 -> DOVISH
    low_cpi = {"actual": 2.5, "estimate": 2.8, "previous": 2.9}
    res_low = compute_surprise_attributes("cpi", low_cpi)
    assert res_low["diff"] == -0.3
    assert res_low["status"] == "SURPRISE_DOWN"
    assert res_low["sentiment"] == "DOVISH"
    assert res_low["badge_color"] == "sky"

    # 실제치 == 예상치: 부합 -> IN_LINE
    exact_cpi = {"actual": 2.6, "estimate": 2.6, "previous": 2.5}
    res_exact = compute_surprise_attributes("cpi", exact_cpi)
    assert res_exact["diff"] == 0.0
    assert res_exact["status"] == "IN_LINE"
    assert res_exact["sentiment"] == "NEUTRAL"


def test_get_macro_consensus_indicators_all():
    """전체 지표에 대한 스코어보드 및 시계열 조회 검증"""
    data = get_macro_consensus_indicators(indicator_key=None, period="1Y")
    assert data["status"] == "success"
    assert "scoreboard" in data
    assert len(data["scoreboard"]) == 8
    assert "series" in data
    assert len(data["series"]) == 8
    assert "analysis" in data
    assert "overall_stance" in data["analysis"]
    assert "market_summary" in data["analysis"]


def test_get_macro_consensus_indicators_single():
    """단일 지표(CPI)에 대한 필터링 조회 검증"""
    data = get_macro_consensus_indicators(indicator_key="cpi", period="6M")
    assert data["status"] == "success"
    assert len(data["scoreboard"]) == 1
    assert data["scoreboard"][0]["key"] == "cpi"
    assert len(data["series"]["cpi"]) == 6
