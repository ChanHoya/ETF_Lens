import os
import httpx
import logging
from sqlalchemy.future import select
from db.database import AsyncSessionLocal
from db.models import NotificationSettings

logger = logging.getLogger(__name__)

async def get_notification_settings():
    """Retrieve the active notification settings from database, or fallback to environment variables."""
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(NotificationSettings).order_by(NotificationSettings.id.desc()))
            settings = result.scalars().first()
            if settings:
                return settings
        except Exception as e:
            logger.error(f"[Notifier] Failed to load notification settings from DB: {e}")
    
    # Fallback to environment variables if database is empty or errors out
    return None

async def send_telegram_message(text: str, force: bool = False, category: str = "general", test_token: str = None, test_chat_id: str = None) -> bool:
    """
    Send a message via Telegram Bot API asynchronously.
    
    :param text: Message body (supports HTML tags).
    :param force: If True, bypass category settings checking.
    :param category: One of "exit_signal", "rebalance", "daily_summary", "general"
    :param test_token: Explicit token for testing purposes.
    :param test_chat_id: Explicit chat ID for testing purposes.
    """
    settings = await get_notification_settings()
    
    token = test_token or os.environ.get("TELEGRAM_TOKEN")
    chat_id = test_chat_id or os.environ.get("TELEGRAM_CHAT_ID")
    
    # Check database override (only if not explicitly testing)
    if settings:
        if settings.telegram_token and not test_token:
            token = settings.telegram_token
        if settings.telegram_chat_id and not test_chat_id:
            chat_id = settings.telegram_chat_id
            
        # Check if the specific alert category is disabled
        if not force:
            if category == "exit_signal" and settings.alert_exit_signal == 0:
                logger.info("[Notifier] Exit signal alert is disabled in settings.")
                return False
            if category == "rebalance" and settings.alert_rebalance == 0:
                logger.info("[Notifier] Rebalance alert is disabled in settings.")
                return False
            if category == "daily_summary" and settings.alert_daily_summary == 0:
                logger.info("[Notifier] Daily summary alert is disabled in settings.")
                return False

    if not token or not chat_id:
        logger.warning("[Notifier] Telegram Token or Chat ID not configured. Skipping notification.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                logger.info("[Notifier] Telegram notification sent successfully.")
                return True
            else:
                logger.error(f"[Notifier] Telegram API failed with status {res.status_code}: {res.text}")
                return False
    except Exception as e:
        logger.error(f"[Notifier] Failed to send Telegram message due to exception: {e}")
        return False
