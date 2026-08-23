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
