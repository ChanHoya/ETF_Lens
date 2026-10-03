import os
import re
import httpx
import logging
import asyncio
from sqlalchemy.future import select
from db.database import AsyncSessionLocal
from db.models import NotificationSettings

logger = logging.getLogger(__name__)


def _html_to_markdown(html_text: str) -> str:
    """HTML 메시지(Telegram 형식)를 Discord/일반 Markdown 형식으로 변환."""
    if not html_text:
        return ""
    text = html_text
    # 줄바꿈 태그
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    # 볼드
    text = re.sub(r"</?(b|strong)>", "**", text, flags=re.IGNORECASE)
    # 이탤릭
    text = re.sub(r"</?(i|em)>", "*", text, flags=re.IGNORECASE)
    # 코드
    text = re.sub(r"</?code>", "`", text, flags=re.IGNORECASE)
    # 프리포맷
    text = re.sub(r"</?pre>", "```\n", text, flags=re.IGNORECASE)
    # 하이퍼링크: <a href="url">text</a> -> [text](url)
    text = re.sub(r'<a\s+href=["\']([^"\']+)["\']>([\s\S]*?)</a>', r"[\2](\1)", text, flags=re.IGNORECASE)
    # 기타 남은 HTML 태그 제거
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


def _html_to_slack_mrkdwn(html_text: str) -> str:
    """HTML 메시지를 Slack mrkdwn 형식으로 변환 (Slack은 *bold*, _italic_ 사용)."""
    if not html_text:
        return ""
    text = html_text
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(b|strong)>", "*", text, flags=re.IGNORECASE)
    text = re.sub(r"</?(i|em)>", "_", text, flags=re.IGNORECASE)
    text = re.sub(r"</?code>", "`", text, flags=re.IGNORECASE)
    text = re.sub(r"</?pre>", "```\n", text, flags=re.IGNORECASE)
    text = re.sub(r'<a\s+href=["\']([^"\']+)["\']>([\s\S]*?)</a>', r"<\1|\2>", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


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
                err_msg = f"Telegram API 오류 {res.status_code}: {res.text}"
                logger.error(f"[Notifier] {err_msg}")
                return False, err_msg
    except Exception as e:
        err_msg = f"Telegram 네트워크 예외: {str(e)}"
        logger.error(f"[Notifier] {err_msg}")
        return False, err_msg


async def _send_single_discord_message(text: str, webhook_url: str, title: str = None) -> tuple[bool, str]:
    """Helper function to send a message to a single Discord Webhook."""
    if not webhook_url or not webhook_url.strip():
        return False, "Discord Webhook URL이 설정되지 않았습니다."

    url = webhook_url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        return False, "올바른 형식의 Discord Webhook URL이 아닙니다."

    md_text = _html_to_markdown(text)
    # 2000자 초과 시 truncate
    if len(md_text) > 1950:
        md_text = md_text[:1900] + "\n...(내용이 길어 생략되었습니다)"

    payload = {
        "username": "ETF Lens Intelligence",
        "content": md_text
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
            # Discord webhooks return 204 No Content or 200 OK on success
            if res.status_code in [200, 204]:
                logger.debug(f"[Notifier] Discord notification sent successfully.")
                return True, "성공"
            else:
                err_msg = f"Discord API 오류 {res.status_code}: {res.text}"
                logger.error(f"[Notifier] {err_msg}")
                return False, err_msg
    except Exception as e:
        err_msg = f"Discord 네트워크 예외: {str(e)}"
        logger.error(f"[Notifier] {err_msg}")
        return False, err_msg


async def _send_single_slack_message(text: str, webhook_url: str, title: str = None) -> tuple[bool, str]:
    """Helper function to send a message to a single Slack Incoming Webhook."""
    if not webhook_url or not webhook_url.strip():
        return False, "Slack Webhook URL이 설정되지 않았습니다."

    url = webhook_url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        return False, "올바른 형식의 Slack Webhook URL이 아닙니다."

    mrkdwn_text = _html_to_slack_mrkdwn(text)
    if len(mrkdwn_text) > 2950:
        mrkdwn_text = mrkdwn_text[:2900] + "\n...(내용이 길어 생략되었습니다)"

    payload = {
        "text": mrkdwn_text
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200 and res.text == "ok":
                logger.debug(f"[Notifier] Slack notification sent successfully.")
                return True, "성공"
            else:
                err_msg = f"Slack API 오류 {res.status_code}: {res.text}"
                logger.error(f"[Notifier] {err_msg}")
                return False, err_msg
    except Exception as e:
        err_msg = f"Slack 네트워크 예외: {str(e)}"
        logger.error(f"[Notifier] {err_msg}")
        return False, err_msg


async def send_discord_message(text: str, webhook_url: str = None, force: bool = False, category: str = "general") -> tuple[bool, str]:
    """단일 웹훅 또는 DB 전체 Discord 등록 사용자 대상 전송."""
    if webhook_url:
        return await _send_single_discord_message(text, webhook_url)

    all_settings = await get_all_notification_settings()
    if not all_settings:
        return False, "등록된 알림 설정이 없습니다."

    success_count = 0
    total_count = 0
    error_messages = []

    for s in all_settings:
        if not s.discord_webhook_url or getattr(s, "channel_discord", 0) == 0:
            continue
        if not force and not _is_category_enabled(s, category):
            continue
        total_count += 1
        ok, err = await _send_single_discord_message(text, s.discord_webhook_url)
        if ok:
            success_count += 1
        else:
            error_messages.append(err)

    if total_count == 0:
        return False, f"카테고리 '{category}' Discord 수신 대상이 없습니다."
    return (success_count > 0), "; ".join(error_messages) if error_messages else "성공"


async def send_slack_message(text: str, webhook_url: str = None, force: bool = False, category: str = "general") -> tuple[bool, str]:
    """단일 웹훅 또는 DB 전체 Slack 등록 사용자 대상 전송."""
    if webhook_url:
        return await _send_single_slack_message(text, webhook_url)

    all_settings = await get_all_notification_settings()
    if not all_settings:
        return False, "등록된 알림 설정이 없습니다."

    success_count = 0
    total_count = 0
    error_messages = []

    for s in all_settings:
        if not s.slack_webhook_url or getattr(s, "channel_slack", 0) == 0:
            continue
        if not force and not _is_category_enabled(s, category):
            continue
        total_count += 1
        ok, err = await _send_single_slack_message(text, s.slack_webhook_url)
        if ok:
            success_count += 1
        else:
            error_messages.append(err)

    if total_count == 0:
        return False, f"카테고리 '{category}' Slack 수신 대상이 없습니다."
    return (success_count > 0), "; ".join(error_messages) if error_messages else "성공"


def _is_category_enabled(settings: NotificationSettings, category: str) -> bool:
    """사용자 설정에서 해당 카테고리 알림이 켜져 있는지 확인."""
    if category == "exit_signal":
        return getattr(settings, "alert_exit_signal", 1) == 1
    if category == "rebalance":
        return getattr(settings, "alert_rebalance", 1) == 1
    if category == "daily_summary":
        return getattr(settings, "alert_daily_summary", 0) == 1
    if category == "brazil_bond":
        return getattr(settings, "alert_brazil", 1) == 1
    if category == "disparity":
        return getattr(settings, "alert_disparity", 1) == 1
    return True


async def send_telegram_message(text: str, force: bool = False, category: str = "general", test_token: str = None, test_chat_id: str = None) -> tuple[bool, str]:
    """
    Send a message via Telegram Bot API asynchronously.
    If test_token or test_chat_id is specified, sends to that single target.
    Otherwise, broadcasts to all registered settings in the database.
    """
    # 1. If explicit test arguments are provided, bypass database broadcast
    if test_token or test_chat_id:
        token = test_token or os.environ.get("TELEGRAM_TOKEN")
        chat_id = test_chat_id or os.environ.get("TELEGRAM_CHAT_ID")
        return await _send_single_telegram_message(text, token, chat_id)

    # 2. Retrieve all database settings
    all_settings = await get_all_notification_settings()

    if not all_settings:
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
        if not settings.telegram_token or not settings.telegram_chat_id:
            continue
        if getattr(settings, "channel_telegram", 1) == 0:
            continue

        if not force and not _is_category_enabled(settings, category):
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


async def broadcast_notification(text: str, category: str = "general", title: str = None, force: bool = False) -> dict:
    """
    등록된 모든 사용자 대상 멀티채널(Telegram, Discord, Slack) 통합 비동기 멀티캐스트 발송.
    """
    all_settings = await get_all_notification_settings()
    results = {
        "telegram": {"success": 0, "total": 0, "errors": []},
        "discord": {"success": 0, "total": 0, "errors": []},
        "slack": {"success": 0, "total": 0, "errors": []},
        "any_success": False
    }

    if not all_settings:
        # Fallback to env for telegram
        token = os.environ.get("TELEGRAM_TOKEN")
        chat_id = os.environ.get("TELEGRAM_CHAT_ID")
        if token and chat_id:
            ok, err = await _send_single_telegram_message(text, token, chat_id)
            if ok:
                results["telegram"]["success"] += 1
                results["any_success"] = True
            else:
                results["telegram"]["errors"].append(err)
            results["telegram"]["total"] += 1
        return results

    tasks = []

    async def _send_tg(s):
        results["telegram"]["total"] += 1
        ok, err = await _send_single_telegram_message(text, s.telegram_token, s.telegram_chat_id)
        if ok:
            results["telegram"]["success"] += 1
            results["any_success"] = True
        else:
            results["telegram"]["errors"].append(f"Chat {s.telegram_chat_id}: {err}")

    async def _send_dc(s):
        results["discord"]["total"] += 1
        ok, err = await _send_single_discord_message(text, s.discord_webhook_url, title)
        if ok:
            results["discord"]["success"] += 1
            results["any_success"] = True
        else:
            results["discord"]["errors"].append(err)

    async def _send_sl(s):
        results["slack"]["total"] += 1
        ok, err = await _send_single_slack_message(text, s.slack_webhook_url, title)
        if ok:
            results["slack"]["success"] += 1
            results["any_success"] = True
        else:
            results["slack"]["errors"].append(err)

    for s in all_settings:
        if not force and not _is_category_enabled(s, category):
            continue

        # Telegram
        if getattr(s, "channel_telegram", 1) == 1 and s.telegram_token and s.telegram_chat_id:
            tasks.append(_send_tg(s))

        # Discord
        if getattr(s, "channel_discord", 0) == 1 and s.discord_webhook_url:
            tasks.append(_send_dc(s))

        # Slack
        if getattr(s, "channel_slack", 0) == 1 and s.slack_webhook_url:
            tasks.append(_send_sl(s))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

    return results
