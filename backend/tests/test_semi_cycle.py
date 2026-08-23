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
