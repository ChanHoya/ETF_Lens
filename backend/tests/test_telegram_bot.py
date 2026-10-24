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

@pytest.mark.asyncio
async def test_telegram_webhook_callback_quadrant_plan():
    mock_send = AsyncMock(return_value=True)
    with patch("api.telegram_bot.send_telegram_message", mock_send):
        payload = {
            "update_id": 1004,
            "callback_query": {
                "id": "cb_1000",
                "data": "quadrant_plan",
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
            assert data.get("action") == "quadrant_plan_sent"
            assert mock_send.called
            call_kwargs = mock_send.call_args.kwargs
            assert "황금 밸런스" in call_kwargs["text"]
            assert "비타민 ETF" in call_kwargs["text"]

@pytest.mark.asyncio
async def test_telegram_webhook_callback_cashflow_offset():
    mock_send = AsyncMock(return_value=True)
    with patch("api.telegram_bot.send_telegram_message", mock_send):
        payload = {
            "update_id": 1005,
            "callback_query": {
                "id": "cb_1001",
                "data": "cashflow_offset",
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
            assert data.get("action") == "cashflow_offset_sent"
            assert mock_send.called
            call_kwargs = mock_send.call_args.kwargs
            assert "고정지출" in call_kwargs["text"]
            assert "상계율" in call_kwargs["text"]

@pytest.mark.asyncio
async def test_telegram_webhook_tax_command():
    mock_send = AsyncMock(return_value=True)
    with patch("api.telegram_bot.send_telegram_message", mock_send):
        payload = {
            "update_id": 1006,
            "message": {
                "message_id": 4,
                "chat": {"id": 12345678},
                "text": "/tax"
            }
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/telegram/webhook", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data.get("ok") is True
            assert data.get("command") == "tax"
            assert mock_send.called
            call_kwargs = mock_send.call_args.kwargs
            assert "연말정산 절세 골든타임" in call_kwargs["text"]
            assert "13월의 월급" in call_kwargs["text"]
            assert "inline_keyboard" in call_kwargs["reply_markup"]


@pytest.mark.asyncio
async def test_telegram_webhook_fomc_command():
    mock_send = AsyncMock(return_value=True)
    with patch("api.telegram_bot.send_telegram_message", mock_send):
        payload = {
            "update_id": 1007,
            "message": {
                "message_id": 5,
                "chat": {"id": 12345678},
                "text": "/fomc"
            }
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.post("/api/v1/telegram/webhook", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data.get("ok") is True
            assert data.get("command") == "fomc"
            assert mock_send.called
            call_kwargs = mock_send.call_args.kwargs
            assert "11월 FOMC" in call_kwargs["text"]
            assert "CME FedWatch" in call_kwargs["text"]
            assert "ACE 미국30년국채액티브" in call_kwargs["text"]
            assert "inline_keyboard" in call_kwargs["reply_markup"]


@pytest.mark.asyncio
async def test_rates_fedwatch_probabilities_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/rates/fedwatch-probabilities")
        assert res.status_code == 200
        data = res.json()
        assert "fomc" in data
        assert "bok" in data
        assert "beneficiary_etfs" in data
        assert data["fomc"]["probabilities"]["cut_25bp"] > 50
        assert len(data["beneficiary_etfs"]) >= 3



