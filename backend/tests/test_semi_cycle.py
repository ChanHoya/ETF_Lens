import pytest
from core.semi_cycle_engine import SemiCycleEngine, _calc_z_score
import pandas as pd
import numpy as np


def test_z_score_calculation():
    s = pd.Series([10, 12, 14, 16, 18, 20, 22, 24, 26, 28])
    z = _calc_z_score(s, window=5)
    assert len(z) == 10
    assert not z.isna().any()


@pytest.mark.asyncio
async def test_semi_cycle_clock_data():
    data = await SemiCycleEngine.get_cycle_clock_data()
    assert "current_csci" in data
    assert "current_phase" in data
    assert "trajectory" in data
    assert len(data["trajectory"]) > 0
    assert data["current_phase"] in [1, 2, 3, 4]


@pytest.mark.asyncio
async def test_semi_capex_tracker():
    data = await SemiCycleEngine.get_capex_momentum_tracker()
    assert "time_series" in data
    assert "bigtech_companies" in data
    assert len(data["time_series"]) > 0
    assert len(data["bigtech_companies"]) == 4
    assert data["total_quarterly_capex_billion"] > 0


@pytest.mark.asyncio
async def test_semi_subsector_matrix():
    data = await SemiCycleEngine.get_subsector_decoupling_matrix()
    assert "subsectors" in data
    assert len(data["subsectors"]) == 4
    for sub in data["subsectors"]:
        assert "current_fwd_pe" in sub
        assert "pe_percentile" in sub
        assert "eps_revision_3m" in sub


@pytest.mark.asyncio
async def test_semi_etf_matrix():
    data = await SemiCycleEngine.get_etf_rebalancing_matrix()
    assert "etfs" in data
    assert "asset_allocation_model" in data
    assert len(data["etfs"]) >= 5
    for etf in data["etfs"]:
        assert 0 <= etf["fit_score"] <= 100
        assert etf["rating"] in ["STRONG_BUY", "BUY", "HOLD", "REDUCE"]


@pytest.mark.asyncio
async def test_semi_macro_signals():
    data = await SemiCycleEngine.get_macro_signals(industry="semiconductor")
    assert "signals" in data
    assert len(data["signals"]) == 7
    assert "current_state" in data
    assert "stages" in data
    assert len(data["stages"]) == 5
    for sig in data["signals"]:
        assert "current_value_formatted" in sig
        assert "series_5y" in sig
        assert len(sig["series_5y"]) > 0


@pytest.mark.asyncio
async def test_semi_industries_summary():
    data = await SemiCycleEngine.get_industries_summary()
    assert "industries" in data
    assert len(data["industries"]) >= 10


@pytest.mark.asyncio
async def test_macro_signals_header_matches_series():
    """헤더 수치가 자기 차트의 마지막 값과 일치해야 한다 (하드코딩 상수 회귀 방지)."""
    data = await SemiCycleEngine.get_macro_signals(industry="semiconductor")
    for sig in data["signals"]:
        last = sig["series_10y"][-1]["value"]
        assert abs(sig["current_value"] - last) < 0.06, f"{sig['id']}: {sig['current_value']} != {last}"


@pytest.mark.asyncio
async def test_macro_signals_period_slices_differ():
    """5Y 슬라이스는 10Y보다 짧아야 한다 (기간 버튼이 실제로 구간을 바꾸는지)."""
    data = await SemiCycleEngine.get_macro_signals(industry="semiconductor")
    for sig in data["signals"]:
        assert len(sig["series_5y"]) < len(sig["series_10y"]), sig["id"]


@pytest.mark.asyncio
async def test_macro_signals_count_matches_statuses():
    """반도체 신호 집계는 개별 지표 판정 결과와 일치해야 한다."""
    data = await SemiCycleEngine.get_macro_signals(industry="semiconductor")
    counts = data["signals_count"]
    for code, key in (("bullish", "bullish"), ("neutral", "neutral"), ("bearish", "bearish")):
        assert counts[key] == sum(1 for s in data["signals"] if s["status"] == code)
    assert counts["total"] == len(data["signals"]) == 7


@pytest.mark.asyncio
async def test_non_semi_industry_does_not_reuse_semi_stats():
    """공표통계 미연동 업종은 반도체 수치를 빌려오지 않고 미연동으로 표시해야 한다."""
    semi = await SemiCycleEngine.get_macro_signals(industry="semiconductor")
    other = await SemiCycleEngine.get_macro_signals(industry="shipbuilding")
    semi_by_id = {s["id"]: s for s in semi["signals"]}

    stat_ids = ["kr_export_amount", "export_unit_price", "real_export_volume",
                "capacity_utilization", "inventory_index"]
    for sig in other["signals"]:
        if sig["id"] in stat_ids:
            assert sig["available"] is False
            assert sig["series_10y"] == []
            assert sig["current_value"] != semi_by_id[sig["id"]]["current_value"]
        else:
            assert sig["available"] is True
            assert len(sig["series_10y"]) > 0
    assert other["signals_count"]["total"] == 2


@pytest.mark.asyncio
async def test_phase_is_derived_from_score():
    """국면·게이지·타임라인이 모두 실제 종합 점수에서 유도돼야 한다."""
    from core.semi_cycle_engine import _phase_of

    data = await SemiCycleEngine.get_macro_signals(industry="semiconductor")
    score = float(data["weighted_score"])
    assert data["current_state_code"] == _phase_of(score)["code"]
    assert data["score_gauge_pct"] == max(0, min(100, round((score + 1) / 2 * 100)))

    assert len(data["timeline"]) > 1
    for entry in data["timeline"]:
        assert entry["state"] == _phase_of(entry["score"])["short"]
        assert entry["color"] == _phase_of(entry["score"])["color"]
    assert data["timeline"][-1]["code"] == data["current_state_code"]


@pytest.mark.asyncio
async def test_industries_summary_is_measured():
    """업종 요약도 같은 엔진으로 실측 판정해야 한다."""
    from core.semi_cycle_engine import INDUSTRY_PROFILES, _phase_of

    data = await SemiCycleEngine.get_industries_summary()
    assert len(data["industries"]) == len(INDUSTRY_PROFILES)
    for ind in data["industries"]:
        assert ind["state"] == _phase_of(ind["score"])["short"]
        assert ind["trend"] in ("up", "down")
        assert ind["is_partial"] is not INDUSTRY_PROFILES[ind["id"]]["has_official_stats"]
