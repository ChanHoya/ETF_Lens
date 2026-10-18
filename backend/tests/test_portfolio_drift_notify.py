import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_portfolio_drift_detection_and_notification():
    from core.portfolio_rebalancer import check_portfolio_drift_and_notify

    mock_broadcast = AsyncMock(return_value={"any_success": True, "telegram": {"success": 1}})

    # 편중된 포트폴리오 (S&P500 70%, KODEX200 20%, 미국채 10%) vs 목표비중 (33.3%씩 균등)
    holdings = [
        {"code": "360750", "name": "TIGER 미국S&P500", "current_val": 70_000_000, "current_price": 70_000, "current_qty": 1000},
        {"code": "069500", "name": "KODEX 200", "current_val": 20_000_000, "current_price": 20_000, "current_qty": 1000},
        {"code": "453850", "name": "ACE 미국30년국채액티브(H)", "current_val": 10_000_000, "current_price": 10_000, "current_qty": 1000},
    ]

    target_weights = {
        "360750": 33.3,
        "069500": 33.3,
        "453850": 33.4
    }

    with patch("core.portfolio_rebalancer.broadcast_notification", mock_broadcast):
        res = await check_portfolio_drift_and_notify(
            holdings=holdings,
            target_weights=target_weights,
            threshold_drift_score=85.0
        )

        assert res["needs_alert"] is True
        assert res["drift_score"] < 85.0
        assert res["divergent_items_count"] > 0
        assert mock_broadcast.called

        call_kwargs = mock_broadcast.call_args.kwargs
        assert "포트폴리오 목표 비중 이탈" in call_kwargs["text"]
        assert "reply_markup" in call_kwargs
        assert "inline_keyboard" in call_kwargs["reply_markup"]
        assert call_kwargs["category"] == "rebalance"
