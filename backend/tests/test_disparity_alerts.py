import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from db.database import engine, Base
from main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True, scope="module")
def setup_db():
    loop = asyncio.new_event_loop()
    async def _setup():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            from sqlalchemy import text
            cols = [
                ("discord_webhook_url", "TEXT"),
                ("slack_webhook_url", "TEXT"),
                ("channel_telegram", "INTEGER DEFAULT 1"),
                ("channel_discord", "INTEGER DEFAULT 0"),
                ("channel_slack", "INTEGER DEFAULT 0"),
                ("alert_brazil", "INTEGER DEFAULT 1"),
                ("alert_disparity", "INTEGER DEFAULT 1"),
                ("disparity_threshold", "REAL DEFAULT 2.0"),
                ("disparity_target_scope", "TEXT DEFAULT 'PORTFOLIO'")
            ]
            for col_name, col_type in cols:
                try:
                    await conn.execute(text(f"ALTER TABLE notification_settings ADD COLUMN {col_name} {col_type}"))
                except Exception:
                    pass
    loop.run_until_complete(_setup())
    yield
    loop.close()


@pytest.mark.anyio
async def test_notification_settings_multichannel_and_disparity():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. 초기 설정 조회
        res = await ac.get("/api/v1/notification/settings")
        assert res.status_code == 200
        data = res.json()
        assert "channel_telegram" in data
        assert "channel_discord" in data
        assert "channel_slack" in data
        assert "alert_disparity" in data
        assert "disparity_threshold" in data
        assert "disparity_target_scope" in data

        # 2. 멀티채널 및 괴리율 개인화 임계치 설정 저장
        payload = {
            "telegram_token": "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ",
            "telegram_chat_id": "888999",
            "discord_webhook_url": "https://discord.com/api/webhooks/123456/abcdefghijklmn",
            "slack_webhook_url": "https://hooks.slack.com/services/T00/B00/abcdefghijklmn",
            "channel_telegram": 1,
            "channel_discord": 1,
            "channel_slack": 1,
            "alert_exit_signal": 1,
            "alert_rebalance": 1,
            "alert_daily_summary": 0,
            "alert_brazil": 1,
            "alert_disparity": 1,
            "disparity_threshold": 1.5,
            "disparity_target_scope": "ALL"
        }
        res_save = await ac.post("/api/v1/notification/settings", json=payload)
        assert res_save.status_code == 200
        assert res_save.json()["status"] == "success"

        # 3. 재조회 및 마스킹/값 검증
        res_get = await ac.get("/api/v1/notification/settings?chat_id=888999")
        assert res_get.status_code == 200
        saved = res_get.json()
        assert saved["telegram_chat_id"] == "888999"
        assert saved["channel_discord"] == 1
        assert saved["channel_slack"] == 1
        assert saved["alert_disparity"] == 1
        assert saved["disparity_threshold"] == 1.5
        assert saved["disparity_target_scope"] == "ALL"
        # Discord & Slack 웹훅 마스킹 확인
        assert "******" in saved["discord_webhook_url"]
        assert "******" in saved["slack_webhook_url"]


@pytest.mark.anyio
async def test_multichannel_test_endpoint(monkeypatch):
    discord_called = False
    slack_called = False

    async def mock_discord(text, webhook_url, title=None):
        nonlocal discord_called
        discord_called = True
        assert "i-Prism" in text
        return True, "성공"

    async def mock_slack(text, webhook_url, title=None):
        nonlocal slack_called
        slack_called = True
        assert "i-Prism" in text
        return True, "성공"

    monkeypatch.setattr("api.notification_settings._send_single_discord_message", mock_discord)
    monkeypatch.setattr("api.notification_settings._send_single_slack_message", mock_slack)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Discord 테스트 발송
        res_dc = await ac.post("/api/v1/notification/test", json={
            "channel": "discord",
            "discord_webhook_url": "https://discord.com/api/webhooks/test/webhook"
        })
        assert res_dc.status_code == 200
        assert "Discord" in res_dc.json()["msg"]
        assert discord_called is True

        # 2. Slack 테스트 발송
        res_sl = await ac.post("/api/v1/notification/test", json={
            "channel": "slack",
            "slack_webhook_url": "https://hooks.slack.com/services/test/webhook"
        })
        assert res_sl.status_code == 200
        assert "Slack" in res_sl.json()["msg"]
        assert slack_called is True


@pytest.mark.anyio
async def test_disparity_scheduler_alert_and_cooldown(monkeypatch):
    from core.scheduler import check_etf_disparity_and_alert, _disparity_alert_cache

    _disparity_alert_cache.clear()
    broadcast_count = 0
    broadcast_text = ""

    async def mock_fetch_etf_disparity_list():
        return {
            "069500": {
                "name": "KODEX 200",
                "price": 36000,
                "nav": 35000,
                "disparity_rate": 2.85  # > 1.5% threshold
            },
            "102110": {
                "name": "TIGER 200",
                "price": 36100,
                "nav": 36050,
                "disparity_rate": 0.14  # < 1.5%
            }
        }

    async def mock_broadcast(text, category="general", title=None, force=False):
        nonlocal broadcast_count, broadcast_text
        broadcast_count += 1
        broadcast_text = text
        assert category == "disparity"
        assert "KODEX 200" in text
        assert "2.85%" in text
        return {"any_success": True}

    async def mock_get_my_portfolio(request=None, db=None):
        return {"kis_raw": {"holdings": [{"code": "069500", "name": "KODEX 200"}]}}

    monkeypatch.setattr("api.my_assets.get_my_portfolio", mock_get_my_portfolio)
    monkeypatch.setattr("core.disparity_analyzer.fetch_etf_disparity_list", mock_fetch_etf_disparity_list)
    monkeypatch.setattr("core.notifier.broadcast_notification", mock_broadcast)

    # 1. 첫 실행 -> 알림 발송됨
    await check_etf_disparity_and_alert()
    assert broadcast_count == 1
    assert "069500" in _disparity_alert_cache

    # 2. 즉시 두 번째 실행 -> 쿨다운으로 인해 발송 생략됨 (count 변화 없음)
    await check_etf_disparity_and_alert()
    assert broadcast_count == 1
