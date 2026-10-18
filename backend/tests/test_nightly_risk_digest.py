import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_send_nightly_risk_digest():
    from core.risk_digest import send_nightly_risk_digest

    mock_broadcast = AsyncMock(return_value={"any_success": True, "telegram": {"success": 1}})

    with patch("core.risk_digest.broadcast_notification", mock_broadcast):
        stats = {"benchmarks": 4, "holdings": 12, "errors": 0}
        success = await send_nightly_risk_digest(stats)

        assert success is True
        assert mock_broadcast.called
        call_kwargs = mock_broadcast.call_args.kwargs
        assert "야간 시계열 시딩" in call_kwargs["text"]
        assert "4대 벤치마크" in call_kwargs["text"]
        assert "포트폴리오 매크로 민감도" in call_kwargs["text"]
        assert "달러 노출 비중" in call_kwargs["text"]
        assert call_kwargs["category"] == "exit_signal"
