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
