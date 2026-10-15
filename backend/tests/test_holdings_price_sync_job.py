import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import pandas as pd
from datetime import datetime


@pytest.mark.asyncio
async def test_sync_user_holdings_prices_job():
    from scheduler.etf_price_sync import sync_user_holdings_prices_job

    # Mock yfinance.download
    dates = pd.date_range("2026-10-01", "2026-10-14")
    mock_df = pd.DataFrame({"Close": [3000.0 + i * 10 for i in range(len(dates))]}, index=dates)

    with patch("yfinance.download", return_value=mock_df), \
         patch("core.hybrid_series.get_hybrid_daily_prices", new_callable=AsyncMock) as mock_hybrid:
        
        mock_hybrid.return_value = [{"date": "2026-10-14", "close": 35000.0}]

        stats = await sync_user_holdings_prices_job()

        assert stats["benchmarks"] >= 4
        assert stats["holdings"] >= 1
        assert stats["errors"] == 0
