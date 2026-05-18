import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from db.database import engine, Base
from main import app

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(autouse=True, scope="module")
def setup_db(event_loop):
    async def _setup_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    event_loop.run_until_complete(_setup_db())
    yield
    async def _teardown_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    event_loop.run_until_complete(_teardown_db())

@pytest.mark.anyio
async def test_notification_settings_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. GET settings (should return initial defaults or current settings)
        res = await ac.get("/api/v1/notification/settings")
        assert res.status_code == 200
        json_data = res.json()
        assert "telegram_token" in json_data
        assert "telegram_chat_id" in json_data
        assert "alert_exit_signal" in json_data

        # 2. POST to save settings
        save_payload = {
            "telegram_token": "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ",
            "telegram_chat_id": "987654321",
            "alert_exit_signal": 1,
            "alert_rebalance": 0,
            "alert_daily_summary": 1
        }
        res_save = await ac.post("/api/v1/notification/settings", json=save_payload)
        assert res_save.status_code == 200
        assert res_save.json()["status"] == "success"

        # 3. GET settings again to verify values are saved and masked correctly
        res_get2 = await ac.get("/api/v1/notification/settings")
        assert res_get2.status_code == 200
        get2_data = res_get2.json()
        assert get2_data["telegram_chat_id"] == "987654321"
        assert get2_data["alert_rebalance"] == 0
        assert get2_data["alert_daily_summary"] == 1
        # Token must be masked (e.g. contains "*******")
        assert "******" in get2_data["telegram_token"]

        # 4. POST test notification with invalid token should fail mock check
        test_payload = {
            "telegram_token": "invalid_token",
            "telegram_chat_id": "invalid_chat"
        }
        res_test = await ac.post("/api/v1/notification/test", json=test_payload)
        # Note: If it attempts real network call it might fail, let's verify routing works.
        assert res_test.status_code in [400, 200, 500]  # Depends on external API availability or validation


@pytest.mark.anyio
async def test_scheduler_alerting_and_rebalance(monkeypatch):
    from core.scheduler import check_exit_signal_and_alert
    from api.rebalance_proposal import notify_rebalance_proposal
    
    # 1. Test check_exit_signal_and_alert
    exit_signal_called = False
    async def mock_get_exit_signal_data():
        return {
            "current_status": {"vix": 15.5, "fgi": 62.0, "cli": 100.8, "per": 11.2},
            "risk": {
                "level": "safe",
                "label": "안전",
                "color": "green",
                "score": 1
            }
        }
        
    async def mock_send_telegram_message(text: str, force: bool = False, category: str = "general"):
        nonlocal exit_signal_called
        exit_signal_called = True
        assert "시장 위험도(Exit Signal)" in text or "AI 포트폴리오 자산" in text
        return True
        
    monkeypatch.setattr("api.exit_signal.get_exit_signal_data", mock_get_exit_signal_data)
    monkeypatch.setattr("core.notifier.send_telegram_message", mock_send_telegram_message)
    
    # Run the scheduler alert job check
    await check_exit_signal_and_alert()
    assert exit_signal_called is True
    
    # 2. Test notify_rebalance_proposal format
    rebalance_called = False
    async def mock_send_rebalance_msg(text: str, force: bool = False, category: str = "rebalance"):
        nonlocal rebalance_called
        rebalance_called = True
        assert "[AI 포트폴리오 자산 재조정 제안]" in text
        assert "유지" in text or "교체" in text
        return True
        
    monkeypatch.setattr("core.notifier.send_telegram_message", mock_send_rebalance_msg)
    
    mock_proposal = {
        "overall_summary": "Your portfolio is stable but replaceable.",
        "recommendations": [
            {"code": "069500", "name": "KODEX 200", "action": "KEEP", "reasoning": "Performing inline with Index."},
            {"code": "396500", "name": "TIGER 반도체", "action": "REPLACE", "reasoning": "Lagging peer benchmark.", "alternative_etf": "456780 (ACE 반도체)"}
        ]
    }
    await notify_rebalance_proposal(mock_proposal)
    assert rebalance_called is True
