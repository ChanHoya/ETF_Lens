import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_telegram_webhook_asset_command():
    mock_send = AsyncMock(return_value=True)
    with patch("api.telegram_bot.send_telegram_message", mock_send):
        payload = {
            "update_id": 1001,
            "message": {
                "message_id": 1,
                "chat": {"id": 12345678},
                "text": "/asset"
            }
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/telegram/webhook", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data.get("ok") is True
            assert data.get("command") == "asset"
            assert mock_send.called
            call_kwargs = mock_send.call_args.kwargs
            assert "가계 총 순자산" in call_kwargs["text"]
            assert "inline_keyboard" in call_kwargs["reply_markup"]

@pytest.mark.asyncio
async def test_telegram_webhook_rebalance_command():
    mock_send = AsyncMock(return_value=True)
    with patch("api.telegram_bot.send_telegram_message", mock_send):
        payload = {
            "update_id": 1002,
            "message": {
                "message_id": 2,
                "chat": {"id": 12345678},
                "text": "/rebalance"
            }
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/telegram/webhook", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data.get("ok") is True
            assert data.get("command") == "rebalance"
            assert mock_send.called
            call_kwargs = mock_send.call_args.kwargs
            assert "리밸런싱 설계안" in call_kwargs["text"]
            # callback_data: exec_rebalance 버튼 확인
            kb = call_kwargs["reply_markup"]["inline_keyboard"]
            assert any(btn.get("callback_data") == "exec_rebalance" for row in kb for btn in row)

@pytest.mark.asyncio
async def test_telegram_webhook_callback_exec_rebalance():
    mock_send = AsyncMock(return_value=True)
    with patch("api.telegram_bot.send_telegram_message", mock_send):
        payload = {
            "update_id": 1003,
            "callback_query": {
                "id": "cb_999",
                "data": "exec_rebalance",
                "message": {
                    "chat": {"id": 12345678}
                }
            }
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/telegram/webhook", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data.get("ok") is True
            assert data.get("action") == "rebalance_executed"
            assert mock_send.called
            call_kwargs = mock_send.call_args.kwargs
            assert "가상 리밸런싱 체결 완료" in call_kwargs["text"]
