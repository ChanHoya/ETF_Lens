from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from db.models import NotificationSettings
from pydantic import BaseModel, Field
from typing import Optional
from core.notifier import send_telegram_message

router = APIRouter(prefix="/api/v1/notification", tags=["Notification"])

class SettingsSchema(BaseModel):
    telegram_token: Optional[str] = Field(None, description="Telegram Bot Token")
    telegram_chat_id: Optional[str] = Field(None, description="Telegram Chat ID")
    alert_exit_signal: int = Field(1, description="1 if exit signal alert enabled, 0 otherwise")
    alert_rebalance: int = Field(1, description="1 if rebalance recommendation alert enabled, 0 otherwise")
    alert_daily_summary: int = Field(0, description="1 if morning summary enabled, 0 otherwise")
    alert_brazil: int = Field(1, description="1 if Brazil bond event/news alert enabled, 0 otherwise")

class TestSchema(BaseModel):
    telegram_token: str
    telegram_chat_id: str

def mask_token(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    if len(token) <= 12:
        return "*******"
    return f"{token[:6]}*******{token[-4:]}"

@router.get("/settings", response_model=SettingsSchema)
async def get_settings(chat_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    settings = None
    if chat_id:
        result = await db.execute(select(NotificationSettings).where(NotificationSettings.telegram_chat_id == chat_id))
        settings = result.scalars().first()
    
    if not settings:
        # Fallback to the latest settings for backward compatibility if no chat_id was provided or found
        result = await db.execute(select(NotificationSettings).order_by(NotificationSettings.id.desc()))
        settings = result.scalars().first()
    
    if not settings:
        return SettingsSchema(
            telegram_token="",
            telegram_chat_id="",
            alert_exit_signal=1,
            alert_rebalance=1,
            alert_daily_summary=0,
            alert_brazil=1
        )

    return SettingsSchema(
        telegram_token=mask_token(settings.telegram_token),
        telegram_chat_id=settings.telegram_chat_id,
        alert_exit_signal=settings.alert_exit_signal,
        alert_rebalance=settings.alert_rebalance,
        alert_daily_summary=settings.alert_daily_summary,
        alert_brazil=getattr(settings, "alert_brazil", 1)
    )

@router.post("/settings")
async def save_settings(data: SettingsSchema, db: AsyncSession = Depends(get_db)):
    # Fetch existing setting by telegram_chat_id to support individual registration
    settings = None
    if data.telegram_chat_id:
        result = await db.execute(select(NotificationSettings).where(NotificationSettings.telegram_chat_id == data.telegram_chat_id))
        settings = result.scalars().first()
    
    # Check if we should preserve the masked token
    token_to_save = data.telegram_token
    if settings and data.telegram_token and "******" in data.telegram_token:
        # User did not modify the token, keep original
        token_to_save = settings.telegram_token
        
    if not settings:
        settings = NotificationSettings()
        db.add(settings)
        
    settings.telegram_token = token_to_save
    settings.telegram_chat_id = data.telegram_chat_id
    settings.alert_exit_signal = data.alert_exit_signal
    settings.alert_rebalance = data.alert_rebalance
    settings.alert_daily_summary = data.alert_daily_summary
    settings.alert_brazil = data.alert_brazil
    
    try:
        await db.commit()
        await db.refresh(settings)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"설정 저장 중 오류가 발생했습니다: {e}")
        
    return {"status": "success", "msg": "알림 설정이 성공적으로 저장되었습니다."}

@router.post("/test")
async def test_notification(data: TestSchema, db: AsyncSession = Depends(get_db)):
    token = data.telegram_token
    
    # If token is masked, retrieve from DB matching the chat_id
    if "******" in token:
        result = await db.execute(select(NotificationSettings).where(NotificationSettings.telegram_chat_id == data.telegram_chat_id))
        settings = result.scalars().first()
        if settings and settings.telegram_token:
            token = settings.telegram_token
        else:
            # Fallback to the latest one
            result = await db.execute(select(NotificationSettings).order_by(NotificationSettings.id.desc()))
            settings = result.scalars().first()
            if settings and settings.telegram_token:
                token = settings.telegram_token
            else:
                raise HTTPException(status_code=400, detail="저장된 토큰이 없습니다. 먼저 토큰을 입력해 주세요.")
            
    test_message = (
        "<b>✨ [ETF Lens] 실시간 알림 채널 검증 완료</b>\n\n"
        "알림 수신 봇이 성공적으로 연결되었습니다!\n"
        "앞으로 포트폴리오의 <b>Exit(손절) 시그널</b> 및 <b>AI 자산 리밸런싱 추천 제안</b>이 감지되면 이 채널로 실시간 브리핑을 보내드립니다. 📈"
    )
    
    try:
        success, error_msg = await send_telegram_message(
            test_message, 
            force=True, 
            test_token=token, 
            test_chat_id=data.telegram_chat_id
        )
        if not success:
            raise HTTPException(status_code=400, detail=f"전송 실패: {error_msg}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"메시지 전송 중 서버 오류: {str(e)}")
            
    return {"status": "success", "msg": "테스트 텔레그램 알림을 성공적으로 발송했습니다. 수신 상태를 확인해 보세요!"}

