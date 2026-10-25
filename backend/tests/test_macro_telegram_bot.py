# 텔레그램 봇 반도체 및 산업 매크로 명령어 처리 무결성을 검증하는 테스트
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_telegram_semi_command():
    """텔레그램 /semi 명령어 수신 시 반도체 펀더멘털 브리핑 전송 검증."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("api.telegram_bot.send_telegram_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = True

            payload = {
                "update_id": 999991,
                "message": {
                    "message_id": 101,
                    "chat": {"id": 12345678, "type": "private"},
                    "text": "/semi",
                },
            }
            res = await client.post("/api/v1/telegram/webhook", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data.get("ok") is True
            assert data.get("command") == "semi"

            assert mock_send.called
            sent_text = mock_send.call_args.kwargs.get("text") or mock_send.call_args[0][0]
            assert "반도체 사이클" in sent_text
            assert "강한 호황" in sent_text
            assert "$310.0억" in sent_text


@pytest.mark.asyncio
async def test_telegram_macro_command():
    """텔레그램 /macro 명령어 수신 시 3대 주력산업 DB 브리핑 전송 검증."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("api.telegram_bot.send_telegram_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = True

            payload = {
                "update_id": 999992,
                "message": {
                    "message_id": 102,
                    "chat": {"id": 12345678, "type": "private"},
                    "text": "/macro",
                },
            }
            res = await client.post("/api/v1/telegram/webhook", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data.get("ok") is True
            assert data.get("command") == "macro"

            assert mock_send.called
            sent_text = mock_send.call_args.kwargs.get("text") or mock_send.call_args[0][0]
            assert "3대 주력 수출산업" in sent_text
            assert "2차전지" in sent_text
            assert "자동차" in sent_text
