import os
import httpx
import logging
from sqlalchemy.future import select
from db.database import AsyncSessionLocal
from db.models import NotificationSettings

logger = logging.getLogger(__name__)

async def get_all_notification_settings():
    """Retrieve all active notification settings from database."""
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(NotificationSettings))
            return result.scalars().all()
        except Exception as e:
            logger.error(f"[Notifier] Failed to load all notification settings from DB: {e}")
    return []


async def _send_single_telegram_message(text: str, token: str, chat_id: str) -> tuple[bool, str]:
    """Helper function to send a message to a single Telegram recipient."""
    if not token or not chat_id:
        return False, "토큰 또는 Chat ID가 설정되지 않았습니다."

    token = str(token).strip()
    chat_id = str(chat_id).strip()
    
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
                logger.debug(f"[Notifier] Telegram notification sent successfully to chat_id: {chat_id}")
                return True, "성공"
            else:
                err_msg = f"API 오류 {res.status_code}: {res.text}"
                logger.error(f"[Notifier] {err_msg}")
                return False, err_msg
    except Exception as e:
        err_msg = f"네트워크 예외: {str(e)}"
        logger.error(f"[Notifier] {err_msg}")
        return False, err_msg


async def send_telegram_message(text: str, force: bool = False, category: str = "general", test_token: str = None, test_chat_id: str = None) -> tuple[bool, str]:
    """
    Send a message via Telegram Bot API asynchronously.
    If test_token or test_chat_id is specified, sends to that single target.
    Otherwise, broadcasts to all registered settings in the database.
    
    :param text: Message body (supports HTML tags).
    :param force: If True, bypass category settings checking.
    :param category: One of "exit_signal", "rebalance", "daily_summary", "general", "brazil_bond"
    :param test_token: Explicit token for testing purposes.
    :param test_chat_id: Explicit chat ID for testing purposes.
    """
    # 1. If explicit test arguments are provided, bypass database broadcast
    if test_token or test_chat_id:
        token = test_token or os.environ.get("TELEGRAM_TOKEN")
        chat_id = test_chat_id or os.environ.get("TELEGRAM_CHAT_ID")
        return await _send_single_telegram_message(text, token, chat_id)

    # 2. Retrieve all database settings
    all_settings = await get_all_notification_settings()
    
    if not all_settings:
        # Fallback to environment variables if no database records
        token = os.environ.get("TELEGRAM_TOKEN")
        chat_id = os.environ.get("TELEGRAM_CHAT_ID")
        if token and chat_id:
            logger.info("[Notifier] Database settings empty. Falling back to environment variables.")
            return await _send_single_telegram_message(text, token, chat_id)
        else:
            logger.warning("[Notifier] Telegram Token or Chat ID not configured. Skipping notification.")
            return False, "토큰 또는 Chat ID가 설정되지 않았습니다."

    # 3. Broadcast to all users in the DB
    any_success = False
    success_count = 0
    total_count = 0
    error_messages = []

    for settings in all_settings:
        # Skip if either token or chat id is missing for this user
        if not settings.telegram_token or not settings.telegram_chat_id:
            continue

        # Check category gating for this user
        if not force:
            if category == "exit_signal" and settings.alert_exit_signal == 0:
                continue
            if category == "rebalance" and settings.alert_rebalance == 0:
                continue
            if category == "daily_summary" and settings.alert_daily_summary == 0:
                continue
            if category == "brazil_bond" and getattr(settings, "alert_brazil", 1) == 0:
                continue

        total_count += 1
        success, err = await _send_single_telegram_message(text, settings.telegram_token, settings.telegram_chat_id)
        if success:
            any_success = True
            success_count += 1
        else:
            error_messages.append(f"Chat ID {settings.telegram_chat_id}: {err}")

    if total_count == 0:
        logger.info(f"[Notifier] No user settings enabled for category '{category}' or DB settings incomplete.")
        return False, f"카테고리 '{category}' 수신 대상이 없습니다."

    logger.info(f"[Notifier] Dispatched telegram notifications to {success_count}/{total_count} users.")
    if any_success:
        return True, "성공"
    else:
        return False, "; ".join(error_messages)

