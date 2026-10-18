import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from core.morning_briefing import generate_morning_briefing_data, format_morning_briefing_message

def test_morning_briefing_data_generation():
    data = generate_morning_briefing_data()
    assert "date" in data
    assert "us_markets" in data
    assert "sp500" in data["us_markets"]
    assert "sox" in data["us_markets"]
    assert "macro" in data
    assert "ndf_krw" in data["macro"]
    assert "checkpoints" in data
    assert len(data["checkpoints"]) >= 3
    
    msg = format_morning_briefing_message(data)
    assert "데일리 모닝 인텔리전스" in msg
    assert "S&P 500" in msg
    assert "NDF 원/달러" in msg

@pytest.mark.asyncio
async def test_morning_briefing_api_and_webhook():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. 수동 발송/미리보기 엔드포인트
        res = await ac.post("/api/v1/telegram/send-morning-briefing")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert "briefing" in data
        assert "formatted_message" in data
        
        # 2. 텔레그램 Webhook /morning 명령어 테스트
        webhook_payload = {
            "update_id": 9999,
            "message": {
                "message_id": 101,
                "chat": {"id": 123456789, "type": "private"},
                "text": "/morning"
            }
        }
        res_cmd = await ac.post("/api/v1/telegram/webhook", json=webhook_payload)
        assert res_cmd.status_code == 200
        cmd_data = res_cmd.json()
        assert cmd_data["ok"] is True
        assert cmd_data["command"] == "morning"
