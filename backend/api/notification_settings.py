from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from db.models import NotificationSettings
from pydantic import BaseModel, Field
from typing import Optional
from core.notifier import (
    send_telegram_message,
    send_discord_message,
    send_slack_message,
    _send_single_telegram_message,
    _send_single_discord_message,
    _send_single_slack_message,
)

router = APIRouter(prefix="/api/v1/notification", tags=["Notification"])


class SettingsSchema(BaseModel):
    # 텔레그램
    telegram_token: Optional[str] = Field(None, description="Telegram Bot Token")
    telegram_chat_id: Optional[str] = Field(None, description="Telegram Chat ID")
    # 디스코드 & 슬랙 웹훅
    discord_webhook_url: Optional[str] = Field(None, description="Discord Webhook URL")
    slack_webhook_url: Optional[str] = Field(None, description="Slack Incoming Webhook URL")
    # 채널별 활성화 토글 (0 or 1)
    channel_telegram: Optional[int] = Field(None, description="1 if Telegram channel enabled, 0 otherwise")
    channel_discord: Optional[int] = Field(None, description="1 if Discord channel enabled, 0 otherwise")
    channel_slack: Optional[int] = Field(None, description="1 if Slack channel enabled, 0 otherwise")
    # 알림 카테고리
    alert_exit_signal: Optional[int] = Field(None, description="1 if exit signal alert enabled, 0 otherwise")
    alert_rebalance: Optional[int] = Field(None, description="1 if rebalance recommendation alert enabled, 0 otherwise")
    alert_daily_summary: Optional[int] = Field(None, description="1 if morning summary enabled, 0 otherwise")
    alert_brazil: Optional[int] = Field(None, description="1 if Brazil bond event/news alert enabled, 0 otherwise")
    # 괴리율 실시간 경보
    alert_disparity: Optional[int] = Field(None, description="1 if ETF disparity rate alert enabled, 0 otherwise")
    disparity_threshold: Optional[float] = Field(None, description="Disparity absolute threshold in % (e.g. 2.0)")
    disparity_target_scope: Optional[str] = Field(None, description="'PORTFOLIO' (보유/관심) or 'ALL' (전체 시장)")


class TestSchema(BaseModel):
    channel: Optional[str] = Field("telegram", description="Target channel: 'telegram', 'discord', or 'slack'")
    telegram_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    discord_webhook_url: Optional[str] = None
    slack_webhook_url: Optional[str] = None


def mask_token(token: Optional[str]) -> Optional[str]:
    if not token:
        return ""
    token = token.strip()
    if len(token) <= 10:
        return "*******"
    return f"{token[:6]}*******{token[-4:]}"


def mask_webhook_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return ""
    url = url.strip()
    if len(url) <= 25:
        return "*******"
    # Show domain and mask secret token at the end
    prefix = url[:30]
    return f"{prefix}*******{url[-6:]}"


@router.get("/settings", response_model=SettingsSchema)
async def get_settings(chat_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    settings = None
    if chat_id:
        result = await db.execute(select(NotificationSettings).where(NotificationSettings.telegram_chat_id == chat_id))
        settings = result.scalars().first()

    # Fallback to the first record if chat_id not provided or not matched
    if not settings:
        result = await db.execute(select(NotificationSettings))
        settings = result.scalars().first()

    if not settings:
        return SettingsSchema(
            telegram_token="",
            telegram_chat_id="",
            discord_webhook_url="",
            slack_webhook_url="",
            channel_telegram=1,
            channel_discord=0,
            channel_slack=0,
            alert_exit_signal=1,
            alert_rebalance=1,
            alert_daily_summary=0,
            alert_brazil=1,
            alert_disparity=1,
            disparity_threshold=2.0,
            disparity_target_scope="PORTFOLIO"
        )

    return SettingsSchema(
        telegram_token=mask_token(settings.telegram_token),
        telegram_chat_id=settings.telegram_chat_id or "",
        discord_webhook_url=mask_webhook_url(settings.discord_webhook_url),
        slack_webhook_url=mask_webhook_url(settings.slack_webhook_url),
        channel_telegram=getattr(settings, "channel_telegram", 1),
        channel_discord=getattr(settings, "channel_discord", 0),
        channel_slack=getattr(settings, "channel_slack", 0),
        alert_exit_signal=getattr(settings, "alert_exit_signal", 1),
        alert_rebalance=getattr(settings, "alert_rebalance", 1),
        alert_daily_summary=getattr(settings, "alert_daily_summary", 0),
        alert_brazil=getattr(settings, "alert_brazil", 1),
        alert_disparity=getattr(settings, "alert_disparity", 1),
        disparity_threshold=getattr(settings, "disparity_threshold", 2.0) or 2.0,
        disparity_target_scope=getattr(settings, "disparity_target_scope", "PORTFOLIO") or "PORTFOLIO"
    )


@router.post("/settings")
async def save_settings(data: SettingsSchema, db: AsyncSession = Depends(get_db)):
    # 1. 기존 레코드 검색: chat_id 우선, 없으면 첫 번째 레코드
    settings = None
    if data.telegram_chat_id:
        result = await db.execute(select(NotificationSettings).where(NotificationSettings.telegram_chat_id == data.telegram_chat_id))
        settings = result.scalars().first()

    if not settings:
        result = await db.execute(select(NotificationSettings))
        settings = result.scalars().first()

    # 2. 마스킹된 값 보존 처리
    token_to_save = data.telegram_token
    if settings and data.telegram_token and "******" in data.telegram_token:
        token_to_save = settings.telegram_token

    discord_url_to_save = data.discord_webhook_url
    if settings and data.discord_webhook_url and "******" in data.discord_webhook_url:
        discord_url_to_save = settings.discord_webhook_url

    slack_url_to_save = data.slack_webhook_url
    if settings and data.slack_webhook_url and "******" in data.slack_webhook_url:
        slack_url_to_save = settings.slack_webhook_url

    # 3. 신규 레코드 생성 시 기본값 할당
    if not settings:
        settings = NotificationSettings()
        settings.alert_exit_signal = 1
        settings.alert_rebalance = 1
        settings.alert_daily_summary = 0
        settings.alert_brazil = 1
        settings.alert_disparity = 1
        settings.disparity_threshold = 2.0
        settings.disparity_target_scope = "PORTFOLIO"
        settings.channel_telegram = 1
        settings.channel_discord = 0
        settings.channel_slack = 0
        db.add(settings)

    # 4. 값 갱신
    if token_to_save is not None:
        settings.telegram_token = token_to_save
    if data.telegram_chat_id is not None:
        settings.telegram_chat_id = data.telegram_chat_id

    if discord_url_to_save is not None:
        settings.discord_webhook_url = discord_url_to_save
    if slack_url_to_save is not None:
        settings.slack_webhook_url = slack_url_to_save

    if data.channel_telegram is not None:
        settings.channel_telegram = data.channel_telegram
    if data.channel_discord is not None:
        settings.channel_discord = data.channel_discord
    if data.channel_slack is not None:
        settings.channel_slack = data.channel_slack

    # 알림 카테고리 부분 업데이트
    if data.alert_exit_signal is not None:
        settings.alert_exit_signal = data.alert_exit_signal
    if data.alert_rebalance is not None:
        settings.alert_rebalance = data.alert_rebalance
    if data.alert_daily_summary is not None:
        settings.alert_daily_summary = data.alert_daily_summary
    if data.alert_brazil is not None:
        settings.alert_brazil = data.alert_brazil
    if data.alert_disparity is not None:
        settings.alert_disparity = data.alert_disparity
    if data.disparity_threshold is not None:
        settings.disparity_threshold = round(float(data.disparity_threshold), 2)
    if data.disparity_target_scope is not None:
        settings.disparity_target_scope = data.disparity_target_scope

    try:
        await db.commit()
        await db.refresh(settings)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"설정 저장 중 오류가 발생했습니다: {e}")

    return {"status": "success", "msg": "알림 설정이 성공적으로 저장되었습니다."}


@router.post("/test")
async def test_notification(data: TestSchema, db: AsyncSession = Depends(get_db)):
    target_channel = (data.channel or "telegram").lower().strip()

    # DB 레코드 조회 (마스킹 복원용)
    result = await db.execute(select(NotificationSettings))
    all_s = result.scalars().all()
    matched_s = None
    if data.telegram_chat_id:
        for s in all_s:
            if s.telegram_chat_id == data.telegram_chat_id:
                matched_s = s
                break
    if not matched_s and all_s:
        matched_s = all_s[0]

    test_message_html = (
        "<b>✨ [i-Prism] 실시간 알림 채널 검증 완료</b>\n\n"
        "알림 수신 채널이 성공적으로 연결되었습니다!\n"
        "앞으로 <b>손절(Exit) 시그널</b>, <b>AI 포트폴리오 리밸런싱</b>, <b>ETF 괴리율 실시간 경보</b>가 발생하면 "
        "이 채널로 즉시 상세 브리핑을 전달해 드립니다. 📈"
    )

    # 1. Telegram 채널 테스트
    if target_channel == "telegram":
        token = data.telegram_token
        chat_id = data.telegram_chat_id

        if token and "******" in token:
            if matched_s and matched_s.telegram_token:
                token = matched_s.telegram_token
            else:
                raise HTTPException(status_code=400, detail="저장된 Telegram 봇 토큰이 없습니다. 먼저 토큰을 입력해 주세요.")

        if not token or not chat_id:
            raise HTTPException(status_code=400, detail="Telegram 봇 토큰과 Chat ID를 모두 입력해 주세요.")

        try:
            ok, err = await _send_single_telegram_message(test_message_html, token, chat_id)
            if not ok:
                raise HTTPException(status_code=400, detail=f"Telegram 전송 실패: {err}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Telegram 전송 중 서버 오류: {str(e)}")

        return {"status": "success", "msg": "Telegram 테스트 알림을 성공적으로 발송했습니다. 수신 상태를 확인하세요!"}

    # 2. Discord 채널 테스트
    elif target_channel == "discord":
        url = data.discord_webhook_url
        if url and "******" in url:
            if matched_s and matched_s.discord_webhook_url:
                url = matched_s.discord_webhook_url
            else:
                raise HTTPException(status_code=400, detail="저장된 Discord Webhook URL이 없습니다.")

        if not url:
            raise HTTPException(status_code=400, detail="Discord Webhook URL을 입력해 주세요.")

        try:
            ok, err = await _send_single_discord_message(test_message_html, url, title="i-Prism 알림 채널 검증")
            if not ok:
                raise HTTPException(status_code=400, detail=f"Discord 전송 실패: {err}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Discord 전송 중 서버 오류: {str(e)}")

        return {"status": "success", "msg": "Discord 테스트 알림을 성공적으로 발송했습니다. 디스코드 채널을 확인하세요!"}

    # 3. Slack 채널 테스트
    elif target_channel == "slack":
        url = data.slack_webhook_url
        if url and "******" in url:
            if matched_s and matched_s.slack_webhook_url:
                url = matched_s.slack_webhook_url
            else:
                raise HTTPException(status_code=400, detail="저장된 Slack Webhook URL이 없습니다.")

        if not url:
            raise HTTPException(status_code=400, detail="Slack Webhook URL을 입력해 주세요.")

        try:
            ok, err = await _send_single_slack_message(test_message_html, url, title="i-Prism 알림 채널 검증")
            if not ok:
                raise HTTPException(status_code=400, detail=f"Slack 전송 실패: {err}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Slack 전송 중 서버 오류: {str(e)}")

        return {"status": "success", "msg": "Slack 테스트 알림을 성공적으로 발송했습니다. 슬랙 채널을 확인하세요!"}

    else:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 알림 채널입니다: {target_channel}")
